// @ts-check
/**
 * The warnings vocabulary: which facts about a recipe, its crew and its place in a chain deserve a
 * badge, and how each is explained. One place, read by the recipe cards, the chain rows, the warnings
 * panel and the Excel Summary.
 */
import { getPath, openIssues } from './merge.js';
import { crewName, describePath, itemName, percent } from './names.js';

/** How the UI names why a chain stops at an item. */
export const STOP_LABELS = /** @type {const} */ ({
  supplied: 'you supply it',
  raw: 'raw resource',
  'no-recipe': 'nothing makes it',
  loop: 'needed inside its own chain',
});

/**
 * Every badge type, once. `warning`: the numbers may be off or something isn't counted, so it belongs
 * in warning lists (cards, warnings panel, Excel Summary); the others are context.
 */
export const BADGE_KINDS = /** @type {const} */ ({
  fuel: { tone: 'info', text: 'needs fuel', warning: true },
  random: { tone: 'warn', text: 'random output', warning: true },
  cycles: { tone: 'warn', text: 'crafts per batch', warning: true },
  conflict: { tone: 'warn', text: 'sources disagree', warning: true },
  missing: { tone: 'warn', text: 'value missing', warning: true },
  loop: { tone: 'warn', text: 'loop', warning: true },
  'unknown-crew': { tone: 'warn', text: 'unknown crew', warning: true },
  'crew-unverified': { tone: 'warn', text: 'crew speed unconfirmed', warning: true },
  'single-page': { tone: 'info', text: 'one source', warning: false },
  corrected: { tone: 'ok', text: 'corrected', warning: false },
  confirmed: { tone: 'ok', text: 'checked in-game', warning: false },
});

/** @typedef {keyof typeof BADGE_KINDS} BadgeCode */
/**
 * @typedef {object} Badge
 * @property {BadgeCode} code
 * @property {'warn' | 'info' | 'ok'} tone
 * @property {string} text a few words, shown on the badge
 * @property {string} detail why, in a sentence or two, naming the sources
 * @property {boolean} warning belongs in warning lists
 */

/** @param {BadgeCode} code @param {string} detail @param {string} [text] @returns {Badge} */
const badge = (code, detail, text) => ({ code, ...BADGE_KINDS[code], ...(text ? { text } : {}), detail });

/** A value as people read it: odds as a percentage, craft times in seconds. @param {string} path @param {unknown} v */
export const showValue = (path, v) => (path.endsWith('.odds') && typeof v === 'number' ? percent(v) : path === 'duration' ? `${v} s` : String(v));

/**
 * Badges for a recipe (and the crew on it, when there is one).
 * @param {any} game from applyOverrides
 * @param {string} recipeId
 * @param {string} [crewId]
 * @returns {Badge[]}
 */
export function recipeBadges(game, recipeId, crewId) {
  const r = game.recipes[recipeId];
  /** @type {Badge[]} */
  const out = [];
  if (r.usesFuel) out.push(badge('fuel', 'The wiki marks this recipe as needing fuel. Fuel and the buildings that make it are not counted yet.'));
  if (r.randomised) {
    const odds = r.outputs.filter((/** @type {any} */ o) => o.odds != null).map((/** @type {any} */ o) => `${itemName(game, o.item)} ${percent(o.odds)}`);
    out.push(badge('random', odds.length
      ? `Each craft gives one of its outputs at random (${odds.join(', ')}). Rates use the average.`
      : 'Each craft gives a random output. The wiki gives no chances, so the listed amounts are treated as averages (not confirmed).'));
  }
  if (r.cycles) out.push(badge('cycles', `Assumed: one batch of inputs lasts ${r.cycles} crafts. Not confirmed in-game yet.`, `${r.cycles} crafts per batch`));
  for (const { kind, path } of openIssues(r)) {
    if (kind === 'conflict' && path) {
      const said = r.conflicts[path].map((/** @type {{ page: string, value: unknown }} */ s) => `${s.page} page says ${showValue(path, s.value)}`).join(', ');
      out.push(badge('conflict', `Wiki pages disagree on the ${describePath(game, path)}: ${said}. Using ${showValue(path, getPath(r, path).value)}, the value most pages give.`));
    } else if (kind === 'missing' && path) {
      out.push(badge('missing', `No wiki page states the ${describePath(game, path)}, so this row can't be fully calculated.`));
    } else if (kind === 'single-page') {
      out.push(badge('single-page', `Only the ${r.sources[0].page} wiki page lists this recipe, so it couldn't be cross-checked.`));
    }
  }
  const crew = crewId ? game.crews[crewId] : null;
  if (crew?.status === 'unverified') out.push(badge('crew-unverified', `The ×${crew.multiplier} for ${crew.label} comes from the wiki's recipe template and hasn't been confirmed in-game.`));
  /** @type {Record<string, { was: unknown, value: unknown, reason: string, source: string }>} */
  const corrected = r.corrected;
  for (const [path, { was, value, reason, source }] of Object.entries(corrected)) {
    out.push(badge('corrected', `The ${describePath(game, path)} was corrected from ${showValue(path, was)} to ${showValue(path, value)}: ${reason} (${source}).`));
  }
  // Fields confirmed by the same reading are listed together, each with its own source.
  const bySource = Map.groupBy(Object.keys(r.confirmed), (p) => r.confirmed[p]);
  if (bySource.size) {
    const parts = [...bySource].map(([source, paths]) => `${paths.map((p) => describePath(game, p)).join(', ')} (${source})`);
    out.push(badge('confirmed', `Confirmed in-game: ${parts.join('; ')}.`));
  }
  return out;
}

/**
 * Badges for every row of a calculation: the recipe's own, plus what only the chain knows (an input
 * cut as a loop, an unknown crew, a value the engine couldn't compute).
 * @param {any} game
 * @param {ReturnType<typeof import('../engine/calc.js').calculate>} result
 * @returns {Record<string, Badge[]>} recipe id → badges
 */
export function rowBadges(game, result) {
  /** @type {Record<string, Badge[]>} */
  const byRow = {};
  for (const row of Object.values(result.rows)) {
    const list = recipeBadges(game, row.recipe, row.crew);
    for (const input of row.inputs) {
      if (input.stop === 'loop') list.push(badge('loop', `${itemName(game, input.item)} is needed inside its own chain, so it's counted as supplied from outside. Choose another recipe for it to avoid the loop.`, `loop: ${itemName(game, input.item)}`));
    }
    byRow[row.recipe] = list;
  }
  for (const w of result.warnings) {
    if (w.code === 'unknown-crew') byRow[w.recipe]?.push(badge('unknown-crew', `The crew "${crewName(game, w.crew)}" isn't in the crew table, so machines can't be worked out.`));
    else if (!byRow[w.recipe]?.some((b) => b.code === 'missing')) byRow[w.recipe]?.push(badge('missing', 'A craft time or amount is missing, so this row can\'t be fully calculated.'));
  }
  return byRow;
}

/**
 * The warnings list for a chain (warnings panel, Excel Summary): every warning badge, with its row.
 * @param {Record<string, Badge[]>} badges from rowBadges
 * @returns {{ recipe: string, badge: Badge }[]}
 */
export const chainWarnings = (badges) =>
  Object.entries(badges).flatMap(([recipe, list]) => list.filter((b) => b.warning).map((badge) => ({ recipe, badge })));
