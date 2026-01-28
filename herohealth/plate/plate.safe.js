// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard — Plate
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (spawnRate / junkWeight / ttl tuned live)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Uses mode-factory.js (spawn) with decorateTarget
// ✅ Uses Thai 5-food-group stable mapping (food5-th.js)
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Boss / Storm FX hooks (CSS layers #bossFx/#stormFx)
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ End: stop spawner (no “blink targets” after end)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { FOOD5, JUNK, pickEmoji, emojiForGroup, labelForGroup } from '../vr/food5-th.js';

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
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
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

  // plate groups (5 หมู่): index 0..4 => groupId 1..5
  g:[0,0,0,0,0],

  // quests (UI expects cur/target numbers)
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่ (อย่างน้อยหมู่ละ 1)',
    cur:0,
    target:5,
    done:false
  },
  mini:{
    name:'ความแม่นยำ',
    sub:'คุมความแม่น ≥ 80% (หลังแตะอย่างน้อย 8 ครั้ง)',
    cur:0,      // percent
    target:80,  // percent
    done:false
  },

  // counters for accuracy
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // cfg / rng
  cfg:null,
  rng:Math.random,

  // spawner
  spawner:null,

  // adaptive
  adaptive:{
    enabled:false,
    spawnRateMs:900,
    goodWeight:0.70,
    junkWeight:0.30,
    ttlGoodMs:2100,
    ttlJunkMs:1700,
    tick:null,
    lastTuneAt:0
  }
};

/* ------------------------------------------------
 * Event helpers
 * ------------------------------------------------ */
function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

/* ------------------------------------------------
 * FX layers (Boss/Storm)
 * ------------------------------------------------ */
function ensureFxLayers(){
  let boss = DOC.getElementById('bossFx');
  if(!boss){
    boss = DOC.createElement('div');
    boss.id = 'bossFx';
    DOC.body.appendChild(boss);
  }
  let storm = DOC.getElementById('stormFx');
  if(!storm){
    storm = DOC.createElement('div');
    storm.id = 'stormFx';
    DOC.body.appendChild(storm);
  }
  return { boss, storm };
}

function setBoss(on, panic=false){
  const { boss } = ensureFxLayers();
  boss.classList.toggle('boss-on', !!on);
  boss.classList.toggle('boss-panic', !!panic);
}

function setStorm(on){
  const { storm } = ensureFxLayers();
  storm.classList.toggle('storm-on', !!on);
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
 * Coach helper
 * ------------------------------------------------ */
function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * Score helpers
 * ------------------------------------------------ */
function emitScore(){
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax
  });
}

function addScore(v){
  STATE.score += Number(v)||0;
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
 * Accuracy
 * ------------------------------------------------ */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function accuracyPct(){
  return Math.round(accuracy() * 100);
}

/* ------------------------------------------------
 * Miss definition for Plate
 * miss = hitJunk + expireGood
 * ------------------------------------------------ */
function updateMiss(){
  STATE.miss = (STATE.hitJunk + STATE.expireGood);
}

/* ------------------------------------------------
 * End game (stop spawner!)
 * ------------------------------------------------ */
function stopSpawner(){
  try{ STATE.spawner?.stop?.(); }catch(_){}
  STATE.spawner = null;
}

function stopAdaptive(){
  const a = STATE.adaptive;
  if(a.tick){ clearInterval(a.tick); a.tick = null; }
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  STATE.timer = null;

  stopAdaptive();
  stopSpawner();

  setBoss(false,false);
  setStorm(false);

  updateMiss();

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: accuracyPct(),

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4]
  });
}

/* ------------------------------------------------
 * Timer + Boss/Storm hooks
 * ------------------------------------------------ */
