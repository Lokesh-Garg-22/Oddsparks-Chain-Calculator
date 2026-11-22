// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { resolveSafePath } from '../tools/serve.mjs';
import { SITE_ROOT } from '../tools/paths.mjs';

test('maps URLs to files inside site/', () => {
  assert.equal(resolveSafePath(SITE_ROOT, '/'), join(SITE_ROOT, 'index.html'));
  assert.equal(resolveSafePath(SITE_ROOT, '/data/'), join(SITE_ROOT, 'data', 'index.html'));
  assert.equal(resolveSafePath(SITE_ROOT, '/js/main.js?v=1'), join(SITE_ROOT, 'js', 'main.js'));
  assert.equal(resolveSafePath(SITE_ROOT, '/icons/Big%20Vial.png'), join(SITE_ROOT, 'icons', 'Big Vial.png'));
});

test('dot segments are collapsed by the URL parser and stay inside site/', () => {
  assert.equal(resolveSafePath(SITE_ROOT, '/../package.json'), join(SITE_ROOT, 'package.json'));
});

test('refuses anything that could escape site/ or is malformed, on every OS', () => {
  assert.equal(resolveSafePath(SITE_ROOT, '/..%5c..%5cpackage.json'), null); // encoded backslashes
  assert.equal(resolveSafePath(SITE_ROOT, '/a%2f..%2f..%2fpackage.json'), null); // encoded slashes
  assert.equal(resolveSafePath(SITE_ROOT, '/x%00.html'), null); // NUL byte
  assert.equal(resolveSafePath(SITE_ROOT, '/%E0%A4%A'), null); // invalid encoding
});
