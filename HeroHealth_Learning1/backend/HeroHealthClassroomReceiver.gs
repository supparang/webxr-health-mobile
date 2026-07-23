/**
 * HeroHealth Classroom Receiver + Live Teacher Dashboard API
 * Version: 2026-07-23-PRODUCTION-V3-SHEET-AUTHORITY
 *
 * Google Sheet is the authoritative source for official progress.
 *
 * Deploy:
 * 1) Open the Google Sheet used by HeroHealth.
 * 2) Extensions > Apps Script.
 * 3) Replace HeroHealthClassroomReceiver.gs with this whole file.
 * 4) Save and run HH_setupSheets() once.
 * 5) Deploy > Manage deployments > Edit > New version > Deploy.
 * 6) Execute as: Me / Who has access: Anyone.
 */

const HH_VERSION = '2026-07-23-PRODUCTION-V3-SHEET-AUTHORITY';

const HH_SHEETS = {
  profiles: 'HH_Profiles',
  assessments: 'HH_Assessments',
  assessmentItems: 'HH_Assessment_Items',
  games: 'HH_Game_Results',
  reflections: 'HH_Reflections',
  progress: 'HH_Progress',
  live: 'HH_Live_Status',
  events: 'HH_Events',
  errors: 'HH_Errors'
};

const HH_GAME_CATALOG = {
  hygiene: ['handwash', 'toothbrush'],
  nutrition: ['groups', 'goodjunk'],
  fitness: ['jumpduck', 'balance-hold']
};

const HH_HEADERS = {};
HH_HEADERS[HH_SHEETS.profiles] = [
  'studentId','fullName','section','group','active',
  'firstSeen','lastSeen','platformVersion'
];
HH_HEADERS[HH_SHEETS.assessments] = [
  'serverTs','eventId','studentId','fullName','section','group',
  'assessment','form','score','total','percent','clientTs','payloadJson'
];
HH_HEADERS[HH_SHEETS.assessmentItems] = [
  'serverTs','eventId','studentId','assessment','questionId',
  'selectedOptionIndex','correct','clientTs'
];
HH_HEADERS[HH_SHEETS.games] = [
  'serverTs','eventId','studentId','fullName','section','group',
  'zone','gameId','score','accuracy','passed','completed',
  'finishedAt','payloadJson'
];
HH_HEADERS[HH_SHEETS.reflections] = [
  'serverTs','eventId','studentId','fullName','section','group',
  'understand','best','action','submittedAt','payloadJson'
];
HH_HEADERS[HH_SHEETS.progress] = [
  'serverTs','eventId','studentId','fullName','section','group',
  'progressPct','completedCount','totalSteps','nextStep',
  'missionComplete','clientTs','payloadJson'
];
HH_HEADERS[HH_SHEETS.live] = [
  'studentId','fullName','section','group','currentStep','status',
  'progressPct','completedCount','missionComplete','online',
  'lastSeen','lastEventType','lastEventId'
];
HH_HEADERS[HH_SHEETS.events] = [
  'serverTs','eventId','eventType','studentId','clientTs','payloadJson'
];
HH_HEADERS[HH_SHEETS.errors] = [
  'serverTs','eventId','studentId','message','stack','clientTs','payloadJson'
];

function HH_setupSheets() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(HH_HEADERS).forEach(function(name) {
    ensureSheet_(ss, name, HH_HEADERS[name]);
  });
  return {ok:true, version:HH_VERSION};
}

