/* EAP Boss Speaking Review Launcher
   Add this file to the same Apps Script project as EAP_Code.gs and
   EAP_EvidenceReview.gs. It intentionally does not define onOpen().
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

function eapBossEvidenceReviewPage_() {
  return HtmlService
    .createHtmlOutputFromFile('EAP_BossEvidenceReview')
    .setTitle('EAP Hero · Boss Speaking Review')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
