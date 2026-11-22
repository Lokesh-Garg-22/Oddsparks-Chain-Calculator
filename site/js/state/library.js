// @ts-check
/**
 * The saved library (docs/storage-and-export.md): saved tabs in nested folders, kept in localStorage
 * under one key, so tabs and folders are always written together. Pure, apart from the storage
 * helpers at the end: every operation returns a new library (or the same one when nothing changed).
 *
 * Shape: every folder lists its children in order (subfolders and tabs mixed), and `root` lists the
 * top level. Each tab and folder appears in exactly one list; cleanLibrary() repairs anything else.
 * Saved calcs are stored as they were saved and checked with cleanCalc() when opened, so a tab saved
 * with older data can say what's missing instead of silently losing it.
 */
import { asRecord, readJson, uniqueId, writeJson } from './storage.js';
import { cleanCalc } from './calc.js';

/**
 * @typedef {object} SavedTab
 * @property {string} id
 * @property {string} name
 * @property {string} createdAt ISO date
 * @property {string} updatedAt
 * @property {string} dataVersion game data it was saved with
 * @property {unknown} calc a TabCalc as saved (checked when opened)
 */
/** @typedef {{ id: string, name: string, children: string[], collapsed: boolean }} Folder */
/** @typedef {{ schema: 1, tabs: Record<string, SavedTab>, folders: Record<string, Folder>, root: string[] }} Library */
/** @typedef {string | null} Parent a folder id, or null for the top level */

const LIBRARY_NAME = 'library';
const BACKUP_FORMAT = 'oddsparks-calc-library';

/** @param {'t' | 'f'} prefix t: tab, f: folder */
export const newId = (prefix) => uniqueId(prefix);

/** @returns {Library} */
export const emptyLibrary = () => ({ schema: 1, tabs: {}, folders: {}, root: [] });

/** @param {Library} lib @param {string} id */
export const isFolder = (lib, id) => Object.hasOwn(lib.folders, id);

/** The folder holding an item: a folder id, null for the top level, undefined when it isn't in the library. @param {Library} lib @param {string} id @returns {Parent | undefined} */
export function parentOf(lib, id) {
  if (lib.root.includes(id)) return null;
  return Object.values(lib.folders).find((f) => f.children.includes(id))?.id;
}

/** @param {Library} lib @param {Parent} parent */
const childrenOf = (lib, parent) => (parent == null ? lib.root : lib.folders[parent].children);

/** Where an item sits: its folder (null: top level) and its place in that list; null when it isn't in the library. @param {Library} lib @param {string} id */
export function positionOf(lib, id) {
  const parent = parentOf(lib, id);
  return parent === undefined ? null : { parent, index: childrenOf(lib, parent).indexOf(id) };
}

/** @param {Library} lib @param {Parent} parent @param {string[]} children @returns {Library} */
const withChildren = (lib, parent, children) =>
  parent == null ? { ...lib, root: children } : { ...lib, folders: { ...lib.folders, [parent]: { ...lib.folders[parent], children } } };

/** Take an item out of its list. @param {Library} lib @param {string} id @returns {Library} */
function detach(lib, id) {
  const parent = parentOf(lib, id);
  return parent === undefined ? lib : withChildren(lib, parent, childrenOf(lib, parent).filter((c) => c !== id));
}

/** @param {Library} lib @param {string} id @param {Parent} parent @param {number} [index] end when left out @returns {Library} */
function attach(lib, id, parent, index) {
  const list = [...childrenOf(lib, parent)];
  list.splice(index ?? list.length, 0, id);
  return withChildren(lib, parent, list);
}

/** Folder names from the top down to the folder holding `id` ([] at the top level). @param {Library} lib @param {string} id @returns {string[]} */
export function folderPath(lib, id) {
  const names = [];
  for (let p = parentOf(lib, id), hops = 0; p != null && hops < 100; p = parentOf(lib, p), hops++) names.unshift(lib.folders[p].name);
  return names;
}

