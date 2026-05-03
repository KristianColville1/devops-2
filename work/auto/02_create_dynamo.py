"""
Create the DynamoDB table used by the node backend.
Safe to re-run — skips creation if the table already exists.
"""

import sys
from botocore.exceptions import ClientError

from utils.dotenv import load_dotenv
from utils import aws
from src.modules.dynamo.table import ensure_table

load_dotenv()

# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print(f"Region: {aws.REGION}\n")
    try:
        ensure_table()
        print("\nDone. Restart the backend service to pick up the table an check the logs")
    except ClientError as e:
        err = e.response["Error"]
        print(f"AWS error: {err.get('Code')} — {err.get('Message')}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
