/* =========================================================
   EAP Word Quest • Shared Apps Script Module
   File: EAPWordQuest.gs

   Paste this as a NEW .gs file in the same Apps Script project as
   SharedWebAppRouter.gs. Do not add a second doGet/doPost here.
========================================================= */

const EAPWQ_VERSION = 'v2.6.2-SHARED-ROUTER-122';
const EAPWQ_TZ = 'Asia/Bangkok';
const EAPWQ_GROUP = '122';
const EAPWQ_SHEETS = {
  profiles: 'eap_word_profiles',
  attempts: 'eap_word_attempts',
  summary: 'eap_word_summary'
};

const EAPWQ_FLOW = [
  'S1','S2','S3','BG1',
  'S4','S5','S6','BG2',
  'S7','S8','S9','BG3',
  'S10','S11','S12','BG4',
  'S13','S14','S15','BG5'
];

const EAPWQ_HEADERS = {
  eap_word_profiles: [
    'serverTs','studentId','studentName','group','section','course',
    'firstSeenAt','lastSeenAt','userAgent','sourceUrl','extraJson'
  ],
  eap_word_attempts: [
    'serverTs','attemptId','fingerprint','studentId','studentName','group','section','course','game',
    'arcId','arc','sessionId','sessionTitle','sessionType','correct','total','accuracy','xp','score',
    'maxCombo','passed','passThreshold','passStatus','cefrLevel','aiDifficulty','aiPrediction','hintUsed',
    'weakWordsJson','itemTypeWeakJson','levelWeakJson','responseTimeAvg','attempt','bossHp','bossMaxHp',
    'isBoss','playedAt','clientTs','source','pageUrl','userAgent','schemaVersion','extraJson'
  ],
  eap_word_summary: [
    'serverTs','studentId','studentName','group','section','sessionId','sessionTitle','sessionType',
    'bestAccuracy','bestScore','passed','attempts','lastAccuracy','lastScore','lastPlayed','updatedAt',
    'weakWordsJson','aiPrediction','extraJson'
  ]
};

/* ---------- router entry points: called by SharedWebAppRouter.gs ---------- */

function eapWordDoGet_(e) {
  const p = (e && e.parameter) || {};
  const action = String(p.action || p.api || 'eap_word_health').toLowerCase();
  const callback = String(p.callback || '');

  try {
    if (action === 'eap_word_health') {
      eapwqSetup_();
      return eapwqOut_(eapwqHealth_(), callback);
    }

    if (action === 'eap_word_setup' || (action === 'setup' && String(p.module || '').toLowerCase() === 'eap_word')) {
      return eapwqOut_(eapwqSetup_(), callback);
    }

    if (action === 'eap_word_teacher') {
      eapwqSetup_();
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
          studentCount: eapwqUniqueStudents_(logs),
          timezone: EAPWQ_TZ
        }
      }, callback);
    }

    if (action === 'eap_word_summary') {
      eapwqSetup_();
      const group = eapwqGroup_(p.section || p.group || EAPWQ_GROUP);
      const summaries = eapwqReadSummaries_(group);
      return eapwqOut_({
        ok: true,
        action: 'eap_word_summary',
        group: group,
        generatedAt: eapwqNow_(),
        summaries: summaries,
        server: {
          version: EAPWQ_VERSION,
          summaryCount: summaries.length,
          timezone: EAPWQ_TZ
        }
      }, callback);
    }

    return eapwqOut_({ ok:false, error:'Unknown EAP Word Quest action', action:action, version:EAPWQ_VERSION }, callback);
  } catch (error) {
    return eapwqOut_({ ok:false, error:String(error && error.message || error), version:EAPWQ_VERSION }, callback);
  }
}

