// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION+)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON
//   - research/study: deterministic seed + adaptive OFF + AI OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Uses DOM spawner: ../vr/mode-factory.js (export boot)
// ✅ Crosshair shooting via vr-ui.js: hha:shoot
// ✅ Boss/Storm hooks (UI layers exist; engine toggles optional)
// ✅ AI hooks placeholders (OFF by default)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

const WIN = window;
const DOC = document;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

function seededRng(seed){
  let t = (Number(seed) || Date.now()) >>> 0;
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

/* ------------------------------------------------
 * Emoji sets (ไม่จำเจ + เข้าใจง่าย ป.5)
 * ------------------------------------------------ */
const FOOD = {
  // 5 หมู่ (ตัวอย่าง emoji หลายแบบต่อหมวด)
  g1_veg: ['🥦','🥕','🥬','🥒','🌽'],
  g2_fruit: ['🍎','🍌','🍇','🍊','🍉','🥭','🍍','🍓'],
  g3_protein: ['🐟','🍗','🥚','🫘','🥜','🍤'],
  g4_grain: ['🍚','🍞','🥖','🍜','🥨','🥐'],
  g5_fat: ['🥑','🧀','🥥','🌰','🫒'],

  // junk / sweets / fried
  junk: ['🍩','🍟','🍔','🍕','🧋','🍪','🍫','🧁','🍭'],

  // powerups
  shield: ['🛡️','✨','💎'] // engine will map kinds
};

function pick(rng, arr){
  if(!arr || !arr.length) return '❓';
  return arr[Math.floor(rng() * arr.length)];
}

function computePlateHave(g){
  // นับว่าครบกี่หมู่แล้ว (มีอย่างน้อย 1 ในหมวด)
  return g.filter(v => v > 0).length;
}

/* ------------------------------------------------
 * AI hooks (OFF by default)
 * ------------------------------------------------ */
function makeAIHooks(cfg){
  const enabled = !!cfg?.aiEnabled; // default false
  return {
    enabled,
    onTick(_s){ if(!enabled) return; },
    onHit(_t,_s){ if(!enabled) return; },
    onMiss(_t,_s){ if(!enabled) return; },
    onPhase(_name,_s){ if(!enabled) return; }
  };
}

/* ------------------------------------------------
 * STATE
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

  // plate groups counts (5 หมู่)
  g:[0,0,0,0,0], // [veg,fruit,protein,grain,fat]

  // targets counters
  hitGood:0,
  hitJunk:0,
  hitShield:0,
  expireGood:0,

  // quest
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่ (อย่างน้อย 1 ต่อหมวด)',
    cur:0,
    target:5,
    done:false
  },
  mini:{
    name:'ความแม่นยำ',
    sub:'คุมความแม่น ≥ 80%',
    cur:0,       // current accuracy %
    target:80,
    done:false
  },

  // mode/cfg
  cfg:null,
  rng:Math.random,

  // spawner controller
  spawner:null,

  // adaptive knobs (play only)
  spawnRateMs: 900,
  ttlMs: 1700,
  junkWeight: 0.30,
  shieldWeight: 0.04,

  // power
  shieldUntil: 0,

  // ai hooks
  ai:null
};

/* ------------------------------------------------
 * UI helpers
 * ------------------------------------------------ */
function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

function emitScore(){
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax
  });
}

function emitTime(){
  emit('hha:time', { leftSec: STATE.timeLeft });
}

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

function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * Scoring
 * ------------------------------------------------ */
function addCombo(){
  STATE.combo++;
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
}
function resetCombo(){
  STATE.combo = 0;
}

function addScore(v){
  STATE.score += (Number(v)||0);
  emitScore();
}

/* ------------------------------------------------
 * Phase hooks (Boss / Storm minimal)
 * ------------------------------------------------ */
function setFx(id, clsOn, on){
  const el = DOC.getElementById(id);
  if(!el) return;
  if(on){
    el.classList.add(clsOn);
    // ถ้า CSS ใช้ display:none เป็น default ให้เปิดด้วย
    if(el.style && el.style.display === 'none') el.style.display = 'block';
  }else{
    el.classList.remove(clsOn);
  }
}

/* ------------------------------------------------
 * Adaptive (play only)
 * ------------------------------------------------ */
