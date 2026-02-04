// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (heuristic director)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Fix: "ออกไม่ครบ 5 หมู่" => spawn bias toward missing groups early game
// ✅ Uses decorateTarget(el,target) to set emoji/icon + group
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot) (handled inside mode-factory)
// ✅ End: stop spawner so targets won't "blink" after finish
// ✅ PATCH BADGES: first_play, streak_10, mini_clear_1, boss_clear_1(all_done), score_80p, perfect_run
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { FOOD5, JUNK, pickEmoji, emojiForGroup, labelForGroup } from '../vr/food5-th.js';
import { awardBadge, getPid } from '../badges.safe.js';

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const WIN = window;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function qs(k, d=null){
  try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; }
}

/* ------------------------------------------------
 * BADGES
 * ------------------------------------------------ */
function badgeMeta(extra){
  let pid = '';
  try{ pid = (typeof getPid === 'function') ? (getPid()||'') : ''; }catch(_){}
  const base = {
    pid,
    game: 'plate',
    runMode: String(STATE.cfg?.runMode || qs('run','play') || 'play').toLowerCase(),
    diff: String(STATE.cfg?.diff || qs('diff','normal') || 'normal').toLowerCase(),
    time: Number(STATE.cfg?.durationPlannedSec || qs('time',0)) || 0,
    seed: Number(STATE.cfg?.seed || qs('seed',0)) || 0,
    view: String(qs('view','')).toLowerCase(),
    style: String(qs('style','')).toLowerCase(),
  };
  if(extra && typeof extra === 'object'){
    for(const k of Object.keys(extra)) base[k] = extra[k];
  }
  return base;
}

function awardOnce(badgeId, meta){
  try{ return !!awardBadge('plate', badgeId, badgeMeta(meta)); }catch(_){ return false; }
}

/* ------------------------------------------------
 * Engine state
 * ------------------------------------------------ */
const STATE = {
  running:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  timeLeft:0,
  timer:null,

  // plate groups counts (index 0..4 => groupId 1..5)
  g:[0,0,0,0,0],

  // quest
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่ (อย่างน้อยหมู่ละ 1)',
    cur:0,
    target:5,
    done:false
  },
  mini:{
    name:'ความแม่นยำ',
    sub:'คุมความแม่น ≥ 80%',
    cur:0,
    target:80,
    done:false
  },

  // counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // mode / cfg
  cfg:null,
  rng:Math.random,

  // spawn engine
  engine:null,

  // spawn director
  seen:[false,false,false,false,false], // whether each group has appeared/collected
  spawnSeen:[false,false,false,false,false], // whether each group has spawned at least once
  spawnTick:0,

  // ✅ badges guards (per-run)
  badge_first:false,
  badge_streak10:false,
  badge_goal:false,
  badge_allDone:false,
};

/* ------------------------------------------------
 * Event helpers
 * ------------------------------------------------ */
function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * Quest update
 * ------------------------------------------------ */
function emitQuest(){
  emit('quest:update', {
    goal:{
      name: STATE.goal.name,
      sub: STATE.goal.sub,
      cur: STATE.goal.cur,
      target: STATE.goal.target,
      done: STATE.goal.done
    },
    mini:{
      name: STATE.mini.name,
      sub: STATE.mini.sub,
      cur: STATE.mini.cur,
      target: STATE.mini.target,
      done: STATE.mini.done
    },
    allDone: STATE.goal.done && STATE.mini.done
  });
}

/* ------------------------------------------------
 * Score helpers
 * ------------------------------------------------ */
function addScore(v){
  STATE.score += v;
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax
  });
}

function addCombo(){
  STATE.combo++;
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);

  // ✅ BADGE: streak_10 (once per run)
  if(!STATE.badge_streak10 && STATE.combo >= 10){
    STATE.badge_streak10 = true;
    awardOnce('streak_10', {
      combo: STATE.combo|0,
      comboMax: STATE.comboMax|0,
      score: STATE.score|0,
      miss: STATE.miss|0
    });
  }
}

function resetCombo(){
  STATE.combo = 0;
}

/* ------------------------------------------------
 * Accuracy
 * ------------------------------------------------ */
function accuracy(){
  // total judged: good hit + junk hit + good expired
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function updateMiniFromAccuracy(){
  const accPct = accuracy() * 100;
  STATE.mini.cur = clamp(Math.round(accPct), 0, 100);

  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }
}

/* ------------------------------------------------
 * Badge: all done (goal + mini)
 * ------------------------------------------------ */
