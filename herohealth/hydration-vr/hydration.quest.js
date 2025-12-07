// === /herohealth/hydration-vr/hydration.quest.js ===
// Mission Deck สำหรับ Hydration VR
// - สุ่ม Goal 2 ภารกิจ จาก pool (ประมาณ 10 แบบ)
// - สุ่ม Mini quest 3 ภารกิจ จาก pool (ประมาณ 15 แบบย่อยกว่า)
// - แยกเกณฑ์ตาม diff: easy / normal / hard
// - มีโค้ชมีอารมณ์ร่วม: เชียร์ / เตือน / ฉลอง

'use strict';

// ----- Helper ทั่วไป -----
function coach(text) {
  if (!text) return;
  window.dispatchEvent(
    new CustomEvent('hha:coach', {
      detail: { text, modeKey: 'hydration-vr' }
    })
  );
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ----- Template ภารกิจพื้นฐาน -----
// type:
//   - 'good'     : จำนวนยิงน้ำดีถูก
//   - 'greenSec' : อยู่ในโซน GREEN สะสม (deck.stats.greenTick)
//   - 'combo'    : combo สูงสุด
//   - 'maxMiss'  : รักษาจำนวนผิด (badCount) ไม่เกินเกณฑ์ (เงื่อนไขคงอยู่)
// note: labelTemplate ใส่ {target} ให้ระบบแทนค่า

const GOAL_TEMPLATES = [
  {
    id: 'good-amount-1',
    type: 'good',
    thresholds: {
      easy:   { target: 12, label: 'เก็บน้ำดีให้ครบ {target} ครั้ง' },
      normal: { target: 16, label: 'เก็บน้ำดีให้ครบ {target} ครั้ง' },
      hard:   { target: 20, label: 'เก็บน้ำดีให้ครบ {target} ครั้ง' }
    }
  },
  {
    id: 'good-amount-2',
    type: 'good',
    thresholds: {
      easy:   { target: 14, label: 'เก็บน้ำดีให้ครบ {target} ครั้ง' },
      normal: { target: 18, label: 'เก็บน้ำดีให้ครบ {target} ครั้ง' },
      hard:   { target: 22, label: 'เก็บน้ำดีให้ครบ {target} ครั้ง' }
    }
  },
  {
    id: 'green-sec-1',
    type: 'greenSec',
    thresholds: {
      easy:   { target: 15, label: 'อยู่ในโซนน้ำสมดุล (GREEN) รวม {target} วินาที' },
      normal: { target: 20, label: 'อยู่ในโซนน้ำสมดุล (GREEN) รวม {target} วินาที' },
      hard:   { target: 25, label: 'อยู่ในโซนน้ำสมดุล (GREEN) รวม {target} วินาที' }
    }
  },
  {
    id: 'combo-max-1',
    type: 'combo',
    thresholds: {
      easy:   { target: 4, label: 'ทำคอมโบให้ถึง x{target} อย่างน้อย 1 ครั้ง' },
      normal: { target: 6, label: 'ทำคอมโบให้ถึง x{target} อย่างน้อย 1 ครั้ง' },
      hard:   { target: 8, label: 'ทำคอมโบให้ถึง x{target} อย่างน้อย 1 ครั้ง' }
    }
  },
  {
    id: 'max-miss-1',
    type: 'maxMiss',
    thresholds: {
      easy:   { target: 6, label: 'ทั้งเกมพลาดไม่เกิน {target} ครั้ง' },
      normal: { target: 5, label: 'ทั้งเกมพลาดไม่เกิน {target} ครั้ง' },
      hard:   { target: 4, label: 'ทั้งเกมพลาดไม่เกิน {target} ครั้ง' }
    }
  },
  {
    id: 'max-miss-2',
    type: 'maxMiss',
    thresholds: {
      easy:   { target: 7, label: 'พลาดน้ำไม่ดีรวมไม่เกิน {target} แก้ว' },
      normal: { target: 6, label: 'พลาดน้ำไม่ดีรวมไม่เกิน {target} แก้ว' },
      hard:   { target: 5, label: 'พลาดน้ำไม่ดีรวมไม่เกิน {target} แก้ว' }
    }
  },
  {
    id: 'green-sec-2',
    type: 'greenSec',
    thresholds: {
      easy:   { target: 18, label: 'พยายามให้อยู่โซน GREEN นาน {target} วินาที' },
      normal: { target: 22, label: 'พยายามให้อยู่โซน GREEN นาน {target} วินาที' },
      hard:   { target: 28, label: 'พยายามให้อยู่โซน GREEN นาน {target} วินาที' }
    }
  },
  {
    id: 'good-amount-3',
    type: 'good',
    thresholds: {
      easy:   { target: 10, label: 'ยิงโดนน้ำดีติดกันรวม {target} ครั้ง' },
      normal: { target: 13, label: 'ยิงโดนน้ำดีติดกันรวม {target} ครั้ง' },
      hard:   { target: 16, label: 'ยิงโดนน้ำดีติดกันรวม {target} ครั้ง' }
    }
  },
  {
    id: 'combo-max-2',
    type: 'combo',
    thresholds: {
      easy:   { target: 5, label: 'ดันคอมโบให้ถึง x{target}' },
      normal: { target: 7, label: 'ดันคอมโบให้ถึง x{target}' },
      hard:   { target: 9, label: 'ดันคอมโบให้ถึง x{target}' }
    }
  },
  {
    id: 'green-sec-3',
    type: 'greenSec',
    thresholds: {
      easy:   { target: 12, label: 'อย่างน้อยอยู่โซน GREEN ต่อเนื่องรวม {target} วินาที' },
      normal: { target: 16, label: 'อย่างน้อยอยู่โซน GREEN ต่อเนื่องรวม {target} วินาที' },
      hard:   { target: 20, label: 'อย่างน้อยอยู่โซน GREEN ต่อเนื่องรวม {target} วินาที' }
    }
  }
];

// Mini quest จะเบากว่า เป้าต่ำกว่า (ใช้ type เดียวกัน)
const MINI_TEMPLATES = [
  {
    id: 'mini-good-1',
    type: 'good',
    thresholds: {
      easy:   { target: 6, label: 'เก็บน้ำดีอย่างน้อย {target} แก้ว' },
      normal: { target: 8, label: 'เก็บน้ำดีอย่างน้อย {target} แก้ว' },
      hard:   { target: 10, label: 'เก็บน้ำดีอย่างน้อย {target} แก้ว' }
    }
  },
  {
    id: 'mini-good-2',
    type: 'good',
    thresholds: {
      easy:   { target: 7, label: 'เล็งโดนน้ำดีสะสม {target} ครั้ง' },
      normal: { target: 9, label: 'เล็งโดนน้ำดีสะสม {target} ครั้ง' },
      hard:   { target: 11, label: 'เล็งโดนน้ำดีสะสม {target} ครั้ง' }
    }
  },
  {
    id: 'mini-green-1',
    type: 'greenSec',
    thresholds: {
      easy:   { target: 8, label: 'อยู่โซน GREEN รวม {target} วินาที' },
      normal: { target: 10, label: 'อยู่โซน GREEN รวม {target} วินาที' },
      hard:   { target: 12, label: 'อยู่โซน GREEN รวม {target} วินาที' }
    }
  },
  {
    id: 'mini-green-2',
    type: 'greenSec',
    thresholds: {
      easy:   { target: 10, label: 'พยายามรักษาโซน GREEN ให้ได้ {target} วินาที' },
      normal: { target: 12, label: 'พยายามรักษาโซน GREEN ให้ได้ {target} วินาที' },
      hard:   { target: 14, label: 'พยายามรักษาโซน GREEN ให้ได้ {target} วินาที' }
    }
  },
  {
    id: 'mini-combo-1',
    type: 'combo',
    thresholds: {
      easy:   { target: 3, label: 'ทำคอมโบให้ถึง x{target} สัก 1 ครั้ง' },
      normal: { target: 4, label: 'ทำคอมโบให้ถึง x{target} สัก 1 ครั้ง' },
      hard:   { target: 5, label: 'ทำคอมโบให้ถึง x{target} สัก 1 ครั้ง' }
    }
  },
  {
    id: 'mini-combo-2',
    type: 'combo',
    thresholds: {
      easy:   { target: 4, label: 'คอมโบสูงสุดให้ได้ x{target} ขึ้นไป' },
      normal: { target: 5, label: 'คอมโบสูงสุดให้ได้ x{target} ขึ้นไป' },
      hard:   { target: 6, label: 'คอมโบสูงสุดให้ได้ x{target} ขึ้นไป' }
    }
  },
  {
    id: 'mini-maxmiss-1',
    type: 'maxMiss',
    thresholds: {
      easy:   { target: 4, label: 'ทังเกมพลาดไม่เกิน {target} ครั้ง' },
      normal: { target: 3, label: 'ทังเกมพลาดไม่เกิน {target} ครั้ง' },
      hard:   { target: 2, label: 'ทังเกมพลาดไม่เกิน {target} ครั้ง' }
    }
  },
  {
    id: 'mini-maxmiss-2',
    type: 'maxMiss',
    thresholds: {
      easy:   { target: 5, label: 'ระวังน้ำหวาน พลาดไม่เกิน {target} แก้ว' },
      normal: { target: 4, label: 'ระวังน้ำหวาน พลาดไม่เกิน {target} แก้ว' },
      hard:   { target: 3, label: 'ระวังน้ำหวาน พลาดไม่เกิน {target} แก้ว' }
    }
  },
  {
    id: 'mini-green-3',
    type: 'greenSec',
    thresholds: {
      easy:   { target: 6, label: 'อยู่ GREEN ติด ๆ กันให้ได้ {target} วินาที' },
      normal: { target: 8, label: 'อยู่ GREEN ติด ๆ กันให้ได้ {target} วินาที' },
      hard:   { target: 10, label: 'อยู่ GREEN ติด ๆ กันให้ได้ {target} วินาที' }
    }
  },
  {
    id: 'mini-good-3',
    type: 'good',
    thresholds: {
      easy:   { target: 5, label: 'ยิงน้ำดีติดกัน 5 ครั้งโดยไม่โดนของหวาน' },
      normal: { target: 6, label: 'ยิงน้ำดีติดกัน 6 ครั้งโดยไม่โดนของหวาน' },
      hard:   { target: 7, label: 'ยิงน้ำดีติดกัน 7 ครั้งโดยไม่โดนของหวาน' }
    }
  },
  {
    id: 'mini-good-4',
    type: 'good',
    thresholds: {
      easy:   { target: 8, label: 'รวม ๆ แล้วเก็บน้ำดีให้ได้ {target} แก้ว' },
      normal: { target: 10, label: 'รวม ๆ แล้วเก็บน้ำดีให้ได้ {target} แก้ว' },
      hard:   { target: 12, label: 'รวม ๆ แล้วเก็บน้ำดีให้ได้ {target} แก้ว' }
    }
  },
  {
    id: 'mini-combo-3',
    type: 'combo',
    thresholds: {
      easy:   { target: 3, label: 'ให้คอมโบไม่ตกจนกว่าจะถึง x{target}' },
      normal: { target: 4, label: 'ให้คอมโบไม่ตกจนกว่าจะถึง x{target}' },
      hard:   { target: 5, label: 'ให้คอมโบไม่ตกจนกว่าจะถึง x{target}' }
    }
  },
  {
    id: 'mini-green-4',
    type: 'greenSec',
    thresholds: {
      easy:   { target: 7, label: 'อยู่ GREEN ได้นาน {target} วินาทีโดยรวม' },
      normal: { target: 9, label: 'อยู่ GREEN ได้นาน {target} วินาทีโดยรวม' },
      hard:   { target: 11, label: 'อยู่ GREEN ได้นาน {target} วินาทีโดยรวม' }
    }
  },
  {
    id: 'mini-maxmiss-3',
    type: 'maxMiss',
    thresholds: {
      easy:   { target: 4, label: 'ฝึกเลี่ยงน้ำหวาน พลาดไม่เกิน {target}' },
      normal: { target: 3, label: 'ฝึกเลี่ยงน้ำหวาน พลาดไม่เกิน {target}' },
      hard:   { target: 2, label: 'ฝึกเลี่ยงน้ำหวาน พลาดไม่เกิน {target}' }
    }
  },
  {
    id: 'mini-good-5',
    type: 'good',
    thresholds: {
      easy:   { target: 6, label: 'เก็บน้ำดีหมวด 💧/🥛 อย่างน้อย {target} ครั้ง' },
      normal: { target: 8, label: 'เก็บน้ำดีหมวด 💧/🥛 อย่างน้อย {target} ครั้ง' },
      hard:   { target: 10, label: 'เก็บน้ำดีหมวด 💧/🥛 อย่างน้อย {target} ครั้ง' }
    }
  }
];

// ----- สร้าง quest object จาก template + diff -----
function buildQuestFromTemplate(tpl, diff) {
  const cfg = tpl.thresholds[diff] || tpl.thresholds.normal;
  const label = cfg.label.replace('{target}', String(cfg.target));

  const base = {
    id: tpl.id,
    type: tpl.type,
    label,
    target: cfg.target,
    prog: 0,
    done: false,
    // สำหรับ maxMiss จะถือว่า "ผ่าน" ตั้งแต่เริ่ม จนกว่าจะเกินเป้า
    ok: tpl.type === 'maxMiss'
  };
  return base;
}

// ----- factory หลัก -----
export function createHydrationQuest(diffRaw = 'normal') {
  const diff = ['easy', 'normal', 'hard'].includes(diffRaw)
    ? diffRaw
    : 'normal';

  // state ภายใน deck
  const state = {
    diff,
    score: 0,
    combo: 0,
    bestCombo: 0,
    goodCount: 0,
    badCount: 0,
    goalsPool: shuffle(GOAL_TEMPLATES),
    minisPool: shuffle(MINI_TEMPLATES),
    goals: [],
    minis: [],
    stats: {
      greenTick: 0,
      zone: 'GREEN'
    }
  };

  // ----- core update ของแต่ละ quest -----
  function updateQuestProgress(q) {
    if (!q) return;
    switch (q.type) {
      case 'good':
        q.prog = Math.min(state.goodCount, q.target);
        if (!q.done && q.prog >= q.target) {
          q.done = true;
          coach('เยี่ยมมาก! เก็บน้ำดีได้ครบตามเป้าแล้ว 🎯');
        }
        break;

      case 'greenSec':
        q.prog = Math.min(state.stats.greenTick | 0, q.target);
        if (!q.done && q.prog >= q.target) {
          q.done = true;
          coach('สุดยอดเลย รักษาโซนน้ำสมดุลได้ตามเวลาที่ตั้งใจไว้แล้ว 💧👏');
        }
        break;

      case 'combo':
        q.prog = Math.min(state.bestCombo, q.target);
        if (!q.done && q.prog >= q.target) {
          q.done = true;
          coach('คอมโบโหดมาก! ถึง x' + q.target + ' แล้ว 🔥');
        }
        break;

      case 'maxMiss':
        // เงื่อนไข: ถ้ายังไม่เกิน target = ผ่านอยู่, ถ้าเกินแล้ว = ล้มเหลว
        if (state.badCount > q.target) {
          if (q.ok) {
            coach('แอบพลาดเกินเป้าแล้ว รอบหน้าลองเลี่ยงน้ำหวานให้มากกว่านี้นะ 😅');
          }
          q.ok = false;
          q.done = false;
          q.prog = 0;
        } else {
          q.ok = true;
          q.prog = q.target - state.badCount; // เหลือ margin เท่าไหร่
          q.done = true; // ถือว่าผ่านตราบเท่าที่ยังไม่เกิน
        }
        break;
    }
  }

  function updateAll() {
    state.goals.forEach(updateQuestProgress);
    state.minis.forEach(updateQuestProgress);
  }

  // ----- draw goals / minis -----
  function drawGoals(n = 2) {
    state.goals = [];
    const pool = state.goalsPool.slice();
    // ให้ task ประเภท maxMiss ถูกดันไปท้าย ๆ
    pool.sort((a, b) => {
      const ma = a.type === 'maxMiss' ? 1 : 0;
      const mb = b.type === 'maxMiss' ? 1 : 0;
      return ma - mb;
    });

    const chosen = pool.slice(0, Math.max(0, n));
    state.goals = chosen.map((tpl) => buildQuestFromTemplate(tpl, diff));
    updateAll();
    coach('ภารกิจหลักมาแล้ว ลองอ่านเป้าหมายว่าให้ทำอะไรบ้างนะ 💡');
  }

  function draw3() {
    state.minis = [];
    const pool = state.minisPool.slice();
    // mini ที่เป็น maxMiss ก็ไปท้ายเหมือนกัน
    pool.sort((a, b) => {
      const ma = a.type === 'maxMiss' ? 1 : 0;
      const mb = b.type === 'maxMiss' ? 1 : 0;
      return ma - mb;
    });

    const chosen = pool.slice(0, 3);
    state.minis = chosen.map((tpl) => buildQuestFromTemplate(tpl, diff));
    updateAll();
    coach('Mini quest มาเพิ่มแล้ว ลองเก็บให้ได้เยอะที่สุดเลย ✨');
  }

  // ----- API ที่ hydration.safe.js เรียก -----
  function updateScore(score) {
    state.score = score | 0;
  }

  function updateCombo(combo) {
    state.combo = combo | 0;
    if (state.combo > state.bestCombo) {
      state.bestCombo = state.combo;
    }
    updateAll();
  }

  function onGood() {
    state.goodCount += 1;
    updateAll();
  }

  function onJunk() {
    state.badCount += 1;
    // เตือนนิดหน่อยเวลาเริ่มพลาดเยอะในโหมดเด็ก ป.5
    if (state.badCount === 3) {
      coach('เริ่มพลาดเยอะแล้ว ระวังหลบน้ำหวานให้ดีนะ 👀');
    }
    updateAll();
  }

  function second() {
    // hydration.safe.js จะอัปเดต stats.greenTick / stats.zone ให้เอง
    updateAll();
    const allGoals = state.goals;
    const allMinis = state.minis;

    // ถ้าเป้าจบครบหมด → รอบต่อไปค่อยให้ drawGoals/draw3 ใหม่ (safe.js เป็นคนเรียก)
    if (allGoals.length && allGoals.every((g) => g.done)) {
      coach('Goal รอบนี้ครบแล้ว เดี๋ยวมีภารกิจใหม่ให้อีกนะ 🎉');
    }
    if (allMinis.length && allMinis.every((m) => m.done)) {
      coach('เก็บ Mini quest หมดชุดแล้ว เก่งมาก! 💫');
    }
  }

  function getProgress(kind) {
    if (kind === 'goals' || kind === 'goal') return clone(state.goals);
    if (kind === 'mini' || kind === 'minis') return clone(state.minis);
    return [];
  }

  // object ที่ส่งกลับไปให้ hydration.safe.js
  return {
    stats: state.stats,
    updateScore,
    updateCombo,
    onGood,
    onJunk,
    second,
    getProgress,
    drawGoals,
    draw3
  };
}

export default { createHydrationQuest };
