// @ts-check
/**
 * Check the generated data and the hand-edited overrides before anything uses them.
 * Pure: returns errors (must fix), warnings (worth knowing) and a summary. CLI: tools/validate-data.mjs.
 */
import { FIELD_PATH, ID_KINDS, SLUG, applyOverrides, getPath, openIssues } from '../../site/js/data/merge.js';
import { recipeShape } from '../wiki/build.mjs';

const REQUIRED_KEYS = ['sparkCrews', 'defaultCrew', 'items', 'buildings', 'defaultRecipe', 'raw', 'corrections', 'confirmed', 'mergeRecipes', 'renamedIds'];
const OPTIONAL_KEYS = ['_about'];
const RECIPE_ID = new RegExp(`^${SLUG}(--${SLUG})*$`);

const positive = (/** @type {unknown} */ v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
const isOdds = (/** @type {unknown} */ v) => typeof v === 'number' && v > 0 && v <= 1;
const isField = (/** @type {any} */ recipe, /** @type {string} */ path) => getPath(recipe, path).found;

/** Is `v` an acceptable value for a correction of `path`? @param {string} path @param {unknown} v */
function validValue(path, v) {
  if (path === 'temperature') return typeof v === 'number' || v === 'insulated';
  if (path === 'usesFuel' || path === 'randomised') return typeof v === 'boolean';
  if (path.endsWith('.odds')) return isOdds(v);
  return positive(v);
}

/** @typedef {(message: string) => void} Report */

/** Everything later checks rely on is present, so they can't crash. @param {any} data @param {any} overrides @param {Report} err */
function checkShape(data, overrides, err) {
  for (const k of ['meta', 'buildings', 'items', 'recipes']) if (!data?.[k] || typeof data[k] !== 'object') err(`data: missing "${k}"`);
  for (const [id, r] of Object.entries(data?.recipes ?? {})) {
    const bad = [
      ...['inputs', 'outputs', 'sources'].filter((k) => !Array.isArray(r[k])),
      ...['conflicts', 'valueFrom', 'problems'].filter((k) => !r[k] || typeof r[k] !== 'object' || Array.isArray(r[k])),
    ];
    if (bad.length) err(`recipe ${id}: missing or malformed ${bad.join(', ')}`);
  }
  for (const k of REQUIRED_KEYS) if (!(k in overrides)) err(`overrides: missing "${k}" (use an empty list or object)`);
  for (const k of ID_KINDS) if (!overrides.renamedIds?.[k] || typeof overrides.renamedIds[k] !== 'object') err(`overrides: renamedIds needs a "${k}" object`);
}

/** The generated oddsparks.json. @param {any} data @param {Report} err */
function checkData(data, err) {
  for (const [id, r] of Object.entries(data.recipes)) {
    const at = `recipe ${id}`;
    if (!RECIPE_ID.test(id)) err(`${at}: id is not a slug`);
    if (!data.buildings[r.building]) err(`${at}: unknown building ${r.building}`);
    if (!r.outputs.length) err(`${at}: has no outputs`);
    for (const kind of ['inputs', 'outputs']) {
      for (const l of r[kind]) {
        if (!data.items[l.item]) err(`${at}: unknown item ${l.item}`);
        if (l.amount === null ? !(`${kind}.${l.item}.amount` in r.problems) : !positive(l.amount)) err(`${at}: amount of ${l.item} must be a positive number, or null with a problem saying why`);
        if (l.odds != null && !isOdds(l.odds)) err(`${at}: odds of ${l.item} must be between 0 and 1`);
      }
    }
    if (r.duration === null ? !('duration' in r.problems) : !positive(r.duration)) err(`${at}: duration must be a positive number, or null with a problem saying why`);
    for (const path of [...Object.keys(r.conflicts), ...Object.keys(r.problems)]) {
      if (!FIELD_PATH.test(path)) err(`${at}: "${path}" isn't a field path overrides can address (update FIELD_PATH in site/js/data/merge.js)`);
    }
    if (!r.sources.length || r.sources.some((/** @type {any} */ s) => !s.page || !Number.isInteger(s.revid))) err(`${at}: every value needs a source page and revision`);
  }
}

/** The hand-edited overrides.json. @param {any} data @param {any} overrides @param {Report} err */
function checkOverrides(data, overrides, err) {
  /** @param {any} o @param {string} where @param {boolean} needReason */
  const sourced = (o, where, needReason) => {
    if (needReason && !o.reason?.trim()) err(`${where}: needs a reason`);
    if (!o.source?.trim()) err(`${where}: needs a source`);
  };
  for (const k of Object.keys(overrides)) if (![...REQUIRED_KEYS, ...OPTIONAL_KEYS].includes(k)) err(`overrides: unknown key "${k}"`);

  const crewIds = new Set();
  for (const c of overrides.sparkCrews) {
    if (crewIds.has(c.id)) err(`sparkCrews: duplicate id ${c.id}`);
    crewIds.add(c.id);
    if (!new RegExp(`^${SLUG}$`).test(c.id)) err(`sparkCrews ${c.id}: id must be lowercase words joined by hyphens (saved tabs store it)`);
    if (!positive(c.multiplier)) err(`sparkCrews ${c.id}: multiplier must be a positive number`);
    if (!['confirmed', 'unverified'].includes(c.status)) err(`sparkCrews ${c.id}: status must be confirmed or unverified`);
    sourced(c, `sparkCrews ${c.id}`, false);
  }
  if (!crewIds.has(overrides.defaultCrew)) err(`defaultCrew ${overrides.defaultCrew} is not in sparkCrews`);

  for (const [kind, map] of /** @type {const} */ ([['items', data.items], ['buildings', data.buildings]])) {
    for (const [id, o] of Object.entries(overrides[kind])) {
      if (!map[id]) err(`${kind}.${id}: no such ${kind.slice(0, -1)} in the data`);
      if (o.displayName !== undefined && !o.displayName?.trim()) err(`${kind}.${id}: displayName is empty`);
      if (o.aliases !== undefined && !Array.isArray(o.aliases)) err(`${kind}.${id}: aliases must be a list`);
      sourced(o, `${kind}.${id}`, true);
    }
  }
  for (const item of overrides.raw) if (!data.items[item]) err(`raw: no such item ${item}`);

  const dropped = new Set(overrides.mergeRecipes.map((/** @type {any} */ m) => m.drop));
  const survives = (/** @type {string} */ id) => Boolean(data.recipes[id]) && !dropped.has(id);
  for (const m of overrides.mergeRecipes) {
    const where = `mergeRecipes ${m.drop} → ${m.keep}`;
    sourced(m, where, true);
    if (!data.recipes[m.keep] || !data.recipes[m.drop]) { err(`${where}: both recipes must exist`); continue; }
    if (m.keep === m.drop || dropped.has(m.keep)) err(`${where}: keep must be a different, surviving recipe`);
    if (recipeShape(data.recipes[m.keep]) !== recipeShape(data.recipes[m.drop])) err(`${where}: only recipes with the same building and items can be merged`);
  }
  for (const [item, id] of Object.entries(overrides.defaultRecipe)) {
    if (!data.items[item]) err(`defaultRecipe ${item}: no such item`);
    else if (!survives(/** @type {string} */ (id))) err(`defaultRecipe ${item}: no such recipe ${id}`);
    else if (!data.recipes[id].outputs.some((/** @type {any} */ o) => o.item === item)) err(`defaultRecipe ${item}: ${id} doesn't make it`);
  }
  for (const c of overrides.corrections) {
    const where = `corrections ${c.recipe} ${c.path}`;
    sourced(c, where, true);
    if (!survives(c.recipe)) err(`${where}: no such recipe`);
    else if (!isField(data.recipes[c.recipe], c.path)) err(`${where}: not a field of this recipe`);
    else if (!validValue(c.path, c.value)) err(`${where}: value ${JSON.stringify(c.value)} has the wrong type`);
  }
  for (const c of overrides.confirmed) {
    const where = `confirmed ${c.recipe}`;
    sourced(c, where, false);
    if (!c.paths?.length) { err(`${where}: list the confirmed paths`); continue; }
    if (!survives(c.recipe)) { err(`${where}: no such recipe`); continue; }
    for (const p of c.paths) if (!isField(data.recipes[c.recipe], p)) err(`${where}: ${p} is not a field of this recipe`);
  }

  /** @type {Record<string, (id: string) => boolean>} */
  const exists = { recipes: (id) => Boolean(data.recipes[id]), items: (id) => Boolean(data.items[id]), crews: (id) => crewIds.has(id) };
  const target = { recipes: survives, items: exists.items, crews: exists.crews };
  for (const kind of ID_KINDS) {
    for (const [from, to] of Object.entries(overrides.renamedIds[kind])) {
      if (exists[kind](from)) err(`renamedIds.${kind} ${from}: that id still exists, so it can't be renamed`);
      if (!target[kind](/** @type {string} */ (to))) err(`renamedIds.${kind} ${from}: target ${to} doesn't exist`);
    }
  }
}

/** Things worth knowing about the merged game. @param {any} data @param {any} overrides */
function summarize(data, overrides) {
  const game = applyOverrides(data, overrides);
  const recipes = Object.values(game.recipes);
  const issuesPerRecipe = recipes.map((r) => openIssues(r));
  const withIssue = (/** @type {string} */ kind) => issuesPerRecipe.filter((list) => list.some((i) => i.kind === kind)).length;
  const warnings = Object.entries(game.items).filter(([, i]) => i.defaultTiedById.length).sort().map(([id, i]) =>
    `default recipe for ${id} decided by id only: ${i.defaultRecipe} (tied with ${i.defaultTiedById.join(', ')}). Set defaultRecipe to choose.`);
  return {
    warnings,
    summary: {
      recipes: recipes.length,
      merged: overrides.mergeRecipes.length,
      corrected: overrides.corrections.length,
      confirmedRecipes: recipes.filter((r) => Object.keys(r.confirmed).length).length,
      openConflicts: withIssue('conflict'),
      missingValues: withIssue('missing'),
      singlePage: withIssue('single-page'),
      displayNames: Object.values(game.items).filter((i) => i.displayName !== i.name).length,
    },
  };
}

/**
 * @param {any} data contents of oddsparks.json
 * @param {any} overrides contents of overrides.json
 * @returns {{ errors: string[], warnings: string[], summary: ReturnType<typeof summarize>['summary'] | null }}
 */
export function validate(data, overrides) {
  /** @type {string[]} */
  const errors = [];
  const err = (/** @type {string} */ m) => { errors.push(m); };
  checkShape(data, overrides, err);
  if (!errors.length) {
    checkData(data, err);
    checkOverrides(data, overrides, err);
  }
  if (errors.length) return { errors, warnings: [], summary: null };
  return { errors, ...summarize(data, overrides) };
}
