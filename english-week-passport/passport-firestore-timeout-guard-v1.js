(function(){
  'use strict';

  const VERSION='2026-08-07-PASSPORT-FIRESTORE-TIMEOUT-GUARD-V3-FAST-RESUME';
  const base=window.EW_AUTHORITY;
  if(!base){
    console.warn('EW timeout guard: authority not ready');
    return;
  }

  const TIMEOUT_MS=7000;
  const CHECKPOINT_TIMEOUT_MS=6500;
  const fastCache={playerId:'',profile:null,at:0};

  function clean(value){ return String(value==null?'':value).trim(); }

  function withTimeout(label,fn,ms){
    if(typeof fn!=='function') return fn;
    return function(){
      const args=arguments;
      let timer=0;
      const task=Promise.resolve().then(()=>fn.apply(base,args));
      const timeout=new Promise((_,reject)=>{
        timer=setTimeout(()=>{
          const error=new Error('FIREBASE_REQUEST_TIMEOUT');
          error.code='FIREBASE_REQUEST_TIMEOUT';
          error.operation=label;
          reject(error);
        },ms);
      });
      return Promise.race([task,timeout]).finally(()=>clearTimeout(timer));
    };
  }

  const guardedProfileLookup=withTimeout('profileLookup',base.profileLookup,TIMEOUT_MS);
  const guardedBaseResume=withTimeout('resume',base.resume,TIMEOUT_MS);

  async function profileLookup(playerId,nickname){
    const result=await guardedProfileLookup(playerId,nickname);
    if(result?.ok && result?.profile){
      fastCache.playerId=clean(result.profile.playerId||playerId);
      fastCache.profile={...result.profile};
      fastCache.at=Date.now();
    }
    return result;
  }

  function normalizeProgress(playerId,data){
    const value=data&&typeof data==='object'?{...data}:{};
    value.playerId=clean(value.playerId||playerId);
    value.unlocked=Array.isArray(value.unlocked)?value.unlocked:['pre_challenge'];
    value.passed=Array.isArray(value.passed)?value.passed:[];
    value.bestScores=value.bestScores&&typeof value.bestScores==='object'?value.bestScores:{};
    value.preDone=Boolean(value.preDone);
    value.postDone=Boolean(value.postDone);
    value.finalDone=Boolean(value.finalDone);
    value.certificateEligible=Boolean(value.certificateEligible);
    value.totalScore=Number(value.totalScore||0);
    return value;
  }

  async function fastResume(playerId,nickname){
    const id=clean(playerId);
    const cacheFresh=fastCache.profile && fastCache.playerId===id && (Date.now()-fastCache.at)<20000;
    if(!cacheFresh || !window.firebase?.firestore) return guardedBaseResume(playerId,nickname);

    const db=firebase.firestore();
    const [assignmentSnap,progressSnap]=await Promise.all([
      db.collection('ewp_assignments').doc(id).get(),
      db.collection('ewp_progress').doc(id).get()
    ]);

    // New QA/player bootstrap still goes through the canonical authority once.
    if(!assignmentSnap.exists || !progressSnap.exists){
      return guardedBaseResume(playerId,nickname);
    }

    return {
      ok:true,
      mode:'firebase',
      sourceOfTruth:'Cloud Firestore Direct Authority',
      profile:{...fastCache.profile},
      assignment:{playerId:id,...assignmentSnap.data()},
      progress:normalizeProgress(id,progressSnap.data()),
      version:VERSION,
      fastResume:true
    };
  }

  const guarded={
    ...base,
    health:withTimeout('health',base.health,TIMEOUT_MS),
    profileLookup,
    resume:withTimeout('fastResume',fastResume,TIMEOUT_MS),
    getAssessmentCheckpoint:withTimeout('getAssessmentCheckpoint',base.getAssessmentCheckpoint,CHECKPOINT_TIMEOUT_MS)
  };

  window.EW_AUTHORITY=Object.freeze(guarded);

  const loading=document.getElementById('loading');
  const loadingText=document.getElementById('loadingText');
  let slowTimer=0;
  let hardTimer=0;

  function clearTimers(){
    clearTimeout(slowTimer);
    clearTimeout(hardTimer);
    slowTimer=0;
    hardTimer=0;
  }

  function recoverUi(message){
    clearTimers();
    if(loading){
      loading.hidden=true;
      loading.style.pointerEvents='none';
    }
    const button=document.getElementById('loginStartBtn');
    if(button){
      button.disabled=false;
      button.textContent='ตรวจสอบรหัสและเริ่มภารกิจ';
    }
    const toast=document.getElementById('toast');
    if(toast && message){
      toast.textContent=message;
      toast.hidden=false;
      setTimeout(()=>{
        if(toast.textContent===message) toast.hidden=true;
      },4200);
    }
    window.EW_PASSPORT_MOBILE_RECOVERY?.unlockScroll?.();
  }

  function armWatchdog(){
    if(!loading || loading.hidden || hardTimer) return;
    slowTimer=setTimeout(()=>{
      if(!loading.hidden && loadingText){
        loadingText.textContent='Firestore ตอบช้ากว่าปกติ • กำลังรออีกสักครู่…';
      }
    },3500);
    hardTimer=setTimeout(()=>{
      if(!loading.hidden){
        recoverUi('Firebase ตอบช้าเกินกำหนด • กรุณากดลองอีกครั้ง');
      }else{
        clearTimers();
      }
    },8500);
  }

  if(loading){
    new MutationObserver(()=>{
      if(loading.hidden){
        clearTimers();
        loading.style.pointerEvents='none';
      }else{
        loading.style.pointerEvents='auto';
        armWatchdog();
      }
    }).observe(loading,{attributes:true,attributeFilter:['hidden']});
  }

  window.addEventListener('pageshow',()=>{
    if(loading && !loading.hidden) armWatchdog();
  });

  // Absolute escape hatch: even if another script breaks the observer,
  // no login overlay may survive longer than 10 seconds.
  setInterval(()=>{
    if(!loading || loading.hidden) return;
    const started=Number(loading.dataset.ewShownAt||0);
    if(!started){ loading.dataset.ewShownAt=String(Date.now()); return; }
    if(Date.now()-started>10000){
      recoverUi('การเชื่อมต่อใช้เวลานานเกินไป • กรุณากดลองอีกครั้ง');
      delete loading.dataset.ewShownAt;
    }
  },1000);

  if(loading){
    new MutationObserver(()=>{
      if(loading.hidden) delete loading.dataset.ewShownAt;
      else if(!loading.dataset.ewShownAt) loading.dataset.ewShownAt=String(Date.now());
    }).observe(loading,{attributes:true,attributeFilter:['hidden']});
  }

  window.EW_FIRESTORE_TIMEOUT_GUARD=Object.freeze({
    version:VERSION,
    timeoutMs:TIMEOUT_MS,
    fastResume:true,
    recoverUi
  });
}());
