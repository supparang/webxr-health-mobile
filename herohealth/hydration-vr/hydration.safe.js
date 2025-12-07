// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration mode – น้ำสมดุล + Water Gauge + Fever + Quest (PC / Mobile / VR)
// ใช้ร่วมกับ ui-water.js, ui-fever.js, particles.js, quest-hud-vr.js, coach-bubble.js, mode-factory.js

'use strict';

// ---------- engine กลาง (สุ่มเป้า + time + hit handler) ----------
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';

// ✅ ใช้ Particles แบบ global (จาก /vr/particles.js – non-module)
const Particles =
  (window.GAME_MODULES && window.GAME_MODULES.Particles) ||
  window.Particles ||
  null;

// ✅ ใช้ FeverUI แบบ global (จาก /vr/ui-fever.js – non-module)
const FeverUI =
  (window.GAME_MODULES && window.GAME_MODULES.FeverUI) ||
  window.FeverUI || {
    ensureFeverBar() {},
    setFever() {},
    setFeverActive() {},
    setShield() {}
  };

// ดึงทุกอย่างจาก hydration.quest.js แล้วค่อยเลือกฟังก์ชัน
import * as HQ from './hydration.quest.js';

// ---------- Emoji (น้ำดี / น้ำไม่ดี / Power-ups) ----------
const GOOD = ['💧', '🥛', '🍉'];              // น้ำดี / ผักผลไม้มีน้ำ
const BAD  = ['🥤', '🧋', '🍺', '☕️'];       // น้ำหวาน / คาเฟอีน ฯลฯ

const STAR   = '⭐';
const DIA    = '💎';
const SHIELD = '🛡️';
const FIRE   = '🔥';
const BONUS  = [STAR, DIA, SHIELD, FIRE];

// ---------- Helper: FX + Coach ----------
function safeScorePop(x, y, text, opt) {
  if (Particles && typeof Particles.scorePop === 'function') {
    Particles.scorePop(x, y, text, opt || {});
  }
}
function safeBurstAt(x, y, opt) {
  if (Particles && typeof Particles.burstAt === 'function') {
    Particles.burstAt(x, y, opt || {});
  }
}

function coachSay(text, mood) {
  if (!text) return;
  window.dispatchEvent(new CustomEvent('hha:coach', {
    detail: {
      text,
      mood: mood || 'neutral', // happy / warn / focus ฯลฯ ให้ coach-bubble ตีความต่อ
      mode: 'Hydration'
    }
  }));
}

// เลือก factory สำหรับ quest ไม่ว่าจะ export แบบไหน
function getCreateHydrationQuest() {
  if (typeof HQ.createHydrationQuest === 'function') {
    return HQ.createHydrationQuest;
  }
  if (HQ.default) {
    if (typeof HQ.default.createHydrationQuest === 'function') {
      return HQ.default.createHydrationQuest;
    }
    if (typeof HQ.default === 'function') {
      // กรณี export default function(...)
      return HQ.default;
    }
  }
  throw new Error('createHydrationQuest not found in hydration.quest.js');
}

