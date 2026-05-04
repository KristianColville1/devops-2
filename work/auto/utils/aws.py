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


def elasticache_client():
    """Return a boto3 ElastiCache client for the configured region."""
    return boto3.client("elasticache", region_name=REGION)


def s3_client():
    """Return a boto3 S3 client for the configured region."""
    return boto3.client("s3", region_name=REGION)


def cf_client():
    """Return a boto3 CloudFormation client for the configured region."""
    return boto3.client("cloudformation", region_name=REGION)


def asg_client():
    """Return a boto3 Auto Scaling client for the configured region."""
    return boto3.client("autoscaling", region_name=REGION)


def iam_client():
    """Return a boto3 IAM client."""
    return boto3.client("iam", region_name=REGION)
