// @ts-check
/** Small line icons used in more than one place. Decorative: the button around each one names it. */
import { html } from './html.js';

const svg = (/** @type {number} */ size, /** @type {number} */ stroke, /** @type {any} */ paths) => html`
  <svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=${stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

/** Points down when open, right when closed (tree rows). @param {{ open: boolean }} props */
export const Chevron = ({ open }) => svg(14, 2.4, html`<path d=${open ? 'M6 9l6 6 6-6' : 'M9 6l6 6-6 6'} />`);

/** @param {{ size?: number }} props */
export const CloseIcon = ({ size = 14 }) => svg(size, 2.2, html`<path d="M6 6l12 12M18 6L6 18" />`);

/** A folder, with a plus for "new folder". @param {{ size?: number, plus?: boolean }} props */
export const FolderIcon = ({ size = 16, plus = false }) => svg(size, 2, html`<path d="M3 7h6l2 2h10v10H3z" />${plus && html`<path d="M12 12v4M10 14h4" />`}`);
