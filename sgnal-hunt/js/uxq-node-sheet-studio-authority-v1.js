/* CSAI2601 UX Quest • Node Sheet + Studio Authority v1.3
 * Google Sheet is authoritative in Student Mode.
 * Bare canonical URLs redirect to Mission Control. Studio restore uses finite
 * retries and events only; it never observes or rewrites the DOM continuously.
 */
(() => {
  'use strict';
  const q = new URLSearchParams(location.search || '');
  if (q.get('contentPreview') === '1' || /^content-preview/i.test(q.get('v') || '')) return;

  const requestedNode = String(q.get('node') || q.get('id') || '').trim();
  if (!requestedNode) {
    try {
      document.documentElement.style.visibility = 'hidden';
      document.documentElement.style.pointerEvents = 'none';
      document.body?.setAttribute('aria-busy', 'true');
      const target = new URL('./csai2601-mission-control.html', location.href);
      const section = q.get('section');
      const classroom = q.get('classroom');
      if (section) target.searchParams.set('section', section);
      if (classroom) target.searchParams.set('classroom', classroom);
      target.searchParams.set('v', 'student-runtime-v12-stable-20260731');
      location.replace(target.href);
    } catch (_) {
      location.href = './csai2601-mission-control.html?v=student-runtime-v12-stable-20260731';
    }
    return;
  }

  if (!document.querySelector('script[data-uxq-node-header-layout-final]')) {
    const layoutScript = document.createElement('script');
    layoutScript.src = './js/uxq-node-header-layout-final-authority-v1.js?v=node-header-layout-final-v1.5-20260731';
    layoutScript.async = false;
    layoutScript.dataset.uxqNodeHeaderLayoutFinal = '1';
    document.head.appendChild(layoutScript);
  }

  const NODE = requestedNode.toUpperCase();
  const KEY = NODE.toLowerCase();
  const CONFIG = window.UXQ_CLASSROOM_CONFIG || {};
  const ENDPOINT = String(CONFIG.receiverUrl || CONFIG.progressUrl || '').trim();
  let missionData = null;
  let studioData = null;
  let loading = false;

  const clean = (v, n = 160) => String(v == null ? '' : v).trim().slice(0, n);
  const identity = () => {
    let p = {};
    try { p = window.UXQIdentity?.get?.() || {}; } catch (_) {}
    return {
      studentId: clean(p.studentId || q.get('studentId') || q.get('sid'), 80),
      section: clean(p.section || q.get('section') || CONFIG.defaultSection, 80)
    };
  };

  function jsonp(action, extra = {}, timeout = 15000) {
    return new Promise((resolve, reject) => {
      if (!ENDPOINT) return reject(new Error('missing_receiver_url'));
      const cb = `uxqNodeSheet_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const s = document.createElement('script');
      let done = false;
      const finish = (err, data) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { delete window[cb]; } catch (_) { window[cb] = undefined; }
        s.remove();
        err ? reject(err) : resolve(data);
      };
      const timer = setTimeout(() => finish(new Error(`${action}_timeout`)), timeout);
      window[cb] = data => finish(null, data);
      s.onerror = () => finish(new Error(`${action}_network`));
      const learner = identity();
      const p = new URLSearchParams({
        action,
        studentId: learner.studentId,
        section: learner.section,
        courseId: CONFIG.courseId || 'UXQ-ACT1-2026',
        callback: cb,
        _: String(Date.now()),
        ...extra
      });
      s.src = `${ENDPOINT}${ENDPOINT.includes('?') ? '&' : '?'}${p}`;
      document.head.appendChild(s);
    });
  }

  function missionRow() {
    return missionData?.missions?.[KEY] || missionData?.missions?.[NODE] || {};
  }
  function missionPassed() {
    const r = missionRow();
    return Boolean(r.completed || r.passed || Number(r.bestStars || r.stars || 0) >= 2);
  }
  function studioRow() {
    const nodes = studioData?.nodes || {};
    return nodes[KEY] || nodes[NODE] || (studioData?.items || []).find(x => String(x.nodeId || x.missionId || '').toLowerCase() === KEY) || {};
  }
  function studioSubmitted(r) {
    return Boolean(r.submitted || r.artifactSubmitted || r.studioSubmitted || ['submitted','approved','need_revision','reviewing'].includes(String(r.reviewStatus || r.status || '').toLowerCase()));
  }
  function reflectionSubmitted(r) {
    return Boolean(r.reflectionSubmitted || r.hasReflection || clean(r.reflection, 5000).length);
  }

  function expose() {
    const r = missionRow();
    const sr = studioRow();
    window.UXQNodeSheetAuthority = Object.freeze({
      version: '20260731-NODE-SHEET-STUDIO-AUTHORITY-V1.3',
      nodeId: NODE,
      missionPassed: missionPassed(),
      mission: r,
      studioSubmitted: studioSubmitted(sr),
      reflectionSubmitted: reflectionSubmitted(sr),
      studio: sr,
      refresh
    });
    window.dispatchEvent(new CustomEvent('uxq-node-sheet-authority-ready', { detail: window.UXQNodeSheetAuthority }));
  }

  function forceStudio() {
    if (q.get('phase') !== 'studio' || !missionPassed()) return false;
    document.body.dataset.uxqMissionPass = '1';
    document.body.dataset.uxqRoutePhase = 'studio';
    try { sessionStorage.setItem(`csai2601.uxq.phase.${KEY}`, 'studio'); } catch (_) {}

    let tries = 0;
    const build = () => {
      tries += 1;
      try { window.UXQStudentStudioFinalAuthorityV2?.build?.(); } catch (_) {}
      try { window.UXQPostMissionStudioRouterV1?.ensureStudio?.(true); } catch (_) {}
      try { window.UXQNodeStudioContainerAuthorityV1?.build?.(); } catch (_) {}
      const studio = document.getElementById('uxqStudentStudioFinalV2') || document.querySelector('.artifact[data-studio-practice-v1],[data-studio-wizard],.uxq-pr');
      if (studio) {
        studio.removeAttribute('hidden');
        studio.style.setProperty('display', 'grid', 'important');
        document.getElementById('uxqStudioRouteFallback')?.remove();
        try { window.UXQStudioScrollFinalAuthorityV1?.refresh?.(); } catch (_) {}
        return true;
      }
      if (tries < 24) setTimeout(build, Math.min(180 + tries * 80, 900));
      return false;
    };
    return build();
  }

  function patchVisibleStatus() {
    if (!missionPassed()) return;
    document.querySelectorAll('*').forEach(el => {
      if (el.children.length) return;
      const t = clean(el.textContent, 200);
      if (/ผ่านในเครื่อง\s*•\s*รอ Sheet/i.test(t)) el.textContent = 'ยืนยันจาก Google Sheet แล้ว';
      if (/กำลังตรวจการยืนยันจาก Google Sheet/i.test(t)) el.textContent = 'Google Sheet ยืนยัน Mission แล้ว';
    });
    const r = studioRow();
    document.body.dataset.uxqSheetMission = '1';
    document.body.dataset.uxqSheetStudio = studioSubmitted(r) ? '1' : '0';
    document.body.dataset.uxqSheetReflection = reflectionSubmitted(r) ? '1' : '0';
  }

  function settle() {
    patchVisibleStatus();
    forceStudio();
  }

  async function refresh() {
    if (loading) return;
    const learner = identity();
    if (!learner.studentId || !learner.section || !ENDPOINT) return;
    loading = true;
    try {
      const [m, s] = await Promise.all([
        jsonp('uxq_student_progress'),
        jsonp('uxq_student_studio_progress')
      ]);
      if (m?.ok) missionData = m;
      if (s?.ok) studioData = s;
      expose();
      settle();
    } catch (err) {
      console.error('[UXQ node Sheet authority]', err);
    } finally {
      loading = false;
    }
  }

  const boot = () => {
    refresh();
    [500, 1200, 2500, 5000].forEach(ms => setTimeout(refresh, ms));
    [120, 420, 900, 1800, 3600].forEach(ms => setTimeout(settle, ms));
  };

  window.addEventListener('uxq-identity-changed', refresh);
  window.addEventListener('uxq-sheet-progress-restored', refresh);
  window.addEventListener('online', refresh);
  ['uxq-progress-updated','uxq-studio-artifact-dispatched','uxq-studio-container-ready']
    .forEach(name => window.addEventListener(name, settle));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
