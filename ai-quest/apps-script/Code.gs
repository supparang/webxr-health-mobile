/**
 * CSAI2102 AI Quest Logger
 * Google Apps Script Web App
 * Version: v3.0.0
 *
 * รองรับ:
 * - v1.6 legacy payload: profile / attempt / event / batch
 * - v2.3 payload: action='sync_v23', kind='profile|attempt|event|progress'
 * - GET test: action=health / setup / summary / testWrite
 * - Teacher Console: action=teacherConsole with optional callback=JSONP
 */

const APP_VERSION = 'v3.0.0';;
const TZ = 'Asia/Bangkok';

const COURSE_ID_LOCK = 'CSAI2102';
const TERM_LOCK = '1/2569';
const SECTION_LOCK = '101';
const CLASS_ID_LOCK = 'CSAI2102-2569-101';

const SHEETS = {
  profiles: 'students_profile',
  attempts: 'session_attempts',
  events: 'session_events',
  summary: 'teacher_summary',
  progress: 'mission_progress'
};

const HEADERS = {
  students_profile: [
    'serverTs','studentId','studentName','section','nickname','email','createdAt','updatedAt','userAgent','lastSeenAt','extraJson'
  ],
  session_attempts: [
    'serverTs','attemptId','studentId','studentName','section','sessionId','missionId','missionTitle','difficulty',
    'score','stars','mastered','usedTimeSec','timeLeftSec','accuracy','correct','total','wrong','maxCombo',
    'helpUsed','trickCorrect','trickTotal','explainCorrect','explainTotal','bossWin','misconceptionsJson',
    'wrongItemsJson','reflection1','reflection2','reflection3','clientTs','userAgent','pageUrl','version','extraJson'
  ],
  session_events: [
    'serverTs','eventId','attemptId','studentId','section','sessionId','missionId','eventType','phase','itemId',
    'prompt','yourAnswer','correctAnswer','isCorrect','scoreDelta','combo','helpLeft','clientTs','userAgent','pageUrl','extraJson'
  ],
  teacher_summary: [
    'serverTs','section','sessionId','missionId','totalStudents','totalAttempts','avgScore','avgAccuracy',
    'masteryCount','mostCommonMisconception','avgHelpUsed','updatedAt','extraJson'
  ],
  mission_progress: [
    'serverTs','progressId','studentId','studentName','section','courseId','classId','term','sessionId','missionId',
    'status','stars','bestScore','unlocked','updatedAt','extraJson'
  ]
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = p.action || p.api || 'health';
  const callback = p.callback || '';

  if (action === 'health') {
    return jsonOutMaybe_({ok:true, service:'CSAI2102_AIQuest_Logger', version:APP_VERSION, serverTs:bangkokIsoNow()}, callback);
  }

  if (action === 'setup') {
    setupSheets();
    return jsonOutMaybe_({ok:true, action:'setup', version:APP_VERSION, serverTs:bangkokIsoNow()}, callback);
  }

  if (action === 'summary') {
    setupSheets();
    updateTeacherSummary();
    return jsonOutMaybe_({ok:true, action:'summary', version:APP_VERSION, serverTs:bangkokIsoNow()}, callback);
  }

  if (action === 'testWrite') {
    setupSheets();
    return jsonOutMaybe_(testWrite_(), callback);
  }

  if (action === 'teacherConsole') {
    setupSheets();
    return jsonOutMaybe_(buildTeacherConsole_(p), callback);
  }

  return jsonOutMaybe_({ok:true, action:action, message:'GET endpoint ready', version:APP_VERSION, serverTs:bangkokIsoNow()}, callback);
}

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    const type = payload.type || payload.eventType || payload.api || '';
    setupSheets();

    if (payload.action === 'sync_v23') {
      return jsonOut(aiquest_v23_sync_(payload.kind, payload.payload || {}));
    }

    if (type === 'profile') {
      upsertProfile_(payload.profile || payload);
      return jsonOut({ok:true,type:'profile',version:APP_VERSION,serverTs:bangkokIsoNow()});
    }

    if (type === 'attempt' || type === 'session_end') {
      appendAttempt_(payload.attempt || payload);
      safeAppendEvents_(payload.events || []);
      updateTeacherSummary();
      return jsonOut({ok:true,type:'attempt',version:APP_VERSION,events:Array.isArray(payload.events)?payload.events.length:0,serverTs:bangkokIsoNow()});
    }

    if (type === 'event') {
      appendEvent_(payload.event || payload);
      return jsonOut({ok:true,type:'event',version:APP_VERSION,serverTs:bangkokIsoNow()});
    }

    if (type === 'batch') {
      const profiles = payload.profiles || [];
      const attempts = payload.attempts || [];
      const events = payload.events || [];
      profiles.forEach(function(p){ upsertProfile_(p); });
      attempts.forEach(function(a){ appendAttempt_(a); });
      safeAppendEvents_(events);
      updateTeacherSummary();
      return jsonOut({ok:true,type:'batch',profiles:profiles.length,attempts:attempts.length,events:events.length,version:APP_VERSION,serverTs:bangkokIsoNow()});
    }

    return jsonOut({ok:false,error:'Unknown type/action',receivedType:type,action:payload.action||'',kind:payload.kind||'',version:APP_VERSION,serverTs:bangkokIsoNow()});
  } catch (err) {
    return jsonOut({ok:false,error:String(err&&err.message||err),stack:String(err&&err.stack||''),version:APP_VERSION,serverTs:bangkokIsoNow()});
  }
}

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HEADERS).forEach(function(sheetName) {
    const headers = HEADERS[sheetName];
    let sh = ss.getSheetByName(sheetName);
    if (!sh) sh = ss.insertSheet(sheetName);
    const lastColumn = Math.max(headers.length, sh.getLastColumn() || headers.length);
    const existing = sh.getRange(1, 1, 1, lastColumn).getValues()[0];
    if (existing.slice(0, headers.length).join('|') !== headers.join('|')) {
      sh.clear();
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
      sh.autoResizeColumns(1, headers.length);
    }
  });
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  const text = e.postData.contents;
  const ct = (e.postData.type || '').toLowerCase();
  if (ct.indexOf('application/json') >= 0 || looksLikeJson_(text)) return JSON.parse(text);
  const params = e.parameter || {};
  if (params.payload) return JSON.parse(params.payload);
  return params;
}

