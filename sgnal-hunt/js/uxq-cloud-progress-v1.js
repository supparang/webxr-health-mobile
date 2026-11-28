/* UX Quest • Sheet-authoritative Cross-device Progress v3.5
 * Google Sheet is the sole source of truth for official mission progress.
 * localStorage is only a replaceable cache and never unlocks missions by itself.
 * GET transport: JSONP only, because Apps Script Web Apps do not provide CORS headers.
 * v3.5: single-flight request deduplication, 60s slow-Sheet tolerance, stale-identity
 * guard, clean missing-profile & retry states without premature hard-fail timeouts.
 */
(() => {
  'use strict';

  const VERSION = 'uxq-cloud-progress-v3.5-20261127';
  const STATUS_ID = 'uxqCloudProgressStatus';
  const PROFILE_ROW_ID = 'uxqCloudProfileRow';
  const CACHE_META_KEY = 'uxq.sheet.progress.cache.v3';
  const JSONP_TIMEOUT_MS = 60000;
  const SLOW_NOTICE_MS = 8000;

  const config = () => window.UXQ_CLASSROOM_CONFIG || {};
  const identity = () => window.UXQIdentity;
  const store = () => window.UXQProgress;

  let booted = false;
  let activeToken = 0;
  let lastFailed = false;
  const inFlight = new Map();

  const clean = (value, max = 120) => String(value == null ? '' : value).trim().slice(0, max);
  const identityKey = p => `${clean(p?.studentId, 80).toLowerCase()}|${clean(p?.section, 80).toLowerCase()}|${clean(config().courseId || 'UXQ-ACT1-2026', 120)}`;

  function ensureStyle() {
    if (document.getElementById('uxq-sheet-progress-style-v3')) return;
    const style = document.createElement('style');
    style.id = 'uxq-sheet-progress-style-v3';
    style.textContent = `
      .uxq-cloud-profile{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px;padding:10px 12px;border:1px solid rgba(155,205,255,.24);border-radius:14px;background:rgba(7,20,47,.62);color:#eaf3ff}
      .uxq-cloud-profile__info{display:grid;gap:2px;min-width:210px;flex:1}.uxq-cloud-profile__info b{font-size:.82rem;letter-spacing:.05em}.uxq-cloud-profile__info small{color:#aebfe4;font-size:.76rem;line-height:1.38}
      .uxq-cloud-profile button{min-height:36px;border:1px solid rgba(123,232,255,.4);border-radius:10px;padding:7px 12px;background:rgba(55,154,210,.2);color:#eef8ff;font:inherit;font-size:.78rem;font-weight:900;cursor:pointer}
      .uxq-cloud-profile button:hover{background:rgba(76,194,238,.3)}
      .uxq-cloud-profile button:disabled{opacity:.55;cursor:wait}
      .uxq-cloud-status{position:fixed;right:18px;bottom:18px;z-index:9998;max-width:min(430px,calc(100vw - 36px));padding:11px 14px;border:1px solid rgba(123,232,255,.36);border-radius:13px;background:#10274e;color:#eef8ff;box-shadow:0 18px 44px rgba(0,0,0,.35);font-size:.82rem;line-height:1.45;opacity:0;transform:translateY(8px);pointer-events:none;transition:.2s ease}
      .uxq-cloud-status[data-show="1"]{opacity:1;transform:none}.uxq-cloud-status[data-tone="ok"]{border-color:rgba(84,235,174,.55)}.uxq-cloud-status[data-tone="error"]{border-color:rgba(255,137,159,.58)}
      .uxq-cloud-recovery-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}
      .uxq-cloud-recovery-actions a,.uxq-cloud-recovery-actions button{min-height:42px;padding:9px 14px;border-radius:11px;font:inherit;font-size:.84rem;font-weight:900;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
      .uxq-cloud-recovery-actions .is-secondary{background:transparent;color:#eaf3ff;border:1px solid rgba(255,255,255,.35)}
      body[data-uxq-cloud-loading="1"] #grid,body[data-uxq-cloud-loading="1"] .current-card{opacity:.58;transition:opacity .18s ease}
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
    status.timer = setTimeout(() => { box.dataset.show = '0'; }, tone === 'error' ? 9000 : 4500);
  }

  function clearRecoveryActions() {
    document.querySelectorAll('#uxqStudentRecoveryActions,[data-sheet-recovery-action],.uxq-cloud-recovery-actions').forEach(el => el.remove());
  }

  function profileText() {
    const api = identity();
    const p = api?.get?.() || {};
    return api?.isComplete?.(p)
      ? `${p.studentName} • ${p.studentId} • Section ${p.section}`
      : 'ยังไม่ได้ระบุผู้เรียน (กรุณาระบุรหัสนักศึกษา ชื่อ และ Section)';
  }

  function setBusy(busy) {
    if (document.body) document.body.dataset.uxqCloudLoading = busy ? '1' : '0';
    document.querySelectorAll('#uxqRestoreProgressBtn,#uxqEditProfileBtn').forEach(btn => { btn.disabled = Boolean(busy); });
  }

  function previewHref() {
    const url = new URL('./csai2601-mission-control.html', location.href);
    url.searchParams.set('contentPreview', '1');
    url.searchParams.set('v', 'content-preview-v12-20261127');
    return url.pathname + url.search;
  }

  function renderProfileRequiredState() {
    clearRecoveryActions();
    setBusy(false);
    const progress = document.getElementById('progress');
    const title = document.getElementById('nextTitle');
    const desc = document.getElementById('nextDesc');
    const link = document.getElementById('nextLink');
    const grid = document.getElementById('grid');
    if (progress) progress.textContent = 'ยังไม่ได้ระบุผู้เรียน';
    if (title) title.textContent = 'กรุณาระบุข้อมูลผู้เรียน';
    if (desc) desc.textContent = 'ระบุรหัสนักศึกษา ชื่อ–นามสกุล และ Section เพื่อดึงความก้าวหน้าทางการจาก Google Sheet';
    if (link) {
      link.textContent = 'ระบุข้อมูลผู้เรียน →';
      link.href = '#';
      link.setAttribute('aria-disabled', 'false');
      link.onclick = async event => {
        event.preventDefault();
        const updated = await identity()?.open?.({ title: 'ระบุข้อมูลผู้เรียนเพื่อเข้าสู่เส้นทางรายวิชา', allowGuest: false });
        if (updated && identity()?.isComplete?.(updated)) {
          renderProfile();
          restore({ force: true }).catch(err => status(err.message || String(err), 'error'));
        }
      };
    }
    if (grid) {
      grid.innerHTML = '<div class="campaign-separator">กรุณากด “ระบุข้อมูลผู้เรียน” เพื่อโหลดความก้าวหน้าและปลดล็อกด่านจาก Google Sheet</div>';
    }
    const overview = document.getElementById('uxqStudioOverview');
    if (overview) {
      overview.innerHTML = '<h2>ความก้าวหน้ารายวิชา</h2><p>กรุณาระบุรหัสนักศึกษา ชื่อ–นามสกุล และ Section เพื่อตรวจสถานะ Mission, Studio Practice และ Weekly Reflection</p>';
    }
  }

  function renderErrorState(error) {
    clearRecoveryActions();
    const code = clean(error?.message || error || 'network_error', 180);
    const progress = document.getElementById('progress');
    const title = document.getElementById('nextTitle');
    const desc = document.getElementById('nextDesc');
    const link = document.getElementById('nextLink');
    const grid = document.getElementById('grid');

    if (progress) progress.textContent = 'ยังเชื่อมต่อ Google Sheet ไม่สำเร็จ';
    if (title) title.textContent = 'ยังเชื่อมต่อ Google Sheet ไม่สำเร็จ';
    if (desc) desc.textContent = `ระบบยังไม่ได้รับข้อมูลทางการจาก Sheet (${code}) และจะไม่สร้างความก้าวหน้าจากเครื่องนี้`;
    if (link) {
      link.textContent = 'ลองเชื่อมต่อ Sheet อีกครั้ง';
      link.href = '#';
      link.setAttribute('aria-disabled', 'false');
      link.onclick = event => {
        event.preventDefault();
        restore({ force: true }).catch(err => status(err.message || String(err), 'error'));
      };
      const host = link.parentElement;
      if (host) {
        const actions = document.createElement('div');
        actions.className = 'uxq-cloud-recovery-actions';
        actions.dataset.sheetRecoveryAction = '1';
        actions.innerHTML = `<a class="is-secondary" href="${previewHref()}">เปิด Content Preview (ดูเนื้อหาอย่างเดียว)</a>`;
        host.appendChild(actions);
      }
    }
    if (grid && !grid.querySelector('.campaign-preview')) {
      grid.innerHTML = `<div class="campaign-separator">ยังไม่ได้รับสถานะจาก Google Sheet • ${code.replace(/[&<>"']/g, '')}</div>`;
    }
  }

  function jsonpOnce(url) {
    return new Promise((resolve, reject) => {
      const callback = '__uxqSheetProgress_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const script = document.createElement('script');
      let settled = false;
      const timer = setTimeout(() => finish(new Error('หมดเวลารอข้อมูลจาก Sheet (60s)')), JSONP_TIMEOUT_MS);

      function finish(error, value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
        script.remove();
        error ? reject(error) : resolve(value);
      }

      window[callback] = value => finish(null, value);
      const u = new URL(url);
      u.searchParams.set('callback', callback);
      u.searchParams.set('_jsonp', String(Date.now()));
      script.async = true;
      script.src = u.href;
      script.onerror = () => finish(new Error('เชื่อมต่อ Apps Script แบบ JSONP ไม่สำเร็จ'));
      document.head.appendChild(script);
    });
  }

  async function request(profile, { force = false } = {}) {
    const cfg = config();
    if (!cfg.receiverUrl) throw new Error('ยังไม่ได้ตั้งค่า receiverUrl');
    const key = identityKey(profile);
    if (!force && inFlight.has(key)) return inFlight.get(key);

    const url = new URL(cfg.receiverUrl);
    url.searchParams.set('action', 'uxq_student_progress');
    url.searchParams.set('studentId', clean(profile.studentId, 80));
    url.searchParams.set('section', clean(profile.section, 80));
    url.searchParams.set('courseId', cfg.courseId || 'UXQ-ACT1-2026');
    url.searchParams.set('_', String(Date.now()));

    const promise = (async () => {
      try {
        return await jsonpOnce(url.href);
      } catch (firstError) {
        // Retry once on network glitch; do not retry after a full 60s timeout.
        if (/60s/i.test(String(firstError?.message || ''))) throw firstError;
        await new Promise(resolve => setTimeout(resolve, 900));
        url.searchParams.set('_', String(Date.now()));
        return await jsonpOnce(url.href);
      }
    })();

    inFlight.set(key, promise);
    try {
      return await promise;
    } finally {
      if (inFlight.get(key) === promise) inFlight.delete(key);
    }
  }

  function blankProgress() {
    const api = store();
    if (!api) throw new Error('UXQProgress ยังไม่พร้อม');
    api.resetQuest();
    return api.get();
  }

  function canonicalPassedIds(result) {
    const api = store();
    const order = api?.MISSION_IDS || ['w1','w2','w3','b1','w4','w5','w6','w7','b2','w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'];
    const diagList = result?.diagnostics?.canonicalPassedMissionIds;
    if (Array.isArray(diagList)) {
      return new Set(diagList.map(v => String(v || '').trim().toLowerCase()).filter(id => order.includes(id)));
    }
    const completedNodes = Math.max(0, Math.min(order.length, Number(result?.completedNodes || 0)));
    return new Set(order.slice(0, completedNodes));
  }

  function replaceFromSheet(result) {
    const api = store();
    if (!api) throw new Error('UXQProgress ยังไม่พร้อม');
    const progress = blankProgress();
    const missions = {};
    const officialPassed = canonicalPassedIds(result);

    Object.entries(result?.missions || {}).forEach(([rawId, remote]) => {
      const id = String(rawId || '').trim().toLowerCase();
      if (!api.MISSION_IDS.includes(id)) return;
      const isOfficialPass = officialPassed.has(id);
      const attempt = {
        completedAt: remote.lastCompletedAt || remote.completedAt || '',
        score: Number(remote.bestScore || remote.score || 0),
        stars: Number(remote.bestStars || remote.stars || 0),
        accuracy: Number(remote.bestAccuracy || remote.accuracy || 0),
        correct: Number(remote.bestCorrect || remote.correct || 0),
        total: Number(remote.total || 0),
        hints: Number(remote.hints || 0),
        durationSec: Number(remote.durationSec || 0),
        passed: isOfficialPass,
        badge: String(remote.badge || 'sheet restore')
      };
      missions[id] = {
        id,
        attempts: Math.max(1, Number(remote.attempts || 1)),
        completed: isOfficialPass,
        passed: isOfficialPass,
        bestScore: attempt.score,
        bestStars: attempt.stars,
        bestAccuracy: attempt.accuracy,
        bestCorrect: attempt.correct,
        lastResult: attempt,
        lastCompletedAt: attempt.completedAt,
        history: [attempt],
        sheetConfirmed: isOfficialPass,
        authority: 'google_sheet_canonical'
      };
    });

    progress.missions = missions;
    const saved = api.save(progress);
    try {
      localStorage.setItem(CACHE_META_KEY, JSON.stringify({
        source: 'sheet',
        studentId: result.studentId || '',
        section: result.section || '',
        completedNodes: officialPassed.size,
        syncedAt: new Date().toISOString(),
        diagnostics: result.diagnostics || null
      }));
    } catch (_) {}
    return saved;
  }

  async function restore({ silent = false, force = false } = {}) {
    const idApi = identity();
    if (!idApi) throw new Error('UXQIdentity ยังไม่พร้อม');
    let profile = idApi.get();
    if (!idApi.isComplete(profile)) {
      if (silent) {
        renderProfileRequiredState();
        return null;
      }
      profile = await idApi.open({ title: 'เข้าสู่ระบบผู้เรียนเพื่อดึงความก้าวหน้าจาก Sheet', allowGuest: false });
      if (!profile || !idApi.isComplete(profile)) {
        renderProfileRequiredState();
        return null;
      }
    }

    const token = ++activeToken;
    const expectedKey = identityKey(profile);
    clearRecoveryActions();
    setBusy(true);
    if (!silent) status('กำลังดึงความก้าวหน้าจาก Google Sheet…');

    const slowTimer = setTimeout(() => {
      if (token === activeToken) {
        status('Google Sheet กำลังประมวลผล (อาจใช้เวลา 10–30 วินาที) กรุณารอสักครู่…');
      }
    }, SLOW_NOTICE_MS);

    try {
      const result = await request(profile, { force });
      clearTimeout(slowTimer);
      if (token !== activeToken || identityKey(idApi.get()) !== expectedKey) return null;
      if (!result || !result.ok) throw new Error(result?.error || 'ไม่พบคำตอบที่ถูกต้องจาก Apps Script');

      lastFailed = false;
      clearRecoveryActions();
      try { replaceFromSheet(result); } catch (cacheError) {
        console.warn('[UXQCloudProgress] local cache sync skipped:', cacheError);
      }

      const passedCount = canonicalPassedIds(result).size;
      const next = String(result.nextMission || 'w1').toUpperCase();
      status(result.found
        ? `ดึงข้อมูลจาก Sheet แล้ว (Mission ผ่าน ${passedCount}/19 • ด่านถัดไป ${next})`
        : 'เชื่อมต่อ Sheet แล้ว • ยังไม่พบประวัติการเล่น (เริ่มที่ W1)', 'ok');
      renderProfile();
      window.UXQMissionSheetSnapshot = result;
      window.dispatchEvent(new CustomEvent('uxq-sheet-progress-restored', { detail: result }));
      return result;
    } catch (error) {
      clearTimeout(slowTimer);
      if (token !== activeToken) return null;
      lastFailed = true;
      renderErrorState(error);
      status('ดึงจาก Sheet ไม่สำเร็จ: ' + (error.message || error), 'error');
      window.dispatchEvent(new CustomEvent('uxq-sheet-progress-error', { detail: { error: String(error?.message || error), profile } }));
      throw error;
    } finally {
      if (token === activeToken) setBusy(false);
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
      const updated = await identity()?.open?.({ title: 'แก้ไขข้อมูลผู้เรียน', allowGuest: false });
      if (updated && identity()?.isComplete?.(updated)) {
        window.UXQMissionSheetSnapshot = null;
        try { store()?.resetQuest?.(); } catch (_) {}
        renderProfile();
        restore({ force: true }).catch(() => {});
      }
    });
    row.querySelector('#uxqRestoreProgressBtn').addEventListener('click', () => {
      restore({ force: true }).catch(() => {});
    });
    renderProfile();
  }

  async function boot() {
    if (booted) return;
    booted = true;
    mount();
    const idApi = identity();
    if (!idApi || !idApi.isComplete(idApi.get())) {
      renderProfileRequiredState();
      return;
    }
    try { await restore({ silent: true }); }
    catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else queueMicrotask(boot);

  window.addEventListener('uxq-profile-updated', renderProfile);
  window.addEventListener('online', () => {
    if (lastFailed && identity()?.isComplete?.(identity()?.get?.())) {
      restore({ silent: true, force: true }).catch(() => {});
    }
  });

  window.UXQCloudProgress = Object.freeze({ version: VERSION, request, restore, replaceFromSheet, boot });
  window.UXQMissionControlLoadRecoveryV1 = Object.freeze({ version: VERSION, restore: () => restore({ force: true }), boot });
})();