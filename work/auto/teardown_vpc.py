"""
Delete the devops2 VPC and all its networking components.

Run AFTER:
  - CloudFormation stack is deleted (removes ALB SGs)
  - teardown_ec2s.py (removes master instance)
  - ElastiCache cluster is deleted

Order matters: NAT Gateway must go first to stop the hourly charge,
then EIP, subnets, IGW, and finally the VPC.
"""

import sys
import time
from botocore.exceptions import ClientError
from utils import aws, state
from utils.dotenv import load_dotenv

load_dotenv()


def delete_nat_gateway(ec2, nat_id):
    try:
        ec2.delete_nat_gateway(NatGatewayId=nat_id)
        print(f"  deleting NAT GW: {nat_id}", end="", flush=True)
        for _ in range(30):
            resp = ec2.describe_nat_gateways(NatGatewayIds=[nat_id])
            if resp["NatGateways"][0]["State"] == "deleted":
                print(" done.")
                return
            print(".", end="", flush=True)
            time.sleep(10)
        raise RuntimeError(f"NAT Gateway {nat_id} did not delete in time")
    except ClientError as e:
        if "NatGatewayNotFound" in e.response["Error"]["Code"]:
            print(f"  NAT GW {nat_id}: already gone")
        else:
            raise


def release_eip(ec2, alloc_id):
    try:
        ec2.release_address(AllocationId=alloc_id)
        print(f"  released EIP: {alloc_id}")
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code in ("InvalidAllocationID.NotFound", "InvalidAddress.NotFound"):
            print(f"  EIP {alloc_id}: already released")
        else:
            raise


def delete_route_tables(ec2, vpc_id):
    rts = ec2.describe_route_tables(Filters=[{"Name": "vpc-id", "Values": [vpc_id]}])
    for rt in rts["RouteTables"]:
        if any(a.get("Main") for a in rt.get("Associations", [])):
            continue
        rt_id = rt["RouteTableId"]
        for assoc in rt.get("Associations", []):
            if not assoc.get("Main"):
                try:
                    ec2.disassociate_route_table(AssociationId=assoc["RouteTableAssociationId"])
                except ClientError:
                    pass
        try:
            ec2.delete_route_table(RouteTableId=rt_id)
            print(f"  deleted route table: {rt_id}")
        except ClientError as e:
            if "InvalidRouteTableID.NotFound" not in e.response["Error"]["Code"]:
                raise


def delete_subnets(ec2, subnet_ids):
    for sid in subnet_ids:
        try:
            ec2.delete_subnet(SubnetId=sid)
            print(f"  deleted subnet: {sid}")
        except ClientError as e:
            code = e.response["Error"]["Code"]
            if code == "InvalidSubnetID.NotFound":
                print(f"  subnet {sid}: already gone")
            elif code == "DependencyViolation":
                print(f"  subnet {sid}: still has dependencies — ensure all instances are terminated")
                raise
            else:
                raise


def delete_igw(ec2, vpc_id, igw_id):
    try:
        ec2.detach_internet_gateway(InternetGatewayId=igw_id, VpcId=vpc_id)
    except ClientError as e:
        if "Gateway.NotAttached" not in str(e) and "InvalidInternetGatewayID.NotFound" not in str(e):
            raise
    try:
        ec2.delete_internet_gateway(InternetGatewayId=igw_id)
        print(f"  deleted IGW: {igw_id}")
    except ClientError as e:
        if "InvalidInternetGatewayID.NotFound" not in e.response["Error"]["Code"]:
            raise


def delete_vpc(ec2, vpc_id):
    # Remove any remaining non-default SGs first
    sgs = ec2.describe_security_groups(Filters=[{"Name": "vpc-id", "Values": [vpc_id]}])
    for sg in sgs["SecurityGroups"]:
        if sg["GroupName"] == "default":
            continue
        try:
            ec2.delete_security_group(GroupId=sg["GroupId"])
            print(f"  deleted SG: {sg['GroupId']}")
        except ClientError:
            pass

    try:
        ec2.delete_vpc(VpcId=vpc_id)
        print(f"  deleted VPC: {vpc_id}")
    except ClientError as e:
        if "InvalidVpcID.NotFound" not in e.response["Error"]["Code"]:
            raise


def main():
    ec2 = aws.ec2_client()
    current = state.read()

    vpc_id      = current.get("vpc_id")
    nat_id      = current.get("nat_gateway_id")
    alloc_id    = current.get("nat_eip_alloc_id")
    igw_id      = current.get("igw_id")
    pub_subnets = current.get("public_subnet_ids") or []
    priv_subnets = current.get("private_subnet_ids") or []

    if not vpc_id:
        print("No VPC in state — nothing to tear down.")
        return

    print(f"Tearing down VPC {vpc_id}...\n")

    if nat_id:
        print("Deleting NAT Gateway (stops hourly charge)...")
        delete_nat_gateway(ec2, nat_id)
        state.update(nat_gateway_id=None)

    if alloc_id:
        print("Releasing Elastic IP...")
        release_eip(ec2, alloc_id)
        state.update(nat_eip_alloc_id=None)

    print("Deleting route tables...")
    delete_route_tables(ec2, vpc_id)
    state.update(public_rt_id=None, private_rt_id=None)

    print("Deleting subnets...")
    delete_subnets(ec2, pub_subnets + priv_subnets)
    state.update(public_subnet_ids=None, private_subnet_ids=None)

    if igw_id:
        print("Deleting Internet Gateway...")
        delete_igw(ec2, vpc_id, igw_id)
        state.update(igw_id=None)

    print("Deleting VPC...")
    delete_vpc(ec2, vpc_id)
    state.update(vpc_id=None)

    print("\nVPC teardown complete.")


if __name__ == "__main__":
    try:
        main()
    except ClientError as e:
        err = e.response["Error"]
        print(f"\nAWS error: {err.get('Code')} — {err.get('Message')}")
        sys.exit(1)
    except RuntimeError as e:
        print(f"\nError: {e}")
        sys.exit(1)
