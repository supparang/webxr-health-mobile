// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION+ FUN)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (เบาๆ: ปรับสัดส่วน junk + spawnRate ตามผลงาน)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ Targets: 5 หมู่ + junk variants (emoji + label) ไม่ซ้ำอย่างเดียว
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

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
  let t = (Number(seed)||0) >>> 0;
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

function pick(rng, arr){
  if(!arr || !arr.length) return null;
  return arr[Math.floor(rng() * arr.length)];
}

function pctText(n){
  n = Number(n)||0;
  return `${Math.round(n)}%`;
}

/* ------------------------------------------------
 * Food sets (สนุกขึ้น: หลายแบบต่อหมู่)
 * g0..g4 = 5 หมู่ (แนวไทยเด็ก ป.5)
 * ------------------------------------------------ */
const FOOD = {
  g0: { // ข้าว-แป้ง
    tag: 'ข้าว-แป้ง',
    items: [
      { e:'🍚', t:'ข้าวสวย' }, { e:'🍞', t:'ขนมปัง' }, { e:'🍜', t:'ก๋วยเตี๋ยว' },
      { e:'🥖', t:'ขนมปังฝรั่งเศส' }, { e:'🥟', t:'เกี๊ยว' }, { e:'🌽', t:'ข้าวโพด' }
    ]
  },
  g1: { // ผัก
    tag: 'ผัก',
    items: [
      { e:'🥦', t:'บรอกโคลี' }, { e:'🥕', t:'แครอท' }, { e:'🥬', t:'ผักใบเขียว' },
      { e:'🍅', t:'มะเขือเทศ' }, { e:'🥒', t:'แตงกวา' }, { e:'🫑', t:'พริกหวาน' }
    ]
  },
  g2: { // ผลไม้
    tag: 'ผลไม้',
    items: [
      { e:'🍎', t:'แอปเปิล' }, { e:'🍌', t:'กล้วย' }, { e:'🍊', t:'ส้ม' },
      { e:'🍇', t:'องุ่น' }, { e:'🍉', t:'แตงโม' }, { e:'🥭', t:'มะม่วง' }
    ]
  },
  g3: { // โปรตีน (เนื้อ/ไข่/ถั่ว)
    tag: 'โปรตีน',
    items: [
      { e:'🍗', t:'ไก่' }, { e:'🐟', t:'ปลา' }, { e:'🥚', t:'ไข่' },
      { e:'🫘', t:'ถั่ว' }, { e:'🥜', t:'ถั่วลิสง' }, { e:'🍤', t:'กุ้ง' }
    ]
  },
  g4: { // นม/แคลเซียม
    tag: 'นม',
    items: [
      { e:'🥛', t:'นม' }, { e:'🧀', t:'ชีส' }, { e:'🍶', t:'โยเกิร์ต' },
      { e:'🥣', t:'นม+ซีเรียล' }
    ]
  },
  junk: {
    tag: 'หวาน/ทอด',
    items: [
      { e:'🍩', t:'โดนัท' }, { e:'🍟', t:'เฟรนช์ฟรายส์' }, { e:'🍰', t:'เค้ก' },
      { e:'🍫', t:'ช็อกโกแลต' }, { e:'🥤', t:'น้ำอัดลม' }, { e:'🍗', t:'ไก่ทอด' }
    ]
  }
};

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

  // plate groups hit counts (5 หมู่)
  g:[0,0,0,0,0],

  // quest
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บให้ครบทุกหมู่ อย่างน้อยหมู่ละ 1',
    cur:0,
    target:5,
    done:false
  },

  mini:{
    type:'accuracy',   // accuracy | combo | nojunk
    name:'ความแม่นยำ',
    sub:'คุมความแม่น ≥ 80%',
    cur:0,
    target:80,
    done:false
  },

  // counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,
  streakNoJunk:0,

  // mode / cfg
  cfg:null,
  rng:Math.random,

  // spawner controller
  spawner:null,

  // adaptive knobs (play only)
  spawnRateMs: 900,
  goodWeight: 0.72,
  junkWeight: 0.28,

  // boss/storm hooks
  bossOn:false,
  stormOn:false
};

/* ------------------------------------------------
 * Coach helper
 * ------------------------------------------------ */
function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * HUD events
 * ------------------------------------------------ */
function emitScore(){
  emit('hha:score', { score: STATE.score, combo: STATE.combo, comboMax: STATE.comboMax });
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
    allDone: STATE.goal.done && STATE.mini.done
  });
}

