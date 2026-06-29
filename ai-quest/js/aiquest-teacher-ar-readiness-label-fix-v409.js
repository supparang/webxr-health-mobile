/* CSAI2102 AI Quest — AR Readiness Label Fix v4.0.9
   Presentation-only alignment for the existing AR Readiness card.
   S1 is a latest-evidence-per-learner view; S2 preserves real replay history.
*/
(() => {
  'use strict';

  const CARD_ID = 'aiquestArReadinessV408';
  let last = '';

  function records(){
    try {
      return window.AIQUEST_TEACHER_AR_READINESS?.getRecords?.() || [];
    } catch (_) {
      return [];
    }
  }

  function apply(){
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

  function boot(){
    apply();
    new MutationObserver(apply).observe(document.documentElement, { childList:true, subtree:true });
    setInterval(apply, 1300);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
