(()=>{
'use strict';
const RELEASE='20260728-HANDWASH-COMPLETION-RECOVERY-R31.2-SCOPED-JSONP';
const STATE_KEY='herohealth_learning_platform_rc2';
const RESULT_KEY='HHA_HANDWASH_LAST_RESULT';
const RESUME_PREFIX='herohealth_student_resume_v6:';
const MARK_PREFIX='hh_handwash_recovery_r31_2:';
const QUERY=new URLSearchParams(location.search);
const AUTO_REQUESTED=QUERY.get('recoverHandwash')==='1'||QUERY.get('handwashRecovery')==='1';
const REQUESTED_SID=String(QUERY.get('sid')||QUERY.get('studentId')||'').trim();
const MAX_RESULT_AGE_MS=2*60*60*1000;
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const yes=v=>v===true||v===1||String(v||'').toLowerCase()==='true'||String(v||'')==='1'||String(v||'').toLowerCase()==='yes';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function read(k,f=null){try{const v=localStorage.getItem(k);return v==null?f:JSON.parse(v)}catch(_){return f}}
function write(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(_){return false}}
function endpoint(){return String(window.HH_CONFIG?.backend?.webAppUrl||'').trim()}
function removeOverlay(){document.getElementById('hh-handwash-recovery-r31')?.remove()}
function jsonp(params,timeout=24000){return new Promise((resolve,reject)=>{const url=endpoint();if(!url){reject(new Error('backend_url_missing'));return}const cb='HHR312_'+Date.now()+'_'+Math.random().toString(36).slice(2),s=document.createElement('script');let done=false;const finish=(err,data)=>{if(done)return;done=true;clearTimeout(timer);try{delete window[cb]}catch(_){}s.remove();err?reject(err):resolve(data)};const timer=setTimeout(()=>finish(new Error('sheet_timeout')),timeout);window[cb]=data=>finish(null,data);s.onerror=()=>finish(new Error('sheet_load_failed'));s.src=url+(url.includes('?')?'&':'?')+new URLSearchParams({...params,callback:cb,_:Date.now()});document.head.appendChild(s)})}
function rowDone(row){return yes(row?.completed)||['strict','grace','assist','pass','passed'].includes(String(row?.passMode||'').toLowerCase())}
function audit(raw){
 const rows=Array.isArray(raw?.steps)?raw.steps:Array.isArray(raw?.stepResults)?raw.stepResults:[];
 const rubRows=rows.filter(row=>String(row?.group||row?.kind||'').toLowerCase().includes('rub'));
 const processRows=rows.filter(row=>String(row?.group||row?.kind||'').toLowerCase()==='process');
 const rubDone=num(raw?.completedRubSteps??raw?.whoStepsCompleted)||rubRows.filter(rowDone).length;
 const processDone=num(raw?.completedProcessSteps)||processRows.filter(rowDone).length;
 const wrist=rows.find(row=>String(row?.id||'').toLowerCase()==='wrists'||num(row?.stepId??row?.whoStep)===8||/ข้อมือ/.test(String(row?.label||'')));
 const wristsPassed=yes(raw?.wristsPassed)||rowDone(wrist);
 const analyticsPct=num(raw?.metricCompletenessPct);
 return{valid:rubDone>=7&&processDone>=5&&wristsPassed&&analyticsPct>=90,rubDone,processDone,wristsPassed,analyticsPct,rows};
}
function resultTime(raw){for(const key of ['finishedAt','submittedAt','timestamp','endedAt','createdAt','clientTs']){const value=raw?.[key];if(!value)continue;const t=typeof value==='number'?value:Date.parse(value);if(Number.isFinite(t))return t}return 0}
function show(text,tone='info'){
 let n=document.getElementById('hh-handwash-recovery-r31');
 if(!n){n=document.createElement('div');n.id='hh-handwash-recovery-r31';n.style.cssText='position:fixed;inset:0;z-index:999999;display:grid;place-items:center;padding:26px;background:rgba(2,16,24,.94);color:#fff;font:800 17px/1.55 system-ui;text-align:center;white-space:pre-line';document.body.appendChild(n)}
 n.dataset.tone=tone;n.textContent=text;
}
function authorityHas(api){return api?.authoritativeState?.gameCompleted?.hygiene?.handwash===true||api?.gameCompleted?.hygiene?.handwash===true}
function applyAuthority(api,sid){const old=read(STATE_KEY,{})||{},a=api?.authoritativeState||{};const next={...old,...a,profile:{...(old.profile||{}),...(a.profile||api.profile||{}),studentId:sid},sheetAuthority:true,lastAuthoritySyncAt:new Date().toISOString(),authoritativeProgress:a.progress||api.progress||null,sheetVersion:api.version||''};write(STATE_KEY,next);write(RESUME_PREFIX+sid,next)}
function compactSteps(rows){return(Array.isArray(rows)?rows:[]).slice(0,20).map((row,index)=>({stepId:row?.stepId??row?.whoStep??index,id:String(row?.id||''),label:String(row?.label||'').slice(0,120),group:String(row?.group||row?.kind||'').slice(0,40),completed:rowDone(row),passMode:String(row?.passMode||'').slice(0,30),quality:num(row?.quality??row?.accuracy??row?.evidencePct),durationSec:num(row?.durationSec??row?.timeSec??row?.elapsedSec),retryCount:num(row?.retryCount??row?.retries),errorCount:num(row?.errorCount??row?.errors)}))}
function compactEvents(raw){const arr=Array.isArray(raw?.events)?raw.events:Array.isArray(raw?.eventLog)?raw.eventLog:[];return arr.slice(-40).map((event,index)=>({eventName:String(event?.eventName||event?.event||event?.type||event?.name||'event').slice(0,80),ts:String(event?.ts||event?.timestamp||event?.clientTs||event?.time||'').slice(0,80),stepId:String(event?.stepId||event?.phase||'').slice(0,60),value:typeof event?.value==='number'||typeof event?.value==='boolean'?event.value:String(event?.value??'').slice(0,120),index:index+1}))}
function compactGame(raw,a){
 const steps=compactSteps(a.rows);
 const scalarKeys=['score','accuracy','masteryPct','durationSec','procedureDurationSec','waterUseSec','waterWasteSec','waterSaveScore','twoHandsVisibleRate','twoHandVisibilityPct','handSeenRate','trackingLostCount','trackingRecoveryCount','calibrationTimeSec','avgFps','motionSmoothness','landmarkConfidence','germRemoval','foamPeak','soapDurationSec','assistUsed','assistTapCount','retryCount','wrongStepCount','hintCount','coachCount','pauseCount','resumeCount','exitCount','strictPassCount','gracePassCount','inputMode','gameVersion','analyticsSchemaVersion','metricCompletenessPct'];
 const out={};scalarKeys.forEach(key=>{const value=raw?.[key];if(value!==undefined&&value!==null&&value!=='')out[key]=value});
 return{...out,zone:'hygiene',gameId:'handwash',studentId:String(raw?.studentId||raw?.participantId||raw?.pid||''),completed:true,passed:yes(raw?.passed),skillCriteriaMet:yes(raw?.passed),procedureCompleted:true,progressionEligible:true,completionPolicy:'recovered-complete-7-rub-12-phase-r31.2',analyticsSchemaVersion:String(raw?.analyticsSchemaVersion||'HH-UNIFIED-GAME-ANALYTICS-V2'),analyticsRecoveryRelease:RELEASE,totalSteps:12,completedSteps:12,totalWhoRubSteps:7,whoStepsTotal:7,whoStepsCompleted:7,completedRubSteps:7,totalProcessSteps:5,completedProcessSteps:5,wristsPassed:true,processCompliancePct:100,metricCompletenessPct:a.analyticsPct,steps,stepResults:steps,events:compactEvents(raw),finishedAt:raw?.finishedAt||raw?.timestamp||raw?.endedAt||new Date().toISOString()};
}
async function submitJsonp(payload){const ack=await jsonp({action:'submit',payload:JSON.stringify(payload)},30000);if(!ack?.ok)throw new Error(ack?.error||'submit_failed');if(String(ack.eventId||'')&&String(ack.eventId)!==String(payload.eventId))throw new Error('event_ack_mismatch');return ack}
async function pollAuthority(sid){
 let last=null;
 for(let i=0;i<12;i++){
  try{const api=await jsonp({action:'student',studentId:sid},18000);last=api;if(api?.ok&&authorityHas(api))return api}catch(error){last={error:String(error?.message||error)}}
  show(`ส่งหลักฐานแล้ว\nกำลังรอ Google Sheet ยืนยัน Passport… (${i+1}/12)`);
  await sleep(700+Math.min(2200,i*220));
 }
 throw new Error(last?.error||'authority_not_advanced');
}
async function run(options={}){
 removeOverlay();
 const force=options===true||options?.force===true;
 if(!force&&!AUTO_REQUESTED)return{recovered:false,reason:'not_requested'};
 const state=read(STATE_KEY,{}),sid=String(state?.profile?.studentId||'').trim();
 if(!sid)return{recovered:false,reason:'no_active_student'};
 if(REQUESTED_SID&&REQUESTED_SID!==sid)return{recovered:false,reason:'requested_student_transition'};
 if(state?.gameCompleted?.hygiene?.handwash===true)return{recovered:false,reason:'not_needed'};
 const raw=read(RESULT_KEY,null);
 if(!raw){show('ยังไม่พบผล Handwash ของผู้เล่นปัจจุบัน\nกลับไปที่ Game Shell แล้วกดส่งผลอีกครั้ง','error');return{recovered:false,reason:'no_local_result'}}
 const rawSid=String(raw.studentId||raw.participantId||raw.pid||'').trim();
 if(!rawSid||rawSid==='anon'){show('ผล Handwash รอบนี้ไม่มีรหัสนักเรียนกำกับ\nระบบจะไม่ส่งข้ามผู้เล่น กรุณาเล่นผ่าน Passport ใหม่','error');return{recovered:false,reason:'unscoped_result'}}
 if(rawSid!==sid){show(`ผล Handwash ในเครื่องเป็นของรหัส ${rawSid}\nPassport ปัจจุบันคือ ${sid}\nระบบไม่นำผลเก่ามาใช้`,'error');return{recovered:false,reason:'student_mismatch'}}
 const finished=resultTime(raw);
 if(!finished||Date.now()-finished>MAX_RESULT_AGE_MS){show('ผล Handwash ในเครื่องเป็นผลเก่าหรือไม่มีเวลารอบเล่น\nระบบไม่นำผลเดิมมาบันทึกให้ผู้เล่นใหม่','error');return{recovered:false,reason:'stale_result'}}
 const a=audit(raw);
 if(!a.valid){show(`พบผล Handwash แต่หลักฐานยังไม่ครบ\nท่าถู ${a.rubDone}/7 • กระบวนการ ${a.processDone}/5 • รอบข้อมือ ${a.wristsPassed?'ผ่าน':'ไม่ผ่าน'} • Analytics ${a.analyticsPct}%`,'error');return{recovered:false,reason:'result_not_complete',audit:a}}
 const attempt=String(raw.eventId||raw.attemptId||raw.timestamp||Date.now()).replace(/[^A-Za-z0-9_-]/g,'').slice(0,70);
 const marker=MARK_PREFIX+sid+':'+attempt;if(localStorage.getItem(marker)==='done')return{recovered:false,reason:'already_recovered'};
 window.__HH_HANDWASH_RECOVERY_ACTIVE__=true;
 show(`ตรวจพบ Handwash ของรหัส ${sid} ที่ทำครบแล้ว\nท่าถู ${a.rubDone}/7 • กระบวนการ ${a.processDone}/5 • Analytics ${a.analyticsPct}%\nกำลังส่งหลักฐานแบบ JSONP…`);
 const profile=state.profile||{},eventId=`HH-recover-r31-2-${sid}-${attempt}`;
 const payload={eventType:'game',eventId,studentId:sid,profile:{fullName:profile.fullName||'',section:profile.section||'',group:profile.group||''},clientTs:new Date().toISOString(),currentStep:'hygiene:handwash',status:'Recovered completed Handwash 7/7 R31.2',game:compactGame(raw,a)};
 await submitJsonp(payload);
 show('ส่งหลักฐานแล้ว\nกำลังรอ Google Sheet ยืนยัน Passport…');
 const api=await pollAuthority(sid);
 applyAuthority(api,sid);localStorage.setItem(marker,'done');
 show('Google Sheet ยืนยัน Handwash เสร็จแล้ว\nกำลังเปิด Passport…','success');
 setTimeout(()=>location.replace(location.pathname+'?sid='+encodeURIComponent(sid)+'&authorityRefresh='+Date.now()+'&gameSync=1&autoNext=1'),600);
 return{recovered:true,api};
}
window.__HH_HANDWASH_RECOVERY_ACTIVE__=false;
removeOverlay();
const initial=AUTO_REQUESTED?run({force:true}).catch(error=>{console.error('[Handwash recovery R31.2]',error);window.__HH_HANDWASH_RECOVERY_ERROR__=String(error?.message||error);show(`Google Sheet ยังไม่ยืนยัน Handwash\nข้อผิดพลาด: ${String(error?.message||error)}\nกดส่งผลใหม่จาก Game Shell`,'error');return{recovered:false,error:String(error?.message||error)}}):Promise.resolve({recovered:false,reason:'not_requested'});
window.__HH_HANDWASH_RECOVERY_PROMISE__=initial.finally(()=>{window.__HH_HANDWASH_RECOVERY_ACTIVE__=false});
window.HHHandwashRecoveryR31={version:RELEASE,audit,run:()=>run({force:true}),promise:window.__HH_HANDWASH_RECOVERY_PROMISE__,removeOverlay};
})();