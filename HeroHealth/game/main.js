// === Hero Health Academy — game/main.js (v3.3: ScoreSystem v2 integrated + Quests + Shield stacks) ===
//
// Upgrades this build:
// • Replaces ad-hoc scoring with core/score.js (combo/fever aware, power-boost aware)
// • Attaches PowerUpSystem boosts directly to ScoreSystem
// • Keeps Quests/Daily/Leaderboard/MissionSystem working
// • Shield absorbs “bad” once per event (with stacked-timer support from powerup v3)
// • Legacy shims: window.HHA.addScore(...) still works (routes to ScoreSystem.add)
//
// Place at: /HeroHealth/game/main.js

import { HUD } from './core/hud.js';
import { PowerUpSystem } from './core/powerup.js';
import { MissionSystem } from './core/mission-system.js';
import { Leaderboard } from './core/leaderboard.js';
import { Progress } from './core/progression.js';
import { Quests } from './core/quests.js';
import { ScoreSystem } from './core/score.js';

// ---- Modes ----
import * as goodjunk from './modes/goodjunk.js';
import * as groups    from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate     from './modes/plate.js';

// ---------- Singletons ----------
const hud      = new HUD();
const power    = new PowerUpSystem();   // (x2/freeze/sweep/shield + stacks)
const mission  = new MissionSystem();
const board    = new Leaderboard();
Progress.init();
Quests.bindToMain({ hud });

// Score system — core/score.js v2
const score = new ScoreSystem();
// Wire PowerUpSystem → ScoreSystem (x2/flat boost)
power.attachToScore(score);

// Reflect power timers to HUD
power.onChange((timers)=> hud.setPowerTimers?.(timers));

// ---------- App State ----------
const State = {
  mode: 'goodjunk',
  diff: 'Normal',
  lang: (localStorage.getItem('hha_lang')||'TH').toUpperCase(),
  seconds: 45,
  paused: false,

  // fever model (0..1), optional: quick decay tick
  fever01: 0,
};

// ---------- SFX ----------
const SFX = {
  play(id){ try{ const a=document.getElementById(id); a && a.play?.().catch(()=>{}); }catch{} },
  good(){ this.play('sfx-good'); },
  bad(){ this.play('sfx-bad'); },
  perfect(){ this.play('sfx-perfect'); },
  power(){ this.play('sfx-powerup'); }
};

// ---------- Score ↔ HUD/Quests/Progress bridges ----------
score.setHandlers({
  change: (value, { delta, meta })=>{
    hud.setScore(value|0);
    // Keep State combo mirrors for any legacy code
    State.combo = score.combo|0;
    State.bestCombo = score.bestCombo|0;
    // Feed Quests reach_score via per-second tick; still useful to emit a light ping
    Progress.emit('score_tick', { score:value|0, delta:delta|0, kind: meta?.kind });
  }
});

// If you have a FEVER gauge, expose it here so ScoreSystem can add small bonus (0..1)
score.setFeverGetter(()=> State.fever01 || 0);

// If your core runner manages its own combo counter, you can pipe it here.
// For now we use ScoreSystem’s own internal combo as truth:
score.setComboGetter(()=> score.combo|0);

// ---------- UI / Language ----------
function setLangFromUI(){
  const uiLang = window.HHA_UI?.getLang?.();
  if (uiLang) {
    State.lang = (String(uiLang).toUpperCase()==='EN' ? 'EN' : 'TH');
    localStorage.setItem('hha_lang', State.lang);
    Quests.setLang(State.lang);
  }
}

// ---------- Coach Bridge ----------
const CoachBridge = {
  onStart(){ hud.say(State.lang==='TH'?'เริ่มกันเลย!':'Let’s start!', 900); },
  onPerfect(){ hud.toast(State.lang==='TH'?'เยี่ยม!':'Great!', 700); },
  onQuestProgress(txt,cur,need){ hud.toast(`${txt}  ${cur}/${need}`, 800); },
  onQuestDone(){ hud.toast(State.lang==='TH'?'ภารกิจสำเร็จ!':'Mission complete!', 900); },
};

// ---------- Gameplay Event Bus (for modes) ----------
const Bus = {
  sfx: SFX,

  // Unified hit
  hit({ kind='good', meta } = {}){
    // Score first (handles combo)
    score.addKind(kind, meta || {});
    // SFX + quest ping
    if (kind === 'perfect'){ SFX.perfect(); }
    else { SFX.good(); }
    Quests.event('hit', { result: kind, comboNow: score.combo|0, meta });

    // Extras
    if (meta?.golden){ Progress.emit('golden'); }
    if (meta?.groupRoundDone){ Quests.event('target_cleared'); }
  },

  // Miss / junk
  miss({ meta } = {}){
    // 🛡 shield: absorb exactly one “bad” without combo reset
    const timers = power.getTimers?.() || {};
    if ((timers.shield|0) > 0){
      hud.toast(State.lang==='TH'?'🛡 กันพลาด!':'🛡 Shielded!', 900);
      SFX.power();
      // Give tiny consolation and keep streak: treat as a soft good
      score.add(2, { kind:'shield', ...meta });
      Quests.event('hit', { result:'good', comboNow: score.combo|0, meta:{ ...meta, shielded:true } });
      return;
    }

    hud.flashDanger();
    SFX.bad();
    score.addKind('bad', meta || {});                       // penalty + combo reset
    Quests.event('hit', { result:'bad', comboNow: score.combo|0, meta });
  },

  // Generic flags → Daily/Quests
  flag(type, payload){ Progress.emit(type, payload); Quests.event(type, payload); },

  // FEVER
  feverStart(){
    Progress.emit('fever');
    Quests.event('fever', { kind:'start' });
    State.fever01 = 1;
  },

  // Groups/Plate helpers
  targetCleared(){ Quests.event('target_cleared'); },
  groupFull(){ Quests.event('group_full'); },
  plateGroupFull(){ Quests.event('plate_group_full'); },

  // Hydration
  hydroTick(zone){ Quests.event('hydro_tick', { zone:String(zone).toUpperCase() }); },
  hydroCross(from,to){ Quests.event('hydro_cross', { from:String(from).toUpperCase(), to:String(to).toUpperCase() }); },
  hydroClick(params){ Quests.event('hydro_click', params||{}); },

  // Powerups
  power(kind, sec){ power.apply(kind, sec); },
};

