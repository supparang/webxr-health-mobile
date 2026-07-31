/* =========================================================
   EAP Session Authority v137
   Production patch for the shared EAP Apps Script project.

   Fixes
   1. Normal S1-S15 unlock from Core + Support only.
   2. Exposure evidence is retained but never blocks progression.
   3. Boss B1-B5 require all four skills.
   4. Boss Speaking remains failed while teacher review is pending.
   5. submit_evidence rows are written to a resume-readable events sheet.
   6. player_resume merges those evidence rows and returns the official route.

   Deploy with SharedWebAppRouter.gs from the same repository revision.
========================================================= */

var EAP_SESSION_AUTHORITY_V137 = 'v20260731-EAP-SESSION-AUTHORITY-V137-CORE-SUPPORT-BOSS-EVIDENCE';
var EAP_SESSION_ROUTE_ORDER_V137 = [
  'S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3',
  'S10','S11','S12','B4','S13','S14','S15','B5'
];
var EAP_SESSION_REQUIRED_SKILLS_V137 = {
  S1:['Reading','Speaking'],
  S2:['Reading','Writing'],
  S3:['Reading','Writing'],
  B1:['Reading','Listening','Writing','Speaking'],
  S4:['Reading','Listening'],
  S5:['Reading','Writing'],
  S6:['Writing','Reading'],
  B2:['Reading','Listening','Writing','Speaking'],
  S7:['Writing','Speaking'],
  S8:['Reading','Writing'],
  S9:['Writing','Speaking'],
  B3:['Reading','Listening','Writing','Speaking'],
  S10:['Writing','Reading'],
  S11:['Writing','Speaking'],
  S12:['Reading','Writing'],
  B4:['Reading','Listening','Writing','Speaking'],
  S13:['Listening','Writing'],
  S14:['Speaking','Writing'],
  S15:['Writing','Speaking'],
  B5:['Reading','Listening','Writing','Speaking']
};
var EAP_SESSION_EVIDENCE_SHEETS_V137 = [
  'events','evidence','EAP_Evidence','eap-v132-events'
];
var EAP_SESSION_EVENT_HEADERS_V137 = [
  'eventId','createdAt','section','studentId','studentName',
  'eventType','sessionId','skill','valueJson'
];

function eapSessionTextV137_(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function eapSessionNumberV137_(value, fallback) {
  var number = Number(value);
  return isFinite(number) ? number : (fallback == null ? 0 : fallback);
}

function eapSessionBoolV137_(value) {
  return value === true || String(value).toLowerCase() === 'true' ||
    String(value) === '1' || String(value).toLowerCase() === 'yes';
}

function eapSessionTimeV137_(value) {
  var time = new Date(String(value || '')).getTime();
  return isFinite(time) ? time : 0;
}

function eapSessionRouteV137_(value) {
  var raw = eapSessionTextV137_(value).toUpperCase();
  var match;
  if (/^\d+$/.test(raw)) return 'S' + Number(raw);
  match = raw.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/i);
  if (match) return 'S' + Number(match[1]);
  match = raw.match(/^(?:B|BOSS|GATE|BOSS\s*GATE)\s*0?([1-5])$/i);
  if (match) return 'B' + Number(match[1]);
  return raw;
}

function eapSessionSkillV137_(value) {
  var raw = eapSessionTextV137_(value).toLowerCase().replace(/[^a-z]/g, '');
  if (raw === 'reading' || raw === 'read') return 'Reading';
  if (raw === 'listening' || raw === 'listen') return 'Listening';
  if (raw === 'writing' || raw === 'write') return 'Writing';
  if (raw === 'speaking' || raw === 'speak') return 'Speaking';
  return '';
}

function eapSessionSpreadsheetV137_() {
  if (typeof eapCloudResumeSpreadsheet_ === 'function') return eapCloudResumeSpreadsheet_();
  if (typeof eapSheetV132Spreadsheet_ === 'function') return eapSheetV132Spreadsheet_();
  if (typeof ss_ === 'function') return ss_();
  var id = '';
  try {
    id = PropertiesService.getScriptProperties().getProperty('EAP_SPREADSHEET_ID') || '';
  } catch (error) {}
  if (!id) throw new Error('EAP_SPREADSHEET_ID is not configured');
  return SpreadsheetApp.openById(id);
}

