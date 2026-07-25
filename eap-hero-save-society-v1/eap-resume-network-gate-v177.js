/* =========================================================
   EAP Hero • Resume Network Gate v177
   - Gives the official player_resume request exclusive priority at lobby boot.
   - Defers other GET reads to the Apps Script endpoint until resume is applied.
   - Never blocks POST/submission traffic.
   - Never derives progress locally.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_RESUME_NETWORK_GATE_V177__)return;
  window.__EAP_RESUME_NETWORK_GATE_V177__=true;

  var VERSION='20260725-EAP-RESUME-NETWORK-GATE-V177';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var endpoint=String((window.EAP_SHEET_CONFIG||{}).webAppUrl||'').trim();
  var nativeFetch=window.fetch?window.fetch.bind(window):null;
  var released=false;
  var queue=[];
  var MAX_QUEUE=80;

  function clean(v){return String(v==null?'':v).trim();}
  function readState(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch(_){return{};}}
  function hasOfficialResume(){
    var s=readState();
    return !!(s&&s.cloudResumeStatus==='ok'&&s.serverResume&&clean(s.serverResume.resumeKey)&&clean(s.currentCloudRoute||s.currentRoute));
  }
  function urlOf(input){try{return typeof input==='string'?input:(input&&input.url)||'';}catch(_){return'';}}
  function methodOf(init,input){return String((init&&init.method)||(input&&input.method)||'GET').toUpperCase();}
  function isEndpoint(url){return !!endpoint&&String(url||'').indexOf(endpoint)===0;}
  function actionOf(url){try{return String(new URL(url,location.href).searchParams.get('action')||'').toLowerCase();}catch(_){return'';}}
  function isResume(url){return actionOf(url)==='player_resume';}

  function flush(){
    if(released)return;
    released=true;
    var jobs=queue.splice(0,queue.length);
    jobs.forEach(function(job){nativeFetch(job.input,job.init).then(job.resolve,job.reject);});
    try{document.documentElement.dataset.eapResumeNetworkGate='released';}catch(_){ }
  }

  function maybeRelease(){if(hasOfficialResume())flush();}

  if(nativeFetch){
    window.fetch=function(input,init){
      var url=urlOf(input),method=methodOf(init,input);
      if(released||method!=='GET'||!isEndpoint(url)||isResume(url))return nativeFetch(input,init);
      if(queue.length>=MAX_QUEUE){
        return Promise.resolve(new Response(JSON.stringify({ok:false,deferred:true,reason:'resume_priority'}),{status:202,headers:{'Content-Type':'application/json'}}));
      }
      return new Promise(function(resolve,reject){queue.push({input:input,init:init,resolve:resolve,reject:reject});});
    };
  }

  ['eap:resume-synced','storage'].forEach(function(name){window.addEventListener(name,function(){setTimeout(maybeRelease,0);});});
  window.addEventListener('online',maybeRelease);
  setInterval(maybeRelease,500);
  setTimeout(function(){if(hasOfficialResume())flush();},60);
  setTimeout(function(){
    /* Safety release after 150s so unrelated tools are not held forever. */
    if(!released)flush();
  },150000);

  window.EAPResumeNetworkGate={version:VERSION,flush:flush,queued:function(){return queue.length;},released:function(){return released;}};
  try{document.documentElement.dataset.eapResumeNetworkGate=VERSION;}catch(_){ }
})();