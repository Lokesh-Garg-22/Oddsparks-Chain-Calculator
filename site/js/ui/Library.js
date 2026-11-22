// @ts-check
/**
 * The saved library (mockup: Library and Menus screens): search, nested folders with counts, drag and
 * drop, ··· menus, Move to…, back up and restore. A column beside the calculator; a drawer on narrower
 * screens. Every change goes through the pure updaters in site/js/state/library.js.
 */
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { html } from './html.js';
import { Menu, MenuItem } from './Menu.js';
import { ConfirmDialog } from './Dialog.js';
import { FolderPicker } from './FolderPicker.js';
import { RenameField } from './RenameField.js';
import { Chevron, CloseIcon, FolderIcon } from './icons.js';
import { downloadFile, today } from './download.js';
import {
  addFolder, deleteFolder, deleteTab, duplicateTab, folderPath, fromBackup, isFolder, mergeLibrary,
  moveItem, newId, parentOf, positionOf, rename, searchTabs, tabsWithin, toBackup, toggleFolder,
} from '../state/library.js';

/** @typedef {import('../state/library.js').Library} Library */
/** @typedef {(fn: (lib: Library) => Library) => void} ChangeLibrary */
/**
 * What's being asked: deleting, moving or restoring.
 * @typedef {{ kind: 'delete-tab' | 'delete-folder' | 'move', id: string } | { kind: 'restore', incoming: Library }} Ask
 */

