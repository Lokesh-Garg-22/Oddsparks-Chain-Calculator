# Contributing

Thanks for helping. This is a small static site, so a contribution can be as simple as fixing one wrong number.

## Ground rules

- **No build step, no npm dependencies.** The site in `site/` is served exactly as written. Third-party browser libraries are pinned copies in `site/vendor/`.
- **Never invent game data.** Every recipe, amount and time needs a source: a wiki page, an in-game screenshot or reading, or the game files. Anything unconfirmed is marked as unverified, not guessed.
- **Keep the calculator pure.** Code in `site/js/engine/` must not touch the page or the browser, so it can be tested with Node.
- Read [docs/plan.md](docs/plan.md) and [docs/decisions.md](docs/decisions.md) first, so your change fits decisions already made.

## Setup

```sh
npm run serve   # http://localhost:8080
npm test
```

Node.js 22+ is all you need. Browser tests use Python Playwright in a local virtual environment:

```sh
python -m venv .venv
.venv/Scripts/python -m pip install playwright      # macOS/Linux: .venv/bin/python
.venv/Scripts/python -m playwright install chromium
.venv/Scripts/python tests/browser/run.py           # all browser checks; add a word to run some ("tabs")
```

The runner starts the dev server on a free port and runs each `tests/browser/check_*.py` in Chromium (desktop and phone sizes). Screenshots and downloaded files go to `test-results/browser/`. Run them before a pull request that changes the UI.

## Fixing game data

1. Don't edit `site/data/oddsparks.json`. It's regenerated from the wiki and your change would be lost.
2. Add your fix to `site/data/overrides.json` with a `reason` and a `source` (wiki page link, or a screenshot or in-game reading with the date and spark crew used).
3. Run `npm test`.
4. In the pull request, explain what was wrong and how you checked it.

If the wiki itself is wrong, consider fixing it there too. Everyone benefits.

## Code changes

- Use plain JavaScript modules with JSDoc types (`// @ts-check` at the top of each file).
- Add or update tests in `tests/` for anything in the calculator, storage or export code.
- For UI changes, include a screenshot (light and dark if relevant) and check phone width.
- Update the docs your change affects (`docs/`), and add an entry to `docs/decisions.md` if you made a design decision.

## Pull requests

- One topic per pull request, with a clear title (e.g. "Fix Sawn Timber craft time", "Add unlock filter").
- For bigger features from [ROADMAP.md](ROADMAP.md), open an issue first to agree on the approach.
- By contributing you agree that code is licensed under MIT, and data under CC BY-SA 4.0 (see [site/data/LICENSE-DATA.md](site/data/LICENSE-DATA.md)).
