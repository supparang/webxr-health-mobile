// === /herohealth/vr-groups/groups-race-score.js ===
// Groups Race Score Rank — Production utility
// FULL v20260307a-GROUPS-RACE-SCORE
// ✅ normalize payload
// ✅ winner decision: score -> accuracyPct -> miss -> comboMax -> draw
// ✅ safe compare helpers
// ✅ serializable result

'use strict';

(function(root){
  const WIN = root || window;

  function n(v, d=0){
    v = Number(v);
    return Number.isFinite(v) ? v : d;
  }

  function s(v, d=''){
    return (v === undefined || v === null) ? d : String(v);
  }

  function b(v){
    return !!v;
  }

  function normalizeRaceResult(x = {}){
    return {
      playerKey: s(x.playerKey || x.key || ''),
      pid: s(x.pid || ''),
      name: s(x.name || ''),
      score: n(x.score, 0),
      accuracyPct: n(x.accuracyPct, n(x.accPct, 0)),
      miss: n(x.miss, n(x.misses, 0)),
      comboMax: n(x.comboMax, 0),
      combo: n(x.combo, 0),
      timeLeft: n(x.timeLeft, 0),
      finished: b(x.finished),
      finishAt: n(x.finishAt, 0),
      connected: ('connected' in x) ? b(x.connected) : true,
      at: n(x.at, 0)
    };
  }

  function compareRace(aRaw, bRaw){
    const a = normalizeRaceResult(aRaw);
    const b = normalizeRaceResult(bRaw);

    if (a.score !== b.score){
      return {
        cmp: a.score > b.score ? 1 : -1,
        rule: 'score',
        tieReason: ''
      };
    }

    if (a.accuracyPct !== b.accuracyPct){
      return {
        cmp: a.accuracyPct > b.accuracyPct ? 1 : -1,
        rule: 'score',
        tieReason: 'accuracyPct'
      };
    }

    if (a.miss !== b.miss){
      return {
        cmp: a.miss < b.miss ? 1 : -1,
        rule: 'score',
        tieReason: 'miss'
      };
    }

    if (a.comboMax !== b.comboMax){
      return {
        cmp: a.comboMax > b.comboMax ? 1 : -1,
        rule: 'score',
        tieReason: 'comboMax'
      };
    }

    return {
      cmp: 0,
      rule: 'draw',
      tieReason: 'all_equal'
    };
  }

  function pickRaceWinner(aRaw, bRaw){
    const a = normalizeRaceResult(aRaw);
    const b = normalizeRaceResult(bRaw);
    const c = compareRace(a, b);

    if (c.cmp > 0){
      return {
        winnerKey: a.playerKey,
        winner: a,
        loser: b,
        a, b,
        rule: c.rule,
        tieReason: c.tieReason,
        isDraw: false
      };
    }

    if (c.cmp < 0){
      return {
        winnerKey: b.playerKey,
        winner: b,
        loser: a,
        a, b,
        rule: c.rule,
        tieReason: c.tieReason,
        isDraw: false
      };
    }

    return {
      winnerKey: '',
      winner: null,
      loser: null,
      a, b,
      rule: 'draw',
      tieReason: c.tieReason || 'all_equal',
      isDraw: true
    };
  }

  function toSerializableDecision(dec){
    dec = dec || {};
    return {
      winnerKey: s(dec.winnerKey, ''),
      winner: dec.winner || null,
      loser: dec.loser || null,
      a: dec.a || null,
      b: dec.b || null,
      rule: s(dec.rule, ''),
      tieReason: s(dec.tieReason, ''),
      isDraw: !!dec.isDraw
    };
  }

  WIN.GroupsRaceScore = {
    normalizeRaceResult,
    compareRace,
    pickRaceWinner,
    toSerializableDecision
  };
})(typeof window !== 'undefined' ? window : globalThis);