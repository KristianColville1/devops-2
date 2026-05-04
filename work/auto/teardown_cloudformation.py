"""
Delete the devops2 CloudFormation stack and wait for completion.
Safe to re-run — if the stack is already gone it exits cleanly.

If deletion is stuck, check CloudFormation → devops2-stack → Events tab
in the AWS console. The most common cause is a security group still referenced
by a resource outside the stack (e.g. the Redis SG has an inbound rule that
references the CF app SG — remove that rule first, then re-run this script).
"""

import sys
import time
from botocore.exceptions import ClientError
from utils import aws, state
from utils.dotenv import load_dotenv

load_dotenv()

STACK_NAME_BASE   = "devops2-stack"
_POLL_DELAY  = 15
_POLL_RETRIES = 60  # 15 minutes


def cf_status(cf):
    stack_name = state.get("cf_stack_name") or STACK_NAME_BASE
    try:
        return cf.describe_stacks(StackName=stack_name)["Stacks"][0]["StackStatus"]
    except ClientError as e:
        if "does not exist" in str(e):
            return None
        raise


def delete_cf_stack(cf):
    stack_name = state.get("cf_stack_name") or STACK_NAME_BASE
    status = cf_status(cf)

    if status is None:
        print(f"  stack {stack_name}: not found — already deleted")
        return True

    if status == "DELETE_IN_PROGRESS":
        print(f"  stack {stack_name}: deletion already in progress, continuing to wait...")
    elif "FAILED" in status or "ROLLBACK" in status:
        print(f"  stack {stack_name}: status is {status}, attempting delete anyway...")
        cf.delete_stack(StackName=stack_name)
    else:
        print(f"  deleting stack: {stack_name}  (current: {status})")
        cf.delete_stack(StackName=stack_name)

    print(f"  waiting for deletion", end="", flush=True)
    for i in range(_POLL_RETRIES):
        status = cf_status(cf)
        if status is None:
            print(" done.")
            state.update(cf_stack_name=None, alb_dns=None, asg_name=None, app_sg_id=None)
            return True
        if "FAILED" in status:
            print(f"\n  status: {status}")
            print(f"\n  Stack deletion failed. Check the Events tab in the CF console.")
            print(f"  Common fix: remove the inbound rule in the Redis SG that references")
            print(f"  the CF app security group, then re-run this script.")
            return False
        # Print status every 2 minutes so the user knows it's still alive
        if i > 0 and i % 8 == 0:
            elapsed = i * _POLL_DELAY
            print(f"\n  still waiting ({elapsed}s elapsed, status: {status})", end="", flush=True)
        else:
            print(".", end="", flush=True)
        time.sleep(_POLL_DELAY)

    print(f"\n  Timed out after {_POLL_RETRIES * _POLL_DELAY}s — stack may still be deleting.")
    print(f"  Re-run this script to check and wait again.")
    return False


def main():
    cf = aws.cf_client()
    print(f"Region: {aws.REGION}\n")
    success = delete_cf_stack(cf)
    if not success:
        sys.exit(1)
    print("\nDone.")


if __name__ == "__main__":
    try:
        main()
    except ClientError as e:
        print(f"\nAWS error: {e.response['Error']['Code']} — {e.response['Error']['Message']}")
        sys.exit(1)
    except RuntimeError as e:
        print(f"\nError: {e}")
        sys.exit(1)
