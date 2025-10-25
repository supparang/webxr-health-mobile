// ===== Boot flag (ให้ fallback หายเมื่อไฟล์นี้รัน) =====
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
const qs=(s)=>document.querySelector(s);
const qsa=(s)=>Array.from(document.querySelectorAll(s));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// ===== Systems =====
const MODES = { goodjunk, groups, hydration, plate };
const hud   = new HUD();
const sfx   = new SFX({ enabled:true, poolSize:6 });
const power = new PowerUpSystem();
const score = new ScoreSystem();
const eng   = new Engine(THREE, document.getElementById('c'));
const fx    = new FloatingFX(eng);
const coach = new Coach({ lang:'TH' });

// ===== Canvas must not block clicks =====
(function forceUILayers(){
  const c=document.getElementById('c');
  if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; }
  ['hud','menu','modal','coach','item'].forEach(cls=>{
    qsa('.'+cls).forEach(el=>{
      el.style.pointerEvents='auto';
      const z=parseInt(getComputedStyle(el).zIndex||'0',10);
      if(z<120) el.style.zIndex='200';
    });
  });
})();

// ===== State =====
let state={
  modeKey:'goodjunk',
  difficulty:'Normal',
  running:false,
  timeLeft:60,
  ctx:{hits:0,miss:0}
};

