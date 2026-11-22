// @ts-check
/** What the chain needs: machines per building, the output, inputs from outside, the chain itself, and what's left over. */
import { useMemo } from 'preact/hooks';
import { html } from './html.js';
import { Icon } from './Icon.js';
import { ItemRate } from './ItemRate.js';
import { ChainTree } from './ChainTree.js';
import { BuildList, ColumnsMenu } from './BuildList.js';
import { SidePanels } from './SidePanels.js';
import { useApp } from './context.js';
import { buildingName, itemName, recipeName } from './format.js';
import { perBuilding } from '../engine/calc.js';
import { STOP_LABELS, rowBadges } from '../data/badges.js';
import { setView } from '../state/calc.js';

/** @typedef {import('../engine/calc.js').Result} Result */
/** @typedef {import('../state/calc.js').TabCalc} TabCalc */

/**
 * @param {{ result: Result, calc: TabCalc, update: import('../state/calc.js').Update }} props
 */
export function Results({ result, calc, update }) {
  const { game, fmt } = useApp();
  const badges = useMemo(() => rowBadges(game, result), [game, result]);
  const view = calc.view ?? 'tree';
  const show = (/** @type {'tree' | 'list'} */ v) => update((c) => setView(c, v));
  const loops = result.loops;
  const loopText = loops.map((l) => `${fmt.rate(l.perMinute)} ${itemName(game, l.item)}${fmt.perShort}`).join(', ');

  return html`
    <section class="panel" aria-labelledby="need-h">
      <div class="panel__head">
        <h2 id="need-h">You need</h2>
        <p class="output muted">Makes <strong>${fmt.rate(result.output.perMinute)} ${itemName(game, result.output.item)}</strong> ${fmt.per}</p>
      </div>
      <ul class="tiles list-reset">
        ${perBuilding(result).map((b) => html`
          <li class="tile" key=${b.building}>
            <${Icon} kind="buildings" id=${b.building} name=${buildingName(game, b.building)} size=${44} />
            <span class="tile__count">${b.build ?? '?'}</span>
            <span class="tile__name">${buildingName(game, b.building)}</span>
            <span class="tile__for small muted">${b.recipes.map((r) => recipeName(game, r)).join(', ')}</span>
          </li>`)}
      </ul>
      ${result.raw.length > 0 && html`
        <div class="stack-s">
          <h3>From outside the chain</h3>
          <ul class="plain-list list-reset">
            ${result.raw.map((r) => html`<${ItemRate} key=${r.item} item=${r.item} perMinute=${r.perMinute} note=${r.stop ? STOP_LABELS[r.stop] : ''} />`)}
          </ul>
        </div>`}
      ${loops.length > 0 && html`
        <p class="notice" role="note">
          ${loops.length === 1
            ? `${loopText} is needed inside its own chain, so it's counted as supplied from outside. Choose another recipe for it in the chain below to avoid the loop.`
            : `${loopText} are needed inside their own chains, so they're counted as supplied from outside. Choose other recipes for them in the chain below to avoid the loops.`}
        </p>`}
    </section>

    <section class="panel" aria-labelledby="chain-h">
      <div class="panel__head">
        <h2 id="chain-h">Production chain</h2>
        <div class="panel__tools">
          ${view === 'list' && html`<${ColumnsMenu} />`}
          <div class="switch" role="group" aria-label="Show the chain as">
            <button type="button" aria-pressed=${view === 'tree'} onClick=${() => show('tree')}>Chain tree</button>
            <button type="button" aria-pressed=${view === 'list'} onClick=${() => show('list')}>Build list</button>
          </div>
        </div>
      </div>
      ${view === 'tree'
        ? html`<${ChainTree} result=${result} badges=${badges} supplied=${calc.supplied} update=${update} />`
        : html`<${BuildList} result=${result} update=${update} />`}
    </section>

    <${SidePanels} result=${result} badges=${badges} />`;
}
