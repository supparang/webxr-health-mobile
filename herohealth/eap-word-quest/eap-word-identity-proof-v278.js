/* =========================================================
   EAP Word Quest • Runtime Identity Proof Guard
   Version: 20260728-EAPWQ-V278-RUNTIME-IDENTITY-PROOF

   Purpose
   - Preserve the official Google Sheet identity while legacy game code
     rewrites the shared profile cache during/after a round.
   - Give V277 a trustworthy profile before it builds the Sheet payload.

   Rules
   - Authority runtime V275 must be ready + verified.
   - Student ID must be 10 digits and match the visible profile.
   - No MutationObserver and no continuous polling.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260728-EAPWQ-V278-RUNTIME-IDENTITY-PROOF';
  var PROFILE_KEY = 'EAP_WORD_QUEST_PROFILE_V01';
  var PROOF_KEY = 'EAP_WORD_QUEST_RUNTIME_IDENTITY_V278';
  var GROUP = '122';
  var lastProof = null;

  if (window.__EAP_WORD_IDENTITY_PROOF_V278__) return;
  window.__EAP_WORD_IDENTITY_PROOF_V278__ = true;

  function text(value) {
    return String(value == null ? '' : value).replace(/\s+/g,' ').trim();
  }

  function readRuntimeProfile() {
    var snapshot;
    var state;
    var profile;
    var idInput = document.getElementById('studentIdInput');
    var nameInput = document.getElementById('studentNameInput');
    var visibleId = text(idInput && idInput.value);
    var visibleName = text(nameInput && nameInput.value);

    try {
      if (typeof window.inspectEapWordAuthorityV275 !== 'function') return null;
      snapshot = window.inspectEapWordAuthorityV275();
      state = snapshot && snapshot.state;
      profile = state && state.profile;
    } catch (error) {
      console.warn('[EAP Word Quest] V278 could not inspect V275 authority',error);
      return null;
    }

    if (!state || state.ready !== true || state.phase !== 'verified') return null;
    if (!profile || profile.official !== true || profile.authority !== 'google_sheet_roster') return null;
    if (!/^\d{10}$/.test(text(profile.studentId)) || !text(profile.studentName)) return null;
    if (text(profile.section || GROUP) !== GROUP) return null;

    /* A visible mismatch means a learner/profile switch may be in progress. */
    if (visibleId && visibleId !== text(profile.studentId)) return null;
    if (visibleName && visibleName !== text(profile.studentName)) return null;

    return {
      studentId:text(profile.studentId),
      studentName:text(profile.studentName),
      section:GROUP,
      official:true,
      authority:'google_sheet_roster',
      verifiedAt:text(profile.verifiedAt || state.verifiedAt || new Date().toISOString()),
      proofVersion:VERSION
    };
  }

  function writeProof(profile,reason) {
    var payload;
    if (!profile) return null;

    payload = {
      studentId:profile.studentId,
      studentName:profile.studentName,
      section:GROUP,
      official:true,
      authority:'google_sheet_roster',
      verifiedAt:profile.verifiedAt || new Date().toISOString(),
      proofVersion:VERSION,
      proofReason:reason || 'runtime_sync',
      proofTs:new Date().toISOString()
    };

    try { localStorage.setItem(PROFILE_KEY,JSON.stringify(payload)); }
    catch (error) { console.warn('[EAP Word Quest] V278 local profile proof write failed',error); }
    try { sessionStorage.setItem(PROOF_KEY,JSON.stringify(payload)); }
    catch (error2) { console.warn('[EAP Word Quest] V278 session proof write failed',error2); }

    lastProof = payload;
    window.dispatchEvent(new CustomEvent('eap-word-runtime-identity-proof',{
      detail:{version:VERSION,profile:payload,reason:reason || 'runtime_sync'}
    }));
    return payload;
  }

  function syncProof(reason) {
    return writeProof(readRuntimeProfile(),reason);
  }

  function boundedSync(reason,delays) {
    (delays || [0,80,220,600,1400]).forEach(function (delay) {
      setTimeout(function () { syncProof(reason + '_' + delay); },delay);
    });
  }

  function summaryActive() {
    var summary = document.getElementById('summaryScreen');
    return Boolean(summary && summary.classList.contains('active'));
  }

  function retryCurrentSummary() {
    if (!summaryActive()) return;
    syncProof('summary_retry_preflight');
    if (typeof window.submitEapWordQuestExactSummaryToSheet === 'function') {
      window.submitEapWordQuestExactSummaryToSheet();
    }
  }

  window.addEventListener('eap-word-authority-ready',function (event) {
    var profile = event && event.detail && event.detail.profile;
    if (profile && profile.official === true && profile.authority === 'google_sheet_roster') {
      writeProof(profile,'authority_ready_event');
    } else {
      boundedSync('authority_ready_fallback',[0,120,450]);
    }
  });

  /* Loaded before V277, so this proof is restored before V277 schedules submit. */
  window.addEventListener('eap-core-run-finished',function () {
    boundedSync('core_finished',[0,30,90,180,320,700,1400]);
  });

  document.addEventListener('click',function () {
    if (summaryActive()) syncProof('summary_click_capture');
  },true);

  document.addEventListener('visibilitychange',function () {
    if (!document.hidden) boundedSync('visibility_return',[0,180,600]);
  });

  window.getEapWordOfficialProfileV278 = function () {
    return syncProof('direct_request') || lastProof;
  };
  window.syncEapWordOfficialProfileV278 = function () {
    return syncProof('manual_sync');
  };
  window.retryEapWordCurrentSummaryV278 = function () {
    boundedSync('manual_retry',[0,50,150]);
    setTimeout(retryCurrentSummary,220);
  };
  window.inspectEapWordIdentityProofV278 = function () {
    return {version:VERSION,lastProof:lastProof,runtimeProfile:readRuntimeProfile()};
  };

  boundedSync('boot',[0,120,450,1000,2200]);
  setTimeout(function () {
    if (summaryActive()) {
      syncProof('boot_summary');
      setTimeout(retryCurrentSummary,300);
    }
  },900);

  console.info('[EAP Word Quest] V278 runtime identity proof ready',{version:VERSION});
})();
