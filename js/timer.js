// Active-time tracking. Counts wall time only while the user is actually here:
// the tab is visible, the window has focus, and something has been pressed in
// the last 45 seconds. An idle tab left open overnight adds nothing.
import * as S from './state.js';

export const IDLE_MS = 45000;
const TICK_MS = 1000;
const PERSIST_MS = 10000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'];

export function createTimer({ mode = 'session', idleMs = IDLE_MS, startedAt = Date.now() } = {}) {
  let activeMs = 0;
  let running = false;
  let lastTick = 0;
  let lastActivity = startedAt;
  let lastPersist = 0;
  let tick = null;
  let stopped = false;
  let counts = { cardsDone: 0, correct: 0 };

  function accrue(now = Date.now()) {
    if (!running) return;
    // Never bill time past the idle deadline of the last real interaction.
    const limit = Math.min(now, lastActivity + idleMs);
    if (limit > lastTick) activeMs += limit - lastTick;
    lastTick = now;
  }

  function pause() {
    if (!running) return;
    accrue();
    running = false;
  }

  function resume() {
    if (stopped || running) return;
    if (document.hidden) return;
    running = true;
    lastTick = Date.now();
  }

  function onActivity() {
    lastActivity = Date.now();
    if (!running) resume(); else accrue();
  }

  function onVisibility() {
    if (document.hidden) pause();
    else { lastActivity = Date.now(); resume(); }
  }

  function persist(force) {
    const now = Date.now();
    if (!force && now - lastPersist < PERSIST_MS) return;
    lastPersist = now;
    S.setLocal({ activeSession: { startedAt, activeMs: snapshot(), lastActivity, mode, ...counts } });
  }

  function snapshot() {
    if (!running) return activeMs;
    const limit = Math.min(Date.now(), lastActivity + idleMs);
    return activeMs + Math.max(0, limit - lastTick);
  }

  function loop() {
    const now = Date.now();
    if (running && now - lastActivity > idleMs) pause();
    else accrue(now);
    persist(false);
  }

  function start() {
    if (tick) return api;
    lastActivity = Date.now();
    running = true;
    lastTick = Date.now();
    tick = setInterval(loop, TICK_MS);
    for (const ev of ACTIVITY_EVENTS) document.addEventListener(ev, onActivity, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', pause);
    window.addEventListener('focus', onActivity);
    persist(true);
    return api;
  }

  function stop() {
    if (stopped) return activeMs;
    pause();
    stopped = true;
    if (tick) { clearInterval(tick); tick = null; }
    for (const ev of ACTIVITY_EVENTS) document.removeEventListener(ev, onActivity);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('blur', pause);
    window.removeEventListener('focus', onActivity);
    S.setLocal({ activeSession: null });
    return activeMs;
  }

  const api = {
    start, stop, pause, resume, snapshot,
    get startedAt() { return startedAt; },
    get mode() { return mode; },
    setCounts(c) { counts = { cardsDone: c.cardsDone || 0, correct: c.correct || 0 }; persist(false); },
    flush() { persist(true); },
  };
  return api;
}

// A crash or a killed tab leaves an in-flight record behind. Close it at the
// last activity we actually saw so hours are never inflated by a dead tab.
export function closeStaleSession() {
  const a = S.local().activeSession;
  if (!a) return null;
  S.setLocal({ activeSession: null });
  if (!a.activeMs && !a.cardsDone) return null;
  return S.appendSession({
    startedAt: a.startedAt,
    endedAt: a.lastActivity || a.startedAt + a.activeMs,
    activeMs: a.activeMs,
    cardsDone: a.cardsDone || 0,
    correct: a.correct || 0,
    mode: a.mode || 'session',
  });
}
