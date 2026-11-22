// @ts-check
/** What the chain needs: machines per building, the output, inputs from outside, and the build list. */
import { html } from './html.js';
import { Icon } from './Icon.js';
import { useApp } from './context.js';
import { buildingName, crewName, itemName, recipeName } from './format.js';
import { perBuilding } from '../engine/calc.js';
import { STOP_LABELS } from '../data/merge.js';

/**
 * @param {{ result: ReturnType<typeof import('../engine/calc.js').calculate> }} props
 */
export function Results({ result }) {
  const { game, fmt } = useApp();
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
            ${result.raw.map((r) => html`<li key=${r.item}>
              <${Icon} kind="items" id=${r.item} name=${itemName(game, r.item)} size=${22} />
              <span><strong>${fmt.rate(r.perMinute)}</strong> ${itemName(game, r.item)} ${fmt.per} <span class="muted">(${r.stop ? STOP_LABELS[r.stop] : ''})</span></span>
            </li>`)}
          </ul>
        </div>`}
      ${loops.length > 0 && html`
        <p class="notice" role="note">
          ${loops.length === 1
            ? `${loopText} is needed inside its own chain, so it's counted as supplied from outside. Choose another recipe for it to avoid the loop.`
            : `${loopText} are needed inside their own chains, so they're counted as supplied from outside. Choose other recipes for them to avoid the loops.`}
        </p>`}
    </section>

    <section class="panel" aria-labelledby="build-h">
      <h2 id="build-h">Build list</h2>
      <div class="table-scroll">
        <table class="table">
          <thead>
            <tr><th scope="col">Building</th><th scope="col">Recipe</th><th scope="col">Spark crew</th><th scope="col" class="num">Exact</th><th scope="col" class="num">Build</th></tr>
          </thead>
          <tbody>
            ${Object.values(result.rows).map((r) => html`
              <tr key=${r.recipe} class=${r.isTarget ? 'is-target' : ''}>
                <td><span class="cell-with-icon"><${Icon} kind="buildings" id=${r.building} name=${buildingName(game, r.building)} size=${24} />${buildingName(game, r.building)}</span></td>
                <td>${recipeName(game, r.recipe)}${r.isTarget ? html` <span class="tag tag--target">your target</span>` : ''}</td>
                <td>${crewName(game, r.crew)}</td>
                <td class="num">${fmt.machines(r.machines)}</td>
                <td class="num"><strong>${r.build ?? '?'}</strong></td>
              </tr>`)}
          </tbody>
        </table>
      </div>
    </section>`;
}