function maybeAwardAllDone(){
  if(STATE.badge_allDone) return;
  if(STATE.goal.done && STATE.mini.done){
    STATE.badge_allDone = true;
    // map to boss_clear_1 (Plate has no boss; "ครบทุกเงื่อนไข" = clear)
    awardOnce('boss_clear_1', {
      score: STATE.score|0,
      miss: STATE.miss|0,
      comboMax: STATE.comboMax|0,
      accuracyPct: Math.round(accuracy()*1000)/10,
      g1: STATE.g[0], g2: STATE.g[1], g3: STATE.g[2], g4: STATE.g[3], g5: STATE.g[4]
    });
  }
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function stopSpawner(){
  if(STATE.engine && typeof STATE.engine.stop === 'function'){
    try{ STATE.engine.stop(); }catch{}
  }
  STATE.engine = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  try{ clearInterval(STATE.timer); }catch{}
  STATE.timer = null;

  // stop spawn immediately (prevents target blink after finish)
  stopSpawner();

  // ✅ end badges (score_80p + perfect_run) + allDone
  const accPct1 = Math.round(accuracy() * 1000) / 10; // 1 decimal
  const accPct0 = Math.round(accuracy() * 100);       // integer

  if(accPct0 >= 80){
    awardOnce('score_80p', {
      accuracyPct: accPct0,
      score: STATE.score|0,
      miss: STATE.miss|0,
      comboMax: STATE.comboMax|0
    });
  }
  if((STATE.miss|0) === 0){
    awardOnce('perfect_run', {
      score: STATE.score|0,
      miss: 0,
      comboMax: STATE.comboMax|0,
      accuracyPct: accPct0
    });
  }
  maybeAwardAllDone();

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: accPct1,

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4]
  });
}

/* ------------------------------------------------
 * Timer
 * ------------------------------------------------ */
function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;
    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });
    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function recomputeGoal(){
  // goal = how many groups collected at least 1
  const distinct = STATE.g.filter(v=>v>0).length;
  STATE.goal.cur = distinct;

  if(!STATE.goal.done && distinct >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');

    // ✅ BADGE: mini_clear_1 (Plate main mission clear)
    if(!STATE.badge_goal){
      STATE.badge_goal = true;
      awardOnce('mini_clear_1', {
        score: STATE.score|0,
        miss: STATE.miss|0,
        comboMax: STATE.comboMax|0,
        accuracyPct: Math.round(accuracy()*100),
        g1: STATE.g[0], g2: STATE.g[1], g3: STATE.g[2], g4: STATE.g[3], g5: STATE.g[4]
      });
    }
  }
}

function onHitGood(groupIndex){
  // groupIndex: 0..4
  STATE.hitGood++;
  const gi = clamp(groupIndex, 0, 4);
  STATE.g[gi]++;
  STATE.seen[gi] = true;

  addCombo();
  addScore(100 + STATE.combo * 5);

  recomputeGoal();
  updateMiniFromAccuracy();

  // if both done => award all-done badge (boss_clear_1 mapping)
  maybeAwardAllDone();

  emitQuest();

  emit('hha:judge', {
    kind:'good',
    groupId: gi+1,
    score: STATE.score,
    combo: STATE.combo
  });

  // optional: end early when both goal & mini done in play mode
  if(STATE.cfg && String(STATE.cfg.runMode || 'play').toLowerCase() === 'play'){
    if(STATE.goal.done && STATE.mini.done){
      // give tiny celebration time then end
      setTimeout(()=>{ if(!STATE.ended) endGame('all_done'); }, 420);
    }
  }
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);

  updateMiniFromAccuracy();
  emitQuest();

  emit('hha:judge', {
    kind:'junk',
    score: STATE.score,
    combo: STATE.combo
  });

  coach('ระวัง! ของหวาน/ทอด ⚠️');
}

function onExpireGood(groupIndex){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  updateMiniFromAccuracy();
  emitQuest();

  emit('hha:judge', {
    kind:'expire_good',
    groupId: clamp(groupIndex,0,4)+1,
    score: STATE.score,
    combo: STATE.combo
  });
}

/* ------------------------------------------------
 * Spawn Director (Fix: "ไม่ออกครบ 5 หมู่")
 * ------------------------------------------------
 * แนวคิด:
 * 1) ให้ target good แต่ละอันมี groupId แน่นอน (1..5)
 * 2) ช่วงต้นเกม "ดันหมู่ที่ยังไม่โผล่/ยังไม่เก็บ" ให้ออกบ่อยขึ้น
 * 3) โหมดเล่น (adaptive ON): หลังจากครบ 5 หมู่แล้ว จะดันหมู่ที่เก็บน้อยให้โผล่มากขึ้น
 * 4) โหมดวิจัย: deterministic + adaptive OFF (สม่ำเสมอ ทำซ้ำได้)
 */
function pickGroupIndexForGood(t){
  // t.rng is deterministic from mode-factory (seeded), but we can also use STATE.rng
  const rng = (t && typeof t.rng === 'function') ? t.rng : STATE.rng;

  const missingSpawn = [];
  for(let i=0;i<5;i++) if(!STATE.spawnSeen[i]) missingSpawn.push(i);

  const missingCollect = [];
  for(let i=0;i<5;i++) if(STATE.g[i] <= 0) missingCollect.push(i);

  // Phase A: until each group has spawned at least once, bias strongly to missingSpawn
  if(missingSpawn.length){
    // 85% choose from missingSpawn
    if(rng() < 0.85){
      return missingSpawn[Math.floor(rng()*missingSpawn.length)];
    }
  }

  // Phase B: until player collects all 5, bias to missingCollect
  if(missingCollect.length){
    // 75% choose from missingCollect
    if(rng() < 0.75){
      return missingCollect[Math.floor(rng()*missingCollect.length)];
    }
  }

  // Phase C: after collected all 5
  // - play mode adaptive ON: bias to least collected group
  // - research/study: purely uniform deterministic
  const runMode = (STATE.cfg?.runMode || 'play').toLowerCase();
  const adaptiveOn = (runMode === 'play');

  if(adaptiveOn){
    // pick among the 2 least collected groups with high prob
    const counts = STATE.g.map((c,i)=>({i,c}));
    counts.sort((a,b)=>a.c-b.c);
    const pool = counts.slice(0,2).map(x=>x.i);
    if(rng() < 0.70){
      return pool[Math.floor(rng()*pool.length)];
    }
  }

  // default: uniform 0..4
  return Math.floor(rng()*5);
}

