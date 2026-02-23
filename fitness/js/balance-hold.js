// === /fitness/js/balance-hold.js ===
// Balance Hold — DOM-based Balance Platform + Obstacle Avoidance
// Consolidated build (A–K) — Play/Research + phases + scoring + badges + missions
// + deterministic patterns + AI director (play adaptive / research locked)
// + result polish + tutorial + cVR preview hooks (recenter/calibration/strict)
// NOTE:
// - This file is designed to be resilient if some HTML elements are missing.
// - Optional UI hooks (rank badge, tutorial overlay, end modal, cVR overlay, etc.) activate only if IDs exist.

'use strict';

/* ------------------------------------------------------------
 * DOM helpers
 * ------------------------------------------------------------ */
const $ = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);
const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));
const fmtPercent = (v)=>(v==null||Number.isNaN(v))?'-':(v*100).toFixed(1)+'%';
const fmtFloat   = (v,d=2)=>(v==null||Number.isNaN(v))?'-':Number(v).toFixed(d);
const nowMs = ()=> Date.now();

/* ------------------------------------------------------------
 * Query helpers
 * ------------------------------------------------------------ */
function qs(key, fallback=''){
  try{
    const u = new URL(location.href);
    const v = u.searchParams.get(key);
    return (v == null || v === '') ? fallback : v;
  }catch(e){
    return fallback;
  }
}
function qn(key, fallback=0){
  const v = Number(qs(key,''));
  return Number.isFinite(v) ? v : fallback;
}
function parseBoolLike(v, fallback=false){
  if (v == null) return fallback;
  const s = String(v).trim().toLowerCase();
  if (['1','true','yes','y','on'].includes(s)) return true;
  if (['0','false','no','n','off'].includes(s)) return false;
  return fallback;
}

/* ------------------------------------------------------------
 * Optional deterministic RNG
 * ------------------------------------------------------------ */
