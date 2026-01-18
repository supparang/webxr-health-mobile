// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (spawn rate / junk ratio / size adjust)
//   - research/study: deterministic seed + adaptive OFF (stable)
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Boss/Storm hooks (optional UI fx toggles via ids)
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ FIX: mode-factory export mismatch + controller init issue
// ------------------------------------------------

'use strict';

// --------- (1) Optional mode-factory (safe import) ----------
let spawnBoot = null;
try{
  // Try named export boot
  // eslint-disable-next-line import/no-unresolved
  // @ts-ignore
  const mod = await import('../vr/mode-factory.js');
  spawnBoot = mod.boot || mod.createSpawner || mod.default || null;
}catch(e){
  // ignore, we'll fallback spawner
  spawnBoot = null;
}

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
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function now(){ return performance.now(); }

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

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
    sub:'เก็บอาหารให้ครบทุกหมู่',
    cur:0,
    target:5,
    done:false
  },
  mini:{
    name:'ความแม่นยำ',
    sub:'คุมความแม่น ≥ 80% (สรุปตอนท้าย)',
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

  // spawn system
  engine:null,
  mount:null,

  // adaptive knobs
  spawnEveryMs: 900,
  junkWeight: 0.30,
  sizeMin: 44,
  sizeMax: 64,

  // end / phases
  startedAtMs:0,
  panicOn:false,
  bossOn:false,
  stormOn:false,
};

/* ------------------------------------------------
 * UI / FX hooks (optional)
 * ------------------------------------------------ */
function setFx(id, cls, on){
  const el = DOC.getElementById(id);
  if(!el) return;
  if(on) el.classList.add(cls);
  else el.classList.remove(cls);
  // for older css that uses display:none
  if(id === 'bossFx' || id === 'stormFx'){
    el.style.display = (el.classList.contains('boss-on') || el.classList.contains('storm-on')) ? 'block' : 'none';
  }
}
function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * Scoring
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
  emitScore();
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
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  try{ clearInterval(STATE.timer); }catch{}

  // mini: evaluate at end (stable)
  const accPct = Math.round(accuracy()*100);
  STATE.mini.cur = accPct;
  STATE.mini.done = (accPct >= STATE.mini.target);

  emitQuest();

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,
    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,
    accuracyGoodPct: accPct,

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4]
  });

  // stop spawner
  try{ STATE.engine?.stop?.(); }catch{}
  try{ STATE.engine?.destroy?.(); }catch{}
}

/* ------------------------------------------------
 * Timer + phases (boss/storm/panic)
 * ------------------------------------------------ */
function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    // panic last 12s (เด็ก ป.5 ยังไหว)
    if(!STATE.panicOn && STATE.timeLeft <= 12){
      STATE.panicOn = true;
      setFx('bossFx','boss-panic', true);
      coach('ใกล้หมดเวลา! ตั้งสติ ยิงให้แม่น! ⏳', 'Coach');
    }

    // simple storm window (optional): 40-34s
    if(!STATE.stormOn && STATE.timeLeft === 40){
      STATE.stormOn = true;
      setFx('stormFx','storm-on', true);
      emit('hha:judge', { phase:'storm', on:true });
      coach('STORM! เป้าจะขยับไวขึ้น 🌪️', 'Coach');
      // storm: faster spawn + more junk (play only)
      if(STATE.cfg.runMode === 'play'){
        STATE.spawnEveryMs = Math.max(520, STATE.spawnEveryMs - 140);
        STATE.junkWeight = Math.min(0.45, STATE.junkWeight + 0.08);
      }
    }
    if(STATE.stormOn && STATE.timeLeft === 33){
      STATE.stormOn = false;
      setFx('stormFx','storm-on', false);
      emit('hha:judge', { phase:'storm', on:false });
      coach('พายุซาลงแล้ว 😮‍💨', 'Coach');
      // restore a bit
      if(STATE.cfg.runMode === 'play'){
        STATE.spawnEveryMs = Math.min(900, STATE.spawnEveryMs + 80);
        STATE.junkWeight = Math.max(0.30, STATE.junkWeight - 0.04);
      }
    }

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function updateGoal(){
  if(STATE.goal.done) return;
  // progress = number of groups collected at least 1
  STATE.goal.cur = STATE.g.filter(v=>v>0).length;
  if(STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach');
    // boss “finish flourish”
    setFx('bossFx','boss-on', true);
    setTimeout(()=>setFx('bossFx','boss-on', false), 900);
  }
}