function applyAdaptive(){
  // adaptive ON only in play mode
  if(STATE.cfg.runMode !== 'play') return;

  const acc = accuracy(); // 0..1
  const have = computePlateHave(STATE.g); // 0..5
  const pressure = clamp((STATE.miss / 10), 0, 1);

  // ถ้าแม่น + คอมโบดี -> เร่งเล็กน้อย
  // ถ้าพลาดเยอะ/แม่นต่ำ -> ผ่อนเล็กน้อย
  const skill = clamp((acc * 0.75) + (Math.min(STATE.combo, 20)/20)*0.25, 0, 1);
  const ease = clamp((1 - skill) * 0.7 + pressure * 0.3, 0, 1);

  // spawn rate: 650..980
  STATE.spawnRateMs = Math.round(650 + ease * 330);

  // ttl: 1300..2200 (ง่ายขึ้น -> ttl ยาว)
  STATE.ttlMs = Math.round(1300 + ease * 900);

  // junk weight: 0.24..0.40 (เก่งขึ้น -> junk เยอะขึ้นนิด)
  STATE.junkWeight = clamp(0.24 + (1 - ease) * 0.16, 0.20, 0.45);

  // shield weight: ช่วยคนพลาดเยอะ (0.03..0.08)
  STATE.shieldWeight = clamp(0.03 + ease * 0.05, 0.02, 0.10);

  // ถ้าเริ่มใกล้ครบ 5 หมู่ -> เพิ่มแรงกดดันนิด (junk เพิ่มเล็กน้อย)
  if(have >= 4) STATE.junkWeight = clamp(STATE.junkWeight + 0.03, 0.20, 0.50);
}

/* ------------------------------------------------
 * Target payload builder for spawner
 * ------------------------------------------------ */
function buildKinds(){
  // good = 5 หมู่ แบ่งเป็น 5 kind ย่อยผ่าน groupIndex + emoji
  // junk = ขยะอาหาร
  // shield = ช่วยกันโดน junk (ลด miss)
  const wJ = clamp(STATE.junkWeight, 0.20, 0.55);
  const wS = clamp(STATE.shieldWeight, 0.00, 0.15);
  const wG = clamp(1 - (wJ + wS), 0.20, 0.80);

  // กระจายน้ำหนัก good ไป 5 หมู่เท่า ๆ กัน
  const each = wG / 5;

  return [
    { kind:'good', weight: each, groupIndex:0, emojiPool: FOOD.g1_veg },
    { kind:'good', weight: each, groupIndex:1, emojiPool: FOOD.g2_fruit },
    { kind:'good', weight: each, groupIndex:2, emojiPool: FOOD.g3_protein },
    { kind:'good', weight: each, groupIndex:3, emojiPool: FOOD.g4_grain },
    { kind:'good', weight: each, groupIndex:4, emojiPool: FOOD.g5_fat },
    { kind:'junk', weight: wJ, emojiPool: FOOD.junk },
    { kind:'shield', weight: wS, emojiPool: FOOD.shield }
  ];
}

function decorateTargetEl(t){
  // mode-factory สร้าง el ให้แล้ว → เรา set emoji/size tweak ตรงนี้ได้
  if(!t || !t.el) return;

  const kind = t.kind;
  if(kind === 'junk'){
    t.el.textContent = pick(STATE.rng, FOOD.junk);
  }else if(kind === 'shield'){
    t.el.textContent = pick(STATE.rng, FOOD.shield);
  }else{
    // good: groupIndex -> pool
    const gi = clamp(t.groupIndex ?? 0, 0, 4);
    const pool =
      gi === 0 ? FOOD.g1_veg :
      gi === 1 ? FOOD.g2_fruit :
      gi === 2 ? FOOD.g3_protein :
      gi === 3 ? FOOD.g4_grain :
      FOOD.g5_fat;
    t.el.textContent = pick(STATE.rng, pool);
  }
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 6);

  // update goal progress
  if(!STATE.goal.done){
    STATE.goal.cur = computePlateHave(STATE.g);
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('ครบ 5 หมู่แล้ว! 🎉 เก่งมาก!', 'Coach');
      emit('hha:judge', { kind:'goal', result:'complete' });
    }
  }

  // mini: accuracy
  const accPct = Math.round(accuracy() * 100);
  STATE.mini.cur = accPct;
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำผ่านแล้ว! 👍', 'Coach');
    emit('hha:judge', { kind:'mini', result:'complete' });
  }

  emitQuest();

  // adaptive tick
  applyAdaptive();
  rebuildSpawnerIfNeeded();

  // AI hook
  STATE.ai?.onHit?.({ kind:'good', groupIndex }, STATE);
}

