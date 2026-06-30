/* =========================================================
   Shared Web App Router
   One Google Sheet / One Apps Script Project
   EAP Hero + EAP Word Quest + Teacher Dashboard

   Keep this as the ONLY file in the project containing doGet/doPost.
========================================================= */

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = String(params.action || params.api || 'health').toLowerCase();
  const module = String(params.module || '').toLowerCase();

  /* ---------- EAP Hero Teacher Dashboard ---------- */
  if (action === 'eap_teacher_dashboard') {
    return eapTeacherDashboardPage_();
  }

  if (action === 'eap_teacher_dashboard_data') {
    return eapTeacherDashboardJson_(params);
  }

  /* ---------- EAP Word Quest ----------
     Do NOT intercept generic `setup` unless module=eap_word.
     This protects any existing EAP Hero setup endpoint. */
  const wordQuestActions = [
    'eap_word_health',
    'eap_word_teacher',
    'eap_word_summary',
    'eap_word_setup'
  ];

  if (wordQuestActions.includes(action) || (action === 'setup' && module === 'eap_word')) {
    return eapWordDoGet_(e);
  }

  /* ---------- EAP Hero default ---------- */
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

  /* ---------- EAP Word Quest ---------- */
  const wordQuestActions = [
    'eap_word_attempt',
    'eap_word_batch',
    'eap_word_profile'
  ];

  if (wordQuestActions.includes(action)) {
    return eapWordDoPost_(e);
  }

  /* ---------- EAP Hero default ---------- */
  return eapHeroDoPost_(e);
}