function onHitGood(groupIndex){
  STATE.hitGood++;
  const gi = clamp(groupIndex, 0, 4);
  STATE.g[gi]++;

  addCombo();
  addScore(100 + STATE.combo * 6);

  // update mini progress (live display only)
  const accPct = Math.round(accuracy() * 100);
  STATE.mini.cur = accPct;

  updateGoal();
  emitQuest();

  // adaptive (play only): if doing well, slightly speed up
  if(STATE.cfg.runMode === 'play'){
    if(STATE.combo >= 6) STATE.spawnEveryMs = Math.max(520, STATE.spawnEveryMs - 10);
    if(accPct >= 85)     STATE.junkWeight  = Math.min(0.42, STATE.junkWeight + 0.005);
  }
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-60);

  // adaptive (play only): help a bit after mistake
  if(STATE.cfg.runMode === 'play'){
    STATE.spawnEveryMs = Math.min(980, STATE.spawnEveryMs + 30);
    STATE.junkWeight  = Math.max(0.25, STATE.junkWeight - 0.02);
  }

  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');
  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  // no score penalty but miss pressure
  emitQuest();
}

/* ------------------------------------------------
 * Target factory (fallback spawner)
 * ------------------------------------------------ */
const EMOJI_GOOD = ['🥦','🍎','🐟','🍚','🥑'];
const EMOJI_JUNK = ['🍟','🍩','🍔','🧋','🍭'];

function rectOf(el){
  const r = el.getBoundingClientRect();
  return {
    left:r.left, top:r.top, right:r.right, bottom:r.bottom,
    w:r.width, h:r.height
  };
}

function pickGroupIdx(){
  // bias toward missing groups for fun completion
  const missing = [];
  for(let i=0;i<5;i++) if(STATE.g[i] <= 0) missing.push(i);
  if(missing.length && STATE.rng() < 0.62){
    return missing[Math.floor(STATE.rng()*missing.length)];
  }
  return Math.floor(STATE.rng()*5);
}

function spawnOne(){
  const mount = STATE.mount;
  if(!mount || !STATE.running) return;

  const R = rectOf(mount);

  // safe margins so HUD doesn't block (top bigger)
  const padTop = 90 + Number(getComputedStyle(DOC.documentElement).getPropertyValue('--sat').replace('px','')||0);
  const padBot = 90 + Number(getComputedStyle(DOC.documentElement).getPropertyValue('--sab').replace('px','')||0);
  const padLR  = 14;

  const w = R.w, h = R.h;
  const xMin = R.left + padLR;
  const xMax = R.right - padLR;
  const yMin = R.top + padTop;
  const yMax = R.bottom - padBot;

  const size = Math.round(STATE.sizeMin + (STATE.sizeMax-STATE.sizeMin)*STATE.rng());

  const x = clamp(xMin + (xMax-xMin)*STATE.rng(), xMin, xMax) - size/2;
  const y = clamp(yMin + (yMax-yMin)*STATE.rng(), yMin, yMax) - size/2;

  const isJunk = (STATE.rng() < STATE.junkWeight);
  const el = DOC.createElement('button');
  el.type = 'button';
  el.className = 'plateTarget';
  el.dataset.kind = isJunk ? 'junk' : 'good';
  el.style.position = 'fixed';
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;
  el.style.width = `${size}px`;
  el.style.height= `${size}px`;
  el.style.lineHeight = '1';
  el.style.borderRadius = '999px';
  el.style.zIndex = '12';
  el.style.pointerEvents = 'auto';

  let groupIndex = 0;
  if(isJunk){
    el.textContent = EMOJI_JUNK[Math.floor(STATE.rng()*EMOJI_JUNK.length)];
  }else{
    groupIndex = pickGroupIdx();
    el.textContent = EMOJI_GOOD[groupIndex];
    el.dataset.group = String(groupIndex);
  }

  const born = now();
  const ttlMs = (STATE.cfg.runMode === 'play') ? 1700 : 1900;

  function kill(expired=false){
    if(!el.isConnected) return;
    el.remove();
    if(expired && !isJunk) onExpireGood();
  }

  // click/tap hit
  el.addEventListener('click', (ev)=>{
    ev.preventDefault();
    ev.stopPropagation();
    kill(false);
    if(isJunk) onHitJunk();
    else onHitGood(groupIndex);
  }, { passive:false });

  // auto expire
  const to = setInterval(()=>{
    if(!STATE.running){ clearInterval(to); kill(false); return; }
    if(now() - born >= ttlMs){
      clearInterval(to);
      kill(true);
    }
  }, 100);

  mount.appendChild(el);
}

