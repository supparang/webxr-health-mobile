/**
 * CSAI2102 AI Quest Logger
 * Google Apps Script Web App
 * Version: v1.6
 */
const APP_VERSION = 'v1.6';
const TZ = 'Asia/Bangkok';
const SHEETS = {profiles:'students_profile', attempts:'session_attempts', events:'session_events', summary:'teacher_summary'};
const HEADERS = {
  students_profile:['serverTs','studentId','studentName','section','nickname','email','createdAt','updatedAt','userAgent','lastSeenAt','extraJson'],
  session_attempts:['serverTs','attemptId','studentId','studentName','section','sessionId','missionId','missionTitle','difficulty','score','stars','mastered','usedTimeSec','timeLeftSec','accuracy','correct','total','wrong','maxCombo','helpUsed','trickCorrect','trickTotal','explainCorrect','explainTotal','bossWin','misconceptionsJson','wrongItemsJson','reflection1','reflection2','reflection3','clientTs','userAgent','pageUrl','version','extraJson'],
  session_events:['serverTs','eventId','attemptId','studentId','section','sessionId','missionId','eventType','phase','itemId','prompt','yourAnswer','correctAnswer','isCorrect','scoreDelta','combo','helpLeft','clientTs','userAgent','pageUrl','extraJson'],
  teacher_summary:['serverTs','section','sessionId','missionId','totalStudents','totalAttempts','avgScore','avgAccuracy','masteryCount','mostCommonMisconception','avgHelpUsed','updatedAt','extraJson']
};
function doGet(e){
  const p=(e&&e.parameter)||{}; const action=p.action||p.api||'health';
  if(action==='health') return jsonOut({ok:true,service:'CSAI2102_AIQuest_Logger',version:APP_VERSION,serverTs:bangkokIsoNow()});
  if(action==='setup'){setupSheets();return jsonOut({ok:true,action:'setup',serverTs:bangkokIsoNow()});}
  if(action==='summary'){updateTeacherSummary();return jsonOut({ok:true,action:'summary',serverTs:bangkokIsoNow()});}
  return jsonOut({ok:true,action,message:'GET endpoint ready',serverTs:bangkokIsoNow()});
}
function doPost(e){
  try{
    const payload=parsePayload_(e); const type=payload.type||payload.eventType||payload.api||''; setupSheets();
    if(type==='profile'){upsertProfile_(payload.profile||payload);return jsonOut({ok:true,type:'profile',serverTs:bangkokIsoNow()});}
    if(type==='attempt'||type==='session_end'){appendAttempt_(payload.attempt||payload); safeAppendEvents_(payload.events||[]); updateTeacherSummary(); return jsonOut({ok:true,type:'attempt',serverTs:bangkokIsoNow()});}
    if(type==='event'){appendEvent_(payload.event||payload);return jsonOut({ok:true,type:'event',serverTs:bangkokIsoNow()});}
    if(type==='batch'){
      const profiles=payload.profiles||[], attempts=payload.attempts||[], events=payload.events||[];
      profiles.forEach(p=>upsertProfile_(p)); attempts.forEach(a=>appendAttempt_(a)); safeAppendEvents_(events); updateTeacherSummary();
      return jsonOut({ok:true,type:'batch',profiles:profiles.length,attempts:attempts.length,events:events.length,serverTs:bangkokIsoNow()});
    }
    return jsonOut({ok:false,error:'Unknown type',receivedType:type,serverTs:bangkokIsoNow()});
  }catch(err){return jsonOut({ok:false,error:String(err&&err.message||err),stack:String(err&&err.stack||''),serverTs:bangkokIsoNow()});}
}
function setupSheets(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HEADERS).forEach(name=>{let sh=ss.getSheetByName(name); if(!sh) sh=ss.insertSheet(name); const headers=HEADERS[name]; const existing=sh.getRange(1,1,1,Math.max(headers.length,sh.getLastColumn()||headers.length)).getValues()[0]; if(existing.slice(0,headers.length).join('|')!==headers.join('|')){sh.clear(); sh.getRange(1,1,1,headers.length).setValues([headers]); sh.setFrozenRows(1); sh.autoResizeColumns(1,headers.length);}});
}
function parsePayload_(e){
  if(!e||!e.postData||!e.postData.contents) return {}; const text=e.postData.contents; const ct=(e.postData.type||'').toLowerCase();
  if(ct.indexOf('application/json')>=0||looksLikeJson_(text)) return JSON.parse(text);
  const params=e.parameter||{}; if(params.payload) return JSON.parse(params.payload); return params;
}
function looksLikeJson_(text){const t=String(text||'').trim(); return (t.startsWith('{')&&t.endsWith('}'))||(t.startsWith('[')&&t.endsWith(']'));}
function upsertProfile_(profile){
  const sh=getSheet_(SHEETS.profiles), headers=HEADERS.students_profile, studentId=clean_(profile.studentId||profile.id||''); if(!studentId) throw new Error('studentId is required');
  const values=sh.getDataRange().getValues(); let rowIndex=-1; for(let i=1;i<values.length;i++){if(String(values[i][headers.indexOf('studentId')])===studentId){rowIndex=i+1;break;}}
  const now=bangkokIsoNow(); const row=[now,studentId,clean_(profile.studentName||profile.name||''),clean_(profile.section||''),clean_(profile.nickname||''),clean_(profile.email||''),clean_(profile.createdAt||now),now,clean_(profile.userAgent||''),now,stringify_(profile.extra||profile.extraJson||{})];
  if(rowIndex>0) sh.getRange(rowIndex,1,1,row.length).setValues([row]); else sh.appendRow(row);
}
function appendAttempt_(a){
  const sh=getSheet_(SHEETS.attempts), now=bangkokIsoNow();
  sh.appendRow([now,clean_(a.attemptId||makeId_('att')),clean_(a.studentId||''),clean_(a.studentName||''),clean_(a.section||''),clean_(a.sessionId||'s1'),clean_(a.missionId||'m1'),clean_(a.missionTitle||'AI Awakening'),clean_(a.difficulty||''),num_(a.score),num_(a.stars),bool_(a.mastered),num_(a.usedTimeSec),num_(a.timeLeftSec),num_(a.accuracy),num_(a.correct),num_(a.total),num_(a.wrong),num_(a.maxCombo),num_(a.helpUsed),num_(a.trickCorrect),num_(a.trickTotal),num_(a.explainCorrect),num_(a.explainTotal),bool_(a.bossWin),stringify_(a.misconceptions||a.misconceptionsJson||{}),stringify_(a.wrongItems||a.wrongItemsJson||[]),clean_(a.reflection1||''),clean_(a.reflection2||''),clean_(a.reflection3||''),clean_(a.clientTs||''),clean_(a.userAgent||''),clean_(a.pageUrl||''),clean_(a.version||APP_VERSION),stringify_(a.extra||a.extraJson||{})]);
}
function appendEvent_(e){
  const sh=getSheet_(SHEETS.events), now=bangkokIsoNow();
  sh.appendRow([now,clean_(e.eventId||makeId_('evt')),clean_(e.attemptId||''),clean_(e.studentId||''),clean_(e.section||''),clean_(e.sessionId||'s1'),clean_(e.missionId||'m1'),clean_(e.eventType||''),clean_(e.phase||''),clean_(e.itemId||''),clean_(e.prompt||''),clean_(e.yourAnswer||''),clean_(e.correctAnswer||''),bool_(e.isCorrect),num_(e.scoreDelta),num_(e.combo),num_(e.helpLeft),clean_(e.clientTs||''),clean_(e.userAgent||''),clean_(e.pageUrl||''),stringify_(e.extra||e.extraJson||{})]);
}
function safeAppendEvents_(events){if(!Array.isArray(events))return; events.slice(0,100).forEach(evt=>appendEvent_(evt));}
function updateTeacherSummary(){
  const ss=SpreadsheetApp.getActiveSpreadsheet(), aSh=ss.getSheetByName(SHEETS.attempts), sSh=ss.getSheetByName(SHEETS.summary); if(!aSh||!sSh) return; const data=aSh.getDataRange().getValues(); if(data.length<=1)return;
  const h=HEADERS.session_attempts, idx=n=>h.indexOf(n), groups={};
  for(let i=1;i<data.length;i++){const r=data[i], section=String(r[idx('section')]||'UNKNOWN'), sessionId=String(r[idx('sessionId')]||'s1'), missionId=String(r[idx('missionId')]||'m1'), key=[section,sessionId,missionId].join('|'); if(!groups[key]) groups[key]={section,sessionId,missionId,students:{},attempts:0,scoreSum:0,accSum:0,helpSum:0,masteryCount:0,mis:{}}; const g=groups[key], sid=String(r[idx('studentId')]||''); if(sid)g.students[sid]=true; g.attempts++; g.scoreSum+=Number(r[idx('score')]||0); g.accSum+=Number(r[idx('accuracy')]||0); g.helpSum+=Number(r[idx('helpUsed')]||0); if(String(r[idx('mastered')]).toUpperCase()==='TRUE') g.masteryCount++; try{const mis=JSON.parse(r[idx('misconceptionsJson')]||'{}'); Object.keys(mis).forEach(k=>g.mis[k]=(g.mis[k]||0)+Number(mis[k]||0));}catch(e){} }
  sSh.clear(); sSh.getRange(1,1,1,HEADERS.teacher_summary.length).setValues([HEADERS.teacher_summary]); sSh.setFrozenRows(1); const now=bangkokIsoNow(); const rows=Object.values(groups).map(g=>[now,g.section,g.sessionId,g.missionId,Object.keys(g.students).length,g.attempts,round2_(g.scoreSum/Math.max(1,g.attempts)),round2_(g.accSum/Math.max(1,g.attempts)),g.masteryCount,mostCommon_(g.mis),round2_(g.helpSum/Math.max(1,g.attempts)),now,stringify_({misconceptions:g.mis})]); if(rows.length){sSh.getRange(2,1,rows.length,HEADERS.teacher_summary.length).setValues(rows); sSh.autoResizeColumns(1,HEADERS.teacher_summary.length);}
}
function getSheet_(name){const ss=SpreadsheetApp.getActiveSpreadsheet(); let sh=ss.getSheetByName(name); if(!sh) sh=ss.insertSheet(name); return sh;}
function jsonOut(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
function bangkokIsoNow(){return Utilities.formatDate(new Date(),TZ,"yyyy-MM-dd'T'HH:mm:ssXXX");}
function makeId_(prefix){return prefix+'_'+Utilities.getUuid().replace(/-/g,'').slice(0,18);}
function clean_(v){return String(v==null?'':v).slice(0,5000);}
function stringify_(v){if(typeof v==='string') return v.slice(0,45000); return JSON.stringify(v==null?{}:v).slice(0,45000);}
function num_(v){const n=Number(v); return Number.isFinite(n)?n:0;}
function bool_(v){return v===true||String(v).toLowerCase()==='true';}
function round2_(n){return Math.round(Number(n||0)*100)/100;}
function mostCommon_(obj){const e=Object.entries(obj||{}).sort((a,b)=>Number(b[1])-Number(a[1])); return e.length?e[0][0]+':'+e[0][1]:'';}


/**
 * PATCH v2.0/v2.1 helper idea:
 * หากต้องการให้ Teacher Dashboard ดึงข้อมูลตรงจาก Apps Script ในอนาคต
 * ให้เพิ่ม action=readAttempts / readEvents แล้ว return JSON
 * ตอนนี้ dashboard ใช้ CSV paste/export เพื่อเลี่ยง CORS และ deploy complexity
 */
function aiquestDashboardReadme_() {
  return {
    version: 'v2.1-classroom-ready-preview',
    mode: 'CSV-first dashboard',
    tabs: ['students_profile','session_attempts','session_events','teacher_summary']
  };
}


/* ============================================================
   AI QUEST PATCH v2.3: sync_v23 router
   ใช้ร่วมกับ aiquest-sync-v23.js
   ============================================================ */

function aiquest_v23_parse_(e) {
  var text = '';
  try {
    text = e && e.postData && e.postData.contents ? e.postData.contents : '';
    return text ? JSON.parse(text) : {};
  } catch (err) {
    return {};
  }
}

function aiquest_v23_output_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj || {}))
    .setMimeType(ContentService.MimeType.JSON);
}

