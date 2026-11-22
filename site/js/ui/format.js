// @ts-check
/** Display helpers. Rates go through the formatter built from the user's prefs, never formatted inline. */

/** @typedef {import('../state/prefs.js').Prefs} Prefs */

/**
 * Round half to even, like the game (Unreal's default number formatting): 11.25 → 11.2 at 1 decimal,
 * as the owner read in-game. Other values round as usual. (docs/unverified.md: display rounding)
 */
function roundHalfEven(/** @type {number} */ v, /** @type {number} */ decimals) {
  const f = 10 ** decimals;
  const x = v * f;
  const floor = Math.floor(x);
  if (Math.abs(x - floor - 0.5) < 1e-9) return (floor % 2 === 0 ? floor : floor + 1) / f;
  return Math.round(x) / f;
}

/**
 * A number with up to `decimals` places, no trailing zeros ("1.25", "4", "0.33").
 * Small non-zero values keep two significant digits instead of rounding to 0 ("0.0041").
 */
export function num(/** @type {number | null | undefined} */ v, decimals = 2) {
  if (v == null || Number.isNaN(v)) return '?';
  if (v !== 0 && Math.abs(v) < 10 ** -decimals) return Number(v.toPrecision(2)).toString();
  return Number(roundHalfEven(v, decimals).toFixed(decimals)).toString();
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
    /** a plain amount (pieces per craft) */
    amount: (/** @type {number | null} */ v) => num(v, decimals),
    /** an exact machine count */
    machines: (/** @type {number | null} */ v) => num(v, decimals),
    /** a craft time in seconds (doesn't follow the rate unit) */
    seconds: (/** @type {number | null} */ s) => `${num(s, 2)} s`,
  };
}
/** @typedef {ReturnType<typeof makeFormat>} Format */

export { buildingName, crewName, crewOption, itemName, recipeLabel, recipeName } from '../data/names.js';
import { itemName } from '../data/names.js';

/** "2 Stumpy Spark + 2 Wooden Panel" @param {any} game @param {{ item: string, amount: number | null }[]} lines */
export const lineList = (game, lines) => lines.map((l) => `${l.amount ?? '?'} ${itemName(game, l.item)}`).join(' + ');

/** Buildings (ids, no repeats) that can make an item. @param {any} game @param {string} item */
export const buildingsMaking = (game, item) => [...new Set(game.items[item].producers.map((/** @type {string} */ r) => game.recipes[r].building))];

/** Initials for an icon placeholder: "Sawn Timber" → "ST". */
export const initials = (/** @type {string} */ name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
