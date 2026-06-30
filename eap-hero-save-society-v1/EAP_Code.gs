/* EAP Hero Apps Script Receiver v4 — Shared Router
   Google Sheet-bound Apps Script

   One Web App endpoint for:
   - EAP Hero Sessions / events / existing Teacher APIs
   - EAP Word Quest Group 122 attempts / summaries / Teacher API

   IMPORTANT: This is the ONLY file in the shared Apps Script project that
   may contain doGet() and doPost().

   Setup
   1) Replace EAP_Code.gs with this complete file
   2) Clear the standalone Word Quest doGet()/doPost() from Code.gs
   3) Keep EAPWordQuest.gs only for non-router helper code, or clear it
   4) Run setupEapSystem() once and authorize
   5) Deploy > Manage deployments > Edit > New version > Deploy
   6) Web app access: Anyone
*/

const EAP_CONFIG = {
  SPREADSHEET_ID: '',
  TIMEZONE: 'Asia/Bangkok',
  DEFAULT_SECTION: '122',
  COURSE: 'EAP Hero: Save the Society'
};

const H = {
  profiles: [
    'profileId',
    'studentId',
    'studentName',
    'section',
    'firstSeenAt',
    'lastSeenAt'
  ],

  attempts: [
    'attemptId',
    'submittedAt',
    'section',
    'studentId',
    'studentName',
    'sessionId',
    'sessionTitle',
    'skill',
    'score',
    'accuracy',
    'passMark',
    'passed',
    'legacyCompletion',
    'hintUsed',
    'replay',
    'clientTimestamp',
    'sourceUrl'
  ],

  summary: [
    'summaryId',
    'updatedAt',
    'section',
    'studentId',
    'studentName',
    'sessionId',
    'sessionTitle',
    'skill',
    'bestScore',
    'bestAccuracy',
    'passed',
    'legacyCompletion',
    'attempts',
    'reviewFlag'
  ],

  errors: [
    'errorId',
    'createdAt',
    'stage',
    'message',
    'payloadJson'
  ]
};

/* ---------------- Core helpers ---------------- */

function ss_() {
  return EAP_CONFIG.SPREADSHEET_ID
    ? SpreadsheetApp.openById(EAP_CONFIG.SPREADSHEET_ID)
    : SpreadsheetApp.getActive();
}

function sh_(name) {
  const ss = ss_();
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);

    sheet
      .getRange(1, 1, 1, H[name].length)
      .setValues([H[name]]);

    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, H[name].length).setFontWeight('bold');
    sheet.autoResizeColumns(1, H[name].length);
  }

  return sheet;
}

function out_(data, callback) {
  const json = JSON.stringify(data);

  if (
    callback &&
    /^[A-Za-z_$][A-Za-z0-9_$\.]{0,100}$/.test(String(callback))
  ) {
    return ContentService
      .createTextOutput(String(callback) + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function text_(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback === undefined ? '' : String(fallback);
  }

  return String(value);
}

function number_(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n)
    ? n
    : (fallback === undefined ? 0 : fallback);
}

function bool_(value) {
  return value === true ||
    String(value).toLowerCase() === 'true' ||
    String(value) === '1';
}

function id_(prefix) {
  return prefix + '-' +
    Date.now() + '-' +
    Math.random().toString(36).slice(2, 10);
}

function rowObject_(headers, row) {
  const obj = {};

  headers.forEach((key, i) => {
    obj[key] = row[i];
  });

  return obj;
}

function json_(value) {
  try {
    return JSON.stringify(value || {});
  } catch (err) {
    return '{}';
  }
}

function now_() {
  const d = new Date();

  return {
    iso: Utilities.formatDate(
      d,
      EAP_CONFIG.TIMEZONE,
      "yyyy-MM-dd'T'HH:mm:ssXXX"
    ),
    date: Utilities.formatDate(
      d,
      EAP_CONFIG.TIMEZONE,
      'yyyy-MM-dd'
    )
  };
}

/* ---------------- Setup ---------------- */

function setupEapHero() {
  Object.keys(H).forEach(sh_);
  setupEapWordQuest();

  return {
    ok: true,
    spreadsheetId: ss_().getId(),
    sheets: Object.keys(H),
    wordQuestSheets: Object.keys(EAPWQ_H)
  };
}

function setupEapSystem() {
  return setupEapHero();
}

/* ---------------- Shared Web App Router ---------------- */

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = text_(p.action, 'health').toLowerCase();
    const callback = text_(p.callback, '');

    if (action === 'health') {
      return out_({
        ok: true,
        service: 'eap-shared',
        course: EAP_CONFIG.COURSE,
        section: EAP_CONFIG.DEFAULT_SECTION,
        modules: ['EAP Hero Sessions', 'EAP Word Quest', 'Teacher APIs'],
        now: now_().iso
      }, callback);
    }

    if (action === 'submit_attempt') {
      return out_(submitAttempt_(p, 'GET'), callback);
    }

    if (action === 'teacher_summary') {
      return out_(teacherSummary_(p), callback);
    }

    if (action === 'teacher_students') {
      return out_(teacherStudents_(p), callback);
    }

    if (
      action === 'eap_word_teacher' ||
      action === 'eap_word_summary' ||
      action === 'eap_word_health' ||
      action === 'eap_word_setup'
    ) {
      return out_(eapwqHandleGet_(action, p), callback);
    }

    return out_({
      ok: false,
      error: 'Unknown action: ' + action
    }, callback);

  } catch (err) {
    logError_('GET', err, e && e.parameter);

    return out_({
      ok: false,
      error: String(err)
    });
  }
}

