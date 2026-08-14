/* CSAI2601 UX Quest • Three-Part Canonical Mission Guard v1
 * Production authority hardening • 2026-08-14
 *
 * PURPOSE
 * - Before Three-Part Restore calculates Node/Course completion, make the
 *   mission snapshot obey the same official authority as Mission Control.
 * - A Mission is passed ONLY when its id exists in
 *   diagnostics.canonicalPassedMissionIds from Google Sheet.
 * - bestStars / stars / completed / passed remain display metadata only and
 *   must never create an official Mission pass by themselves.
 *
 * SCOPE
 * - Mutates only the in-memory mission snapshot used by the student page.
 * - Does not write to Google Sheet, localStorage, scores, attempts, Studio,
 *   Reflection, or artifact records.
 */
(() => {
  'use strict';

  const VERSION = '20260814-THREE-PART-CANONICAL-MISSION-GUARD-V1';
  const ORDER = ['w1','w2','w3','b1','w4','w5','w6','w7','b2','w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'];

  function canonicalSet(snapshot) {
    const list = snapshot?.diagnostics?.canonicalPassedMissionIds;
    return new Set(
      Array.isArray(list)
        ? list.map(v => String(v || '').trim().toLowerCase()).filter(id => ORDER.includes(id))
        : []
    );
  }

  function sanitize(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return snapshot;

    const passed = canonicalSet(snapshot);
    if (!snapshot.missions || typeof snapshot.missions !== 'object') snapshot.missions = {};

    ORDER.forEach(id => {
      const lower = snapshot.missions[id];
      const upper = snapshot.missions[id.toUpperCase()];
      const source = (lower && typeof lower === 'object') ? lower
        : (upper && typeof upper === 'object') ? upper
        : {};

      const official = passed.has(id);
      const row = {
        ...source,
        missionPassed: official,
        passed: official,
        completed: official,
        canonicalPassed: official,
        canonicalAuthority: 'diagnostics.canonicalPassedMissionIds'
      };

      // Stars/scores/attempts are intentionally preserved as display metadata.
      snapshot.missions[id] = row;
      snapshot.missions[id.toUpperCase()] = row;
    });

    snapshot.diagnostics = snapshot.diagnostics || {};
    snapshot.diagnostics.threePartCanonicalMissionGuard = {
      version: VERSION,
      officialPassedCount: passed.size,
      officialPassedMissionIds: Array.from(passed)
    };

    return snapshot;
  }

  // Sanitize an already-restored snapshot before Three-Part Restore loads.
  if (window.UXQMissionSheetSnapshot) {
    sanitize(window.UXQMissionSheetSnapshot);
  }

  // These listeners are registered BEFORE Three-Part Restore, so the event
  // detail is canonicalized before that authority consumes it.
  window.addEventListener('uxq-sheet-progress-restored', event => {
    sanitize(event.detail);
    if (event.detail) window.UXQMissionSheetSnapshot = event.detail;
  });

  window.addEventListener('uxq-mission-control-sheet-snapshot', event => {
    const snapshot = event.detail?.snapshot;
    sanitize(snapshot);
    if (snapshot) window.UXQMissionSheetSnapshot = snapshot;
  });

  window.UXQThreePartCanonicalMissionGuardV1 = Object.freeze({
    version: VERSION,
    sanitize,
    canonicalPassedIds: () => Array.from(canonicalSet(window.UXQMissionSheetSnapshot || {}))
  });
})();
