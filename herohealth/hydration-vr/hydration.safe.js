// === /herohealth/hydration-vr/hydration.safe.js ===
// HydrationVR — PRODUCTION (P2-A/B/C + Storm Shield Mini: FULL HARD RULES)
// ✅ Play: BAD expire = avoid success (no miss, small reward)
// ✅ Study: BAD expire penalized (research-hard)
// ✅ Storm Mini (FULL): block BAD with Shield ONLY when
//    - Storm active
//    - NOT in GREEN zone (LOW/HIGH)
//    - pressure high enough (edgeIntensity threshold)
//    - near end of storm (stormLeftSec threshold)
// ✅ Fix: no drift/timer before START (prevents gauge moving without play)
// ✅ Fix: guard NaN + clamp deltas (prevents water jump to 100)
// ✅ Goal GREEN time counts reliably (zoneFrom === 'GREEN')

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

const $ = (id) => DOC.getElementById(id);

function clamp(v, a, b){
  v = Number(v);
  if (!Number.isFinite(v)) v = a;
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

function getZoneFromWater(w){
  try{
    if (typeof zoneFrom === 'function') return String(zoneFrom(w));
  }catch{}
  w = Number(w);
  if (!Number.isFinite(w)) w = 0;
  if (w >= 45 && w <= 65) return 'GREEN';
  return (w < 45) ? 'LOW' : 'HIGH';
}

// -------------------------------------------------
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
  autoDriftDelayMs:4200,
  tStartedAt:0,
  hasInteracted:false,

  fever:0,

  // goal: green seconds
  greenSec:0,
  goalGreenSecTarget:18,
  minisDone:0,
  goalsDone:0,
  lastCause:'init',

  // Shield
  shield:0,
  greenStreak:0,
  shieldMax:1,

  // Storm
  storm:false,
  stormLeftSec:0,
  stormNextInSec:0,
  stormMinGap:12,
  stormMaxGap:18,
  stormDurMin:4,
  stormDurMax:6,

  // pressure intensity (0..0.85)
  edgeIntensity:0,

  // Storm mini quest
  stormMiniActive:false,
  stormMiniDone:false,

  // Audio
  audioOK:false,
  audioCtx:null,
  beepGateMs:0,

  controller:null,
  _timer:null,
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

// ✅ policy: penalize BAD expire only in study/research
function penalizeBadExpire(){
  return !!S.isResearch;
}

// -------------------------------------------------
function gradeFrom(score, miss, water){
  const w = clamp(water,0,100);
  const green = (w >= 45 && w <= 65);
  const base = (Number(score)||0) - (Number(miss)||0)*8 + (green ? 40 : -10);
  if (base >= 260) return 'SSS';
  if (base >= 210) return 'SS';
  if (base >= 160) return 'S';
  if (base >= 110) return 'A';
  if (base >= 70)  return 'B';
  return 'C';
}

// --- Audio ---
function ensureAudio(){
  if (S.audioOK) return;
  try{
    const Ctx = ROOT.AudioContext || ROOT.webkitAudioContext;
    if (!Ctx) return;
    S.audioCtx = new Ctx();
    S.audioOK = true;
  }catch{}
}
async function resumeAudio(){
  try{
    if (!S.audioCtx) return;
    if (S.audioCtx.state === 'suspended') await S.audioCtx.resume();
  }catch{}
}
function beep(freq=880, ms=55, gain=0.035){
  if (!S.audioOK || !S.audioCtx) return;
  const t = now();
  if (t < S.beepGateMs) return;
  S.beepGateMs = t + 220;

  try{
    const ctx = S.audioCtx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = gain;

    o.connect(g);
    g.connect(ctx.destination);

    const st = ctx.currentTime;
    o.start(st);
    g.gain.setValueAtTime(gain, st);
    g.gain.exponentialRampToValueAtTime(0.0001, st + ms/1000);
    o.stop(st + ms/1000 + 0.02);
  }catch{}
}

// --- UI FX ---
function setEdgeFX(zone, intensity){
  intensity = clamp(intensity, 0, 0.85);
  S.edgeIntensity = intensity;

  try{
    DOC.body.style.setProperty('--fx', String(intensity.toFixed(3)));
    DOC.body.classList.remove('fx-low','fx-high','fx-shake');

    if (zone === 'LOW'){
      DOC.body.classList.add('fx-low');
      if (intensity > 0.30) DOC.body.classList.add('fx-shake');
    } else if (zone === 'HIGH'){
      DOC.body.classList.add('fx-high');
      if (intensity > 0.30) DOC.body.classList.add('fx-shake');
    }

    if (S.started && (S.hasInteracted || (now() - S.tStartedAt) > 1500) && intensity > 0.38){
      beep(zone === 'HIGH' ? 740 : 880, 55, 0.028);
    }
  }catch{}
}

function updateShieldUI(){
  setText('shield-count', String(S.shield|0));
}
function updateStormUI(){
  setText('storm-left', String(Math.max(0, S.stormLeftSec|0)));
  try{
    if (S.storm) DOC.body.classList.add('storm');
    else DOC.body.classList.remove('storm');
  }catch{}
}

function applyWaterDelta(delta, cause){
  delta = Number(delta);
  if (!Number.isFinite(delta)) return;

  delta = clamp(delta, -28, +28);
  if (delta === 0) return;

  S.water = clamp(S.water + delta, 0, 100);
  S.lastCause = String(cause||'');

  try { setWaterGauge(S.water); } catch {}
  pushHUD();
}

function applyFeverDelta(delta, cause){
  delta = Number(delta);
  if (!Number.isFinite(delta) || delta === 0) return;
  S.fever = clamp(S.fever + delta, 0, 100);

  emit('hha:fever', { pct:S.fever, cause:String(cause||'') });

  setText('fever-pct', Math.round(S.fever) + '%');
  const fb = $('fever-bar');
  if (fb) fb.style.width = clamp(S.fever,0,100) + '%';
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

function updateQuest(){
  const z = getZoneFromWater(S.water);

  const goalLine1 = `Goal: อยู่ใน GREEN ให้ครบ 🟢`;
  const goalLine2 = `สะสม GREEN รวม ${Math.round(S.greenSec)}/${S.goalGreenSecTarget} วินาที`;

  let miniTxt = 'Mini: — (รอ Storm)';
  if (S.stormMiniDone) miniTxt = 'Mini: ✅ Storm Shield Timing (FULL) สำเร็จ';
  else if (S.stormMiniActive) {
    miniTxt = S.isResearch
      ? 'Mini: 🧪 บล็อก BAD ท้าย Storm(≤1s) + LOW/HIGH + pressure≥0.55'
      : 'Mini: 🫧 บล็อก BAD ท้าย Storm(≤2s) + LOW/HIGH + pressure≥0.45';
  }

  const goalLine3 = `${miniTxt} · Minis done: ${S.minisDone}`;
  const goalLine4 = `Water: ${z} · Shield:${S.shield} · Storm:${S.storm ? (S.stormLeftSec+'s') : ('in '+S.stormNextInSec+'s')}`;

  setText('quest-title', 'Quest 1');
  setText('quest-line1', goalLine1);
  setText('quest-line2', goalLine2);
  setText('quest-line3', goalLine3);
  setText('quest-line4', goalLine4);

  emit('quest:update', { title:'Quest 1', line1:goalLine1, line2:goalLine2, line3:goalLine3, line4:goalLine4 });
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

  const z = getZoneFromWater(S.water);
  setText('water-zone', z);
  setText('water-pct', Math.round(S.water) + '%');
  const wb = $('water-bar');
  if (wb) wb.style.width = clamp(S.water,0,100) + '%';

  updateShieldUI();
  updateStormUI();

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
    shield:S.shield|0,
    storm:S.storm,
    stormLeft:S.stormLeftSec|0,
    lastCause:S.lastCause
  });

  updateQuest();
}

