# Oddsparks Chain Calculator

A production chain calculator for **[Oddsparks: An Automation Adventure](https://store.steampowered.com/app/1817800/Oddsparks_An_Automation_Adventure/)**. Pick a building, one of its recipes and how many you want to run. The calculator shows every other building, with how many of each, and every raw resource needed to keep them fully supplied.

> **Status:** in development. See [docs/context.md](docs/context.md) for where things stand.

## Features (v1)

- Every building that has recipes, with each recipe's inputs, outputs and craft time
- A spark crew setting on every row of the chain (e.g. 2 Stumpy ×2, 2 Crafty ×3)
- Exact and rounded-up machine counts; demand from different branches is added up before rounding
- Recipe switch for items with more than one recipe, and "I supply this" to stop the chain at any item
- Warnings for fuel, random outputs, recipe loops, and data that isn't confirmed yet
- Several calculations open as tabs, a saved library with nested folders, back up and restore
- Excel export in a spreadsheet-friendly layout with live formulas
- Shareable links, light and dark themes, works on phones

Ideas for after v1 are in [ROADMAP.md](ROADMAP.md).

## Run it locally

Requires [Node.js](https://nodejs.org/) 22 or newer. There are no dependencies to install and no build step.

```sh
npm run serve   # http://localhost:8080
npm test        # unit tests
```

Opening `site/index.html` directly from disk won't work, because browsers block module loading from `file://`.

Browser tests (Playwright) are described in [CONTRIBUTING.md](CONTRIBUTING.md#setup).

## Deployment

Every push to `main` runs the tests and publishes `site/` to GitHub Pages (`.github/workflows/pages.yml`). Pull requests are tested only. Nothing is built: the files in `site/` are the site.

One-time setup, in the repository's **Settings › Pages**: set **Source** to **GitHub Actions**. Free GitHub accounts can only publish Pages from a public repository.

## Project layout

| Path | What's there |
|---|---|
| `site/` | The website, exactly as published to GitHub Pages |
| `site/data/` | Game data: `oddsparks.json` (generated from the wiki) and `overrides.json` (hand-made fixes) |
| `tools/` | Data extraction and validation scripts, plus the local dev server |
| `tests/` | Unit tests (`node --test`) and browser checks (`tests/browser/`, Playwright) |
| `.github/workflows/` | Test and deploy to GitHub Pages |
| `docs/` | Plan, decisions, data sources and other project context |
| `.claude/skills/` | Claude Code skills used to build and maintain the project |

## Game data

Data comes from the [Oddsparks Wiki](https://oddsparks.wiki.gg) through its MediaWiki API, with corrections and in-game names in `site/data/overrides.json`. Every recipe records the wiki page it came from. Values that aren't confirmed are flagged in the app and listed in [docs/unverified.md](docs/unverified.md).

Found a wrong number? See [CONTRIBUTING.md](CONTRIBUTING.md#fixing-game-data).

### Updating the game data

After a game patch or wiki edits:

```sh
npm run extract    # re-reads the wiki (politely: one request at a time) and rewrites site/data/oddsparks.json
npm run validate   # checks the data and overrides fit together
npm test           # includes the owner's in-game readings and spreadsheets
npm run icons      # only if new items or buildings appeared
```

Then read `site/data/extraction-report.md` (conflicts, recipes found on one page, likely renames). Put fixes in `site/data/overrides.json`, never in `oddsparks.json`. If a recipe or item id changed, map it in `renamedIds` so saved tabs and share links keep working. The full checklist is the `update-game-data` skill (`.claude/skills/update-game-data/SKILL.md`).

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and pick something from [ROADMAP.md](ROADMAP.md).

## Credits and licences

- **Code:** [MIT](LICENSE).
- **Game data:** derived from the [Oddsparks Wiki](https://oddsparks.wiki.gg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). See [site/data/LICENSE-DATA.md](site/data/LICENSE-DATA.md).
- **Icons:** game artwork © THQ Nordic AB, as uploaded to the Oddsparks Wiki. Not covered by the MIT or CC BY-SA licences. See [site/icons/CREDITS.md](site/icons/CREDITS.md).
- **Game:** Oddsparks © THQ Nordic AB. Developed by Massive Miniteam, published by HandyGames. Oddsparks is a trademark of THQ Nordic AB. This is a fan-made project, not affiliated with or endorsed by them.
- **Inspiration:** [piratespark](https://piratespark.github.io/), an earlier Oddsparks calculator. This project is independent and not affiliated with it.
