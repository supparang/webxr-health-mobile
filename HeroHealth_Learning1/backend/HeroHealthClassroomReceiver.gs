/**
 * HeroHealth Classroom Receiver + Authoritative Resume API
 * Version: 2026-07-23-PRODUCTION-V5-ROTATION-RECONCILE
 *
 * Google Sheet is the sole authority for official progress.
 * - Preserves verified legacy certificate learners.
 * - Recovers legacy pre-test completion only from Sheet-backed Live/Progress evidence.
 * - Computes the next game from the learner's A-J rotation, not a fixed zone order.
 */

const HH_VERSION = '2026-07-23-PRODUCTION-V5-ROTATION-RECONCILE';

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

const HH_ROTATION = {
  A: ['hygiene','nutrition','fitness'],
  B: ['nutrition','fitness','hygiene'],
  C: ['fitness','hygiene','nutrition'],
  D: ['hygiene','fitness','nutrition'],
  E: ['nutrition','hygiene','fitness'],
  F: ['fitness','nutrition','hygiene'],
  G: ['hygiene','nutrition','fitness'],
  H: ['nutrition','fitness','hygiene'],
  I: ['fitness','hygiene','nutrition'],
  J: ['hygiene','fitness','nutrition']
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
  const action = text_(e && e.parameter && e.parameter.action || 'ping');
  if (action === 'live') return output_(buildLivePayload_(e), e);
  if (action === 'student') return output_(buildStudentPayload_(e), e);
  if (action === 'event') return output_(buildEventPayload_(e), e);
  if (action === 'reconcileStudent') return output_(HH_rebuildStudentLive(text_(e.parameter.studentId)), e);
  if (action === 'reconcileAll') return output_(HH_rebuildAllLive(), e);
  return output_({ok:true,service:'HeroHealth Classroom Receiver',version:HH_VERSION,authority:'google_sheet',ts:new Date().toISOString()},e);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const p = parsePayload_(e);
    if (!p || !p.eventId || !p.eventType || !p.studentId) return json_({ok:false,error:'missing_required_fields'});
    p.studentId = cleanStudentId_(p.studentId);
    if (!p.studentId) return json_({ok:false,error:'invalid_studentId'});
    const ss = SpreadsheetApp.getActive();
    HH_setupSheets();
    if (p.eventType !== 'heartbeat' && isDuplicate_(ss,p.eventId)) return json_({ok:true,duplicate:true,eventId:p.eventId,version:HH_VERSION});
    route_(ss,p);
    updateLive_(ss,p);
    if (p.eventType !== 'heartbeat') append_(ss,HH_SHEETS.events,[new Date(),p.eventId,p.eventType,p.studentId,p.clientTs||'',JSON.stringify(p)]);
    return json_({ok:true,eventId:p.eventId,version:HH_VERSION,authority:'google_sheet'});
  } catch (err) {
    try { append_(SpreadsheetApp.getActive(),HH_SHEETS.errors,[new Date(),'','',String(err&&err.message||err),String(err&&err.stack||''),'','']); } catch (_) {}
    return json_({ok:false,error:String(err&&err.message||err)});
  } finally { try { lock.releaseLock(); } catch (_) {} }
}

