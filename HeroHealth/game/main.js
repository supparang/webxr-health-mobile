// === Hero Health Academy — main.js (compat ASCII) ===
// Icon auto-size by difficulty + score/combo/fever effects + centered modals + safe spawn

window.__HHA_BOOT_OK = true;

// Imports (ES modules)
import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { Engine } from './core/engine.js';
import { HUD } from './core/hud.js';
import { Coach } from './core/coach.js';
import { SFX } from './core/sfx.js';
import { ScoreSystem } from './core/score.js';
import { PowerUpSystem } from './core/powerup.js';

import * as goodjunk from './modes/goodjunk.js';
import * as groups from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate from './modes/plate.js';

// Helpers (ASCII only)
function $(s){ return document.querySelector(s); }
function byAction(el){ return (el && el.closest) ? el.closest('[data-action]') : null; }
function setText(sel, txt){ var el=$(sel); if(el) el.textContent = txt; }

// Config
var MODES = { goodjunk:goodjunk, groups:groups, hydration:hydration, plate:plate };
var DIFFS = {
  Easy:   { time:70, spawn:900, life:4200 },
  Normal: { time:60, spawn:700, life:3000 },
  Hard:   { time:50, spawn:550, life:1800 }
};
var ICON_SIZE_MAP = { Easy:92, Normal:72, Hard:58 };

var I18N = {
  EN:{ names:{goodjunk:'Good vs Junk', groups:'Food Groups', hydration:'Hydration', plate:'Healthy Plate'},
       diffs:{Easy:'Easy', Normal:'Normal', Hard:'Hard'} }
};
function T(lang){ return I18N.EN; }

// State & systems
var state = {
  modeKey:'goodjunk',
  difficulty:'Normal',
  running:false,
  paused:false,
  timeLeft:60,
  lang: localStorage.getItem('hha_lang') || 'EN',
  gfx:  localStorage.getItem('hha_gfx')  || 'quality',
  combo:0,
  bestCombo:0,
  fever:{ active:false, meter:0, drainPerSec:14, chargeGood:10, chargePerfect:20, threshold:100, mul:2, timeLeft:0 },
  spawnTimer:0, tickTimer:0,
  ctx:{}
};

var hud   = new HUD();
var sfx   = new SFX();
var score = new ScoreSystem();
var power = new PowerUpSystem();
var coach = new Coach({ lang: state.lang });
var eng   = new Engine(THREE, document.getElementById('c'));

// UI
function applyUI(){
  var L = T(state.lang);
  setText('#modeName',   (L.names[state.modeKey] || state.modeKey));
  setText('#difficulty', (L.diffs[state.difficulty] || state.difficulty));
}
function updateHUD(){
  if (hud.setScore) hud.setScore(score.score);
  if (hud.setTime)  hud.setTime(state.timeLeft);
  if (hud.setCombo) hud.setCombo('x' + state.combo);
}

// Fever UI
function setFeverBar(pct){
  var bar = $('#feverBar'); if (!bar) return;
  var clamped = Math.max(0, Math.min(100, pct|0));
  bar.style.width = clamped + '%';
}
function showFeverLabel(show){
  var f = $('#fever'); if (!f) return;
  f.style.display = show ? 'block' : 'none';
  if (show) f.classList.add('pulse'); else f.classList.remove('pulse');
}
function startFever(){
  if (state.fever.active) return;
  state.fever.active = true;
  state.fever.timeLeft = 7;
  showFeverLabel(true);
  try{ var au = $('#sfx-powerup'); if (au && au.play) au.play(); }catch(e){}
}
function stopFever(){
  state.fever.active = false;
  state.fever.timeLeft = 0;
  showFeverLabel(false);
}

