/* =========================================================
   EAP Session Authority v139 FAST RESUME + TEST ID COMPAT
   VERSION: 20260812-EAP-SESSION-AUTHORITY-V139-FAST-SUMMARY-TEST-COMPAT

   PURPOSE
   - player_resume must return quickly.
   - Read ONE canonical summary sheet only (EAP_Summary first).
   - Do NOT scan events/evidence sheets during normal resume.
   - Cache learner resume briefly to absorb repeated page loads.
   - Keep Google Sheet as progression authority.
   - Preserve the current canonical QA identity 50/122 while allowing
     historical EAP Hero rows that were stored under 6811000000.

   IMPORTANT
   - The historical alias fallback is TEST-ONLY and applies only to
     section 122 + requested studentId 50.
   - Real student identities are never remapped by this file.
   - Evidence writes remain owned by v137 / existing receiver.
========================================================= */

var EAP_SESSION_AUTHORITY_V138 = '20260812-EAP-SESSION-AUTHORITY-V139-FAST-SUMMARY-TEST-COMPAT';
var EAP_SESSION_V138_CACHE_SEC = 20;
var EAP_SESSION_V138_SUMMARY_SHEETS = ['EAP_Summary','summary','EAP_Attempts'];
var EAP_SESSION_V138_LEGACY_TEST_ALIASES = {
  '122|50':'6811000000'
};
var EAP_SESSION_V138_ORDER = [
  'S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3',
  'S10','S11','S12','B4','S13','S14','S15','B5'
];
var EAP_SESSION_V138_REQUIRED = {
  S1:['Reading','Speaking'], S2:['Reading','Writing'], S3:['Reading','Writing'],
  B1:['Reading','Listening','Writing','Speaking'],
  S4:['Reading','Listening'], S5:['Reading','Writing'], S6:['Writing','Reading'],
  B2:['Reading','Listening','Writing','Speaking'],
  S7:['Writing','Speaking'], S8:['Reading','Writing'], S9:['Writing','Speaking'],
  B3:['Reading','Listening','Writing','Speaking'],
  S10:['Writing','Reading'], S11:['Writing','Speaking'], S12:['Reading','Writing'],
  B4:['Reading','Listening','Writing','Speaking'],
  S13:['Listening','Writing'], S14:['Speaking','Writing'], S15:['Writing','Speaking'],
  B5:['Reading','Listening','Writing','Speaking']
};

function eapV138Text_(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
}

function eapV138Bool_(v) {
  return v === true || String(v).toLowerCase() === 'true' || String(v) === '1' || String(v).toLowerCase() === 'yes';
}

function eapV138Num_(v) {
  var n = Number(v);
  return isFinite(n) ? n : 0;
}

function eapV138Route_(v) {
  var raw = eapV138Text_(v).toUpperCase();
  var m;
  if (/^\d+$/.test(raw)) return 'S' + Number(raw);
  m = raw.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/i);
  if (m) return 'S' + Number(m[1]);
  m = raw.match(/^(?:B|BOSS|GATE|BOSS\s*GATE)\s*0?([1-5])$/i);
  if (m) return 'B' + Number(m[1]);
  return raw;
}

function eapV138Skill_(v) {
  var raw = eapV138Text_(v).toLowerCase().replace(/[^a-z]/g, '');
  if (raw === 'read' || raw === 'reading') return 'Reading';
  if (raw === 'listen' || raw === 'listening') return 'Listening';
  if (raw === 'write' || raw === 'writing') return 'Writing';
  if (raw === 'speak' || raw === 'speaking') return 'Speaking';
  return '';
}

function eapV138Spreadsheet_() {
  if (typeof eapSessionSpreadsheetV137_ === 'function') return eapSessionSpreadsheetV137_();
  if (typeof eapCloudResumeSpreadsheet_ === 'function') return eapCloudResumeSpreadsheet_();
  if (typeof eapSheetV132Spreadsheet_ === 'function') return eapSheetV132Spreadsheet_();
  if (typeof ss_ === 'function') return ss_();
  var id = PropertiesService.getScriptProperties().getProperty('EAP_SPREADSHEET_ID') || '';
  if (!id) throw new Error('EAP_SPREADSHEET_ID is not configured');
  return SpreadsheetApp.openById(id);
}

function eapV138HeaderMap_(headers) {
  var map = {};
  (headers || []).forEach(function(h, i) {
    var k = eapV138Text_(h).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (k && map[k] == null) map[k] = i;
  });
  return map;
}

function eapV138Get_(row, map, names) {
  for (var i = 0; i < names.length; i++) {
    var key = String(names[i]).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (map[key] != null) {
      var value = row[map[key]];
      if (value !== '' && value !== null && value !== undefined) return value;
    }
  }
  return '';
}