function route_(ss,p) {
  const profile=p.profile||{};
  const common=[p.eventId,p.studentId,profile.fullName||p.fullName||'',profile.section||p.section||'',profile.group||p.group||''];
  if(p.eventType==='profile'){upsertProfile_(ss,p);return;}
  if(p.eventType==='assessment'){
    const a=p.assessment||{},score=number_(a.score),total=number_(a.total);
    append_(ss,HH_SHEETS.assessments,[new Date()].concat(common,[text_(a.type),text_(a.form),score,total,total?Math.round(score*10000/total)/100:0,p.clientTs||'',JSON.stringify(p)]));
    (Array.isArray(a.responses)?a.responses:[]).forEach(r=>append_(ss,HH_SHEETS.assessmentItems,[new Date(),p.eventId,p.studentId,text_(a.type),text_(r.questionId),r.selectedOptionIndex==null?'':r.selectedOptionIndex,r.correct===true,p.clientTs||'']));
    return;
  }
  if(p.eventType==='game'){
    const g=p.game||{};
    append_(ss,HH_SHEETS.games,[new Date()].concat(common,[text_(g.zone),text_(g.gameId),number_(g.score),number_(g.accuracy),g.passed===true,g.completed===true,g.finishedAt||p.clientTs||'',JSON.stringify(p)]));return;
  }
  if(p.eventType==='reflection'){
    const r=p.reflection||{};
    append_(ss,HH_SHEETS.reflections,[new Date()].concat(common,[number_(r.understand),r.best||'',r.action||'',r.submittedAt||p.clientTs||'',JSON.stringify(p)]));return;
  }
  if(p.eventType==='progress'){
    const x=p.progress||{};
    append_(ss,HH_SHEETS.progress,[new Date()].concat(common,[number_(x.progressPct),number_(x.completedCount),number_(x.totalSteps)||9,text_(x.nextStep),x.missionComplete===true,p.clientTs||'',JSON.stringify(p)]));return;
  }
  if(p.eventType==='error') append_(ss,HH_SHEETS.errors,[new Date(),p.eventId,p.studentId,p.message||'',p.stack||'',p.clientTs||'',JSON.stringify(p)]);
}

function upsertProfile_(ss,p){
  const sh=ensureSheet_(ss,HH_SHEETS.profiles,HH_HEADERS[HH_SHEETS.profiles]),profile=p.profile||{},sid=cleanStudentId_(p.studentId),row=findRow_(sh,1,sid),now=new Date();
  const values=[sid,profile.fullName||'',profile.section||'',profile.group||'',true,row?sh.getRange(row,6).getValue()||now:now,now,p.platformVersion||''];
  if(row)sh.getRange(row,1,1,values.length).setValues([values]);else sh.appendRow(values);
}

function updateLive_(ss,p){
  const sh=ensureSheet_(ss,HH_SHEETS.live,HH_HEADERS[HH_SHEETS.live]),sid=cleanStudentId_(p.studentId),row=findRow_(sh,1,sid),profile=p.profile||{};
  let old={};if(row){const v=sh.getRange(row,1,1,HH_HEADERS[HH_SHEETS.live].length).getValues()[0];HH_HEADERS[HH_SHEETS.live].forEach((h,i)=>old[h]=v[i]);}
  const x=p.progress||{},step=p.currentStep||x.nextStep||old.currentStep||'pretest';
  const status=p.status||(p.eventType==='heartbeat'?'กำลังใช้งาน':p.eventType==='game'?'จบเกม':p.eventType==='assessment'?'ส่งแบบทดสอบ':p.eventType==='reflection'?'ส่ง Reflection':p.eventType==='profile'?'เข้าสู่ระบบ':'อัปเดต');
  const pct=p.progressPct!=null?number_(p.progressPct):x.progressPct!=null?number_(x.progressPct):number_(old.progressPct);
  const count=p.completedCount!=null?number_(p.completedCount):x.completedCount!=null?number_(x.completedCount):number_(old.completedCount);
  const complete=p.missionComplete===true||x.missionComplete===true||bool_(old.missionComplete);
  const values=[sid,profile.fullName||old.fullName||'',profile.section||old.section||'',profile.group||old.group||'',step,status,pct,count,complete,true,new Date(),p.eventType,p.eventId];
  if(row)sh.getRange(row,1,1,values.length).setValues([values]);else sh.appendRow(values);
}

function buildStudentPayload_(e){
  const sid=cleanStudentId_(e&&e.parameter&&e.parameter.studentId);
  if(!sid)return{ok:false,error:'missing_studentId'};
  return buildStudentAuthority_(SpreadsheetApp.getActive(),sid);
}

