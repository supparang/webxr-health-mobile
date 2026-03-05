// === /fitness/js/balance-hold.js ===
// Balance Hold — PRODUCTION (SEEDED + OBSTACLES + 3-STAGE + BOSS PATTERN + SHIELD + FX + AUTOSTART)
// PATCH v20260305-BH-FULL-FINAL
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
const hudScore    = $('#hud-score');
const hudCombo    = $('#hud-combo');
const hudHp       = $('#hud-hp');
const hudStage    = $('#hud-stage');
const hudRt       = $('#hud-rt');

const playArea      = $('#playArea');
const platformWrap  = $('#platform-wrap');
const platformEl    = $('#platform');
const indicatorEl   = $('#indicator');
let obstacleLayer   = $('#obstacle-layer');
const coachLabel    = $('#coachLabel');
const coachBubble   = $('#coachBubble');

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

const btnBackHub     = $('#btnBackHub');

/* ---- helpers ---- */
const clamp   = (v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
const clamp01 = (x)=>clamp(x,0,1);
const nowMs   = ()=> (performance && performance.now) ? performance.now() : Date.now();
const fmtPercent = (v)=>(v==null||Number.isNaN(v))?'-':(v*100).toFixed(1)+'%';
const fmtFloat   = (v,d=2)=>(v==null||Number.isNaN(v))?'-':v.toFixed(d);
function qs(k, d=''){ try { return new URL(location.href).searchParams.get(k) ?? d; } catch { return d; } }

function showView(name){
  [viewMenu,viewResearch,viewPlay,viewResult].forEach(v=>v && v.classList.add('hidden'));
  if (name==='menu')     viewMenu && viewMenu.classList.remove('hidden');
  if (name==='research') viewResearch && viewResearch.classList.remove('hidden');
  if (name==='play')     viewPlay && viewPlay.classList.remove('hidden');
  if (name==='result')   viewResult && viewResult.classList.remove('hidden');
}

function mapEndReason(code){
  switch(code){
    case 'timeout': return 'ครบเวลาที่กำหนด / Timeout';
    case 'manual':  return 'หยุดเอง / Stopped by player';
    case 'fail':    return 'เสียสมดุล (HP หมด) / Failed';
    default:        return code || '-';
  }
}

/* ---- RNG (seeded) ---- */
function xmur3(str){
  str = String(str||''); let h = 1779033703 ^ str.length;
  for (let i=0;i<str.length;i++){ h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h<<13)|(h>>>19); }
  return function(){ h = Math.imul(h ^ (h>>>16), 2246822507); h = Math.imul(h ^ (h>>>13), 3266489909); return (h ^= (h>>>16))>>>0; };
}
function mulberry32(a){
  let t = a>>>0;
  return function(){ t += 0x6D2B79F5; let r = Math.imul(t ^ (t>>>15), 1|t); r ^= r + Math.imul(r ^ (r>>>7), 61|r); return ((r ^ (r>>>14))>>>0)/4294967296; };
}
function makeRng(seedStr){ const g=xmur3(seedStr); return mulberry32(g()); }
function randBetween(rng,a,b){ return a + rng()*(b-a); }

/* ---- FX helpers ---- */
function popText(msg, isBad=false){
  const fx = document.getElementById('fx-layer');
  if(!fx) return;
  const d = document.createElement('div');
  d.className = 'pop';
  d.textContent = msg;
  if (isBad) d.style.borderColor = 'rgba(239,68,68,.25)';
  fx.appendChild(d);
  setTimeout(()=> d.remove(), 950);
}

