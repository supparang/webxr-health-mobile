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
  ctx:{ hits:0, miss:0 }
};

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

// ===== Body state =====
function setBodyState(name){
  const b=document.body;
  b.classList.remove('state-menu','state-playing','state-paused','state-result');
  b.classList.add(`state-${name}`);
}

// ===== HUD =====
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

// ===== UI helpers =====
function forceUILayers(){
  const c=document.getElementById('c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; }
  ['hud','menu','modal','coach','item'].forEach(cls=>{
    document.querySelectorAll('.'+cls).forEach(el=>{
      el.style.pointerEvents='auto';
      el.style.zIndex = Math.max(120, parseInt(getComputedStyle(el).zIndex||'0',10));
    });
  });
}
function uiHideAll(){
  // ซ่อน HUD โหมดเฉพาะ + ล้างค่าแสดงผล
  const fever=qs('#feverBar');   if(fever) fever.style.width='0%';
  const hydroBar=qs('#hydroBar');if(hydroBar) hydroBar.style.width='0%';
  const hydroLb=qs('#hydroLabel');if(hydroLb) hydroLb.textContent='—';
  const badge=qs('#targetBadge'); if(badge) badge.textContent='—';
  const pills=qs('#platePills');  if(pills) pills.innerHTML='';

  ['#hydroWrap','#targetWrap','#plateTracker','#missionLine'].forEach(sel=>{
    const el=qs(sel); if(el) el.style.display='none';
  });

  // เคลียร์ไอเท็มค้างบนจอ
  document.querySelectorAll('.item').forEach(el=>el.remove());
}
function uiPrepareForMode(){
  if(state.modeKey==='hydration'){
    const w=qs('#hydroWrap'); if(w) w.style.display='block';
    // รีเซ็ตบาร์เป็นค่าเริ่มต้น (ถ้าโหมดไปควบคุมเองก็ไม่ผิด)
    const hydroBar=qs('#hydroBar'); if(hydroBar) hydroBar.style.width='50%';
    const lb=qs('#hydroLabel'); if(lb) lb.textContent='50%';
  }
  if(state.modeKey==='groups'){
    const t=qs('#targetWrap'); if(t) t.style.display='block';
  }
  if(state.modeKey==='plate'){
    const p=qs('#plateTracker'); if(p) p.style.display='block';
  }
}

// ===== Effect: แตกกระจายตอนกด =====
function explodeAt(el, glyph='✨'){
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width/2;
  const cy = rect.top  + rect.height/2;

  const cont = document.createElement('div');
  Object.assign(cont.style,{
    position:'fixed', left:(cx-1)+'px', top:(cy-1)+'px',
    width:'2px', height:'2px', pointerEvents:'none', zIndex:'130'
  });

  const N = 10;
  for(let i=0;i<N;i++){
    const sp = document.createElement('span');
    sp.textContent = glyph;
    Object.assign(sp.style,{
      position:'absolute', left:'0', top:'0', fontSize:'20px', opacity:'1',
      transform:`translate(-50%,-50%) scale(1)`
    });
    const ang = (Math.PI*2*i)/N + Math.random()*0.5;
    const dist = 40 + Math.random()*40;
    sp.animate([
      { opacity:1, transform:'translate(-50%,-50%) scale(1)' },
      { opacity:.9, transform:`translate(${Math.cos(ang)*dist}px, ${Math.sin(ang)*dist}px) scale(0.9)` },
      { opacity:0, transform:`translate(${Math.cos(ang)*(dist+20)}px, ${Math.sin(ang)*(dist+20)}px) scale(0.8)` }
    ], { duration:480, easing:'cubic-bezier(.2,.8,.2,1)', fill:'forwards' });
    cont.appendChild(sp);
  }
  document.body.appendChild(cont);
  setTimeout(()=>cont.remove(), 520);
}

// ===== Items =====
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
  el.style.left = (8 + Math.random()*84) + 'vw';
  el.style.top  = (18 + Math.random()*70) + 'vh';
  el.animate([
    {transform:'translateY(0)'}, {transform:'translateY(-6px)'}, {transform:'translateY(0)'}
  ], {duration:1200, iterations:Infinity});
}

