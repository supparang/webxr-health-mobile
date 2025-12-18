// === /herohealth/vr-goodjunk/quest-director.js ===
// Quest Director (Goals sequential + Minis chain) for GoodJunk

'use strict';

export function makeQuestDirector(opts = {}) {
  const diff = String(opts.diff || 'normal').toLowerCase();
  const goalDefs = Array.isArray(opts.goalDefs) ? opts.goalDefs : [];
  const miniDefs = Array.isArray(opts.miniDefs) ? opts.miniDefs : [];
  const maxGoals = Math.max(1, opts.maxGoals || 2);   // เก็บเป็น “ทั้งหมดในเกม”
  const maxMini  = Math.max(1, opts.maxMini  || 999); // mini ต่อเนื่อง (7)

  const stateQ = {
    goalsAll: [],
    minisAll: [],
    goalIndex: 0,
    miniCount: 0,
    activeMini: null,
    activeGoal: null,
    started: false,
    lastSafeSecAt: Date.now()
  };

  function pickUnique(defs, n){
    const arr = defs.slice();
    const out = [];
    while (arr.length && out.length < n){
      const i = (Math.random()*arr.length)|0;
      out.push(arr.splice(i,1)[0]);
    }
    return out;
  }

  function newGoal(def){
    const target = (def.makeTarget ? def.makeTarget(diff) : 1) | 0;
    return { id:def.id, label:def.label, target, prog:0, done:false, hold:false, only:null, limit:null };
  }
  function newMini(def){
    const target = (def.makeTarget ? def.makeTarget(diff) : 1) | 0;
    return { id:def.id, label:def.label, target, prog:0, done:false, timer:false, startedAt:Date.now() };
  }

  function emit(detail){
    window.dispatchEvent(new CustomEvent('quest:update',{ detail }));
  }

  function recomputeGoal(g, gameState, def){
    const r = def.calc ? def.calc(gameState, g.target) : { prog:0, target:g.target };
    g.prog   = (r.prog|0);
    g.target = (r.target|0) || g.target;
    g.hold   = !!r.hold;
    g.only   = r.only || null;
    g.limit  = (r.limit!=null) ? (r.limit|0) : null;

    // goal done (ถ้า hold ให้ finalize ตอนจบ)
    if (!g.hold){
      g.done = (g.target>0) ? (g.prog >= g.target) : false;
    }
  }

  function recomputeMini(m, gameState, def){
    if (m.timer){
      // safeSeconds = นับจาก gameState.safeSeconds ที่ส่งมา
      m.prog = (gameState.safeSeconds|0);
    } else {
      const r = def.calc ? def.calc(gameState, m.target) : { prog:0, target:m.target };
      m.prog   = (r.prog|0);
      m.target = (r.target|0) || m.target;
    }
    m.done = (m.target>0) ? (m.prog >= m.target) : false;
  }

  function buildPayload(hint=''){
    const g = stateQ.activeGoal && !stateQ.activeGoal.done ? stateQ.activeGoal : null;
    const m = stateQ.activeMini && !stateQ.activeMini.done ? stateQ.activeMini : null;

    return {
      goal: g,
      mini: m,
      goalsAll: stateQ.goalsAll,
      minisAll: stateQ.minisAll,
      hint
    };
  }

  function start(gameState){
    stateQ.started = true;

    // เลือก goals “ทั้งหมดในเกม”
    const pickedGoals = pickUnique(goalDefs, maxGoals);
    stateQ.goalsAll = pickedGoals.map(def => newGoal(def));
    stateQ.goalIndex = 0;
    stateQ.activeGoal = stateQ.goalsAll[0] || null;

    // สุ่ม mini ตัวแรก
    stateQ.minisAll = [];
    stateQ.miniCount = 0;
    stateQ.activeMini = null;
    nextMini(gameState);

    emit(buildPayload('เริ่มภารกิจ!'));
  }

  function nextGoal(){
    stateQ.goalIndex++;
    stateQ.activeGoal = stateQ.goalsAll[stateQ.goalIndex] || null;
  }

  function nextMini(gameState){
    if (stateQ.miniCount >= maxMini) { stateQ.activeMini = null; return; }
    const def = miniDefs[(Math.random()*miniDefs.length)|0];
    const m = newMini(def);
    stateQ.activeMini = m;
    stateQ.minisAll.push(m);
    stateQ.miniCount++;
    // reset mini-related counters from gameState hints (ให้ html รีเซ็ตเองได้)
    window.dispatchEvent(new CustomEvent('quest:miniStart', { detail:{ id:m.id }}));
    emit(buildPayload('Mini ใหม่มาแล้ว!'));
  }

  function update(gameState){
    if (!stateQ.started) return;

    // update goal
    if (stateQ.activeGoal){
      const g = stateQ.activeGoal;
      const def = goalDefs.find(d=>d.id===g.id);
      if (def){
        // boss goal เฉพาะ challenge=boss
        if (g.only === 'boss' && gameState.challenge !== 'boss'){
          g.done = true; // ข้าม
        } else {
          recomputeGoal(g, gameState, def);
        }
        if (g.done){
          emit(buildPayload('GOAL CLEAR!'));
          nextGoal();
        }
      }
    }

    // update mini
    if (stateQ.activeMini){
      const m = stateQ.activeMini;
      const def = miniDefs.find(d=>d.id===m.id);
      if (def){
        recomputeMini(m, gameState, def);
        if (m.done){
          emit(buildPayload('MINI CLEAR!'));
          nextMini(gameState);
          return;
        }
      }
    }

    // hint for miss_limit
    let hint = '';
    const gNow = stateQ.activeGoal;
    if (gNow && gNow.id === 'miss_limit'){
      const ok = (gameState.miss|0) <= (gNow.limit|0);
      hint = ok ? 'กำลังรักษาเงื่อนไขอยู่ ✅ (ต้องคงไว้จนจบเกม)'
                : 'พลาดเกินกำหนดแล้ว 😵 (พยายามอย่าพลาดเพิ่ม)';
    }

    emit(buildPayload(hint));
  }

  function finalize(gameState){
    // finalize hold-goal เช่น miss_limit
    for (const g of stateQ.goalsAll){
      if (g.hold && g.id === 'miss_limit'){
        g.done = ((gameState.miss|0) <= (g.limit|0));
        g.prog = g.done ? 1 : 0;
        g.target = 1;
      }
      if (g.id === 'boss_clear'){
        g.done = !!gameState.bossCleared;
        g.prog = g.done ? 1 : 0;
        g.target = 1;
      }
    }
    const goalsCleared = stateQ.goalsAll.filter(x=>x.done).length;
    const goalsTotal   = stateQ.goalsAll.length;

    // minis: นับ done ที่เกิดขึ้นจริง (ตัวที่ยังไม่ done = ไม่ผ่าน)
    const miniCleared = stateQ.minisAll.filter(x=>x.done).length;
    const miniTotal   = stateQ.minisAll.length;

    return { goalsCleared, goalsTotal, miniCleared, miniTotal };
  }

  return { start, update, finalize };
}
