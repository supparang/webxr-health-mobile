// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Fix import: no hard named export 'boot' required
// ✅ Play / Research modes
//   - play: adaptive ON
//   - research/study: deterministic seed + adaptive OFF (fair + reproducible)
// ✅ Emoji-rich targets (variety per food group) + junk variety
// ✅ Mini-quests (A+B+C): fast, streaky, kid-friendly
// ✅ Emits: hha:start, hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot support via vr-ui.js (hha:shoot) with click-at-point fallback
// ------------------------------------------------

'use strict';

import * as ModeFactory from '../vr/mode-factory.js';

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const WIN = window;
const DOC = document;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

function seededRng(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * Resolve spawner factory safely (fixes named-export crash)
 * ------------------------------------------------ */
function resolveSpawnerFactory(){
  // Try common export names across your projects
  return (
    ModeFactory.boot ||
    ModeFactory.spawnBoot ||
    ModeFactory.makeSpawner ||
    ModeFactory.createSpawner ||
    ModeFactory.default ||
    null
  );
}

/* ------------------------------------------------
 * Emoji sets (variety = less boring)
 * 5 groups: 1) ข้าว-แป้ง 2) ผัก 3) ผลไม้ 4) โปรตีน 5) นม
--------------------------------------------------- */
const GROUP_EMOJI = [
  ['🍚','🍞','🥖','🍜','🍝','🥪','🥨','🥟'],        // 1 carbs
  ['🥦','🥬','🥕','🌽','🥒','🍆','🫑','🧄'],        // 2 veg
  ['🍎','🍌','🍊','🍉','🍇','🍓','🥭','🍍'],        // 3 fruit
  ['🍗','🥚','🐟','🍤','🫘','🥩','🧀','🧆'],        // 4 protein (mix)
  ['🥛','🧋','🍶','🧈','🧀','🥣','🍦','🍼'],        // 5 dairy (kid-friendly)
];

const JUNK_EMOJI = ['🍟','🍔','🍕','🌭','🍩','🍪','🍫','🧁','🍬','🥤','🍗','🥓'];

function pick(arr, rng){
  return arr[Math.floor((rng() * arr.length))] || arr[0];
}

/* ------------------------------------------------
 * Mini-Quest Director (A+B+C)
 * A: Streak Quest (เร็ว/ลุ้น)
 * B: No-Junk Window (โฟกัส/ระวัง)
 * C: Plate Rush (เก็บครบ 5 หมู่เร็ว ๆ)
--------------------------------------------------- */
function makeMiniDirector(){
  const M = {
    kind:'streak', // streak | nojunk | rush
    name:'สตรีคสายฟ้า',
    sub:'เก็บดีติดกัน 8 ครั้ง',
    cur:0,
    target:8,
    done:false,

    // internal
    streak:0,
    noJunkLeft:0,
    rushStartAt:0,
    rushDeadline:0,
  };

  function setKind(kind, nowSec){
    M.kind = kind;
    M.done = false;
    M.cur = 0;

    if(kind === 'streak'){
      M.name = 'สตรีคสายฟ้า ⚡';
      M.sub  = 'เก็บดีติดกัน 8 ครั้ง';
      M.target = 8;
      M.streak = 0;
    }else if(kind === 'nojunk'){
      M.name = 'โหมดระวังของทอด 🚫';
      M.sub  = 'ห้ามโดน junk 12 วินาที';
      M.target = 12;
      M.noJunkLeft = 12;
    }else{
      M.name = 'Plate Rush ⏱️';
      M.sub  = 'เติมครบ 5 หมู่ใน 18 วิ';
      M.target = 18;
      M.rushStartAt = nowSec;
      M.rushDeadline = nowSec + 18;
    }
  }

  function rotate(nowSec, rng){
    const r = rng();
    if(r < 0.42) setKind('streak', nowSec);
    else if(r < 0.74) setKind('nojunk', nowSec);
    else setKind('rush', nowSec);
  }

  return { M, rotate, setKind };
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

  // plate groups (5 หมู่)
  g:[0,0,0,0,0], // index 0-4

  // quest goal
  goal:{
    name:'เติมจานให้ครบ 5 หมู่ 🍽️',
    sub:'เก็บอย่างน้อย 1 ชิ้นในแต่ละหมู่',
    cur:0,
    target:5,
    done:false
  },

  mini:null,          // {name,sub,cur,target,done,...}
  miniDirector:null,  // helper

  // counters for accuracy
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // cfg / rng
  cfg:null,
  rng:Math.random,

  // spawner instance
  engine:null,

  // for mini timing
  elapsedSec:0
};

/* ------------------------------------------------
 * HUD emit
 * ------------------------------------------------ */
function emitQuest(){
  emit('quest:update', {
    goal:{
      name: STATE.goal.name,
      sub: STATE.goal.sub,
      cur: STATE.goal.cur,
      target: STATE.goal.target
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
}
function resetCombo(){ STATE.combo = 0; }

function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: Math.round(accuracy() * 100),

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4]
  });
}