// Score FX
function makeScoreBurst(x, y, text, minor, color){
  var el = document.createElement('div');
  el.className = 'scoreBurst';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  el.style.color = color || '#7fffd4';
  el.style.fontSize = '20px';
  el.textContent = text;
  if (minor) {
    var m = document.createElement('span');
    m.className = 'minor';
    m.textContent = minor;
    el.appendChild(m);
  }
  document.body.appendChild(el);
  setTimeout(function(){ try{ el.remove(); }catch(e){} }, 900);
}
function makeFlame(x, y, strong){
  var el = document.createElement('div');
  el.className = 'flameBurst' + (strong ? ' strong' : '');
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  document.body.appendChild(el);
  setTimeout(function(){ try{ el.remove(); }catch(e){} }, 900);
}
function scoreWithEffects(base, x, y){
  var comboMul = state.combo >= 20 ? 1.4 : (state.combo >= 10 ? 1.2 : 1.0);
  var feverMul = state.fever.active ? state.fever.mul : 1.0;
  var total = Math.round(base * comboMul * feverMul);
  if (score.add) score.add(total);
  var tag   = total >= 0 ? '+' + total : '' + total;
  var minor = (comboMul > 1 || feverMul > 1) ? ('x' + comboMul.toFixed(1) + (feverMul>1 ? ' & FEVER' : '')) : '';
  var color = total >= 0 ? (feverMul>1 ? '#ffd54a' : '#7fffd4') : '#ff9b9b';
  makeScoreBurst(x, y, tag, minor, color);
  if (state.fever.active) makeFlame(x, y, total >= 10);
}

