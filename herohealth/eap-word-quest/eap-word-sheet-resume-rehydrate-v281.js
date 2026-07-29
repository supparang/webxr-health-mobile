/* =========================================================
   EAP Word Quest • Sheet Resume -> Core State Rehydrate
   Version: 20260729-EAPWQ-V281-SHEET-REHYDRATE

   Google Sheet remains the official authority. V275 writes the confirmed
   resume into the Core stats cache. If Core/Arc scripts initialized before
   that write, perform one guarded reload per official resume fingerprint so
   Home statistics and the Arc map restart from the Sheet-confirmed state.

   No MutationObserver and no continuous polling.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260729-EAPWQ-V281-SHEET-REHYDRATE';
  var FLOW = ['S1','S2','S3','BG1','S4','S5','S6','BG2','S7','S8','S9','BG3','S10','S11','S12','BG4','S13','S14','S15','BG5'];
  var PREFIX = 'EAPWQ_V281_REHYDRATED_';

  if (window.__EAP_WORD_V281_SHEET_REHYDRATE__) return;
  window.__EAP_WORD_V281_SHEET_REHYDRATE__ = true;

  function text(value) {
    return String(value == null ? '' : value).replace(/\s+/g,' ').trim();
  }

  function resumeFingerprint(resume) {
    if (!resume || !resume.sessions) return '';
    return FLOW.map(function (id) {
      var row = resume.sessions[id] || {};
      return [id,row.played ? 1 : 0,row.passed ? 1 : 0,Number(row.attempts || 0),Number(row.bestAccuracy || 0)].join(':');
    }).join('|') + '|next:' + text(resume.currentSession || resume.nextMission);
  }

  function localPassedCount() {
    var snapshot;
    var sessions;
    var count = 0;
    try {
      snapshot = typeof window.inspectEapV196 === 'function' ? window.inspectEapV196() : null;
      sessions = snapshot && snapshot.sessions ? snapshot.sessions : {};
      FLOW.forEach(function (id) { if (sessions[id] && sessions[id].passed) count += 1; });
    } catch (ignore) {}
    return count;
  }

  function apply(event) {
    var detail = event && event.detail;
    var profile = detail && detail.profile;
    var resume = detail && detail.resume;
    var sheetPassed;
    var fingerprint;
    var key;

    if (!profile || profile.official !== true || profile.authority !== 'google_sheet_roster') return;
    if (!resume || resume.ok !== true || resume.official !== true) return;

    sheetPassed = Array.isArray(resume.passedSessions) ? resume.passedSessions.length : 0;
    if (localPassedCount() === sheetPassed) return;

    fingerprint = resumeFingerprint(resume);
    if (!fingerprint) return;
    key = PREFIX + text(profile.studentId);
    if (sessionStorage.getItem(key) === fingerprint) return;
    sessionStorage.setItem(key,fingerprint);

    console.info('[EAP Word Quest] V281 reloading Core from Sheet-confirmed cache',{
      version:VERSION,
      studentId:profile.studentId,
      sheetPassed:sheetPassed,
      localPassed:localPassedCount(),
      currentSession:resume.currentSession
    });

    setTimeout(function () { location.reload(); },120);
  }

  window.addEventListener('eap-word-authority-ready',apply);
  window.addEventListener('eap-word-sheet-confirmed',function (event) {
    var detail = event && event.detail;
    var profile = null;
    if (!detail || !detail.resume) return;
    try {
      if (typeof window.getEapWordOfficialProfileV278 === 'function') profile = window.getEapWordOfficialProfileV278();
    } catch (ignore) {}
    apply({detail:{profile:profile,resume:detail.resume}});
  });

  window.inspectEapWordSheetRehydrateV281 = function () {
    return {version:VERSION,localPassed:localPassedCount()};
  };

  console.info('[EAP Word Quest] V281 Sheet rehydrate ready',{version:VERSION});
})();
