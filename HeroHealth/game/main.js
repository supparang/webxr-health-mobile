// === Hero Health Academy — game/main.js (2025-10-30r2: click-safe + menu binding + VRInput) ===
// - Guarantees clickable menu (z-index + pointer-events guards)
// - Binds Mode/Difficulty tiles
// - Start/Home/Replay wire-up
// - Ensures playfield pointer events only when playing
// - Includes VRInput integration (non-blocking)

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

import * as goodjunk   from './modes/goodjunk.js';
import * as groups     from './modes/groups.js';
import * as hydration  from './modes/hydration.js';
import * as plate      from './modes/plate.js';

window.__HHA_BOOT_OK = true;

// ---------- Shortcuts ----------
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));
const setText = (sel, txt)=>{ const el=$(sel); if(el) el.textContent = txt; };

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

// ---------- Modes ----------
const MODES = { goodjunk, groups, hydration, plate };
let current = null;
let playing = false;
let selMode = 'goodjunk';
let selDiff = 'Normal';

// ---------- Progress ----------
Progress.init?.();

// ---------- VR / Gaze ----------
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

// ---------- Click safety: force menu interactive / playfield gated ----------
function setPlayfieldActive(on){
  const menu   = $('#menuBar');
  const layer  = $('#gameLayer');
  const hudWrap= $('#hudWrap');

  if (layer)  layer.style.pointerEvents   = on ? 'auto'  : 'none';
  if (hudWrap)hudWrap.style.pointerEvents = 'none'; // HUD never blocks clicks
  if (menu)   menu.style.pointerEvents    = on ? 'none' : 'auto';
  // safety: bump z-index layering
  if (menu)   menu.style.zIndex = '20';
  if (layer)  layer.style.zIndex = '10';
}
function showMenu(){
  $('#menuBar')?.style && ( $('#menuBar').style.display = 'block' );
  $('#hudWrap')?.style && ( $('#hudWrap').style.display = 'none' );
  $('#result')?.style  && ( $('#result').style.display  = 'none' );
  setPlayfieldActive(false);
  playing = false;
}
function showPlay(){
  $('#menuBar')?.style && ( $('#menuBar').style.display = 'none' );
  $('#hudWrap')?.style && ( $('#hudWrap').style.display = 'block' );
  $('#result')?.style  && ( $('#result').style.display  = 'none' );
  setPlayfieldActive(true);
  playing = true;
}

// ---------- Mode loader ----------
function loadMode(key){
  const m = MODES[key] || MODES.goodjunk;
  if (current?.cleanup) { try { current.cleanup(); } catch{} }
  current = m.create({ engine, hud, coach }); // DOM-spawn factory
  document.body.setAttribute('data-mode', key);
}
function startGame(){
  score.reset();
  window.__HHA_DIFF = selDiff;
  document.body.setAttribute('data-diff', selDiff);

  engine.start();
  current?.start?.();
  coach.onStart?.();
}
function stopGame(){
  try{ current?.stop?.(); }catch{}
  try{ engine.stop(); }catch{}
  coach.onEnd?.();
}

// ---------- Public namespace for legacy calls ----------
window.HHA = window.HHA || {};
window.HHA.startSelectedMode = function(){
  // (re)load with current selection
  loadMode(selMode);
  startGame();
};
window.HHA.stop = function(){
  stopGame();
  showMenu();
};
window.HHA.replay = function(){
  if (!current) loadMode(selMode);
  startGame();
  showPlay();
};

