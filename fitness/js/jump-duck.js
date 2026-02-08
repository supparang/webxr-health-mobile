// === /fitness/js/jump-duck.js — Jump-Duck (Boss 3-Phase + AI hooks + Logger) v20260208a ===
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
   HHA ctx / params
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
  view: (qsGet('view','') || '').toLowerCase(), // pc/mobile/cvr/vr (NO override)
  mode: (qsGet('mode','') || qsGet('runMode','') || '').toLowerCase(), // training/test/research
  diff: (qsGet('diff','') || '').toLowerCase(),
  duration: qsGet('duration', qsGet('time','')),
  seed: qsGet('seed',''),
  studyId: qsGet('studyId',''),
  phase: qsGet('phase',''),
  conditionGroup: qsGet('conditionGroup',''),
  pid: qsGet('pid',''),
  group: qsGet('group',''),
  note: qsGet('note',''),
  log: qsGet('log','') // ✅ Apps Script Web App URL (exec)
};

function detectView(){
  if (HHA_CTX.view) return HHA_CTX.view; // NO override
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

const elHudMode   = $('#hud-mode');
const elHudDiff   = $('#hud-diff');
const elHudDur    = $('#hud-duration');
const elHudStab   = $('#hud-stability');
const elHudObs    = $('#hud-obstacles');
const elHudScore  = $('#hud-score');
const elHudCombo  = $('#hud-combo');
const elHudTime   = $('#hud-time');

const elHudPhase   = $('#hud-phase');
const elHudBossFill= $('#hud-boss-fill');
const elHudBossHp  = $('#hud-boss-hp');
const elHudProgFill= $('#hud-prog-fill');
const elHudProgText= $('#hud-prog-text');

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
   Config
------------------------- */
const JD_DIFFS = {
  easy:   { speed: 38, spawnMs: 1300, hitWinMs: 260, stabDmg: 10, stabGain: 3, score: 12 },
  normal: { speed: 48, spawnMs: 1000, hitWinMs: 220, stabDmg: 13, stabGain: 3, score: 14 },
  hard:   { speed: 62, spawnMs:  800, hitWinMs: 200, stabDmg: 16, stabGain: 4, score: 16 }
};

// progress thresholds: 1 warmup / 2 challenge / 3 boss
const PHASE_THRESH = [0.33, 0.70];

const SPAWN_X  = 100;
const CENTER_X = 24;
const MISS_X   = 4;

/* -------------------------
   Boss system (3 phases inside Phase-3)
   - BossPhase 1: pattern ชัด (สลับ + random นิด)
   - BossPhase 2: double/quick mix
   - BossPhase 3: burst + “break shield” ต้องถูกติดกัน
------------------------- */
const BOSS = {
  enable: true,
  // bossPhase based on progress within Phase-3 (the last segment)
  p2: 0.40,  // inside boss segment
  p3: 0.75,

  hpByDiff: { easy: 10, normal: 14, hard: 18 },
  shieldStreakNeedByDiff: { easy: 3, normal: 4, hard: 5 }, // ต้องถูกติดกันเพื่อ “ลด HP”
  hpLossPerBreak: { easy: 2, normal: 2, hard: 3 },

  // boss excitement
  burstChance: 0.20,
  burstGapMs: 110,
};

/* -------------------------
   State
------------------------- */
let running = false;
let state = null;
let rafId = null;
let lastFrame = null;
let judgeTimer = null;

let lastAction = null; // {type:'jump'|'duck', time:number}
let nextObstacleId = 1;

/* -------------------------
   AI Predictor (Explainable + Fair)
   ML/DL-ready: เก็บ feature rows ต่อ event สำหรับไปเทรนภายหลัง
------------------------- */
function createAIPredictor(){
  const mem = {
    streakMiss: 0,
    missJump: 0,
    missDuck: 0,
    emaRT: 220,
    bias: 0,          // + => duck more, - => jump more
    lastNeed: null,
    bossStreakOk: 0,  // streak ถูกติดกันในบอส
  };

  function onHit(need, rt, phase, bossPhase){
    mem.streakMiss = 0;
    mem.lastNeed = need;
    if (Number.isFinite(rt)) mem.emaRT = 0.85*mem.emaRT + 0.15*rt;
    mem.bias *= 0.92;
    if (phase === 3) mem.bossStreakOk++;
    else mem.bossStreakOk = 0;
  }
  function onMiss(need, phase){
    mem.streakMiss++;
    mem.lastNeed = need;
    if (need === 'jump') mem.missJump++; else mem.missDuck++;
    const total = mem.missJump + mem.missDuck + 1;
    const dj = mem.missDuck / total;
    const jj = mem.missJump / total;
    mem.bias = (dj - jj) * 0.35;
    mem.bias = Math.max(-0.35, Math.min(0.35, mem.bias));
    if (phase === 3) mem.bossStreakOk = 0;
  }
  function pickType(r){
    const t = r + mem.bias;
    return (t >= 0.5) ? 'high' : 'low';
  }
  function adjustSpawnInterval(ms, phase, mode){
    let out = ms;
    if (mode === 'training'){
      if (phase === 3) out *= 0.90;
      if (mem.streakMiss >= 2) out *= 1.12;
    }
    out = Math.max(520, Math.min(1800, out));
    return out;
  }
  function getHint(){
    if (mem.streakMiss >= 2){
      return 'ทิป: กดก่อนถึงเส้นนิดเดียว จะทันมากขึ้น ✨';
    }
    if (mem.emaRT > 260){
      return 'ทิป: ลดเวลาตอบสนองอีกนิด จะได้ PERFECT ง่ายขึ้น 🔥';
    }
    return '';
  }

  return { mem, onHit, onMiss, pickType, adjustSpawnInterval, getHint };
}
const AI = createAIPredictor();

/* -------------------------
   Logger (HeroHealth Cloud Logger via ?log=)
   - ส่ง summary + events แบบ flush-hardened
------------------------- */
function safeJson(x){ try{ return JSON.stringify(x); }catch{ return ''; } }

async function postLog(payload){
  const url = (HHA_CTX.log || '').trim();
  if (!url) return false;
  try{
    // Apps Script Web App: POST JSON
    const res = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload),
      keepalive: true
    });
    return !!res.ok;
  }catch(e){
    console.warn('log failed', e);
    return false;
  }
}

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
  judgeTimer = setTimeout(()=> elJudge.classList.remove('show'), 520);
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
  [backHubMenu, backHubPlay, backHubResult].forEach(a=>{
    if (a) a.href = hub;
  });
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
   Game helpers
