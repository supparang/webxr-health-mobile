// Hero Health Academy - main.js (stable full build)
// Works with index.html (bootloader) and modes/* you posted
// Includes: Pause, Help Scene, Combo/Fever, adaptive icon size, centered modals, safe spawn area

window.__HHA_BOOT_OK = true;

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

// -------- Config --------
const MODES = { goodjunk, groups, hydration, plate };
const DIFFS = {
  Easy:   { time:70, spawn:900, life:4200 },
  Normal: { time:60, spawn:700, life:3000 },
  Hard:   { time:50, spawn:550, life:1800 }
};

const $ = (s)=>document.querySelector(s);
const byAction = (el)=>el?.closest?.('[data-action]') || null;

const i18n = {
  TH:{mode:'โหมด',diff:'ความยาก',score:'คะแนน',combo:'คอมโบ',time:'เวลา',
      names:{goodjunk:'ดี vs ขยะ',groups:'จาน 5 หมู่',hydration:'สมดุลน้ำ',plate:'จัดจานสุขภาพ'},
      diffs:{Easy:'ง่าย',Normal:'ปกติ',Hard:'ยาก'}},
  EN:{mode:'Mode',diff:'Difficulty',score:'Score',combo:'Combo',time:'Time',
      names:{goodjunk:'Good vs Trash',groups:'Food Groups',hydration:'Hydration',plate:'Healthy Plate'},
      diffs:{Easy:'Easy',Normal:'Normal',Hard:'Hard'}}
};
const T = (lang)=>i18n[lang]||i18n.TH;

// -------- State & Systems --------
const state = {
  modeKey:'goodjunk',
  difficulty:'Normal',
  running:false,
  paused:false,
  timeLeft:60,
  lang: localStorage.getItem('hha_lang') || 'TH',
  gfx:  localStorage.getItem('hha_gfx') || 'quality',
  ctx:{},
  ACTIVE:new Set()
};

const hud = new HUD();
const sfx = new SFX();
const score = new ScoreSystem();
const power = new PowerUpSystem();
let coach; try { coach = new Coach({lang: state.lang}); } catch { coach = {onStart(){},onEnd(){},say(){},lang:state.lang}; }
let eng;   try { eng = new Engine(THREE, document.getElementById('c')); } catch { eng = {}; }

// -------- Combo / Fever (central scoring FX) --------
state.combo = 0;
state.bestCombo = 0;
state.fever = { active:false, meter:0, drainPerSec:14, chargePerGood:10, chargePerPerfect:20, threshold:100, mul:2, timeLeft:0 };

function setFeverBar(pct){
  const bar = $('#feverBar'); if (!bar) return;
  bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
}
function showFeverLabel(show){
  const f = $('#fever'); if (!f) return;
  f.style.display = show ? 'block' : 'none';
  f.classList.toggle('pulse', !!show);
}
function screenShake(px=6, ms=180){
  const c = $('#c'); if (!c) return;
  c.classList.add('shake'); setTimeout(()=>c.classList.remove('shake'), ms);
}
function spawnFloatText(x, y, text){
  const el = document.createElement('div');
  el.className = 'floatText';
  el.textContent = text;
  el.style.left = x+'px';
  el.style.top  = y+'px';
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), 800);
}
function startFever(){
  if (state.fever.active) return;
  state.fever.active = true;
  state.fever.timeLeft = 7;
  showFeverLabel(true);
  try { $('#sfx-powerup')?.play(); } catch {}
  screenShake(8, 280);
}
function stopFever(){
  state.fever.active = false;
  state.fever.timeLeft = 0;
  showFeverLabel(false);
}
function addCombo(kind){
  if (kind === 'bad'){
    state.combo = 0;
    document.body.classList.add('shake');
    setTimeout(()=>document.body.classList.remove('shake'), 220);
    hud.setCombo?.('x0');
    return;
  }
  if (kind==='good' || kind==='perfect'){
    state.combo++;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    hud.setCombo?.('x'+state.combo);
    if (!state.fever.active){
      const add = (kind==='perfect') ? state.fever.chargePerPerfect : state.fever.chargePerGood;
      state.fever.meter = Math.min(100, state.fever.meter + add);
      setFeverBar(state.fever.meter);
      if (state.fever.meter >= state.fever.threshold) startFever();
    } else {
      state.fever.timeLeft = Math.min(10, state.fever.timeLeft + 0.6);
    }
  }
}
function scoreWithEffects(base, x, y){
  const comboMul = state.combo >= 20 ? 1.4 : state.combo >= 10 ? 1.2 : 1.0;
  const feverMul = state.fever.active ? state.fever.mul : 1.0;
  const total = Math.round(base * comboMul * feverMul);
  score.add?.(total);
  const tag = (feverMul>1 || comboMul>1) ? `+${total} ✦` : (total>=0?`+${total}`:`${total}`);
  const color = (feverMul>1 ? '#ffd54a' : (total>=0 ? '#7fffd4' : '#ff9b9b'));
  try { eng?.fx?.popText?.(tag, { color }); } catch { spawnFloatText(x, y, tag); }
}

