// === Hero Health Academy — main.js (ASCII-safe build) ===
// All non-ASCII (Thai/emoji) are encoded as \uXXXX/\u{...} to avoid encoding parse issues.

'use strict';
window.__HHA_BOOT_OK = true;

// ----- Imports -----
import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { Engine } from './core/engine.js';
import { HUD } from './core/hud.js';
import { Coach } from './core/coach.js';
import { SFX } from './core/sfx.js';
import { ScoreSystem } from './core/score.js';
import { PowerUpSystem } from './core/powerup.js';

// Modes
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
  Hard:   { time: 50, spawn: 560, life: 1900 }
};
const ICON_SIZE_MAP = { Easy: 92, Normal: 74, Hard: 58 };

// i18n (Thai strings encoded)
const I18N = {
  TH: {
    names: {
      goodjunk:'\u0E14\u0E35 vs \u0E02\u0E22\u0E30',
      groups:'\u0E08\u0E32\u0E19 5 \u0E2B\u0E21\u0E39\u0E48',
      hydration:'\u0E2A\u0E21\u0E14\u0E38\u0E25\u0E19\u0E49\u0E33',
      plate:'\u0E08\u0E31\u0E14\u0E08\u0E32\u0E19\u0E2A\u0E38\u0E02\u0E20\u0E32\u0E1E'
    },
    diffs: { Easy:'\u0E07\u0E48\u0E32\u0E22', Normal:'\u0E1B\u0E01\u0E15\u0E34', Hard:'\u0E22\u0E32\u0E01' },
    help: {
      goodjunk:
        '\u0E42\u0E2B\u0E14: \u0E14\u0E35 vs \u0E02\u0E22\u0E30\n- \u0E41\u0E15\u0E30/\u0E04\u0E25\u0E34\u0E01\u0E40\u0E01\u0E47\u0E1A\u0E2D\u0E32\u0E2B\u0E32\u0E23\u0E14\u0E35 (\uD83C\uDF66 \uD83C\uDF4E)\n- \u0E2B\u0E25\u0E35\u0E01\u0E40\u0E25\u0E35\u0E48\u0E22\u0E07\u0E02\u0E2D\u0E07\u0E02\u0E22\u0E30 (\uD83C\uDF54 \uD83C\uDF5F \uD83E\uDD64)\n- \u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E2A\u0E30\u0E2A\u0E21\u0E04\u0E2D\u0E21\u0E42\u0E1A\u0E41\u0E25\u0E30 FEVER',
      groups:
        '\u0E42\u0E2B\u0E14: \u0E08\u0E32\u0E19 5 \u0E2B\u0E21\u0E39\u0E48\n- \u0E14\u0E39\u0E40\u0E1B\u0E49\u0E32\u0E2B\u0E21\u0E32\u0E22\u0E43\u0E19 HUD (\uD83C\uDFAF) \u0E41\u0E25\u0E49\u0E27\u0E40\u0E01\u0E47\u0E1A\u0E43\u0E2B\u0E49\u0E15\u0E23\u0E07\u0E2B\u0E21\u0E27\u0E14\n- \u0E15\u0E23\u0E07\u0E40\u0E1B\u0E49\u0E32 +7, \u0E16\u0E39\u0E01\u0E2B\u0E21\u0E27\u0E14\u0E41\u0E15\u0E48\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E40\u0E1B\u0E49\u0E32 +2, \u0E1C\u0E34\u0E14 -2\n- \u0E17\u0E33\u0E20\u0E32\u0E23\u0E01\u0E34\u0E08\u0E43\u0E19 45s',
      hydration:
        '\u0E42\u0E2B\u0E14: \u0E2A\u0E21\u0E14\u0E38\u0E25\u0E19\u0E49\u0E33\n- \u0E23\u0E31\u0E01\u0E29\u0E32 45\u201365%\n- \uD83D\uDCA7/\uD83E\uDD5B \u0E40\u0E1E\u0E34\u0E48\u0E21 %, \uD83E\uDD64/\u2615 \u0E25\u0E14 %\n- \u0E08\u0E1A\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22\u0E43\u0E19\u0E0A\u0E48\u0E27\u0E07\u0E44\u0E14\u0E49\u0E04\u0E30\u0E41\u0E19\u0E19\u0E14\u0E35\u0E01\u0E27\u0E48\u0E32',
      plate:
        '\u0E42\u0E2B\u0E14: \u0E08\u0E31\u0E14\u0E08\u0E32\u0E19\u0E2A\u0E38\u0E02\u0E20\u0E32\u0E1E\n- \u0E42\u0E04\u0E27\u0E15\u0E32: Grain2 Veg2 Protein1 Fruit1 Dairy1\n- \u0E04\u0E23\u0E1A\u0E0A\u0E38\u0E14\u0E44\u0E14\u0E49\u0E42\u0E1A\u0E19\u0E31\u0E2A, \u0E40\u0E01\u0E34\u0E19\u0E42\u0E04\u0E27\u0E15\u0E32\u0E25\u0E1A\u0E40\u0E27\u0E25\u0E32'
    }
  },
  EN: {
    names: { goodjunk:'Good vs Junk', groups:'Food Groups', hydration:'Hydration', plate:'Healthy Plate' },
    diffs: { Easy:'Easy', Normal:'Normal', Hard:'Hard' },
    help: {
      goodjunk:'Mode: Good vs Junk\n- Click/Tap healthy food (e.g., \\u{1F966} \\u{1F34E})\n- Avoid junk (e.g., \\u{1F354} \\u{1F35F} \\u{1F964})\n- Keep streak to build combo and FEVER',
      groups:'Mode: Food Groups\n- Follow the target (\\u{1F3AF}) shown on HUD\n- On target +7, right group (not target) +2, wrong -2\n- Finish mission in 45s',
      hydration:'Mode: Hydration\n- Keep the bar in 45–65%\n- \\u{1F4A7}/\\u{1F95B} increase %, \\u{1F964}/\\u2615 decrease %\n- Ending in-zone yields better score',
      plate:'Mode: Healthy Plate\n- Fill quotas: Grain2 Veg2 Protein1 Fruit1 Dairy1\n- Perfect gives bonus, overfill reduces time'
    }
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
  ctx: { hits:0, miss:0 }
};

const hud   = new HUD();
const sfx   = new SFX();
const score = new ScoreSystem();
const power = new PowerUpSystem();
const coach = new Coach({ lang: state.lang });
const eng   = new Engine(THREE, document.getElementById('c'));

// ----- Boot chip (bottom-right) -----
(function(){
  const chip = document.createElement('div');
  chip.id = 'bootChip';
  chip.textContent = '\u2705 JS Loaded';
  chip.style.cssText = 'position:fixed;right:10px;bottom:10px;background:#0a0;color:#fff;font:600 12px/1.6 system-ui;padding:6px 10px;border-radius:999px;z-index:1001;box-shadow:0 2px 8px rgba(0,0,0,.25)';
  document.body.appendChild(chip);
})();

// ----- UI Apply -----
function applyUI(){
  const L = T(state.lang);
  setText('#modeName',   (L.names[state.modeKey] || state.modeKey));
  setText('#difficulty', (L.diffs[state.difficulty] || state.difficulty));
  const helpBody = $('#helpBody');
  if (helpBody) helpBody.textContent = (L.help[state.modeKey] || '');
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
  el.style.position = 'fixed';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  el.style.transform = 'translate(-50%, -50%)';
  el.style.zIndex = '999';
  el.style.color = color || '#7fffd4';
  el.style.fontSize = '20px';
  el.style.fontWeight = '800';
  el.style.textShadow = '0 2px 6px rgba(0,0,0,0.35)';
  el.style.pointerEvents = 'none';
  el.textContent = text;
  if (minor) {
    const m = document.createElement('div');
    m.style.fontSize = '12px';
    m.style.opacity = '0.9';
    m.textContent = minor;
    el.appendChild(m);
  }
  document.body.appendChild(el);
  requestAnimationFrame(()=>{
    el.style.transition = 'transform .6s ease-out, opacity .6s ease-out';
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%, -90%)';
    setTimeout(()=>{ try{ el.remove(); }catch{} }, 650);
  });
}
function makeFlame(x, y, strong){
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  el.style.transform = 'translate(-50%, -50%)';
  el.style.width = strong ? '38px' : '28px';
  el.style.height = el.style.width;
  el.style.borderRadius = '50%';
  el.style.background = 'radial-gradient(circle at 50% 50%, rgba(255,180,40,.95), rgba(255,80,20,.7) 60%, rgba(0,0,0,0) 70%)';
  el.style.filter = 'blur(0.4px) drop-shadow(0 0 10px rgba(255,120,0,.8))';
  el.style.zIndex = '998';
  el.style.pointerEvents = 'none';
  document.body.appendChild(el);
  requestAnimationFrame(()=>{
    el.style.transition = 'transform .7s ease-out, opacity .7s ease-out';
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%, -110%) scale(1.2)';
    setTimeout(()=>{ try{ el.remove(); }catch{} }, 720);
  });
}