// Legacy globals (if modes still call these)
window.onFeverStart     = ()=> Bus.feverStart();
window.onPlateOverfill  = ()=> { Progress.emit('plate_overfill'); };
window.onHydrationHigh  = ()=> { Progress.emit('hydration_high'); };

// ---------- Engine loop ----------
const Engine = {
  lastTs: 0,
  runner: null,
  update(dt){
    // quick FEVER decay (optional): ~8s fade
    if (State.fever01>0){ State.fever01 = Math.max(0, State.fever01 - dt/8); }
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

    // time
    State.seconds = Math.max(0, (State.seconds|0) - 1);
    hud.setTime(State.seconds|0);

    // legacy mini-missions (MissionSystem)
    mission.tick(
      State,
      { score: score.get()|0 },
      (res)=>{
        if (res?.success){
          hud.toast(State.lang==='TH'?'เควสต์สำเร็จ!':'Quest done!', 900);
          Progress.addMissionDone(State.mode);
        }
      },
      { hud, lang: State.lang }
    );

    // New quests
    Quests.tick({ score: score.get()|0 });

    if ((State.seconds|0) <= 0){
      endGame();
    }
  }, 1000);
}
function stopSecondTicker(){ if (_secT){ clearInterval(_secT); _secT = 0; } }

// ---------- Game lifecycle ----------
function startGame(){
  // hide result
  const r = document.getElementById('result') || document.getElementById('resultModal');
  if (r) r.style.display = 'none';

  setLangFromUI();
  State.mode = window.HHA_UI?.getMode?.() || State.mode || 'goodjunk';
  State.diff = window.HHA_UI?.getDiff?.() || State.diff || 'Normal';

  // Reset state
  State.seconds = 45;
  State.fever01 = 0;
  score.reset();                 // resets value+combo
  hud.setScore(0);
  hud.setTime(State.seconds|0);

  // Daily + profile
  Progress.genDaily();
  Progress.beginRun(State.mode, State.diff, State.lang);

  // In-run mini missions
  const run = mission.start(State.mode, { seconds: State.seconds, count: 3, lang: State.lang });
  mission.attachToState(run, State);

  // Quests pool (10 per mode → pick 3)
  Quests.setLang(State.lang);
  Quests.beginRun(State.mode, State.diff, State.lang, State.seconds);

  // Reset powerups & HUD bar
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

  // End quests (resolve “no over / no high” types)
  Quests.endRun({
    score: score.get()|0,
    overfill: State.overfillCount|0,
    highCount: State.hydrationHighCount|0
  });

  // Leaderboard
  board.submit(State.mode, State.diff, score.get()|0, {
    meta:{ seconds:45, bestCombo: score.bestCombo|0 }
  });

  // Accuracy (fallback heuristic if modes don’t supply)
  const roughAcc = Math.max(0, Math.min(100, Math.round((score.bestCombo||0) * 3)));
  Progress.endRun({
    score: score.get()|0,
    bestCombo: score.bestCombo|0,
    timePlayed: 45,
    acc: roughAcc
  });

  // Result UI
  const r = document.getElementById('result') || document.getElementById('resultModal');
  if (r){
    const b = document.getElementById('finalScore');
    if (b) b.textContent = String(score.get()|0);
    r.style.display = 'flex';
  }
}

// ---------- Blur/Focus ----------
window.onAppBlur  = ()=>{ State.paused = true;  };
window.onAppFocus = ()=>{ State.paused = false; };

// ---------- UI bridges ----------
window.onLangSwitch = (lang)=>{
  State.lang = (String(lang).toUpperCase()==='EN'?'EN':'TH');
  localStorage.setItem('hha_lang', State.lang);
  Quests.setLang(State.lang);
};
window.onSoundToggle = function(){ /* handled by ui.js unlock */ };
window.onGfxToggle   = function(){ /* optional visuals */ };

// ---------- Public surface / legacy shims ----------
window.HHA = {
  startGame, endGame,
  // Legacy: direct score add still works
  addScore(n=0, meta){ score.add(n|0, meta||{}); },
  applyPower(kind, sec){ power.apply(kind, sec); },
  powers: {
    x2(s=8){ power.apply('x2', s); },
    freeze(s=3){ power.apply('freeze', s); },
    sweep(s=2){ power.apply('sweep', s); },
    shield(s=6){ power.apply('shield', s); }, // 🛡
  },
  // expose some read‐onlys for HUD/debug
  get score(){ return score.get(); },
  get combo(){ return score.combo|0; },
  get bestCombo(){ return score.bestCombo|0; },
};

// Legacy alias for ui.js flow
window.start = ()=> startGame();
window.preStartFlow = ()=>{};
