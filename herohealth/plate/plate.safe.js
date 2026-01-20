// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION FIXED)
// HHA Standard (standalone spawner; NO mode-factory dependency)
// ------------------------------------------------
// ✅ Play / Study/Research modes
//   - play: adaptive-ish spawn speed ON (soft)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Spawns targets into #plate-layer
// ✅ Supports:
//   - Direct hit: tap/click on target
//   - Crosshair/tap-to-shoot: listens 'hha:shoot' from vr-ui.js
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ------------------------------------------------

'use strict';

const WIN = window;
const DOC = document;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

function pct(n){
  // keep as number percent (0..100) for UI + logger
  n = Number(n) || 0;
  return Math.round(n * 10) / 10;
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
  try { WIN.dispatchEvent(new CustomEvent(name, { detail })); } catch(_){}
}

function nowMs(){ return Date.now(); }

/* ------------------------------------------------
 * Emoji sets
 * ------------------------------------------------ */
const GROUP_EMOJI = [
  ['🥦','🥕','🥬','🥒'],     // G1 veg
  ['🍎','🍊','🍇','🍌'],     // G2 fruit
  ['🐟','🍗','🥚','🫘'],     // G3 protein
  ['🍚','🍞','🥔','🍜'],     // G4 carbs
  ['🥑','🥜','🧀','🫒'],     // G5 fat/dairy-ish
];

const JUNK_EMOJI = ['🍟','🍩','🍔','🍕','🧁','🍫','🥤'];

/* ------------------------------------------------
 * Engine state
 * ------------------------------------------------ */
const STATE = {
  cfg:null,
  rng:Math.random,

  mount:null,
  running:false,
  ended:false,

  // time
  timeLeft:0,
  timerId:0,

  // spawn
  spawnId:0,
  tickId:0,
  active:[], // {id, el, kind, groupIndex, spawnedAt, ttlMs, hit}

  // score
  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  // counters for accuracy
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // groups collected
  g:[0,0,0,0,0],

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
};

function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

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
    allDone: !!(STATE.goal.done && STATE.mini.done)
  });
}

function resetRun(){
  STATE.running = false;
  STATE.ended = false;

  STATE.active.forEach(t=>{
    try{ t.el?.remove(); }catch(_){}
  });
  STATE.active = [];

  clearInterval(STATE.timerId);
  clearTimeout(STATE.spawnId);
  clearInterval(STATE.tickId);
  STATE.timerId = 0;
  STATE.spawnId = 0;
  STATE.tickId = 0;

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
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timerId);
  clearTimeout(STATE.spawnId);
  clearInterval(STATE.tickId);

  // optional: clear remaining targets (or keep on screen)
  STATE.active.forEach(t=>{
    try{ t.el?.classList.add('fade'); }catch(_){}
  });

  const accPct = accuracy() * 100;

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: pct(accPct),

    // group counts
    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4]
  });
}

/* ------------------------------------------------
 * Spawn helpers
 * ------------------------------------------------ */
function mountRect(){
  const el = STATE.mount;
  const r = el.getBoundingClientRect();

  // internal padding for safe spawn
  const pad = 12;
  return {
    left: r.left + pad,
    top: r.top + pad,
    right: r.right - pad,
    bottom: r.bottom - pad,
    w: Math.max(10, r.width - pad*2),
    h: Math.max(10, r.height - pad*2),
  };
}

function pick(arr){
  return arr[Math.floor(STATE.rng() * arr.length)];
}

function makeEl(kind, sizePx, emoji){
  const el = DOC.createElement('div');
  el.className = 'plateTarget';
  el.setAttribute('data-kind', kind);
  el.textContent = emoji;

  el.style.width = `${sizePx}px`;
  el.style.height = `${sizePx}px`;

  // position absolute using CSS transforms
  el.style.position = 'absolute';
  el.style.left = '0px';
  el.style.top = '0px';
  el.style.transform = 'translate3d(-9999px,-9999px,0)';

  return el;
}

function placeEl(el, x, y){
  // x,y are viewport coords
  const m = mountRect();
  const localX = clamp(x - m.left, 0, m.w);
  const localY = clamp(y - m.top, 0, m.h);
  el.style.transform = `translate3d(${Math.round(localX)}px, ${Math.round(localY)}px, 0) translate(-50%, -50%)`;
}

