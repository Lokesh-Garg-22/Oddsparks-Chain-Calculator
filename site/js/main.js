// @ts-check
/** Entry point: load the game data, then show the calculator (or say why it couldn't load). */
import { render } from 'preact';
import { html } from './ui/html.js';
import { App } from './ui/App.js';
import { loadGame } from './data/load.js';

const root = /** @type {HTMLElement} */ (document.getElementById('app'));

/** Replace the "Loading…" placeholder with a Preact tree. @param {any} vnode */
const show = (vnode) => {
  root.replaceChildren();
  render(vnode, root);
};

loadGame()
  .then((game) => show(html`<${App} game=${game} />`))
  .catch((err) => {
    console.error(err);
    show(html`<p class="container notice">The game data didn't load (${err.message}). Reload the page; if it keeps happening, report it on GitHub.</p>`);
  });
