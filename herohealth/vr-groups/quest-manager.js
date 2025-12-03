// === /herohealth/vr-groups/quest-manager.js ===
// Quest system สำหรับ Food Groups VR
// - มี goal 10 แบบ, mini quest 15 แบบ
// - จัดตามระดับความยาก easy / normal / hard
// - เวลาเล่น 1 รอบ: เลือก goal 2 ภารกิจ + mini quest 3 ภารกิจ ตาม diff
// - ใช้ร่วมกับ GameEngine (FoodGroupsGame) ผ่าน ns.FoodGroupsQuestManager
// 2025-12-05

(function (ns) {
  'use strict';

  // ---------- Helper: หา group info จาก id ----------
  function getGroupInfo(groupId) {
    if (!ns.foodGroupsEmoji || !Array.isArray(ns.foodGroupsEmoji.all)) return null;
    return ns.foodGroupsEmoji.all.find(g => g.id === groupId) || null;
  }

  // ---------- Quest definitions ----------
  // type:
  //   - 'hitGood'          : ยิงกลุ่มดี (ตาม filter) ให้ครบ target ครั้ง
  //   - 'hitBadLimit'      : ไม่ยิงของไม่ดีเกิน limit
  //   - 'mixGroups'        : ยิงกลุ่มดีหลายชนิดรวมกัน
  //   - 'comboGoodOnly'    : ยิงดีต่อเนื่องโดยไม่โดนกลุ่มไม่ดี (นับเป็น hitGood ธรรมดาในที่นี้)
  //
  // difficulty: 'easy' | 'normal' | 'hard'

  const GOAL_DEFS = [
    // ---------- EASY ----------
    {
      id: 'g_easy_good_any_10',
      label: 'ยิงกลุ่มอาหารที่ดีให้ได้ 10 ครั้ง',
      difficulty: 'easy',
      type: 'hitGood',
      target: 10,
      filter: { isGood: true },
      bonusPerHit: 1,
      bonusOnClear: 8
    },
    {
      id: 'g_easy_veg_fruit_8',
      label: 'เน้นผักและผลไม้ให้ครบ 8 ครั้ง',
      difficulty: 'easy',
      type: 'hitGood',
      target: 8,
      filter: { isGood: true, groupIds: ['veg', 'fruit'] },
      bonusPerHit: 2,
      bonusOnClear: 10
    },
    {
      id: 'g_easy_anygroup_3x',
      label: 'เลือกกลุ่มดีอะไรก็ได้ ยิงให้ครบ 3 ชุด (รวม 9 ครั้ง)',
      difficulty: 'easy',
      type: 'hitGood',
      target: 9,
      filter: { isGood: true },
      bonusPerHit: 1,
      bonusOnClear: 12
    },

    // ---------- NORMAL ----------
    {
      id: 'g_norm_5groups',
      label: 'ยิงให้ครบทุกรายการอาหารหลัก (อย่างละอย่าง)',
      difficulty: 'normal',
      type: 'mixGroups',
      target: 5,
      filter: { isGood: true, distinctGroups: true },
      bonusPerHit: 2,
      bonusOnClear: 15
    },
    {
      id: 'g_norm_veg_10',
      label: 'เน้นผักใบเขียวให้ครบ 10 ครั้ง',
      difficulty: 'normal',
      type: 'hitGood',
      target: 10,
      filter: { isGood: true, tag: 'veg' },
      bonusPerHit: 2,
      bonusOnClear: 12
    },
    {
      id: 'g_norm_fruit_milk_12',
      label: 'ผลไม้ + นม รวมกันให้ครบ 12 ครั้ง',
      difficulty: 'normal',
      type: 'hitGood',
      target: 12,
      filter: { isGood: true, groupIds: ['fruit', 'milk'] },
      bonusPerHit: 2,
      bonusOnClear: 14
    },
    {
      id: 'g_norm_limit_junk',
      label: 'รักษาสมดุลของหวาน: อย่ายิงของไม่ดีเกิน 4 ครั้ง',
      difficulty: 'normal',
      type: 'hitBadLimit',
      target: 4, // หมายถึง limit
      filter: { isGood: false },
      bonusPerHit: 0,
      bonusOnClear: 10
    },

    // ---------- HARD ----------
    {
      id: 'g_hard_mix_15',
      label: 'เลือกกลุ่มดีหลายชนิดรวมกันให้ได้ 15 ครั้ง',
      difficulty: 'hard',
      type: 'mixGroups',
      target: 15,
      filter: { isGood: true, distinctGroups: true },
      bonusPerHit: 3,
      bonusOnClear: 18
    },
    {
      id: 'g_hard_goodonly_18',
      label: 'เน้นแต่กลุ่มอาหารดีทั้งหมด 18 ครั้ง',
      difficulty: 'hard',
      type: 'hitGood',
      target: 18,
      filter: { isGood: true },
      bonusPerHit: 2,
      bonusOnClear: 20
    },
    {
      id: 'g_hard_limitjunk_2',
      label: 'ควบคุมของหวาน: อย่ายิงของไม่ดีเกิน 2 ครั้ง',
      difficulty: 'hard',
      type: 'hitBadLimit',
      target: 2,
      filter: { isGood: false },
      bonusPerHit: 0,
      bonusOnClear: 20
    }
  ];

  const MINI_DEFS = [
    // ---------- EASY (5) ----------
    {
      id: 'm_easy_veg_5',
      label: 'ภารกิจย่อย: ผัก 5 ครั้ง',
      difficulty: 'easy',
      type: 'hitGood',
      target: 5,
      filter: { isGood: true, tag: 'veg' },
      bonusPerHit: 1,
      bonusOnClear: 6
    },
    {
      id: 'm_easy_fruit_5',
      label: 'ภารกิจย่อย: ผลไม้ 5 ครั้ง',
      difficulty: 'easy',
      type: 'hitGood',
      target: 5,
      filter: { isGood: true, tag: 'fruit' },
      bonusPerHit: 1,
      bonusOnClear: 6
    },
    {
      id: 'm_easy_milk_3',
      label: 'ภารกิจย่อย: นม 3 ครั้ง',
      difficulty: 'easy',
      type: 'hitGood',
      target: 3,
      filter: { isGood: true, tag: 'milk' },
      bonusPerHit: 1,
      bonusOnClear: 5
    },
    {
      id: 'm_easy_grain_4',
      label: 'ภารกิจย่อย: ข้าว-แป้ง 4 ครั้ง',
      difficulty: 'easy',
      type: 'hitGood',
      target: 4,
      filter: { isGood: true, tag: 'grain' },
      bonusPerHit: 1,
      bonusOnClear: 6
    },
    {
      id: 'm_easy_protein_4',
      label: 'ภารกิจย่อย: โปรตีน (เนื้อ/ถั่ว/ไข่) 4 ครั้ง',
      difficulty: 'easy',
      type: 'hitGood',
      target: 4,
      filter: { isGood: true, tag: 'protein' },
      bonusPerHit: 1,
      bonusOnClear: 6
    },

    // ---------- NORMAL (5) ----------
    {
      id: 'm_norm_nojunk_5',
      label: 'เล่นช่วงสั้น ๆ โดยไม่ยิงของไม่ดี (5 เป้าติดกัน)',
      difficulty: 'normal',
      type: 'comboGoodOnly',
      target: 5,
      filter: { isGood: true },
      bonusPerHit: 2,
      bonusOnClear: 8
    },
    {
      id: 'm_norm_vegfruit_8',
      label: 'ผัก + ผลไม้ รวมกัน 8 ครั้ง',
      difficulty: 'normal',
      type: 'hitGood',
      target: 8,
      filter: { isGood: true, groupIds: ['veg', 'fruit'] },
      bonusPerHit: 2,
      bonusOnClear: 10
    },
    {
      id: 'm_norm_protein_6',
      label: 'โปรตีนดี 6 ครั้ง',
      difficulty: 'normal',
      type: 'hitGood',
      target: 6,
      filter: { isGood: true, tag: 'protein' },
      bonusPerHit: 2,
      bonusOnClear: 9
    },
    {
      id: 'm_norm_mix3groups',
      label: 'เลือกกลุ่มดีให้ครบ 3 กลุ่มต่างกัน',
      difficulty: 'normal',
      type: 'mixGroups',
      target: 3,
      filter: { isGood: true, distinctGroups: true },
      bonusPerHit: 2,
      bonusOnClear: 10
    },
    {
      id: 'm_norm_limit_junk_3',
      label: 'อย่ายิงของไม่ดีเกิน 3 ครั้ง',
      difficulty: 'normal',
      type: 'hitBadLimit',
      target: 3,
      filter: { isGood: false },
      bonusPerHit: 0,
      bonusOnClear: 8
    },

    // ---------- HARD (5) ----------
    {
      id: 'm_hard_veg_10',
      label: 'ผัก 10 ครั้งสำหรับสายเฮลท์ตี้!',
      difficulty: 'hard',
      type: 'hitGood',
      target: 10,
      filter: { isGood: true, tag: 'veg' },
      bonusPerHit: 2,
      bonusOnClear: 12
    },
    {
      id: 'm_hard_fruit_10',
      label: 'ผลไม้ 10 ครั้งรวด',
      difficulty: 'hard',
      type: 'hitGood',
      target: 10,
      filter: { isGood: true, tag: 'fruit' },
      bonusPerHit: 2,
      bonusOnClear: 12
    },
    {
      id: 'm_hard_mix4groups',
      label: 'ให้ครบ 4 กลุ่มอาหารดีที่ต่างกัน',
      difficulty: 'hard',
      type: 'mixGroups',
      target: 4,
      filter: { isGood: true, distinctGroups: true },
      bonusPerHit: 3,
      bonusOnClear: 14
    },
    {
      id: 'm_hard_goodonly_12',
      label: 'ยิงแต่ของดี 12 ครั้งติดกัน',
      difficulty: 'hard',
      type: 'comboGoodOnly',
      target: 12,
      filter: { isGood: true },
      bonusPerHit: 3,
      bonusOnClear: 16
    },
    {
      id: 'm_hard_zero_junk_10',
      label: 'ช่วงท้าทาย: ยิงอย่างน้อย 10 เป้า โดยไม่โดนของไม่ดีเลย',
      difficulty: 'hard',
      type: 'comboGoodOnly',
      target: 10,
      filter: { isGood: true },
      bonusPerHit: 3,
      bonusOnClear: 16
    }
  ];

  // ---------- Utility: match group by filter ----------
  function matchFilter(groupId, filter) {
    if (!filter) return true;
    const g = getGroupInfo(groupId);
    if (!g) return false;

    if (filter.isGood != null) {
      if (!!g.isGood !== !!filter.isGood) return false;
    }

    if (filter.tag && g.tag !== filter.tag) return false;

    if (filter.groupIds && Array.isArray(filter.groupIds)) {
      // groupIds อาจเก็บเป็นชื่อ tag หรือ id
      const asStrings = filter.groupIds.map(String);
      if (!(asStrings.includes(String(g.id)) || (g.tag && asStrings.includes(g.tag)))) {
        return false;
      }
    }

    return true;
  }

  function pickRandom(list, n) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr.slice(0, n);
  }

  function filterByDifficulty(defs, diff) {
    diff = (diff || 'normal').toLowerCase();
    return defs.filter(d => (d.difficulty || 'normal').toLowerCase() === diff);
  }

  // ---------- Quest Manager ----------
  function FoodGroupsQuestManager(onChange) {
    this.onChange = typeof onChange === 'function' ? onChange : null;

    this.diff = 'normal';
    this.mainGoals = [];  // เลือกมา 2
    this.miniQuests = []; // เลือกมา 3

    this.clearedMain = 0;
    this.clearedMini = 0;

    this.activeComboGood = 0; // สำหรับ comboGoodOnly

    this.reset();
  }

  FoodGroupsQuestManager.prototype._resolveDiff = function () {
    // อ่านจาก FoodGroupsGame.currentDiff ถ้ามี
    const fromGame =
      ns.FoodGroupsGame && typeof ns.FoodGroupsGame.currentDiff === 'string'
        ? ns.FoodGroupsGame.currentDiff
        : null;

    let d = (fromGame || this.diff || 'normal').toLowerCase();
    if (d !== 'easy' && d !== 'hard') d = 'normal';
    this.diff = d;
  };

  FoodGroupsQuestManager.prototype.reset = function () {
    this._resolveDiff();

    const mainDefs = filterByDifficulty(GOAL_DEFS, this.diff);
    const miniDefs = filterByDifficulty(MINI_DEFS, this.diff);

    // เลือก 2 goal + 3 mini ตามระดับ (ถ้าไม่พอก็เลือกเท่าที่มี)
    const mainPick = pickRandom(mainDefs, 2);
    const miniPick = pickRandom(miniDefs, 3);

    const now = Date.now();

    this.mainGoals = mainPick.map((g, idx) => ({
      id: g.id,
      label: g.label,
      type: g.type,
      filter: g.filter || null,
      target: g.target || 0,
      progress: 0,
      cleared: false,
      order: idx,
      bonusPerHit: g.bonusPerHit || 0,
      bonusOnClear: g.bonusOnClear || 0,
      createdAt: now
    }));

    this.miniQuests = miniPick.map((m, idx) => ({
      id: m.id,
      label: m.label,
      type: m.type,
      filter: m.filter || null,
      target: m.target || 0,
      progress: 0,
      cleared: false,
      order: idx,
      bonusPerHit: m.bonusPerHit || 0,
      bonusOnClear: m.bonusOnClear || 0,
      createdAt: now
    }));

    this.clearedMain = 0;
    this.clearedMini = 0;
    this.activeComboGood = 0;

    this._emitChange(null, 0, false, null);
  };

  FoodGroupsQuestManager.prototype._emitChange = function (quest, progress, justFinished, finishedQuest) {
    if (!this.onChange) return;
    this.onChange(quest || null, progress || 0, !!justFinished, finishedQuest || null);
  };

  FoodGroupsQuestManager.prototype.getCurrent = function () {
    // เลือก main goal ที่ยังไม่เคลียร์เป็น "current"
    const main = this.mainGoals.find(g => !g.cleared);
    if (main) return main;

    // ถ้า main หมดแล้ว ใช้ mini ตัวแรกที่ยังไม่เคลียร์
    const mini = this.miniQuests.find(m => !m.cleared);
    return mini || null;
  };

  FoodGroupsQuestManager.prototype.getClearedCount = function () {
    return this.clearedMain + this.clearedMini;
  };

  FoodGroupsQuestManager.prototype.getStatus = function () {
    return {
      diff: this.diff,
      mainGoals: this.mainGoals.slice(),
      miniQuests: this.miniQuests.slice(),
      clearedMain: this.clearedMain,
      clearedMini: this.clearedMini,
      totalMain: this.mainGoals.length,
      totalMini: this.miniQuests.length,
      total: this.mainGoals.length + this.miniQuests.length
    };
  };

  // ---------- Update on hit ----------
  // ใช้ใน GameEngine.onHitTarget(groupId) → notifyHit(groupId) → return { bonus }
  FoodGroupsQuestManager.prototype.notifyHit = function (groupId) {
    const gInfo = getGroupInfo(groupId);
    const isGood = gInfo ? !!gInfo.isGood : false;

    let totalBonus = 0;
    let changedQuest = null;
    let justFinished = false;
    let finishedQuest = null;

    // จัดการ comboGoodOnly
    if (isGood) {
      this.activeComboGood += 1;
    } else {
      this.activeComboGood = 0;
    }

    // main goals
    this.mainGoals.forEach(goal => {
      if (goal.cleared) return;

      const match = matchFilter(groupId, goal.filter);
      if (!match) return;

      if (goal.type === 'hitGood') {
        if (!isGood) return;
        goal.progress += 1;
        totalBonus += goal.bonusPerHit || 0;
      } else if (goal.type === 'hitBadLimit') {
        // นับผ่าน logger: ถ้าโดนของไม่ดีเกิน limit → ถือว่า goal fail แต่เราจะไม่ลบ แค่ไม่ให้เคลียร์
        // ในที่นี้จะไม่เพิ่ม progress จาก hit
        if (!isGood) {
          // เราอาจใช้ progress = จำนวนครั้งที่ยิงของไม่ดี
          goal.progress += 1;
        }
      } else if (goal.type === 'mixGroups') {
        if (!isGood) return;
        // นับ distinct group ที่เคยยิง
        if (!goal.hitGroups) goal.hitGroups = {};
        if (!goal.hitGroups[groupId]) {
          goal.hitGroups[groupId] = 1;
          goal.progress = Object.keys(goal.hitGroups).length;
          totalBonus += goal.bonusPerHit || 0;
        }
      } else if (goal.type === 'comboGoodOnly') {
        if (!isGood) return;
        goal.progress = this.activeComboGood;
        totalBonus += goal.bonusPerHit || 0;
      }

      if (!goal.cleared && goal.progress >= goal.target) {
        // กรณี hitBadLimit: เคลียร์เมื่อ progress <= target ตอนจบเกม แต่ที่นี่เรายอมถือว่าถ้าไม่ทะลุ target ก็เคลียร์
        if (goal.type !== 'hitBadLimit') {
          goal.cleared = true;
          this.clearedMain += 1;
          totalBonus += goal.bonusOnClear || 0;
          changedQuest = goal;
          justFinished = true;
          finishedQuest = goal;
        }
      } else if (!changedQuest && (goal.type !== 'hitBadLimit')) {
        changedQuest = goal;
      }
    });

    // mini quests
    this.miniQuests.forEach(mini => {
      if (mini.cleared) return;

      const match = matchFilter(groupId, mini.filter);
      if (!match) return;

      if (mini.type === 'hitGood') {
        if (!isGood) return;
        mini.progress += 1;
        totalBonus += mini.bonusPerHit || 0;
      } else if (mini.type === 'hitBadLimit') {
        if (!isGood) {
          mini.progress += 1;
        }
      } else if (mini.type === 'mixGroups') {
        if (!isGood) return;
        if (!mini.hitGroups) mini.hitGroups = {};
        if (!mini.hitGroups[groupId]) {
          mini.hitGroups[groupId] = 1;
          mini.progress = Object.keys(mini.hitGroups).length;
          totalBonus += mini.bonusPerHit || 0;
        }
      } else if (mini.type === 'comboGoodOnly') {
        if (!isGood) return;
        mini.progress = this.activeComboGood;
        totalBonus += mini.bonusPerHit || 0;
      }

      if (!mini.cleared && mini.progress >= mini.target) {
        if (mini.type !== 'hitBadLimit') {
          mini.cleared = true;
          this.clearedMini += 1;
          totalBonus += mini.bonusOnClear || 0;
          // ถ้ายังไม่มี quest ที่เคลียร์ ให้ mini เป็น finishedQuest
          if (!finishedQuest) {
            finishedQuest = mini;
            changedQuest = mini;
            justFinished = true;
          }
        }
      } else if (!changedQuest && (mini.type !== 'hitBadLimit')) {
        changedQuest = mini;
      }
    });

    // broadcast ให้โค้ช / HUD
    const current = this.getCurrent();
    const status = this.getStatus();
    const progress = current ? current.progress : 0;

    this._emitChange(current, progress, justFinished, finishedQuest);

    // คืนค่า bonus ให้ GameEngine
    return {
      bonus: totalBonus,
      status
    };
  };

  // ---------- Export ----------
  ns.FoodGroupsQuestManager = FoodGroupsQuestManager;

})(window.GAME_MODULES || (window.GAME_MODULES = {}));