function spawnOne(){
  if(!STATE.running || STATE.ended) return;
  if(!STATE.mount) return;

  const cfg = STATE.cfg || {};
  const diff = (cfg.diff || 'normal').toLowerCase();

  // sizes: tuned for kids + mobile
  let minS = 52, maxS = 76;
  if(diff === 'easy'){ minS = 58; maxS = 86; }
  if(diff === 'hard'){ minS = 48; maxS = 70; }

  const size = Math.round(minS + (maxS - minS) * STATE.rng());

  // weights
  let pGood = 0.72;
  if(diff === 'easy') pGood = 0.78;
  if(diff === 'hard') pGood = 0.68;

  const isGood = STATE.rng() < pGood;

  let kind = isGood ? 'good' : 'junk';
  let groupIndex = -1;
  let emoji;

  if(kind === 'good'){
    groupIndex = Math.floor(STATE.rng() * 5);
    emoji = pick(GROUP_EMOJI[groupIndex]);
  }else{
    emoji = pick(JUNK_EMOJI);
  }

  const el = makeEl(kind, size, emoji);

  // random position inside mount rect
  const r = mountRect();
  const x = r.left + (STATE.rng() * r.w);
  const y = r.top + (STATE.rng() * r.h);

  // attach
  STATE.mount.appendChild(el);
  placeEl(el, x, y);

  const id = `${nowMs()}_${Math.floor(STATE.rng()*1e9)}`;

  // ttl by diff + mode
  let ttl = 1400;
  if(diff === 'easy') ttl = 1650;
  if(diff === 'hard') ttl = 1200;

  // play mode: slightly faster as time goes down (soft adaptive)
  if((cfg.runMode || 'play') === 'play'){
    const t = clamp(STATE.timeLeft, 0, cfg.durationPlannedSec || 90);
    const k = 1 - (t / (cfg.durationPlannedSec || 90)); // 0..1
    ttl = Math.max(900, ttl - Math.round(k * 220));
  }

  const target = {
    id,
    el,
    kind,
    groupIndex,
    spawnedAt: nowMs(),
    ttlMs: ttl,
    hit:false
  };

  // direct click/tap hit
  el.addEventListener('pointerdown', (e)=>{
    e.preventDefault();
    e.stopPropagation();
    hitTarget(target, 'direct');
  }, { passive:false });

  STATE.active.push(target);
}

function scheduleSpawn(){
  if(!STATE.running || STATE.ended) return;

  const cfg = STATE.cfg || {};
  const diff = (cfg.diff || 'normal').toLowerCase();

  let base = 850;
  if(diff === 'easy') base = 920;
  if(diff === 'hard') base = 720;

  // play mode soft adaptive: spawn a bit faster near end
  if((cfg.runMode || 'play') === 'play'){
    const total = (cfg.durationPlannedSec || 90);
    const k = 1 - clamp(STATE.timeLeft / total, 0, 1); // 0..1
    base = Math.max(520, base - Math.round(k * 180));
  }

  const jitter = Math.round((STATE.rng() - 0.5) * 140);
  const delay = Math.max(260, base + jitter);

  STATE.spawnId = setTimeout(()=>{
    // cap density
    const cap = (diff === 'easy') ? 8 : (diff === 'hard' ? 11 : 9);
    if(STATE.active.length < cap) spawnOne();
    scheduleSpawn();
  }, delay);
}

function tickExpire(){
  if(!STATE.running || STATE.ended) return;
  const t = nowMs();

  for(let i = STATE.active.length - 1; i >= 0; i--){
    const a = STATE.active[i];
    if(a.hit) continue;
    if(t - a.spawnedAt >= a.ttlMs){
      // expire
      a.hit = true;
      try{ a.el?.remove(); }catch(_){}
      STATE.active.splice(i,1);

      if(a.kind === 'good'){
        STATE.expireGood++;
        STATE.miss++;
        STATE.combo = 0;
        // no score bonus
      }

      updateMiniByAccuracy();
      emitScore();
      emitQuest();
    }
  }
}

function updateGoalByGroups(){
  if(STATE.goal.done) return;
  const have = STATE.g.filter(v=>v>0).length;
  STATE.goal.cur = have;

  if(have >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบ 5 หมู่แล้ว 🎉');
  }
}

function updateMiniByAccuracy(){
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);

  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }
}

function addScore(v){
  STATE.score += Number(v) || 0;
}

