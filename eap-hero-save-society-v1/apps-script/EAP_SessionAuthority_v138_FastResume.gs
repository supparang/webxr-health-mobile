/* =========================================================
   EAP Session Authority v144
   CANONICAL EVIDENCE UNION + TWO-SKILL SESSION PROGRESSION
   VERSION: 20260812-EAP-SESSION-AUTHORITY-V144-CANONICAL-EVIDENCE-UNION

   PURPOSE
   - Google Sheet remains the sole authority.
   - Read the same canonical evidence sources as Cloud Resume.
   - Preserve best/passed evidence per Route + Skill.
   - Normal S1-S15 use the agreed required-skill pairs.
   - Boss B1-B5 require all four skills.
   - Boss Speaking keeps teacher-review policy from Cloud Resume.
   - S5 progression is Reading + Speaking.
   - No doGet()/doPost() in this file.
========================================================= */

var EAP_SESSION_AUTHORITY_V138 =
  '20260812-EAP-SESSION-AUTHORITY-V144-CANONICAL-EVIDENCE-UNION';

var EAP_SESSION_V138_CACHE_SEC = 15;

var EAP_SESSION_V144_SHEETS = [
  'eap-v132-events',
  'attempts',
  'evidence',
  'summary',
  'events',
  'EAP_Attempts',
  'EAP_Evidence',
  'EAP_Summary',
  'eap-v132-quality-audit'
];

var EAP_SESSION_V138_LEGACY_TEST_ALIASES = {
  '122|50': '6811000000'
};

var EAP_SESSION_V138_ORDER = [
  'S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3',
  'S10','S11','S12','B4','S13','S14','S15','B5'
];

var EAP_SESSION_V138_REQUIRED = {
  S1:['Reading','Speaking'],
  S2:['Reading','Writing'],
  S3:['Reading','Writing'],
  B1:['Reading','Listening','Writing','Speaking'],
  S4:['Reading','Listening'],
  S5:['Reading','Speaking'],
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

function eapV144Text_(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
}

function eapV144Num_(v) {
  var n = Number(v);
  return isFinite(n) ? n : 0;
}

function eapV144Route_(v) {
  var raw = eapV144Text_(v).toUpperCase();
  var m;
  if (/^\d+$/.test(raw)) return 'S' + Number(raw);
  m = raw.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/i);
  if (m) return 'S' + Number(m[1]);
  m = raw.match(/^(?:B|BOSS|GATE|BOSS\s*GATE)\s*0?([1-5])$/i);
  if (m) return 'B' + Number(m[1]);
  return raw;
}

function eapV144Skill_(v) {
  var raw = eapV144Text_(v).toLowerCase().replace(/[^a-z]/g, '');
  if (raw === 'reading' || raw === 'read') return 'Reading';
  if (raw === 'listening' || raw === 'listen') return 'Listening';
  if (raw === 'writing' || raw === 'write') return 'Writing';
  if (raw === 'speaking' || raw === 'speak') return 'Speaking';
  return '';
}

function eapV144Spreadsheet_() {
  if (typeof eapCloudResumeSpreadsheet_ === 'function') {
    return eapCloudResumeSpreadsheet_();
  }
  if (typeof eapSessionSpreadsheetV137_ === 'function') {
    return eapSessionSpreadsheetV137_();
  }
  if (typeof eapSheetV132Spreadsheet_ === 'function') {
    return eapSheetV132Spreadsheet_();
  }
  if (typeof ss_ === 'function') return ss_();

  var id = '';
  try {
    id = PropertiesService.getScriptProperties()
      .getProperty('EAP_SPREADSHEET_ID') || '';
  } catch (_) {}
  if (!id) throw new Error('EAP_SPREADSHEET_ID is not configured');
  return SpreadsheetApp.openById(id);
}

