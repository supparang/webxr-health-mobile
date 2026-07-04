/* EAP Hero Resume Boss State Add-on
   Applies verified B1–B5 Boss Clash rows from the resume cache to the
   local state without inventing any skill evidence. */
(function(){
  'use strict';
  var STATE='EAP_HERO_PROGRESS_V3';
  var PROFILE='EAP_HERO_PLAYER_PROFILE_V1';
  var ACTIVE='EAP_HERO_ACTIVE_PLAYER_V1';
  var SNAP='EAP_HERO_PLAYER_STATE_V1_';
  function read(key,fallback){try{var raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(_){return fallback;}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch(_){}}
  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function profile(){var p=read(PROFILE,{})||{};return {studentId:clean(p.studentId||p.id),studentName:clean(p.studentName||p.name),section:clean(p.section||'122')||'122'};}
  function key(p){return encodeURIComponent(p.section+'__'+p.studentId);}
  function boot(){
    if(!window.EAPPlayerResume||typeof window.EAPPlayerResume.cache!=='function')return false;
    var p=profile();if(!p.studentId)return false;
    var cache=window.EAPPlayerResume.cache();if(!cache||!cache.ok||!Array.isArray(cache.records))return false;
    var state=read(STATE,{})||{};state.completedSessions=state.completedSessions||{};state.unlockedSessions=state.unlockedSessions||{};state.bossProgress=state.bossProgress||{};
    var changed=false;
    cache.records.forEach(function(row){
      var sid=clean(row&&row.sessionId).toUpperCase();
      var skill=clean(row&&row.skill).toLowerCase();
      var passed=row&& (row.passed===true||String(row.passed).toUpperCase()==='TRUE');
      if(!/^B[1-5]$/.test(sid)||skill!=='boss clash'||!passed)return;
      if(!state.completedSessions[sid]){state.completedSessions[sid]=true;changed=true;}
      if(!state.unlockedSessions[sid]){state.unlockedSessions[sid]=true;changed=true;}
      var old=state.bossProgress[sid]||{};
      if(!old.passed||Number(row.bestScore||0)>Number(old.bestScore||0)){
        state.bossProgress[sid]={passed:true,bestScore:Number(row.bestScore||0),updatedAt:clean(row.updatedAt),restoredFromSheet:true};changed=true;
      }
    });
    if(changed){write(STATE,state);write(SNAP+key(p),state);write(ACTIVE,p);}
    return changed;
  }
  boot();
  var tries=0;var poll=setInterval(function(){boot();tries++;if(tries>=18)clearInterval(poll);},350);
  window.addEventListener('eap:resume-synced',boot);
  window.addEventListener('eap:profile-saved',function(){setTimeout(boot,250);});
})();
