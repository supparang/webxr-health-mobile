// DOM version — Good vs Junk
import factoryBoot from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate } from '../vr/quest-hud.js';
import { burstAtScreen, floatScoreScreen } from '../vr/ui-water.js'; // ใช้เอฟเฟกต์จอ

export async function boot(cfg = {}) {
  const dur = Number(cfg.duration || 60);
  const diff = String(cfg.difficulty || 'normal');

  // Pools (รวมพาวเวอร์ไว้ใน good ให้สุ่มแทรก)
  const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐','⭐','💎','🛡️'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];

  // State
  let score = 0, combo = 0, shield = 0;
  let goodCount = 0, avoidJunk = 0, hits = 0, misses = 0;
  let leftSec = dur;

  // Goal (โหมดนี้: เก็บของดี 30 + หลีกขยะ 10)
  const goal = { label: 'เก็บของดี 30 + หลีกขยะ 10', prog: 0, target: 40, cleared: false };
  function updateGoal() {
    goal.prog = Math.min(goal.target, goodCount + avoidJunk);
    goal.cleared = goal.prog >= goal.target;
  }

  // Mini quest deck
  const deck = new MissionDeck();
  deck.draw3();
  questHUDInit();
  function pushHUD(hint) {
    questHUDUpdate(deck, hint || '');
    updateGoal();
    window.dispatchEvent(new CustomEvent('hha:quest', {
      detail: {
        text: `Mini Quest — ${deck.getCurrent()?.label || 'กำลังสุ่ม…'}`,
        goal: { label: goal.label, prog: goal.prog, target: goal.target },
        mini: { label: deck.getCurrent()?.label || '-', prog: deck.getProgress()[deck.currentIndex]?.prog || 0, target: deck.getProgress()[deck.currentIndex]?.target || 1 }
      }
    }));
  }
  pushHUD('เริ่มภารกิจ');

  // จับเวลาที่เหลือ
  window.addEventListener('hha:time', e => { if (Number.isFinite(e?.detail?.sec)) leftSec = e.detail.sec; });

  // Auto-refill Mini quests เมื่อครบ 3 ใบแล้ว ยังมีเวลา
  function maybeRefillDeck() {
    if (deck.isCleared() && leftSec > 5) {
      deck.draw3();
      pushHUD('เควสต์ใหม่มาแล้ว!');
    }
  }

  // เอฟเฟกต์ช่วย
  function fxHit(x, y, good, txt) {
    burstAtScreen(x, y, { color: good ? '#22c55e' : '#ef4444', count: good ? 18 : 12 });
    floatScoreScreen(x, y, txt || (good ? '+10' : '-10'), good ? '#d1fae5' : '#fecaca');
  }

  // พาวเวอร์
  function firePower(kind) {
    window.dispatchEvent(new CustomEvent('hha:power', { detail: { kind } }));
  }

  // Judge
  function judgeChar(ch, ctx) {
    const isPower = (ch === '⭐' || ch === '💎' || ch === '🛡️');
    if (isPower) {
      if (ch === '⭐')  { firePower('star');  score += 40; hits++; fxHit(ctx.x, ctx.y, true, '+40 ⭐'); }
      if (ch === '💎')  { firePower('diamond'); score += 80; hits++; fxHit(ctx.x, ctx.y, true, '+80 💎'); }
      if (ch === '🛡️') { firePower('shield'); shield = Math.min(3, shield + 1); fxHit(ctx.x, ctx.y, true, '🛡️+1'); }
      combo = Math.min(9999, combo + 1);
      deck.updateScore(score); deck.updateCombo(combo); pushHUD(); maybeRefillDeck();
      return { good: true, scoreDelta: 0 };
    }

    if (ctx.isGood) {
      const val = 20 + combo * 2;
      score += val; combo++; hits++; goodCount++;
      deck.onGood(); deck.updateScore(score); deck.updateCombo(combo);
      fxHit(ctx.x, ctx.y, true, `+${val}`);
      pushHUD(); maybeRefillDeck();
      return { good: true, scoreDelta: val };
    } else {
      if (shield > 0) {
        shield--; fxHit(ctx.x, ctx.y, true, 'Shield!');
        deck.updateScore(score); deck.updateCombo(combo); pushHUD();
        return { good: true, scoreDelta: 0 };
      } else {
        combo = 0; score = Math.max(0, score - 15); misses++;
        fxHit(ctx.x, ctx.y, false, '-15');
        deck.updateScore(score); deck.updateCombo(combo); pushHUD();
        return { good: false, scoreDelta: -15 };
      }
    }
  }

  // Hook จากโรงงาน (ตีโดน)
  window.addEventListener('hha:hit-screen', e => {
    const d = e.detail || {};
    // เติมพิกัดให้ judge ใช้เอฟเฟกต์
    const res = judgeChar(d.char, { isGood: d.isGood, x: d.x, y: d.y });
    // สะท้อนคะแนนขึ้น HUD กลาง
    window.dispatchEvent(new CustomEvent('hha:score', { detail: { score, combo } }));
  });

  // หมดอายุ (หลบขยะ)
  window.addEventListener('hha:expired', e => {
    const d = e.detail || {};
    if (d && d.isGood === false) {
      avoidJunk++; deck.onJunk(); pushHUD(); maybeRefillDeck();
    }
  });

  // เดินเวลา (อัปเดต noMissTime และเช็คเติมเด็ค)
  const secTimer = setInterval(() => {
    deck.second(); pushHUD(); maybeRefillDeck();
    if (leftSec <= 0) clearInterval(secTimer);
  }, 1000);

  // จบเกม → สรุป
  window.addEventListener('hha:end', () => {
    updateGoal();
    const cleared = deck.isCleared() ? 3 : deck.getProgress().filter(x => x.done).length;
    window.dispatchEvent(new CustomEvent('hha:end', {
      detail: {
        mode: 'Good vs Junk',
        difficulty: diff,
        score,
        comboMax: deck.stats.comboMax,
        misses,
        hits,
        duration: dur,
        questsCleared: cleared,
        questsTotal: 3,
        goalCleared: goal.cleared
      }
    }));
  }, { once: true });

  // เริ่ม!
  return factoryBoot.boot({
    host: cfg.host,
    difficulty: diff,
    duration: dur,
    pools: { good: GOOD, bad: JUNK },
    goodRate: (diff === 'easy' ? 0.77 : diff === 'hard' ? 0.62 : 0.7),
    judge: (ch, ctx) => judgeChar(ch, { ...ctx, x: window.innerWidth/2, y: window.innerHeight/2 }), // fallback พิกัดกลาง
    onExpire: (info) => { /* ซ้ำกับ hha:expired แล้ว ไม่ต้องทำอะไรเพิ่ม */ }
  });
}
export default { boot };