function doPost(e) {
  let payload = {};

  try {
    payload = parsePost_(e);

    const action = text_(payload.action, 'submit_attempt').toLowerCase();

    if (action === 'submit_attempt') {
      return out_(submitAttempt_(payload, 'POST'));
    }

    if (action === 'submit_event') {
      return out_(submitEvent_(payload));
    }

    if (action === 'eap_word_attempt' || action === 'eap_word_batch') {
      return out_(eapwqHandlePost_(action, payload));
    }

    return out_({
      ok: false,
      error: 'Unknown action: ' + action
    });

  } catch (err) {
    logError_('POST', err, payload);

    return out_({
      ok: false,
      error: String(err)
    });
  }
}

function parsePost_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return (e && e.parameter) || {};
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    return (e && e.parameter) || {};
  }
}

/* ---------------- Existing EAP Hero attempt receiver ---------------- */

function submitAttempt_(p, source) {
  const studentId = text_(p.studentId, '');
  const sessionId = text_(p.sessionId, '');
  const skill = text_(p.skill, '');

  if (!studentId || !sessionId || !skill) {
    return {
      ok: false,
      error: 'studentId, sessionId and skill are required'
    };
  }

  const now = now_();
  const score = number_(p.score, 0);
  const accuracy = number_(p.accuracy, 0);
  const passMark = number_(p.passMark, 60);
  const legacyCompletion = bool_(p.legacyCompletion);

  const passed = p.passed === undefined
    ? (legacyCompletion || score >= passMark)
    : bool_(p.passed);

  const attempt = {
    attemptId: text_(p.attemptId, id_('attempt')),
    submittedAt: now.iso,
    section: text_(p.section, EAP_CONFIG.DEFAULT_SECTION),
    studentId: studentId,
    studentName: text_(p.studentName, 'Guest'),
    sessionId: sessionId,
    sessionTitle: text_(p.sessionTitle, ''),
    skill: skill,
    score: score,
    accuracy: accuracy,
    passMark: passMark,
    passed: passed ? 'TRUE' : 'FALSE',
    legacyCompletion: legacyCompletion ? 'TRUE' : 'FALSE',
    hintUsed: number_(p.hintUsed, 0),
    replay: bool_(p.replay) ? 'TRUE' : 'FALSE',
    clientTimestamp: text_(p.clientTimestamp, ''),
    sourceUrl: text_(p.sourceUrl, '')
  };

  if (attemptExists_(attempt.attemptId)) {
    return {
      ok: true,
      duplicate: true,
      source: source,
      attemptId: attempt.attemptId
    };
  }

  upsertProfile_(attempt);

  sh_('attempts').appendRow(
    H.attempts.map(key => attempt[key])
  );

  upsertSummary_(attempt, now.iso);

  return {
    ok: true,
    duplicate: false,
    source: source,
    attemptId: attempt.attemptId,
    studentId: attempt.studentId,
    sessionId: attempt.sessionId,
    skill: attempt.skill,
    score: attempt.score
  };
}

function attemptExists_(attemptId) {
  const sheet = sh_('attempts');
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return false;
  }

  const ids = sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getValues()
    .flat()
    .map(String);

  return ids.includes(String(attemptId));
}

/* ---------------- Existing EAP Hero profiles ---------------- */

function upsertProfile_(attempt) {
  const sheet = sh_('profiles');
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    const row = rowObject_(H.profiles, values[i]);

    if (text_(row.studentId) === attempt.studentId) {
      sheet
        .getRange(i + 1, 1, 1, H.profiles.length)
        .setValues([[
          row.profileId,
          attempt.studentId,
          attempt.studentName,
          attempt.section,
          row.firstSeenAt,
          attempt.submittedAt
        ]]);

      return;
    }
  }

  sheet.appendRow([
    id_('profile'),
    attempt.studentId,
    attempt.studentName,
    attempt.section,
    attempt.submittedAt,
    attempt.submittedAt
  ]);
}

