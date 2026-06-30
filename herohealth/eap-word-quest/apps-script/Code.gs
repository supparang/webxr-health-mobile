/* =========================================================
   EAP Word Quest • Google Sheets Receiver + Teacher API
   File: /herohealth/eap-word-quest/apps-script/Code.gs
   Version: v2.6.0-EAP-WORD-TEACHER-FINAL-122

   Deployment
   1) Open the EAP Word Quest Google Sheet.
   2) Extensions > Apps Script > replace Code.gs with this file.
   3) Run setupEapWordQuest() once and authorize.
   4) Deploy > New deployment > Web app.
      Execute as: Me | Who has access: Anyone.
   5) Keep the /exec URL in eap-word-sheet-config.js.

   Safety rule: setup never clears historical rows. Missing columns are added.
========================================================= */

const EAPWQ_VERSION = 'v2.6.0-EAP-WORD-TEACHER-FINAL-122';
const EAPWQ_TZ = 'Asia/Bangkok';
const EAPWQ_GROUP = '122';
const EAPWQ = {
  profiles: 'eap_word_profiles',
  attempts: 'eap_word_attempts',
  summary: 'eap_word_summary'
};

const EAPWQ_HEADERS = {
  eap_word_profiles: [
    'serverTs','studentId','studentName','group','section','course','firstSeenAt','lastSeenAt','userAgent','sourceUrl','extraJson'
  ],
  eap_word_attempts: [
    'serverTs','attemptId','fingerprint','studentId','studentName','group','section','course','game','arcId','arc','sessionId','sessionTitle','sessionType',
    'correct','total','accuracy','xp','score','maxCombo','passed','passThreshold','passStatus','cefrLevel','aiDifficulty','aiPrediction','hintUsed',
    'weakWordsJson','itemTypeWeakJson','levelWeakJson','responseTimeAvg','attempt','bossHp','bossMaxHp','isBoss','playedAt','clientTs','source','pageUrl','userAgent','schemaVersion','extraJson'
  ],
  eap_word_summary: [
    'serverTs','studentId','studentName','group','section','sessionId','sessionTitle','sessionType','bestAccuracy','bestScore','passed','attempts','lastAccuracy','lastScore','lastPlayed','updatedAt','weakWordsJson','aiPrediction','extraJson'
  ]
};

const EAPWQ_FLOW = [
  'S1','S2','S3','BG1',
  'S4','S5','S6','BG2',
  'S7','S8','S9','BG3',
  'S10','S11','S12','BG4',
  'S13','S14','S15','BG5'
];

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = String(p.action || p.api || 'health');
  const callback = String(p.callback || '');

  try {
    if (action === 'health' || action === 'eap_word_health') {
      setupEapWordQuest();
      return eapwqOut_(eapwqHealth_(), callback);
    }

    if (action === 'setup' || action === 'eap_word_setup') {
      return eapwqOut_(setupEapWordQuest(), callback);
    }

    if (action === 'eap_word_teacher') {
      setupEapWordQuest();
      const group = eapwqGroup_(p.section || p.group || EAPWQ_GROUP);
      const logs = eapwqReadAttempts_(group);
      const summaries = eapwqReadSummaries_(group);
      return eapwqOut_({
        ok: true,
        action: 'eap_word_teacher',
        group: group,
        generatedAt: eapwqNow_(),
        logs: logs,
        summaries: summaries,
        server: {
          version: EAPWQ_VERSION,
          attemptCount: logs.length,
          summaryCount: summaries.length,
          studentCount: eapwqUniqueStudentCount_(logs),
          timezone: EAPWQ_TZ
        }
      }, callback);
    }

    if (action === 'eap_word_summary') {
      setupEapWordQuest();
      const group = eapwqGroup_(p.section || p.group || EAPWQ_GROUP);
      const summaries = eapwqReadSummaries_(group);
      return eapwqOut_({
        ok: true,
        action: 'eap_word_summary',
        group: group,
        generatedAt: eapwqNow_(),
        summaries: summaries,
        server: { version:EAPWQ_VERSION, summaryCount:summaries.length, timezone:EAPWQ_TZ }
      }, callback);
    }

    return eapwqOut_({ ok:false, error:'Unknown action', action:action, version:EAPWQ_VERSION }, callback);
  } catch (err) {
    return eapwqOut_({ ok:false, error:String(err && err.message || err), version:EAPWQ_VERSION }, callback);
  }
}

