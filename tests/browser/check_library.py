# Browser check: saved library: save, folders, move, search, drag, delete, back up/restore, older data, beforeunload, phone drawer
# Run all checks with: .venv/Scripts/python tests/browser/run.py  (see tests/README.md)
import os, json
from playwright.sync_api import sync_playwright
from common import URL, OUT, PHONE, problems, expect, shot, watch, no_hscroll, finish

def tree(page): return [t.strip().replace("\n", " ") for t in page.locator(".lib__tree .lib__row").all_inner_texts()]
def status(page): return page.locator(".toolbar__text p").inner_text().strip()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 950}, accept_downloads=True)
    page = ctx.new_page()
    errors = watch(page)

    page.goto(URL); page.wait_for_selector(".tabbar__list")
    page.get_by_role("button", name="3 Wood Workshops making Wooden Blade").click()
    page.wait_for_selector(".toolbar")
    print("toolbar before save:", status(page))
    expect(status(page) == "Not saved yet", "toolbar status before save")

    # Save → Save as dialog (never saved)
    page.locator(".toolbar").get_by_role("button", name="Save", exact=True).click()
    dlg = page.locator("dialog.dialog")
    dlg.get_by_label("Name").fill("Blade line")
    dlg.get_by_role("button", name="Save", exact=True).click()
    print("after save:", status(page), "| tab:", page.locator(".tab.is-active .tab__label").inner_text(), "| dots", page.locator(".tabbar .tab__dot").count())
    expect(status(page) == "In your library, saved" and page.locator(".tabbar .tab__dot").count() == 0, "save didn't take")

    # Library: new folder, rename, move the tab into it
    page.get_by_role("button", name="Library").click()
    page.wait_for_selector(".library")
    page.get_by_role("button", name="New folder").click()
    page.locator(".lib__rename").fill("Early game wood")
    page.keyboard.press("Enter")
    page.get_by_role("button", name="More for Blade line").click()
    page.get_by_role("button", name="Move to…").click()
    dlg.get_by_label("Early game wood").check()
    dlg.get_by_role("button", name="Move here").click()
    print("tree after move:", tree(page), "| toolbar:", status(page))
    expect(status(page) == "In Early game wood, saved", "toolbar path after move")

    # Edit → unsaved; Save saves over
    page.locator(".target__controls input[type=number]").fill("4")
    page.wait_for_timeout(100)
    print("after edit:", status(page), "| dots", page.locator(".tabbar .tab__dot").count())
    expect("unsaved changes" in status(page), "edit didn't mark unsaved")
    page.locator(".toolbar").get_by_role("button", name="Save", exact=True).click()
    expect(status(page) == "In Early game wood, saved", "save over failed")

    # Duplicate, rename, search, delete
    page.get_by_role("button", name="More for Blade line").click()
    page.get_by_role("button", name="Duplicate").click()
    page.get_by_role("button", name="More for Blade line (copy)").click()
    page.get_by_role("button", name="Rename").click()
    page.locator(".lib__rename").fill("Copper idea")
    page.keyboard.press("Enter")
    page.get_by_label("Search saved tabs").fill("copper")
    print("search 'copper':", tree(page))
    expect(any("Copper idea" in t for t in tree(page)) and not any(t.startswith("Blade line") for t in tree(page)), "search wrong")
    page.get_by_label("Search saved tabs").fill("")

    # Drag the copy out of the folder
    src = page.locator(".lib__row", has=page.get_by_role("button", name="Copper idea"))
    src.hover(); page.mouse.down()
    page.locator(".lib__tree").hover()
    page.wait_for_timeout(50)
    drop = page.locator(".lib__drop")
    if drop.count():
        drop.hover(); page.mouse.up()
    else:
        page.mouse.up()
    # Fallback: Playwright's HTML5 drag helper
    if not any(t.startswith("Copper idea") for t in tree(page)[-1:]):
        src.drag_to(page.locator(".lib__row", has=page.get_by_role("button", name="Early game wood")))
    print("tree after drag:", tree(page))
    shot(page, "s10-library.png")

    # Delete folder with contents: keep contents
    page.get_by_role("button", name="More for folder Early game wood").click()
    page.get_by_role("button", name="Delete").click()
    print("delete-folder dialog:", dlg.inner_text().replace("\n", " / "))
    shot(page, "s10-delete-folder.png")
    dlg.get_by_role("button", name="Keep its contents, delete the folder").click()
    print("tree after folder delete:", tree(page))
    expect(not any("Early game wood" in t for t in tree(page)), "folder still there")

    # Back up, then restore (merge)
    with page.expect_download() as dl:
        page.get_by_role("button", name="Back up library").click()
    path = os.path.join(OUT, "backup.json")
    dl.value.save_as(path)
    backup = json.load(open(path, encoding="utf-8"))
    print("backup:", backup["format"], len(backup["library"]["tabs"]), "tabs")
    page.locator(".library input[type=file]").set_input_files(path)
    dlg.get_by_role("button", name="Add to my library").click()
    print("after restore:", page.locator(".library .notice").first.inner_text().split("\n")[0], "| rows", len(tree(page)))
    bad = os.path.join(OUT, "bad.json"); open(bad, "w").write("{}")
    page.locator(".library input[type=file]").set_input_files(bad)
    print("bad restore:", page.locator(".library .notice").first.inner_text().split("\n")[0])

    # Delete the saved tab that is open: the open tab keeps its contents, unsaved
    page.get_by_role("button", name="More for Blade line").first.click()
    page.get_by_role("button", name="Delete").click()
    dlg.get_by_role("button", name="Delete").click()
    print("open tab after its saved copy was deleted:", status(page), "| dots", page.locator(".tabbar .tab__dot").count())

    # Reload keeps library and tabs; beforeunload asks when there's unsaved work
    page.reload(); page.wait_for_selector(".tabbar__list")
    page.get_by_role("button", name="Library").click()
    print("after reload, library rows:", len(tree(page)))

    # Saved with older data: a tab whose recipe was removed
    page.evaluate("""() => {
      const lib = JSON.parse(localStorage.getItem('oddsparks-calc:v1:library'));
      lib.tabs.t_old = { id: 't_old', name: 'Old saw', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z', dataVersion: 'wiki-old',
        calc: { building: 'sawbench', recipe: 'sawbench--retired-plank', count: 2, crews: {}, recipeChoice: {}, supplied: [] } };
      lib.root.push('t_old');
      localStorage.setItem('oddsparks-calc:v1:library', JSON.stringify(lib));
    }""")
    page.reload(); page.wait_for_selector(".tabbar__list")
    page.get_by_role("button", name="Library").click()
    page.get_by_role("button", name="Old saw", exact=True).click()
    print("old data banner:", page.locator(".layout__banner p").inner_text())
    expect("Sawbench" in page.locator(".layout__banner p").inner_text(), "old-data banner doesn't offer a replacement")
    shot(page, "s10-old-data.png")

    asked = []
    page.on("dialog", lambda d: (asked.append(d.type), d.dismiss()))
    page.locator(".recipe").first.click()
    page.wait_for_timeout(100)
    page.close(run_before_unload=True)
    page.wait_for_timeout(300)
    print("beforeunload asked:", asked)
    expect("beforeunload" in asked, "no beforeunload prompt with unsaved work")
    if errors: problems.append(f"desktop console errors: {errors}")
    ctx.close()

    # Phone: drawer
    ctx = browser.new_context(**PHONE)
    page = ctx.new_page()
    errors = watch(page)
    page.goto(URL + "#r=sawbench--sawn-timber&n=2"); page.wait_for_selector(".toolbar")
    page.locator(".toolbar").get_by_role("button", name="Save", exact=True).tap()
    page.locator("dialog.dialog").get_by_role("button", name="Save", exact=True).tap()
    page.get_by_role("button", name="Library").tap()
    page.wait_for_selector(".library")
    shot(page, "s10-phone-drawer.png")
    page.locator(".library").get_by_role("button", name="Sawn Timber ×2", exact=True).tap()
    print("phone: drawer closed after opening a tab:", page.locator(".library").count() == 0)
    no_hscroll(page, "phone")
    if errors: problems.append(f"phone console errors: {errors}")
    browser.close()

finish()
