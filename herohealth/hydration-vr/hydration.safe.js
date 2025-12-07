// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration mode – น้ำสมดุล + Water Gauge + Fever + Quest (PC / Mobile / VR)

'use strict';

// engine กลาง
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';

// ✅ ใช้ Particles แบบ global (ไม่ import แล้ว)
const Particles =
  (window.GAME_MODULES && window.GAME_MODULES.Particles) ||
  window.Particles ||
  null;

// ✅ ใช้ FeverUI แบบ global จาก ui-fever.js (non-module)
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

// emoji
const GOOD = ['💧', '🥛', '🍉'];              // น้ำดี
const BAD  = ['🥤', '🧋', '🍺', '☕️'];       // น้ำหวาน / คาเฟอีน ฯลฯ

const STAR   = '⭐';
const DIA    = '💎';
const SHIELD = '🛡️';
const FIRE   = '🔥';
const BONUS  = [STAR, DIA, SHIELD, FIRE];

// helper กันไว้ ถ้า Particles ไม่มี
function safeScorePop(x, y, text, opt) {
  if (Particles && typeof Particles.scorePop === 'function') {
    Particles.scorePop(x, y, text, opt);
  }
}
function safeBurstAt(x, y, opt) {
  if (Particles && typeof Particles.burstAt === 'function') {
    Particles.burstAt(x, y, opt);
  }
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

export async function boot(cfg = {}) {
  // ----- อ่าน difficulty + duration -----
  const diffRaw = String(cfg.difficulty || 'normal').toLowerCase();
  const diff = (diffRaw === 'easy' || diffRaw === 'hard' || diffRaw === 'normal')
    ? diffRaw : 'normal';

  let dur = Number(cfg.duration || 60);
  if (!Number.isFinite(dur) || dur <= 0) dur = 60;
  if (dur < 20)  dur = 20;
  if (dur > 180) dur = 180;

  // ----- helper coach (ให้โค้ชพูด + ขยับ) -----
  function coach(text, mood = 'info') {
    if (!text) return;
    window.dispatchEvent(new CustomEvent('hha:coach', {
      detail: {
        modeKey: 'hydration-vr',
        text,
        mood     // เช่น "happy" | "warn" | "sad" | "fever" | "info"
      }
    }));
  }

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

  // ----- Quest Deck -----
  let deck;
  try {
    const factory = getCreateHydrationQuest();
    deck = factory(diff);
  } catch (err) {
    console.error('[Hydration] createHydrationQuest error', err);
    // ถ้า quest พัง ให้ใช้ deck ปลอมที่ไม่ทำอะไร เพื่อไม่ให้เกมล้ม
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

  // ✅ สุ่มภารกิจชุดแรกออกมา (MissionDeck จะสุ่มจาก goal 2/10 + mini 3/15 ตามที่ตั้งไว้)
  if (typeof deck.drawGoals === 'function') deck.drawGoals(2);
  if (typeof deck.draw3 === 'function')     deck.draw3();

  let accMiniDone = 0;
  let accGoalDone = 0;

  function pushQuest(hint) {
    if (!deck || typeof deck.getProgress !== 'function') return;

    const goals = deck.getProgress('goals') || [];
    const minis = deck.getProgress('mini')  || [];
    const z     = zoneFrom(waterPct);

    window.dispatchEvent(new CustomEvent('quest:update', {
      detail: {
        goal: goals.find(g => !g.done) || goals[0] || null,
        mini: minis.find(m => !m.done) || minis[0] || null,
        goalsAll: goals,
        minisAll: minis,
        hint: hint || `โซนน้ำ: ${z}`
      }
    }));

    if (hint === 'Goal ใหม่') {
      coach('ภารกิจหลักชุดใหม่มาแล้ว ลองอ่านที่ด้านขวาบนนะ ✨', 'info');
    } else if (hint === 'Mini ใหม่') {
      coach('Mini quest มาเพิ่มแล้ว เก็บน้ำให้ตรงเป้าเยอะ ๆ เลย 💧', 'happy');
    }
  }

  // ----- state หลัก -----
  let score       = 0;
  let combo       = 0;
  let comboMax    = 0;
  let misses      = 0;
  let star        = 0;
  let diamond     = 0;
  let shield      = 0;
  let fever       = 0;
  let feverActive = false;
  let elapsedSec  = 0;   // เวลาเล่นสะสม (นับขึ้น)

  function mult() { return feverActive ? 2 : 1; }

  function applyFeverUI() {
    FeverUI.setFever(fever);
    FeverUI.setFeverActive(feverActive);
    FeverUI.setShield(shield);
  }

  function gainFever(n) {
    fever = Math.max(0, Math.min(100, fever + n));
    if (!feverActive && fever >= 100) {
      feverActive = true;
      coach('เข้าสู่โหมด FEVER แล้ว ตีแก้วน้ำดีให้รัว ๆ เลย! 🔥', 'fever');
    }
    applyFeverUI();
  }

  function decayFever(n) {
    const d = feverActive ? 10 : n;
    fever = Math.max(0, fever - d);
    if (feverActive && fever <= 0) {
      feverActive = false;
      coach('โหมด FEVER หายไปแล้ว ค่อย ๆ เก็บเกจใหม่อีกครั้งนะ 💧', 'info');
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
        miss:       misses,        // เผื่อ HUD ใช้ชื่อ miss
        timeSec:    elapsedSec,
        waterPct,
        waterZone,
        ...extra
      }
    }));
  }

  // effect ตอนตีเป้า / พลาด
  function scoreFX(x, y, delta, judgment) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const j = judgment ? String(judgment).toUpperCase() : '';
    const isBad = (j === 'MISS' || j === 'LATE');

    // popup คะแนนตัวเลข ขยับไปข้าง ๆ นิดหน่อย
    if (delta !== 0) {
      const labelScore = (delta > 0 ? '+' : '') + delta;
      safeScorePop(x + 20, y - 6, labelScore, {
        kind: 'score',
        judgment: isBad ? 'MISS' : 'GOOD'
      });
    }

    // popup GOOD / MISS / PERFECT
    if (j) {
      safeScorePop(x, y - 4, j, {
        kind: 'judge',
        judgment: j
      });
    }

    // particle รอบเป้า
    const color =
      j === 'MISS' || j === 'LATE'
        ? '#f97316'
        : (j === 'PERFECT' ? '#facc15' : '#22c55e');

    safeBurstAt(x, y, { color, count: 14, radius: 60 });
  }

  // ----- judge เมื่อยิง/แตะเป้า -----
  function judge(ch, ctx) {
    const x = ctx?.clientX ?? ctx?.cx ?? 0;
    const y = ctx?.clientY ?? ctx?.cy ?? 0;

    // Power-ups
    if (ch === STAR) {
      const d = 40 * mult();
      score += d; star++;
      gainFever(10);
      deck.onGood && deck.onGood();
      combo++; comboMax = Math.max(comboMax, combo);
      syncDeck(); pushQuest();
      scoreFX(x, y, d, 'GOOD');
      coach('ได้ดาวเพิ่มคะแนน ดื่มน้ำดีต่อเนื่องสุด ๆ ✨', 'happy');
      pushHudScore();
      return { good: true, scoreDelta: d };
    }
    if (ch === DIA) {
      const d = 80 * mult();
      score += d; diamond++;
      gainFever(30);
      deck.onGood && deck.onGood();
      combo++; comboMax = Math.max(comboMax, combo);
      syncDeck(); pushQuest();
      scoreFX(x, y, d, 'PERFECT');
      coach('เพชรน้ำดี! ยิงได้เป๊ะมากเลย 💎', 'happy');
      pushHudScore();
      return { good: true, scoreDelta: d };
    }
    if (ch === SHIELD) {
      shield = Math.min(3, shield + 1);
      FeverUI.setShield(shield);
      const d = 20;
      score += d;
      deck.onGood && deck.onGood();
      syncDeck(); pushQuest();
      scoreFX(x, y, d, 'GOOD');
      coach('ได้เกราะกันน้ำหวานเพิ่มแล้ว ใช้ให้คุ้มนะ 🛡️', 'info');
      pushHudScore();
      return { good: true, scoreDelta: d };
    }
    if (ch === FIRE) {
      feverActive = true;
      fever = Math.max(fever, 60);
      applyFeverUI();
      const d = 25;
      score += d;
      deck.onGood && deck.onGood();
      syncDeck(); pushQuest();
      scoreFX(x, y, d, 'FEVER');
      coach('ไฟมาแล้ว! ช่วงนี้คะแนนคูณสอง เก็บให้เต็มที่ 🔥', 'fever');
      pushHudScore();
      return { good: true, scoreDelta: d };
    }

    // ปกติ: GOOD / BAD
    if (GOOD.includes(ch)) {
      // ยิงโดนน้ำดี → ไม่เป็น miss
      addWater(+8);
      const d = (14 + combo * 2) * mult();
      score += d;
      combo++;
      comboMax = Math.max(comboMax, combo);
      gainFever(6 + combo * 0.4);
      deck.onGood && deck.onGood();
      syncDeck(); pushQuest();

      const judg = combo >= 8 ? 'PERFECT' : 'GOOD';
      scoreFX(x, y, d, judg);

      if (combo === 1) {
        coach('เยี่ยม! แก้วนี้คือน้ำดี ดื่มถูกทางแล้ว 💧', 'happy');
      } else if (combo === 5) {
        coach('คอมโบ x5 แล้ว เก่งมากๆ เลย รักษาจังหวะนี้ไว้นะ ✨', 'happy');
      } else if (combo === 10) {
        coach('คอมโบสิบ! ระดับโปรดื่มน้ำเลยแบบนี้ 💪', 'wow');
      }

      pushHudScore();
      return { good: true, scoreDelta: d };
    } else {
      // ยิงโดนน้ำไม่ดี (junk)
      if (shield > 0) {
        // มี shield → กัน miss ให้
        shield--;
        FeverUI.setShield(shield);
        addWater(-4);
        decayFever(6);
        syncDeck(); pushQuest();
        scoreFX(x, y, 0, 'BLOCK');
        coach('เกราะช่วยกันน้ำหวานไว้ทันพอดี รอบหน้าลองเล็งแก้วน้ำดีนะ 🛡️', 'info');
        pushHudScore();
        return { good: false, scoreDelta: 0 };
      }
      // 👉 เคสนับเป็น miss จริง
      addWater(-8);
      const d = -10;
      score = Math.max(0, score + d);
      combo = 0;
      misses++;
      decayFever(14);
      deck.onJunk && deck.onJunk();
      syncDeck(); pushQuest();
      scoreFX(x, y, d, 'MISS');
      coach('โอ๊ย น้ำหวานเข้าตัวแล้ว 1 แก้ว ระวังแก้วต่อไปให้ดีนะ 🧃', 'warn');
      pushHudScore();
      return { good: false, scoreDelta: d };
    }
  }

  // ----- เมื่อเป้าหายไปเอง (expire) -----
  function onExpire(ev) {
    // ตอนนี้: ปล่อยเป้าหาย → ไม่เพิ่ม miss แต่แจ้ง deck และโชว์ LATE ถ้าเป็นน้ำดี
    if (!ev) return;

    const x = ev.cx ?? ev.clientX ?? 0;
    const y = ev.cy ?? ev.clientY ?? 0;

    if (ev.isGood) {
      deck.onJunk && deck.onJunk(); // นับว่าเสียโอกาสน้ำดี
      syncDeck();
      scoreFX(x, y, 0, 'LATE');
      coach('ช้าไปนิดเดียว แก้วนั้นคือน้ำดีเลยนะ ลองเล็งให้ทันเวลามากขึ้น 😊', 'info');
      pushQuest();
      pushHudScore({ reason: 'expire-good' });
    } else {
      // เป้ำน้ำหวานหายไปเอง → ถือว่าโชคดี ไม่ทำอะไรเพิ่ม
      deck.onJunk && deck.onJunk();
      syncDeck();
      pushQuest();
      pushHudScore({ reason: 'expire' });
    }
  }

  // ----- tick รายวินาที -----
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

    if (g.length > 0 && g.every(x => x.done)) {
      accGoalDone += g.length;
      deck.drawGoals && deck.drawGoals(2);
      pushQuest('Goal ใหม่');
    }
    if (m.length > 0 && m.every(x => x.done)) {
      accMiniDone += m.length;
      deck.draw3 && deck.draw3();
      pushQuest('Mini ใหม่');
    }

    // อัปเดต HUD ทุกวินาที
    pushHudScore();
  }

  // ----- จบเกม -----
  let ended = false;
  function finish() {
    if (ended) return;
    ended = true;

    const g = (deck.getProgress && deck.getProgress('goals')) || [];
    const m = (deck.getProgress && deck.getProgress('mini'))  || [];

    const goalCleared = g.length > 0 && g.every(x => x.done);

    const goalsTotal = accGoalDone + g.length;
    const goalsDone  = accGoalDone + g.filter(x => x.done).length;
    const miniTotal  = accMiniDone + m.length;
    const miniDone   = accMiniDone + m.filter(x => x.done).length;

    const greenTick    = deck.stats.greenTick | 0;
    const waterEnd     = waterPct;
    const waterZoneEnd = zoneFrom(waterPct);

    // ยิง hha:end พร้อมสรุป
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
        goalCleared,
        goalsCleared: goalsDone,
        goalsTotal,
        questsCleared: miniDone,
        questsTotal: miniTotal,
        waterStart,
        waterEnd,
        waterZoneEnd
      }
    }));

    coach(
      `จบเกมแล้ว! คะแนน ${score} แต้ม เก็บน้ำให้สมดุลได้ดีมากเลย 🎉`,
      'happy'
    );

    // ยิง hha:score ปิดท้ายด้วยสถานะ ended
    pushHudScore({ ended: true });
  }

  // clock กลางจาก factory (นับเวลาถอยหลัง)
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

  // ----- เรียก factoryBoot -----
  const inst = await factoryBoot({
    difficulty: diff,
    duration:   dur,
    modeKey:    'hydration-vr',
    pools:      { good: [...GOOD, ...BONUS], bad: [...BAD] },
    goodRate:   0.60,
    powerups:   BONUS,
    powerRate:  0.10,
    powerEvery: 7,
    spawnStyle: 'pop',      // ให้เป้าโผล่แล้วหายเองอัตโนมัติ
    judge:     (ch, ctx) => judge(ch, ctx),
    onExpire
  });

  // แสดงเควสต์ตั้งแต่เริ่ม + HUD แรก + โค้ชเกริ่น
  coach('พร้อมดื่มน้ำดีให้สมดุลทั้งเกมไหม เล็งแก้วน้ำดีให้ตรงวงเล็งนะ 💧', 'intro');
  pushQuest('เริ่มโหมดน้ำสมดุล');
  pushHudScore();

  return inst;
}

export default { boot };
