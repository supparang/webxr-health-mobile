/**
 * HeroHealth Classroom Receiver
 * Version: 2026-07-22-PRODUCTION-V1
 *
 * Deploy as a standalone Apps Script Web App.
 * Execute as: Me
 * Who has access: Anyone
 */
const HH_VERSION = '2026-07-22-PRODUCTION-V1';
const HH_SHEETS = {
  profiles: 'HH_Profiles',
  assessments: 'HH_Assessments',
  assessmentItems: 'HH_Assessment_Items',
  games: 'HH_Game_Results',
  reflections: 'HH_Reflections',
  progress: 'HH_Progress',
  events: 'HH_Events',
  errors: 'HH_Errors'
};

function HH_setupSheets() {
  const ss = SpreadsheetApp.getActive();
  ensureSheet_(ss, HH_SHEETS.profiles, ['serverTs','eventId','studentId','fullName','section','group','clientTs','platformVersion','payloadJson']);
  ensureSheet_(ss, HH_SHEETS.assessments, ['serverTs','eventId','studentId','fullName','section','group','assessment','form','score','total','percent','clientTs','payloadJson']);
  ensureSheet_(ss, HH_SHEETS.assessmentItems, ['serverTs','eventId','studentId','assessment','questionId','selectedOptionIndex','correct','clientTs']);
  ensureSheet_(ss, HH_SHEETS.games, ['serverTs','eventId','studentId','fullName','section','group','zone','gameId','score','accuracy','passed','completed','finishedAt','payloadJson']);
  ensureSheet_(ss, HH_SHEETS.reflections, ['serverTs','eventId','studentId','fullName','section','group','understand','best','action','submittedAt','payloadJson']);
  ensureSheet_(ss, HH_SHEETS.progress, ['serverTs','eventId','studentId','fullName','section','group','progressPct','completedCount','totalSteps','nextStep','missionComplete','clientTs','payloadJson']);
  ensureSheet_(ss, HH_SHEETS.events, ['serverTs','eventId','eventType','studentId','clientTs','payloadJson']);
  ensureSheet_(ss, HH_SHEETS.errors, ['serverTs','eventId','studentId','message','stack','clientTs','payloadJson']);
  return {ok:true, version:HH_VERSION};
}

function doGet() {
  return json_({ok:true, service:'HeroHealth Classroom Receiver', version:HH_VERSION, ts:new Date().toISOString()});
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const payload = parsePayload_(e);
    if (!payload || !payload.eventId || !payload.eventType || !payload.studentId) {
      return json_({ok:false, error:'missing_required_fields'});
    }
    const ss = SpreadsheetApp.getActive();
    HH_setupSheets();
    if (isDuplicate_(ss, payload.eventId)) return json_({ok:true, duplicate:true, eventId:payload.eventId});
    route_(ss, payload);
    append_(ss, HH_SHEETS.events, [new Date(), payload.eventId, payload.eventType, payload.studentId, payload.clientTs || '', JSON.stringify(payload)]);
    return json_({ok:true, eventId:payload.eventId, version:HH_VERSION});
  } catch (err) {
    try {
      const ss = SpreadsheetApp.getActive();
      ensureSheet_(ss, HH_SHEETS.errors, ['serverTs','eventId','studentId','message','stack','clientTs','payloadJson']);
      append_(ss, HH_SHEETS.errors, [new Date(), '', '', String(err && err.message || err), String(err && err.stack || ''), '', '']);
    } catch (_) {}
    return json_({ok:false, error:String(err && err.message || err)});
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function route_(ss, p) {
  const profile = p.profile || {};
  const common = [p.eventId, p.studentId, profile.fullName || p.fullName || '', profile.section || p.section || '', profile.group || p.group || ''];
  if (p.eventType === 'profile') {
    append_(ss, HH_SHEETS.profiles, [new Date()].concat(common, [p.clientTs || '', p.platformVersion || '', JSON.stringify(p)]));
    return;
  }
  if (p.eventType === 'assessment') {
    const a = p.assessment || {};
    append_(ss, HH_SHEETS.assessments, [new Date()].concat(common, [a.type || '', a.form || '', Number(a.score)||0, Number(a.total)||0, Number(a.total)?Math.round(Number(a.score)*10000/Number(a.total))/100:0, p.clientTs || '', JSON.stringify(p)]));
    (Array.isArray(a.responses) ? a.responses : []).forEach(r => append_(ss, HH_SHEETS.assessmentItems, [new Date(), p.eventId, p.studentId, a.type || '', r.questionId || '', r.selectedOptionIndex == null ? '' : r.selectedOptionIndex, r.correct === true, p.clientTs || '']));
    return;
  }
  if (p.eventType === 'game') {
    const g = p.game || {};
    append_(ss, HH_SHEETS.games, [new Date()].concat(common, [g.zone || '', g.gameId || '', Number(g.score)||0, Number(g.accuracy)||0, g.passed === true, g.completed === true, g.finishedAt || p.clientTs || '', JSON.stringify(p)]));
    return;
  }
  if (p.eventType === 'reflection') {
    const r = p.reflection || {};
    append_(ss, HH_SHEETS.reflections, [new Date()].concat(common, [Number(r.understand)||0, r.best || '', r.action || '', r.submittedAt || p.clientTs || '', JSON.stringify(p)]));
    return;
  }
  if (p.eventType === 'progress') {
    const x = p.progress || {};
    append_(ss, HH_SHEETS.progress, [new Date()].concat(common, [Number(x.progressPct)||0, Number(x.completedCount)||0, Number(x.totalSteps)||9, x.nextStep || '', x.missionComplete === true, p.clientTs || '', JSON.stringify(p)]));
    return;
  }
  if (p.eventType === 'error') {
    append_(ss, HH_SHEETS.errors, [new Date(), p.eventId, p.studentId, p.message || '', p.stack || '', p.clientTs || '', JSON.stringify(p)]);
  }
}

function isDuplicate_(ss, eventId) {
  const sh = ss.getSheetByName(HH_SHEETS.events);
  if (!sh || sh.getLastRow() < 2) return false;
  const finder = sh.getRange(2, 2, sh.getLastRow()-1, 1).createTextFinder(String(eventId)).matchEntireCell(true).findNext();
  return !!finder;
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
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,headers.length).setFontWeight('bold');
  }
  return sh;
}
function append_(ss, name, row) { ensureSheet_(ss, name, row.map((_,i)=>'col'+(i+1))).appendRow(row); }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