const plural = (/** @type {number} */ n, /** @type {string} */ word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * @param {{ lib: Library, change: ChangeLibrary, stored: boolean, activeTabId: string | null, onOpen: (tabId: string) => void, onClose: () => void }} props
 * stored: false when the browser blocks saving
 */
export function Library({ lib, change, stored, activeTabId, onOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState(/** @type {string | null} */ (null));
  const [ask, setAsk] = useState(/** @type {Ask | null} */ (null));
  const [moveTo, setMoveTo] = useState(/** @type {string | null} */ (null));
  const [note, setNote] = useState(/** @type {{ text: string, tone: 'ok' | 'warn' } | null} */ (null));
  const [dragging, setDragging] = useState(/** @type {string | null} */ (null));
  const file = useRef(/** @type {HTMLInputElement | null} */ (null));
  const heading = useRef(/** @type {HTMLHeadingElement | null} */ (null));
  // Focus moves into the library when it opens, so keyboard and screen reader users land in it.
  useLayoutEffect(() => heading.current?.focus(), []);

  const matches = query.trim() ? searchTabs(lib, query) : null;
  /** Shown while searching: matching tabs, and folders holding one. @param {string} id @returns {boolean} */
  const visible = (id) => !matches || (isFolder(lib, id) ? tabsWithin(lib, id).some((t) => matches.has(t)) : matches.has(id));
  const tabCount = Object.keys(lib.tabs).length;
  const nameOf = (/** @type {string} */ id) => (isFolder(lib, id) ? lib.folders[id].name : lib.tabs[id].name);

  const close = () => setAsk(null);
  /** Change the library, then close the dialog. @param {(l: Library) => Library} fn */
  const done = (fn) => () => {
    change(fn);
    close();
  };
  const askMove = (/** @type {string} */ id) => {
    setMoveTo(parentOf(lib, id) ?? null);
    setAsk({ kind: 'move', id });
  };
  const newFolder = (/** @type {string | null} */ parent) => {
    const id = newId('f');
    change((l) => {
      const next = addFolder(l, { id, name: 'New folder', parent });
      return parent && next.folders[parent].collapsed ? toggleFolder(next, parent) : next;
    });
    setRenaming(id);
  };

  // ---- drag and drop (desktop); Move to… does the same on touch and keyboard ----
  /** @param {DragEvent} e @param {string | null} parent @param {number} [index] */
  const drop = (e, parent, index) => {
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer?.getData('text/plain');
    setDragging(null);
    if (id && id !== parent) change((l) => moveItem(l, id, parent, index));
  };
  const allowDrop = (/** @type {DragEvent} */ e) => dragging && e.preventDefault();

  // ---- back up and restore ----
  const backup = () =>
    downloadFile(new Blob([JSON.stringify(toBackup(lib, new Date().toISOString()), null, 1)], { type: 'application/json' }), `oddsparks-library-${today()}.json`);
  /** @param {Library} incoming @param {'merge' | 'replace'} how */
  const restore = (incoming, how) => {
    change((l) => (how === 'replace' ? incoming : mergeLibrary(l, incoming, newId)));
    const folders = Object.keys(incoming.folders).length;
    setNote({ tone: 'ok', text: `Restored ${plural(Object.keys(incoming.tabs).length, 'saved tab')}${folders ? ` in ${plural(folders, 'folder')}` : ''}.` });
    close();
  };
  const readFile = async (/** @type {Event} */ e) => {
    const input = /** @type {HTMLInputElement} */ (e.currentTarget);
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    const incoming = fromBackup(await f.text());
    if (!incoming) setNote({ tone: 'warn', text: `“${f.name}” isn't a library backup from this calculator, so nothing was restored.` });
    else if (!lib.root.length) restore(incoming, 'replace');
    else setAsk({ kind: 'restore', incoming });
  };

  /** One row of the tree, folder or tab; folders bring their children. @param {string} id @param {number} depth @returns {any} */
  const item = (id, depth) => {
    if (!visible(id)) return null;
    const folder = isFolder(lib, id) ? lib.folders[id] : null;
    const name = nameOf(id);
    const open = folder != null && (!folder.collapsed || Boolean(matches));
    const current = id === activeTabId;
    /** Drop on a folder: into it; on a tab: just before it. @param {DragEvent} e */
    const onDrop = (e) => {
      const at = positionOf(lib, id);
      if (folder) drop(e, id);
      else if (at) drop(e, at.parent, at.index);
    };
    const count = folder ? tabsWithin(lib, id).length : 0;

    const main = folder
      ? html`
        <button type="button" class="lib__name" aria-expanded=${open} onClick=${() => change((l) => toggleFolder(l, id))}>
          <${Chevron} open=${open} /><span>${name}</span>
        </button>
        <span class="lib__count small muted" aria-label=${plural(count, 'saved tab')}>${count}</span>`
      : html`
        <button type="button" class="lib__name lib__name--tab" aria-current=${current ? 'true' : undefined} onClick=${() => onOpen(id)}>
          <span>${name}</span>
          ${matches && html`<span class="small muted">${folderPath(lib, id).join(' › ')}</span>`}
        </button>`;
    const actions = folder
      ? html`
        <${MenuItem} onClick=${() => newFolder(id)}>New subfolder<//>
        <${MenuItem} onClick=${() => setRenaming(id)}>Rename<//>
        <${MenuItem} onClick=${() => askMove(id)}>Move to…<//>
        <${MenuItem} danger onClick=${() => (folder.children.length ? setAsk({ kind: 'delete-folder', id }) : change((l) => deleteFolder(l, id, 'move-up')))}>Delete<//>`
      : html`
        <${MenuItem} onClick=${() => onOpen(id)}>Open<//>
        <${MenuItem} onClick=${() => setRenaming(id)}>Rename<//>
        <${MenuItem} onClick=${() => change((l) => duplicateTab(l, id, newId('t'), new Date().toISOString()))}>Duplicate<//>
        <${MenuItem} onClick=${() => askMove(id)}>Move to…<//>
        <${MenuItem} danger onClick=${() => setAsk({ kind: 'delete-tab', id })}>Delete<//>`;

    return html`
      <li key=${id}>
        <div class=${`lib__row${folder ? ' lib__row--folder' : ''}${current ? ' is-current' : ''}${dragging === id ? ' is-dragging' : ''}`} style=${`--depth:${depth}`}
          draggable=${renaming !== id} onDragStart=${(/** @type {DragEvent} */ e) => { e.dataTransfer?.setData('text/plain', id); setDragging(id); }}
          onDragEnd=${() => setDragging(null)} onDragOver=${allowDrop} onDrop=${onDrop}>
          ${renaming === id
            ? html`<${RenameField} initial=${name} label=${folder ? 'Folder name' : 'Saved tab name'} className="lib__rename"
                onDone=${(/** @type {string | null} */ n) => { setRenaming(null); if (n != null) change((l) => rename(l, id, n)); }} />`
            : html`${main}
              <${Menu} id=${`m-${id}`} buttonClass="lib__more" buttonLabel=${`More for ${folder ? 'folder ' : ''}${name}`} panelLabel=${name} label="···">
                <div class="menu__list">${actions}</div>
              <//>`}
        </div>
        ${open && folder.children.length > 0 && html`<ul class="list-reset">${folder.children.map((c) => item(c, depth + 1))}</ul>`}
      </li>`;
  };

  /** The open dialog, if any. */
  const dialog = () => {
    if (!ask) return null;
    if (ask.kind === 'restore') {
      return html`
        <${ConfirmDialog} title="Restore from a backup" onCancel=${close}
          actions=${[
            { label: 'Cancel', tone: 'quiet', onClick: close },
            { label: 'Add to my library', tone: 'primary', onClick: () => restore(ask.incoming, 'merge') },
            { label: 'Replace my library', tone: 'danger', onClick: () => restore(ask.incoming, 'replace') },
          ]}>
          <p>The backup has ${plural(Object.keys(ask.incoming.tabs).length, 'saved tab')}. Your library has ${plural(tabCount, 'saved tab')}. Adding keeps both; replacing deletes yours.</p>
        <//>`;
    }
    const { id } = ask;
    const name = nameOf(id);
    if (ask.kind === 'delete-tab') {
      return html`
        <${ConfirmDialog} title=${`Delete “${name}”?`} onCancel=${close}
          actions=${[{ label: 'Keep it', tone: 'quiet', onClick: close }, { label: 'Delete', tone: 'danger', onClick: done((l) => deleteTab(l, id)) }]}>
          <p>It's removed from your library. If it's open, the tab stays open with its contents.</p>
        <//>`;
    }
    if (ask.kind === 'delete-folder') {
      const n = tabsWithin(lib, id).length;
      const nested = lib.folders[id].children.some((c) => isFolder(lib, c));
      return html`
        <${ConfirmDialog} title=${`Delete folder “${name}”?`} onCancel=${close}
          actions=${[
            { label: 'Cancel', tone: 'quiet', onClick: close },
            { label: 'Keep its contents, delete the folder', tone: 'primary', onClick: done((l) => deleteFolder(l, id, 'move-up')) },
            { label: `Delete it with ${plural(n, 'saved tab')}`, tone: 'danger', onClick: done((l) => deleteFolder(l, id, 'delete')) },
          ]}>
          <p>It holds ${plural(n, 'saved tab')}${nested ? ', counting its subfolders' : ''}. Its contents can move up one level, or go with it.</p>
        <//>`;
    }
    return html`
      <${ConfirmDialog} title=${`Move “${name}” to…`} onCancel=${close}
        actions=${[{ label: 'Cancel', tone: 'quiet', onClick: close }, { label: 'Move here', tone: 'primary', onClick: done((l) => moveItem(l, id, moveTo)) }]}>
        <${FolderPicker} lib=${lib} value=${moveTo} onChange=${setMoveTo} except=${isFolder(lib, id) ? id : undefined} />
      <//>`;
  };

  return html`
    <aside class="panel library" aria-labelledby="library-h"
      onKeyDown=${(/** @type {KeyboardEvent} */ e) => {
        // Escape closes the library, unless it's closing a dialog, menu or rename inside it.
        if (e.key === 'Escape' && !(/** @type {Element} */ (e.target)).closest('dialog, [popover], input')) onClose();
      }}>
      <div class="library__head">
        <h2 id="library-h" tabindex="-1" ref=${heading}>Saved library</h2>
        <button type="button" class="button button--quiet library__icon" aria-label="New folder" title="New folder" onClick=${() => newFolder(null)}>
          <${FolderIcon} size=${18} plus />
        </button>
        <button type="button" class="button button--quiet library__icon library__close" aria-label="Close the library" onClick=${onClose}>
          <${CloseIcon} size=${16} />
        </button>
      </div>

      ${!stored && html`<p class="notice small" role="alert">This browser blocks saving (private browsing, or storage is full), so the library is lost when you close the page. Back up keeps a copy.</p>`}
      ${note && html`
        <div class=${`notice banner small${note.tone === 'ok' ? ' notice--ok' : ''}`} role="status">
          <p>${note.text}</p>
          <button type="button" class="button button--quiet" onClick=${() => setNote(null)}>Dismiss</button>
        </div>`}

      ${tabCount > 0 && html`
        <label class="field">
          <span class="field__label">Search saved tabs</span>
          <input class="input" type="search" placeholder="e.g. Timber" value=${query} onInput=${(/** @type {any} */ e) => setQuery(e.currentTarget.value)} />
        </label>`}

      ${lib.root.length === 0
        ? html`<p class="muted small">Nothing saved yet. Use Save above the results to keep a calculation here, then sort it into folders.</p>`
        : html`
          <ul class="list-reset lib__tree" aria-label="Saved tabs and folders">${lib.root.map((id) => item(id, 0))}</ul>
          ${matches && matches.size === 0 && html`<p class="muted small">No saved tab matches “${query.trim()}”.</p>`}
          ${dragging && html`
            <div class="lib__drop small" onDragOver=${allowDrop} onDrop=${(/** @type {DragEvent} */ e) => drop(e, null)}>Drop here to take it out of its folder</div>`}`}

      <div class="library__foot small muted">
        <p>Drag tabs and folders to sort them, or use Move to… in their ··· menu.</p>
        <p>Saved in this browser only.</p>
        <div class="library__backup">
          <button type="button" class="button button--quiet" onClick=${backup} disabled=${lib.root.length === 0}>Back up library</button>
          <button type="button" class="button button--quiet" onClick=${() => file.current?.click()}>Restore…</button>
          <input ref=${file} type="file" accept=".json,application/json" hidden onChange=${readFile} />
        </div>
      </div>
      ${dialog()}
    </aside>`;
}
