/* HeroHealth Gate compatibility + Handwash Canonical R4 short route */
(function(){
  'use strict';
  var PATCH='20260717-HANDWASH-CANONICAL-R4-SHORT-URL';
  var q;
  try{q=new URLSearchParams(location.search||'')}catch(_){q=new URLSearchParams('')}
  var phase=String(q.get('phase')||q.get('gatePhase')||'warmup').toLowerCase();
  var game=String(q.get('game')||q.get('gameId')||q.get('theme')||'').toLowerCase();

  /* Preserve the legacy Brush forced-cooldown behavior without touching other games. */
  if(game==='brush'&&phase==='cooldown'){
    var force=['forceCooldownOnce','forceGate'].some(function(k){return /^(1|true|yes)$/i.test(q.get(k)||'')})||q.get('skipDaily')==='0'||q.get('source')==='brush-summary';
    if(force){
      try{
        var today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
        Object.keys(localStorage).forEach(function(k){if(/^HHA_GATE_(COOLDOWN|cooldown)_/.test(k)&&k.indexOf('_brush_')!==-1&&k.endsWith('_'+today))localStorage.removeItem(k)});
      }catch(_){ }
    }
  }

  if(game!=='handwash'||phase==='cooldown')return;

  function heroBase(){
    try{var marker='/herohealth/',i=location.pathname.indexOf(marker);return i>=0?location.origin+location.pathname.slice(0,i+marker.length):new URL('./',location.href).toString()}
    catch(_){return'https://supparang.github.io/webxr-health-mobile/herohealth/'}
  }
  function safeHub(){
    var fallback=new URL('hub-v2.html',heroBase()).toString();
    var raw=q.get('hub')||q.get('hubRoot')||'';
    if(!raw)return fallback;
    try{var u=new URL(raw,heroBase());if(/\/(hub|hub-v2)\.html$/i.test(u.pathname)){u.search='';u.hash='';return u.toString()}}catch(_){ }
    return fallback;
  }
  function safeZone(){
    var fallback=new URL('hygiene-zone.html',heroBase());
    var raw=q.get('zoneReturn')||q.get('return')||q.get('back')||'';
    try{
      if(raw){var u=new URL(raw,heroBase());if(/\/hygiene-zone(?:-v2)?\.html$/i.test(u.pathname)){u.pathname=u.pathname.replace(/hygiene-zone-v2\.html$/i,'hygiene-zone.html');u.searchParams.delete('hub');u.searchParams.set('hub',safeHub());u.searchParams.set('cv',PATCH);return u.toString()}}
    }catch(_){ }
    ['pid','name','classLevel','section','diff','view','studyId'].forEach(function(k){var v=q.get(k);if(v)fallback.searchParams.set(k,v)});
    fallback.searchParams.set('hub',safeHub());fallback.searchParams.set('cv',PATCH);
    return fallback.toString();
  }
  function targetUrl(){
    var target=new URL('hygiene-zone/handwash-realistic-v3.html',heroBase());
    ['pid','name','nick','studentId','playerId','classId','classLevel','section','diff','time','view','mode','studyId','conditionGroup','session_code','log','api','seed','sheet'].forEach(function(k){var v=q.get(k);if(v)target.searchParams.set(k,v)});
    target.searchParams.set('game','handwash');target.searchParams.set('gameId','handwash');target.searchParams.set('zone','hygiene');target.searchParams.set('zoneReturn',safeZone());target.searchParams.set('hub',safeHub());target.searchParams.set('entry','who-warmup-complete');target.searchParams.set('fromWarmup','1');target.searchParams.set('wgok','1');target.searchParams.set('who','1');target.searchParams.set('cv',PATCH);
    return target.toString();
  }

  var TARGET=targetUrl(),fired=false;
  q.set('next',TARGET);q.set('zoneReturn',safeZone());q.set('hub',safeHub());q.set('cv',PATCH);q.set('wgok','1');
  ['runUrl','runFile','return','back','hubRoot','gatePhase'].forEach(function(k){q.delete(k)});
  try{history.replaceState(null,'',location.pathname+'?'+q.toString()+(location.hash||''))}catch(_){ }

  window.HH_GATE_FORCE_NEXT=TARGET;
  window.HHA_GATE_RETURN_URL=TARGET;
  window.HHA_GATE_DONE_URL=TARGET;
  window.HHA_NEXT_URL=TARGET;
  window.HHA_HANDWASH_WHO_TARGET=TARGET;
  window.HHA_GATE_BOOT=window.HHA_GATE_BOOT||{};
  window.HHA_GATE_BOOT.nextHref=TARGET;
  window.HHA_GATE_BOOT.handwashWhoWarmupTarget=TARGET;
  window.HHA_GATE_BOOT.handwashWarmupPatch=PATCH;

  function mainButton(node){
    if(!node||!node.closest)return null;
    var b=node.closest('button,a,[role="button"]');if(!b)return null;
    var text=String(b.textContent||b.getAttribute('aria-label')||b.getAttribute('title')||'').replace(/\s+/g,' ').trim().toLowerCase();
    if(text.indexOf('กลับ')!==-1||text.indexOf('hub')!==-1)return null;
    var id=String(b.id||'').toLowerCase(),cls=String(b.className||'').toLowerCase();
    return text.indexOf('เข้าเกมหลัก')!==-1||text.indexOf('เริ่มเกมหลัก')!==-1||text.indexOf('ไปต่อ')!==-1||id.indexOf('continue')!==-1||id.indexOf('next')!==-1||cls.indexOf('primary')!==-1?b:null;
  }
  function go(event){
    if(event){try{event.preventDefault()}catch(_){ }try{event.stopPropagation()}catch(_){ }try{event.stopImmediatePropagation&&event.stopImmediatePropagation()}catch(_){ }}
    if(fired)return false;fired=true;
    try{sessionStorage.setItem('HHA_HANDWASH_WHO_WARMUP_ROUTE',JSON.stringify({patch:PATCH,target:TARGET,at:new Date().toISOString()}))}catch(_){ }
    location.replace(TARGET);return false;
  }
  ['click','pointerup','touchend'].forEach(function(type){document.addEventListener(type,function(e){if(mainButton(e.target))return go(e)},type==='touchend'?{capture:true,passive:false}:true)});
  window.HHA_GATE_GO_NEXT=go;window.goNext=go;window.HHA_HANDWASH_WHO_WARMUP_FIX={patch:PATCH,target:TARGET,go:go};
  try{console.info('[Handwash WHO Canonical R4]',{target:TARGET,urlLength:location.href.length})}catch(_){ }
})();
