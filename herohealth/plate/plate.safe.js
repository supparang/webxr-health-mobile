// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION PATCH)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (light DD)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ Uses mode-factory decorateTarget + emoji by Thai 5 food groups (fixed mapping)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const WIN = window;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

const pct2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickFrom(rng, arr){
  if(!arr || !arr.length) return '';
  const i = Math.floor((rng ? rng() : Math.random()) * arr.length);
  return arr[Math.max(0, Math.min(arr.length - 1, i))];
}

/* ------------------------------------------------
 * Thai 5 Food Groups (DO NOT CHANGE)
 * ------------------------------------------------
 * 1 โปรตีน: เนื้อ นม ไข่ ถั่วเมล็ดแห้ง
 * 2 คาร์บ: ข้าว แป้ง เผือก มัน น้ำตาล
 * 3 ผัก
 * 4 ผลไม้
 * 5 ไขมัน
 * ------------------------------------------------ */
const GROUP_EMOJI = {
  g1: ['🥚','🥛','🍗','🐟','🫘','🥜','🧀'],        // โปรตีน
  g2: ['🍚','🍞','🥖','🍜','🍠','🥔','🥨'],        // คาร์บ
  g3: ['🥬','🥦','🥒','🥕','🌽','🍆','🫑'],        // ผัก
  g4: ['🍌','🍎','🍊','🍉','🍇','🍍','🥭'],        // ผลไม้
  g5: ['🫒','🥑','🧈','🥥','🍳','🥜'],             // ไขมัน
};

// junk set (ของหวาน/ทอด/น้ำอัดลม)
const JUNK_EMOJI = ['🍟','🍔','🍕','🍩','🍪','🧁','🍫','🍬','🥤','🧋'];

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

  // cfg / rng
  cfg:null,
  rng:Math.random,

  // spawn engine
  engine:null,
  spawnRateMs:900,

  // adaptive
  ddTimer:null,
  coachLastAt:0,
  coachCooldownMs:2200,

  // streaks
  junkStreak:0,
  missStreak:0,
};

/* ------------------------------------------------
 * Event helpers
 * ------------------------------------------------ */
function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
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
 * Coach helper (rate limit)
 * ------------------------------------------------ */
function coach(msg, tag='Coach', force=false){
  const t = Date.now();
  if(!force && (t - STATE.coachLastAt) < STATE.coachCooldownMs) return;
  STATE.coachLastAt = t;
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * Score helpers
 * ------------------------------------------------ */
function pushScore(){
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax
  });
}

function addScore(v){
  STATE.score += v;
  pushScore();
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
 * Target decorator (emoji / icon UI)
 * ------------------------------------------------ */
function decorateTarget(el, t){
  // base
  el.style.position = 'absolute';
  el.dataset.group = String((t.groupIndex ?? 0) + 1);

  if(t.kind === 'good'){
    const key = ['g1','g2','g3','g4','g5'][t.groupIndex] || 'g1';
    const emoji = pickFrom(t.rng || STATE.rng, GROUP_EMOJI[key]);
    el.innerHTML = `<span class="emoji" aria-hidden="true">${emoji}</span>`;
    el.setAttribute('aria-label', `อาหารหมู่ ${el.dataset.group}`);
  }else{
    const emoji = pickFrom(t.rng || STATE.rng, JUNK_EMOJI);
    el.innerHTML = `<span class="emoji" aria-hidden="true">${emoji}</span>`;
    el.setAttribute('aria-label', `อาหารขยะ`);
  }

  // small bump so it looks lively even if CSS is minimal
  el.style.lineHeight = '1';
  el.style.fontSize = el.style.fontSize || '28px';
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function stopSpawner(){
  try{ STATE.engine && STATE.engine.stop && STATE.engine.stop(); }catch{}
  STATE.engine = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  clearInterval(STATE.ddTimer);
  stopSpawner();

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: pct2(accuracy() * 100),

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
 * Judge emit (for analytics / ML later)
 * ------------------------------------------------ */
function judge(type, meta){
  emit('hha:judge', Object.assign({ type }, meta || {}));
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  STATE.junkStreak = 0;
  STATE.missStreak = 0;

  addCombo();
  addScore(100 + STATE.combo * 5);

  judge('good', {
    groupIndex,
    score: STATE.score,
    combo: STATE.combo,
    acc: pct2(accuracy()*100),
  });

  // goal progress: number of groups collected at least once
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach', true);
    }
  }

  // mini (accuracy)
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'Coach');
  }

  emitQuest();

  // win condition option: if both done -> end early (optional)
  if(STATE.goal.done && STATE.mini.done && STATE.timeLeft > 3){
    // ปล่อยให้เล่นต่อได้ แต่ให้โบนัสจบไวถ้าต้องการ
    // endGame('cleared');
  }
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  STATE.junkStreak++;
  STATE.missStreak++;

  resetCombo();
  addScore(-50);

  judge('junk', {
    score: STATE.score,
    combo: STATE.combo,
    acc: pct2(accuracy()*100),
    junkStreak: STATE.junkStreak
  });

  if(STATE.junkStreak >= 2){
    coach('เลี่ยงของทอด/หวานนะ! ลองเลือก “ผัก/ผลไม้” เพิ่ม 🥦🍎', 'Coach');
  }else{
    coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');
  }
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  STATE.missStreak++;

  resetCombo();

  judge('miss', {
    score: STATE.score,
    combo: STATE.combo,
    acc: pct2(accuracy()*100),
    missStreak: STATE.missStreak
  });

  if(STATE.missStreak >= 2){
    coach('รีบหน่อย! เห็นอาหารดีแล้วแตะทันที 😊', 'Coach');
  }
}

