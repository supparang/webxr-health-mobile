// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard (Plate)
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON + fun phases ON (boss/storm/shield)
//   - research/study: deterministic seed + adaptive OFF + fun phases OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot) — optional
// ✅ SPAWNER:
//   - Try to use ../vr/mode-factory.js if available
//   - Fallback spawner if mode-factory import is incompatible / crashes
// ------------------------------------------------

'use strict';

// IMPORTANT:
// We intentionally import the module namespace and pick the best export at runtime.
// This avoids: "does not provide an export named 'boot'".
// mode-factory.js in your repo has evolved (export names may differ).
import * as ModeFactory from '../vr/mode-factory.js';

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
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

function nowMs(){ return (performance?.now ? performance.now() : Date.now()); }

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * Engine state
 * ------------------------------------------------ */
const STATE = {
  running:false,
  ended:false,

  // scoring
  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  // time
  timeLeft:0,
  timer:null,
  tStartMs:0,

  // plate groups (5 หมู่): index 0-4
  g:[0,0,0,0,0],

  // hit counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,
  shots:0,

  // quest
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

  // cfg/mode
  cfg:null,
  rng:Math.random,

  // phases (A+B+C)
  bossOn:false,
  stormOn:false,
  shield:0,
  fever:0,              // 0..100
  lastHitMs:0,
  lastMissMs:0,

  // spawner runtime
  mount:null,
  spawner:null,         // returned object from mode-factory OR fallback
  destroyFns:[],

  // difficulty control
  spawnIntervalMs:900,
  sizeRange:[44,64],
  pGood:0.70,
  pJunk:0.30,
  pShield:0.00,         // only when enabled

  // fallback target pool
  EMOJI_GOOD:[
    // each group can have multiple icons to avoid “น่าเบื่อ”
    ['🥦','🥬','🥒','🥕'],      // veg
    ['🍎','🍌','🍇','🍉'],      // fruit
    ['🐟','🍗','🥚','🦐'],      // protein
    ['🍚','🍞','🥔','🍜'],      // carbs
    ['🥑','🥜','🧀','🫒']       // fats/dairy
  ],
  EMOJI_JUNK:['🍟','🍩','🍰','🍬','🥤','🍔'],
  EMOJI_SHIELD:['🛡️','✨']
};

/* ------------------------------------------------
 * Accuracy + grade
 * ------------------------------------------------ */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function gradeFrom(accPct, miss){
  // simple, stable grading
  if(accPct >= 92 && miss <= 1) return 'SSS';
  if(accPct >= 88 && miss <= 2) return 'SS';
  if(accPct >= 82 && miss <= 4) return 'S';
  if(accPct >= 75) return 'A';
  if(accPct >= 65) return 'B';
  return 'C';
}

/* ------------------------------------------------
 * Emit score/time/quest
 * ------------------------------------------------ */
function emitScore(){
  emit('hha:score', { score: STATE.score, combo: STATE.combo, comboMax: STATE.comboMax, miss: STATE.miss });
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
    allDone: STATE.goal.done && STATE.mini.done,

    // extra (optional for HUDs that show it)
    g: STATE.g.slice(),
    fever: STATE.fever,
    shield: STATE.shield,
    accPct: Math.round(accuracy()*100)
  });
}

/* ------------------------------------------------
 * A+B+C Visual FX hooks (optional)
 * ------------------------------------------------ */
function setBossFx(on, panic=false){
  const el = DOC.getElementById('bossFx');
  if(!el) return;
  el.classList.toggle('boss-on', !!on);
  el.classList.toggle('boss-panic', !!panic);
  el.style.display = on ? 'block' : 'none';
}
function setStormFx(on){
  const el = DOC.getElementById('stormFx');
  if(!el) return;
  el.classList.toggle('storm-on', !!on);
  el.style.display = on ? 'block' : 'none';
}

/* ------------------------------------------------
 * Score helpers
 * ------------------------------------------------ */
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
 * Fever/Shield mechanics (fun, but research OFF)
 * ------------------------------------------------ */
