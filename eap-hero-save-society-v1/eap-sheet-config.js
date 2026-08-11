/* EAP Hero live Google Sheets endpoint — Section 122 */
window.EAP_SHEET_CONFIG={
  enabled:true,
  webAppUrl:'https://script.google.com/macros/s/AKfycbzkU4qUEhfHmwZCSifwBY1nX21sktS1hA6KMFC1i3ZG2YZZlbij0JC47ODGxcjkhXYsxA/exec',
  section:'122',
  course:'EAP Hero: Save the Society'
};

/* =========================================================
   Active Learner Identity Lock v2
   - ACTIVE_PLAYER wins over stale profile/state aliases.
   - Never clear a same-identity verified server resume.
========================================================= */
(function(){
  'use strict';
  var ACTIVE_KEY='EAP_HERO_ACTIVE_PLAYER_V1';
  var PROFILE_KEY='EAP_HERO_PLAYER_PROFILE_V1';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  function read(key){try{return JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(_){return {};}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value||{}));return true;}catch(_){return false;}}
  function clean(value){return String(value==null?'':value).replace(/\s+/g,' ').trim();}
  function normalize(raw){raw=raw||{};return {id:clean(raw.studentId||raw.id||''),name:clean(raw.studentName||raw.name||''),studentId:clean(raw.studentId||raw.id||''),studentName:clean(raw.studentName||raw.name||''),section:clean(raw.section||'122')||'122'};}
  function valid(profile){return !!(profile&&profile.studentId&&profile.studentName&&profile.studentId.toLowerCase()!=='guest');}
  var active=normalize(read(ACTIVE_KEY));
  if(valid(active)){
    write(PROFILE_KEY,active);
    try{sessionStorage.setItem(PROFILE_KEY,JSON.stringify(active));}catch(_){}
    var state=read(STATE_KEY);
    state.profile=Object.assign({},state.profile||{},active);
    state.player=Object.assign({},state.player||{},active);
    state.user=Object.assign({},state.user||{},active);
    state.id=active.studentId;state.name=active.studentName;state.playerName=active.studentName;
    state.studentId=active.studentId;state.studentName=active.studentName;state.section=active.section;
    state.__activePlayer={studentId:active.studentId,section:active.section,at:new Date().toISOString()};
    if(state.serverResume){
      var resumeId=clean(state.serverResume.studentId||'');
      var resumeSection=clean(state.serverResume.section||active.section);
      if((resumeId&&resumeId!==active.studentId)||(resumeSection&&resumeSection!==active.section)){
        delete state.serverResume;state.cloudResumeStatus='pending';delete state.currentRoute;delete state.currentCloudRoute;delete state.unlockedRoutes;
      }
    }
    write(STATE_KEY,state);
    document.documentElement.dataset.eapIdentityLock=active.section+'|'+active.studentId;
  }
})();

/* Retire legacy owners BEFORE parser reaches their direct script tags. */
window.__EAP_PLAYER_RESUME_STABLE_JSONP_V175__=true;
window.__EAP_RESUME_TRANSPORT_V179__=true;
window.__EAP_JSONP_GUARD_RETIRED_V5__=true;
window.__EAP_SINGLE_AUTHORITY_V1__=true;
window.__EAP_SINGLE_AUTHORITY_V2__=true;

/* Cache-safe bootstrap: identity + authority-first transport + SINGLE authority v3 + boss server confirmation. */
(function(){
  'use strict';
  function load(src,key){
    if(document.querySelector('script[data-eap-bootstrap="'+key+'"]'))return;
    var script=document.createElement('script');
    script.async=false;script.src=src;script.dataset.eapBootstrap=key;
    document.head.appendChild(script);
  }
  function boot(){
    load('./eap-profile-id-first-v117.js?v=20260810-identity-v122-mobile-safe-r1','identity-v122-mobile-safe-r1');
    load('./eap-player-resume-stable-jsonp-v174.js?v=20260811-resume-transport-v180-authority-first-r1','transport-v180-authority-first-r1');
    load('./eap-authority-runtime-v3.js?v=20260811-single-sheet-authority-v3-stable-r1','single-authority-v3-stable-r1');
    load('./eap-boss-server-confirmation-guard-v1.js?v=20260811-boss-server-confirmation-v1','boss-server-confirmation-v1');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
