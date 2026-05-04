#!/usr/bin/env python3
"""Open many WebSocket clients against the dashboard /ws endpoint (hardcoded URL, no TLS verify)."""
from __future__ import annotations

import argparse
import asyncio
import ssl
import sys
import time

WS_URI = (
    "wss://devops2-alb-1789309391.us-east-1.elb.amazonaws.com/ws"
    "?token=8.LV%3C$^957AdpRELdaDw%ZQYX%3E0c6@ONmakE%3Eiq2"
)

SSL_CTX = ssl._create_unverified_context()


async def hold_one(delay: float, hold_sec: float) -> tuple[bool, str | None]:
    import websockets  # type: ignore[import-not-found]

    await asyncio.sleep(delay)
    try:
        async with websockets.connect(
            WS_URI,
            ssl=SSL_CTX,
            ping_interval=20,
            ping_timeout=60,
            close_timeout=15,
            open_timeout=30,
        ):
            await asyncio.sleep(hold_sec)
        return True, None
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"


async def run_all(n: int, spread: float, hold_sec: float) -> tuple[int, int, list[str]]:
    delays = [(i / max(n - 1, 1)) * spread for i in range(n)] if spread > 0 and n > 1 else [0.0] * n
    out = await asyncio.gather(*[hold_one(d, hold_sec) for d in delays])
    ok = sum(1 for ok_, _ in out if ok_)
    err = n - ok
    samples = [m for ok_, m in out if not ok_ and m][:12]
    return ok, err, samples


def main() -> int:
    p = argparse.ArgumentParser(description="WebSocket load (hardcoded wss URL).")
    p.add_argument("--connections", type=int, default=1000)
    p.add_argument("--duration", type=float, default=300.0, help="seconds each socket stays open")
    p.add_argument("--connect-spread", type=float, default=30.0, help="spread handshakes over this many seconds")
    a = p.parse_args()
    if a.connections < 1:
        print("connections must be >= 1", file=sys.stderr)
        return 2

    spread = max(0.0, a.connect_spread)
    print(f"{a.connections} clients, hold {a.duration}s, spread {spread}s, TLS verify off")
    print(f"-> {WS_URI.split('?', 1)[0]}?token=…")

    t0 = time.monotonic()
    ok, err, samples = asyncio.run(run_all(a.connections, spread, a.duration))
    print(f"Done in {time.monotonic() - t0:.1f}s: {ok} ok, {err} failed.")
    for s in samples:
        print(f"  e.g. {s}")
    return 1 if err else 0


if __name__ == "__main__":
    sys.exit(main())
