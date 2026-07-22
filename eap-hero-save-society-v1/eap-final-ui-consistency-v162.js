/* =========================================================
   EAP Hero • Final UI Consistency v162
   - One Campus Map: keep the Session card grid, hide duplicate Learning Route.
   - Official route / unlocked state comes only from EAPRoadmapLockGuard.
   - Current Boss route must never render as Locked.
   - Loading banners are replaced after server resume is verified.
   - Legacy/local progress boxes do not override cloud status on the map.
========================================================= */
(function(){
  'use strict';
  var VERSION='20260722-EAP-FINAL-UI-CONSISTENCY-V162';
  var timer=0;
  var ORDER=['S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3','S10','S11','S12','B4','S13','S14','S15','B5'];

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function norm(v){
    var s=clean(v).toUpperCase(),m;
    m=s.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/);if(m)return'S'+Number(m[1]);
    m=s.match(/^(?:B|BOSS|GATE|BOSS\s*GATE)\s*0?([1-5])$/);if(m)return'B'+Number(m[1]);
    return s;
  }
  function guard(){return window.EAPRoadmapLockGuard||window.EAP15ReleaseRuntime||null;}
  function verified(){var g=guard();try{return !!(g&&g.currentRouteId&&norm(g.currentRouteId()));}catch(_){return false;}}
  function current(){var g=guard();try{return norm(g&&g.currentRouteId&&g.currentRouteId());}catch(_){return'';}}
  function open(id){var g=guard();try{return !!(g&&g.canOpen&&g.canOpen(norm(id)));}catch(_){return false;}}
  function text(n){return clean(n&&n.textContent);}
  function hide(n,reason){if(!n)return;n.dataset.eapV162Hidden=reason||'1';n.style.setProperty('display','none','important');n.setAttribute('aria-hidden','true');}
  function show(n){if(!n)return;n.style.removeProperty('display');n.removeAttribute('aria-hidden');}

  function style(){
    if(document.getElementById('eap-final-ui-consistency-v162-style'))return;
    var s=document.createElement('style');s.id='eap-final-ui-consistency-v162-style';
    s.textContent='\
      .eap-cloud-route-badge-v162{margin:8px 0;padding:8px 11px;border-radius:10px;background:#e8fff7;color:#075b46;font:800 12px/1.35 system-ui;border:1px solid #80e6c4}\
      .eap-current-boss-v162{border-color:#67e8c8!important;box-shadow:0 0 0 2px rgba(103,232,200,.18)!important}\
      .eap-current-boss-v162 button{opacity:1!important;pointer-events:auto!important;filter:none!important}\
      [data-eap-v162-hidden]{display:none!important}\
    ';
    document.head.appendChild(s);
  }

  function findRouteSection(){
    var hs=[].slice.call(document.querySelectorAll('#app h1,#app h2,#app h3,#app h4,strong'));
    var h=hs.find(function(x){return /^Learning Route$/i.test(text(x));});
    if(!h)return null;
    var n=h;
    while(n&&n.id!=='app'){
      var t=text(n);
      if(/15 Sessions/i.test(t)&&/Boss Gate 1/i.test(t)&&/Final Boss/i.test(t))return n;
      n=n.parentElement;
    }
    return h.parentElement;
  }

  function oneMap(){
    var routeSection=findRouteSection();
    if(routeSection)hide(routeSection,'duplicate_learning_route');
    var old=document.getElementById('eap-student-15week-roadmap');if(old)hide(old,'duplicate_roadmap');
  }

  function replaceLoadingBanners(){
    if(!verified())return;
    var rid=current();
    document.querySelectorAll('#app *').forEach(function(n){
      if(n.children.length>0)return;
      var t=text(n);
      if(/กำลังตรวจสอบความก้าวหน้าจาก Google Sheet|กำลังตรวจความคืบหน้าจาก Google Sheet/i.test(t)){
        n.textContent='ยืนยันความก้าวหน้าจาก Google Sheet แล้ว · ด่านปัจจุบัน: '+rid;
        n.style.background='#14532d';n.style.color='#dcfce7';
      }
    });
  }

  function routeFromCard(card){
    var d=card.dataset||{};
    var rid=norm(d.eapRoadmapRoute||d.routeId||d.sessionId||'');
    if(rid)return rid;
    var m=text(card).match(/(?:SESSION\s*(1[0-5]|[1-9])|BOSS\s*GATE\s*([1-5]))/i);
    if(!m)return'';
    return m[1]?'S'+Number(m[1]):'B'+Number(m[2]);
  }

  function authoritativeMapCards(){
    if(!verified())return;
    var rid=current();
    document.querySelectorAll('#app [data-eap-roadmap-route],#app [data-route-id],#app [class*="session-card"],#app article,#app .card').forEach(function(card){
      var id=routeFromCard(card);if(ORDER.indexOf(id)<0)return;
      var isOpen=open(id),isCurrent=id===rid;
      card.classList.toggle('eap-current-boss-v162',isCurrent&&/^B/.test(id));
      card.setAttribute('aria-disabled',isOpen?'false':'true');
      if(isOpen){card.classList.remove('eap-locked');card.removeAttribute('disabled');}
      var legacy=[].slice.call(card.querySelectorAll('*')).find(function(n){return n.children.length===0&&/Session not passed yet|Session Passed|legacy score unavailable/i.test(text(n));});
      if(legacy){
        var box=legacy.closest('.status,.result,.summary,.badge,.pill,div');
        if(box&&box!==card)hide(box,'legacy_local_status');
      }
      var badge=card.querySelector(':scope > .eap-cloud-route-badge-v162');
      if(!badge){badge=document.createElement('div');badge.className='eap-cloud-route-badge-v162';card.appendChild(badge);}
      badge.textContent=isCurrent?'▶ ด่านปัจจุบันจาก Google Sheet':(isOpen?'✓ เปิดแล้วจาก Google Sheet':'🔒 ยังไม่เปิด');
    });
  }

  function currentBoss(){
    if(!verified())return;
    var rid=current();if(!/^B[1-5]$/.test(rid))return;
    var app=document.getElementById('app');if(!app)return;
    var t=text(app);
    var bossNo=rid.slice(1);
    if(!(new RegExp('Boss Gate\\s*'+bossNo,'i').test(t)||new RegExp('Boss\\s*'+bossNo,'i').test(t)))return;
    app.classList.add('eap-current-boss-v162');
    app.querySelectorAll('button,[role="button"]').forEach(function(b){
      var bt=text(b);
      if(/Start Gate Boss|Enter Boss Clash|Start Boss|Continue/i.test(bt)){
        b.disabled=false;b.removeAttribute('disabled');b.setAttribute('aria-disabled','false');b.style.pointerEvents='auto';b.style.opacity='1';
      }
    });
    app.querySelectorAll('*').forEach(function(n){
      if(n.children.length===0&&/^Locked$/i.test(text(n))){n.textContent='Current Boss';n.style.background='#0f766e';n.style.color='#fff';}
    });
  }

  function reconcile(){
    style();oneMap();replaceLoadingBanners();authoritativeMapCards();currentBoss();
    document.documentElement.dataset.eapFinalUiConsistency=VERSION;
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(reconcile,80);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','disabled','aria-disabled']});
  ['load','storage','eap:resume-synced','eap:live-sheet-authority-applied'].forEach(function(e){window.addEventListener(e,schedule);});
  document.addEventListener('click',function(){setTimeout(reconcile,100);},true);
  setInterval(reconcile,700);
  setTimeout(reconcile,100);setTimeout(reconcile,900);setTimeout(reconcile,2200);
  window.EAPFinalUIConsistency={version:VERSION,reconcile:reconcile};
})();
