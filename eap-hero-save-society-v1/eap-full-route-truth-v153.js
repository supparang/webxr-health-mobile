/* =========================================================
   EAP Hero • Full Route Truth v154 Strict Checkpoint
   - Resolves S1-S15 together with B1-B5 checkpoints.
   - IMPORTANT: unlockedRoutes/unlockedSessions mean "may enter", not "passed".
   - A Boss Gate counts as passed only from explicit completion evidence.
   - Prevents Resume/Skill Hub from entering S10/S11 while B3 is incomplete.
========================================================= */
(function(){
  'use strict';

  var VERSION='20260722-EAP-FULL-ROUTE-TRUTH-V154-STRICT-CHECKPOINT';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var SENT_KEY='EAP_HERO_BOSS_COMPLETION_SENT_V5';
  var NOTICE_ID='eap-full-route-notice-v154';
  var timer=0;
  var GROUPS=[
    {sessions:[1,2,3],gate:'B1',next:'S4'},
    {sessions:[4,5,6],gate:'B2',next:'S7'},
    {sessions:[7,8,9],gate:'B3',next:'S10'},
    {sessions:[10,11,12],gate:'B4',next:'S13'},
    {sessions:[13,14,15],gate:'B5',next:''}
  ];

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(key,fallback){try{var raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(_){return fallback;}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(_){return false;}}
  function gateNo(v){var m=clean(v).toUpperCase().match(/(?:B|GATE|BOSS\s*GATE)\s*([1-5])/);return m?Number(m[1]):0;}
  function sessionNo(v){var m=clean(v).toUpperCase().match(/(?:SESSION\s*|\bS)(1[0-5]|[1-9])\b/);return m?Number(m[1]):0;}

  function diagnostics(){
    var api=window.EAPProgressTruthResolver,d=null;
    try{d=api&&typeof api.diagnostics==='function'?api.diagnostics():null;}catch(_){d=null;}
    return d||{sessionProgress:{},records:[]};
  }

  function sessionPassed(n,d){
    var p=d&&d.sessionProgress||{},row=p['S'+n]||p[String(n)]||{};
    return row.passed===true||row.complete===true;
  }

  function sentBossCompletion(gate){
    var sent=read(SENT_KEY,{}),needle='-'+gate.toLowerCase()+'-';
    return Object.keys(sent||{}).some(function(k){
      var item=sent[k]||{},key=String(k).toLowerCase();
      return key.indexOf(needle)>=0 && (/boss-clash-|boss-gate-complete-/i.test(k)) && item.score>=60;
    });
  }

  function bossPassed(gate,state){
    state=state||read(STATE_KEY,{});
    var n=gateNo(gate),sp=state.sessionProgress||{};
    var row=sp[gate]||sp['GATE'+n]||{};

    /* Explicit completion only. Never use unlockedRoutes/unlockedSessions here. */
    if(row.passed===true||row.complete===true||row.bossWin===true||row.bossGateComplete===true)return true;

    var completed=[state.completedBosses,state.completedRoutes,state.bossProgress];
    for(var i=0;i<completed.length;i++){
      var c=completed[i];
      if(!c||typeof c!=='object')continue;
      var v=c[gate]||c['GATE'+n];
      if(v===true||(v&&typeof v==='object'&&(v.passed===true||v.complete===true||v.bossWin===true||v.bossGateComplete===true)))return true;
    }

    var adv=state.bossCompletionLocalAdvance||{};
    if(clean(adv.gate).toUpperCase()===gate && clean(adv.nextRoute))return true;

    if(sentBossCompletion(gate))return true;
    return false;
  }

  function resolve(){
    var d=diagnostics(),state=read(STATE_KEY,{});
    for(var g=0;g<GROUPS.length;g++){
      var group=GROUPS[g];
      for(var i=0;i<group.sessions.length;i++){
        var s=group.sessions[i];
        if(!sessionPassed(s,d))return {routeId:'S'+s,routeType:'session',session:s,gate:'',reason:'first-incomplete-session',diagnostics:d};
      }
      if(!bossPassed(group.gate,state))return {routeId:group.gate,routeType:'boss_gate',session:0,gate:group.gate,reason:'checkpoint-required',diagnostics:d};
    }
    return {routeId:'B5',routeType:'boss_gate',session:0,gate:'B5',reason:'course-complete',diagnostics:d};
  }

  function maxSession(route){
    if(route.routeType==='session')return route.session;
    var g=gateNo(route.gate||route.routeId);
    return g===1?3:g===2?6:g===3?9:g===4?12:15;
  }

  function persist(route){
    var state=read(STATE_KEY,{}),rid=route.routeId;
    state.currentRoute=rid;state.currentCloudRoute=rid;state.activeRoute=rid;
    state.currentSession=route.session||maxSession(route);
    state.fullRouteTruthVersion=VERSION;
    write(STATE_KEY,state);
    try{
      localStorage.setItem('EAP_HERO_ACTIVE_ROUTE',rid);
      localStorage.setItem('EAP_HERO_CURRENT_ROUTE',rid);
      localStorage.setItem('EAP_HERO_CURRENT_SESSION',String(state.currentSession));
    }catch(_){ }
  }

  function open(route){
    route=route||resolve();persist(route);
    if(route.routeType==='boss_gate'){
      var g=gateNo(route.gate||route.routeId);
      if(window.EAPBossFourSkillV4&&typeof window.EAPBossFourSkillV4.start==='function'){window.EAPBossFourSkillV4.start(g);return true;}
      if(window.EAPHero&&typeof window.EAPHero.startGateBoss==='function'){window.EAPHero.startGateBoss('B'+g);return true;}
    }else{
      if(window.EAPHero&&typeof window.EAPHero.skillHub==='function'){window.EAPHero.skillHub(route.session);return true;}
      if(window.EAPSkillHubRouteLock&&typeof window.EAPSkillHubRouteLock.runCurrentRoute==='function'){window.EAPSkillHubRouteLock.runCurrentRoute();return true;}
    }
    setTimeout(function(){open(route);},200);return false;
  }

  function showNotice(msg){
    var old=document.getElementById(NOTICE_ID);if(old)old.remove();
    var n=document.createElement('div');n.id=NOTICE_ID;n.textContent=msg;
    n.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:999999;max-width:min(620px,calc(100vw - 28px));padding:13px 18px;border-radius:16px;background:#7f1d1d;color:#fff;font-weight:900;box-shadow:0 16px 36px rgba(0,0,0,.35);text-align:center';
    document.body.appendChild(n);setTimeout(function(){if(n.isConnected)n.remove();},3000);
  }

  function updateLobby(route){
    var panel=document.getElementById('eap-student-compact-lobby');if(!panel)return;
    var title=panel.querySelector('.lob-title'),meta=panel.querySelector('.lob-meta');
    if(route.routeType==='boss_gate'){
      var g=gateNo(route.gate);if(title)title.textContent='B'+g+' Boss Gate';
      if(meta)meta.textContent='Checkpoint ก่อนเข้าสู่ Session ถัดไป';
    }else{
      if(title)title.textContent='Week '+route.session+' / S'+route.session;
    }
  }

  function sessionButtons(){
    return [...document.querySelectorAll('#app button,#app a[href],#app [role="button"]')].filter(function(n){return sessionNo(n.textContent)>0;});
  }

  function applyLocks(route){
    var max=maxSession(route),current=route.routeType==='session'?route.session:0;
    sessionButtons().forEach(function(b){
      var n=sessionNo(b.textContent),locked=n>max;
      b.dataset.eapFullRouteLocked=locked?'true':'false';
      b.setAttribute('aria-disabled',locked?'true':'false');
      if(locked){b.style.setProperty('opacity','.46','important');b.style.setProperty('filter','grayscale(.55)','important');b.style.setProperty('cursor','not-allowed','important');b.title='ต้องผ่าน '+route.routeId+' ก่อน';}
      else{b.style.removeProperty('opacity');b.style.removeProperty('filter');b.style.removeProperty('cursor');if(b.title&&/ต้องผ่าน/.test(b.title))b.removeAttribute('title');}
      if(n===current)b.dataset.eapFullRouteCurrent='true';else delete b.dataset.eapFullRouteCurrent;
    });
  }

  function currentVisibleSession(){
    var app=clean((document.getElementById('app')||{}).innerText||'');
    var m=app.match(/Session\s*(1[0-5]|[1-9])\s*:/i);
    return m?Number(m[1]):0;
  }

  function guard(e){
    var b=e.target&&e.target.closest&&e.target.closest('button,a,[role="button"]');if(!b)return;
    var text=clean(b.textContent),action=clean(b.getAttribute('data-eap-lobby-action'));
    if(action==='continue'||/^(?:▶\s*)?(?:Start\s*\/\s*Continue|Continue Session|Continue)$/i.test(text)){
      e.preventDefault();e.stopImmediatePropagation();e.stopPropagation();open(resolve());return false;
    }
    var n=sessionNo(text);if(!n)return;
    var route=resolve(),max=maxSession(route);
    if(n>max){
      e.preventDefault();e.stopImmediatePropagation();e.stopPropagation();
      showNotice('S'+n+' ยังเข้าไม่ได้ กรุณาผ่าน '+route.routeId+' ก่อน');
      setTimeout(function(){open(route);},180);
      return false;
    }
  }

  function reconcile(){
    var route=resolve();persist(route);updateLobby(route);applyLocks(route);

    /* If an old renderer already opened a future Session, immediately correct it. */
    var shown=currentVisibleSession(),max=maxSession(route);
    if(shown>max && !document.documentElement.dataset.eapRouteCorrecting){
      document.documentElement.dataset.eapRouteCorrecting='true';
      setTimeout(function(){open(route);setTimeout(function(){delete document.documentElement.dataset.eapRouteCorrecting;},500);},80);
    }

    window.EAPFullRouteTruth={
      version:VERSION,
      resolve:resolve,
      open:function(){return open(resolve());},
      bossPassed:function(g){return bossPassed(String(g).toUpperCase(),read(STATE_KEY,{}));},
      diagnostics:function(){return{route:resolve(),state:read(STATE_KEY,{})};}
    };
    document.documentElement.dataset.eapFullRouteTruthVersion=VERSION;
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(reconcile,100);}
  document.addEventListener('click',guard,true);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  ['load','storage','eap:progress-truth-updated','eap:resume-synced','eap:local-result-saved'].forEach(function(n){window.addEventListener(n,schedule);});
  setTimeout(reconcile,80);setTimeout(reconcile,700);setTimeout(reconcile,1800);
})();