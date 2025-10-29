// === Hero Health Academy — game/main.js (Shield-ready build) ===
// - Integrates PowerUpSystem v3 (x2/freeze/sweep/shield) with HUD v3.1
// - Visual shield overlay (blue→violet glow) + penalty absorb
// - Safe DOM-spawn factory for modes (goodjunk, groups)
// - Pause on blur, strong replay, and simple result modal

// ----- Imports -----
import { HUD } from './core/hud.js';
import { PowerUpSystem } from './core/powerup.js';
import { MissionSystem } from './core/mission-system.js';
import { Leaderboard } from './core/leaderboard.js';

// (Optional) tiny FX helper used by modes via engine.fx.popText(...)
const FX = {
  popText(txt, { x, y, ms = 720 } = {}) {
    const el = document.createElement('div');
    el.textContent = txt;
    Object.assign(el.style, {
      position: 'fixed', left: Math.max(0, x - 10) + 'px', top: Math.max(0, y - 10) + 'px',
      font: '900 16px ui-rounded', color: '#eaf6ff', textShadow: '0 2px 10px #000a',
      pointerEvents: 'none', transform: 'translate(-50%,-60%) scale(1)', transition: 'all .72s ease',
      zIndex: 120
    });
    document.body.appendChild(el);
    requestAnimationFrame(()=>{
      el.style.transform = 'translate(-50%,-90%) scale(1.08)';
      el.style.opacity = '0';
    });
    setTimeout(()=>{ try{ el.remove(); }catch{} }, ms);
  }
};

// ----- Modes (factory adapters) -----
import * as goodjunk from './modes/goodjunk.js';
import * as groups    from './modes/groups.js';
// (hydration / plate สามารถเสียบเพิ่มเหมือนกันได้เมื่อพร้อม)

// ----- Globals / State -----
const Engine = {
  running: false,
  lastTs: 0,
  fx: FX,
  update(dt) { // per-frame update called by RAF loop
    // mode runner update will be attached on start
    if (this.runner && typeof this.runner.update === 'function') {
      this.runner.update(dt, Bus);
    }
  }
};

const State = {
  seconds: 45,
  score: 0,
  lang: (localStorage.getItem('hha_lang') || 'TH').toUpperCase(),
  mode: 'goodjunk',
  diff: (window.__HHA_DIFF || 'Normal'),
  paused: false
};

// ----- Systems -----
const hud     = new HUD();
const power   = new PowerUpSystem();   // includes timers + onChange
const mission = new MissionSystem();
const board   = new Leaderboard();

// sync HUD with power timers
power.onChange(timers => hud.setPowerTimers(timers));

// ----- Shield Overlay (visual & feedback) -----
const ShieldFX = (() => {
  // style once
  if (!document.getElementById('hha-shield-css')) {
    const css = document.createElement('style');
    css.id = 'hha-shield-css';
    css.textContent = `
      #shieldOverlay{
        position:fixed; inset:0; pointer-events:none; z-index:94; display:none;
        background: radial-gradient(80% 60% at 50% 40%, rgba(160,180,255,.18), rgba(160,140,255,.08) 60%, transparent 70%);
        mix-blend-mode: screen;
      }
      #shieldOverlay.active{ display:block; animation: hhaShieldPulse 1.2s ease-in-out; }
      @keyframes hhaShieldPulse{
        0%{ opacity:.00; filter:saturate(1.0) blur(0px); }
        25%{ opacity:.40; filter:saturate(1.08) blur(0px); }
        60%{ opacity:.22; }
        100%{ opacity:.00; }
      }
    `;
    document.head.appendChild(css);
  }
  // element once
  let el = document.getElementById('shieldOverlay');
  if (!el) { el = document.createElement('div'); el.id = 'shieldOverlay'; document.body.appendChild(el); }

  function flash() {
    el.classList.remove('active'); // restart
    // force reflow
    void el.offsetWidth;
    el.classList.add('active');
    setTimeout(()=> el.classList.remove('active'), 1200);
  }
  return { flash };
})();

