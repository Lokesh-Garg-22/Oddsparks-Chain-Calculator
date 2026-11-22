# Context

## What this is

A static website for *Oddsparks: An Automation Adventure*. You pick a production building, one of its recipes and how many of that building you want to run. The site then shows every upstream building, and how many of each, needed to keep them fully supplied, down to raw resources.

You can keep several calculations open as tabs, save them into a library organised in nested folders, and export them to Excel in a layout based on the owner's own spreadsheet.

- Hosting: GitHub Pages, static, no backend.
- Stack: Preact + htm saved into the repo (no build step), ExcelJS loaded on demand, Node scripts for data extraction and tests. See [plan.md](plan.md).
- Data: the Oddsparks Wiki (wiki.gg) snapshot of 2026-11-22, game 1.0 (Epic build `1.0.S31387`). See [data-sources.md](data-sources.md).

## Status (2026-11-22)

- **Phase: planning.** No application code exists yet.
- Done:
  - wiki data check (132 pages, 479 recipe blocks, 28 buildings with recipes)
  - game archives checked: not encrypted
  - owner's spreadsheet analysed
  - UI mockup made, then checked against every UI item in plan section 6 (7 screens)
  - docs created
- Confirmed from the owner's in-game readings: base craft time = 1 Stumpy, 2 Stumpy = ×2, 2 Crafty = ×3, harvesters speed up with sparks.

## Next step

The owner reviews the updated mockup and plan, then says **"execute the plan"**. Build step 1 is in [plan.md](plan.md#7-build-steps).

## Open questions for the owner

- None blocking.
- Site name: undecided (working title "Oddsparks Chain Calculator").
- Optional step 13 (game-file extraction): decided at the end of the project.
