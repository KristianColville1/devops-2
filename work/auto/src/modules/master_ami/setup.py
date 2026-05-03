import base64
import os
import subprocess
import time

from utils import ssh, state
from src.modules.dynamo.table import TABLE_NAME as DYNAMO_TABLE_NAME
from . import config

# Resolved once at import time so rsync and SCP can find the file
_HERE = os.path.dirname(os.path.abspath(__file__))
_SCRIPTS_DIR = os.path.normpath(os.path.join(_HERE, "..", "..", "..", "scripts"))


def install_node(ip):
    """Install Node.js 22 via NodeSource. Binary lands at /usr/bin/node."""
    print("1/5 Installing Node.js 22...")
    ssh.run(ip, config.PEM_FILE, "curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash - && sudo yum install -y nodejs")
    # confirm the binary is where systemd will look for it
    ssh.run(ip, config.PEM_FILE, "node --version && npm --version")


def copy_backend(ip):
    """Rsync the backend source to ~/app on the instance, skipping build artifacts."""
    print("2/5 Copying backend...")
    if not os.path.isdir(config.BACKEND_PATH):
        raise RuntimeError(f"Backend not found at {config.BACKEND_PATH}")
    if not os.path.isfile(config.PEM_FILE):
        raise RuntimeError(f"{config.PEM_FILE} not found — rsync won't be able to authenticate")
    try:
        subprocess.run(
            [
                "rsync", "-az", "--progress",
                "--exclude=node_modules/",
                "--exclude=dist/",
                "--exclude=.env",
                "-e", f"ssh -i {config.PEM_FILE} -o StrictHostKeyChecking=no -o BatchMode=yes",
                f"{config.BACKEND_PATH}/",
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
    ssh.run(ip, config.PEM_FILE, "cd ~/app && npm install")
    ssh.run(ip, config.PEM_FILE, "cd ~/app && npm run build")
    # devDeps (TypeScript, tsx, etc.) not needed at runtime
    ssh.run(ip, config.PEM_FILE, "cd ~/app && npm prune --production")


def write_env(ip):
    """Write base env vars to ~/app/.env. Instance-specific values come from the launch template."""
    print("4/5 Writing .env...")
    # Pull table name from state if 02_create_dynamo ran first, fall back to the module constant
    dynamo_table = state.get("dynamo_table") or DYNAMO_TABLE_NAME
    content = "\n".join([
        f"PORT={config.APP_PORT}",
        "HOST=0.0.0.0",
        f"AWS_REGION={config.REGION}",
        f"DYNAMO_TABLE_NODES={dynamo_table}",
        "FASTIFY_REQUEST_TIMEOUT_MS=300000",
        "FASTIFY_CONNECTION_TIMEOUT_MS=300000",
        # REDIS_URL and EC2_* are injected at boot by the launch template user data
        f"DASHBOARD_TOKEN={config.DASHBOARD_TOKEN}",
    ]) + "\n"
    # base64 avoids any quoting issues piping multi-line content over SSH
    encoded = base64.b64encode(content.encode()).decode()
    ssh.run(ip, config.PEM_FILE, f"echo {encoded} | base64 -d > ~/app/.env")
    # make sure the file actually landed
    ssh.run(ip, config.PEM_FILE, "test -s ~/app/.env || (echo '.env is empty or missing' && exit 1)")


def setup_metrics_cron(ip):
    """Copy metrics.sh to the instance and register it as a per-minute cron job."""
    print("5/6 Setting up CloudWatch metrics cron...")
    local_script = os.path.join(_SCRIPTS_DIR, "metrics.sh")
    if not os.path.isfile(local_script):
        raise RuntimeError(f"metrics.sh not found at {local_script}")

    try:
        subprocess.run(
            [
                "scp", "-i", config.PEM_FILE,
                "-o", "StrictHostKeyChecking=no",
                "-o", "BatchMode=yes",
                local_script,
                f"ec2-user@{ip}:~/metrics.sh",
            ],
            check=True,
        )
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"scp of metrics.sh failed (exit {e.returncode})") from None

    ssh.run(ip, config.PEM_FILE, "chmod +x ~/metrics.sh")
    # cronie is not installed by default on Amazon Linux 2023
    ssh.run(ip, config.PEM_FILE, "sudo yum install -y cronie && sudo systemctl enable crond && sudo systemctl start crond")
    # Idempotent: strip any existing metrics.sh entry then re-add
    ssh.run(ip, config.PEM_FILE, (
        "(crontab -l 2>/dev/null | grep -v 'metrics.sh'; "
        "echo '* * * * * /home/ec2-user/metrics.sh >> /home/ec2-user/devops2-metrics.log 2>&1') | crontab -"
    ))
    print("  metrics cron: installed (runs every minute)")


def setup_service(ip):
    """Install a systemd unit so the backend starts automatically on boot."""
    print("6/6 Setting up systemd service...")
    unit = "\n".join([
        "[Unit]",
        "Description=DevOps2 node backend",
        "After=network.target",
        "",
        "[Service]",
        "Type=simple",
        "User=ec2-user",
        f"WorkingDirectory={config.APP_DIR}",
        # leading dash means systemd won't fail if .env is missing on first boot
        f"EnvironmentFile=-{config.APP_DIR}/.env",
        f"ExecStart=/usr/bin/node {config.APP_DIR}/dist/server.js",
        "Restart=on-failure",
        "RestartSec=5",
        "StandardOutput=journal",
        "StandardError=journal",
        "",
        "[Install]",
        "WantedBy=multi-user.target",
    ]) + "\n"
    encoded = base64.b64encode(unit.encode()).decode()
    ssh.run(ip, config.PEM_FILE, f"echo {encoded} | base64 -d > /tmp/devops2.service")
    ssh.run(ip, config.PEM_FILE, (
        "sudo mv /tmp/devops2.service /etc/systemd/system/devops2.service"
        " && sudo systemctl daemon-reload"
        " && sudo systemctl enable devops2"
        " && sudo systemctl start devops2"
    ))
    time.sleep(3)
    running = ssh.run(ip, config.PEM_FILE, "sudo systemctl is-active --quiet devops2", check=False)
    if running:
        print("  service: active")
    else:
        print("  warning: service may not have started — check with: journalctl -u devops2 -n 30")
