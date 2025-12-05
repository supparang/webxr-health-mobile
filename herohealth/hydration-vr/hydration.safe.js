// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration mode – น้ำสมดุล + Water Gauge + Fever + Quest (PC / Mobile / VR)

'use strict';

// engine กลาง
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import Particles from '../vr/particles.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';

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

// ✅ NAMED EXPORT ให้ชัดเจน
export async function boot(cfg = {}) {
  // ----- อ่าน difficulty + duration -----
  const diffRaw = String(cfg.difficulty || 'normal').toLowerCase();
  const diff = (diffRaw === 'easy' || diffRaw === 'hard' || diffRaw === 'normal')
    ? diffRaw : 'normal';

  let dur = Number(cfg.duration || 60);
  if (!Number.isFinite(dur) || dur <= 0) dur = 60;
  if (dur < 20)  dur = 20;
  if (dur > 180) dur = 180;

  // ----- HUD เริ่มต้น -----
  ensureFeverBar();
  setFever(0);
  setFeverActive(false);
  setShield(0);

  ensureWaterGauge();
  let waterPct = 50;
  const waterRes = setWaterGauge(waterPct);
  let waterZone  = waterRes.zone || 'GREEN';
  const waterStart = waterPct;

  // แจ้ง HUD / โค้ช ว่าเข้าโหมด Hydration แล้ว
  window.dispatchEvent(new CustomEvent('hha:mode', {
    detail: {
      mode: 'hydration',
      modeLabel: 'Hydration',
      difficulty: diff,
      duration: dur
    }
  }));

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

  // ✅ สุ่มภารกิจชุดแรกออกมา
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
        mode: 'hydration',
        modeLabel: 'Hydration',
        goal: goals.find(g => !g.done) || goals[0] || null,
        mini: minis.find(m => !m.done) || minis[0] || null,
        goalsAll: goals,
        minisAll: minis,
        hint: hint || `โซนน้ำ: ${z}`
      }
    }));
  }

  // ----- state หลัก -----
  let score       = 0;
  let combo       = 0;
  let comboMax    = 0;
  let misses      = 0;      // นับเฉพาะ “ยิงโดนน้ำหวาน / junk”
  let goodCount   = 0;      // water ดีที่เก็บได้
  let junkMiss    = 0;      // สำหรับใช้ใน deck (เท่ากับ misses)
  let star        = 0;
  let diamond     = 0;
  let shield      = 0;
  let fever       = 0;
  let feverActive = false;

  let tick        = 0;      // เวลาเล่นสะสม (วินาที)
  let greenTick   = 0;      // เวลาอยู่ในโซน GREEN

  function mult() { return feverActive ? 2 : 1; }

  function gainFever(n) {
    fever = Math.max(0, Math.min(100, fever + n));
    setFever(fever);
    if (!feverActive && fever >= 100) {
      feverActive = true;
      setFeverActive(true);
    }
  }

  function decayFever(n) {
    const d = feverActive ? 10 : n;
    fever = Math.max(0, fever - d);
    setFever(fever);
    if (feverActive && fever <= 0) {
      feverActive = false;
      setFeverActive(false);
    }
  }

  function addWater(n) {
    waterPct = Math.max(0, Math.min(100, waterPct + n));
    const res = setWaterGauge(waterPct);
    waterZone = res.zone;
    deck.stats.zone = waterZone;
  }

  function syncDeck() {
    if (!deck) return;
    const state = {
      score,
      combo,
      comboMax,
      goodCount,
      junkMiss,
      tick,
      greenTick
    };
    if (typeof deck.updateScore === 'function') deck.updateScore(score, state);
    if (typeof deck.updateCombo === 'function') deck.updateCombo(combo, state);
    deck.stats.greenTick = greenTick;
  }

  function scoreFX(x, y, val) {
    const label = (val > 0 ? '+' : '') + val;
    const good  = val >= 0;
    safeScorePop(x, y, label, { good });
    safeBurstAt(x, y, { color: good ? '#22c55e' : '#f97316' });
  }

  // ----- judge เมื่อยิง/แตะเป้า -----
  // กติกา miss ตามที่สั่ง:
  // - ยิงโดน GOOD / BONUS → ไม่เป็น miss
  // - ปล่อย GOOD / BAD ให้หายเอง → ไม่เป็น miss
  // - ยิงโดน BAD (น้ำหวาน ฯลฯ) เท่านั้น → miss++
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
      scoreFX(x, y, d);
      return { good: true, scoreDelta: d };
    }
    if (ch === DIA) {
      const d = 80 * mult();
      score += d; diamond++;
      gainFever(30);
      deck.onGood && deck.onGood();
      combo++; comboMax = Math.max(comboMax, combo);
      syncDeck(); pushQuest();
      scoreFX(x, y, d);
      return { good: true, scoreDelta: d };
    }
    if (ch === SHIELD) {
      shield = Math.min(3, shield + 1);
      setShield(shield);
      const d = 20;
      score += d;
      deck.onGood && deck.onGood();
      syncDeck(); pushQuest();
      scoreFX(x, y, d);
      return { good: true, scoreDelta: d };
    }
    if (ch === FIRE) {
      feverActive = true;
      setFeverActive(true);
      fever = Math.max(fever, 60);
      setFever(fever);
      const d = 25;
      score += d;
      deck.onGood && deck.onGood();
      syncDeck(); pushQuest();
      scoreFX(x, y, d);
      return { good: true, scoreDelta: d };
    }

    // ปกติ: GOOD / BAD
    if (GOOD.includes(ch)) {
      // 💧 น้ำดี → ไม่เป็น miss, เพิ่มคะแนน + น้ำ
      addWater(+8);
      const d = (14 + combo * 2) * mult();
      score += d;
      combo++;
      comboMax = Math.max(comboMax, combo);
      goodCount++;
      gainFever(6 + combo * 0.4);
      deck.onGood && deck.onGood();
      syncDeck(); pushQuest();
      scoreFX(x, y, d);
      return { good: true, scoreDelta: d };
    } else if (BAD.includes(ch)) {
      // แตะของไม่ดี → นับ miss
      if (shield > 0) {
        // กันได้ ไม่เสียคะแนน แต่ก็ถือว่า “พลาดน้ำหวาน” ในเชิงการเรียนรู้ไหม?
        // ตามโจทย์: ยิงโดน BAD ก็ยังถือว่า miss → เพิ่ม miss
        shield--;
        setShield(shield);
        misses++;
        junkMiss++;
        addWater(-4);
        decayFever(6);
        combo = 0;
        deck.onJunk && deck.onJunk();
        syncDeck(); pushQuest();
        scoreFX(x, y, 0);
        return { good: false, scoreDelta: 0 };
      }
      addWater(-8);
      const d = -10;
      score = Math.max(0, score + d);
      combo = 0;
      misses++;
      junkMiss++;
      decayFever(14);
      deck.onJunk && deck.onJunk();
      syncDeck(); pushQuest();
      scoreFX(x, y, d);
      return { good: false, scoreDelta: d };
    }

    // ตัวอื่นที่ไม่รู้จัก (กันไว้เฉย ๆ)
    return { good: false, scoreDelta: 0 };
  }

  // ----- เมื่อเป้าหายไปเอง (expire) -----
  function onExpire(/*ev*/) {
    // ❗ ตามสเปกใหม่: ไม่เพิ่ม miss ไม่ว่าของดีหรือของไม่ดี
    // แต่ยังบอก deck ได้ว่า “มีของหายไป” ถ้าอยากใช้ในอนาคต
    if (deck && typeof deck.onExpire === 'function') {
      deck.onExpire();
    }
    syncDeck();
    pushQuest();
  }

  // ----- tick รายวินาที -----
  function onSec() {
    tick++;

    const z = zoneFrom(waterPct);

    if (z === 'GREEN') {
      greenTick++;
      deck.stats.greenTick = greenTick;
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
      pushQuest('ภารกิจใหญ่ชุดใหม่!');
    }
    if (m.length > 0 && m.every(x => x.done)) {
      accMiniDone += m.length;
      deck.draw3 && deck.draw3();
      pushQuest('Mini ใหม่ ✨');
    }
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

    const waterEnd     = waterPct;
    const waterZoneEnd = zoneFrom(waterPct);

    window.dispatchEvent(new CustomEvent('hha:end', {
      detail: {
        mode: 'hydration',
        modeLabel: 'Hydration',
        difficulty: diff,
        score,
        misses,
        comboMax,
        duration: dur,
        tick,
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

  // แสดงเควสต์ตั้งแต่เริ่ม
  pushQuest('เริ่มโหมดน้ำสมดุล 💧');

  return inst;
}

// default export กันไว้ เผื่อมีที่ไหน import default
export default boot;
