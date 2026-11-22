// @ts-check
/** One line of a list of item flows: icon, "<rate> Item /min", and a note under it. */
import { html } from './html.js';
import { Icon } from './Icon.js';
import { useApp } from './context.js';
import { itemName } from './format.js';

/** @param {{ item: string, perMinute: number, note?: string }} props */
export function ItemRate({ item, perMinute, note }) {
  const { game, fmt } = useApp();
  return html`
    <li>
      <${Icon} kind="items" id=${item} name=${itemName(game, item)} size=${22} />
      <span><strong>${fmt.rate(perMinute)}</strong> ${itemName(game, item)} ${fmt.perShort}${note && html`<br /><span class="small muted">${note}</span>`}</span>
    </li>`;
}
