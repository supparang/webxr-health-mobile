// === Hero Health Academy — main.js ===
// รวม: Pause/Resume, Help Modal เปลี่ยนตามโหมด, Help Scene, Combo/FEVER,
// Adaptive item size by difficulty, Freeze แบบ freezeUntil, spawn watchdog,
// safe z-index/pointer, และข้อความ i18n TH/EN

window.__HHA_BOOT_OK = true;

import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { Engine } from './core/engine.js';
import { HUD } from './core/hud.js';
import { Coach } from './core/coach.js';
import { SFX } from './core/sfx.js';
import { ScoreSystem } from './core/score.js';
import { PowerUpSystem } from './core/powerup.js';
import { FloatingFX } from './core/fx.js';

import * as goodjunk from './modes/goodjunk.js';
import * as groups    from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate     from './modes/plate.js';

const $ = (s)=>document.querySelector(s);
const byAction = (el)=>el?.closest?.('[data-action]') || null;
const setText = (sel, txt)=>{ const el=$(sel); if(el) el.textContent = txt; };

const MODES = { goodjunk, groups, hydration, plate };
const DIFFS = {
  Easy:   { time:70, spawn:900, life:4200 },
  Normal: { time:60, spawn:700, life:3000 },
  Hard:   { time:50, spawn:550, life:1800 }
};
const SIZE_MAP = { Easy:'88px', Normal:'68px', Hard:'54px' };