function xmur3(str){
  let h = 1779033703 ^ str.length;
  for (let i=0; i<str.length; i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= (h >>> 16)) >>> 0;
  };
}
function mulberry32(a){
  return function(){
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function createSeededRng(seedStr){
  const seedFn = xmur3(String(seedStr || 'balance-hold'));
  return mulberry32(seedFn());
}

/* ------------------------------------------------------------
 * DOM refs (base screens)
 * ------------------------------------------------------------ */
const viewMenu      = $('#view-menu');
const viewResearch  = $('#view-research');
const viewPlay      = $('#view-play');
const viewResult    = $('#view-result');

const elDiffSel     = $('#difficulty');
const elDurSel      = $('#sessionDuration');
const elViewMode    = $('#viewMode'); // optional: pc/mobile/cvr

const hudMode       = $('#hud-mode');
const hudDiff       = $('#hud-diff');
const hudDur        = $('#hud-dur');
const hudStab       = $('#hud-stability');
const hudObs        = $('#hud-obstacles');
const hudTime       = $('#hud-time');
const hudStatus     = $('#hud-status');      // optional
const hudScore      = $('#hud-score');       // optional
const hudCombo      = $('#hud-combo');       // optional
const hudPhase      = $('#hud-phase');       // optional

const playArea      = $('#playArea');
const platformWrap  = $('#platform-wrap');
const platformEl    = $('#platform');
const indicatorEl   = $('#indicator');
const obstacleLayer = $('#obstacle-layer');
const coachLabel    = $('#coachLabel');
const coachBubble   = $('#coachBubble');

const btnPause      = $('[data-action="pause"]');  // optional
const btnResume     = $('[data-action="resume"]'); // optional

/**** result fields (base) ****/
const resMode       = $('#res-mode');
const resDiff       = $('#res-diff');
const resDur        = $('#res-dur');
const resEnd        = $('#res-end');
const resStab       = $('#res-stability');
const resMeanTilt   = $('#res-meanTilt');
const resRmsTilt    = $('#res-rmsTilt');
const resAvoid      = $('#res-avoid');
const resHit        = $('#res-hit');
const resAvoidRate  = $('#res-avoidRate');
const resFatigue    = $('#res-fatigue');
const resSamples    = $('#res-samples');

const resScoreEl    = $('#res-score');
const resRankEl     = $('#res-rank');
const resPerfectEl  = $('#res-perfect');
const resMaxComboEl = $('#res-maxCombo');
const resAiTipEl    = $('#res-aiTip');
const resDaily      = $('#res-daily');

/**** result polish (optional) ****/
const rankBadgeEl     = $('#rankBadge');
const heroBadgesEl    = $('#heroBadges');
const heroMissionChipsEl = $('#heroMissionChips');
const heroInsightEl   = $('#heroInsight');
const resultHeroSub   = $('#resultHeroSub');

/**** end modal (optional) ****/
const endModal        = $('#endModal');
const endModalRank    = $('#endModalRank');
const endModalScore   = $('#endModalScore');
const endModalInsight = $('#endModalInsight');

/**** tutorial overlay (optional) ****/
const tutorialOverlay      = $('#tutorialOverlay');
const tutorialDontShowAgain= $('#tutorialDontShowAgain');

/**** HUD visual polish (optional) ****/
const stabilityFillEl = $('#stabilityFill');
const centerPulseEl   = $('#centerPulse');

/**** cVR preview overlay (optional) ****/
const cvrOverlayEl     = $('#cvrOverlay');
const cvrCrosshairEl   = $('#cvrCrosshair');
const cvrStrictLabelEl = $('#cvrStrictLabel');

/* ------------------------------------------------------------
 * Config
 * ------------------------------------------------------------ */
const GAME_DIFF = {
  easy:   { safeHalf:0.35, disturbMinMs:1400, disturbMaxMs:2600, disturbStrength:0.18, passiveDrift:0.010 },
  normal: { safeHalf:0.25, disturbMinMs:1200, disturbMaxMs:2200, disturbStrength:0.23, passiveDrift:0.020 },
  hard:   { safeHalf:0.18, disturbMinMs: 900, disturbMaxMs:1800, disturbStrength:0.30, passiveDrift:0.030 }
};
function pickDiff(key){ return GAME_DIFF[key] || GAME_DIFF.normal; }

const FLOW_CFG = {
  warmupSecDefault: 5,
  practiceSecDefault: 15
};

const SCORE_CFG = {
  sampleSafeScore: 2,
  sampleUnsafePenalty: 0,
  avoidScore: 20,
  perfectBonus: 25,
  hitPenalty: 12,
  comboStep: 1,
  comboMax: 99,
  rankThresholds: { S: 500, A: 320, B: 220, C: 130, D: 0 }
};

const BOSS_CFG = {
  enabled: true,
  startAtRatio: 0.68,  // after 68% elapsed
  endAtRatio: 0.88,
  driftMul: 1.25,
  knockMul: 1.20
};

const FX_FLAGS = {
  tutorial: true,
  rankReveal: true,
  scoreCount: true,
  obstacleTelegraph: true,
  hudStabilityVisual: true
};
function isFxEnabled(key){
  const q = String(qs('fx','') || '').toLowerCase();
  if (['0','off','false'].includes(q)) return false;
  return !!FX_FLAGS[key];
}

/* obstacle manifests (deterministic pattern flavor) */
const OBSTACLE_MANIFESTS = {
  A: { weights:{gust:0.62,bomb:0.38}, lanesBias:'balanced' },
  B: { weights:{gust:0.50,bomb:0.50}, lanesBias:'edge'     },
  C: { weights:{gust:0.72,bomb:0.28}, lanesBias:'center'   }
};
function getObstacleManifestKey(){
  const q = String(qs('omap','') || '').toUpperCase();
  if (q && OBSTACLE_MANIFESTS[q]) return q;
  const p = String(qs('preset','A') || 'A').toUpperCase();
  if (p === 'B') return 'B';
  if (p === 'C') return 'C';
  return 'A';
}
function pickWeightedObstacleKind(rr, manifestKey, bossActive){
  const m = OBSTACLE_MANIFESTS[manifestKey] || OBSTACLE_MANIFESTS.A;
  let gustW = m.weights.gust, bombW = m.weights.bomb;
  if (bossActive){ bombW += 0.08; gustW -= 0.08; }
  const total = Math.max(0.001, gustW + bombW);
  const x = rr() * total;
  return x < gustW ? 'gust' : 'bomb';
}
function pickObstacleXNorm(rr, manifestKey){
  const m = OBSTACLE_MANIFESTS[manifestKey] || OBSTACLE_MANIFESTS.A;
  if (m.lanesBias === 'edge'){
    const sign = rr() < 0.5 ? -1 : 1;
    return sign * (0.45 + rr()*0.45);
  }
  if (m.lanesBias === 'center'){
    return (rr()*2 - 1) * 0.45;
  }
  return (rr()*2 - 1);
}

/* ------------------------------------------------------------
 * Coach lines / tips
 * ------------------------------------------------------------ */
const COACH_LINES = {
  welcome: 'พร้อมทรงตัวแล้วนะ ✨ เลื่อนไปซ้าย–ขวาเบา ๆ เพื่อรักษาจุดให้อยู่โซนปลอดภัย / Gently balance left–right to stay in the safe zone.',
  good:    'ดีมาก! เวลาที่อยู่ในโซนปลอดภัยเพิ่มขึ้นเรื่อย ๆ / Great, your stability time is increasing.',
  drift:   'เอียงไปด้านใดด้านหนึ่งบ่อย ลองดันกลับมาตรงกลางช้า ๆ / You drift to one side, gently bring it back to center.',
  obstacleAvoid: 'หลบแรงรบกวนได้สวยมาก! / Nice dodge!',
  obstacleHit:   'โดนแรงรบกวนบ่อย ลองโฟกัสช่วงที่ไอคอนขึ้นมากขึ้น / Watch for the shock icons and prepare to counter.'
};

let lastCoachAt = 0;
let lastCoachSnapshot = null;
const COACH_COOLDOWN_MS = 5000;
let coachHideTimer = null;
let coachLastText = '';

function pushCoachMessage(text, opts={}){
  if (!coachBubble || !text) return;
  const now = performance.now();
  const minGap = Number(opts.minGapMs ?? 1200);
  if (text === coachLastText && !opts.allowRepeat) return;
  if ((now - lastCoachAt) < minGap && !opts.force) return;

  lastCoachAt = now;
  coachLastText = text;
  coachBubble.textContent = text;
  coachBubble.classList.remove('hidden');

  if (coachHideTimer) clearTimeout(coachHideTimer);
  coachHideTimer = safeSetTimeout(()=>{
    coachBubble && coachBubble.classList.add('hidden');
  }, Number(opts.ttlMs ?? 3200));
}
function showCoach(key){
  const msg = COACH_LINES[key];
  if (!msg) return;
  pushCoachMessage(msg, { ttlMs: 4200, minGapMs: COACH_COOLDOWN_MS });
}
function updateCoach(){
  if (!state) return;
  const snap = {
    stabTime: state.stableSamples,
    totalSamples: state.totalSamples,
    hitObstacles: state.obstaclesHit,
    avoidObstacles: state.obstaclesAvoided,
    meanTilt: Math.abs(state.meanTilt || 0)
  };
  if (!lastCoachSnapshot){
    showCoach('welcome');
    lastCoachSnapshot = snap;
    return;
  }
  const prev = lastCoachSnapshot;

  if (snap.totalSamples > 20){
    const prevStab = prev.totalSamples ? (prev.stabTime/prev.totalSamples) : 0;
    const currStab = snap.totalSamples ? (snap.stabTime/snap.totalSamples) : 0;
    if (currStab - prevStab > 0.12) showCoach('good');
  }
  if (snap.meanTilt > 0.5 && prev.meanTilt <= 0.5) showCoach('drift');
  if (snap.avoidObstacles > prev.avoidObstacles) showCoach('obstacleAvoid');
  else if (snap.hitObstacles > prev.hitObstacles) showCoach('obstacleHit');

  lastCoachSnapshot = snap;
}
function showPhaseCoachHint(phaseName){
  if (phaseName === 'warmup'){
    pushCoachMessage('Warmup: ค่อย ๆ ลากซ้าย–ขวาให้ชินมือก่อนเริ่มจริง 🫶', { ttlMs:2400, force:true });
  } else if (phaseName === 'practice'){
    pushCoachMessage('Practice: ฝึกอ่าน obstacle และดึงกลับกลางก่อน impact 🎯', { ttlMs:2600, force:true });
  } else if (phaseName === 'main'){
    pushCoachMessage('Main: เก็บ combo + perfect เพื่อดัน rank ให้สูงขึ้น! 🔥', { ttlMs:2600, force:true });
  }
}

/* ------------------------------------------------------------
 * View helpers
 * ------------------------------------------------------------ */
function showView(name){
  [viewMenu,viewResearch,viewPlay,viewResult].forEach(v=>v && v.classList.add('hidden'));
  if (name==='menu')     viewMenu && viewMenu.classList.remove('hidden');
  if (name==='research') viewResearch && viewResearch.classList.remove('hidden');
  if (name==='play')     viewPlay && viewPlay.classList.remove('hidden');
  if (name==='result')   viewResult && viewResult.classList.remove('hidden');
}
function applyViewModeClass(mode){
  const m = String(mode || qs('view','pc') || 'pc').toLowerCase();
  document.body.classList.remove('view-pc','view-mobile','view-cvr');
  document.body.classList.add(`view-${m}`);
}

/* ------------------------------------------------------------
 * Reduced motion
 * ------------------------------------------------------------ */
function prefersReducedMotion(){
  try{
    return !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }catch(e){ return false; }
}
function syncReducedMotionClass(){
  document.body.classList.toggle('reduced-motion', prefersReducedMotion() || parseBoolLike(qs('rm','0'), false));
}

/* ------------------------------------------------------------
 * Timers / cleanup guards
 * ------------------------------------------------------------ */
let __boundOnce = false;
let pendingTimers = new Set();
let pendingObstacleTimers = new Set();
let isStoppingNow = false;

function safeSetTimeout(fn, ms){
  const id = setTimeout(()=>{
    pendingTimers.delete(id);
    try{ fn(); }catch(e){}
  }, Math.max(0, ms|0));
  pendingTimers.add(id);
  return id;
}
function clearAllPendingTimers(){
  for (const id of pendingTimers){ try{ clearTimeout(id); }catch(e){} }
  pendingTimers.clear();
  for (const id of pendingObstacleTimers){ try{ clearTimeout(id); }catch(e){} }
  pendingObstacleTimers.clear();
}

/* ------------------------------------------------------------
 * Logging / event buffer (local-first; remote optional stub)
 * ------------------------------------------------------------ */
const EVENT_BUFFER_KEY  = 'HHA_EVENT_BUFFER_balance-hold';
const SESSION_ROWS_KEY  = 'HHA_SESSION_ROWS_balance-hold';
const LAST_SUMMARY_KEY  = 'HHA_LAST_SUMMARY_balance-hold';
const REMOTE_QUEUE_KEY  = 'HHA_REMOTE_FALLBACK_QUEUE_balance-hold';

function createEventBuffer(){
  const events = [];
  function push(type, data){
    const row = {
      ts: nowMs(),
      type: String(type || ''),
      ...(data || {})
    };
    events.push(row);
    try{
      const arr = JSON.parse(localStorage.getItem(EVENT_BUFFER_KEY) || '[]');
      arr.push(row);
      if (arr.length > 3000) arr.splice(0, arr.length - 3000);
      localStorage.setItem(EVENT_BUFFER_KEY, JSON.stringify(arr));
    }catch(e){}
  }
  function flush(reason='flush'){
    push('flush_marker', { reason });
    const logUrl = qs('log','');
    if (!logUrl) return;
    // Remote bridge intentionally kept stub-safe for now.
    try{
      const queue = JSON.parse(localStorage.getItem(REMOTE_QUEUE_KEY) || '[]');
      queue.push({ ts: nowMs(), reason, payload: events.slice(-250), url: logUrl });
      localStorage.setItem(REMOTE_QUEUE_KEY, JSON.stringify(queue));
    }catch(e){}
  }
  return { push, flush };
}

function buildSessionRow(summary, endedBy){
  return {
    ts: nowMs(),
    gameId: 'balance-hold',
    endedBy: String(endedBy || ''),
    mode: String(summary?.mode || ''),
    difficulty: String(summary?.difficulty || ''),
    durationSec: Number(summary?.durationSec || 0),
    score: Number(summary?.score || 0),
    rank: String(summary?.rank || ''),
    stabilityRatio: Number(summary?.stabilityRatio || 0),
    meanTilt: Number(summary?.meanTilt || 0),
    rmsTilt: Number(summary?.rmsTilt || 0),
    fatigueIndex: Number(summary?.fatigueIndex || 0),
    obstaclesAvoided: Number(summary?.obstaclesAvoided || 0),
    obstaclesHit: Number(summary?.obstaclesHit || 0),
    perfectAvoids: Number(summary?.perfectAvoids || 0),
    maxCombo: Number(summary?.maxCombo || 0),
    obstacleManifestKey: String(summary?.obstacleManifestKey || ''),
    aiDirectorLocked: Number(summary?.aiDirectorLocked || 0),
    aiDirectorRateMul: Number(summary?.aiDirectorRateMul || 1),
    aiDirectorDriftMul: Number(summary?.aiDirectorDriftMul || 1),
    aiDirectorKnockMul: Number(summary?.aiDirectorKnockMul || 1),
    labels: getPerformanceLabels(summary).join('|'),
    queryContract: JSON.stringify(getQueryContractSnapshot())
  };
}
function appendSessionRow(row){
  try{
    const arr = JSON.parse(localStorage.getItem(SESSION_ROWS_KEY) || '[]');
    arr.push(row);
    if (arr.length > 1000) arr.splice(0, arr.length - 1000);
    localStorage.setItem(SESSION_ROWS_KEY, JSON.stringify(arr));
  }catch(e){}
}

let lastSummary = null;
function saveLastSummary(summary){
  lastSummary = summary || null;
  try{
    const payload = {
      ...(summary || {}),
      labels: getPerformanceLabels(summary),
      obstacleManifestKey: String(summary?.obstacleManifestKey || ''),
      aiDirectorLocked: Number(summary?.aiDirectorLocked || 0),
      queryContract: getQueryContractSnapshot()
    };
    localStorage.setItem(LAST_SUMMARY_KEY, JSON.stringify(payload));
  }catch(e){}
}

function createCSVLogger(meta){
  const rows = [];
  rows.push([
    'timestamp','event',
    'playerId','group','phase','mode',
    'difficulty','durationSec',
    'tilt','targetTilt','inSafe',
    'obstacleId','obstacleResult'
  ]);
  function push(ev, extra){
    const e = extra || {};
    rows.push([
      nowMs(), ev,
      meta.playerId||'', meta.group||'', meta.phase||'', meta.mode||'',
      meta.difficulty||'', meta.durationSec||'',
      e.tilt ?? '', e.targetTilt ?? '', e.inSafe ?? '',
      e.obstacleId ?? '', e.obstacleResult ?? ''
    ]);
  }
  return {
    logSample(info){ push('sample', info); },
    logObstacle(info){ push('obstacle', info); },
    finish(summary){
      push('summary',{
        tilt: summary.meanTilt,
        inSafe: summary.stabilityRatio,
        obstacleResult: `avoid=${summary.obstaclesAvoided},hit=${summary.obstaclesHit}`
      });

      // research: auto-download
      if (meta.mode === 'research'){
        const csv = rows.map(r=>r.map(v=>{
          const s = String(v ?? '');
          return /[",\r\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
        }).join(',')).join('\r\n');
        downloadTextFile(`${meta.filePrefix || 'balance-hold'}-${meta.difficulty}-${Date.now()}.csv`, csv, 'text/csv');
      }
    }
  };
}

function downloadTextFile(filename, text, mime='text/plain'){
  try{
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    safeSetTimeout(()=>{
      try{ document.body.removeChild(a); }catch(e){}
      URL.revokeObjectURL(url);
    }, 120);
  }catch(e){}
}

function toCsv(rows){
  if (!rows || !rows.length) return '';
  const keys = Array.from(rows.reduce((set,row)=>{
    Object.keys(row || {}).forEach(k=>set.add(k));
    return set;
  }, new Set()));
  const esc = (v)=>{
    const s = String(v ?? '');
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  };
  const lines = [keys.map(esc).join(',')];
  rows.forEach(r=> lines.push(keys.map(k=>esc(r[k])).join(',')));
  return lines.join('\r\n');
}
function exportSessionRowsCsv(){
  try{
    const rows = JSON.parse(localStorage.getItem(SESSION_ROWS_KEY) || '[]');
    downloadTextFile(`balance-hold-sessions-${Date.now()}.csv`, toCsv(rows), 'text/csv');
  }catch(e){}
}
function exportEventRowsCsv(){
  try{
    const rows = JSON.parse(localStorage.getItem(EVENT_BUFFER_KEY) || '[]');
    downloadTextFile(`balance-hold-events-${Date.now()}.csv`, toCsv(rows), 'text/csv');
  }catch(e){}
}
function exportReleaseBundleDebug(){
  try{
    const payload = {
      exportedAt: nowMs(),
      gameId: 'balance-hold',
      version: 'A-K',
      queryContract: getQueryContractSnapshot(),
      lastSummary,
      replayManifest: buildReplayManifest(lastSummary || null),
      sessions: JSON.parse(localStorage.getItem(SESSION_ROWS_KEY) || '[]'),
      events: JSON.parse(localStorage.getItem(EVENT_BUFFER_KEY) || '[]'),
      remoteFallback: JSON.parse(localStorage.getItem(REMOTE_QUEUE_KEY) || '[]'),
      dailyMissions: JSON.parse(localStorage.getItem('HHA_DAILY_MISSIONS_balance-hold') || '{}')
    };
    downloadTextFile(`balance-hold-release-debug-${Date.now()}.json`, JSON.stringify(payload, null, 2), 'application/json');
  }catch(e){}
}

/* ------------------------------------------------------------
 * Dashboard hook
 * ------------------------------------------------------------ */
const globalStats =
  (window.VRFitnessStats && window.VRFitnessStats.recordSession)
    ? window.VRFitnessStats
    : (window.__VRFIT_STATS || null);

function recordSessionToDashboard(gameId, summary){
  if (globalStats && typeof globalStats.recordSession === 'function'){
    try{ globalStats.recordSession(gameId, summary); }catch(e){}
  }else{
    try{
      const key = 'vrfit_sessions_'+gameId;
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.push({ ...summary, ts: nowMs() });
      localStorage.setItem(key, JSON.stringify(arr));
    }catch(e){}
  }
}

/* ------------------------------------------------------------
 * Result analytics / labels / ranks / badges
 * ------------------------------------------------------------ */
function getRankByScore(score){
  const s = Number(score || 0);
  const t = SCORE_CFG.rankThresholds;
  if (s >= t.S) return 'S';
  if (s >= t.A) return 'A';
  if (s >= t.B) return 'B';
  if (s >= t.C) return 'C';
  return 'D';
}
function getPerformanceLabels(summary){
  const labels = [];
  const stab = Number(summary?.stabilityRatio || 0);
  const hit = Number(summary?.obstaclesHit || 0);
  const perfect = Number(summary?.perfectAvoids || 0);
  const fatigue = Number(summary?.fatigueIndex || 0);

  labels.push(stab >= 0.75 ? 'High Stability'
            : stab >= 0.55 ? 'Moderate Stability'
            : 'Low Stability');
  labels.push(hit <= 1 ? 'Good Avoid Timing' : 'Timing Needs Work');
  if (perfect >= 2) labels.push('Precision Control');
  if (fatigue > 0.25) labels.push('Fatigue Drift');
  return labels;
}
function computeMiniBadges(summary){
  const out = [];
  const stab = Number(summary?.stabilityRatio || 0);
  const avoid = Number(summary?.obstaclesAvoided || 0);
  const hit = Number(summary?.obstaclesHit || 0);
  const score = Number(summary?.score || 0);
  const combo = Number(summary?.maxCombo || 0);
  const perfect = Number(summary?.perfectAvoids || 0);
  const bossAvoid = Number(summary?.bossWaveAvoids || 0);
  const bossHit = Number(summary?.bossWaveHits || 0);
  const fatigue = Number(summary?.fatigueIndex || 0);

  if (stab >= 0.80) out.push({ text:'🧘 Steady Master', tone:'good' });
  else if (stab >= 0.65) out.push({ text:'🎯 Stable Control', tone:'good' });

  if (perfect >= 3) out.push({ text:`✨ Precision x${perfect}`, tone:'good' });
  else if (perfect >= 1) out.push({ text:'✨ First Perfect', tone:'good' });

  if (combo >= 8) out.push({ text:`🔥 Combo ${combo}`, tone:'good' });
  else if (combo >= 4) out.push({ text:`🔥 Combo ${combo}`, tone:'warn' });

  if (bossAvoid >= 3 && bossHit === 0) out.push({ text:'👑 Boss Clean', tone:'good' });
  else if (bossAvoid >= 1) out.push({ text:'⚠ Boss Survivor', tone:'warn' });

  if (hit === 0 && avoid >= 4) out.push({ text:'🛡 No Hit Run', tone:'good' });
  if (fatigue > 0.25) out.push({ text:'😮‍💨 Fatigue Rise', tone:'warn' });
  if (score >= (SCORE_CFG.rankThresholds.A || 320)) out.push({ text:'🏅 High Score Pace', tone:'good' });

  if (!out.length) out.push({ text:'🌱 Keep Practicing', tone:'warn' });
  return out.slice(0, 6);
}
function renderMiniBadges(summary){
  if (!heroBadgesEl) return;
  heroBadgesEl.innerHTML = '';
  computeMiniBadges(summary).forEach(b=>{
    const el = document.createElement('div');
    el.className = `mini-badge ${b.tone || ''}`;
    el.textContent = b.text;
    heroBadgesEl.appendChild(el);
  });
}
function buildNextMissionChips(summary){
  const chips = [];
  const s = Number(summary?.score || 0);
  const p = Number(summary?.perfectAvoids || 0);
  const h = Number(summary?.obstaclesHit || 0);
  const r = String(summary?.rank || 'D');

  if (s < 200) chips.push({ text:'🎯 Score 200+', tone:'warn' });
  if (p < 3) chips.push({ text:`✨ Perfect x${Math.max(3, p+1)}`, tone:'good' });
  if (h > 0) chips.push({ text:'🛡 No-Hit Run', tone:'good' });
  if (['D','C','B'].includes(r)) chips.push({ text:'🏅 Reach Rank A', tone:'good' });

  if (!chips.length) chips.push({ text:'👑 Try Rank S', tone:'good' });
  return chips.slice(0, 4);
}
function renderMissionChips(summary){
  if (!heroMissionChipsEl) return;
  heroMissionChipsEl.innerHTML = '';
  buildNextMissionChips(summary).forEach(c=>{
    const el = document.createElement('div');
    el.className = `mini-badge ${c.tone || ''}`;
    el.textContent = c.text;
    heroMissionChipsEl.appendChild(el);
  });
}
function buildResultInsight(summary){
  const rank = String(summary?.rank || 'D');
  const stab = Number(summary?.stabilityRatio || 0);
  const avoid = Number(summary?.obstaclesAvoided || 0);
  const hit = Number(summary?.obstaclesHit || 0);
  const perfect = Number(summary?.perfectAvoids || 0);
  const combo = Number(summary?.maxCombo || 0);
  const fatigue = Number(summary?.fatigueIndex || 0);

  const parts = [];
  if (stab >= 0.75) parts.push('การทรงตัวโดยรวมดีมาก');
  else if (stab >= 0.55) parts.push('การทรงตัวอยู่ในระดับดีและพัฒนาได้อีก');
  else parts.push('ควรโฟกัสการคุมให้อยู่ใกล้กึ่งกลางให้นานขึ้น');

  if (hit === 0 && avoid > 0) parts.push('หลบแรงรบกวนได้ครบแบบไม่โดนชน');
  else if (avoid > hit) parts.push('หลบ obstacle ได้มากกว่าที่โดนชน');
  else parts.push('จังหวะรับแรงรบกวนยังพลาดบ่อย ลอง pre-center ก่อน impact');

  if (perfect >= 3) parts.push(`มี perfect avoid ${perfect} ครั้ง แปลว่าการคุมจังหวะละเอียดดีมาก`);
  else if (perfect >= 1) parts.push(`เริ่มมี perfect avoid แล้ว (${perfect} ครั้ง)`);

  if (combo >= 8) parts.push(`ทำ max combo ได้ ${combo} แสดงถึงความสม่ำเสมอ`);
  if (fatigue > 0.25) parts.push('ช่วงท้ายมีแนวโน้มล้า/แกว่งมากขึ้น');
  parts.push(`สรุปอันดับ ${rank}`);

  return parts.join(' • ');
}
function animateCountText(el, toValue, durationMs=700, prefix='', suffix=''){
  if (!el) return;
  if (!isFxEnabled('scoreCount') || prefersReducedMotion()){
    el.textContent = `${prefix}${Math.round(Number(toValue)||0)}${suffix}`;
    return;
  }
  const start = performance.now();
  const from = 0;
  const target = Math.round(Number(toValue) || 0);
  function step(now){
    const p = clamp((now - start) / durationMs, 0, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const v = Math.round(from + (target - from) * eased);
    el.textContent = `${prefix}${v}${suffix}`;
    if (p < 1) requestAnimationFrame(step);
    else{
      el.classList.remove('count-pop'); void el.offsetWidth; el.classList.add('count-pop');
    }
  }
  requestAnimationFrame(step);
}
function animateRankReveal(rank){
  if (!rankBadgeEl) return;
  rankBadgeEl.textContent = rank;
  if (!isFxEnabled('rankReveal') || prefersReducedMotion()) return;
  rankBadgeEl.classList.remove('rank-pop'); void rankBadgeEl.offsetWidth; rankBadgeEl.classList.add('rank-pop');
}
function getTodayMissionProgressText(){
  try{
    const dayKey = new Date().toISOString().slice(0,10);
    const data = JSON.parse(localStorage.getItem('HHA_DAILY_MISSIONS_balance-hold') || '{}');
    const d = data[dayKey];
    if (!d) return '-';
    const c = d.completed || {};
    const done = [c.play1,c.score200,c.perfect1,c.noHit].filter(Boolean).length;
    return `${done}/4 missions`;
  }catch(e){ return '-'; }
}
function updateLocalDailyMissions(summary){
  try{
    const dayKey = new Date().toISOString().slice(0,10);
    const key = 'HHA_DAILY_MISSIONS_balance-hold';
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    if (!data[dayKey]){
      data[dayKey] = {
        plays:0, bestScore:0, bestRank:'D', perfectTotal:0, noHitRuns:0,
        completed:{ play1:false, score200:false, perfect1:false, noHit:false }
      };
    }
    const d = data[dayKey];
    d.plays += 1;
    d.bestScore = Math.max(d.bestScore || 0, Number(summary?.score || 0));
    d.perfectTotal += Number(summary?.perfectAvoids || 0);
    const rankOrder = ['D','C','B','A','S'];
    const currRank = String(summary?.rank || 'D');
    if (rankOrder.indexOf(currRank) > rankOrder.indexOf(d.bestRank || 'D')) d.bestRank = currRank;

    const hit = Number(summary?.obstaclesHit || 0);
    const avoid = Number(summary?.obstaclesAvoided || 0);
    if (hit === 0 && avoid > 0) d.noHitRuns += 1;

    d.completed.play1 = d.plays >= 1;
    d.completed.score200 = d.bestScore >= 200;
    d.completed.perfect1 = d.perfectTotal >= 1;
    d.completed.noHit = d.noHitRuns >= 1;
    localStorage.setItem(key, JSON.stringify(data));

    if (window.HHA && typeof window.HHA.onMissionProgress === 'function'){
      try{ window.HHA.onMissionProgress({ gameId:'balance-hold', date:dayKey, daily:d }); }catch(e){}
    }
  }catch(e){}
}

/* ------------------------------------------------------------
 * End modal helpers
 * ------------------------------------------------------------ */
function isEndModalOpen(){ return !!endModal && !endModal.classList.contains('hidden'); }
function openEndModal(summary){
  if (!endModal || isEndModalOpen()) return;
  endModal.classList.remove('hidden');
  endModal.setAttribute('aria-hidden','false');

  const rank = String(summary?.rank || 'D');
  if (endModalRank){
    endModalRank.textContent = rank;
    endModalRank.classList.remove('rank-S','rank-A','rank-B','rank-C','rank-D');
    endModalRank.classList.add(`rank-${rank}`);
  }
  if (endModalScore) endModalScore.textContent = String(summary?.score || 0);
  if (endModalInsight) endModalInsight.textContent = buildResultInsight(summary);
}
function closeEndModal(){
  if (!endModal || !isEndModalOpen()) return;
  endModal.classList.add('hidden');
  endModal.setAttribute('aria-hidden','true');
}

/* ------------------------------------------------------------
 * Tutorial overlay helpers
 * ------------------------------------------------------------ */
const TUTORIAL_PREF_KEY = 'BH_TUTORIAL_PREFS';
function loadTutorialPrefs(){
  try{ return JSON.parse(localStorage.getItem(TUTORIAL_PREF_KEY) || '{}'); }
  catch(e){ return {}; }
}
function saveTutorialPrefs(v){
  try{ localStorage.setItem(TUTORIAL_PREF_KEY, JSON.stringify(v||{})); }catch(e){}
}
function shouldShowTutorialAuto(){
  if (!isFxEnabled('tutorial')) return false;
  const q = String(qs('tutorial','')).toLowerCase();
  if (q === '1' || q === 'true') return true;
  if (q === '0' || q === 'false') return false;
  const p = loadTutorialPrefs();
  return !p.dismissed;
}
function openTutorialOverlay(){
  if (!tutorialOverlay) return;
  tutorialOverlay.classList.remove('hidden');
  tutorialOverlay.setAttribute('aria-hidden', 'false');
}
function closeTutorialOverlay(){
  if (!tutorialOverlay) return;
  tutorialOverlay.classList.add('hidden');
  tutorialOverlay.setAttribute('aria-hidden', 'true');
}
function startPlayFlowWithTutorial(kind='play'){
  const launch = ()=> startGame(kind);
  if (kind !== 'play'){ launch(); return; }
  if (shouldShowTutorialAuto()){
    if (tutorialOverlay) tutorialOverlay.__pendingStartKind = kind;
    openTutorialOverlay();
  }else{
    launch();
  }
}

/* ------------------------------------------------------------
 * cVR preview hooks
 * ------------------------------------------------------------ */
let cvrState = {
  enabled:false,
  strict:false,
  calibrationOffset:0,
  lastRecenterAt:0
};
const CVR_PREF_KEY = 'BH_CVR_PREFS';
function loadCvrPrefs(){
  try{ return JSON.parse(localStorage.getItem(CVR_PREF_KEY) || '{}'); }catch(e){ return {}; }
}
function saveCvrPrefs(){
  try{
    localStorage.setItem(CVR_PREF_KEY, JSON.stringify({
      strict: !!cvrState.strict,
      calibrationOffset: Number(cvrState.calibrationOffset || 0)
    }));
  }catch(e){}
}
function refreshCvrUI(){
  const mode = (elViewMode?.value || qs('view','pc') || 'pc').toLowerCase();
  cvrState.enabled = mode === 'cvr';
  if (cvrOverlayEl){
    cvrOverlayEl.classList.toggle('hidden', !cvrState.enabled);
    cvrOverlayEl.setAttribute('aria-hidden', cvrState.enabled ? 'false' : 'true');
  }
  if (cvrStrictLabelEl) cvrStrictLabelEl.textContent = cvrState.strict ? 'ON' : 'OFF';
}
function cvrRecenter(){
  cvrState.lastRecenterAt = nowMs();
  cvrState.calibrationOffset = 0;
  saveCvrPrefs(); refreshCvrUI();
  if (state) state.targetAngle = 0;
  pushCoachMessage('cVR Recenter แล้ว 🎯 จุดกลางถูกตั้งใหม่', { ttlMs:1800, force:true });
  try{ window.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ gameId:'balance-hold' } })); }catch(e){}
}
function cvrAdjustCalibration(delta){
  cvrState.calibrationOffset = clamp(Number(cvrState.calibrationOffset||0) + Number(delta||0), -0.25, 0.25);
  saveCvrPrefs();
  pushCoachMessage(`cVR Calibration ${(cvrState.calibrationOffset>=0?'+':'')}${cvrState.calibrationOffset.toFixed(2)}`, { ttlMs:1400, force:true });
}
function cvrToggleStrict(){
  cvrState.strict = !cvrState.strict;
  saveCvrPrefs(); refreshCvrUI();
  pushCoachMessage(`cVR Strict ${cvrState.strict ? 'ON' : 'OFF'}`, { ttlMs:1500, force:true });
}
function resolvePracticeSeconds(){
  const isCvr = ((elViewMode?.value || qs('view','pc')) === 'cvr');
  const qPractice = qn('practice', FLOW_CFG.practiceSecDefault);
  const qPracticeOn = parseBoolLike(qs('practiceOn','1'), true);
  if (isCvr && qPracticeOn) return Math.max(10, qPractice || 15);
  return qPracticeOn ? Math.max(0, qPractice || 0) : 0;
}

