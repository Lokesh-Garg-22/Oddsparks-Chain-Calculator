// @ts-check
/**
 * The open calculations, as tabs in the header (mockup: Library and Mobile screens). A dot marks
 * unsaved changes; double-click or F2 renames; closing a tab with changes asks first.
 */
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { html } from './html.js';
import { ConfirmDialog } from './Dialog.js';
import { useApp } from './context.js';
import { tabLabel } from '../state/tabs.js';

/** @typedef {import('../state/tabs.js').Session} Session */
/** @typedef {import('../state/tabs.js').OpenTab} OpenTab */

/**
 * @param {{ session: Session, onSelect: (key: string) => void, onNew: () => void, onClose: (key: string) => void, onRename: (key: string, name: string) => void }} props
 */
export function TabBar({ session, onSelect, onNew, onClose, onRename }) {
  const { game } = useApp();
  const [editing, setEditing] = useState(/** @type {string | null} */ (null));
  const [closing, setClosing] = useState(/** @type {OpenTab | null} */ (null));
  const list = useRef(/** @type {HTMLUListElement | null} */ (null));

  // Keep the active tab in view when the row scrolls (phones, many tabs).
  useLayoutEffect(() => {
    list.current?.querySelector('.tab.is-active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [session.active, session.open.length]);

  /** @param {OpenTab} tab */
  const askClose = (tab) => (tab.dirty ? setClosing(tab) : onClose(tab.key));

  return html`
    <nav class="tabbar" aria-label="Open calculations">
      <ul class="tabbar__list list-reset" ref=${list}>
        ${session.open.map((tab) => {
          const label = tabLabel(game, tab);
          const active = tab.key === session.active;
          return html`
            <li key=${tab.key} class=${`tab${active ? ' is-active' : ''}`}>
              ${editing === tab.key
                ? html`<${RenameField} initial=${tab.name ?? label} onDone=${(/** @type {string | null} */ name) => {
                    setEditing(null);
                    // Unchanged keeps it as it was, so an automatic name keeps following its calc.
                    if (name != null && name.trim() !== label) onRename(tab.key, name);
                  }} />`
                : html`
                  <button type="button" class="tab__select" aria-current=${active ? 'page' : undefined}
                    title="Double-click or press F2 to rename"
                    onClick=${() => onSelect(tab.key)}
                    onDblClick=${() => setEditing(tab.key)}
                    onKeyDown=${(/** @type {KeyboardEvent} */ e) => { if (e.key === 'F2') { e.preventDefault(); setEditing(tab.key); } }}>
                    <span class="tab__label">${label}</span>
                    ${tab.dirty && html`<span class="tab__dot" role="img" aria-label="unsaved changes"></span>`}
                  </button>`}
              <button type="button" class="tab__close" aria-label=${`Close ${label}`} onClick=${() => askClose(tab)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </li>`;
        })}
      </ul>
      <button type="button" class="button button--chrome tabbar__new" aria-label="New calculation" title="New calculation" onClick=${onNew}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      ${closing && html`
        <${ConfirmDialog} title=${`Close “${tabLabel(game, closing)}”?`} onCancel=${() => setClosing(null)}
          actions=${[
            { label: 'Keep it open', tone: 'quiet', onClick: () => setClosing(null) },
            { label: 'Close tab', tone: 'danger', onClick: () => { onClose(closing.key); setClosing(null); } },
          ]}>
          <p>It has changes that aren't saved, so closing it loses them.</p>
        <//>`}
    </nav>`;
}

/** Inline rename: Enter or leaving the field keeps it, Escape cancels; blank goes back to the automatic name. */
function RenameField(/** @type {{ initial: string, onDone: (name: string | null) => void }} */ { initial, onDone }) {
  const input = useRef(/** @type {HTMLInputElement | null} */ (null));
  const done = useRef(false);
  useLayoutEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  /** @param {string | null} name */
  const finish = (name) => {
    if (done.current) return;
    done.current = true;
    onDone(name);
  };
  return html`
    <input ref=${input} class="input tab__rename" aria-label="Tab name" value=${initial} maxlength="60"
      onKeyDown=${(/** @type {KeyboardEvent} */ e) => {
        if (e.key === 'Enter') finish(/** @type {HTMLInputElement} */ (e.currentTarget).value);
        else if (e.key === 'Escape') finish(null);
      }}
      onBlur=${(/** @type {FocusEvent} */ e) => finish(/** @type {HTMLInputElement} */ (e.currentTarget).value)} />`;
}
