// === /herohealth/vr-groups/groups-quests.js ===
// Food Groups — Quest System (Goals + Minis) + Group label + Quest%
// Classic script (no import/export) for groups-vr.html
// ✅ emits: quest:update (questOk true), hha:rank (questsPct)
// ✅ supports runMode: play/research, diff: easy/normal/hard, seed fix in research

(function (root) {
  'use strict';

  const W = root;
  W.GroupsVR = W.GroupsVR || {};

  // ------------------ helpers ------------------
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }

  // small deterministic RNG (mulberry32-ish)
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

  function emit(name, detail){
    try{ W.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(_){}
  }

  // ------------------ quest defs ------------------
  // NOTE: เกม Groups = "ยิงถูกหมู่ปัจจุบัน" + "เลี่ยง junk/ผิดหมู่" ให้มีเอกลักษณ์ ไม่ซ้ำ GoodJunk/Plate

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

  // mini = ภารกิจสั้น ๆ เร้าใจ
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
    const seed = String(opts.seed || '');

    // ✅ seed policy:
    // - research: fix seed เสมอ (ถ้าไม่ส่ง seed มา ให้ใช้ default)
    // - play: ถ้าไม่ส่ง seed มา ให้สุ่มเวลา
    const finalSeed = (runMode === 'research')
      ? (seed || 'HHA-GROUPS-RESEARCH-SEED')
      : (seed || ('PLAY-' + Math.floor(Date.now()/1000)));

    const rng = makeRng(finalSeed);

    const state = {
      diff, runMode, seed: finalSeed,

      // main stats from engine
      groupLabel: 'หมู่ ?',
      correctHits: 0,
      wrongHits: 0,
      junkHits: 0,
      totalShots: 0,
      combo: 0,
      comboMax: 0,
      accuracy: 0,

      // current goal / mini
      goalIndex: 0,
      activeGoal: null,

      miniIndex: 0,
      activeMini: null,
      miniStartAt: 0,
      miniTLeft: null,

      questOk: false,
      questsPassed: 0,
      questsTotal: GOAL_DEFS.length + MINI_DEFS.length
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

    function makeGoal(idx){
      const def = GOAL_DEFS[idx] || GOAL_DEFS[0];
      return {
        id:def.id, label:def.label,
        target: goalTarget(def),
        prog: 0,
        pass:false
      };
    }

    function pickMini(){
      // research: mini order fixed
      // play: deterministic by seed
      let idx;
      if (runMode === 'research'){
        idx = state.miniIndex % MINI_DEFS.length;
      } else {
        idx = Math.floor(rng() * MINI_DEFS.length) % MINI_DEFS.length;
      }
      const def = MINI_DEFS[idx];
      return {
        id:def.id, label:def.label,
        kind:def.kind,
        target: miniTarget(def),
        prog: 0,
        tLimit: miniTime(def),
        tLeft: miniTime(def),
        fail:false,
        pass:false
      };
    }

    function computeAccuracy(){
      const shots = Math.max(1, state.totalShots|0);
      const good = state.correctHits|0;
      state.accuracy = Math.round((good / shots) * 100);
    }

    function updateGoalProgress(){
      const def = GOAL_DEFS[state.goalIndex] || GOAL_DEFS[0];
      const t = goalTarget(def);
      const v = def.eval(state)|0;
      state.activeGoal.prog = v;
      state.activeGoal.target = t;
      state.activeGoal.pass = !!def.pass(v, t);
    }

    function updateMiniProgress(dtSec){
      const m = state.activeMini;
      if (!m) return;

      // tick time
      if (m.tLimit != null){
        m.tLeft = Math.max(0, (m.tLeft||0) - (dtSec||0));
        state.miniTLeft = Math.ceil(m.tLeft);
        if (m.tLeft <= 0 && !m.pass){
          m.fail = true;
        }
      }

      // pass check
      if (!m.fail && (m.prog|0) >= (m.target|0)){
        m.pass = true;
      }
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

    function start(){
      state.questOk = true;
      state.goalIndex = 0;
      state.activeGoal = makeGoal(state.goalIndex);

      state.miniIndex = 0;
      state.activeMini = pickMini();
      state.activeMini.tLeft = state.activeMini.tLimit;
      state.miniStartAt = now();

      emitQuestUpdate();
      emitQuestPct();
    }

    function nextGoalIfPassed(){
      if (!state.activeGoal) return;
      if (!state.activeGoal.pass) return;

      state.questsPassed++;
      emit('hha:celebrate', { kind:'goal', text:'GOAL CLEAR!' });
      emitQuestPct();

      state.goalIndex++;
      if (state.goalIndex >= GOAL_DEFS.length){
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
      state.activeMini.tLeft = state.activeMini.tLimit;
      state.miniStartAt = now();
      emitQuestUpdate();
    }

    function failMini(){
      emit('hha:judge', { text:'MINI FAIL', kind:'warn' });
      state.activeMini = pickMini();
      state.activeMini.tLeft = state.activeMini.tLimit;
      state.miniStartAt = now();
      emitQuestUpdate();
    }

    // ------------------ engine hooks ------------------
    function onGroupChange(label){
      state.groupLabel = label || 'หมู่ ?';
      emitQuestUpdate();
    }

    function onShot(result){
      state.totalShots++;

      if (result && result.correct){
        state.correctHits++;
        state.combo++;
        if (state.combo > state.comboMax) state.comboMax = state.combo;

        if (state.activeMini){
          if (state.activeMini.kind === 'streak_correct') state.activeMini.prog++;
          if (state.activeMini.kind === 'avoid_wrong')    state.activeMini.prog++;
          if (state.activeMini.kind === 'avoid_junk')     state.activeMini.prog++;
        }
      } else {
        state.combo = 0;

        if (result && result.wrong) state.wrongHits++;
        if (result && result.junk)  state.junkHits++;

        if (state.activeMini){
          if (state.activeMini.kind === 'avoid_wrong' && result.wrong) state.activeMini.fail = true;
          if (state.activeMini.kind === 'avoid_junk'  && result.junk)  state.activeMini.fail = true;
          if (state.activeMini.kind === 'streak_correct'){
            state.activeMini.prog = 0; // reset streak only
          }
        }
      }

      computeAccuracy();
      updateGoalProgress();
      emitQuestUpdate();
      nextGoalIfPassed();
    }

    function tick(dtSec){
      if (!state.questOk) return;

      updateMiniProgress(dtSec);

      if (state.activeMini){
        if (state.activeMini.fail){
          failMini();
        } else if (state.activeMini.pass){
          nextMini();
        } else {
          emitQuestUpdate();
        }
      }
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

  // expose
  W.GroupsVR.createGroupsQuest = createGroupsQuest;

})(window);