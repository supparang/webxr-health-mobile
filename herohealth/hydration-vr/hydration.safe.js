// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — PRODUCTION (P0+P1 Patch)
// ✅ FIX: EXPIRE (good/bad) water delta correct (no more "good expire -> increase")
// ✅ FIX: BAD expire now penalizes (research-hard) (toggleable)
// ✅ FIX: Play drift delayed; Study drift immediate (regression-to-mean controlled)
// ✅ Emits: hha:score / hha:time / quest:update / hha:coach / hha:fever / hha:end
// ✅ Crosshair tap (tap center / tap anywhere) to shoot
// ✅ Uses mode-factory.js targets (orb look)

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';

// ---------- Root ----------
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

// ---------- HUD helpers ----------
function setText(id, txt){
  const el = $(id);
  if (el) el.textContent = String(txt ?? '');
}

function emit(type, detail){
  try { ROOT.dispatchEvent(new CustomEvent(type, { detail })); } catch {}
}

// ---------- Game state ----------
const S = {
  started:false,
  stopped:false,

  // mode
  runMode:'play',
  isResearch:false,
  diff:'normal',
  timePlannedSec:70,

  // score
  score:0,
  combo:0,
  comboMax:0,
  miss:0,
  hits:0,
  total:0,

  // hydration
  water:34,       // pct 0..100
  mean:50,        // regression target
  driftK:0.03,    // per-second pull strength
  driftCap:0.9,   // max change per second from drift
  autoDriftDelayMs:3500,
  tStartedAt:0,
  hasInteracted:false,

  // fever
  fever:0,        // 0..100

  // quest
  greenSec:0,
  goalGreenSecTarget:18, // goal: stay green cumulative
  minisDone:0,
  goalsDone:0,
  lastCause:'init',

  // controls
  controller:null,
  raf:null,
  lastTs:0,
  secLeft:70
};

// ---------- Tuning ----------
const DIFF = {
  easy:   { good:+8,  bad:-12, goodExpire:-6,  badExpire:-8,  perfect:+3, feverBad:+10, feverMiss:+6 },
  normal: { good:+7,  bad:-14, goodExpire:-7,  badExpire:-10, perfect:+3, feverBad:+12, feverMiss:+7 },
  hard:   { good:+6,  bad:-16, goodExpire:-8,  badExpire:-12, perfect:+4, feverBad:+14, feverMiss:+8 }
};

function getDiff(){
  const k = String(S.diff||'normal').toLowerCase();
  return DIFF[k] || DIFF.normal;
}

// IMPORTANT: toggle behavior here if you want "bad expire = no penalty"
const PENALIZE_BAD_EXPIRE = true;

// ---------- Grade ----------
function gradeFrom(score, miss, water){
  // hydration identity: reward stable green + low miss
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

// ---------- Water apply ----------
function applyWaterDelta(delta, cause){
  delta = Number(delta)||0;
  if (!Number.isFinite(delta)) delta = 0;
  if (delta === 0) return;

  const before = S.water;
  S.water = clamp(S.water + delta, 0, 100);
  S.lastCause = String(cause||'');
  // update UI gauge
  try { setWaterGauge(S.water); } catch {}

  // emit score update
  pushHUD();

  // debug
  // console.log('[Hydration] water', before, '->', S.water, 'delta', delta, 'cause', S.lastCause);
}

function applyFeverDelta(delta, cause){
  delta = Number(delta)||0;
  if (!Number.isFinite(delta)) delta = 0;
  if (delta === 0) return;
  S.fever = clamp(S.fever + delta, 0, 100);
  emit('hha:fever', { pct:S.fever, cause:String(cause||'') });
  // update fever bar if HUD binder not present
  setText('fever-pct', Math.round(S.fever) + '%');
  const fb = $('fever-bar');
  if (fb) fb.style.width = clamp(S.fever,0,100) + '%';
}

// ---------- Quest ----------
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

  emit('quest:update', {
    title:'Quest 1',
    line1:goalLine1,
    line2:goalLine2,
    line3:goalLine3,
    line4:goalLine4
  });
}

