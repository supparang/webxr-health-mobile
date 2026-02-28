// === /fitness/js/balance-hold.js ===
// Balance Hold — DOM-based Balance Platform + Obstacle Avoidance
// FULL BUILD (T) — includes A–S:
// ✅ URL prefill (diff/time/run/view/pid/group/phase)
// ✅ view mode classes (pc/mobile/cvr)
// ✅ practice + countdown phases (practiceOn/practice)
// ✅ deterministic seeded RNG (seed / research-safe repeatable)
// ✅ warmup passthrough buffs (wType/wPct/rank/wCrit/wDmg/wHeal)
// ✅ scoring + combo + perfect
// ✅ pause/resume/stop
// ✅ result hero + rank + insight + badges/missions (basic)
// ✅ tutorial overlay + end modal (optional IDs)
// ✅ back HUB + return summary query (lastGame/lastScore/lastRank/lastStab)
// ✅ local exports (sessions CSV, debug JSON) — light + safe
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
function clamp(v, a, b){ v = Number(v); if(!Number.isFinite(v)) v = a; return Math.max(a, Math.min(b, v)); }
function fmtPercent(v){ v = Number(v); if(!Number.isFinite(v)) return '-'; return (v*100).toFixed(1)+'%'; }
function fmtFloat(v, d=3){ v = Number(v); if(!Number.isFinite(v)) return '-'; return v.toFixed(d); }

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
  if (name==='menu')     viewMenu && viewMenu.classList.remove('hidden');
  if (name==='research') viewResearch && viewResearch.classList.remove('hidden');
  if (name==='play')     viewPlay && viewPlay.classList.remove('hidden');
  if (name==='result')   viewResult && viewResult.classList.remove('hidden');
}
function applyViewModeClass(mode){
  document.body.classList.remove('view-pc','view-mobile','view-cvr');
  const m = (mode === 'mobile' || mode === 'cvr') ? mode : 'pc';
  document.body.classList.add('view-' + m);

  const cvr = $('#cvrOverlay');
  if (cvr) cvr.classList.toggle('hidden', m !== 'cvr');
}

/* ------------------------------------------------------------
 * DOM refs (core)
 * ------------------------------------------------------------ */
const elDiffSel = $('#difficulty');
const elDurSel  = $('#sessionDuration');
const elViewSel = $('#viewMode');

const hudMode   = $('#hud-mode');
const hudDiff   = $('#hud-diff');
const hudDur    = $('#hud-dur');
const hudTime   = $('#hud-time');
const hudStab   = $('#hud-stability');
const hudObsA   = $('#hud-obstacles'); // legacy
const hudObsB   = $('#hud-obs');       // patch-U
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

/* result refs (optional but recommended) */
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

/* overlays (optional) */
const tutorialOverlay = $('#tutorialOverlay');
const tutorialDontShowAgain = $('#tutorialDontShowAgain');
const endModal = $('#endModal');
const endModalRank = $('#endModalRank');
const endModalScore= $('#endModalScore');
const endModalInsight = $('#endModalInsight');

/* cVR label (optional) */
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

function mapEndReason(code){
  switch(code){
    case 'timeout': return 'ครบเวลาที่กำหนด / Timeout';
    case 'manual':  return 'หยุดเอง / Stopped by player';
    default:        return code || '-';
  }
}

/* ------------------------------------------------------------
 * Warmup passthrough buffs
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
 * Prefill UI from URL
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

  // research fields
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
 * FX helpers (simple)
 * ------------------------------------------------------------ */
function fxEnabled(){ return String(qv('fx','1')) !== '0'; }
function spawnFloatFx(text, kind, pxX, pxY){
  if (!fxEnabled() || !playArea) return;
  const el = document.createElement('div');
  el.className = `fx-float ${kind||''}`;
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
 * Input
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
    let norm = (relX - 0.5) * 2;               // -1..1

    // input profile
    const view = (elViewSel?.value || qv('view','pc')).toLowerCase();
    const p = (view === 'mobile') ? { deadzone:0.04, smoothing:0.22, maxTarget:0.95 }
            : (view === 'cvr')    ? { deadzone:0.06, smoothing:0.18, maxTarget:0.85 }
            :                      { deadzone:0.02, smoothing:0.35, maxTarget:1.00 };

    if (Math.abs(norm) < p.deadzone) norm = 0;
    norm = clamp(norm, -p.maxTarget, p.maxTarget);

    // apply simple cVR strict hint (if label exists + ON)
    const isCvr = view === 'cvr';
    if (isCvr && cvrStrictLabel && String(cvrStrictLabel.textContent||'OFF').toUpperCase() === 'ON'){
      norm *= 0.78;
    }

    const curr = Number(state.targetAngle || 0);
    state.targetAngle = curr + (norm - curr) * p.smoothing;
  }

  playArea.addEventListener('pointerdown', ev=>{
    active = true;
    try{ playArea.setPointerCapture(ev.pointerId); }catch(e){}
    updateTargetFromEvent(ev);
    ev.preventDefault();
  }, {passive:false});

  playArea.addEventListener('pointermove', ev=>{
    if (!active) return;
    updateTargetFromEvent(ev);
    ev.preventDefault();
  }, {passive:false});

  playArea.addEventListener('pointerup', ev=>{
    active = false;
    try{ playArea.releasePointerCapture(ev.pointerId); }catch(e){}
    ev.preventDefault();
  }, {passive:false});

  playArea.addEventListener('pointercancel', ev=>{
    active = false;
    ev.preventDefault();
  }, {passive:false});
}

