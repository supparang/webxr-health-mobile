// === Hero Health Academy — game/main.js (Click-fixed • PC/Mobile/VR) ===
window.__HHA_BOOT_OK = true;

// ----- Imports -----
import { Quests }   from '/webxr-health-mobile/HeroHealth/game/core/quests.js';
import { Progress } from '/webxr-health-mobile/HeroHealth/game/core/progression.js';
import * as goodjunk  from '/webxr-health-mobile/HeroHealth/game/modes/goodjunk.js';
import * as groups    from '/webxr-health-mobile/HeroHealth/game/modes/groups.js';
import * as hydration from '/webxr-health-mobile/HeroHealth/game/modes/hydration.js';
import * as plate     from '/webxr-health-mobile/HeroHealth/game/modes/plate.js';

// ----- Helpers -----
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));
const clamp  = (n,a,b)=>Math.max(a, Math.min(b,n));
const rndInt = (a,b)=> (a + Math.floor(Math.random()*(b-a+1)));
function setText(sel, txt){ const el=$(sel); if(el) el.textContent = txt; }

const MODES = { goodjunk, groups, hydration, plate };

// ----- State -----
const STATE = {
  lang: (localStorage.getItem('hha_lang')||'TH').toUpperCase(),
  mode: 'goodjunk',
  difficulty: 'Normal',
  running: false,
  timeSec: 45,
  timerId: null,
  score: 0,
  combo: 0,
  bestCombo: 0,
  freezeUntil: 0,
  ctx: {}
};

// ----- SFX stub (เสียบของจริงภายหลังได้) -----
const SFX = {
  play(name){
    // ตัวอย่าง: document.getElementById(`sfx-${id}`)?.play();
    try{
      const el = document.getElementById(name);
      if (el && typeof el.play==='function') el.currentTime = 0, el.play();
    }catch{}
  }
};

// ====== LAYER & CLICKABILITY FIXES ======
function ensurePlayLayer(){
  // container หลัก
  let wrap = document.querySelector('.game-wrap');
  if (!wrap){
    wrap = document.createElement('main');
    wrap.className = 'game-wrap';
    document.body.appendChild(wrap);
  }
  // ชั้นเล่น
  let layer = document.getElementById('gameLayer');
  if (!layer){
    layer = document.createElement('div');
    layer.id = 'gameLayer';
    layer.setAttribute('tabindex','0');
    layer.style.position = 'relative';
    layer.style.width = '100%';
    layer.style.height = 'calc(100vh - 180px)';
    layer.style.margin = '0 auto';
    layer.style.maxWidth = '960px';
    layer.style.overflow = 'hidden';
    wrap.appendChild(layer);
  }
  // host สปาวน์
  let host = document.getElementById('spawnHost');
  if (!host){
    host = document.createElement('div');
    host.id = 'spawnHost';
    host.style.position = 'absolute';
    host.style.left = '0';
    host.style.top  = '0';
    host.style.width = '100%';
    host.style.height= '100%';
    layer.appendChild(host);
  }
}
function applyClickabilityFixes(){
  const canv = document.getElementById('c');
  if (canv){
    canv.style.pointerEvents = 'none';
    canv.style.zIndex = '0';
  }
  const hud = document.querySelector('.hud');
  if (hud){
    hud.style.pointerEvents = 'none';
    hud.style.zIndex = '20';
  }
  const menu = document.getElementById('menuBar');
  if (menu){
    menu.style.pointerEvents = 'auto';
    menu.style.zIndex = '30';
    const btns = menu.querySelectorAll('.btn,.tag');
    for (const b of btns) b.style.pointerEvents = 'auto';
  }
  const layer = document.getElementById('gameLayer');
  if (layer){
    layer.style.pointerEvents = 'auto';
    layer.style.zIndex = '28';
  }
  const host  = document.getElementById('spawnHost');
  if (host){
    host.style.pointerEvents = 'none'; // host ไม่รับคลิก
    host.style.zIndex = '28';
  }
  // เผื่อมีเป้าอยู่ก่อน
  const spawns = document.querySelectorAll('.spawn-emoji');
  for (const el of spawns){
    el.style.pointerEvents = 'auto';
    el.style.zIndex = '29';
  }
}
ensurePlayLayer();
applyClickabilityFixes();