/** Is `id` the folder `ancestor` or somewhere inside it? @param {Library} lib @param {string} id @param {string} ancestor */
function isWithin(lib, id, ancestor) {
  for (let p = /** @type {Parent | undefined} */ (id), hops = 0; p != null && hops < 100; p = parentOf(lib, p), hops++) if (p === ancestor) return true;
  return false;
}

/** Saved tabs in a folder and all its subfolders. @param {Library} lib @param {string} folderId @returns {string[]} */
export function tabsWithin(lib, folderId) {
  return lib.folders[folderId].children.flatMap((c) => (isFolder(lib, c) ? tabsWithin(lib, c) : [c]));
}

/** Every folder in tree order with its depth, for pickers; `except` leaves out a folder and its subfolders. @param {Library} lib @param {string} [except] */
export function folderList(lib, except) {
  /** @type {{ id: string, name: string, depth: number }[]} */
  const out = [];
  /** @param {string[]} ids @param {number} depth */
  const walk = (ids, depth) => {
    for (const id of ids) {
      if (!isFolder(lib, id) || id === except) continue;
      out.push({ id, name: lib.folders[id].name, depth });
      walk(lib.folders[id].children, depth + 1);
    }
  };
  walk(lib.root, 0);
  return out;
}

/**
 * Save a calc as a new tab, at the end of a folder (or the top level).
 * @param {Library} lib
 * @param {{ id: string, name: string, calc: unknown, parent: Parent, now: string, dataVersion: string }} t
 * @returns {Library}
 */
export function addTab(lib, { id, name, calc, parent, now, dataVersion }) {
  const tab = { id, name: name.trim() || 'Untitled', createdAt: now, updatedAt: now, dataVersion, calc };
  return attach({ ...lib, tabs: { ...lib.tabs, [id]: tab } }, id, parent != null && isFolder(lib, parent) ? parent : null);
}

/** Save over an existing tab. @param {Library} lib @param {string} id @param {{ name: string, calc: unknown, now: string, dataVersion: string }} t @returns {Library} */
export const updateTab = (lib, id, { name, calc, now, dataVersion }) =>
  Object.hasOwn(lib.tabs, id) ? { ...lib, tabs: { ...lib.tabs, [id]: { ...lib.tabs[id], name: name.trim() || lib.tabs[id].name, calc, updatedAt: now, dataVersion } } } : lib;

/** Rename a tab or folder; a blank name is ignored. @param {Library} lib @param {string} id @param {string} name @returns {Library} */
export function rename(lib, id, name) {
  const n = name.trim();
  if (!n) return lib;
  if (isFolder(lib, id)) return { ...lib, folders: { ...lib.folders, [id]: { ...lib.folders[id], name: n } } };
  return Object.hasOwn(lib.tabs, id) ? { ...lib, tabs: { ...lib.tabs, [id]: { ...lib.tabs[id], name: n } } } : lib;
}

/** A copy of a tab right after it, named "… (copy)". @param {Library} lib @param {string} id @param {string} copyId @param {string} now @returns {Library} */
export function duplicateTab(lib, id, copyId, now) {
  const tab = lib.tabs[id];
  const parent = parentOf(lib, id);
  if (!tab || parent === undefined) return lib;
  const copy = { ...tab, id: copyId, name: `${tab.name} (copy)`, createdAt: now, updatedAt: now };
  return attach({ ...lib, tabs: { ...lib.tabs, [copyId]: copy } }, copyId, parent, childrenOf(lib, parent).indexOf(id) + 1);
}

/** @param {Library} lib @param {string} id @returns {Library} */
export function deleteTab(lib, id) {
  if (!Object.hasOwn(lib.tabs, id)) return lib;
  const { [id]: _, ...tabs } = lib.tabs;
  return { ...detach(lib, id), tabs };
}

/** @param {Library} lib @param {{ id: string, name: string, parent: Parent }} f @returns {Library} */
export function addFolder(lib, { id, name, parent }) {
  const folder = { id, name: name.trim() || 'New folder', children: [], collapsed: false };
  return attach({ ...lib, folders: { ...lib.folders, [id]: folder } }, id, parent != null && isFolder(lib, parent) ? parent : null);
}

