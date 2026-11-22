# Browser check: Excel export: tab, folder and library files, formulas and Summary read back from the .xlsx
# Run all checks with: .venv/Scripts/python tests/browser/run.py  (see tests/README.md)
import os, re, zipfile
from playwright.sync_api import sync_playwright
from common import URL, OUT, problems, expect, watch, finish


def read_xlsx(path):
    """Sheet names, plus each sheet's cells as {ref: (formula, value)} straight from the file's XML."""
    z = zipfile.ZipFile(path)
    names = re.findall(r'<sheet [^>]*name="([^"]+)"', z.read("xl/workbook.xml").decode())
    strings = re.findall(r"<t[^>]*>([^<]*)</t>", z.read("xl/sharedStrings.xml").decode()) if "xl/sharedStrings.xml" in z.namelist() else []
    sheets = {}
    for i, name in enumerate(names, 1):
        xml = z.read(f"xl/worksheets/sheet{i}.xml").decode()
        cells = {}
        for m in re.finditer(r'<c r="([A-Z]+\d+)"([^>]*?)(?:/>|>(.*?)</c>)', xml):
            ref, attrs, inner = m.group(1), m.group(2), m.group(3) or ""
            f = re.search(r"<f>(.*?)</f>", inner)
            v = re.search(r"<v>(.*?)</v>", inner)
            val = v.group(1) if v else None
            if 't="s"' in attrs and val is not None: val = strings[int(val)]
            cells[ref] = (f.group(1) if f else None, val)
        sheets[name] = (cells, xml)
    return names, sheets

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 950}, accept_downloads=True)
    page = ctx.new_page()
    errors = watch(page)
    requests = []
    page.on("request", lambda r: requests.append(r.url))

    # The owner's Wooden Blade sheet: 3 Workshops on 2 Stumpy, the rest 2 Crafty (default crew).
    page.goto(URL + "#r=wood-workshop--wooden-blade&n=3&c=wood-workshop--wooden-blade:2-stumpy")
    page.wait_for_selector(".toolbar")
    page.get_by_role("button", name="Settings").click()
    page.locator("#settings-menu select").select_option("2-crafty")
    page.keyboard.press("Escape")
    expect(not any("exceljs" in u for u in requests), "ExcelJS loaded before any export")

    with page.expect_download() as dl:
        page.get_by_role("button", name="Export to Excel").click()
    path = os.path.join(OUT, dl.value.suggested_filename); dl.value.save_as(path)
    print("downloaded:", dl.value.suggested_filename, "| banner:", page.locator(".layout__banner p").first.inner_text())
    expect(any("exceljs" in u for u in requests), "ExcelJS not loaded on export")
    names, sheets = read_xlsx(path)
    print("sheets:", names)
    cells, xml = sheets[names[0]]
    print("header A1..G1:", [cells.get(f"{c}1", (None, None))[1] for c in "ABCDEFG"])
    rows = {cells[k][1]: int(k[1:]) for k in cells if k.startswith("F") and k != "F1"}
    for item in ["Wooden Blade", "Wooden Panel", "Sawn Timber", "Timber"]:
        n = rows[item]
        print(f"  {item:13} B={cells[f'B{n}'][1]:>6} E={cells[f'E{n}']} G={cells[f'G{n}']} T={cells[f'T{n}'][1]}")
    st = rows["Sawn Timber"]
    expect(cells[f"B{st}"][1] == "11.25", "Sawn Timber p/m isn't 11.25")
    expect(re.fullmatch(r"[KOS]\d+\+[KOS]\d+", cells[f"E{st}"][0] or ""), "Sawn Timber Parts Needed isn't a sum of two cells")
    expect(cells[f"T{st}"] == ("ROUNDUP(G%d,0)" % st, "4"), "Sawn Timber build isn't ROUNDUP → 4")
    expect('ySplit="1"' in xml, "header row not frozen")
    summary = " ".join(v or "" for _, v in sheets["Summary"][0].values())
    expect("CC BY-SA 4.0" in summary and "Machines to build" in summary, "Summary incomplete")

    # Save into a folder, then export the folder and the whole library
    page.locator(".toolbar").get_by_role("button", name="Save", exact=True).click()
    page.locator("dialog.dialog").get_by_role("button", name="Save", exact=True).click()
    page.get_by_role("button", name="Library").click()
    page.get_by_role("button", name="New folder").click()
    page.locator(".lib__rename").fill("Blades: early/mid")
    page.keyboard.press("Enter")
    page.get_by_role("button", name="More for Wooden Blade ×3").click()
    page.get_by_role("button", name="Move to…").click()
    page.locator("dialog.dialog").get_by_label("Blades: early/mid").check()
    page.locator("dialog.dialog").get_by_role("button", name="Move here").click()
    with page.expect_download() as dl:
        page.get_by_role("button", name="More for folder Blades: early/mid").click()
        page.get_by_role("button", name="Export folder to Excel").click()
    fpath = os.path.join(OUT, dl.value.suggested_filename); dl.value.save_as(fpath)
    print("folder export:", dl.value.suggested_filename, read_xlsx(fpath)[0])
    with page.expect_download() as dl:
        page.get_by_role("button", name="Export library to Excel").click()
    lpath = os.path.join(OUT, dl.value.suggested_filename); dl.value.save_as(lpath)
    lnames = read_xlsx(lpath)[0]
    print("library export:", dl.value.suggested_filename, lnames)
    expect(any(n.startswith("Blades- early-mid - ") for n in lnames), "library sheet name not prefixed by its folder")
    page.screenshot(path=os.path.join(OUT, "s11-export.png"))
    if errors: problems.append(f"console errors: {errors}")
    browser.close()

finish()
