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

    # Fall back to state then env if args not provided
    api_url = api_url or state.get("master_public_ip") and f"http://{state.get('master_public_ip')}:3000"
    dashboard_token = dashboard_token or os.environ.get("DASHBOARD_TOKEN", "dev-token-change-me")

    if not api_url:
        raise RuntimeError("No API URL — pass one or run 01_create_master.py first")

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
