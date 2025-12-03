// === /herohealth/vr-goodjunk/quest-director-goodjunk.js ===
// Quest Director สำหรับ Good vs Junk VR
// - อ่านรายการ GOAL / MINI จากภายนอก (ส่งเข้ามาตอนสร้าง)
// - รองรับ kind: score, goodHits, combo, missMax
// - จัด missMax ให้ไปอยู่ท้ายสุด (ไม่ใช่อันแรก ๆ)
// - ยิง quest:update ให้ HUD ที่ goodjunk-vr.html ใช้งานได้

'use strict';

// ยิง event ไปให้ HUD / ระบบอื่น
function emit(name, detail) {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (_) {}
}

// เอา quest ที่ kind = missMax ไปไว้ท้าย ๆ
function reorderForMissMaxLast(list) {
  const normal = [];
  const miss   = [];
  for (const g of list || []) {
    if (g.kind === 'missMax') miss.push(g);
    else normal.push(g);
  }
  return [...normal, ...miss];
}

// สร้าง deck พร้อม target ตามระดับความยาก
function buildDeck(baseList, diffKey) {
  const ordered = reorderForMissMaxLast(baseList || []);
  return ordered.map((g, idx) => {
    const t =
      (diffKey && typeof g[diffKey] === 'number' && isFinite(g[diffKey])) ? g[diffKey] :
      (typeof g.normal === 'number' && isFinite(g.normal)) ? g.normal :
      0;
    return {
      id: g.id,
      label: g.label,
      kind: g.kind || 'score',
      target: t,
      index: idx,
      prog: 0,
      done: false
    };
  });
}

// สร้างข้อความ hint ตามประเภทภารกิจ
function buildHint(goal, mini) {
  const src = goal || mini;
  if (!src) {
    return 'เล่นต่อไป เก็บอาหารดีให้ได้มากที่สุด และพยายามเลี่ยงอาหารขยะ 🌭🍩';
  }

  switch (src.kind || '') {
    case 'score':
      return 'เร่งเก็บคะแนนจากอาหารดี 🥦🍎 แล้วเลี่ยงอาหารขยะ เพื่อตะลุยแต้มให้ถึงเป้าหมาย!';
    case 'goodHits':
      return 'โฟกัสเลือกแต่อาหารดี เช่น ผัก ผลไม้ และนม แล้วเลี่ยงเมนูของทอดและน้ำหวานนะ!';
    case 'combo':
      return 'พยายามเก็บให้ต่อเนื่อง อย่าพลาด จะได้คอมโบยาว ๆ และได้คะแนนพิเศษ!';
    case 'missMax':
      return 'อย่ากดโดนอาหารขยะบ่อยเกินไป เก็บแต้มจากของดีให้มากที่สุด!';
    default:
      return 'เก็บอาหารดี เลี่ยงอาหารขยะ ไปให้ถึงเป้าหมายภารกิจ!';
  }
}