/* ------------------------------------------------------------
 * Game State
 * ------------------------------------------------------------ */
let gameMode = 'play';
let state = null;
let rafId = null;

let isPaused = false;
let pausedAt = 0;

let tutorialAccepted = false;

/* session rows local */
const SESS_KEY = 'vrfit_sessions_balance-hold';

function recordSessionToLocal(summary){
  try{
    const arr = JSON.parse(localStorage.getItem(SESS_KEY) || '[]');
    arr.push({ ...summary, ts: Date.now() });
    localStorage.setItem(SESS_KEY, JSON.stringify(arr));
  }catch(e){}
}

/* ------------------------------------------------------------
 * RNG helpers
 * ------------------------------------------------------------ */
function rand01(){
  return (state && typeof state.rand === 'function') ? state.rand() : Math.random();
}
function randomBetween(a,b){
  const r = rand01();
  return a + r*(b-a);
}

/* ------------------------------------------------------------
 * Practice / Countdown phases (S)
 * ------------------------------------------------------------ */
function resetMotionForNewPhase(){
  if (!state) return;
  state.angle = 0;
  state.targetAngle = 0;
  state.lastFrame = performance.now();
  if (obstacleLayer) obstacleLayer.innerHTML = '';
}
function beginPracticePhase(now){
  if (!state) return;
  state.phase = 'practice';
  state.phaseLabel = 'Practice';
  state.practiceStartedAt = now;
  state.nextObstacleAt = now + randomBetween(state.cfg.disturbMinMs, state.cfg.disturbMaxMs);
  setText(hudStatus, 'Practice');
  setText(hudPhase, `Practice ${Math.round(state.practiceDurationMs/1000)}s • seed:${String(state.seedStr||'').slice(0,10)}`);
  resetMotionForNewPhase();
}
function beginMainPhase(now){
  if (!state) return;
  state.phase = 'main';
  state.phaseLabel = 'Main';

  // reset MAIN metrics (critical)
  state.startTime = now;
  state.elapsed = 0;
  state.lastFrame = now;
  state.nextSampleAt = now + state.sampleEveryMs;
  state.nextObstacleAt = now + randomBetween(state.cfg.disturbMinMs, state.cfg.disturbMaxMs);

  state.totalSamples = 0;
  state.stableSamples = 0;
  state.sumTiltAbs = 0;
  state.sumTiltSq  = 0;
  state.samples = [];

  state.obstaclesTotal = 0;
  state.obstaclesAvoided = 0;
  state.obstaclesHit = 0;

  state.score = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.perfects = 0;

  const wu = state.warmup || {};
  if (wu && (wu.wType || wu.wPct)){
    setText(hudStatus, `Playing • ${wu.wType || 'buff'} +${wu.wPct||0}%`);
  }else{
    setText(hudStatus, 'Playing');
  }
  setText(hudPhase, `Main • seed:${String(state.seedStr||'').slice(0,10)}`);
  setText(hudScore, '0'); setText(hudCombo, '0');
  setText(hudStab, '0%');
  if (hudObsA) setText(hudObsA, '0 / 0');
  if (hudObsB) setText(hudObsB, '0 / 0');
  if (stabilityFill) stabilityFill.style.width = '0%';
  if (centerPulse) centerPulse.classList.remove('good');

  resetMotionForNewPhase();
}
function runCountdownPhase(now){
  if (!state) return false;
  const elapsed = now - state.countdownStartedAt;
  const remain = Math.max(0, state.countdownMs - elapsed);
  const sec = remain / 1000;

  setText(hudTime, sec.toFixed(1));
  setText(hudStatus, 'Get Ready');
  setText(hudPhase, `Countdown • seed:${String(state.seedStr||'').slice(0,10)}`);

  if (coachBubble){
    const n = Math.ceil(sec);
    coachBubble.textContent = (n > 0) ? `เริ่มใน ${n}... / Starting in ${n}...` : 'ไปเลย! / Go!';
    coachBubble.classList.remove('hidden');
  }

  updateVisuals();

  if (remain <= 0){
    if (coachBubble) coachBubble.classList.add('hidden');
    if (state.practiceEnabled && !state.practiceEnded){
      beginPracticePhase(now);
    }else{
      beginMainPhase(now);
    }
  }
  return true;
}
function runPracticePhase(now){
  if (!state) return false;
  const pe = now - state.practiceStartedAt;
  const remain = Math.max(0, state.practiceDurationMs - pe);
  setText(hudTime, (remain/1000).toFixed(1));

  if (remain <= 0){
    state.practiceEnded = true;
    state.phase = 'countdown';
    state.phaseLabel = 'Countdown';
    state.countdownMs = 2000;
    state.countdownStartedAt = now;
    setText(hudStatus, 'Practice Complete');
    setText(hudPhase, `Countdown to Main • seed:${String(state.seedStr||'').slice(0,10)}`);
    if (coachBubble){
      coachBubble.textContent = 'ซ้อมเสร็จแล้ว! เตรียมเข้าสู่รอบจริง / Practice complete! Main round starts...';
      coachBubble.classList.remove('hidden');
      setTimeout(()=> coachBubble && coachBubble.classList.add('hidden'), 1200);
    }
    resetMotionForNewPhase();
    return true;
  }
  return false;
}

