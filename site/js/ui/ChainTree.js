// @ts-check
/**
 * The chain as a tree: each input under the row that needs it, at that branch's rate. Every row can
 * change its spark crew, switch recipe (when an item has several), or be marked "I supply this".
 * Rows shared by several branches show their part and the combined total.
 * On phones each row is a compact card; its controls open with "Change".
 */
import { useMemo, useState } from 'preact/hooks';
import { html } from './html.js';
import { Icon } from './Icon.js';
import { Badge } from './Badge.js';
import { CrewSelect } from './CrewSelect.js';
import { useApp } from './context.js';
import { crewName, itemName, recipeLabel } from './format.js';
import { chainTree } from '../engine/calc.js';
import { STOP_LABELS } from '../data/badges.js';
import { chooseRecipe, toggleSupplied } from '../state/calc.js';

/** @typedef {import('../engine/calc.js').TreeNode} TreeNode */
/** @typedef {import('../engine/calc.js').Row} Row */
/** @typedef {import('../state/calc.js').Update} Update */
/** @typedef {import('../data/badges.js').Badge} BadgeData */

/**
 * @param {{ result: import('../engine/calc.js').Result, badges: Record<string, BadgeData[]>, supplied: string[], update: Update }} props
 */
export function ChainTree({ result, badges, supplied, update }) {
  const { game } = useApp();
  const tree = useMemo(() => chainTree(result), [result]);
  const [collapsed, setCollapsed] = useState(() => /** @type {Set<string>} */ (new Set()));
  const toggle = (/** @type {string} */ path) => setCollapsed((s) => {
    const next = new Set(s);
    if (!next.delete(path)) next.add(path);
    return next;
  });

  /** @param {TreeNode} node @param {number} depth @param {string} path @returns {any} */
  const branch = (node, depth, path) => {
    const open = !collapsed.has(path);
    const row = node.recipe ? result.rows[node.recipe] : null;
    return html`
      <li key=${path}>
        <${ChainRow} node=${node} depth=${depth} row=${row} badges=${row ? badges[row.recipe] : []}
          supplied=${supplied.includes(node.item)} update=${update} open=${open} onToggle=${() => toggle(path)} />
        ${node.children.length > 0 && open && html`
          <ul class="list-reset">${node.children.map((c, i) => branch(c, depth + 1, `${path}/${i}:${c.item}`))}</ul>`}
      </li>`;
  };

  return html`
    <div class="chain">
      <div class="chain__head small muted" aria-hidden="true">
        <span>Item</span><span class="num">Rate</span><span>Made in</span><span>Spark crew</span><span class="num">Machines</span>
      </div>
      <ul class="list-reset" aria-label=${`Production chain for ${itemName(game, tree.item)}`}>${branch(tree, 0, tree.item)}</ul>
    </div>`;
}

/** Switch which recipe makes an item, everywhere in the chain. @param {{ item: string, current: string | null, update: Update }} props */
function RecipeSelect({ item, current, update }) {
  const { game } = useApp();
  const options = game.items[item].producers;
  return html`
    <select class="input input--compact" aria-label=${`Recipe for ${itemName(game, item)}`} value=${current ?? ''}
      title=${current ? recipeLabel(game, current) : 'Choose another recipe'}
      onChange=${(/** @type {any} */ e) => e.currentTarget.value && update((c) => chooseRecipe(c, item, e.currentTarget.value))}>
      ${current == null && html`<option value="">Choose another recipe…</option>`}
      ${options.map((/** @type {string} */ id) => html`<option key=${id} value=${id}>${recipeLabel(game, id)}</option>`)}
    </select>`;
}

