// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups — GameEngine (classic script) — PRODUCTION ALL-IN
// ✅ DOM targets w/ CSS vars --x/--y/--s (px)
// ✅ Types: food (good/wrong), junk (stun), decoy (trap), boss (multi-hit)
// ✅ Emits: hha:score, hha:time, hha:rank(grade+accuracy), hha:end(summary),
//          groups:group_change, groups:power, groups:lock, groups:stun, groups:panic
// ✅ No NaN counters, safe timers/raf, TTL cleanup
// ✅ Works with: groups-quests.js (createGroupsQuest) + groups-fx.js + groups-hud-quest.js

(function (root) {
  'use strict';

  const W = root;
  const doc = W.document;
  W.GroupsVR = W.GroupsVR || {};

  // ---------------- helpers ----------------
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){
    return (W.performance && performance.now) ? performance.now() : Date.now();
  }
  function emit(name, detail){
    try{ W.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(_){}
  }
  function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

  // ---------------- difficulty tuning ----------------
  const DIFF = {
    easy: {
      spawnEvery: 720, maxOnScreen: 5,
      ttl: [2200, 3400],
      junkRate: .18, decoyRate: .07,
      bossEvery: 16, bossHP: 3, bossChance: .35,
      correctScore: 120, wrongPenalty: 120, junkPenalty: 180, decoyPenalty: 140, bossScore: 220,
      powerThreshold: 6,
      lockDist: 210, lockDur: 420
    },
    normal: {
      spawnEvery: 640, maxOnScreen: 6,
      ttl: [2100, 3300],
      junkRate: .20, decoyRate: .08,
      bossEvery: 14, bossHP: 3, bossChance: .35,
      correctScore: 130, wrongPenalty: 140, junkPenalty: 200, decoyPenalty: 160, bossScore: 240,
      powerThreshold: 7,
      lockDist: 210, lockDur: 420
    },
    hard: {
      spawnEvery: 560, maxOnScreen: 7,
      ttl: [2000, 3200],
      junkRate: .22, decoyRate: .10,
      bossEvery: 12, bossHP: 4, bossChance: .38,
      correctScore: 140, wrongPenalty: 160, junkPenalty: 230, decoyPenalty: 180, bossScore: 260,
      powerThreshold: 8,
      lockDist: 210, lockDur: 420
    }
  };

  // ---------------- groups data ----------------
  const GROUPS = [
    { id:1, label:'หมู่ 1', foods:['🥛','🥚','🫘','🍗'] },
    { id:2, label:'หมู่ 2', foods:['🍚','🍞','🥔','🍜'] },
    { id:3, label:'หมู่ 3', foods:['🥦','🥬','🥕','🌽'] },
    { id:4, label:'หมู่ 4', foods:['🍎','🍌','🍊','🍉'] },
    { id:5, label:'หมู่ 5', foods:['🥑','🧈','🥜','🫒'] }
  ];
  const JUNK = ['🍟','🍔','🍩','🧁','🥤'];

  function pickGroup(){ return GROUPS[(Math.random()*GROUPS.length)|0]; }

  // ---------------- spawn box (safe-zone +