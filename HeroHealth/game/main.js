// === Hero Health Academy — main.js (stable) ===
// - Icon auto-size by difficulty
// - Score/combo/fever effects (popup + flame)
// - Centered modals
// - Safe spawn area (not under header/menu)

window.__HHA_BOOT_OK = true;

// ----- Imports -----
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

// ----- Helpers -----
const $ = (s) => document.querySelector(s);
const byAction = (el) => (el && el.closest ? el.closest('[data-action]') : null);
const setText = (sel, txt) => { const el = $(sel); if (el) el.textContent = txt; };

// ----- Config -----
const MODES = { goodjunk, groups, hydration, plate };
const DIFFS = {
  Easy:   { time: 70, spawn: 900, life: 4200 },
  Normal: { time: 60, spawn: 700, life: 3000 },
  Hard:   { time: 50, spawn: 550, life: 1800 }
};
const ICON_SIZE_MAP = { Easy: 92, Normal: 72, Hard: 58 };

const I18N = {
  TH:{
    names:{goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ'},
    diffs:{Easy:'ง่าย', Normal:'ปกติ', Hard:'ยาก'}
  },
  EN:{
    names:{goodjunk:'Good vs Junk', groups:'Food Groups', hydration:'Hydration', plate:'Healthy Plate'},
    diffs:{Easy:'Easy', Normal:'Normal', Hard:'Hard'}
  }
};
const T = (lang)=> I18N[lang] || I18N.TH;

// ----- State & Systems -----
const state = {
  modeKey: 'goodjunk',
  difficulty: 'Normal',
  running: false,
  paused: false,
  timeLeft: 60,
  lang: localStorage.getItem('hha_lang') || 'TH',
  gfx:  localStorage.getItem('hha_gfx')  || 'quality',
  combo: 0,
  bestCombo: 0,
  fever: { active:false, meter:0, drainPerSec:14, chargeGood:10, chargePerfect:20, threshold:100, mul:2, timeLeft:0 },
  spawnTimer: 0,
  tickTimer: 0,
  ctx: {}
};

const hud   = new HUD();
const sfx   = new SFX();
const score = new ScoreSystem();
const power = new PowerUpSystem();
const coach = new Coach({ lang: state.lang });
const eng   = new Engine(THREE, document.getElementById('c'));

// ----- UI Apply -----
function applyUI(){
  const L = T(state.lang);
  setText('#modeName',   (L.names[state.modeKey] || state.modeKey));
  setText('#difficulty', (L.diffs[state.difficulty] || state.difficulty));
}
function updateHUD(){
  hud.setScore?.(score.score);
  hud.setTime?.(state.timeLeft);
  hud.setCombo?.('x' + state.combo);
}

// ----- Fever UI -----
function setFeverBar(pct){
  const bar = $('#feverBar'); if (!bar) return;
  const clamped = Math.max(0, Math.min(100, pct|0));
  bar.style.width = clamped + '%';
}
function showFeverLabel(show){
  const f = $('#fever'); if (!f) return;
  f.style.display = show ? 'block' : 'none';
  if (show) f.classList.add('pulse'); else f.classList.remove('pulse');
}
function startFever(){
  if (state.fever.active) return;
  state.fever.active = true;
  state.fever.timeLeft = 7;
  showFeverLabel(true);
  try{ $('#sfx-powerup')?.play(); }catch{}
}
function stopFever(){
  state.fever.active = false;
  state.fever.timeLeft = 0;
  showFeverLabel(false);
}

// ----- Score FX (popup & flame) -----
function makeScoreBurst(x, y, text, minor, color){
  const el = document.createElement('div');
  el.className = 'scoreBurst';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  el.style.color = color || '#7fffd4';
  el.style.fontSize = '20px';
  el.textContent = text;
  if (minor) {
    const m = document.createElement('span');
    m.className = 'minor';
    m.textContent = minor;
    el.appendChild(m);
  }
  document.body.appendChild(el);
  setTimeout(()=>{ try{ el.remove(); }catch{} }, 900);
}
function makeFlame(x, y, strong){
  const el = document.createElement('div');
  el.className = 'flameBurst' + (strong ? ' strong' : '');
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  document.body.appendChild(el);
  setTimeout(()=>{ try{ el.remove(); }catch{} }, 900);
}

function scoreWithEffects(base, x, y){
  const comboMul = state.combo >= 20 ? 1.4 : (state.combo >= 10 ? 1.2 : 1.0);
  const feverMul = state.fever.active ? state.fever.mul : 1.0;
  const total = Math.round(base * comboMul * feverMul);

  score.add?.(total);

  const tag   = total >= 0 ? '+' + total : '' + total;
  const minor = (comboMul > 1 || feverMul > 1) ? ('x' + comboMul.toFixed(1) + (feverMul>1 ? ' & FEVER' : '')) : '';
  const color = total >= 0 ? (feverMul>1 ? '#ffd54a' : '#7fffd4') : '#ff9b9b';

  makeScoreBurst(x, y, tag, minor, color);
  if (state.fever.active) makeFlame(x, y, total >= 10);
}

// ----- Combo logic -----
function addCombo(kind){
  if (kind === 'bad'){
    state.combo = 0;
    hud.setCombo?.('x0');
    return;
  }
  if (kind === 'good' || kind === 'perfect'){
    state.combo++;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    hud.setCombo?.('x' + state.combo);

    if (!state.fever.active){
      const gain = (kind === 'perfect') ? state.fever.chargePerfect : state.fever.chargeGood;
      state.fever.meter = Math.min(100, state.fever.meter + gain);
      setFeverBar(state.fever.meter);
      if (state.fever.meter >= state.fever.threshold) startFever();
    } else {
      state.fever.timeLeft = Math.min(10, state.fever.timeLeft + 0.6);
    }
  }
}

// ----- Spawn -----
function spawnOnce(diff){
  if (!state.running || state.paused) return;

  const mode = MODES[state.modeKey];
  const meta = (mode && mode.pickMeta) ? (mode.pickMeta(diff, state) || {}) : {};

  const el = document.createElement('button');
  el.className = 'item';
  el.type = 'button';
  el.textContent = meta.char || '❓';

  const px = ICON_SIZE_MAP[state.difficulty] || 72;
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

  // Safe area (avoid header and menu)
  const headerH = ($('header.brand') && $('header.brand').offsetHeight) ? $('header.brand').offsetHeight : 56;
  const menuH   = ($('#menuBar') && $('#menuBar').offsetHeight) ? $('#menuBar').offsetHeight : 120;
  const yMin = headerH + 60;
  const yMax = Math.max(yMin + 50, window.innerHeight - menuH - 80);
  const xMin = 20;
  const xMax = Math.max(xMin + 50, window.innerWidth - 80);

  el.style.left = (xMin + Math.random() * (xMax - xMin)) + 'px';
  el.style.top  = (yMin + Math.random() * (yMax - yMin)) + 'px';

  el.addEventListener('click', function(ev){
    ev.stopPropagation();
    try{
      const sys = { score, sfx, power, coach, fx: eng?.fx };
      // Each mode should return: 'good' | 'ok' | 'bad' | 'perfect' | 'power'
      const res = (mode && mode.onHit) ? (mode.onHit(meta, sys, state, hud) || 'ok') : (meta.good ? 'good' : 'ok');

      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top  + r.height/2;

      if (res === 'good' || res === 'perfect') addCombo(res);
      if (res === 'bad') addCombo('bad');

      const base = ({ good:7, perfect:14, ok:2, bad:-3, power:5 })[res] || 1;
      scoreWithEffects(base, cx, cy);

      if (res === 'good'){ try{ sfx.good(); }catch{} }
      else if (res === 'bad'){ try{ sfx.bad(); }catch{} }
    }catch(e){
      // fail-safe
      console.error('[HHA] onHit error:', e);
    }finally{
      try{ el.remove(); }catch{}
    }
  }, { passive:true });

  document.body.appendChild(el);
  const ttl = meta.life || diff.life || 3000;
  setTimeout(function(){ try{ el.remove(); }catch{} }, ttl);
}

function spawnLoop(){
  if (!state.running || state.paused) return;
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  spawnOnce(diff);
  const next = Math.max(220, (diff.spawn || 700) * (power.timeScale || 1));
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
    const mode = MODES[state.modeKey];
    if (mode && mode.tick) mode.tick(state, { score, sfx, power, coach, fx: eng?.fx }, hud);
  }catch(e){
    console.warn('[HHA] mode.tick error:', e);
  }

  state.timeLeft = Math.max(0, state.timeLeft - 1);
  updateHUD();

  if (state.timeLeft <= 0){ end(); return; }
  if (state.timeLeft <= 10){
    try{ $('#sfx-tick')?.play()?.catch(()=>{}); }catch{}
    document.body.classList.add('flash');
  }else{
    document.body.classList.remove('flash');
  }

  state.tickTimer = setTimeout(tick, 1000);
}

