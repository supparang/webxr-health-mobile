// === Hero Health Academy — main.js (pro build: quests/powerups/coach/feedback) ===
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

// ---------- helpers ----------
const $ = (s)=>document.querySelector(s);
const byAction = (el)=>el?.closest?.('[data-action]') || null;
const setText = (sel, txt)=>{ const el=$(sel); if(el) el.textContent = txt; };

// ---------- config ----------
const MODES = { goodjunk, groups, hydration, plate };
const DIFFS = {
  Easy:   { time: 70, spawn: 900, life: 4200 },
  Normal: { time: 60, spawn: 700, life: 3000 },
  Hard:   { time: 50, spawn: 550, life: 1800 }
};
const ICON_SIZE_MAP = { Easy: 92, Normal: 72, Hard: 58 };
const MAX_ITEMS = 10;
const LIVE = new Set();

const I18N = {
  TH:{ names:{goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ'},
       diffs:{Easy:'ง่าย', Normal:'ปกติ', Hard:'ยาก'} },
  EN:{ names:{goodjunk:'Good vs Junk', groups:'Food Groups', hydration:'Hydration', plate:'Healthy Plate'},
       diffs:{Easy:'Easy', Normal:'Normal', Hard:'Hard'} }
};
const T = (lang)=> I18N[lang] || I18N.TH;

// ---------- systems ----------
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
  hapticOn: (localStorage.getItem('hha_haptic')!=='0'),
  combo:0, bestCombo:0,
  fever:{ active:false, meter:0, drainPerSec:14, chargeGood:10, chargePerfect:20, threshold:100, mul:2, timeLeft:0 },
  spawnTimer:0, tickTimer:0,
  ctx:{},
  stats:{ good:0, perfect:0, ok:0, bad:0 },
  _accHist:[],
  freezeUntil:0,
  badStreak:0,
  shardsBudget: 48, // shards per sec cap
  countdown:0
};

// ---------- UI ----------
function applyUI(){
  const L = T(state.lang);
  setText('#modeName', L.names[state.modeKey]||state.modeKey);
  setText('#difficulty', L.diffs[state.difficulty]||state.difficulty);
}
function updateHUD(){ hud.setScore?.(score.score); hud.setTime?.(state.timeLeft); hud.setCombo?.('x'+state.combo); }
function setFeverBarPct(pct){ const bar = $('#feverBar'); if(bar) bar.style.width = Math.max(0,Math.min(100,pct|0))+'%'; }
function showFeverLabel(on){ const f=$('#fever'); if(!f) return; f.style.display=on?'block':'none'; f.classList.toggle('pulse',!!on); }

// ---------- coach calls ----------
function coachStart(){ coach.onStart?.(hud); }
function coachFever(){ coach.onFever?.(hud); }
function coachNear(){ coach.onNearEnd?.(hud); }
function coachFailStreak(){ coach.onFailStreak?.(hud); }
function coachCombo10(){ coach.onCombo10?.(hud); }
function coachEnd(){ coach.onEnd?.(hud, score.score); }

// ---------- fever ----------
function startFever(){ if(state.fever.active) return; state.fever.active=true; state.fever.timeLeft=7; showFeverLabel(true); try{$('#sfx-powerup')?.play();}catch{}; coachFever(); }
function stopFever(){ state.fever.active=false; state.fever.timeLeft=0; showFeverLabel(false); }

