(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CSAICore=factory()})(typeof self!=='undefined'?self:this,function(){
'use strict';
const KEY='csai2401_progress_v3', VERSION=3, MAX_HISTORY=100;
const PREREQ={1:[],2:[1],3:[2],4:[3],5:[4],6:[5],7:[6],8:[7],9:[8],10:[6,7,8,9],11:[10],12:[11],13:[12],14:[13],15:[10,11,12,13,14]};
const GATE_WEEKS=[5,10,15], STEP_COUNT=3;
const now=()=>new Date().toISOString();
function randomId(){try{if(globalThis.crypto&&typeof globalThis.crypto.randomUUID==='function')return globalThis.crypto.randomUUID();if(globalThis.crypto&&crypto.getRandomValues){const a=new Uint32Array(4);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(8,'0')).join('-')}}catch(_){}return `local-${Date.now()}-${String(typeof performance!=='undefined'&&performance.now?performance.now():0).replace('.','')}`}
function storage(s){if(s&&typeof s.getItem==='function'&&typeof s.setItem==='function')return s;try{return globalThis.localStorage}catch(_){return null}}
function empty(){return {version:VERSION,weeks:{},gates:{},attempts:{},drafts:{},history:[],updatedAt:null}}
function normalize(input){const s=input&&typeof input==='object'?input:empty();return {version:VERSION,weeks:s.weeks&&typeof s.weeks==='object'?s.weeks:{},gates:s.gates&&typeof s.gates==='object'?s.gates:{},attempts:s.attempts&&typeof s.attempts==='object'?s.attempts:{},drafts:s.drafts&&typeof s.drafts==='object'?s.drafts:{},history:Array.isArray(s.history)?s.history.slice(-MAX_HISTORY):[],updatedAt:s.updatedAt||null}}
function load(s){const st=storage(s);if(!st)return empty();try{const raw=st.getItem(KEY);return raw?normalize(JSON.parse(raw)):empty()}catch(_){return empty()}}
function clone(x){return JSON.parse(JSON.stringify(x))}
function persist(state,s){const st=storage(s);if(!st)return {ok:false,reason:'storage-unavailable',state};const next=normalize(clone(state));next.updatedAt=now();try{st.setItem(KEY,JSON.stringify(next));const raw=st.getItem(KEY);const read=raw?normalize(JSON.parse(raw)):null;const ok=!!read&&read.updatedAt===next.updatedAt&&JSON.stringify(read)===JSON.stringify(next);return {ok,reason:ok?null:'readback-mismatch',state:read||next}}catch(_){return {ok:false,reason:'storage-write-failed',state:next}}}
function weekKey(n){return 'w'+Number(n)}
function completed(state,n){
 const k=weekKey(n);
 try{
   if(n===1){
     const lab=String(globalThis.localStorage.getItem('csai2401_w1_lab_complete')||'').toLowerCase()==='true';
     if(!lab)return false;
     if(state.weeks[k]&&state.weeks[k].status==='completed')return true;
     const v=JSON.parse(globalThis.localStorage.getItem('csai2104_diag_v4')||'{}');
     return v.w1===true;
   }
 }catch(_){if(n===1)return false}
 if(state.weeks[k]&&state.weeks[k].status==='completed')return true;
 try{
   if(n===2)return String(globalThis.localStorage.getItem('csai2104_w2_complete')||'').toLowerCase()==='true';
   if(n===3)return String(globalThis.localStorage.getItem('csai2104_w3')||'').toLowerCase()==='cleared';
   if(n===4)return String(globalThis.localStorage.getItem('csai2104_w4')||'').toLowerCase()==='cleared';
   if(n===5)return String(globalThis.localStorage.getItem('csai2104_w5')||'').toLowerCase()==='cleared';
 }catch(_){}
 return false;
}
function prerequisites(n){return (PREREQ[Number(n)]||[]).slice()}
function isUnlocked(n,state){const req=prerequisites(n);return req.every(x=>completed(state,x))}
function status(n,state){const k=weekKey(n),w=state.weeks[k];if(w&&w.status==='completed')return 'completed';if(state.attempts[k]&&!state.attempts[k].used)return 'in-progress';return isUnlocked(n,state)?'available':'locked'}
function result(ok,reason,state){return {ok,reason:reason||null,state}}
function recordHistory(state,event){state.history.push({...event,at:now()});if(state.history.length>MAX_HISTORY)state.history=state.history.slice(-MAX_HISTORY)}
function begin(week,scenarioId,s){const state=load(s),n=Number(week),k=weekKey(n);if(!isUnlocked(n,state))return result(false,'prerequisite-not-complete',state);const existing=state.attempts[k];if(existing&&!existing.used&&existing.challengeId)return {...result(true,'resumed',state),challengeId:existing.challengeId};const a={challengeId:randomId(),week:n,scenarioId:String(scenarioId||''),stepIndex:0,answers:[],score:0,used:false,startedAt:now()};state.attempts[k]=a;const saved=persist(state,s);return {...saved,challengeId:saved.state.attempts[k]&&saved.state.attempts[k].challengeId}}
function submitStep(week,challengeId,stepIndex,optionId,score,evidenceRefs,s){const state=load(s),k=weekKey(week),a=state.attempts[k];if(!a||a.challengeId!==challengeId)return result(false,'challenge-mismatch',state);if(a.used)return result(false,'challenge-already-used',state);if(a.stepIndex!==Number(stepIndex)||a.stepIndex>=STEP_COUNT)return result(false,'step-replay-or-out-of-order',state);if(!String(optionId||'').trim())return result(false,'option-required',state);const stepScore=Number(score);if(!Number.isInteger(stepScore)||stepScore<0||stepScore>2)return result(false,'invalid-step-score',state);const answer={stepIndex:Number(stepIndex),optionId:String(optionId),score:stepScore,evidenceRefs:Array.isArray(evidenceRefs)?evidenceRefs.map(String).slice(0,10):[],at:now()};a.answers.push(answer);a.score=a.answers.reduce((sum,x)=>sum+Number(x.score||0),0);a.stepIndex+=1;const saved=persist(state,s);return {...saved,attempt:saved.state.attempts[k]}}
function finish(week,challengeId,score,artifact,s){const state=load(s),n=Number(week),k=weekKey(n),a=state.attempts[k];if(!a||a.challengeId!==challengeId)return result(false,'challenge-mismatch',state);if(a.used)return result(false,'challenge-already-used',state);if(a.stepIndex!==STEP_COUNT||!Array.isArray(a.answers)||a.answers.length!==STEP_COUNT)return result(false,'steps-incomplete',state);const validScores=a.answers.every((x,i)=>x.stepIndex===i&&Number.isInteger(x.score)&&x.score>=0&&x.score<=2);if(!validScores)return result(false,'assessment-incomplete',state);const isGate=GATE_WEEKS.includes(n),requiredScore=isGate?5:4,stepScores=a.answers.map(x=>x.score),failedSteps=isGate?stepScores.map((x,i)=>x<1?i+1:null).filter(x=>x!==null):[],finalScore=stepScores.reduce((sum,x)=>sum+x,0),passed=finalScore>=requiredScore&&failedSteps.length===0,assessment={isGate,requiredScore,requiresEveryStep:isGate,stepScores,failedSteps,reason:passed?null:(failedSteps.length?'gate-step-not-passed':'score-below-threshold')};a.used=true;a.score=finalScore;recordHistory(state,{type:'attempt-finished',week:n,challengeId,score:finalScore,passed,assessment});if(passed){state.weeks[k]={status:'completed',completed:true,score:finalScore,assessment,artifact:artifact||null,evidenceRefs:a.answers.flatMap(x=>x.evidenceRefs||[]),completedAt:now()};}else{state.weeks[k]={status:'available',completed:false,lastScore:finalScore,assessment,artifact:artifact||null,updatedAt:now()};}const saved=persist(state,s);if(!saved.ok)return {...saved,reason:'pending-save',passed:false,score:finalScore,assessment};return {...saved,passed,score:finalScore,assessment,status:saved.state.weeks[k].status}}
function cancel(week,challengeId,s){const state=load(s),k=weekKey(week),a=state.attempts[k];if(!a||a.challengeId!==challengeId)return result(false,'challenge-mismatch',state);if(a.used)return result(false,'challenge-already-used',state);a.used=true;a.cancelledAt=now();recordHistory(state,{type:'attempt-cancelled',week:Number(week),challengeId});const saved=persist(state,s);return {...saved,status:status(week,saved.state)}}
function recordLegacy(week,payload,s){const state=load(s),k=typeof week==='string'?week:weekKey(week);const body=payload&&typeof payload==='object'?payload:{};const bucket=k.charAt(0).toLowerCase()==='b'?'gates':'weeks';state[bucket][k]={status:'completed',completed:true,score:Number(body.score||0),artifact:body.artifact||null,source:body.source||'legacy',legacyKey:body.legacyKey||null,verifiedAt:now()};recordHistory(state,{type:'legacy-import',week:k,source:body.source||'legacy'});const saved=persist(state,s);return {...saved,passed:saved.ok}}
function clear(s){const st=storage(s);if(!st)return {ok:false,reason:'storage-unavailable'};try{st.removeItem(KEY);return {ok:st.getItem(KEY)===null}}catch(_){return {ok:false,reason:'storage-remove-failed'}}}
return {KEY,VERSION,PREREQ,GATE_WEEKS,load,save:(state,s)=>persist(normalize(state),s),status,isUnlocked,prerequisites,begin,submitStep,finish,cancel,recordLegacy,clear};
});





