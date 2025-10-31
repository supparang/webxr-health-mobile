// === Hero Health Academy — game/main.js (2025-10-31 SAFE RUN BUILD + GAME LOOP) ===
// - รับมือ core modules ที่ไม่ใช่ class (HUD is not a constructor) ด้วย make()/pick()
// - มี game loop เรียก current.update(dt, engine.Bus) ทุกเฟรม
// - ตัวจับเวลา 45s อัปเดต #time และจบเกมเปิด Result (มี Home/Replay)
// - ไม่ใช้ optional chaining

import * as THREEpkg from 'https://unpkg.com/three@0.159.0/build/three.module.js';

// ---------- Safe helpers ----------
function pick(mod, name){
  return (mod && (mod[name] != null ? mod[name] : (mod.default != null ? mod.default : mod))) || null;
}
function make(mod, name, a,b,c,d){
  var impl = pick(mod, name);
  if (!impl) return {};
  if (typeof impl === 'function'){
    try { return new impl(a,b,c,d); } catch(e){}
    try { return impl(a,b,c,d); } catch(e){}
  }
  return impl || {};
}

// ---------- Core ----------
import * as EngineMod   from './core/engine.js';
import * as HUDMod      from './core/hud.js';
import * as CoachMod    from './core/coach.js';
import * as SFXMod      from './core/sfx.js';
import * as ScoreMod    from './core/score.js';
import * as PowerUpMod  from './core/powerup.js';
import * as MissionMod  from './core/mission-system.js';
import * as ProgressMod from './core/progression.js';
import * as VRInputMod  from './core/vrinput.js';

// Modes
import * as goodjunk   from './modes/goodjunk.js';
import * as groups     from './modes/groups.js';
import * as hydration  from './modes/hydration.js';
import * as plate      from './modes/plate.js';

window.__HHA_BOOT_OK = true;

// ---------- Instances ----------
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
    o = o || {};
    var n = document.createElement('div');
    n.className = 'poptext';
    n.textContent = text;
    n.style.left = String(o.x||0)+'px';
    n.style.top  = String(o.y||0)+'px';
    document.body.appendChild(n);
    setTimeout(function(){ try{ n.remove(); }catch(e){} }, (o.ms|0)||650);
  }}
}) : { start:function(){}, stop:function(){}, pause:function(){}, resume:function(){}, init:function(){}, Bus:{} };

try{ if (power && power.attachToScore) power.attachToScore(score); } catch(e){}

// ---------- Registry ----------
var MODES = { goodjunk: goodjunk, groups: groups, hydration: hydration, plate: plate };
var current = null;

// ---------- DOM helpers ----------
function $ (s){ return document.querySelector(s); }
function $id(id){ return document.getElementById(id); }

function setPlayfieldActive(on){
  var layer = $id('gameLayer') || $('.game-wrap');
  var menu  = $id('menuBar');
  if (layer && layer.style) layer.style.pointerEvents = on ? 'auto' : 'none';
  if (menu  && menu.style ) menu.style.pointerEvents  = on ? 'auto' : 'auto'; // เมนูคลิกได้เสมอในหน้าเมนู
  // HUD ไม่กินคลิก
  var hudWrap = $id('hudWrap');
  if (hudWrap && hudWrap.style) hudWrap.style.pointerEvents = 'none';
}
function selectedMode(){
  var ids = ['m_goodjunk','m_groups','m_hydration','m_plate'];
  var map = { m_goodjunk:'goodjunk', m_groups:'groups', m_hydration:'hydration', m_plate:'plate' };
  for (var i=0;i<ids.length;i++){
    var el = $id(ids[i]);
    if (el && el.classList && el.classList.contains('active')) return map[ids[i]];
  }
  return (document.body.getAttribute('data-mode')||'goodjunk');
}
function selectedDiff(){
  var e=$id('d_easy'), n=$id('d_normal'), h=$id('d_hard');
  if (e && e.classList && e.classList.contains('active')) return 'Easy';
  if (h && h.classList && h.classList.contains('active')) return 'Hard';
  if (n && n.classList && n.classList.contains('active')) return 'Normal';
  return document.body.getAttribute('data-diff') || 'Normal';
}