/* ------------------------------------------------
 * Score / Combo
 * ------------------------------------------------ */
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
 *  - ใช้สูตรเดียวกับ GoodJunk: hitGood / (hitGood + hitJunk + expireGood)
 * ------------------------------------------------ */
function accuracy01(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * Mini Quest types (ไม่น่าเบื่อ)
 * ------------------------------------------------ */
function pickMiniType(rng){
  return pick(rng, ['accuracy','combo','nojunk']);
}

function setupMini(type){
  STATE.mini.type = type;

  if(type === 'accuracy'){
    STATE.mini.name = 'ความแม่นยำ';
    STATE.mini.sub  = 'คุมความแม่น ≥ 80%';
    STATE.mini.target = 80;
    STATE.mini.cur = 0;
    STATE.mini.done = false;
  } else if(type === 'combo'){
    STATE.mini.name = 'คอมโบไฟลุก';
    STATE.mini.sub  = 'ทำคอมโบ ≥ 12';
    STATE.mini.target = 12;
    STATE.mini.cur = 0;
    STATE.mini.done = false;
  } else { // nojunk
    STATE.mini.name = 'ห้ามพลาดของหวาน';
    STATE.mini.sub  = 'เก็บดีติดกัน 10 ครั้ง โดยไม่โดนหวาน/ทอด';
    STATE.mini.target = 10;
    STATE.mini.cur = 0;
    STATE.mini.done = false;
  }
}

/* ------------------------------------------------
 * Goal progress: count unique groups hit >=1
 * ------------------------------------------------ */
function updateGoal(){
  if(STATE.goal.done) return;
  STATE.goal.cur = STATE.g.filter(v=>v>0).length;
  if(STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! ครบ 5 หมู่แล้ว 🎉', 'Coach');
  }
}

/* ------------------------------------------------
 * Mini progress
 * ------------------------------------------------ */
function updateMini(){
  if(STATE.mini.done) return;

  if(STATE.mini.type === 'accuracy'){
    const acc = accuracy01()*100;
    STATE.mini.cur = Math.round(acc);
    if(acc >= STATE.mini.target){
      STATE.mini.done = true;
      coach('ความแม่นยำดีมาก! 👍', 'Coach');
    }
  } else if(STATE.mini.type === 'combo'){
    STATE.mini.cur = Math.min(STATE.mini.target, Math.max(STATE.mini.cur, STATE.comboMax));
    if(STATE.comboMax >= STATE.mini.target){
      STATE.mini.done = true;
      coach('คอมโบสุดยอด! 🔥', 'Coach');
    }
  } else { // nojunk
    STATE.mini.cur = Math.min(STATE.mini.target, STATE.streakNoJunk);
    if(STATE.streakNoJunk >= STATE.mini.target){
      STATE.mini.done = true;
      coach('สุดยอด! ไม่โดนของหวานเลย 😎', 'Coach');
    }
  }
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  STATE.timer = null;

  // cleanup spawner
  try{ STATE.spawner && STATE.spawner.destroy && STATE.spawner.destroy(); }catch(_){}
  STATE.spawner = null;

  const accPct = Math.round(accuracy01()*100);

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: accPct, // boot.js จะ format %

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4]
  });
}

/* ------------------------------------------------
 * Timer
 * ------------------------------------------------ */