// ===== Spawn =====
function spawnOnce(diff){
  const mode=MODES[state.modeKey]; if(!mode || !mode.pickMeta) return;
  const meta=mode.pickMeta(diff,state);
  const el=getItemEl(); el.textContent = meta.char || '?';
  place(el);

  el.onclick = ()=>{
    // เอฟเฟกต์แตกกระจาย
    explodeAt(el, meta.char || '✨');

    // โหมดตัดสินคะแนน
    mode.onHit?.(meta,{score,sfx,fx,power,coach},state,hud);
    state.ctx.hits = (state.ctx.hits||0)+1;
    updateHUD();

    // ลบชิ้นที่กด
    releaseItemEl(el);
  };

  document.body.appendChild(el);
  const life = meta.life || diff.life || 2800;
  setTimeout(()=>{ if(el.isConnected) releaseItemEl(el); }, life);
}

const timers={spawn:0,tick:0};
function spawnLoop(){
  if(!state.running) return;
  const base=DIFFS[state.difficulty] || DIFFS.Normal;
  spawnOnce(base);
  const next=Math.max(450, Math.round(base.spawn * (power.timeScale||1)));
  timers.spawn=setTimeout(spawnLoop,next);
}

// ===== Game Loop =====
export function start(){
  end(true); // reset สภาพเดิม
  const diff=DIFFS[state.difficulty] || DIFFS.Normal;

  state.running=true;
  state.timeLeft=diff.time;
  state.ctx={ hits:0, miss:0 };
  score.reset(); power.reset?.(); hud.reset?.();

  forceUILayers(); uiHideAll(); uiPrepareForMode();
  updateStatusLine(); setBodyState('playing');

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
  state.running=false;
  clearTimeout(timers.spawn); clearTimeout(timers.tick);

  // เรียก cleanup ของโหมด (ล้าง HUD/ค่าค้าง)
  try{ MODES[state.modeKey]?.cleanup?.(state,hud); }catch{}

  // ล้าง UI ค้างแน่ๆ
  uiHideAll();

  if(!silent){
    setBodyState('result');
    const core=qs('#resCore');
    core && (core.innerHTML = `
      <p>โหมด: <b>${MODE_NAME_TH[state.modeKey]||state.modeKey}</b></p>
      <p>ความยาก: <b>${state.difficulty}</b></p>
      <p>คะแนน: <b>${score.score|0}</b> • คอมโบสูงสุด: <b>x${score.bestCombo||0}</b></p>
    `);
    const res=qs('#result'); if(res){ res.style.display='flex'; res.style.pointerEvents='auto'; }
    coach.say('เยี่ยมมาก!');
  }else{
    setBodyState('menu');
  }
}

// ===== Menu bindings =====
document.addEventListener('click',(e)=>{
  const btn=e.target.closest('#menuBar button'); if(!btn) return;
  const a=btn.dataset.action, v=btn.dataset.value;
  if(a==='mode'){ state.modeKey=v; uiHideAll(); uiPrepareForMode(); updateStatusLine(); }
  if(a==='diff'){ state.difficulty=v; updateStatusLine(); }
  if(a==='start'){ start(); }
  if(a==='pause'){ if(state.running){ state.running=false; setBodyState('paused'); } else { state.running=true; setBodyState('playing'); tick(); spawnLoop(); } }
  if(a==='restart'){ end(true); start(); }
  if(a==='help'){ const h=qs('#help'); if(h) h.style.display='flex'; }
});
qs('#btn_ok')?.addEventListener('click', ()=>{ qs('#help').style.display='none'; });
qs('#btn_home')?.addEventListener('click', ()=>{ qs('#result').style.display='none'; setBodyState('menu'); });

// ===== Replay wiring =====
(function wireResult(){
  const res=document.getElementById('result'); if(!res) return;
  res.addEventListener('click',(e)=>{
    const x=e.target.closest('[data-result]'); if(!x) return;
    const a=x.getAttribute('data-result');
    if(a==='replay'){ res.style.display='none'; end(true); start(); }
    if(a==='home'){   res.style.display='none'; setBodyState('menu'); }
  });
})();

// ===== Ensure layers once =====
forceUILayers();
updateStatusLine();

// ===== Unlock audio on first gesture =====
['pointerdown','touchstart','keydown'].forEach(ev=>{
  window.addEventListener(ev,()=>{ try{ document.getElementById('bgm-main')?.play(); }catch{} }, {once:true, passive:true});
});

// Expose
window.start=start; window.end=end;
