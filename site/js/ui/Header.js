// @ts-check
/** The top bar: title, Copy share link (once there's a chain), and the display settings. */
import { useState } from 'preact/hooks';
import { html } from './html.js';
import { Menu, Choice } from './Menu.js';
import { useApp } from './context.js';
import { crewOption } from './format.js';
import { toShareHash } from '../state/url.js';

/** @typedef {import('../state/prefs.js').Prefs} Prefs */

/** @param {{ prefsStored: boolean }} props prefsStored: false when the browser blocks storage */
function Settings({ prefsStored }) {
  const { game, prefs, setPrefs } = useApp();
  /** @template {keyof Prefs} K @param {K} key @returns {(v: Prefs[K]) => void} */
  const set = (key) => (v) => setPrefs((p) => ({ ...p, [key]: v }));
  return html`
    <div class="settings">
      <h2 class="settings__title">Display settings</h2>
      <${Choice} legend="Rate unit" name="unit" value=${prefs.unit} onChange=${set('unit')}
        options=${[{ value: 'min', label: 'per minute' }, { value: 'sec', label: 'per second' }]} />
      <${Choice} legend="Decimals" name="decimals" value=${prefs.decimals} onChange=${set('decimals')}
        options=${[{ value: 2, label: '2', hint: '(11.25)' }, { value: 1, label: '1, like the game', hint: '(11.2)' }]} />
      <label class="field">
        <span class="field__label">Default spark crew, for rows you haven't changed</span>
        <select class="input" value=${prefs.defaultCrew} onChange=${(/** @type {any} */ e) => set('defaultCrew')(e.currentTarget.value)}>
          ${game.crewOrder.map((/** @type {string} */ id) => html`<option key=${id} value=${id}>${crewOption(game, id)}</option>`)}
        </select>
      </label>
      <${Choice} legend="Theme" name="theme" value=${prefs.theme} onChange=${set('theme')}
        options=${[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
      <p class="small muted">${prefsStored ? 'Remembered in this browser.' : 'This browser blocks saving, so these reset when you close the page.'}</p>
    </div>`;
}

/** Copies a link that opens this exact chain. @param {{ calc: import('../state/calc.js').TabCalc }} props */
function ShareButton({ calc }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = `${location.origin}${location.pathname}${toShareHash(calc)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (no permission, or not a secure page): show the link to copy by hand.
      window.prompt('Copy this link:', url);
    }
  };
  return html`
    <button type="button" class="button button--chrome" onClick=${copy}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
      <span aria-live="polite">${copied ? 'Link copied' : 'Copy share link'}</span>
    </button>`;
}

/** @param {{ calc: import('../state/calc.js').TabCalc, prefsStored: boolean, children?: any }} props children: the tab bar */
export function Header({ calc, prefsStored, children }) {
  return html`
    <header class="site-header">
      <div class="container site-header__inner">
        <svg class="spark-mark" width="26" height="26" stroke-width="2" aria-hidden="true"><use href="#spark" /></svg>
        <h1 class="site-header__title">Oddsparks Chain Calculator</h1>
        <div class="site-header__tools">
          ${calc.recipe && html`<${ShareButton} calc=${calc} />`}
          <${Menu} id="settings-menu" buttonClass="button button--chrome" panelLabel="Display settings"
            label=${html`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg><span>Settings</span>`}>
            <${Settings} prefsStored=${prefsStored} />
          <//>
        </div>
      </div>
      <div class="container">${children}</div>
    </header>`;
}
