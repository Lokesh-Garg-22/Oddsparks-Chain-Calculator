// @ts-check
/** Below the chain: what's left over (byproducts, spare capacity) and everything worth a warning. */
import { html } from './html.js';
import { ItemRate } from './ItemRate.js';
import { BadgeTag } from './Badge.js';
import { useApp } from './context.js';
import { recipeLabel } from './format.js';
import { spareCapacity } from '../engine/calc.js';
import { chainWarnings } from '../data/badges.js';

/** @typedef {import('../data/badges.js').Badge} Badge */

/** @param {{ result: import('../engine/calc.js').Result }} props */
function Byproducts({ result }) {
  const { game } = useApp();
  const spare = spareCapacity(result);
  /** @param {{ item: string, perMinute: number, recipe: string }} e @param {string} from */
  const line = (e, from) => html`<${ItemRate} key=${e.recipe + e.item} item=${e.item} perMinute=${e.perMinute} note=${`${from} ${recipeLabel(game, e.recipe)}`} />`;
  return html`
    <section class="panel" aria-labelledby="byproducts-h">
      <h2 id="byproducts-h">Byproducts and spare capacity</h2>
      ${result.byproducts.length
        ? html`<ul class="plain-list list-reset">${result.byproducts.map((b) => line(b, 'from'))}</ul>
            <p class="small muted">Byproducts are listed only; they don't reduce what the rest of the chain needs.</p>`
        : html`<p class="muted">No byproducts in this chain.</p>`}
      <h3>Spare from rounding up</h3>
      ${spare.length
        ? html`<ul class="plain-list list-reset">${spare.map((s) => line(s, 'more from'))}</ul>`
        : html`<p class="muted">None: every machine runs at full speed.</p>`}
    </section>`;
}

/** @param {{ badges: Record<string, Badge[]> }} props */
function Warnings({ badges }) {
  const { game } = useApp();
  const list = chainWarnings(badges);
  return html`
    <section class="panel" aria-labelledby="warnings-h">
      <h2 id="warnings-h">Warnings${list.length ? ` (${list.length})` : ''}</h2>
      ${list.length
        ? html`<ul class="warnings list-reset">
            ${list.map(({ recipe, badge }) => html`
              <li key=${recipe + badge.code + badge.text}>
                <span class="warnings__head"><${BadgeTag} badge=${badge} /> <strong>${recipeLabel(game, recipe)}</strong></span>
                <span class="small">${badge.detail}</span>
              </li>`)}
          </ul>`
        : html`<p class="muted">Nothing unconfirmed in this chain, no fuel needed, and no recipe loops.</p>`}
    </section>`;
}

/** @param {{ result: import('../engine/calc.js').Result, badges: Record<string, Badge[]> }} props */
export function SidePanels({ result, badges }) {
  return html`
    <div class="side-panels">
      <${Byproducts} result=${result} />
      <${Warnings} badges=${badges} />
    </div>`;
}
