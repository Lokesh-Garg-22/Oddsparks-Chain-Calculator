// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyOverrides, openIssues, resolveId } from '../site/js/data/merge.js';
import { BADGE_KINDS, recipeBadges, rowBadges } from '../site/js/data/badges.js';
import { calculate } from '../site/js/engine/calc.js';
import { validate } from '../tools/data/validate.mjs';
import { DATA_FILE, OVERRIDES_FILE } from '../tools/paths.mjs';

const realData = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
const realOverrides = JSON.parse(readFileSync(OVERRIDES_FILE, 'utf8'));

// ---------- fixtures ----------

/** @param {Partial<any>} extra */
const recipe = (extra) => ({
  name: 'R', building: 'sawbench', inputs: [{ item: 'log', amount: 2 }], outputs: [{ item: 'plank', amount: 1, odds: null }],
  duration: 16, usesFuel: null, randomised: null, cycles: null, optimalTemperature: -3, insulated: false, unlock: null,
  sources: [{ page: 'Sawbench', revid: 1 }, { page: 'Plank', revid: 2 }], valueFrom: {}, conflicts: {}, problems: {}, ...extra,
});
const building = (/** @type {Partial<any>} */ extra) => ({ name: 'B', group: 'Refiners', onBuildingsPage: true, pageOrder: 0, ...extra });
const fixture = () => ({
  meta: { dataVersion: 'test' },
  buildings: { sawbench: building({ name: 'Sawbench' }), logger: building({ name: 'Logger', pageOrder: 5 }), shrine: building({ name: 'Shrine', group: 'Shrines', pageOrder: 9 }) },
  items: { log: { name: 'Wooden Log' }, plank: { name: 'Plank' } },
  recipes: {
    'sawbench--plank': recipe({ conflicts: { duration: [{ page: 'Sawbench', revid: 1, value: 16 }, { page: 'Plank', revid: 2, value: 64 }] } }),
    'sawbench--plank--copy': recipe({ sources: [{ page: 'Plank', revid: 2 }] }),
    'logger--log': recipe({ building: 'logger', inputs: [], outputs: [{ item: 'log', amount: 1, odds: null }], duration: 2 }),
  },
});
const noOverrides = () => ({
  sparkCrews: [{ id: '1-stumpy', label: '1 Stumpy', multiplier: 1, status: 'confirmed', source: 'test' }],
  defaultCrew: '1-stumpy', items: {}, buildings: {}, defaultRecipe: {}, raw: [], corrections: [], confirmed: [], mergeRecipes: [],
  renamedIds: { recipes: {}, items: {}, crews: {} },
});

// ---------- applyOverrides ----------

test('overrides add display names, corrections, confirmations and merges without touching the input', () => {
  const data = fixture();
  const before = structuredClone(data);
  const game = applyOverrides(data, {
    ...noOverrides(),
    items: { log: { displayName: 'Timber', reason: 'in-game name', source: 'owner' } },
    corrections: [{ recipe: 'sawbench--plank', path: 'duration', value: 20, reason: 'measured', source: 'owner' }],
    confirmed: [{ recipe: 'logger--log', paths: ['duration'], source: 'owner' }],
    mergeRecipes: [{ keep: 'sawbench--plank', drop: 'sawbench--plank--copy', reason: 'same', source: 'wiki' }],
  });
  assert.deepEqual(data, before, 'input not modified');
  assert.equal(game.items.log.displayName, 'Timber');
  assert.equal(game.items.plank.displayName, 'Plank', 'falls back to the wiki name');
  assert.equal(game.recipes['sawbench--plank'].duration, 20);
  assert.deepEqual(game.recipes['sawbench--plank'].corrected.duration, { value: 20, was: 16, reason: 'measured', source: 'owner' });
  assert.equal(game.recipes['logger--log'].confirmed.duration, 'owner');
  assert.equal(game.recipes['sawbench--plank--copy'], undefined);
  assert.equal(resolveId(game, 'recipes', 'sawbench--plank--copy'), 'sawbench--plank', 'saved tabs follow a merge');
});

