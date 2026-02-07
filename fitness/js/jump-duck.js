// === /fitness/js/jump-duck.js — Jump-Duck (Boss 3 phases + Hype Pack + LOG + MOTION) v20260207b ===
'use strict';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

function fatal(msg){
  const box = document.getElementById('jd-fatal');
  if (!box) { alert(msg); return; }
  box.textContent = msg;
  box.classList.remove('jd-hidden');
}
window.addEventListener('error', (e)=>{
  fatal('JS ERROR:\n' + (e?.message || e) + '\n\n' + (e?.filename||'') + ':' + (e?.lineno||'') + ':' + (e?.colno||''));
});
window.addEventListener('unhandledrejection', (e)=>{
  fatal('PROMISE REJECTION:\n' + (e?.reason?.message || e?.reason || e));
});

/* -------------------------
   QS / HHA ctx
------------------------- */
function getQS(){
  try { return new URL(location.href).searchParams; }
  catch { return new URLSearchParams(); }
}
const QS = getQS();
function qsGet(k, d=''){
  const v = QS.get(k);
  return (v==null || String(v).trim()==='') ? d : String(v);
}

const HHA_CTX = {
  hub: qsGet('hub',''),
  view: (qsGet('view','') || '').toLowerCase(),
  mode: (qsGet('mode','') || qsGet('runMode','') || '').toLowerCase(),
  diff: (qsGet('diff','') || '').toLowerCase(),
  duration: qsGet('duration', qsGet('time','')),
  seed: qsGet('seed',''),
  studyId: qsGet('studyId',''),
  phase: qsGet('phase',''),
  conditionGroup: qsGet('conditionGroup',''),
  pid: qsGet('pid',''),
  group: qsGet('group',''),
  note: qsGet('note',''),
  log: qsGet('log','')
};

function detectView(){
  if (HHA_CTX.view) return HHA_CTX.view;
  const ua = navigator.userAgent || '';
  const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const w = Math.min(window.innerWidth||0, document.documentElement.clientWidth||0, screen.width||9999);
  const h = Math.min(window.innerHeight||0, document.documentElement.clientHeight||0, screen.height||9999);
  const small = Math.min(w,h) <= 520;
  const isMobileUA = /Android|iPhone|iPad|iPod/i.test(ua);
  if ((touch || isMobileUA) && small) return 'cvr';
  if (touch || isMobileUA) return 'mobile';
  return 'pc';
}
function applyViewClass(view){
  const b = document.body;
  b.classList.remove('view-pc','view-mobile','view-cvr','view-vr');
  if (view === 'vr') b.classList.add('view-vr');
  else if (view === 'cvr') b.classList.add('view-cvr');
  else if (view === 'mobile') b.classList.add('view-mobile');
  else b.classList.add('view-pc');
}
applyViewClass(detectView());

/* -------------------------
   Optional: auto-load VR UI if WebXR exists
------------------------- */
async function ensureVrUi(){
  try{
    if (window.__HHA_VRUI_LOADED__) return true;
    if (!('xr' in navigator)) return false;
    const src = '../herohealth/vr/vr-ui.js';
    await new Promise((resolve,reject)=>{
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = ()=>reject(new Error('Failed to load '+src));
      document.head.appendChild(s);
    });
    return true;
  }catch(e){
    console.warn(e);
    return false;
  }
}

