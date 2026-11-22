// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyOverrides } from '../site/js/data/merge.js';
import { chooseRecipe, emptyCalc, fromRecipe, pickBuilding, setCount, setCrew, setRecipe, toggleSupplied } from '../site/js/state/calc.js';
import { makeFormat, num } from '../site/js/ui/format.js';
import { DATA_FILE, OVERRIDES_FILE } from '../tools/paths.mjs';

const game = applyOverrides(JSON.parse(readFileSync(DATA_FILE, 'utf8')), JSON.parse(readFileSync(OVERRIDES_FILE, 'utf8')));

test('picking a building selects its recipe only when it has just one', () => {
  const many = pickBuilding(emptyCalc(), game, 'spark-workbench');
  assert.equal(many.building, 'spark-workbench');
  assert.equal(many.recipe, '');
  assert.equal(pickBuilding(emptyCalc(), game, 'spark-workbench', 'spark-workbench--crafty-spark').recipe, 'spark-workbench--crafty-spark');
  const single = Object.keys(game.buildings).find((b) => game.buildings[b].recipes.length === 1);
  assert.ok(single);
  assert.equal(pickBuilding(emptyCalc(), game, /** @type {string} */ (single)).recipe, game.buildings[/** @type {string} */ (single)].recipes[0]);
});

test('updates return new objects and keep the stored shape', () => {
  const start = fromRecipe(game, 'sawbench--sawn-timber', { count: 2 });
  assert.deepEqual(start, { building: 'sawbench', recipe: 'sawbench--sawn-timber', count: 2, crews: {}, recipeChoice: {}, supplied: [] });
  const next = toggleSupplied(chooseRecipe(setCrew(start, 'sawbench--sawn-timber', '2-crafty'), 'wooden-log', 'x'), 'wooden-log');
  assert.deepEqual(start.crews, {}, 'the original is untouched');
  assert.deepEqual(next.crews, { 'sawbench--sawn-timber': '2-crafty' });
  assert.deepEqual(next.recipeChoice, { 'wooden-log': 'x' });
  assert.deepEqual(next.supplied, ['wooden-log']);
  assert.deepEqual(toggleSupplied(next, 'wooden-log').supplied, []);
  assert.equal(setRecipe(start, 'sawbench--wooden-panel').recipe, 'sawbench--wooden-panel');
});

test('a blank or negative count is ignored', () => {
  const c = emptyCalc();
  assert.equal(setCount(c, NaN), c);
  assert.equal(setCount(c, -1), c);
  assert.equal(setCount(c, 3).count, 3);
});

test('buildings list their recipes earliest unlock first', () => {
  assert.equal(game.buildings['spark-workbench'].recipes[0], 'spark-workbench--stumpy-spark', 'Tier 1 first');
});

test('the formatter follows the unit and decimals; craft times ignore the unit', () => {
  const perMin = makeFormat({ unit: 'min', decimals: 2, defaultCrew: '2-stumpy' });
  const perSec = makeFormat({ unit: 'sec', decimals: 2, defaultCrew: '2-stumpy' });
  assert.equal(perMin.rate(90), '90');
  assert.equal(perSec.rate(90), '1.5');
  assert.equal(perSec.perShort, '/s');
  assert.equal(perSec.seconds(16), '16 s');
  assert.equal(makeFormat({ unit: 'min', decimals: 1, defaultCrew: '' }).rate(11.25), '11.3');
  assert.equal(num(0.0046), '0.0046');
  assert.equal(num(null), '?');
});
