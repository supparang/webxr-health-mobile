// Hero Health Academy - main.js (hardened)
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

const MODES = { goodjunk, groups, hydration, plate };
const DIFFS = {
  Easy:   { time: 70, spawn: 900, life: 4200 },
  Normal: { time: 60, spawn: 700, life: 3000 },
  Hard:   { time: 50, spawn: 550, life: 1800 }
};

const $ = (s)=>document.querySelector(s);
const byAction = (el)=>el?.closest?.('[data-action]');

const i18n = {
  TH: {
    mode: 'โหมด', diff: 'ความยาก', score: 'คะแนน', combo: 'คอมโบ', time: 'เวลา',
    helpTitle: 'วิธีเล่น',
    helpBody: 'เลือกโหมด → เก็บสิ่งที่ถูกต้อง → หลีกเลี่ยงกับดัก',
    replay: 'เล่นอีกครั้ง', home: 'หน้าหลัก',
    names: { goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ' },
    diffs: { Easy:'ง่าย', Normal:'ปกติ', Hard:'ยาก' }
  },
  EN: {
    mode: 'Mode', diff: 'Difficulty', score: 'Score', combo: 'Combo', time: 'Time',
    helpTitle: 'How to Play',
    helpBody: 'Pick a mode → Collect correct items → Avoid traps',
    replay: 'Replay', home: 'Home',
    names: { goodjunk:'Good vs Trash', groups:'Food Groups', hydration:'Hydration', plate:'Healthy Plate' },
    diffs: { Easy:'Easy', Normal:'Normal', Hard:'Hard' }
  }
};

const state = {
  modeKey: 'goodjunk',
  difficulty: 'Normal',
  running: false,
  paused: false,
  timeLeft: 60,
  lang: localStorage.getItem('hha_lang') || 'TH',
  gfx: localStorage.getItem('hha_gfx') || 'quality',
  ACTIVE: new Set(),
  ctx: {},
  spawnTimer: null,
  tickTimer: null
};

const hud   = new HUD();
const sfx   = new SFX();
const score = new ScoreSystem();
const power = new PowerUpSystem();
const coach = new Coach?.({ lang: state.lang }) ?? { onStart(){}, onEnd(){}, lang:state.lang };
const eng   = new Engine?.(THREE, document.getElementById('c')) ?? {};

function t(){ return i18n[state.lang] || i18n.TH; }
function safeTimeScale(){ return Number.isFinite(power?.timeScale) && power.timeScale>0 ? power.timeScale : 1; }

function applyLang(){
  // HUD labels
  $('#t_score')?.replaceChildren(t().score);
  $('#t_combo')?.replaceChildren(t().combo);
  $('#t_time')?.replaceChildren(t().time);
  // mode/diff labels/values
  $('#t_mode')?.replaceChildren(t().mode);
  $('#t_diff')?.replaceChildren(t().diff);
  $('#modeName')?.replaceChildren(t().names[state.modeKey] || state.modeKey);
  $('#difficulty')?.replaceChildren(t().diffs[state.difficulty] || state.difficulty);
  // help modal
  $('#h_help')?.replaceChildren(t().helpTitle);
  $('#helpBody')?.replaceChildren(t().helpBody);
  $('#btn_replay')?.replaceChildren('↻ ' + t().replay);
  $('#btn_home')?.replaceChildren('🏠 ' + t().home);
}

function applyUI(){
  $('#modeName').textContent = (t().names[state.modeKey] || state.modeKey);
  $('#difficulty').textContent = (t().diffs[state.difficulty] || state.difficulty);
}

function hideNonModeHUD(){
  hud.hideHydration?.();
  hud.hideTarget?.();
  hud.hidePills?.();
}

function updateHUD(){
  hud.setScore?.(score.score);
  hud.setCombo?.(score.combo);
  hud.setTime?.(state.timeLeft);
}

function clearTimers(){
  if (state.spawnTimer){ clearTimeout(state.spawnTimer); state.spawnTimer = null; }
  if (state.tickTimer){ clearTimeout(state.tickTimer); state.tickTimer = null; }
}

function pauseGame(){
  if(!state.running || state.paused) return;
  state.paused = true;
  clearTimers();
}

function resumeGame(){
  if(!state.running || !state.paused) return;
  state.paused = false;
  tick();
  spawnLoop();
}

function start(){
  end(true);
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  state.running = true;
  state.paused = false;
  state.timeLeft = diff.time;
  state.ctx = { hits:0, perfectPlates:0, hyd:50 };
  score.reset?.();
  hideNonModeHUD();

  const mode = MODES[state.modeKey];
  mode?.init?.(state, hud, diff);

  if(state.modeKey!=='hydration') hud.hideHydration?.();
  if(state.modeKey!=='groups' && state.modeKey!=='plate') hud.hideTarget?.();
  if(state.modeKey!=='plate') hud.hidePills?.();

  coach.onStart?.(state.modeKey);
  updateHUD();
  tick();
  spawnLoop();

  // ปรับคุณภาพเรนเดอร์
  try{
    if(eng?.renderer){
      eng.renderer.setPixelRatio(state.gfx==='low' ? 0.75 : (window.devicePixelRatio||1));
    }
  }catch{}
}

function end(silent=false){
  const wasRunning = state.running;
  state.running = false;
  state.paused = false;
  clearTimers();
  hideNonModeHUD();
  if(wasRunning && !silent){
    const resEl = $('#result');
    if(resEl) resEl.style.display = 'flex';
    coach.onEnd?.(score.score,{ grade:'A', accuracyPct:95 });
  }
}

function spawnOnce(diff){
  if(!state.running || state.paused) return;

  const mode = MODES[state.modeKey];
  if(!mode){ console.warn('[HHA] Unknown mode:', state.modeKey); return; }

  const meta = mode.pickMeta?.(diff, state) || {};
  const el = document.createElement('button');
  el.className = 'item';
  el.type = 'button';
  el.textContent = meta.char || '❓';
  el.style.left = (10 + Math.random()*80) + 'vw';
  el.style.top  = (20 + Math.random()*60) + 'vh';

  el.addEventListener('click', (ev)=>{
    ev.stopPropagation();
    try{
      mode.onHit?.(meta, {score, sfx, power}, state, hud);
      state.ctx.hits = (state.ctx.hits||0) + 1;
      el.remove();
    }catch(err){
      console.error('[HHA] onHit error:', err);
      el.remove();
    }
  }, {passive:true});

  document.body.appendChild(el);
  setTimeout(()=>el.remove(), diff.life);
}

function spawnLoop(){
  if(!state.running || state.paused) return;
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  spawnOnce(diff);
  const ts = safeTimeScale();
  const next = Math.max(220, Math.floor(diff.spawn * ts));
  state.spawnTimer = setTimeout(spawnLoop, next);
}

function tick(){
  if(!state.running || state.paused) return;
  state.timeLeft = Math.max(0, state.timeLeft - 1);
  updateHUD();
  if(state.timeLeft<=0){ end(); return; }
  if(state.timeLeft<=10){
    try{ document.getElementById('sfx-tick')?.play()?.catch(()=>{}); }catch{}
  }
  state.tickTimer = setTimeout(tick, 1000);
}

/* ---------- Event Binding ---------- */
document.addEventListener('pointerup', (e)=>{
  const btn = byAction(e.target);
  if(!btn) return;
  const a = btn.getAttribute('data-action');
  const v = btn.getAttribute('data-value');

  if(a==='mode'){
    state.modeKey = v; applyUI(); applyLang();
  } else if(a==='diff'){
    state.difficulty = v; applyUI();
  } else if(a==='start'){
    start();
  } else if(a==='pause'){
    if(!state.running){ start(); return; }
    state.paused ? resumeGame() : pauseGame();
  } else if(a==='restart'){
    end(true); start();
  } else if(a==='help'){
    $('#help').style.display = 'block';
  } else if(a==='helpClose'){
    $('#help').style.display = 'none';
  }
}, {passive:true});

document.getElementById('result')?.addEventListener('click',(e)=>{
  const a = e.target.getAttribute('data-result');
  if(a==='replay'){ e.currentTarget.style.display='none'; start(); }
  if(a==='home'){ e.currentTarget.style.display='none'; }
}, {passive:true});

// Toggle: language & graphics
$('#langToggle')?.addEventListener('click', ()=>{
  state.lang = state.lang==='TH' ? 'EN' : 'TH';
  localStorage.setItem('hha_lang', state.lang);
  coach.lang = state.lang;
  applyLang();
}, {passive:true});

$('#gfxToggle')?.addEventListener('click', ()=>{
  state.gfx = state.gfx==='low' ? 'quality' : 'low';
  localStorage.setItem('hha_gfx', state.gfx);
  try{
    if(eng?.renderer){
      eng.renderer.setPixelRatio(state.gfx==='low' ? 0.75 : (window.devicePixelRatio||1));
    }
  }catch{}
}, {passive:true});

// Audio unlock (mobile)
window.addEventListener('pointerdown', ()=>sfx.unlock?.(), {once:true, passive:true});

// Pause on blur / Resume on focus
window.addEventListener('blur',  ()=>pauseGame());
window.addEventListener('focus', ()=>resumeGame());

// Boot apply
applyLang();
applyUI();
updateHUD();
