// === /herohealth/plate/plate.minis.js ===
// Minis defs (PlateRush) + timer helpers (global)
// Provides window.GAME_MODULES.PlateMinis

(function (root) {
  'use strict';
  const W = root;

  function nowMs(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }

  function makePlateRush(){
    return {
      key: 'plate-rush',
      title: 'Plate Rush: ครบ 5 หมู่ใน 8 วิ + ห้ามโดนขยะ',
      forbidJunk: true,
      durationSec: 8,
      startedMs: 0,
      done: false
    };
  }

  function startMini(mini){
    mini.startedMs = nowMs();
    mini.done = false;
    return mini;
  }

  function timeLeft(mini){
    if(!mini || !mini.startedMs) return null;
    const elapsed = (nowMs() - mini.startedMs) / 1000;
    return Math.max(0, (mini.durationSec||0) - elapsed);
  }

  function isTimeout(mini){
    const tl = timeLeft(mini);
    return (tl != null && tl <= 0);
  }

  W.GAME_MODULES = W.GAME_MODULES || {};
  W.GAME_MODULES.PlateMinis = { makePlateRush, startMini, timeLeft, isTimeout };

})(window);