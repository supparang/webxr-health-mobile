// === Hero Health Academy — game/main.js (Unified Runtime v2025-10-28)
// - Safe FX bootstrap (no duplicate identifiers)
// - Quests (10/โหมด) wired: begin/tick/event/end + HUD chips
// - Progression (save/export/import + daily robust)
// - VRInput reticle + dwell timer (configurable)
// - Score/Combo/Streak Decay + FEVER
// - Dynamic Difficulty (DD) + Assist windows
// - Pause on blur / visibilitychange
// - Tooltip helper + toast
// - Spawner with margin-safe zone for bottom HUD
// - Per-mode isolation: goodjunk / groups / hydration / plate
// - SFX hooks: sfx-good / sfx-perfect / sfx-bad / sfx-fever

// ----- Imports -----
import { Engine }       from './core/engine.js';
import { HUD }          from './core/hud.js';
import { Coach }        from './core/coach.js';
import { SFX }          from './core/sfx.js';
import { ScoreSystem }  from './core/score.js';
import { PowerUpSystem }from './core/powerup.js';

import * as goodjunk    from './modes/goodjunk.js';
import * as groups      from './modes/groups.js';
import * as hydration   from './modes/hydration.js';
import * as plate       from './modes/plate.js';

import * as VRInput     from './core/vrinput.js';
import { Progress }     from './core/progression.js';
import { Quests }       from './core/quests.js';

// ----- Safe FX bootstrap (avoid "Identifier 'add3DTilt' already declared") -----
(function ensureFX(){
  if (!window.HHA_FX) {
    window.HHA_FX = { add3DTilt: ()=>{}, shatter3D: ()=>{} };
    (async () => {
      try {
        const m = await import('./core/fx.js').catch(()=>null);
        if (m) Object.assign(window.HHA_FX, m);
      } catch {}
    })();
  }
})();

// ----- Shortcuts -----
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);
const clamp = (n,a,b)=>Math.max(a, Math.min(b,n));
const lerp  = (a,b,t)=>a+(b-a)*t;

// ----- Global Runtime State -----
const STATE = {
  lang: (localStorage.getItem('hha_lang')||'TH').toUpperCase(),   // 'TH' | 'EN'
  difficulty: (localStorage.getItem('hha_diff')||'Normal'),       // 'Easy' | 'Normal' | 'Hard'
  modeKey: 'goodjunk',                                            // default
  seconds: 60,                                                    // length per run
  running: false,
  paused: false,
  freezeUntil: 0,

  // scoring/combo/fever
  score: 0,
  combo: 0,
  comboMax: 0,
  fever: false,
  feverGauge: 0,       // 0..100
  feverDecayIdle: 7,   // gauge decay per second when idle
  streakDecayDelayMs: 1600, // time since last GOOD/PERFECT then decay combo by 1/step
  lastGoodTs: 0,

  ddFactor: 1.0,       // dynamic difficulty scaler (life speed etc.)
  ddTarget: 1.0,

  // per-mode context
  ctx: {},

  // systems (created at boot)
  engine: null,
  hud: null,
  coach: null,
  sfx: null,
  scoreSys: null,
  powerups: null,
};

// Map mode keys -> module
const MODES = {
  goodjunk, groups, hydration, plate
};

// ----- UI Localized labels -----
function L(key){
  const th = {
    start:'เริ่ม', paused:'หยุดชั่วคราว', resumed:'เล่นต่อ', over:'จบเกม',
    newTarget:(name)=>`🎯 เป้าหมายใหม่: ${name}`,
    tooltipPause:'เกมหยุดชั่วคราว (สลับแท็บเพื่อเล่นต่อ)',
    fever:'FEVER!',
  };
  const en = {
    start:'Start', paused:'Paused', resumed:'Resumed', over:'Game Over',
    newTarget:(name)=>`🎯 New target: ${name}`,
    tooltipPause:'Game paused (switch tab to resume)',
    fever:'FEVER!',
  };
  return (STATE.lang==='EN'?en:th)[key] || key;
}

