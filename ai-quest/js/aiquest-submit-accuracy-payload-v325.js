
(function(){
  'use strict';

  const VERSION = 'v3.2.5-submit-accuracy-payload';

  function n(v){
    const x = Number(v);
    return Number.isFinite(x) ? x : NaN;
  }

  function computeAccuracy(obj){
    if(!obj || typeof obj !== 'object') return null;

    const direct = n(obj.accuracy ?? obj.accuracyPct ?? obj.accuracyPercent);
    if(Number.isFinite(direct) && direct > 0) return Math.round(direct);

    const correct = n(obj.correct ?? obj.correctCount ?? obj.correctItems ?? obj.correctAnswers);
    const total = n(obj.total ?? obj.totalCount ?? obj.totalItems ?? obj.questionCount ?? obj.questions);
    if(Number.isFinite(correct) && Number.isFinite(total) && total > 0){
      return Math.round((correct / total) * 100);
    }

    return null;
  }

  function normalizePayload(obj){
    if(!obj || typeof obj !== 'object') return obj;
    const acc = computeAccuracy(obj);
    if(acc !== null){
      obj.accuracy = acc;
      obj.accuracyPct = acc;
      obj.accuracySource = 'correct-total-or-direct';
    }else{
      obj.accuracy = '';
      obj.accuracyPct = '';
      obj.accuracySource = 'not-available';
    }
    return obj;
  }

  // Patch fetch calls to Apps Script so future submissions carry accurate accuracy when possible.
  const originalFetch = window.fetch;
  if(typeof originalFetch === 'function' && !originalFetch.__aiquestAccuracyPayloadV325){
    const wrapped = function(input, init){
      try{
        if(init && init.body && typeof init.body === 'string' && init.body.includes('score')){
          const body = JSON.parse(init.body);
          normalizePayload(body);
          init = Object.assign({}, init, {body: JSON.stringify(body)});
        }
      }catch(e){}
      return originalFetch.call(this, input, init);
    };
    wrapped.__aiquestAccuracyPayloadV325 = true;
    window.fetch = wrapped;
  }

  window.AIQUEST_SUBMIT_ACCURACY_PAYLOAD = {
    version: VERSION,
    computeAccuracy,
    normalizePayload
  };

  console.log('[AIQuest] '+VERSION+' loaded', window.AIQUEST_SUBMIT_ACCURACY_PAYLOAD);
})();
