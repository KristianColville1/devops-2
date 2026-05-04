import json
import mimetypes
import os
import random
import string

from botocore.exceptions import ClientError

from utils import aws, state

BUCKET_PREFIX = "kc-devops2"


def _random_suffix(length=6):
    """Return a short random lowercase alphanumeric string."""
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=length))


def bucket_name_from_state():
    """Return existing bucket name from state if already deployed."""
    return state.get("frontend_bucket")


def create_bucket(bucket_name):
    """Create an S3 bucket for static website hosting."""
    client = aws.s3_client()
    try:
        # us-east-1 does not accept a LocationConstraint — other regions do
        if aws.REGION == "us-east-1":
            client.create_bucket(Bucket=bucket_name)
        else:
            client.create_bucket(
                Bucket=bucket_name,
                CreateBucketConfiguration={"LocationConstraint": aws.REGION},
            )
        print(f"  bucket: {bucket_name} created")
    except ClientError as e:
        if e.response["Error"]["Code"] == "BucketAlreadyOwnedByYou":
            print(f"  bucket: {bucket_name} (already owned)")
        else:
            raise
    return bucket_name


def set_public_access(bucket_name):
    """Disable the public access block so the bucket policy can make objects public."""
    aws.s3_client().put_public_access_block(
        Bucket=bucket_name,
        PublicAccessBlockConfiguration={
            "BlockPublicAcls": False,
            "IgnorePublicAcls": False,
            "BlockPublicPolicy": False,
            "RestrictPublicBuckets": False,
        },
    )


def set_bucket_policy(bucket_name):
    """Apply a public read policy so the browser can fetch all frontend assets."""
    policy = {
        "Version": "2012-10-17",
        "Statement": [{
            "Sid": "PublicRead",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": f"arn:aws:s3:::{bucket_name}/*",
        }],
    }
    aws.s3_client().put_bucket_policy(Bucket=bucket_name, Policy=json.dumps(policy))


def enable_website_hosting(bucket_name):
    """Configure the bucket as a static website with index.html as the root."""
    aws.s3_client().put_bucket_website(
        Bucket=bucket_name,
        WebsiteConfiguration={"IndexDocument": {"Suffix": "index.html"}},
    )


def upload_dist(bucket_name, dist_path):
    """Walk the dist/ directory and upload every file with the correct content type."""
    client = aws.s3_client()
    uploaded = 0
    for root, _, files in os.walk(dist_path):
        for filename in files:
            local_path = os.path.join(root, filename)
            # Preserve directory structure as the S3 key
            key = os.path.relpath(local_path, dist_path).replace(os.sep, "/")
            content_type, _ = mimetypes.guess_type(local_path)
            content_type = content_type or "application/octet-stream"
            client.upload_file(
                local_path,
                bucket_name,
                key,
                ExtraArgs={"ContentType": content_type},
            )
            uploaded += 1
    print(f"  uploaded {uploaded} files")


def website_url(bucket_name):
    """Return the S3 static website endpoint URL (HTTP only)."""
    return f"http://{bucket_name}.s3-website-{aws.REGION}.amazonaws.com"


def https_url(bucket_name):
    """Return the S3 REST endpoint URL (HTTPS, uses Amazon's cert)."""
    return f"https://{bucket_name}.s3.amazonaws.com/index.html"


def deploy(dist_path, bucket_name=None):
    """Create bucket, set policy, upload dist/, return (bucket_name, https_url)."""
    if not bucket_name:
        bucket_name = bucket_name_from_state() or f"{BUCKET_PREFIX}-{_random_suffix()}"

    create_bucket(bucket_name)
    set_public_access(bucket_name)
    set_bucket_policy(bucket_name)
    enable_website_hosting(bucket_name)

    print(f"  uploading frontend...")
    upload_dist(bucket_name, dist_path)

    url = https_url(bucket_name)
    state.update(frontend_bucket=bucket_name, frontend_url=url)
    return bucket_name, url
