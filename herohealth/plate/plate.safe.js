// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive (DD-lite) ON
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Supports: Boss/Storm hooks (CSS layers exist)
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ Uses mode-factory.js with decorateTarget(el, target)
// ✅ Adds: ⭐ Star (reduce miss by 1) + 🛡 Shield (block next junk hit)
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

function pct2(n){
  n = Number(n) || 0;
  return Math.round(n * 100) / 100;
}

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

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * Food group mapping (Thai 5 food groups) — DO NOT CHANGE
 * 1 Protein / 2 Carbs / 3 Veg / 4 Fruit / 5 Fat
 * ------------------------------------------------ */
const GROUPS = [
  { id:1, name:'หมู่ 1 โปรตีน', hint:'เนื้อ/นม/ไข่/ถั่ว', emojis:['🥩','🥚','🥛','🫘','🐟','🍗'] },
  { id:2, name:'หมู่ 2 คาร์บ',   hint:'ข้าว/แป้ง/เผือก/มัน/น้ำตาล', emojis:['🍚','🍞','🍜','🥔','🍠','🍯'] },
  { id:3, name:'หมู่ 3 ผัก',     hint:'ผักสีเขียว/เหลือง', emojis:['🥦','🥬','🥕','🌽','🥒','🫑'] },
  { id:4, name:'หมู่ 4 ผลไม้',   hint:'ผลไม้หลากสี', emojis:['🍎','🍌','🍇','🍊','🍉','🍍'] },
  { id:5, name:'หมู่ 5 ไขมัน',   hint:'ไขมัน/น้ำมัน', emojis:['🥑','🫒','🧈','🥜','🌰','🫗'] },
];

const JUNK_EMOJIS = ['🍩','🍟','🍔','🍕','🍗','🧁','🍰','🍫','🍿','🥤','🍪'];

/* ------------------------------------------------
 * Engine state
 * ------------------------------------------------ */
const STATE = {
  running:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,

  miss:0,          // miss = good expired + junk hit (blocked junk NOT count)
  shield:0,        // 1 = block next junk hit
  stars:0,         // for fun stats (optional)

  timeLeft:0,
  timer:null,

  // plate groups collected
  g:[0,0,0,0,0], // index 0..4

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
  blockedJunk:0,
  expireGood:0,

  // config / rng
  cfg:null,
  rng:Math.random,

  // spawn controller
  engine:null,

  // DD-lite params (play only)
  dd:{
    spawnRateMs:900,
    goodTTL:2100,
    junkTTL:1700,
    goodWeight:0.70,
    junkWeight:0.27,
    starWeight:0.02,
    shieldWeight:0.01,
    nextTweakAtSec:0
  }
};

/* ------------------------------------------------
 * Score + HUD
 * ------------------------------------------------ */
function emitScore(){
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax,
    miss: STATE.miss,
    shield: STATE.shield,
    stars: STATE.stars
  });
}

function addScore(v){
  STATE.score += Number(v)||0;
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
 *   total = hitGood + hitJunk + expireGood
 *   (blocked junk ไม่ควรทำให้ความแม่นตก)
 * ------------------------------------------------ */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
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
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);

  try{ STATE.engine?.stop?.(); }catch{}

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

    shield: STATE.shield,
    stars: STATE.stars,

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4]
  });
}

/* ------------------------------------------------
 * Timer + DD-lite tick
 * ------------------------------------------------ */
function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.dd.nextTweakAtSec = Math.max(5, Math.floor(STATE.timeLeft - 10));

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    // DD-lite: ทุก ~10 วินาที ปรับนิด ๆ (เฉพาะ play)
    if(STATE.cfg?.runMode === 'play'){
      const left = STATE.timeLeft;
      if(left > 0 && left % 10 === 0){
        ddTweak();
      }
    }

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * DD-lite (เล่นให้ “สนุก-ท้าทาย” แต่ยังแฟร์)
 *   - ถ้าแม่น/คอมโบดี => เร่งเล็กน้อย + เพิ่ม junk นิด
 *   - ถ้าพลาดบ่อย => ผ่อนเล็กน้อย + เพิ่ม good
 *   - research/study: ปิด (deterministic)
 * ------------------------------------------------ */
