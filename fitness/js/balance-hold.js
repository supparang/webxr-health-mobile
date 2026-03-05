// === /fitness/js/balance-hold.js ===
// Balance Hold — DOM-based Balance Platform + Obstacle Avoidance
// FULL BUILD (T) — + AFK lock + FX restore
// PATCH v20260305-BH-AFK-STARTGATE-FX-RESTORE
'use strict';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

function setText(selOrEl, v){
  const el = (typeof selOrEl === 'string') ? $(selOrEl) : selOrEl;
  if (el) el.textContent = String(v ?? '');
}
function clamp(v, a, b){ v = Number(v); if(!Number.isFinite(v)) v = a; return Math.max(a, Math.min(b, v)); }
function fmtPercent(v){ v = Number(v); if(!Number.isFinite(v)) return '-'; return (v*100).toFixed(1)+'%'; }
function fmtFloat(v, d=3){ v = Number(v); if(!Number.isFinite(v)) return '-'; return v.toFixed(d); }

function qv(k, def=''){
  try{
    const u = new URL(window.location.href);
    const v = u.searchParams.get(k);
    return (v == null || v === '') ? def : v;
  }catch(e){
    return def;
  }
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

/* Seeded RNG */
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

/* Views */
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

/* DOM refs */
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
const hitFlash      = $('#hitFlash');

const playArea      = $('#playArea');
const platformWrap  = $('#platform-wrap');
const platformEl    = $('#platform');
const indicatorEl   = $('#indicator');
const obstacleLayer = $('#obstacle-layer');

const coachLabel  = $('#coachLabel');
const coachBubble = $('#coachBubble');

/* result refs */
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

/* Config */
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
    case 'failed':  return 'เสียสมดุล (HP หมด) / Failed';
    default:        return code || '-';
  }
}

/* Warmup buffs */
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

/* Tutorial / modal */
function openTutorial(){ if (!tutorialOverlay) return; tutorialOverlay.classList.remove('hidden'); tutorialOverlay.setAttribute('aria-hidden','false'); }
function closeTutorial(){ if (!tutorialOverlay) return; tutorialOverlay.classList.add('hidden'); tutorialOverlay.setAttribute('aria-hidden','true'); }
function openEndModal(){ if (!endModal) return; endModal.classList.remove('hidden'); endModal.setAttribute('aria-hidden','false'); }
function closeEndModal(){ if (!endModal) return; endModal.classList.add('hidden'); endModal.setAttribute('aria-hidden','true'); }

