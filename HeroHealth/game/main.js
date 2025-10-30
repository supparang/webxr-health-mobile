// === Hero Health Academy — game/main.js (2025-10-30R2)
// Menu wired + Real play loop (RAF), timer, Bus(hit/miss), result Home/Replay
// Works even if Engine has no internal loop.
// ------------------------------------------------------

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

// Modes (DOM-spawn factory pattern)
import * as goodjunk   from './modes/goodjunk.js';
import * as groups     from './modes/groups.js';
import * as hydration  from './modes/hydration.js';
import * as plate      from './modes/plate.js';

window.__HHA_BOOT_OK = true;

// ---------- DOM helpers ----------
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));
const setText = (sel, txt)=>{ const el=$(sel); if (el) el.textContent = txt; };

// ---------- Singletons ----------
const score   = new ScoreSystem();
const power   = new PowerUpSystem();
const coach   = new Coach();
const hud     = new HUD();
const sfx     = new SFX();
const mission = new MissionSystem();
power.attachToScore(score);

const engine = new Engine({
  hud, coach, sfx, score, power, mission, THREE,
  fx:{ popText:(text,{x=0,y=0,ms=650}={})=>{
    const n=document.createElement('div'); n.className='poptext';
    n.textContent=text; n.style.left=x+'px'; n.style.top=y+'px';
    document.body.appendChild(n); setTimeout(()=>n.remove(), ms|0);
  }}
});

// ---------- Sections ----------
const elMenu   = $('#menuBar');
const elLayer  = $('#gameLayer');
const elHUD    = $('#hudWrap');
const elResult = $('#result');
const elModeNm = $('#modeName');
const elDiffTx = $('#difficulty');
const elScore  = $('#score');
const elTime   = $('#time');
const elCombo  = $('#combo');
const elResultText = $('#resultText');
const elPbRow  = $('#pbRow');

function showMenu(){
  if (elMenu)   elMenu.style.display   = 'block';
  if (elHUD)    elHUD.style.display    = 'none';
  if (elResult) elResult.style.display = 'none';
  if (elLayer)  elLayer.style.pointerEvents = 'none';
  if (elMenu)   elMenu.style.pointerEvents  = 'auto';
}
function showPlay(){
  if (elMenu)   elMenu.style.display   = 'none';
  if (elHUD)    elHUD.style.display    = 'block';
  if (elResult) elResult.style.display = 'none';
  if (elLayer)  elLayer.style.pointerEvents = 'auto';
}
function showResult(){
  if (elMenu)   elMenu.style.display   = 'none';
  if (elHUD)    elHUD.style.display    = 'none';
  if (elResult){ elResult.style.display = 'flex'; elResult.style.pointerEvents='auto'; }
  if (elLayer)  elLayer.style.pointerEvents = 'none';
}

// ---------- Modes ----------
const MODES = { goodjunk, groups, hydration, plate };
let current = null;

function loadMode(key){
  const m = MODES[key] || MODES.goodjunk;
  try { current?.cleanup?.(); } catch {}
  current = m.create({ engine, hud, coach });
}

// ---------- Selections ----------
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
  window.__HHA_DIFF = selectedDiff;
  document.body.setAttribute('data-diff', selectedDiff);
  if (elDiffTx) elDiffTx.textContent = selectedDiff;
  setActiveIn('#menuBar .chip', el);
}

// Tiles
const TILE_MAP = {
  m_goodjunk:'goodjunk', m_groups:'groups',
  m_hydration:'hydration', m_plate:'plate'
};
Object.keys(TILE_MAP).forEach(id=>{
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', ()=>selectMode(TILE_MAP[id], el));
});
// Diffs
$('#d_easy')  ?.addEventListener('click', ()=>selectDiff('Easy',   $('#d_easy')));
$('#d_normal')?.addEventListener('click', ()=>selectDiff('Normal', $('#d_normal')));
$('#d_hard')  ?.addEventListener('click', ()=>selectDiff('Hard',   $('#d_hard')));

// Sound
const soundBtn = $('#soundToggle');
if (soundBtn){
  let muted=false;
  soundBtn.addEventListener('click', ()=>{
    muted=!muted; document.querySelectorAll('audio').forEach(a=>a.muted=muted);
    soundBtn.textContent = muted?'🔈':'🔊';
  });
}

// Defaults
selectMode('goodjunk', $('#m_goodjunk'));
selectDiff('Normal', $('#d_normal'));

// ---------- Play loop (independent RAF) ----------
let _raf = 0, _last = 0, _running = false, _secs = 45;

// seconds by difficulty (can tweak)
const LEN = { Easy:60, Normal:45, Hard:40 };

function starsOf(scoreVal){
  // same as ScoreSystem gradeBreaks default
  const br=[120,240,360,480,600];
  return (scoreVal>=br[4])?5:(scoreVal>=br[3])?4:(scoreVal>=br[2])?3:(scoreVal>=br[1])?2:(scoreVal>=br[0])?1:0;
}
function updateHUD(){
  setText('#score', String(score.get()));
  setText('#combo', 'x'+(score.combo|0));
  setText('#time',  String(Math.max(0,_secs|0)));
}

