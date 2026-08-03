/**
 * English Week Passport • Google Sheets Authority V1
 * Version: 2026-08-03-PASSPORT-V1
 *
 * Standalone Apps Script Web App.
 * Google Sheet is the source of truth for profile, progression, scores,
 * unlocks, leaderboard, and certificates.
 */

var EW_VERSION = '2026-08-03-PASSPORT-V1';
var EW_TIMEZONE = 'Asia/Bangkok';
var EW_ALLOW_GUEST_REGISTRATION = false;
var EW_FLOW = [
  'pre_challenge',
  'word_match',
  'category_forest',
  'sentence_city',
  'word_detective',
  'final_boss',
  'post_challenge',
  'certificate'
];
var EW_PASS_MARKS = {
  word_match: 70,
  category_forest: 70,
  sentence_city: 70,
  word_detective: 70,
  final_boss: 65
};

var EW_SHEETS = {
  profiles: 'EW_Profiles',
  assessments: 'EW_Assessments',
  assessmentItems: 'EW_Assessment_Items',
  gameResults: 'EW_Game_Results',
  gameSummary: 'EW_Game_Summary',
  progress: 'EW_Progress',
  live: 'EW_Live_Status',
  certificates: 'EW_Certificates',
  events: 'EW_Events',
  errors: 'EW_Errors'
};

var EW_HEADERS = {};
EW_HEADERS[EW_SHEETS.profiles] = [
  'playerId','fullName','nickname','groupName','institution','active',
  'createdAt','updatedAt','lastSeenAt'
];
EW_HEADERS[EW_SHEETS.assessments] = [
  'assessmentId','submittedAt','playerId','fullName','groupName','assessmentType',
  'formId','score','total','accuracy','durationMs','answersJson','sourceVersion'
];
EW_HEADERS[EW_SHEETS.assessmentItems] = [
  'assessmentId','submittedAt','playerId','assessmentType','formId','itemId',
  'selected','correctAnswer','correct','answeredAtMs'
];
EW_HEADERS[EW_SHEETS.gameResults] = [
  'resultId','submittedAt','playerId','fullName','groupName','stageId','score',
  'total','accuracy','passMark','passed','durationMs','attemptNo','clientPoints',
  'answersJson','sourceVersion','receiptId'
];
EW_HEADERS[EW_SHEETS.gameSummary] = [
  'playerId','stageId','bestScore','bestAccuracy','passed','attempts','lastPlayedAt','updatedAt'
];
EW_HEADERS[EW_SHEETS.progress] = [
  'playerId','currentStage','unlockedJson','passedJson','bestScoresJson','preDone',
  'postDone','finalDone','certificateEligible','certificateJson','totalScore','updatedAt'
];
EW_HEADERS[EW_SHEETS.live] = [
  'playerId','fullName','groupName','status','currentStage','lastSeenAt','deviceInfo'
];
EW_HEADERS[EW_SHEETS.certificates] = [
  'certificateId','issuedAt','playerId','fullName','groupName','awardLevel','totalScore','active'
];
EW_HEADERS[EW_SHEETS.events] = [
  'eventId','eventAt','playerId','eventName','stageId','payloadJson','sourceVersion'
];
EW_HEADERS[EW_SHEETS.errors] = [
  'errorId','errorAt','action','playerId','message','stack','payloadJson','sourceVersion'
];

function doGet(e) {
  var params = (e && e.parameter) || {};
  var action = String(params.action || 'health').trim();
  var callback = String(params.callback || '').trim();
  try {
    var result;
    if (action === 'health') result = EW_health_();
    else if (action === 'profile_lookup') result = EW_profileLookup_(params);
    else if (action === 'player_resume') result = EW_playerResume_(params);
    else if (action === 'leaderboard') result = EW_leaderboard_(params);
    else result = { ok:false, error:'UNKNOWN_ACTION', action:action, version:EW_VERSION };
    return EW_output_(result, callback);
  } catch (error) {
    EW_logError_(action, params.playerId, error, params);
    return EW_output_({ ok:false, error:String(error.message || error), version:EW_VERSION }, callback);
  }
}