// ====== HUD ======
const HUD = (()=>{
  function setClock(sec){
    setText('#time', String(sec|0));
  }
  function setScore(n){ setText('#score', String(n|0)); }
  function setCombo(x){ setText('#combo', 'x'+String(x|0)); }
  function setQuestChips(list){
    const host = $('#questChips'); if(!host) return;
    host.innerHTML = (list||[]).map(q=>{
      const prog = q.need>0 ? (clamp((q.progress/q.need)*100, 0, 100)|0) : 0;
      return `<span class="chip" title="${q.label||q.key}">
        <b>${q.icon||'⭐'} ${q.progress}/${q.need}</b>
        <i style="display:block;height:4px;background:${q.done?'#66bb6a':'#29b6f6'};width:${prog}%;border-radius:4px"></i>
      </span>`;
    }).join('');
  }
  function setTarget(key, have, need){
    const badge = $('#targetBadge'); if(!badge) return;
    const nameTH = ({veggies:'ผัก', protein:'โปรตีน', grains:'ธัญพืช', fruit:'ผลไม้', dairy:'นม'})[key] || key || '—';
    badge.textContent = `${nameTH} • ${have|0}/${need|0}`;
  }
  function coachSay(text, ms=1500){
    const el = $('#coachText'); const box = $('#coachHUD');
    if (el) el.textContent = text;
    if (box){
      box.style.pointerEvents = 'none';
      box.style.display='flex';
      clearTimeout(box._t);
      box._t = setTimeout(()=>{ box.style.display='none'; }, ms);
    }
  }
  return { setClock, setScore, setCombo, setQuestChips, setTarget, coachSay };
})();
Quests.bindToMain({ hud: { setQuestChips: HUD.setQuestChips }});

// ====== UI EVENTS ======
document.addEventListener('click', (ev)=>{
  const btn = ev.target && ev.target.closest && ev.target.closest('[data-action]');
  if(!btn) return;
  const act = btn.getAttribute('data-action') || '';

  // โหมดจากแถวแรก (รูปแบบ ui:start:XXXX)
  if (act.indexOf('ui:start:')===0){
    const m = act.split(':')[2] || 'goodjunk';
    if (MODES[m]){
      STATE.mode = m;
      setText('#modeName', btn.textContent.trim());
      HUD.coachSay('Mode: ' + btn.textContent.trim(), 900);
    }
    ev.stopPropagation();
    return;
  }

  switch(act){
    case 'diff': {
      const d = btn.getAttribute('data-value')||'Normal';
      STATE.difficulty = d;
      // ไฮไลต์
      const all = $$('#menuBar [data-action="diff"]');
      for (const x of all) x.classList.toggle('active', x===btn);
      setText('#difficulty', ({Easy:'ง่าย',Normal:'ปกติ',Hard:'ยาก'})[d]||d);
      HUD.coachSay(`Difficulty: ${d}`, 900);
      break;
    }
    case 'start': {
      startRun();
      break;
    }
    case 'pause': {
      if (STATE.running){
        STATE.running = false;
        HUD.coachSay('Pause', 800);
      } else {
        STATE.running = true;
        HUD.coachSay('Resume', 800);
      }
      break;
    }
    case 'restart': {
      hideResult(); startRun();
      break;
    }
    case 'help': {
      const m = $('#help'); if (m) m.style.display = 'block';
      break;
    }
    case 'helpClose': {
      const m = $('#help'); if (m) m.style.display = 'none';
      break;
    }
    case 'helpScene': {
      const m = $('#helpScene'); if (m) m.style.display = 'block';
      break;
    }
    case 'helpSceneClose': {
      const m = $('#helpScene'); if (m) m.style.display = 'none';
      break;
    }
    case 'statOpen': {
      const m = $('#statBoard'); if (m) m.style.display = 'block';
      break;
    }
    case 'statClose': {
      const m = $('#statBoard'); if (m) m.style.display = 'none';
      break;
    }
    case 'dailyOpen': {
      const m = $('#dailyPanel'); if (m) m.style.display = 'block';
      break;
    }
    case 'dailyClose': {
      const m = $('#dailyPanel'); if (m) m.style.display = 'none';
      break;
    }
    default: break;
  }
});

// ====== RUN LOOP ======
let _spawnTimer = null;

