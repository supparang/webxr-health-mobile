// === Hero Health Academy — game/main.js (2025-10-30, VRInput v2.1 integrated; pointer fix) ===
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
      n.style.left = x+'px'; n.style.top = y+'px';
      document.body.appendChild(n);
      setTimeout(()=>{ try{ n.remove(); }catch{} }, ms|0);
    }
  }
});

// ----- Mode registry -----
const MODES = { goodjunk, groups, hydration, plate };
let current = null;
let selectedMode = (document.body.getAttribute('data-mode') || 'goodjunk');
let selectedDiff = (document.body.getAttribute('data-diff') || 'Normal');

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

// ---------- Pointer layering helpers ----------
function setPlayfieldActive(on){
  const menu  = $('#menuBar');
  const layer = $('#gameLayer');
  if (layer) layer.style.pointerEvents = on ? 'auto' : 'none';
  if (menu)  menu.style.pointerEvents  = on ? 'none' : 'auto';
}
function showMenu(){
  $('#menuBar')?.style && ($('#menuBar').style.display = 'block');
  $('#hudWrap')?.style && ($('#hudWrap').style.display = 'none');
  $('#result')?.style && ($('#result').style.display = 'none');
  setPlayfieldActive(false);
}
function showPlay(){
  $('#menuBar')?.style && ($('#menuBar').style.display = 'none');
  $('#hudWrap')?.style && ($('#hudWrap').style.display = 'block');
  setPlayfieldActive(true);
}

// ----- Lifecycle: play/stop -----
function loadMode(key){
  const m = MODES[key] || MODES.goodjunk;
  if (current?.cleanup) { try { current.cleanup(); } catch{} }
  // ให้โหมดอ่าน diff จาก body data เช่นเดิม
  document.body.setAttribute('data-mode', key);
  document.body.setAttribute('data-diff', selectedDiff);
  window.__HHA_DIFF = selectedDiff;
  current = m.create({ engine, hud, coach });
}
function startGame(){
  showPlay();            // เปิดสนาม + ปิดเมนู
  score.reset();
  engine.start();
  current?.start?.();
  coach.onStart?.();
}
function stopGame(){
  try { current?.stop?.(); } catch {}
  try { engine.stop(); } catch {}
  coach.onEnd?.();
  showMenu();            // กลับเมนู + ปิดสนาม
}

// ----- Bind UI (menu, difficulty, start/home/replay) -----
function bindMenu(){
  // Mode tiles
  const nameMap = { goodjunk:'Good vs Junk', groups:'5 Food Groups', hydration:'Hydration', plate:'Healthy Plate' };
  const tiles = [
    ['m_goodjunk','goodjunk'],
    ['m_groups','groups'],
    ['m_hydration','hydration'],
    ['m_plate','plate'],
  ];
  tiles.forEach(([id,key])=>{
    const el = $('#'+id);
    if (!el) return;
    el.addEventListener('click', ()=>{
      tiles.forEach(([id2])=>$('#'+id2)?.classList.remove('active'));
      el.classList.add('active');
      selectedMode = key;
      document.body.setAttribute('data-mode', key);
      setText('#modeName', nameMap[key] || key);
    });
  });

  // Difficulty
  const diffBtns = [
    ['d_easy','Easy'],
    ['d_normal','Normal'],
    ['d_hard','Hard'],
  ];
  diffBtns.forEach(([id,label])=>{
    const el = $('#'+id);
    if (!el) return;
    el.addEventListener('click', ()=>{
      diffBtns.forEach(([id2])=>$('#'+id2)?.classList.remove('active'));
      el.classList.add('active');
      selectedDiff = label;
      document.body.setAttribute('data-diff', label);
      setText('#difficulty', label);
    });
  });

  // Start / Home / Replay
  $('#btn_start')?.addEventListener('click', ()=>{
    // โหลดโหมดที่เลือก (ถ้าต่างจากปัจจุบันให้เปลี่ยน)
    if (!current || current?.name !== selectedMode){
      loadMode(selectedMode);
    }
    startGame();
  });

  document.querySelector('[data-result="home"]')?.addEventListener('click', ()=>{
    stopGame();
  });
  document.querySelector('[data-result="replay"]')?.addEventListener('click', ()=>{
    // รีสตาร์ทโหมดเดิม
    if (!current) loadMode(selectedMode);
    showPlay();
    try { current?.stop?.(); } catch {}
    startGame();
  });
}

