import { el, clear, toast } from '../ui.js';
import * as S from '../state.js';

export function render(container, nav) {
  clear(container);
  const s = S.getSettings();

  container.append(
    el('h1', { text: 'Settings' }),
    el('div', { class: 'panel' }, [
      numberSetting('New words per day', 'newPerDay', s.newPerDay, 1, 60),
      numberSetting('Max reviews per day', 'maxReviews', s.maxReviews, 10, 500),
      rateSetting(s.speechRate),
      toggleSetting('Show Thai script', 'showThai', s.showThai),
      genderSetting(s.politeness),
    ]),
    el('div', { class: 'panel' }, [
      el('h2', { text: 'Backup & transfer' }),
      el('button', { class: 'btn btn-big', text: '⬇ Export progress (JSON)', onclick: exportData }),
      el('label', { class: 'btn btn-big', style: 'display:flex;margin-top:8px', text: '⬆ Import progress (JSON)' }, [
        el('input', { type: 'file', accept: 'application/json,.json', style: 'display:none', onchange: (e) => importData(e, nav) }),
      ]),
      el('p', { class: 'hint', text: 'Export a backup or move your progress to another device. Import replaces current progress.' }),
    ]),
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
