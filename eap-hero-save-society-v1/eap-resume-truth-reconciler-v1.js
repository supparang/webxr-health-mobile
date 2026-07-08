/* =========================================================
   EAP Hero Resume Truth Reconciler v20260708
   V3 RETIRED / NO-OP

   Why retired:
   - Cloud-first resume is now handled by eap-player-resume-v1.js.
   - Route unlock is now handled by eap-roadmap-lock-guard-v20260708.js.
   - The old reconciler was S1-S15 only, did not understand B1-B5, and
     could rewrite local state after Cloud resume had already restored it.
   - That caused the visible "ตอนนี้/ไปถึง S ไหน" status to appear, vanish,
     and reappear during async resume/refresh cycles.

   This file intentionally keeps the old global API name so older scripts do
   not crash, but it no longer mutates localStorage or re-renders the map.
========================================================= */
(function(){
  'use strict';

  var VERSION = 'v20260708-EAP-RESUME-TRUTH-RECONCILER-V3-RETIRED-NOOP';

  function reconcile(data){
    return {
      ok: true,
      retired: true,
      version: VERSION,
      note: 'Cloud-first resume and routeOrder/Boss-aware lock guard are authoritative.',
      recordCount: data && Array.isArray(data.records) ? data.records.length : 0
    };
  }

  window.EAPResumeTruthReconcilerV2 = {
    version: VERSION,
    retired: true,
    reconcile: reconcile
  };

  window.EAPResumeTruthReconcilerV3 = window.EAPResumeTruthReconcilerV2;
})();