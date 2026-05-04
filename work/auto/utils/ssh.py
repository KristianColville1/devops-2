import subprocess
import time


def run(ip, pem_file, cmd, check=True, jump_ip=None):
    """Run a shell command on a remote instance via SSH, streaming output to the terminal.

    jump_ip: if set, SSH through this host as a bastion (ProxyJump) — used for private-subnet instances.
    """
    args = [
        "ssh", "-i", pem_file,
        "-o", "StrictHostKeyChecking=no",
        "-o", "BatchMode=yes",
        "-o", "ConnectTimeout=10",
    ]
    if jump_ip:
        args += ["-o", f"ProxyJump=ec2-user@{jump_ip}"]
    args += [f"ec2-user@{ip}", cmd]

    result = subprocess.run(args, check=False)
    if check and result.returncode != 0:
        raise RuntimeError(f"Remote command failed (exit {result.returncode}): {cmd[:100]}")
    return result.returncode == 0


def wait_ready(ip, pem_file, retries=24, delay=15):
    """Poll SSH until the instance is accepting connections."""
    print("  waiting for SSH", end="", flush=True)
    for _ in range(retries):
        result = subprocess.run(
            [
                "ssh", "-i", pem_file,
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
        time.sleep(delay)
    raise RuntimeError("SSH never became available — check the instance console and SG rules")
