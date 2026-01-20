// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION+ A30)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (spawn rate auto)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Uses mode-factory.js (boot) for DOM spawns + crosshair shooting (hha:shoot via vr-ui.js)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

const WIN = window;

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

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function nowMs(){ return Date.now(); }

// ------------------------------------------------
// Emoji pools (ทำให้ไม่เบื่อ: หมู่ละหลายแบบ)
// ------------------------------------------------
const GROUPS = [
  { id:0, key:'veg',  label:'ผัก',        emojis:['🥦','🥬','🥕','🍄','🥒','🌽'] },
  { id:1, key:'fruit',label:'ผลไม้',      emojis:['🍎','🍌','🍊','🍉','🍇','🍍'] },
  { id:2, key:'prot', label:'โปรตีน',     emojis:['🐟','🍗','🥚','🫘','🧀','🥩'] },
  { id:3, key:'carb', label:'ข้าว-แป้ง',  emojis:['🍚','🍞','🥖','🍜','🥔','🍠'] },
  { id:4, key:'fat',  label:'ไขมันดี',    emojis:['🥑','🫒','🥜','🌰','🫐','🧈'] } // 🫐 ใส่เป็นสี/ไอเท็มหลอกนิดๆได้ แต่ยังถือเป็นดี
];

// junk หลายแบบ
const JUNK = ['🍟','🍔','🍩','🍰','🧁','🥤','🍭','🍫','🍗(ทอด)'].map(s=>String(s).replace('(ทอด)',''));

// shield/bonus (ถ้าจะเปิดภายหลัง)
const SHIELD = ['🛡️','🧊','✨'];
const STAR   = ['⭐','🌟','💎'];

// ------------------------------------------------
// State
// ------------------------------------------------
const STATE = {
  running:false,
  ended:false,

  cfg:null,
  rng:Math.random,

  // score
  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  // time
  timeLeft:0,
  timer:null,
  startAtIso:'',
  endAtIso:'',

  // plate counts per group
  g:[0,0,0,0,0], // index 0-4

  // hit/expire counters (for summary)
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // mini quest tracking
  goalsCleared:0,
  goalsTotal:1,
  miniCleared:0,
  miniTotal:0,     // จะนับจำนวน mini ที่ถูก “สุ่มมาแล้ว”
  miniActive:null, // { type, name, sub, cur, target, tLeft, done }

  // spawner controller
  spawner:null,

  // adaptive
  baseSpawnMs:900,
  curSpawnMs:900,
  lastAdaptAt:0
};

// ------------------------------------------------
// Helpers
// ------------------------------------------------
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
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

function goalProgress(){
  // goal = มีครบทุกหมู่ (อย่างน้อย 1)
  const have = STATE.g.filter(v=>v>0).length;
  return { cur: have, target: 5 };
}

function emitQuest(){
  const gp = goalProgress();
  const gDone = (gp.cur >= gp.target);

  // mini shape (for plate.boot.js / quest:update)
  const m = STATE.miniActive || {
    type:'accuracy',
    name:'ความแม่นยำ',
    sub:'คุมความแม่น ≥ 80%',
    cur: Math.round(accuracy()*100),
    target: 80,
    tLeft: null,
    done: false
  };

  emit('quest:update', {
    goal:{
      name:'เติมจานให้ครบ 5 หมู่',
      sub:'เก็บอาหารให้ครบทุกหมู่',
      cur: gp.cur,
      target: gp.target,
      done: gDone
    },
    mini:{
      name: m.name,
      sub: m.sub,
      cur: m.cur,
      target: m.target,
      tLeft: m.tLeft,
      done: !!m.done
    },
    allDone: gDone && !!m.done
  });
}

// ------------------------------------------------
// Adaptive spawn (เฉพาะ play)
// ------------------------------------------------
function adaptSpawnIfNeeded(){
  if(!STATE.cfg) return;
  if(STATE.cfg.runMode !== 'play') return; // research/study fixed

  const now = nowMs();
  if(now - STATE.lastAdaptAt < 1200) return;
  STATE.lastAdaptAt = now;

  // “เร่งนิด ๆ”: เล่นดี -> spawn เร็วขึ้น, พลาดเยอะ -> ช้าลง
  const acc = accuracy(); // 0..1
  const miss = STATE.miss;
  const combo = STATE.combo;

  // target spawn ms range
  const minMs = (STATE.cfg.diff === 'hard') ? 520 : (STATE.cfg.diff === 'easy' ? 820 : 640);
  const maxMs = (STATE.cfg.diff === 'hard') ? 900 : (STATE.cfg.diff === 'easy' ? 1200 : 1050);

  // score of performance
  let perf = 0;
  perf += (acc - 0.70) * 2.2;      // accuracy anchor
  perf += clamp(combo/18, 0, 1) * 0.8;
  perf -= clamp(miss/10, 0, 1) * 0.9;

  // map perf -> spawnMs
  // perf positive => faster (smaller ms)
  const t = clamp(0.5 - perf*0.18, 0, 1); // invert
  const ms = Math.round(minMs + t * (maxMs - minMs));

  STATE.curSpawnMs = ms;
  try{
    STATE.spawner?.setSpawnRate?.(ms);
  }catch(_){}
}

