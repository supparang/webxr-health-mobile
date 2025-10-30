// === Hero Health Academy — game/main.js (2025-10-30 CLICK-SAFE + Start/Replay wired) ===

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
  hud, coach, sfx, score, power, mission,
  THREE,
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

// ----- Progress / VRInput -----
Progress.init?.();

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

// ================= CLICK LAYERS =================
function enforceClickLayers(){
  const menu  = $('#menuBar');
  const layer = $('#gameLayer');
  const spawn = $('#spawnHost');
  const result= $('#result');
  const canvas= $('#c');

  if (canvas){ canvas.style.pointerEvents = 'none'; canvas.style.zIndex = '0'; }
  if (layer){  layer.style.zIndex = '10'; }
  if (spawn){  spawn.style.zIndex = '11'; spawn.style.pointerEvents = 'auto'; }

  if (menu){
    menu.style.display = 'block';
    menu.style.zIndex = '999';
    menu.style.pointerEvents = 'auto';
  }
  if (layer){  layer.style.pointerEvents = 'none'; }
  if (result){
    result.style.display = 'none';
    result.style.pointerEvents = 'auto';
    result.style.zIndex = '1000';
  }

  // Watchdog: ถ้าไฟล์อื่นมาเปลี่ยน pointer/z-index จะรีบตั้งคืน
  const mo = new MutationObserver(()=> {
    if (menu && (menu.style.pointerEvents !== 'auto' || menu.style.zIndex !== '999')){
      menu.style.pointerEvents = 'auto'; menu.style.zIndex = '999';
    }
    if (layer && layer.style.pointerEvents !== 'none' && $('#menuBar')?.style.display!=='none'){
      layer.style.pointerEvents = 'none';
    }
    if (spawn && spawn.style.pointerEvents !== 'auto'){
      spawn.style.pointerEvents = 'auto';
    }
    if (canvas && canvas.style.pointerEvents !== 'none'){
      canvas.style.pointerEvents = 'none';
    }
  });
  mo.observe(document.documentElement, { attributes:true, childList:true, subtree:true });
}

function setPlayfieldActive(on){
  const menu  = $('#menuBar');
  const layer = $('#gameLayer');
  const spawn = $('#spawnHost');
  if (layer) layer.style.pointerEvents = on ? 'auto' : 'none';
  if (spawn) spawn.style.pointerEvents = on ? 'auto' : 'none';
  if (menu)  menu.style.pointerEvents  = on ? 'none' : 'auto';
}

// ================= MENU SELECTION =================
function bindModeSelectors(){
  const map = {
    m_goodjunk:  { key:'goodjunk',  label:'Good vs Junk' },
    m_groups:    { key:'groups',    label:'5 Food Groups' },
    m_hydration: { key:'hydration', label:'Hydration' },
    m_plate:     { key:'plate',     label:'Healthy Plate' },
  };
  Object.keys(map).forEach(id=>{
    const btn = $('#'+id);
    if (!btn) return;
    btn.addEventListener('click', ()=>{
      // visual active
      $$('.menu .tile').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');

      // store
      currentKey = map[id].key;
      document.body.setAttribute('data-mode', currentKey);
      setText('#modeName', map[id].label);
    });
  });

  // difficulty
  const diffEl = $('#difficulty');
  function setDiff(key){
    ['d_easy','d_normal','d_hard'].forEach(id=>$('#'+id)?.classList.remove('active'));
    if (key==='Easy')   $('#d_easy')?.classList.add('active');
    if (key==='Normal') $('#d_normal')?.classList.add('active');
    if (key==='Hard')   $('#d_hard')?.classList.add('active');
    document.body.setAttribute('data-diff', key);
    window.__HHA_DIFF = key;
    if (diffEl) diffEl.textContent = key;
  }
  $('#d_easy')?.addEventListener('click', ()=>setDiff('Easy'));
  $('#d_normal')?.addEventListener('click', ()=>setDiff('Normal'));
  $('#d_hard')?.addEventListener('click', ()=>setDiff('Hard'));
  // default selection from DOM
  setDiff(document.body.getAttribute('data-diff') || 'Normal');
}

function loadMode(key){
  const m = MODES[key] || MODES.goodjunk;
  if (current?.cleanup) { try { current.cleanup(); } catch{} }
  current = m.create({ engine, hud, coach });
}

