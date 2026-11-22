// @ts-check
/** Fetch the generated data and the overrides, and merge them into the game the app uses. */
import { applyOverrides } from './merge.js';

/** @param {string} url */
async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't load ${url} (HTTP ${res.status})`);
  return res.json();
}

/**
 * The game with `iconKeys`: keys ("items/<id>", "buildings/<id>") of the icons that exist, or null if
 * the list didn't load (then every icon is tried; the site works without icons).
 */
export async function loadGame() {
  const [data, overrides, icons] = await Promise.all([
    getJson('./data/oddsparks.json'),
    getJson('./data/overrides.json'),
    getJson('./icons/sources.json').then((s) => new Set(Object.keys(s.sha1)), () => null),
  ]);
  return { ...applyOverrides(data, overrides), iconKeys: icons };
}
