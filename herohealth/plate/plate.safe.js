// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION+)
// HHA Standard (Standalone spawner; no mode-factory dependency)
// ------------------------------------------------------------
// ✅ Fix: removed import from ../vr/mode-factory.js (export mismatch / controller bug)
// ✅ Play / Research modes
//   - play: adaptive ON (mild scaling)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ More variety: multiple emoji per group + rotating mini quests
// ------------------------------------------------------------

'use strict';

const WIN = window;
const DOC = document;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};
const now = () => Date.now();

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
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

// ------------------------------------------------------------
// Content pools (5 food groups) — make it NOT boring
// g0..g4 map: 1) Veg 2) Fruit 3) Protein 4) Grains 5) Dairy/Fat (as your prior UI shows 🥑)
// ------------------------------------------------------------
const FOOD = [
  { key:'g1', label:'ผัก',     icon:'🥦', items:['🥦','🥬','🥕','🥒','🌽','🍆'] },       // Veg
  { key:'g2', label:'ผลไม้',   icon:'🍎', items:['🍎','🍌','🍊','🍇','🍉','🍍'] },       // Fruit
  { key:'g3', label:'โปรตีน',  icon:'🐟', items:['🐟','🍗','🥚','🍤','🫘','🥜'] },       // Protein
  { key:'g4', label:'แป้ง',    icon:'🍚', items:['🍚','🍞','🥖','🍜','🥔','🌾'] },       // Grains/Starch
  { key:'g5', label:'ไขมันดี', icon:'🥑', items:['🥑','🫒','🥥','🧀','🥛'] }            // Healthy fat / dairy-ish mix
];

const JUNK = ['🍟','🍔','🍕','🍩','🍪','🍫','🥤','🧋','🍭','🌭'];

// ------------------------------------------------------------
// State
// ------------------------------------------------------------
const STATE = {
  cfg:null,
  rng:Math.random,

  running:false,
  ended:false,

  tStart:0,
  timeLeft:0,
  timerId:null,

  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  // counts
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // groups collected (count per group)
  g:[0,0,0,0,0],

  // targets in play
  targets:new Map(), // id -> {el, kind, gi, bornAt, ttlMs, x,y, s}
  nextId:1,
  spawnId:null,

  // difficulty knobs (can adapt in play)
  spawnEveryMs:900,
  ttlGoodMs:2600,
  ttlJunkMs:2400,
  sizeMin:48,
  sizeMax:72,

  // quest
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่ (อย่างน้อยหมู่ละ 1)',
    cur:0, target:5, done:false
  },

  mini:{
    type:'acc80',
    name:'ความแม่นยำ',
    sub:'คุมความแม่น ≥ 80%',
    cur:0, target:80, done:false,
    tStart:0,
    durationMs: 18000
  },

  // rolling window for mini-accuracy
  recent:[], // {good:boolean, junk:boolean, expire:boolean, t}
};

// ------------------------------------------------------------
// UI helpers
// ------------------------------------------------------------
function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

function emitScore(){
  emit('hha:score', { score: STATE.score, combo: STATE.combo, comboMax: STATE.comboMax, miss: STATE.miss });
}

function emitTime(){
  emit('hha:time', { leftSec: STATE.timeLeft });
}

function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}
function accPct(){
  return Math.round(accuracy()*100);
}

function computeGoalCur(){
  // number of groups with at least 1 collected
  return STATE.g.reduce((n,v)=> n + (v>0 ? 1 : 0), 0);
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
    allDone: !!(STATE.goal.done && STATE.mini.done)
  });
}

