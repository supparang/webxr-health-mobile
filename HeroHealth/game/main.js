// === Hero Health Academy — main.js (stable+click bindings) ===
// - Icon auto-size by difficulty
// - Score/combo/fever effects (popup + flame)
// - Centered modals + z-index สูง
// - Safe spawn area (ไม่ทับ header/menu)
// - ปุ่มทุกอย่างใช้ "click" ตรงๆ (แทน pointerup) แก้ปัญหากดไม่ติด

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
const $ = (s) => document.querySelector(s);
const setText = (sel, txt) => { const el = $(sel); if (el) el.textContent = txt; };

// ----- Config -----
const MODES = { goodjunk, groups, hydration, plate };
const DIFFS = {
  Easy:   { time: 70, spawn: 900, life: 4200 },
  Normal: { time: 60, spawn: 700, life: 3000 },
  Hard:   { time: 50, spawn: 550, life: 1800 }
};
const ICON_SIZE_MAP = { Easy: 92, Normal: 72, Hard: 58 };

const I18N = {
  TH:{
    names:{goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ'},
    diffs:{Easy:'ง่าย', Normal:'ปกติ', Hard:'ยาก'},
    helpBody:{
      goodjunk:'เก็บอาหารดี (🥦🍎) หลีกเลี่ยงของขยะ (🍔🍟🥤)\nแตะไอคอนเพื่อเก็บคะแนน มี Mini-Quest 45s ให้เก็บของดีตามที่กำหนด',
      groups:'ดู 🎯 เป้าหมายบน HUD แล้วเก็บให้ตรงหมวด\nถูก +7 ผิด -2 • มีพาวเวอร์อัป/ภารกิจ 45 วิ',
      hydration:'รักษาแถบน้ำ 45–65%\n💧 บวก / 🥤☕ ลบ • อยู่ในโซนจะได้คะแนนดีกว่า',
      plate:'เติมโควตา: ธัญพืช2 ผัก2 โปรตีน1 ผลไม้1 นม1\nครบ +14 • เกินโควตา -1s'
    }
  },
  EN:{
    names:{goodjunk:'Good vs Junk', groups:'Food Groups', hydration:'Hydration', plate:'Healthy Plate'},
    diffs:{Easy:'Easy', Normal:'Normal', Hard:'Hard'},
    helpBody:{
      goodjunk:'Collect healthy food (🥦🍎), avoid junk (🍔🍟🥤).\nTap icons to score. Includes a 45s mini-quest.',
      groups:'Follow the 🎯 target group on HUD.\nRight +7, wrong -2 • power-ups & 45s mission.',
      hydration:'Keep hydration between 45–65%.\n💧 increases / 🥤☕ decreases • staying in zone scores better.',
      plate:'Fill quotas: Grain2 Veg2 Protein1 Fruit1 Dairy1\nPerfect +14 • Overfill -1s'
    }
  }
};
const T = (lang)=> I18N[lang] || I18N.TH;

// ----- State & Systems -----
const state = {
  modeKey: 'goodjunk',
  difficulty: 'Normal',
  running: false,
  paused: false,
  timeLeft: 60,
  lang: localStorage.getItem('hha_lang') || 'TH',
  gfx:  localStorage.getItem('hha_gfx')  || 'quality',
  combo: 0,
  bestCombo: 0,
  fever: { active:false, meter:0, drainPerSec:14, chargeGood:10, chargePerfect:20, threshold:100, mul:2, timeLeft:0 },
  spawnTimer: 0,
  tickTimer: 0,
  ctx: {}
};

const hud   = new HUD();
const sfx   = new SFX();
const score = new ScoreSystem();
const power = new PowerUpSystem();
const coach = new Coach({ lang: state.lang });
const eng   = new Engine(THREE, document.getElementById('c'));

// ----- UI Apply -----
function applyUI(){
  const L = T(state.lang);
  setText('#modeName',   (L.names[state.modeKey] || state.modeKey));
  setText('#difficulty', (L.diffs[state.difficulty] || state.difficulty));
}
function updateHUD(){
  hud.setScore?.(score.score);
  hud.setTime?.(state.timeLeft);
  hud.setCombo?.('x' + state.combo);
}
function modeHelpText(){
  return (T(state.lang).helpBody[state.modeKey] || '');
}
function renderHelpScene(){
  const hsBody = document.getElementById('hs_body');
  if (!hsBody) return;

  const L = T(state.lang);
  // ไอคอน + ชื่อโหมด
  const MODE_META = [
    { key:'goodjunk',  icon:'🥗', name:L.names.goodjunk,  body:L.help.goodjunk },
    { key:'groups',    icon:'🍽️', name:L.names.groups,    body:L.help.groups },
    { key:'hydration', icon:'💧', name:L.names.hydration,  body:L.help.hydration },
    { key:'plate',     icon:'🍱', name:L.names.plate,      body:L.help.plate },
  ];

  hsBody.innerHTML = MODE_META.map(({icon, name, body}) => `
    <article class="card" style="background:#0f1626;border:1px solid #2a3b5c;border-radius:14px;padding:12px">
      <header style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <div style="font-size:24px;line-height:1">${icon}</div>
        <h4 style="margin:0;color:#eaf2ff">${name}</h4>
      </header>
      <pre style="white-space:pre-wrap;margin:0;color:#cfe3ff;font-family:inherit;line-height:1.4">${body || '-'}</pre>
    </article>
  `).join('');

  // ปิดด้วยคลิกพื้นหลัง (ซ้ำความสามารถเดิม เผื่อยังไม่มี)
  const hs = document.getElementById('helpScene');
  if (hs) {
    hs.addEventListener('click', (e)=>{ if (e.target === hs) hs.style.display='none'; }, { once:true });
  }
}

// ----- Fever UI -----
function setFeverBar(pct){
  const bar = $('#feverBar'); if (!bar) return;
  const clamped = Math.max(0, Math.min(100, pct|0));
  bar.style.width = clamped + '%';
}
function showFeverLabel(show){
  const f = $('#fever'); if (!f) return;
  f.style.display = show ? 'block' : 'none';
  f.classList.toggle('pulse', !!show);
}
function startFever(){
  if (state.fever.active) return;
  state.fever.active = true;
  state.fever.timeLeft = 7;
  showFeverLabel(true);
  try{ $('#sfx-powerup')?.play(); }catch{}
}
function stopFever(){
  state.fever.active = false;
  state.fever.timeLeft = 0;
  showFeverLabel(false);
}

// ----- Score FX (popup & flame) -----
function makeScoreBurst(x, y, text, minor, color){
  const el = document.createElement('div');
  el.className = 'scoreBurst';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  el.style.color = color || '#7fffd4';
  el.style.fontSize = '20px';
  el.textContent = text;
  if (minor) {
    const m = document.createElement('span');
    m.className = 'minor';
    m.textContent = minor;
    el.appendChild(m);
  }
  document.body.appendChild(el);
  setTimeout(()=>{ try{ el.remove(); }catch{} }, 900);
}
function makeFlame(x, y, strong){
  const el = document.createElement('div');
  el.className = 'flameBurst' + (strong ? ' strong' : '');
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  document.body.appendChild(el);
  setTimeout(()=>{ try{ el.remove(); }catch{} }, 900);
}

function scoreWithEffects(base, x, y){
  const comboMul = state.combo >= 20 ? 1.4 : (state.combo >= 10 ? 1.2 : 1.0);
  const feverMul = state.fever.active ? state.fever.mul : 1.0;
  const total = Math.round(base * comboMul * feverMul);

  score.add?.(total);

  const tag   = total >= 0 ? '+' + total : '' + total;
  const minor = (comboMul > 1 || feverMul > 1) ? ('x' + comboMul.toFixed(1) + (feverMul>1 ? ' & FEVER' : '')) : '';
  const color = total >= 0 ? (feverMul>1 ? '#ffd54a' : '#7fffd4') : '#ff9b9b';

  makeScoreBurst(x, y, tag, minor, color);
  if (state.fever.active) makeFlame(x, y, total >= 10);
}

// ----- Combo logic -----
function addCombo(kind){
  if (kind === 'bad'){
    state.combo = 0;
    hud.setCombo?.('x0');
    return;
  }
  if (kind === 'good' || kind === 'perfect'){
    state.combo++;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    hud.setCombo?.('x' + state.combo);

    if (!state.fever.active){
      const gain = (kind === 'perfect') ? state.fever.chargePerfect : state.fever.chargeGood;
      state.fever.meter = Math.min(100, state.fever.meter + gain);
      setFeverBar(state.fever.meter);
      if (state.fever.meter >= state.fever.threshold) startFever();
    } else {
      state.fever.timeLeft = Math.min(10, state.fever.timeLeft + 0.6);
    }
  }
}

// ----- Spawn -----
function spawnOnce(diff){
  if (!state.running || state.paused) return;

  const mode = MODES[state.modeKey];
  const meta = (mode && mode.pickMeta) ? (mode.pickMeta(diff, state) || {}) : {};

  const el = document.createElement('button');
  el.className = 'item';
  el.type = 'button';
  el.textContent = meta.char || '❓';

  const px = ICON_SIZE_MAP[state.difficulty] || 72;
  el.style.fontSize = px + 'px';
  el.style.lineHeight = '1';
  el.style.border = 'none';
  el.style.background = 'transparent';
  el.style.color = '#fff';
  el.style.position = 'fixed';
  el.style.cursor = 'pointer';
  el.style.zIndex = '800';
  el.style.transition = 'transform .15s, filter .15s, opacity .15s';
  el.addEventListener('pointerenter', function(){ el.style.transform = 'scale(1.12)'; }, { passive:true });
  el.addEventListener('pointerleave', function(){ el.style.transform = 'scale(1)'; }, { passive:true });

  // Safe area (avoid header and menu)
  const headerH = ($('header.brand') && $('header.brand').offsetHeight) ? $('header.brand').offsetHeight : 56;
  const menuH   = ($('#menuBar') && $('#menuBar').offsetHeight) ? $('#menuBar').offsetHeight : 120;
  const yMin = headerH + 60;
  const yMax = Math.max(yMin + 50, window.innerHeight - menuH - 80);
  const xMin = 20;
  const xMax = Math.max(xMin + 50, window.innerWidth - 80);

  el.style.left = (xMin + Math.random() * (xMax - xMin)) + 'px';
  el.style.top  = (yMin + Math.random() * (yMax - yMin)) + 'px';

  el.addEventListener('click', function(ev){
    ev.stopPropagation();
    try{
      const sys = { score, sfx, power, coach, fx: eng?.fx };
      // Each mode should return: 'good' | 'ok' | 'bad' | 'perfect' | 'power'
      const res = (mode && mode.onHit) ? (mode.onHit(meta, sys, state, hud) || 'ok') : (meta.good ? 'good' : 'ok');

      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top  + r.height/2;

      if (res === 'good' || res === 'perfect') addCombo(res);
      if (res === 'bad') addCombo('bad');

      const base = ({ good:7, perfect:14, ok:2, bad:-3, power:5 })[res] || 1;
      scoreWithEffects(base, cx, cy);

      if (res === 'good'){ try{ sfx.good(); }catch{} }
      else if (res === 'bad'){ try{ sfx.bad(); }catch{} }
    }catch(e){
      console.error('[HHA] onHit error:', e);
    }finally{
      try{ el.remove(); }catch{}
    }
  }, { passive:true });

  document.body.appendChild(el);
  const ttl = meta.life || diff.life || 3000;
  setTimeout(function(){ try{ el.remove(); }catch{} }, ttl);
}

function spawnLoop(){
  if (!state.running || state.paused) return;
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  // freeze support จาก goodjunk (freezeUntil)
  if (state.freezeUntil && (performance.now() < state.freezeUntil)) {
    state.spawnTimer = setTimeout(spawnLoop, 120); // รอจนกว่าจะพ้น freeze
    return;
  }
  spawnOnce(diff);
  const next = Math.max(220, (diff.spawn || 700) * (power.timeScale || 1));
  state.spawnTimer = setTimeout(spawnLoop, next);
}

// ----- Tick / Start / End -----
function tick(){
  if (!state.running || state.paused) return;

  // Fever drain
  if (state.fever.active){
    state.fever.timeLeft = Math.max(0, state.fever.timeLeft - 1);
    state.fever.meter = Math.max(0, state.fever.meter - state.fever.drainPerSec);
    setFeverBar(state.fever.meter);
    if (state.fever.timeLeft <= 0 || state.fever.meter <= 0) stopFever();
  }

  // Per-mode tick
  try{
    const mode = MODES[state.modeKey];
    if (mode && mode.tick) mode.tick(state, { score, sfx, power, coach, fx: eng?.fx }, hud);
  }catch(e){
    console.warn('[HHA] mode.tick error:', e);
  }

  state.timeLeft = Math.max(0, state.timeLeft - 1);
  updateHUD();

  if (state.timeLeft <= 0){ end(); return; }
  if (state.timeLeft <= 10){
    try{ $('#sfx-tick')?.play()?.catch(()=>{}); }catch{}
    document.body.classList.add('flash');
  }else{
    document.body.classList.remove('flash');
  }

  state.tickTimer = setTimeout(tick, 1000);
}

function start(){
  end(true);
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  state.running   = true;
  state.paused    = false;
  state.timeLeft  = diff.time;
  state.combo     = 0;
  state.bestCombo = 0;
  state.fever.meter = 0;
  setFeverBar(0);
  stopFever();
  state.freezeUntil = 0;
  score.reset?.();
  updateHUD();

  try{
    const mode = MODES[state.modeKey];
    if (mode && mode.init) mode.init(state, hud, diff);
  }catch(e){
    console.error('[HHA] mode.init error:', e);
  }

  coach.onStart?.(state.modeKey);
  tick();
  spawnLoop();
}

function end(silent=false){
  state.running = false;
  state.paused = false;
  clearTimeout(state.tickTimer);
  clearTimeout(state.spawnTimer);
  try{ MODES[state.modeKey]?.cleanup?.(state, hud); }catch{}

  if (!silent){
    const modal = $('#result');
    if (modal) modal.style.display = 'flex';
    coach.onEnd?.(score.score, { grade: 'A' });
  }
}

// ----- Bind all UI with CLICK (สำคัญ) -----
function bindUI() {
  // โหมด
  ['goodjunk','groups','hydration','plate'].forEach(id => {
    const el = document.querySelector(`[data-action="mode"][data-value="${id}"]`);
    el?.addEventListener('click', () => {
      state.modeKey = id;
      applyUI();
      if (state.running) start();
    });
  });

  // ความยาก
  ['Easy','Normal','Hard'].forEach(d => {
    const el = document.querySelector(`[data-action="diff"][data-value="${d}"]`);
    el?.addEventListener('click', () => {
      state.difficulty = d;
      applyUI();
      if (state.running) start();
    });
  });

  // ควบคุมเกม
  $('#btn_start')?.addEventListener('click',  () => start());
  $('#btn_pause')?.addEventListener('click',  () => {
    if (!state.running) { start(); return; }
    state.paused = !state.paused;
    if (!state.paused) { tick(); spawnLoop(); }
    else { clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer); }
  });
  $('#btn_restart')?.addEventListener('click',() => { end(true); start(); });

  // Help Modal
  const help = $('#help'), helpBody = $('#helpBody');
  $('#btn_help')?.addEventListener('click', () => {
    if (helpBody) helpBody.textContent = modeHelpText();
    if (help) help.style.display = 'flex';
  });
  $('#btn_ok')?.addEventListener('click', () => { if (help) help.style.display = 'none'; });
  help?.addEventListener('click', (e)=>{ if (e.target === help) help.style.display='none'; });

  // Help Scene
const hsOpen  = document.querySelector('[data-action="helpScene"]');
const hsClose = document.querySelector('[data-action="helpSceneClose"]');
const hs      = document.getElementById('helpScene');

hsOpen?.addEventListener('click',  () => {
  renderHelpScene();                  // เติมเนื้อหาก่อนแสดง
  if (hs) hs.style.display = 'flex';
});

hsClose?.addEventListener('click', () => { if (hs) hs.style.display = 'none'; });

hs?.addEventListener('click', (e) => { if (e.target === hs) hs.style.display = 'none'; });


  // Result modal buttons (รีเพลย์/โฮม)
  const result = $('#result');
  result?.addEventListener('click', (e)=>{
    const a = e.target.getAttribute?.('data-result');
    if (a === 'replay') { result.style.display='none'; start(); }
    if (a === 'home')   { result.style.display='none'; }
  });

  // Toggle ภาษา/กราฟิก/เสียง
  $('#langToggle')?.addEventListener('click', ()=>{
    state.lang = state.lang === 'TH' ? 'EN' : 'TH';
    localStorage.setItem('hha_lang', state.lang);
    coach.lang = state.lang;
    applyUI();
  });
  $('#gfxToggle')?.addEventListener('click', ()=>{
    state.gfx = state.gfx === 'low' ? 'quality' : 'low';
    localStorage.setItem('hha_gfx', state.gfx);
    try{ eng.renderer.setPixelRatio(state.gfx === 'low' ? 0.75 : (window.devicePixelRatio || 1)); }catch{}
  });
  $('#soundToggle')?.addEventListener('click', ()=>{
    const cur = localStorage.getItem('hha_sound') ?? '1';
    const next = cur === '1' ? '0' : '1';
    localStorage.setItem('hha_sound', next);
  });
}

// ----- Boot -----
bindUI();
applyUI();
updateHUD();

// ปลดล็อกเสียงครั้งแรก
window.addEventListener('pointerdown', ()=>{ try{ sfx.unlock(); }catch{} }, { once:true, passive:true });