function doPost(e) {
  var payload = {};
  var action = '';
  try {
    payload = EW_parsePost_(e);
    action = String(payload.action || '').trim();
    var result;
    if (action === 'submit_assessment') result = EW_submitAssessment_(payload);
    else if (action === 'submit_game_result') result = EW_submitGameResult_(payload);
    else if (action === 'submit_event') result = EW_submitEvent_(payload);
    else result = { ok:false, error:'UNKNOWN_ACTION', action:action, version:EW_VERSION };
    return EW_output_(result, '');
  } catch (error) {
    EW_logError_(action, payload.playerId, error, payload);
    return EW_output_({ ok:false, error:String(error.message || error), version:EW_VERSION }, '');
  }
}

function EW_setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(EW_HEADERS).forEach(function(name) {
    var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    var headers = EW_HEADERS[name];
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    } else {
      var existing = sheet.getRange(1, 1, 1, Math.max(headers.length, sheet.getLastColumn())).getValues()[0];
      headers.forEach(function(header, index) {
        if (!existing[index]) sheet.getRange(1, index + 1).setValue(header);
      });
    }
    sheet.autoResizeColumns(1, headers.length);
  });
  return { ok:true, version:EW_VERSION, sheets:Object.keys(EW_HEADERS) };
}

function EW_health_() {
  return {
    ok:true,
    service:'English Week Passport Authority',
    version:EW_VERSION,
    serverTime:EW_now_(),
    flow:EW_FLOW,
    passMarks:EW_PASS_MARKS
  };
}

function EW_profileLookup_(params) {
  var playerId = EW_cleanId_(params.playerId);
  if (!playerId) throw new Error('PLAYER_ID_REQUIRED');
  EW_assertSetup_();
  var profile = EW_findProfile_(playerId);
  if (!profile) return { ok:false, error:'PLAYER_NOT_FOUND', playerId:playerId, version:EW_VERSION };
  if (!EW_truthy_(profile.active)) return { ok:false, error:'PLAYER_INACTIVE', playerId:playerId, version:EW_VERSION };
  EW_touchLive_(profile, 'profile_lookup', 'login');
  return { ok:true, profile:profile, version:EW_VERSION };
}

function EW_playerResume_(params) {
  var playerId = EW_cleanId_(params.playerId);
  if (!playerId) throw new Error('PLAYER_ID_REQUIRED');
  EW_assertSetup_();
  var profile = EW_findProfile_(playerId);
  if (!profile) return { ok:false, error:'PLAYER_NOT_FOUND', playerId:playerId, version:EW_VERSION };
  if (!EW_truthy_(profile.active)) return { ok:false, error:'PLAYER_INACTIVE', playerId:playerId, version:EW_VERSION };
  var progress = EW_getOrCreateProgress_(playerId);
  EW_touchProfile_(profile);
  EW_touchLive_(profile, 'online', progress.currentStage);
  return EW_authority_(profile, progress);
}

function EW_submitAssessment_(payload) {
  return EW_withLock_(function() {
    EW_assertSetup_();
    var playerId = EW_cleanId_(payload.playerId);
    var profile = EW_requireProfile_(playerId);
    var progress = EW_getOrCreateProgress_(playerId);
    var assessmentType = String(payload.assessmentType || '').toLowerCase();
    if (assessmentType !== 'pre' && assessmentType !== 'post') throw new Error('INVALID_ASSESSMENT_TYPE');
    if (assessmentType === 'post' && progress.passed.indexOf('final_boss') === -1) throw new Error('POST_NOT_UNLOCKED');

    var score = EW_int_(payload.score, 0);
    var total = EW_int_(payload.total, 0);
    if (total <= 0 || score < 0 || score > total) throw new Error('INVALID_SCORE');
    var accuracy = Math.round((score / total) * 100);
    var now = EW_now_();
    var assessmentId = EW_uid_('EWA');
    var answers = EW_array_(payload.answers);

    EW_append_(EW_SHEETS.assessments, [
      assessmentId, now, playerId, profile.fullName, profile.groupName, assessmentType,
      String(payload.formId || ''), score, total, accuracy, EW_int_(payload.durationMs, 0),
      EW_json_(answers), String(payload.sourceVersion || EW_VERSION)
    ]);

    answers.forEach(function(answer) {
      EW_append_(EW_SHEETS.assessmentItems, [
        assessmentId, now, playerId, assessmentType, String(payload.formId || ''),
        String(answer.itemId || ''), String(answer.selected || ''), String(answer.correctAnswer || ''),
        EW_truthy_(answer.correct), EW_int_(answer.answeredAtMs, 0)
      ]);
    });

    if (assessmentType === 'pre') progress.preDone = true;
    if (assessmentType === 'post') {
      progress.postDone = true;
      progress.certificateEligible = true;
      if (!progress.certificate || !progress.certificate.certificateId) {
        progress.certificate = EW_issueCertificate_(profile, progress);
      }
    }
    progress = EW_reconcileProgress_(progress);
    EW_saveProgress_(progress);
    EW_touchLive_(profile, assessmentType + '_submitted', progress.currentStage);
    var receiptId = EW_uid_('EWR');
    return {
      ok:true,
      receiptId:receiptId,
      assessmentId:assessmentId,
      authority:EW_authority_(profile, progress),
      version:EW_VERSION
    };
  });
}

