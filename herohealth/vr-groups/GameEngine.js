// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (Fever + 2 Goals + 3 Mini Quests)
// ใช้ร่วมกับ /herohealth/vr/mode-factory.js และ ui-fever.js

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

// ---------- helper: dispatch event ----------
function dispatch(name, detail) {
  try {
    ROOT.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (err) {
    console.warn('[GroupsVR] dispatch error:', name, err);
  }
}

// ---------- emoji ตามหมวดอาหาร ----------
const GRAIN = ['🍚','🍙','🍘','🍞','🥐','🥖','🥯'];
const PROTEIN = ['🍗','🍖','🥩','🍤','🍣','🥚','🫘'];
const VEGGIE  = ['🥦','🥕','🌽','🍅','🥬','🧅','🫑'];
const FRUIT   = ['🍎','🍌','🍉','🍇','🍍','🍓','🍑'];
const MILK    = ['🥛','🧀','🍨','🍦','🍮','🍧','🍯'];

const ALL_GOOD = [...GRAIN, ...PROTEIN, ...VEGGIE, ...FRUIT, ...MILK];

function groupOf(ch) {
  if (GRAIN.includes(ch))   return 'grain';
  if (PROTEIN.includes(ch)) return 'protein';
  if (VEGGIE.includes(ch))  return 'veg';
  if (FRUIT.includes(ch))   return 'fruit';
  if (MILK.includes(ch))    return 'milk';
  return 'other';
}

// ---------- engine state ----------
let engine = null;

// อ่านเวลาเล่นให้ตรงกับ groups-vr.html
function getDurationFromUrl(diffKey) {
  const url = new URL(window.location.href);
  let base = 60;
  if (diffKey === 'easy') base = 80;
  else if (diffKey === 'hard') base = 45;

  let dur = base;
  const t = url.searchParams.get('time');
  if (t) {
    const p = parseInt(t, 10);
    if (!Number.isNaN(p) && p >= 20 && p <= 180) dur = p;
  }
  return dur;
}

// ---------- Fever ----------
function applyFeverDelta(st, delta) {
  if (!st || !st.feverUI) return;
  st.feverGauge = Math.max(0, Math.min(100, (st.feverGauge || 0) + delta));
  st.feverUI.setFever && st.feverUI.setFever(st.feverGauge);

  if (!st.feverOn && st.feverGauge >= 100) {
    st.feverOn = true;
    st.feverUI.setFeverActive && st.feverUI.setFeverActive(true);
    dispatch('hha:fever', { state: 'start' });

    setTimeout(() => {
      const cur = engine;
      if (!cur) return;
      cur.feverOn = false;
      cur.feverGauge = 0;
      cur.feverUI.setFever && cur.feverUI.setFever(0);
      cur.feverUI.setFeverActive && cur.feverUI.setFeverActive(false);
      dispatch('hha:fever', { state: 'end' });
    }, 6000);
  }
}

// ---------- Quest update ----------
function updateQuests() {
  const st = engine;
  if (!st) return;

  const prevDoneKeys = new Set();
  st.goalsAll.forEach(q => q.done && prevDoneKeys.add(q.key));
  st.minisAll.forEach(q => q.done && prevDoneKeys.add(q.key));

  const totalHits = st.totalHits;
  const gHit      = st.groupsHit;

  // Goal 1: เก็บอาหารให้ครบ 25 ชิ้น
  const g1 = st.goalsAll[0];
  g1.prog = totalHits;
  if (!g1.done && g1.prog >= g1.target) g1.done = true;

  // Goal 2: เก็บครบทั้ง 5 หมู่
  const covered = ['grain','protein','veg','fruit','milk']
    .filter(k => (gHit[k] || 0) > 0).length;
  const g2 = st.goalsAll[1];
  g2.prog = covered;
  if (!g2.done && g2.prog >= g2.target) g2.done = true;

  // Mini 1: คอมโบถึง 10
  const m1 = st.minisAll[0];
  m1.prog = Math.min(st.comboMax, m1.target);
  if (!m1.done && m1.prog >= m1.target) m1.done = true;

  // Mini 2: ตีติดกันไม่พลาด 6 ชิ้น (ใช้ comboMax เช่นกัน)
  const m2 = st.minisAll[1];
  m2.prog = Math.min(st.comboMax, m2.target);
  if (!m2.done && m2.prog >= m2.target) m2.done = true;

  // Mini 3: โปรตีนอย่างน้อย 6 ชิ้น
  const m3 = st.minisAll[2];
  m3.prog = Math.min(gHit.protein || 0, m3.target);
  if (!m3.done && m3.prog >= m3.target) m3.done = true;

  // เช็คว่าอะไรเพิ่งสำเร็จ → ฉลอง
  const newlyDone = [];
  st.goalsAll.concat(st.minisAll).forEach(q => {
    if (q.done && !prevDoneKeys.has(q.key)) newlyDone.push(q);
  });

  newlyDone.forEach(q => {
    const isMain = q.key.startsWith('g');
    const typeLabel = isMain ? 'ภารกิจหลัก' : 'Mini quest';
    const short = q.short || q.label;
    dispatch('hha:coach', {
      text: `เยี่ยม! ${typeLabel} "${short}" สำเร็จแล้ว 🎉`
    });
  });

  // เดินภารกิจถัดไป (บน HUD)
  if (st.activeGoalIndex < st.goalsAll.length &&
      st.goalsAll[st.activeGoalIndex].done) {
    st.activeGoalIndex++;
  }
  if (st.activeMiniIndex < st.minisAll.length &&
      st.minisAll[st.activeMiniIndex].done) {
    st.activeMiniIndex++;
  }

  const activeGoal = st.goalsAll[st.activeGoalIndex] || null;
  const activeMini = st.minisAll[st.activeMiniIndex] || null;

  let hint = '';
  if (activeGoal && activeGoal.key === 'g2') {
    hint = 'พยายามให้มีครบทั้ง ข้าว/แป้ง โปรตีน ผัก ผลไม้ และนม';
  }

  dispatch('quest:update', {
    goal: activeGoal,
    mini: activeMini,
    goalsAll: st.goalsAll,
    minisAll: st.minisAll,
    hint
  });

  // ถ้าทำครบทุก Goal & Mini แล้ว → จบเกมเลย
  const allGoalsDone = st.goalsAll.every(q => q.done);
  const allMinisDone = st.minisAll.every(q => q.done);
  if (st.running && allGoalsDone && allMinisDone) {
    dispatch('hha:coach', {
      text: 'สุดยอด! ทำภารกิจหลักและ Mini ครบทั้งหมดแล้ว 🎉'
    });
    GameEngine.stop('all-quests-done');
  }
}

// ---------- stop ----------
function _internalStop(reason = 'manual') {
  const st = engine;
  if (!st || !st.running) return;
  st.running = false;

  if (st.stopHandle) {
    try { st.stopHandle(reason); } catch (err) {
      console.warn('[GroupsVR] stopHandle error:', err);
    }
    st.stopHandle = null;
  }

  const goalsCleared = st.goalsAll.filter(q => q.done).length;
  const goalsTotal   = st.goalsAll.length;
  const miniCleared  = st.minisAll.filter(q => q.done).length;
  const miniTotal    = st.minisAll.length;

  dispatch('hha:end', {
    scoreFinal: st.score,
    comboMax: st.comboMax,
    misses: st.misses,
    goalsCleared,
    goalsTotal,
    miniCleared,
    miniTotal,
    reason
  });
}

// ---------- start ----------
async function _internalStart(diffKey = 'normal') {
  diffKey = String(diffKey || 'normal').toLowerCase();
  if (!['easy','normal','hard'].includes(diffKey)) diffKey = 'normal';

  // ถ้ามีเกมเก่าอยู่ให้หยุดก่อน
  if (engine && engine.running) {
    _internalStop('restart');
  }

  // Fever UI
  const FeverUI =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
    ROOT.FeverUI ||
    null;

  if (FeverUI && FeverUI.ensureFeverBar) {
    FeverUI.ensureFeverBar();
    FeverUI.setFever && FeverUI.setFever(0);
    FeverUI.setFeverActive && FeverUI.setFeverActive(false);
    FeverUI.setShield && FeverUI.setShield(0);
  }

  const st = {
    running: true,
    score: 0,
    combo: 0,
    comboMax: 0,
    misses: 0,
    totalHits: 0,
    groupsHit: { grain:0, protein:0, veg:0, fruit:0, milk:0 },
    feverUI: FeverUI,
    feverGauge: 0,
    feverOn: false,
    stopHandle: null,
    // ภารกิจหลัก 2 ภารกิจ
    goalsAll: [
      {
        key: 'g1',
        label: 'เก็บอาหารให้ครบ 25 ชิ้น',
        short: 'เก็บ 25 ชิ้น',
        prog: 0,
        target: 25,
        done: false
      },
      {
        key: 'g2',
        label: 'เก็บครบทั้ง 5 หมู่',
        short: 'ครบทั้ง 5 หมู่',
        prog: 0,
        target: 5,
        done: false
      }
    ],
    // mini quest 3 ภารกิจ
    minisAll: [
      {
        key: 'm1',
        label: 'ทำคอมโบให้ถึง 10',
        short: 'คอมโบ 10',
        prog: 0,
        target: 10,
        done: false
      },
      {
        key: 'm2',
        label: 'ตีติดกันไม่พลาด 6 ชิ้น',
        short: 'ไม่พลาด 6 ชิ้น',
        prog: 0,
        target: 6,
        done: false
      },
      {
        key: 'm3',
        label: 'เก็บหมู่โปรตีนอย่างน้อย 6 ชิ้น',
        short: 'โปรตีน 6 ชิ้น',
        prog: 0,
        target: 6,
        done: false
      }
    ],
    activeGoalIndex: 0,
    activeMiniIndex: 0
  };

  engine = st;

  // แจ้ง coach เริ่มเกม
  dispatch('hha:coach', {
    text: 'หมุนมุมมองแล้วลองเก็บอาหารให้ครบทั้ง 5 หมู่ภายในเวลาที่กำหนดนะ 🥗'
  });

  updateQuests();

  const duration = getDurationFromUrl(diffKey);

  // ตัว spawn เป้า (ใช้ร่วมกับ Hydration)
  const bootResult = await factoryBoot({
    modeKey: 'groups',
    difficulty: diffKey,
    duration,
    pools: { good: ALL_GOOD, bad: [] },
    goodRate: 1.0,
    powerups: [],
    powerRate: 0,
    powerEvery: 999, // ไม่ใช้ powerup ในภาคนี้
    judge: (ch /* emoji */, ctx) => {
      if (!engine || !engine.running) return;

      const g = groupOf(ch);
      if (g && engine.groupsHit[g] != null) {
        engine.groupsHit[g] += 1;
      }

      engine.totalHits += 1;
      engine.score += 100;
      engine.combo += 1;
      if (engine.combo > engine.comboMax) engine.comboMax = engine.combo;

      dispatch('hha:score', {
        score: engine.score,
        combo: engine.combo,
        misses: engine.misses
      });

      // label บอกคุณภาพการตี
      let label = 'GOOD';
      if (engine.combo >= 15) label = 'PERFECT!!';
      else if (engine.combo >= 8) label = 'PERFECT';
      else if (engine.combo >= 4) label = 'GREAT';
      dispatch('hha:judge', { label });

      applyFeverDelta(engine, +7);
      updateQuests();
    },
    onExpire: (ev) => {
      if (!engine || !engine.running) return;

      // นับ MISS เฉพาะที่เป็นอาหารดี
      if (ev && ev.isGood) {
        engine.misses += 1;
        engine.combo = 0;

        dispatch('hha:score', {
          score: engine.score,
          combo: engine.combo,
          misses: engine.misses
        });
        dispatch('hha:miss', {});
        dispatch('hha:judge', { label: 'MISS' });

        applyFeverDelta(engine, -12);
        updateQuests();
      }
    }
  });

  st.stopHandle = bootResult && bootResult.stop;
}

// ---------- public API ----------
export const GameEngine = {
  start: _internalStart,
  stop:  _internalStop
};

export default GameEngine;