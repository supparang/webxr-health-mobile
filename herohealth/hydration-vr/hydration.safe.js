// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration mode – น้ำสมดุล + Water Gauge + Fever + Quest (PC / Mobile / VR)

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import * as HQ from './hydration.quest.js';

// ---------- Root & Global modules ----------
const ROOT = (typeof window !== 'undefined' ? window : globalThis);

// Particles: /vr/particles.js (IIFE)
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop () {}, burstAt () {} };

// FeverUI: /vr/ui-fever.js (IIFE)
const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI ||
  {
    ensureFeverBar () {},
    setFever () {},
    setFeverActive () {},
    setShield () {}
  };

const { ensureFeverBar, setFever, setFeverActive, setShield } = FeverUI;

// ---------- Quest targets (ดีไซน์ต่อเกม) ----------
const GOAL_TARGET = 2;   // ภารกิจหลัก 2 อันต่อเกม
const MINI_TARGET = 3;   // mini quest 3 อันต่อเกม

// ---------- Phase config (1: Phase-based difficulty) ----------
function phaseFromRatio (r) {
  if (r >= 0.66) return 'late';
  if (r >= 0.33) return 'mid';
  return 'early';
}

function phaseScoreMultiplier (phase) {
  switch (phase) {
    case 'mid': return 1.1;
    case 'late': return 1.25;
    default: return 1.0;
  }
}

// ---------- Coach helper ----------
let lastCoachAt = 0;
function coach (text, minGap = 2200) {
  if (!text) return;
  const now = Date.now();
  if (now - lastCoachAt < minGap) return;
  lastCoachAt = now;
  try {
    ROOT.dispatchEvent(new CustomEvent('hha:coach', { detail: { text } }));
  } catch {}
}

// ---------- เลือก factory createHydrationQuest ----------
function getCreateHydrationQuest () {
  if (typeof HQ.createHydrationQuest === 'function') {
    return HQ.createHydrationQuest;
  }
  if (HQ.default) {
    if (typeof HQ.default.createHydrationQuest === 'function') {
      return HQ.default.createHydrationQuest;
    }
    if (typeof HQ.default === 'function') {
      return HQ.default;
    }
  }
  throw new Error('createHydrationQuest not found in hydration.quest.js');
}

// ---------- Emoji pools ----------
const GOOD = ['💧', '🥛', '🍉']; // น้ำดี
const BAD  = ['🥤', '🧋', '🍺', '☕️']; // น้ำหวาน / คาเฟอีน ฯลฯ

const STAR   = '⭐';
const DIA    = '💎';
const SHIELD = '🛡️';
const FIRE   = '🔥';
const BONUS  = [STAR, DIA, SHIELD, FIRE];

// ---------- Safe wrappers ----------
function safeScorePop (x, y, value, judgment, isGood) {
  try {
    Particles.scorePop(x, y, String(value), {
      good: !!isGood,
      judgment: judgment || ''
    });
  } catch {}
}

function safeBurstAt (x, y, isGood) {
  try {
    Particles.burstAt(x, y, {
      color: isGood ? '#22c55e' : '#f97316'
    });
  } catch {}
}

// ======================================================
//  boot(cfg) — entry หลักที่ hydration-vr.html เรียก
// ======================================================

