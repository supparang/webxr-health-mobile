// === /herohealth/vr-groups/quest-manager.js ===
// ระบบ Quest สำหรับ Food Groups VR
// ใช้ชื่อ: GAME_MODULES.FoodGroupsQuestManager

(function (ns) {
  'use strict';

  // -------------------------
  // ชุดเควสต์ตัวอย่าง
  // ใช้ groupId จาก emoji-image.js
  // -------------------------
  const DEFAULT_QUESTS = [
    {
      id: 'veg10',
      label: 'เก็บผักให้ครบ 10 ครั้ง',
      groupId: 2,       // ผัก
      target: 10
    },
    {
      id: 'fruit8',
      label: 'เก็บผลไม้ให้ครบ 8 ครั้ง',
      groupId: 3,       // ผลไม้
      target: 8
    },
    {
      id: 'protein6',
      label: 'เก็บโปรตีนดีให้ครบ 6 ครั้ง',
      groupId: 4,       // โปรตีน
      target: 6
    },
    {
      id: 'milk5',
      label: 'เลือกนม / โยเกิร์ตให้ครบ 5 ครั้ง',
      groupId: 5,       // นม
      target: 5
    }
  ];

  function cloneQuest(q) {
    return {
      id: q.id,
      label: q.label,
      groupId: q.groupId,
      target: q.target,
      prog: 0,
      cleared: false
    };
  }

  /**
   * @param {Function} onChangeCb
   *   ฟังก์ชันเรียกกลับเวลา quest เปลี่ยน
   *   (quest, progress, justFinished, finishedQuest)
   */
  function FoodGroupsQuestManager(onChangeCb) {
    this.onChangeCb = typeof onChangeCb === 'function' ? onChangeCb : null;

    this.quests = DEFAULT_QUESTS.map(cloneQuest);
    this.currentIndex = 0;
    this.bonusPerHit = 2;  // โบนัสคะแนนเพิ่มถ้าโจมตีโดนเป้าตรง quest
  }

  FoodGroupsQuestManager.prototype.reset = function () {
    this.quests = DEFAULT_QUESTS.map(cloneQuest);
    this.currentIndex = 0;
    this._emitChange(false, null);
  };

  FoodGroupsQuestManager.prototype.getCurrent = function () {
    if (this.currentIndex < 0 || this.currentIndex >= this.quests.length) return null;
    return this.quests[this.currentIndex];
  };

  FoodGroupsQuestManager.prototype.getClearedCount = function () {
    return this.quests.filter(function (q) { return q.cleared; }).length;
  };

  FoodGroupsQuestManager.prototype.getStatus = function () {
    const total = this.quests.length;
    const cleared = this.getClearedCount();
    return {
      total: total,
      cleared: cleared,
      currentIndex: this.currentIndex,
      current: this.getCurrent(),
      list: this.quests.slice()
    };
  };

  FoodGroupsQuestManager.prototype._emitChange = function (justFinished, finishedQuest) {
    if (!this.onChangeCb) return;
    const current = this.getCurrent();
    const progress = current ? current.prog : 0;
    this.onChangeCb(current, progress, !!justFinished, finishedQuest || null);
  };

  /**
   * เรียกเมื่อยิงโดนเป้าหมาย groupId
   * @returns {{ bonus:number }|null}
   */
  FoodGroupsQuestManager.prototype.notifyHit = function (groupId) {
    const cur = this.getCurrent();
    if (!cur || cur.cleared) return { bonus: 0 };

    let justFinished = false;
    let bonus = 0;

    if (groupId === cur.groupId) {
      cur.prog += 1;
      bonus += this.bonusPerHit;

      if (cur.prog >= cur.target) {
        cur.cleared = true;
        justFinished = true;

        // ขยับไปเควสต์ถัดไป
        if (this.currentIndex < this.quests.length - 1) {
          this.currentIndex += 1;
        } else {
          this.currentIndex = this.quests.length; // ไม่มีเควสต์แล้ว
        }
      }
    }

    const finishedQuest = justFinished ? cur : null;
    this._emitChange(justFinished, finishedQuest);

    return { bonus: bonus };
  };

  ns.FoodGroupsQuestManager = FoodGroupsQuestManager;
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