test('items know which recipes make and use them; crews are keyed by id', () => {
  const game = applyOverrides(fixture(), { ...noOverrides(), raw: ['log'] });
  assert.deepEqual(game.items.plank.producers, ['sawbench--plank', 'sawbench--plank--copy']);
  assert.deepEqual(game.items.log.consumers, ['sawbench--plank', 'sawbench--plank--copy']);
  assert.equal(game.items.log.raw, true);
  assert.equal(game.crews['1-stumpy'].multiplier, 1);
  assert.deepEqual(game.crewOrder, ['1-stumpy']);
});

test('renamed ids are followed per kind; unknown ids resolve to null', () => {
  const game = applyOverrides(fixture(), {
    ...noOverrides(),
    renamedIds: { recipes: { 'old--plank': 'sawbench--plank' }, items: { 'wooden-log': 'log', 'very-old-log': 'wooden-log' }, crews: { '1stumpy': '1-stumpy' } },
  });
  assert.equal(resolveId(game, 'recipes', 'old--plank'), 'sawbench--plank');
  assert.equal(resolveId(game, 'items', 'very-old-log'), 'log', 'chains are followed');
  assert.equal(resolveId(game, 'crews', '1stumpy'), '1-stumpy');
  assert.equal(resolveId(game, 'items', 'log'), 'log');
  assert.equal(resolveId(game, 'items', 'gone'), null);
});

test('temperature corrections set both temperature fields', () => {
  const game = applyOverrides(fixture(), { ...noOverrides(), corrections: [{ recipe: 'logger--log', path: 'temperature', value: 'insulated', reason: 'r', source: 's' }] });
  assert.equal(game.recipes['logger--log'].insulated, true);
  assert.equal(game.recipes['logger--log'].optimalTemperature, null);
});

// ---------- openIssues ----------

test('open issues: conflicts and missing values stay open until corrected or confirmed; single-page recipes are flagged', () => {
  const data = fixture();
  data.recipes['logger--log'].duration = null;
  data.recipes['logger--log'].problems = { duration: 'no page states a craft time' };
  const open = applyOverrides(data, noOverrides());
  assert.deepEqual(openIssues(open.recipes['sawbench--plank']).map((i) => i.kind), ['conflict']);
  assert.deepEqual(openIssues(open.recipes['sawbench--plank--copy']).map((i) => i.kind), ['single-page']);
  assert.deepEqual(openIssues(open.recipes['logger--log']), [{ kind: 'missing', path: 'duration', text: 'no page states a craft time' }]);
  const settled = applyOverrides(data, {
    ...noOverrides(),
    confirmed: [{ recipe: 'sawbench--plank', paths: ['duration'], source: 'owner' }],
    corrections: [
      { recipe: 'logger--log', path: 'duration', value: 2, reason: 'measured', source: 'owner' },
      { recipe: 'sawbench--plank--copy', path: 'duration', value: 16, reason: 'measured', source: 'owner' },
    ],
  });
  assert.deepEqual(openIssues(settled.recipes['sawbench--plank']), []);
  assert.deepEqual(openIssues(settled.recipes['logger--log']), [], 'a correction fills the missing value');
  assert.deepEqual(openIssues(settled.recipes['sawbench--plank--copy']), [], 'a correction also counts as a check');
});

// ---------- default recipe rule ----------