// ---------- Round timer ----------
var round = { sec:45, running:false, raf:0, last:0 };

function setTimeUI(v){ var t=$id('time'); if (t) t.textContent = String(v|0); }
function setScoreUI(v){ var el=$id('score'); if (el) el.textContent = String(v|0); }
function setComboUI(v){ var el=$id('combo'); if (el) el.textContent = 'x'+String(v|0); }

function beginTimer(seconds){
  round.sec = (seconds|0)>0 ? (seconds|0) : 45;
  round.running = true;
  round.last = (window.performance && performance.now) ? performance.now() : Date.now();
  setTimeUI(round.sec);
}
function stopTimer(){
  round.running = false;
  try{ if (round.raf) cancelAnimationFrame(round.raf); }catch(e){}
  round.raf = 0;
}

// ---------- Game loop (สำคัญ) ----------
function loop(){
  var now = (window.performance && performance.now) ? performance.now() : Date.now();
  var dt = Math.max(0, now - round.last) / 1000;
  round.last = now;

  // อัปเดตโหมดปัจจุบัน
  try{ if (current && current.update) current.update(dt, engine.Bus); }catch(e){}

  // อัปเดตเวลา/คะแนน/คอมโบ
  if (round.running){
    round.sec = Math.max(0, round.sec - dt);
    setTimeUI(Math.ceil(round.sec));
    try{
      if (score && typeof score.get === 'function') setScoreUI(score.get()|0);
      if (typeof score === 'object' && (score.combo|0) >= 0) setComboUI(score.combo|0);
    }catch(e){}
    if (round.sec <= 0){
      round.running = false;
      endGameToResult();
    }
  }

  round.raf = requestAnimationFrame(loop);
}

// ---------- Mode lifecycle ----------
function loadMode(key){
  var mod = MODES[key] || MODES.goodjunk;
  try{ if (current && current.cleanup) current.cleanup(); }catch(e){}
  current = (mod && typeof mod.create === 'function') ? mod.create({ engine:engine, hud:hud, coach:coach }) : null;
}
function showMenu(){
  var m=$id('menuBar'), h=$id('hudWrap'), r=$id('result');
  if (m&&m.style) m.style.display='block';
  if (h&&h.style) h.style.display='none';
  if (r&&r.style) r.style.display='none';
  setPlayfieldActive(false);
}
function showPlay(){
  var m=$id('menuBar'), h=$id('hudWrap'), r=$id('result');
  if (m&&m.style) m.style.display='none';
  if (h&&h.style) h.style.display='block';
  if (r&&r.style) r.style.display='none';
  setPlayfieldActive(true);
}
function showResult(){
  var r=$id('result'); if (r&&r.style) r.style.display='flex';
  setPlayfieldActive(false);
}
function start(){
  try{ if (score && score.reset) score.reset(); }catch(e){}
  try{ if (Progress && Progress.beginRun) Progress.beginRun(selectedMode(), selectedDiff(), 'TH', 45); }catch(e){}
  try{ if (engine && engine.start) engine.start(); }catch(e){}
  try{ if (current && current.start) current.start(); }catch(e){}
  try{ if (coach && coach.onStart) coach.onStart(); }catch(e){}
  showPlay();
  beginTimer(45);
  // เริ่ม loop ถ้ายังไม่วิ่ง
  if (!round.raf){ round.last = (performance && performance.now)? performance.now(): Date.now(); round.raf = requestAnimationFrame(loop); }
}
function stop(){
  stopTimer();
  try{ if (current && current.stop)  current.stop(); }catch(e){}
  try{ if (engine  && engine.stop)  engine.stop(); }catch(e){}
  try{ if (coach   && coach.onEnd)  coach.onEnd(); }catch(e){}
  try{
    var sc = score && score.get ? (score.get()|0) : 0;
    var bc = score && (score.bestCombo|0) ? (score.bestCombo|0) : 0;
    if (Progress && Progress.endRun) Progress.endRun({ score: sc, bestCombo: bc });
  }catch(e){}
  showMenu();
}
function replay(){
  stopTimer();
  try{ if (current && current.stop) current.stop(); }catch(e){}
  showPlay();
  start();
}

