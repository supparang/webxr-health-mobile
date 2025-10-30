// === Hero Health Academy — game/main.js (Menu+Start/Diff/Result wired, 2025-10-30) ===
import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';

import { Engine }        from './core/engine.js';
import { HUD }           from './core/hud.js';
import { Coach }         from './core/coach.js';
import { SFX }           from './core/sfx.js';
import { ScoreSystem }   from './core/score.js';
import { PowerUpSystem } from './core/powerup.js';
import { MissionSystem } from './core/mission-system.js';
import { Progress }      from './core/progression.js';
import { Quests }        from './core/quests.js';
import { VRInput }       from './core/vrinput.js';

// Modes
import * as goodjunk   from './modes/goodjunk.js';
import * as groups     from './modes/groups.js';
import * as hydration  from './modes/hydration.js';
import * as plate      from './modes/plate.js';

window.__HHA_BOOT_OK = true;

// ---------- DOM helpers ----------
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));
const setText = (sel, txt)=>{ const el=$(sel); if (el) el.textContent = txt; };

// ---------- Core singletons ----------
const score   = new ScoreSystem();
const power   = new PowerUpSystem();
const hud     = new HUD();
const coach   = new Coach();
const sfx     = new SFX();
const mission = new MissionSystem();
power.attachToScore(score);

const engine = new Engine({
  hud, coach, sfx, score, power, mission, THREE,
  fx:{ popText:(text,{x=0,y=0,ms=700}={})=>{
    const n=document.createElement('div'); n.className='poptext';
    n.style.left=x+'px'; n.style.top=y+'px'; n.textContent=text;
    document.body.appendChild(n); setTimeout(()=>n.remove(), ms|0);
  }}
});

const MODES = { goodjunk, groups, hydration, plate };
let current = null;

// ---------- Global UI sections ----------
const elMenu   = $('#menuBar');
const elLayer  = $('#gameLayer');
const elHUD    = $('#hudWrap');
const elResult = $('#result');
const elModeNm = $('#modeName');
const elDiffTx = $('#difficulty');

function showMenu(){
  elMenu && (elMenu.style.display = 'block');
  elHUD  && (elHUD.style.display  = 'none');
  elResult && (elResult.style.display = 'none');
  if (elLayer) elLayer.style.pointerEvents = 'none';
  if (elMenu)  elMenu.style.pointerEvents  = 'auto';
}

function showPlay(){
  elMenu && (elMenu.style.display = 'none');
  elHUD  && (elHUD.style.display  = 'block');
  elResult && (elResult.style.display = 'none');
  if (elLayer) elLayer.style.pointerEvents = 'auto';
}

function showResult(){
  elHUD && (elHUD.style.display = 'none');
  elMenu && (elMenu.style.display = 'none');
  if (elResult){
    elResult.style.display = 'flex';
    // ให้ปุ่มใน result คลิกได้แน่ ๆ
    elResult.style.pointerEvents = 'auto';
    elResult.querySelectorAll('button').forEach(b=>b.style.pointerEvents='auto');
  }
  if (elLayer) elLayer.style.pointerEvents = 'none';
}

// ---------- Mode load / lifecycle ----------
function loadMode(key){
  const m = MODES[key] || MODES.goodjunk;
  try { current?.cleanup?.(); } catch {}
  current = m.create({ engine, hud, coach });
}
function startGame(){
  score.reset();
  engine.start();
  current?.start?.();
  coach?.onStart?.();
}
function stopGame(){
  try { current?.stop?.(); } catch {}
  try { engine.stop(); } catch {}
  coach?.onEnd?.();
  showResult();
}

// ---------- VR/Gaze ----------
Progress.init?.();
VRInput.init?.({ engine, sfx, THREE });
window.HHA_VR = {
  toggle: ()=>VRInput.toggleVR(),
  pause: ()=>VRInput.pause(),
  resume: ()=>VRInput.resume(),
  setDwell:(ms)=>VRInput.setDwellMs(ms),
  setCooldown:(ms)=>VRInput.setCooldown(ms),
  style:(o)=>VRInput.setReticleStyle(o),
};

// ---------- Menu selections (mode/diff/sound) ----------
let selectedMode = 'goodjunk';
let selectedDiff = 'Normal';

function setActiveIn(groupSel, el){
  document.querySelectorAll(groupSel).forEach(n=>n.classList.remove('active'));
  el?.classList?.add('active');
}

