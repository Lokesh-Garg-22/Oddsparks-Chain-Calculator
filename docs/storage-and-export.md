# Tabs, saved library and Excel export

## Concepts

- **Tab:** one calculation. Stores building, recipe, count, crew per row, recipe choice per item, items marked "I supply this", and the Chain tree / Build list view. Display settings (unit, decimals, default crew, theme, extra columns) are per browser, not per tab (decision of 2026-11-22, step 8).
- **Open tabs** live in **sessionStorage** (`site/js/state/tabs.js`). A reload keeps them; they're gone when the browser tab closes. A tab with changes since it was opened (or saved) shows a dot, and closing that tab asks first. Asking before the *browser* tab closes arrives with Save in step 10, since until then there's nothing to do about it but lose the work.
- **Saved library** lives in **localStorage**. It holds saved tabs, organised in **nested folders**.
- Only inputs are stored, never results. Results are recalculated from the current data, so saved tabs stay small and work after a data update.

## Storage format

All keys are prefixed `oddsparks-calc:v1:`, because every GitHub Pages project under the same username shares one browser storage area.

```jsonc
// sessionStorage "oddsparks-calc:v1:session"
{
  "open": [
    { "key": "o1", "tabId": "t_8f2", "name": null,          "draft": { /* calc */ }, "dirty": true,  "missing": [] },
    { "key": "o2", "tabId": null,    "name": "Copper line", "draft": { /* calc */ }, "dirty": false, "missing": ["old-crew-id"] }   // never saved
  ],
  "active": "o1"
}

// localStorage "oddsparks-calc:v1:library"  (one key, so tabs and folders are always written together)
{
  "schema": 1,
  "tabs": {
    "t_8f2": {
      "id": "t_8f2", "name": "Wooden Blade ×3",
      "createdAt": "2026-11-22T10:00:00Z", "updatedAt": "2026-11-22T10:05:00Z",
      "dataVersion": "wiki-2026-11-22",
      "calc": {
        "building": "wood-workshop", "recipe": "wood-workshop--wooden-blade", "count": 3,
        "crews": { "wood-workshop--wooden-blade": "2-stumpy", "sawbench--sawn-timber": "2-crafty" },
        "recipeChoice": { "wooden-log": "logger--wooden-log--log-harvesting" },
        "supplied": [], "view": "list"
      }
    }
  },
  "folders": {
    "f_01": { "id": "f_01", "name": "Early game wood", "children": ["f_02", "t_8f2"], "collapsed": false },
    "f_02": { "id": "f_02", "name": "Blades",          "children": [],                "collapsed": false }
  },
  "root": ["f_01", "t_9aa"]   // the top level, in order: folders and tabs not in a folder
}

// Back up file (.json): the library with a format tag
{ "format": "oddsparks-calc-library", "exportedAt": "2026-11-22T10:00:00Z", "library": { /* as above */ } }

// localStorage "oddsparks-calc:v1:prefs"
{ "unit": "min", "decimals": 2, "defaultCrew": "2-stumpy", "theme": "system", "columns": [] }   // columns: keys from site/js/engine/columns.js
```

### Rules

- Every tab and folder is listed exactly once: in one folder's `children`, or in `root`. Each list is in display order, folders and tabs mixed, so drag and drop can place an item anywhere. `cleanLibrary()` (`site/js/state/library.js`) repairs anything else on load or restore: items listed twice keep their first place, loops between folders are broken, and anything unlisted goes to the top level.
- Saved calcs are stored as saved and checked with `cleanCalc()` when opened (`savedCalc()`), so the tab can say what's missing.
- **Nested folders:**
  - A folder can't be moved into itself or into one of its own subfolders.
  - Deleting a folder asks first. Its contents either move up one level or are deleted.
- **Moving things:** drag and drop on desktop, plus a ··· › **Move to…** dialog showing the folder tree, which works on touch screens and with a keyboard.
- **Each tab's ··· menu:** Open, Rename, Duplicate, Move to…, Export to Excel (step 11), Delete.
- **Each folder's ··· menu:** New subfolder, Rename, Move to…, Export folder to Excel (step 11), Delete.
- **Open tabs follow the library:** saving links an open tab to its saved copy (`tabId`). Renaming either renames both. Deleting a saved tab leaves its open tab with its contents, marked unsaved.
- **Saved with older data:** if a recipe, item or crew ID no longer exists, the tab opens with a banner naming what's missing. If the target recipe itself is gone, the tab opens on its building, so the recipe cards offer the replacement. Nothing is silently dropped.
  - `renamedIds` in overrides has one map per kind of stored ID (`recipes`, `items`, `crews`). `resolveId()` in `site/js/data/merge.js` follows them, so old tabs keep working after a rename or merge.
  - Crew IDs (`2-stumpy`, `1-stumpy-1-crafty`…) are stored too, so they only change via `renamedIds.crews`.
  - Recipe IDs depend only on recipe content, so reordering wiki pages never changes them.
  - Adding a recipe that collides with an existing one can lengthen that recipe's ID (e.g. `furnace--big-vial` → `furnace--big-vial--from-quartz`). That shows up as a missing ID and is handled the same way.
