// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard + FUN PACK A/B/C
// A) Shield power-up (block 1 junk hit)
// B) Boss Swap (screen swap/shake trick during boss)
// C) Rank S/A/B/C in end summary
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

const WIN = window;
const DOC = document;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};
const pct = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const STATE = {
  running:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  timeLeft:0,
  timer:null,

  // groups
  g:[0,0,0,0,0],

  // quest
  goal:{ name:'เติมจานให้ครบ 5 หมู่', sub:'เก็บอาหารให้ครบทุกหมู่', cur:0, target:5, done:false },
  mini:{ name:'ความแม่นยำ', sub:'คุมความแม่น ≥ 80%', cur:0, target:80, done:false },

  // boss mini: survive
  bossMini:{ active:false, done:false, cur:0, target:10, timer:null },

  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // NEW: shield
  shield:0,

  cfg:null,
  rng:Math.random,

  engine:null,
  engineMount:null,

  bossOn:false,
  stormOn:false,
  _bossApplied:false,
  _stormApplied:false,

  // decoy (flip kind temporarily)
  decoyOn:false,
  decoyUntil:0,
  decoyCooldownUntil:0,

  // NEW: boss swap trick
  swapCooldownUntil:0
};

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

function maybeLogEvent(type, data={}){
  if(!STATE.cfg?.logEvents) return;
  emit('hha:event', Object.assign({
    game:'plate',
    type,
    t: Date.now(),
    leftSec: STATE.timeLeft,
    score: STATE.score,
    combo: STATE.combo,
    bossOn: STATE.bossOn,
    stormOn: STATE.stormOn,
    decoyOn: STATE.decoyOn,
    shield: STATE.shield
  }, data));
}

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

function setFx(id, clsOn, on){
  const el = DOC.getElementById(id);
  if(!el) return;
  if(on) el.classList.add(clsOn);
  else el.classList.remove(clsOn);
}

function celebrate(){
  try{
    if(WIN.Particles && typeof WIN.Particles.celebrate === 'function'){
      WIN.Particles.celebrate();
    }
  }catch(_){}
}

function emitQuest(){
  const useBossMini = STATE.bossMini.active && !STATE.bossMini.done;

  emit('quest:update', {
    goal:{
      name: STATE.goal.name,
      sub: STATE.goal.sub,
      cur: STATE.goal.cur,
      target: STATE.goal.target
    },
    mini: useBossMini ? {
      name: '🛡️ รอดบอส',
      sub: '10 วิ ห้ามโดนของหวาน/ทอด',
      cur: STATE.bossMini.cur,
      target: STATE.bossMini.target,
      done: STATE.bossMini.done
    } : {
      name: STATE.mini.name,
      sub: STATE.mini.sub,
      cur: STATE.mini.cur,
      target: STATE.mini.target,
      done: STATE.mini.done
    },
    allDone: STATE.goal.done && (useBossMini ? STATE.bossMini.done : STATE.mini.done)
  });
}

function emitScore(){
  emit('hha:score', { score: STATE.score, combo: STATE.combo, comboMax: STATE.comboMax, shield: STATE.shield });
}

function emitShield(){
  emit('hha:shield', { shield: STATE.shield });
}

function addScore(v){
  STATE.score += v;
  emitScore();
}

function addCombo(){
  STATE.combo++;
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
}
function resetCombo(){ STATE.combo = 0; emitScore(); }

function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function computeRank(endDetail){
  // Simple & kid-friendly (objective)
  const acc = Number(endDetail.accuracyGoodPct ?? 0);
  const miss = Number(endDetail.misses ?? 0);
  const goalOk = (endDetail.goalsCleared ?? 0) >= 1;
  const miniOk = (endDetail.miniCleared ?? 0) >= 1;

  // S: complete goal + (acc≥85) + miss<=2
  if(goalOk && acc >= 85 && miss <= 2) return 'S';
  // A: goal + (acc≥75) + miss<=4
  if(goalOk && acc >= 75 && miss <= 4) return 'A';
  // B: goal OR (acc≥65)
  if(goalOk || acc >= 65) return 'B';
  // C: otherwise (still show encouragement via coach)
  return 'C';
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);
  try{ clearInterval(STATE.bossMini.timer); }catch(_){}
  STATE.bossMini.timer = null;

  setFx('bossFx','boss-on', false);
  setFx('bossFx','boss-panic', false);
  setFx('stormFx','storm-on', false);

  const endDetail = {
    reason,
    gameMode:'plate',
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,

    miniCleared: (STATE.bossMini.done || STATE.mini.done) ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: pct(accuracy() * 100),

    g1: STATE.g[0], g2: STATE.g[1], g3: STATE.g[2], g4: STATE.g[3], g5: STATE.g[4],

    bossOn: STATE.bossOn,
    stormOn: STATE.stormOn,
    shieldLeft: STATE.shield
  };

  endDetail.rank = computeRank(endDetail);

  emit('hha:end', endDetail);

  // final encouragement (optional)
  if(endDetail.rank === 'S') coach('โหดมาก! เก่งสุด ๆ ระดับ S 🌟', 'Coach');
  else if(endDetail.rank === 'A') coach('สุดยอด! ได้ A แล้ว 👍', 'Coach');
  else if(endDetail.rank === 'B') coach('ดีมาก! อีกนิดเดียวได้ A แน่ 💪', 'Coach');
  else coach('ไม่เป็นไร รอบหน้าทำได้ดีกว่าเดิมแน่ 😊', 'Coach');

  maybeLogEvent('end', endDetail);
}

