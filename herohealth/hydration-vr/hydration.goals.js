// === /herohealth/hydration-vr/hydration.goals.js ===
// Goal หลักของโหมด Hydration
// ใช้ร่วมกับ MissionDeck (สุ่ม 2/10 อัน) และจัดลำดับง่าย → ยาก
// กลุ่ม "miss" (พลาดไม่เกิน…) จะถูกเรียงไปอยู่ท้ายสุด

import { mapHydrationState, normalizeHydrationDiff } from './hydration.state.js';

// template กลาง ใช้กำหนด threshold แยกตาม diff
const GOAL_TEMPLATES = [
  // ---------- กลุ่มคะแนน ----------
  {
    id: 'score-basic',
    group: 'score',
    tier: 1,
    thresholds: { easy: 800, normal: 1200, hard: 1600 },
    makeLabel: v => `คะแนน ${v}+`,
    check: (s, v) => s.score >= v
  },
  {
    id: 'score-middle',
    group: 'score',
    tier: 2,
    thresholds: { easy: 1200, normal: 1600, hard: 2200 },
    makeLabel: v => `คะแนน ${v}+`,
    check: (s, v) => s.score >= v
  },
  {
    id: 'score-high',
    group: 'score',
    tier: 3,
    thresholds: { easy: 1600, normal: 2200, hard: 2800 },
    makeLabel: v => `คะแนน ${v}+`,
    check: (s, v) => s.score >= v
  },

  // ---------- กลุ่ม combo ----------
  {
    id: 'combo-basic',
    group: 'combo',
    tier: 1,
    thresholds: { easy: 10, normal: 14, hard: 18 },
    makeLabel: v => `คอมโบ ≥ ${v}`,
    check: (s, v) => s.comboMax >= v
  },
  {
    id: 'combo-strong',
    group: 'combo',
    tier: 2,
    thresholds: { easy: 14, normal: 18, hard: 22 },
    makeLabel: v => `คอมโบ ≥ ${v}`,
    check: (s, v) => s.comboMax >= v
  },

  // ---------- กลุ่ม GREEN time ----------
  {
    id: 'green-basic',
    group: 'green',
    tier: 1,
    thresholds: { easy: 20, normal: 30, hard: 40 },
    makeLabel: v => `อยู่โซน GREEN รวม ≥ ${v}s`,
    check: (s, v) => s.green >= v
  },
  {
    id: 'green-strong',
    group: 'green',
    tier: 2,
    thresholds: { easy: 30, normal: 45, hard: 60 },
    makeLabel: v => `อยู่โซน GREEN รวม ≥ ${v}s`,
    check: (s, v) => s.green >= v
  },

  // ---------- กลุ่ม miss (ยากสุด ให้ไปท้ายสุด) ----------
  {
    id: 'miss-soft',
    group: 'miss',
    tier: 2,
    thresholds: { easy: 8, normal: 6, hard: 5 },
    makeLabel: v => `พลาดไม่เกิน ${v}`,
    check: (s, v) => s.miss <= v
  },
  {
    id: 'miss-mid',
    group: 'miss',
    tier: 3,
    thresholds: { easy: 6, normal: 5, hard: 4 },
    makeLabel: v => `พลาดไม่เกิน ${v}`,
    check: (s, v) => s.miss <= v
  },
  {
    id: 'miss-hard',
    group: 'miss',
    tier: 4,
    thresholds: { easy: 5, normal: 4, hard: 3 },
    makeLabel: v => `พลาดไม่เกิน ${v}`,
    check: (s, v) => s.miss <= v
  }
];

// คืน pool ของ goal 10 อัน ตาม diff ที่เลือก
export function hydrationGoalsFor(diffRaw = 'normal') {
  const diff = normalizeHydrationDiff(diffRaw);

  const items = GOAL_TEMPLATES.map(t => {
    const v = t.thresholds[diff];
    return {
      id: `${t.id}-${diff}`,
      group: t.group,         // ใช้จัดกลุ่ม / debug
      tier: t.tier,           // ใช้เรียงง่าย → ยาก
      label: t.makeLabel(v),  // ข้อความที่โชว์ใน HUD
      threshold: v,
      check(stateRaw) {       // ให้ MissionDeck เรียกเช็คว่า clear หรือยัง
        const s = mapHydrationState(stateRaw);
        return t.check(s, v);
      }
    };
  });

  // เรียงลำดับ:
  // 1) non-miss ก่อน (score/combo/green)
  // 2) ด้านในเรียงตาม tier จากน้อย → มาก (ง่าย → ยาก)
  // 3) miss-* ทั้งหมดตามหลังสุด และเรียงตาม tier เช่นกัน
  const nonMiss = items
    .filter(g => g.group !== 'miss')
    .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));

  const missOnly = items
    .filter(g => g.group === 'miss')
    .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));

  const pool = [...nonMiss, ...missOnly];

  // ใช้แค่ 10 อันแรกสำหรับสุ่ม (MissionDeck จะ active ทีละ 2)
  return pool.slice(0, 10);
}

export default { hydrationGoalsFor };
