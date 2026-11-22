// @ts-check
/**
 * The calculator page. App owns the tab's calc (the stored shape, site/js/state/calc.js) and the user's
 * prefs; everything below edits the calc only through the state updaters.
 */
import { useMemo, useState } from 'preact/hooks';
import { html } from './html.js';
import { AppContext, useApp } from './context.js';
import { Picker } from './Picker.js';
import { RecipeCards } from './RecipeCards.js';
import { Results } from './Results.js';
import { CrewSelect } from './CrewSelect.js';
import { makeFormat } from './format.js';
import { calculate } from '../engine/calc.js';
import { emptyCalc, fromRecipe, pickBuilding, setCount, setRecipe } from '../state/calc.js';

/** @typedef {import('../state/calc.js').TabCalc} TabCalc */
/** @typedef {import('../state/calc.js').Update} Update */

/** Starting points for a first visit (real recipes). */
const EXAMPLES = [
  { label: '1 Spark Workbench making Crafty Spark', recipe: 'spark-workbench--crafty-spark', count: 1 },
  { label: '3 Wood Workshops making Wooden Blade', recipe: 'wood-workshop--wooden-blade', count: 3 },
  { label: '2 Furnaces making Copper Ingot', recipe: 'furnace--copper-ingot--from-copper-ore', count: 2 },
];

/** @param {{ calc: TabCalc, update: Update, crew: string }} props */
function TargetControls({ calc, update, crew }) {
  return html`
    <div class="target__controls">
      <label class="field">
        <span class="field__label">How many machines</span>
        <input class="input" type="number" min="0" step="1" inputmode="decimal" value=${calc.count}
          onInput=${(/** @type {any} */ e) => {
            const text = e.currentTarget.value;
            // A blank or half-typed field is ignored, so the results don't flicker while editing.
            if (text !== '') update((c) => setCount(c, Number(text)));
          }} />
      </label>
      <label class="field">
        <span class="field__label">Spark crew</span>
        <${CrewSelect} recipe=${calc.recipe} value=${crew} update=${update} />
      </label>
    </div>`;
}

/** @param {{ calc: TabCalc, update: Update, crew: string }} props */
function TargetPanel({ calc, update, crew }) {
  const { game } = useApp();
  return html`
    <section class="panel target" aria-labelledby="target-h">
      <h2 id="target-h">What do you want to run?</h2>
      <${Picker} building=${calc.building} onPick=${(/** @type {string} */ b, /** @type {string | undefined} */ r) => update((c) => pickBuilding(c, game, b, r))} />
      ${calc.building && html`<${RecipeCards} building=${calc.building} selected=${calc.recipe}
        onSelect=${(/** @type {string} */ r) => update((c) => setRecipe(c, r))} />`}
      ${calc.recipe && html`<${TargetControls} calc=${calc} update=${update} crew=${crew} />`}
    </section>`;
}

/** @param {{ hasBuilding: boolean, onExample: (example: typeof EXAMPLES[number]) => void }} props */
function EmptyState({ hasBuilding, onExample }) {
  return html`
    <section class="panel empty">
      <svg class="spark-mark" width="72" height="72" stroke-width="1.4" aria-hidden="true"><use href="#spark" /></svg>
      <h2>${hasBuilding ? 'Choose a recipe' : 'Pick a building to see its chain'}</h2>
      <p class="muted">Choose a building and recipe and say how many you want to run. You'll see every building and resource needed to keep them busy.</p>
      ${!hasBuilding && html`
        <p class="empty__examples-label">Or start from an example:</p>
        <div class="empty__examples">
          ${EXAMPLES.map((ex) => html`<button key=${ex.recipe} class="button button--outline" type="button" onClick=${() => onExample(ex)}>${ex.label}</button>`)}
        </div>`}
    </section>`;
}

/** @param {{ game: any }} props */
export function App({ game }) {
  const [calc, setCalc] = useState(emptyCalc);
  // Display settings; the settings panel and per-browser saving arrive in step 8.
  const [prefs] = useState(/** @type {import('./format.js').Prefs} */ ({ unit: 'min', decimals: 2, defaultCrew: game.defaultCrew }));
  const context = useMemo(() => ({ game, fmt: makeFormat(prefs) }), [game, prefs]);

  /** @type {Update} */
  const update = (fn) => setCalc(fn);
  const result = useMemo(
    () => (calc.recipe && calc.count > 0 ? calculate(game, calc, { defaultCrew: prefs.defaultCrew }) : null),
    [game, calc, prefs.defaultCrew],
  );

  return html`
    <${AppContext.Provider} value=${context}>
      <main class="container layout">
        <${TargetPanel} calc=${calc} update=${update} crew=${result?.rows[calc.recipe]?.crew ?? prefs.defaultCrew} />
        <div class="results">
          ${result
            ? html`<${Results} result=${result} calc=${calc} update=${update} />`
            : html`<${EmptyState} hasBuilding=${Boolean(calc.building)} onExample=${(/** @type {typeof EXAMPLES[number]} */ ex) => setCalc(fromRecipe(game, ex.recipe, { count: ex.count }))} />`}
        </div>
      </main>
    <//>`;
}
