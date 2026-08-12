/* =========================================================
   EAP Hero • Single Sheet Authority Runtime v4
   VERSION: 20260812-EAP-SINGLE-SHEET-AUTHORITY-V4-PORTFOLIO

   Production rules
   1. Google Sheet player_resume is the only progression authority.
   2. A learner-scoped server-verified snapshot survives reload.
   3. Never downgrade a verified route because refresh is pending/fails.
   4. One resume request at a time. No retry storm.
   5. Recent Portfolio is rendered only from server-verified resume records.
========================================================= */
(function () {
  'use strict';

  if (window.__EAP_SINGLE_AUTHORITY_V4__) return;
  window.__EAP_SINGLE_AUTHORITY_V4__ = true;
  window.__EAP_SINGLE_AUTHORITY_V3__ = true;

  var VERSION = '20260812-EAP-SINGLE-SHEET-AUTHORITY-V4-PORTFOLIO';
  var STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  var PROFILE_KEY = 'EAP_HERO_PLAYER_PROFILE_V1';
  var ACTIVE_KEY = 'EAP_HERO_ACTIVE_PLAYER_V1';
  var SNAPSHOT_PREFIX = 'EAP_HERO_PLAYER_STATE_V1_';
  var ORDER = [
    'S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3',
    'S10','S11','S12','B4','S13','S14','S15','B5'
  ];
  var VALID_ROUTE = /^(?:S(?:1[0-5]|[1-9])|B[1-5])$/;
  var VALID_SKILLS = ['Reading','Writing','Listening','Speaking','Boss Clash','boss'];
  var live = {
    verified:false, loading:true, route:'', records:[], identity:'', checkedAt:'',
    inFlight:false, lastRequestAt:0
  };
  var refreshTimer = 0;
  var renderTimer = 0;

  function text(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function parse(v,fallback){ try { return JSON.parse(v); } catch(_){ return fallback; } }
  function read(k){ return parse(localStorage.getItem(k) || '{}', {}) || {}; }
  function write(k,v){ try { localStorage.setItem(k, JSON.stringify(v || {})); return true; } catch(_){ return false; } }

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
      skill:text(row.skill), score:Number(row.bestScore !== undefined ? row.bestScore : row.score || 0),
      bestScore:Number(row.bestScore !== undefined ? row.bestScore : row.score || 0),
      latestScore:Number(row.latestScore !== undefined ? row.latestScore : row.score || 0),
      passed:row.passed === true || String(row.passed).toLowerCase() === 'true',
      authoritativePassed:row.authoritativePassed === true,
      updatedAt:text(row.updatedAt || row.latestAt || row.createdAt),
      sourceSheet:text(row.sourceSheet || 'summary'), cloudVerified:true, serverVerified:true,
      teacherReviewRequired:row.teacherReviewRequired === true,
      teacherReviewStatus:text(row.teacherReviewStatus)
    };
  }

  function validResume(data){
    var p = profile();
    if (!data || data.ok !== true || !p.studentId) return false;
    if (text(data.service) && text(data.service) !== 'eap-session-authority') return false;
    if (text(data.studentId) && text(data.studentId) !== p.studentId) return false;
    if (text(data.section) && text(data.section) !== p.section) return false;
    return VALID_ROUTE.test(normalizeRoute(data.currentRoute || data.currentCloudRoute || data.nextRoute));
  }

  function compactResume(data){
    var p = profile();
    var route = normalizeRoute(data.currentRoute || data.currentCloudRoute || data.nextRoute);
    var records = Array.isArray(data.records) ? data.records.map(compactRecord) : [];
    var unlocked = {}, src = data.unlockedRoutes || data.unlockedRouteIds || {};
    if (Array.isArray(src)) src.forEach(function(x){ var r=normalizeRoute(x); if(r) unlocked[r]=true; });
    else if (src && typeof src === 'object') Object.keys(src).forEach(function(k){ var r=normalizeRoute(k); if(r && src[k]) unlocked[r]=true; });
    var idx = ORDER.indexOf(route);
    if (idx >= 0) for (var i=0;i<=idx;i++) unlocked[ORDER[i]] = true;
    return {
      ok:true, service:'eap-session-authority', version:text(data.version), authorityMode:'sheet-only',
      studentId:p.studentId, studentName:text(data.studentName || p.studentName), section:p.section,
      identityKey:identityOf(p), currentRoute:route, currentCloudRoute:route,
      nextRoute:normalizeRoute(data.nextRoute || route), unlockedRoutes:unlocked,
      records:records, recordCount:records.length,
      checkedAt:text(data.checkedAt || data.generatedAt || new Date().toISOString()),
      acceptedAt:new Date().toISOString(), cloudVerified:true, serverVerified:true, compact:true
    };
  }

  function persist(resume){
    var p = profile(), s = read(STATE_KEY);
    s.profile=Object.assign({},s.profile||{},p); s.player=Object.assign({},s.player||{},p); s.user=Object.assign({},s.user||{},p);
    s.id=p.studentId; s.studentId=p.studentId; s.name=p.studentName; s.studentName=p.studentName; s.playerName=p.studentName; s.section=p.section;
    s.cloudResumeStatus='ok'; s.currentRoute=resume.currentRoute; s.currentCloudRoute=resume.currentRoute;
    s.unlockedRoutes=resume.unlockedRoutes||{}; s.serverResume=resume; s.authorityVersion=VERSION; s.__verifiedSnapshotAt=new Date().toISOString();
    write(STATE_KEY,s); var sk=snapshotKey(p); if(sk) write(sk,s);
  }

  function applyResume(eventOrData){
    var d=eventOrData&&eventOrData.detail?eventOrData.detail:eventOrData;
    var data=d&&d.data?d.data:d;
    live.inFlight=false;
    if(!validResume(data)) return false;
    var resume=compactResume(data); persist(resume);
    live.verified=true; live.loading=false; live.route=resume.currentRoute; live.records=resume.records||[];
    live.identity=resume.identityKey; live.checkedAt=resume.checkedAt;
    scheduleRender();
    try{window.dispatchEvent(new CustomEvent('eap:single-authority-applied',{detail:{data:resume,currentRoute:resume.currentRoute,version:VERSION}}));}catch(_){}
    return true;
  }

  function restore(){
    var p=profile(), s=read(STATE_KEY), resume=s.serverResume||{};
    if(!validSnapshot(resume,p)){
      var scoped=snapshotKey(p)?read(snapshotKey(p)):{}; resume=scoped.serverResume||{};
      if(!validSnapshot(resume,p)) return false;
      s=scoped; write(STATE_KEY,s);
    }
    live.verified=true; live.loading=false; live.route=normalizeRoute(resume.currentRoute);
    live.records=Array.isArray(resume.records)?resume.records:[]; live.identity=identityOf(p);
    live.checkedAt=text(resume.checkedAt||resume.acceptedAt);
    document.documentElement.dataset.eapCurrentRoute=live.route;
    return true;
  }

  function request(force){
    var now=Date.now();
    if(live.inFlight) return false;
    if(!force && now-live.lastRequestAt<5000) return false;
    var t=window.EAPPlayerResumeStableJSONP;
    if(!t||typeof t.request!=='function') return false;
    live.inFlight=true; live.lastRequestAt=now;
    try{var started=t.request(force===true); if(started===false) live.inFlight=false; return started;}
    catch(_){live.inFlight=false; return false;}
  }

  function backgroundRefresh(){ clearTimeout(refreshTimer); refreshTimer=setTimeout(function(){request(false);},700); }
  function afterSubmit(){ clearTimeout(refreshTimer); refreshTimer=setTimeout(function(){request(true);},1200); }
  function scheduleRender(){ clearTimeout(renderTimer); renderTimer=setTimeout(render,80); }

  function scoreOf(record){
    var values=[record.bestScore,record.latestScore,record.score];
    for(var i=0;i<values.length;i++){var n=Number(values[i]); if(Number.isFinite(n)) return n;}
    return 0;
  }

  function findPortfolioTable(){
    var tables=document.querySelectorAll('#app table, table');
    for(var i=0;i<tables.length;i++){
      var header=tables[i].querySelector('thead');
      var labels=text(header?header.textContent:tables[i].textContent).toLowerCase();
      if(labels.indexOf('session')>=0 && labels.indexOf('skill')>=0 && labels.indexOf('score')>=0 && labels.indexOf('output')>=0) return tables[i];
    }
    return null;
  }

  function renderPortfolio(){
    if(!live.verified) return;
    var table=findPortfolioTable();
    if(!table) return;
    var tbody=table.tBodies&&table.tBodies[0];
    if(!tbody){tbody=document.createElement('tbody');table.appendChild(tbody);}

    var records=(live.records||[]).filter(function(record){
      var route=normalizeRoute(record.sessionId||record.routeId);
      var skill=text(record.skill);
      return /^S\d+$/.test(route) && VALID_SKILLS.indexOf(skill)>=0 && scoreOf(record)>0;
    });

    var best={};
    records.forEach(function(record){
      var route=normalizeRoute(record.sessionId||record.routeId), skill=text(record.skill), key=route+'|'+skill;
      var cur=best[key];
      if(!cur || (record.passed&&!cur.passed) ||
         (record.passed===cur.passed && scoreOf(record)>scoreOf(cur)) ||
         (record.passed===cur.passed && scoreOf(record)===scoreOf(cur) && text(record.updatedAt)>text(cur.updatedAt))) best[key]=record;
    });
    records=Object.keys(best).map(function(k){return best[k];});
    records.sort(function(a,b){
      var time=text(b.updatedAt).localeCompare(text(a.updatedAt));
      if(time) return time;
      return ORDER.indexOf(normalizeRoute(b.routeId))-ORDER.indexOf(normalizeRoute(a.routeId));
    });

    if(!records.length){
      tbody.innerHTML='<tr data-eap-authority="sheet"><td colspan="4" style="text-align:center;padding:14px">ยังไม่มีผลงานรายทักษะที่ยืนยันจาก Google Sheet</td></tr>';
      table.dataset.eapAuthorityVersion=VERSION;
      return;
    }

    tbody.innerHTML=records.slice(0,12).map(function(record){
      var route=normalizeRoute(record.sessionId||record.routeId);
      var score=Math.round(scoreOf(record));
      var output=record.passed?'ผ่านแล้ว · Google Sheet':'บันทึกแล้ว · Google Sheet';
      return '<tr data-eap-authority="sheet">'+
        '<td><strong>'+route+'</strong></td>'+
        '<td>'+text(record.skill)+'</td>'+
        '<td><strong>'+score+'/100</strong></td>'+
        '<td>'+output+'</td>'+
        '</tr>';
    }).join('');
    table.dataset.eapAuthorityVersion=VERSION;
    table.dataset.eapPortfolioRecordCount=String(records.length);
  }

  function render(){
    if(live.verified){
      document.documentElement.dataset.eapCurrentRoute=live.route;
      var buttons=document.querySelectorAll('button,a,[role="button"]');
      for(var i=0;i<buttons.length;i++){
        if(/Start\s*\/\s*Continue/i.test(text(buttons[i].textContent))){
          buttons[i].disabled=false; buttons[i].removeAttribute('aria-disabled'); buttons[i].style.pointerEvents=''; buttons[i].style.opacity='';
        }
      }
    }
    renderPortfolio();
    document.documentElement.dataset.eapAuthorityRuntime=VERSION;
  }

  window.addEventListener('eap:resume-synced',applyResume);
  window.addEventListener('eap:resume-failed',function(){live.inFlight=false;if(!live.verified)live.loading=false;});
  window.addEventListener('eap:profile-changed',function(){
    live={verified:false,loading:true,route:'',records:[],identity:identityOf(),checkedAt:'',inFlight:false,lastRequestAt:0};
    if(!restore())request(true); scheduleRender();
  });
  window.addEventListener('online',backgroundRefresh);
  ['eap:evidence-submitted','eap:boss-completed','eap:boss-completion-submitted','eap:resume-refresh-requested'].forEach(function(name){window.addEventListener(name,afterSubmit);});

  new MutationObserver(scheduleRender).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(render,1500);

  var restored=restore();
  if(!restored)request(true); else backgroundRefresh();
  scheduleRender();

  window.EAPAuthorityRuntime={
    version:VERSION,
    acceptResume:applyResume,
    refresh:function(){return request(true);},
    currentRoute:function(){return live.verified?live.route:'';},
    records:function(){return(live.records||[]).slice();},
    isVerified:function(){return live.verified;},
    diagnostics:function(){return{version:VERSION,verified:live.verified,loading:live.loading,currentRoute:live.route,recordCount:live.records.length,identity:live.identity||identityOf(),checkedAt:live.checkedAt,inFlight:live.inFlight,lastRequestAt:live.lastRequestAt,portfolioTableFound:!!findPortfolioTable()};}
  };
})();
