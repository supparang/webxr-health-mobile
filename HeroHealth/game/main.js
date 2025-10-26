// === Hero Health Academy — main.js (stable + quests + 3D explode) ===
// - Icon auto-size by difficulty, score popup + flame, combo & fever
// - Mini-quest UI (render + mission line), coach under FEVER
// - Concurrency cap + anti-overlap spawn + freeze
// - 3D explode effect on click
// - Pause on tab hidden, cleanup, haptics

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
const byAction = (el)=> (el && el.closest ? el.closest('[data-action]') : null);
const setText = (sel, txt)=>{ const el=$(sel); if (el) el.textContent = txt; };

// ----- Config -----
const MODES = { goodjunk, groups, hydration, plate };
const DIFFS = {
  Easy:   { time: 70, spawn: 900, life: 4200 },
  Normal: { time: 60, spawn: 700, life: 3000 },
  Hard:   { time: 50, spawn: 550, life: 1800 }
};
const ICON_SIZE_MAP = { Easy: 92, Normal: 72, Hard: 58 };
const MAX_ITEMS = 10;                 // ของพร้อมกันสูงสุด
const LIVE = new Set();               // elements ที่ยังอยู่

// I18N (สั้น)
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
  running:false, paused:false,
  timeLeft:60,
  lang: localStorage.getItem('hha_lang') || 'TH',
  gfx:  localStorage.getItem('hha_gfx')  || 'quality',
  combo:0, bestCombo:0,
  fever:{ active:false, meter:0, drainPerSec:14, chargeGood:10, chargePerfect:20, threshold:100, mul:2, timeLeft:0 },
  spawnTimer:0, tickTimer:0,
  ctx:{},
  stats:{ good:0, perfect:0, ok:0, bad:0 },
  _accHist:[],
  freezeUntil:0
};

// ----- Toast -----
function toast(msg, ms=900){
  const el = document.createElement('div');
  el.className='toast';
  el.textContent = msg;
  el.style.cssText = `
    position:fixed;left:50%;bottom:88px;transform:translateX(-50%) translateY(12px);
    background:#111c;color:#fff;border:1px solid #fff3;border-radius:12px;
    padding:8px 12px;z-index:140;opacity:0;transition:transform .25s,opacity .25s;font-weight:800;pointer-events:none;
  `;
  document.body.appendChild(el);
  requestAnimationFrame(()=>{ el.style.opacity='1'; el.style.transform='translateX(-50%) translateY(0)'; });
  setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateX(-50%) translateY(12px)'; setTimeout(()=>{ try{ el.remove(); }catch{} }, 280); }, ms);
}

// ----- UI -----
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

// Fever UI
function setFeverBar(pct){ const bar=$('#feverBar'); if(bar) bar.style.width = Math.max(0,Math.min(100,pct|0))+'%'; }
function showFeverLabel(show){ const f=$('#fever'); if(!f) return; f.style.display=show?'block':'none'; f.classList.toggle('pulse', !!show); }
function startFever(){ if(state.fever.active) return; state.fever.active=true; state.fever.timeLeft=7; showFeverLabel(true); try{$('#sfx-powerup')?.play();}catch{} }
function stopFever(){ state.fever.active=false; state.fever.timeLeft=0; showFeverLabel(false); }

