// === /herohealth/vr-goodjunk/quest-director.js ===
// Quest Director (Goals + Mini Quests) for GoodJunkVR
// Emits: "quest:update" event for HUD
// Fix: ROOT not defined

'use strict';

// ✅ FIX: define ROOT for browser
const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp01(v){
  v = Number(v) || 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function pickUnique(list, n){
  const arr = (list || []).slice();
  // shuffle
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.max(0, n|0));
}

function safeText(s){
  return (s == null) ? '' : String(s);
}

export function makeQuestDirector(opts = {}){
  const diff     = safeText(opts.diff || 'normal').toLowerCase();
  const goalDefs = Array.isArray(opts.goalDefs) ? opts.goalDefs : [];
  const miniDefs = Array.isArray(opts.miniDefs) ? opts.miniDefs : [];

  const maxGoals = Math.max(1, opts.maxGoals|0 || 2);
  const maxMini  = Math.max(1, opts.maxMini|0  || 3);

  // --- active decks ---
  let goalsAll = [];
  let minisAll = [];

  let started = false;

  // --- public snapshots (HUD uses these) ---
  function emitUpdate(extra = {}){
    // goal: current active goal (first not done)
    const goal = goalsAll.find(g => g && !g.done) || null;
    const mini = minisAll.find(m => m && !m.done) || null;

    ROOT.dispatchEvent(new CustomEvent('quest:update', {
      detail: {
        goal,
        mini,
        goalsAll,
        minisAll,
        hint: extra.hint || ''
      }
    }));
  }

  function normalizeDef(def, type){
    // def: { id, label, hint, metric, target, diffTargets? , eval?(state)->prog, doneWhen?(state)->bool }
    const id    = safeText(def && def.id ? def.id : (type + '-' + Math.random().toString(16).slice(2)));
    const label = safeText(def && def.label ? def.label : (type === 'goal' ? 'ภารกิจหลัก' : 'มินิเควส'));
    const hint  = safeText(def && def.hint ? def.hint : '');

    // target: allow per-difficulty
    let target = Number(def && def.target != null ? def.target : 1) || 1;
    if (def && def.diffTargets && typeof def.diffTargets === 'object'){
      const t = def.diffTargets[diff];
      if (t != null && !isNaN(Number(t))) target = Number(t);
    }
    if (target < 1) target = 1;

    const metric = safeText(def && def.metric ? def.metric : '');

    return {
      type,
      id,
      label,
      hint,
      metric,
      target,
      prog: 0,
      done: false,
      _def: def || {}
    };
  }

  function buildDeck(){
    goalsAll = pickUnique(goalDefs, maxGoals).map(d => normalizeDef(d, 'goal'));
    minisAll = pickUnique(miniDefs, maxMini).map(d => normalizeDef(d, 'mini'));
  }

  function getProgFromState(q, state){
    const def = q._def || {};

    // 1) custom eval
    if (typeof def.eval === 'function'){
      try{
        const v = def.eval(state || {});
        return Number(v) || 0;
      }catch(_){ return 0; }
    }

    // 2) metric read
    const m = q.metric;
    if (m && state && typeof state[m] !== 'undefined'){
      return Number(state[m]) || 0;
    }

    // 3) fallback
    return 0;
  }

  function checkDone(q, state){
    const def = q._def || {};

    // custom doneWhen
    if (typeof def.doneWhen === 'function'){
      try{
        return !!def.doneWhen(state || {}, q);
      }catch(_){ return false; }
    }

    // default: prog >= target
    return (q.prog|0) >= (q.target|0);
  }

  function updateOne(q, state){
    if (!q || q.done) return false;

    const v = getProgFromState(q, state);
    q.prog = Math.max(0, v|0);

    if (checkDone(q, state)){
      q.done = true;
      return true;
    }
    return false;
  }

  function start(state = {}){
    started = true;
    buildDeck();

    // initial update
    // (อย่าให้ HUD คิดว่า 0/0 — เราส่งเป้ากับ target ไปเลย)
    update(state);
    emitUpdate({ hint: (goalsAll[0] && goalsAll[0].hint) ? goalsAll[0].hint : '' });
  }

  function update(state = {}){
    if (!started) return;

    let changed = false;

    // update all (เพื่อให้ cleared count ถูกต้อง)
    for (const g of goalsAll){
      changed = updateOne(g, state) || changed;
    }
    for (const m of minisAll){
      changed = updateOne(m, state) || changed;
    }

    // ส่ง hint ของ quest ที่กำลังทำอยู่
    const currentGoal = goalsAll.find(g => g && !g.done) || goalsAll[goalsAll.length - 1] || null;
    const hint = currentGoal ? safeText(currentGoal.hint) : '';

    // ยิง update ทุกครั้ง (HUD ของคุณต้องการ progress real-time)
    emitUpdate({ hint });
    return changed;
  }

  function finalize(state = {}){
    if (!started){
      return { goalsCleared:0, goalsTotal:0, miniCleared:0, miniTotal:0 };
    }
    // update one last time
    update(state);

    const goalsTotal = goalsAll.length;
    const miniTotal  = minisAll.length;

    const goalsCleared = goalsAll.filter(g => g && g.done).length;
    const miniCleared  = minisAll.filter(m => m && m.done).length;

    return { goalsCleared, goalsTotal, miniCleared, miniTotal };
  }

  return {
    start,
    update,
    finalize,
    _debug(){
      return { goalsAll, minisAll, diff };
    }
  };
}
