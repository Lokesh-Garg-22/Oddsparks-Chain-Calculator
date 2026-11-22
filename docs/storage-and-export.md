# Tabs, saved library and Excel export

## Concepts

- **Tab:** one calculation. Stores building, recipe, count, crew per row, recipe choice per item, items marked "I supply this", and visible columns.
- **Open tabs** live in **sessionStorage**. They're gone when the browser tab closes. A tab with unsaved changes shows a dot, and closing the browser tab with unsaved work asks first.
- **Saved library** lives in **localStorage**. It holds saved tabs, organised in **nested folders**.
- Only inputs are stored, never results. Results are recalculated from the current data, so saved tabs stay small and work after a data update.

## Storage format

All keys are prefixed `oddsparks-calc:v1:`, because every GitHub Pages project under the same username shares one browser storage area.

```jsonc
// sessionStorage "oddsparks-calc:v1:session"
{
  "open": [
    { "key": "o1", "tabId": "t_8f2", "draft": { /* calc */ }, "dirty": true },
    { "key": "o2", "tabId": null,    "draft": { /* calc */ }, "dirty": true }   // never saved
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
        "crews": { "wood-workshop--wooden-blade": "2stumpy", "sawbench--sawn-timber": "2crafty" },
        "recipeChoice": { "wooden-log": "logger--log-harvesting" },
        "supplied": [], "columns": ["inTotal"], "unit": "min"
      }
    }
  },
  "folders": {
    "f_01": { "id": "f_01", "name": "Early game wood", "parentId": null,   "tabIds": ["t_8f2"], "collapsed": false },
    "f_02": { "id": "f_02", "name": "Blades",          "parentId": "f_01", "tabIds": [],         "collapsed": false }
  },
  "rootOrder": ["f_01", "t_9aa"],   // order of top-level folders and tabs not in a folder
  "unfiled": ["t_9aa"]
}

// localStorage "oddsparks-calc:v1:prefs"
{ "columns": ["inTotal"], "unit": "min", "decimals": 2, "defaultCrew": "1stumpy", "theme": "system" }
```

### Rules

- A tab is in exactly one folder's `tabIds`, or in `unfiled`.
- Folder order inside a parent: an `order` number on each folder.
- **Nested folders:**
  - A folder can't be moved into itself or into one of its own subfolders.
  - Deleting a folder asks first. Its contents either move up one level or are deleted.
- **Moving things:** drag and drop on desktop, plus a ··· › **Move to…** dialog showing the folder tree, which works on touch screens and with a keyboard.
- **Each tab's ··· menu:** Open, Rename, Duplicate, Move to…, Export to Excel, Delete.
- **Each folder's ··· menu:** New subfolder, Rename, Move to…, Export folder to Excel, Delete.
- **Saved with older data:** if `dataVersion` differs and a recipe or item ID no longer exists, the tab opens with a banner naming what's missing and offering a replacement. It's never silently dropped.
  - `renamedIds` in overrides maps old IDs to new ones automatically.
  - Recipe IDs depend only on recipe content, so reordering wiki pages never changes them.
  - Adding a recipe that collides with an existing one can lengthen that recipe's ID (e.g. `furnace--big-vial` → `furnace--big-vial--from-quartz`). That shows up as a missing ID and is handled the same way.
- **Storage unavailable** (private browsing, blocked, quota full): every access is wrapped in try/catch. The calculator still works, saving is disabled with a message, and back up still works.
- **Back up / Restore:** download or upload the library as `.json`. On restore, choose to merge (new IDs where they clash) or replace.
- Size: about 1 KB per tab, against a roughly 5 MB browser limit.

## Excel export (ExcelJS, loaded on demand)

- **This tab:** a workbook with one sheet. **Folder:** one sheet per tab, including subfolders, with sheet names prefixed by the folder path. **Whole library:** the same for everything.
- Sheet names follow Excel's rules: at most 31 characters, none of `[]:*?/\`, unique.

### Sheet layout (based on the owner's `Odd Sparks.xlsx`)

Row 1 holds headers; then one row per recipe in the chain, in dependency order, with a blank row between rows like the owner's sheet.

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
- **Summary sheet:** machines per building and recipe (rounded up), raw resources per minute, byproducts, warnings, data version, export date, and a CC BY-SA credit line.
- **Test:** exporting 3 × Wood Workshop making Wooden Blade (2 Stumpy; others 2 Crafty) must reproduce the owner's Wooden Blade sheet, using the exact rate (11.25 rather than the 11.2 read off the game).