function doPost(e) {
  try {
    const payload = eapwqParse_(e);
    const action = String(payload.action || payload.type || '');
    setupEapWordQuest();

    if (action === 'eap_word_profile') {
      const profileRecord = eapwqNormalizeAttempt_(payload.record || payload, payload);
      eapwqUpsertProfile_(profileRecord);
      return eapwqOut_({ ok:true, action:action, profileOnly:true, version:EAPWQ_VERSION, now:eapwqNow_() });
    }

    if (action === 'eap_word_attempt') {
      const record = eapwqNormalizeAttempt_(payload.record || payload, payload);
      eapwqUpsertProfile_(record);
      if (eapwqIsProfileRecord_(record)) {
        return eapwqOut_({ ok:true, action:action, profileOnly:true, version:EAPWQ_VERSION, now:eapwqNow_() });
      }
      if (!eapwqIsTeachingRecord_(record)) {
        return eapwqOut_({ ok:false, action:action, error:'Invalid learning session', sessionId:record.sessionId, version:EAPWQ_VERSION });
      }
      const appended = eapwqAppendAttempt_(record);
      const summary = eapwqUpsertSummary_(record);
      return eapwqOut_({ ok:true, action:action, appended:appended, summary:summary, version:EAPWQ_VERSION, now:eapwqNow_() });
    }

    if (action === 'eap_word_batch') {
      const rows = Array.isArray(payload.records) ? payload.records : [];
      let appended = 0;
      let profiles = 0;
      let skipped = 0;
      const summaries = [];

      rows.forEach(function(row) {
        const record = eapwqNormalizeAttempt_(row, payload);
        eapwqUpsertProfile_(record);
        if (eapwqIsProfileRecord_(record)) {
          profiles += 1;
          return;
        }
        if (!eapwqIsTeachingRecord_(record)) {
          skipped += 1;
          return;
        }
        if (eapwqAppendAttempt_(record)) appended += 1;
        summaries.push(eapwqUpsertSummary_(record));
      });

      return eapwqOut_({
        ok:true,
        action:action,
        received:rows.length,
        appended:appended,
        profiles:profiles,
        skipped:skipped,
        summaries:summaries,
        version:EAPWQ_VERSION,
        now:eapwqNow_()
      });
    }

    return eapwqOut_({ ok:false, error:'Unknown action', action:action, version:EAPWQ_VERSION });
  } catch (err) {
    return eapwqOut_({ ok:false, error:String(err && err.message || err), stack:String(err && err.stack || ''), version:EAPWQ_VERSION });
  }
}

function setupEapWordQuest() {
  const ss = eapwqSs_();
  Object.keys(EAPWQ_HEADERS).forEach(function(name) { eapwqSheet_(name); });
  return { ok:true, spreadsheetId:ss.getId(), version:EAPWQ_VERSION, now:eapwqNow_() };
}

function eapwqSs_() {
  const props = PropertiesService.getScriptProperties();
  const savedId = String(props.getProperty('EAPWQ_SPREADSHEET_ID') || '');
  let ss = savedId ? SpreadsheetApp.openById(savedId) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Open this project from the EAP Word Quest Google Sheet and run setupEapWordQuest() once.');
  if (!savedId) props.setProperty('EAPWQ_SPREADSHEET_ID', ss.getId());
  return ss;
}

function eapwqSheet_(name) {
  const ss = eapwqSs_();
  const required = EAPWQ_HEADERS[name];
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  const lastColumn = sh.getLastColumn();
  const lastRow = sh.getLastRow();
  if (!lastColumn || !lastRow) {
    sh.getRange(1,1,1,required.length).setValues([required]);
    sh.setFrozenRows(1);
    return sh;
  }

  const existing = sh.getRange(1,1,1,lastColumn).getValues()[0].map(eapwqText_);
  while (existing.length && !existing[existing.length - 1]) existing.pop();
  const headers = existing.slice();
  required.forEach(function(key) {
    if (headers.indexOf(key) < 0) headers.push(key);
  });

  if (headers.join('|') !== existing.join('|')) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
  }
  sh.setFrozenRows(1);
  return sh;
}

function eapwqHeaders_(name) {
  const sh = eapwqSheet_(name);
  const lastColumn = Math.max(1, sh.getLastColumn());
  return sh.getRange(1,1,1,lastColumn).getValues()[0].map(eapwqText_).filter(function(value) { return value !== ''; });
}