function EW_submitGameResult_(payload) {
  return EW_withLock_(function() {
    EW_assertSetup_();
    var playerId = EW_cleanId_(payload.playerId);
    var stageId = String(payload.stageId || '').trim();
    if (!EW_PASS_MARKS.hasOwnProperty(stageId)) throw new Error('INVALID_STAGE');
    var profile = EW_requireProfile_(playerId);
    var progress = EW_getOrCreateProgress_(playerId);
    if (progress.unlocked.indexOf(stageId) === -1) throw new Error('STAGE_LOCKED');

    var score = EW_int_(payload.score, 0);
    var total = EW_int_(payload.total, 0);
    if (total <= 0 || score < 0 || score > total) throw new Error('INVALID_SCORE');
    var accuracy = Math.round((score / total) * 100);
    var passMark = Number(EW_PASS_MARKS[stageId]);
    var passed = accuracy >= passMark;
    var now = EW_now_();
    var attemptNo = EW_countAttempts_(playerId, stageId) + 1;
    var resultId = EW_uid_('EWG');
    var receiptId = EW_uid_('EWR');
    var answers = EW_array_(payload.answers);

    EW_append_(EW_SHEETS.gameResults, [
      resultId, now, playerId, profile.fullName, profile.groupName, stageId, score, total,
      accuracy, passMark, passed, EW_int_(payload.durationMs, 0), attemptNo,
      EW_int_(payload.clientPoints, 0), EW_json_(answers),
      String(payload.sourceVersion || EW_VERSION), receiptId
    ]);

    EW_upsertGameSummary_(playerId, stageId, score, accuracy, passed, attemptNo, now);
    progress.bestScores[stageId] = Math.max(Number(progress.bestScores[stageId] || 0), accuracy);
    if (passed && progress.passed.indexOf(stageId) === -1) progress.passed.push(stageId);
    if (stageId === 'final_boss' && passed) progress.finalDone = true;
    progress = EW_reconcileProgress_(progress);
    EW_saveProgress_(progress);
    EW_touchLive_(profile, passed ? 'stage_passed' : 'stage_retry', stageId);

    return {
      ok:true,
      receiptId:receiptId,
      resultId:resultId,
      passed:passed,
      accuracy:accuracy,
      passMark:passMark,
      attemptNo:attemptNo,
      authority:EW_authority_(profile, progress),
      version:EW_VERSION
    };
  });
}

function EW_submitEvent_(payload) {
  EW_assertSetup_();
  EW_append_(EW_SHEETS.events, [
    EW_uid_('EWE'), EW_now_(), EW_cleanId_(payload.playerId),
    String(payload.eventName || ''), String(payload.stageId || ''),
    EW_json_(payload.payload || {}), String(payload.sourceVersion || EW_VERSION)
  ]);
  return { ok:true, version:EW_VERSION };
}