/* ---------------- Existing EAP Hero summary ---------------- */

function upsertSummary_(attempt, updatedAt) {
  const sheet = sh_('summary');
  const values = sheet.getDataRange().getValues();

  let foundRow = -1;
  let old = null;

  for (let i = 1; i < values.length; i++) {
    const row = rowObject_(H.summary, values[i]);

    if (
      text_(row.studentId) === attempt.studentId &&
      text_(row.sessionId) === attempt.sessionId &&
      text_(row.skill) === attempt.skill
    ) {
      foundRow = i + 1;
      old = row;
      break;
    }
  }

  const oldBestScore = old ? number_(old.bestScore, 0) : 0;
  const oldBestAccuracy = old ? number_(old.bestAccuracy, 0) : 0;
  const oldAttempts = old ? number_(old.attempts, 0) : 0;

  const bestScore = Math.max(oldBestScore, attempt.score);
  const bestAccuracy = Math.max(oldBestAccuracy, attempt.accuracy);

  const passed =
    (old && text_(old.passed).toUpperCase() === 'TRUE') ||
    attempt.passed === 'TRUE';

  const legacyCompletion =
    (old && text_(old.legacyCompletion).toUpperCase() === 'TRUE') ||
    attempt.legacyCompletion === 'TRUE';

  const reviewFlag = legacyCompletion
    ? 'legacy_completion_only'
    : (bestScore < 60 ? 'needs_support' : '');

  const summary = {
    summaryId: old ? old.summaryId : id_('summary'),
    updatedAt: updatedAt,
    section: attempt.section,
    studentId: attempt.studentId,
    studentName: attempt.studentName,
    sessionId: attempt.sessionId,
    sessionTitle: attempt.sessionTitle,
    skill: attempt.skill,
    bestScore: bestScore,
    bestAccuracy: bestAccuracy,
    passed: passed ? 'TRUE' : 'FALSE',
    legacyCompletion: legacyCompletion ? 'TRUE' : 'FALSE',
    attempts: oldAttempts + 1,
    reviewFlag: reviewFlag
  };

  const rowData = H.summary.map(key => summary[key]);

  if (foundRow > 0) {
    sheet
      .getRange(foundRow, 1, 1, H.summary.length)
      .setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}

/* ---------------- Existing EAP Hero events ---------------- */

function submitEvent_(p) {
  const ss = ss_();
  let sheet = ss.getSheetByName('events');

  if (!sheet) {
    sheet = ss.insertSheet('events');

    sheet.appendRow([
      'eventId',
      'createdAt',
      'section',
      'studentId',
      'studentName',
      'eventType',
      'sessionId',
      'skill',
      'valueJson'
    ]);

    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 9).setFontWeight('bold');
  }

  const now = now_();

  const row = [
    text_(p.eventId, id_('event')),
    now.iso,
    text_(p.section, EAP_CONFIG.DEFAULT_SECTION),
    text_(p.studentId, ''),
    text_(p.studentName, ''),
    text_(p.eventType, 'event'),
    text_(p.sessionId, ''),
    text_(p.skill, ''),
    json_(p.value || p)
  ];

  sheet.appendRow(row);

  return {
    ok: true,
    eventId: row[0]
  };
}

/* ---------------- Existing EAP Hero Teacher APIs ---------------- */

function teacherSummary_(p) {
  const section = text_(p.section, EAP_CONFIG.DEFAULT_SECTION);
  const sheet = sh_('summary');
  const values = sheet.getDataRange().getValues();

  const rows = values
    .slice(1)
    .map(row => rowObject_(H.summary, row))
    .filter(row => text_(row.section) === section);

  const students = {};
  let totalScore = 0;
  let scoreCount = 0;
  let supportCount = 0;
  let legacyCount = 0;

  rows.forEach(row => {
    students[row.studentId] = true;

    if (text_(row.legacyCompletion).toUpperCase() === 'TRUE') {
      legacyCount++;
    } else {
      totalScore += number_(row.bestScore, 0);
      scoreCount++;
    }

    if (text_(row.reviewFlag) === 'needs_support') {
      supportCount++;
    }
  });

  return {
    ok: true,
    section: section,
    students: Object.keys(students).length,
    skillRecords: rows.length,
    avgBestScore: scoreCount
      ? Math.round((totalScore / scoreCount) * 100) / 100
      : 0,
    needsSupport: supportCount,
    legacyOnly: legacyCount,
    updatedAt: now_().iso
  };
}