function eapWordDoPost_(e) {
  const payload = eapwqParse_(e);
  const action = String(payload.action || payload.type || '').toLowerCase();
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(25000);
    eapwqSetup_();

    if (action === 'eap_word_attempt') {
      const record = eapwqNormalize_(payload.record || payload, payload);
      eapwqUpsertProfile_(record);

      if (record.isProfile) {
        return eapwqOut_({ ok:true, action:action, profileOnly:true, version:EAPWQ_VERSION, now:eapwqNow_() });
      }
      if (!eapwqIsLearningRecord_(record)) {
        return eapwqOut_({ ok:false, action:action, error:'Invalid EAP Word Quest session', sessionId:record.sessionId, version:EAPWQ_VERSION });
      }

      const appended = eapwqAppendAttempts_([record]);
      const summary = eapwqUpsertSummary_(record);
      return eapwqOut_({
        ok:true,
        action:action,
        appended:appended.count,
        duplicate:appended.duplicates,
        summary:summary,
        version:EAPWQ_VERSION,
        now:eapwqNow_()
      });
    }

    if (action === 'eap_word_batch') {
      const incoming = Array.isArray(payload.records) ? payload.records : [];
      const records = [];
      let profiles = 0;
      let skipped = 0;

      incoming.forEach(function(row) {
        const record = eapwqNormalize_(row, payload);
        eapwqUpsertProfile_(record);
        if (record.isProfile) {
          profiles += 1;
          return;
        }
        if (!eapwqIsLearningRecord_(record)) {
          skipped += 1;
          return;
        }
        records.push(record);
      });

      const appended = eapwqAppendAttempts_(records);
      const summaries = records.map(eapwqUpsertSummary_);
      return eapwqOut_({
        ok:true,
        action:action,
        received:incoming.length,
        appended:appended.count,
        duplicate:appended.duplicates,
        profiles:profiles,
        skipped:skipped,
        summaries:summaries,
        version:EAPWQ_VERSION,
        now:eapwqNow_()
      });
    }

    return eapwqOut_({ ok:false, error:'Unknown EAP Word Quest action', action:action, version:EAPWQ_VERSION });
  } catch (error) {
    return eapwqOut_({ ok:false, error:String(error && error.message || error), version:EAPWQ_VERSION });
  } finally {
    try { lock.releaseLock(); } catch (error) {}
  }
}

/* ---------- setup and utilities ---------- */

function eapwqSetup_() {
  const ss = eapwqSpreadsheet_();
  Object.keys(EAPWQ_HEADERS).forEach(function(name) { eapwqSheet_(name); });
  return { ok:true, spreadsheetId:ss.getId(), version:EAPWQ_VERSION, now:eapwqNow_() };
}

function eapwqSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const savedId = String(props.getProperty('EAPWQ_SPREADSHEET_ID') || '');
  const ss = savedId ? SpreadsheetApp.openById(savedId) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Run eapwqSetup_() once from the EAP Word Quest Google Sheet.');
  if (!savedId) props.setProperty('EAPWQ_SPREADSHEET_ID', ss.getId());
  return ss;
}

function eapwqSheet_(name) {
  const ss = eapwqSpreadsheet_();
  const required = EAPWQ_HEADERS[name];
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
    sh.getRange(1,1,1,required.length).setValues([required]);
    sh.setFrozenRows(1);
    return sh;
  }

  const currentWidth = Math.max(1, sh.getLastColumn());
  const existing = sh.getRange(1,1,1,currentWidth).getValues()[0].map(eapwqText_);
  const headers = existing.slice();
  required.forEach(function(key) {
    if (headers.indexOf(key) < 0) headers.push(key);
  });

  /* Never clear old rows: only add missing header columns. */
  if (headers.length !== existing.length || headers.join('|') !== existing.join('|')) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
  }
  sh.setFrozenRows(1);
  return sh;
}

function eapwqHeaders_(name) {
  const sh = eapwqSheet_(name);
  return sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getValues()[0].map(eapwqText_);
}

function eapwqParse_(e) {
  const raw = e && e.postData && e.postData.contents ? String(e.postData.contents) : '';
  const params = (e && e.parameter) || {};
  if (raw) {
    const trimmed = raw.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      return JSON.parse(trimmed);
    }
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

function eapwqNum_(value, fallback) {
  const n = Number(value);
  return isFinite(n) ? n : (fallback == null ? 0 : fallback);
}

function eapwqBool_(value) {
  return value === true || value === 1 || String(value).toLowerCase() === 'true';
}

function eapwqArray_(value) {
  if (Array.isArray(value)) return value.map(eapwqText_).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(eapwqText_).filter(Boolean);
    } catch (error) {}
    return value.split(/[|,;]/).map(eapwqText_).filter(Boolean);
  }
  return [];
}

