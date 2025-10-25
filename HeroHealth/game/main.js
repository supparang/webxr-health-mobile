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
import * as groups from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate from './modes/plate.js';

// ===== Utils =====
const qs = (s)=>document.querySelector(s);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

// ===== Systems =====
const MODES = { goodjunk, groups, hydration, plate };
const hud = new HUD();
const sfx = new SFX({ enabled:true });
const power = new PowerUpSystem();
const score = new ScoreSystem();
const fx = new FloatingFX(new Engine(THREE, document.getElementById('c')));
const coach = new Coach({ lang:'TH' });

// ===== Game State =====
let state = { modeKey:'goodjunk', difficulty:'Normal', running:false, timeLeft:60, ctx:{hits:0,miss:0} };
const DIFFS = {
  Easy:{ time:70, spawn:850, life:4200 },
  Normal:{ time:60, spawn:700, life:3000 },
  Hard:{ time:50, spawn:550, life:1900 }
};

// ===== Update HUD =====
function updateHUD(){
  qs('#score').textContent = score.score|0;
  qs('#combo').textContent = 'x'+(score.combo||0);
  qs('#time').textContent = state.timeLeft|0;
}
function updateStatus(){
  const el = qs('#statusLine');
  const modeName = {goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ'}[state.modeKey];
  el.textContent = `โหมด: ${modeName} • ความยาก: ${state.difficulty}`;
}

// ===== Spawner =====
const pool=[]; const POOL_MAX=48;
function makeItem(){
  const b=document.createElement('button');
  b.className='item'; b.style.zIndex='120'; b.style.pointerEvents='auto';
  return b;
}
function getItem(){ return pool.pop()||makeItem(); }
function freeItem(el){ el.onclick=null; el.remove(); if(pool.length<POOL_MAX) pool.push(el); }

function place(el){ el.style.left=(10+Math.random()*80)+'vw'; el.style.top=(20+Math.random()*60)+'vh'; }

function spawn(diff){
  const mode = MODES[state.modeKey];
  if(!mode?.pickMeta) return;
  const meta = mode.pickMeta(diff,state);
  const el = getItem();
  el.textContent = meta.char || '?';
  place(el);
  el.onclick=()=>{
    mode.onHit?.(meta,{score,sfx,fx,power,coach},state,hud);
    freeItem(el); updateHUD();
  };
  document.body.appendChild(el);
  setTimeout(()=>freeItem(el), diff.life||2500);
}

// ===== Game Loop =====
let timers={};
function tick(){
  if(!state.running) return;
  state.timeLeft--; updateHUD();
  MODES[state.modeKey]?.tick?.(state,{score,fx,sfx,power,coach},hud);
  if(state.timeLeft<=0){ end(); return; }
  timers.tick=setTimeout(tick,1000);
}
function loop(){
  if(!state.running) return;
  const diff = DIFFS[state.difficulty];
  spawn(diff);
  timers.spawn=setTimeout(loop, diff.spawn);
}

// ===== Start / End =====
export function start(){
  end(true);
  const diff=DIFFS[state.difficulty];
  state.running=true; state.timeLeft=diff.time; score.reset();
  updateHUD(); updateStatus();
  MODES[state.modeKey]?.init?.(state,hud,diff);
  coach.say('เริ่มเกม!');
  tick(); loop();
}
export function end(silent=false){
  state.running=false; clearTimeout(timers.tick); clearTimeout(timers.spawn);
  if(!silent){
    const core=qs('#resCore');
    core.innerHTML=`<p>คะแนน: ${score.score|0}</p><p>คอมโบสูงสุด: x${score.bestCombo||0}</p>`;
    qs('#result').style.display='flex';
    coach.say('เยี่ยมมาก!');
  }
}

// ===== Menu actions =====
document.addEventListener('click',(e)=>{
  const b=e.target.closest('#menuBar button'); if(!b) return;
  const a=b.dataset.action, v=b.dataset.value;
  if(a==='mode'){ state.modeKey=v; updateStatus(); }
  if(a==='diff'){ state.difficulty=v; updateStatus(); }
  if(a==='start') start();
  if(a==='pause'){ state.running=!state.running; if(state.running){ tick(); loop(); } }
  if(a==='restart'){ end(true); start(); }
  if(a==='help'){ qs('#help').style.display='flex'; }
});
qs('#btn_ok')?.addEventListener('click',()=>qs('#help').style.display='none');
qs('#btn_replay')?.addEventListener('click',()=>{ qs('#result').style.display='none'; start(); });
qs('#btn_home')?.addEventListener('click',()=>qs('#result').style.display='none');
