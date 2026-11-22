// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyOverrides } from '../site/js/data/merge.js';
import { fromRecipe } from '../site/js/state/calc.js';
import { calculate } from '../site/js/engine/calc.js';
import { addFolder, addTab, emptyLibrary, exportEntries, exportList } from '../site/js/state/library.js';
import { resolveId } from '../site/js/data/merge.js';
import { HEADERS, buildWorkbook, chainRows, colLetter, sheetName } from '../site/js/export/workbook.js';
import { DATA_FILE, OVERRIDES_FILE } from '../tools/paths.mjs';

const game = applyOverrides(JSON.parse(readFileSync(DATA_FILE, 'utf8')), JSON.parse(readFileSync(OVERRIDES_FILE, 'utf8')));
const BLADE = 'wood-workshop--wooden-blade';

/** The owner's Wooden Blade sheet: 3 Wood Workshops on 2 Stumpy, everything else 2 Crafty. */
const bladeCalc = () => fromRecipe(game, BLADE, { count: 3, crews: { [BLADE]: '2-stumpy' } });
const bladeRows = () => chainRows(game, calculate(game, bladeCalc(), { defaultCrew: '2-crafty' }));

/** Read a cell like "K4" from the sheet's rows. @param {any[][]} rows @param {string} ref */
function cell(rows, ref) {
  const [, letters, digits] = /** @type {RegExpMatchArray} */ (ref.replace(/\$/g, '').match(/^([A-Z]+)(\d+)$/));
  const col = [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  return rows[Number(digits) - 1]?.[col] ?? null;
}

/** Evaluate the few formula shapes the export writes, from the other cells' values. @param {any[][]} rows @param {string} f */
function evaluate(rows, f) {
  const v = (/** @type {string} */ ref) => /** @type {number} */ (cell(rows, ref)?.v);
  let m = f.match(/^ROUNDUP\(([A-Z$]+\d+),0\)$/);
  if (m) return Math.ceil(v(m[1]) - 1e-9);
  m = f.match(/^([A-Z$]+\d+)([*/])([A-Z$]+\d+)$/);
  if (m) return m[2] === '*' ? v(m[1]) * v(m[3]) : v(m[1]) / v(m[3]);
  if (/^([A-Z]+\d+)(\+[A-Z]+\d+)*$/.test(f)) return f.split('+').reduce((s, ref) => s + v(ref), 0);
  throw new Error(`unexpected formula ${f}`);
}

/** The row whose Item Name (F) is `name`. @param {any[][]} rows @param {string} name */
const rowFor = (rows, name) => rows.findIndex((r) => r[5]?.v === name) + 1;

test("export reproduces the owner's Wooden Blade sheet (exact rates: 11.25, not the game's 11.2)", () => {
  const rows = bladeRows();
  assert.deepEqual(rows[0].map((c) => c?.v), HEADERS);
  assert.equal(HEADERS.length, 23, 'columns A–W');
  const at = (/** @type {string} */ name, /** @type {string} */ col) => cell(rows, `${col}${rowFor(rows, name)}`)?.v;
  const near = (/** @type {any} */ a, /** @type {number} */ b, /** @type {string} */ what) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} ≠ ${b}`);

  // Wooden Blade (target): 2.5/min per Workshop on 2 Stumpy, 3 machines, 7.5/min.
  near(at('Wooden Blade', 'B'), 2.5, 'Blade p/m');
  near(at('Wooden Blade', 'G'), 3, 'Blade machines');
  near(at('Wooden Blade', 'A'), 7.5, 'Blade final output');
  assert.equal(at('Wooden Blade', 'E'), 'NA');
  // Wooden Panel: 15 needed, 22.5/min per Sawbench on 2 Crafty.
  near(at('Wooden Panel', 'B'), 22.5, 'Panel p/m');
  near(at('Wooden Panel', 'E'), 15, 'Panel parts needed');
  near(at('Wooden Panel', 'G'), 15 / 22.5, 'Panel machines');
  // Sawn Timber: 30 for panels + 7.5 for blades, combined; 11.25/min each.
  near(at('Sawn Timber', 'B'), 11.25, 'Sawn p/m');
  near(at('Sawn Timber', 'E'), 37.5, 'Sawn parts needed');
  near(at('Sawn Timber', 'G'), 37.5 / 11.25, 'Sawn machines');
  assert.equal(at('Sawn Timber', 'T'), 4);
  // Timber: 75 needed, 90/min per Logger.
  near(at('Timber', 'B'), 90, 'Timber p/m');
  near(at('Timber', 'E'), 75, 'Timber parts needed');
  near(at('Timber', 'G'), 75 / 90, 'Loggers');
  assert.equal(at('Wooden Blade', 'U'), 'Wood Workshop');
  assert.equal(at('Wooden Blade', 'W'), '2 Stumpy (×2)');
  assert.equal(at('Timber', 'W'), '2 Crafty (×3)');
});

test("Parts Needed sums the consumers' Item Pieces Needed cells, like the owner's =K16+K13", () => {
  const rows = bladeRows();
  const sawn = rowFor(rows, 'Sawn Timber');
  const f = /** @type {string} */ (cell(rows, `E${sawn}`).f);
  const refs = f.split('+');
  assert.equal(refs.length, 2, 'one reference per consuming row');
  for (const ref of refs) {
    const slot = ['K', 'O', 'S'].indexOf(ref.replace(/\d+/g, ''));
    assert.ok(slot >= 0, `${ref} is an Item Pieces Needed column`);
    assert.equal(cell(rows, ref.replace(/^[A-Z]+/, colLetter(7 + 4 * slot))).v, 'Sawn Timber', `${ref} is the Sawn Timber slot of its row`);
  }
});

test('every formula agrees with the value written beside it', () => {
  for (const [recipe, count] of [[BLADE, 3], ['spark-workbench--crafty-spark', 1], ['furnace--copper-ingot--from-copper-ore', 2]]) {
    const rows = chainRows(game, calculate(game, fromRecipe(game, /** @type {string} */ (recipe), { count: /** @type {number} */ (count) }), { defaultCrew: '2-stumpy' }));
    let formulas = 0;
    rows.forEach((row, r) => row.forEach((c, i) => {
      if (!c?.f || c.v == null) return;
      formulas++;
      const got = evaluate(rows, c.f);
      assert.ok(Math.abs(got - /** @type {number} */ (c.v)) < 1e-9, `${recipe} ${colLetter(i)}${r + 1}: =${c.f} gives ${got}, written ${c.v}`);
    }));
    assert.ok(formulas >= 8, `${recipe}: formulas checked`);
  }
});

test("sheet names follow Excel's rules", () => {
  const taken = new Set(['summary']);
  assert.equal(sheetName(['Early game wood', 'Blades', 'Wooden Blade ×3'], taken), 'Early game wood - Blades - Wood');
  assert.equal(sheetName(['a/b: c?'], taken), 'a-b- c-');
  assert.equal(sheetName(['Summary'], taken), 'Summary (2)', 'unique, ignoring case');
  assert.equal(sheetName(['History'], taken), 'History (2)', 'a reserved name');
  assert.equal(sheetName(["'quoted'"], taken), 'quoted');
  for (const n of taken) assert.ok(n.length <= 31);
});

test('a workbook: one sheet per calculation, skipped ones listed, then the Summary', () => {
  const book = buildWorkbook(game, [
    { name: 'Wooden Blade ×3', path: ['Blades'], calc: bladeCalc(), missing: [] },
    { name: 'Nothing yet', path: [], calc: { ...bladeCalc(), recipe: '' }, missing: [] },
    { name: 'Old one', path: [], calc: fromRecipe(game, 'sawbench--sawn-timber', { count: 2 }), missing: ['retired--recipe'] },
  ], { defaultCrew: '2-crafty', now: new Date('2026-11-22T10:00:00Z') });
  assert.deepEqual(book.sheets.map((s) => s.name), ['Blades - Wooden Blade ×3', 'Old one', 'Summary']);
  const summary = book.sheets[2].rows.flat().map((c) => c?.v).join('\n');
  for (const want of ['Machines to build', 'Skipped (no recipe chosen)', 'Nothing yet', 'retired--recipe', 'CC BY-SA 4.0', game.meta.dataVersion, '2026-11-22']) {
    assert.ok(summary.includes(want), `Summary mentions ${want}`);
  }
});

test('a folder exports its tabs in tree order, with paths below it', () => {
  let l = emptyLibrary();
  l = addFolder(l, { id: 'wood', name: 'Wood', parent: null });
  l = addFolder(l, { id: 'blades', name: 'Blades', parent: 'wood' });
  const stamp = { now: '2026-11-22T10:00:00Z', dataVersion: 'x' };
  l = addTab(l, { id: 'b', name: 'B', calc: {}, parent: 'blades', ...stamp });
  l = addTab(l, { id: 's', name: 'S', calc: {}, parent: 'wood', ...stamp });
  l = addTab(l, { id: 'q', name: 'Q', calc: {}, parent: null, ...stamp });
  assert.deepEqual(exportList(l, 'wood'), [{ id: 'b', path: ['Blades'] }, { id: 's', path: [] }]);
  assert.deepEqual(exportList(l, null), [{ id: 'b', path: ['Wood', 'Blades'] }, { id: 's', path: ['Wood'] }, { id: 'q', path: [] }]);
});

test('export entries: a saved tab, a folder or the library, each calc checked against the current data', () => {
  let l = emptyLibrary();
  const stamp = { now: '2026-11-22T10:00:00Z', dataVersion: 'x' };
  l = addFolder(l, { id: 'wood', name: 'Wood', parent: null });
  l = addTab(l, { id: 'b', name: 'Blades', calc: bladeCalc(), parent: 'wood', ...stamp });
  l = addTab(l, { id: 'old', name: 'Old', calc: { ...bladeCalc(), recipe: 'wood-workshop--retired' }, parent: null, ...stamp });
  const one = exportEntries(game, l, { kind: 'saved', id: 'b' }, resolveId);
  assert.equal(one.name, 'Blades');
  assert.deepEqual(one.entries.map((e) => [e.name, e.path, e.calc.recipe]), [['Blades', [], BLADE]]);
  assert.equal(exportEntries(game, l, { kind: 'folder', id: 'wood' }, resolveId).name, 'Wood');
  const all = exportEntries(game, l, { kind: 'library' }, resolveId);
  assert.equal(all.name, null, 'the caller dates the library file');
  assert.deepEqual(all.entries.map((e) => [e.name, e.path, e.missing]), [['Blades', ['Wood'], []], ['Old', [], ['wood-workshop--retired']]]);
});