function eapwqGroup_(value) {
  return String(value || EAPWQ_GROUP) === EAPWQ_GROUP ? EAPWQ_GROUP : EAPWQ_GROUP;
}

function eapwqThreshold_(sessionId) {
  if (sessionId === 'BG5') return 75;
  if (/^BG/.test(sessionId)) return 70;
  return 60;
}

function eapwqNormalize_(input, envelope) {
  input = input || {};
  envelope = envelope || {};
  const sessionId = eapwqText_(input.sessionId || input.session || 'UNKNOWN').toUpperCase();
  const correct = Math.max(0, Math.round(eapwqNum_(input.correct,0)));
  const total = Math.max(1, Math.round(eapwqNum_(input.total || input.questions, correct || 1)));
  const accuracy = Math.max(0, Math.min(100, Math.round(eapwqNum_(input.accuracy,(correct / total) * 100))));
  const playedAt = eapwqText_(input.playedAt || input.endedAt || envelope.clientTs || eapwqNow_());
  const studentId = eapwqText_(input.studentId || 'anon');
  const studentName = eapwqText_(input.studentName || 'Anonymous');
  const passThreshold = Math.round(eapwqNum_(input.passThreshold,eapwqThreshold_(sessionId)));
  const isProfile = eapwqBool_(input.profileIdentitySync) || sessionId === 'PROFILE' ||
    eapwqText_(input.sessionType).toLowerCase() === 'profile' ||
    eapwqText_(input.source).toLowerCase().indexOf('profile-identity-sync') >= 0;
  const fingerprint = eapwqText_(input.fingerprint || [
    EAPWQ_GROUP,studentId,studentName.toLowerCase(),sessionId,correct,total,accuracy,playedAt.slice(0,19)
  ].join('|'));

  return {
    serverTs:eapwqNow_(),
    attemptId:eapwqText_(input.attemptId || ('eapwq-' + new Date().getTime() + '-' + Math.floor(Math.random() * 100000))),
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
    xp:Math.max(0,Math.round(eapwqNum_(input.xp,input.score))),
    score:Math.max(0,Math.round(eapwqNum_(input.score,input.xp))),
    maxCombo:Math.max(0,Math.round(eapwqNum_(input.maxCombo,0))),
    passed:eapwqBool_(input.passed) || accuracy >= passThreshold,
    passThreshold:passThreshold,
    passStatus:eapwqText_(input.passStatus),
    cefrLevel:eapwqText_(input.cefrLevel),
    aiDifficulty:eapwqText_(input.aiDifficulty),
    aiPrediction:eapwqText_(input.aiPrediction),
    hintUsed:Math.max(0,Math.round(eapwqNum_(input.hintUsed,0))),
    weakWords:eapwqArray_(input.weakWords),
    itemTypeWeak:eapwqArray_(input.itemTypeWeak),
    levelWeak:eapwqArray_(input.levelWeak),
    responseTimeAvg:Math.max(0,eapwqNum_(input.responseTimeAvg,0)),
    attempt:Math.max(1,Math.round(eapwqNum_(input.attempt,1))),
    bossHp:Math.max(0,Math.round(eapwqNum_(input.bossHp,0))),
    bossMaxHp:Math.max(0,Math.round(eapwqNum_(input.bossMaxHp,0))),
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

function eapwqIsLearningRecord_(record) {
  return EAPWQ_FLOW.indexOf(String(record && record.sessionId || '').toUpperCase()) >= 0;
}

/* ---------- Google Sheets writes ---------- */

function eapwqUpsertProfile_(record) {
  const sh = eapwqSheet_(EAPWQ_SHEETS.profiles);
  const headers = eapwqHeaders_(EAPWQ_SHEETS.profiles);
  const idIndex = headers.indexOf('studentId');
  const rowCount = Math.max(0,sh.getLastRow() - 1);
  const values = rowCount ? sh.getRange(2,1,rowCount,headers.length).getValues() : [];
  let target = -1;

  for (let i = 0; i < values.length; i += 1) {
    if (String(values[i][idIndex]) === record.studentId) { target = i + 2; break; }
  }

  const old = target > 0 ? values[target - 2] : [];
  const firstSeenIndex = headers.indexOf('firstSeenAt');
  const firstSeen = target > 0 ? eapwqIso_(old[firstSeenIndex]) : eapwqNow_();
  const out = {
    serverTs:eapwqNow_(), studentId:record.studentId, studentName:record.studentName,
    group:EAPWQ_GROUP, section:EAPWQ_GROUP, course:record.course,
    firstSeenAt:firstSeen, lastSeenAt:eapwqNow_(), userAgent:record.userAgent, sourceUrl:record.pageUrl,
    extraJson:JSON.stringify({ source:record.source, schemaVersion:record.schemaVersion })
  };
  const row = headers.map(function(key) { return Object.prototype.hasOwnProperty.call(out,key) ? out[key] : ''; });
  if (target > 0) sh.getRange(target,1,1,row.length).setValues([row]);
  else sh.getRange(sh.getLastRow() + 1,1,1,row.length).setValues([row]);
}

function eapwqAppendAttempts_(records) {
  const rows = Array.isArray(records) ? records : [];
  if (!rows.length) return { count:0, duplicates:0 };

  const sh = eapwqSheet_(EAPWQ_SHEETS.attempts);
  const headers = eapwqHeaders_(EAPWQ_SHEETS.attempts);
  const fpIndex = headers.indexOf('fingerprint');
  const existingRows = Math.max(0,sh.getLastRow() - 1);
  const seen = new Set();
  if (existingRows && fpIndex >= 0) {
    sh.getRange(2,fpIndex + 1,existingRows,1).getValues().forEach(function(row) {
      const fingerprint = eapwqText_(row[0]);
      if (fingerprint) seen.add(fingerprint);
    });
  }

  const values = [];
  let duplicates = 0;
  rows.forEach(function(record) {
    if (seen.has(record.fingerprint)) { duplicates += 1; return; }
    seen.add(record.fingerprint);
    const out = {
      serverTs:record.serverTs, attemptId:record.attemptId, fingerprint:record.fingerprint,
      studentId:record.studentId, studentName:record.studentName, group:record.group, section:record.section,
      course:record.course, game:record.game, arcId:record.arcId, arc:record.arc, sessionId:record.sessionId,
      sessionTitle:record.sessionTitle, sessionType:record.sessionType, correct:record.correct, total:record.total,
      accuracy:record.accuracy, xp:record.xp, score:record.score, maxCombo:record.maxCombo, passed:String(record.passed),
      passThreshold:record.passThreshold, passStatus:record.passStatus, cefrLevel:record.cefrLevel,
      aiDifficulty:record.aiDifficulty, aiPrediction:record.aiPrediction, hintUsed:record.hintUsed,
      weakWordsJson:JSON.stringify(record.weakWords), itemTypeWeakJson:JSON.stringify(record.itemTypeWeak),
      levelWeakJson:JSON.stringify(record.levelWeak), responseTimeAvg:record.responseTimeAvg, attempt:record.attempt,
      bossHp:record.bossHp, bossMaxHp:record.bossMaxHp, isBoss:String(record.isBoss), playedAt:record.playedAt,
      clientTs:record.clientTs, source:record.source, pageUrl:record.pageUrl, userAgent:record.userAgent,
      schemaVersion:record.schemaVersion, extraJson:record.extraJson
    };
    values.push(headers.map(function(key) { return Object.prototype.hasOwnProperty.call(out,key) ? out[key] : ''; }));
  });

  if (values.length) sh.getRange(sh.getLastRow() + 1,1,values.length,headers.length).setValues(values);
  return { count:values.length, duplicates:duplicates };
}

function eapwqUpsertSummary_(record) {
  const sh = eapwqSheet_(EAPWQ_SHEETS.summary);
  const headers = eapwqHeaders_(EAPWQ_SHEETS.summary);
  const idIndex = headers.indexOf('studentId');
  const sessionIndex = headers.indexOf('sessionId');
  const rows = Math.max(0,sh.getLastRow() - 1);
  const values = rows ? sh.getRange(2,1,rows,headers.length).getValues() : [];
  let target = -1;

  for (let i = 0; i < values.length; i += 1) {
    if (String(values[i][idIndex]) === record.studentId && String(values[i][sessionIndex]) === record.sessionId) {
      target = i + 2;
      break;
    }
  }

  const old = target > 0 ? values[target - 2] : [];
  const readOld = function(key) {
    const index = headers.indexOf(key);
    return index >= 0 ? old[index] : '';
  };
  const out = {
    serverTs:eapwqNow_(), studentId:record.studentId, studentName:record.studentName,
    group:EAPWQ_GROUP, section:EAPWQ_GROUP, sessionId:record.sessionId,
    sessionTitle:record.sessionTitle, sessionType:record.sessionType,
    bestAccuracy:Math.max(eapwqNum_(readOld('bestAccuracy'),0),record.accuracy),
    bestScore:Math.max(eapwqNum_(readOld('bestScore'),0),record.score),
    passed:String(eapwqBool_(readOld('passed')) || record.passed),
    attempts:eapwqNum_(readOld('attempts'),0) + 1,
    lastAccuracy:record.accuracy, lastScore:record.score, lastPlayed:record.playedAt,
    updatedAt:eapwqNow_(), weakWordsJson:JSON.stringify(record.weakWords), aiPrediction:record.aiPrediction,
    extraJson:JSON.stringify({ passThreshold:record.passThreshold, source:record.source, schemaVersion:record.schemaVersion })
  };
  const row = headers.map(function(key) { return Object.prototype.hasOwnProperty.call(out,key) ? out[key] : ''; });
  if (target > 0) sh.getRange(target,1,1,row.length).setValues([row]);
  else sh.getRange(sh.getLastRow() + 1,1,1,row.length).setValues([row]);
  return { studentId:record.studentId, sessionId:record.sessionId, passed:out.passed, bestAccuracy:out.bestAccuracy };
}

/* ---------- API reads for Teacher Dashboard ---------- */

function eapwqReadAttempts_(group) {
  const sh = eapwqSheet_(EAPWQ_SHEETS.attempts);
  const rows = sh.getDataRange().getValues();
  if (rows.length < 2) return [];
  const headers = rows[0].map(eapwqText_);
  const index = function(key) { return headers.indexOf(key); };

  return rows.slice(1).map(function(row) {
    const get = function(key) { const i = index(key); return i >= 0 ? row[i] : ''; };
    const sessionId = eapwqText_(get('sessionId')).toUpperCase();
    const section = eapwqText_(get('section') || get('group') || EAPWQ_GROUP);
    if (section !== group || EAPWQ_FLOW.indexOf(sessionId) < 0) return null;
    const studentId = eapwqText_(get('studentId'));
    const studentName = eapwqText_(get('studentName'));
    return {
      attemptId:eapwqText_(get('attemptId')), fingerprint:eapwqText_(get('fingerprint')),
      serverTs:eapwqIso_(get('serverTs')), source:eapwqText_(get('source')) || 'sheets',
      group:EAPWQ_GROUP, section:EAPWQ_GROUP, studentId:studentId, studentName:studentName,
      studentKey:EAPWQ_GROUP + '|' + studentId,
      course:eapwqText_(get('course')), game:eapwqText_(get('game')), arcId:eapwqText_(get('arcId')),
      arc:eapwqText_(get('arc')), sessionId:sessionId, sessionTitle:eapwqText_(get('sessionTitle')),
      sessionType:eapwqText_(get('sessionType')), correct:eapwqNum_(get('correct'),0),
      total:eapwqNum_(get('total'),0), accuracy:eapwqNum_(get('accuracy'),0), xp:eapwqNum_(get('xp'),0),
      score:eapwqNum_(get('score'),0), maxCombo:eapwqNum_(get('maxCombo'),0), passed:eapwqBool_(get('passed')),
      passThreshold:eapwqNum_(get('passThreshold'),0), passStatus:eapwqText_(get('passStatus')),
      cefrLevel:eapwqText_(get('cefrLevel')), aiDifficulty:eapwqText_(get('aiDifficulty')),
      aiPrediction:eapwqText_(get('aiPrediction')), hintUsed:eapwqNum_(get('hintUsed'),0),
      weakWords:eapwqArray_(get('weakWordsJson')), itemTypeWeak:eapwqArray_(get('itemTypeWeakJson')),
      levelWeak:eapwqArray_(get('levelWeakJson')), responseTimeAvg:eapwqNum_(get('responseTimeAvg'),0),
      attempt:eapwqNum_(get('attempt'),1), bossHp:eapwqNum_(get('bossHp'),0),
      bossMaxHp:eapwqNum_(get('bossMaxHp'),0), isBoss:eapwqBool_(get('isBoss')),
      playedAt:eapwqIso_(get('playedAt')), clientTs:eapwqIso_(get('clientTs'))
    };
  }).filter(Boolean);
}

function eapwqReadSummaries_(group) {
  const sh = eapwqSheet_(EAPWQ_SHEETS.summary);
  const rows = sh.getDataRange().getValues();
  if (rows.length < 2) return [];
  const headers = rows[0].map(eapwqText_);
  const index = function(key) { return headers.indexOf(key); };
  return rows.slice(1).map(function(row) {
    const get = function(key) { const i = index(key); return i >= 0 ? row[i] : ''; };
    const sessionId = eapwqText_(get('sessionId')).toUpperCase();
    const section = eapwqText_(get('section') || get('group') || EAPWQ_GROUP);
    if (section !== group || EAPWQ_FLOW.indexOf(sessionId) < 0) return null;
    return {
      studentId:eapwqText_(get('studentId')), studentName:eapwqText_(get('studentName')),
      group:EAPWQ_GROUP, section:EAPWQ_GROUP, sessionId:sessionId,
      sessionTitle:eapwqText_(get('sessionTitle')), sessionType:eapwqText_(get('sessionType')),
      bestAccuracy:eapwqNum_(get('bestAccuracy'),0), bestScore:eapwqNum_(get('bestScore'),0),
      passed:eapwqBool_(get('passed')), attempts:eapwqNum_(get('attempts'),0),
      lastAccuracy:eapwqNum_(get('lastAccuracy'),0), lastScore:eapwqNum_(get('lastScore'),0),
      lastPlayed:eapwqIso_(get('lastPlayed')), updatedAt:eapwqIso_(get('updatedAt')),
      weakWords:eapwqArray_(get('weakWordsJson')), aiPrediction:eapwqText_(get('aiPrediction'))
    };
  }).filter(Boolean);
}

function eapwqUniqueStudents_(logs) {
  const ids = {};
  (logs || []).forEach(function(log) {
    const id = eapwqText_(log && log.studentId);
    if (id) ids[id] = true;
  });
  return Object.keys(ids).length;
}

function eapwqHealth_() {
  const logs = eapwqReadAttempts_(EAPWQ_GROUP);
  const summaries = eapwqReadSummaries_(EAPWQ_GROUP);
  return {
    ok:true,
    service:'EAP Word Quest Shared Sheets Module',
    version:EAPWQ_VERSION,
    group:EAPWQ_GROUP,
    now:eapwqNow_(),
    server:{
      attemptCount:logs.length,
      summaryCount:summaries.length,
      studentCount:eapwqUniqueStudents_(logs),
      timezone:EAPWQ_TZ
    }
  };
}

function eapwqOut_(value, callback) {
  const json = JSON.stringify(value);
  if (callback && /^[A-Za-z_$][A-Za-z0-9_$.]{0,100}$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
