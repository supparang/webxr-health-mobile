// === /herohealth/hydration-vr/hydration.safe.js ===
// HydrationVR — PRODUCTION (Continue Patch)
// ✅ FIX: EXPIRE water delta correct
// ✅ FIX: BAD expire penalizes (research-hard) (toggleable)
// ✅ FIX: drift mean controlled (Play delayed, Study immediate)
// ✅ ADD: Hydro-Orb identity via decorateTarget (no big emoji; SVG symbol)
// ✅ ADD: Play = "research-hard vibe" (expire matters) but still playable
// ✅ Emits: hha:score / hha:time / quest:update / hha:coach / hha:fever / hha:end

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

const $ = (id) => DOC.getElementById(id);

function clamp(v, a, b){
  v = Number(v)||0;
  return v < a ? a : (v > b ? b : v);
}
function now(){
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}
function qs(){
  try { return new URLSearchParams(location.search || ''); } catch { return new URLSearchParams(); }
}
function qget(k, d=''){
  const p = qs();
  return (p.has(k) ? String(p.get(k)||'') : d);
}
function qnum(k, d=0){
  const v = Number(qget(k, d));
  return Number.isFinite(v) ? v : d;
}
function truthy(s){
  s = String(s||'').toLowerCase();
  return (s==='1'||s==='true'||s==='yes'||s==='y'||s==='on');
}

function setText(id, txt){
  const el = $(id);
  if (el) el.textContent = String(txt ?? '');
}
function emit(type, detail){
  try { ROOT.dispatchEvent(new CustomEvent(type, { detail })); } catch {}
}

const S = {
  started:false,
  stopped:false,

  runMode:'play',
  isResearch:false,
  diff:'normal',
  timePlannedSec:70,

  score:0,
  combo:0,
  comboMax:0,
  miss:0,
  hits:0,
  total:0,

  water:34,
  mean:50,
  driftK:0.03,
  driftCap:0.9,
  autoDriftDelayMs:3500,
  tStartedAt:0,
  hasInteracted:false,

  fever:0,

  greenSec:0,
  goalGreenSecTarget:18,
  minisDone:0,
  goalsDone:0,
  lastCause:'init',

  controller:null,
  raf:null,
  lastTs:0,
  secLeft:70
};

const DIFF = {
  easy:   { good:+8,  bad:-12, goodExpire:-6,  badExpire:-8,  perfect:+3, feverBad:+10, feverMiss:+6, scoreGood:14, scorePerfect:18 },
  normal: { good:+7,  bad:-14, goodExpire:-7,  badExpire:-10, perfect:+3, feverBad:+12, feverMiss:+7, scoreGood:14, scorePerfect:18 },
  hard:   { good:+6,  bad:-16, goodExpire:-8,  badExpire:-12, perfect:+4, feverBad:+14, feverMiss:+8, scoreGood:13, scorePerfect:18 }
};
function getDiff(){
  const k = String(S.diff||'normal').toLowerCase();
  return DIFF[k] || DIFF.normal;
}

// Play แต่โหดแบบวิจัย: ให้ expire มีผลเสมอ + BAD หลุดโดนเสมอ
const PENALIZE_BAD_EXPIRE = true;

function gradeFrom(score, miss, water){
  const w = clamp(water,0,100);
  const green = (w >= 45 && w <= 65);
  const base = score - miss*8 + (green ? 40 : -10);
  if (base >= 260) return 'SSS';
  if (base >= 210) return 'SS';
  if (base >= 160) return 'S';
  if (base >= 110) return 'A';
  if (base >= 70)  return 'B';
  return 'C';
}

function applyWaterDelta(delta, cause){
  delta = Number(delta)||0;
  if (!Number.isFinite(delta) || delta === 0) return;

  S.water = clamp(S.water + delta, 0, 100);
  S.lastCause = String(cause||'');

  try { setWaterGauge(S.water); } catch {}
  pushHUD();
}

function applyFeverDelta(delta, cause){
  delta = Number(delta)||0;
  if (!Number.isFinite(delta) || delta === 0) return;
  S.fever = clamp(S.fever + delta, 0, 100);
  emit('hha:fever', { pct:S.fever, cause:String(cause||'') });

  setText('fever-pct', Math.round(S.fever) + '%');
  const fb = $('fever-bar');
  if (fb) fb.style.width = clamp(S.fever,0,100) + '%';
}

