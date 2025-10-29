// === Hero Health Academy — game/main.js (Final DOM-spawn factory, resilient) ===
// - Plugs into boot.js dynamic loader
// - Works with ui.js startFlow() / toggles
// - DOM-first spawn pipeline (no WebGL dependency) with Engine FX helpers
// - Integrates MissionSystem + ScoreSystem + PowerUpSystem + Leaderboard
// - Safe across missing modules / optional features

/* ---------------- Imports ---------------- */
import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { Engine }           from './core/engine.js';
import { HUD }              from './core/hud.js';
import { Coach }            from './core/coach.js';
import { SFX }              from './core/sfx.js';
import { ScoreSystem }      from './core/score.js';
import { PowerUpSystem }    from './core/powerup.js';
import { MissionSystem }    from './core/mission-system.js';
import { Leaderboard }      from './core/leaderboard.js';

import * as mode_goodjunk   from './modes/goodjunk.js';
import * as mode_groups     from './modes/groups.js';
// (ถ้ามี): import * as mode_hydration from './modes/hydration.js';
// (ถ้ามี): import * as mode_plate     from './modes/plate.js';

/* ---------------- Globals & guards ---------------- */
window.__HHA_BOOT_OK = window.__HHA_BOOT_OK || 'main';
const $  = (s)=>document.querySelector(s);
const now = ()=> performance?.now?.() || Date.now();

function safeText(sel, v){ const el=$(sel); if (el) el.textContent = String(v); }

/* ---------------- Registry: modes → factory.create(...) ---------------- */
const MODES = {
  goodjunk : mode_goodjunk,
  groups   : mode_groups,
  // hydration: mode_hydration,
  // plate    : mode_plate,
};

/* ---------------- Systems ---------------- */
const engine   = new Engine(THREE, $('#c'));
const hud      = new HUD({ root: $('#hudWrap'), chipsRoot: $('#questChips') });
const coach    = new Coach({ root: $('#coachHUD'), text: $('#coachText') });
const sfx      = new SFX({
  good:'#sfx-good', bad:'#sfx-bad', perfect:'#sfx-perfect',
  tick:'#sfx-tick', power:'#sfx-powerup', bgm:'#bgm-main'
});
const scorer   = new ScoreSystem();
const powers   = new PowerUpSystem();
const missions = new MissionSystem();
const board    = new Leaderboard();

/* ---------------- State ---------------- */
const HHA = {
  running: false,
  paused: false,
  modeKey: 'goodjunk',
  diff: 'Normal',
  lang: 'TH',
  timeTotal: 45,
  timeLeft: 45,

  loop: { id: 0, last: 0 },
  dtAcc: 0,

  modeInst: null,   // { start, stop, update(dt,Bus), cleanup, onClick? }
  Bus: null,        // event bridge
  state: null,      // per-mode runtime state mirror
  score: scorer,    // alias
};

window.HHA = window.HHA || {};
Object.assign(window.HHA, {
  startGame,
  end: hardEnd,
  getScore: ()=>scorer?.score||0,
});

/* ---------------- UI wiring (from ui.js) ---------------- */
function captureUI(){
  try {
    const ui = window.HHA_UI;
    HHA.modeKey = ui?.getMode?.() || document.body.dataset.mode || 'goodjunk';
    HHA.diff    = ui?.getDiff?.() || document.body.dataset.diff  || 'Normal';
    HHA.lang    = ui?.getLang?.() || (document.documentElement.dataset?.hhaLang||'TH');
    document.body.dataset.mode = HHA.modeKey;
    document.body.dataset.diff = HHA.diff;
  } catch {}
  // time: 45s baseline (อาจปรับจาก diff)
  HHA.timeTotal = (HHA.diff==='Easy') ? 50 : (HHA.diff==='Hard' ? 40 : 45);
  HHA.timeLeft  = HHA.timeTotal;
  safeText('#time', HHA.timeLeft);
}

/* ---------------- Bus (Mode ↔ Core) ---------------- */
function makeBus(){
  const Bus = {
    sfx,
    hit({ kind='good', points=10, ui, meta }){
      // add score
      scorer.add(points);
      safeText('#score', scorer.score);

      // missions counters
      if (HHA.modeKey==='groups'){
        if (meta?.isTarget) missions.onEvent('target_hit', {count:1}, HHA.state);
        else missions.onEvent('wrong_group', {count:1}, HHA.state);
      } else if (HHA.modeKey==='goodjunk'){
        if (kind==='good' || kind==='perfect') missions.onEvent('good', {count:1}, HHA.state);
      }
      // coach micro cues
      if (kind==='perfect') coach.onPerfect?.(); else coach.onGood?.();
    },
    miss({ meta }={}){
      missions.onEvent('miss', {count:1}, HHA.state);
      coach.onBad?.(); try{ sfx.bad(); }catch{}
    },
    addTime(sec=1){
      HHA.timeLeft = Math.max(0, Math.min(999, HHA.timeLeft + (sec|0)));
      safeText('#time', HHA.timeLeft);
    },
    power(name){
      try { sfx.power(); }catch{}
      if (name==='x2'){ (MODES[HHA.modeKey]?.powers?.x2Target || (()=>{}))(); }
      if (name==='freeze'){ (MODES[HHA.modeKey]?.powers?.freezeTarget || (()=>{}))(); }
      if (name==='magnet'){ (MODES[HHA.modeKey]?.powers?.magnetNext || (()=>{}))(); }
    }
  };
  return Bus;
}

