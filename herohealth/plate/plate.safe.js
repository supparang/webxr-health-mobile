// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------

'use strict';

import '../vr/mode-factory.js';

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

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

function getSpawnBoot(){
  const gm = WIN.GAME_MODULES || {};
  const mf = gm.ModeFactory || gm.modeFactory || WIN.ModeFactory || null;
  const bootFn = mf && typeof mf.boot === 'function' ? mf.boot : null;
  if(!bootFn){
    // 🔴 make it loud
    console.error('[PlateVR] ModeFactory not found', { GAME_MODULES: gm, ModeFactory: mf });
    coach('⚠️ ไม่พบ ModeFactory.boot — เช็คไฟล์ /vr/mode-factory.js', 'System');
    throw new Error('ModeFactory.boot not found');
  }
  return bootFn;
}

function ensureMountReady(mount){
  // wait until mount has non-zero size
  return new Promise((resolve)=>{
    const tryNow = ()=>{
      const r = mount.getBoundingClientRect();
      if(r.width > 40 && r.height > 40) return resolve(r);
      requestAnimationFrame(()=>requestAnimationFrame(tryNow)); // wait 2 frames
    };
    tryNow();
  });
}

// tiny visual debug to prove layer is visible
function debugDot(mount, xPct, yPct){
  try{
    const el = DOC.createElement('div');
    el.style.cssText = `
      position:absolute;
      left:${xPct}%;
      top:${yPct}%;
      width:18px; height:18px;
      border-radius:999px;
      border:2px solid rgba(34,197,94,.65);
      box-shadow:0 0 22px rgba(34,197,94,.25);
      transform:translate(-50%,-50%);
      pointer-events:none;
      z-index:9999;
      opacity:.9;
    `;
    mount.appendChild(el);
    setTimeout(()=>el.remove(), 2200);
  }catch{}
}

/* ------------------------------------------------
 * State
 * ------------------------------------------------ */
const STATE = {
  running:false,
  ended:false,
  rush:false,

  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  timeLeft:0,
  timer:null,

  g:[0,0,0,0,0],

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

  hitGood:0,
  hitJunk:0,
  expireGood:0,

  cfg:null,
  rng:Math.random,

  engine:null
};

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

function resetCombo(){
  STATE.combo = 0;
}

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

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4]
  });
}

function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    if(!STATE.rush && STATE.timeLeft === 15){
      STATE.rush = true;
      coach('🔥 ช่วงเร่ง! 15 วิสุดท้าย — เก็บของดีให้ไว (+20% คะแนน)', 'Coach');
    }

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();

  let base = 100 + STATE.combo * 5;
  if(STATE.rush) base = Math.round(base * 1.2);
  addScore(base);

  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach');
    }
  }

  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'Coach');
  }

  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
}

function makeSpawner(mount){
  const spawnBoot = getSpawnBoot();

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: (STATE.cfg.diff === 'hard') ? 650 : 850, // ✅ เร่งนิด ๆ
    sizeRange:[46,66],
    kinds:[
      { kind:'good', weight:0.72 },
      { kind:'junk', weight:0.28 }
    ],
    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = t.groupIndex ?? (Math.floor(STATE.rng()*5));
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
export async function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  STATE.cfg = cfg;
  STATE.running = true;
  STATE.ended = false;
  STATE.rush = false;

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

  // ✅ wait for mount ready (fix "no spawn")
  await ensureMountReady(mount);

  // ✅ visual proof
  debugDot(mount, 50, 60);
  debugDot(mount, 20, 80);

  // ✅ start spawner
  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
}