// -------- UI --------
function applyUI(){
  const t = T(state.lang);
  $('#modeName').textContent = t.names[state.modeKey] || state.modeKey;
  $('#difficulty').textContent = t.diffs[state.difficulty] || state.difficulty;
}
function updateHUD(){
  hud.setScore?.(score.score);
  hud.setTime?.(state.timeLeft);
  hud.setCombo?.('x'+state.combo);
}

// -------- Flow --------
function start(){
  end(true);
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  state.running = true;
  state.paused = false;
  state.timeLeft = diff.time;
  state.combo = 0;
  state.fever.meter = 0; setFeverBar(0); stopFever();
  score.reset?.();

  try { MODES[state.modeKey]?.init?.(state, hud, diff); } catch(e){ console.error('[HHA] init error:', e); }
  coach.onStart?.(state.modeKey);
  updateHUD();
  tick();
  spawnLoop();
}

function end(silent=false){
  state.running = false;
  state.paused = false;
  clearTimeout(state.tickTimer);
  clearTimeout(state.spawnTimer);
  try { MODES[state.modeKey]?.cleanup?.(state, hud); } catch {}
  if (!silent){
    const result = $('#result');
    if (result){ result.style.display = 'flex'; }
    coach.onEnd?.(score.score, { grade:'A' });
  }
}

function spawnOnce(diff){
  if(!state.running || state.paused) return;
  const mode = MODES[state.modeKey];
  const meta = mode?.pickMeta?.(diff, state) || {};
  const el = document.createElement('button');
  el.className = 'item';
  el.type = 'button';
  el.textContent = meta.char || '❓';
  // adaptive size by difficulty
  const sizeMap = { Easy:'88px', Normal:'68px', Hard:'54px' };
  el.style.fontSize = sizeMap[state.difficulty] || '68px';
  el.style.lineHeight = 1;
  el.style.border = 'none';
  el.style.background = 'none';
  el.style.cursor = 'pointer';
  el.style.position = 'fixed';
  el.style.transition = 'transform .15s, filter .15s';
  el.style.zIndex = '80';

  // hover scale (fixed: remove extra ')')
  el.addEventListener('pointerenter', ()=> el.style.transform = 'scale(1.18)');
  el.addEventListener('pointerleave', ()=> el.style.transform = 'scale(1)');

  // safe area (avoid header & menu)
  const headerH = $('header.brand')?.offsetHeight || 56;
  const menuH   = $('#menuBar')?.offsetHeight || 120;
  const yMin = headerH + 60;
  const yMax = Math.max(yMin + 50, window.innerHeight - menuH - 80);
  const xMin = 20;
  const xMax = Math.max(xMin + 50, window.innerWidth - 80);

  el.style.left = (xMin + Math.random()*(xMax-xMin)) + 'px';
  el.style.top  = (yMin + Math.random()*(yMax-yMin)) + 'px';

  el.addEventListener('click', (ev)=>{
    ev.stopPropagation();
    try{
      const sys = { score, sfx, power, coach, fx: eng?.fx };
      // modes should return: 'good'|'ok'|'bad'|'perfect'|'power'
      const res = mode?.onHit?.(meta, sys, state, hud) || 'ok';

      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width/2;
      const y = rect.top  + rect.height/2;

      if (res==='good' || res==='perfect') addCombo(res);
      if (res==='bad') addCombo('bad');

      // base scores map (centralized)
      const base = { good:7, perfect:14, ok:2, bad:-3, power:5 }[res] ?? 1;
      scoreWithEffects(base, x, y);

      if (res==='perfect') screenShake(6, 200);
      if (state.fever.active) el.classList.add('feverHit');
    }catch(err){
      console.error('[HHA] onHit error:', err);
    }finally{
      el.remove();
    }
  }, { passive:true });

  document.body.appendChild(el);
  setTimeout(()=>{ try{ el.remove(); }catch{} }, meta.life || diff.life || 3000);
}

