"""
Generate a self-signed TLS certificate and upload it to AWS IAM.
The ALB HTTPS listener uses an IAM server certificate because Academy accounts
cannot complete ACM DNS validation without a custom domain.

The certificate is self-signed — browsers will show a one-time security warning.
Accept it once and HTTPS + WSS work correctly from that point on.
"""

import os
import subprocess
import sys
import tempfile
from botocore.exceptions import ClientError
from utils import aws, state
from utils.dotenv import load_dotenv

load_dotenv()

CERT_NAME = "devops2-cert"


def generate_cert(key_path, cert_path):
    """Generate a 2048-bit RSA self-signed certificate valid for 365 days."""
    subprocess.run(
        [
            "openssl", "req", "-x509",
            "-newkey", "rsa:2048",
            "-keyout", key_path,
            "-out", cert_path,
            "-days", "365",
            "-nodes",
            "-subj", "/CN=devops2.local/O=DevOps2Assignment/C=IE",
        ],
        check=True,
        capture_output=True,
    )
    print("  certificate generated (self-signed, RSA 2048, 365 days)")


def upload_to_iam(cert_path, key_path):
    """Delete any existing cert with this name then upload the new one."""
    iam = aws.iam_client()

    try:
        iam.delete_server_certificate(ServerCertificateName=CERT_NAME)
        print(f"  deleted existing IAM cert: {CERT_NAME}")
    except ClientError as e:
        if e.response["Error"]["Code"] != "NoSuchEntity":
            raise

    with open(cert_path) as f:
        cert_body = f.read()
    with open(key_path) as f:
        private_key = f.read()

    resp = iam.upload_server_certificate(
        ServerCertificateName=CERT_NAME,
        CertificateBody=cert_body,
        PrivateKey=private_key,
    )
    return resp["ServerCertificateMetadata"]["Arn"]


def main():
    print("Generating self-signed TLS certificate...")
    with tempfile.TemporaryDirectory() as tmpdir:
        key_path  = os.path.join(tmpdir, "key.pem")
        cert_path = os.path.join(tmpdir, "cert.pem")
        generate_cert(key_path, cert_path)

        print("Uploading to AWS IAM...")
        arn = upload_to_iam(cert_path, key_path)

    state.update(certificate_arn=arn)

    print(f"\nDone.")
    print(f"  name: {CERT_NAME}")
    print(f"  ARN:  {arn}")
    print(f"\nNote: self-signed — browser shows a warning on first visit.")
    print(f"      Click 'Advanced → Proceed' once. HTTPS and WSS work normally after that.")
    print(f"\nNext: python 02_create_dynamo.py  (skip if table exists)")
    print(f"      python 01_create_master.py")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as e:
        stderr = e.stderr.decode() if e.stderr else ""
        print(f"\nopenssl failed:\n{stderr}")
        print("Make sure openssl is installed: sudo apt install openssl  (or brew install openssl)")
        sys.exit(1)
    except ClientError as e:
        print(f"\nAWS error: {e.response['Error']['Code']} — {e.response['Error']['Message']}")
        sys.exit(1)
    except RuntimeError as e:
        print(f"\nError: {e}")
        sys.exit(1)