/* ------------------------------------------------------------
 * Audio-lite stubs (optional polish)
 * ------------------------------------------------------------ */
let audioEnabled = !prefersReducedMotion();
function tryBeep(freq=520, dur=0.05, type='sine', gain=0.02){
  if (!audioEnabled) return;
  try{
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!window.__bhAC) window.__bhAC = new AC();
    const ac = window.__bhAC;
    if (ac.state === 'suspended') ac.resume().catch(()=>{});
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g); g.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + dur);
  }catch(e){}
}

/* ------------------------------------------------------------
 * FX helpers
 * ------------------------------------------------------------ */
function isReducedMotionActive(){
  return document.body.classList.contains('reduced-motion') || prefersReducedMotion();
}
function spawnFloatFx(text, tone='good', x=null, y=null){
  if (isReducedMotionActive()) return;
  if (!playArea) return;
  const rect = playArea.getBoundingClientRect();
  const px = (x==null ? rect.left + rect.width*0.5 : x);
  const py = (y==null ? rect.top + rect.height*0.35 : y);
  const el = document.createElement('div');
  el.className = `fx-float ${tone}`;
  el.textContent = text;
  el.style.left = (px - rect.left)+'px';
  el.style.top  = (py - rect.top)+'px';
  playArea.appendChild(el);
  safeSetTimeout(()=>{ try{ el.remove(); }catch(e){} }, 750);
}
function hitScreenShake(){
  if (isReducedMotionActive() || !playArea) return;
  playArea.classList.remove('shake-hit');
  void playArea.offsetWidth;
  playArea.classList.add('shake-hit');
}

