import os
import boto3

REGION = os.environ.get("REGION", "us-east-1")


def ec2_client():
    """Return a boto3 EC2 client for the configured region."""
    return boto3.client("ec2", region_name=REGION)


def ec2_resource():
    """Return a boto3 EC2 resource for the configured region."""
    return boto3.resource("ec2", region_name=REGION)


def dynamo_client():
    """Return a boto3 DynamoDB client for the configured region."""
    return boto3.client("dynamodb", region_name=REGION)
