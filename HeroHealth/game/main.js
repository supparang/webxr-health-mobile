// === Hero Health Academy — main.js (stable, no-?., no-try-catch-empty) ===
// Features: icon autosize by difficulty, score/combo/fever FX, centered modals,
// safe spawn area, robust SFX, no optional chaining, compat-friendly.

// ----- Boot OK + hide red bar + green chip -----
window.__HHA_BOOT_OK = true;
(function(){
  var w = document.getElementById('bootWarn');
  if (w) w.style.display = 'none';
  // small success chip (auto-hide)
  try{
    var chip = document.createElement('div');
    chip.textContent = '✅ JS Loaded';
    chip.style.position = 'fixed';
    chip.style.right = '10px';
    chip.style.bottom = '10px';
    chip.style.background = '#2e7d32';
    chip.style.color = '#fff';
    chip.style.padding = '6px 10px';
    chip.style.borderRadius = '8px';
    chip.style.zIndex = '9999';
    chip.style.font = '600 12px/1.2 system-ui';
    document.body.appendChild(chip);
    setTimeout(function(){ try{ chip.remove(); }catch(e){} }, 1400);
  }catch(e){}
})();

// ----- Imports (only modes; no external engines to reduce failure surface) -----
import * as goodjunk from './modes/goodjunk.js';
import * as groups    from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate     from './modes/plate.js';

// ----- DOM helpers -----
function $(sel){ return document.querySelector(sel); }
function byAction(el){ return el && el.closest ? el.closest('[data-action]') : null; }
function setText(sel, txt){ var el = $(sel); if (el) el.textContent = txt; }

// ----- Config -----
var MODES = { goodjunk:goodjunk, groups:groups, hydration:hydration, plate:plate };
var DIFFS = {
  Easy:   { time:70, spawn:900, life:4200 },
  Normal: { time:60, spawn:700, life:3000 },
  Hard:   { time:50, spawn:550, life:1800 }
};
var ICON_SIZE_MAP = { Easy: 92, Normal: 72, Hard: 58 };

