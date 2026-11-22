// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyOverrides, resolveId } from '../site/js/data/merge.js';
import { fromRecipe } from '../site/js/state/calc.js';
import {
  addFolder, addTab, cleanLibrary, deleteFolder, deleteTab, duplicateTab, emptyLibrary, folderList, folderPath,
  fromBackup, mergeLibrary, moveItem, parentOf, positionOf, rename, savedCalc, searchTabs, tabsWithin, toBackup, toggleFolder, updateTab,
} from '../site/js/state/library.js';
import { activeTab, markSaved, newSession, openSaved, renameTab, syncWithLibrary, updateActive } from '../site/js/state/tabs.js';
import { renameOpenTab, saveTab, saveTabAs } from '../site/js/state/saving.js';
import { DATA_FILE, OVERRIDES_FILE } from '../tools/paths.mjs';

const game = applyOverrides(JSON.parse(readFileSync(DATA_FILE, 'utf8')), JSON.parse(readFileSync(OVERRIDES_FILE, 'utf8')));
const BLADE = 'wood-workshop--wooden-blade';
const NOW = '2026-11-22T10:00:00.000Z';
const stamp = { now: NOW, dataVersion: 'test' };
const calc = fromRecipe(game, BLADE, { count: 3 });

/** The library of the mockup: Early game wood › Blades, plus a tab not in a folder. */
function sample() {
  let l = emptyLibrary();
  l = addFolder(l, { id: 'wood', name: 'Early game wood', parent: null });
  l = addFolder(l, { id: 'blades', name: 'Blades', parent: 'wood' });
  l = addTab(l, { id: 'sawn', name: 'Sawn Timber ×2', calc, parent: 'wood', ...stamp });
  l = addTab(l, { id: 'blade', name: 'Wooden Blade ×3', calc, parent: 'blades', ...stamp });
  l = addTab(l, { id: 'quartz', name: 'Quartz ×2', calc, parent: null, ...stamp });
  return l;
}

test('folders nest; paths, counts and the picker list follow the tree', () => {
  const l = sample();
  assert.deepEqual(l.root, ['wood', 'quartz']);
  assert.deepEqual(l.folders.wood.children, ['blades', 'sawn']);
  assert.deepEqual(folderPath(l, 'blade'), ['Early game wood', 'Blades']);
  assert.deepEqual(folderPath(l, 'quartz'), []);
  assert.deepEqual(tabsWithin(l, 'wood').sort(), ['blade', 'sawn']);
  assert.deepEqual(folderList(l).map((f) => [f.id, f.depth]), [['wood', 0], ['blades', 1]]);
  assert.deepEqual(folderList(l, 'wood'), [], 'a folder and its subfolders can be left out (Move to…)');
  assert.equal(parentOf(l, 'blade'), 'blades');
  assert.equal(parentOf(l, 'nope'), undefined);
  assert.deepEqual(positionOf(l, 'sawn'), { parent: 'wood', index: 1 });
  assert.equal(positionOf(l, 'nope'), null);
});

test('save over, rename, duplicate and delete tabs', () => {
  let l = sample();
  l = updateTab(l, 'quartz', { name: 'Quartz ×4', calc: { ...calc, count: 4 }, now: '2026-11-23T00:00:00.000Z', dataVersion: 'v2' });
  assert.equal(l.tabs.quartz.name, 'Quartz ×4');
  assert.equal(l.tabs.quartz.createdAt, NOW);
  assert.equal(l.tabs.quartz.dataVersion, 'v2');
  assert.equal(rename(l, 'quartz', '   '), l, 'a blank name is ignored');
  assert.equal(rename(l, 'blades', 'Blade line').folders.blades.name, 'Blade line');
  l = duplicateTab(l, 'sawn', 'sawn2', NOW);
  assert.deepEqual(l.folders.wood.children, ['blades', 'sawn', 'sawn2'], 'the copy goes right after the original');
  assert.equal(l.tabs.sawn2.name, 'Sawn Timber ×2 (copy)');
  l = deleteTab(l, 'sawn');
  assert.ok(!('sawn' in l.tabs));
  assert.deepEqual(l.folders.wood.children, ['blades', 'sawn2']);
});

test('moving: into folders, reordering, and never a folder into itself', () => {
  let l = sample();
  l = moveItem(l, 'quartz', 'blades');
  assert.deepEqual(l.folders.blades.children, ['blade', 'quartz']);
  l = moveItem(l, 'quartz', 'blades', 0);
  assert.deepEqual(l.folders.blades.children, ['quartz', 'blade'], 'drop before a tab');
  l = moveItem(l, 'quartz', 'blades', 2);
  assert.deepEqual(l.folders.blades.children, ['blade', 'quartz'], 'moving down the same list counts the gap it leaves');
  assert.equal(moveItem(l, 'wood', 'blades'), l, 'not into its own subfolder');
  assert.equal(moveItem(l, 'wood', 'wood'), l, 'not into itself');
  l = moveItem(l, 'blades', null);
  assert.deepEqual(l.root, ['wood', 'blades']);
  assert.equal(toggleFolder(l, 'wood').folders.wood.collapsed, true);
});

test('deleting a folder moves its contents up where it was, or deletes them all', () => {
  const up = deleteFolder(sample(), 'wood', 'move-up');
  assert.deepEqual(up.root, ['blades', 'sawn', 'quartz']);
  assert.deepEqual(Object.keys(up.tabs).sort(), ['blade', 'quartz', 'sawn']);
  const gone = deleteFolder(sample(), 'wood', 'delete');
  assert.deepEqual(gone.root, ['quartz']);
  assert.deepEqual(Object.keys(gone.folders), [], 'subfolders go too');
  assert.deepEqual(Object.keys(gone.tabs), ['quartz']);
});

