/* =========================================================
   Shared Web App Router
   EAP Hero + EAP Word Quest + Teacher Dashboard
   Section 122

   IMPORTANT
   - Keep this as the ONLY file in the project containing doGet() / doPost().
   - EAPHero.gs owns eapHeroDoGet_ / eapHeroDoPost_.
   - EAPWordQuest.gs owns eapWordFinalDoGet_ / eapWordFinalDoPost_.
   - EAPWordQuestAuthority.gs owns official roster lookup / player resume.
   - EAPWordQuestNameLookup.gs owns official roster name search.
   - EAPWordQuestSubmitJsonp.gs owns JSONP attempt submit + receipt.
   - EAP_TeacherDashboard.gs owns the Teacher Dashboard.
   - EAP_PlayerResume.gs owns eapPlayerResume_.
   - EAP_EvidenceReview.gs owns submitEvidence_ / submitSpeakingAudio_.
========================================================= */

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = String(params.action || params.api || 'health').toLowerCase();
  const module = String(params.module || '').toLowerCase();
  const callback = String(params.callback || '');

  if (action === 'player_resume') {
    return eapRouterJson_(eapPlayerResume_(params), callback);
  }

  if (action === 'eap_teacher_dashboard') {
    return eapTeacherDashboardPage_();
  }

  if (action === 'eap_teacher_dashboard_data') {
    return eapTeacherDashboardJson_(params);
  }

  if (action === 'eap_word_submit_jsonp') {
    return eapRouterJson_(eapWordSubmitJsonp_(params), callback);
  }

  if (action === 'eap_word_name_lookup') {
    return eapRouterJson_(eapWordNameLookup_(params), callback);
  }

  const wordAuthorityActions = [
    'eap_word_authority_health',
    'eap_word_roster_setup',
    'eap_word_profile_lookup',
    'eap_word_player_resume'
  ];

  if (wordAuthorityActions.includes(action)) {
    return eapRouterJson_(eapWordAuthorityDoGet_(params), callback);
  }

  const wordQuestActions = [
    'eap_word_health',
    'eap_word_teacher',
    'eap_word_summary',
    'eap_word_setup'
  ];

  if (wordQuestActions.includes(action) || (action === 'setup' && module === 'eap_word')) {
    return eapWordFinalDoGet_(e);
  }

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

  if (action === 'submit_evidence') {
    return eapRouterJson_(submitEvidence_(payload));
  }

  if (action === 'submit_speaking_audio') {
    return eapRouterJson_(submitSpeakingAudio_(payload));
  }

  const wordQuestActions = [
    'eap_word_attempt',
    'eap_word_batch',
    'eap_word_profile'
  ];

  if (wordQuestActions.includes(action)) {
    return eapWordFinalDoPost_(e);
  }

  return eapHeroDoPost_(e);
}

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