function buildStudentAuthority_(ss,sid){
  HH_setupSheets();
  const profiles=rowsForStudent_(ss.getSheetByName(HH_SHEETS.profiles),sid);
  const assessments=rowsForStudent_(ss.getSheetByName(HH_SHEETS.assessments),sid);
  const games=rowsForStudent_(ss.getSheetByName(HH_SHEETS.games),sid);
  const reflections=rowsForStudent_(ss.getSheetByName(HH_SHEETS.reflections),sid);
  const progresses=rowsForStudent_(ss.getSheetByName(HH_SHEETS.progress),sid);
  const lives=rowsForStudent_(ss.getSheetByName(HH_SHEETS.live),sid);
  const profile=latestBy_(profiles,'lastSeen'),live=latestBy_(lives,'lastSeen'),latestProgress=latestBy_(progresses,'serverTs');
  const pre=latestMatching_(assessments,r=>normalizeAssessment_(r.assessment)==='pretest');
  const post=latestMatching_(assessments,r=>normalizeAssessment_(r.assessment)==='posttest');
  const legacyVerified=isLegacyCertificate_(live);
  const legacyPretestVerified=!pre&&isLegacyPretest_(live,latestProgress,games);
  const completed={pretest:!!pre||legacyPretestVerified,hygiene:false,nutrition:false,fitness:false,posttest:!!post,reflection:reflections.length>0};
  const gameCompleted={hygiene:{},nutrition:{},fitness:{}},gameScores={},gameResults={};
  Object.keys(HH_GAME_CATALOG).forEach(zone=>{
    HH_GAME_CATALOG[zone].forEach(gameId=>{
      const rows=games.filter(r=>normalizeZone_(r.zone)===zone&&normalizeGameId_(r.gameId)===gameId),latest=latestBy_(rows,'serverTs'),done=rows.some(r=>bool_(r.completed));
      gameCompleted[zone][gameId]=done;
      if(latest){const key=zone+':'+gameId;gameScores[key]=number_(latest.score);gameResults[key]={zone,gameId,score:number_(latest.score),accuracy:number_(latest.accuracy),passed:bool_(latest.passed),completed:done,finishedAt:iso_(latest.finishedAt||latest.serverTs),eventId:text_(latest.eventId)};}
    });
    completed[zone]=HH_GAME_CATALOG[zone].every(id=>gameCompleted[zone][id]===true);
  });
  if(legacyVerified){
    completed.pretest=completed.hygiene=completed.nutrition=completed.fitness=completed.posttest=completed.reflection=true;
    Object.keys(HH_GAME_CATALOG).forEach(z=>HH_GAME_CATALOG[z].forEach(g=>gameCompleted[z][g]=true));
  }
  const group=text_(profile&&profile.group||live&&live.group).toUpperCase();
  const evidenceCount=legacyVerified?9:(completed.pretest?1:0)+countGames_(gameCompleted)+(completed.posttest?1:0)+(completed.reflection?1:0);
  const nextStep=legacyVerified?'certificate':authoritativeNextStep_(completed,gameCompleted,live,latestProgress,group);
  const reflection=latestBy_(reflections,'serverTs');
  const state={
    profile:profile?{studentId:sid,fullName:text_(profile.fullName),section:text_(profile.section),group:text_(profile.group)}:null,
    group,completed,scores:{pretest:pre?number_(pre.score):undefined,posttest:post?number_(post.score):undefined},gameCompleted,gameScores,gameResults,
    reflection:reflection?{understand:number_(reflection.understand),best:text_(reflection.best),action:text_(reflection.action),submittedAt:iso_(reflection.submittedAt||reflection.serverTs)}:null,
    progress:{progressPct:Math.round(evidenceCount*100/9),completedCount:evidenceCount,totalSteps:9,nextStep,missionComplete:evidenceCount===9},
    sheetAuthority:true,legacyVerified,legacyPretestVerified,legacySource:legacyVerified?'HH_Live_Status':legacyPretestVerified?'HH_Live_Status/HH_Progress':''
  };
  return{ok:true,version:HH_VERSION,authority:'google_sheet',studentId:sid,found:!!(profile||assessments.length||games.length||reflections.length||progresses.length||live),legacyVerified,legacyPretestVerified,profile:state.profile,live:live?normalizeLive_(live):null,completed,scores:state.scores,gameCompleted,gameScores,gameResults,reflection:state.reflection,progress:state.progress,authoritativeState:state,evidence:{assessments:assessments.length,games:games.length,reflections:reflections.length,progressRows:progresses.length,pretestEventId:pre?text_(pre.eventId):'',posttestEventId:post?text_(post.eventId):''},generatedAt:new Date().toISOString()};
}

