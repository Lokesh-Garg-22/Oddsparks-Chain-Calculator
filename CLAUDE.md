# CLAUDE.md

Oddsparks production chain calculator ("Pirate-Spark-V2"): a static site for GitHub Pages.

## Read first

1. [docs/context.md](docs/context.md): current status and next step.
2. [docs/plan.md](docs/plan.md): the approved plan.
3. [docs/decisions.md](docs/decisions.md): what was decided, and why.

## Rules

- **Planning gate:** write no application code and no scaffolding until the owner says **"execute the plan"**. Docs in `docs/` are allowed. If you're unsure whether something counts as execution, ask.
- **Never invent game data.** Every machine, recipe, input, output and time needs a source (wiki page + revision, game files or an in-game reading). Anything without one is marked `UNVERIFIED` and listed in [docs/unverified.md](docs/unverified.md).
- **Keep the docs current.** After each build step or decision, update `docs/context.md` (status and next step) and `docs/decisions.md` (dated entry), plus any other doc the change affects.
- **Licensing:** code is MIT. Data and icons taken from the wiki are CC BY-SA 4.0 and must keep their credit. Never ship files taken from the game's own data.
- **Display names:** the game's own names win over the wiki's (e.g. the wiki's "Wooden Log" is "Timber" in-game). Wiki names are used only as internal IDs.
- This project isn't affiliated with piratespark.github.io; credit it only as inspiration.
