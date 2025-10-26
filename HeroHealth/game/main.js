// === Hero Health Academy — main.js (v3 full) ===
// 1) End summary + grade  2) VFX/SFX combo/fever  3) Dynamic difficulty
// 4) Quest HUD (ask mode) 5) Coach callouts       6) Mobile-safe spawn
// 7) Hooks for saving/export (board/progression-ready)

window.__HHA_BOOT_OK = true;
// main.js – เพิ่มบนสุดของไฟล์
const MAX_ITEMS = 10;
const LIVE = new Set();

// main.js – ใน spawnOnce() ก่อนสร้างปุ่มใหม่
if (LIVE.size >= MAX_ITEMS) {
  state.spawnTimer = setTimeout(()=>spawnOnce(diff), 180);
  return;
}

// main.js – หลังสร้าง element el แล้ว (ก่อน appendChild)
function randPos(){
  const headerH = $('header.brand')?.offsetHeight || 56;
  const menuH   = $('#menuBar')?.offsetHeight || 120;
  const yMin = headerH + 60;
  const yMax = Math.max(yMin + 50, window.innerHeight - menuH - 80);
  const xMin = 20;
  const xMax = Math.max(xMin + 50, window.innerWidth - 80);
  return {
    left: xMin + Math.random()*(xMax-xMin),
    top:  yMin + Math.random()*(yMax-yMin)
  };
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
let pos = randPos(), tries=0;
while (tries++<12 && overlapped(pos.left, pos.top)) pos = randPos();
el.style.left = pos.left + 'px';
el.style.top  = pos.top  + 'px';

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
const $ = (s)=>document.querySelector(s);
const setText = (sel, txt)=>{ const el=$(sel); if(el) el.textContent = txt; };
const byAction = (el)=>el?.closest?.('[data-action]') || null;

// ----- Config -----
const MODES = { goodjunk, groups, hydration, plate };
const DIFFS = {
  Easy:   { time:70, spawn:900, life:4200 },
  Normal: { time:60, spawn:700, life:3000 },
  Hard:   { time:50, spawn:550, life:1800 }
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

// ----- Systems & State -----
const state = {
  modeKey:'goodjunk',
  difficulty:'Normal',
  running:false,
  paused:false,
  timeLeft:60,
  lang: localStorage.getItem('hha_lang') || 'TH',
  gfx:  localStorage.getItem('hha_gfx')  || 'quality',
  combo:0,
  bestCombo:0,
  fever:{ active:false, meter:0, drainPerSec:14, chargeGood:10, chargePerfect:20, threshold:100, mul:2, timeLeft:0 },
  spawnTimer:0,
  tickTimer:0,
  ctx:{},              // per-mode
  stats:{              // for summary/grade
    good:0, bad:0, perfect:0, power:0
  }
};

const hud   = new HUD();
const sfx   = new SFX({ enabled:true, poolSize:4 });
const score = new ScoreSystem();
const power = new PowerUpSystem();
const coach = new Coach({ lang: state.lang });
const eng   = new Engine(THREE, document.getElementById('c'));

// ===== UI =====
function applyUI(){
  const L = T(state.lang);
  setText('#modeName',   (L.names[state.modeKey] || state.modeKey));
  setText('#difficulty', (L.diffs[state.difficulty] || state.difficulty));
}
function updateHUD(){
  hud.setScore?.(score.score|0);
  hud.setTime?.(state.timeLeft|0);
  hud.setCombo?.('x'+(state.combo|0));
}
applyUI(); updateHUD();

// Fever bar/label
function setFeverBar(p){ hud.setFeverProgress?.(Math.max(0,Math.min(1,p/100))); const el=$('#feverBar'); if(el) el.style.width=(Math.max(0,Math.min(100,p))|0)+'%'; }
function showFeverLabel(on){ const f=$('#fever'); if(!f) return; f.style.display=on?'block':'none'; f.classList.toggle('pulse',on); }
function startFever(){ if(state.fever.active) return; state.fever.active=true; state.fever.timeLeft=7; showFeverLabel(true); try{$('#sfx-powerup')?.play();}catch{}; document.body.classList.add('fever-bg'); }
function stopFever(){ state.fever.active=false; state.fever.timeLeft=0; showFeverLabel(false); document.body.classList.remove('fever-bg'); }

// Score popup + flame
function scoreFX(x,y,total,comboMul,feverMul){
  const tag = total>=0?('+'+total):(''+total);
  const minor = (comboMul>1 || feverMul>1) ? `x${comboMul.toFixed(1)}${feverMul>1?' • FEVER':''}` : '';
  hud.popScore?.(x,y,tag,minor,(total>=0?(feverMul>1?'#ffd54a':'#7fffd4'):'#ff9b9b'));
  if (state.fever.active && total>=10){ hud.burstFlame?.(x,y,total>14); }
}
function scoreWithEffects(base, x, y){
  const comboMul = state.combo>=20?1.4:(state.combo>=10?1.2:1.0);
  const feverMul = state.fever.active?state.fever.mul:1.0;
  const total = Math.round(base * comboMul * feverMul);
  score.add?.(total);
  scoreFX(x,y,total,comboMul,feverMul);
}

// Combo logic
function addCombo(kind){
  if(kind==='bad'){ state.combo=0; hud.setCombo?.('x0'); return; }
  if(kind==='good'||kind==='perfect'){
    state.combo++; state.bestCombo = Math.max(state.bestCombo, state.combo);
    hud.setCombo?.('x'+state.combo);
    if(!state.fever.active){
      const g = (kind==='perfect')?state.fever.chargePerfect:state.fever.chargeGood;
      state.fever.meter = Math.min(100, state.fever.meter + g);
      setFeverBar(state.fever.meter);
      if(state.fever.meter>=state.fever.threshold) startFever();
    }else{
      state.fever.timeLeft = Math.min(10, state.fever.timeLeft + 0.6);
    }
    coach.onCombo?.(state.combo);
  }
}

// Quest HUD
function ensureQuestHUD(){
  if($('#questHUD')) return;
  const hudRoot = document.querySelector('.hud');
  if(!hudRoot) return;
  const wrap = document.createElement('div');
  wrap.id = 'questHUD';
  wrap.className = 'questHUD';
  wrap.innerHTML = `
    <div class="qcard"><div class="qtitle">—</div><div class="qbar"><div class="qin"></div></div></div>
    <div class="qcard"><div class="qtitle">—</div><div class="qbar"><div class="qin"></div></div></div>
    <div class="qcard"><div class="qtitle">—</div><div class="qbar"><div class="qin"></div></div></div>
  `;
  hudRoot.appendChild(wrap);
}
function renderQuests(){
  const mode = MODES[state.modeKey]; if(!mode?.getQuests) { const el=$('#questHUD'); if(el) el.style.display='none'; return; }
  const list = mode.getQuests(state) || [];
  ensureQuestHUD();
  const el = $('#questHUD'); if(!el) return;
  el.style.display = 'grid';
  const cards = Array.from(el.querySelectorAll('.qcard'));
  for(let i=0;i<3;i++){
    const q = list[i];
    const c = cards[i]; if(!c){ continue; }
    if(!q){ c.style.visibility='hidden'; continue; }
    c.style.visibility='visible';
    c.querySelector('.qtitle').textContent = q.title + (q.remain!=null?` • ${q.remain|0}s`:'' );
    const pct = q.need>0 ? Math.min(100, Math.round((q.progress||0)/q.need*100)) : (q.done?100:0);
    c.querySelector('.qin').style.width = pct + '%';
    c.classList.toggle('done', !!q.done);
    c.classList.toggle('fail', !!q.fail);
  }
}

// ----- Flow -----
function spawnOnce(diff){
  if(!state.running || state.paused) return;

  // freeze from mode (e.g. power FREEZE)
  const now = performance?.now?.() || Date.now();
  if (state.freezeUntil && now < state.freezeUntil) {
    // retry slightly later
    state.spawnTimer = setTimeout(()=>spawnOnce(diff), 180);
    return;
  }

  const mode = MODES[state.modeKey];
  const meta = mode?.pickMeta?.(diff, state) || {};

  const el = document.createElement('button');
  el.className = 'item'; el.type = 'button';
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
  el.addEventListener('pointerenter', ()=>{ el.style.transform='scale(1.12)'; }, {passive:true});
  el.addEventListener('pointerleave', ()=>{ el.style.transform='scale(1)'; }, {passive:true});

  // Safe area
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
      const res = mode?.onHit?.(meta, sys, state, hud) || (meta.good?'good':'ok');
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2, cy = r.top + r.height/2;

      if (res==='good' || res==='perfect'){ addCombo(res); state.stats[res==='good'?'good':'perfect']++; }
      else if (res==='bad'){ addCombo('bad'); state.stats.bad++; }
      else if (res==='power'){ state.stats.power++; }

      const base = ({ good:7, perfect:14, ok:2, bad:-3, power:5 })[res] ?? 1;
      scoreWithEffects(base, cx, cy);

      if (res==='good'){ try{sfx.good();}catch{} }
      else if (res==='bad'){ try{sfx.bad();}catch{} }
    }catch(e){ console.error('[HHA] onHit error:', e); }
    finally{ try{ el.remove(); }catch{} }
  }, { passive:true });

  document.body.appendChild(el);
  const ttl = meta.life || diff.life || 3000;
  setTimeout(()=>{ try{ el.remove(); }catch{} }, ttl);
}

