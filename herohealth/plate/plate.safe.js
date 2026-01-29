// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard — Plate
// ------------------------------------------------------------
// ✅ Play / Study modes
//   - play: adaptive ON (feel fun, ramps gently)
//   - study/research: deterministic seed + adaptive OFF (reproducible)
// ✅ Uses mode-factory boot() spawner
// ✅ decorateTarget(el,target): emoji by Thai 5 food groups + junk
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge (optional), hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ End: stop() spawner + clear timers (no flashing targets)
// ------------------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { FOOD5, JUNK, emojiForGroup, pickEmoji, labelForGroup } from '../vr/food5-th.js';

const WIN = window;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

const nowMs = ()=>{ try{ return performance.now(); }catch{ return Date.now(); } };

function seededRng(seed){
  let t = (Number(seed) || Date.now()) >>> 0;
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

/* ------------------------------------------------------------
 * State
 * ------------------------------------------------------------ */
const STATE = {
  running: false,
  ended: false,

  // numbers
  score: 0,
  combo: 0,
  comboMax: 0,
  miss: 0,

  // time
  timeLeft: 0,
  timer: null,

  // hits
  hitGood: 0,
  hitJunk: 0,
  expireGood: 0,

  // groups (index 0..4 => groupId 1..5)
  g: [0,0,0,0,0],

  // quest
  goal: {
    name: 'เติมจานให้ครบ 5 หมู่',
    sub: 'เก็บอาหารให้ครบทุกหมู่',
    cur: 0,
    target: 5,
    done: false
  },
  mini: {
    name: 'ความแม่นยำ',
    sub: 'คุมความแม่น ≥ 80%',
    cur: 0,
    target: 80,
    done: false
  },

  // cfg / rng
  cfg: null,
  rng: Math.random,
  study: false,

  // spawner controller
  spawner: null,

  // adaptive (play only)
  adapt: {
    on: false,
    // rolling window
    samples: [],
    win: 18,
    // live params
    spawnRate: 900,
    ttlGood: 2100,
    ttlJunk: 1700,
    junkW: 0.30,
    goodW: 0.70
  }
};

/* ------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------ */
function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function accuracyPct(){
  return Math.round(accuracy() * 100);
}

function addScore(v){
  STATE.score += (Number(v) || 0);
  if(STATE.score < 0) STATE.score = 0;
  emit('hha:score', { score: STATE.score, combo: STATE.combo, comboMax: STATE.comboMax });
}

function addCombo(){
  STATE.combo++;
  if(STATE.combo > STATE.comboMax) STATE.comboMax = STATE.combo;
}

function resetCombo(){
  STATE.combo = 0;
}

/* ------------------------------------------------------------
 * Quest update
 * ------------------------------------------------------------ */
function emitQuest(){
  emit('quest:update', {
    goal: {
      name: STATE.goal.name,
      sub: STATE.goal.sub,
      cur: STATE.goal.cur,
      target: STATE.goal.target
    },
    mini: {
      name: STATE.mini.name,
      sub: STATE.mini.sub,
      cur: STATE.mini.cur,
      target: STATE.mini.target,
      done: STATE.mini.done
    },
    allDone: STATE.goal.done && STATE.mini.done
  });
}

function updateGoalProgress(){
  if(STATE.goal.done) return;
  // unique groups collected
  STATE.goal.cur = STATE.g.filter(v => v > 0).length;
  if(STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
  }
}

function updateMiniProgress(){
  const acc = accuracyPct();
  STATE.mini.cur = acc;
  if(!STATE.mini.done && acc >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }
}

/* ------------------------------------------------------------
 * Adaptive (play mode only) — lightweight “AI director”
 * ------------------------------------------------------------ */
function pushSample(type){
  // type: 'good'|'junk'|'expire'
  if(!STATE.adapt.on) return;

  const a = STATE.adapt;
  a.samples.push({ t: nowMs(), type, acc: accuracy() });
  while(a.samples.length > a.win) a.samples.shift();

  // Adjust gently every few samples
  if(a.samples.length < 8) return;

  const acc = accuracy();               // 0..1
  const accPctNow = acc * 100;

  // baseline by difficulty
  const diff = (STATE.cfg?.diff || 'normal');
  const base = (diff === 'hard') ? 820 : (diff === 'easy' ? 980 : 900);

  // If player is strong => slightly faster spawns & a bit more junk
  // If struggling => slower spawns & less junk (but never boring)
  const skill = clamp((accPctNow - 60) / 40, 0, 1);   // 60%..100% => 0..1
  const struggle = clamp((70 - accPctNow) / 30, 0, 1);// below 70 => 0..1

  a.spawnRate = Math.round(base - skill * 140 + struggle * 140);
  a.spawnRate = clamp(a.spawnRate, 650, 1100);

  a.junkW = 0.25 + skill * 0.12 - struggle * 0.10;
  a.junkW = clamp(a.junkW, 0.15, 0.40);
  a.goodW = 1 - a.junkW;

  // TTL: harder when strong (targets disappear a bit faster)
  a.ttlGood = Math.round(2200 - skill * 250 + struggle * 220);
  a.ttlGood = clamp(a.ttlGood, 1600, 2600);

  a.ttlJunk = Math.round(1750 - skill * 220 + struggle * 180);
  a.ttlJunk = clamp(a.ttlJunk, 1200, 2300);

  // Optional HUD chip if you have it (AI %)
  // “AI%” here = how much the director is actively ramping (0..100)
  const aiPct = Math.round(skill * 100);
  emit('hha:ai', { aiPct, spawnRate: a.spawnRate, junkW: a.junkW });
}

/* ------------------------------------------------------------
 * End game
 * ------------------------------------------------------------ */
function hardStopSpawner(){
  try{
    if(STATE.spawner && typeof STATE.spawner.stop === 'function') STATE.spawner.stop();
  }catch{}
  STATE.spawner = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;

  STATE.ended = true;
  STATE.running = false;

  try{ clearInterval(STATE.timer); }catch{}
  STATE.timer = null;

  // ✅ stop spawner so targets never “flash” after end
  hardStopSpawner();

  const accPctFinal = Math.round(accuracy() * 100);

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: accPctFinal,

    // group counts (Thai fixed mapping)
    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4]
  });
}

