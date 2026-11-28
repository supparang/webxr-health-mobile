/* CSAI2601 UX Quest • Sheet-Authoritative Unlock Guard v3.4
 * Official student mode: previous node must be confirmed by Google Sheet.
 * Instructor content preview: ?contentPreview=1 bypasses Sheet unlock only for frontend QA.
 * v3.4: uses a non-destructive checking overlay (never clobbered by node player), respects
 * diagnostics.canonicalPassedMissionIds, supports slow 60s Sheet + 1 retry + manual retry CTA.
 */
(() => {
  'use strict';
  const VERSION = '20261127-SHEET-AUTHORITATIVE-UNLOCK-V3.4-OVERLAY';
  const ORDER = ['w1','w2','w3','b1','w4','w5','w6','w7','b2','w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'];
  const OVERLAY_ID = 'uxqUnlockCheckingOverlay';
  const params = new URLSearchParams(location.search || '');
  const node = String(params.get('node') || params.get('id') || 'w1').trim().toLowerCase();
  const index = ORDER.indexOf(node);
  if (index < 0) return;

  const preview = params.get('contentPreview') === '1' || /^content-preview/i.test(params.get('v') || '');
  const root = document.getElementById('uxqCanonicalNode') || document.body;
  const config = window.UXQ_CLASSROOM_CONFIG || {};
  const clean = (v, m = 500) => String(v == null ? '' : v).trim().slice(0, m);
  const esc = v => clean(v, 500).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const number = v => Number.isFinite(Number(v)) ? Number(v) : 0;

  if (preview) {
    document.body.dataset.uxqThreePartLocked = '0';
    document.body.dataset.uxqContentPreview = '1';
    window.dispatchEvent(new CustomEvent('uxq-content-preview-active', { detail: { node, version: VERSION } }));
    window.UXQThreePartUnlockGuard = Object.freeze({ version: VERSION, preview: true, run: async () => true });
    return;
  }

  function identity() {
    let p = {};
    try { p = window.UXQIdentity?.get?.() || {}; } catch (_) {}
    return {
      studentId: clean(p.studentId || params.get('studentId') || params.get('sid'), 80),
      studentName: clean(p.studentName || params.get('studentName') || params.get('name'), 120),
      section: clean(p.section || params.get('section') || config.defaultSection, 80)
    };
  }

  function endpoint() {
    return clean(config.receiverUrl || config.progressUrl || '', 800);
  }

  function jsonpOnce(url) {
    return new Promise((resolve, reject) => {
      const cb = `uxqUnlock_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const s = document.createElement('script');
      let settled = false;
      const t = setTimeout(() => done(new Error('unlock_timeout_60s')), 60000);
      function done(err, data) {
        if (settled) return;
        settled = true;
        clearTimeout(t);
        try { delete window[cb]; } catch (_) { window[cb] = undefined; }
        s.remove();
        err ? reject(err) : resolve(data);
      }
      window[cb] = d => done(null, d);
      s.onerror = () => done(new Error('unlock_network'));
      const i = identity();
      const q = new URLSearchParams({
        action: 'uxq_student_progress',
        studentId: i.studentId,
        section: i.section,
        courseId: clean(config.courseId || 'UXQ-ACT1-2026', 120),
        callback: cb,
        _: Date.now()
      });
      s.async = true;
      s.src = `${url}${url.includes('?') ? '&' : '?'}${q}`;
      document.head.appendChild(s);
    });
  }

  async function jsonp(url) {
    try {
      return await jsonpOnce(url);
    } catch (err) {
      if (/timeout_60s/i.test(String(err?.message || ''))) throw err;
      await new Promise(resolve => setTimeout(resolve, 900));
      return await jsonpOnce(url);
    }
  }

  function missionRow(data, id) {
    return data?.missions?.[id] || data?.missions?.[id.toUpperCase()] ||
      data?.items?.find?.(x => String(x.nodeId || x.missionId || '').toLowerCase() === id) || {};
  }

  function previousMissionPassed(data, prev) {
    const diagList = data?.diagnostics?.canonicalPassedMissionIds;
    if (Array.isArray(diagList)) {
      return diagList.map(v => String(v || '').trim().toLowerCase()).includes(prev);
    }
    const row = missionRow(data, prev);
    const stars = Math.max(number(row.bestStars), number(row.stars), number(row.missionStars));
    return Boolean(row.completed || row.passed || row.missionCompleted || row.eventType === 'mission_completed' || stars >= 2);
  }

  function contextUrl(path) {
    const url = new URL(path, location.href);
    const i = identity();
    if (i.studentId) url.searchParams.set('studentId', i.studentId);
    if (i.studentName) url.searchParams.set('studentName', i.studentName);
    if (i.section) url.searchParams.set('section', i.section);
    ['device', 'courseId', 'classroom'].forEach(k => {
      const v = params.get(k);
      if (v) url.searchParams.set(k, v);
    });
    url.searchParams.set('v', 'sheet-authoritative-unlock-v3-4-20261127');
    return `${url.pathname}${url.search}`;
  }

  function removeOverlay() {
    document.getElementById(OVERLAY_ID)?.remove();
  }

  function showChecking(previous) {
    removeOverlay();
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99990;background:#071124;color:#eef6ff;font-family:system-ui,sans-serif;padding:28px;overflow:auto';
    overlay.innerHTML = `<section style="max-width:820px;margin:40px auto;border:1px solid rgba(110,231,255,.4);border-radius:22px;padding:28px;background:linear-gradient(150deg,#18233f,#09152e)">
      <p style="color:#6ee7ff;font-weight:900;letter-spacing:.08em;margin:0">กำลังตรวจสอบจาก Google Sheet</p>
      <h1 style="font-size:clamp(1.8rem,5vw,3rem);margin:.25em 0">กำลังตรวจสิทธิ์เข้า ${esc(node.toUpperCase())}</h1>
      <p style="color:#c7d5ee;line-height:1.7">กำลังยืนยันผล ${esc(previous.toUpperCase())} จากข้อมูลทางการ กรุณารอสักครู่ (Google Sheet อาจใช้เวลา 5–20 วินาที)</p>
      <a href="${esc(contextUrl('./csai2601-mission-control.html'))}" style="display:inline-block;margin-top:14px;padding:10px 15px;border-radius:11px;border:1px solid rgba(255,255,255,.32);color:#eaf3ff;text-decoration:none;font-weight:800">← กลับ Mission Control</a>
    </section>`;
    document.body.appendChild(overlay);
  }

  function showLocked(previous, error, data) {
    removeOverlay();
    const diagnostic = clean(data?.diagnostics?.policy || data?.error || '', 180);
    const isNetworkError = Boolean(error);
    root.innerHTML = `<div style="min-height:100vh;background:#071124;color:#eef6ff;font-family:system-ui,sans-serif;padding:28px"><section style="max-width:820px;margin:40px auto;border:1px solid rgba(255,209,102,.5);border-radius:22px;padding:28px;background:linear-gradient(150deg,#18233f,#09152e)">
      <p style="color:#ffd166;font-weight:900;letter-spacing:.08em;margin:0">SHEET-AUTHORITATIVE UNLOCK</p>
      <h1 style="font-size:clamp(2rem,5vw,3.4rem);margin:.2em 0">${esc(node.toUpperCase())} ยังล็อกอยู่</h1>
      <p style="color:#c7d5ee;line-height:1.7">Google Sheet ยังไม่ยืนยันว่า ${esc(previous.toUpperCase())} ผ่าน Mission แล้ว ต้องได้อย่างน้อย 2/3 ดาวและมีรายการ mission_completed ก่อน</p>
      <div style="padding:14px;border-radius:14px;border:1px solid #f87171;margin:20px 0">Mission ${esc(previous.toUpperCase())} • ยังไม่ยืนยันจาก Sheet</div>
      <p style="color:#ffd6a0">${error ? `ตรวจสถานะจาก Sheet ไม่สำเร็จ: ${esc(error)}` : 'ระบบตรวจจาก Official Student Progress แล้ว แต่ยังไม่พบผลผ่านของด่านก่อนหน้า'}${diagnostic ? `<br><small>${esc(diagnostic)}</small>` : ''}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
        ${isNetworkError ? '<button type="button" id="uxqUnlockRetryBtn" style="padding:12px 16px;border:0;border-radius:12px;background:#6ee7ff;color:#071124;font:inherit;font-weight:900;cursor:pointer">ลองตรวจสอบจาก Sheet อีกครั้ง</button>' : ''}
        <a href="${esc(contextUrl(`./csai2601-canonical-node-clean-v1.html?node=${previous.toUpperCase()}&replay=1`))}" style="display:inline-block;padding:12px 16px;border-radius:12px;background:${isNetworkError ? 'transparent' : '#6ee7ff'};color:${isNetworkError ? '#eef6ff' : '#071124'};border:${isNetworkError ? '1px solid rgba(255,255,255,.35)' : '0'};text-decoration:none;font-weight:900">กลับไปตรวจ/ฝึก ${esc(previous.toUpperCase())} →</a>
        <a href="${esc(contextUrl('./csai2601-mission-control.html'))}" style="display:inline-block;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,.35);color:#eef6ff;text-decoration:none;font-weight:900">กลับ Mission Control</a>
      </div>
    </section></div>`;
    root.querySelector('#uxqUnlockRetryBtn')?.addEventListener('click', () => run());
    document.body.dataset.uxqThreePartLocked = '1';
  }

  async function run() {
    if (index === 0) {
      document.body.dataset.uxqThreePartLocked = '0';
      removeOverlay();
      return true;
    }
    const prev = ORDER[index - 1];
    const i = identity();
    const ep = endpoint();
    if (!i.studentId || !i.section || !ep) {
      showLocked(prev, 'ยังไม่มี Identity หรือ Receiver endpoint');
      return false;
    }
    showChecking(prev);
    try {
      const data = await jsonp(ep);
      if (!data || data.ok === false) {
        showLocked(prev, clean(data?.error || 'progress_response_invalid', 180), data);
        return false;
      }
      if (previousMissionPassed(data, prev)) {
        document.body.dataset.uxqThreePartLocked = '0';
        removeOverlay();
        window.dispatchEvent(new CustomEvent('uxq-sheet-unlock-confirmed', {
          detail: { node, previous: prev, mission: true, row: missionRow(data, prev), data }
        }));
        return true;
      }
      showLocked(prev, '', data);
      return false;
    } catch (e) {
      showLocked(prev, e.message || e);
      return false;
    }
  }

  run();
  window.UXQThreePartUnlockGuard = Object.freeze({ version: VERSION, preview: false, run });
})();