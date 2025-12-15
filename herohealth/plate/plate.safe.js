// === /herohealth/plate/plate.safe.js ===
// Balanced Plate — Goals 2 + Mini quests 3 + Fever + Multi-Plate
// MISS = กดของไม่ดีเท่านั้น (ของขยะ) + โค้ช ป.5 + cleanup hha:time listener

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

// ---------- Global modules ----------
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop () {}, burstAt () {} };

const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI ||
  {
    ensureFeverBar () {},
    setFever () {},
    setFeverActive () {},
    setShield () {}
  };

const {
  ensureFeverBar,
  setFever,
  setFeverActive,
  setShield
} = FeverUI;

// ======================================================
//  Quest Config: 2 Goals + 3 Mini quests
// ======================================================

const PLATE_QUEST_CONFIG = {
  easy: {
    goal1_perfectPlates: 1,   // PERFECT PLATE อย่างน้อย 1 จาน
    goal2_balancedPlates: 2,  // จานครบ 5 หมู่ ≥ 2 จาน
    mini1_comboX: 3,          // คอมโบสูงสุดถึงอย่างน้อย x3
    mini2_rushPerfect: 1,     // PERFECT PLATE ระหว่าง Plate Rush ≥ 1 จาน
    mini3_vegFruitCount: 5    // ผัก+ผลไม้รวม ≥ 5 ชิ้น
  },
  normal: {
    goal1_perfectPlates: 2,
    goal2_balancedPlates: 3,
    mini1_comboX: 4,
    mini2_rushPerfect: 2,
    mini3_vegFruitCount: 7
  },
  hard: {
    goal1_perfectPlates: 3,
    goal2_balancedPlates: 4,
    mini1_comboX: 5,
    mini2_rushPerfect: 3,
    mini3_vegFruitCount: 9
  }
};

// ---------- Emoji mapping: 5 food groups ----------
// 1: ข้าว-แป้ง, 2: เนื้อ/โปรตีน, 3: ผัก, 4: ผลไม้, 5: ไขมัน/นม

const FOOD_GROUP = {
  // หมู่ 1
  '🍚': 1,
  '🍞': 1,
  '🥖': 1,
  '🥯': 1,

  // หมู่ 2
  '🍗': 2,
  '🍖': 2,
  '🥩': 2,
  '🐟': 2,
  '🍳': 2,

  // หมู่ 3 (ผัก)
  '🥦': 3,
  '🥕': 3,
  '🥬': 3,
  '🥒': 3,
  '🌽': 3,

  // หมู่ 4 (ผลไม้)
  '🍎': 4,
  '🍌': 4,
  '🍊': 4,
  '🍇': 4,
  '🍓': 4,

  // หมู่ 5 (ไขมัน / นม / ถั่ว)
  '🥜': 5,
  '🥑': 5,
  '🧀': 5,
  '🥛': 5,
  '🧈': 5
};

const GOOD_POOL = Object.keys(FOOD_GROUP);

const JUNK_POOL = [
  '🍔','🍟','🍕','🌭','🍩','🍪','🍰','🍫','🧋','🥤'
];

// ---------- Plate & Rush settings ----------
const PLATE_SIZE = 5;     // ใช้ 5 ชิ้นดีต่อ 1 จาน (ง่ายต่อการนับ)
const RUSH_WINDOW = 15;   // วินาทีสุดท้าย = Plate Rush

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

// ---------- Safe FX wrappers ----------
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
//  BOOT (entry จาก plate.html)
// ======================================================

