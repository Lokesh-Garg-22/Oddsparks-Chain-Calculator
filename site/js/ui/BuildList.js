// @ts-check
/**
 * The build list: one row per recipe, all branches combined. Its columns come from
 * site/js/engine/columns.js (the same definitions the Excel export uses); the optional ones follow the
 * owner's spreadsheet and are turned on in the Columns menu.
 */
import { html } from './html.js';
import { Icon } from './Icon.js';
import { Menu } from './Menu.js';
import { CrewSelect } from './CrewSelect.js';
import { useApp } from './context.js';
import { itemName, recipeLabel } from './format.js';
import { COLUMNS, visibleColumns } from '../engine/columns.js';
import { toggleColumn } from '../state/prefs.js';

/** @typedef {import('../engine/columns.js').Column} Column */
/** @typedef {import('../engine/columns.js').Line} Line */
/** @typedef {import('../engine/calc.js').Row} Row */

const NUMERIC = new Set(['rate', 'amount', 'machines', 'parts', 'seconds']);
/** Kinds whose heading carries the rate unit ('Rate /min'). */
const PER_TIME = new Set(['rate', 'rateLines', 'parts']);

/** Turn optional columns on or off; remembered per browser. */
export function ColumnsMenu() {
  const { prefs, setPrefs } = useApp();
  const extra = prefs.columns.length;
  return html`
    <${Menu} id="columns-menu" panelLabel="Columns" label=${extra ? `Columns (${extra} extra)` : 'Columns'}>
      <div class="columns-menu">
        <p class="small muted">Item, rate, recipe, crew and machines always show. Your choice is remembered in this browser.</p>
        <ul class="list-reset">
          ${COLUMNS.filter((c) => c.optional).map((c) => html`
            <li key=${c.key}>
              <label class="columns-menu__option">
                <input type="checkbox" checked=${prefs.columns.includes(c.key)} onChange=${() => setPrefs((p) => toggleColumn(p, c.key))} />
                <span>${c.label}${c.excel && html`<span class="small muted">Excel column “${c.excel}”</span>`}</span>
              </label>
            </li>`)}
        </ul>
      </div>
    <//>`;
}

/** @param {{ result: import('../engine/calc.js').Result, update: import('../state/calc.js').Update }} props */
export function BuildList({ result, update }) {
  const { game, fmt, prefs } = useApp();
  const columns = visibleColumns(prefs.columns);
  /** @param {(v: number | null) => string} show @param {Line[]} lines */
  const lineText = (show, lines) => (lines.length ? lines.map((l) => `${show(l.value)} ${itemName(game, l.item)}`).join(', ') : 'none');

  /** @param {Column} col @param {Row} row */
  const cell = (col, row) => {
    const v = /** @type {any} */ (col.value(row, game));
    switch (col.kind) {
      case 'item': return html`<span class="cell-with-icon"><${Icon} kind="items" id=${v} name=${itemName(game, v)} size=${24} /><span>${itemName(game, v)}${row.isTarget ? html` <span class="tag tag--target">your target</span>` : ''}</span></span>`;
      case 'recipe': return recipeLabel(game, v);
      case 'crew': return html`<${CrewSelect} recipe=${row.recipe} value=${v} update=${update} compact />`;
      case 'machines': return html`${fmt.machines(v.exact)} <span class="muted">→</span> <strong>${v.build ?? '?'}</strong>`;
      case 'rate': return fmt.rate(v);
      case 'amount': return fmt.amount(v);
      case 'rateLines': return lineText(fmt.rate, v);
      case 'amountLines': return lineText(fmt.amount, v);
      case 'parts': return v == null ? html`<span class="muted">target</span>` : v.map((/** @type {{ perMinute: number }} */ d) => fmt.rate(d.perMinute)).join(' + ') || '0';
      case 'seconds': return v == null ? '?' : fmt.seconds(v);
      default: return v ?? '';
    }
  };
  /** @param {Column} col */
  const heading = (col) => (PER_TIME.has(col.kind) ? `${col.label} ${fmt.perShort}` : col.label);

  return html`
    <div class="table-scroll">
      <table class="table">
        <thead>
          <tr>${columns.map((c) => html`<th key=${c.key} scope="col" class=${NUMERIC.has(c.kind) ? 'num' : ''}>${heading(c)}</th>`)}</tr>
        </thead>
        <tbody>
          ${Object.values(result.rows).map((row) => html`
            <tr key=${row.recipe} class=${row.isTarget ? 'is-target' : ''}>
              ${columns.map((c) => html`<td key=${c.key} class=${NUMERIC.has(c.kind) ? 'num' : ''}>${cell(c, row)}</td>`)}
            </tr>`)}
        </tbody>
      </table>
    </div>`;
}
