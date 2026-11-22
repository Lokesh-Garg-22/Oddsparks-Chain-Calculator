// @ts-check
/** Display helpers. Rates go through the formatter built from the user's prefs, never formatted inline. */

/**
 * @typedef {object} Prefs the user's display settings (saved per browser from step 8)
 * @property {'min' | 'sec'} unit rate unit
 * @property {number} decimals
 * @property {string} defaultCrew crew for rows without their own
 */

/**
 * A number with up to `decimals` places, no trailing zeros ("1.25", "4", "0.33").
 * Small non-zero values keep two significant digits instead of rounding to 0 ("0.0041").
 */
export function num(/** @type {number | null | undefined} */ v, decimals = 2) {
  if (v == null || Number.isNaN(v)) return '?';
  if (v !== 0 && Math.abs(v) < 10 ** -decimals) return Number(v.toPrecision(2)).toString();
  return Number(v.toFixed(decimals)).toString();
}

/**
 * Formatting that follows the prefs. Engine values are always per minute.
 * @param {Prefs} prefs
 */
export function makeFormat({ unit, decimals }) {
  const factor = unit === 'sec' ? 1 / 60 : 1;
  return {
    /** a rate, converted to the chosen unit: "2.5" */
    rate: (/** @type {number | null} */ perMinute) => num(perMinute == null ? null : perMinute * factor, decimals),
    /** the unit in words: "per minute" */
    per: unit === 'sec' ? 'per second' : 'per minute',
    /** the unit short: "/min" */
    perShort: unit === 'sec' ? '/s' : '/min',
    /** an exact machine count */
    machines: (/** @type {number | null} */ v) => num(v, decimals),
    /** a craft time in seconds (doesn't follow the rate unit) */
    seconds: (/** @type {number | null} */ s) => `${num(s, 2)} s`,
  };
}
/** @typedef {ReturnType<typeof makeFormat>} Format */

/** @param {any} game @param {string} id */
export const itemName = (game, id) => game.items[id]?.displayName ?? id;
/** @param {any} game @param {string} id */
export const buildingName = (game, id) => game.buildings[id]?.displayName ?? id;
/** @param {any} game @param {string} id */
export const recipeName = (game, id) => game.recipes[id]?.name ?? id;
/** @param {any} game @param {string} id */
export const crewName = (game, id) => game.crews[id]?.label ?? id;

/** "2 Stumpy Spark + 2 Wooden Panel" @param {any} game @param {{ item: string, amount: number | null }[]} lines */
export const lineList = (game, lines) => lines.map((l) => `${l.amount ?? '?'} ${itemName(game, l.item)}`).join(' + ');

/** Buildings (ids, no repeats) that can make an item. @param {any} game @param {string} item */
export const buildingsMaking = (game, item) => [...new Set(game.items[item].producers.map((/** @type {string} */ r) => game.recipes[r].building))];

/** Initials for an icon placeholder: "Sawn Timber" → "ST". */
export const initials = (/** @type {string} */ name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
