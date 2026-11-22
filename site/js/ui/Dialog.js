// @ts-check
/**
 * A question that needs an answer before going on, as a native modal <dialog>: focus is trapped,
 * Escape means "cancel". Used for closing an unsaved tab, and later for the library's deletes and
 * restores (plan, UI §10), which offer more than two choices.
 */
import { useLayoutEffect, useRef } from 'preact/hooks';
import { html } from './html.js';

/**
 * @typedef {object} DialogAction
 * @property {string} label says exactly what happens ("Close tab", "Delete folder and its tabs")
 * @property {'quiet' | 'primary' | 'danger'} tone
 * @property {() => void} onClick
 */

/**
 * @param {{ title: string, children: any, actions: DialogAction[], onCancel: () => void }} props
 * The first action gets the focus, so put the safe one first.
 */
export function ConfirmDialog({ title, children, actions, onCancel }) {
  const ref = useRef(/** @type {HTMLDialogElement | null} */ (null));
  useLayoutEffect(() => {
    ref.current?.showModal();
  }, []);
  return html`
    <dialog ref=${ref} class="dialog" aria-labelledby="dialog-title"
      onCancel=${(/** @type {Event} */ e) => { e.preventDefault(); onCancel(); }}>
      <h2 id="dialog-title">${title}</h2>
      <div class="dialog__body">${children}</div>
      <div class="dialog__actions">
        ${actions.map((a, i) => html`
          <button key=${a.label} type="button" class=${`button button--${a.tone}`} autofocus=${i === 0} onClick=${a.onClick}>${a.label}</button>`)}
      </div>
    </dialog>`;
}