/* -------------------------
   Seeded RNG
------------------------- */
function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function strToSeed(s){
  const str = String(s||'');
  let h = 2166136261 >>> 0;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function getSeed(){
  if (HHA_CTX.seed) return strToSeed(HHA_CTX.seed);
  return (Date.now() >>> 0);
}
let RNG = mulberry32(getSeed());

/* -------------------------
   DOM refs
------------------------- */
const viewMenu   = $('#view-menu');
const viewPlay   = $('#view-play');
const viewResult = $('#view-result');

const elMode     = $('#jd-mode');
const elDiff     = $('#jd-diff');
const elDuration = $('#jd-duration');

const elResearchBlock = $('#jd-research-block');
const elPid     = $('#jd-participant-id');
const elGroup   = $('#jd-group');
const elNote    = $('#jd-note');

const elMotionOpt = $('#jd-motion-opt');
const elMotionEnable = $('#jd-motion-enable');
const elMotionCalib  = $('#jd-motion-calib');
const elMotionStatus = $('#jd-motion-status');

const elHudMode   = $('#hud-mode');
const elHudDiff   = $('#hud-diff');
const elHudDur    = $('#hud-duration');
const elHudStab   = $('#hud-stability');
const elHudObs    = $('#hud-obstacles');
const elHudScore  = $('#hud-score');
const elHudCombo  = $('#hud-combo');
const elHudTime   = $('#hud-time');

const elPlayArea  = $('#jd-play-area');
const elAvatar    = $('#jd-avatar');
const elObsHost   = $('#jd-obstacles');
const elJudge     = $('#jd-judge');

const resMode         = $('#res-mode');
const resDiff         = $('#res-diff');
const resDuration     = $('#res-duration');
const resTotalObs     = $('#res-total-obs');
const resHits         = $('#res-hits');
const resMiss         = $('#res-miss');
const resJumpHit      = $('#res-jump-hit');
const resDuckHit      = $('#res-duck-hit');
const resJumpMiss     = $('#res-jump-miss');
const resDuckMiss     = $('#res-duck-miss');
const resAcc          = $('#res-acc');
const resRTMean       = $('#res-rt-mean');
const resStabilityMin = $('#res-stability-min');
const resScore        = $('#res-score');
const resRank         = $('#res-rank');

const backHubMenu   = $('#jd-back-hub-menu');
const backHubPlay   = $('#jd-back-hub-play');
const backHubResult = $('#jd-back-hub-result');

/* -------------------------
   SFX
------------------------- */
function playSfx(id){
  const el = document.getElementById(id);
  if (!el) return;
  try{ el.currentTime = 0; el.play().catch(()=>{}); }catch{}
}

/* -------------------------
   Core Config
------------------------- */
const JD_DIFFS = {
  easy:   { speed: 38, spawnMs: 1300, hitWinMs: 260, stabDmg: 10, stabGain: 3, score: 12 },
  normal: { speed: 48, spawnMs: 1000, hitWinMs: 220, stabDmg: 13, stabGain: 3, score: 14 },
  hard:   { speed: 62, spawnMs:  800, hitWinMs: 200, stabDmg: 16, stabGain: 4, score: 16 }
};

/* A) Boss 3 phases */
const PHASE_THRESH = [0.30, 0.62]; // phase1/2/3 timing
const BOSS = {
  // “บอส” ทำงานใน phase3: เปิดตอน progress >= PHASE_THRESH[1]
  hpBase: { easy: 9, normal: 12, hard: 15 },
  // บอสต้อง “ชนะ” ด้วย hit สะสม (ทุก hit ใน phase3 ลด hp)
  // มี pattern เป็นช่วงๆ สร้างแรงกดดัน
  patternSec: 7.0,
  telegraphMs: 260,     // เตือนก่อน “พายุ” เล็กน้อย
  stormSec: 2.8,        // ช่วงพายุ = spawn แน่น
  stormSpawnMul: 0.60,  // spawn interval * 0.60
  speedMul: 1.22        // speed * 1.22 ในพายุ
};

/* B) Hype pack */
const HYPE = {
  perfectMs: 85,         // rt <= perfectMs => PERFECT
  nearMissWindow: 1.25,  // ถ้า rt เกิน hitWin แต่ไม่เกิน *nearMissWindow => NEAR MISS
  slowmoMs: 220,         // slow-mo duration
  slowmoScale: 0.62,     // dt scale
  feverPerHit: 8.5,
  feverPerPerfect: 13,
  feverDrainPerSec: 5.4,
  feverOnAt: 55,
  feverOffAt: 25,
  feverBonusMul: 1.20,   // score bonus in fever
  perkComboAt: 10        // combo >= perkComboAt => “Shield 1 hit”
};

const SPAWN_X  = 100;
const CENTER_X = 24;
const MISS_X   = 4;

/* -------------------------
   State
------------------------- */
let running = false;
let state = null;
let rafId = null;
let lastFrame = null;
let judgeTimer = null;
let lastAction = null;
let nextObstacleId = 1;

/* -------------------------
   AI Predictor (fair)
------------------------- */
function createAIPredictor(){
  const mem = { streakMiss:0, missJump:0, missDuck:0, lastRT:220, bias:0 };

  function onHit(needType, rt){
    mem.streakMiss = 0;
    if (Number.isFinite(rt)) mem.lastRT = 0.85*mem.lastRT + 0.15*rt;
    mem.bias *= 0.92;
  }
  function onMiss(needType){
    mem.streakMiss++;
    if (needType === 'jump') mem.missJump++; else mem.missDuck++;
    const total = mem.missJump + mem.missDuck + 1;
    const dj = mem.missDuck / total;
    const jj = mem.missJump / total;
    mem.bias = (dj - jj) * 0.35;
    mem.bias = Math.max(-0.35, Math.min(0.35, mem.bias));
  }
  function pickType(baseRand){
    const t = baseRand + mem.bias;
    return (t >= 0.5) ? 'high' : 'low';
  }
  function adjustSpawnInterval(ms, phase, mode){
    let out = ms;
    if (mode === 'training'){
      if (phase === 3) out *= 0.92;
      if (mem.streakMiss >= 2) out *= 1.12;
    }
    return Math.max(480, Math.min(1900, out));
  }
  function getHint(){
    if (mem.streakMiss >= 2) return 'ทิป: กด “ก่อนถึงเส้น” นิดเดียว จะนิ่งขึ้น ✨';
    if (mem.lastRT > 260) return 'ทิป: ลองตอบสนองเร็วขึ้นอีกนิด จะได้ PERFECT 🔥';
    return '';
  }
  return { onHit, onMiss, pickType, adjustSpawnInterval, getHint };
}
const AI = createAIPredictor();

/* -------------------------
   Views
------------------------- */
function showView(name){
  [viewMenu,viewPlay,viewResult].forEach(v=> v && v.classList.add('jd-hidden'));
  if (name === 'menu')   viewMenu?.classList.remove('jd-hidden');
  if (name === 'play')   viewPlay?.classList.remove('jd-hidden');
  if (name === 'result') viewResult?.classList.remove('jd-hidden');
}
function showJudge(text, kind){
  if (!elJudge) return;
  elJudge.textContent = text;
  elJudge.className = 'jd-judge show';
  if (kind) elJudge.classList.add(kind);
  if (judgeTimer) clearTimeout(judgeTimer);
  judgeTimer = setTimeout(()=> elJudge.classList.remove('show'), 560);
}
function modeLabel(mode){
  if (mode === 'training') return 'Training';
  if (mode === 'test') return 'Test';
  if (mode === 'research') return 'Research';
  if (mode === 'tutorial') return 'Tutorial';
  return 'Play';
}

/* -------------------------
   Hub backlinks
------------------------- */
function setHubLinks(){
  const hub = HHA_CTX.hub || '';
  if (!hub) return;
  [backHubMenu, backHubPlay, backHubResult].forEach(a=>{ if (a) a.href = hub; });
}

/* -------------------------
   Participant meta
------------------------- */
function updateResearchVisibility(){
  const mode = (elMode?.value) || 'training';
  if (!elResearchBlock) return;
  if (mode === 'research') elResearchBlock.classList.remove('jd-hidden');
  else elResearchBlock.classList.add('jd-hidden');
}
function collectParticipant(metaMode){
  if (metaMode !== 'research') return {id:'', group:'', note:''};
  return {
    id: (elPid?.value || HHA_CTX.pid || '').trim(),
    group: (elGroup?.value || HHA_CTX.group || '').trim(),
    note: (elNote?.value || HHA_CTX.note || '').trim()
  };
}

/* -------------------------
   Logger (sessions/events) + flush-hardened
------------------------- */
const LOG_URL = HHA_CTX.log || '';
function safeJson(v){ try{ return JSON.stringify(v); }catch{ return ''; } }
function postBeacon(url, payloadObj){
  try{
    if (!url) return false;
    const blob = new Blob([safeJson(payloadObj)], { type: 'application/json' });
    if (navigator.sendBeacon) return navigator.sendBeacon(url, blob);
  }catch{}
  return false;
}
async function postKeepalive(url, payloadObj){
  if (!url) return false;
  try{
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type':'application/json' },
      body: safeJson(payloadObj),
      keepalive: true,
      mode: 'no-cors'
    });
    return true;
  }catch{ return false; }
}
const __JD_FLUSH = { flushing:false, flushed:false, lastHash:'' };

