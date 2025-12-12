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

// ---------- Quest targets ดีไซน์หลักต่อเกม ----------
const GOAL_TARGET_DEFAULT = 2;   // ภารกิจหลัก 2 อันต่อเกม
const MINI_TARGET_DEFAULT = 3;   // mini quest 3 อันต่อเกม

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

// ---------- Celebration helper ----------
function celebrate (type, extra = {}) {
  try {
    ROOT.dispatchEvent(new CustomEvent('hha:celebrate', {
      detail: { type, ...extra } // 'goal' | 'mini' | 'all'
    }));
  } catch {}
}

// ---------- เลือก factory createHydrationQuest ----------
function getCreateHydrationQuest () {
  if (typeof HQ.createHydrationQuest === 'function') return HQ.createHydrationQuest;
  if (HQ.default) {
    if (typeof HQ.default.createHydrationQuest === 'function') return HQ.default.createHydrationQuest;
    if (typeof HQ.default === 'function') return HQ.default;
  }
  throw new Error('createHydrationQuest not found in hydration.quest.js');
}

// ---------- Emoji pools ----------
const GOOD = ['💧', '🥛', '🍉'];          // น้ำดี
const BAD  = ['🥤', '🧋', '🍺', '☕️'];    // น้ำหวาน / คาเฟอีน ฯลฯ

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
    deck = factory(diff);
  } catch (err) {
    console.error('[Hydration] createHydrationQuest error', err);
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

  // ---------- นับภารกิจ (source of truth ที่ HUD ใช้) ----------
  let goalCleared = 0;
  let miniCleared = 0;
  let goalTotal   = GOAL_TARGET_DEFAULT;
  let miniTotal   = MINI_TARGET_DEFAULT;

  // อ่าน progress จาก deck ถ้ามีให้ใช้ช่วย update ค่า แต่ *ไม่* เอามาเขียนทับตอนสรุป
  function computeQuestCounts () {
    if (!deck || typeof deck.getProgress !== 'function') {
      return {
        goalsDone: goalCleared,
        goalsTotal: goalTotal,
        minisDone: miniCleared,
        minisTotal: miniTotal,
        goals: [],
        minis: []
      };
    }
    const goals = deck.getProgress('goals') || [];
    const minis = deck.getProgress('mini')  || [];

    const goalsDone = goals.filter(g => g && g.done).length;
    const minisDone = minis.filter(m => m && m.done).length;

    // ถ้า deck รายงานจำนวนทั้งหมด → ใช้แทน default
    const goalsTotal = goals.length || goalTotal;
    const minisTotal = minis.length || miniTotal;

    return { goalsDone, goalsTotal, minisDone, minisTotal, goals, minis };
  }

  function questMeta () {
    return {
      goalsCleared: goalCleared,
      goalsTarget:  goalTotal,
      minisCleared: miniCleared,
      minisTarget:  miniTotal
    };
  }

  // ---------- state หลัก ----------
  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;
  let star = 0;
  let diamond = 0;
  let elapsedSec = 0;
  let ended = false;
  let inst = null;     // instance จาก mode-factory

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

  function pushQuest (hint) {
    const info  = computeQuestCounts();
    const goals = info.goals;
    const minis = info.minis;

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

  function sendJudge (label) {
    try {
      ROOT.dispatchEvent(new CustomEvent('hha:judge', { detail: { label } }));
    } catch {}
  }

  // ======================================================
  //  เช็คจำนวนภารกิจที่ทำสำเร็จ
  // ======================================================
  function checkQuestCompletion () {
    const info = computeQuestCounts();
    const prevGoal = goalCleared;
    const prevMini = miniCleared;

    goalCleared = info.goalsDone;
    miniCleared = info.minisDone;
    goalTotal   = info.goalsTotal;
    miniTotal   = info.minisTotal;

    // เคลียร์ goal ใหม่
    if (goalCleared > prevGoal) {
      try {
        ROOT.dispatchEvent(new CustomEvent('quest:goal-cleared', {
          detail: { count: goalCleared, total: goalTotal }
        }));
      } catch {}
      celebrate('goal', { count: goalCleared, total: goalTotal });
      coach(`Goal สำเร็จแล้ว ${goalCleared}/${goalTotal} 🎯`, 3500);
    }

    // เคลียร์ mini quest ใหม่
    if (miniCleared > prevMini) {
      try {
        ROOT.dispatchEvent(new CustomEvent('quest:mini-cleared', {
          detail: { count: miniCleared, total: miniTotal }
        }));
      } catch {}
      celebrate('mini', { count: miniCleared, total: miniTotal });
      coach(`Mini quest สำเร็จแล้ว ${miniCleared}/${miniTotal} ⭐`, 3500);
    }

    // ครบทุกภารกิจ → ฉลองใหญ่ + จบเกม
    if (!ended && goalCleared >= goalTotal && miniCleared >= miniTotal) {
      celebrate('all', questMeta());
      try {
        ROOT.dispatchEvent(new CustomEvent('quest:all-cleared', {
          detail: { goals: goalCleared, minis: miniCleared }
        }));
      } catch {}
      coach('สุดยอด! ทำครบทุกภารกิจเรื่องน้ำสมดุลแล้ว 🎉', 3500);
      finish(elapsedSec, 'quests-complete');
    }
  }

  // ======================================================
  //  JUDGE — เรียกจาก mode-factory เมื่อผู้เล่นแตะเป้า
  // ======================================================
  function judge (ch, ctx) {
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
      pushQuest();
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
      pushQuest();
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
      pushQuest();
      scoreFX(x, y, d, 'GOOD', true);
      coach('ได้เกราะกันน้ำหวานแล้ว 🛡️ ถ้าเผลอแตะจะไม่ถือว่าพลาดหนึ่งครั้ง', 3500);
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
      syncDeck();
      checkQuestCompletion();
      pushQuest();
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
      pushQuest();

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
        // BLOCK
        shield--;
        setShield(shield);
        addWater(-4);
        decayFever(6);
        deck.onGood && deck.onGood();
        syncDeck();
        checkQuestCompletion();
        pushQuest();
        scoreFX(x, y, 0, 'BLOCK', false);
        coach('เกราะช่วยกันน้ำหวานให้แล้วนะ 🛡️ ระวังอย่าเผลอบ่อยเกินไป', 3500);
        sendJudge('BLOCK');
        pushHudScore();
        return { good: false, scoreDelta: 0 };
      }

      // MISS จริง
      addWater(-8);
      const d = -10;
      score = Math.max(0, score + d);
      combo = 0;
      misses++;

      decayFever(14);
      deck.onJunk && deck.onJunk();
      syncDeck();
      checkQuestCompletion();
      pushQuest();
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
    if (ev && ev.isGood === false) {
      deck.onJunk && deck.onJunk();
      syncDeck();
      checkQuestCompletion();
      pushQuest();
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

    if (deck && typeof deck.second === 'function') deck.second();
    syncDeck();

    checkQuestCompletion();
    pushHudScore();
  }

  // ======================================================
  //  จบเกม (ทั้งจากเวลาและเคลียร์ภารกิจ)
  // ======================================================
  function finish (durationSec, reason = 'time-up') {
    if (ended) return;
    ended = true;

    const greenTick     = deck.stats.greenTick | 0;
    const waterEnd      = waterPct;
    const waterZoneEnd  = zoneFrom(waterPct);

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

          // ใช้ค่าที่นับระหว่างเกม (ตรงกับ HUD)
          goalCleared: goalCleared >= goalTotal,
          goalsCleared: goalCleared,
          goalsTotal: goalTotal,

          miniCleared: miniCleared,
          miniTotal: miniTotal,
          questsCleared: miniCleared,
          questsTotal: miniTotal,

          waterStart,
          waterEnd,
          waterZoneEnd,
          endReason: reason
        }
      }));
    } catch {}

    // แจ้งหยุดให้ทุกระบบรู้
    try {
      ROOT.dispatchEvent(new CustomEvent('hha:stop', {
        detail: { reason }
      }));
    } catch {}

    ROOT.removeEventListener('hha:time', onTime);

    if (inst && typeof inst.stop === 'function') {
      try { inst.stop(); } catch {}
    }

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
      checkQuestCompletion();
      finish(dur, 'time-up');
    }
  };
  ROOT.addEventListener('hha:time', onTime);

  // ======================================================
  //  เรียก factoryBoot เพื่อจัดการ spawn / timer / hit detection
  // ======================================================
  inst = await factoryBoot({
    difficulty: diff,
    duration: dur,
    modeKey: 'hydration',

    pools: { good: [...GOOD, ...BONUS], bad: [...BAD] },
    goodRate: 0.60,
    powerups: BONUS,
    powerRate: 0.10,
    powerEvery: 7,
    spawnStyle: 'pop',      // เป้าโผล่แล้วหายเอง
    judge: (ch, ctx) => judge(ch, ctx),
    onExpire
  });

  // cleanup เพิ่มใน stop() เผื่อผู้เล่นออกกลางคันเอง
  if (inst && typeof inst.stop === 'function') {
    const origStop = inst.stop.bind(inst);
    inst.stop = (...args) => {
      ROOT.removeEventListener('hha:time', onTime);
      return origStop(...args);
    };
  }

  // ---------- เริ่มเกม: ส่งเควสต์ + HUD แรก ----------
  checkQuestCompletion();  // sync ค่าเริ่มจากเด็ค (ถ้ามี)
  pushQuest('เริ่มโหมดน้ำสมดุล');
  coach('ภารกิจคือรักษาน้ำในร่างกายให้อยู่โซนสีเขียว 💧 เลือกน้ำดี เลี่ยงน้ำหวานนะ');
  pushHudScore();

  return inst;
}

export default { boot };