"""
Migrate from self-signed cert HTTPS on ALB to CloudFront HTTPS.

Idempotent — safe to re-run; skips steps already completed.

Steps:
  1. ALB  — delete HTTPS listener, switch HTTP listener redirect → forward
  2. ALB  — remove port 443 from ALB security group
  3. CF   — create CloudFront distribution (S3 frontend + ALB backend origins)
  4. FE   — rebuild frontend with CloudFront URL, redeploy to S3
  5. CF   — wait for distribution to reach Deployed status (~10 min)
  6. IAM  — delete server certificate (no longer needed)

After this script:
  - ALB serves plain HTTP on port 80 (no cert required)
  - CloudFront provides HTTPS via *.cloudfront.net (Amazon's own cert — no browser warnings)
  - Frontend URL: https://<id>.cloudfront.net
  - API and WebSocket routes /api/* and /ws* are proxied to the ALB by CloudFront
"""

import sys
import time
import uuid

import boto3
from botocore.exceptions import ClientError

from utils import aws, state
from utils.dotenv import load_dotenv
from src.modules.frontend.build import build
from src.modules.frontend.s3 import deploy

load_dotenv()

TOTAL = 6


def _banner(step, title):
    print(f"\n{'─' * 60}")
    print(f"  {step}/{TOTAL} — {title}")
    print(f"{'─' * 60}")


def _elbv2():
    return boto3.client('elbv2', region_name=aws.REGION)


def _cf_client():
    # CloudFront is a global service — endpoint is always us-east-1
    return boto3.client('cloudfront', region_name='us-east-1')


# ---------------------------------------------------------------------------
# Steps 1 + 2: Update ALB
# ---------------------------------------------------------------------------

def _extract_tg_arn(action):
    if action.get('TargetGroupArn'):
        return action['TargetGroupArn']
    groups = action.get('ForwardConfig', {}).get('TargetGroups', [])
    return groups[0]['TargetGroupArn'] if groups else None


def _tg_arn_from_cf_outputs():
    cf = aws.cf_client()
    stack_name = state.get('cf_stack_name', 'devops2-stack')
    try:
        stack = cf.describe_stacks(StackName=stack_name)['Stacks'][0]
        for o in stack.get('Outputs', []):
            if o['OutputKey'] == 'TargetGroupArn':
                return o['OutputValue']
    except ClientError:
        pass
    return None


def update_alb():
    elbv2 = _elbv2()
    alb_dns = state.get('alb_dns')
    if not alb_dns:
        raise RuntimeError("alb_dns not in state — run 05_deploy_cloudformation.py first")

    resp = elbv2.describe_load_balancers()
    alb = next((lb for lb in resp['LoadBalancers'] if lb['DNSName'] == alb_dns), None)
    if not alb:
        raise RuntimeError(f"ALB not found for DNS: {alb_dns}")

    alb_arn   = alb['LoadBalancerArn']
    alb_sg_id = alb['SecurityGroups'][0]
    print(f"  ALB: {alb_dns}")

    listeners = elbv2.describe_listeners(LoadBalancerArn=alb_arn)['Listeners']

    tg_arn    = None
    https_arn = None
    http_l    = None

    for l in listeners:
        for action in l['DefaultActions']:
            if action['Type'] == 'forward':
                tg_arn = tg_arn or _extract_tg_arn(action)
        if l['Port'] == 443:
            https_arn = l['ListenerArn']
        elif l['Port'] == 80:
            http_l = l

    if not tg_arn:
        tg_arn = _tg_arn_from_cf_outputs()
    if not tg_arn:
        raise RuntimeError("Cannot determine target group ARN — is the CF stack deployed?")

    # Delete HTTPS listener
    if https_arn:
        print("  deleting HTTPS listener (port 443)...")
        elbv2.delete_listener(ListenerArn=https_arn)
        print("  done")
    else:
        print("  HTTPS listener: already removed")

    # Switch HTTP listener from redirect to forward
    if http_l:
        already_forward = any(a['Type'] == 'forward' for a in http_l['DefaultActions'])
        if not already_forward:
            print("  HTTP listener: redirect → forward...")
            elbv2.modify_listener(
                ListenerArn=http_l['ListenerArn'],
                DefaultActions=[{'Type': 'forward', 'TargetGroupArn': tg_arn}],
            )
            print("  done")
        else:
            print("  HTTP listener: already forwarding")
    else:
        print("  HTTP listener: not found")

    # Remove port 443 ingress from ALB SG
    try:
        aws.ec2_client().revoke_security_group_ingress(
            GroupId=alb_sg_id,
            IpPermissions=[{
                'IpProtocol': 'tcp',
                'FromPort': 443,
                'ToPort': 443,
                'IpRanges': [{'CidrIp': '0.0.0.0/0'}],
            }],
        )
        print(f"  ALB SG {alb_sg_id}: port 443 removed")
    except ClientError as e:
        if 'InvalidPermission.NotFound' in e.response['Error']['Code']:
            print(f"  ALB SG {alb_sg_id}: port 443 already removed")
        else:
            raise


