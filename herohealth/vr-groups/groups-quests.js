/* === /herohealth/vr-groups/groups-quests.js ===
GroupsVR Quest System — FUN PACK (Goals + Minis) [PATCHED]
✅ Emits quest:update (for UI)
✅ Uses groups:progress from GameEngine
✅ FUN:
  (1) Boss Pattern support: count boss_spawn/boss_down + boss pressure mini
  (2) Mini "Group Sprint" (เฉพาะหมู่): hit_good N ใน T วิ, ห้ามพลาด/ห้ามโดน junk/wrong/decoy + ห้าม swap
  (3) Perfect Chain x3 -> Overdrive buff (groups:buff {type:'overdrive'})
  (4) Storm mini: during storm hit_good X (fail if storm ends early)
✅ FIX:
  - avoid calling onBad twice
  - mini clear titles by type
*/

(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{ detail: detail||{} })); }catch{} };

  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }

  function diffNorm(d){
    d = String(d||'normal').toLowerCase();
    if (d==='easy'||d==='normal'||d==='hard') return d;
    return 'normal';
  }

  function cfgByDiff(diff){
    diff = diffNorm(diff);
    if (diff==='easy') return {
      goals: { swaps: 4, goodHits: 24, bosses: 1 },
      minis: {
        sprintNeed: 5, sprintSec: 8,
        nojunkSec: 7,
        perfectNeed: 3,
        stormNeed: 5,
        bossNeed: 3, bossSec: 10
      }
    };
    if (diff==='hard') return {
      goals: { swaps: 6, goodHits: 38, bosses: 2 },
      minis: {
        sprintNeed: 7, sprintSec: 7,
        nojunkSec: 9,
        perfectNeed: 3,
        stormNeed: 7,
        bossNeed: 4, bossSec: 9
      }
    };
    return {
      goals: { swaps: 5, goodHits: 30, bosses: 2 },
      minis: {
        sprintNeed: 6, sprintSec: 7,
        nojunkSec: 8,
        perfectNeed: 3,
        stormNeed: 6,
        bossNeed: 4, bossSec: 10
      }
    };
  }

  function pct(n, t){
    t = Math.max(1, Number(t)||1);
    n = Math.max(0, Number(n)||0);
    return clamp((n/t)*100, 0, 100);
  }

  function fmtMiniCountdown(sec){
    sec = Math.max(0, Math.ceil(Number(sec)||0));
    return sec;
  }

  function makeGoalList(cfg){
    return [
      { key:'swap',  title:`สลับให้ครบ ${cfg.goals.swaps} ครั้ง`, now:0, total:cfg.goals.swaps, done:false },
      { key:'hit',   title:`ยิงถูก ${cfg.goals.goodHits} ครั้ง`, now:0, total:cfg.goals.goodHits, done:false },
      { key:'boss',  title:`ปราบบอส ${cfg.goals.bosses} ตัว`, now:0, total:cfg.goals.bosses, done:false },
    ];
  }

  function randPick(rng, arr){
    if (!arr || !arr.length) return null;
    return arr[(rng()*arr.length)|0];
  }

  // ---------- Seeded RNG ----------
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

  function createGroupsQuest(opts){
    opts = opts || {};
    const runMode = (String(opts.runMode||'play').toLowerCase()==='research') ? 'research' : 'play';
    const diff = diffNorm(opts.diff || 'normal');
    const style = String(opts.style||'mix').toLowerCase();
    const seed = String(opts.seed || Date.now());
    const rng = makeRng(seed + '::quest');

    const cfg = cfgByDiff(diff);

    const Q = {
      started:false,
      stopped:false,

      goals: makeGoalList(cfg),
      goalIdx: 0,
      goalsCleared:0,
      goalsTotal:3,

      mini: null,
      miniCleared:0,
      miniTotal:999,

      // counters
      swaps:0,
      hitGood:0,
      bossesDown:0,

      // boss lifecycle
      bossesSpawned:0,
      bossAlive:false,

      // perfect chain
      perfectChain:0,
      lastPerfectAt:0,

      // storm state
      stormOn:false,

      // mini timers
      _miniStartMs:0,
      _miniEndsMs:0,
    };

    function activeGoal(){ return Q.goals[Q.goalIdx] || null; }

    function pushUpdate(extra){
      const g = activeGoal();
      const m = Q.mini;

      const payload = Object.assign({
        goalTitle: g ? g.title : '—',
        goalNow: g ? g.now : 0,
        goalTotal: g ? g.total : 1,
        goalPct: g ? pct(g.now, g.total) : 0,

        miniTitle: m ? m.title : '—',
        miniNow: m ? m.now : 0,
        miniTotal: m ? m.total : 1,
        miniPct: m ? pct(m.now, m.total) : 0,
        miniTimeLeftSec: (m && m.timer) ? fmtMiniCountdown((Q._miniEndsMs - now())/1000) : 0
      }, extra||{});

      emit('quest:update', payload);
    }

    function completeGoal(){
      const g = activeGoal();
      if (!g || g.done) return;
      g.done = true;
      Q.goalsCleared++;

      emit('hha:celebrate', { kind:'goal', title:'GOAL COMPLETE!' });

      // move next goal if any
      if (Q.goalIdx < Q.goals.length-1) Q.goalIdx++;
      pushUpdate();
    }

    function updateGoalsFromCounters(){
      // goal 1 swap
      const g0 = Q.goals[0];
      if (g0 && !g0.done){
        g0.now = clamp(Q.swaps, 0, g0.total);
        if (g0.now >= g0.total) completeGoal();
      }
      // goal 2 hits
      const g1 = Q.goals[1];
      if (g1 && !g1.done){
        g1.now = clamp(Q.hitGood, 0, g1.total);
        if (g1.now >= g1.total) completeGoal();
      }
      // goal 3 bosses
      const g2 = Q.goals[2];
      if (g2 && !g2.done){
        g2.now = clamp(Q.bossesDown, 0, g2.total);
        if (g2.now >= g2.total) completeGoal();
      }
    }

    function ensureMini(){
      if (Q.mini) return Q.mini;

      const pool = [];

      // (A) No-Junk timer mini (pressure)
      pool.push({
        key:'nojunk',
        title:`ห้ามพลาด/ห้ามโดนขยะ ${cfg.minis.nojunkSec} วิ`,
        now:0, total:cfg.minis.nojunkSec,
        timer:true,
        forbidBad:true,
        onStart(){
          Q._miniStartMs = now();
          Q._miniEndsMs = Q._miniStartMs + cfg.minis.nojunkSec*1000;
          this.now = 0;
        },
        onTick(){
          const left = Math.max(0, (Q._miniEndsMs - now())/1000);
          this.now = clamp(cfg.minis.nojunkSec - Math.ceil(left), 0, this.total);
          if (now() >= Q._miniEndsMs) return { done:true };
          return { done:false };
        },
        onBad(){ return { fail:true, reason:'hit_bad' }; }
      });

      // (B) Group Sprint — ห้าม bad + ห้าม swap
      pool.push({
        key:'sprint',
        title:`SPRINT หมู่นี้! ยิงถูก ${cfg.minis.sprintNeed} ใน ${cfg.minis.sprintSec} วิ (ห้ามพลาด)`,
        now:0, total:cfg.minis.sprintNeed,
        timer:true,
        forbidBad:true,
        forbidSwap:true,
        onStart(){
          this.now = 0;
          Q._miniStartMs = now();
          Q._miniEndsMs = Q._miniStartMs + cfg.minis.sprintSec*1000;
        },
        onGood(){
          this.now = Math.min(this.total, this.now + 1);
          if (this.now >= this.total) return { done:true };
          return { done:false };
        },
        onBad(){ return { fail:true, reason:'hit_bad' }; },
        onSwap(){ return { fail:true, reason:'group_swap' }; },
        onTick(){
          if (now() >= Q._miniEndsMs) return { fail:true, reason:'time_up' };
          return { done:false };
        }
      });

      // (C) Storm mini — ต้องอยู่ใน storm
      pool.push({
        key:'stormhit',
        title:`STORM! ยิงถูก ${cfg.minis.stormNeed} ระหว่างพายุ`,
        now:0, total:cfg.minis.stormNeed,
        timer:false,
        requireStorm:true,
        onStart(){ this.now = 0; },
        onGood(){
          this.now = Math.min(this.total, this.now + 1);
          if (this.now >= this.total) return { done:true };
          return { done:false };
        },
        onStormOff(){ return { fail:true, reason:'storm_end' }; }
      });

      // (D) Perfect Chain -> Overdrive
      pool.push({
        key:'perfect3',
        title:`Perfect Switch x${cfg.minis.perfectNeed} = OVERDRIVE!`,
        now:0, total:cfg.minis.perfectNeed,
        timer:true,
        onStart(){
          this.now = 0;
          Q.perfectChain = 0;
          Q._miniStartMs = now();
          Q._miniEndsMs = Q._miniStartMs + 18*1000; // window
        },
        onPerfect(){
          Q.perfectChain = clamp(Q.perfectChain + 1, 0, this.total);
          this.now = Q.perfectChain;
          Q.lastPerfectAt = now();
          if (this.now >= this.total){
            return { done:true, overdrive:true };
          }
          return { done:false };
        },
        onBad(){
          Q.perfectChain = 0;
          this.now = 0;
        },
        onTick(){
          if (now() >= Q._miniEndsMs) return { fail:true, reason:'timeout' };
          return { done:false };
        }
      });

      // (E) Boss pressure — โผล่เมื่อ boss_spawn
      pool.push({
        key:'bosspress',
        title:`BOSS PRESSURE! ยิงถูก ${cfg.minis.bossNeed} ภายใน ${cfg.minis.bossSec} วิ (ระหว่างบอส)`,
        now:0, total:cfg.minis.bossNeed,
        timer:true,
        requireBoss:true,
        forbidBad:true,
        onStart(){
          this.now = 0;
          Q._miniStartMs = now();
          Q._miniEndsMs = Q._miniStartMs + cfg.minis.bossSec*1000;
        },
        onGood(){
          this.now = Math.min(this.total, this.now + 1);
          if (this.now >= this.total) return { done:true };
          return { done:false };
        },
        onBad(){ return { fail:true, reason:'hit_bad' }; },
        onBossDown(){
          // ถ้าบอสตายแต่ทำไม่ทัน = fail (เพิ่มความกดดัน)
          if (this.now >= this.total) return { done:true };
          return { fail:true, reason:'boss_down_early' };
        },
        onTick(){
          if (now() >= Q._miniEndsMs) return { fail:true, reason:'time_up' };
          return { done:false };
        }
      });

      // ------ pick mini by state ------
      let pickables = pool.slice();

      // boss mini only when boss alive
      if (!Q.bossAlive){
        pickables = pickables.filter(m=> !m.requireBoss);
      }

      // storm mini only when storm
      if (!Q.stormOn){
        pickables = pickables.filter(m=> !m.requireStorm);
      } else {
        // ตอน storm: ดันให้ stormhit โผล่บ่อยขึ้นแบบ deterministic
        if (rng() < 0.55) pickables = pickables.filter(m=> m.key==='stormhit');
      }

      // style tweak: feel -> favor sprint/nojunk, hard -> favor boss/storm
      if (style === 'feel' && rng() < 0.25){
        pickables = pickables.filter(m=> (m.key==='sprint' || m.key==='nojunk' || m.key==='perfect3'));
      }
      if (style === 'hard' && rng() < 0.28){
        pickables = pickables.filter(m=> (m.key==='stormhit' || m.key==='bosspress' || m.key==='sprint'));
      }

      Q.mini = randPick(rng, pickables) || pool[0];
      Q._miniStartMs = 0;
      Q._miniEndsMs = 0;

      try{ Q.mini.onStart && Q.mini.onStart(); }catch{}
      pushUpdate();
      return Q.mini;
    }

    function clearMini(kind, title){
      Q.mini = null;
      if (kind === 'clear') Q.miniCleared++;
      pushUpdate({ miniTitle: title || '—', miniNow:0, miniTotal:1, miniPct:0, miniTimeLeftSec:0 });
      root.setTimeout(()=>{ if (!Q.stopped) ensureMini(); }, 450);
    }

    function winMini(title){
      emit('hha:celebrate', { kind:'mini', title: title || 'MINI CLEAR!' });
      clearMini('clear', title || 'MINI CLEAR!');
    }

    function failMini(reason){
      emit('hha:judge', { kind:'MISS', text:`MINI FAIL: ${reason||'fail'}` });
      clearMini('fail', 'ลองใหม่! 💥');
    }

    function miniWinTitle(m){
      if (!m) return 'MINI CLEAR!';
      if (m.key === 'nojunk') return 'NO-JUNK CLEAR! 🛡️';
      if (m.key === 'sprint') return 'SPRINT CLEAR! ⚡';
      if (m.key === 'stormhit') return 'STORM CLEAR! 🌩️';
      if (m.key === 'perfect3') return 'OVERDRIVE! x2 🔥';
      if (m.key === 'bosspress') return 'BOSS PRESSURE CLEAR! 👑';
      return 'MINI CLEAR!';
    }

    function tickMini(){
      const m = Q.mini;
      if (!m) return;

      if (m.timer && typeof m.onTick === 'function'){
        const r = m.onTick();
        if (r && r.done){
          if (r.overdrive){
            emit('groups:buff', { type:'overdrive', durSec: 8 });
            winMini('OVERDRIVE! x2 🔥');
          } else {
            winMini(miniWinTitle(m));
          }
          return;
        }
        if (r && r.fail){
          failMini(r.reason || 'time');
          return;
        }
      }

      pushUpdate();
    }

    function onProgress(ev){
      if (!Q.started || Q.stopped) return;
      const d = (ev && ev.detail) ? ev.detail : {};
      const kind = String(d.kind||'').toLowerCase();

      // ---- state tracking ----
      if (kind === 'storm_on') Q.stormOn = true;
      if (kind === 'storm_off') Q.stormOn = false;

      if (kind === 'boss_spawn'){
        Q.bossesSpawned++;
        Q.bossAlive = true;
      }
      if (kind === 'boss_down'){
        Q.bossesDown++;
        Q.bossAlive = false;
      }

      // ---- goals counters ----
      if (kind === 'group_swap') Q.swaps++;
      if (kind === 'hit_good') Q.hitGood++;

      updateGoalsFromCounters();

      // ---- ensure mini ----
      const m = ensureMini();

      // ---- route events to mini ----
      if (kind === 'hit_good'){
        if (m && typeof m.onGood === 'function'){
          const r = m.onGood();
          if (r && r.done){
            winMini(miniWinTitle(m));
            return;
          }
        }
      }

      if (kind === 'hit_bad'){
        if (m){
          // ✅ FIX: call onBad ONCE only
          const r = (typeof m.onBad === 'function') ? m.onBad() : null;
          if (m.forbidBad){
            if (r && r.fail){ failMini(r.reason||'bad'); return; }
            if (!r){ failMini('hit_bad'); return; }
          }
        }
      }

      if (kind === 'perfect_switch'){
        if (m && typeof m.onPerfect === 'function'){
          const r = m.onPerfect();
          if (r && r.done){
            emit('groups:buff', { type:'overdrive', durSec: 8 });
            winMini('OVERDRIVE! x2 🔥');
            return;
          }
        }
      }

      if (kind === 'group_swap'){
        if (m && m.forbidSwap){
          const r = (typeof m.onSwap === 'function') ? m.onSwap() : { fail:true, reason:'group_swap' };
          if (r && r.fail){ failMini(r.reason||'swap'); return; }
        }
      }

      if (kind === 'storm_off'){
        if (m && m.requireStorm){
          const r = (typeof m.onStormOff === 'function') ? m.onStormOff() : { fail:true, reason:'storm_end' };
          if (r && r.fail){ failMini(r.reason||'storm_end'); return; }
        }
      }

      if (kind === 'boss_down'){
        if (m && m.requireBoss){
          const r = (typeof m.onBossDown === 'function') ? m.onBossDown() : { fail:true, reason:'boss_down' };
          if (r && r.done){ winMini(miniWinTitle(m)); return; }
          if (r && r.fail){ failMini(r.reason||'boss_down'); return; }
        }
      }

      pushUpdate();
    }

    let _tickTimer = 0;

    function start(){
      if (Q.started) return;
      Q.started = true;
      Q.stopped = false;

      Q.goalsCleared = 0;
      Q.goalIdx = 0;

      Q.mini = null;
      Q.miniCleared = 0;

      Q.swaps = 0;
      Q.hitGood = 0;
      Q.bossesDown = 0;

      Q.bossesSpawned = 0;
      Q.bossAlive = false;

      Q.perfectChain = 0;
      Q.stormOn = false;

      pushUpdate();
      _tickTimer = root.setInterval(()=> tickMini(), 200);
    }

    function stop(){
      Q.stopped = true;
      try{ root.clearInterval(_tickTimer); }catch{}
    }

    function getState(){
      return {
        goalsCleared: Q.goalsCleared|0,
        goalsTotal: Q.goalsTotal|0,
        miniCleared: Q.miniCleared|0,
        miniTotal: Q.miniTotal|0
      };
    }

    return { start, stop, onProgress, pushUpdate, getState };
  }

  NS.createGroupsQuest = createGroupsQuest;

})(typeof window !== 'undefined' ? window : globalThis);