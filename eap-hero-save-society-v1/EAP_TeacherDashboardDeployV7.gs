/* =========================================================
   EAP Learning Analytics Dashboard v7 — DEPLOYMENT WRAPPER

   Apps Script deployment name: EAP_TeacherDashboard.gs

   Prerequisites in the SAME Apps Script project:
   - EAP_AnalyticsCanonicalV7.gs
   - EAP_DashboardTeacher.html containing EAP_DashboardTeacherCanonicalV7.html
   - Existing EAP_Code.gs / SharedWebAppRouter.gs
   - Existing Hero, Word Quest, Identity Map, Evidence Review helpers

   This file deliberately keeps the public function names already used by
   the Sheet menu and Shared Web App Router, but delegates every analytics
   calculation to the canonical v7 implementation.
========================================================= */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('EAP Analytics')
    .addItem('เปิด Learning Analytics Dashboard', 'showEapTeacherDashboard')
    .addItem('เปิด Boss Speaking Review', 'showEapBossEvidenceReview')
    .addItem('เปิด Boss Four-Skill Ledger', 'showEapBossFourSkillLedger')
    .addToUi();
}

function showEapTeacherDashboard() {
  const html = HtmlService
    .createHtmlOutputFromFile('EAP_DashboardTeacher')
    .setWidth(1480)
    .setHeight(900);

  SpreadsheetApp.getUi().showModelessDialog(
    html,
    'EAP Learning Analytics Dashboard · Canonical v7'
  );
}

function eapTeacherDashboardPage_() {
  return HtmlService
    .createHtmlOutputFromFile('EAP_DashboardTeacher')
    .setTitle('EAP Learning Analytics Dashboard · Canonical v7')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function eapTeacherDashboardJson_(params) {
  return ContentService
    .createTextOutput(JSON.stringify(eapTeacherDashboardData(params || {})))
    .setMimeType(ContentService.MimeType.JSON);
}

/* Public API name preserved for google.script.run and SharedWebAppRouter.gs. */
function eapTeacherDashboardData(filters) {
  return eapTeacherDashboardDataCanonicalV7(filters || {});
}

function eapTeacherStudentDetail(studentId) {
  const id = String(studentId || '').trim();
  const data = eapTeacherDashboardDataCanonicalV7({
    section: (typeof EAP_CONFIG !== 'undefined' && EAP_CONFIG.DEFAULT_SECTION) || '122'
  });
  const learner = (data.learners || []).filter(function(item) {
    return String(item.studentId) === id;
  })[0];
  return learner
    ? { ok:true, version:EAP_ANALYTICS_V7_VERSION, learner:learner }
    : { ok:false, version:EAP_ANALYTICS_V7_VERSION, error:'Student not found' };
}

/* Run once from the Apps Script editor before creating a new deployment. */
function eapAnalyticsV7Preflight() {
  const sample = eapTeacherDashboardDataCanonicalV7({
    section: (typeof EAP_CONFIG !== 'undefined' && EAP_CONFIG.DEFAULT_SECTION) || '122'
  });
  if (!sample || sample.ok !== true) throw new Error('Canonical v7 data API did not return ok=true');
  if (sample.version !== EAP_ANALYTICS_V7_VERSION) throw new Error('Unexpected Analytics version: ' + sample.version);
  if (!sample.overview || !sample.dataQuality || !Array.isArray(sample.learners)) {
    throw new Error('Canonical v7 response is missing overview, dataQuality, or learners');
  }
  const guest = sample.learners.filter(function(learner) {
    return /^(guest|anonymous|test|qa|demo|sample)/i.test(String(learner.studentId || ''));
  });
  if (guest.length) throw new Error('Non-official learner leaked into canonical roster: ' + guest.map(function(x){return x.studentId;}).join(', '));
  const wordPlayers = Number(sample.overview.wordQuestPlayers || 0);
  if (wordPlayers === 0 && sample.overview.wordQuestAccuracyAverage !== null) {
    throw new Error('Word Quest average must be null when official player count is zero');
  }
  return {
    ok:true,
    version:sample.version,
    section:sample.section,
    learners:sample.overview.learners,
    wordQuestPlayers:wordPlayers,
    bossSpeakingEvidence:sample.overview.bossSpeakingEvidence,
    bossPending:sample.overview.bossPending,
    quarantined:sample.dataQuality.quarantinedCount,
    generatedAt:sample.generatedAt
  };
}
