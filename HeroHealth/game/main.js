// ===== Boot flag =====
window.__HHA_BOOT_OK = true;

// ===== Imports (ตัวเต็ม) =====
import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { Engine } from './core/engine.js';
import { HUD } from './core/hud.js';
import { SFX } from './core/sfx.js';
import { Leaderboard } from './core/leaderboard.js';
import { MissionSystem } from './core/mission.js';
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
const board = new Leaderboard();
const mission = new MissionSystem();
const power = new PowerUpSystem();
const score = new ScoreSystem();
const eng   = new Engine(THREE, document.getElementById('c'));
const fx    = new FloatingFX(eng);
const coach = new Coach({ lang:'TH' });

// กัน canvas บังคลิก
const c = document.getElementById('c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; }

// ===== State =====
const DIFFS = {
  Easy:   { time:70, spawn:820, life:4200, hydWaterRate:0.78 },
  Normal: { time:60, spawn:700, life:3000, hydWaterRate:0.66 },
  Hard:   { time:50, spawn:560, life:1900, hydWaterRate:0.55 }
};
let state = {
  modeKey:'goodjunk',
  difficulty:'Normal',
  running:false,
  timeLeft:60,
  fever:false,
  mission:null,
  ctx:{ hits:0, miss:0 }
};
window.__HHA_STATE = state;

// ===== HUD helpers =====
function updateHUD(){
  const sc=qs('#score'), cb=qs('#combo'), tm=qs('#time');
  if(sc) sc.textContent = score.score|0;
  if(cb) cb.textContent = 'x'+(score.combo||0);
  if(tm) tm.textContent = state.timeLeft|0;
}
function updateStatus(){
  const map = { goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ' };
  const el = qs('#statusLine');
  if (el) el.textContent = `โหมด: ${map[state.modeKey]||state.modeKey} • ความยาก: ${state.difficulty}`;
}

// ===== Fever via ScoreSystem (ถ้าโหมดนั้นรองรับ) =====
let feverCharge = 0;
const FEVER_REQ = 10;
if (typeof score.setHandlers === 'function') {
  score.setHandlers({
    onCombo:(x)=>{
      feverCharge = Math.min(1, x/FEVER_REQ);
      hud.setFeverProgress?.(feverCharge);
      if(!state.fever && x >= FEVER_REQ){
        state.fever = true;
        document.body.classList.add('fever-bg');
        coach.onFever?.();
        sfx.power();
        power.apply('boost'); // +100% คะแนน 7s
        setTimeout(()=>{
          state.fever=false;
          document.body.classList.remove('fever-bg');
          feverCharge=0;
          hud.setFeverProgress?.(0);
        }, 7000);
      }
    }
  });
}

// ===== DOM Pool (.item) =====
const pool=[]; const POOL_MAX=64;
function makeItem(){
  const b=document.createElement('button');
  b.className='item';
  b.style.position='fixed';
  b.style.zIndex='220';
  b.style.minWidth='56px';
  b.style.minHeight='56px';
  b.style.pointerEvents='auto';
  return b;
}
function getItem(){ return pool.pop() || makeItem(); }
function freeItem(el){ el.onclick=null; el.remove(); if(pool.length<POOL_MAX) pool.push(el); }

// ตำแหน่ง spawn (เว้นหัว/เมนู)
function place(el){
  const topMin = 16, botSafe = 24; // %
  const topMax = 100 - botSafe;
  el.style.left = (8 + Math.random()*84) + 'vw';
  el.style.top  = (topMin + Math.random()*(topMax-topMin)) + 'vh';
  el.animate(
    [{transform:'translateY(0)'},{transform:'translateY(-6px)'},{transform:'translateY(0)'}],
    {duration:1200,iterations:Infinity}
  );
}

// ===== Spawn =====
function spawnOnce(diff){
  const mode = MODES[state.modeKey];
  if(!mode?.pickMeta) return;
  const meta = mode.pickMeta(diff, state);
  const el = getItem();
  el.textContent = meta.char || '🟢';
  place(el);

  el.onclick = ()=>{
    try{
      mode.onHit?.(meta, {score, sfx, power, fx}, state, hud);
      state.ctx.hits = (state.ctx.hits||0) + 1;
      updateHUD();
      freeItem(el);
    }catch(err){
      console.warn('[onHit error]', err);
      freeItem(el);
    }
  };

  document.body.appendChild(el);
  setTimeout(()=>{ if(el.isConnected) freeItem(el); }, meta.life || diff.life || 2500);
}

const timers = { spawn:0, tick:0 };
function spawnLoop(){
  if(!state.running) return;
  const base = DIFFS[state.difficulty] || DIFFS.Normal;
  spawnOnce(base);
  const next = clamp(base.spawn * (power.timeScale||1), 220, 2400);
  timers.spawn = setTimeout(spawnLoop, next);
}

// ===== Missions (45s ช่วงกลางเกม ถ้าโหมดรองรับ) =====
function startMission(){
  try{
    state.mission = mission.start?.(state.modeKey) || null;
    if (state.mission){
      hud.setMission?.(mission.describe(state.mission));
      state.mission.remainSec = 45;
    }
  }catch{}
}
function missionTick(){
  if(!state.mission) return;
  state.mission.remainSec = Math.max(0, state.mission.remainSec - 1);
  try{
    mission.evaluate?.(state, score, (res)=>{
      if (res?.success && !state.mission.done){
        state.mission.done = true; state.mission.success = true;
        fx.spawn3D?.(null, '🏁 Mission Complete', 'good'); sfx.perfect?.();
      }
    });
    const line = mission.describe?.(state.mission) || '—';
    hud.setMission?.(`${line} • ${state.mission.remainSec|0}s`);
    if (state.mission.remainSec === 0 && !state.mission.done){
      state.mission.done = true; state.mission.success = false;
      fx.spawn3D?.(null, '⌛ Mission Failed', 'bad');
    }
  }catch{}
}

// ===== Tick / End =====
function tick(){
  if(!state.running) return;
  state.timeLeft--; updateHUD();

  // per-mode tick
  try{ MODES[state.modeKey]?.tick?.(state, {score,fx,sfx,power,coach}, hud); }catch(e){}

  // mission
  missionTick();

  if(state.timeLeft<=0){ end(); return; }
  timers.tick = setTimeout(tick, 1000);
}

// ===== Start / End =====
export function start(){
  end(true); // reset ก่อน
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  state.running=true;
  state.timeLeft=diff.time;
  state.ctx={hits:0, miss:0};
  state.fever=false;
  feverCharge=0; hud.setFeverProgress?.(0);
  score.reset(); power.reset?.(); mission.reset?.(); hud.reset?.();

  // โชว์ HUD ตามโหมด
  hud.hideHydration?.(); hud.hideTarget?.(); hud.hidePills?.(); hud.setMission?.(null);
  if (state.modeKey==='hydration') hud.showHydration?.();
  if (state.modeKey==='groups' || state.modeKey==='plate') hud.showTarget?.();
  if (state.modeKey==='plate') hud.showPills?.();

  // init โหมด
  try{ MODES[state.modeKey]?.init?.(state, hud, diff); }catch(e){}

  // เริ่ม mission กลางเกม
  startMission();

  // โค้ช & HUD
  updateStatus(); updateHUD();
  coach.say(state.modeKey==='hydration' ? 'รักษา 💧 45–65%!' : 'เริ่มเกม!');
  sfx.tick();

  // ลูป
  tick(); spawnLoop();
}

export function end(silent=false){
  state.running=false;
  clearTimeout(timers.spawn); clearTimeout(timers.tick);

  // เคลียร์ทุก HUD เฉพาะโหมด (กันค้าง)
  try{
    hud.hideHydration?.();
    hud.hideTarget?.();
    hud.hidePills?.();
    hud.setMission?.(null);
    document.body.classList.remove('fever-bg');
    hud.setFeverProgress?.(0);
  }catch{}

  if(!silent){
    try{ board.submit?.(state.modeKey, state.difficulty, score.score); }catch{}
    const core=qs('#resCore');
    if(core) core.innerHTML = `
      <p>โหมด: <b>${state.modeKey}</b> • ความยาก: <b>${state.difficulty}</b></p>
      <p>คะแนน: <b>${score.score|0}</b> • คอมโบสูงสุด: <b>x${score.bestCombo||0}</b></p>`;
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
  if(a==='pause'){ state.running=!state.running; if(state.running){ tick(); spawnLoop(); } }
  if(a==='restart'){ end(true); start(); }
  if(a==='help'){ const h=qs('#help'); if(h) h.style.display='flex'; }
});

// Help / Result
qs('#btn_ok')?.addEventListener('click',()=>qs('#help').style.display='none');
qs('#btn_replay')?.addEventListener('click',()=>{ qs('#result').style.display='none'; start(); });
qs('#btn_home')  ?.addEventListener('click',()=>{ qs('#result').style.display='none'; });

// ปลดล็อกเสียงครั้งแรก
['pointerdown','touchstart','keydown'].forEach(ev=>{
  window.addEventListener(ev, ()=>sfx.unlock(), {once:true, passive:true});
});

// Log
console.log('[HHA FULL] Modes =', Object.keys(MODES));