------------------------- */
function makeSessionId(){
  const t = new Date();
  const pad = (n)=>String(n).padStart(2,'0');
  return `JD-${t.getFullYear()}${pad(t.getMonth()+1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}`;
}

function getPhase(progress){
  if (progress < PHASE_THRESH[0]) return 1;
  if (progress < PHASE_THRESH[1]) return 2;
  return 3;
}
function getBossPhase(progress){
  // progress within phase-3 segment
  const start = PHASE_THRESH[1];
  const span = 1 - start;
  const p = span > 0 ? (progress - start)/span : 1;
  if (p < BOSS.p2) return 1;
  if (p < BOSS.p3) return 2;
  return 3;
}

/* -------------------------
   Event rows (ML/DL-ready)
------------------------- */
function pushEvent(row){
  if (!state) return;
  state.events.push(row);
}
function makeFeatureRow(evType, need, action, rt, phase, bossPhase){
  // ✅ โครง feature เบื้องต้นสำหรับเทรนภายหลัง (ไม่เทรนในเกมตอนนี้)
  const a = action || '';
  const n = need || '';
  return {
    session_id: state.sessionId,
    time_ms: Math.round(state.elapsedMs),
    mode: state.mode,
    diff: state.diffKey,
    phase,
    boss_phase: bossPhase,
    ev: evType,
    need: n,
    action: a,
    rt_ms: Number.isFinite(rt) ? Math.round(rt) : '',
    combo: state.combo,
    stability: +state.stability.toFixed(1),
    ema_rt: +AI.mem.emaRT.toFixed(1),
    miss_jump: AI.mem.missJump,
    miss_duck: AI.mem.missDuck,
    bias: +AI.mem.bias.toFixed(3),
    boss_streak_ok: AI.mem.bossStreakOk,
  };
}

