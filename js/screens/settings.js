import { el, clear, toast } from '../ui.js';
import * as S from '../state.js';
import * as sync from '../sync.js';
import { svg as qrSVG } from '../qr.js';
import { relTime } from './home.js';

export function render(container, nav) {
  clear(container);
  const s = S.getSettings();

  container.append(
    el('h1', { text: 'Settings' }),
    el('div', { class: 'panel' }, [
      numberSetting('New words per day', 'newPerDay', s.newPerDay, 1, 60),
      numberSetting('Max reviews per day', 'maxReviews', s.maxReviews, 10, 500),
      rateSetting(s.speechRate),
      toggleSetting('Show Thai script', 'showThaiScript', s.showThaiScript),
      toggleSetting('Phrases in study queue', 'phrasesInQueue', s.phrasesInQueue !== false),
      toggleSetting('Show micro-lessons', 'showLessons', s.showLessons !== false),
      genderSetting(s.politeness),
    ]),
    syncPanel(nav),
    el('div', { class: 'panel' }, [
      el('h2', { text: 'Backup & transfer' }),
      el('button', { class: 'btn btn-big', text: '⬇ Export progress (JSON)', onclick: exportData }),
      el('label', { class: 'btn btn-big', style: 'display:flex;margin-top:8px', text: '⬆ Import progress (JSON)' }, [
        el('input', { type: 'file', accept: 'application/json,.json', style: 'display:none', onchange: (e) => importData(e, nav) }),
      ]),
      el('p', { class: 'hint', text: 'Export a backup, or move progress to another device. Import merges with what is already here, so nothing is overwritten.' }),
    ]),
    advancedPanel(nav),
    el('div', { class: 'panel' }, [
      el('h2', { text: 'Danger zone' }),
      el('button', { class: 'btn btn-big', style: 'border-color:var(--bad);color:var(--bad)', text: 'Reset all progress', onclick: () => resetData(nav) }),
    ]),
    el('p', { class: 'dim small center', text: `schema v${S.SCHEMA_VERSION} · data stays on this device` }),
  );
}

function numberSetting(label, key, value, min, max) {
  const input = el('input', { type: 'number', value, min, max, onchange: (e) => {
    let v = parseInt(e.target.value, 10);
    if (isNaN(v)) v = value;
    v = Math.max(min, Math.min(max, v));
    e.target.value = v; S.setSetting(key, v); toast('Saved');
  } });
  return el('div', { class: 'setting' }, [el('label', { text: label }), input]);
}

function rateSetting(value) {
  const out = el('span', { class: 'dim small', text: value.toFixed(2) + '×' });
  const slider = el('input', { type: 'range', min: '0.5', max: '1', step: '0.05', value, oninput: (e) => {
    const v = parseFloat(e.target.value); out.textContent = v.toFixed(2) + '×'; S.setSetting('speechRate', v);
  } });
  return el('div', { class: 'setting' }, [el('label', {}, ['Speech rate ', out]), slider]);
}

function toggleSetting(label, key, value) {
  return el('div', { class: 'setting' }, [
    el('div', { class: 'switch-row' }, [
      el('span', { text: label }),
      el('label', { class: 'switch' }, [
        el('input', { type: 'checkbox', checked: value, onchange: (e) => { S.setSetting(key, e.target.checked); toast('Saved'); } }),
        el('span', { class: 'knob' }),
      ]),
    ]),
  ]);
}

function genderSetting(value) {
  const sel = el('select', { onchange: (e) => { S.setSetting('politeness', e.target.value); toast('Saved'); } }, [
    el('option', { value: 'male', text: 'Male (ครับ)', selected: value === 'male' }),
    el('option', { value: 'female', text: 'Female (ค่ะ/คะ)', selected: value === 'female' }),
  ]);
  return el('div', { class: 'setting' }, [el('label', { text: 'Politeness particles' }), sel, el('p', { class: 'hint', text: 'Swaps the default polite particle in phrases.' })]);
}

