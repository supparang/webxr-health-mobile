(function(){
  'use strict';

  const VERSION = '2026-08-07-FIRESTORE-DIRECT-AUTHORITY-V1';
  const cfg = window.EW_CONFIG || {};
  const webCfg = window.EW_FIREBASE_WEB_CONFIG || {};
  const FLOW = Object.freeze([
    'pre_challenge','word_match','category_forest','sentence_city',
    'word_detective','final_boss','post_challenge','certificate'
  ]);
  const PASS_MARKS = Object.freeze({
    word_match:70,
    category_forest:70,
    sentence_city:70,
    word_detective:70,
    final_boss:65
  });
  const COL = Object.freeze({
    profiles:'ewp_profiles',
    sessions:'ewp_player_sessions',
    progress:'ewp_progress',
    assignments:'ewp_assignments',
    assessments:'ewp_assessments',
    gameResults:'ewp_game_results',
    gameSummary:'ewp_game_summary',
    events:'ewp_events',
    certificates:'ewp_certificates',
    checkpoints:'ewp_assessment_checkpoints'
  });

  const runtime = {
    mode:'configured',
    lastError:'',
    lastSuccessAt:'',
    projectId:String(webCfg.projectId || cfg.firebaseProjectId || '').trim(),
    authUid:'',
    transport:'firebase-web-sdk-firestore-direct'
  };

  let app = null;
  let auth = null;
  let db = null;
  let authPromise = null;

  const clean = value => String(value == null ? '' : value).trim();
  const nowIso = () => new Date().toISOString();
  const unique = values => [...new Set((Array.isArray(values) ? values : []).map(clean).filter(Boolean))];
  const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;

  function configReady(){
    return Boolean(
      clean(webCfg.projectId) &&
      clean(webCfg.apiKey) &&
      clean(webCfg.appId) &&
      clean(webCfg.authDomain)
    );
  }

  function sdkReady(){
    return Boolean(window.firebase && firebase.initializeApp && firebase.auth && firebase.firestore);
  }

  function endpointReady(){
    return configReady() && sdkReady();
  }

  function emit(){
    window.dispatchEvent(new CustomEvent('ew-authority-status',{detail:{...runtime,endpointReady:endpointReady()}}));
  }

  function markSuccess(){
    runtime.mode='firebase';
    runtime.lastError='';
    runtime.lastSuccessAt=nowIso();
    emit();
  }

  function markError(error){
    runtime.mode='error';
    runtime.lastError=String(error?.message || error || 'FIREBASE_ERROR');
    emit();
  }

  function init(){
    if(!configReady()) throw new Error('FIREBASE_WEB_CONFIG_MISSING');
    if(!sdkReady()) throw new Error('FIREBASE_WEB_SDK_MISSING');
    if(!app){
      app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(webCfg);
      auth = firebase.auth(app);
      db = firebase.firestore(app);
    }
    return {app,auth,db};
  }

  async function ensureAuth(){
    init();
    if(auth.currentUser){
      runtime.authUid=auth.currentUser.uid;
      return auth.currentUser;
    }
    if(!authPromise){
      authPromise = auth.signInAnonymously()
        .then(result => result.user)
        .finally(() => { authPromise=null; });
    }
    const user = await authPromise;
    runtime.authUid=user.uid;
    return user;
  }

  function isQaPlayer(playerId){
    const id=clean(playerId);
    return /^(QA|TEST)[-_]/i.test(id) || /^99\d{4,}$/.test(id);
  }

  function hash32(value){
    const input=clean(value);
    let hash=0x811c9dc5;
    for(let i=0;i<input.length;i+=1){
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash,0x01000193);
    }
    return hash >>> 0;
  }

  function mix32(value){
    let x=Number(value)>>>0;
    x ^= x>>>16; x=Math.imul(x,0x7feb352d);
    x ^= x>>>15; x=Math.imul(x,0x846ca68b);
    x ^= x>>>16;
    return x>>>0;
  }

  function assignmentFor(playerId){
    const id=clean(playerId);
    const version='2026-08-03-PASSPORT-ROTATION-V2-INDEPENDENT';
    const appId=cfg.appId || 'ENGLISH-WEEK-PASSPORT-2026';
    const passportHash=mix32(hash32(`${appId}|${id}|passport|${version}`));
    const reversed=Array.from(id).reverse().join('');
    const assessmentHash=mix32(hash32(`assessment|${reversed}|${version}|${appId}`));
    const passportRotation=['P1','P2','P3','P4'][passportHash%4];
    const assessmentRotation=['R1','R2'][(assessmentHash>>>16)%2];
    const randomSeed=mix32(hash32(`${version}|seed|${id}|${appId}`));
    return {
      playerId:id,
      passportRotation,
      assessmentRotation,
      preForm:assessmentRotation==='R1'?'A':'B',
      postForm:assessmentRotation==='R1'?'B':'A',
      randomSeed,
      randomSeedHex:randomSeed.toString(16).padStart(8,'0'),
      assignmentVersion:version,
      assignmentSource:'firestore-direct-deterministic-authority',
      assignmentLocked:true,
      assignedAt:nowIso(),
      updatedAt:nowIso()
    };
  }

  function reconcileProgress(value){
    const passed=unique(value?.passed).filter(stage => Object.hasOwn(PASS_MARKS,stage));
    const bestScores=value?.bestScores && typeof value.bestScores==='object' ? {...value.bestScores} : {};
    const preDone=Boolean(value?.preDone);
    const postDone=Boolean(value?.postDone);
    const unlocked=['pre_challenge'];
    if(preDone) unlocked.push('word_match');
    if(passed.includes('word_match')) unlocked.push('category_forest');
    if(passed.includes('category_forest')) unlocked.push('sentence_city');
    if(passed.includes('sentence_city')) unlocked.push('word_detective');
    if(passed.includes('word_detective')) unlocked.push('final_boss');
    if(passed.includes('final_boss')) unlocked.push('post_challenge');
    if(postDone) unlocked.push('certificate');
    const totalScore=Object.values(bestScores).reduce((sum,v)=>sum+Number(v||0),0);
    return {
      playerId:clean(value?.playerId),
      currentStage:unlocked[unlocked.length-1],
      unlocked,
      passed,
      bestScores,
      preDone,
      postDone,
      finalDone:Boolean(value?.finalDone || passed.includes('final_boss')),
      certificateEligible:Boolean(value?.certificateEligible || postDone),
      certificate:value?.certificate || null,
      totalScore,
      updatedAt:nowIso()
    };
  }

  function defaultProgress(playerId){
    return reconcileProgress({
      playerId,
      passed:[],
      bestScores:{},
      preDone:false,
      postDone:false,
      finalDone:false,
      certificateEligible:false,
      certificate:null
    });
  }

  function awardLevel(totalScore){
    if(totalScore>=450) return 'English Week Champion';
    if(totalScore>=400) return 'Word Master';
    if(totalScore>=325) return 'Vocabulary Adventurer';
    return 'English Explorer';
  }

  async function claimPlayer(user, playerId){
    const ref=db.collection(COL.sessions).doc(user.uid);
    await ref.set({
      uid:user.uid,
      playerId:clean(playerId),
      claimedAt:nowIso(),
      updatedAt:nowIso(),
      sourceVersion:VERSION
    },{merge:true});
  }

  async function profileLookup(playerId,nickname){
    try{
      const id=clean(playerId);
      if(!id) throw new Error('PLAYER_ID_REQUIRED');
      const user=await ensureAuth();
      const ref=db.collection(COL.profiles).doc(id);
      let snap=await ref.get();
      if(!snap.exists){
        if(!isQaPlayer(id)) throw new Error('PLAYER_NOT_FOUND');
        const label=clean(nickname) || `Test Player ${id}`;
        await ref.set({
          playerId:id,
          fullName:label,
          nickname:label,
          groupName:'English Week QA',
          institution:'QA',
          active:true,
          profileSource:'firestore-direct-qa-registration',
          createdAt:nowIso(),
          updatedAt:nowIso(),
          lastSeenAt:nowIso()
        });
        snap=await ref.get();
      }
      const profile={playerId:id,...snap.data()};
      if(profile.active===false) throw new Error('PLAYER_INACTIVE');
      await claimPlayer(user,id);
      await ref.update({lastSeenAt:nowIso(),updatedAt:nowIso()}).catch(()=>{});
      markSuccess();
      return {ok:true,mode:'firebase',sourceOfTruth:'Cloud Firestore Direct Authority',profile,authUid:user.uid,version:VERSION};
    }catch(error){ markError(error); throw error; }
  }

  async function ensureAssignment(playerId){
    const ref=db.collection(COL.assignments).doc(playerId);
    const snap=await ref.get();
    if(snap.exists) return {playerId,...snap.data()};
    const value=assignmentFor(playerId);
    await ref.set(value);
    return value;
  }

  async function ensureProgress(playerId){
    const ref=db.collection(COL.progress).doc(playerId);
    const snap=await ref.get();
    if(snap.exists) return reconcileProgress({playerId,...snap.data()});
    const value=defaultProgress(playerId);
    await ref.set(value);
    return value;
  }

  async function resume(playerId,nickname){
    try{
      const lookup=await profileLookup(playerId,nickname);
      const id=lookup.profile.playerId;
      const [assignment,progress]=await Promise.all([
        ensureAssignment(id),
        ensureProgress(id)
      ]);
      markSuccess();
      return {
        ok:true,
        mode:'firebase',
        sourceOfTruth:'Cloud Firestore Direct Authority',
        profile:lookup.profile,
        progress,
        assignment,
        version:VERSION
      };
    }catch(error){ markError(error); throw error; }
  }

  async function health(){
    try{
      const user=await ensureAuth();
      markSuccess();
      return {ok:true,mode:'firebase',sourceOfTruth:'Cloud Firestore Direct Authority',projectId:webCfg.projectId,authUid:user.uid,version:VERSION};
    }catch(error){ markError(error); throw error; }
  }

  async function submitAssessment(payload){
    try{
      await ensureAuth();
      const playerId=clean(payload?.playerId);
      const type=clean(payload?.assessmentType).toLowerCase();
      if(!playerId || !['pre','post'].includes(type)) throw new Error('INVALID_ASSESSMENT_PAYLOAD');
      const receiptId=uid(`assessment-${type}`);
      const progressRef=db.collection(COL.progress).doc(playerId);
      const assessmentRef=db.collection(COL.assessments).doc(receiptId);
      const certificateRef=db.collection(COL.certificates).doc(playerId);
      let nextProgress=null;

      await db.runTransaction(async tx=>{
        const snap=await tx.get(progressRef);
        const current=reconcileProgress(snap.exists ? {playerId,...snap.data()} : defaultProgress(playerId));
        if(type==='post' && !current.passed.includes('final_boss')) throw new Error('POST_NOT_UNLOCKED');
        const draft={...current};
        if(type==='pre') draft.preDone=true;
        if(type==='post'){
          draft.postDone=true;
          draft.certificateEligible=true;
          if(!draft.certificate){
            draft.certificate={
              certificateId:uid('EW-CERT'),
              issuedAt:nowIso(),
              awardLevel:awardLevel(draft.totalScore)
            };
          }
          tx.set(certificateRef,{
            playerId,
            ...draft.certificate,
            totalScore:draft.totalScore,
            updatedAt:nowIso(),
            sourceVersion:VERSION
          },{merge:true});
        }
        nextProgress=reconcileProgress(draft);
        tx.set(progressRef,nextProgress,{merge:true});
        tx.set(assessmentRef,{
          ...payload,
          playerId,
          receiptId,
          assessmentType:type,
          submittedAt:nowIso(),
          sourceVersion:VERSION,
          authorityMode:'firestore-direct'
        });
      });

      const profileSnap=await db.collection(COL.profiles).doc(playerId).get();
      const assignment=await ensureAssignment(playerId);
      markSuccess();
      return {
        ok:true,
        mode:'firebase',
        sourceOfTruth:'Cloud Firestore Direct Authority',
        receiptId,
        authority:{
          ok:true,
          mode:'firebase',
          sourceOfTruth:'Cloud Firestore Direct Authority',
          profile:{playerId,...profileSnap.data()},
          progress:nextProgress,
          assignment,
          version:VERSION
        },
        version:VERSION
      };
    }catch(error){ markError(error); throw error; }
  }

  async function submitGame(payload){
    try{
      await ensureAuth();
      const playerId=clean(payload?.playerId);
      const stageId=clean(payload?.stageId);
      if(!playerId || !Object.hasOwn(PASS_MARKS,stageId)) throw new Error('INVALID_GAME_PAYLOAD');
      const total=Math.max(0,Number(payload?.total||0));
      const score=Math.max(0,Number(payload?.score||0));
      const accuracy=total>0 ? Math.round((score/total)*100) : 0;
      const passMark=PASS_MARKS[stageId];
      const passed=accuracy>=passMark;
      const receiptId=uid(`game-${stageId}`);
      const progressRef=db.collection(COL.progress).doc(playerId);
      const resultRef=db.collection(COL.gameResults).doc(receiptId);
      const summaryRef=db.collection(COL.gameSummary).doc(playerId);
      let nextProgress=null;

      await db.runTransaction(async tx=>{
        const snap=await tx.get(progressRef);
        const current=reconcileProgress(snap.exists ? {playerId,...snap.data()} : defaultProgress(playerId));
        if(!current.unlocked.includes(stageId)) throw new Error('STAGE_LOCKED');
        const bestScores={...current.bestScores,[stageId]:Math.max(Number(current.bestScores?.[stageId]||0),accuracy)};
        const passedStages=[...current.passed];
        if(passed && !passedStages.includes(stageId)) passedStages.push(stageId);
        nextProgress=reconcileProgress({
          ...current,
          passed:passedStages,
          bestScores,
          finalDone:current.finalDone || (stageId==='final_boss' && passed)
        });
        tx.set(progressRef,nextProgress,{merge:true});
        tx.set(resultRef,{
          ...payload,
          playerId,
          stageId,
          receiptId,
          accuracy,
          passMark,
          passed,
          submittedAt:nowIso(),
          sourceVersion:VERSION,
          authorityMode:'firestore-direct'
        });
        tx.set(summaryRef,{
          playerId,
          totalScore:nextProgress.totalScore,
          bestScores:nextProgress.bestScores,
          passed:nextProgress.passed,
          currentStage:nextProgress.currentStage,
          updatedAt:nowIso(),
          sourceVersion:VERSION
        },{merge:true});
      });

      const profileSnap=await db.collection(COL.profiles).doc(playerId).get();
      const assignment=await ensureAssignment(playerId);
      markSuccess();
      return {
        ok:true,
        mode:'firebase',
        sourceOfTruth:'Cloud Firestore Direct Authority',
        receiptId,
        passed,
        accuracy,
        passMark,
        authority:{
          ok:true,
          mode:'firebase',
          sourceOfTruth:'Cloud Firestore Direct Authority',
          profile:{playerId,...profileSnap.data()},
          progress:nextProgress,
          assignment,
          version:VERSION
        },
        version:VERSION
      };
    }catch(error){ markError(error); throw error; }
  }

  async function submitEvent(payload){
    try{
      await ensureAuth();
      const playerId=clean(payload?.playerId);
      if(!playerId) throw new Error('PLAYER_ID_REQUIRED');
      const eventId=uid('event');
      await db.collection(COL.events).doc(eventId).set({
        ...payload,
        playerId,
        eventId,
        createdAt:nowIso(),
        sourceVersion:VERSION
      });
      markSuccess();
      return {ok:true,mode:'firebase',eventId,version:VERSION};
    }catch(error){ markError(error); throw error; }
  }

  function checkpointId(playerId,type){
    return `${clean(playerId)}__${clean(type).toLowerCase()}`;
  }

  async function saveAssessmentCheckpoint(payload){
    try{
      await ensureAuth();
      const playerId=clean(payload?.playerId);
      const assessmentType=clean(payload?.assessmentType).toLowerCase();
      if(!playerId || !assessmentType) throw new Error('INVALID_CHECKPOINT');
      const checkpoint={...payload,playerId,assessmentType,savedAt:nowIso(),sourceVersion:VERSION};
      await db.collection(COL.checkpoints).doc(checkpointId(playerId,assessmentType)).set(checkpoint,{merge:true});
      markSuccess();
      return {ok:true,mode:'firebase',checkpoint,version:VERSION};
    }catch(error){ markError(error); throw error; }
  }

  async function getAssessmentCheckpoint(playerId,assessmentType){
    try{
      await ensureAuth();
      const id=clean(playerId);
      const type=clean(assessmentType).toLowerCase();
      const snap=await db.collection(COL.checkpoints).doc(checkpointId(id,type)).get();
      markSuccess();
      return {ok:true,mode:'firebase',checkpoint:snap.exists?{...snap.data()}:null,version:VERSION};
    }catch(error){ markError(error); throw error; }
  }

  async function clearAssessmentCheckpoint(playerId,assessmentType){
    try{
      await ensureAuth();
      const id=clean(playerId);
      const type=clean(assessmentType).toLowerCase();
      await db.collection(COL.checkpoints).doc(checkpointId(id,type)).delete();
      markSuccess();
      return {ok:true,mode:'firebase',cleared:true,version:VERSION};
    }catch(error){ markError(error); throw error; }
  }

  async function leaderboard(){
    return {ok:true,mode:'firebase',sourceOfTruth:'Cloud Firestore Direct Authority',rows:[],note:'Leaderboard disabled until public leaderboard rules are added',version:VERSION};
  }

  function getRuntimeStatus(){
    return Object.freeze({...runtime,endpointReady:endpointReady(),configReady:configReady(),sdkReady:sdkReady()});
  }

  window.EW_AUTHORITY = Object.freeze({
    FLOW,
    STAGE_PASS_MARKS:PASS_MARKS,
    modeName:'firestore-direct',
    sourceOfTruth:'Cloud Firestore Direct Authority',
    firebaseProjectId:webCfg.projectId || cfg.firebaseProjectId || '',
    endpointReady,
    health,
    profileLookup,
    resume,
    submitAssessment,
    submitGame,
    submitEvent,
    leaderboard,
    awardLevel,
    saveAssessmentCheckpoint,
    getAssessmentCheckpoint,
    clearAssessmentCheckpoint,
    getRuntimeStatus,
    directFirestoreVersion:VERSION
  });

  emit();
}());