test('default recipe: main product, standard building, earliest tier, fewer inputs, Buildings-page order, then id', () => {
  const tiered = (/** @type {number} */ t) => ({ quest: `Q - Tier ${t}`, npc: null });
  const data = fixture();
  data.recipes = {
    'shrine--plank': recipe({ building: 'shrine', unlock: tiered(1) }),
    'logger--plank': recipe({ building: 'logger', unlock: tiered(2), inputs: [] }),
    'sawbench--plank': recipe({ unlock: tiered(2) }),
    'sawbench--plank-late': recipe({ unlock: tiered(5) }),
    'sawbench--byproduct': recipe({ outputs: [{ item: 'log', amount: 1, odds: null }, { item: 'plank', amount: 1, odds: null }], unlock: tiered(1) }),
  };
  const plank = applyOverrides(data, noOverrides()).items.plank;
  assert.equal(plank.defaultRecipe, 'logger--plank', 'shrine and byproduct skipped; the tier 2 tie goes to fewer inputs');
  assert.deepEqual(plank.defaultTiedById, []);
  assert.equal(applyOverrides(data, { ...noOverrides(), defaultRecipe: { plank: 'sawbench--plank-late' } }).items.plank.defaultRecipe, 'sawbench--plank-late', 'an override wins');
  data.recipes = { 'sawbench--b': recipe({}), 'sawbench--a': recipe({}) };
  const tied = applyOverrides(data, noOverrides()).items.plank;
  assert.equal(tied.defaultRecipe, 'sawbench--a');
  assert.deepEqual(tied.defaultTiedById, ['sawbench--b'], 'an id-only tie is reported');
  assert.equal(applyOverrides(fixture(), noOverrides()).items.log.defaultRecipe, 'logger--log');
});

// ---------- validate ----------

test('validate catches broken references, missing sources and unsafe merges', () => {
  const bad = {
    ...noOverrides(),
    surprise: true,
    defaultCrew: 'nope',
    items: { ghost: { displayName: 'Ghost', reason: 'r', source: 's' }, log: { displayName: 'Timber' } },
    corrections: [{ recipe: 'sawbench--plank', path: 'inputs.nails.amount', value: 3, reason: 'r', source: 's' }, { recipe: 'sawbench--plank', path: 'duration', value: -1, reason: 'r', source: 's' }],
    mergeRecipes: [{ keep: 'sawbench--plank', drop: 'logger--log', reason: 'r', source: 's' }],
    renamedIds: { recipes: { 'sawbench--plank': 'logger--log' }, items: { old: 'missing' }, crews: {} },
  };
  const { errors } = validate(fixture(), bad);
  const expect = ['unknown key "surprise"', 'defaultCrew nope', 'items.ghost: no such item', 'items.log: needs a reason', 'items.log: needs a source',
    'inputs.nails.amount: not a field', 'duration: value -1', 'same building and items', 'renamedIds.recipes sawbench--plank: that id still exists',
    'renamedIds.items old: target missing'];
  for (const e of expect) assert.ok(errors.some((x) => x.includes(e)), `expected an error containing "${e}"; got:\n${errors.join('\n')}`);
});

test('validate reports missing structure instead of crashing', () => {
  const data = fixture();
  // @ts-ignore: testing malformed input
  delete data.recipes['logger--log'].problems;
  // @ts-ignore: testing malformed input
  delete data.recipes['sawbench--plank'].outputs;
  const overrides = noOverrides();
  // @ts-ignore: testing malformed input
  delete overrides.corrections;
  // @ts-ignore: testing malformed input
  delete overrides.renamedIds.crews;
  const { errors } = validate(data, overrides);
  for (const e of ['logger--log: missing or malformed problems', 'sawbench--plank: missing or malformed outputs', 'missing "corrections"', 'renamedIds needs a "crews" object']) {
    assert.ok(errors.some((x) => x.includes(e)), `expected an error containing "${e}"`);
  }
});

test('validate catches broken generated data', () => {
  const data = fixture();
  data.recipes['sawbench--plank'].inputs[0].item = 'nails';
  data.recipes['logger--log'].duration = null;
  data.recipes['sawbench--plank--copy'].conflicts = { 'size': [] };
  const { errors } = validate(data, noOverrides());
  assert.ok(errors.some((e) => e.includes('unknown item nails')));
  assert.ok(errors.some((e) => e.includes('logger--log: duration must be a positive number, or null with a problem')));
  assert.ok(errors.some((e) => e.includes('"size" isn\'t a field path')));
});

