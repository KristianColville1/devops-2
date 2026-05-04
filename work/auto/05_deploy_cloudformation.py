"""
Deploy the CloudFormation stack (ALB + ASG + step scaling).
Reads all values from state: ami_id, redis_url, vpc/subnet IDs.

Run after:
  00_create_vpc.py             (vpc + subnets in state)
  01_create_master.py --bake   (ami_id in state)
  03_create_elasticache.py     (redis_url in state)

Flags:
  --refresh   Trigger an instance refresh on the ASG instead of a stack deploy.
              Use this after rebaking the AMI to roll new instances in one at a time.
"""

import argparse
import os
import sys
import time

from botocore.exceptions import ClientError

from utils import aws, state
from utils.dotenv import load_dotenv
from src.modules.master_ami.config import (
    DASHBOARD_TOKEN,
    KEY_NAME,
    INSTANCE_TYPE,
)

load_dotenv()

STACK_NAME_BASE = "devops2-stack"
TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "infra", "stack.yaml")

_POLL_DELAY = 15
_POLL_RETRIES = 60  # up to 15 minutes


# ---------------------------------------------------------------------------
# CloudFormation helpers
# ---------------------------------------------------------------------------

def _read_template():
    with open(TEMPLATE_PATH) as f:
        return f.read()


def _stack_status(cf):
    """Return current stack status string, or None if the stack doesn't exist."""
    stack_name = state.get("cf_stack_name") or STACK_NAME_BASE
    try:
        resp = cf.describe_stacks(StackName=stack_name)
        return resp["Stacks"][0]["StackStatus"]
    except ClientError as e:
        if "does not exist" in str(e):
            return None
        raise


def _wait_complete(cf, action):
    """Poll until the stack reaches a stable state. Raises on failure."""
    print(f"  waiting for stack {action}", end="", flush=True)
    for _ in range(_POLL_RETRIES):
        status = _stack_status(cf)
        if status is None:
            raise RuntimeError("Stack disappeared while waiting")
        if status.endswith("_COMPLETE") and "ROLLBACK" not in status:
            print(" done.")
            return
        if "FAILED" in status or "ROLLBACK" in status:
            raise RuntimeError(f"Stack {action} failed: {status}")
        print(".", end="", flush=True)
        time.sleep(_POLL_DELAY)
    raise RuntimeError(f"Stack {action} timed out (status: {_stack_status(cf)})")


def _stack_outputs(cf):
    """Return a dict of OutputKey → OutputValue for the deployed stack."""
    stack_name = state.get("cf_stack_name") or STACK_NAME_BASE
    resp = cf.describe_stacks(StackName=stack_name)
    return {o["OutputKey"]: o["OutputValue"] for o in resp["Stacks"][0].get("Outputs", [])}


# ---------------------------------------------------------------------------
# Redis SG wiring
# ---------------------------------------------------------------------------

def _authorize_redis_sg(app_sg_id):
    """Allow the ASG AppSecurityGroup to reach ElastiCache on port 6379."""
    redis_sg_id = state.get("redis_sg_id")
    if not redis_sg_id:
        print("  Warning: redis_sg_id not in state — skipping Redis SG update")
        return

    try:
        aws.ec2_client().authorize_security_group_ingress(
            GroupId=redis_sg_id,
            IpPermissions=[{
                "IpProtocol": "tcp",
                "FromPort": 6379,
                "ToPort": 6379,
                "UserIdGroupPairs": [{"GroupId": app_sg_id, "Description": "ASG app instances"}],
            }],
        )
        print(f"  Redis SG {redis_sg_id}: authorised {app_sg_id} on port 6379")
    except ClientError as e:
        if e.response["Error"]["Code"] == "InvalidPermission.Duplicate":
            print(f"  Redis SG {redis_sg_id}: {app_sg_id} already authorised")
        else:
            raise


# ---------------------------------------------------------------------------
# Instance refresh
# ---------------------------------------------------------------------------

def instance_refresh():
    """Replace running ASG instances with the latest launch template version."""
    asg_name = state.get("asg_name") or "devops2-asg"
    print(f"Starting instance refresh on {asg_name}...")
    resp = aws.asg_client().start_instance_refresh(
        AutoScalingGroupName=asg_name,
        Strategy="Rolling",
        Preferences={
            # Keep at least one instance healthy during the rollout
            "MinHealthyPercentage": 50,
            "InstanceWarmup": 120,
        },
    )
    refresh_id = resp["InstanceRefreshId"]
    print(f"  refresh ID: {refresh_id}")
    print(f"  instances will be replaced one at a time — takes a few minutes")
    print(f"  watch progress in the EC2 console under Auto Scaling in devops2-asg")


# ---------------------------------------------------------------------------
# Main deploy
# ---------------------------------------------------------------------------

