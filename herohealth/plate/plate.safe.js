// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — MISS = แตะของไม่ดีเท่านั้น + โค้ช ป.5
// multi-plate + grade SSS/SS/S/A/B/C + goals/quests เข้า hha:stat
// ★ เป้า adaptive เฉพาะโหมดเล่นปกติ (run=play)
//   - โหมดวิจัย (run=research) ใช้ขนาดตามระดับ easy/normal/hard อย่างเดียว

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { createPlateQuest, QUOTA } from './plate.quest.js';

// ---------- ใช้ของจาก global (โหลดด้วย <script src> ใน HTML) ----------
const ROOT = (typeof window !== 'undefined' ? window : globalThis);

// Particles จาก /vr/particles.js (IIFE)
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { burstAt(){}, scorePop(){} };

// FeverUI จาก /vr/ui-fever.js (IIFE)
const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI ||
  {
    ensureFeverBar() {},
    setFever() {},
    setFeverActive() {},
    setShield() {}
  };

const { ensureFeverBar, setFever, setFeverActive, setShield } = FeverUI;

// ----- อ่าน run mode จาก URL (?run=play|research) -----
let RUN_MODE = 'play';
let IS_RESEARCH = false;

try {
  if (typeof window !== 'undefined' && window.location) {
    const u = new URL(window.location.href);
    RUN_MODE = (u.searchParams.get('run') || 'play').toLowerCase();
    IS_RESEARCH = RUN_MODE === 'research';
  }
} catch {
  RUN_MODE = 'play';
  IS_RESEARCH = false;
}

// ---------- ค่าคงที่ของเกม Balanced Plate ----------
const GROUPS = {
  1: ['🍚','🍙','🍞','🥯','🥐'],                  // ข้าว-แป้ง
  2: ['🥩','🍗','🍖','🥚','🧀'],                  // โปรตีน
  3: ['🥦','🥕','🥬','🌽','🥗','🍅'],             // ผัก
  4: ['🍎','🍌','🍇','🍉','🍊','🍓','🍍'],         // ผลไม้
  5: ['🥛','🧈','🧀','🍨']                        // นม/ผลิตภัณฑ์นม
};

const GOOD = Object.values(GROUPS).flat();
const BAD  = ['🍔','🍟','🍕','🍩','🍪','🧋','🥤','🍫','🍬','🥓'];

const STAR   = '⭐';
const DIA    = '💎';
const SHIELD = '🛡️';
const FIRE   = '🔥';
const BONUS  = [STAR, DIA, SHIELD, FIRE];

// ขนาดเป้าพื้นฐานตามระดับ (ใช้ทั้งโหมดเล่น + วิจัย)
const BASE_TARGET_SCALE = {
  easy:   1.15,
  normal: 1.0,
  hard:   0.85
};

function foodGroup(emo) {
  for (const [g, arr] of Object.entries(GROUPS)) {
    if (arr.includes(emo)) return +g;
  }
  return 0;
}

