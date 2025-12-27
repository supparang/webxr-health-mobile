(function(root){
  'use strict';

  const qs = new URLSearchParams((root.location && root.location.search) ? root.location.search : '');
  const RUN = String(qs.get('run') || qs.get('runMode') || 'play').toLowerCase();
  const DIFF = String(qs.get('diff') || 'normal').toLowerCase();

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch{}
  }

  // --- Goals (sequential) ---
  const GOALS = [
    { id:'G1', title:'ยิง “ถูกหมู่” ให้ครบ', need: (DIFF==='easy'? 12 : DIFF==='hard'? 18 : 15) },
    { id:'G2', title:'สลับหมู่ด้วย POWER', need: (DIFF==='easy'? 2 : DIFF==='hard'? 4 : 3) }
  ];

  // --- Minis (chain) ---
  // M1: streak correct within time, no mistakes
  // M2: kill boss fast (only if boss appears)
  const MINIS = [
    { id:'M1', title:'Streak โหด!', need: (DIFF==='easy'? 5 : DIFF==='hard'? 7 : 6), timeSec: (DIFF==='easy'? 10 : DIFF==='hard'? 8 : 9) },
    { id:'M2', title:'Boss Break!', need: 1, timeSec: (DIFF==='easy'? 8 : DIFF==='hard'? 6 : 7) }
  ];

  const S = {
    goalsDone:0,
    goalsTotal: GOALS.length,

    minisDone:0,
    miniTotal: 999,

    goalIdx:0,
    goalNow:0,

    swapCount:0,

    // mini
    miniIdx:0,
    miniActive:false,
    miniNow:0,
    miniNeed: MINIS[0].need,
    miniDeadlineMs: 0,
    miniBossId: null,
    miniUrgent:false,

    // time
    left: 0
  };

  function currentGoal(){ return GOALS[Math.min(GOALS.length-1, S.goalIdx)]; }
  function currentMini(){ return MINIS[Math.min(MINIS.length-1, S.miniIdx)]; }

  function startMini(){
    const m = currentMini();
    S.miniActive = true;
    S.miniNow = 0;
    S.miniNeed = m.need;
    S.miniUrgent = false;
    S.miniBossId = null;
    S.miniDeadlineMs = Date.now() + (m.timeSec * 1000);
    updateUI();
  }

  function clearMini(success){
    S.miniActive = false;
    S.miniUrgent = false;
    S.miniDeadlineMs = 0;

    if (success){
      S.minisDone += 1;
      emit('hha:celebrate', { kind:'mini', label: currentMini().id });
    }
    // chain next mini
    S.miniIdx = Math.min(MINIS.length-1, S.miniIdx + 1);
    // delay then start again (keeps it spicy)
    setTimeout(()=> startMini(), 900);
  }

  function completeGoal(){
    S.goalsDone = Math.min(S.goalsTotal, S.goalsDone + 1);
    emit('hha:celebrate', { kind:'goal', label: currentGoal().id });

    // next goal
    S.goalIdx = Math.min(GOALS.length-1, S.goalIdx + 1);
    S.goalNow = 0;
    updateUI();
  }

  function updateUI(){
    const g = currentGoal();
    const m = currentMini();

    let miniLeftSec;
    if (S.miniActive && S.miniDeadlineMs){
      miniLeftSec = Math.max(0, Math.ceil((S.miniDeadlineMs - Date.now())/1000));
      S.miniUrgent = miniLeftSec <= 3 && miniLeftSec > 0;
    } else {
      miniLeftSec = undefined;
      S.miniUrgent = false;
    }

    emit('quest:update', {
      goalsDone: S.goalsDone,
      goalsTotal: S.goalsTotal,
      minisDone: S.minisDone,
      miniTotal: S.miniTotal,

      goalTitle: `Goal ${S.goalIdx+1}: ${g.title}`,
      goalNow: S.goalNow,
      goalNeed: g.need,

      miniTitle: S.miniActive ? `Mini: ${m.title}` : `Mini: ${m.title}`,
      miniNow: S.miniActive ? S.miniNow : 0,
      miniNeed: S.miniNeed,
      miniLeftSec,
      miniUrgent: !!S.miniUrgent
    });
  }

  // --- Progress events from Engine ---
  root.addEventListener('groups:progress', (ev)=>{
    const d = ev.detail || {};
    const kind = String(d.kind||'');

    // Goal 1: correct hit
    if (kind === 'good_hit'){
      if (S.goalIdx === 0){
        S.goalNow += 1;
        if (S.goalNow >= currentGoal().need) completeGoal();
      }

      // Mini M1: streak correct
      if (S.miniActive && currentMini().id === 'M1'){
        S.miniNow += 1;
        if (S.miniNow >= S.miniNeed){
          clearMini(true);
        }
      }
      updateUI();
      return;
    }

    // mistakes break mini M1
    if (kind === 'wrong_hit' || kind === 'junk_hit' || kind === 'decoy_hit'){
      if (S.miniActive && currentMini().id === 'M1'){
        clearMini(false);
      }
      updateUI();
      return;
    }

    // Goal 2: swaps
    if (kind === 'group_swap'){
      if (S.goalIdx === 1){
        S.goalNow += 1;
        if (S.goalNow >= currentGoal().need) completeGoal();
      }
      updateUI();
      return;
    }

    // Mini M2: boss spawn / boss kill fast
    if (kind === 'boss_spawn'){
      if (S.miniActive && currentMini().id === 'M2'){
        S.miniBossId = d.id || null;
        // reset timer from spawn moment
        S.miniDeadlineMs = Date.now() + (currentMini().timeSec * 1000);
      }
      updateUI();
      return;
    }
    if (kind === 'boss_kill'){
      if (S.miniActive && currentMini().id === 'M2'){
        // if bossId set, accept any kill during window
        clearMini(true);
      }
      updateUI();
      return;
    }
  }, { passive:true });

  // Time tick -> mini fail by timeout
  root.addEventListener('hha:time', (ev)=>{
    const d = ev.detail || {};
    const left = (d.left|0);
    S.left = left;

    if (S.miniActive && S.miniDeadlineMs){
      if (Date.now() >= S.miniDeadlineMs){
        clearMini(false);
      }
    }
    updateUI();
  }, { passive:true });

  // End summary enrichment
  root.addEventListener('hha:end', (ev)=>{
    const d = ev.detail || {};
    d.goalsCleared = S.goalsDone|0;
    d.goalsTotal = S.goalsTotal|0;
    d.miniCleared = S.minisDone|0;
    d.miniTotal = S.miniTotal|0;
    // rewrite detail (best effort)
    try{ ev.detail = d; }catch{}
  }, { passive:true });

  // init
  setTimeout(()=>{
    startMini();
    updateUI();
  }, 200);

})(window);