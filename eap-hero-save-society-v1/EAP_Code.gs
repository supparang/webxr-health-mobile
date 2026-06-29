/* EAP Hero: Save the Society — Google Apps Script Receiver v1
   1) Create a Google Sheet for EAP Hero.
   2) Extensions > Apps Script > replace Code.gs with this file.
   3) Set SPREADSHEET_ID below (or bind script to the Sheet and leave blank).
   4) Run setupEapHero() once, authorize.
   5) Deploy > New deployment > Web app:
      Execute as: Me | Who has access: Anyone
*/

const EAP_CONFIG = {
  SPREADSHEET_ID: '', // paste spreadsheet ID here when this is a standalone Apps Script project
  TIMEZONE: 'Asia/Bangkok',
  COURSE: 'EAP Hero: Save the Society',
  DEFAULT_SECTION: '122',
  MAX_ATTEMPTS_RETURN: 500
};

const EAP_SHEETS = {
  PROFILES: 'profiles',
  ATTEMPTS: 'attempts',
  EVENTS: 'events',
  SUMMARY: 'summary',
  ERRORS: 'errors'
};

const HEADERS = {
  profiles: ['profileId','studentId','studentName','section','firstSeenAt','lastSeenAt','source'],
  attempts: ['attemptId','submittedAt','date','timezone','course','section','studentId','studentName','sessionId','sessionTitle','skill','level','score','accuracy','passMark','passed','evidenceType','legacyCompletion','attemptNo','replay','hintUsed','durationSec','maxCombo','wrongItemsJson','misconceptionsJson','reflection','appVersion','clientTimestamp','sourceUrl'],
  events: ['eventId','createdAt','date','timezone','course','section','studentId','studentName','eventType','sessionId','skill','valueJson','appVersion','sourceUrl'],
  summary: ['summaryId','updatedAt','course','section','studentId','studentName','sessionId','sessionTitle','skill','bestScore','bestAccuracy','passed','legacyCompletion','attempts','lastAttemptAt','lastLevel','lastEvidenceType','hintUsedTotal','replayTotal','reviewFlag'],
  errors: ['errorId','createdAt','stage','message','payloadJson']
};

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = String(p.action || 'health').toLowerCase();
    if (action === 'health') return json_({ ok:true, service:'eap-hero', version:'v1', now:now_() });
    if (action === 'teacher_summary') return json_(teacherSummary_(p));
    if (action === 'teacher_students') return json_(teacherStudents_(p));
    if (action === 'teacher_student') return json_(teacherStudent_(p));
    return json_({ ok:false, error:'Unknown action' });
  } catch (err) {
    logError_('GET', err, e);
    return json_({ ok:false, error:String(err && err.message || err) });
  }
}

function doPost(e) {
  let payload = {};
  try {
    payload = parsePayload_(e);
    const action = String(payload.action || 'submit_attempt').toLowerCase();
    if (action === 'submit_attempt') return json_(submitAttempt_(payload));
    if (action === 'submit_event') return json_(submitEvent_(payload));
    if (action === 'sync_snapshot') return json_(syncSnapshot_(payload));
    return json_({ ok:false, error:'Unknown action' });
  } catch (err) {
    logError_('POST', err, payload);
    return json_({ ok:false, error:String(err && err.message || err) });
  }
}

function setupEapHero() {
  const ss = ss_();
  ensureSheet_(ss, EAP_SHEETS.PROFILES, HEADERS.profiles);
  ensureSheet_(ss, EAP_SHEETS.ATTEMPTS, HEADERS.attempts);
  ensureSheet_(ss, EAP_SHEETS.EVENTS, HEADERS.events);
  ensureSheet_(ss, EAP_SHEETS.SUMMARY, HEADERS.summary);
  ensureSheet_(ss, EAP_SHEETS.ERRORS, HEADERS.errors);
  return { ok:true, spreadsheetId:ss.getId(), sheets:Object.values(EAP_SHEETS) };
}

function submitAttempt_(p) {
  const clean = normalizeAttempt_(p);
  if (!clean.studentId) return { ok:false, error:'studentId is required' };
  if (!clean.sessionId || !clean.skill) return { ok:false, error:'sessionId and skill are required' };

  const ss = ss_();
  upsertProfile_(ss, clean);
  const attempts = ensureSheet_(ss, EAP_SHEETS.ATTEMPTS, HEADERS.attempts);
  attempts.appendRow(HEADERS.attempts.map(h => clean[h]));
  updateSummary_(ss, clean);
  return { ok:true, attemptId:clean.attemptId, receivedAt:clean.submittedAt };
}

function submitEvent_(p) {
  const ss = ss_();
  const now = now_();
  const row = {
    eventId: p.eventId || uid_('evt'), createdAt:now.iso, date:now.date, timezone:EAP_CONFIG.TIMEZONE,
    course:EAP_CONFIG.COURSE, section:String(p.section || EAP_CONFIG.DEFAULT_SECTION),
    studentId:String(p.studentId || ''), studentName:String(p.studentName || ''),
    eventType:String(p.eventType || 'event'), sessionId:String(p.sessionId || ''), skill:String(p.skill || ''),
    valueJson:jsonString_(p.value || p), appVersion:String(p.appVersion || ''), sourceUrl:String(p.sourceUrl || '')
  };
  ensureSheet_(ss, EAP_SHEETS.EVENTS, HEADERS.events).appendRow(HEADERS.events.map(h => row[h]));
  return { ok:true, eventId:row.eventId };
}

