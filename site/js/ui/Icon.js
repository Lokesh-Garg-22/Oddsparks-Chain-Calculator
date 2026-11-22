// @ts-check
/** An item or building icon from site/icons, or initials when there is none. */
import { html } from './html.js';
import { initials } from './format.js';
import { useApp } from './context.js';

/**
 * @param {{ kind: 'items' | 'buildings', id: string, name: string, size?: number }} props
 */
export function Icon({ kind, id, name, size = 28 }) {
  const { game } = useApp();
  const style = `width:${size}px;height:${size}px`;
  if (game.iconKeys && !game.iconKeys.has(`${kind}/${id}`)) {
    return html`<span class="icon icon--fallback" style=${style} aria-hidden="true">${initials(name)}</span>`;
  }
  return html`<img class="icon" style=${style} src=${`./icons/${kind}/${id}.png`} alt="" loading="lazy" decoding="async" />`;
}
