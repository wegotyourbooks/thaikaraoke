// Entry point: boot, hash router, tab nav, service worker, voice banner.
import { initAudio, onVoiceStatus } from './audio.js';
import * as S from './state.js';
import * as home from './screens/home.js';
import * as browse from './screens/browse.js';
import * as stats from './screens/stats.js';
import * as settings from './screens/settings.js';
import * as tonegym from './screens/tonegym.js';
import * as session from './session.js';

const screens = {
  home: document.getElementById('screen-home'),
  session: document.getElementById('screen-session'),
  tonegym: document.getElementById('screen-tonegym'),
  browse: document.getElementById('screen-browse'),
  stats: document.getElementById('screen-stats'),
  settings: document.getElementById('screen-settings'),
};

function show(name) {
  for (const [k, node] of Object.entries(screens)) node.hidden = k !== name;
  document.querySelectorAll('#tabbar .tab').forEach((t) => t.classList.toggle('active', t.dataset.nav === name));
  window.scrollTo(0, 0);
}

let currentOpts = {};
export function nav(name, opts = {}) {
  currentOpts = opts;
  if (location.hash !== '#' + name) { location.hash = name; }
  else route(); // same hash: re-render
}

function route() {
  const name = (location.hash.replace('#', '') || 'home');
  const target = screens[name] ? name : 'home';
  show(target);
  render(target, currentOpts);
  currentOpts = {};
}

function render(name, opts) {
  const c = screens[name];
  switch (name) {
    case 'home': home.render(c, nav); break;
    case 'browse': browse.render(c); break;
    case 'stats': stats.render(c); break;
    case 'settings': settings.render(c, nav); break;
    case 'tonegym': tonegym.render(c); break;
    case 'session':
      if (opts.resume && session.hasResumable()) session.resumeSession(c);
      else session.startSession(c);
      break;
  }
}

function boot() {
  initAudio();
  session.setExitHandler(() => nav('home'));

  document.querySelectorAll('#tabbar .tab').forEach((t) =>
    t.addEventListener('click', () => nav(t.dataset.nav)));

  window.addEventListener('hashchange', route);

  // Voice banner: show once if no Thai voice is available.
  const banner = document.getElementById('voice-banner');
  document.getElementById('voice-banner-dismiss').addEventListener('click', () => {
    banner.hidden = true;
    try { localStorage.setItem('thaikaraoke.voiceBannerDismissed', '1'); } catch (e) {}
  });
  onVoiceStatus((hasVoice) => {
    let dismissed = false;
    try { dismissed = localStorage.getItem('thaikaraoke.voiceBannerDismissed') === '1'; } catch (e) {}
    banner.hidden = hasVoice || dismissed;
  });

  // Service worker for offline use.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }

  S.rolloverDay();
  route();
}

boot();
