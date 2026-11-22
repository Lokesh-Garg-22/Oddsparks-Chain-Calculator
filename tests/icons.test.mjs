// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { candidateFiles, looksLikePng, renderCredits } from '../tools/wiki/icons.mjs';
import { infoboxImage } from '../tools/wiki/build.mjs';
import { downloadImage } from '../tools/wiki/api.mjs';
import { DATA_FILE, ICONS_DIR } from '../tools/paths.mjs';

test("the extractor records the image a page's infobox shows", () => {
  assert.equal(infoboxImage('{{Infobox item\n|name=Arty Spark\n|image=Arty spark large.png\n}}'), 'File:Arty spark large.png');
  assert.equal(infoboxImage('{{Infobox building\n|image=[[File:furnace.png]]\n}}'), 'File:Furnace.png');
  assert.equal(infoboxImage('no infobox here'), null);
  assert.equal(infoboxImage(undefined), null);
});

test('icon candidates: infobox image first, then the wiki naming convention, without duplicates', () => {
  assert.deepEqual(candidateFiles('Arty Spark', 'File:Arty spark large.png'), ['File:Arty spark large.png', 'File:Arty spark.png', 'File:Arty Spark.png']);
  assert.deepEqual(candidateFiles('Logger', null), ['File:Logger.png']);
});

test('only real PNG bytes are saved as icons', () => {
  assert.equal(looksLikePng(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])), true);
  assert.equal(looksLikePng(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')), false);
  assert.equal(looksLikePng(new TextEncoder().encode('<html>error page</html>')), false);
});

test('downloads are refused from any host but the wiki', async () => {
  await assert.rejects(downloadImage('https://example.com/x.png'), /another host/);
});

test('credits name the copyright holder, link each file and escape wiki text', () => {
  const md = renderCredits(
    [{ name: 'X', path: 'icons/items/x.png', file: 'File:X.png', pageUrl: 'https://oddsparks.wiki.gg/wiki/File:X.png', uploader: '[me](http://evil)' }],
    ["Tailor's Tent"],
  );
  assert.match(md, /© THQ Nordic AB/);
  assert.match(md, /\[File:X\.png\]\(https:\/\/oddsparks\.wiki\.gg\/wiki\/File:X\.png\)/);
  assert.ok(!md.includes('[me](http://evil)'), 'uploader name cannot become a link');
  assert.match(md, /No icon on the wiki \(1\)/);
});

test('every downloaded icon belongs to an item or building in the data, and exists', () => {
  const sources = join(ICONS_DIR, 'sources.json');
  if (!existsSync(sources)) return; // icons not downloaded yet
  const { sha1 } = JSON.parse(readFileSync(sources, 'utf8'));
  const data = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  for (const key of Object.keys(sha1)) {
    const [kind, id] = key.split('/');
    assert.ok(kind === 'items' ? data.items[id] : data.buildings[id], `${key} is not in the data`);
    assert.ok(existsSync(join(ICONS_DIR, `${key}.png`)), `missing ${key}.png`);
  }
});