function toCsv(rows){
  if (!rows || !rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v)=>{
    if (v == null) return '';
    const s = String(v);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  };
  const lines = [cols.join(',')];
  for (const r of rows) lines.push(cols.map(c=>esc(r[c])).join(','));
  return lines.join('\n');
}

function buildSummary(){
  if (!state) return null;
  const total = state.obstaclesSpawned || 0;
  const hits  = state.hits || 0;
  const miss  = state.miss || 0;
  const acc   = total ? hits/total : 0;
  const rtMean = state.hitRTs.length ? state.hitRTs.reduce((a,b)=>a+b,0)/state.hitRTs.length : 0;

  return {
    session_id: state.sessionId,
    game: 'jump-duck',
    mode: state.mode,
    diff: state.diffKey,
    duration_planned_s: (state.durationMs||0)/1000,
    duration_actual_s: (state.elapsedMs||0)/1000,
    obstacles_total: total,
    hits_total: hits,
    miss_total: miss,
    jump_hit: state.jumpHit||0,
    duck_hit: state.duckHit||0,
    jump_miss: state.jumpMiss||0,
    duck_miss: state.duckMiss||0,
    acc_pct: +(acc*100).toFixed(2),
    rt_mean_ms: rtMean ? +rtMean.toFixed(1) : 0,
    stability_min_pct: +(state.minStability||0).toFixed(1),
    score_final: Math.round(state.score||0),
    boss_hp_start: state.boss?.hpStart ?? '',
    boss_hp_end: state.boss?.hp ?? '',
    boss_defeated: state.boss?.defeated ? 1 : 0,
    fever_time_s: +(state.feverTimeMs/1000).toFixed(2),
    perfect_hits: state.perfectHits||0,
    near_miss: state.nearMiss||0,
    participant_id: state.participant?.id || '',
    group: state.participant?.group || '',
    note: state.participant?.note || '',
    seed: HHA_CTX.seed || '',
    studyId: HHA_CTX.studyId || '',
    phase: HHA_CTX.phase || '',
    conditionGroup: HHA_CTX.conditionGroup || ''
  };
}

function buildPayload(reason){
  const summary = buildSummary();
  const events = (state && state.events) ? state.events : [];
  const sessions = summary ? [summary] : [];
  const hash = (summary?.session_id||'') + '|' + (reason||'') + '|' + events.length;
  return {
    kind: 'herohealth_log_v2',
    game: 'jump-duck',
    reason: reason || '',
    ctx: {
      hub: HHA_CTX.hub || '',
      view: detectView(),
      seed: HHA_CTX.seed || '',
      studyId: HHA_CTX.studyId || '',
      phase: HHA_CTX.phase || '',
      conditionGroup: HHA_CTX.conditionGroup || ''
    },
    sessions,
    events,
    sessions_csv: toCsv(sessions),
    events_csv: toCsv(events),
    _hash: hash
  };
}

async function flushLog(reason){
  if (!LOG_URL) return false;
  if (__JD_FLUSH.flushing) return false;
  const payload = buildPayload(reason);
  if (__JD_FLUSH.flushed && __JD_FLUSH.lastHash === payload._hash) return true;

  __JD_FLUSH.flushing = true;
  try{
    let ok = postBeacon(LOG_URL, payload);
    if (!ok) ok = await postKeepalive(LOG_URL, payload);
    if (ok){
      __JD_FLUSH.flushed = true;
      __JD_FLUSH.lastHash = payload._hash;
    }
    return ok;
  } finally {
    __JD_FLUSH.flushing = false;
  }
}

/* -------------------------
   Motion Control (opt-in)
------------------------- */
const MOT = {
  enabled:false, allowed:false, active:false,
  basePitch:0, pitch:0, az:0,
  lastJumpAt:0, lastDuckAt:0,
  duckPitchDeg:18, jumpAz:14.0,
  cooldownMs:550, smooth:0.18
};

function setMotionUI(){
  if (!elMotionStatus || !elMotionEnable || !elMotionCalib) return;
  const want = !!(elMotionOpt && elMotionOpt.checked);

  if (!want){
    elMotionStatus.classList.add('jd-hidden');
    elMotionEnable.classList.add('jd-hidden');
    elMotionCalib.classList.add('jd-hidden');
    return;
  }

  elMotionStatus.classList.remove('jd-hidden');
  elMotionCalib.classList.remove('jd-hidden');

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent||'');
  const needPerm = isIOS && typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function';
  elMotionEnable.classList.toggle('jd-hidden', !needPerm);

  elMotionStatus.textContent =
    (MOT.active ? 'Motion: ON' : (MOT.allowed ? 'Motion: READY' : 'Motion: OFF'));
}

