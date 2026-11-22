// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyOverrides } from '../site/js/data/merge.js';
import { calculate, chainTree, machinesToBuild, outputPerMachine, spareCapacity } from '../site/js/engine/calc.js';
import { COLUMNS, OPTIONAL_KEYS, visibleColumns } from '../site/js/engine/columns.js';
import { DATA_FILE, OVERRIDES_FILE } from '../tools/paths.mjs';

const game = applyOverrides(JSON.parse(readFileSync(DATA_FILE, 'utf8')), JSON.parse(readFileSync(OVERRIDES_FILE, 'utf8')));

/**
 * Run the engine with a tab-style calc; every row on 1 Stumpy unless `defaultCrew` says otherwise.
 * @param {string} recipe @param {number} count
 * @param {Omit<import('../site/js/engine/calc.js').Calc, 'recipe' | 'count'> & { defaultCrew?: string }} [opts]
 */
const calc = (recipe, count, { defaultCrew = '1-stumpy', ...rest } = {}) => calculate(game, { recipe, count, ...rest }, { defaultCrew });

/** Equal to 6 decimals (rates are floating point). */
const near = (/** @type {number | null | undefined} */ actual, /** @type {number} */ expected, /** @type {string} */ what) =>
  assert.ok(actual != null && Math.abs(actual - expected) < 1e-6, `${what}: expected ${expected}, got ${actual}`);
const machines = (/** @type {ReturnType<typeof calculate>} */ res, /** @type {string} */ id) => res.rows[id]?.machines ?? null;
const raw = (/** @type {ReturnType<typeof calculate>} */ res, /** @type {string} */ item) => res.raw.find((r) => r.item === item);

const CRAFTY = 'spark-workbench--crafty-spark';
const STUMPY = 'spark-workbench--stumpy-spark';
const PANEL = 'sawbench--wooden-panel';
const SAWN = 'sawbench--sawn-timber';
const LOGGER = 'logger--wooden-log--log-harvesting';
const DISTILL = 'aetheric-distiller--aether-shard--from-raw-aether';
const COLLIDER = 'aetheric-collider--raw-aether--from-cleansing-fragment-corrupted-aether';

// ---------- the worked example in docs/game-mechanics.md ----------

test('worked example: 1 Spark Workbench making Crafty Spark, everything 1 Stumpy', () => {
  const res = calc(CRAFTY, 1, { recipeChoice: { 'aether-shard': DISTILL }, supplied: ['raw-aether'] });
  near(res.output.perMinute, 1.25, 'Crafty Spark per minute');
  near(machines(res, CRAFTY), 1, 'target');
  near(machines(res, STUMPY), 4 / 3, 'Stumpy Spark workbenches');
  near(machines(res, PANEL), 1 / 3, 'Wooden Panel sawbenches');
  near(machines(res, SAWN), 4 / 3, 'Sawn Timber sawbenches');
  near(machines(res, DISTILL), 1 / 3, 'distillers');
  near(machines(res, LOGGER), 0.75, 'Logger: 12.5 + 10 Timber/min from both branches');
  near(raw(res, 'raw-aether')?.perMinute, 2.5 / 6, 'Raw Aether supplied');
  assert.equal(raw(res, 'raw-aether')?.stop, 'supplied');
  assert.deepEqual(res.loops, []);
  assert.deepEqual(res.warnings, []);
  assert.deepEqual([CRAFTY, STUMPY, PANEL, SAWN, LOGGER, DISTILL].map((id) => res.rows[id].build), [1, 2, 1, 2, 1, 1], 'machines to build');
  assert.equal(Object.keys(res.rows)[0], CRAFTY, 'rows are in dependency order, target first');
});

test('rows say where each input comes from and how much of each output the chain uses', () => {
  const res = calc(CRAFTY, 1, { supplied: ['aether-shard'] });
  const stumpy = res.rows[STUMPY];
  assert.equal(stumpy.building, 'spark-workbench');
  assert.deepEqual(stumpy.inputs.map((i) => [i.item, i.source, i.stop]), [['aether-shard', null, 'supplied'], ['wooden-log', LOGGER, null]]);
  const logs = res.rows[LOGGER].outputs[0];
  near(logs.used, 22.5, 'Timber used by both consumers');
  near(logs.perMinute, 22.5, 'Timber made');
  assert.equal(res.rows[LOGGER].runsFor, 'wooden-log');
  assert.equal(stumpy.inputs[1].perCraft, 5);
});

