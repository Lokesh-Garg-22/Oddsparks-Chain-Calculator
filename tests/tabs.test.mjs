// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyOverrides, resolveId } from '../site/js/data/merge.js';
import { cleanCalc, emptyCalc, fromRecipe, setCount } from '../site/js/state/calc.js';
import { activeTab, cleanSession, closeTab, dismissMissing, newSession, newTab, openLink, renameTab, selectTab, tabLabel, updateActive } from '../site/js/state/tabs.js';
import { DATA_FILE, OVERRIDES_FILE } from '../tools/paths.mjs';

const game = applyOverrides(JSON.parse(readFileSync(DATA_FILE, 'utf8')), JSON.parse(readFileSync(OVERRIDES_FILE, 'utf8')));
const BLADE = 'wood-workshop--wooden-blade';
let n = 0;
const key = () => `k${++n}`;

test('new, select, rename and close tabs; the last tab is replaced, never left empty', () => {
  let s = newSession('a');
  s = newTab(s, 'b');
  assert.equal(s.active, 'b');
  s = selectTab(s, 'a');
  assert.equal(s.active, 'a');
  assert.equal(selectTab(s, 'nope'), s);
  s = renameTab(s, 'a', '  Copper line ');
  assert.equal(tabLabel(game, activeTab(s)), 'Copper line');
  assert.equal(tabLabel(game, activeTab(renameTab(s, 'a', '  '))), 'New calculation', 'a blank name goes back to automatic');

  s = closeTab(s, 'a', 'x');
  assert.deepEqual([s.open.map((t) => t.key), s.active], [['b'], 'b'], 'closing the active tab activates its neighbour');
  s = closeTab(s, 'b', 'c');
  assert.deepEqual([s.open.map((t) => t.key), s.active], [['c'], 'c']);
});

test('editing marks only the active tab dirty, and only when its calc changed', () => {
  let s = newTab(newSession('a'), 'b');
  assert.equal(updateActive(s, (c) => c), s, 'no change, same session');
  s = updateActive(s, () => fromRecipe(game, BLADE, { count: 3 }));
  assert.deepEqual(s.open.map((t) => t.dirty), [false, true]);
  assert.equal(tabLabel(game, activeTab(s)), 'Wooden Blade ×3');
  assert.equal(activeTab(updateActive(s, (c) => setCount(c, 2))).draft.count, 2);
});

test('a share link replaces an untouched empty tab, otherwise opens next to the others', () => {
  const calc = fromRecipe(game, BLADE, { count: 3 });
  const fresh = openLink(newSession('a'), { calc, missing: [] }, 'b');
  assert.deepEqual(fresh.open.map((t) => t.key), ['b']);
  assert.equal(activeTab(fresh).dirty, false, 'an opened link has no unsaved changes yet');
  const busy = updateActive(newSession('a'), () => calc);
  assert.deepEqual(openLink(busy, { calc, missing: ['old-crew'] }, 'b').open.map((t) => [t.key, t.missing]), [['a', []], ['b', ['old-crew']]]);
});

test("a link whose recipe is gone opens nothing and notes it on the current tab, until dismissed", () => {
  const s = openLink(newSession('a'), { calc: null, missing: ['gone--recipe'] }, 'b');
  assert.deepEqual(s.open.map((t) => [t.key, t.missing]), [['a', ['gone--recipe']]]);
  assert.deepEqual(activeTab(dismissMissing(s)).missing, []);
  const clean = newSession('a');
  assert.equal(dismissMissing(clean), clean);
});

test('a stored session is checked: junk dropped, duplicate keys skipped, old ids followed, never empty', () => {
  assert.equal(cleanSession(game, null, resolveId, () => 'z').open.length, 1);
  const s = cleanSession(game, {
    open: [
      { key: 'a', tabId: null, name: 'Mine', draft: { recipe: BLADE, count: 3, crews: { [BLADE]: '2-stumpy' } }, dirty: true },
      { key: 'a', draft: {} },
      { key: 'b', draft: { recipe: 'gone--recipe' } },
      'junk',
      { key: 'c', draft: { building: 'sawbench', recipe: '' } },
    ],
    active: 'nope',
  }, resolveId, key);
  assert.deepEqual(s.open.map((t) => t.key), ['a', 'b', 'c']);
  assert.equal(s.active, 'a', 'an unknown active key falls back to the first tab');
  assert.equal(s.open[0].draft.count, 3);
  assert.equal(s.open[0].dirty, true);
  assert.deepEqual(s.open[1].draft, emptyCalc(), 'a tab whose recipe is gone opens empty');
  assert.deepEqual(s.open[1].missing, ['gone--recipe'], '...and says what it lost');
  assert.equal(s.open[2].draft.building, 'sawbench');
});

test('cleanCalc checks every field and lists ids that no longer exist', () => {
  const { calc, missing } = cleanCalc(game, {
    recipe: BLADE, count: 'three', crews: { [BLADE]: 'no-crew', 'gone--x': '2-crafty' }, recipeChoice: [], supplied: ['raw-aether', 'raw-aether', 'gone-item', 5], view: 'grid',
  }, resolveId);
  assert.deepEqual(calc, { ...fromRecipe(game, BLADE), supplied: ['raw-aether'] });
  assert.deepEqual(missing, ['no-crew', 'gone--x', 'gone-item']);
  assert.deepEqual(cleanCalc(game, { recipe: 'constructor' }, resolveId), { calc: null, missing: ['constructor'] }, 'inherited keys are not ids');
});