/* ------------------------------------------------
 * Target decorator (emoji/icon + group binding)
 * ------------------------------------------------ */
function decorateTarget(el, t){
  // Choose group for GOOD; keep junk as junk
  if(t.kind === 'good'){
    const gi = pickGroupIndexForGood(t);   // 0..4
    t.groupIndex = gi;                     // bind into target object
    STATE.spawnSeen[gi] = true;

    // render emoji for group (seeded)
    const groupId = gi + 1;
    const emoji = emojiForGroup(t.rng, groupId);

    el.dataset.group = String(groupId);
    el.dataset.kind = 'good';
    el.textContent = emoji;

    // optional: accessible label
    try{ el.setAttribute('aria-label', labelForGroup(groupId)); }catch{}
  }else{
    // JUNK emoji (seeded)
    const emoji = pickEmoji(t.rng, JUNK.emojis);
    el.dataset.group = 'junk';
    el.dataset.kind = 'junk';
    el.textContent = emoji;
    try{ el.setAttribute('aria-label', JUNK.labelTH); }catch{}
  }
}

/* ------------------------------------------------
 * Spawner boot
 * ------------------------------------------------ */
function makeSpawner(mount){
  const diff = (STATE.cfg?.diff || 'normal').toLowerCase();

  // base spawn rate
  let spawnRate = 900;
  if(diff === 'hard') spawnRate = 720;
  else if(diff === 'easy') spawnRate = 1020;

  // Adaptive director (play mode only): tweak spawn rate a bit from performance
  const runMode = (STATE.cfg?.runMode || 'play').toLowerCase();
  const adaptiveOn = (runMode === 'play');

  // mild auto-adjust (NOT used in research/study)
  if(adaptiveOn){
    const acc = accuracy();           // 0..1
    const combo = STATE.comboMax;     // max combo so far
    if(acc > 0.88 && combo >= 10) spawnRate = Math.max(620, spawnRate - 120);
    if(acc < 0.70) spawnRate = Math.min(1100, spawnRate + 120);
  }

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate,
    sizeRange:[44,64],
    kinds:[
      { kind:'good', weight:0.72 },
      { kind:'junk', weight:0.28 }
    ],
    decorateTarget, // ✅ key patch

    onHit:(hit)=>{
      // hit has: kind, groupIndex, source
      if(hit.kind === 'good'){
        onHitGood(hit.groupIndex ?? 0);
      }else{
        onHitJunk();
      }
    },

    onExpire:(t)=>{
      if(t.kind === 'good'){
        onExpireGood(t.groupIndex ?? 0);
      }
    }
  });
}

/* ------------------------------------------------
 * Boot (public)
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // stop any previous run
  stopSpawner();
  try{ clearInterval(STATE.timer); }catch{}
  STATE.timer = null;

  STATE.cfg = cfg || {};
  STATE.running = true;
  STATE.ended = false;

  // reset counters
  STATE.score = 0;
  STATE.combo = 0;
  STATE.comboMax = 0;
  STATE.miss = 0;

  STATE.hitGood = 0;
  STATE.hitJunk = 0;
  STATE.expireGood = 0;

  STATE.g = [0,0,0,0,0];
  STATE.seen = [false,false,false,false,false];
  STATE.spawnSeen = [false,false,false,false,false];
  STATE.spawnTick = 0;

  STATE.goal.cur = 0;
  STATE.goal.done = false;

  STATE.mini.cur = 0;
  STATE.mini.done = false;

  // ✅ reset badge flags each run
  STATE.badge_first = false;
  STATE.badge_streak10 = false;
  STATE.badge_goal = false;
  STATE.badge_allDone = false;

  // RNG policy
  const runMode = (cfg?.runMode || 'play').toLowerCase();
  if(runMode === 'research' || runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // duration
  STATE.timeLeft = Number(cfg?.durationPlannedSec) || 90;

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  // ✅ BADGE: first_play (once per run)
  if(!STATE.badge_first){
    STATE.badge_first = true;
    awardOnce('first_play', {});
  }

  emitQuest();
  startTimer();

  // start spawner
  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');

  // Safety: stop spawner on page hide/unload (prevents dangling targets)
  const onHide = ()=>{
    if(STATE.ended) return;
    stopSpawner();
  };
  WIN.removeEventListener('pagehide', onHide);
  WIN.addEventListener('pagehide', onHide, { once:false });
}