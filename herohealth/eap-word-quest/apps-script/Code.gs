/* =========================================================
   EAP Word Quest • Google Sheets Receiver + Teacher API
   File: /herohealth/eap-word-quest/apps-script/Code.gs
   Version: v2.4.0-EAP-WORD-SHEETS-122

   Setup
   1) Create/open the Google Sheet for EAP Word Quest.
   2) Extensions > Apps Script, replace Code.gs with this file.
   3) Run setupEapWordQuest() once and authorize.
   4) Deploy as Web App. Execute as: Me. Access: Anyone.
   5) Copy the deployed /exec URL to:
      /herohealth/eap-word-quest/eap-word-sheet-config.js

   Student page posts completed Core attempts automatically.
   Teacher page reads action=eap_word_teacher through JSONP.
========================================================= */

const EAPWQ_VERSION = 'v2.4.0-EAP-WORD-SHEETS-122';
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

const EAPWQ_ARCS = {
  ARC1: { title:'Arc 1 • Foundation', sessions:['S1','S2','S3','BG1'] },
  ARC2: { title:'Arc 2 • Evidence', sessions:['S4','S5','S6','BG2'] },
  ARC3: { title:'Arc 3 • Academic Writing', sessions:['S7','S8','S9','BG3'] },
  ARC4: { title:'Arc 4 • Professional Academic Communication', sessions:['S10','S11','S12','BG4'] },
  ARC5: { title:'Arc 5 • Global Academic Communication', sessions:['S13','S14','S15','BG5'] }
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = String(p.action || p.api || 'health');
  const callback = String(p.callback || '');

  try {
    if (action === 'health') {
      return eapwqOut_({ ok:true, service:'EAP Word Quest Sheets', version:EAPWQ_VERSION, now:eapwqNow_() }, callback);
    }
    if (action === 'setup') {
      setupEapWordQuest();
      return eapwqOut_({ ok:true, action:'setup', version:EAPWQ_VERSION, now:eapwqNow_() }, callback);
    }
    if (action === 'eap_word_teacher') {
      setupEapWordQuest();
      const group = eapwqGroup_(p.section || p.group || EAPWQ_GROUP);
      const logs = eapwqReadAttempts_(group);
      return eapwqOut_({
        ok:true,
        action:'eap_word_teacher',
        group:group,
        generatedAt:eapwqNow_(),
        logs:logs,
        server:{ version:EAPWQ_VERSION, attemptCount:logs.length }
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

    if (action === 'eap_word_attempt') {
      const record = eapwqNormalizeAttempt_(payload.record || payload, payload);
      eapwqUpsertProfile_(record);
      const appended = eapwqAppendAttempt_(record);
      const summary = eapwqUpsertSummary_(record);
      return eapwqOut_({ ok:true, action:action, appended:appended, summary:summary, version:EAPWQ_VERSION, now:eapwqNow_() });
    }

    if (action === 'eap_word_batch') {
      const rows = Array.isArray(payload.records) ? payload.records : [];
      let appended = 0;
      rows.forEach(function(row) {
        const record = eapwqNormalizeAttempt_(row, payload);
        eapwqUpsertProfile_(record);
        if (eapwqAppendAttempt_(record)) appended += 1;
        eapwqUpsertSummary_(record);
      });
      return eapwqOut_({ ok:true, action:action, received:rows.length, appended:appended, version:EAPWQ_VERSION, now:eapwqNow_() });
    }

    return eapwqOut_({ ok:false, error:'Unknown action', action:action, version:EAPWQ_VERSION });
  } catch (err) {
    return eapwqOut_({ ok:false, error:String(err && err.message || err), stack:String(err && err.stack || ''), version:EAPWQ_VERSION });
  }
}

function setupEapWordQuest() {
  Object.keys(EAPWQ_HEADERS).forEach(function(name) { eapwqSheet_(name); });
  return { ok:true, spreadsheetId:eapwqSs_().getId(), version:EAPWQ_VERSION };
}

function eapwqSs_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function eapwqSheet_(name) {
  const ss = eapwqSs_();
  const headers = EAPWQ_HEADERS[name];
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const existing = sh.getLastColumn() ? sh.getRange(1,1,1,Math.max(sh.getLastColumn(), headers.length)).getValues()[0] : [];
  if (existing.slice(0,headers.length).join('|') !== headers.join('|')) {
    sh.clear();
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, headers.length);
  }
  return sh;
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
  if (typeof value === 'string') return value.split(/[|,;]/).map(eapwqText_).filter(Boolean);
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
  const sessionId = eapwqText_(input.sessionId || input.session || 'S1').toUpperCase();
  const correct = Math.max(0, Math.round(eapwqNumber_(input.correct, 0)));
  const total = Math.max(1, Math.round(eapwqNumber_(input.total || input.questions, correct || 1)));
  const accuracy = Math.max(0, Math.min(100, Math.round(eapwqNumber_(input.accuracy, (correct / total) * 100))));
  const playedAt = eapwqText_(input.playedAt || envelope.clientTs || eapwqNow_());
  const studentId = eapwqText_(input.studentId || 'anon');
  const fingerprint = eapwqText_(input.fingerprint || [EAPWQ_GROUP,studentId,sessionId,correct,total,accuracy,playedAt.slice(0,19)].join('|'));
  const threshold = Math.round(eapwqNumber_(input.passThreshold, eapwqThreshold_(sessionId)));

  return {
    serverTs:eapwqNow_(),
    attemptId:eapwqText_(input.attemptId || ('eapwq-' + new Date().getTime() + '-' + Math.floor(Math.random()*100000))),
    fingerprint:fingerprint,
    studentId:studentId,
    studentName:eapwqText_(input.studentName || 'Anonymous'),
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
    playedAt:playedAt,
    clientTs:eapwqText_(envelope.clientTs || input.clientTs || playedAt),
    source:eapwqText_(input.source || 'student-core'),
    pageUrl:eapwqText_(envelope.pageUrl || input.pageUrl),
    userAgent:eapwqText_(envelope.userAgent || input.userAgent),
    schemaVersion:eapwqText_(envelope.schemaVersion || input.schemaVersion || EAPWQ_VERSION),
    extraJson:JSON.stringify({ raw:input })
  };
}

function eapwqUpsertProfile_(record) {
  const sh = eapwqSheet_(EAPWQ.profiles);
  const headers = EAPWQ_HEADERS[EAPWQ.profiles];
  const values = sh.getDataRange().getValues();
  let row = -1;
  for (let i = 1; i < values.length; i += 1) {
    if (String(values[i][headers.indexOf('studentId')]) === record.studentId) { row = i + 1; break; }
  }
  const now = eapwqNow_();
  const old = row > 0 ? values[row - 1] : [];
  const firstSeen = row > 0 ? old[headers.indexOf('firstSeenAt')] : now;
  const out = {
    serverTs:now, studentId:record.studentId, studentName:record.studentName, group:EAPWQ_GROUP, section:EAPWQ_GROUP,
    course:record.course, firstSeenAt:firstSeen, lastSeenAt:now, userAgent:record.userAgent, sourceUrl:record.pageUrl,
    extraJson:JSON.stringify({ source:record.source, schemaVersion:record.schemaVersion })
  };
  const rowValues = headers.map(function(key) { return out[key]; });
  if (row > 0) sh.getRange(row,1,1,rowValues.length).setValues([rowValues]);
  else sh.appendRow(rowValues);
}

function eapwqAppendAttempt_(record) {
  const sh = eapwqSheet_(EAPWQ.attempts);
  const headers = EAPWQ_HEADERS[EAPWQ.attempts];
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
  sh.appendRow(headers.map(function(key) { return row[key]; }));
  return true;
}

function eapwqUpsertSummary_(record) {
  const sh = eapwqSheet_(EAPWQ.summary);
  const headers = EAPWQ_HEADERS[EAPWQ.summary];
  const values = sh.getDataRange().getValues();
  const idCol = headers.indexOf('studentId');
  const sessionCol = headers.indexOf('sessionId');
  let row = -1;
  for (let i = 1; i < values.length; i += 1) {
    if (String(values[i][idCol]) === record.studentId && String(values[i][sessionCol]) === record.sessionId) { row = i + 1; break; }
  }
  const old = row > 0 ? values[row - 1] : [];
  const getOld = function(key) { return old[headers.indexOf(key)]; };
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
  const rowValues = headers.map(function(key) { return out[key]; });
  if (row > 0) sh.getRange(row,1,1,rowValues.length).setValues([rowValues]);
  else sh.appendRow(rowValues);
  return { studentId:record.studentId, sessionId:record.sessionId, passed:out.passed, bestAccuracy:out.bestAccuracy };
}

function eapwqReadAttempts_(group) {
  const sh = eapwqSheet_(EAPWQ.attempts);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  const index = function(key) { return headers.indexOf(key); };
  const arrayFromJson = function(value) {
    try { const data = JSON.parse(value || '[]'); return Array.isArray(data) ? data : []; }
    catch (err) { return []; }
  };
  return values.slice(1).map(function(row) {
    const get = function(key) { const i = index(key); return i >= 0 ? row[i] : ''; };
    const section = String(get('section') || get('group') || EAPWQ_GROUP);
    if (section !== group) return null;
    const studentId = eapwqText_(get('studentId'));
    const studentName = eapwqText_(get('studentName'));
    return {
      logVersion:eapwqText_(get('schemaVersion')) || EAPWQ_VERSION,
      source:eapwqText_(get('source')) || 'sheets',
      group:EAPWQ_GROUP, section:EAPWQ_GROUP, studentId:studentId, studentName:studentName,
      studentKey:EAPWQ_GROUP + '|' + studentId + '|' + studentName,
      course:eapwqText_(get('course')), game:eapwqText_(get('game')),
      arcId:eapwqText_(get('arcId')), arc:eapwqText_(get('arc')), sessionId:eapwqText_(get('sessionId')),
      sessionTitle:eapwqText_(get('sessionTitle')), sessionType:eapwqText_(get('sessionType')),
      correct:eapwqNumber_(get('correct'),0), total:eapwqNumber_(get('total'),0), accuracy:eapwqNumber_(get('accuracy'),0),
      xp:eapwqNumber_(get('xp'),0), score:eapwqNumber_(get('score'),0), maxCombo:eapwqNumber_(get('maxCombo'),0),
      passed:eapwqBool_(get('passed')), passThreshold:eapwqNumber_(get('passThreshold'),0), passStatus:eapwqText_(get('passStatus')),
      cefrLevel:eapwqText_(get('cefrLevel')), aiDifficulty:eapwqText_(get('aiDifficulty')), aiPrediction:eapwqText_(get('aiPrediction')),
      hintUsed:eapwqNumber_(get('hintUsed'),0), weakWords:arrayFromJson(get('weakWordsJson')),
      itemTypeWeak:arrayFromJson(get('itemTypeWeakJson')), levelWeak:arrayFromJson(get('levelWeakJson')),
      responseTimeAvg:eapwqNumber_(get('responseTimeAvg'),0), attempt:eapwqNumber_(get('attempt'),1),
      bossHp:eapwqNumber_(get('bossHp'),0), bossMaxHp:eapwqNumber_(get('bossMaxHp'),0), isBoss:eapwqBool_(get('isBoss')),
      playedAt:eapwqText_(get('playedAt')), clientTs:eapwqText_(get('clientTs'))
    };
  }).filter(Boolean);
}

function eapwqOut_(value, callback) {
  const json = JSON.stringify(value);
  if (callback && /^[A-Za-z_$][A-Za-z0-9_$\.]{0,100}$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
