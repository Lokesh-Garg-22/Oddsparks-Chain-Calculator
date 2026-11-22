// @ts-check
/**
 * Minimal MediaWiki wikitext helpers: find templates (with nesting) and clean parameter values.
 * Only what the extractor needs. Input is untrusted text from the wiki: nothing here evaluates it.
 */

/** MediaWiki treats the first letter of a title case-insensitively, and "_" as " ". */
export function normalizeTitle(/** @type {string} */ s) {
  const t = s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Index just past the "}}" closing the template that opens at `start` ("{{"), or -1.
 * @param {string} text
 * @param {number} start
 */
function closeOf(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; ) {
    if (text.startsWith('{{', i)) { depth++; i += 2; }
    else if (text.startsWith('}}', i)) { depth--; i += 2; if (depth === 0) return i; }
    else i++;
  }
  return -1;
}

/**
 * Split on `sep` only where it isn't inside {{…}} or [[…]].
 * @param {string} s
 * @param {string} sep single character
 */
function splitTopLevel(s, sep) {
  const parts = [];
  let braces = 0, brackets = 0, from = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.startsWith('{{', i)) { braces++; i++; }
    else if (s.startsWith('}}', i)) { braces--; i++; }
    else if (s.startsWith('[[', i)) { brackets++; i++; }
    else if (s.startsWith(']]', i)) { brackets--; i++; }
    else if (s[i] === sep && braces === 0 && brackets === 0) { parts.push(s.slice(from, i)); from = i + 1; }
  }
  parts.push(s.slice(from));
  return parts;
}

/** Parameter names: case-insensitive, spaces and underscores equivalent ("product amount" = "product_amount"). */
function normalizeKey(/** @type {string} */ k) {
  return k.trim().toLowerCase().replace(/[\s_]+/g, '_');
}

/**
 * Named parameters of every template called `name` in `text`, including nested ones.
 * @param {string} text
 * @param {string} name e.g. "Recipe"
 * @returns {Record<string, string>[]}
 */
export function findTemplates(text, name) {
  const wanted = normalizeTitle(name);
  const src = stripComments(text);
  const found = [];
  for (let i = src.indexOf('{{'); i !== -1; i = src.indexOf('{{', i + 2)) {
    if (src.startsWith('{{{', i)) continue; // template parameter syntax, not a call
    const end = closeOf(src, i);
    if (end === -1) break;
    const [head, ...rest] = splitTopLevel(src.slice(i + 2, end - 2), '|');
    if (normalizeTitle(head) !== wanted) continue;
    /** @type {Record<string, string>} */
    const params = Object.create(null); // keys come from the wiki: no inherited keys
    for (const part of rest) {
      const eq = splitTopLevel(part, '=');
      if (eq.length > 1) params[normalizeKey(eq[0])] = eq.slice(1).join('=');
    }
    found.push(params);
  }
  return found;
}

/** @param {string} s */
export function stripComments(s) {
  return s.replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Turn a parameter value into plain text:
 *  [[Target|label]] → Target, {{IconNPC|Woodsman}} → Woodsman, comments and HTML tags removed.
 * Anything left that still looks like markup is reported by the caller.
 * @param {string | undefined} v
 */
export function cleanValue(v) {
  if (v == null) return '';
  let s = stripComments(v);
  // {{IconNPC|Woodsman}} → Woodsman (tolerates the occasional extra brace: "{{{IconNPC|…}}}").
  s = s.replace(/\{{2,}\s*icon[^|{}]*\|([^|{}]*)(?:\|[^{}]*)?\}{2,}/gi, '$1');
  s = s.replace(/\[\[([^|\]]*)(?:\|[^\]]*)?\]\]/g, '$1');
  s = s.replace(/<[^>]+>/g, '');
  return s.replace(/\s+/g, ' ').trim();
}

/** `[[Category: X]]` names on a page. @param {string} text */
export function categoriesOf(text) {
  return [...stripComments(text).matchAll(/\[\[\s*Category\s*:\s*([^\]|]+)/gi)].map((m) => normalizeTitle(m[1]));
}

/** Link targets `[[X]]` / `[[X|label]]` on a page, excluding files and categories. @param {string} text */
export function linksOf(text) {
  return [...stripComments(text).matchAll(/\[\[([^\]|]+)/g)]
    .map((m) => m[1].trim())
    .filter((t) => !/^(file|image|category)\s*:/i.test(t))
    .map(normalizeTitle);
}
