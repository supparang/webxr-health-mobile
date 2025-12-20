// === /herohealth/vr-goodjunk/quest-director.js ===
// Quest Director (Goals sequential + Minis chain) — ES Module
// Emits:
// - quest:update  detail: { goal, mini, meta }
// - quest:cleared detail: { kind:'goal'|'mini', id, title }
// - quest:miniStart detail: { id, title }
// - quest:goalStart detail: { id, title }

'use strict';

function clamp01(x){ x = Number(x) || 0; return x < 0 ? 0 : (x > 1 ? 1 : x); }
function pickTarget(def, diff){
  const d = String(diff || 'normal').toLowerCase();
  const tb = def && def.targetByDiff;
  if (tb && typeof tb === 'object'){
    const v = tb[d];
    if (Number.isFinite(v)) return v;
    if (Number.isFinite(tb.normal)) return tb.normal;
    const any = Object.values(tb).find(n => Number.isFinite(n));
    if (Number.isFinite(any)) return any;
  }
  return Number.isFinite(def.max) ? def.max : 1;
}
function allowedByChallenge(def, challenge){
  const ch = String(challenge || '').toLowerCase();
  if (Array.isArray(def.onlyChallenge) && def.onlyChallenge.length){
    return def.onlyChallenge.map(s=>String(s).toLowerCase()).includes(ch);
  }
  if (Array.isArray(def.notChallenge) && def.notChallenge.length){
    return !def.notChallenge.map(s=>String(s).toLowerCase()).includes(ch);
  }
  // legacy tags (ถ้ามี)
  if (Array.isArray(def.tags) && def.tags.length){
    return def.tags.map(s=>String(s).toLowerCase()).includes(ch);
  }
  return true;
}
function safeDispatch(name, detail){
  try{
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }catch(_){}
}