/** A folder and every folder inside it. @param {Library} lib @param {string} id @returns {string[]} */
const foldersWithin = (lib, id) => [id, ...lib.folders[id].children.filter((c) => isFolder(lib, c)).flatMap((c) => foldersWithin(lib, c))];

/**
 * Delete a folder. Its contents either move up one level, where the folder was, or are deleted with it.
 * @param {Library} lib @param {string} id @param {'move-up' | 'delete'} contents
 * @returns {Library}
 */
export function deleteFolder(lib, id, contents) {
  const parent = parentOf(lib, id);
  if (!isFolder(lib, id) || parent === undefined) return lib;
  const goneTabs = new Set(contents === 'delete' ? tabsWithin(lib, id) : []);
  const goneFolders = new Set(contents === 'delete' ? foldersWithin(lib, id) : [id]);
  const list = childrenOf(lib, parent);
  const at = list.indexOf(id);
  const kept = contents === 'move-up' ? lib.folders[id].children : [];
  const next = withChildren(lib, parent, [...list.slice(0, at), ...kept, ...list.slice(at + 1)]);
  return {
    ...next,
    folders: Object.fromEntries(Object.entries(next.folders).filter(([f]) => !goneFolders.has(f))),
    tabs: Object.fromEntries(Object.entries(next.tabs).filter(([t]) => !goneTabs.has(t))),
  };
}

/**
 * Move a tab or folder into a folder (or the top level), at `index` or the end. A folder can't move into
 * itself or one of its own subfolders; that returns the library unchanged.
 * @param {Library} lib @param {string} id @param {Parent} parent @param {number} [index]
 * @returns {Library}
 */
export function moveItem(lib, id, parent, index) {
  if (parentOf(lib, id) === undefined) return lib;
  if (parent != null && (!isFolder(lib, parent) || (isFolder(lib, id) && isWithin(lib, parent, id)))) return lib;
  // An index counted before the item was taken out shifts by one when it moves down the same list.
  const from = childrenOf(lib, parentOf(lib, id) ?? null).indexOf(id);
  const sameList = parentOf(lib, id) === parent;
  const at = index != null && sameList && from < index ? index - 1 : index;
  return attach(detach(lib, id), id, parent, at);
}

/** @param {Library} lib @param {string} id @returns {Library} */
export const toggleFolder = (lib, id) =>
  isFolder(lib, id) ? { ...lib, folders: { ...lib.folders, [id]: { ...lib.folders[id], collapsed: !lib.folders[id].collapsed } } } : lib;

/** Ids of saved tabs whose name contains the search (any case). @param {Library} lib @param {string} query */
export function searchTabs(lib, query) {
  const q = query.trim().toLowerCase();
  return new Set(Object.values(lib.tabs).filter((t) => t.name.toLowerCase().includes(q)).map((t) => t.id));
}

/**
 * A stored or restored library, repaired: unknown shapes dropped, every item listed exactly once
 * (first place wins), loops in folders broken, and anything unlisted put at the top level.
 * @param {unknown} stored @returns {Library}
 */
export function cleanLibrary(stored) {
  const s = asRecord(stored);
  /** @type {Record<string, SavedTab>} */
  const tabs = {};
  for (const [id, raw] of Object.entries(asRecord(s.tabs))) {
    const t = asRecord(raw);
    if (typeof t.name !== 'string' || !t.calc || typeof t.calc !== 'object') continue;
    const date = (/** @type {unknown} */ v) => (typeof v === 'string' ? v : new Date(0).toISOString());
    tabs[id] = { id, name: t.name, createdAt: date(t.createdAt), updatedAt: date(t.updatedAt), dataVersion: typeof t.dataVersion === 'string' ? t.dataVersion : '', calc: t.calc };
  }
  /** @type {Record<string, Folder>} */
  const folders = {};
  for (const [id, raw] of Object.entries(asRecord(s.folders))) {
    const f = asRecord(raw);
    if (typeof f.name !== 'string' || Object.hasOwn(tabs, id)) continue;
    folders[id] = { id, name: f.name, children: Array.isArray(f.children) ? f.children.filter((c) => typeof c === 'string') : [], collapsed: f.collapsed === true };
  }
  const seen = new Set();
  /** Keep known, not-yet-listed ids, and walk into folders. @param {unknown[]} ids @returns {string[]} */
  const keep = (ids) => {
    /** @type {string[]} */
    const out = [];
    for (const id of ids) {
      if (typeof id !== 'string' || seen.has(id) || !(Object.hasOwn(tabs, id) || Object.hasOwn(folders, id))) continue;
      seen.add(id);
      out.push(id);
      if (Object.hasOwn(folders, id)) folders[id] = { ...folders[id], children: keep(folders[id].children) };
    }
    return out;
  };
  const root = keep(Array.isArray(s.root) ? s.root : []);
  // Folders and tabs no list reaches (or only a loop did) go to the top level.
  root.push(...keep([...Object.keys(folders), ...Object.keys(tabs)]));
  return { schema: 1, tabs, folders, root };
}