function spawnLoop(){
  if(!state.running || state.paused) return;
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;

  // Dynamic difficulty: tune by accuracy
  const total = state.stats.good + state.stats.perfect + state.stats.bad;
  const acc = total>0 ? (state.stats.good + state.stats.perfect)/total : 1;
  const tune = acc>0.85 ? 0.9 : acc<0.55 ? 1.12 : 1.0;

  const dyn = {
    ...diff,
    spawn: Math.max(280, Math.round((diff.spawn||700) * tune * (power.timeScale||1)))
  };

  spawnOnce(dyn);
  state.spawnTimer = setTimeout(spawnLoop, dyn.spawn);
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

  // Per-mode tick & quest HUD
  try{ MODES[state.modeKey]?.tick?.(state, {score,sfx,power,coach,fx:eng?.fx}, hud); }catch(e){ console.warn('[HHA] mode.tick:', e); }
  renderQuests();

  state.timeLeft = Math.max(0, state.timeLeft - 1);
  updateHUD();

  if (state.timeLeft <= 0){ end(); return; }
  if (state.timeLeft <= 10){
    try{ $('#sfx-tick')?.play()?.catch(()=>{}); }catch{}
    document.body.classList.add('flash');
    coach.say?.(state.lang==='TH'?'อีกนิดเดียว!':'Almost there!');
  }else{
    document.body.classList.remove('flash');
  }

  state.tickTimer = setTimeout(tick, 1000);
}