// ---------- Factory หลัก ----------
export function makeQuestDirector(opts = {}) {
  const diffStr = String(opts.diff || 'normal').toLowerCase();
  const diffKey = ['easy', 'normal', 'hard'].includes(diffStr) ? diffStr : 'normal';

  const goalsDeck = buildDeck(opts.goals || [], diffKey);
  const minisDeck = buildDeck(opts.minis || [], diffKey);

  const maxGoals = Number(opts.maxGoals || 2);
  const maxMini  = Number(opts.maxMini || 3);

  const state = {
    goals: goalsDeck,
    minis: minisDeck,
    maxGoals,
    maxMini
  };

  function selectActive() {
    const goalsAll = state.goals;
    const minisAll = state.minis;

    const activeGoal = goalsAll.find(g => !g.done) || null;
    const activeMini = minisAll.find(m => !m.done) || null;

    return { activeGoal, activeMini, goalsAll, minisAll };
  }

  function update(values) {
    const v = values || {};
    const score    = Number(v.score    || 0);
    const goodHits = Number(v.goodHits || 0);
    const miss     = Number(v.miss     || 0);
    const comboMax = Number(v.comboMax || 0);

    // --- อัปเดต Goals ---
    for (const g of state.goals) {
      const target = g.target || 0;
      let prog = 0;

      switch (g.kind) {
        case 'score':
          prog = score;
          break;
        case 'goodHits':
          prog = goodHits;
          break;
        case 'combo':
          prog = comboMax;
          break;
        case 'missMax':
          // แทนที่จะนับ "miss ไปแล้วกี่ครั้ง"
          // ใช้เป็น "เหลือโควตาพลาดอีกกี่ครั้ง" เพื่อให้ bar ดูไม่งง
          prog = Math.max(0, target - miss);
          break;
        default:
          prog = 0;
      }

      g.prog = prog;

      if (g.kind === 'missMax') {
        // ✅ ไม่ mark done กลางเกม
        // ให้ไปตัดสินตอน summary() ด้วย miss สุดท้าย
      } else {
        if (!g.done && prog >= target) {
          g.done = true;
        }
      }
    }

    // --- อัปเดต Mini quests ---
    for (const m of state.minis) {
      const target = m.target || 0;
      let prog = 0;

      switch (m.kind) {
        case 'score':
          prog = score;
          break;
        case 'goodHits':
          prog = goodHits;
          break;
        case 'combo':
          prog = comboMax;
          break;
        case 'missMax':
          prog = Math.max(0, target - miss);
          break;
        default:
          prog = 0;
      }

      m.prog = prog;

      if (m.kind === 'missMax') {
        // เช่นเดียวกับ goal: ตัดสินตอนจบเกม
      } else {
        if (!m.done && prog >= target) {
          m.done = true;
        }
      }
    }

    const { activeGoal, activeMini, goalsAll, minisAll } = selectActive();

    const hudGoal = activeGoal
      ? {
          id: activeGoal.id,
          label: activeGoal.label,
          kind: activeGoal.kind,
          prog: activeGoal.kind === 'missMax'
            ? Math.max(0, activeGoal.target - miss)
            : activeGoal.prog,
          target: activeGoal.target,
          done: !!activeGoal.done
        }
      : null;

    const hudMini = activeMini
      ? {
          id: activeMini.id,
          label: activeMini.label,
          kind: activeMini.kind,
          prog: activeMini.kind === 'missMax'
            ? Math.max(0, activeMini.target - miss)
            : activeMini.prog,
          target: activeMini.target,
          done: !!activeMini.done
        }
      : null;

    const hint = buildHint(hudGoal, hudMini);

    emit('quest:update', {
      goal: hudGoal,
      mini: hudMini,
      goalsAll,
      minisAll,
      hint
    });
  }

  // สรุปตอนจบเกม (ใช้ใน GameEngine.finishSession)
  function summary() {
    const goalsAll = state.goals.map(g => ({ ...g }));
    const minisAll = state.minis.map(m => ({ ...m }));

    const finalMiss = window.misses | 0;

    // ประเมิน missMax ด้วย miss สุดท้าย
    for (const g of goalsAll) {
      if (g.kind === 'missMax') {
        g.done = (finalMiss <= g.target);
      }
    }
    for (const m of minisAll) {
      if (m.kind === 'missMax') {
        m.done = (finalMiss <= m.target);
      }
    }

    const goalsCleared = goalsAll.filter(g => g.done).length;
    const goalsTotal   = goalsAll.length;
    const miniCleared  = minisAll.filter(m => m.done).length;
    const miniTotal    = minisAll.length;

    return {
      mainGoalDone: goalsCleared > 0,  // ไว้ใช้เป็น flag รวม ๆ
      goalsCleared,
      goalsTotal,
      miniCleared,
      miniTotal
    };
  }

  function start() {
    // initial update ด้วยค่าเริ่มต้น (score 0)
    update({ score: 0, goodHits: 0, miss: 0, comboMax: 0 });
  }

  return { start, update, summary };
}

export default { makeQuestDirector };