async function requestMotionPermissionIfNeeded(){
  try{
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent||'');
    if (!isIOS) { MOT.allowed = true; setMotionUI(); return true; }
    if (typeof DeviceMotionEvent === 'undefined') return false;
    if (typeof DeviceMotionEvent.requestPermission !== 'function'){ MOT.allowed = true; setMotionUI(); return true; }
    const res = await DeviceMotionEvent.requestPermission();
    MOT.allowed = (res === 'granted');
    setMotionUI();
    return MOT.allowed;
  }catch{
    MOT.allowed = false;
    setMotionUI();
    return false;
  }
}
function motionCalibrate(){ MOT.basePitch = MOT.pitch || 0; showJudge('CALIBRATE ✅', 'ok'); }
function onDeviceOrientation(ev){
  const beta = Number(ev && ev.beta);
  if (!Number.isFinite(beta)) return;
  const s = MOT.smooth;
  MOT.pitch = (1-s)*MOT.pitch + s*beta;
}
function onDeviceMotion(ev){
  const acc = ev && (ev.accelerationIncludingGravity || ev.acceleration);
  if (!acc) return;
  const z = Number(acc.z);
  if (!Number.isFinite(z)) return;
  const s = MOT.smooth;
  MOT.az = (1-s)*MOT.az + s*z;
}
function motionUpdate(now){
  if (!running || !state || !MOT.active) return;
  const dp = (MOT.pitch - MOT.basePitch);
  if (dp > MOT.duckPitchDeg && now - MOT.lastDuckAt > MOT.cooldownMs){
    MOT.lastDuckAt = now; triggerAction('duck', {source:'motion'});
  }
  const az = Math.abs(MOT.az);
  if (az > MOT.jumpAz && now - MOT.lastJumpAt > MOT.cooldownMs){
    MOT.lastJumpAt = now; triggerAction('jump', {source:'motion'});
  }
}
function motionStartIfWanted(){
  const want = !!(elMotionOpt && elMotionOpt.checked);
  MOT.enabled = want;
  if (!want){ MOT.active = false; setMotionUI(); return; }
  MOT.active = MOT.allowed;
  setMotionUI();
  if (MOT.active){
    window.addEventListener('deviceorientation', onDeviceOrientation, true);
    window.addEventListener('devicemotion', onDeviceMotion, true);
    setTimeout(()=>motionCalibrate(), 120);
  }
}
function motionStop(){
  if (!MOT.active) return;
  MOT.active = false;
  window.removeEventListener('deviceorientation', onDeviceOrientation, true);
  window.removeEventListener('devicemotion', onDeviceMotion, true);
  setMotionUI();
}

/* -------------------------
   Events helper
------------------------- */
function pushEvent(row){
  if (!state) return;
  if (!state.events) state.events = [];
  state.events.push(row);
}

/* -------------------------
   Boss + Fever + Slowmo helpers (A+B)
------------------------- */
function bossHpForDiff(diffKey){
  const base = BOSS.hpBase[diffKey] ?? BOSS.hpBase.normal;
  // test/research ให้แฟร์คงที่
  return base;
}

function setPlayFX(className, on){
  if (!elPlayArea) return;
  if (on) elPlayArea.classList.add(className);
  else elPlayArea.classList.remove(className);
}

function startSlowmo(){
  if (!state) return;
  state.slowmoUntil = performance.now() + HYPE.slowmoMs;
}

function feverTick(dtMs){
  if (!state) return;
  // drain
  state.fever = Math.max(0, state.fever - HYPE.feverDrainPerSec*(dtMs/1000));
  if (!state.feverOn && state.fever >= HYPE.feverOnAt){
    state.feverOn = true;
    showJudge('🔥 FEVER ON!', 'combo');
  } else if (state.feverOn && state.fever <= HYPE.feverOffAt){
    state.feverOn = false;
    showJudge('FEVER down…', 'ok');
  }
  if (state.feverOn) state.feverTimeMs += dtMs;
}

function addFever(amount){
  if (!state) return;
  state.fever = Math.min(100, state.fever + amount);
}

function bossPhaseUpdate(now){
  if (!state || !state.boss) return;
  const b = state.boss;

  // pattern loop inside phase3
  const t = (now - b.startAt) / 1000;
  const cycle = BOSS.patternSec;
  const p = (t % cycle);

  const stormStart = cycle - BOSS.stormSec;
  const inStorm = (p >= stormStart);

  // telegraph
  if (!b.warned && p >= stormStart - (BOSS.telegraphMs/1000)){
    b.warned = true;
    showJudge('⚠️ BOSS STORM!', 'miss');
    setPlayFX('jd-boss-warn', true);
    setTimeout(()=>setPlayFX('jd-boss-warn', false), BOSS.telegraphMs);
  }
  if (p < 0.25) b.warned = false;

  b.inStorm = inStorm;
}

/* -------------------------
   Gameplay
------------------------- */
function makeSessionId(){
  const t = new Date();
  const pad = (n)=>String(n).padStart(2,'0');
  return `JD-${t.getFullYear()}${pad(t.getMonth()+1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}`;
}

