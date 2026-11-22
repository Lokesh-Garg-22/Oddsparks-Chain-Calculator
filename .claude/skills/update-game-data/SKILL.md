---
name: update-game-data
description: Refresh, fix or confirm the Oddsparks game data used by this calculator (site/data/oddsparks.json and overrides.json). Use this whenever the task touches recipes, buildings, items, craft times, spark crew multipliers, in-game names or icons — for example re-running the wiki extraction after a game patch or wiki edit, reviewing the extraction report, fixing a wrong recipe someone reported, adding an in-game name like "Timber", recording an owner's in-game reading that confirms an UNVERIFIED value, or checking what changed between two data snapshots. Use it even when the request sounds small ("just fix this one craft time"), because every data change must keep its source, the docs and saved user tabs consistent.
---

# Update game data

This calculator is only as trustworthy as its data. Players will build real factories from these numbers, so every value needs a traceable source, and every change must keep the docs and the users' saved tabs consistent. This skill is the one way data changes are made.

## Before you start

Read these, because they hold the current state and the rules:

- `docs/data-sources.md`: where data comes from, the extraction method, known wiki quality issues
- `docs/unverified.md`: which values are assumptions and how each can be confirmed
- `docs/decisions.md`: data decisions already made (e.g. in-game names win over wiki names)

If `tools/extract-wiki.mjs`, `tools/validate-data.mjs` or `site/data/` don't exist yet, the project hasn't reached plan steps 2–4. Say so and stop. Don't improvise a replacement pipeline.

## The two data files, and why there are two

- `site/data/oddsparks.json` is **generated** by the extractor. Never edit it by hand: the next extraction would silently undo the edit and lose its reason.
- `site/data/overrides.json` is **hand-edited** and survives re-extraction. Every fix goes here, with a `reason` and a `source` (wiki page + revision, an in-game reading with date, or game files). That's how a wrong value can be traced and fixed later.

## Workflow: refresh from the wiki

1. Run `npm run extract`. This regenerates `oddsparks.json` and `site/data/extraction-report.md`. The extractor batches API requests and sends a descriptive user agent with no personal details. Don't loop or hammer the wiki.
2. Run `npm run validate`, then `npm test`. Validation catches broken item links and shape errors. The tests include the owner's in-game readings and spreadsheet chains, so a failure there means the data now disagrees with the real game. Investigate it; don't edit the test.
3. Work out what changed with `git diff --stat site/data/` and a comparison of recipe IDs, before and after. Count recipes, items and buildings that were added, removed or changed.
4. Read the extraction report and sort its entries:
   - **conflicts** (building page vs item page disagree)
   - **recipes found on only one page**
   - **likely renames**
   - **same name, different ingredients** (usually a copy-paste error on one wiki page)
   - **possible duplicates** (two extracted recipes that are really one: use `mergeRecipes`, not `renamedIds`)
   - **unknown fields** (the wiki template may have gained a field the extractor doesn't understand)

   Each recipe in `oddsparks.json` carries its own `sources`, `valueFrom`, `conflicts` and `problems`. Use those field paths (e.g. `inputs.raw-aether.amount`) when writing corrections. `npm run extract -- --offline` rebuilds from the cached snapshot, so you can iterate on the extractor without touching the wiki.
5. Handle anything that affects saved tabs. Saved tabs store recipe and item IDs (see `docs/storage-and-export.md`). If an ID was removed or renamed:
   - add a mapping in `overrides.json` (`renamedIds`) when the replacement is clear
   - otherwise list it, so the app's "saved with older data" banner can offer a replacement
   - bump the `dataVersion`
6. If new items or buildings appeared, run `npm run icons`. Only new or changed files are downloaded. It regenerates `site/icons/CREDITS.md`; check its "No icon on the wiki" list. The wiki records no per-file licence: icons are game artwork © THQ Nordic, credited to the wiki uploaders, and the app shows names wherever an icon is missing.
7. Update the docs:
   - `docs/data-sources.md`: snapshot date and counts
   - `docs/unverified.md`: new open items, newly confirmed ones
   - `docs/decisions.md`: a dated entry
   - `docs/context.md`: status
8. Report to the owner using the template below. Commit only after the owner approves, as one commit for the data update.

## Workflow: fix or confirm a single value

- **Fix:** add the correction to `overrides.json` with `reason` and `source`, run `npm run validate` and `npm test`, then update `docs/unverified.md` or `docs/decisions.md` as relevant.
- **Confirm from an in-game reading:** in `docs/unverified.md`, move the item to "Confirmed" with who measured it, the date and the observed numbers, and set the matching `confirmed` flag in `overrides.json`. Readings shown in the game are rounded to 1 decimal (11.25 shows as 11.2), so compare with that in mind.
- **In-game name:** add it to `displayName` (and `aliases` if players use another word) in `overrides.json`. Wiki names stay as the internal IDs.

## Never invent data

If a value can't be sourced, mark it `UNVERIFIED`, add it to `docs/unverified.md` with how it could be confirmed, and tell the owner. A guessed craft time looks exactly like a real one in the UI, which is why guesses are worse than gaps.

## Report template

```markdown
## Game data update — <date>
Source: <wiki snapshot date / in-game reading / game files>
Changes: +<n> / −<n> / ~<n> recipes · +<n> / −<n> items · +<n> / −<n> buildings
Saved-tab impact: <IDs removed or renamed, and how each is handled — or "none">
Conflicts: <count, with the top few listed>
Recipes found on only one page: <count>
Likely renames: <list>
Now confirmed: <items>   Still open: <count, link to docs/unverified.md>
Tests: validate <pass/fail> · npm test <pass/fail>
Needs your decision: <list, or "nothing">
```