// ---- Grade helper ----
// ให้เกรดผูกกับ (1) การผ่าน Goal/Mini, (2) จำนวนจานสมดุล, (3) คะแนนรวม, (4) MISS
function computeGrade(metrics) {
  const {
    score = 0,
    platesDone = 0,
    misses = 0,
    goalsCleared = 0,
    goalsTotal = 0,
    questsCleared = 0,
    questsTotal = 0,
    diff = 'normal'
  } = metrics || {};

  const s        = Number(score) || 0;
  const plates   = Number(platesDone) || 0;
  const miss     = Number(misses) || 0;
  const goalRate = goalsTotal  > 0 ? goalsCleared  / goalsTotal  : 0;
  const questRate= questsTotal > 0 ? questsCleared / questsTotal : 0;

  // ---- normalize scores เป็น 0–1 ----
  // สมมติ 4500 คะแนน = ดีมาก, 3 จานสมดุล = เป้าหมายหลัก
  const hitScore    = Math.min(1, s / 4500);
  const plateScore  = Math.min(1, plates / 3);
  const questScore  = (goalRate * 0.6) + (questRate * 0.4); // เน้น Goal มากกว่า Mini
  const missPenalty = Math.min(0.4, (miss || 0) * 0.04);    // MISS เยอะโดนหักเยอะสุด 0.4

  // น้ำหนักรวม (เน้นภารกิจ)
  let index = 0;
  index += questScore * 0.5;
  index += plateScore * 0.2;
  index += hitScore   * 0.3;
  index -= missPenalty;

  // ปรับตามระดับความยากเล็กน้อย (เล่น hard ได้ index บวกเพิ่ม)
  const d = String(diff || 'normal').toLowerCase();
  if (d === 'hard')   index += 0.05;
  if (d === 'easy')   index -= 0.03;

  // clamp 0–1
  if (index < 0) index = 0;
  if (index > 1) index = 1;

  // แปลงเป็นเกรด
  if (index >= 0.88) return 'SSS';
  if (index >= 0.78) return 'SS';
  if (index >= 0.68) return 'S';
  if (index >= 0.58) return 'A';
  if (index >= 0.42) return 'B';
  return 'C';
}

// ---- Coach helper ----
let lastCoachAt = 0;
function coach(text, minGap = 2200) {
  if (!text) return;
  const now = Date.now();
  if (now - lastCoachAt < minGap) return;
  lastCoachAt = now;
  try {
    window.dispatchEvent(new CustomEvent('hha:coach', { detail: { text } }));
  } catch {}
}

// เก็บ reference ของ controller เพื่อ stop spawn ตอนจบเกมจริง ๆ
let ctrlRef = null;
let allQuestCleared = false;