/* ------------------------------------------------------------
 * Timer
 * ------------------------------------------------------------ */
function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;
    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------------------
 * Hit / Expire handlers
 * ------------------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;

  const gi = clamp(groupIndex, 0, 4);
  STATE.g[gi]++;

  addCombo();

  // scoring: reward streaks
  addScore(100 + STATE.combo * 6);

  updateGoalProgress();
  updateMiniProgress();
  emitQuest();

  pushSample('good');
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;

  resetCombo();

  // small penalty
  addScore(-55);

  // micro-tip (rate-limited by your boot showCoach timeout already)
  coach('ระวัง! ของหวาน/ทอด ⚠️');

  updateMiniProgress();
  emitQuest();

  pushSample('junk');
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;

  resetCombo();

  updateMiniProgress();
  emitQuest();

  pushSample('expire');
}

/* ------------------------------------------------------------
 * Target Decorator — Emoji by group/junk
 * ------------------------------------------------------------ */
function decorateTarget(el, t){
  const kind = String(t.kind || 'good');
  const groupId = clamp((t.groupIndex ?? 0) + 1, 1, 5);

  // base UI text
  let emoji = '❓';
  let aria = '';

  if(kind === 'junk'){
    emoji = pickEmoji(t.rng, JUNK.emojis);
    aria = `${JUNK.labelTH}`;
    el.dataset.group = 'junk';
  }else{
    emoji = emojiForGroup(t.rng, groupId);
    aria = `${labelForGroup(groupId)}`;
    el.dataset.group = `g${groupId}`;
  }

  // render emoji
  el.textContent = emoji;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', aria);

  // visual polish (works with your existing CSS too)
  el.style.display = 'grid';
  el.style.placeItems = 'center';
  el.style.userSelect = 'none';
  el.style.fontSize = `${Math.round((t.size || 54) * 0.55)}px`;
  el.style.lineHeight = '1';

  // tiny “pop” animation class (optional)
  el.classList.add('emojiTarget');
  if(kind === 'junk') el.classList.add('isJunk');
  else el.classList.add('isGood');
}

