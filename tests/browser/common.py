"""Shared setup for the browser checks: where the site is, where output goes, and how problems are
collected and reported. run.py sets BASE_URL and OUT_DIR; each check imports what it needs."""
import os, sys

URL = os.environ["BASE_URL"]
OUT = os.environ["OUT_DIR"]
os.makedirs(OUT, exist_ok=True)

# A phone: iPhone-sized, touch, high density.
PHONE = dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)

problems = []

def expect(cond, msg):
    if not cond:
        problems.append(msg)

def shot(page, name, full=False):
    page.screenshot(path=os.path.join(OUT, name), full_page=full)

def watch(page):
    """Collect console errors and uncaught exceptions; the caller reports them at the end."""
    errors = []
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("pageerror", lambda e: errors.append(str(e)))
    return errors

def no_hscroll(page, label):
    width = page.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
    print(f"{label} scroll", width)
    expect(width[0] <= width[1], f"{label}: horizontal scroll")

def finish():
    print("PROBLEMS:", problems or "none")
    sys.exit(1 if problems else 0)