test('the chain tree shows each branch at its share of the combined row', () => {
  const tree = chainTree(calc(CRAFTY, 1, { supplied: ['aether-shard'] }));
  near(tree.perMinute, 1.25, 'root');
  const [stumpy, panel] = tree.children;
  assert.equal(stumpy.item, 'stumpy-spark');
  near(stumpy.perMinute, 2.5, 'Stumpy Spark branch');
  near(stumpy.machines, 4 / 3, 'Stumpy Spark branch machines');
  const timberUnderStumpy = stumpy.children.find((c) => c.item === 'wooden-log');
  const timberUnderPanel = panel.children[0].children.find((c) => c.item === 'wooden-log');
  near(timberUnderStumpy?.perMinute, 12.5, 'Timber under Stumpy Spark');
  near(timberUnderStumpy?.machines, 12.5 / 30, 'its share of the Logger');
  near(timberUnderPanel?.perMinute, 10, 'Timber under Sawn Timber');
  assert.equal(stumpy.children.find((c) => c.item === 'aether-shard')?.stop, 'supplied');
});

// ---------- checks against the game ----------

test('Logger page: one Logger feeds four Sawbenches making Sawn Timber exactly', () => {
  near(machines(calc(SAWN, 4), LOGGER), 1, 'Loggers');
});

test("owner's spreadsheet, sheet Sawn Timber: 2 Sawbenches, 2 Crafty", () => {
  const res = calc(SAWN, 2, { defaultCrew: '2-crafty' });
  near(res.output.perMinute, 22.5, 'Sawn Timber per minute');
  near(machines(res, LOGGER), 0.5, 'Loggers (45 of 90 Timber/min)');
});

test("owner's spreadsheet, sheet Wooden Panel: 1 Sawbench, 2 Crafty", () => {
  const res = calc(PANEL, 1, { defaultCrew: '2-crafty' });
  near(res.output.perMinute, 22.5, 'Wooden Panel per minute');
  near(machines(res, SAWN), 4, 'Sawn Timber sawbenches (the sheet had 4.02 using the rounded 11.2)');
  near(machines(res, LOGGER), 1, 'Loggers');
});

test("owner's spreadsheet, sheet Wooden Blade: 3 Wood Workshops on 2 Stumpy, the rest 2 Crafty", () => {
  const BLADE = 'wood-workshop--wooden-blade';
  const res = calc(BLADE, 3, { defaultCrew: '2-crafty', crews: { [BLADE]: '2-stumpy' } });
  near(res.output.perMinute, 7.5, 'Wooden Blade per minute');
  near(machines(res, PANEL), 15 / 22.5, 'Wooden Panel sawbenches');
  near(res.rows[SAWN].outputs[0].perMinute, 37.5, 'Sawn Timber: 30 for panels + 7.5 for blades, combined');
  near(machines(res, SAWN), 37.5 / 11.25, 'Sawn Timber sawbenches');
  near(machines(res, LOGGER), 75 / 90, 'Loggers');
  assert.deepEqual([PANEL, SAWN, LOGGER].map((id) => res.rows[id].build), [1, 4, 1]);
});

test('the engine reproduces the in-game rates', () => {
  near(outputPerMachine(game, LOGGER, '2-crafty'), 90, 'Logger, 2 Crafty');
  near(outputPerMachine(game, SAWN, '2-crafty'), 11.25, 'Sawn Timber, 2 Crafty (shown as 11.2)');
  near(outputPerMachine(game, PANEL, '2-crafty'), 22.5, 'Wooden Panel, 2 Crafty');
  near(outputPerMachine(game, 'wood-workshop--wooden-blade', '2-stumpy'), 2.5, 'Wooden Blade, 2 Stumpy');
  assert.equal(outputPerMachine(game, SAWN, '1-stumpy', 'not-an-output'), null);
});

// ---------- rules ----------

test('a crew per row changes only that row', () => {
  const res = calc(CRAFTY, 1, { supplied: ['aether-shard'], crews: { [SAWN]: '2-crafty' } });
  near(machines(res, SAWN), 4 / 9, 'Sawn Timber sawbenches at ×3');
  near(machines(res, PANEL), 1 / 3, 'Wooden Panel unchanged');
  assert.equal(res.rows[SAWN].crew, '2-crafty');
});