/* -------------------------
   Game start/stop
------------------------- */
function startGameBase(opts){
  const mode = opts.mode || 'training';
  const diffKey = (opts.diffKey || 'normal').toLowerCase();
  const cfg0 = JD_DIFFS[diffKey] || JD_DIFFS.normal;

  const durationMs = opts.durationMs ?? 60000;
  const isTutorial = !!opts.isTutorial;

  RNG = mulberry32(getSeed());

  const now = performance.now();
  state = {
    sessionId: makeSessionId(),
    mode,
    diffKey,
    cfg0,
    durationMs,
    isTutorial,

    startTime: now,
    elapsedMs: 0,
    remainingMs: durationMs,

    stability: 100,
    minStability: 100,

    nextSpawnAt: now + 650,
    obstacles: [],
    obstaclesSpawned: 0,

    hits: 0,
    miss: 0,

    jumpHit:0, duckHit:0,
    jumpMiss:0, duckMiss:0,

    combo: 0,
    maxCombo: 0,
    score: 0,
    hitRTs: [],

    participant: collectParticipant(mode),

    // boss
    bossEnabled: BOSS.enable,
    bossHpMax: BOSS.hpByDiff[diffKey] ?? 14,
    bossHp: BOSS.hpByDiff[diffKey] ?? 14,
    bossShieldNeed: BOSS.shieldStreakNeedByDiff[diffKey] ?? 4,
    bossHpLoss: BOSS.hpLossPerBreak[diffKey] ?? 2,

    // logs
    events: [],
    summarySent: false,

    ctx: { ...HHA_CTX }
  };

  // reset AI memory for each run (predictor still used per run)
  AI.mem.streakMiss = 0;
  AI.mem.missJump = 0;
  AI.mem.missDuck = 0;
  AI.mem.emaRT = 220;
  AI.mem.bias = 0;
  AI.mem.lastNeed = null;
  AI.mem.bossStreakOk = 0;

  running = true;
  lastFrame = now;

  // UI reset
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

  // boss UI init
  if (elHudBossHp) elHudBossHp.textContent = `HP ${state.bossHp}/${state.bossHpMax}`;
  if (elHudBossFill) elHudBossFill.style.transform = `scaleX(1)`;
  if (elHudPhase) elHudPhase.textContent = `PHASE 1`;

  showView('play');
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

async function endGame(){
  running = false;
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

  // fill result
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
    if (acc >= 0.90 && stab >= 85) rank='S';
    else if (acc >= 0.80 && stab >= 75) rank='A';
    else if (acc >= 0.65 && stab >= 60) rank='B';
    else if (acc < 0.40 || stab < 40)   rank='D';
    resRank.textContent = rank;
  }

  showView('result');

  // ✅ ส่งขึ้น Cloud Logger ถ้ามี ?log=
  await flushCloudLogger('end');
}

async function flushCloudLogger(reason){
  if (!state || state.summarySent) return;
  const total = state.obstaclesSpawned || 0;
  const hits  = state.hits || 0;
  const acc   = total ? +(hits/total*100).toFixed(2) : 0;
  const rtMean = state.hitRTs.length ? state.hitRTs.reduce((a,b)=>a+b,0)/state.hitRTs.length : 0;

  const summary = {
    kind: 'summary',
    game: 'jump-duck',
    session_id: state.sessionId,
    reason,
    mode: state.mode,
    diff: state.diffKey,
    duration_planned_s: (state.durationMs||0)/1000,
    duration_actual_s: (state.elapsedMs||0)/1000,
    obstacles_total: total,
    hits_total: state.hits,
    miss_total: state.miss,
    jump_hit: state.jumpHit, duck_hit: state.duckHit,
    jump_miss: state.jumpMiss, duck_miss: state.duckMiss,
    acc_pct: acc,
    rt_mean_ms: rtMean ? +rtMean.toFixed(1) : 0,
    stability_min_pct: +state.minStability.toFixed(1),
    score_final: Math.round(state.score),
    boss_hp_end: state.bossHp,
    boss_hp_max: state.bossHpMax,
    participant_id: state.participant?.id || '',
    group: state.participant?.group || '',
    note: state.participant?.note || '',
    ctx: state.ctx || {}
  };

  const payload = {
    kind: 'hha_log',
    schema: 'hha-jumpduck-v1',
    created_at_iso: new Date().toISOString(),
    summary,
    events: state.events
  };

  const ok = await postLog(payload);
  state.summarySent = ok; // ถ้าส่งไม่ผ่าน จะยังไม่ล็อค (เผื่อกดอีกครั้ง)
}

