// === Hero Health Academy — game/main.js (2025-11-01 ULTRA-SAFE) ===
// - ใช้กับ DOM-only modes ได้ (goodjunk/groups/hydration/plate)
// - ไม่ใช้ optional chaining; ทำงานได้แม้ HUD ขาดบางส่วน
// - รวม ScoreSystem, PowerUpSystem v3, MissionSystem, Progress, Quests, SFX

/* ===== Imports ===== */
import { Engine, FX }          from '../core/engine.js';
import { sfx as SFX }          from '../core/sfx.js';
import { ScoreSystem }         from '../core/score.js';
import { PowerUpSystem }       from '../core/powerup.js';
import { MissionSystem }       from '../core/mission-system.js';
import { Progress }            from '../core/progression.js';
import { Quests }              from '../core/quests.js';
import * as goodjunk           from './modes/goodjunk.js';
import * as groups             from './modes/groups.js';
import * as hydration          from './modes/hydration.js';
import * as plate              from './modes/plate.js';

/* ===== Shims/Utils ===== */
function $(sel){ return document.querySelector(sel); }
function byId(id){ return document.getElementById(id); }
function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
function now(){ return (typeof performance!=='undefined' && performance && performance.now)?performance.now():Date.now(); }

const MODS = { goodjunk, groups, hydration, plate };

/* ===== Engine & SFX ===== */
const engine = new Engine();
engine.sfx = SFX;
engine.fx  = FX;
try{ SFX.loadIds(['sfx-good','sfx-bad','sfx-perfect','sfx-tick','sfx-powerup']); }catch{}

/* ===== Systems ===== */
const score   = new ScoreSystem();
const power   = new PowerUpSystem();
const mission = new MissionSystem();

// Progress / Quests
try{ Progress.init(); }catch{}

/* ===== Minimal HUD bindings (ทุกตัวเช็คมี/ไม่มี) ===== */
const HUD = {
  setScore(n){
    const el = byId('score'); if (el) el.textContent = String(n|0);
  },
  setCombo(n){
    const el = byId('combo'); if (el) el.textContent = 'x'+String(n|0);
  },
  setTimeLeft(s){
    const el = byId('time'); if (el) el.textContent = String(s|0);
  },
  setQuestChips(chips){
    // ถ้าไม่มีพื้นที่แสดง ก็ข้ามไป (ไม่ให้เกมพัง)
    const host = byId('questChips');
    if (!host) return;
    var html = '';
    for (var i=0;i<chips.length;i++){
      var c = chips[i];
      html += '<div class="chip'+(c.done?' done':'')+(c.fail?' fail':'')+'">'+
              '<span class="i">'+(c.icon||'⭐')+'</span>'+
              '<span class="t">'+(c.label||'')+'</span>'+
              '<span class="p">'+String(c.progress||0)+'/'+String(c.need||0)+'</span>'+
              '</div>';
    }
    host.innerHTML = html;
  },
  markQuestDone(id){
    // optional cosmetic: เน้น chip ที่เสร็จ
    const host = byId('questChips'); if (!host) return;
    const list = host.querySelectorAll('.chip'); // simplification
    // (ไม่รู้ตำแหน่ง id ของชิปใน DOM นี้ ก็ขอข้าม)
  },
  setPower01(v){
    const fill = byId('powerFill'); if (fill) fill.style.width = String(Math.round(clamp(v,0,1)*100))+'%';
  }
};

/* ===== Score hooks ===== */
score.setHandlers({
  change:function(cur, payload){
    HUD.setScore(cur|0);
    const comboNow = (score.combo|0);
    HUD.setCombo(comboNow);
    // Progress events
    try{
      Progress.notify('score_tick', { score:cur|0 });
      Progress.notify('combo_best', { value:score.bestCombo|0 });
    }catch{}
  }
});
score.setComboGetter(function(){ return score.combo|0; });

/* ===== PowerUp hooks ===== */
power.onChange(function(timers){
  // ปรับแถบพลังตามจำนวนเอฟเฟกต์ (ไม่นับละเอียดก็ได้)
  const x2   = timers.x2|0, frz = timers.freeze|0, swp = timers.sweep|0, sh = timers.shield|0;
  const total = Math.min(100, (x2*8 + frz*6 + swp*5 + sh*4));
  _power01 = clamp(total/100, 0, 1);
  HUD.setPower01(_power01);
});
power.attachToScore(score);