// -------------------------------------------------
// Drift regression-to-mean (controlled)
function driftOk(){
  if (S.isResearch) return true;
  if (S.hasInteracted) return true;
  return (now() - S.tStartedAt) >= S.autoDriftDelayMs;
}
function driftWaterToMean(){
  const d = (S.mean - S.water);
  if (Math.abs(d) < 0.05) return;
  const step = clamp(d * S.driftK, -S.driftCap, S.driftCap);
  applyWaterDelta(step, 'drift(mean)');
}

// -------------------------------------------------
// Storm scheduler
function randInt(a,b){
  a = Math.floor(a); b = Math.floor(b);
  if (b < a) [a,b] = [b,a];
  return (a + Math.floor(Math.random() * (b-a+1)));
}
function scheduleNextStorm(){
  S.stormNextInSec = randInt(S.stormMinGap, S.stormMaxGap);
}
function armStormMini(){
  S.stormMiniActive = true;
  S.stormMiniDone = false;
}
function startStorm(){
  S.storm = true;
  S.stormLeftSec = randInt(S.stormDurMin, S.stormDurMax);
  S.lastCause = 'storm(start)';
  updateStormUI();

  armStormMini();
  celebrateStamp('STORM!', 'FULL shield timing');

  setText('coach-text', '🌪️ Storm มาแล้ว! Mini: บล็อก BAD “ท้ายพายุ” + ต้อง LOW/HIGH + pressure สูง');
  setText('coach-sub', S.isResearch
    ? 'โหมดวิจัย: ต้องบล็อกตอนเหลือ ≤1s และ pressure ≥0.55'
    : 'โหมดเล่น: ต้องบล็อกตอนเหลือ ≤2s และ pressure ≥0.45'
  );
  emit('hha:coach', { text: $('coach-text')?.textContent || '', mood:'neutral' });
}
function stopStorm(){
  S.storm = false;
  S.stormLeftSec = 0;
  S.lastCause = 'storm(end)';
  updateStormUI();

  // end mini attempt window
  S.stormMiniActive = false;

  scheduleNextStorm();
}