// ---------- the real data ----------

test('the real data and overrides are valid', () => {
  assert.deepEqual(validate(realData, realOverrides).errors, []);
});

const game = applyOverrides(realData, realOverrides);

test("Timber is shown under its in-game name", () => {
  assert.equal(game.items['wooden-log'].displayName, 'Timber');
});

test('sensible defaults for early-game items', () => {
  const expected = {
    'wooden-log': 'logger--wooden-log--log-harvesting',
    'tree-bark': 'logger--tree-bark--bark-harvesting',
    'stumpy-spark': 'spark-workbench--stumpy-spark',
    'crafty-spark': 'spark-workbench--crafty-spark',
    'copper-ore': 'ore-miner--copper-ore--copper-ore-harvesting',
    'copper-ingot': 'furnace--copper-ingot--from-copper-ore',
  };
  for (const [item, id] of Object.entries(expected)) assert.equal(game.items[item].defaultRecipe, id, item);
});

// ---------- badges ----------

test('badges explain conflicts with the pages and values, and the value used', () => {
  const sponge = recipeBadges(game, 'loom--sponge').find((b) => b.code === 'conflict');
  assert.ok(sponge, 'Sponge has a conflict badge');
  assert.match(sponge.detail, /Loom page says 824 s/);
  assert.match(sponge.detail, /Using 24 s/);
  assert.equal(sponge.tone, 'warn');
});

test('badges: unconfirmed crews warn, in-game confirmations show as checked', () => {
  const codes = (/** @type {string} */ id, /** @type {string} */ crew) => recipeBadges(game, id, crew).map((b) => b.code);
  assert.ok(codes('sawbench--sawn-timber', '1-crafty').includes('crew-unverified'));
  assert.ok(!codes('sawbench--sawn-timber', '2-crafty').includes('crew-unverified'));
  assert.ok(codes('sawbench--sawn-timber', '2-crafty').includes('confirmed'));
  assert.ok(codes('furnace--copper-ingot--from-copper-ore', '2-stumpy').includes('fuel'));
  assert.ok(codes('greenhouse--leaf-knot', '2-stumpy').includes('cycles'));
});

test('badges show corrections with what changed and why', () => {
  const fixed = applyOverrides(fixture(), { ...noOverrides(), corrections: [{ recipe: 'logger--log', path: 'duration', value: 3, reason: 'measured', source: 'owner' }] });
  const badge = recipeBadges(fixed, 'logger--log').find((b) => b.code === 'corrected');
  assert.equal(badge?.detail, 'The craft time was corrected from 2 s to 3 s: measured (owner).');
});

test('a checked-in-game badge gives each field its own source', () => {
  const g = applyOverrides(fixture(), { ...noOverrides(), confirmed: [
    { recipe: 'sawbench--plank', paths: ['duration'], source: 'reading A' },
    { recipe: 'sawbench--plank', paths: ['inputs.log.amount'], source: 'reading B' },
  ] });
  const detail = recipeBadges(g, 'sawbench--plank').find((b) => b.code === 'confirmed')?.detail;
  assert.equal(detail, 'Confirmed in-game: craft time (reading A); amount of Wooden Log (reading B).');
});

test('row badges add what only the chain knows: a loop names its input', () => {
  const res = calculate(game, { recipe: 'sawbench--leaves', count: 1, recipeChoice: { leaves: 'sawbench--leaves' } });
  const loop = rowBadges(game, res)['greenhouse--leaf-knot'].find((b) => b.code === 'loop');
  assert.equal(loop?.text, 'loop: Leaves');
  assert.equal(loop?.warning, true);
});

test('every badge kind says whether it is a warning', () => {
  for (const [code, kind] of Object.entries(BADGE_KINDS)) assert.equal(typeof kind.warning, 'boolean', code);
  assert.equal(BADGE_KINDS.fuel.warning, true, 'fuel is a warning: fuel buildings are not counted');
  assert.equal(BADGE_KINDS.confirmed.warning, false);
});
