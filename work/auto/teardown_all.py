"""
Full stack teardown — deletes everything in the correct order.

Order matters:
  1. CloudFront distribution (disable + wait + delete — takes ~10 min)
  2. CloudFormation stack (ALB, ASG, launch template, CF security groups)
  3. Master EC2 instance + master security group
  4. ElastiCache Redis cluster + Redis security group
  5. VPC networking (NAT Gateway first — stops hourly charge, then subnets/IGW/VPC)

NOT deleted (intentional):
  - DynamoDB table, the data survives teardowns by design
"""

import sys
import time
import boto3
from botocore.exceptions import ClientError
from utils import aws, state
from utils.dotenv import load_dotenv
from teardown_ec2s import terminate_instance, delete_security_group
from teardown_cloudformation import delete_cf_stack, cf_status
from teardown_vpc import (
    delete_nat_gateway, release_eip, delete_route_tables,
    delete_subnets, delete_igw, delete_vpc,
)

load_dotenv()

STACK_NAME_BASE = "devops2-stack"
CLUSTER_ID = "devops2-redis"


def _banner(step, total, title):
    print(f"\n{'─' * 60}")
    print(f"  {step}/{total} — {title}")
    print(f"{'─' * 60}")


# ---------------------------------------------------------------------------
# CloudFront
# ---------------------------------------------------------------------------

def delete_cloudfront_distribution():
    dist_id = state.get("cloudfront_id")
    if not dist_id:
        print("  no CloudFront distribution in state — skipping")
        return

    cf = boto3.client("cloudfront", region_name="us-east-1")

    try:
        resp = cf.get_distribution(Id=dist_id)
    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchDistribution":
            print(f"  distribution {dist_id}: already deleted")
            state.update(cloudfront_id=None, cloudfront_url=None)
            return
        raise

    dist   = resp["Distribution"]
    config = resp["Distribution"]["DistributionConfig"]
    etag   = resp["ETag"]
    status = dist["Status"]

    if config.get("Enabled"):
        print(f"  disabling distribution {dist_id}...")
        config["Enabled"] = False
        cf.update_distribution(Id=dist_id, DistributionConfig=config, IfMatch=etag)
        print("  waiting for Deployed (disabled)", end="", flush=True)
        for _ in range(40):  # max 20 min
            time.sleep(30)
            r = cf.get_distribution(Id=dist_id)
            if r["Distribution"]["Status"] == "Deployed":
                etag = r["ETag"]
                print(" done.")
                break
            print(".", end="", flush=True)
        else:
            print("\n  timed out waiting for disable — re-run teardown to retry")
            return
    else:
        print(f"  distribution {dist_id}: already disabled, status={status}")
        etag = resp["ETag"]

    print(f"  deleting distribution {dist_id}...")
    cf.delete_distribution(Id=dist_id, IfMatch=etag)
    print("  deleted")
    state.update(cloudfront_id=None, cloudfront_url=None, frontend_url=None)


# ---------------------------------------------------------------------------
# ElastiCache
# ---------------------------------------------------------------------------

def delete_elasticache_cluster(cluster_id):
    ec_client = aws.elasticache_client()
    try:
        status_resp = ec_client.describe_cache_clusters(CacheClusterId=cluster_id)
        current_status = status_resp["CacheClusters"][0]["CacheClusterStatus"]
    except ClientError as e:
        if "CacheClusterNotFound" in e.response["Error"]["Code"]:
            print(f"  cluster {cluster_id}: not found — already deleted")
            return
        raise

    if current_status == "deleting":
        print(f"  cluster {cluster_id}: already deleting, waiting...")
    else:
        print(f"  deleting cluster: {cluster_id}")
        ec_client.delete_cache_cluster(CacheClusterId=cluster_id)

    print("  waiting for cluster deletion", end="", flush=True)
    for _ in range(40):
        try:
            resp = ec_client.describe_cache_clusters(CacheClusterId=cluster_id)
            print(".", end="", flush=True)
            time.sleep(15)
        except ClientError as e:
            if "CacheClusterNotFound" in e.response["Error"]["Code"]:
                print(" done.")
                state.update(redis_cluster_id=None, redis_endpoint=None, redis_url=None)
                return
            raise
    raise RuntimeError(f"ElastiCache cluster {cluster_id} did not delete in time")


