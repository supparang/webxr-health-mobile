// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION / STANDALONE)
// HHA Standard
// ------------------------------------------------
// ✅ No dependency on mode-factory.js (fix export/ref errors)
// ✅ Play / Research modes:
//    - play: adaptive-ish ON (faster spawn, longer TTL help)
//    - research/study: deterministic seed + consistent spawn timings
// ✅ Emits:
//    hha:start, hha:score, hha:time, quest:update,
//    hha:coach, hha:judge, hha:end
// ✅ Supports: Boss/Storm hooks placeholders (CSS layers can react later)
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

const pct = (n) => Math.round((Number(n) || 0) * 100) / 100;

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

/* ------------------------------------------------
 * Emoji sets (ทำให้ไม่น่าเบื่อ)
 * ------------------------------------------------ */
// 5 หมู่ (ตัวอย่างแบบเด็ก ป.5 เข้าใจง่าย)
const GOOD_EMOJI_BY_GROUP = [
  ['🍚','🍞','🥖','🥔','🍜','🥣'],          // 1) ข้าว-แป้ง
  ['🥦','🥬','🥕','🍅','🥒','🌽'],          // 2) ผัก
  ['🍎','🍌','🍉','🍇','🍍','🍊'],          // 3) ผลไม้
  ['🐟','🍗','🥚','🫘','🥩','🧀'],          // 4) โปรตีน/นม (ปรับได้)
  ['🥛','🧃','🫗','🍶','🥜','🫛'],          // 5) นม/ถั่ว/เครื่องดื่มสุขภาพ (ปรับได้)
];

// ของหวาน/ทอด/น้ำอัดลม ฯลฯ
const JUNK_EMOJI = ['🍟','🍔','🍕','🍩','🍪','🍫','🧋','🥤','🍰','🍿','🌭','🧇'];

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

  // counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // mode / cfg
  cfg:null,
  rng:Math.random,

  // spawn
  mount:null,
  spawnTo:null,
  targets:new Map(), // id -> {el,x,y,r,kind,groupIndex,ttlMs,bornMs}
  idSeq:1,

  // tuning
  spawnRateMs: 900,
  ttlGoodMs: 1800,
  ttlJunkMs: 1600,
  sizeMin: 54,
  sizeMax: 82,

  // shoot
  onShootBound:null
};

/* ------------------------------------------------
 * Coach helper
 * ------------------------------------------------ */
function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
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
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  clearTimeout(STATE.spawnTo);

  // remove shoot listener
  if(STATE.onShootBound){
    WIN.removeEventListener('hha:shoot', STATE.onShootBound);
    STATE.onShootBound = null;
  }

  // cleanup targets
  for (const [id, t] of STATE.targets.entries()){
    try{ t.el?.remove(); }catch{}
    STATE.targets.delete(id);
  }

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
    g5: STATE.g[4],

    hitGood: STATE.hitGood,
    hitJunk: STATE.hitJunk,
    expireGood: STATE.expireGood
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
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 6);

  // goal progress: นับ “หมู่ที่มีอย่างน้อย 1”
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
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-55);
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
 * Spawn geometry (กัน HUD บัง)
 * ------------------------------------------------ */
function getInnerRect(){
  const m = STATE.mount;
  const r = m.getBoundingClientRect();

  // ใช้ padding ของ #plate-layer เป็น safe spawn
  const cs = WIN.getComputedStyle(m);
  const pt = parseFloat(cs.paddingTop) || 0;
  const pr = parseFloat(cs.paddingRight) || 0;
  const pb = parseFloat(cs.paddingBottom) || 0;
  const pl = parseFloat(cs.paddingLeft) || 0;

  const x0 = r.left + pl;
  const y0 = r.top  + pt;
  const x1 = r.right - pr;
  const y1 = r.bottom - pb;

  return { x0, y0, x1, y1, w: Math.max(0, x1-x0), h: Math.max(0, y1-y0) };
}

/* ------------------------------------------------
 * Target creation & lifecycle
 * ------------------------------------------------ */
function pick(arr){
  return arr[Math.floor(STATE.rng() * arr.length)];
}

