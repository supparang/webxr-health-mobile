// === /vr-goodjunk/quest-director-goodjunk.js ===
'use strict';

const clamp01 = x => Math.max(0, Math.min(1, x||0));
const emit = (n,d)=>window.dispatchEvent(new CustomEvent(n,{detail:d}));

function targetOf(def,diff){
  const t=def.targetByDiff||{};
  return t[diff]??t.normal??0;
}

export function makeGoodJunkQuestDirector(opts){
  const diff = opts.diff||'normal';
  const goals = opts.goals||[];
  const minis = opts.minis||[];

  const S={
    goalIndex:0,
    activeGoal:null,
    activeMini:null,
    minisCleared:0,
    miniCount:0
  };

  function startGoal(s){
    S.activeGoal = goals[S.goalIndex]||null;
  }

  function startMini(){
    S.activeMini = minis[S.miniCount % minis.length]||null;
    S.miniCount++;
    emit('quest:miniStart',{id:S.activeMini?.id});
  }

  function update(s){
    const g=S.activeGoal,m=S.activeMini;

    const goalOut=g?(()=>{
      const t=targetOf(g,diff),v=g.eval(s);
      return{title:g.label,cur:v,max:t,pct:clamp01(v/t)};
    })():null;

    const miniOut=m?(()=>{
      const t=targetOf(m,diff),v=m.eval(s);
      return{title:m.label,cur:v,max:t,pct:clamp01(v/t)};
    })():null;

    emit('quest:update',{
      goal:goalOut,
      mini:miniOut,
      meta:{
        minisCleared:S.minisCleared,
        miniCount:S.miniCount
      }
    });
  }

  function tick(s){
    if(S.activeGoal){
      const t=targetOf(S.activeGoal,diff);
      if(S.activeGoal.pass(S.activeGoal.eval(s),t,s)){
        emit('quest:goalClear',{title:S.activeGoal.label});
        S.goalIndex++;
        startGoal(s);
      }
    }

    if(S.activeMini){
      const t=targetOf(S.activeMini,diff);
      if(S.activeMini.pass(S.activeMini.eval(s),t,s)){
        S.minisCleared++;
        emit('quest:miniClear',{title:S.activeMini.label});
        startMini();
      }
    }

    update(s);
  }

  function start(s){
    startGoal(s);
    startMini();
    update(s);
  }

  return{start,tick};
}