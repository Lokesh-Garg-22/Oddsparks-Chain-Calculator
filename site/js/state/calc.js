// @ts-check
/**
 * A tab's stored calculation inputs (docs/storage-and-export.md) and the only ways to change them.
 * Pure: every function returns a new object. Used by the UI, and later by tabs, share links and the
 * saved library, so they all edit a calc the same way.
 */
import { asRecord } from './storage.js';

/**
 * @typedef {object} TabCalc
 * @property {string | null} building chosen building (kept even before a recipe is chosen)
 * @property {string} recipe the target recipe, '' until chosen
 * @property {number} count machines running the target
 * @property {Record<string, string>} crews recipe id → crew id, per row (the target's too)
 * @property {Record<string, string>} recipeChoice item id → recipe id
 * @property {string[]} supplied item ids the user supplies
 * @property {'tree' | 'list'} [view] how the chain is shown (default: tree)
 */
/** @typedef {(fn: (calc: TabCalc) => TabCalc) => void} Update a way to change the calc */

/** @returns {TabCalc} */
export const emptyCalc = () => ({ building: null, recipe: '', count: 1, crews: {}, recipeChoice: {}, supplied: [] });

/**
 * Choose a building, and a recipe when given or when the building has only one.
 * @param {TabCalc} calc @param {any} game @param {string} building @param {string} [recipe]
 * @returns {TabCalc}
 */
export function pickBuilding(calc, game, building, recipe) {
  const own = game.buildings[building].recipes;
  return { ...calc, building, recipe: recipe ?? (own.length === 1 ? own[0] : '') };
}

/** Start from a recipe (examples, share links): its building comes with it. @param {any} game @param {string} recipe @param {Partial<TabCalc>} [rest] */
export const fromRecipe = (game, recipe, rest = {}) => ({ ...emptyCalc(), ...rest, building: game.recipes[recipe].building, recipe });

/** @param {TabCalc} calc @param {string} recipe @returns {TabCalc} */
export const setRecipe = (calc, recipe) => ({ ...calc, recipe });

/** Ignores values that aren't a finite number ≥ 0 (a blank or half-typed field). @param {TabCalc} calc @param {number} count */
export const setCount = (calc, count) => (Number.isFinite(count) && count >= 0 ? { ...calc, count } : calc);

/** @param {TabCalc} calc @param {string} recipe @param {string} crew @returns {TabCalc} */
export const setCrew = (calc, recipe, crew) => ({ ...calc, crews: { ...calc.crews, [recipe]: crew } });

/** Use a specific recipe for an item everywhere in the chain. @param {TabCalc} calc @param {string} item @param {string} recipe @returns {TabCalc} */
export const chooseRecipe = (calc, item, recipe) => ({ ...calc, recipeChoice: { ...calc.recipeChoice, [item]: recipe } });

/** Tick or untick "I supply this". @param {TabCalc} calc @param {string} item @returns {TabCalc} */
export const toggleSupplied = (calc, item) => ({
  ...calc,
  supplied: calc.supplied.includes(item) ? calc.supplied.filter((i) => i !== item) : [...calc.supplied, item],
});

/** @param {TabCalc} calc @param {'tree' | 'list'} view @returns {TabCalc} */
export const setView = (calc, view) => ({ ...calc, view });

/**
 * A calc from outside the app (a share link, session storage, later the saved library and restores),
 * checked against the current data. Ids go through `resolve` (resolveId), so renamed ones still work;
 * ids that no longer exist are dropped and listed. Bad values fall back to the defaults.
 * @param {any} game
 * @param {unknown} raw
 * @param {(game: any, kind: 'recipes' | 'items' | 'crews', id: string) => string | null} resolve
 * @returns {{ calc: TabCalc | null, missing: string[] }} calc is null when its target recipe no longer exists
 */
export function cleanCalc(game, raw, resolve) {
  const r = asRecord(raw);
  /** @type {string[]} */
  const missing = [];
  /** @param {'recipes' | 'items' | 'crews'} kind @param {unknown} id */
  const id = (kind, id) => {
    if (typeof id !== 'string' || !id) return null;
    const found = resolve(game, kind, id);
    if (!found) missing.push(id);
    return found;
  };
  /** A map of id → id, keeping only pairs where both still exist. @param {unknown} o @param {'recipes' | 'items'} keyKind @param {'recipes' | 'crews'} valueKind */
  const idMap = (o, keyKind, valueKind) => {
    /** @type {Record<string, string>} */
    const out = {};
    for (const [k, v] of Object.entries(asRecord(o))) {
      const a = id(keyKind, k);
      const b = id(valueKind, v);
      if (a && b) out[a] = b;
    }
    return out;
  };

  const recipe = r.recipe ? id('recipes', r.recipe) : '';
  if (recipe == null) return { calc: null, missing };
  const rest = {
    count: typeof r.count === 'number' && Number.isFinite(r.count) && r.count >= 0 ? r.count : 1,
    crews: idMap(r.crews, 'recipes', 'crews'),
    recipeChoice: idMap(r.recipeChoice, 'items', 'recipes'),
    supplied: /** @type {string[]} */ ([...new Set((Array.isArray(r.supplied) ? r.supplied : []).map((i) => id('items', i)).filter((i) => i != null))]),
    ...(r.view === 'list' ? { view: /** @type {const} */ ('list') } : {}),
  };
  if (recipe) return { calc: fromRecipe(game, recipe, rest), missing };
  const building = typeof r.building === 'string' && Object.hasOwn(game.buildings, r.building) ? r.building : null;
  return { calc: { ...emptyCalc(), ...rest, building }, missing };
}
