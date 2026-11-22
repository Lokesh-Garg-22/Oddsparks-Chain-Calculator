// @ts-check
/**
 * Turn raw wiki pages into the calculator's dataset (site/data/oddsparks.json) and a report of
 * everything questionable. No network or file access, so it can be tested with fixtures.
 *
 * Rules (see docs/data-sources.md):
 *  - never invent values: anything no page states stays null and is listed in the recipe's `problems`
 *  - a recipe is usually written on several pages; copies are merged. Only values a page actually
 *    states are compared ("not stated" is not a disagreement). Where copies disagree, the value most
 *    pages state wins, a tie goes to the building's own page, and for fuel any "yes" wins. Every
 *    disagreement is kept in the recipe's `conflicts`
 *  - names are canonicalised the way the wiki does it (case + redirects), never guessed
 *  - recipe ids depend only on recipe content, never on page or block order (saved tabs store them)
 */
import { createHash } from 'node:crypto';
import { categoriesOf, cleanValue, findTemplates, linksOf, normalizeTitle, stripComments } from './wikitext.mjs';

/** @typedef {import('./api.mjs').Page} Page */
/** @typedef {import('./api.mjs').Resolved} Resolved */
/**
 * @typedef {object} Snapshot
 * @property {string} fetchedAt ISO time the wiki was read
 * @property {string[]} recipePageTitles pages embedding Template:Recipe
 * @property {Record<string, Page>} pages every fetched page by title (recipe pages, building pages, "Buildings")
 * @property {Record<string, Resolved>} titles raw name → wiki title
 */
/** @typedef {{ item: string, amount: number | null, odds: number | null }} Line one input or output; null = not stated */
/**
 * @typedef {object} Entry one {{Recipe}} block as written on one page (null = the page doesn't state it)
 * @property {string} page
 * @property {number} revid
 * @property {string} building wiki title
 * @property {string | null} name
 * @property {Line[]} inputs
 * @property {Line[]} outputs
 * @property {number | null} duration
 * @property {boolean | null} usesFuel
 * @property {boolean | null} randomised
 * @property {number | null} cycles
 * @property {number | 'insulated' | null} temperature
 * @property {{ quest: string, npc: string | null } | null} unlock
 */
/** @typedef {{ page: string, revid: number, value: unknown }} Statement */

const KEY_ALIASES = /** @type {Record<string, string>} */ ({
  recipe_name: 'name',
  ingredient2_: 'ingredient2',
  first_ingredient: 'ingredient', first_ingredient_amount: 'ingredient_amount',
  second_ingredient: 'ingredient2', second_ingredient_amount: 'ingredient2_amount',
  seccond_ingredient: 'ingredient2', seccond_ingredient_amount: 'ingredient2_amount',
  third_ingredient: 'ingredient3', third_ingredient_amount: 'ingredient3_amount',
});
const SLOTS = ['', '2', '3'];
const KNOWN_KEYS = new Set([
  'name', 'workstation', 'duration', 'uses_fuel', 'output_randomised', 'cycles', 'temperature', 'quest_unlock', 'quest_npc',
  ...SLOTS.flatMap((n) => [`ingredient${n}`, `ingredient${n}_amount`, `product${n}`, `product${n}_amount`, `product${n}_odds`]),
]);
/** Wiki fields we deliberately ignore: derived values the calculator computes itself. */
const IGNORED_KEYS = new Set(['per_minute']);
/** Names this close (letters changed, after slugging) on different pages are one recipe if the numbers agree. */
const MAX_NAME_VARIANT_EDITS = 3;

