(function () {
  "use strict";

  const VERSION = "2026-08-11-SPARK-EVENT-DAY-LIGHT-R9-OWNERSHIP-SELFHEAL";
  const EVENT_DAY_LIGHT = true;
  const CLAIM_CACHE_KEY = "ew_eventday_claimed_player_v2";
  const LEGACY_CLAIM_CACHE_KEY = "ew_eventday_claimed_player_v1";
  const PASS_MARKS = Object.freeze({word_match:70,category_forest:70,sentence_city:70,word_detective:70,final_boss:65});
  const FLOW = ["pre_challenge","word_match","category_forest","sentence_city","word_detective","final_boss","post_challenge","certificate"];

  // Capture Direct Authority once. Never re-read window.EW_AUTHORITY after the
  // proxy is installed; doing so can recurse into the proxy and crash the page.
  const direct = window.EW_AUTHORITY;
  if (!direct || !direct.directFirestoreVersion || typeof direct.resume !== "function" || typeof direct.submitGame !== "function") {
    console.error("LEXICON X Event-Day Light: Direct Authority must load before bridge");
    return;
  }

  const runtime = {
    mode:"firebase",
    lastError:"",
    lastSuccessAt:new Date().toISOString(),
    projectId:direct.firebaseProjectId || "englishweek-95869",
    transport:"firebase-web-sdk-firestore-direct",
    eventDayLightMode:true
  };

  function emit(){window.dispatchEvent(new CustomEvent("ew-authority-status",{detail:{...runtime,endpointReady:true}}));}
  function clean(v){return String(v==null?"":v).trim();}
  function nowIso(){return new Date().toISOString();}

  function readClaim(){
    try{
      const raw=localStorage.getItem(CLAIM_CACHE_KEY);
      if(raw){
        const parsed=JSON.parse(raw);
        return {playerId:clean(parsed?.playerId),authUid:clean(parsed?.authUid)};
      }
      // Old cache remembered only playerId and cannot prove current UID ownership.
      // Return it with an empty UID so the first R9 call safely re-claims once.
      const legacy=clean(localStorage.getItem(LEGACY_CLAIM_CACHE_KEY));
      return {playerId:legacy,authUid:""};
    }catch(_){return {playerId:"",authUid:""};}
  }

  function writeClaim(playerId,authUid){
    try{
      localStorage.setItem(CLAIM_CACHE_KEY,JSON.stringify({playerId:clean(playerId),authUid:clean(authUid),verifiedAt:nowIso()}));
      localStorage.removeItem(LEGACY_CLAIM_CACHE_KEY);
    }catch(_){}
  }

  async function call(name,args){
    const fn=direct && direct[name];
    if(typeof fn!=="function") throw new Error("DIRECT_METHOD_MISSING: "+name);
    return fn.apply(direct,args||[]);
  }

  async function currentAuthUid(){
    const health=await call("health",[]);
    const uid=clean(health?.authUid || direct.getRuntimeStatus?.()?.authUid);
    if(!uid) throw new Error("FIREBASE_AUTH_UID_MISSING");
    return uid;
  }

  async function ensureOwnership(playerId,nickname,force){
    const id=clean(playerId);
    if(!id) throw new Error("PLAYER_ID_REQUIRED");
    const authUid=await currentAuthUid();
    const claim=readClaim();
    if(!force && claim.playerId===id && claim.authUid===authUid){
      return {ok:true,reclaimed:false,authUid};
    }

    // Direct resume re-establishes ewp_player_sessions/{authUid} ownership. This
    // costs writes only when first claiming, changing player, or Auth UID rotates.
    const result=await call("resume",[id,nickname]);
    if(!result?.ok) throw new Error(result?.error || "OWNERSHIP_RECLAIM_FAILED");
    writeClaim(id,authUid);
    runtime.lastSuccessAt=nowIso();emit();
    return {ok:true,reclaimed:true,authUid,result};
  }

  async function lightResume(playerId,nickname){
    const id=clean(playerId);
    if(!id) throw new Error("PLAYER_ID_REQUIRED");

    const ownership=await ensureOwnership(id,nickname,false);
    // When ownership had to be restored, Direct Authority already returned the
    // complete authoritative state; reuse it and avoid duplicate Firestore reads.
    if(ownership.reclaimed && ownership.result){
      return {...ownership.result,eventDayLightMode:true,lightVersion:VERSION};
    }

    // Normal Passport returns are read-only: no session/lastSeen writes.
    const db=firebase.firestore();
    const [p,a,g]=await Promise.all([
      db.collection("ewp_profiles").doc(id).get(),
      db.collection("ewp_assignments").doc(id).get(),
      db.collection("ewp_progress").doc(id).get()
    ]);
    if(!p.exists) throw new Error("PLAYER_NOT_FOUND");
    runtime.lastSuccessAt=nowIso();emit();
    return {
      ok:true,mode:"firebase",sourceOfTruth:"Cloud Firestore Event-Day Light",
      profile:{playerId:id,...(p.data()||{})},
      assignment:a.exists?{playerId:id,...(a.data()||{})}:null,
      progress:g.exists?{playerId:id,...(g.data()||{})}:null,
      eventDayLightMode:true,version:VERSION
    };
  }

  function nextProgress(current,stageId,accuracy){
    const passed=Array.isArray(current?.passed)?[...new Set(current.passed.map(clean).filter(Boolean))]:[];
    const bestScores=current?.bestScores&&typeof current.bestScores==="object"?{...current.bestScores}:{};
    bestScores[stageId]=Math.max(Number(bestScores[stageId]||0),accuracy);
    if(accuracy>=PASS_MARKS[stageId]&&!passed.includes(stageId)) passed.push(stageId);

    const unlocked=["pre_challenge"];
    if(current?.preDone) unlocked.push("word_match");
    if(passed.includes("word_match")) unlocked.push("category_forest");
    if(passed.includes("category_forest")) unlocked.push("sentence_city");
    if(passed.includes("sentence_city")) unlocked.push("word_detective");
    if(passed.includes("word_detective")) unlocked.push("final_boss");
    if(passed.includes("final_boss")) unlocked.push("post_challenge");
    if(current?.postDone) unlocked.push("certificate");

    return {
      playerId:clean(current?.playerId),passed,bestScores,unlocked,
      currentStage:unlocked[unlocked.length-1],
      preDone:Boolean(current?.preDone),postDone:Boolean(current?.postDone),
      finalDone:Boolean(current?.finalDone||passed.includes("final_boss")),
      certificateEligible:Boolean(current?.certificateEligible||current?.postDone),
      totalScore:Object.values(bestScores).reduce((s,v)=>s+Number(v||0),0),
      updatedAt:nowIso()
    };
  }

  async function writeLightProgress(playerId,stageId,accuracy){
    const db=firebase.firestore();
    const ref=db.collection("ewp_progress").doc(playerId);
    let progress=null;
    await db.runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(!snap.exists) throw new Error("PROGRESS_NOT_FOUND");
      const current={playerId,...(snap.data()||{})};
      const allowed=Array.isArray(current.unlocked)?current.unlocked:FLOW;
      if(!allowed.includes(stageId)) throw new Error("STAGE_LOCKED");
      progress=nextProgress(current,stageId,accuracy);
      tx.set(ref,progress,{merge:true});
    });
    return progress;
  }

  function isPermissionError(error){
    const code=clean(error?.code).toLowerCase();
    const msg=clean(error?.message).toLowerCase();
    return code.includes("permission-denied") || msg.includes("missing or insufficient permissions") || msg.includes("permission-denied");
  }

  async function lightSubmitGame(payload){
    const playerId=clean(payload?.playerId),stageId=clean(payload?.stageId);
    if(!playerId||!Object.prototype.hasOwnProperty.call(PASS_MARKS,stageId)) throw new Error("INVALID_GAME_PAYLOAD");
    const total=Math.max(0,Number(payload?.total||0));
    const score=Math.max(0,Number(payload?.score||0));
    const accuracy=total>0?Math.round(score/total*100):0;
    const nickname=clean(payload?.nickname);

    await ensureOwnership(playerId,nickname,false);
    let progress=null;
    try{
      progress=await writeLightProgress(playerId,stageId,accuracy);
    }catch(error){
      // Self-heal stale/missing ownership once. We keep Rules strict; the client
      // repairs only its own session binding, then retries the same one progress write.
      if(!isPermissionError(error)) throw error;
      await ensureOwnership(playerId,nickname,true);
      progress=await writeLightProgress(playerId,stageId,accuracy);
    }

    runtime.lastSuccessAt=nowIso();emit();
    return {
      ok:true,mode:"firebase",sourceOfTruth:"Cloud Firestore Event-Day Light",
      receiptId:`light-${stageId}-${Date.now()}`,stageId,accuracy,
      passMark:PASS_MARKS[stageId],passed:accuracy>=PASS_MARKS[stageId],
      progress,authority:{ok:true,mode:"firebase",progress},
      eventDayLightMode:true,version:VERSION
    };
  }

  async function lightSubmitEvent(payload){
    runtime.lastSuccessAt=nowIso();
    return {ok:true,skipped:true,persisted:false,eventDayLightMode:true,receiptId:`event-skipped-${Date.now()}`,eventName:clean(payload?.eventName||payload?.type),version:VERSION};
  }
  async function lightSaveCheckpoint(payload){return {ok:true,skipped:true,persisted:false,checkpoint:{...(payload||{}),eventDayLightMode:true},version:VERSION};}
  async function lightGetCheckpoint(){return {ok:true,mode:"firebase",checkpoint:null,eventDayLightMode:true,version:VERSION};}
  async function lightClearCheckpoint(){return {ok:true,mode:"firebase",cleared:true,skipped:true,eventDayLightMode:true,version:VERSION};}
  function endpointReady(){return true;}
  function getRuntimeStatus(){
    let directStatus=null;
    try{directStatus=typeof direct.getRuntimeStatus==="function"?direct.getRuntimeStatus():null;}catch(_){}
    return Object.freeze({...runtime,...(directStatus||{}),endpointReady:true,bridgeVersion:VERSION,eventDayLightMode:true});
  }

  const proxy=Object.freeze({
    ...direct,
    modeName:"firestore-direct-event-day-light",
    sourceOfTruth:"Cloud Firestore Event-Day Light",
    firebaseProjectId:direct.firebaseProjectId||"englishweek-95869",
    endpointReady,
    health:(...args)=>call("health",args),
    profileLookup:(...args)=>call("profileLookup",args),
    resume:(...args)=>lightResume(args[0],args[1]),
    submitAssessment:(...args)=>call("submitAssessment",args),
    submitGame:(...args)=>lightSubmitGame(args[0]),
    submitEvent:(...args)=>lightSubmitEvent(args[0]),
    leaderboard:(...args)=>call("leaderboard",args),
    saveAssessmentCheckpoint:(...args)=>lightSaveCheckpoint(args[0]),
    getAssessmentCheckpoint:(...args)=>lightGetCheckpoint(...args),
    clearAssessmentCheckpoint:(...args)=>lightClearCheckpoint(...args),
    getRuntimeStatus,
    compatibilityBridgeVersion:VERSION,
    eventDayLightMode:true
  });

  window.EW_AUTHORITY=proxy;
  window.EW_EVENT_DAY_LIGHT_MODE=Object.freeze({
    enabled:true,version:VERSION,gameWritesPerAttempt:1,eventWritesPerEvent:0,
    checkpointWrites:0,repeatedResumeWrites:0,ownershipSelfHeal:true
  });
  runtime.lastSuccessAt=nowIso();emit();
}());