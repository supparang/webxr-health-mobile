// ===== Boot flag (for index bootWarn) =====
window.__HHA_BOOT_OK = true;

// ===== Imports (ตรงตามโครงสร้าง HeroHealth/game/*) =====
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
// (optional) import { Progression } from './core/progression.js';

import * as goodjunk from './modes/goodjunk.js';
import * as groups    from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate     from './modes/plate.js';

// ===== Short helpers =====
const qs = (s)=>document.querySelector(s);
const setText = (sel, txt)=>{ const el=qs(sel); if(el) el.textContent = txt; };
const now = ()=>performance.now?.() ?? Date.now();
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
let _lastClick=0;
const allowClick=()=>{ const t=now(); if(t-_lastClick<220) return false; _lastClick=t; return true; };
let _sfxCount=0,_sfxWin=0;
const playSFX=(id,opts)=>{ const t=(now()/1000)|0; if(t!==_sfxWin){_sfxWin=t;_sfxCount=0;} if(_sfxCount++<8) try{sfx.play(id,opts);}catch{} };

// ===== Systems =====
const hud   = new HUD();
const sfx   = new SFX({ enabled:true, poolSize:4 });
const board = new Leaderboard();
const mission = new MissionSystem();
const power = new PowerUpSystem();
const score = new ScoreSystem();
// const prog  = new Progression();
const eng = new Engine(THREE, document.getElementById('c'));
const fx  = new FloatingFX(eng);
const coach = new Coach({ lang: 'TH' });

// ===== Config / Modes =====
const MODES = { goodjunk, groups, hydration, plate };
const DIFFS = {
  Easy:   { time:70, spawn:820, life:4200, hydWaterRate:0.78 },
  Normal: { time:60, spawn:700, life:3000, hydWaterRate:0.66 },
  Hard:   { time:50, spawn:560, life:1900, hydWaterRate:0.55 }
};

// ===== State =====
const state = {
  modeKey: 'goodjunk',
  difficulty: 'Normal',
  running: false,
  timeLeft: 60,
  ctx: {},
  lang: (localStorage.getItem('hha_lang') || 'TH'),
  gfx:  (localStorage.getItem('hha_gfx')  || 'quality'),
  soundOn: (localStorage.getItem('hha_sound') ?? '1') === '1',
  fever: false,
  mission: null,
  rank: localStorage.getItem('hha_rank') || 'C'
};

const timers = { spawn:0, tick:0 };
let feverCharge = 0;
const FEVER_REQ = 10;

