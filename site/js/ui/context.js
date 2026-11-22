// @ts-check
/** What every component can read without prop-drilling: the loaded game and the formatter for the user's prefs. */
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';

/** @type {import('preact').Context<{ game: any, fmt: import('./format.js').Format }>} */
export const AppContext = createContext(/** @type {any} */ (null));

export const useApp = () => useContext(AppContext);