// ------------------------------------------------
// Mini Quest director (ไม่ให้เบื่อ)
// - หมุน mini แบบง่าย: accuracy / streak / no-junk / speed
// ------------------------------------------------
function pickMini(){
  // mini count increases each time we spawn a new mini
  const pool = [
    { type:'accuracy', name:'ความแม่นยำ', sub:'คุมความแม่น ≥ 80%', target:80 },
    { type:'streak',   name:'คอมโบ',      sub:'ทำคอมโบให้ถึง 10',   target:10 },
    { type:'nojunk',   name:'หลบ Junk',   sub:'อย่าโดน junk 8 วินาที', target:8 },
    { type:'speed',    name:'ไว!',        sub:'เก็บของดี 6 ชิ้นในเวลา', target:6 }
  ];
  // ใช้ rng ให้ deterministic ใน research/study
  const i = Math.floor((STATE.rng() || Math.random()) * pool.length);
  return pool[clamp(i,0,pool.length-1)];
}

function startMini(){
  const m0 = pickMini();
  STATE.miniTotal++;
  const m = {
    type: m0.type,
    name: `⚡ MINI: ${m0.name}`,
    sub: m0.sub,
    cur: 0,
    target: m0.target,
    tLeft: null,
    done: false,

    // internal
    startedAt: nowMs(),
    noJunkUntil: null,
    speedStartGood: STATE.hitGood
  };

  if(m.type === 'nojunk'){
    m.tLeft = m.target;
    m.noJunkUntil = nowMs() + m.target*1000;
    m.cur = 0;
  }
  if(m.type === 'speed'){
    m.tLeft = 8; // จำกัดเวลา 8 วินาที
  }

  STATE.miniActive = m;
  coach(`เริ่มมินิเควส: ${m0.name} ⚡`, 'Mini');
  emitQuest();
}

function checkMiniOnTick(){
  const m = STATE.miniActive;
  if(!m || m.done) return;

  if(m.type === 'accuracy'){
    m.cur = Math.round(accuracy() * 100);
    if(m.cur >= m.target){
      m.done = true;
      STATE.miniCleared++;
      coach('มินิเควสผ่าน! ความแม่นสุด ๆ 🎯', 'Mini');
    }
  }

  if(m.type === 'streak'){
    m.cur = STATE.combo;
    if(m.cur >= m.target){
      m.done = true;
      STATE.miniCleared++;
      coach('มินิเควสผ่าน! คอมโบแรงมาก 🔥', 'Mini');
    }
  }

  if(m.type === 'nojunk'){
    const left = Math.ceil((m.noJunkUntil - nowMs())/1000);
    m.tLeft = Math.max(0, left);
    m.cur = (m.target - m.tLeft);
    if(m.tLeft <= 0){
      m.done = true;
      STATE.miniCleared++;
      coach('มินิเควสผ่าน! หลบ junk เก่งมาก 😎', 'Mini');
    }
  }

  if(m.type === 'speed'){
    // ต้องเก็บ good ให้ครบภายใน 8 วิ
    const elapsed = (nowMs() - m.startedAt)/1000;
    m.tLeft = Math.max(0, Math.ceil(8 - elapsed));
    m.cur = (STATE.hitGood - m.speedStartGood);
    if(m.cur >= m.target){
      m.done = true;
      STATE.miniCleared++;
      coach('มินิเควสผ่าน! เร็วมากก ⚡', 'Mini');
    }else if(m.tLeft <= 0){
      // fail silently แล้วสุ่มใหม่
      coach('มินิเควสพลาดนิดนึง ลองอันใหม่!', 'Mini');
      STATE.miniActive = null;
      startMini();
      return;
    }
  }

  emitQuest();

  // ถ้าผ่านแล้ว -> เปลี่ยน mini ใหม่หลังหน่วงสั้น ๆ
  if(m.done){
    setTimeout(()=>{
      if(!STATE.running || STATE.ended) return;
      STATE.miniActive = null;
      startMini();
    }, 800);
  }
}

