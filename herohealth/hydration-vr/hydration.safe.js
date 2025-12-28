// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration VR — DOM Emoji Engine (PLAY/RESEARCH) — LATEST
// ✅ Water Gauge 0–100 + zone colors (ui-water.js)
// ✅ Targets: GOOD (💧) / BAD (🥤) / SHIELD (🛡️ powerup)
// ✅ Crosshair shoot (center) + click/tap targets directly
// ✅ Cardboard-friendly: works with "synthShoot" in HTML (fires pointer at center)
// ✅ Storm system + "end-window" cinematic hooks: window.__HVR__.S / __HVR__.TUNE
// ✅ Emits standard events: hha:score / hha:time / hha:rank / hha:fever / quest:update / hha:end / hha:coach
// ✅ Safe: guards missing elements + missing optional globals

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';

// ----------------------------- helpers -----------------------------
const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function qs(name, def){
  try{ return (new URL(location.href)).searchParams.get(name) ?? def; }catch{ return def; }
}
function int(name, def){
  const v = parseInt(qs(name, def), 10);
  return Number.isFinite(v) ? v : def;
}
function num(name, def){
  const v = Number(qs(name, def));
  return Number.isFinite(v) ? v : def;
}
function clamp(v,a,b){
  v = Number(v);
  if (!Number.isFinite(v)) v = a;
  return v < a ? a : (v > b ? b : v);
}
function nowIso(){
  try{ return new Date().toISOString(); }catch{ return ''; }
}
function pick(...ids){
  for (const id of ids){
    const el = DOC.getElementById(id);
    if (el) return el;
  }
  return null;
}
function setTxt(el, v){
  try{ if (el) el.textContent = String(v ?? ''); }catch{}
}
function fire(name, detail){
  try{
    ROOT.dispatchEvent(new CustomEvent(name, { detail }));
  }catch{}
}

// ----------------------------- optional globals -----------------------------
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){} };

const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI ||
  null;

// ----------------------------- config -----------------------------
const PROJECT_TAG = 'HydrationVR';
const VERSION = '2025-12-28c';

const diff = String(qs('diff','normal')).toLowerCase();                 // easy/normal/hard
const runMode = String(qs('run', qs('runMode','play'))).toLowerCase();  // play/research
const timePlannedSec = clamp(int('time', 90), 30, 600);

const hub = String(qs('hub','../hub.html') || '../hub.html');
const studyId = String(qs('studyId','') || '');
const phase = String(qs('phase','') || '');
const conditionGroup = String(qs('conditionGroup','') || '');
const sessionOrder = String(qs('sessionOrder','') || '');
const blockLabel = String(qs('blockLabel','') || '');
const siteCode = String(qs('siteCode','') || '');

const studentKey = String(qs('studentKey', qs('sessionId','')) || '');
const ts = String(qs('ts', Date.now()));
const seed = String(qs('seed', studentKey ? (studentKey + '|' + ts) : ts));
const logEndpoint = String(qs('log','') || '');

// difficulty tuning
const DIFF = (function(){
  const d = diff;
  if (d === 'easy') return {
    baseSize: 96,
    spawnEvery: 0.72,
    goodWeight: 0.70,
    badWeight: 0.22,
    shieldWeight: 0.08,
    goodDelta: +6.0,
    badDelta:  -7.5,
    stormEvery: 18,
    stormDur: 8,
    endWindowSec: 3.5,
    missPenalty: 1
  };
  if (d === 'hard') return {
    baseSize: 78,
    spawnEvery: 0.54,
    goodWeight: 0.62,
    badWeight: 0.30,
    shieldWeight: 0.08,
    goodDelta: +5.0,
    badDelta:  -9.0,
    stormEvery: 14,
    stormDur: 9,
    endWindowSec: 3.5,
    missPenalty: 1
  };
  // normal
  return {
    baseSize: 86,
    spawnEvery: 0.62,
    goodWeight: 0.66,
    badWeight: 0.26,
    shieldWeight: 0.08,
    goodDelta: +5.5,
    badDelta:  -8.2,
    stormEvery: 16,
    stormDur: 8.5,
    endWindowSec: 3.5,
    missPenalty: 1
  };
})();

