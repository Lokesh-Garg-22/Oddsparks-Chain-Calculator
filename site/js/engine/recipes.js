// @ts-check
/**
 * Which recipe makes an item by default. Pure, no DOM. Run once per item by applyOverrides
 * (site/js/data/merge.js); the engine and UI read the result from `game.items[id].defaultRecipe`.
 */

/** Unlock tier from the quest name ("Woodcraft - 1 - Tier 1" → 1); no tier sorts last. @param {any} recipe */
function unlockTier(recipe) {
  const m = recipe.unlock?.quest?.match(/Tier\s+(\d+)/i);
  return m ? Number(m[1]) : Infinity;
}

/**
 * Sort key for picking a default, best first:
 *  1. the item is the recipe's main product (not a byproduct)
 *  2. a standard building: on the wiki's Buildings page and not a Shrine
 *  3. earliest unlock tier
 *  4. fewer inputs (a harvester before a crafted route)
 *  5. the building's position on the Buildings page (progression order: Workbench, Workstation, Workshop…)
 * @param {any} game @param {string} item @param {string} id
 * @returns {number[]}
 */
function rank(game, item, id) {
  const r = game.recipes[id];
  const b = game.buildings[r.building];
  return [
    r.outputs[0].item === item ? 0 : 1,
    b.onBuildingsPage && b.group !== 'Shrines' ? 0 : 1,
    unlockTier(r),
    r.inputs.length,
    b.pageOrder ?? Infinity,
  ];
}

/** @param {number[]} a @param {number[]} b */
const sameRank = (a, b) => a.every((v, i) => v === b[i]);

/**
 * How an item is obtained in a chain: from a recipe, or not at all (the chain stops there).
 *  - 'supplied':  the user ticked "I supply this"
 *  - 'raw':       overrides.json lists the item as raw
 *  - 'no-recipe': nothing in the data makes it
 * A harvester (a recipe with no inputs) is still a recipe: its machines are counted and the chain
 * simply has nothing further to expand.
 * @param {any} game from applyOverrides
 * @param {string} item
 * @param {{ supplied?: Set<string>, recipeChoice?: Record<string, string> }} [choices]
 *   the user's per-item recipe picks; a pick that doesn't exist or doesn't make the item is ignored
 *   (resolve saved ids with resolveId first, so renamed recipes keep the user's pick)
 * @returns {{ stop: 'supplied' | 'raw' | 'no-recipe' | null, recipe: string | null }}
 */
export function howMade(game, item, { supplied = new Set(), recipeChoice = {} } = {}) {
  if (supplied.has(item)) return { stop: 'supplied', recipe: null };
  const entry = game.items[item];
  if (!entry) return { stop: 'no-recipe', recipe: null };
  if (entry.raw) return { stop: 'raw', recipe: null };
  // A pick only counts if that recipe really makes the item (a stale or wrong pick falls back to the default).
  const picked = recipeChoice[item];
  const recipe = picked && game.recipes[picked]?.outputs.some((/** @type {{ item: string }} */ o) => o.item === item) ? picked : entry.defaultRecipe;
  return recipe ? { stop: null, recipe } : { stop: 'no-recipe', recipe: null };
}

/**
 * @param {any} game needs recipes, buildings and items[item].producers
 * @param {string} item
 * @param {string | undefined} pinned overrides.defaultRecipe[item], which always wins
 * @returns {{ id: string | null, byIdOnly: string[] }} the default (null: nothing makes it), and the
 *   recipes it tied with when only the alphabetical id decided
 */
export function chooseDefault(game, item, pinned) {
  if (pinned) return { id: pinned, byIdOnly: [] };
  const ranked = game.items[item].producers.map((/** @type {string} */ id) => ({ id, key: rank(game, item, id) }));
  if (!ranked.length) return { id: null, byIdOnly: [] };
  ranked.sort((/** @type {{ id: string, key: number[] }} */ x, /** @type {{ id: string, key: number[] }} */ y) => {
    // Compare with !== first: Infinity - Infinity is NaN.
    for (let i = 0; i < x.key.length; i++) if (x.key[i] !== y.key[i]) return x.key[i] - y.key[i];
    return x.id.localeCompare(y.id);
  });
  const [best, ...rest] = ranked;
  return { id: best.id, byIdOnly: rest.filter((r) => sameRank(r.key, best.key)).map((r) => r.id) };
}
