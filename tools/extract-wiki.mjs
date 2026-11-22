// @ts-check
/**
 * Extract game data from the Oddsparks Wiki.
 *
 *   npm run extract                 read the wiki, save a raw snapshot, build the data
 *   npm run extract -- --offline    rebuild from the last raw snapshot (no network)
 *
 * Writes:
 *   site/data/oddsparks.json          generated data (never edit by hand)
 *   site/data/extraction-report.md    what to review
 *   tools/.cache/wiki-raw.json        raw wikitext snapshot (git-ignored), for offline rebuilds
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { SITE_ROOT } from './serve.mjs';
import { fetchPages, listEmbeddedIn, resolveTitles } from './wiki/api.mjs';
import { buildDataset, namesToResolve } from './wiki/build.mjs';
import { renderReport } from './wiki/report.mjs';

const RAW = join(import.meta.dirname, '.cache', 'wiki-raw.json');
const OUT_DATA = join(SITE_ROOT, 'data', 'oddsparks.json');
const OUT_REPORT = join(SITE_ROOT, 'data', 'extraction-report.md');

const log = (/** @type {string} */ msg) => console.log(msg);

/** @returns {Promise<import('./wiki/build.mjs').Snapshot>} */
async function readWiki() {
  const fetchedAt = new Date().toISOString();
  log('Listing pages that use Template:Recipe…');
  const recipePageTitles = await listEmbeddedIn('Template:Recipe', { log });
  log(`  ${recipePageTitles.length} pages. Downloading wikitext…`);
  const pages = await fetchPages([...recipePageTitles, 'Buildings'], { log });

  const { names, workstations } = namesToResolve(pages, recipePageTitles);
  log(`Resolving ${names.length} building and item names…`);
  const titles = await resolveTitles(names, { log });

  const missingBuildingPages = [...new Set(workstations.map((w) => titles[w].title))].filter((t) => !pages[t]);
  if (missingBuildingPages.length) {
    log(`Downloading ${missingBuildingPages.length} building pages that have no recipes of their own…`);
    Object.assign(pages, await fetchPages(missingBuildingPages, { log }));
  }
  return { fetchedAt, recipePageTitles, pages, titles };
}

async function main() {
  /** @type {import('./wiki/build.mjs').Snapshot} */
  let snapshot;
  if (process.argv.includes('--offline')) {
    snapshot = JSON.parse(await readFile(RAW, 'utf8'));
    log(`Offline: using snapshot from ${snapshot.fetchedAt}`);
  } else {
    snapshot = await readWiki();
    await mkdir(dirname(RAW), { recursive: true });
    await writeFile(RAW, JSON.stringify(snapshot));
  }

  const result = buildDataset(snapshot);
  await writeFile(OUT_DATA, JSON.stringify(result.data, null, 2) + '\n');
  await writeFile(OUT_REPORT, renderReport(result) + '\n');

  const c = result.data.meta.counts;
  log(`\nWrote ${c.recipes} recipes (${c.recipesWithConflicts} with conflicts, ${c.recipesWithProblems} missing values), ${c.buildings} buildings, ${c.items} items.`);
  log(`Data version ${result.data.meta.dataVersion}. Review site/data/extraction-report.md.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