function startGameBase(opts){
  const mode = opts.mode || 'training';
  const diffKey = opts.diffKey || 'normal';
  const cfg0 = JD_DIFFS[diffKey] || JD_DIFFS.normal;
  const durationMs = opts.durationMs ?? 60000;
  const isTutorial = !!opts.isTutorial;

  RNG = mulberry32(getSeed());
  const now = performance.now();

  state = {
    sessionId: makeSessionId(),
    mode, diffKey, cfg0, durationMs, isTutorial,
    startTime: now, elapsedMs:0, remainingMs:durationMs,

    stability:100, minStability:100,
    nextSpawnAt: now + 650,
    obstacles: [], obstaclesSpawned:0,

    hits:0, miss:0,
    jumpHit:0, duckHit:0, jumpMiss:0, duckMiss:0,

    combo:0, maxCombo:0,
    score:0,
    hitRTs: [],
    events: [],

    // B) hype metrics
    perfectHits: 0,
    nearMiss: 0,
    fever: 0,
    feverOn: false,
    feverTimeMs: 0,
    slowmoUntil: 0,
    shield: 0, // perk: blocks 1 miss when combo high

    // A) boss
    boss: null,

    participant: collectParticipant(mode),
    ctx: { ...HHA_CTX }
  };

  // boss init will happen when entering phase3

  running = true;
  lastFrame = now;
  __JD_FLUSH.flushed = false;
  __JD_FLUSH.lastHash = '';

  elObsHost && (elObsHost.innerHTML = '');
  elAvatar && elAvatar.classList.remove('jump','duck');

  elHudMode && (elHudMode.textContent = modeLabel(mode));
  elHudDiff && (elHudDiff.textContent = diffKey);
  elHudDur  && (elHudDur.textContent  = (durationMs/1000|0)+'s');
  elHudStab && (elHudStab.textContent = '100%');
  elHudObs  && (elHudObs.textContent  = '0 / 0');
  elHudScore&& (elHudScore.textContent= '0');
  elHudCombo&& (elHudCombo.textContent= '0');
  elHudTime && (elHudTime.textContent = (durationMs/1000).toFixed(1));

  showView('play');

  motionStop();
  motionStartIfWanted();

  if (rafId!=null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);

  showJudge(isTutorial ? 'Tutorial: Low=JUMP 🦘 · High=DUCK 🛡️' : 'READY ✨', 'ok');
}

function startGameFromMenu(){
  const mode = (elMode?.value || HHA_CTX.mode || 'training').toLowerCase();
  const diff = (elDiff?.value || HHA_CTX.diff || 'normal').toLowerCase();
  const durS = parseInt((elDuration?.value || HHA_CTX.duration || '60'),10) || 60;
  startGameBase({ mode, diffKey: diff, durationMs: durS*1000, isTutorial:false });
}
function startTutorial(){
  startGameBase({ mode:'training', diffKey:'easy', durationMs:15000, isTutorial:true });
}

function endGame(reason='ended'){
  running = false;
  motionStop();
  if (rafId!=null){ cancelAnimationFrame(rafId); rafId=null; }
  if (!state) return;

  if (state.isTutorial){
    showJudge('จบ Tutorial แล้ว! 🎉', 'ok');
    setTimeout(()=> showView('menu'), 650);
    return;
  }

  const total = state.obstaclesSpawned || 0;
  const hits  = state.hits || 0;
  const acc   = total ? hits/total : 0;
  const rtMean = state.hitRTs.length ? state.hitRTs.reduce((a,b)=>a+b,0)/state.hitRTs.length : 0;

  resMode && (resMode.textContent = modeLabel(state.mode));
  resDiff && (resDiff.textContent = state.diffKey);
  resDuration && (resDuration.textContent = (state.durationMs/1000|0)+'s');
  resTotalObs && (resTotalObs.textContent = String(total));
  resHits && (resHits.textContent = String(state.hits));
  resMiss && (resMiss.textContent = String(state.miss));

  resJumpHit && (resJumpHit.textContent = String(state.jumpHit));
  resDuckHit && (resDuckHit.textContent = String(state.duckHit));
  resJumpMiss&& (resJumpMiss.textContent= String(state.jumpMiss));
  resDuckMiss&& (resDuckMiss.textContent= String(state.duckMiss));

  resAcc && (resAcc.textContent = (acc*100).toFixed(1)+' %');
  resRTMean && (resRTMean.textContent = rtMean ? rtMean.toFixed(0)+' ms' : '-');
  resStabilityMin && (resStabilityMin.textContent = state.minStability.toFixed(1)+' %');
  resScore && (resScore.textContent = String(Math.round(state.score)));

  if (resRank){
    let rank = 'C';
    const stab = state.minStability;
    if (acc >= 0.92 && stab >= 86) rank='S';
    else if (acc >= 0.82 && stab >= 76) rank='A';
    else if (acc >= 0.66 && stab >= 60) rank='B';
    else if (acc < 0.40 || stab < 40)   rank='D';
    resRank.textContent = rank;
  }

  showView('result');
  flushLog('end:' + reason);
}

/* -------------------------
   Phase logic
------------------------- */
function getPhase(progress){
  if (progress < PHASE_THRESH[0]) return 1;
  if (progress < PHASE_THRESH[1]) return 2;
  return 3;
}

/* -------------------------
   Spawn rules (A: boss patterns)
------------------------- */
function bossSpawnMultiplier(){
  if (!state?.boss) return 1.0;
  return state.boss.inStorm ? BOSS.stormSpawnMul : 1.0;
}
function bossSpeedMultiplier(){
  if (!state?.boss) return 1.0;
  return state.boss.inStorm ? BOSS.speedMul : 1.0;
}

