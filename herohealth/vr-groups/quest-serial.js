// vr-groups/quest-serial.js
// จัดการภารกิจแบบต่อเนื่อง (Serial Quests)

(function (ns) {
  'use strict';

  // ==== ตั้งภารกิจพื้นฐาน (ตัวอย่าง 3 ภารกิจ) ====
  const QUESTS = [
    {
      id: 'q1',
      groupId: 1,
      emoji: '🍚',
      label: 'หมู่ 1 ข้าว-แป้ง',
      need: 5
    },
    {
      id: 'q2',
      groupId: 3,
      emoji: '🥦',
      label: 'หมู่ 3 ผัก',
      need: 6
    },
    {
      id: 'q3',
      groupId: 4,
      emoji: '🍎',
      label: 'หมู่ 4 ผลไม้',
      need: 6
    }
  ];

  function FoodGroupsQuestManager(onChange) {
    this.onChange = typeof onChange === 'function' ? onChange : null;

    this.quests = QUESTS.slice();
    this.currentIndex = -1;
    this.currentProgress = 0;
    this.cleared = 0;

    this.reset();
  }

  FoodGroupsQuestManager.prototype.reset = function () {
    this.currentIndex = 0;
    this.currentProgress = 0;
    this.cleared = 0;
    this._emitChange(false, null); // แจ้งให้โค้ชอัปเดต HUD
  };

  FoodGroupsQuestManager.prototype.getCurrent = function () {
    if (this.currentIndex < 0 || this.currentIndex >= this.quests.length) {
      return null;
    }
    return this.quests[this.currentIndex];
  };

  FoodGroupsQuestManager.prototype.getClearedCount = function () {
    return this.cleared;
  };

  FoodGroupsQuestManager.prototype.getStatus = function () {
    return {
      total: this.quests.length,
      currentIndex: this.currentIndex,
      cleared: this.cleared
    };
  };

  /**
   * เรียกทุกครั้งที่ยิงโดนเป้า
   * @param {number} groupId - หมู่ของอาหารที่โดนยิง
   * @returns {{bonus:number}|null}
   */
  FoodGroupsQuestManager.prototype.notifyHit = function (groupId) {
    const q = this.getCurrent();
    if (!q) return null;

    let justFinished = false;
    let finishedQuest = null;

    if (q.groupId === groupId) {
      this.currentProgress++;

      if (this.currentProgress >= (q.need || 5)) {
        justFinished = true;
        finishedQuest = q;
        this.cleared++;
        this.currentIndex++;
        this.currentProgress = 0;
      }
    }

    this._emitChange(justFinished, finishedQuest);

    // bonus score เวลาโดนเป้าภารกิจ
    if (q.groupId === groupId) {
      return { bonus: 5 }; // +5 คะแนนเพิ่มจาก base
    }
    return null;
  };

  FoodGroupsQuestManager.prototype._emitChange = function (justFinished, finishedQuest) {
    if (!this.onChange) return;

    const quest = this.getCurrent();
    const progress = this.currentProgress;
    const status = this.getStatus();

    this.onChange(
      quest,
      progress,
      !!justFinished,
      finishedQuest || null
    );
  };

  ns.FoodGroupsQuestManager = FoodGroupsQuestManager;

})(window.GAME_MODULES || (window.GAME_MODULES = {}));