/**
 * Add a restored library to this one. Clashing ids get new ones; the restored top level goes after ours.
 * @param {Library} lib @param {Library} incoming @param {(prefix: 't' | 'f') => string} makeId
 * @returns {Library}
 */
export function mergeLibrary(lib, incoming, makeId) {
  const taken = (/** @type {string} */ id) => Object.hasOwn(lib.tabs, id) || Object.hasOwn(lib.folders, id);
  /** @type {Map<string, string>} */
  const ids = new Map([
    ...Object.keys(incoming.tabs).map((id) => /** @type {[string, string]} */ ([id, taken(id) ? makeId('t') : id])),
    ...Object.keys(incoming.folders).map((id) => /** @type {[string, string]} */ ([id, taken(id) ? makeId('f') : id])),
  ]);
  const map = (/** @type {string} */ id) => /** @type {string} */ (ids.get(id));
  return {
    schema: 1,
    tabs: { ...lib.tabs, ...Object.fromEntries(Object.values(incoming.tabs).map((t) => [map(t.id), { ...t, id: map(t.id) }])) },
    folders: { ...lib.folders, ...Object.fromEntries(Object.values(incoming.folders).map((f) => [map(f.id), { ...f, id: map(f.id), children: f.children.map(map) }])) },
    root: [...lib.root, ...incoming.root.map(map)],
  };
}

/**
 * A saved calc, checked against the current data for opening. When its recipe no longer exists, the
 * rest is kept with its building, so the recipe cards offer the replacement; `missing` says what went.
 * @param {any} game @param {unknown} raw @param {Parameters<typeof cleanCalc>[2]} resolve
 * @returns {{ calc: import('./calc.js').TabCalc, missing: string[] }}
 */
export function savedCalc(game, raw, resolve) {
  const first = cleanCalc(game, raw, resolve);
  if (first.calc) return { calc: first.calc, missing: first.missing };
  const r = asRecord(raw);
  const oldRecipe = typeof r.recipe === 'string' ? r.recipe : '';
  // The building of a removed recipe: as stored, or from a recipe id's "building--…" prefix.
  const building = typeof r.building === 'string' ? r.building : oldRecipe.split('--')[0];
  const rest = cleanCalc(game, { ...r, recipe: '', building }, resolve);
  return { calc: /** @type {import('./calc.js').TabCalc} */ (rest.calc), missing: [...new Set([...first.missing, ...rest.missing])] };
}

/** The backup file's content. @param {Library} lib @param {string} now */
export const toBackup = (lib, now) => ({ format: BACKUP_FORMAT, exportedAt: now, library: lib });

/** A library from a backup file's text, or null when it isn't one. @param {string} text @returns {Library | null} */
export function fromBackup(text) {
  try {
    const data = asRecord(JSON.parse(text));
    return data.format === BACKUP_FORMAT ? cleanLibrary(data.library) : null;
  } catch {
    return null;
  }
}

/** @returns {Library} */
export const readStoredLibrary = () => cleanLibrary(readJson('local', LIBRARY_NAME));

/** @param {Library} lib @returns {boolean} false when the browser blocks storage or it's full */
export const storeLibrary = (lib) => writeJson('local', LIBRARY_NAME, lib);
