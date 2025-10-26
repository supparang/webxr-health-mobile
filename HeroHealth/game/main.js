// ===== Boot flag (for index bootWarn) =====
window.__HHA_BOOT_OK = true;

// ===== Imports (required) =====
import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { Engine } from './core/engine.js';
import { HUD } from './core/hud.js';
import { SFX } from './core/sfx.js';
import { PowerUpSystem } from './core/powerup.js';
import { ScoreSystem } from './core/score.js';
import { Coach } from './core/coach.js';

import * as goodjunk from './modes/goodjunk.js';
import * as groups    from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate     from './modes/plate.js';

// ===== Optional imports (safe with fallback) =====
let board, mission, fx;
// Leaderboard
try {
  const m = await import('./core/leaderboard.js');
  board = new m.Leaderboard();
} catch {
  board = { submit(){}, getTop(){ return []; } };
}
// MissionSystem
try {
  const m = await import('./core/mission.js');
  mission = new m.MissionSystem();
} catch {
  mission = {
    start(){ return null; },
    describe(){ return ''; },
    evaluate(){ /* noop */ }
  };
}
// FloatingFX
try {
  const m = await import('./core/fx.js');
  // Engine ดึงไว้แล้วด้านล่าง
  fx = new m.FloatingFX();
} catch {
  fx = { spawn3D(){}, popText(){ } };
}

// ===== Helpers =====
const qs = (s) => document.querySelector(s);
const setText = (sel, txt) => { const el = qs(sel); if (el) el.textContent = txt; };
const show = (sel, on, disp='flex') => { const el = qs(sel); if (el) el.style.display = on ? disp : 'none'; };
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
const power = new PowerUpSystem();
const score = new ScoreSystem();

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

// ถ้า fx ยังเป็น fallback ให้ผูกเอฟเฟกต์จาก engine ถ้ามี
if (!fx || !fx.spawn3D) {
  fx = eng?.fx || { spawn3D(){}, popText(){} };
}
const coach = new Coach({ lang: state.lang });

// ===== Score hooks → Fever & HUD =====
let feverCharge = 0;               // 0..1
const FEVER_REQ = 10;              // combo to trigger FEVER