// ----- Simple SFX proxy (optional) -----
const SFX = {
  play(id){ try{ document.querySelector('#'+id)?.play?.(); }catch{} },
  good(){ this.play('sfx-good'); },
  bad(){ this.play('sfx-bad'); },
  perfect(){ this.play('sfx-perfect'); },
  power(){ this.play('sfx-powerup'); }
};

// ----- Result Modal helpers -----
function showResult() {
  const root = document.getElementById('result');
  if (!root) return;
  const b = document.getElementById('finalScore'); if (b) b.textContent = String(State.score|0);
  root.style.display = 'flex';
}
function hideResult(){
  const root = document.getElementById('result'); if (root) root.style.display='none';
}

// ----- Bus: events from modes to systems -----
const Bus = {
  sfx: SFX,

  hit({ kind, points = 0, ui, meta }) {
    // Score bonus from PowerUps (×2/boost) is applied via add
    addScore(points|0);
    if (kind === 'perfect') SFX.perfect(); else SFX.good();

    // Missions
    mission.onEvent('good', { count: 1 }, State);
    if (meta?.isTarget) mission.onEvent('target_hit', { count: 1 }, State);
  },

  miss({ meta } = {}) {
    // If shield is active → absorb penalty, flash overlay, DO NOT punish
    const timers = power.getTimers?.() || {};
    const shieldOn = (timers.shield|0) > 0;
    if (shieldOn) {
      ShieldFX.flash();
      SFX.power();
      hud.toast(State.lang==='TH' ? '🛡 กันพลาด!' : '🛡 Shielded!');
      // Optional: tiny consolation points
      addScore(2);
      return;
    }

    // Normal penalty feedback
    hud.flashDanger();
    SFX.bad();
    mission.onEvent('miss', { count: 1 }, State);
    // soft penalty only (no hard -score to keep gameplay friendly)
    // If you want to deduct: addScore(-5);
  }
};

// ----- Score helpers -----
function addScore(base) {
  const boost = (typeof power._boostFn === 'function') ? power._boostFn(base) : 0;
  State.score = Math.max(0, (State.score|0) + base + boost);
  hud.setScore(State.score|0);
}

// ----- Game Loop -----
function loop(ts) {
  if (!Engine.running || State.paused) return;
  if (!Engine.lastTs) Engine.lastTs = ts;
  const dt = Math.min(0.1, (ts - Engine.lastTs) / 1000);
  Engine.lastTs = ts;

  Engine.update(dt);

  requestAnimationFrame(loop);
}

// ----- Timer (seconds) -----
let _secT = 0;
function startSecondTicker() {
  stopSecondTicker();
  _secT = setInterval(() => {
    if (State.paused) return;

    // countdown
    State.seconds = Math.max(0, (State.seconds|0) - 1);
    hud.setTime(State.seconds|0);

    // mission evaluation tick
    mission.tick(State, { score: State.score|0 }, (res)=>{
      if (res?.success) hud.toast(State.lang==='TH' ? 'เควสต์สำเร็จ!' : 'Quest done!', 1000);
      else hud.toast(State.lang==='TH' ? 'พลาดเควสต์' : 'Quest failed', 900);
    }, { hud, lang: State.lang });

    // time up
    if ((State.seconds|0) <= 0) {
      endGame();
    }
  }, 1000);
}
function stopSecondTicker() {
  if (_secT) { clearInterval(_secT); _secT = 0; }
}

// ----- Runner factory per mode -----
function makeRunner(modeKey) {
  const mod = (modeKey==='groups') ? groups
            : (modeKey==='goodjunk') ? goodjunk
            : goodjunk;

  if (typeof mod.create === 'function') {
    return mod.create({ engine: Engine, hud, coach: CoachBridge });
  }
  // legacy fallback
  return {
    start(){ mod.init?.(State, hud); },
    update(dt, bus){ mod.tick?.(State); },
    cleanup(){ mod.cleanup?.(State, hud); }
  };
}

