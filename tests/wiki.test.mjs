// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanValue, findTemplates, linksOf, categoriesOf } from '../tools/wiki/wikitext.mjs';
import { buildDataset, slug } from '../tools/wiki/build.mjs';
import { esc, renderReport } from '../tools/wiki/report.mjs';

/** @typedef {import('../tools/wiki/build.mjs').Snapshot} Snapshot */

// ---------- wikitext ----------

test('findTemplates handles nesting, links with pipes, comments and both parameter styles', () => {
  const text = `intro {{Recipe
|product=Sawn Timber
| product amount = 1
|workstation=[[Sawbench|the bench]]
|quest_npc = {{IconNPC|Woodsman}}
|duration=16<!-- seconds -->
}} {{Other|x=1}} {{recipe|product=B}}`;
  const found = findTemplates(text, 'Recipe');
  assert.equal(found.length, 2, 'name match ignores first-letter case');
  const p = found[0];
  assert.equal(p.product_amount.trim(), '1', '"product amount" normalises to product_amount');
  assert.equal(cleanValue(p.workstation), 'Sawbench', 'link target, not label');
  assert.equal(cleanValue(p.quest_npc), 'Woodsman');
  assert.equal(cleanValue(p.duration), '16');
});

test('cleanValue tolerates an extra brace around icon templates', () => {
  assert.equal(cleanValue('{{{IconNPC|Divine Researcher}}}'), 'Divine Researcher');
});

test('links and categories', () => {
  const text = '[[Sawbench]] [[File:X.png|20px]] [[Category: Refiner]] [[logger|Logger]]';
  assert.deepEqual(linksOf(text), ['Sawbench', 'Logger']);
  assert.deepEqual(categoriesOf(text), ['Refiner']);
});

test('slug gives stable ids', () => {
  assert.equal(slug("Tailor's Tent"), 'tailors-tent');
  assert.equal(slug('Big Vial'), 'big-vial');
});

// ---------- build ----------

/**
 * Tiny snapshot: each page is a list of {{Recipe}} parameter objects.
 * @param {Record<string, Record<string, string | number>[]>} recipePages
 * @param {{ buildingsPage?: string }} [opts]
 * @returns {Snapshot}
 */
function snapshot(recipePages, opts = {}) {
  /** @type {Snapshot['pages']} */
  const pages = {};
  let revid = 100;
  for (const [title, blocks] of Object.entries(recipePages)) {
    const content = blocks.map((b) => `{{Recipe\n${Object.entries(b).map(([k, v]) => `|${k}=${v}`).join('\n')}\n}}`).join('\n');
    pages[title] = { revid: revid++, timestamp: '2026-11-22T00:00:00Z', content };
  }
  if (opts.buildingsPage) pages.Buildings = { revid: 1, timestamp: '', content: opts.buildingsPage };
  /** @type {Snapshot['titles']} */
  const titles = {};
  for (const blocks of Object.values(recipePages)) {
    for (const b of blocks) {
      for (const k of ['workstation', 'ingredient', 'ingredient2', 'product', 'product2']) {
        const v = b[k];
        if (typeof v === 'string') titles[v] = { title: v, exists: v in recipePages, redirectedFrom: null };
      }
    }
  }
  return { fetchedAt: '2026-11-22T00:00:00Z', recipePageTitles: Object.keys(recipePages), pages, titles };
}

const SAWN = { workstation: 'Sawbench', product: 'Sawn Timber', product_amount: 1, ingredient: 'Wooden Log', ingredient_amount: 2, duration: 16, temperature: -3 };