function celebrateStamp(big, small){
  const stamp = $('hha-stamp');
  if (!stamp) return;
  setText('stamp-big', big);
  setText('stamp-small', small);
  stamp.classList.remove('show');
  // force reflow
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

// ---------- HUD push ----------
function pushHUD(){
  const grade = gradeFrom(S.score, S.miss, S.water);

  // local direct (in case HUD binder not working)
  setText('stat-score', S.score|0);
  setText('stat-combo', S.combo|0);
  setText('stat-combo-max', S.comboMax|0);
  setText('stat-miss', S.miss|0);
  setText('stat-time', S.secLeft|0);
  setText('stat-grade', grade);

  // water
  const zone = zoneFrom ? zoneFrom(S.water) : (S.water>=45 && S.water<=65 ? 'GREEN' : (S.water<45?'LOW':'HIGH'));
  setText('water-zone', zone);
  setText('water-pct', Math.round(S.water) + '%');
  const wb = $('water-bar');
  if (wb) wb.style.width = clamp(S.water,0,100) + '%';

  // emit for global HUD
  emit('hha:score', {
    score:S.score|0,
    combo:S.combo|0,
    comboMax:S.comboMax|0,
    miss:S.miss|0,
    time:S.secLeft|0,
    grade,
    waterPct:S.water,
    waterZone:zone,
    feverPct:S.fever,
    lastCause:S.lastCause
  });

  updateQuest();
}

// ---------- regression-to-mean (controlled) ----------
function driftWaterToMean(){
  // pull toward mean (50)
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

// ---------- hit/expire resolution ----------
function onHitResult(itemType, hitPerfect){
  const T = getDiff();

  S.hasInteracted = true;
  S.total += 1;

  if (itemType === 'good' || itemType === 'fakeGood' || itemType === 'power'){
    S.hits += 1;
    S.combo += 1;
    S.comboMax = Math.max(S.comboMax, S.combo);

    let delta = T.good;
    if (hitPerfect) delta += T.perfect;

    S.score += (hitPerfect ? 18 : 14);
    applyWaterDelta(delta, hitPerfect ? 'hit(good,perfect)' : 'hit(good)');
    // reward: slightly cool fever when good
    applyFeverDelta(-2.2, 'cool(good)');

    // mini: 6 combo => mini clear (simple)
    if (S.combo === 6){
      S.minisDone += 1;
      celebrateStamp('MINI!', '+1');
      emit('hha:celebrate', { kind:'mini', at:Date.now(), miniIndex:S.minisDone });
    }
  } else {
    // bad hit
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

  // expire also counts as an outcome (research-hard)
  S.total += 1;
  S.combo = 0;

  if (itemType === 'good' || itemType === 'fakeGood' || itemType === 'power'){
    // missed good -> penalize
    S.miss += 1;
    S.score = Math.max(0, S.score - 10);
    applyWaterDelta(T.goodExpire, 'expire(good)');
    applyFeverDelta(T.feverMiss, 'fever(missGood)');
  } else {
    // bad expired (escaped/you "consumed by default" research-hard)
    if (PENALIZE_BAD_EXPIRE){
      S.miss += 1;
      S.score = Math.max(0, S.score - 12);
      applyWaterDelta(T.badExpire, 'expire(bad)');
      applyFeverDelta(T.feverMiss + 2, 'fever(missBad)');
    } else {
      // alternative: avoided bad -> reward
      S.hits += 1;
      S.score += 6;
      applyWaterDelta(+2, 'avoid(bad)');
      applyFeverDelta(-1.5, 'cool(avoidBad)');
    }
  }

  pushHUD();
}

// ---------- Factory judge + expire hooks ----------
function judge(ch, ctx){
  // ctx: { itemType, hitPerfect, ... }
  const itemType = String(ctx.itemType||'good');
  const hitPerfect = !!ctx.hitPerfect;

  onHitResult(itemType, hitPerfect);

  // tell factory whether "good" for sampling/adaptive (not critical)
  // scoreDelta positive for good-ish, negative for bad
  if (itemType === 'bad'){
    return { good:false, scoreDelta:-1 };
  }
  return { good:true, scoreDelta:+1 };
}

function onExpire(info){
  // info: { ch, isGood, isPower, itemType }
  const itemType = String(info && info.itemType ? info.itemType : (info && info.isGood ? 'good' : 'bad'));
  onExpireResult(itemType);
}

// ---------- loop / time ----------
function tickSecond(){
  if (S.secLeft <= 0) return;

  S.secLeft -= 1;
  emit('hha:time', { sec:S.secLeft });

  // GREEN accumulate (hydration identity)
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

  // end overlay
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

// ---------- start/stop ----------
async function startGame(){
  if (S.started) return;
  S.started = true;
  S.stopped = false;

  // parse params
  const run = (qget('run', qget('runMode', 'play')) || 'play');
  const diff = (qget('diff', 'normal') || 'normal');
  const time = clamp(qnum('time', qnum('durationPlannedSec', 70)), 20, 180);

  S.runMode = run;
  S.isResearch = (run === 'study' || truthy(qget('study','0'))); // compat
  S.diff = diff;
  S.timePlannedSec = time;
  S.secLeft = time;

  // reset
  S.score=0; S.combo=0; S.comboMax=0; S.miss=0; S.hits=0; S.total=0;
  S.fever=0; S.greenSec=0; S.goalsDone=0; S.minisDone=0;
  S.lastCause='init';

  // water start
  // if want: allow qs waterStart=..
  const waterStart = clamp(qnum('waterStart', 34), 0, 100);
  S.water = waterStart;

  // regression-to-mean settings
  S.tStartedAt = now();
  S.hasInteracted = false;

  // Play: delay drift; Study: immediate (research-hard)
  S.autoDriftDelayMs = S.isResearch ? 0 : 3500;
  S.driftK   = S.isResearch ? 0.07 : 0.03;
  S.driftCap = S.isResearch ? 2.2  : 0.9;

  // init UI
  ensureWaterGauge && ensureWaterGauge();
  setWaterGauge && setWaterGauge(S.water);
  applyFeverDelta(0, 'init');
  pushHUD();

  // close start overlay
  const ov = $('start-overlay');
  if (ov) ov.style.display = 'none';

  // boot factory
  const pools = {
    good: ['💧','🫧','🧊'],
    bad:  ['🥤','🧋','🧃'],
    trick:['💧'] // keep minimal
  };

  S.controller = await factoryBoot({
    modeKey:'hydration',
    difficulty:S.diff,
    duration:S.secLeft,

    spawnHost: '#hvr-layer',
    boundsHost: '#playfield',
    spawnAroundCrosshair: false,     // hydration unique: full field spread (not clustered)
    spawnStrategy: 'grid9',
    goodRate: 0.64,
    trickRate: S.isResearch ? 0.12 : 0.08,

    // more "research-hard" but still playable
    allowAdaptive: true,
    spawnIntervalMul: () => (S.isResearch ? 0.92 : 1.00),

    pools,
    powerups: ['⭐'],
    powerRate: S.isResearch ? 0.12 : 0.10,
    powerEvery: 7,

    // safezone avoid HUD
    playPadXFrac: 0.10,
    playPadTopFrac: 0.12,
    playPadBotFrac: 0.14,
    autoRelaxSafezone:true,

    judge,
    onExpire
  });

  // tick timer
  // drive by 1s interval, independent from factory RAF
  S._timer = ROOT.setInterval(tickSecond, 1000);

  // crosshair shoot: tap/click playfield (anywhere)
  const pf = $('playfield');
  if (pf){
    const onTap = (ev) => {
      if (!S.controller || !S.controller.shootCrosshair) return;
      // do not shoot when tapping buttons
      const t = ev && ev.target;
      if (t && t.closest && t.closest('.btn')) return;
      S.controller.shootCrosshair();
    };
    pf.addEventListener('pointerdown', onTap, { passive:true });
    pf._hha_onTap = onTap;
  }

  // coach text
  setText('coach-text', S.isResearch
    ? 'โหมดวิจัย: โหดขึ้นนะ! เป้าหาย = โดนผลกระทบด้วย 🧪'
    : 'พร้อมแล้ว เก็บน้ำดี ๆ นะ! 💧'
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

// ---------- Bind UI ----------
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

  const btnBack = $('btn-backhub');
  if (btnBack){
    btnBack.addEventListener('click', () => {
      const hub = qget('hub', './hub.html') || './hub.html';
      location.href = hub;
    }, { passive:true });
  }

  // VR button (optional)
  const btnVR = $('btn-vr');
  if (btnVR){
    btnVR.addEventListener('click', () => {
      // placeholder: your VR entry flow if needed
      emit('hha:vr', { at:Date.now() });
      // no-op for now
    }, { passive:true });
  }
}

// ---------- Boot ----------
(function boot(){
  if (!DOC) return;
  bindUI();

  // init water UI even before start (static)
  try { ensureWaterGauge && ensureWaterGauge(); } catch {}
  try { setWaterGauge && setWaterGauge(S.water); } catch {}
  pushHUD();
})();