// -------------------------------------------------
// Hydro-Orb symbols (visual identity)
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
  try{
    const { inner, icon } = refs || {};
    if (icon){
      icon.textContent = '';
      icon.style.fontSize = '0px';
    }

    el.classList.add('hy-orb');
    if (data.itemType === 'bad') el.classList.add('hy-bad');
    else el.classList.add('hy-good');

    // subtle drift per orb
    const dx = (Math.random()*2 - 1) * 10;
    const dy = (Math.random()*2 - 1) * 10;
    el.style.setProperty('--dx', dx.toFixed(1) + 'px');
    el.style.setProperty('--dy', dy.toFixed(1) + 'px');

    if (inner){
      const sym = DOC.createElement('div');
      sym.className = 'hy-symbol';
      if (data.itemType === 'power') sym.innerHTML = svgStar();
      else if (data.itemType === 'bad') sym.innerHTML = svgBottle();
      else sym.innerHTML = svgDroplet();
      inner.appendChild(sym);
    }
  }catch{}
}

// -------------------------------------------------
// Shield
function grantShield(){
  if (S.shield >= S.shieldMax) return false;
  S.shield = Math.min(S.shieldMax, S.shield + 1);
  celebrateStamp('STABILIZER!', '+Shield');
  emit('hha:celebrate', { kind:'shield', at:Date.now(), shield:S.shield });
  updateShieldUI();
  return true;
}

function fullStormMiniConditionsMet(){
  if (!S.storm) return false;
  if (!S.stormMiniActive || S.stormMiniDone) return false;

  const zone = getZoneFromWater(S.water);
  const notGreen = (zone !== 'GREEN');

  const needIntensity = S.isResearch ? 0.55 : 0.45;
  const needEndSec    = S.isResearch ? 1 : 2;

  const intensityOK = (S.edgeIntensity >= needIntensity);
  const endOK = (Number(S.stormLeftSec||0) <= needEndSec);

  return !!(notGreen && intensityOK && endOK);
}

