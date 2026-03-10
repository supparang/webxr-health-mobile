// === /herohealth/vr-groups/groups-race-score.js ===
// Groups Race Score / Decision Helpers
// FULL v20260310-GROUPS-RACE-SCORE-FINAL
(function(){
  'use strict';

  function n(v, d=0){
    v = Number(v);
    return Number.isFinite(v) ? v : d;
  }

  function normPlayer(p){
    p = p || {};
    return {
      playerKey: String(p.playerKey || ''),
      pid: String(p.pid || ''),
      name: String(p.name || p.playerKey || 'Player'),
      score: n(p.score, 0),
      combo: n(p.combo, 0),
      comboMax: n(p.comboMax, 0),
      miss: n(p.miss, 0),
      accuracyPct: n(p.accuracyPct, 0),
      finished: !!p.finished,
      finishAt: n(p.finishAt, 0),
      connected: ('connected' in p) ? !!p.connected : true,
      summary: p.summary || null
    };
  }

  function comparePlayers(a, b){
    a = normPlayer(a);
    b = normPlayer(b);

    if(a.score !== b.score) return a.score > b.score ? 1 : -1;
    if(a.accuracyPct !== b.accuracyPct) return a.accuracyPct > b.accuracyPct ? 1 : -1;
    if(a.miss !== b.miss) return a.miss < b.miss ? 1 : -1;
    if(a.comboMax !== b.comboMax) return a.comboMax > b.comboMax ? 1 : -1;

    const af = n(a.finishAt, Number.MAX_SAFE_INTEGER);
    const bf = n(b.finishAt, Number.MAX_SAFE_INTEGER);
    if(af !== bf) return af < bf ? 1 : -1;

    return 0;
  }

  function buildRoundDecision(room, hostPlayer, guestPlayer){
    room = room || {};
    const host = normPlayer(hostPlayer);
    const guest = normPlayer(guestPlayer);

    const hostKey = String(room.hostKey || host.playerKey || '');
    const guestKey = String(room.guestKey || guest.playerKey || '');

    const hostDisconnected = host.playerKey && host.connected === false;
    const guestDisconnected = guest.playerKey && guest.connected === false;

    let isDraw = false;
    let winnerKey = '';
    let loserKey = '';
    let rule = 'score';

    if(hostDisconnected && !guestDisconnected){
      winnerKey = guestKey;
      loserKey = hostKey;
      rule = 'disconnect';
    }else if(guestDisconnected && !hostDisconnected){
      winnerKey = hostKey;
      loserKey = guestKey;
      rule = 'disconnect';
    }else{
      const cmp = comparePlayers(host, guest);
      if(cmp > 0){
        winnerKey = hostKey;
        loserKey = guestKey;
      }else if(cmp < 0){
        winnerKey = guestKey;
        loserKey = hostKey;
      }else{
        isDraw = true;
        rule = 'draw';
      }
    }

    let hostWins = n(room.hostWins, 0);
    let guestWins = n(room.guestWins, 0);

    if(!isDraw){
      if(winnerKey === hostKey) hostWins += 1;
      else if(winnerKey === guestKey) guestWins += 1;
    }

    const seriesFinished = hostWins >= 2 || guestWins >= 2;
    const seriesWinnerKey = seriesFinished
      ? (hostWins > guestWins ? hostKey : guestKey)
      : '';

    return {
      roomId: String(room.roomId || ''),
      roundNo: n(room.roundNo, 1),
      rematchNo: n(room.rematchNo, 0),

      rule,
      isDraw,
      winnerKey,
      loserKey,

      hostKey,
      guestKey,
      hostWins,
      guestWins,
      seriesFinished,
      seriesWinnerKey,

      a: {
        playerKey: host.playerKey,
        pid: host.pid,
        name: host.name,
        score: host.score,
        combo: host.combo,
        comboMax: host.comboMax,
        miss: host.miss,
        accuracyPct: host.accuracyPct,
        finished: host.finished,
        finishAt: host.finishAt,
        connected: host.connected,
        summary: host.summary || null
      },
      b: {
        playerKey: guest.playerKey,
        pid: guest.pid,
        name: guest.name,
        score: guest.score,
        combo: guest.combo,
        comboMax: guest.comboMax,
        miss: guest.miss,
        accuracyPct: guest.accuracyPct,
        finished: guest.finished,
        finishAt: guest.finishAt,
        connected: guest.connected,
        summary: guest.summary || null
      },

      decidedAt: Date.now()
    };
  }

  window.GroupsRaceScore = {
    normPlayer,
    comparePlayers,
    buildRoundDecision
  };
})();