test('"I supply this" stops the chain at that item', () => {
  const res = calc(CRAFTY, 1, { supplied: ['wooden-panel', 'aether-shard'] });
  assert.equal(res.rows[PANEL], undefined);
  assert.equal(res.rows[SAWN], undefined);
  near(raw(res, 'wooden-panel')?.perMinute, 2.5, 'Wooden Panel supplied');
  near(machines(res, LOGGER), 12.5 / 30, 'Timber now only for Stumpy Spark');
});

const collider = calc(COLLIDER, 1, { supplied: ['cleansing-fragment'] });

test('an item nothing makes is raw', () => {
  assert.equal(raw(collider, 'corrupted-aether')?.stop, 'no-recipe');
  near(raw(collider, 'corrupted-aether')?.perMinute, 2 * 60 / 32, 'Corrupted Aether per minute');
});

test('random outputs count their expected amount; the other outputs are byproducts', () => {
  near(collider.output.perMinute, 8 * 0.75 * 1.875, 'Raw Aether: 8 at 75%');
  assert.equal(collider.output.perCraft, 6);
  assert.deepEqual(collider.byproducts.map((b) => [b.item, b.recipe]), [['aetheric-clump', COLLIDER]]);
  near(collider.byproducts[0].perMinute, 1 * 0.25 * 1.875, 'Aetheric Clump: 1 at 25%');
});

test('byproducts: Copper Ore from the Geode Breaker leaves Volcanic Soil and Glowshroom over', () => {
  const BREAKER = 'geode-breaker--volcanic-soil--from-shiny-geode';
  const res = calc('furnace--copper-ingot--from-copper-ore', 2, { recipeChoice: { 'copper-ore': BREAKER }, supplied: ['shiny-geode'] });
  near(res.output.perMinute, 2 * 60 / 64, 'Copper Ingot per minute');
  near(machines(res, BREAKER), 5.625 / 25, 'Geode Breakers');
  assert.equal(res.rows[BREAKER].runsFor, 'copper-ore');
  const by = Object.fromEntries(res.byproducts.map((b) => [b.item, b.perMinute]));
  near(by['volcanic-soil'], 11.25, 'Volcanic Soil left over');
  near(by.glowshroom, 5.625, 'Glowshroom left over');
  assert.equal(by['copper-ore'], undefined, 'the Copper Ore is all used');
});

test('cycles: one batch of inputs lasts N crafts (assumption U5)', () => {
  const greenhouse = calc('sawbench--leaves', 1).rows['greenhouse--leaf-knot'];
  near(greenhouse.machines, 0.4, 'Greenhouses for 3.75 Leaf Knot/min');
  near(greenhouse.inputs.find((i) => i.item === 'leaves')?.perMinute, 0.15, 'Leaves into the Greenhouse');
  near(greenhouse.inputs.find((i) => i.item === 'fertiliser')?.perMinute, 0.075, 'Fertiliser into the Greenhouse');
  assert.equal(greenhouse.inputs.find((i) => i.item === 'leaves')?.perCraft, 0.4, '4 Leaves per batch of 10 crafts');
});

test('loops are cut and reported (the Leaves example from the mockup)', () => {
  const res = calc('sawbench--leaves', 1, { recipeChoice: { leaves: 'sawbench--leaves' } });
  const leaves = res.loops.find((l) => l.item === 'leaves');
  near(leaves?.perMinute, 0.3, 'Leaves needed inside their own chain');
  assert.deepEqual(leaves?.consumers.sort(), ['cutter--fertiliser', 'greenhouse--leaf-knot']);
  assert.equal(chainTree(res).children[0].children.find((c) => c.item === 'leaves')?.stop, 'loop');
  near(res.output.perMinute, 37.5, 'Leaves made');
});

test('a loop through other recipes terminates and is reported (Raw Aether ↔ Aether Shard)', () => {
  const res = calc(CRAFTY, 1, { recipeChoice: { 'aether-shard': DISTILL, 'raw-aether': 'alchemy-lab--raw-aether' } });
  assert.ok(res.loops.some((l) => l.item === 'aether-shard'), `expected an Aether Shard loop; got ${JSON.stringify(res.loops)}`);
  assert.ok(res.rows['alchemy-lab--raw-aether']);
});

test("a recipe pick that doesn't make the item, or doesn't exist, falls back to the default", () => {
  const base = Object.keys(calc(SAWN, 1).rows);
  for (const wrong of [PANEL, 'no-such--recipe']) {
    assert.deepEqual(Object.keys(calc(SAWN, 1, { recipeChoice: { 'wooden-log': wrong } }).rows), base, wrong);
  }
});