// ------------------------------------------------
// Scoring rules (เร้าใจขึ้นนิด ๆ)
// ------------------------------------------------
function addGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  STATE.combo++;
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);

  // คะแนน: base + combo bonus + diff bonus
  const diffMul = (STATE.cfg.diff === 'hard') ? 1.15 : (STATE.cfg.diff === 'easy' ? 0.95 : 1.0);
  const add = Math.round((95 + STATE.combo * 6) * diffMul);
  STATE.score += add;

  emitScore();

  // goal check
  const gp = goalProgress();
  if(gp.cur >= gp.target && STATE.goalsCleared === 0){
    STATE.goalsCleared = 1;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Goal');
  }

  adaptSpawnIfNeeded();
  checkMiniOnTick();
  emitQuest();
}

function addJunk(){
  STATE.hitJunk++;
  STATE.miss++;

  // ทำให้ “กดดัน” แต่ไม่โหดเกิน
  STATE.combo = 0;
  STATE.score -= (STATE.cfg.diff === 'hard') ? 90 : 70;
  if(STATE.score < 0) STATE.score = 0;

  emitScore();
  coach('ระวัง! อันนี้เป็น Junk 😵‍💫', 'Coach');

  // mini nojunk จะรีเซ็ตทันที
  if(STATE.miniActive && STATE.miniActive.type === 'nojunk'){
    coach('โดน junk แล้ว! เริ่มมินิเควสใหม่ ✋', 'Mini');
    STATE.miniActive = null;
    startMini();
  }

  adaptSpawnIfNeeded();
  emitQuest();
}

function expireGood(){
  STATE.expireGood++;
  STATE.miss++;
  STATE.combo = 0;
  emitScore();
  adaptSpawnIfNeeded();
  checkMiniOnTick();
  emitQuest();
}

// ------------------------------------------------
// Target generation (payload to mode-factory)
// ------------------------------------------------
function pickGroupIndex(){
  // ถ้ายังไม่มีบางหมู่ ให้โผล่หมู่นั้นมากขึ้น (ช่วยให้ผ่าน goal ไม่ยากเกิน)
  const missing = [];
  for(let i=0;i<5;i++){
    if(STATE.g[i] <= 0) missing.push(i);
  }
  if(missing.length && (STATE.rng() < 0.55)){
    return missing[Math.floor(STATE.rng() * missing.length)];
  }
  return Math.floor(STATE.rng() * 5);
}

function pickEmojiFrom(list){
  const i = Math.floor(STATE.rng() * list.length);
  return list[clamp(i,0,list.length-1)];
}

function makeGoodPayload(){
  const gi = pickGroupIndex();
  const g = GROUPS[gi];
  return {
    kind:'good',
    groupIndex: gi,
    emoji: pickEmojiFrom(g.emojis),
    groupKey: g.key
  };
}

function makeJunkPayload(){
  return {
    kind:'junk',
    emoji: pickEmojiFrom(JUNK)
  };
}

function buildSpawner(mount){
  const diff = (STATE.cfg.diff || 'normal').toLowerCase();

  // base spawn per diff
  const base = (diff === 'hard') ? 680 : (diff === 'easy' ? 980 : 820);
  STATE.baseSpawnMs = base;
  STATE.curSpawnMs  = base;

  // weights per diff (hard -> junk มากขึ้นนิด)
  const goodW = (diff === 'hard') ? 0.66 : 0.72;
  const junkW = 1 - goodW;

  // size range
  const sizeRange = (diff === 'hard') ? [40, 64] : [44, 70];

  const ctl = spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    rng: STATE.rng,
    spawnRateMs: base,
    ttlMs: (diff === 'hard') ? 1100 : 1250,
    sizeRange,

    // IMPORTANT: mode-factory จะใช้ payload.emoji วาดให้เลย
    kinds:[
      { kind:'good', weight: goodW, make: ()=> makeGoodPayload() },
      { kind:'junk', weight: junkW, make: ()=> makeJunkPayload() }
      // ถ้าจะเพิ่ม shield/star ภายหลัง: เปิดเพิ่มตรงนี้
      // { kind:'shield', weight:0.06, make: ()=>({ emoji: pickEmojiFrom(SHIELD) }) },
      // { kind:'star',   weight:0.04, make: ()=>({ emoji: pickEmojiFrom(STAR) }) },
    ],

    onHit:(t)=>{
      if(!STATE.running || STATE.ended) return;
      if(t.kind === 'good'){
        const gi = (t.groupIndex != null) ? Number(t.groupIndex) : pickGroupIndex();
        addGood(clamp(gi,0,4));
      }else if(t.kind === 'junk'){
        addJunk();
      }else{
        // future kinds
        // shield/star etc.
      }
    },

    onExpire:(t)=>{
      if(!STATE.running || STATE.ended) return;
      if(t.kind === 'good') expireGood();
    }
  });

  return ctl;
}

