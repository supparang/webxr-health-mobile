/**
 * HeroHealth Classroom Receiver V8 • Unified Learning Analytics
 * Google Sheet is the sole authority.
 *
 * Core sheets:
 * HH_Profiles, HH_Assessments, HH_Assessment_Items, HH_Game_Results,
 * HH_Reflections, HH_Progress, HH_Live_Status, HH_Events, HH_Errors
 *
 * Research-ready sheets:
 * HH_Game_Summary      one standardized row per completed game
 * HH_Game_Metrics      long-format scalar metrics from every game payload
 * HH_Game_Event_Log    step/item/round/trial/event-level records
 */
const HH_SPREADSHEET_ID = '1bgttlnpVvdvpMWSDI0dsqKtZfBqnzhuZwZJ9OwpOxf4';
const HH_VERSION = '2026-07-27-PRODUCTION-V8-UNIFIED-ANALYTICS';

const HH_SHEETS = {
  profiles:'HH_Profiles', assessments:'HH_Assessments', assessmentItems:'HH_Assessment_Items',
  games:'HH_Game_Results', gameSummary:'HH_Game_Summary', gameMetrics:'HH_Game_Metrics',
  gameEvents:'HH_Game_Event_Log', reflections:'HH_Reflections', progress:'HH_Progress',
  live:'HH_Live_Status', events:'HH_Events', errors:'HH_Errors'
};
const HH_GAME_CATALOG = {
  hygiene:['handwash','toothbrush'], nutrition:['groups','goodjunk'], fitness:['jumpduck','balance-hold']
};
const HH_ROTATION = {
  A:['hygiene','nutrition','fitness'], B:['nutrition','fitness','hygiene'], C:['fitness','hygiene','nutrition'],
  D:['hygiene','fitness','nutrition'], E:['nutrition','hygiene','fitness'], F:['fitness','nutrition','hygiene'],
  G:['hygiene','nutrition','fitness'], H:['nutrition','fitness','hygiene'], I:['fitness','hygiene','nutrition'],
  J:['hygiene','fitness','nutrition']
};

const HH_HEADERS = {};
HH_HEADERS[HH_SHEETS.profiles] = ['studentId','fullName','section','group','active','firstSeen','lastSeen','platformVersion'];
HH_HEADERS[HH_SHEETS.assessments] = ['serverTs','eventId','studentId','fullName','section','group','assessment','form','score','total','percent','clientTs','payloadJson'];
HH_HEADERS[HH_SHEETS.assessmentItems] = ['serverTs','eventId','studentId','assessment','questionId','selectedOptionIndex','correct','clientTs'];
HH_HEADERS[HH_SHEETS.games] = ['serverTs','eventId','studentId','fullName','section','group','zone','gameId','score','accuracy','passed','completed','finishedAt','payloadJson'];
HH_HEADERS[HH_SHEETS.gameSummary] = [
  'serverTs','eventId','studentId','fullName','section','group','zone','gameId','score','accuracy','passed','completed',
  'durationSec','scoreAvailable','assistUsed','inputMode','gameVersion','completionPolicy','skillCriteriaMet',
  'masteryPct','primaryStrength','improvementArea','metricCompletenessPct','summaryJson'
];
HH_HEADERS[HH_SHEETS.gameMetrics] = [
  'serverTs','eventId','studentId','section','group','zone','gameId','metricGroup','metricName','metricValue','metricText','unit','sourcePath'
];
HH_HEADERS[HH_SHEETS.gameEvents] = [
  'serverTs','eventId','studentId','section','group','zone','gameId','eventCollection','eventIndex','eventName','eventTs','eventValue','payloadJson'
];
HH_HEADERS[HH_SHEETS.reflections] = ['serverTs','eventId','studentId','fullName','section','group','understand','best','action','submittedAt','payloadJson'];
HH_HEADERS[HH_SHEETS.progress] = ['serverTs','eventId','studentId','fullName','section','group','progressPct','completedCount','totalSteps','nextStep','missionComplete','clientTs','payloadJson'];
HH_HEADERS[HH_SHEETS.live] = ['studentId','fullName','section','group','currentStep','status','progressPct','completedCount','missionComplete','online','lastSeen','lastEventType','lastEventId'];
HH_HEADERS[HH_SHEETS.events] = ['serverTs','eventId','eventType','studentId','clientTs','payloadJson'];
HH_HEADERS[HH_SHEETS.errors] = ['serverTs','eventId','studentId','message','stack','clientTs','payloadJson'];

