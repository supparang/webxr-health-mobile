// === /fitness/js/balance-hold.js ===
// DOM-based Balance Platform + Obstacle Avoidance — PRODUCTION (FUN + FAIR + SEEDED + RT + 3-STAGE + HP)
// PATCH v20260304-BH-FUN-FAIR-SEEDED-RT-3STAGE-HP
'use strict';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

/* ---- DOM refs ---- */
const viewMenu    = $('#view-menu');
const viewResearch= $('#view-research');
const viewPlay    = $('#view-play');
const viewResult  = $('#view-result');

const elDiffSel   = $('#difficulty');
const elDurSel    = $('#sessionDuration');

const hudMode     = $('#hud-mode');
const hudDiff     = $('#hud-diff');
const hudDur      = $('#hud-dur');
const hudStab     = $('#hud-stability');
const hudObs      = $('#hud-obstacles');
const hudTime     = $('#hud-time');

// optional HUD (safe if missing)
const hudScore    = $('#hud-score');
const hudCombo    = $('#hud-combo');
const hudHp       = $('#hud-hp');
const hudStage    = $('#hud-stage');
const hudRt       = $('#hud-rt');

const playArea    = $('#playArea');
const platformWrap= $('#platform-wrap');
const platformEl  = $('#platform');
const indicatorEl = $('#indicator');
const obstacleLayer = $('#obstacle-layer');
const coachLabel  = $('#coachLabel');
const coachBubble = $('#coachBubble');

/* result fields */
const resMode        = $('#res-mode');
const resDiff        = $('#res-diff');
const resDur         = $('#res-dur');
const resEnd         = $('#res-end');
const resStab        = $('#res-stability');
const resMeanTilt    = $('#res-meanTilt');
const resRmsTilt     = $('#res-rmsTilt');
const resAvoid       = $('#res-avoid');
const resHit         = $('#res-hit');
const resAvoidRate   = $('#res-avoidRate');
const resFatigue     = $('#res-fatigue');
const resSamples     = $('#res-samples');

// optional result fields (safe if missing)
const resScore       = $('#res-score');
const resComboMax    = $('#res-comboMax');
const resHpEnd       = $('#res-hpEnd');
const resRtMed       = $('#res-rtMedian');
const resRtMean      = $('#res-rtMean');

const btnBackHub     = $('#btnBackHub'); // optional, will create if missing

/* ---- Config ---- */

const GAME_DIFF = {
  easy: {
    safeHalf: 0.34,
    disturbMinMs: 1500,
    disturbMaxMs: 2700,
    disturbStrength: 0.20,
    passiveDrift: 0.060,     // 🔥 stronger than old
    hp: 4
  },
  normal: {
    safeHalf: 0.25,
    disturbMinMs: 1200,
    disturbMaxMs: 2200,
    disturbStrength: 0.26,
    passiveDrift: 0.085,
    hp: 3
  },
  hard: {
    safeHalf: 0.18,
    disturbMinMs: 900,
    disturbMaxMs: 1700,
    disturbStrength: 0.33,
    passiveDrift: 0.115,
    hp: 3
  }
};

function pickDiff(key){
  return GAME_DIFF[key] || GAME_DIFF.normal;
}

function mapEndReason(code){
  switch(code){
    case 'timeout': return 'ครบเวลาที่กำหนด / Timeout';
    case 'manual':  return 'หยุดเอง / Stopped by player';
    case 'fail':    return 'เสียสมดุล (HP หมด) / Failed';
    default:        return code || '-';
  }
}

