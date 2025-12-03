// === /herohealth/vr-goodjunk/quest-director-goodjunk.js ===
// Quest Director สำหรับ Good vs Junk VR
// - อ่านนิยามจาก GOODJUNK_GOALS / GOODJUNK_MINIS
// - สุ่มเลือก Goals 2 อัน + Mini 3 อัน ตามระดับความยาก
// - ยิง event "quest:update" ให้ HUD ใน goodjunk-vr.html ใช้ได้ทันที

'use strict';

import { GOODJUNK_GOALS, GOODJUNK_MINIS } from './quest-defs-goodjunk.js';

// ---- helper ยิง event ออกไปให้ HUD / ระบบอื่นใช้ ----
function emit(name, detail) {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (e) {
    console.warn('QuestDirector emit error', e);
  }
}

// เลือก tier ตาม diff
function tierKey(diff) {
  if (!diff) return 'normal';
  const d = String(diff).toLowerCase();
  if (d === 'easy') return 'easy';
  if (d === 'hard') return 'hard';
  return 'normal';
}

// สุ่มลำดับแล้วตัดเอา N ตัว
function pickRandom(list, n) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(n, a.length));
}

// แปลง def → instance ที่มี target/prog/done
function makeInstance(def, tier) {
  const target = def[tier] ?? def.normal ?? def.easy ?? 0;
  return {
    id: def.id,
    label: def.label,
    kind: def.kind,   // 'score' | 'goodHits' | 'missMax' | 'combo'
    target: target | 0,
    prog: 0,
    done: false
  };
}

