// === Hero Health Academy — game/main.js (v3: Daily hooks + Shield + HUD power timers + pause/blur guards) ===
//
// Highlights
// - Wires Daily missions via Progress.notify(...), incl. perfect/golden/fever/group/hydration/plate events
// - Integrates PowerUpSystem v3 (stackable timers + 🛡 shield) and drives HUD power segments (x2/freeze/sweep/shield)
// - MissionSystem (multi-quest) + CoachBridge toasts
// - Blur → pause, focus → resume, result modal show/hide, replay-safe
//
// File location: /HeroHealth/game/main.js  (imports use './core/...')
// Index loads boot.js → dynamic import main.js

import { HUD } from './core/hud.js';
import { PowerUpSystem } from './core/powerup.js';
import { MissionSystem } from './core/mission-system.js';
import { Leaderboard } from './core/leaderboard.js';
import { Progress } from './core/progression.js';

// ---- Optional modes (plug your real modes here) ----
import * as goodjunk from './modes/goodjunk.js';
import * as groups    from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate     from './modes/plate.js';

// ---------- Singletons ----------
const hud      = new HUD();
const power    = new PowerUpSystem();   // (v3 in previous patch: supports x2/freeze/sweep/shield + stacks)
const mission  = new MissionSystem();
const board    = new Leaderboard();
Progress.init();

// Reflect power timers to HUD segments (x2/freeze/sweep/shield)
power.onChange((timers)=> hud.setPowerTimers?.(timers));

// ---------- App State ----------
const State = {
  mode: 'goodjunk',
  diff: 'Normal',
  lang: (localStorage.getItem('hha_lang')||'TH').toUpperCase(),
  seconds: 45,
  paused: false,
  score: 0,
  combo: 0,
  bestCombo: 0,
};

// ---------- SFX helpers (autoplay handled by ui.js unlockOnce) ----------
const SFX = {
  play(id){ try{ const a=document.getElementById(id); a && a.play?.().catch(()=>{}); }catch{} },
  good(){ this.play('sfx-good'); },
  bad(){ this.play('sfx-bad'); },
  perfect(){ this.play('sfx-perfect'); },
  power(){ this.play('sfx-powerup'); }
};

// ---------- Score / combo ----------
function addScore(base){
  const inc = Number(base)||0;
  const extra = (typeof power._boostFn==='function') ? power._boostFn(inc) : 0;
  const newScore = Math.max(0, (State.score|0) + inc + extra);
  State.score = newScore;
  hud.setScore(newScore|0);
  Progress.notify('score_tick', { score: newScore|0 });
}

function setLangFromUI(){
  const uiLang = window.HHA_UI?.getLang?.();
  if (uiLang) {
    State.lang = (String(uiLang).toUpperCase()==='EN' ? 'EN' : 'TH');
    localStorage.setItem('hha_lang', State.lang);
  }
}

// ---------- Event Bus exposed to modes ----------
const CoachBridge = {
  onStart(){ hud.say(State.lang==='TH'?'เริ่มกันเลย!':'Let’s start!', 900); },
  onPerfect(){ hud.toast(State.lang==='TH'?'เยี่ยม!':'Great!', 700); },
  onQuestProgress(txt,cur,need){ hud.toast(`${txt}  ${cur}/${need}`, 800); },
  onQuestDone(){ hud.toast(State.lang==='TH'?'ภารกิจสำเร็จ!':'Mission complete!', 900); },
};

const Bus = {
  sfx: SFX,

  // when user clicks/taps correct item
  hit({ kind='good', points=1, meta } = {}){
    // combo
    State.combo = (State.combo|0) + 1;
    State.bestCombo = Math.max(State.bestCombo|0, State.combo|0);
    Progress.notify('combo_best', { value: State.bestCombo|0 });

    // score
    addScore(points|0);

    // SFX + flags
    if (kind === 'perfect'){ SFX.perfect(); Progress.notify('perfect'); }
    else { SFX.good(); }

    if (meta?.golden){ Progress.notify('golden'); }
    if (meta?.groupRoundDone){ Progress.notify('group_round_done'); }
  },

  // when user misses or clicks a junk/bad
  miss({ meta } = {}){
    State.combo = 0;

    // Shield absorb (PowerUp v3)
    const timers = power.getTimers?.() || {};
    if ((timers.shield|0) > 0){
      hud.toast(State.lang==='TH'?'🛡 กันพลาด!':'🛡 Shielded!', 900);
      SFX.power();
      addScore(2);
      return;
    }

    hud.flashDanger();
    SFX.bad();
  },

  // let modes raise custom flags for daily missions
  flag(type, payload){ Progress.notify(type, payload); },

  // convenience: grant powerups from modes
  power(kind, sec){ power.apply(kind, sec); }
};

// FEVER hooks (modes may call these)
window.onFeverStart = ()=>{ Progress.notify('fever'); };

// Plate/Hydration violation hooks
window.onPlateOverfill = ()=>{ Progress.notify('plate_overfill'); };
window.onHydrationHigh = ()=>{ Progress.notify('hydration_high'); };

// ---------- Engine loop ----------
const Engine = {
  lastTs: 0,
  runner: null,
  update(dt){
    // timeScale from powerups (reserved for spawn speed usage if modes support)
    this.runner?.update?.(dt, Bus);
  }
};

