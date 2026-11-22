# Tests

## Unit tests

`npm test` runs every `*.test.mjs` with Node's built-in test runner (no dependencies). The same tests, plus `npm run validate`, run on every push and pull request (`.github/workflows/pages.yml`).

They include the owner's in-game readings and spreadsheets (`engine.test.mjs`, `export.test.mjs`). If one of those fails after a data update, the data disagrees with the real game: investigate rather than edit the test.

## Browser checks

`tests/browser/check_*.py` drive the real site in Chromium with Python Playwright (the `webapp-testing` skill's approach). Shared setup is in `common.py`: the site address, phone size, collecting console errors, the no-sideways-scroll check. Each check prints what it saw, ends with `PROBLEMS: none` or a list, and exits non-zero on problems or console errors.

```sh
.venv/Scripts/python tests/browser/run.py          # all (macOS/Linux: .venv/bin/python)
.venv/Scripts/python tests/browser/run.py library  # only checks whose name contains "library"
```

| Check | Covers |
|---|---|
| `check_chain.py` | Chain tree: crew per row, recipe switch, "I supply this", badges, collapse, build list, loops |
| `check_settings_share.py` | Settings, share links, columns menu, side panels, phone cards, dark mode |
| `check_tabs.py` | Tabs: new, rename, reload, close dialog, share links opening tabs, phone |
| `check_library.py` | Saved library: save, folders, move, search, drag, delete, back up and restore, older data, the close prompt, phone drawer |
| `check_export.py` | Excel export: the tab, folder and library files, read back and checked (formulas, Summary) |
| `check_404.py` | A missing page gets `404.html`, which links back to the calculator |

Setup: [CONTRIBUTING.md](../CONTRIBUTING.md#setup).
