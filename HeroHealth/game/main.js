// game/main.js
// === Hero Health Academy — main.js (coach online + quests + 3D burst fixed) ===

window.__HHA_BOOT_OK = true;

// ----- Imports -----
import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { Engine } from './core/engine.js';
import { HUD } from './core/hud.js';
import { Coach } from './core/coach.js';
import { SFX } from './core/sfx.js';
import { ScoreSystem } from './core/score.js';
import { PowerUpSystem } from './core/powerup.js';

import * as goodjunk from './modes/goodjunk.js';
import * as groups from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate from './modes/plate.js';

// ----- Helpers -----
const $ = (s)=>document.querySelector(s);
const byAction = (el)=>el?.closest?.('[data-action]')||null;
const setText = (sel,txt)=>{ const el=$(sel); if(el) el.textContent = txt; };

// ----- Config -----
const MODES = { goodjunk, groups, hydration, plate };
const DIFFS = {
  Easy:   { time: 70, spawn: 900, life: 4200 },
  Normal: { time: 60, spawn: 700, life: 3000 },
  Hard:   { time: 50, spawn: 550, life: 1800 }
};
const ICON_SIZE_MAP = { Easy: 92, Normal: 72, Hard: 58 };
const MAX_ITEMS = 10;
const LIVE = new Set();