function eapSessionParseJsonV137_(value) {
  try {
    var parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

function eapSessionObjectV137_(headers, row) {
  var object = {};
  (headers || []).forEach(function(header, index) {
    if (header) object[header] = row[index];
  });
  return object;
}

function eapSessionMergeV137_(nested, direct) {
  var output = {};
  Object.keys(nested || {}).forEach(function(key) { output[key] = nested[key]; });
  Object.keys(direct || {}).forEach(function(key) {
    var value = direct[key];
    if (value !== '' && value !== null && value !== undefined) output[key] = value;
  });
  return output;
}

function eapSessionPickV137_(object, keys) {
  for (var index = 0; index < keys.length; index += 1) {
    var value = object[keys[index]];
    if (value !== '' && value !== null && value !== undefined) return value;
  }
  return '';
}

function eapSessionHeaderIndexV137_(headers, names) {
  var normalized = (headers || []).map(function(header) {
    return eapSessionTextV137_(header).toLowerCase();
  });
  for (var index = 0; index < names.length; index += 1) {
    var found = normalized.indexOf(String(names[index]).toLowerCase());
    if (found >= 0) return found;
  }
  return -1;
}

function eapSessionEnsureEventsSheetV137_() {
  var spreadsheet = eapSessionSpreadsheetV137_();
  var sheet = spreadsheet.getSheetByName('events');
  if (!sheet) sheet = spreadsheet.insertSheet('events');

  var lastColumn = sheet.getLastColumn();
  var headers = lastColumn > 0
    ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(eapSessionTextV137_)
    : [];

  EAP_SESSION_EVENT_HEADERS_V137.forEach(function(required) {
    if (headers.indexOf(required) < 0) headers.push(required);
  });

  if (headers.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return { sheet:sheet, headers:headers };
}

function eapSessionEvidenceExistsV137_(sheet, headers, evidenceId) {
  var eventColumn = eapSessionHeaderIndexV137_(headers, ['eventId','evidenceId']);
  if (eventColumn < 0 || sheet.getLastRow() < 2) return false;
  var matches = sheet.getRange(2, eventColumn + 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(evidenceId)).matchEntireCell(true).findAll();
  return matches.length > 0;
}

function eapSubmitEvidenceV137_(payload) {
  payload = payload || {};
  var evidenceId = eapSessionTextV137_(payload.evidenceId || payload.eventId || payload.rawEvidenceId);
  var routeId = eapSessionRouteV137_(payload.routeId || payload.sessionId || payload.session || payload.stage);
  var skill = eapSessionSkillV137_(payload.skill || payload.skillName || payload.focusSkill);
  var studentId = eapSessionTextV137_(payload.studentId || payload.student_id || payload.playerId || payload.id);
  var section = eapSessionTextV137_(payload.section || '122') || '122';

  if (!evidenceId || !studentId || EAP_SESSION_ROUTE_ORDER_V137.indexOf(routeId) < 0 || !skill) {
    return {
      ok:false,
      version:EAP_SESSION_AUTHORITY_V137,
      error:'evidenceId, studentId, valid routeId/sessionId and skill are required'
    };
  }

  var requiredReview = /^B[1-5]$/.test(routeId) && skill === 'Speaking';
  var reviewStatus = eapSessionTextV137_(payload.teacherReviewStatus || payload.reviewStatus ||
    (requiredReview ? 'pending_teacher_review' : 'not_required')).toLowerCase();
  var now = new Date().toISOString();
  var normalized = {};
  Object.keys(payload).forEach(function(key) { normalized[key] = payload[key]; });
  normalized.evidenceId = evidenceId;
  normalized.eventId = evidenceId;
  normalized.section = section;
  normalized.studentId = studentId;
  normalized.studentName = eapSessionTextV137_(payload.studentName || payload.name || 'Student');
  normalized.routeId = routeId;
  normalized.sessionId = routeId;
  normalized.skill = skill;
  normalized.score = eapSessionNumberV137_(payload.score, 0);
  normalized.passed = eapSessionBoolV137_(payload.passed) || normalized.score >= 60;
  normalized.teacherReviewRequired = requiredReview || eapSessionBoolV137_(payload.teacherReviewRequired);
  normalized.teacherReviewStatus = reviewStatus;
  normalized.occurredAt = eapSessionTextV137_(payload.occurredAt || payload.clientTimestamp || now);
  normalized.createdAt = eapSessionTextV137_(payload.createdAt || now);
  normalized.sessionAuthorityVersion = EAP_SESSION_AUTHORITY_V137;

  var target = eapSessionEnsureEventsSheetV137_();
  if (eapSessionEvidenceExistsV137_(target.sheet, target.headers, evidenceId)) {
    return {
      ok:true,
      duplicate:true,
      created:false,
      evidenceId:evidenceId,
      routeId:routeId,
      skill:skill,
      teacherReviewRequired:normalized.teacherReviewRequired,
      teacherReviewStatus:reviewStatus,
      version:EAP_SESSION_AUTHORITY_V137
    };
  }

  var rowObject = {
    eventId:evidenceId,
    createdAt:now,
    section:section,
    studentId:studentId,
    studentName:normalized.studentName,
    eventType:requiredReview ? 'eap_boss_speaking_evidence' : 'eap_learning_evidence',
    sessionId:routeId,
    skill:skill,
    valueJson:JSON.stringify(normalized)
  };
  var row = target.headers.map(function(header) {
    return rowObject.hasOwnProperty(header) ? rowObject[header] : '';
  });
  target.sheet.appendRow(row);
  SpreadsheetApp.flush();

  return {
    ok:true,
    duplicate:false,
    created:true,
    evidenceId:evidenceId,
    routeId:routeId,
    skill:skill.toLowerCase(),
    contractScope:requiredReview ? 'integrated' : 'evidence',
    teacherReviewRequired:normalized.teacherReviewRequired,
    teacherReviewStatus:reviewStatus,
    contractWarnings:[],
    version:EAP_SESSION_AUTHORITY_V137
  };
}

function eapSessionNormalizeEvidenceV137_(object, sheetName, studentId, section) {
  var routeId = eapSessionRouteV137_(eapSessionPickV137_(object,
    ['routeId','sessionId','session','missionId','stage']));
  var skill = eapSessionSkillV137_(eapSessionPickV137_(object,
    ['skill','skillName','skillKey','focusSkill']));
  if (EAP_SESSION_ROUTE_ORDER_V137.indexOf(routeId) < 0 || !skill) return null;

  var score = eapSessionNumberV137_(eapSessionPickV137_(object,
    ['bestScore','latestScore','score','teacherScore']), 0);
  var requiredReview = /^B[1-5]$/.test(routeId) && skill === 'Speaking';
  var reviewStatus = eapSessionTextV137_(object.teacherReviewStatus || object.reviewStatus || '').toLowerCase();
  var reviewPassed = !requiredReview || (
    !!reviewStatus &&
    !/(pending|revise|revision|rework|needs[_ -]?work|not[_ -]?reviewed)/i.test(reviewStatus) &&
    /(reviewed|approved|accepted|pass|passed|complete|completed)/i.test(reviewStatus)
  );
  var basePassed = eapSessionBoolV137_(eapSessionPickV137_(object,
    ['passed','pass','mastered','verifiedPassed'])) || score >= 60;
  var updatedAt = eapSessionTextV137_(eapSessionPickV137_(object,
    ['teacherReviewedAt','updatedAt','latestAt','receivedAt','completedAt',
      'clientTimestamp','occurredAt','createdAt'])) || new Date().toISOString();

  return {
    studentId:studentId,
    studentName:eapSessionTextV137_(object.studentName || object.name || ''),
    section:section,
    routeId:routeId,
    sessionId:routeId,
    sessionTitle:eapSessionTextV137_(object.routeTitle || object.sessionTitle || object.missionTitle || ''),
    skill:skill,
    score:score,
    bestScore:score,
    latestScore:score,
    accuracy:eapSessionNumberV137_(object.accuracy || object.bestAccuracy, ''),
    bestAccuracy:eapSessionNumberV137_(object.bestAccuracy || object.accuracy, ''),
    passed:basePassed && reviewPassed,
    updatedAt:updatedAt,
    latestAt:updatedAt,
    restoredFromSheet:true,
    cloudVerified:true,
    serverVerified:true,
    resumeSource:'server_' + sheetName,
    sourceSheet:sheetName,
    attemptId:eapSessionTextV137_(object.attemptId || ''),
    evidenceId:eapSessionTextV137_(object.evidenceId || object.eventId || ''),
    teacherReviewRequired:requiredReview || eapSessionBoolV137_(object.teacherReviewRequired),
    teacherReviewStatus:reviewStatus,
    legacyCompletion:eapSessionBoolV137_(object.legacyCompletion)
  };
}

function eapSessionEvidenceRowsV137_(studentId, section) {
  var spreadsheet = eapSessionSpreadsheetV137_();
  var records = [];

  EAP_SESSION_EVIDENCE_SHEETS_V137.forEach(function(sheetName) {
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) return;
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(eapSessionTextV137_);
    var studentColumn = eapSessionHeaderIndexV137_(headers,
      ['studentId','student_id','playerId','id']);
    if (studentColumn < 0) return;
    var matches = sheet.getRange(2, studentColumn + 1, sheet.getLastRow() - 1, 1)
      .createTextFinder(studentId).matchEntireCell(true).findAll();

    matches.forEach(function(cell) {
      var row = sheet.getRange(cell.getRow(), 1, 1, headers.length).getValues()[0];
      var direct = eapSessionObjectV137_(headers, row);
      var nested = eapSessionParseJsonV137_(direct.valueJson || direct.rawJson ||
        direct.payloadJson || direct.evidenceJson || '');
      var object = eapSessionMergeV137_(nested, direct);
      var foundId = eapSessionTextV137_(eapSessionPickV137_(object,
        ['studentId','student_id','playerId','id']));
      var foundSection = eapSessionTextV137_(eapSessionPickV137_(object,
        ['section','classGroup','class','group'])) || section;
      if (foundId !== studentId || foundSection !== section) return;
      var normalized = eapSessionNormalizeEvidenceV137_(object, sheetName, studentId, section);
      if (normalized && !normalized.legacyCompletion) records.push(normalized);
    });
  });

  return records;
}

function eapSessionReviewRankV137_(record) {
  var status = eapSessionTextV137_(record && record.teacherReviewStatus).toLowerCase();
  if (/(reviewed|approved|accepted|pass|passed|complete|completed)/.test(status) &&
      !/(pending|revise|revision|rework|needs[_ -]?work)/.test(status)) return 4;
  if (/(revise|revision|rework|needs[_ -]?work)/.test(status)) return 2;
  if (/pending/.test(status)) return 1;
  return record && record.teacherReviewRequired ? 0 : 3;
}

function eapSessionDeduplicateV137_(rows) {
  var best = {};
  (rows || []).forEach(function(record) {
    var routeId = eapSessionRouteV137_(record.routeId || record.sessionId);
    var skill = eapSessionSkillV137_(record.skill);
    if (EAP_SESSION_ROUTE_ORDER_V137.indexOf(routeId) < 0 || !skill) return;
    record.routeId = routeId;
    record.sessionId = routeId;
    record.skill = skill;
    var key = routeId + '|' + skill;
    var current = best[key];
    if (!current) {
      best[key] = record;
      return;
    }

    var bossSpeaking = /^B[1-5]$/.test(routeId) && skill === 'Speaking';
    if (bossSpeaking) {
      var reviewRank = eapSessionReviewRankV137_(record);
      var currentReviewRank = eapSessionReviewRankV137_(current);
      if (reviewRank !== currentReviewRank) {
        if (reviewRank > currentReviewRank) best[key] = record;
        return;
      }
    }
    if (record.passed === true && current.passed !== true) {
      best[key] = record;
      return;
    }
    if (record.passed !== true && current.passed === true) return;
    if (eapSessionNumberV137_(record.bestScore || record.score, 0) >
        eapSessionNumberV137_(current.bestScore || current.score, 0)) {
      best[key] = record;
      return;
    }
    if (eapSessionTimeV137_(record.updatedAt) > eapSessionTimeV137_(current.updatedAt)) {
      best[key] = record;
    }
  });

  return Object.keys(best).map(function(key) { return best[key]; }).sort(function(a, b) {
    var routeDiff = EAP_SESSION_ROUTE_ORDER_V137.indexOf(a.sessionId) -
      EAP_SESSION_ROUTE_ORDER_V137.indexOf(b.sessionId);
    return routeDiff || String(a.skill).localeCompare(String(b.skill));
  });
}

function eapSessionBuildProgressV137_(records) {
  var byKey = {};
  (records || []).forEach(function(record) {
    byKey[record.sessionId + '|' + record.skill] = record;
  });

  var routeProgress = {};
  var passedRoutes = [];
  var currentRoute = '';
  var latestActivity = '';

  EAP_SESSION_ROUTE_ORDER_V137.forEach(function(routeId) {
    var required = (EAP_SESSION_REQUIRED_SKILLS_V137[routeId] || []).slice();
    var skills = {};
    var passedCount = 0;
    required.forEach(function(skill) {
      var record = byKey[routeId + '|' + skill] || null;
      skills[skill] = record || {
        routeId:routeId,
        sessionId:routeId,
        skill:skill,
        passed:false,
        score:0,
        teacherReviewStatus:''
      };
      if (record && record.passed === true) passedCount += 1;
      if (record && String(record.updatedAt || '') > latestActivity) latestActivity = record.updatedAt;
    });
    var completed = required.length > 0 && passedCount === required.length;
    routeProgress[routeId] = {
      routeId:routeId,
      routeType:/^B/.test(routeId) ? 'boss_gate' : 'normal_session',
      requiredSkills:required,
      requiredSkillCount:required.length,
      passedSkillCount:passedCount,
      skills:skills,
      completed:completed,
      passed:completed
    };
    if (!currentRoute && completed) passedRoutes.push(routeId);
    else if (!currentRoute) currentRoute = routeId;
  });

  var courseCompleted = !currentRoute;
  if (courseCompleted) currentRoute = 'B5';
  var unlockedRouteList = passedRoutes.slice();
  if (unlockedRouteList.indexOf(currentRoute) < 0) unlockedRouteList.push(currentRoute);
  var unlockedRoutes = {};
  var unlockedSessions = {};
  unlockedRouteList.forEach(function(routeId) {
    unlockedRoutes[routeId] = true;
    var match = routeId.match(/^S(\d+)$/);
    if (match) unlockedSessions[String(Number(match[1]))] = true;
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

function eapPlayerResumeV137_(params) {
  params = params || {};
  var studentId = eapSessionTextV137_(params.studentId || params.id || params.playerId);
  var requestedName = eapSessionTextV137_(params.studentName || params.name || '');
  var section = eapSessionTextV137_(params.section || '122') || '122';
  if (!studentId) {
    return {ok:false,version:EAP_SESSION_AUTHORITY_V137,error:'missing_studentId'};
  }

  var base = {};
  if (typeof eapPlayerResume_ === 'function') {
    try { base = eapPlayerResume_(params) || {}; } catch (error) {
      base = {ok:false,baseResumeError:String(error && error.message || error)};
    }
  }
  var evidenceRows = eapSessionEvidenceRowsV137_(studentId, section);
  var records = eapSessionDeduplicateV137_((base.records || []).concat(evidenceRows));
  var official = eapSessionBuildProgressV137_(records);

  var response = {};
  Object.keys(base || {}).forEach(function(key) { response[key] = base[key]; });
  response.ok = true;
  response.service = 'eap-session-authority';
  response.version = EAP_SESSION_AUTHORITY_V137;
  response.authorityMode = 'sheet-only';
  response.progressPolicy = 'normal-core-support-boss-four-skills-speaking-reviewed';
  response.studentId = studentId;
  response.studentName = eapSessionTextV137_(base.studentName ||
    (base.student && base.student.studentName) || requestedName || 'Student');
  response.requestedName = requestedName;
  response.section = section;
  response.records = records;
  response.recordCount = records.length;
  response.routeProgress = official.routeProgress;
  response.sessionProgress = official.routeProgress;
  response.passedRoutes = official.passedRoutes;
  response.completedRoutes = official.passedRoutes;
  response.unlockedRouteList = official.unlockedRouteList;
  response.unlockedRoutes = official.unlockedRoutes;
  response.unlockedSessions = official.unlockedSessions;
  response.currentRoute = official.currentRoute;
  response.currentCloudRoute = official.currentRoute;
  response.nextRoute = official.currentRoute;
  response.courseCompleted = official.courseCompleted;
  response.requiredSkillsByRoute = EAP_SESSION_REQUIRED_SKILLS_V137;
  response.latestActivity = official.latestActivity || base.latestActivity || '';
  response.evidenceRowsMerged = evidenceRows.length;
  response.generatedAt = new Date().toISOString();
  response.serverRevision = EAP_SESSION_AUTHORITY_V137 + '-' + response.generatedAt;
  return response;
}