// Difficulty
const DIFFS={
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
  const map={ goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ' };
  const el=qs('#statusLine');
  if(el) el.textContent=`โหมด: ${map[state.modeKey]||state.modeKey} • ความยาก: ${state.difficulty}`;
}

// ===== Help text per-mode (TH/EN แบบย่อ) =====
function currentLang(){ return /TH/.test(qs('#langToggle')?.textContent||'TH')?'TH':'EN'; }
function howToText(mode,lang){
  const T={
    TH:{
      goodjunk:'เก็บอาหารดี 🥦🍎 หลีกเลี่ยงของขยะ 🍔🍟🥤 • คอมโบเพิ่มคะแนน • มีภารกิจย่อยระหว่างเล่น',
      groups:'ดู 🎯 หมวดบน HUD แล้วเก็บให้ตรง • ถูก +7 ผิด -2 • เปลี่ยนหมวดทุก ~10s หรือครบ 3 ครั้ง',
      hydration:'รักษา 💧 45–65% • น้ำเปล่าเพิ่ม/หวานลด • >65 ดื่มหวาน = ได้คะแนน, <45 ดื่มหวาน = หักคะแนน',
      plate:'เติมโควตา: ธัญพืช2 ผัก2 โปรตีน1 ผลไม้1 นม1 • ครบทั้งหมดได้โบนัส “Perfect Plate”'
    },
    EN:{
      goodjunk:'Collect healthy 🥦🍎, avoid junk 🍔🍟🥤 • Combo boosts score • Micro missions during play',
      groups:'Match the 🎯 group on HUD • Right +7 Wrong -2 • Rotates every ~10s or 3 hits',
      hydration:'Keep 💧 45–65% • Water↑ / Sugary↓ • >65 +sugary = bonus, <45 +sugary = penalty',
      plate:'Fill quotas: Grain2 Veg2 Protein1 Fruit1 Dairy1 • All complete = “Perfect Plate” bonus'
    }
  };
  return (T[lang||'TH'][mode] || T[lang||'TH'].goodjunk);
}

// ===== Item Pool (.item) =====
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
function getItem(){ return pool.pop()||makeItem(); }
function freeItem(el){ el.onclick=null; el.remove(); if(pool.length<POOL_MAX) pool.push(el); }

// วางตำแหน่ง (เว้นหัว/เมนู)
function place(el){
  el.style.left=(8+Math.random()*84)+'vw';
  el.style.top =(18+Math.random()*70)+'vh';
}

// ===== Spawner =====
function spawn(diff){
  const mode=MODES[state.modeKey];
  let meta=null;
  if(mode?.pickMeta){ meta=mode.pickMeta(diff,state); }
  else { meta={ char:'🍎', good:true, life: diff.life||2500, onHitScore:5 }; }

  const el=getItem();
  el.textContent=meta.char||'🟢';
  place(el);

  el.onclick=()=>{
    if(mode?.onHit){
      mode.onHit(meta,{score,sfx,fx,power,coach},state,hud);
    }else{
      score.add?.(meta.onHitScore||5);
      fx.popText?.(`+${meta.onHitScore||5}`,{color:'#7fffd4'});
      sfx.good?.();
    }
    updateHUD();
    freeItem(el);
  };

  document.body.appendChild(el);
  setTimeout(()=>freeItem(el), meta.life||diff.life||2500);
}

// ===== Loops =====
let timers={tick:0,spawn:0};

function tick(){
  if(!state.running) return;
  state.timeLeft--; updateHUD();
  MODES[state.modeKey]?.tick?.(state,{score,fx,sfx,power,coach},hud);
  if(state.timeLeft<=0){ end(); return; }
  timers.tick=setTimeout(tick,1000);
}
function loop(){
  if(!state.running) return;
  const diff=DIFFS[state.difficulty]||DIFFS.Normal;
  spawn(diff);
  const next=clamp(diff.spawn*(power.timeScale||1),240,2400);
  timers.spawn=setTimeout(loop,next);
}

// ===== Start / End =====
export function start(){
  end(true);
  const diff=DIFFS[state.difficulty]||DIFFS.Normal;
  state.running=true;
  state.timeLeft=diff.time;
  state.ctx={hits:0,miss:0};

  // reset systems & HUD
  score.reset(); power.reset?.(); hud.reset?.();

  // show HUD/status
  updateStatus(); updateHUD();

  // init per mode
  MODES[state.modeKey]?.init?.(state,hud,diff);

  // coach tip (สั้นๆ)
  coach.say(howToText(state.modeKey, currentLang()));

  tick(); loop();
}

export function end(silent=false){
  state.running=false;
  clearTimeout(timers.tick); clearTimeout(timers.spawn);

  // เคลียร์ .item ที่ยังค้าง
  qsa('.item').forEach(el=>el.remove());

  // per-mode cleanup (ปิด interval/ซ่อน HUD เฉพาะโหมด)
  try{ MODES[state.modeKey]?.cleanup?.(state,hud); }catch{}

  // เก็บกวาด HUD ทั่วไปกันค้าง
  hud.hideHydration?.();
  hud.hideTarget?.();
  hud.hidePills?.();
  document.body.classList.remove('fever-bg');

  if(!silent){
    const core=qs('#resCore');
    if(core) core.innerHTML = `
      <p>โหมด: <b>${({goodjunk:'ดี vs ขยะ',groups:'จาน 5 หมู่',hydration:'สมดุลน้ำ',plate:'จัดจานสุขภาพ'})[state.modeKey]||state.modeKey}</b></p>
      <p>ความยาก: <b>${state.difficulty}</b></p>
      <p>คะแนน: <b>${score.score|0}</b> • คอมโบสูงสุด: <b>x${score.bestCombo||0}</b></p>`;
    qs('#result')?.style && (qs('#result').style.display='flex');
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
  if(a==='help'){
    const body=qs('#helpBody'); if(body){ body.textContent = howToText(state.modeKey, currentLang()); }
    const h=qs('#help'); if(h) h.style.display='flex';
  }
});
qs('#btn_ok')?.addEventListener('click',()=>qs('#help').style.display='none');
qs('#btn_replay')?.addEventListener('click',()=>{ qs('#result').style.display='none'; start(); });
qs('#btn_home')?.addEventListener('click',()=>{ qs('#result').style.display='none'; });

// ===== Unlock audio on first gesture =====
['pointerdown','touchstart','keydown'].forEach(ev=>{
  window.addEventListener(ev, ()=>sfx.unlock(), {once:true, passive:true});
});

// ===== Debug =====
console.log('[HHA] Modes loaded =', Object.keys(MODES));
updateStatus(); // แสดงโหมด/ความยาก ตั้งแต่ยังไม่เริ่ม
