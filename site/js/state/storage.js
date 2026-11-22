// @ts-check
/**
 * Browser storage, made safe. Every key starts with KEY_PREFIX, because all GitHub Pages projects of
 * one user share a storage area (docs/storage-and-export.md). Blocked or full storage (private
 * browsing, quota) never throws: reads give null, writes report false so the UI can say so.
 * Used by the prefs now, and by tabs (sessionStorage) and the saved library (localStorage) later.
 */

export const KEY_PREFIX = 'oddsparks-calc:v1:';

/** @param {'local' | 'session'} area @returns {Storage | null} */
const store = (area) => {
  try {
    return (area === 'local' ? globalThis.localStorage : globalThis.sessionStorage) ?? null;
  } catch {
    return null; // some browsers throw just for touching storage when it's blocked
  }
};

/** @param {'local' | 'session'} area @param {string} name key without the prefix @returns {unknown} null when missing, unreadable or blocked */
export function readJson(area, name) {
  try {
    const text = store(area)?.getItem(KEY_PREFIX + name);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/** @param {'local' | 'session'} area @param {string} name @param {unknown} value @returns {boolean} false when storage is blocked or full */
export function writeJson(area, name, value) {
  try {
    const s = store(area);
    if (!s) return false;
    s.setItem(KEY_PREFIX + name, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Stored or pasted data as an object to read fields from; anything else (null, arrays, text) as {}. @param {unknown} v @returns {Record<string, unknown>} */
export const asRecord = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? /** @type {Record<string, unknown>} */ (v) : {});
