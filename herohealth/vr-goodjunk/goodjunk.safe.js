// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (HHA Standard + 5-food-group mapping)
// ------------------------------------------------
// ✅ Uses mode-factory spawn (tap + hha:shoot)
// ✅ GOOD shows emoji mapped to Thai 5 food groups (groupIndex 0-4)
// ✅ JUNK shows sweets/fried emoji
// ✅ ⭐ Star: reduce miss by 1 (floor 0) + bonus score
// ✅ 🛡 Shield: blocks next junk hit (blocked junk does NOT count as miss)
// ✅ Play: adaptive spawn ON (fair) | Research/Study: deterministic + adaptive OFF
// ✅ Emits: hha:start, hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:predict, hha:end
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

const WIN = window;

const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
const pct2 = (n)=> Math.round((Number(n)||0) * 100) / 100;

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

function pick(arr, rng){ return arr[Math.floor((rng() * arr.length))]; }

// ไทย 5 หมู่ (ห้ามแปลผัน)
const GROUP_EMOJI = [
  ['🥩','🍗','🐟','🥚','🥛','🫘'], // 1 โปรตีน
  ['🍚','🍞','🍜','🥔','🍠','🥖'], // 2 คาร์บ
  ['🥦','🥬','🥕','🥒','🌽','🍆'], // 3 ผัก
  ['🍎','🍌','🍊','🍉','🍇','🥭'], // 4 ผลไม้
  ['🥑','🥜','🧈','🧀','🫒','🌰'], // 5 ไขมัน
];

const JUNK_EMOJI = ['🍩','🍪','🍟','🍔','🌭','🧁','🍫','🥤','🍕','🍬'];

const STATE = {
  running:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,

  miss:0,
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  star:0,
  shield:0, // number of shield charges (0/1 enough แต่เผื่ออนาคต)

  timeLeft:0,
  timer:null,

  // quests
  goal:{
    name:'เก็บของดีให้ทัน',
    sub:'เก็บ GOOD ให้ได้ตามเป้า',
    cur:0,
    target:18,
    done:false
  },
  mini:{
    name:'ความแม่นยำ',
    sub:'คุมความแม่น ≥ 80%',
    cur:0,
    target:80,
    done:false
  },

  // mapping 5 หมู่ (เก็บข้อมูล/โชว์)
  g:[0,0,0,0,0], // group hits

  // adaptive
  adaptiveOn:true,
  spawnRateMs:860,
  adaptTick:0,

  // cfg / rng / engine
  cfg:null,
  rng:Math.random,
  engine:null,

  // AI prediction
  predTick:0,
};

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

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

function emitScore(extra={}){
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax,
    miss: STATE.miss,
    star: STATE.star,
    shield: STATE.shield,
    hitGood: STATE.hitGood,
    hitJunk: STATE.hitJunk,
    ...extra
  });
}

function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total<=0) return 1;
  return STATE.hitGood / total;
}

function addCombo(){
  STATE.combo++;
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
}
function resetCombo(){ STATE.combo = 0; }

function addScore(v){
  STATE.score += (Number(v)||0);
  if(STATE.score < 0) STATE.score = 0;
  emitScore();
}

function applyStar(){
  STATE.star++;
  if(STATE.miss > 0) STATE.miss = Math.max(0, STATE.miss - 1);
  addScore(120);
  emit('hha:judge', { type:'star', miss:STATE.miss, score:STATE.score });
  coach('⭐ ลด Miss ลง 1!', 'Power');
}

function applyShield(){
  STATE.shield = Math.min(1, STATE.shield + 1);
  addScore(60);
  emit('hha:judge', { type:'shield', shield:STATE.shield, score:STATE.score });
  coach('🛡 กันพลาดได้ 1 ครั้ง!', 'Power');
}

