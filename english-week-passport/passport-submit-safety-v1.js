(function(){
  'use strict';

  const VERSION='2026-08-18-PASSPORT-SUBMIT-SAFETY-V2-QUOTA-SAFE';
  const base=window.EW_AUTHORITY;
  if(!base){
    console.warn('EW submit safety: authority not ready');
    return;
  }

  // Event-Day quota protection:
  // Assessment answers remain in the page/session state while the learner is
  // taking the 10-item Pre/Post Challenge. We deliberately do NOT persist a
  // Firestore checkpoint after every answer. Only the final assessment receipt
  // is authoritative. This removes up to 10 Firestore writes per assessment.
  const QUOTA_SAFE_ASSESSMENT_CHECKPOINTS=true;

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
    ? function(){
        if(QUOTA_SAFE_ASSESSMENT_CHECKPOINTS){
          return Promise.resolve({ok:true,skipped:true,reason:'EVENT_DAY_QUOTA_SAFE_NO_CHECKPOINT_WRITE',mode:'local-session-only'});
        }
        if(document.documentElement.dataset.ewSubmitActive==='1'){
          return Promise.resolve({ok:true,skipped:true,reason:'FINAL_SUBMIT_ACTIVE',mode:'firebase'});
        }
        return base.saveAssessmentCheckpoint.apply(base,arguments);
      }
    : base.saveAssessmentCheckpoint;

  const clearAssessmentCheckpoint=typeof base.clearAssessmentCheckpoint==='function'
    ? function(){
        if(QUOTA_SAFE_ASSESSMENT_CHECKPOINTS){
          return Promise.resolve({ok:true,skipped:true,reason:'EVENT_DAY_QUOTA_SAFE_NO_CHECKPOINT_DELETE',mode:'local-session-only'});
        }
        return base.clearAssessmentCheckpoint.apply(base,arguments);
      }
    : base.clearAssessmentCheckpoint;

  window.EW_AUTHORITY=Object.freeze({
    ...base,
    submitAssessment,
    submitGame,
    saveAssessmentCheckpoint,
    clearAssessmentCheckpoint
  });

  window.EW_SUBMIT_SAFETY=Object.freeze({
    version:VERSION,
    quotaSafeAssessmentCheckpoints:QUOTA_SAFE_ASSESSMENT_CHECKPOINTS,
    get active(){ return Boolean(activePromise); },
    get key(){ return activeKey; }
  });
}());
