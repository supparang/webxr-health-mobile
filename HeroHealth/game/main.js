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
  ctx:{ hits:0, miss:0 },
  hyd:50, hydMin:45, hydMax:65
};

// ===== Difficulty (นุ่มขึ้น + อายุยาวขึ้น) =====
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

// ===== UI reset/prepare =====
function uiHideAll(){
  // ซ่อน/รีเซ็ต HUD เฉพาะโหมด
  const H = (sel)=>{ const el=qs(sel); if(el) el.style.display='none'; };
  H('#hydroWrap'); H('#targetWrap'); H('#plateTracker'); H('#missionLine');
  // FEVER bg off
  document.body.classList.remove('fever-bg');
  // รีเซ็ตข้อความ
  const set = (sel, v)=>{ const el=qs(sel); if(el) el.textContent=v; };
  set('#targetBadge','—');
  set('#hydroLabel','—');
  const hydroBar = qs('#hydroBar'); if(hydroBar){ hydroBar.style.width='0%'; }
  const pills = qs('#platePills'); if(pills){ pills.innerHTML=''; }
  const feverBar=qs('#feverBar'); if(feverBar){ feverBar.style.width='0%'; }

  // เคลียร์ไอเท็มลอยที่ค้าง
  try{ document.querySelectorAll('.item').forEach(el=>el.remove()); }catch{}
}

function uiPrepareForMode(){
  // แสดง HUD ตามโหมด & ตั้งค่าเริ่มต้น
  if(state.modeKey==='hydration'){
    const wrap=qs('#hydroWrap');
    if(wrap){ wrap.style.display='block'; }
    state.hyd = 50; // รีเซ็ต
    renderHydration(state.hyd);
  }else if(state.modeKey==='groups'){
    const tw=qs('#targetWrap'); if(tw){ tw.style.display='block'; }
    // badge เริ่มต้นให้ “—” แล้วปล่อยให้โหมดอัปเดตจริง
    const badge=qs('#targetBadge'); if(badge) badge.textContent='—';
  }else if(state.modeKey==='plate'){
    const pw=qs('#plateTracker'); if(pw){ pw.style.display='block'; }
    renderPlatePills(); // เตรียม pill ครบโควตาให้เห็นตั้งแต่ต้น
  }
}

function renderHydration(pct){
  pct = clamp(pct, 0, 100);
  const bar = qs('#hydroBar'); const lbl = qs('#hydroLabel');
  if(bar) bar.style.width = pct + '%';
  if(lbl) lbl.textContent = `${pct|0}% (เป้าหมาย ${state.hydMin}-${state.hydMax}%)`;
}

function renderPlatePills(){
  const box = qs('#platePills'); if(!box) return;
  // โควตาตามคำอธิบาย: ธัญพืช2 ผัก2 โปรตีน1 ผลไม้1 นม1  => รวม 7 pill
  const data = [
    {key:'grain', label:'ธัญพืช', n:2},
    {key:'veg',   label:'ผัก',   n:2},
    {key:'prot',  label:'โปรตีน',n:1},
    {key:'fruit', label:'ผลไม้', n:1},
    {key:'dairy', label:'นม',    n:1},
  ];
  box.innerHTML = '';
  data.forEach(({key,label,n})=>{
    for(let i=0;i<n;i++){
      const span=document.createElement('span');
      span.className='pill';
      span.dataset.role = `plate-${key}`;
      span.textContent = label;
      box.appendChild(span);
    }
  });
}

// ===== Item Pool (ไอคอนใหญ่ คลิกง่าย) =====
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