function EW_leaderboard_(params) {
  EW_assertSetup_();
  var limit = Math.max(1, Math.min(100, EW_int_(params.limit, 10)));
  var profiles = EW_profileMap_();
  var rows = EW_sheetObjects_(EW_SHEETS.progress).map(function(row) {
    var profile = profiles[String(row.playerId || '').trim()] || {};
    return {
      playerId:String(row.playerId || ''),
      nickname:profile.nickname || profile.fullName || String(row.playerId || ''),
      fullName:profile.fullName || '',
      groupName:profile.groupName || '',
      totalScore:Number(row.totalScore || 0),
      completed:EW_truthy_(row.postDone)
    };
  }).sort(function(a, b) {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return String(a.nickname).localeCompare(String(b.nickname));
  }).slice(0, limit);
  return { ok:true, rows:rows, version:EW_VERSION, generatedAt:EW_now_() };
}

function EW_authority_(profile, progress) {
  return {
    ok:true,
    mode:'server',
    profile:profile,
    progress:progress,
    policy:{ flow:EW_FLOW, passMarks:EW_PASS_MARKS, sourceOfTruth:'Google Sheet' },
    version:EW_VERSION,
    serverTime:EW_now_()
  };
}

function EW_getOrCreateProgress_(playerId) {
  var sheet = EW_sheet_(EW_SHEETS.progress);
  var rowIndex = EW_findRowByValue_(sheet, 1, playerId);
  if (!rowIndex) {
    var progress = EW_reconcileProgress_({
      playerId:playerId,
      currentStage:'pre_challenge',
      unlocked:['pre_challenge'],
      passed:[],
      bestScores:{},
      preDone:false,
      postDone:false,
      finalDone:false,
      certificateEligible:false,
      certificate:null,
      totalScore:0,
      updatedAt:EW_now_()
    });
    EW_saveProgress_(progress);
    return progress;
  }
  var row = EW_rowObject_(sheet, rowIndex);
  return EW_reconcileProgress_({
    playerId:String(row.playerId || playerId),
    currentStage:String(row.currentStage || 'pre_challenge'),
    unlocked:EW_jsonArray_(row.unlockedJson),
    passed:EW_jsonArray_(row.passedJson),
    bestScores:EW_jsonObject_(row.bestScoresJson),
    preDone:EW_truthy_(row.preDone),
    postDone:EW_truthy_(row.postDone),
    finalDone:EW_truthy_(row.finalDone),
    certificateEligible:EW_truthy_(row.certificateEligible),
    certificate:EW_jsonObject_(row.certificateJson),
    totalScore:Number(row.totalScore || 0),
    updatedAt:String(row.updatedAt || '')
  });
}

function EW_reconcileProgress_(progress) {
  var passed = EW_unique_(EW_array_(progress.passed).filter(function(stage) { return EW_PASS_MARKS.hasOwnProperty(stage); }));
  var bestScores = progress.bestScores && typeof progress.bestScores === 'object' ? progress.bestScores : {};
  var unlocked = ['pre_challenge'];
  if (EW_truthy_(progress.preDone)) unlocked.push('word_match');
  if (passed.indexOf('word_match') !== -1) unlocked.push('category_forest');
  if (passed.indexOf('category_forest') !== -1) unlocked.push('sentence_city');
  if (passed.indexOf('sentence_city') !== -1) unlocked.push('word_detective');
  if (passed.indexOf('word_detective') !== -1) unlocked.push('final_boss');
  if (passed.indexOf('final_boss') !== -1) unlocked.push('post_challenge');
  if (EW_truthy_(progress.postDone)) unlocked.push('certificate');
  var totalScore = Object.keys(bestScores).reduce(function(sum, key) {
    return sum + Number(bestScores[key] || 0);
  }, 0);
  progress.unlocked = EW_unique_(unlocked);
  progress.passed = passed;
  progress.bestScores = bestScores;
  progress.finalDone = passed.indexOf('final_boss') !== -1;
  progress.certificateEligible = EW_truthy_(progress.postDone) && progress.finalDone;
  progress.totalScore = totalScore;
  progress.currentStage = progress.unlocked[progress.unlocked.length - 1] || 'pre_challenge';
  progress.updatedAt = EW_now_();
  return progress;
}

function EW_saveProgress_(progress) {
  var sheet = EW_sheet_(EW_SHEETS.progress);
  var row = [
    progress.playerId, progress.currentStage, EW_json_(progress.unlocked),
    EW_json_(progress.passed), EW_json_(progress.bestScores), Boolean(progress.preDone),
    Boolean(progress.postDone), Boolean(progress.finalDone), Boolean(progress.certificateEligible),
    EW_json_(progress.certificate || {}), Number(progress.totalScore || 0), EW_now_()
  ];
  EW_upsertByKey_(sheet, 1, progress.playerId, row);
}

