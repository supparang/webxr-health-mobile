// === /fitness/js/jump-duck.js — Jump-Duck (ABCDE: PRO+VARIANTBOSS+OVERHEAT+FEINT+AI/ML) v20260304-JD-ABCDE ===
'use strict';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

/* -------------------------
   Fatal overlay
------------------------- */
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
   QS / ctx
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
  view: (qsGet('view','') || '').toLowerCase(),      // pc/mobile/cvr/vr (NO override)
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
  pro: (qsGet('pro','') || '').toLowerCase(),        // ✅ PRO switch: 1|true|yes|on (training only)
  log: qsGet('log','')                               // (พักไว้ก่อน)
};

function isPro(){
  const v = String(HHA_CTX.pro||'').toLowerCase();
  return (v==='1' || v==='true' || v==='yes' || v==='on');
}

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
  const base = `${HHA_CTX.pid||''}|${HHA_CTX.studyId||''}|${HHA_CTX.phase||''}|${HHA_CTX.conditionGroup||''}`;
  if (base.replace(/\|/g,'').trim()) return strToSeed(base);
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

const elHudPhase  = $('#hud-phase');
const elHudBoss   = $('#hud-boss');

const elProgFill  = $('#hud-prog-fill');
const elProgText  = $('#hud-prog-text');
const elFeverFill = $('#hud-fever-fill');
const elFeverStat = $('#hud-fever-status');

const bossBarWrap = $('#boss-bar-wrap');
const bossFill    = $('#hud-boss-fill');
const bossStatus  = $('#hud-boss-status');

const elPlayArea  = $('#jd-play-area');
const elAvatar    = $('#jd-avatar');
const elObsHost   = $('#jd-obstacles');
const elJudge     = $('#jd-judge');
const elTele      = $('#jd-tele');

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

// ✅ PRO tuning (training only)
const PRO = {
  spawnMul: 0.92,
  speedMul: 1.08,
  hitWinMul: 0.92,
  stabDmgMul: 1.05
};

// phases: 1 warmup / 2 challenge / 3 boss
const PHASE_THRESH = [0.33, 0.70];

const SPAWN_X  = 100;
const CENTER_X = 24;
const MISS_X   = 4;

/* -------------------------
   Fever system
------------------------- */
const FEVER = {
  threshold: 100,
  decayPerSec: 12,
  durationSec: 5.5,
  gainOnHit: { easy: 18, normal: 16, hard: 14 }
};

/* -------------------------
   Boss system (3 phases) — Mixed boss variants
------------------------- */
const BOSS = {
  hpMax: 110,
  dmgOnHit: 6,
  dmgOnPerfect: 9,

  burstEveryMs: 5200,
  tempoShiftEveryMs: 4200,

  shieldPhaseAtHp: 60,
  shieldNeedStreak: 6,
  shieldBreakBonusDmg: 16,

  frenzyAtHp: 18,
  frenzyBurstEveryMs: 3200,
  frenzyLenBoost: 2,

  feintChance: 0.18,
  feintFlipAtX: 34,
  revealAtX: 30,

  // PRO multipliers
  proFeintMul: 1.35,
  proFrenzyMul: 0.82
};

function isAdaptiveAllowed(){
  return state && state.mode === 'training';
}

/* -------------------------
   AI Predictor + Coach (explainable)
------------------------- */
function createAI(){
  const mem = {
    streakMiss: 0,
    missJump: 0,
    missDuck: 0,
    lastRT: 220,
    bias: 0,
    switchCostMs: 0,
    lastNeed: null,
    tipNextAtMs: 0
  };

  function onOutcome(needType, ok, rt){
    if (ok){
      mem.streakMiss = 0;
      if (Number.isFinite(rt)) mem.lastRT = 0.85*mem.lastRT + 0.15*rt;
      mem.bias *= 0.92;
    }else{
      mem.streakMiss++;
      if (needType === 'jump') mem.missJump++;
      else mem.missDuck++;
      const total = mem.missJump + mem.missDuck + 1;
      const dj = mem.missDuck / total;
      const jj = mem.missJump / total;
      mem.bias = (dj - jj) * 0.35;
      mem.bias = Math.max(-0.35, Math.min(0.35, mem.bias));
    }

    if (mem.lastNeed && mem.lastNeed !== needType){
      const sc = Number.isFinite(rt) ? Math.max(0, rt - mem.lastRT) : 0;
      mem.switchCostMs = 0.9*mem.switchCostMs + 0.1*sc;
    }
    mem.lastNeed = needType;
  }

  function pickType(baseRand){
    const t = baseRand + mem.bias;
    return (t >= 0.5) ? 'high' : 'low';
  }

  function adjustSpawnInterval(ms, phase){
    if (!isAdaptiveAllowed()) return ms;
    let out = ms;
    if (phase === 3) out *= 0.90;
    if (mem.streakMiss >= 2) out *= 1.12;
    out = Math.max(520, Math.min(1800, out));
    return out;
  }

  function coachTip(nowMs){
    if (!state) return '';
    if (nowMs < mem.tipNextAtMs) return '';
    mem.tipNextAtMs = nowMs + 6500;

    const mj = mem.missJump, md = mem.missDuck;
    if (mem.streakMiss >= 2){
      return 'โค้ช AI: ช้าไปนิด ลองกด “ก่อนถึงเส้น” อีกนิดนะ ✨';
    }
    if (mem.lastRT > 265){
      return 'โค้ช AI: RT เฉลี่ยสูง ลอง “กดให้เร็วขึ้น” อีกนิด 🔥';
    }
    if (mem.switchCostMs > 90){
      return 'โค้ช AI: ตอนสลับ J↔D ให้เตรียมท่าล่วงหน้า 🧠';
    }
    if (mj + md >= 6){
      if (md > mj*1.4) return 'โค้ช AI: คุณพลาด DUCK บ่อยกว่า JUMP → รอบนี้อ่าน DUCK ให้ชัด 🛡️';
      if (mj > md*1.4) return 'โค้ช AI: คุณพลาด JUMP บ่อยกว่า DUCK → รอบนี้จับจังหวะ JUMP ให้แน่น 🦘';
    }
    return '';
  }

  function snapshot(){
    const total = mem.missJump + mem.missDuck + 1;
    return {
      ai_streak_miss: mem.streakMiss,
      ai_bias: +mem.bias.toFixed(3),
      ai_last_rt_ms: +mem.lastRT.toFixed(1),
      ai_switch_cost_ms: +mem.switchCostMs.toFixed(1),
      ai_miss_jump: mem.missJump,
      ai_miss_duck: mem.missDuck,
      ai_miss_duck_pct: +((mem.missDuck/total)*100).toFixed(1),
      ai_miss_jump_pct: +((mem.missJump/total)*100).toFixed(1),
      ai_locked: (state && (state.mode==='research' || state.mode==='test')) ? 1 : 0
    };
  }

  return { onOutcome, pickType, adjustSpawnInterval, coachTip, snapshot };
}
const AI = createAI();

