// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM Emoji Engine (HYPER v3.4)
// ✅ “คำโผล่” GOOD=คำเชียร์เท่านั้น / JUNK=คำเตือนแบบไม่แรง (สุ่มหลายคำ/ชนิด)
// ✅ object ข้างเป้าอิงชนิดอาหารจริง + side objects + color-by-kind prefix (Particles.scorePop)
// ✅ QUEST v2: play(สุ่ม) GOAL 10 เลือก 2 / MINI 15 เลือก 3, research(FIX ไม่สุ่ม)
// ✅ quest:update ยิงตลอด → HUD ต้องแสดงแน่นอน
// ✅ lane แบบ number (1..3) ฝังใน spawn/hit/expire/block + logger

'use strict';

(function (ns) {
  const ROOT = (typeof window !== 'undefined' ? window : globalThis);

  const Particles =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
    ROOT.Particles || { scorePop(){}, burstAt(){}, objPop(){}, toast(){} };

  const FeverUI = ROOT.FeverUI || null;

  const GOOD = ['🍎','🥦','🥕','🍌','🍉','🥛'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🥤'];

  const POWER_SHIELD = '🛡️';
  const POWER_MAGNET = '🧲';
  const POWER_TIME   = '⏳';
  const POWER_FEVER  = '🔥';

  const GOLD = '🟡';
  const FAKE_SPARK = '✨';

  // lane config (number)
  const LANE_N = 3; // 1..3
  const LANE_OFFSETS = [-0.9, 0, 0.9]; // world x offset (meters-ish)

  const DIFF = {
    easy:   { spawnMs: 1050, maxActive: 3, scale: 1.18, goodRatio: 0.78, powerRatio: 0.16, goldRatio: 0.06, fakeRatio: 0.06, bossHP: 6 },
    normal: { spawnMs: 820,  maxActive: 4, scale: 1.02, goodRatio: 0.72, powerRatio: 0.14, goldRatio: 0.07, fakeRatio: 0.08, bossHP: 8 },
    hard:   { spawnMs: 650,  maxActive: 5, scale: 0.92, goodRatio: 0.66, powerRatio: 0.12, goldRatio: 0.08, fakeRatio: 0.10, bossHP: 10 }
  };

  const CHALLENGES = ['rush','survival','boss'];

  let running=false;
  let layerEl=null;
  let active=[];
  let rafId=null, spawnTimer=null, tickTimer=null;

  let score=0;
  let combo=0;
  let comboMax=0;
  let goodHits=0;
  let misses=0;

  let shieldUntil = 0;
  let magnetUntil = 0;

  let feverActive=false;
  let feverPrev=false;

  let durationSec = 60;
  let timeLeft = 60;
  let challenge = 'rush';
  let runMode = 'play';
  let diffKey = 'normal';

  const MAX_LIVES = 3;
  const MISS_PER_LIFE = 3;
  let livesLeft = MAX_LIVES;

  let bossSpawned = false;
  let bossTarget = null;

  let adaptive = { spawnMs: null, maxActive: null, scale: null };
  let lastAdaptAt = 0;

  let idSeq = 0;
  const makeId = ()=> `${Date.now()}-${(++idSeq)}`;

  // -----------------------------
  // Food type mapping (จริง ๆ)
  // -----------------------------
  const FOOD_ALL = [...GOOD, ...JUNK];
  const FOOD_KIND = {
    // good
    '🍎': { cat:'fruit',  name:'ผลไม้' },
    '🍌': { cat:'fruit',  name:'ผลไม้' },
    '🍉': { cat:'fruit',  name:'ผลไม้' },
    '🥦': { cat:'veg',    name:'ผัก' },
    '🥕': { cat:'veg',    name:'ผัก' },
    '🥛': { cat:'dairy',  name:'นม' },

    // junk
    '🍔': { cat:'fried',  name:'ฟาสต์ฟู้ด' },
    '🍟': { cat:'fried',  name:'ของทอด' },
    '🍕': { cat:'fried',  name:'ของมัน' },
    '🍩': { cat:'sweet',  name:'ของหวาน' },
    '🍪': { cat:'sweet',  name:'ขนมหวาน' },
    '🥤': { cat:'soda',   name:'น้ำหวาน' }
  };

  function extractBaseFoodEmoji(emojiStr){
    const s = String(emojiStr || '');
    for (const e of FOOD_ALL){
      if (s.includes(e)) return e;
    }
    return null;
  }
  function foodInfoFromTarget(t){
    const baseFood = extractBaseFoodEmoji(t && t.emoji);
    const info = baseFood ? FOOD_KIND[baseFood] : null;
    return { baseFood, info };
  }

  // -----------------------------
  // Helpers (สุ่มคำ)
  // -----------------------------
  function pickOne(arr, fallback){
    if (!Array.isArray(arr) || !arr.length) return fallback || '';
    return arr[(Math.random() * arr.length) | 0];
  }

  // ✅ คำเชียร์ (GOOD เท่านั้น) — แยกตามชนิด
  const WORD_GOOD_GENERIC = [
    'เก่งมาก!', 'เยี่ยมเลย!', 'สุดยอด!', 'ดีมาก!', 'ไปต่อ!', 'แชมป์!', 'ไหวอยู่!', 'เทพมาก!'
  ];
  const WORD_GOOD_FRUIT = [
    'ผลไม้ดีจัง!', 'สดชื่น!', 'วิตามินมา!', 'เก่งมาก!', 'เลือกถูกแล้ว!', 'ผลไม้ปัง!'
  ];
  const WORD_GOOD_VEG = [
    'ผักเก่ง!', 'แข็งแรง!', 'พลังผัก!', 'สุดยอด!', 'ผักช่วยโต!', 'ผักปัง!'
  ];
  const WORD_GOOD_DAIRY = [
    'นมดี!', 'กระดูกแข็งแรง!', 'แคลเซียมมา!', 'เยี่ยม!', 'นมปัง!', 'โตไว!'
  ];

  // ✅ คำเตือนแบบไม่แรง (JUNK) — แยกตามชนิด
  const WORD_JUNK_GENERIC = [
    'เบาๆ น้า~', 'อันนี้ไม่เอาน้า~', 'พลาดนิดนึง!', 'ลองใหม่!', 'ระวังนะ~', 'ข้ามไปก่อน!'
  ];
  const WORD_JUNK_SWEET = [
    'หวานไปนิด~', 'น้ำตาลเยอะ~', 'ฟันจะงอแง~', 'พอแล้วน้า~', 'ค่อยๆ นะ~'
  ];
  const WORD_JUNK_SODA = [
    'น้ำหวานเยอะ~', 'ดื่มน้ำนะ~', 'หวานจี๊ด~', 'พักก่อน~', 'เลือกน้ำเปล่าดีกว่า~'
  ];
  const WORD_JUNK_FRIED = [
    'มันไปนิด~', 'ทอดเยอะ~', 'พอแล้วน้า~', 'เลือกของดีดีกว่า~', 'ระวังนะ~'
  ];

  // (ยังคงคำสำหรับชนิดอื่น ๆ)
  const WORD_FAKE = ['หลอกนะ!', 'แอบหลอก!', 'อย่าโดนหลอก~', 'ตาไวๆ!', 'ดูดีๆ!'];
  const WORD_BLOCK = ['กันได้!', 'โล่ช่วย!', 'ปลอดภัย!', 'บล็อกแล้ว!', 'รอดแล้ว!'];
  const WORD_GOLD = ['โบนัส!', 'แจ็กพอต!', 'ว้าว!', 'เก่งสุด!', 'ของพิเศษ!'];
  const WORD_POWER_SHIELD = ['โล่มา!', 'กันได้!', 'โล่ป้องกัน!', 'ปลอดภัย!'];
  const WORD_POWER_MAGNET = ['ดูดๆ!', 'มาเลย!', 'เก็บให้หมด!', 'ดูดเข้ามา!'];
  const WORD_POWER_TIME = ['เวลา+!', 'ต่อเวลา!', 'ยังทัน!', 'เพิ่มเวลา!'];
  const WORD_POWER_FEVER = ['ไฟลุก!', 'โหมดไฟ!', 'เร็วๆ!', 'คูณคะแนน!'];
  const WORD_BOSS = ['บอส!', 'สู้ๆ!', 'ตีบอส!', 'เอาชนะ!', 'ไปเลย!'];

  // -----------------------------
  // Side objects + word pops
  // -----------------------------
  function canObjPop(){
    return !!(Particles && typeof Particles.objPop === 'function');
  }

  function pickStreakSpecial(streak){
    if (streak >= 20) return '🏆';
    if (streak >= 16) return '💎';
    if (streak >= 12) return '🌟';
    if (streak >= 10) return '🔥';
    return null;
  }

  function objPairForFood(kind, baseFood, info, power){
    const K = String(kind||'').toLowerCase();

    if (K === 'power'){
      if (power === 'shield') return ['🛡️','✨'];
      if (power === 'magnet') return ['🧲','🧷'];
      if (power === 'time')   return ['⏱️','➕'];
      if (power === 'fever')  return ['🔥','⚡'];
      return ['⚡','✨'];
    }

    if (K === 'block') return ['🛡️','✨'];
    if (K === 'boss')  return ['👑','💥'];

    if (K === 'fake'){
      if (info && info.cat === 'fruit') return ['🌀','🍎'];
      if (info && info.cat === 'veg')   return ['🌀','🥦'];
      if (info && info.cat === 'dairy') return ['🌀','🥛'];
      return ['🌀','💥'];
    }

    if (K === 'junk'){
      if (info && info.cat === 'sweet') return ['🍬','🦷'];
      if (info && info.cat === 'soda')  return ['🥤','😵'];
      if (info && info.cat === 'fried') return ['🍟','🛑'];
      return ['🗑️','💥'];
    }

    if (K === 'gold'){
      if (info && info.cat === 'fruit') return ['🪙','🍃'];
      if (info && info.cat === 'veg')   return ['🪙','🌱'];
      if (info && info.cat === 'dairy') return ['🪙','🦴'];
      return ['🪙','✨'];
    }

    if (info && info.cat === 'fruit') return ['🍃','💧'];
    if (info && info.cat === 'veg')   return ['🌱','💪'];
    if (info && info.cat === 'dairy') return ['🦴','✨'];
    return [baseFood || '🥦','✨'];
  }

  // ✅ NEW: คำโผล่ “สุ่มหลายคำ” + GOOD เชียร์ / JUNK เตือนเบา
  function p5WordFor(kind, baseFood, info, power, streakNow){
    const K = String(kind||'').toLowerCase();

    // power
    if (K === 'power'){
      if (power === 'shield') return pickOne(WORD_POWER_SHIELD, 'โล่มา!');
      if (power === 'magnet') return pickOne(WORD_POWER_MAGNET, 'ดูดๆ!');
      if (power === 'time')   return pickOne(WORD_POWER_TIME, 'เวลา+!');
      if (power === 'fever')  return pickOne(WORD_POWER_FEVER, 'ไฟลุก!');
      return 'พลัง!';
    }

    if (K === 'block') return pickOne(WORD_BLOCK, 'กันได้!');
    if (K === 'boss')  return pickOne(WORD_BOSS, 'บอส!');
    if (K === 'fake')  return pickOne(WORD_FAKE, 'หลอกนะ!');
    if (K === 'gold')  return pickOne(WORD_GOLD, 'โบนัส!');

    // ✅ JUNK = เตือนแบบไม่แรง
    if (K === 'junk'){
      if (info && info.cat === 'sweet') return pickOne(WORD_JUNK_SWEET, 'หวานไปนิด~');
      if (info && info.cat === 'soda')  return pickOne(WORD_JUNK_SODA,  'น้ำหวานเยอะ~');
      if (info && info.cat === 'fried') return pickOne(WORD_JUNK_FRIED, 'มันไปนิด~');
      return pickOne(WORD_JUNK_GENERIC, 'เบาๆ น้า~');
    }

    // ✅ GOOD = เชียร์เท่านั้น
    if (info && info.cat === 'fruit') return pickOne(WORD_GOOD_FRUIT, 'ผลไม้ดีจัง!');
    if (info && info.cat === 'veg')   return pickOne(WORD_GOOD_VEG,   'ผักเก่ง!');
    if (info && info.cat === 'dairy') return pickOne(WORD_GOOD_DAIRY, 'นมดี!');
    return pickOne(WORD_GOOD_GENERIC, 'เก่งมาก!');
  }

  function sideObjectsOnHit(t, x, y, kind, streakNow){
    if (!canObjPop()) return;

    const { baseFood, info } = foodInfoFromTarget(t);
    const s = (streakNow|0);

    let count = 2;
    if (String(kind) === 'gold') count = 2;
    if (String(kind) === 'boss') count = 2;
    if (String(kind) === 'power') count = 2;

    const special = pickStreakSpecial(s);
    const pair = objPairForFood(kind, baseFood, info, t && t.power);

    const n = Math.max(1, Math.min(2, count));
    for (let i=0;i<n;i++){
      let emo = pair[i] || '✨';
      if (i === 1 && special && (kind === 'good' || kind === 'gold') && Math.random() < 0.75){
        emo = special;
      }
      Particles.objPop(x, y, emo, {
        side: (i===0 ? 'left' : 'right'),
        size: (kind === 'gold' || kind === 'boss') ? 26 :
              (kind === 'junk' || kind === 'fake') ? 24 : 22
      });
    }

    // ✅ “คำโผล่” แยกสีตามชนิดด้วย prefix
    if (Particles && typeof Particles.scorePop === 'function'){
      const TAG =
        (kind === 'good')  ? 'GOOD' :
        (kind === 'gold')  ? 'GOLD' :
        (kind === 'junk')  ? 'JUNK' :
        (kind === 'fake')  ? 'FAKE' :
        (kind === 'block') ? 'BLOCK' :
        (kind === 'boss')  ? 'BOSS' :
        (kind === 'power') ? 'POWER' : 'GOOD';

      const word = p5WordFor(kind, baseFood, info, t && t.power, s);
      Particles.scorePop(x, y - 14, '', `[${TAG}] ${word}`, { plain:true });
    }
  }

  // -----------------------------
  // camera helpers
  // -----------------------------
  function getTHREE(){
    return ROOT.THREE || (ROOT.AFRAME && ROOT.AFRAME.THREE) || null;
  }
  function sceneRef(){
    return document.querySelector('a-scene') || null;
  }
  function cameraReady(){
    const scene = sceneRef();
    const THREE = getTHREE();
    return !!(scene && scene.camera && THREE);
  }
  function getCameraObj3D(){
    const camEl = document.querySelector('#gj-camera') || document.querySelector('a-camera');
    return (camEl && camEl.object3D) ? camEl.object3D : null;
  }

  function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
  function clamp01(x){ x=Number(x)||0; return x<0?0:(x>1?1:x); }
  function now(){ return performance.now(); }

  function emitJudge(label, extra){
    ROOT.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ label, ...extra } }));
  }
  function emitMiss(){
    ROOT.dispatchEvent(new CustomEvent('hha:miss',{ detail:{ misses } }));
  }

  function emitFeverEdgeIfNeeded(){
    if (!FeverUI || typeof FeverUI.isActive !== 'function') return;
    feverPrev = feverActive;
    feverActive = !!FeverUI.isActive();
    if (feverActive && !feverPrev){
      ROOT.dispatchEvent(new CustomEvent('hha:fever',{ detail:{ state:'start' } }));
    }else if (!feverActive && feverPrev){
      ROOT.dispatchEvent(new CustomEvent('hha:fever',{ detail:{ state:'end' } }));
    }
  }

  function comboMultiplier(){
    const step = Math.floor((combo||0)/6);
    return clamp(1 + step*0.5, 1, 3);
  }

  function emitScore(){
    if (FeverUI && typeof FeverUI.isActive === 'function'){
      feverActive = !!FeverUI.isActive();
      emitFeverEdgeIfNeeded();
    }else{
      feverActive = false;
      feverPrev = false;
    }
    const shieldOn = (now() < shieldUntil);
    const magnetOn = (now() < magnetUntil);

    ROOT.dispatchEvent(new CustomEvent('hha:score',{
      detail:{
        score, combo, comboMax, goodHits, misses,
        feverActive, shieldOn, magnetOn,
        timeLeft, durationSec, runMode, diff: diffKey, challenge
      }
    }));
  }

  function emitTime(){
    ROOT.dispatchEvent(new CustomEvent('hha:time',{ detail:{ sec: timeLeft } }));
  }

  function emitSpawn(t){
    ROOT.dispatchEvent(new CustomEvent('hha:spawn', {
      detail:{
        timeFromStartMs: null,
        targetId: t.id,
        emoji: t.emoji,
        itemType: t.type === 'power' ? (t.power || 'power') : t.type,
        lane: (t.lane!=null) ? String(t.lane) : ''
      }
    }));
  }

  function emitExpire(t){
    ROOT.dispatchEvent(new CustomEvent('hha:expire', {
      detail:{
        timeFromStartMs: null,
        targetId: t.id,
        emoji: t.emoji,
        itemType: t.type === 'power' ? (t.power || 'power') : t.type,
        lane: (t.lane!=null) ? String(t.lane) : ''
      }
    }));
  }

  function emitHit(t, judgment, rtMs, extra){
    ROOT.dispatchEvent(new CustomEvent('hha:hit', {
      detail:{
        timeFromStartMs: null,
        targetId: t.id,
        emoji: t.emoji,
        itemType: t.type === 'power' ? (t.power || 'power') : t.type,
        judgment: judgment || '',
        rtMs: (typeof rtMs === 'number') ? Math.max(0, rtMs|0) : null,
        totalScore: score,
        combo,
        isGood: (t.type === 'good' || t.type === 'gold'),
        lane: (t.lane!=null) ? String(t.lane) : '',
        extra: extra || null
      }
    }));
  }

  function emitBlock(t, why){
    ROOT.dispatchEvent(new CustomEvent('hha:block', {
      detail:{
        timeFromStartMs: null,
        targetId: t.id,
        emoji: t.emoji,
        itemType: why || t.type || 'junk',
        judgment:'BLOCK',
        lane: (t.lane!=null) ? String(t.lane) : ''
      }
    }));
  }

  function randLane(){
    return 1 + ((Math.random() * LANE_N) | 0);
  }
  function laneToFallbackX(lane){
    const w = window.innerWidth || 1000;
    const thirds = w / LANE_N;
    const center = (lane - 0.5) * thirds;
    const jitter = (Math.random()-0.5) * (thirds * 0.25);
    return Math.round(center + jitter);
  }
  function laneToWorldOffsetX(lane){
    const i = Math.max(0, Math.min(LANE_N-1, (lane|0)-1));
    return LANE_OFFSETS[i] || 0;
  }

  function spawnWorld(lane){
    const THREE = getTHREE();
    const cam = getCameraObj3D();
    if (!cam || !THREE) return null;

    const pos = new THREE.Vector3();
    cam.getWorldPosition(pos);

    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);

    pos.add(dir.multiplyScalar(2.1));

    // lane offset (world X)
    pos.x += laneToWorldOffsetX(lane);

    // small jitter
    pos.x += (Math.random()-0.5)*0.35;
    pos.y += (Math.random()-0.5)*1.5;

    return pos;
  }

  function project(pos){
    const THREE = getTHREE();
    const scene = sceneRef();
    if (!scene || !scene.camera || !THREE || !pos) return null;

    const v = pos.clone().project(scene.camera);
    if (v.z < -1 || v.z > 1) return null;

    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight
    };
  }

  function stageOf(){
    if (challenge === 'survival') return 'mid';
    const elapsed = Math.max(0, durationSec - timeLeft);
    const p = durationSec > 0 ? elapsed / durationSec : 0;
    if (p < 0.33) return 'early';
    if (p < 0.78) return 'mid';
    return 'final';
  }
  function stageSpawnMult(st){
    if (st === 'early') return 1.00;
    if (st === 'mid')   return 0.86;
    return 0.74;
  }

  function createDomEl(){
    const el = document.createElement('div');
    el.className = 'gj-target';
    el.setAttribute('data-hha-tgt','1');
    el.style.display = 'none';
    return el;
  }

  function pickBase(){
    const base = DIFF[diffKey] || DIFF.normal;
    const a = adaptive.spawnMs ? adaptive : base;
    return {
      spawnMs: a.spawnMs || base.spawnMs,
      maxActive: a.maxActive || base.maxActive,
      scale: a.scale || base.scale,
      goodRatio: base.goodRatio,
      powerRatio: base.powerRatio,
      goldRatio: base.goldRatio,
      fakeRatio: base.fakeRatio,
      bossHP: base.bossHP
    };
  }

  function makeTargetSpec(){
    const base = pickBase();
    const r = Math.random();

    if (r < base.powerRatio){
      const pr = Math.random();
      if (pr < 0.34) return { type:'power', power:'shield', emoji: POWER_SHIELD, ttl: 1600 };
      if (pr < 0.67) return { type:'power', power:'magnet', emoji: POWER_MAGNET, ttl: 1600 };
      return { type:'power', power:'time', emoji: POWER_TIME, ttl: 1600 };
    }

    if (r < base.powerRatio + base.fakeRatio){
      const e = GOOD[(Math.random()*GOOD.length)|0];
      return { type:'fake', emoji: e + FAKE_SPARK, ttl: 1900 };
    }

    if (r < base.powerRatio + base.fakeRatio + base.goldRatio){
      const e = GOOD[(Math.random()*GOOD.length)|0];
      return { type:'gold', emoji: GOLD + e, ttl: 1200 };
    }

    const good = (Math.random() < base.goodRatio);
    if (good){
      const e = GOOD[(Math.random()*GOOD.length)|0];
      if (Math.random() < 0.08) return { type:'power', power:'fever', emoji: POWER_FEVER, ttl: 1500 };
      return { type:'good', emoji: e, ttl: 2200 };
    }
    const j = JUNK[(Math.random()*JUNK.length)|0];
    return { type:'junk', emoji: j, ttl: 2200 };
  }

  // =====================================================
  // QUEST RUNTIME v2 (play random / research fixed)
  // play: goals pool 10 pick 2, minis pool 15 pick 3
  // research: fixed (NO random)
  // =====================================================
  const QUEST_CFG = {
    goalsPick: 2,
    minisPick: 3,
    researchFixed: {
      goals: ['G01','G02'],
      minis: ['M01','M11','M05']
    }
  };

  function pickN(arr, n){
    const a = (arr||[]).slice();
    for (let i=a.length-1;i>0;i--){
      const j = (Math.random()*(i+1))|0;
      const t=a[i]; a[i]=a[j]; a[j]=t;
    }
    return a.slice(0, Math.max(0, n|0));
  }

  const QSTAT = {
    goodHit: 0,
    goldHit: 0,
    junkHit: 0,
    fakeHit: 0,
    block: 0,
    powerShield: 0,
    powerMagnet: 0,
    powerTime: 0,
    powerFever: 0,

    fruitGood: 0,
    vegGood: 0,
    dairyGood: 0,

    noBadOk: true,         // “ช่วงนี้” ยังไม่โดน junk/fake/miss
    noBadStartMs: 0,
    lastBadAtMs: 0,

    showGoalIdx: 0,
    showMiniIdx: 0,
    lastRotateAt: 0
  };

  function qFoodInfoFromEmoji(emojiStr){
    const base = extractBaseFoodEmoji(emojiStr);
    const info = base ? FOOD_KIND[base] : null;
    return { baseFood: base, info };
  }

  function makeCounterQuest(id, title, total, getter){
    return {
      id, title,
      total: (total==null) ? 1 : Math.max(1, total|0),
      getCur: getter,
      eval(){
        const cur = Math.max(0, Number(getter())||0);
        const done = cur >= this.total;
        return { cur, total:this.total, prog: (this.total>0)?clamp01(cur/this.total):0, done };
      }
    };
  }
  function makeTimerQuest(id, title, sec, getSecOk){
    return {
      id, title,
      total: Math.max(1, sec|0),
      getCur: ()=>0,
      eval(){
        const cur = Math.floor(Number(getSecOk())||0);
        const done = cur >= this.total;
        return { cur, total:this.total, prog: (this.total>0)?clamp01(cur/this.total):0, done };
      }
    };
  }

  const GOAL_POOL = [
    makeCounterQuest('G01','เก็บของดีให้ครบ 25 ชิ้น', 25, ()=> QSTAT.goodHit),
    makeCounterQuest('G02','ทำคะแนนให้ถึง 2500',      2500, ()=> score|0),
    makeCounterQuest('G03','ทำคอมโบสูงสุดให้ถึง 12',  12, ()=> comboMax|0),
    makeCounterQuest('G04','เก็บผลไม้ให้ครบ 10',       10, ()=> QSTAT.fruitGood),
    makeCounterQuest('G05','เก็บผักให้ครบ 10',         10, ()=> QSTAT.vegGood),
    makeCounterQuest('G06','เก็บนมให้ครบ 6',            6, ()=> QSTAT.dairyGood),
    makeCounterQuest('G07','เก็บ GOLD ให้ได้ 3 ครั้ง',  3, ()=> QSTAT.goldHit),
    makeCounterQuest('G08','บล็อกการโจมตีให้ได้ 3',    3, ()=> QSTAT.block),
    makeCounterQuest('G09','ใช้พลังโล่ 1 ครั้ง',        1, ()=> QSTAT.powerShield),
    makeCounterQuest('G10','พลาดรวมไม่เกิน 3',          3, ()=> (3 - (misses|0)))
  ];

  const MINI_POOL = [
    makeCounterQuest('M01','ทำสตรีค 8 ครั้งติด', 8, ()=> combo|0),
    makeCounterQuest('M02','เก็บผลไม้ 6 ชิ้น',   6, ()=> QSTAT.fruitGood),
    makeCounterQuest('M03','เก็บผัก 6 ชิ้น',     6, ()=> QSTAT.vegGood),
    makeCounterQuest('M04','เก็บนม 3 ชิ้น',      3, ()=> QSTAT.dairyGood),
    makeCounterQuest('M05','เก็บ GOLD 2 ครั้ง',  2, ()=> QSTAT.goldHit),
    makeCounterQuest('M06','บล็อกขยะ/หลอก 2 ครั้ง', 2, ()=> QSTAT.block),
    makeCounterQuest('M07','ใช้โล่ 1 ครั้ง',     1, ()=> QSTAT.powerShield),
    makeCounterQuest('M08','ใช้แม่เหล็ก 1 ครั้ง',1, ()=> QSTAT.powerMagnet),
    makeCounterQuest('M09','เพิ่มเวลา 1 ครั้ง',  1, ()=> QSTAT.powerTime),
    makeCounterQuest('M10','ติด FEVER 1 ครั้ง',  1, ()=> QSTAT.powerFever),

    // timer minis: วัดช่วงที่ “ยังไม่พลาด/ไม่โดน junk/fake”
    makeTimerQuest('M11','10 วิ ห้ามโดนขยะ/หลอก/พลาด', 10, ()=> {
      if (!QSTAT.noBadOk) return 0;
      return (now() - (QSTAT.noBadStartMs||now()))/1000;
    }),
    makeTimerQuest('M12','8 วิ ทำให้เนียน', 8, ()=> {
      if (!QSTAT.noBadOk) return 0;
      return (now() - (QSTAT.noBadStartMs||now()))/1000;
    }),

    makeCounterQuest('M13','ตีของดี 5 ครั้งรวด', 5, ()=> Math.min(5, combo|0)),
    makeCounterQuest('M14','ทำคะแนนให้ถึง 500', 500, ()=> score|0),
    makeCounterQuest('M15','อย่าโดนหลอก (FAKE) เลย', 1, ()=> (QSTAT.fakeHit===0 ? 1 : 0))
  ];

  const QUEST = {
    activeGoals: [],
    activeMinis: [],
    doneGoals: {},
    doneMinis: {},
    started: false
  };

  function findQuest(pool, id){
    for (const q of pool){ if (q && q.id === id) return q; }
    return null;
  }

  function pickFixedSet(){
    // FIX สำหรับ research (ปรับได้ตามที่คุณต้องล็อก)
    return QUEST_CFG.researchFixed;
  }

  function buildActiveQuests(){
    if (runMode === 'research'){
      const fixed = pickFixedSet();
      QUEST.activeGoals = (fixed.goals||[]).map(id=>findQuest(GOAL_POOL,id)).filter(Boolean);
      QUEST.activeMinis = (fixed.minis||[]).map(id=>findQuest(MINI_POOL,id)).filter(Boolean);
    }else{
      QUEST.activeGoals = pickN(GOAL_POOL, QUEST_CFG.goalsPick);
      QUEST.activeMinis = pickN(MINI_POOL, QUEST_CFG.minisPick);
    }
    QUEST.doneGoals = {};
    QUEST.doneMinis = {};
    QSTAT.showGoalIdx = 0;
    QSTAT.showMiniIdx = 0;
    QSTAT.lastRotateAt = 0;
  }

  function resetQuestStats(){
    QSTAT.goodHit = 0;
    QSTAT.goldHit = 0;
    QSTAT.junkHit = 0;
    QSTAT.fakeHit = 0;
    QSTAT.block = 0;
    QSTAT.powerShield = 0;
    QSTAT.powerMagnet = 0;
    QSTAT.powerTime = 0;
    QSTAT.powerFever = 0;

    QSTAT.fruitGood = 0;
    QSTAT.vegGood = 0;
    QSTAT.dairyGood = 0;

    QSTAT.noBadOk = true;
    QSTAT.noBadStartMs = now();
    QSTAT.lastBadAtMs = 0;
  }

  function emitQuestUpdate(){
    const gList = QUEST.activeGoals || [];
    const mList = QUEST.activeMinis || [];

    // rotate display (HUD ตอนนี้โชว์ทีละรายการ → สลับให้เห็นครบ)
    const t = now();
    if (t - (QSTAT.lastRotateAt||0) > 2800){
      QSTAT.lastRotateAt = t;
      if (gList.length > 1) QSTAT.showGoalIdx = (QSTAT.showGoalIdx + 1) % gList.length;
      if (mList.length > 1) QSTAT.showMiniIdx = (QSTAT.showMiniIdx + 1) % mList.length;
    }

    const gIdx = Math.max(0, Math.min(gList.length-1, QSTAT.showGoalIdx|0));
    const mIdx = Math.max(0, Math.min(mList.length-1, QSTAT.showMiniIdx|0));

    const g = gList[gIdx];
    const m = mList[mIdx];

    const gEval = g ? g.eval() : { cur:0,total:0,prog:0,done:false };
    const mEval = m ? m.eval() : { cur:0,total:0,prog:0,done:false };

    const goalTitle = g ? `GOAL ${gIdx+1}/${gList.length}: ${g.title}` : 'กำลังสุ่มภารกิจ…';
    const miniTitle = m ? `MINI ${mIdx+1}/${mList.length}: ${m.title}` : 'กำลังสุ่ม mini quest…';

    ROOT.dispatchEvent(new CustomEvent('quest:update', {
      detail:{
        goal: { title: goalTitle, ...gEval },
        mini: { title: miniTitle, ...mEval },
        extra:{
          goals: gList.map((q,i)=>({ i:i+1, id:q.id, title:q.title, ...q.eval(), done: !!QUEST.doneGoals[q.id] })),
          minis: mList.map((q,i)=>({ i:i+1, id:q.id, title:q.title, ...q.eval(), done: !!QUEST.doneMinis[q.id] }))
        }
      }
    }));
  }

  function checkQuestCompletion(){
    let changed = false;

    for (const q of (QUEST.activeGoals||[])){
      const e = q.eval();
      if (e.done && !QUEST.doneGoals[q.id]){
        QUEST.doneGoals[q.id] = true;
        changed = true;
        ROOT.dispatchEvent(new CustomEvent('hha:celebrate',{ detail:{ type:'goal', id:q.id, title:q.title } }));
      }
    }

    for (const q of (QUEST.activeMinis||[])){
      const e = q.eval();
      if (e.done && !QUEST.doneMinis[q.id]){
        QUEST.doneMinis[q.id] = true;
        changed = true;
        ROOT.dispatchEvent(new CustomEvent('hha:celebrate',{ detail:{ type:'mini', id:q.id, title:q.title } }));
      }
    }

    if (changed) emitQuestUpdate();
  }

  function initQuestRun(){
    resetQuestStats();
    buildActiveQuests();
    QUEST.started = true;
    emitQuestUpdate(); // ✅ ให้ QUEST panel โผล่ทันที
  }

  function questSummary(){
    const g = QUEST.activeGoals || [];
    const m = QUEST.activeMinis || [];
    let gCleared = 0, mCleared = 0;
    for (const q of g) if (QUEST.doneGoals[q.id]) gCleared++;
    for (const q of m) if (QUEST.doneMinis[q.id]) mCleared++;
    return {
      goalsCleared: gCleared,
      goalsTotal: g.length,
      miniCleared: mCleared,
      miniTotal: m.length
    };
  }

  // =====================================================

  function createTarget(spec){
    if (!layerEl) return;

    const el = createDomEl();
    const base = pickBase();
    el.style.setProperty('--tScale', String(base.scale));

    el.classList.add(
      spec.type === 'junk' ? 'gj-junk' :
      spec.type === 'fake' ? 'gj-fake' :
      spec.type === 'gold' ? 'gj-gold' :
      spec.type === 'power' ? 'gj-power' : 'gj-good'
    );

    el.textContent = spec.emoji;

    const lane = randLane();

    const fallback2D = {
      x: laneToFallbackX(lane),
      y: Math.round(window.innerHeight * (0.22 + Math.random()*0.58))
    };

    const t = {
      id: makeId(),
      el,
      type: spec.type,
      power: spec.power || null,
      emoji: spec.emoji,
      lane,
      pos: spawnWorld(lane),
      born: now(),
      ttl: spec.ttl || 2200,
      seen: false,
      fallback2D,
      wobbleSeed: Math.random()*10,
    };

    active.push(t);
    layerEl.appendChild(el);

    emitSpawn(t);

    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      hitTarget(t, e.clientX || 0, e.clientY || 0);
    });

    setTimeout(()=>expireTarget(t), t.ttl);
  }

  function removeTarget(t){
    const i = active.indexOf(t);
    if (i >= 0) active.splice(i,1);
    if (t.el) t.el.remove();
  }

  function markBadEvent(){
    QSTAT.noBadOk = false;
    QSTAT.lastBadAtMs = now();
  }
  function recoverBadWindowOnGood(){
    // เมื่อทำของดีหลังพลาด → เริ่มจับเวลาใหม่
    if (!QSTAT.noBadOk){
      QSTAT.noBadOk = true;
      QSTAT.noBadStartMs = now();
    }
  }

  function expireTarget(t){
    if (!running) return;
    removeTarget(t);

    emitExpire(t);

    if ((t.type === 'good' || t.type === 'gold') && t.seen){
      misses++;
      combo = 0;

      markBadEvent();

      emitScore();
      emitMiss();
      emitJudge('MISS');

      checkQuestCompletion();
      emitQuestUpdate();

      checkSurvivalLives();
    }
  }

  function shieldOn(){ return now() < shieldUntil; }
  function magnetOn(){ return now() < magnetUntil; }

  function feverAdd(v){
    if (!FeverUI || typeof FeverUI.add !== 'function') return;
    FeverUI.add(v);
  }
  function feverReduce(v){
    if (!FeverUI || typeof FeverUI.add !== 'function') return;
    FeverUI.add(-Math.abs(v||0));
  }

  function hitTarget(t, x, y){
    if (!t || !t.el) return;

    const rtMs = now() - (t.born || now());

    if (t.type === 'boss'){
      t.hp = (t.hp|0) - 1;

      sideObjectsOnHit(t, x, y, 'boss', combo);

      if (Particles && Particles.scorePop) Particles.scorePop(x,y,'','[BOSS] '+pickOne(WORD_BOSS,'บอส!'),{ plain:true });
      emitJudge('BOSS HIT!');
      emitHit(t, 'BOSS_HIT', rtMs, { hp: t.hp });

      if (t.hp <= 0){
        removeTarget(t);
        bossTarget = null;

        const mult = comboMultiplier();
        const feverNow = (FeverUI && FeverUI.isActive) ? !!FeverUI.isActive() : false;
        const add = Math.round((240 * mult) * (feverNow ? 1.2 : 1));
        score += add;
        combo += 2;
        comboMax = Math.max(comboMax, combo);

        if (Particles && Particles.burstAt){
          Particles.burstAt(window.innerWidth/2, window.innerHeight*0.22, 'GOLD');
        }

        if (canObjPop()){
          Particles.objPop(x, y, '🏆', { side:'left', size: 28 });
          Particles.objPop(x, y, '👑', { side:'right', size: 28 });
        }

        emitJudge('BOSS CLEAR!');
        ROOT.dispatchEvent(new CustomEvent('quest:bossClear',{ detail:{ ok:true } }));

        checkQuestCompletion();
        emitQuestUpdate();

        emitScore();
      }else{
        t.el.style.setProperty('--tScale', String((pickBase().scale||1) * 1.12));
        t.el.textContent = '🥦👑' + ' ' + '×' + t.hp;

        emitQuestUpdate();
        emitScore();
      }
      return;
    }

    removeTarget(t);

    // POWER
    if (t.type === 'power'){
      sideObjectsOnHit(t, x, y, 'power', combo);

      if (t.power === 'shield'){
        shieldUntil = now() + 5000;
        QSTAT.powerShield++;
        emitJudge('SHIELD ON!');
        emitHit(t, 'POWER_SHIELD', rtMs);
        emitScore();
        ROOT.dispatchEvent(new CustomEvent('quest:power',{ detail:{ power:'shield' } }));

        checkQuestCompletion();
        emitQuestUpdate();
        return;
      }
      if (t.power === 'magnet'){
        magnetUntil = now() + 4000;
        QSTAT.powerMagnet++;
        emitJudge('MAGNET!');
        emitHit(t, 'POWER_MAGNET', rtMs);
        emitScore();
        ROOT.dispatchEvent(new CustomEvent('quest:power',{ detail:{ power:'magnet' } }));

        checkQuestCompletion();
        emitQuestUpdate();
        return;
      }
      if (t.power === 'time'){
        if (challenge !== 'survival'){
          timeLeft = clamp(timeLeft + 3, 0, 180);
          emitTime();
        }
        QSTAT.powerTime++;
        emitJudge('TIME +3!');
        emitHit(t, 'POWER_TIME', rtMs);
        emitScore();
        ROOT.dispatchEvent(new CustomEvent('quest:power',{ detail:{ power:'time' } }));

        checkQuestCompletion();
        emitQuestUpdate();
        return;
      }
      if (t.power === 'fever'){
        feverAdd(22);
        QSTAT.powerFever++;
        emitJudge('FEVER+');
        emitHit(t, 'POWER_FEVER', rtMs);
        emitScore();
        ROOT.dispatchEvent(new CustomEvent('quest:power',{ detail:{ power:'fever' } }));

        checkQuestCompletion();
        emitQuestUpdate();
        return;
      }
    }

    // FAKE
    if (t.type === 'fake'){
      if (shieldOn()){
        sideObjectsOnHit(t, x, y, 'block', combo);
        QSTAT.block++;
        emitJudge('BLOCK!');
        emitBlock(t, 'fake');
        emitScore();
        ROOT.dispatchEvent(new CustomEvent('quest:block',{ detail:{ ok:true, why:'fake' } }));

        checkQuestCompletion();
        emitQuestUpdate();
        return;
      }

      ROOT.dispatchEvent(new CustomEvent('quest:badHit', { detail:{ type:'fake' } }));

      misses++;
      combo = 0;
      feverReduce(18);

      QSTAT.fakeHit++;
      markBadEvent();

      sideObjectsOnHit(t, x, y, 'fake', combo);

      emitHit(t, 'HIT_FAKE', rtMs);
      emitScore();
      emitMiss();
      emitJudge('MISS', { why:'fake' });
      checkSurvivalLives();
      ROOT.dispatchEvent(new CustomEvent('quest:fakeHit',{ detail:{ hit:true } }));

      checkQuestCompletion();
      emitQuestUpdate();
      return;
    }

    // JUNK
    if (t.type === 'junk'){
      if (shieldOn()){
        sideObjectsOnHit(t, x, y, 'block', combo);
        QSTAT.block++;
        emitJudge('BLOCK!');
        emitBlock(t, 'junk');
        emitScore();
        ROOT.dispatchEvent(new CustomEvent('quest:block',{ detail:{ ok:true, why:'junk' } }));

        checkQuestCompletion();
        emitQuestUpdate();
        return;
      }

      ROOT.dispatchEvent(new CustomEvent('quest:badHit', { detail:{ type:'junk' } }));

      misses++;
      combo = 0;
      feverReduce(12);

      QSTAT.junkHit++;
      markBadEvent();

      sideObjectsOnHit(t, x, y, 'junk', combo);

      emitHit(t, 'HIT_JUNK', rtMs);
      emitScore();
      emitMiss();
      emitJudge('MISS');
      checkSurvivalLives();

      checkQuestCompletion();
      emitQuestUpdate();
      return;
    }

    // GOOD / GOLD
    goodHits++;
    combo++;
    comboMax = Math.max(comboMax, combo);

    QSTAT.goodHit++;
    if (t.type === 'gold') QSTAT.goldHit++;

    const fi = qFoodInfoFromEmoji(t.emoji);
    if (fi && fi.info){
      if (fi.info.cat === 'fruit') QSTAT.fruitGood++;
      if (fi.info.cat === 'veg')   QSTAT.vegGood++;
      if (fi.info.cat === 'dairy') QSTAT.dairyGood++;
    }

    recoverBadWindowOnGood();

    sideObjectsOnHit(t, x, y, (t.type === 'gold') ? 'gold' : 'good', combo);

    if (t.type === 'gold') feverAdd(10);
    else feverAdd(4);

    const feverNow = (FeverUI && typeof FeverUI.isActive === 'function') ? !!FeverUI.isActive() : false;
    const mult = comboMultiplier();

    let base = 10;
    if (t.type === 'gold') base = 80;
    if (feverNow) base = Math.round(base * 1.7);

    const st = stageOf();
    if (challenge === 'rush'){
      if (st === 'mid') base = Math.round(base * 1.12);
      if (st === 'final') base = Math.round(base * 1.25);
    }

    const add = Math.round(base * mult);
    score += add;

    if (Particles && typeof Particles.scorePop === 'function'){
      Particles.scorePop(
        x, y,
        '+' + add,
        (t.type === 'gold')
          ? '[GOLD] '+pickOne(WORD_GOLD,'โบนัส!')
          : '[GOOD] '+pickOne(WORD_GOOD_GENERIC,'เก่งมาก!')
      );
    }
    if (Particles && typeof Particles.burstAt === 'function'){
      if (t.type === 'gold') Particles.burstAt(x,y,'GOLD');
      if (st === 'final' && Math.random() < 0.15) Particles.burstAt(x,y,'GOOD');
    }

    emitHit(t, (t.type === 'gold') ? 'HIT_GOLD' : 'HIT_GOOD', rtMs, { add, mult, feverNow });
    emitJudge(combo >= 10 ? 'PERFECT' : 'GOOD', { mult });
    emitScore();

    ROOT.dispatchEvent(new CustomEvent('quest:goodHit',{ detail:{ type:t.type, add, mult, feverNow } }));

    checkQuestCompletion();
    emitQuestUpdate();
  }

  function checkSurvivalLives(){
    if (challenge !== 'survival') return;
    const lost = Math.floor((misses|0) / MISS_PER_LIFE);
    livesLeft = Math.max(0, MAX_LIVES - lost);
    ROOT.dispatchEvent(new CustomEvent('hha:lives',{ detail:{ livesLeft, max: MAX_LIVES } }));
    if (livesLeft <= 0){
      stop('lives-zero');
    }
  }

  function adaptIfNeeded(){
    if (runMode !== 'play') return;
    if (challenge === 'survival') return;
    const t = now();
    if (t - lastAdaptAt < 5200) return;
    lastAdaptAt = t;

    const base = DIFF[diffKey] || DIFF.normal;
    const missRate = (misses <= 0) ? 0 : (misses / Math.max(1, goodHits + misses));
    const cm = comboMax|0;

    let spawnMs = base.spawnMs;
    let maxActive = base.maxActive;
    let scale = base.scale;

    if (cm >= 12 && missRate < 0.22){
      spawnMs = Math.round(base.spawnMs * 0.86);
      maxActive = Math.min(base.maxActive + 1, 6);
      scale = base.scale * 0.95;
      emitJudge('LEVEL UP!');
    } else if (missRate > 0.38){
      spawnMs = Math.round(base.spawnMs * 1.08);
      maxActive = Math.max(base.maxActive - 1, 2);
      scale = base.scale * 1.06;
      emitJudge('EASY DOWN!');
    }

    adaptive = { spawnMs, maxActive, scale };
    ROOT.dispatchEvent(new CustomEvent('hha:adaptive', { detail:{ ...adaptive } }));
  }

  function maybeSpawnBoss(){
    if (challenge !== 'boss') return;
    if (bossSpawned) return;
    if (durationSec <= 0) return;
    if (timeLeft > 12) return;
    bossSpawned = true;

    for (const t of active.slice()){
      if (t && t.type !== 'boss') removeTarget(t);
    }

    const el = createDomEl();
    el.classList.add('gj-boss');
    const base = pickBase();
    el.style.setProperty('--tScale', String(base.scale * 1.28));

    const hp = (base.bossHP|0) || 8;
    const lane = 2;

    const t = {
      id: makeId(),
      el,
      type:'boss',
      emoji:'🥦👑 ×' + hp,
      hp,
      lane,
      pos: spawnWorld(lane),
      born: now(),
      ttl: 999999,
      seen: false,
      fallback2D: { x: window.innerWidth/2, y: window.innerHeight*0.38 },
      wobbleSeed: Math.random()*10
    };
    el.textContent = t.emoji;

    active.push(t);
    layerEl.appendChild(el);

    emitSpawn(t);

    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      hitTarget(t, e.clientX || 0, e.clientY || 0);
    });

    bossTarget = t;
    emitJudge('BOSS!');
    ROOT.dispatchEvent(new CustomEvent('quest:boss', { detail:{ hp } }));

    emitQuestUpdate();
  }

  function renderLoop(){
    if (!running) return;

    const ready = cameraReady();
    const st = stageOf();

    for (const t of active){
      if (!t || !t.el) continue;

      if (!t.pos && ready) t.pos = spawnWorld(t.lane);

      let p = null;
      if (ready && t.pos) p = project(t.pos);
      if (!p) p = t.fallback2D;
      else t.seen = true;

      if (magnetOn()){
        const cx = window.innerWidth/2;
        const cy = window.innerHeight/2;
        const k = 0.18;
        p = { x: p.x + (cx - p.x)*k, y: p.y + (cy - p.y)*k };
      }

      if (st !== 'early'){
        const tt = (now() - t.born) / 1000;
        const amp = (st === 'final') ? 10 : 6;
        p.x += Math.sin(tt*2.2 + t.wobbleSeed)*amp;
        p.y += Math.cos(tt*2.0 + t.wobbleSeed)*amp*0.8;
      }

      t.el.style.display = 'block';
      t.el.style.left = p.x + 'px';
      t.el.style.top  = p.y + 'px';
    }

    rafId = requestAnimationFrame(renderLoop);
  }

  function spawnLoop(){
    if (!running) return;

    const base = pickBase();
    const st = stageOf();

    maybeSpawnBoss();

    if (!bossTarget && active.length < base.maxActive){
      const spec = makeTargetSpec();
      createTarget(spec);
    }

    let ms = base.spawnMs;
    ms = Math.round(ms * stageSpawnMult(st));
    if (challenge === 'rush' && st === 'final') ms = Math.round(ms * 0.86);

    adaptIfNeeded();

    spawnTimer = setTimeout(spawnLoop, ms);
  }

  function tickLoop(){
    if (!running) return;

    emitFeverEdgeIfNeeded();

    if (challenge !== 'survival'){
      timeLeft = Math.max(0, (timeLeft|0) - 1);
      emitTime();
      if (timeLeft <= 0){
        stop('time-up');
        return;
      }
    }

    // ✅ ให้ timer-minis เดิน + HUD ไม่ว่าง
    if (QUEST && QUEST.started){
      checkQuestCompletion();
      emitQuestUpdate();
    }

    tickTimer = setTimeout(tickLoop, 1000);
  }

  function start(diff, opts={}){
    if (running) return;

    running = true;
    layerEl = opts.layerEl || document.getElementById('gj-layer');

    diffKey = String(diff || 'normal').toLowerCase();
    if (!DIFF[diffKey]) diffKey = 'normal';

    runMode = (opts.runMode === 'research') ? 'research' : 'play';

    challenge = String(opts.challenge || 'rush').toLowerCase();
    if (!CHALLENGES.includes(challenge)) challenge = 'rush';

    durationSec = clamp(opts.durationSec ?? 60, 20, 180);
    timeLeft = durationSec;

    score=0; combo=0; comboMax=0; goodHits=0; misses=0;
    shieldUntil = 0;
    magnetUntil = 0;
    bossSpawned = false;
    bossTarget = null;

    adaptive = { spawnMs: null, maxActive: null, scale: null };
    lastAdaptAt = 0;

    livesLeft = MAX_LIVES;
    ROOT.dispatchEvent(new CustomEvent('hha:lives',{ detail:{ livesLeft, max: MAX_LIVES } }));

    if (FeverUI && typeof FeverUI.reset === 'function'){
      FeverUI.reset();
    }

    ROOT.dispatchEvent(new CustomEvent('hha:mode', { detail:{ diff:diffKey, runMode, challenge, durationSec } }));

    // ✅ เปิด Quest ตามสเปค: play random 2/3, research fixed
    initQuestRun();
    emitQuestUpdate();

    emitTime();
    emitScore();

    renderLoop();
    spawnLoop();
    tickLoop();

    console.log('[GoodJunkVR] start', { diffKey, runMode, challenge, durationSec });
  }

  function stop(reason='stop'){
    if (!running) return;
    running = false;

    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (spawnTimer) clearTimeout(spawnTimer);
    spawnTimer = null;
    if (tickTimer) clearTimeout(tickTimer);
    tickTimer = null;

    const copy = active.slice();
    for (const t of copy) removeTarget(t);
    active.length = 0;

    const qs = questSummary();

    ROOT.dispatchEvent(new CustomEvent('hha:end',{
      detail:{
        scoreFinal:score,
        comboMax,
        misses,
        goodHits,
        reason,
        timeLeft,
        durationSec,
        runMode,
        diff: diffKey,
        challenge,
        stats: {
          ...qs
        }
      }
    }));
  }

  ns.GameEngine = { start, stop };

})(window.GoodJunkVR = window.GoodJunkVR || {});

export const GameEngine = window.GoodJunkVR.GameEngine;