function eapwqParse_(e) {
  const text = e && e.postData && e.postData.contents ? String(e.postData.contents) : '';
  const params = e && e.parameter ? e.parameter : {};
  if (text) {
    const trimmed = text.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) return JSON.parse(trimmed);
  }
  if (params.payload) return JSON.parse(params.payload);
  return params;
}

function eapwqNow_() {
  return Utilities.formatDate(new Date(), EAPWQ_TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function eapwqIso_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, EAPWQ_TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
  return eapwqText_(value);
}

function eapwqText_(value) {
  return String(value == null ? '' : value).replace(/\s+/g,' ').trim();
}

function eapwqNumber_(value, fallback) {
  const n = Number(value);
  return isFinite(n) ? n : (fallback == null ? 0 : fallback);
}

function eapwqBool_(value) {
  return value === true || String(value).toLowerCase() === 'true' || Number(value) === 1;
}

function eapwqGroup_(value) {
  return String(value || EAPWQ_GROUP) === EAPWQ_GROUP ? EAPWQ_GROUP : EAPWQ_GROUP;
}

function eapwqArray_(value) {
  if (Array.isArray(value)) return value.map(eapwqText_).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(eapwqText_).filter(Boolean);
    } catch (err) {}
    return value.split(/[|,;]/).map(eapwqText_).filter(Boolean);
  }
  return [];
}

function eapwqThreshold_(sessionId) {
  if (sessionId === 'BG5') return 75;
  if (/^BG[1-4]$/.test(sessionId)) return 70;
  return 60;
}

function eapwqNormalizeAttempt_(input, envelope) {
  input = input || {};
  envelope = envelope || {};
  const sessionId = eapwqText_(input.sessionId || input.session || 'UNKNOWN').toUpperCase();
  const correct = Math.max(0, Math.round(eapwqNumber_(input.correct, 0)));
  const total = Math.max(1, Math.round(eapwqNumber_(input.total || input.questions, correct || 1)));
  const accuracy = Math.max(0, Math.min(100, Math.round(eapwqNumber_(input.accuracy, (correct / total) * 100))));
  const playedAt = eapwqText_(input.playedAt || envelope.clientTs || eapwqNow_());
  const studentId = eapwqText_(input.studentId || 'anon');
  const studentName = eapwqText_(input.studentName || 'Anonymous');
  const fingerprint = eapwqText_(input.fingerprint || [EAPWQ_GROUP,studentId,studentName.toLowerCase(),sessionId,correct,total,accuracy,playedAt.slice(0,19)].join('|'));
  const threshold = Math.round(eapwqNumber_(input.passThreshold, eapwqThreshold_(sessionId)));
  const isProfile = eapwqBool_(input.profileIdentitySync) || sessionId === 'PROFILE' || eapwqText_(input.sessionType).toLowerCase() === 'profile' || eapwqText_(input.source).toLowerCase().indexOf('profile-identity-sync') >= 0;

  return {
    serverTs:eapwqNow_(),
    attemptId:eapwqText_(input.attemptId || ('eapwq-' + new Date().getTime() + '-' + Math.floor(Math.random()*100000))),
    fingerprint:fingerprint,
    studentId:studentId,
    studentName:studentName,
    group:EAPWQ_GROUP,
    section:EAPWQ_GROUP,
    course:eapwqText_(input.course || 'EAP'),
    game:eapwqText_(input.game || 'EAP Word Quest'),
    arcId:eapwqText_(input.arcId),
    arc:eapwqText_(input.arc),
    sessionId:sessionId,
    sessionTitle:eapwqText_(input.sessionTitle || sessionId),
    sessionType:eapwqText_(input.sessionType || (/^BG/.test(sessionId) ? 'boss' : 'session')),
    correct:correct,
    total:total,
    accuracy:accuracy,
    xp:Math.max(0,Math.round(eapwqNumber_(input.xp, input.score))),
    score:Math.max(0,Math.round(eapwqNumber_(input.score, input.xp))),
    maxCombo:Math.max(0,Math.round(eapwqNumber_(input.maxCombo,0))),
    passed:eapwqBool_(input.passed) || accuracy >= threshold,
    passThreshold:threshold,
    passStatus:eapwqText_(input.passStatus),
    cefrLevel:eapwqText_(input.cefrLevel),
    aiDifficulty:eapwqText_(input.aiDifficulty),
    aiPrediction:eapwqText_(input.aiPrediction),
    hintUsed:Math.max(0,Math.round(eapwqNumber_(input.hintUsed,0))),
    weakWords:eapwqArray_(input.weakWords),
    itemTypeWeak:eapwqArray_(input.itemTypeWeak),
    levelWeak:eapwqArray_(input.levelWeak),
    responseTimeAvg:Math.max(0,eapwqNumber_(input.responseTimeAvg,0)),
    attempt:Math.max(1,Math.round(eapwqNumber_(input.attempt,1))),
    bossHp:Math.max(0,Math.round(eapwqNumber_(input.bossHp,0))),
    bossMaxHp:Math.max(0,Math.round(eapwqNumber_(input.bossMaxHp,0))),
    isBoss:eapwqBool_(input.isBoss) || /^BG/.test(sessionId),
    isProfile:isProfile,
    playedAt:playedAt,
    clientTs:eapwqText_(envelope.clientTs || input.clientTs || playedAt),
    source:eapwqText_(input.source || 'student-core'),
    pageUrl:eapwqText_(envelope.pageUrl || input.pageUrl),
    userAgent:eapwqText_(envelope.userAgent || input.userAgent),
    schemaVersion:eapwqText_(envelope.schemaVersion || input.schemaVersion || EAPWQ_VERSION),
    extraJson:JSON.stringify({ raw:input })
  };
}