function aiquest_v23_ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  return sh;
}

function aiquest_v23_sync_(kind, payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (kind === 'profile') {
    var shP = aiquest_v23_ensureSheet_(ss, 'students_profile', [
      'serverTs','schemaVersion','profileId','studentId','studentName','section','courseId','classId','term','teacherId','consent','createdAt','updatedAt','rawJson'
    ]);
    shP.appendRow([
      new Date(), payload.schemaVersion || '', payload.profileId || '', payload.studentId || '', payload.studentName || '',
      payload.section || '', payload.courseId || '', payload.classId || '', payload.term || '', payload.teacherId || '',
      payload.consent === true, payload.createdAt || '', payload.updatedAt || '', JSON.stringify(payload)
    ]);
    return {ok:true, kind:kind};
  }

  if (kind === 'attempt') {
    var shA = aiquest_v23_ensureSheet_(ss, 'session_attempts', [
      'serverTs','schemaVersion','attemptId','studentId','studentName','section','courseId','classId','term','teacherId',
      'sessionId','missionId','runMode','submitStatus','score','accuracy','stars','gateStatus','gatePath','bossWin',
      'explainCorrect','trickCorrect','helpUsed','startedAt','submittedAt','clientTs','reflection1','reflection2','reflection3',
      'bestAttemptPolicy','isPractice','isGraded','pageUrl','userAgent','rawJson'
    ]);
    shA.appendRow([
      new Date(), payload.schemaVersion || '', payload.attemptId || '', payload.studentId || '', payload.studentName || '', payload.section || '',
      payload.courseId || '', payload.classId || '', payload.term || '', payload.teacherId || '', payload.sessionId || '', payload.missionId || '',
      payload.runMode || '', payload.submitStatus || '', payload.score || 0, payload.accuracy || 0, payload.stars || 0, payload.gateStatus || '',
      payload.gatePath || '', payload.bossWin === true, payload.explainCorrect || 0, payload.trickCorrect || 0, payload.helpUsed || 0,
      payload.startedAt || '', payload.submittedAt || '', payload.clientTs || '', payload.reflection1 || '', payload.reflection2 || '', payload.reflection3 || '',
      payload.bestAttemptPolicy || '', payload.isPractice === true, payload.isGraded === true, payload.pageUrl || '', payload.userAgent || '', JSON.stringify(payload)
    ]);
    aiquest_v23_updateTeacherSummary_(ss, payload);
    return {ok:true, kind:kind};
  }

  if (kind === 'event') {
    var shE = aiquest_v23_ensureSheet_(ss, 'session_events', [
      'serverTs','schemaVersion','eventId','attemptId','studentId','section','courseId','classId','term','sessionId','missionId','runMode',
      'eventType','phase','itemId','prompt','yourAnswer','correctAnswer','isCorrect','confidence','misconception','helpType',
      'scoreDelta','combo','helpLeft','clientTs','pageUrl','userAgent','extraJson'
    ]);
    shE.appendRow([
      new Date(), payload.schemaVersion || '', payload.eventId || '', payload.attemptId || '', payload.studentId || '', payload.section || '',
      payload.courseId || '', payload.classId || '', payload.term || '', payload.sessionId || '', payload.missionId || '', payload.runMode || '',
      payload.eventType || '', payload.phase || '', payload.itemId || '', payload.prompt || '', payload.yourAnswer || '', payload.correctAnswer || '',
      payload.isCorrect, payload.confidence || '', payload.misconception || '', payload.helpType || '', payload.scoreDelta || 0,
      payload.combo || 0, payload.helpLeft || 0, payload.clientTs || '', payload.pageUrl || '', payload.userAgent || '', payload.extraJson || ''
    ]);
    return {ok:true, kind:kind};
  }

  if (kind === 'progress') {
    var shG = aiquest_v23_ensureSheet_(ss, 'mission_progress', [
      'serverTs','schemaVersion','progressId','studentId','courseId','classId','term','sessionId','missionId','status','stars','bestScore','unlocked','updatedAt','rawJson'
    ]);
    shG.appendRow([
      new Date(), payload.schemaVersion || '', payload.progressId || '', payload.studentId || '', payload.courseId || '', payload.classId || '',
      payload.term || '', payload.sessionId || '', payload.missionId || '', payload.status || '', payload.stars || 0, payload.bestScore || 0,
      payload.unlocked === true, payload.updatedAt || '', JSON.stringify(payload)
    ]);
    return {ok:true, kind:kind};
  }

  return {ok:false, error:'unknown kind: ' + kind};
}

function aiquest_v23_updateTeacherSummary_(ss, payload) {
  var sh = aiquest_v23_ensureSheet_(ss, 'teacher_summary', [
    'serverTs','courseId','classId','term','section','studentId','studentName','sessionId','missionId','bestScore','latestScore','attemptId','gateStatus','gatePath','runMode','updatedAt'
  ]);
  sh.appendRow([
    new Date(), payload.courseId || '', payload.classId || '', payload.term || '', payload.section || '', payload.studentId || '', payload.studentName || '',
    payload.sessionId || '', payload.missionId || '', payload.score || 0, payload.score || 0, payload.attemptId || '', payload.gateStatus || '',
    payload.gatePath || '', payload.runMode || '', new Date()
  ]);
}

/*
  วิธีใช้:
  ใน doPost(e) เดิม ให้เพิ่ม:
  var body = aiquest_v23_parse_(e);
  if (body.action === 'sync_v23') return aiquest_v23_output_(aiquest_v23_sync_(body.kind, body.payload || {}));
*/