# ---------------------------------------------------------------------------
# Step 3: Create CloudFront distribution
# ---------------------------------------------------------------------------

def create_or_get_cloudfront():
    cf = _cf_client()

    existing_id = state.get('cloudfront_id')
    if existing_id:
        print(f"  distribution already in state: {existing_id}")
        d = cf.get_distribution(Id=existing_id)['Distribution']
        domain = d['DomainName']
        state.update(cloudfront_url=f'https://{domain}')
        return domain, existing_id

    alb_dns = state.get('alb_dns')
    bucket  = state.get('frontend_bucket')

    resp = cf.create_distribution(DistributionConfig={
        'CallerReference': f'devops2-{uuid.uuid4().hex[:8]}',
        'Comment': 'devops2 — S3 frontend + ALB backend',
        'DefaultRootObject': 'index.html',
        'Enabled': True,
        'HttpVersion': 'http2',
        'IsIPV6Enabled': True,
        'PriceClass': 'PriceClass_100',
        'Origins': {
            'Quantity': 2,
            'Items': [
                {
                    'Id': 's3-frontend',
                    'DomainName': f'{bucket}.s3.amazonaws.com',
                    'S3OriginConfig': {'OriginAccessIdentity': ''},
                },
                {
                    'Id': 'alb-backend',
                    'DomainName': alb_dns,
                    'CustomOriginConfig': {
                        'HTTPPort': 80,
                        'HTTPSPort': 443,
                        'OriginProtocolPolicy': 'http-only',
                        'OriginReadTimeout': 60,
                        'OriginKeepaliveTimeout': 5,
                    },
                },
            ],
        },
        # Default behaviour: serve React app from S3
        'DefaultCacheBehavior': {
            'TargetOriginId': 's3-frontend',
            'ViewerProtocolPolicy': 'redirect-to-https',
            'AllowedMethods': {
                'Quantity': 2,
                'Items': ['GET', 'HEAD'],
                'CachedMethods': {'Quantity': 2, 'Items': ['GET', 'HEAD']},
            },
            'ForwardedValues': {
                'QueryString': False,
                'Cookies': {'Forward': 'none'},
                'Headers': {'Quantity': 0, 'Items': []},
            },
            'MinTTL': 0,
            'DefaultTTL': 86400,
            'MaxTTL': 31536000,
            'Compress': True,
        },
        'CacheBehaviors': {
            'Quantity': 2,
            'Items': [
                # REST API — no caching, all methods, forward auth header
                {
                    'PathPattern': '/api/*',
                    'TargetOriginId': 'alb-backend',
                    'ViewerProtocolPolicy': 'https-only',
                    'AllowedMethods': {
                        'Quantity': 7,
                        'Items': ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'],
                        'CachedMethods': {'Quantity': 2, 'Items': ['GET', 'HEAD']},
                    },
                    'ForwardedValues': {
                        'QueryString': True,
                        'Cookies': {'Forward': 'none'},
                        'Headers': {'Quantity': 1, 'Items': ['Authorization']},
                    },
                    'MinTTL': 0,
                    'DefaultTTL': 0,
                    'MaxTTL': 0,
                    'Compress': False,
                },
                # WebSocket — no caching, forward upgrade headers + query string (token)
                {
                    'PathPattern': '/ws*',
                    'TargetOriginId': 'alb-backend',
                    'ViewerProtocolPolicy': 'https-only',
                    'AllowedMethods': {
                        'Quantity': 2,
                        'Items': ['GET', 'HEAD'],
                        'CachedMethods': {'Quantity': 2, 'Items': ['GET', 'HEAD']},
                    },
                    'ForwardedValues': {
                        'QueryString': True,
                        'Cookies': {'Forward': 'none'},
                        'Headers': {
                            'Quantity': 5,
                            'Items': [
                                'Connection',
                                'Origin',
                                'Sec-WebSocket-Key',
                                'Sec-WebSocket-Version',
                                'Upgrade',
                            ],
                        },
                    },
                    'MinTTL': 0,
                    'DefaultTTL': 0,
                    'MaxTTL': 0,
                    'Compress': False,
                },
            ],
        },
    })

    dist   = resp['Distribution']
    dist_id = dist['Id']
    domain  = dist['DomainName']
    state.update(cloudfront_id=dist_id, cloudfront_url=f'https://{domain}')
    print(f"  ID:     {dist_id}")
    print(f"  domain: {domain}")
    print(f"  status: {dist['Status']} (will reach Deployed in ~10 min)")
    return domain, dist_id