/* Prefill UI */
function applyQueryToUI(){
  const qDiff = String(qv('diff','')).toLowerCase();
  const qTime = qv('time','');
  const qRun  = String(qv('run','')).toLowerCase();
  const qView = String(qv('view','')).toLowerCase();

  if (elDiffSel && ['easy','normal','hard'].includes(qDiff)) elDiffSel.value = qDiff;

  if (elDurSel && qTime){
    const t = clampNum(qTime, 10, 600, 60);
    const tStr = String(t);
    const has = [...elDurSel.options].some(o => o.value === tStr);
    if (!has){
      const opt = document.createElement('option');
      opt.value = tStr; opt.textContent = tStr;
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

  if (elViewSel && ['pc','mobile','cvr'].includes(qView)) elViewSel.value = qView;
  applyViewModeClass(qView || (elViewSel ? elViewSel.value : 'pc'));

  if (qRun === 'research') showView('research');

  // ✅ autostart from HUB (only when asked)
  const auto = parseBoolLike(qv('autostart','0'), false);
  if (auto){
    // if diff/time passed from hub, start immediately
    setTimeout(()=> startGame(qRun === 'research' ? 'research' : 'play'), 80);
  }
}

/* FX helpers */
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
function flashHit(){
  if (!hitFlash || !fxEnabled()) return;
  hitFlash.classList.add('on');
  setTimeout(()=> hitFlash && hitFlash.classList.remove('on'), 130);
}

/* Input + AFK gate */
function attachInput(){
  if (!playArea) return;
  let active = false;

  function markInteracted(){
    if (!state) return;
    if (!state.userInteracted){
      state.userInteracted = true;
      state.lastInputAt = performance.now();
      if (coachLabel) coachLabel.textContent = 'ลากซ้าย–ขวาเพื่อคุมสมดุล / Drag left–right to balance';
      if (hudStatus) setText(hudStatus, state.phase === 'practice' ? 'Practice' : 'Playing');
      if (coachBubble){
        coachBubble.textContent = 'เริ่มนับคะแนนแล้ว! ✨';
        coachBubble.classList.remove('hidden');
        setTimeout(()=> coachBubble && coachBubble.classList.add('hidden'), 700);
      }
    }else{
      state.lastInputAt = performance.now();
    }
  }

  function updateTargetFromEvent(ev){
    if (!state) return;
    const rect = playArea.getBoundingClientRect();
    const x = ev.clientX ?? (ev.touches && ev.touches[0]?.clientX);
    if (x == null) return;

    markInteracted();

    const relX = (x - rect.left) / rect.width; // 0..1
    let norm = (relX - 0.5) * 2;               // -1..1

    const view = (elViewSel?.value || qv('view','pc')).toLowerCase();
    const p = (view === 'mobile') ? { deadzone:0.04, smoothing:0.22, maxTarget:0.95 }
            : (view === 'cvr')    ? { deadzone:0.06, smoothing:0.18, maxTarget:0.85 }
            :                      { deadzone:0.02, smoothing:0.35, maxTarget:1.00 };

    if (Math.abs(norm) < p.deadzone) norm = 0;
    norm = clamp(norm, -p.maxTarget, p.maxTarget);

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

/* Game State */
let gameMode = 'play';
let state = null;
let rafId = null;
let isPaused = false;
let pausedAt = 0;
let tutorialAccepted = false;

const SESS_KEY = 'vrfit_sessions_balance-hold';
function recordSessionToLocal(summary){
  try{
    const arr = JSON.parse(localStorage.getItem(SESS_KEY) || '[]');
    arr.push({ ...summary, ts: Date.now() });
    localStorage.setItem(SESS_KEY, JSON.stringify(arr));
  }catch(e){}
}

/* RNG helpers */
function rand01(){ return (state && typeof state.rand === 'function') ? state.rand() : Math.random(); }
function randomBetween(a,b){ const r = rand01(); return a + r*(b-a); }

/* Practice / phases */
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

  // ✅ AFK gate: not counting until first real input
  state.userInteracted = false;
  state.lastInputAt = now;

  setText(hudStatus, 'Ready');
  setText(hudPhase, `Main • seed:${String(state.seedStr||'').slice(0,10)}`);
  setText(hudScore, '0'); setText(hudCombo, '0');
  setText(hudStab, '0%');
  if (hudObsA) setText(hudObsA, '0 / 0');
  if (hudObsB) setText(hudObsB, '0 / 0');
  if (stabilityFill) stabilityFill.style.width = '0%';
  if (centerPulse) centerPulse.classList.remove('good');

  if (coachLabel){
    coachLabel.textContent = 'แตะ/ลากซ้าย–ขวาเพื่อคุมสมดุล (ต้องมีการคุมจริงจึงเริ่มนับคะแนน)';
  }

  resetMotionForNewPhase();
}
function runCountdownPhase(now){
  if (!state) return true;
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
    if (state.practiceEnabled && !state.practiceEnded) beginPracticePhase(now);
    else beginMainPhase(now);
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

/* Start / Pause / Resume / Stop */
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
  const warmup  = readWarmupBuff();

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

    angle: 0,
    targetAngle: 0,

    sampleEveryMs: 120,
    nextSampleAt: now + 120,
    totalSamples: 0,
    stableSamples: 0,
    sumTiltAbs: 0,
    sumTiltSq: 0,
    samples: [],

    nextObstacleAt: now + randomBetween(cfg.disturbMinMs, cfg.disturbMaxMs),
    obstacleSeq: 1,
    obstaclesTotal: 0,
    obstaclesAvoided: 0,
    obstaclesHit: 0,

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

    score: 0,
    combo: 0,
    maxCombo: 0,
    perfects: 0,

    fatigueIndex: 0,

    seedStr,
    rand: rng,
    warmup,

    phase: 'main',
    phaseLabel: 'Main',
    countdownMs: 0,
    countdownStartedAt: 0,

    // ✅ AFK gate fields
    userInteracted: false,
    lastInputAt: now,
    hp: 3 // ✅ simple fail condition (HP)
  };

  setText(hudMode, gameMode === 'research' ? 'Research' : 'Play');
  setText(hudDiff, diffKey);
  setText(hudDur, String(durSec));
  setText(hudTime, durSec.toFixed(1));
  setText(hudStab, '0%');
  if (hudObsA) setText(hudObsA, '0 / 0');
  if (hudObsB) setText(hudObsB, '0 / 0');
  setText(hudScore, '0');
  setText(hudCombo, '0');

  applyViewModeClass(elViewSel?.value || qv('view','pc'));

  const safeInner = $('.safe-zone-inner');
  if (safeInner){
    const pct = Math.max(14, Math.min(75, cfg.safeHalf * 100));
    safeInner.style.width = `${pct}%`;
  }

  closeEndModal();
  closeTutorial();

  if (stabilityFill) stabilityFill.style.width = '0%';
  if (centerPulse) centerPulse.classList.remove('good');
  if (obstacleLayer) obstacleLayer.innerHTML = '';

  if (coachLabel){
    coachLabel.textContent = 'แตะ/ลากซ้าย–ขวาเพื่อคุมสมดุล (ต้องมีการคุมจริงจึงเริ่มนับคะแนน)';
  }
  if (coachBubble) coachBubble.classList.add('hidden');

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
    beginMainPhase(now);
  }

  isPaused = false;
  pausedAt = 0;
  $('[data-action="pause"]')?.classList.remove('hidden');
  $('[data-action="resume"]')?.classList.add('hidden');

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

  state.startTime += pausedMs;
  state.lastFrame = now;
  state.nextSampleAt += pausedMs;
  state.nextObstacleAt += pausedMs;
  state.countdownStartedAt += pausedMs;
  state.practiceStartedAt += pausedMs;
  state.lastInputAt += pausedMs;

  setText(hudStatus, state.phase === 'practice' ? 'Practice' : (state.userInteracted ? 'Playing' : 'Ready'));
  $('[data-action="pause"]')?.classList.remove('hidden');
  $('[data-action="resume"]')?.classList.add('hidden');

  if (rafId != null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

/* Visuals */
function updateVisuals(){
  if (!state) return;

  if (platformEl){
    const maxDeg = 16;
    const angleDeg = state.angle * maxDeg;
    platformEl.style.transform = `rotate(${angleDeg}deg)`;
  }

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

/* Obstacles */
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
  let xNorm = (rand01()*2 - 1);
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

    // ✅ if still not interacted in MAIN: treat as fail pressure (AFK)
    const allowScore = (state.phase !== 'main') ? true : !!state.userInteracted;

    if (isPractice){
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
        flashHit();
        setTimeout(()=> playArea.classList.remove('shake-hit'), 240);
      }
      setText(hudScore, `P:${state.practiceScore || 0}`);
      setText(hudCombo, 'P');
      updateVisuals();
      state.nextObstacleAt = now + randomBetween(cfg.disturbMinMs, cfg.disturbMaxMs);
      return;
    }

    const wu = state.warmup || {};

    if (inSafe){
      span.classList.add('avoid');
      state.obstaclesAvoided++;

      if (allowScore){
        state.combo = (state.combo || 0) + 1;
        state.maxCombo = Math.max(state.maxCombo || 0, state.combo);

        let add = 10 + Math.min(20, (state.combo-1)*2);

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
        setText(hudScore, String(state.score || 0));
        setText(hudCombo, String(state.combo || 0));
        pulseEl(hudScore); pulseEl(hudCombo);
      }else{
        // still show feedback but no score
        spawnFloatFx(nearPerfect ? 'Perfect (no-score)' : 'Avoid (no-score)', nearPerfect ? 'gold' : 'good', pxX, (playArea.clientHeight || 300) * 0.55);
      }
    }else{
      span.classList.add('hit');
      state.obstaclesHit++;

      // ✅ HP system: 3 hits then fail (even if AFK)
      state.hp = Math.max(0, (state.hp ?? 3) - 1);

      if (allowScore){
        state.combo = 0;

        const basePenalty = 8;
        const penalty = Math.max(2, Math.round(basePenalty * (wu.dmgReduceMul || 1)));
        state.score = Math.max(0, (state.score || 0) - penalty);

        const knockDir = (state.angle>=0 ? 1 : -1);
        const knockMul = Math.max(0.65, (wu.dmgReduceMul || 1));
        state.angle += knockDir * cfg.disturbStrength * 0.7 * knockMul;

        spawnFloatFx(`Hit -${penalty}`, 'bad', pxX, (playArea.clientHeight || 300) * 0.55);
        setText(hudScore, String(state.score || 0));
        setText(hudCombo, String(state.combo || 0));
        pulseEl(hudScore); pulseEl(hudCombo);
      }else{
        // AFK: no score anyway; just punish
        spawnFloatFx('Hit (AFK)', 'bad', pxX, (playArea.clientHeight || 300) * 0.55);
      }

      playArea.classList.add('shake-hit');
      flashHit();
      setTimeout(()=> playArea.classList.remove('shake-hit'), 240);

      if (state.hp <= 0){
        stopGame('failed');
        return;
      }
    }

    updateVisuals();

  }, Math.max(0, impactAt - performance.now()));

  state.nextObstacleAt = now + randomBetween(cfg.disturbMinMs, cfg.disturbMaxMs);
}