// ---------- score FX ----------
function popScore(x,y,tag,minor,color){
  const el=document.createElement('div');
  el.className='scoreBurst';
  el.style.left=x+'px'; el.style.top=y+'px';
  el.style.color=color||'#7fffd4';
  el.style.font='700 20px/1.2 ui-rounded,system-ui,Segoe UI';
  el.textContent=tag;
  if(minor){ const m=document.createElement('div'); m.style.font='600 12px/1.2 ui-rounded'; m.style.opacity='.9'; m.textContent=minor; el.appendChild(m); }
  document.body.appendChild(el);
  requestAnimationFrame(()=>{ el.style.transition='opacity .22s, transform .22s'; el.style.opacity='1'; });
  setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=>{ try{el.remove();}catch{} }, 220); }, 720);
}
function popFlame(x,y,strong){ const el=document.createElement('div'); el.style.cssText=`position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);width:${strong?72:56}px;height:${strong?72:56}px;border-radius:50%;background:radial-gradient(closest-side,#ffd54a,#ff6d00);mix-blend-mode:screen;filter:blur(8px) brightness(1.1);opacity:.9;z-index:110;pointer-events:none;animation:flamePop .5s ease-out forwards`; document.body.appendChild(el); setTimeout(()=>{try{el.remove();}catch{}},520); }
function scoreWithEffects(base, x, y){
  const comboMul = state.combo>=20?1.4: state.combo>=10?1.2: 1.0;
  const feverMul = state.fever.active?state.fever.mul:1.0;
  const powerMul = 1 + (power.scoreBoost||0);
  const total = Math.round(base * comboMul * feverMul * powerMul);
  score.add?.(total);
  const tag=(total>=0?'+':'')+total;
  const minor = (comboMul>1||feverMul>1||powerMul>1)
    ? `x${(comboMul*feverMul*powerMul).toFixed(1)}`
    : '';
  const color = total>=0 ? (feverMul>1?'#ffd54a':'#7fffd4') : '#ff9b9b';
  popScore(x,y,tag,minor,color);
  if (state.fever.active) popFlame(x,y,total>=10);
}

// ---------- shards (3D-like) ----------
let shardsThisSecond=0; let shardTick=Date.now();
function spawnShards(x,y,count=6,force=80){
  const now=Date.now(); if(now-shardTick>=1000){ shardTick=now; shardsThisSecond=0; }
  const budget = Math.max(0, state.shardsBudget - shardsThisSecond);
  count = Math.min(count, budget);
  if (count<=0) return;
  shardsThisSecond += count;

  for(let i=0;i<count;i++){
    const el=document.createElement('div'); el.className='shard';
    const ang=Math.random()*Math.PI*2;
    const dist = force*(.6+Math.random()*0.7);
    const dx = Math.cos(ang)*dist+'px', dy=Math.sin(ang)*dist+'px';
    const rot=(Math.random()*360-180)+'deg';
    el.style.left=x+'px'; el.style.top=y+'px';
    el.style.setProperty('--dx',dx); el.style.setProperty('--dy',dy); el.style.setProperty('--rot',rot);
    el.style.animation='shardFly .38s ease-out forwards';
    document.body.appendChild(el);
    setTimeout(()=>{ try{el.remove();}catch{} }, 420);
  }
}

// ---------- combo ----------
function addCombo(kind){
  if(kind==='bad'){ state.combo=0; hud.setCombo?.('x0'); return; }
  if(kind==='good'||kind==='perfect'){
    state.combo++; state.bestCombo=Math.max(state.bestCombo,state.combo);
    hud.setCombo?.('x'+state.combo);
    if(state.combo===10) coachCombo10();
    if(!state.fever.active){
      const gain = (kind==='perfect')?state.fever.chargePerfect:state.fever.chargeGood;
      state.fever.meter=Math.min(100,state.fever.meter+gain); setFeverBarPct(state.fever.meter);
      if(state.fever.meter>=state.fever.threshold) startFever();
    }else{
      state.fever.timeLeft=Math.min(10,state.fever.timeLeft+0.6);
    }
  }
}