function doGet(e) {
  const action = text_(e && e.parameter && e.parameter.action || 'ping');

  if (action === 'live') {
    return output_(buildLivePayload_(e), e);
  }

  if (action === 'student') {
    return output_(buildStudentPayload_(e), e);
  }

  return output_({
    ok: true,
    service: 'HeroHealth Classroom Receiver',
    version: HH_VERSION,
    authority: 'google_sheet',
    ts: new Date().toISOString()
  }, e);
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(15000);

    const payload = parsePayload_(e);
    if (!payload || !payload.eventId || !payload.eventType || !payload.studentId) {
      return json_({ok:false, error:'missing_required_fields'});
    }

    payload.studentId = cleanStudentId_(payload.studentId);
    if (!payload.studentId) {
      return json_({ok:false, error:'invalid_studentId'});
    }

    const ss = SpreadsheetApp.getActive();
    HH_setupSheets();

    if (payload.eventType !== 'heartbeat' && isDuplicate_(ss, payload.eventId)) {
      return json_({ok:true, duplicate:true, eventId:payload.eventId});
    }

    route_(ss, payload);
    updateLive_(ss, payload);

    if (payload.eventType !== 'heartbeat') {
      append_(ss, HH_SHEETS.events, [
        new Date(),
        payload.eventId,
        payload.eventType,
        payload.studentId,
        payload.clientTs || '',
        JSON.stringify(payload)
      ]);
    }

    return json_({
      ok: true,
      eventId: payload.eventId,
      version: HH_VERSION,
      authority: 'google_sheet'
    });

  } catch (err) {
    try {
      append_(SpreadsheetApp.getActive(), HH_SHEETS.errors, [
        new Date(),
        '',
        '',
        String(err && err.message || err),
        String(err && err.stack || ''),
        '',
        ''
      ]);
    } catch (_) {}

    return json_({ok:false, error:String(err && err.message || err)});

  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function route_(ss, p) {
  const profile = p.profile || {};
  const common = [
    p.eventId,
    p.studentId,
    profile.fullName || p.fullName || '',
    profile.section || p.section || '',
    profile.group || p.group || ''
  ];

  if (p.eventType === 'profile') {
    upsertProfile_(ss, p);
    return;
  }

  if (p.eventType === 'assessment') {
    const a = p.assessment || {};
    const total = number_(a.total);
    const score = number_(a.score);

    append_(ss, HH_SHEETS.assessments, [new Date()].concat(common, [
      text_(a.type),
      text_(a.form),
      score,
      total,
      total > 0 ? Math.round(score * 10000 / total) / 100 : 0,
      p.clientTs || '',
      JSON.stringify(p)
    ]));

    (Array.isArray(a.responses) ? a.responses : []).forEach(function(r) {
      append_(ss, HH_SHEETS.assessmentItems, [
        new Date(),
        p.eventId,
        p.studentId,
        text_(a.type),
        text_(r.questionId),
        r.selectedOptionIndex == null ? '' : r.selectedOptionIndex,
        r.correct === true,
        p.clientTs || ''
      ]);
    });
    return;
  }

  if (p.eventType === 'game') {
    const g = p.game || {};

    append_(ss, HH_SHEETS.games, [new Date()].concat(common, [
      text_(g.zone),
      text_(g.gameId),
      number_(g.score),
      number_(g.accuracy),
      g.passed === true,
      g.completed === true,
      g.finishedAt || p.clientTs || '',
      JSON.stringify(p)
    ]));
    return;
  }

  if (p.eventType === 'reflection') {
    const r = p.reflection || {};

    append_(ss, HH_SHEETS.reflections, [new Date()].concat(common, [
      number_(r.understand),
      r.best || '',
      r.action || '',
      r.submittedAt || p.clientTs || '',
      JSON.stringify(p)
    ]));
    return;
  }

  if (p.eventType === 'progress') {
    const x = p.progress || {};

    append_(ss, HH_SHEETS.progress, [new Date()].concat(common, [
      number_(x.progressPct),
      number_(x.completedCount),
      number_(x.totalSteps) || 9,
      text_(x.nextStep),
      x.missionComplete === true,
      p.clientTs || '',
      JSON.stringify(p)
    ]));
    return;
  }

  if (p.eventType === 'error') {
    append_(ss, HH_SHEETS.errors, [
      new Date(),
      p.eventId,
      p.studentId,
      p.message || '',
      p.stack || '',
      p.clientTs || '',
      JSON.stringify(p)
    ]);
  }
}

function upsertProfile_(ss, p) {
  const sh = ensureSheet_(ss, HH_SHEETS.profiles, HH_HEADERS[HH_SHEETS.profiles]);
  const profile = p.profile || {};
  const sid = cleanStudentId_(p.studentId);
  const row = findRow_(sh, 1, sid);
  const now = new Date();

  const values = [
    sid,
    profile.fullName || '',
    profile.section || '',
    profile.group || '',
    true,
    row ? sh.getRange(row, 6).getValue() || now : now,
    now,
    p.platformVersion || ''
  ];

  if (row) {
    sh.getRange(row, 1, 1, values.length).setValues([values]);
  } else {
    sh.appendRow(values);
  }
}

function updateLive_(ss, p) {
  const sh = ensureSheet_(ss, HH_SHEETS.live, HH_HEADERS[HH_SHEETS.live]);
  const sid = cleanStudentId_(p.studentId);
  const row = findRow_(sh, 1, sid);
  const profile = p.profile || {};
  let existing = {};

  if (row) {
    const values = sh.getRange(row, 1, 1, HH_HEADERS[HH_SHEETS.live].length).getValues()[0];
    HH_HEADERS[HH_SHEETS.live].forEach(function(header, index) {
      existing[header] = values[index];
    });
  }

  const x = p.progress || {};
  const currentStep = p.currentStep || x.nextStep || existing.currentStep || 'pretest';
  const status = p.status || (
    p.eventType === 'heartbeat' ? 'กำลังใช้งาน' :
    p.eventType === 'game' ? 'จบเกม' :
    p.eventType === 'assessment' ? 'ส่งแบบทดสอบ' :
    p.eventType === 'reflection' ? 'ส่ง Reflection' :
    p.eventType === 'profile' ? 'เข้าสู่ระบบ' :
    'อัปเดต'
  );

  const pct = p.progressPct != null
    ? number_(p.progressPct)
    : x.progressPct != null
      ? number_(x.progressPct)
      : number_(existing.progressPct);

  const count = p.completedCount != null
    ? number_(p.completedCount)
    : x.completedCount != null
      ? number_(x.completedCount)
      : number_(existing.completedCount);

  const complete = p.missionComplete === true ||
    x.missionComplete === true ||
    bool_(existing.missionComplete);

  const values = [
    sid,
    profile.fullName || existing.fullName || '',
    profile.section || existing.section || '',
    profile.group || existing.group || '',
    currentStep,
    status,
    pct,
    count,
    complete,
    true,
    new Date(),
    p.eventType,
    p.eventId
  ];

  if (row) {
    sh.getRange(row, 1, 1, values.length).setValues([values]);
  } else {
    sh.appendRow(values);
  }
}

function buildLivePayload_(e) {
  const ss = SpreadsheetApp.getActive();
  HH_setupSheets();

  const rows = sheetObjects_(ss.getSheetByName(HH_SHEETS.live));
  const section = text_(e && e.parameter && e.parameter.section);
  const group = text_(e && e.parameter && e.parameter.group);
  const now = Date.now();

  const students = rows
    .filter(function(r) {
      return (!section || String(r.section) === section) &&
             (!group || String(r.group) === group);
    })
    .map(function(r) {
      const time = dateMs_(r.lastSeen);
      return Object.assign({}, r, {
        online: Number.isFinite(time) && (now - time) <= 120000,
        lastSeen: iso_(r.lastSeen)
      });
    });

  const groups = {};

  students.forEach(function(student) {
    const groupId = String(student.group || '-');
    if (!groups[groupId]) {
      groups[groupId] = {
        group: groupId,
        total: 0,
        online: 0,
        complete: 0,
        pretest: 0,
        playing: 0,
        posttest: 0,
        reflection: 0
      };
    }

    const item = groups[groupId];
    item.total++;
    if (student.online) item.online++;
    if (bool_(student.missionComplete)) item.complete++;

    const step = String(student.currentStep || '');
    if (step !== 'pretest') item.pretest++;
    if (step.indexOf(':') > 0) item.playing++;
    if (step === 'reflection' || step === 'certificate') item.posttest++;
    if (step === 'certificate') item.reflection++;
  });

  return {
    ok: true,
    version: HH_VERSION,
    authority: 'google_sheet',
    generatedAt: new Date().toISOString(),
    staleAfterSec: 120,
    summary: Object.keys(groups).sort().map(function(key) { return groups[key]; }),
    students: students
  };
}

/**
 * Authoritative student resume API.
 *
 * GET ?action=student&studentId=990010
 *
 * Official completion is rebuilt from these tabs only:
 * - HH_Assessments
 * - HH_Game_Results
 * - HH_Reflections
 * - HH_Progress
 *
 * Browser localStorage is never accepted as official evidence here.
 */
function buildStudentPayload_(e) {
  const sid = cleanStudentId_(e && e.parameter && e.parameter.studentId);
  if (!sid) return {ok:false, error:'missing_studentId'};

  const ss = SpreadsheetApp.getActive();
  HH_setupSheets();

  const profileRows = rowsForStudent_(ss.getSheetByName(HH_SHEETS.profiles), sid);
  const assessmentRows = rowsForStudent_(ss.getSheetByName(HH_SHEETS.assessments), sid);
  const gameRows = rowsForStudent_(ss.getSheetByName(HH_SHEETS.games), sid);
  const reflectionRows = rowsForStudent_(ss.getSheetByName(HH_SHEETS.reflections), sid);
  const progressRows = rowsForStudent_(ss.getSheetByName(HH_SHEETS.progress), sid);
  const liveRows = rowsForStudent_(ss.getSheetByName(HH_SHEETS.live), sid);

  const profile = latestBy_(profileRows, 'lastSeen') || null;
  const live = latestBy_(liveRows, 'lastSeen') || null;
  const latestProgress = latestBy_(progressRows, 'serverTs') || null;

  const latestPretest = latestMatching_(assessmentRows, function(row) {
    return normalizeAssessment_(row.assessment) === 'pretest';
  });

  const latestPosttest = latestMatching_(assessmentRows, function(row) {
    return normalizeAssessment_(row.assessment) === 'posttest';
  });

  const completed = {
    pretest: !!latestPretest,
    hygiene: false,
    nutrition: false,
    fitness: false,
    posttest: !!latestPosttest,
    reflection: reflectionRows.length > 0
  };

  const gameCompleted = {
    hygiene: {},
    nutrition: {},
    fitness: {}
  };

  const gameScores = {};
  const gameResults = {};

  Object.keys(HH_GAME_CATALOG).forEach(function(zone) {
    HH_GAME_CATALOG[zone].forEach(function(gameId) {
      const rows = gameRows.filter(function(row) {
        return normalizeZone_(row.zone) === zone &&
               normalizeGameId_(row.gameId) === gameId;
      });

      const latest = latestBy_(rows, 'serverTs');
      const officialCompleted = rows.some(function(row) {
        return bool_(row.completed);
      });

      gameCompleted[zone][gameId] = officialCompleted;

      if (latest) {
        const key = zone + ':' + gameId;
        gameScores[key] = number_(latest.score);
        gameResults[key] = {
          zone: zone,
          gameId: gameId,
          score: number_(latest.score),
          accuracy: number_(latest.accuracy),
          passed: bool_(latest.passed),
          completed: officialCompleted,
          finishedAt: iso_(latest.finishedAt || latest.serverTs),
          eventId: text_(latest.eventId)
        };
      }
    });

    completed[zone] = HH_GAME_CATALOG[zone].every(function(gameId) {
      return gameCompleted[zone][gameId] === true;
    });
  });

  const evidenceCount =
    (completed.pretest ? 1 : 0) +
    Object.keys(HH_GAME_CATALOG).reduce(function(total, zone) {
      return total + HH_GAME_CATALOG[zone].filter(function(gameId) {
        return gameCompleted[zone][gameId] === true;
      }).length;
    }, 0) +
    (completed.posttest ? 1 : 0) +
    (completed.reflection ? 1 : 0);

  const totalSteps = 9;
  const missionComplete = evidenceCount === totalSteps;

  const nextStep = authoritativeNextStep_(completed, gameCompleted, profile, live, latestProgress);

  const scores = {};
  if (latestPretest) scores.pretest = number_(latestPretest.score);
  if (latestPosttest) scores.posttest = number_(latestPosttest.score);

  const reflection = latestBy_(reflectionRows, 'serverTs');

  const authoritativeState = {
    profile: profile ? {
      studentId: sid,
      fullName: text_(profile.fullName),
      section: text_(profile.section),
      group: text_(profile.group)
    } : null,
    group: text_(profile && profile.group || live && live.group),
    completed: completed,
    scores: scores,
    gameCompleted: gameCompleted,
    gameScores: gameScores,
    gameResults: gameResults,
    reflection: reflection ? {
      understand: number_(reflection.understand),
      best: text_(reflection.best),
      action: text_(reflection.action),
      submittedAt: iso_(reflection.submittedAt || reflection.serverTs)
    } : null,
    progress: {
      progressPct: Math.round(evidenceCount * 100 / totalSteps),
      completedCount: evidenceCount,
      totalSteps: totalSteps,
      nextStep: nextStep,
      missionComplete: missionComplete
    }
  };

  return {
    ok: true,
    version: HH_VERSION,
    authority: 'google_sheet',
    studentId: sid,
    found: !!(
      profile || assessmentRows.length || gameRows.length ||
      reflectionRows.length || progressRows.length || live
    ),
    profile: authoritativeState.profile,
    live: live ? normalizeLive_(live) : null,
    completed: completed,
    scores: scores,
    gameCompleted: gameCompleted,
    gameScores: gameScores,
    gameResults: gameResults,
    reflection: authoritativeState.reflection,
    progress: authoritativeState.progress,
    authoritativeState: authoritativeState,
    evidence: {
      assessments: assessmentRows.length,
      games: gameRows.length,
      reflections: reflectionRows.length,
      progressRows: progressRows.length,
      pretestEventId: latestPretest ? text_(latestPretest.eventId) : '',
      posttestEventId: latestPosttest ? text_(latestPosttest.eventId) : ''
    },
    generatedAt: new Date().toISOString()
  };
}

function authoritativeNextStep_(completed, gameCompleted, profile, live, latestProgress) {
  if (!completed.pretest) return 'pretest';

  const preferred = [];
  const group = text_(profile && profile.group || live && live.group).toUpperCase();

  // The browser rotation engine remains responsible for A-J route ordering.
  // Here we return a safe authoritative step using the latest Sheet progress
  // only when that step is still unfinished.
  const sheetNext = text_(latestProgress && latestProgress.nextStep || live && live.currentStep);
  if (sheetNext && !isStepCompleted_(sheetNext, completed, gameCompleted)) {
    return sheetNext;
  }

  Object.keys(HH_GAME_CATALOG).forEach(function(zone) {
    HH_GAME_CATALOG[zone].forEach(function(gameId) {
      preferred.push(zone + ':' + gameId);
    });
  });

  for (let i = 0; i < preferred.length; i++) {
    if (!isStepCompleted_(preferred[i], completed, gameCompleted)) return preferred[i];
  }

  if (!completed.posttest) return 'posttest';
  if (!completed.reflection) return 'reflection';
  return 'certificate';
}

function isStepCompleted_(step, completed, gameCompleted) {
  const value = text_(step);
  if (!value) return false;

  if (value === 'pretest' || value === 'posttest' || value === 'reflection') {
    return completed[value] === true;
  }

  if (value === 'certificate') {
    return completed.pretest && completed.posttest && completed.reflection &&
      completed.hygiene && completed.nutrition && completed.fitness;
  }

  const parts = value.split(':');
  if (parts.length !== 2) return false;

  const zone = normalizeZone_(parts[0]);
  const gameId = normalizeGameId_(parts[1]);
  return !!(gameCompleted[zone] && gameCompleted[zone][gameId] === true);
}

function normalizeLive_(row) {
  return {
    studentId: cleanStudentId_(row.studentId),
    fullName: text_(row.fullName),
    section: text_(row.section),
    group: text_(row.group),
    currentStep: text_(row.currentStep),
    status: text_(row.status),
    progressPct: number_(row.progressPct),
    completedCount: number_(row.completedCount),
    missionComplete: bool_(row.missionComplete),
    online: bool_(row.online),
    lastSeen: iso_(row.lastSeen),
    lastEventType: text_(row.lastEventType),
    lastEventId: text_(row.lastEventId)
  };
}

function latestMatching_(rows, predicate) {
  return latestBy_(rows.filter(predicate), 'serverTs');
}

function latestBy_(rows, field) {
  if (!rows || !rows.length) return null;

  return rows.slice().sort(function(a, b) {
    return dateMs_(b[field]) - dateMs_(a[field]);
  })[0] || null;
}

function rowsForStudent_(sheet, studentId) {
  return sheetObjects_(sheet).filter(function(row) {
    return cleanStudentId_(row.studentId) === studentId;
  });
}

function normalizeAssessment_(value) {
  const v = text_(value).toLowerCase().replace(/[\s_-]+/g, '');
  if (v === 'pre' || v === 'pretest') return 'pretest';
  if (v === 'post' || v === 'posttest') return 'posttest';
  return v;
}

function normalizeZone_(value) {
  const v = text_(value).toLowerCase().replace(/[\s_]+/g, '-');
  if (v.indexOf('hyg') === 0) return 'hygiene';
  if (v.indexOf('nut') === 0) return 'nutrition';
  if (v.indexOf('fit') === 0) return 'fitness';
  return v;
}

function normalizeGameId_(value) {
  const v = text_(value).toLowerCase().replace(/[\s_]+/g, '-');
  if (v === 'hand-wash' || v === 'handwashing') return 'handwash';
  if (v === 'tooth-brush' || v === 'toothbrushing') return 'toothbrush';
  if (v === 'food-groups' || v === 'foodgroups') return 'groups';
  if (v === 'good-junk' || v === 'goodjunk-ar') return 'goodjunk';
  if (v === 'jump-duck' || v === 'jumpduck-ar') return 'jumpduck';
  if (v === 'balancehold' || v === 'balance-hold-ar') return 'balance-hold';
  return v;
}

function isDuplicate_(ss, eventId) {
  const sh = ss.getSheetByName(HH_SHEETS.events);
  if (!sh || sh.getLastRow() < 2) return false;

  return !!sh
    .getRange(2, 2, sh.getLastRow() - 1, 1)
    .createTextFinder(String(eventId))
    .matchEntireCell(true)
    .findNext();
}

function parsePayload_(e) {
  if (!e) return null;

  if (e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); } catch (_) {}
  }

  if (e.parameter && e.parameter.payload) {
    try { return JSON.parse(e.parameter.payload); } catch (_) {}
  }

  return e.parameter || null;
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  } else {
    const current = sh.getRange(1, 1, 1, headers.length).getValues()[0].map(String);
    const expected = headers.map(String);
    const mismatch = expected.some(function(header, index) {
      return current[index] !== header;
    });

    if (mismatch && sh.getLastRow() === 1) {
      sh.getRange(1, 1, 1, headers.length).clearContent().setValues([headers]);
    }
  }

  return sh;
}

