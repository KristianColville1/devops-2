"""
Provision a master EC2 instance, ship the backend, build it, and wire up systemd.
Run this once to get an instance ready to bake an AMI from.
"""

import base64
import os
import subprocess
import sys
import time
from botocore.exceptions import ClientError

from utils.dotenv import load_dotenv
from utils import aws, state

load_dotenv()

# ---------------------------------------------------------------------------

KEY_NAME = os.environ.get("KEY_NAME", "devops2-key")
PEM_FILE = os.environ.get("PEM_FILE", f"{KEY_NAME}.pem")
BASE_AMI = os.environ.get("BASE_AMI_ID", "ami-02dfbd4ff395f2a1b")
INSTANCE_TYPE = os.environ.get("INSTANCE_TYPE", "t2.micro")
DASHBOARD_TOKEN = os.environ.get("DASHBOARD_TOKEN", "dev-token-change-me")

SG_NAME = "devops2-master-sg"
APP_DIR = "/home/ec2-user/app"
APP_PORT = 3000

# work/node-backend relative to this file (work/auto/)
BACKEND_PATH = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "node-backend")
)

# ---------------------------------------------------------------------------
# EC2 provisioning


def get_default_vpc():
    """Return the default VPC ID for the configured region."""
    client = aws.ec2_client()
    vpcs = client.describe_vpcs(Filters=[{"Name": "isDefault", "Values": ["true"]}])
    if not vpcs["Vpcs"]:
        raise RuntimeError(f"No default VPC found in {aws.REGION}")
    return vpcs["Vpcs"][0]["VpcId"]


def create_key_pair():
    """Create a new key pair in AWS, or import an existing local one."""
    client = aws.ec2_client()
    pub_path = PEM_FILE + ".pub"

    if os.path.isfile(PEM_FILE) and os.path.isfile(pub_path):
        with open(pub_path, "rb") as f:
            pub = f.read()
        try:
            client.import_key_pair(KeyName=KEY_NAME, PublicKeyMaterial=pub)
        except ClientError as e:
            if e.response["Error"]["Code"] != "InvalidKeyPair.Duplicate":
                raise
        print(f"  key pair: {KEY_NAME} (imported from local)")
        return KEY_NAME

    try:
        resp = client.create_key_pair(KeyName=KEY_NAME)
        with open(PEM_FILE, "w") as f:
            f.write(resp["KeyMaterial"])
        os.chmod(PEM_FILE, 0o600)
        print(f"  key pair: {KEY_NAME} -> {PEM_FILE}")
    except ClientError as e:
        if e.response["Error"]["Code"] != "InvalidKeyPair.Duplicate":
            raise
        # Key exists in AWS but we have no local .pem — SSH will fail later without it
        if not os.path.isfile(PEM_FILE):
            raise RuntimeError(
                f"Key pair '{KEY_NAME}' already exists in AWS but {PEM_FILE} not found locally. "
                "Restore the .pem or delete the key from AWS and re-run."
            ) from None
        print(f"  key pair: {KEY_NAME} (already in AWS)")

    return KEY_NAME


def create_security_group(vpc_id):
    """Create an SG with SSH and the app port open. Skips creation if it already exists."""
    client = aws.ec2_client()

    existing = client.describe_security_groups(
        Filters=[
            {"Name": "group-name", "Values": [SG_NAME]},
            {"Name": "vpc-id", "Values": [vpc_id]},
        ]
    )
    if existing["SecurityGroups"]:
        sg_id = existing["SecurityGroups"][0]["GroupId"]
        print(f"  security group: {sg_id} (already exists)")
        return sg_id

    sg = client.create_security_group(
        GroupName=SG_NAME,
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
                "FromPort": APP_PORT, "ToPort": APP_PORT, "IpProtocol": "tcp",
                "IpRanges": [{"CidrIp": "0.0.0.0/0", "Description": "Node backend"}],
            },
        ],
    )
    print(f"  security group: {sg_id}")
    return sg_id


def launch_instance(key_name, sg_id):
    """Launch a tagged master instance into the default VPC."""
    resource = aws.ec2_resource()
    instances = resource.create_instances(
        ImageId=BASE_AMI,
        MinCount=1,
        MaxCount=1,
        InstanceType=INSTANCE_TYPE,
        KeyName=key_name,
        SecurityGroupIds=[sg_id],
        TagSpecifications=[{
            "ResourceType": "instance",
            "Tags": [{"Key": "Name", "Value": "devops2-master"}],
        }],
    )
    return instances[0]


# ---------------------------------------------------------------------------
# Remote setup


def _ssh(ip, cmd, check=True):
    """Run a shell command on the instance, streaming output to the terminal."""
    result = subprocess.run(
        [
            "ssh", "-i", PEM_FILE,
            "-o", "StrictHostKeyChecking=no",
            # BatchMode=yes stops SSH hanging on unexpected prompts
            "-o", "BatchMode=yes",
            "-o", "ConnectTimeout=10",
            f"ec2-user@{ip}",
            cmd,
        ],
        check=False,
    )
    if check and result.returncode != 0:
        raise RuntimeError(f"Remote command failed (exit {result.returncode}): {cmd[:100]}")
    return result.returncode == 0


