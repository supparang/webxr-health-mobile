// === /herohealth/vr-groups/quest-manager.js ===
// Food Groups VR — Quest Manager (2025-12-04)
// แยก Goal / MiniQuest ตามระดับความยาก และสุ่มให้ตรงระดับ 100%

'use strict';

window.GAME_MODULES = window.GAME_MODULES || {};
const ns = window.GAME_MODULES;

export class QuestManager {
  constructor(diff = 'normal') {
    this.diff = diff;
    this.goals = [];
    this.minis = [];
    this.activeGoals = [];
    this.activeMinis = [];
    this.progress = {
      goals: {},
      minis: {}
    };
  }

  // -----------------------------
  // 1) Quest Pools
  // -----------------------------
  getGoalPool() {
    return {
      easy: [
        { id: 'E1', label: 'เก็บผักให้ครบ 5 ชิ้น 🥬', need: 5, type: 'veg' },
        { id: 'E2', label: 'เลือกผลไม้ดี ๆ ให้ครบ 5 ชิ้น 🍎🍉', need: 5, type: 'fruit' },
        { id: 'E3', label: 'เพิ่มพลังงานด้วยธัญพืช 6 ชิ้น 🌽🍞', need: 6, type: 'grain' }
      ],
      normal: [
        { id: 'N1', label: 'เก็บผักให้ครบ 10 ชิ้น 🥦', need: 10, type: 'veg' },
        { id: 'N2', label: 'ผลไม้ดี 8 ชิ้น 🍊🍇', need: 8, type: 'fruit' },
        { id: 'N3', label: 'โปรตีนดี 6 ชิ้น 🥚🫘🐟', need: 6, type: 'protein' },
        { id: 'N4', label: 'เลือกแต่อาหารดี 15 ชิ้น 💚', need: 15, type: 'good' },
        { id: 'N5', label: 'อาหาร 3 หมู่ หมู่ละ 3 ชิ้น', need: 9, type: 'multi3' }
      ],
      hard: [
        { id: 'H1', label: 'เก็บอาหารดี 20 ชิ้นใน 25 วิ ⚡', need: 20, type: 'good-fast' },
        { id: 'H2', label: 'คอมโบอาหารดีติดกัน 5 ครั้ง 🔥', need: 5, type: 'good-combo' },
        { id: 'H3', label: 'ทำภารกิจหมู่ให้สำเร็จ 3 ด่าน 🎯', need: 3, type: 'multi-phase' }
      ]
    };
  }

  getMiniPool() {
    return {
      easy: [
        { id: 'ME1', label: 'ผักติดกัน 2 ครั้ง', need: 2, type: 'veg-chain' },
        { id: 'ME2', label: 'ผลไม้รวม 3 ชิ้น 🍓🍉', need: 3, type: 'fruit' },
        { id: 'ME3', label: 'หลีกเลี่ยง Junk ให้ได้ 3 วิ ⏳', need: 3, type: 'avoid-junk' }
      ],
      normal: [
        { id: 'MN1', label: 'โปรตีนดี 3 ชิ้น 🥚🫘', need: 3, type: 'protein' },
        { id: 'MN2', label: 'สลับหมู่ 3 ครั้ง', need: 3, type: 'switch-group' },
        { id: 'MN3', label: 'อาหารดีติดกัน 4 ครั้ง 🔥', need: 4, type: 'good-chain' },
        { id: 'MN4', label: 'ผัก+ผลไม้รวม 6 ชิ้น', need: 6, type: 'plant-mix' }
      ],
      hard: [
        { id: 'MH1', label: 'เก็บอาหารดี 8 ชิ้นห้ามพลาด', need: 8, type: 'good-perfect' },
        { id: 'MH2', label: 'สลับซ้าย-ขวา 6 ครั้ง ↔️', need: 6, type: 'switch-lr' },
        { id: 'MH3', label: 'ยิงเป้าตรงกลาง 5 ครั้ง 🎯', need: 5, type: 'mid-hit' },
        { id: 'MH4', label: 'ยิงตามหมู่ที่โค้ชสั่ง 4 ครั้ง', need: 4, type: 'coach-call' }
      ]
    };
  }

  // -----------------------------
  // Helper: random pick
  // -----------------------------
  pick(pool, count) {
    const arr = [...pool];
    const chosen = [];
    for (let i = 0; i < count && arr.length > 0; i++) {
      const idx = Math.floor(Math.random() * arr.length);
      chosen.push(arr[idx]);
      arr.splice(idx, 1);
    }
    return chosen;
  }

  // -----------------------------
  // Init quests ตามระดับ
  // -----------------------------
  init() {
    const goalPool = this.getGoalPool();
    const miniPool = this.getMiniPool();

    let G = [], M = [];

    if (this.diff === 'easy') {
      G = goalPool.easy;
      M = miniPool.easy;
      this.activeGoals = this.pick(G, 2);
      this.activeMinis = this.pick(M, 3);
    }
    else if (this.diff === 'hard') {
      G = goalPool.hard;
      M = miniPool.hard;
      this.activeGoals = this.pick(G, 2);
      this.activeMinis = this.pick(M, 3);
    }
    else {
      G = goalPool.normal;
      M = miniPool.normal;
      this.activeGoals = this.pick(G, 2);
      this.activeMinis = this.pick(M, 3);
    }

    // init progress
    this.activeGoals.forEach(g => this.progress.goals[g.id] = 0);
    this.activeMinis.forEach(m => this.progress.minis[m.id] = 0);

    console.log('[QuestManager] Goals:', this.activeGoals);
    console.log('[QuestManager] Minis:', this.activeMinis);
  }

  // -----------------------------
  // Update Quest Progress
  // -----------------------------
  update(type, item) {
    // type เช่น veg, fruit, protein, good, junk ฯลฯ
    const checkList = [...this.activeGoals, ...this.activeMinis];

    checkList.forEach(q => {
      if (q.type === item.type) {

        // ทำ progress เพิ่ม
        this.progress.goals[q.id] = (this.progress.goals[q.id] || 0);
        this.progress.minis[q.id] = (this.progress.minis[q.id] || 0);

        if (this.progress.goals.hasOwnProperty(q.id)) {
          this.progress.goals[q.id]++;
        }
        if (this.progress.minis.hasOwnProperty(q.id)) {
          this.progress.minis[q.id]++;
        }

        // ส่ง event ให้ UI + Coach
        window.dispatchEvent(new CustomEvent('fg-quest-progress', {
          detail: {
            id: q.id,
            label: q.label,
            value: (this.progress.goals[q.id] || this.progress.minis[q.id]),
            need: q.need
          }
        }));
      }
    });
  }

  // -----------------------------
  // Check Complete
  // -----------------------------
  getSummary() {
    let goalDone = 0;
    let miniDone = 0;

    this.activeGoals.forEach(g => {
      if ((this.progress.goals[g.id] || 0) >= g.need) goalDone++;
    });

    this.activeMinis.forEach(m => {
      if ((this.progress.minis[m.id] || 0) >= m.need) miniDone++;
    });

    return {
      goalTotal: this.activeGoals.length,
      miniTotal: this.activeMinis.length,
      goalDone,
      miniDone
    };
  }
}

// export default
ns.foodGroupsQuestManager = QuestManager;