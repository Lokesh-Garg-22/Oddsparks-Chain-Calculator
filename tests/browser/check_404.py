# Browser check: a missing page gets 404.html (as on GitHub Pages), which links back to the calculator.
# Run all checks with: .venv/Scripts/python tests/browser/run.py  (see tests/README.md)
from playwright.sync_api import sync_playwright
from common import URL, expect, watch, finish

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    errors = watch(page)
    response = page.goto(URL + "no/such/page")
    print("status:", response.status, "| heading:", page.locator("h1").inner_text(), "| link:", page.get_by_role("link").get_attribute("href"))
    expect(response.status == 404, f"status {response.status}, not 404")
    expect(page.locator("h1").inner_text() == "This page doesn't exist", "not the 404 page")
    page.get_by_role("link", name="Go to the calculator").click()
    page.wait_for_selector(".tabbar__list")
    print("link leads to the calculator:", page.url)
    # The page itself is a 404, and the site-root probe may be too: the browser logs both, as expected.
    unexpected = [e for e in errors if not e.startswith("Failed to load resource")]
    expect(not unexpected, f"console errors: {unexpected}")
    browser.close()
finish()
