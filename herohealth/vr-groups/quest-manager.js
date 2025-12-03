// === /herohealth/vr-groups/quest-manager.js ===
// Food Groups VR — Goal & Mini Quest Manager
// รองรับ Goal 10 แบบ + Mini Quest 15 แบบ
// เลือกตามระดับความยาก → easy: ง่าย, normal: ปกติ, hard: ยาก
// Production Ready (2025-12-05)

(function (ns) {
  'use strict';

  //--------------------------------------------------------------------
  // ★ 1) POOL ของ GOAL ทั้ง 10 แบบ แบ่งตามระดับ
  //--------------------------------------------------------------------
  const GOAL_POOL = {
    easy: [
      { id: 'g1', label: 'ยิงผักให้ครบ 8 ชิ้น', groupId: 2, target: 8 },
      { id: 'g2', label: 'เลือกผลไม้ให้ครบ 8 ชิ้น', groupId: 3, target: 8 },
      { id: 'g3', label: 'หาอาหารโปรตีนดี ๆ 6 ชิ้น', groupId: 4, target: 6 }
    ],
    normal: [
      { id: 'g4', label: 'ธัญพืช 10 ชิ้น', groupId: 1, target: 10 },
      { id: 'g5', label: 'ผักรวม 12 ชิ้น', groupId: 2, target: 12 },
      { id: 'g6', label: 'ผลไม้รวม 12 ชิ้น', groupId: 3, target: 12 }
    ],
    hard: [
      { id: 'g7', label: 'โปรตีนรวม 14 ชิ้น', groupId: 4, target: 14 },
      { id: 'g8', label: 'นมและผลิตภัณฑ์ 10 ชิ้น', groupId: 5, target: 10 },
      { id: 'g9', label: 'สุ่มอาหารดีตามที่ขึ้นมา 18 ชิ้น', groupId: null, target: 18 },
      { id: 'g10', label: 'หลีกเลี่ยง Junk ทั้งหมด ยิงแต่ Good 15 ชิ้น', groupId: null, target: 15 }
    ]
  };

  //--------------------------------------------------------------------
  // ★ 2) POOL ของ MINI QUEST ทั้ง 15 แบบ แบ่งตามระดับ
  //--------------------------------------------------------------------
  const MINI_POOL = {
    easy: [
      { id: 'm1', label: 'หลีกเลี่ยง Junk 10 วินาที', type: 'avoid', sec: 10 },
      { id: 'm2', label: 'เก็บผักติดกัน 3 ชิ้น', type: 'comboGroup', groupId: 2, count: 3 },
      { id: 'm3', label: 'แตะผลไม้ 4 ชิ้น', type: 'hitGroup', groupId: 3, count: 4 }
    ],
    normal: [
      { id: 'm4', label: 'เก็บโปรตีน 6 ชิ้น', type: 'hitGroup', groupId: 4, count: 6 },
      { id: 'm5', label: 'ทำคอมโบ 5 ครั้ง', type: 'combo', count: 5 },
      { id: 'm6', label: 'แตะอาหารดี 8 ชิ้นติด', type: 'goodCombo', count: 8 }
    ],
    hard: [
      { id: 'm7', label: 'หลีกเลี่ยง Junk 20 วินาที', type: 'avoid', sec: 20 },
      { id: 'm8', label: 'แตะอาหารดี 12 ชิ้น', type: 'hitGood', count: 12 },
      { id: 'm9', label: 'โปรตีน + ผลไม้ รวม 14 ชิ้น', type: 'multiGroup', groups: [3,4], count: 14 },
      { id: 'm10', label: 'คอมโบ 10 ครั้งติด', type: 'combo', count: 10 },
      { id: 'm11', label: 'งดพลาด 15 วินาที', type: 'noMiss', sec: 15 }
    ]
  };

  //--------------------------------------------------------------------
  // utility — random pick
  //--------------------------------------------------------------------
  function pickRandom(arr, n) {
    const copy = arr.slice();
    const out = [];
    for (let i = 0; i < n && copy.length > 0; i++) {
      const idx = (Math.random() * copy.length) | 0;
      out.push(copy.splice(idx, 1)[0]);
    }
    return out;
  }

  //--------------------------------------------------------------------
  // คลาส Quest Manager
  //--------------------------------------------------------------------
  class FoodGroupsQuestManager {
    constructor(onChange) {
      this.onChange = onChange;
      this.diff = 'normal';
      this.goal = null;
      this.mini = null;

      this.miniList = [];
      this.goalList = [];

      this.state = {
        goalCleared: 0,
        miniCleared: 0
      };
    }

    //----------------------------------------------------------------
    // เรียกเมื่อ GameEngine.start(diff)
    //----------------------------------------------------------------
    reset(diff = 'normal') {
      this.diff = diff;

      // เลือก 1 goal จากระดับนั้น ๆ
      const gPool = GOAL_POOL[diff] || GOAL_POOL.normal;
      this.goalList = pickRandom(gPool, 2);   // --- ★ เลือก 2 goal ตามที่สั่ง
      this.goal = this.goalList[0];
      this.goal.prog = 0;

      // เลือก 3 mini จากระดับนั้น ๆ
      const mPool = MINI_POOL[diff] || MINI_POOL.normal;
      this.miniList = pickRandom(mPool, 3);   // --- ★ เลือก 3 mini quest
      this.mini = this.miniList[0];
      this.mini.prog = 0;

      this.state = {
        goalCleared: 0,
        miniCleared: 0
      };

      this._emit();
    }

    //----------------------------------------------------------------
    // ระบบ update เมื่อยิงโดนเป้า
    //----------------------------------------------------------------
    notifyHit(groupId) {
      let bonus = 0;

      // ----- update Goal -----
      if (this.goal && !this._goalDone) {
        if (this.goal.groupId === null || this.goal.groupId === groupId) {
          this.goal.prog++;
          if (this.goal.prog >= this.goal.target) {
            this._goalDone = true;
            this.state.goalCleared++;
            bonus += 5; // +คะแนน

            // ไป goal ถัดไป ถ้ามี
            const idx = this.goalList.indexOf(this.goal);
            if (idx + 1 < this.goalList.length) {
              this.goal = this.goalList[idx + 1];
              this.goal.prog = 0;
              this._goalDone = false;
            }
          }
        }
      }

      // ----- update Mini quest -----
      if (this.mini && !this._miniDone) {
        const m = this.mini;

        switch (m.type) {

          case 'hitGroup':
            if (m.groupId === groupId) {
              m.prog++;
            }
            break;

          case 'hitGood':
            if (ns.foodGroupsEmoji) {
              // ตรวจว่ากลุ่มนี้เป็นอาหารดีไหม
              const found = ns.foodGroupsEmoji.all.find(x => x.id === groupId);
              if (found && found.isGood) m.prog++;
            }
            break;

          case 'multiGroup':
            if (m.groups.includes(groupId)) m.prog++;
            break;

          case 'comboGroup':
            if (m.groupId === groupId) m.prog++;
            break;

          case 'goodCombo':
            if (ns.foodGroupsEmoji) {
              const found = ns.foodGroupsEmoji.all.find(x => x.id === groupId);
              if (found && found.isGood) m.prog++;
            }
            break;

          default:
            break;
        }

        if (m.prog >= (m.count || m.target || 0)) {
          this._miniDone = true;
          this.state.miniCleared++;
          bonus += 3;

          // mini quest ถัดไป
          const idx = this.miniList.indexOf(this.mini);
          if (idx + 1 < this.miniList.length) {
            this.mini = this.miniList[idx + 1];
            this.mini.prog = 0;
            this._miniDone = false;
          }
        }
      }

      this._emit();
      return { bonus };
    }

    notifyMiss() {
      // ถ้า mini quest เป็นประเภทห้ามพลาด
      if (this.mini && this.mini.type === 'noMiss') {
        this.mini.prog = 0; // รีเซ็ตทันที
        this._emit();
      }
    }

    //----------------------------------------------------------------
    // ส่ง event ให้ HUD + Coach + GameEngine
    //----------------------------------------------------------------
    _emit() {
      const detail = {
        goal: this.goal,
        mini: this.mini,
        status: this.getStatus(),
        hint: this._buildHint()
      };

      window.dispatchEvent(new CustomEvent('quest:update', { detail }));
      if (this.onChange) {
        this.onChange(this.goal, this.goal?.prog, false, null);
      }
    }

    //----------------------------------------------------------------
    getStatus() {
      return {
        total: this.goalList.length + this.miniList.length,
        goalCleared: this.state.goalCleared,
        miniCleared: this.state.miniCleared
      };
    }

    //----------------------------------------------------------------
    _buildHint() {
      if (!this.goal) return '';
      if (this.goal.groupId) {
        return `กำลังทำภารกิจกลุ่มที่ ${this.goal.groupId}`;
      }
      return 'ทำภารกิจตามที่โค้ชบอกเลย!';
    }
  }

  ns.FoodGroupsQuestManager = FoodGroupsQuestManager;

})(window.GAME_MODULES || (window.GAME_MODULES = {}));