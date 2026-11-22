// @ts-check
/**
 * Download item and building icons from the Oddsparks Wiki as 128 px copies.
 *
 *   npm run icons     (after npm run extract)
 *
 * Reads:  site/data/oddsparks.json (names, and the image each page's infobox shows)
 * Writes: site/icons/items/<id>.png, site/icons/buildings/<id>.png, site/icons/CREDITS.md,
 *         site/icons/sources.json (download bookkeeping: width and each wiki file's checksum;
 *         the app doesn't read it, it loads icons/<kind>/<id>.png and shows the name if missing)
 * Only icons whose wiki file changed (or that are missing locally) are downloaded again.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { DATA_FILE, ICONS_DIR, SITE_ROOT } from './paths.mjs';
import { downloadImage, fetchImageInfo } from './wiki/api.mjs';
import { candidateFiles, looksLikePng, renderCredits } from './wiki/icons.mjs';

const SOURCES = join(ICONS_DIR, 'sources.json');
const WIDTH = 128;

async function main() {
  if (!existsSync(DATA_FILE)) throw new Error('Run `npm run extract` first.');
  const data = JSON.parse(await readFile(DATA_FILE, 'utf8'));
  /** @type {{ width: number, sha1: Record<string, string> }} */
  const previous = existsSync(SOURCES) ? JSON.parse(await readFile(SOURCES, 'utf8')) : { width: WIDTH, sha1: {} };
  const sizeChanged = previous.width !== WIDTH;

  /** @type {{ key: string, name: string, candidates: string[] }[]} key: "items/<id>" | "buildings/<id>" */
  const wanted = [
    ...Object.entries(data.items).map(([id, i]) => ({ key: `items/${id}`, name: i.name, candidates: candidateFiles(i.name, i.image) })),
    ...Object.entries(data.buildings).map(([id, b]) => ({ key: `buildings/${id}`, name: b.name, candidates: candidateFiles(b.name, b.image) })),
  ];

  console.log(`Looking up ${wanted.length} icons on the wiki…`);
  const infos = await fetchImageInfo([...new Set(wanted.flatMap((w) => w.candidates))], WIDTH, { log: console.log });

  /** @type {Record<string, string>} */
  const sha1 = {};
  const rows = [];
  const missing = [];
  let downloaded = 0;
  for (const w of wanted) {
    // Icons are stored as .png, so only PNG files qualify; an unsuitable candidate falls through to the next.
    const info = w.candidates.map((c) => infos[c]).find((i) => i?.mime === 'image/png');
    if (!info) { missing.push(w.name); continue; }
    const path = `icons/${w.key}.png`;
    if (sizeChanged || previous.sha1[w.key] !== info.sha1 || !existsSync(join(SITE_ROOT, path))) {
      const bytes = await downloadImage(info.thumbUrl);
      if (!looksLikePng(bytes)) { console.log(`  ${w.name}: not a PNG, skipped`); missing.push(w.name); continue; }
      await mkdir(dirname(join(SITE_ROOT, path)), { recursive: true });
      await writeFile(join(SITE_ROOT, path), bytes);
      downloaded++;
    }
    sha1[w.key] = info.sha1;
    rows.push({ name: w.name, path, ...info });
  }

  // Remove icons that are no longer wanted or no longer on the wiki.
  for (const key of Object.keys(previous.sha1)) {
    if (!sha1[key]) await rm(join(ICONS_DIR, `${key}.png`), { force: true });
  }

  await writeFile(SOURCES, JSON.stringify({ width: WIDTH, sha1 }, null, 2) + '\n');
  await writeFile(join(ICONS_DIR, 'CREDITS.md'), renderCredits(rows, missing));
  console.log(`\n${rows.length} icons (${downloaded} downloaded, ${rows.length - downloaded} unchanged), ${missing.length} without an icon on the wiki.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