export async function boot(cfg = {}) {
  const diffRaw = String(cfg.difficulty || 'normal').toLowerCase();
  const diff = (diffRaw === 'easy' || diffRaw === 'hard' || diffRaw === 'normal')
    ? diffRaw : 'normal';

  let dur = Number(cfg.duration || 60);
  if (!Number.isFinite(dur) || dur <= 0) dur = 60;
  if (dur < 20) dur = 20;
  if (dur > 180) dur = 180;

  allQuestCleared = false;

  // ===== Target Adaptive (เฉพาะโหมดเล่นปกติ) =====
  let adaptiveScale = 1.0;

  function applyTargetScale() {
    const base = BASE_TARGET_SCALE[diff] || 1.0;
    const scale = base * adaptiveScale;

    try {
      if (typeof document !== 'undefined') {
        // ให้ทั้ง html และ body รู้ scale นี้
        document.documentElement.style.setProperty('--hha-target-scale', String(scale));
        if (document.body) {
          document.body.style.setProperty('--hha-target-scale', String(scale));
        }
      }
    } catch {}
  }

  function updateAdaptiveScale(hitGood) {
    // 🔒 โหมดวิจัย: ไม่ใช้ adaptive → scale = base ตามระดับเท่านั้น
    if (IS_RESEARCH) {
      adaptiveScale = 1.0;
      applyTargetScale();
      return;
    }

    // โหมดเล่นปกติ (run=play) เท่านั้นที่ปรับ adaptive
    if (hitGood === true) {
      // ตีดี → เป้าเล็กลงหน่อย
      adaptiveScale -= 0.03;
    } else if (hitGood === false) {
      // ตีพลาด → เป้าใหญ่ขึ้นหน่อย
      adaptiveScale += 0.05;
    }

    // จำกัดช่วงไม่ให้สุดโต่งเกินไป
    if (adaptiveScale < 0.6) adaptiveScale = 0.6;
    if (adaptiveScale > 1.5) adaptiveScale = 1.5;

    applyTargetScale();
  }

  // HUD เริ่มต้น
  ensureFeverBar();
  setFever(0);
  setFeverActive(false);
  setShield(0);
  // เซ็ตขนาดเป้าเริ่มต้นตามระดับ (และ adaptive = 1)
  applyTargetScale();

  // Quest deck
  const deck = createPlateQuest(diff);
  // ★ ตามดีไซน์: ต่อเกมใช้ Goal 2 ภารกิจ + Mini 3 ภารกิจ
  deck.drawGoals(2);
  deck.draw3(); // mini quest 3 ภารกิจ

  const need = QUOTA[diff] || QUOTA.normal;      // โควตาใน "หนึ่งจาน"
  const totalNeed = need.reduce((a, b) => a + b, 0);

  // gCounts = เก็บรวมทั้งเกม (aggregate สำหรับวิจัย)
  const gCounts = [0, 0, 0, 0, 0];
  // plateCounts = นับเฉพาะ “จานปัจจุบัน”
  const plateCounts = [0, 0, 0, 0, 0];
  let platesDone = 0;

  let accMiniDone = 0;
  let accGoalDone = 0;

  // State หลัก
  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;
  let star = 0;
  let diamond = 0;
  let shield = 0;
  let fever = 0;
  let feverActive = false;

  function mult() { return feverActive ? 2 : 1; }

  // สรุป progress ของ goal/mini ทุกครั้งที่ยิง stat
  function buildQuestSummary() {
    let goalsCleared = 0;
    let goalsTotal   = 0;
    let questsCleared= 0;
    let questsTotal  = 0;

    if (deck && typeof deck.getProgress === 'function') {
      const g = deck.getProgress('goals') || [];
      const m = deck.getProgress('mini')  || [];

      goalsTotal    = accGoalDone + g.length;
      goalsCleared  = accGoalDone + g.filter(x => x && x.done).length;
      questsTotal   = accMiniDone + m.length;
      questsCleared = accMiniDone + m.filter(x => x && x.done).length;
    }

    const grade = computeGrade({
      score,
      platesDone,
      misses,
      goalsCleared,
      goalsTotal,
      questsCleared,
      questsTotal,
      diff
    });

    return { goalsCleared, goalsTotal, questsCleared, questsTotal, grade };
  }

  function emitStat(extra = {}) {
    const summary = buildQuestSummary();
    const baseScale = BASE_TARGET_SCALE[diff] || 1.0;

    try {
      window.dispatchEvent(new CustomEvent('hha:stat', {
        detail: {
          mode: 'Balanced Plate',
          difficulty: diff,
          runMode: RUN_MODE,
          isResearch: IS_RESEARCH,
          targetScale: baseScale * adaptiveScale,  // log ขนาดเป้า ณ ปัจจุบัน
          score,
          combo,
          misses,
          fever,
          feverActive,
          platesDone,
          plateCounts: [...plateCounts],
          totalCounts: [...gCounts],
          ...summary,   // goalsCleared/goalsTotal/questsCleared/questsTotal/grade
          ...extra
        }
      }));
    } catch {}
  }

  function gainFever(n) {
    fever = Math.max(0, Math.min(100, fever + n));
    setFever(fever);
    if (!feverActive && fever >= 100) {
      feverActive = true;
      setFeverActive(true);
      coach('จานพลังพิเศษ ✨ เก็บให้ครบ 5 หมู่เลย!');
    }
    emitStat();
  }

  function decayFever(n) {
    const d = feverActive ? 10 : n;
    fever = Math.max(0, fever - d);
    setFever(fever);
    if (feverActive && fever <= 0) {
      feverActive = false;
      setFeverActive(false);
    }
    emitStat();
  }

  function syncDeck() {
    deck.updateScore(score);
    deck.updateCombo(combo);
    // ส่งสถิติรวม (ทั้งเกม) ให้ deck ใช้เช็กเควสต์
    deck.stats.gCounts    = [...gCounts];
    deck.stats.star       = star;
    deck.stats.diamond    = diamond;
    deck.stats.misses     = misses;      // สำคัญสำหรับ goal แบบ low-miss
    deck.stats.platesDone = platesDone;  // สำคัญสำหรับ goal นับจำนวนจาน
    emitStat();
  }

  function pushQuest(hint) {
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    const gtxt  = `โควตาใน 1 จาน: [${need.join(', ')}] | จานนี้ทำได้: [${plateCounts.join(', ')}]`;

    window.dispatchEvent(new CustomEvent('quest:update', {
      detail: {
        goal: goals.find(g => !g.done) || goals[0] || null,
        mini: minis.find(m => !m.done) || minis[0] || null,
        goalsAll: goals,
        minisAll: minis,
        hint: hint || gtxt
      }
    }));
  }

  function scoreFX(x, y, val, judgment, good) {
    try {
      const txt = (val > 0 ? '+' : '') + String(val || 0);
      Particles.scorePop(x, y, txt, {
        good: !!good,
        judgment: judgment || ''
      });
      Particles.burstAt(x, y, {
        color: good ? '#22c55e' : '#f97316',
        good: !!good
      });
    } catch {}
  }

  // ===== Logic สำหรับ "จานปัจจุบัน" =====
  function plateProgress() {
    // ใช้ plateCounts (เฉพาะจานนี้) เทียบกับ need
    return plateCounts.reduce((sum, v, i) => {
      const quota = need[i] ?? 0;
      return sum + Math.min(v, quota);
    }, 0);
  }

  function weakestGroup() {
    // หาหมู่ที่ "ยังขาด" ในจานปัจจุบัน
    let minDiff = Infinity;
    let idx = -1;
    for (let i = 0; i < need.length; i++) {
      const d = (need[i] ?? 0) - (plateCounts[i] ?? 0);
      if (d > 0 && d < minDiff) {
        minDiff = d;
        idx = i;
      }
    }
    return idx; // 0..4 หรือ -1
  }

  function resetCurrentPlate() {
    for (let i = 0; i < plateCounts.length; i++) {
      plateCounts[i] = 0;
    }
    emitStat();
  }

  function maybeCoachCombo() {
    if (combo === 3) coach('จานเริ่มสวยแล้ว 🍽️ เก็บให้ครบทุกหมู่เลย!');
    if (combo === 7) coach('คอมโบยาวสุด ๆ ⭐ ใกล้ครบโควตาแล้ว');
  }

  // ===== Judge =====
  function judge(ch, ctx) {
    const x = ctx?.clientX ?? ctx?.cx ?? 0;
    const y = ctx?.clientY ?? ctx?.cy ?? 0;

    // ---- Power-ups ----
    if (ch === STAR) {
      const d = 40 * mult();
      score += d; star++;
      gainFever(10);
      deck.onGood();
      combo++; comboMax = Math.max(comboMax, combo);
      syncDeck(); pushQuest();
      scoreFX(x, y, d, 'STAR', true);
      maybeCoachCombo();
      updateAdaptiveScale(true);  // power-up ถือว่าโดนดี
      return { good: true, scoreDelta: d };
    }
    if (ch === DIA) {
      const d = 80 * mult();
      score += d; diamond++;
      gainFever(30);
      deck.onGood();
      combo++; comboMax = Math.max(comboMax, combo);
      syncDeck(); pushQuest();
      scoreFX(x, y, d, 'DIAMOND', true);
      maybeCoachCombo();
      updateAdaptiveScale(true);
      return { good: true, scoreDelta: d };
    }
    if (ch === SHIELD) {
      shield = Math.min(3, shield + 1);
      setShield(shield);
      const d = 20;
      score += d;
      deck.onGood();
      syncDeck(); pushQuest();
      scoreFX(x, y, d, 'SHIELD', true);
      coach('ได้เกราะจาน 🛡️ เผื่อเผลอแตะของทอด');
      updateAdaptiveScale(true);
      return { good: true, scoreDelta: d };
    }
    if (ch === FIRE) {
      feverActive = true;
      setFeverActive(true);
      fever = Math.max(fever, 60);
      setFever(fever);
      const d = 25;
      score += d;
      deck.onGood();
      syncDeck(); pushQuest();
      scoreFX(x, y, d, 'FEVER', true);
      coach('โหมดไฟ 🍽️ เก็บอาหารดีให้ครบทุกหมู่เลย!');
      updateAdaptiveScale(true);
      return { good: true, scoreDelta: d };
    }

    const g = foodGroup(ch);

    // ---- แตะอาหาร 5 หมู่ (GOOD) ----
    if (g > 0) {
      const d = (16 + combo * 2) * mult();
      score += d;
      combo++; comboMax = Math.max(comboMax, combo);
      gainFever(6 + combo * 0.4);

      // รวมทั้งเกม
      gCounts[g - 1] = (gCounts[g - 1] | 0) + 1;
      // นับเฉพาะจานนี้
      plateCounts[g - 1] = (plateCounts[g - 1] | 0) + 1;

      deck.onGood();
      syncDeck(); pushQuest();

      // PERFECT ถ้าคอมโบสูงหรืออยู่ในโหมดไฟ
      const label = (feverActive || combo >= 10) ? 'PERFECT' : 'GOOD';
      scoreFX(x, y, d, label, true);
      maybeCoachCombo();
      updateAdaptiveScale(true);

      const prog = plateProgress();
      if (prog >= Math.ceil(totalNeed * 0.5) && prog < totalNeed) {
        const w = weakestGroup();
        if (w >= 0) {
          coach(`จานนี้เหลือหมู่ ${w + 1} อีกนิดเดียวก็ครบแล้ว 💡`, 4000);
        }
      }

      if (prog >= totalNeed) {
        // จานนี้ครบโควตาแล้ว → เสิร์ฟ + เริ่มจานใหม่
        platesDone += 1;
        coach(`จานสมดุลแล้ว ครบ 5 หมู่เลย 🎉 เสิร์ฟจานที่ ${platesDone} แล้ว!`, 3000);
        resetCurrentPlate();
        pushQuest(`เริ่มจัดจานที่ ${platesDone + 1}`);
        syncDeck(); // platesDone เปลี่ยน ให้ deck เห็นด้วย
      }

      return { good: true, scoreDelta: d };
    }

    // ---- แตะของไม่ดี (MISS นับที่นี่เท่านั้น) ----
    if (shield > 0) {
      shield--; setShield(shield);
      decayFever(6);
      syncDeck(); pushQuest();
      scoreFX(x, y, 0, 'MISS', false);
      coach('เกราะช่วยกันของทอด/ของหวานให้แล้ว 🍟➡️🛡️', 3500);
      updateAdaptiveScale(false);
      return { good: false, scoreDelta: 0 };
    }

    const d = -12;
    score = Math.max(0, score + d);
    combo = 0;
    misses++;              // MISS = แตะของไม่ดี
    decayFever(16);
    deck.onJunk();         // junkMiss = แตะของไม่ดีเท่านั้น
    syncDeck(); pushQuest();
    scoreFX(x, y, d, 'MISS', false);
    updateAdaptiveScale(false);
    if (misses === 1) {
      coach('จานเริ่มมีของหวานเยอะไปนิด 🍩 ลองเก็บผักกับผลไม้เพิ่ม');
    } else if (misses === 3) {
      coach('ของทอด/หวานเยอะแล้วนะ ลองกลับมาเก็บอาหารหลัก 5 หมู่แทน 🍚🥩🥦🍎🥛', 4000);
    }
    return { good: false, scoreDelta: d };
  }

  // ✅ ปล่อยของเสียหลุดจอ “ไม่ถือว่าพลาด”
  function onExpire(ev) {
    if (!ev || ev.isGood) return;
    decayFever(4);
    syncDeck();
    pushQuest();
  }

  // ---- สรุปเมื่อจบเกม ----
  let ended = false;
  function finish(reason = 'timeup') {
    if (ended) return;
    ended = true;

    try {
      window.removeEventListener('hha:time', onTime);
    } catch {}

    const summary = buildQuestSummary();
    const { goalsCleared, goalsTotal, questsCleared, questsTotal, grade } = summary;
    const baseScale = BASE_TARGET_SCALE[diff] || 1.0;

    emitStat({ ended: true, reason });

    // หยุด spawn เป้าเพิ่ม
    if (ctrlRef && typeof ctrlRef.stop === 'function') {
      try { ctrlRef.stop(); } catch {}
    }

    window.dispatchEvent(new CustomEvent('hha:end', {
      detail: {
        mode: 'Balanced Plate',
        difficulty: diff,
        runMode: RUN_MODE,
        isResearch: IS_RESEARCH,
        targetScale: baseScale * adaptiveScale,
        score,
        misses,
        comboMax,
        duration: dur,
        goalCleared: (goalsTotal > 0 && goalsCleared === goalsTotal),
        goalsCleared,
        goalsTotal,
        questsCleared,
        questsTotal,
        platesDone,
        // รวมทั้งเกม (ใช้วิเคราะห์พฤติกรรมเลือกหมู่)
        groupCounts: [...gCounts],
        grade
      }
    }));
  }

  // ===== onSec: เช็กเวลาทุกวินาที + ตรวจว่าครบทุกภารกิจหรือยัง =====
  function onSec() {
    // อัปเดต fever / deck ทุกวินาที
    if (combo <= 0) decayFever(6);
    else            decayFever(2);

    deck.second(); // ให้ MissionDeck นับ tick/time ภายใน
    syncDeck();

    // --- เช็กภารกิจ ---
    const goals = deck.getProgress('goals') || [];
    const minis = deck.getProgress('mini')  || [];

    const allGoalsDone = goals.length > 0 && goals.every(q => q && q.done);
    const allMinisDone = minis.length > 0 && minis.every(q => q && q.done);

    if (allGoalsDone && allMinisDone && !allQuestCleared) {
      allQuestCleared = true;

      // ยิง stat บอกว่าครบทุกภารกิจแล้ว
      emitStat({ allCleared: true });

      // ส่ง event ให้ HUD ทำเมก้าเซเลเบรต
      try {
        window.dispatchEvent(new CustomEvent('hha:all-cleared', {
          detail: { mode: 'Balanced Plate', difficulty: diff }
        }));
      } catch {}

      coach('เคลียร์ทุกภารกิจแล้ว! เยี่ยมมาก 🎉', 4000);

      // 🎯 จบเกมทันที (ไม่ต้องรอหมดเวลา)
      finish('allcleared');
    }
  }

  // ใช้ clock กลาง hha:time พร้อม cleanup
  const onTime = (e) => {
    const sec = (e.detail?.sec | 0);
    if (sec >= 0) onSec();
    if (sec === 20) coach('เหลือ 20 วิ ลองดูว่าจานนี้ยังขาดหมู่ไหน 🌈');
    if (sec === 10) coach('10 วิ สุดท้าย เสิร์ฟให้ครบอีก 1 จานนะ ✨');
    if (sec === 0) {
      finish('timeup');
    }
  };
  window.addEventListener('hha:time', onTime);

  // ให้ factoryBoot จัดการ spawn/เวลา/ฮิตพื้นฐาน
  const ctrl = await factoryBoot({
    difficulty: diff,
    duration:   dur,
    pools:      { good: [...GOOD, ...BONUS], bad: [...BAD] },
    goodRate:   0.64,
    powerups:   BONUS,
    powerRate:  0.10,
    powerEvery: 7,
    judge:  (ch, ctx) => judge(ch, ctx),
    onExpire
  });

  ctrlRef = ctrl;

  // เพิ่ม cleanup ตอน stop() เผื่อออกกลางคัน
  if (ctrl && typeof ctrl.stop === 'function') {
    const origStop = ctrl.stop.bind(ctrl);
    ctrl.stop = (...args) => {
      try {
        window.removeEventListener('hha:time', onTime);
      } catch {}
      return origStop(...args);
    };
  }

  // แสดงเควสต์ + โค้ชตั้งแต่เริ่ม
  resetCurrentPlate();
  pushQuest('เริ่มจัดจานที่ 1');
  coach('จัดจานให้ครบ 5 หมู่ 🍚🥩🥦🍎🥛 แล้วพยายามเสิร์ฟให้ได้หลายจานที่สุด เลี่ยงของทอดกับของหวานนะ');

  // ยิง stat เริ่มต้นให้ HUD
  emitStat();

  return ctrl;
}

export default { boot };
