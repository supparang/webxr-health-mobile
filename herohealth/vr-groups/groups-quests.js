/* === /herohealth/vr-groups/groups-quests.js ===
GroupsVR — Quest System (PRODUCTION)
✅ No-Junk ring shrinks over time (pressure)
*/

(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{ detail: detail||{} })); }catch{} };

  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }

  function miniPlan(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff==='easy')  return { nojunkNeed:4, nojunkSec:9, stormNeed:4, perfectNeed:1, comboNeed:10 };
    if (diff==='hard')  return { nojunkNeed:6, nojunkSec:7, stormNeed:6, perfectNeed:2, comboNeed:14 };
    return               { nojunkNeed:5, nojunkSec:8, stormNeed:5, perfectNeed:2, comboNeed:12 };
  }

  function pct(nowv, total){
    total = Math.max(1, Number(total)||1);
    return clamp((Number(nowv)||0) / total * 100, 0, 100);
  }

  function ringBase(){
    const W = root.innerWidth || 360;
    const H = root.innerHeight || 640;
    const cx = W * 0.5;
    const cy = H * 0.52;
    const r0 = Math.min(W, H) * 0.28;
    return { cx, cy, r0 };
  }

  function setRing(on, cx, cy, r){
    emit('groups:nojunk', { on: !!on, cx, cy, r });
  }

  NS.createGroupsQuest = function createGroupsQuest(opts){
    opts = opts || {};
    const diff = String(opts.diff||'normal').toLowerCase();
    const plan = miniPlan(diff);
    const goalTotal = (diff==='hard') ? 6 : (diff==='easy' ? 4 : 5);

    const state = {
      started:false, ended:false,
      goalsCleared:0, goalsTotal:goalTotal,
      miniCleared:0, miniTotal:5,
      swapCount:0,

      miniIndex:0,
      miniActive:null,
      miniNow:0,
      miniNeed:0,
      miniEndsAt:0,
      miniStartsAt:0,

      ring:{ on:false, cx:0, cy:0, r0:0 },

      stormOn:false,
      bossDown:0,
      perfect:0,
      comboMaxSeen:0
    };

    function pushUpdate(){
      const miniTitle = state.miniActive ? state.miniActive.title : '—';
      const tLeft = state.miniEndsAt ? Math.max(0, Math.ceil((state.miniEndsAt - now())/1000)) : 0;

      emit('quest:update', {
        goalTitle: `สลับหมู่ให้ครบ ${state.goalsTotal} ครั้ง (สะสม POWER ให้ไว!)`,
        goalNow: state.swapCount,
        goalTotal: state.goalsTotal,
        goalPct: pct(state.swapCount, state.goalsTotal),

        miniTitle,
        miniNow: state.miniNow,
        miniTotal: state.miniNeed,
        miniPct: pct(state.miniNow, state.miniNeed),
        miniTimeLeftSec: tLeft
      });
    }

    function clearMini(){
      state.miniActive = null;
      state.miniNow = 0;
      state.miniNeed = 0;
      state.miniEndsAt = 0;
      state.miniStartsAt = 0;
      state.ring.on = false;
      setRing(false, 0, 0, 0);
      pushUpdate();
    }

    function winMini(){
      state.miniCleared++;
      emit('hha:celebrate', { kind:'mini', title:`MINI CLEARED! (${state.miniCleared}/${state.miniTotal})` });
      clearMini();
      startNextMini(false);
    }

    function failMini(reason){
      emit('hha:judge', { kind:'bad', text:`MINI FAIL: ${String(reason||'fail')}` });
      emit('hha:celebrate', { kind:'mini', title:'TRY AGAIN!' });

      const keep = state.miniIndex;
      clearMini();
      state.miniIndex = keep;
      startNextMini(true);
    }

    function updateRingShrink(){
      if (!state.ring.on) return;
      if (!state.miniStartsAt || !state.miniEndsAt) return;

      const t = now();
      const total = Math.max(1, state.miniEndsAt - state.miniStartsAt);
      const left  = Math.max(0, state.miniEndsAt - t);
      const frac  = clamp(left / total, 0, 1);

      // shrink: 100% -> 72% (pressure!)
      const r = state.ring.r0 * (0.72 + 0.28 * frac);
      setRing(true, state.ring.cx, state.ring.cy, r);
    }

    function startMini(def){
      state.miniActive = def;
      state.miniNow = 0;
      state.miniNeed = def.need || 1;

      state.miniStartsAt = def.sec ? now() : 0;
      state.miniEndsAt = def.sec ? (state.miniStartsAt + def.sec*1000) : 0;

      if (def.ring){
        const b = ringBase();
        state.ring = { on:true, cx:b.cx, cy:b.cy, r0:b.r0 };
        setRing(true, b.cx, b.cy, b.r0);
      } else {
        state.ring.on = false;
        setRing(false, 0, 0, 0);
      }

      pushUpdate();

      if (def.sec){
        const timer = setInterval(()=>{
          if (!state.started || state.ended) { clearInterval(timer); return; }
          if (!state.miniActive || state.miniActive !== def) { clearInterval(timer); return; }

          updateRingShrink();

          const left = state.miniEndsAt - now();
          if (left <= 0){
            clearInterval(timer);
            if (state.miniNow >= state.miniNeed) winMini();
            else failMini('หมดเวลา');
          } else {
            pushUpdate();
          }
        }, 160);
      }
    }

    function startNextMini(retry){
      const i = state.miniIndex;
      const defs = [
        {
          key:'nojunk',
          title:`No-Junk Zone: เก็บถูกหมู่ ${plan.nojunkNeed} ภายใน ${plan.nojunkSec} วิ (ห้ามโดนขยะ!)`,
          need: plan.nojunkNeed,
          sec: plan.nojunkSec,
          ring:true
        },
        {
          key:'storm',
          title:`Storm Collector: ช่วง STORM เก็บถูกหมู่ ${plan.stormNeed} ครั้ง`,
          need: plan.stormNeed
        },
        {
          key:'boss',
          title:`Boss Down: โค่นบอส 1 ตัว 👑`,
          need: 1
        },
        {
          key:'perfect',
          title:`Perfect Switch: สลับหมู่แบบ Perfect ${plan.perfectNeed} ครั้ง`,
          need: plan.perfectNeed
        },
        {
          key:'combo',
          title:`Combo Rush: ทำคอมโบให้ถึง ${plan.comboNeed}`,
          need: plan.comboNeed
        }
      ];

      if (i >= defs.length) return;
      const def = defs[i];
      if (!retry) state.miniIndex = i;
      startMini(def);
    }

    function onProgress(ev){
      const d = (ev && ev.detail) || {};

      if (d.kind === 'group_swap'){
        state.swapCount++;
        if (state.swapCount >= state.goalsTotal && state.goalsCleared === 0){
          state.goalsCleared = 1;
          emit('hha:celebrate', { kind:'goal', title:'GOAL CLEARED! 🎯' });
        }
        pushUpdate();
      }

      if (d.kind === 'storm_on'){ state.stormOn = true; pushUpdate(); }
      if (d.kind === 'storm_off'){ state.stormOn = false; pushUpdate(); }

      if (d.kind === 'boss_down'){ state.bossDown++; pushUpdate(); }
      if (d.kind === 'perfect_switch'){ state.perfect++; pushUpdate(); }

      if (d.kind === 'combo' && d.combo != null){
        state.comboMaxSeen = Math.max(state.comboMaxSeen, Number(d.combo)||0);
        pushUpdate();
      }

      const mini = state.miniActive;
      if (!mini) return;

      if (mini.key === 'nojunk'){
        if (d.kind === 'hit_good'){
          state.miniNow++;
          if (state.miniNow >= state.miniNeed) { winMini(); return; }
          pushUpdate();
        }
        if (d.kind === 'hit_bad'){ failMini('โดนขยะ/ผิดหมู่'); return; }
      }

      if (mini.key === 'storm'){
        if (d.kind === 'hit_good' && state.stormOn){
          state.miniNow++;
          if (state.miniNow >= state.miniNeed) { winMini(); return; }
          pushUpdate();
        }
      }

      if (mini.key === 'boss'){
        if (d.kind === 'boss_down'){ state.miniNow = 1; winMini(); return; }
      }

      if (mini.key === 'perfect'){
        if (d.kind === 'perfect_switch'){
          state.miniNow++;
          if (state.miniNow >= state.miniNeed) { winMini(); return; }
          pushUpdate();
        }
      }

      if (mini.key === 'combo'){
        state.miniNow = Math.min(state.miniNeed, state.comboMaxSeen);
        if (state.comboMaxSeen >= state.miniNeed) { winMini(); return; }
        pushUpdate();
      }
    }

    function start(){
      state.started = true; state.ended = false;
      state.goalsCleared = 0;
      state.miniCleared = 0;
      state.swapCount = 0;
      state.miniIndex = 0;
      state.stormOn = false;
      state.bossDown = 0;
      state.perfect = 0;
      state.comboMaxSeen = 0;

      clearMini();
      startNextMini(false);
      pushUpdate();
    }

    function stop(){ state.ended = true; setRing(false, 0, 0, 0); }

    function getState(){
      return {
        goalsCleared: state.goalsCleared|0,
        goalsTotal: state.goalsTotal|0,
        miniCleared: state.miniCleared|0,
        miniTotal: state.miniTotal|0
      };
    }

    return { start, stop, onProgress, pushUpdate, getState };
  };

})(typeof window !== 'undefined' ? window : globalThis);