const ADAPTIVE_ON = (runMode !== 'research'); // play: adaptive on, research: fixed
const PLAY_TAG = (runMode === 'research') ? 'research' : 'play';

// Storm tuning exposed for HTML cinematic driver
ROOT.__HVR__ = ROOT.__HVR__ || {};
ROOT.__HVR__.TUNE = {
  endWindowSec: DIFF.endWindowSec
};
ROOT.__HVR__.S = ROOT.__HVR__.S || {};

// ----------------------------- DOM refs -----------------------------
const elPlayfield = pick('playfield','hvr-playfield','stage','hvr-stage');
const elLayer = pick('hvr-layer','layer','targets','spawn-layer');

const elScore = pick('stat-score','hhaScore','hudScore');
const elCombo = pick('stat-combo','hhaCombo','hudCombo');
const elComboMax = pick('stat-combo-max','hudComboMax');
const elMiss = pick('stat-miss','hhaMiss','hudMiss');
const elTime = pick('stat-time','hhaTime','hudTime');
const elGrade = pick('stat-grade','hhaGrade','hudGrade');

const elCoachText = pick('coach-text','hudCoachLine','coachMsg');
const elCoachSub  = pick('coach-sub','hudCoachSub');

const elShieldCount = pick('shield-count');

const elStormLeft = pick('storm-left');
const elMiniStormIn = pick('mini-storm-in');

const elQuest1 = pick('quest-line1','hudGoalTitle');
const elQuest2 = pick('quest-line2','hudGoalCount');
const elQuest3 = pick('quest-line3','hudMiniTitle');
const elQuest4 = pick('quest-line4','hudMiniCount');

const elMiniPressurePct = pick('mini-pressure-pct');
const elMiniPressureBar = pick('mini-pressure-bar');

const miniCStorm = pick('mini-c-storm');
const miniCZone  = pick('mini-c-zone');
const miniCPressure = pick('mini-c-pressure');
const miniCEnd = pick('mini-c-end');
const miniCBlock = pick('mini-c-block');
const miniVStorm = pick('mini-v-storm');
const miniVZone = pick('mini-v-zone');
const miniVPressure = pick('mini-v-pressure');
const miniVEnd = pick('mini-v-end');
const miniVBlock = pick('mini-v-block');

const startOverlay = pick('startOverlay','start-overlay');
const btnStart = pick('btnStart','btn-start');

const endMount = pick('hvr-end','endOverlay','resultBackdrop','end-summary');

// ----------------------------- safezone markers (for mode-factory) -----------------------------
(function markSafeZones(){
  try{
    // anything that shouldn't be spawned over
    const candidates = DOC.querySelectorAll?.('.hud, .bottom, #hudTop, #miniPanel, #coachPanel, #hudBtns, #shootPad, #cbControls, .hha-hud, .hha-fever');
    candidates?.forEach(el => el.setAttribute('data-safezone','1'));
  }catch{}
})();

// ----------------------------- game state -----------------------------
const S = {
  started:false,
  ended:false,

  tStart: 0,
  tNow: 0,

  timeLeftSec: timePlannedSec,

  score: 0,
  combo: 0,
  comboMax: 0,
  misses: 0,
  perfect: 0,

  waterPct: 50,

  feverPct: 0,
  shield: 0,

  // counts for analytics
  nSpawnGood: 0,
  nSpawnBad: 0,
  nSpawnShield: 0,
  nHitGood: 0,
  nHitBad: 0,
  nHitShield: 0,
  nBadGuarded: 0,
  nShotMiss: 0,

  // storm
  stormActive: false,
  stormLeftSec: 0,
  stormNextInSec: DIFF.stormEvery,

  // mini quest: "Shield Timing (FULL)"
  pressure: 0,                 // 0..100
  miniBlockedInEnd: false
};