function start(){
  end(true);
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  state.running=true; state.paused=false;
  state.timeLeft=diff.time;
  state.combo=0; state.bestCombo=0; state.fever.meter=0; setFeverBar(0); stopFever();
  state.stats={good:0,bad:0,perfect:0,power:0};
  state.freezeUntil=0;
  score.reset?.(); updateHUD();

  try{ MODES[state.modeKey]?.init?.(state, hud, diff); }catch(e){ console.error('[HHA] mode.init:', e); }
  coach.onStart?.(state.modeKey);
  renderQuests();
  tick(); spawnLoop();
}

function computeGrade(){
  const total = state.stats.good + state.stats.perfect + state.stats.bad;
  const acc = total>0 ? (state.stats.good + state.stats.perfect)/total : 0;
  const a = acc*100;
  if (a>=90) return 'S';
  if (a>=80) return 'A';
  if (a>=70) return 'B';
  return 'C';
}
function end(silent=false){
  state.running=false; state.paused=false;
  clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer);
  try{ MODES[state.modeKey]?.cleanup?.(state, hud); }catch{}

  if (!silent){
    // Summary
    const L = T(state.lang);
    const core = $('#resCore');
    const brk  = $('#resBreakdown');
    if (core) core.innerHTML = `${L.names[state.modeKey]} • ${L.diffs[state.difficulty]}<br>คะแนน: <b>${score.score|0}</b> • คอมโบสูงสุด: <b>${state.bestCombo|0}</b> • เกรด: <b>${computeGrade()}</b>`;
    const total = state.stats.good + state.stats.perfect + state.stats.bad;
    const acc = total>0 ? Math.round((state.stats.good + state.stats.perfect)/total*100) : 0;
    if (brk) brk.innerHTML = `
      <div>✅ GOOD: <b>${state.stats.good}</b> • ✨ PERFECT: <b>${state.stats.perfect}</b> • ❌ BAD: <b>${state.stats.bad}</b></div>
      <div>⚡️ POWER: <b>${state.stats.power}</b> • Accuracy: <b>${acc}%</b></div>
    `;
    const modal = $('#result'); if (modal) modal.style.display='flex';
    coach.onEnd?.(score.score, { grade: computeGrade() });
  }
}

// ===== Events =====
document.addEventListener('pointerup', (e)=>{
  const btn = byAction(e.target); if(!btn) return;
  const a = btn.getAttribute('data-action'); const v = btn.getAttribute('data-value');
  if (a==='mode'){ state.modeKey=v; applyUI(); if(state.running) start(); }
  else if (a==='diff'){ state.difficulty=v; applyUI(); if(state.running) start(); }
  else if (a==='start'){ start(); }
  else if (a==='pause'){
    if (!state.running){ start(); return; }
    state.paused=!state.paused;
    if (!state.paused){ tick(); spawnLoop(); } else { clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer); }
  }
  else if (a==='restart'){ end(true); start(); }
  else if (a==='help'){ const m=$('#help'); if(m) m.style.display='flex'; }
  else if (a==='helpClose'){ const m=$('#help'); if(m) m.style.display='none'; }
  else if (a==='helpScene'){ const hs=$('#helpScene'); if(hs) hs.style.display='flex'; }
  else if (a==='helpSceneClose'){ const hs=$('#helpScene'); if(hs) hs.style.display='none'; }
}, { passive:true });

$('#langToggle')?.addEventListener('click', ()=>{
  state.lang = state.lang==='TH' ? 'EN' : 'TH';
  localStorage.setItem('hha_lang', state.lang);
  coach.setLang?.(state.lang);
  applyUI();
}, { passive:true });

$('#gfxToggle')?.addEventListener('click', ()=>{
  state.gfx = state.gfx==='low' ? 'quality' : 'low';
  localStorage.setItem('hha_gfx', state.gfx);
  try{ eng.renderer.setPixelRatio(state.gfx==='low'?0.75:(window.devicePixelRatio||1)); }catch{}
}, { passive:true });

// Unlock audio once
window.addEventListener('pointerdown', ()=>{ try{ sfx.unlock(); }catch{} }, { once:true, passive:true });
