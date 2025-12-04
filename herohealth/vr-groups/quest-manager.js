// === /herohealth/vr-groups/quest-manager.js ===
// Food Groups VR — Quest Manager (10 Goals + 15 Mini Quests)
// 2025-12-05

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
    window.dispatchEvent(new CustomEvent('hha:coach', {
      detail: { text }
    }));
  }

  function emitQuestUpdate(payload) {
    window.dispatchEvent(new CustomEvent('quest:update', {
      detail: payload
    }));
  }

  // ------------------------------------------------------------
  // Goal / Mini quest templates
  // level: 'easy' | 'normal' | 'hard'
  // type : 'any' | 'good' | 'group' | 'uniqueGroups'
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

  function cloneQuestTemplate(tpl) {
    const q = {
      id: tpl.id,
      level: tpl.level,
      type: tpl.type,
      groupId: tpl.groupId || 0,
      target: tpl.target,
      label: tpl.label,
      hint: tpl.hint || '',
      prog: 0
    };
    if (tpl.type === 'uniqueGroups') {
      q._groupsHit = {}; // {groupId: true}
    }
    return q;
  }

  function applyHitToQuest(q, hit) {
    if (!q || !hit) return false;

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
    if (q.target && q.prog > q.target) q.prog = q.target;
    return changed;
  }

  function GroupsQuestManager() {
    this.diff = 'normal';

    this.goalsPick = 2;
    this.minisPick = 3;

    this._goalPool = [];
    this._miniPool = [];

    this.goalIndex = 0;
    this.miniIndex = 0;

    this.currentGoal = null;
    this.currentMini = null;

    this.clearedGoals = 0;
    this.clearedMinis = 0;
    this.totalGoals = 0;
    this.totalMinis = 0;
  }

  GroupsQuestManager.prototype.start = function (diffKey, cfg) {
    this.diff = String(diffKey || 'normal').toLowerCase();

    const qc = (cfg && cfg.quest) || {};
    this.goalsPick = qc.goalsPick || 2;
    this.minisPick = qc.miniPick || 3;

    this._goalPool = shuffle(
      GOALS.filter(q => q.level === this.diff)
    );
    this._miniPool = shuffle(
      MINIS.filter(q => q.level === this.diff)
    );

    this.totalGoals = Math.min(this.goalsPick, this._goalPool.length);
    this.totalMinis = Math.min(this.minisPick, this._miniPool.length);

    this.goalIndex = 0;
    this.miniIndex = 0;
    this.clearedGoals = 0;
    this.clearedMinis = 0;

    this.currentGoal = this._nextGoal();
    this.currentMini = this._nextMini();

    let intro = 'ภารกิจวันนี้: ';
    if (this.currentGoal) intro += this.currentGoal.label;
    coach(intro);

    this._emitUpdate();
  };

  GroupsQuestManager.prototype._nextGoal = function () {
    if (this.goalIndex >= this.totalGoals) return null;
    const tpl = this._goalPool[this.goalIndex++];
    return tpl ? cloneQuestTemplate(tpl) : null;
  };

  GroupsQuestManager.prototype._nextMini = function () {
    if (this.miniIndex >= this.totalMinis) return null;
    const tpl = this._miniPool[this.miniIndex++];
    return tpl ? cloneQuestTemplate(tpl) : null;
  };

  GroupsQuestManager.prototype.onHit = function (hit) {
    let needUpdate = false;

    // goal
    if (this.currentGoal) {
      const changed = applyHitToQuest(this.currentGoal, hit);
      if (changed) needUpdate = true;

      if (this.currentGoal.prog >= this.currentGoal.target) {
        coach('🎉 Goal สำเร็จแล้ว! ' + this.currentGoal.label);
        this.clearedGoals++;
        this.currentGoal = this._nextGoal();
        needUpdate = true;
      }
    }

    // mini quest
    if (this.currentMini) {
      const changed = applyHitToQuest(this.currentMini, hit);
      if (changed) needUpdate = true;

      if (this.currentMini.prog >= this.currentMini.target) {
        coach('✅ Mini quest สำเร็จ: ' + this.currentMini.label);
        this.clearedMinis++;
        this.currentMini = this._nextMini();
        needUpdate = true;
      }
    }

    if (needUpdate) {
      this._emitUpdate();
    }
  };

  GroupsQuestManager.prototype._emitUpdate = function () {
    const payload = {
      goal: this.currentGoal
        ? {
            label: this.currentGoal.label,
            prog: this.currentGoal.prog,
            target: this.currentGoal.target
          }
        : null,
      mini: this.currentMini
        ? {
            label: this.currentMini.label,
            prog: this.currentMini.prog,
            target: this.currentMini.target
          }
        : null,
      hint:
        (this.currentGoal && this.currentGoal.hint) ||
        (this.currentMini && this.currentMini.hint) ||
        ''
    };

    emitQuestUpdate(payload);
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