function feverGain(amount){
  STATE.fever = clamp(STATE.fever + (Number(amount)||0), 0, 100);
}
function feverDecay(){
  // slow decay each second
  STATE.fever = clamp(STATE.fever - 4, 0, 100);
}
function isFever(){
  return STATE.fever >= 100;
}
function giveShield(n=1){
  STATE.shield = clamp(STATE.shield + (Number(n)||1), 0, 9);
  coach('ได้โล่แล้ว! 🛡️', 'Power');
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  try{ clearInterval(STATE.timer); }catch{}
  STATE.timer = null;

  // cleanup spawner
  try{ STATE.spawner?.stop?.(); }catch{}
  try{ STATE.spawner?.destroy?.(); }catch{}
  for(const fn of STATE.destroyFns){ try{ fn(); }catch{} }
  STATE.destroyFns.length = 0;

  // end payload
  const accPct = Math.round(accuracy()*100);
  const g = gradeFrom(accPct, STATE.miss);

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,
    accuracyGoodPct: accPct,
    grade: g,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    g1: STATE.g[0], g2: STATE.g[1], g3: STATE.g[2], g4: STATE.g[3], g5: STATE.g[4],
    shots: STATE.shots,
    hitGood: STATE.hitGood,
    hitJunk: STATE.hitJunk,
    expireGood: STATE.expireGood,

    runMode: STATE.cfg?.runMode || '',
    diff: STATE.cfg?.diff || '',
    seed: STATE.cfg?.seed || 0,
    durationPlannedSec: STATE.cfg?.durationPlannedSec || 0
  });

  // turn off fx
  setBossFx(false,false);
  setStormFx(false);
}

/* ------------------------------------------------
 * Timer
 * ------------------------------------------------ */
function startTimer(){
  emitTime();
  STATE.timer = setInterval(()=>{
    if(!STATE.running || STATE.ended) return;

    // tick time
    STATE.timeLeft--;
    feverDecay();
    emitTime();
    emitQuest();

    if(STATE.timeLeft <= 0){
      endGame('timeup');
      return;
    }

    // phase scheduling (play only)
    maybeUpdatePhases();

  }, 1000);
}

/* ------------------------------------------------
 * Phases A+B+C (Boss/Storm/Shield)
 * ------------------------------------------------ */
function phasesEnabled(){
  const m = (STATE.cfg?.runMode||'play').toLowerCase();
  return (m === 'play'); // research/study OFF
}

function maybeUpdatePhases(){
  if(!phasesEnabled()) return;

  const t = STATE.timeLeft;

  // Storm: middle window (e.g., last 55..35 sec)
  const stormShould = (t <= 55 && t >= 35);

  if(stormShould !== STATE.stormOn){
    STATE.stormOn = stormShould;
    setStormFx(STATE.stormOn);
    coach(STATE.stormOn ? 'พายุมาแล้ว! เป้าจะไวขึ้น 🌪️' : 'พายุสงบแล้ว 👍', 'Phase');
    // adjust spawn speed
    if(STATE.stormOn) STATE.spawnIntervalMs = Math.max(520, STATE.spawnIntervalMs - 180);
    else STATE.spawnIntervalMs = baseSpawnInterval();
    // propagate to spawner
    try{ STATE.spawner?.setRate?.(STATE.spawnIntervalMs); }catch{}
  }

  // Boss: last 18 sec
  const bossShould = (t <= 18);

  if(bossShould !== STATE.bossOn){
    STATE.bossOn = bossShould;
    setBossFx(STATE.bossOn, false);
    coach(STATE.bossOn ? 'บอสมา! ระวังของหวาน/ทอด 👹' : 'ผ่านบอสแล้ว!', 'Boss');
    // make junk more likely during boss
    if(STATE.bossOn){
      STATE.pGood = 0.60;
      STATE.pJunk = 0.35;
      STATE.pShield = 0.05;
    }else{
      resetSpawnMix();
    }
    try{ STATE.spawner?.setMix?.({ pGood:STATE.pGood, pJunk:STATE.pJunk, pShield:STATE.pShield }); }catch{}
  }

  // Boss panic flash when miss spikes
  if(STATE.bossOn){
    const panic = (nowMs() - STATE.lastMissMs) < 700;
    setBossFx(true, panic);
  }
}

function baseSpawnInterval(){
  const d = (STATE.cfg?.diff || 'normal').toLowerCase();
  if(d === 'easy') return 980;
  if(d === 'hard') return 740;
  return 900;
}

function resetSpawnMix(){
  STATE.pGood = 0.70;
  STATE.pJunk = 0.28;
  STATE.pShield = 0.02;
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex, emojiUsed){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();

  // fever rewards
  feverGain(8 + Math.min(18, STATE.combo * 0.6));

  // score
  const feverMult = isFever() ? 1.35 : 1.0;
  addScore(Math.round((100 + STATE.combo * 6) * feverMult));

  // optional particles
  try{ WIN.Particles?.burst?.(emojiUsed || '✨'); }catch{}

  // goal: number of distinct groups collected
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Goal');
    }
  }

  // mini: accuracy
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'Mini');
  }

  STATE.lastHitMs = nowMs();
  emitQuest();
  emitScore();
}

