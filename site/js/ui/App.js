// @ts-check
/**
 * The calculator page. App owns the open tabs (site/js/state/tabs.js, kept in sessionStorage), the saved
 * library (site/js/state/library.js, localStorage) and the user's prefs; everything below changes them
 * only through the pure updaters in site/js/state/.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { html } from './html.js';
import { AppContext, useApp } from './context.js';
import { Picker } from './Picker.js';
import { RecipeCards } from './RecipeCards.js';
import { Results } from './Results.js';
import { Header } from './Header.js';
import { TabBar } from './TabBar.js';
import { TabToolbar } from './TabToolbar.js';
import { Library } from './Library.js';
import { CrewSelect } from './CrewSelect.js';
import { buildingName, makeFormat } from './format.js';
import { calculate } from '../engine/calc.js';
import { fromRecipe, pickBuilding, setCount, setRecipe } from '../state/calc.js';
import { activeTab, closeTab, dismissMissing, newKey, newTab, openLink, openSaved, readStoredSession, selectTab, storeSession, syncWithLibrary, tabLabel, updateActive } from '../state/tabs.js';
import { exportEntries, newId, readStoredLibrary, savedCalc, storeLibrary } from '../state/library.js';
import { libraryFileName } from './download.js';
import { Notice } from './Notice.js';
import { renameOpenTab, saveTab, saveTabAs } from '../state/saving.js';
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

  // The saved library. Open tabs follow it: a renamed saved tab renames its open tab; a deleted one leaves it unsaved.
  const [library, setLibrary] = useState(readStoredLibrary);
  const [libraryStored, setLibraryStored] = useState(true);
  const [libraryOpen, setLibraryOpen] = useState(false);
  useLayoutEffect(() => {
    setLibraryStored(storeLibrary(library));
    setSession((s) => syncWithLibrary(s, library.tabs));
  }, [library]);

  // Unsaved work: the browser asks before the page is closed or reloaded.
  const unsaved = session.open.some((t) => t.dirty && t.draft.recipe);
  useEffect(() => {
    if (!unsaved) return undefined;
    const warn = (/** @type {BeforeUnloadEvent} */ e) => e.preventDefault();
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [unsaved]);

  /** Saving changes the open tabs and the library together (site/js/state/saving.js). @param {(both: import('../state/saving.js').Both) => import('../state/saving.js').Both} fn */
  const both = (fn) => {
    const next = fn({ session, lib: library });
    if (next.session !== session) setSession(next.session);
    if (next.lib !== library) setLibrary(next.lib);
  };
  const stamp = () => ({ now: new Date().toISOString(), dataVersion: game.meta.dataVersion });
  const save = () => both((b) => saveTab(b, tab.key, stamp(), game));
  const saveAs = (/** @type {string} */ name, /** @type {string | null} */ folder) =>
    both((b) => saveTabAs(b, tab.key, { id: newId('t'), name, folder }, stamp(), game));
  const openFromLibrary = (/** @type {string} */ tabId) => {
    const saved = library.tabs[tabId];
    setSession((s) => openSaved(s, { tabId, name: saved.name, ...savedCalc(game, saved.calc, resolveId) }, newKey()));
    if (matchMedia('(max-width: 900px)').matches) setLibraryOpen(false);
  };
  const renameOpen = (/** @type {string} */ key, /** @type {string} */ name) => both((b) => renameOpenTab(b, key, name, game));

  // Excel export: this tab (as it is now, unsaved changes included), a saved tab, a folder or the whole
  // library. The workbook code and ExcelJS load only now, the first time someone exports.
  const [exportNote, setExportNote] = useState(/** @type {{ tone: 'busy' | 'ok' | 'warn', text: string } | null} */ (null));
  /** @param {{ kind: 'tab' } | { kind: 'saved' | 'folder', id: string } | { kind: 'library' }} target */
  const exportTo = async (target) => {
    const label = tabLabel(game, tab);
    const { name, entries } = target.kind === 'tab'
      ? { name: label, entries: [{ name: label, path: [], calc: tab.draft, missing: tab.missing }] }
      : exportEntries(game, library, target, resolveId);
    setExportNote({ tone: 'busy', text: 'Preparing the Excel file…' });
    try {
      const [{ buildWorkbook }, { saveWorkbook, fileNameFor }] = await Promise.all([import('../export/workbook.js'), import('../export/xlsx.js')]);
      const file = fileNameFor(name ?? libraryFileName());
      await saveWorkbook(buildWorkbook(game, entries, { defaultCrew: prefs.defaultCrew, now: new Date() }), file);
      setExportNote({ tone: 'ok', text: `Downloaded “${file}”.` });
    } catch (err) {
      console.error(err);
      setExportNote({ tone: 'warn', text: `The Excel file couldn't be made: ${/** @type {Error} */ (err).message}.` });
    }
  };
  // The library list is memoised; it calls the latest exportTo through this ref (current prefs and tabs).
  const exportRef = useRef(exportTo);
  exportRef.current = exportTo;
  // The library list only re-renders when the library itself, or which saved tab is current, changes.
  const libraryView = useMemo(() => libraryOpen && html`
    <button type="button" class="library-scrim" aria-label="Close the library" tabindex="-1" onClick=${() => setLibraryOpen(false)}></button>
    <${Library} lib=${library} change=${setLibrary} stored=${libraryStored} activeTabId=${tab.tabId}
      onOpen=${openFromLibrary} onExport=${(/** @type {any} */ t) => exportRef.current(t)} onClose=${() => setLibraryOpen(false)} />`, [libraryOpen, library, libraryStored, tab.tabId]);

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
      <${Header} calc=${calc} prefsStored=${prefsStored} libraryOpen=${libraryOpen} onLibrary=${() => setLibraryOpen(!libraryOpen)}>
        <${TabBar} session=${session}
          onSelect=${(/** @type {string} */ key) => setSession((s) => selectTab(s, key))}
          onNew=${() => setSession((s) => newTab(s, newKey()))}
          onClose=${(/** @type {string} */ key) => setSession((s) => closeTab(s, key, newKey()))}
          onRename=${renameOpen} />
      <//>
      <div class="container workspace">
        ${libraryView}
        <main class="layout" key=${tab.key}>
          ${tab.missing.length > 0 && html`
            <${Notice} className="layout__banner" onDismiss=${() => setSession(dismissMissing)}>
              Not in the current game data, so left out: ${tab.missing.join(', ')}. This happens with links and tabs made before a data update.
              ${!calc.recipe && calc.building && ` Choose another recipe for the ${buildingName(game, calc.building)}.`}
            <//>`}
          ${exportNote && html`
            <${Notice} className="layout__banner" tone=${exportNote.tone === 'ok' ? 'ok' : 'warn'}
              onDismiss=${exportNote.tone === 'busy' ? undefined : () => setExportNote(null)}>${exportNote.text}<//>`}
          <${TargetPanel} calc=${calc} update=${update} crew=${result?.rows[calc.recipe]?.crew ?? prefs.defaultCrew} />
          <div class="results">
            ${calc.recipe && html`<${TabToolbar} tab=${tab} lib=${library} onSave=${save} onSaveAs=${saveAs} onExport=${() => exportTo({ kind: 'tab' })} />`}
            ${result
              ? html`<${Results} result=${result} calc=${calc} update=${update} />`
              : html`<${EmptyState} hasBuilding=${Boolean(calc.building)} onExample=${(/** @type {typeof EXAMPLES[number]} */ ex) => update(() => fromRecipe(game, ex.recipe, { count: ex.count }))} />`}
          </div>
        </main>
      </div>
    <//>`;
}
