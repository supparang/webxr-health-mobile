/* UX Quest • Sheet-authoritative Cross-device Progress v3
 * Google Sheet is the sole source of truth for official mission progress.
 * localStorage is only a replaceable cache and never unlocks missions by itself.
 */
(() => {
  'use strict';

  const STATUS_ID = 'uxqCloudProgressStatus';
  const PROFILE_ROW_ID = 'uxqCloudProfileRow';
  const CACHE_META_KEY = 'uxq.sheet.progress.cache.v3';
  const config = () => window.UXQ_CLASSROOM_CONFIG || {};
  const identity = () => window.UXQIdentity;
  const store = () => window.UXQProgress;

  function ensureStyle() {
    if (document.getElementById('uxq-sheet-progress-style-v3')) return;
    const style = document.createElement('style');
    style.id = 'uxq-sheet-progress-style-v3';
    style.textContent = `
      .uxq-cloud-profile{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 11px;border:1px solid rgba(155,205,255,.22);border-radius:13px;background:rgba(7,20,47,.56);color:#eaf3ff}
      .uxq-cloud-profile__info{display:grid;gap:2px;min-width:210px;flex:1}.uxq-cloud-profile__info b{font-size:.83rem}.uxq-cloud-profile__info small{color:#aebfe4;font-size:.72rem;line-height:1.35}
      .uxq-cloud-profile button{min-height:34px;border:1px solid rgba(123,232,255,.38);border-radius:10px;padding:7px 11px;background:rgba(55,154,210,.18);color:#eef8ff;font:inherit;font-size:.76rem;font-weight:900;cursor:pointer}
      .uxq-cloud-profile button:hover{background:rgba(76,194,238,.28)}
      .uxq-cloud-profile button:disabled{opacity:.55;cursor:wait}
      .uxq-cloud-status{position:fixed;right:18px;bottom:18px;z-index:9998;max-width:min(430px,calc(100vw - 36px));padding:11px 14px;border:1px solid rgba(123,232,255,.36);border-radius:13px;background:#10274e;color:#eef8ff;box-shadow:0 18px 44px rgba(0,0,0,.35);font-size:.82rem;line-height:1.45;opacity:0;transform:translateY(8px);pointer-events:none;transition:.2s ease}
      .uxq-cloud-status[data-show="1"]{opacity:1;transform:none}.uxq-cloud-status[data-tone="ok"]{border-color:rgba(84,235,174,.55)}.uxq-cloud-status[data-tone="error"]{border-color:rgba(255,137,159,.58)}
      body[data-uxq-cloud-loading="1"] #grid,body[data-uxq-cloud-loading="1"] .current-card{opacity:.42;pointer-events:none}
    `;
    document.head.appendChild(style);
  }

  function status(message, tone = '') {
    ensureStyle();
    let box = document.getElementById(STATUS_ID);
    if (!box) {
      box = document.createElement('div');
      box.id = STATUS_ID;
      box.className = 'uxq-cloud-status';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    box.textContent = String(message || '');
    box.dataset.tone = tone;
    box.dataset.show = '1';
    clearTimeout(status.timer);
    status.timer = setTimeout(() => { box.dataset.show = '0'; }, tone === 'error' ? 8000 : 4300);
  }

  function profileText() {
    const api = identity();
    const p = api?.get?.() || {};
    return api?.isComplete?.(p)
      ? `${p.studentName} • ${p.studentId} • Section ${p.section}`
      : 'ยังไม่ได้ระบุผู้เรียน';
  }

  function setBusy(busy) {
    document.body.dataset.uxqCloudLoading = busy ? '1' : '0';
    document.querySelectorAll('#uxqRestoreProgressBtn,#uxqEditProfileBtn').forEach(btn => { btn.disabled = Boolean(busy); });
  }

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const callback = '__uxqSheetProgress_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const script = document.createElement('script');
      const timer = setTimeout(() => finish(new Error('หมดเวลารอข้อมูลจาก Sheet')), 15000);
      function finish(error, value) {
        clearTimeout(timer);
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
        script.remove();
        error ? reject(error) : resolve(value);
      }
      window[callback] = value => finish(null, value);
      const u = new URL(url);
      u.searchParams.set('callback', callback);
      script.src = u.href;
      script.onerror = () => finish(new Error('เชื่อมต่อ Apps Script ไม่สำเร็จ'));
      document.head.appendChild(script);
    });
  }

  async function request(profile) {
    const cfg = config();
    if (!cfg.receiverUrl) throw new Error('ยังไม่ได้ตั้งค่า receiverUrl');
    const url = new URL(cfg.receiverUrl);
    url.searchParams.set('action', 'uxq_student_progress');
    url.searchParams.set('studentId', String(profile.studentId || '').trim());
    url.searchParams.set('section', String(profile.section || '').trim());
    url.searchParams.set('courseId', cfg.courseId || 'UXQ-ACT1-2026');
    url.searchParams.set('_', String(Date.now()));
    try {
      const response = await fetch(url.href, { method: 'GET', cache: 'no-store', redirect: 'follow' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const text = await response.text();
      try { return JSON.parse(text); } catch (_) { throw new Error('Apps Script ไม่ได้ตอบ JSON'); }
    } catch (_) {
      return jsonp(url.href);
    }
  }

  function blankProgress() {
    const api = store();
    if (!api) throw new Error('UXQProgress ยังไม่พร้อม');
    api.resetQuest();
    return api.get();
  }

  function replaceFromSheet(result) {
    const api = store();
    if (!api) throw new Error('UXQProgress ยังไม่พร้อม');
    const progress = blankProgress();
    const missions = {};

    Object.entries(result?.missions || {}).forEach(([rawId, remote]) => {
      const id = String(rawId || '').trim().toLowerCase();
      if (!api.MISSION_IDS.includes(id)) return;
      const attempt = {
        completedAt: remote.lastCompletedAt || remote.completedAt || '',
        score: Number(remote.bestScore || remote.score || 0),
        stars: Number(remote.bestStars || remote.stars || 0),
        accuracy: Number(remote.bestAccuracy || remote.accuracy || 0),
        correct: Number(remote.bestCorrect || remote.correct || 0),
        total: Number(remote.total || 0),
        hints: Number(remote.hints || 0),
        durationSec: Number(remote.durationSec || 0),
        passed: Boolean(remote.completed || remote.passed || Number(remote.bestStars || remote.stars || 0) >= 2),
        badge: String(remote.badge || 'sheet restore')
      };
      missions[id] = {
        id,
        attempts: Math.max(1, Number(remote.attempts || 1)),
        completed: attempt.passed,
        bestScore: attempt.score,
        bestStars: attempt.stars,
        bestAccuracy: attempt.accuracy,
        bestCorrect: attempt.correct,
        lastResult: attempt,
        lastCompletedAt: attempt.completedAt,
        history: [attempt]
      };
    });

    progress.missions = missions;
    const saved = api.save(progress);
    try {
      localStorage.setItem(CACHE_META_KEY, JSON.stringify({
        source: 'sheet', studentId: result.studentId || '', section: result.section || '',
        completedNodes: saved.quest?.completedNodes || 0, syncedAt: new Date().toISOString(),
        diagnostics: result.diagnostics || null
      }));
    } catch (_) {}
    return saved;
  }

  async function restore({ silent = false } = {}) {
    const idApi = identity();
    if (!idApi) throw new Error('UXQIdentity ยังไม่พร้อม');
    let profile = idApi.get();
    if (!idApi.isComplete(profile)) {
      profile = await idApi.open({ title: 'เข้าสู่ระบบผู้เรียนเพื่อดึงความก้าวหน้าจาก Sheet' });
      if (!profile || profile.guest) return null;
    }

    setBusy(true);
    if (!silent) status('กำลังดึงความก้าวหน้าจาก Google Sheet…');
    try {
      const result = await request(profile);
      if (!result || !result.ok) throw new Error(result?.error || 'ไม่พบคำตอบจาก Apps Script');
      const saved = replaceFromSheet(result);
      const completed = Number(saved?.quest?.completedNodes || 0);
      const next = String(result.nextMission || 'w1').toUpperCase();
      status(result.found
        ? `ดึงจาก Sheet แล้ว ${completed}/19 ด่าน • ด่านถัดไป ${next}`
        : 'ไม่พบประวัติใน Sheet • เริ่มจาก W1', 'ok');
      renderProfile();
      window.dispatchEvent(new CustomEvent('uxq-sheet-progress-restored', { detail: result }));
      return result;
    } finally {
      setBusy(false);
    }
  }

  function renderProfile() {
    const el = document.getElementById('uxqCloudProfileText');
    if (el) el.textContent = profileText();
  }

  function mount() {
    ensureStyle();
    if (document.getElementById(PROFILE_ROW_ID)) return;
    const topbar = document.querySelector('.hub-topbar');
    if (!topbar) return;
    const row = document.createElement('div');
    row.id = PROFILE_ROW_ID;
    row.className = 'uxq-cloud-profile';
    row.innerHTML = `<div class="uxq-cloud-profile__info"><b>LEARNER SHEET PROFILE</b><small id="uxqCloudProfileText"></small></div><button type="button" id="uxqEditProfileBtn">แก้ไข Profile</button><button type="button" id="uxqRestoreProgressBtn">ดึงความคืบหน้าจาก Sheet</button>`;
    topbar.insertAdjacentElement('afterend', row);
    row.querySelector('#uxqEditProfileBtn').addEventListener('click', async () => {
      const updated = await identity()?.open?.({ title: 'แก้ไขข้อมูลผู้เรียน' });
      if (updated && !updated.guest) {
        renderProfile();
        restore().catch(error => status(error.message || String(error), 'error'));
      }
    });
    row.querySelector('#uxqRestoreProgressBtn').addEventListener('click', () => {
      restore().catch(error => status(error.message || String(error), 'error'));
    });
    renderProfile();
  }

  async function boot() {
    mount();
    const idApi = identity();
    if (!idApi || !idApi.isComplete(idApi.get())) return;
    try { await restore({ silent: true }); }
    catch (error) { status('ดึงจาก Sheet ไม่สำเร็จ: ' + (error.message || error), 'error'); }
  }

  document.addEventListener('DOMContentLoaded', boot, { once: true });
  window.addEventListener('uxq-profile-updated', renderProfile);
  window.UXQCloudProgress = Object.freeze({ request, restore, replaceFromSheet });
})();
