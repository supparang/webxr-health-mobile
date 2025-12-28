/* === /herohealth/vr-groups/groups-quests.js ===
Food Groups VR — Quest System (Goals sequential + Minis chain + No-Junk L1/L2)
✅ Emits: quest:update (Goal/Mini title + progress bars + mini timer)
✅ Listens: groups:progress (from GameEngine)
✅ No-Junk Mini:
   - starts on {kind:'nojunk_on', level, durMs}
   - FAIL on {kind:'nojunk_fail'}
   - PASS on {kind:'nojunk_off'} (if not failed)
   - PASS => dispatch 'groups:reward' (score bonus + shield + fever reduction + gradeBoostSec)
✅ Extra mini: "Streak 6 in 4s" (no miss during mini)
*/

(function(root){
  'use strict';

  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{ detail: detail||{} })); }catch{} };

  // seeded rng
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

  // ------------------ Mini pool ------------------
  function makeMiniPool(){
    return [
      {
        id:'combo8',
        title:'ทำคอมโบให้ถึง 8 ครั้งติด 🔥',
        total: 8,
        reset(st){ st._comboNow = 0; },
        progressFrom(ev, st){
          if (ev?.detail?.kind === 'combo'){
            st._comboNow = Math.max(st._comboNow||0, Number(ev.detail.combo||0));
          }
          return clamp(st._comboNow||0, 0, 8);
        }
      },
      {
        id:'streak6_4s',
        title:'Streak: โดนถูก 6 ครั้งใน 4 วิ (ห้ามพลาด!) ⚡',
        total: 6,
        reset(st){
          st._streakStartAt = 0;
          st._streakNow = 0;
          st._streakDead = false;
        },
        progressFrom(ev, st){
          const k = ev?.detail?.kind;
          const t = now();

          if (k === 'hit_bad'){
            st._streakDead = true;
            st._streakNow = 0;
            st._streakStartAt = 0;
            return 0;
          }

          if (k === 'hit_good'){
            if (st._streakDead) return 0;

            if (!st._streakStartAt){
              st._streakStartAt = t;
              st._streakNow = 1;
            } else {
              const dt = t - st._streakStartAt;
              if (dt > 4000){
                st._streakStartAt = t;
                st._streakNow = 1;
              } else {
                st._streakNow = (st._streakNow||0) + 1;
              }
            }
          }

          const dt = st._streakStartAt ? (t - st._streakStartAt) : 0;
          if (dt > 4000){
            st._streakStartAt = 0;
            st._streakNow = 0;
          }

          return clamp(st._streakNow||0, 0, 6);
        }
      },
      {
        id:'perfectSwitch',
        title:'สลับหมู่แบบ Perfect (ก่อนสลับห้ามพลาด) 🌟',
        total: 1,
        reset(st){ st._ps = 0; },
        progressFrom(ev, st){
          if (ev?.detail?.kind === 'perfect_switch') st._ps = 1;
          return st._ps ? 1 : 0;
        }
      },
      {
        id:'bossDown',
        title:'โค่นบอสให้ได้ 1 ครั้ง 👑',
        total: 1,
        reset(st){ st._bd = 0; },
        progressFrom(ev, st){
          if (ev?.detail?.kind === 'boss_down') st._bd = 1;
          return st._bd ? 1 : 0;
        }
      }
    ];
  }

  // -------- No-Junk mini (special / interrupt) --------
  function startNoJunkMini(st, level, durMs){
    st.noJunk.active = true;
    st.noJunk.failed = false;
    st.noJunk.level = clamp(level||1, 1, 2);
    st.noJunk.startedAt = now();

    const base = (st.noJunk.level === 2) ? 9000 : 7000;
    st.noJunk.durMs = Math.max(3000, Number(durMs||base));
    st.noJunk.endsAt = st.noJunk.startedAt + st.noJunk.durMs;

    emit('hha:judge', { kind:'mini', text: (st.noJunk.level===2 ? '⛔ NO-JUNK L2!' : '⛔ NO-JUNK L1!') });
  }

  function stopNoJunkMini(st, result){
    st.noJunk.active = false;

    if (result === 'pass'){
      st.miniCleared++;
      emit('hha:celebrate', { kind:'mini', title:(st.noJunk.level===2 ? 'NO-JUNK L2 PASS!' : 'NO-JUNK PASS!') });

      // ✅ reward to engine (bigger on L2)
      const bonus = (st.noJunk.level===2) ? 680 : 420;
      const feverDelta = (st.noJunk.level===2) ? -16 : -10;
      const gradeBoostSec = (st.noJunk.level===2) ? 9 : 6;

      emit('groups:reward', {
        type: 'nojunk_pass',
        level: st.noJunk.level,
        scoreBonus: bonus,
        giveShield: 1,
        feverDelta,
        gradeBoostSec
      });
    } else if (result === 'fail'){
      emit('hha:celebrate', { kind:'mini', title:(st.noJunk.level===2 ? 'NO-JUNK L2 FAIL!' : 'NO-JUNK FAIL!') });
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
      const lvl = st.noJunk.level || 1;
      miniTitle = (lvl===2)
        ? 'NO-JUNK L2: อยู่รอด 9 วิ (ห้ามโดนขยะ) ⛔🔥'
        : 'NO-JUNK L1: อยู่รอด 7 วิ (ห้ามโดนขยะ) ⛔';

      const t = now();
      const leftMs = Math.max(0, st.noJunk.endsAt - t);
      miniTimeLeftSec = Math.ceil(leftMs/1000);

      miniTotal = (lvl===2) ? 9 : 7;
      miniNow = clamp(((st.noJunk.durMs - leftMs)/1000), 0, miniTotal);
      miniPct = clamp((miniNow / miniTotal) * 100, 0, 100);
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
    for (const m of pool){
      try{ m.reset && m.reset(st); }catch{}
    }

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

      noJunk: { active:false, failed:false, level:1, startedAt:0, durMs:7000, endsAt:0 },

      _timer: 0,
      _started:false
    };

    function start(){
      if (st._started) return;
      st._started = true;

      pickNextMini(st);

      st._timer = root.setInterval(()=>{
        if (st.noJunk.active){
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

      if (d.kind === 'group_swap'){
        st.goalsCleared = clamp(st.goalsCleared + 1, 0, st.goalsTotal);
        emit('hha:celebrate', { kind:'goal', title:`GOAL +1 (${st.goalsCleared}/${st.goalsTotal})` });
      }

      // No-Junk lifecycle
      if (d.kind === 'nojunk_on'){
        startNoJunkMini(st, d.level || 1, d.durMs || undefined);
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

      // Active mini progress (skip while No-Junk running)
      if (!st.noJunk.active && st.activeMini && st.activeMini._base){
        const base = st.activeMini._base;
        const nowVal = base.progressFrom(ev, st);
        st.activeMini.now = clamp(nowVal, 0, st.activeMini.total);

        if (st.activeMini.now >= st.activeMini.total){
          st.miniCleared++;
          emit('hha:celebrate', { kind:'mini', title:'MINI CLEAR!' });
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