# Reference

## UI mockup

- Screens:
  - desktop chain
  - phone
  - tabs + saved library + column chooser
  - picker and settings
  - edge cases (fuel, conflicts, random outputs, byproducts, loops)
  - library menus and dialogs
  - dark theme
- Look:
  - dark forest-green header (`#1B2A22`), page background `#F3F5F0`
  - amber spark accent (`#F2A93B`), teal for actions (`#22695C`)
  - Fredoka headings, Inter body text
  - placeholder icons until the wiki icons are downloaded

## Owner's spreadsheet: `C:\Data\Odd Sparks Game\Odd Sparks.xlsx`

Not in the repo. Three sheets, each a hand-worked chain:

| Sheet | Rows (item: rate per machine /min → machines) | Crews (from the owner) |
|---|---|---|
| Sawn Timber | Sawn Timber 11.2 → 2 (target); Timber 90 → 0.498 | 2 Crafty |
| Wooden Panel | Wooden Panel 22.5 → 1 (target); Sawn Timber 11.2 → 4.02; Timber 90 → 1 | 2 Crafty |
| Wooden Blade | Wooden Blade 2.5 → 3 (target); Wooden Panel 15 needed → 1; Sawn Timber 30 needed → 2.68 and 7.5 needed → 0.67 (two separate rows); Timber 75 needed → 0.833 | 2 Stumpy on Wood Workshop, 2 Crafty elsewhere |

- Its columns A–O are the basis for the Excel export ([storage-and-export.md](storage-and-export.md)).
- What the site improves on:
  - adds up demand for the same item from different branches before rounding
  - uses exact rates (11.25 instead of the 11.2 the game shows)
  - supports 3 ingredient slots

## piratespark

https://piratespark.github.io/. An existing calculator and the inspiration for this project. No affiliation. Source: compiled build with a source map; last pushed 2024-09-09.

## Research notes (2026-11-22)

- **GitHub Pages with no build step:**
  - use relative paths (`./js/...`)
  - match filename case exactly (Pages URLs are case-sensitive)
  - keep `index.html` at the root of the published folder
  - test through a local server (module loading needs one)
  - Pages serves only the root or `/docs`, or whatever an Actions workflow uploads
- **Official skills** in `anthropics/skills` include `webapp-testing` (Playwright, Python) and `frontend-design`.
- **Libraries:**
  - Preact 10.29.8 (2026-08-01, MIT)
  - htm 3.1.1 (Apache-2.0)
  - ExcelJS 4.4.0 (2023-10-19, MIT, ~950 KB)
  - SheetJS 0.20.3 from cdn.sheetjs.com (free version, no cell styling)
