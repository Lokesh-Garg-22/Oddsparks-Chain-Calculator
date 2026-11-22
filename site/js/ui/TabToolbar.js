// @ts-check
/** Above the results: the tab's name, where it's saved, whether it has unsaved changes; Save and Save as…. */
import { useState } from 'preact/hooks';
import { html } from './html.js';
import { ConfirmDialog } from './Dialog.js';
import { FolderPicker } from './FolderPicker.js';
import { useApp } from './context.js';
import { folderPath, parentOf } from '../state/library.js';
import { tabLabel } from '../state/tabs.js';

/**
 * @param {{ tab: import('../state/tabs.js').OpenTab, lib: import('../state/library.js').Library, onSave: () => void, onSaveAs: (name: string, folder: string | null) => void }} props
 */
export function TabToolbar({ tab, lib, onSave, onSaveAs }) {
  const { game } = useApp();
  const [savingAs, setSavingAs] = useState(false);
  const [name, setName] = useState('');
  const [folder, setFolder] = useState(/** @type {string | null} */ (null));
  const label = tabLabel(game, tab);
  const saved = tab.tabId != null && Object.hasOwn(lib.tabs, tab.tabId);
  const path = saved ? folderPath(lib, /** @type {string} */ (tab.tabId)) : [];

  let status = 'Not saved yet';
  if (saved) status = `${path.length ? `In ${path.join(' › ')}` : 'In your library'}${tab.dirty ? ', with unsaved changes' : ', saved'}`;

  const openSaveAs = () => {
    setName(label);
    setFolder(saved ? parentOf(lib, /** @type {string} */ (tab.tabId)) ?? null : null);
    setSavingAs(true);
  };

  return html`
    <section class="panel toolbar" aria-label="This calculation">
      <div class="toolbar__text">
        <h2 class="toolbar__name">${label}</h2>
        <p class="small muted">${tab.dirty && html`<span class="tab__dot" aria-hidden="true"></span> `}${status}</p>
      </div>
      <div class="toolbar__actions">
        <button type="button" class="button button--primary" disabled=${saved && !tab.dirty} onClick=${() => (saved ? onSave() : openSaveAs())}>Save</button>
        <button type="button" class="button button--quiet" onClick=${openSaveAs}>Save as…</button>
      </div>
      ${savingAs && html`
        <${ConfirmDialog} title="Save as" onCancel=${() => setSavingAs(false)}
          actions=${[
            { label: 'Cancel', tone: 'quiet', onClick: () => setSavingAs(false) },
            { label: 'Save', tone: 'primary', onClick: () => { onSaveAs(name.trim() || label, folder); setSavingAs(false); } },
          ]}>
          <label class="field">
            <span class="field__label">Name</span>
            <input class="input" value=${name} maxlength="60" onInput=${(/** @type {any} */ e) => setName(e.currentTarget.value)} />
          </label>
          <${FolderPicker} lib=${lib} value=${folder} onChange=${setFolder} />
          ${saved && html`<p class="small muted">This saves a new copy; the one you opened stays as it is.</p>`}
        <//>`}
    </section>`;
}