function eapwqIsProfileRecord_(record) {
  return Boolean(record && record.isProfile);
}

function eapwqIsTeachingRecord_(record) {
  return Boolean(record && EAPWQ_FLOW.indexOf(String(record.sessionId || '').toUpperCase()) >= 0);
}

function eapwqUpsertProfile_(record) {
  const sh = eapwqSheet_(EAPWQ.profiles);
  const headers = eapwqHeaders_(EAPWQ.profiles);
  const values = sh.getDataRange().getValues();
  const idIndex = headers.indexOf('studentId');
  let row = -1;
  for (let i = 1; i < values.length; i += 1) {
    if (String(values[i][idIndex]) === record.studentId) { row = i + 1; break; }
  }
  const now = eapwqNow_();
  const old = row > 0 ? values[row - 1] : [];
  const firstSeen = row > 0 ? eapwqIso_(old[headers.indexOf('firstSeenAt')]) : now;
  const out = {
    serverTs:now, studentId:record.studentId, studentName:record.studentName, group:EAPWQ_GROUP, section:EAPWQ_GROUP,
    course:record.course, firstSeenAt:firstSeen, lastSeenAt:now, userAgent:record.userAgent, sourceUrl:record.pageUrl,
    extraJson:JSON.stringify({ source:record.source, schemaVersion:record.schemaVersion })
  };
  const rowValues = headers.map(function(key) { return Object.prototype.hasOwnProperty.call(out,key) ? out[key] : ''; });
  if (row > 0) sh.getRange(row,1,1,rowValues.length).setValues([rowValues]);
  else sh.appendRow(rowValues);
}

function eapwqAppendAttempt_(record) {
  const sh = eapwqSheet_(EAPWQ.attempts);
  const headers = eapwqHeaders_(EAPWQ.attempts);
  const values = sh.getDataRange().getValues();
  const fpIndex = headers.indexOf('fingerprint');
  for (let i = 1; i < values.length; i += 1) {
    if (String(values[i][fpIndex]) === record.fingerprint) return false;
  }
  const row = {
    serverTs:record.serverTs, attemptId:record.attemptId, fingerprint:record.fingerprint,
    studentId:record.studentId, studentName:record.studentName, group:record.group, section:record.section,
    course:record.course, game:record.game, arcId:record.arcId, arc:record.arc, sessionId:record.sessionId,
    sessionTitle:record.sessionTitle, sessionType:record.sessionType, correct:record.correct, total:record.total,
    accuracy:record.accuracy, xp:record.xp, score:record.score, maxCombo:record.maxCombo, passed:String(record.passed),
    passThreshold:record.passThreshold, passStatus:record.passStatus, cefrLevel:record.cefrLevel, aiDifficulty:record.aiDifficulty,
    aiPrediction:record.aiPrediction, hintUsed:record.hintUsed, weakWordsJson:JSON.stringify(record.weakWords),
    itemTypeWeakJson:JSON.stringify(record.itemTypeWeak), levelWeakJson:JSON.stringify(record.levelWeak),
    responseTimeAvg:record.responseTimeAvg, attempt:record.attempt, bossHp:record.bossHp, bossMaxHp:record.bossMaxHp,
    isBoss:String(record.isBoss), playedAt:record.playedAt, clientTs:record.clientTs, source:record.source,
    pageUrl:record.pageUrl, userAgent:record.userAgent, schemaVersion:record.schemaVersion, extraJson:record.extraJson
  };
  sh.appendRow(headers.map(function(key) { return Object.prototype.hasOwnProperty.call(row,key) ? row[key] : ''; }));
  return true;
}

