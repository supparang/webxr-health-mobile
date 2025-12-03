// === vr-groups/quest-manager.js (2025-12-03 Production Ready) ===
// ระบบ Goal / Mini Quest สำหรับ Food Groups VR
// เลือกตามระดับ diff และส่ง event 'quest:update', 'quest:done'

(function (ns) {
  'use strict';

  // ------------------------------------------------------------
  // GOAL POOL
  // ------------------------------------------------------------
  const GOALS = {
    easy: [
      { id: 'veg-3',  label: 'ผัก 3 ชิ้น', group: 'veg',   target: 3 },
      { id: 'fruit-2',label: 'ผลไม้ 2 ชิ้น', group: 'fruit', target: 2 },
      { id: 'grain-2',label: 'ธัญพืช 2 ชิ้น', group: 'grain', target: 2 }
    ],

    normal: [
      { id: 'protein-3', label: 'โปรตีน 3 ชิ้น', group: 'protein', target: 3 },
      { id: 'dairy-2',   label: 'นม/โยเกิร์ต 2 ชิ้น', group: 'dairy', target: 2 },
      { id: 'mix-4',     label: 'อาหารรวม 4 ชิ้น', group: 'mix', target: 4 }
    ],

    hard: [
      { id: 'veg-fruit-5', label: 'ผัก+ผลไม้รวม 5 ชิ้น', group: ['veg','fruit'], target: 5 },
      { id: 'grain-protein-5', label: 'ธัญพืช+โปรตีน 5 ชิ้น', group: ['grain','protein'], target: 5 },
      { id: 'rainbow-6', label: 'กินครบ 5 หมู่รวม 6 ชิ้น', group: ['veg','fruit','grain','protein','dairy'], target: 6 }
    ]
  };

  // ------------------------------------------------------------
  // MINI QUEST POOL (15 แบบ)
  // ------------------------------------------------------------
  const MINIS = {
    easy: [
      { id: 'mini-veg-1',   label: 'ผัก 1 ชิ้น', group: 'veg', target: 1 },
      { id: 'mini-fruit-1', label: 'ผลไม้ 1 ชิ้น', group: 'fruit', target: 1 },
      { id: 'mini-grain-1', label: 'ธัญพืช 1 ชิ้น', group: 'grain', target: 1 },
      { id: 'mini-protein-1', label: 'โปรตีน 1 ชิ้น', group: 'protein', target: 1 },
      { id: 'mini-dairy-1', label: 'นม/โยเกิร์ต 1 ชิ้น', group: 'dairy', target: 1 }
    ],

    normal: [
      { id: 'mini-veg-2', label: 'ผัก 2 ชิ้น', group: 'veg', target: 2 },
      { id: 'mini-fruit-2', label: 'ผลไม้ 2 ชิ้น', group: 'fruit', target: 2 },
      { id: 'mini-mix-3', label: 'อาหารรวม 3 ชิ้น', group: 'mix', target: 3 },
      { id: 'mini-dairy-2', label: 'นม/โยเกิร์ต 2 ชิ้น', group: 'dairy', target: 2 },
      { id: 'mini-protein-2', label: 'โปรตีน 2 ชิ้น', group: 'protein', target: 2 }
    ],

    hard: [
      { id: 'mini-veg-fruit-3', label: 'ผัก+ผลไม้รวม 3 ชิ้น', group: ['veg','fruit'], target: 3 },
      { id: 'mini-protein-grain-3', label: 'โปรตีน+ธัญพืชรวม 3 ชิ้น', group: ['protein','grain'], target: 3 },
      { id: 'mini-5mix', label: 'ครบ 5 หมู่ 5 ชิ้น', group: ['veg','fruit','grain','protein','dairy'], target: 5 },
      { id: 'mini-fast-3', label: 'เร็ว! ยิงถูก 3 ครั้งติด', group: 'any', target: 3, type: 'combo' },
      { id: 'mini-accuracy-4', label: 'ความแม่นยำ 4 ครั้งติด', group: 'any', target: 4, type: 'hitOnly' }
    ]
  };

  // ------------------------------------------------------------
  // ระบบสุ่ม Quest ตามระดับ diff
  // ------------------------------------------------------------
  function pickRandom(list, n) {
    const copy = list.slice();
    const out = [];
    while (copy.length && out.length < n) {
      const i = Math.floor(Math.random()*copy.length);
      out.push(copy.splice(i,1)[0]);
    }
    return out;
  }

  // ------------------------------------------------------------
  // QuestManager class
  // ------------------------------------------------------------
  class QuestManager {
    constructor(diff='normal') {
      this.diff = diff;
      this.goals = pickRandom(GOALS[diff], 2);      // ★ เลือก 2 goal
      this.minis = pickRandom(MINIS[diff], 3);      // ★ เลือก 3 mini quest

      this.currentGoal = 0;
      this.currentMini = 0;

      this.activeGoal = null;
      this.activeMini = null;

      // progress
      this.goalProg = 0;
      this.miniProg = 0;
    }

    // ------------------------------------------------------------
    // เริ่ม Quest ชุดแรก
    // ------------------------------------------------------------
    start() {
      this.activeGoal = this.goals[this.currentGoal];
      this.activeMini = this.minis[this.currentMini];
      this.goalProg = 0;
      this.miniProg = 0;

      this.broadcastUpdate();
      this.broadcastCoach(`🎯 ภารกิจ: ${this.activeGoal.label}`);
    }

    // ------------------------------------------------------------
    // เมื่อยิงโดนเป้า → เช็คว่าตรงกลุ่มไหม
    // ------------------------------------------------------------
    onHit(groupId) {
      // ----- MAIN GOAL -----
      if (this.activeGoal) {
        if (this.matchGroup(this.activeGoal.group, groupId)) {
          this.goalProg++;
          if (this.goalProg >= this.activeGoal.target) {
            this.finishGoal();
          }
        }
      }

      // ----- MINI QUEST -----
      if (this.activeMini) {
        if (this.matchGroup(this.activeMini.group, groupId)) {
          this.miniProg++;
          if (this.miniProg >= this.activeMini.target) {
            this.finishMini();
          }
        }
      }

      this.broadcastUpdate();
    }

    // กลุ่มตรงกันไหม (รองรับ array และ string)
    matchGroup(goalGroup, hitGroup) {
      if (!goalGroup) return false;
      if (Array.isArray(goalGroup)) return goalGroup.includes(hitGroup);
      return goalGroup === hitGroup || goalGroup === 'any';
    }

    // ------------------------------------------------------------
    // จบ Goal หนึ่งอัน
    // ------------------------------------------------------------
    finishGoal() {
      this.broadcastCoach(`🎉 ภารกิจสำเร็จ: ${this.activeGoal.label}`);
      this.currentGoal++;

      if (this.currentGoal >= this.goals.length) {
        this.activeGoal = null; // หมดแล้ว
        this.broadcastCoach(`🏆 ภารกิจหลักครบทั้งหมดแล้ว!`);
      } else {
        this.activeGoal = this.goals[this.currentGoal];
        this.goalProg = 0;
        this.broadcastCoach(`🎯 ภารกิจต่อไป: ${this.activeGoal.label}`);
      }
    }

    // ------------------------------------------------------------
    // จบ Mini Quest หนึ่งอัน
    // ------------------------------------------------------------
    finishMini() {
      this.broadcastCoach(`✨ Mini Quest สำเร็จ: ${this.activeMini.label}`);
      this.currentMini++;

      if (this.currentMini >= this.minis.length) {
        this.activeMini = null;
      } else {
        this.activeMini = this.minis[this.currentMini];
        this.miniProg = 0;
      }
    }

    // ------------------------------------------------------------
    // ส่งข้อมูลให้ HUD
    // ------------------------------------------------------------
    broadcastUpdate() {
      window.dispatchEvent(new CustomEvent('quest:update', {
        detail: {
          goal: this.activeGoal
            ? { label: this.activeGoal.label, prog: this.goalProg, target: this.activeGoal.target }
            : null,

          mini: this.activeMini
            ? { label: this.activeMini.label, prog: this.miniProg, target: this.activeMini.target }
            : null
        }
      }));
    }

    broadcastCoach(text) {
      window.dispatchEvent(new CustomEvent('hha:coach', {
        detail: { text }
      }));
    }
  }

  // export
  ns.foodGroupsQuest = {
    QuestManager
  };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));