// === Hero Health Academy — game/main.js (2025-10-31 HARD FAILSAFE) ===
// แก้ "Failed to load mode: goodjunk" ให้เล่นได้แน่นอน:
// - ถ้า import โหมดจริงล้มเหลว → ใช้ BuiltinGoodJunk (fallback) ทันที
// - ถ้าไม่พบ #gameLayer/#spawnHost → auto-create host ภายใน .game-wrap
// - แสดงแถบเขียว "Fallback mode active" เพื่อยืนยันว่ารันจริง
// - ไม่ใช้ optional chaining, รองรับ WebView/Chrome เก่า

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

// ---------- Core (object/class-safe) ----------
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
    n.textContent=text; n.style.position='fixed';
    n.style.left=String(o.x||0)+'px'; n.style.top=String(o.y||0)+'px';
    n.style.font='900 16px ui-rounded'; n.style.padding='4px 8px';
    n.style.background='rgba(0,0,0,.45)'; n.style.border='1px solid rgba(255,255,255,.2)';
    n.style.borderRadius='8px'; n.style.color='#eaf6ff'; n.style.zIndex='9999';
    document.body.appendChild(n); setTimeout(function(){ try{n.remove();}catch(e){} }, (o.ms|0)||700);
  }}
}) : { start:function(){}, stop:function(){}, pause:function(){}, resume:function(){}, init:function(){} };

try{ if (power && power.attachToScore) power.attachToScore(score); }catch(e){}

