// === /herohealth/hydration-vr/hydration.minis.js ===
// Mini quest ของ Hydration – ใช้สุ่ม 3/15
// กลุ่ม “พลาดไม่เกิน …” จะถูกจัดให้ยากสุดและอยู่ท้าย pool

import { mapHydrationState, normalizeHydrationDiff } from './hydration.state.js';

const MINI_TEMPLATES = [
  // ---------- คะแนนย่อย ----------
  {
    id: 'm-score-1',
    group: 'score',
    tier: 1,
    thresholds: { easy: 600, normal: 900, hard: 1200 },
    makeLabel: v => `เก็บคะแนนอย่างน้อย ${v}+`,
    check: (s, v) => s.score >= v
  },
  {
    id: 'm-score-2',
    group: 'score',
    tier: 2,
    thresholds: { easy: 900, normal: 1300, hard: 1700 },
    makeLabel: v => `เก็บคะแนนอย่างน้อย ${v}+`,
    check: (s, v) => s.score >= v
  },
  {
    id: 'm-score-3',
    group: 'score',
    tier: 3,
    thresholds: { easy: 1300, normal: 1800, hard: 2400 },
    makeLabel: v => `เก็บคะแนนอย่างน้อย ${v}+`,
    check: (s, v) => s.score >= v
  },

  // ---------- combo / สายคอมโบ ----------
  {
    id: 'm-combo-1',
    group: 'combo',
    tier: 1,
    thresholds: { easy: 8, normal: 10, hard: 12 },
    makeLabel: v => `ทำคอมโบต่อเนื่อง ≥ ${v}`,
    check: (s, v) => s.comboMax >= v
  },
  {
    id: 'm-combo-2',
    group: 'combo',
    tier: 2,
    thresholds: { easy: 12, normal: 15, hard: 18 },
    makeLabel: v => `ทำคอมโบต่อเนื่อง ≥ ${v}`,
    check: (s, v) => s.comboMax >= v
  },

  // ---------- GREEN time ย่อย ----------
  {
    id: 'm-green-1',
    group: 'green',
    tier: 1,
    thresholds: { easy: 15, normal: 20, hard: 25 },
    makeLabel: v => `รักษาโซน GREEN รวม ≥ ${v}s`,
    check: (s, v) => s.green >= v
  },
  {
    id: 'm-green-2',
    group: 'green',
    tier: 2,
    thresholds: { easy: 25, normal: 35, hard: 45 },
    makeLabel: v => `รักษาโซน GREEN รวม ≥ ${v}s`,
    check: (s, v) => s.green >= v
  },

  // ---------- ภารกิจยิงน้ำดี ----------
  {
    id: 'm-good-1',
    group: 'good',
    tier: 1,
    thresholds: { easy: 18, normal: 24, hard: 30 },
    makeLabel: v => `ยิงโดนน้ำดีอย่างน้อย ${v} ครั้ง`,
    check: (s, v) => s.good >= v
  },
  {
    id: 'm-good-2',
    group: 'good',
    tier: 2,
    thresholds: { easy: 24, normal: 32, hard: 40 },
    makeLabel: v => `ยิงโดนน้ำดีอย่างน้อย ${v} ครั้ง`,
    check: (s, v) => s.good >= v
  },

  // ---------- ภารกิจเวลาเล่น ----------
  {
    id: 'm-time-1',
    group: 'time',
    tier: 1,
    thresholds: { easy: 30, normal: 40, hard: 50 },
    makeLabel: v => `เล่นไปอย่างน้อย ${v}s`,
    check: (s, v) => s.tick >= v
  },
  {
    id: 'm-time-2',
    group: 'time',
    tier: 2,
    thresholds: { easy: 45, normal: 60, hard: 75 },
    makeLabel: v => `เล่นไปอย่างน้อย ${v}s`,
    check: (s, v) => s.tick >= v
  },

  // ---------- กลุ่ม miss (ยากสุด – อยู่ท้าย) ----------
  {
    id: 'm-miss-soft',
    group: 'miss',
    tier: 2,
    thresholds: { easy: 10, normal: 8, hard: 6 },
    makeLabel: v => `ทั้งเกมพลาดไม่เกิน ${v}`,
    check: (s, v) => s.miss <= v
  },
  {
    id: 'm-miss-mid',
    group: 'miss',
    tier: 3,
    thresholds: { easy: 8, normal: 6, hard: 4 },
    makeLabel: v => `ทั้งเกมพลาดไม่เกิน ${v}`,
    check: (s, v) => s.miss <= v
  },
  {
    id: 'm-miss-hard',
    group: 'miss',
    tier: 4,
    thresholds: { easy: 6, normal: 5, hard: 3 },
    makeLabel: v => `ทั้งเกมพลาดไม่เกิน ${v}`,
    check: (s, v) => s.miss <= v
  }
];

export function hydrationMinisFor(diffRaw = 'normal') {
  const diff = normalizeHydrationDiff(diffRaw);

  const items = MINI_TEMPLATES.map(t => {
    const v = t.thresholds[diff];
    return {
      id: `${t.id}-${diff}`,
      group: t.group,
      tier: t.tier,
      label: t.makeLabel(v),
      threshold: v,
      check(stateRaw) {
        const s = mapHydrationState(stateRaw);
        return t.check(s, v);
      }
    };
  });

  // non-miss ก่อน, miss ท้ายสุด, เรียงตาม tier เพื่อให้ง่าย → ยาก
  const nonMiss = items
    .filter(m => m.group !== 'miss')
    .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));

  const missOnly = items
    .filter(m => m.group === 'miss')
    .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));

  const pool = [...nonMiss, ...missOnly];

  // ใช้ 15 อันแรกสำหรับสุ่ม (MissionDeck จะแอคทีฟทีละ 3)
  return pool.slice(0, 15);
}

export default { hydrationMinisFor };