test('search matches saved tab names in any case', () => {
  assert.deepEqual([...searchTabs(sample(), 'TIMBER')], ['sawn']);
  assert.equal(searchTabs(sample(), 'zzz').size, 0);
});

test('a stored library is repaired: every item listed once, loops broken, orphans at the top', () => {
  const l = cleanLibrary({
    tabs: { a: { name: 'A', calc: {} }, b: { name: 'B', calc: {} }, bad: { name: 5 }, c: { name: 'C', calc: {} } },
    folders: { f: { name: 'F', children: ['a', 'g', 'a', 'gone'] }, g: { name: 'G', children: ['f', 'b'] } },
    root: ['f', 'b'],
  });
  assert.deepEqual(l.root, ['f', 'c']);
  assert.deepEqual(l.folders.f.children, ['a', 'g']);
  assert.deepEqual(l.folders.g.children, ['b'], 'the loop back to F is dropped, B stays where it was first listed... inside G');
  assert.ok(!('bad' in l.tabs));
  assert.deepEqual(cleanLibrary('junk'), emptyLibrary());
});

test('back up and restore: merge keeps both (new ids on clashes), replace takes the backup', () => {
  const lib = sample();
  const text = JSON.stringify(toBackup(lib, NOW));
  assert.equal(JSON.parse(text).format, 'oddsparks-calc-library');
  assert.deepEqual(fromBackup(text), lib);
  assert.equal(fromBackup('{"tabs": {}}'), null, 'not a backup');
  assert.equal(fromBackup('not json'), null);

  let n = 0;
  const merged = mergeLibrary(lib, lib, (p) => `${p}_new${++n}`);
  assert.equal(Object.keys(merged.tabs).length, 6);
  assert.equal(Object.keys(merged.folders).length, 4);
  assert.equal(merged.root.length, 4);
  assert.deepEqual(cleanLibrary(merged), merged, 'the merged library is consistent');
});

test('a saved tab whose recipe is gone opens with its building, and says what went', () => {
  const ok = savedCalc(game, calc, resolveId);
  assert.deepEqual(ok, { calc, missing: [] });
  const old = savedCalc(game, { ...calc, recipe: 'wood-workshop--retired-recipe', crews: { 'wood-workshop--retired-recipe': '2-crafty' } }, resolveId);
  assert.equal(old.calc.recipe, '');
  assert.equal(old.calc.building, 'wood-workshop', 'the recipe cards offer a replacement');
  assert.deepEqual(old.missing, ['wood-workshop--retired-recipe'], 'each lost id once');
});

test('open tabs follow the library: open or switch, saved state, renames and deletes', () => {
  let s = openSaved(newSession('a'), { tabId: 'blade', name: 'Wooden Blade ×3', calc, missing: [] }, 'b');
  assert.deepEqual([s.open.length, activeTab(s).tabId, activeTab(s).dirty], [1, 'blade', false], 'replaces the untouched tab');
  assert.equal(openSaved(s, { tabId: 'blade', name: 'x', calc, missing: [] }, 'c').open.length, 1, 'already open: switch to it');

  s = updateActive(s, (c) => ({ ...c, count: 4 }));
  assert.equal(activeTab(s).dirty, true);
  s = markSaved(s, 'b', 'blade', 'Wooden Blade ×4');
  assert.deepEqual([activeTab(s).dirty, activeTab(s).name], [false, 'Wooden Blade ×4']);

  const lib = sample();
  assert.equal(activeTab(syncWithLibrary(s, lib.tabs)).name, 'Wooden Blade ×3', 'renamed in the library');
  const unsynced = syncWithLibrary(s, deleteTab(lib, 'blade').tabs);
  assert.deepEqual([activeTab(unsynced).tabId, activeTab(unsynced).dirty], [null, true], 'deleted: the open tab keeps its contents, unsaved');
  const same = syncWithLibrary(newSession('z'), lib.tabs);
  assert.equal(syncWithLibrary(same, lib.tabs), same, 'nothing to change, same session');
});

test('saving changes the open tab and the library together', () => {
  const stamp2 = { now: '2026-11-23T00:00:00.000Z', dataVersion: 'v2' };
  let b = { session: updateActive(newSession('a'), () => calc), lib: emptyLibrary() };
  assert.equal(saveTab(b, 'a', stamp2, game), b, 'never saved: Save does nothing (the UI asks Save as…)');

  b = saveTabAs(b, 'a', { id: 't1', name: '  ', folder: null }, stamp2, game);
  assert.equal(b.lib.tabs.t1.name, 'Wooden Blade ×3', 'a blank name takes the automatic one');
  assert.deepEqual([activeTab(b.session).tabId, activeTab(b.session).dirty], ['t1', false]);

  b = { ...b, session: updateActive(b.session, (c) => ({ ...c, count: 5 })) };
  b = saveTab(b, 'a', stamp2, game);
  assert.equal(/** @type {any} */ (b.lib.tabs.t1.calc).count, 5);
  assert.equal(activeTab(b.session).dirty, false);

  b = renameOpenTab(b, 'a', 'Blades', game);
  assert.deepEqual([activeTab(b.session).name, b.lib.tabs.t1.name], ['Blades', 'Blades']);
  b = renameOpenTab(b, 'a', '', game);
  assert.deepEqual([activeTab(b.session).name, b.lib.tabs.t1.name], ['Wooden Blade ×5', 'Wooden Blade ×5'], 'blank: back to the automatic name in both');

  const unsaved = { session: newSession('x'), lib: emptyLibrary() };
  assert.deepEqual(renameOpenTab(unsaved, 'x', '', game).session, renameTab(unsaved.session, 'x', ''));
});
