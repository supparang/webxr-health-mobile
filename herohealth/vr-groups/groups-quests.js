/* === /herohealth/vr-groups/groups-quests.js ===
Quest system for GroupsVR
- Goals sequential + Minis chain
- Emits quest:update {goalTitle,goalNow,goalTotal,goalPct, miniTitle, miniNow, miniTotal, miniPct, miniTimeLeftSec}
- Deterministic in research via seed RNG (uses same rng in engine? we use local seeded)
*/
(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch{} };

  // seeded rng local
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

  function diffPick(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff==='easy') return { goalTotal: 3, miniTotal: 6 };
    if (diff==='hard') return { goalTotal: 4, miniTotal: 7 };
    return { goalTotal: 3, miniTotal: 7 };
  }

  NS.createGroupsQuest = function(opts={}){
    const runMode = String(opts.runMode||'play').toLowerCase();
    const diff = String(opts.diff||'normal').toLowerCase();
    const style = String(opts.style||'mix').toLowerCase();
    const seed = String(opts.seed||Date.now());

    const R = makeRng(seed + ':quests');
    const P = diffPick(diff);

    const S = {
      started:false,
      goalsTotal:P.goalTotal,
      goalsCleared:0,
      miniTotal:P.miniTotal,
      miniCleared:0,

      goalTitle:'—',
      goalNow:0, goalNeed:0,

      miniTitle:'—',
      miniNow:0, miniNeed:0,
      miniForbidJunk:false,
      miniTimerEnd:0,

      _activeMini:null,
      _lastUpdateAt:0
    };

    const GOALS = [
      ()=>({ title:'สลับหมู่ให้สำเร็จ 2 ครั้ง', kind:'swap', need:2 }),
      ()=>({ title:'ทำคอมโบถึง 10', kind:'combo', need:10 }),
      ()=>({ title:'เก็บคะแนน +1200', kind:'score', need:1200 }),
      ()=>({ title:'โค่น BOSS 1 ครั้ง', kind:'boss', need:1 }),
    ];

    function pickGoal(i){
      // research: fixed order, play: shuffled-ish
      if (runMode==='research') return GOALS[Math.min(i, GOALS.length-1)]();
      const idx = (i + ((R()*GOALS.length)|0)) % GOALS.length;
      return GOALS[idx]();
    }

    const MINIS = [
      ()=>({ title:'No-Junk 6 วิ: ห้ามโดนขยะ', kind:'nojunk', sec:6, forbidJunk:true }),
      ()=>({ title:'สปีด: ถูก 5 ภายใน 7 วิ', kind:'rush', sec:7, need:5, forbidJunk:false }),
      ()=>({ title:'คอมโบย่อย: ทำ 6 ติด', kind:'miniCombo', need:6 }),
      ()=>({ title:'Boss Pressure: ตีบอส 2 ที', kind:'bossHit', need:2 }),
      ()=>({ title:'หลบกับดัก: อย่าโดน DECOY 5 วิ', kind:'avoidDecoy', sec:5 }),
      ()=>({ title:'Perfect Switch: สลับหมู่แบบไม่พลาด 1 ครั้ง', kind:'perfectSwap', need:1 }),
      ()=>({ title:'Storm Survive: รอด STORM 1 รอบ', kind:'surviveStorm', need:1 }),
    ];

    function pickMini(k){
      if (runMode==='research') return MINIS[Math.min(k, MINIS.length-1)]();
      const idx = (k + ((R()*MINIS.length)|0)) % MINIS.length;
      return MINIS[idx]();
    }

    function pushUpdate(){
      const t = now();
      if (t - S._lastUpdateAt < 60) return;
      S._lastUpdateAt = t;

      let miniTimeLeft = 0;
      if (S.miniTimerEnd > 0){
        miniTimeLeft = Math.max(0, Math.ceil((S.miniTimerEnd - t)/1000));
      }

      emit('quest:update', {
        goalTitle:S.goalTitle,
        goalNow:S.goalNow,
        goalTotal:S.goalNeed,
        goalPct: S.goalNeed ? (S.goalNow/S.goalNeed)*100 : 0,

        miniTitle:S.miniTitle,
        miniNow:S.miniNow,
        miniTotal:S.miniNeed,
        miniPct: S.miniNeed ? (S.miniNow/S.miniNeed)*100 : 0,
        miniTimeLeftSec: miniTimeLeft
      });
    }

    function startGoal(){
      const g = pickGoal(S.goalsCleared);
      S.goalTitle = g.title;
      S.goalNow = 0;
      S.goalNeed = g.need || 1;
      S._goalKind = g.kind;
      pushUpdate();
    }

    function clearGoal(){
      S.goalsCleared++;
      emit('hha:celebrate', { kind:'goal', title:'GOAL COMPLETE!' });
      if (S.goalsCleared >= S.goalsTotal){
        // finish all -> let engine end by time; we still mark all done state
        S.goalTitle = 'ครบทุก GOAL แล้ว!';
        S.goalNow = S.goalNeed;
      }else{
        startGoal();
      }
      pushUpdate();
    }

    function startMini(){
      const m = pickMini(S.miniCleared);
      S._activeMini = m;
      S.miniTitle = m.title;
      S.miniNow = 0;
      S.miniNeed = m.need || 1;
      S.miniForbidJunk = !!m.forbidJunk;

      if (m.sec){
        S.miniTimerEnd = now() + (m.sec*1000);
      }else{
        S.miniTimerEnd = 0;
      }
      pushUpdate();
    }

    function failMini(reason){
      // reset mini progress but keep chain going (fair)
      S.miniNow = 0;
      if (S._activeMini && S._activeMini.sec) S.miniTimerEnd = now() + (S._activeMini.sec*1000);
      emit('hha:judge', { kind:'miss', text:'MINI FAIL' });
      pushUpdate();
    }

    function clearMini(){
      S.miniCleared++;
      emit('hha:celebrate', { kind:'mini', title:'MINI CLEAR!' });

      if (S.miniCleared >= S.miniTotal){
        S.miniTitle = 'Mini ครบแล้ว!';
        S.miniNow = S.miniNeed;
        S.miniTimerEnd = 0;
      }else{
        startMini();
      }
      pushUpdate();
    }

    // Called by engine via groups:progress
    function onProgress(ev){
      const d = (ev && ev.detail) ? ev.detail : {};
      const kind = String(d.kind||'').toLowerCase();

      // Mini timer check
      if (S.miniTimerEnd > 0 && now() > S.miniTimerEnd){
        failMini('timeout');
      }

      // MINI RULE: forbid junk
      if (S.miniForbidJunk && kind==='hit_bad'){
        failMini('junk');
      }

      // Update MINI
      const m = S._activeMini || {};
      if (m.kind === 'nojunk'){
        // pass if survived until timer end with no junk hits
        if (S.miniTimerEnd>0 && now() <= S.miniTimerEnd){
          // nothing, just wait
        } else if (S.miniTimerEnd>0 && now() > S.miniTimerEnd){
          clearMini();
        }
      } else if (m.kind === 'rush'){
        if (kind==='hit_good'){
          S.miniNow++;
          if (S.miniNow >= S.miniNeed && now() <= S.miniTimerEnd){
            clearMini();
          }
        } else if (S.miniTimerEnd>0 && now() > S.miniTimerEnd){
          failMini('rush-timeout');
        }
      } else if (m.kind === 'minicombo'){
        if (kind==='combo'){
          const c = Number(d.combo||0);
          S.miniNow = clamp(c, 0, S.miniNeed);
          if (S.miniNow >= S.miniNeed) clearMini();
        }
        if (kind==='hit_bad') S.miniNow = 0;
      } else if (m.kind === 'bosshit'){
        if (kind==='boss_down'){ S.miniNow = S.miniNeed; clearMini(); }
        // “boss hit” event ไม่ได้ส่งมา เราใช้ judge boss ช่วยได้ แต่ขอให้ engine ส่ง boss_hit ถ้าจะละเอียด
        // ในที่นี้ถือว่า boss_down ก็ผ่านแน่
      } else if (m.kind === 'avoiddecoy'){
        if (!S.miniTimerEnd) S.miniTimerEnd = now() + 5000;
        if (kind==='hit_bad'){ failMini('avoid'); }
        if (S.miniTimerEnd>0 && now() > S.miniTimerEnd){ clearMini(); }
      } else if (m.kind === 'perfectswap'){
        if (kind==='perfect_switch'){ S.miniNow = S.miniNeed; clearMini(); }
      } else if (m.kind === 'survivestorm'){
        if (kind==='storm_off'){ S.miniNow = S.miniNeed; clearMini(); }
      }

      // Update GOAL
      if (S._goalKind === 'swap' && kind==='group_swap'){
        S.goalNow++;
        if (S.goalNow >= S.goalNeed) clearGoal();
      } else if (S._goalKind === 'combo' && kind==='combo'){
        const c = Number(d.combo||0);
        S.goalNow = Math.max(S.goalNow, clamp(c, 0, S.goalNeed));
        if (S.goalNow >= S.goalNeed) clearGoal();
      } else if (S._goalKind === 'score'){
        // engine ไม่ส่ง score ใน progress -> ใช้ hha:score แยก
      } else if (S._goalKind === 'boss' && kind==='boss_down'){
        S.goalNow++;
        if (S.goalNow >= S.goalNeed) clearGoal();
      }

      pushUpdate();
    }

    // Listen score for GOAL score type
    function bindScore(){
      if (S._scoreBound) return;
      S._scoreBound = true;
      root.addEventListener('hha:score', (ev)=>{
        const d = ev.detail||{};
        if (S._goalKind !== 'score') return;
        const sc = Number(d.score||0);
        S.goalNow = clamp(sc, 0, S.goalNeed);
        if (S.goalNow >= S.goalNeed) clearGoal();
        pushUpdate();
      }, { passive:true });
    }

    function start(){
      if (S.started) return;
      S.started = true;
      startGoal();
      startMini();
      bindScore();
      pushUpdate();
    }

    function stop(){
      S.started = false;
    }

    function getState(){
      return {
        goalsCleared:S.goalsCleared,
        goalsTotal:S.goalsTotal,
        miniCleared:S.miniCleared,
        miniTotal:S.miniTotal
      };
    }

    return { start, stop, onProgress, pushUpdate, getState };
  };

})(typeof window!=='undefined'?window:globalThis);