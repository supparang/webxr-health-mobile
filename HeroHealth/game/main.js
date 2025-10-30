// === Hero Health Academy — game/main.js (2025-10-30 PATCH B: wire real UI) ===
// - Bind real buttons: mode tiles, difficulty chips, Start/Home/Replay
// - Properly call loadMode(...) + engine.start()/stop()
// - Update active classes & text labels
// - Keep VRInput + Engine/HUD/Coach integration

import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';

import { Engine }            from './core/engine.js';
import { HUD }               from './core/hud.js';
import { Coach }             from './core/coach.js';
import { SFX }               from './core/sfx.js';
import { ScoreSystem }       from './core/score.js';
import { PowerUpSystem }     from './core/powerup.js';
import { MissionSystem }     from './core/mission-system.js';
import { Progress }          from './core/progression.js';
import { Quests }            from './core/quests.js';
import { VRInput }           from './core/vrinput.js';

// Modes (DOM-spawn factory pattern)
import * as goodjunk   from './modes/goodjunk.js';
import * as groups     from './modes/groups.js';
import * as hydration  from './modes/hydration.js';
import * as plate      from './modes/plate.js';

window.__HHA_BOOT_OK = true;

// ----- DOM helpers -----
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));
const setText = (sel, txt)=>{ const el=$(sel); if(el) el.textContent = txt; };

// ----- Core singletons -----
const score   = new ScoreSystem();
const power   = new PowerUpSystem();
const coach   = new Coach();
const hud     = new HUD();
const sfx     = new SFX();
const mission = new MissionSystem();
power.attachToScore(score);

const engine = new Engine({
  hud, coach, sfx, score, power, mission, THREE,
  fx: {
    popText: (text, { x=0, y=0, ms=650 }={})=>{
      const n = document.createElement('div');
      n.className = 'poptext';
      n.textContent = text;
      n.style.left = x+'px';
      n.style.top  = y+'px';
      document.body.appendChild(n);
      setTimeout(()=>{ try{ n.remove(); }catch{} }, ms|0);
    }
  }
});

// ----- Mode registry -----
const MODES = { goodjunk, groups, hydration, plate };
let current = null;

// ----- Progress init -----
Progress.init?.();

// ----- VR / Gaze -----
VRInput.init({ engine, sfx, THREE });
window.HHA_VR = {
  toggle: ()=>VRInput.toggleVR(),
  pause:  ()=>VRInput.pause(),
  resume: ()=>VRInput.resume(),
  setDwell: (ms)=>VRInput.setDwellMs(ms),
  setCooldown: (ms)=>VRInput.setCooldown(ms),
  style: (opts)=>VRInput.setReticleStyle(opts),
  isGaze: ()=>VRInput.isGazeMode(),
  isXR:   ()=>VRInput.isXRActive(),
};

// ====== UI STATE ======
let selectedMode = 'goodjunk';
let selectedDiff = 'Normal';

// ====== LIFECYCLE ======
function loadMode(key){
  const m = MODES[key] || MODES.goodjunk;
  if (current?.cleanup) { try { current.cleanup(); } catch{} }
  current = m.create({ engine, hud, coach }); // DOM-spawn adapter
}

function startGame(){
  // apply difficulty to DOM/state
  document.body.setAttribute('data-diff', selectedDiff);
  window.__HHA_DIFF = selectedDiff;

  score.reset();
  engine.start();           // << สำคัญสุด: เริ่มเอ็นจิน (เวลาเดิน + อัปเดตโหมด)
  current?.start?.();
  coach.onStart?.();

  // HUD/Menu toggle
  showPlay();
  setPlayfieldActive(true);
}

function stopGame(){
  current?.stop?.();
  engine.stop();
  coach.onEnd?.();
  setPlayfieldActive(false);
}

function showMenu(){
  $('#menuBar')?.style && ( $('#menuBar').style.display = 'block' );
  $('#hudWrap')?.style && ( $('#hudWrap').style.display = 'none' );
  $('#result')?.style && ( $('#result').style.display = 'none' );
  setPlayfieldActive(false);
}
function showPlay(){
  $('#menuBar')?.style && ( $('#menuBar').style.display = 'none' );
  $('#hudWrap')?.style && ( $('#hudWrap').style.display = 'block' );
  $('#result')?.style && ( $('#result').style.display = 'none' );
}
function showResult(){
  $('#hudWrap')?.style && ( $('#hudWrap').style.display = 'none' );
  $('#result')?.style && ( $('#result').style.display = 'flex' );
  setPlayfieldActive(false);
}

// เปิด/ปิดความสามารถรับคลิกของสนาม และเมนู
function setPlayfieldActive(on){
  const menu  = $('#menuBar');
  const layer = $('#gameLayer');
  if (layer) layer.style.pointerEvents = on ? 'auto' : 'none';
  if (menu)  menu.style.pointerEvents  = on ? 'none' : 'auto';
}

