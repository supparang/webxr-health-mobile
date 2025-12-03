// === vr-groups/quest-manager.js (2025-12-03) ===
// ระบบ Goal + Mini Quest สำหรับ Food Groups VR
// - Goal 10 แบบ, Mini quest 15 แบบ
// - แบ่งตาม diff: easy / normal / hard
// - แต่ละรอบเลือก goal 2 อัน + mini quest 3 อัน ตามระดับเกม

(function (ns) {
  'use strict';

  // ----------------------------------------------------
  // Helper: random / shuffle / pick
  // ----------------------------------------------------
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickN(arr, n) {
    if (!arr || !arr.length) return [];
    const s = shuffle(arr);
    return s.slice(0, Math.min(n, s.length));
  }

  // ----------------------------------------------------
  // emoji index สำหรับใช้เช็ค group + isGood
  // ----------------------------------------------------
  const EMOJI_INDEX = {};
  if (ns.foodGroupsEmoji && ns.foodGroupsEmoji.all) {
    ns.foodGroupsEmoji.all.forEach(g => {
      EMOJI_INDEX[g.id] = g;
    });
  }

  function getEmojiInfo(id) {
    return EMOJI_INDEX[id] || null;
  }

  // ----------------------------------------------------
  // BANK: Goal 10 แบบ (main quest)
  //   type:
  //     - hit-good       : ยิงอาหารดี
  //     - hit-good-group : ยิงอาหารดีจากหมู่เฉพาะ
  //     - hit-any        : ยิงอะไรก็ได้
  //
  //   filter:
  //     - groupIndex: กลุ่มอาหารจาก emoji-image.js (1–5, 9)
  // ----------------------------------------------------
  const GOAL_BANK = [
    // ==== EASY ====
    {
      id: 'G1',
      diff: 'easy',
      type: 'hit-good-group',
      label: 'หมู่ผัก 🥬 ยิงผักใบเขียวให้ครบ 6 ครั้ง',
      target: 6,
      filter: { groupIndex: 2 } // ผัก
    },
    {
      id: 'G2',
      diff: 'easy',
      type: 'hit-good-group',
      label: 'หมู่ผลไม้ 🍉 ยิงผลไม้ให้ครบ 6 ครั้ง',
      target: 6,
      filter: { groupIndex: 3 } // ผลไม้
    },
    {
      id: 'G3',
      diff: 'easy',
      type: 'hit-good',
      label: 'อาหารดีทุกหมู่ 🎯 ยิงอาหารดีรวมให้ครบ 10 ชิ้น',
      target: 10
    },

    // ==== NORMAL ====
    {
      id: 'G4',
      diff: 'normal',
      type: 'hit-good-group',
      label: 'หมู่ข้าว-แป้ง 🍚 ยิงเมนูข้าว/แป้งดีให้ครบ 8 ครั้ง',
      target: 8,
      filter: { groupIndex: 1 }
    },
    {
      id: 'G5',
      diff: 'normal',
      type: 'hit-good-group',
      label: 'หมู่โปรตีน 🐟 ยิงโปรตีนดี (ปลา/ไก่/ถั่ว) ให้ครบ 8 ครั้ง',
      target: 8,
      filter: { groupIndex: 4 }
    },
    {
      id: 'G6',
      diff: 'normal',
      type: 'hit-good',
      label: 'จานสุขภาพ 💚 ยิงอาหารดีรวมให้ครบ 16 ชิ้น',
      target: 16
    },
    {
      id: 'G7',
      diff: 'normal',
      type: 'hit-any',
      label: 'ตั้งใจเล็ง 🎯 ยิงให้โดนเป้ารวม 18 ครั้ง',
      target: 18
    },

    // ==== HARD ====
    {
      id: 'G8',
      diff: 'hard',
      type: 'hit-good-group',
      label: 'กินผักให้เยอะ 🥦 ยิงผักให้ครบ 12 ครั้ง',
      target: 12,
      filter: { groupIndex: 2 }
    },
    {
      id: 'G9',
      diff: 'hard',
      type: 'hit-good',
      label: 'จัดจานครบหมู่ 💪 ยิงอาหารดีรวมให้ครบ 22 ชิ้น',
      target: 22
    },
    {
      id: 'G10',
      diff: 'hard',
      type: 'hit-any',
      label: 'แม่นเหมือนโปร 🎯 ยิงให้โดนเป้ารวม 24 ครั้ง',
      target: 24
    }
  ];

  // ----------------------------------------------------
  // BANK: Mini Quest 15 แบบ
  // เน้นเป้าเล็กกว่า goal
  // ----------------------------------------------------
  const MINI_BANK = [
    // ==== EASY (5) ====
    {
      id: 'M1',
      diff: 'easy',
      type: 'hit-good-group',
      label: 'สายผักเบา ๆ 🥕 ยิงผักให้ครบ 4 ครั้ง',
      target: 4,
      filter: { groupIndex: 2 }
    },
    {
      id: 'M2',
      diff: 'easy',
      type: 'hit-good-group',
      label: 'ผลไม้หวานน้อย 🍊 ยิงผลไม้ให้ครบ 4 ครั้ง',
      target: 4,
      filter: { groupIndex: 3 }
    },
    {
      id: 'M3',
      diff: 'easy',
      type: 'hit-good',
      label: 'ลองเล็งอาหารดี 🎯 ยิงอาหารดีให้ครบ 6 ชิ้น',
      target: 6
    },
    {
      id: 'M4',
      diff: 'easy',
      type: 'hit-any',
      label: 'วอร์มอัป ยิงให้โดน 6 ครั้ง',
      target: 6
    },
    {
      id: 'M5',
      diff: 'easy',
      type: 'hit-good-group',
      label: 'นมและผลิตภัณฑ์ 🥛 ยิงของหมู่นมให้ครบ 4 ครั้ง',
      target: 4,
      filter: { groupIndex: 5 }
    },

    // ==== NORMAL (5) ====
    {
      id: 'M6',
      diff: 'normal',
      type: 'hit-good-group',
      label: 'สายโปรตีน 🥚 ยิงโปรตีนดีให้ครบ 6 ครั้ง',
      target: 6,
      filter: { groupIndex: 4 }
    },
    {
      id: 'M7',
      diff: 'normal',
      type: 'hit-good-group',
      label: 'ผักหลากสี 🥦 ยิงผักให้ครบ 7 ครั้ง',
      target: 7,
      filter: { groupIndex: 2 }
    },
    {
      id: 'M8',
      diff: 'normal',
      type: 'hit-good',
      label: 'มื้อนี้เพื่อสุขภาพ 💚 ยิงอาหารดีให้ครบ 10 ชิ้น',
      target: 10
    },
    {
      id: 'M9',
      diff: 'normal',
      type: 'hit-any',
      label: 'ยิงไม่ให้พลาด 🎯 ยิงให้โดน 10 ครั้ง',
      target: 10
    },
    {
      id: 'M10',
      diff: 'normal',
      type: 'hit-good-group',
      label: 'จานข้าวดี ๆ 🍚 ยิงหมู่ข้าว-แป้งดีให้ครบ 6 ครั้ง',
      target: 6,
      filter: { groupIndex: 1 }
    },

    // ==== HARD (5) ====
    {
      id: 'M11',
      diff: 'hard',
      type: 'hit-good-group',
      label: 'ผักจัดเต็ม 🥬 ยิงผักให้ครบ 10 ครั้ง',
      target: 10,
      filter: { groupIndex: 2 }
    },
    {
      id: 'M12',
      diff: 'hard',
      type: 'hit-good-group',
      label: 'ผลไม้ช่วยสุขภาพ 🍓 ยิงผลไม้ให้ครบ 9 ครั้ง',
      target: 9,
      filter: { groupIndex: 3 }
    },
    {
      id: 'M13',
      diff: 'hard',
      type: 'hit-good',
      label: 'คุมเมนูดี ๆ 💪 ยิงอาหารดีให้ครบ 14 ชิ้น',
      target: 14
    },
    {
      id: 'M14',
      diff: 'hard',
      type: 'hit-any',
      label: 'โฟกัสดีมาก 🎯 ยิงให้โดน 16 ครั้ง',
      target: 16
    },
    {
      id: 'M15',
      diff: 'hard',
      type: 'hit-good-group',
      label: 'สายโปรตีนจริงจัง 🐟 ยิงโปรตีนดีให้ครบ 9 ครั้ง',
      target: 9,
      filter: { groupIndex: 4 }
    }
  ];

  // ----------------------------------------------------
  // เช็คว่า hit นี้นับเข้า quest หรือไม่
  // ----------------------------------------------------
  function matchesQuestHit(quest, emojiInfo) {
    if (!quest || !emojiInfo) return false;
    const isGood = !!emojiInfo.isGood;
    const groupIndex = emojiInfo.group; // จาก emoji-image.js

    switch (quest.type) {
      case 'hit-good-group':
        if (!isGood) return false;
        if (quest.filter && quest.filter.groupIndex && quest.filter.groupIndex !== groupIndex) {
          return false;
        }
        return true;

      case 'hit-good':
        return isGood;

      case 'hit-any':
        return true;

      default:
        return false;
    }
  }

  // ----------------------------------------------------
  // FoodGroupsQuestManager
  // ----------------------------------------------------
  function FoodGroupsQuestManager(onChange) {
    this.onChange = typeof onChange === 'function' ? onChange : function () {};
    this.diff = 'normal';

    this.mainQuests = [];
    this.miniQuests = [];
    this.currentMainIndex = 0;
  }

  FoodGroupsQuestManager.prototype._selectQuestsForDiff = function (diff) {
    const d = (diff || 'normal').toLowerCase();

    const goals = GOAL_BANK.filter(q => q.diff === d);
    const minis = MINI_BANK.filter(q => q.diff === d);

    // ถ้าจำนวนไม่พอ → fallback ทุก diff รวม
    const mainList = goals.length >= 2 ? goals : GOAL_BANK;
    const miniList = minis.length >= 3 ? minis : MINI_BANK;

    const pickedGoals = pickN(mainList, 2);
    const pickedMinis = pickN(miniList, 3);

    pickedGoals.forEach(q => {
      q.progress = 0;
      q.cleared = false;
      q.kind = 'goal';
    });
    pickedMinis.forEach(q => {
      q.progress = 0;
      q.cleared = false;
      q.kind = 'mini';
    });

    this.mainQuests = pickedGoals;
    this.miniQuests = pickedMinis;
    this.currentMainIndex = 0;
  };

  FoodGroupsQuestManager.prototype.reset = function () {
    const diffFromGame =
      ns.FoodGroupsGame && ns.FoodGroupsGame.currentDiff
        ? ns.FoodGroupsGame.currentDiff
        : 'normal';

    this.diff = (diffFromGame || 'normal').toLowerCase();
    this._selectQuestsForDiff(this.diff);

    this._emitChange(null, false, null);
  };

  FoodGroupsQuestManager.prototype._getCurrentMain = function () {
    if (!this.mainQuests || !this.mainQuests.length) return null;
    if (this.currentMainIndex < 0 || this.currentMainIndex >= this.mainQuests.length) {
      return null;
    }
    return this.mainQuests[this.currentMainIndex];
  };

  FoodGroupsQuestManager.prototype.getCurrent = function () {
    return this._getCurrentMain();
  };

  FoodGroupsQuestManager.prototype._emitChange = function (quest, justFinished, finishedQuest) {
    const status = this.getStatus();
    const q = quest || this._getCurrentMain();
    const progress = q && q.target > 0 ? q.progress / q.target : 0;
    try {
      this.onChange(q, progress, !!justFinished, finishedQuest || null);
    } catch (e) {
      console.warn('[FoodGroupsQuestManager] onChange error', e);
    }
  };

  FoodGroupsQuestManager.prototype.getStatus = function () {
    const mainTotal = this.mainQuests.length;
    const miniTotal = this.miniQuests.length;
    const mainCleared = this.mainQuests.filter(q => q.cleared).length;
    const miniCleared = this.miniQuests.filter(q => q.cleared).length;

    return {
      diff: this.diff,
      total: mainTotal + miniTotal,
      cleared: mainCleared + miniCleared,
      main: {
        total: mainTotal,
        cleared: mainCleared,
        list: this.mainQuests
      },
      mini: {
        total: miniTotal,
        cleared: miniCleared,
        list: this.miniQuests
      },
      currentMainIndex: this.currentMainIndex
    };
  };

  FoodGroupsQuestManager.prototype.getClearedCount = function () {
    const s = this.getStatus();
    return s.cleared || 0;
  };

  // ----------------------------------------------------
  // notifyHit: เรียกจาก GameEngine.onHitTarget(groupId)
  // ----------------------------------------------------
  FoodGroupsQuestManager.prototype.notifyHit = function (groupId) {
    const id = Number(groupId) || 0;
    const emojiInfo = getEmojiInfo(id);
    if (!emojiInfo) return null;

    let changedQuest = null;
    let justFinished = false;

    // 1) main quest ปัจจุบัน
    const current = this._getCurrentMain();
    if (current && !current.cleared && matchesQuestHit(current, emojiInfo)) {
      current.progress += 1;
      changedQuest = current;

      if (current.progress >= current.target) {
        current.cleared = true;
        justFinished = true;
        this.currentMainIndex += 1;
      }
    }

    // 2) mini quests ทั้งหมด
    for (const mq of this.miniQuests) {
      if (mq.cleared) continue;
      if (!matchesQuestHit(mq, emojiInfo)) continue;
      mq.progress += 1;
      if (!changedQuest) changedQuest = mq;

      if (mq.progress >= mq.target) {
        mq.cleared = true;
        if (!justFinished) justFinished = true;
      }
    }

    if (changedQuest) {
      this._emitChange(changedQuest, justFinished, changedQuest.cleared ? changedQuest : null);
      return {
        questId: changedQuest.id,
        kind: changedQuest.kind,
        bonus: changedQuest.kind === 'goal' ? 5 : 2
      };
    }

    return null;
  };

  // ----------------------------------------------------
  // export
  // ----------------------------------------------------
  ns.FoodGroupsQuestManager = FoodGroupsQuestManager;

})(window.GAME_MODULES || (window.GAME_MODULES = {}));