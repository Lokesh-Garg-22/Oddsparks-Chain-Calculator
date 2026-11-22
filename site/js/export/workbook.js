// @ts-check
/**
 * The Excel export's content, as plain data (docs/storage-and-export.md, "Excel export"). Pure and
 * testable in Node; site/js/export/xlsx.js turns it into a file with ExcelJS.
 *
 * One sheet per calculation, laid out like the owner's spreadsheet (columns A–W): every number that
 * follows from others is a live formula, written together with its value so previewers that don't
 * recalculate still show numbers. The values come from the shared column definitions
 * (site/js/engine/columns.js), so the sheet and the build list can't disagree. A Summary sheet ends
 * the workbook.
 */
import { calculate, perBuilding, spareCapacity } from '../engine/calc.js';
import { COLUMNS } from '../engine/columns.js';
import { STOP_LABELS, chainWarnings, rowBadges } from '../data/badges.js';
import { buildingName, crewOption, dataVersionLabel, itemName, recipeLabel, recipeName } from '../data/names.js';

/**
 * @typedef {object} Cell
 * @property {string | number | null} v the value (a formula's calculated result)
 * @property {string} [f] formula, without "="
 * @property {boolean} [bold]
 */
/** @typedef {{ name: string, rows: (Cell | null)[][], widths: number[], frozenRows: number }} Sheet */
/**
 * @typedef {object} Entry one calculation to export
 * @property {string} name the tab's name
 * @property {string[]} path folders it's in (relative to what's exported), for the sheet name
 * @property {import('../state/calc.js').TabCalc} calc
 * @property {string[]} missing ids it lost to a data update (shown in the Summary)
 */

const INPUT_SLOTS = 3;
const column = Object.fromEntries(COLUMNS.map((c) => [c.key, c]));
/** @param {string} key */
const excel = (key) => /** @type {string} */ (column[key].excel);

/** The owner's headers, A–W, from the shared column definitions. Inputs get three slots of four columns (H–K, L–O, P–S). */
export const HEADERS = [
  excel('rate'), excel('outPM'), excel('pieces'), excel('crafts'), excel('demand'), excel('item'), excel('machines'),
  ...Array.from({ length: INPUT_SLOTS }, (_, n) => [`Item # ${n + 1}`, excel('inCraft'), excel('inMachine'), excel('inTotal')]).flat(),
  'Machines (build)', 'Building', excel('made'), excel('crew'),
];
const WIDTHS = [12, 14, 14, 14, 18, 22, 13, ...Array(INPUT_SLOTS).fill([18, 12, 12, 14]).flat(), 12, 18, 26, 22];

/** 0 → "A". @param {number} i */
export const colLetter = (i) => (i < 26 ? String.fromCharCode(65 + i) : colLetter(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)));
/** The "Item Pieces Needed" column of an input slot (K, O, S). @param {number} slot */
const totalCol = (slot) => colLetter(10 + 4 * slot);

/** @param {string} key @param {import('../engine/calc.js').Row} row @param {any} game @returns {any} */
const value = (key, row, game) => column[key].value(row, game);

/** @param {number | null | undefined} v @param {string} [f] @returns {Cell} */
const num = (v, f) => ({ v: v ?? null, ...(f ? { f } : {}) });
/** @param {string} v @returns {Cell} */
const text = (v) => ({ v });

/**
 * The chain sheet's rows: headers, then one row per recipe (target first), with a blank row between.
 * @param {any} game @param {import('../engine/calc.js').Result} result
 * @returns {(Cell | null)[][]}
 */
export function chainRows(game, result) {
  const rows = Object.values(result.rows);
  /** Excel row number of each recipe's row. */
  const at = new Map(rows.map((r, i) => [r.recipe, 2 + 2 * i]));
  /** @type {(Cell | null)[][]} */
  const out = [HEADERS.map((h) => ({ v: h, bold: true }))];

  for (const row of rows) {
    const n = /** @type {number} */ (at.get(row.recipe));
    const outPM = value('outPM', row, game);
    const machines = value('machines', row, game);
    /** @type {{ recipe: string, perMinute: number }[] | null} */
    const parts = value('demand', row, game);
    const item = value('item', row, game);

    // E: the consumers' "Item Pieces Needed" cells for this item, e.g. =K16+K13.
    let partsNeeded = text('NA');
    if (parts) {
      const slots = parts.map((p) => result.rows[p.recipe].inputs.findIndex((i) => i.item === item));
      const refs = parts.map((p, k) => `${totalCol(slots[k])}${at.get(p.recipe)}`);
      const sum = parts.reduce((s, p) => s + p.perMinute, 0);
      // Only a formula when every consumer's cell is found (a slot past the third has no column).
      const linkable = refs.length > 0 && slots.every((s) => s >= 0 && s < INPUT_SLOTS);
      partsNeeded = num(sum, linkable ? refs.join('+') : undefined);
    }

    /** @type {(Cell | null)[]} */
    const cells = [
      num(outPM == null || machines.exact == null ? null : outPM * machines.exact, `B${n}*G${n}`),
      num(outPM),
      num(value('pieces', row, game)),
      num(value('crafts', row, game), `B${n}/C${n}`),
      partsNeeded,
      text(itemName(game, item)),
      row.isTarget ? num(machines.exact) : num(machines.exact, `E${n}/B${n}`),
    ];
    /** @type {{ item: string, value: number | null }[]} */
    const perCraft = value('inCraft', row, game);
    /** @type {{ item: string, value: number | null }[]} */
    const perMachine = value('inMachine', row, game);
    /** @type {{ item: string, value: number | null }[]} */
    const total = value('inTotal', row, game);
    for (let s = 0; s < INPUT_SLOTS; s++) {
      if (s >= perCraft.length) {
        cells.push(null, null, null, null);
        continue;
      }
      const [i, j] = [colLetter(8 + 4 * s), colLetter(9 + 4 * s)];
      cells.push(text(itemName(game, perCraft[s].item)), num(perCraft[s].value), num(perMachine[s].value, `$D${n}*${i}${n}`), num(total[s].value, `$G${n}*${j}${n}`));
    }
    cells.push(
      num(machines.build, `ROUNDUP(G${n},0)`),
      text(buildingName(game, row.building)),
      text(recipeName(game, row.recipe)),
      text(crewOption(game, row.crew)),
    );
    out.push(cells, []);
  }
  out.pop();
  return out;
}