function selectMode(key, el){
  selectedMode = key || 'goodjunk';
  document.body.setAttribute('data-mode', selectedMode);
  if (elModeNm){
    elModeNm.textContent =
      selectedMode==='goodjunk'  ? 'Good vs Junk' :
      selectedMode==='groups'    ? '5 Food Groups' :
      selectedMode==='hydration' ? 'Hydration' :
      selectedMode==='plate'     ? 'Healthy Plate' : selectedMode;
  }
  setActiveIn('#menuBar .tile', el);
}

function selectDiff(diff, el){
  selectedDiff = diff || 'Normal';
  window.__HHA_DIFF = selectedDiff;               // ให้โหมดอ่าน
  document.body.setAttribute('data-diff', selectedDiff);
  if (elDiffTx) elDiffTx.textContent = selectedDiff;
  setActiveIn('#menuBar .chip', el);
}

// tiles: mode
const TILE_MAP = {
  m_goodjunk:'goodjunk', m_groups:'groups',
  m_hydration:'hydration', m_plate:'plate'
};
Object.keys(TILE_MAP).forEach(id=>{
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', ()=>selectMode(TILE_MAP[id], el));
});

// diff chips
const dEasy   = $('#d_easy');
const dNormal = $('#d_normal');
const dHard   = $('#d_hard');
dEasy  ?.addEventListener('click', ()=>selectDiff('Easy',   dEasy));
dNormal?.addEventListener('click', ()=>selectDiff('Normal', dNormal));
dHard  ?.addEventListener('click', ()=>selectDiff('Hard',   dHard));

// sound toggle
const soundBtn = $('#soundToggle');
if (soundBtn){
  let muted = false;
  soundBtn.addEventListener('click', ()=>{
    muted = !muted;
    document.querySelectorAll('audio').forEach(a=>{ try{ a.muted = muted; }catch{} });
    soundBtn.textContent = muted ? '🔈' : '🔊';
  });
}

// defaults on boot
selectMode('goodjunk', $('#m_goodjunk'));
selectDiff('Normal', dNormal);

// ---------- Start / Home / Replay ----------
const btnStart  = $('#btn_start');
const btnHome   = document.querySelector('[data-result="home"]');
const btnReplay = document.querySelector('[data-result="replay"]');

function runSelected(){
  // ปิดเมนู เปิดสนาม + โหลดโหมดตามเลือก + เริ่ม
  showPlay();
  try { loadMode(selectedMode); } catch {}
  startGame();
}
btnStart ?.addEventListener('click', runSelected);
btnReplay?.addEventListener('click', runSelected);
btnHome  ?.addEventListener('click', ()=>{
  stopGame();
  showMenu();
});

// ให้โหมด/ระบบอื่นเรียกได้
window.HHA = window.HHA || {};
window.HHA.startSelectedMode = runSelected;
window.HHA.stop = stopGame;
window.HHA.replay = runSelected;

// ---------- Pause on blur/hidden ----------
window.addEventListener('blur',  ()=>{ try{ engine.pause(); VRInput.pause(true);}catch{} }, {passive:true});
window.addEventListener('focus', ()=>{ try{ engine.resume();VRInput.resume(true);}catch{} }, {passive:true});
document.addEventListener('visibilitychange', ()=>{
  if (document.hidden){ try{ engine.pause(); VRInput.pause(true);}catch{} }
  else { try{ engine.resume(); VRInput.resume(true);}catch{} }
}, {passive:true});

// ---------- Boot ----------
(function boot(){
  try{
    hud.init?.(); coach.init?.({ hud, sfx }); engine.init?.();
    // โหลดโหมดเริ่มต้น (ไม่เริ่มเล่นจนกด Start)
    loadMode(selectedMode);
    // ค่า dwell text ถ้ามี
    const v=parseInt(localStorage.getItem('hha_dwell_ms')||'850',10);
    setText('#dwellVal', `${Number.isFinite(v)?v:850}ms`);
    // เปิดเมนูก่อนเสมอ
    showMenu();
  }catch(e){
    console.error('[HHA] boot fail', e);
    const pre=document.createElement('pre'); pre.style.color='#f55';
    pre.textContent='Boot error:\n'+(e?.stack||e?.message||String(e));
    document.body.appendChild(pre);
  }
})();
