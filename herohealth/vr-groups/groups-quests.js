/* === /herohealth/vr-groups/groups-quests.js ===
GroupsVR — Quest System (PRODUCTION)
✅ window.GroupsVR.createGroupsQuest()
✅ listens to: groups:progress (hit_good/hit_bad/combo/group_swap/perfect_switch/storm_on/storm_off/boss_spawn/boss_down/star_hit/ice_hit)
✅ emits: quest:update (goalTitle/goalNow/goalTotal/goalPct + miniTitle/miniNow/miniTotal/miniPct + miniTimeLeftSec)
✅ uses groups:nojunk {on,cx,cy,r} to render ring via CSS vars
*/

(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{ detail: detail||{} })); }catch{} };

  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }

  function goalNeed(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff==='easy') return 6;
    if (diff==='hard') return 10;
    return 8;
  }

  function miniPlan(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff==='easy') {
      return {
        nojunkNeed: 4, nojunkSec: 9,
        stormNeed:  4,
        perfectNeed: 1,
        comboNeed: 10
      };
    }
    if (diff==='hard') {
      return {
        nojunkNeed: 6, nojunkSec: 7,
        stormNeed:  6,
        perfectNeed: 2,
        comboNeed: 14
      };
    }
    return {
      nojunkNeed: 5, nojunkSec: 8,
      stormNeed:  5,
      perfectNeed: 2,
      comboNeed: 12
    };
  }

  function pct(nowv, total){
    total = Math.max(1, Number(total)||1);
    return clamp((Number(nowv)||0) / total * 100, 0, 100);
  }

  function makeNoJunkRing(on){
    if (!on) {
      emit('groups:nojunk', { on:false, cx:0, cy:0, r:0 });
      return;
    }
    const W = root.innerWidth || 360;
    const H = root.innerHeight || 640;

    // วางวงกลาง ๆ แต่หลบ HUD
    const cx = W * 0.5;
    const cy = H * 0.52;
    const r  = Math.min(W, H) * 0.26;

    emit('groups:nojunk', { on:true, cx, cy, r });
  }

  NS.createGroupsQuest = function createGroupsQuest(opts){
    opts = opts || {};
    const diff = String(opts.diff||'normal').toLowerCase();
    const runMode = String(opts.runMode||'play').toLowerCase();
    const plan = miniPlan(diff);

    // GOAL: สลับหมู่ให้ครบตาม power threshold (ยิ่ง diff สูง ยิ่งต้องแม่น/เร็ว)
    const goalTotal = (diff==='hard') ? 6 : (diff==='easy' ? 4 : 5);

    const state = {
      started:false,
      ended:false,

      goalsCleared:0,
      goalsTotal: goalTotal,

      miniCleared:0,
      miniTotal: 5,

      // goal progress
      swapCount:0,

      // mini state
      miniIndex:0,
      miniActive:null,
      miniNow:0,
      miniNeed:0,
      miniEndsAt:0,
      miniFail:false,
      miniFailReason:'',

      // storm collector
      stormOn:false,
      stormHit:0,

      // boss
      bossDown:0,

      // perfect
      perfect:0,

      // combo
      comboMaxSeen:0
    };

    function pushUpdate(){
      const miniTitle = state.miniActive ? state.miniActive.title : '—';
      const miniNow   = state.miniNow || 0;
      const miniNeed  = state.miniNeed || 0;

      const tLeft = state.miniEndsAt ? Math.max(0, Math.ceil((state.miniEndsAt - now())/1000)) : 0;

      emit('quest:update', {
        goalTitle: `สลับหมู่ให้ครบ ${state.goalsTotal} ครั้ง (สะสม POWER ให้ไว!)`,
        goalNow: state.swapCount,
        goalTotal: state.goalsTotal,
        goalPct: pct(state.swapCount, state.goalsTotal),

        miniTitle,
        miniNow,
        miniTotal: miniNeed,
        miniPct: pct(miniNow, miniNeed),
        miniTimeLeftSec: tLeft
      });
    }

    function clearMini(){
      state.miniActive = null;
      state.miniNow = 0;
      state.miniNeed = 0;
      state.miniEndsAt = 0;
      state.miniFail = false;
      state.miniFailReason = '';
      makeNoJunkRing(false);
      pushUpdate();
    }

    function winMini(){
      state.miniCleared++;
      emit('hha:celebrate', { kind:'mini', title:`MINI CLEARED! (${state.miniCleared}/${state.miniTotal})` });
      clearMini();
      startNextMini();
    }

    function failMini(reason){
      state.miniFail = true;
      state.miniFailReason = String(reason||'fail');
      emit('hha:judge', { kind:'bad', text:`MINI FAIL: ${state.miniFailReason}` });
      emit('hha:celebrate', { kind:'mini', title:'TRY AGAIN!' });

      // รีสตาร์ท mini เดิมทันที (โหดแบบแฟร์)
      const current = state.miniIndex;
      clearMini();
      state.miniIndex = current;
      startNextMini(true);
    }

    function startMini(def, keepIndex){
      state.miniActive = def;
      state.miniNow = 0;
      state.miniNeed = def.need || 1;
      state.miniEndsAt = def.sec ? (now() + def.sec*1000) : 0;

      if (def.ring) makeNoJunkRing(true);
      else makeNoJunkRing(false);

      pushUpdate();

      if (def.sec){
        const timer = setInterval(()=>{
          if (!state.started || state.ended) { clearInterval(timer); return; }
          if (!state.miniActive || state.miniActive !== def) { clearInterval(timer); return; }

          const left = state.miniEndsAt - now();
          if (left <= 0){
            clearInterval(timer);
            // time up => success only if reached need
            if (state.miniNow >= state.miniNeed) winMini();
            else failMini('หมดเวลา');
          } else {
            pushUpdate();
          }
        }, 180);
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
          ring:true,
          onBad: ()=> failMini('โดนขยะ/ผิดหมู่')
        },
        {
          key:'storm',
          title:`Storm Collector: ช่วง STORM เก็บถูกหมู่ ${plan.stormNeed} ครั้ง`,
          need: plan.stormNeed,
          sec: 0,
          ring:false
        },
        {
          key:'boss',
          title:`Boss Down: โค่นบอส 1 ตัว 👑`,
          need: 1,
          sec: 0
        },
        {
          key:'perfect',
          title:`Perfect Switch: สลับหมู่แบบ Perfect ${plan.perfectNeed} ครั้ง`,
          need: plan.perfectNeed,
          sec: 0
        },
        {
          key:'combo',
          title:`Combo Rush: ทำคอมโบให้ถึง ${plan.comboNeed}`,
          need: plan.comboNeed,
          sec: 0
        }
      ];

      if (i >= defs.length){
        // all minis done
        return;
      }

      const def = defs[i];
      if (!retry) state.miniIndex = i;
      startMini(def, retry);
    }

    function onProgress(ev){
      const d = (ev && ev.detail) || {};

      // ---- GOAL: swap count ----
      if (d.kind === 'group_swap'){
        state.swapCount++;
        if (state.swapCount >= state.goalsTotal && state.goalsCleared === 0){
          state.goalsCleared = 1;
          emit('hha:celebrate', { kind:'goal', title:'GOAL CLEARED! 🎯' });
        }
        pushUpdate();
      }

      // ---- STORM state ----
      if (d.kind === 'storm_on'){ state.stormOn = true; state.stormHit = 0; pushUpdate(); }
      if (d.kind === 'storm_off'){ state.stormOn = false; pushUpdate(); }

      // ---- Perfect switch ----
      if (d.kind === 'perfect_switch'){
        state.perfect++;
        pushUpdate();
      }

      // ---- Boss down ----
      if (d.kind === 'boss_down'){
        state.bossDown++;
        pushUpdate();
      }

      // ---- Combo ----
      if (d.kind === 'combo' && d.combo != null){
        state.comboMaxSeen = Math.max(state.comboMaxSeen, Number(d.combo)||0);
        pushUpdate();
      }

      // ---- Mini handling ----
      const mini = state.miniActive;
      if (!mini) return;

      // No-Junk: progress on hit_good, fail on hit_bad
      if (mini.key === 'nojunk'){
        if (d.kind === 'hit_good'){
          state.miniNow++;
          if (state.miniNow >= state.miniNeed) {
            // ไม่รีบ win ทันที ถ้ามีเวลา: win ทันทีเพื่อความสะใจ
            winMini();
            return;
          }
          pushUpdate();
        }
        if (d.kind === 'hit_bad'){
          mini.onBad && mini.onBad();
          return;
        }
      }

      // Storm collector: count hit_good while stormOn
      if (mini.key === 'storm'){
        if (d.kind === 'hit_good' && state.stormOn){
          state.miniNow++;
          if (state.miniNow >= state.miniNeed) { winMini(); return; }
          pushUpdate();
        }
      }

      // Boss: win on boss_down
      if (mini.key === 'boss'){
        if (d.kind === 'boss_down'){
          state.miniNow = 1;
          winMini();
          return;
        }
      }

      // Perfect: count perfect_switch
      if (mini.key === 'perfect'){
        if (d.kind === 'perfect_switch'){
          state.miniNow++;
          if (state.miniNow >= state.miniNeed) { winMini(); return; }
          pushUpdate();
        }
      }

      // Combo: reach threshold
      if (mini.key === 'combo'){
        const c = state.comboMaxSeen;
        state.miniNow = Math.min(state.miniNeed, c);
        if (c >= state.miniNeed) { winMini(); return; }
        pushUpdate();
      }
    }

    function start(){
      state.started = true;
      state.ended = false;
      state.swapCount = 0;
      state.goalsCleared = 0;
      state.miniCleared = 0;
      state.miniIndex = 0;
      state.perfect = 0;
      state.bossDown = 0;
      state.comboMaxSeen = 0;
      state.stormOn = false;
      state.stormHit = 0;

      clearMini();
      startNextMini(false);
      pushUpdate();
    }

    function stop(){
      state.ended = true;
      makeNoJunkRing(false);
    }

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