# Roadmap: ideas for after v1

Features we'd like to add after v1. Contributions are welcome. Pick an idea, open an issue to discuss your approach, then send a pull request. Ideas not listed here are welcome too: open an issue first.

Status: **idea** (open for anyone) · **planned** (the maintainer intends to do it) · **in progress** (someone is working on it; check the linked issue).

## Calculator

| Feature | Status | Notes |
|---|---|---|
| **Unlock filter**: only show recipes and buildings you've unlocked (e.g. "up to Tier 4") | planned (v1.1) | Each recipe already records its unlock quest. Needs a "my progress" setting saved per browser |
| **Target by rate**: "I want 30 Sawn Timber / min" instead of a machine count | idea | Works the same as the machine-count input, backwards |
| **Exact solver for byproducts and loops**: byproducts reduce other demand, loops solved exactly | idea | Linear programming in the browser. v1 uses simple tree expansion |
| **Fuel modelling**: count fuel and fuel machines | idea | Needs burn rates per fuel item (unknown; see `docs/unverified.md` U7) |
| **Temperature effects** on speed | idea | Needs the game's speed curve (U8) |
| **More spark types as crews** (Arty, Drilly, Scrubby…) and mixed crews per machine group | idea | Needs multipliers (U2b, U3) |
| **Build costs**: total materials needed to construct all the machines in a chain | idea | The wiki has build costs per building (`{{building}}` template) |
| **Chain diagram view**: node graph of the chain | idea | Alongside the tree and build list |
| **Compare tabs** side by side | idea | |

## Library and sharing

| Feature | Status | Notes |
|---|---|---|
| **Share a whole folder** by link | idea | Today a link shares one calculation |
| **Import from Excel**: read an exported workbook back into tabs | idea | The export layout is documented in `docs/storage-and-export.md` |
| **Sync across devices** without a backend (e.g. via a GitHub Gist the user owns) | idea | Today: back up and restore with a `.json` file |
| **Print / PDF view** of a chain | idea | |

## Data and reach

| Feature | Status | Notes |
|---|---|---|
| **Game-file data extraction**: accurate numbers and in-game names straight from the game | to be decided | Plan step 13; see `docs/data-sources.md` |
| **Other languages** | idea | Needs translated item names (game files). v1 is English only |
| **Works offline** (installable web app) | idea | |
| **"Only what I own" mode**: mark machines you have already built | idea | |

## How to contribute

- **Data fixes** (wrong recipe, time or name): edit `site/data/overrides.json`, not the generated `oddsparks.json`. Include the source (wiki page link, or an in-game screenshot) in the pull request.
- **Code:** no build step. Serve `site/` locally (`npm run serve`) and run tests with `npm test`. Keep the calculation code free of DOM code.
- Read `docs/plan.md` and `docs/decisions.md` first, so your change fits decisions already made.