/* ------------------------------------------------
 * Timer (also drives mini quest timing)
 * ------------------------------------------------ */
function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    STATE.timeLeft--;
    STATE.elapsedSec++;

    // mini tick (nojunk / rush)
    if(!STATE.mini.done){
      if(STATE.mini.kind === 'nojunk'){
        STATE.mini.noJunkLeft = Math.max(0, STATE.mini.noJunkLeft - 1);
        STATE.mini.cur = STATE.mini.target - STATE.mini.noJunkLeft;
        if(STATE.mini.noJunkLeft <= 0){
          STATE.mini.done = true;
          coach('สุดยอด! ผ่านโหมดระวังของทอด ✅', 'Coach');
        }
        emitQuest();
      }else if(STATE.mini.kind === 'rush'){
        // progress = seconds used
        const used = Math.max(0, (STATE.elapsedSec - STATE.mini.rushStartAt));
        STATE.mini.cur = Math.min(STATE.mini.target, used);
        // if time window expires and not done -> rotate
        if(STATE.elapsedSec >= STATE.mini.rushDeadline && !STATE.mini.done){
          coach('เกือบทัน! ลองภารกิจใหม่ 🌀', 'Coach');
          STATE.miniDirector.rotate(STATE.elapsedSec, STATE.rng);
          STATE.mini = STATE.miniDirector.M;
          emitQuest();
        }else{
          emitQuest();
        }
      }
    }

    emit('hha:time', { leftSec: STATE.timeLeft });
    if(STATE.timeLeft <= 0) endGame('timeup');
  }, 1000);
}

/* ------------------------------------------------
 * Mini quest helpers
 * ------------------------------------------------ */
function rotateMiniIfNeeded(){
  if(STATE.mini.done){
    // After a short delay, rotate to keep gameplay lively
    setTimeout(()=>{
      if(!STATE.running || STATE.ended) return;
      STATE.miniDirector.rotate(STATE.elapsedSec, STATE.rng);
      STATE.mini = STATE.miniDirector.M;
      coach(`ภารกิจใหม่: ${STATE.mini.name}`, 'Coach');
      emitQuest();
    }, 700);
  }
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function updateGoalProgress(){
  if(STATE.goal.done) return;
  STATE.goal.cur = STATE.g.filter(v=>v>0).length;
  if(STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach');
  }
}

function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(90 + STATE.combo * 6);

  // Goal progress
  updateGoalProgress();

  // Mini quest progress
  if(!STATE.mini.done){
    if(STATE.mini.kind === 'streak'){
      STATE.mini.streak++;
      STATE.mini.cur = STATE.mini.streak;
      if(STATE.mini.streak >= STATE.mini.target){
        STATE.mini.done = true;
        coach('สตรีคครบ! เก่งมาก ⚡✅', 'Coach');
      }
    }else if(STATE.mini.kind === 'rush'){
      // Rush completes when goal completes within window
      if(STATE.goal.done && STATE.elapsedSec <= STATE.mini.rushDeadline){
        STATE.mini.done = true;
        coach('Plate Rush สำเร็จ! ⏱️🏁', 'Coach');
      }
    }
  }

  emitQuest();
  rotateMiniIfNeeded();

  // If both done: small bonus + end early (optional) -> เร้าใจ "ผ่านไว"
  if(STATE.goal.done && STATE.mini.done){
    addScore(220);
    coach('ผ่านไวมาก! รับโบนัส 🎁', 'Coach');
    // ปิดเกมให้จบเลยเพื่อ “ผ่านทันที” ตามที่คุยกันไว้
    endGame('clear');
  }
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-70);

  // Mini: nojunk fails -> rotate immediately
  if(!STATE.mini.done && STATE.mini.kind === 'nojunk'){
    coach('โดน junk แล้ว! เปลี่ยนภารกิจใหม่ 🔄', 'Coach');
    STATE.miniDirector.rotate(STATE.elapsedSec, STATE.rng);
    STATE.mini = STATE.miniDirector.M;
  }else{
    coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');
  }

  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
}

