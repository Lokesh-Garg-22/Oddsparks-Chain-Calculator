// @ts-check
/**
 * The production chain calculation. Pure, no DOM. Rules: docs/game-mechanics.md.
 *
 *   const result = calculate(game, { recipe, count, crews, recipeChoice, supplied }, { defaultCrew })
 *   const tree = chainTree(result)
 *
 * The input is a saved tab's `calc` (docs/storage-and-export.md). Rates are per minute; a "craft" is one
 * run of a recipe. Machines are exact; `build` is the count rounded up.
 */
import { howMade } from './recipes.js';

const EPS = 1e-9;

/**
 * @typedef {object} Calc what the user asked for (a tab's stored inputs; ids already resolved)
 * @property {string} recipe the recipe to run
 * @property {number} count how many machines of it
 * @property {Record<string, string>} [crews] recipe id → crew id, per row (the target's too)
 * @property {Record<string, string>} [recipeChoice] item id → recipe id, the user's picks
 * @property {string[]} [supplied] item ids the user supplies ("I supply this")
 */
/**
 * @typedef {object} Input one input of a row, and where it comes from
 * @property {string} item
 * @property {number | null} perCraft amount per craft, after cycles (null: unknown)
 * @property {number} perMinute
 * @property {string | null} source recipe id that makes it in this chain, or null when the chain stops
 * @property {'supplied' | 'raw' | 'no-recipe' | 'loop' | null} stop why the chain stops here
 */
/**
 * @typedef {object} Output
 * @property {string} item
 * @property {number | null} perCraft expected amount per craft, after odds (null: unknown)
 * @property {number} perMinute
 * @property {number} used per minute the chain takes from this row (loops excluded)
 * @property {number} surplus per minute left over (a byproduct); 0 for the target's product
 */
/**
 * @typedef {object} Row one recipe in the chain, all its machines together
 * @property {string} recipe
 * @property {string} building
 * @property {string} crew
 * @property {number | null} multiplier null when the crew is unknown
 * @property {boolean} isTarget
 * @property {string | null} runsFor the output that sets how much it runs
 * @property {number | null} craftsPerMinute null when a craft time or amount is missing
 * @property {number | null} machines exact
 * @property {number | null} build machines rounded up
 * @property {Input[]} inputs
 * @property {Output[]} outputs
 */
/** @typedef {{ code: 'unknown-crew', recipe: string, crew: string } | { code: 'missing-value', recipe: string }} Warning */

/** Expected amount per craft: the stated amount, times the chance when the output is random. */
const expectedAmount = (/** @type {{ amount: number | null, odds?: number | null } | undefined} */ line) =>
  line?.amount == null ? null : line.amount * (line.odds ?? 1);

/** Crafts per minute of one machine: 60 / duration × crew multiplier (docs/game-mechanics.md "Rates"). */
const craftsPerMachine = (/** @type {any} */ recipe, /** @type {number} */ multiplier) => (recipe.duration ? (60 / recipe.duration) * multiplier : null);

/** Machines to build: exact count rounded up, ignoring floating-point dust (3.0000001 → 3). */
export const machinesToBuild = (/** @type {number | null} */ exact) => (exact == null ? null : Math.max(0, Math.ceil(exact - EPS)));

/**
 * Output per minute of one machine for one of its outputs (default: the main product).
 * @param {any} game @param {string} recipeId @param {string} crewId @param {string} [item]
 */
export function outputPerMachine(game, recipeId, crewId, item) {
  const r = game.recipes[recipeId];
  const crafts = craftsPerMachine(r, game.crews[crewId].multiplier);
  const amount = expectedAmount(item ? r.outputs.find((/** @type {any} */ o) => o.item === item) : r.outputs[0]);
  return crafts == null || amount == null ? null : crafts * amount;
}