function looksLikeJson_(text) {
  const t = String(text || '').trim();
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'));
}

function aiquest_v23_sync_(kind, payload) {
  payload = payload || {};

  if (kind === 'profile') {
    upsertProfile_({
      studentId: payload.studentId,
      studentName: payload.studentName,
      section: payload.section,
      nickname: payload.nickname || '',
      email: payload.email || '',
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
      userAgent: payload.userAgent || '',
      extraJson: {schemaVersion: payload.schemaVersion || '', profileId: payload.profileId || '', courseId: payload.courseId || '', classId: payload.classId || '', term: payload.term || '', teacherId: payload.teacherId || '', consent: payload.consent === true, raw: payload}
    });
    return {ok:true, action:'sync_v23', kind:'profile', version:APP_VERSION, serverTs:bangkokIsoNow()};
  }

  if (kind === 'attempt') {
    appendAttempt_({
      attemptId: payload.attemptId,
      studentId: payload.studentId,
      studentName: payload.studentName,
      section: payload.section,
      sessionId: payload.sessionId,
      missionId: payload.missionId,
      missionTitle: payload.missionTitle || '',
      difficulty: payload.difficulty || payload.runMode || '',
      score: payload.score,
      stars: payload.stars,
      mastered: payload.gateStatus === 'mastered',
      usedTimeSec: payload.usedTimeSec || 0,
      timeLeftSec: payload.timeLeftSec || 0,
      accuracy: payload.accuracy,
      correct: payload.correct || 0,
      total: payload.total || 0,
      wrong: payload.wrong || 0,
      maxCombo: payload.maxCombo || 0,
      helpUsed: payload.helpUsed,
      trickCorrect: payload.trickCorrect,
      trickTotal: payload.trickTotal || 0,
      explainCorrect: payload.explainCorrect,
      explainTotal: payload.explainTotal || 0,
      bossWin: payload.bossWin,
      misconceptions: payload.misconceptions || {},
      wrongItems: payload.wrongItems || [],
      reflection1: payload.reflection1,
      reflection2: payload.reflection2,
      reflection3: payload.reflection3,
      clientTs: payload.clientTs,
      userAgent: payload.userAgent,
      pageUrl: payload.pageUrl,
      version: payload.schemaVersion || APP_VERSION,
      extraJson: {schemaVersion: payload.schemaVersion || '', courseId: payload.courseId || '', classId: payload.classId || '', term: payload.term || '', teacherId: payload.teacherId || '', runMode: payload.runMode || '', submitStatus: payload.submitStatus || '', gateStatus: payload.gateStatus || '', gatePath: payload.gatePath || '', bestAttemptPolicy: payload.bestAttemptPolicy || '', isPractice: payload.isPractice === true, isGraded: payload.isGraded === true, raw: payload}
    });
    updateTeacherSummary();
    return {ok:true, action:'sync_v23', kind:'attempt', version:APP_VERSION, serverTs:bangkokIsoNow()};
  }

  if (kind === 'event') {
    appendEvent_({
      eventId: payload.eventId,
      attemptId: payload.attemptId,
      studentId: payload.studentId,
      section: payload.section,
      sessionId: payload.sessionId,
      missionId: payload.missionId,
      eventType: payload.eventType,
      phase: payload.phase,
      itemId: payload.itemId,
      prompt: payload.prompt,
      yourAnswer: payload.yourAnswer,
      correctAnswer: payload.correctAnswer,
      isCorrect: payload.isCorrect,
      scoreDelta: payload.scoreDelta,
      combo: payload.combo,
      helpLeft: payload.helpLeft,
      clientTs: payload.clientTs,
      userAgent: payload.userAgent,
      pageUrl: payload.pageUrl,
      extraJson: {schemaVersion: payload.schemaVersion || '', courseId: payload.courseId || '', classId: payload.classId || '', term: payload.term || '', runMode: payload.runMode || '', confidence: payload.confidence || '', misconception: payload.misconception || '', helpType: payload.helpType || '', raw: payload}
    });
    return {ok:true, action:'sync_v23', kind:'event', version:APP_VERSION, serverTs:bangkokIsoNow()};
  }

  if (kind === 'progress') {
    appendProgress_(payload);
    return {ok:true, action:'sync_v23', kind:'progress', version:APP_VERSION, serverTs:bangkokIsoNow()};
  }

  return {ok:false, action:'sync_v23', error:'Unknown kind', kind:kind, version:APP_VERSION, serverTs:bangkokIsoNow()};
}

function upsertProfile_(profile) {
  const sh = getSheet_(SHEETS.profiles);
  const headers = HEADERS.students_profile;
  const studentId = clean_(profile.studentId || profile.id || '');
  if (!studentId) throw new Error('studentId is required');
  const values = sh.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][headers.indexOf('studentId')]) === studentId) { rowIndex = i + 1; break; }
  }
  const now = bangkokIsoNow();
  const row = [now, studentId, clean_(profile.studentName || profile.name || ''), forceSection_(profile.section), clean_(profile.nickname || ''), clean_(profile.email || ''), clean_(profile.createdAt || now), clean_(profile.updatedAt || now), clean_(profile.userAgent || ''), now, stringify_(profile.extra || profile.extraJson || {})];
  if (rowIndex > 0) sh.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
}

