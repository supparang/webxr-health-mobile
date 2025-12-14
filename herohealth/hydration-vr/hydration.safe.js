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
// 1 เกม = 2 Goals + 3 Mini quests
const GOAL_TARGET = 2;
const MINI_TARGET = 3;

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
      getProgress () { return []; },
      nextGoal () {},
      nextMini () {}
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

  // snapshot สำหรับระบบอื่นถ้าจะใช้ (logger / dashboard)
  function getQuestSnapshot () {
    let goalsDone = goalCleared;
    let minisDone = miniCleared;
    let goalsTotal = GOAL_TARGET;
    let minisTotal = MINI_TARGET;

    try {
      if (deck && typeof deck.getProgress === 'function') {
        const g = deck.getProgress('goals') || [];
        const m = deck.getProgress('mini')  || [];
        const gv = Array.isArray(g) ? g[0] : null;
        const mv = Array.isArray(m) ? m[0] : null;

        if (gv && typeof gv.prog === 'number' && typeof gv.target === 'number') {
          // ถ้า summary row
          if (gv.id && String(gv.id).includes('summary')) {
            goalsDone = Math.max(goalsDone, gv.prog | 0);
            goalsTotal = Math.max(goalsTotal, gv.target | 0);
          }
        }
        if (mv && typeof mv.prog === 'number' && typeof mv.target === 'number') {
          if (mv.id && String(mv.id).includes('summary')) {
            minisDone = Math.max(minisDone, mv.prog | 0);
            minisTotal = Math.max(minisTotal, mv.target | 0);
          }
        }
      }
    } catch {}

    return { goalsDone, goalsTotal, minisDone, minisTotal };
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

  // ---------- helper ดู quest ปัจจุบันจาก deck ----------
  function currentQuestView () {
    let goal = null;
    let mini = null;

    if (deck && typeof deck.getProgress === 'function') {
      try {
        const g = deck.getProgress('goals') || [];
        const m = deck.getProgress('mini')  || [];
        goal = g[0] || null;
        mini = m[0] || null;
      } catch (err) {
        console.warn('[Hydration] getProgress error', err);
      }
    }
    return { goal, mini };
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
    const { goal, mini } = currentQuestView();

    const goalIndex = (goal && goalCleared < GOAL_TARGET)
      ? goalCleared + 1
      : 0;

    const miniIndex = (mini && miniCleared < MINI_TARGET)
      ? miniCleared + 1
      : 0;

    const goalHeading = goalIndex
      ? `Goal ${goalIndex}: ${goal.label || goal.title || goal.text || ''}`
      : (goalCleared >= GOAL_TARGET ? 'Goal: สำเร็จครบแล้ว 🎉' : '');

    const miniHeading = miniIndex
      ? `Mini quest ${miniIndex}: ${mini.label || mini.title || mini.text || ''}`
      : (miniCleared >= MINI_TARGET ? 'Mini quest: สำเร็จครบแล้ว 🎉' : '');

    try {
      ROOT.dispatchEvent(new CustomEvent('quest:update', {
        detail: {
          goal,
          mini,
          goalsAll: null,
          minisAll: null,
          goalIndex,
          goalTotal: GOAL_TARGET,
          miniIndex,
          miniTotal: MINI_TARGET,
          goalHeading,
          miniHeading,
          hint: hint || '',
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
      if (!wasActive) pushFeverEvent('start');
      else pushFeverEvent('change');

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
  //  ตรวจ Quest / จบเกมเมื่อเคลียร์ครบ
  // ======================================================
  function checkQuestCompletion () {
    const { goal, mini } = currentQuestView();

    // ---- Goal ปัจจุบันเพิ่งสำเร็จ ----
    if (goal && goal.done && goalCleared < GOAL_TARGET) {
      const justIndex = goalCleared + 1;
      goalCleared = justIndex;

      const text = goal.label || goal.title || goal.text || '';

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

      coach(`Goal ${justIndex}/${GOAL_TARGET} สำเร็จแล้ว! ${text || ''} 🎯`, 3500);

      // ถ้ายังไม่ครบ 2 goal → ขอ goal ใหม่จาก deck
      if (goalCleared < GOAL_TARGET && deck && typeof deck.nextGoal === 'function') {
        try { deck.nextGoal(); } catch {}
      }
    }

    // ---- Mini quest ปัจจุบันเพิ่งสำเร็จ ----
    if (mini && mini.done && miniCleared < MINI_TARGET) {
      const justIndex = miniCleared + 1;
      miniCleared = justIndex;

      const text = mini.label || mini.title || mini.text || '';

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

      coach(`Mini quest ${justIndex}/${MINI_TARGET} สำเร็จแล้ว! ${text || ''} ⭐`, 3500);

      if (miniCleared < MINI_TARGET && deck && typeof deck.nextMini === 'function') {
        try { deck.nextMini(); } catch {}
      }
    }

    // ---- ทุกภารกิจครบ → ฉลองใหญ่ + จบเกม ----
    if (!ended &&
        goalCleared >= GOAL_TARGET &&
        miniCleared >= MINI_TARGET) {

      try {
        ROOT.dispatchEvent(new CustomEvent('quest:all-cleared', {
          detail: {
            goals: goalCleared,
            minis: miniCleared,
            goalsTotal: GOAL_TARGET,
            minisTotal: MINI_TARGET,
            meta: questMeta()
          }
        }));
      } catch {}

      coach('สุดยอด! เคลียร์ทุกภารกิจแล้ว 🎉 ฉลองใหญ่แล้วมาดูสรุปคะแนนกัน!', 4000);
      finish(elapsedSec, 'quests-complete');
      return;
    }

    // ยังไม่ครบทั้งหมด → แค่ refresh HUD
    pushQuest();
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
  function finish (durationSec, reason = 'time-up') {
    if (ended) return;
    ended = true;

    const goalsOk = Math.min(goalCleared, GOAL_TARGET);
    const minisOk = Math.min(miniCleared, MINI_TARGET);

    const greenTick    = deck.stats ? (deck.stats.greenTick | 0) : 0;
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
          goalsTotal: GOAL_TARGET,
          quests: minisOk,
          questsTotal: MINI_TARGET,
          goalCleared: goalsOk >= GOAL_TARGET,
          miniCleared: minisOk >= MINI_TARGET,
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
      goalsTarget: GOAL_TARGET,
      minisCleared: minisOk,
      minisTarget: MINI_TARGET
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