function toast(msg){
  let el = $('#toast'); if (!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
  el.textContent = typeof msg==='function'?msg():msg;
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'), 1100);
}

function tooltip(msg){
  let el = $('#tooltip'); if (!el){ el=document.createElement('div'); el.id='tooltip'; el.className='tooltip'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'), 1800);
}

// ----- Score / Combo / Fever -----
const SCORECFG = {
  baseGood: 10,
  basePerfect: 18,
  comboStep: 1,
  comboToFever: 12,      // when combo >= this → start fever
  feverBonus: 1.5,       // score multiplier in fever
  goldenBonus: 1.2,      // golden additive factor applied before fever
};

function addScore(result, meta){
  // result: 'good' | 'perfect' | 'bad' | 'ok'
  if (result==='bad'){
    STATE.combo = 0;
    STATE.hud?.setCombo?.(STATE.combo);
    STATE.sfx?.play?.('sfx-bad');
    return;
  }
  if (result==='ok') return;

  const goldenMul = meta?.golden ? SCORECFG.goldenBonus : 1.0;
  let add = (result==='perfect'?SCORECFG.basePerfect:SCORECFG.baseGood);
  add = Math.round(add * goldenMul);

  // combo
  STATE.combo += SCORECFG.comboStep;
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
  STATE.lastGoodTs = performance.now();

  // fever on threshold
  if (!STATE.fever && STATE.combo >= SCORECFG.comboToFever){
    STATE.fever = true;
    STATE.feverGauge = 100;
    STATE.hud?.pulseFever?.(true);
    STATE.sfx?.play?.('sfx-fever');
    toast(L('fever'));
    Quests.event?.('fever', { kind:'start' });
  }

  // fever multiplier
  if (STATE.fever) add = Math.round(add * SCORECFG.feverBonus);

  STATE.score += add;
  STATE.hud?.setScore?.(STATE.score);
  STATE.hud?.setCombo?.(STATE.combo);
}

// ----- Dynamic Difficulty -----
function updateDD(successRatio){
  // successRatio in [0..1]; move ddTarget then lerp ddFactor
  if (successRatio >= 0.8) STATE.ddTarget = 1.1;
  else if (successRatio >= 0.6) STATE.ddTarget = 1.0;
  else if (successRatio >= 0.4) STATE.ddTarget = 0.95;
  else STATE.ddTarget = 0.9;
}

function applyDDToDiff(baseLife){
  const f = STATE.ddFactor;
  // harder → shorter life; easier → longer life (clamped by each mode)
  return Math.round(baseLife / f);
}

// ----- Spawner / Margin-safe -----
const SPAWN = {
  bottomSafePx: 86,       // avoid overlapping HUD at bottom
  spawnEveryMs: 900,      // default cadence
  lastSpawn: 0
};

function wantSpawn(ts){ return (ts - SPAWN.lastSpawn) >= SPAWN.spawnEveryMs; }
function markSpawn(ts){ SPAWN.lastSpawn = ts; }

// ----- VR Input (reticle + dwell) -----
function setupVRInput(){
  try{
    VRInput?.enable?.();
    VRInput?.setDwellMs?.(Number(localStorage.getItem('hha_dwell_ms')) || 520); // configurable
    VRInput?.setReticle?.({ size: 24, ring: true });
  }catch{}
}

// ----- Pause / Resume -----
function setPaused(p){
  if (STATE.paused === p) return;
  STATE.paused = p;
  if (p){
    tooltip(L('tooltipPause'));
    STATE.hud?.setPaused?.(true);
  }else{
    STATE.hud?.setPaused?.(false);
  }
}
window.addEventListener('blur', ()=> setPaused(true));
window.addEventListener('focus',()=> setPaused(false));
document.addEventListener('visibilitychange', ()=> setPaused(document.hidden));

// ----- Mode Wiring -----
let curMode = null;       // current mode module
let questBinder = null;   // { refresh() }

function changeMode(key){
  if (STATE.running) return;
  key = MODES[key] ? key : 'goodjunk';
  STATE.modeKey = key;
  $('#modeName') && ($('#modeName').textContent = key);
}

function beginRun(){
  if (STATE.running) return;
  const M = MODES[STATE.modeKey];
  if (!M) return;

  // reset runtime
  STATE.running = true;
  STATE.paused = false;
  STATE.freezeUntil = 0;
  STATE.score = 0;
  STATE.combo = 0;
  STATE.comboMax = 0;
  STATE.fever = false;
  STATE.feverGauge = 0;
  STATE.ddFactor = 1.0;
  STATE.ddTarget = 1.0;
  STATE.ctx = {};

  // HUD
  STATE.hud?.reset?.();
  STATE.hud?.setTimer?.(STATE.seconds);
  STATE.hud?.setScore?.(0);
  STATE.hud?.setCombo?.(0);
  STATE.hud?.useMode?.(STATE.modeKey);

  // Bind quests HUD
  questBinder = Quests.bindToMain?.({ hud: STATE.hud });
  Quests.beginRun?.(STATE.modeKey, STATE.difficulty, STATE.lang, STATE.seconds);

  // Mode init
  try{ M.init?.(STATE, STATE.hud, { life: 3000 }); }catch(e){ console.error('mode.init error', e); }

  // Coach cue
  STATE.coach?.say?.(STATE.lang==='EN'?'Let’s go!':'ไปกันเลย!', 900);

  // Engine kick
  STATE.engine?.start?.();
}

function endRun(){
  if (!STATE.running) return;
  STATE.running = false;

  // finalize quests
  const questResults = Quests.endRun?.({ score: STATE.score, highCount: STATE.ctx?.hydroHigh|0, overfill: STATE.ctx?.overfillCount|0 }) || [];

  // Save progression (score+stars+quests)
  const stars = STATE.score >= 400 ? 3 : (STATE.score >= 280 ? 2 : (STATE.score >= 160 ? 1 : 0));
  try {
    Progress?.recordRun?.({
      mode: STATE.modeKey,
      difficulty: STATE.difficulty,
      score: STATE.score,
      comboMax: STATE.comboMax,
      stars,
      quests: questResults
    });
    Progress?.save?.(); // robust daily save
  } catch(e){ console.warn('Progress save failed:', e); }

  // HUD result modal
  STATE.hud?.showResult?.({
    mode: STATE.modeKey, score: STATE.score, comboMax: STATE.comboMax, stars,
    quests: questResults, lang: STATE.lang
  });

  // Coach summary
  STATE.coach?.say?.(
    STATE.lang==='EN'
    ? `Score ${STATE.score}, max combo ${STATE.comboMax}.`
    : `คะแนน ${STATE.score} คอมโบสูงสุด ${STATE.comboMax}`,
    1600
  );

  // Mode cleanup
  try { MODES[STATE.modeKey]?.cleanup?.(STATE, STATE.hud); } catch {}

  // engine stop
  STATE.engine?.stop?.();
}

// ----- Engine Loop -----
function tickSecond(){
  if (!STATE.running || STATE.paused) return;

  // Timer
  const t = Math.max(0, (STATE.hud?.decTimer?.(1) ?? (STATE.seconds = Math.max(0, STATE.seconds-1))));
  STATE.hud?.setTimer?.(t);

  // Fever decay
  if (STATE.fever){
    STATE.feverGauge = Math.max(0, STATE.feverGauge - 12);
    if (STATE.feverGauge === 0){
      STATE.fever = false;
      STATE.hud?.pulseFever?.(false);
      Quests.event?.('fever', { kind:'end' });
    }
  }

  // Combo decay (streak decay)
  const now = performance.now();
  if (STATE.combo>0 && (now - STATE.lastGoodTs) > STATE.streakDecayDelayMs){
    STATE.combo = Math.max(0, STATE.combo - 1);
    STATE.hud?.setCombo?.(STATE.combo);
    STATE.lastGoodTs = now;
  }

  // Quests tick (score-coupled)
  Quests.tick?.({ score: STATE.score });

  // Mode tick (logical, per second)
  try { MODES[STATE.modeKey]?.tick?.(STATE, { sfx: STATE.sfx, score: STATE.scoreSys }, STATE.hud); } catch {}
}

function loop(ts){
  if (!STATE.running || STATE.paused) return;

  // spawn cadence
  if (wantSpawn(ts)){
    spawnOne(ts);
    markSpawn(ts);
  }

  // gentle-lerp DD
  STATE.ddFactor = lerp(STATE.ddFactor, STATE.ddTarget, 0.04);
}

// ----- Spawn / Hit handling -----
function spawnOne(ts){
  const M = MODES[STATE.modeKey];
  if (!M?.pickMeta) return;

  // base meta from mode
  let meta = M.pickMeta?.({ life: 3000 }, STATE) || {};

  // apply DD scaler to lifetime
  if (typeof meta.life === 'number') meta.life = applyDDToDiff(meta.life);

  // Engine asks to materialize an item with margins
  const safe = { bottom: SPAWN.bottomSafePx, left: 0, right: 0, top: 8 };
  const id = STATE.engine?.spawn?.(meta, safe, {
    onSpawn(el){ try { (M.fx?.onSpawn || (()=>{}))(el, STATE); } catch {} },
    onClick:(pos)=> handleHit(meta, pos)
  });

  // remember if needed (some modes may use ctx)
  meta._spawnId = id;
}

function handleHit(meta, hitPos){
  // freeze window (e.g., groups.freezeTarget)
  if (STATE.freezeUntil && performance.now() < STATE.freezeUntil) return;

  // delegate to mode
  let result = 'ok';
  try {
    result = MODES[STATE.modeKey]?.onHit?.(meta, { sfx: STATE.sfx, score: STATE.scoreSys }, STATE, STATE.hud) || 'ok';
  } catch(e){ console.warn('mode.onHit error', e); }

  // score pipeline
  addScore(result, meta);

  // quests event
  Quests.event?.('hit', {
    result, meta,
    comboNow: STATE.combo,
    _ctx: { score: STATE.score }
  });

  // SFX basic fallback if mode didn't play
  if (result==='good' && !meta?.__sfxPlayed) STATE.sfx?.play?.('sfx-good');
  if (result==='perfect' && !meta?.__sfxPlayed) STATE.sfx?.play?.('sfx-perfect');

  // update DD: success metric
  const ok = (result==='good'||result==='perfect') ? 1 : 0;
  updateDD( (ok + 0.0001) ); // minimal heuristic per hit
}

// ----- Buttons / Hooks -----
function bindUI(){
  $('#btnStart')?.addEventListener('click', ()=>{
    STATE.seconds = Number($('#duration')?.value)||60;
    STATE.difficulty = ($('#difficulty')?.value)||STATE.difficulty;
    localStorage.setItem('hha_diff', STATE.difficulty);
    beginRun();
  });

  $('#btnStop')?.addEventListener('click', endRun);

  // mode selector
  $$('#modeList [data-mode]')?.forEach(el=>{
    el.addEventListener('click', ()=>{
      if (STATE.running) return;
      changeMode(el.getAttribute('data-mode'));
      $$('#modeList [data-mode]')?.forEach(b=>b.classList.toggle('active', b===el));
    });
  });

  // language toggle
  $('#langToggle')?.addEventListener('click', ()=>{
    STATE.lang = (STATE.lang==='EN'?'TH':'EN');
    localStorage.setItem('hha_lang', STATE.lang);
    STATE.hud?.setLang?.(STATE.lang);
    toast(STATE.lang==='EN'?'English':'ภาษาไทย');
  });

  // export/import progression
  $('#btnExport')?.addEventListener('click', ()=>{
    try{
      const blob = Progress?.exportBlob?.();
      if (blob){
        const a=document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'HHA-progress.json';
        a.click();
      }
    }catch(e){ console.warn('export failed', e); }
  });
  $('#btnImport')?.addEventListener('change', async (e)=>{
    const file = e.target.files?.[0]; if (!file) return;
    try{
      const text = await file.text();
      Progress?.importJSON?.(text);
      Progress?.save?.();
      toast('Progress imported');
    }catch(err){ console.warn('import failed', err); }
  });
}

// ----- Boot -----
async function boot(){
  // systems
  STATE.sfx      = new SFX();
  STATE.hud      = new HUD({ lang: STATE.lang });
  STATE.engine   = new Engine({ bottomSafe: SPAWN.bottomSafePx, onLoop: loop });
  STATE.coach    = new Coach({ hud: STATE.hud, sfx: STATE.sfx });
  STATE.scoreSys = new ScoreSystem({ onAdd:(n)=>{ STATE.score+=n; STATE.hud?.setScore?.(STATE.score);} });
  STATE.powerups = new PowerUpSystem({
    onUse:(k)=>{
      // bridge to mode powers if exists
      const P = MODES[STATE.modeKey]?.powers;
      if (!P) return;
      if (k==='x2' && P.x2Target) P.x2Target();
      if (k==='freeze' && P.freezeTarget) P.freezeTarget();
      if (k==='magnet' && P.magnetNext) P.magnetNext();
    },
    getDurations: ()=>MODES[STATE.modeKey]?.getPowerDurations?.() || { x2:8, freeze:3, magnet:2 }
  });

  // VR input
  setupVRInput();

  // bottom safe zone badge <-> HUD
  STATE.hud?.setBottomSafe?.(SPAWN.bottomSafePx);

  // initial mode
  changeMode(STATE.modeKey);

  // bind UI
  bindUI();

  // quests HUD handshake (chips will be fed after beginRun)
  Quests.bindToMain?.({ hud: STATE.hud });

  // second tick
  setInterval(tickSecond, 1000);

  // expose for debug
  window.__HHA = { STATE, beginRun, endRun, changeMode, Engine: STATE.engine, HUD: STATE.hud };
}

document.addEventListener('DOMContentLoaded', boot);