/* -------------------------
   Views + HUD helper
------------------------- */
function showView(name){
  [viewMenu,viewPlay,viewResult].forEach(v=> v && v.classList.add('jd-hidden'));
  if (name === 'menu')   viewMenu?.classList.remove('jd-hidden');
  if (name === 'play')   viewPlay?.classList.remove('jd-hidden');
  if (name === 'result') viewResult?.classList.remove('jd-hidden');
}

let judgeTimer = null;
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
   Hub links
------------------------- */
function setHubLinks(){
  const hub = HHA_CTX.hub || '';
  if (!hub) return;
  [backHubMenu, backHubPlay, backHubResult].forEach(a=>{
    if (a) a.href = hub;
  });
}

/* -------------------------
   Research meta UI
------------------------- */
function updateResearchVisibility(){
  const mode = (elMode?.value) || 'training';
  if (!elResearchBlock) return;
  if (mode === 'research') elResearchBlock.classList.remove('jd-hidden');
  else elResearchBlock.classList.add('jd-hidden');
}
function collectParticipant(metaMode){
  if (metaMode !== 'research') return { id:'', group:'', note:'' };
  return {
    id: (elPid?.value || HHA_CTX.pid || '').trim(),
    group: (elGroup?.value || HHA_CTX.group || '').trim(),
    note: (elNote?.value || HHA_CTX.note || '').trim()
  };
}

/* -------------------------
   Local logging (พัก App Script)
------------------------- */
function nowIso(){ try{ return new Date().toISOString(); }catch{ return ''; } }

function pushEvent(eventType, extra){
  if (!state) return;
  const base = {
    timestampIso: nowIso(),
    projectTag: 'jumpduck',
    runMode: state.mode,
    studyId: state.ctx.studyId || '',
    phase: state.ctx.phase || '',
    conditionGroup: state.ctx.conditionGroup || '',
    sessionId: state.sessionId,
    eventType,
    gameMode: 'jumpduck',
    diff: state.diffKey,
    timeFromStartMs: Math.round(state.elapsedMs||0),
    studentKey: state.ctx.pid || '',
    group: state.participant?.group || '',
    note: state.participant?.note || ''
  };
  state.events.push(Object.assign(base, extra || {}));
}

/* -------------------------
   Session id
------------------------- */
function makeSessionId(){
  const t = new Date();
  const pad = (n)=>String(n).padStart(2,'0');
  return `JD-${t.getFullYear()}${pad(t.getMonth()+1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}`;
}