/* ------------------------------------------------------------
 * AI Director (play adaptive, research locked)
 * ------------------------------------------------------------ */
const AI_DIR_CFG = {
  enabledPlay:true,
  enabledResearch:true,
  evalEveryMs:5000,
  maxAdjustStep:0.08,
  minRateMul:0.82, maxRateMul:1.22,
  minDriftMul:0.88, maxDriftMul:1.18,
  minKnockMul:0.90, maxKnockMul:1.20
};
function initAiDirectorState(nowPerf){
  return {
    enabled:true,
    locked:(gameMode === 'research'),
    lastEvalAt: nowPerf,
    rateMul:1, driftMul:1, knockMul:1,
    history:[]
  };
}
function aiDirectorEvaluate(nowPerf){
  if (!state || !state.aiDirector || !state.aiDirector.enabled) return;
  const d = state.aiDirector;
  if ((nowPerf - d.lastEvalAt) < AI_DIR_CFG.evalEveryMs) return;
  d.lastEvalAt = nowPerf;

  const n = Math.max(1, state.totalSamples || 0);
  const stab = (state.stableSamples || 0) / n;
  const hit = Number(state.obstaclesHit || 0);
  const avoid = Number(state.obstaclesAvoided || 0);
  const totalObs = hit + avoid;
  const hitRate = totalObs ? hit/totalObs : 0;
  const perfect = Number(state.perfectAvoids || 0);

  let challengeSignal = 0.5;
  if (n > 15){
    challengeSignal += (stab - 0.62) * 0.9;
    challengeSignal += (0.28 - hitRate) * 0.5;
    challengeSignal += Math.min(0.2, perfect * 0.03);
  }
  challengeSignal = clamp(challengeSignal, 0, 1);

  const desiredRate  = 1 + ((0.5 - challengeSignal) * 0.36);
  const desiredDrift = 1 + ((challengeSignal - 0.5) * 0.30);
  const desiredKnock = 1 + ((challengeSignal - 0.5) * 0.28);
  const step = AI_DIR_CFG.maxAdjustStep;
  const moveToward = (curr,target)=> curr + Math.max(-step, Math.min(step, target-curr));

  const nextRate  = clamp(moveToward(d.rateMul, desiredRate),  AI_DIR_CFG.minRateMul,  AI_DIR_CFG.maxRateMul);
  const nextDrift = clamp(moveToward(d.driftMul,desiredDrift), AI_DIR_CFG.minDriftMul, AI_DIR_CFG.maxDriftMul);
  const nextKnock = clamp(moveToward(d.knockMul,desiredKnock), AI_DIR_CFG.minKnockMul, AI_DIR_CFG.maxKnockMul);

  const snapshot = {
    ts: nowMs(),
    locked: d.locked ? 1 : 0,
    stab:+stab.toFixed(4),
    hitRate:+hitRate.toFixed(4),
    perfect,
    challengeSignal:+challengeSignal.toFixed(4),
    desiredRate:+desiredRate.toFixed(4),
    desiredDrift:+desiredDrift.toFixed(4),
    desiredKnock:+desiredKnock.toFixed(4),
    prevRate:+d.rateMul.toFixed(4),
    prevDrift:+d.driftMul.toFixed(4),
    prevKnock:+d.knockMul.toFixed(4)
  };

  if (!d.locked && gameMode === 'play'){
    d.rateMul = nextRate; d.driftMul = nextDrift; d.knockMul = nextKnock;
    snapshot.appliedRate = +d.rateMul.toFixed(4);
    snapshot.appliedDrift = +d.driftMul.toFixed(4);
    snapshot.appliedKnock = +d.knockMul.toFixed(4);
    state.hhaEvents && state.hhaEvents.push('ai_director_adjust', snapshot);
  }else{
    snapshot.appliedRate = +d.rateMul.toFixed(4);
    snapshot.appliedDrift = +d.driftMul.toFixed(4);
    snapshot.appliedKnock = +d.knockMul.toFixed(4);
    state.hhaEvents && state.hhaEvents.push('ai_director_observe_locked', snapshot);
  }
  d.history.push(snapshot);
  if (d.history.length > 30) d.history.shift();
}

