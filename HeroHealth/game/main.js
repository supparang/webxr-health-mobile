// === Hero Health Academy — game/main.js (v3.2: Quests integration + Shield + HUD power timers + pause/blur guards) ===
//
// What’s new vs v3:
// - Integrates core/quests.js: live chips on HUD, lang sync, per-second tick, endRun summary
// - Adds event bridges so modes can report: hit/miss/golden/perfect/fever/target cycles/hydration/plate
// - Keeps Daily (Progress), PowerUps v3 (x2/freeze/sweep/shield), MissionSystem (if your modes still use it)
//
// Location: /HeroHealth/game/main.js

import { HUD } from './core/hud.js';
import { PowerUpSystem } from './core/powerup.js';
import { MissionSystem } from './core/mission-system.js';
import { Leaderboard } from './core/leaderboard.js';
import { Progress } from './core/progression.js';
import { Quests } from './core/quests.js';

// ---- Modes (plug your real ones) ----
import * as goodjunk from './modes/goodjunk.js';
import * as groups    from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate     from './modes/plate.js';

// ---------- Singletons ----------
const hud      = new HUD();
const power    = new PowerUpSystem();   // v3: x2/freeze/sweep/shield + stacks
const mission  = new MissionSystem();   // (still used for in-run mini-quests)
const board    = new Leaderboard();
Progress.init();

// Reflect power timers to HUD (x2/freeze/sweep/shield)
power.onChange((timers)=> hud.setPowerTimers?.(timers));
Quests.bindToMain({ hud });

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

// ---------- SFX helpers ----------
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
  State.score = Math.max(0, (State.score|0) + inc + extra);
  hud.setScore(State.score|0);
  Progress.notify('score_tick', { score: State.score|0 });
}

function setLangFromUI(){
  const uiLang = window.HHA_UI?.getLang?.();
  if (uiLang) {
    State.lang = (String(uiLang).toUpperCase()==='EN' ? 'EN' : 'TH');
    localStorage.setItem('hha_lang', State.lang);
    Quests.setLang(State.lang);
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

  // correct hit (kind: 'good'|'perfect'…)
  hit({ kind='good', points=1, meta } = {}){
    State.combo = (State.combo|0) + 1;
    State.bestCombo = Math.max(State.bestCombo|0, State.combo|0);
    Progress.notify('combo_best', { value: State.bestCombo|0 });

    addScore(points|0);

    // SFX + quest events
    if (kind === 'perfect'){ SFX.perfect(); Quests.event('hit', { result:'perfect', comboNow: State.combo|0, meta }); }
    else { SFX.good(); Quests.event('hit', { result:'good', comboNow: State.combo|0, meta }); }

    if (meta?.golden){ Progress.notify('golden'); Quests.event('hit', { result:'good', comboNow: State.combo|0, meta:{...meta, golden:true} }); }
    if (meta?.groupRoundDone){ Progress.notify('group_round_done'); Quests.event('target_cleared'); }
  },

  // miss/junk
  miss({ meta } = {}){
    State.combo = 0;

    // 🛡 shield absorbs one mistake
    const timers = power.getTimers?.() || {};
    if ((timers.shield|0) > 0){
      hud.toast(State.lang==='TH'?'🛡 กันพลาด!':'🛡 Shielded!', 900);
      SFX.power();
      addScore(2);
      // (we still report a hit-ish event so “streak_nomiss” logic in Quests isn’t broken)
      Quests.event('hit', { result:'good', comboNow: 1, meta:{ shielded:true } });
      return;
    }

    hud.flashDanger();
    SFX.bad();
    Quests.event('hit', { result:'bad', comboNow: 0, meta });
  },

  // misc flags from modes → daily & quests
  flag(type, payload){
    Progress.notify(type, payload);
    Quests.event(type, payload);
  },

  // FEVER hooks
  feverStart(){ Progress.notify('fever'); Quests.event('fever', { kind:'start' }); },

  // Groups/Plate helpers for quests
  targetCleared(){ Quests.event('target_cleared'); },
  groupFull(){ Quests.event('group_full'); },             // a food group completed (plate)
  plateGroupFull(){ Quests.event('plate_group_full'); },  // alias

  // Hydration quest bridges
  hydroTick(zone){ Quests.event('hydro_tick', { zone: String(zone).toUpperCase() }); },
  hydroCross(from,to){ Quests.event('hydro_cross', { from:String(from).toUpperCase(), to:String(to).toUpperCase() }); },
  hydroClick(params){ Quests.event('hydro_click', params||{}); },

  // powerups
  power(kind, sec){ power.apply(kind, sec); }
};

// Global hooks (legacy callers still work)
window.onFeverStart     = ()=> Bus.feverStart();
window.onPlateOverfill  = ()=> { Progress.notify('plate_overfill'); };
window.onHydrationHigh  = ()=> { Progress.notify('hydration_high'); };

// ---------- Engine loop ----------
const Engine = {
  lastTs: 0,
  runner: null,
  update(dt){ this.runner?.update?.(dt, Bus); }
};

function makeRunner(modeKey){
  const mod = (
    modeKey==='groups'    ? groups :
    modeKey==='hydration' ? hydration :
    modeKey==='plate'     ? plate :
    goodjunk
  );
  if (typeof mod.create === 'function'){
    return mod.create({ hud, coach: CoachBridge, bus: Bus, power, state: State });
  }
  // legacy shim
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

    // mini-quest (MissionSystem) – still supported
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

    // Quests (new pool of 10 per mode)
    Quests.tick({ score: State.score|0 });

    if ((State.seconds|0) <= 0){
      endGame();
    }
  }, 1000);
}
function stopSecondTicker(){ if (_secT){ clearInterval(_secT); _secT = 0; } }