export async function boot (cfg = {}) {
  // ----- Difficulty + Duration -----
  const diffRaw = String(cfg.difficulty || 'normal').toLowerCase();
  const diff = (diffRaw === 'easy' || diffRaw === 'hard' || diffRaw === 'normal')
    ? diffRaw
    : 'normal';

  let dur = Number(cfg.duration || 60);
  if (!Number.isFinite(dur) || dur <= 0) dur = 60;
  if (dur < 20)  dur = 20;
  if (dur > 180) dur = 180;

  // ----- Fever + Water gauge initial HUD -----
  ensureFeverBar();
  let fever = 0;
  let feverActive = false;
  let shield = 0;
  setFever(fever);
  setFeverActive(feverActive);
  setShield(shield);

  ensureWaterGauge();
  let waterPct = 50;
  let waterRes = setWaterGauge(waterPct);
  let waterZone = waterRes.zone || 'GREEN';
  const waterStart = waterPct;

  // ----- Quest Deck (สร้างจาก factory) -----
  let deck;
  try {
    const factory = getCreateHydrationQuest();
    deck = factory(diff); // createHydrationQuest(diff)
  } catch (err) {
    console.error('[Hydration] createHydrationQuest error', err);
    // fallback ปลอดภัย: deck เปล่าที่ไม่ล้มเกม
    deck = {
      stats: { greenTick: 0, zone: waterZone },
      updateScore () {},
      updateCombo () {},
      onGood () {},
      onJunk () {},
      second () {},
      getProgress () { return []; },
      drawGoals () {},
      draw3 () {}
    };
  }

  if (!deck.stats) deck.stats = {};
  deck.stats.greenTick = 0;
  deck.stats.zone = waterZone;

  // ---------- นับจำนวนภารกิจตามดีไซน์ต่อเกม ----------
  let goalCleared = 0; // 0–2
  let miniCleared = 0; // 0–3

  function questMeta () {
    return {
      goalsCleared: goalCleared,
      goalsTarget: GOAL_TARGET,
      minisCleared: miniCleared,
      minisTarget: MINI_TARGET
    };
  }

  // ---------- state หลักของเกม ----------
  let score    = 0;
  let combo    = 0;
  let comboMax = 0;
  let misses   = 0;
  let star     = 0;
  let diamond  = 0;
  let elapsedSec = 0; // เวลาเล่นสะสม (นับขึ้น)

  // Phase / adaptive state (1–3)
  let currentPhase  = 'early';
  let recentHits    = 0;
  let recentMisses  = 0;
  let burstGiven    = false;

  function updatePhase () {
    const ratio = dur > 0 ? (elapsedSec / dur) : 0;
    const next  = phaseFromRatio(ratio);
    if (next !== currentPhase) {
      currentPhase = next;
      try {
        ROOT.dispatchEvent(new CustomEvent('hha:phase', {
          detail: { phase: currentPhase, ratio }
        }));
      } catch {}
      if (currentPhase === 'mid') {
        coach('เข้าช่วงกลางเกมแล้ว ลองรักษาโซนน้ำให้เขียวต่อเนื่องดูนะ 💧');
      } else if (currentPhase === 'late') {
        coach('โค้งสุดท้ายแล้ว! เก็บคอมโบให้ได้เยอะที่สุดเลย 💪');
      }
    }
  }

  function adaptiveMultiplier () {
    if (recentHits >= 10 && recentMisses === 0) return 1.35;
    if (recentMisses >= 4 && recentHits <= 3)  return 0.85;
    return 1.0;
  }

  function onHit (isGood) {
    if (!isGood) return;
    recentHits++;
    if (recentHits > 20) recentHits = 20;

    // burst bonus 1 ครั้งต่อเกม
    if (!burstGiven && recentHits >= 12 && recentMisses === 0) {
      burstGiven = true;
      try {
        ROOT.dispatchEvent(new CustomEvent('hydration:burst-bonus', {
          detail: { streak: recentHits, phase: currentPhase }
        }));
      } catch {}
      const bonus = 120;
      score += bonus;
      safeScorePop(window.innerWidth / 2, window.innerHeight / 2, `+${bonus}`, 'BONUS', true);
      coach('สุดยอด! เก็บน้ำดีรัว ๆ ได้โบนัสพิเศษไปเลย 🎁💧', 2000);
    }
  }

  function onMiss () {
    recentMisses++;
    if (recentMisses > 10) recentMisses = 10;
  }

  function mult () {
    const phaseMul = phaseScoreMultiplier(currentPhase);
    const adaptMul = adaptiveMultiplier();
    const feverMul = feverActive ? 2 : 1;
    return phaseMul * adaptMul * feverMul;
  }

  // Fever objective
  let feverHitStreak = 0;

  function pushFeverEvent (state) {
    try {
      ROOT.dispatchEvent(new CustomEvent('hha:fever', {
        detail: { state, fever, active: feverActive }
      }));
    } catch {}
  }

  function applyFeverUI () {
    setFever(fever);
    setFeverActive(feverActive);
    setShield(shield);
  }

  function gainFever (n) {
    const wasActive = feverActive;
    fever = Math.max(0, Math.min(100, fever + n));
    if (!feverActive && fever >= 100) {
      feverActive   = true;
      feverHitStreak = 0;
      coach('เข้าโหมดไฟแล้ว! เลือกน้ำดีรัว ๆ เลย 🔥');
      pushFeverEvent('start');
    } else {
      pushFeverEvent('change');
    }
    applyFeverUI();
  }

  function decayFever (n) {
    const wasActive = feverActive;
    const d = feverActive ? 10 : n;
    fever = Math.max(0, fever - d);
    if (feverActive && fever <= 0) {
      feverActive   = false;
      feverHitStreak = 0;
    }
    if (wasActive && !feverActive) {
      pushFeverEvent('end');
    } else {
      pushFeverEvent('change');
    }
    applyFeverUI();
  }

  function addWater (n) {
    waterPct = Math.max(0, Math.min(100, waterPct + n));
    waterRes = setWaterGauge(waterPct);
    waterZone = waterRes.zone;
    deck.stats.zone = waterZone;
  }

  function syncDeck () {
    if (!deck) return;
    if (typeof deck.updateScore === 'function') deck.updateScore(score);
    if (typeof deck.updateCombo === 'function') deck.updateCombo(combo);
  }

  function pushHudScore (extra = {}) {
    try {
      ROOT.dispatchEvent(new CustomEvent('hha:score', {
        detail: {
          mode: 'Hydration',
          modeKey: 'hydration-vr',
          modeLabel: 'Hydration',
          difficulty: diff,
          score,
          combo,
          comboMax,
          misses,
          miss: misses,
          timeSec: elapsedSec,
          waterPct,
          waterZone,
          phase: currentPhase,
          ...questMeta(),
          ...extra
        }
      }));
    } catch {}
  }

  function pushQuest (hint) {
    if (!deck || typeof deck.getProgress !== 'function') return;
    const goals = deck.getProgress('goals') || [];
    const minis = deck.getProgress('mini')  || [];

    const currentGoal = goals.find(g => !g.done) || goals[0] || null;
    const currentMini = minis.find(m => !m.done) || minis[0] || null;

    try {
      ROOT.dispatchEvent(new CustomEvent('quest:update', {
        detail: {
          goal: currentGoal,
          mini: currentMini,
          goalsAll: goals,
          minisAll: minis,
          hint: hint || `โซนน้ำ: ${waterZone}`,
          meta: questMeta()
        }
      }));
    } catch {}
  }

  function scoreFX (x, y, val, judgment, isGood) {
    safeScorePop(x, y, val, judgment, isGood);
    safeBurstAt(x, y, isGood);
  }

  function sendJudge (label, payload = {}) {
    try {
      ROOT.dispatchEvent(new CustomEvent('hha:judge', {
        detail: { label, ...payload }
      }));
    } catch {}
  }

  // ======================================================
  //  JUDGE — เรียกจาก mode-factory เมื่อผู้เล่นแตะเป้า
  // ======================================================
  function judge (ch, ctx) {
    const x = ctx?.clientX ?? ctx?.cx ?? 0;
    const y = ctx?.clientY ?? ctx?.cy ?? 0;

    // ----- Power-ups -----
    if (ch === STAR) {
      let d = 40;
      d = Math.round(d * mult());
      score += d;
      star++;
      gainFever(10);
      deck.onGood && deck.onGood();
      combo++; comboMax = Math.max(comboMax, combo);
      onHit(true);
      syncDeck(); pushQuest();
      scoreFX(x, y, d, 'GOOD', true);
      sendJudge('GOOD', { scoreDelta: d, kind: 'STAR' });
      pushHudScore();
      return { good: true, scoreDelta: d };
    }

    if (ch === DIA) {
      let d = 80;
      d = Math.round(d * mult());
      score += d;
      diamond++;
      gainFever(30);
      deck.onGood && deck.onGood();
      combo++; comboMax = Math.max(comboMax, combo);
      onHit(true);
      syncDeck(); pushQuest();
      scoreFX(x, y, d, 'PERFECT', true);
      sendJudge('PERFECT', { scoreDelta: d, kind: 'DIA' });
      pushHudScore();
      return { good: true, scoreDelta: d };
    }

    if (ch === SHIELD) {
      shield = Math.min(3, shield + 1);
      setShield(shield);
      let d = 20;
      d = Math.round(d * mult());
      score += d;
      deck.onGood && deck.onGood();
      onHit(true);
      syncDeck(); pushQuest();
      scoreFX(x, y, d, 'GOOD', true);
      coach('ได้เกราะกันน้ำหวานแล้ว 🛡️ ถ้าเผลอแตะจะไม่ถือว่าพลาดหนึ่งครั้ง', 3500);
      sendJudge('GOOD', { scoreDelta: d, kind: 'SHIELD' });
      pushHudScore();
      return { good: true, scoreDelta: d };
    }

    if (ch === FIRE) {
      const wasActive = feverActive;
      feverActive = true;
      fever = Math.max(fever, 60);
      applyFeverUI();
      if (!wasActive) {
        pushFeverEvent('start');
      } else {
        pushFeverEvent('change');
      }

      let d = 25;
      d = Math.round(d * mult());
      score += d;
      deck.onGood && deck.onGood();
      combo++; comboMax = Math.max(comboMax, combo);
      onHit(true);
      syncDeck(); pushQuest();
      scoreFX(x, y, d, 'FEVER', true);
      coach('โหมดไฟ 🔥 เลือกน้ำดีให้ไว แล้วหลบพวกน้ำหวาน!', 3500);
      sendJudge('FEVER', { scoreDelta: d, kind: 'FIRE' });
      pushHudScore();
      return { good: true, scoreDelta: d };
    }

    // ----- ปกติ: น้ำดี / น้ำไม่ดี -----
    if (GOOD.includes(ch)) {
      addWater(+8);
      let d = (14 + combo * 2);
      d = Math.round(d * mult());
      score += d;
      combo++;
      comboMax = Math.max(comboMax, combo);

      gainFever(6 + combo * 0.4);
      deck.onGood && deck.onGood();
      onHit(true);
      syncDeck(); pushQuest();

      const label = combo >= 8 ? 'PERFECT' : 'GOOD';
      scoreFX(x, y, d, label, true);
      sendJudge(label, { scoreDelta: d, combo });

      if (combo === 1) {
        coach('ดีมาก เริ่มสะสมน้ำดีแล้ว 💧 เลือกพวกน้ำเปล่า นม ผลไม้ต่อเลย');
      } else if (combo === 5) {
        coach('คอมโบ 5 แล้ว เก่งมาก! รักษาจังหวะนี้ไว้นะ 💪', 3500);
      } else if (combo === 10) {
        coach('โหดมาก! คอมโบสิบเลย แทบไม่มีน้ำหวานปนเลย 🎉', 3500);
      }

      // Fever objective – เก็บ 10 แก้วติดในโหมดไฟ
      if (feverActive) {
        feverHitStreak++;
        if (feverHitStreak === 10) {
          const bonus = 150;
          score += bonus;
          safeScorePop(x, y, `+${bonus}`, 'MEGA', true);
          coach('โหมดไฟสุดโหด! ได้โบนัส Mega Drop 🔥💧', 3500);
          try {
            ROOT.dispatchEvent(new CustomEvent('hydration:fever-mega', {
              detail: { streak: feverHitStreak }
            }));
          } catch {}
          pushHudScore();
        }
      }

      pushHudScore();
      return { good: true, scoreDelta: d };
    }

    // ----- น้ำไม่ดี / junk -----
    if (BAD.includes(ch)) {
      // มี shield → BLOCK (ไม่ถือว่า miss)
      if (shield > 0) {
        shield--;
        setShield(shield);
        addWater(-4);
        decayFever(6);
        deck.onGood && deck.onGood(); // ถือว่าเก็บเป้าพิเศษ
        syncDeck(); pushQuest();
        scoreFX(x, y, 0, 'BLOCK', false);
        coach('เกราะช่วยกันน้ำหวานให้แล้วนะ 🛡️ ระวังอย่าเผลอบ่อยเกินไป', 3500);
        sendJudge('BLOCK', { scoreDelta: 0 });
        pushHudScore();
        return { good: false, scoreDelta: 0 };
      }

      // ❗ ไม่มี shield → นับเป็น MISS จริง
      addWater(-8);
      let d = -10;
      d = Math.round(d * phaseScoreMultiplier(currentPhase)); // miss ไม่โดน fever/adapt คูณ
      score = Math.max(0, score + d);
      combo = 0;
      misses++;
      onMiss();

      // ถ้าโดนน้ำหวานตอนอยู่ในโหมดไฟ → ดับไฟทันที
      if (feverActive) {
        feverActive   = false;
        fever         = 0;
        feverHitStreak = 0;
        applyFeverUI();
        pushFeverEvent('end');
        coach('โหมดไฟดับเพราะโดนน้ำหวาน รอบหน้าลองโฟกัสน้ำดีให้มากขึ้นนะ 🔥➡️🥤', 4000);
      } else {
        decayFever(14);
      }

      deck.onJunk && deck.onJunk();
      syncDeck(); pushQuest();
      scoreFX(x, y, d, 'MISS', false);

      try {
        ROOT.dispatchEvent(new CustomEvent('hha:miss', {
          detail: { misses }
        }));
      } catch {}

      if (misses === 1) {
        coach('ลองสังเกตดูว่าน้ำไหนหวานจัด 🥤 ลองเปลี่ยนเป็นน้ำเปล่าหรือนมแทนนะ', 4000);
      } else if (misses === 3) {
        coach('น้ำหวานเริ่มเยอะแล้ว ลองตั้งเป้าเลือกแต่ 💧 กับ 🥛 สักพักนะ', 4000);
      }

      sendJudge('MISS', { scoreDelta: d });
      pushHudScore();
      return { good: false, scoreDelta: d };
    }

    // emoji แปลก ๆ → ไม่ทำอะไร
    return { good: false, scoreDelta: 0 };
  }

  // ======================================================
  //  เมื่อเป้าหายไปเอง (expire) — ไม่ถือว่า miss
  // ======================================================
  function onExpire (ev) {
    if (ev && ev.isGood === false) {
      deck.onJunk && deck.onJunk();
      syncDeck();
      pushQuest();
      pushHudScore({ reason: 'expire' });
    }
  }

  // ======================================================
  //  Tick รายวินาที (เรียกจาก hha:time)
  // ======================================================
  let ended = false;

  function checkQuestCompletion () {
    if (!deck || typeof deck.getProgress !== 'function') return;

    const goals = deck.getProgress('goals') || [];
    const minis = deck.getProgress('mini')  || [];

    const rawGoalDone = goals.filter(g => g && g.done).length;
    const rawMiniDone = minis.filter(m => m && m.done).length;

    const prevGoal = goalCleared;
    const prevMini = miniCleared;

    goalCleared = Math.min(GOAL_TARGET, rawGoalDone);
    miniCleared = Math.min(MINI_TARGET, rawMiniDone);

    if (goalCleared > prevGoal) {
      try {
        ROOT.dispatchEvent(new CustomEvent('quest:goal-cleared', {
          detail: { count: goalCleared, total: GOAL_TARGET }
        }));
      } catch {}
      coach(`Goal สำเร็จแล้ว ${goalCleared}/${GOAL_TARGET} 🎯`, 3500);
    }

    if (miniCleared > prevMini) {
      try {
        ROOT.dispatchEvent(new CustomEvent('quest:mini-cleared', {
          detail: { count: miniCleared, total: MINI_TARGET }
        }));
      } catch {}
      coach(`Mini quest สำเร็จแล้ว ${miniCleared}/${MINI_TARGET} ⭐`, 3500);
    }

    if (!ended && goalCleared >= GOAL_TARGET && miniCleared >= MINI_TARGET) {
      try {
        ROOT.dispatchEvent(new CustomEvent('quest:all-cleared', {
          detail: { goals: goalCleared, minis: miniCleared }
        }));
      } catch {}
      finish(elapsedSec, 'quests-complete');
    }
  }

  function onSec () {
    if (ended) return;

    elapsedSec++;
    updatePhase();

    const z = zoneFrom(waterPct);

    if (z === 'GREEN') {
      deck.stats.greenTick = (deck.stats.greenTick | 0) + 1;
      decayFever(2);
    } else {
      decayFever(6);
    }

    if (z === 'HIGH')      addWater(-4);
    else if (z === 'LOW')  addWater(+4);
    else                   addWater(-1);

    if (deck && typeof deck.second === 'function') {
      deck.second();
    }
    syncDeck();

    checkQuestCompletion();
    pushHudScore();
  }

  // ======================================================
  //  จบเกม (เรียกเมื่อ sec = 0 หรือเคลียร์ทุกภารกิจ)
  // ======================================================
  function finish (durationSec, reason = 'time-up') {
    if (ended) return;
    ended = true;

    const greenTick    = deck.stats.greenTick | 0;
    const waterEnd     = waterPct;
    const waterZoneEnd = zoneFrom(waterPct);

    const goalsDone = Math.min(goalCleared, GOAL_TARGET);
    const minisDone = Math.min(miniCleared, MINI_TARGET);

    try {
      ROOT.dispatchEvent(new CustomEvent('hha:end', {
        detail: {
          mode: 'Hydration',
          modeLabel: 'Hydration',
          difficulty: diff,
          score,
          misses,
          comboMax,
          duration: durationSec,
          greenTick,
          goalCleared: goalsDone >= GOAL_TARGET,
          goalsCleared: goalsDone,
          goalsTotal: GOAL_TARGET,
          miniCleared: minisDone,
          miniTotal: MINI_TARGET,
          questsCleared: minisDone,
          questsTotal: MINI_TARGET,
          waterStart,
          waterEnd,
          waterZoneEnd,
          endReason: reason
        }
      }));
    } catch {}

    try {
      ROOT.dispatchEvent(new CustomEvent('hydration:celebration-end', {
        detail: {
          score,
          grade: diff.toUpperCase(),
          goalsDone,
          minisDone,
          reason
        }
      }));
    } catch {}

    coach('จบเกมแล้ว! ดูสรุปคะแนนด้านบนได้เลย 🎉', 4000);
    pushHudScore({ ended: true });
  }

  // ======================================================
  //  ฟัง clock กลางจาก mode-factory (hha:time)
  // ======================================================
  const onTime = (e) => {
    const sec = (e.detail && typeof e.detail.sec === 'number')
      ? e.detail.sec
      : (e.detail?.sec | 0);

    if (sec > 0) onSec();
    if (sec === 0) {
      finish(dur, 'time-up');
      ROOT.removeEventListener('hha:time', onTime);
    }
  };
  ROOT.addEventListener('hha:time', onTime);

  // ======================================================
  //  เรียก factoryBoot เพื่อจัดการ spawn / timer / hit detection
  // ======================================================
  const inst = await factoryBoot({
    difficulty: diff,
    duration:   dur,
    modeKey: 'hydration',
    pools: { good: [...GOOD, ...BONUS], bad: [...BAD] },
    goodRate:   0.60,
    powerups:   BONUS,
    powerRate:  0.10,
    powerEvery: 7,
    spawnStyle: 'pop',
    judge: (ch, ctx) => judge(ch, ctx),
    onExpire
  });

  if (inst && typeof inst.stop === 'function') {
    const origStop = inst.stop.bind(inst);
    inst.stop = (...args) => {
      ROOT.removeEventListener('hha:time', onTime);
      return origStop(...args);
    };
  }

  // ---------- เริ่มเกม: ส่งเควสต์ + HUD แรก ----------
  pushQuest('เริ่มโหมดน้ำสมดุล');
  coach('ภารกิจคือรักษาน้ำในร่างกายให้อยู่โซนสีเขียว 💧 เลือกน้ำดี เลี่ยงน้ำหวานนะ');

  pushHudScore();
  return inst;
}

export default { boot };