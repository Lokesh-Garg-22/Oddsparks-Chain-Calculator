// @ts-check
/** What every component can read without prop-drilling: the loaded game, the user's prefs and the formatter built from them. */
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';

/**
 * @typedef {object} AppValue
 * @property {any} game
 * @property {import('./format.js').Format} fmt
 * @property {import('../state/prefs.js').Prefs} prefs
 * @property {(fn: (prefs: import('../state/prefs.js').Prefs) => import('../state/prefs.js').Prefs) => void} setPrefs
 */

/** @type {import('preact').Context<AppValue>} */
export const AppContext = createContext(/** @type {any} */ (null));

export const useApp = () => useContext(AppContext);
