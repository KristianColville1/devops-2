import os

from utils.dotenv import load_dotenv
from utils import aws

load_dotenv()

REGION = aws.REGION

KEY_NAME = os.environ.get("KEY_NAME", "devops2-key")
PEM_FILE = os.environ.get("PEM_FILE", f"{KEY_NAME}.pem")
# Amazon Linux 2, us-east-1 — update BASE_AMI_ID in .env if the academy rotates this
BASE_AMI = os.environ.get("BASE_AMI_ID", "ami-02dfbd4ff395f2a1b")
INSTANCE_TYPE = os.environ.get("INSTANCE_TYPE", "t2.micro")
# Placeholder only — real token is injected by the launch template on production instances
DASHBOARD_TOKEN = os.environ.get("DASHBOARD_TOKEN", "dev-token-change-me")

AMI_NAME_PREFIX = "kc"
SG_NAME = "devops2-master-sg"
APP_DIR = "/home/ec2-user/app"
APP_PORT = 3000

# Three levels up from src/modules/master_ami/ lands at work/auto/
_auto = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
BACKEND_PATH = os.path.normpath(os.path.join(_auto, "..", "node-backend"))
