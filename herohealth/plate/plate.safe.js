// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION+)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Uses mode-factory.js (DOM target spawner) + hha:shoot from vr-ui.js
// ✅ Supports Boss/Storm FX layers via class toggles (#bossFx/#stormFx)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

const WIN = window;
const DOC = document;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

function seededRng(seed){
  let t = (Number(seed) || Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pct(n){
  n = Number(n) || 0;
  return Math.round(n * 100) / 100;
}

function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch{ return def; }
}

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

function setFx(id, cls, on){
  const el = DOC.getElementById(id);
  if(!el) return;
  if(on) el.classList.add(cls);
  else el.classList.remove(cls);
}

function nowMs(){ return Date.now(); }

// ------------------------------------------------------------
// Emoji set (shared feel + not boring)
// ------------------------------------------------------------
const EMOJI = {
  g1_veg : ['🥦','🥕','🥬','🥒','🍅','🫑','🌽'],
  g2_fru : ['🍎','🍌','🍊','🍇','🍉','🍍','🍓'],
  g3_pro : ['🐟','🍗','🥚','🫘','🧀','🥜'],
  g4_grn : ['🍚','🍞','🥖','🍜','🥔','🥟'],
  g5_fat : ['🥑','🫒','🥥','🌰','🧈'],
  junk   : ['🍩','🍟','🍔','🍕','🥤','🍫','🍬','🧁'],
  shield : ['🛡️']
};

function pick(rng, arr){
  if(!arr || !arr.length) return '🍽️';
  return arr[Math.floor(rng() * arr.length)];
}

function groupLabel(i){
  // 0..4
  return ['ผัก','ผลไม้','โปรตีน','ข้าวแป้ง','ไขมันดี'][i] || '';
}

function groupEmoji(rng, gi){
  if(gi === 0) return pick(rng, EMOJI.g1_veg);
  if(gi === 1) return pick(rng, EMOJI.g2_fru);
  if(gi === 2) return pick(rng, EMOJI.g3_pro);
  if(gi === 3) return pick(rng, EMOJI.g4_grn);
  if(gi === 4) return pick(rng, EMOJI.g5_fat);
  return '🥗';
}

// ------------------------------------------------------------
// Engine state
// ------------------------------------------------------------
const STATE = {
  running:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  timeLeft:0,
  timer:null,
  startedAt:0,

  // plate groups counts (5 หมู่)
  g:[0,0,0,0,0],

  // totals
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // shield
  shield:0,

  // quest
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอย่างน้อย 1 อย่างต่อหมู่',
    cur:0,
    target:5,
    done:false
  },
  mini:{
    name:'เก็บเร็ว!',
    sub:'เก็บ “หมู่ที่ยังขาด” ให้ได้ 3 ครั้งภายในเวลา',
    cur:0,
    target:3,
    done:false,
    timeLeft:0,
    timeTotal:18,
    active:true
  },

  // mode / cfg / rng
  cfg:null,
  rng:Math.random,

  // spawn engine
  spawner:null,

  // adaptive knobs (play only)
  spawnRateMs:900,
  ttlMs:1900,

  // boss/storm
  stormOn:false,
  bossOn:false
};

// ------------------------------------------------------------
// Metrics
// ------------------------------------------------------------
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
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
      sub: `${STATE.mini.sub} (เหลือ ${STATE.mini.timeLeft}s)`,
      cur: STATE.mini.cur,
      target: STATE.mini.target,
      done: STATE.mini.done
    },
    allDone: STATE.goal.done && STATE.mini.done
  });
}

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

// ------------------------------------------------------------
// Difficulty/adaptive (play only)
// ------------------------------------------------------------
function isResearch(){
  const m = (STATE.cfg?.runMode || '').toLowerCase();
  return (m === 'research' || m === 'study');
}

function applyAdaptive(){
  // Only in play mode
  if(isResearch()) return;

  // basic: if accuracy high -> faster; if low or misses rising -> slower
  const acc = accuracy();
  const miss = STATE.miss;

  // base by diff
  const diff = (STATE.cfg?.diff || 'normal').toLowerCase();
  let baseRate = (diff === 'hard') ? 760 : (diff === 'easy' ? 980 : 880);
  let baseTtl  = (diff === 'hard') ? 1650 : (diff === 'easy' ? 2150 : 1900);

  // adjust
  if(acc >= 0.86 && miss <= 3){
    baseRate -= 90; // faster spawns
    baseTtl  -= 120;
  }else if(acc < 0.72 || miss >= 6){
    baseRate += 120;
    baseTtl  += 180;
  }

  STATE.spawnRateMs = clamp(baseRate, 520, 1200);
  STATE.ttlMs = clamp(baseTtl, 1200, 2600);
}

