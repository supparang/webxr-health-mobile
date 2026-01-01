/* === /herohealth/vr-groups/groups-quests.js ===
Quest pack for GroupsVR
- Goal sequential + Mini chain
- Emits: quest:update
*/
(function(root){
  'use strict';
  root.GroupsVR = root.GroupsVR || {};

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function makeQuestDirector(opts){
    opts = opts || {};
    const diff = String(opts.diff||'normal');
    const runMode = String(opts.runMode||'play');

    const GOALS = [
      { id:'g1', title:'Hit correct group targets', target: (diff==='easy'?18:(diff==='hard'?26:22)) },
      { id:'g2', title:'Perfect switch count', target: (diff==='easy'?3:(diff==='hard'?5:4)) }
    ];

    const MINIS = [
      { id:'m1', title:'No-Wrong streak', target:(diff==='easy'?5:(diff==='hard'?8:6)), secs:(diff==='easy'?10:(diff==='hard'?8:9)), forbidWrong:true },
      { id:'m2', title:'Rush correct hits', target:(diff==='easy'?6:(diff==='hard'?8:7)), secs:(diff==='easy'?8:(diff==='hard'?6:7)), forbidJunk:true },
      { id:'m3', title:'Boss warm-up: hit boss 3 times', target:3, secs:12, bossOnly:true }
    ];

    const Q = {
      goalIndex: 0,
      goalNow: 0,
      goalsCleared: 0,

      miniIndex: 0,
      miniNow: 0,
      miniCleared: 0,
      miniActive: null,
      miniEndAt: 0,

      // live flags
      forbidWrong:false,
      forbidJunk:false,
      bossOnly:false,

      // counters from engine
      perfectSwitches: 0
    };

    function activeGoal(){ return GOALS[Q.goalIndex] || null; }
    function pickMini(){ return MINIS[Q.miniIndex % MINIS.length]; }

    function pushUpdate(extra){
      const g = activeGoal() || {title:'—', target:1};
      const now = Date.now();
      const mLeft = Q.miniActive ? Math.max(0, Math.ceil((Q.miniEndAt - now)/1000)) : 0;

      const detail = Object.assign({
        goalTitle: g.title,
        goalNow: Q.goalNow,
        goalTotal: g.target,
        goalPct: clamp(Q.goalNow/g.target*100, 0, 100),

        miniTitle: Q.miniActive ? Q.miniActive.title : '—',
        miniNow: Q.miniNow,
        miniTotal: Q.miniActive ? Q.miniActive.target : 1,
        miniPct: Q.miniActive ? clamp(Q.miniNow/Q.miniActive.target*100, 0, 100) : 0,
        miniTimeLeftSec: mLeft
      }, extra||{});

      try{ window.dispatchEvent(new CustomEvent('quest:update', {detail})); }catch{}
    }

    function startMini(){
      Q.miniActive = pickMini();
      Q.miniIndex++;
      Q.miniNow = 0;
      Q.forbidWrong = !!Q.miniActive.forbidWrong;
      Q.forbidJunk  = !!Q.miniActive.forbidJunk;
      Q.bossOnly    = !!Q.miniActive.bossOnly;
      Q.miniEndAt = Date.now() + (Number(Q.miniActive.secs||8)*1000);
      pushUpdate({miniStart:true});
    }

    function failMini(reason){
      // just restart next mini (keeps pressure)
      Q.miniActive = null;
      Q.forbidWrong=false; Q.forbidJunk=false; Q.bossOnly=false;
      pushUpdate({miniFail:String(reason||'fail')});
      setTimeout(startMini, 300);
    }

    function winMini(){
      Q.miniCleared++;
      Q.miniActive = null;
      Q.forbidWrong=false; Q.forbidJunk=false; Q.bossOnly=false;
      pushUpdate({miniWin:true});
      setTimeout(startMini, 350);
    }

    function winGoal(){
      Q.goalsCleared++;
      Q.goalIndex++;
      Q.goalNow = 0;
      pushUpdate({goalWin:true});
    }

    function tick(){
      if (Q.miniActive){
        const left = Q.miniEndAt - Date.now();
        if (left <= 0){
          // time out
          failMini('timeout');
        }else{
          pushUpdate();
        }
      }
    }

    function onCorrectHit(){
      // goal1 counts correct hits
      const g = activeGoal();
      if (!g) return;
      if (g.id === 'g1'){
        Q.goalNow++;
        if (Q.goalNow >= g.target) winGoal();
      }
      // mini counts
      if (Q.miniActive && !Q.bossOnly){
        Q.miniNow++;
        if (Q.miniNow >= Q.miniActive.target) winMini();
      }
      pushUpdate();
    }

    function onPerfectSwitch(){
      Q.perfectSwitches++;
      const g = activeGoal();
      if (g && g.id === 'g2'){
        Q.goalNow = Q.perfectSwitches;
        if (Q.goalNow >= g.target) winGoal();
      }
      pushUpdate({perfectSwitches:Q.perfectSwitches});
    }

    function onWrongHit(){
      if (Q.miniActive && Q.forbidWrong) failMini('wrong');
    }
    function onJunkHit(){
      if (Q.miniActive && Q.forbidJunk) failMini('junk');
    }

    function onBossHit(){
      if (Q.miniActive && Q.bossOnly){
        Q.miniNow++;
        if (Q.miniNow >= Q.miniActive.target) winMini();
        pushUpdate();
      }
    }

    function getState(){
      return {
        goalsCleared: Q.goalsCleared,
        goalsTotal: GOALS.length,
        miniCleared: Q.miniCleared,
        miniTotal: 999,
        perfectSwitches: Q.perfectSwitches
      };
    }

    // init
    startMini();
    pushUpdate();

    return {
      tick,
      onCorrectHit,
      onWrongHit,
      onJunkHit,
      onBossHit,
      onPerfectSwitch,
      getState,
      getMiniFlags: ()=>({ forbidWrong:Q.forbidWrong, forbidJunk:Q.forbidJunk, bossOnly:Q.bossOnly })
    };
  }

  root.GroupsVR.Quests = { makeQuestDirector };

})(typeof window!=='undefined'?window:globalThis);