/* -----------------------------
   Boss mini (survive)
------------------------------*/
function startBossMini(){
  if(STATE.bossMini.active || STATE.bossMini.done) return;
  STATE.bossMini.active = true;
  STATE.bossMini.cur = 0;

  try{ clearInterval(STATE.bossMini.timer); }catch(_){}
  STATE.bossMini.timer = setInterval(()=>{
    if(!STATE.running || STATE.ended) return;
    if(!STATE.bossMini.active || STATE.bossMini.done) return;

    STATE.bossMini.cur++;
    emitQuest();

    if(STATE.bossMini.cur >= STATE.bossMini.target){
      STATE.bossMini.done = true;
      STATE.bossMini.active = false;

      addScore(350);
      celebrate();
      coach('สุดยอด! รอดบอสครบ 10 วิ 🎉 +350', 'Boss');
      maybeLogEvent('bossmini_complete', { bonus:350 });
      emitQuest();
    }
  }, 1000);

  coach('🛡️ มินิเควส: รอด 10 วิ ห้ามโดนของหวาน/ทอด!', 'Boss');
  maybeLogEvent('bossmini_start', { target: STATE.bossMini.target });
  emitQuest();
}

/* -----------------------------
   Spawner rebuild
------------------------------*/
function rebuildSpawner({ spawnRate, goodW, junkW, shieldW }){
  try{
    if(STATE.engine && typeof STATE.engine.destroy === 'function') STATE.engine.destroy();
    else if(STATE.engine && typeof STATE.engine.stop === 'function') STATE.engine.stop();
  }catch(_){}

  STATE.engine = spawnBoot({
    mount: STATE.engineMount,
    seed: STATE.cfg.seed,
    spawnRate,
    sizeRange:[44,64],
    kinds:[
      { kind:'good',   weight: goodW },
      { kind:'junk',   weight: junkW },
      { kind:'shield', weight: shieldW }
    ],
    onHit:(t)=> onHitTarget(t),
    onExpire:(t)=>{
      // expire penalty only for real good when decoy OFF
      if(!STATE.decoyOn && t.kind === 'good') onExpireGood();
    }
  });
}

/* -----------------------------
   Boss / Storm phases
------------------------------*/
function applyBossIfNeeded(){
  const run = (STATE.cfg?.runMode || 'play').toLowerCase();
  if(run !== 'play') return;
  if(STATE._bossApplied) return;

  const trigger = (STATE.goal.done === true) || (STATE.timeLeft <= 35);
  if(!trigger) return;

  STATE._bossApplied = true;
  STATE.bossOn = true;

  const baseRate = (STATE.cfg.diff === 'hard') ? 700 : 900;
  const bossRate = Math.max(620, Math.round(baseRate * 0.92));

  setFx('bossFx','boss-on', true);
  coach('👿 BOSS มาแล้ว! ระวังของหวาน/ทอด + ของลวง + สลับจอ!', 'Boss');

  // boss mix (more junk + some shield)
  rebuildSpawner({ spawnRate: bossRate, goodW:0.56, junkW:0.38, shieldW:0.06 });
  maybeLogEvent('phase_boss_on', { bossRate });

  startBossMini();
}

