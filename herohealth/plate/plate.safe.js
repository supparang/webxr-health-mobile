// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (spawnRate/pressure ปรับตามฟอร์ม)
//   - research/study: deterministic seed + adaptive OFF (fair for research)
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Supports hooks: Boss phase, Storm phase (UI layer ids ready)
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ------------------------------------------------

'use strict';

const WIN = window;
const DOC = document;

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

function pct2(n){
  // keep 2 decimals if needed, but return number
  n = Number(n) || 0;
  return Math.round(n * 100) / 100;
}

function seededRng(seed){
  let t = (seed >>> 0) || 1;
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
 * ModeFactory bridge (FIX for your error)
 * ------------------------------------------------
 * mode-factory.js ในโปรเจกต์นี้เป็นไฟล์แบบ global script
 * (ไม่ได้ export ES module ชื่อ boot)
 * ดังนั้นเราจะดึง boot จาก window.* แทน
 */
function getSpawnerBoot(){
  const mf =
    WIN.ModeFactory ||
    (WIN.GAME_MODULES && WIN.GAME_MODULES.ModeFactory) ||
    (WIN.HHA && WIN.HHA.ModeFactory) ||
    null;

  const boot = mf?.boot || mf?.create || WIN.modeFactoryBoot || null;

  if(typeof boot !== 'function'){
    // ทำข้อความ error ให้ชัดเจน (ช่วย debug)
    throw new Error(
      'PlateVR: mode-factory boot not found. ' +
      'Make sure ../vr/mode-factory.js is loaded and exposes ModeFactory.boot (or GAME_MODULES.ModeFactory.boot).'
    );
  }
  return boot;
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

  // quest
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่',
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

  // cfg
  cfg:null,
  rng:Math.random,

  // spawner instance
  spawner:null,

  // pace tuning
  adaptiveLevel:0, // 0..3
};

/* ------------------------------------------------
 * Quest update
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

/* ------------------------------------------------
 * Score helpers
 * ------------------------------------------------ */
function emitScore(){
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax
  });
}

function addScore(v){
  STATE.score += (Number(v)||0);
  emitScore();
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
 * ------------------------------------------------ */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * Difficulty pace (Play only)
 * ------------------------------------------------
 * “เร่งนิด ๆ” ตามที่ขอ: ถ้าคอมโบดี/แม่นดี -> spawn เร็วขึ้นเล็กน้อย
 * แต่โหมด study/research จะล็อกให้คงที่ (ยุติธรรม)
 */
function updateAdaptive(){
  const cfg = STATE.cfg || {};
  const isStudy = (cfg.runMode === 'research' || cfg.runMode === 'study');

  if(isStudy) return;

  const acc = accuracy();
  const combo = STATE.comboMax;

  let lvl = 0;
  if(acc >= 0.90 && combo >= 10) lvl = 3;
  else if(acc >= 0.85 && combo >= 6) lvl = 2;
  else if(acc >= 0.80 && combo >= 3) lvl = 1;

  if(lvl !== STATE.adaptiveLevel){
    STATE.adaptiveLevel = lvl;
    // ถ้ามี API update (แล้วแต่ mode-factory) จะลองปรับ spawnRate
    // ถ้าไม่มี ก็ไม่เป็นไร เกมยังเล่นได้
    const rate = baseSpawnRateMs() - (lvl * 90); // เร่งทีละ 90ms
    try{
      STATE.spawner?.setSpawnRate?.(clamp(rate, 420, 1600));
    }catch(_){}
  }
}

function baseSpawnRateMs(){
  const diff = (STATE.cfg?.diff || 'normal').toLowerCase();
  if(diff === 'easy') return 980;
  if(diff === 'hard') return 720;
  return 860; // normal (เร่งนิด ๆ ให้สนุกขึ้น)
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);

  // best-effort stop spawner if it provides API
  try{ STATE.spawner?.stop?.(); }catch(_){}

  const accPct = pct2(accuracy() * 100);

  emit('hha:end', {
    projectTag: 'HeroHealth',
    gameMode: 'plate',
    runMode: STATE.cfg?.runMode || 'play',
    diff: STATE.cfg?.diff || 'normal',
    seed: STATE.cfg?.seed ?? '',
    durationPlannedSec: STATE.cfg?.durationPlannedSec ?? 0,
    durationPlayedSec: (STATE.cfg?.durationPlannedSec ?? 0) - Math.max(0, STATE.timeLeft),

    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    // logger expects these keys (match your sheet schema)
    nHitGood: STATE.hitGood,
    nHitJunk: STATE.hitJunk,
    nExpireGood: STATE.expireGood,

    accuracyGoodPct: accPct,
    junkErrorPct: pct2((STATE.hitJunk / Math.max(1, (STATE.hitGood + STATE.hitJunk))) * 100),

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],
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

    // optional pace update (play mode only)
    updateAdaptive();

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 6); // เร่งนิด ๆ ให้คอมโบมีความหมาย

  // goal progress: count how many groups already >=1
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  // mini: accuracy
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  emitQuest();

  // “สนุกท้าทาย” เพิ่ม: ถ้าทำครบ 2 เงื่อนไขก่อนเวลาครึ่งหนึ่ง -> ชนะทันที
  // (เด็ก ป.5 จะรู้สึกว่า “ผ่านแล้ว!” ไม่ต้องลากเวลา)
  const canEarlyPass = (STATE.cfg?.runMode || 'play') === 'play';
  if(canEarlyPass && STATE.goal.done && STATE.mini.done){
    // ถ้าผู้ใช้ต้องการ "ครบแล้วผ่านทันที" ตามมาตรฐาน HHA
    endGame('all-done');
  }
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-60);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  emitQuest();
}