function updateQuest(){
  const z = zoneFrom ? zoneFrom(S.water) : (S.water>=45 && S.water<=65 ? 'GREEN' : (S.water<45?'LOW':'HIGH'));
  const goalLine1 = `Goal: อยู่ใน GREEN ให้ครบ 🟢`;
  const goalLine2 = `สะสม GREEN รวม ${Math.round(S.greenSec)}/${S.goalGreenSecTarget} วินาที`;
  const goalLine3 = `Goals done: ${S.goalsDone} · Minis done: ${S.minisDone}`;
  const goalLine4 = `Water: ${z} · Cause: ${S.lastCause || '-'}`;

  setText('quest-title', 'Quest 1');
  setText('quest-line1', goalLine1);
  setText('quest-line2', goalLine2);
  setText('quest-line3', goalLine3);
  setText('quest-line4', goalLine4);

  emit('quest:update', { title:'Quest 1', line1:goalLine1, line2:goalLine2, line3:goalLine3, line4:goalLine4 });
}

function celebrateStamp(big, small){
  const stamp = $('hha-stamp');
  if (!stamp) return;
  setText('stamp-big', big);
  setText('stamp-small', small);
  stamp.classList.remove('show');
  void stamp.offsetWidth;
  stamp.classList.add('show');
}

function checkGoal(){
  if (S.goalsDone >= 1) return;
  if (S.greenSec >= S.goalGreenSecTarget){
    S.goalsDone = 1;
    celebrateStamp('GOAL!', '+1');
    emit('hha:celebrate', { kind:'goal', at:Date.now(), goalIndex:1 });
  }
}

function pushHUD(){
  const grade = gradeFrom(S.score, S.miss, S.water);

  setText('stat-score', S.score|0);
  setText('stat-combo', S.combo|0);
  setText('stat-combo-max', S.comboMax|0);
  setText('stat-miss', S.miss|0);
  setText('stat-time', S.secLeft|0);
  setText('stat-grade', grade);

  const z = zoneFrom ? zoneFrom(S.water) : (S.water>=45 && S.water<=65 ? 'GREEN' : (S.water<45?'LOW':'HIGH'));
  setText('water-zone', z);
  setText('water-pct', Math.round(S.water) + '%');
  const wb = $('water-bar');
  if (wb) wb.style.width = clamp(S.water,0,100) + '%';

  emit('hha:score', {
    score:S.score|0,
    combo:S.combo|0,
    comboMax:S.comboMax|0,
    miss:S.miss|0,
    time:S.secLeft|0,
    grade,
    waterPct:S.water,
    waterZone:z,
    feverPct:S.fever,
    lastCause:S.lastCause
  });

  updateQuest();
}

function driftWaterToMean(){
  const d = (S.mean - S.water);
  if (Math.abs(d) < 0.05) return;
  const step = clamp(d * S.driftK, -S.driftCap, S.driftCap);
  applyWaterDelta(step, 'drift(mean)');
}
function driftOk(){
  if (S.isResearch) return true;
  if (S.hasInteracted) return true;
  return (now() - S.tStartedAt) >= S.autoDriftDelayMs;
}

// ---- Hydro-Orb SVG symbols ----
function svgDroplet(){
  return `
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M32 6C24 18 14 28 14 40c0 10 8 18 18 18s18-8 18-18C50 28 40 18 32 6z"
      fill="rgba(226,232,240,.92)"/>
    <path d="M26 46c0 4 3 7 7 7" stroke="rgba(56,189,248,.95)" stroke-width="6" stroke-linecap="round"/>
  </svg>`;
}
function svgBottle(){
  return `
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="26" y="6" width="12" height="10" rx="3" fill="rgba(226,232,240,.9)"/>
    <path d="M24 16h16v8c0 4 4 6 4 10v18c0 6-5 10-12 10H32c-7 0-12-4-12-10V34c0-4 4-6 4-10v-8z"
      fill="rgba(226,232,240,.92)"/>
    <path d="M22 40h20" stroke="rgba(239,68,68,.95)" stroke-width="6" stroke-linecap="round"/>
  </svg>`;
}
function svgStar(){
  return `
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M32 6l8 18 20 2-15 13 5 19-18-10-18 10 5-19L4 26l20-2 8-18z"
      fill="rgba(250,204,21,.95)"/>
  </svg>`;
}

function decorateTarget(el, refs, data){
  // remove big emoji and inject symbol
  try{
    const { inner, icon } = refs || {};
    if (icon){
      icon.textContent = '';
      icon.style.fontSize = '0px';
    }

    el.classList.add('hy-orb');
    if (data.itemType === 'bad') el.classList.add('hy-bad');
    else el.classList.add('hy-good');

    // make inner host symbol
    if (inner){
      // clear previous content except we keep existing children but add symbol on top
      const sym = DOC.createElement('div');
      sym.className = 'hy-symbol';

      if (data.itemType === 'power') sym.innerHTML = svgStar();
      else if (data.itemType === 'bad') sym.innerHTML = svgBottle();
      else sym.innerHTML = svgDroplet();

      inner.appendChild(sym);
    }
  }catch{}
}