- **Storage unavailable** (private browsing, blocked, quota full): every access is wrapped in try/catch. The calculator and the library still work for this visit, the library says it will be lost when the page closes, and back up still works.
- **Back up / Restore:** download or upload the library as `.json`. On restore, choose to merge (new IDs where they clash) or replace.
- Size: about 1 KB per tab, against a roughly 5 MB browser limit.

Open tabs (the session) store:

- `name`: set by the user (double-click or F2 on the tab); null means it's named after its calc ("Wooden Blade ×3"). A saved tab always has its saved name.
- `missing`: ids the calc lost because they're no longer in the game data. The page names them until dismissed.
- Every stored calc goes through `cleanCalc()` (`site/js/state/calc.js`) on the way in, the same check that share links, the saved library and restores use.

## Share links

`site/js/state/url.js`. The URL fragment holds a tab's calc, so it never reaches a server:

`#r=<recipe>&n=<count>&c=<recipe>:<crew>,…&p=<item>:<recipe>,…&s=<item>,…&v=list`

- Ids are slugs, so `:` and `,` need no escaping.
- On the way in, every id goes through `resolveId`, so renamed ids still work. Ids that no longer exist are dropped and named in a banner. If the target recipe itself is gone, the page says so and opens empty.
- After it's read, the fragment is removed from the address bar. The link opens as a new tab, or replaces the current tab if that one is empty and untouched, whether the page was opened from the link or it was pasted into an open page.

## Excel export (ExcelJS, loaded on demand)

Code: `site/js/export/workbook.js` builds the workbook as plain data (pure, tested in Node), and `site/js/export/xlsx.js` writes it with ExcelJS 4.4.0 (the "bare" build in `site/vendor/exceljs/`). Both load only when someone exports. Export from the toolbar (this tab, as it is now, unsaved changes included), from a saved tab's or folder's ··· menu, or with Export library to Excel at the foot of the library.

- **This tab:** a workbook with one sheet. **Folder:** one sheet per tab, including subfolders, with sheet names prefixed by the folder path. **Whole library:** the same for everything.
- Sheet names follow Excel's rules: at most 31 characters, none of `[]:*?/\` (each becomes `-`), not starting or ending with an apostrophe, not "History", and unique ignoring case (` (2)` is added). A folder's sheets are named with the folders below the exported one; the library's with their full path.
- Tabs with no recipe chosen are listed in the Summary as skipped.

### Sheet layout (based on the owner's `Odd Sparks.xlsx`)

Row 1 holds headers; then one row per recipe in the chain, in dependency order (target first), with a blank row between rows like the owner's sheet. The headers and values come from the shared column definitions (`site/js/engine/columns.js`, the `excel` field), the same ones the build list uses.

| Col | Header (owner's wording) | Content |
|---|---|---|
| A | Final Output | `=B*G` |
| B | Production p/m | output per minute for one machine, with this row's crew |
| C | Production Piece Per Cycle | output amount per craft |
| D | Production Cycles Per Minute | `=B/C` |
| E | Parts Needed | `=` sum of the input-total cells of the rows that need this item (e.g. `=K16+K13`); `NA` for the target |
| F | Item Name | in-game name |
| G | # of machines | target: count entered; other rows: `=E/B` |
| H–K | Item # 1 / Base Item Needed / Base Item p/m / Item Pieces Needed | input 1: name, amount per craft, `=$D*I`, `=$G*J` |
| L–O | Item # 2 … | input 2, same formulas |
| P–S | Item # 3 … | input 3 (the owner's sheet had 2 slots; some recipes have 3) |
| T | Machines (build) | `=ROUNDUP(G,0)` |
| U | Building | |
| V | Recipe | |
| W | Spark crew | name and multiplier |

- Every formula is written together with its calculated value, so file previewers that don't recalculate still show numbers.
- Formatting: bold header row, frozen header row, column widths, number format `0.00`.
- **Summary sheet:** for each calculation, what it makes, machines per building (rounded up), what comes from outside the chain, byproducts and spare capacity, and warnings, including ids lost to a data update. Then the data version, export date, and the CC BY-SA and THQ Nordic credit lines.
- E (Parts Needed) is written as a formula only when every consuming row's cell is found, and as a plain value otherwise.
- **Test** (`tests/export.test.mjs`): exporting 3 × Wood Workshop making Wooden Blade (2 Stumpy; others 2 Crafty) reproduces the owner's Wooden Blade sheet, using the exact rate (11.25 rather than the 11.2 read off the game); Sawn Timber's Parts Needed is `=K2+K4`, like the owner's `=K16+K13`. Every formula is evaluated from the other cells and must equal the value written beside it.