// I18N
const I18N = {
  TH:{ names:{goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ'},
       diffs:{Easy:'ง่าย', Normal:'ปกติ', Hard:'ยาก'} },
  EN:{ names:{goodjunk:'Good vs Junk', groups:'Food Groups', hydration:'Hydration', plate:'Healthy Plate'},
       diffs:{Easy:'Easy', Normal:'Normal', Hard:'Hard'} }
};
const T = (lang)=>I18N[lang]||I18N.TH;

// ----- Systems & State -----
const hud   = new HUD();
const sfx   = new SFX();
const score = new ScoreSystem();
const power = new PowerUpSystem();
const eng   = new Engine(THREE, document.getElementById('c'));
const coach = new Coach({ lang: localStorage.getItem('hha_lang') || 'TH' });

const state = {
  modeKey:'goodjunk',
  difficulty:'Normal',
  running:false,
  paused:false,
  timeLeft:60,
  lang: localStorage.getItem('hha_lang') || 'TH',
  gfx:  localStorage.getItem('hha_gfx')  || 'quality',
  haptic: (localStorage.getItem('hha_haptic') ?? '1')==='1',
  combo:0, bestCombo:0,
  fever:{ active:false, meter:0, drainPerSec:14, chargeGood:10, chargePerfect:20, threshold:100, mul:2, timeLeft:0 },
  spawnTimer:0, tickTimer:0, ctx:{},
  stats:{good:0,perfect:0,ok:0,bad:0},
  _accHist:[],
  freezeUntil:0,
  questNames:{},
  didWarnT10:false
};

// ----- Tiny UI -----
function applyUI(){
  const L = T(state.lang);
  setText('#modeName',   L.names[state.modeKey]||state.modeKey);
  setText('#difficulty', L.diffs[state.difficulty]||state.difficulty);
}
function updateHUD(){
  hud.setScore?.(score.score);
  hud.setTime?.(state.timeLeft|0);
  hud.setCombo?.('x'+state.combo);
}

// ----- Fever -----
function setFeverBar(pct){
  const bar = $('#feverBar'); if(!bar) return;
  bar.style.width = Math.max(0, Math.min(100, pct|0))+'%';
}
function showFeverLabel(show){
  const f = $('#fever'); if(!f) return;
  f.style.display = show?'block':'none';
  f.classList.toggle('pulse', !!show);
}
function startFever(){
  if (state.fever.active) return;
  state.fever.active = true;
  state.fever.timeLeft = 7;
  showFeverLabel(true);
  coach.onFever?.();
  try{ $('#sfx-powerup')?.play(); }catch{}
}
function stopFever(){
  if (!state.fever.active) return;
  state.fever.active = false;
  state.fever.timeLeft = 0;
  showFeverLabel(false);
  coach.onFeverEnd?.();
}

// ----- Score FX -----
function makeScoreBurst(x,y,text,minor,color){
  const el = document.createElement('div');
  el.className='scoreBurst';
  el.style.cssText = `
    position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
    font:700 20px/1.2 ui-rounded,system-ui,Arial;color:${color||'#7fffd4'};
    text-shadow:0 2px 6px #000c;z-index:120;pointer-events:none;opacity:0;translate:0 6px;
    transition:opacity .22s, translate .22s;`;
  el.textContent = text;
  if (minor){
    const m = document.createElement('div');
    m.style.cssText = 'font:600 12px/1.2 ui-rounded,system-ui;opacity:.9';
    m.textContent = minor; el.appendChild(m);
  }
  document.body.appendChild(el);
  requestAnimationFrame(()=>{ el.style.opacity='1'; el.style.translate='0 0'; });
  setTimeout(()=>{ el.style.opacity='0'; el.style.translate='0 -8px'; setTimeout(()=>{ try{el.remove();}catch{} }, 220); }, 720);
}
function makeFlame(x,y,strong){
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
    width:${strong?72:56}px;height:${strong?72:56}px;border-radius:50%;
    background:radial-gradient(closest-side,#ffd54a,#ff6d00);
    mix-blend-mode:screen;filter:blur(8px) brightness(1.1);opacity:.9;z-index:110;
    pointer-events:none;animation:flamePop .5s ease-out forwards;`;
  document.body.appendChild(el);
  setTimeout(()=>{ try{el.remove();}catch{} }, 520);
}
(function injectKF(){
  if (document.getElementById('flameKF')) return;
  const st = document.createElement('style'); st.id='flameKF';
  st.textContent = `@keyframes flamePop{from{transform:translate(-50%,-50%) scale(.7);opacity:.0}to{transform:translate(-50%,-50%) scale(1.05);opacity:.0}}`;
  document.head.appendChild(st);
})();
function scoreWithEffects(base,x,y){
  const comboMul = state.combo>=20?1.4:(state.combo>=10?1.2:1.0);
  const feverMul = state.fever.active?state.fever.mul:1.0;
  const total = Math.round(base*comboMul*feverMul);
  score.add?.(total);
  const tag = total>=0?('+'+total):(''+total);
  const minor = (comboMul>1||feverMul>1)?('x'+comboMul.toFixed(1)+(feverMul>1?' & FEVER':'')):'';
  const color = total>=0?(feverMul>1?'#ffd54a':'#7fffd4'):'#ff9b9b';
  makeScoreBurst(x,y,tag,minor,color);
  if (state.fever.active) makeFlame(x,y,total>=10);
}

// ----- Combo -----
function addCombo(kind){
  if (kind==='bad'){
    state.combo=0; hud.setCombo?.('x0'); coach.onBad?.(); return;
  }
  if (kind==='good' || kind==='perfect'){
    state.combo++; state.bestCombo = Math.max(state.bestCombo, state.combo);
    hud.setCombo?.('x'+state.combo);
    if (kind==='perfect') coach.onPerfect?.(); else coach.onGood?.();

    if (!state.fever.active){
      const gain = (kind==='perfect')?state.fever.chargePerfect:state.fever.chargeGood;
      state.fever.meter = Math.min(100, state.fever.meter + gain);
      setFeverBar(state.fever.meter);
      if (state.fever.meter>=state.fever.threshold) startFever();
    } else {
      state.fever.timeLeft = Math.min(10, state.fever.timeLeft + 0.6);
    }
    coach.onCombo?.(state.combo);
  }
}

// ----- Spawn helpers -----
function safeBounds(){
  const headerH = $('header.brand')?.offsetHeight || 56;
  const menuH   = $('#menuBar')?.offsetHeight || 120;
  const yMin = headerH + 60;
  const yMax = Math.max(yMin+50, window.innerHeight - menuH - 80);
  const xMin = 20;
  const xMax = Math.max(xMin+50, window.innerWidth - 80);
  return {xMin,xMax,yMin,yMax};
}
function randPos(){
  const {xMin,xMax,yMin,yMax} = safeBounds();
  return { left: xMin + Math.random()*(xMax-xMin), top: yMin + Math.random()*(yMax-yMin) };
}
function overlapped(x,y){
  for (const n of LIVE){
    const r = n.getBoundingClientRect();
    const dx = (r.left+r.width/2) - x;
    const dy = (r.top +r.height/2) - y;
    if (Math.hypot(dx,dy) < 64) return true;
  }
  return false;
}

// ----- FX root + 3D helpers (SINGLE VERSION) -----
let FXROOT = document.querySelector('.fx3d-root');
if (!FXROOT){
  FXROOT = document.createElement('div');
  FXROOT.className = 'fx3d-root';
  document.addEventListener('DOMContentLoaded', ()=> document.body.appendChild(FXROOT));
}
function add3DTilt(el){
  let rect;
  const maxTilt = 12;
  const upd = (x,y)=>{
    if (!rect) rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width/2;
    const cy = rect.top  + rect.height/2;
    const dx = (x - cx) / (rect.width/2);
    const dy = (y - cy) / (rect.height/2);
    const rx = Math.max(-1, Math.min(1, dy)) * maxTilt;
    const ry = Math.max(-1, Math.min(1, -dx)) * maxTilt;
    el.style.transform = `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  };
  const clear = ()=>{ el.style.transform='perspective(600px) rotateX(0) rotateY(0)'; rect=null; };
  el.addEventListener('pointermove', (e)=> upd(e.clientX, e.clientY), {passive:true});
  el.addEventListener('pointerleave', clear, {passive:true});
  el.addEventListener('pointerdown', (e)=> upd(e.clientX, e.clientY), {passive:true});
  el.addEventListener('pointerup', clear, {passive:true});
}
function shatter3D(x, y){
  // ring
  const ring = document.createElement('div');
  ring.className = 'burstRing';
  ring.style.left = x + 'px';
  ring.style.top  = y + 'px';
  FXROOT.appendChild(ring);
  ring.style.animation = 'ringOut .45s ease-out forwards';
  setTimeout(()=>{ try{ ring.remove(); }catch{} }, 500);
  // shards
  const SHARDS = 10 + (Math.random()*6|0);
  for (let i=0;i<SHARDS;i++){
    const s = document.createElement('div');
    s.className = 'shard';
    s.style.left = x + 'px';
    s.style.top  = y + 'px';
    const ang = Math.random()*Math.PI*2;
    const dist = 50 + Math.random()*90;
    const tx = Math.cos(ang)*dist;
    const ty = Math.sin(ang)*dist;
    const tz = (Math.random()*2-1)*140;
    const rot = (Math.random()*720 - 360) + 'deg';
    s.style.setProperty('--x0','-50%');
    s.style.setProperty('--y0','-50%');
    s.style.setProperty('--x1', `${tx}px`);
    s.style.setProperty('--y1', `${ty}px`);
    s.style.setProperty('--z1', `${tz}px`);
    s.style.setProperty('--rot', rot);
    FXROOT.appendChild(s);
    s.style.animation = `shardFly ${0.45 + Math.random()*0.15}s ease-out forwards`;
    setTimeout(()=>{ try{ s.remove(); }catch{} }, 600);
  }
  // sparks
  const SP = 8 + (Math.random()*4|0);
  for (let i=0;i<SP;i++){
    const p = document.createElement('div');
    p.className='spark';
    p.style.left = x + 'px';
    p.style.top  = y + 'px';
    const ang = Math.random()*Math.PI*2;
    const d = 20 + Math.random()*50;
    const tx = Math.cos(ang)*d;
    const ty = Math.sin(ang)*d;
    p.style.setProperty('--sx0','-50%');
    p.style.setProperty('--sy0','-50%');
    p.style.setProperty('--sx1', `${tx}px`);
    p.style.setProperty('--sy1', `${ty}px`);
    FXROOT.appendChild(p);
    p.style.animation = `sparkUp .35s ease-out forwards`;
    setTimeout(()=>{ try{ p.remove(); }catch{} }, 420);
  }
}

// ----- Spawn one (SINGLE VERSION) -----
function spawnOnce(diff){
  if (!state.running || state.paused) return;

  const now = performance?.now?.() || Date.now();
  if (state.freezeUntil && now < state.freezeUntil){
    state.spawnTimer = setTimeout(()=>spawnOnce(diff), 120);
    return;
  }
  if (LIVE.size >= MAX_ITEMS){
    state.spawnTimer = setTimeout(()=>spawnOnce(diff), 180);
    return;
  }

  const mode = MODES[state.modeKey];
  const meta = mode?.pickMeta?.(diff, state) || {};

  const el = document.createElement('button');
  el.className='item'; el.type='button';
  el.textContent = meta.char || '❓';
  const px = ICON_SIZE_MAP[state.difficulty] || 72;
  el.style.cssText = `
    position:fixed;border:none;background:transparent;color:#fff;cursor:pointer;z-index:80;
    line-height:1;transition:transform .15s, filter .15s, opacity .15s;padding:8px;border-radius:14px;font-size:${px}px;`;

  add3DTilt(el);

  // anti-overlap
  let pos = randPos(), tries=0;
  while (tries++<12 && overlapped(pos.left,pos.top)) pos = randPos();
  el.style.left = pos.left+'px';
  el.style.top  = pos.top +'px';

  el.addEventListener('click', (ev)=>{
    ev.stopPropagation();
    try{
      const sys = { score, sfx, power, coach, fx: eng?.fx };
      const res = mode?.onHit?.(meta, sys, state, hud) || (meta.good?'good':'ok');

      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top  + r.height/2;

      if (res==='power'){ coach.onPower?.(meta.power==='scorex2'?'boost':meta.power); }

      state.stats[res] = (state.stats[res]||0)+1;
      if (res==='good' || res==='perfect') addCombo(res);
      if (res==='bad') addCombo('bad');

      const base = ({good:7,perfect:14,ok:2,bad:-3,power:5})[res] || 1;
      scoreWithEffects(base, cx, cy);

      if (state.haptic && navigator.vibrate){
        if (res==='bad') navigator.vibrate(60);
        else if (res==='perfect') navigator.vibrate([12,30,12]);
        else if (res==='good') navigator.vibrate(12);
      }

      // 3D burst
      shatter3D(cx, cy);
    }catch(e){
      console.error('[HHA] onHit error:', e);
    }finally{
      setTimeout(()=>{ try{ LIVE.delete(el); el.remove(); }catch{} }, 60);
    }
  }, {passive:true});

  document.body.appendChild(el);
  LIVE.add(el);
  const ttl = meta.life || diff.life || 3000;
  setTimeout(()=>{ try{ LIVE.delete(el); el.remove(); }catch{} }, ttl);
}

// ----- Spawn loop (adaptive) -----
function spawnLoop(){
  if (!state.running || state.paused) return;

  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  const total = state.stats.good + state.stats.perfect + state.stats.ok + state.stats.bad;
  const accNow = total>0 ? (state.stats.good + state.stats.perfect)/total : 1;
  state._accHist.push(accNow); if (state._accHist.length>8) state._accHist.shift();
  const acc = state._accHist.reduce((s,x)=>s+x,0)/state._accHist.length;
  const tune = acc>0.88 ? 0.92 : acc<0.58 ? 1.10 : 1.00;

  const dyn = {
    time: diff.time,
    spawn: Math.max(300, Math.round((diff.spawn||700) * tune)),
    life:  Math.max(900,  Math.round((diff.life ||3000) / tune))
  };

  spawnOnce(dyn);
  const next = Math.max(220, dyn.spawn * (power.timeScale || 1));
  state.spawnTimer = setTimeout(spawnLoop, next);
}

// ----- Tick / Start / End -----
function tick(){
  if (!state.running || state.paused) return;

  if (state.fever.active){
    state.fever.timeLeft = Math.max(0, state.fever.timeLeft - 1);
    state.fever.meter = Math.max(0, state.fever.meter - state.fever.drainPerSec);
    setFeverBar(state.fever.meter);
    if (state.fever.timeLeft<=0 || state.fever.meter<=0) stopFever();
  }

  try{ MODES[state.modeKey]?.tick?.(state, {score,sfx,power,coach,fx:eng?.fx}, hud); }catch(e){ console.warn('[HHA] mode.tick error:', e); }

  state.timeLeft = Math.max(0, state.timeLeft - 1);
  updateHUD();

  if (state.timeLeft===10 && !state.didWarnT10){ state.didWarnT10=true; coach.onTimeLow?.(); try{$('#sfx-tick')?.play();}catch{} }

  if (state.timeLeft<=0){ end(); return; }
  if (state.timeLeft<=10){ document.body.classList.add('flash'); } else { document.body.classList.remove('flash'); }

  state.tickTimer = setTimeout(tick, 1000);
}

// countdown overlay
async function runCountdown(sec=5){
  const overlayId='cdOverlay';
  let ov = document.getElementById(overlayId);
  if (!ov){
    ov = document.createElement('div'); ov.id=overlayId;
    ov.style.cssText='position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:150;pointer-events:none;';
    const b = document.createElement('div'); b.id='cdNum';
    b.style.cssText='font:900 72px/1 ui-rounded,system-ui;color:#fff;text-shadow:0 2px 14px #000c;';
    ov.appendChild(b); document.body.appendChild(ov);
  }
  const b = document.getElementById('cdNum');
  for (let n=sec;n>0;n--){
    b.textContent = n;
    coach.onCountdown?.(n);
    await new Promise(r=>setTimeout(r, 1000));
  }
  b.textContent='Go!';
  await new Promise(r=>setTimeout(r, 500));
  try{ ov.remove(); }catch{}
}

async function start(){
  end(true);
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;

  await runCountdown(5);

  state.running = true; state.paused=false;
  state.timeLeft = diff.time;
  state.combo=0; state.stats={good:0,perfect:0,ok:0,bad:0};
  state._accHist=[]; state.freezeUntil=0; state.fever.meter=0; state.didWarnT10=false;
  setFeverBar(0); stopFever(); score.reset?.(); updateHUD();

  try{ MODES[state.modeKey]?.init?.(state, hud, diff); }catch(e){ console.error('[HHA] mode.init error:', e); }
  coach.onStart?.(state.modeKey);
  tick(); spawnLoop();
}

function end(silent=false){
  state.running=false; state.paused=false;
  clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer);
  try{ MODES[state.modeKey]?.cleanup?.(state, hud); }catch{}

  for (const n of Array.from(LIVE)){ try{ n.remove(); }catch{} LIVE.delete(n); }

  if (!silent){
    const modal = $('#result'); if (modal) modal.style.display='flex';
    coach.onEnd?.(score.score, {grade: score.score>=200?'A':'B'});
  }
}

