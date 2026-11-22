// @ts-check
/**
 * Polite client for the Oddsparks Wiki MediaWiki API.
 * - one request at a time, with a pause between requests
 * - `maxlag` so the wiki can tell us to back off; retries with backoff
 * - a descriptive User-Agent with no personal details
 */
import { setTimeout as sleep } from 'node:timers/promises';

/** @typedef {{ revid: number, timestamp: string, content: string }} Page latest revision of a page (timestamp kept for debugging the raw snapshot) */
/** @typedef {{ title: string, exists: boolean, redirectedFrom: string | null }} Resolved how the wiki resolves a name (redirectedFrom kept for debugging the raw snapshot) */

const API_URL = 'https://oddsparks.wiki.gg/api.php';
const USER_AGENT = 'OddsparksChainCalculator-DataExtractor/0.1 (fan-made calculator; batched, run by hand)';
const PAUSE_MS = 400;
const MAX_TRIES = 4;
const BATCH = 50; // MediaWiki's limit for titles per query

/** An error retrying won't fix (bad request, API error other than maxlag). */
class FatalError extends Error {}

/** @template T @param {T[]} list @returns {Generator<T[]>} */
function* chunks(list) {
  for (let i = 0; i < list.length; i += BATCH) yield list.slice(i, i + BATCH);
}

/**
 * @param {Record<string, string | number>} params
 * @param {{ fetchImpl?: typeof fetch, log?: (msg: string) => void }} [opts]
 * @returns {Promise<any>}
 */
export async function apiGet(params, { fetchImpl = fetch, log = () => {} } = {}) {
  const url = new URL(API_URL);
  for (const [k, v] of Object.entries({ format: 'json', formatversion: 2, maxlag: 5, ...params })) {
    url.searchParams.set(k, String(v));
  }
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    await sleep(PAUSE_MS);
    let wait = 2000 * attempt;
    try {
      const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT } });
      const retryAfter = Number(res.headers.get('retry-after'));
      if (retryAfter > 0) wait = Math.min(retryAfter, 30) * 1000;
      if (res.ok) {
        const body = await res.json();
        if (!body.error) return body;
        if (body.error.code !== 'maxlag') throw new FatalError(`API error ${body.error.code}: ${body.error.info}`);
      } else if (res.status < 500 && res.status !== 429) {
        throw new FatalError(`HTTP ${res.status} for ${url}`);
      }
    } catch (err) {
      if (err instanceof FatalError) throw err;
      // network error: retry below
    }
    if (attempt < MAX_TRIES) {
      log(`  retrying in ${wait / 1000}s…`);
      await sleep(wait);
    }
  }
  throw new Error(`Gave up after ${MAX_TRIES} tries: ${url}`);
}

/** Titles of main-namespace pages that embed a template. */
export async function listEmbeddedIn(/** @type {string} */ template, opts = {}) {
  const titles = [];
  /** @type {Record<string, string>} */
  let cont = {};
  do {
    const body = await apiGet({ action: 'query', list: 'embeddedin', eititle: template, einamespace: 0, eilimit: 500, ...cont }, opts);
    titles.push(...body.query.embeddedin.map((/** @type {{title: string}} */ p) => p.title));
    cont = body.continue ?? {};
  } while (cont.eicontinue);
  return titles.sort();
}

/**
 * Latest wikitext and revision id of pages. Missing pages are left out.
 * @returns {Promise<Record<string, Page>>}
 */
export async function fetchPages(/** @type {string[]} */ titles, opts = {}) {
  /** @type {Record<string, Page>} */
  const pages = {};
  for (const chunk of chunks(titles)) {
    const body = await apiGet({ action: 'query', prop: 'revisions', rvprop: 'content|ids|timestamp', rvslots: 'main', titles: chunk.join('|') }, opts);
    for (const p of body.query.pages) {
      if (p.missing || !p.revisions) continue;
      const rev = p.revisions[0];
      pages[p.title] = { revid: rev.revid, timestamp: rev.timestamp, content: rev.slots.main.content };
    }
  }
  return pages;
}

/**
 * Resolve names to wiki page titles the way the wiki does: case normalisation, then redirects.
 * @returns {Promise<Record<string, Resolved>>}
 */
export async function resolveTitles(/** @type {string[]} */ names, opts = {}) {
  /** @type {Record<string, Resolved>} */
  const out = {};
  for (const chunk of chunks(names)) {
    const body = await apiGet({ action: 'query', redirects: 1, titles: chunk.join('|') }, opts);
    /** @type {Map<string, string>} */
    const normalized = new Map((body.query.normalized ?? []).map((/** @type {any} */ n) => [n.from, n.to]));
    /** @type {Map<string, string>} */
    const redirects = new Map((body.query.redirects ?? []).map((/** @type {any} */ r) => [r.from, r.to]));
    const missing = new Set(body.query.pages.filter((/** @type {any} */ p) => p.missing).map((/** @type {any} */ p) => p.title));
    for (const name of chunk) {
      const norm = normalized.get(name) ?? name;
      const target = redirects.get(norm);
      const title = target ?? norm;
      out[name] = { title, exists: !missing.has(title), redirectedFrom: target ? norm : null };
    }
  }
  return out;
}
