// === game/main.js (Option B pathing: imports from ./core/* under /game/) ===
import { sfx as SFX } from './core/sfx.js';
import { Engine, FX } from './core/engine.js';
import { ScoreSystem } from './core/score.js';
import { PowerUpSystem } from './core/powerup.js';

// Modes
import * as goodjunk from './modes/goodjunk.js';
import * as groups from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate from './modes/plate.js';

const MODS = { goodjunk, groups, hydration, plate };

// ---------- Globals ----------
const engine = new Engine();
engine.sfx = SFX;
SFX.loadIds(['sfx-good','sfx-bad','sfx-perfect','sfx-tick','sfx-powerup']);

const score = new ScoreSystem();
const power = new PowerUpSystem();
power.onChange(updatePowerBar);
power.attachToScore(score);

let state = {
  mode: 'goodjunk',
  diff: 'Normal',
  running: false,
  raf: 0,
  lastT: 0,
  // for legacy modes
  legacy: null,
  // for new create()-style modes
  ctrl: null
};

const $ = (s)=>document.querySelector(s);
const modeBadge = $('#modeBadge');
const diffBadge = $('#diffBadge');
const scoreVal  = $('#scoreVal');
const menuBar   = $('#menuBar');

// ---------- HUD helpers ----------
function toast(msg) {
  const el = $('#toast'); if (!el) return;
  el.textContent = msg; el.classList.add('show');
  setTimeout(()=>{ try{ el.classList.remove('show'); }catch{} }, 900);
}
function updatePowerBar() {
  const timers = power.getCombinedTimers();
  const any = Math.max(timers.x2, timers.freeze, timers.sweep, timers.shield) > 0 ? 1 : 0;
  const pct = Math.min(100, (timers.x2*10 + timers.freeze*15 + timers.sweep*12 + timers.shield*8));
  const fill = $('#powerFill');
  if (fill){ fill.style.width = (any ? Math.max(8, pct) : 0) + '%'; }
}
function setActiveBtn(groupSel, value, attr) {
  document.querySelectorAll(groupSel).forEach(el=>{
    if (el.dataset[attr] === value) el.classList.add('active');
    else el.classList.remove('active');
  });
}

// ---------- Bus: unify events from modes ----------
const Bus = {
  hit(payload={}) {
    // payload: { kind:'good'|'perfect'|'golden', points, ui:{x,y}, meta, comboNow? }
    const k = payload.kind || 'good';
    const meta = payload.meta || {};
    // score:
    if (k === 'golden') {
      score.addKind('perfect', { ...meta, golden:true, comboNow: score.combo });
      power.apply('x2', 6);
      engine.sfx.perfect();
      FX.popText('+BONUS ✨', payload.ui);
    } else if (k === 'perfect') {
      score.addKind('perfect', { ...meta, comboNow: score.combo });
      engine.sfx.perfect();
    } else if (k === 'good') {
      score.addKind('good', { ...meta, comboNow: score.combo });
      engine.sfx.good();
    } else {
      score.addKind('ok', { ...meta, comboNow: score.combo });
    }
    scoreVal.textContent = String(score.get());
  },
  miss(payload={}) {
    score.addKind('bad', payload.meta || {});
    engine.sfx.bad();
    scoreVal.textContent = String(score.get());
    // small red flash
    try{
      document.body.classList.add('flash-danger');
      setTimeout(()=>document.body.classList.remove('flash-danger'),160);
    }catch{}
  },
  power(kind) {
    power.apply(kind);
    engine.sfx.power();
    toast('Power: ' + kind);
  }
};

// ---------- Runner ----------
function loop(ts) {
  if (!state.running) return;
  const t = ts || performance.now();
  const dt = state.lastT ? Math.min(0.1, (t - state.lastT)/1000) : 0.016;
  state.lastT = t;

  try {
    if (state.ctrl && typeof state.ctrl.update === 'function') {
      state.ctrl.update(dt, Bus);
    } else if (state.legacy && typeof state.legacy.update === 'function') {
      state.legacy.update(dt, Bus);
    }
  } catch(e) {
    console.warn('update error', e);
  }
  state.raf = requestAnimationFrame(loop);
}

function stopGame() {
  state.running = false;
  cancelAnimationFrame(state.raf);
  power.dispose();
  score.reset();
  try{ state.ctrl && state.ctrl.stop && state.ctrl.stop(); }catch{}
  try{ state.legacy && state.legacy.stop && state.legacy.stop(); }catch{}
  try{ $('#spawnHost').innerHTML=''; }catch{}
}

function startGame() {
  stopGame();
  // HUD badges
  modeBadge.textContent = state.mode;
  diffBadge.textContent = state.diff;
  scoreVal.textContent  = '0';

  // instantiate controller (support both APIs)
  const mod = MODS[state.mode];
  state.ctrl = null;
  state.legacy = null;

  // newer API: create({engine,hud,coach})
  if (mod && typeof mod.create === 'function') {
    state.ctrl = mod.create({ engine });
    state.ctrl.start?.({ difficulty: state.diff });
  } else if (mod && typeof mod.start === 'function' && typeof mod.update === 'function') {
    // legacy API: start(cfg), update(dt, bus)
    state.legacy = mod;
    state.legacy.start({ difficulty: state.diff });
  } else {
    alert('Mode not available: ' + state.mode);
    return;
  }

  // hide menu and run
  menuBar.style.display = 'none';
  state.running = true;
  state.lastT = 0;
  power.dispose(); // reset power bar & timers
  state.raf = requestAnimationFrame(loop);
}

// ---------- Menu interactions ----------
(function bindMenu(){
  const mb = menuBar;
  const onHit = (ev) => {
    const t = ev.target.closest('.btn');
    if (!t) return;
    if (t.dataset.mode) {
      state.mode = t.dataset.mode;
      setActiveBtn('.btn[data-mode]', state.mode, 'mode');
      modeBadge.textContent = state.mode;
      return;
    }
    if (t.dataset.diff) {
      state.diff = t.dataset.diff;
      setActiveBtn('.btn[data-diff]', state.diff, 'diff');
      diffBadge.textContent = state.diff;
      return;
    }
    if (t.dataset.action === 'start') {
      startGame();
      return;
    }
    if (t.dataset.action === 'howto') {
      alert('แตะของดี หลีกเลี่ยงของไม่ดี • Groups/Plate: เลือกให้ตรงหมวด • Hydration: รักษา 45–65%');
      return;
    }
    if (t.dataset.action === 'sound') {
      SFX.setEnabled(!SFX.isEnabled());
      toast('Sound: ' + (SFX.isEnabled() ? 'ON' : 'OFF'));
      return;
    }
  };
  ['click','pointerup','touchend'].forEach(e => mb.addEventListener(e, onHit, { passive:true }));
})();

// ---------- Mobile sound unlock on first gesture ----------
window.addEventListener('pointerdown', ()=>SFX.unlock(), { once:true, passive:true });

// ---------- Debug helpers (optional) ----------
try { window.HHA = { start: startGame, stop: stopGame, setMode:(m)=>state.mode=m, setDiff:(d)=>state.diff=d, score, power }; } catch {}