// ------------------------------------------------
// Timer / End
// ------------------------------------------------
function startTimer(){
  emitTime();
  STATE.timer = setInterval(()=>{
    if(!STATE.running || STATE.ended) return;

    STATE.timeLeft--;
    emitTime();

    // tick mini & adapt
    checkMiniOnTick();
    adaptSpawnIfNeeded();

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

function isoNow(){
  try{ return new Date().toISOString(); }catch(_){ return ''; }
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  try{ clearInterval(STATE.timer); }catch(_){}
  STATE.endAtIso = isoNow();

  // stop spawner
  try{ STATE.spawner?.destroy?.(); }catch(_){}

  const gp = goalProgress();
  const gDone = (gp.cur >= gp.target);

  // mini done?
  const mDone = !!(STATE.miniActive && STATE.miniActive.done);

  emit('hha:end', {
    projectTag: 'HeroHealth',
    game: 'plate',
    gameMode: 'plate',
    runMode: STATE.cfg.runMode,
    diff: STATE.cfg.diff,
    seed: STATE.cfg.seed,
    durationPlannedSec: STATE.cfg.durationPlannedSec,
    durationPlayedSec: (STATE.cfg.durationPlannedSec - STATE.timeLeft),

    reason,

    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: gDone ? 1 : 0,
    goalsTotal: 1,

    miniCleared: STATE.miniCleared,
    miniTotal: Math.max(1, STATE.miniTotal),

    // accuracy
    accuracyGoodPct: Math.round(accuracy()*100),

    // group counts
    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],

    // hit counters
    nHitGood: STATE.hitGood,
    nHitJunk: STATE.hitJunk,
    nExpireGood: STATE.expireGood,

    startTimeIso: STATE.startAtIso,
    endTimeIso: STATE.endAtIso,

    // passthrough meta (for cloud logger)
    studyId: STATE.cfg.studyId || '',
    phase: STATE.cfg.phase || '',
    conditionGroup: STATE.cfg.conditionGroup || '',
    sessionOrder: STATE.cfg.sessionOrder || '',
    blockLabel: STATE.cfg.blockLabel || '',
    siteCode: STATE.cfg.siteCode || '',
    device: STATE.cfg.view || ''
  });
}

// ------------------------------------------------
// Public boot (called by plate.boot.js)
// ------------------------------------------------
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // cfg normalize
  const runMode = (cfg.runMode || cfg.run || 'play').toLowerCase();
  const diff    = (cfg.diff || 'normal').toLowerCase();
  const time    = clamp(cfg.durationPlannedSec ?? cfg.time ?? 90, 10, 999);
  const seed    = Number(cfg.seed ?? Date.now()) || Date.now();

  STATE.cfg = {
    ...cfg,
    runMode,
    diff,
    durationPlannedSec: Number(time),
    seed
  };

  // RNG
  if(runMode === 'research' || runMode === 'study'){
    STATE.rng = seededRng(seed);
  }else{
    // play: non-deterministic
    STATE.rng = Math.random;
  }

  // reset state
  STATE.running = true;
  STATE.ended = false;

  STATE.score = 0;
  STATE.combo = 0;
  STATE.comboMax = 0;
  STATE.miss = 0;

  STATE.timeLeft = Number(time);
  STATE.startAtIso = isoNow();
  STATE.endAtIso = '';

  STATE.g = [0,0,0,0,0];
  STATE.hitGood = 0;
  STATE.hitJunk = 0;
  STATE.expireGood = 0;

  STATE.goalsCleared = 0;
  STATE.goalsTotal = 1;

  STATE.miniCleared = 0;
  STATE.miniTotal = 0;
  STATE.miniActive = null;

  // emit start
  emit('hha:start', {
    projectTag: 'HeroHealth',
    game: 'plate',
    runMode,
    diff,
    seed,
    durationPlannedSec: STATE.timeLeft,

    // passthrough for logger
    studyId: STATE.cfg.studyId || '',
    phase: STATE.cfg.phase || '',
    conditionGroup: STATE.cfg.conditionGroup || '',
    sessionOrder: STATE.cfg.sessionOrder || '',
    blockLabel: STATE.cfg.blockLabel || '',
    siteCode: STATE.cfg.siteCode || '',
    view: STATE.cfg.view || ''
  });

  // initial UI
  emitScore();
  emitQuest();
  emitTime();

  // start mini immediately
  startMini();

  // start timer
  startTimer();

  // spawner
  STATE.spawner = buildSpawner(mount);

  // first coach msg
  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️ (เลี่ยง Junk นะ)', 'Coach');
}