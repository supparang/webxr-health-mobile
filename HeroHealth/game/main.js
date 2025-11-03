// === Hero Health Academy — /game/main.js (2025-11-03 FINAL) ===
'use strict';

// ----- Imports (core) -----
import { Engine }            from '../core/engine.js';
import { HUD }               from '../core/hud.js';
import { Coach }             from '../core/coach.js';
import { ScoreSystem }       from '../core/score.js';
import { PowerUpSystem }     from '../core/powerup.js';
import { SFX }               from '../core/sfx.js';
import { Quests }            from '../core/quests.js';
import { MissionSystem }     from '../core/mission-system.js';
import { Progress }          from '../core/progression.js';

// ----- State -----
const R = {
  playing: false,
  modeKey: 'goodjunk',
  diff: 'Normal',
  seconds: 45,

  // modules
  engine: null,
  hud: null,
  coach: null,
  score: null,
  power: null,
  sfx: null,
  mission: null,

  // mode api
  modeAPI: null,     // {start, update, cleanup, setFever?}
  modeInst: null,    // legacy wrapper if needed

  // timers
  _raf: 0,
  _hardTick: null,
  _lastTS: 0,
  tStartWall: 0,
  tEndWall: 0,

  // helpers
  _countdownTOs: [],
};

// ====== Utilities ======
const $ = (s)=>document.querySelector(s);

function getSelectedMode(){ return document.body.getAttribute('data-mode') || 'goodjunk'; }
function getSelectedDiff(){ return document.body.getAttribute('data-diff') || 'Normal'; }

function wallSecondsLeft(){
  const now = Date.now();
  const ms = Math.max(0, R.tEndWall - now);
  return Math.ceil(ms/1000);
}

function stopHardTick(){
  if (R._hardTick){ clearInterval(R._hardTick); R._hardTick = null; }
  if (R._raf) cancelAnimationFrame(R._raf);
}

// ====== FEVER sync ======
function syncFeverVisual(){
  const active = R.score?.fever?.active;
  R.hud?.showFever(!!active);
  try { R.modeAPI?.setFever?.(!!active); } catch {}
}

// ====== BUS (events from mode) ======
const BUS = {
  hit(e){
    const kind = e?.kind || 'good';
    const pts  = e?.points|0;
    R.score.add(pts, { kind });
    R.hud.updateHUD(R.score.get(), R.score.combo);
    if (e?.ui) R.hud.showFloatingText(e.ui.x, e.ui.y, `+${pts}`);

    // auto-activate fever when charged
    if (!R.score.fever.active && (R.score.fever.charge|0) >= 100){
      if (R.score.tryActivateFever()){
        R.coach?.onFever?.();
        R.sfx?.fever?.(true);
        syncFeverVisual();
      }
    }

    // missions / quests signals
    try {
      if (kind === 'perfect') R.mission?.onEvent('perfect', {}, R);
      R.mission?.onEvent('good', {}, R);
    } catch {}
  },
  miss(ev){
    R.score.add(0, { kind:'miss' });
    R.hud.updateHUD(R.score.get(), R.score.combo);
    try { R.mission?.onEvent('miss', {}, R); } catch {}
    R.coach?.onMiss?.();
  },
  bad(ev){
    R.score.add(0, { kind:'bad' });
    R.hud.updateHUD(R.score.get(), R.score.combo);
    try { R.mission?.onEvent('wrong_group', {}, R); } catch {}
    R.coach?.onBad?.();
  },
  power(kind){
    // You can map to PowerUpSystem if desired
    R.sfx?.power?.();
  },
  sfx: {
    good(){ R.sfx?.good?.(); },
    bad(){ R.sfx?.bad?.(); },
    perfect(){ R.sfx?.perfect?.(); },
    power(){ R.sfx?.power?.(); },
  }
};

// ====== Mode Loader (goodjunk guaranteed) ======
async function loadMode(key){
  try {
    const mod = await import(`./modes/${key}.js?ts=${Date.now()}`);
    // Prefer module API (start/update/cleanup)
    const api = (mod && (mod.create ? mod.create() : (mod.start && mod.update ? mod : null)));
    if (!api) throw new Error(`Mode ${key} missing API`);
    return api;
  } catch (e){
    // fallback to goodjunk
    if (key !== 'goodjunk'){
      console.warn(`[mode:${key}] failed, fallback to goodjunk`, e);
      return await loadMode('goodjunk');
    }
    throw e;
  }
}

// ====== Countdown (3-2-1-Go) ======
async function runCountdown(){
  const seq = ['3','2','1','GO!'];
  const delay = [650, 650, 650, 550];
  for (let i=0;i<seq.length;i++){
    R.hud.showBig(seq[i]);
    await new Promise(r=>{ const to=setTimeout(r, delay[i]); R._countdownTOs.push(to); });
  }
}

