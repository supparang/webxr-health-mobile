// === /herohealth/vr-groups/groups-quests.js ===
// Groups Quests — PRODUCTION (HHA Standard)
// ✅ Deterministic RNG by seed
// ✅ Provides GOAL + MINI quest state machine
// ✅ Emits UI events:
//    - quest:update {goalTitle,goalNow,goalTotal,goalPct, miniTitle,miniNow,miniTotal,miniPct, miniTimeLeftSec, groupName, groupKey}
//    - groups:power {charge, threshold}
//    - groups:progress {kind: 'storm_on'|'storm_off'|'boss_spawn'|'boss_down'|'perfect_switch' ...}
// Notes:
// - Engine (groups.safe.js) should call:
//    Quests.init({diff, style, seed, runMode})
//    Quests.onHit({ok, groupKey, scoreDelta, combo, misses, accuracyPct})
//    Quests.onTick({leftSec})
//    Quests.onStartRound(), Quests.onEndRound(reason)
//    Quests.forceSwitchGroup(optionalKey)
// - This module is defensive: no-throw if called with partial data.

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  WIN.GroupsVR = WIN.GroupsVR || {};

  // Avoid double load
  if (WIN.GroupsVR.Quests && WIN.GroupsVR.Quests.__loaded) return;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

  // -------------------------
  // RNG (deterministic)
  // -------------------------
  function xmur3(str){
    let h = 1779033703 ^ (str.length);
    for (let i=0; i<str.length; i++){
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

  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRng(seed){
    const s = String(seed ?? '');
    const h = xmur3(s || String(Date.now()));
    return mulberry32(h());
  }

  // -------------------------
  // Food group labels (Thai 5 groups)
  // -------------------------
  const GROUPS = [
    { key:'g1', name:'หมู่ 1 โปรตีน' },          // เนื้อ นม ไข่ ถั่วเมล็ดแห้ง
    { key:'g2', name:'หมู่ 2 คาร์โบไฮเดรต' },    // ข้าว แป้ง เผือก มัน น้ำตาล
    { key:'g3', name:'หมู่ 3 ผัก' },
    { key:'g4', name:'หมู่ 4 ผลไม้' },
    { key:'g5', name:'หมู่ 5 ไขมัน' }
  ];

  function groupByKey(k){
    k = String(k||'').toLowerCase();
    return GROUPS.find(x=>x.key===k) || GROUPS[0];
  }

  function pickGroup(rng, avoidKey){
    const keys = GROUPS.map(g=>g.key).filter(k=>k!==avoidKey);
    const idx = Math.floor(rng() * keys.length);
    return groupByKey(keys[idx] || 'g1');
  }

  // -------------------------
  // Event helpers
  // -------------------------
  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail: detail||{} })); }catch(_){}
  }

  // -------------------------
  // State
  // -------------------------
  const S = {
    inited:false,
    runMode:'play',     // play | research | practice
    diff:'normal',      // easy | normal | hard
    style:'mix',
    seed:'',
    rng: null,

    // gameplay signals (fed by engine)
    combo:0,
    misses:0,
    accuracyPct:0,
    score:0,
    lastHitAt:0,

    // current group focus
    groupKey:'g1',
    groupName:'หมู่ 1 โปรตีน',

    // power / switching
    powerCharge:0,
    powerThreshold:8,

    // storm timeline
    storm:false,
    stormNextAt:0,      // ms
    stormEndAt:0,       // ms

    // GOAL quest
    goalKind:'hits',    // hits | score | accuracy
    goalNow:0,
    goalTotal:18,
    goalTitle:'ยิงให้ถูกหมู่สะสม',
    goalDone:false,

    // MINI quest
    miniKind:'streak',  // streak | fast_hits | no_miss
    miniNow:0,
    miniTotal:5,
    miniTitle:'คอมโบต่อเนื่อง',
    miniActive:false,
    miniEndAt:0,        // ms
    miniWindowSec:8,
    miniDone:false,

    // throttle UI
    lastUiAt:0,
    uiEveryMs:180
  };

  function diffCfg(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff === 'easy'){
      return {
        powerThreshold: 7,
        goalTotalHits: 16,
        goalScore: 1200,
        miniTotal: 4,
        miniWindowSec: 9,
        stormProb: 0.16,
        stormDurSec: [4,6],
        stormGapSec: [10,16]
      };
    }
    if (diff === 'hard'){
      return {
        powerThreshold: 9,
        goalTotalHits: 22,
        goalScore: 1700,
        miniTotal: 6,
        miniWindowSec: 7,
        stormProb: 0.26,
        stormDurSec: [5,7],
        stormGapSec: [8,13]
      };
    }
    return {
      powerThreshold: 8,
      goalTotalHits: 18,
      goalScore: 1450,
      miniTotal: 5,
      miniWindowSec: 8,
      stormProb: 0.21,
      stormDurSec: [4,7],
      stormGapSec: [9,15]
    };
  }

  function chooseGoalKind(rng){
    // Make it fun but readable for ป.5
    const r = rng();
    if (r < 0.55) return 'hits';
    if (r < 0.82) return 'score';
    return 'accuracy';
  }

  function chooseMiniKind(rng){
    const r = rng();
    if (r < 0.45) return 'streak';
    if (r < 0.75) return 'fast_hits';
    return 'no_miss';
  }

  function startStormSchedule(){
    const cfg = diffCfg(S.diff);
    const t = nowMs();
    // next storm in random gap
    const gap = (cfg.stormGapSec[0] + (cfg.stormGapSec[1]-cfg.stormGapSec[0]) * S.rng()) * 1000;
    S.stormNextAt = t + gap;
    S.stormEndAt = 0;
  }

  function maybeStartStorm(){
    if (S.runMode === 'practice') return;
    if (S.runMode === 'research') return; // keep stable
    const cfg = diffCfg(S.diff);
    const t = nowMs();
    if (S.storm) return;
    if (S.stormNextAt && t < S.stormNextAt) return;

    // probabilistic start when due
    if (S.rng() <= cfg.stormProb){
      S.storm = true;
      const dur = (cfg.stormDurSec[0] + (cfg.stormDurSec[1]-cfg.stormDurSec[0]) * S.rng()) * 1000;
      S.stormEndAt = t + dur;
      emit('groups:progress', { kind:'storm_on' });
    }
    startStormSchedule();
  }

  function maybeEndStorm(){
    const t = nowMs();
    if (!S.storm) return;
    if (S.stormEndAt && t >= S.stormEndAt){
      S.storm = false;
      S.stormEndAt = 0;
      emit('groups:progress', { kind:'storm_off' });
    }
  }

  // -------------------------
  // UI emit
  // -------------------------
  function emitPower(){
    emit('groups:power', { charge:S.powerCharge|0, threshold:S.powerThreshold|0 });
  }

  function emitQuest(force){
    const t = nowMs();
    if (!force && (t - S.lastUiAt) < S.uiEveryMs) return;
    S.lastUiAt = t;

    // GOAL
    const gTot = Math.max(1, S.goalTotal|0);
    const gNow = clamp(S.goalNow|0, 0, gTot);
    const goalPct = Math.round((gNow / gTot) * 100);

    // MINI
    let miniLeftSec = 0;
    if (S.miniActive){
      miniLeftSec = Math.max(0, Math.ceil((S.miniEndAt - t)/1000));
    }

    const mTot = Math.max(1, S.miniTotal|0);
    const mNow = clamp(S.miniNow|0, 0, mTot);
    const miniPct = Math.round((mNow / mTot) * 100);

    emit('quest:update', {
      // goal
      goalTitle: S.goalTitle,
      goalNow: gNow,
      goalTotal: gTot,
      goalPct,

      // mini
      miniTitle: S.miniTitle,
      miniNow: mNow,
      miniTotal: mTot,
      miniPct,
      miniTimeLeftSec: miniLeftSec,

      // group
      groupKey: S.groupKey,
      groupName: S.groupName
    });
  }

  // -------------------------
  // Switch group
  // -------------------------
  function switchGroup(nextKey){
    const cur = S.groupKey;
    const g = nextKey ? groupByKey(nextKey) : pickGroup(S.rng, cur);
    S.groupKey = g.key;
    S.groupName = g.name;

    // reset power
    S.powerCharge = 0;
    emitPower();

    emit('groups:progress', { kind:'perfect_switch', groupKey:S.groupKey, groupName:S.groupName });
    emitQuest(true);
  }

  // -------------------------
  // Goal/Mini lifecycle
  // -------------------------
  function startGoal(){
    const cfg = diffCfg(S.diff);

    S.goalKind = chooseGoalKind(S.rng);
    S.goalDone = false;
    S.goalNow = 0;

    if (S.goalKind === 'hits'){
      S.goalTotal = cfg.goalTotalHits;
      S.goalTitle = 'ยิงให้ถูกหมู่สะสม';
    }else if (S.goalKind === 'score'){
      S.goalTotal = cfg.goalScore;
      S.goalTitle = 'ทำคะแนนให้ถึงเป้า';
    }else{
      // accuracy
      S.goalTotal = 85; // percent
      S.goalTitle = 'รักษาความแม่น ≥ 85%';
    }
    emitQuest(true);
  }

  function startMini(){
    const cfg = diffCfg(S.diff);

    S.miniKind = chooseMiniKind(S.rng);
    S.miniTotal = cfg.miniTotal;
    S.miniNow = 0;
    S.miniDone = false;
    S.miniActive = true;
    S.miniWindowSec = cfg.miniWindowSec;

    const t = nowMs();
    S.miniEndAt = t + (S.miniWindowSec * 1000);

    if (S.miniKind === 'streak'){
      S.miniTitle = `ทำคอมโบให้ถึง ${S.miniTotal}`;
    }else if (S.miniKind === 'fast_hits'){
      S.miniTitle = `ยิงถูก ${S.miniTotal} ครั้ง ใน ${S.miniWindowSec}s`;
    }else{
      S.miniTitle = `ห้ามพลาด! ยิงถูก ${S.miniTotal} ครั้งติด`;
    }
    emitQuest(true);
  }

  function stopMini(){
    S.miniActive = false;
    S.miniEndAt = 0;
    S.miniNow = 0;
    S.miniDone = false;
    emitQuest(true);
  }

  function checkMiniTimeout(){
    if (!S.miniActive) return;
    const t = nowMs();
    if (t >= S.miniEndAt){
      // failed
      S.miniActive = false;
      S.miniDone = false;
      // next mini later: schedule by calling startMini from engine when desired
      emitQuest(true);
    }
  }

  function updateGoalOnHit(hit){
    if (S.goalDone) return;

    if (S.goalKind === 'hits'){
      if (hit.ok) S.goalNow++;
    }else if (S.goalKind === 'score'){
      S.goalNow = Math.max(0, S.score|0);
    }else{
      // accuracy goal uses accuracyPct
      S.goalNow = clamp(S.accuracyPct|0, 0, 100);
    }

    if (S.goalNow >= S.goalTotal){
      S.goalDone = true;
      // reward: instant switch
      emit('groups:progress', { kind:'boss_down', reason:'goal_done' }); // reuse fun banner path
      switchGroup(); // random new group
    }
  }

  function updateMiniOnHit(hit){
    if (!S.miniActive) return;

    if (S.miniKind === 'streak'){
      if (hit.ok) S.miniNow = clamp(S.miniNow + 1, 0, S.miniTotal);
      else S.miniNow = 0;
    }else if (S.miniKind === 'fast_hits'){
      if (hit.ok) S.miniNow = clamp(S.miniNow + 1, 0, S.miniTotal);
    }else{
      // no_miss: ok increments, miss resets
      if (hit.ok) S.miniNow = clamp(S.miniNow + 1, 0, S.miniTotal);
      else S.miniNow = 0;
    }

    if (S.miniNow >= S.miniTotal){
      S.miniDone = true;
      S.miniActive = false;

      // reward: +power boost
      S.powerCharge = clamp(S.powerCharge + 2, 0, S.powerThreshold);
      emit('groups:progress', { kind:'boss_down', reason:'mini_done' }); // fun banner
      emitPower();
    }
  }

  // -------------------------
  // Public API expected by engine
  // -------------------------
  function init(opts){
    opts = opts || {};
    S.runMode = String(opts.runMode || 'play').toLowerCase();
    S.diff    = String(opts.diff || 'normal').toLowerCase();
    S.style   = String(opts.style || 'mix').toLowerCase();
    S.seed    = String(opts.seed || opts.studySeed || Date.now());

    S.rng = makeRng(S.seed + '::quests');

    // choose starting group
    const g = pickGroup(S.rng, '');
    S.groupKey = g.key;
    S.groupName = g.name;

    const cfg = diffCfg(S.diff);
    S.powerThreshold = cfg.powerThreshold;
    S.powerCharge = 0;

    // reset signals
    S.combo = 0; S.misses = 0; S.accuracyPct = 0; S.score = 0;
    S.lastHitAt = 0;

    // storm schedule
    S.storm = false;
    startStormSchedule();

    // quests
    startGoal();
    startMini();

    S.inited = true;
    emitPower();
    emitQuest(true);

    return getState();
  }

  function onStartRound(){
    // hook if engine wants
    if (!S.inited) return;
    emitQuest(true);
  }

  function onEndRound(reason){
    // stop mini to avoid stale UI
    if (!S.inited) return;
    stopMini();
    emitQuest(true);
    emit('groups:progress', { kind:'end', reason:String(reason||'end') });
  }

  function onTick(payload){
    if (!S.inited) return;
    // tick storms + mini timeout
    maybeEndStorm();
    maybeStartStorm();
    checkMiniTimeout();

    // payload may include leftSec; we only use it indirectly (UI reads from other event)
    emitQuest(false);
  }

  function onHit(hit){
    if (!S.inited) return;

    hit = hit || {};
    const ok = !!hit.ok;

    // signals from engine
    S.combo = Number(hit.combo ?? S.combo) || 0;
    S.misses = Number(hit.misses ?? S.misses) || 0;
    S.accuracyPct = clamp(hit.accuracyPct ?? S.accuracyPct, 0, 100);
    S.score = Number(hit.score ?? S.score) || 0;
    S.lastHitAt = nowMs();

    // power charging: ok adds 1, miss adds 0
    if (ok){
      S.powerCharge = clamp(S.powerCharge + 1, 0, S.powerThreshold);
      emitPower();
      if (S.powerCharge >= S.powerThreshold){
        // switch group reward
        emit('groups:progress', { kind:'boss_spawn', reason:'power_full' });
        switchGroup();
      }
    }

    // update quests
    updateGoalOnHit({ ok, groupKey: hit.groupKey });
    updateMiniOnHit({ ok });

    emitQuest(true);
  }

  function forceSwitchGroup(nextKey){
    if (!S.inited) return;
    switchGroup(nextKey);
  }

  function getState(){
    return {
      inited:S.inited,
      runMode:S.runMode,
      diff:S.diff,
      style:S.style,
      seed:S.seed,
      groupKey:S.groupKey,
      groupName:S.groupName,
      powerCharge:S.powerCharge,
      powerThreshold:S.powerThreshold,
      goalKind:S.goalKind,
      goalNow:S.goalNow,
      goalTotal:S.goalTotal,
      goalTitle:S.goalTitle,
      miniKind:S.miniKind,
      miniNow:S.miniNow,
      miniTotal:S.miniTotal,
      miniTitle:S.miniTitle,
      miniActive:S.miniActive
    };
  }

  // expose
  WIN.GroupsVR.Quests = {
    __loaded:true,
    init,
    onStartRound,
    onEndRound,
    onTick,
    onHit,
    forceSwitchGroup,
    getState,
    // helpers for debug
    _emitQuest: ()=>emitQuest(true),
    _emitPower: ()=>emitPower()
  };

})();