function completeStormMini(){
  if (S.stormMiniDone) return;

  S.stormMiniDone = true;
  S.stormMiniActive = false;

  S.minisDone += 1;

  // bonus (หนัก ๆ)
  S.score += S.isResearch ? 65 : 55;
  applyWaterDelta(S.isResearch ? +9 : +8, 'mini(stormShieldFull)');
  applyFeverDelta(S.isResearch ? -18 : -16, 'mini(stormShieldFull)');

  celebrateStamp('STORM MINI!', 'FULL ✓');
  emit('hha:celebrate', { kind:'mini', at:Date.now(), miniKey:'storm_shield_timing_full', minisDone:S.minisDone });

  setText('coach-text', '✅ FULL TIMING! บล็อกท้ายพายุ + นอก GREEN + pressure สูง = ผ่าน!');
  setText('coach-sub', 'ได้โบนัสหนัก ๆ เลย 🫧⚡');
  emit('hha:coach', { text: $('coach-text')?.textContent || '', mood:'happy' });
}

function tryConsumeShieldForBadBlock(){
  if (S.shield <= 0) return false;
  S.shield -= 1;
  celebrateStamp('SHIELD!', 'blocked');
  emit('hha:shield', { at:Date.now(), left:S.shield });
  updateShieldUI();
  return true;
}

