// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyOverrides } from '../site/js/data/merge.js';
import { chooseRecipe, emptyCalc, fromRecipe, pickBuilding, setCount, setCrew, setRecipe, toggleSupplied } from '../site/js/state/calc.js';
import { makeFormat, num } from '../site/js/ui/format.js';
import { cleanPrefs, defaultPrefs, toggleColumn } from '../site/js/state/prefs.js';
import { fromShareHash, toShareHash } from '../site/js/state/url.js';
import { resolveId } from '../site/js/data/merge.js';
import { readJson, writeJson } from '../site/js/state/storage.js';
import { crewOption, dataVersionLabel } from '../site/js/data/names.js';
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
  const oneDecimal = makeFormat({ ...defaultPrefs(game), decimals: 1 });
  assert.equal(oneDecimal.rate(11.25), '11.2', 'like the game: half to even (the owner read 11.2)');
  assert.equal(oneDecimal.rate(11.35), '11.4');
  assert.equal(oneDecimal.rate(11.26), '11.3');
  assert.equal(num(0.0046), '0.0046');
  assert.equal(num(null), '?');
});

test('stored prefs are checked: bad values fall back, renamed crews are followed, column order is fixed', () => {
  const d = defaultPrefs(game);
  assert.deepEqual(cleanPrefs(game, null, resolveId), d);
  assert.deepEqual(cleanPrefs(game, 'junk', resolveId), d);
  const renamed = { ...game, renamedIds: { ...game.renamedIds, crews: { 'old-crew': '2-crafty' } } };
  const p = cleanPrefs(renamed, { unit: 'sec', decimals: 3, defaultCrew: 'old-crew', theme: 'dark', columns: ['inTotal', 'nope', 'outPM'] }, resolveId);
  assert.deepEqual(p, { unit: 'sec', decimals: 2, defaultCrew: '2-crafty', theme: 'dark', columns: ['outPM', 'inTotal'] });
  assert.equal(cleanPrefs(game, { defaultCrew: 'gone' }, resolveId).defaultCrew, d.defaultCrew);
  assert.deepEqual(toggleColumn(toggleColumn(p, 'crafts'), 'outPM').columns, ['crafts', 'inTotal']);
});

test('a share link round-trips a calc, and survives renamed or removed ids', () => {
  const calc = { ...fromRecipe(game, 'wood-workshop--wooden-blade', { count: 3 }),
    crews: { 'wood-workshop--wooden-blade': '2-stumpy', 'sawbench--sawn-timber': '2-crafty' },
    recipeChoice: { 'wooden-log': 'logger--wooden-log--log-harvesting' }, supplied: ['raw-aether'], view: /** @type {const} */ ('list') };
  const hash = toShareHash(calc);
  assert.match(hash, /^#r=wood-workshop--wooden-blade&n=3&c=/);
  assert.deepEqual(fromShareHash(game, hash, resolveId), { calc, missing: [] });
  assert.equal(fromShareHash(game, '', resolveId), null);
  assert.equal(fromShareHash(game, '#section', resolveId), null);

  const old = fromShareHash(game, '#r=sawbench--sawn-timber&n=-2&c=gone--recipe:2-crafty,sawbench--sawn-timber:no-crew&s=gone-item', resolveId);
  assert.equal(old?.calc?.count, 1, 'a bad count falls back to 1');
  assert.deepEqual(old?.calc?.crews, {});
  assert.deepEqual(old?.calc?.supplied, []);
  assert.deepEqual(old?.missing, ['gone--recipe', 'no-crew', 'gone-item']);
  assert.deepEqual(fromShareHash(game, '#r=gone--recipe&n=1', resolveId), { calc: null, missing: ['gone--recipe'] });
});

test('storage without a browser (or blocked) reads null and reports writes as failed', () => {
  assert.equal(readJson('local', 'prefs'), null);
  assert.equal(writeJson('session', 'session', { open: [] }), false);
});

test('labels: crew options and the data version', () => {
  assert.equal(crewOption(game, '2-crafty'), '2 Crafty (×3)');
  assert.equal(dataVersionLabel({ extractedAt: '2026-11-22T08:27:53.927Z', dataVersion: 'wiki-x' }), 'Data: wiki snapshot of 22 Nov 2026 (wiki-x).');
});
