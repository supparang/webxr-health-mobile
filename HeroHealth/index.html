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
const hud   = new HUD();
const sfx   = new SFX({ enabled:true, poolSize:6 });
const power = new PowerUpSystem();
const score = new ScoreSystem();
const fx    = new FloatingFX(new Engine(THREE, document.getElementById('c')));
const coach = new Coach({ lang:'TH' });

// ===== State =====
let state = {
  modeKey:'goodjunk',
  difficulty:'Normal',
  running:false,
  timeLeft:60,
  fever:false,
  ctx:{hits:0,miss:0}
};

const DIFFS = {
  Easy:{   time:70, spawn:850, life:4200 },
  Normal:{ time:60, spawn:700, life:3000 },
  Hard:{   time:50, spawn:550, life:1900 }
};

// ===== Names (TH) =====
const MODE_NAME_TH = {
  goodjunk: 'ดี vs ขยะ',
  groups: 'จาน 5 หมู่',
  hydration: 'สมดุลน้ำ',
  plate: 'จัดจานสุขภาพ'
};

// ===== HUD helpers =====
function updateHUD(){
  const sc=qs('#score'), cb=qs('#combo'), tm=qs('#time');
  if(sc) sc.textContent = score.score|0;
  if(cb) cb.textContent = 'x'+(score.combo||0);
  if(tm) tm.textContent = state.timeLeft|0;
}
function updateStatusLine(){
  const el = qs('#statusLine');
  if(!el) return;
  const modeName = MODE_NAME_TH[state.modeKey] || state.modeKey;
  el.textContent = `โหมด: ${modeName} • ความยาก: ${state.difficulty}`;
}

// ===== Item Pool =====
const _pool=[]; const POOL_MAX=48;
function createItem(){
  const b=document.createElement('button');
  b.className='item'; b.type='button';
  b.style.position='fixed';
  b.style.zIndex='120';        // สูงกว่า canvas/พื้นหลัง
  b.style.minWidth='48px'; b.style.minHeight='48px';
  b.style.pointerEvents='auto';
  return b;
}
function getItemEl(){ return _pool.pop() || createItem(); }
function releaseItemEl(el){ el.onclick=null; el.remove(); if(_pool.length<POOL_MAX)_pool.push(el); }

// ===== Spawner =====
function place(el,diff){
  el.style.left=(8+Math.random()*84)+'vw';
  el.style.top =(18+Math.random()*70)+'vh';  // เว้นหัว/เมนู
  el.animate(
    [{transform:'translateY(0)'},{transform:'translateY(-6px)'},{transform:'translateY(0)'}],
    {duration:1200,iterations:Infinity}
  );
}
function spawnOnce(diff){
  const mode = MODES[state.modeKey];
  if(!mode || !mode.pickMeta){ return; }
  const meta = mode.pickMeta(diff,state);

  const el = getItemEl();
  el.textContent = meta.char || '?';
  place(el,diff);

  el.onclick = ()=>{ 
    mode.onHit?.(meta,{score,sfx,fx,power,coach},state,hud);
    releaseItemEl(el);
    updateHUD();
  };

  document.body.appendChild(el);
  setTimeout(()=>releaseItemEl(el), meta.life || diff.life);
}

const timers={spawn:0,tick:0};
function spawnLoop(){
  if(!state.running)return;
  const base=DIFFS[state.difficulty];
  const next=clamp(base.spawn*(power.timeScale||1),240,2500);
  spawnOnce(base);
  timers.spawn=setTimeout(spawnLoop,next);
}

// ===== Game Loop =====
export function start(opt={}){
  end(true);
  const diff=DIFFS[state.difficulty] || DIFFS.Normal;
  state.running=true; state.timeLeft=diff.time; score.reset();

  // ให้ HUD/Status โผล่ชัดและอยู่บนสุดเสมอ
  forceUILayers();
  updateStatusLine();

  // init โหมด + อัปเดต HUD
  MODES[state.modeKey]?.init?.(state,hud,diff);
  updateHUD();
  coach.say('เริ่มเกม!');

  // main loop
  tick(); spawnLoop();
}
function tick(){
  if(!state.running)return;
  state.timeLeft--; updateHUD();
  MODES[state.modeKey]?.tick?.(state,{score,fx,sfx,power,coach},hud);
  if(state.timeLeft<=0){ end(); return; }
  timers.tick=setTimeout(tick,1000);
}
export function end(silent=false){
  state.running=false; clearTimeout(timers.spawn); clearTimeout(timers.tick);
  if(!silent){
    const core=qs('#resCore');
    if(core) core.innerHTML = `
      <p>โหมด: <b>${MODE_NAME_TH[state.modeKey]||state.modeKey}</b></p>
      <p>ความยาก: <b>${state.difficulty}</b></p>
      <p>คะแนน: <b>${score.score|0}</b> • คอมโบสูงสุด: <b>x${score.bestCombo||0}</b></p>`;
    const res=qs('#result'); if(res) res.style.display='flex';
    coach.say('เยี่ยมมาก!');
  }
}

// ===== Events (เมนู) =====
document.addEventListener('click',(e)=>{
  const btn=e.target.closest('#menuBar button'); if(!btn)return;
  const a=btn.dataset.action,v=btn.dataset.value;
  if(a==='mode'){ state.modeKey=v; updateStatusLine(); }
  if(a==='diff'){ state.difficulty=v; updateStatusLine(); }
  if(a==='start') start();
  if(a==='pause'){ state.running=!state.running; if(state.running){tick();spawnLoop();}}
  if(a==='restart'){ end(true); start(); }
  if(a==='help'){ const h=qs('#help'); if(h) h.style.display='flex'; }
});
qs('#btn_ok')?.addEventListener('click',()=>qs('#help').style.display='none');
qs('#btn_home')?.addEventListener('click',()=>qs('#result').style.display='none');

// ===== Expose setters for ui.js sync (optional but helpful) =====
window.setMode = (k)=>{ if(k){ state.modeKey=k; updateStatusLine(); } };
window.setDifficulty = (d)=>{ if(d){ state.difficulty=d; updateStatusLine(); } };

// ===== Keep HUD above & clickable =====
function forceUILayers(){
  const c=document.getElementById('c');
  if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; }
  ['hud','menu','modal','coach','item'].forEach(cls=>{
    document.querySelectorAll('.'+cls).forEach(el=>{
      el.style.pointerEvents='auto';
      el.style.zIndex = Math.max(120, parseInt(getComputedStyle(el).zIndex||'0',10));
    });
  });
}
forceUILayers();
updateStatusLine(); // อัปเดตครั้งแรกที่ยังไม่เริ่มเกม

// ===== Unlock audio/BGM on first gesture (สำหรับ mobile/browser policy) =====
window.addEventListener('pointerdown', () => {
  try { document.getElementById('sfx-good')?.play()?.catch(()=>{}); } catch {}
  try { document.getElementById('bgm-main')?.play()?.catch(()=>{}); } catch {}
}, { once: true, passive: true });

window.start=start; window.end=end;
