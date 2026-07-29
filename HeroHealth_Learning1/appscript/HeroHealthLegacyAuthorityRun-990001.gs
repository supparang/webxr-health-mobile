/**
 * One-click runner for restoring test student 990001.
 * Add this file to the same Apps Script project as HeroHealthLegacyAuthorityPatch-V10.gs.
 */
function HHV10_run_990001() {
  var result = HHV10_reconcileStudent('990001');
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
