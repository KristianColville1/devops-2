import time

from botocore.exceptions import ClientError

from utils import aws, state, ssh

CLUSTER_ID = "devops2-redis"
SUBNET_GROUP = "devops2-redis-subnets"
SG_NAME = "devops2-redis-sg"
NODE_TYPE = "cache.t3.micro"
PORT = 6379


def get_vpc_and_private_subnets():
    """Return (vpc_id, subnet_ids) using private subnets from state, or default VPC as fallback."""
    from utils import state as _state
    vpc_id = _state.get("vpc_id")
    private_subnets = _state.get("private_subnet_ids")
    if vpc_id and private_subnets:
        return vpc_id, private_subnets
    # Fallback: default VPC with all subnets (no custom VPC created yet)
    client = aws.ec2_client()
    vpcs = client.describe_vpcs(Filters=[{"Name": "isDefault", "Values": ["true"]}])
    if not vpcs["Vpcs"]:
        raise RuntimeError(f"No VPC found in {aws.REGION} — run 00_create_vpc.py first")
    vpc_id = vpcs["Vpcs"][0]["VpcId"]
    resp = client.describe_subnets(Filters=[{"Name": "vpc-id", "Values": [vpc_id]}])
    return vpc_id, [s["SubnetId"] for s in resp["Subnets"]]


def ensure_subnet_group(subnet_ids):
    """Create the ElastiCache subnet group if it doesn't exist."""
    client = aws.elasticache_client()
    try:
        client.describe_cache_subnet_groups(CacheSubnetGroupName=SUBNET_GROUP)
        print(f"  subnet group: {SUBNET_GROUP} (already exists)")
        return
    except ClientError as e:
        if e.response["Error"]["Code"] != "CacheSubnetGroupNotFoundFault":
            raise
    client.create_cache_subnet_group(
        CacheSubnetGroupName=SUBNET_GROUP,
        CacheSubnetGroupDescription="devops2 ElastiCache subnets",
        SubnetIds=subnet_ids,
    )
    print(f"  subnet group: {SUBNET_GROUP} created")


def ensure_redis_sg(vpc_id):
    """Create a SG allowing Redis access from the master instance SG."""
    client = aws.ec2_client()
    existing = client.describe_security_groups(
        Filters=[
            {"Name": "group-name", "Values": [SG_NAME]},
            {"Name": "vpc-id", "Values": [vpc_id]},
        ]
    )
    if existing["SecurityGroups"]:
        sg_id = existing["SecurityGroups"][0]["GroupId"]
        print(f"  redis SG: {sg_id} (already exists)")
        return sg_id

    sg = client.create_security_group(
        GroupName=SG_NAME,
        Description="Redis access for devops2 backend",
        VpcId=vpc_id,
    )
    sg_id = sg["GroupId"]

    # Allow Redis port from the master SG so EC2 instances can reach it
    master_sg = state.get("master_sg_id")
    source = {"CidrIp": "0.0.0.0/0", "Description": "Redis"} if not master_sg else None
    user_id_group = {"GroupId": master_sg, "Description": "Master SG"} if master_sg else None

    ip_perm = {"FromPort": PORT, "ToPort": PORT, "IpProtocol": "tcp"}
    if user_id_group:
        ip_perm["UserIdGroupPairs"] = [user_id_group]
    else:
        ip_perm["IpRanges"] = [source]

    client.authorize_security_group_ingress(GroupId=sg_id, IpPermissions=[ip_perm])
    print(f"  redis SG: {sg_id}")
    return sg_id


def cluster_status():
    """Return current cluster status string, or None if it doesn't exist."""
    client = aws.elasticache_client()
    try:
        resp = client.describe_cache_clusters(
            CacheClusterId=CLUSTER_ID,
            ShowCacheNodeInfo=True,
        )
        return resp["CacheClusters"][0]["CacheClusterStatus"]
    except ClientError as e:
        if e.response["Error"]["Code"] == "CacheClusterNotFound":
            return None
        raise


def create_cluster(sg_id):
    """Create a single-node Redis cluster."""
    client = aws.elasticache_client()
    client.create_cache_cluster(
        CacheClusterId=CLUSTER_ID,
        Engine="redis",
        CacheNodeType=NODE_TYPE,
        NumCacheNodes=1,
        CacheSubnetGroupName=SUBNET_GROUP,
        SecurityGroupIds=[sg_id],
        Port=PORT,
    )


def wait_available(retries=40, delay=30):
    """Poll until the cluster status is available."""
    print("  waiting for cluster to become available", end="", flush=True)
    for _ in range(retries):
        status = cluster_status()
        if status == "available":
            print(" done.")
            return
        if status in (None, "deleted", "deleting"):
            raise RuntimeError(f"Cluster {CLUSTER_ID} disappeared while waiting")
        print(".", end="", flush=True)
        time.sleep(delay)
    raise RuntimeError(f"Cluster {CLUSTER_ID} did not become available in time")


def get_endpoint():
    """Return the Redis endpoint address once the cluster is available."""
    client = aws.elasticache_client()
    resp = client.describe_cache_clusters(
        CacheClusterId=CLUSTER_ID,
        ShowCacheNodeInfo=True,
    )
    node = resp["CacheClusters"][0]["CacheNodes"][0]
    return node["Endpoint"]["Address"]


def update_master_env(redis_url):
    """Append or update REDIS_URL in the master instance .env and restart the service."""
    ip = state.get("master_public_ip")
    pem = state.get("pem_file")
    if not ip or not pem:
        print("  no master in state — skipping env update")
        return

    print(f"  updating master .env with REDIS_URL...")
    # Update existing line or append if not present
    ssh.run(ip, pem, (
        f"grep -q '^REDIS_URL=' ~/app/.env "
        f"&& sed -i 's|^REDIS_URL=.*|REDIS_URL={redis_url}|' ~/app/.env "
        f"|| echo 'REDIS_URL={redis_url}' >> ~/app/.env"
    ))
    ssh.run(ip, pem, "sudo systemctl restart devops2")
    print("  service restarted")


def ensure_cluster():
    """Create the ElastiCache Redis cluster end to end and wire it to the master."""
    status = cluster_status()

    if status == "available":
        endpoint = get_endpoint()
        redis_url = f"redis://{endpoint}:{PORT}"
        print(f"  cluster: {CLUSTER_ID} (already available)")
        print(f"  endpoint: {endpoint}")
        state.update(redis_endpoint=endpoint, redis_url=redis_url)
        update_master_env(redis_url)
        return redis_url

    vpc_id, subnet_ids = get_vpc_and_private_subnets()

    print(f"  VPC: {vpc_id}  |  subnets: {len(subnet_ids)} found")
    ensure_subnet_group(subnet_ids)
    sg_id = ensure_redis_sg(vpc_id)

    if status is None:
        print(f"  creating cluster: {CLUSTER_ID}  ({NODE_TYPE})")
        create_cluster(sg_id)
    else:
        print(f"  cluster exists, status: {status}")

    wait_available()

    endpoint = get_endpoint()
    redis_url = f"redis://{endpoint}:{PORT}"
    print(f"  endpoint: {endpoint}")

    state.update(
        redis_cluster_id=CLUSTER_ID,
        redis_sg_id=sg_id,
        redis_endpoint=endpoint,
        redis_url=redis_url,
    )

    update_master_env(redis_url)
    return redis_url
