(function(){
  'use strict';

  const VERSION='2026-08-18-PASSPORT-SUBMIT-SAFETY-V1';
  const base=window.EW_AUTHORITY;
  if(!base){
    console.warn('EW submit safety: authority not ready');
    return;
  }

  let activePromise=null;
  let activeKey='';

  function clean(value){ return String(value==null?'':value).trim(); }
  function setSubmitState(active,key){
    const root=document.documentElement;
    if(active){
      root.dataset.ewSubmitActive='1';
      root.dataset.ewSubmitKey=clean(key);
    }else{
      delete root.dataset.ewSubmitActive;
      delete root.dataset.ewSubmitKey;
    }
    window.dispatchEvent(new CustomEvent('ew-submit-state',{detail:{active:Boolean(active),key:clean(key),version:VERSION}}));
  }

  function makeKey(kind,payload){
    const playerId=clean(payload?.playerId);
    if(kind==='assessment'){
      return `${kind}|${playerId}|${clean(payload?.assessmentType)}|${clean(payload?.formId)}`;
    }
    return `${kind}|${playerId}|${clean(payload?.stageId)}`;
  }

  function safeSubmit(kind,fn,payload){
    const key=makeKey(kind,payload);
    if(activePromise){
      console.warn('EW submit safety: reused in-flight submission',activeKey);
      return activePromise;
    }

    setSubmitState(true,key);
    const task=Promise.resolve()
      .then(()=>fn.call(base,payload))
      .finally(()=>{
        if(activePromise===task){
          activePromise=null;
          activeKey='';
          setSubmitState(false,key);
        }
      });
    activePromise=task;
    activeKey=key;
    return task;
  }

  const submitAssessment=typeof base.submitAssessment==='function'
    ? payload=>safeSubmit('assessment',base.submitAssessment,payload)
    : base.submitAssessment;
  const submitGame=typeof base.submitGame==='function'
    ? payload=>safeSubmit('game',base.submitGame,payload)
    : base.submitGame;

  const saveAssessmentCheckpoint=typeof base.saveAssessmentCheckpoint==='function'
    ? function(payload){
        if(document.documentElement.dataset.ewSubmitActive==='1'){
          return Promise.resolve({ok:true,skipped:true,reason:'FINAL_SUBMIT_ACTIVE',mode:'firebase'});
        }
        return base.saveAssessmentCheckpoint(payload);
      }
    : base.saveAssessmentCheckpoint;

  window.EW_AUTHORITY=Object.freeze({
    ...base,
    submitAssessment,
    submitGame,
    saveAssessmentCheckpoint
  });

  window.EW_SUBMIT_SAFETY=Object.freeze({
    version:VERSION,
    get active(){ return Boolean(activePromise); },
    get key(){ return activeKey; }
  });
}());
