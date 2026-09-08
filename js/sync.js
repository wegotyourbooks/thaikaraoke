// Cross-device sync over a secret GitHub Gist.
//
// The algorithm, every time:
//   1. read the remote document (and its updated_at)
//   2. merge remote into local
//   3. roll up reviews older than 180 days
//   4. write the merged document back, rejecting the write if the gist moved
//   5. adopt the merged document locally
//   6. record the sync time; on any failure queue a push for later
//
// Merging is commutative and idempotent (see merge.js), so a device that has
// been offline for a month converges in a single round with nothing lost.
import * as S from './state.js';
import { merge, sameDoc } from './merge.js';
import { rollup } from './rollup.js';
import { createGist, getGist, patchGist, TokenExpired, GistConflict } from './gist.js';

const MAX_ATTEMPTS = 3;
const HIDDEN_DEBOUNCE_MS = 2000;

let running = null;
let listeners = new Set();
let lastError = '';

export function onSyncChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { for (const fn of listeners) { try { fn(syncStatus()); } catch (e) {} } }

export function syncStatus() {
  const l = S.local();
  return {
    connected: !!(l.gistId && l.token),
    gistId: l.gistId,
    hasToken: !!l.token,
    lastSyncAt: l.lastSyncAt || 0,
    pendingPush: !!l.pendingPush,
    error: lastError,
    syncing: !!running,
  };
}

export function isConnected() { return syncStatus().connected; }

// A sync must never run mid-session: the resume point is device-local, and a
// merge underneath a running quiz would swap the cards out from under it.
export function canSyncNow() {
  return isConnected() && !S.getSession();
}

export function connect({ token, gistId }) {
  S.setLocal({ token: token.trim(), gistId: (gistId || '').trim() });
  lastError = '';
  emit();
}

// Wipes the credential from this device. The gist itself is left alone: other
// devices keep working, and the user can revoke the token on GitHub.
export function disconnect() {
  S.setLocal({ token: '', gistId: '', lastSyncAt: 0, pendingPush: false });
  lastError = '';
  emit();
}

export async function createRemote() {
  const token = S.local().token;
  if (!token) throw new Error('no token');
  const { id } = await createGist(token, S.syncableDoc());
  S.setLocal({ gistId: id, lastSyncAt: Date.now(), pendingPush: false });
  emit();
  return id;
}

export async function syncNow({ force = false } = {}) {
  if (running) return running;
  if (!isConnected()) return { ok: false, reason: 'not connected' };
  if (!force && !canSyncNow()) { S.setLocal({ pendingPush: true }); emit(); return { ok: false, reason: 'session in progress' }; }
  running = doSync().finally(() => { running = null; emit(); });
  emit();
  return running;
}

async function doSync() {
  const { token, gistId } = S.local();
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const remote = await getGist(token, gistId);
      const merged = rollup(merge(S.syncableDoc(), remote.doc || S.syncableDoc()));
      if (remote.doc && sameDoc(remote.doc, merged)) {
        S.replaceSyncable(merged);
        S.setLocal({ lastSyncAt: Date.now(), pendingPush: false });
        lastError = '';
        return { ok: true, pushed: false };
      }
      await patchGist(token, gistId, merged, remote.updatedAt);
      S.replaceSyncable(merged);
      S.setLocal({ lastSyncAt: Date.now(), pendingPush: false });
      lastError = '';
      return { ok: true, pushed: true };
    } catch (e) {
      if (e instanceof GistConflict && attempt < MAX_ATTEMPTS) continue; // re-merge against the newer remote
      if (e instanceof TokenExpired) {
        lastError = 'token expired, paste a new one';
        S.setLocal({ pendingPush: true });
        return { ok: false, reason: lastError, tokenExpired: true };
      }
      lastError = navigator.onLine === false ? 'offline — will sync later' : 'sync failed: ' + e.message;
      S.setLocal({ pendingPush: true });
      return { ok: false, reason: lastError };
    }
  }
  lastError = 'sync kept colliding, will retry later';
  S.setLocal({ pendingPush: true });
  return { ok: false, reason: lastError };
}

// ---- pairing over a QR fragment ----
export function encodePairing(gistId, token) {
  return b64url(`${gistId}:${token}`);
}
export function pairingURL(gistId, token) {
  const base = location.origin + location.pathname;
  return `${base}#sync=${encodePairing(gistId, token)}`;
}

// Reads #sync=... written by a scanned QR code, stores the credentials, and
// scrubs the fragment so the token is not left sitting in the address bar.
export function consumePairingHash() {
  const m = /[#&]sync=([A-Za-z0-9_-]+)/.exec(location.hash || '');
  if (!m) return false;
  let decoded = '';
  try { decoded = unb64url(m[1]); } catch (e) { return false; }
  const i = decoded.indexOf(':');
  if (i < 1) return false;
  connect({ gistId: decoded.slice(0, i), token: decoded.slice(i + 1) });
  history.replaceState(null, '', location.pathname + location.search + '#home');
  return true;
}

function b64url(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(s) {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b + '==='.slice((b.length + 3) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// ---- triggers ----
let hiddenTimer = null;

export function installTriggers() {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    clearTimeout(hiddenTimer);
    hiddenTimer = setTimeout(() => { if (canSyncNow()) syncNow(); }, HIDDEN_DEBOUNCE_MS);
  });
  window.addEventListener('online', () => { if (canSyncNow() && S.local().pendingPush) syncNow(); });
  window.addEventListener('pagehide', () => { if (canSyncNow()) S.setLocal({ pendingPush: true }); });
}

export function syncAfterSession() {
  if (canSyncNow()) syncNow();
  else if (isConnected()) S.setLocal({ pendingPush: true });
}