function startTimer(){
  emitTime();
  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;
    STATE.timeLeft--;
    emitTime();
    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Boss / Storm hooks (visual layer is in CSS/HTML ids)
 * ------------------------------------------------ */
function setBoss(on){
  STATE.bossOn = !!on;
  const fx = DOC.getElementById('bossFx');
  if(fx){
    fx.classList.toggle('boss-on', STATE.bossOn);
    fx.classList.remove('boss-panic');
  }
}
function setStorm(on){
  STATE.stormOn = !!on;
  const fx = DOC.getElementById('stormFx');
  if(fx){
    fx.classList.toggle('storm-on', STATE.stormOn);
  }
}

/* ------------------------------------------------
 * Adaptive (play only): เบาๆ แต่รู้สึก “มีแรงกดดัน”
 * ------------------------------------------------ */
function applyAdaptive(){
  if(!STATE.cfg) return;
  const run = (STATE.cfg.runMode||'play').toLowerCase();
  if(run === 'research' || run === 'study') return; // OFF

  // ปรับจาก performance ช่วงสั้นๆ
  const acc = accuracy01();              // 0..1
  const pressure = clamp(STATE.miss / 8, 0, 1); // miss เยอะ => ลด junk นิดนึงให้แฟร์

  // ถ้าแม่นมาก + miss น้อย => เพิ่ม junk และเร่ง spawn (สนุกขึ้น)
  const skill = clamp((acc - 0.70) / 0.30, 0, 1); // >70% ถือว่าเก่ง
  const junk = clamp(0.22 + 0.18*skill - 0.10*pressure, 0.12, 0.40);
  const good = 1 - junk;

  STATE.junkWeight = junk;
  STATE.goodWeight = good;

  const base = (STATE.cfg.diff === 'hard') ? 780 : (STATE.cfg.diff === 'easy' ? 980 : 900);
  const faster = base - Math.round(120*skill) + Math.round(120*pressure);
  STATE.spawnRateMs = clamp(faster, 620, 1200);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex, payload){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  STATE.streakNoJunk++;
  addCombo();

  // คะแนน: base 100 + combo bonus
  addScore(100 + STATE.combo * 6);

  updateGoal();
  updateMini();
  emitQuest();

  // judge hook (optional)
  emit('hha:judge', { kind:'good', groupIndex, food: payload?.food || null });

  // adaptive tune every few hits
  if((STATE.hitGood + STATE.hitJunk) % 5 === 0){
    applyAdaptive();
    // refresh spawner rate/weights by recreating (simple+safe)
    refreshSpawner();
  }
}

function onHitJunk(payload){
  STATE.hitJunk++;
  STATE.miss++;
  STATE.streakNoJunk = 0;

  resetCombo();
  addScore(-60);

  coach('ระวัง! หวาน/ทอด ⚠️', 'Coach');
  emit('hha:judge', { kind:'junk', food: payload?.food || null });

  applyAdaptive();
  refreshSpawner();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  STATE.streakNoJunk = 0;
  resetCombo();

  applyAdaptive();
  refreshSpawner();
}

/* ------------------------------------------------
 * Target payload generator (emoji+text)
 * ------------------------------------------------ */
function makeGoodPayload(gi){
  const group = [FOOD.g0, FOOD.g1, FOOD.g2, FOOD.g3, FOOD.g4][gi];
  const item = pick(STATE.rng, group.items);
  return {
    groupIndex: gi,
    groupTag: group.tag,
    emoji: item?.e || '🍽️',
    label: item?.t || group.tag
  };
}

function makeJunkPayload(){
  const item = pick(STATE.rng, FOOD.junk.items);
  return {
    emoji: item?.e || '🍩',
    label: item?.t || 'หวาน/ทอด'
  };
}

/* ------------------------------------------------
 * Spawner (mode-factory A4)
 * ------------------------------------------------ */
function buildKinds(){
  // kinds list: we encode groupIndex for good with weights across 5 groups
  const k = [];

  // กระจาย good 5 หมู่เท่าๆกัน แต่รวม weight = goodWeight
  const per = STATE.goodWeight / 5;

  k.push({ kind:'good', weight: per, groupIndex: 0 });
  k.push({ kind:'good', weight: per, groupIndex: 1 });
  k.push({ kind:'good', weight: per, groupIndex: 2 });
  k.push({ kind:'good', weight: per, groupIndex: 3 });
  k.push({ kind:'good', weight: per, groupIndex: 4 });

  k.push({ kind:'junk', weight: STATE.junkWeight });

  return k;
}

function refreshSpawner(){
  if(!STATE.running) return;
  if(!STATE.cfg) return;

  // research/study => never refresh (deterministic)
  const run = (STATE.cfg.runMode||'play').toLowerCase();
  if(run === 'research' || run === 'study') return;

  // destroy old & rebuild with new weights/rate
  try{ STATE.spawner && STATE.spawner.destroy && STATE.spawner.destroy(); }catch(_){}
  STATE.spawner = makeSpawner(STATE.cfg._mountEl);
}

function makeSpawner(mount){
  // size: ป.5 เล่นง่ายขึ้น
  const sizeRange = (STATE.cfg.view === 'pc') ? [52, 74] : [56, 84];

  // expire: ถ้าอยาก “เร่งนิดๆ” ปรับ ttl ให้สั้นลงใน hard
  const ttl = (STATE.cfg.diff === 'hard') ? 2100 : (STATE.cfg.diff === 'easy' ? 2700 : 2400);

  const controller = spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: STATE.spawnRateMs,
    sizeRange,
    ttlMs: ttl,
    warmStart: 3, // กัน “เป้าไม่โผล่”
    kinds: buildKinds(),

    onHit: (t)=>{
      // เติม payload ให้เกมใช้ (emoji/label) + ตั้ง text ของเป้า
      if(t.kind === 'good'){
        const gi = clamp(t.groupIndex ?? Math.floor(STATE.rng()*5), 0, 4);
        const p = makeGoodPayload(gi);

        // decorate element if still there (บางครั้ง remove แล้ว)
        try{
          // NOTE: mode-factory ส่ง t เป็น object ไม่รวม el
          // แต่ element ได้ถูก set text ใน mode-factory แล้ว
          // เราเลยยิง judge + logic แทน
        }catch(_){}

        onHitGood(gi, { food:p });

      } else {
        const p = makeJunkPayload();
        onHitJunk({ food:p });
      }
    },

    onExpire: (t)=>{
      if(t.kind === 'good') onExpireGood();
    }
  });

  // IMPORTANT: หลัง spawn แล้ว เราจะ “เติม emoji/label” ให้เป้าโดยการสแกน DOM แบบเบาๆ
  // (เพราะ mode-factory สร้าง element ภายใน)
  // ทำแค่ช่วงแรกและเป็นครั้งคราว เพื่อไม่หนักเครื่อง
  decorateTargetsSoon(mount);

  return controller;
}