/* ------------------------------------------------
 * Click-at-point fallback for hha:shoot
 * (if mode-factory doesn't auto-handle it)
 * ------------------------------------------------ */
function wireShootFallback(mount){
  WIN.addEventListener('hha:shoot', (e)=>{
    const d = e.detail || {};
    const x = Number(d.x);
    const y = Number(d.y);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    // Prefer elements inside mount
    const el = DOC.elementFromPoint(x, y);
    if(!el) return;
    const tgt = el.closest?.('.plateTarget');
    if(tgt && mount.contains(tgt)){
      tgt.click();
    }
  });
}

/* ------------------------------------------------
 * Spawn logic (via mode-factory)
 * ------------------------------------------------ */
function makeSpawner(mount){
  const factory = resolveSpawnerFactory();
  if(!factory){
    throw new Error('PlateVR: mode-factory.js has no usable export (boot/spawnBoot/default)');
  }

  // Determine difficulty pacing
  const diff = (STATE.cfg.diff || 'normal').toLowerCase();
  const spawnRate =
    diff === 'hard' ? 640 :
    diff === 'easy' ? 980 :
    820;

  // Size range (bigger for kids)
  const sizeRange =
    diff === 'hard' ? [44, 62] :
    diff === 'easy' ? [54, 78] :
    [48, 70];

  return factory({
    mount,
    seed: STATE.cfg.seed,
    spawnRate,
    sizeRange,

    // weights
    kinds:[
      { kind:'good', weight:0.74 },
      { kind:'junk', weight:0.26 }
    ],

    // decorate target (emoji variety)
    decorate:(t, el)=>{
      try{
        if(t.kind === 'good'){
          const gi = clamp(t.groupIndex ?? Math.floor(STATE.rng()*5), 0, 4);
          t.groupIndex = gi;
          el.textContent = pick(GROUP_EMOJI[gi], STATE.rng);
          el.dataset.group = String(gi+1);
        }else{
          el.textContent = pick(JUNK_EMOJI, STATE.rng);
        }
      }catch(_){}
    },

    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = clamp(t.groupIndex ?? Math.floor(STATE.rng()*5), 0, 4);
        onHitGood(gi);
      }else{
        onHitJunk();
      }
    },
    onExpire:(t)=>{
      if(t.kind === 'good') onExpireGood();
    }
  });
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  STATE.cfg = cfg;
  STATE.running = true;
  STATE.ended = false;

  // reset
  STATE.score = 0;
  STATE.combo = 0;
  STATE.comboMax = 0;
  STATE.miss = 0;

  STATE.hitGood = 0;
  STATE.hitJunk = 0;
  STATE.expireGood = 0;

  STATE.g = [0,0,0,0,0];
  STATE.elapsedSec = 0;

  STATE.goal.cur = 0;
  STATE.goal.done = false;

  // RNG mode
  const runMode = (cfg.runMode || 'play').toLowerCase();
  if(runMode === 'research' || runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // time defaults:
  // - 70 = เร็ว/ลุ้น (ดีสำหรับเล่นซ้ำ)
  // - 90 = สมดุล (เหมาะเป็นมาตรฐาน class + ป.5)
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // mini director init
  STATE.miniDirector = makeMiniDirector();
  STATE.miniDirector.rotate(0, STATE.rng);
  STATE.mini = STATE.miniDirector.M;

  emit('hha:start', {
    game:'plate',
    runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  startTimer();

  // spawner
  STATE.engine = makeSpawner(mount);

  // shoot fallback (safe)
  wireShootFallback(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
  coach(`ภารกิจย่อย: ${STATE.mini.name}`, 'Coach');
}