function onHitJunk(emojiUsed){
  STATE.hitJunk++;

  // shield blocks miss (เหมือน GoodJunk standard: shield block = no miss)
  if(STATE.shield > 0){
    STATE.shield--;
    coach('โล่กันไว้! 🛡️', 'Shield');
    try{ WIN.Particles?.popText?.(innerWidth/2, innerHeight*0.55, 'BLOCK', ''); }catch{}
    emitQuest();
    return;
  }

  STATE.miss++;
  STATE.lastMissMs = nowMs();

  resetCombo();
  feverGain(-18);

  addScore(-60);
  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Warn');
  try{ WIN.Particles?.burst?.(emojiUsed || '💥'); }catch{}
  emitQuest();
  emitScore();
}

function onHitShield(){
  giveShield(1);
  addScore(25);
  emitQuest();
  emitScore();
}

function onExpireGood(){
  STATE.expireGood++;

  // expire counts as miss (ตาม HHA: good expired + junk hit = miss)
  STATE.miss++;
  STATE.lastMissMs = nowMs();

  resetCombo();
  feverGain(-10);

  emitQuest();
  emitScore();
}

/* ------------------------------------------------
 * Target creation (fallback)
 * ------------------------------------------------ */
function pickGood(){
  // pick group index and emoji
  const gi = Math.floor(STATE.rng() * 5);
  const arr = STATE.EMOJI_GOOD[gi] || ['🥦'];
  const em = arr[Math.floor(STATE.rng()*arr.length)] || arr[0];
  return { gi, emoji: em };
}

function pickJunk(){
  const arr = STATE.EMOJI_JUNK;
  return arr[Math.floor(STATE.rng()*arr.length)] || '🍟';
}

function pickShield(){
  const arr = STATE.EMOJI_SHIELD;
  return arr[Math.floor(STATE.rng()*arr.length)] || '🛡️';
}

/* ------------------------------------------------
 * Spawner — ModeFactory (preferred) or fallback
 * ------------------------------------------------ */
function resolveModeFactoryBoot(){
  // Try common export names safely
  const cand = [
    ModeFactory.boot,
    ModeFactory.createSpawner,
    ModeFactory.spawnBoot,
    ModeFactory.default
  ].filter(Boolean);

  // We accept a function; if default is object, ignore.
  for(const c of cand){
    if(typeof c === 'function') return c;
  }
  return null;
}

function makeSpawnerWithModeFactory(mount){
  const fn = resolveModeFactoryBoot();
  if(!fn) return null;

  // We call it in a try/catch so any internal controller init issues won't crash Plate.
  // Also: we DO NOT reference any "controller" variable here.
  try{
    const sp = fn({
      mount,
      seed: STATE.cfg.seed,
      spawnRate: STATE.spawnIntervalMs,
      sizeRange: STATE.sizeRange,

      // support old/new keys
      kinds: [
        { kind:'good',   weight: STATE.pGood },
        { kind:'junk',   weight: STATE.pJunk },
        { kind:'shield', weight: STATE.pShield }
      ],

      onHit:(t)=>{
        const kind = (t?.kind || t?.dataKind || t?.type || '').toLowerCase();
        if(kind === 'good'){
          const gi = (typeof t.groupIndex === 'number') ? t.groupIndex : Math.floor(STATE.rng()*5);
          onHitGood(clamp(gi,0,4), t.emoji);
        }else if(kind === 'shield'){
          onHitShield();
        }else{
          onHitJunk(t.emoji);
        }
      },
      onExpire:(t)=>{
        const kind = (t?.kind || t?.dataKind || '').toLowerCase();
        if(kind === 'good') onExpireGood();
      }
    });

    // Optional control methods adapter
    const api = {
      stop: ()=>{ try{ sp?.stop?.(); }catch{} },
      destroy: ()=>{ try{ sp?.destroy?.(); }catch{} },
      setRate: (ms)=>{
        STATE.spawnIntervalMs = clamp(ms, 420, 1500);
        try{ sp?.setRate?.(STATE.spawnIntervalMs); }catch{}
        try{ sp?.setConfig?.({ spawnRate: STATE.spawnIntervalMs }); }catch{}
      },
      setMix: ({pGood,pJunk,pShield})=>{
        if(typeof pGood==='number') STATE.pGood=pGood;
        if(typeof pJunk==='number') STATE.pJunk=pJunk;
        if(typeof pShield==='number') STATE.pShield=pShield;
        try{ sp?.setMix?.({ pGood:STATE.pGood, pJunk:STATE.pJunk, pShield:STATE.pShield }); }catch{}
        try{ sp?.setConfig?.({ kinds:[
          { kind:'good', weight:STATE.pGood },
          { kind:'junk', weight:STATE.pJunk },
          { kind:'shield', weight:STATE.pShield }
        ]}); }catch{}
      }
    };

    return api;

  }catch(err){
    console.warn('[PlateVR] ModeFactory failed, fallback spawner used:', err);
    return null;
  }
}

