// @ts-check
/** Display names for ids, shared by the UI, the badges and the tools (no UI dependencies). */

/** @param {any} game @param {string} id */
export const itemName = (game, id) => game.items[id]?.displayName ?? id;
/** @param {any} game @param {string} id */
export const buildingName = (game, id) => game.buildings[id]?.displayName ?? id;
/** @param {any} game @param {string} id */
export const recipeName = (game, id) => game.recipes[id]?.name ?? id;
/** "Sawbench: Sawn Timber" @param {any} game @param {string} id a recipe id */
export const recipeLabel = (game, id) => `${buildingName(game, game.recipes[id].building)}: ${recipeName(game, id)}`;
/** @param {any} game @param {string} id */
export const crewName = (game, id) => game.crews[id]?.label ?? id;
/** "2 Stumpy (×2)", for crew menus @param {any} game @param {string} id */
export const crewOption = (game, id) => `${crewName(game, id)} (×${game.crews[id].multiplier})`;
/** "Data: wiki snapshot of 22 Nov 2026 (wiki-2026-11-22-4cb81ba8)." for the footer and the Excel Summary @param {{ extractedAt: string, dataVersion: string }} meta */
export const dataVersionLabel = (meta) =>
  `Data: wiki snapshot of ${new Date(meta.extractedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })} (${meta.dataVersion}).`;

/** "inputs.raw-aether.amount" → "amount of Raw Aether"; "duration" → "craft time". Item names need a game. */
const FIELD_NAMES = /** @type {Record<string, string>} */ ({ duration: 'craft time', usesFuel: 'fuel', randomised: 'random output', cycles: 'cycles', temperature: 'temperature' });
/** @param {any} game @param {string} path a field path (site/js/data/merge.js FIELD_PATH) */
export function describePath(game, path) {
  const [, item, field] = path.split('.');
  return item ? `${field} of ${itemName(game, item)}` : FIELD_NAMES[path] ?? path;
}

/** 0.75 → "75%", 0.3333 → "33.3%". */
export const percent = (/** @type {number} */ v) => `${Math.round(v * 1000) / 10}%`;