function startRun(){
  // UI state
  const menu = $('#menuBar'); if (menu) menu.style.display='none';
  const res  = $('#result');  if (res)  res.style.display='none';

  // Reset state
  STATE.running = true;
  STATE.timeSec = 45;
  STATE.score   = 0;
  STATE.combo   = 0;
  STATE.bestCombo = 0;
  STATE.ctx = {};

  HUD.setClock(STATE.timeSec);
  HUD.setScore(STATE.score);
  HUD.setCombo(STATE.combo);
  HUD.setQuestChips([]);

  // Init mode
  const mode = MODES[STATE.mode] || MODES.goodjunk;
  try { mode.init(STATE, { setTarget: HUD.setTarget }, diffOf(STATE.difficulty)); } catch(e){ console.error(e); }

  // Quests
  Quests.beginRun(STATE.mode, STATE.difficulty, STATE.lang, STATE.timeSec);

  // Coach
  HUD.coachSay(STATE.lang==='TH'?'เริ่มกันเลย!':'Let’s go!', 1200);

  // Timer
  if (STATE.timerId) clearInterval(STATE.timerId);
  STATE.timerId = setInterval(onTick, 1000);

  // Spawner
  if (_spawnTimer) clearInterval(_spawnTimer);
  _spawnTimer = setInterval(spawnOne, 700);

  // Clickability
  applyClickabilityFixes();
  const gl = $('#gameLayer'); if (gl && typeof gl.focus==='function') gl.focus();
}

function onTick(){
  if (!STATE.running) return;

  // Freeze window (power-up)
  const now = Date.now();
  if (STATE.freezeUntil && now < STATE.freezeUntil){
    HUD.setClock(STATE.timeSec);
    Quests.tick({ score: STATE.score|0 });
    return;
  }

  STATE.timeSec = Math.max(0, STATE.timeSec-1);
  HUD.setClock(STATE.timeSec);
  Quests.tick({ score: STATE.score|0 });

  // mode tick
  const m = MODES[STATE.mode];
  try { if (m && typeof m.tick==='function') m.tick(STATE, { sfx:SFX }, { setTarget: HUD.setTarget }); } catch(e){}

  if (STATE.timeSec<=0) endRun(true);
}

function endRun(showResult){
  STATE.running = false;
  if (STATE.timerId){ clearInterval(STATE.timerId); STATE.timerId=null; }
  if (_spawnTimer){  clearInterval(_spawnTimer);  _spawnTimer=null; }

  // cleanup
  const m = MODES[STATE.mode];
  try { if (m && typeof m.cleanup==='function') m.cleanup(STATE, { setTarget: HUD.setTarget }); } catch(e){}

  const summary = {
    score: STATE.score|0,
    bestCombo: STATE.bestCombo|0,
    time: 45,
    mode: STATE.mode,
    difficulty: STATE.difficulty
  };
  const quests = Quests.endRun(summary);

  if (showResult){
    const core = $('#resCore');
    const bd   = $('#resBreakdown');
    const qm   = $('#resMissions');

    if (core){
      core.innerHTML = `
        <div>Score: <b>${summary.score}</b></div>
        <div>Best Combo: <b>${summary.bestCombo}</b></div>
        <div>Mode: <b>${summary.mode}</b> • Diff: <b>${summary.difficulty}</b></div>
      `;
    }
    if (bd){
      bd.innerHTML = `<table class="tbl"><tbody>
        <tr><th>Time</th><td>${summary.time}s</td></tr>
      </tbody></table>`;
    }
    if (qm){
      qm.innerHTML = `<div style="margin-top:6px"><b>Quests</b></div>
        <ul style="margin:.25rem 0 0 1rem">
        ${quests.map(q=>`<li>${q.label||q.id} — ${q.done?'✅ Completed':'❌'}</li>`).join('')}
        </ul>`;
    }
    const res = $('#result'); if (res) res.style.display='block';
  }

  try { if (Progress && typeof Progress.save==='function') Progress.save(summary); } catch {}
}

function hideResult(){ const res=$('#result'); if(res) res.style.display='none'; }

// ====== Difficulty ======
function diffOf(key){
  if (key==='Easy') return { life: 3500 };
  if (key==='Hard') return { life: 2300 };
  return { life: 3000 };
}

