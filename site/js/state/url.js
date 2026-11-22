// @ts-check
/**
 * Share links: a calc written into the URL fragment, so the page opens on the same chain.
 *
 *   #r=wood-workshop--wooden-blade&n=3&c=sawbench--sawn-timber:2-crafty&p=wooden-log:logger--wooden-log&s=raw-aether&v=list
 *
 * r recipe, n count, c crew per row, p recipe picked per item, s items supplied, v view. Ids are
 * slugs ([a-z0-9-]), so ':' and ',' separate them without escaping. The fragment never reaches a
 * server. Ids are resolved through renamedIds on the way in, so old links survive a rename; anything
 * that no longer exists is dropped and reported.
 */
import { fromRecipe } from './calc.js';

/** @typedef {import('./calc.js').TabCalc} TabCalc */

/** @param {Record<string, string>} map */
const pairs = (map) => Object.entries(map).map(([k, v]) => `${k}:${v}`).join(',');

/** @param {TabCalc} calc @returns {string} the fragment, with its '#' */
export function toShareHash(calc) {
  const parts = [`r=${calc.recipe}`, `n=${calc.count}`];
  if (Object.keys(calc.crews).length) parts.push(`c=${pairs(calc.crews)}`);
  if (Object.keys(calc.recipeChoice).length) parts.push(`p=${pairs(calc.recipeChoice)}`);
  if (calc.supplied.length) parts.push(`s=${calc.supplied.join(',')}`);
  if (calc.view === 'list') parts.push('v=list');
  return `#${parts.join('&')}`;
}

/**
 * @param {any} game
 * @param {string} hash location.hash
 * @param {(game: any, kind: 'recipes' | 'items' | 'crews', id: string) => string | null} resolve resolveId
 * @returns {{ calc: TabCalc | null, missing: string[] } | null} null when the fragment isn't a share link
 */
export function fromShareHash(game, hash, resolve) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const target = params.get('r');
  if (!target) return null;
  /** @type {string[]} */
  const missing = [];
  /** @param {'recipes' | 'items' | 'crews'} kind @param {string} id */
  const id = (kind, id) => {
    const found = resolve(game, kind, id);
    if (!found) missing.push(id);
    return found;
  };
  const recipe = id('recipes', target);
  if (!recipe) return { calc: null, missing };

  /** @param {string | null} text @returns {[string, string][]} */
  const split = (text) => (text ? text.split(',').map((p) => /** @type {[string, string]} */ (p.split(':'))).filter((p) => p.length === 2) : []);
  /** @type {Record<string, string>} */
  const crews = {};
  for (const [r, c] of split(params.get('c'))) {
    const rr = id('recipes', r);
    const cc = id('crews', c);
    if (rr && cc) crews[rr] = cc;
  }
  /** @type {Record<string, string>} */
  const recipeChoice = {};
  for (const [i, r] of split(params.get('p'))) {
    const ii = id('items', i);
    const rr = id('recipes', r);
    if (ii && rr) recipeChoice[ii] = rr;
  }
  const supplied = (params.get('s')?.split(',') ?? []).map((i) => id('items', i)).filter((i) => i != null);
  const count = Number(params.get('n'));

  return {
    calc: fromRecipe(game, recipe, {
      count: Number.isFinite(count) && count >= 0 ? count : 1,
      crews,
      recipeChoice,
      supplied: /** @type {string[]} */ (supplied),
      ...(params.get('v') === 'list' ? { view: /** @type {const} */ ('list') } : {}),
    }),
    missing,
  };
}

/**
 * The share link in the address bar, if any (on load, or pasted into an open page), taken out of the
 * address bar so later edits don't leave a stale link behind. What opening it means (replace the calc
 * now; a new tab from step 9) is up to the caller.
 * @param {any} game @param {Parameters<typeof fromShareHash>[2]} resolve
 */
export function takeShareLink(game, resolve) {
  const shared = fromShareHash(game, location.hash, resolve);
  if (shared) history.replaceState(null, '', location.pathname + location.search);
  return shared;
}
