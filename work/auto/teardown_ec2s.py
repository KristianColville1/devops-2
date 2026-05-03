"""
Terminate EC2 resources recorded in the state file.
Removes each resource from state only on success so a failed run is safe to retry.
"""

import sys
import time
from botocore.exceptions import ClientError

from utils.dotenv import load_dotenv
from utils import aws, state

load_dotenv()

# ---------------------------------------------------------------------------


def terminate_instance(instance_id):
    """Terminate the instance and block until it reaches terminated state."""
    client = aws.ec2_client()
    try:
        client.terminate_instances(InstanceIds=[instance_id])
        print(f"  terminating: {instance_id}")
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "InvalidInstanceID.NotFound":
            print(f"  instance {instance_id} not found — already gone")
            return
        raise

    # Wait for terminated — SG deletion will fail if the instance still holds a reference
    print("  waiting for terminated state", end="", flush=True)
    resource = aws.ec2_resource()
    instance = resource.Instance(instance_id)
    for _ in range(40):
        instance.reload()
        s = instance.state["Name"]
        if s == "terminated":
            print(" done.")
            return
        if s not in ("shutting-down", "stopping"):
            raise RuntimeError(f"Instance {instance_id} in unexpected state: {s}")
        print(".", end="", flush=True)
        time.sleep(5)
    raise RuntimeError(f"Instance {instance_id} did not reach terminated state in time")


def delete_security_group(sg_id):
    """Delete the security group. Safe to call if already deleted."""
    client = aws.ec2_client()
    try:
        client.delete_security_group(GroupId=sg_id)
        print(f"  deleted security group: {sg_id}")
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "InvalidGroup.NotFound":
            print(f"  security group {sg_id} not found — already gone")
        elif code == "DependencyViolation":
            # Instance may still be shutting down despite the wait — give it a moment
            print(f"  SG still in use, retrying in 10s...")
            time.sleep(10)
            client.delete_security_group(GroupId=sg_id)
            print(f"  deleted security group: {sg_id}")
        else:
            raise


def main():
    """Tear down EC2 instance and security group recorded in the state file."""
    current = state.read()

    instance_id = current.get("master_instance_id")
    sg_id = current.get("master_sg_id")

    if not instance_id and not sg_id:
        print("Nothing in state file to tear down.")
        return

    print(f"Region: {aws.REGION}\n")

    if instance_id:
        terminate_instance(instance_id)
        state.update(
            master_instance_id=None,
            master_public_ip=None,
        )
    else:
        print("  no instance in state, skipping")

    if sg_id:
        delete_security_group(sg_id)
        state.update(master_sg_id=None)
    else:
        print("  no security group in state, skipping")

    print("\nTeardown complete. Re-run 01_create_master.py to provision a fresh instance.")


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    try:
        main()
    except ClientError as e:
        err = e.response["Error"]
        print(f"AWS error: {err.get('Code')} — {err.get('Message')}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