function makeRunner(modeKey){
  const mod = (
    modeKey==='groups'    ? groups :
    modeKey==='hydration' ? hydration :
    modeKey==='plate'     ? plate :
    goodjunk
  );
  // Preferred factory
  if (typeof mod.create === 'function'){
    return mod.create({ hud, coach: CoachBridge, bus: Bus, power, state: State });
  }
  // Legacy adapters
  return {
    start(){ mod.init?.(State, hud, Bus); },
    update(dt, bus){ mod.tick?.(State, dt, hud, bus); },
    cleanup(){ mod.cleanup?.(State, hud); }
  };
}

let _rafId = 0;
function loop(ts){
  if (State.paused){ _rafId = requestAnimationFrame(loop); return; }
  if (!Engine.lastTs) Engine.lastTs = ts;
  const dt = Math.min(0.1, (ts - Engine.lastTs) / 1000);
  Engine.lastTs = ts;
  Engine.update(dt);
  _rafId = requestAnimationFrame(loop);
}
function stopLoop(){ if (_rafId){ cancelAnimationFrame(_rafId); _rafId = 0; } Engine.lastTs = 0; }

// ---------- Per-second ticker ----------
let _secT = 0;
function startSecondTicker(){
  stopSecondTicker();
  _secT = setInterval(()=>{
    if (State.paused) return;

    State.seconds = Math.max(0, (State.seconds|0) - 1);
    hud.setTime(State.seconds|0);

    // mission tick (multi-quest)
    mission.tick(
      State,
      { score: State.score|0 },
      (res)=>{
        if (res?.success){
          hud.toast(State.lang==='TH'?'เควสต์สำเร็จ!':'Quest done!', 900);
          Progress.addMissionDone(State.mode);
        }
      },
      { hud, lang: State.lang }
    );

    if ((State.seconds|0) <= 0){
      endGame();
    }
  }, 1000);
}
function stopSecondTicker(){ if (_secT){ clearInterval(_secT); _secT = 0; } }

// ---------- Game lifecycle ----------
function startGame(){
  // dismiss result modal if visible
  const r = document.getElementById('result') || document.getElementById('resultModal');
  if (r) r.style.display = 'none';

  // Pull user selections
  setLangFromUI();
  State.mode = window.HHA_UI?.getMode?.() || State.mode || 'goodjunk';
  State.diff = window.HHA_UI?.getDiff?.() || State.diff || 'Normal';

  // Reset
  State.seconds = 45;
  State.score = 0;
  State.combo = 0;
  State.bestCombo = 0;
  hud.setScore(0);
  hud.setTime(State.seconds|0);

  // Ensure today’s daily exists and begin run
  Progress.genDaily();
  Progress.beginRun(State.mode, State.diff, State.lang);

  // Missions (3 chips / 45s)
  const run = mission.start(State.mode, { seconds: State.seconds, count: 3, lang: State.lang });
  mission.attachToState(run, State);

  // Reset powerups & HUD segments
  power.dispose();
  hud.setPowerTimers(power.getTimers?.() || {});

  // Swap runner
  try{ Engine.runner?.cleanup?.(); }catch{}
  Engine.runner = makeRunner(State.mode);
  Engine.runner.start?.();

  // Go
  State.paused = false;
  stopLoop(); _rafId = requestAnimationFrame(loop);
  startSecondTicker();
  CoachBridge.onStart();
}

function endGame(){
  // Stop timers/loop
  stopSecondTicker();
  stopLoop();
  try{ Engine.runner?.cleanup?.(); }catch{}

  // Leaderboard save
  board.submit(State.mode, State.diff, State.score|0, { meta:{ seconds:45, bestCombo: State.bestCombo|0 } });

  // Rough accuracy (if the mode doesn’t supply real acc)
  const roughAcc = Math.max(0, Math.min(100, Math.round((State.bestCombo||0) * 3)));
  Progress.endRun({
    score: State.score|0,
    bestCombo: State.bestCombo|0,
    timePlayed: 45,
    acc: roughAcc
  });

  // Show result
  const r = document.getElementById('result') || document.getElementById('resultModal');
  if (r){
    const b = document.getElementById('finalScore');
    if (b) b.textContent = String(State.score|0);
    r.style.display = 'flex';
  }
}

// ---------- Blur/Focus guards ----------
window.onAppBlur  = ()=>{ State.paused = true; };
window.onAppFocus = ()=>{ State.paused = false; };

// ---------- UI bridges ----------
window.onLangSwitch = (lang)=>{ State.lang = (String(lang).toUpperCase()==='EN'?'EN':'TH'); localStorage.setItem('hha_lang', State.lang); };
window.onSoundToggle = function(){ /* handled by ui.js unlock */ };
window.onGfxToggle   = function(){ /* optional */ };

// ---------- Public surface ----------
window.HHA = {
  startGame, endGame,
  applyPower(kind, sec){ power.apply(kind, sec); },
  powers: {
    x2(s=8){ power.apply('x2', s); },
    freeze(s=3){ power.apply('freeze', s); },
    sweep(s=2){ power.apply('sweep', s); },
    shield(s=6){ power.apply('shield', s); }, // 🛡
  },
  // lightweight helpers if a mode wants to bump score/combo explicitly
  addScore, Bus,
};

// (Optional) legacy global start for older UI flows
window.start = (opts)=>{ if (opts?.demoPassed) startGame(); else startGame(); };

// Safety: if ui.js wants to pre-run a sequence
window.preStartFlow = ()=>{};