function setCoach(line, sub){
  if (line != null) setTxt(elCoachText, line);
  if (sub != null) setTxt(elCoachSub, sub);
  fire('hha:coach', { line: String(line ?? ''), sub: String(sub ?? '') });
}

function addShield(n=1){
  S.shield = Math.max(0, (S.shield|0) + (n|0));
  setTxt(elShieldCount, S.shield);
  // optional FeverUI sync
  try{
    if (FeverUI && typeof FeverUI.addShield === 'function') FeverUI.addShield(n|0);
    else if (FeverUI && typeof FeverUI.setShield === 'function') FeverUI.setShield(S.shield);
  }catch{}
}

function useShield(){
  if (S.shield <= 0) return false;
  S.shield--;
  setTxt(elShieldCount, S.shield);
  try{
    if (FeverUI && typeof FeverUI.consumeShield === 'function') FeverUI.consumeShield(1);
    else if (FeverUI && typeof FeverUI.setShield === 'function') FeverUI.setShield(S.shield);
  }catch{}
  return true;
}

function addFever(delta){
  S.feverPct = clamp(S.feverPct + delta, 0, 100);
  try{
    if (FeverUI && typeof FeverUI.setFeverPct === 'function') FeverUI.setFeverPct(S.feverPct);
    else if (FeverUI && typeof FeverUI.set === 'function') FeverUI.set({ pct:S.feverPct, shield:S.shield });
  }catch{}
  fire('hha:fever', { pct: S.feverPct, shield: S.shield });
}

function setWater(pct){
  S.waterPct = clamp(pct, 0, 100);
  setWaterGauge(S.waterPct);
}

function addScore(delta, kind){
  delta = Number(delta) || 0;
  S.score = Math.max(0, (S.score|0) + (delta|0));
  if (kind) Particles.scorePop?.(String(kind), delta|0);
}

function gradeFrom(score, accPct){
  // SSS, SS, S, A, B, C
  // balance both score and accuracy
  const a = clamp(accPct, 0, 100);
  const x = (score * 0.65) + (a * 12);
  if (x >= 2400) return 'SSS';
  if (x >= 1900) return 'SS';
  if (x >= 1500) return 'S';
  if (x >= 1100) return 'A';
  if (x >= 750)  return 'B';
  return 'C';
}

function accuracyGoodPct(){
  const denom = Math.max(1, S.nSpawnGood);
  return Math.round((S.nHitGood / denom) * 100);
}

function updateHUD(){
  setTxt(elScore, S.score|0);
  setTxt(elCombo, S.combo|0);
  setTxt(elComboMax, S.comboMax|0);
  setTxt(elMiss, S.misses|0);
  setTxt(elTime, S.timeLeftSec|0);

  const acc = accuracyGoodPct();
  const g = gradeFrom(S.score, acc);
  setTxt(elGrade, g);

  fire('hha:score', {
    score: S.score|0,
    combo: S.combo|0,
    comboMax: S.comboMax|0,
    misses: S.misses|0
  });
  fire('hha:time', { left: S.timeLeftSec|0 });
  fire('hha:rank', { grade: g, accuracy: acc });
}

function setMiniRow(el, ok, valEl, val){
  try{
    if (el){
      el.classList.remove('ok','bad');
      el.classList.add(ok ? 'ok' : 'bad');
    }
    if (valEl) valEl.textContent = String(val ?? '—');
  }catch{}
}