function ddTweak(){
  const acc = accuracy();              // 0..1
  const combo = STATE.comboMax;

  // base by diff
  const diff = (STATE.cfg?.diff || 'normal');
  const d = STATE.dd;

  let baseRate = 900, baseJunk = 0.27;
  if(diff === 'easy'){ baseRate = 980; baseJunk = 0.20; }
  else if(diff === 'hard'){ baseRate = 820; baseJunk = 0.34; }

  // performance delta
  let k = 0;
  if(acc >= 0.85 && combo >= 6) k = +1;
  else if(acc <= 0.70 || STATE.miss >= 5) k = -1;

  // apply
  d.spawnRateMs = clamp(baseRate - (k*60), 720, 1100);
  d.junkWeight  = clamp(baseJunk + (k*0.03), 0.18, 0.42);
  d.goodWeight  = clamp(1 - d.junkWeight - d.starWeight - d.shieldWeight, 0.50, 0.80);

  // TTL ปรับนิด ๆ
  d.goodTTL = clamp(2100 - (k*120), 1600, 2600);
  d.junkTTL = clamp(1700 - (k*120), 1200, 2200);

  // ถ้าเริ่มยากขึ้น แจ้งแบบ coach สั้น ๆ
  if(k > 0) coach('เริ่มเร่งแล้วนะ! โฟกัสดี ๆ 👀');
  else if(k < 0) coach('ไม่เป็นไร ผ่อนนิดนึง ลองใหม่ได้ ✅');
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function updateGoal(){
  if(STATE.goal.done) return;
  // จำนวนหมู่ที่ “เคยเก็บได้แล้ว”
  STATE.goal.cur = STATE.g.filter(v => v > 0).length;
  if(STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
  }
}

function updateMini(){
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }
}

function onHitGood(groupIndex){
  STATE.hitGood++;
  const gi = clamp(groupIndex, 0, 4);
  STATE.g[gi]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  updateGoal();
  updateMini();
  emitQuest();
}

function onHitJunk(){
  // shield blocks first
  if(STATE.shield > 0){
    STATE.blockedJunk++;
    STATE.shield = Math.max(0, STATE.shield - 1);
    resetCombo();
    addScore(+10);
    coach('🛡 กันพลาดไว้ได้! (ไม่คิด Miss)');
    emitScore();
    return;
  }

  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');

  updateMini();
  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  updateMini();
  emitQuest();
}

function onHitStar(){
  STATE.stars++;
  // reduce miss by 1 (floor 0)
  const before = STATE.miss;
  STATE.miss = Math.max(0, STATE.miss - 1);
  addScore(+120);
  coach(before !== STATE.miss ? '⭐ ลด Miss ลง 1!' : '⭐ โบนัสคะแนน!');
  emitScore();
}

function onHitShield(){
  STATE.shield = 1; // 1-hit shield
  addScore(+80);
  coach('🛡 ได้โล่! กันของหวาน/ทอดได้ 1 ครั้ง');
  emitScore();
}

/* ------------------------------------------------
 * Target decoration (emoji/icon)
 * ------------------------------------------------ */
function pickFrom(arr, rng){
  if(!arr || !arr.length) return '';
  const i = Math.floor((rng ? rng() : Math.random()) * arr.length);
  return arr[Math.max(0, Math.min(arr.length-1, i))];
}

