// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard — Standalone spawner (NO mode-factory dependency)
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: FX A+B+C ON
//   - research/study: deterministic seed + FX OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ------------------------------------------------

'use strict';

const WIN = window;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

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

function nowMs(){ return performance.now ? performance.now() : Date.now(); }

// ---------------- Engine state ----------------
const S = {
  running:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  timeLeft:0,
  timer:null,

  // plate groups (5 หมู่)
  g:[0,0,0,0,0],

  // counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,

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
    sub:'คุมความแม่น ≥ 80% (ตัดสินช่วงท้าย)',
    cur:0,
    target:80,
    done:false,
    stateLabel:'—'
  },

  cfg:null,
  rng:Math.random,

  // FX flags
  FX:{ bonus:false, trick:false, panic:false },

  // spawner
  mount:null,
  targets:new Set(),
  spawnTo:null,
  lastCoachAt:0,
  shots:0,
};

// ---------------- Coach helper ----------------
function coach(msg, tag='Coach', rateMs=900){
  const t = nowMs();
  if(t - S.lastCoachAt < rateMs) return;
  S.lastCoachAt = t;
  emit('hha:coach', { msg, tag });
}

// ---------------- Score helpers ----------------
function pushScore(){
  emit('hha:score', {
    score: S.score,
    combo: S.combo,
    comboMax: S.comboMax,
    misses: S.miss
  });
}
function addCombo(){
  S.combo++;
  S.comboMax = Math.max(S.comboMax, S.combo);
}
function resetCombo(){ S.combo = 0; }

function addScore(v){
  S.score = Math.max(0, S.score + (Number(v)||0));
  pushScore();
}

function accuracy(){
  const total = S.hitGood + S.hitJunk + S.expireGood;
  if(total <= 0) return 1;
  return S.hitGood / total;
}
function accPctInt(){
  return Math.round(accuracy() * 100);
}

// ---------------- Quest update ----------------
function emitQuest(){
  emit('quest:update', {
    goal:{
      name: S.goal.name,
      sub: S.goal.sub,
      cur: S.goal.cur,
      target: S.goal.target
    },
    mini:{
      name: S.mini.name,
      sub: S.mini.sub,
      cur: S.mini.cur,
      target: S.mini.target,
      done: S.mini.done,
      stateLabel: S.mini.stateLabel
    },
    allDone: S.goal.done && S.mini.done
  });
}

// ---------------- End game ----------------
function endGame(reason='timeup'){
  if(S.ended) return;
  S.ended = true;
  S.running = false;

  clearInterval(S.timer);
  clearTimeout(S.spawnTo);

  // remove targets
  for(const el of S.targets) {
    try{ el.remove(); }catch(_){}
  }
  S.targets.clear();

  const acc = accPctInt();
  const miniPass = (acc >= S.mini.target) && (S.hitGood + S.hitJunk + S.expireGood >= 8);
  S.mini.done = miniPass;
  S.mini.cur = acc;
  S.mini.stateLabel = `${acc}/${S.mini.target}`;

  emit('hha:end', {
    reason,
    scoreFinal: S.score,
    comboMax: S.comboMax,
    misses: S.miss,

    goalsCleared: S.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: S.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: acc,

    g1: S.g[0],
    g2: S.g[1],
    g3: S.g[2],
    g4: S.g[3],
    g5: S.g[4],

    // logger context
    projectTag: 'HeroHealth',
    runMode: S.cfg?.runMode || 'play',
    diff: S.cfg?.diff || 'normal',
    seed: S.cfg?.seed || '',
    durationPlannedSec: S.cfg?.durationPlannedSec || 0,
    durationPlayedSec: (S.cfg?.durationPlannedSec || 0) - (S.timeLeft || 0),
    nHitGood: S.hitGood,
    nHitJunk: S.hitJunk,
    nExpireGood: S.expireGood,
    goalsClearedCount: S.goal.done ? 1 : 0,
    miniClearedCount: S.mini.done ? 1 : 0
  });
}

