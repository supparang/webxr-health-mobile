/* =========================================================
   EAP Hero • Boss v150 Final Authority v1
   VERSION: 20260813-EAP-BOSS-V150-FINAL-AUTHORITY-V1

   PURPOSE
   - EAP_Progress v150 is the sole prerequisite authority for B1-B5.
   - If the official/current route is Bx, legacy evidence-count guardians must
     not send the learner back to an already-completed Session.
   - Route Boss CTA actions directly to EAPBossFourSkillV4.start(gate).
   - Keep mission overlays escapable with Close / X / Escape.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_BOSS_V150_FINAL_AUTHORITY_V1__) return;
  window.__EAP_BOSS_V150_FINAL_AUTHORITY_V1__ = true;

  var VERSION='20260813-EAP-BOSS-V150-FINAL-AUTHORITY-V1';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var timer=0;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function norm(v){
    var t=clean(v).toUpperCase(),m;
    m=t.match(/^(?:B|BOSS|GATE|BOSS\s*GATE)\s*0?([1-5])$/i);if(m)return'B'+Number(m[1]);
    m=t.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/i);if(m)return'S'+Number(m[1]);
    return t;
  }
  function read(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch(_){return{};}}
  function officialRoute(){
    try{if(window.EAPAuthorityRuntime&&typeof window.EAPAuthorityRuntime.currentRoute==='function'){var x=norm(window.EAPAuthorityRuntime.currentRoute());if(x)return x;}}catch(_){}
    var s=read(),r=s.serverResume||{};
    return norm(r.currentRoute||r.currentCloudRoute||r.nextRoute||s.currentCloudRoute||s.currentRoute||'');
  }
  function bossNo(route){var m=norm(route).match(/^B([1-5])$/);return m?Number(m[1]):0;}
  function bossIsOfficial(){return bossNo(officialRoute())>0;}
  function startOfficialBoss(){
    var gate=bossNo(officialRoute());if(!gate)return false;
    try{localStorage.setItem('EAP_HERO_ACTIVE_ROUTE','B'+gate);localStorage.setItem('EAP_HERO_CURRENT_ROUTE','B'+gate);localStorage.setItem('EAP_HERO_ACTIVE_VIEW_ROUTE','B'+gate);}catch(_){}
    try{if(window.EAPBossFourSkillV4&&typeof window.EAPBossFourSkillV4.start==='function'){window.EAPBossFourSkillV4.start(gate);return true;}}catch(_){}
    try{if(window.EAPHero&&typeof window.EAPHero.startGateBoss==='function'){window.EAPHero.startGateBoss('B'+gate);return true;}}catch(_){}
    return false;
  }
  function text(el){return clean(el&&el.textContent);}
  function interactive(root){return Array.prototype.slice.call((root||document).querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"]'));}
  function looksLegacyBossGuard(){
    var body=clean(document.body&&document.body.innerText);
    return bossIsOfficial() && (/Complete Skill Evidence/i.test(body)||(/Boss Gate\s*[1-5]/i.test(body)&&/Locked/i.test(body)&&/Start Gate Boss/i.test(body)));
  }
  function patchLegacyBossGuard(){
    if(!looksLegacyBossGuard())return;
    interactive(document).forEach(function(el){
      var t=text(el);
      if(/Complete Skill Evidence|Start Gate Boss|Start Boss|Continue Boss/i.test(t)){
        el.removeAttribute('disabled');el.setAttribute('aria-disabled','false');
        el.style.removeProperty('pointer-events');el.style.removeProperty('opacity');el.style.removeProperty('filter');
        el.dataset.eapBossV150Start='1';
        if(/Complete Skill Evidence/i.test(t)) el.textContent='Start Gate Boss';
      }
    });
    document.querySelectorAll('[class*="locked"],[data-locked="true"],[aria-disabled="true"]').forEach(function(el){
      if(/Boss Gate|Start Gate Boss|Complete Skill Evidence/i.test(clean(el.textContent))){
        el.classList.remove('locked');el.removeAttribute('data-locked');
      }
    });
    document.documentElement.dataset.eapBossV150FinalAuthority=VERSION;
  }
  function closeMissionOverlay(btn){
    var candidates=[];
    var cur=btn;
    for(var i=0;i<7&&cur;i++,cur=cur.parentElement){
      var tx=clean(cur.textContent);
      var style='';try{style=getComputedStyle(cur).position||'';}catch(_){}
      if(/Mission|Summary Builder|Phase A|First Mission|Rescue Mission/i.test(tx)&&(style==='fixed'||style==='absolute'||cur.getAttribute('role')==='dialog'||/modal|overlay|dialog/i.test(cur.className||''))) candidates.push(cur);
    }
    var target=candidates[0];
    if(!target){
      target=Array.prototype.slice.call(document.querySelectorAll('[role="dialog"],.modal,.overlay,[class*="modal"],[class*="overlay"]')).find(function(x){return /Mission|Summary Builder|Phase A|First Mission|Rescue Mission/i.test(clean(x.textContent));});
    }
    if(target){target.remove();return true;}
    try{if(window.EAPHero&&typeof window.EAPHero.map==='function'){window.EAPHero.map();return true;}}catch(_){}
    return false;
  }
  function onClick(e){
    var el=e.target&&e.target.closest&&e.target.closest('button,a,[role="button"],input[type="button"],input[type="submit"]');if(!el)return;
    var t=text(el);
    if((el.dataset&&el.dataset.eapBossV150Start==='1')||(bossIsOfficial()&&/Complete Skill Evidence|Start Gate Boss|Start Boss|Continue Boss/i.test(t))){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      startOfficialBoss();return false;
    }
    if(/^(?:×|✕|✖|X|Close|ปิด)$/i.test(t)||/close/i.test(clean(el.getAttribute('aria-label')))){
      if(closeMissionOverlay(el)){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();return false;}
    }
  }
  function onKey(e){if(e.key==='Escape'){var fake=document.createElement('button');if(closeMissionOverlay(fake)){e.preventDefault();e.stopPropagation();}}}
  function reconcile(){patchLegacyBossGuard();}
  function schedule(){clearTimeout(timer);timer=setTimeout(reconcile,80);}

  document.addEventListener('click',onClick,true);
  document.addEventListener('keydown',onKey,true);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['disabled','aria-disabled','class']});
  ['load','storage','eap:resume-synced','eap:single-authority-applied','eap:cloud-route-ready'].forEach(function(n){window.addEventListener(n,schedule);});
  setTimeout(reconcile,100);setTimeout(reconcile,700);setInterval(reconcile,1800);

  window.EAPBossV150FinalAuthorityV1={version:VERSION,route:officialRoute,start:startOfficialBoss,reconcile:reconcile};
})();
