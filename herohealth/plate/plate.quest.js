// === /herohealth/plate/plate.quest.js ===
// Quest Director (Goals sequential + Mini chain) for Plate
// Provides window.GAME_MODULES.createPlateQuestDirector

(function (root) {
  'use strict';
  const W = root;

  function emit(name, detail){
    try{ W.dispatchEvent(new CustomEvent(name, { detail })); }catch(e){}
  }
  function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }

  function createPlateQuestDirector(opts){
    opts = opts || {};
    const state = opts.state; // REQUIRED
    const onCoach = opts.onCoach || null;
    const onJudge = opts.onJudge || null;
    const onCelebrate = opts.onCelebrate || null;

    const PlateState = W.GAME_MODULES && W.GAME_MODULES.PlateState;
    const PlateGoals = W.GAME_MODULES && W.GAME_MODULES.PlateGoals;
    const PlateMinis = W.GAME_MODULES && W.GAME_MODULES.PlateMinis;

    const Q = {
      goals: PlateGoals ? PlateGoals.startGoals() : null,
      activeMini: null,
      miniCleared: 0,
      miniTotal: 0
    };

    function coach(msg, mood){
      if(typeof onCoach === 'function') onCoach(msg, mood);
      emit('hha:coach', { game:'plate', msg, mood: mood || 'neutral' });
    }
    function judge(text, kind){
      if(typeof onJudge === 'function') onJudge(text, kind);
      emit('hha:judge', { game:'plate', text, kind: kind || 'info' });
    }
    function celebrate(kind){
      if(typeof onCelebrate === 'function') onCelebrate(kind);
      emit('hha:celebrate', { game:'plate', kind: kind || 'ok' });
    }

    function getGoal(){
      if(!Q.goals || !PlateGoals) return null;
      return PlateGoals.getActive(Q.goals);
    }

    function emitUpdate(){
      const g = getGoal();
      const m = Q.activeMini;

      const goalPayload = g ? {
        title: g.title || '—',
        cur: g.cur || 0,
        target: g.target || 0,
        done: !!g.done
      } : { title:'—', cur:0, target:0, done:false };

      let miniPayload = null;
      if(m && PlateMinis){
        const tl = PlateMinis.timeLeft(m);
        miniPayload = {
          title: m.title || '—',
          cur: 0,
          target: m.durationSec || 0,
          timeLeft: tl,
          done: !!m.done
        };
      } else {
        miniPayload = { title:'—', cur:0, target:0, timeLeft:null, done:false };
      }

      emit('quest:update', {
        game:'plate',
        goal: goalPayload,
        mini: miniPayload,
        miniCountText: `${Q.miniCleared}/${Math.max(Q.miniTotal, Q.miniCleared)}`
      });
    }

    function start(){
      if(state){
        state.goalsTotal = 2;
        state.goalsCleared = 0;
        state.miniCleared = 0;
        state.miniTotal = 0;
      }
      coach('พร้อมลุย! เติมจานให้ครบ 5 หมู่ 💪', 'neutral');
      emitUpdate();
    }

    function startMiniPlateRush(){
      if(!PlateMinis) return;
      const mini = PlateMinis.startMini(PlateMinis.makePlateRush());
      Q.activeMini = mini;
      Q.miniTotal = Math.max(Q.miniTotal, Q.miniCleared + 1);

      if(state){
        state.miniTotal = Q.miniTotal;
      }

      judge('⚡ MINI START', 'warn');
      coach('⚡ Plate Rush เริ่มแล้ว! เร่งให้ครบ 5 หมู่!', 'neutral');
      emitUpdate();
    }

    function finishMini(ok, reason){
      const m = Q.activeMini;
      if(!m || m.done) return;
      m.done = true;

      if(ok){
        Q.miniCleared++;
        if(state){
          state.miniCleared = Q.miniCleared;
          state.miniTotal = Q.miniTotal;
        }
        celebrate('mini');
        coach('สุดยอด! Plate Rush ผ่าน! 🔥', 'happy');
      }else{
        coach('พลาดนิดเดียว! ลองใหม่ได้ 💪', 'sad');
        judge(`❌ MINI FAIL (${reason||'fail'})`, 'bad');
      }

      Q.activeMini = null;
      emitUpdate();
    }

    function tickMini(){
      if(!Q.activeMini || !PlateMinis) return;
      const tl = PlateMinis.timeLeft(Q.activeMini);
      if(tl != null && tl <= 0) finishMini(false, 'timeout');
      emitUpdate();
    }

    // Call when state changes (hit/expire etc.)
    function update(){
      if(!state || !PlateState || !PlateGoals) { emitUpdate(); return; }

      // update goals sequentially
      PlateGoals.updateGoals(Q.goals, state, {
        onGoalComplete: (goal)=>{
          celebrate('goal');
          if(goal.key === 'fill-plate'){
            coach('ครบ 5 หมู่แล้ว! ต่อไปคุมความแม่นยำ 😎', 'happy');
            // trigger Plate Rush once
            if(!Q.activeMini) startMiniPlateRush();
          }
        }
      });

      // live update accuracy goal cur (display only)
      const g = getGoal();
      if(g && g.key === 'accuracy'){
        g.cur = Math.round(PlateState.accuracyPct(state));
      }

      emitUpdate();
    }

    // Helpers for “forbid junk”
    function onJunkHitBlockedByShield(){
      // nothing special, still update UI
      emitUpdate();
    }
    function onJunkHitNoShield(){
      // if active mini forbids junk, fail it
      if(Q.activeMini && Q.activeMini.forbidJunk) finishMini(false, 'hit-junk');
      emitUpdate();
    }
    function onPlateNowComplete5(){
      // if active mini plate rush and still time left, success
      if(Q.activeMini && PlateMinis){
        const tl = PlateMinis.timeLeft(Q.activeMini);
        if(tl != null && tl > 0) finishMini(true, 'rush-complete');
      }
      emitUpdate();
    }

    return {
      start,
      update,
      tickMini,
      getGoal,
      getMini: ()=>Q.activeMini,
      startMiniPlateRush,
      finishMini,
      onJunkHitBlockedByShield,
      onJunkHitNoShield,
      onPlateNowComplete5
    };
  }

  W.GAME_MODULES = W.GAME_MODULES || {};
  W.GAME_MODULES.createPlateQuestDirector = createPlateQuestDirector;

})(window);