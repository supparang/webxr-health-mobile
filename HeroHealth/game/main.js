// === Hero Health Academy — game/main.js (2025-10-30, VRInput v2.1 integrated) ===
// - Wires gaze/VR reticle controls to UI
// - Pause/Resume on page visibility
// - Safe handlers for dwell ms / cooldown / reticle style
// - No breaking change to existing Engine/HUD/Coach flow

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

// ----- Lifecycle: play/stop -----
function loadMode(key){
  const m = MODES[key] || MODES.goodjunk;
  if (current?.cleanup) { try { current.cleanup(); } catch{} }
  current = m.create({ engine, hud, coach }); // DOM-spawn adapter
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

// ----- Bind global UI -----
function bindUI(){
  document.addEventListener('click', (ev)=>{
    const a = byAction(ev.target);
    if (!a) return;

    const act = a.getAttribute('data-action');
    switch (act) {
      case 'play':
        stopGame();
        const sel = document.querySelector('input[name="mode"]:checked')?.value || 'goodjunk';
        loadMode(sel);
        startGame();
        break;

      case 'stop':
        stopGame();
        break;

      case 'toggle-vr':
        VRInput.toggleVR();
        break;

      case 'reticle-light':
      case 'reticle-bold':
      case 'dwell-':
      case 'dwell+':
        // handled in bindVRButtons
        break;

      default: break;
    }
  });

  // Pause on blur/hidden, resume on focus (engine handles internal guards)
  window.addEventListener('blur',  ()=>{ try{ engine.pause();  VRInput.pause(true); }catch{} }, { passive:true });
  window.addEventListener('focus', ()=>{ try{ engine.resume(); VRInput.resume(true);}catch{} }, { passive:true });
  document.addEventListener('visibilitychange', ()=>{
    if (document.hidden){ try{ engine.pause(); VRInput.pause(true);}catch{} }
    else { try{ engine.resume(); VRInput.resume(true);}catch{} }
  }, { passive:true });

  bindVRButtons();
}

// ----- Boot -----
(function boot(){
  try {
    hud.init?.();
    coach.init?.({ hud, sfx });
    engine.init?.();

    // Default mode
    const urlMode = new URLSearchParams(location.search).get('mode') || 'goodjunk';
    loadMode(urlMode);

    // Apply initial dwell text if present
    const v = parseInt(localStorage.getItem('hha_dwell_ms')||'850',10);
    setText('#dwellVal', `${Number.isFinite(v)?v:850}ms`);

    bindUI();

    // Optional: auto-start when ?autoplay=1
    if (new URLSearchParams(location.search).get('autoplay')==='1'){
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
