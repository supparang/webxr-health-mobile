// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — น้ำสมดุล + Water Gauge + Fever + Goal / Mini quest
// ใช้ร่วมกับ: mode-factory.js, ui-water.js, hydration.quest.js, hydration.state.js

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
  const diff = (['easy', 'normal', 'hard'].includes(diffRaw)) ? diffRaw : 'normal';

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
      getMiniNoJunkProgress () { return { now: 0, target: 0 }; }
    };
  }

  if (!deck.stats) deck.stats = {};
  deck.stats.greenTick = 0;
  deck.stats.zone = waterZone;

  // ---------- นับจำนวนภารกิจตามดีไซน์ต่อเกม ----------
  let goalCleared = 0;
  let miniCleared = 0;

  function questMeta () {
    return {
      goalsCleared: goalCleared,
      goalsTarget: GOAL_TARGET,

      quests: miniCleared,
      questsTotal: MINI_TARGET,

      questsCleared: miniCleared,
      questsTarget: MINI_TARGET
    };
  }

  function getQuestSnapshot () {
    if (!deck || typeof deck.getProgress !== 'function') {
      return {
        goalsView: [],
        minisView: [],
        goalsAll: [],
        minisAll: [],
        goalsDone: goalCleared,
        goalsTotal: GOAL_TARGET,
        minisDone: miniCleared,
        minisTotal: MINI_TARGET
      };
    }

    const goalsView = deck.getProgress('goals') || deck.goals || [];
    const minisView = deck.getProgress('mini')  || deck.minis || [];

    const goalsAll = goalsView._all || goalsView;
    const minisAll = minisView._all || minisView;

    const goalsDone = goalsAll.filter(g => g && (g._done || g.done)).length;
    const minisDone = minisAll.filter(m => m && (m._done || m.done)).length;

    const goalsTotal = goalsAll.length || GOAL_TARGET;
    const minisTotal = minisAll.length || MINI_TARGET;

    return {
      goalsView,
      minisView,
      goalsAll,
      minisAll,
      goalsDone,
      goalsTotal,
      minisDone,
      minisTotal
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

  let inClutch = false;

  function mult () {
    let m = feverActive ? 2 : 1;
    if (inClutch) m += 0.5;
    return m;
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
    if (inClutch) n *= 1.2;

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
    if (inClutch) n *= 1.15;

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

  // ---------- ส่งหัวข้อ Goal / Mini ให้ HUD ----------
  function pushQuest (hint) {
    const snap = getQuestSnapshot();
    const {
      goalsView, minisView,
      goalsAll, minisAll,
      goalsTotal, minisTotal
    } = snap;

    const viewGoal = goalsView[0] || null;
    const viewMini = minisView[0] || null;

    const currentGoal = viewGoal;
    const currentMini = viewMini;

    let goalIndex = 0;
    if (currentGoal && goalsAll && goalsAll.length) {
      const idx = goalsAll.findIndex(g => g && g.id === currentGoal.id);
      goalIndex = idx >= 0 ? (idx + 1) : 0;
    }

    let miniIndex = 0;
    if (currentMini && minisAll && minisAll.length) {
      const idx = minisAll.findIndex(m => m && m.id === currentMini.id);
      miniIndex = idx >= 0 ? (idx + 1) : 0;
    }

    const goalText = currentGoal
      ? (currentGoal.label || currentGoal.title || currentGoal.text || '')
      : '';

    const miniText = currentMini
      ? (currentMini.label || currentMini.title || currentMini.text || '')
      : '';

    const goalHeading = goalIndex
      ? `Goal ${goalIndex}: ${goalText}`
      : (goalsTotal > 0 && goalCleared >= goalsTotal
          ? `Goal: สำเร็จครบแล้ว (${goalCleared}/${goalsTotal}) 🎉`
          : '');

    const miniHeading = miniIndex
      ? `Mini: ${miniText}`
      : (minisTotal > 0 && miniCleared >= minisTotal
          ? `Mini quest: สำเร็จครบแล้ว (${miniCleared}/${minisTotal}) 🎉`
          : '');

    // ✅ NEW: hint progress สำหรับ mini-no-junk
    let autoHint = `โซนน้ำ: ${waterZone}`;
    try {
      if (currentMini && (currentMini.id === 'mini-no-junk') && typeof deck.getMiniNoJunkProgress === 'function') {
        const p = deck.getMiniNoJunkProgress();
        const now = Number(p?.now ?? 0) || 0;
        const target = Number(p?.target ?? 0) || 0;
        if (target > 0 && now < target) {
          autoHint = `เลี่ยงน้ำหวาน ${now}/${target}s`;
        } else if (target > 0) {
          autoHint = `เลี่ยงน้ำหวาน ${target}/${target}s ✅`;
        }
      }
    } catch {}

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
          hint: hint || autoHint,
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
    if (ended) return { good: false, scoreDelta: 0 };

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

    // ----- น้ำดี -----
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
      deck.onJunk && deck.onJunk(); // ✅ รีเซ็ต secSinceJunk เฉพาะโดนจริง
      syncDeck(); pushQuest();
      scoreFX(x, y, d, 'MISS', false);

      try {
        ROOT.dispatchEvent(new CustomEvent('hha:miss', { detail: { misses } }));
      } catch {}

      sendJudge('MISS');
      pushHudScore();
      return { good: false, scoreDelta: d };
    }

    return { good: false, scoreDelta: 0 };
  }

  // ======================================================
  //  เมื่อเป้าหายไปเอง (expire)
  //  ✅ ปรับ: junk expire ไม่ควรรีเซ็ต “เลี่ยงน้ำหวาน”
  // ======================================================
  function onExpire (ev) {
    if (ended) return;

    if (ev && ev.isGood === false) {
      // ❌ ห้ามเรียก deck.onJunk() ตรงนี้
      // เพราะผู้เล่นไม่ได้ “โดน” จริง ๆ
      syncDeck();
      pushQuest();
      pushHudScore({ reason: 'expire-junk' });
      return;
    }

    pushHudScore({ reason: 'expire' });
  }

  // ======================================================
  //  ตรวจ Quest / จบเกมเมื่อเคลียร์ครบ
  // ======================================================
  function checkQuestCompletion () {
    const snap = getQuestSnapshot();
    const { goalsAll, minisAll, goalsDone, goalsTotal, minisDone, minisTotal } = snap;

    const prevGoal = goalCleared;
    const prevMini = miniCleared;

    goalCleared = Math.min(GOAL_TARGET, goalsDone);
    miniCleared = Math.min(MINI_TARGET, minisDone);

    if (goalCleared > prevGoal) {
      const justIndex = goalCleared;
      const g = goalsAll[justIndex - 1] || null;
      const text = g ? (g.label || g.title || g.text || '') : '';

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

      if (typeof deck.nextGoal === 'function' && goalCleared < GOAL_TARGET) {
        deck.nextGoal();
      }
    }

    if (miniCleared > prevMini) {
      const justIndex = miniCleared;
      const m = minisAll[justIndex - 1] || null;
      const text = m ? (m.label || m.title || m.text || '') : '';

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

      if (typeof deck.nextMini === 'function' && miniCleared < MINI_TARGET) {
        deck.nextMini();
      }
    }

    if (!ended && goalCleared >= GOAL_TARGET && miniCleared >= MINI_TARGET) {
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
      pushQuest();
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
  //  CLUTCH TIME handler
  // ======================================================
  const onClutch = (e) => {
    if (ended) return;
    inClutch = true;
    const d = (e && e.detail) || {};
    const secLeft = (typeof d.secLeft === 'number') ? d.secLeft : null;

    if (secLeft && secLeft > 0) {
      coach(`ช่วงท้ายเกมแล้ว เหลือประมาณ ${secLeft} วินาที! เก็บน้ำดีรัว ๆ ให้โซนยังสีเขียว 💧🔥`, 1500);
    } else {
      coach('ช่วงท้ายเกมแล้ว! เก็บน้ำดีให้สุดกำลังก่อนหมดเวลา 💧🔥', 1500);
    }
  };

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
    try { ROOT.removeEventListener('hha:clutch', onClutch); } catch {}

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

    pushHudScore({ ended: true, ...questMeta() });
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
  ROOT.addEventListener('hha:clutch', onClutch);

  // ======================================================
  //  เรียก factoryBoot
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
      try { ROOT.removeEventListener('hha:clutch', onClutch); } catch {}
      return origStop(...args);
    };
  }

  // ---------- START ----------
  pushQuest('เริ่มโหมดน้ำสมดุล');
  coach('ภารกิจคือรักษาน้ำในร่างกายให้อยู่โซนสีเขียว 💧 เลือกน้ำดี เลี่ยงน้ำหวานนะ');
  pushHudScore();

  return inst;
}