function makeFallbackSpawner(mount){
  let alive = true;

  const playRect = ()=> {
    // spawn within mount rect (not whole screen)
    const r = mount.getBoundingClientRect();
    const pad = 12;
    return {
      x0: r.left + pad,
      y0: r.top  + pad,
      x1: r.right - pad,
      y1: r.bottom - pad
    };
  };

  function spawnOne(){
    if(!alive || !STATE.running || STATE.ended) return;

    // decide kind by weights
    const r = STATE.rng();
    let kind = 'good';
    const pS = (phasesEnabled() ? STATE.pShield : 0);
    const pJ = (phasesEnabled() ? STATE.pJunk : 0.28);
    const pG = Math.max(0.05, 1 - pJ - pS);

    if(r < pS) kind = 'shield';
    else if(r < pS + pJ) kind = 'junk';
    else kind = 'good';

    const rect = playRect();
    const sMin = STATE.sizeRange[0], sMax = STATE.sizeRange[1];
    const size = Math.round(sMin + STATE.rng()*(sMax - sMin));

    const x = rect.x0 + STATE.rng() * Math.max(10, (rect.x1 - rect.x0));
    const y = rect.y0 + STATE.rng() * Math.max(10, (rect.y1 - rect.y0));

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    let gi = 0;
    let emoji = '🥦';

    if(kind === 'good'){
      const p = pickGood();
      gi = p.gi; emoji = p.emoji;
      el.dataset.groupIndex = String(gi);
    }else if(kind === 'junk'){
      emoji = pickJunk();
    }else{
      emoji = pickShield();
    }

    el.textContent = emoji;
    el.style.position = 'fixed';
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';
    el.style.zIndex = '20';

    const ttl = clamp(phasesEnabled() ? (STATE.bossOn ? 850 : 1200) : 1200, 650, 1800);

    const kill = ()=>{
      if(!el.isConnected) return;
      el.remove();
    };

    const expireTO = setTimeout(()=>{
      if(!alive) return;
      if(kind === 'good') onExpireGood();
      kill();
    }, ttl);

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      clearTimeout(expireTO);
      kill();

      if(kind === 'good'){
        onHitGood(gi, emoji);
      }else if(kind === 'shield'){
        onHitShield();
      }else{
        onHitJunk(emoji);
      }
    }, { passive:false });

    mount.appendChild(el);
  }

  let tickTO = null;
  function loop(){
    if(!alive) return;
    spawnOne();
    const base = STATE.spawnIntervalMs;
    // add small jitter to feel alive, deterministic when rng is seeded
    const jitter = Math.round((STATE.rng() - 0.5) * 140);
    const next = clamp(base + jitter, 420, 1400);
    tickTO = setTimeout(loop, next);
  }

  loop();

  return {
    stop: ()=>{
      alive = false;
      try{ clearTimeout(tickTO); }catch{}
    },
    destroy: ()=>{
      alive = false;
      try{ clearTimeout(tickTO); }catch{}
      // cleanup any remaining targets
      try{
        const nodes = mount.querySelectorAll('.plateTarget');
        nodes.forEach(n=>n.remove());
      }catch{}
    },
    setRate: (ms)=>{
      STATE.spawnIntervalMs = clamp(ms, 420, 1500);
    },
    setMix: ({pGood,pJunk,pShield})=>{
      if(typeof pGood==='number') STATE.pGood=pGood;
      if(typeof pJunk==='number') STATE.pJunk=pJunk;
      if(typeof pShield==='number') STATE.pShield=pShield;
    }
  };
}

/* ------------------------------------------------
 * Input from vr-ui.js (hha:shoot) — optional
 * ------------------------------------------------ */