/* ------------------------------------------------------------
 * Pause / auto-pause helpers
 * ------------------------------------------------------------ */
let autoPausedBySystem = false;
function pauseGame(){
  if (!state || state.isPaused) return;
  state.isPaused = true;
  state.pauseStartedAt = performance.now();
  if (hudStatus) hudStatus.textContent = 'Paused';
  if (btnPause) btnPause.classList.add('hidden');
  if (btnResume) btnResume.classList.remove('hidden');
  state.hhaEvents && state.hhaEvents.push('pause', { phase: state.phaseName, auto: 0 });
}
function resumeGame(){
  if (!state || !state.isPaused) return;
  state.isPaused = false;
  const now = performance.now();
  const pausedDur = now - (state.pauseStartedAt || now);
  state.lastFrame = now;
  state.startTime += pausedDur;
  state.phaseStartedAt += pausedDur;
  state.nextSampleAt += pausedDur;
  state.nextObstacleAt += pausedDur;
  if (hudStatus) hudStatus.textContent = 'Running';
  if (btnPause) btnPause.classList.remove('hidden');
  if (btnResume) btnResume.classList.add('hidden');
  autoPausedBySystem = false;
  state.hhaEvents && state.hhaEvents.push('resume', { phase: state.phaseName, auto: 0 });
}
function autoPauseIfNeeded(reason='hidden'){
  if (!state || state.isPaused) return;
  autoPausedBySystem = true;
  pauseGame();
  if (hudStatus) hudStatus.textContent = `Paused (${reason})`;
  state.hhaEvents && state.hhaEvents.push('auto_pause', { reason, phaseName: state.phaseName });
}
function maybeResumePrompt(){
  if (!state || !state.isPaused || !autoPausedBySystem) return;
  pushCoachMessage('เกมถูกพักอัตโนมัติ (สลับแอป/หน้าจอ) กด Resume เพื่อเล่นต่อ / Auto-paused. Tap Resume to continue.', {
    ttlMs:3500, force:true
  });
}
function flushBeforeExit(reason='hidden'){
  try{ state?.hhaEvents?.flush(reason); }catch(e){}
}

/* ------------------------------------------------------------
 * Session meta
 * ------------------------------------------------------------ */
function buildSessionMeta(diffKey, durationSec){
  let playerId='anon', group='', phase='';
  if (gameMode === 'research'){
    playerId = $('#researchId')?.value.trim() || qs('pid','anon') || 'anon';
    group    = $('#researchGroup')?.value.trim() || qs('group','') || '';
    phase    = $('#researchPhase')?.value.trim() || qs('phase','') || '';
  }else{
    playerId = qs('pid','anon') || 'anon';
    group    = qs('group','') || '';
    phase    = qs('phase','') || '';
  }
  return {
    gameId: 'balance-hold',
    playerId, group, phase,
    mode: gameMode,
    difficulty: diffKey,
    durationSec,
    filePrefix: 'vrfitness_balance'
  };
}

/* ------------------------------------------------------------
 * Game state
 * ------------------------------------------------------------ */
let gameMode    = 'play';
let state       = null;
let rafId       = null;
let logger      = null;
let sessionMeta = null;

function randomBetweenWithRng(a,b, rr){
  const r = (typeof rr === 'function') ? rr() : Math.random();
  return a + r*(b-a);
}

/* ------------------------------------------------------------
 * Flow phase helpers (warmup / practice / main)
 * ------------------------------------------------------------ */
function getPhaseDurationMs(name, totalSec){
  if (name === 'warmup') return Math.max(0, qn('warmup', FLOW_CFG.warmupSecDefault)) * 1000;
  if (name === 'practice') return Math.max(0, resolvePracticeSeconds()) * 1000;
  if (name === 'main') return Math.max(1, Number(totalSec || 60)) * 1000;
  return 0;
}
function setPhase(name){
  if (!state) return;
  state.phaseName = name;
  state.phaseStartedAt = performance.now();
  if (hudPhase) hudPhase.textContent = name;
  showPhaseCoachHint(name);

  if (name === 'warmup'){
    state.phaseEndAt = state.phaseStartedAt + getPhaseDurationMs('warmup', state.mainDurationSec);
  }else if (name === 'practice'){
    state.phaseEndAt = state.phaseStartedAt + getPhaseDurationMs('practice', state.mainDurationSec);
  }else{
    state.phaseEndAt = state.phaseStartedAt + state.durationMs;
  }
  state.hhaEvents && state.hhaEvents.push('phase_change', { phaseName: name });
}
function stepPhaseFlow(nowPerf){
  if (!state) return;
  if (state.phaseName === 'main') return; // loop main uses duration
  if (nowPerf < state.phaseEndAt) return;

  if (state.phaseName === 'warmup'){
    const pMs = getPhaseDurationMs('practice', state.mainDurationSec);
    if (pMs > 0) setPhase('practice');
    else setPhase('main');
    return;
  }
  if (state.phaseName === 'practice'){
    setPhase('main');
    return;
  }
}

/* ------------------------------------------------------------
 * Input profile
 * ------------------------------------------------------------ */
function getInputProfile(){
  const view = (elViewMode?.value || qs('view','pc') || 'pc').toLowerCase();
  if (view === 'mobile'){
    return { deadzone:0.04, smoothing:0.22, maxTarget:0.95 };
  }
  if (view === 'cvr'){
    return { deadzone:0.06, smoothing:0.18, maxTarget:0.85 };
  }
  return { deadzone:0.02, smoothing:0.35, maxTarget:1.00 };
}

/* ------------------------------------------------------------
 * Start / stop
 * ------------------------------------------------------------ */
function startGame(kind){
  gameMode = (kind === 'research' ? 'research' : 'play');

  const diffKey = String(qs('diff', elDiffSel?.value || 'normal')).toLowerCase();
  const durSec  = Math.max(10, parseInt(qs('time', String(elDurSel?.value || '60')),10) || 60);
  const cfg = pickDiff(diffKey);
  const seed = qs('seed', `${Date.now()}`);
  const rr = createSeededRng(seed);

  sessionMeta = buildSessionMeta(diffKey, durSec);
  logger = createCSVLogger(sessionMeta);

  const now = performance.now();
  state = {
    // meta
    gameId: 'balance-hold',
    diffKey, cfg,
    mainDurationSec: durSec,
    durationMs: durSec * 1000, // main phase duration only
    seed,
    rand: rr,
    hhaEvents: createEventBuffer(),
    scenarioPreset: {
      obstacleRateMul: (String(qs('preset','A')).toUpperCase() === 'B') ? 0.92 : 1,
      driftMul: (String(qs('preset','A')).toUpperCase() === 'B') ? 1.08 : 1,
      knockMul: (String(qs('preset','A')).toUpperCase() === 'B') ? 1.06 : 1
    },
    obstacleManifestKey: getObstacleManifestKey(),
    aiDirector: initAiDirectorState(now),

    // timing
    startTime: now,         // main phase start will be reset when entering main
    elapsed: 0,
    phaseName: 'warmup',
    phaseStartedAt: now,
    phaseEndAt: now,
    isPaused: false,
    pauseStartedAt: 0,

    // balance
    angle: 0, targetAngle: 0, lastFrame: now, inputActive:false,

    // sampling
    sampleEveryMs: 120,
    nextSampleAt: now + 120,
    totalSamples: 0,
    stableSamples: 0,
    sumTiltAbs: 0,
    sumTiltSq: 0,
    meanTilt: 0,
    samples: [],

    // obstacles
    nextObstacleAt: now + randomBetweenWithRng(cfg.disturbMinMs, cfg.disturbMaxMs, rr),
    obstacleSeq: 1,
    obstaclesTotal: 0,
    obstaclesAvoided: 0,
    obstaclesHit: 0,
    bossWaveAvoids: 0,
    bossWaveHits: 0,
    bossActive: false,

    // score
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfectAvoids: 0,

    // fatigue
    fatigueIndex: 0
  };

  // phase init
  setPhase('warmup');

  lastCoachAt = 0;
  lastCoachSnapshot = null;
  if (coachBubble) coachBubble.classList.add('hidden');
  isStoppingNow = false;
  autoPausedBySystem = false;

  // reset HUD
  if (hudMode) hudMode.textContent = (gameMode==='research' ? 'Research' : 'Play');
  if (hudDiff) hudDiff.textContent = diffKey;
  if (hudDur) hudDur.textContent = String(durSec);
  if (hudStab) hudStab.textContent = '0%';
  if (hudObs) hudObs.textContent = '0 / 0';
  if (hudTime) hudTime.textContent = durSec.toFixed(1);
  if (hudStatus) hudStatus.textContent = 'Running';
  if (hudScore) hudScore.textContent = '0';
  if (hudCombo) hudCombo.textContent = '0';
  if (hudPhase) hudPhase.textContent = 'warmup';

  if (stabilityFillEl) stabilityFillEl.style.width = '0%';
  if (centerPulseEl) centerPulseEl.classList.remove('good');

  if (coachLabel){
    coachLabel.textContent = 'จับ/แตะแล้วเลื่อนไปซ้าย–ขวาเพื่อรักษาสมดุล / Drag left–right to balance';
  }

  refreshCvrUI();
  if (((elViewMode?.value || qs('view','pc')) === 'cvr')){
    pushCoachMessage('cVR ready: เริ่มด้วย Recenter ถ้ารู้สึกเอียง', { ttlMs:2200, force:true });
  }

  if (btnPause) btnPause.classList.remove('hidden');
  if (btnResume) btnResume.classList.add('hidden');

  closeEndModal();
  clearAllPendingTimers();
  if (rafId != null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);

  showView('play');
  state.hhaEvents.push('session_start', {
    mode: gameMode, diffKey, durSec, seed,
    obstacleManifestKey: state.obstacleManifestKey
  });
}