const fmtPercent = (v)=>(v==null||Number.isNaN(v))?'-':(v*100).toFixed(1)+'%';
const fmtFloat   = (v,d=2)=>(v==null||Number.isNaN(v))?'-':v.toFixed(d);
const clamp       = (v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
const clamp01     = (x)=>clamp(x,0,1);
const nowMs       = ()=> (performance && performance.now) ? performance.now() : Date.now();

function qs(k, d=''){
  try { return new URL(location.href).searchParams.get(k) ?? d; }
  catch { return d; }
}
function toInt(v, def=0){ const n=parseInt(String(v||''),10); return Number.isFinite(n)?n:def; }
function toNum(v, def=0){ const n=Number(v); return Number.isFinite(n)?n:def; }

/* ---- Deterministic RNG (seeded) ---- */
function xmur3(str){
  str = String(str||'');
  let h = 1779033703 ^ str.length;
  for (let i=0;i<str.length;i++){
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
  let t = a >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRng(seedStr){
  const gen = xmur3(seedStr);
  return mulberry32(gen());
}
function randBetween(rng, a, b){
  return a + rng()*(b-a);
}

/* ---- Coach ---- */
const COACH_LINES = {
  welcome: 'พร้อมทรงตัวแล้วนะ ✨ ลากซ้าย–ขวาเพื่อคุมให้อยู่ “โซนปลอดภัย” / Drag left–right to stay in the safe zone.',
  good:    'ดีมาก! คุมให้อยู่โซนปลอดภัยติดกันได้แล้ว / Nice! Your stability streak is improving.',
  drift:   'เอียงค้างนานไป ลองดันกลับกลางช้า ๆ / You drifted—gently return to center.',
  boss:    'บอสมาแล้ว! 10 วิสุดท้าย โซนแคบลง! / Boss phase! Narrow safe zone—focus!',
  hit:     'โดนแรงรบกวน! ตั้งหลักกลับโซนปลอดภัยไว ๆ / Hit! Recover back to safe zone quickly.',
  perfect: 'Perfect ใกล้แล้ว! รักษา streak ต่อไป! / Almost perfect—keep the streak!'
};
let lastCoachAt = 0;
let lastCoachSnapshot = null;
const COACH_COOLDOWN_MS = 4500;

function showCoach(msgKey){
  if (!coachBubble) return;
  const now = nowMs();
  if (now - lastCoachAt < COACH_COOLDOWN_MS) return;
  const msg = COACH_LINES[msgKey];
  if (!msg) return;
  lastCoachAt = now;
  coachBubble.textContent = msg;
  coachBubble.classList.remove('hidden');
  setTimeout(()=> coachBubble && coachBubble.classList.add('hidden'), 4200);
}

function updateCoach(){
  if (!state) return;

  const snap = {
    stabRatio: state.totalSamples ? (state.stableSamples/state.totalSamples) : 0,
    meanTilt: Math.abs(state.meanTilt || 0),
    hits: state.obstaclesHit,
    avoid: state.obstaclesAvoided,
    stage: state.stageName,
    combo: state.combo
  };

  if (!lastCoachSnapshot){
    showCoach('welcome');
    lastCoachSnapshot = snap;
    return;
  }

  const prev = lastCoachSnapshot;

  if (snap.stage === 'Boss' && prev.stage !== 'Boss') showCoach('boss');
  if (snap.hits > prev.hits) showCoach('hit');

  // improvement
  if (snap.stabRatio - prev.stabRatio > 0.10) showCoach('good');

  // drift
  if (snap.meanTilt > 0.55 && prev.meanTilt <= 0.55) showCoach('drift');

  // almost perfect
  if (state.elapsed > state.durationMs*0.55 && snap.stabRatio > 0.82 && snap.hits <= 1 && snap.combo >= 5){
    showCoach('perfect');
  }

  lastCoachSnapshot = snap;
}

/* ---- Views ---- */
function showView(name){
  [viewMenu,viewResearch,viewPlay,viewResult].forEach(v=>v && v.classList.add('hidden'));
  if (name==='menu')     viewMenu && viewMenu.classList.remove('hidden');
  if (name==='research') viewResearch && viewResearch.classList.remove('hidden');
  if (name==='play')     viewPlay && viewPlay.classList.remove('hidden');
  if (name==='result')   viewResult && viewResult.classList.remove('hidden');
}

/* ---- CSV Logger (research) ---- */
function createCSVLogger(meta){
  const rows = [];
  const header = [
    'timestamp','event',
    'playerId','group','phase','mode',
    'difficulty','durationSec','seed',
    'stage','score','combo','hp',
    'tilt','targetTilt','inSafe',
    'obstacleId','obstacleKind','obstacleResult',
    'rtReactMs','rtRecoverMs'
  ];
  rows.push(header);

  function push(ev, extra){
    const t = Date.now();
    const e = extra || {};
    rows.push([
      t, ev,
      meta.playerId||'', meta.group||'', meta.phase||'', meta.mode||'',
      meta.difficulty||'', meta.durationSec||'', meta.seed||'',
      e.stage ?? '', e.score ?? '', e.combo ?? '', e.hp ?? '',
      e.tilt ?? '', e.targetTilt ?? '', e.inSafe ?? '',
      e.obstacleId ?? '', e.obstacleKind ?? '', e.obstacleResult ?? '',
      e.rtReactMs ?? '', e.rtRecoverMs ?? ''
    ]);
  }

  return {
    logSample(info){ push('sample',info); },
    logObstacle(info){ push('obstacle',info); },
    finish(summary){
      push('summary',{
        stage: summary.stageFinal,
        score: summary.scoreFinal,
        combo: summary.comboMax,
        hp: summary.hpEnd,
        tilt: summary.meanTilt,
        inSafe: summary.stabilityRatio,
        obstacleResult:`avoid=${summary.obstaclesAvoided},hit=${summary.obstaclesHit}`,
        rtReactMs: summary.rtReactMedianMs,
        rtRecoverMs: summary.rtRecoverMedianMs
      });

      if (meta.mode === 'research'){
        const csv = rows.map(r=>r.map(v=>{
          const s = String(v ?? '');
          if (s.includes('"') || s.includes(',')){
            return '"' + s.replace(/"/g,'""') + '"';
          }
          return s;
        }).join(',')).join('\r\n');

        const blob = new Blob([csv],{type:'text/csv'});
        const url  = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vrfitness_balance-${meta.difficulty}-${meta.seed}-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        setTimeout(()=>{
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 120);
      }
    }
  };
}

/* dashboard hook */
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
      arr.push({...summary, ts:Date.now()});
      localStorage.setItem(key, JSON.stringify(arr));
    }catch(e){}
  }
}

/* ---- Session meta ---- */
function buildSessionMeta(diffKey,durationSec){
  let playerId='anon', group='', phase='';
  if (gameMode==='research'){
    const id  = $('#researchId')?.value.trim();
    const grp = $('#researchGroup')?.value.trim();
    const ph  = $('#researchPhase')?.value.trim();
    playerId = id || 'anon';
    group    = grp || '';
    phase    = ph || '';
  }else{
    playerId = String(qs('pid','anon')||'anon').trim() || 'anon';
  }

  const seed = String(qs('seed','')) || String(Date.now());
  return {
    gameId:'balance-hold',
    playerId,group,phase,
    mode: gameMode,
    difficulty: diffKey,
    durationSec,
    seed,
    filePrefix:'vrfitness_balance',
    hub: String(qs('hub','')).trim()
  };
}

/* ---- Stage system (Warm → Trick → Boss) ---- */
function stageFrom(tNorm){
  if (tNorm < 0.40) return { name:'Warm',  w:0.40 };
  if (tNorm < 0.78) return { name:'Trick', w:0.38 };
  return { name:'Boss', w:0.22 };
}
function applyStageToCfg(baseCfg, stageName, proOn, idleBoost){
  // derive each frame (do not mutate baseCfg)
  const pro = proOn ? 1.10 : 1.0;
  const idle = 1 + 2.2*(idleBoost||0);

  let safeMul = 1, freqMul = 1, strMul = 1, driftMul = 1;

  if (stageName === 'Warm'){
    safeMul  = 1.08;
    freqMul  = 1.00;
    strMul   = 0.92;
    driftMul = 0.95;
  }else if (stageName === 'Trick'){
    safeMul  = 0.96;
    freqMul  = 1.12;
    strMul   = 1.08;
    driftMul = 1.15;
  }else{ // Boss
    safeMul  = 0.82;
    freqMul  = 1.45;
    strMul   = 1.22;
    driftMul = 1.30;
  }

  return {
    safeHalf: clamp(baseCfg.safeHalf * safeMul, 0.10, 0.42),
    disturbMinMs: clamp(baseCfg.disturbMinMs / (freqMul*pro), 450, 4000),
    disturbMaxMs: clamp(baseCfg.disturbMaxMs / (freqMul*pro), 650, 5000),
    disturbStrength: clamp(baseCfg.disturbStrength * strMul * pro, 0.12, 0.60),
    passiveDrift: clamp(baseCfg.passiveDrift * driftMul * idle * pro, 0.02, 0.30)
  };
}

/* ---- State ---- */
let gameMode   = 'play'; // 'play' | 'research'
let state      = null;
let rafId      = null;
let logger     = null;
let sessionMeta= null;
let rng        = null;

/* ---- Start game ---- */
function startGame(kind){
  gameMode = (kind==='research' ? 'research' : 'play');

  const diffKey  = elDiffSel?.value || 'normal';
  const durSec   = parseInt(elDurSel?.value || '60',10) || 60;
  const baseCfg  = pickDiff(diffKey);

  sessionMeta = buildSessionMeta(diffKey,durSec);

  // seeded RNG
  const seedStr = `${sessionMeta.seed}|${sessionMeta.playerId}|${sessionMeta.difficulty}|${durSec}`;
  rng = makeRng(seedStr);

  logger      = createCSVLogger(sessionMeta);

  const now = nowMs();
  const proOn = String(qs('pro','0')) === '1' || String(qs('pro','')).toLowerCase() === 'true';

  state = {
    diffKey,
    baseCfg,
    durationMs: durSec*1000,
    startTime: now,
    elapsed: 0,
    proOn,

    // physics
    angle: 0,         // -1..1
    targetAngle: 0,   // -1..1
    lastFrame: now,
    inputActive:false,
    lastInputAt: now,
    lastTargetAngle: 0,

    // persistent bias drift (changes occasionally)
    biasDir: (rng() < 0.5 ? -1 : 1),
    nextBiasFlipAt: now + randBetween(rng, 1600, 3600),

    // sampling
    sampleEveryMs: 110,
    nextSampleAt: now + 110,
    totalSamples: 0,
    stableSamples:0,
    sumTiltAbs: 0,
    sumTiltSq: 0,
    samples: [],   // {tNorm, tilt}

    // obstacles / RT
    nextObstacleAt: now + randBetween(rng, baseCfg.disturbMinMs, baseCfg.disturbMaxMs),
    obstacleSeq: 1,
    obstaclesTotal: 0,
    obstaclesAvoided: 0,
    obstaclesHit: 0,
    pendingReact: null,     // {id, kind, spawnAt, reactedAt, rtReactMs}
    pendingRecover: null,   // {id, impactAt, rtRecoverMs}
    rtReact: [],            // ms
    rtRecover: [],          // ms

    // score / combo / hp
    hp: baseCfg.hp || 3,
    score: 0,
    combo: 0,
    comboMax: 0,
    stableStreakSamples: 0, // used for combo
    lastSafe: true,

    // stage
    stageName: 'Warm',
    stageCfg: applyStageToCfg(baseCfg, 'Warm', proOn, 0),

    fatigueIndex: 0
  };

  lastCoachAt = 0;
  lastCoachSnapshot = null;
  if (coachBubble) coachBubble.classList.add('hidden');

  if (hudMode)  hudMode.textContent = (gameMode==='research'?'Research':'Play');
  if (hudDiff)  hudDiff.textContent = diffKey + (proOn ? ' (PRO)' : '');
  if (hudDur)   hudDur.textContent  = String(durSec);
  if (hudStab)  hudStab.textContent = '0%';
  if (hudObs)   hudObs.textContent  = '0 / 0';
  if (hudTime)  hudTime.textContent = durSec.toFixed(1);
  if (hudScore) hudScore.textContent = '0';
  if (hudCombo) hudCombo.textContent = '0';
  if (hudHp)    hudHp.textContent = String(state.hp);
  if (hudStage) hudStage.textContent = 'Warm';
  if (hudRt)    hudRt.textContent = '-';

  if (coachLabel) coachLabel.textContent =
    'ลากซ้าย–ขวาเพื่อคุม “จุด” ให้อยู่โซนปลอดภัย / Drag left–right to balance';

  if (rafId!=null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);

  showView('play');
}

/* main loop */
function loop(now){
  if (!state) return;
  const dt = Math.max(0, now - state.lastFrame);
  state.lastFrame = now;

  state.elapsed = now - state.startTime;
  const remainMs = Math.max(0, state.durationMs - state.elapsed);
  if (hudTime) hudTime.textContent = (remainMs/1000).toFixed(1);

  // stage update
  const tNorm = state.durationMs ? (state.elapsed / state.durationMs) : 0;
  const st = stageFrom(tNorm);
  state.stageName = st.name;

  // idle punish (if no input)
  const idleMs = now - (state.lastInputAt || state.startTime);
  const idleBoost = idleMs > 1200 ? clamp01((idleMs - 1200)/2200) : 0;

  // flip bias occasionally (not per-frame)
  if (now >= state.nextBiasFlipAt){
    state.biasDir *= -1;
    state.nextBiasFlipAt = now + randBetween(rng, 1400, 3400);
  }

  // stage cfg derived
  state.stageCfg = applyStageToCfg(state.baseCfg, state.stageName, state.proOn, idleBoost);
  if (hudStage) hudStage.textContent = state.stageName;

  // end by timeout
  if (state.elapsed >= state.durationMs){
    stopGame('timeout');
    return;
  }

  // physics: move angle toward target + bias drift (persistent)
  const cfg = state.stageCfg;

  // drift is velocity-like push (persistent bias) — makes "do nothing" fail
  const drift = state.biasDir * cfg.passiveDrift * (dt/1000);

  // tighter follow makes control feel responsive
  const lerp = (state.stageName === 'Warm') ? 0.12 : (state.stageName === 'Trick' ? 0.13 : 0.14);

  const target = state.targetAngle + drift;
  state.angle += (target - state.angle) * lerp;

  // clamp
  state.angle = clamp(state.angle, -1.25, 1.25);
  state.targetAngle = clamp(state.targetAngle, -1, 1);

  // update visuals
  updateVisuals();

  // sampling stability & scoring
  if (now >= state.nextSampleAt){
    const safeHalf = cfg.safeHalf;
    const inSafe = Math.abs(state.angle) <= safeHalf;

    state.totalSamples++;
    if (inSafe) state.stableSamples++;

    const absTilt = Math.abs(state.angle);
    state.sumTiltAbs += absTilt;
    state.sumTiltSq  += absTilt*absTilt;
    state.samples.push({tNorm, tilt:absTilt});

    // combo/streak scoring: reward sustained inSafe
    if (inSafe){
      state.stableStreakSamples++;
      // every ~0.55s of sustained safe -> combo++
      if (state.stableStreakSamples % 5 === 0){
        state.combo = Math.min(99, state.combo + 1);
        state.comboMax = Math.max(state.comboMax, state.combo);
        // score: base + combo bonus (stage multiplier)
        const stageMul = (state.stageName === 'Warm') ? 1.0 : (state.stageName === 'Trick' ? 1.25 : 1.55);
        state.score += Math.round(10 * stageMul + state.combo * 2);
      }
    }else{
      state.stableStreakSamples = 0;
      state.combo = Math.max(0, state.combo - 1); // soft drop, not full reset
    }

    // recover RT check: if we were recovering and now inSafe
    if (state.pendingRecover && inSafe){
      const rt = Math.max(0, now - state.pendingRecover.impactAt);
      state.pendingRecover.rtRecoverMs = rt;
      state.rtRecover.push(rt);
      state.pendingRecover = null;
    }

    // log sample
    logger && logger.logSample({
      stage: state.stageName,
      score: state.score,
      combo: state.combo,
      hp: state.hp,
      tilt: state.angle.toFixed(4),
      targetTilt: state.targetAngle.toFixed(4),
      inSafe: inSafe ? 1 : 0
    });

    // HUD
    const stabRatio = state.totalSamples ? state.stableSamples/state.totalSamples : 0;
    if (hudStab)  hudStab.textContent = fmtPercent(stabRatio);
    if (hudScore) hudScore.textContent = String(state.score);
    if (hudCombo) hudCombo.textContent = String(state.combo);
    if (hudHp)    hudHp.textContent = String(state.hp);

    updateCoach();

    state.nextSampleAt = now + state.sampleEveryMs;
  }

  // obstacles
  if (now >= state.nextObstacleAt){
    spawnObstacle(now);
  }

  rafId = requestAnimationFrame(loop);
}

/* visuals */
function updateVisuals(){
  if (!platformEl || !indicatorEl || !state) return;
  const maxDeg = 18;
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

/* obstacles */
function spawnObstacle(now){
  if (!state || !obstacleLayer) return;

  const cfg = state.stageCfg;
  const id = state.obstacleSeq++;
  state.obstaclesTotal++;

  // telegraph kind influences knock
  const roll = rng();
  const kind = (roll < 0.58) ? 'gust' : (roll < 0.86 ? 'bomb' : 'shock');
  const emoji = (kind === 'gust') ? '💨' : (kind === 'bomb' ? '💣' : '⚡');

  const span = document.createElement('div');
  span.className = 'obstacle';
  span.textContent = emoji;

  const wrapRect = playArea?.getBoundingClientRect();
  const xNorm = (rng()*2 - 1); // -1..1
  const pxX = wrapRect ? (wrapRect.width/2 + xNorm*(wrapRect.width*0.32)) : 0;
  span.style.left = pxX+'px';

  // slight scale for boss
  if (state.stageName === 'Boss') span.style.transform = 'scale(1.08)';

  obstacleLayer.appendChild(span);
  setTimeout(()=> span.remove(), 1400);

  // --- RT: create pending react measurement ---
  state.pendingReact = { id, kind, spawnAt: now, reactedAt: null, rtReactMs: null };

  // resolve at impact time
  const impactDelay = (kind === 'shock') ? 820 : 950;
  const impactAt = now + impactDelay;

  setTimeout(()=>{
    if (!state) return;

    const safeHalf = cfg.safeHalf;
    const absTilt = Math.abs(state.angle);
    const inSafe = absTilt <= safeHalf;

    let obstacleResult = 'avoid';
    let rtRecoverMs = '';

    if (inSafe){
      span.classList.add('avoid');
      state.obstaclesAvoided++;

      // bonus for avoid (stage weighted)
      const stageMul = (state.stageName === 'Warm') ? 1.0 : (state.stageName === 'Trick' ? 1.2 : 1.45);
      state.score += Math.round(18 * stageMul);
      // keep combo alive a bit
      state.combo = Math.min(99, state.combo + 1);
      state.comboMax = Math.max(state.comboMax, state.combo);

    }else{
      span.classList.add('hit');
      state.obstaclesHit++;
      obstacleResult = 'hit';

      // HP loss
      state.hp = Math.max(0, (state.hp||3) - 1);

      // score penalty and combo drop
      state.score = Math.max(0, state.score - 35);
      state.combo = Math.max(0, state.combo - 3);
      state.stableStreakSamples = 0;

      // knock: depends on kind
      const knockBase = cfg.disturbStrength * (kind === 'gust' ? 0.85 : (kind === 'bomb' ? 1.05 : 1.25));
      const knockDir = (state.angle>=0 ? 1 : -1);
      state.angle += knockDir * knockBase;

      // start recovery RT timer (until return to safe)
      state.pendingRecover = { id, impactAt, rtRecoverMs: null };

      // fail early if HP depleted
      if (state.hp <= 0){
        logger && logger.logObstacle({
          stage: state.stageName,
          score: state.score,
          combo: state.combo,
          hp: state.hp,
          obstacleId:id,
          obstacleKind: kind,
          obstacleResult,
          tilt: state.angle.toFixed(4),
          inSafe: 0,
          rtReactMs: (state.pendingReact && state.pendingReact.id===id && state.pendingReact.rtReactMs!=null) ? Math.round(state.pendingReact.rtReactMs) : '',
          rtRecoverMs: ''
        });
        stopGame('fail');
        return;
      }
    }

    // finalize react RT if available
    let rtReactMs = '';
    if (state.pendingReact && state.pendingReact.id === id){
      if (state.pendingReact.rtReactMs != null){
        rtReactMs = Math.round(state.pendingReact.rtReactMs);
        state.rtReact.push(state.pendingReact.rtReactMs);

        // HUD RT
        if (hudRt) hudRt.textContent = `${rtReactMs}ms`;
      }
      // clear pending react after impact
      state.pendingReact = null;
    }

    logger && logger.logObstacle({
      stage: state.stageName,
      score: state.score,
      combo: state.combo,
      hp: state.hp,
      obstacleId:id,
      obstacleKind: kind,
      obstacleResult,
      tilt: state.angle.toFixed(4),
      inSafe: inSafe?1:0,
      rtReactMs,
      rtRecoverMs
    });

    if (hudObs){
      hudObs.textContent = `${state.obstaclesAvoided} / ${state.obstaclesTotal}`;
    }
    if (hudScore) hudScore.textContent = String(state.score);
    if (hudCombo) hudCombo.textContent = String(state.combo);
    if (hudHp) hudHp.textContent = String(state.hp);

  }, Math.max(0, impactAt - nowMs()));

  // schedule next obstacle (stage dependent)
  state.nextObstacleAt = now + randBetween(rng, cfg.disturbMinMs, cfg.disturbMaxMs);
}

/* ---- Analytics ---- */
function median(arr){
  const a = (arr||[]).filter(x=>Number.isFinite(x)).slice().sort((x,y)=>x-y);
  if (!a.length) return null;
  const mid = Math.floor(a.length/2);
  return (a.length%2) ? a[mid] : (a[mid-1]+a[mid])/2;
}
function mean(arr){
  const a = (arr||[]).filter(x=>Number.isFinite(x));
  if (!a.length) return null;
  return a.reduce((s,x)=>s+x,0)/a.length;
}

function computeAnalytics(){
  if (!state || !state.totalSamples){
    return {
      stabilityRatio:0,
      meanTilt:0,
      rmsTilt:0,
      fatigueIndex:0,
      samples:0
    };
  }
  const n = state.totalSamples;
  const stabRatio = state.stableSamples / n;
  const meanTilt  = state.sumTiltAbs / n;
  const rmsTilt   = Math.sqrt(state.sumTiltSq / n);

  // fatigue: compare first 25% vs last 25% of samples
  let fatigue = 0;
  if (state.samples.length>=10){
    const arr = state.samples;
    const seg = Math.max(3, Math.floor(arr.length*0.25));
    const early = arr.slice(0, seg);
    const late  = arr.slice(-seg);
    const mE = early.reduce((a,b)=>a+b.tilt,0)/early.length;
    const mL = late.reduce((a,b)=>a+b.tilt,0)/late.length;
    if (mE>0) fatigue = (mL-mE)/mE;
  }

  return {
    stabilityRatio: stabRatio,
    meanTilt,
    rmsTilt,
    fatigueIndex: fatigue,
    samples: n
  };
}

/* ---- Stop & summary ---- */
function stopGame(endedBy){
  if (!state) return;
  if (rafId!=null){ cancelAnimationFrame(rafId); rafId=null; }

  const a = computeAnalytics();
  const totalObs = state.obstaclesAvoided + state.obstaclesHit;
  const avoidRate = totalObs ? (state.obstaclesAvoided/totalObs) : 0;

  const rtReactMed = median(state.rtReact);
  const rtReactMean= mean(state.rtReact);
  const rtRecMed   = median(state.rtRecover);
  const rtRecMean  = mean(state.rtRecover);

  // Perfect criteria (no freebies)
  const perfect =
    (a.stabilityRatio >= 0.85) &&
    (state.obstaclesHit <= 1) &&
    (state.hp >= Math.max(1, (state.baseCfg.hp||3)-1)) &&
    (rtReactMed == null || rtReactMed <= 650);

  const summary = {
    gameId:'balance-hold',
    mode: sessionMeta?.mode || gameMode,
    difficulty: state.diffKey + (state.proOn ? '-PRO' : ''),
    durationSec: (state.durationMs/1000),
    seed: sessionMeta?.seed || '',

    stabilityRatio: a.stabilityRatio,
    meanTilt: a.meanTilt,
    rmsTilt: a.rmsTilt,
    fatigueIndex: a.fatigueIndex,

    obstaclesAvoided: state.obstaclesAvoided,
    obstaclesHit: state.obstaclesHit,
    avoidRate,

    scoreFinal: state.score,
    comboMax: state.comboMax,
    hpEnd: state.hp,
    stageFinal: state.stageName,

    rtReactMedianMs: rtReactMed != null ? Math.round(rtReactMed) : null,
    rtReactMeanMs: rtReactMean != null ? Math.round(rtReactMean) : null,
    rtRecoverMedianMs: rtRecMed != null ? Math.round(rtRecMed) : null,
    rtRecoverMeanMs: rtRecMean != null ? Math.round(rtRecMean) : null,

    perfect: perfect ? 1 : 0
  };

  logger && logger.finish(summary);
  recordSessionToDashboard('balance-hold', summary);

  // save last summary for Hub (lightweight)
  try{
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
      gameId:'balance-hold',
      score: summary.scoreFinal,
      rank: perfect ? 'PERFECT' : (summary.scoreFinal >= 650 ? 'A' : (summary.scoreFinal >= 450 ? 'B' : (summary.scoreFinal >= 260 ? 'C' : 'D'))),
      stabilityRatio: summary.stabilityRatio,
      ts: Date.now()
    }));
  }catch(e){}

  fillResultView(endedBy, summary);

  state = null;
  showView('result');
}