function getHHSpreadsheet_() {
  const id = text_(HH_SPREADSHEET_ID) || PropertiesService.getScriptProperties().getProperty('HH_SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('spreadsheet_not_configured');
  return active;
}

function HH_setupSheets() {
  const ss = getHHSpreadsheet_();
  Object.keys(HH_HEADERS).forEach(name => ensureSheet_(ss,name,HH_HEADERS[name]));
  return {ok:true,version:HH_VERSION,spreadsheetId:ss.getId(),spreadsheetName:ss.getName()};
}

function doGet(e) {
  const action = text_(e && e.parameter && e.parameter.action || 'ping');
  try {
    if (action === 'submit') return output_(acceptPayload_(parsePayload_(e)),e);
    const ss = getHHSpreadsheet_();
    if (action === 'student') return output_(buildStudentAuthority_(ss,cleanStudentId_(e.parameter.studentId)),e);
    if (action === 'event') return output_(buildEventPayload_(ss,e),e);
    if (action === 'live') return output_(buildLivePayload_(ss,e),e);
    if (action === 'reconcileStudent') return output_(HH_rebuildStudentLive(text_(e.parameter.studentId)),e);
    if (action === 'reconcileAll') return output_(HH_rebuildAllLive(),e);
    if (action === 'setup') return output_(HH_setupSheets(),e);
    return output_({ok:true,service:'HeroHealth Classroom Receiver',version:HH_VERSION,authority:'google_sheet',analytics:'unified-long-format-v1',ts:new Date().toISOString()},e);
  } catch (err) {
    logErrorSafe_('',e && e.parameter && e.parameter.studentId,err,{action:action,parameters:e && e.parameter || {}});
    return output_({ok:false,error:String(err && err.message || err),version:HH_VERSION},e);
  }
}
function doPost(e) { return json_(acceptPayload_(parsePayload_(e))); }

function acceptPayload_(p) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    if (!p || !p.eventId || !p.eventType || !p.studentId) return {ok:false,error:'missing_required_fields',version:HH_VERSION};
    p.studentId = cleanStudentId_(p.studentId);
    if (!p.studentId) return {ok:false,error:'invalid_studentId',version:HH_VERSION};
    const ss = getHHSpreadsheet_();
    Object.keys(HH_HEADERS).forEach(name => ensureSheet_(ss,name,HH_HEADERS[name]));
    if (p.eventType !== 'heartbeat' && isDuplicate_(ss,p.eventId)) return {ok:true,duplicate:true,eventId:p.eventId,version:HH_VERSION,authority:'google_sheet'};
    route_(ss,p);
    updateLive_(ss,p);
    if (p.eventType !== 'heartbeat') append_(ss,HH_SHEETS.events,[new Date(),p.eventId,p.eventType,p.studentId,p.clientTs||'',JSON.stringify(p)]);
    SpreadsheetApp.flush();
    return {ok:true,eventId:p.eventId,eventType:p.eventType,studentId:p.studentId,version:HH_VERSION,authority:'google_sheet',analyticsSaved:p.eventType==='game'};
  } catch (err) {
    logErrorSafe_(p && p.eventId,p && p.studentId,err,p||{});
    return {ok:false,error:String(err && err.message || err),version:HH_VERSION};
  } finally { try { lock.releaseLock(); } catch (_) {} }
}