function applyStormIfNeeded(){
  const run = (STATE.cfg?.runMode || 'play').toLowerCase();
  if(run !== 'play') return;
  if(STATE._stormApplied) return;
  if(STATE.timeLeft > 15) return;

  STATE._stormApplied = true;
  STATE.stormOn = true;

  const baseRate = (STATE.cfg.diff === 'hard') ? 700 : 900;
  const stormRate = Math.max(580, Math.round(baseRate * 0.85));

  setFx('stormFx','storm-on', true);
  setFx('bossFx','boss-panic', true);
  coach('⏱️ ช่วงท้าย! เร่งนิด ๆ แล้วนะ', 'System');

  if(STATE.bossOn) rebuildSpawner({ spawnRate: stormRate, goodW:0.56, junkW:0.38, shieldW:0.06 });
  else rebuildSpawner({ spawnRate: stormRate, goodW:0.70, junkW:0.27, shieldW:0.03 });

  maybeLogEvent('phase_storm_on', { stormRate });
}

/* -----------------------------
   Decoy + Swap tick
------------------------------*/
function maybeDecoyTick(){
  const run = (STATE.cfg?.runMode || 'play').toLowerCase();
  if(run !== 'play') return;
  if(!STATE.bossOn) return;

  const now = Date.now();

  if(STATE.decoyOn && now >= STATE.decoyUntil){
    STATE.decoyOn = false;
    DOC.body.classList.remove('decoy-on');
    coach('✅ ของลวงหายไปแล้ว', 'Boss');
    maybeLogEvent('decoy_off', {});
    return;
  }
  if(STATE.decoyOn) return;
  if(now < STATE.decoyCooldownUntil) return;

  // about once every ~7-11s
  const p = 0.14;
  if(STATE.rng() > p) return;

  const dur = 2000 + Math.floor(STATE.rng()*1200);
  STATE.decoyOn = true;
  STATE.decoyUntil = now + dur;

  const cd = 7000 + Math.floor(STATE.rng()*4000);
  STATE.decoyCooldownUntil = now + cd;

  DOC.body.classList.add('decoy-on');
  coach('😵 ของลวงมา! (สลับดี/ไม่ดีชั่วคราว)', 'Boss');
  maybeLogEvent('decoy_on', { durMs: dur, cooldownMs: cd });
}

function bossSwapTrick(){
  const run = (STATE.cfg?.runMode || 'play').toLowerCase();
  if(run !== 'play') return;
  if(!STATE.bossOn) return;
  if(!STATE.engineMount) return;

  const now = Date.now();
  if(now < STATE.swapCooldownUntil) return;

  // cooldown 9-13s
  STATE.swapCooldownUntil = now + (9000 + Math.floor(STATE.rng()*4000));

  // visual swap: quick "left-right flip feel" by translating playfield
  try{
    const el = STATE.engineMount;
    const dir = (STATE.rng() < 0.5) ? -1 : 1;
    el.animate(
      [
        { transform:'translateX(0px)' },
        { transform:`translateX(${dir * 90}px)` },
        { transform:`translateX(${dir * -70}px)` },
        { transform:'translateX(0px)' }
      ],
      { duration: 520, easing: 'cubic-bezier(.2,.9,.2,1)' }
    );
    coach('🔄 SWAP!', 'Boss');
    maybeLogEvent('boss_swap', { dir });
  }catch(_){}
}

/* -----------------------------
   Timer
------------------------------*/
function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    STATE.timeLeft--;

    applyBossIfNeeded();
    applyStormIfNeeded();

    maybeDecoyTick();
    bossSwapTrick();

    emit('hha:time', { leftSec: STATE.timeLeft });

    if(STATE.timeLeft <= 0) endGame('timeup');
  }, 1000);
}

/* -----------------------------
   Hit handlers
------------------------------*/
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      celebrate();
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach');
      applyBossIfNeeded();
    }
  }

  // accuracy mini (only if bossMini not running)
  if(!(STATE.bossMini.active || STATE.bossMini.done)){
    const accPct = accuracy() * 100;
    STATE.mini.cur = Math.round(accPct);
    if(!STATE.mini.done && accPct >= STATE.mini.target){
      STATE.mini.done = true;
      celebrate();
      coach('ความแม่นยำดีมาก! 👍', 'Coach');
    }
  }

  emitQuest();
  maybeLogEvent('hit_good', { groupIndex });
}

