// @ts-check
/**
 * Layer site/data/overrides.json on top of the generated site/data/oddsparks.json, and resolve once
 * everything the engine and UI look up repeatedly. Pure: used by the app at load time and by
 * tools/validate-data.mjs. Inputs are not modified.
 */
import { byUnlockOrder, chooseDefault } from '../engine/recipes.js';

/** An id segment, as produced by the extractor's slug(). */
export const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*';
/** Field paths overrides can address; the extractor uses the same paths for `conflicts` and `problems`. */
export const FIELD_PATH = new RegExp(`^(duration|usesFuel|randomised|cycles|temperature|(inputs|outputs)\\.${SLUG}\\.amount|outputs\\.${SLUG}\\.odds)$`);
/** Kinds of id that saved tabs store, and that `renamedIds` can redirect. */
export const ID_KINDS = /** @type {const} */ (['recipes', 'items', 'crews']);

/** @typedef {{ kind: 'missing' | 'conflict' | 'single-page', path?: string, text: string }} Issue */

/**
 * Where a field path lives in a recipe. `temperature` is virtual: it spans optimalTemperature and insulated.
 * @param {any} recipe @param {string} path
 * @returns {{ target: any, key: string } | null}
 */
function locate(recipe, path) {
  if (!FIELD_PATH.test(path)) return null;
  const [kind, item, field] = path.split('.');
  if (!item) return { target: recipe, key: path };
  const line = recipe[kind].find((/** @type {{ item: string }} */ l) => l.item === item);
  return line ? { target: line, key: field } : null;
}

/** @param {any} recipe @param {string} path @returns {{ found: boolean, value?: unknown }} */
export function getPath(recipe, path) {
  const at = locate(recipe, path);
  if (!at) return { found: false };
  if (at.key === 'temperature') return { found: true, value: recipe.insulated ? 'insulated' : recipe.optimalTemperature };
  return { found: true, value: at.target[at.key] };
}

/** @param {any} recipe @param {string} path @param {unknown} value */
function setPath(recipe, path, value) {
  const at = /** @type {{ target: any, key: string }} */ (locate(recipe, path));
  if (at.key === 'temperature') {
    recipe.insulated = value === 'insulated';
    recipe.optimalTemperature = typeof value === 'number' ? value : null;
  } else {
    at.target[at.key] = value;
  }
}

/**
 * The game as the app sees it. Assumes overrides passed validation.
 *  - recipes gain `corrected` (path → { value, was, reason, source }), `confirmed` (path → source), `mergedFrom`
 *  - items gain `displayName`, `aliases`, `raw`, `producers`/`consumers` (recipe ids) and the resolved
 *    `defaultRecipe` (null when nothing makes it; `defaultTiedById` lists recipes it tied with on id only)
 *  - buildings gain `displayName`, `aliases` and `recipes` (ids, earliest unlock first)
 *  - crews are keyed by id; `crewOrder` keeps the table's order
 *  - renamedIds: { recipes, items, crews } old id → new id, for saved tabs (merged recipes included)
 * @param {any} data contents of oddsparks.json
 * @param {any} overrides contents of overrides.json
 */
