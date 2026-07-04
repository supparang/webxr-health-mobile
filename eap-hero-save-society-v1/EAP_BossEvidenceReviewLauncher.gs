/* EAP Boss Evidence Dashboards Launcher
   Add this file to the same Apps Script project as EAP_Code.gs,
   EAP_EvidenceReview.gs, and EAP_BossFourSkillLedger.gs.
   It intentionally does not define onOpen().
*/

function showEapBossEvidenceReview() {
  const html = HtmlService
    .createHtmlOutputFromFile('EAP_BossEvidenceReview')
    .setWidth(1500)
    .setHeight(900);

  SpreadsheetApp.getUi().showModelessDialog(
    html,
    'EAP Hero · Boss Speaking Review'
  );
}

function showEapBossFourSkillLedger() {
  const html = HtmlService
    .createHtmlOutputFromFile('EAP_BossFourSkillLedger')
    .setWidth(1380)
    .setHeight(820);

  SpreadsheetApp.getUi().showModelessDialog(
    html,
    'EAP Hero · Boss Four-Skill Ledger'
  );
}

function eapBossEvidenceReviewPage_() {
  return HtmlService
    .createHtmlOutputFromFile('EAP_BossEvidenceReview')
    .setTitle('EAP Hero · Boss Speaking Review')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function eapBossFourSkillLedgerPage_() {
  return HtmlService
    .createHtmlOutputFromFile('EAP_BossFourSkillLedger')
    .setTitle('EAP Hero · Boss Four-Skill Ledger')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
