"""Run every browser check against the local server (tools/serve.mjs on a free port).

    .venv/Scripts/python tests/browser/run.py          # Windows
    .venv/bin/python tests/browser/run.py              # macOS / Linux
    .venv/Scripts/python tests/browser/run.py tabs     # only checks whose name contains "tabs"

Needs Node.js 22+ and Python Playwright with Chromium (see CONTRIBUTING.md). Screenshots and
downloaded files go to test-results/browser/ (not committed).
"""
import os, socket, subprocess, sys, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent

def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]

def main():
    only = sys.argv[1] if len(sys.argv) > 1 else ""
    checks = sorted(p for p in HERE.glob("check_*.py") if only in p.stem)
    port = free_port()
    base = f"http://127.0.0.1:{port}/"
    server = subprocess.Popen(["node", str(ROOT / "tools" / "serve.mjs")], cwd=ROOT, env={**os.environ, "PORT": str(port)},
                              stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    try:
        for _ in range(100):
            try:
                urllib.request.urlopen(base, timeout=1)
                break
            except OSError:
                time.sleep(0.1)
        else:
            sys.exit("The dev server didn't start.")
        env = {**os.environ, "BASE_URL": base, "OUT_DIR": str(ROOT / "test-results" / "browser"), "PYTHONIOENCODING": "utf-8"}
        failed = []
        for check in checks:
            print(f"\n=== {check.stem} ===", flush=True)
            if subprocess.run([sys.executable, "-u", str(check)], cwd=ROOT, env=env).returncode != 0:
                failed.append(check.stem)
        print(f"\n{len(checks) - len(failed)} of {len(checks)} browser checks passed." + (f" Failed: {', '.join(failed)}" if failed else ""))
        sys.exit(1 if failed else 0)
    finally:
        server.terminate()

if __name__ == "__main__":
    main()