// ------------------------------------------------------------
// Difficulty (mild adaptive for play)
// ------------------------------------------------------------
function applyAdaptive(){
  if(!STATE.cfg) return;
  const run = (STATE.cfg.runMode||'play').toLowerCase();
  const isAdaptive = (run === 'play');

  // Base by diff
  const diff = (STATE.cfg.diff||'normal').toLowerCase();
  let baseSpawn = 900, baseTtlG = 2600, baseTtlJ = 2400, sMin=48, sMax=72;

  if(diff === 'easy'){
    baseSpawn = 980; baseTtlG = 2900; baseTtlJ = 2600; sMin=52; sMax=78;
  }else if(diff === 'hard'){
    baseSpawn = 780; baseTtlG = 2300; baseTtlJ = 2100; sMin=44; sMax=66;
  }

  if(!isAdaptive){
    STATE.spawnEveryMs = baseSpawn;
    STATE.ttlGoodMs = baseTtlG;
    STATE.ttlJunkMs = baseTtlJ;
    STATE.sizeMin = sMin;
    STATE.sizeMax = sMax;
    return;
  }

  // Adaptive: if accuracy high, speed up a bit; if low, ease up
  const a = accPct();
  const m = STATE.miss;

  let k = 1;
  if(a >= 88 && m <= 3) k = 0.86;
  else if(a >= 80) k = 0.92;
  else if(a <= 60) k = 1.12;
  else if(a <= 70) k = 1.05;

  STATE.spawnEveryMs = Math.round(baseSpawn * k);
  STATE.ttlGoodMs = Math.round(baseTtlG * (k < 1 ? 0.92 : 1.05));
  STATE.ttlJunkMs = Math.round(baseTtlJ * (k < 1 ? 0.92 : 1.05));
  STATE.sizeMin = sMin;
  STATE.sizeMax = sMax;
}

// ------------------------------------------------------------
// Mini quest rotation (keeps it exciting)
// ------------------------------------------------------------
const MINI_TYPES = [
  { type:'acc80', name:'ความแม่นยำ', sub:'คุมความแม่น ≥ 80% (ช่วงนี้)' , target:80 },
  { type:'noJunk', name:'ห้ามโดน Junk', sub:'10 วินาทีนี้ห้ามโดนของหวาน/ทอด', target:10 },
  { type:'collect2', name:'เก็บหมู่ที่กำหนด', sub:'เก็บ “หมู่ที่สุ่ม” ให้ได้ 2 ครั้ง', target:2 },
];

function pickMini(){
  const r = STATE.rng();
  const ix = Math.floor(r * MINI_TYPES.length);
  const base = MINI_TYPES[ix];

  const mini = {
    type: base.type,
    name: base.name,
    sub: base.sub,
    cur: 0,
    target: base.target,
    done:false,
    tStart: now(),
    durationMs: 18000,
    extra: {}
  };

  if(mini.type === 'collect2'){
    const gi = Math.floor(STATE.rng()*5);
    mini.extra.gi = gi;
    mini.sub = `เก็บหมู่ “${FOOD[gi].icon} ${FOOD[gi].label}” ให้ได้ 2 ครั้ง`;
  }

  if(mini.type === 'noJunk'){
    mini.durationMs = 12000;
    mini.target = 10; // seconds survive
    mini.cur = 0;
  }

  if(mini.type === 'acc80'){
    mini.durationMs = 18000;
    mini.target = 80;
  }

  STATE.mini = mini;
  emitQuest();
}

function tickMini(){
  if(STATE.mini.done) return;

  const t = now();
  const elapsed = t - STATE.mini.tStart;

  if(STATE.mini.type === 'noJunk'){
    const sec = clamp(Math.floor(elapsed/1000), 0, STATE.mini.target);
    STATE.mini.cur = sec;
    if(sec >= STATE.mini.target){
      STATE.mini.done = true;
      coach('สุดยอด! ช่วงนี้ไม่พลาด Junk เลย 🛡️');
      emitQuest();
    }
    return;
  }

  if(STATE.mini.type === 'acc80'){
    const a = accPct();
    STATE.mini.cur = a;
    if(a >= STATE.mini.target){
      STATE.mini.done = true;
      coach('ความแม่นยำผ่าน! 🎯');
      emitQuest();
    }
    return;
  }

  if(STATE.mini.type === 'collect2'){
    // cur increments on hitGood for chosen group
    // no tick needed
    return;
  }

  // expire mini if too long -> rotate
  if(elapsed > STATE.mini.durationMs){
    pickMini();
  }
}

// ------------------------------------------------------------
// Target spawning
// ------------------------------------------------------------
function mountEnsureRelative(mount){
  try{
    const cs = getComputedStyle(mount);
    if(cs.position === 'static') mount.style.position = 'relative';
  }catch(_){}
}

function rectOf(el){
  const r = el.getBoundingClientRect();
  return { left:r.left, top:r.top, width:r.width, height:r.height, right:r.right, bottom:r.bottom };
}

function randBetween(a,b){ return a + (b-a)*STATE.rng(); }

