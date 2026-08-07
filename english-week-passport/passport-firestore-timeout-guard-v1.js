(function(){
  'use strict';

  const VERSION='2026-08-07-PASSPORT-FIRESTORE-TIMEOUT-GUARD-V2';
  const base=window.EW_AUTHORITY;
  if(!base){
    console.warn('EW timeout guard: authority not ready');
    return;
  }

  const TIMEOUT_MS=7000;
  const CHECKPOINT_TIMEOUT_MS=6500;

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

  const guarded={
    ...base,
    health:withTimeout('health',base.health,TIMEOUT_MS),
    profileLookup:withTimeout('profileLookup',base.profileLookup,TIMEOUT_MS),
    resume:withTimeout('resume',base.resume,TIMEOUT_MS),
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
    },4000);
    hardTimer=setTimeout(()=>{
      if(!loading.hidden){
        recoverUi('Firebase ตอบช้าเกินกำหนด • กรุณากดลองอีกครั้ง');
      }else{
        clearTimers();
      }
    },9000);
  }

  if(loading){
    // IMPORTANT: observe only the hidden attribute. Observing style caused the
    // watchdog to reset itself every time pointer-events changed.
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

  window.EW_FIRESTORE_TIMEOUT_GUARD=Object.freeze({
    version:VERSION,
    timeoutMs:TIMEOUT_MS,
    recoverUi
  });
}());
