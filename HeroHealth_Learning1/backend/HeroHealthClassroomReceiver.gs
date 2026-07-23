/**
 * HeroHealth Classroom Receiver + Live Teacher Dashboard API
 * Version: 2026-07-23-PRODUCTION-V2-LIVE
 *
 * Bound to the target Google Sheet.
 * Deploy as Web App: Execute as Me / Anyone.
 */
const HH_VERSION = '2026-07-23-PRODUCTION-V2-LIVE';
const HH_SHEETS = {
  profiles: 'HH_Profiles', assessments: 'HH_Assessments', assessmentItems: 'HH_Assessment_Items',
  games: 'HH_Game_Results', reflections: 'HH_Reflections', progress: 'HH_Progress',
  live: 'HH_Live_Status', events: 'HH_Events', errors: 'HH_Errors'
};
const HH_HEADERS = {};
HH_HEADERS[HH_SHEETS.profiles] = ['studentId','fullName','section','group','active','firstSeen','lastSeen','platformVersion'];
HH_HEADERS[HH_SHEETS.assessments] = ['serverTs','eventId','studentId','fullName','section','group','assessment','form','score','total','percent','clientTs','payloadJson'];
HH_HEADERS[HH_SHEETS.assessmentItems] = ['serverTs','eventId','studentId','assessment','questionId','selectedOptionIndex','correct','clientTs'];
HH_HEADERS[HH_SHEETS.games] = ['serverTs','eventId','studentId','fullName','section','group','zone','gameId','score','accuracy','passed','completed','finishedAt','payloadJson'];
HH_HEADERS[HH_SHEETS.reflections] = ['serverTs','eventId','studentId','fullName','section','group','understand','best','action','submittedAt','payloadJson'];
HH_HEADERS[HH_SHEETS.progress] = ['serverTs','eventId','studentId','fullName','section','group','progressPct','completedCount','totalSteps','nextStep','missionComplete','clientTs','payloadJson'];
HH_HEADERS[HH_SHEETS.live] = ['studentId','fullName','section','group','currentStep','status','progressPct','completedCount','missionComplete','online','lastSeen','lastEventType','lastEventId'];
HH_HEADERS[HH_SHEETS.events] = ['serverTs','eventId','eventType','studentId','clientTs','payloadJson'];
HH_HEADERS[HH_SHEETS.errors] = ['serverTs','eventId','studentId','message','stack','clientTs','payloadJson'];

function HH_setupSheets() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(HH_HEADERS).forEach(name => ensureSheet_(ss, name, HH_HEADERS[name]));
  return {ok:true, version:HH_VERSION};
}

function doGet(e) {
  const action = String(e && e.parameter && e.parameter.action || 'ping');
  if (action === 'live') return output_(buildLivePayload_(e), e);
  if (action === 'student') return output_(buildStudentPayload_(e), e);
  return output_({ok:true, service:'HeroHealth Classroom Receiver', version:HH_VERSION, ts:new Date().toISOString()}, e);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const payload = parsePayload_(e);
    if (!payload || !payload.eventId || !payload.eventType || !payload.studentId) return json_({ok:false,error:'missing_required_fields'});
    const ss = SpreadsheetApp.getActive();
    HH_setupSheets();
    if (payload.eventType !== 'heartbeat' && isDuplicate_(ss, payload.eventId)) return json_({ok:true,duplicate:true,eventId:payload.eventId});
    route_(ss, payload);
    updateLive_(ss, payload);
    if (payload.eventType !== 'heartbeat') append_(ss, HH_SHEETS.events, [new Date(),payload.eventId,payload.eventType,payload.studentId,payload.clientTs||'',JSON.stringify(payload)]);
    return json_({ok:true,eventId:payload.eventId,version:HH_VERSION});
  } catch (err) {
    try { append_(SpreadsheetApp.getActive(), HH_SHEETS.errors, [new Date(),'','',String(err&&err.message||err),String(err&&err.stack||''),'','']); } catch (_) {}
    return json_({ok:false,error:String(err&&err.message||err)});
  } finally { try { lock.releaseLock(); } catch (_) {} }
}

