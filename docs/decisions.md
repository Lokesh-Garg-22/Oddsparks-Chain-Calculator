# Decision log

Newest first. Each entry: date, decision, reason.

## 2026-11-22

- **Step 2 (wiki extractor) decisions:**
  - **Merge rules:**
    - only values a page states are compared
    - most pages win, a tie goes to the building's own page, fuel any-yes
    - two blocks on one page are always two recipes
    - name variants of up to 3 letters merge if the numbers agree

    Reason: the first version let the building page always win, which would have picked the Loom page's "824 s" typo for Sponge over three pages saying 24 s.
  - **Data stores facts, not a status:**
    - `sources` with revisions, `valueFrom`, `conflicts` by field path, `problems[]`
    - flags nobody states stay `null`
    - temperature split into `optimalTemperature` (a number) and `insulated`

    Reason: overrides (step 4) need to address individual fields, and the app works out a status after applying them. Recorded after the `simplify` review.
  - **Recipe IDs depend only on content** (building + main product, plus inputs, name or hash only when needed). Reason: saved tabs store IDs. Order-based `-2` suffixes could have silently swapped recipes when someone reordered a wiki page.
  - **`dataVersion` includes a content hash.** The hard-coded game version is dropped.
  - **New override key `mergeRecipes`** for "these two extracted recipes are one". `renamedIds` stays for moving saved-tab IDs.
  - **The extractor keeps a raw wikitext snapshot** in `tools/.cache/` (git-ignored), so `npm run extract -- --offline` rebuilds without touching the wiki. A live run makes about 6 requests, one at a time, with a 400 ms pause between them.
  - **Security review:** no findings. Hardening applied anyway: wiki text is escaped in the report, and maps keyed by wiki text have no inherited keys.
- **Step 1 choices:**
  - The local dev server is our own ~70-line Node script (`tools/serve.mjs`), not `npx serve` or Python, keeping the zero-dependency rule. It serves only `site/`, refuses paths that escape it, and doesn't cache.
  - `package.json` only lists scripts that exist (`serve`, `test`); `extract`, `validate` and `icons` are added in the steps that create them.
  - Tests are matched as `tests/**/*.test.mjs` so Node's test runner never scans `.venv/`.
  - Line endings are normalised to LF via `.gitattributes`.
  - After the `simplify` review:
    - colours use CSS `light-dark()`, written once for both themes, with `data-theme` overriding the OS setting; this needs a 2024+ browser (Chrome 123, Firefox 120, Safari 17.5)
    - the dev server maps URLs segment by segment instead of special-casing characters
    - separate `jsconfig.json` for Node code (root) and browser code (`site/`), using NodeNext resolution so missing file extensions are flagged as browsers would
  - **Deferred:** self-hosting the fonts (now Google Fonts) moves to step 6 to keep the "no CDN at runtime" rule; `404.html` and directory redirects move to step 12.
- **webapp-testing on Windows:** the helper script needs an absolute Windows path for the Python command (`…\.venv\Scripts\python.exe`); forward-slash relative paths fail to launch.
- **Skills installed in the project** (`.claude/skills/`):
  - `webapp-testing` and `frontend-design`, copied unchanged from `anthropics/skills` at commit `e4bb5d9` (Apache-2.0, licences kept) and reviewed before committing
  - our own `update-game-data`
  - CLAUDE.md maps each build step to the skill that must be used
  - Playwright 1.65.2 + Chromium live in a project `.venv/` (git-ignored)
  - `update-game-data` gets its first real test run once the extractor exists (end of step 4)
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
