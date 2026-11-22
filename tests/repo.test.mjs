// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SITE_ROOT } from '../tools/serve.mjs';

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
