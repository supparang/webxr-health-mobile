// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard (standalone spawner)
// ------------------------------------------------
// ✅ No dependency on ../vr/mode-factory.js (fixes export/controller errors)
// ✅ Emits: hha:start, hha:score, hha:time, quest:update, hha:coach, hha:end
// ✅ Supports: click/tap targets + crosshair shooting via vr-ui.js (hha:shoot)
// ------------------------------------------------

'use strict';

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

const STATE = {
  running:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  timeLeft:0,
  timer:null,

  // 5 หมู่
  g:[0,0,0,0,0],

  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่',
    cur:0, target:5, done:false
  },
  mini:{
    name:'ความแม่นยำ',
    sub:'คุมความแม่น ≥ 80%',
    cur:0, target:80, done:false
  },

  hitGood:0,
  hitJunk:0,
  expireGood:0,

  cfg:null,
  rng:Math.random,

  mount:null,
  targets:new Map(), // id -> {el, kind, groupIndex, dieAt}
  spawnTimer:null
};

function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
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

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  clearInterval(STATE.spawnTimer);

  // clear targets
  for(const [id, t] of STATE.targets){
    try{ t.el.remove(); }catch{}
  }
  STATE.targets.clear();

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
    if(STATE.timeLeft <= 0) endGame('timeup');
  }, 1000);
}

function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  // goal progress = จำนวนหมู่ที่มีค่า > 0
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  // mini = accuracy >= 80%
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
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  emitQuest();
}

function getHudAvoidRect(){
  const hud = DOC.getElementById('hud');
  if(!hud) return null;
  const r = hud.getBoundingClientRect();
  // ขยายขอบกันชน (เผื่อเงา/ปุ่ม VR UI)
  const pad = 10;
  return {
    x: r.left - pad,
    y: r.top - pad,
    w: r.width + pad*2,
    h: r.height + pad*2
  };
}

function pointInRect(x,y,rc){
  return x >= rc.x && x <= (rc.x+rc.w) && y >= rc.y && y <= (rc.y+rc.h);
}

function pickSpawnXY(size){
  const w = WIN.innerWidth;
  const h = WIN.innerHeight;

  // safe areas
  const sat = 0, sal = 0, sar = 0, sab = 0;
  const margin = 10;

  const minX = sal + margin + size/2;
  const maxX = w - sar - margin - size/2;
  const minY = sat + margin + size/2;
  const maxY = h - sab - margin - size/2;

  const hudRect = getHudAvoidRect();

  // rejection sampling to avoid HUD
  for(let i=0;i<40;i++){
    const x = minX + (maxX-minX) * STATE.rng();
    const y = minY + (maxY-minY) * STATE.rng();

    if(!hudRect) return {x,y};

    // หลบ hud
    if(!pointInRect(x,y,hudRect)) return {x,y};
  }

  // fallback: มุมล่างซ้าย (ยังพอเล่นได้)
  return { x: minX, y: maxY };
}

function makeTarget(kind, groupIndex){
  const el = DOC.createElement('div');
  el.className = 'plateTarget';
  el.dataset.kind = kind;

  // emoji ต่อหมู่ (ทำให้ไม่น่าเบื่อ)
  const EMOJI_GOOD = ['🍚','🥚','🥦','🍌','🥛']; // 5 หมู่ (ตัวอย่าง)
  const EMOJI_JUNK = ['🍟','🍩','🍔','🧋','🍬'];

  el.textContent = (kind === 'good')
    ? (EMOJI_GOOD[groupIndex] || '🍽️')
    : (EMOJI_JUNK[Math.floor(STATE.rng()*EMOJI_JUNK.length)] || '🍭');

  // ขนาดตาม diff
  const sizeBase = (STATE.cfg.diff === 'hard') ? 44 : 52;
  const sizeJit  = (STATE.cfg.diff === 'hard') ? 18 : 22;
  const size = clamp(sizeBase + (STATE.rng()*sizeJit), 40, 76);

  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.position = 'absolute';

  const {x,y} = pickSpawnXY(size);
  el.style.left = `${Math.round(x - size/2)}px`;
  el.style.top  = `${Math.round(y - size/2)}px`;

  // lifetime
  const life = (STATE.cfg.diff === 'hard') ? 1150 : 1400; // ms
  const dieAt = performance.now() + life;

  const id = `t_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  el.dataset.tid = id;

  // click/tap hit
  el.addEventListener('pointerdown', (ev)=>{
    ev.preventDefault();
    ev.stopPropagation();
    hitTargetById(id);
  }, { passive:false });

  STATE.mount.appendChild(el);
  STATE.targets.set(id, { el, kind, groupIndex, dieAt, size });

  return id;
}

function expireSweep(){
  const now = performance.now();
  for(const [id, t] of STATE.targets){
    if(now >= t.dieAt){
      // expired
      STATE.targets.delete(id);
      try{ t.el.remove(); }catch{}
      if(t.kind === 'good') onExpireGood();
    }
  }
}

function hitTargetById(id){
  const t = STATE.targets.get(id);
  if(!t || !STATE.running || STATE.ended) return;

  STATE.targets.delete(id);
  try{ t.el.remove(); }catch{}

  if(t.kind === 'good') onHitGood(t.groupIndex);
  else onHitJunk();
}

function hitTestAtPoint(x,y,lockPx=28){
  // เลือกเป้าที่ใกล้จุดยิงที่สุดภายใน lockPx
  let bestId = null;
  let bestD = Infinity;

  for(const [id, t] of STATE.targets){
    const r = t.el.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top + r.height/2;
    const dx = cx - x;
    const dy = cy - y;
    const d = Math.hypot(dx, dy);
    if(d <= lockPx && d < bestD){
      bestD = d;
      bestId = id;
    }
  }

  if(bestId) hitTargetById(bestId);
}

function wireCrosshairShoot(){
  // vr-ui.js จะปล่อย event นี้: hha:shoot {x,y,lockPx,source}
  WIN.addEventListener('hha:shoot', (e)=>{
    const d = e.detail || {};
    const x = Number(d.x);
    const y = Number(d.y);
    const lockPx = clamp(d.lockPx ?? 28, 10, 80);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;
    hitTestAtPoint(x, y, lockPx);
  });
}

function startSpawning(){
  const base = (STATE.cfg.diff === 'hard') ? 520 : (STATE.cfg.diff === 'easy' ? 860 : 720);

  STATE.spawnTimer = setInterval(()=>{
    if(!STATE.running || STATE.ended) return;

    // spawn 1–2 ชิ้น/จังหวะ แบบนุ่ม ๆ
    const burst = (STATE.cfg.diff === 'hard') ? 2 : 1;
    for(let i=0;i<burst;i++){
      const isGood = STATE.rng() < 0.70;
      const gi = Math.floor(STATE.rng()*5);
      makeTarget(isGood ? 'good' : 'junk', gi);
    }

    expireSweep();
  }, base);
}

export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  STATE.mount = mount;
  STATE.cfg = cfg || {};
  STATE.running = true;
  STATE.ended = false;

  // reset
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

  // RNG: research/study => deterministic
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // เวลา: 70 เป็นค่าเริ่ม, ถ้าต้อง “สนุกขึ้น” แนะนำ 90 (เด็ก ป.5 มีเวลาทำ goal+mini ทัน)
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 70;

  // clean mount
  mount.innerHTML = '';
  STATE.targets.clear();

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  wireCrosshairShoot();
  emitQuest();
  startTimer();
  startSpawning();

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}