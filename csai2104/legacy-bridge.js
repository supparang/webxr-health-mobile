/*
 * CSAI2401 legacy bridge
 *
 * This file is intentionally independent from the CSAI2104 mission pages. It
 * only reads their completion markers and asks CSAICore to record a verified
 * legacy result. Load core.js before this file on pages that opt in.
 */
(() => {
  'use strict';

  const PROGRESS_KEYS = ['csai2401_progress_v3', 'csai2401-progress-v3'];
  const SESSION_KEY = 'csai2401_legacy_bridge_v1';
  const POLL_MS = 1200;

  const definitions = [
    {
      id: 'w1', label: 'W1', title: 'Diagnostic Simulation', key: 'csai2104_diag_v4',
      href: 'learning-lab.html?week=1',
      read(value) {
        try { return Boolean(value && JSON.parse(value).w1 === true); } catch (_) { return false; }
      },
    },
    {
      id: 'w2', label: 'W2', title: 'Source of Truth', key: 'csai2104_w2_complete',
      href: 'learning-lab.html?week=2',
      read(value) { return String(value || '').toLowerCase() === 'true'; },
    },
    {
      id: 'w3', label: 'W3', title: 'Process Rush', key: 'csai2104_w3',
      href: 'learning-lab.html?week=3',
      read(value) { return String(value || '').toLowerCase() === 'cleared'; },
    },
    {
      id: 'w5', label: 'W5', title: 'Hidden Requirement', key: 'csai2104_w5',
      href: 'learning-lab.html?week=5',
      read(value) { return String(value || '').toLowerCase() === 'cleared'; },
      note: 'W4 stakeholder work is retained as a supplementary legacy activity.',
    },
    {
      id: 'b1', label: 'B1', title: 'False Success Gate', key: 'csai2104_b1_cleared',
      href: 'learning-lab.html?week=5', gate: true,
      read(value) {
        const normalized = String(value || '').toLowerCase();
        return normalized === '1' || normalized === 'true' || normalized === 'cleared';
      },
    },
  ];

  const memory = { seen: {}, pending: {} };
  let storageMode = 'session';

  function getStorage(kind) {
    try {
      const storage = window[kind + 'Storage'];
      const probe = '__csai2401_bridge_probe__';
      storage.setItem(probe, '1');
      storage.removeItem(probe);
      return storage;
    } catch (_) { return null; }
  }

  function readSession() {
    const storage = getStorage('session');
    if (!storage) { storageMode = 'memory'; return; }
    try {
      const saved = JSON.parse(storage.getItem(SESSION_KEY) || '{}');
      if (saved && typeof saved === 'object') {
        if (saved.seen && typeof saved.seen === 'object') memory.seen = saved.seen;
        if (saved.pending && typeof saved.pending === 'object') memory.pending = saved.pending;
      }
    } catch (_) { /* a corrupt session marker must not block the bridge */ }
  }

  function writeSession() {
    if (storageMode !== 'session') return;
    try { getStorage('session')?.setItem(SESSION_KEY, JSON.stringify(memory)); } catch (_) { /* best effort */ }
  }

  function readLegacy(def) {
    let value = null;
    try { value = window.localStorage.getItem(def.key); } catch (_) { return { value: null, complete: false }; }
    return { value, complete: Boolean(def.read(value)) };
  }

  function progressRecord(id) {
    for (const key of PROGRESS_KEYS) {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(key) || 'null');
        if (!parsed || typeof parsed !== 'object') continue;
        const bucket = id.charAt(0).toLowerCase() === 'b' ? parsed.gates : parsed.weeks;
        const record = bucket && bucket[id];
        if (record && record.completed === true) return { key, record, state: parsed };
      } catch (_) { /* try the next compatible key */ }
    }
    return null;
  }

  function notify(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (_) { /* old browsers */ }
  }

  function coreReady() {
    return window.CSAICore && typeof window.CSAICore.recordLegacy === 'function';
  }

  function importOne(def, value) {
    const current = readLegacy(def);
    const legacyValue = value === undefined ? current.value : value;
    if (!def.read(legacyValue)) return { ok: false, reason: 'legacy-not-complete' };
    if (!coreReady()) return { ok: false, reason: 'core-unavailable' };

    let response;
    try {
      response = window.CSAICore.recordLegacy(def.id, {
        source: 'legacy',
        legacyKey: def.key,
        legacyValue,
        legacyLabel: def.label,
      });
    } catch (error) {
      return { ok: false, reason: 'core-error', error };
    }
    if (response && typeof response.then === 'function') {
      return { ok: false, reason: 'core-async' };
    }
    if (!response || response.ok === false) return { ok: false, reason: 'core-rejected', response };

    // Do not announce a migration until the persisted v3 record can be read
    // back. This protects against a core implementation that only updated UI.
    const persisted = progressRecord(def.id);
    if (!persisted) return { ok: false, reason: 'roundtrip-failed', response };

    memory.pending[def.id] = false;
    writeSession();
    const result = { ok: true, id: def.id, definition: def, response, persisted };
    notify('csai2401:legacy-imported', result);
    return result;
  }

  function showMessage(text, kind) {
    const node = document.getElementById('csai2401-legacy-message');
    if (!node) return;
    node.textContent = text;
    node.dataset.kind = kind || 'info';
    node.hidden = false;
  }

  function render() {
    const root = document.getElementById('csai2401-legacy-bridge');
    if (!root) return;
    const list = root.querySelector('[data-legacy-list]');
    if (!list) return;
    list.innerHTML = '';
    definitions.forEach((def) => {
      const status = readLegacy(def);
      const persisted = progressRecord(def.id);
      const waiting = status.complete && !persisted && memory.pending[def.id];
      if (!waiting) return;

      const row = document.createElement('div');
      row.className = 'csai2401-legacy-row';
      row.dataset.id = def.id;
      row.innerHTML = `<div><strong>${def.label} · ${def.title}</strong><small>ตรวจพบผลเดิมจาก ${def.key}${def.note ? ` · ${def.note}` : ''}</small></div>`;
      const actions = document.createElement('div');
      actions.className = 'csai2401-legacy-actions';
      const verify = document.createElement('button');
      verify.type = 'button';
      verify.className = 'csai2401-legacy-verify';
      verify.textContent = 'ตรวจสอบและนำเข้า';
      verify.addEventListener('click', () => {
        verify.disabled = true;
        const result = importOne(def);
        if (result.ok) {
          row.remove();
          showMessage(`นำเข้า ${def.label} แล้ว — บันทึกใน CSAI2401 เรียบร้อย`, 'success');
          if (!list.children.length) root.classList.remove('has-pending');
        } else {
          verify.disabled = false;
          showMessage(result.reason === 'core-unavailable'
            ? 'กำลังรอ Course Core โหลดเสร็จ ลองอีกครั้ง'
            : 'ยังยืนยันผลเดิมไม่ได้ กรุณาเปิดภารกิจเดิมแล้วลองอีกครั้ง', 'error');
        }
      });
      const lab = document.createElement('a');
      lab.href = def.href;
      lab.className = 'csai2401-legacy-link';
      lab.textContent = 'เปิด Learning Lab';
      actions.append(verify, lab);
      row.appendChild(actions);
      list.appendChild(row);
    });
    const pending = list.children.length > 0;
    root.classList.toggle('has-pending', pending);
    root.classList.toggle('compact', !pending);
    // Keep a compact navigation strip available even when no migration is
    // pending. A user dismissal applies until a pending result appears.
    if (pending) root.hidden = false;
    else if (root.dataset.dismissed !== 'true') root.hidden = false;
  }

  function ensureUi() {
    if (!document.body || document.getElementById('csai2401-legacy-bridge')) return;
    const root = document.createElement('aside');
    root.id = 'csai2401-legacy-bridge';
    root.className = 'csai2401-legacy-bridge';
    root.setAttribute('aria-label', 'CSAI2401 legacy progress bridge');
    root.innerHTML = `
      <div class="csai2401-legacy-head">
        <div><span class="csai2401-legacy-kicker">CSAI2401 · PROGRESS BRIDGE</span>
          <strong>ย้ายผลการเรียนเดิมจาก CSAI2104</strong></div>
        <button type="button" class="csai2401-legacy-dismiss" aria-label="ซ่อนแถบนี้">ซ่อน</button>
      </div>
      <p class="csai2401-legacy-intro">ตรวจพบผลเดิมบนเครื่องนี้ ระบบจะนำเข้าเมื่อคุณกดตรวจสอบเท่านั้น</p>
      <div id="csai2401-legacy-message" class="csai2401-legacy-message" role="status" hidden></div>
      <div data-legacy-list></div>
      <nav class="csai2401-legacy-nav" aria-label="CSAI2401 navigation">
        <a href="./">Mission Control</a>
        <a href="learning-lab.html?week=1">W1 Learning Lab</a>
        <a href="learning-lab.html?week=2">W2 Learning Lab</a>
        <a href="learning-lab.html?week=3">W3 Learning Lab</a>
        <a href="learning-lab.html?week=5">W5 Learning Lab</a>
      </nav>`;
    root.querySelector('.csai2401-legacy-dismiss').addEventListener('click', () => {
      root.hidden = true;
      root.dataset.dismissed = 'true';
    });
    document.body.prepend(root);
  }

  function sync(options) {
    const opts = options || {};
    const report = { detected: [], imported: [], pending: [], errors: [] };
    definitions.forEach((def) => {
      const status = readLegacy(def);
      const persisted = progressRecord(def.id);
      const hadSeen = Object.prototype.hasOwnProperty.call(memory.seen, def.id);
      const wasComplete = memory.seen[def.id] === true;
      if (!status.complete) {
        memory.seen[def.id] = false;
        memory.pending[def.id] = false;
        return;
      }
      report.detected.push(def.id);
      memory.seen[def.id] = true;
      if (persisted) {
        memory.pending[def.id] = false;
        return;
      }
      const newlyObserved = hadSeen && !wasComplete;
      // A complete marker already present when this bridge first sees it is
      // deliberately pending. Only an explicit button (importExisting) or a
      // false -> true transition observed by the poller may auto-import it.
      const allowImport = Boolean(opts.importExisting || newlyObserved);
      if (allowImport) {
        const result = importOne(def, status.value);
        if (result.ok) report.imported.push(def.id);
        else report.errors.push({ id: def.id, reason: result.reason });
        if (!result.ok) {
          memory.pending[def.id] = true;
          // Keep a newly observed transition retryable if core was still
          // loading or the first write did not round-trip.
          if (newlyObserved) memory.seen[def.id] = false;
        }
      } else {
        memory.pending[def.id] = true;
      }
      if (memory.pending[def.id]) report.pending.push(def.id);
    });
    writeSession();
    render();
    // Consumers can use the returned report for pending markers. Emit a sync
    // event only when at least one record has been verified and persisted.
    if (report.imported.length) notify('csai2401:legacy-sync', report);
    return report;
  }

  function boot() {
    readSession();
    ensureUi();
    sync();
    window.setInterval(() => sync(), POLL_MS);
  }

  window.CSAILegacy = {
    definitions,
    sync,
    import(id) {
      const def = definitions.find((item) => item.id === id);
      if (!def) return { ok: false, reason: 'unknown-legacy-id' };
      const result = importOne(def);
      render();
      return result;
    },
    read(id) {
      const def = definitions.find((item) => item.id === id);
      return def ? readLegacy(def) : null;
    },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();


