// === Hero Health Academy — main.js (stable) ===
window.__HHA_BOOT_OK = true;

// Imports
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

// ------- helpers -------
const $ = (s)=>document.querySelector(s);
const byAction = (el)=>el?.closest?.('[data-action]') || null;
const setText = (sel, txt)=>{ const el=$(sel); if(el) el.textContent = txt; };
const nowMS = ()=> (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now();

// Float text fallback
function spawnFloatText(x, y, text, color){
  const el = document.createElement('div');
  el.className = 'floatText';
  el.textContent = text;
  el.style.left = x+'px';
  el.style.top  = y+'px';
  if (color) el.style.color = color;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), 900);
}

// ------- config -------
const MODES = { goodjunk, groups, hydration, plate };
const DIFFS = {
  Easy:   { time:70, spawn:900, life:4200 },
  Normal: { time:60, spawn:700, life:3000 },
  Hard:   { time:50, spawn:550, life:1800 }
};

const I18N = {
  TH:{
    brand:'HERO HEALTH ACADEMY',
    score:'คะแนน', combo:'คอมโบ', time:'เวลา',
    target:'หมวด', quota:'โควตา', hydro:'สมดุลน้ำ',
    mode:'โหมด', diff:'ความยาก',
    modes:{goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ'},
    diffs:{Easy:'ง่าย', Normal:'ปกติ', Hard:'ยาก'},
    helpTitle:'วิธีเล่น',
    helpBody:{
      goodjunk:'เก็บอาหารดี (🥦🍎) หลีกเลี่ยงอาหารขยะ (🍔🍟🥤)\nกดไวได้ PERFECT • มีพาวเวอร์ ✖️2 / 🧊',
      groups:'ดู 🎯 เป้าบน HUD แล้วเก็บให้ตรงหมวด\nตรงเป้า = good, หมวดถูกแต่ไม่ตรงเป้า = ok, ผิดหมวด = bad\nมีพาวเวอร์: Dual / x2 / Freeze / Rotate',
      hydration:'รักษาแถบน้ำ 45–65%\nดื่ม 💧/🥛 = บวก, 🥤/☕ = ลบ • ขึ้น/ลงเกินโซนจะโดนหนักขึ้น',
      plate:'เติมโควตา: ธัญพืช2 ผัก2 โปรตีน1 ผลไม้1 นม1\nครบจาน = PERFECT • เกินโควตาโดน -เวลา'
    },
    summary:'สรุปผล',
  },
  EN:{
    brand:'HERO HEALTH ACADEMY',
    score:'Score', combo:'Combo', time:'Time',
    target:'Target', quota:'Quota', hydro:'Hydration',
    mode:'Mode', diff:'Difficulty',
    modes:{goodjunk:'Good vs Junk', groups:'5 Food Groups', hydration:'Hydration', plate:'Healthy Plate'},
    diffs:{Easy:'Easy', Normal:'Normal', Hard:'Hard'},
    helpTitle:'How to Play',
    helpBody:{
      goodjunk:'Collect healthy (🥦🍎), avoid junk (🍔🍟🥤)\nQuick tap = PERFECT • Power-ups: ✖️2 / 🧊',
      groups:'Follow 🎯 on HUD.\nOn-target = good, right-group-not-target = ok, wrong-group = bad\nPower-ups: Dual / x2 / Freeze / Rotate',
      hydration:'Keep hydration 45–65%.\n💧/🥛 increase, 🥤/☕ decrease • Outside zone -> heavier penalty',
      plate:'Fill quotas: Grain2 Veg2 Protein1 Fruit1 Dairy1\nPerfect plate = PERFECT • Overfill reduces time'
    },
    summary:'Summary',
  }
};
const T = (lang)=>I18N[lang]||I18N.TH;

// ------- systems -------
const hud = new HUD();
const sfx = new SFX();
const score = new ScoreSystem();
const power = new PowerUpSystem();
const coach = new Coach({ lang: localStorage.getItem('hha_lang') || 'TH' });
const eng = new Engine(THREE, document.getElementById('c'));

// ------- state -------
const state = {
  modeKey:'goodjunk',
  difficulty:'Normal',
  running:false,
  paused:false,
  timeLeft:60,
  lang: localStorage.getItem('hha_lang') || 'TH',
  gfx:  localStorage.getItem('hha_gfx') || 'quality',
  combo:0,
  bestCombo:0,
  fever:{ active:false, meter:0, drainPerSec:14, chargePerGood:10, chargePerPerfect:20, threshold:100, mul:2, timeLeft:0 },
  freezeUntil: 0,
  lastSpawnAt: 0,
  ctx:{},
  spawnTimer:0,
  tickTimer:0
};

// ------- fever/combo -------
function setFeverBar(pct){ const bar = $('#feverBar'); if (bar) bar.style.width = Math.max(0,Math.min(100,pct))+'%'; }
function showFeverLabel(show){ const f=$('#fever'); if (f){ f.style.display = show?'block':'none'; f.classList.toggle('pulse', !!show); } }
function startFever(){ if(state.fever.active) return; state.fever.active=true; state.fever.timeLeft=7; showFeverLabel(true); try{$('#sfx-powerup')?.play();}catch{} }
function stopFever(){ state.fever.active=false; state.fever.timeLeft=0; showFeverLabel(false); }

function addCombo(kind){
  if (kind==='bad'){
    state.combo = 0;
    hud.setCombo?.('x0');
    return;
  }
  if (kind==='good' || kind==='perfect'){
    state.combo++;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    hud.setCombo?.('x'+state.combo);
    if (!state.fever.active){
      state.fever.meter = Math.min(100, state.fever.meter + (kind==='perfect'?state.fever.chargePerPerfect:state.fever.chargePerGood));
      setFeverBar(state.fever.meter);
      if (state.fever.meter >= state.fever.threshold) startFever();
    }else{
      state.fever.timeLeft = Math.min(10, state.fever.timeLeft + 0.6);
    }
  }
}
function scoreWithEffects(base, x, y){
  const comboMul = state.combo>=20?1.4: state.combo>=10?1.2: 1.0;
  const feverMul = state.fever.active?state.fever.mul:1.0;
  const total = Math.round(base * comboMul * feverMul);
  score.add?.(total);
  const tag = total>=0?`+${total}`:`${total}`;
  const color = total>=0?'#7fffd4':'#ff9b9b';
  try{ eng.fx?.popText?.(tag,{color}); }catch{ spawnFloatText(x,y,tag,color); }
}

// ------- i18n/UI -------
function applyLang(){
  const L = T(state.lang);
  setText('#brandTitle', L.brand);
  setText('#t_score', L.score);
  setText('#t_combo', L.combo);
  setText('#t_time',  L.time);
  setText('#t_target',L.target);
  setText('#t_quota', L.quota);
  setText('#t_hydro', L.hydro);
  setText('#t_mode',  L.mode);
  setText('#t_diff',  L.diff);
  setText('#modeName', L.modes[state.modeKey] || state.modeKey);
  setText('#difficulty', L.diffs[state.difficulty] || state.difficulty);
  setText('#h_help', L.helpTitle);
  setText('#h_summary', L.summary);
}
function applyGFX(){
  try{
    eng.renderer.setPixelRatio(state.gfx==='low' ? 0.75 : (window.devicePixelRatio||1));
    document.body.classList.toggle('low-gfx', state.gfx==='low');
  }catch{}
  const L=T(state.lang);
  const btn=$('#gfxToggle'); if(btn) btn.textContent='🎛️ ' + (state.gfx==='low' ? 'กราฟิก: ประหยัด' : 'กราฟิก: ปกติ');
}
function applySound(){
  if (typeof sfx.setEnabled === 'function') sfx.setEnabled(true);
}
function updateHUD(){
  setText('#score', score.score|0);
  setText('#combo', 'x'+(state.combo|0));
  setText('#time',  state.timeLeft|0);
}
function modeHelpText(){
  const L = T(state.lang);
  return L.helpBody[state.modeKey] || '';
}
function buildHelpScene(){
  const L = T(state.lang);
  const icons = { goodjunk:'🥗', groups:'🍽️', hydration:'💧', plate:'🍱' };
  const body = $('#hs_body'); if(!body) return;
  body.innerHTML = Object.keys(L.modes).map(k=>{
    const title = L.modes[k];
    const howto = L.helpBody[k] || '';
    const ic = icons[k] || '📘';
    return `<div class="hs-card"><div class="hs-emoji">${ic}</div><h4>${title}</h4><div style="opacity:.9;white-space:pre-wrap">${howto}</div></div>`;
  }).join('');
}

// ------- gameplay -------
function spawnOnce(diff){
  if(!state.running || state.paused) return;

  const mode = MODES[state.modeKey];
  const meta = mode?.pickMeta?.(diff, state) || {};

  const el = document.createElement('button');
  el.className = 'item';
  el.type = 'button';
  el.textContent = meta.char || '❓';

  const sizeMap = { Easy:'88px', Normal:'68px', Hard:'54px' };
  el.style.fontSize = sizeMap[state.difficulty] || '68px';

  el.addEventListener('pointerenter', ()=> el.style.transform='scale(1.18)', {passive:true});
  el.addEventListener('pointerleave', ()=> el.style.transform='scale(1)',   {passive:true});

  // Safe area
  const headerH = $('header.brand')?.offsetHeight || 56;
  const menuH   = $('#menuBar')?.offsetHeight || 120;
  const yMin = headerH + 60, yMax = Math.max(yMin + 50, innerHeight - menuH - 80);
  const xMin = 20,           xMax = Math.max(xMin + 50, innerWidth  - 80);
  el.style.left = (xMin + Math.random()*(xMax-xMin)) + 'px';
  el.style.top  = (yMin + Math.random()*(yMax-yMin)) + 'px';

  el.addEventListener('click', (ev)=>{
    ev.stopPropagation();
    try{
      const sys = { score, sfx, power, coach, fx: eng.fx };
      // modes should return: 'good'|'ok'|'bad'|'perfect'|'power'
      const res = mode?.onHit?.(meta, sys, state, hud) || (meta.good ? 'good' : 'ok');

      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width/2;
      const y = rect.top  + rect.height/2;

      if (res==='good' || res==='perfect') addCombo(res);
      if (res==='bad') addCombo('bad');

      const baseMap = { good:7, perfect:14, ok:2, bad:-3, power:5 };
      const base = baseMap[res] ?? 1;

      // Special: Plate overfill removes time in plate.js; scoring centralized here
      scoreWithEffects(base, x, y);

      if (res==='perfect') { /* optional shake */ }
      if (state.fever.active) el.classList.add('feverHit');
    }catch(e){
      console.error('[HHA] onHit error:', e);
    }finally{
      el.remove();
    }
  }, {passive:true});

  document.body.appendChild(el);
  state.lastSpawnAt = nowMS();

  setTimeout(()=>{ try{ el.remove(); }catch{} }, meta.life || diff.life || 3000);
}

function spawnLoop(){
  if(!state.running || state.paused) return;

  const now = nowMS();
  // Freeze window (set by modes like goodjunk power FREEZE)
  if (state.freezeUntil && now < state.freezeUntil) {
    state.spawnTimer = setTimeout(spawnLoop, 120);
    return;
  }

  const diff = DIFFS[state.difficulty] || DIFFS.Normal;

  // Clamp timeScale and spawn interval
  const scale = Math.max(0.25, Math.min(3, power.timeScale || 1)); // 0.25x–3x
  const next  = Math.max(260, Math.min(2000, (diff.spawn || 700) * scale));

  spawnOnce(diff);

  // Watchdog: ensure something appears
  setTimeout(()=>{
    const t = nowMS();
    if (state.running && !state.paused && (t - state.lastSpawnAt > 2500)) {
      spawnOnce(diff);
    }
  }, 2500);

  state.spawnTimer = setTimeout(spawnLoop, next);
}

function tick(){
  if(!state.running || state.paused) return;

  // Fever drain
  if (state.fever.active){
    state.fever.timeLeft = Math.max(0, state.fever.timeLeft - 1);
    state.fever.meter = Math.max(0, state.fever.meter - state.fever.drainPerSec);
    setFeverBar(state.fever.meter);
    if (state.fever.timeLeft<=0 || state.fever.meter<=0) stopFever();
  }

  // per-mode tick
  try{ MODES[state.modeKey]?.tick?.(state, {score,sfx,power,coach,fx:eng.fx}, hud); }catch(e){ console.warn('[HHA] mode.tick:', e); }

  state.timeLeft = Math.max(0, state.timeLeft - 1);
  updateHUD();

  if (state.timeLeft <= 0){ end(); return; }
  if (state.timeLeft <= 10){ try{ $('#sfx-tick')?.play()?.catch(()=>{}); }catch{} }
  state.tickTimer = setTimeout(tick, 1000);
}

function start(){
  end(true);
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  state.running = true; state.paused=false;
  state.timeLeft = diff.time;
  state.combo=0; state.bestCombo=0;
  state.fever.meter=0; setFeverBar(0); stopFever();
  state.freezeUntil=0;
  score.reset?.(); updateHUD();

  // Hide non-used HUD blocks
  hud.hideHydration?.(); hud.hideTarget?.(); hud.hidePills?.();

  try{ MODES[state.modeKey]?.init?.(state, hud, diff); }catch(e){ console.error('[HHA] init:', e); }

  if(state.modeKey!=='hydration') hud.hideHydration?.();
  if(state.modeKey!=='groups' && state.modeKey!=='plate') hud.hideTarget?.();
  if(state.modeKey!=='plate') hud.hidePills?.();

  // Mission text (if a mode updates #missionLine itself it will override)
  const ml = $('#missionLine'); if (ml) ml.style.display='none';

  tick(); spawnLoop();
}

function end(silent=false){
  state.running=false; state.paused=false;
  clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer);
  try{ MODES[state.modeKey]?.cleanup?.(state, hud); }catch{}
  const ml = $('#missionLine'); if (ml) ml.style.display='none';
  if(!silent){ const m=$('#result'); if(m) m.style.display='flex'; }
}

// ------- events -------
document.addEventListener('pointerup', (e)=>{
  const btn = byAction(e.target); if(!btn) return;
  const a = btn.getAttribute('data-action');
  const v = btn.getAttribute('data-value');

  if (a==='mode'){ state.modeKey=v; applyLang(); if(state.running) start(); }
  else if (a==='diff'){ state.difficulty=v; applyLang(); if(state.running) start(); }
  else if (a==='start'){ start(); }
  else if (a==='pause'){
    if (!state.running){ start(); return; }
    state.paused = !state.paused;
    if (!state.paused){ tick(); spawnLoop(); }
    else { clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer); }
  }
  else if (a==='restart'){ end(true); start(); }
  else if (a==='help'){
    const help=$('#help'); const body=$('#helpBody');
    if(help && body){ body.textContent = modeHelpText(); help.style.display='flex'; }
  }
  else if (a==='helpClose'){ const m=$('#help'); if(m) m.style.display='none'; }
  else if (a==='helpScene'){ buildHelpScene(); const hs=$('#helpScene'
