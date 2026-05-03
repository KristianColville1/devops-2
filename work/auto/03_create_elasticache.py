"""
Create an ElastiCache Redis cluster and wire REDIS_URL into the running master.
Run after 01_create_master.py so the master IP and SG are already in state.
"""

import sys

from botocore.exceptions import ClientError

from utils import aws
from utils.dotenv import load_dotenv
from src.modules.elasticache.cluster import ensure_cluster

load_dotenv()


def main():
    print(f"Region: {aws.REGION}\n")

    try:
        redis_url = ensure_cluster()
    except ClientError as e:
        print(f"\nAWS error: {e.response['Error']['Code']} — {e.response['Error']['Message']}")
        sys.exit(1)
    except RuntimeError as e:
        print(f"\nError: {e}")
        sys.exit(1)

    print(f"\nDone. REDIS_URL: {redis_url}")


if __name__ == "__main__":
    main()