// ---------- spawn area ----------
function safeBounds(){
  const h=$('header.brand')?.offsetHeight||56, m=$('#menuBar')?.offsetHeight||120;
  const yMin=h+60, yMax=Math.max(yMin+50, innerHeight - m - 80);
  const xMin=20, xMax=Math.max(xMin+50, innerWidth - 80);
  return {xMin,xMax,yMin,yMax};
}
function randPos(){
  const {xMin,xMax,yMin,yMax}=safeBounds();
  return { left:xMin+Math.random()*(xMax-xMin), top:yMin+Math.random()*(yMax-yMin) };
}
function overlapped(x,y){
  for(const n of LIVE){ const r=n.getBoundingClientRect(); const dx=(r.left+r.width/2)-x; const dy=(r.top+r.height/2)-y; if(Math.hypot(dx,dy)<64) return true; }
  return false;
}

// ---------- gameplay ----------
function spawnOnce(diff){
  if(!state.running||state.paused) return;

  const now=performance?.now?.()||Date.now();
  if(state.freezeUntil && now<state.freezeUntil){ state.spawnTimer=setTimeout(()=>spawnOnce(diff),120); return; }
  if(LIVE.size>=MAX_ITEMS){ state.spawnTimer=setTimeout(()=>spawnOnce(diff),180); return; }

  const mode = MODES[state.modeKey];
  const meta = mode?.pickMeta?.(diff, state) || {};

  const el=document.createElement('button'); el.className='item'; el.type='button';
  el.textContent = meta.char || '❓';
  const px=ICON_SIZE_MAP[state.difficulty]||72; el.style.fontSize=px+'px';

  let pos=randPos(), tries=0; while(tries++<12 && overlapped(pos.left,pos.top)) pos=randPos();
  el.style.left=pos.left+'px'; el.style.top=pos.top+'px';

  el.addEventListener('click',(ev)=>{
    ev.stopPropagation();
    try{
      const sys = { score, sfx, power, coach, fx: eng?.fx };
      const res = mode?.onHit?.(meta, sys, state, hud) || (meta.good?'good':'ok');

      const r = el.getBoundingClientRect();
      const cx=r.left+r.width/2, cy=r.top+r.height/2;

      // shards — แรงขึ้นตามคอมโบ
      const shardN = res==='bad'?10: (res==='perfect'?16:12);
      const shardF = 60 + Math.min(120, state.combo*4);
      spawnShards(cx, cy, shardN, shardF);

      // stats/combos
      state.stats[res]=(state.stats[res]||0)+1;
      if(res==='good'||res==='perfect'){ state.badStreak=0; addCombo(res); }
      if(res==='bad'){ state.badStreak++; addCombo('bad'); hud.flashDanger(); }

      // fail-streak penalty
      if(state.badStreak>=3){
        state.badStreak=0;
        state.timeLeft=Math.max(0,state.timeLeft-3); hud.dimPenalty();
        if(state.hapticOn && navigator.vibrate) navigator.vibrate([80,60,80]);
        coachFailStreak();
      }

      // score + feedback
      const base = ({good:7, perfect:14, ok:2, bad:-3, power:5})[res] || 1;
      scoreWithEffects(base, cx, cy);

      if(state.hapticOn && navigator.vibrate){
        if(res==='bad') navigator.vibrate(60);
        else if(res==='perfect') navigator.vibrate([12,30,12]);
        else if(res==='good') navigator.vibrate(12);
      }

      if(res==='good'){ try{sfx.good();}catch{} }
      else if(res==='bad'){ try{sfx.bad();}catch{} }

    }catch(e){ console.error('[HHA] onHit',e); }
    finally{ try{ LIVE.delete(el); el.remove(); }catch{} }
  }, {passive:true});

  document.body.appendChild(el); LIVE.add(el);
  const ttl=meta.life||diff.life||3000; setTimeout(()=>{ try{ LIVE.delete(el); el.remove(); }catch{} }, ttl);
}