// Score FX (popup + flame)
function makeScoreBurst(x,y,text,minor,color){
  const el=document.createElement('div');
  el.className='scoreBurst';
  el.style.left=x+'px'; el.style.top=y+'px';
  el.style.color = color||'#7fffd4';
  el.textContent=text;
  if (minor){ const m=document.createElement('div'); m.className='minor'; m.textContent=minor; el.appendChild(m); }
  document.body.appendChild(el);
  requestAnimationFrame(()=>{ el.classList.add('show'); });
  setTimeout(()=>{ el.classList.remove('show'); setTimeout(()=>{ try{ el.remove(); }catch{} }, 220); }, 720);
}
function makeFlame(x,y,strong){
  const el=document.createElement('div');
  el.style.position='fixed'; el.style.left=x+'px'; el.style.top=y+'px';
  el.style.transform='translate(-50%,-50%)';
  el.style.width=(strong?72:56)+'px'; el.style.height=(strong?72:56)+'px';
  el.style.borderRadius='50%';
  el.style.background='radial-gradient(closest-side, #ffd54a, #ff6d00)';
  el.style.mixBlendMode='screen'; el.style.filter='blur(8px) brightness(1.1)'; el.style.opacity='.9';
  el.style.zIndex='110'; el.style.pointerEvents='none';
  el.style.animation='flamePop .5s ease-out forwards';
  document.body.appendChild(el);
  setTimeout(()=>{ try{ el.remove(); }catch{} }, 520);
}
function scoreWithEffects(base,x,y){
  const comboMul = state.combo>=20?1.4:(state.combo>=10?1.2:1.0);
  const feverMul = state.fever.active?state.fever.mul:1.0;
  const total = Math.round(base*comboMul*feverMul);
  score.add?.(total);
  const tag = total>=0?('+'+total):(''+total);
  const minor = (comboMul>1||feverMul>1) ? ('x'+comboMul.toFixed(1)+(feverMul>1?' & FEVER':'')) : '';
  const color = total>=0 ? (feverMul>1 ? '#ffd54a' : '#7fffd4') : '#ff9b9b';
  makeScoreBurst(x,y,tag,minor,color);
  if (state.fever.active) makeFlame(x,y,total>=10);
}

// Combo
function addCombo(kind){
  if (kind==='bad'){ state.combo=0; hud.setCombo?.('x0'); return; }
  if (kind==='good'||kind==='perfect'){
    state.combo++; state.bestCombo=Math.max(state.bestCombo,state.combo); hud.setCombo?.('x'+state.combo);
    if (!state.fever.active){
      const gain = (kind==='perfect') ? state.fever.chargePerfect : state.fever.chargeGood;
      state.fever.meter = Math.min(100, state.fever.meter + gain);
      setFeverBar(state.fever.meter);
      if (state.fever.meter >= state.fever.threshold) startFever();
    } else {
      state.fever.timeLeft = Math.min(10, state.fever.timeLeft + 0.6);
    }
  }
}

// Mission/Quest UI
function renderMissionLine(text, show=true){
  const el = document.getElementById('missionLine');
  if (!el) return;
  if (!show || !text){ el.classList.add('hide'); el.textContent='—'; return; }
  el.textContent=text; el.classList.remove('hide');
}
function renderQuestChips(state){
  const wrap = document.getElementById('questChips'); if(!wrap) return;
  const gj = state?.ctx?.gj; let quests = Array.isArray(gj?.quests) ? gj.quests : null;
  if (!quests && gj?.quest){
    quests=[{ id:'solo', titleTH:'เก็บของดีตามเป้า', titleEN:'Collect healthy items',
              progress:gj.quest.progress||0, need:gj.quest.need||10, remain:gj.quest.remain||45,
              done:!!gj.quest.done, fail: gj.quest.remain===0 && !gj.quest.done, icon:'🎯' }];
  }
  if (!quests||!quests.length){ wrap.innerHTML=''; renderMissionLine(null,false); return; }
  wrap.innerHTML='';
  quests.forEach(q=>{
    const chip=document.createElement('div');
    chip.className='qchip'+(q.done?' done':(q.fail?' fail':'')); chip.classList.add('pop');
    chip.innerHTML=`<span>${q.icon||'🎯'}</span><span>${q.titleTH||q.titleEN||'Quest'}</span><span class="p">${q.progress|0}/${q.need|0}</span>`;
    wrap.appendChild(chip);
  });
  const active = quests.find(q=>!q.done && !q.fail);
  if (active){ renderMissionLine(`🎯 ${active.titleTH||active.titleEN} • ${active.progress|0}/${active.need|0} • ${active.remain|0}s`, true); }
  else { renderMissionLine('🏁 เควสต์ทั้งหมดเสร็จแล้ว!', true); }
}