function eapwqUpsertSummary_(record) {
  const sh = eapwqSheet_(EAPWQ.summary);
  const headers = eapwqHeaders_(EAPWQ.summary);
  const values = sh.getDataRange().getValues();
  const idCol = headers.indexOf('studentId');
  const sessionCol = headers.indexOf('sessionId');
  let row = -1;
  for (let i = 1; i < values.length; i += 1) {
    if (String(values[i][idCol]) === record.studentId && String(values[i][sessionCol]) === record.sessionId) { row = i + 1; break; }
  }
  const old = row > 0 ? values[row - 1] : [];
  const getOld = function(key) { const index = headers.indexOf(key); return index >= 0 ? old[index] : ''; };
  const previousBestAccuracy = eapwqNumber_(getOld('bestAccuracy'),0);
  const previousBestScore = eapwqNumber_(getOld('bestScore'),0);
  const previousAttempts = eapwqNumber_(getOld('attempts'),0);
  const previousPassed = eapwqBool_(getOld('passed'));
  const out = {
    serverTs:eapwqNow_(), studentId:record.studentId, studentName:record.studentName, group:EAPWQ_GROUP, section:EAPWQ_GROUP,
    sessionId:record.sessionId, sessionTitle:record.sessionTitle, sessionType:record.sessionType,
    bestAccuracy:Math.max(previousBestAccuracy,record.accuracy), bestScore:Math.max(previousBestScore,record.score),
    passed:String(previousPassed || record.passed), attempts:previousAttempts + 1,
    lastAccuracy:record.accuracy, lastScore:record.score, lastPlayed:record.playedAt, updatedAt:eapwqNow_(),
    weakWordsJson:JSON.stringify(record.weakWords), aiPrediction:record.aiPrediction,
    extraJson:JSON.stringify({ passThreshold:record.passThreshold, source:record.source, schemaVersion:record.schemaVersion })
  };
  const rowValues = headers.map(function(key) { return Object.prototype.hasOwnProperty.call(out,key) ? out[key] : ''; });
  if (row > 0) sh.getRange(row,1,1,rowValues.length).setValues([rowValues]);
  else sh.appendRow(rowValues);
  return { studentId:record.studentId, sessionId:record.sessionId, passed:out.passed, bestAccuracy:out.bestAccuracy };
}