function createTarget(){
  if(!STATE.running || STATE.ended) return;

  const rect = getInnerRect();
  if(rect.w < 80 || rect.h < 120) return;

  const id = String(STATE.idSeq++);
  const el = DOC.createElement('div');
  el.className = 'plateTarget';
  el.setAttribute('data-id', id);

  // kind
  const kind = (STATE.rng() < 0.70) ? 'good' : 'junk';
  el.setAttribute('data-kind', kind);

  let groupIndex = null;
  let emoji = '🍽️';

  if(kind === 'good'){
    groupIndex = Math.floor(STATE.rng()*5);
    emoji = pick(GOOD_EMOJI_BY_GROUP[groupIndex]);
    el.setAttribute('data-group', String(groupIndex));
  }else{
    emoji = pick(JUNK_EMOJI);
  }

  el.textContent = emoji;

  // size
  const size = Math.round(STATE.sizeMin + (STATE.sizeMax - STATE.sizeMin) * STATE.rng());
  const r0 = size/2;

  // position (inside safe rect)
  const x = rect.x0 + r0 + (rect.w - size) * STATE.rng();
  const y = rect.y0 + r0 + (rect.h - size) * STATE.rng();

  // apply style (absolute inside #plate-layer)
  const parentRect = STATE.mount.getBoundingClientRect();
  const left = Math.round(x - parentRect.left - r0);
  const top  = Math.round(y - parentRect.top  - r0);

  el.style.width  = `${size}px`;
  el.style.height = `${size}px`;
  el.style.left   = `${left}px`;
  el.style.top    = `${top}px`;

  // ttl
  const ttlMs = (kind === 'good') ? STATE.ttlGoodMs : STATE.ttlJunkMs;
  const bornMs = performance.now();

  // click/tap
  el.addEventListener('pointerdown', (ev)=>{
    ev.preventDefault();
    if(!STATE.running || STATE.ended) return;
    hitTargetById(id);
  }, { passive:false });

  STATE.mount.appendChild(el);

  STATE.targets.set(id, {
    el,
    kind,
    groupIndex,
    ttlMs,
    bornMs,
    // center for crosshair hit testing
    cx: x,
    cy: y,
    r: r0
  });

  // expire
  setTimeout(()=>{
    const t = STATE.targets.get(id);
    if(!t) return;
    // already hit?
    if(!STATE.running || STATE.ended){
      try{ t.el?.remove(); }catch{}
      STATE.targets.delete(id);
      return;
    }
    // expire
    if(t.kind === 'good') onExpireGood();
    // remove
    try{ t.el?.style.filter = 'brightness(.9)'; t.el?.style.opacity = '0'; }catch{}
    setTimeout(()=>{
      try{ t.el?.remove(); }catch{}
    }, 120);
    STATE.targets.delete(id);
  }, ttlMs);
}

function hitTargetById(id){
  const t = STATE.targets.get(String(id));
  if(!t) return;

  // remove quickly
  try{
    t.el.style.opacity = '0';
    t.el.style.transform = 'scale(.92)';
  }catch{}
  setTimeout(()=>{ try{ t.el.remove(); }catch{} }, 80);
  STATE.targets.delete(String(id));

  if(t.kind === 'good'){
    onHitGood(t.groupIndex ?? 0);
  }else{
    onHitJunk();
  }
}

/* ------------------------------------------------
 * Crosshair shoot support (hha:shoot from vr-ui.js)
 * ------------------------------------------------ */
function bindShoot(){
  // ยิงที่ตำแหน่งหน้าจอ (clientX/clientY) แล้วเลือก target ที่ “ใกล้ที่สุดภายในรัศมี”
  STATE.onShootBound = (e)=>{
    if(!STATE.running || STATE.ended) return;
    const d = e.detail || {};
    const x = Number(d.x);
    const y = Number(d.y);
    if(!isFinite(x) || !isFinite(y)) return;

    // หาเป้าที่โดนจาก geometry (ไม่พึ่ง pointer-events)
    let bestId = null;
    let bestDist = Infinity;

    for(const [id, t] of STATE.targets.entries()){
      const dx = (x - t.cx);
      const dy = (y - t.cy);
      const dist = Math.sqrt(dx*dx + dy*dy);
      if(dist <= t.r && dist < bestDist){
        bestDist = dist;
        bestId = id;
      }
    }

    if(bestId) hitTargetById(bestId);
  };

  WIN.addEventListener('hha:shoot', STATE.onShootBound);
}

/* ------------------------------------------------
 * Spawner loop
 * ------------------------------------------------ */
function scheduleSpawn(){
  if(!STATE.running || STATE.ended) return;

  createTarget();

  // research: fixed interval; play: slight jitter (สนุกขึ้น)
  let next = STATE.spawnRateMs;
  if(!(STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study')){
    const jitter = (STATE.rng() - 0.5) * 180; // +/- 90ms
    next = Math.max(220, next + jitter);
  }

  STATE.spawnTo = setTimeout(scheduleSpawn, next);
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // reset
  STATE.mount = mount;
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

  // duration (ใช้จาก boot: durationPlannedSec)
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // tuning by diff
  const diff = (cfg.diff || 'normal').toLowerCase();
  if(diff === 'easy'){
    STATE.spawnRateMs = 980;
    STATE.ttlGoodMs   = 2050;
    STATE.ttlJunkMs   = 1800;
    STATE.sizeMin = 58;
    STATE.sizeMax = 88;
  }else if(diff === 'hard'){
    STATE.spawnRateMs = 720;
    STATE.ttlGoodMs   = 1600;
    STATE.ttlJunkMs   = 1450;
    STATE.sizeMin = 50;
    STATE.sizeMax = 78;
  }else{
    STATE.spawnRateMs = 860;
    STATE.ttlGoodMs   = 1850;
    STATE.ttlJunkMs   = 1650;
    STATE.sizeMin = 54;
    STATE.sizeMax = 82;
  }

  // emit start
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

  // crosshair shooting
  bindShoot();

  // spawn loop
  clearTimeout(STATE.spawnTo);
  scheduleSpawn();

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}