// === Hero Health Academy — game/main.js (2025-10-30 FINAL, pointer fix + VRInput v2.1) ===
// - Gaze/VR reticle controls (VRInput v2.1)
// - Engine/HUD/Coach/Score/PowerUp/Mission/Progress/Quests wiring
// - Menu ↔ Playfield pointer control (spawnHost always clickable while playing)
// - Pause/Resume on blur/visibility
// - Safe handlers for dwell ms / cooldown / reticle style

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
const byAction = (el)=>el?.closest?.('[data-action]')||null;
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
  hud, coach, sfx, score, power, mission,
  THREE,
  // simple UI text pop
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
let currentKey = 'goodjunk';

// ----- Progress init -----
Progress.init?.();

// ----- VR / Gaze (VRInput v2.1) -----
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

// ===================== Pointer Control (menu ↔ playfield) =====================
function setPlayfieldActive(on){
  const menu  = document.getElementById('menuBar');
  const layer = document.getElementById('gameLayer');
  const host  = document.getElementById('spawnHost');

  // เปิด/ปิดการรับคลิกของสนามและโฮสต์สแปว์น
  if (layer) layer.style.pointerEvents = on ? 'auto' : 'none';
  if (host)  host.style.pointerEvents  = on ? 'auto' : 'none';

  // เมนู: กลับกัน เปิดเมื่อไม่ได้เล่น
  if (menu)  menu.style.pointerEvents  = on ? 'none' : 'auto';
}

function showMenu(){
  const m = document.getElementById('menuBar');
  const h = document.getElementById('hudWrap');
  const r = document.getElementById('result');
  if (m) m.style.display = 'block';
  if (h) h.style.display = 'none';
  if (r) r.style.display = 'none';
  setPlayfieldActive(false);
}

function showPlay(){
  const m = document.getElementById('menuBar');
  const h = document.getElementById('hudWrap');
  if (m) m.style.display = 'none';
  if (h) h.style.display = 'block';
  setPlayfieldActive(true);

  // กันเคสสไตล์ภายนอก/แคช: re-assert อีกรอบหลัง DOM วาด
  setTimeout(()=>setPlayfieldActive(true), 0);
}

// ===================== Mode / Game lifecycle =====================
function loadMode(key){
  const m = MODES[key] || MODES.goodjunk;
  if (current?.cleanup) { try { current.cleanup(); } catch{} }
  current = m.create({ engine, hud, coach }); // DOM-spawn adapter
  currentKey = key;
  // อัปเดตชื่อโหมดบนเมนู (ถ้ามี)
  setText('#modeName', ({
    goodjunk:'Good vs Junk',
    groups:'5 Food Groups',
    hydration:'Hydration',
    plate:'Healthy Plate'
  })[key] || 'Good vs Junk');
}

function startGame(){
  score.reset();
  engine.start();
  current?.start?.();
  coach.onStart?.();
}

function stopGame(){
  current?.stop?.();
  engine.stop();
  coach.onEnd?.();
}

// ===================== UI bindings =====================
function selectMode(key){
  currentKey = key;
  $$('#menuBar .tile').forEach(b=>b.classList.remove('active'));
  if (key==='goodjunk') $('#m_goodjunk')?.classList.add('active');
  if (key==='groups')   $('#m_groups')  ?.classList.add('active');
  if (key==='hydration')$('#m_hydration')?.classList.add('active');
  if (key==='plate')    $('#m_plate')   ?.classList.add('active');
  setText('#modeName', ({
    goodjunk:'Good vs Junk',
    groups:'5 Food Groups',
    hydration:'Hydration',
    plate:'Healthy Plate'
  })[key] || 'Good vs Junk');
}

function selectDiff(key){
  document.body.setAttribute('data-diff', key);
  ['d_easy','d_normal','d_hard'].forEach(id=>$('#'+id)?.classList.remove('active'));
  if (key==='Easy')   $('#d_easy')  ?.classList.add('active');
  if (key==='Normal') $('#d_normal')?.classList.add('active');
  if (key==='Hard')   $('#d_hard')  ?.classList.add('active');
  setText('#difficulty', key);
  window.__HHA_DIFF = key;
}