function syncSnapshot_(p) {
  const records = Array.isArray(p.attempts) ? p.attempts : [];
  const results = records.map(r => submitAttempt_(Object.assign({}, r, {
    action:'submit_attempt', studentId:r.studentId || p.studentId, studentName:r.studentName || p.studentName, section:r.section || p.section
  })));
  return { ok:true, received:results.filter(x=>x.ok).length, results:results };
}

function normalizeAttempt_(p) {
  const now = now_();
  const score = number_(p.score);
  const accuracy = number_(p.accuracy);
  const passMark = number_(p.passMark, 60);
  const legacy = bool_(p.legacyCompletion);
  const passed = p.passed === undefined ? (legacy || score >= passMark) : bool_(p.passed);
  return {
    attemptId: String(p.attemptId || uid_('attempt')),
    submittedAt: now.iso, date: now.date, timezone:EAP_CONFIG.TIMEZONE, course:EAP_CONFIG.COURSE,
    section:String(p.section || EAP_CONFIG.DEFAULT_SECTION), studentId:String(p.studentId || p.playerId || 'guest'), studentName:String(p.studentName || p.name || 'Guest'),
    sessionId:String(p.sessionId || ''), sessionTitle:String(p.sessionTitle || ''), skill:String(p.skill || ''), level:String(p.level || 'A2–B1+'),
    score:score, accuracy:accuracy, passMark:passMark, passed:passed ? 'TRUE' : 'FALSE', evidenceType:String(p.evidenceType || 'mission'), legacyCompletion:legacy ? 'TRUE' : 'FALSE',
    attemptNo:number_(p.attemptNo, 1), replay:bool_(p.replay) ? 'TRUE' : 'FALSE', hintUsed:number_(p.hintUsed), durationSec:number_(p.durationSec), maxCombo:number_(p.maxCombo),
    wrongItemsJson:jsonString_(p.wrongItems || []), misconceptionsJson:jsonString_(p.misconceptions || []), reflection:String(p.reflection || ''),
    appVersion:String(p.appVersion || ''), clientTimestamp:String(p.clientTimestamp || ''), sourceUrl:String(p.sourceUrl || '')
  };
}

function updateSummary_(ss, a) {
  const sh = ensureSheet_(ss, EAP_SHEETS.SUMMARY, HEADERS.summary);
  const rows = sh.getDataRange().getValues();
  const key = [a.studentId,a.sessionId,a.skill].join('|');
  let found = -1;
  for (let i=1;i<rows.length;i++) if ([rows[i][4],rows[i][6],rows[i][8]].join('|') === key) { found=i+1; break; }
  const prior = found > 0 ? rowObject_(HEADERS.summary, rows[found-1]) : {};
  const priorBest = number_(prior.bestScore, -1);
  const best = Math.max(priorBest, number_(a.score));
  const attempts = number_(prior.attempts) + 1;
  const passed = bool_(prior.passed) || a.passed === 'TRUE';
  const legacy = bool_(prior.legacyCompletion) || a.legacyCompletion === 'TRUE';
  const reviewFlag = legacy ? 'legacy_completion_only' : (best < 60 ? 'needs_support' : '');
  const item = {
    summaryId:prior.summaryId || uid_('summary'), updatedAt:a.submittedAt, course:a.course, section:a.section,
    studentId:a.studentId, studentName:a.studentName, sessionId:a.sessionId, sessionTitle:a.sessionTitle, skill:a.skill,
    bestScore:best, bestAccuracy:Math.max(number_(prior.bestAccuracy), number_(a.accuracy)), passed:passed ? 'TRUE' : 'FALSE', legacyCompletion:legacy ? 'TRUE' : 'FALSE',
    attempts:attempts, lastAttemptAt:a.submittedAt, lastLevel:a.level, lastEvidenceType:a.evidenceType,
    hintUsedTotal:number_(prior.hintUsedTotal)+number_(a.hintUsed), replayTotal:number_(prior.replayTotal)+(a.replay === 'TRUE' ? 1 : 0), reviewFlag:reviewFlag
  };
  if (found > 0) sh.getRange(found,1,1,HEADERS.summary.length).setValues([HEADERS.summary.map(h=>item[h])]);
  else sh.appendRow(HEADERS.summary.map(h=>item[h]));
}

function teacherSummary_(p) {
  const section = String(p.section || EAP_CONFIG.DEFAULT_SECTION);
  const rows = sheetRows_(EAP_SHEETS.SUMMARY).filter(r=>String(r.section)===section);
  const students = [...new Set(rows.map(r=>r.studentId).filter(Boolean))];
  const scored = rows.filter(r=>String(r.legacyCompletion)!=='TRUE' && number_(r.bestScore)>=0);
  const needsSupport = rows.filter(r=>r.reviewFlag==='needs_support').length;
  const legacyOnly = rows.filter(r=>r.reviewFlag==='legacy_completion_only').length;
  return { ok:true, section, students:students.length, skillRecords:rows.length, avgBestScore:avg_(scored.map(r=>number_(r.bestScore))), needsSupport, legacyOnly, updatedAt:now_().iso };
}