// ------------------------------------------------------------
// End game
// ------------------------------------------------------------
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);

  // stop spawner
  try{ STATE.spawner?.stop?.(); }catch(_){}
  try{ STATE.spawner?.destroy?.(); }catch(_){}

  // turn off fx
  setFx('stormFx','storm-on',false);
  setFx('bossFx','boss-on',false);
  setFx('bossFx','boss-panic',false);

  emit('hha:end', {
    reason,
    game:'plate',

    runMode: STATE.cfg?.runMode || '',
    diff: STATE.cfg?.diff || '',
    seed: STATE.cfg?.seed,

    durationPlannedSec: STATE.cfg?.durationPlannedSec ?? 0,
    durationPlayedSec: Math.max(0, Math.round((nowMs() - STATE.startedAt)/1000)),

    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: pct(accuracy() * 100),

    // for sheet mapping compatibility
    nHitGood: STATE.hitGood,
    nHitJunk: STATE.hitJunk,
    nExpireGood: STATE.expireGood,

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],
    gTotal: STATE.g.reduce((a,b)=>a+b,0),

    shieldLeft: STATE.shield
  });
}

// ------------------------------------------------------------
// Timer tick
// ------------------------------------------------------------
function startTimer(){
  emitTime();

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    STATE.timeLeft--;
    emitTime();

    // mini countdown
    if(!STATE.mini.done && STATE.mini.active){
      STATE.mini.timeLeft = Math.max(0, STATE.mini.timeLeft - 1);
      if(STATE.mini.timeLeft <= 0){
        // mini failed -> still keep playing
        STATE.mini.active = false;
        coach('Mini Quest หมดเวลาแล้ว 😅 ลองทำเป้าหลักให้ผ่าน!', 'Coach');
      }
      emitQuest();
    }

    // storm/boss demo hooks (simple)
    // storm: last 25% time
    if(!isResearch()){
      if(STATE.timeLeft === Math.floor((STATE.cfg.durationPlannedSec||90) * 0.25)){
        STATE.stormOn = true;
        setFx('stormFx','storm-on',true);
        coach('🌪️ Storm! เป้าจะไวขึ้นนิดนึง!', 'System');
        // push difficulty a bit
        STATE.spawnRateMs = clamp(STATE.spawnRateMs - 80, 520, 1200);
        STATE.ttlMs = clamp(STATE.ttlMs - 100, 1200, 2600);
        try{ restartSpawner(); }catch(_){}
      }
      // boss: last 10% time
      if(STATE.timeLeft === Math.floor((STATE.cfg.durationPlannedSec||90) * 0.10)){
        STATE.bossOn = true;
        setFx('bossFx','boss-on',true);
        coach('👹 Boss Rush! โดน junk จะหนักขึ้น!', 'System');
      }
    }

    if(STATE.timeLeft <= 0) endGame('timeup');
  }, 1000);
}

// ------------------------------------------------------------
// Hit logic
// ------------------------------------------------------------
function addScore(v){
  STATE.score += v;
  emitScore();
}

function addCombo(){
  STATE.combo++;
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
}

function resetCombo(){
  STATE.combo = 0;
}

function updateGoal(){
  if(STATE.goal.done) return;
  STATE.goal.cur = STATE.g.filter(v => v > 0).length;
  if(STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('🎉 ครบ 5 หมู่แล้ว! เหลือทำ Mini/เก็บแต้มเพิ่ม!', 'Coach');
  }
}

function updateMiniOnGoodHit(gi){
  if(STATE.mini.done || !STATE.mini.active) return;

  // reward: only counts if you hit a missing group
  if(STATE.g[gi] === 1){ // first time of that group => was missing
    STATE.mini.cur++;
    if(STATE.mini.cur >= STATE.mini.target){
      STATE.mini.done = true;
      coach('⚡ Mini Quest ผ่าน! เก็บได้เร็วมาก!', 'Coach');
      // small reward
      addScore(250);
    }
  }
}

function onHitGood(gi){
  STATE.hitGood++;
  STATE.g[gi]++;

  addCombo();
  // reward grows with combo
  addScore(100 + Math.min(80, STATE.combo * 6));

  updateMiniOnGoodHit(gi);
  updateGoal();
  applyAdaptive();
  emitQuest();

  // celebrate soft when both done
  if(STATE.goal.done && STATE.mini.done){
    emit('hha:judge', { grade:'S', tag:'ALL_DONE' });
  }

  // restart spawner when adaptive changes noticeably
  if(!isResearch()){
    // cheap rule: every 5 good hits
    if(STATE.hitGood % 5 === 0) restartSpawner();
  }
}

