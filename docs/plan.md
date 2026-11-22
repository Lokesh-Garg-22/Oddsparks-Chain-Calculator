# Plan

Status: **awaiting "execute the plan"**. Details referenced here live in the other docs.

## 1. Goal and scope

- Pick a building (every building with recipes, 28 in the 2026-11-22 snapshot), one of its recipes, a machine count and a spark crew.
- See the full upstream chain down to raw resources, with machine counts (exact and rounded up), rates, byproducts and warnings.
- Keep several calculations open as tabs, save them into a library with nested folders, export to Excel, and share by link.

## 2. Stack

| Part | Choice | Why |
|---|---|---|
| Hosting | GitHub Pages, deploying `site/` via the official Pages Action | Static, free; no build, the workflow just uploads the folder |
| UI | Preact 10.29.8 + htm 3.1.1, saved into `site/vendor/` | Small (~4 KB). Handles tabs, tree and menus without inputs losing focus. No build step, no CDN needed at runtime |
| Excel | ExcelJS 4.4.0, loaded on first export | Cell styling and formulas; costs nothing until used |
| Code | Native JS modules + JSDoc with `// @ts-check` | Type hints in VS Code without compiling |
| Tests | `node --test` (built in) | No dependencies |
| Data tools | Node 22 scripts (built-in `fetch`) | Same language as the site, no packages |
| Browser tests | `webapp-testing` skill (Python Playwright), for development only | Real UI checks and screenshots |

**Compared with plain vanilla JS:** fine for a single calculator, but the tabs and library pushed it over. **Compared with Vite + React + TypeScript:** adds a build, `node_modules` and a deploy pipeline without enough benefit at this size.

## 3. Folder structure

```
/
├─ site/                         # published to GitHub Pages
│  ├─ index.html
│  ├─ css/styles.css             # tokens on :root, light + dark
│  ├─ vendor/                    # preact, htm (pinned, with licences)
│  ├─ js/
│  │  ├─ main.js                 # startup, app shell
│  │  ├─ engine/                 # calc.js, recipes.js, crews.js — pure, no DOM
│  │  ├─ data/load.js            # merges oddsparks.json + overrides.json, checks shape
│  │  ├─ state/                  # app state, url.js (share links)
│  │  ├─ storage/                # session.js (open tabs), library.js (tabs + nested folders), prefs.js
│  │  ├─ export/excel.js         # loads ExcelJS on demand
│  │  └─ ui/                     # header, tabbar, picker, recipes, tree, buildlist, columns,
│  │                             # library, menus, dialogs, badges, settings
│  ├─ data/                      # oddsparks.json (generated), overrides.json (hand-edited),
│  │                             # extraction-report.md, LICENSE-DATA.md
│  └─ icons/                     # *.png + CREDITS.md
├─ docs/                         # project context (this folder)
├─ tools/                        # extract-wiki.mjs, download-icons.mjs, validate-data.mjs
├─ tests/                        # engine, recipes, storage, export, data
├─ .github/workflows/pages.yml
├─ .claude/skills/               # webapp-testing, frontend-design (official), update-game-data (ours)
├─ CLAUDE.md
├─ package.json                  # scripts only: test, extract, validate, serve
├─ README.md                     # usage, data updates, credits (wiki, icons, piratespark), licences
└─ LICENSE                       # MIT
```

## 4. Data schema

Generated file `site/data/oddsparks.json`: `meta` (game version, extraction date, source, licence), `items`, `buildings`, `recipes`. Each recipe has:
- `building`, `duration`, `inputs[]`, `outputs[]` (with optional `odds`)
- `usesFuel`, `randomised`, `cycles`, `optimalTemperature`, `unlock`
- `source` (page, revision ID, other page it appears on, `match` or `conflict`) and `status` (`verified`, `unverified` or `conflict`)

Hand-edited file `site/data/overrides.json`:
- `displayName` (in-game names, e.g. `wooden-log` → "Timber") and `aliases`
- `defaultRecipe`, `raw` items, the `sparkCrews` table
- corrections (each with a reason and source)
- `confirmed` flags

Example (real wiki values):

```jsonc
"sawbench--sawn-timber": {
  "name": "Sawn Timber", "building": "sawbench", "duration": 16,
  "inputs":  [ { "item": "wooden-log",  "amount": 2 } ],
  "outputs": [ { "item": "sawn-timber", "amount": 1, "odds": null } ],
  "usesFuel": false, "randomised": false, "cycles": null, "optimalTemperature": -3,
  "unlock": { "quest": "Woodcraft - 1 - Tier 1", "npc": "Woodsman" },
  "source": { "page": "Sawbench", "revid": "<at extraction>", "alsoOn": ["Sawn Timber"], "crossCheck": "match" },
  "status": "verified"
}
```

## 5. Calculation rules

See [game-mechanics.md](game-mechanics.md).

- Items per minute by default (toggle to per second). 2 decimals, or 1 decimal "like the game".
- Machines exact and rounded up, per building + recipe pair.
- Crew per row, defaulting to the global crew (**2 Stumpy** out of the box).
- English only for v1. Future ideas: [ROADMAP.md](../ROADMAP.md).
- Git: one commit per build step onto `main`, after the owner approves.
- Recipe switch per item.
- "I supply this" stops the chain at that item.
- Badges: fuel, unverified, conflict, random output, cycles, loop.
- Byproducts are listed but don't reduce other demand (v1).
- Loops are detected, cut and flagged.

