/* =========================================================
   EAP Hero Answer Choice Quality Guard v20260710
   V6 SAFE NO-DOM-MUTATION
   - Emergency rollback for Boss Clash choice cards.
   - Does NOT edit, hide, compact, reorder, or rewrite A/B/C/D choices.
   - Prevents missing-choice bug caused by previous DOM mutation guard.
   - Choice quality must be handled in source data / generator, not post-render DOM.
========================================================= */
(function(){
  'use strict';
  const VERSION = 'v20260710-EAP-ANSWER-CHOICE-QUALITY-GUARD-V6-SAFE-NO-DOM-MUTATION';

  function noop(){ return true; }

  window.EAPAnswerChoiceQualityGuard = {
    version: VERSION,
    safeNoDomMutation: true,
    editsChoices: false,
    hidesChoices: false,
    reordersChoices: false,
    refresh: noop
  };
})();
