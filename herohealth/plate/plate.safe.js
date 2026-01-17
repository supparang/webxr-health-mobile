// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard (Plate)
// ------------------------------------------------------------
// ✅ No dependency on mode-factory (avoid controller init bug)
// ✅ Play / Research modes
//   - play: adaptive ON (soft)
//   - research/study: deterministic seed + adaptive OFF + AI OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ Fun: emoji pool per group, late-window accuracy mini (lock once passed)
// ------------------------------------------------------------

'use strict';

const WIN = window;
const DOC = document;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

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

function nowMs(){ return performance && performance.now ? performance.now() : Date.now(); }

/* ------------------------------------------------------------
 * Emoji pools (make it not boring)
 * Groups: 1-5 (Thai food groups / plate)
 * ------------------------------------------------------------ */
const EMOJI = {
  // 1) Veg
  g1: ['🥦','🥬','🥒','🥕','🍅','🫑','🌽'],
  // 2) Fruit
  g2: ['🍎','🍐','🍊','🍌','🍉','🍇','🍓','🥭'],
  // 3) Protein
  g3: ['🐟','🍗','🥚','🦐','🫘','🥜','🧀'],
  // 4) Carb
  g4: ['🍚','🍞','🥖','🍜','🍝','🥔','🥟'],
  // 5) Good fat / dairy / healthy add-ons (ปรับได้)
  g5: ['🥑','🫒','🥛','🍶','🧈','🌰'],
  // junk
  junk: ['🍟','🍔','🌭','🍕','🍩','🍫','🧁','🍭','🥤']
};

function pickFrom(arr, rng){
  if(!arr || !arr.length) return '❓';
  return arr[Math.floor(rng() * arr.length)];
}

/* ------------------------------------------------------------
 * State
 * ------------------------------------------------------------ */
const STATE = {
  running:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  timeLeft:0,
  timerId:null,
  tStartMs:0,

  // groups collected count
  g:[0,0,0,0,0],

  // counters for accuracy
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // fever/shield hooks (not fully used yet)
  fever:0,
  shield:0,

  // cfg / rng
  cfg:null,
  rng:Math.random,

  // mount / spawner
  mount:null,
  playRect:null,

  // quest
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่ (อย่างน้อยหมู่ละ 1)',
    cur:0,
    target:5,
    done:false
  },

  // mini: late-window accuracy (lock once passed)
  mini:{
    name:'ความแม่นช่วงท้าย',
    sub:'ช่วงท้าย 15s ความแม่น ≥ 80% (ผ่านแล้วล็อก)',
    cur:0,          // current late-window accuracy %
    target:80,
    done:false,
    windowSec:15,
    // window tracking
    w_total:0,
    w_good:0
  },

  // boss/storm placeholders
  bossActive:false,
  stormActive:false,

  // adaptive knobs (play mode only)
  spawnEveryMs:900,
  lifeMs:1500,
  sizeMin:44,
  sizeMax:64,
  pJunk:0.30,       // junk probability
};

/* ------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------ */
function accuracyOverall(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function accuracyWindow(){
  if(STATE.mini.w_total <= 0) return 1;
  return STATE.mini.w_good / STATE.mini.w_total;
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

function emitQuest(extraHint=''){
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
    hint: extraHint || '',
    allDone: (STATE.goal.done && STATE.mini.done)
  });
}

function addScore(v){
  STATE.score += (Number(v)||0);
  emitScore();
}

function addCombo(){
  STATE.combo++;
  if(STATE.combo > STATE.comboMax) STATE.comboMax = STATE.combo;
}

function resetCombo(){
  STATE.combo = 0;
}

/* ------------------------------------------------------------
 * Playfield rect
 * ------------------------------------------------------------ */
function computePlayRect(){
  // Use mount rect if available; otherwise viewport
  const r = STATE.mount?.getBoundingClientRect?.();
  if(r && r.width > 50 && r.height > 50){
    // keep a little safe margin so HUD not blocking targets
    const pad = 14;
    return {
      x: r.left + pad,
      y: r.top + pad,
      w: Math.max(40, r.width - pad*2),
      h: Math.max(40, r.height - pad*2)
    };
  }
  return { x: 10, y: 10, w: innerWidth-20, h: innerHeight-20 };
}

/* ------------------------------------------------------------
 * Target DOM builder
 * ------------------------------------------------------------ */
function makeTargetNode(t){
  const el = DOC.createElement('div');
  el.className = 'plateTarget';
  el.dataset.kind = t.kind;
  el.dataset.gi = String(t.gi ?? -1);

  el.style.width = `${t.size}px`;
  el.style.height = `${t.size}px`;
  el.style.left = `${t.x}px`;
  el.style.top = `${t.y}px`;
  el.style.position = 'absolute';

  el.textContent = t.emoji;

  return el;
}