// ---------- Game lifecycle ----------
function startGame(){
  // hide result if any
  const r = document.getElementById('result') || document.getElementById('resultModal');
  if (r) r.style.display = 'none';

  setLangFromUI();
  State.mode = window.HHA_UI?.getMode?.() || State.mode || 'goodjunk';
  State.diff = window.HHA_UI?.getDiff?.() || State.diff || 'Normal';

  // Reset state
  State.seconds = 45;
  State.score = 0;
  State.combo = 0;
  State.bestCombo = 0;
  hud.setScore(0);
  hud.setTime(State.seconds|0);

  // Daily + profile run begin
  Progress.genDaily();
  Progress.beginRun(State.mode, State.diff, State.lang);

  // In-run mini-missions (MissionSystem)
  const run = mission.start(State.mode, { seconds: State.seconds, count: 3, lang: State.lang });
  mission.attachToState(run, State);

  // Quests pool (10 per mode → 3 picked)
  Quests.setLang(State.lang);
  Quests.beginRun(State.mode, State.diff, State.lang, State.seconds);

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
  stopSecondTicker();
  stopLoop();
  try{ Engine.runner?.cleanup?.(); }catch{}

  // End quests (so “no over”/“no high” etc. can be resolved)
  const questSummary = Quests.endRun({
    score: State.score|0,
    // If your modes track these counters, send them via Bus.flag(...) during play;
    // you can also include them here if you keep them on State.
    overfill: State.overfillCount|0,
    highCount: State.hydrationHighCount|0
  });

  // Leaderboard
  board.submit(State.mode, State.diff, State.score|0, { meta:{ seconds:45, bestCombo: State.bestCombo|0 } });

  // Rough accuracy if mode doesn’t supply
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
window.onLangSwitch = (lang)=>{
  State.lang = (String(lang).toUpperCase()==='EN'?'EN':'TH');
  localStorage.setItem('hha_lang', State.lang);
  Quests.setLang(State.lang);
};
window.onSoundToggle = function(){ /* handled by ui.js unlock */ };
window.onGfxToggle   = function(){ /* optional visual switches */ };

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
  addScore, Bus,
};

// Legacy alias for ui.js flow
window.start = (opts)=>{ startGame(); };
window.preStartFlow = ()=>{};