function route_(ss,p) {
  const pr=p.profile||{}, common=[p.eventId,p.studentId,pr.fullName||p.fullName||'',pr.section||p.section||'',pr.group||p.group||''];
  if (p.eventType==='profile') return upsertProfile_(ss,p);
  if (p.eventType==='assessment') {
    const a=p.assessment||{},score=number_(a.score),total=number_(a.total);
    append_(ss,HH_SHEETS.assessments,[new Date()].concat(common,[normalizeAssessment_(a.type),text_(a.form),score,total,total?Math.round(score*10000/total)/100:0,p.clientTs||'',JSON.stringify(p)]));
    (Array.isArray(a.responses)?a.responses:[]).forEach(r=>append_(ss,HH_SHEETS.assessmentItems,[new Date(),p.eventId,p.studentId,normalizeAssessment_(a.type),text_(r.questionId),r.selectedOptionIndex==null?'':r.selectedOptionIndex,r.correct===true,p.clientTs||'']));
    return;
  }
  if (p.eventType==='game') {
    const g=p.game||{}, zone=normalizeZone_(g.zone), gameId=normalizeGameId_(g.gameId);
    append_(ss,HH_SHEETS.games,[new Date()].concat(common,[zone,gameId,number_(g.score),number_(g.accuracy),g.passed===true,g.completed===true,g.finishedAt||p.clientTs||'',JSON.stringify(p)]));
    saveUnifiedGameAnalytics_(ss,p,zone,gameId);
    return;
  }
  if (p.eventType==='reflection') {
    const r=p.reflection||{};
    append_(ss,HH_SHEETS.reflections,[new Date()].concat(common,[number_(r.understand),r.best||'',r.action||'',r.submittedAt||p.clientTs||'',JSON.stringify(p)]));
    return;
  }
  if (p.eventType==='progress') {
    const x=p.progress||{};
    append_(ss,HH_SHEETS.progress,[new Date()].concat(common,[number_(x.progressPct),number_(x.completedCount),number_(x.totalSteps)||9,text_(x.nextStep),x.missionComplete===true,p.clientTs||'',JSON.stringify(p)]));
    return;
  }
  if (p.eventType==='error') append_(ss,HH_SHEETS.errors,[new Date(),p.eventId,p.studentId,p.message||'',p.stack||'',p.clientTs||'',JSON.stringify(p)]);
}

function saveUnifiedGameAnalytics_(ss,p,zone,gameId) {
  const g=p.game||{}, pr=p.profile||{}, summary=buildGameSummary_(g,gameId);
  append_(ss,HH_SHEETS.gameSummary,[
    new Date(),p.eventId,p.studentId,pr.fullName||p.fullName||'',pr.section||p.section||'',pr.group||p.group||'',zone,gameId,
    number_(g.score),number_(g.accuracy),g.passed===true,g.completed===true,summary.durationSec,summary.scoreAvailable,
    summary.assistUsed,summary.inputMode,summary.gameVersion,summary.completionPolicy,summary.skillCriteriaMet,
    summary.masteryPct,summary.primaryStrength,summary.improvementArea,summary.metricCompletenessPct,JSON.stringify(summary)
  ]);

  const metrics=[];
  flattenMetrics_(g,'game',metrics,0);
  const metricRows=metrics.slice(0,300).map(m=>[
    new Date(),p.eventId,p.studentId,pr.section||p.section||'',pr.group||p.group||'',zone,gameId,
    metricGroup_(m.path),leafName_(m.path),typeof m.value==='number'?m.value:'',typeof m.value==='number'?'':String(m.value),metricUnit_(m.path),m.path
  ]);
  appendRows_(ss,HH_SHEETS.gameMetrics,metricRows);

  const collections=['events','eventLog','steps','stepResults','responses','trials','rounds','attempts','telemetry','items','missions'];
  const eventRows=[];
  collections.forEach(name=>{
    const arr=g[name];
    if (!Array.isArray(arr)) return;
    arr.slice(0,500).forEach((item,index)=>{
      const o=(item && typeof item==='object')?item:{value:item};
      eventRows.push([new Date(),p.eventId,p.studentId,pr.section||p.section||'',pr.group||p.group||'',zone,gameId,name,index+1,
        text_(o.eventName||o.event||o.type||o.stepId||o.questionId||o.name||name),
        o.ts||o.timestamp||o.clientTs||o.time||'', scalarEventValue_(o), JSON.stringify(o)]);
    });
  });
  appendRows_(ss,HH_SHEETS.gameEvents,eventRows);
}

