// === /herohealth/vr-groups/quest-manager.js ===
// Food Groups VR — Quest Manager (Goals + Mini Quests + Celebrate + All-Complete)
// 2025-12-13

(function (ns) {
  'use strict';

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  function shuffle(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = out[i];
      out[i] = out[j];
      out[j] = t;
    }
    return out;
  }

  function coach(text) {
    if (!text) return;
    try {
      window.dispatchEvent(new CustomEvent('hha:coach', {
        detail: { text }
      }));
    } catch (_) {}
  }

  function emitQuestUpdate(payload) {
    try {
      window.dispatchEvent(new CustomEvent('quest:update', {
        detail: payload
      }));
    } catch (_) {}
  }

  function emitQuestCelebrate(kind, index, total) {
    try {
      window.dispatchEvent(new CustomEvent('quest:celebrate', {
        detail: { kind, index, total }
      }));
    } catch (_) {}
  }

  function emitQuestAllComplete(summary) {
    try {
      window.dispatchEvent(new CustomEvent('quest:all-complete', {
        detail: summary
      }));
    } catch (_) {}
  }

  // ------------------------------------------------------------
  // Goal / Mini quest templates
  // level: 'easy' | 'normal' | 'hard'
  // type : 'any' | 'good' | 'group' | 'uniqueGroups'
  // groupId: 1..5 ตามหมู่อาหาร
  // ------------------------------------------------------------

  const GOALS = [
    // ----- EASY -----
    {
      id: 'g1',
      level: 'easy',
      type: 'good',
      target: 8,
      label: 'เก็บอาหารดีให้ครบ 8 ชิ้น',
      hint: 'เลือกยิงเฉพาะอาหารที่ดีต่อสุขภาพ'
    },
    {
      id: 'g2',
      level: 'easy',
      type: 'group',
      groupId: 3,
      target: 4,
      label: 'เก็บผลไม้ (หมู่ 3) ให้ครบ 4 ชิ้น',
      hint: 'มองหาสัญลักษณ์ผลไม้ เช่น 🍎🍊🍇'
    },
    {
      id: 'g3',
      level: 'easy',
      type: 'any',
      target: 10,
      label: 'ยิงอาหารให้ครบ 10 ชิ้น',
      hint: 'ลองเล็งเป้าให้ไวขึ้นทีละนิด'
    },

    // ----- NORMAL -----
    {
      id: 'g4',
      level: 'normal',
      type: 'good',
      target: 12,
      label: 'เก็บอาหารดีให้ครบ 12 ชิ้น',
      hint: 'โฟกัสที่อาหารดีและหลบอาหารควรลด'
    },
    {
      id: 'g5',
      level: 'normal',
      type: 'group',
      groupId: 2,
      target: 5,
      label: 'เก็บผัก (หมู่ 2) ให้ครบ 5 ชิ้น',
      hint: 'เล็งที่ผักใบเขียว 🥦🥬🥕'
    },
    {
      id: 'g6',
      level: 'normal',
      type: 'group',
      groupId: 4,
      target: 5,
      label: 'เก็บโปรตีน (หมู่ 4) ให้ครบ 5 ชิ้น',
      hint: 'มองหา ปลา ไข่ ถั่ว เช่น 🐟🥚🫘'
    },
    {
      id: 'g7',
      level: 'normal',
      type: 'uniqueGroups',
      target: 4,
      label: 'เก็บอาหารดีให้ครบ 4 หมู่ที่แตกต่างกัน',
      hint: 'ลองเก็บให้ครบหลายหมู่ ทั้งข้าว ผัก ผลไม้ โปรตีน'
    },

    // ----- HARD -----
    {
      id: 'g8',
      level: 'hard',
      type: 'good',
      target: 15,
      label: 'เก็บอาหารดีให้ครบ 15 ชิ้น',
      hint: 'ต้องเล็งเร็วและแม่น เลือกอาหารดีเท่านั้น'
    },
    {
      id: 'g9',
      level: 'hard',
      type: 'group',
      groupId: 5,
      target: 6,
      label: 'เก็บนมและผลิตภัณฑ์นม (หมู่ 5) ให้ครบ 6 ชิ้น',
      hint: 'มองหาสัญลักษณ์แก้วนม ชีส ไอศกรีม 🥛🧀🍦'
    },
    {
      id: 'g10',
      level: 'hard',
      type: 'uniqueGroups',
      target: 5,
      label: 'เก็บอาหารดีให้ครบทั้ง 5 หมู่',
      hint: 'เก็บให้ครบทั้ง ข้าว ผัก ผลไม้ โปรตีน และนม'
    }
  ];

  const MINIS = [
    // ----- EASY -----
    {
      id: 'm1',
      level: 'easy',
      type: 'group',
      groupId: 2,
      target: 3,
      label: 'เก็บผัก (หมู่ 2) ให้ครบ 3 ชิ้น'
    },
    {
      id: 'm2',
      level: 'easy',
      type: 'group',
      groupId: 3,
      target: 3,
      label: 'เก็บผลไม้ (หมู่ 3) ให้ครบ 3 ชิ้น'
    },
    {
      id: 'm3',
      level: 'easy',
      type: 'good',
      target: 5,
      label: 'เก็บอาหารดี 5 ชิ้น'
    },
    {
      id: 'm4',
      level: 'easy',
      type: 'any',
      target: 6,
      label: 'ยิงอาหารให้ครบ 6 ชิ้น'
    },
    {
      id: 'm5',
      level: 'easy',
      type: 'group',
      groupId: 1,
      target: 3,
      label: 'เก็บข้าว/แป้ง (หมู่ 1) ให้ครบ 3 ชิ้น'
    },

    // ----- NORMAL -----
    {
      id: 'm6',
      level: 'normal',
      type: 'good',
      target: 7,
      label: 'เก็บอาหารดี 7 ชิ้น'
    },
    {
      id: 'm7',
      level: 'normal',
      type: 'group',
      groupId: 4,
      target: 4,
      label: 'เก็บโปรตีน (หมู่ 4) ให้ครบ 4 ชิ้น'
    },
    {
      id: 'm8',
      level: 'normal',
      type: 'group',
      groupId: 3,
      target: 4,
      label: 'เก็บผลไม้ 4 ชิ้น'
    },
    {
      id: 'm9',
      level: 'normal',
      type: 'uniqueGroups',
      target: 3,
      label: 'เก็บอาหารดีจาก 3 หมู่ที่แตกต่างกัน'
    },
    {
      id: 'm10',
      level: 'normal',
      type: 'any',
      target: 8,
      label: 'ยิงอาหารให้ครบ 8 ชิ้น'
    },

    // ----- HARD -----
    {
      id: 'm11',
      level: 'hard',
      type: 'good',
      target: 10,
      label: 'เก็บอาหารดี 10 ชิ้น'
    },
    {
      id: 'm12',
      level: 'hard',
      type: 'group',
      groupId: 2,
      target: 5,
      label: 'เก็บผัก (หมู่ 2) 5 ชิ้น'
    },
    {
      id: 'm13',
      level: 'hard',
      type: 'group',
      groupId: 5,
      target: 4,
      label: 'เก็บนม/ผลิตภัณฑ์นม (หมู่ 5) 4 ชิ้น'
    },
    {
      id: 'm14',
      level: 'hard',
      type: 'uniqueGroups',
      target: 4,
      label: 'เก็บอาหารดีจาก 4 หมู่ที่แตกต่างกัน'
    },
    {
      id: 'm15',
      level: 'hard',
      type: 'any',
      target: 12,
      label: 'ยิงอาหารให้ครบ 12 ชิ้น'
    }
  ];

  // ------------------------------------------------------------
  // GroupsQuestManager
  // ------------------------------------------------------------

  const DEFAULT_GOAL_LIMIT = 2;  // จำกัดจำนวน Goal ทั้งเกม
  const DEFAULT_MINI_LIMIT = 3;  // จำกัดจำนวน Mini ทั้งเกม

  function cloneQuestTemplate(tpl) {
    const q = {
      id: tpl.id,
      level: tpl.level,
      type: tpl.type,
      groupId: tpl.groupId || 0,
      target: tpl.target,
      label: tpl.label,
      hint: tpl.hint || '',
      prog: 0,
      done: false
    };
    if (tpl.type === 'uniqueGroups') {
      q._groupsHit = {}; // {groupId: true}
    }
    return q;
  }

  function applyHitToQuest(q, hit) {
    if (!q || !hit || q.done) return false;

    const g = hit.groupId;
    const isGood = !!hit.isGood;
    let changed = false;

    switch (q.type) {
      case 'any':
        q.prog++;
        changed = true;
        break;

      case 'good':
        if (isGood) {
          q.prog++;
          changed = true;
        }
        break;

      case 'group':
        if (g === q.groupId) {
          q.prog++;
          changed = true;
        }
        break;

      case 'uniqueGroups':
        if (isGood && g > 0) {
          if (!q._groupsHit) q._groupsHit = {};
          if (!q._groupsHit[g]) {
            q._groupsHit[g] = true;
            q.prog = Object.keys(q._groupsHit).length;
            changed = true;
          }
        }
        break;
    }

    if (q.prog < 0) q.prog = 0;
    if (q.target && q.prog >= q.target) {
      q.prog = q.target;
      q.done = true;
      changed = true;
    }

    return changed;
  }

  function serializeQuest(q) {
    if (!q) return null;
    return {
      id: q.id,
      label: q.label,
      prog: q.prog,
      target: q.target,
      done: !!q.done,
      level: q.level,
      type: q.type,
      groupId: q.groupId || 0
    };
  }

  function GroupsQuestManager() {
    this.diff = 'normal';

    this.goalsPick = 2;
    this.minisPick = 3;

    this.goalLimit = DEFAULT_GOAL_LIMIT;
    this.miniLimit = DEFAULT_MINI_LIMIT;

    this._goalPool = [];
    this._miniPool = [];

    this._goalsAll = [];
    this._minisAll = [];

    this.goalIndex = 0;
    this.miniIndex = 0;

    this.currentGoal = null;
    this.currentMini = null;

    this.clearedGoals = 0;
    this.clearedMinis = 0;
    this.totalGoals = 0;
    this.totalMinis = 0;

    this._allCompleteEmitted = false;
  }

  GroupsQuestManager.prototype.start = function (diffKey, cfg) {
    this.diff = String(diffKey || 'normal').toLowerCase();

    const qc = (cfg && cfg.quest) || {};
    this.goalsPick = qc.goalsPick || 2;
    this.minisPick = qc.miniPick || 3;

    this.goalLimit = Number.isFinite(qc.goalLimit)
      ? qc.goalLimit
      : DEFAULT_GOAL_LIMIT;
    this.miniLimit = Number.isFinite(qc.miniLimit)
      ? qc.miniLimit
      : DEFAULT_MINI_LIMIT;

    // สุ่ม pool ตามระดับความยาก
    this._goalPool = shuffle(
      GOALS.filter(q => q.level === this.diff)
    );
    this._miniPool = shuffle(
      MINIS.filter(q => q.level === this.diff)
    );

    // เลือกชุดที่จะใช้จริงในเกม (จำกัดตาม goalLimit/miniLimit)
    this.totalGoals = Math.min(this.goalsPick, this.goalLimit, this._goalPool.length);
    this.totalMinis = Math.min(this.minisPick, this.miniLimit, this._miniPool.length);

    this._goalsAll = [];
    this._minisAll = [];

    for (let i = 0; i < this.totalGoals; i++) {
      const tpl = this._goalPool[i];
      if (tpl) this._goalsAll.push(cloneQuestTemplate(tpl));
    }
    for (let i = 0; i < this.totalMinis; i++) {
      const tpl = this._miniPool[i];
      if (tpl) this._minisAll.push(cloneQuestTemplate(tpl));
    }

    this.goalIndex = 0;
    this.miniIndex = 0;
    this.clearedGoals = 0;
    this.clearedMinis = 0;
    this._allCompleteEmitted = false;

    this.currentGoal = this._goalsAll[0] || null;
    this.currentMini = this._minisAll[0] || null;

    let intro = 'ภารกิจวันนี้: ';
    if (this.currentGoal) {
      intro += this.currentGoal.label;
    } else if (this.currentMini) {
      intro += this.currentMini.label;
    }
    coach(intro);

    this._emitUpdate();
  };

  GroupsQuestManager.prototype._emitUpdate = function () {
    const payload = {
      goal: serializeQuest(this.currentGoal),
      mini: serializeQuest(this.currentMini),
      goalsAll: this._goalsAll.map(serializeQuest),
      minisAll: this._minisAll.map(serializeQuest),
      hint:
        (this.currentGoal && this.currentGoal.hint) ||
        (this.currentMini && this.currentMini.hint) ||
        ''
    };

    emitQuestUpdate(payload);
  };

  GroupsQuestManager.prototype._checkAllComplete = function () {
    if (this._allCompleteEmitted) return;
    if (this.totalGoals === 0 && this.totalMinis === 0) return;

    if (this.clearedGoals >= this.totalGoals &&
        this.clearedMinis >= this.totalMinis) {
      this._allCompleteEmitted = true;

      const summary = this.getSummary();
      emitQuestAllComplete({
        goalsTotal: this.totalGoals,
        minisTotal: this.totalMinis,
        goalsCleared: this.clearedGoals,
        minisCleared: this.clearedMinis,
        ...summary
      });
    }
  };

  GroupsQuestManager.prototype.onHit = function (hit) {
    let needUpdate = false;

    // ----- Goal -----
    if (this.currentGoal) {
      const changed = applyHitToQuest(this.currentGoal, hit);
      if (changed) needUpdate = true;

      if (this.currentGoal.done) {
        this.clearedGoals++;
        const idx = this.clearedGoals; // 1-based
        emitQuestCelebrate('goal', idx, this.totalGoals);

        this.goalIndex++;
        this.currentGoal = this._goalsAll[this.goalIndex] || null;
        needUpdate = true;
      }
    }

    // ----- Mini quest -----
    if (this.currentMini) {
      const changedM = applyHitToQuest(this.currentMini, hit);
      if (changedM) needUpdate = true;

      if (this.currentMini.done) {
        this.clearedMinis++;
        const idxM = this.clearedMinis; // 1-based
        emitQuestCelebrate('mini', idxM, this.totalMinis);

        this.miniIndex++;
        this.currentMini = this._minisAll[this.miniIndex] || null;
        needUpdate = true;
      }
    }

    if (needUpdate) {
      this._emitUpdate();
      this._checkAllComplete();
    }
  };

  GroupsQuestManager.prototype.getSummary = function () {
    return {
      cleared: this.clearedGoals + this.clearedMinis,
      total: this.totalGoals + this.totalMinis,
      clearedGoals: this.clearedGoals,
      clearedMinis: this.clearedMinis,
      totalGoals: this.totalGoals,
      totalMinis: this.totalMinis
    };
  };

  // ------------------------------------------------------------
  ns.GroupsQuestManager = GroupsQuestManager;
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