if (typeof score.setBoostFn === 'function') {
  score.setBoostFn(()=> power.scoreBoost || 0);
}
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
        try{ sfx.play('sfx-powerup'); }catch{}
        power.apply?.('boost'); // +100% คะแนน 7s
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
      goodjunk:'เก็บอาหารดี (🥦🍎) หลีกเลี่ยงของขยะ (🍔🍟🥤)\nคลิก/แตะ/จ้อง เพื่อเก็บคะแนน',
      groups:'ดู 🎯 เป้าหมายบน HUD แล้วเก็บให้ตรงหมวด\nถูก +7 ผิด -2 (ครบ 3 จะเปลี่ยนหมวด)',
      hydration:'รักษาแถบน้ำ 45–65%\n💧 +5 / 🧋 -6 • น้ำสูง+ดื่มน้ำ หรือ น้ำต่ำ+ดื่มหวาน = โทษหนัก',
      plate:'เติมโควตา: ธัญพืช2 ผัก2 โปรตีน1 ผลไม้1 นม1\nครบ +14 • เกินโควตา -1s'
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
      goodjunk:'Collect healthy (🥦🍎), avoid junk (🍔🍟🥤)\nClick/Tap/Gaze to score.',
      groups:'Follow 🎯 target group on HUD.\nRight +7, wrong -2 (every 3 hits target rotates)',
      hydration:'Keep hydration 45–65%.\n💧 +5 / 🧋 -6 • High+💧 or Low+🧋 = heavy penalty',
      plate:'Fill quotas: Grain2 Veg2 Protein1 Fruit1 Dairy1\nPerfect +14 • Overfill -1s'
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
    eng.renderer?.setPixelRatio?.(0.75);
    document.body.classList.add('low-gfx');
    const b = qs('#gfxToggle'); if(b) b.textContent = '🎛️ ' + L.gfx.low;
  }else{
    eng.renderer?.setPixelRatio?.(window.devicePixelRatio || 1);
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

// ===== Spawner =====
function spawnOnce(diff){
  const mode = MODES[state.modeKey]; if(!mode) return;
  const meta = mode.pickMeta?.(diff, state) || {};

  const el = document.createElement('button');
  el.className = 'item';
  el.type = 'button';
  el.textContent = meta.char || '?';

  // Adaptive icon size by difficulty
  const sizeMap = { Easy:'88px', Normal:'68px', Hard:'54px' };
  el.style.fontSize = sizeMap[state.difficulty] || '68px';

  // Safe area กันชนเมนูล่าง/บน
  const headerH = document.querySelector('header.brand')?.offsetHeight || 56;
  const menuH   = document.querySelector('#menuBar')?.offsetHeight || 120;
  const yMin = headerH + 40;
  const yMax = Math.max(yMin + 40, window.innerHeight - menuH - 80);
  const xMin = 20;
  const xMax = Math.max(xMin + 50, window.innerWidth - 80);

  el.style.position = 'fixed';
  el.style.left = (xMin + Math.random()*(xMax-xMin)) + 'px';
  el.style.top  = (yMin + Math.random()*(yMax-yMin)) + 'px';
  el.style.zIndex = '80';
  el.style.background = 'none';
  el.style.border = 'none';
  el.style.cursor = 'pointer';
  el.style.lineHeight = 1;
  el.style.transition = 'transform .15s, filter .15s';

  el.addEventListener('pointerenter', ()=>{ el.style.transform = 'scale(1.18)'; }, {passive:true});
  el.addEventListener('pointerleave', ()=>{ el.style.transform = 'scale(1)'; }, {passive:true});

  el.addEventListener('click', (ev)=>{
    ev.stopPropagation();
    try{
      const sys = { score, sfx, power, fx, coach };
      // โหมดควรส่งคืน 'good' | 'ok' | 'bad' | 'perfect' | 'power'
      const res = mode.onHit?.(meta, sys, state, hud) || 'ok';

      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width/2;
      const y = rect.top  + rect.height/2;

      // combo/fever (ใช้ score.setHandlers ข้างบนอยู่แล้ว) — ที่นี่แค่อัปเดตคอมโบฐาน
      if (res==='good' || res==='perfect'){ score.combo = (score.combo||0) + 1; }
      if (res==='bad'){ score.combo = 0; }

      // ให้คะแนนรวมศูนย์ (base map)
      const base = { good:7, perfect:14, ok:2, bad:-3, power:5 }[res] ?? 1;
      score.add?.(base + (power.scoreBoost||0));
      // เอฟเฟกต์ตัวเลขลอย
      fx.popText?.((base>=0?`+${base}`:`${base}`), { color: base>=0 ? '#7fffd4' : '#ff9b9b' });

      updateHUD();
      if (res==='perfect'){ try{ sfx.play('sfx-perfect'); }catch{} }
      else if (res==='good'){ try{ sfx.play('sfx-good'); }catch{} }
      else if (res==='bad'){ try{ sfx.play('sfx-bad'); }catch{} }
    }catch(err){
      console.error('[HHA] onHit error:', err);
    }finally{
      el.remove();
    }
  }, { passive:true });

  document.body.appendChild(el);
  setTimeout(()=>{ try{ el.remove(); }catch{} }, (meta.life || diff.life || 3000));
}

const timers = { spawn:0, tick:0 };

// ===== Dynamic Difficulty spawnLoop =====
function spawnLoop(){
  if(!state.running) return;

  const base = DIFFS[state.difficulty] || DIFFS.Normal;
  const hits = state.ctx.hits||0;
  const miss = state.ctx.miss||0;
  const acc  = hits > 0 ? (hits / Math.max(1, hits + miss)) : 1;

  const tune = acc > 0.80 ? 0.90 : (acc < 0.50 ? 1.10 : 1.00);

  const dyn = {
    ...base,
    spawn: Math.max(300, Math.round(base.spawn * tune)),
    life:  Math.max(900,  Math.round(base.life  / tune))
  };

  spawnOnce(dyn);

  const accel = Math.max(0.5, 1 - (score.score/400));
  const next  = Math.max(220, dyn.spawn * accel * (power.timeScale||1));
  timers.spawn = setTimeout(spawnLoop, next);
}

// ===== Start / End / Tick =====
function start(){
  end(true);
  hud.hideHydration?.(); hud.hideTarget?.(); hud.hidePills?.();

  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  state.running = true;
  state.timeLeft = diff.time;
  state.ctx = { hits:0, perfectPlates:0, hyd:50 };
  state.fever = false;
  feverCharge = 0;
  hud.setFeverProgress?.(0);
  score.reset?.();
  updateHUD();

  MODES[state.modeKey].init?.(state, hud, diff);
  if(state.modeKey!=='hydration') hud.hideHydration?.();
  if(state.modeKey!=='groups' && state.modeKey!=='plate') hud.hideTarget?.();
  if(state.modeKey!=='plate') hud.hidePills?.();

  // เริ่มภารกิจ 45s + แสดงบน HUD (ถ้ามีระบบภารกิจ)
  state.mission = mission.start?.(state.modeKey) || null;
  if (state.mission){
    try{
      const desc = mission.describe?.(state.mission) || '';
      setMissionLine(`${desc} • 45s`, true);
    }catch{ setMissionLine('—', false); }
  } else {
    setMissionLine(null, false);
  }

  coach.onStart?.(state.modeKey);
  try{ sfx.play('sfx-good'); }catch{}
  tick(); spawnLoop();
}

function end(silent=false){
  state.running = false;
  clearTimeout(timers.spawn);
  clearTimeout(timers.tick);
  hud.hideHydration?.(); hud.hideTarget?.(); hud.hidePills?.();
  setMissionLine(null, false);

  if(!silent){
    const L = I18N[state.lang] || I18N.TH;
    try{ board.submit?.(state.modeKey, state.difficulty, score.score); }catch{}
    const top = (board.getTop?.(5) || []).map((r,i)=>`${i+1}. ${r.mode} • ${r.diff} – ${r.score}`).join('<br>');
    const core = qs('#resCore'); if(core) core.innerHTML = `${L.score}: <b>${score.score}</b> | ${L.mode}: <b>${L.modes[state.modeKey]}</b>`;
    const boardEl = qs('#resBoard'); if(boardEl) boardEl.innerHTML = `<h4>🏆 TOP</h4>${top}`;
    show('#result', true);
    coach.onEnd?.(score.score, score.score>=200?'A':(score.score>=120?'B':'C'));
  }
}

function tick(){
  if(!state.running) return;
  state.timeLeft--;
  updateHUD();

  // Mission evaluate (ถ้ามี)
  if (state.mission){
    state.mission.remainSec = Math.max(0, (state.mission.remainSec||45) - 1);
    mission.evaluate?.(state, score, (res)=>{
      if (res?.success && !state.mission.done){
        state.mission.done = true;
        state.mission.success = true;
        fx.spawn3D?.(null, '🏁 Mission Complete', 'good');
        try{ sfx.play('sfx-perfect'); }catch{}
      }
    });

    try{
      const desc = mission.describe?.(state.mission) || '';
      setMissionLine(`${desc} • ${state.mission.remainSec|0}s`, true);
    }catch{ setMissionLine('—', false); }

    if (state.mission.remainSec === 0 && !state.mission.done){
      state.mission.done = true;
      state.mission.success = false;
      fx.spawn3D?.(null, '⌛ Mission Failed', 'bad');
    }
  }

  // Streak decay
  if ((state.timeLeft % 3 === 0) && (score.combo||0) > 0) {
    score.combo--; setText('#combo', 'x' + (score.combo||0));
  }

  if(state.timeLeft<=0){ end(); return; }
  if(state.timeLeft<=10){
    document.body.classList.add('flash');
    try{ document.getElementById('sfx-tick')?.play(); }catch{}
  }else{
    document.body.classList.remove('flash');
  }

  timers.tick = setTimeout(tick, 1000);
}

// ===== Events =====

// ปลดล็อกเสียงครั้งแรก
['pointerdown','touchstart','keydown'].forEach(ev=>{
  window.addEventListener(ev, ()=>sfx.unlock?.(), { once:true, passive:true });
});

// หยุดสไปว์นชั่วคราวเมื่อสลับแท็บ
document.addEventListener('visibilitychange', ()=>{
  if (document.hidden) { clearTimeout(timers.spawn); clearTimeout(timers.tick); }
  else if (state.running){ tick(); spawnLoop(); }
});

// เมนูหลัก
document.addEventListener('click', (e)=>{
  const btn = e.target.closest('#menuBar button'); if(!btn) return;
  const a = btn.getAttribute('data-action');
  const v = btn.getAttribute('data-value');

  if(a==='mode'){ state.modeKey = v; applyLang(); }
  if(a==='diff'){ state.difficulty = v; applyLang(); }
  if(a==='start') start();
  if(a==='pause'){
    // toggle pause โดยหยุด timers
    if (state.running){
      state.running = false;
      clearTimeout(timers.spawn); clearTimeout(timers.tick);
    } else {
      state.running = true; tick(); spawnLoop();
    }
  }
  if(a==='restart'){ end(true); start(); }
  if(a==='help'){
    const help = qs('#help');
    const body = qs('#helpBody');
    if(help && body){ body.textContent = modeHelpText(); help.style.display = 'flex'; }
  }
  if(a==='helpScene'){ const hs = qs('#helpScene'); if(hs) hs.style.display='flex'; }
  if(a==='helpSceneClose'){ const hs = qs('#helpScene'); if(hs) hs.style.display='none'; }
});

// ปิด Help โดยคลิกปุ่มหรือพื้นที่มืด
const helpEl = qs('#help');
if(helpEl){
  helpEl.addEventListener('click', (e)=>{
    if(e.target.matches('[data-action="helpClose"], #help')) helpEl.style.display = 'none';
  });
}

// Result modal
const resEl = qs('#result');
if(resEl){
  resEl.addEventListener('click', (e)=>{
    const a = e.target.getAttribute('data-result');
    if(a==='replay'){ resEl.style.display='none'; start(); }
    if(a==='home'){ resEl.style.display='none'; }
  });
}

// สลับภาษา/กราฟิก/เสียง
qs('#langToggle')?.addEventListener('click', ()=>{
  state.lang = state.lang==='TH' ? 'EN' : 'TH';
  localStorage.setItem('hha_lang', state.lang);
  applyLang();
}, {passive:true});

qs('#gfxToggle')?.addEventListener('click', ()=>{
  state.gfx = state.gfx==='low' ? 'quality' : 'low';
  localStorage.setItem('hha_gfx', state.gfx);
  applyGFX();
}, {passive:true});

qs('#soundToggle')?.addEventListener('click', ()=>{
  state.soundOn = !state.soundOn;
  applySound();
  if(state.soundOn){ try{ sfx.play('sfx-good',{volume:0.9}); }catch{} }
}, {passive:true});

// Tooltip ภารกิจ
document.getElementById('missionLine')?.addEventListener('click', ()=>{
  const txt = state.mission
    ? ((mission.describe?.(state.mission)||'') + ` • ${state.mission.remainSec|0}s`)
    : '—';
  fx.spawn3D?.(null, txt, 'good');
});

// ===== Boot apply =====
applyLang(); applyGFX(); applySound();
