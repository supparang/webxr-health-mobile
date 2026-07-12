/* CSAI2601 • UX Quest W1 Data Contract Hardening v1
   - Locks CSAI2601 classroom identity to section 201
   - Requires verified reasoning for mission pass
   - Enriches answer evidence with selected option id/text
   - Restores learningFocus and bumps payload schema to v1.1
*/
(() => {
  'use strict';
  if (window.__UXQ_W1_DATA_CONTRACT_HARDENING_V1__) return;
  window.__UXQ_W1_DATA_CONTRACT_HARDENING_V1__ = true;

  const REQUIRED_SECTION = '201';
  const PASS_ACCURACY = 63;
  const PASS_VERIFIED = 75;
  const selectedTrail = [];

  const text = (value, max) => String(value ?? '').trim().slice(0, max || 500);

  /* Capture the actual answer option before the mission engine handles the click. */
  document.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-option]') : null;
    if (!button) return;
    selectedTrail.push({
      selectedOptionId: text(button.getAttribute('data-option'), 180),
      selectedText: text(button.querySelector('b')?.textContent || button.textContent, 420)
    });
  }, true);

  /* Canonical CSAI2601 identity: section 201. */
  const identity = window.UXQIdentity;
  if (identity) {
    const normalize = (profile) => Object.assign({}, profile || {}, { section: REQUIRED_SECTION });
    window.UXQIdentity = Object.freeze(Object.assign({}, identity, {
      get(){ return normalize(identity.get?.() || {}); },
      save(profile){ return identity.save?.(normalize(profile)); },
      isComplete(profile){ return identity.isComplete?.(normalize(profile)); },
      ensureForMission(){
        return Promise.resolve(identity.ensureForMission?.()).then((profile) => {
          if (!profile || profile.guest) return profile;
          return identity.save?.(normalize(profile)) || normalize(profile);
        });
      },
      profileLabel(profile){ return identity.profileLabel?.(normalize(profile)); }
    }));
  }

  /* Pass only when answer accuracy and verified reasoning both meet the gate. */
  const progress = window.UXQProgress;
  if (progress?.recordMission) {
    window.UXQProgress = Object.freeze(Object.assign({}, progress, {
      recordMission(missionId, result){
        const target = result && typeof result === 'object' ? result : {};
        const raw = Number(target.accuracy || 0);
        const verified = Number(target.verifiedAccuracy || 0);
        const risk = text(target.guessRisk, 40).toLowerCase();
        const passed = raw >= PASS_ACCURACY && verified >= PASS_VERIFIED && risk !== 'high';
        target.passed = passed;
        if (!passed && Number(target.stars || 0) >= 2) target.stars = 1;
        return progress.recordMission(missionId, target);
      }
    }));
  }

  function learningFocus(answers){
    const misses = new Map();
    (Array.isArray(answers) ? answers : []).forEach((answer) => {
      if (answer?.verified === true) return;
      const stage = text(answer?.stageKey || 'reasoning', 80);
      misses.set(stage, (misses.get(stage) || 0) + 1);
    });
    if (!misses.size) return 'Reason Check complete';
    return [...misses.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([stage, count]) => `${stage} • ${count} answer + reason`)
      .join(', ');
  }

  /* Enrich the write-only analytics payload without changing the receiver contract. */
  const analytics = window.UXQAnalytics;
  if (analytics?.recordMissionComplete) {
    window.UXQAnalytics = Object.freeze(Object.assign({}, analytics, {
      recordMissionComplete(data){
        const payload = Object.assign({}, data || {});
        const answers = (Array.isArray(payload.answers) ? payload.answers : []).map((answer, index) => {
          const captured = selectedTrail[index] || {};
          return Object.assign({}, answer, {
            selectedOptionId: text(answer?.selectedOptionId || captured.selectedOptionId, 180),
            selectedText: text(answer?.selectedText || captured.selectedText || answer?.selected, 420)
          });
        });
        payload.answers = answers;
        payload.learningFocus = text(payload.learningFocus || learningFocus(answers), 300);
        payload.schema = 'uxq.classroom.v1.1';
        payload.section = REQUIRED_SECTION;
        selectedTrail.splice(0, selectedTrail.length);
        return analytics.recordMissionComplete(payload);
      }
    }));
  }
})();