/* ------------------------------------------------------------
 * Spawn / Life cycle
 * ------------------------------------------------------------ */
function spawnOne(){
  if(!STATE.running || STATE.ended) return;

  // refresh play rect sometimes (orientation/resizes)
  STATE.playRect = computePlayRect();
  const pr = STATE.playRect;

  const rng = STATE.rng;

  // decide kind
  const isJunk = rng() < STATE.pJunk;
  const kind = isJunk ? 'junk' : 'good';

  let gi = -1;
  let emoji = '❓';

  if(kind === 'good'){
    gi = Math.floor(rng()*5);
    emoji = pickFrom(EMOJI[`g${gi+1}`], rng);
  }else{
    emoji = pickFrom(EMOJI.junk, rng);
  }

  const size = Math.floor(STATE.sizeMin + rng()*(STATE.sizeMax-STATE.sizeMin));
  const x = Math.floor(pr.x + rng()*(pr.w - size));
  const y = Math.floor(pr.y + rng()*(pr.h - size));

  const born = nowMs();
  const life = STATE.lifeMs;

  const t = { kind, gi, emoji, size, x, y, born, life, dead:false, el:null, to:null };
  const el = makeTargetNode(t);
  t.el = el;

  // click/tap hit
  el.addEventListener('pointerdown', (ev)=>{
    ev.preventDefault();
    hitTarget(t, { source:'pointer', x: ev.clientX, y: ev.clientY });
  }, { passive:false });

  STATE.mount.appendChild(el);

  // expire
  t.to = setTimeout(()=>{
    if(t.dead) return;
    t.dead = true;
    try{ t.el?.remove(); }catch{}
    onExpire(t);
  }, life);
}

function hitTarget(t, meta){
  if(!STATE.running || STATE.ended) return;
  if(!t || t.dead) return;

  t.dead = true;
  clearTimeout(t.to);
  try{ t.el?.remove(); }catch{}

  if(t.kind === 'good'){
    onHitGood(t.gi, meta);
  }else{
    onHitJunk(meta);
  }
}

function onExpire(t){
  if(!t || t.kind !== 'good') return;

  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  // late-window counts as attempt
  if(STATE.timeLeft <= STATE.mini.windowSec){
    STATE.mini.w_total++;
    // not good
  }

  // small penalty
  addScore(-20);

  emitQuest('อย่าปล่อยหลุด! เก็บให้ครบ 5 หมู่');
}

/* ------------------------------------------------------------
 * Crosshair shoot support (vr-ui.js)
 * hha:shoot {x,y,lockPx,source}
 * We treat it as a "hit" if a target center is within lockPx.
 * ------------------------------------------------------------ */
function dist2(ax,ay,bx,by){
  const dx = ax-bx, dy=ay-by;
  return dx*dx + dy*dy;
}

function onShoot(e){
  if(!STATE.running || STATE.ended) return;

  const d = e.detail || {};
  const x = Number(d.x);
  const y = Number(d.y);
  const lockPx = clamp(d.lockPx ?? 28, 10, 80);
  if(!isFinite(x) || !isFinite(y)) return;

  // find nearest target within lockPx
  const lock2 = lockPx*lockPx;

  const nodes = Array.from(STATE.mount.querySelectorAll('.plateTarget'));
  let best = null;
  let bestD2 = Infinity;

  for(const el of nodes){
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top + r.height/2;
    const d2 = dist2(x,y,cx,cy);
    if(d2 <= lock2 && d2 < bestD2){
      bestD2 = d2;
      best = el;
    }
  }

  if(!best) return;

  // reconstruct minimal target info
  const kind = best.dataset.kind || 'good';
  const gi = Number(best.dataset.gi ?? -1);
  // make a fake target to route logic, then remove
  try{ best.remove(); }catch{}
  const t = { kind, gi, dead:false, to:null, el:null };
  if(kind === 'good') onHitGood(gi, { source:'shoot', x, y });
  else onHitJunk({ source:'shoot', x, y });
}

/* ------------------------------------------------------------
 * Hit rules
 * ------------------------------------------------------------ */
function updateGoalProgress(){
  // cur = how many groups have at least 1 collected
  STATE.goal.cur = STATE.g.filter(v=>v>0).length;

  if(!STATE.goal.done && STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('สุดยอด! ครบ 5 หมู่แล้ว 🎉');
  }
}

function updateMiniWindowAfterAttempt(isGood){
  if(STATE.timeLeft > STATE.mini.windowSec) return;

  STATE.mini.w_total++;
  if(isGood) STATE.mini.w_good++;

  const acc = accuracyWindow() * 100;
  STATE.mini.cur = Math.round(acc);

  if(!STATE.mini.done && acc >= STATE.mini.target){
    STATE.mini.done = true; // ✅ lock
    coach('ผ่าน Mini! ความแม่นช่วงท้ายดีมาก 👍');
  }
}

