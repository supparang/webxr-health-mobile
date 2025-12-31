/* === /herohealth/vr-groups/groups-quests.js ===
GroupsVR Quest System — PRODUCTION (Goals + Minis)
✅ Emits: quest:update (for UI)
✅ Listens to: groups:progress from GameEngine (hit_good / hit_bad / group_swap / boss_spawn / boss_down / storm_on/off / combo / perfect_switch)
✅ Deterministic in research via seeded RNG
✅ Mini timer + urgent hint payload (miniTimeLeftSec)
Expose: window.GroupsVR.createGroupsQuest(opts)
*/

(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{ detail: detail||{} })); }catch{} };

  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }

  // ---- seeded RNG (deterministic) ----
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
    const g = xmur3(seed);
    return sfc32(g(), g(), g(), g());
  }
  function pick(rng, arr){
    if (!arr || !arr.length) return null;
    return arr[(rng()*arr.length)|0];
  }
  function pct(n,t){
    t = Math.max(1, Number(t)||1);
    n = Math.max(0, Number(n)||0);
    return clamp((n/t)*100, 0, 100);
  }

  function diffNorm(d){
    d = String(d||'normal').toLowerCase();
    return (d==='easy'||d==='normal'||d==='hard') ? d : 'normal';
  }

  function cfgByDiff(diff){
    diff = diffNorm(diff);
    if (diff==='easy')   return { goalHits:22, goalSwaps:3, goalBoss:1, sprintNeed:5, sprintSec:8, nojunkSec:7, comboNeed:7, comboSec:10, stormNeed:5, bossBurstNeed:2, bossBurstSec:5 };
    if (diff==='hard')   return { goalHits:36, goalSwaps:5, goalBoss:2, sprintNeed:7, sprintSec:7, nojunkSec:9, comboNeed:10, comboSec:10, stormNeed:7, bossBurstNeed:3, bossBurstSec:5 };
    return                { goalHits:28, goalSwaps:4, goalBoss:2, sprintNeed:6, sprintSec:7, nojunkSec:8, comboNeed:8, comboSec:10, stormNeed:6, bossBurstNeed:2, bossBurstSec:5 };
  }

  function createGroupsQuest(opts){
    opts = opts || {};
    const runMode = (String(opts.runMode||'play').toLowerCase()==='research') ? 'research' : 'play';
    const diff    = diffNorm(opts.diff || 'normal');
    const style   = String(opts.style||'mix').toLowerCase();
    const seed    = String(opts.seed || Date.now());
    const rng     = makeRng(seed + '::groupsQuest::' + diff + '::' + runMode);

    const CFG = cfgByDiff(diff);

    const Q = {
      started:false,
      stopped:false,

      // goals (sequential)
      goals:[
        { key:'hit',  title:`ยิงถูก (GOOD) ให้ครบ ${CFG.goalHits} ครั้ง`, now:0, total:CFG.goalHits, done:false },
        { key:'swap', title:`สลับหมู่ให้ครบ ${CFG.goalSwaps} ครั้ง`, now:0, total:CFG.goalSwaps, done:false },
        { key:'boss', title:`ปราบบอสให้ครบ ${CFG.goalBoss} ตัว`, now:0, total:CFG.goalBoss, done:false },
      ],
      goalIdx:0,
      goalsCleared:0,
      goalsTotal:3,

      // minis (chain)
      mini:null,
      miniCleared:0,
      miniTotal:999,

      // counters from engine
      hitGood:0,
      swaps:0,
      bossDown:0,

      // storm state
      stormOn:false,
      stormGood:0,
      stormBad:false,

      // mini timing
      _miniStartMs:0,
      _miniEndMs:0,
      _lastBadAt:0,
      _lastCombo:0,
      _bossSpawnAt:0,
      _bossHitsInWindow:0,

      _tick:0
    };

    function activeGoal(){ return Q.goals[Q.goalIdx] || null; }
    function miniTimeLeftSec(){
      if (!Q.mini || !Q.mini.timer) return 0;
      const left = (Q._miniEndMs - now())/1000;
      return Math.max(0, Math.ceil(left));
    }

    function pushUpdate(extra){
      const g = activeGoal();
      const m = Q.mini;
      emit('quest:update', Object.assign({
        goalTitle: g ? g.title : '—',
        goalNow:   g ? g.now   : 0,
        goalTotal: g ? g.total : 1,
        goalPct:   g ? pct(g.now, g.total) : 0,

        miniTitle: m ? m.title : '—',
        miniNow:   m ? (m.now||0) : 0,
        miniTotal: m ? (m.total||1) : 1,
        miniPct:   m ? pct(m.now||0, m.total||1) : 0,
        miniTimeLeftSec: miniTimeLeftSec()
      }, extra||{}));
    }

    function celebrate(kind, title){
      emit('hha:celebrate', { kind: kind||'mini', title: title||'CLEAR!' });
    }

    function completeGoal(){
      const g = activeGoal();
      if (!g || g.done) return;
      g.done = true;
      Q.goalsCleared++;
      celebrate('goal', 'GOAL COMPLETE! ✅');
      Q.goalIdx = Math.min(Q.goals.length-1, Q.goalIdx + 1);
      pushUpdate();
    }

    function syncGoals(){
      const g0 = Q.goals[0];
      if (g0 && !g0.done){
        g0.now = clamp(Q.hitGood, 0, g0.total);
        if (g0.now >= g0.total) completeGoal();
      }
      const g1 = Q.goals[1];
      if (g1 && !g1.done){
        g1.now = clamp(Q.swaps, 0, g1.total);
        if (g1.now >= g1.total) completeGoal();
      }
      const g2 = Q.goals[2];
      if (g2 && !g2.done){
        g2.now = clamp(Q.bossDown, 0, g2.total);
        if (g2.now >= g2.total) completeGoal();
      }
    }

    function clearMini(kind, title){
      Q.mini = null;
      if (kind==='clear') Q.miniCleared++;
      pushUpdate({ miniTitle: title||'—', miniNow:0, miniTotal:1, miniPct:0, miniTimeLeftSec:0 });
      // next mini
      root.setTimeout(()=>{ if (!Q.stopped) ensureMini(); }, 520);
    }

    function winMini(title){
      celebrate('mini', title || 'MINI CLEAR! ⚡');
      clearMini('clear', title || 'MINI CLEAR! ⚡');
    }

    function failMini(reason){
      emit('hha:judge', { kind:'MISS', text:`MINI FAIL: ${reason||'fail'}` });
      clearMini('fail', 'ลองใหม่! 💥');
    }

    function buildMiniPool(){
      const pool = [];

      // 1) No Junk Zone (timer) — ห้าม hit_bad ระหว่างทำ
      pool.push({
        key:'nojunk',
        title:`NO-JUNK ${CFG.nojunkSec} วิ (ห้ามพลาด/ห้ามโดนขยะ)`,
        now:0, total:CFG.nojunkSec,
        timer:true,
        forbidBad:true,
        onStart(){
          Q._miniStartMs = now();
          Q._miniEndMs = Q._miniStartMs + CFG.nojunkSec*1000;
        },
        onTick(){
          const left = miniTimeLeftSec();
          this.now = clamp(CFG.nojunkSec - left, 0, this.total);
          if (now() >= Q._miniEndMs) return { done:true };
          return { done:false };
        },
        onBad(){ return { fail:true, reason:'hit_bad' }; }
      });

      // 2) Sprint (timer + count) — ยิงถูก N ใน T วิ ห้าม bad
      pool.push({
        key:'sprint',
        title:`SPRINT! ยิงถูก ${CFG.sprintNeed} ใน ${CFG.sprintSec} วิ (ห้ามพลาด)`,
        now:0, total:CFG.sprintNeed,
        timer:true,
        forbidBad:true,
        onStart(){
          this.now = 0;
          Q._miniStartMs = now();
          Q._miniEndMs = Q._miniStartMs + CFG.sprintSec*1000;
        },
        onGood(){
          this.now = Math.min(this.total, this.now + 1);
          if (this.now >= this.total) return { done:true };
          return { done:false };
        },
        onBad(){ return { fail:true, reason:'hit_bad' }; },
        onTick(){
          if (now() >= Q._miniEndMs) return { fail:true, reason:'time_up' };
          return { done:false };
        }
      });

      // 3) Combo Rush (timer) — ทำ combo ถึง N ภายใน T วิ
      pool.push({
        key:'combo',
        title:`COMBO RUSH! ทำคอมโบให้ถึง ${CFG.comboNeed} ใน ${CFG.comboSec} วิ`,
        now:0, total:CFG.comboNeed,
        timer:true,
        onStart(){
          this.now = 0;
          Q._lastCombo = 0;
          Q._miniStartMs = now();
          Q._miniEndMs = Q._miniStartMs + CFG.comboSec*1000;
        },
        onCombo(c){
          c = Number(c)||0;
          this.now = clamp(c, 0, this.total);
          if (c >= this.total) return { done:true };
          return { done:false };
        },
        onBad(){
          // combo will likely reset; keep going but harder
          return null;
        },
        onTick(){
          if (now() >= Q._miniEndMs) return { fail:true, reason:'time_up' };
          return { done:false };
        }
      });

      // 4) Storm Mini — ตอน storm ต้อง hit_good ให้ครบ X และห้าม bad
      pool.push({
        key:'storm',
        title:`STORM! ยิงถูก ${CFG.stormNeed} ระหว่างพายุ (ห้ามพลาด)`,
        now:0, total:CFG.stormNeed,
        timer:false,
        requireStorm:true,
        onStart(){
          Q.stormGood = 0;
          Q.stormBad = false;
          this.now = 0;
        },
        onGood(){
          Q.stormGood++;
          this.now = clamp(Q.stormGood, 0, this.total);
          if (Q.stormBad) return { fail:true, reason:'hit_bad' };
          if (this.now >= this.total) return { done:true };
          return { done:false };
        },
        onBad(){ Q.stormBad = true; return { fail:true, reason:'hit_bad' }; },
        onStormOff(){
          if (this.now >= this.total && !Q.stormBad) return { done:true };
          return { fail:true, reason:'storm_end' };
        }
      });

      // 5) Boss Burst — หลัง boss_spawn ให้ “ยิงบอส” X ครั้งภายใน T วิ
      pool.push({
        key:'bossburst',
        title:`BOSS BURST! ยิงบอส ${CFG.bossBurstNeed} ครั้งใน ${CFG.bossBurstSec} วิ`,
        now:0, total:CFG.bossBurstNeed,
        timer:true,
        requireBoss:true,
        onStart(){
          this.now = 0;
          Q._bossHitsInWindow = 0;
          Q._miniStartMs = now();
          Q._miniEndMs = Q._miniStartMs + CFG.bossBurstSec*1000;
        },
        onBossHit(){
          Q._bossHitsInWindow++;
          this.now = clamp(Q._bossHitsInWindow, 0, this.total);
          if (this.now >= this.total) return { done:true };
          return { done:false };
        },
        onTick(){
          if (now() >= Q._miniEndMs) return { fail:true, reason:'time_up' };
          return { done:false };
        }
      });

      // 6) Perfect Switch (no timer) — ได้ perfect_switch 1 ครั้ง
      pool.push({
        key:'perfect',
        title:`Perfect Switch! ทำให้ได้ 1 ครั้ง (สลับหมู่แบบไร้ที่ติ)`,
        now:0, total:1,
        timer:false,
        onStart(){ this.now = 0; },
        onPerfect(){
          this.now = 1;
          return { done:true };
        }
      });

      return pool;
    }

    function ensureMini(){
      if (Q.mini) return Q.mini;

      const pool = buildMiniPool();

      // สภาวะปัจจุบัน
      const canStorm = Q.stormOn;
      const canBoss  = (Q._bossSpawnAt && (now() - Q._bossSpawnAt) < 9000); // boss recently

      let pickables = pool.slice();

      // filter by state
      pickables = pickables.filter(m=>{
        if (m.requireStorm && !canStorm) return false;
        if (m.requireBoss && !canBoss) return false;
        return true;
      });

      // น้ำหนัก: ตอน storm ให้โผล่ storm บ่อยขึ้น
      if (canStorm && rng() < 0.55){
        pickables = pickables.filter(m=>m.key==='storm');
      }

      // ตอน boss เพิ่งออก ให้ bossburst มีสิทธิ์มากขึ้น
      if (canBoss && rng() < 0.40){
        const bb = pickables.find(m=>m.key==='bossburst');
        if (bb) pickables = [bb];
      }

      // เลือก
      Q.mini = pick(rng, pickables) || pool[0];

      // init timer
      Q._miniStartMs = 0;
      Q._miniEndMs = 0;

      try{ Q.mini.onStart && Q.mini.onStart(); }catch{}
      pushUpdate();
      return Q.mini;
    }

    function tickMini(){
      if (!Q.started || Q.stopped) return;
      const m = Q.mini;
      if (!m) return;

      if (m.timer && typeof m.onTick === 'function'){
        const r = m.onTick();
        if (r && r.done){ winMini('TIME CLEAR! ⏱️'); return; }
        if (r && r.fail){ failMini(r.reason||'time'); return; }
      }
      pushUpdate();
    }

    function onProgress(ev){
      if (!Q.started || Q.stopped) return;
      const d = (ev && ev.detail) ? ev.detail : {};
      const kind = String(d.kind||'').toLowerCase();

      // state
      if (kind === 'storm_on') Q.stormOn = true;
      if (kind === 'storm_off') Q.stormOn = false;

      if (kind === 'boss_spawn') Q._bossSpawnAt = now();

      // counters for goals
      if (kind === 'hit_good') Q.hitGood++;
      if (kind === 'group_swap') Q.swaps++;
      if (kind === 'boss_down') Q.bossDown++;

      syncGoals();

      // ensure mini
      const m = ensureMini();

      // route mini events
      if (kind === 'hit_good'){
        if (m && typeof m.onGood === 'function'){
          const r = m.onGood();
          if (r && r.done){ winMini('SPRINT CLEAR! ⚡'); return; }
          if (r && r.fail){ failMini(r.reason||'bad'); return; }
        }
        // storm mini wants good too
        if (m && m.key==='storm' && typeof m.onGood==='function'){
          const r = m.onGood();
          if (r && r.done){ winMini('STORM CLEAR! 🌩️'); return; }
          if (r && r.fail){ failMini(r.reason||'storm'); return; }
        }
      }

      if (kind === 'hit_bad'){
        if (m && typeof m.onBad === 'function'){
          const r = m.onBad();
          if (r && r.fail){ failMini(r.reason||'hit_bad'); return; }
        }
        if (m && m.forbidBad){
          failMini('hit_bad');
          return;
        }
      }

      if (kind === 'combo'){
        const c = Number(d.combo||0);
        if (m && typeof m.onCombo === 'function'){
          const r = m.onCombo(c);
          if (r && r.done){ winMini('COMBO CLEAR! 🔥'); return; }
        }
      }

      if (kind === 'perfect_switch'){
        if (m && typeof m.onPerfect === 'function'){
          const r = m.onPerfect();
          if (r && r.done){ winMini('PERFECT! ✨'); return; }
        }
      }

      // boss hit marker: GameEngine ส่งมาเป็น progress(type:'hit', correct:true) ไม่ได้ระบุ boss,
      // เราจึงใช้ hha:judge kind:'boss' เป็นตัวเสริมไม่ได้ในที่นี้
      // ทางแก้: ให้ GameEngine ยิง event groups:progress {kind:'boss_hit'} เมื่อ hitBoss()
      if (kind === 'boss_hit'){
        if (m && typeof m.onBossHit === 'function'){
          const r = m.onBossHit();
          if (r && r.done){ winMini('BOSS BURST! 👑'); return; }
        }
      }

      if (kind === 'storm_off'){
        if (m && m.key==='storm' && typeof m.onStormOff === 'function'){
          const r = m.onStormOff();
          if (r && r.done){ winMini('STORM CLEAR! 🌩️'); return; }
          if (r && r.fail){ failMini(r.reason||'storm_end'); return; }
        }
      }

      pushUpdate();
    }

    function start(){
      if (Q.started) return;
      Q.started = true;
      Q.stopped = false;

      // reset
      Q.goalIdx = 0;
      Q.goalsCleared = 0;
      Q.goals.forEach(g=>{ g.done=false; g.now=0; });

      Q.mini = null;
      Q.miniCleared = 0;

      Q.hitGood = 0;
      Q.swaps = 0;
      Q.bossDown = 0;

      Q.stormOn = false;
      Q._bossSpawnAt = 0;

      pushUpdate();

      Q._tick = root.setInterval(tickMini, 200);
    }

    function stop(){
      Q.stopped = true;
      try{ root.clearInterval(Q._tick); }catch{}
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