/* Analytics */
function computeAnalytics(){
  if (!state) return { stabilityRatio:0, meanTilt:0, rmsTilt:0, fatigueIndex:0, samples:0 };

  const n = state.totalSamples || 0;
  if (!n) return { stabilityRatio:0, meanTilt:0, rmsTilt:0, fatigueIndex:0, samples:0 };

  const stabRatio = state.stableSamples / n;
  const meanTilt  = state.sumTiltAbs / n;
  const rmsTilt   = Math.sqrt(state.sumTiltSq / n);

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

/* Ranking / insight / badges */
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

  if (stab >= 0.72 && avoidRate >= 0.8) return 'ยอดเยี่ยมมาก! คุมสมดุลนิ่งและหลบได้สม่ำเสมอ ลอง Hard เพื่อท้าทายต่อได้เลย';
  if (stab < 0.45) return 'โฟกัสคุมใกล้กึ่งกลางก่อน แล้วค่อยเร่งการตอบสนองตอน obstacle เข้ามา คะแนนจะขึ้นเร็วมาก';
  if (avoidRate < 0.5) return 'จังหวะหลบยังพลาดบ่อย ลองเตรียมดึงกลับเข้ากลางทันทีเมื่อเห็น obstacle จะช่วยเพิ่ม avoid rate ได้ชัดเจน';
  if (fat > 0.35) return 'ช่วงท้ายเริ่มล้า (fatigue สูงขึ้น) ลองคุมแรงนิ้วให้เบาลงและสม่ำเสมอ จะช่วยไม่ให้แกว่งเกินในท้ายเกม';
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

  const addChip=(root, text, cls='mini-badge')=>{
    if(!root) return;
    const el=document.createElement('div');
    el.className=cls;
    el.textContent=text;
    root.appendChild(el);
  };

  if (!badges.length) addChip(heroBadgesEl, 'เริ่มสะสม badges ได้จาก Perfect / Combo / No-hit run');
  else badges.forEach(b=> addChip(heroBadgesEl, b.t, `mini-badge ${b.c||''}`));

  if (!missions.length) addChip(heroMissionEl, 'พร้อมขยับไปโหมด Hard ได้เลย', 'mini-badge good');
  else missions.slice(0,3).forEach(t=> addChip(heroMissionEl, '🎯 ' + t));
}

