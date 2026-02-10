// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (heuristic director)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Fix: "ออกไม่ครบ 5 หมู่" => spawn bias toward missing groups early game
// ✅ Uses decorateTarget(el,target) from mode-factory.js to set emoji/icon + group
// ✅ Emits: hha:start, hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ End: stop spawner so targets won't "blink" after finish
// ✅ PATCH: Standard end summary schema + miss breakdown
// ✅ PATCH: Prevent "จบไว" — play will NOT end before MIN_PLAY_SEC; triggers RUSH phase instead
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { JUNK, pickEmoji, emojiForGroup, labelForGroup } from '../vr/food5-th.js';

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

function gradeFromScore(score){
  score = Number(score)||0;
  if (score >= 2200) return 'S';
  if (score >= 1700) return 'A';
  if (score >= 1200) return 'B';
  if (score >= 700)  return 'C';
  return 'D';
}

/* ------------------------------------------------
 * Engine constants
 * ------------------------------------------------ */
const MIN_PLAY_SEC_BEFORE_END = 25;     // ✅ กัน “ตีไม่กี่อันก็จบ”
const RUSH_EXTRA_SEC = 20;             // ✅ ถ้าทำครบเร็ว -> เข้าช่วงเร่งความมันส์ ~20s
const RUSH_SPAWN_MULT = 0.70;          // ✅ spawnRate * 0.70 => เร็วขึ้น (ตัวเลขยิ่งน้อยยิ่งถี่)

/* ------------------------------------------------
 * Engine state
 * ------------------------------------------------ */
const STATE = {
  running:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,

  // miss canonical
  miss:0,
  missShot:0, // (optional) from hha:judge shot_miss if you enable it

  timeLeft:0,
  timePlannedSec:0,
  timer:null,

  // plate groups counts (index 0..4 => groupId 1..5)
  g:[0,0,0,0,0],

  // quests
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

  // judged counters (breakdown)
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // mode / cfg
  cfg:null,
  rng:Math.random,

  // spawn engine
  engine:null,

  // spawn director
  seen:[false,false,false,false,false],       // collected
  spawnSeen:[false,false,false,false,false],  // spawned at least once

  // phase
  phase:'main', // main | rush
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
 * Core helpers
 * ------------------------------------------------ */
function playedSec(){
  return Math.max(0, (Number(STATE.timePlannedSec)||0) - (Number(STATE.timeLeft)||0));
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
  STATE.score += (Number(v)||0);
  emit('hha:score', {
    score: STATE.score|0,
    combo: STATE.combo|0,
    comboMax: STATE.comboMax|0
  });
}

function addCombo(){
  STATE.combo++;
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
}

function resetCombo(){
  STATE.combo = 0;
}

/* ------------------------------------------------
 * Accuracy
 * judged = hitGood + hitJunk + expireGood
 * ------------------------------------------------ */
function accuracy(){
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

  stopSpawner();

  const accPct1Dec = Math.round(accuracy() * 1000) / 10;
  const grade = gradeFromScore(STATE.score);

  const summary = {
    reason,

    runMode: (STATE.cfg?.runMode || 'play'),
    diff: (STATE.cfg?.diff || 'normal'),
    seed: (STATE.cfg?.seed || 0),
    timePlannedSec: Number(STATE.timePlannedSec || 0) || 0,

    scoreFinal: STATE.score | 0,
    comboMax: STATE.comboMax | 0,

    // canonical miss
    miss: STATE.miss | 0,

    // ✅ breakdown
    missJunk: STATE.hitJunk | 0,
    missExpire: STATE.expireGood | 0,
    missShot: STATE.missShot | 0,

    accuracyPct: accPct1Dec,
    grade,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],

    // legacy aliases
    misses: STATE.miss | 0,
    accuracyGoodPct: accPct1Dec,
    durationPlannedSec: Number(STATE.timePlannedSec || 0) || 0,

    // extra (บางแดชบอร์ดใช้)
    hitGood: STATE.hitGood | 0,
    hitJunk: STATE.hitJunk | 0,
    expireGood: STATE.expireGood | 0,
  };

  emit('hha:end', summary);
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
  const distinct = STATE.g.filter(v=>v>0).length;
  STATE.goal.cur = distinct;

  if(!STATE.goal.done && distinct >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
  }
}

function maybeTriggerRushOrEnd(){
  const runMode = String(STATE.cfg?.runMode || 'play').toLowerCase();
  if(runMode !== 'play') return;

  if(!(STATE.goal.done && STATE.mini.done)) return;

  // ✅ กันจบไว: play ต้องเล่นอย่างน้อย MIN_PLAY_SEC_BEFORE_END
  if(playedSec() < MIN_PLAY_SEC_BEFORE_END){
    if(STATE.phase !== 'rush'){
      STATE.phase = 'rush';
      coach('สุดยอด! เข้าช่วงเร่งความมันส์ 🚀', 'Coach');
      // ให้เวลาเพิ่มแบบ “ไม่ยืดมาก” ถ้าเหลือเวลาน้อย
      if(STATE.timeLeft < RUSH_EXTRA_SEC) STATE.timeLeft = RUSH_EXTRA_SEC;

      // เร่ง spawn: restart spawner ด้วย spawnRate ที่เร็วขึ้น
      restartSpawner();
    }
    return;
  }

  // ผ่านขั้นต่ำแล้ว ค่อยจบ
  setTimeout(()=>{ if(!STATE.ended) endGame('all_done'); }, 420);
}