function onHitJunk(){
  STATE.hitJunk++;

  // shield active?
  const now = Date.now();
  if(now < STATE.shieldUntil){
    // blocked: ไม่คิด miss
    addScore(-10);
    coach('🛡️ โล่กันไว้ได้!', 'Coach');
    STATE.ai?.onHit?.({ kind:'junk-guard' }, STATE);
    return;
  }

  STATE.miss++;
  resetCombo();
  addScore(-60);
  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');

  emitQuest();

  applyAdaptive();
  rebuildSpawnerIfNeeded();

  STATE.ai?.onMiss?.({ kind:'junk' }, STATE);
}

function onHitShield(){
  STATE.hitShield++;
  // โล่ 6 วินาที (ปรับได้)
  STATE.shieldUntil = Date.now() + 6000;
  addScore(30);
  coach('ได้โล่! 🛡️ กันพลาดได้ชั่วคราว', 'Coach');

  applyAdaptive();
  rebuildSpawnerIfNeeded();

  STATE.ai?.onHit?.({ kind:'shield' }, STATE);
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  applyAdaptive();
  rebuildSpawnerIfNeeded();

  STATE.ai?.onMiss?.({ kind:'expire-good' }, STATE);
}

/* ------------------------------------------------
 * Spawner lifecycle
 * ------------------------------------------------ */
function buildSpawner(mount){
  // rebuild kinds each time (adaptive weights)
  const kinds = buildKinds();

  const ctrl = spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    rng: STATE.rng,

    spawnRate: STATE.spawnRateMs,
    ttlMs: STATE.ttlMs,
    sizeRange: (STATE.cfg.view === 'pc') ? [52, 76] : [46, 70],

    kinds,

    onHit: (t)=>{
      // set emoji (ensure)
      decorateTargetEl(t);

      if(t.kind === 'good'){
        const gi = clamp(t.groupIndex ?? 0, 0, 4);
        onHitGood(gi);
      }else if(t.kind === 'shield'){
        onHitShield();
      }else{
        onHitJunk();
      }
    },

    onExpire: (t)=>{
      // only punish expired GOOD (ตรงกับ logic เดิมของคุณ)
      if(t.kind === 'good') onExpireGood();
    }
  });

  // immediately decorate existing new spawns is handled in mode-factory default,
  // but we also decorate at hit time; ok.

  return ctrl;
}

function rebuildSpawnerIfNeeded(){
  // เฉพาะ play mode เท่านั้นที่ adaptive จะเปลี่ยน config บ่อย
  if(STATE.cfg.runMode !== 'play') return;
  if(!STATE.spawner) return;

  // rebuild แบบเบา ๆ เมื่อค่าหลักเปลี่ยนจริง (ลด jitter)
  const key = `${STATE.spawnRateMs}|${STATE.ttlMs}|${STATE.junkWeight.toFixed(3)}|${STATE.shieldWeight.toFixed(3)}`;
  if(STATE.__lastSpawnerKey === key) return;
  STATE.__lastSpawnerKey = key;

  try{
    STATE.spawner.stop?.();
  }catch(_){}

  const mount = DOC.getElementById('plate-layer') || STATE.cfg.__mount;
  if(mount){
    STATE.spawner = buildSpawner(mount);
  }
}

/* ------------------------------------------------
 * Timer
 * ------------------------------------------------ */
