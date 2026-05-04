#!/usr/bin/env python3
"""
GET /api/v1/system/whoami every 1 second for 5 minutes; print each response body.

Base URL from LOAD_TEST_BASE_URL / devops2-state.json (alb). Token from .env
(DASHBOARD_TOKEN). TLS verification off by default (--verify-ssl to enable).
"""
from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

AUTO_DIR = Path(__file__).resolve().parent.parent
if str(AUTO_DIR) not in sys.path:
    sys.path.insert(0, str(AUTO_DIR))

from utils.dotenv import load_dotenv

STATE_PATH = AUTO_DIR / "devops2-state.json"

load_dotenv()

DURATION_SEC = 300.0
INTERVAL_SEC = 1.0
PATH = "/api/v1/system/whoami"


def default_base_url() -> str | None:
    env = os.environ.get("LOAD_TEST_BASE_URL") or os.environ.get("DEVOPS2_BASE_URL")
    if env:
        return env.rstrip("/")
    if STATE_PATH.is_file():
        try:
            data = json.loads(STATE_PATH.read_text(encoding="utf-8"))
            host = data.get("alb_dns")
            if host:
                # Prefer HTTPS through the ALB; TLS verification is disabled by default.
                return f"https://{host}".rstrip("/")
        except (OSError, json.JSONDecodeError):
            pass
    return None


def get_token() -> str | None:
    return (
        os.environ.get("LOAD_TEST_TOKEN")
        or os.environ.get("DASHBOARD_TOKEN")
        or os.environ.get("DEVOPS2_TOKEN")
    )


def ssl_client_context_https(base_url: str, verify_tls: bool) -> ssl.SSLContext | None:
    if not base_url.lower().startswith("https:"):
        return None
    if verify_tls:
        return ssl.create_default_context()
    return ssl._create_unverified_context()


def one_request(
    url: str,
    token: str,
    timeout_sec: float,
    ssl_context: ssl.SSLContext | None,
) -> tuple[int, str]:
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {token}"},
        method="GET",
    )
    open_kw: dict[str, object] = {"timeout": timeout_sec}
    if ssl_context is not None:
        open_kw["context"] = ssl_context
    try:
        with urllib.request.urlopen(req, **open_kw) as resp:
            body = resp.read(2**20).decode("utf-8", errors="replace")
            return resp.status, body
    except urllib.error.HTTPError as e:
        body = e.read(2**20).decode("utf-8", errors="replace")
        return e.code, body
    except urllib.error.URLError as e:
        return -1, str(e.reason)


def print_response_body(body: str) -> None:
    s = body.strip()
    if not s:
        print("  (empty body)")
        return
    try:
        parsed = json.loads(s)
        print(json.dumps(parsed, indent=2))
    except json.JSONDecodeError:
        print(body)


def main() -> int:
    parser = argparse.ArgumentParser(description="whoami every 1s for 5 minutes.")
    parser.add_argument(
        "--verify-ssl",
        action="store_true",
        help="Verify TLS certificates (default: off).",
    )
    parser.add_argument("--timeout", type=float, default=30.0)
    args = parser.parse_args()

    base = default_base_url()
    if not base:
        print(
            "Set LOAD_TEST_BASE_URL or ensure devops2-state.json has alb_dns.",
            file=sys.stderr,
        )
        return 2

    token = get_token()
    if not token:
        print(
            f"No bearer token. Set DASHBOARD_TOKEN in {AUTO_DIR / '.env'} "
            "or export LOAD_TEST_TOKEN.",
            file=sys.stderr,
        )
        return 2

    url = f"{base}{PATH}"
    ssl_ctx = ssl_client_context_https(base, args.verify_ssl)

    n = int(DURATION_SEC / INTERVAL_SEC)
    print(
        f"{n} requests, {INTERVAL_SEC:g}s apart, over ~{DURATION_SEC:g}s -> {url}",
        flush=True,
    )
    if base.lower().startswith("https:") and not args.verify_ssl:
        print("TLS verification disabled (pass --verify-ssl to verify certs).", flush=True)

    t0 = time.monotonic()
    ok = err = 0

    for i in range(n):
        code, body = one_request(url, token, args.timeout, ssl_ctx)
        ts = time.strftime("%H:%M:%S")
        print(f"\n--- [{i + 1}/{n}] {ts} HTTP {code} ---", flush=True)
        print_response_body(body)
        if 200 <= code < 300:
            ok += 1
        else:
            err += 1

        if i < n - 1:
            target_next = t0 + (i + 1) * INTERVAL_SEC
            wait = target_next - time.monotonic()
            if wait > 0:
                time.sleep(wait)

    wall = time.monotonic() - t0
    print(f"\nFinished in {wall:.1f}s: {ok} ok, {err} errors.", flush=True)
    return 1 if err else 0


if __name__ == "__main__":
    sys.exit(main())
