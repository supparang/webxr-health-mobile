// === /HeroHealth/modes/goodjunk.safe.js (Full Pack – FX + Quest + Coach, cleaned) ===
'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import Particles from '../vr/particles.js';
import {
  ensureFeverBar,
  setFever,
  setFeverActive,
  setShield
} from '../vr/ui-fever.js';
import { createGoodJunkQuest } from './goodjunk.quest.js';

const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'];
const STAR = '⭐', DIA = '💎', SHIELD_ICON = '🛡️', FIRE = '🔥';
const BONUS = [STAR, DIA, SHIELD_ICON, FIRE];

// ---- Coach helper (กันพูดถี่เกิน) ----
let lastCoachAt = 0;
function coach(text, minGap = 2300) {
  if (!text) return;
  const now = Date.now();
  if (now - lastCoachAt < minGap) return;
  lastCoachAt = now;
  try {
    window.dispatchEvent(new CustomEvent('hha:coach', { detail: { text } }));
  } catch (_) {}
}

// ป้องกัน hha:time listener ซ้อนหลายรอบเวลาเข้าโหมดซ้ำ
let timeHandler = null;

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal').toLowerCase();
  const dur  = Number(cfg.duration || 60);

  // Reset fever/shield HUD
  ensureFeverBar();
  setFever(0);
  setFeverActive(false);
  setShield(0);

  // Quest director (2 goals + 3 minis, auto-refill)
  const deck = createGoodJunkQuest(diff);
  deck.drawGoals(2);
  deck.draw3();

  function pushQuest(hint) {
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    window.dispatchEvent(new CustomEvent('quest:update', {
      detail: {
        goal: (goals.find(g => !g.done) || goals[0] || null),
        mini: (minis.find(m => !m.done) || minis[0] || null),
        goalsAll: goals,
        minisAll: minis,
        hint
      }
    }));
  }

  // Stats
  let score = 0, combo = 0, comboMax = 0, misses = 0;
  let star = 0, diamond = 0, shield = 0, fever = 0, feverActive = false;

  // Accumulators across waves
  let accMiniDone = 0, accGoalDone = 0;

  function mult() { return feverActive ? 2 : 1; }

  function gainFever(n) {
    fever = Math.max(0, Math.min(100, fever + n));
    setFever(fever);
    if (!feverActive && fever >= 100) {
      feverActive = true;
      setFeverActive(true);
      coach('FEVER MODE! แตะของดีรัว ๆ เพื่อเก็บคะแนนพิเศษ!', 3000);
    }
  }

  function decayFever(n) {
    const d = feverActive ? 10 : n;
    fever = Math.max(0, fever - d);
    setFever(fever);
    if (feverActive && fever <= 0) {
      feverActive = false;
      setFeverActive(false);
      coach('โหมดพิเศษจบแล้ว ลองสร้างคอมโบใหม่อีกครั้ง!', 3500);
    }
  }

  function syncDeck() {
    deck.updateScore(score);
    deck.updateCombo(combo);
    // extra stats for quest (⭐ / 💎)
    deck.stats.star    = star;
    deck.stats.diamond = diamond;
  }

  // ใช้ FX แบบ DOM overlay: floating score + burst
  function scoreFX(x, y, delta) {
    try {
      Particles.scorePop(x, y, (delta > 0 ? '+' : '') + delta, {
        good: delta >= 0
      });
      Particles.burstAt(x, y, {
        color: delta >= 0 ? '#22c55e' : '#f97316'
      });
    } catch (_) {}
  }

  function maybeCoachCombo() {
    if (combo === 3)  coach('คอมโบ 3 แล้ว เยี่ยมมาก! ลองต่อให้ถึง 5 ดูนะ');
    if (combo === 6)  coach('สุดยอด! คอมโบยาวมาก รักษาจังหวะให้ดี');
    if (combo === 10) coach('โปรโหมดแล้วแบบนี้! คงคอมโบให้เต็มเวลาให้ได้เลย!', 4000);
  }

  function judge(ch, ctx) {
    const x = ctx.clientX || ctx.cx || 0;
    const y = ctx.clientY || ctx.cy || 0;

    // ---------- Power-ups ----------
    if (ch === STAR) {
      const d = 40 * mult();
      score += d; star++;
      gainFever(10);
      deck.onGood(); combo++; comboMax = Math.max(comboMax, combo);
      syncDeck(); pushQuest();
      scoreFX(x, y, d);
      maybeCoachCombo();
      return { good: true, scoreDelta: d };
    }

    if (ch === DIA) {
      const d = 80 * mult();
      score += d; diamond++;
      gainFever(30);
      deck.onGood(); combo++; comboMax = Math.max(comboMax, combo);
      syncDeck(); pushQuest();
      scoreFX(x, y, d);
      maybeCoachCombo();
      return { good: true, scoreDelta: d };
    }

    if (ch === SHIELD_ICON) {
      shield = Math.min(3, shield + 1);
      setShield(shield);
      const d = 20;
      score += d;
      deck.onGood(); syncDeck(); pushQuest();
      scoreFX(x, y, d);
      coach('ได้เกราะป้องกันแล้ว ลองใช้ป้องกันตอนพลาดดูนะ', 4000);
      return { good: true, scoreDelta: 20 };
    }

    if (ch === FIRE) {
      feverActive = true;
      setFeverActive(true);
      fever = Math.max(fever, 60);
      setFever(fever);
      const d = 25;
      score += d;
      deck.onGood(); syncDeck(); pushQuest();
      scoreFX(x, y, d);
      coach('ไฟลุกแล้ว! เก็บของดีต่อเนื่องให้คะแนนพุ่งเลย!', 3500);
      return { good: true, scoreDelta: 25 };
    }

    // ---------- Normal Good / Junk ----------
    if (GOOD.includes(ch)) {
      const d = (16 + combo * 2) * mult();
      score += d;
      combo++;
      comboMax = Math.max(comboMax, combo);
      gainFever(7 + combo * 0.5);
      deck.onGood(); syncDeck(); pushQuest();
      scoreFX(x, y, d);
      maybeCoachCombo();
      return { good: true, scoreDelta: d };
    } else {
      // ใช้เกราะกันพลาด
      if (shield > 0) {
        shield--;
        setShield(shield);
        decayFever(6);
        syncDeck(); pushQuest();
        scoreFX(x, y, 0);
        coach('เกราะช่วยกันพลาดให้แล้ว ดูดี ๆ ก่อนแตะครั้งต่อไปนะ', 3500);
        return { good: false, scoreDelta: 0 };
      }
      const d = -12;
      score = Math.max(0, score + d);
      combo = 0;
      misses++;
      decayFever(16);
      deck.onJunk(); syncDeck(); pushQuest();
      scoreFX(x, y, d);
      if (misses === 1) coach('ไม่เป็นไร พลาดได้ ลองโฟกัสที่อาหารดีอย่างผัก ผลไม้ และนมดูนะ');
      else if (misses === 3) coach('เริ่มพลาดบ่อยแล้ว ลองชะลอแล้วค่อย ๆ เลือกของดีทีละชิ้น', 3500);
      return { good: false, scoreDelta: d };
    }
  }

  // *** ปล่อยของเสียหลุดจอ: ไม่เพิ่ม miss แต่ลด fever เบา ๆ ***
  function onExpire(ev) {
    if (!ev || ev.isGood) return;
    decayFever(6);
    syncDeck();
    pushQuest();
  }

  function onSec(sec) {
    if (sec > 0) {
      if (combo <= 0) decayFever(6);
      else           decayFever(2);

      deck.second();
      syncDeck();

      const goals = deck.getProgress('goals');
      const minis = deck.getProgress('mini');

      if (goals.length > 0 && goals.every(g => g.done)) {
        accGoalDone += goals.length;
        deck.drawGoals(2);
        pushQuest('Goal ใหม่');
        coach('ถึงเป้าหมายใหญ่ชุดหนึ่งแล้ว เก่งมาก! ลองดูชุดถัดไปต่อเลย', 4000);
      }
      if (minis.length > 0 && minis.every(m => m.done)) {
        accMiniDone += minis.length;
        deck.draw3();
        pushQuest('Mini ใหม่');
        coach('Mini quest ครบชุดแล้ว! ไปต่อภารกิจถัดไป!', 4000);
      }

      if (sec === 20) coach('เหลือ 20 วินาทีสุดท้าย เก็บคอมโบให้ได้เยอะที่สุด!', 5000);
      if (sec === 10) coach('10 วินาทีสุดท้าย ลุยให้สุดกำลังเลย!', 6000);
    }

    if (sec === 0) {
      const g = deck.getProgress('goals');
      const m = deck.getProgress('mini');

      const goalCleared  = g.length > 0 && g.every(x => x.done);
      const goalsTotal   = accGoalDone + g.length;
      const goalsCleared = accGoalDone + g.filter(x => x.done).length;
      const miniTotal    = accMiniDone + m.length;
      const miniCleared  = accMiniDone + m.filter(x => x.done).length;

      window.dispatchEvent(new CustomEvent('hha:end', {
        detail: {
          mode:        'Good vs Junk',
          difficulty:  diff,
          score,
          comboMax,
          misses,
          duration:    dur,
          goalCleared,
          goalsCleared,
          goalsTotal,
          questsCleared: miniCleared,
          questsTotal:   miniTotal
        }
      }));
    }
  }

  // ลงทะเบียน hha:time (ล้างตัวเก่าก่อนกันซ้อน)
  if (timeHandler) {
    window.removeEventListener('hha:time', timeHandler);
  }
  timeHandler = (e) => {
    const s = (e.detail?.sec | 0);
    if (s >= 0) onSec(s);
  };
  window.addEventListener('hha:time', timeHandler);

  // ---- start factory ----
  const ctrl = await factoryBoot({
    difficulty: diff,
    duration:   dur,
    pools:      { good: [...GOOD, ...BONUS], bad: [...JUNK] },
    goodRate:   0.62,
    powerups:   BONUS,
    powerRate:  0.1,
    powerEvery: 7,
    judge:      (ch, ctx) => judge(ch, ctx),
    onExpire
  });

  // เควสต์ชุดแรก
  pushQuest('เริ่ม');
  coach('เลือกเฉพาะอาหารดี เช่น ผัก ผลไม้ นม หลีกเลี่ยงของขยะที่มีน้ำตาลและไขมันสูงนะ');

  return ctrl;
}

export default { boot };