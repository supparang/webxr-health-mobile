'use strict';

export function bootMissions(opts){
  opts = opts || {};
  const S = {
    stage: 1,
    warmNeed: opts.warmNeed ?? 4,
    trickNeed: opts.trickNeed ?? 4,
    bossNeed: opts.bossNeed ?? 1,
    warmDone: 0,
    trickDone: 0,
    bossDone: 0,
  };

  function reset(){
    S.stage=1; S.warmDone=0; S.trickDone=0; S.bossDone=0;
  }

  function text(){
    if (S.stage===1) return `Warm ${S.warmDone}/${S.warmNeed}`;
    if (S.stage===2) return `Trick ${S.trickDone}/${S.trickNeed}`;
    return `Boss ${S.bossDone}/${S.bossNeed}`;
  }

  function progress01(){
    const total = S.warmNeed + S.trickNeed + S.bossNeed;
    const done = S.warmDone + S.trickDone + S.bossDone;
    return total ? Math.max(0, Math.min(1, done/total)) : 0;
  }

  function onWarmClear(){
    if (S.stage!==1) return;
    S.warmDone++;
    if (S.warmDone >= S.warmNeed) S.stage = 2;
  }

  function onTrickClear(){
    if (S.stage!==2) return;
    S.trickDone++;
    if (S.trickDone >= S.trickNeed) S.stage = 3;
  }

  function onBossWin(){
    if (S.stage!==3) return;
    S.bossDone = S.bossNeed;
  }

  function done(){
    return (S.stage===3 && S.bossDone>=S.bossNeed);
  }

  return { S, reset, text, progress01, onWarmClear, onTrickClear, onBossWin, done };
}