export function applyOverrides(data, overrides) {
  const recipes = structuredClone(data.recipes);
  for (const r of Object.values(recipes)) Object.assign(r, { corrected: {}, confirmed: {}, mergedFrom: [] });

  const renamedIds = Object.fromEntries(ID_KINDS.map((k) => [k, { ...overrides.renamedIds[k] }]));
  for (const m of overrides.mergeRecipes) {
    recipes[m.keep].mergedFrom.push(m.drop);
    delete recipes[m.drop];
    renamedIds.recipes[m.drop] = m.keep;
  }
  for (const c of overrides.corrections) {
    const r = recipes[c.recipe];
    r.corrected[c.path] = { value: c.value, was: getPath(r, c.path).value, reason: c.reason, source: c.source };
    setPath(r, c.path, c.value);
  }
  for (const c of overrides.confirmed) {
    for (const path of c.paths) recipes[c.recipe].confirmed[path] = c.source;
  }

  /** @param {any} e @param {any} extra */
  const named = (e, extra) => ({ ...e, displayName: extra?.displayName ?? e.name, aliases: extra?.aliases ?? [] });
  const raw = new Set(overrides.raw);
  /** @type {Record<string, any>} */
  const items = Object.fromEntries(Object.entries(data.items).map(([id, e]) => [id, {
    ...named(e, overrides.items[id]), raw: raw.has(id), producers: [], consumers: [], defaultRecipe: null, defaultTiedById: [],
  }]));
  for (const [id, r] of Object.entries(recipes)) {
    for (const o of r.outputs) items[o.item].producers.push(id);
    for (const i of r.inputs) items[i.item].consumers.push(id);
  }

  const game = {
    meta: data.meta,
    buildings: Object.fromEntries(Object.entries(data.buildings).map(([id, e]) => {
      const ids = Object.keys(recipes).filter((r) => recipes[r].building === id);
      return [id, { ...named(e, overrides.buildings[id]), recipes: byUnlockOrder(recipes, ids) }];
    })),
    items,
    recipes,
    crews: Object.fromEntries(overrides.sparkCrews.map((/** @type {{ id: string }} */ c) => [c.id, c])),
    crewOrder: overrides.sparkCrews.map((/** @type {{ id: string }} */ c) => c.id),
    defaultCrew: overrides.defaultCrew,
    renamedIds,
  };
  for (const [id, item] of Object.entries(items)) {
    const choice = chooseDefault(game, id, overrides.defaultRecipe[id]);
    item.defaultRecipe = choice.id;
    item.defaultTiedById = choice.byIdOnly;
  }
  return game;
}

/**
 * Follow `renamedIds` from an id a saved tab stored to the id it has now.
 * @param {ReturnType<typeof applyOverrides>} game
 * @param {typeof ID_KINDS[number]} kind
 * @param {string} id
 * @returns {string | null} null when the id no longer exists and no rename covers it
 */
export function resolveId(game, kind, id) {
  let current = id;
  for (let hops = 0; hops < 20 && !(current in game[kind]); hops++) {
    const next = game.renamedIds[kind][current];
    if (!next) return null;
    current = next;
  }
  return current in game[kind] ? current : null;
}

/**
 * What still deserves a warning on a recipe after overrides: values no page states, disagreements,
 * and recipes seen on one page only. A correction or an in-game confirmation of a path settles it;
 * either also lifts the single-page warning.
 * @param {any} recipe a recipe from applyOverrides
 * @returns {Issue[]}
 */
export function openIssues(recipe) {
  const settled = (/** @type {string} */ path) => path in recipe.corrected || path in recipe.confirmed;
  /** @type {Issue[]} */
  const issues = [];
  for (const [path, text] of Object.entries(recipe.problems)) {
    if (!settled(path)) issues.push({ kind: 'missing', path, text: /** @type {string} */ (text) });
  }
  for (const path of Object.keys(recipe.conflicts)) {
    if (!settled(path)) issues.push({ kind: 'conflict', path, text: `wiki pages disagree on ${path}` });
  }
  const checked = Object.keys(recipe.confirmed).length + Object.keys(recipe.corrected).length > 0;
  if (recipe.sources.length === 1 && !checked) issues.push({ kind: 'single-page', text: `only on one wiki page (${recipe.sources[0].page})` });
  return issues;
}

/** How the UI names why a chain stops at an item. */
export const STOP_LABELS = /** @type {const} */ ({
  supplied: 'you supply it',
  raw: 'raw resource',
  'no-recipe': 'nothing makes it',
  loop: 'needed inside its own chain',
});

/**
 * Short tags a player should see on a recipe (cards, chain rows, the Excel Summary). The single place
 * that decides which recipe facts become warnings.
 * @param {any} recipe a recipe from applyOverrides
 * @returns {{ code: 'fuel' | 'random' | 'cycles' | 'conflict' | 'missing', text: string }[]}
 */
export function recipeTags(recipe) {
  /** @type {{ code: 'fuel' | 'random' | 'cycles' | 'conflict' | 'missing', text: string }[]} */
  const tags = [];
  if (recipe.usesFuel) tags.push({ code: 'fuel', text: 'needs fuel' });
  if (recipe.randomised) tags.push({ code: 'random', text: 'random output' });
  if (recipe.cycles) tags.push({ code: 'cycles', text: `${recipe.cycles} crafts per batch` });
  const issues = openIssues(recipe);
  if (issues.some((i) => i.kind === 'conflict')) tags.push({ code: 'conflict', text: 'sources disagree' });
  if (issues.some((i) => i.kind === 'missing')) tags.push({ code: 'missing', text: 'value missing' });
  return tags;
}
