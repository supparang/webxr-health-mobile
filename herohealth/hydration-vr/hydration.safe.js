// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — น้ำสมดุล + Water Gauge + Fever + Goal / Mini quest
// ใช้ร่วมกับ: mode-factory.js, ui-water.js, hydration.quest.js

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
const GOOD = ['💧', '🥛', '🍉'];                 // น้ำดี
const BAD  = ['🥤', '🧋', '🍺', '☕️'];           // น้ำหวาน / คาเฟอีน
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
  if (dur < 20) dur = 20;
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
      getProgress () { return []; }
    };
  }

  if (!deck.stats) deck.stats = {};
  deck.stats.greenTick = 0;
  deck.stats.zone = waterZone;

  // ---------- นับจำนวนภารกิจตามดีไซน์ต่อเกม ----------
  let goalCleared = 0; // 0–2
  let miniCleared = 0; // 0–3

  // ใช้ track ว่า goal / mini ปัจจุบันคือ id ไหน และนับเคลียร์แล้วหรือยัง
  let currentGoalId = null;
  let currentMiniId = null;
  let currentGoalReported = false;
  let currentMiniReported = false;

  // *** จุดสำคัญ: meta ต้องใช้ชื่อเดียวกับ HUD เดิม ***
  function questMeta () {
    return {
      goalsCleared: goalCleared,
      goalsTarget: GOAL_TARGET,

      // ชื่อที่ HUD ใช้อยู่เดิม (GoodJunk / Plate)
      quests: miniCleared,
      questsTotal: MINI_TARGET,

      // เผื่อใช้ชื่อใหม่ในอนาคต
      questsCleared: miniCleared,
      questsTarget: MINI_TARGET
    };
  }

  // snapshot รวม สำหรับส่งให้ HUD + logic จบเกม
  function getQuestSnapshot () {
    let goalsView = [];
    let minisView = [];

    if (deck && typeof deck.getProgress === 'function') {
      // ใน hydration.quest.js เราใช้ key 'goals' และ 'mini'
      goalsView = deck.getProgress('goals') || [];
      minisView = deck.getProgress('mini')  || [];
    }

    const goalsTotal = GOAL_TARGET;
    const minisTotal = MINI_TARGET;

    // goalsAll / minisAll ใช้แค่เก็บจำนวนและสถานะแต่ละช่องให้ HUD (เหมือน GoodJunk)
    const goalsAll = [];
    for (let i = 0; i < goalsTotal; i++) {
      goalsAll.push({
        index: i + 1,
        done: (i < goalCleared)
      });
    }

    const minisAll = [];
    for (let i = 0; i < minisTotal; i++) {
      minisAll.push({
        index: i + 1,
        done: (i < miniCleared)
      });
    }

    return {
      goals: goalsView,
      minis: minisView,
      goalsAll,
      minisAll,
      goalsDone: goalCleared,
      goalsTotal,
      minisDone: miniCleared,
      minisTotal
    };
  }

  function readQuestStats () {
    const snap = getQuestSnapshot();
    return {
      goalsDone: snap.goalsDone,
      goalsTotal: snap.goalsTotal,
      minisDone: snap.minisDone,
      minisTotal: snap.minisTotal
    };
  }

  // ---------- state หลักของเกม ----------
  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;
  let star = 0;
  let diamond = 0;
  let elapsedSec = 0;
  let ended = false;

  function mult () {
    return feverActive ? 2 : 1;
  }

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
      feverActive = true;
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
    if (feverActive && fever <= 0) feverActive = false;
    if (wasActive && !feverActive) pushFeverEvent('end');
    else pushFeverEvent('change');
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
          modeLabel: 'Hydration Quest',
          difficulty: diff,
          score,
          combo,
          comboMax,
          misses,
          miss: misses,
          timeSec: elapsedSec,
          waterPct,
          waterZone,
          ...questMeta(),
          ...extra
        }
      }));
    } catch {}
  }

  // ---------- ส่งเลขลำดับ + หัวข้อ Goal / Mini ให้ HUD ด้านขวา ----------
  function pushQuest (hint) {
    const snap = getQuestSnapshot();
    const { goals, minis, goalsAll, minisAll, goalsTotal, minisTotal } = snap;

    // ใช้ goal/minis จาก view ปัจจุบัน แต่ index อิงจาก goalCleared / miniCleared
    const rawGoal = (goalCleared < GOAL_TARGET && goals && goals.length)
      ? goals[0]
      : null;
    const rawMini = (miniCleared < MINI_TARGET && minis && minis.length)
      ? minis[0]
      : null;

    const currentGoal = rawGoal || null;
    const currentMini = rawMini || null;

    const goalIndex = currentGoal && goalCleared < GOAL_TARGET
      ? (goalCleared + 1)
      : 0;

    const miniIndex = currentMini && miniCleared < MINI_TARGET
      ? (miniCleared + 1)
      : 0;

    const goalText = currentGoal
      ? (currentGoal.label || currentGoal.title || currentGoal.text || '')
      : '';

    const miniText = currentMini
      ? (currentMini.label || currentMini.title || currentMini.text || '')
      : '';

    const goalHeading = goalIndex
      ? `Goal ${goalIndex}: ${goalText}`
      : '';

    const miniHeading = miniIndex
      ? `Mini: ${miniText}`
      : '';

    try {
      ROOT.dispatchEvent(new CustomEvent('quest:update', {
        detail: {
          goal: currentGoal,
          mini: currentMini,
          goalsAll,
          minisAll,
          goalIndex,
          goalTotal: goalsTotal,
          miniIndex,
          miniTotal: minisTotal,
          goalHeading,
          miniHeading,
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

  function sendJudge (label) {
    try {
      ROOT.dispatchEvent(new CustomEvent('hha:judge', {
        detail: { label }
      }));
    } catch {}
  }

  // ======================================================
  //  ตรวจ Quest / จบเกมเมื่อเคลียร์ครบ
  // ======================================================
  function celebrateSmall (kind, index, total, text) {
    const cx = ROOT.innerWidth ? ROOT.innerWidth / 2 : 320;
    const y  = ROOT.innerHeight ? ROOT.innerHeight * 0.22 : 140;

    try {
      Particles.burstAt(cx, y, {
        color: (kind === 'goal') ? '#22c55e' : '#38bdf8',
        count: 16
      });
      Particles.scorePop(cx, y, 'MISSION CLEAR!', {
        judgment: (kind === 'goal'
          ? `Goal ${index}/${total}`
          : `Mini ${index}/${total}`),
        good: true
      });
    } catch {}

    try {
      ROOT.dispatchEvent(new CustomEvent('hha:coach', {
        detail: {
          text: (kind === 'goal')
            ? `Goal ${index}/${total} สำเร็จแล้ว! ${text || ''} 🎯`
            : `Mini quest ${index}/${total} สำเร็จแล้ว! ${text || ''} ⭐`
        }
      }));
    } catch {}
  }

  function checkQuestCompletion () {
    if (!deck || typeof deck.getProgress !== 'function') {
      pushQuest();
      return;
    }

    const goalsView = deck.getProgress('goals') || [];
    const minisView = deck.getProgress('mini')  || [];

    const g = goalsView[0] || null;
    const m = minisView[0] || null;

    // --- Goal ปัจจุบัน ---
    if (g) {
      const gid = g.id || null;
      if (gid !== currentGoalId) {
        currentGoalId = gid;
        currentGoalReported = false;
      }

      if (g.done && !currentGoalReported && goalCleared < GOAL_TARGET) {
        currentGoalReported = true;
        goalCleared = Math.min(GOAL_TARGET, goalCleared + 1);

        const justIndex = goalCleared;
        const text = g.label || g.title || g.text || '';

        // event ฉลอง goal
        try {
          ROOT.dispatchEvent(new CustomEvent('quest:goal-cleared', {
            detail: {
              index: justIndex,
              total: GOAL_TARGET,
              title: text,
              heading: `Goal ${justIndex}: ${text}`,
              reward: 'shield',
              meta: questMeta()
            }
          }));
        } catch {}

        celebrateSmall('goal', justIndex, GOAL_TARGET, text);

        // ถ้ายังไม่ครบ target ให้สุ่ม goal ใหม่
        if (goalCleared < GOAL_TARGET && typeof deck.nextGoal === 'function') {
          deck.nextGoal();
        }
      }
    }

    // --- Mini ปัจจุบัน ---
    if (m) {
      const mid = m.id || null;
      if (mid !== currentMiniId) {
        currentMiniId = mid;
        currentMiniReported = false;
      }

      if (m.done && !currentMiniReported && miniCleared < MINI_TARGET) {
        currentMiniReported = true;
        miniCleared = Math.min(MINI_TARGET, miniCleared + 1);

        const justIndex = miniCleared;
        const text = m.label || m.title || m.text || '';

        // event ฉลอง mini quest
        try {
          ROOT.dispatchEvent(new CustomEvent('quest:mini-cleared', {
            detail: {
              index: justIndex,
              total: MINI_TARGET,
              title: text,
              heading: `Mini quest ${justIndex}: ${text}`,
              reward: 'star',
              meta: questMeta()
            }
          }));
        } catch {}

        celebrateSmall('mini', justIndex, MINI_TARGET, text);

        if (miniCleared < MINI_TARGET && typeof deck.nextMini === 'function') {
          deck.nextMini();
        }
      }
    }

    // --- ถ้าจบทุก Goal + Mini → ฉลองใหญ่ + จบเกม ---
    if (!ended &&
        goalCleared >= GOAL_TARGET &&
        miniCleared >= MINI_TARGET) {
      const snap = getQuestSnapshot();

      try {
        ROOT.dispatchEvent(new CustomEvent('quest:all-cleared', {
          detail: {
            goals: goalCleared,
            minis: miniCleared,
            goalsTotal: snap.goalsTotal,
            minisTotal: snap.minisTotal,
            meta: questMeta()
          }
        }));
      } catch {}

      coach('สุดยอด! เคลียร์ทุกภารกิจแล้ว 🎉 ฉลองใหญ่แล้วมาดูสรุปคะแนนกัน!', 4000);
      // จบเกมด้วยเหตุผล quests-complete
      finish(elapsedSec, 'quests-complete', snap);
      return;
    }

    // อัปเดต HUD quest ปัจจุบัน
    pushQuest();
  }

  // ======================================================
  //  JUDGE — เรียกจาก mode-factory เมื่อผู้เล่นแตะเป้า
  // ======================================================
  function judge (ch, ctx) {
    if (ended) {
      return { good: false, scoreDelta: 0 };
    }

    const x = ctx?.clientX ?? ctx?.cx ?? 0;
    const y = ctx?.clientY ?? ctx?.cy ?? 0;

    // ----- Power-ups -----
    if (ch === STAR) {
      const d = 40 * mult();
      score += d;
      star++;
      gainFever(10);
      deck.onGood && deck.onGood();
      combo++; comboMax = Math.max(comboMax, combo);
      syncDeck();
      checkQuestCompletion();
      scoreFX(x, y, d, 'GOOD', true);
      sendJudge('GOOD');
      pushHudScore();
      return { good: true, scoreDelta: d };
    }

    if (ch === DIA) {
      const d = 80 * mult();
      score += d;
      diamond++;
      gainFever(30);
      deck.onGood && deck.onGood();
      combo++; comboMax = Math.max(comboMax, combo);
      syncDeck();
      checkQuestCompletion();
      scoreFX(x, y, d, 'PERFECT', true);
      sendJudge('PERFECT');
      pushHudScore();
      return { good: true, scoreDelta: d };
    }

    if (ch === SHIELD) {
      shield = Math.min(3, shield + 1);
      setShield(shield);
      const d = 20;
      score += d;
      deck.onGood && deck.onGood();
      syncDeck();
      checkQuestCompletion();
      scoreFX(x, y, d, 'GOOD', true);
      coach('ได้เกราะกันน้ำหวานแล้วนะ 🛡️ ถ้าเผลอแตะจะไม่ถือว่าพลาดหนึ่งครั้ง', 3500);
      sendJudge('GOOD');
      pushHudScore();
      return { good: true, scoreDelta: d };
    }

    if (ch === FIRE) {
      const wasActive = feverActive;
      feverActive = true;
      fever = Math.max(fever, 60);
      applyFeverUI();
      if (!wasActive) pushFeverEvent('start');
      else pushFeverEvent('change');

      const d = 25;
      score += d;
      deck.onGood && deck.onGood();
      syncDeck();
      checkQuestCompletion();
      scoreFX(x, y, d, 'FEVER', true);
      coach('โหมดไฟ 🔥 เลือกน้ำดีให้ไว แล้วหลบพวกน้ำหวาน!', 3500);
      sendJudge('FEVER');
      pushHudScore();
      return { good: true, scoreDelta: d };
    }

    // ----- ปกติ: น้ำดี / น้ำไม่ดี -----
    if (GOOD.includes(ch)) {
      addWater(+8);
      const d = (14 + combo * 2) * mult();
      score += d;
      combo++;
      comboMax = Math.max(comboMax, combo);

      gainFever(6 + combo * 0.4);
      deck.onGood && deck.onGood();
      syncDeck();
      checkQuestCompletion();

      const label = combo >= 8 ? 'PERFECT' : 'GOOD';
      scoreFX(x, y, d, label, true);
      sendJudge(label);

      if (combo === 1) {
        coach('ดีมาก เริ่มสะสมน้ำดีแล้ว 💧 เลือกพวกน้ำเปล่า นม ผลไม้ต่อเลย');
      } else if (combo === 5) {
        coach('คอมโบ 5 แล้ว เก่งมาก! รักษาจังหวะนี้ไว้นะ 💪', 3500);
      } else if (combo === 10) {
        coach('โหดมาก! คอมโบสิบเลย แทบไม่มีน้ำหวานปนเลย 🎉', 3500);
      }

      pushHudScore();
      return { good: true, scoreDelta: d };
    }

    // ----- น้ำไม่ดี / junk -----
    if (BAD.includes(ch)) {
      if (shield > 0) {
        shield--;
        setShield(shield);
        addWater(-4);
        decayFever(6);
        syncDeck();
        checkQuestCompletion();
        scoreFX(x, y, 0, 'BLOCK', false);
        coach('เกราะช่วยกันน้ำหวานให้แล้วนะ 🛡️ ระวังอย่าเผลอบ่อยเกินไป', 3500);
        sendJudge('BLOCK');
        pushHudScore();
        return { good: false, scoreDelta: 0 };
      }

      addWater(-8);
      const d = -10;
      score = Math.max(0, score + d);
      combo = 0;
      misses++;

      decayFever(14);
      deck.onJunk && deck.onJunk();
      syncDeck();
      checkQuestCompletion();
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

      sendJudge('MISS');
      pushHudScore();
      return { good: false, scoreDelta: d };
    }

    return { good: false, scoreDelta: 0 };
  }

  // ======================================================
  //  เมื่อเป้าหายไปเอง (expire) — ไม่ถือว่า miss
  // ======================================================
  function onExpire (ev) {
    if (ended) return;
    if (ev && ev.isGood === false) {
      deck.onJunk && deck.onJunk();
      syncDeck();
      checkQuestCompletion();
      pushHudScore({ reason: 'expire' });
    }
  }

  // ======================================================
  //  Tick รายวินาที (เรียกจาก hha:time)
  // ======================================================
  function onSec () {
    if (ended) return;

    elapsedSec++;

    const z = zoneFrom(waterPct);

    if (z === 'GREEN') {
      deck.stats.greenTick = (deck.stats.greenTick | 0) + 1;
      decayFever(2);
    } else {
      decayFever(6);
    }

    if (z === 'HIGH') addWater(-4);
    else if (z === 'LOW') addWater(+4);
    else addWater(-1);

    if (deck && typeof deck.second === 'function') {
      deck.second();
    }
    syncDeck();

    checkQuestCompletion();
    pushHudScore();
  }

  // ======================================================
  //  จบเกม
  // ======================================================
  function finish (durationSec, reason = 'time-up', snapOpt) {
    if (ended) return;
    ended = true;

    const snap = snapOpt || getQuestSnapshot();
    const { goalsDone, goalsTotal, minisDone, minisTotal } = snap;

    const goalsOk = Math.min(goalsDone, GOAL_TARGET);
    const minisOk = Math.min(minisDone, MINI_TARGET);

    const greenTick    = deck.stats.greenTick | 0;
    const waterEnd     = waterPct;
    const waterZoneEnd = zoneFrom(waterPct);

    try { ROOT.removeEventListener('hha:time', onTime); } catch {}

    try {
      if (inst && typeof inst.stop === 'function') {
        inst.stop(reason);
      }
    } catch (err) {
      console.warn('[Hydration] inst.stop error', err);
    }

    try {
      ROOT.dispatchEvent(new CustomEvent('hha:end', {
        detail: {
          mode: 'Hydration',
          modeLabel: 'Hydration Quest VR',
          difficulty: diff,
          score,
          misses,
          comboMax,
          duration: durationSec,
          greenTick,
          goalsCleared: goalsOk,
          goalsTarget: goalsTotal,

          // compatibility: ทั้งชื่อเก่าและชื่อใหม่
          quests: minisOk,
          questsTotal: minisTotal,
          questsCleared: minisOk,
          questsTarget: minisTotal,

          goalCleared: goalsOk >= goalsTotal,
          questsClearedAll: minisOk >= minisTotal,

          waterStart,
          waterEnd,
          waterZoneEnd,
          endReason: reason
        }
      }));
    } catch {}

    pushHudScore({
      ended: true,
      ...questMeta()
    });
  }

  const onTime = (e) => {
    const sec = (e.detail && typeof e.detail.sec === 'number')
      ? e.detail.sec
      : (e.detail?.sec | 0);

    if (sec > 0) onSec();
    if (sec === 0 && !ended) {
      finish(dur, 'time-up');
    }
  };
  ROOT.addEventListener('hha:time', onTime);

  // ======================================================
  //  เรียก factoryBoot เพื่อจัดการ spawn / timer / hit detection
  // ======================================================
  const inst = await factoryBoot({
    difficulty: diff,
    duration: dur,
    modeKey: 'hydration',
    pools: { good: [...GOOD, ...BONUS], bad: [...BAD] },
    goodRate: 0.60,
    powerups: BONUS,
    powerRate: 0.10,
    powerEvery: 7,
    spawnStyle: 'pop',
    judge: (ch, ctx) => judge(ch, ctx),
    onExpire
  });

  if (inst && typeof inst.stop === 'function') {
    const origStop = inst.stop.bind(inst);
    inst.stop = (...args) => {
      try { ROOT.removeEventListener('hha:time', onTime); } catch {}
      return origStop(...args);
    };
  }

  // ---------- START ----------
  pushQuest('เริ่มโหมดน้ำสมดุล');
  coach('ภารกิจคือรักษาน้ำในร่างกายให้อยู่โซนสีเขียว 💧 เลือกน้ำดี เลี่ยงน้ำหวานนะ');
  pushHudScore();

  return inst;
}

export default { boot };