test('an unknown crew is a warning, not a crash', () => {
  const res = calc(SAWN, 1, { crews: { [LOGGER]: 'ghost-crew' } });
  assert.deepEqual(res.warnings, [{ code: 'unknown-crew', recipe: LOGGER, crew: 'ghost-crew' }]);
  assert.equal(res.rows[LOGGER].machines, null, 'machines need the crew');
  near(res.rows[LOGGER].craftsPerMinute, 7.5, 'how much Timber is needed is still known');
});

test('rounding up ignores floating-point dust', () => {
  assert.equal(machinesToBuild(3.0000000001), 3);
  assert.equal(machinesToBuild(4 / 3), 2);
  assert.equal(machinesToBuild(0), 0);
  assert.equal(machinesToBuild(null), null);
});

test('outputs split their use by consuming row, and rows give crafts per machine', () => {
  const res = calc(CRAFTY, 1, { supplied: ['aether-shard'] });
  const logs = res.rows[LOGGER].outputs[0];
  assert.deepEqual(logs.demandBy.map((d) => d.consumer).sort(), [SAWN, STUMPY].sort());
  near(logs.demandBy.find((d) => d.consumer === STUMPY)?.perMinute, 12.5, 'Timber to Stumpy Spark');
  near(res.rows[SAWN].craftsPerMachine, 3.75, 'Sawn Timber crafts per machine at 1 Stumpy');
});

test("columns give the owner's spreadsheet values (Wooden Blade sheet)", () => {
  const BLADE = 'wood-workshop--wooden-blade';
  const res = calc(BLADE, 3, { defaultCrew: '2-crafty', crews: { [BLADE]: '2-stumpy' } });
  const col = Object.fromEntries(COLUMNS.map((c) => [c.key, (/** @type {string} */ id) => c.value(res.rows[id], game)]));
  near(/** @type {number} */ (col.outPM(PANEL)), 22.5, 'Production p/m, Wooden Panel');
  near(/** @type {number} */ (col.outPM(SAWN)), 11.25, 'Production p/m, Sawn Timber (exact, the game shows 11.2)');
  near(/** @type {number} */ (col.crafts(LOGGER)), 90, 'Production Cycles Per Minute, Logger');
  assert.equal(col.pieces(SAWN), 1);
  assert.equal(col.demand(BLADE), null, 'the target has no Parts Needed');
  const parts = /** @type {{ recipe: string, perMinute: number }[]} */ (col.demand(SAWN));
  assert.deepEqual(parts.map((d) => [d.recipe, Math.round(d.perMinute * 100) / 100]).sort(), [[PANEL, 30], [BLADE, 7.5]],
    'Parts Needed: one part per consuming row, with that row (for =K16+K13)');
  assert.deepEqual(col.inCraft(PANEL), [{ item: 'sawn-timber', value: 2 }]);
  near(/** @type {any} */ (col.inMachine(PANEL))[0].value, 45, 'Base Item p/m, Wooden Panel');
  near(/** @type {any} */ (col.inTotal(SAWN))[0].value, 75, 'Item Pieces Needed, Sawn Timber');
  assert.deepEqual(col.machines(SAWN), { exact: res.rows[SAWN].machines, build: 4 });
});

test('optional columns are hidden until chosen, and keep table order', () => {
  assert.deepEqual(visibleColumns([]).map((c) => c.key), ['item', 'rate', 'made', 'crew', 'machines']);
  assert.deepEqual(visibleColumns(['inTotal', 'outPM']).map((c) => c.key).slice(5), ['outPM', 'inTotal']);
  assert.equal(new Set(COLUMNS.map((c) => c.key)).size, COLUMNS.length, 'keys are unique (they are stored in prefs)');
  assert.ok(OPTIONAL_KEYS.length >= 9);
});

test('spare capacity: what rounding up to whole buildings leaves over', () => {
  // Sawn Timber ×2 on 2 Crafty needs 45 Timber/min: half of a 90/min Logger, rounded up to 1.
  const res = calc(SAWN, 2, { defaultCrew: '2-crafty' });
  const spare = spareCapacity(res);
  assert.equal(spare.length, 1);
  assert.equal(spare[0].recipe, LOGGER);
  near(spare[0].perMinute, 90 - 45, 'spare Timber');
  assert.deepEqual(spareCapacity(calc(LOGGER, 1)), [], 'a whole number of machines leaves nothing spare');
});