/* -------------------------
   ML helpers
------------------------- */
function percentile(arr, p){
  if(!arr || !arr.length) return 0;
  const a = arr.slice().filter(x=>Number.isFinite(x) && x>0).sort((x,y)=>x-y);
  if(!a.length) return 0;
  const idx = (a.length-1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return a[lo];
  const t = idx - lo;
  return a[lo]*(1-t) + a[hi]*t;
}
function transitionMatrix(needs){
  let JJ=0, JD=0, DJ=0, DD=0;
  for(let i=1;i<needs.length;i++){
    const a = needs[i-1], b = needs[i];
    if(a==='jump' && b==='jump') JJ++;
    else if(a==='jump' && b==='duck') JD++;
    else if(a==='duck' && b==='jump') DJ++;
    else if(a==='duck' && b==='duck') DD++;
  }
  return { JJ, JD, DJ, DD };
}

/* -------------------------
   Telegraph overlay
------------------------- */
function telegraphOn(text){
  if (!elTele) return;
  const inner = elTele.querySelector('.jd-tele-inner');
  if (inner && text) inner.textContent = text;
  elTele.classList.remove('jd-hidden');
  elTele.classList.add('on');
}
function telegraphOff(){
  if (!elTele) return;
  elTele.classList.remove('on');
  setTimeout(()=> elTele && elTele.classList.add('jd-hidden'), 120);
}

/* -------------------------
   Boss variants (deterministic)
------------------------- */
function pickBossVariant(){
  const s = strToSeed((HHA_CTX.seed||'') + '|' + (state?.sessionId||'') + '|BOSS');
  const r = mulberry32(s)();
  const variants = ['tempo','feint','shield','mirror','chaos'];
  return variants[Math.floor(r * variants.length)];
}

/* -------------------------
   State
------------------------- */
let running = false;
let state = null;
let rafId = null;
let lastFrame = null;
let lastAction = null; // {type:'jump'|'duck', time:number}
let nextObstacleId = 1;

function getPhase(progress){
  if (progress < PHASE_THRESH[0]) return 1;
  if (progress < PHASE_THRESH[1]) return 2;
  return 3;
}

/* -------------------------
   Start / End
------------------------- */
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
    mode,
    diffKey,
    cfg0,
    durationMs,
    isTutorial,

    // ✅ PRO enabled only in training
    pro: (mode === 'training') && isPro(),

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
    needSeq: [],

    fever: 0,
    feverActive: false,
    feverRemain: 0,

    // boss
    bossAlive: false,
    bossHp: BOSS.hpMax,
    bossEnterAtMs: null,
    bossNextBurstAt: now + BOSS.burstEveryMs,
    bossNextTempoAt: now + BOSS.tempoShiftEveryMs,
    bossShieldNeedStreak: 0,
    bossShieldStreak: 0,
    bossBurstCount: 0,
    bossShieldBreakAtMs: null,
    bossFrenzyOn: false,

    // ✅ boss variant + overheat
    bossVariant: '',
    bossOverheatNeed: 0,
    bossOverheatEndAt: 0,
    bossOverheatHits: 0,

    participant: collectParticipant(mode),
    ctx: { ...HHA_CTX },

    events: [],
    sessions: []
  };

  running = true;
  lastFrame = now;

  // UI reset
  elObsHost && (elObsHost.innerHTML = '');
  elAvatar && elAvatar.classList.remove('jump','duck');
  bossBarWrap && bossBarWrap.classList.add('jd-hidden');
  telegraphOff();

  // HUD
  elHudMode && (elHudMode.textContent = modeLabel(mode) + (state.pro ? ' PRO' : ''));
  elHudDiff && (elHudDiff.textContent = diffKey);
  elHudDur  && (elHudDur.textContent  = (durationMs/1000|0)+'s');
  elHudStab && (elHudStab.textContent = '100%');
  elHudObs  && (elHudObs.textContent  = '0 / 0');
  elHudScore&& (elHudScore.textContent= '0');
  elHudCombo&& (elHudCombo.textContent= '0');
  elHudTime && (elHudTime.textContent = (durationMs/1000).toFixed(1));
  elHudPhase && (elHudPhase.textContent = '1');
  elHudBoss && (elHudBoss.textContent = '—');

  if (elProgFill) elProgFill.style.transform = 'scaleX(0)';
  if (elProgText) elProgText.textContent = '0%';
  if (elFeverFill) elFeverFill.style.transform = 'scaleX(0)';
  if (elFeverStat){
    elFeverStat.textContent = 'Ready';
    elFeverStat.classList.remove('on');
  }
  if (bossFill) bossFill.style.transform = 'scaleX(1)';
  if (bossStatus){
    bossStatus.textContent = '—';
    bossStatus.classList.remove('on');
  }

  pushEvent('start', { pro: state.pro?1:0 });

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

function buildSessionRow(end_reason){
  const total = state.obstaclesSpawned || 0;
  const hits  = state.hits || 0;
  const acc   = total ? hits/total : 0;
  const rtMean = state.hitRTs.length ? state.hitRTs.reduce((a,b)=>a+b,0)/state.hitRTs.length : 0;

  const rtP10 = percentile(state.hitRTs, 0.10);
  const rtP50 = percentile(state.hitRTs, 0.50);
  const rtP90 = percentile(state.hitRTs, 0.90);
  const tr = transitionMatrix(state.needSeq);

  const bossTimeMs = state.bossEnterAtMs ? Math.max(0, state.elapsedMs - state.bossEnterAtMs) : 0;

  return {
    timestampIso: nowIso(),
    projectTag: 'jumpduck',
    runMode: state.mode,
    studyId: state.ctx.studyId || '',
    phase: state.ctx.phase || '',
    conditionGroup: state.ctx.conditionGroup || '',
    sessionId: state.sessionId,
    gameMode: 'jumpduck',
    diff: state.diffKey,
    pro: state.pro ? 1 : 0,

    durationPlannedSec: (state.durationMs||0)/1000,
    durationPlayedSec: +(state.elapsedMs/1000).toFixed(2),

    scoreFinal: Math.round(state.score||0),
    comboMax: state.maxCombo||0,
    misses: state.miss||0,

    obstaclesTotal: total,
    hitsTotal: hits,
    accPct: +(acc*100).toFixed(2),

    avgRtMs: rtMean ? +rtMean.toFixed(1) : 0,
    rtP10Ms: rtP10 ? +rtP10.toFixed(1) : 0,
    medianRtMs: rtP50 ? +rtP50.toFixed(1) : 0,
    rtP90Ms: rtP90 ? +rtP90.toFixed(1) : 0,

    stabilityMinPct: +(state.minStability||0).toFixed(1),

    bossVariant: state.bossVariant || '',
    bossHpEnd: +(state.bossHp||0).toFixed(1),
    bossBurstCount: state.bossBurstCount||0,
    bossShieldBreakMs: state.bossShieldBreakAtMs ? Math.round(state.bossShieldBreakAtMs) : '',
    bossOverheatHits: state.bossOverheatHits || 0,
    bossTimeMs: Math.round(bossTimeMs),
    bossFrenzyOn: state.bossFrenzyOn ? 1 : 0,

    JJ: tr.JJ, JD: tr.JD, DJ: tr.DJ, DD: tr.DD,

    studentKey: state.ctx.pid || '',
    group: state.participant?.group || '',
    note: state.participant?.note || '',

    end_reason
  };
}

