/* === /herohealth/vr-groups/groups-quests.js ===
Food Groups VR — Quest System (Goals sequential + Minis chain + No-Junk Mini)
✅ Emits: quest:update (Goal/Mini title + progress bars + mini timer)
✅ Listens: groups:progress (from GameEngine)
✅ No-Junk Mini:
   - starts on {kind:'nojunk_on'} (7s default)
   - FAIL on {kind:'nojunk_fail'}
   - PASS on {kind:'nojunk_off'} (if not failed)
   - PASS => dispatch 'groups:reward' (score bonus + shield + fever reduction)
*/

(function(root){
  'use strict';

  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{ detail: detail||{} })); }catch{} };

  // seeded rng (same approach as engine)
  function xmur3(str){
    str = String(str||'seed');
    let h = 1779033703 ^ str.length;
    for (let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= (h >>> 16);
      return h >>> 0;
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function makeRng(seed){
    const gen = xmur3(seed);
    return sfc32(gen(), gen(), gen(), gen());
  }

  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }

  function goalTotalByDiff(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff==='easy') return 2;
    if (diff==='hard') return 4;
    return 3;
  }

  function makeMiniPool(){
    return [
      {
        id:'combo8',
        title:'ทำคอมโบให้ถึง 8 ครั้งติด 🔥',
        total: 8,
        progressFrom(ev, st){
          if (ev?.detail?.kind === 'combo'){
            st._comboNow = Math.max(st._comboNow||0, Number(ev.detail.combo||0));
          }
          return clamp(st._comboNow||0, 0, 8);
        }
      },
      {
        id:'perfectSwitch',
        title:'สลับหมู่แบบ Perfect (ห้ามพลาดก่อนสลับ) 🌟',
        total: 1,
        progressFrom(ev, st){
          if (ev?.detail?.kind === 'perfect_switch') st._ps = 1;
          return st._ps ? 1 : 0;
        }
      },
      {
        id:'bossDown',
        title:'โค่นบอสให้ได้ 1 ครั้ง 👑',
        total: 1,
        progressFrom(ev, st){
          if (ev?.detail?.kind === 'boss_down') st._bd = 1;
          return st._bd ? 1 : 0;
        }
      }
    ];
  }

  // -------- No-Junk mini (special / interrupt) --------
  function startNoJunkMini(st, durMs){
    st.noJunk.active = true;
    st.noJunk.failed = false;
    st.noJunk.startedAt = now();
    st.noJunk.durMs = Math.max(3000, Number(durMs||7000));
    st.noJunk.endsAt = st.noJunk.startedAt + st.noJunk.durMs;

    emit('hha:judge', { kind:'mini', text:'⛔ NO-JUNK CHALLENGE!' });
  }

  function stopNoJunkMini(st, result){
    st.noJunk.active = false;

    if (result === 'pass'){
      st.miniCleared++;
      emit('hha:celebrate', { kind:'mini', title:'NO-JUNK PASS!' });

      // ✅ reward to engine
      emit('groups:reward', {
        type: 'nojunk_pass',
        scoreBonus: 420,
        giveShield: 1,
        feverDelta: -10
      });
    } else if (result === 'fail'){
      emit('hha:celebrate', { kind:'mini', title:'NO-JUNK FAIL!' });
    }
  }

  function pushUpdate(st){
    // GOAL
    const goalTitle = `สลับหมู่ให้ครบ ${st.goalsTotal} ครั้ง 🎵`;
    const goalNow = clamp(st.goalsCleared, 0, st.goalsTotal);
    const goalPct = (goalNow / Math.max(1, st.goalsTotal)) * 100;

    // MINI (priority: No-Junk if active)
    let miniTitle = '—';
    let miniNow = 0, miniTotal = 1, miniPct = 0;
    let miniTimeLeftSec = 0;

    if (st.noJunk.active){
      miniTitle = 'NO-JUNK: อยู่รอด 7 วิ (ห้ามโดนขยะ) ⛔';
      const t = now();
      const leftMs = Math.max(0, st.noJunk.endsAt - t);
      miniTimeLeftSec = Math.ceil(leftMs/1000);
      miniTotal = 7;
      miniNow = clamp(((st.noJunk.durMs - leftMs)/1000), 0, 7);
      miniPct = clamp((miniNow / 7) * 100, 0, 100);
    } else if (st.activeMini){
      miniTitle = st.activeMini.title;
      miniTotal = st.activeMini.total;
      miniNow = clamp(st.activeMini.now, 0, miniTotal);
      miniPct = (miniNow / Math.max(1, miniTotal)) * 100;
    }

    emit('quest:update', {
      goalTitle,
      goalNow, goalTotal: st.goalsTotal, goalPct,
      miniTitle,
      miniNow, miniTotal, miniPct,
      miniTimeLeftSec
    });
  }

  function pickNextMini(st){
    const pool = st.miniPool;
    // reset temp trackers for fresh mini
    st._comboNow = 0;
    st._ps = 0;
    st._bd = 0;

    const idx = Math.floor(st.rng() * pool.length);
    const base = pool[idx];
    st.activeMini = {
      id: base.id,
      title: base.title,
      total: base.total,
      now: 0,
      _base: base
    };
    pushUpdate(st);
  }

  function createGroupsQuest(opts){
    opts = opts || {};
    const seed = String(opts.seed || Date.now());
    const rng = makeRng(seed);

    const st = {
      runMode: (String(opts.runMode||'play').toLowerCase()==='research') ? 'research' : 'play',
      diff: String(opts.diff||'normal').toLowerCase(),
      style: String(opts.style||'mix').toLowerCase(),
      seed,
      rng,

      goalsCleared: 0,
      goalsTotal: goalTotalByDiff(opts.diff),

      miniCleared: 0,
      miniTotal: 999,

      miniPool: makeMiniPool(),
      activeMini: null,

      noJunk: {
        active:false,
        failed:false,
        startedAt:0,
        durMs:7000,
        endsAt:0
      },

      _timer: 0,
      _started:false
    };

    function start(){
      if (st._started) return;
      st._started = true;

      // pick first mini
      pickNextMini(st);

      // timer for No-Junk countdown updates
      st._timer = root.setInterval(()=>{
        if (st.noJunk.active){
          // auto pass when time reaches 0 (engine will also send nojunk_off, but this is safety)
          const left = st.noJunk.endsAt - now();
          if (left <= 0 && !st.noJunk.failed){
            stopNoJunkMini(st, 'pass');
          }
        }
        pushUpdate(st);
      }, 220);

      pushUpdate(st);
    }

    function stop(){
      try{ root.clearInterval(st._timer); }catch{}
      st._timer = 0;
      st._started = false;
    }

    function onProgress(ev){
      const d = ev && ev.detail ? ev.detail : {};

      // GOAL clear condition: group swap increments
      if (d.kind === 'group_swap'){
        st.goalsCleared = clamp(st.goalsCleared + 1, 0, st.goalsTotal);
        if (st.goalsCleared >= st.goalsTotal){
          emit('hha:celebrate', { kind:'goal', title:'GOAL COMPLETE!' });
        } else {
          emit('hha:celebrate', { kind:'goal', title:`GOAL +1 (${st.goalsCleared}/${st.goalsTotal})` });
        }
      }

      // No-Junk mini lifecycle (interrupt)
      if (d.kind === 'nojunk_on'){
        startNoJunkMini(st, d.durMs || 7000);
      }
      if (d.kind === 'nojunk_fail'){
        if (st.noJunk.active && !st.noJunk.failed){
          st.noJunk.failed = true;
          stopNoJunkMini(st, 'fail');
        }
      }
      if (d.kind === 'nojunk_off'){
        if (st.noJunk.active){
          if (!st.noJunk.failed) stopNoJunkMini(st, 'pass');
          st.noJunk.active = false;
        }
      }

      // Normal mini progress only if not overridden by No-Junk
      if (!st.noJunk.active && st.activeMini && st.activeMini._base){
        const base = st.activeMini._base;
        const nowVal = base.progressFrom(ev, st);
        st.activeMini.now = clamp(nowVal, 0, st.activeMini.total);

        if (st.activeMini.now >= st.activeMini.total){
          st.miniCleared++;
          emit('hha:celebrate', { kind:'mini', title:'MINI CLEAR!' });

          // chain next mini
          pickNextMini(st);
        }
      }

      pushUpdate(st);
    }

    function getState(){
      return {
        goalsCleared: st.goalsCleared|0,
        goalsTotal: st.goalsTotal|0,
        miniCleared: st.miniCleared|0,
        miniTotal: st.miniTotal|0
      };
    }

    return { start, stop, onProgress, pushUpdate: ()=>pushUpdate(st), getState };
  }

  NS.createGroupsQuest = createGroupsQuest;

})(typeof window !== 'undefined' ? window : globalThis);