function wireShoot(mount){
  // If vr-ui dispatches hha:shoot, we can raycast in 2D by finding nearest target
  // within lockPx, to allow cVR shooting from crosshair.
  const onShoot = (e)=>{
    if(!STATE.running || STATE.ended) return;
    const d = e.detail || {};
    const x = Number(d.x);
    const y = Number(d.y);
    const lockPx = clamp(d.lockPx ?? 28, 8, 120);

    // If x,y not provided, use center
    const px = (isFinite(x) ? x : innerWidth/2);
    const py = (isFinite(y) ? y : innerHeight/2);

    STATE.shots++;

    let best = null;
    let bestDist = 1e9;

    const nodes = mount.querySelectorAll('.plateTarget');
    nodes.forEach((el)=>{
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const dx = cx - px;
      const dy = cy - py;
      const dist = Math.hypot(dx,dy);
      if(dist < bestDist){
        bestDist = dist;
        best = el;
      }
    });

    if(best && bestDist <= lockPx){
      // simulate hit
      best.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, cancelable:true }));
    }
  };

  WIN.addEventListener('hha:shoot', onShoot);
  STATE.destroyFns.push(()=> WIN.removeEventListener('hha:shoot', onShoot));
}

/* ------------------------------------------------
 * Adaptive tuning (play only)
 * ------------------------------------------------ */
function adaptiveEnabled(){
  return (STATE.cfg?.runMode || 'play').toLowerCase() === 'play';
}

function applyAdaptive(){
  if(!adaptiveEnabled()) return;

  const acc = accuracy() * 100;
  const miss = STATE.miss;

  // if doing well -> faster spawns, a bit smaller
  if(acc >= 86 && miss <= 2){
    STATE.spawnIntervalMs = clamp(baseSpawnInterval() - 140, 520, 1100);
    STATE.sizeRange = [42, 60];
    STATE.pJunk = clamp(STATE.pJunk + 0.02, 0.26, 0.40);
  }
  // struggling -> slower spawns, a bit bigger
  else if(acc <= 70 || miss >= 6){
    STATE.spawnIntervalMs = clamp(baseSpawnInterval() + 160, 620, 1250);
    STATE.sizeRange = [48, 70];
    STATE.pJunk = clamp(STATE.pJunk - 0.02, 0.18, 0.32);
  }else{
    STATE.spawnIntervalMs = baseSpawnInterval();
    STATE.sizeRange = [44, 64];
  }

  // shield chance gentle in play
  STATE.pShield = phasesEnabled() ? 0.02 : 0.0;

  try{ STATE.spawner?.setRate?.(STATE.spawnIntervalMs); }catch{}
  try{ STATE.spawner?.setMix?.({ pGood:STATE.pGood, pJunk:STATE.pJunk, pShield:STATE.pShield }); }catch{}
}

/* ------------------------------------------------
 * MAIN boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');
  STATE.mount = mount;

  STATE.cfg = cfg || {};
  const runMode = (cfg?.runMode || 'play').toLowerCase();

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
  STATE.shots = 0;

  STATE.g = [0,0,0,0,0];

  STATE.goal.cur = 0; STATE.goal.done = false;
  STATE.mini.cur = 0; STATE.mini.done = false;

  STATE.bossOn = false;
  STATE.stormOn = false;
  STATE.shield = 0;
  STATE.fever = 0;
  STATE.lastHitMs = 0;
  STATE.lastMissMs = 0;

  // base tuning
  STATE.spawnIntervalMs = baseSpawnInterval();
  STATE.sizeRange = [44,64];
  resetSpawnMix();

  // RNG
  if(runMode === 'research' || runMode === 'study'){
    STATE.rng = seededRng(Number(cfg?.seed) || Date.now());
    // research: disable phases + adaptive
    STATE.pShield = 0.0;
    STATE.pJunk = 0.30;
    STATE.pGood = 0.70;
  }else{
    STATE.rng = Math.random;
  }

  // duration
  STATE.timeLeft = clamp(cfg?.durationPlannedSec ?? 90, 10, 999);
  STATE.tStartMs = nowMs();

  emit('hha:start', {
    game:'plate',
    runMode: cfg?.runMode,
    diff: cfg?.diff,
    seed: cfg?.seed,
    durationPlannedSec: STATE.timeLeft
  });

  // wire shoot for cVR crosshair assist
  wireShoot(mount);

  // initial HUD
  emitScore();
  emitTime();
  emitQuest();

  // spawner: try mode-factory; fallback if anything fails
  const mf = makeSpawnerWithModeFactory(mount);
  STATE.spawner = mf || makeFallbackSpawner(mount);

  // timer
  try{ clearInterval(STATE.timer); }catch{}
  startTimer();

  // kickoff
  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Start');

  // periodic adaptive check (play only)
  if(adaptiveEnabled()){
    const id = setInterval(()=>{
      if(!STATE.running || STATE.ended) return;
      applyAdaptive();
    }, 1500);
    STATE.destroyFns.push(()=> clearInterval(id));
  }

  // ensure phases update at least once
  maybeUpdatePhases();
}