function scoreWithEffects(base, x, y){
  const comboMul = state.combo >= 20 ? 1.4 : (state.combo >= 10 ? 1.2 : 1.0);
  const feverMul = state.fever.active ? state.fever.mul : 1.0;
  const total = Math.round(base * comboMul * feverMul);
  score.add?.(total);
  const tag   = total >= 0 ? '+' + total : '' + total;
  const minor = (comboMul > 1 || feverMul > 1)
    ? ('x' + comboMul.toFixed(1) + (feverMul>1 ? ' FEVER' : ''))
    : '';
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
  el.textContent = meta.char || '?';
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

  // Safe area
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
      const res = (mode && mode.onHit) ? (mode.onHit(meta, sys, state, hud) || 'ok') : (meta.good ? 'good' : 'ok');
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top  + r.height/2;
      if (res === 'good' || res === 'perfect') addCombo(res);
      if (res === 'bad') addCombo('bad');
      const base = ({ good:7, perfect:14, ok:2, bad:-3, power:5 })[res] || 1;
      scoreWithEffects(base, cx, cy);
      if (res === 'good'){ try{ sfx.good(); }catch{} } else if (res === 'bad'){ try{ sfx.bad(); }catch{} }
    }catch(e){
      console.error('[HHA] onHit error:', e);
    }finally{
      try{ el.remove(); }catch{}
      state.ctx.hits = (state.ctx.hits || 0) + 1;
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
  const accel = Math.max(0.7, 1 - (score.score / 500));
  const next = Math.max(220, (diff.spawn || 700) * accel * (power.timeScale || 1));
  state.spawnTimer = setTimeout(spawnLoop, next);
}

// ----- Tick / Start / End -----
function tick(){
  if (!state.running || state.paused) return;
  if (state.fever.active){
    state.fever.timeLeft = Math.max(0, state.fever.timeLeft - 1);
    state.fever.meter = Math.max(0, state.fever.meter - state.fever.drainPerSec);
    setFeverBar(state.fever.meter);
    if (state.fever.timeLeft <= 0 || state.fever.meter <= 0) stopFever();
  }
  try{
    const mode = MODES[state.modeKey];
    if (mode && mode.tick) mode.tick(state, { score, sfx, power, coach, fx: eng?.fx }, hud);
  }catch(e){ console.warn('[HHA] mode.tick error:', e); }
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
  }catch(e){ console.error('[HHA] mode.init error:', e); }
  coach.onStart?.(state.modeKey);
  applyUI();
  tick(); spawnLoop();
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
  else if (a === 'help'){ const m = $('#help'); if (m) { applyUI(); m.style.display = 'flex'; } }
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