function decorateTarget(el, t){
  const kind = t.kind || 'good';

  // ensure clean
  el.textContent = '';
  el.removeAttribute('title');

  if(kind === 'good'){
    const gi = clamp(t.groupIndex, 0, 4);
    const g = GROUPS[gi];
    const emoji = pickFrom(g.emojis, t.rng);
    el.textContent = emoji;

    // tag group (optional CSS hooks)
    el.dataset.group = String(g.id);
    el.title = `${g.name} (${g.hint})`;

    // tiny glow hint by group (inline; CSS ก็ได้)
    const glows = [
      'rgba(34,197,94,.22)',   // g1
      'rgba(245,158,11,.22)',  // g2
      'rgba(34,211,238,.22)',  // g3
      'rgba(167,139,250,.22)', // g4
      'rgba(244,63,94,.20)',   // g5
    ];
    el.style.boxShadow =
      `0 18px 48px rgba(0,0,0,.32),
       0 0 24px ${glows[gi] || 'rgba(34,197,94,.18)'},
       inset 0 1px 0 rgba(255,255,255,.08)`;
    return;
  }

  if(kind === 'junk'){
    el.textContent = pickFrom(JUNK_EMOJIS, t.rng);
    el.title = 'ของหวาน/ทอด (ควรเลี่ยง)';
    return;
  }

  if(kind === 'star'){
    el.textContent = '⭐';
    el.title = 'Star: ลด Miss ลง 1';
    return;
  }

  if(kind === 'shield'){
    el.textContent = '🛡️';
    el.title = 'Shield: กันของหวาน/ทอด 1 ครั้ง';
    return;
  }
}

/* ------------------------------------------------
 * Spawn logic
 * ------------------------------------------------ */
function buildKinds(){
  const d = STATE.dd;
  return [
    { kind:'good',   weight: d.goodWeight },
    { kind:'junk',   weight: d.junkWeight },
    { kind:'star',   weight: d.starWeight },
    { kind:'shield', weight: d.shieldWeight },
  ];
}

function makeSpawner(mount){
  const d = STATE.dd;

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: d.spawnRateMs,
    sizeRange:[46,70],
    kinds: buildKinds(),

    // decorate with emoji/icons
    decorateTarget,

    onHit:(meta)=>{
      const kind = meta.kind || 'good';
      if(kind === 'good'){
        onHitGood(meta.groupIndex ?? 0);
      }else if(kind === 'junk'){
        onHitJunk();
      }else if(kind === 'star'){
        onHitStar();
      }else if(kind === 'shield'){
        onHitShield();
      }
    },

    onExpire:(t)=>{
      // expire counts only for good (miss)
      if((t.kind || '') === 'good') onExpireGood();
    },
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
  STATE.shield = 0;
  STATE.stars = 0;

  STATE.hitGood = 0;
  STATE.hitJunk = 0;
  STATE.blockedJunk = 0;
  STATE.expireGood = 0;
  STATE.g = [0,0,0,0,0];

  STATE.goal.cur = 0;
  STATE.goal.done = false;
  STATE.mini.cur = 0;
  STATE.mini.done = false;

  // RNG
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // init DD baseline by diff
  const diff = (cfg.diff || 'normal').toLowerCase();
  const d = STATE.dd;

  if(diff === 'easy'){
    d.spawnRateMs = 980; d.junkWeight = 0.20; d.goodWeight = 0.77;
    d.starWeight = 0.02; d.shieldWeight = 0.01;
    d.goodTTL = 2300; d.junkTTL = 1850;
  }else if(diff === 'hard'){
    d.spawnRateMs = 820; d.junkWeight = 0.34; d.goodWeight = 0.63;
    d.starWeight = 0.02; d.shieldWeight = 0.01;
    d.goodTTL = 2000; d.junkTTL = 1550;
  }else{
    d.spawnRateMs = 900; d.junkWeight = 0.27; d.goodWeight = 0.70;
    d.starWeight = 0.02; d.shieldWeight = 0.01;
    d.goodTTL = 2100; d.junkTTL = 1700;
  }

  // research/study: ปิด adaptive (ล็อกค่าเดิมไว้)
  // (ค่า d.* จะคงที่ ไม่ถูก ddTweak() เรียก)
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitScore();
  emitQuest();
  startTimer();

  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}