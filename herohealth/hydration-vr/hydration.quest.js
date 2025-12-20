// === /herohealth/hydration-vr/hydration.quest.js ===
// Quest Deck สำหรับ Hydration Quest VR
// ใช้ร่วมกับ: hydration.safe.js
//
// ✅ FIX 2025-12-20 + UPGRADE 2025-12-20(B):
// - เพิ่ม setZone(zone)
// - second(zone) นับ greenTick จากโซนจริง
// - รองรับโซน: GREEN / LOW / HIGH (case-safe)
// - ✅ NEW: Mini chain ต่อเนื่อง (nextMini) + stats.minisDone
// - คง API เดิมทั้งหมด + getGoalProgressInfo/getMiniProgressInfo

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp (v, min, max) {
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function normDiff (d) {
  d = String(d || 'normal').toLowerCase();
  if (d !== 'easy' && d !== 'hard') return 'normal';
  return d;
}

function normZone (z) {
  const Z = String(z || '').toUpperCase();
  if (Z === 'GREEN' || Z === 'LOW' || Z === 'HIGH') return Z;
  return 'GREEN';
}

function pickOne(arr, fallback=null){
  if (!Array.isArray(arr) || !arr.length) return fallback;
  return arr[(Math.random()*arr.length)|0];
}

function makeView (all) {
  const remain = all.filter(item => !item._done && !item.done);
  remain._all = all;
  return remain;
}

export function createHydrationQuest (diffKey = 'normal') {
  const diff = normDiff(diffKey);

  // ---------- เกณฑ์ภารกิจตามระดับความยาก ----------
  const cfg = {
    goalGreenTick: (diff === 'easy') ? 18 : (diff === 'hard' ? 32 : 25),
    goalBadZoneLimit: (diff === 'easy') ? 16 : (diff === 'hard' ? 10 : 12),

    miniComboBest: (diff === 'easy') ? 5 : (diff === 'hard' ? 10 : 7),
    miniGoodHits:  (diff === 'easy') ? 20 : (diff === 'hard' ? 30 : 24),
    miniNoJunkSec: (diff === 'easy') ? 10 : (diff === 'hard' ? 18 : 14)
  };

  // ---------- Stats ----------
  const stats = {
    zone: 'GREEN',
    greenTick: 0,     // ✅ จะนับจาก zone จริง
    timeSec: 0,

    goodHits: 0,
    junkHits: 0,
    secSinceJunk: 0,

    comboNow: 0,
    comboBest: 0,
    score: 0,

    // ✅ NEW: mini chain counter
    minisDone: 0,
    minisSpawned: 0
  };

  // ---------- Goals ----------
  const goals = [
    {
      id: 'goal-green-time',
      label: 'โซนน้ำสีเขียว',
      text: 'รักษาน้ำในร่างกายให้อยู่โซนสีเขียวสะสมตามที่กำหนด',
      target: cfg.goalGreenTick,
      prog: 0,
      _done: false
    },
    {
      id: 'goal-stable-zone',
      label: 'โซนไม่เหวี่ยง',
      text: 'อยู่โซนแย่ (LOW/HIGH) ให้น้อยกว่าเกณฑ์ (ยิ่งน้อยยิ่งดี)',
      target: cfg.goalBadZoneLimit,
      prog: 0, // badZoneSec
      _done: false
    }
  ];

  // ---------- Minis (base set) ----------
  const minis = [
    {
      id: 'mini-combo',
      label: 'สายคอมโบ',
      text: 'ทำคอมโบสูงสุดให้ถึงตามเกณฑ์ของระดับนี้',
      target: cfg.miniComboBest,
      prog: 0,
      _done: false
    },
    {
      id: 'mini-good-hits',
      label: 'เก็บน้ำดีรัว ๆ',
      text: 'เก็บน้ำดี (💧 / 🥛 / 🍉 / Power-ups) ให้ครบตามจำนวน',
      target: cfg.miniGoodHits,
      prog: 0,
      _done: false
    },
    {
      id: 'mini-no-junk',
      label: 'เลี่ยงน้ำหวาน',
      text: 'ไม่โดนน้ำหวานต่อเนื่องตามเวลาที่กำหนด',
      target: cfg.miniNoJunkSec,
      prog: 0,
      _done: false
    }
  ];

  // ---------- Dynamic mini templates (Arcade chain) ----------
  // จะสุ่ม 1 อันมาต่อท้าย โดย target จะ “โหดขึ้น” ตามจำนวน mini ที่ผ่าน
  const MINI_TEMPLATES = [
    {
      key: 'combo',
      makeTarget(base, inc){ return clamp(base + inc, 3, 30); },
      makeText(t){ return `ทำคอมโบสูงสุดให้ถึง ${t} (ต่อเนื่อง)`; }
    },
    {
      key: 'goodhits',
      makeTarget(base, inc){ return clamp(base + inc*2, 8, 80); },
      makeText(t){ return `เก็บน้ำดีให้ครบ ${t} ครั้ง`; }
    },
    {
      key: 'nojunk',
      makeTarget(base, inc){ return clamp(base + inc, 6, 40); },
      makeText(t){ return `ไม่โดนน้ำหวานต่อเนื่อง ${t} วินาที`; }
    }
  ];

  function badZoneSec () {
    // ✅ เวลาที่ไม่ได้อยู่ GREEN (รวม LOW/HIGH)
    return clamp(stats.timeSec - stats.greenTick, 0, 9999);
  }

  function syncProgFields () {
    goals[0].prog = clamp(stats.greenTick, 0, goals[0].target);
    goals[1].prog = badZoneSec(); // ค่าเสีย (ต้อง <= target)

    minis.forEach(m=>{
      if (m.id.startsWith('mini-combo') || m.id.includes('combo')) {
        m.prog = clamp(stats.comboBest, 0, m.target);
      } else if (m.id.startsWith('mini-good-hits') || m.id.includes('goodhits')) {
        m.prog = clamp(stats.goodHits, 0, m.target);
      } else if (m.id.startsWith('mini-no-junk') || m.id.includes('nojunk')) {
        m.prog = clamp(stats.secSinceJunk, 0, m.target);
      }
    });
  }

  function evalGoals () {
    syncProgFields();

    // Goal 1: greenTick ถึงเกณฑ์
    if (!goals[0]._done && stats.greenTick >= cfg.goalGreenTick) {
      goals[0]._done = true;
    }

    // Goal 2: badZoneSec <= limit และมีเวลาเล่นพอ (กันผ่านแบบ “ยังไม่เล่นครบ”)
    if (!goals[1]._done) {
      const bz = badZoneSec();
      if (bz <= cfg.goalBadZoneLimit && stats.timeSec >= cfg.goalGreenTick) {
        goals[1]._done = true;
      }
    }
  }

  function evalMinis () {
    syncProgFields();

    minis.forEach(m=>{
      if (m._done) return;

      if (m.id.startsWith('mini-combo') || m.id.includes('combo')) {
        if (stats.comboBest >= m.target) m._done = true;
      } else if (m.id.startsWith('mini-good-hits') || m.id.includes('goodhits')) {
        if (stats.goodHits >= m.target) m._done = true;
      } else if (m.id.startsWith('mini-no-junk') || m.id.includes('nojunk')) {
        if (stats.secSinceJunk >= m.target) m._done = true;
      }

      if (m._done) {
        // ✅ NEW: นับจำนวน mini ที่ผ่านทั้งหมด (ต่อเนื่อง)
        stats.minisDone = (stats.minisDone|0) + 1;
      }
    });
  }

  function evalAll () { evalGoals(); evalMinis(); }

  // ---------- API ----------
  function setZone (zone) {
    stats.zone = normZone(zone);
    evalGoals();
  }

  function updateScore (score) {
    stats.score = Number(score) || 0;
    evalAll();
  }

  function updateCombo (combo) {
    const c = combo | 0;
    stats.comboNow = c;
    if (c > stats.comboBest) stats.comboBest = c;
    evalMinis();
  }

  function onGood () {
    stats.goodHits += 1;
    evalMinis();
  }

  function onJunk () {
    stats.junkHits += 1;
    stats.secSinceJunk = 0;
    evalAll();
  }

  // ✅ FIX: second(zone) นับ greenTick จากโซนจริง
  function second (zoneMaybe) {
    if (zoneMaybe != null) stats.zone = normZone(zoneMaybe);

    stats.timeSec += 1;
    stats.secSinceJunk += 1;

    if (String(stats.zone).toUpperCase() === 'GREEN') {
      stats.greenTick += 1;
    }

    evalAll();
  }

  // ------------------------------------------------------
  // ✅ NEW: nextMini() -> สร้าง mini ใหม่มาต่อเรื่อย ๆ
  // ------------------------------------------------------
  function nextMini (opts = {}) {
    // ทำให้ mini โผล่มาต่อเฉพาะเมื่อมี mini ผ่านแล้ว หรือ caller อยาก force
    const harder = !!opts.harder;

    const cleared = (stats.minisDone|0);
    const spawned = (stats.minisSpawned|0);

    // เพิ่มความยากแบบนุ่ม ๆ: easy เพิ่มช้ากว่า hard
    const baseInc = harder ? Math.max(1, Math.floor(cleared * 0.45)) : Math.max(0, Math.floor(cleared * 0.25));
    const diffInc = (diff === 'easy') ? Math.floor(baseInc * 0.75) : (diff === 'hard' ? Math.ceil(baseInc * 1.2) : baseInc);

    // สุ่มประเภท mini
    const t = pickOne(MINI_TEMPLATES, MINI_TEMPLATES[0]);
    let base = 0;

    if (t.key === 'combo') base = cfg.miniComboBest;
    if (t.key === 'goodhits') base = cfg.miniGoodHits;
    if (t.key === 'nojunk') base = cfg.miniNoJunkSec;

    const target = t.makeTarget(base, diffInc);

    const id = `mini-${t.key}-${Date.now()}-${spawned}`;
    const labelMap = {
      combo: 'สายคอมโบ (ต่อเนื่อง)',
      goodhits: 'เก็บน้ำดีต่อเนื่อง',
      nojunk: 'เลี่ยงน้ำหวาน (ต่อเนื่อง)'
    };

    const m = {
      id,
      label: labelMap[t.key] || 'Mini ต่อเนื่อง',
      text: t.makeText(target),
      target,
      prog: 0,
      _done: false,

      // internal tag
      _kind: t.key
    };

    minis.push(m);
    stats.minisSpawned = spawned + 1;

    // sync prog ทันที
    syncProgFields();
    return m;
  }

  function nextGoal () {}

  function getProgress (kind) {
    if (kind === 'goals') return makeView(goals);
    if (kind === 'mini')  return makeView(minis);
    return [];
  }

  function getGoalProgressInfo(id) {
    syncProgFields();
    if (id === 'goal-green-time') {
      return { now: stats.greenTick, target: cfg.goalGreenTick, text: `${stats.greenTick}/${cfg.goalGreenTick} วินาที (โซน GREEN)` };
    }
    if (id === 'goal-stable-zone') {
      const bz = badZoneSec();
      return { now: bz, target: cfg.goalBadZoneLimit, text: `${bz}/${cfg.goalBadZoneLimit} วินาที (โซนแย่ ต้อง ≤ เกณฑ์)` };
    }
    return { now: 0, target: 0, text: '' };
  }

  function getMiniProgressInfo(id) {
    syncProgFields();
    const m = minis.find(x => x.id === id) || null;

    // base ids
    if (id === 'mini-combo') {
      return { now: stats.comboBest, target: cfg.miniComboBest, text: `${stats.comboBest}/${cfg.miniComboBest} คอมโบสูงสุด` };
    }
    if (id === 'mini-good-hits') {
      return { now: stats.goodHits, target: cfg.miniGoodHits, text: `${stats.goodHits}/${cfg.miniGoodHits} น้ำดีที่เก็บ` };
    }
    if (id === 'mini-no-junk') {
      return { now: stats.secSinceJunk, target: cfg.miniNoJunkSec, text: `${stats.secSinceJunk}/${cfg.miniNoJunkSec} วินาทีไม่โดนน้ำหวาน` };
    }

    // dynamic minis (chain)
    if (m && (m.id.includes('combo') || m._kind === 'combo')) {
      return { now: stats.comboBest, target: m.target, text: `${stats.comboBest}/${m.target} คอมโบสูงสุด` };
    }
    if (m && (m.id.includes('goodhits') || m._kind === 'goodhits')) {
      return { now: stats.goodHits, target: m.target, text: `${stats.goodHits}/${m.target} น้ำดีที่เก็บ` };
    }
    if (m && (m.id.includes('nojunk') || m._kind === 'nojunk')) {
      return { now: stats.secSinceJunk, target: m.target, text: `${stats.secSinceJunk}/${m.target} วินาทีไม่โดนน้ำหวาน` };
    }

    return { now: 0, target: 0, text: '' };
  }

  function getMiniNoJunkProgress() {
    return { now: stats.secSinceJunk, target: cfg.miniNoJunkSec };
  }

  // Debug helper
  try {
    ROOT.HHA_HYDRATION_QUEST_DEBUG = { cfg, stats, goals, minis };
  } catch {}

  return {
    cfg,
    stats,
    goals,
    minis,
    setZone,        // ✅ NEW
    updateScore,
    updateCombo,
    onGood,
    onJunk,
    second,
    getProgress,
    nextGoal,
    nextMini,       // ✅ NEW REAL IMPLEMENTATION
    getGoalProgressInfo,
    getMiniProgressInfo,
    getMiniNoJunkProgress
  };
}

export default { createHydrationQuest };