function appendAttempt_(a) {
  const sh = getSheet_(SHEETS.attempts);
  const now = bangkokIsoNow();
  sh.appendRow([now, clean_(a.attemptId || makeId_('att')), clean_(a.studentId || ''), clean_(a.studentName || ''), forceSection_(a.section), clean_(a.sessionId || 's1'), clean_(a.missionId || 'm1'), clean_(a.missionTitle || 'AI Awakening'), clean_(a.difficulty || ''), num_(a.score), num_(a.stars), bool_(a.mastered), num_(a.usedTimeSec), num_(a.timeLeftSec), num_(a.accuracy), num_(a.correct), num_(a.total), num_(a.wrong), num_(a.maxCombo), num_(a.helpUsed), num_(a.trickCorrect), num_(a.trickTotal), num_(a.explainCorrect), num_(a.explainTotal), bool_(a.bossWin), stringify_(a.misconceptions || a.misconceptionsJson || {}), stringify_(a.wrongItems || a.wrongItemsJson || []), clean_(a.reflection1 || ''), clean_(a.reflection2 || ''), clean_(a.reflection3 || ''), clean_(a.clientTs || ''), clean_(a.userAgent || ''), clean_(a.pageUrl || ''), clean_(a.version || APP_VERSION), stringify_(a.extra || a.extraJson || {})]);
}

function appendEvent_(e) {
  const sh = getSheet_(SHEETS.events);
  const now = bangkokIsoNow();
  sh.appendRow([now, clean_(e.eventId || makeId_('evt')), clean_(e.attemptId || ''), clean_(e.studentId || ''), forceSection_(e.section), clean_(e.sessionId || 's1'), clean_(e.missionId || 'm1'), clean_(e.eventType || ''), clean_(e.phase || ''), clean_(e.itemId || ''), clean_(e.prompt || ''), clean_(e.yourAnswer || ''), clean_(e.correctAnswer || ''), boolOrBlank_(e.isCorrect), num_(e.scoreDelta), num_(e.combo), num_(e.helpLeft), clean_(e.clientTs || ''), clean_(e.userAgent || ''), clean_(e.pageUrl || ''), stringify_(e.extra || e.extraJson || {})]);
}

function appendProgress_(p) {
  const sh = getSheet_(SHEETS.progress);
  const now = bangkokIsoNow();
  sh.appendRow([now, clean_(p.progressId || makeId_('prog')), clean_(p.studentId || ''), clean_(p.studentName || ''), forceSection_(p.section), COURSE_ID_LOCK, CLASS_ID_LOCK, TERM_LOCK, clean_(p.sessionId || 's1'), clean_(p.missionId || 'm1'), clean_(p.status || ''), num_(p.stars), num_(p.bestScore), bool_(p.unlocked), clean_(p.updatedAt || now), stringify_(p.extra || p.extraJson || p)]);
}

function safeAppendEvents_(events) {
  if (!Array.isArray(events)) return;
  events.slice(0, 300).forEach(function(evt){ appendEvent_(evt); });
}

function updateTeacherSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aSh = ss.getSheetByName(SHEETS.attempts);
  const sSh = ss.getSheetByName(SHEETS.summary);
  if (!aSh || !sSh) return;
  const data = aSh.getDataRange().getValues();
  if (data.length <= 1) return;
  const h = HEADERS.session_attempts;
  const idx = function(n){ return h.indexOf(n); };
  const groups = {};
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const section = String(r[idx('section')] || 'UNKNOWN');
    const sessionId = String(r[idx('sessionId')] || 's1');
    const missionId = String(r[idx('missionId')] || 'm1');
    const key = [section, sessionId, missionId].join('|');
    if (!groups[key]) groups[key] = {section:section, sessionId:sessionId, missionId:missionId, students:{}, attempts:0, scoreSum:0, accSum:0, helpSum:0, masteryCount:0, mis:{}};
    const g = groups[key];
    const sid = String(r[idx('studentId')] || '');
    if (sid) g.students[sid] = true;
    g.attempts++;
    g.scoreSum += Number(r[idx('score')] || 0);
    g.accSum += Number(r[idx('accuracy')] || 0);
    g.helpSum += Number(r[idx('helpUsed')] || 0);
    if (String(r[idx('mastered')]).toUpperCase() === 'TRUE') g.masteryCount++;
    try {
      const mis = JSON.parse(r[idx('misconceptionsJson')] || '{}');
      Object.keys(mis).forEach(function(k){ g.mis[k] = (g.mis[k] || 0) + Number(mis[k] || 0); });
    } catch (e) {}
  }
  sSh.clear();
  sSh.getRange(1, 1, 1, HEADERS.teacher_summary.length).setValues([HEADERS.teacher_summary]);
  sSh.setFrozenRows(1);
  const now = bangkokIsoNow();
  const rows = Object.values(groups).map(function(g){
    return [now, g.section, g.sessionId, g.missionId, Object.keys(g.students).length, g.attempts, round2_(g.scoreSum / Math.max(1, g.attempts)), round2_(g.accSum / Math.max(1, g.attempts)), g.masteryCount, mostCommon_(g.mis), round2_(g.helpSum / Math.max(1, g.attempts)), now, stringify_({misconceptions:g.mis})];
  });
  if (rows.length) {
    sSh.getRange(2, 1, rows.length, HEADERS.teacher_summary.length).setValues(rows);
    sSh.autoResizeColumns(1, HEADERS.teacher_summary.length);
  }
}

