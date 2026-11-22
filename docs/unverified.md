# Unverified and confirmed values

The site shows a warning badge on any value marked open here. When a value is confirmed, move it to "Confirmed" with its source and date.

## Open

| # | Value | Current assumption | How to confirm |
|---|---|---|---|
| U2b | Handy-crew and mixed-crew multipliers: 1 Stumpy + 1 Crafty 2.5, 1 Handy 2.5, 2 Handy 5, Player 2 | Taken from `Template:Recipe` code | In-game readings, or game files |
| U3 | Other spark types (Arty, Drilly, Scrubby…) as crew | Not offered as crew options | Game files |
| U5 | `cycles` (Greenhouse 10, Arboretum 100, Aetheric Converter Feeder 50) | One batch of inputs lasts `cycles` crafts; `duration` and output are per craft | Stopwatch one Greenhouse |
| U6 | Random outputs with no odds (Geode Breaker) | Listed amounts are treated as averages | Game files, or count many crafts in-game |
| U7 | Fuel burn rates, and which items count as fuel | Shown as a note only | Game files |
| U8 | Temperature effect | ×1 everywhere (optimal) | Not needed for now |
| U9 | Overclocked harvester recipes. The Logger page says 2 s plus "150% at −3°"; the Wooden Log page lists "Overclocked Wood Harvesting" at 1.333 s (= 2 ÷ 1.5). The item page probably has the bonus built in | Both kept as separate recipes and flagged as possible duplicates. The building page's 2 s is the base | In-game: an overclocked Logger at −3° |
| U10 | Non-standard buildings (Aetheric Converter Feeder, Ancient Generator, Ancient Greenhouse, Ancient Printer, Tailor's Tent, 2 Shrines) | Included, never chosen as default recipe | Owner's knowledge of the game |
| U11 | Ingredients that nothing makes (Corrupted Aether, Corrupted Spark Token, Frozen Log, Frozen Stone, Miasma) | Treated as raw resources | Extraction report |
| U12 | **12 recipes where pages disagree** (2026-11-22). The value used is shown first, with the other value(s) after the slash: Sponge 24 s / 824 s (Loom page typo?) · Copper Sap Smelting 24 s / 64 s · Aether Refinement 4 / 2 Raw Aether · Spark Token Cleansing 5 / 1 Grey Aether · Raw Distillation 6 / 4 Aether Shard · Aether Seed Crystallisation 10 / 3 Aether Crystal · Fertiliser Enrichment 4 / 5 · temperature on 3 paints, Fireshroom Colony and Overclocked Quartz. Also 21 recipes found on only one page | Most pages win; a tie goes to the building page. Shown with a "sources disagree" badge | In-game, one recipe at a time; record the answer in overrides |
| U14 | **Same name, different ingredients** (likely copy-paste errors on the wiki). Extract Aether Segment: 1 Aether Segment vs **4 Stellar Ice** (Plant Extractor page) · Stone Block Cutting: Stone Block vs **Frozen Stone** · Aether Pellet Fusion vs Aether Clump Fusion. The Hat recipes are real variants, one per hat type | All kept, flagged in the report | In-game; then `mergeRecipes` or a correction in overrides |
| U15 | How the game rounds displayed numbers | Half to even (Unreal's default number formatting); used by the "1 decimal, like the game" setting. Matches the one reading so far (11.25 → 11.2) | A reading whose second decimal is 5 after an odd digit (e.g. 11.35 should show 11.4), or one that isn't a tie (11.27 → 11.3 if rounding, 11.2 if cutting) |
| U13 | Wiki names vs in-game names | `overrides.json` in-game names; known so far: Wooden Log → **Timber** | Owner's in-game check, or game files |

## Confirmed

| # | Value | Source |
|---|---|---|
| U1 | Wiki `duration` = craft time with 1 Stumpy | Owner's in-game readings, 2026-11-22 (all rates match base × crew) |
| U2a | 2 Stumpy = ×2, 2 Crafty = ×3 | Owner, 2026-11-22: Wooden Blade 2.5/min (2 Stumpy); Logger 90, Sawn Timber 11.2, Wooden Panel 22.5 /min (2 Crafty) |
| U4 | Harvesters speed up with sparks | Owner, 2026-11-22: Logger 30 → 90 /min with 2 Crafty |
| — | Game shows rates rounded to 1 decimal | Owner: 11.25 shows as 11.2 |