function updateMiniUI(){
  const inStorm = !!S.stormActive;
  const z = zoneFrom(S.waterPct);
  const zoneOk = (z !== 'GREEN'); // LOW or HIGH required
  const pOk = (S.pressure >= 70);
  const endOk = (S.stormActive && (S.stormLeftSec <= DIFF.endWindowSec));
  const blockOk = !!S.miniBlockedInEnd;

  setMiniRow(miniCStorm, inStorm, miniVStorm, inStorm ? 'YES' : 'NO');
  setMiniRow(miniCZone, zoneOk, miniVZone, z);
  setMiniRow(miniCPressure, pOk, miniVPressure, Math.round(S.pressure) + '%');
  setMiniRow(miniCEnd, endOk, miniVEnd, endOk ? 'NOW' : (S.stormActive ? (S.stormLeftSec.toFixed(1) + 's') : '—'));
  setMiniRow(miniCBlock, blockOk, miniVBlock, blockOk ? 'DONE' : 'PENDING');

  const pp = clamp(S.pressure, 0, 100);
  setTxt(elMiniPressurePct, Math.round(pp));
  try{ if (elMiniPressureBar) elMiniPressureBar.style.width = pp.toFixed(1) + '%'; }catch{}

  // next storm countdown
  setTxt(elMiniStormIn, S.stormActive ? '0' : (S.stormNextInSec|0));
  setTxt(elStormLeft, S.stormActive ? (S.stormLeftSec|0) : 0);

  // quest lines (simple, readable)
  setTxt(elQuest1, `คุมให้อยู่โซน GREEN ให้ได้บ่อย ๆ (45–65)`);
  setTxt(elQuest2, `ACC ${accuracyGoodPct()}% • Good ${S.nHitGood}/${S.nSpawnGood}`);
  setTxt(elQuest3, `Mini: Shield Timing (FULL)`);
  setTxt(elQuest4, `${(blockOk?1:0)}/1 • Pressure ${Math.round(S.pressure)}%`);
  fire('quest:update', {
    goalTitle: 'คุมระดับน้ำให้อยู่ GREEN',
    goalNow: S.nHitGood|0,
    goalNeed: Math.max(1, S.nSpawnGood|0),

    miniTitle: 'Shield Timing (FULL)',
    miniNow: (blockOk?1:0),
    miniNeed: 1,
    miniLeftSec: S.stormActive ? Math.max(0, Math.ceil(S.stormLeftSec)) : 0,
    miniUrgent: S.stormActive && (S.stormLeftSec <= DIFF.endWindowSec + 2),
    goalsCleared: 0,
    goalsTotal: 1,
    miniCleared: (blockOk?1:0),
    miniTotal: 1
  });
}

function setStorm(on){
  on = !!on;
  if (on === S.stormActive) return;

  S.stormActive = on;
  if (on){
    S.stormLeftSec = DIFF.stormDur;
    S.miniBlockedInEnd = false;

    DOC.body.classList.add('storm');
    setCoach('🌪️ STORM! เป้าเร็วขึ้น + เล็กลง', 'ปลายพายุให้ “บล็อก BAD” ด้วย Shield ตอน End-window');
  }else{
    DOC.body.classList.remove('storm','storm-warn');
    DOC.documentElement.style.setProperty('--warnamp','0');
    // schedule next
    S.stormNextInSec = DIFF.stormEvery;
    setCoach('ดีมาก! พายุจบแล้ว ✨', 'เตรียมคุมโซนน้ำต่อ');
  }

  ROOT.__HVR__.S.stormActive = S.stormActive;
  ROOT.__HVR__.S.stormLeftSec = S.stormLeftSec;
}

function updateStorm(dt){
  if (S.ended) return;

  if (!S.stormActive){
    S.stormNextInSec = Math.max(0, S.stormNextInSec - dt);
    if (S.stormNextInSec <= 6){
      DOC.body.classList.add('storm-warn');
      DOC.documentElement.style.setProperty('--warnamp', String(clamp((6 - S.stormNextInSec)/6, 0, 1)));
    }else{
      DOC.body.classList.remove('storm-warn');
      DOC.documentElement.style.setProperty('--warnamp','0');
    }
    if (S.stormNextInSec <= 0){
      setStorm(true);
    }
    return;
  }

  // storm active
  S.stormLeftSec = Math.max(0, S.stormLeftSec - dt);
  ROOT.__HVR__.S.stormLeftSec = S.stormLeftSec;

  // pressure rises in storm, decays otherwise
  S.pressure = clamp(S.pressure + (dt * 8.2), 0, 100);

  const inEnd = (S.stormLeftSec <= DIFF.endWindowSec);
  if (inEnd){
    // ramp danger visuals for end-window via HTML driver (reads __HVR__)
    // also bump screen shake locally (optional)
    DOC.body.classList.add('fx-shake');
  }else{
    DOC.body.classList.remove('fx-shake');
  }

  if (S.stormLeftSec <= 0){
    setStorm(false);
    // small relax
    S.pressure = clamp(S.pressure - 22, 0, 100);
  }
}