function createTarget(mount){
  const id = STATE.nextId++;
  const kind = (STATE.rng() < 0.72) ? 'good' : 'junk';

  const gi = (kind === 'good') ? Math.floor(STATE.rng()*5) : -1;

  const size = Math.round(randBetween(STATE.sizeMin, STATE.sizeMax));
  const ttlMs = (kind === 'good') ? STATE.ttlGoodMs : STATE.ttlJunkMs;

  const play = rectOf(mount);

  // spawn within mount client area (mount is full screen but with padding from CSS)
  // because mount has padding, placing absolute inside it will avoid HUD.
  const padL = 0;
  const padT = 0;
  const padR = 0;
  const padB = 0;

  const w = Math.max(40, play.width - padL - padR);
  const h = Math.max(40, play.height - padT - padB);

  // inside padded box -> we use mount's content box by absolute positioning
  const x = Math.round(randBetween(padL + size/2, padL + w - size/2));
  const y = Math.round(randBetween(padT + size/2, padT + h - size/2));

  const el = DOC.createElement('div');
  el.className = 'plateTarget';
  el.setAttribute('data-id', String(id));
  el.setAttribute('data-kind', kind);
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.transform = 'translate(-50%,-50%)';

  if(kind === 'good'){
    const pool = FOOD[gi].items;
    const emoji = pool[Math.floor(STATE.rng()*pool.length)];
    el.textContent = emoji;
    el.setAttribute('data-gi', String(gi));
  }else{
    const emoji = JUNK[Math.floor(STATE.rng()*JUNK.length)];
    el.textContent = emoji;
  }

  const bornAt = now();
  STATE.targets.set(id, { id, el, kind, gi, bornAt, ttlMs, x, y, s:size });

  // click/tap hit
  el.addEventListener('pointerdown', (ev)=>{
    ev.preventDefault();
    hitTarget(id, 'tap');
  }, { passive:false });

  mount.appendChild(el);

  // expire timer
  setTimeout(()=>{
    if(!STATE.running || STATE.ended) return;
    if(!STATE.targets.has(id)) return;
    expireTarget(id);
  }, ttlMs + Math.round(STATE.rng()*180));

  return id;
}

function spawnLoop(mount){
  clearInterval(STATE.spawnId);
  STATE.spawnId = setInterval(()=>{
    if(!STATE.running || STATE.ended) return;
    applyAdaptive();
    createTarget(mount);
    tickMini();
    // rotate mini sometimes
    if(now() - STATE.mini.tStart > STATE.mini.durationMs){
      pickMini();
    }
  }, clamp(STATE.spawnEveryMs, 420, 1400));
}

function removeTarget(id){
  const t = STATE.targets.get(id);
  if(!t) return;
  try{ t.el?.remove(); }catch(_){}
  STATE.targets.delete(id);
}

function expireTarget(id){
  const t = STATE.targets.get(id);
  if(!t) return;

  removeTarget(id);

  if(t.kind === 'good'){
    STATE.expireGood++;
    STATE.miss++;
    STATE.combo = 0;
    emitScore();
  }
}

// ------------------------------------------------------------
// Hit logic
// ------------------------------------------------------------
function addScore(delta){
  STATE.score = Math.max(0, STATE.score + delta);
  emitScore();
}

function hitGood(gi){
  STATE.hitGood++;
  STATE.g[gi]++;

  STATE.combo++;
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);

  addScore(100 + STATE.combo*6);

  // goal
  if(!STATE.goal.done){
    STATE.goal.cur = computeGoalCur();
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  // mini type: collect2
  if(!STATE.mini.done && STATE.mini.type === 'collect2'){
    const needGi = STATE.mini.extra?.gi;
    if(needGi === gi){
      STATE.mini.cur++;
      if(STATE.mini.cur >= STATE.mini.target){
        STATE.mini.done = true;
        coach('มินิเควสผ่าน! เก็บตามหมู่ที่กำหนดครบ ✅');
      }
    }
  }

  // mini type: acc80 updates in tickMini
  // mini type: noJunk handled in tickMini (survive timer)

  emitQuest();

  // judge (optional feedback hook)
  emit('hha:judge', { kind:'good', gi, combo:STATE.combo, score:STATE.score, accPct:accPct() });
}

function hitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  STATE.combo = 0;

  addScore(-60);

  // if mini is noJunk -> fail immediately and rotate
  if(!STATE.mini.done && STATE.mini.type === 'noJunk'){
    coach('พลาด! โดน Junk แล้ว 😵 เปลี่ยนมินิเควสใหม่');
    pickMini();
  }else{
    coach('ระวัง! ของหวาน/ทอด ⚠️');
  }

  emitQuest();
  emit('hha:judge', { kind:'junk', combo:STATE.combo, score:STATE.score, accPct:accPct() });
}