// ----- Events -----
document.addEventListener('pointerup', (e)=>{
  const btn = byAction(e.target); if(!btn) return;
  const a = btn.getAttribute('data-action'); const v = btn.getAttribute('data-value');

  if (a==='mode'){ state.modeKey=v; applyUI(); if (state.running) start(); }
  else if (a==='diff'){ state.difficulty=v; applyUI(); if (state.running) start(); }
  else if (a==='start'){ start(); }
  else if (a==='pause'){
    if (!state.running){ start(); return; }
    state.paused = !state.paused;
    if (!state.paused){ tick(); spawnLoop(); }
    else { clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer); }
  }
  else if (a==='restart'){ end(true); start(); }
  else if (a==='help'){ const m=$('#help'); if (m) m.style.display='flex'; }
  else if (a==='helpClose'){ const m=$('#help'); if (m) m.style.display='none'; }
  else if (a==='helpScene'){ const hs=$('#helpScene'); if (hs) hs.style.display='flex'; }
  else if (a==='helpSceneClose'){ const hs=$('#helpScene'); if (hs) hs.style.display='none'; }
}, {passive:true});

// Result buttons
const resEl = $('#result');
if (resEl){
  resEl.addEventListener('click', (e)=>{
    const a = e.target.getAttribute('data-result');
    if (a==='replay'){ resEl.style.display='none'; start(); }
    if (a==='home'){ resEl.style.display='none'; end(true); }
  });
}

