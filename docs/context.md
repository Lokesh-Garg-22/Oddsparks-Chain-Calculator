# Context

## What this is

A static website for *Oddsparks: An Automation Adventure*. You pick a production building, one of its recipes and how many of that building you want to run. The site then shows every upstream building, and how many of each, needed to keep them fully supplied, down to raw resources.

You can keep several calculations open as tabs, save them into a library organised in nested folders, and export them to Excel in a layout based on the owner's own spreadsheet.

- Hosting: GitHub Pages, static, no backend.
- Stack: Preact + htm saved into the repo (no build step), ExcelJS loaded on demand, Node scripts for data extraction and tests. See [plan.md](plan.md).
- Data: the Oddsparks Wiki (wiki.gg) snapshot of 2026-11-22, game 1.0 (Epic build `1.0.S31387`). See [data-sources.md](data-sources.md).

## Status (2026-11-22)

- **Phase: building.** Owner said "execute the plan" on 2026-11-22.
- **Step 11 (Excel export): done, awaiting the owner's review before commit.**
  - Export to Excel from the toolbar (this tab), a saved tab's or folder's ··· menu, or the whole library
  - the owner's layout A–W with live formulas and their values, 3 input slots, frozen header, then a Summary sheet with credits
  - ExcelJS 4.4.0 vendored (bare build), loaded only on export
  - test recreates the owner's Wooden Blade sheet; every formula is checked against its value
  - reviewed with `code-review` (1 fix) and `simplify` (fixes applied, see decisions)
  - 105 tests pass; `validate` passes; checked in a real browser (downloaded files opened and checked), no console errors
- **Step 10 (saved library): committed** (`21ade2e`).
  - Library column (a drawer on narrower screens): search, nested folders with counts, collapse, drag and drop, ··· menus (open, rename, duplicate, move to…, delete; new subfolder), Move to… dialog, back up and restore (add or replace)
  - toolbar above the results: name, folder, unsaved state, Save, Save as…
  - saved with older data: what's missing is named, and a removed recipe opens on its building to pick a replacement
  - asks before closing the browser tab with unsaved work; storage-blocked and restore messages
- **Step 9 (tabs): committed** (`e3a64b3`).
  - tab bar in the header: new, switch, close (asks when there are changes), rename (double-click or F2), unsaved dot
  - open tabs kept in sessionStorage: a reload keeps them
  - share links open as a tab; anything a link or stored tab lost is named on that tab until dismissed
- **Step 8 (columns, settings, share link, panels, phone): committed** (`63a0eeb`).
  - Columns menu on the build list (9 extra columns from the owner's spreadsheet, hidden by default), from one column registry the Excel export will reuse
  - Settings: rate unit, decimals (incl. "1, like the game"), default crew, theme (system/light/dark), remembered per browser
  - Copy share link; old links survive renamed ids and name what's missing
  - Byproducts and spare capacity panel; Warnings panel
  - compact phone cards with "Change"; data version and "Report a data error" in the footer
- **Step 7 (chain tree): committed** (`7a1735e`).
  - expandable tree with crew per row, recipe switch, "I supply this", and badges that explain themselves; shared rows show their part; Chain tree / Build list switch; phone cards
- **Step 6 (app shell): committed** (`217f3d0`).
  - the calculator runs in the browser: building search (with in-game names), recipe cards, count, crew, "You need" tiles, raw inputs, loop note, build list, first-visit examples
  - Preact and htm vendored, fonts self-hosted, no third-party requests
  - checked in a real browser (light, dark, phone)
  - 66 unit tests pass (new: calc state updaters, formatter)
  - reviewed with `code-review` (2 fixes) and `simplify` (tab-shaped state, prefs and formatter, shared vocabulary, 64 px icons, preloading)
- **Step 5 (calculation engine): committed** (`fae83c7`).
  - `site/js/engine/calc.js`: `calculate()` returns rows per recipe (each input with its source), raw, loops, byproducts and warnings; `chainTree()` derives the tree
  - `howMade()` in `recipes.js` holds the chain-stop rule
  - 61 tests pass: worked example, Logger check, the owner's 3 spreadsheets and readings, loops, byproducts, odds, cycles, crew per row, "I supply this"
  - reviewed with `code-review` (2 robustness fixes) and `simplify` (graph-shaped result, single rate formulas)
- **Step 4 (overrides + validation): committed** (`4c90416`).
  - `site/data/overrides.json`:
    - spark crew table with status and source; default crew 2 Stumpy
    - Timber as the in-game name
    - your 4 in-game readings recorded as confirmations
    - one duplicate recipe merged (Fireshroom printing)
  - `site/js/data/merge.js` applies overrides; it is shared by the app and the validator
  - `site/js/engine/recipes.js` holds the default-recipe rule
  - `npm run validate` (`tools/validate-data.mjs`)
  - first full run of the `update-game-data` workflow against the live wiki: no recipe changes
  - 43 tests pass, including the owner's readings
  - reviewed with `code-review` (3 robustness fixes) and `simplify` (per-item resolution, renames per kind, problems by path)
- **Step 3 (icons): committed** (`1d620aa`). Icon use on this basis confirmed by the owner.
  - `npm run icons`: 125 icons at 128 px (~1.7 MB); Tailor's Tent has none on the wiki
  - `site/icons/CREDITS.md` credits each file to its uploader, with © THQ Nordic
  - the extractor now also records each page's infobox image
  - shared `tools/paths.mjs`
  - 30 tests pass
  - reviewed with `code-review` (3 fixes) and `simplify` (licence policy made consistent, simpler bookkeeping)
- **Step 2 (wiki extractor): committed** (`8d6c681`).
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

Owner reviews step 11 → commit → **step 12**: deploy (GitHub Pages workflow, `404.html`, README section on updating data, browser tests with `webapp-testing`, `security-review`). The site goes live once the repo is made public. See [plan.md](plan.md#7-build-steps).

## Open questions for the owner

- None blocking.
- Aether Shard default recipe: Pellet Refining (earliest unlock) pulls a looping Aether chain into beginner recipes; the owner may set a different default (asked 2026-11-22).
- Site name: undecided (working title "Oddsparks Chain Calculator").
- Optional step 13 (game-file extraction): decided at the end of the project.