const i18n = {
  TH:{
    brand:'HERO HEALTH ACADEMY',
    score:'คะแนน', combo:'คอมโบ', time:'เวลา', target:'หมวด', quota:'โควตา', hydro:'สมดุลน้ำ',
    mode:'โหมด', diff:'ความยาก',
    modes:{ goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ' },
    diffs:{ Easy:'ง่าย', Normal:'ปกติ', Hard:'ยาก' },
    btn:{ start:'▶ เริ่มเกม', pause:'⏸ พัก', restart:'↻ เริ่มใหม่', help:'❓ วิธีเล่น', ok:'โอเค', replay:'↻ เล่นอีกครั้ง', home:'🏠 หน้าหลัก' },
    helpTitle:'วิธีเล่น', summary:'สรุปผล',
    helpBody:{
      goodjunk:'เก็บอาหารดี (🥦🍎) หลีกเลี่ยงของขยะ (🍔🍟🥤)\nแตะ/คลิกไวได้ PERFECT! • มีพาวเวอร์ ✖️2 และ 🧊',
      groups:'ดู 🎯 เป้าหมายบน HUD แล้วเก็บให้ “ตรงหมวด” (+7)\nดีแต่ไม่ตรงเป้า (+2) • ผิดหมวด (-2) • มีพาวเวอร์ ✨✖️2🧊🔄',
      hydration:'รักษาแถบน้ำให้อยู่ 45–65%\n💧/🥛 เพิ่มน้ำ • 🥤/☕ ลดน้ำ • ผลลัพธ์: good/ok/bad',
      plate:'เติมโควตา: ธัญพืช2 ผัก2 โปรตีน1 ผลไม้1 นม1\nเก็บครบ = PERFECT จานใหม่ • เกินโควตา = โดนโทษ'
    },
    hs:{
      goodjunk:{title:'ดี vs ขยะ', icon:'🥗', lines:['เก็บของดี หลีกขยะ','กดไว PERFECT ได้คะแนน+คอมโบดี','พาวเวอร์: ✖️2, 🧊']},
      groups:{title:'จาน 5 หมู่', icon:'🍽️', lines:['เก็บให้ตรงกับ 🎯 เป้าหมาย','ครบ 3 ชิ้นจะหมุนเป้า','พาวเวอร์: ✨ เป้า×2, ✖️2, 🧊, 🔄']},
      hydration:{title:'สมดุลน้ำ', icon:'💧', lines:['คุม 45–65%','น้ำ/นม=ดี, น้ำหวาน/กาแฟ=ลบ','ได้ผลลัพธ์ good/ok/bad']},
      plate:{title:'จัดจานสุขภาพ', icon:'🍱', lines:['โควตา: ธัญพืช2 ผัก2 โปรตีน1 ผลไม้1 นม1','ครบจาน = PERFECT','เกินโควตา = โดนโทษ']}
    }
  },
  EN:{
    brand:'HERO HEALTH ACADEMY',
    score:'Score', combo:'Combo', time:'Time', target:'Target', quota:'Quota', hydro:'Hydration',
    mode:'Mode', diff:'Difficulty',
    modes:{ goodjunk:'Good vs Junk', groups:'5 Food Groups', hydration:'Hydration', plate:'Healthy Plate' },
    diffs:{ Easy:'Easy', Normal:'Normal', Hard:'Hard' },
    btn:{ start:'▶ Start', pause:'⏸ Pause', restart:'↻ Restart', help:'❓ How to Play', ok:'OK', replay:'↻ Replay', home:'🏠 Home' },
    helpTitle:'How to Play', summary:'Summary',
    helpBody:{
      goodjunk:'Collect healthy (🥦🍎), avoid junk (🍔🍟🥤)\nTap fast for PERFECT! • Power-ups ✖️2 & 🧊',
      groups:'Follow 🎯 target group on HUD\nRight=+7 • OK=+2 • Wrong=-2 • Power ✨✖️2🧊🔄',
      hydration:'Keep hydration 45–65%\n💧/🥛 up • 🥤/☕ down • Returns good/ok/bad',
      plate:'Fill quotas: Grain2 Veg2 Protein1 Fruit1 Dairy1\nPerfect plate → reset • Overfill = penalty'
    },
    hs:{
      goodjunk:{title:'Good vs Junk', icon:'🥗', lines:['Collect good, avoid junk','Tap fast = PERFECT','Powers: ✖️2, 🧊']},
      groups:{title:'5 Food Groups', icon:'🍽️', lines:['Match the 🎯 target','Every 3 hits rotate target','Powers: ✨ dual, ✖️2, 🧊, 🔄']},
      hydration:{title:'Hydration', icon:'💧', lines:['Stay 45–65%','Water/Milk good • Soda/Coffee bad','Returns good/ok/bad']},
      plate:{title:'Healthy Plate', icon:'🍱', lines:['Quotas 2/2/1/1/1','Perfect plate resets','Overfill = penalty']}
    }
  }
};
const T = (lang)=>i18n[lang]||i18n.TH;

/* Systems */
const hud   = new HUD();
const sfx   = new SFX();
const score = new ScoreSystem();
const power = new PowerUpSystem();
const eng   = new Engine(THREE, document.getElementById('c'));
const fx    = new FloatingFX(eng);
const coach = new Coach({ lang: localStorage.getItem('hha_lang') || 'TH' });

/* State */
const state = {
  modeKey:'goodjunk',
  difficulty:'Normal',
  running:false,
  paused:false,
  timeLeft:60,
  lang: localStorage.getItem('hha_lang') || 'TH',
  gfx:  localStorage.getItem('hha_gfx')  || 'quality',
  soundOn: (localStorage.getItem('hha_sound') ?? '1') === '1',
  ctx:{},
  combo:0, bestCombo:0,
  fever:{ active:false, meter:0, drainPerSec:14, chargePerGood:10, chargePerPerfect:20, threshold:100, mul:2, timeLeft:0 },
  freezeUntil: 0,
  lastSpawnAt: 0,
  spawnTimer:0, tickTimer:0
};

/* FEVER helpers */
function setFeverBar(pct){ const b=$('#feverBar'); if(b) b.style.width=Math.max(0,Math.min(100,pct))+'%'; }
function showFeverLabel(on){ const f=$('#fever'); if(f){ f.style.display=on?'block':'none'; f.classList.toggle('pulse',on);} }
function startFever(){ if(state.fever.active) return; state.fever.active=true; state.fever.timeLeft=7; showFeverLabel(true); try{$('#sfx-powerup')?.play();}catch{} }
function stopFever(){ state.fever.active=false; state.fever.timeLeft=0; showFeverLabel(false); }

function addCombo(kind){
  if(kind==='bad'){ state.combo=0; hud.setCombo?.('x0'); return; }
  if(kind==='good'||kind==='perfect'){
    state.combo++; state.bestCombo = Math.max(state.bestCombo, state.combo);
    hud.setCombo?.('x'+state.combo);
    if(!state.fever.active){
      state.fever.meter = Math.min(100, state.fever.meter + (kind==='perfect'?state.fever.chargePerPerfect:state.fever.chargePerGood));
      setFeverBar(state.fever.meter);
      if(state.fever.meter>=state.fever.threshold) startFever();
    }else{
      state.fever.timeLeft = Math.min(10, state.fever.timeLeft + 0.6);
    }
  }
}
function scoreWithEffects(base, x, y){
  const comboMul = state.combo>=20?1.4: state.combo>=10?1.2: 1.0;
  const feverMul = state.fever.active?state.fever.mul:1.0;
  const total = Math.round(base * comboMul * feverMul + (power.scoreBoost||0));
  score.add?.(total);
  const tag = total>=0?`+${total}`:`${total}`;
  fx.popText?.(tag, { color: total>=0 ? '#7fffd4' : '#ff9b9b' });
}

/* UI */
function applyLang(){
  const L = T(state.lang);
  setText('#brandTitle', L.brand);
  setText('#t_score', L.score); setText('#t_combo', L.combo); setText('#t_time', L.time);
  setText('#t_target', L.target); setText('#t_quota', L.quota); setText('#t_hydro', L.hydro);
  setText('#t_mode', L.mode); setText('#t_diff', L.diff);
  setText('#modeName', L.modes[state.modeKey]); setText('#difficulty', L.diffs[state.difficulty]);
  setText('#btn_start', L.btn.start); setText('#btn_pause', L.btn.pause); setText('#btn_restart', L.btn.restart);
  setText('#btn_help', L.btn.help); setText('#btn_ok', L.btn.ok); setText('#btn_replay', L.btn.replay); setText('#btn_home', L.btn.home);
  setText('#h_help', L.helpTitle); setText('#h_summary', L.summary);
  const mg=$('#m_goodjunk'); if(mg) mg.textContent='🥗 '+L.modes.goodjunk;
  const gg=$('#m_groups');   if(gg) gg.textContent='🍽️ '+L.modes.groups;
  const hy=$('#m_hydration');if(hy) hy.textContent='💧 '+L.modes.hydration;
  const pl=$('#m_plate');    if(pl) pl.textContent='🍱 '+L.modes.plate;
}
function applyGFX(){
  try{
    eng.renderer.setPixelRatio(state.gfx==='low'?0.75:(window.devicePixelRatio||1));
    $('#gfxToggle').textContent = state.gfx==='low' ? '🎛️ กราฟิก: ประหยัด' : '🎛️ กราฟิก: ปกติ';
  }catch{}
}
function applySound(){
  if (typeof sfx.setEnabled === 'function') sfx.setEnabled(state.soundOn);
  $('#soundToggle').textContent = state.soundOn ? '🔊 เสียง: เปิด' : '🔇 เสียง: ปิด';
  localStorage.setItem('hha_sound', state.soundOn ? '1' : '0');
}
function updateHUD(){
  hud.setScore?.(score.score);
  hud.setTime?.(state.timeLeft);
  hud.setCombo?.('x'+state.combo);
}
function modeHelpText(){
  const L=T(state.lang).helpBody; return L[state.modeKey] || '—';
}
function buildHelpScene(){
  const L = T(state.lang).hs;
  const host = $('#hs_body'); if(!host) return;
  const cards = [
    L.goodjunk, L.groups, L.hydration, L.plate
  ].map(({title, icon, lines})=>(
    `<div class="hs-card"><div class="hs-icon">${icon}</div><h4>${title}</h4><ul style="margin:6px 0 0 18px">`+
    lines.map(s=>`<li>${s}</li>`).join('')+
    `</ul></div>`
  )).join('');
  host.innerHTML = cards;
}

/* Spawn */
function spawnOnce(diff){
  if(!state.running || state.paused) return;
  const mode = MODES[state.modeKey];
  const meta = mode?.pickMeta?.(diff, state) || {};

  const el = document.createElement('button');
  el.className='item'; el.type='button';
  el.textContent = meta.char || '❓';
  el.style.fontSize = SIZE_MAP[state.difficulty] || '68px';
  el.style.position='fixed'; el.style.border='none'; el.style.background='transparent';
  el.style.cursor='pointer'; el.style.lineHeight=1; el.style.transition='transform .15s, filter .15s';
  el.style.zIndex='1002'; el.style.pointerEvents='auto';

  el.addEventListener('pointerenter', ()=>{ el.style.transform='scale(1.18)'; }, {passive:true});
  el.addEventListener('pointerleave', ()=>{ el.style.transform='scale(1)'; }, {passive:true});

  // safe area
  const headerH = $('header.brand')?.offsetHeight || 56;
  const menuH   = $('#menuBar')?.offsetHeight || 120;
  const yMin = headerH + 60, yMax = Math.max(yMin + 50, innerHeight - menuH - 80);
  const xMin = 20,         xMax = Math.max(xMin + 50, innerWidth  - 80);
  el.style.left = (xMin + Math.random()*(xMax-xMin)) + 'px';
  el.style.top  = (yMin + Math.random()*(yMax-yMin)) + 'px';

  el.addEventListener('click',(ev)=>{
    ev.stopPropagation();
    try{
      const sys = { score, sfx, power, coach, fx };
      const res = mode?.onHit?.(meta, sys, state, hud) || (meta.good?'good':'ok');

      const r = el.getBoundingClientRect();
      if (res==='good' || res==='perfect') addCombo(res);
      if (res==='bad') addCombo('bad');

      const base = { good:7, perfect:14, ok:2, bad:-3, power:5 }[res] ?? 1;
      scoreWithEffects(base, r.left+r.width/2, r.top+r.height/2);
    }catch(e){ console.error('[HHA] onHit:', e); }
    finally{ el.remove(); }
  }, {passive:true});

  document.body.appendChild(el);
  state.lastSpawnAt = (performance?.now?.() ?? Date.now());

  setTimeout(()=>{ try{ el.remove(); }catch{} }, meta.life || diff.life || 3000);
}

function spawnLoop(){
  if(!state.running || state.paused) return;

  const now = performance?.now?.() ?? Date.now();
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;

  // Freeze window (มาจากโหมด set state.freezeUntil)
  if (state.freezeUntil && now < state.freezeUntil){
    state.spawnTimer = setTimeout(spawnLoop, 120);
    return;
  }

  spawnOnce(diff);

  // spawn interval clamp + timeScale guard
  const scale = Math.max(0.25, Math.min(3, power.timeScale || 1));
  const next  = Math.max(260, Math.min(2000, (diff.spawn || 700) * scale));

  // watchdog ถ้าหายเงียบ > 2.5s ให้ซ้อนของเพิ่ม 1 ชิ้น
  setTimeout(()=>{
    const t = performance?.now?.() ?? Date.now();
    if (state.running && !state.paused && (t - state.lastSpawnAt > 2500)) spawnOnce(diff);
  }, 2500);

  state.spawnTimer = setTimeout(spawnLoop, next);
}

/* Tick */
function tick(){
  if(!state.running || state.paused) return;

  // Fever drain
  if (state.fever.active){
    state.fever.timeLeft = Math.max(0, state.fever.timeLeft - 1);
    state.fever.meter    = Math.max(0, state.fever.meter - state.fever.drainPerSec);
    setFeverBar(state.fever.meter);
    if (state.fever.timeLeft<=0 || state.fever.meter<=0) stopFever();
  }

  // per-mode tick
  try{ MODES[state.modeKey]?.tick?.(state, {score,sfx,power,coach,fx}, hud); }catch(e){ console.warn('[HHA] mode.tick:', e); }

  state.timeLeft = Math.max(0, state.timeLeft - 1);
  updateHUD();

  if (state.timeLeft <= 0){ end(); return; }
  if (state.timeLeft <= 10){ try{ $('#sfx-tick')?.play(); }catch{} }

  state.tickTimer = setTimeout(tick, 1000);
}

/* Flow */
function start(){
  end(true);
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;

  state.running = true; state.paused=false;
  state.timeLeft = diff.time;
  state.combo=0; state.bestCombo=0; state.fever.meter=0; setFeverBar(0); stopFever();
  state.freezeUntil = 0; state.lastSpawnAt = 0;
  score.reset?.(); updateHUD();

  // ซ่อน/โชว์ HUD เฉพาะโหมด
  hud.hideHydration?.(); hud.hideTarget?.(); hud.hidePills?.();
  try{ MODES[state.modeKey]?.init?.(state, hud, diff); }catch(e){ console.error('[HHA] init:', e); }
  if(state.modeKey!=='hydration') hud.hideHydration?.();
  if(state.modeKey!=='groups' && state.modeKey!=='plate') hud.hideTarget?.();
  if(state.modeKey!=='plate') hud.hidePills?.();

  // mission line เริ่มเป็นช่องว่าง (ให้โหมดอัปเดตเอง)
  const ml = $('#missionLine'); if(ml) ml.style.display='block';

  coach.onStart?.(state.modeKey);
  tick(); spawnLoop();
}
function end(silent=false){
  state.running=false; state.paused=false;
  clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer);
  try{ MODES[state.modeKey]?.cleanup?.(state, hud); }catch{}
  const ml = $('#missionLine'); if(ml) ml.style.display='none';
  if(!silent){ const m=$('#result'); if(m) m.style.display='flex'; coach.onEnd?.(score.score, { grade:'A' }); }
}

