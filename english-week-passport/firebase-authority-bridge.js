(function () {
  "use strict";

  const VERSION = "2026-08-12-SPARK-EVENT-DAY-LIGHT-R13-READ-BUDGET";
  const CLAIM_CACHE_KEY = "ew_eventday_claimed_player_v3";
  const RESUME_CACHE_KEY = "ew_eventday_resume_cache_v1";
  const RESUME_CACHE_TTL_MS = 15 * 60 * 1000;
  const PASS_MARKS = Object.freeze({word_match:55,category_forest:60,sentence_city:60,word_detective:60,final_boss:60});
  const FLOW = ["pre_challenge","word_match","category_forest","sentence_city","word_detective","final_boss","post_challenge","certificate"];

  const direct = window.EW_AUTHORITY;
  if (!direct || !direct.directFirestoreVersion || typeof direct.resume !== "function" || typeof direct.submitGame !== "function") {
    console.error("LEXICON X Event-Day Light R13: Direct Authority must load before bridge");
    return;
  }

  const runtime = {
    mode:"firebase",
    lastError:"",
    lastSuccessAt:new Date().toISOString(),
    projectId:direct.firebaseProjectId || "englishweek-95869",
    transport:"firebase-web-sdk-firestore-direct",
    eventDayLightMode:true,
    ownershipVerified:false,
    resumeCacheHits:0,
    resumeCacheMisses:0
  };

  function emit(){window.dispatchEvent(new CustomEvent("ew-authority-status",{detail:{...runtime,endpointReady:true}}));}
  function clean(v){return String(v==null?"":v).trim();}
  function nowIso(){return new Date().toISOString();}
  function db(){return firebase.firestore();}

  function readClaim(){
    try{
      const raw=localStorage.getItem(CLAIM_CACHE_KEY);
      if(!raw)return {playerId:"",authUid:""};
      const parsed=JSON.parse(raw);
      return {playerId:clean(parsed?.playerId),authUid:clean(parsed?.authUid)};
    }catch(_){return {playerId:"",authUid:""};}
  }

  function writeClaim(playerId,authUid){
    try{localStorage.setItem(CLAIM_CACHE_KEY,JSON.stringify({playerId:clean(playerId),authUid:clean(authUid),verifiedAt:nowIso()}));}catch(_){}
  }

  function readResumeCache(playerId,authUid){
    try{
      const raw=localStorage.getItem(RESUME_CACHE_KEY);
      if(!raw)return null;
      const value=JSON.parse(raw);
      if(clean(value?.playerId)!==clean(playerId) || clean(value?.authUid)!==clean(authUid)) return null;
      if(!Number.isFinite(Number(value?.cachedAt)) || Date.now()-Number(value.cachedAt)>RESUME_CACHE_TTL_MS) return null;
      if(!value?.profile || !value?.progress) return null;
      return value;
    }catch(_){return null;}
  }

  function writeResumeCache(playerId,authUid,data){
    try{
      const value={
        playerId:clean(playerId),authUid:clean(authUid),cachedAt:Date.now(),
        profile:data?.profile||null,assignment:data?.assignment||null,progress:data?.progress||null
      };
      localStorage.setItem(RESUME_CACHE_KEY,JSON.stringify(value));
    }catch(_){}
  }

  function patchResumeCache(playerId,patch){
    try{
      const claim=readClaim();
      const cached=readResumeCache(playerId,claim.authUid);
      if(!cached)return;
      writeResumeCache(playerId,claim.authUid,{
        profile:patch?.profile||cached.profile,
        assignment:patch?.assignment||cached.assignment,
        progress:patch?.progress||cached.progress
      });
    }catch(_){}
  }

  function clearResumeCache(){try{localStorage.removeItem(RESUME_CACHE_KEY);}catch(_){}}

  async function call(name,args){
    const fn=direct && direct[name];
    if(typeof fn!=="function") throw new Error("DIRECT_METHOD_MISSING: "+name);
    return fn.apply(direct,args||[]);
  }

  async function ensureCurrentUser(){
    let user=firebase.auth().currentUser;
    if(!user){
      await call("health",[]);
      user=firebase.auth().currentUser;
    }
    if(!user?.uid) throw new Error("FIREBASE_AUTH_UID_MISSING");
    return user;
  }

  async function verifyOwnership(playerId,force){
    const id=clean(playerId);
    if(!id) throw new Error("PLAYER_ID_REQUIRED");
    const user=await ensureCurrentUser();
    const uid=clean(user.uid);
    const claim=readClaim();

    // Safe fast path: same browser + same anonymous Firebase UID + same claimed player.
    // Firestore Rules remain the final authority on every write; permission failures self-repair below.
    if(!force && claim.playerId===id && claim.authUid===uid){
      runtime.ownershipVerified=true;
      return {ok:true,repaired:false,authUid:uid,cached:true};
    }

    const sessionRef=db().collection("ewp_player_sessions").doc(uid);
    const snap=await sessionRef.get();
    const owned=snap.exists && clean(snap.data()?.playerId)===id && clean(snap.data()?.uid || uid)===uid;
    if(!owned){
      await sessionRef.set({
        uid,
        playerId:id,
        claimedAt:snap.exists ? (snap.data()?.claimedAt || nowIso()) : nowIso(),
        updatedAt:nowIso(),
        sourceVersion:VERSION,
        sourceMode:"event-day-light-r13-read-budget"
      },{merge:true});
    }

    // No second verification read: Firestore Rules validate subsequent reads/writes.
    writeClaim(id,uid);
    runtime.ownershipVerified=true;
    runtime.lastSuccessAt=nowIso();
    emit();
    return {ok:true,repaired:!owned,authUid:uid,cached:false};
  }

  async function lightResume(playerId,nickname){
    const id=clean(playerId);
    if(!id) throw new Error("PLAYER_ID_REQUIRED");

    const owner=await verifyOwnership(id,false);
    const cached=readResumeCache(id,owner.authUid);
    if(cached){
      runtime.resumeCacheHits++;
      runtime.lastSuccessAt=nowIso();emit();
      return {
        ok:true,mode:"firebase",sourceOfTruth:"Cloud Firestore Event-Day Light (cached resume)",
        profile:cached.profile,assignment:cached.assignment,progress:cached.progress,
        eventDayLightMode:true,resumeCached:true,version:VERSION
      };
    }

    runtime.resumeCacheMisses++;
    const store=db();
    const [p,a,g]=await Promise.all([
      store.collection("ewp_profiles").doc(id).get(),
      store.collection("ewp_assignments").doc(id).get(),
      store.collection("ewp_progress").doc(id).get()
    ]);
    if(!p.exists) throw new Error("PLAYER_NOT_FOUND");

    if(!g.exists){
      const result=await call("resume",[id,nickname]);
      await verifyOwnership(id,true);
      writeResumeCache(id,owner.authUid,result);
      return {...result,eventDayLightMode:true,lightVersion:VERSION};
    }

    const result={
      ok:true,mode:"firebase",sourceOfTruth:"Cloud Firestore Event-Day Light",
      profile:{playerId:id,...(p.data()||{})},
      assignment:a.exists?{playerId:id,...(a.data()||{})}:null,
      progress:{playerId:id,...(g.data()||{})},
      eventDayLightMode:true,version:VERSION
    };
    writeResumeCache(id,owner.authUid,result);
    runtime.lastSuccessAt=nowIso();emit();
    return result;
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
      playerId:clean(current?.playerId),
      passed,bestScores,unlocked,
      currentStage:unlocked[unlocked.length-1],
      preDone:Boolean(current?.preDone),
      postDone:Boolean(current?.postDone),
      finalDone:Boolean(current?.finalDone||passed.includes("final_boss")),
      certificateEligible:Boolean(current?.certificateEligible||current?.postDone),
      totalScore:Object.values(bestScores).reduce((s,v)=>s+Number(v||0),0),
      updatedAt:nowIso()
    };
  }

  async function writeLightProgress(playerId,stageId,accuracy){
    const store=db();
    const ref=store.collection("ewp_progress").doc(playerId);
    let progress=null;
    await store.runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(!snap.exists) throw new Error("PROGRESS_NOT_FOUND");
      const current={...(snap.data()||{}),playerId};
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

    await verifyOwnership(playerId,false);
    let progress=null;
    try{
      progress=await writeLightProgress(playerId,stageId,accuracy);
    }catch(error){
      if(!isPermissionError(error)) throw error;
      runtime.ownershipVerified=false;
      clearResumeCache();
      await verifyOwnership(playerId,true);
      progress=await writeLightProgress(playerId,stageId,accuracy);
    }

    patchResumeCache(playerId,{progress});
    runtime.lastSuccessAt=nowIso();runtime.lastError="";emit();
    return {
      ok:true,mode:"firebase",sourceOfTruth:"Cloud Firestore Event-Day Light",
      receiptId:`light-${stageId}-${Date.now()}`,stageId,accuracy,
      passMark:PASS_MARKS[stageId],passed:accuracy>=PASS_MARKS[stageId],
      progress,authority:{ok:true,mode:"firebase",progress},
      eventDayLightMode:true,version:VERSION
    };
  }

  async function lightSubmitAssessment(payload){
    const result=await call("submitAssessment",[payload]);
    const playerId=clean(payload?.playerId);
    if(playerId && result?.authority){
      patchResumeCache(playerId,{
        profile:result.authority.profile,
        assignment:result.authority.assignment,
        progress:result.authority.progress
      });
    }else{
      clearResumeCache();
    }
    return result;
  }

  async function lightSubmitEvent(payload){
    runtime.lastSuccessAt=nowIso();
    return {ok:true,mode:"firebase",sourceOfTruth:"Cloud Firestore Event-Day Light",skipped:true,persisted:false,eventDayLightMode:true,receiptId:`event-skipped-${Date.now()}`,eventName:clean(payload?.eventName||payload?.type),version:VERSION};
  }
  async function lightSaveCheckpoint(payload){return {ok:true,mode:"firebase",skipped:true,persisted:false,checkpoint:{...(payload||{}),eventDayLightMode:true},version:VERSION};}
  async function lightGetCheckpoint(){return {ok:true,mode:"firebase",checkpoint:null,eventDayLightMode:true,version:VERSION};}
  async function lightClearCheckpoint(){return {ok:true,mode:"firebase",cleared:true,skipped:true,eventDayLightMode:true,version:VERSION};}
  function endpointReady(){return true;}
  function getRuntimeStatus(){
    let directStatus=null;
    try{directStatus=typeof direct.getRuntimeStatus==="function"?direct.getRuntimeStatus():null;}catch(_){}
    return Object.freeze({...runtime,...(directStatus||{}),endpointReady:true,bridgeVersion:VERSION,eventDayLightMode:true,passMarks:PASS_MARKS});
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
    submitAssessment:(...args)=>lightSubmitAssessment(args[0]),
    submitGame:(...args)=>lightSubmitGame(args[0]),
    submitEvent:(...args)=>lightSubmitEvent(args[0]),
    leaderboard:(...args)=>call("leaderboard",args),
    saveAssessmentCheckpoint:(...args)=>lightSaveCheckpoint(args[0]),
    getAssessmentCheckpoint:(...args)=>lightGetCheckpoint(...args),
    clearAssessmentCheckpoint:(...args)=>lightClearCheckpoint(...args),
    getRuntimeStatus,
    passMark:60,
    passMarks:PASS_MARKS,
    compatibilityBridgeVersion:VERSION,
    eventDayLightMode:true
  });

  window.EW_AUTHORITY=proxy;
  window.EW_EVENT_DAY_LIGHT_MODE=Object.freeze({
    enabled:true,version:VERSION,gameWritesPerAttempt:1,eventWritesPerEvent:0,
    checkpointWrites:0,repeatedResumeWrites:0,ownershipVerified:true,
    cachedResumeReads:0,resumeCacheTtlMs:RESUME_CACHE_TTL_MS,passMarks:PASS_MARKS
  });
  runtime.lastSuccessAt=nowIso();emit();
}());