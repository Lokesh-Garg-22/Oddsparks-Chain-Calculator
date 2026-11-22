# Game mechanics used by the calculator

Status markers refer to [unverified.md](unverified.md).

## Rates

- `duration` = seconds per craft with a crew of 1 Stumpy (U1, confirmed).
- Crafts per minute for one machine = `60 / duration × crewMultiplier`.
- Output per minute for one machine = crafts per minute × output amount.
- Inputs per minute for one machine = crafts per minute × input amount.
- Machines needed = demand per minute ÷ output per minute for one machine. Shown as exact (2 decimals) and rounded up. Values within 1e-9 of a whole number count as that number.
- Optional display mode "like the game": 1 decimal.

## Spark crews

| Crew | Multiplier | Status |
|---|---|---|
| 1 Stumpy | 1 | Confirmed |
| 2 Stumpy | 2 | Confirmed |
| 1 Crafty | 1.5 | From the template (U2b) |
| 2 Crafty | 3 | Confirmed |
| 1 Stumpy + 1 Crafty | 2.5 | From the template (U2b) |
| 1 Handy | 2.5 | From the template (U2b) |
| 2 Handy | 5 | From the template (U2b) |
| Player | 2 | From the template (U2b) |

- The table lives in `overrides.json` (`sparkCrews`, each with `status` and `source`), so it can be fixed without touching code. Default crew: `defaultCrew`.
- Every row of the chain (building + recipe) has its own crew setting, defaulting to the global crew setting. The global default is **2 Stumpy (×2)**.
- Harvesters speed up with sparks (U4, confirmed).

## Cycles (U5, assumption)

A recipe with `cycles = N` uses one batch of inputs every N crafts. Inputs per minute = crafts per minute × input amount ÷ N. Duration and output are per craft. Flagged in the UI.

## Random outputs (U6, assumption)

- If odds are given, expected output = amount × odds.
- If not, the listed amount is treated as the average.

Either way the row is flagged.

## Fuel (U7)

`uses_fuel` shows a fuel badge only. No fuel machines are counted.

## Temperature (U8)

Each recipe's ideal temperature is stored, but the calculator applies ×1 everywhere.

## Chain expansion

1. Target: building, recipe, count, crew. Work out crafts per minute and the inputs needed.
2. For each needed item: if it stops the chain, record it as raw demand. Otherwise choose its recipe and add the demand to that recipe's running total.
3. Expand recipes in dependency order so demand from every branch is summed before expanding further (e.g. Timber needed by two branches is calculated once, in total).

**Where the chain stops:**
- the item has no recipe
- the item's only recipes are harvester recipes with no inputs (the harvester is still counted)
- the user ticked "I supply this", or `overrides.json` lists the item as raw

**Default recipe when an item has several** (`site/js/engine/recipes.js`):
1. `overrides.json` `defaultRecipe` if set
2. otherwise a recipe where the item is the main product (not a byproduct)
3. a standard building: on the wiki's Buildings page and not a Shrine
4. earliest unlock tier (from the quest name, "… Tier N")
5. fewer inputs (a harvester before a crafted route, e.g. Tree Bark from the Logger)
6. the building's position on the Buildings page, which lists buildings in progression order (Spark Workbench before Workstation before Workshop)
7. alphabetical id. `npm run validate` warns when it comes to this, so a `defaultRecipe` can settle it

As of 2026-11-22, only Aether Seed, Aethric Converter, Subsurface Aether and Volcanic Soil are decided by id.

The user can switch recipes for each item.

**Byproducts:** shown in a "Byproducts & surplus" panel. In v1 they don't reduce other demand.

**Loops** (real example: Leaves → Greenhouse "Leafy Growth" → Leaf Knot → Sawbench "Leaf Knot Cutting" → Leaves):
- Detected when an item appears as its own ancestor.
- Expansion stops there, and the item is listed as "supplied externally (loop)" with a warning.
- The user is offered another recipe for it (e.g. Logger "Leaves Harvesting").

## Reference checks (become tests)

- Logger page text: "a logger will feed four Sawbenches with logs for Sawn Timber exactly". 4 × 7.5 = 30 = 1 Logger. ✓
- Worked example: 1 Spark Workbench making Crafty Spark, 1 Stumpy everywhere:
  - 2 Spark Workbench (Stumpy Spark, 1.33)
  - 1 + 2 Sawbench (Wooden Panel 0.33, Sawn Timber 1.33)
  - 1 Aetheric Distiller (0.33)
  - 1 Logger (22.5/min, 0.75)
- Owner's spreadsheet (crews as the owner used them; see [reference.md](reference.md)):
  - 3 Wood Workshop making Wooden Blade (2 Stumpy) → Wooden Panel 15/min → 0.67 → 1
  - Sawn Timber 37.5/min → 3.33 → 4
  - Timber 75/min → 0.83 → 1