/* -------------------------
   Main loop
------------------------- */
function loop(ts){
  if (!running || !state) return;
  const dt = ts - (lastFrame||ts);
  lastFrame = ts;

  state.elapsedMs = ts - state.startTime;
  state.remainingMs = Math.max(0, state.durationMs - state.elapsedMs);

  const progress = Math.min(1, state.elapsedMs / state.durationMs);
  const phase = getPhase(progress);
  const bossPhase = (phase === 3) ? getBossPhase(progress) : 0;

  // HUD time + progress
  elHudTime && (elHudTime.textContent = (state.remainingMs/1000).toFixed(1));
  if (elHudProgFill) elHudProgFill.style.transform = `scaleX(${progress.toFixed(4)})`;
  if (elHudProgText) elHudProgText.textContent = Math.round(progress*100) + '%';

  // Phase label
  if (elHudPhase){
    elHudPhase.textContent = phase === 3 ? `BOSS ${bossPhase}` : `PHASE ${phase}`;
  }

  // Boss bar
  if (phase === 3 && state.bossEnabled){
    const ratio = state.bossHpMax ? (state.bossHp / state.bossHpMax) : 0;
    if (elHudBossFill) elHudBossFill.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio)).toFixed(4)})`;
    if (elHudBossHp) elHudBossHp.textContent = `HP ${state.bossHp}/${state.bossHpMax}`;
  }else{
    if (elHudBossFill) elHudBossFill.style.transform = `scaleX(0)`;
    if (elHudBossHp) elHudBossHp.textContent = `HP 0/0`;
  }

  if (state.elapsedMs >= state.durationMs){
    endGame();
    return;
  }

  // spawn schedule
  while (ts >= state.nextSpawnAt){
    spawnObstacle(ts, phase, bossPhase);
    let interval = state.cfg0.spawnMs;

    if (state.mode === 'training'){
      const factor = 1 - 0.30*progress;
      interval = interval * Math.max(0.58, factor);
      interval = AI.adjustSpawnInterval(interval, phase, state.mode);
      if (phase === 3) interval *= (bossPhase === 3 ? 0.78 : bossPhase === 2 ? 0.86 : 0.94);
    }
    state.nextSpawnAt += interval;
  }

  updateObstacles(dt, ts, phase, bossPhase, progress);
  pollGamepad(ts);

  // HUD (core)
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
   Obstacles + Boss patterns
------------------------- */
function spawnObstacle(ts, phase, bossPhase){
  if (!elObsHost || !state) return;

  const last = state.obstacles[state.obstacles.length - 1];
  if (last && last.x > 70) return;

  const r = RNG();
  let type = AI.pickType(r); // high/low

  // Boss patterns: บังคับให้ “ทั้งคู่”
  if (phase === 3 && state.bossEnabled){
    if (bossPhase === 1){
      // pattern สลับ (อ่านง่ายแต่เร็วขึ้น)
      type = (state.obstaclesSpawned % 2 === 0) ? 'low' : 'high';
      if (RNG() < 0.18) type = (type === 'low' ? 'high' : 'low');
    }else if (bossPhase === 2){
      // mix: 60/40 + occasional double
      type = (RNG() < 0.60) ? 'high' : 'low';
      if (RNG() < 0.22){
        makeOne(type, ts);
        setTimeout(()=> running && state && makeOne(type === 'high' ? 'low' : 'high', performance.now()), 120);
        return;
      }
    }else{
      // phase 3: burst
      type = (RNG() < 0.50) ? 'high' : 'low';
      makeOne(type, ts);

      const doBurst = RNG() < BOSS.burstChance;
      if (doBurst){
        setTimeout(()=> running && state && makeOne(RNG()<0.5?'high':'low', performance.now()), BOSS.burstGapMs);
        setTimeout(()=> running && state && makeOne(RNG()<0.5?'high':'low', performance.now()), BOSS.burstGapMs*2);
      }
      return;
    }
  }

  makeOne(type, ts);
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

function updateObstacles(dt, now, phase, bossPhase, progress){
  const cfg = state.cfg0;
  let speed = cfg.speed;

  // training: เร่งตาม phase + boss
  if (state.mode === 'training'){
    if (phase === 2) speed *= 1.12;
    if (phase === 3) speed *= (bossPhase === 3 ? 1.48 : bossPhase === 2 ? 1.34 : 1.22);
    speed *= (1 + 0.18*progress);
  }

  const move = speed * (dt/1000);
  const keep = [];

  for (const obs of state.obstacles){
    obs.x -= move;
    if (obs.element) obs.element.style.left = obs.x + '%';

    // HIT window near center
    if (!obs.resolved && obs.x <= CENTER_X + 6 && obs.x >= CENTER_X - 6){
      const a = lastAction;
      if (a && a.time){
        const rt = Math.abs(a.time - now);
        if (a.type === obs.need && rt <= cfg.hitWinMs){
          // HIT
          obs.resolved = true;

          state.hits++;
          state.combo++;
          state.maxCombo = Math.max(state.maxCombo, state.combo);

          const comboM = 1 + Math.min(state.combo-1, 6)*0.15;
          const phaseM = (phase === 3) ? (bossPhase===3?1.28:bossPhase===2?1.18:1.10) : (phase === 2 ? 1.06 : 1.0);
          const gain = Math.round(cfg.score * comboM * phaseM);
          state.score += gain;

          if (obs.need === 'jump') state.jumpHit++; else state.duckHit++;
          state.stability = Math.min(100, state.stability + cfg.stabGain);
          state.minStability = Math.min(state.minStability, state.stability);

          state.hitRTs.push(rt);
          AI.onHit(obs.need, rt, phase, bossPhase);

          // Boss: break shield mechanic (ลด HP เมื่อ streak ถูกพอ)
          if (phase === 3 && state.bossEnabled){
            if (AI.mem.bossStreakOk >= state.bossShieldNeed){
              AI.mem.bossStreakOk = 0;
              state.bossHp = Math.max(0, state.bossHp - state.bossHpLoss);
              showJudge('💥 BREAK! บอสโดนแล้ว!', 'combo');
              if (state.bossHp <= 0){
                showJudge('🏆 BOSS DOWN!!', 'combo');
                // จบเกมทันทีแบบชัยชนะ
                endGame();
                return;
              }
            }
          }

          // log event (hit)
          pushEvent({
            kind: 'event',
            event_type: 'hit',
            need: obs.need,
            action: a.type,
            rt_ms: Math.round(rt),
            phase,
            boss_phase: bossPhase,
            score_after: Math.round(state.score),
            combo_after: state.combo,
            stability_after: +state.stability.toFixed(1),
            boss_hp: state.bossHp,
            participant_id: state.participant?.id || '',
            group: state.participant?.group || '',
            note: state.participant?.note || '',
            feature: makeFeatureRow('hit', obs.need, a.type, rt, phase, bossPhase)
          });

          obs.element && obs.element.remove();
          obs.element = null;

          playSfx('jd-sfx-hit');
          if (state.combo >= 8) playSfx('jd-sfx-combo');

          showJudge(obs.need === 'jump' ? 'JUMP ดีมาก 🦘' : 'DUCK ทันเวลา 🛡️', state.combo>=8?'combo':'ok');
          continue;
        }
      }
    }

    // MISS
    if (!obs.resolved && obs.x <= MISS_X){
      obs.resolved = true;

      state.miss++;
      state.combo = 0;

      if (obs.need === 'jump') state.jumpMiss++; else state.duckMiss++;
      state.stability = Math.max(0, state.stability - cfg.stabDmg);
      state.minStability = Math.min(state.minStability, state.stability);

      AI.onMiss(obs.need, phase);

      pushEvent({
        kind: 'event',
        event_type: 'miss',
        need: obs.need,
        action: lastAction ? lastAction.type : '',
        rt_ms: '',
        phase,
        boss_phase: bossPhase,
        score_after: Math.round(state.score),
        combo_after: state.combo,
        stability_after: +state.stability.toFixed(1),
        boss_hp: state.bossHp,
        participant_id: state.participant?.id || '',
        group: state.participant?.group || '',
        note: state.participant?.note || '',
        feature: makeFeatureRow('miss', obs.need, (lastAction?lastAction.type:''), NaN, phase, bossPhase)
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

  // action decay
  if (lastAction && now - lastAction.time > 260) lastAction = null;

  // optional end if stability 0
  if (state.stability <= 0){
    showJudge('หมดแรงทรงตัว! ⛔', 'miss');
    endGame();
  }
}

/* -------------------------
   Input (PC/Mobile/tap + VRUI shoot)
------------------------- */
function triggerAction(type){
  if (!state || !running) return;
  const now = performance.now();
  lastAction = { type, time: now };

  if (elAvatar){
    elAvatar.classList.remove('jump','duck');
    elAvatar.classList.add(type);
    setTimeout(()=> elAvatar?.classList.remove(type), 180);
  }
}

function handleKeyDown(ev){
  if (!running) return;
  if (ev.code === 'ArrowUp'){ ev.preventDefault(); triggerAction('jump'); }
  else if (ev.code === 'ArrowDown'){ ev.preventDefault(); triggerAction('duck'); }
  else if (ev.code === 'KeyW'){ ev.preventDefault(); triggerAction('jump'); }
  else if (ev.code === 'KeyS'){ ev.preventDefault(); triggerAction('duck'); }
}

function handlePointerDown(ev){
  if (!running || !elPlayArea) return;
  const rect = elPlayArea.getBoundingClientRect();
  const mid = rect.top + rect.height/2;
  const y = ev.clientY;
  if (y < mid) triggerAction('jump');
  else triggerAction('duck');
}

// VR UI shoot: ใช้ y เพื่อเลือก Jump/Duck
function onHhaShoot(ev){
  if (!running || !elPlayArea) return;
  const d = ev?.detail || {};
  const rect = elPlayArea.getBoundingClientRect();
  const y = Number.isFinite(d.y) ? d.y : (rect.top + rect.height/2);
  const mid = rect.top + rect.height/2;
  if (y < mid) triggerAction('jump');
  else triggerAction('duck');
}

/* -------------------------
   Gamepad
------------------------- */
let gpPrev = { up:false, down:false, a:false, b:false };

function pollGamepad(){
  if (!running) return;
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = gps && gps[0];
  if (!gp || !gp.buttons) return;

  const up   = !!gp.buttons[12]?.pressed;
  const down = !!gp.buttons[13]?.pressed;
  const a    = !!gp.buttons[0]?.pressed;
  const b    = !!gp.buttons[1]?.pressed;

  if (up && !gpPrev.up) triggerAction('jump');
  if (down && !gpPrev.down) triggerAction('duck');
  if (a && !gpPrev.a) triggerAction('jump');
  if (b && !gpPrev.b) triggerAction('duck');

  gpPrev = { up, down, a, b };
}

/* -------------------------
   Init
------------------------- */
async function initJD(){
  setHubLinks();

  // prefill menu from URL
  if (HHA_CTX.mode && elMode) elMode.value = HHA_CTX.mode;
  if (HHA_CTX.diff && elDiff) elDiff.value = HHA_CTX.diff;
  if (HHA_CTX.duration && elDuration) elDuration.value = String(HHA_CTX.duration);

  // research prefill
  if (elPid && HHA_CTX.pid) elPid.value = HHA_CTX.pid;
  if (elGroup && HHA_CTX.group) elGroup.value = HHA_CTX.group;
  if (elNote && HHA_CTX.note) elNote.value = HHA_CTX.note;

  elMode?.addEventListener('change', updateResearchVisibility);
  updateResearchVisibility();

  $('[data-action="start"]')?.addEventListener('click', startGameFromMenu);
  $('[data-action="tutorial"]')?.addEventListener('click', startTutorial);
  $('[data-action="stop-early"]')?.addEventListener('click', ()=> running && endGame());
  $('[data-action="play-again"]')?.addEventListener('click', startGameFromMenu);
  $$('[data-action="back-menu"]').forEach(btn=> btn.addEventListener('click', ()=> showView('menu')));

  // big buttons (แก้กดไม่ได้)
  $('[data-action="jump"]')?.addEventListener('click', ()=> triggerAction('jump'));
  $('[data-action="duck"]')?.addEventListener('click', ()=> triggerAction('duck'));

  window.addEventListener('keydown', handleKeyDown, {passive:false});
  elPlayArea?.addEventListener('pointerdown', handlePointerDown, {passive:false});

  // VR UI integration (optional)
  await ensureVrUi();
  window.addEventListener('hha:shoot', onHhaShoot);

  // flush-hardened on exit
  window.addEventListener('beforeunload', ()=>{
    // best-effort (ไม่ await)
    flushCloudLogger('unload');
  });

  showView('menu');
}

window.JD_EXPORT = {
  getState(){ return state ? JSON.parse(safeJson(state)) : null; }
};

window.addEventListener('DOMContentLoaded', initJD);