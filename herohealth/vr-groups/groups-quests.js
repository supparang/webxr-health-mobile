/* === /herohealth/vr-groups/groups-quests.js ===
GroupsVR Quest System — Goals sequential + Minis chain
✅ Mini: Magnet Rush / No-Junk Ring / Speed 5
✅ Mini urgency (<=3s): emits directive {urgent:true, tick:true, shake}
✅ Exposes window.GroupsVR.createGroupsQuest(opts)
*/

(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{ detail: detail||{} })); }catch{} };
  const directive = (detail)=> emit('groups:directive', detail||{});

  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }

  function goalNeed(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff==='easy') return 6;
    if (diff==='hard') return 10;
    return 8;
  }

  function makeMiniList(diff){
    diff = String(diff||'normal').toLowerCase();
    const speedNeed = diff==='hard' ? 6 : 5;
    const speedTime = diff==='hard' ? 6 : 7;

    return [
      // A) speed burst
      { key:'speed', title:`สปีด! เก็บถูก ${speedNeed} ใน ${speedTime} วิ`, need:speedNeed, time:speedTime, forbidJunk:false },

      // B) No-Junk ring (fair): junk will spawn OUTSIDE ring (engine rule), but hitting any bad fails
      { key:'nojunk', title:`No-Junk Zone! ห้ามโดนขยะ/ผิดใน 6 วิ`, need:4, time:6, forbidJunk:true },

      // C) Magnet Rush: targets drift toward center; you must keep pace
      { key:'magnet', title:`MAGNET RUSH! เก็บถูก 6 ใน 7 วิ`, need:6, time:7, forbidJunk:false },
    ];
  }

  function createGroupsQuest(opts){
    opts = opts || {};
    const diff = String(opts.diff||'normal').toLowerCase();
    const runMode = String(opts.runMode||'play').toLowerCase();
    const style = String(opts.style||'mix').toLowerCase();

    const state = {
      started:false,
      stopped:false,

      // goal
      goalIndex:0,
      goalsTotal:5,
      goalsCleared:0,
      goalNow:0,
      goalTotal:goalNeed(diff),
      goalTitle:'',

      // mini
      minis: makeMiniList(diff),
      miniIndex:0,
      miniActive:null,
      miniNow:0,
      miniTotal:0,
      miniStartAt:0,
      miniEndAt:0,
      miniCleared:0,
      miniTotalAll: 999,

      // tick helper
      _lastUrgSec:null,

      // timer
      _timer:null,
    };

    function curGroupId(){
      // goalIndex 0..4 => group 1..5
      return (state.goalIndex % 5) + 1;
    }

    function goalTitle(){
      const g = curGroupId();
      return `หมู่ ${g}: เก็บให้ถูก ${state.goalTotal} ครั้ง`;
    }

    function pushUpdate(){
      const gp = (state.goalTotal>0) ? (state.goalNow/state.goalTotal)*100 : 0;
      const mp = (state.miniActive && state.miniTotal>0) ? (state.miniNow/state.miniTotal)*100 : 0;

      const leftSec = state.miniActive ? Math.max(0, Math.ceil((state.miniEndAt - now())/1000)) : 0;

      emit('quest:update', {
        goalTitle: state.goalTitle,
        goalNow: state.goalNow,
        goalTotal: state.goalTotal,
        goalPct: clamp(gp,0,100),

        miniTitle: state.miniActive ? state.miniActive.title : '—',
        miniNow: state.miniActive ? state.miniNow : 0,
        miniTotal: state.miniActive ? state.miniTotal : 0,
        miniPct: clamp(mp,0,100),
        miniTimeLeftSec: leftSec
      });

      // mini urgency directives (<=3s)
      if (state.miniActive){
        if (leftSec > 0 && leftSec <= 3){
          directive({ urgent:true, tick:true, shake:{ strength: 1 + (3-leftSec)*0.7, ms: 110 } });
          state._lastUrgSec = leftSec;
        } else {
          directive({ urgent:false });
          state._lastUrgSec = null;
        }
      } else {
        directive({ urgent:false });
        state._lastUrgSec = null;
      }
    }

    function startMini(){
      const m = state.minis[state.miniIndex % state.minis.length];
      state.miniActive = m;
      state.miniNow = 0;
      state.miniTotal = m.need;
      const t = now();
      state.miniStartAt = t;
      state.miniEndAt = t + (m.time*1000);

      // directives for special minis
      if (m.key === 'nojunk'){
        // fair ring: show ring, engine will spawn junk OUTSIDE ring only
        directive({ nojunk: { on:true, r: 140 } });
      } else {
        directive({ nojunk: { on:false } });
      }

      if (m.key === 'magnet'){
        directive({ magnet: { on:true, strength: 0.58 } });
      } else {
        directive({ magnet: { on:false } });
      }

      pushUpdate();
    }

    function endMini(success, reason){
      const m = state.miniActive;
      if (!m) return;

      // clear directives
      directive({ nojunk: { on:false } });
      directive({ magnet: { on:false } });
      directive({ urgent:false });

      if (success){
        state.miniCleared++;
        emit('hha:celebrate', { kind:'mini', title:'MINI CLEAR!' });
      } else {
        emit('hha:judge', { kind:'bad', text: reason || 'MINI FAIL' });
      }

      state.miniActive = null;
      state.miniIndex++;
      pushUpdate();

      // next mini after short delay
      setTimeout(()=>{ if (!state.stopped) startMini(); }, 420);
    }

    function nextGoal(){
      state.goalIndex++;
      state.goalsCleared++;
      state.goalNow = 0;
      state.goalTotal = goalNeed(diff);
      state.goalTitle = goalTitle();

      // on goal swap: light celebrate
      emit('hha:celebrate', { kind:'goal', title:`GOAL CLEAR! ${state.goalTitle}` });
      pushUpdate();
    }

    function start(){
      if (state.started) return;
      state.started = true;
      state.stopped = false;

      state.goalIndex = 0;
      state.goalsCleared = 0;
      state.goalNow = 0;
      state.goalTotal = goalNeed(diff);
      state.goalTitle = goalTitle();

      // start first mini
      startMini();

      state._timer = setInterval(()=>{
        if (state.stopped) return;

        // mini timeout
        if (state.miniActive){
          const left = state.miniEndAt - now();
          if (left <= 0){
            endMini(false, 'หมดเวลา');
            return;
          }
        }

        pushUpdate();
      }, 120);
    }

    function stop(){
      state.stopped = true;
      try{ clearInterval(state._timer); }catch{}
      state._timer = null;
      directive({ nojunk:{on:false}, magnet:{on:false}, urgent:false });
    }

    function onProgress(ev){
      const d = (ev && ev.detail) ? ev.detail : {};

      // Goal progress: correct hit with groupId
      if (d.kind === 'hit_good' && Number(d.groupId) === curGroupId()){
        state.goalNow++;
        if (state.goalNow >= state.goalTotal){
          nextGoal();
        }
      }

      // Mini progress
      if (state.miniActive){
        const m = state.miniActive;

        if (d.kind === 'hit_good'){
          state.miniNow++;
          if (state.miniNow >= state.miniTotal){
            endMini(true);
            return;
          }
        }

        // forbidJunk: any bad hit fails
        if (m.forbidJunk && (d.kind === 'hit_bad' || d.kind === 'hit_wrong' || d.kind === 'hit_junk')){
          endMini(false, 'โดนขยะ/ผิด');
          return;
        }
      }

      pushUpdate();
    }

    function getState(){
      return {
        goalsCleared: state.goalsCleared,
        goalsTotal: state.goalsTotal,
        miniCleared: state.miniCleared,
        miniTotal: state.miniTotalAll
      };
    }

    return { start, stop, onProgress, pushUpdate, getState };
  }

  NS.createGroupsQuest = createGroupsQuest;

})(typeof window !== 'undefined' ? window : globalThis);