test('copies on different pages merge; a blank field is not a disagreement', () => {
  const { data } = buildDataset(snapshot({
    Sawbench: [SAWN],
    'Sawn Timber': [{ ...SAWN, temperature: '' }],
  }));
  const r = data.recipes['sawbench--sawn-timber'];
  assert.equal(r.duration, 16);
  assert.deepEqual(r.inputs, [{ item: 'wooden-log', amount: 2 }]);
  assert.equal(r.optimalTemperature, -3);
  assert.equal(r.insulated, false);
  assert.deepEqual(r.sources, [{ page: 'Sawbench', revid: 100 }, { page: 'Sawn Timber', revid: 101 }], "the building's own page first, with revisions");
  assert.deepEqual(r.conflicts, {});
  assert.deepEqual(r.problems, {});
  assert.deepEqual(r.valueFrom, {});
});

test('on disagreement the majority wins, ties go to the building page, and both are recorded', () => {
  const LOOM = { workstation: 'Loom', product: 'Sponge', product_amount: 1, ingredient: 'Tree Bark', ingredient_amount: 4 };
  const SAP = { workstation: 'Furnace', product: 'Copper Ingot', product_amount: 1, ingredient: 'Copper Sap', ingredient_amount: 1 };
  const { data } = buildDataset(snapshot({
    Loom: [{ ...LOOM, duration: 824 }],
    Sponge: [{ ...LOOM, duration: 24 }],
    'Tree Bark': [{ ...LOOM, duration: 24 }],
    Furnace: [{ ...SAP, duration: 24 }],
    'Copper Ingot': [{ ...SAP, duration: 64 }],
  }));
  const sponge = data.recipes['loom--sponge'];
  assert.equal(sponge.duration, 24, 'a typo on one page loses the vote');
  assert.equal(sponge.valueFrom.duration, 'Sponge', 'the value records where it came from');
  assert.deepEqual(sponge.conflicts.duration.map((/** @type {any} */ s) => s.value), [824, 24, 24]);
  assert.equal(data.recipes['furnace--copper-ingot'].duration, 24, 'tie: building page wins');
});

test('fuel: any page saying yes wins; flags nobody states stay null', () => {
  const ORE = { workstation: 'Furnace', product: 'Copper Ingot', product_amount: 1, ingredient: 'Copper Ore', ingredient_amount: 3, duration: 64 };
  const { data } = buildDataset(snapshot({ Furnace: [ORE], 'Copper Ingot': [{ ...ORE, uses_fuel: 'yes' }] }));
  const r = data.recipes['furnace--copper-ingot'];
  assert.equal(r.usesFuel, true);
  assert.equal(r.valueFrom.usesFuel, 'Copper Ingot');
  assert.equal(r.randomised, null, '"not stated" is not "no"');
});

test('two blocks on one page are two recipes, even with the same name', () => {
  const base = { workstation: 'Ancient Printer', name: 'Printing', product: 'Subsurface Aether', ingredient: 'Cleansing Fragment', duration: 2 };
  const { data } = buildDataset(snapshot({
    'Ancient Printer': [{ ...base, ingredient_amount: 0.6, product_amount: 1 }, { ...base, ingredient_amount: 1.9, product_amount: 2 }],
  }));
  assert.equal(Object.keys(data.recipes).length, 2);
});

test('names spelled slightly differently merge when numbers agree; overclocked variants stay apart', () => {
  const X = { workstation: 'Alchemy Lab', product: 'Aether Crystal', product_amount: 3, ingredient: 'Aether Seed', ingredient_amount: 1, duration: 64 };
  const LOG = { workstation: 'Logger', product: 'Wooden Log', product_amount: 1, duration: 2 };
  const { data, report } = buildDataset(snapshot({
    'Alchemy Lab': [{ ...X, name: 'Aether Seed Crystallization' }],
    'Aether Seed': [{ ...X, name: 'Aether Seed Crystallisation' }],
    Logger: [{ ...LOG, name: 'Log Harvesting', temperature: 'Insulated' }, { ...LOG, name: 'Overclocked Log Harvesting', temperature: -3 }],
  }));
  assert.ok(data.recipes['alchemy-lab--aether-crystal']);
  assert.equal(report.nameVariants.length, 1);
  const normal = data.recipes['logger--wooden-log--log-harvesting'];
  assert.ok(data.recipes['logger--wooden-log--overclocked-log-harvesting']);
  assert.equal(normal.insulated, true);
  assert.equal(normal.optimalTemperature, null);
  assert.deepEqual(normal.inputs, [], 'harvesters have no inputs');
});

