// @ts-check
/** Badges from site/js/data/badges.js: one that explains itself, and a plain tag for inside buttons. */
import { html } from './html.js';

/** @typedef {import('../data/badges.js').Badge} BadgeData */

/** Opens its explanation in place (native details: keyboard and touch work). @param {{ badge: BadgeData }} props */
export function Badge({ badge }) {
  return html`
    <details class="badge">
      <summary class=${`tag tag--${badge.tone}`}>${badge.text}</summary>
      <p>${badge.detail}</p>
    </details>`;
}

/** Just the tag, for places that can't hold an interactive element (inside a button). @param {{ badge: BadgeData }} props */
export function BadgeTag({ badge }) {
  return html`<span class=${`tag tag--${badge.tone}`} title=${badge.detail}>${badge.text}</span>`;
}
