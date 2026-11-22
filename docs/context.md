# Context

## What this is

A static website for *Oddsparks: An Automation Adventure*. You pick a production building, one of its recipes and how many of that building you want to run. The site then shows every upstream building, and how many of each, needed to keep them fully supplied, down to raw resources.

You can keep several calculations open as tabs, save them into a library organised in nested folders, and export them to Excel in a layout based on the owner's own spreadsheet.

- Hosting: GitHub Pages, static, no backend.
- Stack: Preact + htm saved into the repo (no build step), ExcelJS loaded on demand, Node scripts for data extraction and tests. See [plan.md](plan.md).
- Data: the Oddsparks Wiki (wiki.gg) snapshot of 2026-11-22, game 1.0 (Epic build `1.0.S31387`). See [data-sources.md](data-sources.md).

## Status (2026-11-22)

- **Phase: building.** Owner said "execute the plan" on 2026-11-22.
- **Step 2 (wiki extractor): done, awaiting the owner's review before commit.**
  - `npm run extract` (live) and `-- --offline` (from the cached snapshot)
  - first data: 154 recipes, 28 buildings, 98 items, data version `wiki-2026-11-22-aedf0458`
  - 12 recipes where pages disagree, 0 with missing values
  - the report is in `site/data/extraction-report.md`
  - 24 tests pass
  - reviewed with `security-review` (no findings; hardening applied), `code-review` (none) and `simplify` (data-shape and ID-stability fixes)
- **Step 1 (repo setup): committed** (`1ec6d54`). Added:
  - README, CONTRIBUTING, `site/` skeleton with a placeholder page and design tokens (light + dark)
  - data licence and icon credits
  - `package.json` (scripts `serve` and `test` only, no dependencies) and a zero-dependency dev server (`tools/serve.mjs`)
  - `.gitattributes` (LF), `.editorconfig`, `jsconfig.json`
  - 5 tests (pass)
  - checked in a real browser: light, dark and phone, no console errors
  - reviewed with `code-review` (no findings) and `simplify` (fixes applied, see decisions)
- Done:
  - wiki data check (132 pages, 479 recipe blocks, 28 buildings with recipes)
  - game archives checked: not encrypted
  - owner's spreadsheet analysed
  - UI mockup made, then checked against every UI item in plan section 6 (7 screens)
  - docs created
  - skills set up in `.claude/skills/` (webapp-testing, frontend-design, update-game-data), Playwright + Chromium in `.venv/`
- Confirmed from the owner's in-game readings: base craft time = 1 Stumpy, 2 Stumpy = ×2, 2 Crafty = ×3, harvesters speed up with sparks.

## Next step

Owner reviews step 2 → commit → **step 3: icon download** (`tools/download-icons.mjs` + `site/icons/CREDITS.md` with each file's licence). See [plan.md](plan.md#7-build-steps).

## Open questions for the owner

- None blocking.
- Site name: undecided (working title "Oddsparks Chain Calculator").
- Optional step 13 (game-file extraction): decided at the end of the project.
