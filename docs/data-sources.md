# Data sources

## Primary: Oddsparks Wiki (wiki.gg)

- Hub: https://oddsparks.wiki.gg/wiki/Oddsparks:_An_Automation_Adventure_Wiki
- MediaWiki API: `https://oddsparks.wiki.gg/api.php`. It's reachable, so we read raw wikitext instead of scraping HTML.
- Recipes use the `{{Recipe}}` template. Fields: `workstation`, `ingredient[2|3]` + `_amount`, `product[2|3]` + `_amount`, `product*_odds`, `duration` (seconds), `uses_fuel`, `output_randomised`, `cycles`, `temperature`, `quest_unlock`, `quest_npc`, `recipe name`/`name`.
- Building pages use `{{Infobox building}}` (footprint, `storageslots`, `questunlock`) and `{{building}}` for build costs.
- **Snapshot 2026-11-22:**
  - 132 pages embed `Template:Recipe`, with 479 recipe blocks.
  - Most recipes appear twice (once on the building page, once on the item page), so the two copies are cross-checked.
  - 28 buildings have recipes.
  - About 101 items.
  - Last wiki edit: 2026-09-21.

### Quality issues found

- Field-name variants: `product amount` / `product_amount`, `ingredient2_`, `seccond ingredient`, `recipe name` / `name`.
- Name typos and case: `limestone`, `Big vial`, `Aethric Converter`.
- Names that differ from the game: "Wooden Log" on the wiki is "Timber" in-game. Expect more.
- Conflicts between the two copies of a recipe. Example: **Copper Ore Smelting** has no `uses_fuel` on the Furnace page, but `uses_fuel=yes` on the Copper Ingot page.
- Buildings that make things but aren't on the Buildings page: Aetheric Converter Feeder, Ancient Generator, Ancient Greenhouse, Ancient Printer, Tailor's Tent, Aetheric Distiller Shrine, Crafty Spark Shrine.
- Ingredients that nothing makes: Corrupted Aether, Corrupted Spark Token, Frozen Log, Frozen Stone, Miasma, plus `limestone` (a case issue).

### Extraction (`tools/extract-wiki.mjs`, build step 2)

1. Ask the API which pages embed `Template:Recipe`, then download their wikitext in batches of 50, using a descriptive user agent with no personal details.
2. Parse every `{{Recipe}}` and `{{Infobox building}}` block and normalise field names.
3. Turn duplicate recipes into one entry and record whether the two copies match (`match`, or `conflict` with both versions kept).
4. Record the source page and revision ID for every recipe.
5. Write `site/data/oddsparks.json` (generated, never hand-edited) and `site/data/extraction-report.md` (normalisations, conflicts, recipes found on only one page, unknown fields, likely renames).
6. Corrections, defaults and in-game names go in `site/data/overrides.json` (hand-edited). Running the extractor again never overwrites it.

## Icons

Downloaded from the wiki's `File:<Name>.png` pages into `site/icons/`. Each file page's licence and author is recorded in `site/icons/CREDITS.md`. Any icon with a restrictive licence falls back to text. Icons are never hotlinked.

## Secondary: piratespark

- Site: https://piratespark.github.io/. Repo: `piratespark/piratespark.github.io`, last pushed 2024-09-09.
- Only a compiled React build, but it ships a source map (`static/js/main.*.js.map`, ~7 MB) that likely contains its data. Possibly older than game 1.0. Use it for comparison and UX ideas only. No affiliation.

## Optional: game files (plan step 13)

- Installed at `C:\Program Files\Epic Games\OddSparks`. Unreal Engine 5 IoStore archives (`Loc/Content/Paks/Loc-Windows.utoc/.ucas/.pak`), **not encrypted** (encryption key ID is all zeros, encrypted flag off).
- Reading them needs a `.usmap` mappings file, made by running the game with UE4SS or Dumper-7 injected (a manual step for the owner). Then FModel exports the data tables to JSON.
- Would settle fuel burn rates, spark multipliers, drop odds, `cycles` and names.
- Only numbers are used. No files from the game are shipped. Whether the game's licence allows this is the owner's decision.

## Licensing

- Code: MIT (`LICENSE`).
- `site/data/` and wiki icons: CC BY-SA 4.0, credited to the Oddsparks Wiki, with details in `site/data/LICENSE-DATA.md` and `site/icons/CREDITS.md`.
- Site footer:
  - wiki credit
  - "Oddsparks © THQ Nordic AB. Developed by Massive Miniteam, published by HandyGames. Oddsparks is a trademark of THQ Nordic AB."
  - "Fan-made site, not affiliated with or endorsed by them."
  - piratespark credited as inspiration

  Source for the credit: [Steam store page](https://store.steampowered.com/app/1817800/Oddsparks_An_Automation_Adventure/), checked 2026-11-22.