function onHitGood(groupIndex){
  STATE.hitGood++;

  const gi = clamp(groupIndex, 0, 4);
  STATE.g[gi]++;
  STATE.seen[gi] = true;

  addCombo();
  addScore(100 + STATE.combo * 5);

  recomputeGoal();
  updateMiniFromAccuracy();
  emitQuest();

  emit('hha:judge', {
    kind:'good',
    groupId: gi+1,
    score: STATE.score,
    combo: STATE.combo
  });

  maybeTriggerRushOrEnd();
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
 * ------------------------------------------------ */
function pickGroupIndexForGood(t){
  const rng = (t && typeof t.rng === 'function') ? t.rng : STATE.rng;

  const missingSpawn = [];
  for(let i=0;i<5;i++) if(!STATE.spawnSeen[i]) missingSpawn.push(i);

  const missingCollect = [];
  for(let i=0;i<5;i++) if(STATE.g[i] <= 0) missingCollect.push(i);

  // Phase A: until each group has spawned at least once
  if(missingSpawn.length){
    if(rng() < 0.85){
      return missingSpawn[Math.floor(rng()*missingSpawn.length)];
    }
  }

  // Phase B: until player collects all 5
  if(missingCollect.length){
    if(rng() < 0.75){
      return missingCollect[Math.floor(rng()*missingCollect.length)];
    }
  }

  // Phase C: after collected all 5 (play adaptive)
  const runMode = (STATE.cfg?.runMode || 'play').toLowerCase();
  const adaptiveOn = (runMode === 'play');

  if(adaptiveOn){
    const counts = STATE.g.map((c,i)=>({i,c}));
    counts.sort((a,b)=>a.c-b.c);
    const pool = counts.slice(0,2).map(x=>x.i);
    if(rng() < 0.70){
      return pool[Math.floor(rng()*pool.length)];
    }
  }

  return Math.floor(rng()*5);
}

/* ------------------------------------------------
 * Target decorator (emoji/icon + group binding)
 * ------------------------------------------------ */
function decorateTarget(el, t){
  if(t.kind === 'good'){
    const gi = pickGroupIndexForGood(t);
    t.groupIndex = gi;
    STATE.spawnSeen[gi] = true;

    const groupId = gi + 1;
    const emoji = emojiForGroup(t.rng, groupId);

    el.dataset.group = String(groupId);
    el.dataset.kind = 'good';
    el.textContent = emoji;

    try{ el.setAttribute('aria-label', labelForGroup(groupId)); }catch{}
  }else{
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
function computeSpawnRate(){
  const diff = (STATE.cfg?.diff || 'normal').toLowerCase();

  let spawnRate = 900;
  if(diff === 'hard') spawnRate = 720;
  else if(diff === 'easy') spawnRate = 1020;

  const runMode = (STATE.cfg?.runMode || 'play').toLowerCase();
  const adaptiveOn = (runMode === 'play');

  if(adaptiveOn){
    const acc = accuracy();
    const combo = STATE.comboMax;
    if(acc > 0.88 && combo >= 10) spawnRate = Math.max(620, spawnRate - 120);
    if(acc < 0.70) spawnRate = Math.min(1100, spawnRate + 120);
  }

  // ✅ rush phase: spawn faster
  if(String(STATE.phase) === 'rush'){
    spawnRate = Math.max(520, Math.round(spawnRate * RUSH_SPAWN_MULT));
  }

  return spawnRate;
}

function makeSpawner(mount){
  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: computeSpawnRate(),
    cooldownMs: 90,
    sizeRange:[44,64],
    kinds:[
      { kind:'good', weight:0.72 },
      { kind:'junk', weight:0.28 }
    ],
    decorateTarget,

    onHit:(hit)=>{
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

function restartSpawner(){
  if(!STATE.running || STATE.ended) return;
  if(!STATE.cfg || !STATE.__mount) return;
  stopSpawner();
  STATE.engine = makeSpawner(STATE.__mount);
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

  STATE.__mount = mount;

  STATE.cfg = cfg || {};
  STATE.running = true;
  STATE.ended = false;
  STATE.phase = 'main';

  // reset counters
  STATE.score = 0;
  STATE.combo = 0;
  STATE.comboMax = 0;

  STATE.miss = 0;
  STATE.missShot = 0;

  STATE.hitGood = 0;
  STATE.hitJunk = 0;
  STATE.expireGood = 0;

  STATE.g = [0,0,0,0,0];
  STATE.seen = [false,false,false,false,false];
  STATE.spawnSeen = [false,false,false,false,false];

  STATE.goal.cur = 0;
  STATE.goal.done = false;

  STATE.mini.cur = 0;
  STATE.mini.done = false;

  // RNG policy
  const runMode = (cfg?.runMode || 'play').toLowerCase();
  if(runMode === 'research' || runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // duration
  STATE.timeLeft = Number(cfg?.durationPlannedSec) || 90;
  STATE.timePlannedSec = STATE.timeLeft;

  // start event (standard keys + keep legacy alias)
  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    timePlannedSec: STATE.timePlannedSec,

    // legacy
    durationPlannedSec: STATE.timePlannedSec
  });

  emitQuest();
  startTimer();

  // start spawner
  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');

  // Optional: count shot_miss as missShot (ไม่รวมใน accuracy โดยดีฟอลต์)
  const onJudge = (e)=>{
    const d = e.detail || {};
    if(String(d.kind||'').toLowerCase() === 'shot_miss'){
      STATE.missShot++;
      // ถ้าจะนับเป็น miss ด้วย ให้เปิดบรรทัดนี้:
      // STATE.miss++;
    }
  };
  WIN.removeEventListener('hha:judge', onJudge);
  WIN.addEventListener('hha:judge', onJudge);

  // Safety: stop spawner on page hide/unload
  const onHide = ()=>{
    if(STATE.ended) return;
    stopSpawner();
  };
  WIN.removeEventListener('pagehide', onHide);
  WIN.addEventListener('pagehide', onHide, { once:false });
}