// ----------------------------- spawning -----------------------------
let Spawn = null;         // mode-factory instance (if available)
let spawnTimer = 0;
let decayTimer = 0;

function choiceKind(){
  const r = Math.random();
  const a = DIFF.goodWeight;
  const b = a + DIFF.badWeight;
  const c = b + DIFF.shieldWeight;
  if (r < a) return 'GOOD';
  if (r < b) return 'BAD';
  if (r < c) return 'SHIELD';
  return 'GOOD';
}

function makeTargetEl(kind){
  const el = DOC.createElement('button');
  el.type = 'button';
  el.setAttribute('data-hha-target','1');
  el.style.position = 'absolute';
  el.style.border = 'none';
  el.style.background = 'transparent';
  el.style.padding = '0';
  el.style.margin = '0';
  el.style.cursor = 'pointer';
  el.style.userSelect = 'none';
  el.style.touchAction = 'manipulation';
  el.style.filter = 'drop-shadow(0 14px 28px rgba(0,0,0,.45))';

  let emoji = '💧';
  let cls = 'hvr-good';
  if (kind === 'BAD'){ emoji = '🥤'; cls = 'hvr-bad'; }
  if (kind === 'SHIELD'){ emoji = '🛡️'; cls = 'hvr-shield'; }

  el.className = cls;
  el.dataset.kind = kind;

  // emoji "target"
  const span = DOC.createElement('span');
  span.textContent = emoji;
  span.style.display = 'inline-block';
  span.style.fontSize = '46px';
  span.style.lineHeight = '1';
  span.style.transform = 'translateZ(0)';
  span.style.willChange = 'transform, filter';
  el.appendChild(span);

  // ring hint
  el.style.transition = 'transform .08s ease';
  el.addEventListener('pointerdown', (e)=>{
    e.preventDefault();
    e.stopPropagation();
    onHitTarget(el);
  }, { passive:false });

  return el;
}

// fallback random placement inside playfield
function randPlace(el, size){
  const pf = elPlayfield;
  const layer = elLayer;
  if (!pf || !layer) return;

  const r = pf.getBoundingClientRect();
  const pad = 14;
  const w = Math.max(1, r.width);
  const h = Math.max(1, r.height);

  const x = pad + Math.random() * Math.max(1, w - pad*2 - size);
  const y = pad + Math.random() * Math.max(1, h - pad*2 - size);

  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  el.style.width = size + 'px';
  el.style.height = size + 'px';

  const span = el.firstChild;
  if (span && span.style){
    const em = Math.max(28, Math.round(size * 0.52));
    span.style.fontSize = em + 'px';
  }

  layer.appendChild(el);
}

function spawnOne(){
  if (S.ended) return;
  if (!elLayer || !elPlayfield) return;

  const k = choiceKind();
  const sizeBase = DIFF.baseSize * (S.stormActive ? 0.82 : 1.0);
  const size = clamp(sizeBase, 56, 140);

  // count
  if (k === 'GOOD') S.nSpawnGood++;
  if (k === 'BAD') S.nSpawnBad++;
  if (k === 'SHIELD') S.nSpawnShield++;

  // If mode-factory available, use it, else fallback
  if (Spawn && typeof Spawn.spawn === 'function'){
    try{
      Spawn.spawn({
        kind: k,
        elementFactory: ()=> makeTargetEl(k),
        sizePx: size,
        // in play mode allow adaptive (factory side), in research fixed
        adaptive: ADAPTIVE_ON
      });
      return;
    }catch{}
  }

  // fallback spawn
  const el = makeTargetEl(k);
  randPlace(el, size);
}