// -------------------------------------------------
function onHitResult(itemType, hitPerfect){
  const T = getDiff();
  S.hasInteracted = true;
  S.total += 1;

  // Shield blocks BAD hits
  if (itemType === 'bad' && tryConsumeShieldForBadBlock()){
    // ✅ FULL mini quest: must satisfy ALL conditions
    if (fullStormMiniConditionsMet()){
      completeStormMini();
    } else if (S.storm && S.stormMiniActive && !S.stormMiniDone){
      const zone = getZoneFromWater(S.water);
      const needIntensity = S.isResearch ? 0.55 : 0.45;
      const needEndSec    = S.isResearch ? 1 : 2;

      setText('coach-text', '🫧 บล็อกได้! แต่ยังไม่ครบเงื่อนไข FULL');
      setText('coach-sub',
        `ต้อง: ท้ายพายุ(≤${needEndSec}s) + LOW/HIGH (ตอนนี้ ${zone}) + pressure≥${needIntensity.toFixed(2)} (ตอนนี้ ${S.edgeIntensity.toFixed(2)})`
      );
      emit('hha:coach', { text: $('coach-text')?.textContent || '', mood:'neutral' });
    }

    // reward small for correct defense
    S.combo = Math.max(0, S.combo - 1);
    applyFeverDelta(-6, 'shield(blockBad)');
    S.score += 4;
    pushHUD();
    return;
  }

  if (itemType === 'good' || itemType === 'fakeGood' || itemType === 'power'){
    S.hits += 1;
    S.combo += 1;
    S.comboMax = Math.max(S.comboMax, S.combo);

    const delta = T.good + (hitPerfect ? T.perfect : 0);
    S.score += (hitPerfect ? T.scorePerfect : T.scoreGood);

    applyWaterDelta(delta, hitPerfect ? 'hit(good,perfect)' : 'hit(good)');
    applyFeverDelta(-2.2, 'cool(good)');
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
    // ✅ BAD expire policy
    if (penalizeBadExpire()){
      S.miss += 1;
      S.score = Math.max(0, S.score - 12);
      applyWaterDelta(T.badExpire, 'expire(bad)');
      applyFeverDelta(T.feverMiss + 2, 'fever(missBad)');
    } else {
      // Play: avoid success
      S.hits += 1;
      S.score += 7;
      applyWaterDelta(+2.2, 'avoid(badExpire)');
      applyFeverDelta(-2.0, 'cool(avoidBad)');
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

// -------------------------------------------------
function tickSecond(){
  if (S.secLeft <= 0) return;

  S.secLeft -= 1;
  emit('hha:time', { sec:S.secLeft });

  const z = getZoneFromWater(S.water);

  // GREEN goal + streak for shield
  if (z === 'GREEN'){
    S.greenSec += 1;
    S.greenStreak += 1;
    if (S.greenStreak === 5){
      grantShield();
    }
  } else {
    S.greenStreak = 0;
  }

  // Edge intensity (deviation from green band)
  const dev = (z === 'GREEN') ? 0 : (S.water < 45 ? (45 - S.water) : (S.water - 65));
  const intensity = clamp(dev / 22, 0, 0.85);
  setEdgeFX(z, intensity);

  // pressure outside GREEN
  if (z !== 'GREEN'){
    applyFeverDelta(S.storm ? 1.2 : 0.8, 'pressure(outsideGreen)');
  } else {
    applyFeverDelta(-0.6, 'calm(green)');
  }

  // drift mean (controlled)
  if (driftOk()){
    if (S.storm){
      const oldK = S.driftK, oldCap = S.driftCap;
      S.driftK = Math.max(S.driftK, 0.06);
      S.driftCap = Math.max(S.driftCap, 1.8);
      driftWaterToMean();
      S.driftK = oldK; S.driftCap = oldCap;
    } else {
      driftWaterToMean();
    }
  }

  // Storm scheduler
  if (!S.storm){
    S.stormNextInSec -= 1;
    if (S.stormNextInSec <= 0){
      startStorm();
    }
  } else {
    S.stormLeftSec -= 1;
    if (S.stormLeftSec <= 0){
      stopStorm();
    }
  }

  checkGoal();
  pushHUD();

  if (S.secLeft <= 0) endGame();
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
    minisDone:S.minisDone,
    shieldLeft:S.shield|0
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

  // reset core
  S.score=0; S.combo=0; S.comboMax=0; S.miss=0; S.hits=0; S.total=0;
  S.fever=0; S.greenSec=0; S.goalsDone=0; S.minisDone=0;
  S.lastCause='init';

  // shield reset
  S.shield = 0;
  S.greenStreak = 0;

  // storm mini reset
  S.stormMiniActive = false;
  S.stormMiniDone = false;

  // water start
  const waterStart = clamp(qnum('waterStart', 34), 0, 100);
  S.water = waterStart;

  // drift
  S.tStartedAt = now();
  S.hasInteracted = false;
  S.autoDriftDelayMs = S.isResearch ? 0 : 4200;
  S.driftK   = S.isResearch ? 0.075 : 0.028;
  S.driftCap = S.isResearch ? 2.4   : 0.85;

  // storm cadence
  S.storm = false;
  S.stormMinGap = S.isResearch ? 10 : 12;
  S.stormMaxGap = S.isResearch ? 15 : 18;
  S.stormDurMin = S.isResearch ? 5  : 4;
  S.stormDurMax = S.isResearch ? 7  : 6;
  scheduleNextStorm();
  updateStormUI();

  // init UI
  try { ensureWaterGauge && ensureWaterGauge(); } catch {}
  try { setWaterGauge && setWaterGauge(S.water); } catch {}
  setEdgeFX(getZoneFromWater(S.water), 0);
  applyFeverDelta(0, 'init');
  pushHUD();

  // audio (after START click)
  ensureAudio();
  await resumeAudio();

  const ov = $('start-overlay');
  if (ov) ov.style.display = 'none';

  const pools = { good:['.'], bad:['.'], trick:[] };

  const trickRate = S.isResearch ? 0.14 : 0.10;
  const spawnMul  = S.isResearch ? 0.90 : 0.95;

  S.controller = await factoryBoot({
    modeKey:'hydration',
    difficulty:S.diff,
    duration:S.secLeft,

    spawnHost: '#hvr-layer',
    boundsHost: '#playfield',

    spawnAroundCrosshair: false,
    spawnStrategy: 'grid9',

    goodRate: 0.62,
    trickRate,

    allowAdaptive: true,
    spawnIntervalMul: () => spawnMul,

    pools,
    powerups: ['.'],
    powerRate: S.isResearch ? 0.14 : 0.11,
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
    ? 'โหมดวิจัย: BAD expire นับโทษ + Mini FULL โหดสุด 🧪'
    : 'โหมดเล่น: BAD expire = หลบสำเร็จ + Mini FULL ท้าทาย 💧'
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

// Boot (no timers before START)
(function boot(){
  if (!DOC) return;
  bindUI();

  try { ensureWaterGauge && ensureWaterGauge(); } catch {}
  try { setWaterGauge && setWaterGauge(S.water); } catch {}
  updateShieldUI();
  updateStormUI();
  pushHUD();
})();