function makeFallbackSpawner(){
  let t = null;
  function loop(){
    if(!STATE.running) return;
    spawnOne();
    t = setTimeout(loop, STATE.spawnEveryMs);
  }
  return {
    start(){
      if(t) return;
      t = setTimeout(loop, 120);
    },
    stop(){
      if(t){ clearTimeout(t); t = null; }
      // clear remaining targets
      try{
        STATE.mount?.querySelectorAll?.('.plateTarget')?.forEach(n=>n.remove());
      }catch{}
    },
    destroy(){ this.stop(); }
  };
}

/* ------------------------------------------------
 * Crosshair shoot integration (vr-ui.js)
 * ------------------------------------------------ */
function onShoot(e){
  if(!STATE.running) return;
  const d = e.detail || {};
  const x = Number(d.x ?? (innerWidth/2));
  const y = Number(d.y ?? (innerHeight/2));
  const el = DOC.elementFromPoint(x, y);
  if(!el) return;

  // prefer direct target
  if(el.classList?.contains('plateTarget')){
    el.click();
    return;
  }
  // if inner span inside button etc.
  const btn = el.closest?.('.plateTarget');
  if(btn) btn.click();
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // reset
  STATE.cfg = cfg || {};
  STATE.mount = mount;

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

  STATE.panicOn = false;
  STATE.bossOn = false;
  STATE.stormOn = false;

  // RNG
  const runMode = (cfg.runMode || cfg.run || 'play').toLowerCase();
  STATE.cfg.runMode = runMode;

  if(runMode === 'research' || runMode === 'study'){
    STATE.rng = seededRng(Number(cfg.seed) || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // duration: default 90 (เด็ก ป.5 จะได้มีเวลารู้สึก “เกมกำลังสนุกขึ้น”)
  STATE.timeLeft = Number(cfg.durationPlannedSec ?? cfg.time ?? 90) || 90;

  // base difficulty knobs
  const diff = (cfg.diff || 'normal').toLowerCase();
  STATE.cfg.diff = diff;

  if(diff === 'easy'){
    STATE.spawnEveryMs = 980;
    STATE.junkWeight = 0.24;
    STATE.sizeMin = 52;
    STATE.sizeMax = 72;
  }else if(diff === 'hard'){
    STATE.spawnEveryMs = 760;
    STATE.junkWeight = 0.34;
    STATE.sizeMin = 42;
    STATE.sizeMax = 62;
  }else{
    STATE.spawnEveryMs = 880;
    STATE.junkWeight = 0.30;
    STATE.sizeMin = 46;
    STATE.sizeMax = 66;
  }

  // research: freeze adaptive + reduce fx
  if(runMode === 'research' || runMode === 'study'){
    // keep deterministic experience
    // (no auto adaptive changes)
  }

  emit('hha:start', {
    game:'plate',
    runMode,
    diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitScore();
  emitQuest();

  // phases FX reset (if exists)
  setFx('bossFx','boss-on', false);
  setFx('bossFx','boss-panic', false);
  setFx('stormFx','storm-on', false);

  // hook shooting
  WIN.addEventListener('hha:shoot', onShoot);

  // start timer
  startTimer();

  // start spawner: try mode-factory, else fallback
  let engine = null;
  if(typeof spawnBoot === 'function'){
    try{
      engine = spawnBoot({
        mount,
        seed: Number(cfg.seed) || Date.now(),
        // pass some knobs if mode-factory supports
        spawnRate: STATE.spawnEveryMs,
        sizeRange:[STATE.sizeMin, STATE.sizeMax],
        kinds:[
          { kind:'good', weight:(1-STATE.junkWeight) },
          { kind:'junk', weight:STATE.junkWeight }
        ],
        onHit:(t)=>{
          if(!t) return;
          if(t.kind === 'good'){
            const gi = (t.groupIndex ?? (Math.floor(STATE.rng()*5)));
            onHitGood(gi);
          }else{
            onHitJunk();
          }
        },
        onExpire:(t)=>{
          if(t && t.kind === 'good') onExpireGood();
        }
      });
    }catch(err){
      console.warn('[PlateVR] mode-factory failed, fallback spawner', err);
      engine = null;
    }
  }

  if(!engine){
    engine = makeFallbackSpawner();
  }

  STATE.engine = engine;

  // run
  try{ STATE.engine.start?.(); }catch{}
  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
}