function buildGameSummary_(g,gameId) {
  const pick=(...keys)=>firstDefined_(g,keys);
  const duration=number_(pick('durationSec','elapsedSec','playTimeSec','timeOnTaskSec','sessionDurationSec','totalTimeSec'));
  const accuracy=number_(pick('accuracy','correctRate','direction_accuracy','overall_direction_accuracy','successRate','stabilityPct'));
  const scoreAvailable=g.scoreAvailable===true || g.score!=null || g.totalScore!=null;
  const assist=bool_(pick('assistUsed','assisted','autoAssist','graceUsed','tapAssistUsed'));
  const specific={};
  if(gameId==='handwash') Object.assign(specific,{
    whoCompleted:number_(pick('whoStepsCompleted','stepsCompleted','completedSteps','whoCompleted')),
    whoTotal:number_(pick('whoStepsTotal','totalSteps','whoTotal'))||7,
    twoHandRate:number_(pick('twoHandRate','twoHandSeenRate','twoHandsPct','twoHandVisibilityPct')),
    handSeenRate:number_(pick('handSeenRate','handsSeenRate','trackingRate')),
    trackingLostCount:number_(pick('trackingLostCount','lostTrackingCount')),
    waterUseSec:number_(pick('waterUseSec')), waterWasteSec:number_(pick('waterWasteSec'))
  });
  if(gameId==='toothbrush') Object.assign(specific,{
    coveragePct:number_(pick('coveragePct','coverage','overallCoverage')),
    zonesCompleted:number_(pick('zonesCompleted','completedZones')), zonesTotal:number_(pick('zonesTotal','totalZones')),
    missedZones:text_(pick('missedZones','missedAreas')), directionAccuracy:number_(pick('directionAccuracy','direction_accuracy'))
  });
  if(gameId==='groups') Object.assign(specific,{
    correct:number_(pick('correct','correctCount')), wrong:number_(pick('wrong','wrongCount')),
    avgResponseMs:number_(pick('avgResponseMs','meanResponseTimeMs','averageResponseTimeMs')),
    confusion:text_(pick('confusion','categoryConfusion','confusionMatrix'))
  });
  if(gameId==='goodjunk') Object.assign(specific,{
    correct:number_(pick('correct','correctCount')), wrong:number_(pick('wrong','wrongCount')),
    combo:number_(pick('combo','maxCombo')), bossHp:number_(pick('bossHp','bossHP','bossHpRemaining')),
    healthyAccuracy:number_(pick('healthyAccuracy')), junkAccuracy:number_(pick('junkAccuracy'))
  });
  if(gameId==='jumpduck') Object.assign(specific,{
    jumps:number_(pick('jumps','jumpCount')), ducks:number_(pick('ducks','duckCount')),
    collisions:number_(pick('collisions','collisionCount','misses')), reactionMs:number_(pick('reactionMs','avgReactionMs','reactionTimeMs')),
    maxCombo:number_(pick('maxCombo','combo'))
  });
  if(gameId==='balance-hold') Object.assign(specific,{
    holdSec:number_(pick('holdSec','balanceTimeSec','durationSec')), stabilityPct:number_(pick('stabilityPct','stability','balanceAccuracy')),
    sway:number_(pick('sway','swayIndex','bodySway')), corrections:number_(pick('corrections','correctionCount')), falls:number_(pick('falls','fallCount'))
  });
  const values=Object.keys(specific).filter(k=>specific[k]!=='' && specific[k]!==0).length;
  const expected=Math.max(1,Object.keys(specific).length);
  const mastery=accuracy || deriveMastery_(specific,gameId);
  const feedback=deriveFeedback_(specific,gameId,mastery);
  return {
    durationSec:duration,scoreAvailable:scoreAvailable,assistUsed:assist,inputMode:text_(pick('inputMode','mode','play_mode')),
    gameVersion:text_(pick('gameVersion','version')),completionPolicy:text_(pick('completionPolicy')),
    skillCriteriaMet:bool_(pick('skillCriteriaMet','learning_complete','challenge_passed')),masteryPct:mastery,
    primaryStrength:feedback.strength,improvementArea:feedback.improve,metricCompletenessPct:Math.round(values*100/expected),specific:specific
  };
}

function deriveMastery_(s,id) {
  if(id==='handwash' && s.whoTotal) return Math.round(s.whoCompleted*100/s.whoTotal);
  if(id==='toothbrush') return s.coveragePct || (s.zonesTotal?Math.round(s.zonesCompleted*100/s.zonesTotal):0);
  if((id==='groups'||id==='goodjunk') && s.correct+s.wrong) return Math.round(s.correct*100/(s.correct+s.wrong));
  if(id==='balance-hold') return s.stabilityPct;
  return 0;
}
function deriveFeedback_(s,id,m) {
  let strength=m>=80?'ทำภารกิจได้แม่นยำและต่อเนื่อง':m>=60?'ทำภารกิจหลักได้ดี':'เล่นครบหนึ่งรอบและได้ฝึกทักษะสำคัญ';
  let improve=m>=80?'รักษาความสม่ำเสมอ':'ฝึกช้าลงและทำตามคำแนะนำทีละขั้น';
  if(id==='handwash'){if(s.trackingLostCount>3) improve='วางมือกลางกรอบและถูช้า ๆ เพื่อให้กล้องติดตามต่อเนื่อง'; if(s.waterWasteSec>5) improve='ปิดน้ำระหว่างใช้สบู่เพื่อลดการใช้น้ำ';}
  if(id==='toothbrush' && s.missedZones) improve='ทบทวนบริเวณที่ยังแปรงไม่ครบ: '+s.missedZones;
  if(id==='groups' && s.confusion) improve='ทบทวนหมวดอาหารที่ยังสับสน';
  if(id==='goodjunk' && s.wrong>s.correct*.3) improve='ชะลอการตัดสินใจและดูคุณค่าทางอาหารก่อนเลือก';
  if(id==='jumpduck' && s.collisions>3) improve='มองสัญญาณล่วงหน้าและตอบสนองให้เป็นจังหวะ';
  if(id==='balance-hold' && s.sway>0) improve='เกร็งลำตัวและมองจุดคงที่เพื่อลดการแกว่ง';
  return {strength:strength,improve:improve};
}