// ----- Spawn helpers -----
function safeBounds(){
  const headerH = ($('header.brand') && $('header.brand').offsetHeight) ? $('header.brand').offsetHeight : 56;
  const menuH   = ($('#menuBar') && $('#menuBar').offsetHeight) ? $('#menuBar').offsetHeight : 120;
  const yMin = headerH + 60;
  const yMax = Math.max(yMin + 50, window.innerHeight - menuH - 80);
  const xMin = 20;
  const xMax = Math.max(xMin + 50, window.innerWidth - 80);
  return { xMin,xMax,yMin,yMax };
}
function randPos(){ const {xMin,xMax,yMin,yMax}=safeBounds(); return { left:xMin+Math.random()*(xMax-xMin), top:yMin+Math.random()*(yMax-yMin) }; }
function overlapped(x,y){
  for (const n of LIVE){
    const r=n.getBoundingClientRect();
    const dx=(r.left+r.width/2)-x, dy=(r.top+r.height/2)-y;
    if (Math.hypot(dx,dy) < 64) return true;
  }
  return false;
}

// 3D Explode effect
function explode3D(x,y, tint='#35d0ff'){
  const count = 12 + ((Math.random()*6)|0);
  for (let i=0;i<count;i++){
    const s=document.createElement('div');
    s.className='shard';
    s.style.left = x+'px'; s.style.top = y+'px';

    // random vectors
    const dx = (Math.random()*160-80)|0;
    const dy = (Math.random()*140-70)|0;
    const dz = (Math.random()*240-60)|0;
    const rx = (Math.random()*360-180)|0;
    const ry = (Math.random()*360-180)|0;
    const rz = (Math.random()*360-180)|0;

    s.style.setProperty('--dx', dx+'px');
    s.style.setProperty('--dy', dy+'px');
    s.style.setProperty('--dz', dz+'px');
    s.style.setProperty('--rx', rx+'deg');
    s.style.setProperty('--ry', ry+'deg');
    s.style.setProperty('--rz', rz+'deg');
    s.style.background = `radial-gradient(circle at 40% 40%, #fff 0, #fef3 30%, #0000 80%), ${tint}`;
    document.body.appendChild(s);
    setTimeout(()=>{ try{ s.remove(); }catch{} }, 700);
  }
}

