// ===== Boot flag =====
window.__HHA_BOOT_OK = true;

// ===== Imports =====
import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { Engine } from './core/engine.js';
import { HUD } from './core/hud.js';
import { SFX } from './core/sfx.js';
import { PowerUpSystem } from './core/powerup.js';
import { ScoreSystem } from './core/score.js';
import { FloatingFX } from './core/fx.js';
import { Coach } from './core/coach.js';

import * as goodjunk from './modes/goodjunk.js';
import * as groups    from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate     from './modes/plate.js';

// ===== Utils =====
const qs = (s)=>document.querySelector(s);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

// ===== Systems =====
const MODES = { goodjunk, groups, hydration, plate };
const hud   = new HUD();
const sfx   = new SFX({ enabled:true, poolSize:6 });
const power = new PowerUpSystem();
const score = new ScoreSystem();
const engine= new Engine(THREE, document.getElementById('c'));
const fx    = new FloatingFX(engine);
const coach = new Coach({ lang:'TH' });

// ===== State =====
let state = {
  modeKey:'goodjunk',
  difficulty:'Normal',
  running:false,
  timeLeft:60,
  fever:false,
  ctx:{ hits:0, miss:0 }
};

// ===== Difficulty (ปรับให้ออกช้าลง + อายุยาวขึ้น) =====
const DIFFS = {
  Easy:   { time:70, spawn:900, life:5000 },
  Normal: { time:60, spawn:780, life:3800 },
  Hard:   { time:50, spawn:620, life:2600 }
};

const MODE_NAME_TH = {
  goodjunk:'ดี vs ขยะ',
  groups:'จาน 5 หมู่',
  hydration:'สมดุลน้ำ',
  plate:'จัดจานสุขภาพ'
};

function setBodyState(name){
  const b=document.body;
  b.classList.remove('state-menu','state-playing','state-paused','state-result');
  b.classList.add(`state-${name}`);
}

// ===== HUD helpers =====
function updateHUD(){
  const sc=qs('#score'), cb=qs('#combo'), tm=qs('#time');
  if(sc) sc.textContent = score.score|0;
  if(cb) cb.textContent = 'x'+(score.combo||0);
  if(tm) tm.textContent = state.timeLeft|0;
}
function updateStatusLine(){
  const el=qs('#statusLine'); if(!el) return;
  el.textContent = `โหมด: ${MODE_NAME_TH[state.modeKey]||state.modeKey} • ความยาก: ${state.difficulty}`;
}

// ===== Item Pool =====
const _pool=[]; const POOL_MAX=64;
function createItem(){
  const b=document.createElement('button');
  b.className='item'; b.type='button';
  Object.assign(b.style,{
    position:'fixed', zIndex:'120',
    fontSize:'clamp(44px, 6.2vw, 82px)',
    minWidth:'74px', minHeight:'74px',
    pointerEvents:'auto'
  });
  return b;
}
function getItemEl(){ return _pool.pop() || createItem(); }
function releaseItemEl(el){ el.onclick=null; el.remove(); if(_pool.length<POOL_MAX) _pool.push(el); }

function place(el){
  // เว้นหัว/เมนู
  el.style.left = (8 + Math.random()*84) + 'vw';
  el.style.top  = (18 + Math.random()*70) + 'vh';
  el.animate(
    [{transform:'translateY(0)'},{transform:'translateY(-6px)'},{transform:'translateY(0)'}],
    {duration:1200, iterations:Infinity}
  );
}

// ===== Spawner (เรียกโหมด แต่มี guard เรื่องสปีด/อายุ) =====
function spawnOnce(diff){
  const mode = MODES[state.modeKey]; if(!mode || !mode.pickMeta) return;
  const meta = mode.pickMeta(diff, state);
  const el = getItemEl();
  el.textContent = meta.char || '?';
  place(el);

  el.onclick = ()=>{
    mode.onHit?.(meta, {score, sfx, fx, power, coach}, state, hud);
    state.ctx.hits = (state.ctx.hits||0) + 1;
    releaseItemEl(el);
    updateHUD();
  };

  document.body.appendChild(el);
  const life = meta.life || diff.life || 2800;
  setTimeout(()=>{ if(el.isConnected) releaseItemEl(el); }, life);
}

const timers = { spawn:0, tick:0 };