// ====== Game Loop ======
function frame(ts){
  if (!R.playing) return;

  const dt = Math.max(0.001, (R._lastTS ? (ts - R._lastTS) : 16.6) / 1000);
  R._lastTS = ts;

  // propagate fever timing
  R.score.tick(dt);
  // fever end hook
  if (!R.score.fever.active && document.body.classList.contains('fever-on')){
    R.sfx?.fever?.(false);
    syncFeverVisual();
  }

  try { R.modeAPI?.update?.(dt, BUS); } catch (e){ console.error('[mode.update]', e); }

  // check end by wall clock
  if (Date.now() >= R.tEndWall){
    endGame();
    return;
  }

  R._raf = requestAnimationFrame(frame);
}

function startHardTick(){
  // Wall-clock HUD timer & quests tick
  R._hardTick = setInterval(()=>{
    // HUD time
    R.hud.setTimer(wallSecondsLeft());

    // Optional: tick Quests system to progress time-based quests
    try {
      const fever = !!(R.score?.fever?.active);
      Quests.tick({ score: R.score.get(), dt: 1, fever });
    } catch {}
  }, 1000);
}

// ====== Start / End / Retry ======
async function startGame(){
  if (R.playing) return;

  // read selection
  R.modeKey = getSelectedMode();
  R.diff    = getSelectedDiff();
  R.seconds = 45; // fixed for now; adjust as you like

  // init modules (once)
  if (!R.engine)  R.engine  = new Engine();
  if (!R.hud)     R.hud     = new HUD();
  if (!R.coach)   R.coach   = new Coach({ lang:'TH' });
  if (!R.score)   R.score   = new ScoreSystem();
  if (!R.power)   R.power   = new PowerUpSystem();
  if (!R.sfx)     R.sfx     = new SFX();
  if (!R.mission) R.mission = new MissionSystem();

  Progress.init();

  // HUD top info
  R.hud.setTop({ mode: R.modeKey, diff: R.diff });
  R.hud.updateHUD(0, 0);
  R.hud.setTimer(R.seconds);
  R.hud.resetBars();
  Quests.bindToMain({ hud:R.hud, coach:R.coach });

  // load mode api
  try {
    R.modeAPI = await loadMode(R.modeKey);
  } catch (e){
    console.error('[loadMode] fatal', e);
    window.__HHA_HUD_API?.say?.('โหลดโหมดไม่สำเร็จ');
    return;
  }

  // begin mission set (optional UI chips driven by Quests)
  try { Quests.beginRun(R.modeKey, R.diff, 'TH', R.seconds); } catch {}

  // start flags
  R.playing = true;
  document.body.setAttribute('data-playing','1');
  R.score.reset();
  R.power.attachToScore(R.score);

  // Countdown → start
  await runCountdown();

  // Start mode
  try {
    R.modeAPI.start?.({ difficulty:R.diff, fever:false });
  } catch (e){ console.error('[mode.start]', e); }

  // wall clock timer bounds
  R.tStartWall = Date.now();
  R.tEndWall   = R.tStartWall + R.seconds*1000;

  // coach + hud
  R.coach.onStart?.();
  R.hud.setTimer(wallSecondsLeft());

  // timers
  startHardTick();
  R._lastTS = 0;
  R._raf = requestAnimationFrame(frame);
}

function endGame(){
  if (!R.playing) return;
  R.playing = false;
  document.body.removeAttribute('data-playing');

  stopHardTick();

  // cleanup mode
  try { R.modeAPI?.cleanup?.(); } catch (e){ console.warn('mode.cleanup error', e); }

  // HARD clear spawns (DOM modes safeguard)
  try {
    const host = document.getElementById('spawnHost');
    if (host) host.innerHTML = '';
  } catch {}

  // result
  const score = R.score.get();
  const bestC = R.score.bestCombo|0;
  Progress.endRun({ score, bestCombo: bestC });

  const qsum = Quests.endRun?.({_score:score}) || { lines:[], totalDone:0 };
  const lines = qsum.lines || [];
  R.hud.showResult({
    title: 'Result',
    desc: `Mode: ${R.modeKey} (${R.diff})`,
    stats: [
      `Score: ${score}`,
      `Best combo: x${bestC}`,
      `Quests done: ${qsum.totalDone||0}/3`
    ],
    extra: lines
  });
  R.hud.onHome  = ()=>{ try{ location.href = location.href; }catch{} };
  R.hud.onRetry = ()=>{ R.hud.hideResult(); startGame(); };

  R.coach.onEnd?.(score);

  // reset handles
  R.modeInst = null;
  R.modeAPI  = null;
}

function restartGame(){
  if (!R.playing) return;
  endGame();
  startGame();
}

// ====== Expose API to window (used by index binder) ======
try {
  window.HHA = window.HHA || {};
  window.HHA.startGame  = startGame;
  window.HHA.endGame    = endGame;
  window.HHA.restart    = restartGame;
  // For debug — allow DOM mode to ping us if needed
  window.__notifySpawn = ()=>{/* no-op; hook for dev */};
} catch {}

// ====== Optional: close menu if loaded directly and auto-start? ======
// (We let index.html decide; no auto-start here)