function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running || STATE.ended) return;

    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    // Boss when <= 18s (visual pressure)
    if(STATE.timeLeft <= 18){
      setBoss(true, STATE.timeLeft <= 8);
    }else{
      setBoss(false,false);
    }

    // Storm when accuracy dips (short feedback)
    const a = accuracyPct();
    setStorm(a < 65 && (STATE.hitGood + STATE.hitJunk + STATE.expireGood) >= 6);

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Adaptive tuning (PLAY only)
 * ------------------------------------------------ */
function setAdaptiveDefaultsByDiff(diff){
  const a = STATE.adaptive;
  if(diff === 'easy'){
    a.spawnRateMs = 980;
    a.goodWeight = 0.78;
    a.junkWeight = 0.22;
    a.ttlGoodMs = 2400;
    a.ttlJunkMs = 1850;
  }else if(diff === 'hard'){
    a.spawnRateMs = 760;
    a.goodWeight = 0.62;
    a.junkWeight = 0.38;
    a.ttlGoodMs = 1950;
    a.ttlJunkMs = 1550;
  }else{
    a.spawnRateMs = 900;
    a.goodWeight = 0.70;
    a.junkWeight = 0.30;
    a.ttlGoodMs = 2100;
    a.ttlJunkMs = 1700;
  }
}

function tuneAdaptive(){
  const a = STATE.adaptive;
  if(!a.enabled || STATE.ended) return;

  // only tune every ~4s
  const now = Date.now();
  if(now - a.lastTuneAt < 3800) return;
  a.lastTuneAt = now;

  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  const acc = accuracyPct();

  // need some play history
  if(total < 8) return;

  // If player is strong -> make it spicier
  if(acc >= 86){
    a.spawnRateMs = clamp(a.spawnRateMs - 35, 660, 980);
    a.junkWeight  = clamp(a.junkWeight + 0.02, 0.22, 0.48);
    a.goodWeight  = clamp(1 - a.junkWeight, 0.52, 0.78);
    a.ttlGoodMs   = clamp(a.ttlGoodMs - 60, 1700, 2600);
    a.ttlJunkMs   = clamp(a.ttlJunkMs - 40, 1350, 2200);
  }
  // If struggling -> relax a bit
  else if(acc <= 66){
    a.spawnRateMs = clamp(a.spawnRateMs + 45, 720, 1100);
    a.junkWeight  = clamp(a.junkWeight - 0.03, 0.16, 0.45);
    a.goodWeight  = clamp(1 - a.junkWeight, 0.55, 0.84);
    a.ttlGoodMs   = clamp(a.ttlGoodMs + 80, 1800, 2900);
    a.ttlJunkMs   = clamp(a.ttlJunkMs + 60, 1450, 2500);
  }

  // subtle coach
  if(acc >= 90) coach('เก่งมาก! เพิ่มความท้าทายขึ้นนิดนึง 😈', 'AI Director');
  else if(acc <= 60) coach('ค่อย ๆ เล็งนะ ลดความยากให้นิดนึง 🙂', 'AI Director');

  // rebuild spawner with new params (clean & deterministic in-play)
  restartSpawner();
}

function startAdaptiveLoop(){
  const a = STATE.adaptive;
  if(a.tick) clearInterval(a.tick);
  a.tick = setInterval(()=>{
    if(!STATE.running || STATE.ended) return;
    tuneAdaptive();
  }, 600);
}

/* ------------------------------------------------
 * Target decoration (emoji + group label)
 * ------------------------------------------------ */