// ---------- Utilities ----------
function $ (s){ return document.querySelector(s); }
function $id(id){ return document.getElementById(id); }
function banner(msg, ok){
  var el = document.getElementById('failsafeBanner');
  if (!el){
    el=document.createElement('div'); el.id='failsafeBanner';
    el.style.cssText='position:fixed;left:12px;bottom:12px;background:'+(ok?'#166534':'#7f1d1d')+';color:#fff;padding:8px 10px;border-radius:999px;font:800 12px ui-rounded;z-index:2002';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display='inline-block';
}

// ---------- Ensure host (auto-create if missing) ----------
function ensurePlayHost(){
  var layer = $id('gameLayer');
  var wrap  = layer || $('.game-wrap');
  if (!wrap){
    // เกิดกรณีไม่มี .game-wrap → สร้างให้เอง
    wrap = document.createElement('div'); wrap.className='game-wrap';
    wrap.style.cssText='position:relative; width:min(980px,96vw); height:calc(100vh - 320px); margin:10px auto 0; border-radius:16px; border:1px solid #152641; background:#0b1626; overflow:hidden; box-shadow:0 12px 50px rgba(0,0,0,.35)';
    var app = document.getElementById('app') || document.body; app.appendChild(wrap);
  }
  var host = $id('spawnHost');
  if (!host){
    host = document.createElement('div'); host.id='spawnHost';
    host.style.cssText='position:absolute;inset:0;z-index:29';
    wrap.appendChild(host);
  }
  return { layer: wrap, host: host };
}

// ---------- BuiltinGoodJunk (fallback) ----------
var BuiltinGoodJunk = (function(){
  var running=false, items=[], spawnCd=0.2, layer=null, host=null;
  var GOOD=['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑','🫘'];
  var JUNK=['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍭','🧁','🥓','🥠','🍨','🍦','🧂','🧈','🍹','🍯'];
  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
  function rnd(arr){ return arr[(Math.random()*arr.length)|0]; }
  function toast(txt){
    var t=document.getElementById('toast'); if(!t){ t=document.createElement('div'); t.id='toast';
      t.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:18px;background:#102038f0;border:1px solid #1a2c47;color:#eaf6ff;padding:8px 12px;border-radius:999px;font:800 12px ui-rounded;z-index:9998';
      document.body.appendChild(t);
    }
    t.textContent=txt; t.style.opacity='1'; setTimeout(function(){ t.style.opacity='0.0'; }, 900);
  }
  function pickMeta(){ var isGood=Math.random()<0.65; return { isGood:isGood, char:rnd(isGood?GOOD:JUNK), life:clamp(1600+((Math.random()*900)|0),700,4500), golden:Math.random()<0.08, aria:(isGood?'Good':'Junk') }; }
  function spawnOne(rect){
    var m=pickMeta(), pad=30;
    var w=rect.width|0||640, h=rect.height|0||360;
    var x=Math.round(pad+Math.random()*(Math.max(1,w)-pad*2));
    var y=Math.round(pad+Math.random()*(Math.max(1,h)-pad*2));
    var b=document.createElement('button');
    b.className='spawn-emoji'; b.type='button'; b.textContent=m.char; b.setAttribute('aria-label', m.aria);
    b.style.cssText='position:absolute;left:'+x+'px;top:'+y+'px;transform:translate(-50%,-50%);z-index:29;padding:8px 12px;border-radius:18px;border:0;background:rgba(255,255,255,.08)';
    if (m.golden) b.style.filter='drop-shadow(0 0 10px rgba(255,215,0,.85))';
    (host||document.getElementById('spawnHost')||document.body).appendChild(b);
    var born=(typeof performance!=='undefined'&&performance&&performance.now)?performance.now():Date.now();
    items.push({ el:b, born:born, life:m.life, meta:m });
    b.addEventListener('click', function(ev){
      if(!running) return; ev.stopPropagation();
      var ui={x:ev.clientX||0,y:ev.clientY||0};
      try{ if (sfx&&sfx.play) sfx.play(m.golden?'sfx-perfect':'sfx-good'); }catch(e){}
      if (!m.isGood){
        try{ if (sfx&&sfx.play) sfx.play('sfx-bad'); }catch(e){}
        try{ document.body.classList.add('flash-danger'); setTimeout(function(){document.body.classList.remove('flash-danger');},160);}catch(e){}
      } else {
        try{ if (engine&&engine.fx&&engine.fx.popText) engine.fx.popText('+'+(m.golden?20:10)+(m.golden?' ✨':''), {x:ui.x,y:ui.y,ms:720}); }catch(e){}
      }
      try{ b.remove(); }catch(e){}
      for (var i=0;i<items.length;i++){ if(items[i].el===b){ items.splice(i,1); break; } }
    }, false);
  }
  return {
    create: function(){
      return {
        start: function(){
          running=false; items.length=0; spawnCd=0.2;
          var hostInfo = ensurePlayHost(); layer=hostInfo.layer; host=hostInfo.host;
          running=true; toast('🍃 ดี vs ขยะ (fallback)'); banner('Fallback mode active', true);
        },
        stop: function(){ running=false; try{ for (var i=0;i<items.length;i++){ var it=items[i]; if(it&&it.el&&it.el.remove) it.el.remove(); } }catch(e){} items.length=0; },
        update: function(dt){
          if(!running) return;
          var rect={width:640,height:360}; try{ if(layer&&layer.getBoundingClientRect) rect=layer.getBoundingClientRect(); }catch(e){}
          spawnCd-=dt; if (spawnCd<=0){ spawnOne(rect); spawnCd = Math.max(0.24, Math.min(0.95, 0.40 + Math.random()*0.22)); }
          var now=(typeof performance!=='undefined'&&performance&&performance.now)?performance.now():Date.now();
          var keep=[]; for (var i=0;i<items.length;i++){ var it=items[i]; if(now-it.born>it.life){ try{it.el.remove();}catch(e){} } else keep.push(it); } items=keep;
        },
        cleanup: function(){ this.stop(); }
      };
    }
  };
})();

// ---------- Mode registry (will swap with real ones if loaded) ----------
var MODES = { goodjunk: BuiltinGoodJunk, groups: BuiltinGoodJunk, hydration: BuiltinGoodJunk, plate: BuiltinGoodJunk };
var current = null;

// ---------- Playfield pointer control ----------
function setPlayfieldActive(on){
  var wrap=$id('gameLayer')||$('.game-wrap'); var menu=$id('menuBar');
  if (wrap&&wrap.style) wrap.style.pointerEvents=on?'auto':'auto'; // เปิดคลิกในเกม
  if (menu&&menu.style) menu.style.pointerEvents=on?'none':'auto';
  var hudWrap=$id('hudWrap'); if(hudWrap&&hudWrap.style) hudWrap.style.pointerEvents='none';
}

// ---------- Selections ----------
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

// ---------- Timer ----------
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
    try{ if (current && typeof current.update==='function') current.update(dt, engine.Bus||null); }catch(e){}
    if (round.sec<=0){ round.running=false; endGameToResult(); return; }
    round.raf=window.requestAnimationFrame(step);
  }
  round.raf=window.requestAnimationFrame(step);
}
function stopTimer(){ round.running=false; try{ if(round.raf) window.cancelAnimationFrame(round.raf);}catch(e){} round.raf=0; }

