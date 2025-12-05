// === /herohealth/hydration-vr/hydration.safe.js ===
'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import Particles from '../vr/particles.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import * as HQ from './hydration.quest.js';

// 🧠 เพิ่มโค้ชเข้ามา
import CoachVR from './hydration.coach.js';

const GOOD = ['💧', '🥛', '🍉'];
const BAD  = ['🥤', '🧋', '🍺', '☕️'];
const STAR = '⭐';
const DIA  = '💎';
const SHIELD = '🛡️';
const FIRE = '🔥';
const BONUS = [STAR, DIA, SHIELD, FIRE];

function safeScorePop(x, y, text, opt) {
  if (Particles?.scorePop) Particles.scorePop(x, y, text, opt);
}
function safeBurstAt(x, y, opt) {
  if (Particles?.burstAt) Particles.burstAt(x, y, opt);
}

function getCreateHydrationQuest() {
  if (typeof HQ.createHydrationQuest === 'function') return HQ.createHydrationQuest;
  if (HQ.default?.createHydrationQuest) return HQ.default.createHydrationQuest;
  throw new Error('createHydrationQuest not found in hydration.quest.js');
}

export async function boot(cfg = {}) {
  const diffRaw = String(cfg.difficulty || 'normal').toLowerCase();
  const diff = ['easy', 'normal', 'hard'].includes(diffRaw) ? diffRaw : 'normal';

  let dur = Number(cfg.duration || 60);
  if (!Number.isFinite(dur) || dur <= 0) dur = 60;
  dur = Math.min(Math.max(dur, 20), 180);

  ensureFeverBar();
  setFever(0);
  setFeverActive(false);
  setShield(0);
  ensureWaterGauge();

  let waterPct = 50;
  const waterRes = setWaterGauge(waterPct);
  let waterZone = waterRes.zone || 'GREEN';
  const waterStart = waterPct;

  // ====== INIT COACH ======
  CoachVR.init();
  CoachVR.bounce('👋 สวัสดีจ้า! มาฝึกดื่มน้ำกันนะ 💧');
  setTimeout(() => CoachVR.bounce('ภารกิจแรกกำลังเริ่มเลย สู้ ๆ! 😄'), 2000);

  let deck;
  try {
    const factory = getCreateHydrationQuest();
    deck = factory(diff);
  } catch (err) {
    console.error('[Hydration] Quest init error', err);
    deck = { stats: {}, getProgress() { return []; } };
  }

  let score = 0, combo = 0, comboMax = 0, misses = 0;
  let fever = 0, feverActive = false, elapsedSec = 0;
  let accGoalDone = 0, accMiniDone = 0;

  function pushQuest(hint) {
    const goals = deck.getProgress('goals') || [];
    const minis = deck.getProgress('mini') || [];
    const goal = goals.find(g => !g.done) || goals[0] || null;
    const mini = minis.find(m => !m.done) || minis[0] || null;
    const z = zoneFrom(waterPct);

    // โค้ชพูด mission ใหม่
    if (hint?.includes('Goal')) {
      CoachVR.bounce(`💧 ภารกิจใหญ่ใหม่: ${goal?.label || '-'} ✨`);
    } else if (hint?.includes('Mini')) {
      CoachVR.bounce(`😋 เควสเล็กใหม่: ${mini?.label || '-'} สู้ ๆ!`);
    }

    window.dispatchEvent(new CustomEvent('quest:update', {
      detail: { goal, mini, zone: z, hint }
    }));
  }

  function pushHudScore(extra = {}) {
    window.dispatchEvent(new CustomEvent('hha:score', {
      detail: { mode: 'Hydration', score, combo, comboMax, misses, timeSec: elapsedSec, ...extra }
    }));
  }

  function addWater(n) {
    waterPct = Math.max(0, Math.min(100, waterPct + n));
    const res = setWaterGauge(waterPct);
    waterZone = res.zone;
  }

  function gainFever(n) {
    fever = Math.min(100, fever + n);
    setFever(fever);
    if (fever >= 100 && !feverActive) {
      feverActive = true;
      setFeverActive(true);
      CoachVR.bounce('🔥 เข้าสู่โหมดพลังน้ำสุดเฟี้ยว!');
    }
  }

  function judge(ch, ctx) {
    const x = ctx?.clientX ?? 0;
    const y = ctx?.clientY ?? 0;

    if (GOOD.includes(ch)) {
      const d = 15 + combo * 2;
      score += d; combo++; comboMax = Math.max(combo, comboMax);
      addWater(+6); gainFever(5);
      safeScorePop(x, y, `+${d}`, { good: true });
      pushHudScore();
      return { good: true };
    } else if (BAD.includes(ch)) {
      misses++; combo = 0; score -= 5; addWater(-6);
      safeScorePop(x, y, `-5`, { good: false });
      pushHudScore();
      return { good: false };
    } else {
      return { good: true };
    }
  }

  function onSec() {
    elapsedSec++;
    if (elapsedSec % 5 === 0) pushQuest();
    pushHudScore();
  }

  const inst = await factoryBoot({
    difficulty: diff,
    duration: dur,
    modeKey: 'hydration-vr',
    pools: { good: [...GOOD, ...BONUS], bad: [...BAD] },
    goodRate: 0.6,
    powerups: BONUS,
    powerRate: 0.1,
    powerEvery: 8,
    spawnStyle: 'pop',
    judge
  });

  setInterval(onSec, 1000);
  pushQuest('เริ่มโหมดน้ำสมดุล');
  pushHudScore();

  return inst;
}

export default { boot };