function onHitResult(itemType, hitPerfect){
  const T = getDiff();
  S.hasInteracted = true;
  S.total += 1;

  if (itemType === 'good' || itemType === 'fakeGood' || itemType === 'power'){
    S.hits += 1;
    S.combo += 1;
    S.comboMax = Math.max(S.comboMax, S.combo);

    let delta = T.good + (hitPerfect ? T.perfect : 0);
    S.score += (hitPerfect ? T.scorePerfect : T.scoreGood);

    applyWaterDelta(delta, hitPerfect ? 'hit(good,perfect)' : 'hit(good)');
    applyFeverDelta(-2.2, 'cool(good)');

    if (S.combo === 6){
      S.minisDone += 1;
      celebrateStamp('MINI!', '+1');
      emit('hha:celebrate', { kind:'mini', at:Date.now(), miniIndex:S.minisDone });
    }
  } else {
    S.combo = 0;
    S.miss += 1;
    S.score = Math.max(0, S.score - 18);
    applyWaterDelta(T.bad, 'hit(bad)');
    applyFeverDelta(T.feverBad, 'fever(bad)');
  }

  pushHUD();
}

function onExpireResult(itemType){
  const T = getDiff();
  S.total += 1;
  S.combo = 0;

  if (itemType === 'good' || itemType === 'fakeGood' || itemType === 'power'){
    S.miss += 1;
    S.score = Math.max(0, S.score - 10);
    applyWaterDelta(T.goodExpire, 'expire(good)');
    applyFeverDelta(T.feverMiss, 'fever(missGood)');
  } else {
    if (PENALIZE_BAD_EXPIRE){
      S.miss += 1;
      S.score = Math.max(0, S.score - 12);
      applyWaterDelta(T.badExpire, 'expire(bad)');
      applyFeverDelta(T.feverMiss + 2, 'fever(missBad)');
    } else {
      S.hits += 1;
      S.score += 6;
      applyWaterDelta(+2, 'avoid(bad)');
      applyFeverDelta(-1.5, 'cool(avoidBad)');
    }
  }

  pushHUD();
}

function judge(ch, ctx){
  const itemType = String(ctx.itemType||'good');
  const hitPerfect = !!ctx.hitPerfect;
  onHitResult(itemType, hitPerfect);
  if (itemType === 'bad') return { good:false, scoreDelta:-1 };
  return { good:true, scoreDelta:+1 };
}

function onExpire(info){
  const itemType = String(info && info.itemType ? info.itemType : (info && info.isGood ? 'good' : 'bad'));
  onExpireResult(itemType);
}

function tickSecond(){
  if (S.secLeft <= 0) return;

  S.secLeft -= 1;
  emit('hha:time', { sec:S.secLeft });

  const z = zoneFrom ? zoneFrom(S.water) : (S.water>=45 && S.water<=65 ? 'GREEN' : (S.water<45?'LOW':'HIGH'));
  if (String(z).toUpperCase().includes('GREEN')){
    S.greenSec += 1;
  }

  if (driftOk()){
    driftWaterToMean();
  }

  checkGoal();
  pushHUD();

  if (S.secLeft <= 0){
    endGame();
  }
}

function endGame(){
  if (S.stopped) return;
  S.stopped = true;

  try { emit('hha:stop', { reason:'timeup' }); } catch {}

  const grade = gradeFrom(S.score, S.miss, S.water);

  const end = $('hvr-end');
  if (end){
    end.style.display = 'flex';
    setText('end-score', S.score|0);
    setText('end-grade', grade);
    setText('end-combo', S.comboMax|0);
    setText('end-miss', S.miss|0);
    setText('end-goals', `${S.goalsDone}/1`);
    setText('end-minis', `${S.minisDone}/∞`);
  }

  emit('hha:end', {
    score:S.score|0,
    grade,
    comboMax:S.comboMax|0,
    miss:S.miss|0,
    goalsDone:S.goalsDone,
    goalsTotal:1,
    minisDone:S.minisDone
  });
}