function eapV138SummarySheet_() {
  var ss = eapV138Spreadsheet_();
  for (var i = 0; i < EAP_SESSION_V138_SUMMARY_SHEETS.length; i++) {
    var sh = ss.getSheetByName(EAP_SESSION_V138_SUMMARY_SHEETS[i]);
    if (sh) return sh;
  }
  throw new Error('No canonical summary sheet found: ' + EAP_SESSION_V138_SUMMARY_SHEETS.join(', '));
}

function eapV138ReadRecords_(sourceStudentId, section, requestedStudentId) {
  var sh = eapV138SummarySheet_();
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  sourceStudentId = eapV138Text_(sourceStudentId);
  requestedStudentId = eapV138Text_(requestedStudentId || sourceStudentId);

  /* One sheet read only. */
  var values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values.shift();
  var map = eapV138HeaderMap_(headers);
  var out = [];

  values.forEach(function(row) {
    var sid = eapV138Text_(eapV138Get_(row, map, ['studentId','student_id','playerId','id']));
    if (sid !== sourceStudentId) return;
    var sec = eapV138Text_(eapV138Get_(row, map, ['section','classGroup','class','group'])) || section;
    if (sec !== section) return;

    var route = eapV138Route_(eapV138Get_(row, map, ['routeId','sessionId','session','missionId','stage']));
    var skill = eapV138Skill_(eapV138Get_(row, map, ['skill','skillName','skillKey','focusSkill']));
    if (EAP_SESSION_V138_ORDER.indexOf(route) < 0 || !skill) return;

    var score = eapV138Num_(eapV138Get_(row, map, ['bestScore','latestScore','score','teacherScore']));
    var passed = eapV138Bool_(eapV138Get_(row, map, ['passed','pass','mastered','verifiedPassed'])) || score >= 60;
    var reviewStatus = eapV138Text_(eapV138Get_(row, map, ['teacherReviewStatus','reviewStatus'])).toLowerCase();
    var reviewRequired = /^B[1-5]$/.test(route) && skill === 'Speaking';
    if (reviewRequired) {
      passed = passed && !!reviewStatus &&
        !/(pending|revise|revision|rework|needs[_ -]?work|not[_ -]?reviewed)/i.test(reviewStatus) &&
        /(reviewed|approved|accepted|pass|passed|complete|completed)/i.test(reviewStatus);
    }

    var updatedAt = eapV138Text_(eapV138Get_(row, map,
      ['teacherReviewedAt','updatedAt','latestAt','receivedAt','completedAt','clientTimestamp','occurredAt','createdAt']));

    out.push({
      studentId: requestedStudentId,
      sourceStudentId: sourceStudentId,
      studentName: eapV138Text_(eapV138Get_(row, map, ['studentName','name'])),
      section: section,
      routeId: route,
      sessionId: route,
      sessionTitle: eapV138Text_(eapV138Get_(row, map, ['routeTitle','sessionTitle','missionTitle'])),
      skill: skill,
      score: score,
      bestScore: score,
      latestScore: score,
      passed: passed,
      updatedAt: updatedAt,
      latestAt: updatedAt,
      restoredFromSheet: true,
      cloudVerified: true,
      serverVerified: true,
      resumeSource: sourceStudentId === requestedStudentId ? 'fast_summary' : 'fast_summary_legacy_test_alias',
      sourceSheet: sh.getName(),
      teacherReviewRequired: reviewRequired,
      teacherReviewStatus: reviewStatus,
      legacyCompletion: false
    });
  });

  var best = {};
  out.forEach(function(r) {
    var key = r.routeId + '|' + r.skill;
    var cur = best[key];
    if (!cur || (r.passed && !cur.passed) ||
        (r.passed === cur.passed && r.bestScore > cur.bestScore) ||
        (r.passed === cur.passed && r.bestScore === cur.bestScore && String(r.updatedAt) > String(cur.updatedAt))) {
      best[key] = r;
    }
  });
  return Object.keys(best).map(function(k) { return best[k]; });
}