function hitTarget(id, source='tap'){
  if(STATE.ended || !STATE.running) return;
  const t = STATE.targets.get(id);
  if(!t) return;

  removeTarget(id);

  if(t.kind === 'good'){
    hitGood(clamp(t.gi, 0, 4));
  }else{
    hitJunk();
  }

  // micro: rotate mini if it has been running too long
  if(now() - STATE.mini.tStart > STATE.mini.durationMs){
    pickMini();
  }
}

// ------------------------------------------------------------
// Crosshair shooting support (vr-ui.js)
// ------------------------------------------------------------
function dist2(ax,ay,bx,by){
  const dx = ax-bx, dy = ay-by;
  return dx*dx + dy*dy;
}

function bindShoot(mount){
  WIN.addEventListener('hha:shoot', (ev)=>{
    if(STATE.ended || !STATE.running) return;
    const d = ev?.detail || {};
    const lockPx = clamp(d.lockPx ?? 28, 8, 80);

    // pointer in viewport -> convert to mount local
    const mx = Number(d.x ?? (innerWidth/2));
    const my = Number(d.y ?? (innerHeight/2));

    const r = mount.getBoundingClientRect();
    const lx = mx - r.left;
    const ly = my - r.top;

    // find nearest target center in lock radius
    let bestId = null;
    let bestD2 = (lockPx*lockPx);

    for(const [id, t] of STATE.targets.entries()){
      const dx = (t.x - lx);
      const dy = (t.y - ly);
      const d2 = dx*dx + dy*dy;
      // allow a little size-based assist
      const bonus = Math.max(0, (t.s * 0.22));
      const lim2 = (lockPx + bonus) * (lockPx + bonus);
      if(d2 <= lim2 && d2 < bestD2){
        bestD2 = d2;
        bestId = id;
      }
    }

    if(bestId != null){
      hitTarget(bestId, d.source || 'shoot');
    }
  }, { passive:true });
}

// ------------------------------------------------------------
// Timer / End
// ------------------------------------------------------------
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timerId);
  clearInterval(STATE.spawnId);

  // cleanup remaining targets
  for(const id of Array.from(STATE.targets.keys())){
    removeTarget(id);
  }

  emit('hha:end', {
    reason,
    game:'plate',
    runMode: STATE.cfg?.runMode || '',
    diff: STATE.cfg?.diff || '',

    durationPlannedSec: STATE.cfg?.durationPlannedSec ?? 0,
    durationPlayedSec: Math.max(0, Math.round((now()-STATE.tStart)/1000)),

    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: accPct(),

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],

    hitGood: STATE.hitGood,
    hitJunk: STATE.hitJunk,
    expireGood: STATE.expireGood,

    seed: STATE.cfg?.seed ?? ''
  });
}

function startTimer(){
  emitTime();
  STATE.timerId = setInterval(()=>{
    if(STATE.ended || !STATE.running) return;
    STATE.timeLeft--;
    emitTime();
    tickMini();

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

// ------------------------------------------------------------
// Public boot (called by plate.boot.js)
// ------------------------------------------------------------
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  STATE.cfg = cfg || {};
  const run = (STATE.cfg.runMode || 'play').toLowerCase();

  // RNG
  if(run === 'research' || run === 'study'){
    STATE.rng = seededRng(Number(STATE.cfg.seed || 1));
  }else{
    STATE.rng = Math.random;
  }

  // reset state
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
  STATE.targets.clear();
  STATE.nextId = 1;

  STATE.goal.cur = 0;
  STATE.goal.done = false;

  // time
  const planned = Number(STATE.cfg.durationPlannedSec ?? 90);
  STATE.timeLeft = clamp(planned || 90, 20, 999);
  STATE.tStart = now();

  // mini
  pickMini();
  STATE.mini.tStart = now();

  // mount prep
  mountEnsureRelative(mount);

  // announce start
  emit('hha:start', {
    game:'plate',
    projectTag: 'HeroHealth',
    runMode: STATE.cfg.runMode,
    diff: STATE.cfg.diff,
    seed: STATE.cfg.seed,
    durationPlannedSec: STATE.timeLeft,
    view: STATE.cfg.view || qs('view','')
  });

  emitScore();
  emitQuest();

  // bind shoot
  bindShoot(mount);

  // start loops
  applyAdaptive();
  startTimer();
  spawnLoop(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}