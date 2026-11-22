// @ts-check
/** Display names for ids, shared by the UI, the badges and the tools (no UI dependencies). */

/** @param {any} game @param {string} id */
export const itemName = (game, id) => game.items[id]?.displayName ?? id;
/** @param {any} game @param {string} id */
export const buildingName = (game, id) => game.buildings[id]?.displayName ?? id;
/** @param {any} game @param {string} id */
export const recipeName = (game, id) => game.recipes[id]?.name ?? id;
/** @param {any} game @param {string} id */
export const crewName = (game, id) => game.crews[id]?.label ?? id;

/** "inputs.raw-aether.amount" → "amount of Raw Aether"; "duration" → "craft time". Item names need a game. */
const FIELD_NAMES = /** @type {Record<string, string>} */ ({ duration: 'craft time', usesFuel: 'fuel', randomised: 'random output', cycles: 'cycles', temperature: 'temperature' });
/** @param {any} game @param {string} path a field path (site/js/data/merge.js FIELD_PATH) */
export function describePath(game, path) {
  const [, item, field] = path.split('.');
  return item ? `${field} of ${itemName(game, item)}` : FIELD_NAMES[path] ?? path;
}

/** 0.75 → "75%", 0.3333 → "33.3%". */
export const percent = (/** @type {number} */ v) => `${Math.round(v * 1000) / 10}%`;
