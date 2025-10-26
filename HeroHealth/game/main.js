// === Hero Health Academy — main.js (stable + usability upgrades) ===
// - Icon auto-size by difficulty (Easy biggest, Hard smallest)
// - Score popup + flame, Combo & Fever
// - Concurrency cap + anti-overlap spawn
// - Mobile haptics, freeze spawn, safe-area spawn
// - Centered modals, working Help/Result buttons
// - Pause on tab hidden, cleanup live items on end()

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

// Concurrency & anti-overlap
const MAX_ITEMS = 10;           // ของบนจอพร้อมกันสูงสุด
const LIVE = new Set();         // เก็บ element ที่ยังมีชีวิต

// ----- I18N (สั้น) -----
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

// ----- Systems & State -----
const hud   = new HUD();
const sfx   = new SFX();
const score = new ScoreSystem();
const power = new PowerUpSystem();
const canvas = document.getElementById('c');
const eng   = new Engine(THREE, canvas);
const coach = new Coach({ lang: localStorage.getItem('hha_lang') || 'TH' });

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
  ctx: {},
  // balance/analytics (เบา ๆ)
  stats: { good:0, perfect:0, ok:0, bad:0 },
  _accHist: [],
  freezeUntil: 0
};

// ----- Tiny toast -----
function toast(msg, ms=900){
  let el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  el.style.cssText = `
    position:fixed;left:50%;bottom:88px;transform:translateX(-50%) translateY(12px);
    background:#111c;color:#fff;border:1px solid #fff3;border-radius:12px;
    padding:8px 12px;z-index:140;opacity:0;transition:transform .25s,opacity .25s;
    font-weight:800;pointer-events:none;
  `;
  document.body.appendChild(el);
  requestAnimationFrame(()=>{ el.style.opacity='1'; el.style.transform='translateX(-50%) translateY(0)'; });
  setTimeout(()=>{
    el.style.opacity='0'; el.style.transform='translateX(-50%) translateY(12px)';
    setTimeout(()=>{ try{ el.remove(); }catch{} }, 280);
  }, ms);
}

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
  f.classList.toggle('pulse', !!show);
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
  el.style.cssText = `
    position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
    font:700 20px/1.2 ui-rounded,system-ui,Segoe UI,Arial; color:${color||'#7fffd4'};
    text-shadow:0 2px 6px #000c; z-index:120; pointer-events:none; opacity:0; translate:0 6px;
    transition:opacity .22s, translate .22s;
  `;
  el.textContent = text;
  if (minor) {
    const m = document.createElement('div');
    m.style.cssText = 'font:600 12px/1.2 ui-rounded,system-ui;opacity:.9';
    m.textContent = minor;
    el.appendChild(m);
  }
  document.body.appendChild(el);
  requestAnimationFrame(()=>{ el.style.opacity='1'; el.style.translate='0 0'; });
  setTimeout(()=>{ el.style.opacity='0'; el.style.translate='0 -8px'; setTimeout(()=>{ try{ el.remove(); }catch{} }, 220); }, 720);
}
function makeFlame(x, y, strong){
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
    width:${strong?72:56}px;height:${strong?72:56}px;border-radius:50%;
    background:radial-gradient(closest-side, #ffd54a, #ff6d00);
    mix-blend-mode:screen; filter:blur(8px) brightness(1.1); opacity:.9; z-index:110;
    pointer-events:none; animation:flamePop .5s ease-out forwards;
  `;
  document.body.appendChild(el);
  setTimeout(()=>{ try{ el.remove(); }catch{} }, 520);
}
(function injectKeyframes(){
  if (document.getElementById('flameKF')) return;
  const st = document.createElement('style'); st.id='flameKF';
  st.textContent = `
    @keyframes flamePop { from { transform:translate(-50%,-50%) scale(.7); opacity:.0;}
                           to   { transform:translate(-50%,-50%) scale(1.05); opacity:.0;} }
  `;
  document.head.appendChild(st);
})();

function scoreWithEffects(base, x, y){
  const comboMul = state.combo >= 20 ? 1.4 : (state.combo >= 10 ? 1.2 : 1.0);
  const feverMul = state.fever.active ? state.fever.mul : 1.0;
  const total = Math.round(base * comboMul * feverMul);

  score.add?.(total);

  const tag   = total >= 0 ? '+' + total : '' + total;
  const minor = (comboMul > 1 || feverMul > 1)
    ? ('x' + comboMul.toFixed(1) + (feverMul>1 ? ' & FEVER' : ''))
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

// ----- Spawn helpers (safe area + anti-overlap) -----
function safeBounds(){
  const headerH = ($('header.brand') && $('header.brand').offsetHeight) ? $('header.brand').offsetHeight : 56;
  const menuH   = ($('#menuBar') && $('#menuBar').offsetHeight) ? $('#menuBar').offsetHeight : 120;
  const yMin = headerH + 60;
  const yMax = Math.max(yMin + 50, window.innerHeight - menuH - 80);
  const xMin = 20;
  const xMax = Math.max(xMin + 50, window.innerWidth - 80);
  return { xMin, xMax, yMin, yMax };
}
function randPos(){
  const {xMin,xMax,yMin,yMax} = safeBounds();
  return { left: xMin + Math.random()*(xMax-xMin), top: yMin + Math.random()*(yMax-yMin) };
}
function overlapped(x,y){
  for (const n of LIVE){
    const r = n.getBoundingClientRect();
    const dx = (r.left + r.width/2) - x;
    const dy = (r.top  + r.height/2) - y;
    if (Math.hypot(dx,dy) < 64) return true; // กันชนรัศมี ~64px
  }
  return false;
}

// ----- Spawn -----
function spawnOnce(diff){
  if (!state.running || state.paused) return;

  // Freeze (จากโหมดที่ออกพลัง) — ระงับสแปวน์
  const now = performance?.now?.() || Date.now();
  if (state.freezeUntil && now < state.freezeUntil){
    state.spawnTimer = setTimeout(()=>spawnOnce(diff), 120);
    return;
  }

  // Concurrency cap
  if (LIVE.size >= MAX_ITEMS){
    state.spawnTimer = setTimeout(()=>spawnOnce(diff), 180);
    return;
  }

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
  el.style.padding = '8px';
  el.style.borderRadius = '14px';
  el.style.transition = 'transform .15s, filter .15s, opacity .15s';
  el.addEventListener('pointerenter', function(){ el.style.transform = 'scale(1.12)'; }, { passive:true });
  el.addEventListener('pointerleave', function(){ el.style.transform = 'scale(1)'; }, { passive:true });

  // anti-overlap position
  let pos = randPos(), tries = 0;
  while (tries++ < 12 && overlapped(pos.left, pos.top)) pos = randPos();
  el.style.left = pos.left + 'px';
  el.style.top  = pos.top  + 'px';

  el.addEventListener('click', function(ev){
    ev.stopPropagation();
    try{
      const sys = { score, sfx, power, coach, fx: eng?.fx };
      // Each mode should return: 'good' | 'ok' | 'bad' | 'perfect' | 'power'
      const res = (mode && mode.onHit) ? (mode.onHit(meta, sys, state, hud) || 'ok') : (meta.good ? 'good' : 'ok');

      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top  + r.height/2;

      // stats / combo
      state.stats[res] = (state.stats[res]||0) + 1;
      if (res === 'good' || res === 'perfect') addCombo(res);
      if (res === 'bad') addCombo('bad');

      // score fx
      const base = ({ good:7, perfect:14, ok:2, bad:-3, power:5 })[res] || 1;
      scoreWithEffects(base, cx, cy);

      // haptics
      if (navigator.vibrate){
        if (res==='bad') navigator.vibrate(60);
        else if (res==='perfect') navigator.vibrate([12,30,12]);
        else if (res==='good') navigator.vibrate(12);
      }

      if (res === 'good'){ try{ sfx.good(); }catch{} }
      else if (res === 'bad'){ try{ sfx.bad(); }catch{} }
    }catch(e){
      console.error('[HHA] onHit error:', e);
    }finally{
      try{ LIVE.delete(el); el.remove(); }catch{}
    }
  }, { passive:true });

  document.body.appendChild(el);
  LIVE.add(el);
  const ttl = meta.life || diff.life || 3000;
  setTimeout(function(){ try{ LIVE.delete(el); el.remove(); }catch{} }, ttl);
}

function spawnLoop(){
  if (!state.running || state.paused) return;

  const diff = DIFFS[state.difficulty] || DIFFS.Normal;

  // smooth adaptation by rolling accuracy
  const total = state.stats.good + state.stats.perfect + state.stats.ok + state.stats.bad;
  const accNow = total>0 ? (state.stats.good + state.stats.perfect)/total : 1;
  state._accHist.push(accNow); if (state._accHist.length>8) state._accHist.shift();
  const acc = state._accHist.reduce((s,x)=>s+x,0)/state._accHist.length;
  const tune = acc>0.88 ? 0.92 : acc<0.58 ? 1.10 : 1.00;

  // spawn & ttl adapt
  const dyn = {
    time: diff.time,
    spawn: Math.max(300, Math.round((diff.spawn||700) * tune)),
    life:  Math.max(900,  Math.round((diff.life ||3000) / tune))
  };

  spawnOnce(dyn);

  const next = Math.max(220, dyn.spawn * (power.timeScale || 1));
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
  state.stats     = { good:0, perfect:0, ok:0, bad:0 };
  state._accHist  = [];
  state.freezeUntil = 0;
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

function end(silent=false){
  state.running = false;
  state.paused = false;
  clearTimeout(state.tickTimer);
  clearTimeout(state.spawnTimer);
  try{ MODES[state.modeKey]?.cleanup?.(state, hud); }catch{}

  // cleanup all live items
  for (const n of Array.from(LIVE)){ try{ n.remove(); }catch{} LIVE.delete(n); }

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
    if (!state.paused){ tick(); spawnLoop(); toast(state.lang==='TH'?'▶ ต่อเกม':'▶ Resume'); }
    else { clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer); toast(state.lang==='TH'?'⏸ พักเกม':'⏸ Paused'); }
  }
  else if (a === 'restart'){ end(true); start(); }
  else if (a === 'help'){ const m = $('#help'); if (m) m.style.display = 'flex'; }
  else if (a === 'helpClose'){ const m = $('#help'); if (m) m.style.display = 'none'; }
  else if (a === 'helpScene'){ const hs = $('#helpScene'); if (hs) hs.style.display = 'flex'; }
  else if (a === 'helpSceneClose'){ const hs = $('#helpScene'); if (hs) hs.style.display = 'none'; }
}, { passive:true });

// Result modal actions
const resEl = $('#result');
if (resEl){
  resEl.addEventListener('click', (e)=>{
    const a = e.target.getAttribute('data-result');
    if (a==='replay'){ resEl.style.display='none'; start(); }
    if (a==='home'){ resEl.style.display='none'; end(true); }
  });
}

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

$('#soundToggle')?.addEventListener('click', function(){
  const on = localStorage.getItem('hha_sound') !== '0';
  const next = !on;
  localStorage.setItem('hha_sound', next ? '1' : '0');
  sfx.setEnabled?.(next);
  $('#soundToggle').textContent = next ? '🔊 เสียง: เปิด' : '🔇 เสียง: ปิด';
  if (next){ try{ sfx.play('sfx-good'); }catch{} }
}, { passive:true });

// Pause when tab hidden
document.addEventListener('visibilitychange', ()=>{
  if (document.hidden && state.running && !state.paused){
    state.paused = true;
    clearTimeout(state.tickTimer);
    clearTimeout(state.spawnTimer);
    toast(state.lang==='TH'?'⏸ พักอัตโนมัติ':'⏸ Auto-paused');
  }
});

// Unlock audio once
window.addEventListener('pointerdown', function(){ try{ sfx.unlock(); }catch{} }, { once:true, passive:true });

// ----- Boot -----
applyUI();
updateHUD();
