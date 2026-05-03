import os
import subprocess

from utils import state

# work/react-frontend relative to src/modules/frontend/
_here = os.path.dirname(os.path.abspath(__file__))
_auto = os.path.normpath(os.path.join(_here, "..", "..", ".."))
FRONTEND_PATH = os.path.normpath(os.path.join(_auto, "..", "react-frontend"))
DIST_PATH = os.path.join(FRONTEND_PATH, "dist")


def build(api_url=None, dashboard_token=None):
    """Run npm run build in the frontend directory with the correct env vars."""
    if not os.path.isdir(FRONTEND_PATH):
        raise RuntimeError(f"Frontend not found at {FRONTEND_PATH}")

    # Prefer ALB DNS (port 80) over direct EC2 IP (port 3000)
    if not api_url:
        alb = state.get("alb_dns")
        ip  = state.get("master_public_ip")
        if alb:
            api_url = f"http://{alb}"
        elif ip:
            api_url = f"http://{ip}:3000"
        else:
            raise RuntimeError("No API URL — run 05_deploy_cloudformation.py or 01_create_master.py first")

    dashboard_token = dashboard_token or os.environ.get("DASHBOARD_TOKEN", "dev-token-change-me")

    print(f"  api url: {api_url}")
    print(f"  building frontend...")

    env = {**os.environ, "VITE_API_URL": api_url, "VITE_DASHBOARD_TOKEN": dashboard_token}
    try:
        subprocess.run(
            ["npm", "run", "build"],
            cwd=FRONTEND_PATH,
            env=env,
            check=True,
        )
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Frontend build failed (exit {e.returncode})") from None
    except FileNotFoundError:
        raise RuntimeError("npm not found — install Node.js locally to build the frontend") from None

    if not os.path.isdir(DIST_PATH):
        raise RuntimeError(f"Build succeeded but dist/ not found at {DIST_PATH}")

    print(f"  build complete: {DIST_PATH}")
    return DIST_PATH