async function endGame(reason='end'){
  running = false;
  if (rafId!=null){ cancelAnimationFrame(rafId); rafId=null; }
  if (!state) return;

  const ses = buildSessionRow(reason);
  state.sessions.push(ses);

  if (state.isTutorial){
    showJudge('จบ Tutorial แล้ว! 🎉', 'ok');
    setTimeout(()=> showView('menu'), 650);
    return;
  }

  const total = state.obstaclesSpawned || 0;
  const hits  = state.hits || 0;
  const acc   = total ? hits/total : 0;
  const rtMean = state.hitRTs.length ? state.hitRTs.reduce((a,b)=>a+b,0)/state.hitRTs.length : 0;

  resMode && (resMode.textContent = modeLabel(state.mode) + (state.pro?' PRO':''));
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
}

/* -------------------------
   Fever
------------------------- */
function updateFever(dtSec){
  if (!state) return;

  if (state.feverActive){
    state.feverRemain -= dtSec;
    if (state.feverRemain <= 0){
      state.feverActive = false;
      state.feverRemain = 0;
      showJudge('FEVER จบแล้ว ลองสะสมใหม่!', 'ok');
      pushEvent('fever_end', {});
    }
  }else{
    state.fever = Math.max(0, state.fever - FEVER.decayPerSec * dtSec);
  }

  const ratio = Math.min(1, (state.fever||0)/100);
  if (elFeverFill) elFeverFill.style.transform = `scaleX(${ratio.toFixed(3)})`;
  if (elFeverStat){
    if (state.feverActive){
      elFeverStat.textContent = 'FEVER!';
      elFeverStat.classList.add('on');
    }else{
      elFeverStat.textContent = 'Ready';
      elFeverStat.classList.remove('on');
    }
  }
}

function feverGainOnHit(){
  const g = FEVER.gainOnHit[state.diffKey] ?? 16;
  state.fever = Math.min(100, state.fever + g);
  if (!state.feverActive && state.fever >= FEVER.threshold){
    state.feverActive = true;
    state.feverRemain = FEVER.durationSec;
    state.fever = 100;
    playSfx('jd-sfx-fever');
    showJudge('🔥 FEVER! คะแนนคูณ!', 'combo');
    pushEvent('fever_start', {});
  }
}

/* -------------------------
   Boss
------------------------- */
function bossEnter(ts){
  state.bossAlive = true;
  state.bossHp = BOSS.hpMax;
  state.bossEnterAtMs = Math.round(state.elapsedMs||0);

  state.bossNextBurstAt = ts + 1200;
  state.bossNextTempoAt = ts + 1400;

  state.bossShieldNeedStreak = 0;
  state.bossShieldStreak = 0;
  state.bossBurstCount = 0;
  state.bossShieldBreakAtMs = null;
  state.bossFrenzyOn = false;

  state.bossVariant = pickBossVariant();

  // reset overheat
  state.bossOverheatNeed = 0;
  state.bossOverheatEndAt = 0;
  state.bossOverheatHits = 0;

  bossBarWrap && bossBarWrap.classList.remove('jd-hidden');
  bossStatus && (bossStatus.textContent = 'BOSS!');
  bossStatus && bossStatus.classList.add('on');

  playSfx('jd-sfx-boss');
  pushEvent('boss_enter', { bossHp: state.bossHp, variant: state.bossVariant });

  showJudge('👾 BOSS: ' + state.bossVariant.toUpperCase(), 'combo');
  telegraphOn('⚡ BOSS IN');
  setTimeout(telegraphOff, 650);
}