function spawnObstacle(ts, phase){
  if (!elObsHost || !state) return;
  const last = state.obstacles[state.obstacles.length - 1];
  if (last && last.x > 70) return;

  const r = RNG();

  // Phase 1: ให้ “อ่านเกม” ง่าย (สลับ)
  // Phase 2: ผสม + AI bias ฝึกจุดอ่อน
  // Phase 3: boss pattern: burst + pair บางที
  let type;
  if (phase === 1){
    type = (state.obstaclesSpawned % 2 === 0) ? 'low' : 'high';
  } else if (phase === 2){
    type = AI.pickType(r);
  } else {
    // boss: pattern director
    const b = state.boss;
    const t = b ? ((ts - b.startAt)/1000) : 0;
    const p = b ? (t % BOSS.patternSec) : 0;

    // ช่วงต้น cycle: alternation / กลาง: random / ท้าย: storm (bias จี้จุดอ่อนเล็กน้อย)
    if (p < 2.2) type = (state.obstaclesSpawned % 2 === 0) ? 'low' : 'high';
    else if (p < (BOSS.patternSec - BOSS.stormSec)) type = (RNG() < 0.52) ? 'low' : 'high';
    else type = AI.pickType(r); // storm ใช้ predictor ฝึก
  }

  const spawnPair = (phase === 3 && state.mode === 'training' && RNG() < 0.16);

  makeOne(type, ts);
  if (spawnPair){
    setTimeout(()=>{ if (running && state) makeOne(RNG()<0.5?'high':'low', performance.now()); }, 120);
  }
}

function makeOne(type, ts){
  const isHigh = (type === 'high');
  const need = isHigh ? 'duck' : 'jump';

  const el = document.createElement('div');
  el.className = 'jd-obstacle ' + (isHigh ? 'jd-obstacle--high' : 'jd-obstacle--low');
  el.dataset.id = String(nextObstacleId);

  const inner = document.createElement('div');
  inner.className = 'jd-obstacle-inner';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'jd-obs-icon';
  iconSpan.textContent = isHigh ? '⬇' : '⬆';

  const tagSpan = document.createElement('span');
  tagSpan.className = 'jd-obs-tag';
  tagSpan.textContent = isHigh ? 'DUCK' : 'JUMP';

  inner.appendChild(iconSpan);
  inner.appendChild(tagSpan);
  el.appendChild(inner);
  elObsHost.appendChild(el);

  state.obstacles.push({
    id: nextObstacleId++,
    type,
    need,
    x: SPAWN_X,
    createdAt: ts,
    resolved:false,
    element: el
  });

  state.obstaclesSpawned++;
  playSfx('jd-sfx-beep');
}

/* -------------------------
   Input
------------------------- */
function triggerAction(type, meta={}){
  if (!state || !running) return;
  const now = performance.now();
  lastAction = { type, time: now, source: meta.source || 'input' };

  if (elAvatar){
    elAvatar.classList.remove('jump','duck');
    elAvatar.classList.add(type);
    setTimeout(()=> elAvatar?.classList.remove(type), 180);
  }
}
function handleKeyDown(ev){
  if (!running) return;
  if (ev.code === 'ArrowUp' || ev.code === 'KeyW'){ ev.preventDefault(); triggerAction('jump', {source:'kbd'}); }
  else if (ev.code === 'ArrowDown' || ev.code === 'KeyS'){ ev.preventDefault(); triggerAction('duck', {source:'kbd'}); }
}
function handlePointerDown(ev){
  if (!running || !elPlayArea) return;
  ev.preventDefault();
  ev.stopPropagation();
  const rect = elPlayArea.getBoundingClientRect();
  const y = ev.clientY;
  const mid = rect.top + rect.height/2;
  if (y < mid) triggerAction('jump', {source:'touch'});
  else triggerAction('duck', {source:'touch'});
}
function onHhaShoot(ev){
  if (!running || !elPlayArea) return;
  const d = ev?.detail || {};
  const rect = elPlayArea.getBoundingClientRect();
  const y = Number.isFinite(d.y) ? d.y : (rect.top + rect.height/2);
  const mid = rect.top + rect.height/2;
  if (y < mid) triggerAction('jump', {source:'vrui'});
  else triggerAction('duck', {source:'vrui'});
}