function flattenMetrics_(value,path,out,depth) {
  if(depth>4 || out.length>=300 || value==null) return;
  if(typeof value==='number' || typeof value==='boolean' || typeof value==='string') {
    if(String(value).length<=500) out.push({path:path,value:value});
    return;
  }
  if(Array.isArray(value)) {
    if(value.length && value.every(x=>typeof x!=='object')) out.push({path:path+'.count',value:value.length});
    return;
  }
  Object.keys(value).forEach(k=>{
    if(['payloadJson','rawVideo','image','base64','events','eventLog','steps','stepResults','responses','trials','rounds','attempts','telemetry','items','missions'].indexOf(k)>=0) return;
    flattenMetrics_(value[k],path+'.'+k,out,depth+1);
  });
}
function metricGroup_(path) {
  const p=path.toLowerCase();
  if(/detect|track|hand|pose|camera|fps|landmark|sway|stability/.test(p)) return 'sensor_cv';
  if(/time|duration|latency|reaction/.test(p)) return 'time';
  if(/correct|wrong|accuracy|score|mastery|coverage|combo/.test(p)) return 'performance';
  if(/assist|retry|pause|exit|collision|miss|water|sequence/.test(p)) return 'behavior';
  return 'game_specific';
}
function metricUnit_(path) {
  const p=path.toLowerCase();
  if(/ms$|millisecond|latency|reactionms/.test(p)) return 'ms';
  if(/sec$|seconds|duration|timeon/.test(p)) return 'sec';
  if(/pct|percent|accuracy|rate|coverage|stability/.test(p)) return '%';
  if(/count|correct|wrong|steps|combo|collision|falls|retry/.test(p)) return 'count';
  return '';
}
function leafName_(path){const a=String(path).split('.');return a[a.length-1];}
function scalarEventValue_(o){for(const k of ['value','score','correct','accuracy','durationMs','responseTimeMs','progress'])if(o[k]!=null)return typeof o[k]==='object'?JSON.stringify(o[k]):o[k];return '';}
function firstDefined_(obj,keys){for(let i=0;i<keys.length;i++){const v=obj[keys[i]];if(v!==undefined&&v!==null&&v!=='')return v;}return '';}

function upsertProfile_(ss,p){const sh=ensureSheet_(ss,HH_SHEETS.profiles,HH_HEADERS[HH_SHEETS.profiles]),pr=p.profile||{},sid=p.studentId,row=findRow_(sh,1,sid),now=new Date(),v=[sid,pr.fullName||'',pr.section||'',pr.group||'',true,row?sh.getRange(row,6).getValue()||now:now,now,p.platformVersion||''];if(row)sh.getRange(row,1,1,v.length).setValues([v]);else sh.appendRow(v);}
function updateLive_(ss,p){const sh=ensureSheet_(ss,HH_SHEETS.live,HH_HEADERS[HH_SHEETS.live]),sid=p.studentId,row=findRow_(sh,1,sid),pr=p.profile||{};let old={};if(row){const v=sh.getRange(row,1,1,HH_HEADERS[HH_SHEETS.live].length).getValues()[0];HH_HEADERS[HH_SHEETS.live].forEach((h,i)=>old[h]=v[i]);}const x=p.progress||{},step=p.currentStep||x.nextStep||old.currentStep||'pretest',status=p.status||(p.eventType==='game'?'จบเกม':p.eventType==='assessment'?'ส่งแบบทดสอบ':p.eventType==='reflection'?'ส่ง Reflection':p.eventType==='profile'?'เข้าสู่ระบบ':'อัปเดต'),pct=Math.max(number_(old.progressPct),number_(p.progressPct!=null?p.progressPct:x.progressPct)),count=Math.max(number_(old.completedCount),number_(p.completedCount!=null?p.completedCount:x.completedCount)),complete=bool_(old.missionComplete)||p.missionComplete===true||x.missionComplete===true,v=[sid,pr.fullName||old.fullName||'',pr.section||old.section||'',pr.group||old.group||'',complete?'certificate':step,status,pct,count,complete,true,new Date(),p.eventType,p.eventId];if(row)sh.getRange(row,1,1,v.length).setValues([v]);else sh.appendRow(v);}

