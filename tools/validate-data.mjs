// @ts-check
/**
 * Check site/data/oddsparks.json and site/data/overrides.json.
 *
 *   npm run validate
 *
 * Exits with an error if anything must be fixed; prints warnings and a summary otherwise.
 */
import { readFile } from 'node:fs/promises';
import { DATA_FILE, OVERRIDES_FILE } from './paths.mjs';
import { validate } from './data/validate.mjs';

const [data, overrides] = await Promise.all([DATA_FILE, OVERRIDES_FILE].map(async (f) => JSON.parse(await readFile(f, 'utf8'))));
const { errors, warnings, summary } = validate(data, overrides);

for (const w of warnings) console.log(`warning: ${w}`);
for (const e of errors) console.error(`error: ${e}`);
if (errors.length) {
  console.error(`\n${errors.length} error(s). Fix site/data/overrides.json (or the extractor) and run again.`);
  process.exitCode = 1;
} else {
  console.log(`\nValid (${data.meta.dataVersion}).`, summary);
}