function exportData() {
  const blob = new Blob([S.exportJSON()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `thaikaraoke-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Backup downloaded');
}

function importData(e, nav) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      S.importJSON(reader.result);
      toast('Progress imported');
      nav('home');
    } catch (err) {
      toast('Import failed: invalid file');
    }
  };
  reader.readAsText(file);
}

function resetData(nav) {
  if (!confirm('Reset ALL progress? This cannot be undone. Consider exporting a backup first.')) return;
  S.resetAll();
  toast('Progress reset');
  nav('home');
}

// ---- sync ----
function syncPanel(nav) {
  const st = sync.syncStatus();
  const wrap = el('div', { class: 'panel' }, [el('h2', { text: 'Sync across devices' })]);
  const rerender = () => nav('settings');

  if (!st.hasToken) {
    const tokenInput = el('input', { type: 'password', placeholder: 'github_pat_...', autocomplete: 'off', spellcheck: 'false' });
    const gistInput = el('input', { type: 'text', placeholder: 'existing gist id (optional)', autocomplete: 'off', spellcheck: 'false' });
    wrap.append(
      el('p', { class: 'hint', text: 'Sync uses a secret GitHub gist you own. Create a fine-grained personal access token with only the "Gists" permission, then paste it here. The token stays in this browser and is sent only to api.github.com.' }),
      el('div', { class: 'setting' }, [el('label', { text: 'Access token' }), tokenInput]),
      el('div', { class: 'setting' }, [el('label', { text: 'Gist id' }), gistInput]),
      el('button', { class: 'btn btn-primary btn-big', text: 'Connect', onclick: async () => {
        const t = tokenInput.value.trim();
        if (!t) { toast('Paste a token first'); return; }
        sync.connect({ token: t, gistId: gistInput.value.trim() });
        if (!gistInput.value.trim()) {
          try { await sync.createRemote(); toast('Sync gist created'); }
          catch (e) { toast(String(e.message || e)); }
        } else {
          const r = await sync.syncNow({ force: true });
          toast(r && r.ok ? 'Synced' : (r && r.reason) || 'Sync failed');
        }
        rerender();
      } }),
    );
    return wrap;
  }

  const status = st.pendingPush ? 'changes waiting to sync'
    : st.lastSyncAt ? 'last synced ' + relTime(st.lastSyncAt)
    : 'connected, not synced yet';
  wrap.append(
    el('div', { class: 'row between' }, [
      el('span', { class: 'sync-state' }, [el('span', { class: 'sync-dot' + (st.pendingPush ? ' pending' : '') }), st.gistId ? 'Connected' : 'Token set, no gist']),
      el('span', { class: 'dim small', text: status }),
    ]),
    st.error ? el('p', { class: 'hint bad', text: st.error }) : null,
    st.gistId ? el('p', { class: 'dim small', text: 'gist ' + st.gistId }) : null,
  );

  if (!st.gistId) {
    wrap.append(el('button', { class: 'btn btn-primary btn-big', text: 'Create sync gist', onclick: async () => {
      try { await sync.createRemote(); toast('Sync gist created'); } catch (e) { toast(String(e.message || e)); }
      rerender();
    } }));
  } else {
    wrap.append(
      el('button', { class: 'btn btn-primary btn-big', text: 'Sync now', onclick: async () => {
        const r = await sync.syncNow({ force: true });
        toast(r && r.ok ? 'Synced' : (r && r.reason) || 'Sync failed');
        rerender();
      } }),
      pairingPanel(),
    );
  }

  wrap.append(el('button', {
    class: 'btn btn-big', style: 'margin-top:8px;border-color:var(--bad);color:var(--bad)',
    text: 'Disconnect and wipe token',
    onclick: () => {
      if (!confirm('Remove the sync token from this device? Your progress here stays; other devices keep syncing.')) return;
      sync.disconnect();
      toast('Token wiped from this device');
      rerender();
    },
  }));
  return wrap;
}

// Scanning this with a phone camera opens the app already paired: the gist id
// and token ride in the URL fragment, which browsers never send to a server.
function pairingPanel() {
  const st = sync.syncStatus();
  const url = sync.pairingURL(st.gistId, S.local().token);
  const box = el('div', { class: 'qr-box', hidden: true });
  let shown = false;
  const btn = el('button', { class: 'btn btn-big', text: '📱 Pair another device', onclick: () => {
    shown = !shown;
    box.hidden = !shown;
    if (!shown || box.childElementCount) return;
    const markup = qrSVG(url, { size: 240 });
    box.append(
      markup ? el('div', { class: 'qr', html: markup }) : el('p', { class: 'hint bad', text: 'Pairing link is too long for a QR code — use the manual fields instead.' }),
      el('p', { class: 'hint', text: 'Scan with the other device\'s camera. It opens this app already connected. Anyone who scans it gets your token, so do not share the picture.' }),
      el('button', { class: 'btn', text: 'Copy pairing link', onclick: () => {
        navigator.clipboard?.writeText(url).then(() => toast('Link copied'), () => toast('Copy failed'));
      } }),
    );
  } });
  return el('div', {}, [btn, box]);
}

// ---- advanced ----
function advancedPanel(nav) {
  if (!S.hasV1Backup()) return null;
  return el('div', { class: 'panel' }, [
    el('h2', { text: 'Advanced' }),
    el('p', { class: 'hint', text: 'Your pre-upgrade (v1) progress was backed up before migration. Restoring it discards everything studied since the upgrade.' }),
    el('button', { class: 'btn btn-big', text: 'Restore v1 backup', onclick: () => {
      if (!confirm('Restore the pre-upgrade backup? Progress recorded since the upgrade will be discarded.')) return;
      if (S.restoreV1Backup()) location.reload();
      else toast('No backup found');
    } }),
  ]);
}
