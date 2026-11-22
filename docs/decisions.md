# Decision log

Newest first. Each entry: date, decision, reason.

## 2026-11-22

- **Site name:** undecided. "Oddsparks Chain Calculator" is a working title, kept in one place in the code so a rename is a one-line change. The repo name "Pirate-Spark-V2" may change before going public.
- **Repo:** `github.com/Lokesh-Garg-22/Pirate-Spark-V2`, private until v1 is done, then public. Free GitHub Pages needs a public repo, so the deploy workflow is set up in step 12 and goes live when the repo is made public. Until then, preview locally.
- **Git workflow:** one commit per build step, straight onto `main`, made only after the owner reviews and approves.
- **Skills** are installed in the project (`.claude/skills/`, committed). Python Playwright plus browser download approved for `webapp-testing`.
- **Default spark crew for new rows: 2 Stumpy (×2)** (owner). Changeable in settings. The mockup's worked example still uses 1 Stumpy.
- **Unlock filter:** later (v1.1). Future ideas live in a public [ROADMAP.md](../ROADMAP.md) so contributors can pick them up and send PRs. Step 1 also adds `CONTRIBUTING.md`.
- **Language:** English only for v1.
- **Footer credit** (source: Steam store page, app 1817800): "Oddsparks © THQ Nordic AB. Developed by Massive Miniteam, published by HandyGames. Oddsparks is a trademark of THQ Nordic AB. Fan-made site, not affiliated with or endorsed by them." Steam lists Developer: Massive Miniteam; Publisher: THQ Nordic Mobile (HandyGames); release 27 May 2025, Early Access 24 Apr 2024. The earlier "Iceberg Interactive" guess was wrong.
- **Byproducts and loops:** simple tree expansion for v1, confirmed by the owner. Byproducts are listed but don't reduce other demand; loops are cut and flagged. A proper solver stays a possible v2.
- **Optional step 13 (game-file extraction):** decided at the end of the project, not now (owner).
- **Folders can nest to any depth** in the saved library (owner). Each folder stores its `parentId`; tabs belong to exactly one folder, or none.
- **Docs folder created now**, before any code, so the planning context isn't lost. `CLAUDE.md` points every session here.
- **Stack: Preact 10.29.8 + htm 3.1.1**, saved into `site/vendor/`, with no build step. Reason: tabs, library tree, drag and drop, the column menu and a dropdown on every row are too much state for hand-written DOM code, and redrawing everything would make inputs lose focus while typing. Preact 11 was skipped because 11.2 was only two weeks old.
- **Excel export uses ExcelJS 4.4.0** (MIT), loaded only when someone clicks Export (~950 KB). SheetJS's free version can't style cells. ExcelJS hasn't released since 2023; SheetJS is the fallback.
- **Tabs feature:** open tabs live in sessionStorage; saved tabs and folders live in one localStorage key. Only inputs are stored, never results. Keys are prefixed `oddsparks-calc:v1:` because every GitHub Pages project under one username shares browser storage. Back up / restore via JSON.
- **Extra columns** (the spreadsheet's Parts Needed, Base Item Needed, Base Item p/m, Item Pieces Needed and others) are hidden by default and can be turned on by the user. The choice is remembered per browser.
- **Excel export follows the owner's spreadsheet layout** (columns A–O, live formulas), adds Building, Recipe, Crew and a ROUNDUP column, has 3 ingredient slots, and includes a Summary sheet. One sheet per tab; a folder exports as one workbook.
- **Display names come from the game.** The wiki's "Wooden Log" is "Timber" in-game. Wiki names are internal IDs; `overrides.json` holds in-game names; search matches both.
- **Owner's in-game readings confirm:** base time = 1 Stumpy; 2 Crafty = ×3 (Logger 90/min, Sawn Timber 11.2/min shown, Wooden Panel 22.5/min); 2 Stumpy = ×2 (Wooden Blade 2.5/min); harvesters speed up with sparks. The game rounds what it shows to 1 decimal (11.25 shows as 11.2).
- **Folder layout:** the published site lives in `site/`, deployed by the official GitHub Pages Action with no build step. This frees `docs/` for project context, since Pages can otherwise only serve from the root or `/docs`.
- **Skills:** official `webapp-testing` and `frontend-design` (from anthropics/skills), plus a new project skill `update-game-data`. Installed at execution time. No third-party marketplace skills.
- **Mockup look:** our own game-appropriate design. The owner's organization's default design system is a corporate product style and doesn't fit a public fan site.
- **Scope:** every building that has recipes, including Shrines and non-standard buildings (owner).
- **Spark crews:** a crew setting on each row of the chain, defaulting to a global crew setting (owner chose option b).
- **Temperature:** assume optimal everywhere, ×1 (owner).
- **Fuel:** shown as a note only until burn rates are known (owner).
- **Random outputs and `cycles`:** the owner doesn't know how they work. Use the assumptions in [unverified.md](unverified.md), with warnings shown.
- **Icons:** use wiki icons, with full credits (owner).
- **piratespark:** no affiliation. Credit it in the README as inspiration (owner).
- **Game version target:** wiki snapshot as of the extraction date (owner).
- **Rate unit:** items per minute by default, with a per-second toggle. Machines shown as exact and rounded up. (Proposed by Claude; not objected to.)
