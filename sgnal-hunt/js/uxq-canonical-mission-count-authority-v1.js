/* CSAI2601 UX Quest • Canonical Mission Count Authority v1
 * Mission totals and unlocks must use only contiguous canonicalPassedMissionIds.
 * Raw/non-contiguous/alias mission rows are diagnostic only.
 */
(() => {
  'use strict';

  const VERSION = '20260727-CANONICAL-MISSION-COUNT-AUTHORITY-V1';
  const ORDER = ['w1','w2','w3','b1','w4','w5','w6','w7','b2','w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'];
  let missionSnapshot = window.UXQMissionSheetSnapshot || null;
  let latestCombined = null;
  let applying = false;

  const cleanId = value => String(value || '').trim().toLowerCase();

  function canonicalIds(snapshot) {
    const diagnostics = snapshot?.diagnostics || {};
    const explicit = Array.isArray(diagnostics.canonicalPassedMissionIds)
      ? diagnostics.canonicalPassedMissionIds.map(cleanId).filter(id => ORDER.includes(id))
      : [];
    if (explicit.length) return explicit;

    const completedNodes = Math.max(0, Math.min(ORDER.length, Number(snapshot?.completedNodes || 0)));
    if (completedNodes) return ORDER.slice(0, completedNodes);

    const next = cleanId(snapshot?.nextMission || '');
    const nextIndex = ORDER.indexOf(next);
    return nextIndex > 0 ? ORDER.slice(0, nextIndex) : [];
  }

  function correctedDetail(detail) {
    const passed = new Set(canonicalIds(missionSnapshot));
    const source = Array.isArray(detail?.states) ? detail.states : [];
    const states = ORDER.map((id, index) => {
      const old = source.find(item => cleanId(item?.id) === id) || {};
      const mission = passed.has(id);
      const studio = Boolean(old.studio);
      const reflection = Boolean(old.reflection);
      return {
        ...old,
        id,
        mission,
        studio,
        reflection,
        complete: Boolean(mission && studio && reflection),
        canonicalIndex:index
      };
    });

    const firstIncomplete = states.findIndex(state => !state.complete);
    const contiguous = firstIncomplete < 0 ? states.length : firstIncomplete;
    return {
      ...detail,
      states,
      missionCount:passed.size,
      canonicalMissionCount:passed.size,
      rawMissionCount:Number(detail?.missionCount || 0),
      studioCount:states.filter(state => state.studio).length,
      reflectionCount:states.filter(state => state.reflection).length,
      completeCount:states.filter(state => state.complete).length,
      contiguous,
      canonicalPassedMissionIds:[...passed],
      authority:'canonical_mission_count_v1',
      version:VERSION
    };
  }

  function updateOverview(detail) {
    const overview = document.getElementById('uxqStudioOverview');
    if (!overview) return;

    const summaryItems = [...overview.querySelectorAll('.studio-summary > span')];
    summaryItems.forEach(item => {
      const label = String(item.childNodes?.[0]?.textContent || item.textContent || '').trim();
      const value = item.querySelector('b');
      if (!value) return;
      if (/^Mission Completed/i.test(label)) value.textContent = `${detail.missionCount}/${ORDER.length}`;
      else if (/^Studio Submitted/i.test(label)) value.textContent = `${detail.studioCount}/${ORDER.length}`;
      else if (/^Reflection Submitted/i.test(label)) value.textContent = `${detail.reflectionCount}/${ORDER.length}`;
      else if (/^Course Complete/i.test(label)) value.textContent = `${detail.contiguous}/${ORDER.length}`;
      else if (/^Nodes with 3\/3/i.test(label)) value.textContent = `${detail.completeCount}/${ORDER.length}`;
    });

    const primaryValue = overview.querySelector('.course-primary__value strong');
    const primaryPercent = overview.querySelector('.course-primary__value span');
    const bar = overview.querySelector('.course-bar i');
    const percent = Math.round((detail.contiguous / ORDER.length) * 100);
    if (primaryValue) primaryValue.textContent = `${detail.contiguous}/${ORDER.length}`;
    if (primaryPercent) primaryPercent.textContent = `${percent}%`;
    if (bar) bar.style.width = `${percent}%`;

    const progress = document.getElementById('progress');
    if (progress) progress.textContent = `Course Complete ${detail.contiguous}/${ORDER.length}`;
  }

  function apply(detail) {
    if (applying || !missionSnapshot || !Array.isArray(detail?.states)) return;
    applying = true;
    try {
      const corrected = correctedDetail(detail);
      latestCombined = corrected;
      window.UXQCombinedCourseProgress = corrected;
      updateOverview(corrected);
      window.dispatchEvent(new CustomEvent('uxq-three-part-course-progress', { detail:corrected }));
    } finally {
      applying = false;
    }
  }

  window.addEventListener('uxq-mission-control-sheet-snapshot', event => {
    missionSnapshot = event.detail?.snapshot || null;
    if (latestCombined) apply(latestCombined);
  });

  window.addEventListener('uxq-sheet-progress-restored', event => {
    missionSnapshot = event.detail || null;
    if (latestCombined) apply(latestCombined);
  });

  window.addEventListener('uxq-three-part-course-progress', event => {
    if (event.detail?.authority === 'canonical_mission_count_v1') {
      latestCombined = event.detail;
      updateOverview(event.detail);
      return;
    }
    apply(event.detail);
  });

  const observer = new MutationObserver(() => {
    if (latestCombined) requestAnimationFrame(() => updateOverview(latestCombined));
  });
  const start = () => observer.observe(document.body, { childList:true, subtree:true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();

  window.UXQCanonicalMissionCountAuthorityV1 = Object.freeze({ version:VERSION, apply, canonicalIds });
})();