# ---------------------------------------------------------------------------
# Step 4: Rebuild and redeploy frontend
# ---------------------------------------------------------------------------

def rebuild_frontend(cf_domain):
    api_url = f'https://{cf_domain}'
    print(f"  VITE_API_URL = {api_url}")
    dist_path = build(api_url=api_url)
    bucket, url = deploy(dist_path)
    print(f"  deployed to: {url}")


# ---------------------------------------------------------------------------
# Step 5: Wait for CloudFront deployment
# ---------------------------------------------------------------------------

def wait_for_cloudfront(dist_id):
    cf = _cf_client()
    resp = cf.get_distribution(Id=dist_id)
    if resp['Distribution']['Status'] == 'Deployed':
        print("  already Deployed")
        return
    print("  waiting", end="", flush=True)
    for i in range(40):  # max 20 min (40 × 30 s)
        time.sleep(30)
        status = cf.get_distribution(Id=dist_id)['Distribution']['Status']
        if status == 'Deployed':
            print(" done.")
            return
        if i > 0 and i % 4 == 0:
            print(f"\n  still waiting ({(i+1)*30}s, {status})", end="", flush=True)
        else:
            print(".", end="", flush=True)
    raise RuntimeError("CloudFront did not reach Deployed in 20 min — re-run to resume")


# ---------------------------------------------------------------------------
# Step 6: Delete IAM server certificate
# ---------------------------------------------------------------------------

def delete_iam_cert():
    cert_arn = state.get('certificate_arn')
    if not cert_arn:
        print("  no certificate in state — skipping")
        return
    cert_name = cert_arn.split('/')[-1]
    try:
        aws.iam_client().delete_server_certificate(ServerCertificateName=cert_name)
        print(f"  deleted: {cert_name}")
    except ClientError as e:
        code = e.response['Error']['Code']
        if code == 'NoSuchEntity':
            print(f"  already deleted: {cert_name}")
        elif code == 'DeleteConflict':
            print(f"  cert still referenced — HTTPS listener may not have been removed yet")
            raise
        else:
            raise
    state.update(certificate_arn=None)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    alb_dns = state.get('alb_dns')
    bucket  = state.get('frontend_bucket')

    if not alb_dns:
        print("Error: alb_dns not in state — run 05_deploy_cloudformation.py first")
        sys.exit(1)
    if not bucket:
        print("Error: frontend_bucket not in state — run 04_deploy_frontend.py first")
        sys.exit(1)

    print("devops2 — migrate to CloudFront HTTPS\n")
    print(f"  ALB:    {alb_dns}")
    print(f"  Bucket: {bucket}")

    _banner(1, "Update ALB — delete HTTPS listener, switch HTTP to forward")
    update_alb()

    _banner(2, "Update ALB SG — remove port 443 (handled in step 1)")
    print("  (port 443 removal was done in step 1 above)")

    _banner(3, "Create CloudFront distribution")
    cf_domain, cf_id = create_or_get_cloudfront()

    _banner(4, "Rebuild and redeploy frontend with CloudFront URL")
    rebuild_frontend(cf_domain)

    _banner(5, "Wait for CloudFront deployment (~10 min)")
    wait_for_cloudfront(cf_id)

    _banner(6, "Delete IAM server certificate")
    delete_iam_cert()

    cf_url = state.get('cloudfront_url')
    print(f"\n{'─' * 60}")
    print(f"  Migration complete.")
    print(f"{'─' * 60}")
    print(f"\n  Frontend (HTTPS, no cert warning): {cf_url}")
    print(f"  ALB is now HTTP-only — CloudFront handles all TLS")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nAborted.")
        sys.exit(1)
    except ClientError as e:
        err = e.response['Error']
        print(f"\nAWS error: {err['Code']} — {err['Message']}")
        sys.exit(1)
    except RuntimeError as e:
        print(f"\nError: {e}")
        sys.exit(1)