/** Stable ids: "Tailor's Tent" → "tailors-tent". */
export function slug(/** @type {string} */ s) {
  return s.toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const hash = (/** @type {unknown} */ v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

/** Edit distance, for spotting spelling variants of one recipe name ("Crystallization" / "Crystallisation"). */
function editDistance(/** @type {string} */ a, /** @type {string} */ b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Parse one written value. Blank → null (not stated). Unreadable → null plus a problem.
 * @param {string | undefined} raw
 * @param {'number' | 'percent' | 'flag' | 'temperature'} kind
 * @param {string} label
 * @param {string[]} problems
 * @returns {any}
 */
function parseValue(raw, kind, label, problems) {
  const v = (raw ?? '').trim();
  if (v === '') return null;
  if (kind === 'flag') {
    if (/^(yes|true|1|y)$/i.test(v)) return true;
    if (/^(no|false|0|n)$/i.test(v)) return false;
  } else if (kind === 'temperature') {
    if (/^insulated$/i.test(v)) return 'insulated';
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  } else {
    const m = v.match(/^(\d+(?:\.\d+)?)\s*(%)?$/);
    if (m) return kind === 'percent' && m[2] ? Number(m[1]) / 100 : Number(m[1]);
  }
  problems.push(`${label} "${v}" unreadable`);
  return null;
}

/**
 * Parameters of one {{Recipe}}, keys normalised and aliased, values cleaned.
 * @param {Record<string, string>} params
 */
function readParams(params) {
  /** @type {Record<string, string>} */
  const fields = {};
  const unknown = [];
  const markup = [];
  for (const [rawKey, rawValue] of Object.entries(params)) {
    const key = KEY_ALIASES[rawKey] ?? rawKey;
    if (IGNORED_KEYS.has(key)) continue;
    const value = cleanValue(rawValue);
    if (!KNOWN_KEYS.has(key)) { if (value) unknown.push(rawKey); continue; }
    if (/[{}[\]|]/.test(value)) markup.push(`${rawKey}=${value}`);
    if (value !== '' || !(key in fields)) fields[key] = value;
  }
  return { fields, unknown, markup };
}

/**
 * Every {{Recipe}} block on the recipe pages, before names are resolved.
 * @param {Snapshot['pages']} pages
 * @param {string[]} titles
 */
export function readRecipeBlocks(pages, titles) {
  return titles.filter((page) => pages[page]).flatMap((page) =>
    findTemplates(pages[page].content, 'Recipe').map((params) => ({ page, revid: pages[page].revid, ...readParams(params) })));
}

/**
 * Raw names the snapshot needs resolved, and which of them are buildings (their pages are needed too).
 * @param {Snapshot['pages']} pages
 * @param {string[]} titles
 */
export function namesToResolve(pages, titles) {
  const names = new Set();
  const workstations = new Set();
  for (const { fields } of readRecipeBlocks(pages, titles)) {
    if (fields.workstation) workstations.add(fields.workstation);
    for (const k of ['workstation', ...SLOTS.flatMap((n) => [`ingredient${n}`, `product${n}`])]) {
      if (fields[k]) names.add(fields[k]);
    }
  }
  return { names: [...names].sort(), workstations: [...workstations].sort() };
}

/**
 * Buildings page: which buildings are listed, and their group. Under "Workstations" the sub-headings
 * are building types (Refiners, Assemblers…); elsewhere sub-headings are biomes or kinds (the Shrines
 * section is split by biome), so the top-level heading is the group.
 * @param {string} content
 * @returns {Map<string, string>} title → group
 */
function buildingGroups(content) {
  /** @type {Map<string, string>} */
  const groups = new Map();
  let top = 'Other';
  let sub = '';
  for (const line of stripComments(content).split('\n')) {
    const h = line.match(/^(={2,})\s*(.*?)\s*={2,}\s*$/);
    if (h) {
      if (h[1].length === 2) { top = h[2]; sub = ''; } else sub = h[2];
      continue;
    }
    const group = top === 'Workstations' && sub ? sub : top;
    for (const title of linksOf(line)) if (!groups.has(title)) groups.set(title, group);
  }
  return groups;
}

/**
 * The image a page's infobox shows ({{Infobox building}}, {{Infobox item}}, …), as a file title.
 * @param {string | undefined} content
 * @returns {string | null} e.g. "File:Arty spark large.png"
 */
export function infoboxImage(content) {
  if (content === undefined) return null;
  const names = new Set([...stripComments(content).matchAll(/\{\{\s*(Infobox[^|}\n]*)/gi)].map((m) => m[1].trim()));
  for (const name of names) {
    for (const params of findTemplates(content, name)) {
      const image = cleanValue(params.image).replace(/^(file|image)\s*:/i, '');
      if (/\.(png|webp|jpe?g)$/i.test(image)) return `File:${normalizeTitle(image)}`;
    }
  }
  return null;
}

/** @param {string | undefined} content a building's page, if it has one */
function buildingInfo(content) {
  if (content === undefined) return { categories: [], sparkSlots: null, caption: null, image: null };
  const box = findTemplates(content, 'Infobox building')[0];
  const slots = box ? cleanValue(box.storageslots).match(/(\d+)\s*x\s*\d+\s*Spark/i) : null;
  return {
    categories: categoriesOf(content),
    sparkSlots: slots ? Number(slots[1]) : null,
    caption: box ? cleanValue(box.caption) || null : null,
    image: infoboxImage(content),
  };
}

/** @param {Line[]} lines */
const itemsKey = (lines) => lines.map((l) => l.item).sort().join('+');
const isHome = (/** @type {Entry} */ e) => e.page === e.building;
/** Sort comparator: the building's own page first. */
const homeFirst = (/** @type {Entry} */ a, /** @type {Entry} */ b) => Number(isHome(b)) - Number(isHome(a));

/**
 * Two copies are compatible when no value both of them state differs.
 * @param {Entry} a @param {Entry} b
 */
function compatible(a, b) {
  for (const f of /** @type {const} */ (['duration', 'usesFuel', 'randomised', 'cycles', 'temperature'])) {
    if (a[f] !== null && b[f] !== null && a[f] !== b[f]) return false;
  }
  for (const kind of /** @type {const} */ (['inputs', 'outputs'])) {
    for (const la of a[kind]) {
      const lb = b[kind].find((l) => l.item === la.item);
      if (la.amount != null && lb?.amount != null && la.amount !== lb.amount) return false;
      if (la.odds != null && lb?.odds != null && la.odds !== lb.odds) return false;
    }
  }
  return true;
}

/**
 * Read every block into an Entry with resolved names. Problems with individual values go to the report.
 * @param {ReturnType<typeof readRecipeBlocks>} blocks
 * @param {(name: string) => string} canon
 * @param {ReturnType<typeof emptyReport>} report
 */
function readEntries(blocks, canon, report) {
  /** @type {Entry[]} */
  const entries = [];
  for (const { page, revid, fields, unknown, markup } of blocks) {
    for (const k of unknown) (report.unknownFields[k] ??= []).includes(page) || report.unknownFields[k].push(page);
    for (const value of markup) report.leftoverMarkup.push({ page, value });
    if (!fields.workstation || !fields.product) {
      report.skipped.push({ page, message: `no ${fields.workstation ? 'product' : 'workstation'} (${fields.product || fields.workstation || 'empty block'})` });
      continue;
    }
    /** @type {string[]} */
    const problems = [];
    /** @type {Line[]} */
    const inputs = [];
    /** @type {Line[]} */
    const outputs = [];
    for (const n of SLOTS) {
      const ing = fields[`ingredient${n}`];
      if (ing) inputs.push({ item: canon(ing), amount: parseValue(fields[`ingredient${n}_amount`], 'number', `amount of ${ing}`, problems), odds: null });
      const prod = fields[`product${n}`];
      if (prod) {
        let amountRaw = fields[`product${n}_amount`];
        let oddsRaw = fields[`product${n}_odds`];
        // Some pages write amount and odds in one field: "8 (75%)".
        const both = amountRaw?.match(/^(\d+(?:\.\d+)?)\s*\((\d+(?:\.\d+)?\s*%)\)$/);
        if (both) [amountRaw, oddsRaw] = [both[1], oddsRaw || both[2]];
        outputs.push({
          item: canon(prod),
          amount: parseValue(amountRaw, 'number', `amount of ${prod}`, problems),
          odds: parseValue(oddsRaw, 'percent', `odds of ${prod}`, problems),
        });
      }
    }
    entries.push({
      page, revid,
      building: canon(fields.workstation),
      name: fields.name || null,
      inputs, outputs,
      duration: parseValue(fields.duration, 'number', 'duration', problems),
      usesFuel: parseValue(fields.uses_fuel, 'flag', 'uses_fuel', problems),
      randomised: parseValue(fields.output_randomised, 'flag', 'output_randomised', problems),
      cycles: parseValue(fields.cycles, 'number', 'cycles', problems),
      temperature: parseValue(fields.temperature, 'temperature', 'temperature', problems),
      unlock: fields.quest_unlock ? { quest: fields.quest_unlock, npc: fields.quest_npc || null } : null,
    });
    for (const message of problems) report.unreadable.push({ page, message });
  }
  return entries;
}

/**
 * Split copies that share building and items into recipes.
 *  - two blocks on one page are always two recipes (a page doesn't list a recipe twice)
 *  - named copies join the recipe with that name, or a slightly misspelled one whose numbers agree
 *  - unnamed copies join a recipe they don't contradict; if there is only one recipe they join it
 *    anyway, so a disagreement is reported as a conflict instead of inventing a second recipe
 * @param {Entry[]} group
 * @returns {{ names: Set<string>, entries: Entry[] }[]} entries home page first
 */
function clusterGroup(group) {
  /** @type {{ names: Set<string>, entries: Entry[] }[]} */
  const clusters = [];
  for (const e of group.toSorted((a, b) => Number(!a.name) - Number(!b.name) || homeFirst(a, b))) {
    const candidates = clusters.filter((c) => !c.entries.some((x) => x.page === e.page));
    const name = e.name;
    const home = name
      ? candidates.find((c) => c.names.has(name))
        ?? candidates.find((c) => compatible(c.entries[0], e) && [...c.names].some((n) => editDistance(slug(n), slug(name)) <= MAX_NAME_VARIANT_EDITS))
      : candidates.find((c) => compatible(c.entries[0], e)) ?? (clusters.length === 1 ? candidates[0] : undefined);
    if (home) { home.entries.push(e); if (name) home.names.add(name); }
    else clusters.push({ names: new Set(name ? [name] : []), entries: [e] });
  }
  return clusters.map((c) => ({ names: c.names, entries: c.entries.toSorted(homeFirst) }));
}

/**
 * Merge copies of one recipe.
 * @param {Entry[]} entries the building's own page (if present) first
 */
function merge(entries) {
  const [primary] = entries;
  /** @type {Record<string, Statement[]>} field path → what each page states, when pages disagree */
  const conflicts = {};
  /** @type {Record<string, string>} field path → page the value came from, when not the primary page */
  const valueFrom = {};

  /**
   * Most-stated value wins; a tie goes to the earliest statement (the primary page first);
   * with `anyTrue`, any `true` wins.
   * @param {string} path e.g. "duration", "inputs.wooden-log.amount"
   * @param {(e: Entry) => unknown} get
   */
  const pick = (path, get, { anyTrue = false } = {}) => {
    /** @type {Statement[]} */
    const stated = entries.flatMap((e) => { const value = get(e); return value == null ? [] : [{ page: e.page, revid: e.revid, value }]; });
    if (!stated.length) return null;
    const votes = Map.groupBy(stated, (s) => JSON.stringify(s.value));
    if (votes.size > 1) conflicts[path] = stated;
    const winner = (anyTrue && stated.find((s) => s.value === true))
      || [...votes.values()].reduce((best, g) => (g.length > best.length ? g : best))[0];
    if (winner.page !== primary.page) valueFrom[path] = winner.page;
    return winner.value;
  };

  const lines = (/** @type {'inputs' | 'outputs'} */ kind) => primary[kind].map((l) => {
    const at = (/** @type {Entry} */ e) => e[kind].find((x) => x.item === l.item);
    const item = slug(l.item);
    const amount = /** @type {number | null} */ (pick(`${kind}.${item}.amount`, (e) => at(e)?.amount));
    return kind === 'inputs' ? { item, amount } : { item, amount, odds: /** @type {number | null} */ (pick(`outputs.${item}.odds`, (e) => at(e)?.odds)) };
  });

  const temperature = pick('temperature', (e) => e.temperature);
  const merged = {
    inputs: lines('inputs'),
    outputs: lines('outputs'),
    duration: /** @type {number | null} */ (pick('duration', (e) => e.duration)),
    usesFuel: /** @type {boolean | null} */ (pick('usesFuel', (e) => e.usesFuel, { anyTrue: true })),
    randomised: /** @type {boolean | null} */ (pick('randomised', (e) => e.randomised)),
    cycles: /** @type {number | null} */ (pick('cycles', (e) => e.cycles)),
    optimalTemperature: typeof temperature === 'number' ? temperature : null,
    insulated: temperature === null ? null : temperature === 'insulated',
    unlock: primary.unlock ?? entries.find((e) => e.unlock)?.unlock ?? null,
  };

  const problems = [];
  if (merged.duration === null) problems.push('no page states a craft time');
  for (const l of [...merged.inputs, ...merged.outputs]) if (l.amount === null) problems.push(`no page states the amount of ${l.item}`);
  return { merged, conflicts, valueFrom, problems };
}

/**
 * Recipe ids from content only: "building--main-product", with just enough added to tell apart
 * recipes that share it — their inputs, then their name, then a hash of their numbers. Page order
 * never matters. Adding a recipe can lengthen the ids of the recipes it collides with; that shows up
 * as a missing id, which saved tabs and `renamedIds` handle.
 * @template {{ building: string, name: string, inputs: { item: string, amount: number | null }[], outputs: { item: string, amount: number | null }[], duration: number | null }} D
 * @param {D[]} drafts
 * @returns {Map<D, string>}
 */
export function assignIds(drafts) {
  const levels = [
    (/** @type {D} */ d) => `from-${d.inputs.map((i) => i.item).sort().join('-') || 'nothing'}`,
    (/** @type {D} */ d) => slug(d.name),
    (/** @type {D} */ d) => hash([d.inputs, d.outputs, d.duration]).slice(0, 6),
  ];
  /** @type {Map<D, string>} */
  const ids = new Map();
  /** @param {D[]} set @param {string} prefix @param {number} level */
  const place = (set, prefix, level) => {
    if (set.length === 1) return void ids.set(set[0], prefix);
    if (level === levels.length) return set.forEach((d, i) => ids.set(d, i ? `${prefix}-${i + 1}` : prefix)); // identical content
    const split = Map.groupBy(set, levels[level]);
    if (split.size === 1) return place(set, prefix, level + 1);
    for (const [key, sub] of split) place(sub, `${prefix}--${key}`, level + 1);
  };
  for (const [base, set] of Map.groupBy(drafts, (d) => `${d.building}--${d.outputs[0].item}`)) place(set, base, 0);
  return ids;
}

function emptyReport() {
  return {
    /** @type {{ page: string, message: string }[]} */ skipped: [],
    /** @type {{ page: string, message: string }[]} */ unreadable: [],
    /** @type {Record<string, string[]>} */ unknownFields: Object.create(null),
    /** @type {{ page: string, value: string }[]} */ leftoverMarkup: [],
    /** @type {{ id: string, names: string[] }[]} */ nameVariants: [],
    /** @type {{ ids: string[], numbersAgree: boolean }[]} */ possibleDuplicates: [],
    /** @type {{ building: string, name: string, ids: string[] }[]} */ sameNameDifferentItems: [],
    /** @type {{ from: string, to: string }[]} */ renames: [],
    /** @type {{ id: string, names: string[] }[]} */ slugCollisions: [],
  };
}

/**
 * @param {Snapshot} snapshot
 */
export function buildDataset(snapshot) {
  const { pages, titles, recipePageTitles } = snapshot;
  const report = emptyReport();

  // The wiki is case-sensitive after the first letter, so "Big vial" isn't the page "Big Vial".
  // A name with no page that matches an existing page ignoring case is that page.
  const existing = Object.values(titles).filter((t) => t.exists).map((t) => t.title);
  const existingSet = new Set(existing);
  const existingByLower = new Map(existing.map((t) => [t.toLowerCase(), t]));
  /** @type {Map<string, string>} */
  const caseFixes = new Map();
  const canon = (/** @type {string} */ name) => {
    const t = titles[name];
    const title = t?.title ?? normalizeTitle(name);
    if (t?.exists) return title;
    const match = existingByLower.get(title.toLowerCase());
    if (match && match !== title) { caseFixes.set(name, match); return match; }
    return title;
  };

  const entries = readEntries(readRecipeBlocks(pages, recipePageTitles), canon, report);

  // Copies of one recipe share building, input items and output items.
  const groups = Map.groupBy(entries, (e) => slug(`${e.building}|${itemsKey(e.inputs)}|${itemsKey(e.outputs)}`));
  const drafts = [...groups.values()].flatMap((group, groupIndex) => clusterGroup(group).map((cluster) => {
    const primary = cluster.entries[0];
    const sources = [...new Map(cluster.entries.map((e) => [e.page, { page: e.page, revid: e.revid }])).values()];
    return {
      name: primary.name ?? [...cluster.names][0] ?? primary.outputs[0].item,
      building: slug(primary.building),
      ...merge(cluster.entries),
      sources,
      names: cluster.names,
      sample: primary,
      groupIndex,
    };
  }));
  const ids = assignIds(drafts.map((d) => Object.assign(d, d.merged)));

  /** @type {Record<string, any>} */
  const recipes = Object.create(null);
  for (const d of drafts) {
    const id = /** @type {string} */ (ids.get(d));
    recipes[id] = {
      name: d.name,
      building: d.building,
      ...d.merged,
      sources: d.sources,
      valueFrom: d.valueFrom,
      conflicts: d.conflicts,
      problems: d.problems,
    };
    if (d.names.size > 1) report.nameVariants.push({ id, names: [...d.names] });
  }

  // Same building and items, kept apart, never on the same page: maybe one recipe written two ways.
  for (const group of Map.groupBy(drafts, (d) => d.groupIndex).values()) {
    group.forEach((a, i) => group.slice(i + 1).forEach((b) => {
      if (!b.sources.some((s) => a.sources.some((t) => t.page === s.page))) {
        report.possibleDuplicates.push({ ids: [/** @type {string} */ (ids.get(a)), /** @type {string} */ (ids.get(b))], numbersAgree: compatible(a.sample, b.sample) });
      }
    }));
  }
  // Same building and name but different items: usually a copy-paste error on one page.
  for (const sameName of Map.groupBy(Object.keys(recipes), (id) => `${recipes[id].building}|${slug(recipes[id].name)}`).values()) {
    if (new Set(sameName.map((id) => `${itemsKey(recipes[id].inputs)}|${itemsKey(recipes[id].outputs)}`)).size > 1) {
      report.sameNameDifferentItems.push({ building: recipes[sameName[0]].building, name: recipes[sameName[0]].name, ids: sameName });
    }
  }

  // Buildings and items.
  const groupOf = pages.Buildings ? buildingGroups(pages.Buildings.content) : new Map();
  /** @type {Record<string, any>} */
  const buildings = Object.create(null);
  /** @type {Record<string, any>} */
  const items = Object.create(null);
  /** @param {Record<string, any>} map @param {string} name @param {() => any} make */
  const add = (map, name, make) => {
    const id = slug(name);
    if (!map[id]) map[id] = make();
    else if (map[id].name !== name && !report.slugCollisions.some((c) => c.id === id)) report.slugCollisions.push({ id, names: [map[id].name, name] });
  };
  for (const e of entries) {
    add(buildings, e.building, () => {
      const page = pages[e.building];
      const info = buildingInfo(page?.content);
      return {
        name: e.building,
        group: groupOf.get(e.building) ?? (info.categories.includes('Workstation Shrine') ? 'Shrines' : 'Other'),
        onBuildingsPage: groupOf.has(e.building),
        ...info,
        source: page ? { page: e.building, revid: page.revid } : null,
      };
    });
    for (const { item } of [...e.inputs, ...e.outputs]) {
      add(items, item, () => ({ name: item, wikiPage: existingSet.has(item) ? item : null, image: infoboxImage(pages[item]?.content) }));
    }
  }
  for (const [from, r] of Object.entries(titles)) {
    const to = caseFixes.get(from) ?? r.title;
    if (to !== from) report.renames.push({ from, to });
  }

  const sortKeys = (/** @type {Record<string, any>} */ o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
  const content = { buildings: sortKeys(buildings), items: sortKeys(items), recipes: sortKeys(recipes) };
  const all = Object.values(recipes);
  const produced = new Set(all.flatMap((r) => r.outputs.map((/** @type {{ item: string }} */ o) => o.item)));

  const data = {
    meta: {
      // Changes whenever the content changes; the same content gives the same version.
      dataVersion: `wiki-${snapshot.fetchedAt.slice(0, 10)}-${hash(content).slice(0, 8)}`,
      extractedAt: snapshot.fetchedAt,
      source: 'https://oddsparks.wiki.gg',
      license: 'CC BY-SA 4.0. Derived from the Oddsparks Wiki; see data/LICENSE-DATA.md',
      generator: 'tools/extract-wiki.mjs (do not edit by hand; fixes go in overrides.json)',
      counts: {
        recipes: all.length,
        buildings: Object.keys(buildings).length,
        items: Object.keys(items).length,
        recipesWithConflicts: all.filter((r) => Object.keys(r.conflicts).length).length,
        recipesWithProblems: all.filter((r) => r.problems.length).length,
        recipesFromOnePage: all.filter((r) => r.sources.length === 1).length,
      },
    },
    ...content,
  };

  return {
    data,
    report: {
      ...report,
      blocks: entries.length,
      recipePages: recipePageTitles.length,
      neverProduced: Object.keys(items).filter((id) => !produced.has(id)).sort(),
      missingPages: Object.values(items).filter((i) => !i.wikiPage).map((i) => i.name).sort(),
      notOnBuildingsPage: Object.values(buildings).filter((b) => !b.onBuildingsPage).map((b) => b.name).sort(),
    },
  };
}
