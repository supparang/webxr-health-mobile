// Hero Health Academy - main.js (layout-safe + contextual help + help scene + adaptive icon size)
// Updated: 2025-10-25

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

const MODES = { goodjunk, groups, hydration, plate };
const DIFFS = {
  Easy:   { time: 70, spawn: 900, life: 4200 },
  Normal: { time: 60, spawn: 700, life: 3000 },
  Hard:   { time: 50, spawn: 550, life: 1800 }
};

const $ = (s)=>document.querySelector(s);
const byAction = (el)=>el?.closest?.('[data-action]');

const i18n = {
  TH: {
    mode: 'โหมด', diff: 'ความยาก', score: 'คะแนน', combo: 'คอมโบ', time: 'เวลา',
    helpTitle: 'วิธีเล่น', helpBody: 'เลือกโหมด → เก็บสิ่งที่ถูกต้อง → หลีกเลี่ยงกับดัก',
    replay: 'เล่นอีกครั้ง', home: 'หน้าหลัก',
    names: { goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ' },
    diffs: { Easy:'ง่าย', Normal:'ปกติ', Hard:'ยาก' }
  },
  EN: {
    mode: 'Mode', diff: 'Difficulty', score: 'Score', combo: 'Combo', time: 'Time',
    helpTitle: 'How to Play', helpBody: 'Pick a mode → Collect correct items → Avoid traps',
    replay: 'Replay', home: 'Home',
    names: { goodjunk:'Good vs Trash', groups:'Food Groups', hydration:'Hydration', plate:'Healthy Plate' },
    diffs: { Easy:'Easy', Normal:'Normal', Hard:'Hard' }
  }
};

// ---------- Help Texts ----------
const HELP = {
  TH: {
    titles: {
      goodjunk: 'วิธีเล่น: ดี vs ขยะ',
      groups:   'วิธีเล่น: จาน 5 หมู่',
      hydration:'วิธีเล่น: สมดุลน้ำ',
      plate:    'วิธีเล่น: จัดจานสุขภาพ',
      scene:    'คู่มือรวม'
    },
    bodies: {
      goodjunk: [
        'แตะ/คลิกอาหารที่ดีต่อสุขภาพ (เช่น 🥦 🍎 🥕 🥗)',
        'หลีกเลี่ยงอาหารขยะ (เช่น 🍔 🍟 🍩 🥤)',
        'เก็บถูกต่อเนื่องเพื่อสะสมคอมโบและคะแนน',
        'ความแม่นยิ่งดี ไอเท็มจะหายช้าลง (ปรับตามฝีมือ)'
      ],
      groups: [
        'ดูหมวด “เป้าหมาย” บน HUD แล้วเก็บให้ตรงเพื่อคะแนนสูงสุด',
        'พลาดหมวดจะถูกหักคะแนน',
        'มีภารกิจเวลา 45 วินาที (เก็บให้ครบเพื่อผ่าน)',
        'Power-ups: ✨ Dual (สองเป้า), ✖️2 (คะแนน x2), 🧊 Freeze, 🔄 Rotate'
      ],
      hydration: [
        'คุมแถบ 💧 ให้อยู่ช่วง 45–65%',
        'เก็บ 💧 น้ำเปล่า (+10), 🥛 นม (+8)',
        'เลี่ยง 🥤 น้ำหวาน (-15), ☕ กาแฟ (-10)',
        'ระดับน้ำจะลดลงเล็กน้อยทุกวินาที'
      ],
      plate: [
        'เติมโควตา: ธัญพืช 2 • ผัก 2 • โปรตีน 1 • ผลไม้ 1 • นม 1',
        'ครบทั้งจาน = PERFECT +14 และเริ่มจานใหม่',
        'เกินโควตา จะ -2 คะแนน และ -1 วินาทีเวลา',
        'ดูป้าย “หมวดที่ยังขาด” บน HUD ช่วยนำทาง'
      ]
    },
    sceneCards: [
      { icon:'🥗', title:'ดี vs ขยะ', key:'goodjunk' },
      { icon:'🍽️', title:'จาน 5 หมู่', key:'groups' },
      { icon:'💧', title:'สมดุลน้ำ', key:'hydration' },
      { icon:'🍱', title:'จัดจานสุขภาพ', key:'plate' }
    ]
  },
  EN: {
    titles: {
      goodjunk: 'How to Play: Good vs Trash',
      groups:   'How to Play: Food Groups',
      hydration:'How to Play: Hydration',
      plate:    'How to Play: Healthy Plate',
      scene:    'Guide'
    },
    bodies: {
      goodjunk: [
        'Tap/click healthy foods (e.g., 🥦 🍎 🥕 🥗).',
        'Avoid junk foods (e.g., 🍔 🍟 🍩 🥤).',
        'Chain correct hits to build combo and score.',
        'Better accuracy = items last longer (adaptive).'
      ],
      groups: [
        'Watch the target group(s) on HUD; collect to score high.',
        'Wrong group reduces score.',
        '45s mission: meet the quota to complete.',
        'Power-ups: ✨ Dual, ✖️2 Score x2, 🧊 Freeze, 🔄 Rotate'
      ],
      hydration: [
        'Keep 💧 between 45–65%.',
        'Collect 💧 Water (+10), 🥛 Milk (+8).',
        'Avoid 🥤 Sugary (-15), ☕ Coffee (-10).',
        'Hydration slowly decreases over time.'
      ],
      plate: [
        'Fill quotas: Grain 2 • Veg 2 • Protein 1 • Fruit 1 • Dairy 1.',
        'Complete plate = PERFECT +14 and reset.',
        'Exceeding a quota: -2 pts and -1s.',
        'HUD shows which group is most needed.'
      ]
    },
    sceneCards: [
      { icon:'🥗', title:'Good vs Trash', key:'goodjunk' },
      { icon:'🍽️', title:'Food Groups', key:'groups' },
      { icon:'💧', title:'Hydration', key:'hydration' },
      { icon:'🍱', title:'Healthy Plate', key:'plate' }
    ]
  }
};

function T(lang){ return i18n[lang] || i18n.TH; }
function safeTimeScale(power){ return Number.isFinite(power?.timeScale) && power.timeScale>0 ? power.timeScale : 1; }

const state = {
  modeKey: 'goodjunk',
  difficulty: 'Normal',
  running: false,
  paused: false,
  timeLeft: 60,
  lang: localStorage.getItem('hha_lang') || 'TH',
  gfx: localStorage.getItem('hha_gfx') || 'quality',
  ACTIVE: new Set(),
  ctx: {},
  spawnTimer: null,
  tickTimer: null,
  lastModeKey: null
};

// Core systems
const hud   = new HUD();
const sfx   = new SFX();
const score = new ScoreSystem();
const power = new PowerUpSystem();

let coach;
try { coach = new Coach({ lang: state.lang }); }
catch { coach = { onStart(){}, onEnd(){}, say(){}, lang: state.lang }; }

let eng;
try { eng = new Engine(THREE, document.getElementById('c')); }
catch { eng = {}; }

// ---------- Layout helpers ----------
function relayout(){
  const headerH = document.querySelector('header.brand')?.offsetHeight || 56;
  const menuH   = document.getElementById('menuBar')?.offsetHeight || 120;
  document.documentElement.style.setProperty('--h-header', headerH + 'px');
  document.documentElement.style.setProperty('--h-menu',   menuH   + 'px');
}
window.addEventListener('resize', relayout);

// ---------- UI helpers ----------
function applyLang(){
  const t = T(state.lang);
  $('#t_score')?.replaceChildren(t.score);
  $('#t_combo')?.replaceChildren(t.combo);
  $('#t_time')?.replaceChildren(t.time);
  $('#t_mode')?.replaceChildren(t.mode);
  $('#t_diff')?.replaceChildren(t.diff);
  $('#modeName')?.replaceChildren(t.names[state.modeKey] || state.modeKey);
  $('#difficulty')?.replaceChildren(t.diffs[state.difficulty] || state.difficulty);
  $('#h_help')?.replaceChildren(t.helpTitle);
  $('#helpBody')?.replaceChildren(t.helpBody);
  $('#btn_replay')?.replaceChildren('↻ ' + t.replay);
  $('#btn_home')?.replaceChildren('🏠 ' + t.home);
}

function applyUI(){
  const t = T(state.lang);
  $('#modeName').textContent = (t.names[state.modeKey] || state.modeKey);
  $('#difficulty').textContent = (t.diffs[state.difficulty] || state.difficulty);
}

function hideNonModeHUD(){
  hud.hideHydration?.();
  hud.hideTarget?.();
  hud.hidePills?.();
}

function updateHUD(){
  hud.setScore?.(score.score);
  hud.setCombo?.(score.combo);
  hud.setTime?.(state.timeLeft);
}

function clearTimers(){
  if (state.spawnTimer){ clearTimeout(state.spawnTimer); state.spawnTimer = null; }
  if (state.tickTimer){ clearTimeout(state.tickTimer); state.tickTimer = null; }
}

// ---------- Help rendering ----------
function renderHelpModalFor(modeKey){
  const lang = state.lang;
  const t = HELP[lang] || HELP.TH;
  const title = t.titles[modeKey] || (T(lang).helpTitle);
  const lines = t.bodies[modeKey] || [T(lang).helpBody];

  const h = document.getElementById('h_help');
  const body = document.getElementById('helpBody');
  if (h) h.textContent = title;
  if (body){
    body.innerHTML = lines.map(l=>`• ${l}`).join('\n');
  }
}

function openHelpScene(){
  const lang = state.lang;
  const t = HELP[lang] || HELP.TH;
  const host = document.getElementById('helpScene');
  const title = document.getElementById('hs_title');
  const body = document.getElementById('hs_body');
  if (title) title.textContent = t.titles.scene;

  if (body){
    body.innerHTML = t.sceneCards.map(card=>{
      const lines = (t.bodies[card.key] || []).map(li=>`<li>${li}</li>`).join('');
      return `
        <div class="hs-card">
          <h4><span style="font-size:20px">${card.icon}</span> ${card.title}</h4>
          <ul>${lines}</ul>
        </div>`;
    }).join('');
  }
  if (host) host.style.display = 'flex';
}
function closeHelpScene(){
  const host = document.getElementById('helpScene');
  if (host) host.style.display = 'none';
}

// ---------- Game flow ----------
function pauseGame(){
  if(!state.running || state.paused) return;
  state.paused = true;
  clearTimers();
}

function resumeGame(){
  if(!state.running || !state.paused) return;
  state.paused = false;
  tick();
  spawnLoop();
}

function start(){
  // cleanup โหมดเดิมก่อน (ถ้ามี)
  if (state.lastModeKey){
    try{ MODES[state.lastModeKey]?.cleanup?.(state, hud); }catch{}
  }
  end(true);

  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  state.running = true;
  state.paused = false;
  state.timeLeft = diff.time;
  state.ctx = { hits:0, perfectPlates:0, hyd:50 };

  score.reset?.();
  hideNonModeHUD();

  const mode = MODES[state.modeKey];
  try{ mode?.init?.(state, hud, diff); }catch(e){ console.error('[HHA] init error:', e); }

  if(state.modeKey!=='hydration') hud.hideHydration?.();
  if(state.modeKey!=='groups' && state.modeKey!=='plate') hud.hideTarget?.();
  if(state.modeKey!=='plate') hud.hidePills?.();

  coach.lang = state.lang;
  coach.onStart?.(state.modeKey);

  updateHUD();
  tick();
  spawnLoop();

  // render quality
  try{
    if(eng?.renderer){
      eng.renderer.setPixelRatio(state.gfx==='low' ? 0.75 : (window.devicePixelRatio||1));
    }
  }catch{}
}

function end(silent=false){
  const wasRunning = state.running;
  state.running = false;
  state.paused = false;
  clearTimers();
  hideNonModeHUD();

  // cleanup โหมดปัจจุบัน
  try{ MODES[state.modeKey]?.cleanup?.(state, hud); }catch{}

  if(wasRunning && !silent){
    $('#result')?.style && ( $('#result').style.display = 'flex' );
    coach.onEnd?.(score.score,{ grade:'A', accuracyPct:95 });
  }
}

function spawnOnce(diff){
  if(!state.running || state.paused) return;

  const mode = MODES[state.modeKey];
  if(!mode){ console.warn('[HHA] Unknown mode:', state.modeKey); return; }

  let meta = {};
  try{ meta = mode.pickMeta?.(diff, state) || {}; }catch(e){ console.error('[HHA] pickMeta error:', e); }

  const el = document.createElement('button');
  el.className = 'item';
  el.type = 'button';
  el.textContent = meta.char ?? '❓';

  // 🎨 ปรับขนาดอัตโนมัติตามระดับความยาก
  const sizeMap = { Easy: '80px', Normal: '64px', Hard: '52px' };
  el.style.fontSize = sizeMap[state.difficulty] || '64px';
  el.style.lineHeight = '1';
  el.style.padding = '4px';
  el.style.background = 'none';
  el.style.border = 'none';
  el.style.cursor = 'pointer';
  el.style.transition = 'transform 0.15s ease, filter 0.15s ease';
  el.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))';
  el.onmouseenter = ()=>el.style.transform='scale(1.2)';
  el.onmouseleave = ()=>el.style.transform='scale(1)';
  el.onmousedown  = ()=>el.style.transform='scale(1.3)';
  el.onmouseup    = ()=>el.style.transform='scale(1.2)';

  // ---- จำกัดพื้นที่เกิดไอคอนให้อยู่เหนือเมนูและใต้ header/HUD ----
  const headerH = document.querySelector('header.brand')?.offsetHeight || 56;
  const hudH    = document.querySelector('.hud')?.offsetHeight || 0;
  const menuH   = document.getElementById('menuBar')?.offsetHeight || 120;

  const safeTopMin = headerH + hudH + 12;                             // ขอบบนพื้นที่เล่น
  const safeTopMax = Math.max(safeTopMin + 60, window.innerHeight - menuH - 84); // ขอบล่าง
  const safeLeftMin = 8;
  const safeLeftMax = Math.max(8, window.innerWidth - 88);

  const x = Math.round(safeLeftMin + Math.random() * (safeLeftMax - safeLeftMin));
  const y = Math.round(safeTopMin  + Math.random() * (safeTopMax  - safeTopMin));

  el.style.position = 'fixed';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  el.style.zIndex = '65';

  el.addEventListener('click', (ev)=>{
    ev.stopPropagation();
    try{
      const sys = { score, sfx, power, coach, fx: eng?.fx };
      mode.onHit?.(meta, sys, state, hud);
      state.ctx.hits = (state.ctx.hits||0) + 1;
      el.remove();
    }catch(err){
      console.error('[HHA] onHit error:', err);
      el.remove();
    }
  }, {passive:true});

  document.body.appendChild(el);

  // ใช้ TTL จาก meta.life ถ้ามี
  const ttl = Math.max(600, Number.isFinite(meta.life) ? meta.life : (diff.life || 2500));
  setTimeout(()=>el.remove(), ttl);
}