function startTimer(){
  emitTime();
  clearInterval(STATE.timer);

  STATE.timer = setInterval(()=>{
    if(!STATE.running || STATE.ended) return;
    STATE.timeLeft--;
    emitTime();
    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * End
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  try{ clearInterval(STATE.timer); }catch(_){}
  try{ STATE.spawner?.stop?.(); }catch(_){}

  // grade heuristic (simple)
  const accPct = Math.round(accuracy() * 100);
  const have = computePlateHave(STATE.g);
  const grade =
    (have === 5 && accPct >= 90 && STATE.miss <= 1) ? 'SSS' :
    (have === 5 && accPct >= 85) ? 'SS' :
    (have === 5 && accPct >= 75) ? 'S'  :
    (have >= 4 && accPct >= 70) ? 'A'  :
    (have >= 3) ? 'B' : 'C';

  emit('hha:end', {
    reason,

    // summary core
    runMode: STATE.cfg.runMode,
    diff: STATE.cfg.diff,
    seed: STATE.cfg.seed,
    durationPlannedSec: STATE.cfg.durationPlannedSec,
    durationPlayedSec: (STATE.cfg.durationPlannedSec - Math.max(0, STATE.timeLeft)),

    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: accPct,
    grade,

    // counts per group
    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],

    // counters
    nHitGood: STATE.hitGood,
    nHitJunk: STATE.hitJunk,
    nHitShield: STATE.hitShield,
    nExpireGood: STATE.expireGood
  });
}

/* ------------------------------------------------
 * Boot
 * ------------------------------------------------ */
function waitMountReady(mount, ms=2000){
  // กันกรณี mount ยัง 0x0 ทำให้เป้าไม่โผล่
  const start = Date.now();
  return new Promise((resolve)=>{
    function tick(){
      const r = mount.getBoundingClientRect();
      const ok = (r.width >= 120 && r.height >= 160);
      if(ok) return resolve(true);
      if(Date.now() - start > ms) return resolve(false);
      requestAnimationFrame(tick);
    }
    tick();
  });
}

export async function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // keep for rebuild
  cfg.__mount = mount;

  // cfg
  const runMode = (cfg.runMode || 'play').toLowerCase();
  const diff = (cfg.diff || 'normal').toLowerCase();
  const view = (cfg.view || 'mobile').toLowerCase();

  STATE.cfg = Object.assign({}, cfg, { runMode, diff, view });

  // rng
  if(runMode === 'research' || runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    // play: still allow seed if passed, but not required
    STATE.rng = (cfg.seed != null) ? seededRng(cfg.seed) : Math.random;
  }

  // AI hooks: default OFF (especially in research)
  STATE.ai = makeAIHooks({ aiEnabled: false });

  // reset state
  STATE.running = true;
  STATE.ended = false;

  STATE.score = 0;
  STATE.combo = 0;
  STATE.comboMax = 0;
  STATE.miss = 0;

  STATE.hitGood = 0;
  STATE.hitJunk = 0;
  STATE.hitShield = 0;
  STATE.expireGood = 0;

  STATE.g = [0,0,0,0,0];

  STATE.goal.cur = 0;
  STATE.goal.done = false;

  STATE.mini.cur = 0;
  STATE.mini.done = false;

  STATE.shieldUntil = 0;

  // time
  const t = clamp(cfg.durationPlannedSec ?? 90, 10, 999);
  STATE.timeLeft = t;

  // base difficulty knobs
  // research: fixed config (deterministic)
  const baseSpawn =
    (diff === 'easy') ? 980 :
    (diff === 'hard') ? 760 : 880;

  const baseTtl =
    (diff === 'easy') ? 2100 :
    (diff === 'hard') ? 1500 : 1750;

  STATE.spawnRateMs = baseSpawn;
  STATE.ttlMs = baseTtl;
  STATE.junkWeight = (diff === 'easy') ? 0.26 : (diff === 'hard') ? 0.36 : 0.30;
  STATE.shieldWeight = (diff === 'easy') ? 0.06 : (diff === 'hard') ? 0.03 : 0.04;

  // if play => adaptive on top
  if(runMode === 'play'){
    applyAdaptive();
  }

  // ensure mount ready
  const ok = await waitMountReady(mount, 2200);
  if(!ok){
    // still boot, but warn
    console.warn('[PlateVR] mount rect still small; continue anyway');
  }

  // emit start
  emit('hha:start', {
    game:'plate',
    projectTag:'HeroHealth',
    runMode,
    diff,
    seed: cfg.seed,
    durationPlannedSec: t,
    device: view
  });

  emitQuest();
  emitScore();
  startTimer();

  // spawner
  try{
    STATE.spawner?.stop?.();
  }catch(_){}
  STATE.__lastSpawnerKey = '';
  STATE.spawner = buildSpawner(mount);
  STATE.__lastSpawnerKey = `${STATE.spawnRateMs}|${STATE.ttlMs}|${STATE.junkWeight.toFixed(3)}|${STATE.shieldWeight.toFixed(3)}`;

  // coach intro
  if(runMode === 'research' || runMode === 'study'){
    coach('โหมดวิจัย: Seeded + ปรับยากอัตโนมัติปิด (ยุติธรรม/เทียบกันได้) 📊', 'System');
  }else{
    coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️ (ระบบจะปรับความยากให้พอดี)', 'Coach');
  }

  // Optional: end early when both quests done (คุณจะเลือกเปิด/ปิดก็ได้)
  // ตอนนี้ "ผ่าน" คือเล่นจนครบเวลา แล้วโชว์ผล (เหมาะกับงานวิจัย)
}