function route_(ss,p) {
  const profile=p.profile||{};
  const common=[p.eventId,p.studentId,profile.fullName||p.fullName||'',profile.section||p.section||'',profile.group||p.group||''];
  if(p.eventType==='profile'){ upsertProfile_(ss,p); return; }
  if(p.eventType==='assessment'){
    const a=p.assessment||{};
    append_(ss,HH_SHEETS.assessments,[new Date()].concat(common,[a.type||'',a.form||'',Number(a.score)||0,Number(a.total)||0,Number(a.total)?Math.round(Number(a.score)*10000/Number(a.total))/100:0,p.clientTs||'',JSON.stringify(p)]));
    (Array.isArray(a.responses)?a.responses:[]).forEach(r=>append_(ss,HH_SHEETS.assessmentItems,[new Date(),p.eventId,p.studentId,a.type||'',r.questionId||'',r.selectedOptionIndex==null?'':r.selectedOptionIndex,r.correct===true,p.clientTs||'']));
    return;
  }
  if(p.eventType==='game'){
    const g=p.game||{};
    append_(ss,HH_SHEETS.games,[new Date()].concat(common,[g.zone||'',g.gameId||'',Number(g.score)||0,Number(g.accuracy)||0,g.passed===true,g.completed===true,g.finishedAt||p.clientTs||'',JSON.stringify(p)])); return;
  }
  if(p.eventType==='reflection'){
    const r=p.reflection||{};
    append_(ss,HH_SHEETS.reflections,[new Date()].concat(common,[Number(r.understand)||0,r.best||'',r.action||'',r.submittedAt||p.clientTs||'',JSON.stringify(p)])); return;
  }
  if(p.eventType==='progress'){
    const x=p.progress||{};
    append_(ss,HH_SHEETS.progress,[new Date()].concat(common,[Number(x.progressPct)||0,Number(x.completedCount)||0,Number(x.totalSteps)||9,x.nextStep||'',x.missionComplete===true,p.clientTs||'',JSON.stringify(p)])); return;
  }
  if(p.eventType==='error') append_(ss,HH_SHEETS.errors,[new Date(),p.eventId,p.studentId,p.message||'',p.stack||'',p.clientTs||'',JSON.stringify(p)]);
}

function upsertProfile_(ss,p){
  const sh=ensureSheet_(ss,HH_SHEETS.profiles,HH_HEADERS[HH_SHEETS.profiles]);
  const profile=p.profile||{}; const sid=String(p.studentId||''); const row=findRow_(sh,1,sid); const now=new Date();
  const values=[sid,profile.fullName||'',profile.section||'',profile.group||'',true,row?sh.getRange(row,6).getValue()||now:now,now,p.platformVersion||''];
  if(row) sh.getRange(row,1,1,values.length).setValues([values]); else sh.appendRow(values);
}

function updateLive_(ss,p){
  const sh=ensureSheet_(ss,HH_SHEETS.live,HH_HEADERS[HH_SHEETS.live]); const sid=String(p.studentId||''); const row=findRow_(sh,1,sid); const profile=p.profile||{};
  let existing={}; if(row){const v=sh.getRange(row,1,1,HH_HEADERS[HH_SHEETS.live].length).getValues()[0]; HH_HEADERS[HH_SHEETS.live].forEach((h,i)=>existing[h]=v[i]);}
  const x=p.progress||{}; const currentStep=p.currentStep||x.nextStep||existing.currentStep||'pretest';
  const status=p.status||(p.eventType==='heartbeat'?'กำลังใช้งาน':p.eventType==='game'?'จบเกม':p.eventType==='assessment'?'ส่งแบบทดสอบ':p.eventType==='reflection'?'ส่ง Reflection':p.eventType==='profile'?'เข้าสู่ระบบ':'อัปเดต');
  const pct=p.progressPct!=null?Number(p.progressPct):(x.progressPct!=null?Number(x.progressPct):Number(existing.progressPct)||0);
  const count=p.completedCount!=null?Number(p.completedCount):(x.completedCount!=null?Number(x.completedCount):Number(existing.completedCount)||0);
  const complete=p.missionComplete===true||x.missionComplete===true||existing.missionComplete===true;
  const values=[sid,profile.fullName||existing.fullName||'',profile.section||existing.section||'',profile.group||existing.group||'',currentStep,status,pct,count,complete,true,new Date(),p.eventType,p.eventId];
  if(row) sh.getRange(row,1,1,values.length).setValues([values]); else sh.appendRow(values);
}

