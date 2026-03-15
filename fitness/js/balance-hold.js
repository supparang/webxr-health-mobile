// === /fitness/js/balance-hold.js ===
// Balance Hold — DOM-based Balance Platform + Obstacle Avoidance
// FULL PATCH v20260315-BALANCE-HOLD-FLOW-RESULT-COOLDOWN-FULL
// ✅ launcher -> warmup-gate -> game -> result -> cooldown-gate -> hub
// ✅ direct run supported
// ✅ difficulty / duration / view prefill
// ✅ deterministic seeded RNG
// ✅ warmup buff passthrough
// ✅ practice / countdown / main1 / main2 / rush
// ✅ anti-idle foundation
// ✅ obstacle objects + reaction evaluation
// ✅ result lock before cooldown
// ✅ exports with advanced analytics
'use strict';

/* ------------------------------------------------------------
 * DOM helpers
 * ------------------------------------------------------------ */
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

function setText(selOrEl, v){
  const el = (typeof selOrEl === 'string') ? $(selOrEl) : selOrEl;
  if (el) el.textContent = String(v ?? '');
}
function clamp(v, a, b){
  v = Number(v);
  if(!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
}
function fmtPercent(v){
  v = Number(v);
  if(!Number.isFinite(v)) return '-';
  return (v * 100).toFixed(1) + '%';
}
function fmtFloat(v, d=3){
  v = Number(v);
  if(!Number.isFinite(v)) return '-';
  return v.toFixed(d);
}

/* ------------------------------------------------------------
 * URL helpers
 * ------------------------------------------------------------ */
function qv(k, def=''){
  try{
    const u = new URL(window.location.href);
    const v = u.searchParams.get(k);
    return (v == null || v === '') ? def : v;
  }catch(e){
    return def;
  }
}
function qn(k, def=0){
  const v = Number(qv(k,''));
  return Number.isFinite(v) ? v : def;
}
function clampNum(v, min, max, def){
  v = Number(v);
  if (!Number.isFinite(v)) v = def;
  return Math.max(min, Math.min(max, v));
}
function parseBoolLike(v, fallback=false){
  if (v == null) return fallback;
  const s = String(v).trim().toLowerCase();
  if (['1','true','yes','y','on'].includes(s)) return true;
  if (['0','false','no','n','off'].includes(s)) return false;
  return fallback;
}
function normalizeMaybeEncodedUrl(v){
  v = String(v ?? '').trim();
  if(!v || v === 'null' || v === 'undefined') return '';
  if(/%3A|%2F|%3F|%26|%3D/i.test(v)){
    try{ v = decodeURIComponent(v); }catch(e){}
  }
  return v.trim();
}

/* ------------------------------------------------------------
 * Seeded RNG (deterministic)
 * ------------------------------------------------------------ */
function xmur3(str){
  str = String(str ?? '');
  let h = 1779033703 ^ str.length;
  for (let i=0; i<str.length; i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}
function sfc32(a,b,c,d){
  return function(){
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
function buildSeedString(meta){
  const qSeed = String(qv('seed','')).trim();
  if (qSeed) return qSeed;

  const day = new Date();
  const yyyy = day.getFullYear();
  const mm = String(day.getMonth()+1).padStart(2,'0');
  const dd = String(day.getDate()).padStart(2,'0');
  const ymd = `${yyyy}${mm}${dd}`;

  return [
    'balance-hold',
    meta?.mode || 'play',
    meta?.playerId || qv('pid','anon'),
    meta?.difficulty || qv('diff','normal'),
    meta?.durationSec || qv('time','60'),
    ymd
  ].join('|');
}
function makeRng(seedStr){
  const seed = xmur3(seedStr);
  return sfc32(seed(), seed(), seed(), seed());
}

/* ------------------------------------------------------------
 * View handling
 * ------------------------------------------------------------ */
const viewMenu     = $('#view-menu');
const viewResearch = $('#view-research');
const viewPlay     = $('#view-play');
const viewResult   = $('#view-result');

function showView(name){
  [viewMenu, viewResearch, viewPlay, viewResult].forEach(v=> v && v.classList.add('hidden'));
  if (name === 'menu')     viewMenu && viewMenu.classList.remove('hidden');
  if (name === 'research') viewResearch && viewResearch.classList.remove('hidden');
  if (name === 'play')     viewPlay && viewPlay.classList.remove('hidden');
  if (name === 'result')   viewResult && viewResult.classList.remove('hidden');
}
function applyViewModeClass(mode){
  document.body.classList.remove('view-pc','view-mobile','view-cvr');
  const m = (mode === 'mobile' || mode === 'cvr') ? mode : 'pc';
  document.body.classList.add('view-' + m);

  const cvr = $('#cvrOverlay');
  if (cvr) cvr.classList.toggle('hidden', m !== 'cvr');
}

/* ------------------------------------------------------------
 * DOM refs
 * ------------------------------------------------------------ */
const elDiffSel = $('#difficulty');
const elDurSel  = $('#sessionDuration');
const elViewSel = $('#viewMode');

const hudMode   = $('#hud-mode');
const hudDiff   = $('#hud-diff');
const hudDur    = $('#hud-dur');
const hudTime   = $('#hud-time');
const hudStab   = $('#hud-stability');
const hudObsA   = $('#hud-obstacles');
const hudObsB   = $('#hud-obs');
const hudStatus = $('#hud-status');
const hudPhase  = $('#hud-phase');
const hudScore  = $('#hud-score');
const hudCombo  = $('#hud-combo');

const stabilityFill = $('#stabilityFill');
const centerPulse   = $('#centerPulse');

const playArea      = $('#playArea');
const platformWrap  = $('#platform-wrap');
const platformEl    = $('#platform');
const indicatorEl   = $('#indicator');
const obstacleLayer = $('#obstacle-layer');

const coachLabel  = $('#coachLabel');
const coachBubble = $('#coachBubble');

const rankBadgeEl     = $('#rankBadge');
const resultHeroSub   = $('#resultHeroSub');
const heroInsightEl   = $('#heroInsight');
const heroBadgesEl    = $('#heroBadges');
const heroMissionEl   = $('#heroMissionChips');

const resMode      = $('#res-mode');
const resDiff      = $('#res-diff');
const resDur       = $('#res-dur');
const resEnd       = $('#res-end');
const resStability = $('#res-stability');
const resMeanTilt  = $('#res-meanTilt');
const resRmsTilt   = $('#res-rmsTilt');
const resAvoid     = $('#res-avoid');
const resHit       = $('#res-hit');
const resAvoidRate = $('#res-avoidRate');
const resFatigue   = $('#res-fatigue');
const resSamples   = $('#res-samples');

const resScoreEl   = $('#res-score');
const resRankEl    = $('#res-rank');
const resPerfectEl = $('#res-perfect');
const resComboEl   = $('#res-maxCombo');
const resAiTipEl   = $('#res-aiTip');
const resDailyEl   = $('#res-daily');

const tutorialOverlay = $('#tutorialOverlay');
const tutorialDontShowAgain = $('#tutorialDontShowAgain');
const endModal = $('#endModal');
const endModalRank = $('#endModalRank');
const endModalScore= $('#endModalScore');
const endModalInsight = $('#endModalInsight');

const cvrStrictLabel = $('#cvrStrictLabel');

/* ------------------------------------------------------------
 * Config
 * ------------------------------------------------------------ */
const GAME_DIFF = {
  easy:   { safeHalf:0.35, disturbMinMs:1400, disturbMaxMs:2600, disturbStrength:0.18, passiveDrift:0.010 },
  normal: { safeHalf:0.25, disturbMinMs:1200, disturbMaxMs:2200, disturbStrength:0.23, passiveDrift:0.020 },
  hard:   { safeHalf:0.18, disturbMinMs: 900, disturbMaxMs:1800, disturbStrength:0.30, passiveDrift:0.030 }
};
function pickDiff(k){ return GAME_DIFF[k] || GAME_DIFF.normal; }

function buildSessionConfig(diffKey, durationSec, viewMode){
  const base = pickDiff(diffKey);
  const durSec = clampNum(durationSec, 20, 300, 80);
  const view = ['pc','mobile','cvr'].includes(String(viewMode || '').toLowerCase())
    ? String(viewMode).toLowerCase()
    : 'pc';

  const viewCfg = (
    view === 'mobile' ? {
      inputDeadzone: 0.04,
      inputSmoothing: 0.22,
      inputMaxTarget: 0.95,
      antiIdleWindowMs: 2000,
      antiIdleInputThreshold: 0.030
    } :
    view === 'cvr' ? {
      inputDeadzone: 0.06,
      inputSmoothing: 0.18,
      inputMaxTarget: 0.85,
      antiIdleWindowMs: 1800,
      antiIdleInputThreshold: 0.028
    } : {
      inputDeadzone: 0.02,
      inputSmoothing: 0.35,
      inputMaxTarget: 1.00,
      antiIdleWindowMs: 2200,
      antiIdleInputThreshold: 0.035
    }
  );

  return {
    difficulty: diffKey,
    durationSec: durSec,
    durationMs: durSec * 1000,

    practiceSec: clampNum(qv('practice','15'), 0, 60, 15),
    practiceMs: clampNum(qv('practice','15'), 0, 60, 15) * 1000,
    practiceEnabled: parseBoolLike(qv('practiceOn', qv('practice','15') !== '0' ? '1' : '0'), true),

    countdownMs: 3000,
    mainCountdownMs: 2000,

    viewMode: view,

    safeHalf: base.safeHalf,
    passiveDrift: base.passiveDrift,
    disturbMinMs: base.disturbMinMs,
    disturbMaxMs: base.disturbMaxMs,
    disturbStrength: base.disturbStrength,

    sampleEveryMs: 120,
    maxTilt: 1.2,
    maxTarget: 1.0,

    antiIdleWindowMs: viewCfg.antiIdleWindowMs,
    antiIdleInputThreshold: viewCfg.antiIdleInputThreshold,
    antiIdlePenaltyRate: 0.18,

    nearMissThreshold: 0.90,
    perfectThreshold: 0.28,
    overshootThreshold: 0.78,

    phase1Ratio: 0.35,
    phase2Ratio: 0.75,
    rushRatio: 0.90,

    inputDeadzone: viewCfg.inputDeadzone,
    inputSmoothing: viewCfg.inputSmoothing,
    inputMaxTarget: viewCfg.inputMaxTarget,

    obstacleMaxActive: 4,
    obstacleImpactDelayMs: 950,
    obstacleCleanupMs: 1400
  };
}

function mapEndReason(code){
  switch(code){
    case 'timeout': return 'ครบเวลาที่กำหนด / Timeout';
    case 'manual':  return 'หยุดเอง / Stopped by player';
    default:        return code || '-';
  }
}

/* ------------------------------------------------------------
 * Warmup buff
 * ------------------------------------------------------------ */
function readWarmupBuff(){
  const wType = qv('wType','');
  const wPct  = clampNum(qv('wPct','0'), 0, 100, 0);
  const wCrit = clampNum(qv('wCrit','0'), 0, 10, 0);
  const wDmg  = clampNum(qv('wDmg','0'), 0, 10, 0);
  const wHeal = clampNum(qv('wHeal','0'), 0, 10, 0);
  const rank  = qv('rank','');

  return {
    wType, wPct, wCrit, wDmg, wHeal, rank,
    scoreBoostMul: 1 + (wPct / 100) * 0.5,
    critBonusChance: Math.min(0.35, wCrit * 0.03),
    dmgReduceMul: Math.max(0.5, 1 - wDmg * 0.05),
    healOnAvoid: Math.round(wHeal * 0.6)
  };
}

/* ------------------------------------------------------------
 * Flow helpers
 * ------------------------------------------------------------ */
function isFlowMode(){
  const auto = String(qv('autostart','')).toLowerCase();
  const gatePhase = String(qv('gatePhase','')).toLowerCase();
  const hub = normalizeMaybeEncodedUrl(qv('hub',''));
  const fromGate = !!qv('wType','') || gatePhase === 'warmup' || gatePhase === 'cooldown';

  return !!hub && (fromGate || ['1','true','yes','on'].includes(auto));
}

function buildHubUrl(){
  const rawHub = normalizeMaybeEncodedUrl(qv('hub',''));
  if(rawHub) return rawHub;

  const u = new URL('../herohealth/hub.html', window.location.href);
  [
    'run','diff','time','seed','pid','view',
    'log','api','ai','studyId','phase','conditionGroup','grade'
  ].forEach(k=>{
    const v = qv(k,'');
    if(v !== '') u.searchParams.set(k, v);
  });
  return u.toString();
}

function buildLauncherUrl(){
  const u = new URL('../herohealth/balance-hold-vr.html', window.location.href);
  u.searchParams.set('hub', buildHubUrl());

  [
    'run','diff','time','seed','pid','view',
    'log','api','ai','studyId','phase','conditionGroup','grade'
  ].forEach(k=>{
    const v = qv(k,'');
    if(v !== '') u.searchParams.set(k, v);
  });
  return u.toString();
}

function buildCooldownUrl(summary){
  const u = new URL('../herohealth/warmup-gate.html', window.location.href);

  u.searchParams.set('gatePhase', 'cooldown');
  u.searchParams.set('phase', 'cooldown');
  u.searchParams.set('cat', 'exercise');
  u.searchParams.set('game', 'balance');
  u.searchParams.set('theme', 'balance');
  u.searchParams.set('hub', buildHubUrl());
  u.searchParams.set('next', buildHubUrl());

  [
    'run','diff','time','seed','pid','view',
    'log','api','ai','studyId','conditionGroup','grade'
  ].forEach(k=>{
    const v = qv(k,'');
    if(v !== '') u.searchParams.set(k, v);
  });

  u.searchParams.set('cdur', qv('cdur','15'));

  if(summary){
    u.searchParams.set('lastGame', 'balance-hold');
    u.searchParams.set('lastScore', String(summary.score || 0));
    u.searchParams.set('lastRank', String(summary.rank || 'D'));
    u.searchParams.set('lastStab', String(Math.round((summary.stabilityRatio || 0) * 100)));
  }

  return u.toString();
}

/* ------------------------------------------------------------
 * Tutorial / modal helpers
 * ------------------------------------------------------------ */
function openTutorial(){
  if (!tutorialOverlay) return;
  tutorialOverlay.classList.remove('hidden');
  tutorialOverlay.setAttribute('aria-hidden','false');
}
function closeTutorial(){
  if (!tutorialOverlay) return;
  tutorialOverlay.classList.add('hidden');
  tutorialOverlay.setAttribute('aria-hidden','true');
}
function openEndModal(){
  if (!endModal) return;
  endModal.classList.remove('hidden');
  endModal.setAttribute('aria-hidden','false');
}
function closeEndModal(){
  if (!endModal) return;
  endModal.classList.add('hidden');
  endModal.setAttribute('aria-hidden','true');
}

/* ------------------------------------------------------------
 * Prefill UI
 * ------------------------------------------------------------ */
function applyQueryToUI(){
  const qDiff = String(qv('diff','')).toLowerCase();
  const qTime = qv('time','');
  const qRun  = String(qv('run','')).toLowerCase();
  const qView = String(qv('view','')).toLowerCase();

  if (elDiffSel && ['easy','normal','hard'].includes(qDiff)){
    elDiffSel.value = qDiff;
  }

  if (elDurSel && qTime){
    const t = clampNum(qTime, 10, 600, 60);
    const tStr = String(t);
    const has = [...elDurSel.options].some(o => o.value === tStr);
    if (!has){
      const opt = document.createElement('option');
      opt.value = tStr;
      opt.textContent = tStr;
      elDurSel.appendChild(opt);
    }
    elDurSel.value = tStr;
  }

  const pid = qv('pid','');
  const grp = qv('group','');
  const phs = qv('phase','');
  if ($('#researchId') && pid) $('#researchId').value = pid;
  if ($('#researchGroup') && grp) $('#researchGroup').value = grp;
  if ($('#researchPhase') && phs) $('#researchPhase').value = phs;

  if (elViewSel && ['pc','mobile','cvr'].includes(qView)){
    elViewSel.value = qView;
  }
  applyViewModeClass(qView || (elViewSel ? elViewSel.value : 'pc'));

  if (qRun === 'research'){
    showView('research');
  }
}

/* ------------------------------------------------------------
 * FX helpers
 * ------------------------------------------------------------ */
function fxEnabled(){ return String(qv('fx','1')) !== '0'; }

function spawnFloatFx(text, kind, pxX, pxY){
  if (!fxEnabled() || !playArea) return;
  const el = document.createElement('div');
  el.className = `fx-float ${kind || ''}`;
  el.textContent = text;
  el.style.left = `${pxX}px`;
  el.style.top  = `${pxY}px`;
  playArea.appendChild(el);
  setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 820);
}

function pulseEl(el){
  if (!el || !fxEnabled()) return;
  el.classList.remove('count-pop');
  void el.offsetWidth;
  el.classList.add('count-pop');
}

/* ------------------------------------------------------------
 * State
 * ------------------------------------------------------------ */
let state = null;
let rafId = null;
let tutorialAccepted = false;

const SESS_KEY = 'vrfit_sessions_balance-hold';

/* ------------------------------------------------------------
 * RNG helpers
 * ------------------------------------------------------------ */
function rand01(){
  return (state?.meta && typeof state.meta.rng === 'function')
    ? state.meta.rng()
    : Math.random();
}
function randomBetween(a,b){
  const r = rand01();
  return a + r * (b - a);
}

/* ------------------------------------------------------------
 * Create initial state
 * ------------------------------------------------------------ */
function createInitialState({
  mode,
  diffKey,
  durationSec,
  viewMode,
  playerId,
  group,
  phaseLabel,
  studyId,
  conditionGroup,
  seedStr,
  rng,
  warmupBuff
}){
  const now = performance.now();
  const cfg = buildSessionConfig(diffKey, durationSec, viewMode);
  const flowMode = isFlowMode() ? 'full-flow' : 'direct';

  return {
    meta: {
      gameId: 'balance-hold',
      zone: 'fitness',
      category: 'exercise',
      theme: 'balance',

      mode: mode || 'play',
      pid: playerId || 'anon',
      group: group || '',
      phaseLabel: phaseLabel || '',
      studyId: studyId || '',
      conditionGroup: conditionGroup || '',

      seed: seedStr || '',
      seedSource: qv('seed','') ? 'query' : 'derived',
      startedAtIso: new Date().toISOString(),
      startedAtMs: now,

      warmupBuff: warmupBuff || null,
      rng
    },

    flow: {
      fromLauncher: !!normalizeMaybeEncodedUrl(qv('hub','')),
      fromGate: !!qv('wType',''),
      flowMode,
      hubUrl: buildHubUrl(),
      launcherUrl: buildLauncherUrl(),
      cooldownUrl: '',

      shouldUseWarmup: !!qv('wType','') || isFlowMode(),
      shouldUseCooldown: flowMode === 'full-flow',
      resultLocked: true,
      cooldownAvailable: false,

      autostart: ['1','true','yes','on'].includes(String(qv('autostart','')).toLowerCase()),
      directRunOnly: !isFlowMode()
    },

    config: cfg,

    runtime: {
      isRunning: true,
      isPaused: false,
      isEnded: false,

      startedAt: now,
      endedAt: 0,
      lastFrameAt: now,
      pausedAt: 0,
      totalPausedMs: 0,

      nowElapsedMs: 0,
      remainMs: cfg.durationMs,

      activeView: 'play',
      endReason: ''
    },

    motion: {
      angle: 0,
      targetAngle: 0,
      velocity: 0,

      displayedAngleDeg: 0,
      displayX: 0,

      lastStableAt: now,
      lastUnsafeAt: now,
      lastCenterAt: now,

      currentDangerLevel: 0,
      currentPressureLevel: 0,

      driftBias: 0,
      shakeAmount: 0
    },

    input: {
      pointerActive: false,
      pointerDownAt: 0,
      lastInputAt: 0,
      lastMeaningfulInputAt: 0,

      inputCount: 0,
      moveCount: 0,
      meaningfulMoveCount: 0,

      cumulativeInputDistance: 0,
      recentInputDistance: 0,

      lastNorm: 0,
      lastDelta: 0,
      lastDirection: 0,

      activeCorrectionCount: 0,
      microCorrectionCount: 0,
      overshootCount: 0,

      idleMs: 0,
      idlePenaltyTicks: 0,
      idleFlag: false
    },

    phase: {
      current: cfg.practiceEnabled && cfg.practiceMs > 0 ? 'countdown' : 'main1',
      index: cfg.practiceEnabled && cfg.practiceMs > 0 ? 0 : 1,

      enteredAt: now,
      label: cfg.practiceEnabled && cfg.practiceMs > 0 ? 'Countdown' : 'Main 1',

      history: [],

      countdownStartedAt: cfg.practiceEnabled && cfg.practiceMs > 0 ? now : 0,
      practiceStartedAt: 0,
      mainStartedAt: cfg.practiceEnabled && cfg.practiceMs > 0 ? 0 : now,
      rushStartedAt: 0,

      transitionsFired: {
        phase2: false,
        rush: false
      }
    },

    obstacles: {
      seq: 1,
      nextSpawnAt: now + randomBetween(cfg.disturbMinMs, cfg.disturbMaxMs),
      active: [],

      totals: {
        total: 0,
        avoided: 0,
        hit: 0,
        perfect: 0,
        nearMiss: 0
      },

      byPhase: {
        practice: { total:0, avoided:0, hit:0, perfect:0 },
        main1:    { total:0, avoided:0, hit:0, perfect:0 },
        main2:    { total:0, avoided:0, hit:0, perfect:0 },
        rush:     { total:0, avoided:0, hit:0, perfect:0 }
      },

      pressure: {
        spawnIntervalMul: 1,
        speedMul: 1,
        strengthMul: 1
      }
    },

    scoring: {
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfects: 0,

      scoreBreakdown: {
        avoidBase: 0,
        perfectBonus: 0,
        comboBonus: 0,
        holdBonus: 0,
        rushBonus: 0,
        warmupBonus: 0,
        penaltyHit: 0,
        penaltyIdle: 0
      },

      currentComboTier: 0,
      comboSurgeActive: false,
      lastScoreEvent: null
    },

    analytics: {
      samples: [],
      totalSamples: 0,
      stableSamples: 0,

      sumTiltAbs: 0,
      sumTiltSq: 0,

      stabilityRatio: 0,
      meanTilt: 0,
      rmsTilt: 0,
      fatigueIndex: 0,

      idleRatio: 0,
      activeCorrectionRate: 0,
      overshootRate: 0,
      nearMissRate: 0,
      recoveryRate: 0,
      perfectRate: 0,

      nearMissCount: 0,
      recoveryCount: 0,
      failRecoveryCount: 0,

      phaseMetrics: {
        practice: { score:0, samples:0, stability:0, avoid:0, hit:0 },
        main1:    { score:0, samples:0, stability:0, avoid:0, hit:0 },
        main2:    { score:0, samples:0, stability:0, avoid:0, hit:0 },
        rush:     { score:0, samples:0, stability:0, avoid:0, hit:0 }
      }
    },

    effects: {
      enabled: fxEnabled(),
      floatingTexts: [],
      screenShakeAt: 0,
      pulseAt: 0,

      dangerPulse: false,
      rushBannerShown: false,
      comboSurgeShownAt: 0,

      pending: []
    },

    coach: {
      enabled: true,
      mode: 'rule-based',

      lastMessageAt: 0,
      minGapMs: 4000,

      currentMessage: '',
      queue: [],

      triggers: {
        idleWarned: false,
        phase2Warned: false,
        rushWarned: false,
        recoveryPraised: false
      }
    },

    results: {
      summary: null,
      rank: 'D',
      insight: '',
      badges: [],
      missions: [],

      ready: false,
      cooldownReady: false,
      savedToLocal: false,
      savedToHubSummary: false
    },

    debug: {
      logs: [],
      eventLog: [],
      warnings: [],
      lastObstacleDebug: null,
      flowCheckpoints: []
    }
  };
}

/* ------------------------------------------------------------
 * Session local save
 * ------------------------------------------------------------ */
function recordSessionToLocal(summary){
  try{
    const arr = JSON.parse(localStorage.getItem(SESS_KEY) || '[]');
    arr.push({
      ...summary,
      ts: Date.now()
    });
    localStorage.setItem(SESS_KEY, JSON.stringify(arr));
  }catch(e){}
}

/* ------------------------------------------------------------
 * Tutorial gating
 * ------------------------------------------------------------ */
function maybeShowTutorialBeforeStart(kind){
  const tutorialFlag = String(qv('tutorial','0'));
  const dontShow = localStorage.getItem('bh_tutorial_skip') === '1';
  if (tutorialFlag === '1' && !dontShow && !tutorialAccepted){
    openTutorial();
    document.body.dataset.pendingStartKind = (kind === 'research' ? 'research' : 'play');
    return true;
  }
  return false;
}

/* ------------------------------------------------------------
 * Input
 * ------------------------------------------------------------ */
function attachInput(){
  if (!playArea) return;

  function updateTargetFromEvent(ev){
    if (!state || state.runtime.isEnded) return;

    const rect = playArea.getBoundingClientRect();
    const x = ev.clientX ?? (ev.touches && ev.touches[0]?.clientX);
    if (x == null) return;

    const relX = (x - rect.left) / rect.width;
    let norm = (relX - 0.5) * 2;

    const cfg = state.config;

    if (Math.abs(norm) < cfg.inputDeadzone) norm = 0;
    norm = clamp(norm, -cfg.inputMaxTarget, cfg.inputMaxTarget);

    const isCvr = cfg.viewMode === 'cvr';
    if (isCvr && cvrStrictLabel && String(cvrStrictLabel.textContent || 'OFF').toUpperCase() === 'ON'){
      norm *= 0.78;
    }

    const prevNorm = Number(state.input.lastNorm || 0);
    const delta = norm - prevNorm;

    state.input.inputCount++;
    state.input.moveCount++;
    state.input.lastInputAt = performance.now();
    state.input.lastDelta = delta;
    state.input.lastDirection = delta === 0 ? 0 : (delta > 0 ? 1 : -1);
    state.input.cumulativeInputDistance += Math.abs(delta);
    state.input.recentInputDistance += Math.abs(delta);
    state.input.idleFlag = false;
    state.input.idleMs = 0;

    if (Math.abs(delta) >= cfg.antiIdleInputThreshold){
      state.input.meaningfulMoveCount++;
      state.input.lastMeaningfulInputAt = performance.now();
      state.input.activeCorrectionCount++;
    } else {
      state.input.microCorrectionCount++;
    }

    if (
      Math.abs(prevNorm) > cfg.overshootThreshold &&
      Math.abs(norm) > cfg.overshootThreshold &&
      Math.sign(prevNorm) !== Math.sign(norm)
    ){
      state.input.overshootCount++;
    }

    state.input.lastNorm = norm;

    const curr = Number(state.motion.targetAngle || 0);
    state.motion.targetAngle = curr + (norm - curr) * cfg.inputSmoothing;
  }

  playArea.addEventListener('pointerdown', ev=>{
    if (!state) return;
    state.input.pointerActive = true;
    state.input.pointerDownAt = performance.now();
    try{ playArea.setPointerCapture(ev.pointerId); }catch(e){}
    updateTargetFromEvent(ev);
    ev.preventDefault();
  }, { passive:false });

  playArea.addEventListener('pointermove', ev=>{
    if (!state || !state.input.pointerActive) return;
    updateTargetFromEvent(ev);
    ev.preventDefault();
  }, { passive:false });

  playArea.addEventListener('pointerup', ev=>{
    if (!state) return;
    state.input.pointerActive = false;
    try{ playArea.releasePointerCapture(ev.pointerId); }catch(e){}
    ev.preventDefault();
  }, { passive:false });

  playArea.addEventListener('pointercancel', ev=>{
    if (!state) return;
    state.input.pointerActive = false;
    ev.preventDefault();
  }, { passive:false });
}

/* ------------------------------------------------------------
 * Phase helpers
 * ------------------------------------------------------------ */
function closeCurrentPhaseHistory(now){
  if (!state) return;
  const hist = state.phase.history;
  if (!Array.isArray(hist) || !hist.length) return;
  const last = hist[hist.length - 1];
  if (last && !last.endAt){
    last.endAt = now;
  }
}

function pushPhaseHistory(name, now){
  if (!state) return;
  state.phase.history.push({
    name,
    startAt: now,
    endAt: 0
  });
}

function clearActiveObstacles(){
  if (!state) return;
  (state.obstacles.active || []).forEach(ob => {
    try{ ob.cleanup && ob.cleanup(); }catch(e){}
  });
  state.obstacles.active = [];
  if (obstacleLayer) obstacleLayer.innerHTML = '';
}

function beginPracticePhase(now){
  if (!state) return;

  closeCurrentPhaseHistory(now);

  state.phase.current = 'practice';
  state.phase.index = 0;
  state.phase.label = 'Practice';
  state.phase.enteredAt = now;
  state.phase.practiceStartedAt = now;

  pushPhaseHistory('practice', now);

  state.obstacles.nextSpawnAt = now + randomBetween(state.config.disturbMinMs, state.config.disturbMaxMs);

  state.motion.angle = 0;
  state.motion.targetAngle = 0;
  state.runtime.lastFrameAt = now;

  clearActiveObstacles();

  setText(hudStatus, 'Practice');
  setText(hudPhase, `Practice ${Math.round(state.config.practiceMs / 1000)}s • seed:${String(state.meta.seed || '').slice(0,10)}`);
  setText(hudScore, 'P:0');
  setText(hudCombo, 'P');

  state.debug.flowCheckpoints.push({
    step: 'beginPracticePhase',
    at: now
  });
}

function beginMainPhase1(now){
  if (!state) return;

  closeCurrentPhaseHistory(now);

  state.phase.current = 'main1';
  state.phase.index = 1;
  state.phase.label = 'Main 1';
  state.phase.enteredAt = now;
  state.phase.mainStartedAt = now;

  pushPhaseHistory('main1', now);

  state.runtime.nowElapsedMs = 0;
  state.runtime.remainMs = state.config.durationMs;
  state.runtime.lastFrameAt = now;

  state.motion.angle = 0;
  state.motion.targetAngle = 0;
  state.motion.currentDangerLevel = 0;
  state.motion.currentPressureLevel = 0;

  state.obstacles.nextSpawnAt = now + randomBetween(state.config.disturbMinMs, state.config.disturbMaxMs);
  state.obstacles.active = [];
  state.obstacles.totals = { total:0, avoided:0, hit:0, perfect:0, nearMiss:0 };
  state.obstacles.byPhase.main1 = { total:0, avoided:0, hit:0, perfect:0 };
  state.obstacles.byPhase.main2 = { total:0, avoided:0, hit:0, perfect:0 };
  state.obstacles.byPhase.rush  = { total:0, avoided:0, hit:0, perfect:0 };

  state.scoring.score = 0;
  state.scoring.combo = 0;
  state.scoring.maxCombo = 0;
  state.scoring.perfects = 0;
  state.scoring.scoreBreakdown = {
    avoidBase: 0,
    perfectBonus: 0,
    comboBonus: 0,
    holdBonus: 0,
    rushBonus: 0,
    warmupBonus: 0,
    penaltyHit: 0,
    penaltyIdle: 0
  };

  state.analytics.samples = [];
  state.analytics.totalSamples = 0;
  state.analytics.stableSamples = 0;
  state.analytics.sumTiltAbs = 0;
  state.analytics.sumTiltSq = 0;
  state.analytics.nearMissCount = 0;
  state.analytics.recoveryCount = 0;
  state.analytics.failRecoveryCount = 0;
  state.analytics.phaseMetrics.main1 = { score:0, samples:0, stability:0, avoid:0, hit:0 };
  state.analytics.phaseMetrics.main2 = { score:0, samples:0, stability:0, avoid:0, hit:0 };
  state.analytics.phaseMetrics.rush  = { score:0, samples:0, stability:0, avoid:0, hit:0 };

  state.input.idleMs = 0;
  state.input.idlePenaltyTicks = 0;
  state.input.idleFlag = false;
  state.input.recentInputDistance = 0;

  clearActiveObstacles();
  if (stabilityFill) stabilityFill.style.width = '0%';
  if (centerPulse) centerPulse.classList.remove('good');

  const wb = state.meta.warmupBuff || null;
  setText(
    hudStatus,
    wb && (wb.wType || wb.wPct)
      ? `Playing • ${wb.wType || 'buff'} +${wb.wPct || 0}%`
      : 'Playing'
  );
  setText(hudPhase, `Main 1 • seed:${String(state.meta.seed || '').slice(0,10)}`);
  setText(hudScore, '0');
  setText(hudCombo, '0');
  setText(hudStab, '0%');
  if (hudObsA) setText(hudObsA, '0 / 0');
  if (hudObsB) setText(hudObsB, '0 / 0');

  state.debug.flowCheckpoints.push({
    step: 'beginMainPhase1',
    at: now
  });
}

function beginMainPhase2(now){
  if (!state || state.phase.transitionsFired.phase2) return;

  closeCurrentPhaseHistory(now);

  state.phase.current = 'main2';
  state.phase.index = 2;
  state.phase.label = 'Main 2';
  state.phase.enteredAt = now;
  state.phase.transitionsFired.phase2 = true;

  pushPhaseHistory('main2', now);

  state.motion.currentPressureLevel = Math.max(state.motion.currentPressureLevel, 1);
  state.obstacles.pressure.spawnIntervalMul = 0.88;
  state.obstacles.pressure.speedMul = 1.08;
  state.obstacles.pressure.strengthMul = 1.10;

  setText(hudPhase, `Main 2 • seed:${String(state.meta.seed || '').slice(0,10)}`);
  if (coachBubble){
    coachBubble.textContent = 'ด่านเริ่มกดดันขึ้นแล้ว รักษากลางให้แน่นแล้วอ่านจังหวะให้ไวขึ้น!';
    coachBubble.classList.remove('hidden');
    setTimeout(()=>{
      if (coachBubble) coachBubble.classList.add('hidden');
    }, 1600);
  }

  state.debug.flowCheckpoints.push({
    step: 'beginMainPhase2',
    at: now
  });
}

function beginFinalRush(now){
  if (!state || state.phase.transitionsFired.rush) return;

  closeCurrentPhaseHistory(now);

  state.phase.current = 'rush';
  state.phase.index = 3;
  state.phase.label = 'Final Rush';
  state.phase.enteredAt = now;
  state.phase.rushStartedAt = now;
  state.phase.transitionsFired.rush = true;

  pushPhaseHistory('rush', now);

  state.motion.currentDangerLevel = Math.max(state.motion.currentDangerLevel, 2);
  state.motion.currentPressureLevel = 3;

  state.obstacles.pressure.spawnIntervalMul = 0.72;
  state.obstacles.pressure.speedMul = 1.18;
  state.obstacles.pressure.strengthMul = 1.18;

  state.effects.rushBannerShown = true;

  setText(hudPhase, `Final Rush • seed:${String(state.meta.seed || '').slice(0,10)}`);
  setText(hudStatus, 'Final Rush');

  if (coachBubble){
    coachBubble.textContent = 'FINAL RUSH! เก็บคอมโบให้ได้ และอย่าปล่อยให้หลุดกลาง!';
    coachBubble.classList.remove('hidden');
    setTimeout(()=>{
      if (coachBubble) coachBubble.classList.add('hidden');
    }, 1800);
  }

  state.debug.flowCheckpoints.push({
    step: 'beginFinalRush',
    at: now
  });
}

function updatePhaseProgression(now){
  if (!state || state.runtime.isEnded) return;
  if (state.phase.current === 'countdown') return;
  if (state.phase.current === 'practice') return;

  const mainElapsed = Math.max(0, now - state.phase.mainStartedAt);
  const totalMainMs = state.config.durationMs;

  const phase2At = totalMainMs * state.config.phase2Ratio;
  const rushAt   = totalMainMs * state.config.rushRatio;

  if (!state.phase.transitionsFired.phase2 && mainElapsed >= phase2At){
    beginMainPhase2(now);
  }

  if (!state.phase.transitionsFired.rush && mainElapsed >= rushAt){
    beginFinalRush(now);
  }
}

/* ------------------------------------------------------------
 * Pause / resume
 * ------------------------------------------------------------ */
function pauseGame(){
  if (!state || state.runtime.isPaused || state.runtime.isEnded) return;

  state.runtime.isPaused = true;
  state.runtime.pausedAt = performance.now();

  if (rafId != null){
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  setText(hudStatus, 'Paused');
  $('[data-action="pause"]')?.classList.add('hidden');
  $('[data-action="resume"]')?.classList.remove('hidden');

  state.debug.flowCheckpoints.push({
    step: 'pauseGame',
    at: state.runtime.pausedAt,
    phase: state.phase.current
  });
}

function resumeGame(){
  if (!state || !state.runtime.isPaused || state.runtime.isEnded) return;

  const now = performance.now();
  const pausedMs = Math.max(0, now - state.runtime.pausedAt);

  state.runtime.isPaused = false;
  state.runtime.totalPausedMs += pausedMs;
  state.runtime.lastFrameAt = now;

  if (state.phase.countdownStartedAt) state.phase.countdownStartedAt += pausedMs;
  if (state.phase.practiceStartedAt) state.phase.practiceStartedAt += pausedMs;
  if (state.phase.mainStartedAt) state.phase.mainStartedAt += pausedMs;
  if (state.phase.rushStartedAt) state.phase.rushStartedAt += pausedMs;

  if (state.obstacles.nextSpawnAt) state.obstacles.nextSpawnAt += pausedMs;

  state.motion.lastStableAt += pausedMs;
  state.motion.lastUnsafeAt += pausedMs;
  state.motion.lastCenterAt += pausedMs;

  setText(
    hudStatus,
    state.phase.current === 'practice'
      ? 'Practice'
      : state.phase.current === 'countdown'
      ? 'Get Ready'
      : 'Playing'
  );

  $('[data-action="pause"]')?.classList.remove('hidden');
  $('[data-action="resume"]')?.classList.add('hidden');

  state.debug.flowCheckpoints.push({
    step: 'resumeGame',
    at: now,
    pausedMs,
    phase: state.phase.current
  });

  if (rafId != null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

/* ------------------------------------------------------------
 * Gameplay phase runners
 * ------------------------------------------------------------ */
function runCountdownPhase(now){
  if (!state) return false;

  const elapsed = now - state.phase.countdownStartedAt;
  const remain = Math.max(0, state.config.countdownMs - elapsed);
  const sec = remain / 1000;

  setText(hudTime, sec.toFixed(1));
  setText(hudStatus, 'Get Ready');
  setText(hudPhase, `Countdown • seed:${String(state.meta.seed || '').slice(0,10)}`);

  if (coachBubble){
    const n = Math.ceil(sec);
    coachBubble.textContent = (n > 0) ? `เริ่มใน ${n}... / Starting in ${n}...` : 'ไปเลย! / Go!';
    coachBubble.classList.remove('hidden');
  }

  updateVisuals();

  if (remain <= 0){
    if (coachBubble) coachBubble.classList.add('hidden');

    if (state.config.practiceEnabled && state.config.practiceMs > 0 && !state.phase.practiceStartedAt){
      beginPracticePhase(now);
    } else {
      beginMainPhase1(now);
    }
  }
  return true;
}

function runPracticePhase(now){
  if (!state) return false;

  const elapsed = now - state.phase.practiceStartedAt;
  const remain = Math.max(0, state.config.practiceMs - elapsed);

  setText(hudTime, (remain / 1000).toFixed(1));

  if (remain <= 0){
    closeCurrentPhaseHistory(now);

    state.phase.current = 'countdown';
    state.phase.index = 0;
    state.phase.label = 'Countdown';
    state.phase.enteredAt = now;
    state.phase.countdownStartedAt = now;

    state.config.countdownMs = state.config.mainCountdownMs;

    setText(hudStatus, 'Practice Complete');
    setText(hudPhase, `Countdown to Main • seed:${String(state.meta.seed || '').slice(0,10)}`);

    if (coachBubble){
      coachBubble.textContent = 'ซ้อมเสร็จแล้ว! เตรียมเข้าสู่รอบจริง / Practice complete! Main round starts...';
      coachBubble.classList.remove('hidden');
      setTimeout(()=>{
        if (coachBubble) coachBubble.classList.add('hidden');
      }, 1200);
    }

    state.motion.angle = 0;
    state.motion.targetAngle = 0;
    state.runtime.lastFrameAt = now;
    clearActiveObstacles();

    state.debug.flowCheckpoints.push({
      step: 'practiceComplete',
      at: now
    });

    return true;
  }

  return false;
}

/* ------------------------------------------------------------
 * Visuals
 * ------------------------------------------------------------ */
function updateVisuals(){
  if (!state) return;

  const total = state.analytics.totalSamples || 0;
  state.analytics.stabilityRatio = total
    ? (state.analytics.stableSamples / total)
    : 0;

  if (platformEl){
    const maxDeg = 16;
    const angleDeg = state.motion.angle * maxDeg;
    state.motion.displayedAngleDeg = angleDeg;
    platformEl.style.transform = `rotate(${angleDeg}deg)`;
  }

  if (indicatorEl && platformWrap){
    const wrapRect = platformWrap.getBoundingClientRect();
    const halfW = wrapRect.width * 0.34;
    const x = state.motion.angle * halfW;
    state.motion.displayX = x;
    indicatorEl.style.transform = `translateX(${x}px) translateY(-18px)`;
  }

  if (centerPulse){
    const centerGood = Math.abs(state.motion.angle) <= (state.config.safeHalf * 0.55);
    centerPulse.classList.toggle('good', centerGood);
  }

  if (stabilityFill){
    const r = clamp((state.analytics.stabilityRatio || 0) * 100, 0, 100);
    stabilityFill.style.width = `${r}%`;
  }
  if (hudStab){
    setText(hudStab, fmtPercent(state.analytics.stabilityRatio || 0));
  }

  const a = state.obstacles.totals.avoided || 0;
  const t = state.obstacles.totals.total || 0;
  if (hudObsA) setText(hudObsA, `${a} / ${t}`);
  if (hudObsB) setText(hudObsB, `${a} / ${t}`);

  if (hudScore) setText(hudScore, String(Math.round(state.scoring.score || 0)));
  if (hudCombo) setText(hudCombo, String(state.scoring.combo || 0));

  if (playArea){
    playArea.classList.toggle('danger-1', state.motion.currentDangerLevel >= 1);
    playArea.classList.toggle('danger-2', state.motion.currentDangerLevel >= 2);
    playArea.classList.toggle('danger-3', state.motion.currentDangerLevel >= 3);
    playArea.classList.toggle('phase-rush', state.phase.current === 'rush');
    playArea.classList.toggle('combo-surge', (state.scoring.currentComboTier || 0) >= 3);
  }

  if (hudPhase){
    setText(
      hudPhase,
      `${state.phase.label || state.phase.current} • seed:${String(state.meta.seed || '').slice(0,10)}`
    );
  }

  if (coachBubble && state.coach.currentMessage){
    coachBubble.textContent = state.coach.currentMessage;
    coachBubble.classList.remove('hidden');
  }
}

/* ------------------------------------------------------------
 * Danger / combo helpers
 * ------------------------------------------------------------ */
function updateDangerState(){
  if (!state) return;

  const absTilt = Math.abs(state.motion.angle);
  const safeHalf = state.config.safeHalf;
  const idleFlag = !!state.input.idleFlag;
  const obstacleSoon = state.obstacles.active.some(ob => {
    if (!ob || ob.resolved) return false;
    const dt = ob.impactAt - performance.now();
    return dt >= 0 && dt <= 380;
  });

  let level = 0;
  if (absTilt >= safeHalf * 0.70) level = 1;
  if (absTilt >= safeHalf * 0.90 || obstacleSoon) level = 2;
  if (absTilt > safeHalf * 1.05 || (idleFlag && obstacleSoon)) level = 3;

  state.motion.currentDangerLevel = level;
}

function updateComboTier(){
  if (!state) return;

  const c = state.scoring.combo || 0;
  let tier = 0;
  if (c >= 12) tier = 4;
  else if (c >= 8) tier = 3;
  else if (c >= 5) tier = 2;
  else if (c >= 3) tier = 1;

  if (tier !== state.scoring.currentComboTier){
    state.scoring.currentComboTier = tier;
    if (tier >= 3){
      state.scoring.comboSurgeActive = true;
      state.effects.comboSurgeShownAt = performance.now();
    } else {
      state.scoring.comboSurgeActive = false;
    }
  }
}

function hasRecentMeaningfulInput(windowMs = 420){
  if (!state) return false;
  const t = state.input.lastMeaningfulInputAt || 0;
  if (!t) return false;
  return (performance.now() - t) <= windowMs;
}

function isIdleCheese(windowMs = null){
  if (!state) return false;
  const w = windowMs || state.config.antiIdleWindowMs;
  const last = state.input.lastMeaningfulInputAt || 0;
  if (!last) return true;
  return (performance.now() - last) > w;
}

function pushScoreEvent(type, amount){
  if (!state) return;
  state.scoring.lastScoreEvent = {
    type,
    amount,
    at: performance.now()
  };
}

/* ------------------------------------------------------------
 * Obstacles
 * ------------------------------------------------------------ */
function pickObstacleKind(){
  if (!state) return 'gust';

  const phase = state.phase.current;
  const r = rand01();

  if (phase === 'practice'){
    return r < 0.7 ? 'gust' : 'bomb';
  }

  if (phase === 'main1'){
    if (r < 0.58) return 'gust';
    if (r < 0.88) return 'bomb';
    return 'heavy';
  }

  if (phase === 'main2'){
    if (r < 0.42) return 'gust';
    if (r < 0.74) return 'bomb';
    if (r < 0.90) return 'heavy';
    return 'fakeout';
  }

  if (r < 0.34) return 'gust';
  if (r < 0.62) return 'bomb';
  if (r < 0.84) return 'heavy';
  return 'fakeout';
}

function getObstacleVisual(kind){
  switch(kind){
    case 'bomb':    return { emoji:'💣', className:'hit' };
    case 'heavy':   return { emoji:'🪨', className:'hit' };
    case 'fakeout': return { emoji:'🌀', className:'telegraph' };
    case 'gust':
    default:        return { emoji:'💨', className:'avoid' };
  }
}

function evaluateObstacleReaction(obstacle, now){
  if (!state || !obstacle) {
    return {
      inSafe: false,
      nearPerfect: false,
      activeControl: false,
      nearMiss: false,
      idleCheese: true,
      reactionScore: 0
    };
  }

  const absTilt = Math.abs(state.motion.angle);
  const safeHalf = state.config.safeHalf;

  const inSafe = absTilt <= safeHalf;
  const nearPerfect = absTilt <= Math.max(0.06, safeHalf * state.config.perfectThreshold);
  const nearMiss = !inSafe && absTilt <= safeHalf * 1.15;

  const activeControl = hasRecentMeaningfulInput(420);
  const idleCheese = isIdleCheese();

  let reactionScore = 0;
  if (inSafe) reactionScore += 0.45;
  if (nearPerfect) reactionScore += 0.25;
  if (activeControl) reactionScore += 0.25;
  if (!idleCheese) reactionScore += 0.05;
  reactionScore = clamp(reactionScore, 0, 1);

  return {
    inSafe,
    nearPerfect,
    activeControl,
    nearMiss,
    idleCheese,
    reactionScore
  };
}

function registerNearMissRecovery(){
  if (!state) return;
  state.analytics.recoveryCount++;
}

function registerAvoid(obstacle, reaction){
  if (!state) return;

  const phaseKey = state.phase.current === 'main2' ? 'main2'
    : state.phase.current === 'rush' ? 'rush'
    : state.phase.current === 'practice' ? 'practice'
    : 'main1';

  state.obstacles.totals.avoided++;
  state.obstacles.byPhase[phaseKey].avoided++;

  state.scoring.combo++;
  state.scoring.maxCombo = Math.max(state.scoring.maxCombo, state.scoring.combo);

  let add = 10 + Math.min(20, (state.scoring.combo - 1) * 2);

  if (phaseKey === 'rush') {
    add += 4;
    state.scoring.scoreBreakdown.rushBonus += 4;
  }

  let perfectNow = !!reaction.nearPerfect && !!reaction.activeControl && !reaction.idleCheese;
  if (!perfectNow && state.meta.warmupBuff?.critBonusChance > 0 && rand01() < state.meta.warmupBuff.critBonusChance){
    perfectNow = true;
  }

  if (perfectNow){
    add += 10;
    state.scoring.perfects++;
    state.obstacles.totals.perfect++;
    state.obstacles.byPhase[phaseKey].perfect++;
    state.scoring.scoreBreakdown.perfectBonus += 10;
  }

  if (reaction.idleCheese){
    const before = add;
    add = Math.max(2, Math.round(add * 0.35));
    state.scoring.scoreBreakdown.penaltyIdle += Math.max(0, before - add);
    state.input.idlePenaltyTicks++;
  }

  const boostMul = state.meta.warmupBuff?.scoreBoostMul || 1;
  const healOnAvoid = state.meta.warmupBuff?.healOnAvoid || 0;

  add = Math.round(add * boostMul) + healOnAvoid;

  state.scoring.score += add;
  state.scoring.scoreBreakdown.avoidBase += add;

  const pm = state.analytics.phaseMetrics[phaseKey];
  if (pm){
    pm.score += add;
  }

  updateComboTier();
  pushScoreEvent(perfectNow ? 'perfect' : 'avoid', add);

  if (reaction.nearMiss){
    state.analytics.nearMissCount++;
    if (pm){
      pm.nearMiss = (pm.nearMiss || 0) + 1;
    }
    registerNearMissRecovery();
    state.obstacles.totals.nearMiss++;
  }

  if (obstacle?.pxX && playArea){
    spawnFloatFx(
      perfectNow ? `Perfect +${add}` : `Avoid +${add}`,
      perfectNow ? 'gold' : 'good',
      obstacle.pxX,
      (playArea.clientHeight || 300) * 0.55
    );
  }

  if (obstacle?.el) obstacle.el.classList.add('avoid');

  pulseEl(hudScore);
  pulseEl(hudCombo);
}

function registerHit(obstacle, reaction){
  if (!state) return;

  const phaseKey = state.phase.current === 'main2' ? 'main2'
    : state.phase.current === 'rush' ? 'rush'
    : state.phase.current === 'practice' ? 'practice'
    : 'main1';

  state.obstacles.totals.hit++;
  state.obstacles.byPhase[phaseKey].hit++;

  if (reaction.nearMiss){
    state.analytics.nearMissCount++;
    state.analytics.failRecoveryCount++;
  }

  state.scoring.combo = 0;
  updateComboTier();

  const basePenalty = obstacle?.kind === 'heavy' ? 14 : obstacle?.kind === 'bomb' ? 10 : 8;
  const reduceMul = state.meta.warmupBuff?.dmgReduceMul || 1;
  const penalty = Math.max(2, Math.round(basePenalty * reduceMul));

  state.scoring.score = Math.max(0, state.scoring.score - penalty);
  state.scoring.scoreBreakdown.penaltyHit += penalty;

  const knockDir = (state.motion.angle >= 0 ? 1 : -1);
  const strengthMul = state.obstacles.pressure.strengthMul || 1;
  state.motion.angle += knockDir * state.config.disturbStrength * 0.7 * strengthMul * reduceMul;

  pushScoreEvent('hit', -penalty);

  if (obstacle?.pxX && playArea){
    spawnFloatFx(`Hit -${penalty}`, 'bad', obstacle.pxX, (playArea.clientHeight || 300) * 0.55);
  }

  if (obstacle?.el) obstacle.el.classList.add('hit');

  if (playArea){
    playArea.classList.add('shake-hit');
    setTimeout(()=> playArea.classList.remove('shake-hit'), 240);
  }

  pulseEl(hudScore);
  pulseEl(hudCombo);
}

function spawnObstacle(now){
  if (!state || !obstacleLayer || !playArea || state.runtime.isEnded) return;
  if ((state.obstacles.active || []).length >= state.config.obstacleMaxActive) return;

  const kind = pickObstacleKind();
  const vis = getObstacleVisual(kind);

  const wrapRect = playArea.getBoundingClientRect();
  const xNorm = (rand01() * 2 - 1);
  const pxX = (wrapRect.width / 2) + xNorm * (wrapRect.width * 0.32);

  const el = document.createElement('div');
  el.className = `obstacle ${vis.className || ''}`;
  el.textContent = vis.emoji;
  el.style.left = `${pxX}px`;

  obstacleLayer.appendChild(el);

  const pressureMul = state.obstacles.pressure.speedMul || 1;
  const impactDelay = Math.max(420, Math.round(state.config.obstacleImpactDelayMs / pressureMul));
  const cleanupDelay = Math.max(900, Math.round(state.config.obstacleCleanupMs / pressureMul));

  const obstacle = {
    id: state.obstacles.seq++,
    kind,
    phase: state.phase.current,
    spawnedAt: now,
    impactAt: now + impactDelay,
    resolvedAt: 0,

    xNorm,
    pxX,
    el,

    requiredCorrection: xNorm >= 0 ? 'left' : 'right',
    playerReaction: '',
    reactionScore: 0,
    outcome: '',
    resolved: false
  };

  state.obstacles.active.push(obstacle);
  state.obstacles.totals.total++;

  const phaseKey = state.phase.current === 'main2' ? 'main2'
    : state.phase.current === 'rush' ? 'rush'
    : state.phase.current === 'practice' ? 'practice'
    : 'main1';

  state.obstacles.byPhase[phaseKey].total++;

  const impactTimer = setTimeout(()=>{
    if (!state || obstacle.resolved || state.runtime.isEnded) return;

    const reaction = evaluateObstacleReaction(obstacle, performance.now());
    obstacle.playerReaction = state.input.lastDirection > 0 ? 'right'
      : state.input.lastDirection < 0 ? 'left'
      : 'none';
    obstacle.reactionScore = reaction.reactionScore;

    if (reaction.inSafe){
      obstacle.outcome = reaction.nearPerfect && reaction.activeControl && !reaction.idleCheese
        ? 'perfect'
        : 'avoid';
      registerAvoid(obstacle, reaction);
    } else {
      obstacle.outcome = reaction.nearMiss ? 'near-miss-hit' : 'hit';
      registerHit(obstacle, reaction);
    }

    obstacle.resolved = true;
    obstacle.resolvedAt = performance.now();
    state.debug.lastObstacleDebug = {
      id: obstacle.id,
      kind: obstacle.kind,
      outcome: obstacle.outcome,
      reactionScore: obstacle.reactionScore,
      idleCheese: reaction.idleCheese,
      activeControl: reaction.activeControl
    };
  }, impactDelay);

  const cleanupTimer = setTimeout(()=>{
    obstacle.resolved = true;
    try{ el.remove(); }catch(e){}
    if (state){
      state.obstacles.active = state.obstacles.active.filter(o => o.id !== obstacle.id);
    }
  }, cleanupDelay);

  obstacle.cleanup = function(){
    try{ clearTimeout(impactTimer); }catch(e){}
    try{ clearTimeout(cleanupTimer); }catch(e){}
    try{ el.remove(); }catch(e){}
  };

  const intervalBase = randomBetween(state.config.disturbMinMs, state.config.disturbMaxMs);
  const mul = state.obstacles.pressure.spawnIntervalMul || 1;
  state.obstacles.nextSpawnAt = now + Math.max(360, Math.round(intervalBase * mul));
}

/* ------------------------------------------------------------
 * Sampling / analytics
 * ------------------------------------------------------------ */
function getPhaseMetricKey(){
  if (!state) return 'main1';
  if (state.phase.current === 'practice') return 'practice';
  if (state.phase.current === 'main2') return 'main2';
  if (state.phase.current === 'rush') return 'rush';
  return 'main1';
}

function captureSample(now){
  if (!state || state.runtime.isEnded) return;

  const phaseKey = getPhaseMetricKey();
  const absTilt = Math.abs(state.motion.angle);
  const inSafe = absTilt <= state.config.safeHalf;
  const idle = !!state.input.idleFlag;
  const combo = state.scoring.combo || 0;

  const tMs = Math.max(0, now - state.runtime.startedAt);
  const sample = {
    tMs,
    phase: phaseKey,
    angle: state.motion.angle,
    absTilt,
    inSafe,
    danger: state.motion.currentDangerLevel || 0,
    idle,
    combo
  };

  state.analytics.samples.push(sample);

  if (state.analytics.samples.length > 5000){
    state.analytics.samples.splice(0, state.analytics.samples.length - 5000);
  }

  state.analytics.totalSamples++;
  if (inSafe) state.analytics.stableSamples++;

  state.analytics.sumTiltAbs += absTilt;
  state.analytics.sumTiltSq += absTilt * absTilt;

  const pm = state.analytics.phaseMetrics[phaseKey];
  if (pm){
    pm.samples++;
    if (inSafe) pm.stability++;
  }
}

function updateSampling(now){
  if (!state || state.runtime.isEnded) return;

  const cfg = state.config;
  const input = state.input;

  const lastMeaningful = input.lastMeaningfulInputAt || 0;
  if (!lastMeaningful){
    input.idleMs = state.runtime.nowElapsedMs;
  } else {
    input.idleMs = Math.max(0, performance.now() - lastMeaningful);
  }
  input.idleFlag = input.idleMs > cfg.antiIdleWindowMs;

  updateDangerState();

  if (!state._nextSampleAt){
    state._nextSampleAt = now + cfg.sampleEveryMs;
  }

  if (now >= state._nextSampleAt){
    captureSample(now);

    const total = state.analytics.totalSamples || 0;
    state.analytics.stabilityRatio = total
      ? (state.analytics.stableSamples / total)
      : 0;

    if (state.analytics.phaseMetrics){
      Object.keys(state.analytics.phaseMetrics).forEach(k=>{
        const pm = state.analytics.phaseMetrics[k];
        pm.stabilityRatio = pm.samples ? (pm.stability / pm.samples) : 0;
      });
    }

    state._nextSampleAt = now + cfg.sampleEveryMs;
  }
}

function computeCoreAnalytics(){
  if (!state){
    return {
      stabilityRatio: 0,
      meanTilt: 0,
      rmsTilt: 0,
      fatigueIndex: 0,
      samples: 0
    };
  }

  const n = state.analytics.totalSamples || 0;
  if (!n){
    return {
      stabilityRatio: 0,
      meanTilt: 0,
      rmsTilt: 0,
      fatigueIndex: 0,
      samples: 0
    };
  }

  const stabilityRatio = state.analytics.stableSamples / n;
  const meanTilt = state.analytics.sumTiltAbs / n;
  const rmsTilt = Math.sqrt(state.analytics.sumTiltSq / n);

  let fatigueIndex = 0;
  const arr = state.analytics.samples || [];
  if (arr.length >= 8){
    const seg = Math.max(2, Math.floor(arr.length * 0.25));
    const early = arr.slice(0, seg);
    const late = arr.slice(-seg);

    const mE = early.reduce((a,b)=>a + b.absTilt, 0) / early.length;
    const mL = late.reduce((a,b)=>a + b.absTilt, 0) / late.length;

    if (mE > 0){
      fatigueIndex = (mL - mE) / mE;
    }
  }

  return {
    stabilityRatio,
    meanTilt,
    rmsTilt,
    fatigueIndex,
    samples: n
  };
}

function computeAdvancedAnalytics(){
  if (!state){
    return {
      idleRatio: 0,
      activeCorrectionRate: 0,
      overshootRate: 0,
      nearMissRate: 0,
      recoveryRate: 0,
      perfectRate: 0,
      nearMissCount: 0,
      recoveryCount: 0,
      failRecoveryCount: 0,
      phaseBreakdown: {}
    };
  }

  const totalSamples = state.analytics.totalSamples || 0;
  const samples = state.analytics.samples || [];

  const idleCount = samples.reduce((n, s)=> n + (s.idle ? 1 : 0), 0);
  const idleRatio = totalSamples ? (idleCount / totalSamples) : 0;

  const activeCorrectionRate = state.input.moveCount
    ? (state.input.activeCorrectionCount / state.input.moveCount)
    : 0;

  const overshootRate = state.input.moveCount
    ? (state.input.overshootCount / state.input.moveCount)
    : 0;

  const totalObs = state.obstacles.totals.total || 0;
  const nearMissCount = state.analytics.nearMissCount || 0;
  const recoveryCount = state.analytics.recoveryCount || 0;
  const failRecoveryCount = state.analytics.failRecoveryCount || 0;
  const perfectCount = state.scoring.perfects || 0;

  const nearMissRate = totalObs ? (nearMissCount / totalObs) : 0;
  const recoveryRate = nearMissCount ? (recoveryCount / nearMissCount) : 0;
  const perfectRate = totalObs ? (perfectCount / totalObs) : 0;

  const phaseBreakdown = {};
  Object.keys(state.analytics.phaseMetrics || {}).forEach(k=>{
    const pm = state.analytics.phaseMetrics[k] || {};
    const obs = state.obstacles.byPhase[k] || {};
    phaseBreakdown[k] = {
      score: pm.score || 0,
      samples: pm.samples || 0,
      stabilityRatio: pm.samples ? ((pm.stability || 0) / pm.samples) : 0,
      avoid: obs.avoided || 0,
      hit: obs.hit || 0,
      perfect: obs.perfect || 0
    };
  });

  return {
    idleRatio,
    activeCorrectionRate,
    overshootRate,
    nearMissRate,
    recoveryRate,
    perfectRate,
    nearMissCount,
    recoveryCount,
    failRecoveryCount,
    phaseBreakdown
  };
}

function finalizeAnalyticsIntoState(){
  if (!state) return;

  const core = computeCoreAnalytics();
  const adv = computeAdvancedAnalytics();

  state.analytics.stabilityRatio = core.stabilityRatio;
  state.analytics.meanTilt = core.meanTilt;
  state.analytics.rmsTilt = core.rmsTilt;
  state.analytics.fatigueIndex = core.fatigueIndex;

  state.analytics.idleRatio = adv.idleRatio;
  state.analytics.activeCorrectionRate = adv.activeCorrectionRate;
  state.analytics.overshootRate = adv.overshootRate;
  state.analytics.nearMissRate = adv.nearMissRate;
  state.analytics.recoveryRate = adv.recoveryRate;
  state.analytics.perfectRate = adv.perfectRate;
  state.analytics.nearMissCount = adv.nearMissCount;
  state.analytics.recoveryCount = adv.recoveryCount;
  state.analytics.failRecoveryCount = adv.failRecoveryCount;
}

/* ------------------------------------------------------------
 * Ranking / insight / badges
 * ------------------------------------------------------------ */
function calcRank(summary){
  const stab = Number(summary.stabilityRatio || 0);
  const avoidTotal = Number(summary.obstaclesAvoided || 0) + Number(summary.obstaclesHit || 0);
  const avoidRate = avoidTotal ? (Number(summary.obstaclesAvoided || 0) / avoidTotal) : 0;

  const idleRatio = Number(summary.idleRatio || 0);
  const activeCorrectionRate = Number(summary.activeCorrectionRate || 0);
  const recoveryRate = Number(summary.recoveryRate || 0);
  const perfectRate = Number(summary.perfectRate || 0);
  const fat = Number(summary.fatigueIndex || 0);

  const perfects = Number(summary.perfects || 0);
  const comboMax = Number(summary.comboMax || 0);

  let pts = 0;

  pts += stab * 42;
  pts += avoidRate * 22;
  pts += activeCorrectionRate * 14;
  pts += recoveryRate * 8;
  pts += perfectRate * 6;
  pts += Math.min(10, perfects * 0.9);
  pts += Math.min(10, comboMax * 0.7);

  pts -= idleRatio * 18;
  if (fat > 0.35) pts -= 6;
  if (fat > 0.60) pts -= 6;

  if (stab < 0.35 || avoidRate < 0.35) pts = Math.min(pts, 44);
  if (idleRatio > 0.45) pts = Math.min(pts, 54);

  if (pts >= 86) return 'S';
  if (pts >= 72) return 'A';
  if (pts >= 58) return 'B';
  if (pts >= 42) return 'C';
  return 'D';
}

function buildInsight(summary){
  const stab = Number(summary.stabilityRatio || 0);
  const avoidTotal = Number(summary.obstaclesAvoided || 0) + Number(summary.obstaclesHit || 0);
  const avoidRate = avoidTotal ? (Number(summary.obstaclesAvoided || 0) / avoidTotal) : 0;

  const idleRatio = Number(summary.idleRatio || 0);
  const activeCorrectionRate = Number(summary.activeCorrectionRate || 0);
  const recoveryRate = Number(summary.recoveryRate || 0);
  const fat = Number(summary.fatigueIndex || 0);

  const pb = summary.phaseBreakdown || {};
  const main1 = pb.main1 || {};
  const main2 = pb.main2 || {};
  const rush  = pb.rush  || {};

  const main1Stab = Number(main1.stabilityRatio || 0);
  const main2Stab = Number(main2.stabilityRatio || 0);
  const rushStab  = Number(rush.stabilityRatio || 0);

  if (stab >= 0.75 && avoidRate >= 0.82 && idleRatio < 0.12){
    return 'ยอดเยี่ยมมาก! คุณคุมสมดุลนิ่ง หลบแรงรบกวนได้ดี และเล่นแบบ active จริง พร้อมขยับไปโหมดที่ยากขึ้นได้เลย';
  }

  if (idleRatio >= 0.28){
    return 'รอบนี้มีช่วงนิ่งนานไปหน่อย ทำให้เสียจังหวะและคะแนน ลองขยับคุมแท่นต่อเนื่องเล็ก ๆ จะช่วยให้ได้คะแนนและ Perfect ง่ายขึ้น';
  }

  if (activeCorrectionRate < 0.20){
    return 'ยังแก้จังหวะแท่นน้อยไป ลองตอบสนองซ้าย–ขวาให้ชัดขึ้นเมื่อแท่นเริ่มเอียง จะช่วยให้ avoid rate ดีขึ้นมาก';
  }

  if (stab < 0.45){
    return 'ตอนนี้ควรโฟกัสที่การรักษาแท่นให้อยู่ใกล้กึ่งกลางก่อน เมื่อคุมกลางได้สม่ำเสมอแล้วคะแนนและคอมโบจะขึ้นง่ายมาก';
  }

  if (avoidRate < 0.50){
    return 'จังหวะหลบยังพลาดค่อนข้างบ่อย ลองเตรียมดึงกลับเข้ากลางทันทีหลังเห็น obstacle จะช่วยลด hit ได้ชัดเจน';
  }

  if (main1Stab >= 0.62 && main2Stab < 0.48){
    return 'ช่วงต้นทำได้ดี แต่พอเข้าสู่ด่านกดดันมากขึ้นเริ่มคุมแกว่ง ลองใช้แรงนิ้วเบาลงและแก้ทีละนิดในช่วงกลางเกม';
  }

  if (rush.samples && rushStab >= 0.62){
    return 'ช่วง Final Rush ทำได้ดีมาก แปลว่าคุณรับแรงกดดันได้ดีแล้ว รอบหน้าลองเก็บคอมโบต่อเนื่องในช่วงท้ายให้มากขึ้น';
  }

  if (recoveryRate >= 0.45){
    return 'จุดเด่นของรอบนี้คือการแก้ near-miss กลับมาได้ดี ลองเพิ่มความนิ่งตอนจบจังหวะ จะเปลี่ยนหลายครั้งให้กลายเป็น Perfect ได้';
  }

  if (fat > 0.35){
    return 'ช่วงท้ายเริ่มมีอาการล้า ลองคุมแรงนิ้วให้สม่ำเสมอและไม่แก้แรงเกิน จะช่วยลดการแกว่งสะสมในช่วงท้ายเกม';
  }

  return 'ทำได้ดีมาก! รักษาจังหวะคุมแท่นให้สม่ำเสมอ แล้วพยายามเปลี่ยนการหลบธรรมดาให้เป็น Perfect มากขึ้นอีกนิด';
}

function renderBadgesAndMissions(summary){
  if (heroBadgesEl) heroBadgesEl.innerHTML = '';
  if (heroMissionEl) heroMissionEl.innerHTML = '';

  const badges = [];
  const missions = [];

  if ((summary.perfects || 0) >= 5) badges.push({ t:'✨ Perfect Keeper', c:'good' });
  if ((summary.comboMax || 0) >= 8) badges.push({ t:'🔥 Combo Flow', c:'good' });
  if ((summary.obstaclesHit || 0) === 0 && ((summary.obstaclesAvoided || 0) > 0)) badges.push({ t:'🛡️ No Hit Run', c:'good' });
  if ((summary.recoveryCount || 0) >= 2) badges.push({ t:'🌀 Recovery Pro', c:'good' });
  if ((summary.activeCorrectionRate || 0) >= 0.40) badges.push({ t:'🎯 Active Control', c:'good' });
  if ((summary.idleRatio || 0) >= 0.28) badges.push({ t:'😴 Idle Alert', c:'warn' });

  if ((summary.perfects || 0) < 5) missions.push('ทำ Perfect ≥ 5 ครั้ง');
  if ((summary.comboMax || 0) < 10) missions.push('ทำ Max Combo ≥ 10');
  if ((summary.stabilityRatio || 0) < 0.70) missions.push('ดัน Stability ≥ 70%');
  if ((summary.obstaclesHit || 0) > 0) missions.push('ลองรอบไร้ Hit');
  if ((summary.idleRatio || 0) > 0.18) missions.push('ลด Idle ให้ต่ำกว่า 18%');

  if (heroBadgesEl){
    if (!badges.length){
      const el = document.createElement('div');
      el.className = 'mini-badge';
      el.textContent = 'เริ่มสะสม badges ได้จาก Perfect / Combo / Recovery / No-hit run';
      heroBadgesEl.appendChild(el);
    } else {
      badges.forEach(b=>{
        const el = document.createElement('div');
        el.className = `mini-badge ${b.c || ''}`;
        el.textContent = b.t;
        heroBadgesEl.appendChild(el);
      });
    }
  }

  if (heroMissionEl){
    if (!missions.length){
      const el = document.createElement('div');
      el.className = 'mini-badge good';
      el.textContent = 'พร้อมขยับไปโหมด Hard ได้เลย';
      heroMissionEl.appendChild(el);
    } else {
      missions.slice(0,3).forEach(t=>{
        const el = document.createElement('div');
        el.className = 'mini-badge';
        el.textContent = '🎯 ' + t;
        heroMissionEl.appendChild(el);
      });
    }
  }
}

/* ------------------------------------------------------------
 * Hub summary save / navigation
 * ------------------------------------------------------------ */
function saveLastSummaryForHub(summary, endedBy){
  try{
    const payload = {
      gameId: 'balance-hold',
      endedBy: endedBy || '',
      ts: Date.now(),
      mode: summary.mode,
      difficulty: summary.difficulty,
      durationSec: summary.durationSec,
      score: summary.score || 0,
      rank: summary.rank || 'D',
      stabilityRatio: summary.stabilityRatio || 0,
      meanTilt: summary.meanTilt || 0,
      rmsTilt: summary.rmsTilt || 0,
      fatigueIndex: summary.fatigueIndex || 0,
      obstaclesAvoided: summary.obstaclesAvoided || 0,
      obstaclesHit: summary.obstaclesHit || 0,
      comboMax: summary.comboMax || 0,
      perfects: summary.perfects || 0,
      seed: summary.seed || qv('seed','')
    };
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(payload));
    localStorage.setItem('HHA_LAST_SUMMARY_balance-hold', JSON.stringify(payload));
  }catch(e){}
}

function goHubOrMenu(){
  const hub = state?.flow?.hubUrl || buildHubUrl();
  if (!hub){
    showView('menu');
    return;
  }

  try{
    const u = new URL(hub, location.href);
    const s = state?.results?.summary || (() => {
      try{
        return JSON.parse(localStorage.getItem('HHA_LAST_SUMMARY_balance-hold') || 'null');
      }catch(e){
        return null;
      }
    })();

    if (s){
      u.searchParams.set('lastGame', 'balance-hold');
      u.searchParams.set('lastScore', String(s.score || 0));
      u.searchParams.set('lastRank', String(s.rank || 'D'));
      u.searchParams.set('lastStab', String(Math.round((s.stabilityRatio || 0) * 100)));
    }
    location.href = u.toString();
  }catch(e){
    location.href = hub;
  }
}

function goCooldownIfReady(){
  if (!state) return;
  if (!state.results.cooldownReady) return;

  const url = state.flow.cooldownUrl || buildCooldownUrl(state.results.summary);
  location.href = url;
}

/* ------------------------------------------------------------
 * Result rendering
 * ------------------------------------------------------------ */
function fillResultView(endedBy, summary){
  const modeLabel = summary.mode === 'research' ? 'Research' : 'Play';

  if (resMode) setText(resMode, modeLabel);
  if (resDiff) setText(resDiff, summary.difficulty || '-');
  if (resDur) setText(resDur, String(summary.durationSec || '-'));
  if (resEnd) setText(resEnd, mapEndReason(endedBy));

  if (resStability) setText(resStability, fmtPercent(summary.stabilityRatio || 0));
  if (resMeanTilt) setText(resMeanTilt, fmtFloat(summary.meanTilt || 0, 3));
  if (resRmsTilt) setText(resRmsTilt, fmtFloat(summary.rmsTilt || 0, 3));
  if (resAvoid) setText(resAvoid, String(summary.obstaclesAvoided || 0));
  if (resHit) setText(resHit, String(summary.obstaclesHit || 0));

  const totalObs = (summary.obstaclesAvoided || 0) + (summary.obstaclesHit || 0);
  const avoidRate = totalObs ? (summary.obstaclesAvoided / totalObs) : 0;
  if (resAvoidRate) setText(resAvoidRate, fmtPercent(avoidRate));
  if (resFatigue) setText(resFatigue, fmtFloat(summary.fatigueIndex || 0, 3));
  if (resSamples) setText(resSamples, String(summary.samples ?? 0));

  if (resScoreEl) setText(resScoreEl, summary.score || 0);
  if (resRankEl) setText(resRankEl, summary.rank || 'D');
  if (resPerfectEl) setText(resPerfectEl, summary.perfects || 0);
  if (resComboEl) setText(resComboEl, summary.comboMax || 0);

  if (resDailyEl){
    try{ setText(resDailyEl, new Date().toLocaleDateString('th-TH')); }
    catch(e){ setText(resDailyEl, '-'); }
  }

  if (rankBadgeEl){
    rankBadgeEl.textContent = summary.rank || 'D';
    rankBadgeEl.classList.remove('rank-S','rank-A','rank-B','rank-C','rank-D');
    rankBadgeEl.classList.add('rank-' + (summary.rank || 'D'));
    rankBadgeEl.classList.remove('rank-pop');
    void rankBadgeEl.offsetWidth;
    rankBadgeEl.classList.add('rank-pop');
  }

  if (resultHeroSub){
    const sub = [
      mapEndReason(endedBy),
      `Stability ${fmtPercent(summary.stabilityRatio || 0)}`,
      `Avoid ${summary.obstaclesAvoided || 0}/${totalObs || 0}`
    ].join(' • ');
    setText(resultHeroSub, sub);
  }

  if (heroInsightEl) setText(heroInsightEl, summary.insight || '-');

  if (resAiTipEl){
    const extra = [];
    if (Number(summary.idleRatio || 0) > 0.20) extra.push('idle สูง');
    if (Number(summary.activeCorrectionRate || 0) >= 0.35) extra.push('active control ดี');
    if (Number(summary.recoveryCount || 0) >= 2) extra.push('recovery ดี');
    if (Number(summary.perfectRate || 0) >= 0.25) extra.push('perfect rate ดี');

    const suffix = extra.length ? ` (${extra.join(' • ')})` : '';
    setText(resAiTipEl, (summary.insight || '-') + suffix);
  }

  renderBadgesAndMissions(summary);

  if (heroMissionEl){
    const pb = summary.phaseBreakdown || {};
    const main1 = pb.main1 || {};
    const main2 = pb.main2 || {};
    const rush  = pb.rush  || {};

    const chips = [];

    if (main1.samples) chips.push(`🎮 Main1 ${Math.round((main1.stabilityRatio || 0) * 100)}%`);
    if (main2.samples) chips.push(`⚡ Main2 ${Math.round((main2.stabilityRatio || 0) * 100)}%`);
    if (rush.samples)  chips.push(`🔥 Rush ${Math.round((rush.stabilityRatio || 0) * 100)}%`);
    if (Number(summary.idleRatio || 0) > 0) chips.push(`🕒 Idle ${Math.round((summary.idleRatio || 0) * 100)}%`);
    if (Number(summary.activeCorrectionRate || 0) > 0) chips.push(`🎯 Control ${Math.round((summary.activeCorrectionRate || 0) * 100)}%`);

    chips.slice(0,5).forEach(text=>{
      const el = document.createElement('div');
      el.className = 'mini-badge';
      el.textContent = text;
      heroMissionEl.appendChild(el);
    });
  }
}

function fillEndModal(summary){
  if (!endModal) return;
  if (endModalRank){
    endModalRank.textContent = summary.rank || 'D';
    endModalRank.classList.remove('rank-S','rank-A','rank-B','rank-C','rank-D');
    endModalRank.classList.add('rank-' + (summary.rank || 'D'));
  }
  if (endModalScore) setText(endModalScore, summary.score || 0);
  if (endModalInsight) setText(endModalInsight, summary.insight || '-');
}

/* ------------------------------------------------------------
 * Motion / obstacle / coach / effects
 * ------------------------------------------------------------ */
function updateMotion(now, dt){
  if (!state || state.runtime.isEnded) return;

  const cfg = state.config;
  const dtSec = Math.max(0, dt) / 1000;

  let driftMul = 1;
  if (state.phase.current === 'main2') driftMul = 1.12;
  if (state.phase.current === 'rush')  driftMul = 1.22;

  const driftDir = (rand01() < 0.5 ? -1 : 1) * cfg.passiveDrift * driftMul * dtSec;

  let idlePush = 0;
  if (state.input.idleFlag){
    const idleBoost = Math.min(1.8, 1 + (state.input.idleMs / cfg.antiIdleWindowMs) * 0.35);
    idlePush = driftDir * idleBoost;
  }

  const strengthMul = state.obstacles.pressure.strengthMul || 1;

  const desired = state.motion.targetAngle + driftDir + idlePush;
  const lerp = (state.phase.current === 'rush') ? 0.14 : (state.phase.current === 'main2' ? 0.125 : 0.11);

  state.motion.angle += (desired - state.motion.angle) * lerp * strengthMul;
  state.motion.angle = clamp(state.motion.angle, -cfg.maxTilt, cfg.maxTilt);
  state.motion.targetAngle = clamp(state.motion.targetAngle, -cfg.maxTarget, cfg.maxTarget);

  const absTilt = Math.abs(state.motion.angle);
  if (absTilt <= cfg.safeHalf){
    state.motion.lastStableAt = now;
  } else {
    state.motion.lastUnsafeAt = now;
  }
  if (absTilt <= cfg.safeHalf * 0.35){
    state.motion.lastCenterAt = now;
  }

  if (
    state.phase.current !== 'practice' &&
    absTilt <= cfg.safeHalf * 0.45 &&
    hasRecentMeaningfulInput(600)
  ){
    let holdBonus = (state.phase.current === 'rush') ? 0.10 : 0.06;
    if (state.scoring.combo >= 8) holdBonus += 0.02;

    state.scoring.score += holdBonus;
    state.scoring.scoreBreakdown.holdBonus += holdBonus;

    const pm = state.analytics.phaseMetrics[getPhaseMetricKey()];
    if (pm) pm.score += holdBonus;
  }
}

function updateObstacleSystem(now){
  if (!state || state.runtime.isEnded) return;

  if (state.phase.current !== 'practice' &&
      state.phase.current !== 'main1' &&
      state.phase.current !== 'main2' &&
      state.phase.current !== 'rush'){
    return;
  }

  if (now >= state.obstacles.nextSpawnAt){
    spawnObstacle(now);
  }
}

function updateCoach(now){
  if (!state || !coachBubble) return;

  const gapOk = (now - (state.coach.lastMessageAt || 0)) >= state.coach.minGapMs;
  if (!gapOk) return;

  let msg = '';

  if (state.input.idleFlag && !state.coach.triggers.idleWarned){
    msg = 'ขยับคุมแท่นต่อเนื่องหน่อยนะ ถ้านิ่งเกินไปจะเสียจังหวะและได้คะแนนน้อยลง';
    state.coach.triggers.idleWarned = true;
  }
  else if (state.phase.current === 'main2' && !state.coach.triggers.phase2Warned){
    msg = 'เริ่มยากขึ้นแล้ว พยายามดึงกลับเข้ากลางให้ไวหลังทุกแรงรบกวน';
    state.coach.triggers.phase2Warned = true;
  }
  else if (state.phase.current === 'rush' && !state.coach.triggers.rushWarned){
    msg = 'ช่วงท้ายแล้ว เก็บคอมโบให้ดีและอย่าปล่อยแท่นหลุดกลาง';
    state.coach.triggers.rushWarned = true;
  }
  else if (
    state.analytics.recoveryCount >= 2 &&
    !state.coach.triggers.recoveryPraised
  ){
    msg = 'ดีมาก! คุณเริ่มแก้จังหวะเสียแล้วดึงกลับมาได้ดีขึ้น';
    state.coach.triggers.recoveryPraised = true;
  }

  if (msg){
    state.coach.currentMessage = msg;
    state.coach.lastMessageAt = now;
    coachBubble.textContent = msg;
    coachBubble.classList.remove('hidden');

    setTimeout(()=>{
      if (coachBubble && state && state.coach.currentMessage === msg){
        state.coach.currentMessage = '';
        coachBubble.classList.add('hidden');
      }
    }, 2200);
  }
}

function updateEffects(now){
  if (!state) return;

  if (
    state.scoring.comboSurgeActive &&
    state.effects.comboSurgeShownAt &&
    (now - state.effects.comboSurgeShownAt > 1200)
  ){
    state.scoring.comboSurgeActive = (state.scoring.currentComboTier >= 3);
  }

  if (state.phase.current !== 'rush'){
    state.effects.rushBannerShown = false;
  }
}

/* ------------------------------------------------------------
 * Start game
 * ------------------------------------------------------------ */
function startGame(kind){
  const mode = (kind === 'research' ? 'research' : 'play');

  const diffKey = (elDiffSel?.value || qv('diff','normal') || 'normal').toLowerCase();
  const durSec  = parseInt(elDurSel?.value || qv('time','60') || '60', 10) || 60;
  const viewMode = (elViewSel?.value || qv('view','pc') || 'pc').toLowerCase();

  let playerId = 'anon', group = '', phaseLabel = '', studyId = '', conditionGroup = '';
  if (mode === 'research'){
    playerId = ($('#researchId')?.value.trim()) || qv('pid','anon') || 'anon';
    group = ($('#researchGroup')?.value.trim()) || qv('group','') || '';
    phaseLabel = ($('#researchPhase')?.value.trim()) || qv('phase','') || '';
  } else {
    playerId = qv('pid','anon') || 'anon';
    group = qv('group','') || '';
    phaseLabel = qv('phase','') || '';
  }

  studyId = qv('studyId','') || '';
  conditionGroup = qv('conditionGroup','') || '';

  const warmupBuff = readWarmupBuff();
  const seedStr = buildSeedString({
    mode,
    playerId,
    difficulty: diffKey,
    durationSec: durSec
  });
  const rng = makeRng(seedStr);

  state = createInitialState({
    mode,
    diffKey,
    durationSec: durSec,
    viewMode,
    playerId,
    group,
    phaseLabel,
    studyId,
    conditionGroup,
    seedStr,
    rng,
    warmupBuff
  });

  setText(hudMode, mode === 'research' ? 'Research' : 'Play');
  setText(hudDiff, state.config.difficulty);
  setText(hudDur, String(state.config.durationSec));
  setText(hudTime, (state.config.durationSec).toFixed(1));
  setText(hudStab, '0%');
  if (hudObsA) setText(hudObsA, '0 / 0');
  if (hudObsB) setText(hudObsB, '0 / 0');
  setText(hudScore, '0');
  setText(hudCombo, '0');

  applyViewModeClass(state.config.viewMode);

  const safeInner = $('.safe-zone-inner');
  if (safeInner){
    const pct = Math.max(14, Math.min(75, state.config.safeHalf * 100));
    safeInner.style.width = `${pct}%`;
  }

  closeEndModal();
  closeTutorial();

  if (stabilityFill) stabilityFill.style.width = '0%';
  if (centerPulse) centerPulse.classList.remove('good');
  if (obstacleLayer) obstacleLayer.innerHTML = '';

  if (coachLabel){
    coachLabel.textContent = 'จับ/แตะแล้วเลื่อนไปซ้าย–ขวาเพื่อรักษาสมดุล / Drag left–right to balance';
  }
  if (coachBubble) coachBubble.classList.add('hidden');

  if (state.phase.current === 'countdown'){
    setText(hudStatus, 'Get Ready');
    setText(hudPhase, `Countdown • seed:${String(state.meta.seed).slice(0,10)}`);
  } else {
    setText(
      hudStatus,
      warmupBuff && (warmupBuff.wType || warmupBuff.wPct)
        ? `Playing • ${warmupBuff.wType || 'buff'} +${warmupBuff.wPct || 0}%`
        : 'Playing'
    );
    setText(hudPhase, `Main 1 • seed:${String(state.meta.seed).slice(0,10)}`);
  }

  state.debug.flowCheckpoints.push({
    step: 'startGame',
    at: performance.now(),
    flowMode: state.flow.flowMode,
    pid: state.meta.pid,
    diff: state.config.difficulty
  });

  $('[data-action="pause"]')?.classList.remove('hidden');
  $('[data-action="resume"]')?.classList.add('hidden');

  if (rafId != null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);

  showView('play');
}

/* ------------------------------------------------------------
 * Main loop
 * ------------------------------------------------------------ */
function loop(now){
  if (!state) return;
  if (state.runtime.isEnded) return;
  if (state.runtime.isPaused) return;

  const dt = Math.max(0, now - state.runtime.lastFrameAt);
  state.runtime.lastFrameAt = now;

  if (state.phase.current === 'countdown'){
    runCountdownPhase(now);
    rafId = requestAnimationFrame(loop);
    return;
  }

  if (state.phase.current === 'practice'){
    const done = runPracticePhase(now);
    updateMotion(now, dt);
    updateSampling(now);
    updateObstacleSystem(now);
    updateCoach(now);
    updateEffects(now);
    updateVisuals();

    if (done){
      rafId = requestAnimationFrame(loop);
      return;
    }

    rafId = requestAnimationFrame(loop);
    return;
  }

  const mainElapsed = Math.max(0, now - state.phase.mainStartedAt);
  state.runtime.nowElapsedMs = mainElapsed;
  state.runtime.remainMs = Math.max(0, state.config.durationMs - mainElapsed);

  setText(hudTime, (state.runtime.remainMs / 1000).toFixed(1));

  updatePhaseProgression(now);
  updateMotion(now, dt);
  updateSampling(now);
  updateObstacleSystem(now);
  updateCoach(now);
  updateEffects(now);
  updateVisuals();

  if (state.runtime.remainMs <= 0){
    stopGame('timeout');
    return;
  }

  rafId = requestAnimationFrame(loop);
}

/* ------------------------------------------------------------
 * Stop / result
 * ------------------------------------------------------------ */
function cleanupRuntimeBeforeResult(){
  if (!state) return;

  if (rafId != null){
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  clearActiveObstacles();

  state.runtime.isRunning = false;
  state.runtime.isPaused = false;
  state.runtime.isEnded = true;
  state.runtime.endedAt = performance.now();

  $('[data-action="pause"]')?.classList.remove('hidden');
  $('[data-action="resume"]')?.classList.add('hidden');
}

function stopGame(endedBy){
  if (!state || state.runtime.isEnded) return;

  cleanupRuntimeBeforeResult();

  state.runtime.endReason = endedBy || 'timeout';

  closeCurrentPhaseHistory(state.runtime.endedAt);
  finalizeAnalyticsIntoState();

  const core = computeCoreAnalytics();
  const adv = computeAdvancedAnalytics();

  const summary = {
    gameId: 'balance-hold',
    mode: state.meta.mode,
    difficulty: state.config.difficulty,
    durationSec: state.config.durationSec,

    stabilityRatio: core.stabilityRatio,
    meanTilt: core.meanTilt,
    rmsTilt: core.rmsTilt,
    fatigueIndex: core.fatigueIndex,
    samples: core.samples,

    idleRatio: adv.idleRatio,
    activeCorrectionRate: adv.activeCorrectionRate,
    overshootRate: adv.overshootRate,
    nearMissRate: adv.nearMissRate,
    recoveryRate: adv.recoveryRate,
    perfectRate: adv.perfectRate,
    nearMissCount: adv.nearMissCount,
    recoveryCount: adv.recoveryCount,
    failRecoveryCount: adv.failRecoveryCount,
    phaseBreakdown: adv.phaseBreakdown,

    obstaclesAvoided: state.obstacles.totals.avoided || 0,
    obstaclesHit: state.obstacles.totals.hit || 0,

    score: Math.round(state.scoring.score || 0),
    comboMax: state.scoring.maxCombo || 0,
    perfects: state.scoring.perfects || 0,

    seed: state.meta.seed || '',
    endedBy: state.runtime.endReason
  };

  summary.rank = calcRank(summary);
  summary.insight = buildInsight(summary);

  state.results.summary = summary;
  state.results.rank = summary.rank;
  state.results.insight = summary.insight;
  state.results.ready = true;
  state.results.cooldownReady = (state.flow.flowMode === 'full-flow');
  state.flow.cooldownUrl = buildCooldownUrl(summary);

  recordSessionToLocal(summary);
  state.results.savedToLocal = true;

  saveLastSummaryForHub(summary, state.runtime.endReason);
  state.results.savedToHubSummary = true;

  fillResultView(state.runtime.endReason, summary);
  fillEndModal(summary);

  const btnResultCooldown = document.getElementById('btn-result-cooldown');
  const btnEndCooldown = document.getElementById('btn-end-cooldown');

  if (btnResultCooldown){
    btnResultCooldown.classList.toggle('hidden', !state.results.cooldownReady);
  }
  if (btnEndCooldown){
    btnEndCooldown.classList.toggle('hidden', !state.results.cooldownReady);
  }

  showView('result');

  state.debug.flowCheckpoints.push({
    step: 'stopGame',
    at: performance.now(),
    endedBy: state.runtime.endReason,
    flowMode: state.flow.flowMode,
    cooldownReady: state.results.cooldownReady
  });

  if (state.runtime.endReason !== 'manual'){
    setTimeout(()=>{
      if (state && state.results.ready){
        openEndModal();
      }
    }, 120);
  }
}

/* ------------------------------------------------------------
 * Export helpers
 * ------------------------------------------------------------ */
function downloadTextFile(filename, text, type='text/plain'){
  try{
    const blob = new Blob([text], {type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 120);
  }catch(e){}
}

function arrToCSV(rows){
  return rows.map(r => r.map(v=>{
    const s = String(v ?? '');
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  }).join(',')).join('\r\n');
}

function exportSessionsCSV(){
  let arr = [];
  try{ arr = JSON.parse(localStorage.getItem(SESS_KEY) || '[]'); }
  catch(e){ arr = []; }

  const rows = [[
    'ts','mode','difficulty','durationSec',
    'stabilityRatio','meanTilt','rmsTilt','fatigueIndex',
    'idleRatio','activeCorrectionRate','overshootRate',
    'nearMissRate','recoveryRate','perfectRate',
    'nearMissCount','recoveryCount','failRecoveryCount',
    'obstaclesAvoided','obstaclesHit',
    'score','rank','comboMax','perfects',
    'main1Score','main1Stability',
    'main2Score','main2Stability',
    'rushScore','rushStability',
    'seed'
  ]];

  arr.forEach(x=>{
    const pb = x.phaseBreakdown || {};
    const main1 = pb.main1 || {};
    const main2 = pb.main2 || {};
    const rush  = pb.rush  || {};

    rows.push([
      x.ts || '',
      x.mode || '',
      x.difficulty || '',
      x.durationSec || '',

      x.stabilityRatio ?? '',
      x.meanTilt ?? '',
      x.rmsTilt ?? '',
      x.fatigueIndex ?? '',

      x.idleRatio ?? '',
      x.activeCorrectionRate ?? '',
      x.overshootRate ?? '',

      x.nearMissRate ?? '',
      x.recoveryRate ?? '',
      x.perfectRate ?? '',

      x.nearMissCount ?? '',
      x.recoveryCount ?? '',
      x.failRecoveryCount ?? '',

      x.obstaclesAvoided ?? '',
      x.obstaclesHit ?? '',

      x.score ?? '',
      x.rank ?? '',
      x.comboMax ?? '',
      x.perfects ?? '',

      main1.score ?? '',
      main1.stabilityRatio ?? '',

      main2.score ?? '',
      main2.stabilityRatio ?? '',

      rush.score ?? '',
      rush.stabilityRatio ?? '',

      x.seed ?? ''
    ]);
  });

  downloadTextFile(`balance-hold-sessions-${Date.now()}.csv`, arrToCSV(rows), 'text/csv');
}

function exportReleaseDebug(){
  const debug = {
    href: location.href,
    ua: navigator.userAgent,
    bodyClass: document.body.className,

    ui: {
      diff: elDiffSel?.value || null,
      time: elDurSel?.value || null,
      view: elViewSel?.value || null
    },

    flow: state ? {
      flowMode: state.flow.flowMode,
      fromLauncher: state.flow.fromLauncher,
      fromGate: state.flow.fromGate,
      hubUrl: state.flow.hubUrl,
      launcherUrl: state.flow.launcherUrl,
      cooldownUrl: state.flow.cooldownUrl,
      cooldownReady: state.results?.cooldownReady || false
    } : null,

    meta: state ? {
      pid: state.meta.pid,
      mode: state.meta.mode,
      difficulty: state.config.difficulty,
      durationSec: state.config.durationSec,
      seed: state.meta.seed
    } : null,

    analytics: state ? {
      stabilityRatio: state.analytics.stabilityRatio,
      meanTilt: state.analytics.meanTilt,
      rmsTilt: state.analytics.rmsTilt,
      fatigueIndex: state.analytics.fatigueIndex,
      idleRatio: state.analytics.idleRatio,
      activeCorrectionRate: state.analytics.activeCorrectionRate,
      overshootRate: state.analytics.overshootRate,
      nearMissRate: state.analytics.nearMissRate,
      recoveryRate: state.analytics.recoveryRate,
      perfectRate: state.analytics.perfectRate,
      nearMissCount: state.analytics.nearMissCount,
      recoveryCount: state.analytics.recoveryCount,
      failRecoveryCount: state.analytics.failRecoveryCount
    } : null,

    scoring: state ? {
      score: state.scoring.score,
      combo: state.scoring.combo,
      maxCombo: state.scoring.maxCombo,
      perfects: state.scoring.perfects,
      scoreBreakdown: state.scoring.scoreBreakdown
    } : null,

    phase: state ? {
      current: state.phase.current,
      label: state.phase.label,
      history: state.phase.history
    } : null,

    lastSummary: (() => {
      try{
        return JSON.parse(localStorage.getItem('HHA_LAST_SUMMARY_balance-hold') || 'null');
      }catch(e){
        return null;
      }
    })(),

    debug: state ? {
      lastObstacleDebug: state.debug.lastObstacleDebug,
      flowCheckpoints: state.debug.flowCheckpoints,
      warnings: state.debug.warnings
    } : null,

    now: new Date().toISOString()
  };

  downloadTextFile(`balance-hold-debug-${Date.now()}.json`, JSON.stringify(debug, null, 2), 'application/json');
}

/* ------------------------------------------------------------
 * Init / wiring
 * ------------------------------------------------------------ */
function validateCriticalDom(){
  const required = [
    '#view-menu','#view-research','#view-play','#view-result',
    '#playArea','#platform','#indicator','#obstacle-layer',
    '#hud-time','#hud-score','#hud-combo','#hud-stability',
    '#difficulty','#sessionDuration','#viewMode'
  ];
  const missing = required.filter(sel => !document.querySelector(sel));
  if (missing.length){
    console.warn('[balance-hold] missing DOM:', missing);
    return false;
  }
  return true;
}

function resetUiBeforeMenu(){
  closeEndModal();
  closeTutorial();

  if (coachBubble){
    coachBubble.classList.add('hidden');
    coachBubble.textContent = '';
  }
  if (coachLabel){
    coachLabel.textContent = 'จับ/แตะแล้วเลื่อนไปซ้าย–ขวาเพื่อรักษาสมดุล / Drag left–right to balance';
  }

  if (stabilityFill) stabilityFill.style.width = '0%';
  if (centerPulse) centerPulse.classList.remove('good');

  if (hudMode) setText(hudMode, 'Play');
  if (hudDiff) setText(hudDiff, elDiffSel?.value || qv('diff','normal') || 'normal');
  if (hudDur)  setText(hudDur,  elDurSel?.value || qv('time','60') || '60');
  if (hudTime) setText(hudTime, (Number(elDurSel?.value || qv('time','60') || 60)).toFixed(1));
  if (hudPhase) setText(hudPhase, 'Main');
  if (hudStatus) setText(hudStatus, 'Ready');
  if (hudStab) setText(hudStab, '0%');
  if (hudScore) setText(hudScore, '0');
  if (hudCombo) setText(hudCombo, '0');
  if (hudObsA) setText(hudObsA, '0 / 0');
  if (hudObsB) setText(hudObsB, '0 / 0');

  clearActiveObstacles();

  document.getElementById('btn-result-cooldown')?.classList.add('hidden');
  document.getElementById('btn-end-cooldown')?.classList.add('hidden');
}

function hardResetRuntimeState(){
  if (rafId != null){
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (state) clearActiveObstacles();
  state = null;

  $('[data-action="pause"]')?.classList.remove('hidden');
  $('[data-action="resume"]')?.classList.add('hidden');
}

function goBackToLauncher(){
  location.href = buildLauncherUrl();
}

function maybeAutoStartFromQuery(){
  const auto = String(qv('autostart','')).toLowerCase();
  const shouldAuto = ['1','true','yes','on'].includes(auto);
  if (!shouldAuto) return;

  window.addEventListener('DOMContentLoaded', ()=>{
    setTimeout(()=>{
      const btn = document.querySelector('[data-action="start-normal"]');
      if (btn) btn.click();
    }, 120);
  });
}

function bindMenuActions(){
  $('[data-action="start-normal"]')?.addEventListener('click', ()=>{
    if (maybeShowTutorialBeforeStart('play')) return;
    startGame('play');
  });

  $('[data-action="goto-research"]')?.addEventListener('click', ()=>{
    showView('research');
  });

  $$('[data-action="back-menu"]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      hardResetRuntimeState();
      resetUiBeforeMenu();
      showView('menu');
    });
  });

  $('[data-action="start-research"]')?.addEventListener('click', ()=>{
    if (maybeShowTutorialBeforeStart('research')) return;
    startGame('research');
  });

  document.getElementById('btn-menu-back-launcher')?.addEventListener('click', ()=>{
    goBackToLauncher();
  });
}

function bindPlayActions(){
  $('[data-action="stop"]')?.addEventListener('click', ()=>{
    if (state && !state.runtime.isEnded){
      stopGame('manual');
    }
  });

  $('[data-action="pause"]')?.addEventListener('click', pauseGame);
  $('[data-action="resume"]')?.addEventListener('click', resumeGame);

  $('[data-action="cvr-recenter"]')?.addEventListener('click', ()=>{
    if (!state) return;
    state.motion.targetAngle = 0;
    state.motion.angle *= 0.5;
  });

  $('[data-action="cvr-calibrate-left"]')?.addEventListener('click', ()=>{
    if (!state) return;
    state.motion.targetAngle = Math.max(-1, (state.motion.targetAngle || 0) - 0.08);
  });

  $('[data-action="cvr-calibrate-right"]')?.addEventListener('click', ()=>{
    if (!state) return;
    state.motion.targetAngle = Math.min(1, (state.motion.targetAngle || 0) + 0.08);
  });

  $('[data-action="cvr-toggle-strict"]')?.addEventListener('click', ()=>{
    if (!cvrStrictLabel) return;
    cvrStrictLabel.textContent =
      (String(cvrStrictLabel.textContent || 'OFF').toUpperCase() === 'ON') ? 'OFF' : 'ON';
  });
}

function bindResultActions(){
  $('[data-action="result-play-again"]')?.addEventListener('click', ()=>{
    closeEndModal();
    goBackToLauncher();
  });

  $('[data-action="result-back-hub"]')?.addEventListener('click', ()=>{
    closeEndModal();
    goHubOrMenu();
  });

  document.getElementById('btn-result-cooldown')?.addEventListener('click', ()=>{
    goCooldownIfReady();
  });

  $$('[data-action="export-sessions-csv"]').forEach(btn=>{
    btn.addEventListener('click', exportSessionsCSV);
  });

  $$('[data-action="export-release-debug"]').forEach(btn=>{
    btn.addEventListener('click', exportReleaseDebug);
  });
}

function bindEndModalActions(){
  $('[data-action="close-end-modal"]')?.addEventListener('click', closeEndModal);

  $('[data-action="end-retry"]')?.addEventListener('click', ()=>{
    closeEndModal();
    goBackToLauncher();
  });

  $('[data-action="end-back-hub"]')?.addEventListener('click', ()=>{
    closeEndModal();
    goHubOrMenu();
  });

  document.getElementById('btn-end-cooldown')?.addEventListener('click', ()=>{
    closeEndModal();
    goCooldownIfReady();
  });

  $('[data-action="end-next-mission"]')?.addEventListener('click', ()=>{
    closeEndModal();
    if (state?.results?.cooldownReady){
      goCooldownIfReady();
    } else {
      goBackToLauncher();
    }
  });
}

function bindTutorialActions(){
  $('[data-action="tutorial-skip"]')?.addEventListener('click', ()=>{
    if (tutorialDontShowAgain?.checked){
      try{ localStorage.setItem('bh_tutorial_skip','1'); }catch(e){}
    }
    tutorialAccepted = true;
    closeTutorial();

    const kind = document.body.dataset.pendingStartKind || 'play';
    startGame(kind);
  });

  $('[data-action="tutorial-start"]')?.addEventListener('click', ()=>{
    if (tutorialDontShowAgain?.checked){
      try{ localStorage.setItem('bh_tutorial_skip','1'); }catch(e){}
    }
    tutorialAccepted = true;
    closeTutorial();

    const kind = document.body.dataset.pendingStartKind || 'play';
    startGame(kind);
  });
}

function bindGeneralActions(){
  elViewSel?.addEventListener('change', (e)=>{
    applyViewModeClass(String(e.target.value || 'pc'));
  });

  document.addEventListener('visibilitychange', ()=>{
    if (!state) return;

    if (document.visibilityState === 'hidden'){
      if (state.runtime.isRunning && !state.runtime.isPaused && !state.runtime.isEnded){
        pauseGame();
      }
    }
  });

  window.addEventListener('beforeunload', ()=>{
    if (state && !state.runtime.isEnded){
      try{
        finalizeAnalyticsIntoState();
      }catch(e){}
    }
  });
}

function hydrateResearchFieldsFromQuery(){
  const pid = qv('pid','');
  const grp = qv('group','');
  const phs = qv('phase','');

  if ($('#researchId') && pid) $('#researchId').value = pid;
  if ($('#researchGroup') && grp) $('#researchGroup').value = grp;
  if ($('#researchPhase') && phs) $('#researchPhase').value = phs;
}

function syncInitialControls(){
  const qDiff = String(qv('diff','')).toLowerCase();
  const qTime = qv('time','');
  const qView = String(qv('view','')).toLowerCase();

  if (elDiffSel && ['easy','normal','hard'].includes(qDiff)){
    elDiffSel.value = qDiff;
  }

  if (elDurSel && qTime){
    const t = clampNum(qTime, 10, 600, 60);
    const tStr = String(t);
    const has = [...elDurSel.options].some(o => o.value === tStr);
    if (!has){
      const opt = document.createElement('option');
      opt.value = tStr;
      opt.textContent = tStr;
      elDurSel.appendChild(opt);
    }
    elDurSel.value = tStr;
  }

  if (elViewSel && ['pc','mobile','cvr'].includes(qView)){
    elViewSel.value = qView;
  }

  applyViewModeClass(elViewSel?.value || qView || 'pc');
}

function init(){
  const domOk = validateCriticalDom();
  if (!domOk){
    console.warn('[balance-hold] critical DOM missing; init aborted');
    return;
  }

  document.getElementById('btn-result-cooldown')?.classList.add('hidden');
  document.getElementById('btn-end-cooldown')?.classList.add('hidden');

  hardResetRuntimeState();
  resetUiBeforeMenu();

  showView('menu');
  hydrateResearchFieldsFromQuery();
  syncInitialControls();
  applyQueryToUI();

  bindMenuActions();
  bindPlayActions();
  bindResultActions();
  bindEndModalActions();
  bindTutorialActions();
  bindGeneralActions();

  attachInput();

  maybeAutoStartFromQuery();

  console.log('[balance-hold] init ok', {
    flowMode: isFlowMode() ? 'full-flow' : 'direct',
    autostart: qv('autostart',''),
    pid: qv('pid','anon'),
    diff: elDiffSel?.value,
    time: elDurSel?.value,
    view: elViewSel?.value
  });
}

window.addEventListener('DOMContentLoaded', init);