function spawnLoop(){
  if(!state.running || state.paused) return;
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  spawnOnce(diff);
  const ts = safeTimeScale(power);
  const next = Math.max(220, Math.floor(diff.spawn * ts));
  state.spawnTimer = setTimeout(spawnLoop, next);
}

function tick(){
  if(!state.running || state.paused) return;

  // เรียก tick ของโหมด (เช่น groups ใช้ mission/countdown ภายใน)
  try{
    const sys = { score, sfx, power, coach, fx: eng?.fx };
    MODES[state.modeKey]?.tick?.(state, sys, hud);
  }catch(e){ console.error('[HHA] mode.tick error:', e); }

  state.timeLeft = Math.max(0, state.timeLeft - 1);
  updateHUD();

  if(state.timeLeft<=0){ end(); return; }
  if(state.timeLeft<=10){
    try{ document.getElementById('sfx-tick')?.play()?.catch(()=>{}); }catch{}
  }
  state.tickTimer = setTimeout(tick, 1000);
}

// ---------- Event Binding ----------
document.addEventListener('pointerup', (e)=>{
  const btn = byAction(e.target);
  if(!btn) return;
  const a = btn.getAttribute('data-action');
  const v = btn.getAttribute('data-value');

  if(a==='mode'){
    state.lastModeKey = state.modeKey;
    state.modeKey = v;
    applyUI(); applyLang();
    // ถ้า Help Modal เปิดอยู่ ให้รีเรนเดอร์ตามโหมดใหม่
    if (document.getElementById('help')?.style.display === 'block'){
      renderHelpModalFor(state.modeKey);
    }
    if (state.running){ start(); } // รีสตาร์ทด้วยโหมดใหม่ทันที
  } else if(a==='diff'){
    state.difficulty = v; applyUI();
    if (state.running){ start(); }
  } else if(a==='start'){
    start();
  } else if(a==='pause'){
    if(!state.running){ start(); return; }
    state.paused ? resumeGame() : pauseGame();
  } else if(a==='restart'){
    end(true); start();
  } else if(a==='help'){
    renderHelpModalFor(state.modeKey);
    const help = document.getElementById('help');
    if (help) help.style.display = 'flex'; // ให้ modal จัดกึ่งกลางจอ (ต้องมี CSS .modal เป็น flex)
  } else if(a==='helpClose'){
    const help = document.getElementById('help');
    if (help) help.style.display = 'none';
  } else if(a==='helpScene'){
    openHelpScene();
  } else if(a==='helpSceneClose'){
    closeHelpScene();
  }
}, {passive:true});

