// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — DOM Target Engine (scroll-follow + crosshair-ready)
// - spawn ลง #hvr-playfield (เลื่อนตาม scroll)
// - click/tap หรือยิงด้วย crosshair (HTML ทำ elementFromPoint แล้ว)
// - Water Gauge (bind กับ header)
// - Fever + Shield (ใช้ FeverUI จาก /vr/ui-fever.js)
// - Quest: hydration.quest.js
// - Grade + Progress to S (S 30%)
// - สนุกท้าทาย 1–8: jiggle/blink targets, combo ramp, fever rush, shield block, perfect streak, risky junk, bonus safe, coach hype, end summary event

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import { createHydrationQuest } from './hydration.quest.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebration(){}, floatScore(){} };

const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI ||
  null;

function clamp(v, a, b){
  v = Number(v) || 0;
  if (v < a) return a;
  if (v > b) return b;
  return v;
}

function $(id){ return DOC ? DOC.getElementById(id) : null; }

function dispatch(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

function nowMs(){ return (ROOT.performance && performance.now) ? performance.now() : Date.now(); }

// ---------- Grade ----------
function calcGrade({ score, miss, goalsCleared, minisCleared, timeLeft, totalTime }){
  const tUsed = (totalTime|0) - (timeLeft|0);
  const speedBonus = Math.max(0, (totalTime|0) - tUsed) * 2;

  const perf =
    (score|0)
    - (miss|0) * 70
    + (goalsCleared|0) * 420
    + (minisCleared|0) * 180
    + speedBonus;

  if (perf >= 3400) return 'SSS';
  if (perf >= 2900) return 'SS';
  if (perf >= 2400) return 'S';
  if (perf >= 1900) return 'A';
  if (perf >= 1450) return 'B';
  return 'C';
}

function scoreForS(diffKey='normal'){
  if (diffKey === 'easy') return 1400;
  if (diffKey === 'hard') return 1800;
  return 1600;
}

function calcProgressToS({ score, miss, goalsCleared, minisCleared, diffKey }){
  const target = scoreForS(diffKey);
  const perf = (score|0) - (miss|0)*60 + (goalsCleared|0)*350 + (minisCleared|0)*160;
  const pct = clamp((perf / Math.max(1, target)) * 100, 0, 100);
  return { pct, perf, target };
}

function setGradeProgress(pct){
  const fill = $('hha-grade-progress-fill');
  const text = $('hha-grade-progress-text');
  const hint = $('hha-grade-progress-hint');

  const p = clamp(pct, 0, 100);
  if (fill) fill.style.width = p.toFixed(0) + '%';
  if (text) text.textContent = `S ${p.toFixed(0)}%`;

  if (hint){
    if (p >= 100) hint.textContent = 'ถึง S แล้ว! ไป SS ต่อ!';
    else if (p >= 70) hint.textContent = 'ใกล้แล้ว! ยิงให้ไวขึ้น!';
    else if (p >= 35) hint.textContent = 'ดีขึ้นเรื่อย ๆ! รักษาคอมโบ!';
    else hint.textContent = 'ไปให้ถึง S!';
  }
}

// ---------- HUD bindings ----------
function setText(id, val){
  const el = $(id);
  if (el) el.textContent = String(val);
}

function setCoach(text, mood='neutral'){
  dispatch('hha:coach', { text, mood });
  const t = $('hha-coach-text');
  if (t) t.textContent = text;
}

// ---------- Audio tiny beep (fallback) ----------
let audioCtx = null;
function beep(freq=880, dur=0.06){
  try{
    audioCtx = audioCtx || new (ROOT.AudioContext || ROOT.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = 0.035;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  }catch{}
}

// ---------- Boot ----------
export async function boot(opts = {}){
  if (!DOC) return;

  const difficulty = String(opts.difficulty || 'normal').toLowerCase();
  const duration   = clamp(opts.duration ?? 80, 20, 180);

  // bind gauges
  ensureWaterGauge();
  if (FeverUI && typeof FeverUI.ensureFeverBar === 'function') FeverUI.ensureFeverBar();

  // ----- State -----
  const totalTime = duration|0;
  let timeLeft = totalTime;

  let score = 0;
  let miss = 0;

  let combo = 0;
  let comboMax = 0;

  let waterPct = 50;         // 0..100
  let zone = zoneFrom(waterPct);

  let shield = 0;            // 0..3
  let fever = 0;             // 0..100
  let feverActive = false;
  let feverUntil = 0;

  let goalDone = 0;
  let miniDone = 0;

  // ----- Quest -----
  const Q = createHydrationQuest(difficulty);

  function syncQuestCounts(){
    const g = Q.getProgress('goals');
    const m = Q.getProgress('mini');
    goalDone = (g._all ? g._all.filter(x=>x._done||x.done).length : 0);
    miniDone = (m._all ? m._all.filter(x=>x._done||x.done).length : 0);

    // อัปเดต HUD counter
    setText('hha-goal-done', goalDone);
    setText('hha-goal-total', (g._all ? g._all.length : 2));
    setText('hha-mini-done', miniDone);
    setText('hha-mini-total', (m._all ? m._all.length : 3));

    // โชว์ข้อความ goal/mini ปัจจุบัน (ตัวแรกที่ยังไม่ done)
    const gNow = (g && g.length) ? g[0] : (g._all ? g._all[0] : null);
    const mNow = (m && m.length) ? m[0] : (m._all ? m._all[0] : null);

    if (gNow) setText('hha-quest-goal', `Goal: ${gNow.label || gNow.text || '...'}`);
    if (mNow) setText('hha-quest-mini', `Mini: ${mNow.label || mNow.text || '...'}`);

    // ส่งให้ HUD กลาง
    dispatch('quest:update', {
      goal: gNow ? (gNow.label || gNow.text) : '',
      mini: mNow ? (mNow.label || mNow.text) : '',
      goalsCleared: goalDone,
      minisCleared: miniDone,
      goalTotal: g._all ? g._all.length : 2,
      miniTotal: m._all ? m._all.length : 3
    });
  }

  function setShield(n){
    shield = clamp(n|0, 0, 3);
    setText('hha-shield-count', shield);
    if (FeverUI && typeof FeverUI.setShield === 'function') FeverUI.setShield(shield);
  }

  function setFever(v){
    fever = clamp(v, 0, 100);
    if (FeverUI && typeof FeverUI.setFever === 'function') FeverUI.setFever(fever);
  }

  function setFeverActive(on){
    feverActive = !!on;
    if (FeverUI && typeof FeverUI.setFeverActive === 'function') FeverUI.setFeverActive(feverActive);
  }

  function addFever(delta){
    if (feverActive) return;
    setFever(fever + (delta|0));
    if (fever >= 100){
      setFever(100);
      setFeverActive(true);
      feverUntil = nowMs() + 6000;
      setCoach('🔥 FEVER TIME! คะแนน x2 ไปเลยยย!', 'happy');
    }
  }

  function maybeEndFever(){
    if (!feverActive) return;
    if (nowMs() >= feverUntil){
      setFeverActive(false);
      setFever(0);
      setCoach('เยี่ยม! เก็บน้ำดีต่อเนื่องนะ 💧', 'neutral');
    }
  }

  function updateWater(next){
    waterPct = clamp(next, 0, 100);
    zone = zoneFrom(waterPct);
    setWaterGauge(waterPct);

    // quest sync zone/greenTick
    Q.stats.zone = zone;
  }

  function softCenterWater(){
    // “น้ำเหวี่ยง” จะค่อย ๆ กลับมาหากลาง
    const toward = 50;
    const d = toward - waterPct;
    updateWater(waterPct + d * 0.04);
  }

  function fxAt(cx, cy, label, kind){
    // safe
    try{
      if (Particles && typeof Particles.scorePop === 'function') Particles.scorePop(cx, cy, label, kind);
      if (Particles && typeof Particles.floatScore === 'function') Particles.floatScore(cx, cy, label);
      if (Particles && typeof Particles.burstAt === 'function') Particles.burstAt(cx, cy, kind || 'good');
    }catch{}
    dispatch('hha:judge', { label, kind, cx, cy });
  }

  function pushHUD(){
    // score
    setText('hha-score-main', score|0);
    setText('hha-combo-max', comboMax|0);
    setText('hha-miss', miss|0);
    setText('hha-water-zone-text', zone);

    // grade
    const grade = calcGrade({ score, miss, goalsCleared: goalDone, minisCleared: miniDone, timeLeft, totalTime });
    setText('hha-grade-badge', grade);

    // progress to S
    const prog = calcProgressToS({
      score, miss,
      goalsCleared: goalDone,
      minisCleared: miniDone,
      diffKey: difficulty
    });
    setGradeProgress(prog.pct);

    // ส่ง event ให้ HUD กลาง
    dispatch('hha:score', {
      mode: 'hydration',
      score, combo, comboMax, miss,
      waterPct, zone,
      shield, fever, feverActive,
      grade,
      goalsCleared: goalDone,
      minisCleared: miniDone,
      timeLeft, totalTime
    });
  }

  // ----- Pools & powerups -----
  const pools = {
    good: ['💧','🥛','🍉','🥒','🍓','🍊'],
    bad:  ['🥤','🧋','🍺','🍷']
  };
  const powerups = ['🛡️','⭐','⚡'];

  // ----- Make targets fun (1–8) -----
  function decorateTarget(el, isPower, isGood){
    // jiggle บ่อยขึ้นเมื่อยากขึ้น
    const r = Math.random();
    if (isPower || r < 0.40) el.classList.add('jiggle');
    if (!isGood || isPower || r < 0.30) el.classList.add('blink');
  }

  // ----- Judge -----
  function judge(ch, ctx){
    const cx = ctx && (ctx.cx ?? ctx.clientX ?? (ROOT.innerWidth/2));
    const cy = ctx && (ctx.cy ?? ctx.clientY ?? (ROOT.innerHeight/2));

    const isPower = !!(ctx && ctx.isPower);
    const isGood  = !!(ctx && ctx.isGood);

    // FEVER x2
    const mult = feverActive ? 2 : 1;

    // powerups
    if (isPower){
      if (ch === '🛡️'){
        setShield(shield + 1);
        score += 120 * mult;
        combo += 1;
        comboMax = Math.max(comboMax, combo);
        Q.onGood(); Q.updateCombo(combo); Q.updateScore(score);
        addFever(10);
        fxAt(cx, cy, '+SHIELD', 'block');
        setCoach('🛡️ ได้เกราะแล้ว! กันน้ำหวานได้ 1 ครั้ง!', 'happy');
        return { scoreDelta: 120 * mult, good: true };
      }
      if (ch === '⚡'){
        score += 160 * mult;
        combo += 2;
        comboMax = Math.max(comboMax, combo);
        Q.onGood(); Q.updateCombo(combo); Q.updateScore(score);
        addFever(18);
        fxAt(cx, cy, 'FAST!', 'good');
        setCoach('⚡ โอ้โห! คอมโบพุ่งงง!', 'happy');
        return { scoreDelta: 160 * mult, good: true };
      }
      // ⭐ bonus
      score += 200 * mult;
      combo += 1;
      comboMax = Math.max(comboMax, combo);
      Q.onGood(); Q.updateCombo(combo); Q.updateScore(score);
      addFever(14);
      updateWater(waterPct + 6);
      fxAt(cx, cy, '+BONUS', 'good');
      return { scoreDelta: 200 * mult, good: true };
    }

    // BAD drink hit
    if (!isGood){
      // shield block
      if (shield > 0){
        setShield(shield - 1);
        // block: ไม่เป็น miss, ลดผลเสีย
        score += 10;
        combo = 0;
        Q.onJunk(); Q.updateCombo(combo); Q.updateScore(score);
        addFever(4);
        updateWater(waterPct - 4);
        fxAt(cx, cy, 'BLOCK!', 'block');
        setCoach('🛡️ บล็อกได้! แต่ระวังน้ำหวานนะ!', 'neutral');
        return { scoreDelta: 10, good: true, blocked: true };
      }

      miss += 1;
      combo = 0;

      // junk ทำให้น้ำเหวี่ยงแรง
      updateWater(waterPct - (feverActive ? 10 : 16));

      // score penalty
      const pen = feverActive ? 60 : 90;
      score = Math.max(0, score - pen);

      Q.onJunk(); Q.updateCombo(combo); Q.updateScore(score);
      fxAt(cx, cy, 'MISS', 'bad');

      setCoach('🥤 โอ๊ะ! น้ำหวาน! กลับไปเก็บน้ำดีเร็ว 💧', 'sad');
      beep(420, 0.06);
      pushHUD();
      syncQuestCounts();
      return { scoreDelta: -pen, good: false, label:'MISS' };
    }

    // GOOD hit
    const base = 80;
    const comboBonus = Math.min(220, combo * 8);
    const gain = (base + comboBonus) * mult;

    score += gain;
    combo += 1;
    comboMax = Math.max(comboMax, combo);

    // น้ำดีเพิ่ม water + ช่วยดึงกลับสู่ GREEN
    updateWater(waterPct + (combo >= 8 ? 6 : 4));

    addFever(12);

    Q.onGood();
    Q.updateCombo(combo);
    Q.updateScore(score);

    // Perfect feedback
    if (combo > 0 && combo % 10 === 0){
      fxAt(cx, cy, `PERFECT x${combo}!`, 'good');
      setCoach(`สุดยอด! คอมโบ ${combo} แล้ววว! 🔥`, 'happy');
    } else {
      fxAt(cx, cy, `+${gain}`, 'good');
    }

    pushHUD();
    syncQuestCounts();
    return { scoreDelta: gain, good: true };
  }

  // ----- Expire (พลาดน้ำดี = miss) -----
  function onExpire(info){
    if (!info) return;
    const { ch, isGood, isPower } = info;

    // ปล่อย BAD หาย = โบนัสเล็ก ๆ (หลบได้)
    if (!isGood && !isPower){
      score += 20;
      Q.updateScore(score);
      pushHUD();
      return;
    }

    // น้ำดีหายไป = miss
    if (isGood && !isPower){
      miss += 1;
      combo = 0;
      score = Math.max(0, score - 35);
      updateWater(waterPct - 6);
      Q.updateCombo(combo);
      Q.updateScore(score);
      dispatch('hha:judge', { label:'MISS', kind:'miss-expire' });
      pushHUD();
      syncQuestCounts();
    }
  }

  // ----- tick every second from mode-factory -----
  function onTime(ev){
    const sec = ev && ev.detail && typeof ev.detail.sec === 'number' ? ev.detail.sec : null;
    if (sec == null) return;
    timeLeft = sec|0;

    // quest second tick
    Q.second();

    // green tick
    if (zone === 'GREEN') Q.stats.greenTick += 1;

    // soft center drift
    softCenterWater();

    // fever end
    maybeEndFever();

    // update
    Q.updateScore(score);
    syncQuestCounts();
    pushHUD();

    // end
    if (timeLeft <= 0){
      endGame();
    }
  }

  function endGame(){
    ROOT.removeEventListener('hha:time', onTime);

    const grade = calcGrade({ score, miss, goalsCleared: goalDone, minisCleared: miniDone, timeLeft:0, totalTime });

    setCoach(`จบเกมแล้ว! ได้เกรด ${grade} 🎉  (Goal ${goalDone}/${2}, Mini ${miniDone}/${3})`, 'happy');

    try{
      if (Particles && typeof Particles.celebration === 'function') Particles.celebration();
    }catch{}

    dispatch('hha:end', {
      mode:'hydration',
      score, miss, comboMax,
      goalsCleared: goalDone,
      minisCleared: miniDone,
      grade
    });

    dispatch('hha:stop', { mode:'hydration' });
  }

  // initial hud
  setShield(0);
  setFever(0);
  setFeverActive(false);
  updateWater(50);
  syncQuestCounts();
  pushHUD();
  setCoach('เริ่มเลย! 💧 ยิงน้ำดีให้ไว เลี่ยงน้ำหวาน!', 'happy');

  // spawn targets (สำคัญ: spawnHost ให้ลง playfield)
  const inst = await factoryBoot({
    difficulty,
    duration: totalTime,
    modeKey: 'hydration',
    pools,
    goodRate: (difficulty === 'hard') ? 0.55 : (difficulty === 'easy' ? 0.68 : 0.60),
    powerups,
    powerRate: (difficulty === 'hard') ? 0.13 : 0.11,
    powerEvery: 6,
    spawnStyle: 'pop',
    judge: (ch, ctx) => {
      const res = judge(ch, ctx);

      // decorate last spawned target? (mode-factory สร้างเอง)
      // -> ใช้วิธี decorate ผ่าน DOM scan แบบเบา ๆ (ไม่หนัก)
      try{
        const pf = $('hvr-playfield');
        if (pf){
          const last = pf.querySelector('.hvr-target:last-child');
          if (last) decorateTarget(last, !!ctx?.isPower, !!ctx?.isGood);
        }
      }catch{}

      return res;
    },
    onExpire,
    spawnHost: '#hvr-playfield'
  });

  // listen time ticks
  ROOT.addEventListener('hha:time', onTime);

  // expose for debug
  ROOT.HHA_ACTIVE_INST = {
    stop(){ try{ inst && inst.stop && inst.stop(); }catch{} },
  };

  return ROOT.HHA_ACTIVE_INST;
}

export default { boot };