// ===== Spawner =====
function spawnOnce(diff){
  const mode = MODES[state.modeKey]; if(!mode || !mode.pickMeta) return;
  const meta = mode.pickMeta(diff, state);
  const el = getItemEl();
  el.textContent = meta.char || '?';
  place(el);

  el.onclick = ()=>{
    mode.onHit?.(meta, {score, sfx, fx, power, coach}, state, hud);

    // โหมด hydration: ถ้าโหมดนั้นอัปเดต state.hyd ให้ตามทัน HUD
    if(state.modeKey==='hydration' && typeof state.hyd === 'number'){
      renderHydration(state.hyd);
    }
    // โหมด plate: หากโหมด mark pill เป็น done, ให้ชุดนี้พร้อมรับ (โหมดจะ set class)
    // โหมด groups: โหมดจะอัปเดต targetBadge เอง

    state.ctx.hits = (state.ctx.hits||0) + 1;
    updateHUD();
    releaseItemEl(el);
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
  state.hyd = 50;

  score.reset(); power.reset?.(); hud.reset?.();
  forceUILayers(); uiHideAll(); uiPrepareForMode();
  updateStatusLine();
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

  // Hydration HUD ติดตามค่าแบบเรียลไทม์
  if(state.modeKey==='hydration' && typeof state.hyd === 'number'){
    renderHydration(state.hyd);
  }

  if(state.timeLeft<=0){ end(); return; }
  timers.tick = setTimeout(tick, 1000);
}

export function end(silent=false){
  state.running=false;
  clearTimeout(timers.spawn); clearTimeout(timers.tick);

  // ----- เคลียร์ UI ค้างทั้งหมดเสมอ -----
  uiHideAll();

  // เรียก cleanup ของโหมด (ถ้ามี)
  try{ MODES[state.modeKey]?.cleanup?.(state, hud); }catch{}

  if(!silent){
    setBodyState('result');
    const core=qs('#resCore');
    core && (core.innerHTML = `
      <p>โหมด: <b>${MODE_NAME_TH[state.modeKey]||state.modeKey}</b></p>
      <p>ความยาก: <b>${state.difficulty}</b></p>
      <p>คะแนน: <b>${score.score|0}</b> • คอมโบสูงสุด: <b>x${score.bestCombo||0}</b></p>
    `);
    const res=qs('#result'); if(res) { res.style.display='flex'; res.style.pointerEvents='auto'; }
    coach.say('เยี่ยมมาก!');
  }else{
    setBodyState('menu');
  }
}

// ===== Menu bindings =====
document.addEventListener('click', (e)=>{
  const btn = e.target.closest('#menuBar button'); if(!btn) return;
  const a = btn.dataset.action, v=btn.dataset.value;

  if(a==='mode'){
    // เปลี่ยนโหมด -> เคลียร์ HUD ค้าง แล้วอัปเดต label
    state.modeKey=v; uiHideAll(); uiPrepareForMode(); updateStatusLine();
  }
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

// ===== Result / Replay handlers (closest + ล้างซ้ำ) =====
(function wireResultButtons(){
  const res = document.getElementById('result');
  if (!res) return;

  res.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-result]');
    if (!btn) return;
    const a = btn.getAttribute('data-result');

    if (a === 'replay') {
      hideResultModal();
      if (window.__replayLock) return;
      window.__replayLock = true;

      try { clearTimeout(timers.spawn); clearTimeout(timers.tick); } catch {}
      try { document.querySelectorAll('.item').forEach(el=>el.remove()); } catch {}
      state.running = false;

      setTimeout(()=>{ 
        try { document.body.classList.remove('state-result'); document.body.classList.add('state-menu'); } catch {}
        start(); 
        window.__replayLock = false; 
      }, 60);
    }

    if (a === 'home') {
      hideResultModal();
      try { document.body.classList.remove('state-result'); document.body.classList.add('state-menu'); } catch {}
      setTimeout(()=>document.getElementById('btn_start')?.focus?.(), 50);
    }
  });

  window.addEventListener('keydown', (e)=>{
    if (res.style.display === 'flex' && (e.key === 'Enter' || e.key === ' ')) {
      const replay = res.querySelector('[data-result="replay"]');
      if (replay) replay.click();
    }
  });

  function hideResultModal(){
    res.style.display = 'none';
    res.style.pointerEvents = 'none';
    setTimeout(()=>{ res.style.pointerEvents = ''; }, 0);
  }
})();

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

// Expose
window.start=start; window.end=end;