def deploy():
    print(f"Region: {aws.REGION}\n")

    ami_id = state.get("ami_id")
    redis_url = state.get("redis_url")

    if not ami_id:
        print("Error: ami_id not in state — run: python 01_create_master.py --bake")
        sys.exit(1)
    if not redis_url:
        print("Warning: redis_url not in state — REDIS_URL will be empty in instances")
        redis_url = ""

    vpc_id          = state.get("vpc_id")
    pub_subnet_ids  = state.get("public_subnet_ids") or []
    priv_subnet_ids = state.get("private_subnet_ids") or []
    cert_arn        = state.get("certificate_arn")

    if not vpc_id or len(pub_subnet_ids) < 2 or len(priv_subnet_ids) < 2:
        print("Error: VPC/subnet IDs missing from state — run 00_create_vpc.py first")
        sys.exit(1)
    if not cert_arn:
        print("Error: certificate_arn missing from state — run 00_create_certificate.py first")
        sys.exit(1)

    # Use a stable, unique stack name per VPC to avoid collisions with old stacks
    # (e.g. stuck in DELETE_FAILED from a previous tearup/teardown).
    stack_name = state.get("cf_stack_name") or f"{STACK_NAME_BASE}-{vpc_id[-8:]}"
    state.update(cf_stack_name=stack_name)

    print(f"  VPC:             {vpc_id}")
    print(f"  Public subnets:  {', '.join(pub_subnet_ids)}")
    print(f"  Private subnets: {', '.join(priv_subnet_ids)}")
    print(f"  Certificate:     {cert_arn}")

    dynamo_table    = state.get("dynamo_table") or "devops-nodes"
    dashboard_token = os.environ.get("DASHBOARD_TOKEN", DASHBOARD_TOKEN)

    params = [
        {"ParameterKey": "AmiId",            "ParameterValue": ami_id},
        {"ParameterKey": "KeyName",           "ParameterValue": KEY_NAME},
        {"ParameterKey": "InstanceType",      "ParameterValue": INSTANCE_TYPE},
        {"ParameterKey": "VpcId",            "ParameterValue": vpc_id},
        {"ParameterKey": "PublicSubnetIds",   "ParameterValue": ",".join(pub_subnet_ids)},
        {"ParameterKey": "PrivateSubnetIds",  "ParameterValue": ",".join(priv_subnet_ids)},
        {"ParameterKey": "CertificateArn",    "ParameterValue": cert_arn},
        {"ParameterKey": "RedisUrl",          "ParameterValue": redis_url},
        {"ParameterKey": "DynamoTable",       "ParameterValue": dynamo_table},
        {"ParameterKey": "DashboardToken",    "ParameterValue": dashboard_token},
        {"ParameterKey": "MinInstances",      "ParameterValue": "2"},
        {"ParameterKey": "DesiredInstances",  "ParameterValue": "2"},
        {"ParameterKey": "MaxInstances",      "ParameterValue": "10"},
    ]

    template_body = _read_template()
    cf = aws.cf_client()
    current = None
    try:
        resp = cf.describe_stacks(StackName=stack_name)
        current = resp["Stacks"][0]["StackStatus"]
    except ClientError as e:
        if "does not exist" in str(e):
            current = None
        else:
            raise

    if current is None:
        print(f"\nCreating stack: {stack_name}...")
        cf.create_stack(
            StackName=stack_name,
            TemplateBody=template_body,
            Parameters=params,
            Capabilities=["CAPABILITY_IAM"],
            OnFailure="ROLLBACK",
        )
        _wait_complete(cf, "create")

    elif current.endswith("_COMPLETE"):
        print(f"\nUpdating stack: {stack_name} (current: {current})...")
        try:
            cf.update_stack(
                StackName=stack_name,
                TemplateBody=template_body,
                Parameters=params,
                Capabilities=["CAPABILITY_IAM"],
            )
            _wait_complete(cf, "update")
        except ClientError as e:
            if "No updates are to be performed" in str(e):
                print("  no changes — stack is already up to date")
            else:
                raise

    else:
        print(f"Error: stack is in an unstable state: {current}")
        print("       Wait for it to stabilise or delete it from the console and retry.")
        sys.exit(1)

    outputs = _stack_outputs(cf)
    alb_dns = outputs.get("LoadBalancerDNS", "")
    asg_name = outputs.get("AutoScalingGroupName", "")
    app_sg_id = outputs.get("AppSecurityGroupId", "")

    state.update(cf_stack_name=stack_name, alb_dns=alb_dns, asg_name=asg_name, app_sg_id=app_sg_id)

    # The Redis SG was created before CloudFormation and only allows the master SG.
    # ASG instances use AppSecurityGroup, so we need to add it to the Redis SG.
    if app_sg_id:
        _authorize_redis_sg(app_sg_id)

    print(f"\nDone.")
    print(f"  ALB DNS:  {alb_dns}")
    print(f"  ASG:      {asg_name}")
    print(f"\nNext: python 04_deploy_frontend.py")
    print(f"      Frontend will use https://{alb_dns}")
    print(f"      Accept the self-signed cert warning in the browser once.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--refresh", action="store_true", help="Trigger ASG instance refresh instead of stack deploy")
    args = parser.parse_args()

    try:
        if args.refresh:
            instance_refresh()
        else:
            deploy()
    except ClientError as e:
        print(f"\nAWS error: {e.response['Error']['Code']} — {e.response['Error']['Message']}")
        sys.exit(1)
    except RuntimeError as e:
        print(f"\nError: {e}")
        sys.exit(1)
