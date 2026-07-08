/* =========================================================
   EAP Hero Cloud Resume v132
   Apps Script companion file

   Purpose:
   - Implements eapPlayerResume_(p) for action=player_resume.
   - Student progress is resumed by studentId + section across Lab/Mobile/Home.
   - Reads eap-v132-events first, then common legacy tabs if present.
   - Returns normalized records for S1-S15 and B1-B5.

   Router requirement:
   In SharedWebAppRouter.gs doGet(e), route action 'player_resume'
   to eapPlayerResume_(e.parameter || {}).
========================================================= */

var EAP_CLOUD_RESUME_VERSION = 'v20260708-EAP-CLOUD-RESUME-V132';

var EAP_CLOUD_RESUME_SHEETS = [
  'eap-v132-events',
  'eap-v132-quality-audit',
  'attempts',
  'summary',
  'evidence',
  'EAP_Attempts',
  'EAP_Summary',
  'EAP_Evidence'
];

function eapPlayerResume_(p) {
  p = p || {};

  var studentId = eapCloudResumeText_(
    p.studentId || p.id || p.playerId || ''
  );

  var studentName = eapCloudResumeText_(
    p.studentName || p.name || ''
  );

  var section = eapCloudResumeText_(
    p.section || '122'
  ) || '122';

  if (!studentId) {
    return {
      ok: false,
      service: 'eap-cloud-resume',
      version: EAP_CLOUD_RESUME_VERSION,
      error: 'missing_studentId'
    };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var all = [];
  var scanned = [];

  EAP_CLOUD_RESUME_SHEETS.forEach(function (sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    scanned.push(sheetName);

    var rows = eapCloudResumeRowsFromSheet_(
      sheet,
      sheetName,
      studentId,
      section
    );

    all = all.concat(rows);
  });

  var records = eapCloudResumeDeduplicate_(all);

  return {
    ok: true,
    service: 'eap-cloud-resume',
    version: EAP_CLOUD_RESUME_VERSION,
    studentId: studentId,
    studentName: studentName,
    section: section,
    recordCount: records.length,
    records: records,
    scannedSheets: scanned,
    latestActivity: records.length
      ? records[records.length - 1].updatedAt
      : '',
    generatedAt: new Date().toISOString(),
    serverRevision: Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone() || 'Asia/Bangkok',
      "yyyyMMdd'T'HHmmss"
    )
  };
}

function eapCloudResumeRowsFromSheet_(
  sheet,
  sheetName,
  studentId,
  section
) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2 || lastCol < 1) {
    return [];
  }

  var values = sheet
    .getRange(1, 1, lastRow, lastCol)
    .getValues();

  var headers = values[0].map(function (v) {
    return eapCloudResumeText_(v);
  });

  var out = [];

  for (var r = 1; r < values.length; r++) {
    var obj = eapCloudResumeObject_(headers, values[r]);

    var sid = eapCloudResumeText_(
      eapCloudResumePick_(obj, [
        'studentId',
        'student_id',
        'playerId',
        'id'
      ])
    );

    if (sid && sid !== studentId) {
      continue;
    }

    if (!sid && studentId) {
      continue;
    }

    var sec = eapCloudResumeText_(
      eapCloudResumePick_(obj, [
        'section',
        'classGroup',
        'class',
        'group'
      ])
    );

    if (sec && section && sec !== section) {
      continue;
    }

    var record = eapCloudResumeNormalizeRecord_(
      obj,
      sheetName,
      studentId,
      section
    );

    if (
      record &&
      record.sessionId &&
      record.skill &&
      !record.legacyCompletion
    ) {
      out.push(record);
    }
  }

  return out;
}

