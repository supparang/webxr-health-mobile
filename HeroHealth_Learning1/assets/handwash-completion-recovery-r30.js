(()=>{
'use strict';
const RELEASE='20260727-HANDWASH-COMPLETION-RECOVERY-R30';
const STATE_KEY='herohealth_learning_platform_rc2';
const RESULT_KEY='HHA_HANDWASH_LAST_RESULT';
const RESUME_PREFIX='herohealth_student_resume_v6:';
const MARK_PREFIX='hh_handwash_recovery_r30:';
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const yes=v=>v===true||v===1||String(v||'').toLowerCase()==='true'||String(v||'')==='1'||String(v||'').toLowerCase()==='yes';
function read(k,f=null){try{const v=localStorage.getItem(k);return v==null?f:JSON.parse(v)}catch(_){return f}}
function write(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(_){return false}}
function endpoint(){return String(window.HH_CONFIG?.backend?.webAppUrl||'').trim()}
function jsonp(params,timeout=20000){return new Promise((resolve,reject)=>{const cb='HHR30_'+Date.now()+'_'+Math.random().toString(36).slice(2),s=document.createElement('script');let done=false;const finish=(err,data)=>{if(done)return;done=true;clearTimeout(timer);try{delete window[cb]}catch(_){};s.remove();err?reject(err):resolve(data)};const timer=setTimeout(()=>finish(new Error('sheet_timeout')),timeout);window[cb]=data=>finish(null,data);s.onerror=()=>finish(new Error('sheet_load_failed'));s.src=endpoint()+(endpoint().includes('?')?'&':'?')+new URLSearchParams({...params,callback:cb,_:Date.now()});document.head.appendChild(s)})}
function audit(raw){
 const rows=Array.isArray(raw?.steps)?raw.steps:Array.isArray(raw?.stepResults)?raw.stepResults:[];
 const done=row=>yes(row?.completed)||['strict','grace','assist','pass','passed'].includes(String(row?.passMode||'').toLowerCase());
 const rubRows=rows.filter(row=>String(row?.group||row?.kind||'').toLowerCase().includes('rub'));
 const processRows=rows.filter(row=>String(row?.group||row?.kind||'').toLowerCase()==='process');
 const rubDone=num(raw?.completedRubSteps??raw?.whoStepsCompleted)||rubRows.filter(done).length;
 const processDone=num(raw?.completedProcessSteps)||processRows.filter(done).length;
 const wrist=rows.find(row=>String(row?.id||'').toLowerCase()==='wrists'||num(row?.stepId??row?.whoStep)===8||/ข้อมือ/.test(String(row?.label||'')));
 const wristsPassed=yes(raw?.wristsPassed)||done(wrist);
 const analyticsPct=num(raw?.metricCompletenessPct);
 return{valid:rubDone>=7&&processDone>=5&&wristsPassed&&analyticsPct>=90,rubDone,processDone,wristsPassed,analyticsPct,rows};
}
function show(text){let n=document.getElementById('hh-handwash-recovery-r30');if(!n){n=document.createElement('div');n.id='hh-handwash-recovery-r30';n.style.cssText='position:fixed;inset:0;z-index:999999;display:grid;place-items:center;padding:26px;background:rgba(2,16,24,.9);color:#fff;font:800 17px/1.55 system-ui;text-align:center;white-space:pre-line';document.body.appendChild(n)}n.textContent=text;}
function authorityHas(api){return api?.authoritativeState?.gameCompleted?.hygiene?.handwash===true||api?.gameCompleted?.hygiene?.handwash===true}
function applyAuthority(api,sid){const old=read(STATE_KEY,{})||{},a=api?.authoritativeState||{};const next={...old,...a,profile:{...(old.profile||{}),...(a.profile||api.profile||{}),studentId:sid},sheetAuthority:true,lastAuthoritySyncAt:new Date().toISOString(),authoritativeProgress:a.progress||api.progress||null,sheetVersion:api.version||''};write(STATE_KEY,next);write(RESUME_PREFIX+sid,next);}
async function run(){
 const state=read(STATE_KEY,{}),sid=String(state?.profile?.studentId||'').trim();if(!sid||state?.gameCompleted?.hygiene?.handwash===true)return;
 const raw=read(RESULT_KEY,null);if(!raw)return;
 const a=audit(raw);if(!a.valid)return;
 const rawSid=String(raw.studentId||raw.participantId||raw.pid||'').trim();if(rawSid&&rawSid!=='anon'&&rawSid!==sid)return;
 const attempt=String(raw.eventId||raw.attemptId||raw.timestamp||Date.now()).replace(/[^A-Za-z0-9_-]/g,'').slice(0,80);
 const marker=MARK_PREFIX+sid+':'+attempt;if(localStorage.getItem(marker)==='done')return;
 show(`ตรวจพบ Handwash ที่ทำครบแล้ว\nท่าถู ${a.rubDone}/7 • กระบวนการ ${a.processDone}/5 • Analytics ${a.analyticsPct}%\nกำลังบันทึกและปลดล็อกภารกิจถัดไป…`);
 const profile=state.profile||{},eventId=`HH-recover-handwash-${sid}-${attempt}`;
 const game={...raw,zone:'hygiene',gameId:'handwash',completed:true,passed:yes(raw.passed),skillCriteriaMet:yes(raw.passed),procedureCompleted:true,progressionEligible:true,completionPolicy:'recovered-complete-7-rub-12-phase',analyticsSchemaVersion:raw.analyticsSchemaVersion||'HH-UNIFIED-GAME-ANALYTICS-V2',recoveryRelease:RELEASE,finishedAt:raw.finishedAt||raw.timestamp||new Date().toISOString()};
 const payload={eventType:'game',eventId,studentId:sid,profile:{fullName:profile.fullName||'',section:profile.section||'',group:profile.group||''},clientTs:new Date().toISOString(),currentStep:'hygiene:handwash',status:'Recovered completed Handwash 7/7',game};
 const ack=await jsonp({action:'submit',payload:JSON.stringify(payload)},20000);if(!ack?.ok)throw new Error(ack?.error||'submit_failed');
 for(let i=0;i<8;i++){const api=await jsonp({action:'student',studentId:sid},18000);if(authorityHas(api)){applyAuthority(api,sid);localStorage.setItem(marker,'done');show('บันทึก Handwash สำเร็จแล้ว\nกำลังเปิดภารกิจถัดไป…');setTimeout(()=>location.replace(location.pathname+'?authorityRefresh='+Date.now()+'&gameSync=1&autoNext=1'),500);return}await new Promise(r=>setTimeout(r,700+i*250));}
 throw new Error('authority_not_advanced');
}
setTimeout(()=>run().catch(error=>{console.error('[Handwash recovery R30]',error);const n=document.getElementById('hh-handwash-recovery-r30');if(n){n.textContent='ยังบันทึกผล Handwash ไม่สำเร็จ ระบบจะลองใหม่เมื่อรีเฟรช';setTimeout(()=>n.remove(),4500)}}),900);
window.HHHandwashRecoveryR30={version:RELEASE,audit,run};
})();