function checkQuests(){
  // goal: count good hits
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.hitGood;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เก็บของดีครบเป้า 🎯');
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

  // win condition: both done
  if(STATE.goal.done && STATE.mini.done){
    endGame('win');
  }
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);
  try{ STATE.engine?.stop?.(); }catch{}
  STATE.engine = null;

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,
    accuracyGoodPct: pct2(accuracy()*100),

    goalsCleared: (STATE.goal.done ? 1 : 0),
    goalsTotal: 1,
    miniCleared: (STATE.mini.done ? 1 : 0),
    miniTotal: 1,

    // 5 หมู่ data
    g1:STATE.g[0], g2:STATE.g[1], g3:STATE.g[2], g4:STATE.g[3], g5:STATE.g[4],
  });
}

function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });
  STATE.adaptTick = 0;
  STATE.predTick = 0;

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    // adaptive every 1s (play only)
    if(STATE.adaptiveOn){
      STATE.adaptTick++;
      if(STATE.adaptTick % 1 === 0){
        const acc = accuracy();
        // fair: ถ้าแม่น -> เร็วขึ้นนิด, ถ้าพลาดเยอะ -> ช้าลงนิด
        let r = STATE.spawnRateMs;
        if(acc > 0.82) r -= 20;
        else if(acc < 0.62) r += 25;

        if(STATE.miss >= 6) r += 30;
        if(STATE.combo >= 6) r -= 10;

        STATE.spawnRateMs = clamp(r, 560, 1050);

        // ส่ง hook ให้ UI/analytics
        emit('hha:judge', {
          type:'dd',
          spawnRateMs: STATE.spawnRateMs,
          accPct: Math.round(acc*100),
          miss: STATE.miss
        });
      }
    }

    // AI prediction hook every 5s
    STATE.predTick++;
    if(STATE.predTick % 5 === 0){
      const acc = accuracy();
      const left = Math.max(0, STATE.timeLeft);
      const pace = (STATE.hitGood / Math.max(1, (STATE.cfg.durationPlannedSec - left))); // good/sec
      const estGoodFinal = STATE.hitGood + pace * left;
      const need = Math.max(0, STATE.goal.target - STATE.hitGood);

      // heuristic pWin (0..1)
      let p = 0.25;
      p += (acc - 0.6) * 0.9;
      p += Math.min(1, (pace * left) / Math.max(1, need)) * 0.35;
      p -= (STATE.miss * 0.04);
      p = clamp(p, 0, 1);

      emit('hha:predict', {
        pWin: pct2(p),
        accPct: Math.round(acc*100),
        paceGoodPerSec: pct2(pace),
        estGoodFinal: Math.round(estGoodFinal),
        needGood: need,
        timeLeft: left,
        // features for ML later
        f: {
          hitGood: STATE.hitGood,
          hitJunk: STATE.hitJunk,
          expireGood: STATE.expireGood,
          miss: STATE.miss,
          combo: STATE.combo,
          spawnRateMs: STATE.spawnRateMs
        }
      });
    }

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------
 * decorateTarget: เลือก emoji ตามชนิด + หมู่
 * ------------------------------ */
function decorateTarget(el, t){
  const rng = (t.rng || STATE.rng);
  const kind = t.kind || 'good';

  // ให้ CSS ใช้สี/ขอบต่างกัน
  el.dataset.kind = kind;

  if(kind === 'good'){
    const gi = clamp(t.groupIndex ?? 0, 0, 4);
    el.dataset.group = String(gi+1);
    el.textContent = pick(GROUP_EMOJI[gi], rng);
    return;
  }

  if(kind === 'junk'){
    el.textContent = pick(JUNK_EMOJI, rng);
    return;
  }

  if(kind === 'star'){
    el.textContent = '⭐';
    return;
  }

  if(kind === 'shield'){
    el.textContent = '🛡';
    return;
  }

  el.textContent = '❔';
}

/* ------------------------------
 * hit/expire handlers
 * ------------------------------ */
function onHitGood(gi){
  STATE.hitGood++;
  STATE.g[gi]++;

  addCombo();
  addScore(100 + STATE.combo * 4);

  checkQuests();
}

