"""
Provision a master EC2 instance, ship the backend, build it, and wire up systemd.
Run this once to get an instance ready to bake an AMI from.
"""

import argparse
import sys
from botocore.exceptions import ClientError

from utils.dotenv import load_dotenv
from utils import state, ssh
from src.modules.master_ami import config
from src.modules.master_ami.ec2 import get_default_vpc, create_key_pair, create_security_group, launch_instance
from src.modules.master_ami.setup import install_node, copy_backend, build_backend, write_env, setup_service
from src.modules.master_ami.ami import bake_ami

load_dotenv()

# ---------------------------------------------------------------------------


def main(bake_after=False):
    """Bring up the master instance and get the backend running end to end."""
    print(f"Region: {config.REGION}  |  AMI: {config.BASE_AMI}  |  Type: {config.INSTANCE_TYPE}\n")

    vpc_id = get_default_vpc()
    print(f"VPC: {vpc_id}")

    key_name = create_key_pair()
    sg_id = create_security_group(vpc_id)

    print("Launching master instance...")
    instance = launch_instance(key_name, sg_id)
    print(f"  instance: {instance.id} — waiting for running state...")
    instance.wait_until_running()
    instance.reload()

    public_ip = instance.public_ip_address
    if not public_ip:
        raise RuntimeError(
            f"Instance {instance.id} has no public IP — "
            "check that auto-assign public IPv4 is enabled on the default subnet"
        )

    state.update(
        master_instance_id=instance.id,
        master_sg_id=sg_id,
        master_public_ip=public_ip,
        key_name=key_name,
        pem_file=config.PEM_FILE,
    )
    print(f"  public IP: {public_ip}")

    ssh.wait_ready(public_ip, config.PEM_FILE)
    install_node(public_ip)
    copy_backend(public_ip)
    build_backend(public_ip)
    write_env(public_ip)
    setup_service(public_ip)

    ami_id = bake_ami(instance.id) if bake_after else None

    print("\nDone.")
    print(f"  health: http://{public_ip}:{config.APP_PORT}/health")
    print(f"  ssh:    ssh -i {config.PEM_FILE} ec2-user@{public_ip}")
    if ami_id:
        print(f"  ami:    {ami_id}")
    else:
        print("  next:   python 01_create_master.py --bake  (when you're happy with the instance)")


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Provision devops2 master EC2 and optionally bake an AMI")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--ami", action="store_true", help="bake an AMI immediately after setup completes")
    group.add_argument("--bake", action="store_true", help="bake an AMI from the instance saved in state, skip provisioning")
    args = parser.parse_args()

    try:
        if args.bake:
            instance_id = state.get("master_instance_id")
            if not instance_id:
                print("No master_instance_id in state file — run without --bake first to provision the master")
                sys.exit(1)
            print(f"Baking from state: {instance_id}")
            bake_ami(instance_id)
        else:
            main(bake_after=args.ami)
    except ClientError as e:
        err = e.response["Error"]
        print(f"AWS error: {err.get('Code')} — {err.get('Message')}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
