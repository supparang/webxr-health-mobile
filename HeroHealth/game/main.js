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
const qsa = (s)=>Array.from(document.querySelectorAll(s));
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

// กัน canvas บังคลิก
const c = document.getElementById('c');
if (c){ c.style.pointerEvents='none'; c.style.zIndex='1'; }

// ===== State (export ไว้ให้ index ใช้โชว์ help ตามโหมดได้) =====
export const __HHA_STATE = {
  modeKey: 'goodjunk',
  difficulty: 'Normal',
  running: false,
  timeLeft: 60,
  ctx: { hits:0, miss:0 }
};
window.__HHA_STATE = __HHA_STATE;

const DIFFS = {
  Easy:   { time:70, spawn:850, life:4200 },
  Normal: { time:60, spawn:700, life:3000 },
  Hard:   { time:50, spawn:560, life:1900 }
};

// ===== HUD =====
function updateHUD(){
  qs('#score') && (qs('#score').textContent = score.score|0);
  qs('#combo') && (qs('#combo').textContent = 'x'+(score.combo||0));
  qs('#time')  && (qs('#time').textContent  = __HHA_STATE.timeLeft|0);
}
function updateStatus(){
  const map = { goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ' };
  const el = qs('#statusLine');
  if (el) el.textContent = `โหมด: ${map[__HHA_STATE.modeKey]||__HHA_STATE.modeKey} • ความยาก: ${__HHA_STATE.difficulty}`;
}

// ===== Help text (สั้น) =====
function langTH(){ return true; }
function howToText(mode){
  const TH={
    goodjunk:'เก็บอาหารดี 🥦🍎 หลีกเลี่ยงของขยะ 🍔🍟🥤 • คอมโบเพิ่มคะแนน • มีภารกิจย่อย',
    groups:'ดู 🎯 หมวดบน HUD แล้วเก็บให้ตรง • ถูก +7 ผิด −2 • เปลี่ยนหมวดทุก ~10s หรือครบ 3 ครั้ง',
    hydration:'รักษา 💧 45–65% • น้ำเปล่าเพิ่ม/หวานลด • >65 ดื่มหวาน = ได้คะแนน, <45 ดื่มหวาน = หักคะแนน',
    plate:'โควตา: ธัญพืช2 ผัก2 โปรตีน1 ผลไม้1 นม1 • ครบทั้งหมด = Perfect Plate'
  };
  return TH[mode] || TH.goodjunk;
}

// ===== Item Pool =====
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

function place(el){
  el.style.left = (8 + Math.random()*84) + 'vw';
  el.style.top  = (18 + Math.random()*70) + 'vh';
}

// ===== Spawner =====
function spawn(diff){
  const mode = MODES[__HHA_STATE.modeKey];
  let meta = null;
  if(mode?.pickMeta){ meta = mode.pickMeta(diff, __HHA_STATE); }
  else { meta = { char:'🍎', good:true, life:diff.life||2500, onHitScore:5 }; }

  const el = getItem();
  el.textContent = meta.char || '🟢';
  place(el);

  el.onclick = ()=>{
    if(mode?.onHit){
      mode.onHit(meta, {score,sfx,fx,power,coach}, __HHA_STATE, hud);
    }else{
      score.add?.(meta.onHitScore||5);
      fx.popText?.(`+${meta.onHitScore||5}`, { color:'#7fffd4' });
      sfx.good?.();
    }
    updateHUD();
    freeItem(el);
  };

  document.body.appendChild(el);
  setTimeout(()=>freeItem(el), meta.life || diff.life || 2500);
}

// ===== Loops =====
let timers={tick:0,spawn:0};
function tick(){
  if(!__HHA_STATE.running) return;
  __HHA_STATE.timeLeft--; updateHUD();
  MODES[__HHA_STATE.modeKey]?.tick?.(__HHA_STATE, {score,fx,sfx,power,coach}, hud);
  if(__HHA_STATE.timeLeft<=0){ end(); return; }
  timers.tick = setTimeout(tick, 1000);
}
function loop(){
  if(!__HHA_STATE.running) return;
  const diff = DIFFS[__HHA_STATE.difficulty] || DIFFS.Normal;
  spawn(diff);
  const next = clamp(diff.spawn*(power.timeScale||1), 240, 2400);
  timers.spawn = setTimeout(loop, next);
}

// ===== Start / End =====
export function start(){
  end(true);
  const diff = DIFFS[__HHA_STATE.difficulty] || DIFFS.Normal;

  __HHA_STATE.running = true;
  __HHA_STATE.timeLeft = diff.time;
  __HHA_STATE.ctx = { hits:0, miss:0 };

  score.reset(); power.reset?.(); hud.reset?.();

  updateStatus(); updateHUD();

  MODES[__HHA_STATE.modeKey]?.init?.(__HHA_STATE, hud, diff);

  coach.say(howToText(__HHA_STATE.modeKey, langTH()?'TH':'EN'));

  tick(); loop();
}

export function end(silent=false){
  __HHA_STATE.running=false;
  clearTimeout(timers.tick); clearTimeout(timers.spawn);

  // ล้าง .item ค้างทั้งหมด
  qsa('.item').forEach(el=>el.remove());

  // cleanup ต่อโหมดถ้ามี
  try{ MODES[__HHA_STATE.modeKey]?.cleanup?.(__HHA_STATE, hud); }catch{}

  // ซ่อน HUD เฉพาะโหมด กันค้าง
  hud.hideHydration?.();
  hud.hideTarget?.();
  hud.hidePills?.();
  document.body.classList.remove('fever-bg');

  if(!silent){
    const core=qs('#resCore');
    if(core) core.innerHTML = `
      <p>โหมด: <b>${({goodjunk:'ดี vs ขยะ',groups:'จาน 5 หมู่',hydration:'สมดุลน้ำ',plate:'จัดจานสุขภาพ'})[__HHA_STATE.modeKey]||__HHA_STATE.modeKey}</b></p>
      <p>ความยาก: <b>${__HHA_STATE.difficulty}</b></p>
      <p>คะแนน: <b>${score.score|0}</b> • คอมโบสูงสุด: <b>x${score.bestCombo||0}</b></p>`;
    qs('#result')?.style && (qs('#result').style.display='flex');
    coach.say('เยี่ยมมาก!');
  }
}

// ===== Menu wiring =====
document.addEventListener('click', (e)=>{
  const btn = e.target.closest('#menuBar button'); if(!btn) return;
  const a = btn.dataset.action, v = btn.dataset.value;
  if(a==='mode'){ __HHA_STATE.modeKey = v; updateStatus(); }
  if(a==='diff'){ __HHA_STATE.difficulty = v; updateStatus(); }
  if(a==='start') start();
  if(a==='pause'){ __HHA_STATE.running=!__HHA_STATE.running; if(__HHA_STATE.running){ tick(); loop(); } }
  if(a==='restart'){ end(true); start(); }
  if(a==='help'){
    const body=qs('#helpBody'); if(body) body.textContent = howToText(__HHA_STATE.modeKey);
    const h=qs('#help'); if(h) h.style.display='flex';
  }
});

qs('#btn_ok')?.addEventListener('click', ()=> qs('#help').style.display='none');
qs('#btn_replay')?.addEventListener('click', ()=>{ qs('#result').style.display='none'; start(); });
qs('#btn_home')  ?.addEventListener('click', ()=>{ qs('#result').style.display='none'; });

// ===== Unlock audio on first gesture =====
['pointerdown','touchstart','keydown'].forEach(ev=>{
  window.addEventListener(ev, ()=>sfx.unlock(), {once:true, passive:true});
});

// ===== Debug =====
console.log('[HHA] Modes loaded =', Object.keys(MODES));
updateStatus();  // แสดงสถานะตั้งแต่ยังไม่เริ่ม
