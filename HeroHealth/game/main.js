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

window.__HHA_BOOT_OK = true;

const MODES = { goodjunk, groups, hydration, plate };
const DIFFS = {
  Easy:   { time:70, spawn:900, life:4200 },
  Normal: { time:60, spawn:700, life:3000 },
  Hard:   { time:50, spawn:550, life:1800 }
};

const state = {
  modeKey: 'goodjunk',
  difficulty: 'Normal',
  running: false,
  timeLeft: 60,
  lang: localStorage.getItem('hha_lang') || 'TH',
  gfx: localStorage.getItem('hha_gfx') || 'quality',
  ACTIVE: new Set(),
  ctx: {}
};

const hud = new HUD();
const sfx = new SFX();
const score = new ScoreSystem();
const power = new PowerUpSystem();
const coach = new Coach({ lang: state.lang });
const eng = new Engine(THREE, document.getElementById('c'));

const $ = (s)=>document.querySelector(s);
const byAction=(el)=>el?.closest('[data-action]');

function applyUI() {
  // ป้ายโหมด/ยาก
  const modeNameMap = {
    goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ'
  };
  $('#modeName').textContent = modeNameMap[state.modeKey] || state.modeKey;
  $('#difficulty').textContent = {Easy:'ง่าย',Normal:'ปกติ',Hard:'ยาก'}[state.difficulty] || state.difficulty;
}

function hideNonModeHUD() {
  hud.hideHydration(); hud.hideTarget(); hud.hidePills();
}

function updateHUD(){
  hud.setScore(score.score);
  hud.setCombo(score.combo);
  hud.setTime(state.timeLeft);
}

function clearTimers(){
  clearTimeout(state.spawnTimer);
  clearTimeout(state.tickTimer);
}

function start(){
  end(true);
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  state.running = true;
  state.timeLeft = diff.time;
  state.ctx = { hits:0, perfectPlates:0, hyd:50 };
  score.reset();
  hideNonModeHUD();
  MODES[state.modeKey].init?.(state, hud, diff);
  if(state.modeKey!=='hydration') hud.hideHydration();
  if(state.modeKey!=='groups' && state.modeKey!=='plate') hud.hideTarget();
  if(state.modeKey!=='plate') hud.hidePills();
  coach.onStart(state.modeKey);
  updateHUD();
  tick(); spawnLoop();
}

function end(silent=false){
  state.running = false;
  clearTimers();
  hideNonModeHUD();
  if(!silent){
    $('#result').style.display = 'flex';
    coach.onEnd(score.score,{grade:'A',accuracyPct:95});
  }
}

function spawnOnce(diff){
  // ใช้โหมดปัจจุบันจริง ๆ (ไม่ตกไปโหมด default)
  const mode = MODES[state.modeKey];
  if(!mode){ console.warn('Unknown mode:', state.modeKey); return; }

  const meta = mode.pickMeta(diff, state);
  const el = document.createElement('button');
  el.className = 'item';
  el.textContent = meta.char || '?';
  el.style.left = (10 + Math.random()*80) + 'vw';
  el.style.top  = (20 + Math.random()*60) + 'vh';

  el.addEventListener('click', (ev)=>{
    ev.stopPropagation();
    mode.onHit(meta, {score, sfx, power}, state, hud);
    state.ctx.hits = (state.ctx.hits||0) + 1;
    el.remove();
  }, {passive:true});

  document.body.appendChild(el);
  setTimeout(()=>el.remove(), diff.life);
}

function spawnLoop(){
  if(!state.running) return;
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  spawnOnce(diff);
  const next = Math.max(220, diff.spawn * power.timeScale);
  state.spawnTimer = setTimeout(spawnLoop, next);
}

function tick(){
  if(!state.running) return;
  state.timeLeft--;
  updateHUD();
  if(state.timeLeft<=0){ end(); return; }
  if(state.timeLeft<=10){
    try{ document.getElementById('sfx-tick').play(); }catch{}
  }
  state.tickTimer = setTimeout(tick, 1000);
}

/* ---------- Event Binding (แน่นหนา) ---------- */
document.addEventListener('pointerup', (e)=>{
  const btn = byAction(e.target);
  if(!btn) return;
  const a = btn.getAttribute('data-action');
  const v = btn.getAttribute('data-value');

  if(a==='mode'){
    state.modeKey = v; applyUI();
  } else if(a==='diff'){
    state.difficulty = v; applyUI();
  } else if(a==='start'){
    start();
  } else if(a==='pause'){
    state.running = !state.running;
  } else if(a==='restart'){
    end(true); start();
  } else if(a==='help'){
    $('#help').style.display = 'block';
  } else if(a==='helpClose'){
    $('#help').style.display = 'none';
  }
}, {passive:true});

document.getElementById('result').addEventListener('click',(e)=>{
  const a = e.target.getAttribute('data-result');
  if(a==='replay'){ e.currentTarget.style.display='none'; start(); }
  if(a==='home'){ e.currentTarget.style.display='none'; }
}, {passive:true});

// toggle เสริม
$('#langToggle')?.addEventListener('click',()=>{
  state.lang = state.lang==='TH' ? 'EN' : 'TH';
  localStorage.setItem('hha_lang', state.lang);
  coach.lang = state.lang;
}, {passive:true});

$('#gfxToggle')?.addEventListener('click',()=>{
  state.gfx = state.gfx==='low' ? 'quality' : 'low';
  localStorage.setItem('hha_gfx', state.gfx);
  eng.renderer.setPixelRatio(state.gfx==='low' ? 0.75 : (window.devicePixelRatio||1));
}, {passive:true});

/* ---------- Boot ---------- */
window.addEventListener('pointerdown', ()=>sfx.unlock(), {once:true, passive:true});
applyUI();
updateHUD();
