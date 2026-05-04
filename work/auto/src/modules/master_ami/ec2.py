import os

from botocore.exceptions import ClientError

from utils import aws
from . import config


def get_vpc():
    """Return the VPC ID to use — custom VPC from state, or default VPC as fallback."""
    from utils import state as _state
    vpc_id = _state.get("vpc_id")
    if vpc_id:
        return vpc_id
    client = aws.ec2_client()
    vpcs = client.describe_vpcs(Filters=[{"Name": "isDefault", "Values": ["true"]}])
    if not vpcs["Vpcs"]:
        raise RuntimeError(f"No VPC found in {config.REGION} — run 00_create_vpc.py first")
    return vpcs["Vpcs"][0]["VpcId"]


def create_key_pair():
    """Create a new key pair in AWS, or import an existing local one."""
    client = aws.ec2_client()
    pub_path = config.PEM_FILE + ".pub"

    if os.path.isfile(config.PEM_FILE) and os.path.isfile(pub_path):
        with open(pub_path, "rb") as f:
            pub = f.read()
        try:
            client.import_key_pair(KeyName=config.KEY_NAME, PublicKeyMaterial=pub)
        except ClientError as e:
            if e.response["Error"]["Code"] != "InvalidKeyPair.Duplicate":
                raise
        print(f"  key pair: {config.KEY_NAME} (imported from local)")
        return config.KEY_NAME

    try:
        resp = client.create_key_pair(KeyName=config.KEY_NAME)
        with open(config.PEM_FILE, "w") as f:
            f.write(resp["KeyMaterial"])
        os.chmod(config.PEM_FILE, 0o600)
        print(f"  key pair: {config.KEY_NAME} -> {config.PEM_FILE}")
    except ClientError as e:
        if e.response["Error"]["Code"] != "InvalidKeyPair.Duplicate":
            raise
        # Key exists in AWS but we have no local .pem — SSH will fail later without it
        if not os.path.isfile(config.PEM_FILE):
            raise RuntimeError(
                f"Key pair '{config.KEY_NAME}' already exists in AWS but {config.PEM_FILE} not found locally. "
                "Restore the .pem or delete the key from AWS and re-run."
            ) from None
        print(f"  key pair: {config.KEY_NAME} (already in AWS)")

    return config.KEY_NAME


def create_security_group(vpc_id):
    """Create an SG with SSH and the app port open. Skips creation if it already exists."""
    client = aws.ec2_client()

    existing = client.describe_security_groups(
        Filters=[
            {"Name": "group-name", "Values": [config.SG_NAME]},
            {"Name": "vpc-id", "Values": [vpc_id]},
        ]
    )
    if existing["SecurityGroups"]:
        sg_id = existing["SecurityGroups"][0]["GroupId"]
        print(f"  security group: {sg_id} (already exists)")
        return sg_id

    sg = client.create_security_group(
        GroupName=config.SG_NAME,
        Description="SSH and app port for devops2 master",
        VpcId=vpc_id,
    )
    sg_id = sg["GroupId"]
    client.authorize_security_group_ingress(
        GroupId=sg_id,
        IpPermissions=[
            {
                "FromPort": 22, "ToPort": 22, "IpProtocol": "tcp",
                "IpRanges": [{"CidrIp": "0.0.0.0/0", "Description": "SSH"}],
            },
            {
                "FromPort": config.APP_PORT, "ToPort": config.APP_PORT, "IpProtocol": "tcp",
                "IpRanges": [{"CidrIp": "0.0.0.0/0", "Description": "Node backend"}],
            },
        ],
    )
    print(f"  security group: {sg_id}")
    return sg_id


def launch_instance(key_name, sg_id, subnet_id=None):
    """Launch a tagged master instance with the Academy IAM profile attached.

    subnet_id: place the instance in this specific subnet (required for custom VPC public subnet).
    """
    resource = aws.ec2_resource()
    kwargs = dict(
        ImageId=config.BASE_AMI,
        MinCount=1,
        MaxCount=1,
        InstanceType=config.INSTANCE_TYPE,
        KeyName=key_name,
        SecurityGroupIds=[sg_id],
        IamInstanceProfile={"Name": "LabInstanceProfile"},
        TagSpecifications=[{
            "ResourceType": "instance",
            "Tags": [{"Key": "Name", "Value": "devops2-master"}],
        }],
    )
    if subnet_id:
        kwargs["SubnetId"] = subnet_id
    instances = resource.create_instances(**kwargs)
    return instances[0]