// ----- Coach bridge (HUD-based minimal cues) -----
const CoachBridge = {
  onStart(){ hud.say(State.lang==='TH'?'เริ่มเลย!':'Let’s go!', 900); },
  onGood(){ /* optional micro cue */ },
  onPerfect(){ hud.toast(State.lang==='TH'?'เยี่ยม!':'Great!', 700); },
  onBad(){ hud.dimPenalty(); },
  onQuestProgress(txt, cur, need){ hud.toast(`${txt}  ${cur}/${need}`, 700); },
  onQuestDone(){ hud.toast(State.lang==='TH'?'ภารกิจครบ!':'Mission complete!', 900); },
  onQuestFail(){ hud.toast(State.lang==='TH'?'ภารกิจล้มเหลว':'Mission failed', 900); }
};

// ----- Start / End flow -----
function startGame({ demoPassed } = {}) {
  hideResult();

  // reset base state
  State.seconds = 45;
  State.score = 0;
  State.lang = (window.HHA_UI?.getLang?.() || State.lang || 'TH').toUpperCase();
  State.mode = (window.HHA_UI?.getMode?.() || State.mode || 'goodjunk');
  State.diff = (window.HHA_UI?.getDiff?.() || State.diff || 'Normal');

  hud.setScore(0);
  hud.setTime(State.seconds|0);

  // missions (3 chips by default)
  const run = mission.start(State.mode, { seconds: State.seconds, count: 3, lang: State.lang });
  mission.attachToState(run, State);

  // power reset
  power.dispose();
  hud.setPowerTimers(power.getTimers());

  // runner
  if (Engine.runner && typeof Engine.runner.cleanup === 'function') {
    try { Engine.runner.cleanup(); } catch {}
  }
  Engine.runner = makeRunner(State.mode);
  Engine.runner.start?.();

  // begin
  State.paused = false;
  Engine.running = true;
  Engine.lastTs = 0;
  requestAnimationFrame(loop);
  startSecondTicker();
}

// Called by timer or UI
function endGame() {
  Engine.running = false;
  stopSecondTicker();
  State.paused = false;

  // cleanup
  try { Engine.runner?.cleanup?.(); } catch {}

  // save to board
  board.submit(State.mode, State.diff, State.score|0, { meta:{ seconds: 45 } });

  showResult();
}

// ----- Public hooks for UI / boot.js -----
window.HHA = {
  startGame,
  endGame,
  // Power-ups from anywhere (modes / UI)
  applyPower(kind, sec){ power.apply(kind, sec); },
  // Example helpers used by modes to test powers:
  powers: {
    x2(s=8){ power.apply('x2', s); },
    freeze(s=3){ power.apply('freeze', s); },
    sweep(s=2){ power.apply('sweep', s); },
    shield(s=6){ power.apply('shield', s); }
  }
};

// ----- Blur/pause handling (requested earlier) -----
window.onAppBlur  = function(){ State.paused = true; };
window.onAppFocus = function(){ State.paused = false; };

// Language toggle from UI
window.onLangSwitch = function(lang){
  State.lang = (String(lang).toUpperCase()==='EN'?'EN':'TH');
};

// (Optional) Sound/GFX toggles if needed in future
window.onSoundToggle = function(){ /* wire to your audio mixer */ };
window.onGfxToggle   = function(){ /* wire to your postFX */ };

// Strong restart from UI
window.end = function(replay){
  try { endGame(); } catch {}
  if (replay) setTimeout(()=> startGame({ demoPassed:true }), 60);
};

// Expose shield FX test (debug)
// window.__testShield = ()=>{ power.apply('shield', 6); ShieldFX.flash(); };

// Auto-start if UI already ran the tutorial path
// (boot/ui will call HHA.startGame(); no-op if user clicks START)
