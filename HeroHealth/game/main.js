// === Hero Health Academy — game/main.js (2025-10-31 FAILSAFE MODES) ===
// แก้เคส "Failed to load mode: goodjunk" ด้วยโหมด fallback ในตัว + ตัวโหลดแบบ SAFETY
// ทำงานร่วม index ปัจจุบัน (#gameLayer, #spawnHost, #hudWrap, #resultText)

import * as THREEpkg from 'https://unpkg.com/three@0.159.0/build/three.module.js';

// ---------- Safe pick/make ----------
function pick(mod, name){ return (mod && (mod[name]!=null?mod[name]:(mod.default!=null?mod.default:mod))) || null; }
function make(mod, name, a,b,c,d){
  var impl = pick(mod, name); if(!impl) return {};
  if (typeof impl === 'function'){
    try { return new impl(a,b,c,d); } catch(e){}
    try { return impl(a,b,c,d); } catch(e){}
  }
  return impl||{};
}

// ---------- Core (ปลอดภัยต่อ object/class) ----------
import * as EngineMod   from './core/engine.js';
import * as HUDMod      from './core/hud.js';
import * as CoachMod    from './core/coach.js';
import * as SFXMod      from './core/sfx.js';
import * as ScoreMod    from './core/score.js';
import * as PowerUpMod  from './core/powerup.js';
import * as MissionMod  from './core/mission-system.js';
import * as ProgressMod from './core/progression.js';
import * as VRInputMod  from './core/vrinput.js';

var hud     = make(HUDMod,      'HUD');
var coach   = make(CoachMod,    'Coach');
var sfx     = make(SFXMod,      'SFX');
var score   = make(ScoreMod,    'ScoreSystem');
var power   = make(PowerUpMod,  'PowerUpSystem');
var mission = make(MissionMod,  'MissionSystem');
var Progress= pick(ProgressMod, 'Progress') || {};
var VRInput = pick(VRInputMod,  'VRInput') || {};

var EngineK = pick(EngineMod, 'Engine');
var engine  = EngineK ? new EngineK({
  hud: hud, coach: coach, sfx: sfx, score: score, power: power, mission: mission, THREE: THREEpkg,
  fx: { popText: function(text, o){
    o=o||{}; var n=document.createElement('div'); n.className='poptext';
    n.textContent=text; n.style.left=String(o.x||0)+'px'; n.style.top=String(o.y||0)+'px';
    document.body.appendChild(n); setTimeout(function(){ try{n.remove();}catch(e){} }, (o.ms|0)||650);
  }}
}) : { start:function(){}, stop:function(){}, pause:function(){}, resume:function(){}, init:function(){} };

try{ if (power && power.attachToScore) power.attachToScore(score); }catch(e){}