function spawnLoop(){
  if(!state.running||state.paused) return;
  const diff=DIFFS[state.difficulty]||DIFFS.Normal;

  // rolling acc adapt
  const total = state.stats.good+state.stats.perfect+state.stats.ok+state.stats.bad;
  const accNow = total>0 ? (state.stats.good+state.stats.perfect)/total : 1;
  state._accHist.push(accNow); if(state._accHist.length>8) state._accHist.shift();
  const acc = state._accHist.reduce((s,x)=>s+x,0)/state._accHist.length;
  const tune = acc>0.88?0.92: acc<0.58?1.10: 1.00;

  const dyn={ time:diff.time, spawn:Math.max(300,Math.round((diff.spawn||700)*tune)), life:Math.max(900,Math.round((diff.life||3000)/tune)) };
  spawnOnce(dyn);
  const next = Math.max(220, dyn.spawn*(power.timeScale||1));
  state.spawnTimer=setTimeout(spawnLoop, next);
}

// ---------- tick / start / end ----------
function tick(){
  if(!state.running||state.paused) return;

  // countdown (ก่อนเริ่ม)
  if(state.countdown>0){
    setText('#time', state.countdown);
    hud.say?.(state.countdown===0?'':'เตรียมพร้อม... '+state.countdown);
    state.countdown--;
    state.tickTimer=setTimeout(tick,1000);
    return;
  }

  // power timers
  power.tick1s();
  hud.setPowerTimers?.(power.timers);

  // fever drain
  if(state.fever.active){
    state.fever.timeLeft=Math.max(0,state.fever.timeLeft-1);
    state.fever.meter=Math.max(0,state.fever.meter-state.fever.drainPerSec);
    setFeverBarPct(state.fever.meter);
    if(state.fever.timeLeft<=0||state.fever.meter<=0) stopFever();
  }

  // per-mode tick
  try{ MODES[state.modeKey]?.tick?.(state,{score,sfx,power,coach,fx:eng?.fx},hud); }catch(e){ console.warn('mode.tick',e); }

  state.timeLeft=Math.max(0,state.timeLeft-1);
  if(state.timeLeft===10) coachNear();
  updateHUD();

  if(state.timeLeft<=0){ end(); return; }
  if(state.timeLeft<=10){ try{$('#sfx-tick')?.play()?.catch(()=>{});}catch{}; document.body.classList.add('flash'); }
  else { document.body.classList.remove('flash'); }

  state.tickTimer=setTimeout(tick,1000);
}

function start(){
  end(true);
  const diff=DIFFS[state.difficulty]||DIFFS.Normal;
  state.running=true; state.paused=false;
  state.timeLeft=diff.time; state.combo=0; state.bestCombo=0;
  state.stats={good:0,perfect:0,ok:0,bad:0}; state._accHist=[]; state.freezeUntil=0;
  state.fever.meter=0; setFeverBarPct(0); stopFever();
  score.reset?.(); updateHUD();

  // countdown 5s
  state.countdown=5;
  hud.say?.('เตรียมพร้อม... 5');
  coachStart();

  try{ MODES[state.modeKey]?.init?.(state,hud,diff); }catch(e){ console.error('mode.init',e); }
  spawnLoop(); tick();
}

function end(silent=false){
  state.running=false; state.paused=false;
  clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer);
  try{ MODES[state.modeKey]?.cleanup?.(state,hud); }catch{}

  for(const n of Array.from(LIVE)){ try{ n.remove(); }catch{}; LIVE.delete(n); }

  if(!silent){
    // โบนัสเวลาแปลงเป็นคะแนน (2 คะแนน/วินาทีที่เหลือ)
    const timeBonus = Math.max(0, state.timeLeft)*2; score.add?.(timeBonus);

    const core=$('#resCore');
    if(core){ core.innerHTML = `คะแนน: <b>${score.score}</b> • โบนัสเวลา: <b>${timeBonus}</b> • คอมโบสูงสุด: <b>x${state.bestCombo}</b>`; }
    const brk=$('#resBreakdown');
    if(brk){
      brk.innerHTML = `
        <div style="margin-top:6px">
          ✅ ดี: ${state.stats.good} • ✨ เพอร์เฟค: ${state.stats.perfect} • 🙂 โอเค: ${state.stats.ok} • ❌ พลาด: ${state.stats.bad}
        </div>`;
    }
    const modal=$('#result'); if(modal) modal.style.display='flex';
    coachEnd();
  }
}