/* Save last summary for HUB */
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
  if (!hub){ showView('menu'); return; }
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

/* Result fill */
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

/* Stop */
function stopGame(endedBy){
  if (!state) return;
  if (rafId != null){ cancelAnimationFrame(rafId); rafId = null; }

  const finalState = state;

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

  if (finalState.practiceEnabled){
    const ps = finalState.practiceSamples || 0;
    const pr = ps ? (finalState.practiceStableSamples/ps) : 0;
    summary.practiceEnabled = true;
    summary.practiceDurationSec = Math.round((finalState.practiceDurationMs||0)/1000);
    summary.practiceStabilityRatio = pr;
    summary.practiceObstaclesAvoided = finalState.practiceObstaclesAvoided || 0;
    summary.practiceObstaclesHit = finalState.practiceObstaclesHit || 0;
  }

  recordSessionToLocal(summary);
  saveLastSummaryForHub(summary, endedBy);

  fillResultView(endedBy, summary);
  fillEndModal(summary);

  state = null;
  isPaused = false;
  pausedAt = 0;

  showView('result');

  if (endedBy !== 'manual'){
    setTimeout(()=> openEndModal(), 120);
  }
}

/* Main loop */
function loop(now){
  if (!state) return;
  if (isPaused) return;

  const dt = now - state.lastFrame;
  state.lastFrame = now;

  if (state.phase === 'countdown'){
    runCountdownPhase(now);
    rafId = requestAnimationFrame(loop);
    return;
  }
  if (state.phase === 'practice'){
    if (runPracticePhase(now)){
      rafId = requestAnimationFrame(loop);
      return;
    }
  }
  if (state.phase === 'main'){
    state.elapsed = now - state.startTime;
    const remainMs = Math.max(0, state.durationMs - state.elapsed);
    setText(hudTime, (remainMs/1000).toFixed(1));
    if (state.elapsed >= state.durationMs){
      stopGame('timeout');
      return;
    }
  }

  const cfg = state.cfg;

  // ✅ AFK pressure: if not interacted for a while, drift stronger to force fail
  const afk = (!state.userInteracted) ? 1 : 0;
  const afkMs = Math.max(0, now - (state.lastInputAt || now));
  const afkBoost = (!state.userInteracted && afkMs > 900) ? clamp((afkMs-900)/1600, 0, 1) : 0;

  const baseDrift = cfg.passiveDrift;
  const driftMul = 1 + (afkBoost * 2.2);
  const driftDir = (rand01() < 0.5 ? -1 : 1) * baseDrift * driftMul * (dt/1000);

  const lerpK = 0.11;
  const target = state.targetAngle + driftDir;
  state.angle += (target - state.angle) * lerpK;

  state.angle = clamp(state.angle, -1.2, 1.2);
  state.targetAngle = clamp(state.targetAngle, -1, 1);

  updateVisuals();

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
    if (centerPulse) centerPulse.classList.toggle('good', Math.abs(state.angle) <= (state.cfg.safeHalf * 0.55));

    // ✅ If main and still not interacted: keep status “Ready”
    if (state.phase === 'main' && !state.userInteracted){
      setText(hudStatus, 'Ready (touch to start scoring)');
    }

    state.nextSampleAt = now + state.sampleEveryMs;
  }

  if ((state.phase === 'practice' || state.phase === 'main') && now >= state.nextObstacleAt){
    spawnObstacle(now);
  }

  rafId = requestAnimationFrame(loop);
}