function buildTeacherConsole_(params) {
  params = params || {};
  const sectionFilter = SECTION_LOCK;
  const sessionFilter = String(params.sessionId || 'all').trim();
  const isAllSessions = !sessionFilter || sessionFilter === 'all' || sessionFilter === '*';
  const includeTest = String(params.includeTest || params.showTest || '') === '1';

  const rawProfiles = sheetObjects_(SHEETS.profiles);
  const rawAttemptsAll = sheetObjects_(SHEETS.attempts);
  const rawEventsAll = sheetObjects_(SHEETS.events);

  const profiles = includeTest ? rawProfiles : rawProfiles.filter(function(p) {
    return !isTestStudent_(p.studentId, p.studentName);
  });

  const attemptsAll = includeTest ? rawAttemptsAll : rawAttemptsAll.filter(function(a) {
    return !isTestStudent_(a.studentId, a.studentName);
  });

  const eventsAll = includeTest ? rawEventsAll : rawEventsAll.filter(function(e) {
    return !isTestStudent_(e.studentId, '');
  });

  const ignoredTestRows =
    (rawProfiles.length - profiles.length) +
    (rawAttemptsAll.length - attemptsAll.length) +
    (rawEventsAll.length - eventsAll.length);
  const filteredProfiles = profiles.filter(function(p){ return !sectionFilter || String(p.section || '') === sectionFilter; });
  const attempts = attemptsAll.filter(function(a){ return (!sectionFilter || String(a.section || '') === sectionFilter) && (isAllSessions || String(a.sessionId || '') === sessionFilter); });
  const events = eventsAll.filter(function(e){ return (!sectionFilter || String(e.section || '') === sectionFilter) && (isAllSessions || String(e.sessionId || '') === sessionFilter); });
  const studentMap = {};
  filteredProfiles.forEach(function(p){
    const sid = String(p.studentId || '').trim();
    if (!sid) return;
    studentMap[sid] = {studentId:sid, studentName:String(p.studentName || ''), section:String(p.section || ''), profile:true, attempts:[], bestScore:0, latestScore:0, helpUsed:0, reflectionComplete:false, mastered:false, risks:[]};
  });
  attempts.forEach(function(a){
    const sid = String(a.studentId || '').trim() || 'UNKNOWN';
    if (!studentMap[sid]) studentMap[sid] = {studentId:sid, studentName:String(a.studentName || ''), section:String(a.section || ''), profile:false, attempts:[], bestScore:0, latestScore:0, helpUsed:0, reflectionComplete:false, mastered:false, risks:[]};
    const s = studentMap[sid];
    const score = Number(a.score || 0);
    const help = Number(a.helpUsed || 0);
    const refl = reflectionComplete_(a);
    s.attempts.push(a);
    s.studentName = s.studentName || String(a.studentName || '');
    s.section = s.section || String(a.section || '');
    s.bestScore = Math.max(Number(s.bestScore || 0), score);
    s.latestScore = score;
    s.helpUsed = help;
    s.reflectionComplete = s.reflectionComplete || refl;
    s.mastered = s.mastered || bool_(a.mastered) || String(a.gateStatus || '').toLowerCase() === 'mastered';
  });
  const students = Object.values(studentMap);
  students.forEach(function(s){
    const latestAttempt = s.attempts.length ? s.attempts[s.attempts.length - 1] : {};
    const sEvents = events.filter(function(e){ return String(e.studentId || '') === String(s.studentId || ''); });
    const sMis = collectMisconceptions_(s.attempts || [], sEvents || []);
    const topMis = sMis && sMis.length ? sMis[0] : null;

    if (!s.attempts.length) s.risks.push('ยังไม่ส่ง');
    if (s.attempts.length && Number(s.bestScore || 0) < 60) s.risks.push('คะแนนดีที่สุดต่ำ');
    if (s.attempts.length && Number(s.latestScore || 0) < 70) s.risks.push('คะแนนล่าสุดควรทบทวน');
    if (Number(s.helpUsed || 0) >= 3) s.risks.push('ใช้ Help สูง');
    if (s.attempts.length && !s.reflectionComplete) s.risks.push('Reflection ไม่ครบ');
    if (s.attempts.length && reflectionShort_(latestAttempt)) s.risks.push('Reflection สั้น');
    if (topMis && Number(topMis.count || 0) >= 10) s.risks.push('Misconception: ' + String(topMis.key || ''));
    if (!s.profile) s.risks.push('ไม่มี Profile');
  });
  const submitted = students.filter(function(s){ return s.attempts.length > 0; });
  const bestScoreSum = submitted.reduce(function(sum,s){ return sum + Number(s.bestScore || 0); }, 0);
  const latestScoreSum = submitted.reduce(function(sum,s){ return sum + Number(s.latestScore || 0); }, 0);
  const avgBestScore = round2_(bestScoreSum / Math.max(1, submitted.length));
  const avgLatestScore = round2_(latestScoreSum / Math.max(1, submitted.length));
  const masteryCount = students.filter(function(s){ return s.mastered; }).length;
  const reflectionComplete = submitted.filter(function(s){ return s.reflectionComplete; }).length;
  const needSupport = students.filter(function(s){ return s.risks && s.risks.length > 0; }).length;
  const misconceptions = collectMisconceptions_(attempts, events);
  const phaseAnalytics = collectPhaseAnalytics_(events);
  const notSubmittedStudents = Math.max(0, students.length - submitted.length);
  const stats = {totalStudents:students.length, submittedStudents:submitted.length, notSubmittedStudents:Math.max(0, notSubmittedStudents || 0), totalAttempts:attempts.length, avgScore:avgLatestScore, avgLatestScore:avgLatestScore, avgBestScore:avgBestScore, masteryCount:masteryCount, needSupport:needSupport, reflectionComplete:reflectionComplete, profileRows:profiles.length, attemptRows:attemptsAll.length, eventRows:eventsAll.length, ignoredTestRows:ignoredTestRows, includeTestData:includeTest, failedSync:0};
  const risks = students.filter(function(s){ return s.risks && s.risks.length > 0; }).sort(function(a,b){ return Number(a.bestScore || 0) - Number(b.bestScore || 0); }).map(function(s){ return {studentId:s.studentId, studentName:s.studentName, section:s.section, bestScore:s.bestScore || '', latestScore:s.latestScore || '', helpUsed:s.helpUsed || 0, reflectionComplete:!!s.reflectionComplete, risks:s.risks || []}; });

  const allStudents = students.sort(function(a,b){ return String(a.studentId || '').localeCompare(String(b.studentId || '')); }).map(function(s){
    const latest = s.attempts.length ? s.attempts[s.attempts.length - 1] : {};
    const sEvents = events.filter(function(e){ return String(e.studentId || '') === String(s.studentId || ''); }).slice(-30).reverse();
    return {
      studentId:s.studentId,
      studentName:s.studentName,
      section:s.section,
      profile:!!s.profile,
      attemptCount:s.attempts.length,
      bestScore:s.bestScore || '',
      latestScore:s.latestScore || '',
      helpUsed:s.helpUsed || 0,
      reflectionComplete:!!s.reflectionComplete,
      mastered:!!s.mastered,
      risks:s.risks || [],
      latestReflection:{reflection1:String(latest.reflection1 || ''), reflection2:String(latest.reflection2 || ''), reflection3:String(latest.reflection3 || '')},
      misconceptions:collectMisconceptions_(s.attempts || [], sEvents || []),
      attempts:(s.attempts || []).map(function(a){ return {
        attemptId:String(a.attemptId || ''),
        serverTs:String(a.serverTs || ''),
        clientTs:String(a.clientTs || ''),
        difficulty:String(a.difficulty || ''),
        score:Number(a.score || 0),
        stars:Number(a.stars || 0),
        accuracy:Number(a.accuracy || 0),
        correct:Number(a.correct || 0),
        total:Number(a.total || 0),
        wrong:Number(a.wrong || 0),
        helpUsed:Number(a.helpUsed || 0),
        mastered:bool_(a.mastered),
        bossWin:bool_(a.bossWin),
        reflection1:String(a.reflection1 || ''),
        reflection2:String(a.reflection2 || ''),
        reflection3:String(a.reflection3 || '')
      }; }),
      recentEvents:sEvents.map(function(e){ return {
        serverTs:String(e.serverTs || ''),
        eventType:String(e.eventType || ''),
        phase:String(e.phase || ''),
        itemId:String(e.itemId || ''),
        prompt:String(e.prompt || '').slice(0, 700),
        yourAnswer:String(e.yourAnswer || ''),
        correctAnswer:String(e.correctAnswer || ''),
        isCorrect:String(e.isCorrect || ''),
        scoreDelta:Number(e.scoreDelta || 0),
        combo:Number(e.combo || 0),
        helpLeft:Number(e.helpLeft || 0)
      }; })
    };
  });

  const masteryGate = buildMasteryGate_(filteredProfiles, attemptsAll.filter(function(a){ return (!sectionFilter || String(a.section || '') === sectionFilter); }), eventsAll.filter(function(e){ return (!sectionFilter || String(e.section || '') === sectionFilter); }));

  return {ok:true, action:'teacherConsole', source:'Google Sheets', version:APP_VERSION, serverTs:bangkokIsoNow(), filters:{section:sectionFilter, sessionId:sessionFilter}, data:{stats:stats, risks:risks, allStudents:allStudents, misconceptions:misconceptions, phaseAnalytics:phaseAnalytics, masteryGate:masteryGate, students:students.length}};
}


