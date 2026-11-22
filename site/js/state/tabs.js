// @ts-check
/**
 * The open tabs (docs/storage-and-export.md, "Open tabs"): one calc each, kept in sessionStorage so a
 * reload keeps them and closing the browser tab ends them. Pure, apart from the two storage helpers at
 * the end: every function returns a new session.
 *
 * A tab is "dirty" once it's changed since it was opened (or, from step 10, saved); only a dirty tab
 * asks before closing. `tabId` links it to its saved copy in the library (step 10), null until then.
 * `missing` lists ids its calc lost because they no longer exist in the game data (a share link, a
 * restored session, later a saved tab); the page shows them until dismissed.
 */
import { cleanCalc, emptyCalc } from './calc.js';
import { asRecord, readJson, writeJson } from './storage.js';
import { buildingName, recipeName } from '../data/names.js';

/** @typedef {import('./calc.js').TabCalc} TabCalc */
/**
 * @typedef {object} OpenTab
 * @property {string} key unique among the open tabs
 * @property {string | null} tabId its saved copy in the library (step 10)
 * @property {string | null} name set by the user; null: named after its calc
 * @property {TabCalc} draft
 * @property {boolean} dirty changed since opened or saved
 * @property {string[]} missing ids dropped because they no longer exist
 */
/** @typedef {{ open: OpenTab[], active: string }} Session */

const SESSION_NAME = 'session';

/** A key that won't repeat within a session. */
export const newKey = () => `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** @param {string} key @param {TabCalc} [draft] @param {string[]} [missing] @returns {OpenTab} */
const blankTab = (key, draft = emptyCalc(), missing = []) => ({ key, tabId: null, name: null, draft, dirty: false, missing });

/** @param {string} key @returns {Session} */
export const newSession = (key) => ({ open: [blankTab(key)], active: key });

/** @param {Session} s @returns {OpenTab} */
export const activeTab = (s) => s.open.find((t) => t.key === s.active) ?? s.open[0];

/** Nothing chosen and never touched: opening something replaces it instead of adding a tab. @param {OpenTab} t */
const isUntouched = (t) => !t.dirty && t.tabId == null && t.name == null && !t.draft.building;

/** @param {Session} s @param {(t: OpenTab) => OpenTab} fn @returns {Session} */
const changeActive = (s, fn) => {
  const tab = activeTab(s);
  const next = fn(tab);
  return next === tab ? s : { ...s, open: s.open.map((t) => (t === tab ? next : t)) };
};

/**
 * Open a share link (later: a saved tab). Its calc opens as the active tab, replacing an untouched
 * empty one. A link whose recipe no longer exists opens nothing; what it named shows on the current tab.
 * @param {Session} s @param {{ calc: TabCalc | null, missing: string[] }} link from fromShareHash or cleanCalc
 * @param {string} key for the new tab
 * @returns {Session}
 */
export function openLink(s, { calc, missing }, key) {
  if (!calc) return missing.length ? changeActive(s, (t) => ({ ...t, missing })) : s;
  const fresh = blankTab(key, calc, missing);
  const current = activeTab(s);
  return { open: isUntouched(current) ? s.open.map((t) => (t === current ? fresh : t)) : [...s.open, fresh], active: key };
}

/** @param {Session} s @param {string} key @returns {Session} */
export const newTab = (s, key) => ({ open: [...s.open, blankTab(key)], active: key });

/** @param {Session} s @param {string} key @returns {Session} */
export const selectTab = (s, key) => (s.open.some((t) => t.key === key) ? { ...s, active: key } : s);

/**
 * Close a tab; the one to its right (else left) becomes active. The last tab is replaced by a new one.
 * @param {Session} s @param {string} key @param {string} replacementKey used when the last tab closes
 * @returns {Session}
 */
export function closeTab(s, key, replacementKey) {
  const i = s.open.findIndex((t) => t.key === key);
  if (i < 0) return s;
  const open = s.open.filter((t) => t.key !== key);
  if (!open.length) return newSession(replacementKey);
  return { open, active: s.active === key ? open[Math.min(i, open.length - 1)].key : s.active };
}

/**
 * A blank name goes back to the automatic one. Renaming doesn't make a tab dirty: the name isn't part
 * of the calculation (step 10 decides how a rename reaches the saved copy).
 * @param {Session} s @param {string} key @param {string} name @returns {Session}
 */
export const renameTab = (s, key, name) => ({
  ...s,
  open: s.open.map((t) => (t.key === key ? { ...t, name: name.trim() || null } : t)),
});

/**
 * Change the active tab's calc (the same updaters as everywhere, site/js/state/calc.js). Any change,
 * including the tree/list view (it's stored with the tab), makes it dirty.
 * @param {Session} s @param {(calc: TabCalc) => TabCalc} fn @returns {Session}
 */
export const updateActive = (s, fn) => changeActive(s, (t) => {
  const draft = fn(t.draft);
  return draft === t.draft ? t : { ...t, draft, dirty: true };
});

/** Hide the active tab's "no longer exists" note. @param {Session} s @returns {Session} */
export const dismissMissing = (s) => changeActive(s, (t) => (t.missing.length ? { ...t, missing: [] } : t));

/** "Wooden Blade ×3", or the building, or "New calculation". @param {any} game @param {OpenTab} tab */
export function tabLabel(game, tab) {
  if (tab.name) return tab.name;
  const { recipe, building, count } = tab.draft;
  if (recipe) return `${recipeName(game, recipe)} ×${count}`;
  return building ? buildingName(game, building) : 'New calculation';
}

/**
 * A stored session, checked against the current data: bad entries are dropped, calcs cleaned (a tab
 * whose recipe no longer exists opens empty, with the lost ids in `missing`). Never empty.
 * @param {any} game @param {unknown} stored
 * @param {Parameters<typeof cleanCalc>[2]} resolve
 * @param {() => string} makeKey
 * @returns {Session}
 */
export function cleanSession(game, stored, resolve, makeKey) {
  const s = asRecord(stored);
  const seen = new Set();
  /** @type {OpenTab[]} */
  const open = [];
  for (const raw of Array.isArray(s.open) ? s.open : []) {
    const e = asRecord(raw);
    if (typeof e.key !== 'string' || seen.has(e.key)) continue;
    seen.add(e.key);
    const { calc, missing } = cleanCalc(game, e.draft, resolve);
    const before = Array.isArray(e.missing) ? e.missing.filter((m) => typeof m === 'string') : [];
    open.push({
      key: e.key,
      tabId: typeof e.tabId === 'string' ? e.tabId : null,
      name: typeof e.name === 'string' && e.name.trim() ? e.name : null,
      draft: calc ?? emptyCalc(),
      dirty: e.dirty === true,
      missing: [...new Set([...before, ...missing])],
    });
  }
  if (!open.length) return newSession(makeKey());
  return { open, active: typeof s.active === 'string' && seen.has(s.active) ? s.active : open[0].key };
}

/** The open tabs from sessionStorage, checked (see cleanSession). @param {any} game @param {Parameters<typeof cleanCalc>[2]} resolve */
export const readStoredSession = (game, resolve) => cleanSession(game, readJson('session', SESSION_NAME), resolve, newKey);

/** @param {Session} s @returns {boolean} false when the browser blocks storage */
export const storeSession = (s) => writeJson('session', SESSION_NAME, s);
