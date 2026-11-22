// @ts-check
/** A name edited in place. */
import { useLayoutEffect, useRef } from 'preact/hooks';
import { html } from './html.js';

/** Inline rename: Enter or leaving the field keeps it, Escape cancels (null). Used by the tab bar and the library. */
export function RenameField(/** @type {{ initial: string, label: string, className: string, onDone: (name: string | null) => void }} */ { initial, label, className, onDone }) {
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
    <input ref=${input} class=${`input ${className}`} aria-label=${label} value=${initial} maxlength="60"
      onKeyDown=${(/** @type {KeyboardEvent} */ e) => {
        if (e.key === 'Enter') finish(/** @type {HTMLInputElement} */ (e.currentTarget).value);
        else if (e.key === 'Escape') finish(null);
      }}
      onBlur=${(/** @type {FocusEvent} */ e) => finish(/** @type {HTMLInputElement} */ (e.currentTarget).value)} />`;
}