function buildStudentAuthority_(ss,sid){
  if(!sid)return{ok:false,error:'missing_studentId',version:HH_VERSION};
  HH_setupSheets();
  const profiles=rowsForStudent_(ss.getSheetByName(HH_SHEETS.profiles),sid),assessments=rowsForStudent_(ss.getSheetByName(HH_SHEETS.assessments),sid),games=rowsForStudent_(ss.getSheetByName(HH_SHEETS.games),sid),summaries=rowsForStudent_(ss.getSheetByName(HH_SHEETS.gameSummary),sid),reflections=rowsForStudent_(ss.getSheetByName(HH_SHEETS.reflections),sid),progresses=rowsForStudent_(ss.getSheetByName(HH_SHEETS.progress),sid),lives=rowsForStudent_(ss.getSheetByName(HH_SHEETS.live),sid);
  const profile=latestBy_(profiles,'lastSeen'),live=latestBy_(lives,'lastSeen'),pre=latestMatching_(assessments,r=>normalizeAssessment_(r.assessment)==='pretest'),post=latestMatching_(assessments,r=>normalizeAssessment_(r.assessment)==='posttest');
  const completed={pretest:!!pre,hygiene:false,nutrition:false,fitness:false,posttest:!!post,reflection:reflections.length>0},gameCompleted={hygiene:{},nutrition:{},fitness:{}},gameScores={},gameResults={};
  Object.keys(HH_GAME_CATALOG).forEach(z=>{HH_GAME_CATALOG[z].forEach(id=>{const rows=games.filter(r=>normalizeZone_(r.zone)===z&&normalizeGameId_(r.gameId)===id),latest=latestBy_(rows,'serverTs'),done=rows.some(r=>bool_(r.completed)),sum=latestBy_(summaries.filter(r=>normalizeZone_(r.zone)===z&&normalizeGameId_(r.gameId)===id),'serverTs');gameCompleted[z][id]=done;if(latest){const k=z+':'+id;gameScores[k]=number_(latest.score);gameResults[k]={zone:z,gameId:id,score:number_(latest.score),accuracy:number_(latest.accuracy),passed:bool_(latest.passed),completed:done,finishedAt:iso_(latest.finishedAt||latest.serverTs),eventId:text_(latest.eventId),analytics:sum?{durationSec:number_(sum.durationSec),assistUsed:bool_(sum.assistUsed),masteryPct:number_(sum.masteryPct),primaryStrength:text_(sum.primaryStrength),improvementArea:text_(sum.improvementArea),metricCompletenessPct:number_(sum.metricCompletenessPct)}:null};}});completed[z]=HH_GAME_CATALOG[z].every(id=>gameCompleted[z][id]===true);});
  const group=text_(profile&&profile.group||live&&live.group).toUpperCase()||'A',evidenceCount=(completed.pretest?1:0)+countGames_(gameCompleted)+(completed.posttest?1:0)+(completed.reflection?1:0),nextStep=authoritativeNextStep_(completed,gameCompleted,group),reflection=latestBy_(reflections,'serverTs');
  const state={profile:profile?{studentId:sid,fullName:text_(profile.fullName),section:text_(profile.section),group:text_(profile.group)}:live?{studentId:sid,fullName:text_(live.fullName),section:text_(live.section),group:text_(live.group)}:null,group,completed,scores:{pretest:pre?number_(pre.score):undefined,posttest:post?number_(post.score):undefined},gameCompleted,gameScores,gameResults,reflection:reflection?{understand:number_(reflection.understand),best:text_(reflection.best),action:text_(reflection.action),submittedAt:iso_(reflection.submittedAt||reflection.serverTs)}:null,progress:{progressPct:Math.round(evidenceCount*100/9),completedCount:evidenceCount,totalSteps:9,nextStep,missionComplete:evidenceCount===9},sheetAuthority:true};
  return {ok:true,version:HH_VERSION,authority:'google_sheet',studentId:sid,found:!!(profile||assessments.length||games.length||reflections.length||progresses.length||lives.length),profile:state.profile,live:live?normalizeLive_(live):null,completed,scores:state.scores,gameCompleted,gameScores,gameResults,reflection:state.reflection,progress:state.progress,authoritativeState:state,evidence:{assessments:assessments.length,games:games.length,gameSummaries:summaries.length,reflections:reflections.length,progressRows:progresses.length,liveRows:lives.length},generatedAt:new Date().toISOString()};
}
function authoritativeNextStep_(c,g,group){if(!c.pretest)return'pretest';const order=[];(HH_ROTATION[group]||HH_ROTATION.A).forEach(z=>HH_GAME_CATALOG[z].forEach(id=>order.push(z+':'+id)));for(let i=0;i<order.length;i++){const p=order[i].split(':');if(g[p[0]][p[1]]!==true)return order[i];}if(!c.posttest)return'posttest';if(!c.reflection)return'reflection';return'certificate';}
function countGames_(g){let n=0;Object.keys(HH_GAME_CATALOG).forEach(z=>HH_GAME_CATALOG[z].forEach(id=>{if(g[z][id]===true)n++;}));return n;}
function HH_rebuildStudentLive(studentId){const sid=cleanStudentId_(studentId);if(!sid)return{ok:false,error:'missing_studentId'};const ss=getHHSpreadsheet_(),api=buildStudentAuthority_(ss,sid),s=api.authoritativeState,p=s.profile||{},sh=ensureSheet_(ss,HH_SHEETS.live,HH_HEADERS[HH_SHEETS.live]),row=findRow_(sh,1,sid),v=[sid,p.fullName||'',p.section||'',p.group||'',s.progress.nextStep,'Reconciled from Sheet evidence',s.progress.progressPct,s.progress.completedCount,s.progress.missionComplete,false,new Date(),'reconcile','HH-RECONCILE-V8-'+sid+'-'+Date.now()];if(row)sh.getRange(row,1,1,v.length).setValues([v]);else sh.appendRow(v);return{ok:true,studentId:sid,progress:s.progress,version:HH_VERSION};}
function HH_rebuildAllLive(){const ss=getHHSpreadsheet_(),ids={};Object.values(HH_SHEETS).forEach(n=>sheetObjects_(ss.getSheetByName(n)).forEach(r=>{const id=cleanStudentId_(r.studentId);if(id)ids[id]=true;}));return{ok:true,count:Object.keys(ids).length,results:Object.keys(ids).sort().map(HH_rebuildStudentLive),version:HH_VERSION};}
function buildEventPayload_(ss,e){const id=text_(e&&e.parameter&&e.parameter.eventId);if(!id)return{ok:false,error:'missing_eventId'};const row=sheetObjects_(ss.getSheetByName(HH_SHEETS.events)).find(r=>text_(r.eventId)===id);return{ok:true,eventId:id,found:!!row,event:row||null,version:HH_VERSION};}
function buildLivePayload_(ss,e){const rows=sheetObjects_(ss.getSheetByName(HH_SHEETS.live)),section=text_(e&&e.parameter&&e.parameter.section),group=text_(e&&e.parameter&&e.parameter.group);return{ok:true,version:HH_VERSION,authority:'google_sheet',generatedAt:new Date().toISOString(),students:rows.filter(r=>(!section||text_(r.section)===section)&&(!group||text_(r.group)===group)).map(normalizeLive_)};}
function normalizeLive_(r){return{studentId:cleanStudentId_(r.studentId),fullName:text_(r.fullName),section:text_(r.section),group:text_(r.group),currentStep:text_(r.currentStep),status:text_(r.status),progressPct:number_(r.progressPct),completedCount:number_(r.completedCount),missionComplete:bool_(r.missionComplete),online:bool_(r.online),lastSeen:iso_(r.lastSeen),lastEventType:text_(r.lastEventType),lastEventId:text_(r.lastEventId)};}
function normalizeAssessment_(v){v=text_(v).toLowerCase().replace(/[\s_-]+/g,'');return v==='pre'||v==='pretest'?'pretest':v==='post'||v==='posttest'?'posttest':v;}
function normalizeZone_(v){v=text_(v).toLowerCase().replace(/[\s_]+/g,'-');if(v.indexOf('hyg')===0)return'hygiene';if(v.indexOf('nut')===0)return'nutrition';if(v.indexOf('fit')===0)return'fitness';return v;}
function normalizeGameId_(v){v=text_(v).toLowerCase().replace(/[\s_]+/g,'-');if(v==='hand-wash'||v==='handwashing')return'handwash';if(v==='tooth-brush'||v==='toothbrushing')return'toothbrush';if(v==='food-groups'||v==='foodgroups')return'groups';if(v==='good-junk'||v==='goodjunk-ar')return'goodjunk';if(v==='jump-duck'||v==='jumpduck-ar')return'jumpduck';if(v==='balancehold'||v==='balance-hold-ar')return'balance-hold';return v;}
function latestMatching_(rows,p){return latestBy_(rows.filter(p),'serverTs');}function latestBy_(rows,f){if(!rows||!rows.length)return null;return rows.slice().sort((a,b)=>dateMs_(b[f])-dateMs_(a[f]))[0]||null;}function rowsForStudent_(sh,sid){return sheetObjects_(sh).filter(r=>cleanStudentId_(r.studentId)===sid);}function isDuplicate_(ss,id){const sh=ss.getSheetByName(HH_SHEETS.events);if(!sh||sh.getLastRow()<2)return false;return!!sh.getRange(2,2,sh.getLastRow()-1,1).createTextFinder(String(id)).matchEntireCell(true).findNext();}
function parsePayload_(e){if(!e)return null;if(e.parameter&&e.parameter.payload){try{return JSON.parse(e.parameter.payload)}catch(_){}}if(e.postData&&e.postData.contents){try{return JSON.parse(e.postData.contents)}catch(_){}}return e.parameter||null;}
function ensureSheet_(ss,n,h){let sh=ss.getSheetByName(n);if(!sh)sh=ss.insertSheet(n);if(sh.getLastRow()===0){sh.getRange(1,1,1,h.length).setValues([h]);sh.setFrozenRows(1);}else{const current=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),h.length)).getValues()[0];h.forEach((x,i)=>{if(!current[i])sh.getRange(1,i+1).setValue(x);});}return sh;}
function append_(ss,n,r){ensureSheet_(ss,n,HH_HEADERS[n]||[]).appendRow(r);}function appendRows_(ss,n,rows){if(!rows||!rows.length)return;const sh=ensureSheet_(ss,n,HH_HEADERS[n]||[]);sh.getRange(sh.getLastRow()+1,1,rows.length,rows[0].length).setValues(rows);}function findRow_(sh,c,v){if(!sh||sh.getLastRow()<2)return 0;const f=sh.getRange(2,c,sh.getLastRow()-1,1).createTextFinder(String(v)).matchEntireCell(true).findNext();return f?f.getRow():0;}function sheetObjects_(sh){if(!sh||sh.getLastRow()<2)return[];const v=sh.getDataRange().getValues(),h=v.shift().map(String);return v.filter(r=>r.some(x=>x!=='' )).map(r=>{const o={};h.forEach((k,i)=>o[k]=r[i]);return o;});}
function logErrorSafe_(eventId,studentId,err,payload){try{append_(getHHSpreadsheet_(),HH_SHEETS.errors,[new Date(),eventId||'',studentId||'',String(err&&err.message||err),String(err&&err.stack||''),'',JSON.stringify(payload||{})]);}catch(_){}}
function cleanStudentId_(v){return String(v==null?'':v).trim().replace(/\s+/g,'');}function text_(v){if(v&&typeof v==='object')return JSON.stringify(v);return String(v==null?'':v).trim();}function number_(v){const n=Number(v);return Number.isFinite(n)?n:0;}function bool_(v){return v===true||v===1||String(v).toUpperCase()==='TRUE'||String(v)==='1'||String(v).toLowerCase()==='yes';}function dateMs_(v){if(v instanceof Date)return v.getTime();const t=new Date(v).getTime();return Number.isFinite(t)?t:0;}function iso_(v){if(!v)return'';const d=v instanceof Date?v:new Date(v);return Number.isFinite(d.getTime())?d.toISOString():String(v);}function output_(o,e){const cb=String(e&&e.parameter&&e.parameter.callback||'').replace(/[^a-zA-Z0-9_.$]/g,'');if(cb)return ContentService.createTextOutput(cb+'('+JSON.stringify(o)+');').setMimeType(ContentService.MimeType.JAVASCRIPT);return json_(o);}function json_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