function teacherStudents_(p) {
  const section = text_(p.section, EAP_CONFIG.DEFAULT_SECTION);
  const query = text_(p.q, '').toLowerCase();

  const rows = sh_('summary')
    .getDataRange()
    .getValues()
    .slice(1)
    .map(row => rowObject_(H.summary, row))
    .filter(row => text_(row.section) === section);

  const grouped = {};

  rows.forEach(row => {
    const studentId = text_(row.studentId);

    if (!grouped[studentId]) {
      grouped[studentId] = {
        studentId: studentId,
        studentName: text_(row.studentName),
        section: text_(row.section),
        scores: [],
        skills: 0,
        reviewCount: 0,
        legacyCompletion: 0
      };
    }

    grouped[studentId].skills++;

    if (text_(row.legacyCompletion).toUpperCase() === 'TRUE') {
      grouped[studentId].legacyCompletion++;
    } else {
      grouped[studentId].scores.push(number_(row.bestScore, 0));
    }

    if (text_(row.reviewFlag)) {
      grouped[studentId].reviewCount++;
    }
  });

  let students = Object.values(grouped).map(student => ({
    studentId: student.studentId,
    studentName: student.studentName,
    section: student.section,
    skills: student.skills,
    avgBestScore: student.scores.length
      ? Math.round(
        student.scores.reduce((sum, score) => sum + score, 0) /
        student.scores.length
      )
      : 0,
    legacyCompletion: student.legacyCompletion,
    reviewCount: student.reviewCount,
    status: student.reviewCount
      ? 'review'
      : (student.legacyCompletion ? 'legacy' : 'active')
  }));

  if (query) {
    students = students.filter(student =>
      (
        student.studentId + ' ' +
        student.studentName + ' ' +
        student.section
      ).toLowerCase().includes(query)
    );
  }

  return {
    ok: true,
    section: section,
    students: students
  };
}

/* ---------------- Error log ---------------- */

function logError_(stage, err, payload) {
  try {
    const sheet = sh_('errors');

    sheet.appendRow([
      id_('error'),
      now_().iso,
      stage,
      String(err && err.stack ? err.stack : err),
      json_(payload)
    ]);
  } catch (ignore) {
    // Do not let error logging create a second error.
  }
}

/* =========================================================
   EAP Word Quest module — shared receiver
   This section intentionally has no doGet()/doPost().
   EAP_Code.gs above is the only Web App router.
========================================================= */

const EAPWQ = {
  profiles: 'eap_word_profiles',
  attempts: 'eap_word_attempts',
  summary: 'eap_word_summary'
};

const EAPWQ_H = {
  eap_word_profiles: [
    'serverTs','studentId','studentName','group','section','course',
    'firstSeenAt','lastSeenAt','userAgent','sourceUrl','extraJson'
  ],
  eap_word_attempts: [
    'serverTs','attemptId','fingerprint','studentId','studentName','group',
    'section','course','game','arcId','arc','sessionId','sessionTitle',
    'sessionType','correct','total','accuracy','xp','score','maxCombo',
    'passed','passThreshold','passStatus','cefrLevel','aiDifficulty',
    'aiPrediction','hintUsed','weakWordsJson','itemTypeWeakJson',
    'levelWeakJson','responseTimeAvg','attempt','bossHp','bossMaxHp',
    'isBoss','playedAt','clientTs','source','pageUrl','userAgent',
    'schemaVersion','extraJson'
  ],
  eap_word_summary: [
    'serverTs','studentId','studentName','group','section','sessionId',
    'sessionTitle','sessionType','bestAccuracy','bestScore','passed',
    'attempts','lastAccuracy','lastScore','lastPlayed','updatedAt',
    'weakWordsJson','aiPrediction','extraJson'
  ]
};

function eapwqGroup_(value) {
  return text_(value, EAP_CONFIG.DEFAULT_SECTION) === EAP_CONFIG.DEFAULT_SECTION
    ? EAP_CONFIG.DEFAULT_SECTION
    : EAP_CONFIG.DEFAULT_SECTION;
}

function eapwqSheet_(name) {
  const ss = ss_();
  const expected = EAPWQ_H[name];
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, expected.length).setFontWeight('bold');
    sheet.autoResizeColumns(1, expected.length);
    return sheet;
  }

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(text_);

  const additions = expected.filter(function(header) {
    return headers.indexOf(header) === -1;
  });

  if (additions.length) {
    sheet
      .getRange(1, lastColumn + 1, 1, additions.length)
      .setValues([additions]);

    sheet.getRange(1, lastColumn + 1, 1, additions.length)
      .setFontWeight('bold');

    sheet.autoResizeColumns(lastColumn + 1, additions.length);
  }

  sheet.setFrozenRows(1);
  return sheet;
}