// ----- Spawn -----
function spawnOnce(diff){
  if (!state.running || state.paused) return;

  // Freeze
  const now = performance?.now?.()||Date.now();
  if (state.freezeUntil && now < state.freezeUntil){ state.spawnTimer=setTimeout(()=>spawnOnce(diff),120); return; }

  // Concurrency cap
  if (LIVE.size >= MAX_ITEMS){ state.spawnTimer=setTimeout(()=>spawnOnce(diff),180); return; }

  const mode = MODES[state.modeKey];
  const meta = (mode && mode.pickMeta) ? (mode.pickMeta(diff,state)||{}) : {};

  const el=document.createElement('button');
  el.className='item'; el.type='button';
  el.textContent = meta.char || '❓';

  const px = ICON_SIZE_MAP[state.difficulty] || 72;
  el.style.fontSize=px+'px';

  // anti-overlap
  let pos=randPos(), tries=0;
  while(tries++<12 && overlapped(pos.left,pos.top)) pos=randPos();
  el.style.left=pos.left+'px'; el.style.top=pos.top+'px';

  el.addEventListener('pointerenter', ()=> el.style.transform='translateZ(16px) scale(1.12)', {passive:true});
  el.addEventListener('pointerleave', ()=> el.style.transform='translateZ(0) scale(1)', {passive:true});

  el.addEventListener('click', (ev)=>{
    ev.stopPropagation();
    try{
      const sys={ score, sfx, power, coach, fx:eng?.fx };
      const res = (mode && mode.onHit) ? (mode.onHit(meta, sys, state, hud) || 'ok') : (meta.good ? 'good':'ok');

      const r=el.getBoundingClientRect();
      const cx=r.left+r.width/2, cy=r.top+r.height/2;

      // stats / combo
      state.stats[res]=(state.stats[res]||0)+1;
      if (res==='good' || res==='perfect') addCombo(res);
      if (res==='bad') addCombo('bad');

      // score / fx
      const base = ({ good:7, perfect:14, ok:2, bad:-3, power:5 })[res] || 1;
      scoreWithEffects(base, cx, cy);
      explode3D(cx, cy, res==='bad' ? '#ff4d6d' : '#35d0ff');   // 3D shards!

      // haptics
      if (navigator.vibrate){
        if (res==='bad') navigator.vibrate(60);
        else if (res==='perfect') navigator.vibrate([12,30,12]);
        else if (res==='good') navigator.vibrate(12);
      }

      if (res==='good'){ try{sfx.good();}catch{} } else if (res==='bad'){ try{sfx.bad();}catch{} }

      // อัปเดตเควสต์ UI (หลังความคืบหน้าเกิดขึ้น)
      renderQuestChips(state);
    }catch(e){ console.error('[HHA] onHit error:', e); }
    finally{ try{ LIVE.delete(el); el.remove(); }catch{} }
  }, {passive:true});

  document.body.appendChild(el);
  LIVE.add(el);
  const ttl = meta.life || diff.life || 3000;
  setTimeout(()=>{ try{ LIVE.delete(el); el.remove(); }catch{} }, ttl);
}

function spawnLoop(){
  if (!state.running || state.paused) return;

  const diff = DIFFS[state.difficulty] || DIFFS.Normal;

  // rolling accuracy tune
  const total = state.stats.good + state.stats.perfect + state.stats.ok + state.stats.bad;
  const accNow = total>0 ? (state.stats.good + state.stats.perfect)/total : 1;
  state._accHist.push(accNow); if (state._accHist.length>8) state._accHist.shift();
  const acc = state._accHist.reduce((s,x)=>s+x,0)/state._accHist.length;
  const tune = acc>0.88 ? 0.92 : acc<0.58 ? 1.10 : 1.00;

  const dyn = { time: diff.time, spawn: Math.max(300, Math.round((diff.spawn||700)*tune)), life: Math.max(900, Math.round((diff.life||3000)/tune)) };

  spawnOnce(dyn);

  const next = Math.max(220, dyn.spawn*(power.timeScale||1));
  state.spawnTimer = setTimeout(spawnLoop, next);
}

// ----- Tick / Start / End -----
function tick(){
  if (!state.running || state.paused) return;

  if (state.fever.active){
    state.fever.timeLeft = Math.max(0, state.fever.timeLeft-1);
    state.fever.meter = Math.max(0, state.fever.meter - state.fever.drainPerSec);
    setFeverBar(state.fever.meter);
    if (state.fever.timeLeft<=0 || state.fever.meter<=0) stopFever();
  }

  try{ const mode=MODES[state.modeKey]; if (mode && mode.tick) mode.tick(state, {score,sfx,power,coach,fx:eng?.fx}, hud); }catch(e){ console.warn('[HHA] mode.tick error:', e); }

  state.timeLeft = Math.max(0, state.timeLeft-1);
  updateHUD();
  renderQuestChips(state);                 // อัปเดตเวลา/เควสต์ทุกวินาที

  if (state.timeLeft<=0){ end(); return; }
  if (state.timeLeft<=10){ try{$('#sfx-tick')?.play()?.catch(()=>{});}catch{} document.body.classList.add('flash'); }
  else { document.body.classList.remove('flash'); }

  state.tickTimer = setTimeout(tick, 1000);
}