/* -------------------------
   Obstacles update + HIT/MISS (A+B)
------------------------- */
function updateObstacles(dt, now, phase, progress){
  const cfg = state.cfg0;

  // speed
  let speed = cfg.speed;

  // training ramp
  if (state.mode === 'training'){
    if (phase === 2) speed *= 1.12;
    if (phase === 3) speed *= 1.26;
    speed *= (1 + 0.18*progress);
  }
  // boss storm speed
  speed *= bossSpeedMultiplier();

  const move = speed * (dt/1000);
  const keep = [];

  for (const obs of state.obstacles){
    obs.x -= move;
    if (obs.element) obs.element.style.left = obs.x + '%';

    // HIT window
    if (!obs.resolved && obs.x <= CENTER_X + 6 && obs.x >= CENTER_X - 6){
      const a = lastAction;
      if (a && a.time){
        const rt = Math.abs(a.time - now);

        // PERFECT / HIT / NEAR MISS
        if (a.type === obs.need && rt <= cfg.hitWinMs){
          obs.resolved = true;

          const isPerfect = rt <= HYPE.perfectMs;
          if (isPerfect) state.perfectHits++;

          state.hits++;
          state.combo++;
          state.maxCombo = Math.max(state.maxCombo, state.combo);

          // perk shield (B)
          if (state.combo === HYPE.perkComboAt){
            state.shield = 1;
            showJudge('🛡️ SHIELD ได้ 1 ครั้ง!', 'combo');
          }

          // score multipliers
          const comboM = 1 + Math.min(state.combo-1, 6)*0.15;
          const phaseM = (phase === 3) ? 1.18 : (phase === 2 ? 1.08 : 1.0);
          const feverM = state.feverOn ? HYPE.feverBonusMul : 1.0;
          const perfectM = isPerfect ? 1.18 : 1.0;

          const gain = Math.round(cfg.score * comboM * phaseM * feverM * perfectM);
          state.score += gain;

          if (obs.need === 'jump') state.jumpHit++; else state.duckHit++;
          state.stability = Math.min(100, state.stability + cfg.stabGain + (isPerfect ? 1.0 : 0));
          state.minStability = Math.min(state.minStability, state.stability);

          state.hitRTs.push(rt);
          AI.onHit(obs.need, rt);

          // fever add
          addFever(isPerfect ? HYPE.feverPerPerfect : HYPE.feverPerHit);

          // boss hp tick (A)
          if (phase === 3 && state.boss && !state.boss.defeated){
            state.boss.hp = Math.max(0, state.boss.hp - 1);
            if (state.boss.hp === 0){
              state.boss.defeated = true;
              showJudge('🏆 BOSS DEFEATED!!', 'combo');
              // reward: fever burst + stability heal
              addFever(35);
              state.stability = Math.min(100, state.stability + 18);
            }
          }

          // event log
          pushEvent({
            session_id: state.sessionId, game:'jump-duck',
            mode: state.mode, diff: state.diffKey,
            event_type: isPerfect ? 'perfect' : 'hit',
            required_action: obs.need,
            obstacle_type: obs.type,
            action: a.type,
            input_source: a.source || '',
            rt_ms: Math.round(rt),
            time_ms: Math.round(state.elapsedMs),
            combo_after: state.combo,
            score_after: Math.round(state.score),
            stability_after_pct: +state.stability.toFixed(1),
            fever_after: +state.fever.toFixed(1),
            boss_hp_after: state.boss ? state.boss.hp : '',
            participant_id: state.participant?.id || '',
            group: state.participant?.group || '',
            note: state.participant?.note || '',
            seed: HHA_CTX.seed || '',
            studyId: HHA_CTX.studyId || '',
            phase: HHA_CTX.phase || '',
            conditionGroup: HHA_CTX.conditionGroup || ''
          });

          obs.element && obs.element.remove();
          obs.element = null;

          playSfx('jd-sfx-hit');
          if (state.combo >= 8) playSfx('jd-sfx-combo');

          if (isPerfect) showJudge('PERFECT ✨', 'combo');
          else showJudge(obs.need === 'jump' ? 'JUMP ดีมาก 🦘' : 'DUCK ทันเวลา 🛡️', state.combo>=8?'combo':'ok');
          continue;
        }

        // NEAR MISS (B): action ถูก แต่ช้า/เร็วเกินนิดเดียว
        if (a.type === obs.need && rt <= cfg.hitWinMs * HYPE.nearMissWindow){
          state.nearMiss++;
          startSlowmo();
          showJudge('NEAR MISS 😱', 'miss');

          pushEvent({
            session_id: state.sessionId, game:'jump-duck',
            mode: state.mode, diff: state.diffKey,
            event_type: 'near_miss',
            required_action: obs.need,
            obstacle_type: obs.type,
            action: a.type,
            input_source: a.source || '',
            rt_ms: Math.round(rt),
            time_ms: Math.round(state.elapsedMs),
            combo_after: state.combo,
            score_after: Math.round(state.score),
            stability_after_pct: +state.stability.toFixed(1),
            fever_after: +state.fever.toFixed(1),
            boss_hp_after: state.boss ? state.boss.hp : '',
            participant_id: state.participant?.id || '',
            group: state.participant?.group || '',
            note: state.participant?.note || ''
          });
        }
      }
    }

    // MISS
    if (!obs.resolved && obs.x <= MISS_X){
      obs.resolved = true;

      // perk shield blocks 1 miss (B)
      if (state.shield > 0){
        state.shield = 0;
        showJudge('🛡️ SHIELD BLOCK!', 'ok');

        pushEvent({
          session_id: state.sessionId, game:'jump-duck',
          mode: state.mode, diff: state.diffKey,
          event_type: 'shield_block',
          required_action: obs.need,
          obstacle_type: obs.type,
          action: lastAction ? lastAction.type : '',
          input_source: lastAction ? (lastAction.source||'') : '',
          rt_ms: '',
          time_ms: Math.round(state.elapsedMs),
          combo_after: state.combo,
          score_after: Math.round(state.score),
          stability_after_pct: +state.stability.toFixed(1),
          fever_after: +state.fever.toFixed(1),
          boss_hp_after: state.boss ? state.boss.hp : ''
        });

        obs.element && obs.element.remove();
        obs.element = null;
        continue;
      }

      state.miss++;
      state.combo = 0;

      if (obs.need === 'jump') state.jumpMiss++; else state.duckMiss++;
      state.stability = Math.max(0, state.stability - cfg.stabDmg);
      state.minStability = Math.min(state.minStability, state.stability);

      AI.onMiss(obs.need);

      pushEvent({
        session_id: state.sessionId, game:'jump-duck',
        mode: state.mode, diff: state.diffKey,
        event_type: 'miss',
        required_action: obs.need,
        obstacle_type: obs.type,
        action: lastAction ? lastAction.type : '',
        input_source: lastAction ? (lastAction.source||'') : '',
        rt_ms: '',
        time_ms: Math.round(state.elapsedMs),
        combo_after: state.combo,
        score_after: Math.round(state.score),
        stability_after_pct: +state.stability.toFixed(1),
        fever_after: +state.fever.toFixed(1),
        boss_hp_after: state.boss ? state.boss.hp : ''
      });

      obs.element && obs.element.remove();
      obs.element = null;

      playSfx('jd-sfx-miss');
      showJudge('MISS ลองใหม่อีกที ✨', 'miss');

      elPlayArea?.classList.add('shake');
      setTimeout(()=> elPlayArea?.classList.remove('shake'), 180);
      continue;
    }

    if (obs.x > -20) keep.push(obs);
    else {
      obs.element && obs.element.remove();
      obs.element = null;
    }
  }

  state.obstacles = keep;

  if (lastAction && now - lastAction.time > 260) lastAction = null;

  if (state.stability <= 0){
    showJudge('หมดแรงทรงตัว! ⛔', 'miss');
    endGame('stability0');
  }
}

