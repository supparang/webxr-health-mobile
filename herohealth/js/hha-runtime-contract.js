'use strict';

/* =========================================================
 * /herohealth/js/hha-runtime-contract.js
 * HeroHealth Runtime Contract
 * FULL PATCH v20260404-hha-runtime-contract-full
 * ========================================================= */
(function(){
  if (window.HHARuntimeContract) return;

  const W = window;

  function num(v, d=0){
    v = Number(v);
    return Number.isFinite(v) ? v : d;
  }

  function clean(v, max=120){
    return String(v == null ? '' : v).trim().slice(0, max);
  }

  function clone(v){
    try { return JSON.parse(JSON.stringify(v)); }
    catch (_) { return v; }
  }

  function qs(key, fallback=''){
    try {
      const u = new URL(location.href);
      const v = u.searchParams.get(key);
      return v == null ? fallback : v;
    } catch (_) {
      return fallback;
    }
  }

  function dispatch(name, detail){
    try {
      W.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (_) {}
  }

  function baseCtxFromUrl(){
    return {
      href: String(location.href || ''),
      game: clean(qs('game') || qs('gameId') || 'goodjunk', 40),
      zone: clean(qs('zone') || 'nutrition', 40),
      mode: clean(qs('mode') || '', 24),
      roomId: clean(qs('roomId') || qs('room') || '', 40),
      roomKind: clean(qs('roomKind') || '', 40),
      pid: clean(qs('pid') || '', 80),
      name: clean(qs('name') || qs('nick') || '', 80),
      role: clean(qs('role') || '', 24),
      diff: clean(qs('diff') || '', 24),
      time: num(qs('time') || 0, 0),
      seed: clean(qs('seed') || '', 80),
      view: clean(qs('view') || '', 24),
      run: clean(qs('run') || '', 24),
      host: clean(qs('host') || '0', 8)
    };
  }

  function normalizeStandings(list){
    if (!Array.isArray(list)) return [];
    return list.map(function(r, i){
      return {
        pid: clean(r && r.pid || '', 80),
        nick: clean(r && (r.nick || r.name) || '', 80),
        rank: num(r && r.rank, i + 1),
        score: num(r && r.score, 0),
        miss: num(r && r.miss, 0),
        goodHit: num(r && r.goodHit, 0),
        junkHit: num(r && r.junkHit, 0),
        bestStreak: num(r && r.bestStreak, 0),
        duration: num(r && r.duration, 0),
        hp: num(r && r.hp, 0),
        maxHp: num(r && r.maxHp, 0),
        koCount: num(r && r.koCount, 0),
        contribution: num(r && r.contribution, 0)
      };
    });
  }

  function normalizeSummary(detail, ctx){
    const src = (detail && typeof detail === 'object' && detail.summary && typeof detail.summary === 'object')
      ? detail.summary
      : (detail || {});

    return {
      controllerFinal: !!src.controllerFinal,
      game: clean(src.game || ctx.game || 'goodjunk', 40),
      zone: clean(src.zone || ctx.zone || 'nutrition', 40),
      mode: clean(src.mode || ctx.mode || '', 24),

      roomId: clean(src.roomId || ctx.roomId || '', 40),
      roomKind: clean(src.roomKind || ctx.roomKind || '', 40),

      pid: clean(src.pid || ctx.pid || '', 80),
      uid: clean(src.uid || '', 80),
      name: clean(src.name || src.nick || ctx.name || '', 80),
      role: clean(src.role || ctx.role || '', 24),

      result: clean(src.result || src.outcome || src.status || 'finished', 80),
      rank: num(src.rank || src.place || src.position, 0),
      score: num(src.score || src.totalScore || src.playerScore || src.myScore, 0),
      players: num(src.players || src.playerCount || src.totalPlayers, 0),

      miss: num(src.miss || src.misses || src.totalMiss, 0),
      goodHit: num(src.goodHit || src.hitsGood || src.goodHits || src.correct, 0),
      junkHit: num(src.junkHit || src.hitsBad || src.junkHits || src.wrong, 0),
      bestStreak: num(src.bestStreak || src.streak || src.comboMax, 0),
      duration: num(src.duration || src.durationSec || src.timeUsed, 0),
      reason: clean(src.reason || src.finishReason || src.endReason || '', 80),

      hp: num(src.hp, 0),
      maxHp: num(src.maxHp, 0),
      attackCharge: num(src.attackCharge, 0),
      maxAttackCharge: num(src.maxAttackCharge, 0),
      attackReady: !!src.attackReady,
      attacksUsed: num(src.attacksUsed, 0),
      damageDealt: num(src.damageDealt, 0),
      damageTaken: num(src.damageTaken, 0),
      koCount: num(src.koCount, 0),

      teamScore: num(src.teamScore, 0),
      contribution: num(src.contribution, 0),

      standings: normalizeStandings(src.standings),
      compare: src.compare || null,
      raw: clone(src)
    };
  }

  function createRuntime(opts){
    opts = opts || {};

    const staticCtx = Object.assign({}, baseCtxFromUrl(), {
      game: clean(opts.game || qs('game') || qs('gameId') || 'goodjunk', 40),
      zone: clean(opts.zone || qs('zone') || 'nutrition', 40),
      mode: clean(opts.mode || qs('mode') || '', 24)
    });

    function currentCtx(){
      const dyn = typeof opts.getCtx === 'function' ? (opts.getCtx() || {}) : {};
      return Object.assign({}, staticCtx, dyn);
    }

    function bridge(){
      if (!(W.HHACloudLoggerBridge && typeof W.HHACloudLoggerBridge.createBridge === 'function')) {
        return null;
      }
      return W.HHACloudLoggerBridge.createBridge(
        currentCtx().game || 'goodjunk',
        currentCtx().mode || 'general',
        currentCtx()
      );
    }

    async function emitLog(eventKey, detail){
      const b = bridge();
      if (!b) return false;
      return b.emit(clean((currentCtx().mode || 'mode') + '_' + eventKey, 80), Object.assign({}, currentCtx(), detail || {}));
    }

    async function emitSummary(eventKey, detail){
      const b = bridge();
      if (!b) return false;
      const summary = normalizeSummary(detail, currentCtx());
      return b.emitSummary(clean((currentCtx().mode || 'mode') + '_' + eventKey, 80), summary);
    }

    return {
      ctx: currentCtx,

      async flush(){
        const b = bridge();
        if (!b) return false;
        return b.flush();
      },

      normalizeSummary(detail){
        return normalizeSummary(detail, currentCtx());
      },

      async log(eventKey, detail){
        return emitLog(eventKey, detail || {});
      },

      async lobbyReady(detail){
        return emitLog('lobby_ready', detail || {});
      },

      async roomCreated(detail){
        return emitLog('room_created', detail || {});
      },

      async roomJoined(detail){
        return emitLog('room_joined', detail || {});
      },

      async roomLeft(detail){
        return emitLog('room_left', detail || {});
      },

      async countdownStarted(detail){
        return emitLog('countdown_started', detail || {});
      },

      async engineReady(detail){
        return emitLog('engine_ready', detail || {});
      },

      async roundStarted(detail){
        return emitLog('round_started', detail || {});
      },

      async attackUsed(detail){
        return emitLog('attack_used', detail || {});
      },

      async attackReceived(detail){
        return emitLog('attack_received', detail || {});
      },

      async scoreUpdated(detail){
        return emitLog('score_updated', detail || {});
      },

      async stateChanged(detail){
        return emitLog('state_changed', detail || {});
      },

      async summary(detail){
        const summary = normalizeSummary(detail, currentCtx());

        await emitSummary('summary_ready', summary);

        dispatch('gj:summary', summary);
        dispatch('hha:summary', summary);
        dispatch('hha:session-summary', summary);
        dispatch('hha:summary:' + (currentCtx().mode || 'general'), summary);

        return summary;
      }
    };
  }

  W.HHARuntimeContract = {
    create: createRuntime,
    normalizeSummary: normalizeSummary
  };
})();