function stopGame(endedBy){
  if (!state) return;
  if (isStoppingNow) return;
  isStoppingNow = true;

  try{ if (rafId != null){ cancelAnimationFrame(rafId); rafId = null; } }catch(e){}

  const st = state;
  const a = computeAnalytics();
  const summary = {
    gameId: 'balance-hold',
    mode: sessionMeta?.mode || gameMode,
    difficulty: st.diffKey,
    durationSec: st.mainDurationSec,
    stabilityRatio: a.stabilityRatio,
    meanTilt: a.meanTilt,
    rmsTilt: a.rmsTilt,
    fatigueIndex: a.fatigueIndex,
    samples: a.samples,
    obstaclesAvoided: st.obstaclesAvoided,
    obstaclesHit: st.obstaclesHit,
    obstaclesTotal: st.obstaclesTotal,
    bossWaveAvoids: st.bossWaveAvoids,
    bossWaveHits: st.bossWaveHits,
    perfectAvoids: st.perfectAvoids,
    maxCombo: st.maxCombo,
    score: st.score,
    rank: getRankByScore(st.score),
    aiTip: buildAiTipSummary(st),
    obstacleManifestKey: st.obstacleManifestKey || 'A',
    aiDirectorLocked: st.aiDirector?.locked ? 1 : 0,
    aiDirectorRateMul: Number(st.aiDirector?.rateMul || 1),
    aiDirectorDriftMul: Number(st.aiDirector?.driftMul || 1),
    aiDirectorKnockMul: Number(st.aiDirector?.knockMul || 1)
  };

  try{ logger && logger.finish(summary); }catch(e){}
  try{ st.hhaEvents && st.hhaEvents.push('session_summary', summary); }catch(e){}
  try{ st.hhaEvents && st.hhaEvents.flush('stop_game_final'); }catch(e){}
  try{ appendSessionRow(buildSessionRow(summary, endedBy)); }catch(e){}
  try{ saveLastSummary(summary); }catch(e){}
  try{ recordSessionToDashboard('balance-hold', summary); }catch(e){}
  try{ updateLocalDailyMissions(summary); }catch(e){}

  clearAllPendingTimers();

  autoPausedBySystem = false;
  if (hudStatus) hudStatus.textContent = 'Finished';
  if (btnPause) btnPause.classList.remove('hidden');
  if (btnResume) btnResume.classList.add('hidden');

  if (cvrCrosshairEl){
    cvrCrosshairEl.style.opacity = '';
    cvrCrosshairEl.style.transform = 'translate(-50%,-50%)';
  }

  fillResultView(endedBy, summary);

  state = null;
  showView('result');
  safeSetTimeout(()=> openEndModal(summary), 120);

  isStoppingNow = false;
}

/* ------------------------------------------------------------
 * AI tip summary
 * ------------------------------------------------------------ */
function buildAiTipSummary(st){
  if (!st || !st.aiDirector) return '-';
  if (st.aiDirector.locked) return 'Research lock (observe-only)';
  const h = st.aiDirector.history || [];
  if (!h.length) return 'Adaptive (no adjustments yet)';
  const last = h[h.length-1];
  return `Adaptive: rate ${last.appliedRate ?? st.aiDirector.rateMul}, drift ${last.appliedDrift ?? st.aiDirector.driftMul}`;
}

/* ------------------------------------------------------------
 * Main loop
 * ------------------------------------------------------------ */
function loop(now){
  if (!state) return;
  if (state.isPaused){
    rafId = requestAnimationFrame(loop);
    return;
  }

  const dt = now - state.lastFrame;
  state.lastFrame = now;

  // Phase step (warmup/practice -> main)
  stepPhaseFlow(now);
  if (!state) return;

  // main elapsed only when in main phase
  if (state.phaseName === 'main'){
    if (!state.mainStartedAt){
      state.mainStartedAt = now;
      state.startTime = now;
      state.nextSampleAt = now + state.sampleEveryMs;
      state.nextObstacleAt = now + randomBetweenWithRng(state.cfg.disturbMinMs, state.cfg.disturbMaxMs, state.rand);
    }
    state.elapsed = now - state.mainStartedAt;
  }else{
    state.elapsed = 0;
  }

  // Remaining time HUD (show main time target)
  let remainMs;
  if (state.phaseName === 'main'){
    remainMs = Math.max(0, state.durationMs - state.elapsed);
  }else{
    remainMs = Math.max(0, state.phaseEndAt - now);
  }
  if (hudTime) hudTime.textContent = (remainMs/1000).toFixed(1);

  // End condition (main phase timeout)
  if (state.phaseName === 'main' && state.elapsed >= state.durationMs){
    stopGame('timeout');
    return;
  }

  // Boss window in main
  if (state.phaseName === 'main' && BOSS_CFG.enabled){
    const ratio = state.elapsed / state.durationMs;
    state.bossActive = ratio >= BOSS_CFG.startAtRatio && ratio <= BOSS_CFG.endAtRatio;
  }else{
    state.bossActive = false;
  }

  // Physics: move angle toward target + passive drift
  const cfg = state.cfg;
  const lerp = 0.11;
  const rr = state.rand || Math.random;

  const presetDriftMul = state.scenarioPreset?.driftMul || 1;
  const bossDriftMul = state.bossActive ? BOSS_CFG.driftMul : 1;
  const aiDriftMul = state.aiDirector?.driftMul || 1;
  const driftMul = presetDriftMul * bossDriftMul * aiDriftMul;

  const driftDir = ((rr() < 0.5) ? -1 : 1) * cfg.passiveDrift * driftMul * (dt/1000);
  const target = state.targetAngle + driftDir;
  state.angle += (target - state.angle) * lerp;

  state.angle = clamp(state.angle, -1.2, 1.2);
  state.targetAngle = clamp(state.targetAngle, -1, 1);

  updateVisuals();

  // Sampling & score only in main/practice (skip warmup analytics if wanted)
  const scoreEnabled = (state.phaseName === 'main');
  const analyticsEnabled = (state.phaseName === 'main');

  if (analyticsEnabled && now >= state.nextSampleAt){
    const safeHalf = cfg.safeHalf;
    const inSafe = Math.abs(state.angle) <= safeHalf;

    state.totalSamples++;
    if (inSafe) state.stableSamples++;
    const absTilt = Math.abs(state.angle);
    state.sumTiltAbs += absTilt;
    state.sumTiltSq  += absTilt * absTilt;
    state.meanTilt = state.totalSamples ? (state.sumTiltAbs / state.totalSamples) : 0;

    const tNorm = state.durationMs > 0 ? (state.elapsed / state.durationMs) : 0;
    state.samples.push({ tNorm, tilt: absTilt });
    if (state.samples.length > 5000) state.samples.splice(0, state.samples.length - 5000);

    logger && logger.logSample({
      tilt: state.angle.toFixed(4),
      targetTilt: state.targetAngle.toFixed(4),
      inSafe: inSafe ? 1 : 0
    });

    if (scoreEnabled && inSafe){
      state.score += SCORE_CFG.sampleSafeScore;
    }

    state.nextSampleAt = now + state.sampleEveryMs;

    const stabRatio = state.totalSamples ? state.stableSamples / state.totalSamples : 0;
    if (hudStab) hudStab.textContent = fmtPercent(stabRatio);

    if (isFxEnabled('hudStabilityVisual') && stabilityFillEl){
      stabilityFillEl.style.width = `${clamp(stabRatio*100,0,100)}%`;
    }
    if (isFxEnabled('hudStabilityVisual') && centerPulseEl){
      const inSafeNow = Math.abs(state.angle) <= state.cfg.safeHalf;
      centerPulseEl.classList.toggle('good', !!inSafeNow);
    }

    if (hudScore) hudScore.textContent = String(Math.round(state.score || 0));
    if (hudCombo) hudCombo.textContent = String(state.combo || 0);

    updateCoach();
    aiDirectorEvaluate(now);
  }

  // Obstacles in practice/main (practice counts but can be lighter via no score? we keep no score in practice)
  if ((state.phaseName === 'practice' || state.phaseName === 'main') && now >= state.nextObstacleAt){
    spawnObstacle(now);
  }

  // cVR crosshair polish
  if (cvrCrosshairEl && ((elViewMode?.value || qs('view','pc')) === 'cvr')){
    const nearCenter = Math.abs(state.angle) <= Math.max(0.08, state.cfg.safeHalf * 0.45);
    cvrCrosshairEl.style.opacity = nearCenter ? '1' : '0.72';
    cvrCrosshairEl.style.transform = `translate(-50%,-50%) scale(${nearCenter ? 1.04 : 1})`;
  }

  rafId = requestAnimationFrame(loop);
}

/* ------------------------------------------------------------
 * Visuals
 * ------------------------------------------------------------ */
function updateVisuals(){
  if (!platformEl || !indicatorEl || !state) return;
  const maxDeg = 16;
  const angleDeg = state.angle * maxDeg;
  platformEl.style.transform = `rotate(${angleDeg}deg)`;

  const wrapRect = platformWrap?.getBoundingClientRect();
  if (wrapRect){
    const halfW = wrapRect.width * 0.34;
    const x = state.angle * halfW;
    indicatorEl.style.transform = `translateX(${x}px) translateY(-18px)`;
  }
  if (hudObs){
    hudObs.textContent = `${state.obstaclesAvoided} / ${state.obstaclesTotal}`;
  }
}

