// === /herohealth/vr-groups/quest-manager.js ===
// Food Groups VR — Quest Manager (2025-12-04)

'use strict';

window.GAME_MODULES = window.GAME_MODULES || {};
const ns = window.GAME_MODULES;

/***************************************************
 * 1) ฐานข้อมูล GOALS (ภารกิจหลัก)
 ***************************************************/
const GOALS = [
  // ---------- EASY ----------
  {
    id: 'g1', level: 'easy',
    label: 'ยิงผักใบเขียวให้ได้',
    groups: [2],
    emoji: '🥬',
    target: 4
  },
  {
    id: 'g2', level: 'easy',
    label: 'เลือกผลไม้ 5 หมู่ที่ดีต่อสุขภาพ',
    groups: [3],
    emoji: '🍉',
    target: 4
  },
  {
    id: 'g3', level: 'easy',
    label: 'โปรตีนดี ๆ ช่วยซ่อมแซมร่างกาย',
    groups: [4],
    emoji: '🍗',
    target: 4
  },

  // ---------- NORMAL ----------
  {
    id: 'g4', level: 'normal',
    label: 'เลือกอาหารหมู่ 1 ให้ครบปริมาณ',
    groups: [1],
    emoji: '🍚',
    target: 5
  },
  {
    id: 'g5', level: 'normal',
    label: 'กินผักผลไม้ผสมรวมอย่างน้อย',
    groups: [2,3],
    emoji: '🥦',
    target: 6
  },
  {
    id: 'g6', level: 'normal',
    label: 'ยิงโปรตีนให้ครบทั้ง 5 แบบ',
    groups: [4],
    emoji: '🐟',
    target: 5
  },
  {
    id: 'g7', level: 'normal',
    label: 'เลือกนมและผลิตภัณฑ์นมให้มากขึ้น',
    groups: [5],
    emoji: '🥛',
    target: 5
  },

  // ---------- HARD ----------
  {
    id: 'g8', level: 'hard',
    label: 'เลือกอาหารดีจาก 3 หมู่ที่กำหนด',
    groups: [1,3,4],
    emoji: '🍚',
    target: 7
  },
  {
    id: 'g9', level: 'hard',
    label: 'ผัก ผลไม้ โปรตีน อย่างละอย่าง',
    groups: [2,3,4],
    emoji: '🥦',
    target: 9
  },
  {
    id: 'g10', level: 'hard',
    label: 'ภารกิจผสมขั้นสูง เลี่ยงของหวานทั้งหมด',
    groups: [1,2,3,4,5],
    emoji: '🍇',
    target: 8
  }
];

/***************************************************
 * 2) MINi QUEST (15 แบบ)
 ***************************************************/
const MINI = [
  // EASY mini
  { id:'m1', level:'easy', label:'ยิงผัก 2 ชนิด', groups:[2], target:2, emoji:'🥕' },
  { id:'m2', level:'easy', label:'ผลไม้คู่เพื่อนรัก', groups:[3], target:2, emoji:'🍌' },
  { id:'m3', level:'easy', label:'เลือกโปรตีน 2 อย่าง', groups:[4], target:2, emoji:'🐟' },

  // NORMAL mini
  { id:'m4', level:'normal', label:'โปรตีน + ผลไม้ อย่างละ 1', groups:[3,4], target:2, emoji:'🍗' },
  { id:'m5', level:'normal', label:'เลี่ยงของทอดให้หมด', badGroups:[9], target:3, emoji:'🍟' },
  { id:'m6', level:'normal', label:'เลือกอาหารหมู่ 5 ให้ครบ 3 ครั้ง', groups:[5], target:3, emoji:'🥛' },
  { id:'m7', level:'normal', label:'กินผักผสม 3 ชนิด', groups:[2], target:3, emoji:'🥬' },
  { id:'m8', level:'normal', label:'เลือกธัญพืชครบ 3', groups:[1], target:3, emoji:'🌽' },

  // HARD mini
  { id:'m9',  level:'hard', label:'ยิงอาหารดีสลับกัน 5 ครั้ง', groups:[1,2,3,4,5], target:5, emoji:'🍱' },
  { id:'m10', level:'hard', label:'เลี่ยงอาหารหวานทั้งหมด', badGroups:[9], target:5, emoji:'🧋' },
  { id:'m11', level:'hard', label:'ยิงโปรตีน 4 แบบ', groups:[4], target:4, emoji:'🍗' },
  { id:'m12', level:'hard', label:'ผัก–ผลไม้ รวม 6 ครั้ง', groups:[2,3], target:6, emoji:'🥗' },
  { id:'m13', level:'hard', label:'ธัญพืช + โปรตีน รวม 6 ครั้ง', groups:[1,4], target:6, emoji:'🍞' },
  { id:'m14', level:'hard', label:'หมู่อาหารดีทั้งหมดรวม 8 ครั้ง', groups:[1,2,3,4,5], target:8, emoji:'🥗' },
  { id:'m15', level:'hard', label:'ภารกิจผสมขั้นสูง 7 ครั้ง', groups:[1,3,5], target:7, emoji:'🥛' }
];

/***************************************************
 * 3) เลือก Quest ตามระดับเกม
 ***************************************************/
function pickRandom(arr, n) {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length > 0) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return out;
}

function pickForLevel(level, type = 'goal') {
  if (type === 'goal') {
    const pool = GOALS.filter(g => g.level === level);
    return pickRandom(pool, 2); // ★ เลือก 2 อัน
  }
  if (type === 'mini') {
    const pool = MINI.filter(m => m.level === level);
    return pickRandom(pool, 3); // ★ เลือก 3 อัน
  }
  return [];
}

/***************************************************
 * 4) Quest Manager class
 ***************************************************/
class QuestManager {
  constructor(level = 'normal') {
    this.level = level;

    this.goals = pickForLevel(level, 'goal');
    this.minis = pickForLevel(level, 'mini');

    this.goals.forEach(g => g.prog = 0);
    this.minis.forEach(m => m.prog = 0);

    this.goalIndex = 0;
    this.miniIndex = 0;
  }

  currentGoal() {
    return this.goals[this.goalIndex] || null;
  }

  currentMini() {
    return this.minis[this.miniIndex] || null;
  }

  /*****************************************
   * update เมื่อผู้เล่นยิงโดนอาหาร
   *****************************************/
  updateOnHit(item) {
    const grp = item.group;

    // --- goal ---
    const g = this.currentGoal();
    if (g) {
      const ok = g.groups?.includes(grp);
      if (ok) {
        g.prog++;
        if (g.prog >= g.target) {
          this.goalIndex++;
        }
      }
    }

    // --- mini quest ---
    const m = this.currentMini();
    if (m) {
      const ok2 = m.groups?.includes(grp);
      const bad = m.badGroups?.includes(grp);

      if (ok2) m.prog++;
      if (bad) m.prog--; // ถ้าจงใจให้ลงโทษ

      if (m.prog >= m.target) {
        this.miniIndex++;
      }
    }
  }

  /*****************************************
   * เตรียมส่งให้ HUD
   *****************************************/
  exportForHUD() {
    const g = this.currentGoal();
    const m = this.currentMini();

    return {
      goal: g ? {
        label: g.label,
        prog: g.prog,
        target: g.target,
        emoji: g.emoji
      } : null,
      mini: m ? {
        label: m.label,
        prog: m.prog,
        target: m.target,
        emoji: m.emoji
      } : null
    };
  }
}

ns.foodGroupsQuest = {
  QuestManager,
  GOALS,
  MINI
};