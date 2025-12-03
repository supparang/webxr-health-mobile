// === /herohealth/vr-groups/quest-manager.js ===
// Quest system สำหรับ Food Groups VR
// - สร้าง goal 10 แบบ (easy/normal/hard)
// - สร้าง mini quest 15 แบบ (easy/normal/hard)
// - เลือกตามระดับความยาก → goal 2 อัน, mini 3 อัน
// - อัปเดตโค้ช + HUD ผ่าน callback และ event "quest:update"

(function (ns) {
  'use strict';

  // --------------------------------------------------
  // ช่วย ๆ
  // --------------------------------------------------
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pickForDiff(list, diff, n) {
    const d = (diff || 'normal').toLowerCase();
    const filtered = list.filter(q => q.diff === d);
    if (!filtered.length) return [];
    return shuffle(filtered).slice(0, n).map(q => ({
      id: q.id,
      label: q.label,
      diff: q.diff,
      target: q.target,
      groupIds: q.groupIds.slice(),
      done: false,
      progress: 0,
      hits: 0
    }));
  }

  function fireQuestUpdate(status, currentGoal, currentMini) {
    try {
      window.dispatchEvent(new CustomEvent('quest:update', {
        detail: {
          goal: currentGoal ? {
            id: currentGoal.id,
            label: currentGoal.label,
            prog: currentGoal.progress,
            target: currentGoal.target
          } : null,
          mini: currentMini ? {
            id: currentMini.id,
            label: currentMini.label,
            prog: currentMini.progress,
            target: currentMini.target
          } : null,
          status: status || null
        }
      }));
    } catch (e) {}
  }

  // --------------------------------------------------
  // กำหนดกลุ่ม id (จาก emoji-image.js)
  //   หมู่ 1: 1–5
  //   หมู่ 2: 10–14
  //   หมู่ 3: 20–24
  //   หมู่ 4: 30–34
  //   หมู่ 5: 40–44
  //   ของควรลด: 100–104
  // --------------------------------------------------
  const G1 = [1, 2, 3, 4, 5];         // ข้าว-แป้ง ธัญพืช
  const G2 = [10,11,12,13,14];        // ผัก
  const G3 = [20,21,22,23,24];        // ผลไม้
  const G4 = [30,31,32,33,34];        // โปรตีน
  const G5 = [40,41,42,43,44];        // นมและผลิตภัณฑ์
  const GOOD_ALL = G1.concat(G2,G3,G4,G5);

  const JUNK = [100,101,102,103,104];

  // --------------------------------------------------
  // MAIN GOALS (10 แบบ)
  //   diff: 'easy' | 'normal' | 'hard'
  //   target: จำนวนครั้งที่ยิงโดน (เฉพาะ good ตาม groupIds)
  // --------------------------------------------------
  const MAIN_GOALS_DEF = [
    // -------- easy (4) --------
    {
      id: 'veg-easy-1',
      diff: 'easy',
      label: 'ยิงผักให้โดน 8 ชิ้น 🥦',
      groupIds: G2,
      target: 8
    },
    {
      id: 'fruit-easy-1',
      diff: 'easy',
      label: 'ยิงผลไม้ให้โดน 8 ชิ้น 🍎',
      groupIds: G3,
      target: 8
    },
    {
      id: 'milk-easy-1',
      diff: 'easy',
      label: 'เลือกนมและผลิตภัณฑ์นม 6 ชิ้น 🥛',
      groupIds: G5,
      target: 6
    },
    {
      id: 'goodall-easy-1',
      diff: 'easy',
      label: 'ยิงอาหารดีรวมทุกหมู่ให้ครบ 10 ชิ้น',
      groupIds: GOOD_ALL,
      target: 10
    },

    // -------- normal (3) --------
    {
      id: 'vegfruit-normal-1',
      diff: 'normal',
      label: 'ผัก + ผลไม้ รวมกัน 12 ชิ้น 🥦🍎',
      groupIds: G2.concat(G3),
      target: 12
    },
    {
      id: 'protein-normal-1',
      diff: 'normal',
      label: 'ยิงโปรตีนให้ครบ 10 ชิ้น 🐟🍗',
      groupIds: G4,
      target: 10
    },
    {
      id: 'rainbow-normal-1',
      diff: 'normal',
      label: 'เก็บอาหารดีอย่างน้อย 15 ชิ้นจากหลายหมู่ 🌈',
      groupIds: GOOD_ALL,
      target: 15
    },

    // -------- hard (3) --------
    {
      id: 'hard-balance-1',
      diff: 'hard',
      label: 'เน้นผักและผลไม้ รวม 16 ชิ้น โดยไม่เผลอยิงของจังค์บ่อย',
      groupIds: G2.concat(G3),
      target: 16
    },
    {
      id: 'hard-protein-1',
      diff: 'hard',
      label: 'โปรตีนอย่างเดียวให้ครบ 14 ชิ้น 💪',
      groupIds: G4,
      target: 14
    },
    {
      id: 'hard-goodall-1',
      diff: 'hard',
      label: 'อาหารดีทุกหมู่รวม 20 ชิ้น! 🔥',
      groupIds: GOOD_ALL,
      target: 20
    }
  ];

  // --------------------------------------------------
  // MINI QUESTS (15 แบบ)
  //   เป้าเล็กกว่า เน้นเจาะจงแต่ละหมู่ หรือพฤติกรรมเล็ก ๆ
  // --------------------------------------------------
  const MINI_DEF = [
    // -------- easy (5) --------
    {
      id: 'mini-veg-1',
      diff: 'easy',
      label: 'เก็บผัก 4 ชิ้นติด ๆ กัน 🥦',
      groupIds: G2,
      target: 4
    },
    {
      id: 'mini-fruit-1',
      diff: 'easy',
      label: 'เก็บผลไม้ให้ครบ 5 ชิ้น 🍎',
      groupIds: G3,
      target: 5
    },
    {
      id: 'mini-milk-1',
      diff: 'easy',
      label: 'เลือกนม/โยเกิร์ต 3 ชิ้น 🥛',
      groupIds: G5,
      target: 3
    },
    {
      id: 'mini-grain-1',
      diff: 'easy',
      label: 'เลือกข้าว-แป้งดี ๆ 4 ชิ้น 🍚',
      groupIds: G1,
      target: 4
    },
    {
      id: 'mini-goodmix-1',
      diff: 'easy',
      label: 'เก็บอาหารดีรวม 6 ชิ้นจากหลายหมู่',
      groupIds: GOOD_ALL,
      target: 6
    },

    // -------- normal (5) --------
    {
      id: 'mini-vegfruit-1',
      diff: 'normal',
      label: 'ผลไม้ 4 + ผัก 4 รวม 8 ชิ้น',
      groupIds: G2.concat(G3),
      target: 8
    },
    {
      id: 'mini-protein-1',
      diff: 'normal',
      label: 'โปรตีน 6 ชิ้น 🐟🍗',
      groupIds: G4,
      target: 6
    },
    {
      id: 'mini-fivegroup-1',
      diff: 'normal',
      label: 'เก็บอาหารดีอย่างน้อย 1 ชิ้นจาก 3 หมู่ขึ้นไป',
      groupIds: GOOD_ALL,
      target: 9   // ประมาณ 3 หมู่ * 3 ชิ้น
    },
    {
      id: 'mini-avoidjunk-1',
      diff: 'normal',
      label: 'เก็บอาหารดี 8 ชิ้น โดยพยายามไม่โดนของจังค์',
      groupIds: GOOD_ALL,
      target: 8
    },
    {
      id: 'mini-mix-1',
      diff: 'normal',
      label: 'ข้าว-แป้ง + โปรตีน รวม 8 ชิ้น 🍚🍗',
      groupIds: G1.concat(G4),
      target: 8
    },

    // -------- hard (5) --------
    {
      id: 'mini-veg-hard-1',
      diff: 'hard',
      label: 'ผักล้วน ๆ 10 ชิ้น! 🥦',
      groupIds: G2,
      target: 10
    },
    {
      id: 'mini-fruit-hard-1',
      diff: 'hard',
      label: 'ผลไม้ 10 ชิ้น 🍎',
      groupIds: G3,
      target: 10
    },
    {
      id: 'mini-protein-hard-1',
      diff: 'hard',
      label: 'โปรตีน 10 ชิ้น 💪',
      groupIds: G4,
      target: 10
    },
    {
      id: 'mini-rainbow-hard-1',
      diff: 'hard',
      label: 'อาหารดีรวมทุกหมู่ 14 ชิ้น แบบจานสายรุ้ง 🌈',
      groupIds: GOOD_ALL,
      target: 14
    },
    {
      id: 'mini-mix-hard-1',
      diff: 'hard',
      label: 'ข้าว-แป้ง + ผัก + โปรตีน รวม 15 ชิ้น',
      groupIds: G1.concat(G2,G4),
      target: 15
    }
  ];

  // --------------------------------------------------
  // FoodGroupsQuestManager
  // --------------------------------------------------
  function FoodGroupsQuestManager(onChange) {
    this.onChange = typeof onChange === 'function' ? onChange : function () {};

    this.diff = 'normal';
    this.mainGoals = [];
    this.miniQuests = [];
    this.currentMainIndex = 0;
    this.currentMiniIndex = 0;
    this.clearedMain = 0;
    this.clearedMini = 0;
  }

  FoodGroupsQuestManager.prototype._currentMain = function () {
    return (this.mainGoals[this.currentMainIndex] || null);
  };
  FoodGroupsQuestManager.prototype._currentMini = function () {
    return (this.miniQuests[this.currentMiniIndex] || null);
  };

  FoodGroupsQuestManager.prototype._status = function () {
    return {
      diff: this.diff,
      total: this.mainGoals.length,
      cleared: this.clearedMain,
      miniTotal: this.miniQuests.length,
      miniCleared: this.clearedMini
    };
  };

  FoodGroupsQuestManager.prototype._emitChange = function (opts) {
    opts = opts || {};
    const goal = this._currentMain();
    const mini = this._currentMini();
    const status = this._status();

    // callback ให้โค้ช + HUD (ผ่าน GameEngine)
    this.onChange(goal, goal ? goal.progress : 0, !!opts.justFinished, opts.finishedMain || null);

    // ยิง event ทั่วไปให้ HUD แบบ generic (ถ้าจะใช้)
    fireQuestUpdate(status, goal, mini);
  };

  FoodGroupsQuestManager.prototype.reset = function () {
    // อ่าน diff ปัจจุบันจากตัวเกม (ตั้งไว้ใน GameEngine.js)
    const d = (ns.FoodGroupsGame && ns.FoodGroupsGame.currentDiff) || 'normal';
    this.diff = d.toLowerCase();

    this.mainGoals = pickForDiff(MAIN_GOALS_DEF, this.diff, 2);
    this.miniQuests = pickForDiff(MINI_DEF, this.diff, 3);

    this.currentMainIndex = 0;
    this.currentMiniIndex = 0;
    this.clearedMain = 0;
    this.clearedMini = 0;

    this._emitChange({ justFinished: false });
  };

  FoodGroupsQuestManager.prototype.getCurrent = function () {
    return this._currentMain();
  };

  FoodGroupsQuestManager.prototype.getStatus = function () {
    const s = this._status();
    const g = this._currentMain();
    const m = this._currentMini();
    return {
      diff: s.diff,
      total: s.total,
      cleared: s.cleared,
      miniTotal: s.miniTotal,
      miniCleared: s.miniCleared,
      current: g ? {
        id: g.id,
        label: g.label,
        prog: g.progress,
        target: g.target
      } : null,
      currentMini: m ? {
        id: m.id,
        label: m.label,
        prog: m.progress,
        target: m.target
      } : null
    };
  };

  FoodGroupsQuestManager.prototype.getClearedCount = function () {
    return this.clearedMain;
  };

  FoodGroupsQuestManager.prototype.getQuestList = function () {
    return {
      diff: this.diff,
      main: this.mainGoals.map(g => ({
        id: g.id,
        label: g.label,
        diff: g.diff,
        target: g.target,
        progress: g.progress,
        done: g.done === true
      })),
      mini: this.miniQuests.map(m => ({
        id: m.id,
        label: m.label,
        diff: m.diff,
        target: m.target,
        progress: m.progress,
        done: m.done === true
      }))
    };
  };

  // กลับ bonus เป็นคะแนนเพิ่มเล็กน้อยถ้ายิงถูกเป้าที่อยู่ใน quest
  FoodGroupsQuestManager.prototype.notifyHit = function (groupId) {
    groupId = Number(groupId) || 0;

    let bonus = 0;
    let finishedMain = null;
    let mainJustFinished = false;

    // --- อัปเดต main goal ปัจจุบัน ---
    let g = this._currentMain();
    if (g && !g.done && g.groupIds.indexOf(groupId) !== -1) {
      g.hits = (g.hits || 0) + 1;
      g.progress = Math.min(g.target, (g.progress || 0) + 1);
      bonus += 2; // ยิงโดนตามเป้า main ได้ +2

      if (g.progress >= g.target) {
        g.done = true;
        this.clearedMain++;
        finishedMain = g;
        mainJustFinished = true;
        this.currentMainIndex++;
        if (this.currentMainIndex >= this.mainGoals.length) {
          this.currentMainIndex = this.mainGoals.length; // ไม่มีเป้าแล้ว
        }
      }
    }

    // --- อัปเดต mini quest ปัจจุบัน ---
    let mq = this._currentMini();
    if (mq && !mq.done && mq.groupIds.indexOf(groupId) !== -1) {
      mq.hits = (mq.hits || 0) + 1;
      mq.progress = Math.min(mq.target, (mq.progress || 0) + 1);
      bonus += 1; // mini โดนตามเป้า +1

      if (mq.progress >= mq.target) {
        mq.done = true;
        this.clearedMini++;
        this.currentMiniIndex++;
        if (this.currentMiniIndex >= this.miniQuests.length) {
          this.currentMiniIndex = this.miniQuests.length;
        }
      }
    }

    // แจ้ง HUD + โค้ช
    this._emitChange({ justFinished: mainJustFinished, finishedMain });

    return { bonus };
  };

  // (option) ใช้ตอนอยากรีแคป โดยไม่เพิ่ม progress
  FoodGroupsQuestManager.prototype.touch = function () {
    this._emitChange({ justFinished: false });
  };

  ns.FoodGroupsQuestManager = FoodGroupsQuestManager;

})(window.GAME_MODULES || (window.GAME_MODULES = {}));