/**
 * Phase 1: walk from the target to fix the dependency order. An input whose recipe is already being
 * expanded higher up the same path closes a loop: that input is cut (docs: Loops).
 * @param {any} game @param {string} root @param {(item: string) => { recipe: string | null }} how
 */
function walk(game, root, how) {
  const onPath = new Set();
  const seen = new Set();
  /** @type {string[]} */
  const postOrder = [];
  /** @type {Set<string>} "consumer|item" */
  const loopInputs = new Set();
  const visit = (/** @type {string} */ id) => {
    onPath.add(id);
    seen.add(id);
    for (const { item } of game.recipes[id].inputs) {
      const { recipe } = how(item);
      if (!recipe) continue;
      if (onPath.has(recipe)) loopInputs.add(`${id}|${item}`);
      else if (!seen.has(recipe)) visit(recipe);
    }
    onPath.delete(id);
    postOrder.push(id);
  };
  visit(root);
  return {
    order: postOrder.reverse(), // every consumer before the recipes that feed it
    isLoop: (/** @type {string} */ consumer, /** @type {string} */ item) => loopInputs.has(`${consumer}|${item}`),
  };
}

/**
 * Phase 2: rates, consumers first, so each recipe sees the summed demand of every branch before it runs.
 * @param {any} game @param {Calc} calc @param {string} defaultCrew
 * @param {ReturnType<typeof walk>} plan @param {(item: string) => ReturnType<typeof howMade>} how
 */
function computeRows(game, calc, defaultCrew, plan, how) {
  /** @type {Map<string, number>} item → per minute the chain needs from its source recipe */
  const demand = new Map();
  /** @type {Record<string, Row>} in dependency order, target first */
  const rows = {};
  /** @type {Warning[]} */
  const warnings = [];

  for (const id of plan.order) {
    const r = game.recipes[id];
    const isTarget = id === calc.recipe;
    const crew = calc.crews?.[id] ?? defaultCrew;
    const multiplier = game.crews[crew]?.multiplier ?? null;
    if (multiplier == null) warnings.push({ code: 'unknown-crew', recipe: id, crew });
    const perMachine = multiplier == null ? null : craftsPerMachine(r, multiplier);

    // The target runs its machines; anything else runs enough for the most demanding output it supplies.
    /** @type {number | null} */
    let crafts = 0;
    let runsFor = null;
    if (isTarget) {
      crafts = perMachine == null ? null : calc.count * perMachine;
      runsFor = r.outputs[0].item;
    } else {
      for (const o of r.outputs) {
        if (how(o.item).recipe !== id || !demand.has(o.item)) continue;
        const per = expectedAmount(o);
        if (!per) { crafts = null; break; }
        const need = /** @type {number} */ (demand.get(o.item)) / per;
        if (need > crafts) { crafts = need; runsFor = o.item; }
      }
    }
    if (crafts == null) warnings.push({ code: 'missing-value', recipe: id });
    const rate = (/** @type {number | null} */ perCraft) => (crafts == null || perCraft == null ? 0 : crafts * perCraft);

    /** @type {Input[]} */
    const inputs = r.inputs.map((/** @type {any} */ l) => {
      const h = how(l.item);
      const loop = Boolean(h.recipe) && plan.isLoop(id, l.item);
      const perCraft = l.amount == null ? null : l.amount / (r.cycles ?? 1);
      return { item: l.item, perCraft, perMinute: rate(perCraft), source: loop ? null : h.recipe, stop: loop ? 'loop' : h.stop };
    });
    for (const i of inputs) if (i.source) demand.set(i.item, (demand.get(i.item) ?? 0) + i.perMinute);

    // Every consumer came earlier in the order, so the demand on this row's outputs is final.
    /** @type {Output[]} */
    const outputs = r.outputs.map((/** @type {any} */ l, /** @type {number} */ index) => {
      const perCraft = expectedAmount(l);
      const perMinute = rate(perCraft);
      const used = how(l.item).recipe === id ? demand.get(l.item) ?? 0 : 0;
      return { item: l.item, perCraft, perMinute, used, surplus: isTarget && index === 0 ? 0 : Math.max(0, perMinute - used) };
    });

    const machines = crafts == null || !perMachine ? null : crafts / perMachine;
    rows[id] = { recipe: id, building: r.building, crew, multiplier, isTarget, runsFor, craftsPerMinute: crafts, machines, build: machinesToBuild(machines), inputs, outputs };
  }
  return { rows, warnings };
}

