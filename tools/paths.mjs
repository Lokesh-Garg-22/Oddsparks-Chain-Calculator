// @ts-check
/** File locations shared by the tools. */
import { join } from 'node:path';

/** The published site. */
export const SITE_ROOT = join(import.meta.dirname, '..', 'site');
/** Generated game data (npm run extract). */
export const DATA_FILE = join(SITE_ROOT, 'data', 'oddsparks.json');
/** Extraction report for humans (npm run extract). */
export const REPORT_FILE = join(SITE_ROOT, 'data', 'extraction-report.md');
/** Raw wikitext snapshot, git-ignored, for offline rebuilds (npm run extract -- --offline). */
export const RAW_SNAPSHOT = join(import.meta.dirname, '.cache', 'wiki-raw.json');
/** Icons (npm run icons). */
export const ICONS_DIR = join(SITE_ROOT, 'icons');