function buildMasteryGate_(profiles, attempts, events) {
  profiles = profiles || [];
  attempts = attempts || [];
  events = events || [];

  const required = [
    {sessionId:'s1', missionId:'m1', label:'S1 AI Awakening'},
    {sessionId:'s2', missionId:'m2', label:'S2 Agent Builder'},
    {sessionId:'b1', missionId:'b1', label:'B1 Rookie Boss'},
    {sessionId:'s3', missionId:'m3', label:'S3 Search Maze'}
  ];

  const studentMap = {};
  profiles.forEach(function(p){
    const sid = String(p.studentId || '').trim();
    if (!sid) return;
    studentMap[sid] = {
      studentId:sid,
      studentName:String(p.studentName || ''),
      section:String(p.section || ''),
      sessions:{},
      readyForS3:false,
      readyForS4:false,
      challenge:false,
      risks:[]
    };
  });

  attempts.forEach(function(a){
    const sid = String(a.studentId || '').trim();
    if (!sid) return;
    if (!studentMap[sid]) {
      studentMap[sid] = {
        studentId:sid,
        studentName:String(a.studentName || ''),
        section:String(a.section || ''),
        sessions:{},
        readyForS3:false,
        readyForS4:false,
        challenge:false,
        risks:['ไม่มี Profile']
      };
    }

    const sessionId = String(a.sessionId || '').trim();
    if (!sessionId) return;

    const score = Number(a.score || 0);
    const stars = Number(a.stars || 0);
    const mastered = bool_(a.mastered);
    const bossWin = bool_(a.bossWin);
    const helpUsed = Number(a.helpUsed || 0);
    const reflectionOk = reflectionComplete_(a);

    const s = studentMap[sid];
    const cur = s.sessions[sessionId] || {
      sessionId:sessionId,
      attempts:0,
      bestScore:0,
      latestScore:0,
      stars:0,
      mastered:false,
      bossWin:false,
      helpUsed:0,
      reflectionComplete:false,
      passed:false
    };

    cur.attempts += 1;
    cur.bestScore = Math.max(Number(cur.bestScore || 0), score);
    cur.latestScore = score;
    cur.stars = Math.max(Number(cur.stars || 0), stars);
    cur.mastered = cur.mastered || mastered;
    cur.bossWin = cur.bossWin || bossWin;
    cur.helpUsed = helpUsed;
    cur.reflectionComplete = cur.reflectionComplete || reflectionOk;
    cur.passed = cur.passed || mastered || stars >= 1 || score >= 60 || (sessionId === 'b1' && bossWin);

    s.sessions[sessionId] = cur;
    s.studentName = s.studentName || String(a.studentName || '');
    s.section = s.section || String(a.section || '');
  });

  const students = Object.values(studentMap);
  const stageProgress = required.map(function(req){
    let submitted = 0, passed = 0, mastery = 0, scoreSum = 0;
    students.forEach(function(st){
      const ss = st.sessions[req.sessionId];
      if (ss && ss.attempts > 0) {
        submitted++;
        scoreSum += Number(ss.bestScore || 0);
        if (ss.passed) passed++;
        if (ss.mastered) mastery++;
      }
    });
    return {
      sessionId:req.sessionId,
      label:req.label,
      submitted:submitted,
      passed:passed,
      mastery:mastery,
      avgBest:round2_(scoreSum / Math.max(1, submitted))
    };
  });

  let readyForS3 = 0, readyForS4 = 0, challengeReady = 0;
  let needS1 = 0, needS2 = 0, needB1 = 0, needS3 = 0, remedial = 0;
  let s3Submitted = 0, s3Passed = 0;

  const studentGateRows = students.map(function(st){
    const s1 = st.sessions.s1 || {};
    const s2 = st.sessions.s2 || {};
    const b1 = st.sessions.b1 || {};
    const s3 = st.sessions.s3 || {};

    const passS1 = !!s1.passed;
    const passS2 = !!s2.passed;
    const passB1 = !!b1.passed;
    const passS3 = !!s3.passed;

    const hasS3 = !!(s3 && s3.attempts > 0);
    if (hasS3) s3Submitted++;
    if (passS3) s3Passed++;

    const risks = [];
    if (!passS1) risks.push('Need S1');
    if (!passS2) risks.push('Need S2');
    if (!passB1) risks.push('Need B1');
    if (passS1 && passS2 && passB1 && !passS3) risks.push('Need S3');
    if (passS1 && passS2 && passB1 && passS3 && (Number(s3.bestScore || 0) < 85 || !s3.mastered)) risks.push('S3 passed but not mastery');

    if (!passS1) needS1++;
    else if (!passS2) needS2++;
    else if (!passB1) needB1++;
    else if (!passS3) needS3++;

    const ready3 = passS1 && passS2 && passB1;
    const ready4 = ready3 && passS3;
    const challenge = ready4 &&
      Number(s1.bestScore || 0) >= 85 &&
      Number(s2.bestScore || 0) >= 85 &&
      Number(b1.bestScore || 0) >= 85 &&
      Number(s3.bestScore || 0) >= 85 &&
      !!s3.mastered;

    if (ready3) readyForS3++;
    if (ready4) readyForS4++;
    if (challenge) challengeReady++;
    if (!ready4) remedial++;

    st.readyForS3 = ready3;
    st.readyForS4 = ready4;
    st.challenge = challenge;
    st.risks = (st.risks || []).concat(risks);

    return {
      studentId:st.studentId,
      studentName:st.studentName,
      section:st.section,
      s1:{passed:passS1, bestScore:Number(s1.bestScore || 0), mastered:!!s1.mastered},
      s2:{passed:passS2, bestScore:Number(s2.bestScore || 0), mastered:!!s2.mastered},
      b1:{passed:passB1, bestScore:Number(b1.bestScore || 0), mastered:!!b1.mastered, bossWin:!!b1.bossWin},
      s3:{passed:passS3, bestScore:Number(s3.bestScore || 0), mastered:!!s3.mastered, attempts:Number(s3.attempts || 0)},
      readyForS3:ready3,
      readyForS4:ready4,
      challengeReady:challenge,
      risks:risks
    };
  });

  const misconceptions = collectMisconceptions_(attempts, events);
  const topMis = misconceptions.slice(0, 8);
  const readyPct = students.length ? Math.round(readyForS3 / students.length * 100) : 0;
  const readyForS4Pct = students.length ? Math.round(readyForS4 / students.length * 100) : 0;
  const s3SubmittedPct = students.length ? Math.round(s3Submitted / students.length * 100) : 0;
  const hasS3Data = s3Submitted > 0;
  const recommendations = [];

  if (students.length === 0) {
    recommendations.push('ยังไม่มีรายชื่อนักศึกษา/attempt สำหรับวิเคราะห์ Class Progress');
  } else if (!hasS3Data) {
    if (readyPct >= 70) {
      recommendations.push('พร้อมให้ผู้เรียนเริ่ม S3 Search Maze แล้ว ใช้ 10 นาทีแรกทบทวน misconception เด่นก่อนเริ่ม BFS/DFS');
    } else if (readyPct >= 50) {
      recommendations.push('เปิด S3 ได้แบบมี Remedial คู่ขนาน: กลุ่มพร้อมเริ่ม S3 ส่วนกลุ่มที่ยังไม่ผ่านทำ S2/B1 Training ก่อน');
    } else {
      recommendations.push('ยังไม่ควรเปิด S3 ทันที: ควร remedial S1-S2-B1 ก่อนอย่างน้อย 15–25 นาที แล้วให้ทำ B1 ซ้ำ');
    }
  } else {
    if (readyForS4Pct >= 70) {
      recommendations.push('ห้องผ่าน S3 แล้ว พร้อมต่อ S4 Route Cost Challenge เมื่อเปิด patch ถัดไป');
      recommendations.push('ก่อนขึ้น S4 ให้ทบทวนความต่างระหว่าง visited order, final path และ cost-based search ประมาณ 10 นาที');
    } else if (readyForS4Pct >= 50) {
      recommendations.push('ให้กลุ่มที่ผ่าน S3 เตรียม S4 ได้ แต่ควรให้กลุ่มที่ยังไม่ผ่านทำ S3 Search Maze ซ้ำหรือ remedial เพิ่ม');
    } else {
      recommendations.push('ควร remedial S3 Search Maze ก่อนเปิด S4 โดยเน้น State Space, BFS/DFS Trace และ Maze Path');
    }
  }

  if (needS3 > 0) recommendations.push('ให้ผู้เรียนที่ผ่าน B1 แล้วแต่ยังไม่ผ่าน S3 เล่น/แก้ S3 Search Maze');
  if (needB1 > 0) recommendations.push('ให้ผู้เรียนที่ยังไม่ผ่าน B1 ทำ Rookie Boss ซ้ำจนได้อย่างน้อย 1 ดาว');
  if (needS2 > 0) recommendations.push('ทบทวน Intelligent Agent / PEAS / Environment สำหรับผู้เรียนที่ยังไม่ผ่าน S2');
  if (needS1 > 0) recommendations.push('ให้ผู้เรียนที่ยังไม่ผ่าน S1 กลับไปเก็บ AI Overview ก่อนเข้าด่านต่อ');
  if (topMis.length) recommendations.push('คาบถัดไปควรยกตัวอย่างซ้ำเรื่อง ' + topMis.slice(0,3).map(function(x){ return x.key; }).join(', '));

  return {
    requiredSessions:required,
    totalStudents:students.length,
    readyForS3:readyForS3,
    readyPct:readyPct,
    readyForS4:readyForS4,
    readyForS4Pct:readyForS4Pct,
    s3Submitted:s3Submitted,
    s3SubmittedPct:s3SubmittedPct,
    s3Passed:s3Passed,
    hasS3Data:hasS3Data,
    challengeReady:challengeReady,
    remedial:remedial,
    needS1:needS1,
    needS2:needS2,
    needB1:needB1,
    needS3:needS3,
    stageProgress:stageProgress,
    topMisconceptions:topMis,
    recommendations:recommendations,
    studentGateRows:studentGateRows.sort(function(a,b){
      return String(a.studentId || '').localeCompare(String(b.studentId || ''));
    })
  };
}