/* Exports */
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
      x.ts || '', x.mode || '', x.difficulty || '', x.durationSec || '',
      x.stabilityRatio ?? '', x.meanTilt ?? '', x.rmsTilt ?? '', x.fatigueIndex ?? '',
      x.obstaclesAvoided ?? '', x.obstaclesHit ?? '', x.score ?? '', x.rank ?? '',
      x.comboMax ?? '', x.perfects ?? '', x.seed ?? ''
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

/* Init / bindings */
function init(){
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

  $('[data-action="stop"]')?.addEventListener('click', ()=> state && stopGame('manual'));
  $('[data-action="pause"]')?.addEventListener('click', pauseGame);
  $('[data-action="resume"]')?.addEventListener('click', resumeGame);

  $('[data-action="result-play-again"]')?.addEventListener('click', ()=> { closeEndModal(); showView('menu'); });
  $('[data-action="result-back-hub"]')?.addEventListener('click', ()=> goHubOrMenu());

  $('[data-action="close-end-modal"]')?.addEventListener('click', closeEndModal);
  $('[data-action="end-retry"]')?.addEventListener('click', ()=> { closeEndModal(); showView('menu'); });
  $('[data-action="end-next-mission"]')?.addEventListener('click', ()=> { closeEndModal(); showView('menu'); });
  $('[data-action="end-back-hub"]')?.addEventListener('click', ()=> { closeEndModal(); goHubOrMenu(); });

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

  $$('[data-action="export-sessions-csv"]').forEach(btn=> btn.addEventListener('click', exportSessionsCSV));
  $$('[data-action="export-release-debug"]').forEach(btn=> btn.addEventListener('click', exportReleaseDebug));

  elViewSel?.addEventListener('change', (e)=>{
    applyViewModeClass(String(e.target.value || 'pc'));
  });

  $('[data-action="cvr-recenter"]')?.addEventListener('click', ()=>{
    if (!state) return;
    state.targetAngle = 0;
    state.angle *= 0.5;
    state.lastInputAt = performance.now();
  });
  $('[data-action="cvr-calibrate-left"]')?.addEventListener('click', ()=>{
    if (!state) return;
    state.targetAngle = Math.max(-1, (state.targetAngle||0) - 0.08);
    state.lastInputAt = performance.now();
  });
  $('[data-action="cvr-calibrate-right"]')?.addEventListener('click', ()=>{
    if (!state) return;
    state.targetAngle = Math.min(1, (state.targetAngle||0) + 0.08);
    state.lastInputAt = performance.now();
  });
  $('[data-action="cvr-toggle-strict"]')?.addEventListener('click', ()=>{
    if (!cvrStrictLabel) return;
    cvrStrictLabel.textContent = (String(cvrStrictLabel.textContent||'OFF').toUpperCase() === 'ON') ? 'OFF' : 'ON';
  });

  document.addEventListener('visibilitychange', ()=>{
    if (document.visibilityState === 'hidden'){
      if (state && !isPaused) pauseGame();
    }
  });

  attachInput();
  showView('menu');
  applyQueryToUI();
}

window.addEventListener('DOMContentLoaded', init);