document.getElementById('result')?.addEventListener('click',(e)=>{
  const a = e.target.getAttribute('data-result');
  if(a==='replay'){ e.currentTarget.style.display='none'; start(); }
  if(a==='home'){ e.currentTarget.style.display='none'; }
}, {passive:true});

// Toggles
$('#langToggle')?.addEventListener('click', ()=>{
  state.lang = state.lang==='TH' ? 'EN' : 'TH';
  localStorage.setItem('hha_lang', state.lang);
  coach.lang = state.lang;
  applyLang();
  // ถ้า Help เปิดอยู่ ให้ปรับภาษาทันที
  if (document.getElementById('help')?.style.display === 'block'){
    renderHelpModalFor(state.modeKey);
  }
  if (document.getElementById('helpScene')?.style.display === 'flex'){
    openHelpScene(); // re-render ด้วยภาษาปัจจุบัน
  }
}, {passive:true});

$('#gfxToggle')?.addEventListener('click', ()=>{
  state.gfx = state.gfx==='low' ? 'quality' : 'low';
  localStorage.setItem('hha_gfx', state.gfx);
  try{
    if(eng?.renderer){
      eng.renderer.setPixelRatio(state.gfx==='low' ? 0.75 : (window.devicePixelRatio||1));
    }
  }catch{}
}, {passive:true});

// Audio unlock (mobile)
window.addEventListener('pointerdown', ()=>sfx.unlock?.(), {once:true, passive:true});

// Pause on blur / Resume on focus
window.addEventListener('blur',  ()=>pauseGame());
window.addEventListener('focus', ()=>resumeGame());

// ---------- Boot ----------
relayout();
applyLang();
applyUI();
updateHUD();
