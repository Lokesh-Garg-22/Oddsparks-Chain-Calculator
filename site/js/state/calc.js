// @ts-check
/**
 * A tab's stored calculation inputs (docs/storage-and-export.md) and the only ways to change them.
 * Pure: every function returns a new object. Used by the UI, and later by tabs, share links and the
 * saved library, so they all edit a calc the same way.
 */

/**
 * @typedef {object} TabCalc
 * @property {string | null} building chosen building (kept even before a recipe is chosen)
 * @property {string} recipe the target recipe, '' until chosen
 * @property {number} count machines running the target
 * @property {Record<string, string>} crews recipe id → crew id, per row (the target's too)
 * @property {Record<string, string>} recipeChoice item id → recipe id
 * @property {string[]} supplied item ids the user supplies
 */

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