function removeTarget(el){
  try{ el?.remove(); }catch{}
}

function onHitTarget(el){
  if (!el || S.ended) return;

  const kind = String(el.dataset.kind || 'GOOD');
  removeTarget(el);

  // end-window check
  const inEnd = S.stormActive && (S.stormLeftSec <= DIFF.endWindowSec);

  if (kind === 'SHIELD'){
    S.nHitShield++;
    addShield(1);
    addScore(40 + (S.stormActive ? 10 : 0), 'shield');
    addFever(+3);
    Particles.burstAt?.('shield');
    setCoach('🛡️ ได้ Shield!', 'ใช้บล็อก “BAD” ตอน End-window ของพายุจะผ่าน mini');
    updateHUD();
    updateMiniUI();
    return;
  }

  if (kind === 'GOOD'){
    S.nHitGood++;
    S.combo++;
    S.comboMax = Math.max(S.comboMax, S.combo);
    S.perfect += (S.combo > 0 && (S.combo % 6 === 0)) ? 1 : 0;

    setWater(S.waterPct + DIFF.goodDelta);
    addScore(55 + Math.min(90, S.combo*3), 'good');
    addFever(+2.2);

    Particles.burstAt?.('good');
    updateHUD();
    updateMiniUI();
    return;
  }

  // BAD
  S.nHitBad++;

  if (useShield()){
    S.nBadGuarded++;
    addScore(65 + (inEnd ? 30 : 0), 'guard');
    addFever(+1.2);
    Particles.burstAt?.('guard');

    if (inEnd){
      S.miniBlockedInEnd = true;
      setCoach('✅ บล็อก BAD สำเร็จ!', 'Mini ผ่านแล้ว! (Shield Timing FULL)');
    }else{
      setCoach('บล็อก BAD ด้วย Shield ✅', 'เก็บไว้ใช้ตอน End-window ก็ได้');
    }

    updateHUD();
    updateMiniUI();
    return;
  }

  // no shield => penalty
  S.combo = 0;
  S.misses += DIFF.missPenalty;
  setWater(S.waterPct + DIFF.badDelta);
  addScore(-30, 'bad');
  addFever(-3.5);
  Particles.burstAt?.('bad');

  setCoach('❌ โดน BAD!', 'ถ้ามี Shield จะบล็อกได้ — ช่วง End-window ยิ่งสำคัญ');
  updateHUD();
  updateMiniUI();
}

// shoot center: if target at center => hit, else miss
function shootCenter(){
  if (S.ended) return;

  if (!elPlayfield) return;

  const r = elPlayfield.getBoundingClientRect();
  const cx = r.left + r.width/2;
  const cy = r.top + r.height/2;

  let hitEl = null;
  try{
    const el = DOC.elementFromPoint(cx, cy);
    if (el){
      hitEl = el.closest?.('[data-hha-target="1"]') || null;
    }
  }catch{}

  if (hitEl){
    onHitTarget(hitEl);
    return;
  }

  // miss shot
  S.combo = 0;
  S.misses += 1;
  S.nShotMiss++;
  Particles.scorePop?.('miss', -1);
  updateHUD();
  updateMiniUI();
}

// bind shoot triggers (works for mouse + synthShoot from HTML)
(function bindShoot(){
  if (!DOC) return;

  // click anywhere on playfield = shoot
  elPlayfield?.addEventListener('pointerdown', (e)=>{
    // avoid double-fire when tapping a target (targets stopPropagation)
    shootCenter();
  }, { passive:true });

  // if a dedicated button exists
  const btnShoot = pick('btnShoot','cbShoot');
  btnShoot?.addEventListener('click', (e)=>{
    e.preventDefault();
    shootCenter();
  }, { passive:false });

  // keyboard (desktop)
  ROOT.addEventListener('keydown', (e)=>{
    if (e.code === 'Space' || e.code === 'Enter'){
      shootCenter();
    }
  }, { passive:true });
})();