function updateBoss(ts){
  if (!state || !state.bossAlive) return;

  // shield start
  if (state.bossHp <= BOSS.shieldPhaseAtHp && state.bossShieldNeedStreak === 0){
    state.bossShieldNeedStreak = BOSS.shieldNeedStreak;
    state.bossShieldStreak = 0;
    pushEvent('boss_shield_start', { need: state.bossShieldNeedStreak });
    showJudge(`🛡️ SHIELD! ถูกติดกัน ${BOSS.shieldNeedStreak} ครั้ง`, 'combo');
    telegraphOn('🛡️ SHIELD');
    setTimeout(telegraphOff, 700);
  }

  // frenzy
  if (!state.bossFrenzyOn && state.bossHp <= BOSS.frenzyAtHp){
    state.bossFrenzyOn = true;
    pushEvent('boss_frenzy_on', {});
    showJudge('💥 FINAL FRENZY!', 'combo');
    telegraphOn('💥 FINAL');
    setTimeout(telegraphOff, 650);
  }

  // Overheat: เฉพาะ variant chaos (สุ่มช่วงสั้น ๆ)
  if (state.bossVariant === 'chaos' && !state.bossOverheatNeed && RNG() < 0.005){
    state.bossOverheatNeed = 1;
    state.bossOverheatHits = 0;
    state.bossOverheatEndAt = ts + 2200;
    telegraphOn('🔥 OVERHEAT!');
    setTimeout(telegraphOff, 550);
    showJudge('🔥 OVERHEAT! 2 วิ ห้ามพลาด!', 'combo');
    pushEvent('boss_overheat_start', {});
  }
  if (state.bossOverheatNeed && ts >= state.bossOverheatEndAt){
    state.bossOverheatNeed = 0;
    telegraphOn('✅ COOL');
    setTimeout(telegraphOff, 400);
    showJudge('✅ ผ่าน OVERHEAT!', 'ok');
    pushEvent('boss_overheat_end', { hits: state.bossOverheatHits });
  }

  // tempo shift
  const tempoBase = state.bossFrenzyOn ? (BOSS.tempoShiftEveryMs*0.80) : BOSS.tempoShiftEveryMs;
  let tempoEvery = tempoBase;
  if (state.bossVariant === 'tempo') tempoEvery *= 0.85;
  if (state.bossVariant === 'mirror') tempoEvery *= 0.92;

  if (ts >= state.bossNextTempoAt){
    state.bossNextTempoAt = ts + tempoEvery + (RNG()*420 - 200);
    telegraphOn('⚡ TEMPO SHIFT');
    setTimeout(telegraphOff, 550);
    pushEvent('boss_tempo_shift', { bossHp: state.bossHp });
  }

  // burst
  let burstEvery = state.bossFrenzyOn ? BOSS.frenzyBurstEveryMs : BOSS.burstEveryMs;
  if (state.bossVariant === 'mirror') burstEvery *= 0.92;
  if (state.bossVariant === 'chaos')  burstEvery *= 0.88;

  if (state.pro) burstEvery *= BOSS.proFrenzyMul;
  burstEvery = Math.max(2400, burstEvery);

  if (ts >= state.bossNextBurstAt){
    state.bossNextBurstAt = ts + burstEvery + (RNG()*520 - 240);
    bossBurst(ts, state.bossFrenzyOn);
  }

  // HUD
  if (elHudBoss) elHudBoss.textContent = `${Math.max(0, Math.round(state.bossHp))}%`;
  if (bossFill) bossFill.style.transform = `scaleX(${Math.max(0, state.bossHp/BOSS.hpMax).toFixed(3)})`;
  if (bossStatus){
    bossStatus.textContent =
      state.bossOverheatNeed ? 'OVERHEAT!' :
      (state.bossShieldNeedStreak > 0)
        ? `SHIELD ${state.bossShieldStreak}/${state.bossShieldNeedStreak}`
        : (state.feverActive ? 'FEVER!' : (state.bossFrenzyOn ? 'FRENZY!' : 'BOSS!'));
    bossStatus.classList.add('on');
  }

  // win
  if (state.bossHp <= 0){
    state.bossHp = 0;
    state.bossAlive = false;
    pushEvent('boss_down', {});
    showJudge('🏆 BOSS DOWN! เก่งมาก!', 'combo');
    endGame('boss-down');
  }
}

function bossBurst(ts, frenzy){
  telegraphOn(frenzy ? '💥 BURST+' : '⚡ BURST');
  setTimeout(telegraphOff, 600);

  state.bossBurstCount++;
  pushEvent('boss_burst', { frenzy: frenzy?1:0 });

  // patterns (variant biases)
  let patterns = ['mirror','abab','aab','random','stair','doubletap'];
  if (state.bossVariant === 'mirror') patterns = ['mirror','abab','doubletap','stair'];
  if (state.bossVariant === 'feint')  patterns = ['random','aab','abab','stair'];
  if (state.bossVariant === 'tempo')  patterns = ['abab','mirror','aab','doubletap'];
  if (state.bossVariant === 'shield') patterns = ['mirror','aab','stair','doubletap'];
  if (state.bossVariant === 'chaos')  patterns = ['random','stair','abab','doubletap','aab'];

  const p = patterns[Math.floor(RNG()*patterns.length)];

  const baseN = 5 + Math.floor(RNG()*3);
  const n = frenzy ? (baseN + BOSS.frenzyLenBoost) : baseN;
  const baseDelay = frenzy ? 105 : 125;

  const seq = [];
  const flip = (x)=> (x==='low') ? 'high' : 'low';

  if (p === 'mirror'){
    const start = (RNG()<0.5) ? 'low' : 'high';
    for (let i=0;i<n;i++) seq.push((i%2===0)?start:flip(start));
  }else if (p === 'abab'){
    const a = (RNG()<0.5) ? 'low' : 'high';
    const b = flip(a);
    for (let i=0;i<n;i++) seq.push(i%2===0?a:b);
  }else if (p === 'aab'){
    const a = (RNG()<0.5) ? 'low' : 'high';
    const b = flip(a);
    for (let i=0;i<n;i++) seq.push((i%3===2)?b:a);
  }else if (p === 'stair'){
    const start = (RNG()<0.5) ? 'low' : 'high';
    for (let i=0;i<n;i++){
      const block = Math.floor(i/2)%2;
      seq.push(block===0 ? start : flip(start));
    }
  }else if (p === 'doubletap'){
    const start = (RNG()<0.5) ? 'low' : 'high';
    for (let i=0;i<n;i++){
      const k = Math.floor(i/2);
      seq.push((k%2===0)?start:flip(start));
    }
  }else{
    for (let i=0;i<n;i++) seq.push(RNG()<0.5?'low':'high');
  }

  for (let i=0;i<seq.length;i++){
    const type = seq[i];
    setTimeout(()=> {
      if (running && state) makeOne(type, performance.now(), /*isBoss*/true, /*allowFeint*/true);
    }, baseDelay*i);
  }

  showJudge(frenzy ? '💥 FRENZY BURST!' : '⚡ BURST!', 'combo');
}