function eapCloudResumeNormalizeRecord_(
  obj,
  sheetName,
  studentId,
  section
) {
  obj = obj || {};

  var routeId = eapCloudResumeRouteId_(
    eapCloudResumePick_(obj, [
      'routeId',
      'sessionId',
      'session',
      'missionId',
      'stage'
    ])
  );

  var skill = eapCloudResumeSkill_(
    eapCloudResumePick_(obj, [
      'skill',
      'skillName',
      'skillKey',
      'focusSkill'
    ])
  );

  var score = eapCloudResumeNumber_(
    eapCloudResumePick_(obj, [
      'bestScore',
      'latestScore',
      'score',
      'teacherScore'
    ]),
    0
  );

  var accuracy = eapCloudResumeNumber_(
    eapCloudResumePick_(obj, [
      'bestAccuracy',
      'accuracy',
      'accuracyPct',
      'accPct'
    ]),
    ''
  );

  var passedRaw = eapCloudResumePick_(obj, [
    'passed',
    'pass',
    'mastered',
    'verifiedPassed'
  ]);

  var passed = eapCloudResumeBool_(passedRaw) ||
    score >= 60;

  var legacy = eapCloudResumeBool_(
    eapCloudResumePick_(obj, [
      'legacyCompletion',
      'legacy',
      'isLegacy'
    ])
  );

  var updatedAt = eapCloudResumeText_(
    eapCloudResumePick_(obj, [
      'updatedAt',
      'latestAt',
      'receivedAt',
      'completedAt',
      'clientTimestamp',
      'occurredAt'
    ])
  ) || new Date().toISOString();

  return {
    studentId: studentId,
    section: section,
    routeId: routeId,
    sessionId: routeId,
    sessionTitle: eapCloudResumeText_(
      eapCloudResumePick_(obj, [
        'routeTitle',
        'sessionTitle',
        'missionTitle'
      ])
    ),
    skill: skill,
    score: score,
    bestScore: score,
    latestScore: score,
    accuracy: accuracy,
    bestAccuracy: accuracy,
    passed: passed,
    updatedAt: updatedAt,
    latestAt: updatedAt,
    restoredFromSheet: true,
    cloudVerified: true,
    serverVerified: true,
    resumeSource: 'server_summary',
    sourceSheet: sheetName,
    attemptId: eapCloudResumeText_(obj.attemptId || ''),
    evidenceId: eapCloudResumeText_(obj.evidenceId || ''),
    teacherReviewRequired: eapCloudResumeBool_(obj.teacherReviewRequired),
    teacherReviewStatus: eapCloudResumeText_(obj.teacherReviewStatus || ''),
    legacyCompletion: legacy
  };
}

function eapCloudResumeDeduplicate_(rows) {
  var best = {};

  rows.forEach(function (row) {
    var key = row.sessionId + '|' +
      eapCloudResumeSkill_(row.skill).toLowerCase();

    if (!best[key]) {
      best[key] = row;
      return;
    }

    var current = best[key];

    if (
      Number(row.bestScore || row.score || 0) >
      Number(current.bestScore || current.score || 0)
    ) {
      best[key] = row;
      return;
    }

    if (
      String(row.updatedAt || '') >
      String(current.updatedAt || '')
    ) {
      best[key] = row;
    }
  });

  return Object.keys(best)
    .map(function (key) {
      return best[key];
    })
    .sort(function (a, b) {
      return String(a.sessionId).localeCompare(
        String(b.sessionId),
        undefined,
        { numeric: true }
      ) || String(a.skill).localeCompare(String(b.skill));
    });
}

function eapCloudResumeObject_(headers, row) {
  var obj = {};

  headers.forEach(function (header, index) {
    if (header) {
      obj[header] = row[index];
    }
  });

  return obj;
}

function eapCloudResumePick_(obj, keys) {
  for (var i = 0; i < keys.length; i++) {
    if (
      obj[keys[i]] !== undefined &&
      obj[keys[i]] !== null &&
      String(obj[keys[i]]).trim() !== ''
    ) {
      return obj[keys[i]];
    }
  }

  return '';
}

function eapCloudResumeRouteId_(value) {
  var raw = eapCloudResumeText_(value).toUpperCase();

  if (!raw) return '';

  if (/^\d+$/.test(raw)) {
    return 'S' + Number(raw);
  }

  if (/^S(?:ESSION)?\s*\d+$/i.test(raw)) {
    return 'S' + (raw.match(/\d+/) || [''])[0];
  }

  if (/^B(?:OSS)?\s*\d+$/i.test(raw)) {
    return 'B' + (raw.match(/\d+/) || [''])[0];
  }

  return raw;
}

function eapCloudResumeSkill_(value) {
  var s = eapCloudResumeText_(value).toLowerCase();

  if (!s) return '';

  return s.charAt(0).toUpperCase() + s.slice(1);
}

function eapCloudResumeText_(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim();
}

function eapCloudResumeNumber_(value, fallback) {
  var n = Number(value);

  return Number.isFinite(n)
    ? n
    : fallback;
}

function eapCloudResumeBool_(value) {
  if (value === true) return true;
  if (value === false) return false;

  var text = String(value || '').toLowerCase();

  return ['true', '1', 'yes', 'y', 'pass', 'passed']
    .indexOf(text) >= 0;
}
