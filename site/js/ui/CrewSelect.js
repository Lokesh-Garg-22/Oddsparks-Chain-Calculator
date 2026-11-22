// @ts-check
/** The spark crew on a recipe row, the same everywhere it appears. */
import { html } from './html.js';
import { useApp } from './context.js';
import { crewOption, recipeName } from './format.js';
import { setCrew } from '../state/calc.js';

/**
 * @param {{ recipe: string, value: string, update: import('../state/calc.js').Update, compact?: boolean }} props
 */
export function CrewSelect({ recipe, value, update, compact = false }) {
  const { game } = useApp();
  return html`
    <select class=${`input${compact ? ' input--compact' : ''}`} aria-label=${`Spark crew for ${recipeName(game, recipe)}`} value=${value}
      onChange=${(/** @type {any} */ e) => update((c) => setCrew(c, recipe, e.currentTarget.value))}>
      ${game.crewOrder.map((/** @type {string} */ id) => html`<option key=${id} value=${id}>${crewOption(game, id)}</option>`)}
    </select>`;
}
