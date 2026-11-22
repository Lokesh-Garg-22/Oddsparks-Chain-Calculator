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
import { cleanCalc } from './calc.js';

/** @typedef {import('./calc.js').TabCalc} TabCalc */

/** @param {Record<string, string>} map */
const joinPairs = (map) => Object.entries(map).map(([k, v]) => `${k}:${v}`).join(',');

/** @param {TabCalc} calc @returns {string} the fragment, with its '#' */
export function toShareHash(calc) {
  const parts = [`r=${calc.recipe}`, `n=${calc.count}`];
  if (Object.keys(calc.crews).length) parts.push(`c=${joinPairs(calc.crews)}`);
  if (Object.keys(calc.recipeChoice).length) parts.push(`p=${joinPairs(calc.recipeChoice)}`);
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
  if (!params.get('r')) return null;
  /** @param {string | null} text @returns {Record<string, string>} */
  const pairs = (text) => Object.fromEntries((text ? text.split(',') : []).map((p) => p.split(':')).filter((p) => p.length === 2));
  return cleanCalc(game, {
    recipe: params.get('r'),
    count: params.has('n') ? Number(params.get('n')) : 1,
    crews: pairs(params.get('c')),
    recipeChoice: pairs(params.get('p')),
    supplied: params.get('s')?.split(',') ?? [],
    view: params.get('v'),
  }, resolve);
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
