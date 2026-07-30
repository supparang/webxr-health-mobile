(()=>{
'use strict';

const VERSION='20260730-ASSESSMENT-DIRECT-POST-VERIFY-R87';
const QUEUE_KEY='HH_ASSESSMENT_SYNC_QUEUE_V7';
const DURABLE_PREFIX='HH_ASSESSMENT_LAST_V7:';
const DEFAULT_ENDPOINT='https://script.google.com/macros/s/AKfycbwa-OSdqWS7uPne01wNr5a42PgKfAoxmUUm7yMcUx2D0C0OnbjrbppNUHkfjUxm79Fz/exec';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function endpoint(){
  const q=new URLSearchParams(location.search);
  return String(q.get('sheet')||window.HH_CONFIG?.assessmentApiUrl||DEFAULT_ENDPOINT).trim();
}
function readJson(key,fallback){
  try{const raw=localStorage.getItem(key);return raw==null?fallback:JSON.parse(raw)}catch(_){return fallback}
}
function writeJson(key,value){
  try{localStorage.setItem(key,JSON.stringify(value));return true}catch(_){return false}
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
    profile:{
      fullName:payload.studentName||'',
      section:payload.section||'',
      group:payload.groupCode||''
    },
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
    clientTs:payload.submittedAt||new Date().toISOString(),
    transportVersion:VERSION
  };
}
function jsonp(url,params,timeoutMs=15000){
  return new Promise((resolve,reject)=>{
    const cb='HHAS87_'+Date.now()+'_'+Math.random().toString(36).slice(2,9);
    const script=document.createElement('script');
    let settled=false;
    const finish=(err,data)=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      script.onerror=null;
      try{delete window[cb]}catch(_){}
      try{script.remove()}catch(_){}
      err?reject(err):resolve(data);
    };
    const timer=setTimeout(()=>finish(new Error('sheet_timeout')),timeoutMs);
    window[cb]=data=>finish(null,data);
    script.onerror=()=>finish(new Error('sheet_load_failed'));
    script.async=true;
    script.src=url+(url.includes('?')?'&':'?')+new URLSearchParams({
      ...params,callback:cb,_:String(Date.now()),transport:'jsonp-short-r87',clientVersion:VERSION
    }).toString();
    (document.head||document.body||document.documentElement).appendChild(script);
  });
}
async function fetchPost(url,event){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),18000);
  try{
    await fetch(url,{
      method:'POST',
      mode:'no-cors',
      cache:'no-store',
      redirect:'follow',
      credentials:'omit',
      keepalive:true,
      headers:{'Content-Type':'text/plain;charset=UTF-8'},
      body:JSON.stringify(event),
      signal:controller.signal
    });
    return true;
  }finally{clearTimeout(timer)}
}
function formPost(url,event){
  return new Promise((resolve,reject)=>{
    try{
      const token='HHAS87FORM_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
      const iframe=document.createElement('iframe');
      const form=document.createElement('form');
      iframe.name=token;
      iframe.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;border:0;left:-9999px;top:-9999px';
      iframe.setAttribute('aria-hidden','true');
      form.method='POST';
      form.action=url;
      form.target=token;
      form.acceptCharset='UTF-8';
      form.enctype='application/x-www-form-urlencoded';
      form.style.display='none';
      const fields={
        action:'submit',
        payload:JSON.stringify(event),
        transport:'hidden-form-post-r87',
        clientVersion:VERSION,
        _:String(Date.now())
      };
      Object.entries(fields).forEach(([name,value])=>{
        const input=document.createElement('input');
        input.type='hidden';
        input.name=name;
        input.value=value;
        form.appendChild(input);
      });
      (document.body||document.documentElement).appendChild(iframe);
      (document.body||document.documentElement).appendChild(form);
      form.submit();
      setTimeout(()=>resolve(true),300);
      setTimeout(()=>{try{form.remove()}catch(_){}try{iframe.remove()}catch(_){}},60000);
    }catch(err){reject(err)}
  });
}
function beaconPost(url,event){
  try{
    if(!navigator.sendBeacon)return false;
    return navigator.sendBeacon(url,new Blob([JSON.stringify(event)],{type:'text/plain;charset=UTF-8'}));
  }catch(_){return false}
}
async function verifyEvent(url,eventId){
  const api=await jsonp(url,{action:'event',eventId},15000);
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
  const api=await jsonp(url,{
    action:'student',
    studentId:String(payload.studentId||'').trim(),
    reconcile:'1'
  },15000);
  return assessmentConfirmed(api,payload)?{ok:true,api}:{ok:false,api};
}
async function waitForEvent(url,eventId,delays){
  for(const delay of delays){
    if(delay)await sleep(delay+Math.floor(Math.random()*250));
    try{if(await verifyEvent(url,eventId))return true}catch(err){console.warn('[Assessment event verify]',err)}
  }
  return false;
}
function readQueue(){return readJson(QUEUE_KEY,[])}
function writeQueue(items){writeJson(QUEUE_KEY,items.slice(-30))}
function queue(payload){
  const items=readQueue();
  const fingerprint=[payload.studentId,payload.mode,payload.attemptId||'',payload.form||''].join('|');
  if(!items.some(item=>item.fingerprint===fingerprint)){
    items.push({payload,fingerprint,queuedAt:new Date().toISOString(),version:VERSION});
  }
  writeQueue(items);
}
function persist(payload){
  const sid=String(payload.studentId||'').trim();
  const mode=String(payload.mode||'').toLowerCase();
  if(sid&&['pre','post'].includes(mode)){
    writeJson(DURABLE_PREFIX+sid+':'+mode,{
      ...payload,persistedAt:new Date().toISOString(),classroomAuthorityPending:true
    });
  }
}
async function sendAndVerify(url,payload){
  const event=toReceiverEvent(payload);
  if(await verifyEvent(url,event.eventId).catch(()=>false)){
    return{ok:true,confirmed:true,attempt:0,eventId:event.eventId,duplicate:true,transport:'already-recorded'};
  }

  let lastError=null;
  const transports=[
    {
      name:'fetch-json-post',
      send:()=>fetchPost(url,event),
      delays:[500,800,1100,1500,2100,2800]
    },
    {
      name:'hidden-form-post',
      send:()=>formPost(url,event),
      delays:[700,1000,1400,1900,2500,3300]
    },
    {
      name:'send-beacon',
      send:async()=>{if(!beaconPost(url,event))throw new Error('beacon_unavailable');return true},
      delays:[800,1200,1700,2300,3100]
    }
  ];

  for(let index=0;index<transports.length;index++){
    const transport=transports[index];
    try{
      await transport.send();
      if(await waitForEvent(url,event.eventId,transport.delays)){
        const student=await verifyStudent(url,payload).catch(()=>({ok:false}));
        return{
          ok:true,
          confirmed:true,
          attempt:index+1,
          eventId:event.eventId,
          studentApi:student.api||null,
          transport:transport.name
        };
      }
      lastError=new Error('event_not_found_after_'+transport.name);
    }catch(err){
      lastError=err;
      console.error('[Assessment '+transport.name+']',err);
    }
  }

  return{
    ok:false,
    confirmed:false,
    reason:'sheet_not_confirmed',
    eventId:event.eventId,
    error:String(lastError?.message||lastError||'')
  };
}
async function submit(rawPayload){
  const payload=enrich(rawPayload);
  persist(payload);
  const url=endpoint();
  if(!url){
    queue(payload);
    return{ok:false,configured:false,queued:true,confirmed:false,reason:'endpoint_missing',version:VERSION};
  }
  const result=await sendAndVerify(url,payload);
  if(result.ok){
    const sid=String(payload.studentId||'').trim();
    const mode=String(payload.mode||'').toLowerCase();
    writeJson(DURABLE_PREFIX+sid+':'+mode+':CONFIRMED',{
      attemptId:payload.attemptId,
      eventId:result.eventId,
      score:payload.score,
      total:payload.total,
      transport:result.transport,
      confirmedAt:new Date().toISOString(),
      version:VERSION
    });
    writeQueue(readQueue().filter(item=>item.payload?.attemptId!==payload.attemptId));
    return{...result,configured:true,queued:false,version:VERSION};
  }
  queue(payload);
  return{...result,configured:true,queued:true,version:VERSION};
}
async function flush(){
  const url=endpoint();
  const items=readQueue();
  if(!url)return{ok:false,configured:false,sent:0,version:VERSION};
  if(!items.length)return{ok:true,configured:true,sent:0,remaining:0,version:VERSION};
  let sent=0;
  const remaining=[];
  for(const item of items){
    const result=await sendAndVerify(url,item.payload);
    result.ok?sent++:remaining.push(item);
  }
  writeQueue(remaining);
  return{ok:remaining.length===0,configured:true,sent,remaining:remaining.length,version:VERSION};
}
async function verify(url,payload){
  const event=toReceiverEvent(payload);
  const found=await verifyEvent(url||endpoint(),event.eventId).catch(()=>false);
  if(!found)return{ok:false,reason:'event_not_found',eventId:event.eventId,version:VERSION};
  return verifyStudent(url||endpoint(),payload);
}

window.HHAssessmentSync={submit,flush,endpoint,verify,toReceiverEvent,version:VERSION};
addEventListener('online',()=>flush().catch(err=>console.error('[Assessment queue flush]',err)));
})();