/** Where the item comes from: its recipe (switchable), or why the chain stops; plus "I supply this". */
function MadeIn(/** @type {{ node: TreeNode, isTarget: boolean, supplied: boolean, update: Update }} */ { node, isTarget, supplied, update }) {
  const { game } = useApp();
  const switchable = game.items[node.item].producers.length > 1;
  let how;
  if (node.recipe) how = switchable && !isTarget ? html`<${RecipeSelect} item=${node.item} current=${node.recipe} update=${update} />` : html`<span>${recipeLabel(game, node.recipe)}</span>`;
  else if (node.stop === 'loop' && switchable) how = html`<span class="muted">${STOP_LABELS.loop}</span><${RecipeSelect} item=${node.item} current=${null} update=${update} />`;
  else how = html`<span class="muted">${node.stop ? STOP_LABELS[node.stop] : ''}</span>`;
  return html`
    <div class="chain__made">
      <span class="chain__label">Made in</span>
      ${how}
      ${!isTarget && game.items[node.item].producers.length > 0 && html`
        <label class="chain__supply small">
          <input type="checkbox" checked=${supplied} onChange=${() => update((c) => toggleSupplied(c, node.item))} />
          I supply this
        </label>`}
    </div>`;
}

/**
 * @param {{ node: TreeNode, depth: number, row: Row | null, badges: BadgeData[], supplied: boolean, update: Update, open: boolean, onToggle: () => void }} props
 */
function ChainRow({ node, depth, row, badges, supplied, update, open, onToggle }) {
  const { game, fmt } = useApp();
  const [editing, setEditing] = useState(false);
  const name = itemName(game, node.item);
  const isTarget = depth === 0;
  const out = row?.outputs.find((o) => o.item === node.item);
  const shared = row && !isTarget && out && Math.abs(out.used - node.perMinute) > 1e-9;
  // Phones show this one line instead of the controls, until "Change" is tapped.
  const summary = row ? `${recipeLabel(game, row.recipe)}, ${crewName(game, row.crew)}` : node.stop ? STOP_LABELS[node.stop] : '';
  const canChange = Boolean(row) || game.items[node.item].producers.length > 0;
  const machines = fmt.machines(node.machines);

  return html`
    <div class=${`chain__row${isTarget ? ' is-target' : ''}${node.stop ? ' is-stop' : ''}${editing ? ' is-editing' : ''}`} style=${`--depth:${depth}`}>
      <div class="chain__item">
        ${node.children.length > 0
          ? html`<button class="chain__toggle" type="button" aria-expanded=${open} aria-label=${`${open ? 'Collapse' : 'Expand'} ${name}`} onClick=${onToggle}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d=${open ? 'M6 9l6 6 6-6' : 'M9 6l6 6-6 6'} /></svg>
            </button>`
          : html`<span class="chain__toggle" aria-hidden="true"></span>`}
        <${Icon} kind="items" id=${node.item} name=${name} />
        <span class="chain__name">
          <strong>${name}</strong>${isTarget ? html` <span class="tag tag--target">your target</span>` : ''}
          ${badges.length > 0 && html`<span class="chain__badges">${badges.map((b) => html`<${Badge} key=${b.code + b.text} badge=${b} />`)}</span>`}
        </span>
      </div>

      <span class="chain__summary small muted">${summary}</span>

      <div class="chain__rate num">
        <span><strong>${fmt.rate(node.perMinute)}</strong><span class="small muted"> ${fmt.perShort}</span></span>
        ${shared && out && html`<span class="small muted">part of ${fmt.rate(out.used)}${fmt.perShort}</span>`}
      </div>

      ${canChange && html`
        <button type="button" class="chain__edit button button--quiet" aria-expanded=${editing} onClick=${() => setEditing(!editing)}>${editing ? 'Done' : 'Change'}</button>`}

      <${MadeIn} node=${node} isTarget=${isTarget} supplied=${supplied} update=${update} />

      <div class="chain__crew">
        <span class="chain__label">Spark crew</span>
        ${row && html`<${CrewSelect} recipe=${row.recipe} value=${row.crew} update=${update} compact />`}
      </div>

      <div class="chain__machines num">
        ${row && html`
          <span><strong>${machines}</strong> <span class="chain__unit small muted">${machines === '1' ? 'machine' : 'machines'}</span></span>
          <span class="small muted">${shared ? `of ${fmt.machines(row.machines)} ` : ''}→ ${row.build ?? '?'}</span>`}
      </div>
    </div>`;
}