/**
 * @param {any} game from applyOverrides
 * @param {Calc} calc
 * @param {{ defaultCrew?: string }} [options] crew for rows without one (default: game.defaultCrew)
 */
export function calculate(game, calc, options = {}) {
  const choices = { supplied: new Set(calc.supplied ?? []), recipeChoice: calc.recipeChoice ?? {} };
  const how = (/** @type {string} */ item) => howMade(game, item, choices);
  const plan = walk(game, calc.recipe, how);
  const { rows, warnings } = computeRows(game, calc, options.defaultCrew ?? game.defaultCrew, plan, how);

  // Phase 3: what comes from outside the chain, and what is left over.
  const allInputs = Object.values(rows).flatMap((row) => row.inputs.map((i) => ({ ...i, consumer: row.recipe })));
  /** Total per item, with the rows that need it. @param {typeof allInputs} list */
  const byItem = (list) => [...Map.groupBy(list, (i) => i.item).values()]
    .map((g) => ({ item: g[0].item, perMinute: g.reduce((s, i) => s + i.perMinute, 0), stop: g[0].stop, consumers: g.map((i) => i.consumer) }))
    .filter((e) => e.perMinute > EPS);

  return {
    target: calc.recipe,
    output: rows[calc.recipe].outputs[0],
    rows,
    /** items the chain needs from outside: supplied by the user, raw, or made by nothing */
    raw: byItem(allInputs.filter((i) => i.stop && i.stop !== 'loop')),
    /** items needed inside their own chain, counted as supplied from outside (loop cut) */
    loops: byItem(allInputs.filter((i) => i.stop === 'loop')),
    /** leftovers: outputs nobody in the chain uses */
    byproducts: Object.values(rows).flatMap((row) => row.outputs.filter((o) => o.surplus > EPS).map((o) => ({ item: o.item, perMinute: o.surplus, recipe: row.recipe }))),
    warnings,
  };
}

/**
 * @typedef {object} TreeNode one item flowing into its consumer, at this branch's rate
 * @property {string} item
 * @property {number} perMinute
 * @property {string | null} recipe the row making it (null when the chain stops)
 * @property {Input['stop']} stop
 * @property {number | null} machines this branch's share of that row's machines
 * @property {TreeNode[]} children
 */

/**
 * The chain as a tree for the UI: each input under its consumer, at that branch's share of its source
 * row (which is shown once, combined, in the rows). Derived from the rows, so the numbers always agree.
 * @param {ReturnType<typeof calculate>} result
 * @returns {TreeNode}
 */
export function chainTree(result) {
  /** @returns {TreeNode} */
  const node = (/** @type {Row} */ row, /** @type {string} */ item, /** @type {number} */ share) => {
    const out = /** @type {Output} */ (row.outputs.find((o) => o.item === item));
    return {
      item,
      perMinute: out.perMinute * share,
      recipe: row.recipe,
      stop: null,
      machines: row.machines == null ? null : row.machines * share,
      children: row.inputs.map((i) => {
        const perMinute = i.perMinute * share;
        if (!i.source) return { item: i.item, perMinute, recipe: null, stop: i.stop, machines: null, children: [] };
        const source = result.rows[i.source];
        const made = /** @type {Output} */ (source.outputs.find((o) => o.item === i.item)).perMinute;
        return node(source, i.item, made > EPS ? perMinute / made : 0);
      }),
    };
  };
  return node(result.rows[result.target], result.output.item, 1);
}
