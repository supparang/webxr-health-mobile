// === /herohealth/plate/plate.state.js ===
// PlateState — shared state helpers (global, non-module)
// Provides window.GAME_MODULES.PlateState

(function (root) {
  'use strict';
  const W = root;

  function clamp(v, min, max){ v = Number(v)||0; return v < min ? min : (v > max ? max : v); }

  function median(arr){
    if(!arr || !arr.length) return 0;
    const a = arr.slice().sort((x,y)=>x-y);
    const m = Math.floor(a.length/2);
    return (a.length % 2) ? a[m] : (a[m-1] + a[m]) / 2;
  }

  function accuracyPct(s){
    const denom = (s.nHitGood + s.nHitJunk + s.nExpireGood);
    if(denom <= 0) return 0;
    return (s.nHitGood / denom) * 100;
  }

  function junkErrorPct(s){
    const denom = (s.nHitGood + s.nHitJunk);
    if(denom <= 0) return 0;
    return (s.nHitJunk / denom) * 100;
  }

  // grade mapping (ตามที่ตกลง SSS/SS/S/A/B/C)
  function calcGrade(s){
    const acc = accuracyPct(s);
    const m = s.miss || 0;
    const baseScore = s.score || 0;

    if(acc >= 95 && m <= 1 && baseScore >= 2200) return 'SSS';
    if(acc >= 92 && m <= 2 && baseScore >= 1800) return 'SS';
    if(acc >= 88 && m <= 3) return 'S';
    if(acc >= 82 && m <= 5) return 'A';
    if(acc >= 72 && m <= 8) return 'B';
    return 'C';
  }

  function createState(opts){
    opts = opts || {};
    const timePlannedSec = Number(opts.timePlannedSec)||90;
    const seed = Number(opts.seed)||0;

    return {
      // meta
      game: 'plate',
      runMode: String(opts.runMode||'play'),
      diff: String(opts.diff||'normal'),
      seed,

      // time
      timePlannedSec,
      tStartMs: 0,
      timeLeftSec: timePlannedSec,

      // score
      score: 0,
      combo: 0,
      comboMax: 0,
      miss: 0,

      // plate counts (5 หมู่)
      gCount: [0,0,0,0,0],
      plateHave: [false,false,false,false,false],

      // fever/shield
      fever: 0,
      shield: 0,

      // stats
      nTargetGoodSpawned: 0,
      nTargetJunkSpawned: 0,
      nTargetShieldSpawned: 0,

      nHitGood: 0,
      nHitJunk: 0,
      nHitJunkGuard: 0,
      nExpireGood: 0,

      rtGoodMs: [],
      perfectHits: 0,

      // quest summary
      goalsTotal: 2,
      goalsCleared: 0,
      miniTotal: 0,
      miniCleared: 0
    };
  }

  function resetState(s){
    const base = createState({
      timePlannedSec: s.timePlannedSec,
      seed: s.seed,
      runMode: s.runMode,
      diff: s.diff
    });
    Object.keys(base).forEach(k => { s[k] = base[k]; });
    return s;
  }

  function plateHaveCount(s){
    let n = 0;
    for(let i=0;i<5;i++) if(!!s.plateHave[i]) n++;
    return n;
  }

  function buildSummary(s, reason){
    const playedSec = Math.max(0, ((root.performance && performance.now) ? performance.now() : Date.now()) - (s.tStartMs||0)) / 1000;
    const acc = accuracyPct(s);
    const jerr = junkErrorPct(s);
    const rtN = s.rtGoodMs.length;
    const avgRt = rtN ? (s.rtGoodMs.reduce((a,b)=>a+b,0)/rtN) : 0;
    const medRt = rtN ? median(s.rtGoodMs) : 0;
    const fastHitRatePct = (s.nHitGood>0) ? (s.perfectHits/s.nHitGood*100) : 0;

    const grade = calcGrade(s);

    return {
      timestampIso: new Date().toISOString(),
      projectTag: 'HHA',
      game: 'plate',
      gameMode: 'plate',
      runMode: s.runMode,
      diff: s.diff,
      seed: s.seed,
      durationPlannedSec: Number(s.timePlannedSec)||0,
      durationPlayedSec: Math.round(playedSec),

      scoreFinal: s.score,
      comboMax: s.comboMax,
      misses: s.miss,

      goalsCleared: s.goalsCleared,
      goalsTotal: s.goalsTotal,
      miniCleared: s.miniCleared,
      miniTotal: s.miniTotal,

      nTargetGoodSpawned: s.nTargetGoodSpawned,
      nTargetJunkSpawned: s.nTargetJunkSpawned,
      nTargetShieldSpawned: s.nTargetShieldSpawned,

      nHitGood: s.nHitGood,
      nHitJunk: s.nHitJunk,
      nHitJunkGuard: s.nHitJunkGuard,
      nExpireGood: s.nExpireGood,

      accuracyGoodPct: Math.round(acc*10)/10,
      junkErrorPct: Math.round(jerr*10)/10,
      avgRtGoodMs: Math.round(avgRt),
      medianRtGoodMs: Math.round(medRt),
      fastHitRatePct: Math.round(fastHitRatePct*10)/10,

      grade,
      reason: reason || 'end',

      plate: {
        have: s.plateHave.map(Boolean),
        counts: s.gCount.slice(),
        total: s.gCount.reduce((a,b)=>a+(b||0),0)
      },

      device: (navigator && navigator.userAgent) ? navigator.userAgent : ''
    };
  }

  // export
  W.GAME_MODULES = W.GAME_MODULES || {};
  W.GAME_MODULES.PlateState = {
    clamp,
    createState,
    resetState,
    accuracyPct,
    junkErrorPct,
    calcGrade,
    plateHaveCount,
    buildSummary
  };

})(window);