/* -------------------------
   Obstacles spawn + FEINT/REVEAL
------------------------- */
function spawnObstacle(ts, phase){
  if (!elObsHost || !state) return;

  const last = state.obstacles[state.obstacles.length - 1];
  if (last && last.x > 70) return;

  const r = RNG();
  const type = AI.pickType(r);

  const pairP = (phase===3 ? 0.10 : 0.06) * (isAdaptiveAllowed()?1:0.65);
  const spawnPair = RNG() < pairP;

  makeOne(type, ts, /*isBoss*/(phase===3), /*allowFeint*/(phase===3));
  if (spawnPair){
    setTimeout(()=> {
      if (running && state) makeOne(RNG()<0.5?'high':'low', performance.now(), /*isBoss*/(phase===3), /*allowFeint*/(phase===3));
    }, 150);
  }
}

function makeOne(type, ts, isBoss, allowFeint){
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

  // FEINT probability (variant + pro)
  let feintP = BOSS.feintChance;
  if (state && state.bossVariant === 'feint') feintP *= 1.55;
  if (state && state.bossVariant === 'tempo') feintP *= 1.15;
  if (state && state.bossVariant === 'shield') feintP *= 0.90;
  if (state && state.pro) feintP *= BOSS.proFeintMul;

  let feint = false;
  let flipAtX = null;
  let revealAtX = null;

  if (allowFeint && RNG() < feintP){
    feint = true;
    flipAtX = BOSS.feintFlipAtX + (RNG()*2 - 1);
    revealAtX = BOSS.revealAtX + (RNG()*2 - 1);
    el.classList.add('jd-feint');
  }

  state.obstacles.push({
    id: nextObstacleId++,
    type,
    need,
    x: SPAWN_X,
    createdAt: ts,
    resolved:false,
    element: el,
    isBoss: !!isBoss,
    feint,
    flipped:false,
    flipAtX,
    revealAtX
  });

  state.obstaclesSpawned++;
  playSfx('jd-sfx-beep');
}

/* -------------------------
   Loop
------------------------- */
function loop(ts){
  if (!running || !state) return;

  const dt = ts - (lastFrame||ts);
  lastFrame = ts;

  state.elapsedMs = ts - state.startTime;
  state.remainingMs = Math.max(0, state.durationMs - state.elapsedMs);

  const progress = Math.min(1, state.elapsedMs / state.durationMs);
  const phase = getPhase(progress);

  elHudTime && (elHudTime.textContent = (state.remainingMs/1000).toFixed(1));
  elHudPhase && (elHudPhase.textContent = String(phase));

  if (state.elapsedMs >= state.durationMs){
    endGame('timeup');
    return;
  }

  if (elProgFill) elProgFill.style.transform = `scaleX(${progress.toFixed(3)})`;
  if (elProgText) elProgText.textContent = Math.round(progress*100) + '%';

  updateFever(dt/1000);

  // ✅ Boss in all modes (test/research included)
  if (phase === 3){
    if (!state.bossAlive) bossEnter(ts);
    updateBoss(ts);
  }else{
    elHudBoss && (elHudBoss.textContent = '—');
  }

  // spawn
  while (ts >= state.nextSpawnAt){
    spawnObstacle(ts, phase);
    let interval = state.cfg0.spawnMs;

    if (state.mode === 'training'){
      const factor = 1 - 0.30*progress;
      interval = interval * Math.max(0.58, factor);
      interval = AI.adjustSpawnInterval(interval, phase);

      // ✅ PRO tighten (training only)
      if (state.pro){
        interval *= PRO.spawnMul;
        interval = Math.max(480, interval);
      }
    }else{
      // test/research stable
      if (phase === 3) interval *= 0.90;
      interval = Math.max(620, Math.min(1800, interval));
    }

    state.nextSpawnAt += interval;
  }

  updateObstacles(dt, ts, phase, progress);
  pollGamepad();

  elHudStab && (elHudStab.textContent = state.stability.toFixed(1)+'%');
  elHudObs && (elHudObs.textContent = `${state.hits} / ${state.obstaclesSpawned}`);
  elHudScore && (elHudScore.textContent = String(Math.round(state.score)));
  elHudCombo && (elHudCombo.textContent = String(state.combo));

  if (phase >= 2){
    const tip = AI.coachTip(state.elapsedMs);
    if (tip) showJudge(tip, 'combo');
  }

  rafId = requestAnimationFrame(loop);
}