function fillResultView(endedBy, summary){
  const modeLabel = summary.mode==='research' ? 'Research' : 'Play';

  if (resMode) resMode.textContent = modeLabel;
  if (resDiff) resDiff.textContent = summary.difficulty || '-';
  if (resDur)  resDur.textContent  = String(summary.durationSec || '-');
  if (resEnd)  resEnd.textContent  = mapEndReason(endedBy);

  if (resStab)     resStab.textContent     = fmtPercent(summary.stabilityRatio || 0);
  if (resMeanTilt) resMeanTilt.textContent = fmtFloat(summary.meanTilt || 0,3);
  if (resRmsTilt)  resRmsTilt.textContent  = fmtFloat(summary.rmsTilt || 0,3);

  if (resAvoid) resAvoid.textContent = String(summary.obstaclesAvoided || 0);
  if (resHit)   resHit.textContent   = String(summary.obstaclesHit || 0);
  if (resAvoidRate) resAvoidRate.textContent = fmtPercent(summary.avoidRate || 0);

  if (resFatigue) resFatigue.textContent = fmtFloat(summary.fatigueIndex || 0,3);
  if (resSamples) resSamples.textContent = String(summary.samples || 0);

  if (resScore)    resScore.textContent = String(summary.scoreFinal || 0);
  if (resComboMax) resComboMax.textContent = String(summary.comboMax || 0);
  if (resHpEnd)    resHpEnd.textContent = String(summary.hpEnd ?? '-');
  if (resRtMed)    resRtMed.textContent = (summary.rtReactMedianMs!=null) ? `${summary.rtReactMedianMs}ms` : '-';
  if (resRtMean)   resRtMean.textContent= (summary.rtReactMeanMs!=null) ? `${summary.rtReactMeanMs}ms` : '-';

  // Back HUB button (auto create if missing)
  const hub = (sessionMeta && sessionMeta.hub) ? sessionMeta.hub : String(qs('hub','')).trim();
  if (hub){
    let b = btnBackHub;
    if (!b && viewResult){
      b = document.createElement('button');
      b.id = 'btnBackHub';
      b.className = 'btn'; // use existing css if present
      b.textContent = '⬅ กลับ HUB';
      b.style.marginTop = '12px';
      viewResult.appendChild(b);
    }
    if (b){
      b.addEventListener('click', ()=>{ location.href = hub; });
      b.style.display = '';
    }
  }
}

