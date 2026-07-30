(()=>{
'use strict';

const VERSION='20260730-ASSESSMENT-FORM-POST-VERIFY-V86';
const QUEUE_KEY='HH_ASSESSMENT_SYNC_QUEUE_V6';
const DURABLE_PREFIX='HH_ASSESSMENT_LAST_V6:';
const DEFAULT_ENDPOINT='https://script.google.com/macros/s/AKfycbwa-OSdqWS7uPne01wNr5a42PgKfAoxmUUm7yMcUx2D0C0OnbjrbppNUHkfjUxm79Fz/exec';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function endpoint(){
  const q=new URLSearchParams(location.search);
  return String(q.get('sheet')||window.HH_CONFIG?.assessmentApiUrl||DEFAULT_ENDPOINT).trim();
}
function readJson(key,fallback){
  try{const raw=localStorage.getItem(key);return raw==null?fallback:JSON.parse(raw)}catch(_){return fallback}
}
function profile(){return readJson('herohealth_learning_platform_rc2',{})?.profile||{}}
function enrich(raw){
  const p=profile();
  return{
    ...raw,
    clientSubmitVersion:VERSION,
    studentName:raw.studentName||p.fullName||p.name||'',
    section:raw.section||p.section||'',
    groupCode:raw.groupCode||p.group||p.groupCode||''
  };
}
function toReceiverEvent(payload){
  const sid=String(payload.studentId||'').trim();
  const mode=String(payload.mode||'').toLowerCase();
  const assessmentType=mode==='post'?'posttest':'pretest';
  const attemptId=String(payload.attemptId||`${assessmentType}-${sid}-${Date.now()}`);
  return{
    eventId:`HH-ASSESSMENT-${attemptId}`,
    eventType:'assessment',
    studentId:sid,
    fullName:payload.studentName||'',
    section:payload.section||'',
    group:payload.groupCode||'',
    profile:{fullName:payload.studentName||'',section:payload.section||'',group:payload.groupCode||''},
    assessment:{
      type:assessmentType,
      form:payload.form||'',
      score:Number(payload.score||0),
      total:Number(payload.total||0),
      responses:Array.isArray(payload.responses)?payload.responses:[],
      attemptId,
      assessmentVersion:payload.assessmentVersion||'',
      engineVersion:payload.engineVersion||'',
      bankVersion:payload.bankVersion||'',
      studyId:payload.studyId||'',
      blueprint:payload.blueprint||{},
      researchMetadata:payload.researchMetadata||{},
      selectionSeed:payload.selectionSeed??null,
      orderSeed:payload.orderSeed??null,
      questionOrder:payload.questionOrder||[],
      optionOrders:payload.optionOrders||[],
      correctPositionDistribution:payload.correctPositionDistribution||{},
      assignmentMethod:payload.assignmentMethod||'',
      pairIds:payload.pairIds||[],
      totalTimeMs:Number(payload.totalTimeMs||0)
    },
    clientTs:payload.submittedAt||new Date().toISOString()
  };
}
function jsonp(url,params,timeoutMs=20000){
  return new Promise((resolve,reject)=>{
    const cb='HHAS_'+Date.now()+'_'+Math.random().toString(36).slice(2,10);
    const script=document.createElement('script');
    let settled=false;
    const cleanup=()=>{
      clearTimeout(timer);
      script.onerror=null;
      setTimeout(()=>{try{delete window[cb]}catch(_){}try{script.remove()}catch(_){}},100);
    };
    const finish=(err,data)=>{if(settled)return;settled=true;cleanup();err?reject(err):resolve(data)};
    const timer=setTimeout(()=>finish(new Error('sheet_timeout')),timeoutMs);
    window[cb]=data=>finish(null,data);
    script.onerror=()=>finish(new Error('sheet_load_failed'));
    script.async=true;
    script.src=url+(url.includes('?')?'&':'?')+new URLSearchParams({...params,callback:cb,_:String(Date.now()),transport:'jsonp',clientVersion:VERSION}).toString();
    (document.head||document.body||document.documentElement).appendChild(script);
  });
}
function formPost(url,event){
  return new Promise((resolve,reject)=>{
    try{
      const token='HHFORM_'+Date.now()+'_'+Math.random().toString(36).slice(2,9);
      const iframe=document.createElement('iframe');
      iframe.name=token;
      iframe.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;border:0;left:-9999px;top:-9999px';
      iframe.setAttribute('aria-hidden','true');
      const form=document.createElement('form');
      form.method='POST';
      form.action=url;
      form.target=token;
      form.acceptCharset='UTF-8';
      form.style.display='none';
      const fields={
        action:'submit',
        payload:JSON.stringify(event),
        transport:'hidden-form-post',
        clientVersion:VERSION,
        _:String(Date.now())
      };
      Object.entries(fields).forEach(([name,value])=>{
        const input=document.createElement('input');
        input.type='hidden';input.name=name;input.value=value;form.appendChild(input);
      });
      (document.body||document.documentElement).appendChild(iframe);
      (document.body||document.documentElement).appendChild(form);
      form.submit();
      setTimeout(()=>resolve({ok:true,transport:'hidden-form-post'}),350);
      setTimeout(()=>{try{form.remove()}catch(_){}try{iframe.remove()}catch(_){}},60000);
    }catch(err){reject(err)}
  });
}
async function verifyEvent(url,eventId){
  const api=await jsonp(url,{action:'event',eventId},20000);
  return api?.ok===true&&api?.found===true;
}
function assessmentConfirmed(api,payload){
  if(!api||api.ok!==true)return false;
  const mode=String(payload.mode||'').toLowerCase();
  const completed=api.authoritativeState?.completed||api.completed||{};
  const scores=api.authoritativeState?.scores||api.scores||{};
  return mode==='pre'
    ?(completed.pretest===true||Number.isFinite(Number(scores.pretest)))
    :(completed.posttest===true||Number.isFinite(Number(scores.posttest)));
}
async function verifyStudent(url,payload){
  const api=await jsonp(url,{action:'student',studentId:String(payload.studentId||'').trim(),reconcile:'1'},20000);
  return assessmentConfirmed(api,payload)?{ok:true,api}:{ok:false,api};
}
function readQueue(){return readJson(QUEUE_KEY,[])}
function writeQueue(items){try{localStorage.setItem(QUEUE_KEY,JSON.stringify(items.slice(-30)))}catch(_){}}
function queue(payload){
  const items=readQueue();
  const fingerprint=[payload.studentId,payload.mode,payload.attemptId||'',payload.form||''].join('|');
  if(!items.some(item=>item.fingerprint===fingerprint))items.push({payload,fingerprint,queuedAt:new Date().toISOString()});
  writeQueue(items);
}
function persist(payload){
  try{
    const sid=String(payload.studentId||'').trim();
    const mode=String(payload.mode||'').toLowerCase();
    if(sid&&['pre','post'].includes(mode)){
      localStorage.setItem(DURABLE_PREFIX+sid+':'+mode,JSON.stringify({...payload,persistedAt:new Date().toISOString(),classroomAuthorityPending:true}));
    }
  }catch(_){}
}
async function waitForEvent(url,eventId){
  const delays=[0,1000,1200,1500,1800,2200,2600,3000,3500,4000];
  for(const delay of delays){
    if(delay)await sleep(delay);
    try{if(await verifyEvent(url,eventId))return true}catch(err){console.warn('[Assessment verify event]',err)}
  }
  return false;
}
async function sendAndVerify(url,payload){
  const event=toReceiverEvent(payload);
  try{
    if(await verifyEvent(url,event.eventId)){
      const student=await verifyStudent(url,payload).catch(()=>({ok:false}));
      return{ok:true,confirmed:true,attempt:0,eventId:event.eventId,studentApi:student.api||null,duplicate:true};
    }
  }catch(_){}
  let lastError=null;
  for(let attempt=1;attempt<=2;attempt++){
    try{
      await formPost(url,event);
      if(await waitForEvent(url,event.eventId)){
        const student=await verifyStudent(url,payload).catch(()=>({ok:false}));
        return{ok:true,confirmed:true,attempt,eventId:event.eventId,studentApi:student.api||null};
      }
      lastError=new Error('event_not_found_after_form_post');
    }catch(err){lastError=err;console.error('[HeroHealth assessment form POST]',err)}
    if(attempt<2)await sleep(1800);
  }
  return{ok:false,confirmed:false,reason:'sheet_not_confirmed',error:String(lastError?.message||lastError||'')};
}
async function submit(rawPayload){
  const payload=enrich(rawPayload);
  persist(payload);
  const url=endpoint();
  if(!url){queue(payload);return{ok:false,configured:false,queued:true,confirmed:false,reason:'endpoint_missing'}}
  const result=await sendAndVerify(url,payload);
  if(result.ok){
    try{
      const sid=String(payload.studentId||'').trim();
      const mode=String(payload.mode||'').toLowerCase();
      localStorage.setItem(DURABLE_PREFIX+sid+':'+mode+':CONFIRMED',JSON.stringify({attemptId:payload.attemptId,eventId:result.eventId,score:payload.score,total:payload.total,confirmedAt:new Date().toISOString(),version:VERSION}));
    }catch(_){}
    return{ok:true,configured:true,queued:false,confirmed:true,attempt:result.attempt,eventId:result.eventId,version:VERSION,duplicate:result.duplicate===true};
  }
  queue(payload);
  return{ok:false,configured:true,queued:true,confirmed:false,reason:result.reason,error:result.error};
}
async function flush(){
  const url=endpoint(),items=readQueue();
  if(!url)return{ok:false,configured:false,sent:0};
  if(!items.length)return{ok:true,configured:true,sent:0,remaining:0};
  let sent=0;const remaining=[];
  for(const item of items){const result=await sendAndVerify(url,item.payload);result.ok?sent++:remaining.push(item)}
  writeQueue(remaining);
  return{ok:remaining.length===0,configured:true,sent,remaining:remaining.length,version:VERSION};
}
async function verify(url,payload){
  const event=toReceiverEvent(payload);
  const found=await verifyEvent(url||endpoint(),event.eventId).catch(()=>false);
  if(!found)return{ok:false,reason:'event_not_found'};
  return verifyStudent(url||endpoint(),payload);
}
window.HHAssessmentSync={submit,flush,endpoint,verify,toReceiverEvent,version:VERSION};
addEventListener('online',()=>flush().catch(err=>console.error('[HeroHealth assessment queue]',err)));
})();