function normalizePhaseName_(phase) {
  const raw = String(phase || '').trim();
  const key = raw.toLowerCase().replace(/\s+/g, '_');

  const map = {
    'agent':'Agent Foundation',
    'agent_foundation':'Agent Foundation',
    'agent_or_not':'Agent Foundation',
    'ai_vs_automation':'AI vs Automation',
    'automation':'AI vs Automation',
    'peas':'PEAS Gate',
    'peas_builder':'PEAS Gate',
    'peas_gate':'PEAS Gate',
    'environment':'Environment Gate',
    'environment_classifier':'Environment Gate',
    'environment_gate':'Environment Gate',
    'rationality':'Rationality Gate',
    'rational_agent':'Rationality Gate',
    'rationality_gate':'Rationality Gate',
    'boss':'Final Attack',
    'adaptive_boss':'Final Attack',
    'rational_agent_boss':'Final Attack',
    'final_attack':'Final Attack',
    'state_space':'State Space',
    'bfs/dfs_trace':'BFS/DFS Trace',
    'bfs_dfs_trace':'BFS/DFS Trace',
    'maze_path':'Maze Path',
    'frontier_debug':'Frontier Debug',
    'trace_error_debug':'Trace Error Debug',
    'search_boss':'Search Boss',
    'cost_concept':'Cost Concept',
    'ucs_trace':'UCS Trace',
    'optimal_path':'Optimal Path',
    'frontier_cost':'Frontier Cost',
    'bfs_vs_ucs':'BFS vs UCS',
    'cost_boss':'Cost Boss',
    'astar_concept':'A* Concept','a*_concept':'A* Concept','astar_trace':'A* Trace','a*_trace':'A* Trace','astar_path':'A* Path','a*_path':'A* Path','astar_vs_greedy':'A* vs Greedy','a*_vs_greedy':'A* vs Greedy','astar_boss':'A* Boss','a*_boss':'A* Boss',
    's3_search_core':'S3 Search Core','s4_cost_search':'S4 Cost Search','s5_heuristic_search':'S5 Heuristic Search','final_search_duel':'Final Search Duel'
  };

  return map[key] || raw || 'Unknown';
}