// ---------- Load real modes (once) ----------
var triedDynamic=false;
function ensureRealModesThenLoad(key, onDone){
  if (!triedDynamic){
    triedDynamic=true;
    Promise.all([
      import('./modes/goodjunk.js?v=live&cb='+Date.now()).catch(function(e){ console.warn('[HHA] load goodjunk failed', e); return null; }),
      import('./modes/groups.js?v=live&cb='+Date.now()).catch(function(e){ console.warn('[HHA] load groups failed', e); return null; }),
      import('./modes/hydration.js?v=live&cb='+Date.now()).catch(function(e){ console.warn('[HHA] load hydration failed', e); return null; }),
      import('./modes/plate.js?v=live&cb='+Date.now()).catch(function(e){ console.warn('[HHA] load plate failed', e); return null; })
    ]).then(function(arr){
      try{
        if (arr[0]) MODES.goodjunk = arr[0].default||arr[0];
        if (arr[1]) MODES.groups   = arr[1].default||arr[1];
        if (arr[2]) MODES.hydration= arr[2].default||arr[2];
        if (arr[3]) MODES.plate    = arr[3].default||arr[3];
        banner('Real modes loaded', true);
      }catch(_){}
      onDone();
    }).catch(function(){ onDone(); });
  } else { onDone(); }
}

// ---------- View helpers ----------
function showMenu(){ var m=$id('menuBar'), h=$id('hudWrap'), r=$id('result'); if(m&&m.style)m.style.display='block'; if(h&&h.style)h.style.display='none'; if(r&&r.style)r.style.display='none'; setPlayfieldActive(false); }
function showPlay(){ var m=$id('menuBar'), h=$id('hudWrap'), r=$id('result'); if(m&&m.style)m.style.display='none'; if(h&&h.style)h.style.display='block'; if(r&&r.style)r.style.display='none'; setPlayfieldActive(true); }
function showResult(){ var r=$id('result'); if(r&&r.style) r.style.display='flex'; setPlayfieldActive(false); }

// ---------- Flow ----------
function loadMode(key){
  var mod = MODES[key] || MODES.goodjunk;
  try{ if (current && current.cleanup) current.cleanup(); }catch(e){}
  try{
    var inst = (mod && typeof mod.create==='function') ? mod.create({ engine:engine, hud:hud, coach:coach }) : null;
    if (!inst) throw new Error('Mode has no create()');
    current = inst;
  }catch(e){
    console.warn('Mode load failed; using fallback:', key, e);
    banner('Using fallback mode', true);
    try{ current = BuiltinGoodJunk.create(); }catch(_){ current = null; }
  }
}

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
  try{ if (document.hidden){ if(engine.pause) engine.pause(); if(VRInput.pause) VRInput.pause(true); }
       else { if(engine.resume) engine.resume(); if(VRInput.resume) VRInput.resume(true); } }catch(e){}
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
    try{ if(engine&&engine.isPaused&&engine.isPaused()){ if(engine.resume) engine.resume(); } else { if(engine.pause) engine.pause(); } }catch(e){}
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

    // เตรียม host (กรณี index ไม่มี)
    ensurePlayHost();

    // โหลดโหมดจริงแบบขนาน (ถ้าพลาด → fallback อยู่แล้ว)
    ensureRealModesThenLoad(selectedMode(), function(){ /*noop*/ });

    showMenu();
    window.HHA = window.HHA || {};
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