function onHitJunk(){
  STATE.hitJunk++;

  // shield blocks miss
  if(STATE.shield > 0){
    STATE.shield--;
    coach('🛡️ Shield ป้องกันความพลาด!', 'Coach');
    // tiny penalty
    resetCombo();
    addScore(-10);
    emitQuest();
    return;
  }

  STATE.miss++;
  resetCombo();

  let penalty = -60;
  if(STATE.bossOn) penalty = -90; // boss makes it spicier
  addScore(penalty);

  // panic flash
  setFx('bossFx','boss-panic', true);
  setTimeout(()=>setFx('bossFx','boss-panic', false), 260);

  coach('⚠️ เลี่ยงของหวาน/ทอดนะ!', 'Coach');
  applyAdaptive();
  emitQuest();

  // optional fail condition for play only (soft)
  if(!isResearch() && STATE.miss >= 12){
    endGame('miss-limit');
  }
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  applyAdaptive();
  emitQuest();
}

// ------------------------------------------------------------
// Spawner wiring
// ------------------------------------------------------------
function buildKinds(){
  // Good: choose missing group more often to feel “smart”
  // Junk ratio by diff
  const diff = (STATE.cfg?.diff || 'normal').toLowerCase();
  const junkW = (diff === 'hard') ? 0.38 : (diff === 'easy' ? 0.22 : 0.30);
  const goodW = 1 - junkW;

  // pick a group each spawn (we attach groupIndex + emoji)
  return [
    { kind:'good',  weight:goodW },
    { kind:'junk',  weight:junkW }
  ];
}

function chooseGoodGroupIndex(){
  // bias towards missing groups
  const missing = [];
  for(let i=0;i<5;i++) if(STATE.g[i] <= 0) missing.push(i);
  if(missing.length){
    return missing[Math.floor(STATE.rng() * missing.length)];
  }
  return Math.floor(STATE.rng() * 5);
}

function restartSpawner(){
  if(!STATE.running) return;
  try{ STATE.spawner?.stop?.(); }catch(_){}
  try{ STATE.spawner?.destroy?.(); }catch(_){}

  const mount = DOC.getElementById('plate-layer');
  const boundsHost = DOC.getElementById('plate-bounds') || null;

  STATE.spawner = spawnBoot({
    mount,
    boundsHost, // ✅ key for no HUD overlap
    seed: STATE.cfg.seed,
    spawnRate: STATE.spawnRateMs,
    ttlMs: STATE.ttlMs,
    maxAlive: 10,
    sizeRange: [44, 66],
    kinds: buildKinds(),

    makeTarget: (t, el)=>{
      if(t.kind === 'good'){
        const gi = chooseGoodGroupIndex();
        t.groupIndex = gi;
        t.label = groupEmoji(STATE.rng, gi);
        el.title = `หมู่${gi+1} ${groupLabel(gi)}`;
      }else{
        t.label = pick(STATE.rng, EMOJI.junk);
        el.title = 'Junk';
      }
    },

    onHit: (t)=>{
      if(t.kind === 'good'){
        const gi = clamp(t.groupIndex ?? 0, 0, 4);
        onHitGood(gi);
      }else{
        onHitJunk();
      }
    },

    onExpire: (t)=>{
      if(t.kind === 'good') onExpireGood();
    }
  });
}

function ensureBoundsHost(){
  // If user hasn't added #plate-bounds in HTML,
  // create a default safe play rect programmatically.
  if(DOC.getElementById('plate-bounds')) return;

  const hud = DOC.getElementById('hud');
  const mount = DOC.getElementById('plate-layer');
  if(!mount) return;

  const b = DOC.createElement('div');
  b.id = 'plate-bounds';
  b.style.cssText = `
    position:fixed; inset:0;
    pointer-events:none;
    z-index:9;
  `;

  // If HUD exists, carve safe area by padding:
  // We simply use padding-top equal to hud height when available.
  // (mode-factory uses boundsHost rect; padding is handled there)
  DOC.body.appendChild(b);

  // If HUD overlaps, recommend adding it in HTML for accuracy.
  if(hud){
    // noop - visual debug could be added later
  }
}

// ------------------------------------------------------------
// Public boot
// ------------------------------------------------------------
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // reset state
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
  STATE.shield = 0;

  STATE.goal.cur = 0;
  STATE.goal.done = false;

  STATE.mini.cur = 0;
  STATE.mini.done = false;
  STATE.mini.active = true;
  STATE.mini.timeTotal = 18;
  STATE.mini.timeLeft = STATE.mini.timeTotal;

  // RNG
  if(isResearch()){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;
  STATE.startedAt = nowMs();

  // Ensure bounds host exists (recommended: define in HTML)
  ensureBoundsHost();

  // initial adaptive
  STATE.spawnRateMs = 880;
  STATE.ttlMs = 1900;
  applyAdaptive();

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
  emitScore();
  emitQuest();
  emitTime();

  // start
  restartSpawner();
  startTimer();
}