async function startGame(){
  if (S.started) return;
  S.started = true;
  S.stopped = false;

  const run = (qget('run', qget('runMode', 'play')) || 'play');
  const diff = (qget('diff', 'normal') || 'normal');
  const time = clamp(qnum('time', qnum('durationPlannedSec', 70)), 20, 180);

  S.runMode = run;
  S.isResearch = (run === 'study' || truthy(qget('study','0')));
  S.diff = diff;
  S.timePlannedSec = time;
  S.secLeft = time;

  S.score=0; S.combo=0; S.comboMax=0; S.miss=0; S.hits=0; S.total=0;
  S.fever=0; S.greenSec=0; S.goalsDone=0; S.minisDone=0;
  S.lastCause='init';

  // water start
  const waterStart = clamp(qnum('waterStart', 34), 0, 100);
  S.water = waterStart;

  // drift: Play delayed + softer; Study immediate + stronger
  S.tStartedAt = now();
  S.hasInteracted = false;
  S.autoDriftDelayMs = S.isResearch ? 0 : 4200;
  S.driftK   = S.isResearch ? 0.075 : 0.028;
  S.driftCap = S.isResearch ? 2.4   : 0.85;

  // init UI
  try { ensureWaterGauge && ensureWaterGauge(); } catch {}
  try { setWaterGauge && setWaterGauge(S.water); } catch {}
  applyFeverDelta(0, 'init');
  pushHUD();

  // close start overlay
  const ov = $('start-overlay');
  if (ov) ov.style.display = 'none';

  // pools
  const pools = {
    good: ['.'], // we intentionally hide emoji; symbol comes from decorateTarget
    bad:  ['.'],
    trick:[]
  };

  // Play แต่โหดแบบวิจัย: เร่ง spawn นิด + มี trick เล็ก ๆ แต่ไม่เกิน
  const trickRate = S.isResearch ? 0.12 : 0.09;
  const spawnMul  = S.isResearch ? 0.92 : 0.96;

  S.controller = await factoryBoot({
    modeKey:'hydration',
    difficulty:S.diff,
    duration:S.secLeft,

    spawnHost: '#hvr-layer',
    boundsHost: '#playfield',

    // Hydration identity: FULL FIELD spread + grid9
    spawnAroundCrosshair: false,
    spawnStrategy: 'grid9',

    goodRate: 0.62,
    trickRate,

    allowAdaptive: true,
    spawnIntervalMul: () => spawnMul,

    pools,
    powerups: ['.'],
    powerRate: S.isResearch ? 0.12 : 0.10,
    powerEvery: 7,

    playPadXFrac: 0.10,
    playPadTopFrac: 0.12,
    playPadBotFrac: 0.14,
    autoRelaxSafezone:true,

    decorateTarget,
    judge,
    onExpire
  });

  S._timer = ROOT.setInterval(tickSecond, 1000);

  const pf = $('playfield');
  if (pf){
    const onTap = (ev) => {
      if (!S.controller || !S.controller.shootCrosshair) return;
      const t = ev && ev.target;
      if (t && t.closest && t.closest('.btn')) return;
      S.controller.shootCrosshair();
    };
    pf.addEventListener('pointerdown', onTap, { passive:true });
    pf._hha_onTap = onTap;
  }

  setText('coach-text', S.isResearch
    ? 'โหมดวิจัย: โหดสุด! เป้าหายมีผล และ BAD หลุดก็โดน 🧪'
    : 'โหมดเล่น: โหดแบบวิจัย แต่ยังลื่น — เป้าหายมีผลนะ 💧'
  );
  setText('coach-sub', 'แตะเป้า หรือ แตะกลางจอเพื่อยิง crosshair');

  emit('hha:coach', { text: $('coach-text')?.textContent || '', mood:'neutral' });
}

function stopGame(){
  if (S.stopped) return;
  S.stopped = true;

  try { if (S._timer) ROOT.clearInterval(S._timer); } catch {}
  S._timer = null;

  try { if (S.controller && S.controller.stop) S.controller.stop(); } catch {}
  S.controller = null;

  const pf = $('playfield');
  if (pf && pf._hha_onTap){
    try { pf.removeEventListener('pointerdown', pf._hha_onTap); } catch {}
    pf._hha_onTap = null;
  }
}

function bindUI(){
  const btnStart = $('btn-start');
  if (btnStart) btnStart.addEventListener('click', startGame, { passive:true });

  const btnStop = $('btn-stop');
  if (btnStop) btnStop.addEventListener('click', () => {
    stopGame();
    endGame();
  }, { passive:true });

  const btnRetry = $('btn-retry');
  if (btnRetry) btnRetry.addEventListener('click', () => location.reload(), { passive:true });

  const btnVR = $('btn-vr');
  if (btnVR){
    btnVR.addEventListener('click', () => emit('hha:vr', { at:Date.now() }), { passive:true });
  }
}

(function boot(){
  if (!DOC) return;
  bindUI();

  try { ensureWaterGauge && ensureWaterGauge(); } catch {}
  try { setWaterGauge && setWaterGauge(S.water); } catch {}
  pushHUD();
})();
