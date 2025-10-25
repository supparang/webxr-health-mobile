// ===== Boot flag (for index bootWarn) =====
window.__HHA_BOOT_OK = true;

// ===== Imports =====
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

// ===== Utils / Helpers =====
const qs = (s) => document.querySelector(s);
const setText = (sel, txt) => { const el = qs(sel); if (el) el.textContent = txt; };
const show = (sel, on, disp='flex') => { const el = qs(sel); if (el) el.style.display = on ? disp : 'none'; };
const now = () => performance.now?.() ?? Date.now();
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

// Anti-spam click
let _lastClick=0;
const allowClick=()=>{ const t=now(); if(t-_lastClick<220) return false; _lastClick=t; return true; };

// SFX throttle (≤8/วินาที)
let _sfxCount=0,_sfxWin=0;
const playSFX=(id,opts)=>{ const t=(now()/1000)|0; if(t!==_sfxWin){_sfxWin=t;_sfxCount=0;} if(_sfxCount++<8) try{sfx.play(id,opts);}catch{} };

// Modal focus helper
const focusBtnStart=()=>{ const b=document.getElementById('btn_start'); b?.focus?.(); };

// Mission HUD line
function setMissionLine(text, showLine=true){
  const el = document.getElementById('missionLine');
  if(!el) return;
  el.style.display = showLine ? 'block' : 'none';
  if(text != null) el.textContent = text;
}

// ===== Config =====
const MODES = { goodjunk, groups, hydration, plate };
const DIFFS = {
  Easy:   { time:70, spawn:820, life:4200, hydWaterRate:0.78 },
  Normal: { time:60, spawn:700, life:3000, hydWaterRate:0.66 },
  Hard:   { time:50, spawn:560, life:1900, hydWaterRate:0.55 }
};

// ===== Systems =====
const hud   = new HUD();
const sfx   = new SFX({ enabled:true, poolSize:4 });
const board = new Leaderboard();
const mission = new MissionSystem();
const power = new PowerUpSystem();
const score = new ScoreSystem();
// const prog  = new Progression();

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

const eng = new Engine(THREE, document.getElementById('c'));
const fx  = new FloatingFX(eng);
const coach = new Coach({ lang: state.lang });

// ===== Fever / Combo Hooks =====
let feverCharge = 0;               // 0..1
const FEVER_REQ = 10;

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

