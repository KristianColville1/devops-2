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
    """Return (instance_id, private_ip) for all InService ASG instances."""
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
            # Instances are in private subnets — use private IP, jump via master
            ip = inst.get("PrivateIpAddress")
            if ip:
                ips.append((inst["InstanceId"], ip))
    return ips


def push_script(ip, pem, jump_ip=None):
    scp_args = [
        "scp", "-i", pem,
        "-o", "StrictHostKeyChecking=no",
        "-o", "BatchMode=yes",
    ]
    if jump_ip:
        scp_args += ["-o", f"ProxyJump=ec2-user@{jump_ip}"]
    scp_args += [METRICS_SCRIPT, f"ec2-user@{ip}:~/metrics.sh"]
    subprocess.run(scp_args, check=True)
    ssh.run(ip, pem, "chmod +x ~/metrics.sh", jump_ip=jump_ip)
    print(f"    metrics.sh pushed")


def fix_cron(instance_id, ip, pem, jump_ip=None):
    label = f"{instance_id} ({ip})" + (f" via {jump_ip}" if jump_ip else "")
    print(f"  {label}...")
    push_script(ip, pem, jump_ip=jump_ip)
    ssh.run(ip, pem, (
        f"(crontab -l 2>/dev/null | grep -v 'metrics.sh'; "
        f"echo '{CRON_LINE}') | crontab -"
    ), jump_ip=jump_ip)
    print(f"    crontab updated")


def main():
    pem = state.get("pem_file") or "devops2-key.pem"
    # ASG instances are in private subnets — SSH via master as jump host
    jump_ip = state.get("master_public_ip")
    if not jump_ip:
        print("Warning: master_public_ip not in state — will attempt direct SSH (may fail for private instances)")

    print("Finding InService ASG instances...")
    instances = get_asg_instances()
    print(f"  found {len(instances)} instance(s)")
    if jump_ip:
        print(f"  using master {jump_ip} as SSH jump host\n")

    for instance_id, ip in instances:
        fix_cron(instance_id, ip, pem, jump_ip=jump_ip)

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