// ====== Spawner ======
function spawnOne(){
  if (!STATE.running) return;
  const now = Date.now();
  if (STATE.freezeUntil && now < STATE.freezeUntil) return;

  const host = $('#spawnHost');
  const layer= $('#gameLayer');
  if (!host || !layer) return;

  // meta จากโหมด
  const mode = MODES[STATE.mode] || MODES.goodjunk;
  let meta = {};
  try { meta = mode.pickMeta(diffOf(STATE.difficulty), STATE) || {}; } catch(e){ meta = {}; }

  // สร้างปุ่มเป้า
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'spawn-emoji';
  el.setAttribute('aria-label', meta.aria || meta.label || 'item');
  el.textContent = meta.char || '🍏';

  // ตำแหน่งแบบปลอด HUD
  const pad = 18;
  const box = layer.getBoundingClientRect();
  const x = rndInt(pad, Math.max(pad, box.width  - pad*2));
  const y = rndInt(pad+24, Math.max(pad+24, box.height - pad*2 - 24));
  el.style.position = 'absolute';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  el.style.fontSize = 'clamp(24px, 5.5vmin, 42px)';
  el.style.lineHeight= '1';
  el.style.border = 'none';
  el.style.background = 'transparent';
  el.style.cursor = 'pointer';
  el.style.userSelect = 'none';
  el.style.webkitTapHighlightColor = 'transparent';
  el.style.pointerEvents = 'auto';
  el.style.zIndex = '29';

  // อายุ
  const life = clamp(Number(meta.life)>0?Number(meta.life):3000, 600, 5000);
  const tdie = setTimeout(()=>{ try{ el.remove(); }catch{} }, life);

  // FX on spawn
  try {
    if (mode.fx && typeof mode.fx.onSpawn==='function') mode.fx.onSpawn(el, STATE);
  } catch {}

  // คลิกให้ชัวร์ (pointerdown + click)
  const onHit = (ev)=>{ ev.stopPropagation(); clearTimeout(tdie); handleHit(meta, el); };
  el.addEventListener('pointerdown', onHit, { passive:true });
  el.addEventListener('click', onHit, { passive:true });
  el.addEventListener('dragstart', (ev)=>ev.preventDefault());

  host.appendChild(el);
  applyClickabilityFixes(); // กันโดน style อื่นทับ
}

// ====== Hit handling ======
function handleHit(meta, el){
  // โหมดตัดสินผล
  let result = 'ok';
  try{
    const m = MODES[STATE.mode];
    if (m && typeof m.onHit==='function'){
      result = m.onHit(meta, { score:{ add: addScore }, sfx:SFX }, STATE, { setTarget: HUD.setTarget }) || 'ok';
    }
  }catch{}

  // FX on hit
  try{
    const m = MODES[STATE.mode];
    if (m && m.fx && typeof m.fx.onHit==='function'){
      const off = el.getBoundingClientRect();
      m.fx.onHit(off.left + off.width/2, off.top + off.height/2, meta, STATE);
    }
  }catch{}

  // คอมโบ/คะแนน
  if (result==='good' || result==='perfect'){
    STATE.combo = Math.min(999, STATE.combo+1);
    if (STATE.combo > STATE.bestCombo) STATE.bestCombo = STATE.combo;
    const base = (result==='perfect'? 20 : 10);
    const bonus = Math.floor(STATE.combo/10);
    addScore(base + bonus);
  } else if (result==='bad') {
    STATE.combo = 0;
  }
  HUD.setCombo(STATE.combo);

  // Quests
  try{
    Quests.event('hit', { result:result, meta:meta, comboNow: STATE.combo, _ctx:{ score: STATE.score|0 } });
  }catch{}

  // ลบชิ้น
  try{ el.remove(); }catch{}
}

function addScore(n){
  STATE.score = Math.max(0, (STATE.score|0) + (n|0));
  HUD.setScore(STATE.score);
}

// ====== Menu default label ======
(function initLabels(){
  setText('#modeName', ($('#m_goodjunk') ? $('#m_goodjunk').textContent.trim() : 'ดี vs ขยะ'));
  setText('#difficulty', 'ปกติ');
})();

// ====== Accessibility & Resume Menu ======
function backToMenu(){
  const res = $('#result');  if (res)  res.style.display='none';
  const menu= $('#menuBar'); if (menu) menu.style.display='';
}

// ====== Expose for debug ======
window.HHA = { STATE, startRun, endRun, backToMenu };