test('recipe ids depend on content only, not on page or block order', () => {
  const ORE = { workstation: 'Furnace', product: 'Copper Ingot', product_amount: 1, ingredient_amount: 3, duration: 64 };
  const P = { workstation: 'Ancient Printer', name: 'Printing', product: 'Subsurface Aether', ingredient: 'Cleansing Fragment', duration: 2 };
  const pagesA = {
    Furnace: [{ ...ORE, ingredient: 'Copper Ore' }, { ...ORE, ingredient: 'Copper Seed' }],
    'Ancient Printer': [{ ...P, ingredient_amount: 0.6, product_amount: 1 }, { ...P, ingredient_amount: 1.9, product_amount: 2 }],
  };
  const pagesB = {
    'Ancient Printer': [...pagesA['Ancient Printer']].reverse(),
    Furnace: [...pagesA.Furnace].reverse(),
  };
  const byContent = (/** @type {Snapshot} */ s) => Object.fromEntries(Object.entries(buildDataset(s).data.recipes)
    .map(([id, r]) => [JSON.stringify([r.inputs, r.outputs]), id]));
  assert.deepEqual(byContent(snapshot(pagesB)), byContent(snapshot(pagesA)));
  assert.ok(buildDataset(snapshot(pagesA)).data.recipes['furnace--copper-ingot--from-copper-ore']);
});

test('amount and odds written together are read; odds become fractions', () => {
  const C = { workstation: 'Aetheric Collider', product: 'Grey Aether', product2: 'Cleansing Fragment', ingredient: 'Corrupted Aether', ingredient_amount: 1, duration: 64 };
  const { data } = buildDataset(snapshot({
    'Aetheric Collider': [{ ...C, product_amount: 1, product_odds: '75%', product2_amount: 1, product2_odds: '25%' }],
    'Grey Aether': [{ ...C, product_amount: '1 (75%)', product2_amount: '1 (25%)' }],
  }));
  const r = data.recipes['aetheric-collider--grey-aether'];
  assert.deepEqual(r.conflicts, {});
  assert.deepEqual(r.outputs, [{ item: 'grey-aether', amount: 1, odds: 0.75 }, { item: 'cleansing-fragment', amount: 1, odds: 0.25 }]);
});

test('a value no page states is null and listed in problems, never guessed', () => {
  const { data, report } = buildDataset(snapshot({ Loom: [{ workstation: 'Loom', product: 'Rope', product_amount: 1, ingredient: 'Leaves', ingredient_amount: 4, cycles: 'lots' }] }));
  const r = data.recipes['loom--rope'];
  assert.equal(r.duration, null);
  assert.deepEqual(r.problems, { duration: 'no page states a craft time' });
  assert.deepEqual(report.unreadable, [{ page: 'Loom', message: 'cycles "lots" unreadable' }], 'unreadable values are reported');
});

test('a lowercase spelling of an existing page is treated as that page and reported', () => {
  const V = { workstation: 'Furnace', product_amount: 2, ingredient: 'Quartz', ingredient_amount: 10, duration: 128 };
  const { data, report } = buildDataset(snapshot({ Furnace: [{ ...V, product: 'Big vial' }], 'Big Vial': [{ ...V, product: 'Big Vial' }] }));
  assert.deepEqual(Object.keys(data.recipes), ['furnace--big-vial']);
  assert.deepEqual(report.renames, [{ from: 'Big vial', to: 'Big Vial' }]);
});