/* ------------------------------------------------------------
 * Start / Pause / Resume / Stop
 * ------------------------------------------------------------ */
function buildSessionMeta(diffKey, durSec){
  let playerId='anon', group='', phase='';
  if (gameMode === 'research'){
    playerId = ($('#researchId')?.value.trim()) || qv('pid','anon') || 'anon';
    group    = ($('#researchGroup')?.value.trim()) || qv('group','') || '';
    phase    = ($('#researchPhase')?.value.trim()) || qv('phase','') || '';
  }else{
    playerId = qv('pid','anon') || 'anon';
    group    = qv('group','') || '';
    phase    = qv('phase','') || '';
  }
  return { mode: gameMode, difficulty: diffKey, durationSec: durSec, playerId, group, phase };
}

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

function startGame(kind){
  gameMode = (kind==='research' ? 'research' : 'play');

  const diffKey = (elDiffSel?.value || qv('diff','normal') || 'normal').toLowerCase();
  const durSec  = parseInt(elDurSel?.value || qv('time','60') || '60', 10) || 60;
  const cfg     = pickDiff(diffKey);

  // warmup buffs
  const warmup = readWarmupBuff();

  // seed + rng
  const meta = buildSessionMeta(diffKey, durSec);
  const seedStr = buildSeedString(meta);
  const rng = makeRng(seedStr);

  const now = performance.now();
  state = {
    diffKey, cfg,
    durationMs: durSec*1000,
    startTime: now,
    elapsed: 0,
    lastFrame: now,

    // motion
    angle: 0,
    targetAngle: 0,

    // sampling (main only)
    sampleEveryMs: 120,
    nextSampleAt: now + 120,
    totalSamples: 0,
    stableSamples: 0,
    sumTiltAbs: 0,
    sumTiltSq: 0,
    samples: [],

    // obstacles
    nextObstacleAt: now + randomBetween(cfg.disturbMinMs, cfg.disturbMaxMs),
    obstacleSeq: 1,
    obstaclesTotal: 0,
    obstaclesAvoided: 0,
    obstaclesHit: 0,

    // practice metrics
    practiceEnabled: false,
    practiceDurationMs: 0,
    practiceStartedAt: 0,
    practiceEnded: false,
    practiceSamples: 0,
    practiceStableSamples: 0,
    practiceObstaclesTotal: 0,
    practiceObstaclesAvoided: 0,
    practiceObstaclesHit: 0,
    practiceScore: 0,

    // scoring
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfects: 0,

    // fatigue
    fatigueIndex: 0,

    // deterministic & buffs
    seedStr,
    rand: rng,
    warmup,

    // phase
    phase: 'main',
    phaseLabel: 'Main',
    countdownMs: 0,
    countdownStartedAt: 0
  };

  // UI basics
  setText(hudMode, gameMode === 'research' ? 'Research' : 'Play');
  setText(hudDiff, diffKey);
  setText(hudDur, String(durSec));
  setText(hudTime, durSec.toFixed(1));
  setText(hudStab, '0%');
  if (hudObsA) setText(hudObsA, '0 / 0');
  if (hudObsB) setText(hudObsB, '0 / 0');
  setText(hudScore, '0');
  setText(hudCombo, '0');

  // view mode
  applyViewModeClass(elViewSel?.value || qv('view','pc'));

  // safe zone visual width hint (optional element)
  const safeInner = $('.safe-zone-inner');
  if (safeInner){
    const pct = Math.max(14, Math.min(75, cfg.safeHalf * 100));
    safeInner.style.width = `${pct}%`;
  }

  // reset overlays
  closeEndModal();
  closeTutorial();

  // reset fx/hud bars
  if (stabilityFill) stabilityFill.style.width = '0%';
  if (centerPulse) centerPulse.classList.remove('good');

  // reset obstacles layer
  if (obstacleLayer) obstacleLayer.innerHTML = '';

  // set label
  if (coachLabel){
    coachLabel.textContent = 'จับ/แตะแล้วเลื่อนไปซ้าย–ขวาเพื่อรักษาสมดุล / Drag left–right to balance';
  }
  if (coachBubble) coachBubble.classList.add('hidden');

  // Practice setup (S)
  const practiceOn = parseBoolLike(qv('practiceOn', qv('practice','0') !== '0' ? '1':'0'), true);
  const practiceSec = clampNum(qv('practice','15'), 0, 60, 15);

  if (practiceOn && practiceSec > 0){
    state.practiceEnabled = true;
    state.practiceDurationMs = practiceSec * 1000;
    state.phase = 'countdown';
    state.phaseLabel = 'Countdown';
    state.countdownMs = 3000;
    state.countdownStartedAt = now;
    setText(hudStatus, 'Get Ready');
    setText(hudPhase, `Countdown • seed:${String(seedStr).slice(0,10)}`);
  }else{
    state.phase = 'main';
    state.phaseLabel = 'Main';
    setText(hudStatus, warmup && (warmup.wType || warmup.wPct) ? `Playing • ${warmup.wType || 'buff'} +${warmup.wPct||0}%` : 'Playing');
    setText(hudPhase, `Main • seed:${String(seedStr).slice(0,10)}`);
    beginMainPhase(now);
  }

  // pause state
  isPaused = false;
  pausedAt = 0;
  $('[data-action="pause"]')?.classList.remove('hidden');
  $('[data-action="resume"]')?.classList.add('hidden');

  // start RAF
  if (rafId != null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);

  showView('play');
}

