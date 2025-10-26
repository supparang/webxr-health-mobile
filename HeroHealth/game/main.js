// game/main.js
// Stable + Coach works + 5s countdown + quest cheer

window.__HHA_BOOT_OK = true;

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

const $ = (s)=>document.querySelector(s);
const byAction = (el)=>el?.closest?.('[data-action]') || null;
const setText = (sel, txt)=>{ const el=$(sel); if(el) el.textContent = txt; };

const MODES = { goodjunk, groups, hydration, plate };
const DIFFS = {
  Easy:   { time:70, spawn:900, life:4200 },
  Normal: { time:60, spawn:700, life:3000 },
  Hard:   { time:50, spawn:550, life:1800 }
};
const ICON_SIZE_MAP = { Easy: 92, Normal: 72, Hard: 58 };
const MAX_ITEMS = 10;
const LIVE = new Set();

const I18N = {
  TH:{names:{goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ'}, diffs:{Easy:'ง่าย', Normal:'ปกติ', Hard:'ยาก'}},
  EN:{names:{goodjunk:'Good vs Junk', groups:'Food Groups', hydration:'Hydration', plate:'Healthy Plate'}, diffs:{Easy:'Easy', Normal:'Normal', Hard:'Hard'}}
};
const T = (l)=>I18N[l]||I18N.TH;

// systems
const hud   = new HUD();
const sfx   = new SFX();
const score = new ScoreSystem();
const power = new PowerUpSystem();
const eng   = new Engine(THREE, document.getElementById('c'));
const coach = new Coach({ lang: localStorage.getItem('hha_lang') || 'TH' });

const state = {
  modeKey:'goodjunk', difficulty:'Normal',
  running:false, paused:false, timeLeft:60,
  lang: localStorage.getItem('hha_lang') || 'TH',
  gfx:  localStorage.getItem('hha_gfx') || 'quality',
  combo:0, bestCombo:0,
  fever:{ active:false, meter:0, drainPerSec:14, chargeGood:10, chargePerfect:20, threshold:100, mul:2, timeLeft:0 },
  spawnTimer:0, tickTimer:0,
  ctx:{}, stats:{ good:0, perfect:0, ok:0, bad:0 }, _accHist:[],
  freezeUntil:0
};

function applyUI(){
  const L=T(state.lang);
  setText('#modeName', L.names[state.modeKey]||state.modeKey);
  setText('#difficulty', L.diffs[state.difficulty]||state.difficulty);
}
function updateHUD(){
  hud.setScore?.(score.score);
  hud.setTime?.(state.timeLeft);
  hud.setCombo?.('x'+state.combo);
}
function setFeverBar(pct){ const b=$('#feverBar'); if(b) b.style.width=Math.max(0,Math.min(100,pct|0))+'%'; }
function showFeverLabel(on){ const f=$('#fever'); if(!f) return; f.style.display=on?'block':'none'; f.classList.toggle('pulse', !!on); }

function startFever(){ if(state.fever.active) return; state.fever.active=true; state.fever.timeLeft=7; showFeverLabel(true); coach.onFever?.(); try{$('#sfx-powerup')?.play();}catch{} }
function stopFever(){ if(!state.fever.active) return; state.fever.active=false; state.fever.timeLeft=0; showFeverLabel(false); coach.onFeverEnd?.(); }

function scoreBurst(x, y, text, minor, color){
  const el = document.createElement('div');
  el.className = 'scoreBurst';
  el.style.left = x+'px'; el.style.top = y+'px';
  el.textContent = text;
  if (minor){ const m=document.createElement('div'); m.className='minor'; m.textContent=minor; el.appendChild(m); }
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('on'));
  setTimeout(()=>{ el.classList.remove('on'); setTimeout(()=>{ try{el.remove();}catch{} },220); },720);
}
function flameBurst(x, y, strong){
  const el = document.createElement('div');
  el.className='flameBurst'+(strong?' strong':'');
  el.style.left=x+'px'; el.style.top=y+'px';
  document.body.appendChild(el);
  setTimeout(()=>{ try{el.remove();}catch{} },520);
}
function scoreWithEffects(base, x, y){
  const comboMul = state.combo>=20?1.4: state.combo>=10?1.2:1.0;
  const feverMul = state.fever.active?state.fever.mul:1.0;
  const total = Math.round(base * comboMul * feverMul);
  score.add?.(total);
  const tag = total>=0?('+'+total):(''+total);
  const minor = (comboMul>1 || feverMul>1) ? ('x'+comboMul.toFixed(1)+(feverMul>1?' & FEVER':'')) : '';
  const color = total>=0 ? (feverMul>1?'#ffd54a':'#7fffd4') : '#ff9b9b';
  scoreBurst(x,y,tag,minor,color);
  if (state.fever.active) flameBurst(x,y,total>=10);
}

function addCombo(kind){
  if (kind==='bad'){ state.combo=0; hud.setCombo?.('x0'); return; }
  if (kind==='good' || kind==='perfect'){
    state.combo++; state.bestCombo=Math.max(state.bestCombo,state.combo);
    hud.setCombo?.('x'+state.combo);
    coach.onCombo?.(state.combo);
    if(!state.fever.active){
      const gain=(kind==='perfect')?state.fever.chargePerfect:state.fever.chargeGood;
      state.fever.meter=Math.min(100,state.fever.meter+gain);
      setFeverBar(state.fever.meter);
      if (state.fever.meter>=state.fever.threshold) startFever();
    }else{
      state.fever.timeLeft=Math.min(10,state.fever.timeLeft+0.6);
    }
  }
}

// safe spawn
function safeBounds(){
  const headerH = $('header.brand')?.offsetHeight || 56;
  const menuH = $('#menuBar')?.offsetHeight || 120;
  const yMin = headerH + 60, yMax = Math.max(yMin+50, innerHeight - menuH - 80);
  const xMin = 20, xMax = Math.max(xMin+50, innerWidth - 80);
  return {xMin,xMax,yMin,yMax};
}
function randPos(){ const {xMin,xMax,yMin,yMax}=safeBounds(); return { left:xMin+Math.random()*(xMax-xMin), top:yMin+Math.random()*(yMax-yMin) }; }
function overlapped(x,y){
  for (const n of LIVE){
    const r=n.getBoundingClientRect();
    const dx=(r.left+r.width/2)-x, dy=(r.top+r.height/2)-y;
    if (Math.hypot(dx,dy)<64) return true;
  } return false;
}

// 3D pop (คลิกแล้วแตก)
function smash3D(el){
  el.classList.add('smash3d');
  setTimeout(()=>{ try{ el.remove(); }catch{} }, 320);
}

// Spawn
function spawnOnce(diff){
  if (!state.running || state.paused) return;

  const now = performance?.now?.()||Date.now();
  if (state.freezeUntil && now < state.freezeUntil){
    state.spawnTimer = setTimeout(()=>spawnOnce(diff), 120); return;
  }
  if (LIVE.size >= MAX_ITEMS){
    state.spawnTimer = setTimeout(()=>spawnOnce(diff), 160); return;
  }

  const mode = MODES[state.modeKey];
  const meta = mode?.pickMeta?.(diff, state) || {};

  const el = document.createElement('button');
  el.className='item';
  el.type='button';
  el.textContent = meta.char || '❓';
  const px = ICON_SIZE_MAP[state.difficulty] || 72;
  el.style.fontSize = px+'px';

  // 3D hover
  el.addEventListener('pointerenter', ()=> el.style.transform='translateZ(0) scale(1.12)', {passive:true});
  el.addEventListener('pointerleave', ()=> el.style.transform='scale(1)', {passive:true});

  // position (anti overlap)
  let pos = randPos(), tries=0;
  while(tries++<12 && overlapped(pos.left,pos.top)) pos=randPos();
  el.style.left=pos.left+'px'; el.style.top=pos.top+'px';

  el.addEventListener('click', (ev)=>{
    ev.stopPropagation();
    try{
      const sys = { score, sfx, power, coach, fx: eng?.fx };
      const res = mode?.onHit?.(meta, sys, state, hud) || (meta.good?'good':'ok');
      const r = el.getBoundingClientRect(); const cx=r.left+r.width/2, cy=r.top+r.height/2;

      state.stats[res]=(state.stats[res]||0)+1;
      if (res==='good'||res==='perfect') addCombo(res);
      if (res==='bad') addCombo('bad');

      const base = ({ good:7, perfect:14, ok:2, bad:-3, power:5 })[res] || 1;
      scoreWithEffects(base, cx, cy);

      if (navigator.vibrate){
        if (res==='bad') navigator.vibrate(60);
        else if (res==='perfect') navigator.vibrate([12,30,12]);
        else if (res==='good') navigator.vibrate(12);
      }
      if (res==='good') sfx.good?.(); else if (res==='bad') sfx.bad?.();
    }catch(e){ console.error('[HHA] onHit', e); }
    finally{ smash3D(el); LIVE.delete(el); }
  }, {passive:true});

  document.body.appendChild(el);
  LIVE.add(el);
  const ttl = meta.life || diff.life || 3000;
  setTimeout(()=>{ try{ LIVE.delete(el); el.remove(); }catch{} }, ttl);
}

function spawnLoop(){
  if (!state.running || state.paused) return;
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;

  const total = state.stats.good + state.stats.perfect + state.stats.ok + state.stats.bad;
  const accNow = total>0 ? (state.stats.good + state.stats.perfect)/total : 1;
  state._accHist.push(accNow); if(state._accHist.length>8) state._accHist.shift();
  const acc = state._accHist.reduce((s,x)=>s+x,0)/state._accHist.length;
  const tune = acc>0.88?0.92: acc<0.58?1.10:1.00;

  const dyn = { time:diff.time, spawn:Math.max(300, Math.round((diff.spawn||700)*tune)), life:Math.max(900, Math.round((diff.life||3000)/tune)) };
  spawnOnce(dyn);
  const next = Math.max(220, dyn.spawn * (power.timeScale || 1));
  state.spawnTimer = setTimeout(spawnLoop, next);
}

function tick(){
  if (!state.running || state.paused) return;

  if (state.fever.active){
    state.fever.timeLeft=Math.max(0,state.fever.timeLeft-1);
    state.fever.meter=Math.max(0,state.fever.meter-state.fever.drainPerSec);
    setFeverBar(state.fever.meter);
    if (state.fever.timeLeft<=0 || state.fever.meter<=0) stopFever();
  }

  try{ MODES[state.modeKey]?.tick?.(state, {score,sfx,power,coach,fx:eng?.fx}, hud); }catch(e){ console.warn('[HHA] mode.tick', e); }

  state.timeLeft=Math.max(0,state.timeLeft-1);
  updateHUD();

  if (state.timeLeft<=0){ end(); return; }
  if (state.timeLeft<=10){ try{$('#sfx-tick')?.play()?.catch(()=>{});}catch{} document.body.classList.add('flash'); }
  else document.body.classList.remove('flash');

  state.tickTimer = setTimeout(tick, 1000);
}

async function countdown(sec=5){
  const f=$('#coachHUD'); const t=$('#coachText');
  if (f&&t){ f.style.display='flex'; }
  for (let i=sec; i>0; i--){
    if (t) t.textContent = state.lang==='EN' ? `Start in ${i}...` : `เริ่มใน ${i}...`;
    await new Promise(r=>setTimeout(r, 1000));
  }
  if (t) t.textContent = state.lang==='EN' ? 'Go!' : 'ลุย!';
  await new Promise(r=>setTimeout(r, 600));
  if (f) f.style.display='none';
}

function start(){
  end(true);
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  state.running=true; state.paused=false; state.timeLeft=diff.time;
  state.combo=0; state.stats={good:0,perfect:0,ok:0,bad:0};
  state._accHist=[]; state.freezeUntil=0; state.fever.meter=0;
  setFeverBar(0); stopFever(); score.reset?.(); updateHUD();

  // countdown 5 วิ
  countdown(5).then(()=>{
    try{ MODES[state.modeKey]?.init?.(state, hud, diff); }catch(e){ console.error('[HHA] init', e); }
    coach.onStart?.(state.modeKey);
    tick(); spawnLoop();
  });
}

function end(silent=false){
  state.running=false; state.paused=false;
  clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer);
  try{ MODES[state.modeKey]?.cleanup?.(state, hud); }catch{}
  for (const n of Array.from(LIVE)){ try{ n.remove(); }catch{} LIVE.delete(n); }

  if (!silent){
    const modal=$('#result'); if(modal) modal.style.display='flex';
    coach.onEnd?.(score.score, {grade:'A'});
  }
}

