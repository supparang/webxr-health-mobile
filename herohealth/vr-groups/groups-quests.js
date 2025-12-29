/* === /herohealth/vr-groups/groups-quests.js ===
Groups VR — Quest System (PRODUCTION)
✅ window.GroupsVR.createGroupsQuest()
✅ listens groups:progress kinds:
   hit_good hit_bad combo group_swap perfect_switch storm_on storm_off boss_spawn boss_down bonus_star bonus_ice
✅ emits quest:update for HUD
✅ Goals 1–5 sequential + Minis chain (timed/conditional)
*/

(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{ detail: detail||{} })); }catch{} };
  const clamp = (v,a,b)=> (v<a?a:(v>b?b:v));
  const now = ()=> (root.performance && root.performance.now) ? root.performance.now() : Date.now();

  function goalNeed(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff === 'easy') return 6;
    if (diff === 'hard') return 10;
    return 8;
  }

  function createGoals(diff){
    const thr = goalNeed(diff);
    return [
      { id:'g1', title:`เปลี่ยนหมู่ให้สำเร็จ 1 ครั้ง (ต้องสะสม POWER ให้ครบ ${thr})`, cur:0, total:1 },
      { id:'g2', title:`กดอาหารถูกหมู่ให้ได้ 15 ครั้ง`, cur:0, total:15 },
      { id:'g3', title:`ทำ COMBO ให้ถึง 12`, cur:0, total:12 },
      { id:'g4', title:`รอด STORM 1 รอบ (จน STORM OFF)`, cur:0, total:1 },
      { id:'g5', title:`ปราบ BOSS ให้ได้ 1 ครั้ง`, cur:0, total:1 },
    ];
  }

  function pickMini(diff){
    // mini pool (feel free to expand)
    const thr = goalNeed(diff);
    const list = [
      { id:'m_nojunk', title:`No-Junk 8 วิ (ห้ามโดน JUNK/WRONG/DECOY)`, total:8, timed:true },
      { id:'m_perfect', title:`Perfect Switch 1 ครั้ง (เปลี่ยนหมู่แบบไม่พลาดเลย)`, total:1, timed:false },
      { id:'m_storm', title:`ช่วง STORM: กดถูกหมู่ 6 ครั้ง`, total:6, timed:false, stormOnly:true },
      { id:'m_bonus', title:`เก็บ ⭐ หรือ ❄️ 1 ครั้ง`, total:1, timed:false },
      { id:'m_combo', title:`ทำ COMBO ต่อเนื่อง 10`, total:10, timed:false },
    ];
    return list[(Math.random()*list.length)|0];
  }

  function makeQuest(opts){
    opts = opts || {};
    const diff = String(opts.diff||'normal').toLowerCase();

    const S = {
      started:false,

      goals: createGoals(diff),
      gi: 0,
      goalsCleared:0,
      goalsTotal: 5,

      mini: null,
      miniCleared:0,
      miniTotal: 999,

      // runtime
      _combo:0,
      _storm:false,
      _noBadUntil:0,
      _miniTimer:0,
      _miniLeft:0,

      _streakBad:false
    };

    function activeGoal(){ return S.goals[S.gi] || null; }

    function pushUpdate(extra){
      const g = activeGoal();
      const m = S.mini;

      const goalNow = g ? g.cur : 0;
      const goalTotal = g ? g.total : 0;
      const goalPct = g ? (goalNow/Math.max(1,goalTotal))*100 : 0;

      const miniNow = m ? (m.cur||0) : 0;
      const miniTotal = m ? (m.total||0) : 0;
      const miniPct = m ? (miniNow/Math.max(1,miniTotal))*100 : 0;

      emit('quest:update', Object.assign({
        goalTitle: g ? g.title : '—',
        goalNow, goalTotal,
        goalPct: clamp(goalPct,0,100),

        miniTitle: m ? m.title : '—',
        miniNow, miniTotal,
        miniPct: clamp(miniPct,0,100),

        miniTimeLeftSec: (m && m.timed) ? Math.max(0, (S._miniLeft|0)) : 0,

        goalsCleared: S.goalsCleared,
        goalsTotal: S.goalsTotal,
        miniCleared: S.miniCleared,
        miniTotal: S.miniTotal
      }, extra||{}));
    }

    function nextGoal(){
      S.goalsCleared++;
      S.gi = clamp(S.gi + 1, 0, S.goals.length);
      if (S.gi >= S.goals.length){
        // all done
        emit('hha:celebrate', { kind:'goal', title:'GOALS COMPLETE!' });
      } else {
        emit('hha:celebrate', { kind:'goal', title:'GOAL CLEAR!' });
      }
      pushUpdate();
    }

    function startMini(){
      S.mini = pickMini(diff);
      S.mini.cur = 0;

      S._streakBad = false;

      if (S.mini.timed){
        S._miniLeft = S.mini.total|0;
        clearInterval(S._miniTimer);
        S._miniTimer = setInterval(()=>{
          S._miniLeft = Math.max(0, (S._miniLeft|0) - 1);
          pushUpdate();
          if (S._miniLeft <= 0){
            // success only if stayed clean (no bad)
            if (!S._streakBad && (S.mini.id === 'm_nojunk')){
              clearMini(true);
            } else {
              clearMini(false);
            }
          }
        }, 1000);
      } else {
        S._miniLeft = 0;
        clearInterval(S._miniTimer);
        S._miniTimer = 0;
      }

      emit('hha:celebrate', { kind:'mini', title:'MINI START!' });
      pushUpdate();
    }

    function clearMini(success){
      if (!S.mini) return;

      clearInterval(S._miniTimer);
      S._miniTimer = 0;
      S._miniLeft = 0;

      if (success){
        S.miniCleared++;
        emit('hha:celebrate', { kind:'mini', title:'MINI CLEAR!' });
      } else {
        emit('hha:judge', { kind:'bad', text:'MINI FAIL' });
      }

      S.mini = null;
      pushUpdate();

      // start next mini after short gap
      setTimeout(()=>startMini(), 600);
    }

    function bumpMini(n=1){
      if (!S.mini) return;
      S.mini.cur = clamp((S.mini.cur|0) + (n|0), 0, S.mini.total|0);
      if (!S.mini.timed) pushUpdate();
      if (S.mini.cur >= S.mini.total){
        clearMini(true);
      }
    }

    function onProgress(ev){
      const d = (ev && ev.detail) ? ev.detail : {};
      const kind = String(d.kind||'').toLowerCase();

      const g = activeGoal();
      if (!S.started) return;

      // track storm state
      if (kind === 'storm_on') S._storm = true;
      if (kind === 'storm_off') S._storm = false;

      // BAD events => break no-junk
      if (kind === 'hit_bad'){
        S._streakBad = true;
        // if mini is nojunk => fail immediately
        if (S.mini && S.mini.id === 'm_nojunk'){
          clearMini(false);
        }
      }

      // GOALS
      if (g){
        if (g.id === 'g1' && kind === 'group_swap'){
          g.cur = clamp(g.cur + 1, 0, g.total);
          pushUpdate();
          if (g.cur >= g.total) nextGoal();
        }
        if (g.id === 'g2' && kind === 'hit_good'){
          g.cur = clamp(g.cur + 1, 0, g.total);
          pushUpdate();
          if (g.cur >= g.total) nextGoal();
        }
        if (g.id === 'g3' && kind === 'combo'){
          const c = Number(d.combo||0);
          g.cur = clamp(Math.max(g.cur, c), 0, g.total);
          pushUpdate();
          if (g.cur >= g.total) nextGoal();
        }
        if (g.id === 'g4' && kind === 'storm_off'){
          g.cur = 1;
          pushUpdate();
          if (g.cur >= g.total) nextGoal();
        }
        if (g.id === 'g5' && kind === 'boss_down'){
          g.cur = 1;
          pushUpdate();
          if (g.cur >= g.total) nextGoal();
        }
      }

      // MINIS
      if (!S.mini) return;

      if (S.mini.id === 'm_perfect' && kind === 'perfect_switch'){
        bumpMini(1);
      }
      if (S.mini.id === 'm_storm'){
        if (S._storm && kind === 'hit_good') bumpMini(1);
      }
      if (S.mini.id === 'm_bonus' && (kind === 'bonus_star' || kind === 'bonus_ice')){
        bumpMini(1);
      }
      if (S.mini.id === 'm_combo' && kind === 'combo'){
        const c = Number(d.combo||0);
        S.mini.cur = clamp(Math.max(S.mini.cur, c), 0, S.mini.total|0);
        pushUpdate();
        if (S.mini.cur >= S.mini.total) clearMini(true);
      }
    }

    function start(){
      if (S.started) return;
      S.started = true;
      pushUpdate();
      startMini();
    }

    function stop(){
      S.started = false;
      clearInterval(S._miniTimer);
      S._miniTimer = 0;
    }

    function getState(){
      const g = activeGoal();
      return {
        goalsCleared: S.goalsCleared|0,
        goalsTotal: S.goalsTotal|0,
        miniCleared: S.miniCleared|0,
        miniTotal: S.miniTotal|0,
        activeGoalTitle: g ? g.title : '',
        activeMiniTitle: S.mini ? S.mini.title : ''
      };
    }

    return { start, stop, onProgress, pushUpdate, getState };
  }

  NS.createGroupsQuest = makeQuest;
})(typeof window !== 'undefined' ? window : globalThis);