// ---------- Result summary ----------
function endGameToResult(){
  try{ if (current && current.stop) current.stop(); }catch(e){}
  try{ if (engine  && engine.stop) engine.stop(); }catch(e){}
  var sc = 0, grade = null, stars = 0;
  try{
    sc = score && score.get ? (score.get()|0) : 0;
    if (score && typeof score.getGrade === 'function'){
      var g = score.getGrade();
      grade = g && g.grade; stars = g && g.stars;
    }
  }catch(e){}
  var res = $id('resultText');
  if (res){
    var txt = 'Score ' + sc;
    if (grade) txt += ' • Grade ' + grade;
    if (stars) txt += ' • ' + '★'.repeat(stars);
    res.textContent = txt;
  }
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

// ---------- Wire menu ----------
function bindMenu(){
  // โหมด
  var modePairs = [
    ['m_goodjunk','Good vs Junk','goodjunk'],
    ['m_groups','5 Food Groups','groups'],
    ['m_hydration','Hydration','hydration'],
    ['m_plate','Healthy Plate','plate']
  ];
  for (var i=0;i<modePairs.length;i++){
    (function(row){
      var id=row[0], label=row[1], key=row[2];
      var el = $id(id); if(!el) return;
      el.addEventListener('click', function(){
        for (var j=0;j<modePairs.length;j++){
          var n = $id(modePairs[j][0]); if (n && n.classList){
            if (modePairs[j][0]===id) n.classList.add('active'); else n.classList.remove('active');
          }
        }
        var mName = $id('modeName'); if(mName) mName.textContent = label;
        document.body.setAttribute('data-mode', key);
      }, false);
    })(modePairs[i]);
  }

  // ความยาก
  var diffPairs = [
    ['d_easy','Easy','ง่าย'],
    ['d_normal','Normal','ปกติ'],
    ['d_hard','Hard','ยาก']
  ];
  for (var k=0;k<diffPairs.length;k++){
    (function(row){
      var id=row[0], val=row[1], textTH=row[2];
      var el = $id(id); if(!el) return;
      el.addEventListener('click', function(){
        for (var j=0;j<diffPairs.length;j++){
          var n=$id(diffPairs[j][0]); if(n && n.classList){
            if (diffPairs[j][0]===id) n.classList.add('active'); else n.classList.remove('active');
          }
        }
        var dv = $id('difficulty'); if(dv) dv.textContent = textTH;
        document.body.setAttribute('data-diff', val);
      }, false);
    })(diffPairs[k]);
  }

  // ปุ่มหลัก
  var bStart = $id('btn_start');   if (bStart)   bStart.addEventListener('click', function(){ loadMode(selectedMode()); start(); });
  var bRestart= $id('btn_restart');if (bRestart) bRestart.addEventListener('click', function(){ replay(); });
  var bPause  = $id('btn_pause');  if (bPause)   bPause.addEventListener('click', function(){
    try{ if (engine && engine.isPaused && engine.isPaused()) { if(engine.resume) engine.resume(); }
         else { if(engine.pause) engine.pause(); } }catch(e){}
  });

  // ปุ่มใน Result
  document.addEventListener('click', function(ev){
    var a = ev.target && ev.target.closest ? ev.target.closest('[data-result]') : null;
    if (!a) return;
    var act = a.getAttribute('data-result');
    if (act==='home'){ stop(); }
    if (act==='replay'){ replay(); }
  });
}

// ---------- Boot ----------
(function boot(){
  try{
    if (hud    && hud.init)    hud.init();
    if (coach  && coach.init)  coach.init({ hud: hud, sfx: sfx });
    if (engine && engine.init) engine.init();
    if (Progress && Progress.init) Progress.init();
    if (VRInput  && VRInput.init)  VRInput.init({ engine:engine, sfx:sfx, THREE:THREEpkg });

    // default mode
    loadMode(selectedMode());
    showMenu();
    bindMenu();

    // เตรียม loop ให้เริ่มเมื่อ start()
    round.raf = 0;
  }catch(e){
    console.error('[main] init error', e);
    var pre=document.createElement('pre');
    pre.style.cssText='color:#f55;white-space:pre-wrap;padding:12px';
    pre.textContent='Runtime error:\n'+(e && (e.stack||e.message) || String(e));
    document.body.appendChild(pre);
  }
})();
