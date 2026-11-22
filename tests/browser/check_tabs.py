# Browser check: tabs: new, rename, reload, close dialog, share links opening tabs, phone
# Run all checks with: .venv/Scripts/python tests/browser/run.py  (see tests/README.md)
from playwright.sync_api import sync_playwright
from common import URL, PHONE, problems, expect, shot, watch, no_hscroll, finish

def labels(page): return [t.strip() for t in page.locator(".tab .tab__label, .tab .tab__rename").all_inner_texts()]
def dots(page): return page.locator(".tabbar .tab__dot").count()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1360, "height": 900})
    page = ctx.new_page()
    errors = watch(page)

    page.goto(URL); page.wait_for_selector(".tabbar__list")
    print("fresh:", labels(page), "dots", dots(page))
    expect(labels(page) == ["New calculation"] and dots(page) == 0, "fresh session wrong")

    page.get_by_role("button", name="1 Spark Workbench making Crafty Spark").click()
    page.wait_for_selector(".output")
    page.get_by_role("button", name="New calculation").click()
    page.get_by_role("button", name="3 Wood Workshops making Wooden Blade").click()
    page.wait_for_selector(".output")
    print("two tabs:", labels(page), "dots", dots(page), "| output", page.locator(".output").inner_text())
    expect(labels(page) == ["Crafty Spark ×1", "Wooden Blade ×3"] and dots(page) == 2, "tabs after examples wrong")

    page.locator(".tab__select", has_text="Crafty Spark").click()
    print("switched:", page.locator(".output").inner_text())
    expect("Crafty Spark" in page.locator(".output").inner_text(), "switching tabs didn't change the calc")

    # Rename by double-click; F2 + Escape cancels
    page.locator(".tab__select", has_text="Crafty Spark").dblclick()
    page.locator(".tab__rename").fill("Spark line")
    page.keyboard.press("Enter")
    page.locator(".tab__select", has_text="Wooden Blade").focus()
    page.keyboard.press("F2")
    page.locator(".tab__rename").fill("ignored")
    page.keyboard.press("Escape")
    print("renamed:", labels(page))
    expect(labels(page) == ["Spark line", "Wooden Blade ×3"], "rename wrong")
    shot(page, "s9-tabs.png")

    # Reload keeps everything
    active_before = page.locator(".tab.is-active .tab__label").inner_text()
    page.reload(); page.wait_for_selector(".output")
    print("after reload:", labels(page), "active", page.locator(".tab.is-active .tab__label").inner_text(), "dots", dots(page))
    expect(labels(page) == ["Spark line", "Wooden Blade ×3"], "tabs lost on reload")
    expect(page.locator(".tab.is-active .tab__label").inner_text() == active_before, "active tab lost on reload")

    # Close a dirty tab: dialog, keep, then close
    page.get_by_role("button", name="Close Wooden Blade ×3").click()
    dialog = page.locator("dialog.dialog")
    print("dialog:", dialog.is_visible(), "|", dialog.inner_text().replace("\n", " / "))
    shot(page, "s9-dialog.png")
    page.get_by_role("button", name="Keep it open").click()
    expect(len(labels(page)) == 2 and not dialog.is_visible(), "keep it open failed")
    page.get_by_role("button", name="Close Wooden Blade ×3").click()
    page.keyboard.press("Escape")
    expect(len(labels(page)) == 2, "Escape should keep the tab")
    page.get_by_role("button", name="Close Wooden Blade ×3").click()
    page.get_by_role("button", name="Close tab").click()
    print("after close:", labels(page))
    expect(labels(page) == ["Spark line"], "close failed")

    # Untouched tab closes without asking
    page.get_by_role("button", name="New calculation").click()
    page.get_by_role("button", name="Close New calculation").click()
    expect(page.locator("dialog.dialog").count() == 0 and labels(page) == ["Spark line"], "untouched tab asked or stayed")

    # Pasting a share link opens a new tab, without a dot
    page.evaluate("location.hash = '#r=sawbench--sawn-timber&n=2&c=sawbench--sawn-timber:2-crafty'")
    page.wait_for_function("document.querySelectorAll('.tab').length === 2")
    print("after pasted link:", labels(page), "dots", dots(page), "hash", repr(page.evaluate("location.hash")))
    expect(labels(page) == ["Spark line", "Sawn Timber ×2"] and dots(page) == 1, "pasted link didn't open a clean new tab")

    page.evaluate("location.hash = '#r=gone--recipe&n=1'")
    page.wait_for_selector(".layout__banner")
    print("gone link:", labels(page), "|", page.locator(".layout__banner").inner_text())
    if errors: problems.append(f"desktop console errors: {errors}")
    ctx.close()

    # Fresh browser tab opened from a link: the link replaces the empty tab
    ctx = browser.new_context(viewport={"width": 1360, "height": 900}, color_scheme="dark")
    page = ctx.new_page()
    page.goto(URL + "#r=wood-workshop--wooden-blade&n=3"); page.wait_for_selector(".output")
    for i in range(5):
        page.get_by_role("button", name="New calculation").last.click() if i == 0 else page.locator(".tabbar__new").click()
    print("link in fresh tab:", labels(page))
    shot(page, "s9-dark.png")
    ctx.close()

    # Phone
    ctx = browser.new_context(**PHONE)
    page = ctx.new_page()
    errors = watch(page)
    page.goto(URL + "#r=spark-workbench--crafty-spark&n=1"); page.wait_for_selector(".output")
    for _ in range(4): page.locator(".tabbar__new").tap()
    shot(page, "s9-phone.png")
    no_hscroll(page, "phone")
    if errors: problems.append(f"phone console errors: {errors}")
    browser.close()

finish()
