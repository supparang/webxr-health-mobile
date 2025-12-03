// === /herohealth/vr-groups/quest-manager.js ===
// Food Groups VR — Quest Manager (2025-12-05)

(function (ns) {
  'use strict';

  // -------------------------------------------------
  // กำหนดชุดข้อมูล Goal / Mini Quest
  // -------------------------------------------------
  const GOALS = {
    easy: [
      { id: 'g1', label: 'เลือกอาหารในหมู่ข้าว-แป้งให้ครบ 5 ชิ้น', target: 5, hint: 'กลุ่มพลังงาน 🍚🥖' },
      { id: 'g2', label: 'เลือกผลไม้สีสันต่าง ๆ ให้ครบ 3 ชนิด', target: 3, hint: 'กลุ่มวิตามิน 🍎🍊🍌' },
      { id: 'g3', label: 'เลือกนมและผลิตภัณฑ์นมให้ครบ 2 ชนิด', target: 2, hint: 'กลุ่มโปรตีนเสริมกระดูก 🥛🧀' },
      { id: 'g4', label: 'เลือกเนื้อสัตว์หรือไข่ให้ครบ 3 ชนิด', target: 3, hint: 'กลุ่มโปรตีน 🥩🍳' },
      { id: 'g5', label: 'เลือกผักใบเขียวให้ครบ 4 ชนิด', target: 4, hint: 'กลุ่มผัก 🥬🥦' }
    ],
    normal: [
      { id: 'g6', label: 'จัดเมนูอาหารเช้าให้ครบ 3 หมู่', target: 3, hint: 'เช้า ๆ ต้องครบ 3 หมู่ 🍞🥚🥛' },
      { id: 'g7', label: 'เลือกอาหารที่ไม่มีของทอดเลย 4 ชิ้น', target: 4, hint: 'งดของทอดเพื่อสุขภาพ 🥗' },
      { id: 'g8', label: 'เลือกผลไม้รวมจากหลายหมู่ให้ครบ 5 ชนิด', target: 5, hint: 'วิตามินรวม 💪🍇🍍' },
      { id: 'g9', label: 'จัดเมนูอาหารเย็นครบ 4 หมู่', target: 4, hint: 'ครบทุกหมู่ก่อนเข้านอน 🍛' },
      { id: 'g10', label: 'เลือกโปรตีนจากพืช 3 ชนิด', target: 3, hint: 'ถั่ว เต้าหู้ ถั่วเหลือง 🌱' }
    ],
    hard: [
      { id: 'g11', label: 'จัดอาหารครบทั้ง 5 หมู่โดยไม่ซ้ำประเภท', target: 5, hint: 'ครบ 5 หมู่ห้ามซ้ำ 🥗🍎🥛🥚🍞' },
      { id: 'g12', label: 'เลือกอาหารที่ไม่มีน้ำตาลเลย 5 ชนิด', target: 5, hint: 'ของหวานห้ามเข้า ❌🍰' },
      { id: 'g13', label: 'จัดเมนูสุขภาพครบ 5 หมู่ในเวลา 30 วินาที', target: 5, hint: 'เร็วแต่ครบ 💪⏱' },
      { id: 'g14', label: 'เลือกอาหารหมู่โปรตีนและผักรวมกัน 6 ชนิด', target: 6, hint: 'โปรตีน+ผัก ผสมผสาน 🥩🥬' },
      { id: 'g15', label: 'จัดอาหารแบบสมดุล 1 จาน', target: 1, hint: '1 จานต้องครบทุกหมู่ 🍽️' }
    ]
  };

  const MINI = {
    easy: [
      { id: 'm1', label: 'เลือกกล้วย 🍌 1 ชิ้น', target: 1 },
      { id: 'm2', label: 'เลือกข้าวสวย 🍚 1 ชิ้น', target: 1 },
      { id: 'm3', label: 'เลือกผักใบเขียว 🥬 2 ชิ้น', target: 2 },
      { id: 'm4', label: 'เลือกปลา 🐟 1 ชิ้น', target: 1 },
      { id: 'm5', label: 'เลือกนม 🥛 1 แก้ว', target: 1 }
    ],
    normal: [
      { id: 'm6', label: 'เลือกผลไม้ 3 ชนิด', target: 3 },
      { id: 'm7', label: 'เลือกเนื้อสัตว์ 2 ชนิด', target: 2 },
      { id: 'm8', label: 'เลือกอาหารไม่ทอด 3 ชนิด', target: 3 },
      { id: 'm9', label: 'เลือกผักหลากสี 3 ชนิด', target: 3 },
      { id: 'm10', label: 'เลือกธัญพืช 2 ชนิด', target: 2 }
    ],
    hard: [
      { id: 'm11', label: 'เลือกอาหารไม่ซ้ำกลุ่ม 5 ชนิด', target: 5 },
      { id: 'm12', label: 'เลือกอาหารโปรตีนและผักรวม 4 ชนิด', target: 4 },
      { id: 'm13', label: 'เลือกอาหารไม่มีไขมันเลย 3 ชนิด', target: 3 },
      { id: 'm14', label: 'เลือกผักผลไม้รวม 6 ชนิด', target: 6 },
      { id: 'm15', label: 'เลือกอาหารครบทุกหมู่ 1 ชุด', target: 5 }
    ]
  };

  // -------------------------------------------------
  // ตัวแปรภายใน
  // -------------------------------------------------
  let currentGoal = null;
  let currentMini = null;
  let miniList = [];
  let progress = { goal: 0, mini: 0 };
  let cleared = { goal: 0, mini: 0 };

  // -------------------------------------------------
  // Helper functions
  // -------------------------------------------------
  function pickRandom(arr, count) {
    const shuffled = arr.slice().sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  function dispatchUpdate() {
    window.dispatchEvent(
      new CustomEvent('quest:update', {
        detail: {
          goal: {
            label: currentGoal?.label,
            prog: progress.goal,
            target: currentGoal?.target,
          },
          mini: {
            label: currentMini?.label,
            prog: progress.mini,
            target: currentMini?.target,
          },
          hint: currentGoal?.hint || ''
        }
      })
    );
  }

  // -------------------------------------------------
  // Public API
  // -------------------------------------------------
  function start(diff = 'normal') {
    const gArr = GOALS[diff] || GOALS.normal;
    const mArr = MINI[diff] || MINI.normal;

    const selectedGoals = pickRandom(gArr, 2);
    miniList = pickRandom(mArr, 3);

    currentGoal = selectedGoals[0];
    currentMini = miniList.shift();
    progress = { goal: 0, mini: 0 };
    cleared = { goal: 0, mini: 0 };

    dispatchUpdate();
  }

  function addProgress(type, val = 1) {
    if (type === 'goal' && currentGoal) {
      progress.goal += val;
      if (progress.goal >= currentGoal.target) {
        cleared.goal += 1;
        progress.goal = currentGoal.target;
        window.dispatchEvent(new CustomEvent('hha:coach', { detail: { text: '🎯 ภารกิจหลักสำเร็จ!' } }));
      }
    }

    if (type === 'mini' && currentMini) {
      progress.mini += val;
      if (progress.mini >= currentMini.target) {
        cleared.mini += 1;
        progress.mini = currentMini.target;
        nextMiniQuest();
      }
    }

    dispatchUpdate();
  }

  function nextMiniQuest() {
    if (miniList.length > 0) {
      currentMini = miniList.shift();
      progress.mini = 0;
      window.dispatchEvent(new CustomEvent('hha:coach', { detail: { text: 'Mini quest ถัดไปเริ่มแล้ว!' } }));
    } else {
      currentMini = null;
      window.dispatchEvent(new CustomEvent('hha:coach', { detail: { text: 'Mini quests ครบแล้ว! ✅' } }));
    }
    dispatchUpdate();
  }

  function finish() {
    window.dispatchEvent(
      new CustomEvent('hha:end', {
        detail: {
          goalsCleared: cleared.goal,
          miniCleared: cleared.mini,
          goalsTotal: 2,
          miniTotal: 3
        }
      })
    );
  }

  ns.foodGroupsQuest = { start, addProgress, nextMiniQuest, finish };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));