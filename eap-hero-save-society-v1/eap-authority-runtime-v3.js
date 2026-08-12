/* =========================================================
   EAP Hero • Single Sheet Authority Runtime v3
   VERSION: 20260812-EAP-SINGLE-SHEET-AUTHORITY-V3-PROGRESS-V150-ROUTEPROGRESS

   Production rules
   1. Google Sheet player_resume is the only progression authority.
   2. EAP_Progress v150 is the canonical progression source.
   3. Accept both legacy eap-session-authority and canonical eap-progress-authority responses.
   4. Preserve routeProgress from EAP_Progress v150 for historical Session/Skill UI.
   5. Build compact portfolio records from routeProgress.skills when legacy records are absent.
   6. Never downgrade an already verified route because a background refresh is pending/fails.
========================================================= */
(function () {
  'use strict';

  if (window.__EAP_SINGLE_AUTHORITY_V3__) return;
  window.__EAP_SINGLE_AUTHORITY_V3__ = true;

  var VERSION = '20260812-EAP-SINGLE-SHEET-AUTHORITY-V3-PROGRESS-V150-ROUTEPROGRESS';
  var STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  var PROFILE_KEY = 'EAP_HERO_PLAYER_PROFILE_V1';
  var ACTIVE_KEY = 'EAP_HERO_ACTIVE_PLAYER_V1';
  var SNAPSHOT_PREFIX = 'EAP_HERO_PLAYER_STATE_V1_';
  var ORDER = ['S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3','S10','S11','S12','B4','S13','S14','S15','B5'];
  var VALID_ROUTE = /^(?:S(?:1[0-5]|[1-9])|B[1-5])$/;
  var SKILLS = ['Reading','Writing','Listening','Speaking'];
  var live = {verified:false,loading:true,route:'',records:[],routeProgress:{},identity:'',checkedAt:'',inFlight:false,lastRequestAt:0};
  var refreshTimer = 0;
  var renderTimer = 0;

  function text(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function parse(v,fallback){ try { return JSON.parse(v); } catch(_){ return fallback; } }
  function read(k){ return parse(localStorage.getItem(k) || '{}', {}) || {}; }
  function write(k,v){ try { localStorage.setItem(k, JSON.stringify(v || {})); return true; } catch(_){ return false; } }
  function num(v){ var n=Number(v); return Number.isFinite(n)?n:0; }

  function normalizeRoute(value){
    var raw = text(value && value.routeId || value).toUpperCase();
    var m = raw.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/i);
    if (m) return 'S' + Number(m[1]);
    m = raw.match(/^(?:B|BOSS|GATE|BOSS\s*GATE)\s*0?([1-5])$/i);
    if (m) return 'B' + Number(m[1]);
    return raw;
  }

  function profile(){
    var a = read(ACTIVE_KEY), p = read(PROFILE_KEY), s = read(STATE_KEY), cfg = window.EAP_SHEET_CONFIG || {};
    return {
      studentId:text(a.studentId || a.id || p.studentId || p.id || s.studentId || s.id),
      studentName:text(a.studentName || a.name || p.studentName || p.name || s.studentName || s.name || s.playerName),
      section:text(a.section || p.section || s.section || cfg.section || '122') || '122'
    };
  }

  function identityOf(p){ p = p || profile(); return p.section + '|' + p.studentId; }
  function snapshotKey(p){ p = p || profile(); return p.studentId ? SNAPSHOT_PREFIX + encodeURIComponent(p.section + '__' + p.studentId) : ''; }

  function validSnapshot(resume,p){
    p = p || profile();
    if (!resume || !p.studentId) return false;
    var route = normalizeRoute(resume.currentRoute || resume.currentCloudRoute || resume.nextRoute);
    if (!VALID_ROUTE.test(route)) return false;
    if (!(resume.serverVerified === true || resume.cloudVerified === true || resume.compact === true)) return false;
    if (text(resume.studentId) && text(resume.studentId) !== p.studentId) return false;
    if ((text(resume.section) || p.section) !== p.section) return false;
    if (text(resume.identityKey) && text(resume.identityKey) !== identityOf(p)) return false;
    return true;
  }

  function compactRecord(row){
    row = row || {};
    var route = normalizeRoute(row.routeId || row.sessionId || row.session);
    return {
      studentId:text(row.studentId), studentName:text(row.studentName), section:text(row.section),
      routeId:route, sessionId:route, sessionTitle:text(row.sessionTitle || row.routeTitle),
      skill:text(row.skill), score:num(row.bestScore !== undefined ? row.bestScore : row.score),
      bestScore:num(row.bestScore !== undefined ? row.bestScore : row.score),
      latestScore:num(row.latestScore !== undefined ? row.latestScore : row.score),
      passed:row.passed === true || String(row.passed).toLowerCase() === 'true' || num(row.bestScore !== undefined ? row.bestScore : row.score) >= 60,
      authoritativePassed:row.authoritativePassed === true || row.passed === true || String(row.passed).toLowerCase() === 'true',
      evidenceId:text(row.evidenceId),
      updatedAt:text(row.updatedAt || row.latestAt || row.createdAt),
      sourceSheet:text(row.sourceSheet || 'EAP_Progress'), cloudVerified:true, serverVerified:true,
      teacherReviewRequired:row.teacherReviewRequired === true,
      teacherReviewStatus:text(row.teacherReviewStatus)
    };
  }

  function recordsFromRouteProgress(routeProgress){
    var out=[]; routeProgress = routeProgress && typeof routeProgress==='object' ? routeProgress : {};
    Object.keys(routeProgress).forEach(function(routeKey){
      var route = routeProgress[routeKey] || {};
      var routeId = normalizeRoute(route.routeId || routeKey);
      var skills = route.skills && typeof route.skills==='object' ? route.skills : {};
      Object.keys(skills).forEach(function(skillKey){
        var rec = skills[skillKey] || {};
        var skill = SKILLS.indexOf(skillKey)>=0 ? skillKey : text(rec.skill || skillKey);
        if(SKILLS.indexOf(skill)<0) return;
        var score = Math.max(num(rec.score),num(rec.bestScore),num(rec.latestScore));
        var passed = rec.passed===true || String(rec.passed).toLowerCase()==='true' || score>=60;
        if(!score && !passed && !text(rec.evidenceId)) return;
        out.push(compactRecord({
          routeId:routeId, sessionId:routeId, skill:skill,
          score:score,bestScore:score,latestScore:score,passed:passed,authoritativePassed:passed,
          evidenceId:rec.evidenceId,updatedAt:rec.updatedAt,teacherReviewStatus:rec.teacherReviewStatus,
          sourceSheet:'EAP_Progress'
        }));
      });
    });
    return out;
  }

  function mergeRecords(primary,secondary){
    var map={};
    function add(row){
      row=compactRecord(row); var key=normalizeRoute(row.routeId)+'|'+text(row.skill);
      if(!row.routeId||!row.skill) return;
      var old=map[key];
      if(!old || (row.passed&&!old.passed) || num(row.bestScore)>num(old.bestScore) || text(row.updatedAt)>text(old.updatedAt)) map[key]=row;
    }
    (primary||[]).forEach(add); (secondary||[]).forEach(add);
    return Object.keys(map).map(function(k){return map[k];});
  }

  function acceptedService(data){
    var service = text(data && data.service);
    return !service || service === 'eap-session-authority' || service === 'eap-progress-authority';
  }

  function validResume(data){
    var p = profile();
    if (!data || data.ok !== true || !p.studentId) return false;
    if (!acceptedService(data)) return false;
    if (text(data.studentId) && text(data.studentId) !== p.studentId) return false;
    if (text(data.section) && text(data.section) !== p.section) return false;
    return VALID_ROUTE.test(normalizeRoute(data.currentRoute || data.currentCloudRoute || data.nextRoute));
  }

  function compactResume(data){
    var p = profile();
    var route = normalizeRoute(data.currentRoute || data.currentCloudRoute || data.nextRoute);
    var routeProgress = data.routeProgress && typeof data.routeProgress==='object' ? data.routeProgress : {};
    var legacyRecords = Array.isArray(data.records) ? data.records.map(compactRecord) : [];
    var progressRecords = recordsFromRouteProgress(routeProgress);
    var records = mergeRecords(progressRecords, legacyRecords);
    var unlocked = {};
    var src = data.unlockedRoutes || data.unlockedRouteIds || data.unlockedRouteList || {};
    if (Array.isArray(src)) src.forEach(function(x){ var r=normalizeRoute(x); if(r) unlocked[r]=true; });
    else if (src && typeof src === 'object') Object.keys(src).forEach(function(k){ var r=normalizeRoute(k); if(r && src[k]) unlocked[r]=true; });
    var idx = ORDER.indexOf(route);
    if (idx >= 0) for (var i=0;i<=idx;i++) unlocked[ORDER[i]] = true;
    return {
      ok:true,service:text(data.service) || 'eap-progress-authority',version:text(data.version),
      authorityMode:data.authorityMode || (text(data.service)==='eap-progress-authority' ? 'EAP_Progress-single-source-of-truth' : 'sheet-only'),
      studentId:p.studentId,studentName:text(data.studentName || p.studentName),section:p.section,identityKey:identityOf(p),
      currentRoute:route,currentCloudRoute:route,nextRoute:normalizeRoute(data.nextRoute || route),unlockedRoutes:unlocked,
      routeProgress:routeProgress,
      passedRoutes:Array.isArray(data.passedRoutes)?data.passedRoutes.slice():[],
      records:records,recordCount:records.length,
      checkedAt:text(data.checkedAt || data.generatedAt || new Date().toISOString()),acceptedAt:new Date().toISOString(),
      cloudVerified:true,serverVerified:true,compact:true
    };
  }

  function persist(resume){
    var p = profile(), s = read(STATE_KEY);
    s.profile=Object.assign({},s.profile||{},p);s.player=Object.assign({},s.player||{},p);s.user=Object.assign({},s.user||{},p);
    s.id=p.studentId;s.studentId=p.studentId;s.name=p.studentName;s.studentName=p.studentName;s.playerName=p.studentName;s.section=p.section;
    s.cloudResumeStatus='ok';s.currentRoute=resume.currentRoute;s.currentCloudRoute=resume.currentRoute;s.unlockedRoutes=resume.unlockedRoutes||{};
    s.routeProgress=resume.routeProgress||{};s.serverResume=resume;s.authorityVersion=VERSION;s.__verifiedSnapshotAt=new Date().toISOString();
    write(STATE_KEY,s); var sk=snapshotKey(p); if(sk) write(sk,s);
  }

  function applyResume(eventOrData){
    var d = eventOrData && eventOrData.detail ? eventOrData.detail : eventOrData;
    var data = d && d.data ? d.data : d; live.inFlight=false;
    if (!validResume(data)) { live.loading=false; scheduleRender(); return false; }
    var resume = compactResume(data); persist(resume);
    live.verified=true;live.loading=false;live.route=resume.currentRoute;live.records=resume.records||[];live.routeProgress=resume.routeProgress||{};
    live.identity=resume.identityKey;live.checkedAt=resume.checkedAt;scheduleRender();
    try { window.dispatchEvent(new CustomEvent('eap:single-authority-applied',{detail:{data:resume,currentRoute:resume.currentRoute,version:VERSION}})); } catch(_){}
    try { window.dispatchEvent(new CustomEvent('eap:portfolio-hydrated-v150',{detail:{count:live.records.length,routeProgress:live.routeProgress}})); } catch(_){}
    return true;
  }

  function restore(){
    var p=profile(),s=read(STATE_KEY),resume=s.serverResume||{};
    if(!validSnapshot(resume,p)){
      var scoped=snapshotKey(p)?read(snapshotKey(p)):{}; resume=scoped.serverResume||{};
      if(!validSnapshot(resume,p)) return false; s=scoped; write(STATE_KEY,s);
    }
    live.verified=true;live.loading=false;live.route=normalizeRoute(resume.currentRoute);live.records=Array.isArray(resume.records)?resume.records:[];
    live.routeProgress=resume.routeProgress||s.routeProgress||{};live.identity=identityOf(p);live.checkedAt=text(resume.checkedAt||resume.acceptedAt);
    document.documentElement.dataset.eapCurrentRoute=live.route;return true;
  }

  function request(force){
    var now=Date.now(); if(live.inFlight)return false; if(!force&&now-live.lastRequestAt<5000)return false;
    var t=window.EAPPlayerResumeStableJSONP; if(!t||typeof t.request!=='function')return false;
    live.inFlight=true;live.loading=true;live.lastRequestAt=now;
    try{var started=t.request(force===true);if(started===false){live.inFlight=false;live.loading=false;}return started;}catch(_){live.inFlight=false;live.loading=false;return false;}
  }

  function backgroundRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(function(){request(false);},700);}
  function afterSubmit(){clearTimeout(refreshTimer);refreshTimer=setTimeout(function(){request(true);},1200);}
  function scheduleRender(){clearTimeout(renderTimer);renderTimer=setTimeout(render,80);}
  function render(){
    if(live.verified){
      document.documentElement.dataset.eapCurrentRoute=live.route;
      var buttons=document.querySelectorAll('button,a,[role="button"]');
      for(var i=0;i<buttons.length;i++) if(/Start\s*\/\s*Continue/i.test(text(buttons[i].textContent))){buttons[i].disabled=false;buttons[i].removeAttribute('aria-disabled');buttons[i].style.pointerEvents='';buttons[i].style.opacity='';}
    }
    document.documentElement.dataset.eapAuthorityRuntime=VERSION;
    document.documentElement.dataset.eapAuthorityLoading=live.loading?'1':'0';
    document.documentElement.dataset.eapAuthorityVerified=live.verified?'1':'0';
  }

  window.addEventListener('eap:resume-synced',applyResume);
  window.addEventListener('eap:resume-failed',function(){live.inFlight=false;live.loading=false;scheduleRender();});
  window.addEventListener('eap:profile-changed',function(){live={verified:false,loading:true,route:'',records:[],routeProgress:{},identity:identityOf(),checkedAt:'',inFlight:false,lastRequestAt:0};if(!restore())request(true);scheduleRender();});
  window.addEventListener('online',backgroundRefresh);
  ['eap:evidence-submitted','eap:boss-completed','eap:boss-completion-submitted','eap:resume-refresh-requested'].forEach(function(name){window.addEventListener(name,afterSubmit);});

  var restored=restore(); if(!restored)request(true); else backgroundRefresh(); scheduleRender();

  window.EAPAuthorityRuntime={
    version:VERSION,acceptResume:applyResume,refresh:function(){return request(true);},currentRoute:function(){return live.verified?live.route:'';},
    records:function(){return(live.records||[]).slice();},routeProgress:function(){return live.routeProgress||{};},isVerified:function(){return live.verified;},
    diagnostics:function(){return{version:VERSION,verified:live.verified,loading:live.loading,currentRoute:live.route,recordCount:live.records.length,routeProgressCount:Object.keys(live.routeProgress||{}).length,identity:live.identity||identityOf(),checkedAt:live.checkedAt,inFlight:live.inFlight,lastRequestAt:live.lastRequestAt};}
  };
})();