## 6. UI

The mockup is listed in [reference.md](reference.md).

1. **Header**
   - title, data version, Library button
   - settings: unit, decimals, default crew, theme (system/light/dark)
   - Copy share link
2. **Tab bar**
   - open calculations, unsaved dot, close ×, double-click to rename, + new tab
3. **Saved library** (side panel; a drawer on phones)
   - search
   - nested folder tree with counts, collapse/expand
   - drag and drop, plus ··· menus (tab: Open, Rename, Duplicate, Move to…, Export, Delete; folder: New subfolder, Rename, Move to…, Export folder, Delete)
   - Move to… dialog with a folder tree
   - New folder
   - Back up / Restore
   - "saved in this browser only" note
4. **Target panel**
   - building picker: search matches building names and item names, including in-game names and aliases ("tim" finds Timber and Sawn Timber); grouped by category; icons
   - recipe cards (inputs → outputs, base time, unlock quest, badges)
   - machine count, crew
5. **Tab toolbar**
   - name, folder path, unsaved status
   - Save, Save as…
   - Export to Excel menu: this tab / folder / whole library
6. **Summary:** machines per building, raw inputs, output rate.
7. **Production chain**
   - **Chain tree** view: expandable rows, recipe switch, crew, exact → rounded, "I supply this", badges with hover/tap details, combined rows where several branches need the same item
   - **Build list** view: sortable
   - **Columns** menu: optional columns based on the spreadsheet, remembered per browser
8. **Byproducts & surplus** panel and **Warnings** panel.
9. **Banners:**
   - saved with older data (missing recipe → offer a replacement)
   - storage unavailable (private browsing)
   - restore result
10. **Dialogs:** unsaved changes on close; delete folder (move contents up, or delete them); restore (merge or replace).
11. **Empty state:** "Pick a building to see its chain" on first visit, with example chains to open.
12. **Footer:** wiki CC BY-SA credit; "Oddsparks © THQ Nordic AB. Developed by Massive Miniteam, published by HandyGames."; trademark line; not affiliated or endorsed; piratespark credit; icon credits; report a data error (GitHub issue); data version.

Works at phone width (rows become cards, the library becomes a drawer). Light and dark themes. Keyboard accessible, with visible focus and touch targets of at least 44 px.

## 7. Build steps

Each step can be reviewed on its own. Docs are updated at the end of every step.

1. **Repo setup:**
   - `site/` and other folders
   - README with credits, linking to ROADMAP.md and CONTRIBUTING.md
   - `CONTRIBUTING.md`, `LICENSE-DATA.md`, `.gitignore`, `package.json` scripts
   - ~~install the official skills into `.claude/skills/`, plus Python Playwright~~ (done 2026-11-22, before step 1)
2. **Wiki extractor:** generates `oddsparks.json` and the extraction report. *Review:* the report, spot checks against the wiki.
3. **Icon download** + `CREDITS.md`. *Review:* licences.
4. **`overrides.json` + `validate-data.mjs`:** crew table, in-game names (Timber), defaults, raw items. End with a first real test run of the `update-game-data` skill.
5. **Engine + tests:** worked example, Logger cross-check, the owner's 3 spreadsheets, loops, byproducts, cycles, random outputs.
6. **App shell with Preact:** picker (search incl. aliases), recipe cards, count, crew, summary, build list.
7. **Chain tree:** crew per row, recipe switch, "I supply this", badges and details, combined rows.
8. **Columns menu, settings (unit, decimals, theme), share link, byproducts and warnings panels, empty state, phone layout, dark mode.** Visual pass with `frontend-design`.
9. **Tabs + sessionStorage:** tab bar, new/close/rename, unsaved dot, confirm on close.
10. **Saved library:** nested folders, drag and drop, ··· menus, Move to… dialog, search, back up/restore, old-data banner, storage-unavailable fallback. Plus storage tests.
11. **Excel export:** tab, folder or library; the owner's layout with formulas; Summary sheet. Test that recreates the owner's Wooden Blade sheet.
12. **Deploy:** Pages workflow, README section on updating data, `update-game-data` skill, browser tests with `webapp-testing`. The site goes live once the repo is made public (free Pages needs a public repo).
13. **(Optional) Game-file extraction:** a guide for the owner (UE4SS → `.usmap` → FModel), then a merge script that adds the extracted values as a second source.

## 8. Risks and open decisions

- **Byproducts and loops make simple tree expansion inexact.** v1 uses tree expansion (decided); a proper solver is a possible v2.
- **Wiki errors, staleness and wrong names:** handled with the extraction report, badges and overrides. Game files would fix this properly.
- **Assumptions U5 (cycles) and U6 (random outputs) change results.** They're shown openly in the UI.
- **Icon licences:** recorded for each file; icons with a restrictive licence fall back to text.
- **Browser storage:** it's per browser and can be cleared, so back up/restore is a first-class feature. Old data is handled by `dataVersion`.
- **ExcelJS unmaintained since 2023.** Fallback: SheetJS (without styling).
- **Game-file extraction:** the game's licence question is the owner's to decide.
- **Decided at the end of the project:** whether optional step 13 is in scope.