function start(){
  end(true);
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  state.running=true; state.paused=false;
  state.timeLeft=diff.time;
  state.combo=0; state.stats={good:0,perfect:0,ok:0,bad:0}; state._accHist=[];
  state.freezeUntil=0; state.fever.meter=0; setFeverBar(0); stopFever();
  score.reset?.(); updateHUD();

  try{ const mode=MODES[state.modeKey]; if (mode && mode.init) mode.init(state, hud, diff); }catch(e){ console.error('[HHA] mode.init error:', e); }

  renderQuestChips(state);                 // ให้เห็นเควสต์ทันที
  coach.onStart?.(state.modeKey);
  tick(); spawnLoop();
}

function end(silent=false){
  state.running=false; state.paused=false;
  clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer);
  try{ MODES[state.modeKey]?.cleanup?.(state, hud); }catch{}

  for (const n of Array.from(LIVE)){ try{ n.remove(); }catch{} LIVE.delete(n); }

  if (!silent){ const modal=$('#result'); if (modal) modal.style.display='flex'; coach.onEnd?.(score.score, {grade:'A'}); }
}

// ----- Events -----
document.addEventListener('pointerup', (e)=>{
  const btn = byAction(e.target); if (!btn) return;
  const a = btn.getAttribute('data-action'); const v = btn.getAttribute('data-value');
  if (a==='mode'){ state.modeKey=v; applyUI(); if (state.running) start(); }
  else if (a==='diff'){ state.difficulty=v; applyUI(); if (state.running) start(); }
  else if (a==='start'){ start(); }
  else if (a==='pause'){
    if (!state.running){ start(); return; }
    state.paused=!state.paused;
    if (!state.paused){ tick(); spawnLoop(); toast(state.lang==='TH'?'▶ ต่อเกม':'▶ Resume'); }
    else { clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer); toast(state.lang==='TH'?'⏸ พักเกม':'⏸ Paused'); }
  }
  else if (a==='restart'){ end(true); start(); }
  else if (a==='help'){ const m=$('#help'); if (m) m.style.display='flex'; }
  else if (a==='helpClose'){ const m=$('#help'); if (m) m.style.display='none'; }
  else if (a==='helpScene'){ const hs=$('#helpScene'); if (hs) hs.style.display='flex'; }
  else if (a==='helpSceneClose'){ const hs=$('#helpScene'); if (hs) hs.style.display='none'; }
}, { passive:true });

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
  coach.lang = state.lang;
  applyUI();
}, { passive:true });

$('#gfxToggle')?.addEventListener('click', ()=>{
  state.gfx = state.gfx==='low' ? 'quality' : 'low';
  localStorage.setItem('hha_gfx', state.gfx);
  try{ eng.renderer.setPixelRatio(state.gfx==='low' ? 0.75 : (window.devicePixelRatio||1)); }catch{}
}, { passive:true });

$('#soundToggle')?.addEventListener('click', ()=>{
  const on = localStorage.getItem('hha_sound') !== '0';
  const next = !on;
  localStorage.setItem('hha_sound', next ? '1' : '0');
  sfx.setEnabled?.(next);
  $('#soundToggle').textContent = next ? '🔊 เสียง: เปิด' : '🔇 เสียง: ปิด';
  if (next){ try{ sfx.play('sfx-good'); }catch{} }
}, { passive:true });

// Pause when tab hidden
document.addEventListener('visibilitychange', ()=>{
  if (document.hidden && state.running && !state.paused){
    state.paused=true; clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer);
    toast(state.lang==='TH'?'⏸ พักอัตโนมัติ':'⏸ Auto-paused');
  }
});

// Unlock audio once
window.addEventListener('pointerdown', ()=>{ try{ sfx.unlock?.(); }catch{} }, { once:true, passive:true });

// Boot
applyUI();
updateHUD();