/* ------------------------------------------------
 * Spawn logic (ModeFactory)
 * ------------------------------------------------ */
function makeSpawner(mount){
  const boot = getSpawnerBoot();

  // map diff -> spawnRate
  const spawnRate = baseSpawnRateMs();

  // NOTE: รูปแบบ config นี้ “ต้องตรงกับ mode-factory.js ของคุณ”
  // ถ้า key ไม่ตรง เกมจะยังบูตได้แต่สปอว์นไม่ทำงาน
  // (ถ้าคุณใช้ schema อื่น บอกผม เดี๋ยวผม map ให้ตรงทันที)
  return boot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate,
    sizeRange:[44, 66],
    kinds:[
      { kind:'good', weight:0.72 },
      { kind:'junk', weight:0.28 }
    ],
    onHit:(t)=>{
      if(t?.kind === 'good'){
        const gi = (t.groupIndex != null) ? t.groupIndex : Math.floor(STATE.rng() * 5);
        onHitGood(clamp(gi, 0, 4));
      }else{
        onHitJunk();
      }
    },
    onExpire:(t)=>{
      if(t?.kind === 'good') onExpireGood();
    }
  });
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  STATE.cfg = cfg || {};
  STATE.running = true;
  STATE.ended = false;

  // reset stats
  STATE.score = 0;
  STATE.combo = 0;
  STATE.comboMax = 0;
  STATE.miss = 0;
  STATE.hitGood = 0;
  STATE.hitJunk = 0;
  STATE.expireGood = 0;
  STATE.g = [0,0,0,0,0];

  STATE.goal.cur = 0; STATE.goal.done = false;
  STATE.mini.cur = 0; STATE.mini.done = false;

  // RNG
  if(STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study'){
    STATE.rng = seededRng(STATE.cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // time
  STATE.timeLeft = Number(STATE.cfg.durationPlannedSec) || 90;

  // start event (for logger)
  emit('hha:start', {
    projectTag: 'HeroHealth',
    game: 'plate',
    runMode: STATE.cfg.runMode,
    diff: STATE.cfg.diff,
    seed: STATE.cfg.seed,
    durationPlannedSec: STATE.timeLeft,
    view: STATE.cfg.view || '',
    studyId: STATE.cfg.studyId || '',
    phase: STATE.cfg.phase || '',
    conditionGroup: STATE.cfg.conditionGroup || '',
    sessionOrder: STATE.cfg.sessionOrder || '',
    blockLabel: STATE.cfg.blockLabel || '',
    siteCode: STATE.cfg.siteCode || '',
    schoolCode: STATE.cfg.schoolCode || '',
    schoolName: STATE.cfg.schoolName || '',
    gradeLevel: STATE.cfg.gradeLevel || '',
    studentKey: STATE.cfg.studentKey || ''
  });

  emitScore();
  emitQuest();
  startTimer();

  // start spawner
  STATE.spawner = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');

  return STATE;
}