function eapwqReadAttempts_(group) {
  const sh = eapwqSheet_(EAPWQ.attempts);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(eapwqText_);
  const index = function(key) { return headers.indexOf(key); };
  const jsonArray = function(value) { return eapwqArray_(value); };

  return values.slice(1).map(function(row) {
    const get = function(key) { const i = index(key); return i >= 0 ? row[i] : ''; };
    const sessionId = eapwqText_(get('sessionId')).toUpperCase();
    const section = eapwqText_(get('section') || get('group') || EAPWQ_GROUP);
    if (section !== group || EAPWQ_FLOW.indexOf(sessionId) < 0) return null;
    const studentId = eapwqText_(get('studentId'));
    const studentName = eapwqText_(get('studentName'));
    return {
      logVersion:eapwqText_(get('schemaVersion')) || EAPWQ_VERSION,
      attemptId:eapwqText_(get('attemptId')),
      fingerprint:eapwqText_(get('fingerprint')),
      serverTs:eapwqIso_(get('serverTs')),
      source:eapwqText_(get('source')) || 'sheets',
      group:EAPWQ_GROUP, section:EAPWQ_GROUP, studentId:studentId, studentName:studentName,
      studentKey:EAPWQ_GROUP + '|' + studentId,
      course:eapwqText_(get('course')), game:eapwqText_(get('game')),
      arcId:eapwqText_(get('arcId')), arc:eapwqText_(get('arc')), sessionId:sessionId,
      sessionTitle:eapwqText_(get('sessionTitle')), sessionType:eapwqText_(get('sessionType')),
      correct:eapwqNumber_(get('correct'),0), total:eapwqNumber_(get('total'),0), accuracy:eapwqNumber_(get('accuracy'),0),
      xp:eapwqNumber_(get('xp'),0), score:eapwqNumber_(get('score'),0), maxCombo:eapwqNumber_(get('maxCombo'),0),
      passed:eapwqBool_(get('passed')), passThreshold:eapwqNumber_(get('passThreshold'),0), passStatus:eapwqText_(get('passStatus')),
      cefrLevel:eapwqText_(get('cefrLevel')), aiDifficulty:eapwqText_(get('aiDifficulty')), aiPrediction:eapwqText_(get('aiPrediction')),
      hintUsed:eapwqNumber_(get('hintUsed'),0), weakWords:jsonArray(get('weakWordsJson')),
      itemTypeWeak:jsonArray(get('itemTypeWeakJson')), levelWeak:jsonArray(get('levelWeakJson')),
      responseTimeAvg:eapwqNumber_(get('responseTimeAvg'),0), attempt:eapwqNumber_(get('attempt'),1),
      bossHp:eapwqNumber_(get('bossHp'),0), bossMaxHp:eapwqNumber_(get('bossMaxHp'),0), isBoss:eapwqBool_(get('isBoss')),
      playedAt:eapwqIso_(get('playedAt')), clientTs:eapwqIso_(get('clientTs'))
    };
  }).filter(Boolean);
}

function eapwqReadSummaries_(group) {
  const sh = eapwqSheet_(EAPWQ.summary);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(eapwqText_);
  const index = function(key) { return headers.indexOf(key); };
  return values.slice(1).map(function(row) {
    const get = function(key) { const i = index(key); return i >= 0 ? row[i] : ''; };
    const sessionId = eapwqText_(get('sessionId')).toUpperCase();
    const section = eapwqText_(get('section') || get('group') || EAPWQ_GROUP);
    if (section !== group || EAPWQ_FLOW.indexOf(sessionId) < 0) return null;
    return {
      studentId:eapwqText_(get('studentId')),
      studentName:eapwqText_(get('studentName')),
      group:EAPWQ_GROUP,
      section:EAPWQ_GROUP,
      sessionId:sessionId,
      sessionTitle:eapwqText_(get('sessionTitle')),
      sessionType:eapwqText_(get('sessionType')),
      bestAccuracy:eapwqNumber_(get('bestAccuracy'),0),
      bestScore:eapwqNumber_(get('bestScore'),0),
      passed:eapwqBool_(get('passed')),
      attempts:eapwqNumber_(get('attempts'),0),
      lastAccuracy:eapwqNumber_(get('lastAccuracy'),0),
      lastScore:eapwqNumber_(get('lastScore'),0),
      lastPlayed:eapwqIso_(get('lastPlayed')),
      updatedAt:eapwqIso_(get('updatedAt')),
      weakWords:eapwqArray_(get('weakWordsJson')),
      aiPrediction:eapwqText_(get('aiPrediction'))
    };
  }).filter(Boolean);
}

function eapwqUniqueStudentCount_(logs) {
  const seen = {};
  (logs || []).forEach(function(row) {
    const id = eapwqText_(row && row.studentId);
    if (id) seen[id] = true;
  });
  return Object.keys(seen).length;
}

function eapwqHealth_() {
  const logs = eapwqReadAttempts_(EAPWQ_GROUP);
  const summaries = eapwqReadSummaries_(EAPWQ_GROUP);
  return {
    ok:true,
    service:'EAP Word Quest Sheets',
    version:EAPWQ_VERSION,
    group:EAPWQ_GROUP,
    now:eapwqNow_(),
    server:{
      attemptCount:logs.length,
      summaryCount:summaries.length,
      studentCount:eapwqUniqueStudentCount_(logs),
      timezone:EAPWQ_TZ
    }
  };
}

function eapwqOut_(value, callback) {
  const json = JSON.stringify(value);
  if (callback && /^[A-Za-z_$][A-Za-z0-9_$.]{0,100}$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