function eapwqHeaders_(name) {
  const sheet = eapwqSheet_(name);
  return sheet
    .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
    .getValues()[0]
    .map(text_)
    .filter(Boolean);
}

function setupEapWordQuest() {
  Object.keys(EAPWQ_H).forEach(eapwqSheet_);

  return {
    ok: true,
    spreadsheetId: ss_().getId(),
    sheets: Object.keys(EAPWQ_H),
    section: EAP_CONFIG.DEFAULT_SECTION
  };
}

function eapwqDefaultTotal_(sessionId) {
  if (sessionId === 'BG5') return 24;
  if (/^BG/.test(sessionId)) return 18;
  return 12;
}

function eapwqThreshold_(sessionId) {
  if (sessionId === 'BG5') return 75;
  if (/^BG[1-4]$/.test(sessionId)) return 70;
  return 60;
}

function eapwqArray_(value) {
  if (Array.isArray(value)) {
    return value.map(text_).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value.split(/[|,;]/).map(text_).filter(Boolean);
  }

  return [];
}

function eapwqNormalizeAttempt_(input, envelope) {
  input = input || {};
  envelope = envelope || {};

  const sessionId = text_(input.sessionId || input.session, 'S1').toUpperCase();
  const studentId = text_(input.studentId, 'anon');
  const studentName = text_(input.studentName, 'Anonymous');
  const correct = Math.max(0, Math.round(number_(input.correct, 0)));
  const total = Math.max(
    1,
    Math.round(number_(input.total || input.questions, eapwqDefaultTotal_(sessionId)))
  );
  const accuracy = Math.max(
    0,
    Math.min(100, Math.round(number_(input.accuracy, (correct / total) * 100)))
  );
  const passThreshold = Math.round(number_(input.passThreshold, eapwqThreshold_(sessionId)));
  const isBoss = bool_(input.isBoss) || /^BG/.test(sessionId);
  const bossHp = Math.max(0, Math.round(number_(input.bossHp, 0)));
  const bossMaxHp = Math.max(
    0,
    Math.round(number_(input.bossMaxHp, isBoss ? total : 0))
  );
  const explicitPass = input.passed !== undefined && input.passed !== null && input.passed !== '';
  const calculatedPass = accuracy >= passThreshold && (!isBoss || bossMaxHp === 0 || bossHp <= 0);
  const passed = explicitPass ? bool_(input.passed) : calculatedPass;
  const playedAt = text_(input.playedAt || input.endedAt || envelope.clientTs, now_().iso);
  const fingerprint = text_(
    input.fingerprint,
    [
      EAP_CONFIG.DEFAULT_SECTION,
      studentId,
      sessionId,
      correct,
      total,
      accuracy,
      playedAt.slice(0, 19)
    ].join('|')
  );

  return {
    serverTs: now_().iso,
    attemptId: text_(input.attemptId, id_('eapwq')),
    fingerprint: fingerprint,
    studentId: studentId,
    studentName: studentName,
    group: EAP_CONFIG.DEFAULT_SECTION,
    section: EAP_CONFIG.DEFAULT_SECTION,
    course: text_(input.course, 'EAP'),
    game: text_(input.game, 'EAP Word Quest'),
    arcId: text_(input.arcId, ''),
    arc: text_(input.arc, ''),
    sessionId: sessionId,
    sessionTitle: text_(input.sessionTitle, sessionId),
    sessionType: text_(
      input.sessionType,
      sessionId === 'BG5' ? 'finalBoss' : (isBoss ? 'boss' : 'session')
    ),
    correct: correct,
    total: total,
    accuracy: accuracy,
    xp: Math.max(0, Math.round(number_(input.xp, input.score))),
    score: Math.max(0, Math.round(number_(input.score, input.xp))),
    maxCombo: Math.max(0, Math.round(number_(input.maxCombo, 0))),
    passed: passed,
    passThreshold: passThreshold,
    passStatus: text_(input.passStatus, ''),
    cefrLevel: text_(input.cefrLevel, ''),
    aiDifficulty: text_(input.aiDifficulty, ''),
    aiPrediction: text_(input.aiPrediction, ''),
    hintUsed: Math.max(0, Math.round(number_(input.hintUsed, 0))),
    weakWords: eapwqArray_(input.weakWords),
    itemTypeWeak: eapwqArray_(input.itemTypeWeak),
    levelWeak: eapwqArray_(input.levelWeak),
    responseTimeAvg: Math.max(0, number_(input.responseTimeAvg, 0)),
    attempt: Math.max(1, Math.round(number_(input.attempt, 1))),
    bossHp: bossHp,
    bossMaxHp: bossMaxHp,
    isBoss: isBoss,
    playedAt: playedAt,
    clientTs: text_(envelope.clientTs || input.clientTs, playedAt),
    source: text_(input.source, 'student-core'),
    pageUrl: text_(envelope.pageUrl || input.pageUrl, ''),
    userAgent: text_(envelope.userAgent || input.userAgent, ''),
    schemaVersion: text_(envelope.schemaVersion || input.schemaVersion, 'v2.4.2'),
    extraJson: json_({ raw: input })
  };
}

