# Browser check: chain tree: crew per row, recipe switch, "I supply this", badges, collapse, build list, loops
# Run all checks with: .venv/Scripts/python tests/browser/run.py  (see tests/README.md)
from playwright.sync_api import sync_playwright
from common import URL, expect, shot, watch, no_hscroll, finish

def row(page, item):
    return page.locator(".chain__row", has=page.locator(".chain__name strong", has_text=item)).first

def machines_of(page, item):
    return row(page, item).locator(".chain__machines").inner_text().replace("\n", " ")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1360, "height": 900})
    errors = watch(page)
    page.goto(URL)
    page.click("text=1 Spark Workbench making Crafty Spark")
    page.wait_for_selector(".chain__row")

    # A crew per row: 2 Crafty on Sawn Timber only changes that row.
    before = machines_of(page, "Sawn Timber")
    row(page, "Sawn Timber").locator(".chain__crew select").select_option("2-crafty")
    after = machines_of(page, "Sawn Timber")
    print(f"rows={page.locator('.chain__row').count()} Sawn Timber machines {before!r} -> with 2 Crafty {after!r}")
    expect(before != after, "crew change didn't change machines")

    # Recipe switch: Raw Distillation drops the Aetheric Pellet chain.
    shard = row(page, "Aether Shard")
    print("Aether Shard options:", shard.locator(".chain__made select option").all_inner_texts())
    shard.locator(".chain__made select").select_option("aetheric-distiller--aether-shard--from-raw-aether")
    page.wait_for_timeout(100)
    expect(page.locator(".chain__name strong", has_text="Aetheric Pellet").count() == 0, "switching recipe didn't remove the pellet chain")

    # I supply this: Wooden Panel stops the chain there.
    row(page, "Wooden Panel").locator(".chain__supply input").check()
    page.wait_for_timeout(100)
    print("outside the chain:", page.locator(".plain-list").first.inner_text().replace("\n", " / "))
    expect(page.locator(".chain__name strong", has_text="Sawn Timber").count() == 0, "supplying Wooden Panel left Sawn Timber in the chain")

    # A badge opens its explanation.
    badge = page.locator(".badge summary").first
    if badge.count():
        text = badge.inner_text()
        badge.click()
        print(f"badge {text!r}:", page.locator(".badge[open] p").first.inner_text()[:90])

    # Collapse and expand, then the build list.
    page.locator(".chain__toggle[aria-expanded=true]").first.click()
    collapsed = page.locator(".chain__row").count()
    page.locator(".chain__toggle[aria-expanded=false]").first.click()
    shot(page, "chain-desktop.png", full=True)
    no_hscroll(page, "desktop")
    page.click("text=Build list")
    print(f"collapsed rows={collapsed}; build list rows={page.locator('table.table tbody tr').count()}")

    # A loop: the default Crafty Spark chain needs an Aether item inside its own chain (with Pellet Refining).
    page = browser.new_page(viewport={"width": 1360, "height": 900})
    errors += watch(page)
    page.goto(URL + "#r=spark-workbench--crafty-spark&n=1")
    page.wait_for_selector(".chain__row")
    loops = page.locator(".chain .tag", has_text="loop:").all_inner_texts()
    print("loop badges:", loops)
    expect(loops, "the Crafty Spark chain shows no loop badge")
    shot(page, "chain-loop.png", full=True)
    expect(not errors, f"console errors: {errors}")
    browser.close()
finish()
