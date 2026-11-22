// @ts-check
/**
 * A button that opens a small panel below it. Uses the browser's popover (Baseline 2024): Escape and
 * a click outside close it, and focus handling comes for free. The panel is placed under the button's
 * right edge just before it opens.
 */
import { useRef } from 'preact/hooks';
import { html } from './html.js';

/**
 * @param {{ id: string, label: any, buttonClass?: string, buttonLabel?: string, panelLabel: string, children: any }} props
 * buttonLabel: accessible name when the visible label isn't enough; panelLabel names the panel
 */
export function Menu({ id, label, buttonClass = 'button button--quiet', buttonLabel, panelLabel, children }) {
  const button = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const place = (/** @type {any} */ e) => {
    if (e.newState !== 'open' || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const panel = /** @type {HTMLElement} */ (e.currentTarget);
    // Below the button, unless there's clearly more room above; either way it fits on screen (and scrolls inside).
    const below = innerHeight - r.bottom - 14;
    const above = r.top - 14;
    const down = below >= 240 || below >= above;
    panel.style.top = down ? `${Math.round(r.bottom + 6)}px` : 'auto';
    panel.style.bottom = down ? 'auto' : `${Math.round(innerHeight - r.top + 6)}px`;
    panel.style.maxHeight = `${Math.round(down ? below : above)}px`;
    panel.style.right = `${Math.max(8, Math.round(document.documentElement.clientWidth - r.right))}px`;
  };
  return html`
    <button ref=${button} type="button" class=${buttonClass} popovertarget=${id} aria-label=${buttonLabel}>${label}</button>
    <div id=${id} popover="auto" class="menu" role="dialog" aria-label=${panelLabel} onBeforeToggle=${place}>${children}</div>`;
}

/**
 * A row of mutually exclusive choices: radio buttons, drawn like the Chain tree / Build list switch.
 * @template {string | number} T
 * @param {{ legend: string, name: string, options: { value: T, label: string, hint?: string }[], value: T, onChange: (v: T) => void }} props
 */
export function Choice({ legend, name, options, value, onChange }) {
  return html`
    <fieldset class="choice">
      <legend class="field__label">${legend}</legend>
      <div class="switch">
        ${options.map((o) => html`
          <label key=${o.value} class="switch__option">
            <input type="radio" name=${name} checked=${o.value === value} onChange=${() => onChange(o.value)} />
            <span>${o.label}${o.hint && html` <span class="muted">${o.hint}</span>`}</span>
          </label>`)}
      </div>
    </fieldset>`;
}

/** An action in a menu: closes the menu, then acts. @param {{ onClick: () => void, danger?: boolean, children: any }} props */
export function MenuItem({ onClick, danger = false, children }) {
  return html`
    <button type="button" class=${`menu__item${danger ? ' menu__item--danger' : ''}`}
      onClick=${(/** @type {MouseEvent} */ e) => {
        /** @type {any} */ (e.currentTarget).closest('[popover]')?.hidePopover();
        onClick();
      }}>${children}</button>`;
}
