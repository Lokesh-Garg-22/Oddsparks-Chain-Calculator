// @ts-check
/** Choose a folder (or the top level) from the library's tree: for Save as… and Move to…. */
import { html } from './html.js';
import { folderList } from '../state/library.js';

/**
 * @param {{ lib: import('../state/library.js').Library, value: string | null, onChange: (folder: string | null) => void, except?: string }} props
 * except: a folder that can't be chosen, with its subfolders (moving a folder into itself)
 */
export function FolderPicker({ lib, value, onChange, except }) {
  const options = [{ id: null, name: 'Not in a folder', depth: 0 }, ...folderList(lib, except).map((f) => ({ ...f, depth: f.depth + 1 }))];
  return html`
    <fieldset class="folder-picker">
      <legend class="field__label">Folder</legend>
      <ul class="list-reset">
        ${options.map((o) => html`
          <li key=${o.id ?? '(top)'}>
            <label class="folder-picker__option" style=${`--depth:${o.depth}`}>
              <input type="radio" name="folder" checked=${o.id === value} onChange=${() => onChange(o.id)} />
              <span>${o.name}</span>
            </label>
          </li>`)}
      </ul>
    </fieldset>`;
}
