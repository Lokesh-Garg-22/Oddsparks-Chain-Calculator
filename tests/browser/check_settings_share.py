# Browser check: settings, share links, columns menu, side panels, phone cards, dark mode
# Run all checks with: .venv/Scripts/python tests/browser/run.py  (see tests/README.md)
from playwright.sync_api import sync_playwright
from common import URL, PHONE, problems, shot, watch, no_hscroll, finish

BLADE = "#r=wood-workshop--wooden-blade&n=3&c=wood-workshop--wooden-blade:2-stumpy"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # ---- Desktop ----
    ctx = browser.new_context(viewport={"width": 1360, "height": 900})
    ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=URL.rstrip("/"))
    page = ctx.new_page()
    errors = watch(page)

    page.goto(URL + BLADE); page.wait_for_selector(".output", timeout=10000)
    print("hash after load:", repr(page.evaluate("location.hash")))
    if page.evaluate("location.hash"): problems.append("share hash not cleared")
    print("output:", page.locator(".output").inner_text())
    print("footer version:", page.locator("#data-version").inner_text())

    # Settings: default crew 2 Crafty, 1 decimal
    page.get_by_role("button", name="Settings").click()
    page.locator("#settings-menu select").select_option("2-crafty")
    page.get_by_label("1, like the game (11.2)").check(force=True)
    shot(page, "s8-settings.png", full=True)
    page.keyboard.press("Escape")
    print("settings open after Escape:", page.locator("#settings-menu").evaluate("e => e.matches(':popover-open')"))

    # Build list with columns
    page.get_by_role("button", name="Build list").click()
    page.get_by_role("button", name="Columns").click()
    page.get_by_label("Output per machine").check()
    page.get_by_label("Inputs in total").check()
    page.get_by_label("Needed by the chain").check()
    page.keyboard.press("Escape")
    heads = page.locator(".table th").all_inner_texts()
    print("build list headers:", heads)
    sawn = page.locator("tr", has_text="Sawbench: Sawn Timber").inner_text().replace("\t", " | ").replace("\n", " ")
    print("sawn timber row:", sawn)
    if "11.2" not in sawn: problems.append("Sawn Timber output per machine not 11.2 at 1 decimal")
    print("warnings heading:", page.locator("#warnings-h").inner_text())
    print("byproducts panel:", page.locator("section[aria-labelledby=byproducts-h]").inner_text().replace("\n", " / ")[:300])
    shot(page, "s8-buildlist.png", full=True)

    # Share link
    page.get_by_role("button", name="Copy share link").click()
    page.wait_for_timeout(200)
    link = page.evaluate("navigator.clipboard.readText()")
    print("copied link:", link)
    if "v=list" not in link or "r=wood-workshop--wooden-blade" not in link: problems.append("share link incomplete")

    # Prefs persist across reload; theme dark
    page.get_by_role("button", name="Settings").click()
    page.get_by_label("Dark").check(force=True)
    page.wait_for_timeout(100)
    page.keyboard.press("Escape")
    page.goto("about:blank"); page.goto(link); page.wait_for_selector(".output", timeout=10000)
    print("after reload: theme", page.evaluate("document.documentElement.dataset.theme"), "| columns button:", page.get_by_role("button", name="Columns (3 extra)").count())
    if page.evaluate("document.documentElement.dataset.theme") != "dark": problems.append("theme not remembered")
    shot(page, "s8-dark-list.png", full=True)
    page.get_by_role("button", name="Chain tree").click()
    shot(page, "s8-dark-tree.png", full=True)

    # Old link
    page.goto(URL + "#r=gone--recipe&n=2"); page.wait_for_selector(".layout__banner", timeout=10000)
    print("old link banner:", page.locator(".layout__banner").inner_text())
    no_hscroll(page, "desktop")
    if errors: problems.append(f"desktop console errors: {errors}")
    ctx.close()

    # ---- Phone ----
    ctx = browser.new_context(**PHONE)
    page = ctx.new_page()
    errors = watch(page)
    page.goto(URL + "#r=spark-workbench--crafty-spark&n=1"); page.wait_for_selector(".output", timeout=10000)
    rows = page.locator(".chain__row")
    print("phone rows:", rows.count(), "| first visible selects:", page.locator(".chain select:visible").count())
    shot(page, "s8-phone.png", full=True)
    rows.nth(1).get_by_role("button", name="Change").click()
    print("after Change, visible selects:", page.locator(".chain select:visible").count())
    shot(page, "s8-phone-edit.png", full=True)
    page.get_by_role("button", name="Settings").tap()
    shot(page, "s8-phone-settings.png", full=True)
    no_hscroll(page, "phone")
    if errors: problems.append(f"phone console errors: {errors}")
    browser.close()

finish()