function buildLivePayload_(e){
  const ss=SpreadsheetApp.getActive(); HH_setupSheets(); const sh=ss.getSheetByName(HH_SHEETS.live); const rows=sheetObjects_(sh);
  const section=String(e.parameter.section||'').trim(), group=String(e.parameter.group||'').trim(); const now=Date.now();
  const students=rows.filter(r=>(!section||String(r.section)===section)&&(!group||String(r.group)===group)).map(r=>{
    const t=r.lastSeen instanceof Date?r.lastSeen.getTime():new Date(r.lastSeen).getTime(); const online=Number.isFinite(t)&&(now-t)<=120000;
    return Object.assign({},r,{online:online,lastSeen:r.lastSeen instanceof Date?r.lastSeen.toISOString():String(r.lastSeen||'')});
  });
  const groups={}; students.forEach(s=>{const g=String(s.group||'-'); if(!groups[g])groups[g]={group:g,total:0,online:0,complete:0,pretest:0,playing:0,posttest:0,reflection:0}; const a=groups[g]; a.total++; if(s.online)a.online++; if(s.missionComplete===true||String(s.missionComplete)==='TRUE')a.complete++; const step=String(s.currentStep||''); if(step!=='pretest')a.pretest++; if(step.indexOf(':')>0)a.playing++; if(step==='reflection'||step==='certificate')a.posttest++; if(step==='certificate')a.reflection++;});
  return {ok:true,version:HH_VERSION,generatedAt:new Date().toISOString(),staleAfterSec:120,summary:Object.keys(groups).sort().map(k=>groups[k]),students:students};
}

function buildStudentPayload_(e){
  const sid=String(e.parameter.studentId||'').trim(); if(!sid)return {ok:false,error:'missing_studentId'};
  const ss=SpreadsheetApp.getActive(); const profile=sheetObjects_(ss.getSheetByName(HH_SHEETS.profiles)).find(r=>String(r.studentId)===sid)||null; const live=sheetObjects_(ss.getSheetByName(HH_SHEETS.live)).find(r=>String(r.studentId)===sid)||null;
  return {ok:true,studentId:sid,profile:profile,live:live};
}

function isDuplicate_(ss,eventId){const sh=ss.getSheetByName(HH_SHEETS.events);if(!sh||sh.getLastRow()<2)return false;return !!sh.getRange(2,2,sh.getLastRow()-1,1).createTextFinder(String(eventId)).matchEntireCell(true).findNext();}
function parsePayload_(e){if(!e)return null;if(e.postData&&e.postData.contents){try{return JSON.parse(e.postData.contents)}catch(_){}}if(e.parameter&&e.parameter.payload){try{return JSON.parse(e.parameter.payload)}catch(_){}}return e.parameter||null;}
function ensureSheet_(ss,name,headers){let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);if(sh.getLastRow()===0){sh.getRange(1,1,1,headers.length).setValues([headers]);sh.setFrozenRows(1);sh.getRange(1,1,1,headers.length).setFontWeight('bold');}else if(sh.getLastRow()===1){sh.getRange(1,1,1,headers.length).clearContent().setValues([headers]);}return sh;}
function append_(ss,name,row){ensureSheet_(ss,name,HH_HEADERS[name]||row.map((_,i)=>'col'+(i+1))).appendRow(row);}
function findRow_(sh,col,value){if(!sh||sh.getLastRow()<2)return 0;const f=sh.getRange(2,col,sh.getLastRow()-1,1).createTextFinder(String(value)).matchEntireCell(true).findNext();return f?f.getRow():0;}
function sheetObjects_(sh){if(!sh||sh.getLastRow()<2)return[];const v=sh.getDataRange().getValues(),h=v.shift().map(String);return v.filter(r=>r.some(x=>x!=='' )).map(r=>{const o={};h.forEach((k,i)=>o[k]=r[i]);return o;});}
function output_(obj,e){const cb=String(e&&e.parameter&&e.parameter.callback||'').replace(/[^a-zA-Z0-9_.$]/g,'');if(cb)return ContentService.createTextOutput(cb+'('+JSON.stringify(obj)+');').setMimeType(ContentService.MimeType.JAVASCRIPT);return json_(obj);}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