function decorateTarget(el, target){
  // target.groupIndex is 0..4 => groupId 1..5
  if(target.kind === 'good'){
    const groupId = clamp((target.groupIndex ?? 0) + 1, 1, 5);
    el.dataset.group = String(groupId);
    el.dataset.glabel = FOOD5[groupId]?.labelTH || `หมู่ ${groupId}`;

    const emoji = emojiForGroup(target.rng, groupId);

    // main emoji
    el.textContent = '';
    const big = DOC.createElement('div');
    big.className = 'plateEmoji';
    big.textContent = emoji;

    // tiny label (optional)
    const tiny = DOC.createElement('div');
    tiny.className = 'plateTiny';
    tiny.textContent = `หมู่ ${groupId}`;

    el.appendChild(big);
    el.appendChild(tiny);
  }else{
    el.dataset.group = 'junk';
    const emoji = pickEmoji(target.rng, JUNK.emojis);
    el.textContent = '';
    const big = DOC.createElement('div');
    big.className = 'plateEmoji';
    big.textContent = emoji;

    const tiny = DOC.createElement('div');
    tiny.className = 'plateTiny';
    tiny.textContent = 'JUNK';

    el.appendChild(big);
    el.appendChild(tiny);
  }
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function judge(kind, meta){
  emit('hha:judge', { kind, ...meta });
}

function onHitGood(groupIndex0){
  if(STATE.ended) return;

  const gi = clamp(groupIndex0, 0, 4);
  STATE.hitGood++;
  STATE.g[gi]++;

  addCombo();
  addScore(100 + STATE.combo * 6);

  // goal: count unique groups collected at least 1
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach');
    }
  }

  // mini: accuracy (require some samples)
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  const acc = accuracyPct();
  STATE.mini.cur = acc;

  if(!STATE.mini.done && total >= 8 && acc >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'Coach');
  }

  emitScore();
  emitQuest();

  judge('good', { groupId: gi+1, label: labelForGroup(gi+1), accPct: acc });
}

function onHitJunk(){
  if(STATE.ended) return;

  STATE.hitJunk++;
  resetCombo();
  addScore(-55);

  const acc = accuracyPct();
  STATE.mini.cur = acc;
  emitScore();
  emitQuest();

  // coaching
  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');
  judge('junk', { label: 'JUNK', accPct: acc });
}

function onExpireGood(groupIndex0){
  if(STATE.ended) return;

  STATE.expireGood++;
  resetCombo();

  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  const acc = accuracyPct();
  STATE.mini.cur = acc;

  // small penalty but not too harsh
  if(total >= 6) addScore(-18);

  emitScore();
  emitQuest();

  judge('expire', { groupId: clamp(groupIndex0,0,4)+1, accPct: acc });
}

/* ------------------------------------------------
 * Spawner (mode-factory)
 * ------------------------------------------------ */
function buildKinds(){
  const a = STATE.adaptive;
  return [
    { kind:'good', weight: a.goodWeight },
    { kind:'junk', weight: a.junkWeight }
  ];
}

function restartSpawner(){
  // stop old
  stopSpawner();
  if(STATE.ended) return;

  const mount = DOC.getElementById('plate-layer');
  if(!mount) return;

  const a = STATE.adaptive;

  STATE.spawner = spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: a.spawnRateMs,
    sizeRange:[44,64],
    kinds: buildKinds(),
    decorateTarget,

    onHit:(t)=>{
      if(STATE.ended) return;
      if(t.kind === 'good'){
        onHitGood(t.groupIndex ?? 0);
      }else{
        onHitJunk();
      }
    },

    onExpire:(t)=>{
      if(STATE.ended) return;
      if(t.kind === 'good') onExpireGood(t.groupIndex ?? 0);
    }
  });

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'System');
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // stop any previous run safely
  stopAdaptive();
  stopSpawner();
  clearInterval(STATE.timer);
  STATE.timer = null;

  STATE.cfg = cfg;
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

  // RNG mode
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // duration default already handled in boot.js; but keep safe fallback
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // adaptive config
  STATE.adaptive.enabled = !(cfg.runMode === 'research' || cfg.runMode === 'study');
  setAdaptiveDefaultsByDiff(cfg.diff);

  // FX reset
  setBoss(false,false);
  setStorm(false);

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitScore();
  emitQuest();
  startTimer();

  // spawn
  restartSpawner();

  // adaptive loop (PLAY only)
  if(STATE.adaptive.enabled){
    startAdaptiveLoop();
  }else{
    coach('โหมดวิจัย: seed คงที่ • ไม่ปรับยากง่ายอัตโนมัติ ✅', 'System');
  }
}