def delete_redis_sg(sg_id):
    ec2 = aws.ec2_client()
    try:
        ec2.delete_security_group(GroupId=sg_id)
        print(f"  deleted Redis SG: {sg_id}")
        state.update(redis_sg_id=None)
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "InvalidGroup.NotFound":
            print(f"  Redis SG {sg_id}: already gone")
        elif code == "DependencyViolation":
            print(f"  Redis SG {sg_id}: still in use — skipping (will be cleaned up with VPC)")
        else:
            raise


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    current = state.read()
    total   = 5

    print("devops2 full stack teardown\n")
    print("Resources to delete:")
    stack_name = current.get("cf_stack_name") or STACK_NAME_BASE
    print(f"  CloudFront:  {current.get('cloudfront_id', 'not in state')}")
    print(f"  CF stack:    {stack_name}")
    print(f"  Master:      {current.get('master_instance_id', 'not in state')}")
    print(f"  ElastiCache: {current.get('redis_cluster_id', CLUSTER_ID)}")
    print(f"  VPC:         {current.get('vpc_id', 'not in state')}")
    print(f"\nNOT deleted: DynamoDB table")

    _banner(1, total, "CloudFront distribution")
    delete_cloudfront_distribution()

    _banner(2, total, "CloudFormation stack (ALB + ASG)")
    cf = aws.cf_client()
    current_cf = cf_status(cf)
    if current_cf is None:
        print(f"  CF stack {stack_name}: already deleted — skipping")
    elif current_cf == "DELETE_IN_PROGRESS":
        print(f"  CF stack {stack_name}: deletion already in progress")
        print(f"  Not waiting — run teardown_cloudformation.py to check completion.")
    else:
        print(f"  firing CF stack deletion: {stack_name}  (current: {current_cf})")
        cf.delete_stack(StackName=stack_name)
        print(f"  deletion started — not waiting, CF works asynchronously")
        print(f"  run teardown_cloudformation.py to wait for completion if needed")

    _banner(3, total, "Master EC2 instance")
    instance_id = current.get("master_instance_id")
    master_sg   = current.get("master_sg_id")
    if instance_id:
        terminate_instance(instance_id)
        state.update(master_instance_id=None, master_public_ip=None)
    else:
        print("  no master instance in state")
    if master_sg:
        delete_security_group(master_sg)
        state.update(master_sg_id=None)
    else:
        print("  no master SG in state")

    _banner(4, total, "ElastiCache Redis")
    cluster_id = current.get("redis_cluster_id") or CLUSTER_ID
    redis_sg   = current.get("redis_sg_id")
    delete_elasticache_cluster(cluster_id)
    if redis_sg:
        delete_redis_sg(redis_sg)

    _banner(5, total, "VPC networking")
    ec2      = aws.ec2_client()
    nat_id   = current.get("nat_gateway_id")
    alloc_id = current.get("nat_eip_alloc_id")
    igw_id   = current.get("igw_id")
    vpc_id   = current.get("vpc_id")
    pub_subs = current.get("public_subnet_ids") or []
    priv_subs = current.get("private_subnet_ids") or []

    if not vpc_id:
        print("  no VPC in state — skipping")
    else:
        if nat_id:
            print("Deleting NAT Gateway (stops hourly charge)...")
            delete_nat_gateway(ec2, nat_id)
            state.update(nat_gateway_id=None)
        if alloc_id:
            print("Releasing Elastic IP...")
            release_eip(ec2, alloc_id)
            state.update(nat_eip_alloc_id=None)
        print("Deleting route tables...")
        delete_route_tables(ec2, vpc_id)
        state.update(public_rt_id=None, private_rt_id=None)
        print("Deleting subnets...")
        delete_subnets(ec2, pub_subs + priv_subs)
        state.update(public_subnet_ids=None, private_subnet_ids=None)
        if igw_id:
            print("Deleting Internet Gateway...")
            delete_igw(ec2, vpc_id, igw_id)
            state.update(igw_id=None)
        print("Deleting VPC...")
        delete_vpc(ec2, vpc_id)
        state.update(vpc_id=None)

    print(f"\n{'─' * 60}")
    print("  Teardown complete.")
    print(f"{'─' * 60}")
    print("\nDynamoDB table and IAM certificate were left intact.")
    print("Run tearup.py to rebuild the full stack.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nAborted.")
        sys.exit(1)
    except ClientError as e:
        err = e.response["Error"]
        print(f"\nAWS error: {err.get('Code')} — {err.get('Message')}")
        sys.exit(1)
    except RuntimeError as e:
        print(f"\nError: {e}")
        sys.exit(1)
