// @ts-check
/** The recipes a building can run, as selectable cards, earliest unlock first. */
import { html } from './html.js';
import { useApp } from './context.js';
import { lineList } from './format.js';
import { recipeTags } from '../data/merge.js';

/**
 * @param {{ building: string, selected: string, onSelect: (recipe: string) => void }} props
 */
export function RecipeCards({ building, selected, onSelect }) {
  const { game, fmt } = useApp();
  return html`
    <fieldset class="recipes">
      <legend class="field__label">Recipe</legend>
      ${game.buildings[building].recipes.map((/** @type {string} */ id) => {
        const r = game.recipes[id];
        const isSelected = id === selected;
        const tags = recipeTags(r);
        return html`
          <button key=${id} type="button" class=${`recipe${isSelected ? ' is-selected' : ''}`} aria-pressed=${isSelected} onClick=${() => onSelect(id)}>
            <span class="recipe__name">${r.name}</span>
            <span class="recipe__io">${r.inputs.length ? lineList(game, r.inputs) : 'Harvested'} → ${lineList(game, r.outputs)}</span>
            ${isSelected && html`<span class="small muted">${fmt.seconds(r.duration)} per craft${r.unlock ? `, unlocked by ${r.unlock.quest}` : ''}</span>`}
            ${tags.length > 0 && html`<span class="recipe__tags">${tags.map((t) => html`<span class="tag" key=${t.code}>${t.text}</span>`)}</span>`}
          </button>`;
      })}
    </fieldset>`;
}
