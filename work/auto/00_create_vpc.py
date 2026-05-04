"""
Create the devops2 custom VPC with public/private subnets, IGW, and NAT Gateway.
Run this once before any other scripts. Saves all resource IDs to state.

VPC layout (10.0.0.0/16):
  Public  10.0.1.0/24  us-east-1a  — ALB, master instance, NAT Gateway
  Public  10.0.2.0/24  us-east-1b  — ALB
  Private 10.0.3.0/24  us-east-1a  — ASG app instances, ElastiCache
  Private 10.0.4.0/24  us-east-1b  — ASG app instances, ElastiCache
"""

import sys
import time
from botocore.exceptions import ClientError
from utils import aws, state
from utils.dotenv import load_dotenv

load_dotenv()

VPC_CIDR = "10.0.0.0/16"
PUBLIC_SUBNETS  = [("10.0.1.0/24", "us-east-1a"), ("10.0.2.0/24", "us-east-1b")]
PRIVATE_SUBNETS = [("10.0.3.0/24", "us-east-1a"), ("10.0.4.0/24", "us-east-1b")]


def _tag(name):
    return [{"Key": "Name", "Value": name}]


def ensure_vpc(ec2):
    existing = ec2.describe_vpcs(Filters=[{"Name": "tag:Name", "Values": ["devops2-vpc"]}])
    if existing["Vpcs"]:
        vpc_id = existing["Vpcs"][0]["VpcId"]
        print(f"  VPC: {vpc_id} (already exists)")
        return vpc_id
    resp = ec2.create_vpc(CidrBlock=VPC_CIDR)
    vpc_id = resp["Vpc"]["VpcId"]
    ec2.create_tags(Resources=[vpc_id], Tags=_tag("devops2-vpc"))
    ec2.modify_vpc_attribute(VpcId=vpc_id, EnableDnsSupport={"Value": True})
    ec2.modify_vpc_attribute(VpcId=vpc_id, EnableDnsHostnames={"Value": True})
    print(f"  VPC: {vpc_id}")
    return vpc_id


def ensure_igw(ec2, vpc_id):
    existing = ec2.describe_internet_gateways(
        Filters=[{"Name": "attachment.vpc-id", "Values": [vpc_id]}]
    )
    if existing["InternetGateways"]:
        igw_id = existing["InternetGateways"][0]["InternetGatewayId"]
        print(f"  IGW: {igw_id} (already attached)")
        return igw_id
    resp = ec2.create_internet_gateway()
    igw_id = resp["InternetGateway"]["InternetGatewayId"]
    ec2.create_tags(Resources=[igw_id], Tags=_tag("devops2-igw"))
    ec2.attach_internet_gateway(InternetGatewayId=igw_id, VpcId=vpc_id)
    print(f"  IGW: {igw_id}")
    return igw_id


def ensure_subnet(ec2, vpc_id, cidr, az, name):
    existing = ec2.describe_subnets(Filters=[
        {"Name": "vpc-id", "Values": [vpc_id]},
        {"Name": "cidrBlock", "Values": [cidr]},
    ])
    if existing["Subnets"]:
        sid = existing["Subnets"][0]["SubnetId"]
        print(f"  subnet {name}: {sid} (already exists)")
        return sid
    resp = ec2.create_subnet(VpcId=vpc_id, CidrBlock=cidr, AvailabilityZone=az)
    sid = resp["Subnet"]["SubnetId"]
    ec2.create_tags(Resources=[sid], Tags=_tag(name))
    print(f"  subnet {name}: {sid}")
    return sid


def ensure_route_table(ec2, vpc_id, name):
    existing = ec2.describe_route_tables(Filters=[
        {"Name": "vpc-id", "Values": [vpc_id]},
        {"Name": "tag:Name", "Values": [name]},
    ])
    if existing["RouteTables"]:
        rt_id = existing["RouteTables"][0]["RouteTableId"]
        print(f"  route table {name}: {rt_id} (already exists)")
        return rt_id, True
    resp = ec2.create_route_table(VpcId=vpc_id)
    rt_id = resp["RouteTable"]["RouteTableId"]
    ec2.create_tags(Resources=[rt_id], Tags=_tag(name))
    print(f"  route table {name}: {rt_id}")
    return rt_id, False


def add_route(ec2, rt_id, **kwargs):
    try:
        ec2.create_route(RouteTableId=rt_id, DestinationCidrBlock="0.0.0.0/0", **kwargs)
    except ClientError as e:
        if e.response["Error"]["Code"] != "RouteAlreadyExists":
            raise