function shakePlay(){
  const el = document.getElementById('playArea');
  if(!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  setTimeout(()=> el.classList.remove('shake'), 260);
}

/* ---- Ensure layers ---- */
function ensureObstacleLayer(){
  if (obstacleLayer) return obstacleLayer;
  if (!playArea) return null;

  const div = document.createElement('div');
  div.id = 'obstacle-layer';
  div.className = 'obstacle-layer';
  div.style.position = 'absolute';
  div.style.left = '0';
  div.style.top = '0';
  div.style.right = '0';
  div.style.bottom = '0';
  div.style.pointerEvents = 'none';
  div.style.zIndex = '6';
  playArea.style.position = playArea.style.position || 'relative';
  playArea.appendChild(div);

  obstacleLayer = div;
  return obstacleLayer;
}

/* ---- Difficulty ---- */
const GAME_DIFF = {
  easy:   { safeHalf:0.34, disturbMinMs:1500, disturbMaxMs:2700, disturbStrength:0.20, passiveDrift:0.070, hp:4 },
  normal: { safeHalf:0.25, disturbMinMs:1200, disturbMaxMs:2200, disturbStrength:0.26, passiveDrift:0.095, hp:3 },
  hard:   { safeHalf:0.18, disturbMinMs: 900, disturbMaxMs:1700, disturbStrength:0.33, passiveDrift:0.125, hp:3 }
};
function pickDiff(key){ return GAME_DIFF[key] || GAME_DIFF.normal; }

/* ---- Coach ---- */
const COACH_LINES = {
  welcome:'ลากซ้าย–ขวาเพื่อคุมให้อยู่โซนปลอดภัย / Drag left–right to balance',
  drift:'เอียงค้างนานไป—ดันกลับกลางช้า ๆ / Drift—return to center',
  hit:'โดนแรงรบกวน! ตั้งหลักไว ๆ / Hit! Recover fast',
  boss:'บอสมาแล้ว! โซนแคบลง / Boss! Narrow safe zone'
};
let lastCoachAt=0;
const COACH_COOLDOWN_MS=4500;
function showCoach(key){
  if (!coachBubble) return;
  const now = nowMs();
  if (now - lastCoachAt < COACH_COOLDOWN_MS) return;
  const msg = COACH_LINES[key];
  if (!msg) return;
  lastCoachAt = now;
  coachBubble.textContent = msg;
  coachBubble.classList.remove('hidden');
  setTimeout(()=> coachBubble && coachBubble.classList.add('hidden'), 4200);
}

/* ---- Stage ---- */
function stageFrom(tNorm){
  if (tNorm < 0.40) return 'Warm';
  if (tNorm < 0.78) return 'Trick';
  return 'Boss';
}
function stageCfg(base, stage, pro, idleBoost){
  const proMul = pro ? 1.10 : 1.0;
  const idleMul = 1 + 2.2*(idleBoost||0);

  let safeMul=1, freqMul=1, strMul=1, driftMul=1;
  if (stage==='Warm'){ safeMul=1.06; freqMul=1.00; strMul=0.92; driftMul=0.95; }
  else if(stage==='Trick'){ safeMul=0.96; freqMul=1.18; strMul=1.10; driftMul=1.20; }
  else { safeMul=0.82; freqMul=1.52; strMul=1.25; driftMul=1.35; }

  return {
    safeHalf: clamp(base.safeHalf*safeMul, 0.10, 0.42),
    disturbMinMs: clamp(base.disturbMinMs/(freqMul*proMul), 450, 4000),
    disturbMaxMs: clamp(base.disturbMaxMs/(freqMul*proMul), 650, 5000),
    disturbStrength: clamp(base.disturbStrength*strMul*proMul, 0.12, 0.60),
    passiveDrift: clamp(base.passiveDrift*driftMul*idleMul*proMul, 0.02, 0.32)
  };
}

/* ---- Boss Director (A/B + Sweep) ---- */
function bossDirectorTick(now, stage, cfg){
  if (!state) return;

  if (stage === 'Boss' && state.boss.lastStage !== 'Boss'){
    state.boss.active = true;
    state.boss.waveIndex = 0;
    state.boss.nextWaveAt = now + 450;
    showCoach('boss');
    popText('⚡ Boss Phase!');
  }
  state.boss.lastStage = stage;

  if (!state.boss.active || stage !== 'Boss') return;

  const baseGap = 2200;
  const gap = clamp(baseGap * (cfg.safeHalf <= 0.18 ? 0.85 : 1.0), 1400, 2600);

  if (now >= state.boss.nextWaveAt){
    spawnBossWave(now, cfg, state.boss.waveIndex++);
    state.boss.nextWaveAt = now + gap;
  }
}

function spawnBossWave(now, cfg, waveIndex){
  const mode = (waveIndex % 3); // 0=A,1=B,2=SWEEP

  if (mode === 2){
    popText(`⚡ Sweep ${Math.floor(waveIndex/3)+1}`);

    const steps = [-0.85,-0.45,-0.05,0.35,0.75];
    steps.forEach((xNorm, i)=>{
      setTimeout(()=>{
        if (!state) return;
        spawnObstacle(nowMs(), cfg, { kind:'shock', xNorm, impactDelay: 720, forceBoss:true });
      }, i*140);
    });

    setTimeout(()=>{ if(state) state.biasDir *= -1; }, 820);
    return;
  }

  const A = [-0.78,  0.00,  0.78];
  const B = [ 0.78,  0.00, -0.78];
  const arr = (mode === 0) ? A : B;

  popText(`⚡ Wave ${waveIndex+1}`);

  [0,180,360].forEach((off, i)=>{
    setTimeout(()=>{
      if (!state) return;
      spawnObstacle(nowMs(), cfg, { kind:'shock', xNorm: arr[i], impactDelay: 740, forceBoss:true });
    }, off);
  });

  setTimeout(()=>{ if(state) state.biasDir *= -1; }, 520);
}

/* ---- Shield pickup ---- */
function spawnShield(now){
  if (!state) return;
  ensureObstacleLayer();
  if (!obstacleLayer || !playArea) return;

  const wrapRect = playArea.getBoundingClientRect();
  const xNorm = (rng()*2 - 1);
  const pxX = wrapRect.width/2 + xNorm*(wrapRect.width*0.30);

  const el = document.createElement('div');
  el.className = 'obstacle';
  el.textContent = '🛡️';
  el.style.top = '14%';
  el.style.left = pxX+'px';
  el.style.fontSize = '30px';
  el.style.opacity = '0.95';
  obstacleLayer.appendChild(el);

  const pickupAt = now + 900;
  setTimeout(()=>{
    if (!state){ try{el.remove();}catch{} return; }

    const inSafe = Math.abs(state.angle) <= (state.stageCfg?.safeHalf ?? state.baseCfg.safeHalf);
    if (inSafe){
      state.shield = Math.min(2, (state.shield||0) + 1);
      state.score += 40;
      popText('🛡️ Shield +1');
    }else{
      popText('🛡️ Missed', true);
    }
    try{ el.remove(); }catch{}
  }, Math.max(0, pickupAt - nowMs()));

  setTimeout(()=>{ try{ el.remove(); }catch{} }, 1400);
}

/* ---- State ---- */
let gameMode='play';
let state=null;
let rafId=null;
let rng=null;

function buildSessionMeta(diffKey, durSec){
  const seed = String(qs('seed','')) || String(Date.now());
  const hub  = String(qs('hub','')).trim();
  const pid  = String(qs('pid','anon')).trim() || 'anon';
  return { diffKey, durSec, seed, hub, pid };
}

/* ---- Start ---- */
function startGame(kind){
  gameMode = (kind==='research' ? 'research' : 'play');

  const diffKey = elDiffSel?.value || String(qs('diff','normal')||'normal');
  const durSec  = parseInt(elDurSel?.value || String(qs('time','80')||'80'),10) || 80;
  const baseCfg = pickDiff(diffKey);
  const proOn   = String(qs('pro','0'))==='1' || String(qs('pro','')).toLowerCase()==='true';

  const meta = buildSessionMeta(diffKey, durSec);
  rng = makeRng(`${meta.seed}|${meta.pid}|${diffKey}|${durSec}`);

  ensureObstacleLayer();

  const now = nowMs();
  state = {
    baseCfg,
    proOn,
    durationMs: durSec*1000,
    startTime: now,
    lastFrame: now,
    elapsed: 0,

    angle: 0,
    targetAngle: 0,
    lastInputAt: now,

    biasDir: (rng()<0.5 ? -1 : 1),
    nextBiasFlipAt: now + randBetween(rng, 1600, 3600),

    nextObstacleAt: now + randBetween(rng, baseCfg.disturbMinMs, baseCfg.disturbMaxMs),
    obstacleSeq: 1,
    obstaclesTotal: 0,
    obstaclesAvoided: 0,
    obstaclesHit: 0,

    sampleEveryMs: 110,
    nextSampleAt: now + 110,
    totalSamples: 0,
    stableSamples: 0,
    sumTiltAbs: 0,
    sumTiltSq: 0,
    samples: [],

    hp: baseCfg.hp || 3,
    shield: 0,
    nextShieldAt: now + 9000,

    score: 0,
    combo: 0,
    comboMax: 0,
    stableStreak: 0,
    hasSeenObstacle: false,

    // cache current stage cfg for shield pickup checks
    stageCfg: baseCfg,

    boss: { active:false, nextWaveAt:0, waveIndex:0, lastStage:'Warm' },
  };

  if (hudMode)  hudMode.textContent = (gameMode==='research'?'Research':'Play');
  if (hudDiff)  hudDiff.textContent = diffKey + (proOn?' (PRO)':'');
  if (hudDur)   hudDur.textContent = String(durSec);
  if (hudStab)  hudStab.textContent = '0%';
  if (hudObs)   hudObs.textContent = '0 / 0';
  if (hudTime)  hudTime.textContent = durSec.toFixed(1);
  if (hudScore) hudScore.textContent = '0';
  if (hudCombo) hudCombo.textContent = '0';
  if (hudHp)    hudHp.textContent = String(state.hp);
  if (hudStage) hudStage.textContent = 'Warm';
  if (hudRt)    hudRt.textContent = '-';

  if (coachLabel) coachLabel.textContent = 'ลากซ้าย–ขวาเพื่อคุมสมดุล / Drag left–right to balance';
  if (coachBubble) coachBubble.classList.add('hidden');
  lastCoachAt = 0;
  showCoach('welcome');

  if (rafId!=null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
  showView('play');
}

/* ---- loop ---- */
function loop(now){
  if (!state) return;

  const dt = Math.max(0, now - state.lastFrame);
  state.lastFrame = now;

  state.elapsed = now - state.startTime;
  const remainMs = Math.max(0, state.durationMs - state.elapsed);
  if (hudTime) hudTime.textContent = (remainMs/1000).toFixed(1);

  if (state.elapsed >= state.durationMs){
    stopGame('timeout');
    return;
  }

  const tNorm = state.durationMs ? (state.elapsed/state.durationMs) : 0;
  const stage = stageFrom(tNorm);
  if (hudStage) hudStage.textContent = stage;

  const idleMs = now - (state.lastInputAt || state.startTime);
  const idleBoost = idleMs > 1200 ? clamp01((idleMs-1200)/2200) : 0;

  if (now >= state.nextBiasFlipAt){
    state.biasDir *= -1;
    state.nextBiasFlipAt = now + randBetween(rng, 1400, 3400);
  }

  const cfg = stageCfg(state.baseCfg, stage, state.proOn, idleBoost);
  state.stageCfg = cfg;

  // Boss waves
  bossDirectorTick(now, stage, cfg);

  // Shield spawn (more often in Trick/Boss)
  if (now >= (state.nextShieldAt||0)){
    spawnShield(now);
    const base = (stage==='Warm') ? 12000 : (stage==='Trick' ? 9000 : 6500);
    state.nextShieldAt = now + randBetween(rng, base*0.85, base*1.15);
  }

  // physics
  const lerp = (stage==='Warm') ? 0.12 : (stage==='Trick' ? 0.13 : 0.14);
  const drift = state.biasDir * cfg.passiveDrift * (dt/1000);
  const target = state.targetAngle + drift;
  state.angle += (target - state.angle) * lerp;
  state.angle = clamp(state.angle, -1.25, 1.25);
  state.targetAngle = clamp(state.targetAngle, -1, 1);

  updateVisuals();

  // sampling
  if (now >= state.nextSampleAt){
    const inSafe = Math.abs(state.angle) <= cfg.safeHalf;

    state.totalSamples++;
    if (inSafe) state.stableSamples++;

    const absTilt = Math.abs(state.angle);
    state.sumTiltAbs += absTilt;
    state.sumTiltSq  += absTilt*absTilt;
    state.samples.push({tNorm, tilt:absTilt});

    // anti-free-farm scoring
    if (!state.hasSeenObstacle){
      if (inSafe) state.score += 1;
      if (idleBoost > 0.7) state.score = Math.max(0, state.score - 2);
      state.combo = 0;
      state.stableStreak = 0;
    }else{
      if (inSafe){
        state.stableStreak++;
        if (state.stableStreak % 5 === 0){
          state.combo = Math.min(99, state.combo + 1);
          state.comboMax = Math.max(state.comboMax, state.combo);
          const mul = (stage==='Warm') ? 1.0 : (stage==='Trick' ? 1.25 : 1.55);
          state.score += Math.round(10*mul + state.combo*2);
        }
      }else{
        state.stableStreak = 0;
        state.combo = Math.max(0, state.combo - 1);
      }
    }

    const stabRatio = state.totalSamples ? state.stableSamples/state.totalSamples : 0;
    if (hudStab)  hudStab.textContent = fmtPercent(stabRatio);
    if (hudScore) hudScore.textContent = String(state.score);
    if (hudCombo) hudCombo.textContent = String(state.combo);
    if (hudHp)    hudHp.textContent = `${state.hp}${(state.shield>0)?` • 🛡️${state.shield}`:''}`;

    // drift coach
    if (absTilt > 0.60 && stage !== 'Warm') showCoach('drift');

    state.nextSampleAt = now + state.sampleEveryMs;
  }

  // normal obstacles (outside boss waves too)
  if (now >= state.nextObstacleAt){
    spawnObstacle(now, cfg, null);
  }

  rafId = requestAnimationFrame(loop);
}

/* ---- visuals ---- */
function updateVisuals(){
  if (!platformEl || !indicatorEl || !state) return;

  const maxDeg = 18;
  platformEl.style.transform = `rotate(${(state.angle*maxDeg).toFixed(3)}deg)`;

  const wrapRect = platformWrap?.getBoundingClientRect();
  if (wrapRect){
    const halfW = wrapRect.width * 0.34;
    indicatorEl.style.transform = `translateX(${(state.angle*halfW).toFixed(2)}px) translateY(-18px)`;
  }

  if (hudObs){
    hudObs.textContent = `${state.obstaclesAvoided} / ${state.obstaclesTotal}`;
  }
}

/* ---- obstacle ---- */
function spawnObstacle(now, cfg, opt){
  ensureObstacleLayer();
  if (!state || !obstacleLayer) return;

  opt = opt || {};
  const id = state.obstacleSeq++;
  state.obstaclesTotal++;
  state.hasSeenObstacle = true;

  const kind = opt.kind || ((rng() < 0.58) ? 'gust' : (rng() < 0.86 ? 'bomb' : 'shock'));
  const emoji = (kind==='gust') ? '💨' : (kind==='bomb' ? '💣' : '⚡');

  const span = document.createElement('div');
  span.className = 'obstacle';
  span.textContent = emoji;
  span.style.position = 'absolute';
  span.style.top = (opt.forceBoss ? '8%' : '18%');
  span.style.fontSize = (kind==='shock') ? '32px' : '28px';
  span.style.filter = 'drop-shadow(0 10px 20px rgba(0,0,0,.55))';

  const wrapRect = playArea?.getBoundingClientRect();
  const xNorm = (typeof opt.xNorm === 'number') ? opt.xNorm : (rng()*2 - 1);
  const pxX = wrapRect ? (wrapRect.width/2 + xNorm*(wrapRect.width*0.32)) : 0;
  span.style.left = pxX+'px';

  obstacleLayer.appendChild(span);
  setTimeout(()=> span.remove(), 1600);

  const impactDelay = opt.impactDelay || ((kind==='shock') ? 820 : 950);
  const impactAt = now + impactDelay;

  setTimeout(()=>{
    if (!state) return;

    const inSafe = Math.abs(state.angle) <= cfg.safeHalf;

    if (inSafe){
      state.obstaclesAvoided++;
      state.score += (kind==='shock' ? 30 : 18);
      state.combo = Math.min(99, state.combo + 1);
      state.comboMax = Math.max(state.comboMax, state.combo);
      span.classList.add('avoid');
      popText('+Avoid');
    }else{
      // shield block
      if ((state.shield||0) > 0){
        state.shield -= 1;
        state.obstaclesAvoided++;
        span.classList.add('avoid');
        popText('🛡️ Block!');
        shakePlay();
        if (hudHp) hudHp.textContent = `${state.hp}${(state.shield>0)?` • 🛡️${state.shield}`:''}`;
        if (hudObs) hudObs.textContent = `${state.obstaclesAvoided} / ${state.obstaclesTotal}`;
        return;
      }

      state.obstaclesHit++;
      state.hp = Math.max(0, (state.hp||3) - 1);
      state.score = Math.max(0, state.score - (kind==='shock' ? 65 : 45));
      state.combo = Math.max(0, state.combo - 3);
      state.stableStreak = 0;

      // knock
      const knockBase = cfg.disturbStrength * (kind==='gust' ? 0.85 : (kind==='bomb' ? 1.05 : 1.35));
      const knockDir = (state.angle>=0 ? 1 : -1);
      state.angle += knockDir * knockBase;

      span.classList.add('hit');
      showCoach('hit');
      popText('-HP', true);
      shakePlay();

      if (state.hp <= 0){
        stopGame('fail');
        return;
      }
    }

    if (hudObs)   hudObs.textContent = `${state.obstaclesAvoided} / ${state.obstaclesTotal}`;
    if (hudScore) hudScore.textContent = String(state.score);
    if (hudCombo) hudCombo.textContent = String(state.combo);
    if (hudHp)    hudHp.textContent = `${state.hp}${(state.shield>0)?` • 🛡️${state.shield}`:''}`;
  }, Math.max(0, impactAt - nowMs()));

  // next schedule (for normal spawns)
  state.nextObstacleAt = now + randBetween(rng, cfg.disturbMinMs, cfg.disturbMaxMs);
}

/* ---- analytics ---- */
function computeAnalytics(){
  if (!state || !state.totalSamples){
    return { stabilityRatio:0, meanTilt:0, rmsTilt:0, fatigueIndex:0, samples:0 };
  }
  const n = state.totalSamples;
  const stabRatio = state.stableSamples / n;
  const meanTilt  = state.sumTiltAbs / n;
  const rmsTilt   = Math.sqrt(state.sumTiltSq / n);

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
  return { stabilityRatio:stabRatio, meanTilt, rmsTilt, fatigueIndex:fatigue, samples:n };
}

/* ---- stop ---- */
function stopGame(endedBy){
  if (!state) return;
  if (rafId!=null){ cancelAnimationFrame(rafId); rafId=null; }

  const a = computeAnalytics();
  const totalObs = state.obstaclesAvoided + state.obstaclesHit;
  const avoidRate = totalObs ? (state.obstaclesAvoided/totalObs) : 0;

  if (resMode) resMode.textContent = (gameMode==='research') ? 'Research' : 'Play';
  if (resDiff) resDiff.textContent = elDiffSel?.value || qs('diff','normal') || '-';
  if (resDur)  resDur.textContent  = String((state.durationMs/1000) || '-');
  if (resEnd)  resEnd.textContent  = mapEndReason(endedBy);

  if (resStab)     resStab.textContent     = fmtPercent(a.stabilityRatio || 0);
  if (resMeanTilt) resMeanTilt.textContent = fmtFloat(a.meanTilt || 0,3);
  if (resRmsTilt)  resRmsTilt.textContent  = fmtFloat(a.rmsTilt || 0,3);

  if (resAvoid) resAvoid.textContent = String(state.obstaclesAvoided || 0);
  if (resHit)   resHit.textContent   = String(state.obstaclesHit || 0);
  if (resAvoidRate) resAvoidRate.textContent = fmtPercent(avoidRate);

  if (resFatigue) resFatigue.textContent = fmtFloat(a.fatigueIndex || 0,3);
  if (resSamples) resSamples.textContent = String(a.samples || 0);

  const hub = String(qs('hub','')).trim();
  if (hub && btnBackHub){
    btnBackHub.style.display = '';
    btnBackHub.onclick = ()=> location.href = hub;
  }

  state = null;
  showView('result');
}

/* ---- input ---- */
function attachInput(){
  if (!playArea) return;
  let active=false;

  function updateTargetFromEvent(ev){
    if (!state) return;
    const rect = playArea.getBoundingClientRect();
    const x = ev.clientX ?? (ev.touches && ev.touches[0]?.clientX);
    if (x==null) return;

    const relX = (x - rect.left) / rect.width;
    state.targetAngle = clamp((relX - 0.5) * 2, -1, 1);
    state.lastInputAt = nowMs();
  }

  playArea.addEventListener('pointerdown', ev=>{
    active=true;
    try{ playArea.setPointerCapture(ev.pointerId); }catch(e){}
    updateTargetFromEvent(ev);
    ev.preventDefault();
  }, {passive:false});

  playArea.addEventListener('pointermove', ev=>{
    if(!active) return;
    updateTargetFromEvent(ev);
    ev.preventDefault();
  }, {passive:false});

  playArea.addEventListener('pointerup', ev=>{
    active=false;
    try{ playArea.releasePointerCapture(ev.pointerId); }catch(e){}
    ev.preventDefault();
  }, {passive:false});

  playArea.addEventListener('pointercancel', ev=>{
    active=false;
    ev.preventDefault();
  }, {passive:false});
}

/* ---- init ---- */
function init(){
  // menu actions
  $('[data-action="start-normal"]')?.addEventListener('click',()=> startGame('play'));
  $('[data-action="goto-research"]')?.addEventListener('click',()=> showView('research'));
  $$('[data-action="back-menu"]').forEach(btn=> btn.addEventListener('click',()=> showView('menu')));
  $('[data-action="start-research"]')?.addEventListener('click',()=> startGame('research'));
  $('[data-action="stop"]')?.addEventListener('click',()=>{ if(state) stopGame('manual'); });
  $('[data-action="play-again"]')?.addEventListener('click',()=> showView('menu'));

  attachInput();

  // ✅ autostart=1 (from launcher)
  try{
    const a = (new URL(location.href)).searchParams.get('autostart');
    if (String(a)==='1'){
      setTimeout(()=> startGame('play'), 60);
      return;
    }
  }catch(e){}

  showView('menu');
}

window.addEventListener('DOMContentLoaded', init);