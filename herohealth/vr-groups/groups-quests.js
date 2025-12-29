/* === /herohealth/vr-groups/groups-quests.js ===
GroupsVR Quest System — Goals sequential + Minis chain (B++++)
✅ Mini: Speed / NoJunk / Magnet / RingGuardian / MagnetBoss
✅ Urgency <=4s: tickFast + shake + edge pulse
✅ Directives -> groups:directive (nojunk/magnet/bossMini/storm/bonus/urgent)
✅ Listens -> groups:progress (hit_good(inRing), hit_bad, boss_hit, boss_down, boss_heal)
*/

(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (n,d)=>{ try{ root.dispatchEvent(new CustomEvent(n,{detail:d||{}})); }catch{} };
  const directive = (d)=> emit('groups:directive', d||{});

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }

  function goalNeed(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff==='easy') return 6;
    if (diff==='hard') return 10;
    return 8;
  }

  function miniList(diff){
    diff = String(diff||'normal').toLowerCase();
    const speedNeed = diff==='hard' ? 6 : 5;
    const speedTime = diff==='hard' ? 6 : 7;

    const ringNeed  = diff==='hard' ? 6 : 5;
    const ringTime  = diff==='hard' ? 7 : 8;

    const bossHp    = diff==='easy' ? 3 : (diff==='hard' ? 5 : 4);
    const bossTime  = diff==='hard' ? 9 : 8;

    return [
      { key:'speed', type:'hits', title:`สปีด! เก็บถูก ${speedNeed} ใน ${speedTime} วิ`, need:speedNeed, time:speedTime, forbidBad:false },

      { key:'nojunk', type:'hits', title:`No-Junk Zone! ห้ามโดนขยะ/ผิดใน 6 วิ`, need:4, time:6, forbidBad:true,
        onStart(){ directive({ nojunk:{on:true,r:140,mode:'fair'}, bonus:{mult:1.10} }); },
        onEnd(){ directive({ nojunk:{on:false}, bonus:{mult:1} }); }
      },

      { key:'magnet', type:'hits', title:`MAGNET RUSH! เก็บถูก 6 ใน 7 วิ`, need:6, time:7, forbidBad:false,
        onStart(){ directive({ magnet:{on:true,strength:0.55}, bonus:{mult:1.12} }); },
        onEnd(){ directive({ magnet:{on:false}, bonus:{mult:1} }); }
      },

      // ✅ B++++: Ring Guardian (ต้องเก็บ “ในวง” เท่านั้น)
      { key:'ring', type:'ring_hits', title:`RING GUARDIAN! เก็บถูก ${ringNeed} “ในวง” ใน ${ringTime} วิ`, need:ringNeed, time:ringTime, forbidBad:true,
        onStart(){ directive({ nojunk:{on:true,r:150,mode:'fair'}, bonus:{mult:1.18} }); },
        onEnd(){ directive({ nojunk:{on:false}, bonus:{mult:1} }); }
      },

      // ✅ B++++: Magnet Boss
      { key:'boss', type:'boss', title:`BOSS MAGNET! ตีบอสให้ครบ ${bossHp} ครั้ง ใน ${bossTime} วิ`, need:bossHp, time:bossTime, forbidBad:false,
        onStart(){
          directive({
            magnet:{on:true,strength:0.62},
            bossMini:{on:true,hp:bossHp},
            storm:{on:true,dur:bossTime},        // บอส = มี storm เสริมเร้าใจ แต่ deterministic ได้ใน research
            bonus:{mult:1.20}
          });
        },
        onEnd(){
          directive({ bossMini:{on:false}, magnet:{on:false}, storm:{on:false}, bonus:{mult:1} });
        }
      },
    ];
  }

  NS.createGroupsQuest = function(opts){
    opts = opts || {};
    const diff = String(opts.diff||'normal').toLowerCase();

    const S = {
      started:false, stopped:false,
      goalIndex:0, goalsTotal:5, goalsCleared:0,
      goalNow:0, goalTotal:goalNeed(diff), goalTitle:'',
      miniArr: miniList(diff),
      miniIndex:0, mini:null,
      miniNow:0, miniNeed:0,
      miniStart:0, miniEnd:0,
      miniCleared:0, miniTotalAll:999,
      bossHpLeft:0,
      _timer:null,
      _lastTickSec:null
    };

    function groupId(){ return (S.goalIndex % 5) + 1; }
    function goalTitle(){ return `หมู่ ${groupId()}: เก็บให้ถูก ${S.goalTotal} ครั้ง`; }

    function pushUpdate(){
      const gp = (S.goalTotal>0) ? (S.goalNow/S.goalTotal)*100 : 0;
      const mp = (S.mini && S.miniNeed>0) ? (S.miniNow/S.miniNeed)*100 : 0;
      const left = S.mini ? Math.max(0, Math.ceil((S.miniEnd - now())/1000)) : 0;

      const miniTitle = S.mini
        ? (S.mini.type==='boss' ? `${S.mini.title} (HP ${S.bossHpLeft}/${S.miniNeed})` : S.mini.title)
        : '—';

      emit('quest:update', {
        goalTitle: S.goalTitle,
        goalNow: S.goalNow,
        goalTotal: S.goalTotal,
        goalPct: clamp(gp,0,100),

        miniTitle,
        miniNow: S.mini ? S.miniNow : 0,
        miniTotal: S.mini ? S.miniNeed : 0,
        miniPct: clamp(mp,0,100),
        miniTimeLeftSec: left
      });

      // urgency (<=4s): tick every second, last 2s = tickFast + shake stronger
      if (S.mini && left > 0 && left <= 4){
        const fast = (left <= 2);
        if (S._lastTickSec !== left){
          directive({ tick:true, tickFast: fast });
          S._lastTickSec = left;
        }
        directive({ urgent:true, shake:{ strength: fast ? 2.4 : 1.4, ms: 120 } });
      } else {
        directive({ urgent:false });
        S._lastTickSec = null;
      }
    }

    function startMini(){
      S.mini = S.miniArr[S.miniIndex % S.miniArr.length];
      S.miniNow = 0;
      S.miniNeed = S.mini.need;
      S.bossHpLeft = (S.mini.type==='boss') ? S.mini.need : 0;

      const t = now();
      S.miniStart = t;
      S.miniEnd = t + (S.mini.time*1000);

      try{ S.mini.onStart && S.mini.onStart(); }catch{}
      pushUpdate();
    }

    function endMini(ok, reason){
      const m = S.mini;
      if (!m) return;

      try{ m.onEnd && m.onEnd(); }catch{}

      if (ok){
        S.miniCleared++;
        emit('hha:celebrate', { kind:'mini', title:'MINI CLEAR!' });
      } else {
        emit('hha:judge', { kind:'bad', text: reason || 'MINI FAIL' });
      }

      S.mini = null;
      S.miniIndex++;
      pushUpdate();

      setTimeout(()=>{ if (!S.stopped) startMini(); }, 420);
    }

    function nextGoal(){
      S.goalIndex++;
      S.goalsCleared++;
      S.goalNow = 0;
      S.goalTotal = goalNeed(diff);
      S.goalTitle = goalTitle();
      emit('hha:celebrate', { kind:'goal', title:`GOAL CLEAR! ${S.goalTitle}` });
      pushUpdate();
    }

    function start(){
      if (S.started) return;
      S.started = true;
      S.stopped = false;

      S.goalIndex = 0;
      S.goalsCleared = 0;
      S.goalNow = 0;
      S.goalTotal = goalNeed(diff);
      S.goalTitle = goalTitle();

      startMini();

      S._timer = setInterval(()=>{
        if (S.stopped) return;

        if (S.mini){
          const left = S.miniEnd - now();
          if (left <= 0){
            endMini(false, 'หมดเวลา');
            return;
          }
        }
        pushUpdate();
      }, 120);
    }

    function stop(){
      S.stopped = true;
      try{ clearInterval(S._timer); }catch{}
      S._timer = null;
      directive({ urgent:false, bonus:{mult:1}, magnet:{on:false}, nojunk:{on:false}, bossMini:{on:false}, storm:{on:false} });
    }

    function onProgress(ev){
      const d = (ev && ev.detail) ? ev.detail : {};

      // goal progress: correct hit with matching groupId
      if (d.kind === 'hit_good' && Number(d.groupId) === groupId()){
        S.goalNow++;
        if (S.goalNow >= S.goalTotal) nextGoal();
      }

      // mini
      if (!S.mini) { pushUpdate(); return; }

      // boss feedback
      if (d.kind === 'boss_hit'){
        S.bossHpLeft = clamp(d.hpLeft, 0, S.miniNeed);
        if (S.bossHpLeft <= 0){
          endMini(true);
          return;
        }
      }
      if (d.kind === 'boss_heal'){
        S.bossHpLeft = clamp(d.hpLeft, 0, S.miniNeed);
      }
      if (d.kind === 'boss_down'){
        S.bossHpLeft = 0;
        endMini(true);
        return;
      }

      // hits counting
      if (d.kind === 'hit_good'){
        if (S.mini.type === 'ring_hits'){
          // ✅ ต้อง “ในวง” เท่านั้น
          if (d.inRing){
            S.miniNow++;
          }
        } else if (S.mini.type === 'hits'){
          S.miniNow++;
        }
        if (S.miniNow >= S.miniNeed){
          endMini(true);
          return;
        }
      }

      // forbid bad hits -> fail
      if (S.mini.forbidBad && (d.kind === 'hit_bad' || d.kind === 'hit_wrong' || d.kind === 'hit_junk')){
        endMini(false, 'โดนขยะ/ผิด');
        return;
      }

      pushUpdate();
    }

    function getState(){
      return {
        goalsCleared:S.goalsCleared, goalsTotal:S.goalsTotal,
        miniCleared:S.miniCleared, miniTotal:S.miniTotalAll
      };
    }

    return { start, stop, onProgress, pushUpdate, getState };
  };

})(typeof window !== 'undefined' ? window : globalThis);