// === /herohealth/vr-goodjunk/goodjunk.ai-pack.js ===
// GoodJunkVR AI PACK — FAIR (v1)
// ✅ Missions: GOAL chain + MINI (Plate-compatible via quest:update)
// ✅ DD FAIR: adjusts spawnMs/ttl/ratios every 1s (play only; research OFF)
// ✅ Prediction: miss/expire burst -> coach tip + suggest assist (shield/star)
// ✅ DL-ready: featureTail (no inference heavy) appended at end summary
//
// Events used:
//  - emits: quest:update, hha:coach
//  - listens: none (engine calls methods)
//  - dispatch suggest: WIN.dispatchEvent('gj:ai:suggest', {type, what, pick})
//
// Usage:
//  const AI = createGoodJunkAIPack({ mode, seed, rng, nowMs, emit });
//  AI.bindHUD({ setGoalText, setMiniText });
//  AI.onStart(...), AI.onHit(...), AI.onExpireGood(...), AI.onTick1s(...), AI.onEnd(...)
//  AI.getDD() -> {spawnMs, ttlGood, ttlPower, ratio:{good,junk,star,shield}}

'use strict';

export function createGoodJunkAIPack(cfg={}){
  const WIN = window;
  const DOC = document;

  const mode = String(cfg.mode||'play').toLowerCase(); // play | research
  const isPlay = (mode === 'play');
  const seed = String(cfg.seed ?? Date.now());
  const rng  = (typeof cfg.rng === 'function') ? cfg.rng : Math.random;
  const nowMs = (typeof cfg.nowMs === 'function') ? cfg.nowMs : (()=> (performance?.now?.() ?? Date.now()));
  const emit = (typeof cfg.emit === 'function') ? cfg.emit : ((n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} });

  const clamp = (v,min,max)=>Math.max(min, Math.min(max, Number(v)||0));

  // ---------- DOM fallbacks (ไม่บังคับ) ----------
  const dom = {
    goalName: null,  // #hud-goal
    miniName: null,  // #hud-mini
  };

  function bindDomOnce(){
    if(dom.goalName) return;
    dom.goalName = DOC.getElementById('hud-goal') || null;
    dom.miniName = DOC.getElementById('hud-mini') || null;
  }

  // ---------- HUD callbacks (optional) ----------
  let HUD = {
    setGoalText: null,
    setMiniText: null
  };

  function bindHUD(h){
    HUD = Object.assign(HUD, h||{});
    bindDomOnce();
  }

  function setGoalUI(name, sub, cur, target){
    try{
      if(dom.goalName) dom.goalName.textContent = String(name || '—');
    }catch{}
    if(typeof HUD.setGoalText === 'function'){
      try{ HUD.setGoalText(name, sub, cur, target); }catch{}
    }
  }

  function setMiniUI(name, sub, cur, target, done, secLeft){
    try{
      if(dom.miniName) dom.miniName.textContent = String(name || '—');
    }catch{}
    if(typeof HUD.setMiniText === 'function'){
      try{ HUD.setMiniText(name, sub, cur, target, done, secLeft); }catch{}
    }
  }

  // ---------- Missions ----------
  // GOAL chain (ง่าย ๆ แต่สนุก + เร้าใจแบบ “ทำครบแล้วไปต่อ”)
  const GOALS = [
    { id:'g1', name:'เก็บของดี 8 ชิ้น',    sub:'เล็งให้โดนของดี',           metric:'hitGood',   target:8 },
    { id:'g2', name:'คอมโบให้ได้ 6',       sub:'ยิงของดีติดกัน',            metric:'comboMax',  target:6 },
    { id:'g3', name:'หลบของเสีย 6 วิ',     sub:'อย่าให้ MISS เพิ่ม',        metric:'noMissSec', target:6 },
    { id:'g4', name:'เก็บของดี 12 ชิ้น',   sub:'เพิ่มความเร็วอีกนิด',        metric:'hitGood',   target:12 },
    { id:'g5', name:'MISS ไม่เกิน 5',      sub:'คุมเกมจนจบ',                metric:'missCap',   target:5 },
  ];

  const M = {
    goalIndex: 0,
    goalCur: 0,
    goalTarget: GOALS[0].target,

    // special counters
    noMissTimerSec: 0,
    noMissStartMs: 0,
    lastMissCount: 0,

    goalsCleared: 0,

    // MINI: “ครบ 3 หมู่ใน 12 วิ”
    miniWindowSec: 12,
    miniStartMs: 0,
    miniGroups: new Set(),
    miniDone: false,
    miniTarget: 3,

    // status for end
    lastGoalName: GOALS[0].name,
    lastMiniName: `ครบ ${3} หมู่ใน ${12} วิ`,
  };

  function resetMiniWindow(){
    M.miniStartMs = nowMs();
    M.miniGroups.clear();
    M.miniDone = false;
  }

  function resetNoMiss(){
    M.noMissStartMs = nowMs();
    M.noMissTimerSec = 0;
  }

  function currentGoal(){
    return GOALS[clamp(M.goalIndex,0,GOALS.length-1)|0];
  }

  function updateQuestEmit(allDone=false){
    const g = currentGoal();
    const now = nowMs();

    // mini seconds left
    let secLeft = M.miniWindowSec - Math.floor((now - M.miniStartMs)/1000);
    secLeft = clamp(secLeft, 0, M.miniWindowSec);

    setGoalUI(g.name, g.sub, M.goalCur, g.target);
    setMiniUI(M.lastMiniName, 'โบนัส STAR/SHIELD', M.miniGroups.size, M.miniTarget, M.miniDone, secLeft);

    // Plate-compatible event
    try{
      emit('quest:update', {
        goal:{ name:g.name, sub:g.sub, cur:M.goalCur, target:g.target },
        mini:{ name:M.lastMiniName, sub:'โบนัส STAR/SHIELD', cur:M.miniGroups.size, target:M.miniTarget, done:M.miniDone, secLeft },
        allDone: !!allDone
      });
    }catch{}
  }

  function nextGoal(){
    M.goalsCleared++;
    M.goalIndex = clamp(M.goalIndex+1, 0, GOALS.length-1);
    M.goalCur = 0;

    const g = currentGoal();
    M.goalTarget = g.target;
    M.lastGoalName = g.name;

    // reset special
    if(g.metric === 'noMissSec'){
      resetNoMiss();
      M.lastMissCount = 0;
    }
    updateQuestEmit(false);

    // coach feedback
    try{
      emit('hha:coach', { msg:`✅ ผ่าน GOAL! ต่อไป: ${g.name}`, tag:'goal_next' });
    }catch{}
  }

  function ensureGoalInitialized(){
    const g = currentGoal();
    M.goalTarget = g.target;
    M.lastGoalName = g.name;

    if(!M.miniStartMs) resetMiniWindow();
    if(g.metric === 'noMissSec' && !M.noMissStartMs) resetNoMiss();

    updateQuestEmit(false);
  }

  // ---------- DD FAIR ----------
  // หลักการ: ถ้า miss/expire burst สูง -> “ผ่อน” (ช้าลง + TTL ยาวขึ้น + junk ลด)
  // ถ้าเล่นดี -> “เร้าใจ” (เร็วขึ้นนิด + junk เพิ่มนิด + TTL สั้นลงเล็กน้อย)
  const DD = {
    spawnMs: 900,
    ttlGood: 1600,
    ttlPower: 1700,
    ratio: { good:0.70, junk:0.26, star:0.02, shield:0.02 }
  };

  // rate-limit coach tips
  let lastCoachMs = 0;
  function coach(msg, tag='tip'){
    const t = nowMs();
    if(t - lastCoachMs < 3600) return; // 3.6s
    lastCoachMs = t;
    try{ emit('hha:coach', { msg, tag }); }catch{}
  }

  function suggestAssistShieldOrStar(pick){
    try{
      WIN.dispatchEvent(new CustomEvent('gj:ai:suggest', { detail:{ type:'assist', what:'shieldOrStar', pick } }));
    }catch{}
  }

  function suggestRewardPowerup(pick){
    try{
      WIN.dispatchEvent(new CustomEvent('gj:ai:suggest', { detail:{ type:'reward', what:'powerup', pick } }));
    }catch{}
  }

  function applyDD({acc, missBurst5, expireBurst5, fever, missRate}){
    if(!isPlay) return;

    // base
    let spawn = DD.spawnMs;
    let ttlG  = DD.ttlGood;

    // difficulty signals
    const badBurst = (missBurst5 >= 2) || (expireBurst5 >= 2);
    const highFever = fever >= 70;

    if(badBurst || highFever || missRate > 0.28){
      // ease
      spawn = clamp(spawn + 90, 860, 1040);
      ttlG  = clamp(ttlG  + 120, 1580, 2000);

      // reduce junk a bit, add small shield
      const junk = clamp(DD.ratio.junk - 0.02, 0.18, 0.30);
      const good = clamp(DD.ratio.good + 0.02, 0.62, 0.78);

      DD.ratio = { good, junk, star:0.02, shield: clamp(1 - good - junk - 0.02, 0.02, 0.08) };
    }
    else if(acc >= 0.82 && missRate < 0.18 && fever < 55){
      // excite
      spawn = clamp(spawn - 60, 760, 980);
      ttlG  = clamp(ttlG  - 80, 1320, 1700);

      const junk = clamp(DD.ratio.junk + 0.02, 0.22, 0.34);
      const good = clamp(DD.ratio.good - 0.02, 0.60, 0.76);

      DD.ratio = { good, junk, star:0.02, shield: clamp(1 - good - junk - 0.02, 0.02, 0.06) };
    }

    DD.spawnMs = spawn;
    DD.ttlGood = ttlG;
    DD.ttlPower = clamp(DD.ttlPower, 1500, 1900);
  }

  function predictionTips({missBurst5, expireBurst5, fever, combo, miss}){
    // “AI Prediction” แบบเบา ๆ แต่ใช้งานจริงได้
    if(missBurst5 >= 2){
      coach('ระวัง! พลาดติด ๆ กัน ลอง “นิ่ง 1 วิ” แล้วค่อยยิง 🎯', 'pred_miss_burst');
      suggestAssistShieldOrStar(miss >= 3 ? 'shield' : 'star');
    }
    else if(expireBurst5 >= 2){
      coach('เป้าหายบ่อย = ช้าไปนิด! ลองเล็งกลางจอแล้วกดเร็วขึ้น ⚡', 'pred_expire_burst');
      suggestAssistShieldOrStar('star');
    }
    else if(fever >= 75){
      coach('FEVER สูง! โฟกัส “ของดีทีละชิ้น” อย่าฝืนยิงมั่ว 🧠', 'pred_fever');
    }
    else if(combo >= 7){
      coach('กำลังมา! อีกนิดจะคอมโบใหญ่ 🔥', 'pred_combo');
    }
  }

  // ---------- Hooks called by engine ----------
  function onStart(meta={}){
    ensureGoalInitialized();
    resetMiniWindow();
    resetNoMiss();
    lastCoachMs = 0;

    // research: fixed dd
    if(!isPlay){
      DD.spawnMs = 900;
      DD.ttlGood = 1600;
      DD.ttlPower = 1700;
      DD.ratio = { good:0.70, junk:0.26, star:0.02, shield:0.02 };
    }

    coach('เริ่มเลย! เก็บของดี เลี่ยงของเสีย ⭐🛡️ มีโบนัสช่วย', 'start');
  }

  function onHit(evt={}){
    // evt: {kind:'good'|'junk', groupId, shieldRemaining, fever, score, combo, miss}
    const kind = String(evt.kind||'').toLowerCase();

    // MINI window timeout reset
    const t = nowMs();
    if(t - M.miniStartMs > M.miniWindowSec*1000){
      resetMiniWindow();
    }

    if(kind === 'good'){
      // record groups for MINI
      const gid = Number(evt.groupId||0);
      if(gid>=1 && gid<=5) M.miniGroups.add(gid);

      // if mini success
      if(!M.miniDone && M.miniGroups.size >= M.miniTarget){
        M.miniDone = true;

        // reward: deterministic-ish pick using rng
        const pick = (rng() < 0.55) ? 'shield' : 'star';
        suggestRewardPowerup(pick);
        coach(`สุดยอด! ครบ ${M.miniTarget} หมู่ใน ${M.miniWindowSec} วิ 🎁 ได้โบนัส!`, 'mini_done');
      }
    }

    // GOAL progress update
    const g = currentGoal();

    if(g.metric === 'hitGood'){
      if(kind === 'good'){
        M.goalCur = clamp(M.goalCur + 1, 0, g.target);
        if(M.goalCur >= g.target) nextGoal();
      }
    }
    else if(g.metric === 'comboMax'){
      // engine ส่ง combo ปัจจุบันมาแล้ว
      const c = Number(evt.combo||0);
      M.goalCur = clamp(Math.max(M.goalCur, c), 0, g.target);
      if(M.goalCur >= g.target) nextGoal();
    }
    else if(g.metric === 'noMissSec'){
      // ถ้า miss เพิ่ม จะ reset
      const missNow = Number(evt.miss||0);
      if(missNow > M.lastMissCount){
        M.lastMissCount = missNow;
        resetNoMiss();
        M.goalCur = 0;
        coach('โอ๊ะ พลาดแล้ว! ลองใหม่: “หลบของเสีย 6 วิ”', 'goal_reset');
      }
    }
    else if(g.metric === 'missCap'){
      // goal นี้จะตัดสินตอนจบเป็นหลัก แต่แสดงความคืบหน้าเป็น “เหลือโควตา”
      const missNow = Number(evt.miss||0);
      const left = clamp(g.target - missNow, 0, g.target);
      M.goalCur = left; // แสดงเป็น “โควตาที่เหลือ”
    }

    updateQuestEmit(false);
  }

  function onExpireGood(evt={}){
    // optional: could nudge mini reset or coach
    // (ปล่อยให้ prediction ทำงานจาก burst ที่ engine ส่งมา)
  }

  function onTick1s(m={}){
    // m: {acc, missRate, missBurst5, expireBurst5, fever, combo, miss, missBurst}
    const g = currentGoal();

    // noMissSec goal update
    if(g.metric === 'noMissSec'){
      const now = nowMs();
      M.noMissTimerSec = Math.floor((now - M.noMissStartMs)/1000);
      M.goalCur = clamp(M.noMissTimerSec, 0, g.target);
      if(M.goalCur >= g.target) nextGoal();
    }

    // MINI timer update
    const t = nowMs();
    if(t - M.miniStartMs > M.miniWindowSec*1000){
      // restart mini window smoothly
      resetMiniWindow();
    }

    // Apply DD + prediction (play only)
    applyDD(m);
    predictionTips(m);

    updateQuestEmit(false);
  }

  function onEnd(meta={}){
    // meta: {reason, goalsDone?}
    const allDone = (M.goalsCleared >= GOALS.length);
    updateQuestEmit(allDone);

    // DL-ready tail (features)
    const featureTail = {
      aiPack: 'fair_v1',
      goalsCleared: M.goalsCleared,
      miniDone: !!M.miniDone,
      dd: {
        spawnMs: DD.spawnMs,
        ttlGood: DD.ttlGood,
        ratio: DD.ratio
      }
    };

    return {
      ai: featureTail
    };
  }

  function getDD(){
    // always return object (engine uses it)
    return {
      spawnMs: DD.spawnMs,
      ttlGood: DD.ttlGood,
      ttlPower: DD.ttlPower,
      ratio: Object.assign({}, DD.ratio)
    };
  }

  return {
    bindHUD,
    getDD,
    onStart,
    onHit,
    onExpireGood,
    onTick1s,
    onEnd
  };
}