function onHitJunk(){
  // shield blocks junk (no miss)
  if(STATE.shield > 0){
    STATE.shield = Math.max(0, STATE.shield - 1);
    resetCombo();
    addScore(10);
    emit('hha:judge', { type:'block', shield:STATE.shield });
    coach('🛡 กันไว้ได้!', 'Power');
    return;
  }

  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-40);
  emit('hha:judge', { type:'junk', miss:STATE.miss });
  coach('ระวัง! ของหวาน/ทอด ⚠️');
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  emit('hha:judge', { type:'expire', miss:STATE.miss });
}

/* ------------------------------
 * spawner
 * ------------------------------ */
function makeSpawner(mount){
  const diff = (STATE.cfg.diff || 'normal');

  const baseRate =
    diff === 'easy' ? 920 :
    diff === 'hard' ? 760 :
    840;

  STATE.spawnRateMs = baseRate;

  // weights: ดีเยอะ, ขยะพอให้ลุ้น, power โผล่เป็นช่วง ๆ
  const kinds = [
    { kind:'good',  weight:0.62 },
    { kind:'junk',  weight:0.28 },
    { kind:'star',  weight:0.06 },
    { kind:'shield',weight:0.04 },
  ];

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    safeVarPrefix:'gj',                 // ✅ อ่าน --gj-*-safe จาก CSS (ไฟล์ถัดไป A2)
    spawnRate: 60,                      // internal tick; เราจะคุมด้วย adaptive ผ่าน judge + spawnRateMs (ดูด้านล่าง)
    sizeRange:[46,68],
    kinds,

    cooldownMs: 90,
    lockPxDefault: 28,

    decorateTarget,

    onHit:(t)=>{
      const kind = t.kind || 'good';
      if(kind === 'good'){
        const gi = clamp(t.groupIndex ?? 0, 0, 4);
        onHitGood(gi);
      }else if(kind === 'junk'){
        onHitJunk();
      }else if(kind === 'star'){
        applyStar();
      }else if(kind === 'shield'){
        applyShield();
      }else{
        // unknown => treat as junk-ish
        onHitJunk();
      }
    },

    onExpire:(t)=>{
      // good หมดอายุ = miss, junk/star/shield หมดอายุไม่ลงโทษ
      if((t.kind||'') === 'good') onExpireGood();
    },

    // trick: ใช้ spawnRateMs ในการกำหนด “จังหวะ spawn จริง” ผ่าน lastSpawnAt ใน mode-factory
    // => เราปรับ spawnRateMs แล้ว mode-factory จะ spawn ช้าหรือเร็วขึ้นเอง
    get spawnRate(){
      return STATE.spawnRateMs;
    }
  });
}

/* ------------------------------
 * main boot
 * ------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('GoodJunkVR: mount missing');

  STATE.cfg = cfg;

  const runMode = (cfg.runMode || 'play').toLowerCase();
  const isResearch = (runMode === 'research' || runMode === 'study');

  STATE.adaptiveOn = !isResearch;

  STATE.rng = isResearch ? seededRng(cfg.seed || Date.now()) : Math.random;

  // reset
  STATE.running = true;
  STATE.ended = false;

  STATE.score = 0;
  STATE.combo = 0;
  STATE.comboMax = 0;

  STATE.miss = 0;
  STATE.hitGood = 0;
  STATE.hitJunk = 0;
  STATE.expireGood = 0;

  STATE.star = 0;
  STATE.shield = 0;

  STATE.g = [0,0,0,0,0];

  STATE.goal.cur = 0;
  STATE.goal.done = false;
  STATE.mini.cur = 0;
  STATE.mini.done = false;

  STATE.timeLeft = Number(cfg.durationPlannedSec) || 70;

  emit('hha:start', {
    game:'goodjunk',
    runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  emitScore();
  startTimer();

  // spawn
  try{ STATE.engine?.stop?.(); }catch{}
  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เก็บของดี เลี่ยงของหวาน/ทอด 😄', 'Coach');
}