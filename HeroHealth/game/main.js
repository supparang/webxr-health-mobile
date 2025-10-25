// Boot flag
window.__HHA_BOOT_OK = true;

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

const qs = (s)=>document.querySelector(s);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

const MODES = { goodjunk, groups, hydration, plate };
const hud   = new HUD();
const sfx   = new SFX({ enabled:true, poolSize:6 });
const power = new PowerUpSystem();
const score = new ScoreSystem();
const fx    = new FloatingFX(new Engine(THREE, document.getElementById('c')));
const coach = new Coach({ lang:'TH' });

let state = {
  modeKey:'goodjunk', difficulty:'Normal',
  running:false, timeLeft:60, fever:false, ctx:{hits:0,miss:0}
};

const DIFFS = {
  Easy:{ time:70, spawn:850, life:4200 },
  Normal:{ time:60, spawn:700, life:3000 },
  Hard:{ time:50, spawn:550, life:1900 }
};

const MODE_NAME_TH = {
  goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ'
};

function setBodyState(name){
  const b=document.body;
  b.classList.remove('state-menu','state-playing','state-paused','state-result');
  b.classList.add(`state-${name}`);
}
function updateHUD(){
  qs('#score') && (qs('#score').textContent = score.score|0);
  qs('#combo') && (qs('#combo').textContent = 'x'+(score.combo||0));
  qs('#time')  && (qs('#time').textContent  = state.timeLeft|0);
}
function updateStatusLine(){
  const el = qs('#statusLine'); if(!el) return;
  el.textContent = `โหมด: ${MODE_NAME_TH[state.modeKey]||state.modeKey} • ความยาก: ${state.difficulty}`;
}

/* ===== Item Pool / Spawner ===== */
const _pool=[]; const POOL_MAX=48;
function createItem(){
  const b=document.createElement('button');
  b.className='item'; b.type='button';
  Object.assign(b.style,{
    position:'fixed', zIndex: '120', fontSize:'clamp(42px,6vw,78px)',
    minWidth:'72px', minHeight:'72px', pointerEvents:'auto'
  });
  return b;
}
function getItemEl(){ return _pool.pop() || createItem(); }
function releaseItemEl(el){ el.onclick=null; el.remove(); if(_pool.length<POOL_MAX)_pool.push(el); }
function place(el){
  el.style.left = (8+Math.random()*84)+'vw';
  el.style.top  = (18+Math.random()*70)+'vh';
  el.animate([{transform:'translateY(0)'},{transform:'translateY(-6px)'},{transform:'translateY(0)'}],
             {duration:1200,iterations:Infinity});
}
function spawnOnce(diff){
  const mode = MODES[state.modeKey]; if(!mode || !mode.pickMeta) return;
  const meta = mode.pickMeta(diff,state);
  const el = getItemEl(); el.textContent = meta.char || '?';
  place(el);
  el.onclick = ()=>{ mode.onHit?.(meta,{score,sfx,fx,power,coach},state,hud); releaseItemEl(el); updateHUD(); };
  document.body.appendChild(el);
  setTimeout(()=>releaseItemEl(el), meta.life || diff.life);
}
const timers={spawn:0,tick:0};
function spawnLoop(){
  if(!state.running) return;
  const base=DIFFS[state.difficulty]; const next=clamp(base.spawn*(power.timeScale||1),240,2500);
  spawnOnce(base); timers.spawn=setTimeout(spawnLoop,next);
}

