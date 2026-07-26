/* CSAI2601 UX Quest • Direct Studio Entry v2
 * ?view=studio|reflection verifies the official mission progress endpoint.
 * Google Sheet mission_completed is the sole authority for opening Studio.
 */
(() => {
  'use strict';

  const VERSION = '20260726-DIRECT-STUDIO-ENTRY-V2-OFFICIAL-PROGRESS';
  const params = new URLSearchParams(location.search || '');
  const view = String(params.get('view') || '').trim().toLowerCase();
  if (!['studio', 'reflection'].includes(view)) return;

  const nodeId = String(params.get('node') || params.get('id') || 'W1').trim().toUpperCase();
  const nodeKey = nodeId.toLowerCase();
  const root = document.getElementById('uxqCanonicalNode');
  const clean = (value, max = 500) => String(value == null ? '' : value).trim().slice(0, max);
  const config = () => window.UXQ_CLASSROOM_CONFIG || {};
  let finished = false;

  document.documentElement.dataset.uxqDirectStudio = 'loading';

  const style = document.createElement('style');
  style.textContent = `
    html[data-uxq-direct-studio='loading'] #uxqCanonicalNode{visibility:hidden}
    .uxq-direct-loading{min-height:100vh;display:grid;place-items:center;background:#071124;color:#eef6ff;font-family:system-ui}
    .uxq-direct-loading section{max-width:680px;padding:30px;text-align:center}
    .uxq-direct-loading h1{font-size:clamp(1.6rem,5vw,2.8rem)}
    .uxq-direct-loading p{color:#b9c9e4;line-height:1.65}
  `;
  document.head.appendChild(style);

  const loading = document.createElement('div');
  loading.className = 'uxq-direct-loading';
  loading.innerHTML = `<section><p>กำลังตรวจ Google Sheet</p><h1>กำลังเปิด ${view === 'reflection' ? 'Weekly Reflection' : 'Studio Practice'} • ${nodeId}</h1><p>ตรวจสถานะ Mission จากระบบทางการ นักศึกษาไม่ต้องเล่นซ้ำเมื่อผ่านแล้ว</p></section>`;
  document.body.appendChild(loading);

  function profile() {
    let saved = {};
    try { saved = window.UXQIdentity?.get?.() || {}; } catch (_) {}
    return {
      studentId: clean(saved.studentId || params.get('studentId') || params.get('sid'), 80),
      section: clean(saved.section || params.get('section') || config().defaultSection, 80)
    };
  }

  function receiverUrl() {
    return clean(config().progressUrl || config().receiverUrl || '', 800);
  }

  function missionRow(data) {
    const missions = data?.missions || {};
    return missions[nodeKey] || missions[nodeId] || {};
  }

  function officiallyPassed(data) {
    const canonical = data?.diagnostics?.canonicalPassedMissionIds;
    if (Array.isArray(canonical) && canonical.map(value => String(value).toLowerCase()).includes(nodeKey)) return true;

    const raw = data?.diagnostics?.rawPassedMissionIds;
    if (Array.isArray(raw) && raw.map(value => String(value).toLowerCase()).includes(nodeKey)) return true;

    const row = missionRow(data);
    return Boolean(
      row.completed ||
      row.passed ||
      Number(row.bestStars || row.stars || 0) >= 2
    );
  }

  function reveal(error = '') {
    finished = true;
    loading.remove();
    document.documentElement.dataset.uxqDirectStudio = error ? 'error' : 'ready';
    if (root) root.style.visibility = '';
    if (error && root) {
      root.innerHTML = `<div class="uxq-direct-loading"><section><h1>ยังเปิด ${view === 'reflection' ? 'Weekly Reflection' : 'Studio Practice'} ไม่ได้</h1><p>${error}</p><p><a href="./csai2601-mission-control.html" style="color:#6ee7ff">กลับ Mission Control</a></p></section></div>`;
    }
  }

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const callback = `UXQDirectOfficial_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const timer = setTimeout(() => done(new Error('หมดเวลารอ Google Sheet')), 12000);

      function done(error, data) {
        clearTimeout(timer);
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
        script.remove();
        error ? reject(error) : resolve(data);
      }

      window[callback] = data => done(null, data);
      script.onerror = () => done(new Error('เชื่อม Google Sheet ไม่สำเร็จ'));

      const learner = profile();
      const query = new URLSearchParams({
        action: 'uxq_student_progress',
        studentId: learner.studentId,
        section: learner.section,
        courseId: clean(config().courseId || 'UXQ-ACT1-2026', 120),
        callback,
        _: Date.now()
      });
      script.src = `${url}${url.includes('?') ? '&' : '?'}${query}`;
      document.head.appendChild(script);
    });
  }

  async function run() {
    const learner = profile();
    const endpoint = receiverUrl();
    if (!learner.studentId || !learner.section) return reveal('ข้อมูลผู้เรียนหรือ Section ไม่ครบ');
    if (!endpoint) return reveal('ยังไม่ได้ตั้งค่า Receiver');

    try {
      const data = await jsonp(endpoint);
      if (!data?.ok) return reveal(data?.error || 'Google Sheet ตอบกลับไม่สมบูรณ์');
      if (!officiallyPassed(data)) return reveal(`Google Sheet ยังไม่ยืนยันผล Mission ของ ${nodeId} อย่างน้อย 2 ดาว`);

      window.UXQDirectStudioConfirmed = {
        nodeId,
        nodeKey,
        view,
        data,
        mission: missionRow(data),
        confirmed: true,
        authority: 'uxq_student_progress',
        version: VERSION
      };
      window.dispatchEvent(new CustomEvent('uxq-direct-studio-confirmed', { detail: window.UXQDirectStudioConfirmed }));

      setTimeout(() => {
        if (!finished && document.documentElement.dataset.uxqDirectStudio === 'loading') {
          reveal('โหลด Studio Practice ไม่สำเร็จ กรุณากลับ Mission Control แล้วลองใหม่');
        }
      }, 10000);
    } catch (error) {
      reveal(error?.message || String(error));
    }
  }

  window.addEventListener('uxq-mission-resume-studio', () => reveal());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();

  window.UXQDirectStudioEntryV1 = Object.freeze({ view, nodeId, version: VERSION });
})();