/* ------------------------------------------------
 * Adaptive DD (Play mode only)
 * - ปรับ spawnRate แบบนุ่ม ๆ ทุก ~3.5s
 * - ทำโดย restart spawner เมื่อจำเป็น (เบา ๆ)
 * ------------------------------------------------ */
function computeSpawnRateDD(){
  // base by diff
  let base = 900;
  if(STATE.cfg.diff === 'easy') base = 980;
  if(STATE.cfg.diff === 'hard') base = 760;

  // performance signal
  const acc = accuracy();              // 0..1
  const c = clamp(STATE.combo, 0, 20); // combo current
  const s = (acc*0.65) + (c/20)*0.35;  // 0..1

  // map to spawnRate: better -> faster spawns (harder)
  // clamp within safe range
  const rate = clamp(base - (s * 260), 520, 1050);

  // if many misses -> slow down a bit
  if(STATE.missStreak >= 3) return clamp(rate + 160, 520, 1050);
  if(STATE.junkStreak >= 3) return clamp(rate + 140, 520, 1050);

  return rate;
}

function maybeUpdateDD(mount){
  if(!STATE.running || STATE.ended) return;
  const want = computeSpawnRateDD();
  const cur = STATE.spawnRateMs;

  // update only if change is meaningful
  if(Math.abs(want - cur) < 70) return;

  STATE.spawnRateMs = want;

  // restart spawner with new spawnRate (keeps session state)
  stopSpawner();
  STATE.engine = makeSpawner(mount);
}

/* ------------------------------------------------
 * Spawn logic
 * ------------------------------------------------ */
function makeSpawner(mount){
  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: STATE.spawnRateMs,
    sizeRange: STATE.cfg.diff === 'hard' ? [44,66] : [46,70],
    kinds: [
      { kind:'good', weight:0.72 },
      { kind:'junk', weight:0.28 }
    ],
    safePrefix: 'plate',
    decorateTarget, // ✅ emoji/icon
    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = clamp(t.groupIndex ?? 0, 0, 4);
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

  STATE.junkStreak = 0;
  STATE.missStreak = 0;

  // RNG
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng((cfg.seed || Date.now()) >>> 0);
  }else{
    STATE.rng = Math.random;
  }

  // duration: default 90 (ดีมากสำหรับ ป.5 / ให้มีโอกาสทำครบ 5 หมู่ + mini)
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // spawnRate init by diff
  STATE.spawnRateMs = (cfg.diff === 'hard') ? 780 : (cfg.diff === 'easy' ? 980 : 900);

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  pushScore();
  startTimer();

  STATE.engine = makeSpawner(mount);

  // adaptive DD only in play mode
  clearInterval(STATE.ddTimer);
  if(cfg.runMode !== 'research' && cfg.runMode !== 'study'){
    STATE.ddTimer = setInterval(()=>maybeUpdateDD(mount), 3500);
  }

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach', true);
}