function isLegacyCertificate_(live){return !!live&&text_(live.currentStep)==='certificate'&&bool_(live.missionComplete)&&number_(live.completedCount)>=9&&number_(live.progressPct)>=100;}
function isLegacyPretest_(live,p,games){
  if(!live&&!p)return false;
  const liveStep=text_(live&&live.currentStep),progressStep=text_(p&&p.nextStep);
  const liveEvidence=number_(live&&live.completedCount)>=1&&number_(live&&live.progressPct)>=11&&liveStep&&liveStep!=='pretest';
  const progressEvidence=number_(p&&p.completedCount)>=1&&number_(p&&p.progressPct)>=11&&progressStep&&progressStep!=='pretest';
  const gameEvidence=Array.isArray(games)&&games.some(r=>bool_(r.completed));
  return liveEvidence||progressEvidence||gameEvidence;
}
function countGames_(g){let n=0;Object.keys(HH_GAME_CATALOG).forEach(z=>HH_GAME_CATALOG[z].forEach(id=>{if(g[z][id]===true)n++;}));return n;}
function rotationOrder_(group){return HH_ROTATION[text_(group).toUpperCase()]||HH_ROTATION.A;}
function authoritativeNextStep_(c,g,live,p,group){
  if(!c.pretest)return'pretest';
  const sheetNext=text_(p&&p.nextStep||live&&live.currentStep);
  if(sheetNext&&!isStepCompleted_(sheetNext,c,g))return sheetNext;
  const order=[];
  rotationOrder_(group).forEach(zone=>HH_GAME_CATALOG[zone].forEach(gameId=>order.push(zone+':'+gameId)));
  for(let i=0;i<order.length;i++)if(!isStepCompleted_(order[i],c,g))return order[i];
  if(!c.posttest)return'posttest';if(!c.reflection)return'reflection';return'certificate';
}
function isStepCompleted_(step,c,g){const v=text_(step);if(['pretest','posttest','reflection'].includes(v))return c[v]===true;if(v==='certificate')return c.pretest&&c.hygiene&&c.nutrition&&c.fitness&&c.posttest&&c.reflection;const p=v.split(':');return p.length===2&&!!(g[normalizeZone_(p[0])]&&g[normalizeZone_(p[0])][normalizeGameId_(p[1])]===true);}

