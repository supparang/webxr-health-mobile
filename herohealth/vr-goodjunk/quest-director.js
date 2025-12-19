// === /herohealth/vr-goodjunk/quest-director.js ===
// Quest Director (Goals sequential + Minis chain) for GoodJunk
// ✅ v2: รองรับ schema ใหม่จาก quest-defs-goodjunk.js:
// - targetByDiff / eval(state) / pass(value,target)
// - hint / onlyChallenge[] / notChallenge[]
// - Goals: สุ่ม "ทั้งหมดในเกม" = maxGoals, ทำแบบ sequential
// - Minis: ต่อเนื่องไม่รู้จบ (maxMini) + สุ่มแบบกรองเงื่อนไข
// Emits:
// - quest:update { goal, mini, goalsAll, minisAll, hint }
// - quest:miniStart { id }

'use strict';

export function makeQuestDirector(opts = {}) {
  const diff = String(opts.diff || 'normal').toLowerCase();
  const goalDefs = Array.isArray(opts.goalDefs) ? opts.goalDefs : [];
  const miniDefs = Array.isArray(opts.miniDefs) ? opts.miniDefs : [];
  const maxGoals = Math.max(1, opts.maxGoals || 2);
  const maxMini  = Math.max(1, opts.maxMini  || 999);

  const stateQ = {
    goalsAll: [],
    minisAll: [],
    goalIndex: 0,
    miniCount: 0,
    activeGoal: null,
    activeMini: null,
    started: false,
    lastHint: ''
  };

  function clampInt(v, min, max){
    v = (v|0);
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  function pickUnique(defs, n){
    const arr = defs.slice();
    const out = [];
    while (arr.length && out.length < n){
      const i = (Math.random()*arr.length)|0;
      out.push(arr.splice(i,1)[0]);
    }
    return out;
  }

  function isAllowed(def, gameState){
    const ch = String(gameState?.challenge || '').toLowerCase();
    if (Array.isArray(def.onlyChallenge) && def.onlyChallenge.length){
      if (!def.onlyChallenge.map(x=>String(x).toLowerCase()).includes(ch)) return false;
    }
    if (Array.isArray(def.notChallenge) && def.notChallenge.length){
      if (def.notChallenge.map(x=>String(x).toLowerCase()).includes(ch)) return false;
    }
    return true;
  }

  function targetFor(def){
    if (def && def.targetByDiff && def.targetByDiff[diff] != null){
      return clampInt(def.targetByDiff[diff], 1, 9999);
    }
    // fallback: ถ้าไม่มี targetByDiff ให้ใช้ 1
    return 1;
  }

  function newGoal(def){
    return {
      id: String(def.id || ''),
      label: String(def.label || 'Goal'),
      hint: String(def.hint || ''),
      target: targetFor(def),
      prog: 0,
      done: false
    };
  }

  function newMini(def){
    return {
      id: String(def.id || ''),
      label: String(def.label || 'Mini'),
      hint: String(def.hint || ''),
      target: targetFor(def),
      prog: 0,
      done: false,
      startedAt: Date.now()
    };
  }

  function emit(detail){
    window.dispatchEvent(new CustomEvent('quest:update', { detail }));
  }

  function buildPayload(hint=''){
    const g = (stateQ.activeGoal && !stateQ.activeGoal.done) ? stateQ.activeGoal : null;
    const m = (stateQ.activeMini && !stateQ.activeMini.done) ? stateQ.activeMini : null;
    stateQ.lastHint = hint || '';
    return {
      goal: g,
      mini: m,
      goalsAll: stateQ.goalsAll,
      minisAll: stateQ.minisAll,
      hint: stateQ.lastHint
    };
  }

  function recomputeOne(def, row, gameState){
    // progress
    let v = 0;
    try{
      v = (typeof def.eval === 'function') ? (def.eval(gameState) | 0) : 0;
    }catch(_){ v = 0; }
    row.prog = v;

    // pass/fail
    let ok = false;
    try{
      if (typeof def.pass === 'function') ok = !!def.pass(v, row.target);
      else ok = (v >= (row.target|0));
    }catch(_){ ok = false; }
    row.done = ok;
  }

  function nextGoal(){
    stateQ.goalIndex++;
    stateQ.activeGoal = stateQ.goalsAll[stateQ.goalIndex] || null;
  }

  function pickMiniDef(gameState){
    // กัน loop: ลองสุ่มสูงสุด 12 ครั้ง
    for (let k=0;k<12;k++){
      const def = miniDefs[(Math.random()*miniDefs.length)|0];
      if (!def) continue;
      if (!isAllowed(def, gameState)) continue;
      return def;
    }
    // fallback: ถ้าไม่มีตัวที่ผ่านเงื่อนไข ให้คืน null
    return null;
  }

  function nextMini(gameState){
    if (stateQ.miniCount >= maxMini){
      stateQ.activeMini = null;
      return;
    }
    const def = pickMiniDef(gameState);
    if (!def){
      stateQ.activeMini = null;
      return;
    }
    const m = newMini(def);
    stateQ.activeMini = m;
    stateQ.minisAll.push(m);
    stateQ.miniCount++;

    // แจ้ง html ให้ reset mini counters ที่ต้องรีเซ็ต
    window.dispatchEvent(new CustomEvent('quest:miniStart', { detail:{ id: m.id } }));
    emit(buildPayload('Mini ใหม่มาแล้ว!'));
  }

  function start(gameState){
    stateQ.started = true;

    // เลือก goals “ทั้งหมดในเกม” (maxGoals) และทำ sequential
    const pickedGoals = pickUnique(goalDefs, maxGoals);
    stateQ.goalsAll = pickedGoals.map(def => newGoal(def));
    stateQ.goalIndex = 0;
    stateQ.activeGoal = stateQ.goalsAll[0] || null;

    // minis chain
    stateQ.minisAll = [];
    stateQ.miniCount = 0;
    stateQ.activeMini = null;
    nextMini(gameState);

    emit(buildPayload('เริ่มภารกิจ!'));
  }

  function update(gameState){
    if (!stateQ.started) return;

    // --- GOAL ---
    if (stateQ.activeGoal){
      const g = stateQ.activeGoal;
      const def = goalDefs.find(d => String(d.id) === String(g.id));
      if (def){
        // ถ้า goal นี้ไม่ตรง challenge → ข้ามแบบแฟร์ (ถือว่าผ่าน)
        if (!isAllowed(def, gameState)){
          g.done = true;
        } else {
          recomputeOne(def, g, gameState);
        }

        if (g.done){
          emit(buildPayload('GOAL CLEAR!'));
          nextGoal();
        }
      }
    }

    // --- MINI ---
    if (stateQ.activeMini){
      const m = stateQ.activeMini;
      const def = miniDefs.find(d => String(d.id) === String(m.id));
      if (def){
        // ถ้า mini นี้ไม่ตรง challenge → เปลี่ยนตัวใหม่ทันที
        if (!isAllowed(def, gameState)){
          m.done = true; // นับว่าจบ (ข้าม)
          nextMini(gameState);
          return;
        }

        recomputeOne(def, m, gameState);

        if (m.done){
          emit(buildPayload('MINI CLEAR!'));
          nextMini(gameState);
          return;
        }
      }
    }

    // hint โชว์ของ def ที่ active (ถ้ามี)
    let hint = '';
    const gNow = stateQ.activeGoal;
    if (gNow && gNow.hint) hint = gNow.hint;

    const mNow = stateQ.activeMini;
    if (mNow && mNow.hint){
      hint = hint ? (hint + ' • ' + mNow.hint) : mNow.hint;
    }

    emit(buildPayload(hint));
  }

  function finalize(gameState){
    const goalsCleared = stateQ.goalsAll.filter(x => x && x.done).length;
    const goalsTotal   = stateQ.goalsAll.length;

    const miniCleared  = stateQ.minisAll.filter(x => x && x.done).length;
    const miniTotal    = stateQ.minisAll.length;

    return { goalsCleared, goalsTotal, miniCleared, miniTotal };
  }

  return { start, update, finalize };
}