function eapV144CloneRecord_(r, requestedStudentId, sourceStudentId) {
  var out = {};
  Object.keys(r || {}).forEach(function(k) { out[k] = r[k]; });
  out.studentId = requestedStudentId;
  out.sourceStudentId = sourceStudentId;
  out.routeId = eapV144Route_(out.routeId || out.sessionId);
  out.sessionId = out.routeId;
  out.skill = eapV144Skill_(out.skill);
  out.score = eapV144Num_(out.bestScore || out.score);
  out.bestScore = out.score;
  out.latestScore = out.score;
  out.passed = out.passed === true;
  out.restoredFromSheet = true;
  out.cloudVerified = true;
  out.serverVerified = true;
  out.resumeSource = 'canonical_evidence_union';
  return out;
}

function eapV144Dedup_(rows) {
  var best = {};

  (rows || []).forEach(function(r) {
    var route = eapV144Route_(r.routeId || r.sessionId);
    var skill = eapV144Skill_(r.skill);
    if (EAP_SESSION_V138_ORDER.indexOf(route) < 0 || !skill) return;

    r.routeId = route;
    r.sessionId = route;
    r.skill = skill;

    var key = route + '|' + skill;
    var cur = best[key];
    if (!cur) {
      best[key] = r;
      return;
    }

    if (r.passed === true && cur.passed !== true) {
      best[key] = r;
      return;
    }
    if (r.passed !== true && cur.passed === true) return;

    var score = eapV144Num_(r.bestScore || r.score);
    var curScore = eapV144Num_(cur.bestScore || cur.score);
    if (score > curScore) {
      best[key] = r;
      return;
    }
    if (score < curScore) return;

    if (String(r.updatedAt || r.latestAt || '') >
        String(cur.updatedAt || cur.latestAt || '')) {
      best[key] = r;
    }
  });

  return Object.keys(best).map(function(k) { return best[k]; }).sort(function(a, b) {
    var ar = EAP_SESSION_V138_ORDER.indexOf(a.sessionId);
    var br = EAP_SESSION_V138_ORDER.indexOf(b.sessionId);
    if (ar !== br) return ar - br;
    return String(a.skill).localeCompare(String(b.skill));
  });
}

function eapV144ReadCanonical_(sourceStudentId, section, requestedStudentId) {
  var ss = eapV144Spreadsheet_();
  var all = [];
  var scanned = [];
  var sources = [];
  var ignored = 0;

  EAP_SESSION_V144_SHEETS.forEach(function(sheetName) {
    var sh = ss.getSheetByName(sheetName);
    if (!sh) return;
    scanned.push(sheetName);

    if (typeof eapCloudResumeRowsFromSheet_ !== 'function') {
      throw new Error(
        'EAP_CloudResume_v132.gs is required for canonical evidence parsing'
      );
    }

    var result = eapCloudResumeRowsFromSheet_(
      sh,
      sheetName,
      sourceStudentId,
      section
    ) || {rows:[], ignored:0};

    var rows = result.rows || [];
    ignored += Number(result.ignored || 0);

    if (rows.length) {
      sources.push(sheetName);
      rows.forEach(function(r) {
        all.push(eapV144CloneRecord_(r, requestedStudentId, sourceStudentId));
      });
    }
  });

  var merged = eapV144Dedup_(all);
  merged._scannedSheets = scanned;
  merged._sourceSheets = sources;
  merged._ignored = ignored;
  return merged;
}

