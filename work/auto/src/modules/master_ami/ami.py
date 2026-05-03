import time
from datetime import datetime, timezone

from botocore.exceptions import ClientError

from utils import aws, state
from . import config


def bake_ami(instance_id):
    """Create an AMI from the given instance and poll until it's available."""
    client = aws.ec2_client()
    name = f"{config.AMI_NAME_PREFIX}-{datetime.now(timezone.utc).strftime('%Y-%m-%d-%H%M%S')}"

    print(f"Baking AMI from {instance_id}...")
    try:
        r = client.create_image(
            InstanceId=instance_id,
            Name=name,
            Description=f"devops2 master — {name}",
            # NoReboot means we don't stop the instance first — fine for a master bake
            NoReboot=True,
        )
    except ClientError as e:
        raise RuntimeError(f"Failed to start AMI creation: {e}") from None

    ami_id = r["ImageId"]
    print(f"  AMI ID: {ami_id}  ({name})")
    print("  waiting for AMI to become available", end="", flush=True)

    for _ in range(40):
        images = client.describe_images(ImageIds=[ami_id])["Images"]
        if not images:
            raise RuntimeError(f"AMI {ami_id} disappeared — may have been deleted during creation")
        status = images[0]["State"]
        if status == "available":
            print(" done.")
            state.update(ami_id=ami_id, ami_name=name)
            print("  saved to state file")
            return ami_id
        if status == "failed":
            raise RuntimeError(f"AMI {ami_id} entered a failed state — check the EC2 console")
        print(".", end="", flush=True)
        time.sleep(30)

    raise RuntimeError(f"AMI {ami_id} timed out waiting to become available — check the EC2 console")