// ----------------------------- end + logger -----------------------------
function buildSummary(reason){
  const acc = accuracyGoodPct();
  const grade = gradeFrom(S.score, acc);

  return {
    timestampIso: nowIso(),
    projectTag: PROJECT_TAG,
    runMode: PLAY_TAG,
    studyId,
    phase,
    conditionGroup,
    sessionOrder,
    blockLabel,
    siteCode,
    sessionId: String(qs('sessionId','') || ''),
    studentKey,

    gameMode: 'hydration',
    diff,
    durationPlannedSec: timePlannedSec,
    durationPlayedSec: Math.max(0, Math.round((S.tNow - S.tStart)/1000)),

    scoreFinal: S.score|0,
    comboMax: S.comboMax|0,
    misses: S.misses|0,
    perfect: S.perfect|0,

    goalsCleared: 0,
    goalsTotal: 1,
    miniCleared: (S.miniBlockedInEnd ? 1 : 0),
    miniTotal: 1,

    nTargetGoodSpawned: S.nSpawnGood|0,
    nTargetJunkSpawned: S.nSpawnBad|0,      // keep column name used elsewhere
    nTargetShieldSpawned: S.nSpawnShield|0,

    nHitGood: S.nHitGood|0,
    nHitJunk: S.nHitBad|0,
    nHitJunkGuard: S.nBadGuarded|0,

    accuracyGoodPct: acc,
    device: String(qs('device','') || ''),
    gameVersion: VERSION,
    reason: String(reason || '')
  };
}

function logSummary(payload){
  if (!payload) return;

  // optional cloud logger (IIFE)
  try{
    const L = ROOT.HHACloudLogger || (ROOT.GAME_MODULES && ROOT.GAME_MODULES.HHACloudLogger);
    if (L && typeof L.log === 'function'){
      L.log(payload, { endpoint: logEndpoint || undefined });
      return;
    }
  }catch{}

  // direct fetch if ?log=URL is provided
  if (logEndpoint){
    try{
      fetch(logEndpoint, {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body: JSON.stringify(payload)
      }).catch(()=>{});
    }catch{}
  }
}

function showEnd(summary){
  // emit event (HUD/HTML can render it)
  fire('hha:end', summary);

  // try to fill local end UI if exists (optional)
  try{
    const el = DOC.getElementById('end-score'); if (el) el.textContent = String(summary.scoreFinal ?? 0);
    const eg = DOC.getElementById('end-grade'); if (eg) eg.textContent = String(summary.grade ?? gradeFrom(summary.scoreFinal||0, summary.accuracyGoodPct||0));
    const ec = DOC.getElementById('end-combo'); if (ec) ec.textContent = String(summary.comboMax ?? 0);
    const em = DOC.getElementById('end-miss');  if (em) em.textContent = String(summary.misses ?? 0);
    const egs= DOC.getElementById('end-goals'); if (egs) egs.textContent = String(summary.goalsCleared ?? 0) + '/' + String(summary.goalsTotal ?? 0);
    const emi= DOC.getElementById('end-minis'); if (emi) emi.textContent = String(summary.miniCleared ?? 0);

    if (endMount){
      // common patterns
      if (endMount.classList) endMount.classList.add('show');
      endMount.style.display = 'flex';
    }
  }catch{}
}

function endGame(reason){
  if (S.ended) return;
  S.ended = true;

  DOC.body.classList.remove('storm','storm-warn','fx-shake');
  DOC.documentElement.style.setProperty('--warnamp','0');

  const summary = buildSummary(reason || 'timeup');

  // persist last summary
  try{
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
    localStorage.setItem('hha_last_summary', JSON.stringify(summary));
  }catch{}

  logSummary(summary);
  showEnd(summary);
}

