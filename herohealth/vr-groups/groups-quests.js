// === /herohealth/vr-groups/groups-quests.js ===
// Food Groups — Quest System (Goals + Minis) + Panic timer events
// Classic script (no import/export) for groups-vr.html
// ✅ emits: quest:update (questOk true), hha:rank (questsPct), groups:panic (on/off, left)
// ✅ seed policy: research fixed / play pseudo-random deterministic by seed
// ✅ mini: cooldown after fail to avoid instant fail loops
// ✅ mini panic: last 3s emits groups:panic {on:true,left}

(function (root) {
  'use strict';

  const W = root;
  W.GroupsVR = W.GroupsVR || {};

  // ------------------ helpers ------------------
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }
  function emit(name, detail){
    try{ W.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(_){}
  }

  // deterministic RNG (mulberry-ish)
  function makeRng(seedStr){
    let s = 0x9e3779b9;
    const str = String(seedStr || '');
    for (let i=0;i<str.length;i++){
      s ^= (str.charCodeAt(i) + (s<<6) + (s>>2)) >>> 0;
    }
    return function(){
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ------------------ quest defs ------------------
  // เอกลักษณ์ Groups: "ยิงถูกหมู่ปัจจุบัน" + "สลับหมู่ด้วยพลัง" + "อย่าโดน junk/ผิดหมู่"
  const GOAL_DEFS = [
    {
      id:'g1',
      label:'ยิงถูก “หมู่ปัจจุบัน” ให้ได้ 🎯',
      targetByDiff:{ easy:18, normal:24, hard:30 },
      eval:(S)=>S.correctHits|0,
      pass:(v,t)=>v>=t
    },
    {
      id:'g2',
      label:'คอมโบสูงสุด 🔥',
      targetByDiff:{ easy:6, normal:9, hard:12 },
      eval:(S)=>S.comboMax|0,
      pass:(v,t)=>v>=t
    },
    {
      id:'g3',
      label:'ความแม่น ≥ 70% ✅',
      targetByDiff:{ easy:70, normal:75, hard:80 },
      eval:(S)=>S.accuracy|0,
      pass:(v,t)=>v>=t
    }
  ];

  const MINI_DEFS = [
    {
      id:'m1',
      label:'Clean Streak ⚡ (ถูกหมู่ติดกัน)',
      targetByDiff:{ easy:5, normal:7, hard:9 },
      timeByDiff:{ easy:12, normal:11, hard:10 },
      kind:'streak_correct'
    },
    {
      id:'m2',
      label:'No Wrong ❌ (ห้ามยิงผิดหมู่)',
      targetByDiff:{ easy:10, normal:12, hard:14 },
      timeByDiff:{ easy:14, normal:13, hard:12 },
      kind:'avoid_wrong'
    },
    {
      id:'m3',
      label:'Anti-Junk 🚫 (ห้ามโดน junk)',
      targetByDiff:{ easy:10, normal:12, hard:14 },
      timeByDiff:{ easy:14, normal:13, hard:12 },
      kind:'avoid_junk'
    }
  ];

  // ------------------ factory ------------------
  function createGroupsQuest(opts){
    opts = opts || {};
    const diff = String(opts.diff || 'normal').toLowerCase();
    const runMode = String(opts.runMode || 'play').toLowerCase();
    const seedIn = String(opts.seed || '');

    const finalSeed = (runMode === 'research')
      ? (seedIn || 'HHA-GROUPS-RESEARCH-SEED')
      : (seedIn || ('PLAY-' + Math.floor(Date.now()/1000)));

    const rng = makeRng(finalSeed);

    const state = {
      diff, runMode, seed: finalSeed,

      // engine-fed stats
      groupLabel: 'หมู่ ?',
      correctHits: 0,
      wrongHits: 0,
      junkHits: 0,
      totalShots: 0,
      combo: 0,
      comboMax: 0,
      accuracy: 0,

      // goal & mini
      goalIndex: 0,
      activeGoal: null,

      miniIndex: 0,
      activeMini: null,
      miniTLeft: null,

      // mini anti-loop
      miniCooldown: 0,      // seconds
      miniFailLock: false,  // avoid multiple fail triggers

      questOk: false,
      questsPassed: 0,
      questsTotal: GOAL_DEFS.length + MINI_DEFS.length,

      // panic signal for fx (last 3s)
      panicOn: false,
      lastPanicLeft: 999
    };

    function goalTarget(def){
      const m = def.targetByDiff || {};
      return (diff in m) ? (m[diff]|0) : (m.normal|0);
    }
    function miniTarget(def){
      const m = def.targetByDiff || {};
      return (diff in m) ? (m[diff]|0) : (m.normal|0);
    }
    function miniTime(def){
      const m = def.timeByDiff || {};
      return (diff in m) ? (m[diff]|0) : (m.normal|0);
    }

    function computeAccuracy(){
      const shots = Math.max(1, state.totalShots|0);
      const good  = state.correctHits|0;
      state.accuracy = Math.round((good / shots) * 100);
    }

    function makeGoal(idx){
      const def = GOAL_DEFS[idx] || GOAL_DEFS[0];
      return {
        id: def.id,
        label: def.label,
        target: goalTarget(def),
        prog: 0,
        pass: false
      };
    }

    function pickMini(){
      let idx;
      if (runMode === 'research'){
        idx = state.miniIndex % MINI_DEFS.length;
      } else {
        idx = Math.floor(rng() * MINI_DEFS.length) % MINI_DEFS.length;
      }
      const def = MINI_DEFS[idx];
      return {
        id: def.id,
        label: def.label,
        kind: def.kind,
        target: miniTarget(def),
        prog: 0,
        tLimit: miniTime(def),
        tLeft: miniTime(def),
        fail: false,
        pass: false
      };
    }

    function updateGoalProgress(){
      const def = GOAL_DEFS[state.goalIndex] || GOAL_DEFS[0];
      const t = goalTarget(def);
      const v = (def.eval(state)|0);
      state.activeGoal.prog = v;
      state.activeGoal.target = t;
      state.activeGoal.pass = !!def.pass(v, t);
    }

    function emitQuestUpdate(){
      const goal = state.activeGoal;
      const mini = state.activeMini;

      emit('quest:update', {
        questOk: state.questOk,
        groupLabel: state.groupLabel,

        goal: goal ? {
          id: goal.id, label: goal.label,
          prog: goal.prog|0, target: goal.target|0,
          pass: !!goal.pass
        } : null,

        mini: mini ? {
          id: mini.id, label: mini.label,
          prog: mini.prog|0, target: mini.target|0,
          tLeft: (mini.tLeft != null) ? Math.ceil(mini.tLeft) : null,
          windowSec: (mini.tLimit != null) ? (mini.tLimit|0) : null,
          pass: !!mini.pass,
          fail: !!mini.fail
        } : null
      });
    }

    function emitQuestPct(){
      const passed = state.questsPassed|0;
      const total  = Math.max(1, state.questsTotal|0);
      const pct = Math.round((passed / total) * 100);
      emit('hha:rank', { questsPct: pct });
    }

    function setPanic(on, left){
      const l = (left==null) ? 999 : (left|0);
      if (!!on === state.panicOn && l === state.lastPanicLeft) return;
      state.panicOn = !!on;
      state.lastPanicLeft = l;
      emit('groups:panic', { on: state.panicOn, left: state.lastPanicLeft });
    }

    function start(){
      state.questOk = true;

      state.goalIndex = 0;
      state.activeGoal = makeGoal(state.goalIndex);

      state.miniIndex = 0;
      state.activeMini = pickMini();
      state.miniFailLock = false;
      state.miniCooldown = 0;

      setPanic(false, 999);
      emitQuestUpdate();
      emitQuestPct();
    }

    function nextGoalIfPassed(){
      if (!state.activeGoal || !state.activeGoal.pass) return;

      state.questsPassed++;
      emit('hha:celebrate', { kind:'goal', text:'GOAL CLEAR!' });
      emitQuestPct();

      state.goalIndex++;
      if (state.goalIndex >= GOAL_DEFS.length){
        // goals all done: keep last as passed (display), no next
        emitQuestUpdate();
        return;
      }
      state.activeGoal = makeGoal(state.goalIndex);
      emitQuestUpdate();
    }

    function nextMini(){
      state.questsPassed++;
      emit('hha:celebrate', { kind:'mini', text:'MINI CLEAR!' });
      emitQuestPct();

      state.miniIndex++;
      state.activeMini = pickMini();
      state.miniFailLock = false;
      state.miniCooldown = 0;

      setPanic(false, 999);
      emitQuestUpdate();
    }

    function failMini(){
      // mini fail -> cooldown then new mini (กันวน fail ติด)
      if (state.miniFailLock) return;
      state.miniFailLock = true;

      emit('hha:judge', { text:'MINI FAIL', kind:'warn' });
      setPanic(false, 999);

      // cooldown short (diff-based)
      const cd = (diff === 'hard') ? 1.2 : (diff === 'easy' ? 0.8 : 1.0);
      state.miniCooldown = cd;

      emitQuestUpdate();
    }

    // ------------------ hooks ------------------
    function onGroupChange(label){
      state.groupLabel = label || 'หมู่ ?';
      emitQuestUpdate();
    }

    function onShot(result){
      // result: { correct:boolean, wrong:boolean, junk:boolean }
      state.totalShots++;

      const correct = !!(result && result.correct);
      const wrong   = !!(result && result.wrong);
      const junk    = !!(result && result.junk);

      if (correct){
        state.correctHits++;
        state.combo++;
        if (state.combo > state.comboMax) state.comboMax = state.combo;

        // mini progress
        if (state.activeMini && !state.activeMini.fail){
          const k = state.activeMini.kind;
          if (k === 'streak_correct') state.activeMini.prog++;
          if (k === 'avoid_wrong')    state.activeMini.prog++;
          if (k === 'avoid_junk')     state.activeMini.prog++;
        }

      } else {
        // break combo
        state.combo = 0;

        if (wrong) state.wrongHits++;
        if (junk)  state.junkHits++;

        if (state.activeMini){
          const k = state.activeMini.kind;

          if (k === 'avoid_wrong' && wrong) state.activeMini.fail = true;
          if (k === 'avoid_junk'  && junk)  state.activeMini.fail = true;

          if (k === 'streak_correct'){
            // streak reset (not instant fail)
            state.activeMini.prog = 0;
          }
        }
      }

      computeAccuracy();
      if (state.activeGoal) updateGoalProgress();

      emitQuestUpdate();
      nextGoalIfPassed();
      // mini pass/fail is handled in tick (time-aware)
    }

    function tick(dtSec){
      if (!state.questOk) return;
      const dt = Number(dtSec) || 0;

      // cooldown after fail
      if (state.miniCooldown > 0){
        state.miniCooldown = Math.max(0, state.miniCooldown - dt);
        if (state.miniCooldown <= 0){
          // new mini after cooldown
          state.activeMini = pickMini();
          state.miniFailLock = false;
          setPanic(false, 999);
          emitQuestUpdate();
        }
        return;
      }

      const m = state.activeMini;
      if (!m) return;

      // tick time
      if (m.tLimit != null){
        m.tLeft = Math.max(0, (m.tLeft||0) - dt);
        state.miniTLeft = Math.ceil(m.tLeft);

        // panic: last 3 seconds
        const left = Math.ceil(m.tLeft);
        if (left <= 3 && left >= 1 && !m.pass && !m.fail){
          setPanic(true, left);
        } else {
          setPanic(false, left);
        }

        // time out
        if (m.tLeft <= 0 && !m.pass){
          m.fail = true;
        }
      }

      // pass check
      if (!m.fail && (m.prog|0) >= (m.target|0)){
        m.pass = true;
      }

      if (m.fail){
        failMini();
        return;
      }
      if (m.pass){
        nextMini();
        return;
      }

      emitQuestUpdate();
    }

    function snapshot(){
      return JSON.parse(JSON.stringify(state));
    }

    return {
      start,
      tick,
      onShot,
      onGroupChange,
      snapshot,
      get seed(){ return state.seed; },
      get runMode(){ return state.runMode; }
    };
  }

  W.GroupsVR.createGroupsQuest = createGroupsQuest;

})(window);