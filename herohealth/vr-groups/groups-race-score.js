// === /herohealth/vr-groups/groups-race-score.js ===
// Groups Race Score / Decision Helpers
// FULL PATCH v20260313-GROUPS-RACE-SCORE-BO3-r1

(function(){
  'use strict';

  function n(v, d=0){
    const x = Number(v);
    return Number.isFinite(x) ? x : d;
  }

  function normPlayer(p){
    return {
      playerKey: String(p?.playerKey || ''),
      role: String(p?.role || ''),
      pid: String(p?.pid || ''),
      name: String(p?.name || ''),
      score: n(p?.score, 0),
      accuracyPct: n(p?.accuracyPct, 0),
      miss: n(p?.miss, 0),
      comboMax: n(p?.comboMax, 0),
      timeLeft: n(p?.timeLeft, 0),
      finished: !!p?.finished,
      connected: ('connected' in (p||{})) ? !!p.connected : true,
      finishAt: n(p?.finishAt, 0),
      summary: p?.summary || null
    };
  }

  function comparePlayers(a0, b0){
    const a = normPlayer(a0);
    const b = normPlayer(b0);

    if (a.score !== b.score) return a.score > b.score ? 1 : -1;
    if (a.accuracyPct !== b.accuracyPct) return a.accuracyPct > b.accuracyPct ? 1 : -1;
    if (a.miss !== b.miss) return a.miss < b.miss ? 1 : -1;
    if (a.comboMax !== b.comboMax) return a.comboMax > b.comboMax ? 1 : -1;
    if (a.timeLeft !== b.timeLeft) return a.timeLeft > b.timeLeft ? 1 : -1;
    return 0;
  }

  function buildDecision(room, a0, b0, why='score'){
    const a = normPlayer(a0);
    const b = normPlayer(b0);

    const cmp = comparePlayers(a, b);
    const isDraw = cmp === 0;
    const winner = isDraw ? null : (cmp > 0 ? a : b);
    const loser  = isDraw ? null : (cmp > 0 ? b : a);

    const hostKey = String(room?.hostKey || '');
    const guestKey = String(room?.guestKey || '');

    let hostWins = n(room?.hostWins, 0);
    let guestWins = n(room?.guestWins, 0);

    if (!isDraw && winner){
      if (winner.playerKey === hostKey) hostWins += 1;
      else if (winner.playerKey === guestKey) guestWins += 1;
    }

    const seriesFinished = hostWins >= 2 || guestWins >= 2;
    const seriesWinnerKey =
      hostWins >= 2 ? hostKey :
      guestWins >= 2 ? guestKey : '';

    return {
      type: 'race_decision',
      decidedAt: Date.now(),
      roomId: String(room?.roomId || ''),
      roundNo: n(room?.roundNo, 1),
      rematchNo: n(room?.rematchNo, 0),
      rule: why,
      isDraw,
      winnerKey: winner?.playerKey || '',
      loserKey: loser?.playerKey || '',
      hostKey,
      guestKey,
      hostWins,
      guestWins,
      seriesFinished,
      seriesWinnerKey,
      a,
      b
    };
  }

  function buildDisconnectDecision(room, quitter0, other0){
    const quitter = normPlayer(quitter0);
    const other = normPlayer(other0);
    return buildDecision(room, other, quitter, 'disconnect');
  }

  function getMyOpponent(room, players, myKey){
    const arr = Object.values(players || {}).map(normPlayer);
    const me = arr.find(p => p.playerKey === myKey) || null;
    const opponent = arr.find(p => p.playerKey !== myKey) || null;
    return { me, opponent };
  }

  window.GroupsRaceScore = {
    n,
    normPlayer,
    comparePlayers,
    buildDecision,
    buildDisconnectDecision,
    getMyOpponent
  };
})();