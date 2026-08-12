/* =========================================================
   EAP Progress Seed v152 BULK
   Fast one-time seed for test account 50 only.
   Requires EAP_ProgressAuthority_v150.gs in the same project.
   Writes 6 route rows in one setValues() call.
========================================================= */

var EAP_PROGRESS_SEED_V152_VERSION = '20260812-EAP-PROGRESS-SEED-V152-BULK';

function eapProgressSeedTest50V152_() {
  if (typeof eapProgressV150EnsureSheet_ !== 'function' || typeof eapPlayerResumeV150_ !== 'function') {
    return {ok:false, service:'eap-progress-seed', version:EAP_PROGRESS_SEED_V152_VERSION, error:'EAP_ProgressAuthority_v150.gs is not installed'};
  }

  var target = eapProgressV150EnsureSheet_();
  var sh = target.sheet;
  var headers = target.headers;
  var now = new Date().toISOString();
  var studentId = '50';
  var section = '122';
  var studentName = 'KK';

  var routes = [
    {routeId:'S1', Reading:[100,true], Speaking:[100,true]},
    {routeId:'S2', Reading:[100,true], Writing:[61,true]},
    {routeId:'S3', Reading:[100,true], Writing:[88,true]},
    {routeId:'B1', Reading:[100,true], Listening:[100,true], Writing:[100,true], Speaking:[100,true], speakingReviewStatus:'approved'},
    {routeId:'S4', Reading:[100,true], Listening:[97,true]},
    {routeId:'S5', Reading:[66,true]}
  ];

  /* Remove existing rows for test account 50 only, preserving all other students. */
  if (sh.getLastRow() >= 2) {
    var map = target.map;
    var keys = sh.getRange(2, map.studentKey + 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = keys.length - 1; i >= 0; i--) {
      if (String(keys[i][0] || '') === '122|50') sh.deleteRow(i + 2);
    }
  }

  var rows = routes.map(function(route) {
    var obj = {};
    headers.forEach(function(h){ obj[h] = ''; });
    var routeId = route.routeId;
    obj.progressKey = section + '|' + studentId + '|' + routeId;
    obj.studentKey = section + '|' + studentId;
    obj.section = section;
    obj.studentId = studentId;
    obj.studentName = studentName;
    obj.routeId = routeId;
    obj.routeType = /^B/.test(routeId) ? 'boss_gate' : 'normal_session';

    ['Reading','Listening','Writing','Speaking'].forEach(function(skill) {
      if (!route[skill]) return;
      var p = skill.toLowerCase();
      obj[p + 'Score'] = route[skill][0];
      obj[p + 'Passed'] = route[skill][1] === true;
      obj[p + 'EvidenceId'] = 'seed-v152-50-' + routeId + '-' + p;
      obj[p + 'UpdatedAt'] = now;
    });
    if (route.speakingReviewStatus) obj.speakingReviewStatus = route.speakingReviewStatus;

    var required = EAP_PROGRESS_V150_REQUIRED[routeId] || [];
    var passedCount = 0;
    required.forEach(function(skill) {
      var p = skill.toLowerCase();
      if (obj[p + 'Passed'] === true) passedCount++;
    });
    obj.requiredSkillCount = required.length;
    obj.passedSkillCount = passedCount;
    obj.completed = required.length > 0 && passedCount === required.length;
    obj.updatedAt = now;
    obj.sourceVersion = EAP_PROGRESS_SEED_V152_VERSION;
    return headers.map(function(h){ return obj[h] === undefined ? '' : obj[h]; });
  });

  if (rows.length) {
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  }
  SpreadsheetApp.flush();

  var resume = eapPlayerResumeV150_({studentId:studentId, section:section});
  return {
    ok:true,
    service:'eap-progress-seed',
    version:EAP_PROGRESS_SEED_V152_VERSION,
    seededRows:rows.length,
    currentRoute:resume.currentRoute,
    s5:resume.routeProgress && resume.routeProgress.S5 ? resume.routeProgress.S5 : null,
    elapsedMs:resume.elapsedMs
  };
}

function EAP_progressSeedTest50V152(){
  var result = eapProgressSeedTest50V152_();
  Logger.log(JSON.stringify(result));
  return result;
}
