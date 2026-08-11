(function () {
  "use strict";

  const VERSION = "2026-08-11-SPARK-EVENT-DAY-LIGHT-R6.1";
  const EVENT_DAY_LIGHT = true;
  const CLAIM_CACHE_KEY='ew_eventday_claimed_player_v1';
  const PASS_MARKS = Object.freeze({word_match:70,category_forest:70,sentence_city:70,word_detective:70,final_boss:65});
  const FLOW = ['pre_challenge','word_match','category_forest','sentence_city','word_detective','final_boss','post_challenge','certificate'];
  const legacy = window.EW_AUTHORITY || {};
  const runtime = {mode:"loading",lastError:"",lastSuccessAt:"",projectId:"englishweek-95869",transport:"firebase-web-sdk-firestore-direct",eventDayLightMode:EVENT_DAY_LIGHT};

  function emit(){window.dispatchEvent(new CustomEvent("ew-authority-status",{detail:{...runtime,endpointReady:true}}));}
  function clean(v){return String(v==null?'':v).trim();}
  function nowIso(){return new Date().toISOString();}
  function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
  function readClaim(){try{return clean(localStorage.getItem(CLAIM_CACHE_KEY));}catch(_){return '';}}
  function writeClaim(id){try{localStorage.setItem(CLAIM_CACHE_KEY,clean(id));}catch(_){} }

  async function waitUntilReady(readyTest,timeoutMs,label){
    if(!readyTest)return true;const started=Date.now();
    while(Date.now()-started<timeoutMs){try{if(readyTest())return true;}catch(_){}await sleep(50);}
    throw new Error("SCRIPT_READY_TIMEOUT: "+label);
  }
  function loadScript(src,readyTest){
    if(readyTest){try{if(readyTest())return Promise.resolve();}catch(_){}}
    const key=src.split("?")[0],existing=[...document.scripts].find(s=>s.src&&s.src.includes(key));
    if(existing)return waitUntilReady(readyTest,8000,key);
    return new Promise((resolve,reject)=>{
      const script=document.createElement("script");let settled=false;
      const timeout=setTimeout(()=>{if(settled)return;settled=true;reject(new Error("SCRIPT_LOAD_TIMEOUT: "+src));},10000);
      function finish(fn,value){if(settled)return;settled=true;clearTimeout(timeout);fn(value);}
      script.src=src;script.async=false;
      script.onload=async()=>{try{await waitUntilReady(readyTest,5000,key);finish(resolve);}catch(error){finish(reject,error);}};
      script.onerror=()=>finish(reject,new Error("SCRIPT_LOAD_FAILED: "+src));document.head.appendChild(script);
    });
  }
  async function bootstrapCore(){
    await loadScript("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",()=>Boolean(window.firebase&&firebase.initializeApp));
    await Promise.all([
      loadScript("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js",()=>Boolean(window.firebase&&firebase.auth)),
      loadScript("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js",()=>Boolean(window.firebase&&firebase.firestore))
    ]);
    await loadScript("./firebase-web-config.js?v=20260811-event-day-r61",()=>Boolean(window.EW_FIREBASE_WEB_CONFIG?.projectId==="englishweek-95869"));
    await loadScript("./firestore-direct-authority-v1.js?v=20260811-event-day-r61",()=>Boolean(window.EW_AUTHORITY?.directFirestoreVersion));
    const direct=window.EW_AUTHORITY;if(!direct?.submitGame||!direct?.resume)throw new Error("DIRECT_FIRESTORE_AUTHORITY_NOT_READY");return direct;
  }
  async function bootstrap(){
    try{
      const direct=await Promise.race([bootstrapCore(),new Promise((_,reject)=>setTimeout(()=>reject(new Error("FIREBASE_BRIDGE_BOOTSTRAP_TIMEOUT")),15000))]);
      runtime.mode="firebase";runtime.lastError="";runtime.lastSuccessAt=nowIso();runtime.projectId=direct.firebaseProjectId||"englishweek-95869";emit();return direct;
    }catch(error){runtime.mode="error";runtime.lastError=String(error?.message||error);emit();throw error;}
  }
  const readyPromise=bootstrap();
  async function call(name,args){
    const direct=await Promise.race([readyPromise,new Promise((_,reject)=>setTimeout(()=>reject(new Error("FIREBASE_AUTHORITY_READY_TIMEOUT")),16000))]);
    if(typeof direct?.[name]!=="function")throw new Error("DIRECT_METHOD_MISSING: "+name);return direct[name](...(args||[]));
  }

  async function lightResume(playerId,nickname){
    const direct=await readyPromise;const id=clean(playerId);
    if(!id)throw new Error('PLAYER_ID_REQUIRED');
    // First entry on this browser must claim ownership through the normal authority.
    if(readClaim()!==id){const result=await direct.resume(id,nickname);writeClaim(id);return {...result,eventDayLightMode:true};}
    // Subsequent returns to Passport are read-only: no repeated session/lastSeen writes.
    await direct.health();
    const db=firebase.firestore();
    const [p,a,g]=await Promise.all([
      db.collection('ewp_profiles').doc(id).get(),
      db.collection('ewp_assignments').doc(id).get(),
      db.collection('ewp_progress').doc(id).get()
    ]);
    if(!p.exists)throw new Error('PLAYER_NOT_FOUND');
    runtime.lastSuccessAt=nowIso();emit();
    return {ok:true,mode:'firebase',sourceOfTruth:'Cloud Firestore Event-Day Light',profile:{playerId:id,...(p.data()||{})},assignment:a.exists?{playerId:id,...(a.data()||{})}:null,progress:g.exists?{playerId:id,...(g.data()||{})}:null,eventDayLightMode:true,version:VERSION};
  }

  function nextProgress(current,stageId,accuracy){
    const passed=Array.isArray(current?.passed)?[...new Set(current.passed.map(clean).filter(Boolean))]:[];
    const bestScores=current?.bestScores&&typeof current.bestScores==='object'?{...current.bestScores}:{};
    bestScores[stageId]=Math.max(Number(bestScores[stageId]||0),accuracy);
    if(accuracy>=PASS_MARKS[stageId]&&!passed.includes(stageId))passed.push(stageId);
    const unlocked=['pre_challenge'];if(current?.preDone)unlocked.push('word_match');if(passed.includes('word_match'))unlocked.push('category_forest');if(passed.includes('category_forest'))unlocked.push('sentence_city');if(passed.includes('sentence_city'))unlocked.push('word_detective');if(passed.includes('word_detective'))unlocked.push('final_boss');if(passed.includes('final_boss'))unlocked.push('post_challenge');if(current?.postDone)unlocked.push('certificate');
    return {playerId:clean(current?.playerId),passed,bestScores,unlocked,currentStage:unlocked[unlocked.length-1],preDone:Boolean(current?.preDone),postDone:Boolean(current?.postDone),finalDone:Boolean(current?.finalDone||passed.includes('final_boss')),certificateEligible:Boolean(current?.certificateEligible||current?.postDone),totalScore:Object.values(bestScores).reduce((s,v)=>s+Number(v||0),0),updatedAt:nowIso()};
  }
  async function lightSubmitGame(payload){
    await readyPromise;const playerId=clean(payload?.playerId),stageId=clean(payload?.stageId);
    if(!playerId||!Object.prototype.hasOwnProperty.call(PASS_MARKS,stageId))throw new Error('INVALID_GAME_PAYLOAD');
    const total=Math.max(0,Number(payload?.total||0)),score=Math.max(0,Number(payload?.score||0)),accuracy=total>0?Math.round(score/total*100):0;
    const db=firebase.firestore(),ref=db.collection('ewp_progress').doc(playerId);let progress=null;
    await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists)throw new Error('PROGRESS_NOT_FOUND');const current={playerId,...(snap.data()||{})};const allowed=Array.isArray(current.unlocked)?current.unlocked:FLOW;if(!allowed.includes(stageId))throw new Error('STAGE_LOCKED');progress=nextProgress(current,stageId,accuracy);tx.set(ref,progress,{merge:true});});
    runtime.lastSuccessAt=nowIso();emit();
    return {ok:true,mode:'firebase',sourceOfTruth:'Cloud Firestore Event-Day Light',receiptId:`light-${stageId}-${Date.now()}`,stageId,accuracy,passMark:PASS_MARKS[stageId],passed:accuracy>=PASS_MARKS[stageId],progress,authority:{ok:true,mode:'firebase',progress},eventDayLightMode:true,version:VERSION};
  }
  async function lightSubmitEvent(payload){
    runtime.lastSuccessAt=nowIso();
    return {ok:true,skipped:true,persisted:false,eventDayLightMode:true,receiptId:`event-skipped-${Date.now()}`,eventName:clean(payload?.eventName||payload?.type),version:VERSION};
  }
  async function lightSaveCheckpoint(payload){return {ok:true,skipped:true,persisted:false,checkpoint:{...(payload||{}),eventDayLightMode:true},version:VERSION};}
  async function lightGetCheckpoint(){return {ok:true,mode:'firebase',checkpoint:null,eventDayLightMode:true,version:VERSION};}
  async function lightClearCheckpoint(){return {ok:true,mode:'firebase',cleared:true,skipped:true,eventDayLightMode:true,version:VERSION};}

  function endpointReady(){return true;}
  function getRuntimeStatus(){const directStatus=window.EW_AUTHORITY?.directFirestoreVersion?window.EW_AUTHORITY.getRuntimeStatus?.():null;return Object.freeze({...runtime,...(directStatus||{}),endpointReady:true,bridgeVersion:VERSION,eventDayLightMode:EVENT_DAY_LIGHT});}

  const proxy=Object.freeze({
    ...(legacy||{}),modeName:"firestore-direct-event-day-light",sourceOfTruth:"Cloud Firestore Direct Authority",firebaseProjectId:"englishweek-95869",endpointReady,
    health:(...args)=>call("health",args),
    profileLookup:(...args)=>call("profileLookup",args),
    resume:(...args)=>EVENT_DAY_LIGHT?lightResume(args[0],args[1]):call("resume",args),
    submitAssessment:(...args)=>call("submitAssessment",args),
    submitGame:(...args)=>EVENT_DAY_LIGHT?lightSubmitGame(args[0]):call("submitGame",args),
    submitEvent:(...args)=>EVENT_DAY_LIGHT?lightSubmitEvent(args[0]):call("submitEvent",args),
    leaderboard:(...args)=>call("leaderboard",args),
    saveAssessmentCheckpoint:(...args)=>EVENT_DAY_LIGHT?lightSaveCheckpoint(args[0]):call("saveAssessmentCheckpoint",args),
    getAssessmentCheckpoint:(...args)=>EVENT_DAY_LIGHT?lightGetCheckpoint(...args):call("getAssessmentCheckpoint",args),
    clearAssessmentCheckpoint:(...args)=>EVENT_DAY_LIGHT?lightClearCheckpoint(...args):call("clearAssessmentCheckpoint",args),
    getRuntimeStatus,compatibilityBridgeVersion:VERSION,eventDayLightMode:EVENT_DAY_LIGHT
  });
  window.EW_AUTHORITY=proxy;
  window.EW_EVENT_DAY_LIGHT_MODE=Object.freeze({enabled:true,version:VERSION,gameWritesPerAttempt:1,eventWritesPerEvent:0,checkpointWrites:0,repeatedResumeWrites:0});
  emit();
}());
