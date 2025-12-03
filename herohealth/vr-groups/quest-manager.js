// === vr-groups/quest-manager.js (2025-12-03 Production Ready) ===
// ระบบ Goal + Mini Quest สำหรับ Food Groups VR
// เลือกตามระดับเกม (easy/normal/hard) และสุ่มไม่ซ้ำรอบเดียว

(function (ns) {
  'use strict';

  // -----------------------------------------------------
  // 1) Goal pools (10 แบบ)
  // -----------------------------------------------------
  const GOALS = {
    easy: [
      { id: 'g1', label: 'หมู่ 1 (ข้าว-แป้ง) ให้ครบ 3', group: 1, target: 3 },
      { id: 'g2', label: 'หมู่ 2 (ผัก) ให้ครบ 3',        group: 2, target: 3 },
      { id: 'g3', label: 'หมู่ 3 (ผลไม้) ให้ครบ 3',     group: 3, target: 3 },
      { id: 'g4', label: 'หมู่ 4 (โปรตีน) ให้ครบ 3',    group: 4, target: 3 },
      { id: 'g5', label: 'หมู่ 5 (นม) ให้ครบ 3',         group: 5, target: 3 }
    ],
    normal: [
      { id: 'g6', label: 'หมู่ 1 ให้ครบ 5', group: 1, target: 5 },
      { id: 'g7', label: 'หมู่ 2 ให้ครบ 5', group: 2, target: 5 },
      { id: 'g8', label: 'หมู่ 3 ให้ครบ 5', group: 3, target: 5 },
      { id: 'g9', label: 'หมู่ 4 ให้ครบ 5', group: 4, target: 5 },
      { id: 'g10', label: 'หมู่ 5 ให้ครบ 5', group: 5, target: 5 }
    ],
    hard: [
      { id: 'g11', label: 'โปรตีน + ผัก รวม 6', groups: [2,4], target: 6 },
      { id: 'g12', label: 'ผลไม้ + ธัญพืช รวม 6', groups: [1,3], target: 6 },
      { id: 'g13', label: 'หมู่ดีให้ครบ 8', groups: [1,2,3,4,5], target: 8 },
      { id: 'g14', label: 'โปรตีนอย่างเดียว 7', group: 4, target: 7 },
      { id: 'g15', label: 'นม + ผัก รวม 7', groups: [2,5], target: 7 }
    ]
  };

  // -----------------------------------------------------
  // 2) Mini Quest pools (15 แบบ)
  // -----------------------------------------------------
  const MINI = {
    easy: [
      { id: 'm1',  label: 'ผลไม้ 2',          group: 3, target: 2 },
      { id: 'm2',  label: 'ผัก 2',            group: 2, target: 2 },
      { id: 'm3',  label: 'เลี่ยง Junk 5 วิ', type: 'avoid', duration: 5000 }
    ],
    normal: [
      { id: 'm4',  label: 'โปรตีน 3',         group: 4, target: 3 },
      { id: 'm5',  label: 'ผลไม้ 3',          group: 3, target: 3 },
      { id: 'm6',  label: 'ของดีรวม 4',       groups: [1,2,3,4,5], target: 4 },
      { id: 'm7',  label: 'เลี่ยง Junk 7 วิ', type: 'avoid', duration: 7000 }
    ],
    hard: [
      { id: 'm8',  label: 'ผัก + โปรตีน รวม 5', groups: [2,4], target: 5 },
      { id: 'm9',  label: 'ผลไม้ + นม รวม 5',   groups: [3,5], target: 5 },
      { id: 'm10', label: 'ของดีรวม 6',         groups: [1,2,3,4,5], target: 6 },
      { id: 'm11', label: 'เลี่ยง Junk 10 วิ',  type: 'avoid', duration: 10000 },
      { id: 'm12', label: 'โปรตีน 4',           group: 4, target: 4 }
    ]
  };

  // -----------------------------------------------------
  // Utility
  // -----------------------------------------------------
  function pickOne(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // -----------------------------------------------------
  // QuestManager class
  // -----------------------------------------------------
  class QuestManager {
    constructor(diff = 'normal') {
      this.diff = diff;

      // เลือก goal 1 อัน + mini 1 อัน
      this.goal = JSON.parse(JSON.stringify(pickOne(GOALS[diff])));
      this.mini = JSON.parse(JSON.stringify(pickOne(MINI[diff])));

      this.goal.progress = 0;
      this.mini.progress = 0;

      // สำหรับ mini quest แบบ avoid junk
      this.avoidActive = false;
      this.avoidTimer = null;

      this.dispatchUpdate();
    }

    // ---------------------------------------------------
    // ส่งข้อมูลไป HUD
    // ---------------------------------------------------
    dispatchUpdate() {
      window.dispatchEvent(new CustomEvent('quest:update', {
        detail: {
          goal: {
            label: this.goal.label,
            prog: this.goal.progress,
            target: this.goal.target
          },
          mini: {
            label: this.mini.label,
            prog: this.mini.progress,
            target: this.mini.target || null,
            type: this.mini.type || 'collect'
          }
        }
      }));
    }

    // ---------------------------------------------------
    // ให้ GameEngine แจ้งว่า player ยิงโดนอาหาร
    // ---------------------------------------------------
    onHit(ev) {
      const g = ev.groupId;
      const isGood = ev.isGood;

      // ----- Goal แบบ group เดี่ยว -----
      if (this.goal.group && g === this.goal.group) {
        this.goal.progress++;
      }

      // ----- Goal แบบหลายกลุ่ม -----
      if (this.goal.groups && this.goal.groups.includes(g)) {
        this.goal.progress++;
      }

      // ----- Mini collect -----
      if (!this.mini.type || this.mini.type === 'collect') {
        if (this.mini.group && g === this.mini.group) {
          this.mini.progress++;
        }
        if (this.mini.groups && this.mini.groups.includes(g)) {
          this.mini.progress++;
        }
      }

      // ----- Mini avoid -----
      if (this.mini.type === 'avoid') {
        if (!isGood) {
          // โดน junk = ล้มเหลว → reset timer
          this.startAvoidMode(this.mini.duration);
        }
      }

      this.checkClear();
      this.dispatchUpdate();
    }

    // ---------------------------------------------------
    // Mini quest แบบ Avoid (เลี่ยง Junk)
    // ---------------------------------------------------
    startAvoidMode(duration) {
      this.mini.progress = 0;
      this.avoidActive = true;

      if (this.avoidTimer) clearTimeout(this.avoidTimer);

      this.avoidTimer = setTimeout(() => {
        this.mini.progress = this.mini.target || 1;
        this.checkClear();
        this.dispatchUpdate();
      }, duration);
    }

    // ---------------------------------------------------
    // ตรวจว่า goal / mini ผ่านหรือยัง
    // ---------------------------------------------------
    checkClear() {
      if (!this.goal.cleared && this.goal.progress >= this.goal.target) {
        this.goal.cleared = true;
        window.dispatchEvent(new CustomEvent('quest:clear-goal', {
          detail: { goal: this.goal }
        }));
      }

      if (!this.mini.cleared &&
          (!this.mini.type || this.mini.type === 'collect') &&
          this.mini.progress >= this.mini.target) {
        this.mini.cleared = true;
        window.dispatchEvent(new CustomEvent('quest:clear-mini', {
          detail: { mini: this.mini }
        }));
      }

      if (!this.mini.cleared && this.mini.type === 'avoid') {
        if (this.mini.progress >= (this.mini.target || 1)) {
          this.mini.cleared = true;
          window.dispatchEvent(new CustomEvent('quest:clear-mini', {
            detail: { mini: this.mini }
          }));
        }
      }
    }

    // ---------------------------------------------------
    // ส่งสรุปให้ GameEngine บันทึกลง session
    // ---------------------------------------------------
    exportSummary() {
      return {
        goal: this.goal,
        mini: this.mini
      };
    }
  }

  ns.FoodGroupsQuestManager = QuestManager;

})(window.GAME_MODULES || (window.GAME_MODULES = {}));