// ===== I18N =====
const I18N = {
  TH:{
    brand:'HERO HEALTH ACADEMY',
    score:'คะแนน', combo:'คอมโบ', time:'เวลา',
    target:'หมวด', quota:'โควตา', hydro:'สมดุลน้ำ',
    mode:'โหมด', diff:'ความยาก',
    modes:{goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ'},
    diffs:{Easy:'ง่าย', Normal:'ปกติ', Hard:'ยาก'},
    btn:{start:'▶ เริ่มเกม', pause:'⏸ พัก', restart:'↻ เริ่มใหม่', help:'❓ วิธีเล่น', ok:'โอเค', replay:'↻ เล่นอีกครั้ง', home:'🏠 หน้าหลัก'},
    gfx:{quality:'กราฟิก: ปกติ', low:'กราฟิก: ประหยัด'},
    sound:{on:'🔊 เสียง: เปิด', off:'🔇 เสียง: ปิด'},
    helpTitle:'วิธีเล่น',
    helpBody:{
      goodjunk:'เก็บอาหารดี (🥦🍎) หลีกเลี่ยงของขยะ (🍔🍟🥤)
คลิก/แตะ/จ้อง เพื่อเก็บคะแนน',
      groups:'ดู 🎯 เป้าหมายบน HUD แล้วเก็บให้ตรงหมวด
ถูก +7 ผิด -2 (ครบ 3 จะเปลี่ยนหมวด)',
      hydration:'รักษาแถบน้ำ 45–65%
💧 +5 / 🧋 -6 • น้ำสูง+ดื่มน้ำ หรือ น้ำต่ำ+ดื่มหวาน = โทษหนัก',
      plate:'เติมโควตา: ธัญพืช2 ผัก2 โปรตีน1 ผลไม้1 นม1
ครบ +14 • เกินโควตา -1s'
    },
    summary:'สรุปผล'
  },
  EN:{
    brand:'HERO HEALTH ACADEMY',
    score:'Score', combo:'Combo', time:'Time',
    target:'Target', quota:'Quota', hydro:'Hydration',
    mode:'Mode', diff:'Difficulty',
    modes:{goodjunk:'Good vs Junk', groups:'5 Food Groups', hydration:'Hydration', plate:'Healthy Plate'},
    diffs:{Easy:'Easy', Normal:'Normal', Hard:'Hard'},
    btn:{start:'▶ Start', pause:'⏸ Pause', restart:'↻ Restart', help:'❓ How to Play', ok:'OK', replay:'↻ Replay', home:'🏠 Home'},
    gfx:{quality:'Graphics: Quality', low:'Graphics: Performance'},
    sound:{on:'🔊 Sound: On', off:'🔇 Sound: Off'},
    helpTitle:'How to Play',
    helpBody:{
      goodjunk:'Collect healthy (🥦🍎), avoid junk (🍔🍟🥤)
Click/Tap/Gaze to score.',
      groups:'Follow 🎯 target group on HUD.
Right +7, wrong -2 (every 3 hits target rotates)',
      hydration:'Keep hydration 45–65%.
💧 +5 / 🧋 -6 • High+💧 or Low+🧋 = heavy penalty',
      plate:'Fill quotas: Grain2 Veg2 Protein1 Fruit1 Dairy1
Perfect +14 • Overfill -1s'
    },
    summary:'Summary'
  }
};

function applyLang(){
  const L = I18N[state.lang] || I18N.TH;
  setText('#brandTitle', L.brand);
  setText('#t_score', L.score);
  setText('#t_combo', L.combo);
  setText('#t_time',  L.time);
  setText('#t_target',L.target);
  setText('#t_quota', L.quota);
  setText('#t_hydro', L.hydro);
  setText('#t_mode',  L.mode);
  setText('#t_diff',  L.diff);
  setText('#modeName', L.modes[state.modeKey]);
  setText('#difficulty', L.diffs[state.difficulty]);

  setText('#btn_start',   L.btn.start);
  setText('#btn_pause',   L.btn.pause);
  setText('#btn_restart', L.btn.restart);
  setText('#btn_help',    L.btn.help);
  setText('#btn_ok',      L.btn.ok);
  setText('#btn_replay',  L.btn.replay);
  setText('#btn_home',    L.btn.home);

  const mg = qs('#m_goodjunk'); if(mg) mg.textContent = '🥗 ' + L.modes.goodjunk;
  const mgp= qs('#m_groups');   if(mgp) mgp.textContent = '🍽️ ' + L.modes.groups;
  const mh = qs('#m_hydration');if(mh) mh.textContent  = '💧 ' + L.modes.hydration;
  const mp = qs('#m_plate');    if(mp) mp.textContent  = '🍱 ' + L.modes.plate;

  const de = qs('#d_easy');   if(de) de.textContent = L.diffs.Easy;
  const dn = qs('#d_normal'); if(dn) dn.textContent = L.diffs.Normal;
  const dh = qs('#d_hard');   if(dh) dh.textContent = L.diffs.Hard;

  const gfxBtn = qs('#gfxToggle');
  if(gfxBtn) gfxBtn.textContent = '🎛️ ' + (state.gfx==='low' ? L.gfx.low : L.gfx.quality);
  const sndBtn = qs('#soundToggle');
  if(sndBtn) sndBtn.textContent = state.soundOn ? L.sound.on : L.sound.off;

  setText('#h_help', L.helpTitle);
  setText('#h_summary', L.summary);

  coach.setLang?.(state.lang);
}
function applyGFX(){
  const L = I18N[state.lang] || I18N.TH;
  if(state.gfx==='low'){
    eng.renderer.setPixelRatio(0.75);
    document.body.classList.add('low-gfx');
    const b = qs('#gfxToggle'); if(b) b.textContent = '🎛️ ' + L.gfx.low;
  }else{
    eng.renderer.setPixelRatio(window.devicePixelRatio || 1);
    document.body.classList.remove('low-gfx');
    const b = qs('#gfxToggle'); if(b) b.textContent = '🎛️ ' + L.gfx.quality;
  }
}
function applySound(){
  const L = I18N[state.lang] || I18N.TH;
  if (typeof sfx.setEnabled === 'function') sfx.setEnabled(state.soundOn);
  else sfx.enabled = state.soundOn;
  const b = qs('#soundToggle');
  if(b) b.textContent = state.soundOn ? L.sound.on : L.sound.off;
  localStorage.setItem('hha_sound', state.soundOn ? '1' : '0');
}
function updateHUD(){
  setText('#score', score.score|0);
  setText('#combo', 'x' + (score.combo||0));
  setText('#time',  state.timeLeft|0);
}
function modeHelpText(){
  const L = I18N[state.lang];
  return L.helpBody[state.modeKey] || '';
}

// ===== DOM Pool for .item =====
const _pool=[]; const POOL_MAX=40;
function createItem(){
  const b=document.createElement('button');
  b.className='item'; b.type='button';
  b.style.position='fixed'; b.style.zIndex='30';
  b.style.minWidth='40px'; b.style.minHeight='40px';
  return b;
}
function getItemEl(){ return _pool.pop() || createItem(); }
function releaseItemEl(el){
  el.onclick=null;
  if(el.parentNode) el.parentNode.removeChild(el);
  if(_pool.length<POOL_MAX) _pool.push(el);
}

// ===== Spawner =====
function spawnOnce(diff){
  const mode = MODES[state.modeKey]; if(!mode) return;
  const meta = mode.pickMeta(diff, state);

  const el = getItemEl();
  el.textContent = meta.char || '?';

  // Safe area: top & bottom (menu)
  const topSafe  = 12;    // %
  const bottomSafe = 18;  // %
  const topMin = topSafe, topMax = 100 - bottomSafe;

  el.style.left = (10 + Math.random()*80) + 'vw';
  el.style.top  = (topMin + Math.random()*(topMax - topMin)) + 'vh';

  el.onclick = () => {
    if(!allowClick()) return;
    mode.onHit(meta, {score, sfx, power, fx}, state, hud);
    state.ctx.hits = (state.ctx.hits||0) + 1;

    if(meta.good || meta.ok){ coach.onGood?.(); playSFX('sfx-good',{volume:.95}); }
    else { coach.onBad?.(state.modeKey); playSFX('sfx-bad',{volume:.95}); }

    updateHUD();
    releaseItemEl(el);
  };

  document.body.appendChild(el);
  setTimeout(()=>{ if(el.isConnected) releaseItemEl(el); }, (diff.life||2500));
}

const timers = { spawn:0, tick:0 };

// ===== Dynamic Difficulty spawnLoop =====
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
  setAppState('playing');
  end(true);
  hud.hideHydration(); hud.hideTarget(); hud.hidePills();

  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  state.running=true; state.timeLeft=diff.time;
  state.ctx={hits:0,perfectPlates:0,hyd:50, miss:0, wrongGroup:0, overflow:0, targetHitsTotal:0};
  state.fever=false; feverCharge=0; hud.setFeverProgress?.(0);
  score.reset(); updateHUD();

  // Hydration reset
  state.hyd=50; state.hydMin=45; state.hydMax=65;

  MODES[state.modeKey].init?.(state, hud, diff);
  if(state.modeKey!=='hydration') hud.hideHydration();
  if(state.modeKey!=='groups' && state.modeKey!=='plate') hud.hideTarget();
  if(state.modeKey!=='plate') hud.hidePills();

  // Mission 45s + HUD
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
    const L=I18N[state.lang]||I18N.TH;
    try{board.submit(state.modeKey,state.difficulty,score.score);}catch{}
    const list=(board.getTop?.(5)||[]).map((r,i)=>`${i+1}. ${r.mode} • ${r.diff} – ${r.score}`).join('<br>');
    const core=qs('#resCore'); if(core) core.innerHTML=`${L.score}: <b>${score.score}</b> | ${L.mode}: <b>${L.modes[state.modeKey]}</b>`;
    const boardEl=qs('#resBoard'); if(boardEl) boardEl.innerHTML=`<h4>🏆 TOP</h4>${list}`;
    setAppState('result'); const res=document.getElementById('result'); res && fadeShow(res); coach.onEnd?.(score.score, score.score>=200?'A':(score.score>=120?'B':'C'));
    setTimeout(focusBtnStart, 100);
  }
}