// Toggles
$('#langToggle')?.addEventListener('click', ()=>{
  state.lang = state.lang==='TH' ? 'EN' : 'TH';
  localStorage.setItem('hha_lang', state.lang);
  coach.setLang?.(state.lang);
  applyUI();
}, {passive:true});

$('#gfxToggle')?.addEventListener('click', ()=>{
  state.gfx = state.gfx==='low' ? 'quality' : 'low';
  localStorage.setItem('hha_gfx', state.gfx);
  try{ eng.renderer.setPixelRatio(state.gfx==='low'?0.75:(window.devicePixelRatio||1)); }catch{}
}, {passive:true});

$('#soundToggle')?.addEventListener('click', ()=>{
  const on = localStorage.getItem('hha_sound') !== '0';
  const nxt = !on; localStorage.setItem('hha_sound', nxt?'1':'0');
  sfx.setEnabled?.(nxt);
  $('#soundToggle').textContent = nxt ? '🔊 เสียง: เปิด' : '🔇 เสียง: ปิด';
  if (nxt){ try{ sfx.play('sfx-good'); }catch{} }
}, {passive:true});

$('#hapticToggle')?.addEventListener('click', ()=>{
  state.haptic = !state.haptic;
  localStorage.setItem('hha_haptic', state.haptic?'1':'0');
  $('#hapticToggle').textContent = state.haptic ? '📳 สั่น: เปิด' : '📴 สั่น: ปิด';
}, {passive:true});

// Auto-pause on tab hide
document.addEventListener('visibilitychange', ()=>{
  if (document.hidden && state.running && !state.paused){
    state.paused = true; clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer);
  }
});

// Unlock audio
window.addEventListener('pointerdown', ()=>{ try{ sfx.unlock(); }catch{} }, {once:true, passive:true});

// Boot
applyUI(); updateHUD();
