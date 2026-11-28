/* CSAI2601 UX Quest • Three-Part Restore Authority v1.6
 * Google Sheet remains the sole official authority.
 * Mission completion is authoritative ONLY from diagnostics.canonicalPassedMissionIds.
 * Full completion & next-node unlock = contiguous Mission + Studio Practice + Weekly Reflection (3/3).
 * v1.6: single-flight studio JSONP (60s slow-Sheet tolerant + 1 retry), normalized identity check,
 * full Course Progress + Student Timeline UI, no duplicate requests or DOM observer loops.
 */
(() => {
  'use strict';

  const ORDER = ['w1','w2','w3','b1','w4','w5','w6','w7','b2','w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'];
  const VERSION = '20261127-THREE-PART-RESTORE-AUTHORITY-V1.6-UNIFIED';
  const JSONP_TIMEOUT_MS = 60000;

  let missionSnapshot = window.UXQMissionSheetSnapshot || null;
  let activeToken = 0;
  let lastIdentityKey = '';
  const inFlight = new Map();

  const text = (value, max = 500) => String(value == null ? '' : value).trim().slice(0, max);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const normToken = (value, max = 80) => {
    let s = text(value, max);
    if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, '');
    return s.toLowerCase();
  };

  const profile = () => {
    let value = {};
    try { value = window.UXQIdentity?.get?.() || {}; } catch (_) {}
    return {
      studentId: text(value.studentId, 80),
      studentName: text(value.studentName, 120),
      section: text(value.section, 80)
    };
  };
  const identityKey = p => `${normToken(p?.studentId, 80)}|${normToken(p?.section, 80)}`;
  const receiverUrl = () => text(window.UXQ_CLASSROOM_CONFIG?.receiverUrl || '', 900);

  function installStyle() {
    if (document.getElementById('uxq-studio-status-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-studio-status-style';
    style.textContent = `
      .studio-overview{margin:18px 0;border:1px solid rgba(110,231,255,.32);border-radius:22px;padding:18px;background:linear-gradient(145deg,rgba(16,31,61,.96),rgba(7,17,36,.98));color:#eef6ff;box-shadow:0 18px 46px rgba(0,0,0,.18)}
      .studio-overview h2{margin:0}.studio-overview p{color:#aebedb;line-height:1.55;margin:6px 0 0}
      .studio-overview button#uxqThreePartRetry{margin-top:12px;min-height:42px;padding:9px 15px;border:0;border-radius:11px;background:#6ee7ff;color:#071124;font:inherit;font-weight:900;cursor:pointer}
      .course-primary{margin-top:14px;border:1px solid rgba(121,237,165,.34);border-radius:18px;padding:16px;background:linear-gradient(145deg,rgba(25,80,62,.34),rgba(4,18,36,.5));display:grid;grid-template-columns:minmax(180px,.8fr) 2fr;gap:16px;align-items:center}
      .course-primary__value small{display:block;color:#b7c9e8;font-weight:750}.course-primary__value strong{display:block;font-size:clamp(2rem,5vw,3.4rem);line-height:1;color:#fff;margin:5px 0}.course-primary__value span{color:#79eda5;font-weight:850}
      .course-bar{height:13px;background:rgba(255,255,255,.1);border-radius:999px;overflow:hidden}.course-bar i{display:block;height:100%;background:linear-gradient(90deg,#6ee7ff,#79eda5);border-radius:inherit}.course-primary__next{margin-top:9px;color:#d8e7ff;line-height:1.5}
      .studio-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:12px}.studio-summary span{border:1px solid rgba(181,205,255,.22);border-radius:14px;padding:11px;color:#b9c9e4;background:rgba(3,13,31,.38)}.studio-summary b{display:block;color:#fff;font-size:1.08rem;margin-top:3px}.studio-summary .bad{color:#ffb0bd}.studio-summary .good{color:#79eda5}
      .uxq-progress-note{margin-top:10px;padding:10px 12px;border:1px solid rgba(255,209,102,.32);border-radius:12px;background:rgba(255,209,102,.08);color:#ffe4a0;font-size:.82rem}
      .student-timeline{margin-top:16px;border-top:1px solid rgba(181,205,255,.18);padding-top:15px}.student-timeline__head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}.student-timeline__head h3{margin:0}.student-timeline__list{display:grid;gap:7px;max-height:360px;overflow:auto;padding-right:4px}
      .timeline-row{display:grid;grid-template-columns:54px 1fr auto;gap:10px;align-items:center;border:1px solid rgba(181,205,255,.17);border-radius:13px;padding:9px 10px;background:rgba(3,13,31,.3)}.timeline-row.is-current{border-color:rgba(110,231,255,.58);background:rgba(110,231,255,.08)}.timeline-row.is-complete{border-color:rgba(121,237,165,.38)}.timeline-row.is-locked{opacity:.53}.timeline-row__id{font-weight:950}.timeline-row__steps{display:flex;gap:5px;flex-wrap:wrap}.timeline-step{border:1px solid rgba(181,205,255,.2);border-radius:999px;padding:3px 7px;font-size:.72rem;color:#8294b8}.timeline-step.done{color:#79eda5;border-color:rgba(121,237,165,.42)}.timeline-row__action{color:#6ee7ff;text-decoration:none;font-size:.78rem;font-weight:850}.timeline-row__action[aria-disabled='true']{color:#8294b8;pointer-events:none}
      .studio-node-status{margin-top:9px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;font-size:.72rem}.studio-node-status span{border:1px solid rgba(181,205,255,.2);border-radius:999px;padding:4px 7px;text-align:center;color:#8294b8}.studio-node-status span.done{color:#79eda5;border-color:rgba(121,237,165,.45);background:rgba(121,237,165,.08)}
      .campaign-preview[data-node-complete='1']{outline:2px solid rgba(121,237,165,.34)}.campaign-preview[data-three-part-locked='1']{opacity:.5;filter:saturate(.55)}.campaign-preview[data-three-part-locked='1'] .campaign-launch{pointer-events:none;opacity:.45}.three-part-lock-note{margin-top:7px;color:#ffd166;font-size:.76rem}.node-next-note{margin-top:7px;color:#cbd9f2;font-size:.77rem;line-height:1.4}.campaign-launch.uxq-primary-action{background:#6ee7ff!important;color:#071124!important;border-radius:10px;padding:7px 10px!important;font-weight:900!important;text-decoration:none!important}
      @media(max-width:760px){.course-primary{grid-template-columns:1fr}.studio-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.studio-node-status{grid-template-columns:1fr}.timeline-row{grid-template-columns:46px 1fr}.timeline-row__action{grid-column:2}}
    `;
    document.head.appendChild(style);
  }

  function overview() {
    installStyle();
    let box = document.getElementById('uxqStudioOverview');
    if (box) return box;
    const anchor = document.querySelector('.overview-grid');
    if (!anchor) return null;
    box = document.createElement('section');
    box.id = 'uxqStudioOverview';
    box.className = 'studio-overview';
    anchor.insertAdjacentElement('afterend', box);
    return box;
  }

  function setHero(title, description, buttonLabel, disabled = true, href = '#') {
    const titleEl = document.getElementById('nextTitle');
    const descEl = document.getElementById('nextDesc');
    const link = document.getElementById('nextLink');
    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = description;
    if (link) {
      link.textContent = buttonLabel;
      link.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      link.href = disabled ? '#' : href;
      link.onclick = disabled ? event => event.preventDefault() : null;
    }
  }

  function clearStaleUI(p) {
    const box = overview();
    if (box) {
      box.dataset.identityKey = identityKey(p);
      box.innerHTML = `<h2>กำลังตรวจความก้าวหน้ารายวิชา</h2><p>กำลังโหลด Mission, Studio Practice และ Weekly Reflection ของผู้เรียนปัจจุบันจาก Google Sheet…</p><div class="studio-summary"><span>Mission<b>—/19</b></span><span>Studio<b>—/19</b></span><span>Reflection<b>—/19</b></span><span>Course Complete<b>—/19</b></span></div>`;
    }
    window.UXQStudioProgress = null;
    window.UXQCombinedCourseProgress = null;
  }

  function jsonpOnce(url) {
    return new Promise((resolve, reject) => {
      const callbackName = `__uxqThreePart_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      let settled = false;
      const timer = setTimeout(() => done(new Error('studio_progress_timeout_60s')), JSONP_TIMEOUT_MS);
      function done(error, data) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
        script.remove();
        error ? reject(error) : resolve(data);
      }
      const u = new URL(url);
      u.searchParams.set('callback', callbackName);
      u.searchParams.set('_', String(Date.now()));
      window[callbackName] = data => done(null, data);
      script.onerror = () => done(new Error('studio_progress_network'));
      script.async = true;
      script.src = u.href;
      document.head.appendChild(script);
    });
  }

  async function requestStudio(p, { force = false } = {}) {
    const base = receiverUrl();
    if (!base) throw new Error('receiver_url_missing');
    const key = identityKey(p);
    if (!force && inFlight.has(key)) return inFlight.get(key);

    const url = new URL(base);
    url.searchParams.set('action', 'uxq_student_studio_progress');
    url.searchParams.set('studentId', p.studentId);
    url.searchParams.set('section', p.section);
    url.searchParams.set('courseId', window.UXQ_CLASSROOM_CONFIG?.courseId || 'UXQ-ACT1-2026');

    const promise = (async () => {
      try {
        return await jsonpOnce(url.href);
      } catch (firstError) {
        if (/timeout_60s/i.test(String(firstError?.message || ''))) throw firstError;
        await new Promise(resolve => setTimeout(resolve, 900));
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

  function canonicalPassedSet() {
    const list = missionSnapshot?.diagnostics?.canonicalPassedMissionIds;
    if (Array.isArray(list)) {
      return new Set(list.map(v => String(v || '').trim().toLowerCase()).filter(id => ORDER.includes(id)));
    }
    const completedNodes = Math.max(0, Math.min(ORDER.length, Number(missionSnapshot?.completedNodes || 0)));
    if (completedNodes > 0) return new Set(ORDER.slice(0, completedNodes));
    const next = String(missionSnapshot?.nextMission || '').trim().toLowerCase();
    const nextIdx = ORDER.indexOf(next);
    return new Set(nextIdx > 0 ? ORDER.slice(0, nextIdx) : []);
  }

  const missionPassed = id => canonicalPassedSet().has(String(id || '').trim().toLowerCase());

  function studioRow(snapshot, id) {
    const nodes = snapshot?.nodes || {};
    return nodes[id] || nodes[id.toUpperCase()] ||
      (Array.isArray(snapshot?.items) ? snapshot.items.find(item => String(item.nodeId || item.missionId || '').toLowerCase() === id) : null) || {};
  }

  function stateFor(snapshot, id) {
    const row = studioRow(snapshot, id);
    const mission = missionPassed(id);
    const statusText = text(row.reviewStatus || row.status, 40).toLowerCase();
    const studio = Boolean(
      row.submitted || row.artifactSubmitted || row.studioSubmitted ||
      ['submitted', 'approved', 'need_revision', 'reviewing'].includes(statusText)
    );
    const reflection = Boolean(row.reflectionSubmitted || row.hasReflection || text(row.reflection, 5000).length > 0);
    return {
      id,
      mission,
      studio,
      reflection,
      complete: Boolean(mission && studio && reflection),
      reviewStatus: statusText || 'not_submitted',
      projectId: text(row.projectId || '', 160)
    };
  }

  function nodeHref(state) {
    const url = new URL('./csai2601-canonical-node-clean-v1.html', location.href);
    url.searchParams.set('node', state.id.toUpperCase());
    const p = profile();
    if (p.studentId) url.searchParams.set('studentId', p.studentId);
    if (p.studentName) url.searchParams.set('studentName', p.studentName);
    if (p.section) url.searchParams.set('section', p.section);
    url.searchParams.set('courseId', window.UXQ_CLASSROOM_CONFIG?.courseId || 'UXQ-ACT1-2026');
    url.searchParams.set('source', 'mission-control');
    const q = new URLSearchParams(location.search || '');
    if (q.get('classroom')) url.searchParams.set('classroom', q.get('classroom'));
    if (state.complete) {
      url.searchParams.set('review', '1');
      url.searchParams.set('complete', '1');
    } else if (state.mission) {
      url.searchParams.set('view', 'studio');
      url.searchParams.set('phase', 'studio');
    }
    url.searchParams.set('v', 'three-part-authority-v1-6-20261127');
    return url.pathname + url.search;
  }

  function actionLabel(state) {
    if (!state.mission) return 'เริ่ม Mission';
    if (!state.studio) return 'ทำ Studio Practice';
    if (!state.reflection) return 'ทำ Weekly Reflection';
    return 'ดู Studio & Reflection';
  }

  function actionDetail(state) {
    if (!state.mission) return 'ทำ Mission ให้ผ่านก่อน';
    if (!state.studio) return 'เหลือ Studio Practice และ Weekly Reflection';
    if (!state.reflection) return 'เหลือ Weekly Reflection อีก 1 ส่วน';
    return 'ครบ Mission + Studio Practice + Weekly Reflection แล้ว';
  }

  function timelineHtml(states, contiguous) {
    return states.map((state, index) => {
      const locked = index > contiguous;
      const current = index === contiguous;
      const href = locked ? '#' : nodeHref(state);
      const label = locked ? 'Locked' : actionLabel(state);
      return `<div class="timeline-row ${state.complete ? 'is-complete' : ''} ${current ? 'is-current' : ''} ${locked ? 'is-locked' : ''}">
        <div class="timeline-row__id">${state.id.toUpperCase()}</div>
        <div class="timeline-row__steps">
          <span class="timeline-step ${state.mission ? 'done' : ''}">Mission ${state.mission ? '✓' : '○'}</span>
          <span class="timeline-step ${state.studio ? 'done' : ''}">Studio ${state.studio ? '✓' : '○'}</span>
          <span class="timeline-step ${state.reflection ? 'done' : ''}">Reflection ${state.reflection ? '✓' : '○'}</span>
        </div>
        <a class="timeline-row__action" href="${esc(href)}" aria-disabled="${locked ? 'true' : 'false'}">${esc(label)}</a>
      </div>`;
    }).join('');
  }

  function assertSnapshotIdentity(snapshot, p, label) {
    if (!snapshot) return;
    const sid = normToken(snapshot.studentId, 80);
    const sec = normToken(snapshot.section || snapshot.canonicalSection, 80);
    if (sid && sid !== normToken(p.studentId, 80)) throw new Error(`${label}_student_mismatch`);
    if (sec && sec !== normToken(p.section, 80)) throw new Error(`${label}_section_mismatch`);
  }

  function render(snapshot, p) {
    assertSnapshotIdentity(snapshot, p, 'studio');
    assertSnapshotIdentity(missionSnapshot, p, 'mission');

    const states = ORDER.map(id => stateFor(snapshot, id));
    const firstIncomplete = states.findIndex(s => !s.complete);
    const contiguous = firstIncomplete < 0 ? ORDER.length : firstIncomplete;
    const missionCount = states.filter(s => s.mission).length;
    const studioCount = states.filter(s => s.studio).length;
    const reflectionCount = states.filter(s => s.reflection).length;
    const completeCount = states.filter(s => s.complete).length;
    const percent = Math.round((contiguous / ORDER.length) * 100);
    const review = snapshot.summary || {};
    const current = states[contiguous] || null;
    const box = overview();

    if (box) {
      box.dataset.identityKey = identityKey(p);
      box.innerHTML = `
        <h2>ความก้าวหน้ารายวิชา</h2>
        <p>ค่าหลักคือ <strong>Course Complete</strong>: Node ต้องครบ Mission + Studio Practice + Weekly Reflection ต่อเนื่องตามลำดับรายวิชา</p>
        <section class="course-primary">
          <div class="course-primary__value"><small>COURSE COMPLETE</small><strong>${contiguous}/${ORDER.length}</strong><span>${percent}%</span></div>
          <div><div class="course-bar"><i style="width:${percent}%"></i></div><div class="course-primary__next">${current ? `งานถัดไป: <strong>${current.id.toUpperCase()}</strong> • ${esc(actionLabel(current))} — ${esc(actionDetail(current))}` : 'ครบทุก Node ทั้งหลักสูตรแล้ว'}</div></div>
        </section>
        <div class="studio-summary">
          <span>Mission Completed<b>${missionCount}/${ORDER.length}</b></span>
          <span>Studio Submitted<b>${studioCount}/${ORDER.length}</b></span>
          <span>Reflection Submitted<b>${reflectionCount}/${ORDER.length}</b></span>
          <span class="${contiguous === ORDER.length ? 'good' : ''}">Course Complete<b>${contiguous}/${ORDER.length}</b></span>
          <span>Nodes with 3/3<b>${completeCount}/${ORDER.length}</b></span>
          <span>Approved<b>${Number(review.approvedCount || 0)}</b></span>
          <span class="${Number(review.revisionCount || 0) ? 'bad' : ''}">Need Revision<b>${Number(review.revisionCount || 0)}</b></span>
          <span>Portfolio<b>${snapshot.portfolioReady && contiguous === ORDER.length ? 'พร้อม' : 'ยังไม่ครบ'}</b></span>
        </div>
        ${completeCount > contiguous ? `<p class="uxq-progress-note">มีข้อมูลครบ 3/3 ใน Sheet รวม ${completeCount} Node แต่ระบบปลดล็อกอย่างเป็นทางการถึง ${contiguous} Node เพราะต้องครบต่อเนื่องตามลำดับรายวิชา</p>` : ''}
        <section class="student-timeline">
          <div class="student-timeline__head"><h3>Student Timeline</h3><span>${contiguous}/${ORDER.length} Complete</span></div>
          <div class="student-timeline__list">${timelineHtml(states, contiguous)}</div>
        </section>`;
    }

    const progress = document.getElementById('progress');
    if (progress) progress.textContent = `Course Complete ${contiguous}/${ORDER.length}`;

    if (!current) {
      setHero('ครบทั้งหลักสูตร 19/19 Nodes', 'Mission, Studio Practice และ Weekly Reflection ครบต่อเนื่องทุก Node', 'Portfolio พร้อมตรวจ', true);
    } else {
      const label = actionLabel(current);
      setHero(
        `${current.id.toUpperCase()} • ${label}`,
        `ปลดล็อกตามลำดับแล้ว ${contiguous}/19 • Mission ${missionCount}/19 • Studio ${studioCount}/19 • Reflection ${reflectionCount}/19`,
        `${label} →`,
        false,
        nodeHref(current)
      );
    }

    window.UXQStudioProgress = snapshot;
    window.UXQCombinedCourseProgress = {
      version: VERSION,
      identityKey: identityKey(p),
      states,
      missionCount,
      canonicalMissionCount: missionCount,
      studioCount,
      reflectionCount,
      completeCount,
      contiguous,
      unlockPolicy: 'contiguous_three_part',
      canonicalPassedMissionIds: Array.from(canonicalPassedSet())
    };
    window.dispatchEvent(new CustomEvent('uxq-three-part-course-progress', { detail: window.UXQCombinedCourseProgress }));
  }

  function renderError(error, p) {
    const box = overview();
    const message = text(error?.message || error || 'studio_progress_failed', 300);
    if (box) {
      box.dataset.identityKey = identityKey(p);
      box.innerHTML = `<h2>ยังตรวจ Studio/Reflection ไม่สำเร็จ</h2><p>การอ่านสถานะ Studio/Reflection จาก Google Sheet ใช้เวลานานหรือการเชื่อมต่อสะดุด (${esc(message)}) กรุณาลองอีกครั้ง</p><button type="button" id="uxqThreePartRetry">ตรวจสถานะอีกครั้ง</button>`;
      box.querySelector('#uxqThreePartRetry')?.addEventListener('click', () => boot(true));
    }
    setHero('ยังตรวจสถานะ Studio/Reflection ไม่สำเร็จ', 'ยังไม่สามารถยืนยันสถานะครบ 3 ส่วนจาก Google Sheet ได้ กรุณากดลองใหม่อีกครั้ง', 'ตรวจสถานะอีกครั้ง', false, '#');
    const link = document.getElementById('nextLink');
    if (link) {
      link.href = '#';
      link.onclick = event => { event.preventDefault(); boot(true); };
    }
    console.error('[UXQ three-part restore]', message);
  }

  async function boot(force = false) {
    const p = profile();
    const key = identityKey(p);
    if (!p.studentId || !p.section) return;
    if (!missionSnapshot?.ok) return;

    if (!force && key === lastIdentityKey && window.UXQStudioProgress?.ok && window.UXQCombinedCourseProgress?.identityKey === key) {
      render(window.UXQStudioProgress, p);
      return;
    }

    const token = ++activeToken;
    clearStaleUI(p);

    try {
      const data = await requestStudio(p, { force });
      if (token !== activeToken || identityKey(profile()) !== key) return;
      if (!data || !data.ok) throw new Error(data?.error || 'studio_progress_failed');
      assertSnapshotIdentity(data, p, 'studio');
      lastIdentityKey = key;
      render(data, p);
    } catch (error) {
      if (token !== activeToken || identityKey(profile()) !== key) return;
      renderError(error, p);
    }
  }

  // Triggered once per Mission Sheet snapshot (after #grid is drawn by uxq-hub-csai2601-canonical-v1.js).
  window.addEventListener('uxq-mission-control-sheet-snapshot', event => {
    missionSnapshot = event.detail?.snapshot || null;
    lastIdentityKey = '';
    boot(true);
  });

  window.addEventListener('uxq-profile-updated', () => {
    missionSnapshot = null;
    lastIdentityKey = '';
    const p = profile();
    if (p.studentId && p.section) clearStaleUI(p);
  });

  window.addEventListener('online', () => {
    if (missionSnapshot?.ok && !window.UXQStudioProgress?.ok) boot(true);
  });

  // If Mission snapshot already arrived before this script loaded, start immediately.
  if (missionSnapshot?.ok) queueMicrotask(() => boot(false));

  window.UXQThreePartRestoreAuthority = Object.freeze({ boot: () => boot(true), version: VERSION });
})();