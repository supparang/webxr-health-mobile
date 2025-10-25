// ===== Boot flag (ให้ fallback หายทันทีเมื่อไฟล์นี้รัน) =====
window.__HHA_BOOT_OK = true;

// ===== Imports (relative กับไฟล์นี้ที่ /game/) =====
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
const eng   = new Engine(THREE, document.getElementById('c'));
const fx    = new FloatingFX(eng);
const coach = new Coach({ lang:'TH' });

// ===== State =====
let state = {
  modeKey:'goodjunk',
  difficulty:'Normal',
  running:false,
  timeLeft:60,
  ctx:{hits:0, miss:0}
};

const DIFFS = {
  Easy:   { time:70, spawn:850, life:4200 },
  Normal: { time:60, spawn:700, life:3000 },
  Hard:   { time:50, spawn:560, life:1900 }
};

// ===== HUD =====
function updateHUD(){
  const sc=qs('#score'), cb=qs('#combo'), tm=qs('#time');
  if(sc) sc.textContent = score.score|0;
  if(cb) cb.textContent = 'x'+(score.combo||0);
  if(tm) tm.textContent = state.timeLeft|0;
}
function updateStatus(){
  const map = {goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ'};
  const el = qs('#statusLine');
  if(el) el.textContent = `โหมด: ${map[state.modeKey]||state.modeKey} • ความยาก: ${state.difficulty}`;
}

// ===== Items (สิ่งให้คลิก) =====
const pool=[]; const POOL_MAX=48;
function makeItem(){
  const b=document.createElement('button');
  b.className='item';
  b.style.position='fixed';
  b.style.zIndex='200';
  b.style.minWidth='52px'; b.style.minHeight='52px';
  b.style.pointerEvents='auto';
  return b;
}
function getItem(){ return pool.pop()||makeItem(); }
function freeItem(el){ el.onclick=null; el.remove(); if(pool.length<POOL_MAX) pool.push(el); }

function place(el){ // เว้น header + เมนู
  el.style.left = (8 + Math.random()*84) + 'vw';
  el.style.top  = (18 + Math.random()*70) + 'vh';
}

function spawn(diff){
  const mode = MODES[state.modeKey];
  if(!mode?.pickMeta) return;
  const meta = mode.pickMeta(diff,state);

  const el = getItem();
  el.textContent = meta.char || '?';
  place(el);

  el.onclick = ()=>{
    mode.onHit?.(meta,{score,sfx,fx,power,coach},state,hud);
    updateHUD();
    freeItem(el);
  };

  document.body.appendChild(el);
  setTimeout(()=>freeItem(el), meta.life || diff.life || 2500);
}

// ===== Loops =====
let timers={tick:0, spawn:0};
function tick(){
  if(!state.running) return;
  state.timeLeft--; updateHUD();
  MODES[state.modeKey]?.tick?.(state,{score,fx,sfx,power,coach},hud);
  if(state.timeLeft<=0){ end(); return; }
  timers.tick = setTimeout(tick, 1000);
}
function loop(){
  if(!state.running) return;
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  spawn(diff);
  const next = clamp(diff.spawn*(power.timeScale||1), 240, 2500);
  timers.spawn = setTimeout(loop, next);
}

// ===== Start / End =====
export function start(){
  end(true);
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  state.running=true; state.timeLeft=diff.time;
  score.reset(); power.reset?.(); hud.reset?.();
  updateHUD(); updateStatus();
  MODES[state.modeKey]?.init?.(state,hud,diff);
  coach.say('เริ่มเกม!');
  tick(); loop();
}
export function end(silent=false){
  state.running=false;
  clearTimeout(timers.tick); clearTimeout(timers.spawn);
  if(!silent){
    const core=qs('#resCore');
    if(core) core.innerHTML = `
      <p>คะแนน: <b>${score.score|0}</b></p>
      <p>คอมโบสูงสุด: <b>x${score.bestCombo||0}</b></p>
    `;
    const res=qs('#result'); if(res) res.style.display='flex';
    coach.say('เยี่ยมมาก!');
  }
}

// ===== Menu wiring =====
document.addEventListener('click',(e)=>{
  const btn=e.target.closest('#menuBar button'); if(!btn) return;
  const a=btn.dataset.action, v=btn.dataset.value;
  if(a==='mode'){ state.modeKey=v; updateStatus(); }
  if(a==='diff'){ state.difficulty=v; updateStatus(); }
  if(a==='start') start();
  if(a==='pause'){ state.running=!state.running; if(state.running){ tick(); loop(); } }
  if(a==='restart'){ end(true); start(); }
  if(a==='help'){ const h=qs('#help'); if(h) h.style.display='flex'; }
});
qs('#btn_ok')?.addEventListener('click',()=>qs('#help').style.display='none');
qs('#btn_replay')?.addEventListener('click',()=>{ qs('#result').style.display='none'; start(); });
qs('#btn_home')?.addEventListener('click',()=>qs('#result').style.display='none');

// ===== Safety: ย้ำเลเยอร์ไม่ให้ canvas บังคลิก =====
const c=document.getElementById('c');
if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; }