/* ------------------------------------------------------------
 * Build spawner params
 * ------------------------------------------------------------ */
function getBaseByDiff(diff){
  if(diff === 'hard') return { spawnRate: 820, ttlGood: 1900, ttlJunk: 1550, junkW: 0.34 };
  if(diff === 'easy') return { spawnRate: 980, ttlGood: 2350, ttlJunk: 1850, junkW: 0.26 };
  return { spawnRate: 900, ttlGood: 2100, ttlJunk: 1700, junkW: 0.30 };
}

function makeSpawner(mount){
  const diff = (STATE.cfg?.diff || 'normal');
  const base = getBaseByDiff(diff);

  // init adaptive live params
  STATE.adapt.spawnRate = base.spawnRate;
  STATE.adapt.ttlGood = base.ttlGood;
  STATE.adapt.ttlJunk = base.ttlJunk;
  STATE.adapt.junkW = base.junkW;
  STATE.adapt.goodW = 1 - base.junkW;

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,

    // live params (adaptive can update by re-creating spawner later if you want,
    // but we keep it simple: adapt influences weights/ttl/spawnRate via light restarts)
    spawnRate: STATE.adapt.spawnRate,
    sizeRange: (diff === 'hard') ? [42, 62] : [44, 64],

    ttlGoodMs: STATE.adapt.ttlGood,
    ttlJunkMs: STATE.adapt.ttlJunk,

    kinds: [
      { kind: 'good', weight: STATE.adapt.goodW },
      { kind: 'junk', weight: STATE.adapt.junkW }
    ],

    decorateTarget,

    onHit: (t)=>{
      if(STATE.ended) return;
      if(String(t.kind) === 'good'){
        const gi = (t.groupIndex ?? 0);
        onHitGood(gi);
      }else{
        onHitJunk();
      }
    },

    onExpire: (t)=>{
      if(STATE.ended) return;
      if(String(t.kind) === 'good') onExpireGood();
    },

    // plate safe vars
    safePrefix: '--plate',

    // crosshair lock config (vr-ui.js passes lockPx too)
    defaultLockPx: 28,
    shootCooldownMs: 90
  });
}

/* ------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // stop previous run (hot reload safety)
  try{ clearInterval(STATE.timer); }catch{}
  STATE.timer = null;
  hardStopSpawner();

  STATE.cfg = cfg || {};
  STATE.study = (cfg.runMode === 'research' || cfg.runMode === 'study');
  STATE.adapt.on = !STATE.study && (cfg.runMode === 'play');

  // RNG
  STATE.rng = STATE.study ? seededRng(cfg.seed || Date.now()) : Math.random;

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

  // time: 90s default (ตามที่คุยกันไว้)
  const dur = clamp(cfg.durationPlannedSec ?? 90, 10, 999);
  STATE.timeLeft = dur;

  emit('hha:start', {
    game: 'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: dur,
    adaptive: STATE.adapt.on ? 'ON' : 'OFF'
  });

  // initial quest + time
  updateGoalProgress();
  updateMiniProgress();
  emitQuest();
  startTimer();

  // spawner start
  STATE.spawner = makeSpawner(mount);

  // opening tip
  if(STATE.study){
    coach('โหมดวิจัย: ใช้ seed เดิม + Adaptive ปิด (ผลซ้ำได้)', 'System');
  }else{
    coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
  }

  // return controller (optional)
  return {
    stop(){
      endGame('stop');
    },
    end(reason='manual'){
      endGame(reason);
    }
  };
}