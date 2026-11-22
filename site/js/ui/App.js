// @ts-check
/**
 * The calculator page. App owns the open tabs (site/js/state/tabs.js, kept in sessionStorage) and the
 * user's prefs; everything below edits the active tab's calc only through the state updaters.
 */
import { useEffect, useLayoutEffect, useMemo, useState } from 'preact/hooks';
import { html } from './html.js';
import { AppContext, useApp } from './context.js';
import { Picker } from './Picker.js';
import { RecipeCards } from './RecipeCards.js';
import { Results } from './Results.js';
import { Header } from './Header.js';
import { TabBar } from './TabBar.js';
import { CrewSelect } from './CrewSelect.js';
import { makeFormat } from './format.js';
import { calculate } from '../engine/calc.js';
import { fromRecipe, pickBuilding, setCount, setRecipe } from '../state/calc.js';
import { activeTab, closeTab, dismissMissing, newKey, newTab, openLink, readStoredSession, renameTab, selectTab, storeSession, updateActive } from '../state/tabs.js';
import { applyTheme, cleanPrefs, readStoredPrefs, storePrefs } from '../state/prefs.js';
import { takeShareLink } from '../state/url.js';
import { resolveId } from '../data/merge.js';

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
  // The open tabs, restored from this browser tab's session; a share link in the address bar opens as a new tab.
  const [session, setSession] = useState(() => {
    const restored = readStoredSession(game, resolveId);
    const link = takeShareLink(game, resolveId);
    return link ? openLink(restored, link, newKey()) : restored;
  });
  useLayoutEffect(() => {
    storeSession(session);
  }, [session]);
  // A share link pasted into the open page.
  useEffect(() => {
    const onHash = () => {
      const link = takeShareLink(game, resolveId);
      if (link) setSession((s) => openLink(s, link, newKey()));
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, [game]);
  const tab = activeTab(session);
  const calc = tab.draft;
  const [prefs, setPrefs] = useState(() => cleanPrefs(game, readStoredPrefs(), resolveId));
  const [prefsStored, setPrefsStored] = useState(true);
  // Layout effects: the theme switches in the same frame, and a change is stored before the page can be left.
  useLayoutEffect(() => setPrefsStored(storePrefs(prefs)), [prefs]);
  useLayoutEffect(() => applyTheme(prefs.theme), [prefs.theme]);
  const fmt = useMemo(() => makeFormat(prefs), [prefs.unit, prefs.decimals]);
  const context = useMemo(() => ({ game, fmt, prefs, setPrefs }), [game, fmt, prefs]);

  /** @type {Update} */
  const update = (fn) => setSession((s) => updateActive(s, fn));
  // Only the inputs the engine reads: switching tree/list (calc.view) doesn't recalculate.
  const { recipe, count, crews, recipeChoice, supplied } = calc;
  const result = useMemo(
    () => (recipe && count > 0 ? calculate(game, { recipe, count, crews, recipeChoice, supplied }, { defaultCrew: prefs.defaultCrew }) : null),
    [game, recipe, count, crews, recipeChoice, supplied, prefs.defaultCrew],
  );

  return html`
    <${AppContext.Provider} value=${context}>
      <${Header} calc=${calc} prefsStored=${prefsStored}>
        <${TabBar} session=${session}
          onSelect=${(/** @type {string} */ key) => setSession((s) => selectTab(s, key))}
          onNew=${() => setSession((s) => newTab(s, newKey()))}
          onClose=${(/** @type {string} */ key) => setSession((s) => closeTab(s, key, newKey()))}
          onRename=${(/** @type {string} */ key, /** @type {string} */ name) => setSession((s) => renameTab(s, key, name))} />
      <//>
      <main class="container layout" key=${tab.key}>
        ${tab.missing.length > 0 && html`
          <div class="notice layout__banner banner" role="status">
            <p>Not in the current game data, so left out: ${tab.missing.join(', ')}. This happens with links and tabs made before a data update.</p>
            <button type="button" class="button button--quiet" onClick=${() => setSession(dismissMissing)}>Dismiss</button>
          </div>`}
        <${TargetPanel} calc=${calc} update=${update} crew=${result?.rows[calc.recipe]?.crew ?? prefs.defaultCrew} />
        <div class="results">
          ${result
            ? html`<${Results} result=${result} calc=${calc} update=${update} />`
            : html`<${EmptyState} hasBuilding=${Boolean(calc.building)} onExample=${(/** @type {typeof EXAMPLES[number]} */ ex) => update(() => fromRecipe(game, ex.recipe, { count: ex.count }))} />`}
        </div>
      </main>
    <//>`;
}