export async function boot (cfg = {}) {
  // ----- Difficulty + Duration -----
  const diffRaw = String(cfg.difficulty || 'normal').toLowerCase();
  const diff =
    diffRaw === 'easy' || diffRaw === 'normal' || diffRaw === 'hard'
      ? diffRaw
      : 'normal';

  let dur = Number(cfg.duration || 60);
  if (!Number.isFinite(dur) || dur <= 0) dur = 60;
  if (dur < 20) dur = 20;
  if (dur > 180) dur = 180;

  const qcfg = PLATE_QUEST_CONFIG[diff] || PLATE_QUEST_CONFIG.normal;

  // ----- Fever HUD -----
  ensureFeverBar();
  let fever = 0;
  let feverActive = false;
  let shield = 0;
  setFever(fever);
  setFeverActive(feverActive);
  setShield(shield);

  // ---------- Main stats ----------
  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;
  let bestCombo = 0;

  let perfectPlates = 0;
  let balancedPlates = 0;
  let vegFruitTotal = 0;
  let rushPerfect = 0;

  let plateIndex = 0;
  let curHits = 0;
  let curGroups = resetPlateGroups();

  let goalsCleared = 0;    // 0–2
  let miniCleared = 0;     // 0–3

  let elapsedSec = 0;
  let remainingSec = dur;
  let inRush = false;
  let ended = false;
  let allClearedFired = false;

  function resetPlateGroups () {
    return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  }

  function mult () {
    return feverActive ? 2 : 1;
  }

  function clamp (v, min, max) {
    if (v < min) return min;
    if (v > max) return max;
    return v;
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
    fever = clamp(fever + n, 0, 100);
    if (!feverActive && fever >= 100) {
      feverActive = true;
      coach('เข้าโหมดไฟแล้ว! เลือกอาหารดีให้รัว ๆ เลย 🔥', 3500);
      pushFeverEvent('start');
    } else {
      pushFeverEvent('change');
    }
    applyFeverUI();
  }

  function decayFever (n) {
    const wasActive = feverActive;
    const d = feverActive ? 10 : n;
    fever = clamp(fever - d, 0, 100);
    if (feverActive && fever <= 0) feverActive = false;
    if (wasActive && !feverActive) pushFeverEvent('end');
    else pushFeverEvent('change');
    applyFeverUI();
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

  // ---------- Quest meta / HUD ----------
  function questMeta () {
    return {
      goalsCleared,
      goalsTarget: 2,
      quests: miniCleared,
      questsTotal: 3,
      questsCleared: miniCleared,
      questsTarget: 3
    };
  }

  function pushHudScore (extra = {}) {
    try {
      ROOT.dispatchEvent(new CustomEvent('hha:score', {
        detail: {
          mode: 'BalancedPlate',
          modeKey: 'plate',
          modeLabel: 'Balanced Plate',
          difficulty: diff,
          score,
          combo,
          comboMax,
          misses,
          miss: misses,
          timeSec: elapsedSec,
          perfectPlates,
          balancedPlates,
          vegFruitTotal,
          rushPerfect,
          ...questMeta(),
          ...extra
        }
      }));
    } catch {}
  }

  function buildGoalsArray () {
    return [
      {
        id: 'G1',
        label: `ทำ PERFECT PLATE ให้ได้อย่างน้อย ${qcfg.goal1_perfectPlates} จาน`,
        prog: perfectPlates,
        target: qcfg.goal1_perfectPlates,
        done: perfectPlates >= qcfg.goal1_perfectPlates
      },
      {
        id: 'G2',
        label: `สะสมจานครบ 5 หมู่ให้ได้ ${qcfg.goal2_balancedPlates} จาน`,
        prog: balancedPlates,
        target: qcfg.goal2_balancedPlates,
        done: balancedPlates >= qcfg.goal2_balancedPlates
      }
    ];
  }

  function buildMinisArray () {
    return [
      {
        id: 'M1',
        label: `ทำคอมโบให้ถึง x${qcfg.mini1_comboX} อย่างน้อย 1 ครั้ง`,
        prog: bestCombo >= qcfg.mini1_comboX ? 1 : 0,
        target: 1,
        done: bestCombo >= qcfg.mini1_comboX
      },
      {
        id: 'M2',
        label: `ช่วง Plate Rush ได้ PERFECT อย่างน้อย ${qcfg.mini2_rushPerfect} จาน`,
        prog: rushPerfect,
        target: qcfg.mini2_rushPerfect,
        done: rushPerfect >= qcfg.mini2_rushPerfect
      },
      {
        id: 'M3',
        label: `สะสมผัก+ผลไม้รวมให้ได้ ${qcfg.mini3_vegFruitCount} ชิ้น`,
        prog: vegFruitTotal,
        target: qcfg.mini3_vegFruitCount,
        done: vegFruitTotal >= qcfg.mini3_vegFruitCount
      }
    ];
  }

  function pushQuestUpdate (hint) {
    const goalsAll = buildGoalsArray();
    const minisAll = buildMinisArray();

    // เลือก current goal / mini = อันแรกที่ยังไม่เสร็จ
    const goalCur =
      goalsAll.find(g => !g.done) || goalsAll[goalsAll.length - 1] || null;
    const miniCur =
      minisAll.find(m => !m.done) || minisAll[minisAll.length - 1] || null;

    try {
      ROOT.dispatchEvent(new CustomEvent('quest:update', {
        detail: {
          goal: goalCur,
          mini: miniCur,
          goalsAll,
          minisAll,
          goalIndex: goalCur ? goalsAll.indexOf(goalCur) + 1 : 0,
          goalTotal: goalsAll.length,
          miniIndex: miniCur ? minisAll.indexOf(miniCur) + 1 : 0,
          miniTotal: minisAll.length,
          goalHeading: goalCur ? `Goal ${goalsAll.indexOf(goalCur) + 1}: ${goalCur.label}` : '',
          miniHeading: miniCur ? `Mini: ${miniCur.label}` : '',
          hint: hint || '',
          meta: questMeta()
        }
      }));
    } catch {}
  }

  function checkQuestCompletion () {
    const prevGoals = goalsCleared;
    const prevMini = miniCleared;

    const goalsAll = buildGoalsArray();
    const minisAll = buildMinisArray();

    goalsCleared = goalsAll.filter(g => g.done).length;
    miniCleared = minisAll.filter(m => m.done).length;

    // เพิ่งจบ Goal ใหม่
    if (goalsCleared > prevGoals) {
      const idx = goalsCleared;
      const g = goalsAll[idx - 1] || null;
      const text = g ? g.label : '';
      try {
        ROOT.dispatchEvent(new CustomEvent('quest:goal-cleared', {
          detail: {
            index: idx,
            total: goalsAll.length,
            title: text,
            heading: `Goal ${idx}: ${text}`,
            reward: 'shield',
            meta: questMeta()
          }
        }));
      } catch {}
      coach(`Goal ${idx}/${goalsAll.length} สำเร็จแล้ว! 🎯`, 3500);
    }

    // เพิ่งจบ Mini ใหม่
    if (miniCleared > prevMini) {
      const idx = miniCleared;
      const m = minisAll[idx - 1] || null;
      const text = m ? m.label : '';
      try {
        ROOT.dispatchEvent(new CustomEvent('quest:mini-cleared', {
          detail: {
            index: idx,
            total: minisAll.length,
            title: text,
            heading: `Mini quest ${idx}: ${text}`,
            reward: 'star',
            meta: questMeta()
          }
        }));
      } catch {}
      coach(`Mini quest ${idx}/${minisAll.length} สำเร็จแล้ว ⭐`, 3500);
    }

    // อัปเดต HUD
    pushQuestUpdate();

    // ครบทุก Goal + Mini → ฉลองใหญ่ + จบเกม
    if (!ended &&
        !allClearedFired &&
        goalsCleared >= 2 &&
        miniCleared >= 3) {
      allClearedFired = true;
      try {
        ROOT.dispatchEvent(new CustomEvent('quest:all-cleared', {
          detail: {
            goals: goalsCleared,
            minis: miniCleared,
            goalsTotal: goalsAll.length,
            minisTotal: minisAll.length,
            meta: questMeta()
          }
        }));
      } catch {}
      coach('สุดยอด! เคลียร์ทุกภารกิจ Balanced Plate แล้ว 🎉', 4000);
      finish(elapsedSec, 'quests-complete');
    }
  }

  // ======================================================
  //  Plate logic
  // ======================================================

  function finalizePlate () {
    if (curHits <= 0) return;

    const hasAllFive = [1, 2, 3, 4, 5].every(id => (curGroups[id] || 0) > 0);
    const isPerfect =
      hasAllFive &&
      [1, 2, 3, 4, 5].every(id => (curGroups[id] || 0) === 1);

    plateIndex++;

    if (isPerfect) {
      perfectPlates++;
      balancedPlates++;
      if (inRush) rushPerfect++;
      coach('ได้ PERFECT PLATE 1 จาน! ครบทั้ง 5 หมู่แบบสมดุลเลย 🥗', 3500);
    } else if (hasAllFive) {
      balancedPlates++;
      if (inRush) rushPerfect++;
      coach('เยี่ยม! ได้จานครบ 5 หมู่เพิ่มอีก 1 จาน 🥗', 3500);
    }

    curHits = 0;
    curGroups = resetPlateGroups();

    checkQuestCompletion();
    pushHudScore();
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

    // ---------- GOOD food ----------
    if (GOOD_POOL.includes(ch)) {
      const group = FOOD_GROUP[ch] || 0;

      curHits++;
      if (group >= 1 && group <= 5) {
        curGroups[group] = (curGroups[group] || 0) + 1;
        if (group === 3 || group === 4) {
          vegFruitTotal++;
        }
      }

      const base = 14 + combo * 2;
      const gain = base * mult();
      score += gain;

      combo++;
      comboMax = Math.max(comboMax, combo);
      bestCombo = Math.max(bestCombo, combo);

      gainFever(6 + combo * 0.4);

      const label =
        combo >= 8 ? 'PERFECT' :
        combo >= 4 ? 'GREAT' :
        'GOOD';

      scoreFX(x, y, gain, label, true);
      sendJudge(label);
      pushHudScore();

      // เมื่อสะสมครบ 1 จาน (5 ชิ้นดี) ให้สรุปจาน
      if (curHits >= PLATE_SIZE) {
        finalizePlate();
      } else {
        checkQuestCompletion();
      }

      return { good: true, scoreDelta: gain };
    }

    // ---------- JUNK / bad food ----------
    if (JUNK_POOL.includes(ch)) {
      if (shield > 0) {
        shield = Math.max(0, shield - 1);
        setShield(shield);
        decayFever(6);
        scoreFX(x, y, 0, 'BLOCK', false);
        coach('เกราะช่วยกันของขยะให้แล้ว 🛡️ ระวังอย่าเผลอบ่อยเกินไปนะ', 3500);
        sendJudge('BLOCK');
        pushHudScore();
        return { good: false, scoreDelta: 0 };
      }

      const d = -12;
      score = Math.max(0, score + d);
      combo = 0;
      misses++;

      decayFever(14);

      scoreFX(x, y, d, 'MISS', false);
      sendJudge('MISS');

      try {
        ROOT.dispatchEvent(new CustomEvent('hha:miss', {
          detail: { misses }
        }));
      } catch {}

      if (misses === 1) {
        coach('ลองสังเกตดูว่าอะไรคืออาหารขยะ 🍟 แล้วเลี่ยงให้ได้มากที่สุดนะ', 4000);
      } else if (misses === 3) {
        coach('ของขยะเริ่มเยอะแล้ว ลองโฟกัสเลือกแต่เมนูดี ๆ สักพักนะ 💪', 4000);
      }

      pushHudScore();
      checkQuestCompletion();

      return { good: false, scoreDelta: d };
    }

    // ไม่รู้จัก emoji → ไม่คิดคะแนน
    return { good: false, scoreDelta: 0 };
  }

  // เมื่อเป้าหายไปเอง (หมดเวลา) — ไม่ถือว่า MISS
  function onExpire () {
    if (ended) return;
    // สำหรับ Balanced Plate เราไม่ถือว่าเป็น miss
    pushHudScore({ reason: 'expire' });
  }

  // ======================================================
  //  Time events & finish
  // ======================================================

  function finish (durationSec, reason = 'time-up') {
    if (ended) return;
    ended = true;

    // ปิด event listener เวลา
    try {
      ROOT.removeEventListener('hha:time', onTime);
    } catch {}

    // สรุป plate ท้าย ๆ ถ้ายังค้าง
    if (curHits > 0) {
      finalizePlate();
    }

    try {
      if (inst && typeof inst.stop === 'function') {
        inst.stop(reason);
      }
    } catch (err) {
      console.warn('[BalancedPlate] inst.stop error', err);
    }

    try {
      ROOT.dispatchEvent(new CustomEvent('hha:end', {
        detail: {
          mode: 'BalancedPlate',
          modeLabel: 'Balanced Plate',
          difficulty: diff,
          score,
          misses,
          comboMax,
          duration: durationSec,
          perfectPlates,
          balancedPlates,
          vegFruitTotal,
          rushPerfect,
          goalsCleared,
          goalsTotal: 2,
          quests: miniCleared,
          questsTotal: 3,
          questsCleared: miniCleared,
          questsTarget: 3,
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

    if (sec < 0) return;

    remainingSec = sec;
    if (sec > 0) {
      elapsedSec = dur - sec;
    }

    // เข้าโหมด Plate Rush
    if (!inRush && sec <= RUSH_WINDOW) {
      inRush = true;
      coach('เข้าสู่ช่วง Plate Rush แล้ว! พยายามทำ PERFECT PLATE ให้ได้เยอะ ๆ 🎯', 3500);
    }

    if (sec === 0 && !ended) {
      finish(dur, 'time-up');
    }
  };

  ROOT.addEventListener('hha:time', onTime);

  // ======================================================
  //  เรียก mode-factory ให้สร้างเป้า DOM (ใช้เหมือน GoodJunk / Hydration)
  // ======================================================

  const inst = await factoryBoot({
    difficulty: diff,
    duration: dur,
    modeKey: 'plate',
    pools: {
      good: [...GOOD_POOL],
      bad:  [...JUNK_POOL]
    },
    goodRate: 0.68,
    powerups: [],          // Balanced Plate ยังไม่ใช้ power-up พิเศษ
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
  coach('จัดจานให้ครบ 5 หมู่ เลี่ยงของขยะ แล้วลุ้น PERFECT PLATE ให้เยอะที่สุด! 🥗', 3800);
  pushQuestUpdate('เริ่มภารกิจ Balanced Plate');
  pushHudScore();

  return inst;
}