function eapwqAttemptExists_(fingerprint) {
  const sheet = eapwqSheet_(EAPWQ.attempts);
  const headers = eapwqHeaders_(EAPWQ.attempts);
  const index = headers.indexOf('fingerprint');
  const lastRow = sheet.getLastRow();

  if (index < 0 || lastRow < 2) return false;

  const values = sheet.getRange(2, index + 1, lastRow - 1, 1).getValues();

  return values.some(function(row) {
    return text_(row[0]) === fingerprint;
  });
}

function eapwqUpsertProfile_(record) {
  const sheet = eapwqSheet_(EAPWQ.profiles);
  const headers = eapwqHeaders_(EAPWQ.profiles);
  const values = sheet.getDataRange().getValues();
  const studentIndex = headers.indexOf('studentId');
  const firstIndex = headers.indexOf('firstSeenAt');
  let foundRow = -1;

  for (let i = 1; i < values.length; i += 1) {
    if (text_(values[i][studentIndex]) === record.studentId) {
      foundRow = i + 1;
      break;
    }
  }

  const old = foundRow > 0 ? values[foundRow - 1] : [];
  const data = {
    serverTs: now_().iso,
    studentId: record.studentId,
    studentName: record.studentName,
    group: EAP_CONFIG.DEFAULT_SECTION,
    section: EAP_CONFIG.DEFAULT_SECTION,
    course: record.course,
    firstSeenAt: foundRow > 0 ? old[firstIndex] : record.serverTs,
    lastSeenAt: record.serverTs,
    userAgent: record.userAgent,
    sourceUrl: record.pageUrl,
    extraJson: json_({
      source: record.source,
      schemaVersion: record.schemaVersion
    })
  };
  const row = headers.map(function(key) {
    return data[key] === undefined ? '' : data[key];
  });

  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

function eapwqAppendAttempt_(record) {
  if (eapwqAttemptExists_(record.fingerprint)) return false;

  const sheet = eapwqSheet_(EAPWQ.attempts);
  const headers = eapwqHeaders_(EAPWQ.attempts);
  const data = {
    serverTs: record.serverTs,
    attemptId: record.attemptId,
    fingerprint: record.fingerprint,
    studentId: record.studentId,
    studentName: record.studentName,
    group: record.group,
    section: record.section,
    course: record.course,
    game: record.game,
    arcId: record.arcId,
    arc: record.arc,
    sessionId: record.sessionId,
    sessionTitle: record.sessionTitle,
    sessionType: record.sessionType,
    correct: record.correct,
    total: record.total,
    accuracy: record.accuracy,
    xp: record.xp,
    score: record.score,
    maxCombo: record.maxCombo,
    passed: String(record.passed),
    passThreshold: record.passThreshold,
    passStatus: record.passStatus,
    cefrLevel: record.cefrLevel,
    aiDifficulty: record.aiDifficulty,
    aiPrediction: record.aiPrediction,
    hintUsed: record.hintUsed,
    weakWordsJson: json_(record.weakWords),
    itemTypeWeakJson: json_(record.itemTypeWeak),
    levelWeakJson: json_(record.levelWeak),
    responseTimeAvg: record.responseTimeAvg,
    attempt: record.attempt,
    bossHp: record.bossHp,
    bossMaxHp: record.bossMaxHp,
    isBoss: String(record.isBoss),
    playedAt: record.playedAt,
    clientTs: record.clientTs,
    source: record.source,
    pageUrl: record.pageUrl,
    userAgent: record.userAgent,
    schemaVersion: record.schemaVersion,
    extraJson: record.extraJson
  };

  sheet.appendRow(headers.map(function(key) {
    return data[key] === undefined ? '' : data[key];
  }));

  return true;
}

function eapwqUpsertSummary_(record, appended) {
  const sheet = eapwqSheet_(EAPWQ.summary);
  const headers = eapwqHeaders_(EAPWQ.summary);
  const values = sheet.getDataRange().getValues();
  const studentIndex = headers.indexOf('studentId');
  const sessionIndex = headers.indexOf('sessionId');
  let foundRow = -1;

  for (let i = 1; i < values.length; i += 1) {
    if (
      text_(values[i][studentIndex]) === record.studentId &&
      text_(values[i][sessionIndex]) === record.sessionId
    ) {
      foundRow = i + 1;
      break;
    }
  }

  const old = foundRow > 0 ? values[foundRow - 1] : [];
  const getOld = function(key) {
    const index = headers.indexOf(key);
    return index >= 0 ? old[index] : '';
  };
  const oldBestAccuracy = number_(getOld('bestAccuracy'), 0);
  const oldBestScore = number_(getOld('bestScore'), 0);
  const oldAttempts = number_(getOld('attempts'), 0);
  const oldPassed = bool_(getOld('passed'));

  const data = {
    serverTs: now_().iso,
    studentId: record.studentId,
    studentName: record.studentName,
    group: EAP_CONFIG.DEFAULT_SECTION,
    section: EAP_CONFIG.DEFAULT_SECTION,
    sessionId: record.sessionId,
    sessionTitle: record.sessionTitle,
    sessionType: record.sessionType,
    bestAccuracy: Math.max(oldBestAccuracy, record.accuracy),
    bestScore: Math.max(oldBestScore, record.score),
    passed: String(oldPassed || record.passed),
    attempts: oldAttempts + (appended ? 1 : 0),
    lastAccuracy: record.accuracy,
    lastScore: record.score,
    lastPlayed: record.playedAt,
    updatedAt: now_().iso,
    weakWordsJson: json_(record.weakWords),
    aiPrediction: record.aiPrediction,
    extraJson: json_({
      passThreshold: record.passThreshold,
      source: record.source,
      schemaVersion: record.schemaVersion
    })
  };

  const row = headers.map(function(key) {
    return data[key] === undefined ? '' : data[key];
  });

  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return {
    studentId: record.studentId,
    sessionId: record.sessionId,
    passed: data.passed,
    bestAccuracy: data.bestAccuracy,
    attempts: data.attempts
  };
}

function eapwqHandlePost_(action, payload) {
  setupEapWordQuest();

  if (action === 'eap_word_attempt') {
    const record = eapwqNormalizeAttempt_(payload.record || payload, payload);
    eapwqUpsertProfile_(record);
    const appended = eapwqAppendAttempt_(record);
    const summary = eapwqUpsertSummary_(record, appended);

    return {
      ok: true,
      action: action,
      appended: appended,
      duplicate: !appended,
      summary: summary,
      version: 'v2.4.2',
      now: now_().iso
    };
  }

  if (action === 'eap_word_batch') {
    const records = Array.isArray(payload.records) ? payload.records : [];
    let appendedCount = 0;

    records.forEach(function(input) {
      const record = eapwqNormalizeAttempt_(input, payload);
      eapwqUpsertProfile_(record);
      const appended = eapwqAppendAttempt_(record);
      if (appended) appendedCount += 1;
      eapwqUpsertSummary_(record, appended);
    });

    return {
      ok: true,
      action: action,
      received: records.length,
      appended: appendedCount,
      version: 'v2.4.2',
      now: now_().iso
    };
  }

  return { ok: false, error: 'Unknown EAP Word Quest action: ' + action };
}

function eapwqJsonArray_(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function eapwqReadAttempts_(section) {
  const sheet = eapwqSheet_(EAPWQ.attempts);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) return [];

  const headers = values[0].map(text_);
  const index = function(key) { return headers.indexOf(key); };
  const get = function(row, key) {
    const i = index(key);
    return i >= 0 ? row[i] : '';
  };

  return values
    .slice(1)
    .map(function(row) {
      const currentSection = text_(
        get(row, 'section') || get(row, 'group'),
        EAP_CONFIG.DEFAULT_SECTION
      );

      if (currentSection !== section) return null;

      const studentId = text_(get(row, 'studentId'));
      const studentName = text_(get(row, 'studentName'));

      return {
        logVersion: text_(get(row, 'schemaVersion'), 'v2.4.2'),
        source: text_(get(row, 'source'), 'sheets'),
        group: EAP_CONFIG.DEFAULT_SECTION,
        section: EAP_CONFIG.DEFAULT_SECTION,
        studentId: studentId,
        studentName: studentName,
        studentKey: EAP_CONFIG.DEFAULT_SECTION + '|' + studentId + '|' + studentName,
        course: text_(get(row, 'course')),
        game: text_(get(row, 'game')),
        arcId: text_(get(row, 'arcId')),
        arc: text_(get(row, 'arc')),
        sessionId: text_(get(row, 'sessionId')),
        sessionTitle: text_(get(row, 'sessionTitle')),
        sessionType: text_(get(row, 'sessionType')),
        correct: number_(get(row, 'correct'), 0),
        total: number_(get(row, 'total'), 0),
        accuracy: number_(get(row, 'accuracy'), 0),
        xp: number_(get(row, 'xp'), 0),
        score: number_(get(row, 'score'), 0),
        maxCombo: number_(get(row, 'maxCombo'), 0),
        passed: bool_(get(row, 'passed')),
        passThreshold: number_(get(row, 'passThreshold'), 0),
        passStatus: text_(get(row, 'passStatus')),
        cefrLevel: text_(get(row, 'cefrLevel')),
        aiDifficulty: text_(get(row, 'aiDifficulty')),
        aiPrediction: text_(get(row, 'aiPrediction')),
        hintUsed: number_(get(row, 'hintUsed'), 0),
        weakWords: eapwqJsonArray_(get(row, 'weakWordsJson')),
        itemTypeWeak: eapwqJsonArray_(get(row, 'itemTypeWeakJson')),
        levelWeak: eapwqJsonArray_(get(row, 'levelWeakJson')),
        responseTimeAvg: number_(get(row, 'responseTimeAvg'), 0),
        attempt: number_(get(row, 'attempt'), 1),
        bossHp: number_(get(row, 'bossHp'), 0),
        bossMaxHp: number_(get(row, 'bossMaxHp'), 0),
        isBoss: bool_(get(row, 'isBoss')),
        playedAt: text_(get(row, 'playedAt')),
        clientTs: text_(get(row, 'clientTs'))
      };
    })
    .filter(Boolean);
}

function eapwqReadSummaries_(section) {
  const sheet = eapwqSheet_(EAPWQ.summary);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) return [];

  const headers = values[0].map(text_);
  const index = function(key) { return headers.indexOf(key); };
  const get = function(row, key) {
    const i = index(key);
    return i >= 0 ? row[i] : '';
  };

  return values
    .slice(1)
    .map(function(row) {
      const currentSection = text_(
        get(row, 'section') || get(row, 'group'),
        EAP_CONFIG.DEFAULT_SECTION
      );

      if (currentSection !== section) return null;

      return {
        studentId: text_(get(row, 'studentId')),
        studentName: text_(get(row, 'studentName')),
        group: EAP_CONFIG.DEFAULT_SECTION,
        section: EAP_CONFIG.DEFAULT_SECTION,
        sessionId: text_(get(row, 'sessionId')),
        sessionTitle: text_(get(row, 'sessionTitle')),
        sessionType: text_(get(row, 'sessionType')),
        bestAccuracy: number_(get(row, 'bestAccuracy'), 0),
        bestScore: number_(get(row, 'bestScore'), 0),
        passed: bool_(get(row, 'passed')),
        attempts: number_(get(row, 'attempts'), 0),
        lastAccuracy: number_(get(row, 'lastAccuracy'), 0),
        lastScore: number_(get(row, 'lastScore'), 0),
        lastPlayed: text_(get(row, 'lastPlayed')),
        updatedAt: text_(get(row, 'updatedAt')),
        weakWords: eapwqJsonArray_(get(row, 'weakWordsJson')),
        aiPrediction: text_(get(row, 'aiPrediction'))
      };
    })
    .filter(Boolean);
}

function eapwqHandleGet_(action, params) {
  setupEapWordQuest();
  const section = eapwqGroup_(params.section || params.group);

  if (action === 'eap_word_health') {
    return {
      ok: true,
      service: 'eap-word-quest',
      section: section,
      version: 'v2.4.2',
      now: now_().iso
    };
  }

  if (action === 'eap_word_setup') {
    return setupEapWordQuest();
  }

  if (action === 'eap_word_teacher') {
    const logs = eapwqReadAttempts_(section);
    const summaries = eapwqReadSummaries_(section);

    return {
      ok: true,
      action: action,
      group: section,
      generatedAt: now_().iso,
      logs: logs,
      summaries: summaries,
      server: {
        version: 'v2.4.2',
        attemptCount: logs.length,
        summaryCount: summaries.length
      }
    };
  }

  if (action === 'eap_word_summary') {
    return {
      ok: true,
      action: action,
      group: section,
      generatedAt: now_().iso,
      summaries: eapwqReadSummaries_(section)
    };
  }

  return { ok: false, error: 'Unknown EAP Word Quest action: ' + action };
}
