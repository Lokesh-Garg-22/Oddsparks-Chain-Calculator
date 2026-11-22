// @ts-check
/**
 * The user's display settings, remembered per browser in localStorage (docs/storage-and-export.md).
 * Whatever is stored is checked against what the app knows, so an old or hand-edited value falls
 * back to the default instead of breaking the page. Storage that's blocked (private browsing) just
 * means settings last until the page closes.
 */
import { OPTIONAL_KEYS } from '../engine/columns.js';
import { asRecord, readJson, writeJson } from './storage.js';

/** Stored as KEY_PREFIX + 'prefs'. The theme script in site/index.html reads the same key (a test checks it). */
export const PREFS_NAME = 'prefs';

/**
 * @typedef {object} Prefs
 * @property {'min' | 'sec'} unit rate unit
 * @property {2 | 1} decimals 1 is "like the game" (11.2 instead of 11.25)
 * @property {string} defaultCrew crew for rows without their own
 * @property {'system' | 'light' | 'dark'} theme
 * @property {string[]} columns optional build-list columns turned on (keys from engine/columns.js)
 */

/** @param {any} game @returns {Prefs} */
export const defaultPrefs = (game) => ({ unit: 'min', decimals: 2, defaultCrew: game.defaultCrew, theme: 'system', columns: [] });

/** @template T @param {unknown} v @param {readonly T[]} allowed @param {T} fallback @returns {T} */
const oneOf = (v, allowed, fallback) => (allowed.includes(/** @type {T} */ (v)) ? /** @type {T} */ (v) : fallback);

/**
 * Stored prefs, checked: unknown values fall back to the defaults, a renamed crew is followed.
 * @param {any} game @param {unknown} stored @param {(game: any, kind: 'crews', id: string) => string | null} resolve resolveId
 * @returns {Prefs}
 */
export function cleanPrefs(game, stored, resolve) {
  const d = defaultPrefs(game);
  const s = asRecord(stored);
  return {
    unit: oneOf(s.unit, /** @type {const} */ (['min', 'sec']), d.unit),
    decimals: oneOf(s.decimals, /** @type {const} */ ([2, 1]), d.decimals),
    defaultCrew: (typeof s.defaultCrew === 'string' && resolve(game, 'crews', s.defaultCrew)) || d.defaultCrew,
    theme: oneOf(s.theme, /** @type {const} */ (['system', 'light', 'dark']), d.theme),
    columns: Array.isArray(s.columns) ? OPTIONAL_KEYS.filter((k) => /** @type {unknown[]} */ (s.columns).includes(k)) : d.columns,
  };
}

/** @param {Prefs} prefs @param {string} key @returns {Prefs} */
export const toggleColumn = (prefs, key) => ({
  ...prefs,
  columns: prefs.columns.includes(key) ? prefs.columns.filter((k) => k !== key) : OPTIONAL_KEYS.filter((k) => k === key || prefs.columns.includes(k)),
});

/** Stored prefs as saved, unchecked (pass them through cleanPrefs). */
export const readStoredPrefs = () => readJson('local', PREFS_NAME);

/** @param {Prefs} prefs @returns {boolean} false when the browser blocks saving */
export const storePrefs = (prefs) => writeJson('local', PREFS_NAME, prefs);

/** Light or dark on <html>; "system" leaves it to the OS. index.html does the same before the first paint. @param {Prefs['theme']} theme */
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
}
