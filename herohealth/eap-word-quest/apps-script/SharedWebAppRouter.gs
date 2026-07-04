/* =========================================================
   Shared Web App Router
   EAP Hero + EAP Word Quest + Teacher Dashboard
   Section 122

   IMPORTANT
   - Keep this as the ONLY file in the project containing doGet() / doPost().
   - EAPHero.gs owns eapHeroDoGet_ / eapHeroDoPost_.
   - EAPWordQuest.gs owns eapWordFinalDoGet_ / eapWordFinalDoPost_.
   - EAP_TeacherDashboard.gs owns the Teacher Dashboard.
   - EAP_PlayerResume.gs owns eapPlayerResume_.
   - EAP_EvidenceReview.gs owns submitEvidence_ / submitSpeakingAudio_.
========================================================= */

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = String(params.action || params.api || 'health').toLowerCase();
  const module = String(params.module || '').toLowerCase();
  const callback = String(params.callback || '');

  /* =========================================================
     EAP Hero — Player Resume
     Identity is studentId + section; name is display only.
     JSONP is used because the student game is hosted on GitHub Pages.
  ========================================================= */
  if (action === 'player_resume') {
    return eapRouterJson_(eapPlayerResume_(params), callback);
  }

  /* =========================================================
     EAP Teacher Dashboard
  ========================================================= */
  if (action === 'eap_teacher_dashboard') {
    return eapTeacherDashboardPage_();
  }

  if (action === 'eap_teacher_dashboard_data') {
    return eapTeacherDashboardJson_(params);
  }

  /* =========================================================
     EAP Word Quest
     Do NOT intercept generic `setup` unless module=eap_word.
     This protects any existing EAP Hero setup endpoint.
  ========================================================= */
  const wordQuestActions = [
    'eap_word_health',
    'eap_word_teacher',
    'eap_word_summary',
    'eap_word_setup'
  ];

  if (wordQuestActions.includes(action) || (action === 'setup' && module === 'eap_word')) {
    return eapWordFinalDoGet_(e);
  }

  /* =========================================================
     EAP Hero default
  ========================================================= */
  return eapHeroDoGet_(e);
}

function doPost(e) {
  let payload = {};

  try {
    const raw = e && e.postData && e.postData.contents
      ? String(e.postData.contents)
      : '';
    payload = raw ? JSON.parse(raw) : ((e && e.parameter) || {});
  } catch (error) {
    payload = (e && e.parameter) || {};
  }

  const action = String(payload.action || payload.type || '').toLowerCase();

  /* =========================================================
     EAP Hero — Evidence compatibility
     Keeps one shared doPost() while enabling the newer Boss Evidence
     and optional consent-based audio handlers.
  ========================================================= */
  if (action === 'submit_evidence') {
    return eapRouterJson_(submitEvidence_(payload));
  }

  if (action === 'submit_speaking_audio') {
    return eapRouterJson_(submitSpeakingAudio_(payload));
  }

  /* =========================================================
     EAP Word Quest
  ========================================================= */
  const wordQuestActions = [
    'eap_word_attempt',
    'eap_word_batch',
    'eap_word_profile'
  ];

  if (wordQuestActions.includes(action)) {
    return eapWordFinalDoPost_(e);
  }

  /* =========================================================
     EAP Hero default
  ========================================================= */
  return eapHeroDoPost_(e);
}

/* =========================================================
   Shared response helper
   Supports JSON for normal calls and JSONP for the GitHub Pages resume call.
========================================================= */
function eapRouterJson_(data, callback) {
  const json = JSON.stringify(data || {});
  const safeCallback = String(callback || '').trim();

  if (/^[A-Za-z_$][A-Za-z0-9_$]{0,100}$/.test(safeCallback)) {
    return ContentService
      .createTextOutput(safeCallback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