function start(){
  end(true);
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  state.running   = true;
  state.paused    = false;
  state.timeLeft  = diff.time;
  state.combo     = 0;
  state.fever.meter = 0;
  setFeverBar(0);
  stopFever();
  score.reset?.();
  updateHUD();

  try{
    const mode = MODES[state.modeKey];
    if (mode && mode.init) mode.init(state, hud, diff);
  }catch(e){
    console.error('[HHA] mode.init error:', e);
  }

  coach.onStart?.(state.modeKey);
  tick();
  spawnLoop();
}

function end(silent){
  if (silent !== true) silent = false;
  state.running = false;
  state.paused = false;
  clearTimeout(state.tickTimer);
  clearTimeout(state.spawnTimer);
  try{ MODES[state.modeKey]?.cleanup?.(state, hud); }catch{}

  if (!silent){
    const modal = $('#result');
    if (modal) modal.style.display = 'flex';
    coach.onEnd?.(score.score, { grade: 'A' });
  }
}

// ----- Events -----
document.addEventListener('pointerup', function(e){
  const btn = byAction(e.target);
  if (!btn) return;
  const a = btn.getAttribute('data-action');
  const v = btn.getAttribute('data-value');

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
  else if (a === 'help'){ const m = $('#help'); if (m) m.style.display = 'flex'; }
  else if (a === 'helpClose'){ const m = $('#help'); if (m) m.style.display = 'none'; }
  else if (a === 'helpScene'){ const hs = $('#helpScene'); if (hs) hs.style.display = 'flex'; }
  else if (a === 'helpSceneClose'){ const hs = $('#helpScene'); if (hs) hs.style.display = 'none'; }
}, { passive:true });

// Top bar toggles
$('#langToggle')?.addEventListener('click', function(){
  state.lang = state.lang === 'TH' ? 'EN' : 'TH';
  localStorage.setItem('hha_lang', state.lang);
  coach.lang = state.lang;
  applyUI();
}, { passive:true });

$('#gfxToggle')?.addEventListener('click', function(){
  state.gfx = state.gfx === 'low' ? 'quality' : 'low';
  localStorage.setItem('hha_gfx', state.gfx);
  try{ eng.renderer.setPixelRatio(state.gfx === 'low' ? 0.75 : (window.devicePixelRatio || 1)); }catch{}
}, { passive:true });

// Unlock audio once
window.addEventListener('pointerdown', function(){ try{ sfx.unlock(); }catch{} }, { once:true, passive:true });

// ----- Boot -----
applyUI();
updateHUD();
