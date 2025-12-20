// === /herohealth/hydration-vr/hydration.quest.js ===
// Quest Deck สำหรับ Hydration Quest VR
// ใช้ร่วมกับ: hydration.safe.js (GOAL_TARGET = 2, MINI_TARGET = 3)
//
// ✅ FIX 2025-12-20 (เดิม):
// - เพิ่ม setZone(zone)
// - second(zone) นับ greenTick จากโซนจริง
// - รองรับโซน: GREEN / LOW / HIGH (case-safe)
// - คง API เดิมทั้งหมด + getGoalProgressInfo/getMiniProgressInfo
//
// ✅ PATCH 2025-12-20 (เพิ่ม):
// - nextMini(): ทำ Mini ต่อเนื่องไม่จำกัด (mini chain)
// - addRandomMini(): helper สำหรับสุ่ม mini ใหม่
// - getMiniProgressInfo รองรับ id แบบมี suffix เช่น mini-no-junk-4
// - mini counters: minisDone, miniSerial (สำหรับ UI/สรุปผล)

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

function makeView (all) {
  const remain = all.filter(item => !item._done && !item.done);
  remain._all = all;
  return remain;
}

function pickOne (arr, fallback = null) {
  if (!Array.isArray(arr) || !arr.length) return fallback;
  const i = Math.floor(Math.random() * arr.length);
  return arr[i];
}

