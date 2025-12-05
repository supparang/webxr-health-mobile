// === /herohealth/hydration-vr/hydration.quest.js ===
// Deck ภารกิจสำหรับโหมด Hydration (ใช้ goals/minis ที่นิยามแยกไฟล์ไว้)

import { hydrationGoalsFor } from './hydration.goals.js';
import { hydrationMinisFor } from './hydration.minis.js';
import { mapHydrationState, normalizeHydrationDiff } from './hydration.state.js';

// สร้าง deck ภารกิจแบบง่าย ๆ (ไม่พึ่ง MissionDeck เดิมก็ได้)
export function createHydrationQuest(diffRaw) {
  const diff = normalizeHydrationDiff(diffRaw);

  const goalDefs = hydrationGoalsFor(diff);
  const miniDefs = hydrationMinisFor(diff);

  // state กลาง (ให้ safe.js ไปอัปเดตค่าเพิ่ม)
  const stats = {
    score:      0,
    combo:      0,
    comboMax:   0,
    goodCount:  0,
    junkMiss:   0,
    tick:       0,
    greenTick:  0,
    zone:       'GREEN'
  };

  const deck = {
    stats,
    _goals: [],
    _minis: [],

    _recalc() {
      const S = mapHydrationState(stats);

      this._goals = goalDefs.map(def => ({
        id:     def.id,
        label:  def.label,
        target: def.target,
        value:  def.prog(S),
        done:   !!def.check(S)
      }));

      this._minis = miniDefs.map(def => ({
        id:     def.id,
        label:  def.label,
        target: def.target,
        value:  def.prog(S),
        done:   !!def.check(S)
      }));
    },

    // ==== callback จาก hydration.safe.js ====
    updateScore(v) {
      stats.score = v | 0;
      this._recalc();
    },
    updateCombo(v) {
      v = v | 0;
      stats.combo = v;
      if (v > (stats.comboMax | 0)) stats.comboMax = v;
      this._recalc();
    },
    onGood() {
      stats.goodCount = (stats.goodCount | 0) + 1;
      this._recalc();
    },
    onJunk() {
      stats.junkMiss = (stats.junkMiss | 0) + 1;
      this._recalc();
    },
    second() {
      stats.tick = (stats.tick | 0) + 1;
      this._recalc();
    },

    // ==== API ให้ HUD ใช้ ====
    getProgress(kind) {
      if (kind === 'goals') return this._goals;
      if (kind === 'mini')  return this._minis;
      return [...this._goals, ...this._minis];
    },

    // ใน Hydration ใช้ goal ทั้งชุดอยู่แล้ว เลยให้เป็น no-op
    drawGoals(/* count */) {},
    draw3() {}
  };

  deck._recalc();
  return deck;
}

export default { createHydrationQuest };
