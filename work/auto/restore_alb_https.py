"""
Restore the HTTPS listener on the ALB after a failed migrate_to_cloudfront attempt.
The IAM server certificate was not deleted, so this is fully reversible.
"""

import sys
import boto3
from botocore.exceptions import ClientError
from utils import aws, state
from utils.dotenv import load_dotenv

load_dotenv()


def main():
    cert_arn = state.get("certificate_arn")
    alb_dns  = state.get("alb_dns")

    if not cert_arn:
        print("Error: certificate_arn not in state — cert was deleted, cannot restore")
        sys.exit(1)
    if not alb_dns:
        print("Error: alb_dns not in state")
        sys.exit(1)

    print(f"Restoring HTTPS on ALB: {alb_dns}")
    print(f"Certificate: {cert_arn}\n")

    elbv2 = boto3.client("elbv2", region_name=aws.REGION)
    ec2   = aws.ec2_client()

    # Find the ALB
    resp = elbv2.describe_load_balancers()
    alb = next((lb for lb in resp["LoadBalancers"] if lb["DNSName"] == alb_dns), None)
    if not alb:
        print(f"Error: ALB not found for DNS {alb_dns}")
        sys.exit(1)

    alb_arn   = alb["LoadBalancerArn"]
    alb_sg_id = alb["SecurityGroups"][0]

    # Get target group ARN and current listeners
    listeners = elbv2.describe_listeners(LoadBalancerArn=alb_arn)["Listeners"]
    tg_arn = None
    http_arn = None
    has_https = False

    for l in listeners:
        if l["Port"] == 443:
            has_https = True
        elif l["Port"] == 80:
            http_arn = l["ListenerArn"]
            for action in l["DefaultActions"]:
                if action["Type"] == "forward":
                    tg_arn = action.get("TargetGroupArn")
                    if not tg_arn:
                        groups = action.get("ForwardConfig", {}).get("TargetGroups", [])
                        tg_arn = groups[0]["TargetGroupArn"] if groups else None

    if not tg_arn:
        # Fall back to CF stack outputs
        cf = aws.cf_client()
        stack_name = state.get("cf_stack_name", "devops2-stack")
        stack = cf.describe_stacks(StackName=stack_name)["Stacks"][0]
        for o in stack.get("Outputs", []):
            if o["OutputKey"] == "TargetGroupArn":
                tg_arn = o["OutputValue"]
                break

    if not tg_arn:
        print("Error: cannot determine target group ARN")
        sys.exit(1)

    print(f"  TG ARN: {tg_arn[:50]}...")

    # 1. Re-add port 443 to ALB SG
    print(f"\n1. Adding port 443 to ALB SG {alb_sg_id}...")
    try:
        ec2.authorize_security_group_ingress(
            GroupId=alb_sg_id,
            IpPermissions=[{
                "IpProtocol": "tcp",
                "FromPort": 443,
                "ToPort": 443,
                "IpRanges": [{"CidrIp": "0.0.0.0/0"}],
            }],
        )
        print("   done")
    except ClientError as e:
        if e.response["Error"]["Code"] == "InvalidPermission.Duplicate":
            print("   already present")
        else:
            raise

    # 2. Re-create HTTPS listener
    if has_https:
        print("\n2. HTTPS listener already exists — skipping")
    else:
        print("\n2. Creating HTTPS listener on port 443...")
        elbv2.create_listener(
            LoadBalancerArn=alb_arn,
            Protocol="HTTPS",
            Port=443,
            Certificates=[{"CertificateArn": cert_arn}],
            DefaultActions=[{"Type": "forward", "TargetGroupArn": tg_arn}],
        )
        print("   done")

    # 3. Switch HTTP listener back to redirect → HTTPS
    if http_arn:
        print("\n3. Switching HTTP listener: forward → redirect to HTTPS...")
        # Check if already redirecting
        l = next(l for l in listeners if l["Port"] == 80)
        already_redirect = any(a["Type"] == "redirect" for a in l["DefaultActions"])
        if already_redirect:
            print("   already redirecting")
        else:
            elbv2.modify_listener(
                ListenerArn=http_arn,
                DefaultActions=[{
                    "Type": "redirect",
                    "RedirectConfig": {
                        "Protocol": "HTTPS",
                        "Port": "443",
                        "StatusCode": "HTTP_301",
                    },
                }],
            )
            print("   done")
    else:
        print("\n3. No HTTP listener found — skipping redirect")

    print("\nDone. ALB is back to HTTPS with the self-signed certificate.")
    print(f"\n  Frontend URL: https://{state.get('frontend_bucket')}.s3.amazonaws.com/index.html")
    print(f"  Before WSS works: visit https://{alb_dns} in Firefox and accept the cert warning.")


if __name__ == "__main__":
    try:
        main()
    except ClientError as e:
        err = e.response["Error"]
        print(f"\nAWS error: {err['Code']} — {err['Message']}")
        sys.exit(1)
    except RuntimeError as e:
        print(f"\nError: {e}")
        sys.exit(1)