def wait_for_ssh(ip):
    """Poll SSH until the instance is ready to accept connections."""
    print("  waiting for SSH", end="", flush=True)
    for _ in range(24):
        result = subprocess.run(
            [
                "ssh", "-i", PEM_FILE,
                "-o", "StrictHostKeyChecking=no",
                "-o", "BatchMode=yes",
                "-o", "ConnectTimeout=8",
                f"ec2-user@{ip}", "echo ok",
            ],
            capture_output=True,
        )
        if result.returncode == 0:
            print(" ready.")
            return
        print(".", end="", flush=True)
        time.sleep(15)
    raise RuntimeError("SSH never became available — check the instance console and SG rules")


def install_node(ip):
    """Install Node.js 20 via NodeSource. Binary lands at /usr/bin/node."""
    print("1/5 Installing Node.js 20...")
    _ssh(ip, "curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && sudo yum install -y nodejs")
    # confirm the binary is where systemd will look for it
    _ssh(ip, "node --version && npm --version")


def copy_backend(ip):
    """Rsync the backend source to ~/app on the instance, skipping build artifacts."""
    print("2/5 Copying backend...")
    if not os.path.isdir(BACKEND_PATH):
        raise RuntimeError(f"Backend not found at {BACKEND_PATH}")
    if not os.path.isfile(PEM_FILE):
        raise RuntimeError(f"{PEM_FILE} not found — rsync won't be able to authenticate")
    try:
        subprocess.run(
            [
                "rsync", "-az", "--progress",
                "--exclude=node_modules/",
                "--exclude=dist/",
                "--exclude=.env",
                "-e", f"ssh -i {PEM_FILE} -o StrictHostKeyChecking=no -o BatchMode=yes",
                f"{BACKEND_PATH}/",
                f"ec2-user@{ip}:~/app/",
            ],
            check=True,
        )
    except subprocess.CalledProcessError as e:
        raise RuntimeError(
            f"rsync failed (exit {e.returncode}) — confirm rsync is installed and SSH is reachable"
        ) from None


def build_backend(ip):
    """Install deps, compile TypeScript, then strip devDeps to keep the AMI lean."""
    print("3/5 Building backend...")
    _ssh(ip, "cd ~/app && npm install")
    _ssh(ip, "cd ~/app && npm run build")
    # devDeps (TypeScript, tsx, etc.) not needed at runtime
    _ssh(ip, "cd ~/app && npm prune --production")


def write_env(ip):
    """Write base env vars to ~/app/.env. Instance-specific values come from the launch template."""
    print("4/5 Writing .env...")
    content = "\n".join([
        f"PORT={APP_PORT}",
        "HOST=0.0.0.0",
        f"AWS_REGION={aws.REGION}",
        "DYNAMO_TABLE_NODES=devops-nodes",
        "FASTIFY_REQUEST_TIMEOUT_MS=300000",
        "FASTIFY_CONNECTION_TIMEOUT_MS=300000",
        # REDIS_URL and EC2_* are injected at boot by the launch template user data
        f"DASHBOARD_TOKEN={DASHBOARD_TOKEN}",
    ]) + "\n"
    # base64 avoids any quoting issues piping multi-line content over SSH
    encoded = base64.b64encode(content.encode()).decode()
    _ssh(ip, f"echo {encoded} | base64 -d > ~/app/.env")
    # make sure the file actually landed
    _ssh(ip, "test -s ~/app/.env || (echo '.env is empty or missing' && exit 1)")


def setup_service(ip):
    """Install a systemd unit so the backend starts automatically on boot."""
    print("5/5 Setting up systemd service...")
    unit = "\n".join([
        "[Unit]",
        "Description=DevOps2 node backend",
        "After=network.target",
        "",
        "[Service]",
        "Type=simple",
        "User=ec2-user",
        f"WorkingDirectory={APP_DIR}",
        # leading dash means systemd won't fail if .env is missing on first boot
        f"EnvironmentFile=-{APP_DIR}/.env",
        f"ExecStart=/usr/bin/node {APP_DIR}/dist/server.js",
        "Restart=on-failure",
        "RestartSec=5",
        "StandardOutput=journal",
        "StandardError=journal",
        "",
        "[Install]",
        "WantedBy=multi-user.target",
    ]) + "\n"
    encoded = base64.b64encode(unit.encode()).decode()
    _ssh(ip, f"echo {encoded} | base64 -d > /tmp/devops2.service")
    _ssh(ip, (
        "sudo mv /tmp/devops2.service /etc/systemd/system/devops2.service"
        " && sudo systemctl daemon-reload"
        " && sudo systemctl enable devops2"
        " && sudo systemctl start devops2"
    ))
    time.sleep(3)
    running = _ssh(ip, "sudo systemctl is-active --quiet devops2", check=False)
    if running:
        print("  service: active")
    else:
        print("  warning: service may not have started — check with: journalctl -u devops2 -n 30")


# ---------------------------------------------------------------------------
# Entry point


def main():
    """Bring up the master instance and get the backend running end to end."""
    print(f"Region: {aws.REGION}  |  AMI: {BASE_AMI}  |  Type: {INSTANCE_TYPE}\n")

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
        pem_file=PEM_FILE,
    )
    print(f"  public IP: {public_ip}")

    wait_for_ssh(public_ip)
    install_node(public_ip)
    copy_backend(public_ip)
    build_backend(public_ip)
    write_env(public_ip)
    setup_service(public_ip)

    print(f"\nDone.")
    print(f"  health: http://{public_ip}:{APP_PORT}/health")
    print(f"  ssh:    ssh -i {PEM_FILE} ec2-user@{public_ip}")
    print(f"  next:   python 02_create_ami.py")


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