function HH_rebuildStudentLive(studentId){
  const sid=cleanStudentId_(studentId);if(!sid)return{ok:false,error:'missing_studentId'};
  const ss=SpreadsheetApp.getActive(),api=buildStudentAuthority_(ss,sid),s=api.authoritativeState,p=s.profile||{},liveSh=ensureSheet_(ss,HH_SHEETS.live,HH_HEADERS[HH_SHEETS.live]),row=findRow_(liveSh,1,sid),old=api.live||{};
  const values=[sid,p.fullName||old.fullName||'',p.section||old.section||'',p.group||old.group||'',s.progress.nextStep,s.legacyVerified?'Legacy certificate verified':s.legacyPretestVerified?'Legacy pre-test reconciled':'Reconciled from Sheet evidence',s.progress.progressPct,s.progress.completedCount,s.progress.missionComplete,false,new Date(),'reconcile','HH-RECONCILE-'+sid+'-'+Date.now()];
  if(row)liveSh.getRange(row,1,1,values.length).setValues([values]);else liveSh.appendRow(values);
  return{ok:true,studentId:sid,legacyVerified:s.legacyVerified,legacyPretestVerified:s.legacyPretestVerified,progress:s.progress,version:HH_VERSION};
}
function HH_rebuildAllLive(){
  const ss=SpreadsheetApp.getActive(),ids={};
  [HH_SHEETS.profiles,HH_SHEETS.assessments,HH_SHEETS.games,HH_SHEETS.reflections,HH_SHEETS.progress,HH_SHEETS.live].forEach(name=>sheetObjects_(ss.getSheetByName(name)).forEach(r=>{const id=cleanStudentId_(r.studentId);if(id)ids[id]=true;}));
  const results=Object.keys(ids).sort().map(id=>HH_rebuildStudentLive(id));
  return{ok:true,count:results.length,results,version:HH_VERSION};
}

function buildEventPayload_(e){const eventId=text_(e&&e.parameter&&e.parameter.eventId);if(!eventId)return{ok:false,error:'missing_eventId'};const sh=SpreadsheetApp.getActive().getSheetByName(HH_SHEETS.events),row=sheetObjects_(sh).find(r=>text_(r.eventId)===eventId);return{ok:true,eventId,found:!!row,event:row||null,version:HH_VERSION};}

function buildLivePayload_(e){
  const ss=SpreadsheetApp.getActive();HH_setupSheets();const rows=sheetObjects_(ss.getSheetByName(HH_SHEETS.live)),section=text_(e&&e.parameter&&e.parameter.section),group=text_(e&&e.parameter&&e.parameter.group),now=Date.now();
  const students=rows.filter(r=>(!section||text_(r.section)===section)&&(!group||text_(r.group)===group)).map(r=>Object.assign({},r,{online:Number.isFinite(dateMs_(r.lastSeen))&&(now-dateMs_(r.lastSeen)<=120000),lastSeen:iso_(r.lastSeen)}));
  const groups={};students.forEach(s=>{const g=text_(s.group)||'-';if(!groups[g])groups[g]={group:g,total:0,online:0,complete:0,pretest:0,playing:0,posttest:0,reflection:0};const a=groups[g];a.total++;if(s.online)a.online++;if(bool_(s.missionComplete))a.complete++;const step=text_(s.currentStep);if(step!=='pretest')a.pretest++;if(step.indexOf(':')>0)a.playing++;if(step==='reflection'||step==='certificate')a.posttest++;if(step==='certificate')a.reflection++;});
  return{ok:true,version:HH_VERSION,authority:'google_sheet',generatedAt:new Date().toISOString(),staleAfterSec:120,summary:Object.keys(groups).sort().map(k=>groups[k]),students};
}