// ---------------- Timer ----------------
function startTimer(){
  emit('hha:time', { leftSec: S.timeLeft });

  S.timer = setInterval(()=>{
    if(!S.running) return;
    S.timeLeft--;
    emit('hha:time', { leftSec: S.timeLeft });

    // PANIC window (เฉพาะ play)
    if(S.FX.panic && S.timeLeft === 12){
      coach('⚠️ PANIC! 12 วิสุดท้าย เร่งหน่อย!', 'System', 0);
    }

    // Mini label live (แต่ยังไม่ตัดสินจนจบ)
    if(!S.mini.done){
      const a = accPctInt();
      S.mini.cur = a;
      const need = Math.max(0, S.mini.target - a);
      if(S.timeLeft > 12) S.mini.stateLabel = `รอช่วงท้าย • ขาด ${need}%`;
      else S.mini.stateLabel = `ท้ายเกม • ${a}/${S.mini.target}`;
      emitQuest();
    }

    if(S.timeLeft <= 0) endGame('timeup');
  }, 1000);
}

// ---------------- Spawner ----------------
const EMOJI_GOOD = ['🥦','🍎','🐟','🍚','🥑']; // 5 หมู่
const EMOJI_JUNK = ['🍟','🍩','🍕','🧁'];      // junk (ยังเป็น emoji ล้วน)

function mountRect(){
  const r = S.mount.getBoundingClientRect();
  return { x:r.left, y:r.top, w:r.width, h:r.height };
}

// safe margins: กันชน HUD คร่าว ๆ (top/left/right/bottom)
function safeRect(rect){
  const top = 140;   // HUD + quest (ปรับได้)
  const bottom = 90; // coach area
  const side = 16;
  const x = rect.x + side;
  const y = rect.y + top;
  const w = Math.max(120, rect.w - side*2);
  const h = Math.max(140, rect.h - top - bottom);
  return { x, y, w, h };
}

function pickSpawnPos(r){
  // uniform in safeRect
  const px = r.x + (S.rng() * r.w);
  const py = r.y + (S.rng() * r.h);
  return { x: px, y: py };
}

function mkTarget(kind, groupIndex, bonus=false, trick=false, ttlMs=1200, size=56){
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'plateTarget';
  el.dataset.kind = kind;
  el.dataset.gi = String(groupIndex ?? -1);

  if(bonus) el.classList.add('fx-bonus');
  if(trick) el.classList.add('fx-trick');

  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.fontSize = `${Math.round(size*0.52)}px`;

  // emoji
  if(kind === 'good'){
    el.textContent = EMOJI_GOOD[groupIndex] || '🍽️';
  }else{
    el.textContent = EMOJI_JUNK[Math.floor(S.rng()*EMOJI_JUNK.length)] || '🍟';
  }

  // click handler
  el.addEventListener('click', ()=>{
    if(!S.running) return;
    if(!S.targets.has(el)) return; // already removed

    if(kind === 'good'){
      onHitGood(groupIndex);
    }else{
      onHitJunk();
    }
    killTarget(el);
  }, {passive:true});

  // expire
  const to = setTimeout(()=>{
    if(!S.targets.has(el)) return;
    if(kind === 'good') onExpireGood();
    killTarget(el);
  }, ttlMs);

  el.__ttl = to;
  return el;
}

function killTarget(el){
  S.targets.delete(el);
  try{ clearTimeout(el.__ttl); }catch(_){}
  try{ el.remove(); }catch(_){}
}

function currentSpawnParams(){
  // base
  let spawnEvery = (S.cfg.diff === 'hard') ? 650 : 900;
  let ttl = (S.cfg.diff === 'hard') ? 1150 : 1350;

  // TRICK starts after 30s
  const trickOn = S.FX.trick && (S.timeLeft <= (S.cfg.durationPlannedSec - 30));

  // PANIC last 12s
  if(S.FX.panic && S.timeLeft <= 12){
    spawnEvery = Math.max(420, Math.floor(spawnEvery * 0.7));
    ttl = Math.max(800, Math.floor(ttl * 0.85));
  }

  // size tweak by view
  let size = (S.cfg.view === 'pc') ? 58 : 56;
  if(S.cfg.view === 'cvr' || S.cfg.view === 'vr') size = 62;

  return { spawnEvery, ttl, trickOn, size };
}