function pauseGame(){
  if (!state || isPaused) return;
  isPaused = true;
  pausedAt = performance.now();
  if (rafId != null){ cancelAnimationFrame(rafId); rafId = null; }
  setText(hudStatus, 'Paused');
  $('[data-action="pause"]')?.classList.add('hidden');
  $('[data-action="resume"]')?.classList.remove('hidden');
}

function resumeGame(){
  if (!state || !isPaused) return;
  const now = performance.now();
  const pausedMs = Math.max(0, now - pausedAt);
  isPaused = false;

  // shift anchors forward
  state.startTime += pausedMs;
  state.lastFrame = now;
  state.nextSampleAt += pausedMs;
  state.nextObstacleAt += pausedMs;
  state.countdownStartedAt += pausedMs;
  state.practiceStartedAt += pausedMs;

  setText(hudStatus, state.phase === 'practice' ? 'Practice' : 'Playing');
  $('[data-action="pause"]')?.classList.remove('hidden');
  $('[data-action="resume"]')?.classList.add('hidden');

  if (rafId != null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

/* ------------------------------------------------------------
 * Physics + visuals
 * ------------------------------------------------------------ */
function updateVisuals(){
  if (!state) return;

  // platform rotation
  if (platformEl){
    const maxDeg = 16;
    const angleDeg = state.angle * maxDeg;
    platformEl.style.transform = `rotate(${angleDeg}deg)`;
  }

  // indicator position
  if (indicatorEl && platformWrap){
    const wrapRect = platformWrap.getBoundingClientRect();
    const halfW = wrapRect.width * 0.34;
    const x = state.angle * halfW;
    indicatorEl.style.transform = `translateX(${x}px) translateY(-18px)`;
  }

  // HUD obstacles
  if (state.phase === 'practice'){
    const a = state.practiceObstaclesAvoided || 0;
    const t = state.practiceObstaclesTotal || 0;
    if (hudObsA) setText(hudObsA, `${a} / ${t}`);
    if (hudObsB) setText(hudObsB, `${a} / ${t}`);
  }else{
    if (hudObsA) setText(hudObsA, `${state.obstaclesAvoided} / ${state.obstaclesTotal}`);
    if (hudObsB) setText(hudObsB, `${state.obstaclesAvoided} / ${state.obstaclesTotal}`);
  }
}

/* ------------------------------------------------------------
 * Obstacles
 * ------------------------------------------------------------ */
function spawnObstacle(now){
  if (!state || !obstacleLayer || !playArea) return;
  const cfg = state.cfg;
  const isPractice = state.phase === 'practice';

  const id = state.obstacleSeq++;
  if (isPractice) state.practiceObstaclesTotal++;
  else state.obstaclesTotal++;

  const kind = (rand01() < 0.6) ? 'gust' : 'bomb';
  const emoji = (kind === 'gust') ? '💨' : '💣';

  const span = document.createElement('div');
  span.className = 'obstacle telegraph';
  span.textContent = emoji;

  const wrapRect = playArea.getBoundingClientRect();
  let xNorm = (rand01()*2 - 1); // deterministic by seed
  const pxX = (wrapRect.width/2 + xNorm*(wrapRect.width*0.32));
  span.style.left = pxX + 'px';
  obstacleLayer.appendChild(span);

  setTimeout(()=>{ try{ span.remove(); }catch(e){} }, 1400);

  const impactAt = now + 950;
  setTimeout(()=>{
    if (!state) return;

    const safeHalf = cfg.safeHalf;
    const absTilt = Math.abs(state.angle);
    const inSafe = absTilt <= safeHalf;
    const nearPerfect = absTilt <= Math.max(0.06, safeHalf * 0.28);

    if (isPractice){
      // practice-only feedback (no main score/log)
      if (inSafe){
        state.practiceObstaclesAvoided++;
        state.practiceScore = (state.practiceScore || 0) + (nearPerfect ? 20 : 10);
        spawnFloatFx(nearPerfect ? 'Practice Perfect' : 'Practice Avoid', nearPerfect ? 'gold' : 'good', pxX, (playArea.clientHeight || 300) * 0.55);
        span.classList.add('avoid');
      }else{
        state.practiceObstaclesHit++;
        spawnFloatFx('Practice Hit', 'bad', pxX, (playArea.clientHeight || 300) * 0.55);
        span.classList.add('hit');
        playArea.classList.add('shake-hit');
        setTimeout(()=> playArea.classList.remove('shake-hit'), 240);
      }
      setText(hudScore, `P:${state.practiceScore || 0}`);
      setText(hudCombo, 'P');
      updateVisuals();

      // next obstacle
      state.nextObstacleAt = now + randomBetween(cfg.disturbMinMs, cfg.disturbMaxMs);
      return;
    }

    // MAIN scoring with warmup buffs
    const wu = state.warmup || {};

    if (inSafe){
      span.classList.add('avoid');
      state.obstaclesAvoided++;

      state.combo = (state.combo || 0) + 1;
      state.maxCombo = Math.max(state.maxCombo || 0, state.combo);

      let add = 10 + Math.min(20, (state.combo-1)*2);

      // warmup crit chance may promote to perfect
      let perfectNow = nearPerfect;
      if (!perfectNow && (wu.critBonusChance||0) > 0 && rand01() < wu.critBonusChance){
        perfectNow = true;
      }

      if (perfectNow){
        add += 10;
        state.perfects = (state.perfects || 0) + 1;
      }

      add = Math.round(add * (wu.scoreBoostMul || 1)) + (wu.healOnAvoid || 0);

      state.score = (state.score || 0) + add;

      spawnFloatFx(perfectNow ? `Perfect +${add}` : `Avoid +${add}`, perfectNow ? 'gold' : 'good', pxX, (playArea.clientHeight || 300) * 0.55);
    }else{
      span.classList.add('hit');
      state.obstaclesHit++;

      state.combo = 0;

      const basePenalty = 8;
      const penalty = Math.max(2, Math.round(basePenalty * (wu.dmgReduceMul || 1)));
      state.score = Math.max(0, (state.score || 0) - penalty);

      const knockDir = (state.angle>=0 ? 1 : -1);
      const knockMul = Math.max(0.65, (wu.dmgReduceMul || 1));
      state.angle += knockDir * cfg.disturbStrength * 0.7 * knockMul;

      spawnFloatFx(`Hit -${penalty}`, 'bad', pxX, (playArea.clientHeight || 300) * 0.55);
      playArea.classList.add('shake-hit');
      setTimeout(()=> playArea.classList.remove('shake-hit'), 240);
    }

    setText(hudScore, String(state.score || 0));
    setText(hudCombo, String(state.combo || 0));
    pulseEl(hudScore); pulseEl(hudCombo);

    updateVisuals();

  }, Math.max(0, impactAt - performance.now()));

  // next obstacle (deterministic)
  state.nextObstacleAt = now + randomBetween(cfg.disturbMinMs, cfg.disturbMaxMs);
}

/* ------------------------------------------------------------
 * Analytics
 * ------------------------------------------------------------ */
function computeAnalytics(){
  if (!state) return { stabilityRatio:0, meanTilt:0, rmsTilt:0, fatigueIndex:0, samples:0 };

  const n = state.totalSamples || 0;
  if (!n) return { stabilityRatio:0, meanTilt:0, rmsTilt:0, fatigueIndex:0, samples:0 };

  const stabRatio = state.stableSamples / n;
  const meanTilt  = state.sumTiltAbs / n;
  const rmsTilt   = Math.sqrt(state.sumTiltSq / n);

  // fatigue compare early vs late
  let fatigue = 0;
  if (state.samples && state.samples.length >= 8){
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
 * Ranking / insight / badges
 * ------------------------------------------------------------ */
function calcRank(summary){
  const stab = Number(summary.stabilityRatio || 0);
  const avoidTotal = (summary.obstaclesAvoided||0) + (summary.obstaclesHit||0);
  const avoidRate = avoidTotal ? (summary.obstaclesAvoided/avoidTotal) : 0;
  const fat = Number(summary.fatigueIndex || 0);
  const perfects = Number(summary.perfects || 0);
  const comboMax = Number(summary.comboMax || 0);

  let pts = 0;
  pts += stab * 55;
  pts += avoidRate * 25;
  pts += Math.min(10, perfects);
  pts += Math.min(10, comboMax * 0.7);
  if (fat > 0.35) pts -= 8;
  if (fat > 0.60) pts -= 8;

  if (pts >= 85) return 'S';
  if (pts >= 70) return 'A';
  if (pts >= 55) return 'B';
  if (pts >= 40) return 'C';
  return 'D';
}
function buildInsight(summary){
  const stab = Number(summary.stabilityRatio || 0);
  const avoidTotal = (summary.obstaclesAvoided||0) + (summary.obstaclesHit||0);
  const avoidRate = avoidTotal ? (summary.obstaclesAvoided/avoidTotal) : 0;
  const fat = Number(summary.fatigueIndex || 0);

  if (stab >= 0.72 && avoidRate >= 0.8){
    return 'ยอดเยี่ยมมาก! คุณคุมสมดุลนิ่งและหลบแรงรบกวนได้สม่ำเสมอ ลองเพิ่มความยากเพื่อท้าทายต่อได้เลย';
  }
  if (stab < 0.45){
    return 'โฟกัสการคุมใกล้กึ่งกลางให้มากขึ้นก่อน แล้วค่อยเร่งการตอบสนองตอน obstacle เข้ามา จะช่วยให้คะแนนขึ้นเร็วมาก';
  }
  if (avoidRate < 0.5){
    return 'จังหวะหลบยังพลาดบ่อย ลองเตรียมดึงกลับเข้ากลางทันทีเมื่อเห็นไอคอน obstacle จะช่วยเพิ่ม avoid rate ได้ชัดเจน';
  }
  if (fat > 0.35){
    return 'ช่วงท้ายเริ่มล้า (fatigue สูงขึ้น) ลองคุมแรงนิ้วให้เบาลงและสม่ำเสมอ จะช่วยไม่ให้แกว่งเกินในช่วงท้ายเกม';
  }
  return 'ทำได้ดีมาก! รักษาจังหวะคุมแท่นให้สม่ำเสมอ และลุ้น Perfect ตอน impact เพื่อเพิ่มคะแนนและคอมโบ';
}
function renderBadgesAndMissions(summary){
  if (heroBadgesEl) heroBadgesEl.innerHTML = '';
  if (heroMissionEl) heroMissionEl.innerHTML = '';

  const badges = [];
  if ((summary.perfects||0) >= 5) badges.push({t:'✨ Perfect Keeper', c:'good'});
  if ((summary.comboMax||0) >= 8) badges.push({t:'🔥 Combo Flow', c:'good'});
  if ((summary.obstaclesHit||0) === 0 && ((summary.obstaclesAvoided||0) > 0)) badges.push({t:'🛡️ No Hit Run', c:'good'});
  if ((summary.fatigueIndex||0) > 0.35) badges.push({t:'😮‍💨 Fatigue Alert', c:'warn'});

  const missions = [];
  if ((summary.perfects||0) < 5) missions.push('ทำ Perfect ≥ 5 ครั้ง');
  if ((summary.comboMax||0) < 10) missions.push('ทำ Max Combo ≥ 10');
  if ((summary.stabilityRatio||0) < 0.70) missions.push('ดัน Stability ≥ 70%');
  if ((summary.obstaclesHit||0) > 0) missions.push('ลองรอบไร้ Hit');

  if (heroBadgesEl){
    if (!badges.length){
      const el = document.createElement('div');
      el.className = 'mini-badge';
      el.textContent = 'เริ่มสะสม badges ได้จาก Perfect / Combo / No-hit run';
      heroBadgesEl.appendChild(el);
    }else{
      badges.forEach(b=>{
        const el = document.createElement('div');
        el.className = `mini-badge ${b.c||''}`;
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
    }else{
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
 * Save last summary for HUB + return query
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
  const hub = String(qv('hub',''));
  if (!hub){
    showView('menu');
    return;
  }
  try{
    const u = new URL(hub, location.href);
    const raw = localStorage.getItem('HHA_LAST_SUMMARY_balance-hold') || localStorage.getItem('HHA_LAST_SUMMARY');
    if (raw){
      const s = JSON.parse(raw);
      if (s && s.gameId === 'balance-hold'){
        u.searchParams.set('lastGame', 'balance-hold');
        u.searchParams.set('lastScore', String(s.score || 0));
        u.searchParams.set('lastRank', String(s.rank || 'D'));
        u.searchParams.set('lastStab', String(Math.round((s.stabilityRatio || 0)*100)));
      }
    }
    location.href = u.toString();
  }catch(e){
    location.href = hub;
  }
}

/* ------------------------------------------------------------
 * Result views
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

  const totalObs = (summary.obstaclesAvoided||0)+(summary.obstaclesHit||0);
  const avoidRate = totalObs ? (summary.obstaclesAvoided/totalObs) : 0;
  if (resAvoidRate) setText(resAvoidRate, fmtPercent(avoidRate));
  if (resFatigue) setText(resFatigue, fmtFloat(summary.fatigueIndex || 0, 3));
  if (resSamples) setText(resSamples, String(summary.samples ?? 0));

  if (resScoreEl) setText(resScoreEl, summary.score || 0);
  if (resRankEl) setText(resRankEl, summary.rank || 'D');
  if (resPerfectEl) setText(resPerfectEl, summary.perfects || 0);
  if (resComboEl) setText(resComboEl, summary.comboMax || 0);

  if (resAiTipEl) setText(resAiTipEl, summary.insight || '-');
  if (resDailyEl){
    try{ setText(resDailyEl, new Date().toLocaleDateString('th-TH')); }catch(e){ setText(resDailyEl, '-'); }
  }

  // Hero header
  if (rankBadgeEl){
    rankBadgeEl.textContent = summary.rank || 'D';
    rankBadgeEl.classList.remove('rank-S','rank-A','rank-B','rank-C','rank-D');
    rankBadgeEl.classList.add('rank-' + (summary.rank || 'D'));
    rankBadgeEl.classList.remove('rank-pop'); void rankBadgeEl.offsetWidth; rankBadgeEl.classList.add('rank-pop');
  }
  if (resultHeroSub){
    const sub = `${mapEndReason(endedBy)} • Stability ${fmtPercent(summary.stabilityRatio)} • Avoid ${summary.obstaclesAvoided||0}/${totalObs||0}`;
    setText(resultHeroSub, sub);
  }
  if (heroInsightEl) setText(heroInsightEl, summary.insight || '-');

  renderBadgesAndMissions(summary);
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
 * Stop & summary
 * ------------------------------------------------------------ */
function stopGame(endedBy){
  if (!state) return;
  if (rafId != null){ cancelAnimationFrame(rafId); rafId = null; }

  const finalState = state; // snapshot

  const a = computeAnalytics();
  const summary = {
    gameId: 'balance-hold',
    mode: gameMode,
    difficulty: finalState.diffKey,
    durationSec: (finalState.durationMs/1000),
    stabilityRatio: a.stabilityRatio,
    meanTilt: a.meanTilt,
    rmsTilt: a.rmsTilt,
    fatigueIndex: a.fatigueIndex,
    samples: a.samples,

    obstaclesAvoided: finalState.obstaclesAvoided,
    obstaclesHit: finalState.obstaclesHit,

    score: finalState.score || 0,
    comboMax: finalState.maxCombo || 0,
    perfects: finalState.perfects || 0,

    seed: finalState.seedStr || qv('seed','')
  };

  summary.rank = calcRank(summary);
  summary.insight = buildInsight(summary);

  // optional: attach practice info
  if (finalState.practiceEnabled){
    const ps = finalState.practiceSamples || 0;
    const pr = ps ? (finalState.practiceStableSamples/ps) : 0;
    summary.practiceEnabled = true;
    summary.practiceDurationSec = Math.round((finalState.practiceDurationMs||0)/1000);
    summary.practiceStabilityRatio = pr;
    summary.practiceObstaclesAvoided = finalState.practiceObstaclesAvoided || 0;
    summary.practiceObstaclesHit = finalState.practiceObstaclesHit || 0;
  }

  // save local
  recordSessionToLocal(summary);
  saveLastSummaryForHub(summary, endedBy);

  fillResultView(endedBy, summary);
  fillEndModal(summary);

  // cleanup
  state = null;
  isPaused = false;
  pausedAt = 0;

  showView('result');

  // open modal on timeout by default
  if (endedBy !== 'manual'){
    setTimeout(()=> openEndModal(), 120);
  }
}

/* ------------------------------------------------------------
 * Main loop
 * ------------------------------------------------------------ */
function loop(now){
  if (!state) return;
  if (isPaused){
    // paused: do nothing
    return;
  }

  const dt = now - state.lastFrame;
  state.lastFrame = now;

  // countdown phase
  if (state.phase === 'countdown'){
    runCountdownPhase(now);
    rafId = requestAnimationFrame(loop);
    return;
  }

  // practice phase timer handling
  if (state.phase === 'practice'){
    if (runPracticePhase(now)){
      rafId = requestAnimationFrame(loop);
      return;
    }
  }

  // main timer handling
  if (state.phase === 'main'){
    state.elapsed = now - state.startTime;
    const remainMs = Math.max(0, state.durationMs - state.elapsed);
    setText(hudTime, (remainMs/1000).toFixed(1));

    if (state.elapsed >= state.durationMs){
      stopGame('timeout');
      return;
    }
  }

  // deterministic passive drift
  const cfg = state.cfg;
  const lerp = 0.11;
  const driftDir = (rand01() < 0.5 ? -1 : 1) * cfg.passiveDrift * (dt/1000);
  const target = state.targetAngle + driftDir;
  state.angle += (target - state.angle) * lerp;

  state.angle = clamp(state.angle, -1.2, 1.2);
  state.targetAngle = clamp(state.targetAngle, -1, 1);

  updateVisuals();

  // sampling — only meaningful for main; practice can show stability too
  if (now >= state.nextSampleAt){
    const safeHalf = cfg.safeHalf;
    const inSafe = Math.abs(state.angle) <= safeHalf;
    const absTilt = Math.abs(state.angle);

    const isPractice = state.phase === 'practice';
    if (isPractice){
      state.practiceSamples++;
      if (inSafe) state.practiceStableSamples++;
    }else{
      state.totalSamples++;
      if (inSafe) state.stableSamples++;
      state.sumTiltAbs += absTilt;
      state.sumTiltSq  += absTilt*absTilt;
      const tNorm = state.durationMs ? (state.elapsed / state.durationMs) : 0;
      state.samples.push({ tNorm, tilt: absTilt });
      if (state.samples.length > 4000) state.samples.splice(0, state.samples.length - 4000);
    }

    let stabRatio = 0;
    if (isPractice){
      stabRatio = state.practiceSamples ? (state.practiceStableSamples/state.practiceSamples) : 0;
    }else{
      stabRatio = state.totalSamples ? (state.stableSamples/state.totalSamples) : 0;
    }
    setText(hudStab, fmtPercent(stabRatio));
    if (stabilityFill) stabilityFill.style.width = `${clamp(stabRatio*100, 0, 100)}%`;
    if (centerPulse){
      centerPulse.classList.toggle('good', Math.abs(state.angle) <= (state.cfg.safeHalf * 0.55));
    }

    state.nextSampleAt = now + state.sampleEveryMs;
  }

  // spawn obstacle in practice or main
  if ((state.phase === 'practice' || state.phase === 'main') && now >= state.nextObstacleAt){
    spawnObstacle(now);
  }

  rafId = requestAnimationFrame(loop);
}

/* ------------------------------------------------------------
 * Exports (sessions CSV + debug JSON)
 * ------------------------------------------------------------ */
function downloadTextFile(filename, text, type='text/plain'){
  try{
    const blob = new Blob([text], {type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
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
  try{ arr = JSON.parse(localStorage.getItem(SESS_KEY)||'[]'); }catch(e){ arr = []; }

  const rows = [[
    'ts','mode','difficulty','durationSec',
    'stabilityRatio','meanTilt','rmsTilt','fatigueIndex',
    'obstaclesAvoided','obstaclesHit','score','rank','comboMax','perfects','seed'
  ]];
  arr.forEach(x=>{
    rows.push([
      x.ts || '',
      x.mode || '',
      x.difficulty || '',
      x.durationSec || '',
      x.stabilityRatio ?? '',
      x.meanTilt ?? '',
      x.rmsTilt ?? '',
      x.fatigueIndex ?? '',
      x.obstaclesAvoided ?? '',
      x.obstaclesHit ?? '',
      x.score ?? '',
      x.rank ?? '',
      x.comboMax ?? '',
      x.perfects ?? '',
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
    lastSummary: (()=>{ try{ return JSON.parse(localStorage.getItem('HHA_LAST_SUMMARY_balance-hold')||'null'); }catch(e){ return null; }})(),
    now: new Date().toISOString()
  };
  downloadTextFile(`balance-hold-debug-${Date.now()}.json`, JSON.stringify(debug, null, 2), 'application/json');
}

/* ------------------------------------------------------------
 * Init / bindings
 * ------------------------------------------------------------ */
function init(){
  // menu actions
  $('[data-action="start-normal"]')?.addEventListener('click', ()=>{
    if (maybeShowTutorialBeforeStart('play')) return;
    startGame('play');
  });
  $('[data-action="goto-research"]')?.addEventListener('click', ()=> showView('research'));
  $$('[data-action="back-menu"]').forEach(btn=> btn.addEventListener('click', ()=> showView('menu')));
  $('[data-action="start-research"]')?.addEventListener('click', ()=>{
    if (maybeShowTutorialBeforeStart('research')) return;
    startGame('research');
  });

  // play controls
  $('[data-action="stop"]')?.addEventListener('click', ()=> state && stopGame('manual'));
  $('[data-action="pause"]')?.addEventListener('click', pauseGame);
  $('[data-action="resume"]')?.addEventListener('click', resumeGame);

  // result actions
  $('[data-action="play-again"]')?.addEventListener('click', ()=> showView('menu'));
  $('[data-action="result-play-again"]')?.addEventListener('click', ()=> { closeEndModal(); showView('menu'); });
  $('[data-action="result-back-hub"]')?.addEventListener('click', ()=> goHubOrMenu());

  // end modal actions
  $('[data-action="close-end-modal"]')?.addEventListener('click', closeEndModal);
  $('[data-action="end-retry"]')?.addEventListener('click', ()=> { closeEndModal(); showView('menu'); });
  $('[data-action="end-next-mission"]')?.addEventListener('click', ()=> { closeEndModal(); showView('menu'); });
  $('[data-action="end-back-hub"]')?.addEventListener('click', ()=> { closeEndModal(); goHubOrMenu(); });

  // tutorial actions
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

  // exports
  $$('[data-action="export-sessions-csv"]').forEach(btn=> btn.addEventListener('click', exportSessionsCSV));
  $$('[data-action="export-release-debug"]').forEach(btn=> btn.addEventListener('click', exportReleaseDebug));

  // view mode
  elViewSel?.addEventListener('change', (e)=>{
    applyViewModeClass(String(e.target.value || 'pc'));
  });

  // cVR controls (preview stubs)
  $('[data-action="cvr-recenter"]')?.addEventListener('click', ()=>{
    if (!state) return;
    state.targetAngle = 0;
    state.angle *= 0.5;
  });
  $('[data-action="cvr-calibrate-left"]')?.addEventListener('click', ()=>{
    if (!state) return;
    state.targetAngle = Math.max(-1, (state.targetAngle||0) - 0.08);
  });
  $('[data-action="cvr-calibrate-right"]')?.addEventListener('click', ()=>{
    if (!state) return;
    state.targetAngle = Math.min(1, (state.targetAngle||0) + 0.08);
  });
  $('[data-action="cvr-toggle-strict"]')?.addEventListener('click', ()=>{
    if (!cvrStrictLabel) return;
    cvrStrictLabel.textContent = (String(cvrStrictLabel.textContent||'OFF').toUpperCase() === 'ON') ? 'OFF' : 'ON';
  });

  // auto pause on hide
  document.addEventListener('visibilitychange', ()=>{
    if (document.visibilityState === 'hidden'){
      if (state && !isPaused) pauseGame();
    }
  });

  attachInput();

  // default view
  showView('menu');

  // query -> ui
  applyQueryToUI();
}

window.addEventListener('DOMContentLoaded', init);