/* -------------------------
   Obstacles movement + judge (with PRO hit window + Overheat fail)
------------------------- */
function updateObstacles(dt, now, phase, progress){
  const cfg = state.cfg0;
  let speed = cfg.speed;

  if (phase === 2) speed *= 1.12;
  if (phase === 3) speed *= 1.26;
  if (state.mode === 'training') speed *= (1 + 0.18*progress);

  // ✅ PRO speed
  if (state.pro) speed *= PRO.speedMul;

  // boss tempo wobble
  if (phase === 3 && state.bossAlive){
    const wob = 1 + 0.06*Math.sin((now - state.startTime)/420);
    speed *= wob;
  }

  const move = speed * (dt/1000);
  const keep = [];

  for (const obs of state.obstacles){
    obs.x -= move;
    if (obs.element) obs.element.style.left = obs.x + '%';

    // FEINT reveal + flip
    if (obs.feint && obs.element && !obs.resolved){
      if (obs.revealAtX != null && obs.x <= obs.revealAtX){
        obs.element.classList.add('jd-reveal');
      }
      if (!obs.flipped && obs.flipAtX != null && obs.x <= obs.flipAtX){
        obs.flipped = true;
        obs.type = (obs.type === 'high') ? 'low' : 'high';
        obs.need = (obs.need === 'duck') ? 'jump' : 'duck';

        obs.element.classList.toggle('jd-obstacle--high', obs.type === 'high');
        obs.element.classList.toggle('jd-obstacle--low', obs.type === 'low');

        const ico = obs.element.querySelector('.jd-obs-icon');
        const tag = obs.element.querySelector('.jd-obs-tag');
        if (ico) ico.textContent = (obs.type === 'high') ? '⬇' : '⬆';
        if (tag) tag.textContent = (obs.type === 'high') ? 'DUCK' : 'JUMP';

        playSfx('jd-sfx-beep');
        showJudge('👀 หลอก! อ่านใหม่!', 'combo');
        pushEvent('feint_flip', { targetId: obs.id, required_action: obs.need });
      }
    }

    // HIT window
    if (!obs.resolved && obs.x <= CENTER_X + 6 && obs.x >= CENTER_X - 6){
      const a = lastAction;
      if (a && a.time){
        const baseWin = cfg.hitWinMs;
        const hitWin = state.pro ? (baseWin * PRO.hitWinMul) : baseWin;
        const rt = Math.abs(a.time - now);
        const perfect = rt <= (hitWin * 0.55);

        if (a.type === obs.need && rt <= hitWin){
          obs.resolved = true;

          state.hits++;
          state.combo++;
          state.maxCombo = Math.max(state.maxCombo, state.combo);

          state.needSeq.push(obs.need);

          const comboM = 1 + Math.min(state.combo-1, 6)*0.15;
          const phaseM = (phase === 3) ? 1.18 : (phase === 2 ? 1.08 : 1.0);
          const feverM = state.feverActive ? 1.35 : 1.0;
          const perfM  = perfect ? 1.15 : 1.0;

          const gain = Math.round(cfg.score * comboM * phaseM * feverM * perfM);
          state.score += gain;

          // boss damage
          if (phase === 3 && state.bossAlive){
            let dmg = perfect ? BOSS.dmgOnPerfect : BOSS.dmgOnHit;
            dmg *= (state.feverActive ? 1.2 : 1.0);
            state.bossHp = Math.max(0, state.bossHp - dmg);

            if (state.bossShieldNeedStreak > 0){
              state.bossShieldStreak++;
              if (state.bossShieldStreak >= state.bossShieldNeedStreak){
                state.bossShieldNeedStreak = 0;
                state.bossShieldStreak = 0;
                state.bossHp = Math.max(0, state.bossHp - BOSS.shieldBreakBonusDmg);
                state.bossShieldBreakAtMs = Math.round(state.elapsedMs||0);
                showJudge('💥 SHIELD BREAK!', 'combo');
                pushEvent('boss_shield_break', { bossHp: state.bossHp });
                telegraphOn('💥 BREAK!');
                setTimeout(telegraphOff, 500);
              }
            }

            // overheat success count
            if (state.bossOverheatNeed) state.bossOverheatHits++;
          }

          if (obs.need === 'jump') state.jumpHit++; else state.duckHit++;
          state.stability = Math.min(100, state.stability + cfg.stabGain);
          state.minStability = Math.min(state.minStability, state.stability);

          state.hitRTs.push(rt);
          feverGainOnHit();

          AI.onOutcome(obs.need, true, rt);

          obs.element && obs.element.remove();
          obs.element = null;

          playSfx('jd-sfx-hit');
          if (state.combo >= 8 || perfect) playSfx('jd-sfx-combo');

          const msg = perfect
            ? (obs.need === 'jump' ? 'PERFECT JUMP! ⚡' : 'PERFECT DUCK! ⚡')
            : (obs.need === 'jump' ? 'JUMP ดีมาก 🦘' : 'DUCK ทันเวลา 🛡️');

          showJudge(msg, (state.combo>=8 || perfect) ? 'combo' : 'ok');

          pushEvent('hit', Object.assign({
            targetId: obs.id,
            itemType: obs.type,
            required_action: obs.need,
            action: a.type,
            rtMs: Math.round(rt),
            judgment: perfect ? 'perfect' : 'good',
            totalScore: Math.round(state.score),
            combo: state.combo,
            feverState: state.feverActive ? 1 : 0,
            feverValue: +state.fever.toFixed(1),
            bossHp: +state.bossHp.toFixed(1),
            bossVariant: state.bossVariant,
            overheat: state.bossOverheatNeed ? 1 : 0,
            feint: obs.feint ? 1 : 0,
            pro: state.pro ? 1 : 0
          }, AI.snapshot()));

          continue;
        }

        // wrong action within window
        if (rt <= hitWin && a.type !== obs.need){
          obs.resolved = true;

          state.miss++;
          state.combo = 0;
          state.needSeq.push(obs.need);

          if (obs.need === 'jump') state.jumpMiss++; else state.duckMiss++;

          const stabDmg = state.pro ? (cfg.stabDmg * PRO.stabDmgMul) : cfg.stabDmg;
          state.stability = Math.max(0, state.stability - stabDmg);
          state.minStability = Math.min(state.minStability, state.stability);

          AI.onOutcome(obs.need, false, rt);

          if (phase === 3 && state.bossShieldNeedStreak > 0){
            state.bossShieldStreak = 0;
          }

          // overheat fail penalty
          if (phase === 3 && state.bossOverheatNeed){
            state.stability = Math.max(0, state.stability - 6);
            showJudge('🔥 OVERHEAT FAIL!', 'miss');
            pushEvent('boss_overheat_fail', {});
            state.bossOverheatNeed = 0;
          }else{
            showJudge('ผิดท่า! 🌀', 'miss');
          }

          obs.element && obs.element.remove();
          obs.element = null;

          playSfx('jd-sfx-miss');
          elPlayArea?.classList.add('shake');
          setTimeout(()=> elPlayArea?.classList.remove('shake'), 180);

          pushEvent('miss', Object.assign({
            targetId: obs.id,
            itemType: obs.type,
            required_action: obs.need,
            action: a.type,
            rtMs: Math.round(rt),
            judgment: 'miss',
            extra: 'wrong-action',
            totalScore: Math.round(state.score),
            combo: 0,
            feverState: state.feverActive ? 1 : 0,
            feverValue: +state.fever.toFixed(1),
            bossHp: +state.bossHp.toFixed(1),
            bossVariant: state.bossVariant,
            overheat: state.bossOverheatNeed ? 1 : 0,
            feint: obs.feint ? 1 : 0,
            pro: state.pro ? 1 : 0
          }, AI.snapshot()));

          if (state.stability <= 0){
            showJudge('หมดแรงทรงตัว! ⛔', 'miss');
            endGame('stability-zero');
            return;
          }

          continue;
        }
      }
    }

    // miss passed zone
    if (!obs.resolved && obs.x <= MISS_X){
      obs.resolved = true;

      state.miss++;
      state.combo = 0;
      state.needSeq.push(obs.need);

      if (obs.need === 'jump') state.jumpMiss++; else state.duckMiss++;

      const stabDmg = state.pro ? (cfg.stabDmg * PRO.stabDmgMul) : cfg.stabDmg;
      state.stability = Math.max(0, state.stability - stabDmg);
      state.minStability = Math.min(state.minStability, state.stability);

      AI.onOutcome(obs.need, false, NaN);

      if (phase === 3 && state.bossShieldNeedStreak > 0){
        state.bossShieldStreak = 0;
      }

      if (phase === 3 && state.bossOverheatNeed){
        state.stability = Math.max(0, state.stability - 6);
        showJudge('🔥 OVERHEAT FAIL!', 'miss');
        pushEvent('boss_overheat_fail', {});
        state.bossOverheatNeed = 0;
      }else{
        showJudge('MISS ลองใหม่อีกที ✨', 'miss');
      }

      obs.element && obs.element.remove();
      obs.element = null;

      playSfx('jd-sfx-miss');
      elPlayArea?.classList.add('shake');
      setTimeout(()=> elPlayArea?.classList.remove('shake'), 180);

      pushEvent('miss', Object.assign({
        targetId: obs.id,
        itemType: obs.type,
        required_action: obs.need,
        action: lastAction ? lastAction.type : '',
        rtMs: '',
        judgment: 'miss',
        extra: 'late-no-action',
        totalScore: Math.round(state.score),
        combo: 0,
        feverState: state.feverActive ? 1 : 0,
        feverValue: +state.fever.toFixed(1),
        bossHp: +state.bossHp.toFixed(1),
        bossVariant: state.bossVariant,
        overheat: state.bossOverheatNeed ? 1 : 0,
        feint: obs.feint ? 1 : 0,
        pro: state.pro ? 1 : 0
      }, AI.snapshot()));

      if (state.stability <= 0){
        showJudge('หมดแรงทรงตัว! ⛔', 'miss');
        endGame('stability-zero');
        return;
      }

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
}

/* -------------------------
   Input
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

  if (HHA_CTX.mode && elMode) elMode.value = HHA_CTX.mode;
  if (HHA_CTX.diff && elDiff) elDiff.value = HHA_CTX.diff;
  if (HHA_CTX.duration && elDuration) elDuration.value = String(HHA_CTX.duration);

  if (elPid && HHA_CTX.pid) elPid.value = HHA_CTX.pid;
  if (elGroup && HHA_CTX.group) elGroup.value = HHA_CTX.group;
  if (elNote && HHA_CTX.note) elNote.value = HHA_CTX.note;

  elMode?.addEventListener('change', updateResearchVisibility);
  updateResearchVisibility();

  $('[data-action="start"]')?.addEventListener('click', startGameFromMenu);
  $('[data-action="tutorial"]')?.addEventListener('click', startTutorial);
  $('[data-action="stop-early"]')?.addEventListener('click', ()=> running && endGame('stop-early'));
  $('[data-action="play-again"]')?.addEventListener('click', startGameFromMenu);
  $$('[data-action="back-menu"]').forEach(btn=> btn.addEventListener('click', ()=> showView('menu')));

  // actionbar (backup)
  $('[data-action="jump"]')?.addEventListener('click', ()=> triggerAction('jump'));
  $('[data-action="duck"]')?.addEventListener('click', ()=> triggerAction('duck'));

  window.addEventListener('keydown', handleKeyDown, {passive:false});
  elPlayArea?.addEventListener('pointerdown', handlePointerDown, {passive:false});

  await ensureVrUi();
  window.addEventListener('hha:shoot', onHhaShoot);

  showView('menu');
}

/* -------------------------
   Export (ML/DL ready)
------------------------- */
window.JD_EXPORT = {
  getState(){ return state ? JSON.parse(JSON.stringify(state)) : null; },
  getEvents(){ return state ? JSON.parse(JSON.stringify(state.events)) : []; },
  getSessions(){ return state ? JSON.parse(JSON.stringify(state.sessions)) : []; }
};

window.addEventListener('DOMContentLoaded', initJD);