/* -------------------------
   Loop
------------------------- */
function loop(ts){
  if (!running || !state) return;

  // Slowmo scale (B)
  const slow = (state.slowmoUntil && ts < state.slowmoUntil) ? HYPE.slowmoScale : 1.0;

  const rawDt = ts - (lastFrame||ts);
  const dt = rawDt * slow;
  lastFrame = ts;

  state.elapsedMs = ts - state.startTime;
  state.remainingMs = Math.max(0, state.durationMs - state.elapsedMs);

  const progress = Math.min(1, state.elapsedMs / state.durationMs);
  const phase = getPhase(progress);

  elHudTime && (elHudTime.textContent = (state.remainingMs/1000).toFixed(1));

  // Motion tick
  motionUpdate(ts);

  // Fever tick (B)
  feverTick(dt);

  // A) enter boss at phase3 start
  if (phase === 3 && !state.boss){
    const hp = bossHpForDiff(state.diffKey);
    state.boss = {
      hpStart: hp,
      hp: hp,
      defeated: false,
      startAt: ts,
      inStorm: false,
      warned: false
    };
    showJudge('👑 BOSS PHASE!!', 'combo');
  }
  // boss pattern update
  if (phase === 3 && state.boss && !state.boss.defeated){
    bossPhaseUpdate(ts);
  }

  if (state.elapsedMs >= state.durationMs){
    endGame('timeup');
    return;
  }

  // Spawn scheduling
  while (ts >= state.nextSpawnAt){
    spawnObstacle(ts, phase);

    let interval = state.cfg0.spawnMs;

    // training ramp
    if (state.mode === 'training'){
      const factor = 1 - 0.30*progress;
      interval = interval * Math.max(0.58, factor);
      interval = AI.adjustSpawnInterval(interval, phase, state.mode);
    }

    // boss storm density (A)
    interval *= bossSpawnMultiplier();

    // fever makes it spicy but fair (B)
    if (state.feverOn) interval *= 0.92;

    state.nextSpawnAt += interval;
  }

  // Update obstacles
  updateObstacles(dt, ts, phase, progress);

  // HUD
  elHudStab && (elHudStab.textContent = state.stability.toFixed(1)+'%');
  elHudObs && (elHudObs.textContent = `${state.hits} / ${state.obstaclesSpawned}`);
  elHudScore && (elHudScore.textContent = String(Math.round(state.score)));
  elHudCombo && (elHudCombo.textContent = String(state.combo));

  // micro-tip
  const tip = AI.getHint();
  if (tip && phase === 2 && (state.elapsedMs % 7000 < 30)){
    showJudge(tip, 'combo');
  }

  rafId = requestAnimationFrame(loop);
}

/* -------------------------
   Init + hooks
------------------------- */
async function initJD(){
  setHubLinks();

  if (HHA_CTX.mode && elMode) elMode.value = HHA_CTX.mode;
  if (HHA_CTX.diff && elDiff) elDiff.value = HHA_CTX.diff;
  if (HHA_CTX.duration && elDuration) elDuration.value = String(HHA_CTX.duration);

  if (elPid && HHA_CTX.pid) elPid.value = HHA_CTX.pid;
  if (elGroup && HHA_CTX.group) elGroup.value = HHA_CTX.group;
  if (elNote && HHA_CTX.note) elNote.value = HHA_CTX.note;

  elMode?.addEventListener('change', updateResearchVisibility);
  updateResearchVisibility();

  // motion ui
  elMotionOpt?.addEventListener('change', setMotionUI);
  setMotionUI();

  elMotionEnable?.addEventListener('click', async ()=>{
    const ok = await requestMotionPermissionIfNeeded();
    if (ok){ showJudge('Motion READY ✅', 'ok'); }
    else { showJudge('Motion ไม่พร้อม ❌', 'miss'); }
    setMotionUI();
  });
  elMotionCalib?.addEventListener('click', ()=>{ motionCalibrate(); setMotionUI(); });

  $('[data-action="start"]')?.addEventListener('click', startGameFromMenu);
  $('[data-action="tutorial"]')?.addEventListener('click', startTutorial);
  $('[data-action="stop-early"]')?.addEventListener('click', ()=> running && endGame('manual'));
  $('[data-action="play-again"]')?.addEventListener('click', startGameFromMenu);
  $$('[data-action="back-menu"]').forEach(btn=> btn.addEventListener('click', ()=> showView('menu')));

  // actionbar
  $('[data-action="jump"]')?.addEventListener('click', ()=> triggerAction('jump', {source:'btn'}));
  $('[data-action="duck"]')?.addEventListener('click', ()=> triggerAction('duck', {source:'btn'}));

  window.addEventListener('keydown', handleKeyDown, {passive:false});
  elPlayArea?.addEventListener('pointerdown', handlePointerDown, {passive:false, capture:true});

  await ensureVrUi();
  window.addEventListener('hha:shoot', onHhaShoot);

  // flush hardened
  window.addEventListener('pagehide', ()=> flushLog('pagehide'));
  document.addEventListener('visibilitychange', ()=>{
    if (document.visibilityState === 'hidden') flushLog('visibility:hidden');
  });

  showView('menu');
}

// exports
window.JD_EXPORT = {
  getState(){ return state ? JSON.parse(JSON.stringify(state)) : null; },
  getSummary(){ return buildSummary(); },
  getEventsCsv(){ return state?.events ? toCsv(state.events) : ''; },
  getSessionCsv(){ const s = buildSummary(); return s ? toCsv([s]) : ''; }
};

window.addEventListener('DOMContentLoaded', initJD);