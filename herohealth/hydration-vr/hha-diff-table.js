// === /herohealth/vr/hha-diff-table.js ===
'use strict';

// ดึง config กลางของแต่ละโหมด
import { Difficulty as GoodJunkDifficulty } from '../vr-goodjunk/difficulty.js';
import { HydrationDifficulty } from '../hydration-vr/difficulty.js';

// helper เล็ก ๆ คำนวณ GOOD_RATIO / POWER_RATIO จาก typeWeights
function summarizeWeights (tw = {}) {
  const total = Object.values(tw).reduce((s, v) => s + (v || 0), 0) || 1;
  const good = (tw.good || 0) / total;
  const power =
    ((tw.star || 0) +
     (tw.diamond || 0) +
     (tw.shield || 0) +
     (tw.fire || 0) +
     (tw.gold || 0) +
     (tw.fever || 0)) / total;

  return { total, goodRatio: good, powerRatio: power };
}

// สร้าง engine row จาก difficulty style เดียวกับ goodjunk
function buildRowsFromDifficulty (DiffClass, modeKey) {
  const inst = new DiffClass();
  const rows = {};
  const LEVELS = ['easy', 'normal', 'hard'];

  for (const lv of LEVELS) {
    inst.set(lv);
    const d = inst.get() || {};
    const tw = d.typeWeights || {};
    const sum = summarizeWeights(tw);

    rows[lv] = {
      label: lv.toUpperCase(),
      engine: {
        MODE_KEY: modeKey,
        DIFF_KEY: lv,

        // main timing
        SPAWN_INTERVAL: d.rate ?? 900,
        ITEM_LIFETIME:  d.life ?? 2200,
        MAX_ACTIVE:     d.maxActive ?? 4,
        SIZE_FACTOR:    d.size ?? 1.0,

        TYPE_WEIGHTS:   tw,
        GOOD_RATIO:     sum.goodRatio,
        POWER_RATIO:    sum.powerRatio,

        FEVER_GAIN_HIT: d.feverGainHit ?? 6,
        FEVER_DECAY_SEC:d.feverDecaySec ?? 5,

        // สำหรับ engine บางตัวที่เคยใช้ชื่อเก่า
        MISSION_GOOD_TARGET: d.goals?.[0]?.min ?? 0
      },

      // ช่องเสริมสำหรับงานวิจัย / HUD
      quest: {
        greenTarget: d.greenTarget ?? null,
        missLimit:   d.missLimit ?? null
      },

      // เผื่อไว้สำหรับรายงานวิจัย (จะไม่ใช้ก็ได้)
      benchmark: {
        targetAccuracyPct: 0,
        targetMissionSuccessPct: 0,
        expectedAvgRTms: 0
      }
    };
  }

  return rows;
}

// ---- ตารางกลางของทุกโหมด ----
export const HHA_DIFF_TABLE = {
  // ใช้ Difficulty เดิมของ Good vs Junk
  goodjunk: buildRowsFromDifficulty(GoodJunkDifficulty, 'goodjunk'),

  // Hydration VR ใช้ HydrationDifficulty ตัวใหม่
  'hydration-vr': buildRowsFromDifficulty(HydrationDifficulty, 'hydration-vr')

  // ถ้ามีโหมดอื่น (plate, food-groups ฯลฯ) ก็ค่อยขยายเพิ่มลักษณะเดียวกัน
};

export default HHA_DIFF_TABLE;