function EW_issueCertificate_(profile, progress) {
  var certificate = {
    certificateId:EW_uid_('EW-CERT'),
    issuedAt:EW_now_(),
    awardLevel:EW_awardLevel_(progress.totalScore)
  };
  EW_append_(EW_SHEETS.certificates, [
    certificate.certificateId, certificate.issuedAt, profile.playerId, profile.fullName,
    profile.groupName, certificate.awardLevel, Number(progress.totalScore || 0), true
  ]);
  return certificate;
}

function EW_awardLevel_(totalScore) {
  var score = Number(totalScore || 0);
  if (score >= 450) return 'English Week Champion';
  if (score >= 400) return 'Word Master';
  if (score >= 325) return 'Vocabulary Adventurer';
  return 'English Explorer';
}

function EW_upsertGameSummary_(playerId, stageId, score, accuracy, passed, attempts, now) {
  var sheet = EW_sheet_(EW_SHEETS.gameSummary);
  var objects = EW_sheetObjects_(EW_SHEETS.gameSummary);
  var index = -1;
  for (var i = 0; i < objects.length; i += 1) {
    if (String(objects[i].playerId) === playerId && String(objects[i].stageId) === stageId) { index = i; break; }
  }
  var previous = index >= 0 ? objects[index] : {};
  var row = [
    playerId, stageId, Math.max(Number(previous.bestScore || 0), Number(score || 0)),
    Math.max(Number(previous.bestAccuracy || 0), Number(accuracy || 0)),
    EW_truthy_(previous.passed) || Boolean(passed), Math.max(Number(previous.attempts || 0), Number(attempts || 0)),
    now, now
  ];
  if (index >= 0) sheet.getRange(index + 2, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
}

function EW_countAttempts_(playerId, stageId) {
  return EW_sheetObjects_(EW_SHEETS.gameResults).filter(function(row) {
    return String(row.playerId) === playerId && String(row.stageId) === stageId;
  }).length;
}

function EW_findProfile_(playerId) {
  var sheet = EW_sheet_(EW_SHEETS.profiles);
  var rowIndex = EW_findRowByValue_(sheet, 1, playerId);
  if (!rowIndex) return null;
  var row = EW_rowObject_(sheet, rowIndex);
  return {
    playerId:String(row.playerId || playerId),
    fullName:String(row.fullName || ''),
    nickname:String(row.nickname || row.fullName || ''),
    groupName:String(row.groupName || ''),
    institution:String(row.institution || ''),
    active:EW_truthy_(row.active)
  };
}

function EW_requireProfile_(playerId) {
  if (!playerId) throw new Error('PLAYER_ID_REQUIRED');
  var profile = EW_findProfile_(playerId);
  if (!profile) throw new Error('PLAYER_NOT_FOUND');
  if (!profile.active) throw new Error('PLAYER_INACTIVE');
  return profile;
}

function EW_profileMap_() {
  var map = {};
  EW_sheetObjects_(EW_SHEETS.profiles).forEach(function(row) {
    var id = String(row.playerId || '').trim();
    if (!id) return;
    map[id] = {
      playerId:id,
      fullName:String(row.fullName || ''),
      nickname:String(row.nickname || row.fullName || ''),
      groupName:String(row.groupName || ''),
      institution:String(row.institution || ''),
      active:EW_truthy_(row.active)
    };
  });
  return map;
}

function EW_touchProfile_(profile) {
  var sheet = EW_sheet_(EW_SHEETS.profiles);
  var rowIndex = EW_findRowByValue_(sheet, 1, profile.playerId);
  if (!rowIndex) return;
  var headers = EW_HEADERS[EW_SHEETS.profiles];
  var lastSeenCol = headers.indexOf('lastSeenAt') + 1;
  var updatedCol = headers.indexOf('updatedAt') + 1;
  sheet.getRange(rowIndex, lastSeenCol).setValue(EW_now_());
  sheet.getRange(rowIndex, updatedCol).setValue(EW_now_());
}

function EW_touchLive_(profile, status, currentStage) {
  var sheet = EW_sheet_(EW_SHEETS.live);
  var row = [
    profile.playerId, profile.fullName, profile.groupName, status, currentStage,
    EW_now_(), ''
  ];
  EW_upsertByKey_(sheet, 1, profile.playerId, row);
}

function EW_assertSetup_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(EW_HEADERS).forEach(function(name) {
    if (!ss.getSheetByName(name)) throw new Error('SETUP_REQUIRED_' + name);
  });
}

