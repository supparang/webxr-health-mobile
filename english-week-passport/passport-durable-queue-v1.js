(function(){
'use strict';
const VERSION='2026-08-18-DURABLE-QUEUE-V2-INTEGRATED-GUARD';
const base=window.EW_AUTHORITY;
if(!base){console.warn('EW durable queue: authority not ready');return;}
if(base.durableQueueVersion){
  window.EW_DURABLE_QUEUE=window.EW_DURABLE_QUEUE||Object.freeze({version:base.durableQueueVersion,integrated:true,pending:()=>0,flush:(playerId)=>base.flushDurableQueue?.(playerId)});
  return;
}
const FLOW=['word_match','category_forest','sentence_city','word_detective','final_boss'];
const PASS_MARKS={word_match:55,category_forest:60,sentence_city:60,word_detective:60,final_boss:60};
const QPREFIX='ew_durable_queue_v1::';
const SPREFIX='ew_durable_snapshot_v1::';
const clean=v=>String(v==null?'':v).trim();
const nowIso=()=>new Date().toISOString();
function key(playerId){return QPREFIX+clean(playerId)}
function snapKey(playerId){return SPREFIX+clean(playerId)}
function readJson(k,fallback){try{return JSON.parse(localStorage.getItem(k)||'null')??fallback}catch(_){return fallback}}
function writeJson(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(_){return false}}
function readQueue(playerId){const q=readJson(key(playerId),[]);return Array.isArray(q)?q:[]}
function writeQueue(playerId,q){return writeJson(key(playerId),q.slice(-64))}
function saveSnapshot(playerId,authority){if(authority?.progress)writeJson(snapKey(playerId),{authority,at:Date.now()})}
function readSnapshot(playerId){return readJson(snapKey(playerId),null)?.authority||null}
function transient(error){const x=`${error?.code||''} ${error?.message||error||''}`.toLowerCase();return x.includes('quota')||x.includes('resource-exhausted')||x.includes('unavailable')||x.includes('network')||x.includes('deadline')||x.includes('timeout')||x.includes('failed to fetch')}
function defaultProgress(playerId){return {playerId,passed:[],bestScores:{},unlocked:['pre_challenge'],currentStage:'pre_challenge',preDone:false,postDone:false,finalDone:false,certificateEligible:false,totalScore:0}}
function reconcile(raw,playerId){const p={...defaultProgress(playerId),...(raw||{}),playerId};const passed=[...new Set((Array.isArray(p.passed)?p.passed:[]).map(clean).filter(Boolean))];const bestScores=p.bestScores&&typeof p.bestScores==='object'?{...p.bestScores}:{};const unlocked=['pre_challenge'];if(p.preDone)unlocked.push('word_match');if(passed.includes('word_match'))unlocked.push('category_forest');if(passed.includes('category_forest'))unlocked.push('sentence_city');if(passed.includes('sentence_city'))unlocked.push('word_detective');if(passed.includes('word_detective'))unlocked.push('final_boss');if(passed.includes('final_boss'))unlocked.push('post_challenge');if(p.postDone)unlocked.push('certificate');return {...p,passed,bestScores,unlocked,currentStage:unlocked[unlocked.length-1],finalDone:Boolean(p.finalDone||passed.includes('final_boss')),certificateEligible:Boolean(p.certificateEligible||p.postDone),totalScore:Object.values(bestScores).reduce((s,v)=>s+Number(v||0),0),queuedPending:true,updatedAt:nowIso()}}
function applyQueued(progress,item){const p=reconcile(progress,item.playerId);if(item.kind==='assessment'){if(item.payload.assessmentType==='pre')p.preDone=true;if(item.payload.assessmentType==='post'){p.postDone=true;p.certificateEligible=true}return reconcile(p,item.playerId)}if(item.kind==='game'){const stage=clean(item.payload.stageId),total=Math.max(1,Number(item.payload.total||100)),score=Math.max(0,Number(item.payload.score||0)),acc=Math.round(score/total*100);p.bestScores={...p.bestScores,[stage]:Math.max(Number(p.bestScores?.[stage]||0),acc)};if(acc>=Number(PASS_MARKS[stage]||60)&&!p.passed.includes(stage))p.passed=[...p.passed,stage];return reconcile(p,item.playerId)}return p}
function overlayQueue(playerId,authority){const q=readQueue(playerId);if(!q.length)return authority;let progress=reconcile(authority?.progress||defaultProgress(playerId),playerId);q.forEach(item=>progress=applyQueued(progress,item));return {...(authority||{}),ok:true,mode:'firebase',sourceOfTruth:'Firestore + durable local queue',progress,durableQueuePending:q.length,queuedPending:true}}
function enqueue(kind,payload,error){const playerId=clean(payload?.playerId);if(!playerId)throw error;const q=readQueue(playerId),id=`queued-${kind}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;q.push({id,kind,playerId,payload:{...(payload||{})},queuedAt:nowIso(),lastError:String(error?.message||error||'FIREBASE_TRANSIENT_ERROR')});if(!writeQueue(playerId,q))throw error;let authority=overlayQueue(playerId,readSnapshot(playerId)||{profile:{playerId,nickname:clean(payload?.nickname)||'Player'},progress:defaultProgress(playerId),assignment:null});saveSnapshot(playerId,authority);return {ok:true,mode:'firebase',sourceOfTruth:'Durable local queue pending Firestore',receiptId:id,queued:true,durableQueued:true,persisted:false,authority,progress:authority.progress,passed:kind==='game'?authority.progress.passed.includes(clean(payload?.stageId)):true,accuracy:kind==='game'?Number(authority.progress.bestScores?.[clean(payload?.stageId)]||0):undefined,version:VERSION}}
let flushing=false,lastFlush=0;
async function flush(playerId){const id=clean(playerId);if(!id||flushing||Date.now()-lastFlush<15000)return {ok:false,skipped:true};flushing=true;lastFlush=Date.now();let q=readQueue(id),done=0;try{while(q.length){const item=q[0];try{const r=item.kind==='assessment'?await base.submitAssessment(item.payload):await base.submitGame(item.payload);if(!r?.ok)throw new Error(r?.error||'QUEUE_FLUSH_FAILED');q.shift();writeQueue(id,q);done++;if(r.authority)saveSnapshot(id,r.authority)}catch(error){if(transient(error))break;item.lastError=String(error?.message||error);item.failedAt=nowIso();q[0]=item;writeQueue(id,q);break}}}finally{flushing=false}return {ok:true,flushed:done,pending:q.length}}
async function resume(playerId,nickname){const id=clean(playerId);try{const r=await base.resume(id,nickname);saveSnapshot(id,r);const out=overlayQueue(id,r);if(readQueue(id).length)setTimeout(()=>flush(id),1200);return out}catch(error){const snap=readSnapshot(id);if(transient(error)&&snap)return overlayQueue(id,snap);throw error}}
async function profileLookup(playerId,nickname){try{return await base.profileLookup(playerId,nickname)}catch(error){const snap=readSnapshot(playerId);if(transient(error)&&snap?.profile)return {ok:true,mode:'firebase',sourceOfTruth:'Durable snapshot',profile:snap.profile,queuedPending:true};throw error}}
async function submitAssessment(payload){try{const r=await base.submitAssessment(payload);if(r?.authority)saveSnapshot(payload.playerId,r.authority);return r}catch(error){if(!transient(error))throw error;return enqueue('assessment',payload,error)}}
async function submitGame(payload){try{const r=await base.submitGame(payload);if(r?.authority)saveSnapshot(payload.playerId,r.authority);return r}catch(error){if(!transient(error))throw error;return enqueue('game',payload,error)}}
const wrapped=Object.freeze({...base,profileLookup,resume,submitAssessment,submitGame,flushDurableQueue:flush,durableQueueVersion:VERSION});
try{Object.defineProperty(window,'EW_AUTHORITY',{configurable:true,enumerable:true,writable:true,value:wrapped})}catch(_){window.EW_AUTHORITY=wrapped}
function activePlayer(){try{return JSON.parse(localStorage.getItem(window.EW_CONFIG?.cacheKeys?.identity||'ew_passport_identity_v1')||'null')?.playerId||''}catch(_){return ''}}
window.addEventListener('online',()=>{const id=activePlayer();if(id)setTimeout(()=>flush(id),800)});window.addEventListener('focus',()=>{const id=activePlayer();if(id&&readQueue(id).length)setTimeout(()=>flush(id),1200)});setTimeout(()=>{const id=activePlayer();if(id&&readQueue(id).length)flush(id)},2500);
window.EW_DURABLE_QUEUE=Object.freeze({version:VERSION,pending:playerId=>readQueue(playerId).length,flush});
}());