var I18N = {
  TH:{
    names:{goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ'},
    diffs:{Easy:'ง่าย', Normal:'ปกติ', Hard:'ยาก'}
  },
  EN:{
    names:{goodjunk:'Good vs Junk', groups:'Food Groups', hydration:'Hydration', plate:'Healthy Plate'},
    diffs:{Easy:'Easy', Normal:'Normal', Hard:'Hard'}
  }
};
function T(lang){ return I18N[lang] || I18N.TH; }

// ----- Minimal Systems (DOM-based) -----
var score = {
  score: 0,
  combo: 0,
  reset: function(){ this.score=0; this.combo=0; updateHUD(); },
  add: function(n){ this.score = (this.score|0) + (n|0); updateHUD(); }
};

var sfx = {
  play: function(id){
    try{
      var el = document.getElementById(id);
      if (el){ el.currentTime = 0; el.play(); }
    }catch(e){}
  },
  good: function(){ this.play('sfx-good'); },
  bad:  function(){ this.play('sfx-bad'); },
  perfect: function(){ this.play('sfx-perfect'); },
  tick: function(){ this.play('sfx-tick'); },
  powerup: function(){ this.play('sfx-powerup'); },
  unlock: function(){
    // Unlock all <audio> by calling play() muted once
    try{
      var ids = ['sfx-good','sfx-bad','sfx-perfect','sfx-tick','sfx-powerup'];
      for (var i=0;i<ids.length;i++){
        var a = document.getElementById(ids[i]);
        if (a){ a.muted = true; a.play().then(function(){ try{ a.pause(); a.currentTime=0; a.muted=false; }catch(e){}; }).catch(function(){}) }
      }
    }catch(e){}
  }
};

var power = { timeScale: 1 }; // used in spawn timing, can be modified by modes if they want

// ----- State -----
var state = {
  modeKey: 'goodjunk',
  difficulty: 'Normal',
  running: false,
  paused: false,
  timeLeft: 60,
  lang: (localStorage.getItem('hha_lang') || 'TH'),
  gfx:  (localStorage.getItem('hha_gfx')  || 'quality'),

  // combo / fever
  combo: 0,
  bestCombo: 0,
  fever: { active:false, meter:0, drainPerSec:14, chargeGood:10, chargePerfect:20, threshold:100, mul:2, timeLeft:0 },

  // timers
  spawnTimer: 0,
  tickTimer: 0,

  // per-mode context
  ctx: {}
};

// ----- UI Apply -----
function applyUI(){
  var L = T(state.lang);
  setText('#modeName',   (L.names[state.modeKey] || state.modeKey));
  setText('#difficulty', (L.diffs[state.difficulty] || state.difficulty));
}
function updateHUD(){
  var s = $('#score'); if (s) s.textContent = String(score.score|0);
  var c = $('#combo'); if (c) c.textContent = 'x' + String(state.combo|0);
  var t = $('#time');  if (t) t.textContent = String(state.timeLeft|0);
}

// ----- Fever UI -----
function setFeverBar(pct){
  var bar = document.getElementById('feverBar'); if (!bar) return;
  var v = Math.max(0, Math.min(100, (pct|0)));
  bar.style.width = v + '%';
}
function showFeverLabel(show){
  var f = document.getElementById('fever'); if (!f) return;
  f.style.display = show ? 'block' : 'none';
  if (show) { if (f.classList) f.classList.add('pulse'); }
  else { if (f.classList) f.classList.remove('pulse'); }
}
function startFever(){
  if (state.fever.active) return;
  state.fever.active = true;
  state.fever.timeLeft = 7;
  showFeverLabel(true);
  sfx.powerup();
}
function stopFever(){
  state.fever.active = false;
  state.fever.timeLeft = 0;
  showFeverLabel(false);
}

// ----- Score FX (popup & flame) -----
function makeScoreBurst(x, y, text, minor, color){
  try{
    var el = document.createElement('div');
    el.className = 'scoreBurst';
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    el.style.position = 'fixed';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.color = color || '#7fffd4';
    el.style.fontSize = '20px';
    el.style.fontWeight = '900';
    el.style.zIndex = '9998';
    el.textContent = text;
    if (minor) {
      var m = document.createElement('span');
      m.className = 'minor';
      m.style.marginLeft = '6px';
      m.style.opacity = '0.85';
      m.textContent = minor;
      el.appendChild(m);
    }
    document.body.appendChild(el);
    setTimeout(function(){ try{ el.remove(); }catch(e){} }, 900);
  }catch(e){}
}
function makeFlame(x, y, strong){
  try{
    var el = document.createElement('div');
    el.className = 'flameBurst' + (strong ? ' strong' : '');
    el.style.position = 'fixed';
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.width = strong ? '64px' : '44px';
    el.style.height= strong ? '64px' : '44px';
    el.style.background = 'radial-gradient(rgba(255,180,0,.9), rgba(255,80,0,.6) 60%, rgba(255,0,0,0) 70%)';
    el.style.borderRadius = '50%';
    el.style.zIndex = '9997';
    el.style.pointerEvents = 'none';
    el.style.animation = 'flamePop .6s ease-out';
    document.body.appendChild(el);
    setTimeout(function(){ try{ el.remove(); }catch(e){} }, 700);
  }catch(e){}
}

function scoreWithEffects(base, x, y){
  var comboMul = state.combo >= 20 ? 1.4 : (state.combo >= 10 ? 1.2 : 1.0);
  var feverMul = state.fever.active ? state.fever.mul : 1.0;
  var total = Math.round(base * comboMul * feverMul);

  score.add(total);

  var tag   = total >= 0 ? '+' + total : '' + total;
  var minor = (comboMul > 1 || feverMul > 1) ? ('x' + comboMul.toFixed(1) + (feverMul>1 ? ' & FEVER' : '')) : '';
  var color = total >= 0 ? (feverMul>1 ? '#ffd54a' : '#7fffd4') : '#ff9b9b';

  makeScoreBurst(x, y, tag, minor, color);
  if (state.fever.active) makeFlame(x, y, total >= 10);
}

// ----- Combo logic -----
function addCombo(kind){
  if (kind === 'bad'){
    state.combo = 0;
    updateHUD();
    return;
  }
  if (kind === 'good' || kind === 'perfect'){
    state.combo++;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;

    updateHUD();

    if (!state.fever.active){
      var gain = (kind === 'perfect') ? state.fever.chargePerfect : state.fever.chargeGood;
      state.fever.meter = Math.min(100, state.fever.meter + gain);
      setFeverBar(state.fever.meter);
      if (state.fever.meter >= state.fever.threshold) startFever();
    } else {
      state.fever.timeLeft = Math.min(10, state.fever.timeLeft + 0.6);
    }
  }
}

// ----- Spawner -----
function spawnOnce(diff){
  if (!state.running || state.paused) return;

  var mode = MODES[state.modeKey];
  var meta = {};
  try{
    if (mode && mode.pickMeta) meta = mode.pickMeta(diff, state) || {};
  }catch(e){ meta = {}; }

  var el = document.createElement('button');
  el.className = 'item';
  el.type = 'button';
  el.textContent = meta.char || '❓';

  var px = ICON_SIZE_MAP[state.difficulty] || 72;
  el.style.fontSize = px + 'px';
  el.style.lineHeight = '1';
  el.style.border = 'none';
  el.style.background = 'transparent';
  el.style.color = '#fff';
  el.style.position = 'fixed';
  el.style.cursor = 'pointer';
  el.style.zIndex = '80';
  el.style.transition = 'transform .15s, filter .15s, opacity .15s';
  el.addEventListener('pointerenter', function(){ el.style.transform = 'scale(1.12)'; }, false);
  el.addEventListener('pointerleave', function(){ el.style.transform = 'scale(1)'; }, false);

  // Safe area (avoid header and menu)
  var header = $('header.brand');
  var headerH = header && header.offsetHeight ? header.offsetHeight : 56;
  var menu    = $('#menuBar');
  var menuH   = menu && menu.offsetHeight ? menu.offsetHeight : 120;

  var yMin = headerH + 60;
  var yMax = Math.max(yMin + 50, window.innerHeight - menuH - 80);
  var xMin = 20;
  var xMax = Math.max(xMin + 50, window.innerWidth - 80);

  el.style.left = (xMin + Math.random() * (xMax - xMin)) + 'px';
  el.style.top  = (yMin + Math.random() * (yMax - yMin)) + 'px';

  el.addEventListener('click', function(ev){
    ev.stopPropagation();
    try{
      var res = 'ok';
      if (mode && mode.onHit) res = mode.onHit(meta, { score:score, sfx:sfx, power:power, coach:{} , fx:{} }, state, {}) || 'ok';
      else if (meta.good) res = 'good';

      var r = el.getBoundingClientRect();
      var cx = r.left + r.width/2;
      var cy = r.top  + r.height/2;

      if (res === 'good' || res === 'perfect') addCombo(res);
      if (res === 'bad') addCombo('bad');

      var base = (res==='good'?7: res==='perfect'?14: res==='ok'?2: res==='power'?5: -3);
      scoreWithEffects(base, cx, cy);

      if (res === 'good'){ sfx.good(); }
      else if (res === 'bad'){ sfx.bad(); }
    }catch(e){
      // fail-safe
    }finally{
      try{ el.remove(); }catch(e){}
    }
  }, false);

  document.body.appendChild(el);
  var ttl = meta.life || diff.life || 3000;
  setTimeout(function(){ try{ el.remove(); }catch(e){} }, ttl);
}

function spawnLoop(){
  if (!state.running || state.paused) return;
  var diff = DIFFS[state.difficulty] || DIFFS.Normal;
  spawnOnce(diff);
  var next = Math.max(220, (diff.spawn || 700) * (power.timeScale || 1));
  state.spawnTimer = setTimeout(spawnLoop, next);
}

// ----- Tick / Start / End -----
function tick(){
  if (!state.running || state.paused) return;

  // Fever drain
  if (state.fever.active){
    state.fever.timeLeft = Math.max(0, state.fever.timeLeft - 1);
    state.fever.meter = Math.max(0, state.fever.meter - state.fever.drainPerSec);
    setFeverBar(state.fever.meter);
    if (state.fever.timeLeft <= 0 || state.fever.meter <= 0) stopFever();
  }

  // Per-mode tick
  try{
    var mode = MODES[state.modeKey];
    if (mode && mode.tick) mode.tick(state, { score:score, sfx:sfx, power:power, coach:{}, fx:{} }, {});
  }catch(e){}

  state.timeLeft = Math.max(0, state.timeLeft - 1);
  updateHUD();

  if (state.timeLeft <= 0){ end(false); return; }
  if (state.timeLeft <= 10){
    try{ sfx.tick(); }catch(e){}
    var b = document.body;
    if (b && b.classList) b.classList.add('flash');
  }else{
    var b2 = document.body;
    if (b2 && b2.classList) b2.classList.remove('flash');
  }

  state.tickTimer = setTimeout(tick, 1000);
}

function start(){
  end(true);
  var diff = DIFFS[state.difficulty] || DIFFS.Normal;
  state.running   = true;
  state.paused    = false;
  state.timeLeft  = diff.time;
  state.combo     = 0;
  state.bestCombo = 0;
  state.fever.meter = 0;
  state.fever.active = false;
  setFeverBar(0);
  score.reset();
  updateHUD();

  try{
    var mode = MODES[state.modeKey];
    if (mode && mode.init) mode.init(state, {}, diff);
  }catch(e){}

  tick();
  spawnLoop();
}

function end(silent){
  if (silent !== true) silent = false;
  state.running = false;
  state.paused = false;
  clearTimeout(state.tickTimer);
  clearTimeout(state.spawnTimer);
  try{
    var mode = MODES[state.modeKey];
    if (mode && mode.cleanup) mode.cleanup(state, {});
  }catch(e){}

  if (!silent){
    var m = document.getElementById('result');
    if (m) m.style.display = 'flex';
  }
}

// ----- Events -----
document.addEventListener('pointerup', function(e){
  var btn = byAction(e.target);
  if (!btn) return;
  var a = btn.getAttribute('data-action');
  var v = btn.getAttribute('data-value');

  if (a === 'mode'){ state.modeKey = v; applyUI(); if (state.running) start(); }
  else if (a === 'diff'){ state.difficulty = v; applyUI(); if (state.running) start(); }
  else if (a === 'start'){ start(); }
  else if (a === 'pause'){
    if (!state.running){ start(); return; }
    state.paused = !state.paused;
    if (!state.paused){ tick(); spawnLoop(); }
    else { clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer); }
  }
  else if (a === 'restart'){ end(true); start(); }
  else if (a === 'help'){ var m = document.getElementById('help'); if (m) m.style.display = 'flex'; }
  else if (a === 'helpClose'){ var m2 = document.getElementById('help'); if (m2) m2.style.display = 'none'; }
  else if (a === 'helpScene'){ var hs = document.getElementById('helpScene'); if (hs) hs.style.display = 'flex'; }
  else if (a === 'helpSceneClose'){ var hs2 = document.getElementById('helpScene'); if (hs2) hs2.style.display = 'none'; }
}, false);

// Top bar toggles
var langBtn = document.getElementById('langToggle');
if (langBtn){
  langBtn.addEventListener('click', function(){
    state.lang = state.lang === 'TH' ? 'EN' : 'TH';
    localStorage.setItem('hha_lang', state.lang);
    applyUI();
  }, false);
}
var gfxBtn = document.getElementById('gfxToggle');
if (gfxBtn){
  gfxBtn.addEventListener('click', function(){
    state.gfx = state.gfx === 'low' ? 'quality' : 'low';
    localStorage.setItem('hha_gfx', state.gfx);
    // (ปล่อยว่าง ถ้าไม่มี renderer)
  }, false);
}

// Unlock audio once
window.addEventListener('pointerdown', function(){ try{ sfx.unlock(); }catch(e){} }, { once:true });

// ----- Boot -----
applyUI();
updateHUD();