// ---------- Boot หลักของโหมด Hydration ----------
export async function boot(cfg = {}) {
  // ----- difficulty + duration จาก config -----
  const diffRaw = String(cfg.difficulty || 'normal').toLowerCase();
  const diff = (diffRaw === 'easy' || diffRaw === 'hard' || diffRaw === 'normal')
    ? diffRaw
    : 'normal';

  let dur = Number(cfg.duration || 60);
  if (!Number.isFinite(dur) || dur <= 0) dur = 60;
  if (dur < 20)  dur = 20;
  if (dur > 180) dur = 180;

  // ----- HUD เริ่มต้น -----
  FeverUI.ensureFeverBar();
  FeverUI.setFever(0);
  FeverUI.setFeverActive(false);
  FeverUI.setShield(0);

  ensureWaterGauge();
  let waterPct = 50;
  const waterRes = setWaterGauge(waterPct);
  let waterZone  = waterRes.zone || 'GREEN';
  const waterStart = waterPct;

  // ----- Quest Deck (MissionDeck) -----
  let deck;
  try {
    const factory = getCreateHydrationQuest();
    deck = factory(diff); // ภายในจะเตรียม goalPool 10 อัน, miniPool 15 อัน แล้วสุ่ม 2 / 3
  } catch (err) {
    console.error('[Hydration] createHydrationQuest error', err);
    // deck ปลอมกันพัง
    deck = {
      stats: { greenTick: 0, zone: waterZone },
      updateScore() {},
      updateCombo() {},
      onGood() {},
      onJunk() {},
      second() {},
      getProgress() { return []; },
      drawGoals() {},
      draw3() {}
    };
  }

  if (!deck.stats) deck.stats = {};
  deck.stats.greenTick = 0;
  deck.stats.zone      = waterZone;

  // ✅ สุ่มภารกิจชุดแรก (MissionDeck จะสุ่ม goal 2/10 + mini 3/15 ตาม diff)
  if (typeof deck.drawGoals === 'function') deck.drawGoals(2);
  if (typeof deck.draw3 === 'function')     deck.draw3();

  let accMiniDone = 0;
  let accGoalDone = 0;

  function pushQuest(hint) {
    if (!deck || typeof deck.getProgress !== 'function') return;

    const goals = deck.getProgress('goals') || [];
    const minis = deck.getProgress('mini')  || [];
    const z     = zoneFrom(waterPct);

    const currentGoal = goals.find(g => !g.done) || goals[0] || null;
    const currentMini = minis.find(m => !m.done) || minis[0] || null;

    window.dispatchEvent(new CustomEvent('quest:update', {
      detail: {
        mode:      'Hydration',
        difficulty: diff,
        goal:       currentGoal,
        mini:       currentMini,
        goalsAll:   goals,
        minisAll:   minis,
        hint:       hint || `โซนน้ำตอนนี้: ${z}`
      }
    }));
  }

  // ---------- State หลัก ----------
  let score       = 0;
  let combo       = 0;
  let comboMax    = 0;
  let misses      = 0;      // นับเฉพาะยิงโดนน้ำไม่ดี (BAD) โดยไม่มี shield
  let star        = 0;
  let diamond     = 0;
  let shield      = 0;
  let fever       = 0;
  let feverActive = false;
  let elapsedSec  = 0;      // เวลาเล่นสะสม (นับขึ้น)

  function mult() {
    return feverActive ? 2 : 1;
  }

  function applyFeverUI() {
    FeverUI.setFever(fever);
    FeverUI.setFeverActive(feverActive);
    FeverUI.setShield(shield);
  }

  function gainFever(n) {
    fever = Math.max(0, Math.min(100, fever + n));
    if (!feverActive && fever >= 100) {
      feverActive = true;
      coachSay('โหมดไฟแรง! ยิงน้ำดีรัว ๆ เลย 🔥', 'happy');
    }
    applyFeverUI();
  }

  function decayFever(n) {
    const d = feverActive ? 10 : n;
    fever = Math.max(0, fever - d);
    if (feverActive && fever <= 0) {
      feverActive = false;
      coachSay('ไฟเริ่มเบาลงแล้ว ค่อย ๆ เล็งต่อไปนะ 😊', 'neutral');
    }
    applyFeverUI();
  }

  function addWater(n) {
    waterPct = Math.max(0, Math.min(100, waterPct + n));
    const res = setWaterGauge(waterPct);
    waterZone = res.zone;
    deck.stats.zone = waterZone;
  }

  function syncDeck() {
    if (!deck) return;
    if (typeof deck.updateScore === 'function') deck.updateScore(score);
    if (typeof deck.updateCombo === 'function') deck.updateCombo(combo);
  }

  // ✅ ส่งข้อมูลขึ้น HUD / logger (score, combo, miss ฯลฯ)
  function pushHudScore(extra = {}) {
    window.dispatchEvent(new CustomEvent('hha:score', {
      detail: {
        mode:       'Hydration',
        modeKey:    'hydration-vr',
        modeLabel:  'Hydration',
        difficulty: diff,
        score,
        combo,
        comboMax,
        misses,
        miss:       misses,
        timeSec:    elapsedSec,
        waterPct,
        waterZone,
        ...extra
      }
    }));
  }

  // ---------- FX ตอนตีเป้า / พลาด ----------
  // ให้ GOOD / PERFECT / MISS / BLOCK เด้งตรงเป้า
  // และตัวเลขคะแนนซ้อนอยู่จุดเดียวกัน (เลื่อนขึ้นลงนิดหน่อย)
  function scoreFX(x, y, delta, judgment) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const j = judgment ? String(judgment).toUpperCase() : '';
    const baseY = y;

    // 1) ข้อความ judgment
    if (j) {
      safeScorePop(x, baseY - 6, j, {
        kind: 'judge',
        judgment: j
      });
    }

    // 2) ตัวเลขคะแนน
    if (delta !== 0) {
      const labelScore = (delta > 0 ? '+' : '') + delta;
      const isBad = (j === 'MISS' || j === 'LATE');
      safeScorePop(x, baseY + 10, labelScore, {
        kind: 'score',
        judgment: isBad ? 'MISS' : 'GOOD'
      });
    }

    // 3) particles แตกกระจาย
    const color =
      j === 'MISS'
        ? '#f97316'
        : (j === 'PERFECT' ? '#facc15' : '#22c55e');

    safeBurstAt(x, baseY, { color, count: 14, radius: 60 });
  }

  // ---------- judge: ยิงโดน emoji ----------
  function judge(ch, ctx) {
    const x = ctx?.clientX ?? ctx?.cx ?? 0;
    const y = ctx?.clientY ?? ctx?.cy ?? 0;

    // ----- Power-ups -----
    if (ch === STAR) {
      const d = 40 * mult();
      score += d;
      star++;
      gainFever(10);
      deck.onGood && deck.onGood();
      combo++;
      comboMax = Math.max(comboMax, combo);
      syncDeck();
      pushQuest();
      scoreFX(x, y, d, 'GOOD');
      pushHudScore();
      coachSay('ได้ดาวเพิ่มพลังแล้ว ✨ สู้ต่อ!', 'happy');
      return { good: true, scoreDelta: d };
    }

    if (ch === DIA) {
      const d = 80 * mult();
      score += d;
      diamond++;
      gainFever(30);
      deck.onGood && deck.onGood();
      combo++;
      comboMax = Math.max(comboMax, combo);
      syncDeck();
      pushQuest();
      scoreFX(x, y, d, 'PERFECT');
      pushHudScore();
      coachSay('เพชรโบนัส! คะแนนพุ่งเลย 💎', 'happy');
      return { good: true, scoreDelta: d };
    }

    if (ch === SHIELD) {
      shield = Math.min(3, shield + 1);
      FeverUI.setShield(shield);
      const d = 20;
      score += d;
      deck.onGood && deck.onGood();
      syncDeck();
      pushQuest();
      scoreFX(x, y, d, 'GOOD');
      pushHudScore();
      coachSay(`ได้โล่กันพลาดเพิ่ม x${shield} แล้ว 🛡️`, 'focus');
      return { good: true, scoreDelta: d };
    }

    if (ch === FIRE) {
      feverActive = true;
      fever = Math.max(fever, 60);
      applyFeverUI();
      const d = 25;
      score += d;
      deck.onGood && deck.onGood();
      syncDeck();
      pushQuest();
      scoreFX(x, y, d, 'FEVER');
      pushHudScore();
      coachSay('โหมไฟแล้ว! รัวน้ำดีให้สุดเลย 🔥', 'happy');
      return { good: true, scoreDelta: d };
    }

    // ----- น้ำดี / น้ำไม่ดี ปกติ -----
    if (GOOD.includes(ch)) {
      // ยิงโดนน้ำดี → ไม่เป็น miss
      addWater(+8);
      const d = (14 + combo * 2) * mult();
      score += d;
      combo++;
      comboMax = Math.max(comboMax, combo);
      gainFever(6 + combo * 0.4);
      deck.onGood && deck.onGood();
      syncDeck();
      pushQuest();

      const j = combo >= 8 ? 'PERFECT' : 'GOOD';
      scoreFX(x, y, d, j);
      pushHudScore();

      if (combo === 1) {
        coachSay('เริ่มคอมโบแล้ว! เลือกน้ำดีต่อเนื่องเลย 💧', 'happy');
      } else if (combo === 5) {
        coachSay('คอมโบ x5 แล้ว เก่งมาก ๆ ✨', 'happy');
      } else if (combo === 10) {
        coachSay('สุดยอด! โปรน้ำสมดุลแล้ว x10 💪', 'happy');
      }

      return { good: true, scoreDelta: d };
    }

    // ----- ยิงโดนน้ำไม่ดี (BAD) -----
    if (shield > 0) {
      // กัน miss ให้ (ไม่เพิ่ม misses)
      shield--;
      FeverUI.setShield(shield);
      addWater(-4);
      decayFever(6);
      deck.onJunk && deck.onJunk();
      syncDeck();
      pushQuest();
      scoreFX(x, y, 0, 'BLOCK');
      pushHudScore({ blocked: true });
      coachSay('โล่ช่วยกันน้ำหวานให้แล้ว ระวังรอบหน้านะ 🛡️', 'focus');
      return { good: false, scoreDelta: 0 };
    }

    // ✅ เคส miss จริง: ยิงโดนน้ำหวาน (BAD) ขณะไม่มี shield
    addWater(-8);
    const d = -10;
    score = Math.max(0, score + d);
    combo = 0;
    misses++;
    decayFever(14);
    deck.onJunk && deck.onJunk();
    syncDeck();
    pushQuest();
    scoreFX(x, y, d, 'MISS');
    pushHudScore();

    coachSay('โดนน้ำหวานแล้ว ลองเล็งหยดน้ำดีครั้งต่อไปนะ 🍭➡️💧', 'warn');

    return { good: false, scoreDelta: d };
  }

  // ---------- เมื่อเป้าหายไปเอง (expire) ----------
  function onExpire(ev) {
    // ตามนิยาม: ปล่อยเป้าหาย → ไม่เพิ่ม miss
    // แต่ให้ deck รับรู้ event (ใช้ tick ภารกิจ time / zone)
    if (ev && !ev.isGood) {
      deck.onJunk && deck.onJunk();
      syncDeck();
      pushQuest();
      pushHudScore({ reason: 'expire' });
    }
  }

  // ---------- tick รายวินาที ----------
  function onSec() {
    elapsedSec++;

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

    const g = (deck.getProgress && deck.getProgress('goals')) || [];
    const m = (deck.getProgress && deck.getProgress('mini'))  || [];

    // goal ชุดนี้ครบ → นับสะสมแล้วสุ่มชุดใหม่ (2 อัน)
    if (g.length > 0 && g.every(x => x.done)) {
      accGoalDone += g.length;
      deck.drawGoals && deck.drawGoals(2);
      pushQuest('Goal ใหม่มาแล้ว ลองดูว่าคราวนี้ต้องทำอะไร 💡');
      coachSay('ภารกิจหลักชุดหนึ่งสำเร็จแล้ว! ไปชุดถัดไปกันต่อ 🎯', 'happy');
    }

    // mini quest ชุดนี้ครบ → นับสะสมแล้วสุ่มชุดใหม่ (3 อัน)
    if (m.length > 0 && m.every(x => x.done)) {
      accMiniDone += m.length;
      deck.draw3 && deck.draw3();
      pushQuest('Mini quest ใหม่มาแล้ว ลองทำให้ครบดูนะ ✨');
      coachSay('Mini quest ผ่านครบชุดแล้ว เก่งมาก ๆ 🤩', 'happy');
    }

    // HUD อัปเดตทุกวินาที
    pushHudScore();
  }

  // ---------- จบเกม ----------
  let ended = false;
  function finish() {
    if (ended) return;
    ended = true;

    const g = (deck.getProgress && deck.getProgress('goals')) || [];
    const m = (deck.getProgress && deck.getProgress('mini'))  || [];

    const goalsTotal = accGoalDone + g.length;
    const goalsDone  = accGoalDone + g.filter(x => x.done).length;
    const miniTotal  = accMiniDone + m.length;
    const miniDone   = accMiniDone + m.filter(x => x.done).length;

    const greenTick    = deck.stats.greenTick | 0;
    const waterEnd     = waterPct;
    const waterZoneEnd = zoneFrom(waterPct);

    // ยิง hha:end พร้อมสรุป (ใช้ทำหน้า Summary)
    window.dispatchEvent(new CustomEvent('hha:end', {
      detail: {
        mode: 'Hydration',
        modeLabel: 'Hydration',
        difficulty: diff,
        score,
        misses,
        comboMax,
        duration: dur,
        greenTick,
        goalsCleared: goalsDone,
        goalsTotal,
        questsCleared: miniDone,
        questsTotal: miniTotal,
        waterStart,
        waterEnd,
        waterZoneEnd
      }
    }));

    // ยิง hha:score ปิดท้ายด้วยสถานะ ended
    pushHudScore({ ended: true });

    coachSay('จบโหมดน้ำสมดุลแล้ว มาดูสรุปว่าทำได้กี่ภารกิจนะ 🎉', 'happy');
  }

  // ---------- clock กลางจาก factory (นับเวลาถอยหลัง) ----------
  const onTime = (e) => {
    const sec = (e.detail && typeof e.detail.sec === 'number')
      ? e.detail.sec
      : (e.detail?.sec | 0);

    if (sec > 0) onSec();
    if (sec === 0) {
      finish();
      window.removeEventListener('hha:time', onTime);
    }
  };
  window.addEventListener('hha:time', onTime);

  // ---------- เรียก factoryBoot ให้สร้างเป้า / timer / hit-handler ----------
  const inst = await factoryBoot({
    difficulty: diff,
    duration:   dur,
    modeKey:    'hydration-vr',
    pools:      { good: [...GOOD, ...BONUS], bad: [...BAD] },
    goodRate:   0.60,
    powerups:   BONUS,
    powerRate:  0.10,
    powerEvery: 7,
    spawnStyle: 'pop',      // เป้าโผล่แล้วหายเอง (ไม่ตกลงมา)
    judge:     (ch, ctx) => judge(ch, ctx),
    onExpire
  });

  // แสดงเควสต์ + HUD แรกตอนเริ่ม
  pushQuest('เริ่มโหมดน้ำสมดุล เล็งเฉพาะน้ำดี 💧');
  pushHudScore();
  coachSay('พร้อมไหมเด็ก ป.5? เลือกแต่น้ำดีให้สมดุลกันนะ 💧🍉', 'happy');

  return inst;
}

export default { boot };