function startGame(){
  // ปิดเมนู → เปิดสนาม
  showPlay();

  // โหลดโหมดตามที่เลือก
  loadMode(currentKey);

  // reset/เริ่ม
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

function replayGame(){
  stopGame();
  startGame();
}

// ================= HUD / MENU TOGGLE =================
function showMenu(){
  $('#menuBar')?.style && ($('#menuBar').style.display='block');
  $('#hudWrap')?.style && ($('#hudWrap').style.display='none');
  $('#result')?.style && ($('#result').style.display='none');
  setPlayfieldActive(false);
}
function showPlay(){
  $('#menuBar')?.style && ($('#menuBar').style.display='none');
  $('#hudWrap')?.style && ($('#hudWrap').style.display='block');
  setPlayfieldActive(true);
}

// ================= VR Buttons / Dwell / Reticle =================
function bindVRButtons(){
  $$('#toggleVR,[data-action="toggle-vr"]').forEach(btn=>btn.addEventListener('click', ()=>VRInput.toggleVR()));

  $$('#dwellMinus,[data-action="dwell-"]').forEach(b=>b.addEventListener('click', ()=>{
    const cur = parseInt(localStorage.getItem('hha_dwell_ms')||'850',10);
    const nxt = Math.max(400, cur - 100);
    VRInput.setDwellMs(nxt);
    setText('#dwellVal', `${nxt}ms`);
    sfx.play?.('ui');
  }));
  $$('#dwellPlus,[data-action="dwell+"]').forEach(b=>b.addEventListener('click', ()=>{
    const cur = parseInt(localStorage.getItem('hha_dwell_ms')||'850',10);
    const nxt = Math.min(2000, cur + 100);
    VRInput.setDwellMs(nxt);
    setText('#dwellVal', `${nxt}ms`);
    sfx.play?.('ui');
  }));

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

  $$('#reticleLight,[data-action="reticle-light"]').forEach(b=>{
    b.addEventListener('click', ()=>VRInput.setReticleStyle({ border:'#fff', progress:'#ffd54a', shadow:'#000a', size:28 }));
  });
  $$('#reticleBold,[data-action="reticle-bold"]').forEach(b=>{
    b.addEventListener('click', ()=>VRInput.setReticleStyle({ border:'#0ff', progress:'#0ff', shadow:'#000', size:34 }));
  });
}

// ================= Wire Start/Home/Replay =================
(function wireUI(){
  const btnStart = $('#btn_start');
  const btnHome  = document.querySelector('[data-result="home"]');
  const btnReplay= document.querySelector('[data-result="replay"]');

  // public namespace ให้ปุ่มอื่นเรียกได้
  window.HHA = window.HHA || {};
  window.HHA.setPlayfieldActive = setPlayfieldActive;
  window.HHA.startSelectedMode  = startGame;
  window.HHA.stop               = stopGame;
  window.HHA.replay             = replayGame;

  btnStart?.addEventListener('click', ()=> startGame());
  btnHome?.addEventListener('click', ()=>{ stopGame(); showMenu(); });
  btnReplay?.addEventListener('click', ()=> replayGame());

  // เริ่มต้นที่เมนู และบังคับชั้นคลิก
  showMenu();
  enforceClickLayers();

  // bind selectors หลังชั้นคลิกเซ็ตแล้ว
  bindModeSelectors();
  bindVRButtons();
})();

// ================= Lifecycle / Boot =================
(function boot(){
  try {
    hud.init?.();
    coach.init?.({ hud, sfx });
    engine.init?.();

    // default mode from URL (?mode=)
    const urlMode = new URLSearchParams(location.search).get('mode') || 'goodjunk';
    if (MODES[urlMode]) currentKey = urlMode;
    document.body.setAttribute('data-mode', currentKey);
    setText('#modeName',
      {goodjunk:'Good vs Junk',groups:'5 Food Groups',hydration:'Hydration',plate:'Healthy Plate'}[currentKey] || 'Good vs Junk'
    );

    // dwell text
    const v = parseInt(localStorage.getItem('hha_dwell_ms')||'850',10);
    setText('#dwellVal', `${Number.isFinite(v)?v:850}ms`);

    // Auto-play (option)
    if (new URLSearchParams(location.search).get('autoplay')==='1'){
      startGame();
    }

    // Pause/Resume on visibility/blur
    window.addEventListener('blur',  ()=>{ try{ engine.pause();  VRInput.pause(true); }catch{} }, { passive:true });
    window.addEventListener('focus', ()=>{ try{ engine.resume(); VRInput.resume(true);}catch{} }, { passive:true });
    document.addEventListener('visibilitychange', ()=>{
      if (document.hidden){ try{ engine.pause(); VRInput.pause(true);}catch{} }
      else { try{ engine.resume(); VRInput.resume(true);}catch{} }
    }, { passive:true });

  } catch (e) {
    console.error('[HHA] Boot error', e);
    const el = document.createElement('pre');
    el.style.color = '#f55';
    el.textContent = 'Boot error:\n' + (e?.stack||e?.message||String(e));
    document.body.appendChild(el);
  }
})();
