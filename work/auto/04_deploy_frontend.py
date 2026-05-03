"""
Build the React frontend locally and deploy it to S3 static website hosting.
Reads the master public IP from state to set VITE_API_URL automatically.
Run after 01_create_master.py.
"""

import sys

from botocore.exceptions import ClientError

from utils import aws
from utils.dotenv import load_dotenv
from src.modules.frontend.build import build
from src.modules.frontend.s3 import deploy

load_dotenv()


def main():
    print(f"Region: {aws.REGION}\n")

    # --- build ---
    print("Building frontend...")
    try:
        dist_path = build()
    except RuntimeError as e:
        print(f"\nBuild error: {e}")
        sys.exit(1)

    # --- deploy ---
    print("\nDeploying to S3...")
    try:
        bucket_name, url = deploy(dist_path)
    except ClientError as e:
        print(f"\nAWS error: {e.response['Error']['Code']} — {e.response['Error']['Message']}")
        sys.exit(1)
    except RuntimeError as e:
        print(f"\nDeploy error: {e}")
        sys.exit(1)

    print(f"\nDone.")
    print(f"  bucket:  {bucket_name}")
    print(f"  url:     {url}")


if __name__ == "__main__":
    main()
