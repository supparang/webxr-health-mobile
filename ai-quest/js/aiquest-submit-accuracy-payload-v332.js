
(function(){
  'use strict';

  const VERSION = 'v3.3.2-accuracy-payload-server';

  function n(v){
    if(v === null || v === undefined || v === '') return NaN;
    const x = Number(v);
    return Number.isFinite(x) ? x : NaN;
  }

  function firstNumber(){
    for(let i=0;i<arguments.length;i++){
      const x = n(arguments[i]);
      if(Number.isFinite(x)) return x;
    }
    return NaN;
  }

  function computeAccuracy(obj){
    if(!obj || typeof obj !== 'object') return '';

    const nested = obj.summary || (obj.extraJson && obj.extraJson.summary) || {};
    const extra = obj.extraJson || {};

    const direct = firstNumber(
      obj.accuracy, obj.accuracyPct, obj.accuracyPercent,
      nested.accuracy, nested.accuracyPct, nested.accuracyPercent,
      extra.accuracy, extra.accuracyPct
    );
    if(Number.isFinite(direct) && direct > 0) return Math.round(direct);

    const correct = firstNumber(obj.correct, obj.correctCount, nested.correct, nested.correctCount, extra.correct, extra.correctCount);
    const total = firstNumber(obj.total, obj.totalQuestions, obj.questionCount, nested.total, nested.totalQuestions, extra.total, extra.totalQuestions);
    if(Number.isFinite(correct) && Number.isFinite(total) && total > 0){
      return Math.round((correct / total) * 100);
    }

    return '';
  }

  function normalizePayload(obj){
    if(!obj || typeof obj !== 'object') return obj;

    const nested = obj.summary || (obj.extraJson && obj.extraJson.summary) || {};
    const extra = obj.extraJson || {};

    const correct = firstNumber(obj.correct, obj.correctCount, nested.correct, nested.correctCount, extra.correct, extra.correctCount);
    const total = firstNumber(obj.total, obj.totalQuestions, obj.questionCount, nested.total, nested.totalQuestions, extra.total, extra.totalQuestions);
    const acc = computeAccuracy(obj);

    if(Number.isFinite(correct) && correct >= 0) obj.correct = correct;
    if(Number.isFinite(total) && total > 0) obj.total = total;

    if(acc !== ''){
      obj.accuracy = acc;
      obj.accuracyPct = acc;
      obj.accuracySource = 'direct-or-correct-total';
    }else{
      obj.accuracy = '';
      obj.accuracyPct = '';
      obj.accuracySource = 'not-available';
    }

    return obj;
  }

  function normalizeDeep(obj){
    if(!obj || typeof obj !== 'object') return obj;
    normalizePayload(obj);
    if(obj.attempt && typeof obj.attempt === 'object') normalizePayload(obj.attempt);
    if(obj.payload && typeof obj.payload === 'object') normalizePayload(obj.payload);
    return obj;
  }

  const originalFetch = window.fetch;
  if(typeof originalFetch === 'function' && !originalFetch.__aiquestAccuracyPayloadV326){
    const wrapped = function(input, init){
      try{
        if(init && init.body && typeof init.body === 'string' && (init.body.includes('score') || init.body.includes('attempt'))){
          const body = JSON.parse(init.body);
          normalizeDeep(body);
          init = Object.assign({}, init, {body: JSON.stringify(body)});
          console.log('[AIQuest] accuracy payload normalized', {
            accuracy: body.accuracy || (body.attempt && body.attempt.accuracy) || (body.payload && body.payload.accuracy) || '',
            correct: body.correct || (body.attempt && body.attempt.correct) || (body.payload && body.payload.correct) || '',
            total: body.total || (body.attempt && body.attempt.total) || (body.payload && body.payload.total) || ''
          });
        }
      }catch(e){}
      return originalFetch.call(this, input, init);
    };
    wrapped.__aiquestAccuracyPayloadV326 = true;
    window.fetch = wrapped;
  }

  window.AIQUEST_SUBMIT_ACCURACY_PAYLOAD = {
    version: VERSION,
    computeAccuracy,
    normalizePayload,
    normalizeDeep
  };

  console.log('[AIQuest] '+VERSION+' loaded', window.AIQUEST_SUBMIT_ACCURACY_PAYLOAD);
})();
