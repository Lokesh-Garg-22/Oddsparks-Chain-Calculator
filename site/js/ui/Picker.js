// @ts-check
/**
 * Choose a building: search by building or by an item it makes (in-game names and aliases count),
 * grouped like the wiki's Buildings page. Picking an item selects its default recipe's building and recipe.
 */
import { useMemo, useState } from 'preact/hooks';
import { html } from './html.js';
import { Icon } from './Icon.js';
import { useApp } from './context.js';
import { buildingName, buildingsMaking } from './format.js';

/** Lowercased names to search per entry (display name, wiki name, aliases). @param {Record<string, any>} map */
const searchIndex = (map) => Object.entries(map).map(([id, e]) => ({ id, entry: e, names: [e.displayName, e.name, ...e.aliases].map((s) => s.toLowerCase()) }));

/** Buildings grouped in Buildings-page order; unlisted groups (Shrines, Other) last. @param {any} game @param {string[]} ids */
function grouped(game, ids) {
  const order = (/** @type {string} */ id) => game.buildings[id].pageOrder ?? Infinity;
  const sorted = ids.toSorted((a, b) => order(a) - order(b) || buildingName(game, a).localeCompare(buildingName(game, b)));
  return [...Map.groupBy(sorted, (id) => game.buildings[id].group)];
}

/**
 * @param {{ building: string | null, onPick: (building: string, recipe?: string) => void }} props
 */
export function Picker({ building, onPick }) {
  const { game } = useApp();
  const [query, setQuery] = useState('');
  const [browsing, setBrowsing] = useState(false);
  const index = useMemo(() => ({ items: searchIndex(game.items).filter((i) => i.entry.defaultRecipe), buildings: searchIndex(game.buildings) }), [game]);

  const q = query.trim().toLowerCase();
  // Names that start with the search come first ("tim" → Timber before Sawn Timber).
  const items = q
    ? index.items
      .filter((i) => i.names.some((n) => n.includes(q)))
      .map((i) => ({ ...i, starts: i.names.some((n) => n.startsWith(q)) }))
      .sort((a, b) => Number(b.starts) - Number(a.starts) || a.entry.displayName.localeCompare(b.entry.displayName))
      .slice(0, 6)
    : [];
  const madeHere = new Set(items.flatMap((i) => buildingsMaking(game, i.id)));
  const buildings = index.buildings.filter((b) => !q || b.names.some((n) => n.includes(q)) || madeHere.has(b.id)).map((b) => b.id);
  const showList = !building || browsing || q;

  const pick = (/** @type {string} */ id, /** @type {string | undefined} */ recipe) => {
    onPick(id, recipe);
    setQuery('');
    setBrowsing(false);
  };

  return html`
    <div class="picker">
      <label class="field">
        <span class="field__label">Find a building, or an item it makes</span>
        <input class="input" type="search" value=${query} placeholder="e.g. Timber, Sawbench" autocomplete="off"
          onInput=${(/** @type {any} */ e) => setQuery(e.currentTarget.value)} />
      </label>

      ${building && !showList && html`
        <div class="picker__chosen box">
          <${Icon} kind="buildings" id=${building} name=${buildingName(game, building)} size=${36} />
          <div class="picker__chosen-text">
            <strong>${buildingName(game, building)}</strong>
            <span class="small muted">${game.buildings[building].group}</span>
          </div>
          <button class="button button--quiet" type="button" onClick=${() => setBrowsing(true)}>Change</button>
        </div>`}

      ${showList && html`
        <div class="picker__results box">
          ${items.length > 0 && html`
            <h3 class="picker__group small muted">Items</h3>
            <ul class="list-reset">
              ${items.map(({ id, entry }) => {
                const alias = entry.displayName !== entry.name ? ` (${entry.name} on the wiki)` : '';
                return html`<li key=${id}>
                  <button class="picker__option" type="button" onClick=${() => pick(game.recipes[entry.defaultRecipe].building, entry.defaultRecipe)}>
                    <${Icon} kind="items" id=${id} name=${entry.displayName} />
                    <span><strong>${entry.displayName}</strong><span class="small muted">${alias}. Made in ${buildingsMaking(game, id).map((b) => buildingName(game, b)).join(', ')}</span></span>
                  </button>
                </li>`;
              })}
            </ul>`}
          ${grouped(game, buildings).map(([group, ids]) => html`
            <h3 class="picker__group small muted" key=${group}>${group}</h3>
            <ul class="list-reset" key=${`${group}-list`}>
              ${ids.map((id) => html`<li key=${id}>
                <button class=${`picker__option${id === building ? ' is-selected' : ''}`} type="button" aria-pressed=${id === building} onClick=${() => pick(id)}>
                  <${Icon} kind="buildings" id=${id} name=${buildingName(game, id)} />
                  <span><strong>${buildingName(game, id)}</strong></span>
                </button>
              </li>`)}
            </ul>`)}
          ${q && !items.length && !buildings.length && html`<p class="muted picker__none">Nothing matches "${query}". Try a building or item name, like Logger or Timber.</p>`}
        </div>`}
    </div>`;
}
