"""
Full stack tearup — runs all devops2 provisioning scripts in the correct order.
Each step is idempotent: if a resource already exists it is skipped automatically.

Steps:
  1. VPC + subnets + NAT Gateway       (~5 min, NAT GW takes time)
  2. DynamoDB table                    (skipped if already exists)
  3. Master EC2 + Node 22 + backend    (~4 min)
  4. ElastiCache Redis cluster         (~5 min)
  5. Bake AMI from master              (~3 min)
  6. CloudFormation stack (ALB + ASG)  (~3 min)
  7. CloudFront + frontend → S3        (~12 min, CF deployment takes time)

If any step fails the script stops and prints which step to re-run from.
Fix the issue and re-run tearup.py — completed steps will be skipped.
"""

import os
import subprocess
import sys
import time

_HERE = os.path.dirname(os.path.abspath(__file__))
_PY   = sys.executable

STEPS = [
    ("VPC + NAT Gateway",          [_PY, "00_create_vpc.py"]),
    ("TLS Certificate",            [_PY, "00_create_certificate.py"]),
    ("DynamoDB table",             [_PY, "02_create_dynamo.py"]),
    ("Master EC2",                 [_PY, "01_create_master.py"]),
    ("ElastiCache Redis",          [_PY, "03_create_elasticache.py"]),
    ("Bake AMI",                   [_PY, "01_create_master.py", "--bake"]),
    ("CloudFormation (ALB + ASG)", [_PY, "05_deploy_cloudformation.py"]),
    ("Frontend → S3",              [_PY, "04_deploy_frontend.py"]),
]


def _banner(step, total, title):
    bar = "─" * 60
    print(f"\n{bar}")
    print(f"  STEP {step}/{total} — {title}")
    print(f"{bar}\n")


def run_step(step, total, title, cmd):
    _banner(step, total, title)
    start = time.time()
    result = subprocess.run(cmd, cwd=_HERE)
    elapsed = int(time.time() - start)
    if result.returncode != 0:
        print(f"\n{'─' * 60}")
        print(f"  FAILED at step {step}/{total} — {title}  (exit {result.returncode})")
        print(f"{'─' * 60}")
        print(f"\n  Fix the issue above, then re-run tearup.py.")
        print(f"  Completed steps will be skipped automatically.\n")
        sys.exit(result.returncode)
    print(f"\n  ✓ {title} — done in {elapsed}s")


def main():
    total = len(STEPS)
    print("─" * 60)
    print("  devops2 full stack tearup")
    print("─" * 60)
    print(f"\n  {total} steps — estimated total time: ~20 minutes")
    print(f"  Each step is idempotent: existing resources are skipped.\n")

    overall_start = time.time()
    for i, (title, cmd) in enumerate(STEPS, 1):
        run_step(i, total, title, cmd)

    elapsed = int(time.time() - overall_start)
    print(f"\n{'─' * 60}")
    print(f"  All {total} steps complete in {elapsed}s.")
    print(f"{'─' * 60}")
    print()
    print("  Next steps:")
    print("  1. Open the frontend URL from the S3 output above")
    print("  2. Accept the self-signed certificate warning in your browser")
    print("  3. Verify the dashboard shows node cards and WebSocket connects")
    print("  4. Run fix_metrics_cron.py if CloudWatch metrics are missing")
    print()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nAborted.")
        sys.exit(1)