/* ------------------------------------------------------------
 * Obstacles + scoring
 * ------------------------------------------------------------ */
function spawnObstacle(nowPerf){
  if (!state || !obstacleLayer) return;
  const cfg = state.cfg;
  const id = state.obstacleSeq++;
  state.obstaclesTotal++;

  const rr = state.rand || Math.random;
  const kind = pickWeightedObstacleKind(rr, state.obstacleManifestKey, !!state.bossActive);
  const emoji = kind === 'gust' ? '💨' : '💣';

  const span = document.createElement('div');
  span.className = 'obstacle';
  span.textContent = emoji;

  const wrapRect = playArea?.getBoundingClientRect();
  let xNorm = pickObstacleXNorm(rr, state.obstacleManifestKey);
  const pxX = wrapRect ? (wrapRect.width/2 + xNorm*(wrapRect.width*0.32)) : 0;

  span.style.left = pxX + 'px';
  obstacleLayer.appendChild(span);

  if (isFxEnabled('obstacleTelegraph')){
    span.classList.add('telegraph');
    safeSetTimeout(()=>{ try{ span.classList.remove('telegraph'); }catch(e){} }, 280);
  }

  const rmTimer = safeSetTimeout(()=>{
    pendingObstacleTimers.delete(rmTimer);
    try{ span.remove(); }catch(e){}
  }, 1300);
  pendingObstacleTimers.add(rmTimer);

  const impactAt = nowPerf + 950;
  const impactTimer = safeSetTimeout(()=>{
    pendingObstacleTimers.delete(impactTimer);
    if (!state || isStoppingNow) return;
    if (!document.body.contains(span)) return;

    const safeHalf = cfg.safeHalf;
    const absTilt = Math.abs(state.angle);
    const inSafe = absTilt <= safeHalf;
    // perfect = tighter inner window
    const perfectWindow = Math.max(0.06, safeHalf * 0.42);
    const perfect = inSafe && absTilt <= perfectWindow;

    if (inSafe){
      span.classList.add('avoid');
      state.obstaclesAvoided++;
      if (state.bossActive) state.bossWaveAvoids++;

      // score/combo only in main
      if (state.phaseName === 'main'){
        state.combo = clamp((state.combo || 0) + SCORE_CFG.comboStep, 0, SCORE_CFG.comboMax);
        state.maxCombo = Math.max(state.maxCombo || 0, state.combo || 0);
        state.score += SCORE_CFG.avoidScore + Math.min(20, (state.combo || 0) * 2);

        if (perfect){
          state.perfectAvoids++;
          state.score += SCORE_CFG.perfectBonus;
          spawnFloatFx('+PERFECT', 'gold');
          tryBeep(760, 0.05, 'triangle', 0.02);
        }else{
          spawnFloatFx('+AVOID', 'good');
          tryBeep(620, 0.04, 'triangle', 0.015);
        }
      }else{
        spawnFloatFx('+AVOID', 'good');
      }
    }else{
      span.classList.add('hit');
      state.obstaclesHit++;
      if (state.bossActive) state.bossWaveHits++;

      if (state.phaseName === 'main'){
        state.combo = 0;
        state.score = Math.max(0, (state.score || 0) - SCORE_CFG.hitPenalty);
      }

      // knock effect
      const presetKnockMul = state.scenarioPreset?.knockMul || 1;
      const bossKnockMul = state.bossActive ? BOSS_CFG.knockMul : 1;
      const aiKnockMul = state.aiDirector?.knockMul || 1;
      const knockMul = presetKnockMul * bossKnockMul * aiKnockMul;

      const knockDir = (state.angle >= 0 ? 1 : -1);
      state.angle += knockDir * cfg.disturbStrength * 0.7 * knockMul;

      spawnFloatFx('-HIT', 'bad');
      hitScreenShake();
      tryBeep(260, 0.06, 'sawtooth', 0.02);
    }

    logger && logger.logObstacle({
      obstacleId: id,
      obstacleResult: inSafe ? (perfect ? 'perfect' : 'avoid') : 'hit',
      tilt: state.angle.toFixed(4),
      inSafe: inSafe ? 1 : 0
    });
    state.hhaEvents && state.hhaEvents.push('obstacle_resolve', {
      obstacleId:id, kind,
      result: inSafe ? (perfect ? 'perfect':'avoid') : 'hit',
      bossActive: state.bossActive ? 1 : 0,
      tilt:+state.angle.toFixed(4)
    });

    if (hudObs) hudObs.textContent = `${state.obstaclesAvoided} / ${state.obstaclesTotal}`;
    if (hudScore) hudScore.textContent = String(Math.round(state.score || 0));
    if (hudCombo) hudCombo.textContent = String(state.combo || 0);
  }, Math.max(0, impactAt - performance.now()));
  pendingObstacleTimers.add(impactTimer);

  // next obstacle
  const presetRateMul = state.scenarioPreset?.obstacleRateMul || 1;
  const aiRateMul = state.aiDirector?.rateMul || 1;
  const baseMin = cfg.disturbMinMs * presetRateMul * aiRateMul;
  const baseMax = cfg.disturbMaxMs * presetRateMul * aiRateMul;
  state.nextObstacleAt = nowPerf + randomBetweenWithRng(baseMin, baseMax, rr);
}

/* ------------------------------------------------------------
 * Analytics
 * ------------------------------------------------------------ */
function computeAnalytics(){
  if (!state || !state.totalSamples){
    return { stabilityRatio:0, meanTilt:0, rmsTilt:0, fatigueIndex:0, samples:0 };
  }
  const n = state.totalSamples;
  const stabRatio = state.stableSamples / n;
  const meanTilt  = state.sumTiltAbs / n;
  const rmsTilt   = Math.sqrt(state.sumTiltSq / n);

  let fatigue = 0;
  if (state.samples.length >= 8){
    const arr = state.samples;
    const seg = Math.max(2, Math.floor(arr.length * 0.25));
    const early = arr.slice(0, seg);
    const late  = arr.slice(-seg);
    const mE = early.reduce((a,b)=>a+b.tilt,0)/early.length;
    const mL = late.reduce((a,b)=>a+b.tilt,0)/late.length;
    if (mE > 0) fatigue = (mL - mE) / mE;
  }
  return { stabilityRatio:stabRatio, meanTilt, rmsTilt, fatigueIndex:fatigue, samples:n };
}

/* ------------------------------------------------------------
 * Result filling
 * ------------------------------------------------------------ */
function mapEndReason(code){
  switch(code){
    case 'timeout': return 'ครบเวลาที่กำหนด / Timeout';
    case 'manual':  return 'หยุดเอง / Stopped by player';
    default:        return code || '-';
  }
}
function fillResultView(endedBy, summary){
  const modeLabel = summary.mode === 'research' ? 'Research' : 'Play';

  if (resMode) resMode.textContent = modeLabel;
  if (resDiff) resDiff.textContent = summary.difficulty || '-';
  if (resDur)  resDur.textContent  = String(summary.durationSec || '-');
  if (resEnd)  resEnd.textContent  = mapEndReason(endedBy);

  if (resStab)     resStab.textContent = fmtPercent(summary.stabilityRatio || 0);
  if (resMeanTilt) resMeanTilt.textContent = fmtFloat(summary.meanTilt || 0, 3);
  if (resRmsTilt)  resRmsTilt.textContent = fmtFloat(summary.rmsTilt || 0, 3);
  if (resAvoid)    resAvoid.textContent = String(summary.obstaclesAvoided || 0);
  if (resHit)      resHit.textContent = String(summary.obstaclesHit || 0);

  const totalObs = (summary.obstaclesAvoided||0) + (summary.obstaclesHit||0);
  const avoidRate = totalObs ? (summary.obstaclesAvoided / totalObs) : 0;
  if (resAvoidRate) resAvoidRate.textContent = fmtPercent(avoidRate);
  if (resFatigue)   resFatigue.textContent = fmtFloat(summary.fatigueIndex || 0, 3);
  if (resSamples)   resSamples.textContent = String(summary.samples || 0);

  if (resAiTipEl) resAiTipEl.textContent = String(summary.aiTip || '-');
  if (resRankEl) resRankEl.textContent = String(summary.rank || 'D');

  if (resScoreEl) animateCountText(resScoreEl, Number(summary.score || 0), 800);
  if (resMaxComboEl) animateCountText(resMaxComboEl, Number(summary.maxCombo || 0), 550);
  if (resPerfectEl) animateCountText(resPerfectEl, Number(summary.perfectAvoids || 0), 500);
  if (resDaily) resDaily.textContent = getTodayMissionProgressText();

  // Hero summary polish
  if (rankBadgeEl){
    const rank = String(summary.rank || 'D');
    rankBadgeEl.textContent = rank;
    rankBadgeEl.classList.remove('rank-S','rank-A','rank-B','rank-C','rank-D');
    rankBadgeEl.classList.add(`rank-${rank}`);
    animateRankReveal(rank);
  }
  if (resultHeroSub){
    resultHeroSub.textContent = `Score ${summary.score ?? 0} • Stability ${fmtPercent(summary.stabilityRatio ?? 0)} • Avoid ${fmtPercent(avoidRate)}`;
  }

  renderMiniBadges(summary);
  renderMissionChips(summary);
  if (heroInsightEl) heroInsightEl.textContent = buildResultInsight(summary);
}

/* ------------------------------------------------------------
 * Input handling
 * ------------------------------------------------------------ */