function addCombo(){
  STATE.combo++;
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
}

function resetCombo(){
  STATE.combo = 0;
}

function hitTarget(target, source='direct'){
  if(!STATE.running || STATE.ended) return;
  if(!target || target.hit) return;

  target.hit = true;
  try{ target.el?.remove(); }catch(_){}

  // remove from list
  const idx = STATE.active.findIndex(x=>x.id === target.id);
  if(idx >= 0) STATE.active.splice(idx,1);

  if(target.kind === 'good'){
    STATE.hitGood++;
    if(target.groupIndex >= 0 && target.groupIndex < 5){
      STATE.g[target.groupIndex]++;
    }else{
      // fallback safe
      const gi = Math.floor(STATE.rng()*5);
      STATE.g[gi]++;
    }

    addCombo();
    addScore(100 + STATE.combo * 6);

    updateGoalByGroups();
    updateMiniByAccuracy();

    emitScore();
    emitQuest();

  }else{
    STATE.hitJunk++;
    STATE.miss++;
    resetCombo();
    addScore(-60);

    updateMiniByAccuracy();

    emitScore();
    emitQuest();

    coach('ระวัง! ของหวาน/ทอด ⚠️');
  }
}

/* ------------------------------------------------
 * Crosshair shooting: hha:shoot
 * ------------------------------------------------ */
function dist2(ax, ay, bx, by){
  const dx = ax - bx, dy = ay - by;
  return dx*dx + dy*dy;
}

function findNearestTarget(px, py, lockPx){
  const lock2 = lockPx * lockPx;
  let best = null;
  let bestD = Infinity;

  for(const t of STATE.active){
    if(!t || t.hit || !t.el) continue;
    const r = t.el.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top + r.height/2;
    const d = dist2(px, py, cx, cy);

    if(d <= lock2 && d < bestD){
      best = t;
      bestD = d;
    }
  }
  return best;
}

function bindShoot(){
  WIN.addEventListener('hha:shoot', (e)=>{
    if(!STATE.running || STATE.ended) return;

    const d = e.detail || {};
    const px = Number(d.x) || (WIN.innerWidth/2);
    const py = Number(d.y) || (WIN.innerHeight/2);
    const lockPx = Math.max(8, Number(d.lockPx || 28) || 28);

    const t = findNearestTarget(px, py, lockPx);
    if(t) hitTarget(t, d.source || 'shoot');
  }, { passive:true });
}

/* ------------------------------------------------
 * Timer
 * ------------------------------------------------ */
function startTimer(){
  emitTime();

  STATE.timerId = setInterval(()=>{
    if(!STATE.running || STATE.ended) return;
    STATE.timeLeft--;
    emitTime();
    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  STATE.mount = mount;
  STATE.cfg = cfg || {};

  resetRun();

  // RNG
  const rm = (STATE.cfg.runMode || 'play').toLowerCase();
  const seed = Number(STATE.cfg.seed || Date.now()) || Date.now();
  if(rm === 'research' || rm === 'study'){
    STATE.rng = seededRng(seed);
  }else{
    STATE.rng = Math.random;
  }

  STATE.timeLeft = Number(STATE.cfg.durationPlannedSec) || 90;

  STATE.running = true;
  STATE.ended = false;

  // fire start
  emit('hha:start', {
    game:'plate',
    projectTag:'herohealth',
    runMode: rm,
    diff: (STATE.cfg.diff || 'normal'),
    seed: seed,
    durationPlannedSec: STATE.timeLeft,

    // passthrough for logger
    studyId: STATE.cfg.studyId || '',
    phase: STATE.cfg.phase || '',
    conditionGroup: STATE.cfg.conditionGroup || '',
    sessionOrder: STATE.cfg.sessionOrder || '',
    blockLabel: STATE.cfg.blockLabel || '',
    siteCode: STATE.cfg.siteCode || '',
    device: STATE.cfg.view || '',
  });

  // init quest + score
  emitScore();
  emitQuest();
  startTimer();

  // expire tick
  STATE.tickId = setInterval(tickExpire, 120);

  // spawn loop
  scheduleSpawn();

  // bind shooting (safe: only once)
  if(!WIN.__HHA_PLATE_SHOOT_BOUND__){
    WIN.__HHA_PLATE_SHOOT_BOUND__ = true;
    bindShoot();
  }

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}