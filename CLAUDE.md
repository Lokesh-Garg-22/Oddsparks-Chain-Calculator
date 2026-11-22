# CLAUDE.md

Oddsparks production chain calculator ("Pirate-Spark-V2"): a static site for GitHub Pages.

## Read first

1. [docs/context.md](docs/context.md): current status and next step.
2. [docs/plan.md](docs/plan.md): the approved plan.
3. [docs/decisions.md](docs/decisions.md): what was decided, and why.

## Skills (use them, every time they apply)

The project skills live in `.claude/skills/`. Load the skill **before** doing the work it covers, not afterwards.

| When | Skill |
|---|---|
| Any change to game data: extraction, overrides, in-game names, confirming values, icons (plan steps 2–4, and every later data update) | `update-game-data` (project) |
| Building or reshaping any UI: layout, styling, components, theming (plan steps 6–11) | `frontend-design` (project, official) |
| Checking the UI in a real browser: screenshots, clicks, console errors, phone width (end of every UI step, and step 12) | `webapp-testing` (project, official). Use `.venv/Scripts/python` (Playwright + Chromium are installed there) |
| Launching the site locally to look at a change | `run` |
| End of every build step, before asking the owner to review | `code-review`, then `simplify` |
| Step 2 (extractor fetches external content) and step 12 (deploy workflow) | `security-review` |
| Creating or changing a skill | `skill-creator` |

The mockup (`docs/reference.md`) is the visual reference for `frontend-design` work. Its palette and type are already decided, so follow it rather than inventing a new look.

## Rules

- **Planning gate:** write no application code and no scaffolding until the owner says **"execute the plan"**. Docs in `docs/` are allowed. If you're unsure whether something counts as execution, ask.
- **Never invent game data.** Every machine, recipe, input, output and time needs a source (wiki page + revision, game files or an in-game reading). Anything without one is marked `UNVERIFIED` and listed in [docs/unverified.md](docs/unverified.md).
- **Keep the docs current.** After each build step or decision, update `docs/context.md` (status and next step) and `docs/decisions.md` (dated entry), plus any other doc the change affects.
- **Licensing:** code is MIT. Game data taken from the wiki is CC BY-SA 4.0 and must keep its credit. Icons are game artwork © THQ Nordic AB (via the wiki; see `site/icons/CREDITS.md`), not CC BY-SA, and the site must keep working without them. Never ship files taken from the game's own data.
- **Display names:** the game's own names win over the wiki's (e.g. the wiki's "Wooden Log" is "Timber" in-game). Wiki names are used only as internal IDs.
- This project isn't affiliated with piratespark.github.io; credit it only as inspiration.