// ---------- Fallback GoodJunk (ในตัว) ----------
var BuiltinGoodJunk = (function(){
  var host=null, layer=null, running=false, items=[], spawnCd=0.2;
  var GOOD=['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑','🫘'];
  var JUNK=['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍭','🧁','🥓','🥠','🍨','🍦','🧂','🧈','🍹','🍯'];
  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
  function rnd(arr){ return arr[(Math.random()*arr.length)|0]; }
  function toast(msg){
    var el=document.getElementById('toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent=msg; if(el.classList&&el.classList.add) el.classList.add('show');
    setTimeout(function(){ try{el.classList.remove('show');}catch(e){} }, 900);
  }
  function pickMeta(){
    var isGood=Math.random()<0.65; var char=rnd(isGood?GOOD:JUNK);
    var life=clamp(1600+((Math.random()*900)|0),700,4500);
    var golden=Math.random()<0.08; return {char:char, aria:(isGood?'Good':'Junk'), isGood:isGood, golden:golden, life:life};
  }
  function spawnOne(rect){
    var m=pickMeta(), pad=30, w=640, h=360;
    if (rect && typeof rect.width==='number') w=rect.width; else if (host && host.clientWidth) w=host.clientWidth;
    if (rect && typeof rect.height==='number') h=rect.height; else if (host && host.clientHeight) h=host.clientHeight;
    var x=Math.round(pad+Math.random()*(Math.max(1,w)-pad*2));
    var y=Math.round(pad+Math.random()*(Math.max(1,h)-pad*2));
    var b=document.createElement('button'); b.className='spawn-emoji'; b.type='button';
    b.style.left=String(x)+'px'; b.style.top=String(y)+'px'; b.textContent=m.char; b.setAttribute('aria-label',m.aria);
    if (m.golden) b.style.filter='drop-shadow(0 0 10px rgba(255,215,0,.85))';
    (host||document.getElementById('spawnHost')||document.body).appendChild(b);
    var born=(typeof performance!=='undefined'&&performance&&performance.now)?performance.now():Date.now();
    items.push({ el:b, born:born, life:m.life, meta:m });
    b.addEventListener('click', function(ev){
      if (!running) return; ev.stopPropagation();
      var ui={x:ev.clientX||0,y:ev.clientY||0};
      if (m.isGood){
        try{ if (sfx&&sfx.play) sfx.play(m.golden?'sfx-perfect':'sfx-good'); }catch(e){}
        try{ if (engine && engine.fx && engine.fx.popText) engine.fx.popText('+'+(m.golden?20:10)+(m.golden?' ✨':''), {x:ui.x,y:ui.y,ms:720}); }catch(e){}
      } else {
        try{ if (sfx&&sfx.play) sfx.play('sfx-bad'); }catch(e){}
        try{ document.body.classList.add('flash-danger'); setTimeout(function(){document.body.classList.remove('flash-danger');},160);}catch(e){}
      }
      try{ b.remove(); }catch(e){}
      for (var i=0;i<items.length;i++){ if(items[i].el===b){ items.splice(i,1); break; } }
    }, false);
  }
  return {
    create: function(){
      return {
        start: function(){
          running=false; // reset then start
          // resolve
          host=document.getElementById('spawnHost');
          layer=document.getElementById('gameLayer')||document.querySelector('.game-wrap');
          items.length=0; spawnCd=0.2; running=true;
          toast('🍃 ดี vs ขยะ (fallback)');
        },
        stop: function(){
          running=false;
          try{ for (var i=0;i<items.length;i++){ var it=items[i]; if(it&&it.el&&it.el.remove) it.el.remove(); } }catch(e){}
          items.length=0;
        },
        update: function(dt){
          if(!running) return;
          var layerEl=layer||document.getElementById('gameLayer')||document.querySelector('.game-wrap');
          var rect={width:640,height:360}; try{ if(layerEl&&layerEl.getBoundingClientRect) rect=layerEl.getBoundingClientRect(); }catch(e){}
          // spawn
          spawnCd-=dt; if (spawnCd<=0){ spawnOne(rect); spawnCd = 0.40 - 0.0 + Math.random()*0.22; if(spawnCd<0.24)spawnCd=0.24; if(spawnCd>0.95)spawnCd=0.95; }
          // expiry
          var now=(typeof performance!=='undefined'&&performance&&performance.now)?performance.now():Date.now();
          var keep=[]; for (var i=0;i<items.length;i++){ var it=items[i]; if(now-it.born>it.life){ try{it.el.remove();}catch(e){} } else keep.push(it); } items=keep;
        },
        cleanup: function(){ this.stop(); }
      };
    }
  };
})();

// ---------- Mode registry (placeholder, จะถูกแทนด้วยของจริงเมื่อโหลดสำเร็จ) ----------
var MODES = {
  goodjunk: BuiltinGoodJunk, // ใช้ fallback ก่อน
  groups:   BuiltinGoodJunk, // ชั่วคราวให้เล่นได้
  hydration:BuiltinGoodJunk,
  plate:    BuiltinGoodJunk
};
var current = null;

// ---------- DOM helpers ----------
function $ (s){ return document.querySelector(s); }
function $id(id){ return document.getElementById(id); }
function setPlayfieldActive(on){
  var layer=$id('gameLayer')||$('.game-wrap'); var menu=$id('menuBar');
  if(layer&&layer.style) layer.style.pointerEvents=on?'auto':'none';
  if(menu &&menu.style)  menu.style.pointerEvents =on?'none':'auto';
  var hudWrap=$id('hudWrap'); if(hudWrap&&hudWrap.style) hudWrap.style.pointerEvents='none';
}
function selectedMode(){
  var ids=['m_goodjunk','m_groups','m_hydration','m_plate'];
  var map={m_goodjunk:'goodjunk',m_groups:'groups',m_hydration:'hydration',m_plate:'plate'};
  for (var i=0;i<ids.length;i++){ var el=$id(ids[i]); if(el&&el.classList&&el.classList.contains('active')) return map[ids[i]]; }
  return (document.body.getAttribute('data-mode')||'goodjunk');
}
function selectedDiff(){
  var e=$id('d_easy'), n=$id('d_normal'), h=$id('d_hard');
  if (e&&e.classList&&e.classList.contains('active')) return 'Easy';
  if (h&&h.classList&&h.classList.contains('active')) return 'Hard';
  if (n&&n.classList&&n.classList.contains('active')) return 'Normal';
  return document.body.getAttribute('data-diff')||'Normal';
}

// ---------- Timer / Game flow ----------
var round={sec:45,running:false,raf:0,last:0};
function setTimeUI(v){ var t=$id('time'); if(t) t.textContent=String(v|0); }
function beginTimer(seconds){
  round.sec=(seconds|0)>0?(seconds|0):45; round.running=true;
  round.last=(typeof performance!=='undefined'&&performance&&performance.now)?performance.now():Date.now();
  setTimeUI(round.sec);
  function step(){
    if(!round.running) return;
    var now=(typeof performance!=='undefined'&&performance&&performance.now)?performance.now():Date.now();
    var dt=(now-round.last)/1000; round.last=now;
    round.sec=Math.max(0, round.sec-dt); setTimeUI(Math.ceil(round.sec));
    if (typeof current==='object' && current && typeof current.update==='function') { try{ current.update(dt, engine.Bus||null); }catch(e){} }
    if (round.sec<=0){ round.running=false; endGameToResult(); return; }
    round.raf=window.requestAnimationFrame(step);
  }
  round.raf=window.requestAnimationFrame(step);
}
function stopTimer(){ round.running=false; try{ if(round.raf) window.cancelAnimationFrame(round.raf);}catch(e){} round.raf=0; }

// ---------- Mode loader (failsafe) ----------
var triedDynamic=false;
function ensureRealModesThenLoad(key, onDone){
  // ถ้ายังไม่เคยพยายามโหลดจริง ให้ลองโหลดไฟล์โหมด
  if (!triedDynamic){
    triedDynamic=true;
    // พยายาม import โหมดจริง ๆ (ถ้าล้มเหลว จะอยู่กับ fallback ต่อไป)
    Promise.all([
      import('./modes/goodjunk.js?v=live&cb='+Date.now()).catch(function(e){ console.warn('[HHA] load goodjunk failed', e); return null; }),
      import('./modes/groups.js?v=live&cb='+Date.now()).catch(function(){ return null; }),
      import('./modes/hydration.js?v=live&cb='+Date.now()).catch(function(){ return null; }),
      import('./modes/plate.js?v=live&cb='+Date.now()).catch(function(){ return null; }),
    ]).then(function(arr){
      try{
        if (arr[0]){ MODES.goodjunk = arr[0].default||arr[0]; }
        if (arr[1]){ MODES.groups   = arr[1].default||arr[1]; }
        if (arr[2]){ MODES.hydration= arr[2].default||arr[2]; }
        if (arr[3]){ MODES.plate    = arr[3].default||arr[3]; }
      }catch(_){}
      onDone();
    }).catch(function(){ onDone(); });
  } else {
    onDone();
  }
}

function loadMode(key){
  var mod = MODES[key] || MODES.goodjunk;
  try{ if (current && current.cleanup) current.cleanup(); }catch(e){}
  try{
    var inst = (mod && typeof mod.create==='function') ? mod.create({ engine:engine, hud:hud, coach:coach }) : null;
    if (!inst){ throw new Error('Mode has no create()'); }
    current = inst;
  }catch(e){
    console.error('Failed to load mode:', key, e);
    // ตกกลับไป fallback เสมอ
    try{
      var inst2 = BuiltinGoodJunk.create();
      current = inst2;
    }catch(_){
      current = null;
    }
  }
}

// ---------- View helpers ----------
function showMenu(){ var m=$id('menuBar'), h=$id('hudWrap'), r=$id('result'); if(m&&m.style)m.style.display='block'; if(h&&h.style)h.style.display='none'; if(r&&r.style)r.style.display='none'; setPlayfieldActive(false); }
function showPlay(){ var m=$id('menuBar'), h=$id('hudWrap'), r=$id('result'); if(m&&m.style)m.style.display='none'; if(h&&h.style)h.style.display='block'; if(r&&r.style)r.style.display='none'; setPlayfieldActive(true); }
function showResult(){ var r=$id('result'); if(r&&r.style) r.style.display='flex'; setPlayfieldActive(false); }

// ---------- Flow ----------
function start(){
  try{ if(score&&score.reset) score.reset(); }catch(e){}
  try{ if(Progress&&Progress.beginRun) Progress.beginRun(selectedMode(), selectedDiff(), 'TH', 45); }catch(e){}
  try{ if(engine&&engine.start) engine.start(); }catch(e){}
  try{ if(current&&current.start) current.start(); }catch(e){}
  try{ if(coach&&coach.onStart) coach.onStart(); }catch(e){}
  showPlay(); beginTimer(45);
}
function stop(){
  stopTimer();
  try{ if(current&&current.stop) current.stop(); }catch(e){}
  try{ if(engine&&engine.stop) engine.stop(); }catch(e){}
  try{ if(coach&&coach.onEnd) coach.onEnd(); }catch(e){}
  try{
    var sc=0, bc=0; if(score&&score.get) sc=score.get()|0; if(score&&(score.bestCombo|0)) bc=score.bestCombo|0;
    if(Progress&&Progress.endRun) Progress.endRun({score:sc,bestCombo:bc});
  }catch(e){}
  showMenu();
}
function replay(){ stopTimer(); try{ if(current&&current.stop) current.stop(); }catch(e){} showPlay(); start(); }
function endGameToResult(){
  try{ if(current&&current.stop) current.stop(); }catch(e){}
  try{ if(engine&&engine.stop) engine.stop(); }catch(e){}
  var sc=0, grade=null, stars=0;
  try{ if(score&&score.get) sc=score.get()|0; if(score&&score.getGrade){ var g=score.getGrade(); grade=g&&g.grade; stars=g&&g.stars; } }catch(e){}
  var res=$id('resultText'); if(res){ var txt='Score '+sc; if(grade) txt+=' • Grade '+grade; if(stars) txt+=' • '+Array(stars+1).join('★'); res.textContent=txt; }
  showResult();
}

// ---------- Visibility ----------
window.addEventListener('blur',  function(){ try{ if(engine.pause) engine.pause(); if(VRInput.pause) VRInput.pause(true);}catch(e){} }, {passive:true});
window.addEventListener('focus', function(){ try{ if(engine.resume) engine.resume(); if(VRInput.resume)VRInput.resume(true);}catch(e){} }, {passive:true});
document.addEventListener('visibilitychange', function(){
  try{
    if (document.hidden){ if(engine.pause) engine.pause(); if(VRInput.pause) VRInput.pause(true); }
    else { if(engine.resume) engine.resume(); if(VRInput.resume) VRInput.resume(true); }
  }catch(e){}
}, {passive:true});

// ---------- Bind Menu ----------
function bindMenu(){
  var modePairs=[['m_goodjunk','Good vs Junk','goodjunk'],['m_groups','5 Food Groups','groups'],['m_hydration','Hydration','hydration'],['m_plate','Healthy Plate','plate']];
  for (var i=0;i<modePairs.length;i++){
    (function(row){
      var id=row[0], label=row[1], key=row[2]; var el=$id(id); if(!el) return;
      el.addEventListener('click', function(){
        for(var j=0;j<modePairs.length;j++){ var n=$id(modePairs[j][0]); if(n&&n.classList){ if(modePairs[j][0]===id) n.classList.add('active'); else n.classList.remove('active'); } }
        var mName=$id('modeName'); if(mName) mName.textContent=label; document.body.setAttribute('data-mode', key);
      }, {passive:true});
    })(modePairs[i]);
  }
  var diffPairs=[['d_easy','Easy','ง่าย'],['d_normal','Normal','ปกติ'],['d_hard','Hard','ยาก']];
  for (var k=0;k<diffPairs.length;k++){
    (function(row){
      var id=row[0], val=row[1], th=row[2]; var el=$id(id); if(!el) return;
      el.addEventListener('click', function(){
        for(var j=0;j<diffPairs.length;j++){ var n=$id(diffPairs[j][0]); if(n&&n.classList){ if(diffPairs[j][0]===id) n.classList.add('active'); else n.classList.remove('active'); } }
        var dv=$id('difficulty'); if(dv) dv.textContent=th; document.body.setAttribute('data-diff', val);
      }, {passive:true});
    })(diffPairs[k]);
  }
  var bStart=$id('btn_start'); if(bStart) bStart.addEventListener('click', function(){
    ensureRealModesThenLoad(selectedMode(), function(){ loadMode(selectedMode()); start(); });
  });
  var bRestart=$id('btn_restart'); if(bRestart) bRestart.addEventListener('click', function(){ replay(); });
  var bPause=$id('btn_pause'); if(bPause) bPause.addEventListener('click', function(){
    try{ if(engine && engine.isPaused && engine.isPaused()){ if(engine.resume) engine.resume(); } else { if(engine.pause) engine.pause(); } }catch(e){}
  });
  document.addEventListener('click', function(ev){
    var a=ev.target && ev.target.closest ? ev.target.closest('[data-result]') : null; if(!a) return;
    var act=a.getAttribute('data-result'); if(act==='home') stop(); if(act==='replay') replay();
  });
}

// ---------- Boot ----------
(function boot(){
  window.__HHA_BOOT_OK = true;
  try{
    if (hud&&hud.init) hud.init();
    if (coach&&coach.init) coach.init({ hud:hud, sfx:sfx });
    if (engine&&engine.init) engine.init();
    if (Progress&&Progress.init) Progress.init();
    if (VRInput&&VRInput.init) VRInput.init({ engine:engine, sfx:sfx, THREE:THREEpkg });

    // โหลดโหมดจริงแบบขนาน (แต่มี fallback เล่นได้ทันทีตอนกด Start)
    // ผู้ใช้กด Start → เราจะ ensure แล้ว loadMode() อีกครั้งภายหลัง
    ensureRealModesThenLoad(selectedMode(), function(){ /* no-op */ });

    // เริ่มที่เมนู
    showMenu();

    // API เผื่อภายนอก
    window.HHA = window.HHA || {};
    window.HHA.setPlayfieldActive = setPlayfieldActive;
    window.HHA.startSelectedMode  = function(){ ensureRealModesThenLoad(selectedMode(), function(){ loadMode(selectedMode()); start(); }); };
    window.HHA.stop   = stop;
    window.HHA.replay = replay;

    bindMenu();
  }catch(e){
    console.error('[main] init error', e);
    var pre=document.createElement('pre'); pre.style.cssText='color:#f55;white-space:pre-wrap;padding:12px';
    pre.textContent='Runtime error:\n'+(e && (e.stack||e.message) || String(e)); document.body.appendChild(pre);
  }
})();