/* ===== Run State ===== */
let _running=false, _paused=false;
let _modeKey='goodjunk', _diff='Normal', _lang='TH';
let _timeLeft=45; // วินาที/รอบ
let _accum=0, _last=0, _raf=0;
let _runner=null, _updater=null, _stopper=null;
let _power01=0;

// ป้องกันหลุดโฟกัสให้ pause นุ่ม ๆ
try{
  window.addEventListener('blur', function(){ _paused=true; }, {passive:true});
  window.addEventListener('focus', function(){ _paused=false; _last=now(); }, {passive:true});
}catch{}

/* ===== BUS กลาง ส่งให้โหมดเรียก ===== */
const Bus = {
  hit: function(payload){
    // payload: { kind:'good'|'perfect'|'ok', points?, ui?, meta? }
    try{
      const k = String(payload && payload.kind || 'good').toLowerCase();
      // map kind -> score
      score.addKind(k, { ui:payload && payload.ui, meta:payload && payload.meta });
      if (k==='perfect'){ power.apply('boost'); /* bonus */ }
      // mission counters
      mission.onEvent(k==='good'?'good':'perfect', { count:1 }, _gameState);
      // golden?
      if (payload && payload.meta && payload.meta.golden){ mission.onEvent('golden', { count:1 }, _gameState); }
      // combo event for missions that track it (handled via addKind meta already)
      mission.onEvent('combo', { value:score.combo|0 }, _gameState);
      // quests live feed
      try{ Quests.event('hit', { result:k, meta:payload.meta||{}, comboNow:score.combo|0 }); }catch{}
      // SFX
      if (k==='perfect') SFX.perfect(); else SFX.good();
      // FX text
      try{ if (engine.fx && engine.fx.popText) engine.fx.popText((k==='perfect'?'+PERFECT':'+GOOD'), payload && payload.ui); }catch{}
    }catch(e){}
  },
  miss: function(meta){
    try{
      score.addKind('bad', { meta: meta||{} });
      mission.onEvent('miss', { count:1 }, _gameState);
      try{ Quests.event('hit', { result:'bad', meta:meta||{}, comboNow:0 }); }catch{}
      SFX.bad();
    }catch(e){}
  }
};

/* ===== Game State (ให้ MissionSystem ใช้ ctx) ===== */
const _gameState = {
  lang:_lang, missions:[], mission:null, ctx:{} // ctx จะถูก _ensureCtx ภายใน MissionSystem
};

/* ===== Quests binding (optional HUD) ===== */
try{
  Quests.bindToMain({ hud: {
    setQuestChips: HUD.setQuestChips,
    markQuestDone: HUD.markQuestDone
  }});
  Quests.setLang(_lang);
}catch{}

/* ===== Public API ===== */
function setMode(m){ _modeKey = String(m||'goodjunk'); }
function setDiff(d){ _diff    = String(d||'Normal'); }
function setLang(l){ _lang    = String(l||'TH').toUpperCase(); _gameState.lang=_lang; try{ Quests.setLang(_lang); }catch{} }

function start(){
  stop();

  // เวลาเริ่มต้น (อ่านจาก DOM ถ้ามี), fallback 45s
  var tEl = byId('time'); var T = 45;
  try{ if (tEl && tEl.getAttribute('data-seconds')) T = parseInt(tEl.getAttribute('data-seconds'),10)||45; }catch{}
  _timeLeft = Math.max(10, T|0);
  HUD.setTimeLeft(_timeLeft);

  // reset ระบบ
  score.reset();
  power.dispose();
  _power01 = 0; HUD.setPower01(0);

  // เริ่ม Progress / Quests
  try{ Progress.beginRun(_modeKey,_diff,_lang); }catch{}
  try{ Quests.beginRun(_modeKey,_diff,_lang,_timeLeft); }catch{}

  // เริ่มชุดมิชชัน 3 ชิ้น
  const run = mission.start(_modeKey, { difficulty:_diff, lang:_lang, seconds:_timeLeft, count:3 });
  mission.attachToState(run, _gameState);

  // เตรียมโหมด
  const mod = MODS[_modeKey];
  _runner=null; _updater=null; _stopper=null;

  try{
    const coach = {
      onStart:function(){},
      onQuestProgress:function(label, cur, need){ /* optional: อาจแจ้งเตือน */ },
      onQuestDone:function(){ try{ SFX.perfect(); }catch{} },
      onQuestFail:function(){}
    };
    if (mod && typeof mod.create==='function'){
      _runner = mod.create({ engine:engine, hud:HUD, coach:coach });
      if (_runner && typeof _runner.start==='function') _runner.start();
      if (_runner && typeof _runner.update==='function') _updater=function(dt){ _runner.update(dt, Bus); };
      if (_runner && typeof _runner.stop==='function')   _stopper=function(){ _runner.stop(); };
    } else if (mod) {
      if (typeof mod.start==='function')  mod.start({ difficulty:_diff });
      if (typeof mod.update==='function') _updater=function(dt){ mod.update(dt, Bus); };
      if (typeof mod.stop==='function')   _stopper=function(){ mod.stop(); };
    } else {
      _failBox('Mode not found: '+_modeKey);
      return;
    }
  }catch(e){
    _failBox('Start error: '+(e && e.message ? e.message : e));
    return;
  }

  _running=true; _paused=false; _last = now(); _accum=0;

  // main loop
  cancelAnimationFrame(_raf);
  _raf = requestAnimationFrame(_loop);

  // ปุ่ม Escape = กลับเมนู (index จัดการแสดงผลเอง)
  try{
    window.addEventListener('keydown', _escBack, {passive:true});
  }catch{}
}