function spawnLoop(){
  if(!state.running) return;

  const base = DIFFS[state.difficulty] || DIFFS.Normal;

  // ความแม่นยำปัจจุบัน
  const hits = state.ctx.hits||0, miss = state.ctx.miss||0;
  const acc  = hits + miss > 0 ? (hits/(hits+miss)) : 1;

  // ปรับนุ่ม: แม่นมากค่อยเร่ง, พลาดเยอะให้ช้าลง
  const tune = acc>0.80 ? 0.90 : (acc<0.55 ? 1.12 : 1.00);

  // เร่งตามคะแนนแบบอ่อน (จำกัดผลที่ -25%)
  const scoreFactor = Math.min(0.25, (score.score||0)/1200);
  const accel = 1 - scoreFactor; // 1..0.75

  // กันเร็วสุด 450ms
  const minNext = 450;
  const next = Math.max(
    minNext,
    Math.round((base.spawn * tune) * accel * (power.timeScale || 1))
  );

  // ยืดอายุเมื่อความแม่นต่ำ
  const lifeBoost = acc < 0.60 ? 1.25 : (acc < 0.70 ? 1.12 : 1.00);
  const lifeNow = Math.round((base.life * 1.10) * lifeBoost);

  spawnOnce({ ...base, life: lifeNow });
  timers.spawn = setTimeout(spawnLoop, next);
}

// ===== Game Loop =====
export function start(){
  end(true);
  const diff=DIFFS[state.difficulty] || DIFFS.Normal;
  state.running=true; state.timeLeft=diff.time;
  state.ctx={hits:0, miss:0}; state.fever=false;

  score.reset(); power.reset?.(); hud.reset?.();
  forceUILayers(); updateStatusLine();
  setBodyState('playing');

  MODES[state.modeKey]?.init?.(state, hud, diff);
  updateHUD();
  coach.say('เริ่มเกม!');
  tick(); spawnLoop();
}
function tick(){
  if(!state.running) return;
  state.timeLeft--; updateHUD();
  MODES[state.modeKey]?.tick?.(state, {score, fx, sfx, power, coach}, hud);
  if(state.timeLeft<=0){ end(); return; }
  timers.tick = setTimeout(tick, 1000);
}
export function end(silent=false){
  state.running=false;
  clearTimeout(timers.spawn); clearTimeout(timers.tick);

  if(!silent){
    setBodyState('result');
    const core=qs('#resCore');
    core && (core.innerHTML = `
      <p>โหมด: <b>${MODE_NAME_TH[state.modeKey]||state.modeKey}</b></p>
      <p>ความยาก: <b>${state.difficulty}</b></p>
      <p>คะแนน: <b>${score.score|0}</b> • คอมโบสูงสุด: <b>x${score.bestCombo||0}</b></p>
    `);
    const res=qs('#result'); if(res) res.style.display='flex';
    coach.say('เยี่ยมมาก!');
  }else{
    setBodyState('menu');
  }
}

// ===== Menu bindings =====
document.addEventListener('click', (e)=>{
  const btn = e.target.closest('#menuBar button'); if(!btn) return;
  const a = btn.dataset.action, v=btn.dataset.value;

  if(a==='mode'){ state.modeKey=v; updateStatusLine(); }
  if(a==='diff'){ state.difficulty=v; updateStatusLine(); }
  if(a==='start'){ start(); }
  if(a==='pause'){
    if(state.running){ state.running=false; setBodyState('paused'); }
    else { state.running=true; setBodyState('playing'); tick(); spawnLoop(); }
  }
  if(a==='restart'){ end(true); start(); }
  if(a==='help'){ const h=qs('#help'); if(h) h.style.display='flex'; }
});
qs('#btn_ok')?.addEventListener('click', ()=>{ qs('#help').style.display='none'; });
qs('#btn_home')?.addEventListener('click', ()=>{ qs('#result').style.display='none'; setBodyState('menu'); });

// ===== UI safety: HUD/เมนูคลิกได้เสมอ =====
function forceUILayers(){
  const c=document.getElementById('c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; }
  ['hud','menu','modal','coach','item'].forEach(cls=>{
    document.querySelectorAll('.'+cls).forEach(el=>{
      el.style.pointerEvents='auto';
      el.style.zIndex = Math.max(120, parseInt(getComputedStyle(el).zIndex||'0',10));
    });
  });
}
forceUILayers();
updateStatusLine();

// ===== Unlock audio on first gesture =====
['pointerdown','touchstart','keydown'].forEach(ev=>{
  window.addEventListener(ev, ()=>{ try{ document.getElementById('bgm-main')?.play(); }catch{} }, {once:true, passive:true});
});

// Expose (ถ้าจำเป็น)
window.start=start; window.end=end;