function EW_sheet_(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('SHEET_NOT_FOUND_' + name);
  return sheet;
}

function EW_sheetObjects_(name) {
  var sheet = EW_sheet_(name);
  if (sheet.getLastRow() < 2) return [];
  var values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  var headers = values.shift().map(function(value) { return String(value || '').trim(); });
  return values.filter(function(row) { return row.some(function(value) { return value !== ''; }); }).map(function(row) {
    var object = {};
    headers.forEach(function(header, index) { if (header) object[header] = row[index]; });
    return object;
  });
}

function EW_rowObject_(sheet, rowIndex) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
  var object = {};
  headers.forEach(function(header, index) { if (header) object[String(header)] = row[index]; });
  return object;
}

function EW_findRowByValue_(sheet, column, value) {
  if (sheet.getLastRow() < 2) return 0;
  var values = sheet.getRange(2, column, sheet.getLastRow() - 1, 1).getDisplayValues();
  var target = String(value || '').trim();
  for (var i = 0; i < values.length; i += 1) {
    if (String(values[i][0] || '').trim() === target) return i + 2;
  }
  return 0;
}

function EW_upsertByKey_(sheet, keyColumn, keyValue, row) {
  var rowIndex = EW_findRowByValue_(sheet, keyColumn, keyValue);
  if (rowIndex) sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
}

function EW_append_(name, row) {
  EW_sheet_(name).appendRow(row);
}

function EW_parsePost_(e) {
  if (!e || !e.postData || !e.postData.contents) return (e && e.parameter) || {};
  var text = String(e.postData.contents || '').trim();
  if (!text) return (e && e.parameter) || {};
  try { return JSON.parse(text); }
  catch (error) { throw new Error('INVALID_JSON_BODY'); }
}

function EW_output_(data, callback) {
  var json = JSON.stringify(data);
  var safeCallback = /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback || '') ? callback : '';
  if (safeCallback) return ContentService.createTextOutput(safeCallback + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function EW_logError_(action, playerId, error, payload) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(EW_SHEETS.errors);
    if (!sheet) return;
    sheet.appendRow([
      EW_uid_('EWX'), EW_now_(), String(action || ''), String(playerId || ''),
      String(error && error.message || error || ''), String(error && error.stack || ''),
      EW_json_(payload || {}), EW_VERSION
    ]);
  } catch (_) {}
}

function EW_withLock_(callback) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return callback(); }
  finally { lock.releaseLock(); }
}

function EW_now_() {
  return Utilities.formatDate(new Date(), EW_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}
function EW_uid_(prefix) {
  return prefix + '-' + Date.now() + '-' + Utilities.getUuid().slice(0, 8);
}
function EW_cleanId_(value) {
  return String(value || '').trim().replace(/[^0-9A-Za-z_-]/g, '').slice(0, 40);
}
function EW_int_(value, fallback) {
  var number = Number(value);
  return isFinite(number) ? Math.round(number) : Number(fallback || 0);
}
function EW_truthy_(value) {
  if (value === true || value === 1) return true;
  var text = String(value || '').trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'yes' || text === 'active';
}
function EW_array_(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];
  try { var parsed = JSON.parse(String(value)); return Array.isArray(parsed) ? parsed : []; }
  catch (_) { return []; }
}
function EW_jsonArray_(value) { return EW_array_(value); }
function EW_jsonObject_(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (!value) return {};
  try { var parsed = JSON.parse(String(value)); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; }
  catch (_) { return {}; }
}
function EW_json_(value) {
  try { return JSON.stringify(value === undefined ? null : value); }
  catch (_) { return '{}'; }
}
function EW_unique_(values) {
  var seen = {};
  return values.filter(function(value) {
    var key = String(value);
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}