function spawnLoop(){
  if(!state.running || state.paused) return;
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  spawnOnce(diff);
  const next = Math.max(220, (diff.spawn || 700) * (power.timeScale || 1));
  state.spawnTimer = setTimeout(spawnLoop, next);
}

function tick(){
  if(!state.running || state.paused) return;

  // fever drain
  if (state.fever.active){
    state.fever.timeLeft = Math.max(0, state.fever.timeLeft - 1);
    state.fever.meter = Math.max(0, state.fever.meter - state.fever.drainPerSec);
    setFeverBar(state.fever.meter);
    if (state.fever.timeLeft<=0 || state.fever.meter<=0) stopFever();
  }

  // per-mode tick
  try{ MODES[state.modeKey]?.tick?.(state, {score,sfx,power,coach,fx:eng?.fx}, hud); }catch(e){ console.warn('[HHA] mode.tick:', e); }

  state.timeLeft = Math.max(0, state.timeLeft - 1);
  updateHUD();

  if (state.timeLeft <= 0){ end(); return; }
  if (state.timeLeft <= 10){
    try{ $('#sfx-tick')?.play()?.catch(()=>{}); } catch {}
  }
  state.tickTimer = setTimeout(tick, 1000);
}

// -------- Events --------
document.addEventListener('pointerup', (e)=>{
  const btn = byAction(e.target);
  if (!btn) return;
  const a = btn.getAttribute('data-action');
  const v = btn.getAttribute('data-value');

  if (a==='mode'){ state.modeKey = v; applyUI(); if (state.running) start(); }
  else if (a==='diff'){ state.difficulty = v; applyUI(); if (state.running) start(); }
  else if (a==='start'){ start(); }
  else if (a==='pause'){
    if (!state.running){ start(); return; }
    state.paused = !state.paused;
    if (!state.paused){ tick(); spawnLoop(); }
    else { clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer); }
  }
  else if (a==='restart'){ end(true); start(); }
  else if (a==='help'){ const m = $('#help'); if (m) m.style.display='flex'; }
  else if (a==='helpClose'){ const m = $('#help'); if (m) m.style.display='none'; }
  else if (a==='helpScene'){ const hs = $('#helpScene'); if (hs) hs.style.display='flex'; }
  else if (a==='helpSceneClose'){ const hs = $('#helpScene'); if (hs) hs.style.display='none'; }
}, { passive:true });

// Top bar toggles
$('#langToggle')?.addEventListener('click', ()=>{
  state.lang = state.lang==='TH' ? 'EN' : 'TH';
  localStorage.setItem('hha_lang', state.lang);
  if (coach) coach.lang = state.lang;
  applyUI();
}, { passive:true });

$('#gfxToggle')?.addEventListener('click', ()=>{
  state.gfx = state.gfx==='low' ? 'quality' : 'low';
  localStorage.setItem('hha_gfx', state.gfx);
  try { eng?.renderer?.setPixelRatio?.(state.gfx==='low' ? 0.75 : (window.devicePixelRatio||1)); } catch {}
}, { passive:true });

// unlock audio once
window.addEventListener('pointerdown', ()=>sfx.unlock?.(), { once:true, passive:true });

// Boot UI
applyUI();
updateHUD();