function collectPhaseAnalytics_(events) {
  const map = {};
  (events || []).forEach(function(e){
    const type = String(e.eventType || '');
    if (type !== 'answer_submit' && type !== 'boss_answer') return;

    const phase = normalizePhaseName_(e.phase || 'Unknown');
    if (!map[phase]) map[phase] = {phase:phase, correct:0, total:0, wrong:0};

    map[phase].total += 1;

    const val = String(e.isCorrect || '').toLowerCase();
    const ok = val === 'true' || val === 'yes' || val === '1';
    if (ok) map[phase].correct += 1;
    else map[phase].wrong += 1;
  });

  const order = ['AI vs Automation','Agent Foundation','PEAS Gate','Environment Gate','Rationality Gate','Final Attack'];
  return Object.values(map).sort(function(a,b){
    const ai = order.indexOf(String(a.phase || ''));
    const bi = order.indexOf(String(b.phase || ''));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || String(a.phase || '').localeCompare(String(b.phase || ''));
  }).map(function(row){
    row.percent = row.total ? Math.round(row.correct / row.total * 100) : 0;
    return row;
  });
}


function sheetObjects_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0].map(function(h){ return String(h || ''); });
  return values.slice(1).filter(function(row){ return row.some(function(v){ return v !== '' && v != null; }); }).map(function(row){
    const obj = {};
    headers.forEach(function(h, i){ obj[h] = row[i]; });
    return obj;
  });
}

