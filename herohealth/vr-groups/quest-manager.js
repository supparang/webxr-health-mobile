// === /herohealth/vr-groups/quest-manager.js ===
// ระบบ Goal + Mini Quest • รองรับ easy / normal / hard
// Production Ready 2025-12-05

(function (ns) {
  'use strict';

  const QuestMgr = {};

  //--------------------------------------------------------------------
  // Goal 10 แบบ แบ่งระดับ
  //--------------------------------------------------------------------
  const GOALS = {
    easy: [
      { id: 'g1',  title: 'เลือกเฉพาะ ผัก', group: 'veg', target: 5 },
      { id: 'g2',  title: 'เลือกเฉพาะ ผลไม้', group: 'fruit', target: 5 },
      { id: 'g3',  title: 'เลือกเฉพาะ ข้าว-แป้ง', group: 'grain', target: 5 },
      { id: 'g4',  title: 'เลือกเฉพาะ โปรตีน', group: 'protein', target: 5 },
      { id: 'g5',  title: 'เลือกเฉพาะ นม', group: 'dairy', target: 5 },
    ],

    normal: [
      { id: 'g6',  title: 'ผัก & ผลไม้ สลับกัน', group: ['veg','fruit'], target: 8 },
      { id: 'g7',  title: 'เน้นโปรตีนลีน', group: 'protein', target: 7 },
      { id: 'g8',  title: 'หลีกเลี่ยงนมเนย เลือกเฉพาะที่ไม่ใช่ dairy', group: ['veg','fruit','grain','protein'], target: 10 },
    ],

    hard: [
      { id: 'g9',  title: 'เลือกให้ครบทุกหมู่ (หมุนไปเรื่อย ๆ)', group: ['veg','fruit','grain','protein','dairy'], target: 12 },
      { id: 'g10', title: 'โปรตีนอย่างเดียว ห้ามหมู่อื่นเด็ดขาด', group: 'protein', target: 10 }
    ]
  };

  //--------------------------------------------------------------------
  // Mini Quest 15 แบบ แบ่งระดับ
  //--------------------------------------------------------------------
  const MINIS = {
    easy: [
      { id: 'm1', title: 'ผัก 3 ชิ้นติดกัน', group: 'veg', chain: 3 },
      { id: 'm2', title: 'ผลไม้ 3 ชิ้นติดกัน', group: 'fruit', chain: 3 },
      { id: 'm3', title: 'โปรตีน 3 ชิ้นติดกัน', group: 'protein', chain: 3 },
      { id: 'm4', title: 'เลือกของดีรวดเร็ว 5 ชิ้น', group: ['veg','fruit','protein'], target: 5 },
      { id: 'm5', title: 'ยิงให้ทันเวลา 10 วิ', timer: 10, target: 4 },
    ],

    normal: [
      { id: 'm6',  title: 'แป้ง 4 ชิ้นติดกัน', group: 'grain', chain: 4 },
      { id: 'm7',  title: 'สลับ ผัก → ผลไม้ → ผัก', seq: ['veg','fruit','veg'] },
      { id: 'm8',  title: 'เลือกอย่างน้อย 6 ชิ้นใน 15 วิ', timer: 15, target: 6 },
      { id: 'm9',  title: 'หมู่ใดยังไม่ถูกเลือก? เลือกให้ครบ', allGroups: true, target: 5 },
      { id: 'm10', title: 'ยิงพลาดไม่เกิน 1 ครั้งใน 12 วิ', timer: 12, limitMiss: 1 },
    ],

    hard: [
      { id: 'm11', title: 'โปรตีน 5 ชิ้นติดกัน แบบไม่พลาด', group: 'protein', chain: 5 },
      { id: 'm12', title: 'สลับ 4 หมู่ (veg→fruit→grain→protein)', seq: ['veg','fruit','grain','protein'] },
      { id: 'm13', title: 'เลือกถูกติดต่อกัน 10 ชิ้น', chainCorrect: 10 },
      { id: 'm14', title: 'เลือกผิดไม่ได้เลย 15 วิ', timer: 15, limitMiss: 0 },
      { id: 'm15', title: 'เลือกให้ครบทุกหมู่ก่อนหมดเวลา', allGroups: true, target: 10 },
    ]
  };

  //--------------------------------------------------------------------
  // Internal state
  //--------------------------------------------------------------------
  let diff = 'normal';
  let goals = [];
  let minis = [];

  let activeGoal = null;
  let activeMini = null;

  //--------------------------------------------------------------------
  // Random select 2 goals + 3 minis ตามระดับเกม
  //--------------------------------------------------------------------
  function pickRandom(arr, n) {
    const copy = [...arr];
    const out = [];
    for (let i = 0; i < n && copy.length > 0; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      out.push(copy.splice(idx, 1)[0]);
    }
    return out;
  }

  //--------------------------------------------------------------------
  // Init
  //--------------------------------------------------------------------
  QuestMgr.init = function (difficulty = 'normal') {
    diff = difficulty;

    goals = pickRandom(GOALS[diff], 2);
    minis = pickRandom(MINIS[diff], 3);

    // ตั้งภารกิจแรก
    activeGoal = {
      ...goals[0],
      prog: 0
    };

    activeMini = {
      ...minis[0],
      prog: 0,
      chainProg: 0,
      seqIndex: 0
    };

    dispatchUpdate();
  };

  //--------------------------------------------------------------------
  // ตรวจว่าตรงเงื่อนไขของ goal หรือไม่
  //--------------------------------------------------------------------
  function matchGoal(g, foodGroup) {
    if (!g.group) return false;
    if (Array.isArray(g.group)) return g.group.includes(foodGroup);
    return g.group === foodGroup;
  }

  //--------------------------------------------------------------------
  // ตรวจ mini quest แบบต่าง ๆ
  //--------------------------------------------------------------------
  function matchMini(m, foodGroup, hitCorrect, missCount) {

    // แบบ chain
    if (m.group && m.chain) {
      if (foodGroup === m.group) {
        m.chainProg = (m.chainProg || 0) + 1;
        if (m.chainProg >= m.chain) m.prog = m.target || m.chain;
      } else {
        m.chainProg = 0;
      }
    }

    // แบบ seq
    if (m.seq) {
      const want = m.seq[m.seqIndex];
      if (foodGroup === want) {
        m.seqIndex++;
        if (m.seqIndex >= m.seq.length) {
          m.prog = m.seq.length;
        }
      }
    }

    // แบบ allGroups
    if (m.allGroups) {
      if (!m._set) m._set = {};
      m._set[foodGroup] = true;
      m.prog = Object.keys(m._set).length;
    }

    // แบบ chainCorrect
    if (m.chainCorrect) {
      if (hitCorrect) {
        m.chainProg = (m.chainProg || 0) + 1;
        if (m.chainProg >= m.chainCorrect) m.prog = m.chainCorrect;
      } else {
        m.chainProg = 0;
      }
    }

    // แบบ timer-limitMiss
    if (m.timer) {
      if (!m._timerStarted) {
        m._timerStarted = true;
        m._startTime = performance.now();
        m._missStart = missCount || 0;
      }
      const t = (performance.now() - m._startTime) / 1000;
      if (t <= m.timer) {
        if (m.limitMiss != null) {
          const usedMiss = (missCount || 0) - (m._missStart || 0);
          if (usedMiss <= m.limitMiss) {
            m.prog = (m.prog || 0) + 1;
          }
        } else {
          m.prog = (m.prog || 0) + 1;
        }
      }
    }

    return m;
  }

  //--------------------------------------------------------------------
  // เมื่อยิงโดน
  //--------------------------------------------------------------------
  QuestMgr.onHit = function (foodGroup, hitCorrect, missCount) {
    // ตรวจ goal
    if (activeGoal && matchGoal(activeGoal, foodGroup)) {
      activeGoal.prog++;
      if (activeGoal.prog >= activeGoal.target) {
        // จบ goal นี้ → เอา goal ถัดไป
        if (goals.length > 1) goals.shift();
        activeGoal = goals[0]
          ? { ...goals[0], prog: 0 }
          : null;
      }
    }

    // ตรวจ mini
    if (activeMini) {
      activeMini = matchMini(activeMini, foodGroup, hitCorrect, missCount);

      if (activeMini.prog >= (activeMini.target || activeMini.chain || activeMini.seq?.length || 0)) {
        if (minis.length > 1) minis.shift();
        activeMini = minis[0]
          ? { ...minis[0], prog: 0, chainProg: 0, seqIndex: 0 }
          : null;
      }
    }

    dispatchUpdate();
  };

  //--------------------------------------------------------------------
  // ส่ง event → HUD groups-vr.html
  //--------------------------------------------------------------------
  function dispatchUpdate() {
    window.dispatchEvent(new CustomEvent('quest:update', {
      detail: {
        goal: activeGoal
          ? { label: activeGoal.title, prog: activeGoal.prog, target: activeGoal.target }
          : null,
        mini: activeMini
          ? { label: activeMini.title, prog: activeMini.prog,
              target: (activeMini.target || activeMini.chain || activeMini.seq?.length || 0) }
          : null
      }
    }));
  }

  //--------------------------------------------------------------------
  // สรุปผลให้ end screen
  //--------------------------------------------------------------------
  QuestMgr.getSummary = function () {
    return {
      goalsTotal: goals.length + (activeGoal ? 1 : 0),
      goalsCleared: (!activeGoal ? 1 : 0), // simplified
      miniTotal: minis.length + (activeMini ? 1 : 0),
      miniCleared: (!activeMini ? 1 : 0)
    };
  };

  ns.foodGroupsQuest = QuestMgr;

})(window.GAME_MODULES || (window.GAME_MODULES = {}));