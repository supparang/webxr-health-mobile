/* === /herohealth/vr-groups/GameEngine.js ===
   Food Groups VR — GameEngine (PRODUCTION) ✅
   - DOM targets on layerEl (.fg-target)
   - Emits: hha:score, hha:time, quest:update, hha:coach, hha:fever, hha:rank, hha:end
   - Modes: play (adaptive) / research (fixed)
   - diff: easy/normal/hard
   - style: mix/feel/hard (spawn vibe)
   - Candy targets: use data-emoji + classes fg-good/fg-wrong/fg-junk/fg-decoy/fg-boss
   - Shield blocks junk hit => NO MISS (ตาม HHA standard)
   - Cardboard/cVR: integrates HHAVRTapFire (tap anywhere = shoot center)
*/

'use strict';

const root = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = root.document;

const NS = (root.GroupsVR = root.GroupsVR || {});
const clamp = (v, a, b) => (v < a ? a : (v > b ? b : v));

function nowMs(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }

function emit(name, detail){
  try{ root.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function hashSeed(str){
  str = String(str ?? '');
  let h = 2166136261 >>> 0;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function makeRng(seedStr){
  let s = hashSeed(seedStr || 'seed') || 123456789;
  return function rng(){
    // xorshift32
    s ^= (s << 13); s >>>= 0;
    s ^= (s >>> 17); s >>>= 0;
    s ^= (s << 5);  s >>>= 0;
    return (s >>> 0) / 4294967296;
  };
}

function pick(arr, r){
  return arr[Math.floor(r()*arr.length)] || arr[0];
}

function isCVR(){
  try{ return DOC && DOC.body && DOC.body.classList.contains('view-cvr'); }catch{ return false; }
}

function setBodyFlag(cls, on){
  try{ DOC.body.classList.toggle(cls, !!on); }catch(_){}
}

function safeRemove(el){
  try{ el && el.remove && el.remove(); }catch(_){}
}

function fmtPct(x){
  x = Number(x)||0;
  return (Math.round(x*10)/10).toFixed(1);
}

/* ----------------------------
   Minimal Quest (fallback)
   (ถ้ามี groups-quests.js ของคุณอยู่แล้ว จะใช้ของนั้นก่อน)
---------------------------- */
const GROUPS = [
  { id:'g1', name:'หมู่ 1 โปรตีน',   good:['🥩','🥛','🥚','🫘','🐟'] },
  { id:'g2', name:'หมู่ 2 ข้าว-แป้ง', good:['🍚','🍞','🍜','🥔','🍠'] },
  { id:'g3', name:'หมู่ 3 ผัก',       good:['🥦','🥬','🥕','🍅','🥒'] },
  { id:'g4', name:'หมู่ 4 ผลไม้',     good:['🍎','🍌','🍊','🍇','🍉'] },
  { id:'g5', name:'หมู่ 5 ไขมัน',     good:['🥑','🧈','🫒','🥥','🧀'] },
];

const JUNK = ['🍟','🍕','🍩','🧁','🍔','🍫','🥤','🍭','🍪','🌭'];
const DECOY = ['❄️','⚡','💥','🌀','🫧','⭐','💎','🎯'];

const SONG = [
  'อาหารหลัก 5 หมู่ของไทย ทุกคนจำไว้อย่าได้แปลผัน 🎵',
  'หมู่ 1 กินเนื้อ นม ไข่ ถั่วเมล็ดช่วยให้เติบโตแข็งขัน 💪',
  'หมู่ 2 ข้าว แป้ง เผือก มัน และน้ำตาล จะให้พลัง ⚡',
  'หมู่ 3 กินผักต่างๆ สารอาหารมากมายกินเป็นอาจิณ 🥦',
  'หมู่ 4 กินผลไม้ สีเขียวเหลืองบ้างมีวิตามิน 🍎',
  'หมู่ 5 อย่าได้ลืมกิน ไขมันทั้งสิ้น อบอุ่นร่างกาย 🥑'
];

/* ----------------------------
   Grade (SSS/SS/S/A/B/C)
---------------------------- */
function calcGrade({ accuracyGoodPct, misses, comboMax }){
  const acc = Number(accuracyGoodPct)||0;
  const m   = Number(misses)||0;
  const c   = Number(comboMax)||0;

  // กติกาให้ “มันส์แต่ยุติธรรม”: acc สำคัญสุด + miss กด + combo ช่วย
  const score = acc
    + clamp(c,0,40)*0.35
    - clamp(m,0,999)*2.5;

  if (score >= 92 && m <= 2) return 'SSS';
  if (score >= 86 && m <= 4) return 'SS';
  if (score >= 78 && m <= 6) return 'S';
  if (score >= 68) return 'A';
  if (score >= 54) return 'B';
  return 'C';
}

/* ----------------------------
   Engine Core
---------------------------- */
const engine = {
  layerEl: null,
  running: false,
  ended: false,

  // params
  runMode: 'play',
  diff: 'normal',
  style: 'mix',
  timeSec: 90,
  seed: '',

  // rng
  rng: makeRng('seed'),

  // stats
  tStartMs: 0,
  leftSec: 0,
  score: 0,
  combo: 0,
  comboMax: 0,
  misses: 0,             // miss = good-expired + junk-hit (shield blocks => no miss)
  nHitGood: 0,
  nHitWrong: 0,
  nHitJunk: 0,
  nExpireGood: 0,
  nSpawnGood: 0,
  nSpawnWrong: 0,
  nSpawnJunk: 0,
  nSpawnDecoy: 0,
  nSpawnBoss: 0,

  // fever & shield
  fever: 0,              // 0..100
  shield: 0,             // stack
  power: 0,              // charge
  powerThr: 8,

  // pacing
  spawnBaseMs: 900,
  spawnJitterMs: 380,
  ttlMs: 2100,

  // adaptive signals
  lastHitMs: 0,
  rtList: [],

  // quest
  goalIndex: 0,
  activeGroup: GROUPS[0],
  goalNeed: 14,
  goalNow: 0,
  miniActive: null,       // { name, need, now, timeLeft, forbidJunk, untilMs }
  goalsCleared: 0,
  goalsTotal: 2,
  miniCleared: 0,
  miniTotal: 7,

  // timers/handles
  _tickId: 0,
  _spawnId: 0,
  _stormId: 0,

  // state flags
  stormOn: false,
  overdriveOn: false,
  freezeOn: false,
};

/* ----------------------------
   Public API
---------------------------- */
function setLayerEl(el){
  engine.layerEl = el;
}

function stop(reason='stop'){
  if (!engine.running) return;
  engine.running = false;

  try{ root.clearInterval(engine._tickId); }catch(_){}
  try{ root.clearTimeout(engine._spawnId); }catch(_){}
  try{ root.clearTimeout(engine._stormId); }catch(_){}

  engine._tickId = 0;
  engine._spawnId = 0;
  engine._stormId = 0;

  // TapFire off (optional)
  try{ root.HHAVRTapFire?.uninstall?.(); }catch(_){}

  setBodyFlag('groups-storm', false);
  setBodyFlag('groups-storm-urgent', false);
  setBodyFlag('groups-overdrive', false);
  setBodyFlag('groups-freeze', false);
}

function start(diff='normal', opts={}){
  // hard stop previous
  try{ stop('restart'); }catch(_){}

  engine.diff = String(diff || 'normal').toLowerCase();
  engine.runMode = String(opts.runMode || 'play').toLowerCase();
  engine.style = String(opts.style || 'mix').toLowerCase();
  engine.timeSec = clamp(Number(opts.time || 90), 30, 180);
  engine.seed = String(opts.seed || Date.now());

  engine.rng = makeRng(engine.seed);

  if (!engine.layerEl){
    console.warn('[GroupsVR] layerEl not set. call setLayerEl(el) before start().');
    return;
  }

  // reset stats
  engine.running = true;
  engine.ended = false;

  engine.tStartMs = nowMs();
  engine.leftSec = engine.timeSec;
  engine.score = 0;
  engine.combo = 0;
  engine.comboMax = 0;
  engine.misses = 0;

  engine.nHitGood = 0;
  engine.nHitWrong = 0;
  engine.nHitJunk = 0;
  engine.nExpireGood = 0;

  engine.nSpawnGood = 0;
  engine.nSpawnWrong = 0;
  engine.nSpawnJunk = 0;
  engine.nSpawnDecoy = 0;
  engine.nSpawnBoss = 0;

  engine.fever = 0;
  engine.shield = 0;
  engine.power = 0;
  engine.powerThr = (engine.diff === 'easy') ? 7 : (engine.diff === 'hard' ? 9 : 8);

  engine.rtList = [];
  engine.lastHitMs = 0;

  engine.goalIndex = 0;
  engine.goalsCleared = 0;
  engine.goalsTotal = 2;
  engine.miniCleared = 0;
  engine.miniTotal = 7;

  // configure pacing
  applyDiffPacing();

  // choose first group/goal
  nextGoal(true);

  // bind layer pointer hits
  bindLayer();

  // install TapFire (Cardboard/cVR)
  installTapFire();

  // initial UI push
  pushScore();
  pushTime();
  pushQuest();
  pushFever();
  pushRank();
  coachSay(pick(SONG, engine.rng), 'happy');

  // schedule tick
  engine._tickId = root.setInterval(tick, 200);

  // spawn loop
  scheduleSpawn(0);

  // storm schedule (fun)
  scheduleStormCycle();
}

/* ----------------------------
   Pacing per diff/mode
---------------------------- */
function applyDiffPacing(){
  // base per difficulty
  if (engine.diff === 'easy'){
    engine.spawnBaseMs = 980;
    engine.spawnJitterMs = 420;
    engine.ttlMs = 2400;
    engine.goalNeed = 12;
  } else if (engine.diff === 'hard'){
    engine.spawnBaseMs = 760;
    engine.spawnJitterMs = 300;
    engine.ttlMs = 1900;
    engine.goalNeed = 16;
  } else {
    engine.spawnBaseMs = 880;
    engine.spawnJitterMs = 360;
    engine.ttlMs = 2100;
    engine.goalNeed = 14;
  }

  // research mode: fixed (no adaptive)
  if (engine.runMode === 'research'){
    // keep fixed, but deterministic
    // (leave as is)
  }
}

/* ----------------------------
   Quest: Goals + Minis
---------------------------- */
function nextGoal(isFirst=false){
  const idx = engine.goalIndex % GROUPS.length;
  engine.activeGroup = GROUPS[idx];
  engine.goalIndex++;

  engine.goalNow = 0;

  // rotate groups in mix style; feel style keeps same longer; hard style rotates faster
  if (!isFirst){
    if (engine.style === 'feel'){
      // 50% chance keep same
      if (engine.rng() < 0.5) engine.activeGroup = GROUPS[(idx+GROUPS.length-1)%GROUPS.length];
    } else if (engine.style === 'hard'){
      // always rotate (already)
    }
  }

  // set goal title
  emit('quest:update', {
    goalTitle: `แตะ ${engine.activeGroup.name} ให้ครบ ${engine.goalNeed}`,
    goalNow: engine.goalNow, goalTotal: engine.goalNeed,
    miniTitle: engine.miniActive ? engine.miniActive.name : '—',
    miniNow: engine.miniActive ? engine.miniActive.now : 0,
    miniTotal: engine.miniActive ? engine.miniActive.need : 0,
    miniTimeLeftSec: engine.miniActive ? Math.max(0, Math.ceil((engine.miniActive.untilMs - nowMs())/1000)) : 0
  });
}

function maybeStartMini(){
  // mini chain until miniTotal; start next when none active
  if (engine.miniCleared >= engine.miniTotal) return;
  if (engine.miniActive) return;

  const k = engine.miniCleared + 1;

  // deterministic-ish minis
  const r = engine.rng();

  let mini = null;

  if (k === 1){
    mini = { name:'Mini: ห้ามพลาด 6 วินาที', need:1, now:0, forbidJunk:false, untilMs: nowMs()+6000 };
  } else if (k === 2){
    mini = { name:'Mini: แตะดี 6 ครั้งเร็วๆ', need:6, now:0, forbidJunk:false, untilMs: nowMs()+9000 };
  } else if (k === 3){
    mini = { name:'Mini: ห้ามโดนขยะ 8 วิ', need:1, now:0, forbidJunk:true, untilMs: nowMs()+8000 };
  } else if (k === 4){
    mini = { name:'Mini: Perfect 5 (ติดกัน)', need:5, now:0, forbidJunk:false, untilMs: 0, requireStreak:true };
  } else if (k === 5){
    mini = { name:'Mini: Boss Focus (ตีบอส 4)', need:4, now:0, forbidJunk:false, untilMs: nowMs()+12000, bossOnly:true };
  } else if (k === 6){
    mini = { name:'Mini: ไม่ให้ดีหมดอายุ 10 วิ', need:1, now:0, forbidJunk:false, untilMs: nowMs()+10000, noExpire:true };
  } else {
    // k === 7
    mini = { name:'Mini: Rush 7 ใน 9 วิ + ห้ามโดนขยะ', need:7, now:0, forbidJunk:true, untilMs: nowMs()+9000 };
  }

  engine.miniActive = mini;

  coachSay(`🔥 ${mini.name}`, 'neutral');
  pushQuest();
}

function completeMini(){
  if (!engine.miniActive) return;
  engine.miniCleared++;
  coachSay(`✅ ผ่าน! ${engine.miniActive.name}`, 'happy');
  engine.score += 120 + engine.miniCleared*25;
  engine.miniActive = null;
  pushScore();
  pushQuest();
}

function failMini(reason){
  if (!engine.miniActive) return;
  coachSay(`❌ Mini ล้มเหลว (${reason})`, 'sad');
  engine.miniActive = null;
  pushQuest();
}

/* ----------------------------
   Target Spawning
---------------------------- */
function scheduleSpawn(delayMs){
  try{ root.clearTimeout(engine._spawnId); }catch(_){}
  engine._spawnId = root.setTimeout(()=>{
    if (!engine.running || engine.ended) return;
    spawnOne();
    const dt = engine.spawnBaseMs + (engine.rng()*2-1)*engine.spawnJitterMs;
    scheduleSpawn(clamp(dt, 420, 1400));
  }, Math.max(0, delayMs|0));
}

function getPlayRect(){
  const W = root.innerWidth || 360;
  const H = root.innerHeight || 640;

  // กัน HUD บน/goal ขวา/power+coach ล่าง
  const top = 170;
  const bottom = 220;
  const side = 18;

  return { x0: side, y0: top, x1: W - side, y1: H - bottom, W, H };
}

function spawnOne(){
  if (!engine.layerEl) return;

  const r = getPlayRect();
  // safeguard: ถ้าเล็กเกิน -> ขยายโซน
  const w = Math.max(80, r.x1 - r.x0);
  const h = Math.max(80, r.y1 - r.y0);

  let x = r.x0 + engine.rng()*w;
  let y = r.y0 + engine.rng()*h;

  // style influences spread
  if (engine.style === 'feel'){
    // ใกล้กลางมากขึ้น
    x = (x*0.65 + (r.W*0.5)*0.35);
    y = (y*0.65 + (r.H*0.55)*0.35);
  } else if (engine.style === 'hard'){
    // กระจายเต็ม + ชอบขอบ
    if (engine.rng() < 0.35){
      x = (engine.rng() < 0.5) ? (r.x0 + 10) : (r.x1 - 10);
    }
    if (engine.rng() < 0.35){
      y = (engine.rng() < 0.5) ? (r.y0 + 10) : (r.y1 - 10);
    }
  }

  // choose type probabilities
  const p = engine.rng();
  let type = 'good';

  // boss occasionally (more in hard)
  const bossChance = (engine.diff==='hard') ? 0.07 : (engine.diff==='easy' ? 0.03 : 0.05);
  if (p < bossChance){
    type = 'boss';
  } else {
    // junk/wrong/decoy
    const junkBase = (engine.diff==='hard') ? 0.20 : (engine.diff==='easy' ? 0.12 : 0.16);
    const wrongBase= (engine.diff==='hard') ? 0.18 : (engine.diff==='easy' ? 0.10 : 0.14);
    const decoyBase= 0.08;

    const q = engine.rng();
    if (q < junkBase) type = 'junk';
    else if (q < junkBase + wrongBase) type = 'wrong';
    else if (q < junkBase + wrongBase + decoyBase) type = 'decoy';
    else type = 'good';
  }

  const el = DOC.createElement('div');
  el.className = 'fg-target spawn';

  // size
  const sBase = (engine.diff==='hard') ? 0.92 : (engine.diff==='easy' ? 1.08 : 1.00);
  const sJit  = (engine.rng()*0.18 - 0.09);
  const s = clamp(sBase + sJit, 0.82, 1.18);

  el.style.setProperty('--x', x.toFixed(1)+'px');
  el.style.setProperty('--y', y.toFixed(1)+'px');
  el.style.setProperty('--s', s.toFixed(3));

  // emoji & class by type
  if (type === 'good'){
    el.classList.add('fg-good');
    el.dataset.emoji = pick(engine.activeGroup.good, engine.rng);
    el.dataset.kind = 'good';
    engine.nSpawnGood++;
  } else if (type === 'wrong'){
    el.classList.add('fg-wrong');
    // wrong = good จากกลุ่มอื่น
    const other = pick(GROUPS.filter(g=>g.id!==engine.activeGroup.id), engine.rng);
    el.dataset.emoji = pick(other.good, engine.rng);
    el.dataset.kind = 'wrong';
    engine.nSpawnWrong++;
  } else if (type === 'junk'){
    el.classList.add('fg-junk');
    el.dataset.emoji = pick(JUNK, engine.rng);
    el.dataset.kind = 'junk';
    engine.nSpawnJunk++;
  } else if (type === 'decoy'){
    el.classList.add('fg-decoy');
    el.dataset.emoji = pick(DECOY, engine.rng);
    el.dataset.kind = 'decoy';
    engine.nSpawnDecoy++;
  } else {
    el.classList.add('fg-boss');
    // boss uses current group emoji but needs multiple hits
    el.dataset.emoji = pick(engine.activeGroup.good, engine.rng);
    el.dataset.kind = 'boss';
    el.dataset.hp = String((engine.diff==='hard') ? 3 : 2);
    engine.nSpawnBoss++;
  }

  // TTL + expire rules
  const born = nowMs();
  el.dataset.born = String(born);

  engine.layerEl.appendChild(el);

  // remove spawn class after a bit
  root.setTimeout(()=>{ try{ el.classList.remove('spawn'); }catch(_){} }, 220);

  const ttl = engine.freezeOn ? (engine.ttlMs*1.25) : engine.ttlMs;
  root.setTimeout(()=>{
    if (!el.isConnected) return;

    const kind = el.dataset.kind;

    // expire good counts as miss (and affects mini "noExpire")
    if (kind === 'good' || kind === 'boss'){
      // boss expiring counts as miss too (pressure)
      if (engine.miniActive && engine.miniActive.noExpire){
        failMini('good-expired');
      }
      engine.nExpireGood++;
      addMiss('good-expired');
      addFever(6);
      coachPulseMaybe('เสียของ! อย่าให้หมดอายุ 😵', 'sad');
    }
    // wrong/junk/decoy expire no penalty

    // animate out
    try{
      el.classList.add('out');
      root.setTimeout(()=>safeRemove(el), 180);
    }catch(_){ safeRemove(el); }

    pushScore();
    pushRank();
  }, ttl);
}

/* ----------------------------
   Hit Handling
---------------------------- */
let _layerBound = false;

function bindLayer(){
  if (_layerBound) return;
  _layerBound = true;

  // direct click/tap on targets (PC/Mobile)
  engine.layerEl.addEventListener('pointerdown', (e)=>{
    const t = e.target;
    if (!t) return;

    // In cVR we prefer TapFire (shoot center). Still allow direct click if user taps target.
    const el = t.closest ? t.closest('.fg-target') : null;
    if (!el) return;

    try{ e.preventDefault(); }catch(_){}
    hitTarget(el, 'direct');
  }, { passive:false });
}

function hitTarget(el, source='direct'){
  if (!engine.running || engine.ended) return;
  if (!el || !el.isConnected) return;

  const kind = el.dataset.kind || 'good';

  // reaction time sample for good only
  const born = Number(el.dataset.born || 0);
  const rt = (born > 0) ? Math.max(0, nowMs() - born) : 0;

  if (kind === 'good'){
    engine.nHitGood++;
    engine.combo++;
    engine.comboMax = Math.max(engine.comboMax, engine.combo);

    engine.score += scoreGood(rt);
    engine.power = Math.min(engine.powerThr, engine.power + 1);

    addFever(-3.5); // cool down
    coachPulseMaybe(pick([
      'ดีมาก! 👍',
      'เก่ง! ต่อเลย!',
      'แม่นสุดๆ!',
      'จำหมู่ได้แล้วนะ!',
    ], engine.rng), 'happy');

    // goal progress
    engine.goalNow++;
    if (engine.goalNow >= engine.goalNeed){
      engine.goalsCleared++;
      engine.score += 220;
      coachSay(`🎯 ผ่าน GOAL! ${engine.activeGroup.name}`, 'happy');

      if (engine.goalsCleared >= engine.goalsTotal){
        endGame('goal_complete');
        return;
      } else {
        nextGoal(false);
      }
    }

    // mini progress
    if (engine.miniActive){
      if (engine.miniActive.requireStreak){
        engine.miniActive.now = engine.combo; // streak
        if (engine.miniActive.now >= engine.miniActive.need){
          completeMini();
        }
      } else if (engine.miniActive.bossOnly){
        // not count here
      } else if (engine.miniActive.need > 1){
        engine.miniActive.now++;
        if (engine.miniActive.now >= engine.miniActive.need){
          completeMini();
        }
      } else {
        // time survive mini
      }
    }

    if (rt > 0){
      engine.rtList.push(rt);
      if (engine.rtList.length > 60) engine.rtList.shift();
    }

    // overdrive trigger
    if (!engine.overdriveOn && engine.comboMax >= 12 && engine.rng() < 0.18){
      startOverdrive(5200);
    }

    // shield ready?
    if (engine.power >= engine.powerThr){
      engine.power = 0;
      engine.shield++;
      coachSay('🛡️ ได้โล่! ขยะชนได้ 1 ครั้ง (ไม่เป็น MISS)', 'neutral');
      pushFever();
      emit('groups:power', { charge: engine.power, threshold: engine.powerThr });
    } else {
      emit('groups:power', { charge: engine.power, threshold: engine.powerThr });
    }

  } else if (kind === 'wrong'){
    engine.nHitWrong++;
    engine.combo = 0;

    engine.score = Math.max(0, engine.score - 25);
    addFever(8.5);
    addMiss('wrong-hit'); // wrong = miss

    coachPulseMaybe('⚠️ หมู่ผิด!', 'sad');

    if (engine.miniActive && engine.miniActive.requireStreak){
      // streak broken
      engine.miniActive.now = 0;
    }

  } else if (kind === 'junk'){
    engine.nHitJunk++;
    engine.combo = 0;

    if (engine.shield > 0){
      // shield blocks => NO MISS
      engine.shield--;
      coachSay('🛡️ โล่กันขยะ! ยังไม่เป็น MISS', 'neutral');
      addFever(2);
      pushFever();
    } else {
      addFever(11);
      addMiss('junk-hit');
      coachPulseMaybe('🫧 โดนขยะ!', 'sad');

      if (engine.miniActive && engine.miniActive.forbidJunk){
        failMini('hit-junk');
      }
    }

  } else if (kind === 'decoy'){
    // decoy: light penalty, but fun
    engine.combo = Math.max(0, engine.combo - 1);
    engine.score = Math.max(0, engine.score - 8);
    addFever(3);
    coachPulseMaybe('❓ หลอกนะ!', 'neutral');
  } else if (kind === 'boss'){
    // boss needs multiple hits
    let hp = Math.max(1, Number(el.dataset.hp || 2));
    hp -= 1;
    el.dataset.hp = String(hp);

    el.classList.add('fg-boss-hurt');
    root.setTimeout(()=>{ try{ el.classList.remove('fg-boss-hurt'); }catch(_){} }, 220);

    engine.score += 55;
    engine.combo++;
    engine.comboMax = Math.max(engine.comboMax, engine.combo);

    if (engine.miniActive && engine.miniActive.bossOnly){
      engine.miniActive.now++;
      if (engine.miniActive.now >= engine.miniActive.need) completeMini();
    }

    if (hp <= 0){
      engine.score += 90;
      coachSay('👑 บอสแตก! เยี่ยม!', 'happy');
      el.classList.add('hit');
      root.setTimeout(()=>safeRemove(el), 180);

      // reward: small shield chance
      if (engine.rng() < 0.35){
        engine.shield++;
        coachSay('🛡️ โบนัสโล่จากบอส!', 'happy');
        pushFever();
      }
    } else {
      el.classList.add('fg-boss-weak');
    }

  }

  // remove target on hit (except boss with hp left)
  if (kind !== 'boss'){
    try{
      el.classList.add('hit');
      root.setTimeout(()=>safeRemove(el), 180);
    }catch(_){ safeRemove(el); }
  }

  // update quest & ui
  pushScore();
  pushRank();
  pushQuest();

  // adaptive tuning in play mode
  if (engine.runMode === 'play'){
    adaptPacing();
  }
}

function scoreGood(rtMs){
  // faster hit => more score
  const rt = clamp(Number(rtMs)||9999, 180, 1500);
  const speedBonus = Math.round(50 * (1 - (rt-180)/(1500-180))); // 0..50
  const comboBonus = Math.round(clamp(engine.combo,0,30) * 1.6);
  const over = engine.overdriveOn ? 1.25 : 1.0;
  return Math.round((35 + speedBonus + comboBonus) * over);
}

function addMiss(reason){
  engine.misses++;
  // pressure: if too many misses, small freeze chance
  if (!engine.freezeOn && engine.misses >= 6 && engine.rng() < 0.12){
    startFreeze(4200);
  }
}

function addFever(delta){
  engine.fever = clamp(engine.fever + (Number(delta)||0), 0, 100);
  pushFever();

  // fever effects: mild shake on high fever (handled by CSS elsewhere if you want)
  const urgent = engine.fever >= 72;
  setBodyFlag('groups-storm-urgent', urgent);
}

function pushScore(){
  emit('hha:score', {
    score: engine.score,
    combo: engine.combo,
    comboMax: engine.comboMax,
    misses: engine.misses
  });
  emit('groups:power', { charge: engine.power, threshold: engine.powerThr });
}

function pushTime(){
  emit('hha:time', { left: engine.leftSec });
}

function pushQuest(){
  // also auto-start minis
  maybeStartMini();

  const mini = engine.miniActive;
  emit('quest:update', {
    goalTitle: `แตะ ${engine.activeGroup.name} ให้ครบ ${engine.goalNeed}`,
    goalNow: engine.goalNow, goalTotal: engine.goalNeed,

    miniTitle: mini ? mini.name : '—',
    miniNow: mini ? mini.now : 0,
    miniTotal: mini ? mini.need : 0,
    miniTimeLeftSec: mini && mini.untilMs ? Math.max(0, Math.ceil((mini.untilMs - nowMs())/1000)) : 0
  });
}

function pushFever(){
  emit('hha:fever', {
    feverPct: engine.fever,
    shield: engine.shield
  });
}

function accuracyGoodPct(){
  const good = engine.nHitGood;
  const expire = engine.nExpireGood;
  const denom = Math.max(1, good + expire);
  return (good / denom) * 100;
}

function pushRank(){
  const acc = accuracyGoodPct();
  const grade = calcGrade({ accuracyGoodPct: acc, misses: engine.misses, comboMax: engine.comboMax });
  emit('hha:rank', { grade });
}

/* ----------------------------
   Coach helper
---------------------------- */
let _lastCoachMs = 0;
function coachSay(text, mood='neutral'){
  emit('hha:coach', { text, mood });
  _lastCoachMs = nowMs();
}
function coachPulseMaybe(text, mood='neutral'){
  const t = nowMs();
  if (t - _lastCoachMs < 900) return;
  coachSay(text, mood);
}

/* ----------------------------
   Adaptive (play mode only)
---------------------------- */
function adaptPacing(){
  // simple adaptive: based on accuracy & misses
  const acc = accuracyGoodPct();
  const m = engine.misses;

  let targetBase = engine.spawnBaseMs;
  let targetTtl  = engine.ttlMs;

  if (acc >= 82 && m <= 4){
    // harder
    targetBase -= 70;
    targetTtl  -= 140;
  } else if (acc <= 62 || m >= 9){
    // easier
    targetBase += 90;
    targetTtl  += 160;
  }

  // clamp
  engine.spawnBaseMs = clamp(targetBase, 560, 1100);
  engine.ttlMs = clamp(targetTtl, 1650, 2800);
}

/* ----------------------------
   Storm / Overdrive / Freeze
---------------------------- */
function scheduleStormCycle(){
  // deterministic storm schedule by seed
  const r = engine.rng();
  const firstIn = 8000 + Math.floor(r * 6000); // 8..14s
  engine._stormId = root.setTimeout(()=>{
    if (!engine.running || engine.ended) return;
    startStorm(5200 + Math.floor(engine.rng()*2600)); // 5.2..7.8s
  }, firstIn);
}

function startStorm(durationMs){
  engine.stormOn = true;
  setBodyFlag('groups-storm', true);
  coachSay('🌪️ STORM! ระวังเป้าโผล่ถี่ขึ้น!', 'fever');

  const oldBase = engine.spawnBaseMs;
  engine.spawnBaseMs = clamp(engine.spawnBaseMs - 110, 520, 980);

  root.setTimeout(()=>{
    engine.spawnBaseMs = oldBase;
    engine.stormOn = false;
    setBodyFlag('groups-storm', false);
    coachSay('✅ พายุผ่านไปแล้ว!', 'neutral');

    if (engine.running && !engine.ended){
      scheduleStormCycle();
    }
  }, Math.max(1200, durationMs|0));
}

function startOverdrive(durationMs){
  engine.overdriveOn = true;
  setBodyFlag('groups-overdrive', true);
  coachSay('⚡ OVERDRIVE! คะแนนคูณ + เป้าเร็วขึ้น!', 'happy');

  const oldBase = engine.spawnBaseMs;
  engine.spawnBaseMs = clamp(engine.spawnBaseMs - 130, 480, 920);

  root.setTimeout(()=>{
    engine.spawnBaseMs = oldBase;
    engine.overdriveOn = false;
    setBodyFlag('groups-overdrive', false);
    coachSay('หมด OVERDRIVE', 'neutral');
  }, Math.max(1200, durationMs|0));
}

function startFreeze(durationMs){
  engine.freezeOn = true;
  setBodyFlag('groups-freeze', true);
  coachSay('❄️ FREEZE! ช้าลงนิดนึง ตั้งสติ!', 'neutral');

  root.setTimeout(()=>{
    engine.freezeOn = false;
    setBodyFlag('groups-freeze', false);
  }, Math.max(1200, durationMs|0));
}

/* ----------------------------
   Tick loop (time + mini timers)
---------------------------- */
function tick(){
  if (!engine.running || engine.ended) return;

  // time
  const t = nowMs();
  const elapsed = (t - engine.tStartMs) / 1000;
  const left = Math.ceil(engine.timeSec - elapsed);
  engine.leftSec = Math.max(0, left);

  pushTime();

  // mini timer / survive-type minis
  if (engine.miniActive){
    const m = engine.miniActive;

    // timed minis
    if (m.untilMs && m.untilMs > 0){
      const leftSec = Math.max(0, Math.ceil((m.untilMs - t)/1000));

      // urgent cue (UI has class hook in CSS if you want)
      // (ให้ UI ทำ pulse เองผ่าน quest:update ได้)
      emit('quest:update', {
        goalTitle: `แตะ ${engine.activeGroup.name} ให้ครบ ${engine.goalNeed}`,
        goalNow: engine.goalNow, goalTotal: engine.goalNeed,

        miniTitle: m.name,
        miniNow: m.now,
        miniTotal: m.need,
        miniTimeLeftSec: leftSec
      });

      if (leftSec <= 0){
        // timed minis pass/fail condition
        if (m.need === 1 && !m.requireStreak && !m.bossOnly && !m.noExpire){
          // survive type (no specific counter) => pass
          completeMini();
        } else if (m.now >= m.need){
          completeMini();
        } else {
          failMini('timeout');
        }
      }
    } else {
      // non-timed (streak) just keep quest updated
      pushQuest();
    }
  }

  // end by time
  if (engine.leftSec <= 0){
    endGame('time_up');
  }
}

/* ----------------------------
   End game
---------------------------- */
function endGame(reason='end'){
  if (engine.ended) return;
  engine.ended = true;

  // stop spawns/ticks but keep overlay UI
  stop(reason);

  const acc = accuracyGoodPct();
  const grade = calcGrade({ accuracyGoodPct: acc, misses: engine.misses, comboMax: engine.comboMax });

  // final coach
  coachSay(`🏁 จบเกม! เกรด ${grade} | แม่น ${fmtPct(acc)}%`, (grade==='SSS'||grade==='SS'||grade==='S') ? 'happy' : 'neutral');

  emit('hha:end', {
    reason,
    scoreFinal: engine.score,
    comboMax: engine.comboMax,
    misses: engine.misses,

    accuracyGoodPct: Math.round(acc),
    grade,

    // meta stats
    nTargetGoodSpawned: engine.nSpawnGood,
    nTargetJunkSpawned: engine.nSpawnJunk,
    nTargetStarSpawned: 0,
    nTargetDiamondSpawned: 0,
    nTargetShieldSpawned: 0,
    nHitGood: engine.nHitGood,
    nHitJunk: engine.nHitJunk,
    nHitJunkGuard: 0, // (ถ้าต้องการแยก shield-block ให้เพิ่มเอง)
    nExpireGood: engine.nExpireGood,

    goalsCleared: engine.goalsCleared,
    goalsTotal: engine.goalsTotal,
    miniCleared: engine.miniCleared,
    miniTotal: engine.miniTotal,

    runMode: engine.runMode,
    diff: engine.diff,
    style: engine.style,
    durationPlannedSec: engine.timeSec,
    durationPlayedSec: engine.timeSec, // (run html จะคำนวณจริงเพิ่มได้)
    seed: engine.seed
  });
}

/* ----------------------------
   TapFire integration (Cardboard/cVR)
---------------------------- */
function installTapFire(){
  try{
    const TF = root.HHAVRTapFire;
    if(!TF || typeof TF.install !== 'function') return;

    TF.install({
      layerEl: engine.layerEl,
      selector: '.fg-target',
      lockPx: 120,
      isActive: ()=> engine.running && !engine.ended,
      hit: (el)=> hitTarget(el, 'tapfire'),
      margins: { top: 170, bottom: 220, side: 18 }
    });
  }catch(_){}
}

/* ----------------------------
   Expose API
---------------------------- */
NS.GameEngine = {
  setLayerEl,
  start,
  stop,
  end: endGame,
  // for debug
  _state: engine
};

export {};