(function(){
'use strict';
const VERSION='2026-08-18-EVENT-DAY-FINAL-HARDENING-R1';
const base=window.EW_AUTHORITY;
if(!base){console.warn('EW final hardening: authority not ready');return;}
const QPREFIX='ew_durable_queue_v1::';
const DEAD_PREFIX='ew_durable_deadletter_v1::';
const TELEMETRY_KEY='ew_eventday_local_telemetry_v1';
const MAX_ACTIVE=64;
const MAX_DEAD=64;
const MAX_AGE_MS=7*24*60*60*1000;
const clean=v=>String(v==null?'':v).trim();
const nowIso=()=>new Date().toISOString();
function readJson(storage,key,fallback){try{return JSON.parse(storage.getItem(key)||'null')??fallback}catch(_){return fallback}}
function writeJson(storage,key,value){try{storage.setItem(key,JSON.stringify(value));return true}catch(_){return false}}
function hash32(value){let h=0x811c9dc5;const s=String(value||'');for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)}return (h>>>0).toString(16).padStart(8,'0')}
function stableString(value){
  if(value==null)return 'null';
  if(Array.isArray(value))return '['+value.map(stableString).join(',')+']';
  if(typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableString(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
function fingerprint(kind,payload){
  const p=payload||{};
  const core={kind,playerId:clean(p.playerId),stageId:clean(p.stageId),assessmentType:clean(p.assessmentType),formId:clean(p.formId),score:Number(p.score||0),total:Number(p.total||0),durationMs:Number(p.durationMs||0),answers:Array.isArray(p.answers)?p.answers:[],itemOrder:Array.isArray(p.itemOrder)?p.itemOrder:[],sourceVersion:clean(p.sourceVersion)};
  return `EW-${kind}-${hash32(stableString(core))}`;
}
function withSubmissionId(kind,payload){
  if(!payload||typeof payload!=='object')return payload;
  if(clean(payload.clientSubmissionId))return payload;
  return {...payload,clientSubmissionId:fingerprint(kind,payload),submissionContract:'event-day-idempotency-v1'};
}
function telemetry(){return readJson(localStorage,TELEMETRY_KEY,{version:VERSION,startedAt:nowIso(),calls:{assessment:0,game:0,resume:0},success:{assessment:0,game:0,resume:0},queued:0,errors:0,queueSanitized:0,deadLettered:0,maxQueueDepth:0,lastEventAt:''})}
function bump(path,amount=1){
  const t=telemetry();let obj=t;for(let i=0;i<path.length-1;i++){obj[path[i]]=obj[path[i]]&&typeof obj[path[i]]==='object'?obj[path[i]]:{};obj=obj[path[i]]}const k=path[path.length-1];obj[k]=Number(obj[k]||0)+amount;t.lastEventAt=nowIso();writeJson(localStorage,TELEMETRY_KEY,t);return t;
}
function setMaxQueue(n){const t=telemetry();t.maxQueueDepth=Math.max(Number(t.maxQueueDepth||0),Number(n||0));t.lastEventAt=nowIso();writeJson(localStorage,TELEMETRY_KEY,t)}
function validItem(item,playerId){return !!item&&typeof item==='object'&&['assessment','game'].includes(item.kind)&&clean(item.playerId)===clean(playerId)&&item.payload&&typeof item.payload==='object'}
function itemId(item){return clean(item?.payload?.clientSubmissionId)||clean(item?.id)||fingerprint(item?.kind||'unknown',item?.payload||{})}
function sanitizePlayerQueue(playerId){
  const id=clean(playerId);if(!id)return {active:0,dead:0};
  const qKey=QPREFIX+id,deadKey=DEAD_PREFIX+id;
  const raw=readJson(localStorage,qKey,[]),queue=Array.isArray(raw)?raw:[],dead=readJson(localStorage,deadKey,[]),deadList=Array.isArray(dead)?dead:[];
  const seen=new Set(),active=[],moved=[];const now=Date.now();
  for(const item of queue){
    if(!validItem(item,id)){moved.push({...item,deadReason:'INVALID_QUEUE_ITEM',deadAt:nowIso()});continue}
    const sid=itemId(item);if(seen.has(sid))continue;seen.add(sid);
    const queuedAt=Date.parse(item.queuedAt||'');if(Number.isFinite(queuedAt)&&now-queuedAt>MAX_AGE_MS){moved.push({...item,deadReason:'QUEUE_EXPIRED_7D',deadAt:nowIso()});continue}
    const payload=withSubmissionId(item.kind,item.payload);active.push({...item,id:item.id||sid,payload,clientSubmissionId:payload.clientSubmissionId});
  }
  const trimmed=active.slice(-MAX_ACTIVE);const overflow=active.slice(0,Math.max(0,active.length-MAX_ACTIVE)).map(x=>({...x,deadReason:'QUEUE_OVERFLOW',deadAt:nowIso()}));
  const allDead=[...deadList,...moved,...overflow].slice(-MAX_DEAD);
  writeJson(localStorage,qKey,trimmed);if(allDead.length)writeJson(localStorage,deadKey,allDead);
  if(moved.length||overflow.length)bump(['deadLettered'],moved.length+overflow.length);
  if(queue.length!==trimmed.length||moved.length||overflow.length)bump(['queueSanitized']);
  setMaxQueue(trimmed.length);
  return {active:trimmed.length,dead:allDead.length};
}
function activePlayer(){try{return JSON.parse(localStorage.getItem(window.EW_CONFIG?.cacheKeys?.identity||'ew_passport_identity_v1')||'null')?.playerId||''}catch(_){return ''}}
function sanitizeAllKnown(){
  const ids=new Set();const active=activePlayer();if(active)ids.add(active);
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'';if(k.startsWith(QPREFIX))ids.add(k.slice(QPREFIX.length))}}catch(_){}
  ids.forEach(sanitizePlayerQueue);
}
async function wrappedAssessment(payload){
  const p=withSubmissionId('assessment',payload);bump(['calls','assessment']);
  try{const r=await base.submitAssessment(p);if(r?.queued||r?.durableQueued)bump(['queued']);else bump(['success','assessment']);sanitizePlayerQueue(p.playerId);return r}catch(error){bump(['errors']);throw error}
}
async function wrappedGame(payload){
  const p=withSubmissionId('game',payload);bump(['calls','game']);
  try{const r=await base.submitGame(p);if(r?.queued||r?.durableQueued)bump(['queued']);else bump(['success','game']);sanitizePlayerQueue(p.playerId);return r}catch(error){bump(['errors']);throw error}
}
async function wrappedResume(playerId,nickname){
  bump(['calls','resume']);sanitizePlayerQueue(playerId);
  try{const r=await base.resume(playerId,nickname);bump(['success','resume']);return r}catch(error){bump(['errors']);throw error}
}
const wrapped=Object.freeze({...base,submitAssessment:typeof base.submitAssessment==='function'?wrappedAssessment:base.submitAssessment,submitGame:typeof base.submitGame==='function'?wrappedGame:base.submitGame,resume:typeof base.resume==='function'?wrappedResume:base.resume,finalHardeningVersion:VERSION});
try{Object.defineProperty(window,'EW_AUTHORITY',{configurable:true,enumerable:true,writable:true,value:wrapped})}catch(_){window.EW_AUTHORITY=wrapped}
sanitizeAllKnown();
window.addEventListener('online',sanitizeAllKnown);window.addEventListener('focus',sanitizeAllKnown);window.addEventListener('pageshow',sanitizeAllKnown);
window.EW_EVENT_DAY_HARDENING=Object.freeze({version:VERSION,sanitize:sanitizeAllKnown,submissionId:fingerprint,report:()=>telemetry(),queueStatus:playerId=>sanitizePlayerQueue(playerId)});
window.EW_OPERATION_TELEMETRY=Object.freeze({version:VERSION,report:()=>telemetry(),reset:()=>{try{localStorage.removeItem(TELEMETRY_KEY)}catch(_){}}});
window.dispatchEvent(new CustomEvent('ew-event-day-hardening-ready',{detail:{version:VERSION}}));
}());