/* ===== Game Loop ===== */
export function start(opt={}){
  end(true);
  const diff=DIFFS[state.difficulty] || DIFFS.Normal;
  state.running=true; state.timeLeft=diff.time; score.reset();
  forceUILayers(); updateStatusLine();
  setBodyState('playing');   // << ซ่อนเมนูอัตโนมัติ
  MODES[state.modeKey]?.init?.(state,hud,diff);
  updateHUD(); coach.say('เริ่มเกม!');
  tick(); spawnLoop();
}
function tick(){
  if(!state.running) return;
  state.timeLeft--; updateHUD();
  MODES[state.modeKey]?.tick?.(state,{score,fx,sfx,power,coach},hud);
  if(state.timeLeft<=0){ end(); return; }
  timers.tick=setTimeout(tick,1000);
}
export function end(silent=false){
  state.running=false; clearTimeout(timers.spawn); clearTimeout(timers.tick);
  if(!silent){
    setBodyState('result');
    const core=qs('#resCore');
    core && (core.innerHTML = `
      <p>โหมด: <b>${MODE_NAME_TH[state.modeKey]||state.modeKey}</b></p>
      <p>ความยาก: <b>${state.difficulty}</b></p>
      <p>คะแนน: <b>${score.score|0}</b> • คอมโบสูงสุด: <b>x${score.bestCombo||0}</b></p>`);
    qs('#result').style.display='flex';
    coach.say('เยี่ยมมาก!');
  }else{
    setBodyState('menu');
  }
}

/* ===== Menu Events ===== */
document.addEventListener('click',(e)=>{
  const btn=e.target.closest('#menuBar button'); if(!btn) return;
  const a=btn.dataset.action, v=btn.dataset.value;
  if(a==='mode'){ state.modeKey=v; updateStatusLine(); }
  if(a==='diff'){ state.difficulty=v; updateStatusLine(); }
  if(a==='start'){ showHowToThenStart(); }
  if(a==='pause'){
    if(state.running){ state.running=false; setBodyState('paused'); }
    else { state.running=true; setBodyState('playing'); tick(); spawnLoop(); }
  }
  if(a==='restart'){ end(true); showHowToThenStart(); }
  if(a==='help'){ showHelp(); }
});
qs('#btn_home')?.addEventListener('click', ()=>{ qs('#result').style.display='none'; setBodyState('menu'); });

/* ===== Help / How-to-Play กลางจอ แล้วค่อยเริ่ม ===== */
function showHelp(text){
  const help=qs('#help'); const body=qs('#helpBody');
  body && (body.textContent = text || defaultHowTo());
  help && (help.style.display='flex');
}
function hideHelp(){ const help=qs('#help'); help && (help.style.display='none'); }
qs('#btn_help')?.addEventListener('click', ()=>showHelp());
qs('#btn_help_close')?.addEventListener('click', hideHelp);
qs('#btn_ok')?.addEventListener('click', ()=>{ hideHelp(); start(); });

function defaultHowTo(){
  const map = {
    goodjunk:`เก็บอาหารดี 🥦🍎 เลี่ยงขยะ 🍔🍟🥤 • คอมโบเพิ่มคะแนน • มีพาวเวอร์อัป`,
    groups:`ดูหมวดเป้าหมายบน HUD แล้วเก็บให้ตรง • ถูก +7 ผิด -2`,
    hydration:`รักษา 💧 45–65% • N=Normalize(คูลดาวน์) • G=Guard`,
    plate:`เติมโควตาให้ครบ 5 หมู่ • Overfill ลดเวลาเล็กน้อย`
  };
  return map[state.modeKey] || 'เลือกโหมด → เริ่มเกม → เก็บให้ถูกต้อง';
}
function showHowToThenStart(){
  // แสดง Help ตรงกลางก่อนทุกครั้ง (เพื่อแก้ปัญหา “วิธีเล่นไม่เห็น”)
  setBodyState('menu');
  showHelp(defaultHowTo());
}

/* ===== UI layers safe ===== */
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
forceUILayers(); updateStatusLine();

/* ===== Unlock audio ===== */
window.addEventListener('pointerdown', () => {
  try{ document.getElementById('bgm-main')?.play()?.catch(()=>{});}catch{}
}, { once:true, passive:true });

/* Expose (ถ้าต้องใช้จาก ui.js) */
window.start=start; window.end=end; window.setMode=(k)=>{ state.modeKey=k; updateStatusLine(); };
window.setDifficulty=(d)=>{ state.difficulty=d; updateStatusLine(); };
