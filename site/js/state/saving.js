// @ts-check
/**
 * Saving: the moves that change the open tabs and the saved library together, so the two always
 * agree. Pure: each takes both and returns both (unchanged objects when nothing applies).
 */
import { addTab, rename, updateTab } from './library.js';
import { markSaved, renameTab, tabLabel } from './tabs.js';

/** @typedef {{ session: import('./tabs.js').Session, lib: import('./library.js').Library }} Both */
/** @typedef {{ now: string, dataVersion: string }} Stamp */

/** @param {Both} both @param {string} key */
const openTab = (both, key) => both.session.open.find((t) => t.key === key);

/**
 * Save an open tab over its saved copy. A tab with no saved copy (never saved, or deleted from the
 * library) is left alone: the caller asks for Save as… instead.
 * @param {Both} both @param {string} key @param {Stamp} stamp @param {any} game
 * @returns {Both}
 */
export function saveTab(both, key, stamp, game) {
  const tab = openTab(both, key);
  if (!tab?.tabId || !Object.hasOwn(both.lib.tabs, tab.tabId)) return both;
  const name = tabLabel(game, tab);
  return { lib: updateTab(both.lib, tab.tabId, { name, calc: tab.draft, ...stamp }), session: markSaved(both.session, key, tab.tabId, name) };
}

/**
 * Save an open tab as a new saved tab in a folder; the open tab is then linked to it.
 * @param {Both} both @param {string} key @param {{ id: string, name: string, folder: string | null }} to
 * @param {Stamp} stamp @param {any} game
 * @returns {Both}
 */
export function saveTabAs(both, key, { id, name, folder }, stamp, game) {
  const tab = openTab(both, key);
  if (!tab) return both;
  const fixed = name.trim() || tabLabel(game, tab);
  return { lib: addTab(both.lib, { id, name: fixed, calc: tab.draft, parent: folder, ...stamp }), session: markSaved(both.session, key, id, fixed) };
}

/**
 * Rename an open tab, and its saved copy when it has one. A saved tab always has a name, so a blank
 * name gives it the automatic one ("Wooden Blade ×3"); an unsaved tab goes back to following its calc.
 * @param {Both} both @param {string} key @param {string} name @param {any} game
 * @returns {Both}
 */
export function renameOpenTab(both, key, name, game) {
  const tab = openTab(both, key);
  if (!tab?.tabId) return { ...both, session: renameTab(both.session, key, name) };
  const fixed = name.trim() || tabLabel(game, { ...tab, name: null });
  return { session: renameTab(both.session, key, fixed), lib: rename(both.lib, tab.tabId, fixed) };
}