// ----------------------------- main loop -----------------------------
function tick(t){
  if (!S.started || S.ended) return;

  if (!S.tStart) S.tStart = t;
  const dt = Math.min(0.05, Math.max(0.001, (t - (S.tNow||t))/1000));
  S.tNow = t;

  // countdown
  S.timeLeftSec = Math.max(0, S.timeLeftSec - dt);
  if (S.timeLeftSec <= 0){
    updateHUD();
    updateMiniUI();
    endGame('timeup');
    return;
  }

  // storm dynamics
  updateStorm(dt);

  // passive pressure decay outside storm
  if (!S.stormActive){
    S.pressure = clamp(S.pressure - (dt * 10.5), 0, 100);
  }

  // slight water drift toward 50 (stability) in play, fixed in research
  decayTimer += dt;
  if (decayTimer >= 0.9){
    decayTimer = 0;
    if (ADAPTIVE_ON){
      const toward = 50;
      const d = (toward - S.waterPct) * 0.06;
      setWater(S.waterPct + d);
    }
  }

  // spawn pacing (faster in storm)
  const pace = DIFF.spawnEvery * (S.stormActive ? 0.78 : 1.0);
  spawnTimer += dt;
  while (spawnTimer >= pace){
    spawnTimer -= pace;
    spawnOne();
  }

  // visuals hint
  DOC.body.classList.toggle('fx-high', S.waterPct > 65);
  DOC.body.classList.toggle('fx-low',  S.waterPct < 45);

  updateHUD();
  updateMiniUI();

  ROOT.__HVR__.S.stormActive = S.stormActive;
  ROOT.__HVR__.S.stormLeftSec = S.stormLeftSec;

  requestAnimationFrame(tick);
}

// ----------------------------- start gate -----------------------------
async function initFactory(){
  // try mode-factory (if API matches)
  try{
    if (!elLayer || !elPlayfield) return;

    const sp = factoryBoot({
      spawnHost: elLayer,
      boundsHost: elPlayfield,
      seed,
      adaptive: ADAPTIVE_ON,
      // suggested defaults (factory can ignore unknown keys safely)
      spawnStrategy: 'grid9',
      spawnAroundCrosshair: false,
      baseSizePx: DIFF.baseSize,
      safezoneAuto: true
    });

    // support both sync/async returns
    Spawn = (sp && typeof sp.then === 'function') ? await sp : sp;
  }catch{
    Spawn = null;
  }
}

function startGame(){
  if (S.started) return;
  S.started = true;

  ensureWaterGauge();
  setWater(50);
  addFever(0);
  addShield(0);

  setCoach('พร้อมลุย! คุมระดับน้ำให้อยู่ GREEN 💧', 'Storm จะมาทุก ๆ ช่วง — เก็บ Shield ไว้บล็อก BAD ตอน End-window');

  initFactory().finally(()=>{
    updateHUD();
    updateMiniUI();
    requestAnimationFrame(tick);
  });
}

function tryBindStartOverlay(){
  // supports multiple HTML variants
  const overlay = startOverlay;
  const b = btnStart;

  if (overlay && b){
    // wait for user click
    b.addEventListener('click', async ()=>{
      try{
        // attempt motion/audio unlock gently
        const DME = ROOT.DeviceMotionEvent;
        if (DME && typeof DME.requestPermission === 'function'){
          try{ await DME.requestPermission(); }catch{}
        }
        const AC = ROOT.AudioContext || ROOT.webkitAudioContext;
        if (AC){
          try{
            const ctx = new AC();
            if (ctx.state === 'suspended') await ctx.resume();
            await ctx.close();
          }catch{}
        }
      }catch{}
      try{ overlay.style.display = 'none'; }catch{}
      startGame();
    }, { passive:true });

    return;
  }

  // no overlay => autostart
  startGame();
}

tryBindStartOverlay();
updateHUD();
updateMiniUI();
::contentReference[oaicite:0]{index=0}
