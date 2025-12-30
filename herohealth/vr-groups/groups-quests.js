/* === /herohealth/vr-groups/groups-quests.js ===
GroupsVR Quest System
✅ Goals sequential + Minis chain (timed)
✅ Mini: No-Junk Zone (visible circle) — hit N good inside zone within T sec, no bad during mini
✅ Emits: quest:update, groups:zone, groups:setZone, groups:mini_urgent
*/

(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{ detail: detail||{} })); }catch{} };

  // seeded rng (same style as engine)
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
    return sfc32(g(),g(),g(),g());
  }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }

  function diffTuning(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff==='easy')   return { goalHit: 12, goalCombo: 8,  miniRushN:4, miniRushT:9,  zoneN:5, zoneT:8, zoneR:155 };
    if (diff==='hard')   return { goalHit: 18, goalCombo: 12, miniRushN:6, miniRushT:7,  zoneN:7, zoneT:7, zoneR:130 };
    return                { goalHit: 15, goalCombo: 10, miniRushN:5, miniRushT:8,  zoneN:6, zoneT:7, zoneR:140 };
  }

  function safeZonePick(rng, r){
    const W = root.innerWidth || 360;
    const H = root.innerHeight || 640;
    // avoid top HUD and bottom power bar
    const top = 190;
    const bot = 190;
    const side = 24;
    const x = side + r + rng()*(W - (side+r)*2);
    const y = top + r + rng()*(H - top - bot - r*2);
    return { x, y };
  }

  NS.createGroupsQuest = function createGroupsQuest(opts){
    opts = opts || {};
    const runMode = String(opts.runMode||'play').toLowerCase();
    const diff = String(opts.diff||'normal').toLowerCase();
    const style = String(opts.style||'mix').toLowerCase();
    const seed = String(opts.seed||Date.now());
    const rng = makeRng(seed + '|quest');

    const T = diffTuning(diff);

    const S = {
      started:false,
      stopped:false,
      goalsCleared:0,
      goalsTotal:3,
      miniCleared:0,
      miniTotal:999,

      // goal states
      goalIndex:0,
      goal: null,

      // mini
      mini: null,
      miniIdx: 0,
      miniOrder: [],

      // live counters
      hitGood:0,
      hitBad:0,
      comboMax:0,
      inStorm:false,
      bossDown:0,

      // mini timer
      miniEndAt:0,
      miniLastUrgent:false,

      // no-junk mini
      zoneOn:false,
      zone:{ x:0,y:0,r:140 },
      zoneCount:0,
      noJunkActive:false
    };

    const GOALS = [
      ()=>({ key:'hit',  title:`เก็บของดีให้ได้ ${T.goalHit} ครั้ง`, now:0, total:T.goalHit }),
      ()=>({ key:'combo',title:`ทำ COMBO ให้ถึง ${T.goalCombo}`, now:0, total:T.goalCombo }),
      ()=>({ key:'boss', title:`โค่น BOSS ให้ได้ 1 ครั้ง`, now:0, total:1 }),
    ];

    // minis: แทรก “No-Junk Zone” + Rush ให้มันส์
    const MINIS = [
      { key:'rush', title:`RUSH! เก็บดี ${T.miniRushN} ภายใน ${T.miniRushT}s (ห้ามพลาด)`, n:T.miniRushN, t:T.miniRushT, noBad:true },
      { key:'zone', title:`NO-JUNK ZONE! เก็บดี ${T.zoneN} ในโซน ภายใน ${T.zoneT}s (ห้ามโดนขยะ)`, n:T.zoneN, t:T.zoneT, noBad:true },
    ];

    function pushUpdate(){
      const g = S.goal;
      const m = S.mini;

      const goalPct = g ? clamp((g.now/Math.max(1,g.total))*100, 0, 100) : 0;

      let miniPct = 0;
      let miniLeft = 0;
      if (m && S.miniEndAt > 0){
        miniLeft = Math.max(0, Math.ceil((S.miniEndAt - now())/1000));
        if (m.key === 'rush') miniPct = clamp((m.now/m.total)*100,0,100);
        if (m.key === 'zone') miniPct = clamp((S.zoneCount/m.total)*100,0,100);

        // urgent event (<=3s)
        const urgent = miniLeft > 0 && miniLeft <= 3;
        if (urgent && !S.miniLastUrgent){
          S.miniLastUrgent = true;
          emit('groups:mini_urgent', { on:true, left:miniLeft });
        }
        if (!urgent) S.miniLastUrgent = false;
      }

      emit('quest:update', {
        goalTitle: g ? g.title : '—',
        goalNow:   g ? g.now : 0,
        goalTotal: g ? g.total : 1,
        goalPct,

        miniTitle: m ? m.title : '—',
        miniNow:   m ? (m.key==='zone'?S.zoneCount:m.now) : 0,
        miniTotal: m ? m.total : 1,
        miniPct,
        miniTimeLeftSec: miniLeft
      });
    }

    function nextGoal(){
      if (S.goalIndex >= GOALS.length){
        // done goals
        return;
      }
      const g = GOALS[S.goalIndex]();
      S.goal = { ...g, done:false };
      pushUpdate();
    }

    function passGoal(){
      if (!S.goal || S.goal.done) return;
      S.goal.done = true;
      S.goalsCleared++;
      S.goalIndex++;
      emit('hha:celebrate', { kind:'goal', title:'GOAL CLEAR!' });
      nextGoal();
    }

    function startMini(def){
      const total = def.n;
      S.mini = { key:def.key, title:def.title, now:0, total, noBad:!!def.noBad, done:false };
      S.miniEndAt = now() + (def.t*1000);
      S.hitBad = 0;
      S.noJunkActive = !!def.noBad;

      // zone mini → show zone + tell engine to validate inside
      if (def.key === 'zone'){
        S.zone.r = T.zoneR;
        const p = safeZonePick(rng, S.zone.r);
        S.zone.x = p.x; S.zone.y = p.y;
        S.zoneCount = 0;
        S.zoneOn = true;
        emit('groups:zone', { on:true, x:S.zone.x, y:S.zone.y, r:S.zone.r });
        emit('groups:setZone', { on:true, x:S.zone.x, y:S.zone.y, r:S.zone.r });
      } else {
        S.zoneOn = false;
        emit('groups:zone', { on:false });
        emit('groups:setZone', { on:false });
      }

      emit('hha:judge', { kind:'good', text:'MINI START!' });
      pushUpdate();
    }

    function endMini(pass, reason){
      if (!S.mini || S.mini.done) return;
      S.mini.done = true;
      S.miniEndAt = 0;

      // clear zone overlay
      if (S.zoneOn){
        S.zoneOn = false;
        emit('groups:zone', { on:false });
        emit('groups:setZone', { on:false });
      }

      if (pass){
        S.miniCleared++;
        emit('groups:progress', { kind:'nojunk_clear', reason: reason||'pass' });
        emit('hha:celebrate', { kind:'mini', title:'MINI CLEAR!' });
      } else {
        emit('groups:progress', { kind:'nojunk_fail', reason: reason||'fail' });
        emit('hha:judge', { kind:'bad', text:'MINI FAIL!' });
      }
      S.mini = null;
      pushUpdate();
    }

    function scheduleMinis(){
      // deterministic order in research, random-ish in play
      const order = [0,1];
      if (runMode !== 'research' && rng() < 0.5) order.reverse();
      S.miniOrder = order;
      S.miniIdx = 0;
    }

    function maybeStartNextMini(){
      if (S.mini) return;
      // start a mini every ~18–24 seconds (feel) or fixed in research
      const wants = (runMode === 'research') ? true : (rng() < 0.45);
      if (!wants) return;

      const def = MINIS[ S.miniOrder[S.miniIdx % S.miniOrder.length] ];
      S.miniIdx++;
      startMini(def);

      // auto timeout check
      const tick = ()=>{
        if (!S.mini) return;
        const leftMs = S.miniEndAt - now();
        if (leftMs <= 0){
          endMini(false, 'timeout');
          return;
        }
        pushUpdate();
        setTimeout(tick, 220);
      };
      setTimeout(tick, 240);
    }

    function onProgress(ev){
      if (S.stopped) return;
      const d = (ev && ev.detail) ? ev.detail : {};
      const kind = String(d.kind||'');

      // hit stats & goal update inputs
      if (kind === 'combo') S.comboMax = Math.max(S.comboMax, Number(d.combo||0));
      if (kind === 'storm_on') S.inStorm = true;
      if (kind === 'storm_off') S.inStorm = false;
      if (kind === 'boss_down') { S.bossDown++; }

      // ✅ Good/bad hits (from engine)
      if (kind === 'hit_good'){
        S.hitGood++;

        // goal 1: hit count
        if (S.goal && S.goal.key==='hit' && !S.goal.done){
          S.goal.now = clamp(S.hitGood, 0, S.goal.total);
          if (S.goal.now >= S.goal.total) passGoal();
        }

        // mini rush: count any good (but fail on bad)
        if (S.mini && S.mini.key==='rush'){
          S.mini.now = clamp(S.mini.now + 1, 0, S.mini.total);
          if (S.mini.now >= S.mini.total) endMini(true, 'rush');
        }

        // mini zone: count only inside
        if (S.mini && S.mini.key==='zone'){
          const inside = !!d.insideZone;
          if (inside){
            S.zoneCount = clamp(S.zoneCount + 1, 0, S.mini.total);
            if (S.zoneCount >= S.mini.total) endMini(true, 'zone');
          }
        }

        pushUpdate();
        return;
      }

      if (kind === 'hit_bad'){
        S.hitBad++;

        // goal doesn't fail, but mini can fail
        if (S.mini && S.mini.noBad){
          endMini(false, 'hit_bad');
        }
        pushUpdate();
        return;
      }

      // goal 2: combo
      if (S.goal && S.goal.key==='combo' && !S.goal.done){
        S.goal.now = clamp(S.comboMax, 0, S.goal.total);
        if (S.goal.now >= S.goal.total) passGoal();
        pushUpdate();
      }

      // goal 3: boss
      if (S.goal && S.goal.key==='boss' && !S.goal.done){
        S.goal.now = clamp(S.bossDown, 0, S.goal.total);
        if (S.goal.now >= S.goal.total) passGoal();
        pushUpdate();
      }

      // start minis opportunistically when something exciting happens
      if (kind === 'storm_on' || kind === 'boss_spawn' || kind === 'powerup_star'){
        maybeStartNextMini();
      }
    }

    function start(){
      if (S.started) return;
      S.started = true;
      scheduleMinis();
      nextGoal();
      // start a first mini sometimes
      setTimeout(()=> maybeStartNextMini(), (runMode==='research'?6500:9000));
    }

    function stop(){
      S.stopped = true;
      // hide zone if active
      emit('groups:zone', { on:false });
      emit('groups:setZone', { on:false });
    }

    function getState(){
      return {
        goalsCleared: S.goalsCleared,
        goalsTotal: S.goalsTotal,
        miniCleared: S.miniCleared,
        miniTotal: S.miniTotal
      };
    }

    return { start, stop, onProgress, getState, pushUpdate };
  };

})(typeof window !== 'undefined' ? window : globalThis);