function eapV144BuildProgress_(records) {
  var byKey = {};
  (records || []).forEach(function(r) {
    byKey[r.sessionId + '|' + r.skill] = r;
  });

  var routeProgress = {};
  var passedRoutes = [];
  var currentRoute = '';
  var latestActivity = '';

  EAP_SESSION_V138_ORDER.forEach(function(routeId) {
    var required = (EAP_SESSION_V138_REQUIRED[routeId] || []).slice();
    var skills = {};
    var passedCount = 0;

    required.forEach(function(skill) {
      var r = byKey[routeId + '|' + skill] || null;
      skills[skill] = r || {
        routeId: routeId,
        sessionId: routeId,
        skill: skill,
        passed: false,
        score: 0,
        teacherReviewStatus: ''
      };
      if (r && r.passed === true) passedCount++;
      if (r && String(r.updatedAt || '') > latestActivity) {
        latestActivity = r.updatedAt;
      }
    });

    var complete = required.length > 0 && passedCount === required.length;
    routeProgress[routeId] = {
      routeId: routeId,
      routeType: /^B/.test(routeId) ? 'boss_gate' : 'normal_session',
      requiredSkills: required,
      requiredSkillCount: required.length,
      passedSkillCount: passedCount,
      skills: skills,
      completed: complete,
      passed: complete
    };

    if (!currentRoute && complete) {
      passedRoutes.push(routeId);
    } else if (!currentRoute) {
      currentRoute = routeId;
    }
  });

  var courseCompleted = !currentRoute;
  if (courseCompleted) currentRoute = 'B5';

  var unlockedRouteList = passedRoutes.slice();
  if (unlockedRouteList.indexOf(currentRoute) < 0) {
    unlockedRouteList.push(currentRoute);
  }

  var unlockedRoutes = {};
  var unlockedSessions = {};
  unlockedRouteList.forEach(function(routeId) {
    unlockedRoutes[routeId] = true;
    var m = routeId.match(/^S(\d+)$/);
    if (m) unlockedSessions[String(Number(m[1]))] = true;
  });

  return {
    routeProgress: routeProgress,
    passedRoutes: passedRoutes,
    currentRoute: currentRoute,
    courseCompleted: courseCompleted,
    unlockedRouteList: unlockedRouteList,
    unlockedRoutes: unlockedRoutes,
    unlockedSessions: unlockedSessions,
    latestActivity: latestActivity
  };
}

function eapPlayerResumeV138_(params) {
  params = params || {};
  var started = Date.now();

  var studentId = eapV144Text_(
    params.studentId || params.id || params.playerId
  );
  var studentName = eapV144Text_(
    params.studentName || params.name || ''
  );
  var section = eapV144Text_(params.section || '122') || '122';

  if (!studentId) {
    return {
      ok:false,
      service:'eap-session-authority',
      version:EAP_SESSION_AUTHORITY_V138,
      error:'missing_studentId'
    };
  }

  var cache = CacheService.getScriptCache();
  var cacheKey = 'EAP_V144_RESUME|' + section + '|' + studentId;

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
  var records = eapV144ReadCanonical_(studentId, section, studentId);
  var usedLegacyTestAlias = false;

  var aliasKey = section + '|' + studentId;
  var legacySource = EAP_SESSION_V138_LEGACY_TEST_ALIASES[aliasKey] || '';

  if (!records.length && legacySource) {
    records = eapV144ReadCanonical_(legacySource, section, studentId);
    if (records.length) {
      sourceStudentId = legacySource;
      usedLegacyTestAlias = true;
    }
  }

  var scannedSheets = (records._scannedSheets || []).slice();
  var sourceSheets = (records._sourceSheets || []).slice();
  var ignoredInvalidRows = Number(records._ignored || 0);
  var progress = eapV144BuildProgress_(records);

  if (!studentName && records.length) {
    studentName = records[0].studentName || '';
  }

  var response = {
    ok:true,
    service:'eap-session-authority',
    version:EAP_SESSION_AUTHORITY_V138,
    authorityMode:'sheet-only-canonical-evidence-union',
    progressPolicy:'normal-required-pairs-boss-four-skills',
    studentId:studentId,
    requestedStudentId:studentId,
    sourceStudentId:sourceStudentId,
    usedLegacyTestAlias:usedLegacyTestAlias,
    studentName:studentName || 'Student',
    section:section,
    records:records,
    recordCount:records.length,
    scannedSheets:scannedSheets,
    sourceSheets:sourceSheets,
    ignoredInvalidRows:ignoredInvalidRows,
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
    elapsedMs:Date.now() - started
  };

  try {
    cache.put(cacheKey, JSON.stringify(response), EAP_SESSION_V138_CACHE_SEC);
  } catch (_) {}

  return response;
}

function EAP_testPlayerResumeV138() {
  var result = eapPlayerResumeV138_({
    studentId:'50',
    section:'122',
    force:'1'
  });
  Logger.log(JSON.stringify(result));
  return result;
}
