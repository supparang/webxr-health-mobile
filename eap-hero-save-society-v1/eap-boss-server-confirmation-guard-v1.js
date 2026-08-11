/* =========================================================
   EAP Hero • Boss Server Confirmation Guard v1
   2026-08-11

   Purpose
   - Google Sheet remains the sole progression authority.
   - Prevent legacy boss modules from showing the next route from localStorage
     before player_resume confirms that route from the server.
   - Never blocks evidence delivery. It only prevents optimistic UI advance.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_BOSS_SERVER_CONFIRMATION_GUARD_V1__) return;
  window.__EAP_BOSS_SERVER_CONFIRMATION_GUARD_V1__=true;

  var VERSION='20260811-EAP-BOSS-SERVER-CONFIRMATION-GUARD-V1';
  var KEY='EAP_HERO_PROGRESS_V3';
  var ORDER=['S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3','S10','S11','S12','B4','S13','S14','S15','B5'];
  var timer=0;

  function text(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function norm(v){
    var s=text(v).toUpperCase(),m;
    m=s.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/i); if(m)return'S'+Number(m[1]);
    m=s.match(/^(?:B|BOSS|GATE|BOSS\s*GATE)\s*0?([1-5])$/i); if(m)return'B'+Number(m[1]);
    return'';
  }
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(_){return{};}}
  function write(s){try{localStorage.setItem(KEY,JSON.stringify(s||{}));return true;}catch(_){return false;}}
  function serverRoute(s){
    s=s||read(); var r=s.serverResume||{};
    if(s.cloudResumeStatus!=='ok'||r.cloudVerified!==true) return'';
    return norm(r.currentRoute||r.currentCloudRoute||r.nextRoute);
  }
  function reconcile(){
    var s=read(), sr=serverRoute(s);
    if(!sr||ORDER.indexOf(sr)<0) return;
    var local=norm(s.currentCloudRoute||s.currentRoute);
    if(local===sr) return;

    /* A local route may differ while evidence is being delivered. The server
       route wins until a subsequent verified player_resume advances it. */
    s.currentRoute=sr;
    s.currentCloudRoute=sr;
    s.serverCurrentRoute=sr;
    s.__bossServerConfirmationGuard={
      restoredTo:sr,
      rejectedLocalRoute:local,
      at:new Date().toISOString(),
      version:VERSION
    };
    write(s);
    try{localStorage.setItem('EAP_HERO_ACTIVE_ROUTE',sr);localStorage.setItem('EAP_HERO_CURRENT_ROUTE',sr);}catch(_){}
    try{document.documentElement.dataset.eapBossServerRoute=sr;}catch(_){}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(reconcile,40);}

  ['eap:boss-completed','eap:boss-completion-submitted','eap:local-result-saved','eap:resume-synced','eap:single-authority-applied','storage'].forEach(function(name){
    window.addEventListener(name,schedule);
  });
  setInterval(reconcile,700);
  setTimeout(reconcile,50);
  setTimeout(reconcile,600);

  window.EAPBossServerConfirmationGuard={
    version:VERSION,
    reconcile:reconcile,
    serverRoute:function(){return serverRoute(read());},
    diagnostics:function(){var s=read();return{version:VERSION,serverRoute:serverRoute(s),localRoute:norm(s.currentCloudRoute||s.currentRoute),serverResume:s.serverResume||{}};}
  };
})();