// ---------- Bind Menu (modes / difficulty / start) ----------
function bindMenu(){
  // Mode tiles
  const tiles = [
    { id:'m_goodjunk', key:'goodjunk', label:'Good vs Junk' },
    { id:'m_groups',   key:'groups',   label:'5 Food Groups' },
    { id:'m_hydration',key:'hydration',label:'Hydration' },
    { id:'m_plate',    key:'plate',    label:'Healthy Plate' },
  ];
  tiles.forEach(t=>{
    const el = $('#'+t.id);
    if (!el) return;
    el.addEventListener('click', ()=>{
      tiles.forEach(x=>$('#'+x.id)?.classList.remove('active'));
      el.classList.add('active');
      selMode = t.key;
      setText('#modeName', t.label);
      document.body.setAttribute('data-mode', selMode);
      sfx.play?.('ui');
    });
  });

  // Difficulty chips
  const diffs = [
    { id:'d_easy',   key:'Easy' },
    { id:'d_normal', key:'Normal' },
    { id:'d_hard',   key:'Hard' },
  ];
  diffs.forEach(d=>{
    const el = $('#'+d.id);
    if (!el) return;
    el.addEventListener('click', ()=>{
      diffs.forEach(x=>$('#'+x.id)?.classList.remove('active'));
      el.classList.add('active');
      selDiff = d.key;
      setText('#difficulty', selDiff);
      document.body.setAttribute('data-diff', selDiff);
      sfx.play?.('ui');
    });
  });

  // Start / Result buttons
  const btnStart  = $('#btn_start');
  const btnHome   = document.querySelector('[data-result="home"]');
  const btnReplay = document.querySelector('[data-result="replay"]');

  btnStart?.addEventListener('click', ()=>{
    showPlay();
    window.HHA.startSelectedMode();
  });
  btnHome?.addEventListener('click', ()=>{
    window.HHA.stop();
  });
  btnReplay?.addEventListener('click', ()=>{
    window.HHA.replay();
  });
}

// ---------- Global pause/resume on focus/vis ----------
function bindPageLifecycle(){
  window.addEventListener('blur',  ()=>{
    try{ engine.pause();  VRInput.pause(true); }catch{}
  }, { passive:true });
  window.addEventListener('focus', ()=>{
    try{ engine.resume(); VRInput.resume(true);}catch{}
  }, { passive:true });
  document.addEventListener('visibilitychange', ()=>{
    if (document.hidden){ try{ engine.pause(); VRInput.pause(true);}catch{} }
    else { try{ engine.resume(); VRInput.resume(true);}catch{} }
  }, { passive:true });
}

// ---------- Boot ----------
(function boot(){
  try{
    hud.init?.();
    coach.init?.({ hud, sfx });
    engine.init?.();

    // initial selections from URL or defaults
    const urlMode = new URLSearchParams(location.search).get('mode') || 'goodjunk';
    const urlDiff = new URLSearchParams(location.search).get('diff') || 'Normal';
    selMode = MODES[urlMode] ? urlMode : 'goodjunk';
    selDiff = /^(Easy|Normal|Hard)$/.test(urlDiff) ? urlDiff : 'Normal';

    // reflect initial UI
    document.body.setAttribute('data-mode', selMode);
    document.body.setAttribute('data-diff', selDiff);
    $('#m_'+selMode)?.classList.add('active');
    $('#d_'+selDiff.toLowerCase())?.classList.add('active');
    setText('#modeName', $('#m_'+selMode)?.querySelector('b')?.textContent || 'Good vs Junk');
    setText('#difficulty', selDiff);

    // dwell text
    const v = parseInt(localStorage.getItem('hha_dwell_ms')||'850',10);
    setText('#dwellVal', `${Number.isFinite(v)?v:850}ms`);

    bindMenu();
    bindPageLifecycle();

    // Always start at menu with playfield disabled
    showMenu();

    // Autoplay support
    if (new URLSearchParams(location.search).get('autoplay')==='1'){
      showPlay();
      window.HHA.startSelectedMode();
    }

    // Final click safety sweep (in case CSS was cached/old)
    const menu = $('#menuBar'); if (menu){ menu.style.pointerEvents='auto'; menu.style.zIndex='20'; }
    const layer= $('#gameLayer'); if (layer){ layer.style.pointerEvents='none'; layer.style.zIndex='10'; }
    const hudW = $('#hudWrap'); if (hudW){ hudW.style.pointerEvents='none'; hudW.style.zIndex='14'; }

  }catch(e){
    console.error('[HHA] Boot error', e);
    const el = document.createElement('pre');
    el.style.color = '#f55';
    el.textContent = 'Boot error:\n' + (e?.stack||e?.message||String(e));
    document.body.appendChild(el);
  }
})();
