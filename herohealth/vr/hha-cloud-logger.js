// HHA Cloud Logger — SAFE PATCH
(function(){
  'use strict';

  const ROOT = window;
  if(ROOT.__HHA_LOGGER_SAFE__) return;
  ROOT.__HHA_LOGGER_SAFE__ = true;

  function safeJson(obj){
    try{ return JSON.stringify(obj); }
    catch(e){ return '{}'; }
  }

  function post(payload){
    try{
      fetch('https://script.google.com/macros/s/AKfycbxdy-3BjJhn6Fo3kQX9oxHQIlXT7p2OXn-UYfv1MKV5oSW6jYG-RlnAgKlHqrNxxbhmaw/exec', {
        method:'POST',
        mode:'no-cors',
        headers:{ 'Content-Type':'application/json' },
        body: safeJson(payload)
      });
    }catch(e){
      console.warn('[HHA-LOGGER]', e);
    }
  }

  ROOT.addEventListener('hha:log', (ev)=>{
    if(!ev || !ev.detail) return;
    post({ type: ev.detail.type || 'log', ...ev.detail });
  }, { passive:true });

  ROOT.addEventListener('hha:end', (ev)=>{
    if(!ev || !ev.detail) return;
    post({ type:'end', ...ev.detail });
  }, { passive:true });

})();