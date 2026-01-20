// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION+)
// HHA Standard
// ------------------------------------------------------------
// ✅ NO hard dependency on mode-factory boot export (fix import error)
// ✅ Works even if mode-factory has controller init bug (targets still spawn)
// ✅ Emits: hha:start, hha:score, hha:time, quest:update, hha:coach, hha:end
// ✅ Crosshair/tap-to-shoot via vr-ui.js (hha:shoot) — we handle hit test here
// ✅ Play vs Research:
//    - play: adaptive-ish spawn rate
//    - research/study: deterministic seed + stable behavior (no adaptive)
// ✅ Mini (accuracy) shows progress live BUT pass/fail decided at END
// ------------------------------------------------------------

'use strict';

const WIN = window;
const DOC = document;

const clamp = (v,a,b)=>{
  v = Number(v)||0;
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
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function nowMs(){ return Date.now(); }

function isResearch(runMode){
  runMode = String(runMode||'').toLowerCase();
  return (runMode === 'research' || runMode === 'study');
}

// ------------------------------------------------------------
// STATE
// ------------------------------------------------------------
const S = {
  running:false,
  ended:false,

  cfg:null,
  rng:Math.random,

  // timing
  timeLeftSec:0,
  tickId:null,

  // score
  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  // accuracy components
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // 5 groups collected
  g:[0,0,0,0,0],

  // quest
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอย่างน้อย 1 ชิ้นในแต่ละหมู่',
    cur:0,
    target:5,
    done:false
  },
  mini:{
    name:'ความแม่นยำ',
    sub:'คุมความแม่น ≥ 80% จนจบเกม',
    cur:0,       // live % (0..100)
    target:80,
    done:false   // decided at END (not mid-game)
  },

  // targets
  mount:null,
  targets:new Set(), // DOM elements
  spawnId:null,
  spawnEveryMs:900,
  ttlMs:1600,

  // difficulty pressure (light)
  baseSpawnMs:900,
  minSpawnMs:520
};

function accuracyPct(){
  const total = S.hitGood + S.hitJunk + S.expireGood;
  if(total <= 0) return 100;
  return Math.round((S.hitGood / total) * 100);
}

function updateGoalFromGroups(){
  // count unique groups collected at least 1
  S.goal.cur = S.g.reduce((a,v)=>a + (v>0 ? 1 : 0), 0);
  if(!S.goal.done && S.goal.cur >= S.goal.target){
    S.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
  }
}

function emitQuest(){
  emit('quest:update', {
    goal:{
      name:S.goal.name,
      sub:S.goal.sub,
      cur:S.goal.cur,
      target:S.goal.target
    },
    mini:{
      name:S.mini.name,
      sub:S.mini.sub,
      cur:S.mini.cur,
      target:S.mini.target,
      done:S.mini.done
    },
    allDone: (S.goal.done && S.mini.done)
  });
}

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

function emitScore(){
  emit('hha:score', {
    score: S.score,
    combo: S.combo,
    comboMax: S.comboMax
  });
}

function addScore(delta){
  S.score = Math.max(-999999, (S.score + (Number(delta)||0)));
  emitScore();
}

function addCombo(){
  S.combo++;
  S.comboMax = Math.max(S.comboMax, S.combo);
}

function resetCombo(){
  S.combo = 0;
}

function addMiss(){
  S.miss++;
}

// ------------------------------------------------------------
// TARGETS (DOM spawn + hit test)
// ------------------------------------------------------------
function rectOf(el){
  try{ return el.getBoundingClientRect(); }catch(_){ return null; }
}

