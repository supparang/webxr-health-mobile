// vr-goodjunk/quest-serial.js
(function (ns) {
  'use strict';

  const QUESTS = [
    { id: 'g1', groupId: 1, targetCount: 5, short: 'หมู่ 1 ให้ครบ 5 ชิ้น' },
    { id: 'g2', groupId: 2, targetCount: 4, short: 'หมู่ 2 ให้ครบ 4 ชิ้น' },
    { id: 'g3', groupId: 3, targetCount: 3, short: 'หมู่ 3 ให้ครบ 3 ชิ้น' },
    { id: 'g4', groupId: 4, targetCount: 4, short: 'หมู่ 4 ให้ครบ 4 ชิ้น' },
    { id: 'g5', groupId: 5, targetCount: 5, short: 'หมู่ 5 ให้ครบ 5 ชิ้น' }
  ];

  function QuestManager(onChange) {
    this.onChange = onChange || function () {};
    this.index = 0;
    this.progress = 0;
  }

  QuestManager.prototype.getCurrent = function () {
    return QUESTS[this.index] || null;
  };

  QuestManager.prototype.getClearedCount = function () {
    return Math.min(this.index, QUESTS.length);
  };

  QuestManager.prototype.reset = function () {
    this.index = 0;
    this.progress = 0;
    this.onChange(this.getCurrent(), this.progress, false, null);
  };

  /**
   * notifyHit(groupId) → { completed, bonus }
   */
  QuestManager.prototype.notifyHit = function (groupId) {
    const q = this.getCurrent();
    if (!q) return { completed: false, bonus: 0 };
    if (groupId !== q.groupId) return { completed: false, bonus: 0 };

    this.progress++;

    if (this.progress >= q.targetCount) {
      const finishedQuest = q;
      this.index++;
      this.progress = 0;
      this.onChange(this.getCurrent(), this.progress, true, finishedQuest);
      return { completed: true, bonus: 80 }; // โบนัสเคลียร์ภารกิจ
    }

    this.onChange(q, this.progress, false, null);
    return { completed: false, bonus: 0 };
  };

  ns.FoodGroupsQuestManager = QuestManager;
  ns.FOOD_GROUP_QUESTS = QUESTS;
})(window.GAME_MODULES);
