(function(){
'use strict';

const VERSION='2026-08-18-QUOTA-ULTRALIGHT-V1';
const base=window.EW_AUTHORITY;
if(!base||!window.firebase?.firestore||!window.firebase?.auth){
  console.warn('EW quota ultra-light: prerequisites not ready');
  return;
}

const cfg=window.EW_CONFIG||{};
const PASS_MARKS=Object.freeze({...({word_match:55,category_forest:60,sentence_city:60,word_detective:60,final_boss:60}),...(cfg.gamePassMarks||{})});
const COL=Object.freeze({profiles:'ewp_profiles',sessions:'ewp_player_sessions',progress:'ewp_progress',assignments:'ewp_assignments',assessments:'ewp_assessments',gameResults:'ewp_game_results',gameSummary:'ewp_game_summary',certificates:'ewp_certificates'});
const PROFILE_TTL=30*60*1000;
const RETURN_CACHE_TTL=2*60*1000;
const clean=v=>String(v==null?'':v).trim();
const nowIso=()=>new Date().toISOString();
const uid=prefix=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
const unique=a=>[...new Set((Array.isArray(a)?a:[]).map(clean).filter(Boolean))];
let memoryProfile=null;
let memoryProfileAt=0;
let memoryPlayer='';

function isQaPlayer(playerId){const id=clean(playerId);return /^(QA|TEST)[-_]/i.test(id)||/^99\d{4,}$/.test(id)}
function runtime(){return base.getRuntimeStatus?.()||{mode:'firebase',projectId:cfg.firebaseProjectId||'englishweek-95869'}}
function markRuntimeError(error){try{window.dispatchEvent(new CustomEvent('ew-authority-status',{detail:{...runtime(),mode:'error',lastError:String(error?.message||error||'FIREBASE_ERROR'),endpointReady:true}}))}catch(_){}}

async function ensureUser(){
  if(window.EW_STUDENT_AUTH_ISOLATION?.ensure)return window.EW_STUDENT_AUTH_ISOLATION.ensure();
  const auth=firebase.auth();
  if(auth.currentUser?.isAnonymous)return auth.currentUser;
  if(auth.currentUser)await auth.signOut();
  const r=await auth.signInAnonymously();
  return r?.user||auth.currentUser;
}
function db(){return firebase.firestore()}
function claimKey(uidValue,playerId){return `ew_quota_claim_v1::${uidValue}::${playerId}`}
function profileKey(playerId){return `ew_quota_profile_v1::${playerId}`}
function returnKey(playerId){return `ew_quota_return_v1::${playerId}`}
function readJson(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch(_){return null}}
function writeJson(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch(_){}}
function removeKey(key){try{localStorage.removeItem(key)}catch(_){}}

async function claimIfNeeded(playerId,force=false){
  const user=await ensureUser();
  const key=claimKey(user.uid,playerId);
  if(!force&&readJson(key)?.ok)return user;
  await db().collection(COL.sessions).doc(user.uid).set({uid:user.uid,playerId,claimedAt:nowIso(),updatedAt:nowIso(),sourceVersion:VERSION},{merge:true});
  writeJson(key,{ok:true,at:Date.now()});
  return user;
}
function permissionError(error){const x=`${error?.code||''} ${error?.message||error||''}`.toLowerCase();return x.includes('permission-denied')||x.includes('missing or insufficient permissions')}

function reconcileProgress(value,playerId){
  const passed=unique(value?.passed).filter(s=>Object.prototype.hasOwnProperty.call(PASS_MARKS,s));
  const bestScores=value?.bestScores&&typeof value.bestScores==='object'?{...value.bestScores}:{};
  const preDone=Boolean(value?.preDone),postDone=Boolean(value?.postDone);
  const unlocked=['pre_challenge'];
  if(preDone)unlocked.push('word_match');
  if(passed.includes('word_match'))unlocked.push('category_forest');
  if(passed.includes('category_forest'))unlocked.push('sentence_city');
  if(passed.includes('sentence_city'))unlocked.push('word_detective');
  if(passed.includes('word_detective'))unlocked.push('final_boss');
  if(passed.includes('final_boss'))unlocked.push('post_challenge');
  if(postDone)unlocked.push('certificate');
  const totalScore=Object.values(bestScores).reduce((s,v)=>s+Number(v||0),0);
  return {...value,playerId,passed,bestScores,preDone,postDone,unlocked,currentStage:unlocked[unlocked.length-1],finalDone:Boolean(value?.finalDone||passed.includes('final_boss')),certificateEligible:Boolean(value?.certificateEligible||postDone),totalScore,updatedAt:value?.updatedAt||nowIso()};
}
function defaultProgress(playerId){return reconcileProgress({playerId,passed:[],bestScores:{},preDone:false,postDone:false,finalDone:false,certificateEligible:false,certificate:null},playerId)}
function localAssignment(playerId){
  const a=window.EW_ROTATION?.getAssignment?.(playerId)||null;
  return a?{playerId,...a}:{playerId,passportRotation:'P1',assessmentRotation:'R1',preForm:'A',postForm:'B',assignmentSource:'quota-ultralight-local'};
}
function cacheProfile(profile){
  if(!profile?.playerId)return;
  memoryProfile=profile;memoryPlayer=profile.playerId;memoryProfileAt=Date.now();
  writeJson(profileKey(profile.playerId),{profile,at:memoryProfileAt});
}
function cachedProfile(playerId){
  if(memoryPlayer===playerId&&memoryProfile&&Date.now()-memoryProfileAt<PROFILE_TTL)return memoryProfile;
  const c=readJson(profileKey(playerId));
  if(c?.profile&&Date.now()-Number(c.at||0)<PROFILE_TTL){memoryProfile=c.profile;memoryPlayer=playerId;memoryProfileAt=Number(c.at||0);return c.profile}
  return null;
}
function writeReturnAuthority(playerId,authority){writeJson(returnKey(playerId),{authority,at:Date.now(),used:false})}
function consumeReturnAuthority(playerId){
  const c=readJson(returnKey(playerId));
  if(!c?.authority||c.used||Date.now()-Number(c.at||0)>RETURN_CACHE_TTL){if(c)removeKey(returnKey(playerId));return null}
  c.used=true;writeJson(returnKey(playerId),c);return c.authority;
}

async function profileLookup(playerId,nickname){
  const id=clean(playerId);if(!id)throw new Error('PLAYER_ID_REQUIRED');
  try{
    await claimIfNeeded(id,false);
    const cached=cachedProfile(id);
    if(cached)return {ok:true,mode:'firebase',sourceOfTruth:'Cloud Firestore Direct Authority • quota-ultralight-cache',profile:cached,version:VERSION};
    const ref=db().collection(COL.profiles).doc(id);let snap=await ref.get();let profile;
    if(!snap.exists){
      if(!isQaPlayer(id))throw new Error('PLAYER_NOT_FOUND');
      const label=clean(nickname)||`Test Player ${id}`;
      profile={playerId:id,fullName:label,nickname:label,groupName:'English Week QA',institution:'QA',active:true,profileSource:'quota-ultralight-qa-registration',createdAt:nowIso(),updatedAt:nowIso()};
      await ref.set(profile);
    }else profile={playerId:id,...(snap.data()||{})};
    if(profile.active===false)throw new Error('PLAYER_INACTIVE');
    cacheProfile(profile);
    return {ok:true,mode:'firebase',sourceOfTruth:'Cloud Firestore Direct Authority • quota-ultralight',profile,version:VERSION};
  }catch(error){markRuntimeError(error);throw error}
}

async function cloudResume(playerId,nickname,retry=true){
  const id=clean(playerId);if(!id)throw new Error('PLAYER_ID_REQUIRED');
  try{
    await claimIfNeeded(id,false);
    let profile=cachedProfile(id);
    if(!profile){const p=await profileLookup(id,nickname);profile=p.profile}
    const refs=[db().collection(COL.progress).doc(id),db().collection(COL.assignments).doc(id)];
    const [pSnap,aSnap]=await Promise.all(refs.map(r=>r.get()));
    let progress=pSnap.exists?reconcileProgress({playerId:id,...(pSnap.data()||{})},id):defaultProgress(id);
    if(!pSnap.exists)await refs[0].set(progress);
    let assignment=aSnap.exists?{playerId:id,...(aSnap.data()||{})}:localAssignment(id);
    if(!aSnap.exists)await refs[1].set({...assignment,playerId:id,updatedAt:nowIso(),sourceVersion:VERSION});
    return {ok:true,mode:'firebase',sourceOfTruth:'Cloud Firestore Direct Authority • quota-ultralight',profile,progress,assignment,version:VERSION};
  }catch(error){
    if(retry&&permissionError(error)){await claimIfNeeded(id,true);return cloudResume(id,nickname,false)}
    markRuntimeError(error);throw error;
  }
}
async function resume(playerId,nickname){
  const id=clean(playerId);const returned=consumeReturnAuthority(id);if(returned)return returned;
  return cloudResume(id,nickname,true);
}

async function submitAssessment(payload,retry=true){
  const playerId=clean(payload?.playerId),type=clean(payload?.assessmentType).toLowerCase();
  if(!playerId||!['pre','post'].includes(type))throw new Error('INVALID_ASSESSMENT_PAYLOAD');
  try{
    await claimIfNeeded(playerId,false);
    const receiptId=uid(`assessment-${type}`),progressRef=db().collection(COL.progress).doc(playerId),assessmentRef=db().collection(COL.assessments).doc(receiptId),certificateRef=db().collection(COL.certificates).doc(playerId);let nextProgress;
    await db().runTransaction(async tx=>{
      const snap=await tx.get(progressRef);const current=snap.exists?reconcileProgress({playerId,...(snap.data()||{})},playerId):defaultProgress(playerId);
      if(type==='post'&&!current.passed.includes('final_boss'))throw new Error('POST_NOT_UNLOCKED');
      const draft={...current};
      if(type==='pre')draft.preDone=true;
      if(type==='post'){
        draft.postDone=true;draft.certificateEligible=true;
        if(!draft.certificate)draft.certificate={certificateId:uid('EW-CERT'),issuedAt:nowIso(),awardLevel:'English Week Participant'};
        tx.set(certificateRef,{playerId,...draft.certificate,totalScore:draft.totalScore||0,updatedAt:nowIso(),sourceVersion:VERSION},{merge:true});
      }
      nextProgress=reconcileProgress(draft,playerId);
      tx.set(progressRef,nextProgress,{merge:true});
      tx.set(assessmentRef,{...payload,playerId,receiptId,assessmentType:type,submittedAt:nowIso(),sourceVersion:VERSION,authorityMode:'firestore-direct-quota-ultralight'});
    });
    const authority={ok:true,mode:'firebase',sourceOfTruth:'Cloud Firestore Direct Authority • quota-ultralight',profile:cachedProfile(playerId)||{playerId,nickname:clean(payload?.nickname)||'Player'},progress:nextProgress,assignment:localAssignment(playerId),version:VERSION};
    writeReturnAuthority(playerId,authority);
    return {ok:true,mode:'firebase',sourceOfTruth:authority.sourceOfTruth,receiptId,authority,version:VERSION};
  }catch(error){if(retry&&permissionError(error)){await claimIfNeeded(playerId,true);return submitAssessment(payload,false)}markRuntimeError(error);throw error}
}

async function submitGame(payload,retry=true){
  const playerId=clean(payload?.playerId),stageId=clean(payload?.stageId);
  if(!playerId||!Object.prototype.hasOwnProperty.call(PASS_MARKS,stageId))throw new Error('INVALID_GAME_PAYLOAD');
  try{
    await claimIfNeeded(playerId,false);
    const total=Math.max(1,Number(payload?.total||100)),score=Math.max(0,Number(payload?.score||0)),accuracy=Math.round(score/total*100),passMark=Number(PASS_MARKS[stageId]||60),passed=accuracy>=passMark,receiptId=uid(`game-${stageId}`);
    const progressRef=db().collection(COL.progress).doc(playerId),resultRef=db().collection(COL.gameResults).doc(receiptId),summaryRef=db().collection(COL.gameSummary).doc(playerId);let nextProgress;
    await db().runTransaction(async tx=>{
      const snap=await tx.get(progressRef);const current=snap.exists?reconcileProgress({playerId,...(snap.data()||{})},playerId):defaultProgress(playerId);
      if(!current.unlocked.includes(stageId))throw new Error('STAGE_LOCKED');
      const bestScores={...current.bestScores,[stageId]:Math.max(Number(current.bestScores?.[stageId]||0),accuracy)};
      const passedStages=[...current.passed];if(passed&&!passedStages.includes(stageId))passedStages.push(stageId);
      nextProgress=reconcileProgress({...current,bestScores,passed:passedStages,finalDone:current.finalDone||(stageId==='final_boss'&&passed)},playerId);
      tx.set(progressRef,nextProgress,{merge:true});
      tx.set(resultRef,{...payload,playerId,stageId,receiptId,accuracy,passMark,passed,submittedAt:nowIso(),sourceVersion:VERSION,authorityMode:'firestore-direct-quota-ultralight'});
      tx.set(summaryRef,{playerId,totalScore:nextProgress.totalScore,bestScores:nextProgress.bestScores,passed:nextProgress.passed,currentStage:nextProgress.currentStage,updatedAt:nowIso(),sourceVersion:VERSION},{merge:true});
    });
    const authority={ok:true,mode:'firebase',sourceOfTruth:'Cloud Firestore Direct Authority • quota-ultralight',profile:cachedProfile(playerId)||{playerId,nickname:clean(payload?.nickname)||'Player'},progress:nextProgress,assignment:localAssignment(playerId),version:VERSION};
    writeReturnAuthority(playerId,authority);
    return {ok:true,mode:'firebase',sourceOfTruth:authority.sourceOfTruth,receiptId,accuracy,passMark,passed,progress:nextProgress,authority,version:VERSION};
  }catch(error){if(retry&&permissionError(error)){await claimIfNeeded(playerId,true);return submitGame(payload,false)}markRuntimeError(error);throw error}
}

const optimized=Object.freeze({...base,profileLookup,resume,submitAssessment,submitGame,passMarks:PASS_MARKS,passPolicyVersion:VERSION,quotaMode:'ultralight'});
try{Object.defineProperty(window,'EW_AUTHORITY',{configurable:true,enumerable:true,writable:true,value:optimized})}catch(_){window.EW_AUTHORITY=optimized}
window.EW_QUOTA_ULTRALIGHT=Object.freeze({version:VERSION,profileTtlMs:PROFILE_TTL,returnCacheTtlMs:RETURN_CACHE_TTL,passMarks:PASS_MARKS});
window.dispatchEvent(new CustomEvent('ew-quota-ultralight-ready',{detail:{version:VERSION}}));
}());