// ====== BIND REAL UI ======
function bindModeTiles(){
  const map = {
    m_goodjunk:  { key:'goodjunk',  label:'Good vs Junk' },
    m_groups:    { key:'groups',    label:'5 Food Groups' },
    m_hydration: { key:'hydration', label:'Hydration' },
    m_plate:     { key:'plate',     label:'Healthy Plate' }
  };
  Object.keys(map).forEach(id=>{
    const cfg = map[id];
    const btn = $('#'+id);
    if (!btn) return;
    btn.addEventListener('click', ()=>{
      selectedMode = cfg.key;
      // active class
      $$('.menu .tile').forEach(x=>x.classList.remove('active'));
      btn.classList.add('active');
      // label
      setText('#modeName', cfg.label);
    });
  });
}

function bindDiffChips(){
  const pairs = [
    { id:'d_easy',   diff:'Easy'   },
    { id:'d_normal', diff:'Normal' },
    { id:'d_hard',   diff:'Hard'   }
  ];
  pairs.forEach(({id,diff})=>{
    const b = $('#'+id);
    if (!b) return;
    b.addEventListener('click', ()=>{
      selectedDiff = diff;
      // active class
      ['d_easy','d_normal','d_hard'].forEach(i=>$('#'+i)?.classList.remove('active'));
      b.classList.add('active');
      // text + data-diff
      setText('#difficulty', diff);
      document.body.setAttribute('data-diff', diff);
      window.__HHA_DIFF = diff;
    });
  });
}

function bindCoreButtons(){
  const btnStart  = $('#btn_start');
  const btnHome   = document.querySelector('[data-result="home"]');
  const btnReplay = document.querySelector('[data-result="replay"]');

  btnStart?.addEventListener('click', ()=>{
    // โหลดโหมดที่เลือก แล้วเริ่มจริง
    loadMode(selectedMode);
    startGame();
  });

  btnHome?.addEventListener('click', ()=>{
    try{ stopGame(); }catch{}
    showMenu();
  });

  btnReplay?.addEventListener('click', ()=>{
    // รีสตาร์ตรอบใหม่ด้วยโหมด/ระดับเดิม
    loadMode(selectedMode);
    startGame();
  });
}

function bindVRButtons(){
  // Toggle VR
  $$('#toggleVR, [data-action="toggle-vr"]').forEach(btn=>{
    btn.addEventListener('click', ()=>VRInput.toggleVR());
  });

  // (optional) dwell/cooldown controls
  const cd = $('#gazeCooldown');
  if (cd) {
    const val = $('#gazeCooldownVal');
    const apply = ()=>{
      const ms = Math.max(0, parseInt(cd.value||'350',10)|0);
      VRInput.setCooldown(ms);
      if (val) val.textContent = `${ms}ms`;
    };
    cd.addEventListener('input', apply);
    apply();
  }
}

// ====== Visibility → pause/resume ======
function bindVisibilityGuards(){
  window.addEventListener('blur',  ()=>{ try{ engine.pause();  VRInput.pause(true); }catch{} }, { passive:true });
  window.addEventListener('focus', ()=>{ try{ engine.resume(); VRInput.resume(true);}catch{} }, { passive:true });
  document.addEventListener('visibilitychange', ()=>{
    if (document.hidden){ try{ engine.pause(); VRInput.pause(true);}catch{} }
    else { try{ engine.resume(); VRInput.resume(true);}catch{} }
  }, { passive:true });
}

// ====== Boot ======
(function boot(){
  try {
    hud.init?.();
    coach.init?.({ hud, sfx });
    engine.init?.();

    // default selections reflect UI
    selectedMode = 'goodjunk';
    selectedDiff = (document.body.getAttribute('data-diff') || 'Normal');
    window.__HHA_DIFF = selectedDiff;
    setText('#modeName', 'Good vs Junk');
    setText('#difficulty', selectedDiff);

    // preload default mode for faster start (ไม่เริ่มจนกด Start)
    loadMode(selectedMode);

    // bindings
    bindModeTiles();
    bindDiffChips();
    bindCoreButtons();
    bindVRButtons();
    bindVisibilityGuards();

    // start at menu
    showMenu();

    // Ensure canvas never eats clicks
    const c = $('#c'); if (c){ c.style.pointerEvents='none'; c.style.zIndex='0'; }
    const menu = $('#menuBar'); if (menu){ menu.style.pointerEvents='auto'; menu.style.zIndex='50'; }

    // Optional: handle engine "end" if engine exposes callback/event
    if (!window.HHA) window.HHA = {};
    window.HHA.stop   = stopGame;
    window.HHA.replay = ()=>{ loadMode(selectedMode); startGame(); };
    // If your Engine exposes onEnd, wire it to result screen:
    try {
      if (engine.onEnd === undefined) engine.onEnd = null;
    } catch {}
  } catch (e) {
    console.error('[HHA] Boot error', e);
    const el = document.createElement('pre');
    el.style.color = '#f55';
    el.textContent = 'Boot error:\n' + (e?.stack||e?.message||String(e));
    document.body.appendChild(el);
  }
})();