test('same building and name with different items is flagged for review', () => {
  const S = { workstation: 'Stonecutter', name: 'Stone Block Cutting', product: 'Stone Spike', product_amount: 1, ingredient_amount: 1, duration: 16 };
  const { report } = buildDataset(snapshot({ Stonecutter: [{ ...S, ingredient: 'Frozen Stone' }], 'Stone Block': [{ ...S, ingredient: 'Stone Block' }] }));
  assert.equal(report.sameNameDifferentItems.length, 1);
});

test('buildings get their group from the Buildings page; shrines by section, not biome', () => {
  const { data } = buildDataset(snapshot(
    {
      Sawbench: [SAWN],
      'Crafty Spark Shrine': [{ workstation: 'Crafty Spark Shrine', product: 'Crafty Spark', product_amount: 1, duration: 48 }],
      'Tailors Tent': [{ workstation: 'Tailors Tent', product: 'Top Hat', product_amount: 1, duration: 8 }],
    },
    { buildingsPage: '==Workstations==\n===Refiners===\n[[Sawbench]]\n==Shrines==\n===Woodland===\n[[Crafty Spark Shrine]]\n' },
  ));
  assert.equal(data.buildings.sawbench.group, 'Refiners');
  assert.equal(data.buildings['crafty-spark-shrine'].group, 'Shrines');
  assert.equal(data.buildings['tailors-tent'].onBuildingsPage, false);
});

test('wiki text in the report is escaped so an editor cannot inject links or HTML', () => {
  assert.equal(esc('[click](http://x) <img> `x`'), '\\[click\\]\\(http://x\\) \\<img\\> \\`x\\`');
  const result = buildDataset(snapshot({ Loom: [{ workstation: 'Loom', product: 'Rope', product_amount: 1, ingredient: 'Leaves', ingredient_amount: 4, duration: '<b>x</b>[evil](http://x)' }] }));
  const md = renderReport(result);
  assert.ok(md.includes('\\[evil\\]\\(http://x\\)'));
  assert.ok(!md.includes('[evil](http://x)'));
});

test('odds are shown as percentages in the report, amounts are not', () => {
  const C = { workstation: 'Collider', product: 'Grey Aether', ingredient: 'Corrupted Aether', duration: 64 };
  const md = renderReport(buildDataset(snapshot({
    Collider: [{ ...C, product_amount: 1, product_odds: '75%', ingredient_amount: 0.6 }],
    'Grey Aether': [{ ...C, product_amount: 1, product_odds: '50%', ingredient_amount: 0.5 }],
  })));
  assert.match(md, /odds of Grey Aether \(output\): .* says 75%/);
  assert.match(md, /amount of Corrupted Aether \(input\): .* says 0\.6 /);
});

test('wiki field names like __proto__ or constructor are harmless', () => {
  const { data, report } = buildDataset(snapshot({ Loom: [{ ...SAWN, workstation: 'Loom', ['__proto__']: 'x', constructor: 'y' }] }));
  assert.equal(Object.keys(data.recipes).length, 1);
  // Parameter names are normalised (repeated underscores collapse), and the report keeps them as plain keys.
  assert.deepEqual(Object.keys(report.unknownFields).sort(), ['_proto_', 'constructor']);
  assert.equal(Object.getPrototypeOf({}), Object.prototype, 'nothing global was touched');
});

test('output is deterministic; the data version follows the content', () => {
  const snap = snapshot({ Sawbench: [SAWN] });
  const a = buildDataset(snap).data;
  assert.deepEqual(buildDataset(snap).data, a);
  assert.match(a.meta.dataVersion, /^wiki-2026-11-22-[0-9a-f]{8}$/);
  assert.match(a.meta.license, /CC BY-SA 4\.0/);
  const changed = buildDataset(snapshot({ Sawbench: [{ ...SAWN, duration: 17 }] })).data;
  assert.notEqual(changed.meta.dataVersion, a.meta.dataVersion);
});