function decorateTargetsSoon(mount){
  const run = (STATE.cfg.runMode||'play').toLowerCase();
  const deterministic = (run === 'research' || run === 'study');

  // scan targets and assign emoji+label depending on dataset.kind/groupIndex
  // (quick+safe)
  const apply = ()=>{
    try{
      const els = mount.querySelectorAll('.plateTarget');
      els.forEach(el=>{
        if(el.dataset._decorated === '1') return;

        const kind = el.dataset.kind || 'good';
        let html = '';
        let title = '';

        if(kind === 'good'){
          const gi = clamp(el.dataset.groupIndex ?? Math.floor(STATE.rng()*5), 0, 4);
          const payload = makeGoodPayload(gi);
          el.dataset.groupIndex = String(gi);
          el.dataset.groupTag = payload.groupTag;
          html = payload.emoji;
          title = `${payload.groupTag}: ${payload.label}`;
        } else {
          const payload = makeJunkPayload();
          html = payload.emoji;
          title = `หวาน/ทอด: ${payload.label}`;
        }

        el.textContent = html;
        el.setAttribute('aria-label', title);
        el.title = title;

        // style hint class for ring look (CSS can use these)
        el.classList.add('has-ring');
        el.dataset._decorated = '1';
      });
    }catch(_){}
  };

  // do a couple of times early (since targets spawn continuously)
  apply();
  setTimeout(apply, 250);
  setTimeout(apply, 650);

  // deterministic mode: do not keep scanning
  if(deterministic) return;

  // light periodic refresh (not heavy)
  clearInterval(WIN.__PLATE_DECOR_INT__);
  WIN.__PLATE_DECOR_INT__ = setInterval(apply, 900);
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // cfg
  STATE.cfg = cfg;
  STATE.cfg._mountEl = mount;

  // mode
  const run = (cfg.runMode||'play').toLowerCase();
  const deterministic = (run === 'research' || run === 'study');

  // RNG
  STATE.rng = deterministic ? seededRng(cfg.seed || Date.now()) : Math.random;

  // reset state
  STATE.running = true;
  STATE.ended = false;

  STATE.score = 0;
  STATE.combo = 0;
  STATE.comboMax = 0;
  STATE.miss = 0;

  STATE.hitGood = 0;
  STATE.hitJunk = 0;
  STATE.expireGood = 0;
  STATE.streakNoJunk = 0;

  STATE.g = [0,0,0,0,0];

  STATE.goal.cur = 0;
  STATE.goal.done = false;

  // mini quest: deterministic -> choose from seed too (ผ่าน rng ของเรา)
  setupMini(pickMiniType(STATE.rng));

  // time
  // หมายเหตุ: 70 บางที “ยังไม่ทันสนุก” โดยเฉพาะเด็ก ป.5
  // ค่าแนะนำ: 90 เป็น sweet spot (มีเวลาทำครบ 5 หมู่ + mini)
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // adaptive knobs
  STATE.spawnRateMs = (cfg.diff === 'hard') ? 820 : (cfg.diff === 'easy' ? 980 : 900);
  STATE.goodWeight = 0.72;
  STATE.junkWeight = 0.28;

  // start signals
  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  // FX off by default
  setBoss(false);
  setStorm(false);

  emitQuest();
  emitScore();
  startTimer();

  // spawner
  try{
    STATE.spawner && STATE.spawner.destroy && STATE.spawner.destroy();
  }catch(_){}
  STATE.spawner = makeSpawner(mount);

  // opening coach
  coach(`เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️ (มินิเควส: ${STATE.mini.name})`, 'Coach');
}