export function makeQuestDirector(opts = {}) {
  const diff = String(opts.diff || 'normal').toLowerCase();
  const challenge = String(opts.challenge || 'rush').toLowerCase();

  const goalDefs = Array.isArray(opts.goalDefs) ? opts.goalDefs : [];
  const miniDefs = Array.isArray(opts.miniDefs) ? opts.miniDefs : [];

  const maxGoals = Math.max(1, Number(opts.maxGoals || 2));
  const maxMini  = Math.max(1, Number(opts.maxMini  || 999));

  const S = {
    started:false,

    diff,
    challenge,

    // runtime pool (filtered)
    goalsPool: [],
    minisPool: [],

    // progression
    goalIndex: 0,
    miniCount: 0,        // attempted minis count
    goalsCleared: 0,
    minisCleared: 0,

    activeGoal: null,
    activeMini: null,

    // anti-spam
    lastEmitAt: 0,
    emitThrottleMs: 120
  };

  function buildPools(){
    S.goalsPool = goalDefs.filter(g => allowedByChallenge(g, S.challenge)).slice();
    S.minisPool = miniDefs.filter(m => allowedByChallenge(m, S.challenge)).slice();
    if (!S.goalsPool.length) S.goalsPool = goalDefs.slice();
    if (!S.minisPool.length) S.minisPool = miniDefs.slice();
  }

  function pickGoalByIndex(idx){
    // เลือก goal แบบวนจาก pool
    const pool = S.goalsPool;
    if (!pool.length) return null;
    return pool[idx % pool.length];
  }

  function pickNextMini(){
    const pool = S.minisPool;
    if (!pool.length) return null;

    // โซ่ mini แบบวนตามลำดับให้ predictable (เล่นแล้วรู้สึก “เป็นระบบ”)
    const idx = S.miniCount % pool.length;
    return pool[idx];
  }

  function goalSnapshot(gs){
    if (!S.activeGoal) return null;
    const def = S.activeGoal;
    const tgt = pickTarget(def, S.diff);
    const cur = Number(def.eval ? def.eval(gs) : (gs && gs.score)) || 0;
    const pass = !!(def.pass ? def.pass(cur, tgt, gs) : (cur >= tgt));
    const pct = (def.pass && def.id === 'g3')
      ? clamp01((tgt - cur) / Math.max(1, tgt)) // เป้าประเภท “น้อยกว่าเท่ากับ” ให้หลอดเพิ่มเมื่อ “ดีขึ้น”
      : clamp01(cur / Math.max(1, tgt));

    return {
      id: def.id || '',
      title: def.label || def.title || 'Goal',
      hint: def.hint || '',
      cur,
      max: tgt,
      pct,
      state: pass ? 'clear' : 'progress'
    };
  }

  function miniSnapshot(gs){
    if (!S.activeMini) return null;
    const def = S.activeMini;
    const tgt = pickTarget(def, S.diff);

    // รองรับ mini แบบ timeTotal (legacy) ถ้ามี
    const timeTotal = Number(def.timeTotal || 0);
    const timeLeftMs = (typeof def.timeLeftMs === 'function') ? def.timeLeftMs(gs) : null;

    const cur = Number(def.eval ? def.eval(gs) : 0) || 0;
    const pass = !!(def.pass ? def.pass(cur, tgt, gs) : (cur >= tgt));
    const pct = clamp01(cur / Math.max(1, tgt));

    return {
      id: def.id || '',
      title: def.label || def.title || 'Mini',
      hint: def.hint || '',
      cur,
      max: tgt,
      pct,
      timeTotal: timeTotal || undefined,
      timeLeft: (typeof timeLeftMs === 'number') ? timeLeftMs : undefined,
      state: pass ? 'clear' : 'progress'
    };
  }

  function emitUpdate(gs, force=false){
    const now = Date.now();
    if (!force && (now - S.lastEmitAt) < S.emitThrottleMs) return;
    S.lastEmitAt = now;

    safeDispatch('quest:update', {
      goal: goalSnapshot(gs),
      mini: miniSnapshot(gs),
      meta: {
        diff: S.diff,
        challenge: S.challenge,
        goalIndex: S.goalIndex,
        miniCount: S.miniCount,
        goalsCleared: S.goalsCleared,
        minisCleared: S.minisCleared
      }
    });
  }

  function startGoal(gs){
    S.activeGoal = pickGoalByIndex(S.goalIndex);
    if (S.activeGoal){
      safeDispatch('quest:goalStart', {
        id: S.activeGoal.id || '',
        title: S.activeGoal.label || S.activeGoal.title || 'Goal'
      });
    }
    emitUpdate(gs, true);
  }

  function startMini(gs){
    S.activeMini = pickNextMini();
    if (S.activeMini){
      safeDispatch('quest:miniStart', {
        id: S.activeMini.id || '',
        title: S.activeMini.label || S.activeMini.title || 'Mini'
      });
    }
    emitUpdate(gs, true);
  }

  function clearMini(gs){
    if (!S.activeMini) return;
    const def = S.activeMini;

    S.minisCleared++;
    safeDispatch('quest:cleared', {
      kind:'mini',
      id: def.id || '',
      title: def.label || def.title || 'Mini'
    });

    // ไป mini ถัดไป (โซ่)
    S.miniCount++;
    S.activeMini = null;
    startMini(gs);
  }

  function clearGoal(gs){
    if (!S.activeGoal) return;
    const def = S.activeGoal;

    S.goalsCleared++;
    safeDispatch('quest:cleared', {
      kind:'goal',
      id: def.id || '',
      title: def.label || def.title || 'Goal'
    });

    S.goalIndex++;
    S.activeGoal = null;

    // goal ถัดไป (ถ้ายังไม่ครบ maxGoals)
    if (S.goalsCleared < maxGoals){
      startGoal(gs);
    } else {
      // goal หมดแล้วก็ยังให้ mini วิ่งต่อได้จนจบเวลา (เกมคุณตั้ง maxMini=999)
      emitUpdate(gs, true);
    }
  }

  const API = {
    start(gs){
      S.started = true;
      buildPools();
      S.goalIndex = 0;
      S.miniCount = 0;
      S.goalsCleared = 0;
      S.minisCleared = 0;

      startGoal(gs);
      startMini(gs);
      return API;
    },

    // tick เรียกได้บ่อย ๆ (เช่นจาก hha:time / hha:score)
    tick(gs){
      if (!S.started) return;
      // check clear states
      const g = goalSnapshot(gs);
      if (g && g.state === 'clear' && S.goalsCleared < maxGoals){
        clearGoal(gs);
        return;
      }

      const m = miniSnapshot(gs);
      if (m && m.state === 'clear' && S.miniCount < maxMini){
        clearMini(gs);
        return;
      }

      emitUpdate(gs, false);
    },

    onEvent(_name, gs){
      // ตอนนี้ใช้ tick เป็นหลัก แต่เปิดไว้ให้อนาคต
      API.tick(gs);
    },

    getState(){
      return {
        started: S.started,
        diff: S.diff,
        challenge: S.challenge,
        goalIndex: S.goalIndex,
        miniCount: S.miniCount,
        goalsCleared: S.goalsCleared,
        minisCleared: S.minisCleared
      };
    }
  };

  return API;
}

// เผื่อ legacy script ที่เรียกจาก window
try{
  window.makeQuestDirector = makeQuestDirector;
}catch(_){}
