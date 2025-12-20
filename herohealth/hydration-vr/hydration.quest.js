// === /herohealth/hydration-vr/hydration.quest.js ===
// Quest Deck สำหรับ Hydration Quest VR
//
// ✅ UPGRADE 2025-12-20(D):
// - Mini chain ต่อเนื่อง: เพิ่มชนิดใหม่ (GREEN STREAK / PERFECT STREAK / STORM SURVIVE / BOSS BLOCK / SCORE SPRINT)
// - เพิ่ม API เสริม (ไม่ทำของเดิมพัง):
//   - onPerfect()        // เรียกเมื่อ hitPerfect
//   - setStormActive(b)  // อัปเดตว่า Storm กำลังทำงานไหม (ต่อวินาที)
//   - onBossBlocked()    // เรียกเมื่อ block 👑 ด้วย shield
// - second() track greenStreak / stormStreak / scoreSprint windows

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
  if (Z === 'GREEN' || Z === 'LOW' || Z === 'HIGH' || Z === 'YELLOW' || Z === 'RED') return Z;
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

  // ---------- base thresholds ----------
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
    greenTick: 0,
    timeSec: 0,

    goodHits: 0,
    junkHits: 0,
    secSinceJunk: 0,

    comboNow: 0,
    comboBest: 0,
    score: 0,

    // ---- NEW: chain meta ----
    minisDone: 0,
    minisSpawned: 0,

    // ---- NEW: streaks / signals ----
    greenStreakNow: 0,
    greenStreakBest: 0,

    perfectStreakNow: 0,
    perfectStreakBest: 0,

    stormActive: false,
    stormStreakNow: 0,
    stormStreakBest: 0,

    bossBlocked: 0,

    // score sprint window (rolling)
    scoreStart: 0,
    scoreDeltaInWindow: 0,
    scoreWindowLeft: 0
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
      prog: 0,
      _done: false
    }
  ];

  // ---------- Minis (base set) ----------
  const minis = [
    { id:'mini-combo',      label:'สายคอมโบ',      text:'ทำคอมโบสูงสุดให้ถึงตามเกณฑ์ของระดับนี้', target: cfg.miniComboBest, prog:0, _done:false, _kind:'combo' },
    { id:'mini-good-hits',  label:'เก็บน้ำดีรัว ๆ', text:'เก็บน้ำดี (💧 / 🥛 / 🍉 / Power-ups) ให้ครบตามจำนวน', target: cfg.miniGoodHits, prog:0, _done:false, _kind:'goodhits' },
    { id:'mini-no-junk',    label:'เลี่ยงน้ำหวาน', text:'ไม่โดนน้ำหวานต่อเนื่องตามเวลาที่กำหนด', target: cfg.miniNoJunkSec, prog:0, _done:false, _kind:'nojunk' }
  ];

  // ---------- Dynamic mini templates (Arcade chain) ----------
  // NOTE: target จะไต่ขึ้นตาม minisDone (ความยากเพิ่ม)
  const MINI_TEMPLATES = [
    // เดิม 3 แบบ
    {
      key: 'combo',
      makeTarget(base, inc){ return clamp(base + inc, 3, 30); },
      textOf(t){ return `ทำคอมโบสูงสุดให้ถึง ${t} (ต่อเนื่อง)`; }
    },
    {
      key: 'goodhits',
      makeTarget(base, inc){ return clamp(base + inc*2, 8, 90); },
      textOf(t){ return `เก็บน้ำดีให้ครบ ${t} ครั้ง`; }
    },
    {
      key: 'nojunk',
      makeTarget(base, inc){ return clamp(base + inc, 6, 45); },
      textOf(t){ return `ไม่โดนน้ำหวานต่อเนื่อง ${t} วินาที`; }
    },

    // ✅ NEW 5 แบบ
    {
      key: 'greenstreak',
      makeTarget(_base, inc){
        const b = (diff === 'easy') ? 8 : (diff === 'hard' ? 12 : 10);
        return clamp(b + inc, 6, 40);
      },
      textOf(t){ return `อยู่โซน GREEN “ต่อเนื่อง” ${t} วินาที`; }
    },
    {
      key: 'perfectstreak',
      makeTarget(_base, inc){
        const b = (diff === 'easy') ? 2 : (diff === 'hard' ? 4 : 3);
        return clamp(b + Math.floor(inc/2), 2, 10);
      },
      textOf(t){ return `ทำ PERFECT ต่อเนื่อง ${t} ครั้ง`; }
    },
    {
      key: 'stormsurvive',
      makeTarget(_base, inc){
        const b = (diff === 'easy') ? 5 : (diff === 'hard' ? 8 : 6);
        return clamp(b + inc, 4, 25);
      },
      textOf(t){ return `อยู่รอดใน STORM ต่อเนื่อง ${t} วินาที`; }
    },
    {
      key: 'bossblock',
      makeTarget(_base, inc){
        const b = (diff === 'easy') ? 1 : (diff === 'hard' ? 2 : 1);
        return clamp(b + Math.floor(inc/3), 1, 6);
      },
      textOf(t){ return `บล็อก 👑BOSS ด้วยโล่ให้ได้ ${t} ครั้ง`; }
    },
    {
      key: 'scoresprint',
      makeTarget(_base, inc){
        const b = (diff === 'easy') ? 180 : (diff === 'hard' ? 280 : 220);
        return clamp(b + inc*40, 120, 900);
      },
      makeWindow(inc){
        const w = (diff === 'easy') ? 14 : (diff === 'hard' ? 10 : 12);
        return clamp(w - Math.floor(inc/5), 7, 18);
      },
      textOf(t, w){ return `ทำแต้มเพิ่ม +${t} ภายใน ${w} วินาที`; }
    }
  ];

  function badZoneSec () {
    return clamp(stats.timeSec - stats.greenTick, 0, 9999);
  }

  function syncProgFields () {
    goals[0].prog = clamp(stats.greenTick, 0, goals[0].target);
    goals[1].prog = badZoneSec();

    minis.forEach(m=>{
      const k = m._kind || '';
      if (k === 'combo') m.prog = clamp(stats.comboBest, 0, m.target);
      else if (k === 'goodhits') m.prog = clamp(stats.goodHits, 0, m.target);
      else if (k === 'nojunk') m.prog = clamp(stats.secSinceJunk, 0, m.target);
      else if (k === 'greenstreak') m.prog = clamp(stats.greenStreakBest, 0, m.target);
      else if (k === 'perfectstreak') m.prog = clamp(stats.perfectStreakBest, 0, m.target);
      else if (k === 'stormsurvive') m.prog = clamp(stats.stormStreakBest, 0, m.target);
      else if (k === 'bossblock') m.prog = clamp(stats.bossBlocked, 0, m.target);
      else if (k === 'scoresprint') m.prog = clamp(stats.scoreDeltaInWindow, 0, m.target);
      else m.prog = clamp(m.prog, 0, m.target);
    });
  }

  function evalGoals () {
    syncProgFields();

    if (!goals[0]._done && stats.greenTick >= cfg.goalGreenTick) {
      goals[0]._done = true;
    }

    if (!goals[1]._done) {
      const bz = badZoneSec();
      if (bz <= cfg.goalBadZoneLimit && stats.timeSec >= cfg.goalGreenTick) {
        goals[1]._done = true;
      }
    }
  }

  function markMiniDoneOnce(m){
    if (m._done) return;
    m._done = true;
    stats.minisDone = (stats.minisDone|0) + 1;
  }

  function evalMinis () {
    syncProgFields();

    minis.forEach(m=>{
      if (m._done) return;
      const k = m._kind || '';

      if (k === 'combo' && stats.comboBest >= m.target) markMiniDoneOnce(m);
      else if (k === 'goodhits' && stats.goodHits >= m.target) markMiniDoneOnce(m);
      else if (k === 'nojunk' && stats.secSinceJunk >= m.target) markMiniDoneOnce(m);

      else if (k === 'greenstreak' && stats.greenStreakBest >= m.target) markMiniDoneOnce(m);
      else if (k === 'perfectstreak' && stats.perfectStreakBest >= m.target) markMiniDoneOnce(m);
      else if (k === 'stormsurvive' && stats.stormStreakBest >= m.target) markMiniDoneOnce(m);
      else if (k === 'bossblock' && stats.bossBlocked >= m.target) markMiniDoneOnce(m);

      else if (k === 'scoresprint'){
        // ผ่านเมื่อ scoreDeltaInWindow >= target ภายใน window (windowLeft ยัง > 0)
        if (stats.scoreWindowLeft > 0 && stats.scoreDeltaInWindow >= m.target) markMiniDoneOnce(m);
        // ถ้า window หมดแล้วจะไม่ผ่านเอง (caller จะ spawn อันใหม่)
      }
    });
  }

  function evalAll () { evalGoals(); evalMinis(); }

  // ---------- API (เดิม) ----------
  function setZone (zone) {
    stats.zone = normZone(zone);
    evalGoals();
  }

  function updateScore (score) {
    const s = Number(score) || 0;

    // score sprint rolling window update
    if (stats.scoreWindowLeft > 0){
      stats.scoreDeltaInWindow = (s - (stats.scoreStart||0))|0;
    }

    stats.score = s;
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

    // perfect streak break
    stats.perfectStreakNow = 0;

    evalAll();
  }

  // ---------- NEW API signals ----------
  function onPerfect(){
    stats.perfectStreakNow = (stats.perfectStreakNow|0) + 1;
    if (stats.perfectStreakNow > (stats.perfectStreakBest|0)) stats.perfectStreakBest = stats.perfectStreakNow;
    evalMinis();
  }

  function setStormActive(active){
    stats.stormActive = !!active;
    // ไม่ eval ทันที เพราะตัววัดหลักคือ second()
  }

  function onBossBlocked(){
    stats.bossBlocked = (stats.bossBlocked|0) + 1;
    evalMinis();
  }

  // ✅ second(): เวลา/zone streak + storm streak + score sprint window countdown
  function second (zoneMaybe) {
    if (zoneMaybe != null) stats.zone = normZone(zoneMaybe);

    stats.timeSec += 1;
    stats.secSinceJunk += 1;

    // green tick + green streak
    if (String(stats.zone).toUpperCase() === 'GREEN') {
      stats.greenTick += 1;
      stats.greenStreakNow = (stats.greenStreakNow|0) + 1;
      if (stats.greenStreakNow > (stats.greenStreakBest|0)) stats.greenStreakBest = stats.greenStreakNow;
    } else {
      stats.greenStreakNow = 0;
    }

    // storm streak
    if (stats.stormActive) {
      stats.stormStreakNow = (stats.stormStreakNow|0) + 1;
      if (stats.stormStreakNow > (stats.stormStreakBest|0)) stats.stormStreakBest = stats.stormStreakNow;
    } else {
      stats.stormStreakNow = 0;
    }

    // score sprint countdown
    if (stats.scoreWindowLeft > 0) {
      stats.scoreWindowLeft -= 1;
      if (stats.scoreWindowLeft <= 0) {
        // หมดเวลา: freeze delta (ไม่ reset ทิ้ง เพื่อให้ UI เห็นว่าไม่ผ่าน)
        stats.scoreWindowLeft = 0;
      }
    }

    evalAll();
  }

  // ---------- Mini chain spawner ----------
  function nextMini (opts = {}) {
    const harder = !!opts.harder;

    const cleared = (stats.minisDone|0);
    const spawned = (stats.minisSpawned|0);

    const baseInc = harder ? Math.max(1, Math.floor(cleared * 0.45)) : Math.max(0, Math.floor(cleared * 0.25));
    const diffInc = (diff === 'easy') ? Math.floor(baseInc * 0.75) : (diff === 'hard' ? Math.ceil(baseInc * 1.2) : baseInc);

    const t = pickOne(MINI_TEMPLATES, MINI_TEMPLATES[0]);

    let target = 0;
    let windowSec = 0;

    if (t.key === 'combo') target = t.makeTarget(cfg.miniComboBest, diffInc);
    else if (t.key === 'goodhits') target = t.makeTarget(cfg.miniGoodHits, diffInc);
    else if (t.key === 'nojunk') target = t.makeTarget(cfg.miniNoJunkSec, diffInc);
    else if (t.key === 'greenstreak') target = t.makeTarget(0, diffInc);
    else if (t.key === 'perfectstreak') target = t.makeTarget(0, diffInc);
    else if (t.key === 'stormsurvive') target = t.makeTarget(0, diffInc);
    else if (t.key === 'bossblock') target = t.makeTarget(0, diffInc);
    else if (t.key === 'scoresprint') {
      target = t.makeTarget(0, diffInc);
      windowSec = t.makeWindow(diffInc);

      // init window
      stats.scoreStart = stats.score|0;
      stats.scoreDeltaInWindow = 0;
      stats.scoreWindowLeft = windowSec|0;
    }

    const id = `mini-${t.key}-${Date.now()}-${spawned}`;

    const labelMap = {
      combo: 'สายคอมโบ (ต่อเนื่อง)',
      goodhits: 'เก็บน้ำดีต่อเนื่อง',
      nojunk: 'เลี่ยงน้ำหวาน (ต่อเนื่อง)',
      greenstreak: 'GREEN ต่อเนื่อง',
      perfectstreak: 'PERFECT ต่อเนื่อง',
      stormsurvive: 'STORM อยู่รอด',
      bossblock: 'บล็อกบอส 👑',
      scoresprint: 'SCORE SPRINT'
    };

    const text =
      (t.key === 'scoresprint')
        ? t.textOf(target, windowSec)
        : t.textOf(target);

    const m = {
      id,
      label: labelMap[t.key] || 'Mini ต่อเนื่อง',
      text,
      target,
      prog: 0,
      _done: false,
      _kind: t.key,
      _window: windowSec ? windowSec|0 : 0
    };

    minis.push(m);
    stats.minisSpawned = spawned + 1;

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
    if (id === 'mini-combo') return { now: stats.comboBest, target: cfg.miniComboBest, text: `${stats.comboBest}/${cfg.miniComboBest} คอมโบสูงสุด` };
    if (id === 'mini-good-hits') return { now: stats.goodHits, target: cfg.miniGoodHits, text: `${stats.goodHits}/${cfg.miniGoodHits} น้ำดีที่เก็บ` };
    if (id === 'mini-no-junk') return { now: stats.secSinceJunk, target: cfg.miniNoJunkSec, text: `${stats.secSinceJunk}/${cfg.miniNoJunkSec} วินาทีไม่โดนน้ำหวาน` };

    // dynamic
    if (!m) return { now: 0, target: 0, text: '' };

    const k = m._kind || '';
    if (k === 'combo') return { now: stats.comboBest, target: m.target, text: `${stats.comboBest}/${m.target} คอมโบสูงสุด` };
    if (k === 'goodhits') return { now: stats.goodHits, target: m.target, text: `${stats.goodHits}/${m.target} น้ำดีที่เก็บ` };
    if (k === 'nojunk') return { now: stats.secSinceJunk, target: m.target, text: `${stats.secSinceJunk}/${m.target} วินาทีไม่โดนน้ำหวาน` };

    if (k === 'greenstreak') return { now: stats.greenStreakBest, target: m.target, text: `${stats.greenStreakBest}/${m.target} วินาที GREEN ต่อเนื่อง (สูงสุด)` };
    if (k === 'perfectstreak') return { now: stats.perfectStreakBest, target: m.target, text: `${stats.perfectStreakBest}/${m.target} PERFECT ต่อเนื่อง (สูงสุด)` };
    if (k === 'stormsurvive') return { now: stats.stormStreakBest, target: m.target, text: `${stats.stormStreakBest}/${m.target} วินาทีใน STORM ต่อเนื่อง (สูงสุด)` };
    if (k === 'bossblock') return { now: stats.bossBlocked, target: m.target, text: `${stats.bossBlocked}/${m.target} บล็อก 👑BOSS` };

    if (k === 'scoresprint'){
      const left = stats.scoreWindowLeft|0;
      return { now: stats.scoreDeltaInWindow|0, target: m.target, text: `+${stats.scoreDeltaInWindow|0}/${m.target} แต้ม • เหลือ ${left}s` };
    }

    return { now: m.prog|0, target: m.target|0, text: `${m.prog|0}/${m.target|0}` };
  }

  function getMiniNoJunkProgress() {
    return { now: stats.secSinceJunk, target: cfg.miniNoJunkSec };
  }

  try {
    ROOT.HHA_HYDRATION_QUEST_DEBUG = { cfg, stats, goals, minis };
  } catch {}

  return {
    cfg,
    stats,
    goals,
    minis,
    setZone,
    updateScore,
    updateCombo,
    onGood,
    onJunk,
    second,
    getProgress,
    nextGoal,
    nextMini,
    getGoalProgressInfo,
    getMiniProgressInfo,
    getMiniNoJunkProgress,

    // ✅ NEW API (optional)
    onPerfect,
    setStormActive,
    onBossBlocked
  };
}

export default { createHydrationQuest };