function normalizeLive_(r){return{studentId:cleanStudentId_(r.studentId),fullName:text_(r.fullName),section:text_(r.section),group:text_(r.group),currentStep:text_(r.currentStep),status:text_(r.status),progressPct:number_(r.progressPct),completedCount:number_(r.completedCount),missionComplete:bool_(r.missionComplete),online:bool_(r.online),lastSeen:iso_(r.lastSeen),lastEventType:text_(r.lastEventType),lastEventId:text_(r.lastEventId)};}
function normalizeAssessment_(v){v=text_(v).toLowerCase().replace(/[\s_-]+/g,'');return v==='pre'||v==='pretest'?'pretest':v==='post'||v==='posttest'?'posttest':v;}
function normalizeZone_(v){v=text_(v).toLowerCase().replace(/[\s_]+/g,'-');if(v.indexOf('hyg')===0)return'hygiene';if(v.indexOf('nut')===0)return'nutrition';if(v.indexOf('fit')===0)return'fitness';return v;}
function normalizeGameId_(v){v=text_(v).toLowerCase().replace(/[\s_]+/g,'-');if(v==='hand-wash'||v==='handwashing')return'handwash';if(v==='tooth-brush'||v==='toothbrushing')return'toothbrush';if(v==='food-groups'||v==='foodgroups')return'groups';if(v==='good-junk'||v==='goodjunk-ar')return'goodjunk';if(v==='jump-duck'||v==='jumpduck-ar')return'jumpduck';if(v==='balancehold'||v==='balance-hold-ar')return'balance-hold';return v;}
function latestMatching_(rows,p){return latestBy_(rows.filter(p),'serverTs');}
function latestBy_(rows,field){if(!rows||!rows.length)return null;return rows.slice().sort((a,b)=>dateMs_(b[field])-dateMs_(a[field]))[0]||null;}
function rowsForStudent_(sh,sid){return sheetObjects_(sh).filter(r=>cleanStudentId_(r.studentId)===sid);}
function isDuplicate_(ss,eventId){const sh=ss.getSheetByName(HH_SHEETS.events);if(!sh||sh.getLastRow()<2)return false;return!!sh.getRange(2,2,sh.getLastRow()-1,1).createTextFinder(String(eventId)).matchEntireCell(true).findNext();}
function parsePayload_(e){if(!e)return null;if(e.postData&&e.postData.contents){try{return JSON.parse(e.postData.contents)}catch(_){}}if(e.parameter&&e.parameter.payload){try{return JSON.parse(e.parameter.payload)}catch(_){}}return e.parameter||null;}
function ensureSheet_(ss,name,headers){let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);if(sh.getLastRow()===0){sh.getRange(1,1,1,headers.length).setValues([headers]);sh.setFrozenRows(1);sh.getRange(1,1,1,headers.length).setFontWeight('bold');}else if(sh.getLastRow()===1){const current=sh.getRange(1,1,1,headers.length).getValues()[0].map(String);if(headers.some((h,i)=>current[i]!==h))sh.getRange(1,1,1,headers.length).clearContent().setValues([headers]);}return sh;}
function append_(ss,name,row){ensureSheet_(ss,name,HH_HEADERS[name]||row.map((_,i)=>'col'+(i+1))).appendRow(row);}
function findRow_(sh,col,value){if(!sh||sh.getLastRow()<2)return 0;const f=sh.getRange(2,col,sh.getLastRow()-1,1).createTextFinder(String(value)).matchEntireCell(true).findNext();return f?f.getRow():0;}
function sheetObjects_(sh){if(!sh||sh.getLastRow()<2)return[];const v=sh.getDataRange().getValues(),h=v.shift().map(String);return v.filter(r=>r.some(x=>x!=='' )).map(r=>{const o={};h.forEach((k,i)=>o[k]=r[i]);return o;});}
function cleanStudentId_(v){return String(v==null?'':v).trim().replace(/\s+/g,'');}
function text_(v){return String(v==null?'':v).trim();}
function number_(v){const n=Number(v);return Number.isFinite(n)?n:0;}
function bool_(v){return v===true||v===1||String(v).toUpperCase()==='TRUE'||String(v)==='1';}
function dateMs_(v){if(v instanceof Date)return v.getTime();const t=new Date(v).getTime();return Number.isFinite(t)?t:0;}
function iso_(v){if(!v)return'';const d=v instanceof Date?v:new Date(v);return Number.isFinite(d.getTime())?d.toISOString():String(v);}
function output_(obj,e){const cb=String(e&&e.parameter&&e.parameter.callback||'').replace(/[^a-zA-Z0-9_.$]/g,'');if(cb)return ContentService.createTextOutput(cb+'('+JSON.stringify(obj)+');').setMimeType(ContentService.MimeType.JAVASCRIPT);return json_(obj);}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