function append_(ss, name, row) {
  ensureSheet_(ss, name, HH_HEADERS[name] || row.map(function(_, i) {
    return 'col' + (i + 1);
  })).appendRow(row);
}

function findRow_(sh, col, value) {
  if (!sh || sh.getLastRow() < 2) return 0;

  const found = sh
    .getRange(2, col, sh.getLastRow() - 1, 1)
    .createTextFinder(String(value))
    .matchEntireCell(true)
    .findNext();

  return found ? found.getRow() : 0;
}

function sheetObjects_(sh) {
  if (!sh || sh.getLastRow() < 2) return [];

  const values = sh.getDataRange().getValues();
  const headers = values.shift().map(String);

  return values
    .filter(function(row) {
      return row.some(function(value) { return value !== ''; });
    })
    .map(function(row) {
      const object = {};
      headers.forEach(function(header, index) {
        object[header] = row[index];
      });
      return object;
    });
}

function cleanStudentId_(value) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, '');
}

function text_(value) {
  return String(value == null ? '' : value).trim();
}

function number_(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function bool_(value) {
  return value === true ||
    value === 1 ||
    String(value).toUpperCase() === 'TRUE' ||
    String(value) === '1';
}

function dateMs_(value) {
  if (value instanceof Date) return value.getTime();
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function iso_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : String(value);
}

function output_(object, e) {
  const callback = String(
    e && e.parameter && e.parameter.callback || ''
  ).replace(/[^a-zA-Z0-9_.$]/g, '');

  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(object) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return json_(object);
}

function json_(object) {
  return ContentService
    .createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);
}