function within(x,y,r){
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function removeTarget(el){
  if(!el) return;
  if(S.targets.has(el)) S.targets.delete(el);
  try{ el.remove(); }catch(_){}
}

function expireTarget(el){
  if(!el) return;
  const kind = el.getAttribute('data-kind') || '';
  if(kind === 'good'){
    S.expireGood++;
    addMiss();
    resetCombo();
  }
  removeTarget(el);
  // update mini live
  S.mini.cur = accuracyPct();
  emitQuest();
}

function hitTarget(el){
  if(!el) return;
  const kind = el.getAttribute('data-kind') || 'good';

  if(kind === 'good'){
    S.hitGood++;

    // group
    const gi = clamp(el.getAttribute('data-group'), 0, 4);
    S.g[gi]++;

    addCombo();
    addScore(100 + S.combo * 6);

    updateGoalFromGroups();

    // update mini live (but do NOT set done here)
    S.mini.cur = accuracyPct();

    coach('ดีมาก! ✅', 'Coach');
  } else {
    S.hitJunk++;
    addMiss();
    resetCombo();
    addScore(-60);
    coach('ระวัง! ของทอด/หวาน ⚠️', 'Coach');
    S.mini.cur = accuracyPct();
  }

  emitQuest();
  removeTarget(el);

  // light adaptive: speed up if combo is high (PLAY only)
  if(!isResearch(S.cfg.runMode)){
    const pressure = clamp(S.comboMax, 0, 40);
    S.spawnEveryMs = clamp(S.baseSpawnMs - pressure * 10, S.minSpawnMs, S.baseSpawnMs);
  }
}

function pickGroupIndex(){
  // keep variety: prefer missing groups
  const missing = [];
  for(let i=0;i<5;i++) if(S.g[i] <= 0) missing.push(i);
  if(missing.length && S.rng() < 0.65){
    return missing[Math.floor(S.rng()*missing.length)];
  }
  return Math.floor(S.rng()*5);
}

function makeTarget(kind='good'){
  const el = DOC.createElement('div');
  el.className = 'plateTarget';
  el.setAttribute('data-kind', kind);

  // group only for good
  let gi = 0;
  if(kind === 'good'){
    gi = pickGroupIndex();
    el.setAttribute('data-group', String(gi));
  }

  // emoji set (Plate)
  const EMO_GOOD = ['🥦','🍎','🐟','🍚','🥑']; // 5 หมู่ (ยืดทีหลังได้หลายรายการต่อหมู่)
  const EMO_JUNK = ['🍟','🍩','🍰','🥤','🍔'];

  el.textContent = (kind === 'good')
    ? EMO_GOOD[gi] || '🍽️'
    : EMO_JUNK[Math.floor(S.rng()*EMO_JUNK.length)];

  // size
  const base = (S.cfg.view === 'pc') ? 56 : 60;
  const jitter = (S.cfg.view === 'pc') ? 18 : 20;
  const size = clamp(base + Math.floor((S.rng()*2-1)*jitter), 44, 86);
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.fontSize = `${Math.round(size*0.46)}px`;

  // position inside mount rect
  const R = S.mount.getBoundingClientRect();
  // safe margins (keep away from top HUD zone a bit)
  const pad = 12;
  const topSafe = pad + (S.cfg.view === 'mobile' ? 96 : 80); // push down from HUD
  const left = pad;
  const right = pad;
  const bottom = pad + (S.cfg.view === 'mobile' ? 84 : 72);

  const xMin = R.left + left;
  const xMax = R.right - right - size;
  const yMin = R.top + topSafe;
  const yMax = R.bottom - bottom - size;

  const x = clamp(xMin + Math.floor(S.rng()*Math.max(1,(xMax-xMin))), xMin, xMax);
  const y = clamp(yMin + Math.floor(S.rng()*Math.max(1,(yMax-yMin))), yMin, yMax);

  el.style.position = 'absolute';
  el.style.left = `${Math.round(x - R.left)}px`;
  el.style.top  = `${Math.round(y - R.top)}px`;

  // click hit (for mouse/tap)
  el.addEventListener('pointerdown', (e)=>{
    e.preventDefault();
    e.stopPropagation();
    if(!S.running) return;
    hitTarget(el);
  }, { passive:false });

  // ttl
  const ttl = clamp(S.ttlMs + Math.floor((S.rng()*2-1)*260), 900, 2400);
  const to = setTimeout(()=>{
    if(S.targets.has(el) && !S.ended) expireTarget(el);
  }, ttl);
  el._ttl = to;

  return el;
}

function spawnOne(){
  if(!S.running || S.ended) return;
  const kind = (S.rng() < 0.72) ? 'good' : 'junk';
  const el = makeTarget(kind);
  S.targets.add(el);
  S.mount.appendChild(el);
}

function startSpawning(){
  stopSpawning();
  const loop = ()=>{
    if(!S.running || S.ended) return;
    spawnOne();
    S.spawnId = setTimeout(loop, S.spawnEveryMs);
  };
  S.spawnId = setTimeout(loop, 260);
}

function stopSpawning(){
  if(S.spawnId) clearTimeout(S.spawnId);
  S.spawnId = null;
  // clear targets
  for(const el of Array.from(S.targets)){
    try{ clearTimeout(el._ttl); }catch(_){}
    removeTarget(el);
  }
  S.targets.clear();
}

// ------------------------------------------------------------
// hha:shoot (crosshair / tap-to-shoot from vr-ui.js)
// We raycast by center point to nearest target under cursor.
// ------------------------------------------------------------
function bindShoot(){
  WIN.addEventListener('hha:shoot', (e)=>{
    if(!S.running || S.ended) return;

    const d = e.detail || {};
    const x = Number(d.x)||0;
    const y = Number(d.y)||0;
    const lockPx = clamp(d.lockPx ?? 28, 8, 80);

    // find top-most target in lock square
    let picked = null;
    let bestDist = 1e9;

    for(const el of S.targets){
      const r = rectOf(el);
      if(!r) continue;

      // consider only if cursor near rect
      const cx = clamp(x, r.left, r.right);
      const cy = clamp(y, r.top, r.bottom);
      const dx = (cx - x);
      const dy = (cy - y);
      const dist = Math.sqrt(dx*dx + dy*dy);

      // accept if inside rect or close to it (assist)
      const inRect = within(x,y,r);
      const ok = inRect || dist <= lockPx;

      if(ok && dist < bestDist){
        bestDist = dist;
        picked = el;
      }
    }

    if(picked){
      hitTarget(picked);
    }
  }, { passive:true });
}

// ------------------------------------------------------------
// TIMER + END
// ------------------------------------------------------------
function startTimer(){
  emit('hha:time', { leftSec: S.timeLeftSec });
  S.tickId = setInterval(()=>{
    if(!S.running || S.ended) return;
    S.timeLeftSec--;
    emit('hha:time', { leftSec: S.timeLeftSec });
    if(S.timeLeftSec <= 0){
      endGame('timeup');
    }
  }, 1000);
}

function stopTimer(){
  if(S.tickId) clearInterval(S.tickId);
  S.tickId = null;
}

function endGame(reason='timeup'){
  if(S.ended) return;
  S.ended = true;
  S.running = false;

  stopTimer();
  stopSpawning();

  // Decide mini at END using final accuracy
  const acc = accuracyPct();
  S.mini.cur = acc;
  S.mini.done = (acc >= S.mini.target);

  emitQuest();

  emit('hha:end', {
    reason,
    projectTag:'HeroHealth-Plate',
    runMode: S.cfg.runMode,
    diff: S.cfg.diff,
    seed: S.cfg.seed,
    durationPlannedSec: S.cfg.durationPlannedSec,
    durationPlayedSec: (Number(S.cfg.durationPlannedSec)||0),

    scoreFinal: S.score,
    comboMax: S.comboMax,
    misses: S.miss,

    goalsCleared: (S.goal.done ? 1 : 0),
    goalsTotal: 1,
    miniCleared: (S.mini.done ? 1 : 0),
    miniTotal: 1,
    miniTarget: S.mini.target,

    accuracyGoodPct: acc,

    g1:S.g[0], g2:S.g[1], g3:S.g[2], g4:S.g[3], g5:S.g[4],
  });
}

// ------------------------------------------------------------
// BOOT (public)
// ------------------------------------------------------------
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');
  S.mount = mount;

  // cfg defaults
  cfg = cfg || {};
  cfg.view = cfg.view || 'mobile';
  cfg.runMode = (cfg.runMode || cfg.run || 'play');
  cfg.diff = (cfg.diff || 'normal');

  // ✅ default time 90 here too (double safety)
  cfg.durationPlannedSec = clamp(cfg.durationPlannedSec ?? 90, 10, 999);
  cfg.seed = Number(cfg.seed || nowMs());

  S.cfg = cfg;

  // rng
  S.rng = isResearch(cfg.runMode) ? seededRng(cfg.seed) : Math.random;

  // reset state
  S.running = true;
  S.ended = false;

  S.score = 0;
  S.combo = 0;
  S.comboMax = 0;
  S.miss = 0;

  S.hitGood = 0;
  S.hitJunk = 0;
  S.expireGood = 0;

  S.g = [0,0,0,0,0];

  S.goal.cur = 0;
  S.goal.done = false;

  S.mini.cur = 0;
  S.mini.done = false;

  S.timeLeftSec = Number(cfg.durationPlannedSec) || 90;

  // spawn params by difficulty
  const diff = String(cfg.diff||'normal').toLowerCase();
  if(diff === 'easy'){
    S.baseSpawnMs = 980;
    S.ttlMs = 1900;
  } else if(diff === 'hard'){
    S.baseSpawnMs = 760;
    S.ttlMs = 1450;
  } else {
    S.baseSpawnMs = 900;
    S.ttlMs = 1650;
  }
  // research: fixed pacing
  if(isResearch(cfg.runMode)){
    S.spawnEveryMs = S.baseSpawnMs;
  } else {
    S.spawnEveryMs = S.baseSpawnMs;
  }

  // announce start
  emit('hha:start', {
    game:'plate',
    projectTag:'HeroHealth-Plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: S.timeLeftSec,
    view: cfg.view,
  });

  // bind shoot (crosshair/tap)
  bindShoot();

  // initial quest emit
  emitQuest();

  // start loops
  startTimer();
  startSpawning();

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
}