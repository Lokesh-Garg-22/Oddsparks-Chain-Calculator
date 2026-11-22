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