// Bus for modes (what groups.js/plate.js expects)
const Bus = {
  hit: ({kind='good', points=0, meta={}, ui={}}={})=>{
    // Prefer score.addKind so combo/fever hooks apply
    score.addKind(kind, meta);
    updateHUD();
    // quests hooks
    try { window.HHA_QUESTS?.event?.('hit', { result:kind, comboNow:score.combo|0, meta }); } catch {}
    // mission counters
    try {
      const ms = engine?.mission;
      if (kind==='perfect') ms?.onEvent?.('perfect', {}, engine?.state||{});
      if (meta?.golden)     ms?.onEvent?.('golden',  {}, engine?.state||{});
      if (meta?.isTarget)   ms?.onEvent?.('target_hit', {}, engine?.state||{});
    } catch {}
  },
  miss: ({meta={}}={})=>{
    score.addPenalty(8, { kind:'bad', ...meta });
    updateHUD();
    try { window.HHA_QUESTS?.event?.('hit', { result:'bad', meta }); } catch {}
    try { engine?.mission?.onEvent?.('miss', {}, engine?.state||{}); } catch {}
  }
};

function loop(ts){
  if (!_running) return;
  if (!_last) _last = ts;
  const dt = Math.min(0.1, (ts - _last) / 1000); // seconds cap
  _last = ts;

  _secs -= dt;
  current?.update?.(dt, Bus);
  updateHUD();

  if (_secs <= 0){
    endRun();
    return;
  }
  _raf = requestAnimationFrame(loop);
}

function beginRun(){
  // prepare HUD counters
  score.reset();
  _secs = LEN[selectedDiff] ?? 45;
  updateHUD();

  // engine hooks (safe if no-ops)
  try { engine.start(); } catch {}
  try { coach.onStart?.(); } catch {}
  try { current?.start?.(); } catch {}

  _running = true;
  _last = 0;
  cancelAnimationFrame(_raf);
  _raf = requestAnimationFrame(loop);
}

function endRun(){
  _running = false;
  cancelAnimationFrame(_raf);
  try { current?.stop?.(); } catch {}
  try { engine.stop(); } catch {}
  try { coach.onEnd?.(); } catch {}

  // Result UI
  const g = score.getGrade();
  if (elResultText) elResultText.textContent = `Score ${g.score} • Grade ${g.grade}`;
  if (elPbRow){
    const s = starsOf(g.score);
    elPbRow.innerHTML = '';
    for (let i=0;i<5;i++){
      const li=document.createElement('li');
      li.textContent = i<s ? '★' : '☆';
      elPbRow.appendChild(li);
    }
  }
  showResult();
}

// ---------- Buttons: Start / Home / Replay ----------
const btnStart  = $('#btn_start');
const btnHome   = document.querySelector('[data-result="home"]');
const btnReplay = document.querySelector('[data-result="replay"]');

function runSelected(){
  showPlay();
  loadMode(selectedMode);
  beginRun();
}
btnStart ?.addEventListener('click', runSelected);
btnReplay?.addEventListener('click', runSelected);
btnHome  ?.addEventListener('click', ()=>{
  // go back to menu
  try { current?.stop?.(); } catch {}
  try { engine.stop(); } catch {}
  showMenu();
});

// Export minimal hooks
window.HHA = window.HHA || {};
window.HHA.startSelectedMode = runSelected;
window.HHA.stop   = endRun;
window.HHA.replay = runSelected;

// ---------- VR/Gaze ----------
Progress.init?.();
VRInput.init?.({ engine, sfx, THREE });
window.HHA_VR = {
  toggle: ()=>VRInput.toggleVR(),
  pause:  ()=>VRInput.pause(),
  resume: ()=>VRInput.resume(),
  setDwell: (ms)=>VRInput.setDwellMs(ms),
  setCooldown: (ms)=>VRInput.setCooldown(ms),
  style: (o)=>VRInput.setReticleStyle(o),
};

// Pause/resume on tab state
window.addEventListener('blur',  ()=>{ if(_running){ try{ VRInput.pause(true);}catch{} } }, {passive:true});
window.addEventListener('focus', ()=>{ if(_running){ try{ VRInput.resume(true);}catch{} } }, {passive:true});
document.addEventListener('visibilitychange', ()=>{
  if (document.hidden){ if(_running){ try{ VRInput.pause(true);}catch{} } }
  else { if(_running){ try{ VRInput.resume(true);}catch{} } }
}, {passive:true});

// ---------- Boot ----------
(function boot(){
  try{
    hud.init?.(); coach.init?.({ hud, sfx }); engine.init?.();
    loadMode(selectedMode);
    const v=parseInt(localStorage.getItem('hha_dwell_ms')||'850',10);
    setText('#dwellVal', `${Number.isFinite(v)?v:850}ms`);
    showMenu();
  }catch(e){
    console.error('[HHA] Boot fail', e);
    const pre=document.createElement('pre'); pre.style.color='#f55';
    pre.textContent='Boot error:\n'+(e?.stack||e?.message||String(e));
    document.body.appendChild(pre);
  }
})();
// --- Hard-guard: make sure menu is always clickable & canvas never eats clicks
(function ensureClickable(){
  const c = document.getElementById('c');
  if (c){ c.style.pointerEvents='none'; c.style.zIndex='0'; }
  const layer = document.getElementById('gameLayer');
  if (layer){ layer.style.zIndex = '10'; }
  const menu = document.getElementById('menuBar');
  if (menu){
    menu.style.pointerEvents='auto';
    menu.style.zIndex='50';
    // เผื่อพาเรนต์ไปปิดคลิก
    menu.querySelectorAll('*').forEach(n=>{ n.style.pointerEvents='auto'; });
  }
})();
