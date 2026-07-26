/* CSAI2601 UX Quest • Direct Studio Entry v4
 * ?view=studio|reflection verifies official Mission and Studio/Reflection progress.
 * ?review=1 bootstraps Studio renderer directly in read-only mode.
 * Completed 3/3 nodes redirect to review only from normal Studio entry, never from review itself.
 */
(() => {
  'use strict';

  const VERSION = '20260726-DIRECT-STUDIO-ENTRY-V4-REVIEW-BOOTSTRAP';
  const params = new URLSearchParams(location.search || '');
  const reviewMode = params.get('review') === '1';
  const requestedView = String(params.get('view') || '').trim().toLowerCase();
  const view = requestedView || (reviewMode ? 'studio' : '');
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
  loading.innerHTML = `<section><p>กำลังตรวจ Google Sheet</p><h1>กำลังเปิด ${reviewMode ? 'ผลงานที่ส่งแล้ว' : (view === 'reflection' ? 'Weekly Reflection' : 'Studio Practice')} • ${nodeId}</h1><p>ระบบกำลังตรวจ Mission, Studio และ Reflection จากแหล่งข้อมูลทางการ</p></section>`;
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

  function studioRow(data) {
    return data?.nodes?.[nodeKey] || data?.nodes?.[nodeId] ||
      data?.items?.find?.(item => String(item.nodeId || item.missionId || '').toLowerCase() === nodeKey) || {};
  }

  function officiallyPassed(data) {
    const canonical = data?.diagnostics?.canonicalPassedMissionIds;
    if (Array.isArray(canonical) && canonical.map(value => String(value).toLowerCase()).includes(nodeKey)) return true;
    const raw = data?.diagnostics?.rawPassedMissionIds;
    if (Array.isArray(raw) && raw.map(value => String(value).toLowerCase()).includes(nodeKey)) return true;
    const row = missionRow(data);
    return Boolean(row.completed || row.passed || Number(row.bestStars || row.stars || 0) >= 2);
  }

  function studioDone(row) {
    return Boolean(
      row.submitted || row.artifactSubmitted || row.studioSubmitted ||
      ['submitted','approved','need_revision','reviewing'].includes(String(row.reviewStatus || row.status || '').toLowerCase())
    );
  }

  function reflectionDone(row) {
    return Boolean(row.reflectionSubmitted || row.hasReflection || clean(row.reflection || '', 5000).length > 0);
  }

  function reveal(error = '') {
    finished = true;
    loading.remove();
    document.documentElement.dataset.uxqDirectStudio = error ? 'error' : 'ready';
    if (root) root.style.visibility = '';
    if (error && root) {
      root.innerHTML = `<div class="uxq-direct-loading"><section><h1>ยังเปิด ${reviewMode ? 'ผลงานที่ส่งแล้ว' : (view === 'reflection' ? 'Weekly Reflection' : 'Studio Practice')} ไม่ได้</h1><p>${error}</p><p><a href="./csai2601-mission-control.html" style="color:#6ee7ff">กลับ Mission Control</a></p></section></div>`;
    }
  }

  function jsonp(url, action) {
    return new Promise((resolve, reject) => {
      const callback = `UXQDirect_${action}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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
        action,
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

  function redirectToReview() {
    const url = new URL(location.href);
    url.searchParams.delete('view');
    url.searchParams.set('review', '1');
    url.searchParams.set('complete', '1');
    url.searchParams.set('v', 'review-bootstrap-v5-20260726');
    location.replace(url.href);
  }

  function publishConfirmed(missionData, studioData, confirmedStudio, confirmedReflection) {
    window.UXQDirectStudioConfirmed = {
      nodeId,
      nodeKey,
      view,
      reviewMode,
      readOnly: reviewMode,
      missionData,
      studioData,
      studioDone: confirmedStudio,
      reflectionDone: confirmedReflection,
      mission: missionRow(missionData),
      studio: studioRow(studioData),
      confirmed: true,
      authority: 'uxq_student_progress+uxq_student_studio_progress',
      version: VERSION
    };
    window.dispatchEvent(new CustomEvent('uxq-direct-studio-confirmed', { detail: window.UXQDirectStudioConfirmed }));
  }

  async function run() {
    const learner = profile();
    const endpoint = receiverUrl();
    if (!learner.studentId || !learner.section) return reveal('ข้อมูลผู้เรียนหรือ Section ไม่ครบ');
    if (!endpoint) return reveal('ยังไม่ได้ตั้งค่า Receiver');

    try {
      const [missionData, studioData] = await Promise.all([
        jsonp(endpoint, 'uxq_student_progress'),
        jsonp(endpoint, 'uxq_student_studio_progress')
      ]);

      if (!missionData?.ok) return reveal(missionData?.error || 'Google Sheet ตอบกลับ Mission ไม่สมบูรณ์');
      if (!officiallyPassed(missionData)) return reveal(`Google Sheet ยังไม่ยืนยันผล Mission ของ ${nodeId} อย่างน้อย 2 ดาว`);

      const row = studioRow(studioData);
      const confirmedStudio = Boolean(studioData?.ok && studioDone(row));
      const confirmedReflection = Boolean(studioData?.ok && reflectionDone(row));

      if (confirmedStudio && confirmedReflection && !reviewMode) {
        redirectToReview();
        return;
      }

      if (reviewMode && !(confirmedStudio && confirmedReflection)) {
        return reveal(`Google Sheet ยังไม่พบ Studio Practice และ Weekly Reflection ที่ยืนยันครบของ ${nodeId}`);
      }

      publishConfirmed(missionData, studioData, confirmedStudio, confirmedReflection);

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
  window.addEventListener('uxq-studio-practice-ready', () => {
    if (reviewMode) reveal();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();

  window.UXQDirectStudioEntryV1 = Object.freeze({ view, nodeId, reviewMode, version: VERSION });
})();