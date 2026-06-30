/* EAP Word Quest v254 restore runners — paste with EAPWordQuestRestore-v254.gs */
function previewEapWordQuestRestoreV254() {
  var result = inspectEapWordQuestRestoreV254();
  console.log(JSON.stringify(result));
  Logger.log(JSON.stringify(result));
  return result;
}

function runEapWordQuestRestoreV254() {
  var preview = inspectEapWordQuestRestoreV254();
  console.log(JSON.stringify(preview));
  if (!preview.ok) throw new Error(preview.message || 'Restore preview is not safe.');
  var result = applyEapWordQuestRestoreV254();
  console.log(JSON.stringify(result));
  Logger.log(JSON.stringify(result));
  return result;
}