/* Events */
document.addEventListener('pointerup', (e)=>{
  const btn = byAction(e.target); if(!btn) return;
  const a = btn.getAttribute('data-action'); const v = btn.getAttribute('data-value');

  if (a==='mode'){ state.modeKey=v; applyLang(); if(state.running) start(); }
  else if (a==='diff'){ state.difficulty=v; applyLang(); if(state.running) start(); }
  else if (a==='start'){ start(); }
  else if (a==='pause'){
    if (!state.running){ start(); return; }
    state.paused = !state.paused;
    if (!state.paused){ tick(); spawnLoop(); }
    else { clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer); }
  }
  else if (a==='restart'){ end(true); start(); }
  else if (a==='help'){ const m=$('#help'); const body=$('#helpBody'); if(m&&body){ body.textContent=modeHelpText(); m.style.display='flex'; } }
  else if (a==='helpClose'){ const m=$('#help'); if(m) m.style.display='none'; }
  else if (a==='helpScene'){ buildHelpScene(); const m=$('#helpScene'); if(m) m.style.display='flex'; }
  else if (a==='helpSceneClose'){ const m=$('#helpScene'); if(m) m.style.display='none'; }
}, {passive:true});

$('#langToggle')?.addEventListener('click', ()=>{
  state.lang = state.lang==='TH' ? 'EN' : 'TH';
  localStorage.setItem('hha_lang', state.lang);
  coach.setLang?.(state.lang);
  applyLang();
}, {passive:true});

$('#gfxToggle')?.addEventListener('click', ()=>{
  state.gfx = state.gfx==='low' ? 'quality' : 'low';
  localStorage.setItem('hha_gfx', state.gfx);
  applyGFX();
}, {passive:true});

$('#soundToggle')?.addEventListener('click', ()=>{
  state.soundOn = !state.soundOn; applySound();
  if(state.soundOn){ try{ $('#sfx-good')?.play(); }catch{} }
}, {passive:true});

/* Boot */
['pointerdown','touchstart','keydown'].forEach(ev=>{
  window.addEventListener(ev, ()=>sfx.unlock?.(), { once:true, passive:true });
});

applyLang(); applyGFX(); applySound(); updateHUD();