function teacherStudents_(p) {
  const section = String(p.section || EAP_CONFIG.DEFAULT_SECTION);
  const q = String(p.q || '').toLowerCase();
  const rows = sheetRows_(EAP_SHEETS.SUMMARY).filter(r=>String(r.section)===section);
  const byStudent = {};
  rows.forEach(r=>{
    const id=String(r.studentId); if(!byStudent[id]) byStudent[id]={studentId:id,studentName:r.studentName,section:r.section,records:[],scores:[],legacy:0,review:0};
    byStudent[id].records.push(r); if(String(r.legacyCompletion)==='TRUE')byStudent[id].legacy++; else byStudent[id].scores.push(number_(r.bestScore)); if(r.reviewFlag)byStudent[id].review++;
  });
  let data=Object.values(byStudent).map(s=>({ studentId:s.studentId, studentName:s.studentName, section:s.section, skills:s.records.length, avgBestScore:avg_(s.scores), legacyCompletion:s.legacy, reviewCount:s.review, status:s.review?'review':(s.legacy?'legacy':'active') }));
  if(q) data=data.filter(x=>(x.studentId+' '+x.studentName).toLowerCase().includes(q));
  return { ok:true, section, students:data.sort((a,b)=>String(a.studentName).localeCompare(String(b.studentName))), updatedAt:now_().iso };
}

function teacherStudent_(p) {
  const studentId=String(p.studentId||'');
  if(!studentId)return {ok:false,error:'studentId required'};
  const records=sheetRows_(EAP_SHEETS.SUMMARY).filter(r=>String(r.studentId)===studentId);
  const attempts=sheetRows_(EAP_SHEETS.ATTEMPTS).filter(r=>String(r.studentId)===studentId).slice(-EAP_CONFIG.MAX_ATTEMPTS_RETURN);
  return {ok:true,studentId,profile:records[0]||{},summary:records,attempts};
}

function upsertProfile_(ss,a){
  const sh=ensureSheet_(ss,EAP_SHEETS.PROFILES,HEADERS.profiles), rows=sh.getDataRange().getValues();
  for(let i=1;i<rows.length;i++) if(String(rows[i][1])===a.studentId){sh.getRange(i+1,1,1,HEADERS.profiles.length).setValues([[rows[i][0],a.studentId,a.studentName,a.section,rows[i][4],a.submittedAt,'eap-hero']]);return;}
  sh.appendRow([uid_('profile'),a.studentId,a.studentName,a.section,a.submittedAt,a.submittedAt,'eap-hero']);
}
function ss_(){ const id=EAP_CONFIG.SPREADSHEET_ID; return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive(); }
function ensureSheet_(ss,name,headers){let sh=ss.getSheetByName(name);if(!sh){sh=ss.insertSheet(name);sh.getRange(1,1,1,headers.length).setValues([headers]);sh.setFrozenRows(1);sh.getRange(1,1,1,headers.length).setFontWeight('bold');sh.autoResizeColumns(1,headers.length);}return sh;}
function sheetRows_(name){const sh=ensureSheet_(ss_(),name,HEADERS[name]||[]),v=sh.getDataRange().getValues();if(v.length<2)return[];return v.slice(1).map(r=>rowObject_(v[0],r));}
function rowObject_(headers,row){const o={};headers.forEach((h,i)=>o[h]=row[i]);return o;}
function parsePayload_(e){if(e&&e.postData&&e.postData.contents){try{return JSON.parse(e.postData.contents);}catch(_){}}return(e&&e.parameter)||{};}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
function now_(){const d=new Date();return{iso:Utilities.formatDate(d,EAP_CONFIG.TIMEZONE,"yyyy-MM-dd'T'HH:mm:ssXXX"),date:Utilities.formatDate(d,EAP_CONFIG.TIMEZONE,'yyyy-MM-dd'),tz:EAP_CONFIG.TIMEZONE};}
function uid_(prefix){return prefix+'-'+new Date().getTime()+'-'+Math.random().toString(36).slice(2,10);}
function number_(v,fallback){const n=Number(v);return Number.isFinite(n)?n:(fallback===undefined?0:fallback);}
function bool_(v){return v===true||String(v).toLowerCase()==='true'||String(v)==='1';}
function avg_(arr){const a=arr.filter(v=>Number.isFinite(v));return a.length?Math.round((a.reduce((x,y)=>x+y,0)/a.length)*100)/100:0;}
function jsonString_(x){try{return JSON.stringify(x);}catch(_){return '[]';}}
function logError_(stage,err,payload){try{ensureSheet_(ss_(),EAP_SHEETS.ERRORS,HEADERS.errors).appendRow([uid_('err'),now_().iso,stage,String(err&&err.stack||err),jsonString_(payload)]);}catch(_){}}
