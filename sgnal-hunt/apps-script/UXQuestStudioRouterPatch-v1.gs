/* CSAI2601 UX Quest • Studio Router Patch v1
 * Add these calls to the existing private/public doGet routers.
 * This file intentionally does not declare doGet.
 */

function UXQ_routeStudioGet_(e) {
  const p = (e && e.parameter) || {};
  const action = String(p.action || '').trim().toLowerCase();
  if (action === 'uxq_student_studio_progress') {
    return UXQ_studioJsonp_(UXQ_getStudentStudioProgress_(e), p.callback);
  }
  return null;
}

function UXQ_showStudioDashboard_() {
  return HtmlService.createHtmlOutputFromFile('UXQuestStudioDashboard-v1')
    .setTitle('CSAI2601 Studio Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function UXQ_showPortfolioBuilder_() {
  return HtmlService.createHtmlOutputFromFile('UXQuestPortfolioBuilder-v1')
    .setTitle('CSAI2601 Portfolio Builder')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function UXQ_routeStudioTeacherGet_(e) {
  const p = (e && e.parameter) || {};
  const view = String(p.view || '').trim().toLowerCase();
  if (view === 'studio') return UXQ_showStudioDashboard_();
  if (view === 'portfolio') return UXQ_showPortfolioBuilder_();
  return null;
}

function UXQ_studioJsonp_(payload, callback) {
  const safe = String(callback || '').trim();
  const json = JSON.stringify(payload == null ? {} : payload);
  if (/^[A-Za-z_$][0-9A-Za-z_$\.]{0,100}$/.test(safe)) {
    return ContentService.createTextOutput(safe + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/* Example integration — public progress endpoint:
function doGet(e) {
  const studio = UXQ_routeStudioGet_(e);
  if (studio) return studio;
  if (String(e.parameter.action || '') === 'uxq_student_progress') return UXQ_getStudentProgress_(e);
  return UXQ_studioJsonp_({ ok:false, error:'unknown_action' }, e.parameter.callback);
}

Example integration — private teacher dashboard:
function doGet(e) {
  const studio = UXQ_routeStudioTeacherGet_(e);
  if (studio) return studio;
  return UXQ_showExistingTeacherDashboard_();
}
*/