function reflectionComplete_(a) {
  return !!(String(a.reflection1 || '').trim() && String(a.reflection2 || '').trim() && String(a.reflection3 || '').trim());
}

function reflectionShort_(a) {
  if (!reflectionComplete_(a)) return false;

  const r1 = String(a.reflection1 || '').trim();
  const r2 = String(a.reflection2 || '').trim();
  const r3 = String(a.reflection3 || '').trim();

  return r1.length < 20 || r2.length < 20 || r3.length < 20;
}

function collectMisconceptions_(attempts, events) {
  const mis = {};
  attempts.forEach(function(a){
    try {
      const obj = JSON.parse(String(a.misconceptionsJson || '{}'));
      Object.keys(obj || {}).forEach(function(k){ mis[k] = (mis[k] || 0) + Number(obj[k] || 0); });
    } catch (e) {}
  });
  events.forEach(function(e){
    try {
      const extra = JSON.parse(String(e.extraJson || '{}'));
      const key = extra.misconception || extra.misconceptionKey || extra.key || '';
      if (key) mis[key] = (mis[key] || 0) + 1;
    } catch (err) {}
  });
  return Object.keys(mis).map(function(k){ return {key:k, count:Number(mis[k] || 0)}; }).sort(function(a,b){ return b.count - a.count; });
}

function testWrite_() {
  const now = bangkokIsoNow();
  const attemptId = makeId_('test_att');
  upsertProfile_({studentId:'TEST001', studentName:'Test Student', section:SECTION_LOCK, nickname:'Tester', email:'', createdAt:now, updatedAt:now, userAgent:'manual-test', extraJson:{source:'testWrite', version:APP_VERSION}});
  appendAttempt_({attemptId:attemptId, studentId:'TEST001', studentName:'Test Student', section:SECTION_LOCK, sessionId:'s1', missionId:'m1', missionTitle:'AI Awakening', difficulty:'test', score:88, stars:2, mastered:false, usedTimeSec:60, timeLeftSec:20, accuracy:80, correct:8, total:10, wrong:2, maxCombo:4, helpUsed:1, trickCorrect:2, trickTotal:3, explainCorrect:2, explainTotal:3, bossWin:true, misconceptions:{automation:1}, wrongItems:[], reflection1:'test reflection 1', reflection2:'test reflection 2', reflection3:'test reflection 3', clientTs:now, userAgent:'manual-test', pageUrl:'manual-test', version:APP_VERSION, extraJson:{source:'testWrite', version:APP_VERSION}});
  appendEvent_({eventId:makeId_('test_evt'), attemptId:attemptId, studentId:'TEST001', section:SECTION_LOCK, sessionId:'s1', missionId:'m1', eventType:'manual_test', phase:'test', itemId:'test_item', prompt:'manual test prompt', yourAnswer:'A', correctAnswer:'A', isCorrect:true, scoreDelta:1, combo:1, helpLeft:2, clientTs:now, userAgent:'manual-test', pageUrl:'manual-test', extraJson:{source:'testWrite', version:APP_VERSION}});
  appendProgress_({progressId:makeId_('test_prog'), studentId:'TEST001', studentName:'Test Student', section:SECTION_LOCK, courseId:'CSAI2102', classId:'CSAI2102-2569-SEC01', term:'1/2569', sessionId:'s1', missionId:'m1', status:'clear', stars:2, bestScore:88, unlocked:true, updatedAt:now, extraJson:{source:'testWrite', version:APP_VERSION}});
  updateTeacherSummary();
  return {ok:true, action:'testWrite', version:APP_VERSION, wrote:{profile:true, attempt:true, event:true, progress:true}, attemptId:attemptId, serverTs:bangkokIsoNow()};
}

function isTestStudent_(studentId, studentName) {
  const raw = String(studentId || '') + ' ' + String(studentName || '');
  const s = raw.toUpperCase();

  return (
    s.indexOf('TEST') >= 0 ||
    s.indexOf('GAME_TEST') >= 0 ||
    s.indexOf('BROWSER') >= 0 ||
    s.indexOf('MANUAL-TEST') >= 0 ||
    s.indexOf('SAMPLE') >= 0 ||
    s.indexOf('DEMO') >= 0
  );
}

function forceSection_(value) {
  return SECTION_LOCK;
}

function getSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function jsonOutMaybe_(obj, callback) {
  const json = JSON.stringify(obj || {});
  if (callback) {
    const safeCallback = String(callback).replace(/[^\w.$]/g, '');
    return ContentService.createTextOutput(safeCallback + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonOut(obj);
}

function bangkokIsoNow() {
  return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function makeId_(prefix) {
  return prefix + '_' + Utilities.getUuid().replace(/-/g, '').slice(0, 18);
}

function clean_(v) {
  return String(v == null ? '' : v).slice(0, 5000);
}

function stringify_(v) {
  if (typeof v === 'string') return v.slice(0, 45000);
  try { return JSON.stringify(v == null ? {} : v).slice(0, 45000); } catch (e) { return '{}'; }
}

function num_(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function bool_(v) {
  return v === true || String(v).toLowerCase() === 'true';
}

function boolOrBlank_(v) {
  if (v === '' || v == null) return '';
  return bool_(v);
}

function round2_(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function mostCommon_(obj) {
  const e = Object.entries(obj || {}).sort(function(a,b){ return Number(b[1]) - Number(a[1]); });
  return e.length ? e[0][0] + ':' + e[0][1] : '';
}
