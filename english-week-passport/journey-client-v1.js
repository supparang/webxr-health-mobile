(function(){
  'use strict';
  const VERSION='2026-08-07-JOURNEY-CLIENT-V1';
  const cfg=window.EW_CONFIG||{};
  const endpoint=String(cfg.firebaseJourneyUrl||'').trim();

  function endpointReady(){
    return /^https:\/\/[a-z0-9-]+-[a-z0-9-]+\.cloudfunctions\.net\/englishWeekJourney(?:\?.*)?$/i.test(endpoint);
  }

  async function request(action,payload){
    if(!endpointReady())throw new Error('FIREBASE_JOURNEY_URL_MISSING');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),Number(cfg.requestTimeoutMs||12000));
    try{
      const response=await fetch(endpoint,{
        method:'POST',
        headers:{'Content-Type':'application/json','X-EW-App-Id':String(cfg.appId||'ENGLISH-WEEK-PASSPORT-2026')},
        body:JSON.stringify({...(payload||{}),action,appId:cfg.appId||'ENGLISH-WEEK-PASSPORT-2026',sourceVersion:VERSION}),
        signal:controller.signal,
        cache:'no-store',
        redirect:'follow'
      });
      let data=null;
      try{data=await response.json()}catch(_){throw new Error('INVALID_JOURNEY_RESPONSE')}
      if(!response.ok||data?.ok===false)throw new Error(data?.error||`JOURNEY_HTTP_${response.status}`);
      if(data?.mode!=='firebase')throw new Error('FIREBASE_JOURNEY_RECEIPT_REQUIRED');
      return data;
    }finally{clearTimeout(timer)}
  }

  const api=Object.freeze({
    version:VERSION,
    endpointReady,
    health:()=>request('health',{}),
    status:playerId=>request('status',{playerId}),
    submitReflection:payload=>request('submit_reflection',payload),
    summary:playerId=>request('journey_summary',{playerId}),
    completeSummary:playerId=>request('complete_summary',{playerId})
  });
  window.EW_JOURNEY=api;
}());