function spawnOnce(){
  if(!S.running) return;
  const rect = safeRect(mountRect());
  const { spawnEvery, ttl, trickOn, size } = currentSpawnParams();

  // pick kind
  const good = (S.rng() < 0.72);
  const kind = good ? 'good' : 'junk';
  const gi = good ? Math.floor(S.rng()*5) : -1;

  // A BONUS (play only): 15%
  const bonus = S.FX.bonus && good && (S.rng() < 0.15);

  // B TRICK (play only): 20% after 30s
  const trick = trickOn && (S.rng() < 0.20);

  const sz = bonus ? Math.round(size*1.10) : size;
  const el = mkTarget(kind, gi, bonus, trick, ttl, sz);

  const p = pickSpawnPos(rect);
  // position: translate center
  el.style.left = `${p.x - (sz/2)}px`;
  el.style.top  = `${p.y - (sz/2)}px`;

  S.mount.appendChild(el);
  S.targets.add(el);

  S.spawnTo = setTimeout(spawnOnce, spawnEvery);
}

// ---------------- Hit handlers ----------------
function onHitGood(groupIndex){
  S.hitGood++;
  S.g[groupIndex]++;

  addCombo();
  addScore(100 + S.combo*5);

  // goal progress: count unique groups collected
  if(!S.goal.done){
    S.goal.cur = S.g.filter(v=>v>0).length;
    if(S.goal.cur >= S.goal.target){
      S.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  // mini: label only (final decision at end)
  const a = accPctInt();
  S.mini.cur = a;
  const need = Math.max(0, S.mini.target - a);
  S.mini.stateLabel = (S.timeLeft > 12) ? `รอช่วงท้าย • ขาด ${need}%` : `ท้ายเกม • ${a}/${S.mini.target}`;

  emitQuest();
  pushScore();
}

function onHitJunk(){
  S.hitJunk++;
  S.miss++;
  resetCombo();
  addScore(-30);
  coach('ระวัง! ของทอด/หวาน ⚠️', 'Coach');
  emitQuest();
  pushScore();
}

function onExpireGood(){
  S.expireGood++;
  S.miss++;
  resetCombo();
  emitQuest();
  pushScore();
}

// ---------------- hha:shoot integration ----------------
function dist2(ax,ay,bx,by){
  const dx=ax-bx, dy=ay-by;
  return dx*dx+dy*dy;
}

function handleShoot(ev){
  if(!S.running) return;
  const d = ev?.detail || {};
  const x = Number(d.x);
  const y = Number(d.y);
  const lockPx = clamp(d.lockPx ?? 28, 10, 80);
  if(!isFinite(x) || !isFinite(y)) return;

  // find closest target within radius
  let best = null;
  let bestD2 = lockPx*lockPx;

  for(const el of S.targets){
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top + r.height/2;
    const dd = dist2(x,y,cx,cy);
    if(dd <= bestD2){
      bestD2 = dd;
      best = el;
    }
  }

  if(best){
    // simulate click
    best.click();
    S.shots++;
  }
}

function wireShoot(){
  WIN.addEventListener('hha:shoot', handleShoot, { passive:true });
}

// ---------------- Main boot ----------------
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  S.mount = mount;
  S.cfg = cfg;

  // reset
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
  S.mini.stateLabel = '—';

  // RNG
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    S.rng = seededRng(cfg.seed || Date.now());
  }else{
    S.rng = seededRng(cfg.seed || Date.now()); // ✅ play ก็ seeded ได้ (แต่ adaptive/FX แยก)
  }

  // FX flags: play only
  const isPlay = (cfg.runMode === 'play');
  S.FX = {
    bonus: isPlay,
    trick: isPlay,
    panic: isPlay // เฉพาะ Plate อยู่แล้ว
  };

  // time
  S.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // start event for logger
  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: S.timeLeft,
    view: cfg.view
  });

  // init UI
  pushScore();
  emitQuest();

  // wire shoot once
  wireShoot();

  // start
  startTimer();
  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach', 0);

  // kick spawn
  clearTimeout(S.spawnTo);
  spawnOnce();
}