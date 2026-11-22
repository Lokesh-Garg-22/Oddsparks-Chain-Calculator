// @ts-check
/**
 * The columns of a chain table, defined once: the build list shows them, and the Excel export
 * (step 11) writes them, so the two can't drift apart. Each column reads one value from a row of
 * the calculation; how a value looks is up to whoever shows it (see `kind`).
 *
 * The optional columns follow the owner's spreadsheet (`excel` is its header) and are hidden until
 * the user turns them on (docs/decisions.md, "Extra columns"). The export writes every column that has
 * an `excel` header; input lists (rateLines, amountLines) spread over its input slots (H–S), and its
 * Building column is the recipe's building.
 */

import { mainOutput } from './calc.js';

/** @typedef {import('./calc.js').Row} Row */
/** @typedef {import('./calc.js').Result} Result */
/**
 * What a column's value is, so every view formats it the same way:
 * - item / recipe / crew: an id
 * - rate: per minute (shown in the user's unit); amount: a plain count per craft
 * - machines: { exact, build }
 * - rateLines / amountLines: one value per input item
 * - parts: the demand from each consuming row, with that row's recipe, so Excel can sum the consumers'
 *   cells (=K16+K13); null for the target, which nothing in the chain uses
 * - seconds, text
 * @typedef {'item' | 'recipe' | 'crew' | 'rate' | 'amount' | 'machines' | 'rateLines' | 'amountLines' | 'parts' | 'seconds' | 'text'} Kind
 */
/** @typedef {{ item: string, value: number | null }} Line */
/**
 * @typedef {object} Column
 * @property {string} key stored in the user's prefs; never rename
 * @property {string} label
 * @property {Kind} kind
 * @property {string | null} excel the owner's spreadsheet header, when it has this column
 * @property {boolean} optional hidden unless the user turns it on
 * @property {(row: Row, game: any) => unknown} value
 */

/** @param {number | null} a @param {number | null} b */
const times = (a, b) => (a == null || b == null ? null : a * b);

/** @type {Column[]} */
export const COLUMNS = [
  { key: 'item', label: 'Item', kind: 'item', excel: 'Item Name', optional: false, value: (row) => mainOutput(row).item },
  { key: 'rate', label: 'Rate', kind: 'rate', excel: 'Final Output', optional: false, value: (row) => mainOutput(row).perMinute },
  { key: 'made', label: 'Made in', kind: 'recipe', excel: 'Recipe', optional: false, value: (row) => row.recipe },
  { key: 'crew', label: 'Spark crew', kind: 'crew', excel: 'Spark crew', optional: false, value: (row) => row.crew },
  { key: 'machines', label: 'Machines', kind: 'machines', excel: '# of machines', optional: false, value: (row) => ({ exact: row.machines, build: row.build }) },

  { key: 'outPM', label: 'Output per machine', kind: 'rate', excel: 'Production p/m', optional: true,
    value: (row) => times(row.craftsPerMachine, mainOutput(row).perCraft) },
  { key: 'crafts', label: 'Crafts per machine', kind: 'rate', excel: 'Production Cycles Per Minute', optional: true, value: (row) => row.craftsPerMachine },
  { key: 'pieces', label: 'Pieces per craft', kind: 'amount', excel: 'Production Piece Per Cycle', optional: true, value: (row) => mainOutput(row).perCraft },
  { key: 'demand', label: 'Needed by the chain', kind: 'parts', excel: 'Parts Needed', optional: true,
    value: (row) => (row.isTarget ? null : mainOutput(row).demandBy.map((d) => ({ recipe: d.consumer, perMinute: d.perMinute }))) },
  { key: 'inCraft', label: 'Inputs per craft', kind: 'amountLines', excel: 'Base Item Needed', optional: true,
    value: (row) => row.inputs.map((i) => ({ item: i.item, value: i.perCraft })) },
  { key: 'inMachine', label: 'Inputs per machine', kind: 'rateLines', excel: 'Base Item p/m', optional: true,
    value: (row) => row.inputs.map((i) => ({ item: i.item, value: times(i.perCraft, row.craftsPerMachine) })) },
  { key: 'inTotal', label: 'Inputs in total', kind: 'rateLines', excel: 'Item Pieces Needed', optional: true,
    value: (row) => row.inputs.map((i) => ({ item: i.item, value: i.perMinute })) },
  { key: 'time', label: 'Craft time', kind: 'seconds', excel: null, optional: true, value: (row, game) => game.recipes[row.recipe].duration },
  { key: 'unlock', label: 'Unlocked by', kind: 'text', excel: null, optional: true, value: (row, game) => game.recipes[row.recipe].unlock?.quest ?? null },
];

export const OPTIONAL_KEYS = COLUMNS.filter((c) => c.optional).map((c) => c.key);

/** The columns to show: every fixed one, plus the optional ones the user turned on, in table order. @param {string[]} chosen */
export const visibleColumns = (chosen) => COLUMNS.filter((c) => !c.optional || chosen.includes(c.key));