function eapV138BuildProgress_(records) {
  var byKey = {};
  records.forEach(function(r) { byKey[r.routeId + '|' + r.skill] = r; });
  var routeProgress = {}, passedRoutes = [], currentRoute = '', latestActivity = '';

  EAP_SESSION_V138_ORDER.forEach(function(routeId) {
    var required = (EAP_SESSION_V138_REQUIRED[routeId] || []).slice();
    var skills = {}, passedCount = 0;
    required.forEach(function(skill) {
      var r = byKey[routeId + '|' + skill] || null;
      skills[skill] = r || {routeId:routeId,sessionId:routeId,skill:skill,passed:false,score:0,teacherReviewStatus:''};
      if (r && r.passed === true) passedCount++;
      if (r && String(r.updatedAt || '') > latestActivity) latestActivity = r.updatedAt;
    });
    var complete = required.length > 0 && passedCount === required.length;
    routeProgress[routeId] = {
      routeId:routeId,
      routeType:/^B/.test(routeId) ? 'boss_gate' : 'normal_session',
      requiredSkills:required,
      requiredSkillCount:required.length,
      passedSkillCount:passedCount,
      skills:skills,
      completed:complete,
      passed:complete
    };
    if (!currentRoute && complete) passedRoutes.push(routeId);
    else if (!currentRoute) currentRoute = routeId;
  });

  var courseCompleted = !currentRoute;
  if (courseCompleted) currentRoute = 'B5';
  var unlockedRouteList = passedRoutes.slice();
  if (unlockedRouteList.indexOf(currentRoute) < 0) unlockedRouteList.push(currentRoute);
  var unlockedRoutes = {}, unlockedSessions = {};
  unlockedRouteList.forEach(function(r) {
    unlockedRoutes[r] = true;
    var m = r.match(/^S(\d+)$/);
    if (m) unlockedSessions[String(Number(m[1]))] = true;
  });

  return {
    routeProgress:routeProgress,
    passedRoutes:passedRoutes,
    currentRoute:currentRoute,
    courseCompleted:courseCompleted,
    unlockedRouteList:unlockedRouteList,
    unlockedRoutes:unlockedRoutes,
    unlockedSessions:unlockedSessions,
    latestActivity:latestActivity
  };
}

function eapPlayerResumeV138_(params) {
  params = params || {};
  var started = Date.now();
  var studentId = eapV138Text_(params.studentId || params.id || params.playerId);
  var studentName = eapV138Text_(params.studentName || params.name || '');
  var section = eapV138Text_(params.section || '122') || '122';
  if (!studentId) return {ok:false,version:EAP_SESSION_AUTHORITY_V138,error:'missing_studentId'};

  var cache = CacheService.getScriptCache();
  var cacheKey = 'EAP_V139_RESUME|' + section + '|' + studentId;
  if (String(params.force || '') !== '1') {
    var cached = cache.get(cacheKey);
    if (cached) {
      try {
        var parsed = JSON.parse(cached);
        parsed.cacheHit = true;
        parsed.elapsedMs = Date.now() - started;
        return parsed;
      } catch (_) {}
    }
  }

  var sourceStudentId = studentId;
  var records = eapV138ReadRecords_(sourceStudentId, section, studentId);
  var aliasKey = section + '|' + studentId;
  var legacySource = EAP_SESSION_V138_LEGACY_TEST_ALIASES[aliasKey] || '';
  var usedLegacyTestAlias = false;

  if (!records.length && legacySource) {
    records = eapV138ReadRecords_(legacySource, section, studentId);
    if (records.length) {
      sourceStudentId = legacySource;
      usedLegacyTestAlias = true;
    }
  }

  var progress = eapV138BuildProgress_(records);
  if (!studentName && records.length) studentName = records[0].studentName || '';

  var response = {
    ok:true,
    service:'eap-session-authority',
    version:EAP_SESSION_AUTHORITY_V138,
    authorityMode:'sheet-only-fast-summary',
    progressPolicy:'normal-core-support-boss-four-skills-speaking-reviewed',
    studentId:studentId,
    requestedStudentId:studentId,
    sourceStudentId:sourceStudentId,
    usedLegacyTestAlias:usedLegacyTestAlias,
    studentName:studentName || 'Student',
    section:section,
    records:records,
    recordCount:records.length,
    routeProgress:progress.routeProgress,
    sessionProgress:progress.routeProgress,
    passedRoutes:progress.passedRoutes,
    completedRoutes:progress.passedRoutes,
    unlockedRouteList:progress.unlockedRouteList,
    unlockedRoutes:progress.unlockedRoutes,
    unlockedSessions:progress.unlockedSessions,
    currentRoute:progress.currentRoute,
    currentCloudRoute:progress.currentRoute,
    nextRoute:progress.currentRoute,
    courseCompleted:progress.courseCompleted,
    requiredSkillsByRoute:EAP_SESSION_V138_REQUIRED,
    latestActivity:progress.latestActivity,
    generatedAt:new Date().toISOString(),
    cacheHit:false,
    elapsedMs:Date.now()-started
  };

  try { cache.put(cacheKey, JSON.stringify(response), EAP_SESSION_V138_CACHE_SEC); } catch (_) {}
  return response;
}

function EAP_testPlayerResumeV138() {
  var result = eapPlayerResumeV138_({studentId:'50',section:'122',force:'1'});
  Logger.log(JSON.stringify(result));
  return result;
}
