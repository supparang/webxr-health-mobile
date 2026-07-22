/* =========================================================
   EAP Hero Live Sheet Route Finalizer v20260715
   FINAL CLOUD-FIRST ROUTE AUTHORITY / Section 122
   V4 LATE JSONP RESPONSE SAFE
   - Fetches player_resume live from Apps Script after profile is known.
   - Google Sheet response is the only authority for official progress/unlocks.
   - localStorage is used only to read the active identity and cache UI route.
   - Keeps timed-out JSONP callbacks as no-op tombstones so late responses
     never throw ReferenceError in the browser console.
========================================================= */
(function(){
  'use strict';
  if (window.__EAP_LIVE_SHEET_ROUTE_FINALIZER_V4__) return;
  window.__EAP_LIVE_SHEET_ROUTE_FINALIZER_V4__ = true;

  var VERSION = 'v20260722-EAP-LIVE-SHEET-ROUTE-FINALIZER-V4-LATE-JSONP-SAFE';
  var ORDER = ['S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3','S10','S11','S12','B4','S13','S14','S15','B5'];
  var SKILLS = ['reading','listening','writing','speaking'];
  var PASS = 60;
  var verified = null;
  var syncing = false;
  var lastSync = 0;

  function text(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function num(v){ var n = Number(v); return Number.isFinite(n) ? n : 0; }
  function yes(v){ return v === true || /^(true|1|yes|passed?)$/i.test(text(v)); }
  function norm(v){
    var s = text(v && v.routeId || v).toUpperCase();
    var m = s.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/i);
    if (m) return 'S' + Number(m[1]);
    m = s.match(/^B(?:OSS(?:\s*GATE)?)?\s*0?([1-5])$/i);
    if (m) return 'B' + Number(m[1]);
    if (/^\d+$/.test(s)) return 'S' + Number(s);
    return s;
  }
  function read(k){ try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch(_) { return {}; } }
  function profile(){
    var a = read('EAP_HERO_PLAYER_PROFILE_V1');
    var s = read('EAP_HERO_PROGRESS_V3');
    var p = Object.assign({}, s.profile||{}, s.player||{}, s.user||{}, a||{});
    return {
      studentId:text(p.studentId||p.id||s.studentId||s.id||''),
      studentName:text(p.studentName||p.name||s.studentName||s.name||s.playerName||''),
      section:text(p.section||s.section||(window.EAP_SHEET_CONFIG||{}).section||'122')||'122'
    };
  }
  function routePack(){
    var p = window.EAP_HERO_SESSION_CONTENT_PACK;
    return p && Array.isArray(p.routes) ? p : null;
  }
  function routeDef(id){
    var p = routePack(), rid = norm(id);
    return p ? (p.routes.find(function(r){ return norm(r.routeId) === rid; }) || null) : null;
  }
  function required(id){
    var rid = norm(id), r = routeDef(rid);
    if (/^B[1-5]$/.test(rid)) return SKILLS.slice();
    if (!r) return [];
    var c = r.skillContract || {};
    var out = SKILLS.filter(function(sk){ return /^(core|support|integrated)$/i.test(text(c[sk])); });
    return out.length ? out : ['reading','writing'];
  }
  function bestRecords(rows){
    var out = {};
    (Array.isArray(rows)?rows:[]).forEach(function(row){
      if (!row || String(row.legacyCompletion).toUpperCase() === 'TRUE') return;
      var rid = norm(row.routeId||row.sessionId||row.session||row.missionId);
      var sk = text(row.skill||row.skillName).toLowerCase();
      if (ORDER.indexOf(rid)<0 || SKILLS.indexOf(sk)<0) return;
      var score = Math.max(num(row.bestScore),num(row.latestScore),num(row.score));
      var passed = yes(row.passed) || score >= PASS;
      var key = rid+'|'+sk;
      if (!out[key] || score > out[key].score || (passed && !out[key].passed)) {
        out[key] = {score:score,passed:passed,row:row};
      }
    });
    return out;
  }
  function evaluate(rows){
    var best = bestRecords(rows), statuses = {}, first = ORDER.length-1;
    for (var i=0;i<ORDER.length;i++) {
      var rid=ORDER[i], req=required(rid), scores={}, missing=[];
      req.forEach(function(sk){
        var item=best[rid+'|'+sk];
        scores[sk]=item?item.score:0;
        if (!item || !item.passed) missing.push(sk);
      });
      statuses[rid]={routeId:rid,required:req,scores:scores,missing:missing,complete:req.length>0&&missing.length===0};
      if (first===ORDER.length-1 && !statuses[rid].complete) first=i;
    }
    return {currentRoute:ORDER[first]||'S1',currentIndex:first,statuses:statuses,best:best};
  }
  function endpoint(){ return text((window.EAP_SHEET_CONFIG||{}).webAppUrl||''); }
  function cacheVerifiedRoute(){
    if (!verified) return;
    try {
      localStorage.setItem('EAP_HERO_ACTIVE_ROUTE',verified.currentRoute);
      localStorage.setItem('EAP_HERO_CURRENT_ROUTE',verified.currentRoute);
      if (/^S/.test(verified.currentRoute)) localStorage.setItem('EAP_HERO_CURRENT_SESSION',String(Number(verified.currentRoute.slice(1))));
    } catch(_) {}
  }
  function applyLive(data,p){
    if (!data || data.ok!==true || !Array.isArray(data.records)) return false;
    var ev=evaluate(data.records);
    verified={
      profile:p,
      data:data,
      records:data.records.slice(),
      currentRoute:ev.currentRoute,
      currentIndex:ev.currentIndex,
      statuses:ev.statuses,
      receivedAt:new Date().toISOString()
    };

    cacheVerifiedRoute();

    try {
      var fixed=Object.assign({},data,{studentId:p.studentId,studentName:text(data.studentName||p.studentName),section:p.section,generatedAt:new Date().toISOString(),currentCloudRoute:verified.currentRoute,currentRoute:verified.currentRoute});
      if (window.EAPRoadmapLockGuard && typeof window.EAPRoadmapLockGuard.acceptResume==='function') {
        window.EAPRoadmapLockGuard.acceptResume({detail:{data:fixed,source:'live_sheet_finalizer',live:true}});
      }
      window.dispatchEvent(new CustomEvent('eap:resume-synced',{detail:{data:fixed,source:'live_sheet_finalizer',live:true,changed:true,cloudFirst:true}}));
    } catch(_) {}

    refreshAll();
    window.dispatchEvent(new CustomEvent('eap:live-sheet-route-finalized',{detail:diagnostics()}));
    return true;
  }
  function sync(force){
    var p=profile(), url=endpoint(), now=Date.now();
    if (!p.studentId || !url || syncing || (!force && now-lastSync<12000)) return false;
    syncing=true; lastSync=now;
    var cb='__eapLiveFinal_'+now+'_'+Math.random().toString(36).slice(2,7);
    var script=document.createElement('script'),done=false,timer,cleanupTimer;
    function tombstone(){
      window[cb]=function(){ return false; };
      clearTimeout(cleanupTimer);
      cleanupTimer=setTimeout(function(){
        try{ delete window[cb]; }catch(_){ window[cb]=void 0; }
      },120000);
    }
    function finish(){
      if(done)return;
      done=true;
      syncing=false;
      clearTimeout(timer);
      if(script.parentNode)script.remove();
      tombstone();
    }
    window[cb]=function(data){
      if(done)return false;
      done=true;
      syncing=false;
      clearTimeout(timer);
      if(script.parentNode)script.remove();
      tombstone();
      return applyLive(data,p);
    };
    script.onerror=function(){ finish(); };
    timer=setTimeout(finish,20000);
    var u=new URL(url,location.href);
    u.searchParams.set('action','player_resume');
    u.searchParams.set('studentId',p.studentId);
    u.searchParams.set('studentName',p.studentName);
    u.searchParams.set('section',p.section);
    u.searchParams.set('callback',cb);
    u.searchParams.set('_',String(now));
    script.async=true; script.referrerPolicy='no-referrer'; script.src=u.toString();
    document.head.appendChild(script);
    return true;
  }
  function canOpen(id){
    var idx=ORDER.indexOf(norm(id));
    return !!verified && idx>=0 && idx<=verified.currentIndex;
  }
  function hero(){ return window.EAPHero || window.EapHero || window.eapHero || null; }
  function openVerifiedSession(sessionNo){
    var api=hero();
    if (!api) return false;

    if (typeof api.__skillHubRouteLockOriginalSkillHub === 'function') {
      api.__skillHubRouteLockCalling=true;
      try { api.__skillHubRouteLockOriginalSkillHub.call(api,sessionNo); }
      finally { api.__skillHubRouteLockCalling=false; }
      return true;
    }
    if (typeof api.skillHub === 'function') {
      api.__skillHubRouteLockCalling=true;
      try { api.skillHub(sessionNo); }
      finally { api.__skillHubRouteLockCalling=false; }
      return true;
    }
    return false;
  }
  function openRoute(id){
    var rid=norm(id||verified&&verified.currentRoute||'S1');
    if (!canOpen(rid)) return false;
    cacheVerifiedRoute();
    try {
      if (/^B/.test(rid)) {
        var gate=Number(rid.slice(1));
        if (window.EAPBossFourSkillV4 && typeof window.EAPBossFourSkillV4.start==='function') { window.EAPBossFourSkillV4.start(gate); return true; }
        var api=hero();
        if (api && typeof api.startGateBoss==='function') return api.startGateBoss(rid)!==false;
        if (api && typeof api.openBoss==='function') return api.openBoss(rid)!==false;
      } else {
        return openVerifiedSession(Number(rid.slice(1)));
      }
    } catch(_) {}
    return false;
  }

  function refreshLobby(){
    if (!verified) return;
    var rid=verified.currentRoute, r=routeDef(rid), title=text(r&&r.title||r&&r.sessionTitle||rid);

    try {
      if (window.EAPStudentHomeLobby && typeof window.EAPStudentHomeLobby.refresh==='function') {
        window.EAPStudentHomeLobby.refresh();
      }
    } catch(_) {}

    var lobby=document.getElementById('eap-student-compact-lobby');
    if (!lobby) return;
    var now=lobby.querySelector('.lob-now');
    if (!now) return;
    var kicker=now.querySelector('.lob-kicker');
    var titleEl=now.querySelector('.lob-title');
    var metas=now.querySelectorAll('.lob-meta');
    var hint=now.querySelector('.profile-hint');
    var week=/^S/.test(rid)?Number(rid.slice(1)):Math.ceil((ORDER.indexOf(rid)+1)*3/4);
    if (kicker) kicker.textContent='ตอนนี้';
    if (titleEl) titleEl.textContent=/^S/.test(rid)?('Week '+week+' / '+rid):(rid+' Boss Gate');
    if (metas[0]) metas[0].textContent=title||rid;
    if (metas[1]) metas[1].textContent=text(verified.profile.studentName)+' · ID '+text(verified.profile.studentId)+' · Section '+text(verified.profile.section);
    if (hint) hint.textContent='ความคืบหน้ายืนยันจาก Google Sheet แล้ว · กด Start / Continue เพื่อเล่นด่านนี้';
    var btn=lobby.querySelector('[data-eap-lobby-action="continue"]');
    if (btn) btn.setAttribute('data-eap-live-current-route',rid);
  }
  function refreshAll(){
    cacheVerifiedRoute();
    try{ if(window.EAPRoadmapLockGuard&&typeof window.EAPRoadmapLockGuard.refresh==='function')window.EAPRoadmapLockGuard.refresh(); }catch(_){}
    try{ if(window.EAPCloudResumeLifecycleCompletion&&typeof window.EAPCloudResumeLifecycleCompletion.refresh==='function')window.EAPCloudResumeLifecycleCompletion.refresh(); }catch(_){}
    try{ if(window.EAPStudentHomeLobby&&typeof window.EAPStudentHomeLobby.refresh==='function')window.EAPStudentHomeLobby.refresh(); }catch(_){}
    setTimeout(refreshLobby,80);
  }
  function diagnostics(){ return {version:VERSION,liveVerified:!!verified,currentRoute:verified&&verified.currentRoute||'S1',recordCount:verified&&verified.records.length||0,profile:verified&&verified.profile||profile(),statuses:verified&&verified.statuses||{}}; }

  document.addEventListener('click',function(e){
    var el=e.target&&e.target.closest&&e.target.closest('button,a');
    if(!el)return;
    var t=text(el.textContent);
    if(!/start\s*\/\s*continue|continue session|^continue$/i.test(t))return;
    if(!verified){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); sync(true); return; }
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    cacheVerifiedRoute();
    openRoute(verified.currentRoute);
  },true);

  window.addEventListener('eap:profile-changed',function(){verified=null;setTimeout(function(){sync(true);},120);});
  window.addEventListener('eap:resume-synced',function(e){
    var d=e&&e.detail||{}; if(d.source==='live_sheet_finalizer')return;
    if(d.live===true && d.data) applyLive(d.data,profile());
  });
  window.addEventListener('load',function(){setTimeout(function(){sync(true);},250);});
  if(document.readyState!=='loading')setTimeout(function(){sync(true);},250);
  setInterval(function(){ if(verified)refreshAll(); else sync(false); },1500);

  window.EAPLiveSheetRouteFinalizer={version:VERSION,sync:sync,openRoute:openRoute,canOpen:canOpen,currentRoute:function(){return verified&&verified.currentRoute||'S1';},diagnostics:diagnostics};
})();