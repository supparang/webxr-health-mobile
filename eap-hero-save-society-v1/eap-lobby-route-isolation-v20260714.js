/* =========================================================
   EAP Hero Canonical Lobby Route Isolation v20260714
   - A visible Student Lobby is a navigation screen, even when its verified
     current route label is a Boss Gate such as B1.
   - Removes/hides stale Mission Mode, Phase A, roadmap and Sheet debug UI
     that belonged to a previous route or previous learner.
   - Keeps Google Sheet/Cloud as the route authority. This file changes only
     page lifecycle/UI isolation and never changes scores, evidence or unlocks.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_LOBBY_ROUTE_ISOLATION_V1__) return;
  window.__EAP_LOBBY_ROUTE_ISOLATION_V1__=true;

  var VERSION='v20260714-EAP-LOBBY-ROUTE-ISOLATION-V1';
  var LOBBY_ID='eap-student-compact-lobby';
  var BODY_CLASS='eap-canonical-lobby-isolated';
  var HIDDEN='data-eap-lobby-isolation-hidden';
  var STYLE_ID='eap-lobby-route-isolation-style';
  var timer=null;

  function text(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(key,fallback){try{var raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(_){return fallback;}}

  function lobby(){
    var el=document.getElementById(LOBBY_ID);
    if(!el) return null;
    var t=text(el.innerText||el.textContent);
    return /Student Lobby/i.test(t)&&/Start\s*\/\s*Continue/i.test(t)?el:null;
  }

  function addStyle(){
    if(document.getElementById(STYLE_ID)) return;
    var s=document.createElement('style');s.id=STYLE_ID;
    s.textContent='['+HIDDEN+'="1"]{display:none!important}' +
      'body.'+BODY_CLASS+' #'+LOBBY_ID+'{display:block!important;width:min(920px,calc(100vw - 28px))!important;max-width:920px!important;margin:18px auto!important}' +
      'body.'+BODY_CLASS+' .mf-hud,body.'+BODY_CLASS+' #phaseA2MissionPanel,body.'+BODY_CLASS+' #eapLivingRuntimeHud,body.'+BODY_CLASS+' #eap-student-15week-roadmap,body.'+BODY_CLASS+' #eap-sheet-envelope-status,body.'+BODY_CLASS+' #eap-sheet-manual-send{display:none!important}';
    document.head.appendChild(s);
  }

  function mark(el){
    if(!el||el.id===LOBBY_ID||(el.closest&&el.closest('#'+LOBBY_ID))) return;
    el.setAttribute(HIDDEN,'1');
    el.setAttribute('aria-hidden','true');
  }

  function restore(){
    Array.prototype.slice.call(document.querySelectorAll('['+HIDDEN+'="1"]')).forEach(function(el){
      el.removeAttribute(HIDDEN);el.removeAttribute('aria-hidden');
    });
  }

  function isolatePath(lob){
    var app=document.getElementById('app');
    if(!app||!lob||!app.contains(lob)) return;
    var node=lob;
    while(node&&node!==app){
      var parent=node.parentElement;if(!parent) break;
      Array.prototype.slice.call(parent.children).forEach(function(sibling){
        if(sibling!==node&&!sibling.contains(lob)) mark(sibling);
      });
      node=parent;
    }
  }

  function hideOutsideControls(lob){
    Array.prototype.slice.call(document.querySelectorAll('button,a,[role="button"]')).forEach(function(el){
      if(el.closest&&el.closest('#'+LOBBY_ID)) return;
      var label=text(el.textContent).replace(/^[📘👤🧭▶⚡📤]+\s*/,'');
      if(/^(Map|Continue|Mission Mode|ส่งผลล่าสุดเข้า Sheet)$/i.test(label)) mark(el);
    });
    Array.prototype.slice.call(document.querySelectorAll('.mf-hud,#phaseA2MissionPanel,#eapLivingRuntimeHud,#eap-student-15week-roadmap,#eap-sheet-envelope-status,#eap-sheet-manual-send')).forEach(mark);
    isolatePath(lob);
  }

  function clearTransient(){
    window.EAPPhaseAActiveTask=null;
    try{if(window.EAPLivingMissionRuntime&&typeof window.EAPLivingMissionRuntime.clear==='function')window.EAPLivingMissionRuntime.clear();}catch(_){}
    try{if(window.EAPPhaseAMultiTaskRunner&&typeof window.EAPPhaseAMultiTaskRunner.clearTransient==='function')window.EAPPhaseAMultiTaskRunner.clearTransient('canonical-lobby');}catch(_){}
    var panel=document.getElementById('phaseA2MissionPanel');if(panel)panel.remove();
    var hud=document.getElementById('eapLivingRuntimeHud');if(hud)hud.remove();
    window.dispatchEvent(new CustomEvent('eap:phase-a-ui-cleared',{detail:{reason:'canonical-lobby',mode:'lobby',version:VERSION}}));
  }

  function currentProfile(){
    var direct=read('EAP_HERO_PLAYER_PROFILE_V1',{}),state=read('EAP_HERO_PROGRESS_V3',{});
    var p=Object.assign({},state.profile||{},state.player||{},state.user||{},direct||{});
    return {studentId:text(p.studentId||p.id||state.studentId||state.id||''),section:text(p.section||state.section||'122')||'122'};
  }

  function refreshLocalSheetLabel(){
    var el=document.getElementById('eap-sheet-envelope-status');if(!el)return;
    var p=currentProfile(),all=read('EAP_SHEET_ENVELOPE_V132_QUEUE',[]);
    var list=Array.isArray(all)?all.filter(function(row){
      if(p.studentId&&text(row&&row.studentId)!==p.studentId)return false;
      var sec=text(row&&row.section);return !sec||sec===p.section;
    }):[];
    var last=list[list.length-1],route=text(last&&(last.routeId||last.sessionId));
    el.innerHTML='📤 Local Sheet log: '+list.length+' attempts'+(route?' · '+route:'')+' <button type="button">ดู</button>';
  }

  function apply(){
    addStyle();
    var lob=lobby();
    document.body.classList.toggle(BODY_CLASS,!!lob);
    restore();
    refreshLocalSheetLabel();
    if(!lob) return;
    clearTransient();
    hideOutsideControls(lob);
    document.documentElement.dataset.eapPageMode='lobby';
    window.dispatchEvent(new CustomEvent('eap:canonical-lobby-isolated',{detail:{version:VERSION}}));
  }

  function schedule(delay){clearTimeout(timer);timer=setTimeout(apply,delay==null?70:delay);}
  window.addEventListener('load',function(){schedule(40);setTimeout(apply,500);});
  window.addEventListener('eap:resume-synced',function(){schedule(40);setTimeout(apply,350);});
  window.addEventListener('eap:profile-changed',function(){schedule(40);});
  window.addEventListener('eap:profile-saved',function(){schedule(40);});
  window.addEventListener('popstate',function(){schedule(50);});
  new MutationObserver(function(){schedule(60);}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});

  window.EAPLobbyRouteIsolation={version:VERSION,refresh:apply,isLobby:function(){return !!lobby();}};
  schedule(40);
})();