function onHitGood(gi, meta){
  STATE.hitGood++;
  if(gi < 0 || gi > 4) gi = Math.floor(STATE.rng()*5);
  STATE.g[gi]++;

  addCombo();
  addScore(100 + STATE.combo * 6);

  updateGoalProgress();
  updateMiniWindowAfterAttempt(true);

  emitQuest('เก็บให้ครบ 5 หมู่ แล้วรักษาความแม่นช่วงท้าย!');
}

function onHitJunk(meta){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();

  addScore(-60);

  updateMiniWindowAfterAttempt(false);

  coach('ระวัง! ของหวาน/ทอด ⚠️');
  emitQuest('เลี่ยง Junk จะช่วยให้ผ่านง่ายขึ้น');
}

/* ------------------------------------------------------------
 * Adaptive (play mode only, soft)
 * ------------------------------------------------------------ */
function applyAdaptive(){
  if(!STATE.cfg) return;
  if(STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study') return;

  // simple difficulty drift: as combo grows, spawn slightly faster
  const c = STATE.comboMax;
  const base = (STATE.cfg.diff === 'hard') ? 820 : (STATE.cfg.diff === 'easy' ? 980 : 900);

  // cap speed
  const speedUp = clamp(c * 8, 0, 180);
  STATE.spawnEveryMs = clamp(base - speedUp, 520, 1100);

  // life shorter at hard
  STATE.lifeMs = (STATE.cfg.diff === 'hard') ? 1300 : 1500;

  // junk rate (hard more junk)
  STATE.pJunk = (STATE.cfg.diff === 'hard') ? 0.34 : (STATE.cfg.diff === 'easy' ? 0.26 : 0.30);

  // size
  STATE.sizeMin = (STATE.cfg.diff === 'hard') ? 42 : 46;
  STATE.sizeMax = (STATE.cfg.diff === 'hard') ? 62 : 66;
}

/* ------------------------------------------------------------
 * Timer / Loop
 * ------------------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timerId);
  WIN.removeEventListener('hha:shoot', onShoot);

  // clean remaining targets
  try{
    STATE.mount?.querySelectorAll?.('.plateTarget')?.forEach(n=>n.remove());
  }catch{}

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,

    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: Math.round(accuracyOverall()*100),

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],

    // for research hooks
    seed: STATE.cfg?.seed,
    runMode: STATE.cfg?.runMode,
    diff: STATE.cfg?.diff,
    durationPlannedSec: STATE.cfg?.durationPlannedSec
  });
}

function startTimer(){
  emitTime();

  STATE.timerId = setInterval(()=>{
    if(!STATE.running || STATE.ended) return;

    STATE.timeLeft--;
    emitTime();

    // enter late-window (announce once)
    if(STATE.timeLeft === STATE.mini.windowSec){
      coach(`เข้าสู่ช่วงท้าย ${STATE.mini.windowSec}s! โฟกัสความแม่น ≥ ${STATE.mini.target}%`, 'Coach');
      emitQuest(`ช่วงท้าย ${STATE.mini.windowSec}s: ความแม่น ≥ ${STATE.mini.target}%`);
    }

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

function startSpawning(){
  let last = nowMs();

  function loop(){
    if(!STATE.running || STATE.ended) return;

    applyAdaptive();

    const t = nowMs();
    const every = STATE.spawnEveryMs;

    if(t - last >= every){
      last = t;
      spawnOne();

      // mild burst if easy and low targets (keep it lively)
      const count = STATE.mount.querySelectorAll('.plateTarget').length;
      if(STATE.cfg.diff === 'easy' && count < 2 && STATE.rng() < 0.35){
        spawnOne();
      }
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

/* ------------------------------------------------------------
 * Main boot (called from plate.boot.js)
 * ------------------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // set mount
  STATE.mount = mount;
  STATE.cfg = cfg || {};

  // RNG
  const seed = Number(cfg.seed || Date.now());
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(seed);
  }else{
    STATE.rng = Math.random;
  }

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

  STATE.g = [0,0,0,0,0];

  STATE.goal.cur = 0;
  STATE.goal.done = false;

  STATE.mini.cur = 0;
  STATE.mini.done = false;
  STATE.mini.w_total = 0;
  STATE.mini.w_good = 0;

  // time
  const dur = Number(cfg.durationPlannedSec || 90);
  STATE.timeLeft = clamp(dur, 10, 999);

  // compute play rect
  STATE.playRect = computePlayRect();

  // emit start
  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode || 'play',
    diff: cfg.diff || 'normal',
    seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitScore();
  emitQuest('เติมจานให้ครบ 5 หมู่ แล้วโฟกัสความแม่นช่วงท้าย!');
  startTimer();

  // shoot support
  WIN.addEventListener('hha:shoot', onShoot);

  // spawn loop
  startSpawning();

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
}