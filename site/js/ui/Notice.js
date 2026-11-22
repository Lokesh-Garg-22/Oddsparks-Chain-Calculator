// @ts-check
/** A message on the page, with Dismiss when it can be dismissed (tabs, exports, the library). */
import { html } from './html.js';

/**
 * @param {{ tone?: 'ok' | 'warn', onDismiss?: () => void, className?: string, children: any }} props
 * tone ok: something worked; warn (default): something to know or fix
 */
export function Notice({ tone = 'warn', onDismiss, className = '', children }) {
  return html`
    <div class=${`notice banner${tone === 'ok' ? ' notice--ok' : ''}${className ? ` ${className}` : ''}`} role="status">
      <p>${children}</p>
      ${onDismiss && html`<button type="button" class="button button--quiet" onClick=${onDismiss}>Dismiss</button>`}
    </div>`;
}
