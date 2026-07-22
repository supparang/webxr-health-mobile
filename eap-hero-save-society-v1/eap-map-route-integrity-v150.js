/* =========================================================
   EAP Hero • Map Route Integrity v150
   - Enforces sequential session progression on the Learning Map.
   - The first unpassed Session remains playable; every later Session is locked.
   - Future/out-of-order evidence is preserved but quarantined from pass/unlock UI.
   - Uses EAPProgressTruthResolver / sessionProgress as the score source.
========================================================= */
(function(){
  'use strict';
  var VERSION='20260722-EAP-MAP-ROUTE-INTEGRITY-V150';
  var KEY='EAP_HERO_PROGRESS_V3';
  var STYLE_ID='eap-map-route-integrity-v150-style';
  var timer=0;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(_){return{};}}
  function inject(){
    if(document.getElementById(STYLE_ID))return;
    var s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      .session-tile.eap150-route-locked{opacity:.52!important;filter:grayscale(.55)!important;cursor:not-allowed!important;pointer-events:none!important}
      .session-tile.eap150-route-locked .eap150-lock{position:absolute;right:12px;top:10px;font-size:16px}
      .session-tile.eap150-route-locked .eap150-quarantine{margin-top:10px;padding:9px;border-radius:12px;background:rgba(15,23,42,.72);color:#d7e4ef;font-size:11px;line-height:1.35}
      .session-tile.eap150-current{outline:2px solid rgba(251,191,36,.7)!important;box-shadow:0 0 0 4px rgba(251,191,36,.11),0 12px 28px rgba(0,0,0,.15)!important}
      .session-tile .eap150-current-note{margin-top:10px;padding:9px;border-radius:12px;background:#fff7ed;color:#9a3412;font-size:11px;font-weight:900}
    `;document.head.appendChild(s);
  }
  function progress(){
    try{
      if(window.EAPProgressTruthResolver&&typeof window.EAPProgressTruthResolver.diagnostics==='function'){
        var d=window.EAPProgressTruthResolver.diagnostics();
        if(d&&d.sessionProgress)return d.sessionProgress;
      }
    }catch(_){ }
    return read().sessionProgress||{};
  }
  function firstUnpassed(p){
    for(var i=1;i<=15;i++){
      var row=p['S'+i]||p[String(i)]||{};
      if(!(row.passed===true||row.complete===true))return i;
    }
    return 16;
  }
  function sessionNumber(tile){
    var n=clean(tile.querySelector('.num')&&tile.querySelector('.num').textContent||tile.textContent);
    var m=n.match(/SESSION\s*(1[0-5]|[1-9])|\bS(1[0-5]|[1-9])\b/i);
    return m?Number(m[1]||m[2]):0;
  }
  function removePassedUi(tile){
    [...tile.querySelectorAll('*')].forEach(function(n){
      var t=clean(n.textContent);
      if(!t)return;
      if(/Session Passed|✅\s*Session Passed|avg\s*\d+/i.test(t)){
        var box=n;
        while(box.parentElement&&box.parentElement!==tile&&clean(box.parentElement.textContent).length<420)box=box.parentElement;
        if(box!==tile)box.style.setProperty('display','none','important');
      }
    });
    tile.classList.remove('cleared','unlocked');
  }
  function lockTile(tile,index,rawPassed){
    tile.classList.add('locked','eap150-route-locked');
    tile.classList.remove('cleared','unlocked','eap150-current');
    tile.setAttribute('aria-disabled','true');tile.setAttribute('tabindex','-1');
    removePassedUi(tile);
    if(!tile.querySelector('.eap150-lock')){
      var lock=document.createElement('span');lock.className='eap150-lock';lock.textContent='🔒';tile.appendChild(lock);
    }
    var note=tile.querySelector('.eap150-quarantine');
    if(!note){note=document.createElement('div');note.className='eap150-quarantine';tile.appendChild(note);}
    note.textContent=rawPassed?'มีหลักฐานเก่าของ S'+index+' แต่ยังไม่นับ จนกว่าจะผ่านด่านก่อนหน้า':'ต้องผ่าน Session ก่อนหน้าตามลำดับ';
  }
  function currentTile(tile,index){
    tile.classList.remove('locked','eap150-route-locked');tile.classList.add('unlocked','eap150-current');
    tile.removeAttribute('aria-disabled');tile.removeAttribute('tabindex');
    var lock=tile.querySelector('.eap150-lock');if(lock)lock.remove();
    var q=tile.querySelector('.eap150-quarantine');if(q)q.remove();
    if(!tile.querySelector('.eap150-current-note')){
      var n=document.createElement('div');n.className='eap150-current-note';n.textContent='ด่านปัจจุบัน — ผ่าน Skill บังคับให้ครบเพื่อเปิด Session ถัดไป';tile.appendChild(n);
    }
  }
  function passedTile(tile){
    tile.classList.remove('locked','eap150-route-locked','eap150-current');tile.classList.add('unlocked','cleared');
    tile.removeAttribute('aria-disabled');tile.removeAttribute('tabindex');
    ['.eap150-lock','.eap150-quarantine','.eap150-current-note'].forEach(function(sel){var n=tile.querySelector(sel);if(n)n.remove();});
  }
  function apply(){
    inject();var p=progress(),current=firstUnpassed(p);
    var tiles=[...document.querySelectorAll('#app .session-tile')];
    if(!tiles.length)return;
    tiles.forEach(function(tile){
      var i=sessionNumber(tile);if(!i)return;
      var row=p['S'+i]||p[String(i)]||{};
      var rawPassed=row.passed===true||row.complete===true;
      if(i<current&&rawPassed)passedTile(tile);
      else if(i===current)currentTile(tile,i);
      else lockTile(tile,i,rawPassed);
      tile.dataset.eap150Session='S'+i;
      tile.dataset.eap150EffectiveStatus=i<current&&rawPassed?'passed':i===current?'current':'locked';
    });
    var state=read();
    state.routeIntegrity=state.routeIntegrity||{};
    state.routeIntegrity.version=VERSION;
    state.routeIntegrity.currentSession=current<=15?'S'+current:'COMPLETE';
    state.routeIntegrity.quarantined=[];
    for(var i=current+1;i<=15;i++){
      var r=p['S'+i]||p[String(i)]||{};
      if(r.passed===true||r.complete===true)state.routeIntegrity.quarantined.push('S'+i);
    }
    try{localStorage.setItem(KEY,JSON.stringify(state));}catch(_){ }
    document.documentElement.dataset.eapMapRouteIntegrityVersion=VERSION;
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(apply,100);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  ['load','storage','eap:progress-truth-updated','eap:resume-synced','eap:boss-single-run-complete'].forEach(function(e){window.addEventListener(e,schedule);});
  setTimeout(apply,100);setTimeout(apply,800);setTimeout(apply,1800);
})();