function attachInput(){
  if (!playArea) return;
  let active = false;

  function updateTargetFromEvent(ev){
    if (!state) return;
    const rect = playArea.getBoundingClientRect();
    const x = ev.clientX ?? (ev.touches && ev.touches[0]?.clientX);
    if (x == null) return;

    const relX = (x - rect.left) / rect.width; // 0..1
    let norm = (relX - 0.5) * 2; // -1..1

    const p = getInputProfile();
    if (Math.abs(norm) < p.deadzone) norm = 0;
    norm = clamp(norm, -p.maxTarget, p.maxTarget);

    const isCvr = ((elViewMode?.value || qs('view','pc')) === 'cvr');
    if (isCvr){
      norm = clamp(norm + Number(cvrState.calibrationOffset || 0), -p.maxTarget, p.maxTarget);
      if (cvrState.strict) norm = norm * 0.78;
    }

    const curr = Number(state.targetAngle || 0);
    state.targetAngle = curr + (norm - curr) * p.smoothing;
  }

  playArea.addEventListener('pointerdown', ev=>{
    active = true;
    if (state) state.inputActive = true;
    try{ playArea.setPointerCapture(ev.pointerId); }catch(e){}
    updateTargetFromEvent(ev);
    ev.preventDefault();
  }, { passive:false });

  playArea.addEventListener('pointermove', ev=>{
    if (!active) return;
    updateTargetFromEvent(ev);
    ev.preventDefault();
  }, { passive:false });

  playArea.addEventListener('pointerup', ev=>{
    active = false;
    if (state) state.inputActive = false;
    try{ playArea.releasePointerCapture(ev.pointerId); }catch(e){}
    ev.preventDefault();
  }, { passive:false });

  playArea.addEventListener('pointercancel', ev=>{
    active = false;
    if (state) state.inputActive = false;
    ev.preventDefault();
  }, { passive:false });
}

/* ------------------------------------------------------------
 * Query contract / replay manifest
 * ------------------------------------------------------------ */
function getQueryContractSnapshot(){
  return {
    run: qs('run','play'),
    diff: qs('diff','normal'),
    time: qn('time', 60),
    seed: qs('seed',''),
    preset: qs('preset','A'),
    omap: qs('omap',''),
    warmup: qn('warmup', FLOW_CFG.warmupSecDefault),
    practice: qn('practice', FLOW_CFG.practiceSecDefault),
    practiceOn: parseBoolLike(qs('practiceOn','1'), true) ? 1 : 0,
    pid: qs('pid',''),
    group: qs('group',''),
    phase: qs('phase',''),
    studyId: qs('studyId',''),
    conditionGroup: qs('conditionGroup',''),
    hub: qs('hub',''),
    log: qs('log',''),
    view: qs('view','pc'),
    tutorial: qs('tutorial',''),
    fx: qs('fx','')
  };
}
function buildReplayManifest(summary){
  return {
    gameId: 'balance-hold',
    exportedAt: nowMs(),
    summary: summary || null,
    queryContract: getQueryContractSnapshot()
  };
}

/* ------------------------------------------------------------
 * Result action helpers
 * ------------------------------------------------------------ */
function goBackHubOrMenu(reason='back_hub'){
  const hubUrl = qs('hub','');
  try{ state?.hhaEvents?.flush(reason); }catch(e){}
  if (hubUrl){
    location.href = hubUrl;
  }else{
    closeEndModal();
    showView('menu');
  }
}
function retryToMenu(){
  closeEndModal();
  showView('menu');
}

/* ------------------------------------------------------------
 * cVR external event compatibility
 * ------------------------------------------------------------ */
function attachHhaBridgeEvents(){
  window.addEventListener('hha:shoot', ()=>{
    const isCvr = ((elViewMode?.value || qs('view','pc')) === 'cvr');
    if (!isCvr || !state) return;
    const strength = cvrState.strict ? 0.22 : 0.32;
    state.targetAngle = state.targetAngle + (0 - state.targetAngle) * strength;
    pushCoachMessage('cVR tap: center correction', { ttlMs:900, minGapMs:500 });
    state.hhaEvents && state.hhaEvents.push('cvr_shoot_center_correction', {
      strict: cvrState.strict ? 1 : 0,
      targetAngle: Number(state.targetAngle || 0)
    });
  });
  window.addEventListener('hha:recenter', ()=>{
    cvrRecenter();
  });
}

/* ------------------------------------------------------------
 * Init
 * ------------------------------------------------------------ */
function init(){
  if (__boundOnce) return;
  __boundOnce = true;

  syncReducedMotionClass();
  applyViewModeClass(elViewMode?.value || qs('view','pc') || 'pc');

  // Load prefs
  const cvrSaved = loadCvrPrefs();
  cvrState.strict = !!cvrSaved.strict;
  cvrState.calibrationOffset = clamp(Number(cvrSaved.calibrationOffset || 0), -0.25, 0.25);
  refreshCvrUI();

  // Menu actions
  $('[data-action="start-normal"]')?.addEventListener('click', ()=> startPlayFlowWithTutorial('play'));
  $('[data-action="goto-research"]')?.addEventListener('click', ()=> showView('research'));

  $$('[data-action="back-menu"]').forEach(btn=>{
    btn.addEventListener('click', ()=> showView('menu'));
  });

  $('[data-action="start-research"]')?.addEventListener('click', ()=> startGame('research'));

  $('[data-action="stop"]')?.addEventListener('click', ()=>{
    if (state) stopGame('manual');
  });

  btnPause?.addEventListener('click', ()=> pauseGame());
  btnResume?.addEventListener('click', ()=> resumeGame());

  // Unified result actions
  const btnResultPlayAgain = $('[data-action="result-play-again"]');
  const btnResultBackHub   = $('[data-action="result-back-hub"]');

  $('[data-action="play-again"]')?.addEventListener('click', retryToMenu);
  btnResultPlayAgain?.addEventListener('click', retryToMenu);
  btnResultBackHub?.addEventListener('click', ()=> goBackHubOrMenu('result_back_hub'));

  // End modal actions
  $$('[data-action="close-end-modal"]').forEach(btn=>{
    btn.addEventListener('click', ()=> closeEndModal());
  });
  $('[data-action="end-retry"]')?.addEventListener('click', retryToMenu);
  $('[data-action="end-back-hub"]')?.addEventListener('click', ()=> goBackHubOrMenu('end_back_hub'));
  $('[data-action="end-next-mission"]')?.addEventListener('click', ()=>{
    closeEndModal();
    pushCoachMessage('Next Mission: ลองทำ No-Hit Run หรือ Perfect x3 ในรอบถัดไป 🎯', { ttlMs:2800, force:true });
  });

  // Tutorial actions
  $('[data-action="tutorial-skip"]')?.addEventListener('click', ()=>{
    if (tutorialDontShowAgain?.checked) saveTutorialPrefs({ dismissed:true });
    closeTutorialOverlay();
    startGame(tutorialOverlay?.__pendingStartKind || 'play');
  });
  $('[data-action="tutorial-start"]')?.addEventListener('click', ()=>{
    if (tutorialDontShowAgain?.checked) saveTutorialPrefs({ dismissed:true });
    closeTutorialOverlay();
    startGame(tutorialOverlay?.__pendingStartKind || 'play');
  });

  // Export buttons (optional)
  $('[data-action="export-sessions-csv"]')?.addEventListener('click', exportSessionRowsCsv);
  $('[data-action="export-events-csv"]')?.addEventListener('click', exportEventRowsCsv);
  $('[data-action="export-release-debug"]')?.addEventListener('click', exportReleaseBundleDebug);

  // cVR controls
  $('[data-action="cvr-recenter"]')?.addEventListener('click', cvrRecenter);
  $('[data-action="cvr-calibrate-left"]')?.addEventListener('click', ()=> cvrAdjustCalibration(-0.02));
  $('[data-action="cvr-calibrate-right"]')?.addEventListener('click', ()=> cvrAdjustCalibration(+0.02));
  $('[data-action="cvr-toggle-strict"]')?.addEventListener('click', cvrToggleStrict);

  // View mode changes
  elViewMode?.addEventListener('change', ()=>{
    applyViewModeClass(elViewMode.value);
    refreshCvrUI();
    if (elViewMode.value === 'cvr'){
      pushCoachMessage('cVR preview mode: ใช้ Recenter / Calibrate ได้ (ยังไม่เข้า VR จริง)', { ttlMs:2600, force:true });
    }
  });

  // Input / bridge
  attachInput();
  attachHhaBridgeEvents();

  // Buttons micro polish
  document.querySelectorAll('.btn').forEach(btn=>{
    btn.addEventListener('pointerdown', ()=> btn.classList.add('is-pressing'), { passive:true });
    btn.addEventListener('pointerup', ()=> btn.classList.remove('is-pressing'), { passive:true });
    btn.addEventListener('pointercancel', ()=> btn.classList.remove('is-pressing'), { passive:true });
    btn.addEventListener('mouseleave', ()=> btn.classList.remove('is-pressing'), { passive:true });
  });

  // ESC close modal (and optional resume from pause if desired)
  window.addEventListener('keydown', (ev)=>{
    if (ev.key !== 'Escape') return;
    if (isEndModalOpen()){
      closeEndModal();
      ev.preventDefault();
    }
  });

  // Visibility / focus / unload
  window.addEventListener('blur', ()=> autoPauseIfNeeded('blur'));
  window.addEventListener('focus', ()=> maybeResumePrompt());
  document.addEventListener('visibilitychange', ()=>{
    if (document.visibilityState === 'hidden'){
      autoPauseIfNeeded('hidden');
      flushBeforeExit('hidden');
    }else if (document.visibilityState === 'visible'){
      maybeResumePrompt();
    }
  });
  window.addEventListener('pagehide', ()=>{
    autoPauseIfNeeded('pagehide');
    flushBeforeExit('pagehide');
  });
  window.addEventListener('beforeunload', ()=>{
    autoPauseIfNeeded('beforeunload');
    flushBeforeExit('beforeunload');
  });

  showView('menu');
  try{ window.__BH_INIT_DONE = true; }catch(e){}
}

/* ------------------------------------------------------------
 * Future-ready external API (cVR preview)
 * ------------------------------------------------------------ */
window.BalanceHoldVR = {
  version: 'preview-k',
  getState(){
    return {
      running: !!state,
      mode: gameMode,
      viewMode: (elViewMode?.value || qs('view','pc')),
      cvr: {
        enabled: cvrState.enabled,
        strict: cvrState.strict,
        calibrationOffset: cvrState.calibrationOffset
      },
      targetAngle: state ? Number(state.targetAngle || 0) : null,
      angle: state ? Number(state.angle || 0) : null
    };
  },
  recenter: cvrRecenter,
  calibrate(delta){ cvrAdjustCalibration(Number(delta || 0)); },
  setStrict(v){
    cvrState.strict = !!v;
    saveCvrPrefs();
    refreshCvrUI();
  },
  centerTap(){
    try{
      window.dispatchEvent(new CustomEvent('hha:shoot', { detail:{ source:'BalanceHoldVR.centerTap' } }));
    }catch(e){}
  }
};

/* ------------------------------------------------------------
 * Boot
 * ------------------------------------------------------------ */
window.addEventListener('DOMContentLoaded', init);