/**
 * Excel's rules for sheet names: at most 31 characters, none of []:*?/\, not starting or ending with
 * an apostrophe, not "History", and unique (ignoring case).
 * @param {string[]} parts folder path, then the tab name @param {Set<string>} taken lower-case names used so far
 */
export function sheetName(parts, taken) {
  const base = parts.join(' - ').replace(/[[\]:*?/\\]/g, '-').replace(/^'+|'+$/g, '').trim() || 'Sheet';
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? '' : ` (${n})`;
    const name = base.slice(0, 31 - suffix.length).trimEnd() + suffix;
    const key = name.toLowerCase();
    if (!taken.has(key) && key !== 'history') {
      taken.add(key);
      return name;
    }
  }
}

/**
 * The whole workbook: a chain sheet per calculation, then the Summary. Calculations with no recipe
 * chosen (or a count of 0) are listed in the Summary as skipped.
 * @param {any} game
 * @param {Entry[]} entries
 * @param {{ defaultCrew: string, now: Date }} options
 * @returns {{ sheets: Sheet[] }}
 */
export function buildWorkbook(game, entries, { defaultCrew, now }) {
  const taken = new Set(['summary']);
  /** @type {Sheet[]} */
  const sheets = [];
  /** @type {(Cell | null)[][]} */
  const summary = [
    [{ v: 'Oddsparks Chain Calculator export', bold: true }],
    [text('Exported'), text(now.toISOString().slice(0, 10))],
    [text(dataVersionLabel(game.meta))],
    [],
  ];
  /** @param {string} title @param {(Cell | null)[][]} lines */
  const section = (title, lines) => {
    if (!lines.length) return;
    summary.push([{ v: title, bold: true }], ...lines);
  };
  /** @type {string[]} */
  const skipped = [];

  for (const entry of entries) {
    const { calc } = entry;
    if (!calc.recipe || !(calc.count > 0)) {
      skipped.push(entry.name);
      continue;
    }
    const result = calculate(game, calc, { defaultCrew });
    const name = sheetName([...entry.path, entry.name], taken);
    sheets.push({ name, rows: chainRows(game, result), widths: WIDTHS, frozenRows: 1 });

    summary.push(
      [{ v: entry.name, bold: true }, text(`sheet “${name}”`)],
      [text('Makes'), num(result.output.perMinute), text(`${itemName(game, result.output.item)} per minute`)],
    );
    section('Machines to build', perBuilding(result).map((b) => [text(buildingName(game, b.building)), num(b.build), text(b.recipes.map((r) => recipeName(game, r)).join(', '))]));
    section('From outside the chain (per minute)', [...result.raw, ...result.loops].map((r) => [text(itemName(game, r.item)), num(r.perMinute), text(r.stop ? STOP_LABELS[r.stop] : '')]));
    section('Byproducts and spare capacity (per minute)', [
      ...result.byproducts.map((b) => [text(itemName(game, b.item)), num(b.perMinute), text(`from ${recipeLabel(game, b.recipe)}`)]),
      ...spareCapacity(result).map((s) => [text(itemName(game, s.item)), num(s.perMinute), text(`more from ${recipeLabel(game, s.recipe)}, rounded up`)]),
    ]);
    section('Warnings', [
      ...chainWarnings(rowBadges(game, result)).map(({ recipe, badge }) => [text(recipeLabel(game, recipe)), text(`${badge.text}: ${badge.detail}`)]),
      ...(entry.missing.length ? [[text('Older data'), text(`Not in the current game data, so left out: ${entry.missing.join(', ')}.`)]] : []),
    ]);
    summary.push([]);
  }
  if (skipped.length) summary.push([{ v: 'Skipped (no recipe chosen)', bold: true }], ...skipped.map((s) => [text(s)]), []);
  summary.push(
    [text('Game data from the Oddsparks Wiki (https://oddsparks.wiki.gg), licensed CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Changed: extracted, merged and corrected; see the calculator.')],
    [text('Oddsparks © THQ Nordic AB. Developed by Massive Miniteam, published by HandyGames. Fan-made, not affiliated with or endorsed by them.')],
  );
  sheets.push({ name: 'Summary', rows: summary, widths: [34, 14, 60], frozenRows: 0 });
  return { sheets };
}
