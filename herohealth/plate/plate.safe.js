// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
// ✅ Emits: hha:start, hha:score, hha:time, quest:update, hha:coach, hha:end
// ✅ Uses ../vr/mode-factory.js (export boot)
// ✅ Crosshair/tap-to-shoot via vr-ui.js (hha:shoot)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

const WIN = window;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

const pct = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = (Number(seed) || Date.now()) >>> 0;
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

  // plate groups (5 หมู่)
  g:[0,0,0,0,0],

  goal:{ name:'เติมจานให้ครบ 5 หมู่', sub:'เก็บอาหารให้ครบทุกหมู่', cur:0, target:5, done:false },
  mini:{ name:'ความแม่นยำ', sub:'คุมความแม่น ≥ 80%', cur:0, target:80, done:false },

  hitGood:0,
  hitJunk:0,
  expireGood:0,

  cfg:null,
  rng:Math.random,
  engine:null
};

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

function emitQuest(){
  emit('quest:update', {
    goal:{ name:STATE.goal.name, sub:STATE.goal.sub, cur:STATE.goal.cur, target:STATE.goal.target },
    mini:{ name:STATE.mini.name, sub:STATE.mini.sub, cur:STATE.mini.cur, target:STATE.mini.target, done:STATE.mini.done },
    allDone: STATE.goal.done && STATE.mini.done
  });
}

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

function addScore(v){
  STATE.score += v;
  emit('hha:score', { score: STATE.score, combo: STATE.combo, comboMax: STATE.comboMax });
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
    accuracyGoodPct: pct(accuracy() * 100),
    g1: STATE.g[0], g2: STATE.g[1], g3: STATE.g[2], g4: STATE.g[3], g5: STATE.g[4]
  });
}

function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });
  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;
    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });
    if(STATE.timeLeft <= 0) endGame('timeup');
  }, 1000);
}

function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  emitQuest();

  // optional: end early if both done (เด็ก ป.5 จะชอบ “ผ่านไว”)
  if(STATE.goal.done && STATE.mini.done){
    endGame('allDone');
  }
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
}

/* ---------------- Emoji sets (ลดความน่าเบื่อ) ----------------
   5 หมู่: 0-4
   G1 ผัก, G2 ผลไม้, G3 โปรตีน, G4 ธัญพืช/ข้าว, G5 ไขมันดี
*/
const EMOJI_GOOD = [
  ['🥦','🥬','🥕','🌽'],        // G1
  ['🍎','🍌','🍇','🍉'],        // G2
  ['🐟','🥚','🍗','🫘'],        // G3
  ['🍚','🍞','🥖','🥔'],        // G4
  ['🥑','🫒','🥜','🧀']         // G5 (ให้ไขมันดีเด่น ๆ)
];
const EMOJI_JUNK = ['🍟','🍔','🍩','🧁','🍫','🥤'];

function pickGoodEmoji(gi, rng){
  const arr = EMOJI_GOOD[gi] || ['🍽️'];
  return arr[Math.floor(rng()*arr.length)];
}
function pickJunkEmoji(rng){
  return EMOJI_JUNK[Math.floor(rng()*EMOJI_JUNK.length)];
}

function makeSpawner(mount){
  const diff = (STATE.cfg.diff || 'normal').toLowerCase();
  const run  = (STATE.cfg.runMode || 'play').toLowerCase();

  // เร่งนิด ๆ: hard/fast spawn ถี่ขึ้น
  const spawnRate =
    diff === 'hard' ? 650 :
    diff === 'easy' ? 980 :
    820;

  const ttlMs =
    diff === 'hard' ? 1100 :
    diff === 'easy' ? 1500 :
    1300;

  // ปรับสัดส่วน junk ตามความยาก (เด็ก ป.5 ไม่ควรโหดเกิน)
  const junkW =
    diff === 'hard' ? 0.36 :
    diff === 'easy' ? 0.22 :
    0.30;

  // research/study: คงที่ (ไม่ปรับ adaptive ในตัวอย่างนี้)
  const rng = STATE.rng;

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    rng,
    spawnRate,
    ttlMs,
    sizeRange: diff === 'hard' ? [42, 62] : [44, 66],
    kinds: [
      // good: ใส่ groupIndex/emoji ให้ target สร้างได้ “หลากหลาย”
      { kind:'good', weight: 1 - junkW, groupIndex: 0, emoji: pickGoodEmoji(0, rng) },
      { kind:'good', weight: 1 - junkW, groupIndex: 1, emoji: pickGoodEmoji(1, rng) },
      { kind:'good', weight: 1 - junkW, groupIndex: 2, emoji: pickGoodEmoji(2, rng) },
      { kind:'good', weight: 1 - junkW, groupIndex: 3, emoji: pickGoodEmoji(3, rng) },
      { kind:'good', weight: 1 - junkW, groupIndex: 4, emoji: pickGoodEmoji(4, rng) },
      { kind:'junk', weight: junkW, emoji: pickJunkEmoji(rng) }
    ],
    onHit:(t)=>{
      if(t.kind === 'good'){
        // groupIndex มาจาก kind config หรือสุ่ม fallback
        const gi = (typeof t.groupIndex === 'number') ? t.groupIndex : Math.floor(rng()*5);
        onHitGood(clamp(gi, 0, 4));
      }else{
        onHitJunk();
      }
    },
    onExpire:(t)=>{
      if(t.kind === 'good') onExpireGood();
    }
  });
}

export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // cfg
  STATE.cfg = cfg || {};
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
  STATE.goal.cur = 0; STATE.goal.done = false;
  STATE.mini.cur = 0; STATE.mini.done = false;

  // RNG
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  startTimer();

  // start spawner
  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}