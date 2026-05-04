import time

from botocore.exceptions import ClientError

from utils import aws, state

TABLE_NAME = "devops-nodes"
TTL_ATTRIBUTE = "expiresAt"


def get_table_status():
    """Return the current table status, or None if it doesn't exist."""
    client = aws.dynamo_client()
    try:
        resp = client.describe_table(TableName=TABLE_NAME)
        return resp["Table"]["TableStatus"]
    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceNotFoundException":
            return None
        raise


def create_table():
    """Create the devops-nodes table with instanceId as the partition key."""
    client = aws.dynamo_client()
    client.create_table(
        TableName=TABLE_NAME,
        KeySchema=[
            {"AttributeName": "instanceId", "KeyType": "HASH"},
        ],
        AttributeDefinitions=[
            {"AttributeName": "instanceId", "AttributeType": "S"},
        ],
        # PAY_PER_REQUEST keeps it within budget limits
        BillingMode="PAY_PER_REQUEST",
    )


def enable_ttl():
    """Enable TTL on the expiresAt attribute so stale node records clean themselves up."""
    client = aws.dynamo_client()
    client.update_time_to_live(
        TableName=TABLE_NAME,
        TimeToLiveSpecification={
            "Enabled": True,
            "AttributeName": TTL_ATTRIBUTE,
        },
    )


def wait_active(retries=20, delay=6):
    """Poll until the table reaches ACTIVE status."""
    print("  waiting for table to become active", end="", flush=True)
    for _ in range(retries):
        status = get_table_status()
        if status == "ACTIVE":
            print(" done.")
            return
        if status is None:
            raise RuntimeError(f"Table {TABLE_NAME} disappeared while waiting")
        print(".", end="", flush=True)
        time.sleep(delay)
    raise RuntimeError(f"Table {TABLE_NAME} did not become ACTIVE in time")


def ensure_table():
    """Create the table if it doesn't exist, wait for it to be active, and save to state."""
    status = get_table_status()

    if status == "ACTIVE":
        print(f"  table: {TABLE_NAME} (already active)")
        state.update(dynamo_table=TABLE_NAME)
        return

    if status is not None:
        # Table exists but in a transitional state: CREATING, DELETING, etc
        print(f"  table: {TABLE_NAME} (status: {status}, waiting...)")
        wait_active()
        state.update(dynamo_table=TABLE_NAME)
        return

    print(f"  creating table: {TABLE_NAME}")
    create_table()
    wait_active()

    print("  enabling TTL on expiresAt...")
    enable_ttl()

    state.update(dynamo_table=TABLE_NAME)
    print(f"  table ready: {TABLE_NAME}")