/* ---------------- Start / Stop ---------------- */
function startGame(opts = {}){
  try{
    captureUI();

    // Reset systems
    scorer.reset();
    powers.reset?.();
    HHA.timeLeft = Number.isFinite(+opts.seconds) ? Math.max(10, +opts.seconds) : HHA.timeTotal;
    safeText('#score', 0);
    safeText('#time', HHA.timeLeft);

    // Build per-mode instance
    const mod = MODES[HHA.modeKey];
    if (!mod || typeof mod.create!=='function') throw new Error(`Mode factory missing: ${HHA.modeKey}`);
    HHA.Bus   = makeBus();
    HHA.state = { difficulty: HHA.diff, lang: HHA.lang, ctx: {} };
    HHA.modeInst?.cleanup?.();
    HHA.modeInst = mod.create({ engine, hud, coach });

    // Missions (multi) attach
    const run = missions.start(HHA.modeKey, { seconds: HHA.timeLeft, count: 3, lang: HHA.lang });
    missions.attachToState(run, HHA.state);
    hud.setQuestChips?.([]); // clear first render

    // HUD coach
    coach.onStart?.();
    // tiny kickoff tick for chips
    missions.tick(HHA.state, scorer, (res)=>{}, { hud, coach, lang: HHA.lang });

    // Start mode
    HHA.modeInst.start?.();

    // Loop
    HHA.running = true; HHA.paused = false;
    HHA.loop.last = now();
    loopStep();

    // One-shot cursor FX
    try { engine.fx.cursorBurst(['✨','⭐']); }catch{}
  } catch (err){
    console.error('[HHA] startGame failed:', err);
    try { window.HHA_BOOT?.reportError?.(err); } catch {}
    throw err;
  }
}

function hardEnd(fromRestart=false){
  // Stop loop + cleanup
  HHA.running = false; HHA.paused = false;
  if (HHA.loop.id){ cancelAnimationFrame(HHA.loop.id); HHA.loop.id=0; }
  HHA.modeInst?.cleanup?.();
  missions.stop(HHA.state);
  coach.onEnd?.();

  // Leaderboard
  try {
    const item = board.submit(HHA.modeKey, HHA.diff, scorer.score, { meta:{ duration:HHA.timeTotal, timeLeft:HHA.timeLeft } });
    console.debug('[Leaderboard submit]', item);
  } catch{}

  // Result UI
  if (!fromRestart){
    const root = $('#result') || $('#resultModal');
    if (root){
      safeText('#finalScore', scorer.score|0);
      root.style.display = 'flex';
    }
  }
}

/* ---------------- Game Loop ---------------- */
function loopStep(){
  if (!HHA.running) return;
  const t = now(), dt = Math.min(48, t - (HHA.loop.last||t)); // clamp dt
  HHA.loop.last = t;

  if (!HHA.paused){
    // countdown (once/sec)
    HHA.dtAcc += dt;
    while (HHA.dtAcc >= 1000){
      HHA.dtAcc -= 1000;
      HHA.timeLeft = Math.max(0, (HHA.timeLeft|0) - 1);
      safeText('#time', HHA.timeLeft);
      // time-up?
      if (HHA.timeLeft<=0){
        HHA.timeLeft = 0;
        HHA.running = false;
        HHA.loop.id = requestAnimationFrame(()=> hardEnd(false));
        return;
      }
    }

    // mode update
    try { HHA.modeInst.update?.(dt/1000, HHA.Bus); } catch(e){ console.warn('[mode.update]', e); }

    // missions tick (dt-aware)
    try {
      missions.tickDt(HHA.state, scorer, dt, (res)=>{
        // Optional: small FX when a mission finishes
        if (res?.success){ engine.fx.popText(HHA.lang==='TH'?'สำเร็จ!':'Mission OK', { x: innerWidth/2, y: innerHeight*0.72, ms: 900 }); }
      }, { hud, coach, lang: HHA.lang });
    } catch(e) { console.warn('[missions.tickDt]', e); }
  }

  HHA.loop.id = requestAnimationFrame(loopStep);
}

/* ---------------- Pause / Resume & Window focus ---------------- */
window.onAppBlur  = ()=>{ if (!HHA.running) return; HHA.paused = true; coach.onPause?.(); };
window.onAppFocus = ()=>{ if (!HHA.running) return; HHA.paused = false; coach.onResume?.(); };

window.onPauseIntent = ()=>{
  if (!HHA.running) return;
  HHA.paused = !HHA.paused;
  if (HHA.paused) coach.onPause?.(); else coach.onResume?.();
};

/* ---------------- Language switch (from UI) ---------------- */
window.onLangSwitch = (lang='TH')=>{
  HHA.lang = String(lang).toUpperCase();
};

/* ---------------- GFX/Sound toggles (hooks only) ---------------- */
window.onGfxToggle   = ()=>{ /* reserve for heavy FX switch if needed */ };
window.onSoundToggle = ()=>{ sfx.toggleMute?.(); };

/* ---------------- Replay guard (modal buttons already bound in ui.js) ---------------- */
window.preStartFlow = ()=>{
  // Called by ui.js before startGame
  // Any prep (e.g., fade menu, clear chips)
  $('#result') && ($('#result').style.display='none');
  $('#resultModal') && ($('#resultModal').style.display='none');
};

/* ---------------- Safety: expose minimal API for legacy calls ---------------- */
window.start = (opts)=> startGame(opts);
window.end   = (fromRestart)=> hardEnd(!!fromRestart);

/* ---------------- Error Fence ---------------- */
window.addEventListener('error', (e)=>{
  try { window.HHA_BOOT?.reportError?.(e?.error || e?.message || e); } catch{}
});
