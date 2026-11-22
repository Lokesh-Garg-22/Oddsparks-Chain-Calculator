# Vendored libraries and fonts

Third-party files saved here so the site needs no build step and no CDN at runtime. Pinned versions, with their licences next to them. The browser finds the libraries through the import map in `site/index.html`.

| What | Version | Licence | Source | Used for |
|---|---|---|---|---|
| `preact/preact.module.js`, `preact/hooks.module.js` | Preact 10.29.8 | MIT (`preact/LICENSE`) | npm `preact@10.29.8`, integrity checked against the registry | UI rendering |
| `htm/htm.module.js` | htm 3.1.1 | Apache-2.0 (`htm/LICENSE`) | npm `htm@3.1.1`, integrity checked against the registry | JSX-like templates without a build |
| `fonts/fredoka-600-latin.woff2` | Fredoka 600, Latin subset | SIL OFL 1.1 (`fonts/OFL-Fredoka.txt`) | Google Fonts | Headings and big numbers |
| `fonts/inter-latin.woff2` | Inter (variable), Latin subset | SIL OFL 1.1 (`fonts/OFL-Inter.txt`) | Google Fonts | Body text |

ExcelJS 4.4.0 is added in step 11, loaded only when someone exports.

To update one: download the exact version, check it against the registry's published integrity hash, replace the file, and update this table.
