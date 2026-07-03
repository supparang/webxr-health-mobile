/* CSAI2102 AI Quest — Teacher Release Alignment v4.1.0
   Presentation-only alignment for AR Readiness, Core Evidence Audit, and
   the Monday classroom release labels. No student score, gate, or Sheet
   records are modified by this file.
*/
(() => {
  'use strict';

  const CARD_ID = 'aiquestArReadinessV408';
  const RELEASE = '2026-07-03 Classroom Release';
  let last = '';

  function records(){
    try {
      return window.AIQUEST_TEACHER_AR_READINESS?.getRecords?.() || [];
    } catch (_) {
      return [];
    }
  }

  function applyArReadiness(){
    const root = document.getElementById(CARD_ID);
    const rows = records();
    if (!root || !rows.length) return;

    const s1Learners = new Set(
      rows.filter((row) => row.type === 's1_ar_complete')
        .map((row) => String(row.studentId || row.studentName || ''))
        .filter(Boolean)
    ).size;
    const s2Runs = rows.filter((row) => row.type === 's2_ar_complete').length;
    const signature = `${s1Learners}|${s2Runs}|${root.textContent.length}`;
    if (signature === last) return;
    last = signature;

    const metrics = [...root.querySelectorAll('.metric')];
    const evidenceMetric = metrics.find((metric) => /S1\s*\/\s*S2 evidence/i.test(metric.textContent || ''));
    if (evidenceMetric) {
      const label = evidenceMetric.querySelector('.muted');
      const value = evidenceMetric.querySelector('b');
      if (label) label.textContent = 'S1 learners / S2 real runs';
      if (value) value.textContent = `${s1Learners} / ${s2Runs}`;
    }

    root.querySelectorAll('table tbody tr').forEach((row) => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 5) return;
      const s1Available = !/ยังไม่มี/.test(cells[1].textContent || '');
      cells[4].innerHTML = `${(cells[4].textContent || '').match(/\d+\s+real S2 runs?/)?.[0] || '0 real S2 runs'}<br><span class="muted">${s1Available ? 'S1 latest evidence available' : 'S1 evidence pending'}</span>`;
    });
  }

  function setText(selector, text){
    const element = document.querySelector(selector);
    if (element && element.textContent !== text) element.textContent = text;
  }

  function patchReleaseChrome(){
    setText('.top .sub', 'Classroom Release • Core S1–S6 + B1–B2 • Section 101');

    document.querySelectorAll('.top .pill').forEach((pill) => {
      const text = pill.textContent || '';
      if (/Phase 1 Ready|S1–S5|S1-S5/i.test(text)) pill.textContent = '✓ Core release: S1–S6 + B1–B2';
    });

    const studentLink = document.querySelector('.actions a.btn');
    if (studentLink) {
      studentLink.href = './index.html?release=20260703-classroom';
      studentLink.textContent = 'Student Game';
    }

    const actions = document.querySelector('.actions');
    if (actions && !document.getElementById('mondayLaunchLink')) {
      const link = document.createElement('a');
      link.id = 'mondayLaunchLink';
      link.className = 'btn good';
      link.href = './classroom-launch.html?release=20260703-classroom';
      link.textContent = 'Monday Launch';
      actions.appendChild(link);
    }

    const decision = document.getElementById('decisionBox');
    if (decision && !decision.dataset.releaseAligned) {
      decision.dataset.releaseAligned = '1';
      decision.innerHTML = '<p><b>Classroom release พร้อมใช้:</b> S1–S6 และ Boss B1–B2 ผ่าน Core Evidence Audit</p><p class="muted">วันจันทร์ให้เริ่ม S1: AI Awakening แล้วตรวจ Attempts ในหน้านี้หลังนักศึกษาส่งผล</p>';
    }

    const checklist = document.getElementById('checklistBox');
    if (checklist && !checklist.dataset.releaseAligned) {
      checklist.dataset.releaseAligned = '1';
      checklist.innerHTML = '<span class="pill good">✓ Section 101</span><span class="pill good">✓ Class ID CSAI2102-2569-101</span><span class="pill good">✓ Google Sheets live</span><span class="pill good">✓ S1–S6 + B1–B2 evidence path</span><span class="pill good">✓ Monday Launch page</span>';
    }

    const header = document.querySelector('.top h1');
    if (header) header.setAttribute('data-release', RELEASE);
  }

  function loadCoreAudit(){
    if (window.AIQuestCoreAuditV411 || document.getElementById('aiquestCoreAuditV411Script')) return;
    const script = document.createElement('script');
    script.id = 'aiquestCoreAuditV411Script';
    script.src = './js/aiquest-teacher-core-audit-v411.js?v=20260701-coreaudit411';
    script.async = true;
    document.head.appendChild(script);
  }

  function apply(){
    applyArReadiness();
    patchReleaseChrome();
  }

  function boot(){
    apply();
    loadCoreAudit();
    new MutationObserver(apply).observe(document.documentElement, { childList:true, subtree:true });
    setInterval(apply, 1300);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