// events
document.addEventListener('pointerup', (e)=>{
  const btn = byAction(e.target); if(!btn) return;
  const a = btn.getAttribute('data-action'); const v = btn.getAttribute('data-value');
  if (a==='mode'){ state.modeKey=v; applyUI(); if(state.running) start(); }
  else if (a==='diff'){ state.difficulty=v; applyUI(); if(state.running) start(); }
  else if (a==='start'){ start(); }
  else if (a==='pause'){
    if (!state.running){ start(); return; }
    state.paused=!state.paused;
    if (!state.paused){ tick(); spawnLoop(); }
    else { clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer); }
  }
  else if (a==='restart'){ end(true); start(); }
  else if (a==='help'){ const m=$('#help'); if(m) m.style.display='flex'; }
  else if (a==='helpClose'){ const m=$('#help'); if(m) m.style.display='none'; }
  else if (a==='helpScene'){ const hs=$('#helpScene'); if(hs) hs.style.display='flex'; }
  else if (a==='helpSceneClose'){ const hs=$('#helpScene'); if(hs) hs.style.display='none'; }
}, {passive:true});

// result modal
const resEl = $('#result');
if (resEl){
  resEl.addEventListener('click', (e)=>{
    const a = e.target.getAttribute('data-result');
    if (a==='replay'){ resEl.style.display='none'; start(); }
    if (a==='home'){ resEl.style.display='none'; end(true); }
  });
}

// toggles
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
  const on = localStorage.getItem('hha_sound')!=='0';
  const next = !on; localStorage.setItem('hha_sound', next?'1':'0');
  sfx.setEnabled?.(next);
  $('#soundToggle').textContent = next ? '🔊 เสียง: เปิด' : '🔇 เสียง: ปิด';
  if (next){ try{ sfx.play('sfx-good'); }catch{} }
}, {passive:true});
document.addEventListener('visibilitychange', ()=>{
  if (document.hidden && state.running && !state.paused){
    state.paused=true; clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer);
  }
});
// unlock audio
window.addEventListener('pointerdown', ()=>{ try{ sfx.unlock?.(); }catch{} }, {once:true, passive:true});

// boot
applyUI(); updateHUD();
