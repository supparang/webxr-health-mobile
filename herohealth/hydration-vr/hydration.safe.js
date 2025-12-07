// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration mode – น้ำสมดุล + Water Gauge + Fever + Quest (PC / Mobile / VR)
// พร้อม countdown 3-2-1-GO ก่อนเริ่มเกม

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

// ---------- Countdown 3-2-1-GO ก่อนเริ่มเกม ----------
function showCountdown() {
  return new Promise((resolve) => {
    const doc = window.document;

    // ถ้ามีเลเยอร์เก่าอยู่แล้ว ลบก่อน
    const old = doc.getElementById('hha-countdown-layer');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    const layer = doc.createElement('div');
    layer.id = 'hha-countdown-layer';
    Object.assign(layer.style, {
      position: 'fixed',
      inset: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 700,
      background: 'rgba(15,23,42,0.55)',
      backdropFilter: 'blur(2px)',
      pointerEvents: 'none'
    });

    const label = doc.createElement('div');
    label.id = 'hha-countdown-label';
    Object.assign(label.style, {
      fontFamily:
        'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Thonburi",sans-serif',
      fontWeight: '800',
      fontSize: '64px',
      color: '#e5e7eb',
      textShadow: '0 0 30px rgba(15,23,42,0.95)',
      transition: 'transform .35s ease-out, opacity .35s ease-out',
      transform: 'scale(1)',
      opacity: '0'
    });

    layer.appendChild(label);
    doc.body.appendChild(layer);

    const seq = ['3', '2', '1', 'GO!'];
    let idx = 0;

    const coachSay = (msg) => {
      window.dispatchEvent(new CustomEvent('hha:coach', {
        detail: {
          text: msg,
          modeKey: 'hydration-vr'
        }
      }));
    };

    // โค้ชพูดก่อนเริ่มนับ
    coachSay('พร้อมยัง? จะเริ่มเล็งน้ำดีแล้วนะ 💧');

    const step = () => {
      const text = seq[idx];
      label.textContent = text;
      label.style.opacity = '1';
      label.style.transform = 'scale(1.0)';

      // ให้โค้ชพูดตอน "GO!"
      if (text === 'GO!') {
        coachSay('ลุยยย! เล็งน้ำดี แล้วหลบพวกน้ำหวานนะ 💪');
      }

      setTimeout(() => {
        label.style.opacity = '0';
        label.style.transform = 'scale(0.7)';
      }, 420);

      idx += 1;
      if (idx < seq.length) {
        setTimeout(step, 800);
      } else {
        setTimeout(() => {
          if (layer.parentNode) layer.parentNode.removeChild(layer);
          resolve();
        }, 650);
      }
    };

    step();
  });
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
    }
    applyFeverUI();
  }

  function decayFever(n) {
    const d = feverActive ? 10 : n;
    fever = Math.max(0, fever - d);
    if (feverActive && fever <= 0) {
      feverActive = false;
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

  function scoreFX(x, y, val, judgment) {
    const label = judgment || ((val > 0 ? '+' : '') + val);
    const good  = val >= 0;
    safeScorePop(x, y, label, { good });
    safeBurstAt(x, y, { color: good ? '#22c55e' : '#f97316' });
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
      scoreFX(x, y, d, combo >= 8 ? 'PERFECT' : 'GOOD');
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
      pushHudScore();
      return { good: false, scoreDelta: d };
    }
  }

  // ----- เมื่อเป้าหายไปเอง (expire) -----
  function onExpire(ev) {
    // ✅ ตอนนี้กำหนดว่า: ปล่อยเป้าหาย → ไม่เพิ่ม miss แต่ deck ยังรับ event ได้
    if (ev && !ev.isGood) {
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

  // ---------- รอ countdown 3-2-1-GO ก่อนเริ่ม spawn เป้า ----------
  await showCountdown();

  // ----- เรียก factoryBoot หลัง countdown เสร็จ -----
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

  // แสดงเควสต์ตั้งแต่เริ่ม + HUD แรก
  pushQuest('เริ่มโหมดน้ำสมดุล');
  pushHudScore();

  return inst;
}

export default { boot };