def associate_subnet(ec2, rt_id, subnet_id):
    try:
        ec2.associate_route_table(RouteTableId=rt_id, SubnetId=subnet_id)
    except ClientError as e:
        if "Resource.AlreadyAssociated" not in str(e):
            raise


def ensure_nat_gateway(ec2, public_subnet_id):
    existing = ec2.describe_nat_gateways(Filters=[
        {"Name": "subnet-id", "Values": [public_subnet_id]},
        {"Name": "state", "Values": ["available", "pending"]},
    ])
    if existing["NatGateways"]:
        nat_id = existing["NatGateways"][0]["NatGatewayId"]
        print(f"  NAT GW: {nat_id} (already exists)")
        return nat_id

    eip = ec2.allocate_address(Domain="vpc")
    alloc_id = eip["AllocationId"]
    ec2.create_tags(Resources=[alloc_id], Tags=_tag("devops2-nat-eip"))
    state.update(nat_eip_alloc_id=alloc_id)
    print(f"  EIP allocated: {alloc_id}")

    resp = ec2.create_nat_gateway(SubnetId=public_subnet_id, AllocationId=alloc_id)
    nat_id = resp["NatGateway"]["NatGatewayId"]
    ec2.create_tags(Resources=[nat_id], Tags=_tag("devops2-nat"))
    state.update(nat_gateway_id=nat_id)
    print(f"  NAT GW: {nat_id} (provisioning — takes ~2 min)", end="", flush=True)

    for _ in range(24):
        resp = ec2.describe_nat_gateways(NatGatewayIds=[nat_id])
        status = resp["NatGateways"][0]["State"]
        if status == "available":
            print(" done.")
            return nat_id
        if status == "failed":
            raise RuntimeError(f"NAT Gateway {nat_id} failed")
        print(".", end="", flush=True)
        time.sleep(15)
    raise RuntimeError("NAT Gateway did not become available in time")


def main():
    ec2 = aws.ec2_client()

    print("VPC...")
    vpc_id = ensure_vpc(ec2)

    print("Internet Gateway...")
    igw_id = ensure_igw(ec2, vpc_id)

    print("Public subnets...")
    pub_ids = []
    for i, (cidr, az) in enumerate(PUBLIC_SUBNETS, 1):
        sid = ensure_subnet(ec2, vpc_id, cidr, az, f"devops2-public-{i}")
        ec2.modify_subnet_attribute(SubnetId=sid, MapPublicIpOnLaunch={"Value": True})
        pub_ids.append(sid)

    print("Private subnets...")
    priv_ids = []
    for i, (cidr, az) in enumerate(PRIVATE_SUBNETS, 1):
        sid = ensure_subnet(ec2, vpc_id, cidr, az, f"devops2-private-{i}")
        priv_ids.append(sid)

    print("Public route table (→ IGW)...")
    pub_rt, existed = ensure_route_table(ec2, vpc_id, "devops2-rt-public")
    add_route(ec2, pub_rt, GatewayId=igw_id)
    for sid in pub_ids:
        associate_subnet(ec2, pub_rt, sid)

    print("NAT Gateway...")
    nat_id = ensure_nat_gateway(ec2, pub_ids[0])

    print("Private route table (→ NAT GW)...")
    priv_rt, existed = ensure_route_table(ec2, vpc_id, "devops2-rt-private")
    add_route(ec2, priv_rt, NatGatewayId=nat_id)
    for sid in priv_ids:
        associate_subnet(ec2, priv_rt, sid)

    state.update(
        vpc_id=vpc_id,
        igw_id=igw_id,
        public_subnet_ids=pub_ids,
        private_subnet_ids=priv_ids,
        public_rt_id=pub_rt,
        private_rt_id=priv_rt,
        nat_gateway_id=nat_id,
    )

    print(f"\nDone.")
    print(f"  VPC:             {vpc_id}  ({VPC_CIDR})")
    print(f"  Public subnets:  {', '.join(pub_ids)}")
    print(f"  Private subnets: {', '.join(priv_ids)}")
    print(f"  NAT Gateway:     {nat_id}")
    print(f"\nNext: python 00_create_certificate.py")


if __name__ == "__main__":
    try:
        main()
    except ClientError as e:
        print(f"\nAWS error: {e.response['Error']['Code']} — {e.response['Error']['Message']}")
        sys.exit(1)
    except RuntimeError as e:
        print(f"\nError: {e}")
        sys.exit(1)