function onHitJunk(){
  // Shield blocks junk
  if(STATE.shield > 0){
    STATE.shield--;
    emitShield();
    addScore(20); // tiny reward for using shield
    coach('🛡️ Shield กันไว้แล้ว!', 'Coach');
    maybeLogEvent('shield_block', {});
    // boss mini: still counts as "not hit junk" because it blocked
    return;
  }

  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();

  addScore(STATE.bossOn ? -70 : -50);

  if(STATE.bossMini.active && !STATE.bossMini.done){
    STATE.bossMini.active = false;
    try{ clearInterval(STATE.bossMini.timer); }catch(_){}
    STATE.bossMini.timer = null;

    coach('❌ โดนของหวาน/ทอด! มินิเควสล้มเหลว', 'Boss');
    maybeLogEvent('bossmini_fail', {});
  } else {
    coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');
  }

  emitQuest();
  maybeLogEvent('hit_junk', {});
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  emitQuest();
  maybeLogEvent('expire_good', {});
}

function onHitShield(){
  // cap shield to keep it fair for kids (ไม่โกง)
  const before = STATE.shield;
  STATE.shield = clamp(STATE.shield + 1, 0, 2);
  if(STATE.shield > before){
    addScore(120);
    celebrate();
    coach('🛡️ ได้ Shield +1!', 'Coach');
  }else{
    addScore(40);
    coach('🛡️ Shield เต็มแล้ว!', 'Coach');
  }
  emitShield();
  maybeLogEvent('hit_shield', { shield: STATE.shield });
}

function onHitTarget(t){
  // decoy flips good/junk temporarily (shield unaffected)
  const effectiveKind =
    (STATE.decoyOn && (t.kind === 'good' || t.kind === 'junk'))
      ? (t.kind === 'good' ? 'junk' : 'good')
      : t.kind;

  if(effectiveKind === 'good'){
    const gi = t.groupIndex ?? Math.floor(STATE.rng()*5);
    onHitGood(gi);
  }else if(effectiveKind === 'junk'){
    onHitJunk();
  }else{
    onHitShield();
  }
}

/* -----------------------------
   Base spawner
------------------------------*/
function makeSpawner(mount){
  const baseRate = (STATE.cfg.diff === 'hard') ? 700 : 900;

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: baseRate,
    sizeRange:[44,64],
    kinds:[
      { kind:'good',   weight:0.70 },
      { kind:'junk',   weight:0.27 },
      { kind:'shield', weight:0.03 }
    ],
    onHit:(t)=> onHitTarget(t),
    onExpire:(t)=>{
      if(!STATE.decoyOn && t.kind === 'good') onExpireGood();
    }
  });
}

/* -----------------------------
   Boot
------------------------------*/
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  STATE.cfg = cfg;
  STATE.engineMount = mount;

  STATE.running = true;
  STATE.ended = false;

  STATE.score = 0;
  STATE.combo = 0;
  STATE.comboMax = 0;
  STATE.miss = 0;

  STATE.hitGood = 0;
  STATE.hitJunk = 0;
  STATE.expireGood = 0;

  STATE.g = [0,0,0,0,0];

  STATE.goal.cur = 0;
  STATE.goal.done = false;

  STATE.mini.cur = 0;
  STATE.mini.done = false;

  STATE.bossMini.active = false;
  STATE.bossMini.done = false;
  STATE.bossMini.cur = 0;
  try{ clearInterval(STATE.bossMini.timer); }catch(_){}
  STATE.bossMini.timer = null;

  STATE.shield = 0;
  emitShield();

  STATE.bossOn = false;
  STATE.stormOn = false;
  STATE._bossApplied = false;
  STATE._stormApplied = false;

  STATE.decoyOn = false;
  STATE.decoyUntil = 0;
  STATE.decoyCooldownUntil = 0;
  DOC.body.classList.remove('decoy-on');

  STATE.swapCooldownUntil = 0;

  setFx('bossFx','boss-on', false);
  setFx('bossFx','boss-panic', false);
  setFx('stormFx','storm-on', false);

  const run = (cfg.runMode || 'play').toLowerCase();
  STATE.rng = (run === 'research' || run === 'study')
    ? seededRng(cfg.seed || Date.now())
    : Math.random;

  // default 90 (from boot.js)
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  emit('hha:start', {
    game:'plate',
    gameMode:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft,

    studyId: cfg.studyId || '',
    phase: cfg.phase || '',
    conditionGroup: cfg.conditionGroup || '',
    sessionOrder: cfg.sessionOrder || '',
    blockLabel: cfg.blockLabel || '',
    siteCode: cfg.siteCode || '',
    schoolCode: cfg.schoolCode || '',
    schoolName: cfg.schoolName || '',
    gradeLevel: cfg.gradeLevel || '',
    studentKey: cfg.studentKey || ''
  });

  emitQuest();
  startTimer();

  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
}