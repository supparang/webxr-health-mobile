// === /herohealth/vr-groups/quest-manager.js ===
// Quest Manager for Food Groups VR
// Production Ready 2025-12-05

(function (ns) {
  'use strict';

  // --------------------------------------------------
  // Goal 10 แบบ แบ่งระดับง่าย / ปกติ / ยาก
  // --------------------------------------------------
  const GOALS = {
    easy: [
      { id: 'E1', label: 'ยิงหมู่ 1 ให้ครบ', targetGroup: 1, target: 4 },
      { id: 'E2', label: 'ยิงหมู่ 2 ให้ครบ', targetGroup: 2, target: 4 },
      { id: 'E3', label: 'ยิงหมู่ 3 ให้ครบ', targetGroup: 3, target: 4 },
      { id: 'E4', label: 'ยิงเฉพาะของดี',   targetGroup: 'good', target: 6 },
      { id: 'E5', label: 'หลีกเลี่ยงของไม่ดี', targetGroup: 'bad', target: 0 }
    ],
    normal: [
      { id: 'N1', label: 'ยิงหมู่ 4 ให้ครบ', targetGroup: 4, target: 5 },
      { id: 'N2', label: 'ยิงหมู่ 5 ให้ครบ', targetGroup: 5, target: 5 },
      { id: 'N3', label: 'ยิงหมู่ 1 + หมู่ 2', targetGroup: [1,2], target: 7 },
      { id: 'N4', label: 'ยิงผลไม้หมู่ 3', targetGroup: 3, target: 8 },
      { id: 'N5', label: 'ยิงโปรตีนหมู่ 4', targetGroup: 4, target: 8 }
    ],
    hard: [
      { id: 'H1', label: 'ยิงให้ครบ 3 หมู่', targetGroup: [1,2,3], target: 12 },
      { id: 'H2', label: 'ยิงหมู่ 4 + 5', targetGroup: [4,5], target: 12 },
      { id: 'H3', label: 'ยิงเฉพาะของดี (มากกว่า 10)', targetGroup: 'good', target: 12 },
      { id: 'H4', label: 'ห้ามโดนของไม่ดี', targetGroup: 'bad', target: 0 },
      { id: 'H5', label: 'ยิงครบ 15 ชิ้น', targetGroup: 'any', target: 15 }
    ]
  };

  // --------------------------------------------------
  // Mini Quest 15 แบบ แบ่งระดับง่าย / ปกติ / ยาก
  // --------------------------------------------------
  const MINIS = {
    easy: [
      { id: 'ME1', label: 'ยิงหมู่ 1 จำนวน 2 ชิ้น', targetGroup: 1, target: 2 },
      { id: 'ME2', label: 'ยิงหมู่ 2 จำนวน 2 ชิ้น', targetGroup: 2, target: 2 },
      { id: 'ME3', label: 'ยิงหมู่ 3 จำนวน 2 ชิ้น', targetGroup: 3, target: 2 },
      { id: 'ME4', label: 'ยิงเฉพาะของดี 3 ชิ้น', targetGroup: 'good', target: 3 },
      { id: 'ME5', label: 'อย่าพลาดเกิน 1 ครั้ง', targetGroup: 'any', target: 3, noMiss: true }
    ],
    normal: [
      { id: 'MN1', label: 'ยิงหมู่ 4 จำนวน 3 ชิ้น', targetGroup: 4, target: 3 },
      { id: 'MN2', label: 'ยิงหมู่ 5 จำนวน 3 ชิ้น', targetGroup: 5, target: 3 },
      { id: 'MN3', label: 'ยิงหมู่ผัก + ผลไม้', targetGroup: [2,3], target: 5 },
      { id: 'MN4', label: 'ยิงเฉพาะโปรตีน', targetGroup: 4, target: 5 },
      { id: 'MN5', label: 'ยิงของดี 5 ชิ้น', targetGroup: 'good', target: 5 }
    ],
    hard: [
      { id: 'MH1', label: 'ยิงให้ครบทุกหมู่ (1–5)', targetGroup: [1,2,3,4,5], target: 8 },
      { id: 'MH2', label: 'ยิงเฉพาะหมู่ 1–3', targetGroup: [1,2,3], target: 8 },
      { id: 'MH3', label: 'อย่าพลาดเลย 0 ครั้ง', targetGroup: 'any', target: 5, noMiss: true },
      { id: 'MH4', label: 'ยิงของดี 10 ชิ้น', targetGroup: 'good', target: 10 },
      { id: 'MH5', label: 'ยิงให้ได้ต่อเนื่อง 6 ครั้ง', targetGroup: 'any', target: 6, combo: true }
    ]
  };

  // --------------------------------------------------
  // Helper
  // --------------------------------------------------
  function pick(set, n) {
    const arr = [...set];
    const out = [];
    while (arr.length && out.length < n) {
      const i = Math.floor(Math.random() * arr.length);
      out.push(arr.splice(i, 1)[0]);
    }
    return out;
  }

  function match(targetGroup, food) {
    if (!food) return false;

    if (targetGroup === 'any') return true;
    if (targetGroup === 'good') return food.isGood === true;
    if (targetGroup === 'bad') return food.isGood === false;

    if (Array.isArray(targetGroup)) {
      return targetGroup.includes(food.group);
    }
    return food.group === targetGroup;
  }

  // --------------------------------------------------
  // Quest Manager Class
  // --------------------------------------------------
  class FoodGroupsQuestManager {
    constructor(diff = 'normal') {
      this.diff = diff;
      this.goals = pick(GOALS[diff], 1);       // เลือก Goal 1 อัน
      this.minis = pick(MINIS[diff], 2);       // เลือก Mini quest 2 อัน

      // progress
      this.goalProg = 0;
      this.miniProg = Array(this.minis.length).fill(0);

      this.goalCleared = false;
      this.miniCleared = this.minis.map(()=>false);

      this.onUpdate = null; // callback → GameEngine.js
    }

    // ---------- เริ่มใหม่ ----------
    reset() {
      this.goalProg = 0;
      this.miniProg = Array(this.minis.length).fill(0);
      this.goalCleared = false;
      this.miniCleared = this.minis.map(()=>false);
    }

    // ---------- ตรวจ hit ----------
    onHit(food, combo, missCount) {
      if (!food) return;

      // ---- Goal ----
      const goal = this.goals[0];
      if (!this.goalCleared && match(goal.targetGroup, food)) {
        this.goalProg++;
        if (this.goalProg >= goal.target) {
          this.goalCleared = true;
        }
      }

      // ---- Mini quests ----
      this.minis.forEach((mq, i) => {
        if (this.miniCleared[i]) return;

        // เงื่อนไขพิเศษ
        if (mq.noMiss && missCount > 0) return;
        if (mq.combo && combo < this.miniProg[i] + 1) return;

        if (match(mq.targetGroup, food)) {
          this.miniProg[i]++;
          if (this.miniProg[i] >= mq.target) {
            this.miniCleared[i] = true;
          }
        }
      });

      this.emitUpdate();
    }

    emitUpdate() {
      if (!this.onUpdate) return;

      const goal = this.goals[0];

      this.onUpdate({
        goal: {
          label: goal.label,
          prog: this.goalProg,
          target: goal.target
        },
        minis: this.minis.map((mq, i) => ({
          label: mq.label,
          prog: this.miniProg[i],
          target: mq.target,
          cleared: this.miniCleared[i]
        }))
      });
    }
  }

  // --------------------------------------------------
  ns.foodGroupsQuestManager = FoodGroupsQuestManager;

})(window.GAME_MODULES || (window.GAME_MODULES = {}));