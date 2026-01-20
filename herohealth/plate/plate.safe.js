// =========================================================
// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)  A27
// HHA Standard (DOM targets + vr-ui crosshair shoot)
// ---------------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (spawn rate ramps + A/B/C FX optional hooks)
//   - research/study: deterministic seed + adaptive OFF + FX OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Uses: ../vr/mode-factory.js (DOM spawner) with export fallback
// ✅ Works even if mode-factory controller logic has a bug
// ---------------------------------------------------------
// Notes:
// - Targets spawn inside #plate-layer (mount)
// - Hit comes from two sources:
//   (1) tap/click on targets (pointer)
//   (2) vr-ui.js -> window event 'hha:shoot' (center crosshair)
// =========================================================

'use strict';

// --- Import spawner with fallback for differing exports ---
import * as ModeFactory from '../vr/mode-factory.js';

const WIN = window;
const DOC = document;

/* ---------------------------------------------------------
 * Utilities
 * --------------------------------------------------------- */
const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

function seededRng(seed){
  let t = (seed >>> 0) || 0x12345678;
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

function nowMs(){ return Date.now(); }

function pickWeighted(rng, items){
  // items: [{x, weight}]
  let sum = 0;
  for(const it of items) sum += Math.max(0, Number(it.weight)||0);
  if(sum <= 0) return items[0];
  let r = rng() * sum;
  for(const it of items){
    r -= Math.max(0, Number(it.weight)||0);
    if(r <= 0) return it;
  }
  return items[items.length-1];
}

/* ---------------------------------------------------------
 * Engine State
 * --------------------------------------------------------- */
const S = {
  cfg: null,
  rng: Math.random,

  mount: null,
  spawner: null,

  running: false,
  ended: false,

  // time
  tStart: 0,
  timeLeft: 0,
  timer: null,

  // scoring
  score: 0,
  combo: 0,
  comboMax: 0,
  miss: 0,

  // counters
  hitGood: 0,
  hitJunk: 0,
  expireGood: 0,

  // groups 5 หมู่ (สะสมจำนวน)
  g: [0,0,0,0,0],

  // quest
  goal: { name:'เติมจานให้ครบ 5 หมู่', sub:'เก็บอาหารให้ครบทุกหมู่', cur:0, target:5, done:false },
  mini: { name:'ความแม่นยำ', sub:'คุมความแม่น ≥ 80%', cur:0, target:80, done:false },

  // FX gates (A/B/C)
  fx: { bonus:false, trick:false, panic:false },

  // internal
  lastCoachAt: 0,
};

/* ---------------------------------------------------------
 * Accuracy
 * --------------------------------------------------------- */
function accuracy(){
  const total = S.hitGood + S.hitJunk + S.expireGood;
  if(total <= 0) return 1;
  return S.hitGood / total;
}

function accuracyPct(){
  return Math.round(accuracy() * 100);
}

/* ---------------------------------------------------------
 * Coach (rate-limited)
 * --------------------------------------------------------- */
function coach(msg, tag='Coach'){
  const now = nowMs();
  if(now - S.lastCoachAt < 700) return;
  S.lastCoachAt = now;
  emit('hha:coach', { msg, tag });
}

/* ---------------------------------------------------------
 * Quest update
 * --------------------------------------------------------- */
function emitQuest(extra = {}){
  emit('quest:update', {
    goal: {
      name: S.goal.name,
      sub:  S.goal.sub,
      cur:  S.goal.cur,
      target: S.goal.target
    },
    mini: {
      name: S.mini.name,
      sub:  S.mini.sub,
      cur:  S.mini.cur,
      target: S.mini.target,
      done: S.mini.done
    },
    allDone: !!(S.goal.done && S.mini.done),

    // extras (optional HUD)
    plateHave: S.goal.cur,
    accPct: accuracyPct(),
    g: S.g.slice(),

    ...extra
  });
}

/* ---------------------------------------------------------
 * Score
 * --------------------------------------------------------- */
function emitScore(){
  emit('hha:score', { score:S.score, combo:S.combo, comboMax:S.comboMax, miss:S.miss });
}

function addCombo(){
  S.combo++;
  if(S.combo > S.comboMax) S.comboMax = S.combo;
}

function resetCombo(){
  S.combo = 0;
}

function addScore(v){
  S.score = Math.max(0, (S.score + (Number(v)||0)));
  emitScore();
}

/* ---------------------------------------------------------
 * End
 * --------------------------------------------------------- */
function endGame(reason='timeup'){
  if(S.ended) return;
  S.ended = true;
  S.running = false;

  try{ clearInterval(S.timer); }catch(_){}
  S.timer = null;

  const detail = {
    game:'plate',
    reason,

    runMode: S.cfg?.runMode || 'play',
    diff: S.cfg?.diff || 'normal',
    seed: S.cfg?.seed ?? '',

    durationPlannedSec: Number(S.cfg?.durationPlannedSec || 0),
    durationPlayedSec: Math.max(0, Math.round((nowMs() - S.tStart)/1000)),

    scoreFinal: S.score,
    comboMax: S.comboMax,
    misses: S.miss,

    goalsCleared: S.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: S.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: accuracyPct(),

    // counts
    nHitGood: S.hitGood,
    nHitJunk: S.hitJunk,
    nExpireGood: S.expireGood,

    // groups
    g: S.g.slice(),
    g1: S.g[0], g2: S.g[1], g3: S.g[2], g4: S.g[3], g5: S.g[4],

    // passthrough ctx
    studyId: S.cfg?.studyId || '',
    phase: S.cfg?.phase || '',
    conditionGroup: S.cfg?.conditionGroup || '',
    sessionOrder: S.cfg?.sessionOrder || '',
    blockLabel: S.cfg?.blockLabel || '',
    siteCode: S.cfg?.siteCode || '',
    schoolCode: S.cfg?.schoolCode || '',
    schoolName: S.cfg?.schoolName || '',
    gradeLevel: S.cfg?.gradeLevel || '',
    studentKey: S.cfg?.studentKey || '',
    hub: S.cfg?.hub || '',
  };

  emit('hha:end', detail);
}

/* ---------------------------------------------------------
 * Timer
 * --------------------------------------------------------- */
function startTimer(){
  emit('hha:time', { leftSec: S.timeLeft });

  S.timer = setInterval(()=>{
    if(!S.running) return;
    S.timeLeft--;
    emit('hha:time', { leftSec: S.timeLeft });

    // PANIC (C): last 10–12s (play only, plate only)
    if(S.fx.panic && S.timeLeft <= 12){
      // give a hint once
      if(S.timeLeft === 12) coach('โค้งสุดท้าย! เป้าจะถี่ขึ้นนิดนึง ⚠️', 'System');
      // speed up spawner safely (if supported)
      try{
        if(S.spawner && typeof S.spawner.setSpawnRate === 'function'){
          const base = Number(S.cfg.__baseSpawnRate || 900);
          S.spawner.setSpawnRate(Math.max(420, Math.round(base * 0.70)));
        }
      }catch(_){}
    }

    if(S.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ---------------------------------------------------------
 * Hit / Expire
 * --------------------------------------------------------- */
function onHitGood(groupIndex){
  S.hitGood++;
  S.g[groupIndex]++;

  addCombo();
  addScore(100 + (S.combo * 5));

  // goal = number of groups collected at least 1
  if(!S.goal.done){
    S.goal.cur = S.g.filter(v=>v>0).length;
    if(S.goal.cur >= S.goal.target){
      S.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  // mini = accuracy >= target
  const accP = accuracyPct();
  S.mini.cur = accP;
  if(!S.mini.done && accP >= S.mini.target){
    S.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  emitQuest();
}

function onHitJunk(){
  S.hitJunk++;
  S.miss++;
  resetCombo();

  // mild penalty but not negative score
  addScore(-50);

  coach('ระวัง! ของหวาน/ทอด ⚠️');
  emitQuest();
  emitScore();
}

function onExpireGood(){
  S.expireGood++;
  S.miss++;
  resetCombo();
  emitQuest();
  emitScore();
}

/* ---------------------------------------------------------
 * Target model (emoji sets)
 * --------------------------------------------------------- */
const GROUPS = [
  { key:'g1', name:'ผัก',   emoji:['🥦','🥬','🥒','🥕','🌽'], weight:1.0 },
  { key:'g2', name:'ผลไม้', emoji:['🍎','🍌','🍇','🍉','🍍'], weight:1.0 },
  { key:'g3', name:'โปรตีน',emoji:['🐟','🍗','🥚','🫘','🧀'], weight:1.0 },
  { key:'g4', name:'ข้าว-แป้ง',emoji:['🍚','🍞','🥖','🥔','🍜'], weight:1.0 },
  { key:'g5', name:'ไขมันดี',emoji:['🥑','🫒','🥜','🌰','🧈'], weight:1.0 },
];

const JUNK = ['🍟','🍔','🍩','🍕','🧁','🥤'];

function makeTarget(rng, kind){
  if(kind === 'junk'){
    const em = JUNK[Math.floor(rng()*JUNK.length)];
    return { kind:'junk', emoji: em, groupIndex: null };
  }
  // good -> pick group uniformly
  const gi = Math.floor(rng()*5);
  const g = GROUPS[gi];
  const em = g.emoji[Math.floor(rng()*g.emoji.length)];
  return { kind:'good', emoji: em, groupIndex: gi };
}

/* ---------------------------------------------------------
 * Spawner adapter (ModeFactory)
 * --------------------------------------------------------- */
function createSpawnerSafe(opts){
  // Prefer ModeFactory.createSpawner, fallback to ModeFactory.boot, fallback to minimal internal spawner
  if(ModeFactory && typeof ModeFactory.createSpawner === 'function'){
    return ModeFactory.createSpawner(opts);
  }
  if(ModeFactory && typeof ModeFactory.boot === 'function'){
    // some older versions export boot()
    return ModeFactory.boot(opts);
  }

  // --- Minimal fallback spawner (only for emergency) ---
  const mount = opts.mount;
  let spawnRate = Number(opts.spawnRate || 900);
  let alive = true;

  function spawnOne(){
    if(!alive) return;

    const t = makeTarget(S.rng, (S.rng() < 0.30 ? 'junk' : 'good'));

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = t.kind;
    el.dataset.gi = (t.groupIndex==null ? '' : String(t.groupIndex));
    el.textContent = t.emoji;

    // size + position
    const size = Math.round(44 + S.rng()*22);
    el.style.width = size+'px';
    el.style.height = size+'px';

    const rect = mount.getBoundingClientRect();
    const x = Math.round(rect.left + 12 + S.rng()*(Math.max(50, rect.width - 24)));
    const y = Math.round(rect.top  + 120 + S.rng()*(Math.max(80, rect.height - 220)));
    el.style.position = 'fixed';
    el.style.left = x+'px';
    el.style.top  = y+'px';
    el.style.transform = 'translate(-50%,-50%)';

    const lifeMs = 1400 + Math.round(S.rng()*900);
    const born = nowMs();

    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      if(!S.running) return;
      el.remove();
      if(t.kind === 'good') onHitGood(t.groupIndex ?? Math.floor(S.rng()*5));
      else onHitJunk();
    }, { passive:false });

    mount.appendChild(el);

    // expire
    setTimeout(()=>{
      if(!alive) return;
      if(!el.isConnected) return;
      el.remove();
      if(t.kind === 'good') onExpireGood();
    }, lifeMs);

    // schedule next
    setTimeout(spawnOne, spawnRate);
  }

  // start
  setTimeout(spawnOne, Math.max(200, spawnRate));

  return {
    destroy(){ alive = false; try{ mount.innerHTML=''; }catch(_){} },
    setSpawnRate(ms){ spawnRate = clamp(ms, 300, 2000); }
  };
}

/* ---------------------------------------------------------
 * Crosshair shoot handler (vr-ui.js)
 * --------------------------------------------------------- */
function bindCrosshairShoot(){
  function onShoot(ev){
    if(!S.running) return;
    const d = ev?.detail || {};
    const x = Number(d.x ?? (WIN.innerWidth/2));
    const y = Number(d.y ?? (WIN.innerHeight/2));
    const lockPx = clamp(d.lockPx ?? 28, 8, 80);

    // find topmost target near crosshair
    const els = DOC.elementsFromPoint(x, y) || [];
    let hit = null;

    for(const el of els){
      if(!el) continue;
      if(el.classList && el.classList.contains('plateTarget')){
        hit = el;
        break;
      }
      // lock radius assist: look for nearest plateTarget within lockPx
      if(el instanceof Element){
        const pt = el.closest && el.closest('.plateTarget');
        if(pt){ hit = pt; break; }
      }
    }

    // if direct hit not found, try scan a small square around center
    if(!hit && lockPx > 0){
      const steps = [0, -lockPx, lockPx];
      outer:
      for(const dx of steps){
        for(const dy of steps){
          const els2 = DOC.elementsFromPoint(x+dx, y+dy) || [];
          for(const el of els2){
            if(el && el.classList && el.classList.contains('plateTarget')){
              hit = el; break outer;
            }
          }
        }
      }
    }

    if(hit){
      // simulate click
      try{
        hit.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, cancelable:true }));
      }catch(_){
        try{ hit.click(); }catch(__){}
      }
    }
  }

  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  return ()=> WIN.removeEventListener('hha:shoot', onShoot);
}

/* ---------------------------------------------------------
 * FX (A/B/C) — CSS class toggles per target
 * --------------------------------------------------------- */
function applyFxToTarget(el, rng){
  if(!el || !el.classList) return;

  // bonus: ~15%
  if(S.fx.bonus && rng() < 0.15){
    el.classList.add('fx-bonus');
  }

  // trick: after 30s left, mild wobble
  if(S.fx.trick && S.timeLeft <= 60){
    el.classList.add('fx-trick');
  }
}

/* ---------------------------------------------------------
 * Boot
 * --------------------------------------------------------- */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  S.mount = mount;
  S.cfg = cfg || {};
  S.running = true;
  S.ended = false;

  // Reset state
  S.score = 0; S.combo = 0; S.comboMax = 0; S.miss = 0;
  S.hitGood = 0; S.hitJunk = 0; S.expireGood = 0;
  S.g = [0,0,0,0,0];

  S.goal.cur = 0; S.goal.done = false;
  S.mini.cur = 0; S.mini.done = false;

  // Time
  S.timeLeft = Number(cfg.durationPlannedSec) || 90;
  S.tStart = nowMs();

  // RNG
  const rm = (cfg.runMode || 'play').toLowerCase();
  const seed = Number(cfg.seed || Date.now());
  if(rm === 'research' || rm === 'study'){
    S.rng = seededRng(seed);
  }else{
    S.rng = Math.random;
  }

  // FX gates (A/B/C)
  const isPlay = (rm === 'play');
  S.fx = {
    bonus: isPlay,              // A
    trick: isPlay,              // B
    panic: isPlay,              // C (plate only; set by boot cfg optionally)
  };
  // allow forcing panic off via query/config if needed
  if(cfg.forceNoPanic) S.fx.panic = false;

  // announce start
  emit('hha:start', {
    game:'plate',
    runMode: rm,
    diff: cfg.diff || 'normal',
    seed,
    durationPlannedSec: S.timeLeft,
  });

  emitScore();
  emitQuest();

  // Bind crosshair shooting
  const unbindShoot = bindCrosshairShoot();

  // Create spawner
  // Base spawn rate by diff (adaptive ramps in play)
  let baseSpawn = (String(cfg.diff||'normal') === 'hard') ? 700 : 900;
  if(String(cfg.diff||'normal') === 'easy') baseSpawn = 980;

  cfg.__baseSpawnRate = baseSpawn;

  // Make spawner using ModeFactory adapter
  S.spawner = createSpawnerSafe({
    mount,
    seed,
    rng: S.rng,

    spawnRate: baseSpawn,
    sizeRange: [44, 64],

    // Provide a target factory so we control emoji + groupIndex
    makeTarget: (rng)=>{
      const kind = (rng() < 0.30) ? 'junk' : 'good';
      return makeTarget(rng, kind);
    },

    // Called when element created (so we can apply A/B FX classes)
    onCreate: (el, t)=>{
      // Ensure our class + dataset for CSS
      if(el){
        el.classList.add('plateTarget');
        if(t?.kind) el.dataset.kind = t.kind;
        if(t?.groupIndex != null) el.dataset.gi = String(t.groupIndex);
        if(t?.emoji) el.textContent = t.emoji;
        applyFxToTarget(el, S.rng);
      }
    },

    onHit: (t)=>{
      if(!S.running) return;
      if(t.kind === 'good'){
        onHitGood(t.groupIndex ?? Math.floor(S.rng()*5));
      }else{
        onHitJunk();
      }
    },

    onExpire: (t)=>{
      if(!S.running) return;
      if(t.kind === 'good') onExpireGood();
    }
  });

  // Adaptive ramp (play only): slowly increase difficulty mid-game
  if(isPlay){
    const ramp = setInterval(()=>{
      if(!S.running || S.ended) return;
      // don't ramp during last panic window
      if(S.timeLeft <= 14) return;

      // ramp: faster spawn + smaller targets slightly
      try{
        if(S.spawner && typeof S.spawner.setSpawnRate === 'function'){
          const elapsed = Math.round((nowMs() - S.tStart)/1000);
          const factor = (elapsed < 25) ? 1.0 : (elapsed < 55 ? 0.92 : 0.85);
          S.spawner.setSpawnRate(Math.max(520, Math.round(baseSpawn * factor)));
        }
      }catch(_){}
    }, 1500);

    // clean on end
    WIN.addEventListener('hha:end', ()=>{
      try{ clearInterval(ramp); }catch(_){}
    }, { once:true });
  }

  // Start timer
  startTimer();

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');

  // Cleanup on end
  WIN.addEventListener('hha:end', ()=>{
    try{ unbindShoot(); }catch(_){}
    try{ if(S.spawner && typeof S.spawner.destroy === 'function') S.spawner.destroy(); }catch(_){}
  }, { once:true });
}