function stop(){
  _running=false;
  cancelAnimationFrame(_raf); _raf=0;
  try{ window.removeEventListener('keydown', _escBack, {passive:true}); }catch{}
  try{ _stopper && _stopper(); }catch{}
  try{ const sh = byId('spawnHost'); if (sh) sh.innerHTML=''; }catch{}
  // สรุปผล Progress/Quests
  try{
    const g = score.get(); const bc=score.bestCombo|0;
    Quests.endRun({ score:g });
    Progress.endRun({ score:g, bestCombo:bc, timePlayed:0, acc:0 });
  }catch{}
}

function _escBack(ev){
  if (ev && ev.key === 'Escape'){
    stop();
    // ให้ index.html แสดงเมนู (หากใช้ไฟล์ index ล่าสุดของคุณ)
    try{ const mb = byId('menuBar'); if (mb) mb.style.display='flex'; }catch{}
  }
}

function _loop(t){
  if (!_running){ return; }
  _raf = requestAnimationFrame(_loop);

  // pause guard
  if (_paused){ _last = t; return; }

  var dt = (t - _last)/1000;
  if (!isFinite(dt) || dt<0) dt = 0;
  if (dt>0.05) dt = 0.05; // cap 50ms
  _last = t;

  // อัปเดตโหมดจริง
  try{ if (_updater) _updater(dt); }catch(e){ _failBox('Update error: '+(e && e.message ? e.message : e)); }

  // นับถอยหลัง + mission tick ต่อวินาที
  _accum += dt;
  if (_accum >= 1){
    const ticks = Math.floor(_accum);
    _accum -= ticks;
    for (var i=0; i<ticks; i++){
      _timeLeft = Math.max(0, (_timeLeft|0) - 1);
      HUD.setTimeLeft(_timeLeft);
      try{ SFX.tick(); }catch{}
      // Mission tick & HUD chips
      try{
        mission.tick(_gameState, { score:score }, function(res){
          // res: { success, key, index }
          if (res && res.success){ try{ Progress.addMissionDone(_modeKey); }catch{} }
        }, { hud:HUD, coach:null, lang:_lang });
      }catch{}
      // Quests tick (ให้ reach_score ประเมิน)
      try{ Quests.tick({ score:score.get()|0 }); }catch{}
    }
  }

  // กรณีหมดเวลา → สรุป
  if ((_timeLeft|0) <= 0){
    stop();
    try{ const mb = byId('menuBar'); if (mb) mb.style.display='flex'; }catch{}
  }

  // decay power เล็กน้อย
  if (_power01>0){ _power01 = Math.max(0, _power01 - dt*0.35); HUD.setPower01(_power01); }
}

/* ===== Error box ===== */
function _failBox(msg){
  stop();
  try{
    const box=document.createElement('div');
    box.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:10000;background:#7f1d1d;color:#fff;padding:8px 12px;font:600 13px ui-rounded';
    box.textContent = '⚠️ '+String(msg||'Error');
    document.body.appendChild(box);
  }catch{}
}

/* ===== Global exports (ใช้จาก index ได้) ===== */
try{
  window.HHA = {
    start: start,
    stop:  stop,
    setMode: setMode,
    setDiff: setDiff,
    setLang: setLang
  };
}catch{}

export { start, stop, setMode, setDiff, setLang };
