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

  // snapshot รวม goals / minis + จำนวนที่ทำเสร็จ
  function getQuestSnapshot () {
    if (!deck || typeof deck.getProgress !== 'function') {
      return {
        goals: [],
        minis: [],
        goalsDone: goalCleared,
        goalsTotal: GOAL_TARGET,
        minisDone: miniCleared,
        minisTotal: MINI_TARGET
      };
    }

    const goals = deck.getProgress('goals') || [];
    const minis = deck.getProgress('mini') || [];

    const goalsDone = goals.filter(g => g && g.done).length;
    const minisDone = minis.filter(m => m && m.done).length;

    const goalsTotal = goals.length || GOAL_TARGET;
    const minisTotal = minis.length || MINI_TARGET;

    return { goals, minis, goalsDone, goalsTotal, minisDone, minisTotal };
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
        detail: {
          state,
          fever,
          active: feverActive
        }
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
    if (feverActive && fever <= 0) {
      feverActive = false;
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
          ...questMeta(),
          ...extra
        }
      }));
    } catch {}
  }

  // ---------- NEW: ส่งเลขลำดับ + หัวข้อ Goal / Mini ให้ HUD ----------
  function pushQuest (hint) {
    const snap = getQuestSnapshot();
    const { goals, minis, goalsTotal, minisTotal } = snap;

    const currentGoal = goals.find(g => !g.done) || goals[0] || null;
    const currentMini = minis.find(m => !m.done) || minis[0] || null;

    let goalIndex = 0;
    if (currentGoal) {
      const idx = goals.indexOf(currentGoal);
      goalIndex = (idx >= 0 ? idx + 1 : 0);
    }

    let miniIndex = 0;
    if (currentMini) {
      const idx = minis.indexOf(currentMini);
      miniIndex = (idx >= 0 ? idx + 1 : 0);
    }

    const goalText = currentGoal
      ? (currentGoal.title || currentGoal.label || currentGoal.text || '')
      : '';

    const miniText = currentMini
      ? (currentMini.title || currentMini.label || currentMini.text || '')
      : '';

    const goalHeading = goalIndex
      ? `Goal ${goalIndex}: ${goalText}`
      : '';

    const miniHeading = miniIndex
      ? `Mini quest ${miniIndex}: ${miniText}`
      : '';

    try {
      ROOT.dispatchEvent(new CustomEvent('quest:update', {
        detail: {
          goal: currentGoal,
          mini: currentMini,
          goalsAll: goals,
          minisAll: minis,

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
      syncDeck(); pushQuest();
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
      syncDeck(); pushQuest();
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
      syncDeck(); pushQuest();
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
      if (!wasActive) {
        pushFeverEvent('start');
      } else {
        pushFeverEvent('change');
      }

      const d = 25;
      score += d;
      deck.onGood && deck.onGood();
      syncDeck(); pushQuest();
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
      syncDeck(); pushQuest();

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
        syncDeck(); pushQuest();
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
      syncDeck(); pushQuest();
      pushHudScore({ reason: 'expire' });
    }
  }

  // ======================================================
  //  Tick รายวินาที (เรียกจาก hha:time)
  // ======================================================
  function checkQuestCompletion () {
    const snap = getQuestSnapshot();
    const { goals, minis, goalsDone, goalsTotal, minisDone, minisTotal } = snap;

    const prevGoal = goalCleared;
    const prevMini = miniCleared;

    goalCleared = Math.min(GOAL_TARGET, goalsDone);
    miniCleared = Math.min(MINI_TARGET, minisDone);

    // ----- เพิ่งจบ Goal ใหม่ -----
    if (goalCleared > prevGoal) {
      const justIndex = goalCleared;  // 1-based
      const g = goals[justIndex - 1] || null;
      const text = g
        ? (g.title || g.label || g.text || '')
        : '';

      // event ฉลอง Goal
      try {
        ROOT.dispatchEvent(new CustomEvent('quest:goal-cleared', {
          detail: {
            index: justIndex,
            total: goalsTotal,
            title: text,
            heading: `Goal ${justIndex}: ${text}`,
            reward: 'shield',
            meta: questMeta()
          }
        }));
      } catch {}

      coach(`Goal ${justIndex}/${goalsTotal} สำเร็จแล้ว! ${text || ''} 🎯`, 3500);
    }

    // ----- เพิ่งจบ Mini quest ใหม่ -----
    if (miniCleared > prevMini) {
      const justIndex = miniCleared;
      const m = minis[justIndex - 1] || null;
      const text = m
        ? (m.title || m.label || m.text || '')
        : '';

      try {
        ROOT.dispatchEvent(new CustomEvent('quest:mini-cleared', {
          detail: {
            index: justIndex,
            total: minisTotal,
            title: text,
            heading: `Mini quest ${justIndex}: ${text}`,
            reward: 'star',
            meta: questMeta()
          }
        }));
      } catch {}

      coach(`Mini quest ${justIndex}/${minisTotal} สำเร็จแล้ว! ${text || ''} ⭐`, 3500);
    }

    // ----- ถ้าจบทุก Goal + Mini → ฉลองใหญ่ + จบเกม -----
    if (!ended &&
        goalCleared >= GOAL_TARGET &&
        miniCleared >= MINI_TARGET) {
      try {
        ROOT.dispatchEvent(new CustomEvent('quest:all-cleared', {
          detail: {
            goals: goalCleared,
            minis: miniCleared,
            goalsTotal,
            minisTotal,
            meta: questMeta()
          }
        }));
      } catch {}

      coach('สุดยอด! เคลียร์ทุกภารกิจแล้ว 🎉 ฉลองใหญ่แล้วมาดูสรุปคะแนนกัน!', 4000);
      finish(elapsedSec, 'quests-complete', snap);
    } else {
      // ยังไม่จบทั้งหมด → ส่ง quest:update เพื่อบอก Goal / Mini ถัดไป
      pushQuest();
    }
  }

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
    const {
      goalsDone,
      goalsTotal,
      minisDone,
      minisTotal
    } = {
      goalsDone: snap.goalsDone,
      goalsTotal: snap.goalsTotal,
      minisDone: snap.minisDone,
      minisTotal: snap.minisTotal
    };

    const goalsOk  = Math.min(goalsDone, GOAL_TARGET);
    const minisOk  = Math.min(minisDone, MINI_TARGET);

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
          modeLabel: 'Hydration',
          difficulty: diff,
          score,
          misses,
          comboMax,
          duration: durationSec,
          greenTick,
          goals: goalsOk,
          goalsTotal,
          quests: minisOk,
          questsTotal: minisTotal,
          goalCleared: goalsOk >= goalsTotal,
          miniCleared: minisOk >= minisTotal,
          waterStart,
          waterEnd,
          waterZoneEnd,
          endReason: reason
        }
      }));
    } catch {}

    pushHudScore({
      ended: true,
      goalsCleared: goalsOk,
      goalsTarget: goalsTotal,
      minisCleared: minisOk,
      minisTarget: minisTotal
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
// ==== STATE หลักสำหรับ Hydration Quest VR ====

let score = 0;
let combo = 0;         // คอมโบปัจจุบัน
let bestCombo = 0;     // คอมโบสูงสุดในเกม
let missCount = 0;     // จำนวน miss

let elapsedSec = 0;
let ended = false;     // true = เกมจบแล้ว (ไม่ควรให้เป้าเล่นต่อ)

let questDeck = null;  // เซ็ตจาก hydration.quest.js

// ตัวนับ Goal / Mini quest
let goalsTotal = 0;
let minisTotal = 0;
let goalCleared = 0;
let miniCleared = 0;

// ==== Helper พื้นฐาน ====

function mult () {
  // ถ้าต้องการตัวคูณตามระดับความยากให้ปรับตรงนี้
  // ตัวอย่าง:
  //   easy   = 1.0
  //   normal = 1.2
  //   hard   = 1.5
  switch ((window.HH_DIFF || 'easy').toLowerCase()) {
    case 'normal': return 1.2;
    case 'hard':   return 1.5;
    default:       return 1.0;
  }
}

// เรียกตอนเริ่มเกมจาก boot เดิมของคุณ
export function setHydrationQuestDeck (deck) {
  questDeck = deck || null;

  const snap = getQuestSnapshot();

  goalsTotal   = snap.goalsTotal;
  minisTotal   = snap.minisTotal;
  goalCleared  = snap.goalsDone;
  miniCleared  = snap.minisDone;

  pushQuest();     // อัปเดต HUD ด้านขวา
  pushHudScore();  // อัปเดตคะแนน / คอมโบ / miss
}

// ==== ใช้ snapshot จาก deck เป็น “ความจริงหนึ่งเดียว” ====

function getQuestSnapshot () {
  const goals = (questDeck && questDeck.goals) || [];
  const minis = (questDeck && questDeck.minis) || [];

  const goalsDone = goals.filter(g => g && g.done).length;
  const minisDone = minis.filter(m => m && m.done).length;

  return {
    goals,
    minis,
    goalsDone,
    goalsTotal: goals.length,
    minisDone,
    minisTotal: minis.length
  };
}

function questMeta () {
  const snap = getQuestSnapshot();
  return {
    goalsCleared: snap.goalsDone,
    goalsTotal:   snap.goalsTotal,
    minisCleared: snap.minisDone,
    minisTotal:   snap.minisTotal,
    miss: missCount,
    bestCombo
  };
}

// ==== ฟังก์ชันให้ GameEngine เรียกเมื่อโดนเป้า / โดนขยะ ====

/**
 * onHydrationHit:
 *  - good target → combo +1, คำนวณคะแนน, อัปเดต HUD
 *  - bad / junk  → นับ miss +1, combo = 0
 *  - ไม่รีเซ็ตความคืบหน้า Goal / Mini quest
 */
export function onHydrationHit (hit) {
  if (ended) return;

  const isGood = !!hit.good;  // GameEngine ต้องส่ง field นี้มา

  if (isGood) {
    combo += 1;
    if (combo > bestCombo) bestCombo = combo;

    const base  = typeof hit.score === 'number' ? hit.score : 10;
    const gain  = Math.round(base * mult());
    score      += gain;

    dispatchJudgmentFx(hit, gain, combo, hit.judgment || 'good');
  } else {
    // ตีโดนขยะ = miss
    missCount += 1;
    combo = 0;
    dispatchJudgmentFx(hit, 0, combo, 'miss');
  }

  pushHudScore();
  checkQuestCompletion();
}

/**
 * onHydrationMiss:
 *  - เรียกเมื่อเป้าหายไปโดยไม่ได้คลิกทัน
 *  - นับ miss +1, combo = 0
 */
export function onHydrationMiss (info) {
  if (ended) return;

  missCount += 1;
  combo = 0;

  dispatchJudgmentFx(info || {}, 0, combo, 'miss');
  pushHudScore();
  checkQuestCompletion();
}

// ==== เอฟเฟกต์คำตัดสิน / คะแนนเด้ง ====

function dispatchJudgmentFx (info, scoreDelta, comboNow, judgment) {
  try {
    window.dispatchEvent(new CustomEvent('hydration:judgment', {
      detail: {
        x: info && info.x,
        y: info && info.y,
        scoreDelta,
        combo: comboNow,
        judgment,        // 'perfect' | 'good' | 'miss'
        raw: info
      }
    }));
  } catch (e) {
    // เงียบไป ไม่ให้เกมค้าง
  }
}

// ==== ตรวจภารกิจ + ฉลองแต่ละ Goal / Mini + จบเกมเมื่อครบทั้งหมด ====

function checkQuestCompletion () {
  const snap = getQuestSnapshot();
  const {
    goals,
    minis,
    goalsDone,
    goalsTotal: deckGoalTotal,
    minisDone,
    minisTotal: deckMiniTotal
  } = snap;

  const prevGoal = goalCleared;
  const prevMini = miniCleared;

  // sync ค่า state ให้ตรงกับ deck เสมอ
  goalsTotal   = deckGoalTotal;
  minisTotal   = deckMiniTotal;
  goalCleared  = goalsDone;
  miniCleared  = minisDone;

  // ---------- เพิ่งเคลียร์ Goal ใหม่ ----------
  if (goalCleared > prevGoal) {
    const justIndex = goalCleared;          // 1-based
    const g = goals[justIndex - 1] || null;
    const text = g ? (g.title || g.label || g.text || '') : '';

    const rewardScore = Math.round(200 * mult());
    score += rewardScore;

    try {
      window.dispatchEvent(new CustomEvent('quest:goal-cleared', {
        detail: {
          index: justIndex,
          countNow: goalCleared,
          countMax: goalsTotal || 1,
          scoreDelta: rewardScore,
          title: text,
          heading: `Goal ${justIndex}/${goalsTotal || 1}`,
          reward: 'shield',
          meta: questMeta()
        }
      }));
    } catch (e) {}

    coach(
      `Goal ${justIndex}/${goalsTotal || 1} สำเร็จแล้ว! ${text || ''} 🎯`,
      3500
    );
    pushHudScore();
  }

  // ---------- เพิ่งเคลียร์ Mini quest ใหม่ ----------
  if (miniCleared > prevMini) {
    const justIndex = miniCleared;
    const m = minis[justIndex - 1] || null;
    const text = m ? (m.title || m.label || m.text || '') : '';

    const rewardScore = Math.round(120 * mult());
    score += rewardScore;

    try {
      window.dispatchEvent(new CustomEvent('quest:mini-cleared', {
        detail: {
          index: justIndex,
          countNow: miniCleared,
          countMax: minisTotal || 1,
          scoreDelta: rewardScore,
          title: text,
          heading: `Mini quest ${justIndex}/${minisTotal || 1}`,
          reward: 'star',
          meta: questMeta()
        }
      }));
    } catch (e) {}

    coach(
      `Mini quest ${justIndex}/${minisTotal || 1} สำเร็จแล้ว! ${text || ''} ⭐`,
      3500
    );
    pushHudScore();
  }

  // ---------- เคลียร์ครบทุก Goal + Mini ----------
  const allGoalsDone = goalsTotal > 0 && goalCleared >= goalsTotal;
  const allMinisDone = minisTotal > 0 && miniCleared >= minisTotal;

  if (!ended && allGoalsDone && allMinisDone) {
    ended = true;

    try {
      window.dispatchEvent(new CustomEvent('quest:all-cleared', {
        detail: questMeta()
      }));
    } catch (e) {}

    coach('สุดยอดเลย! เคลียร์ทุกภารกิจแล้ว 🎉🔥 เกมจบแล้ว มาดูสรุปกัน!', 4200);

    // ส่งสัญญาณให้ engine หยุด spawn เป้า (ถ้า GameEngine ฟัง event นี้อยู่)
    try {
      window.dispatchEvent(new CustomEvent('hydration:stop-play'));
    } catch (e) {}

    finish(elapsedSec, 'quests-complete');
  } else {
    // ยังไม่ครบ → แค่ sync HUD ด้านขวา
    pushQuest();
  }
}

// ==== Tick จาก game loop ====

export function onHydrationTick (sec) {
  elapsedSec = sec;
}

// ==== Summary + จบเกม ====

function buildSummary (reason) {
  const snap = getQuestSnapshot(); // ใช้ snapshot ล่าสุดเป็นความจริง

  const modeLabel = (window.HH_MODE || 'Play')
    .replace(/^./, c => c.toUpperCase());

  return {
    mode: modeLabel,
    grade: calcGrade(score, missCount),
    totalScore: score,
    bestCombo,
    miss: missCount,
    goalsCleared: snap.goalsDone,
    goalsTotal:   snap.goalsTotal,
    minisCleared: snap.minisDone,
    minisTotal:   snap.minisTotal,
    reason,
    meta: questMeta()
  };
}

/**
 * finish:
 *  - reason: 'timeup' | 'quit' | 'quests-complete'
 *  - ถูกเรียกจาก
 *      1) เราเอง (ตอนเคลียร์ทุกภารกิจ)
 *      2) GameEngine (ตอนหมดเวลา / กดออก)
 */
export function finish (sec, reason) {
  if (ended && reason !== 'quests-complete') {
    // ถ้าเกมถูกจบด้วย “เคลียร์ทุกภารกิจแล้ว” ไปแล้ว
    // ไม่ต้องจบซ้ำอีก
    return;
  }
  ended = true;

  const summary = buildSummary(reason || 'timeup');

  // แจ้งให้ engine / ส่วนอื่นรู้ว่าเกมจบจริง ๆ แล้ว
  try {
    window.dispatchEvent(new CustomEvent('hydration:finish', {
      detail: summary
    }));
  } catch (e) {}

  showResultModal(summary);
}

// ==== HUD helper (คะแนน / combo / miss / quest panel) ====

function pushHudScore () {
  const elScore = document.querySelector('[data-hh-score]');
  const elCombo = document.querySelector('[data-hh-best-combo]');
  const elMiss  = document.querySelector('[data-hh-miss]');

  if (elScore) elScore.textContent = String(score);
  if (elCombo) elCombo.textContent = String(bestCombo);
  if (elMiss)  elMiss.textContent  = String(missCount);
}

function pushQuest () {
  const snap = getQuestSnapshot();

  const elGoal = document.querySelector('[data-hh-quest-goal]');
  const elMini = document.querySelector('[data-hh-quest-mini]');

  if (elGoal) {
    elGoal.textContent =
      `Goal: สำเร็จแล้ว (${snap.goalsDone}/${snap.goalsTotal || 1}) 🎯`;
  }
  if (elMini) {
    elMini.textContent =
      `Mini quest: สำเร็จแล้ว (${snap.minisDone}/${snap.minisTotal || 1}) 🎉`;
  }
}

// ==== โค้ชพูด + popup สรุป (ใช้โครงของเดิม) ====

function coach (text, ms = 2600) {
  const bubble = document.querySelector('[data-hh-coach]');
  if (!bubble) return;

  bubble.textContent = text;
  bubble.classList.add('is-show');

  window.clearTimeout(coach._timer);
  coach._timer = window.setTimeout(() => {
    bubble.classList.remove('is-show');
  }, ms);
}

// ฟังก์ชัน calcGrade(score, miss) & showResultModal(summary)
// ให้ใช้เวอร์ชันเดิมที่คุณมีอยู่ด้านบนไฟล์

export default { boot };