function bindMenu(){
  // เลือกโหมด
  $('#m_goodjunk')  ?.addEventListener('click', ()=>selectMode('goodjunk'));
  $('#m_groups')    ?.addEventListener('click', ()=>selectMode('groups'));
  $('#m_hydration') ?.addEventListener('click', ()=>selectMode('hydration'));
  $('#m_plate')     ?.addEventListener('click', ()=>selectMode('plate'));

  // เลือกความยาก
  $('#d_easy')   ?.addEventListener('click', ()=>selectDiff('Easy'));
  $('#d_normal') ?.addEventListener('click', ()=>selectDiff('Normal'));
  $('#d_hard')   ?.addEventListener('click', ()=>selectDiff('Hard'));

  // ปุ่มเริ่ม/กลับ/เล่นซ้ำ
  const btnStart = document.getElementById('btn_start');
  const btnHome  = document.querySelector('[data-result="home"]');
  const btnReplay= document.querySelector('[data-result="replay"]');

  // namespace เดิม
  window.HHA = window.HHA || {};
  window.HHA.setPlayfieldActive = setPlayfieldActive;
  window.HHA.startSelectedMode = ()=>{
    stopGame();
    loadMode(currentKey);
    startGame();
  };
  window.HHA.stop = ()=>stopGame();
  window.HHA.replay = ()=>{
    stopGame();
    loadMode(currentKey);
    startGame();
  };

  btnStart?.addEventListener('click', ()=>{
    showPlay();
    window.HHA.startSelectedMode?.();
  });
  btnHome?.addEventListener('click', ()=>{
    try{ window.HHA.stop?.(); }catch{}
    showMenu();
  });
  btnReplay?.addEventListener('click', ()=>{
    showPlay();
    try{ window.HHA.replay?.(); }catch{}
  });
}

// ===================== VR buttons / dwell controls =====================
function bindVRButtons(){
  // Toggle VR / Gaze (falls back to gaze if no WebXR)
  $$('#toggleVR, [data-action="toggle-vr"]').forEach(btn=>{
    btn.addEventListener('click', ()=>VRInput.toggleVR());
  });

  // Dwell controls
  $$('#dwellMinus, [data-action="dwell-"]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const cur = parseInt(localStorage.getItem('hha_dwell_ms')||'850',10);
      const nxt = Math.max(400, cur - 100);
      VRInput.setDwellMs(nxt);
      setText('#dwellVal', `${nxt}ms`);
      sfx.play?.('ui');
    });
  });
  $$('#dwellPlus, [data-action="dwell+"]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const cur = parseInt(localStorage.getItem('hha_dwell_ms')||'850',10);
      const nxt = Math.min(2000, cur + 100);
      VRInput.setDwellMs(nxt);
      setText('#dwellVal', `${nxt}ms`);
      sfx.play?.('ui');
    });
  });

  // Cooldown slider (optional)
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

  // Reticle quick themes (optional)
  $$('#reticleLight, [data-action="reticle-light"]').forEach(b=>{
    b.addEventListener('click', ()=>VRInput.setReticleStyle({ border:'#fff', progress:'#ffd54a', shadow:'#000a', size:28 }));
  });
  $$('#reticleBold, [data-action="reticle-bold"]').forEach(b=>{
    b.addEventListener('click', ()=>VRInput.setReticleStyle({ border:'#0ff', progress:'#0ff', shadow:'#000', size:34 }));
  });
}

// ===================== Global event delegation (optional) =====================
function bindGlobalActions(){
  document.addEventListener('click', (ev)=>{
    const a = byAction(ev.target);
    if (!a) return;

    const act = a.getAttribute('data-action');
    switch (act) {
      case 'play':
        showPlay();
        window.HHA.startSelectedMode?.();
        break;

      case 'stop':
        stopGame();
        showMenu();
        break;

      case 'toggle-vr':
        VRInput.toggleVR();
        break;

      default: break;
    }
  });
}

// ===================== Page visibility / focus =====================
function bindVisibility(){
  window.addEventListener('blur',  ()=>{ try{ engine.pause();  VRInput.pause(true); }catch{} }, { passive:true });
  window.addEventListener('focus', ()=>{ try{ engine.resume(); VRInput.resume(true);}catch{} }, { passive:true });
  document.addEventListener('visibilitychange', ()=>{
    if (document.hidden){ try{ engine.pause(); VRInput.pause(true);}catch{} }
    else { try{ engine.resume(); VRInput.resume(true);}catch{} }
  }, { passive:true });
}

// ===================== Boot =====================
(function boot(){
  try {
    hud.init?.();
    coach.init?.({ hud, sfx });
    engine.init?.();

    // Initial diff/mode from DOM
    selectDiff(document.body.getAttribute('data-diff') || 'Normal');

    // Default mode (URL param ?mode=)
    const urlMode = new URLSearchParams(location.search).get('mode') || 'goodjunk';
    selectMode(urlMode);
    loadMode(urlMode);

    // Initial dwell label
    const v = parseInt(localStorage.getItem('hha_dwell_ms')||'850',10);
    setText('#dwellVal', `${Number.isFinite(v)?v:850}ms`);

    // Bind UI
    bindMenu();
    bindVRButtons();
    bindGlobalActions();
    bindVisibility();

    // Start on menu (field off)
    showMenu();

    // Optional: auto-start when ?autoplay=1
    if (new URLSearchParams(location.search).get('autoplay')==='1'){
      showPlay();
      startGame();
    }
  } catch (e) {
    console.error('[HHA] Boot error', e);
    const el = document.createElement('pre');
    el.style.color = '#f55';
    el.textContent = 'Boot error:\n' + (e?.stack||e?.message||String(e));
    document.body.appendChild(el);
  }
})();
