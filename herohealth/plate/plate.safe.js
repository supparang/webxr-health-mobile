// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ✅ Play / Research modes (seeded in research/study)
// ✅ Emits: hha:start, hha:score, hha:time, quest:update, hha:coach, hha:end
// ✅ Uses DOM spawner from ../vr/mode-factory.js (export boot)

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

  // 5 groups
  g:[0,0,0,0,0],

  goal:{ name:'เติมจานให้ครบ 5 หมู่', sub:'เก็บอาหารให้ครบทุกหมู่', cur:0, target:5, done:false },
  mini:{ name:'ความแม่นยำ', sub:'คุมความแม่น ≥ 80%', cur:0, target:80, done:false },

  hitGood:0,
  hitJunk:0,
  expireGood:0,

  cfg:null,
  rng:Math.random,

  spawner:null
};

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

function emitQuest(){
  emit('quest:update', {
    goal:{ name:STATE.goal.name, sub:STATE.goal.sub, cur:STATE.goal.cur, target:STATE.goal.target },
    mini:{ name:STATE.mini.name, sub:STATE.mini.sub, cur:STATE.mini.cur, target:STATE.mini.target, done:STATE.mini.done },
    allDone: STATE.goal.done && STATE.mini.done
  });
}

function addScore(v){
  STATE.score += v;
  emit('hha:score', { score:STATE.score, combo:STATE.combo, comboMax:STATE.comboMax });
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
  try{ STATE.spawner?.destroy?.(); }catch(_){}

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

  // optional: auto-finish when both done (feel good for kids)
  if(STATE.goal.done && STATE.mini.done){
    // give a tiny delay for celebration feel
    setTimeout(()=>endGame('allDone'), 380);
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

function makeSpawner(mount){
  const diff = (STATE.cfg.diff || 'normal').toLowerCase();

  // Slightly faster for "เร่งนิด ๆ" feel
  const spawnRate =
    diff === 'hard' ? 620 :
    diff === 'easy' ? 920 :
    780;

  // more variety for Plate (still emoji-based)
  const goodEmojis = ['🥦','🍎','🐟','🍚','🥑'];
  const junkEmojis = ['🍟','🍩','🍔','🧁','🥤'];

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    rng: STATE.rng,
    spawnRate,
    sizeRange:[46, 68],
    kinds:[
      // good targets
      { kind:'good', weight:0.74, emoji: goodEmojis[0] },
      { kind:'good', weight:0.74, emoji: goodEmojis[1] },
      { kind:'good', weight:0.74, emoji: goodEmojis[2] },
      { kind:'good', weight:0.74, emoji: goodEmojis[3] },
      { kind:'good', weight:0.74, emoji: goodEmojis[4] },

      // junk targets (less frequent)
      { kind:'junk', weight:0.55, emoji: junkEmojis[0] },
      { kind:'junk', weight:0.55, emoji: junkEmojis[1] },
      { kind:'junk', weight:0.55, emoji: junkEmojis[2] },
      { kind:'junk', weight:0.55, emoji: junkEmojis[3] },
      { kind:'junk', weight:0.55, emoji: junkEmojis[4] },
    ],
    onHit:(t)=>{
      if(t.kind === 'good'){
        // Map emoji -> group index
        let gi = 0;
        const e = t.emoji || '';
        if(e === '🥦') gi = 0;
        else if(e === '🍎') gi = 1;
        else if(e === '🐟') gi = 2;
        else if(e === '🍚') gi = 3;
        else if(e === '🥑') gi = 4;
        else gi = Math.floor(STATE.rng()*5);

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

export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  STATE.cfg = cfg || {};
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

  STATE.goal.cur = 0; STATE.goal.done = false;
  STATE.mini.cur = 0; STATE.mini.done = false;

  // RNG
  const rm = (STATE.cfg.runMode || 'play').toLowerCase();
  if(rm === 'research' || rm === 'study'){
    STATE.rng = seededRng(STATE.cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  STATE.timeLeft = Number(STATE.cfg.durationPlannedSec) || 90;

  emit('hha:start', {
    game:'plate',
    runMode: STATE.cfg.runMode,
    diff: STATE.cfg.diff,
    seed: STATE.cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  startTimer();

  STATE.spawner = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}