// --------- Quest Director object (compatible กับ GameEngine) ---------
export const Quest = {
  _state: null,

  start() {
    // อ่าน diff จาก URL (เช่น ?diff=easy / normal / hard)
    let diff = 'normal';
    try {
      const url = new URL(window.location.href);
      diff = (url.searchParams.get('diff') || 'normal').toLowerCase();
    } catch {
      diff = 'normal';
    }
    const tier = tierKey(diff);

    // สุ่ม 2 goals + 3 mini จากตาราง
    const goalsPicked = pickRandom(GOODJUNK_GOALS, 2).map(def =>
      makeInstance(def, tier)
    );
    const minisPicked = pickRandom(GOODJUNK_MINIS, 3).map(def =>
      makeInstance(def, tier)
    );

    this._state = {
      diff,
      tier,
      finished: false,

      // gameplay stats สำหรับใช้คิด prog
      score: 0,
      goodHits: 0,
      junkHits: 0,
      bestCombo: 0,

      goals: goalsPicked,
      minis: minisPicked
    };

    // ค่าให้ HUD รู้ว่า มีทั้งหมดกี่อัน (ใช้ตอนสรุปผลได้)
    window.hhaGoalsTotal = goalsPicked.length;
    window.hhaGoalsDone  = 0;
    window.hhaMiniTotal  = minisPicked.length;
    window.hhaMiniDone   = 0;

    this._emitUpdate();
  },

  stop() {
    // mark ว่าจบเกมแล้ว → ใช้ตัดสิน missMax
    if (!this._state) return;
    this._state.finished = true;
    this._recalc();      // คำนวณ done/fail รอบสุดท้าย
    this._emitUpdate();  // ส่ง snapshot ท้ายเกมอีกครั้ง
  },

  // เรียกจาก GameEngine ตอนเก็บของดี
  onGood() {
    if (!this._state) return;
    const st = this._state;

    st.score = window.score | 0;
    st.goodHits += 1;

    const cNow = window.combo | 0;
    const cMax = window.comboMax | 0;
    st.bestCombo = Math.max(st.bestCombo, cNow, cMax);

    this._recalc();
    this._emitUpdate();
  },

  // เรียกจาก GameEngine ตอนแตะของขยะ
  onBad() {
    if (!this._state) return;
    const st = this._state;

    st.score = window.score | 0;
    st.junkHits += 1;

    const cMax = window.comboMax | 0;
    st.bestCombo = Math.max(st.bestCombo, cMax);

    this._recalc();
    this._emitUpdate();
  },

  onFever() {
    // ตอนนี้ยังไม่ใช้ fever กับ quest โดยตรง แต่สามารถขยายทีหลังได้
    this._emitUpdate();
  },

  // ---- core: คำนวณ progress + done ของทุก quest ----
  _recalc() {
    const st = this._state;
    if (!st) return;

    const score     = st.score | 0;
    const goodHits  = st.goodHits | 0;
    const junkHits  = st.junkHits | 0;
    const comboMax  = st.bestCombo | 0;
    const finished  = !!st.finished;

    function evalOne(inst) {
      const kind = inst.kind;
      if (!kind) return;

      if (kind === 'score') {
        inst.prog = score;
        inst.done = inst.prog >= inst.target;
      } else if (kind === 'goodHits') {
        inst.prog = goodHits;
        inst.done = inst.prog >= inst.target;
      } else if (kind === 'combo') {
        inst.prog = comboMax;
        inst.done = inst.prog >= inst.target;
      } else if (kind === 'missMax') {
        // ✅ แสดงเป็น "แตะของขยะไปแล้วกี่ครั้ง / โควตา"
        inst.prog = Math.min(inst.target, junkHits);

        // ✅ ผ่านเควสต์ได้ก็ตอน "จบเกมแล้ว" และ junkHits ≤ target
        if (finished) {
          inst.done = junkHits <= inst.target;
        } else {
          inst.done = false; // ระหว่างเล่น ยังไม่ฟันธงผ่าน/ไม่ผ่าน
        }
      }
    }

    st.goals.forEach(evalOne);
    st.minis.forEach(evalOne);

    // อัปเดตตัวนับ global สำหรับ summary HUD
    const goalsDone = st.goals.filter(g => g.done).length;
    const minisDone = st.minis.filter(m => m.done).length;
    window.hhaGoalsDone = goalsDone;
    window.hhaMiniDone  = minisDone;
  },

  // ---- ส่ง snapshot ให้ HUD: quest:update ----
  _emitUpdate() {
    const st = this._state;
    if (!st) return;

    const goals = st.goals || [];
    const minis = st.minis || [];

    // เลือก "ตัวปัจจุบัน" = อันแรกที่ยังไม่ done ถ้ามี
    const curGoal = goals.find(g => !g.done) || goals[0] || null;
    const curMini = minis.find(m => !m.done) || minis[0] || null;

    const detail = {
      goal: curGoal
        ? {
            label:  curGoal.label,
            prog:   curGoal.prog | 0,
            target: curGoal.target | 0
          }
        : null,
      mini: curMini
        ? {
            label:  curMini.label,
            prog:   curMini.prog | 0,
            target: curMini.target | 0
          }
        : null,

      // ส่งทั้งหมดเผื่อ HUD / logger อยากใช้
      goalsAll: goals.map(g => ({
        id: g.id,
        label: g.label,
        kind: g.kind,
        prog: g.prog | 0,
        target: g.target | 0,
        done: !!g.done
      })),
      minisAll: minis.map(m => ({
        id: m.id,
        label: m.label,
        kind: m.kind,
        prog: m.prog | 0,
        target: m.target | 0,
        done: !!m.done
      })),

      // hint ข้อความโค้ชเบา ๆ
      hint: this._buildHint(st)
    };

    emit('quest:update', detail);

    // ถ้า goal ทั้งหมดผ่านแล้ว ยิง event เพิ่มให้โค้ช / logger ได้ใช้
    const allGoalsDone = goals.length > 0 && goals.every(g => g.done);
    if (allGoalsDone) {
      emit('quest:goal-done', detail);
    }
  },

  _buildHint(st) {
    const parts = [];
    parts.push(`คะแนน: ${st.score}|0`.replace('|0','')); // กัน undefined

    parts.push(`อาหารดี: ${st.goodHits|0} ชิ้น`);
    parts.push(`ขยะ: ${st.junkHits|0} ชิ้น`);
    parts.push(`คอมโบสูงสุด: ${st.bestCombo|0}`);

    return parts.join(' • ');
  },

  // ใช้ตอน GameEngine.finishSession เรียกสรุป
  getSummary() {
    const st = this._state;
    if (!st) return null;

    const goals = st.goals || [];
    const minis = st.minis || [];

    const goalsDone = goals.filter(g => g.done).length;
    const minisDone = minis.filter(m => m.done).length;

    return {
      mainDone: goals.length > 0 && goalsDone === goals.length,
      goalsCleared: goalsDone,
      goalsTotal: goals.length,
      miniCleared: minisDone,
      miniTotal: minis.length
    };
  }
};

export default Quest;