// Combo
function addCombo(kind){
  if (kind === 'bad'){
    state.combo = 0;
    if (hud.setCombo) hud.setCombo('x0');
    return;
  }
  if (kind === 'good' || kind === 'perfect'){
    state.combo++;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    if (hud.setCombo) hud.setCombo('x' + state.combo);
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

// Spawn
function spawnOnce(diff){
  if (!state.running || state.paused) return;
  var mode = MODES[state.modeKey];
  var meta = (mode && mode.pickMeta) ? (mode.pickMeta(diff, state) || {}) : {};

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

  el.addEventListener('pointerenter', function(){ el.style.transform = 'scale(1.12)'; }, { passive:true });
  el.addEventListener('pointerleave', function(){ el.style.transform = 'scale(1)'; }, { passive:true });

  var header = $('header.brand');
  var headerH = (header && header.offsetHeight) ? header.offsetHeight : 56;
  var menu = $('#menuBar');
  var menuH = (menu && menu.offsetHeight) ? menu.offsetHeight : 120;
  var yMin = headerH + 60;
  var yMax = Math.max(yMin + 50, window.innerHeight - menuH - 80);
  var xMin = 20;
  var xMax = Math.max(xMin + 50, window.innerWidth - 80);
  el.style.left = (xMin + Math.random() * (xMax - xMin)) + 'px';
  el.style.top  = (yMin + Math.random() * (yMax - yMin)) + 'px';

  el.addEventListener('click', function(ev){
    ev.stopPropagation();
    try{
      var sys = { score:score, sfx:sfx, power:power, coach:coach, fx:(eng && eng.fx ? eng.fx : null) };
      var res = (mode && mode.onHit) ? (mode.onHit(meta, sys, state, hud) || 'ok') : (meta.good ? 'good' : 'ok');
      var r = el.getBoundingClientRect();
      var cx = r.left + r.width/2;
      var cy = r.top  + r.height/2;
      if (res === 'good' || res === 'perfect') addCombo(res);
      if (res === 'bad') addCombo('bad');
      var map = { good:7, perfect:14, ok:2, bad:-3, power:5 };
      var base = map.hasOwnProperty(res) ? map[res] : 1;
      scoreWithEffects(base, cx, cy);
      try{
        if (res === 'good' && sfx.good) sfx.good();
        else if (res === 'bad' && sfx.bad) sfx.bad();
      }catch(e){}
    }catch(e){
      console.error('[HHA] onHit error:', e);
    }finally{
      try{ el.remove(); }catch(e){}
    }
  }, { passive:true });

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

// Tick / Start / End
function tick(){
  if (!state.running || state.paused) return;
  if (state.fever.active){
    state.fever.timeLeft = Math.max(0, state.fever.timeLeft - 1);
    state.fever.meter = Math.max(0, state.fever.meter - state.fever.drainPerSec);
    setFeverBar(state.fever.meter);
    if (state.fever.timeLeft <= 0 || state.fever.meter <= 0) stopFever();
  }
  try{
    var mode = MODES[state.modeKey];
    if (mode && mode.tick) mode.tick(state, { score:score, sfx:sfx, power:power, coach:coach, fx:(eng && eng.fx ? eng.fx : null) }, hud);
  }catch(e){
    console.warn('[HHA] mode.tick error:', e);
  }
  state.timeLeft = Math.max(0, state.timeLeft - 1);
  updateHUD();
  if (state.timeLeft <= 0){ end(); return; }
  if (state.timeLeft <= 10){
    try{ var t = $('#sfx-tick'); if (t && t.play) t.play(); }catch(e){}
    document.body.classList.add('flash');
  }else{
    document.body.classList.remove('flash');
  }
  state.tickTimer = setTimeout(tick, 1000);
}
function start(){
  end(true);
  var diff = DIFFS[state.difficulty] || DIFFS.Normal;
  state.running = true; state.paused = false;
  state.timeLeft = diff.time;
  state.combo = 0; state.fever.meter = 0; setFeverBar(0); stopFever();
  if (score.reset) score.reset();
  updateHUD();
  try{
    var mode = MODES[state.modeKey];
    if (mode && mode.init) mode.init(state, hud, diff);
  }catch(e){
    console.error('[HHA] mode.init error:', e);
  }
  if (coach && coach.onStart) coach.onStart(state.modeKey);
  tick(); spawnLoop();
}
function end(silent){
  if (silent !== true) silent = false;
  state.running = false; state.paused = false;
  clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer);
  try{
    var mode = MODES[state.modeKey];
    if (mode && mode.cleanup) mode.cleanup(state, hud);
  }catch(e){}
  if (!silent){
    var modal = $('#result');
    if (modal) modal.style.display = 'flex';
    if (coach && coach.onEnd) coach.onEnd(score.score, { grade:'A' });
  }
}

// Events
document.addEventListener('pointerup', function(e){
  var btn = byAction(e.target); if (!btn) return;
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
  else if (a === 'help'){ var m1=$('#help'); if (m1) m1.style.display='flex'; }
  else if (a === 'helpClose'){ var m2=$('#help'); if (m2) m2.style.display='none'; }
  else if (a === 'helpScene'){ var hs1=$('#helpScene'); if (hs1) hs1.style.display='flex'; }
  else if (a === 'helpSceneClose'){ var hs2=$('#helpScene'); if (hs2) hs2.style.display='none'; }
}, { passive:true });

var langBtn = $('#langToggle');
if (langBtn){
  langBtn.addEventListener('click', function(){
    state.lang = state.lang === 'EN' ? 'EN' : 'EN';
    localStorage.setItem('hha_lang', state.lang);
    try{ coach.lang = state.lang; }catch(e){}
    applyUI();
  }, { passive:true });
}
var gfxBtn = $('#gfxToggle');
if (gfxBtn){
  gfxBtn.addEventListener('click', function(){
    state.gfx = state.gfx === 'low' ? 'quality' : 'low';
    localStorage.setItem('hha_gfx', state.gfx);
    try{
      if (eng && eng.renderer && eng.renderer.setPixelRatio){
        eng.renderer.setPixelRatio(state.gfx === 'low' ? 0.75 : (window.devicePixelRatio || 1));
      }
    }catch(e){}
  }, { passive:true });
}
window.addEventListener('pointerdown', function(){ try{ if (sfx.unlock) sfx.unlock(); }catch(e){} }, { once:true, passive:true });

// Boot
applyUI();
updateHUD();