// ===== I18N (ย่อเฉพาะที่ใช้ในสรุปผล/ปุ่ม) =====
const I18N = {
  TH:{
    brand:'HERO HEALTH ACADEMY', score:'คะแนน', combo:'คอมโบ', time:'เวลา',
    mode:'โหมด', diff:'ความยาก',
    modes:{goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ'},
    diffs:{Easy:'ง่าย', Normal:'ปกติ', Hard:'ยาก'},
  },
  EN:{
    brand:'HERO HEALTH ACADEMY', score:'Score', combo:'Combo', time:'Time',
    mode:'Mode', diff:'Difficulty',
    modes:{goodjunk:'Good vs Junk', groups:'5 Food Groups', hydration:'Hydration', plate:'Healthy Plate'},
    diffs:{Easy:'Easy', Normal:'Normal', Hard:'Hard'},
  }
};
const L = ()=> (I18N[state.lang] || I18N.TH);

function updateHUD(){
  setText('#score', score.score|0);
  setText('#combo', 'x' + (score.combo||0));
  setText('#time',  state.timeLeft|0);
}
function setMissionLine(text, showLine=true){
  const el = document.getElementById('missionLine');
  if(!el) return;
  el.style.display = showLine ? 'block' : 'none';
  if(text != null) el.textContent = text;
}

// ===== Fever / Combo Hooks =====
if (typeof score.setHandlers === 'function') {
  score.setHandlers({
    onCombo:(x)=>{
      coach.onCombo?.(x);
      feverCharge = Math.min(1, x/FEVER_REQ);
      hud.setFeverProgress?.(feverCharge);
      if(!state.fever && x >= FEVER_REQ){
        state.fever = true;
        document.body.classList.add('fever-bg');
        coach.onFever?.();
        playSFX('sfx-powerup');
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

// ===== Spawn / Loop =====
function spawnOnce(diff){
  const mode = MODES[state.modeKey]; if(!mode) return;
  const meta = mode.pickMeta(diff, state);

  const el = document.createElement('button');
  el.className='item'; el.type='button';
  el.textContent = meta.char || '?';
  // safe area (กันชนเมนูด้านล่าง)
  const topSafe = 12, bottomSafe = 18;
  const topMin = topSafe, topMax = 100 - bottomSafe;
  el.style.position='fixed';
  el.style.left = (10 + Math.random()*80) + 'vw';
  el.style.top  = (topMin + Math.random()*(topMax - topMin)) + 'vh';

  el.onclick = () => {
    if(!allowClick()) return;
    mode.onHit(meta, {score, sfx, power, fx}, state, hud);
    state.ctx.hits = (state.ctx.hits||0) + 1;
    if(meta.good || meta.ok){ coach.onGood?.(); playSFX('sfx-good',{volume:.95}); }
    else { coach.onBad?.(state.modeKey); playSFX('sfx-bad',{volume:.95}); }
    updateHUD();
    el.remove();
  };

  document.body.appendChild(el);
  setTimeout(()=>{ if(el.isConnected) el.remove(); }, (diff.life||2500));
}

function spawnLoop(){
  if(!state.running) return;
  const base = DIFFS[state.difficulty] || DIFFS.Normal;
  const hits = state.ctx.hits||0, miss=state.ctx.miss||0;
  const acc  = hits>0 ? (hits/Math.max(1,hits+miss)) : 1;
  const tune = acc>0.80 ? 0.90 : (acc<0.50 ? 1.10 : 1.00);
  const dyn = {
    ...base,
    spawn: clamp(Math.round(base.spawn*tune), 250, 2000),
    life:  clamp(Math.round(base.life /tune),  800, 8000)
  };
  spawnOnce(dyn);
  const accel = Math.max(0.5, 1 - (score.score/400));
  const next  = Math.max(200, dyn.spawn * accel * power.timeScale);
  timers.spawn = setTimeout(spawnLoop, next);
}

// ===== Start / End / Tick =====
function start(){
  end(true);
  // reset HUD sections
  hud.hideHydration(); hud.hideTarget(); hud.hidePills();
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  state.running=true; state.timeLeft=diff.time;
  state.ctx={hits:0,perfectPlates:0,hyd:50, miss:0, wrongGroup:0, overflow:0, targetHitsTotal:0};
  state.fever=false; feverCharge=0; hud.setFeverProgress?.(0);
  score.reset(); updateHUD();
  // hydration reset
  state.hyd=50; state.hydMin=45; state.hydMax=65;

  MODES[state.modeKey].init?.(state, hud, diff);
  if(state.modeKey!=='hydration') hud.hideHydration();
  if(state.modeKey!=='groups' && state.modeKey!=='plate') hud.hideTarget();
  if(state.modeKey!=='plate') hud.hidePills();

  // start mission 45s
  state.mission = mission.start(state.modeKey);
  try{ setMissionLine(`${mission.describe(state.mission)} • 45s`, true); }catch{ setMissionLine('—', false); }

  coach.onStart?.(state.modeKey); playSFX('sfx-good',{volume:.8});
  tick(); spawnLoop();
}

function end(silent=false){
  state.running=false;
  clearTimeout(timers.spawn); clearTimeout(timers.tick);
  hud.hideHydration(); hud.hideTarget(); hud.hidePills(); setMissionLine(null,false);
  document.body.classList.remove('fever-bg'); feverCharge=0; hud.setFeverProgress?.(0);

  if(!silent){
    // Leaderboard + summary HTML ให้กับ UI Controller
    try{board.submit(state.modeKey,state.difficulty,score.score);}catch{}
    const top=(board.getTop?.(5)||[]).map((r,i)=>`${i+1}. ${r.mode} • ${r.diff} – ${r.score}`).join('<br>');
    const label = L();
    const summaryHTML = `
      ${label.score}: <b>${score.score}</b> |
      ${label.mode}: <b>${label.modes[state.modeKey]}</b> |
      ${label.diff}: <b>${label.diffs[state.difficulty]}</b>
      <div style="margin-top:8px"><h4>🏆 TOP</h4>${top}</div>
    `.trim();
    // ส่งให้ HHA.onEnd()
    HHA.__onEnd?.(summaryHTML);
  }
}

function tick(){
  if(!state.running) return;
  state.timeLeft--;
  updateHUD();

  // mission per-second
  if (state.mission){
    state.mission.remainSec = Math.max(0, state.mission.remainSec - 1);
    mission.evaluate(state, score, (res)=>{
      if (res.success && !state.mission.done){
        state.mission.done = true; state.mission.success = true;
        fx.spawn3D(null, '🏁 Mission Complete', 'good'); playSFX('sfx-perfect');
      }
    });
    try{
      const desc = mission.describe(state.mission);
      setMissionLine(`${desc} • ${state.mission.remainSec|0}s`, true);
    }catch{ setMissionLine('—', false); }
    if (state.mission.remainSec === 0 && !state.mission.done){
      state.mission.done = true; state.mission.success = false;
      fx.spawn3D(null, '⌛ Mission Failed', 'bad');
    }
  }

  // streak decay
  if ((state.timeLeft % 3 === 0) && score.combo > 0) {
    score.combo--; hud.setCombo?.(score.combo);
  }

  if(state.timeLeft<=0){ end(); return; }
  if(state.timeLeft<=10){ document.body.classList.add('flash'); playSFX('sfx-tick'); }
  else{ document.body.classList.remove('flash'); }

  timers.tick = setTimeout(tick, 1000);
}

// ===== Public HHA API for external UI Controller =====
const HHA = (window.HHA = window.HHA || {});
HHA.__onEnd = null;
HHA.onEnd = (cb)=>{ HHA.__onEnd = typeof cb==='function' ? cb : null; };
HHA.startGame = (opt={})=>{
  // controller อาจส่ง {demoPassed:true}
  if(opt.demoPassed) start();
  else start(); // ถ้ามี preStartFlow แทรกก่อนเริ่มจริง คุณสามารถเรียกที่นี่ได้
};
HHA.pause = ()=>{ state.running=false; };
HHA.resume = ()=>{
  if(!state.running){
    state.running=true;
    // ป้องกันกรณี loop ไม่ถูกตั้ง
    clearTimeout(timers.tick); timers.tick = 0;
    clearTimeout(timers.spawn); timers.spawn = 0;
    tick(); spawnLoop();
  }
};
HHA.restart = ()=>{ end(true); start(); };

// ===== Quality-of-life: เสียง / กราฟิก / ภาษา =====
function applyGFX(){
  if(state.gfx==='low'){
    eng.renderer.setPixelRatio(0.75);
    document.body.classList.add('low-gfx');
  }else{
    eng.renderer.setPixelRatio(window.devicePixelRatio || 1);
    document.body.classList.remove('low-gfx');
  }
}
function applySound(){
  if (typeof sfx.setEnabled === 'function') sfx.setEnabled(state.soundOn);
  else sfx.enabled = state.soundOn;
  localStorage.setItem('hha_sound', state.soundOn ? '1' : '0');
}

// ===== Events (เสียง, visibility, tooltip) =====
['pointerdown','touchstart','keydown'].forEach(ev=>{
  window.addEventListener(ev, ()=>sfx.unlock(), {once:true, passive:true});
});
document.addEventListener('visibilitychange', ()=>{
  if (document.hidden && state.running) state.running=false;
});
document.getElementById('missionLine')?.addEventListener('click', ()=>{
  const txt = state.mission ? `${mission.describe(state.mission)} • ${state.mission.remainSec|0}s` : '—';
  fx.spawn3D?.(null, txt, 'good');
});

// ===== Ensure UI clickable & menu bottom-left (backup if CSS late) =====
function __fixLayersAndMenuPos() {
  const c = document.getElementById('c');
  if (c) { c.style.pointerEvents = 'none'; c.style.zIndex = '1'; }
  ['hud','menu','modal','coach','item'].forEach(cls => {
    document.querySelectorAll('.' + cls).forEach(el => {
      el.style.pointerEvents = 'auto';
      el.style.zIndex = '100';
    });
  });
  const menu = document.getElementById('menuBar');
  if (menu) {
    Object.assign(menu.style, {
      position: 'fixed',
      left: '10px',
      bottom: '10px',
      top: 'auto',
      transform: 'none',
      width: 'auto',
      maxWidth: '48vw'
    });
  }
}

// ===== Boot =====
applyGFX(); applySound(); updateHUD();
window.addEventListener('DOMContentLoaded', ()=>{
  __fixLayersAndMenuPos();
  setTimeout(__fixLayersAndMenuPos, 400);
  console.log('✅ main.js ready (HHA API exposed)');
});