function tick(){
  if(!state.running) return;
  state.timeLeft--;
  updateHUD();

  // 1) Mission evaluate + HUD
  if (state.mission){
    state.mission.remainSec = Math.max(0, state.mission.remainSec - 1);
    mission.evaluate(state, score, (res)=>{
      if (res.success && !state.mission.done){
        state.mission.done = true; state.mission.success = true;
        fx.spawn3D(null, '🏁 Mission Complete', 'good'); playSFX('sfx-perfect');
        // prog.addXP?.(120,'mission'); prog.grantBadge?.('time_master',120);
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

  // 2) Streak Decay ทุก 3s
  if ((state.timeLeft % 3 === 0) && score.combo > 0) {
    score.combo--; hud.setCombo?.(score.combo);
  }

  // 3) หมดเวลา/เตือน
  if(state.timeLeft<=0){ end(); return; }
  if(state.timeLeft<=10){ document.body.classList.add('flash'); playSFX('sfx-tick'); }
  else{ document.body.classList.remove('flash'); }

  timers.tick = setTimeout(tick, 1000);
}

// ===== Events =====

// ปลดล็อกเสียงจาก gesture แรก
['pointerdown','touchstart','keydown'].forEach(ev=>{
  window.addEventListener(ev, ()=>sfx.unlock(), {once:true, passive:true});
});

// หยุดเมื่อสลับแท็บ/ย่อหน้าต่าง
document.addEventListener('visibilitychange', ()=>{
  if (document.hidden && state.running) state.running=false;
});

// เมนูหลัก
document.addEventListener('click', (e)=>{
  const btn = e.target.closest('#menuBar button'); if(!btn) return;
  const a = btn.getAttribute('data-action');
  const v = btn.getAttribute('data-value');

  if(a==='mode'){ state.modeKey = v; applyLang(); }
  if(a==='diff'){ state.difficulty = v; applyLang(); }
  if(a==='start') preStartFlow();
  if(a==='pause') state.running = !state.running;
  if(a==='restart'){ end(true); setAppState('menu'); start(); setAppState('playing'); }
  if(a==='help'){
    const help = qs('#help');
    const body = qs('#helpBody');
    if(help && body){ body.textContent = modeHelpText(); setAppState('help'); fadeShow(help); }
  }
});

// ปิด Help / Result + คืนโฟกัส
document.getElementById('help')?.addEventListener('click',(e)=>{
  if(e.target.matches('[data-action="helpClose"], #help')){ fadeHide(e.currentTarget); setAppState('menu'); setTimeout(focusBtnStart,50); }
});
document.getElementById('result')?.addEventListener('click',(e)=>{
  const a=e.target.getAttribute('data-result');
  if(a==='replay'){ fadeHide(e.currentTarget); setAppState('playing'); start(); }
  if(a==='home'){   fadeHide(e.currentTarget); setAppState('menu'); setTimeout(focusBtnStart,50); }
});

// สลับภาษา/กราฟิก/เสียง
document.getElementById('langToggle')?.addEventListener('click', ()=>{
  state.lang = state.lang==='TH' ? 'EN' : 'TH';
  localStorage.setItem('hha_lang', state.lang);
  applyLang();
});
document.getElementById('gfxToggle')?.addEventListener('click', ()=>{
  state.gfx = state.gfx==='low' ? 'quality' : 'low';
  localStorage.setItem('hha_gfx', state.gfx);
  applyGFX();
});
document.getElementById('soundToggle')?.addEventListener('click', ()=>{
  state.soundOn = !state.soundOn;
  applySound();
  if(state.soundOn) playSFX('sfx-good',{volume:.5});
});

// Tooltip ภารกิจ
document.getElementById('missionLine')?.addEventListener('click', ()=>{
  const txt = state.mission ? `${mission.describe(state.mission)} • ${state.mission.remainSec|0}s` : '—';
  fx.spawn3D?.(null, txt, 'good');
});

// Gaze long-press (Cardboard/no-click)
document.addEventListener('pointerdown',(e)=>{
  const btn=e.target.closest('.item'); if(!btn) return;
  btn.__pressTimer=setTimeout(()=> btn.click(), 600);
});
document.addEventListener('pointerup',(e)=>{
  const btn=e.target.closest('.item'); if(btn && btn.__pressTimer){ clearTimeout(btn.__pressTimer); btn.__pressTimer=null; }
});

// ===== Boot apply =====
applyLang(); applyGFX(); applySound();

// ===== Optional: Auto Low-GFX by FPS =====
(function fpsGuard(){
  let frames=0, t0=performance.now();
  function loop(){
    frames++;
    const t=performance.now();
    if(t-t0>=1000){
      const fps=frames*1000/(t-t0);
      frames=0; t0=t;
      if(fps<45 && state.gfx!=='low'){
        state.gfx='low'; localStorage.setItem('hha_gfx','low'); applyGFX();
        fx.spawn3D(null,'⚙️ Performance mode','good');
      }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();

// ---------- UI State & Fade helpers (appended) ----------
let __appState = 'menu'; // 'menu' | 'help' | 'demo' | 'playing' | 'result'
function setAppState(next){
  __appState = next;
  document.body.classList.remove('state-menu','state-help','state-demo','state-playing','state-result');
  document.body.classList.add(`state-${next}`);
}
function fadeShow(el){ el.classList.remove('fade-leave','fade-hide'); el.classList.add('fade-enter'); el.style.display='flex'; requestAnimationFrame(()=>el.classList.add('fade-show')); }
function fadeHide(el){ el.classList.remove('fade-enter','fade-show'); el.classList.add('fade-leave','fade-hide'); el.addEventListener('transitionend',()=>{ el.style.display='none'; el.classList.remove('fade-leave','fade-hide'); }, {once:true}); }
const wait = (ms)=>new Promise(r=>setTimeout(r,ms));

async function preStartFlow(){
  // Show Help once per browser
  if (!localStorage.getItem('hha_seen_help')) {
    const help = qs('#help'); const body = qs('#helpBody');
    if (help && body){
      body.textContent = modeHelpText();
      setAppState('help'); fadeShow(help);
      await new Promise(res=>{
        const okBtn=document.getElementById('btn_ok');
        const close=()=>{ okBtn?.removeEventListener('click',close); fadeHide(help); setTimeout(res,180); };
        okBtn?.addEventListener('click', close);
        help.addEventListener('click', (e)=>{ if(e.target===help) close(); });
      });
      localStorage.setItem('hha_seen_help','1');
    }
  }

  // Demo countdown
  setAppState('demo');
  fx.spawn3D?.(null,'3','good'); playSFX('sfx-tick'); await wait(650);
  fx.spawn3D?.(null,'2','good'); playSFX('sfx-tick'); await wait(650);
  fx.spawn3D?.(null,'1','good'); playSFX('sfx-tick'); await wait(650);
  coach.say?.(state.lang==='TH' ? 'แตะ/คลิกเพื่อเก็บที่ถูกต้อง!' : 'Tap/Click the correct ones!');

  await wait(450);
  setAppState('playing');
  start();
}
