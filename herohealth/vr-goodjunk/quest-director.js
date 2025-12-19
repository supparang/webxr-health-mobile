// === /herohealth/vr-goodjunk/quest-director.js ===
// Quest Director (Goals sequential + Minis chain) for GoodJunk
// ✅ PATCH: รองรับ schema แบบใหม่ (eval/pass/targetByDiff/onlyChallenge/notChallenge)
// ✅ ยังรองรับ schema เดิม (calc/makeTarget) ได้เหมือนเดิม

'use strict';

export function makeQuestDirector(opts = {}) {
  const diff = String(opts.diff || 'normal').toLowerCase();
  const goalDefs = Array.isArray(opts.goalDefs) ? opts.goalDefs : [];
  const miniDefs = Array.isArray(opts.miniDefs) ? opts.miniDefs : [];
  const maxGoals = Math.max(1, opts.maxGoals || 2);   // จำนวน goal “ทั้งหมดในเกม”
  const maxMini  = Math.max(1, opts.maxMini  || 999); // mini ต่อเนื่อง

  const stateQ = {
    goalsAll: [],
    minisAll: [],
    goalIndex: 0,
    miniCount: 0,
    activeMini: null,
    activeGoal: null,
    started: false
  };

  // ---------- helpers ----------
  function clampInt(v, fallback = 0){
    v = Number(v);
    return Number.isFinite(v) ? (v|0) : (fallback|0);
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

  function allowedByChallenge(def, gameState){
    const ch = String(gameState?.challenge || '').toLowerCase();
    if (Array.isArray(def.onlyChallenge) && def.onlyChallenge.length){
      return def.onlyChallenge.map(x=>String(x).toLowerCase()).includes(ch);
    }
    if (Array.isArray(def.notChallenge) && def.notChallenge.length){
      return !def.notChallenge.map(x=>String(x).toLowerCase()).includes(ch);
    }
    return true;
  }

  function targetFromDef(def){
    // 1) makeTarget(diff) style
    if (typeof def.makeTarget === 'function'){
      return clampInt(def.makeTarget(diff), 1) || 1;
    }
    // 2) targetByDiff map
    if (def.targetByDiff && typeof def.targetByDiff === 'object'){
      const t = def.targetByDiff[diff] ?? def.targetByDiff.normal ?? def.targetByDiff.easy ?? def.targetByDiff.hard;
      return clampInt(t, 1) || 1;
    }
    // 3) fixed target
    if (def.target != null) return clampInt(def.target, 1) || 1;
    return 1;
  }

  function newGoal(def){
    const target = targetFromDef(def);
    return { id:def.id, label:def.label, target, prog:0, done:false, hold:false, only:null, limit:null };
  }

  function newMini(def){
    const target = targetFromDef(def);
    return { id:def.id, label:def.label, target, prog:0, done:false, timer:false, startedAt:Date.now() };
  }

  function emit(detail){
    window.dispatchEvent(new CustomEvent('quest:update',{ detail }));
  }

  function recomputeBySchema(item, gameState, def){
    // --- schema A: calc(gameState,target)-> {prog,target,hold,only,limit} ---
    if (typeof def.calc === 'function'){
      const r = def.calc(gameState, item.target) || {};
      item.prog   = clampInt(r.prog, 0);
      item.target = clampInt(r.target, item.target) || item.target;
      item.hold   = !!r.hold;
      item.only   = r.only || null;
      item.limit  = (r.limit!=null) ? clampInt(r.limit, null) : null;

      if (!item.hold){
        item.done = (item.target>0) ? (item.prog >= item.target) : false;
      }
      return;
    }

    // --- schema B: eval/pass + targetByDiff ---
    // eval: (s)=> number , pass: (v,tgt)=> boolean
    const v = (typeof def.eval === 'function') ? def.eval(gameState, item.target) : 0;
    item.prog = clampInt(v, 0);

    // สำหรับเงื่อนไขแบบ "พลาดไม่เกิน X" ให้โชว์ prog = miss, target = X ได้เลย
    // (def.pass ตัดสินเอง)
    item.target = clampInt(item.target, 1) || 1;

    // hold goal (ถ้าต้องการ) – คุณยังไม่ได้ใช้ใน defs ชุดนี้
    item.hold = !!def.hold;

    if (!item.hold){
      if (typeof def.pass === 'function'){
        item.done = !!def.pass(item.prog, item.target, gameState);
      }else{
        item.done = (item.target>0) ? (item.prog >= item.target) : false;
      }
    }
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

    // mini ตัวแรก
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

    // เลือก mini ที่ allowed ตาม challenge (กันสุ่มไปชน mini ที่ใช้ไม่ได้)
    let def = null;
    for (let tries=0; tries<25; tries++){
      const cand = miniDefs[(Math.random()*miniDefs.length)|0];
      if (!cand) continue;
      if (allowedByChallenge(cand, gameState)){
        def = cand; break;
      }
    }
    def = def || miniDefs[(Math.random()*miniDefs.length)|0];
    if (!def){ stateQ.activeMini = null; return; }

    const m = newMini(def);
    stateQ.activeMini = m;
    stateQ.minisAll.push(m);
    stateQ.miniCount++;

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
        // ถ้า goal นี้ใช้ได้เฉพาะบาง challenge → ข้าม
        if (!allowedByChallenge(def, gameState)){
          g.done = true;
          emit(buildPayload('GOAL SKIP'));
          nextGoal();
        } else {
          // recompute
          recomputeBySchema(g, gameState, def);

          if (g.done){
            emit(buildPayload('GOAL CLEAR!'));
            nextGoal();
          }
        }
      }
    }

    // update mini
    if (stateQ.activeMini){
      const m = stateQ.activeMini;
      const def = miniDefs.find(d=>d.id===m.id);
      if (def){
        // ถ้า mini นี้ไม่ตรง challenge → เปลี่ยนตัวใหม่เลย
        if (!allowedByChallenge(def, gameState)){
          m.done = true;
          emit(buildPayload('MINI SKIP'));
          nextMini(gameState);
          return;
        }

        recomputeBySchema(m, gameState, def);

        if (m.done){
          emit(buildPayload('MINI CLEAR!'));
          nextMini(gameState);
          return;
        }
      }
    }

    // hint ตัวอย่าง: goal พลาดไม่เกิน X
    let hint = '';
    const gNow = stateQ.activeGoal;
    if (gNow && (gNow.id === 'g3' || gNow.id === 'miss_limit')){
      const miss = (gameState.miss|0);
      const lim  = (gNow.target|0);
      hint = (miss <= lim)
        ? `กำลังรักษาเงื่อนไขอยู่ ✅ (พลาด ${miss}/${lim})`
        : `พลาดเกินกำหนดแล้ว 😵 (พลาด ${miss}/${lim})`;
    }

    emit(buildPayload(hint));
  }

  function finalize(gameState){
    // สำหรับ schema B แบบคุณ: g4/m7 ใช้ bossCleared อยู่แล้ว (eval/pass)
    // แต่เผื่อ schema A เดิม ก็ยัง finalize ได้

    // finalize hold-goal (ถ้ามี)
    for (const g of stateQ.goalsAll){
      if (g.hold){
        // ถ้า def มี pass ก็ใช้ pass ตัดสิน
        const def = goalDefs.find(d=>d.id===g.id);
        if (def && typeof def.pass === 'function'){
          g.done = !!def.pass(g.prog|0, g.target|0, gameState);
        }else{
          g.done = (g.target>0) ? (g.prog >= g.target) : false;
        }
      }
    }

    const goalsCleared = stateQ.goalsAll.filter(x=>x.done).length;
    const goalsTotal   = stateQ.goalsAll.length;

    const miniCleared  = stateQ.minisAll.filter(x=>x.done).length;
    const miniTotal    = stateQ.minisAll.length;

    return { goalsCleared, goalsTotal, miniCleared, miniTotal };
  }

  return { start, update, finalize };
}