// ---------- events ----------
document.addEventListener('pointerup',(e)=>{
  const btn=byAction(e.target); if(!btn) return;
  const a=btn.getAttribute('data-action'); const v=btn.getAttribute('data-value');
  if(a==='mode'){ state.modeKey=v; applyUI(); if(state.running) start(); }
  else if(a==='diff'){ state.difficulty=v; applyUI(); if(state.running) start(); }
  else if(a==='start'){ start(); }
  else if(a==='pause'){
    if(!state.running){ start(); return; }
    state.paused=!state.paused;
    if(!state.paused){ tick(); spawnLoop(); hud.say?.(state.lang==='TH'?'▶ ต่อเกม':'▶ Resume'); }
    else { clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer); hud.say?.(state.lang==='TH'?'⏸ พักเกม':'⏸ Paused'); }
  }
  else if(a==='restart'){ end(true); start(); }
  else if(a==='help'){ const m=$('#help'); if(m) m.style.display='flex'; }
  else if(a==='helpClose'){ const m=$('#help'); if(m) m.style.display='none'; }
  else if(a==='helpScene'){ const hs=$('#helpScene'); if(hs) hs.style.display='flex'; }
  else if(a==='helpSceneClose'){ const hs=$('#helpScene'); if(hs) hs.style.display='none'; }
},{passive:true});

// result buttons
const resEl=$('#result');
if(resEl){
  resEl.addEventListener('click',(e)=>{
    const a=e.target.getAttribute('data-result');
    if(a==='replay'){ resEl.style.display='none'; start(); }
    if(a==='home'){ resEl.style.display='none'; end(true); }
  });
}

// toggles
$('#langToggle')?.addEventListener('click',()=>{ state.lang = state.lang==='TH'?'EN':'TH'; localStorage.setItem('hha_lang',state.lang); coach.setLang?.(state.lang); applyUI(); },{passive:true});
$('#gfxToggle')?.addEventListener('click',()=>{ state.gfx=state.gfx==='low'?'quality':'low'; localStorage.setItem('hha_gfx',state.gfx); try{eng.renderer.setPixelRatio(state.gfx==='low'?0.75:(window.devicePixelRatio||1));}catch{} },{passive:true});
$('#soundToggle')?.addEventListener('click',()=>{ const on=localStorage.getItem('hha_sound')!=='0'; const next=!on; localStorage.setItem('hha_sound',next?'1':'0'); sfx.setEnabled?.(next); $('#soundToggle').textContent=next?'🔊 เสียง: เปิด':'🔇 เสียง: ปิด'; if(next){ try{sfx.play('sfx-good');}catch{} } },{passive:true});
$('#hapticToggle')?.addEventListener('click',()=>{ state.hapticOn=!state.hapticOn; localStorage.setItem('hha_haptic', state.hapticOn?'1':'0'); $('#hapticToggle').textContent=state.hapticOn?'📳 สั่น: เปิด':'📴 สั่น: ปิด'; },{passive:true});
$('#contrastToggle')?.addEventListener('click',()=>{ document.body.classList.toggle('hi-contrast'); },{passive:true});

// auto pause
document.addEventListener('visibilitychange',()=>{ if(document.hidden&&state.running&&!state.paused){ state.paused=true; clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer); hud.say?.(state.lang==='TH'?'⏸ พักอัตโนมัติ':'⏸ Auto-paused'); }});

// unlock audio once
window.addEventListener('pointerdown',()=>{ try{sfx.unlock?.();}catch{} },{once:true,passive:true});

// boot
applyUI(); updateHUD();