export function createHydrationQuest (diffKey = 'normal') {
  const diff = normDiff(diffKey);

  // ---------- เกณฑ์ภารกิจตามระดับความยาก ----------
  const cfg = {
    goalGreenTick: (diff === 'easy') ? 18 : (diff === 'hard' ? 32 : 25),
    goalBadZoneLimit: (diff === 'easy') ? 16 : (diff === 'hard' ? 10 : 12),

    miniComboBest: (diff === 'easy') ? 5 : (diff === 'hard' ? 10 : 7),
    miniGoodHits:  (diff === 'easy') ? 20 : (diff === 'hard' ? 30 : 24),
    miniNoJunkSec: (diff === 'easy') ? 10 : (diff === 'hard' ? 18 : 14),

    // ✅ chain tuning (ค่อย ๆ โหดขึ้นเมื่อผ่าน mini มากขึ้น)
    chainStepCombo:   (diff === 'hard') ? 2 : 2,
    chainStepGood:    (diff === 'hard') ? 6 : 5,
    chainStepNoJunk:  (diff === 'hard') ? 3 : 2,
    chainCapCombo:    (diff === 'hard') ? 20 : 16,
    chainCapGood:     (diff === 'hard') ? 80 : 65,
    chainCapNoJunk:   (diff === 'hard') ? 40 : 32
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

    // ✅ mini chain counters
    minisDone: 0,
    miniSerial: 0
  };

  // ---------- Goals (fixed 2) ----------
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

  // ---------- Mini templates ----------
  function makeMiniCombo(target, serial){
    return {
      id: `mini-combo-${serial}`,
      kind: 'mini-combo',
      label: 'สายคอมโบ',
      text: 'ทำคอมโบสูงสุดให้ถึงตามเกณฑ์',
      target,
      prog: 0,
      _done: false
    };
  }
  function makeMiniGoodHits(target, serial){
    return {
      id: `mini-good-hits-${serial}`,
      kind: 'mini-good-hits',
      label: 'เก็บน้ำดีรัว ๆ',
      text: 'เก็บน้ำดี (💧 / 🥛 / 🍉 / Power-ups) ให้ครบตามจำนวน',
      target,
      prog: 0,
      _done: false
    };
  }
  function makeMiniNoJunk(target, serial){
    return {
      id: `mini-no-junk-${serial}`,
      kind: 'mini-no-junk',
      label: 'เลี่ยงน้ำหวาน',
      text: 'ไม่โดนน้ำหวานต่อเนื่องตามเวลาที่กำหนด',
      target,
      prog: 0,
      _done: false
    };
  }

  function nextMiniSerial(){
    stats.miniSerial = (stats.miniSerial|0) + 1;
    return stats.miniSerial|0;
  }

  function scaleTarget(base, step, cap, doneCount, harder){
    // doneCount = จำนวน mini ที่ผ่านไปแล้ว
    // harder=true => เพิ่มความโหดตาม doneCount, false => ใช้ base
    const t = Number(base)||0;
    if (!harder) return t;
    const scaled = t + (Math.max(0, doneCount) * (Number(step)||0));
    return clamp(scaled, 1, Number(cap)||9999);
  }

  // ---------- Minis (เริ่มต้น 3 อันเหมือนเดิม) ----------
  const minis = [];

  function seedMinis(){
    minis.length = 0;
    stats.miniSerial = 0;

    minis.push(makeMiniCombo(cfg.miniComboBest, nextMiniSerial()));
    minis.push(makeMiniGoodHits(cfg.miniGoodHits, nextMiniSerial()));
    minis.push(makeMiniNoJunk(cfg.miniNoJunkSec, nextMiniSerial()));
  }
  seedMinis();

  function badZoneSec () {
    // ✅ เวลาที่ไม่ได้อยู่ GREEN (รวม LOW/HIGH)
    return clamp(stats.timeSec - stats.greenTick, 0, 9999);
  }

  function syncProgFields () {
    goals[0].prog = clamp(stats.greenTick, 0, goals[0].target);
    goals[1].prog = badZoneSec(); // ค่าเสีย (ต้อง <= target)

    // minis: อัปเดตตาม kind
    minis.forEach(m=>{
      if (m._done) return;
      if (m.kind === 'mini-combo')      m.prog = clamp(stats.comboBest, 0, m.target);
      else if (m.kind === 'mini-good-hits') m.prog = clamp(stats.goodHits, 0, m.target);
      else if (m.kind === 'mini-no-junk')   m.prog = clamp(stats.secSinceJunk, 0, m.target);
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

      if (m.kind === 'mini-combo') {
        if (stats.comboBest >= m.target) m._done = true;
      } else if (m.kind === 'mini-good-hits') {
        if (stats.goodHits >= m.target) m._done = true;
      } else if (m.kind === 'mini-no-junk') {
        if (stats.secSinceJunk >= m.target) m._done = true;
      }
    });
  }

  function evalAll () { evalGoals(); evalMinis(); }

  // ------------------------------------------------------
  // ✅ Mini chain: สุ่ม mini ใหม่เติมเข้าคิว
  // ------------------------------------------------------
  const MINI_KINDS = ['mini-combo','mini-good-hits','mini-no-junk'];

  function addRandomMini(opts = {}){
    const harder = !!opts.harder;
    const doneCount = stats.minisDone|0;

    // กันซ้ำชนิดเดิมติด ๆ (ให้รู้สึก “เปลี่ยนจังหวะ”)
    const remain = makeView(minis);
    const lastKind = (remain.length === 1) ? remain[0].kind : null;

    let kinds = MINI_KINDS.slice();
    if (lastKind) kinds = kinds.filter(k=>k !== lastKind);
    const kind = pickOne(kinds, pickOne(MINI_KINDS, 'mini-no-junk'));

    const serial = nextMiniSerial();

    if (kind === 'mini-combo'){
      const target = scaleTarget(cfg.miniComboBest, cfg.chainStepCombo, cfg.chainCapCombo, doneCount, harder);
      minis.push(makeMiniCombo(target, serial));
    } else if (kind === 'mini-good-hits'){
      const target = scaleTarget(cfg.miniGoodHits, cfg.chainStepGood, cfg.chainCapGood, doneCount, harder);
      minis.push(makeMiniGoodHits(target, serial));
    } else {
      const target = scaleTarget(cfg.miniNoJunkSec, cfg.chainStepNoJunk, cfg.chainCapNoJunk, doneCount, harder);
      minis.push(makeMiniNoJunk(target, serial));
    }
  }

  function nextMini(opts = {}){
    // เมื่อมี mini ที่เพิ่ง “ผ่าน” ให้เพิ่มตัวนับ และเติม mini ใหม่ต่อ
    // หมายเหตุ: safe.js ควรเรียก nextMini() เฉพาะ Play Mode
    const harder = (opts && typeof opts.harder === 'boolean') ? opts.harder : true;

    // นับจำนวน mini ที่ done เพิ่ม (ครั้งเดียวต่อการเรียก)
    stats.minisDone = (stats.minisDone|0) + 1;

    // เติม mini ใหม่เข้าคิว 1 อัน
    addRandomMini({ harder });

    // sync โปรเกรสอีกรอบเพื่อให้ UI อ่านได้ทันที
    syncProgFields();
  }

  function nextGoal () {
    // Goals ของ Hydration ตั้งใจให้เป็น fixed 2 อัน
    // (เว้นไว้ไม่ให้พัง API)
  }

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

  // ✅ รองรับ id ที่มี suffix เช่น mini-no-junk-4
  function getMiniProgressInfo(id) {
    syncProgFields();
    const s = String(id || '');

    if (s.startsWith('mini-combo')) {
      // หา mini ตัวจริงจาก id (ถ้ามี) ไม่งั้น fallback จาก stats
      const m = minis.find(x => x.id === s) || minis.find(x => x.kind === 'mini-combo' && !x._done);
      const target = m ? m.target : cfg.miniComboBest;
      return { now: stats.comboBest, target, text: `${stats.comboBest}/${target} คอมโบสูงสุด` };
    }
    if (s.startsWith('mini-good-hits')) {
      const m = minis.find(x => x.id === s) || minis.find(x => x.kind === 'mini-good-hits' && !x._done);
      const target = m ? m.target : cfg.miniGoodHits;
      return { now: stats.goodHits, target, text: `${stats.goodHits}/${target} น้ำดีที่เก็บ` };
    }
    if (s.startsWith('mini-no-junk')) {
      const m = minis.find(x => x.id === s) || minis.find(x => x.kind === 'mini-no-junk' && !x._done);
      const target = m ? m.target : cfg.miniNoJunkSec;
      return { now: stats.secSinceJunk, target, text: `${stats.secSinceJunk}/${target} วินาทีไม่โดนน้ำหวาน` };
    }
    return { now: 0, target: 0, text: '' };
  }

  function getMiniNoJunkProgress() {
    // เอา target จาก mini-no-junk ที่ active อยู่ (ถ้ามี) เพื่อความแม่น
    const m = minis.find(x => x.kind === 'mini-no-junk' && !x._done);
    const target = m ? m.target : cfg.miniNoJunkSec;
    return { now: stats.secSinceJunk, target };
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

    setZone,        // ✅ NEW (เดิม)
    updateScore,
    updateCombo,
    onGood,
    onJunk,
    second,

    getProgress,
    nextGoal,
    nextMini,        // ✅ NOW WORKING
    addRandomMini,   // ✅ helper (ปลอดภัย ไม่ใช้ก็ได้)

    getGoalProgressInfo,
    getMiniProgressInfo,
    getMiniNoJunkProgress
  };
}

export default { createHydrationQuest };
