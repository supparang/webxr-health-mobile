// === /herohealth/plate/plate.goals.js ===
// Goals defs + sequential evaluator (global)
// Provides window.GAME_MODULES.PlateGoals

(function (root) {
  'use strict';
  const W = root;

  function clone(o){ return JSON.parse(JSON.stringify(o)); }

  const GOAL_DEFS = [
    { key:'fill-plate', title:'เติมจานให้ครบ 5 หมู่', target:5 },
    { key:'accuracy',   title:'จบเกมด้วยความแม่นยำ ≥ 80%', target:80 }
  ];

  function startGoals(){
    return {
      goals: GOAL_DEFS.map(d => ({ ...clone(d), cur:0, done:false })),
      index: 0,
      active: null,
      allDone: false
    };
  }

  function getActive(G){
    if(!G) return null;
    if(G.allDone) return null;
    if(!G.active) G.active = G.goals[G.index] || null;
    return G.active;
  }

  // update based on state snapshot
  function updateGoals(G, state, helpers){
    helpers = helpers || {};
    const PlateState = (W.GAME_MODULES && W.GAME_MODULES.PlateState) ? W.GAME_MODULES.PlateState : null;
    if(!G || !state || !PlateState) return;

    const active = getActive(G);
    if(!active) return;

    if(active.key === 'fill-plate'){
      active.cur = PlateState.plateHaveCount(state);
      if(active.cur >= active.target && !active.done){
        active.done = true;
        state.goalsCleared = (state.goalsCleared||0) + 1;
        if(typeof helpers.onGoalComplete === 'function') helpers.onGoalComplete(active);
        G.index++;
        G.active = G.goals[G.index] || null;
        if(!G.active) G.allDone = true;
      }
    } else if(active.key === 'accuracy'){
      active.cur = Math.round(PlateState.accuracyPct(state));
      // goal pass ตัดสินตอนจบเกมจริง ๆ (แต่แสดงความคืบหน้าได้)
    }
  }

  W.GAME_MODULES = W.GAME_MODULES || {};
  W.GAME_MODULES.PlateGoals = { GOAL_DEFS, startGoals, getActive, updateGoals };

})(window);