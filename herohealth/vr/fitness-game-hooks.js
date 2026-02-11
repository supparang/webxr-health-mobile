// === /herohealth/vr/fitness-game-hooks.js ===
// Fitness Game Hooks — v20260211a
// Requires: window.HHA_RP (hha-research-pack.js) + optional window.HHA_MISSION (mission-ui.js)

(function(){
  'use strict';
  const WIN = window;

  const RP = WIN.HHA_RP || null;

  function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }

  function keyFor(gameId){
    const g = String(gameId||'').toLowerCase();
    if(g==='shadow') return 'HHA_LAST_SUMMARY_SHADOW';
    if(g==='rhythm') return 'HHA_LAST_SUMMARY_RHYTHM';
    if(g==='jumpduck') return 'HHA_LAST_SUMMARY_JUMPDUCK';
    if(g==='balance') return 'HHA_LAST_SUMMARY_BALANCE';
    return 'HHA_LAST_SUMMARY';
  }

  function safeSetLS(k, obj){
    try{ localStorage.setItem(k, JSON.stringify(obj)); }catch(_){}
  }

  function withGame(gameId){
    return (row)=>{
      if(!RP) return;
      // เติม game ให้ครบทุก event
      try{
        const last = RP.EVENTS[RP.EVENTS.length-1];
        if(last && !last.game) last.game = gameId;
      }catch(_){}
      return row;
    };
  }

  function ev(gameId, type, data){
    if(!RP?.ev) return;
    RP.ev(type, data || {});
    withGame(gameId)();
  }

  // expose preset helper
  function preset(gameId){
    if(!RP?.IS_RESEARCH) return null;
    try{ return RP.getResearchPreset(gameId); }catch(_){ return null; }
  }

  const HOOKS = {
    preset,

    start(gameId, extra){
      const t0 = nowMs();
      HOOKS.__t0 = t0;

      ev(gameId, 'session_start', {
        game: gameId,
        fromPlanner: !!RP?.ctx?.fromPlanner,
        combo: RP?.ctx?.combo || [],
        mode: RP?.ctx?.mode || 'play',
        seed: (RP?.ctx?.seed ?? 0) >>> 0,
        conditionGroup: RP?.ctx?.conditionGroup || '',
        ...(extra||{})
      });

      // ถ้ามาจาก planner เก็บ event เพิ่มให้ชัด
      if(RP?.ctx?.fromPlanner){
        ev(gameId, 'planner_combo', { combo: RP.ctx.combo || [] });
      }

      return t0;
    },

    // Trial-level events (เรียกง่าย ๆ)
    hit(gameId, meta){
      WIN.HHA_MISSION?.noteHitOk?.();
      ev(gameId, 'trial_end', { ok:true, reason:'hit', ...(meta||{}) });
    },
    miss(gameId, meta){
      ev(gameId, 'trial_end', { ok:false, reason:'miss', ...(meta||{}) });
    },
    moveOk(gameId, meta){
      WIN.HHA_MISSION?.noteMoveOk?.();
      ev(gameId, 'trial_end', { ok:true, reason:'move_ok', ...(meta||{}) });
    },
    holdOk(gameId, meta){
      WIN.HHA_MISSION?.noteHoldOk?.();
      ev(gameId, 'trial_end', { ok:true, reason:'hold_ok', ...(meta||{}) });
    },
    streak(gameId, n){
      WIN.HHA_MISSION?.noteStreak?.(n);
      ev(gameId, 'streak', { n: Number(n)||0 });
    },

    end(gameId, summary){
      const t1 = nowMs();
      const durMs = Math.max(0, Math.round(t1 - (HOOKS.__t0 || t1)));

      const s = Object.assign({
        ts: Date.now(),
        game: gameId,
        score: Number(summary?.score ?? 0) || 0,
        pass: Number(summary?.pass ?? 0) || 0,
        total: Number(summary?.total ?? 0) || 0,
        maxStreak: Number(summary?.maxStreak ?? 0) || 0,
        ms: Number(summary?.ms ?? durMs) || durMs,
      }, summary || {});

      // save last summary per game
      safeSetLS(keyFor(gameId), s);

      // log session_end
      ev(gameId, 'session_end', {
        score: s.score,
        pass: s.pass,
        total: s.total,
        maxStreak: s.maxStreak,
        ms: s.ms
      });

      return s;
    }
  };

  WIN.HHA_FITNESS_HOOKS = HOOKS;
})();