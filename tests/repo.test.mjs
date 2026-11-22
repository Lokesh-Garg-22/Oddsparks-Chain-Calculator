// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SITE_ROOT } from '../tools/paths.mjs';
import { KEY_PREFIX } from '../site/js/state/storage.js';
import { PREFS_NAME } from '../site/js/state/prefs.js';

const ROOT = join(import.meta.dirname, '..');

test('package.json has no dependencies (no-build, zero-dependency rule)', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
});

test('the published site has its entry page and licence notices', () => {
  for (const f of ['index.html', 'data/LICENSE-DATA.md', 'icons/CREDITS.md']) {
    assert.ok(existsSync(join(SITE_ROOT, f)), `missing site/${f}`);
  }
});

test("index.html's early theme script reads the key the app writes prefs to", () => {
  const page = readFileSync(join(SITE_ROOT, 'index.html'), 'utf8');
  assert.ok(page.includes(`localStorage.getItem('${KEY_PREFIX}${PREFS_NAME}')`));
});

test('the import map comes before any module preload (else bare imports like "preact" can fail to resolve)', () => {
  const page = readFileSync(join(SITE_ROOT, 'index.html'), 'utf8');
  assert.ok(page.indexOf('type="importmap"') > -1);
  assert.ok(page.indexOf('type="importmap"') < page.indexOf('rel="modulepreload"'));
});

test('the Pages workflow publishes only site/, after the tests, with every action pinned to a commit', () => {
  const wf = readFileSync(join(ROOT, '.github', 'workflows', 'pages.yml'), 'utf8');
  assert.match(wf, /upload-pages-artifact@[0-9a-f]{40}[^\n]*\n\s+with:\n\s+path: site\n/);
  assert.match(wf, /needs: test/);
  for (const use of wf.matchAll(/uses: ([^\s]+)/g)) assert.match(use[1], /@[0-9a-f]{40}$/, `${use[1]} is pinned to a full commit SHA`);
  assert.match(wf, /^permissions:\n\s+contents: read/m, 'least privilege by default');
});

test('site/404.html stands alone (Pages serves it at any depth)', () => {
  const page = readFileSync(join(SITE_ROOT, '404.html'), 'utf8');
  assert.ok(!/(href|src)="\.?\//.test(page.replace('href="/"', '')), 'no relative links to css/ or js/');
});
