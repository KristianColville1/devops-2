"""
Push the latest metrics.sh and fix the cron entry on all running ASG instances.
Run once — no rebake needed. Targets every instance in devops2-asg.
"""

import os
import subprocess
import sys
from botocore.exceptions import ClientError
from utils import aws, state
from utils.dotenv import load_dotenv
from utils import ssh

load_dotenv()

CRON_LINE = "* * * * * /home/ec2-user/metrics.sh >> /home/ec2-user/devops2-metrics.log 2>&1"
_HERE = os.path.dirname(os.path.abspath(__file__))
METRICS_SCRIPT = os.path.join(_HERE, "scripts", "metrics.sh")


def get_asg_instances():
    """Return public IPs of all InService instances in the ASG."""
    asg_name = state.get("asg_name") or "devops2-asg"
    asg = aws.asg_client()
    ec2 = aws.ec2_client()

    resp = asg.describe_auto_scaling_groups(AutoScalingGroupNames=[asg_name])
    groups = resp["AutoScalingGroups"]
    if not groups:
        raise RuntimeError(f"ASG {asg_name} not found")

    instance_ids = [
        i["InstanceId"]
        for i in groups[0]["Instances"]
        if i["LifecycleState"] == "InService"
    ]
    if not instance_ids:
        raise RuntimeError("No InService instances found in ASG")

    resp = ec2.describe_instances(InstanceIds=instance_ids)
    ips = []
    for r in resp["Reservations"]:
        for inst in r["Instances"]:
            ip = inst.get("PublicIpAddress")
            if ip:
                ips.append((inst["InstanceId"], ip))
    return ips


def push_script(instance_id, ip, pem):
    subprocess.run(
        [
            "scp", "-i", pem,
            "-o", "StrictHostKeyChecking=no",
            "-o", "BatchMode=yes",
            METRICS_SCRIPT,
            f"ec2-user@{ip}:~/metrics.sh",
        ],
        check=True,
    )
    ssh.run(ip, pem, "chmod +x ~/metrics.sh")
    print(f"    metrics.sh pushed")


def fix_cron(instance_id, ip, pem):
    print(f"  {instance_id} ({ip})...")
    push_script(instance_id, ip, pem)
    # Remove any old metrics.sh cron line and install the corrected one
    ssh.run(ip, pem, (
        f"(crontab -l 2>/dev/null | grep -v 'metrics.sh'; "
        f"echo '{CRON_LINE}') | crontab -"
    ))
    print(f"    crontab updated")


def main():
    pem = state.get("pem_file") or "devops2-key.pem"
    print("Finding InService ASG instances...")
    instances = get_asg_instances()
    print(f"  found {len(instances)} instance(s)\n")

    for instance_id, ip in instances:
        fix_cron(instance_id, ip, pem)

    print("\nDone. Metrics will appear in CloudWatch within 2 minutes.")
    print("Verify on any instance with: cat ~/devops2-metrics.log")


if __name__ == "__main__":
    try:
        main()
    except ClientError as e:
        print(f"\nAWS error: {e.response['Error']['Code']} — {e.response['Error']['Message']}")
        sys.exit(1)
    except RuntimeError as e:
        print(f"\nError: {e}")
        sys.exit(1)