/* ---- Input handling ---- */
function attachInput(){
  if (!playArea) return;

  let active = false;

  function updateTargetFromEvent(ev){
    if (!state) return;

    const rect = playArea.getBoundingClientRect();
    const x = ev.clientX ?? (ev.touches && ev.touches[0]?.clientX);
    if (x==null) return;
    const relX = (x - rect.left) / rect.width; // 0..1
    const norm = (relX - 0.5) * 2; // -1..1

    const prev = state.targetAngle;
    state.targetAngle = clamp(norm, -1, 1);

    // mark input time
    state.lastInputAt = nowMs();

    // RT react detection: if obstacle pending and not reacted, detect meaningful change
    if (state.pendingReact && state.pendingReact.reactedAt == null){
      const d = Math.abs(state.targetAngle - prev);
      if (d >= 0.06){
        state.pendingReact.reactedAt = state.lastInputAt;
        state.pendingReact.rtReactMs = Math.max(0, state.pendingReact.reactedAt - state.pendingReact.spawnAt);
        // HUD
        if (hudRt) hudRt.textContent = `${Math.round(state.pendingReact.rtReactMs)}ms`;
      }
    }
  }

  playArea.addEventListener('pointerdown', ev=>{
    active = true;
    if (state) state.inputActive = true;
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
    if (state) state.inputActive = false;
    try{ playArea.releasePointerCapture(ev.pointerId); }catch(e){}
    ev.preventDefault();
  }, {passive:false});

  playArea.addEventListener('pointercancel', ev=>{
    active = false;
    if (state) state.inputActive = false;
    ev.preventDefault();
  }, {passive:false});
}

/* ---- Init ---- */
function init(){
  // menu actions
  $('[data-action="start-normal"]')?.addEventListener('click',()=>{
    startGame('play');
  });
  $('[data-action="goto-research"]')?.addEventListener('click',()=>{
    showView('research');
  });
  $$('[data-action="back-menu"]').forEach(btn=>{
    btn.addEventListener('click',()=> showView('menu'));
  });

  $('[data-action="start-research"]')?.addEventListener('click',()=>{
    startGame('research');
  });

  $('[data-action="stop"]')?.addEventListener('click',()=>{
    if (state) stopGame('manual');
  });

  $('[data-action="play-again"]')?.addEventListener('click',()=>{
    showView('menu');
  });

  attachInput();
  showView('menu');
}

window.addEventListener('DOMContentLoaded', init);