// ----- Pause/Resume on page visibility -----
function bindVisibility(){
  window.addEventListener('blur',  ()=>{ try{ engine.pause();  VRInput.pause(true);}catch{} }, { passive:true });
  window.addEventListener('focus', ()=>{ try{ engine.resume(); VRInput.resume(true);}catch{} }, { passive:true });
  document.addEventListener('visibilitychange', ()=>{
    if (document.hidden){ try{ engine.pause(); VRInput.pause(true);}catch{} }
    else { try{ engine.resume(); VRInput.resume(true);}catch{} }
  }, { passive:true });
}

// ----- VR quick controls (optional buttons if present) -----
function bindVRButtons(){
  $$('#toggleVR,[data-action="toggle-vr"]').forEach(b=>b.addEventListener('click', ()=>VRInput.toggleVR()));
  $$('#dwellMinus,[data-action="dwell-"]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const cur = parseInt(localStorage.getItem('hha_dwell_ms')||'850',10);
      const nxt = Math.max(400, cur-100); VRInput.setDwellMs(nxt); setText('#dwellVal', `${nxt}ms`); sfx.play?.('ui');
    });
  });
  $$('#dwellPlus,[data-action="dwell+"]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const cur = parseInt(localStorage.getItem('hha_dwell_ms')||'850',10);
      const nxt = Math.min(2000, cur+100); VRInput.setDwellMs(nxt); setText('#dwellVal', `${nxt}ms`); sfx.play?.('ui');
    });
  });

  const cd = $('#gazeCooldown');
  if (cd){
    const val = $('#gazeCooldownVal');
    const apply = ()=>{
      const ms = Math.max(0, parseInt(cd.value||'350',10)|0);
      VRInput.setCooldown(ms); if (val) val.textContent = `${ms}ms`;
    };
    cd.addEventListener('input', apply); apply();
  }

  $$('#reticleLight,[data-action="reticle-light"]').forEach(b=>
    b.addEventListener('click', ()=>VRInput.setReticleStyle({ border:'#fff', progress:'#ffd54a', shadow:'#000a', size:28 }))
  );
  $$('#reticleBold,[data-action="reticle-bold"]').forEach(b=>
    b.addEventListener('click', ()=>VRInput.setReticleStyle({ border:'#0ff', progress:'#0ff', shadow:'#000', size:34 }))
  );
}

// ----- Boot -----
(function boot(){
  try{
    hud.init?.(); coach.init?.({ hud, sfx }); engine.init?.();

    // ค่าเริ่มต้นจาก URL (?mode=..., ?diff=..., ?autoplay=1)
    const q = new URLSearchParams(location.search);
    selectedMode = q.get('mode') || selectedMode;
    selectedDiff = q.get('diff') || selectedDiff;
    document.body.setAttribute('data-mode', selectedMode);
    document.body.setAttribute('data-diff', selectedDiff);
    setText('#modeName', {goodjunk:'Good vs Junk',groups:'5 Food Groups',hydration:'Hydration',plate:'Healthy Plate'}[selectedMode] || selectedMode);
    setText('#difficulty', selectedDiff);
    if (selectedDiff==='Easy') { $('#d_easy')?.classList.add('active'); $('#d_normal')?.classList.remove('active'); $('#d_hard')?.classList.remove('active'); }

    // โหลดโหมดเริ่มต้น (เพื่อเตรียม adapter)
    loadMode(selectedMode);

    // ตั้ง dwell text หากมี
    const v = parseInt(localStorage.getItem('hha_dwell_ms')||'850',10);
    setText('#dwellVal', `${Number.isFinite(v)?v:850}ms`);

    // Bind UI
    bindMenu();
    bindVisibility();
    bindVRButtons();

    // เริ่มที่เมนู (ปิด pointer สนาม)
    showMenu();

    // Auto-play ถ้าระบุ
    if (q.get('autoplay')==='1'){ startGame(); }
  }catch(e){
    console.error('[HHA] Boot error', e);
    const el = document.createElement('pre'); el.style.color='#f55';
    el.textContent = 'Boot error:\n' + (e?.stack||e?.message||String(e));
    document.body.appendChild(el);
  }
})();
