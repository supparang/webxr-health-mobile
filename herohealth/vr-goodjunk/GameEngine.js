// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM Emoji Engine (PROD v3.5)
// ✅ QUEST v3:
//    - play: สุ่ม "ตามระดับ diff" (easy/normal/hard) จาก POOL ที่แบ่งระดับไว้
//    - research: FIX (ไม่สุ่ม) ตามชุดที่ lock (hard / hard_alt)
// ✅ WARMUP (play only) -> auto LOCK hard / hard_alt ตาม performance
// ✅ LOCK (research): เลือกตาม opts.forceSet หรือ default hard
// ✅ Logging schema:
//    - dispatch hha:log_session (sessions row)
//    - dispatch hha:log_event   (events row)
// ✅ goalProgress/miniProgress ผูกลงทุก event (จาก quest:update)
// ✅ lane (1..3) ลงใน spawn/hit/expire/block
// ✅ Miss definition (ตามที่คุยไว้): miss = good expired + junk hit (shield block ไม่นับ miss)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

(function (ns) {
  // -----------------------------
  // External modules (optional)
  // -----------------------------
  const Particles =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
    ROOT.Particles || { scorePop(){}, burstAt(){}, objPop(){}, toast(){}, celebrate(){} };

  const FeverUI = ROOT.FeverUI || null;

  // -----------------------------
  // Helpers
  // -----------------------------
  function isoNow() { return new Date().toISOString(); }
  function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
  function clamp01(x){ x=Number(x)||0; return x<0?0:(x>1?1:x); }
  function pickOne(arr, fb=''){ return (Array.isArray(arr)&&arr.length) ? arr[(Math.random()*arr.length)|0] : fb; }
  function shuffle(a){
    const b=(a||[]).slice();
    for (let i=b.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const t=b[i]; b[i]=b[j]; b[j]=t; }
    return b;
  }
  function pickN(arr,n){ return shuffle(arr).slice(0, Math.max(0, n|0)); }
  function median(arr){
    if (!Array.isArray(arr) || !arr.length) return null;
    const a = arr.slice().sort((x,y)=>x-y);
    const m = (a.length/2)|0;
    return (a.length%2) ? a[m] : Math.round((a[m-1]+a[m])/2);
  }
  function avg(arr){
    if (!Array.isArray(arr) || !arr.length) return null;
    let s=0; for (const x of arr) s += (Number(x)||0);
    return Math.round(s / arr.length);
  }
  function dispatch(name, detail){
    try { ROOT.dispatchEvent(new CustomEvent(name, { detail })); } catch (_) {}
  }
  function nowMs(){
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  // -----------------------------
  // Emoji sets
  // -----------------------------
  const GOOD = ['🍎','🥦','🥕','🍌','🍉','🥛'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🥤'];

  const POWER_SHIELD = '🛡️';
  const POWER_MAGNET = '🧲';
  const POWER_TIME   = '⏳';
  const POWER_FEVER  = '🔥';

  const GOLD = '🟡';
  const FAKE_SPARK = '✨';

  // lane config (1..3)
  const LANE_N = 3;
  const LANE_OFFSETS = [-0.9, 0, 0.9];

  // -----------------------------
  // Difficulty (base)
  // -----------------------------
  const DIFF = {
    easy:   { spawnMs: 1050, maxActive: 3, scale: 1.18, goodRatio: 0.78, powerRatio: 0.16, goldRatio: 0.06, fakeRatio: 0.06, bossHP: 6 },
    normal: { spawnMs: 820,  maxActive: 4, scale: 1.02, goodRatio: 0.72, powerRatio: 0.14, goldRatio: 0.07, fakeRatio: 0.08, bossHP: 8 },
    hard:   { spawnMs: 650,  maxActive: 5, scale: 0.92, goodRatio: 0.66, powerRatio: 0.12, goldRatio: 0.08, fakeRatio: 0.10, bossHP: 10 }
  };

  const CHALLENGES = ['rush','survival','boss'];

  // lives / miss
  const MAX_LIVES = 3;
  const MISS_PER_LIFE = 3;

  // -----------------------------
  // Food kind mapping (จริง)
  // -----------------------------
  const FOOD_ALL = [...GOOD, ...JUNK];
  const FOOD_KIND = {
    '🍎': { cat:'fruit',  name:'ผลไม้' },
    '🍌': { cat:'fruit',  name:'ผลไม้' },
    '🍉': { cat:'fruit',  name:'ผลไม้' },
    '🥦': { cat:'veg',    name:'ผัก' },
    '🥕': { cat:'veg',    name:'ผัก' },
    '🥛': { cat:'dairy',  name:'นม' },

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
  function foodInfoFromEmoji(emojiStr){
    const baseFood = extractBaseFoodEmoji(emojiStr);
    const info = baseFood ? FOOD_KIND[baseFood] : null;
    return { baseFood, info };
  }

  // -----------------------------
  // “คำโผล่” P.5
  // -----------------------------
  const WORD_GOOD_GENERIC = ['เก่งมาก!','เยี่ยมเลย!','สุดยอด!','ดีมาก!','ไปต่อ!','แชมป์!','ไหวอยู่!','เทพมาก!'];
  const WORD_GOOD_FRUIT   = ['ผลไม้ดีจัง!','สดชื่น!','วิตามินมา!','เลือกถูกแล้ว!','ผลไม้ปัง!'];
  const WORD_GOOD_VEG     = ['ผักเก่ง!','แข็งแรง!','พลังผัก!','ผักช่วยโต!','ผักปัง!'];
  const WORD_GOOD_DAIRY   = ['นมดี!','กระดูกแข็งแรง!','แคลเซียมมา!','นมปัง!','โตไว!'];

  const WORD_JUNK_GENERIC = ['เบาๆ น้า~','อันนี้ไม่เอาน้า~','พลาดนิดนึง!','ลองใหม่!','ระวังนะ~','ข้ามไปก่อน!'];
  const WORD_JUNK_SWEET   = ['หวานไปนิด~','น้ำตาลเยอะ~','ฟันจะงอแง~','พอแล้วน้า~','ค่อยๆ นะ~'];
  const WORD_JUNK_SODA    = ['น้ำหวานเยอะ~','ดื่มน้ำนะ~','หวานจี๊ด~','พักก่อน~','เลือกน้ำเปล่าดีกว่า~'];
  const WORD_JUNK_FRIED   = ['มันไปนิด~','ทอดเยอะ~','พอแล้วน้า~','เลือกของดีดีกว่า~','ระวังนะ~'];

  const WORD_FAKE = ['หลอกนะ!','แอบหลอก!','อย่าโดนหลอก~','ตาไวๆ!','ดูดีๆ!'];
  const WORD_BLOCK = ['กันได้!','โล่ช่วย!','ปลอดภัย!','บล็อกแล้ว!','รอดแล้ว!'];
  const WORD_GOLD = ['โบนัส!','แจ็กพอต!','ว้าว!','เก่งสุด!','ของพิเศษ!'];
  const WORD_POWER_SHIELD = ['โล่มา!','กันได้!','โล่ป้องกัน!','ปลอดภัย!'];
  const WORD_POWER_MAGNET = ['ดูดๆ!','มาเลย!','เก็บให้หมด!','ดูดเข้ามา!'];
  const WORD_POWER_TIME = ['เวลา+!','ต่อเวลา!','ยังทัน!','เพิ่มเวลา!'];
  const WORD_POWER_FEVER = ['ไฟลุก!','โหมดไฟ!','เร็วๆ!','คูณคะแนน!'];
  const WORD_BOSS = ['บอส!','สู้ๆ!','ตีบอส!','เอาชนะ!','ไปเลย!'];

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

  function p5WordFor(kind, baseFood, info, power, streakNow){
    const K = String(kind||'').toLowerCase();

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

    if (K === 'junk'){
      if (info && info.cat === 'sweet') return pickOne(WORD_JUNK_SWEET, 'หวานไปนิด~');
      if (info && info.cat === 'soda')  return pickOne(WORD_JUNK_SODA,  'น้ำหวานเยอะ~');
      if (info && info.cat === 'fried') return pickOne(WORD_JUNK_FRIED, 'มันไปนิด~');
      return pickOne(WORD_JUNK_GENERIC, 'เบาๆ น้า~');
    }

    if (info && info.cat === 'fruit') return pickOne(WORD_GOOD_FRUIT, 'ผลไม้ดีจัง!');
    if (info && info.cat === 'veg')   return pickOne(WORD_GOOD_VEG,   'ผักเก่ง!');
    if (info && info.cat === 'dairy') return pickOne(WORD_GOOD_DAIRY, 'นมดี!');
    return pickOne(WORD_GOOD_GENERIC, 'เก่งมาก!');
  }

  function canObjPop(){ return !!(Particles && typeof Particles.objPop === 'function'); }

  function sideObjectsOnHit(t, x, y, kind, streakNow){
    if (!canObjPop()) return;

    const { baseFood, info } = foodInfoFromEmoji(t && t.emoji);
    const s = (streakNow|0);

    const special = pickStreakSpecial(s);
    const pair = objPairForFood(kind, baseFood, info, t && t.power);

    for (let i=0;i<2;i++){
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
  // Camera projection helpers (VR-ish)
  // -----------------------------
  function getTHREE(){ return ROOT.THREE || (ROOT.AFRAME && ROOT.AFRAME.THREE) || null; }
  function sceneRef(){ return document.querySelector('a-scene') || null; }
  function cameraReady(){
    const scene = sceneRef();
    const THREE = getTHREE();
    return !!(scene && scene.camera && THREE);
  }
  function getCameraObj3D(){
    const camEl = document.querySelector('#gj-camera') || document.querySelector('a-camera');
    return (camEl && camEl.object3D) ? camEl.object3D : null;
  }
  function laneToWorldOffsetX(lane){
    const i = Math.max(0, Math.min(LANE_N-1, (lane|0)-1));
    return LANE_OFFSETS[i] || 0;
  }
  function randLane(){ return 1 + ((Math.random() * LANE_N) | 0); }
  function laneToFallbackX(lane){
    const w = window.innerWidth || 1000;
    const thirds = w / LANE_N;
    const center = (lane - 0.5) * thirds;
    const jitter = (Math.random()-0.5) * (thirds * 0.25);
    return Math.round(center + jitter);
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
    pos.x += laneToWorldOffsetX(lane);

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

  // -----------------------------
  // Game runtime state
  // -----------------------------
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

  let durationSec = 60;
  let timeLeft = 60;
  let challenge = 'rush';
  let runMode = 'play';
  let diffKey = 'normal';

  let bossSpawned = false;
  let bossTarget = null;

  let adaptive = { spawnMs: null, maxActive: null, scale: null };
  let lastAdaptAt = 0;

  let livesLeft = MAX_LIVES;

  let idSeq = 0;
  const makeId = ()=> `${Date.now()}-${(++idSeq)}`;

  // -----------------------------
  // Miss logic helpers
  // -----------------------------
  function shieldOn(){ return nowMs() < shieldUntil; }
  function magnetOn(){ return nowMs() < magnetUntil; }

  function feverAdd(v){
    if (!FeverUI || typeof FeverUI.add !== 'function') return;
    FeverUI.add(v);
  }
  function feverReduce(v){
    if (!FeverUI || typeof FeverUI.add !== 'function') return;
    FeverUI.add(-Math.abs(v||0));
  }

  function comboMultiplier(){
    const step = Math.floor((combo||0)/6);
    return clamp(1 + step*0.5, 1, 3);
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

  // -----------------------------
  // DOM target element
  // -----------------------------
  function createDomEl(){
    const el = document.createElement('div');
    el.className = 'gj-target';
    el.setAttribute('data-hha-tgt','1');
    el.style.display = 'none';
    return el;
  }

  // -----------------------------
  // Spec generator (spawn kinds)
  // -----------------------------
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
  // QUEST SYSTEM v3
  // - diff pools (play)
  // - fixed sets (research / lock)
  // =====================================================

  // -----------------------------
  // Quest metrics accumulator
  // -----------------------------
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

    // “no bad window”
    noBadOk: true,
    noBadStartMs: 0,

    lastRotateAt: 0,
    showGoalIdx: 0,
    showMiniIdx: 0
  };

  function resetQuestStats(){
    QSTAT.goodHit = 0; QSTAT.goldHit = 0; QSTAT.junkHit = 0; QSTAT.fakeHit = 0;
    QSTAT.block = 0;
    QSTAT.powerShield = 0; QSTAT.powerMagnet = 0; QSTAT.powerTime = 0; QSTAT.powerFever = 0;

    QSTAT.fruitGood = 0; QSTAT.vegGood = 0; QSTAT.dairyGood = 0;

    QSTAT.noBadOk = true;
    QSTAT.noBadStartMs = nowMs();

    QSTAT.lastRotateAt = 0;
    QSTAT.showGoalIdx = 0;
    QSTAT.showMiniIdx = 0;
  }

  function markBadEvent(){
    QSTAT.noBadOk = false;
  }
  function recoverBadWindowOnGood(){
    if (!QSTAT.noBadOk){
      QSTAT.noBadOk = true;
      QSTAT.noBadStartMs = nowMs();
    }
  }

  // -----------------------------
  // Quest factory (with research-variable tags)
  // tags: attention / inhibition / reaction
  // -----------------------------
  function makeCounterQuest(id, title, total, getter, tags=[]){
    return {
      id, title, kind:'count',
      total: (total==null) ? 1 : Math.max(1, total|0),
      tags: Array.isArray(tags)?tags:[],
      eval(){
        const cur = Math.max(0, Number(getter())||0);
        const done = cur >= this.total;
        return { cur, total:this.total, prog: (this.total>0)?clamp01(cur/this.total):0, done };
      }
    };
  }
  function makeTimerQuest(id, title, sec, getSecOk, tags=[]){
    return {
      id, title, kind:'time',
      total: Math.max(1, sec|0),
      tags: Array.isArray(tags)?tags:[],
      eval(){
        const cur = Math.floor(Number(getSecOk())||0);
        const done = cur >= this.total;
        return { cur, total:this.total, prog: (this.total>0)?clamp01(cur/this.total):0, done };
      }
    };
  }

  // -----------------------------
  // Goals pool (10)  — แบ่งระดับ easy/normal/hard
  // NOTE: แต่ละ goal มีเวอร์ชันตัวเลขต่างตาม diff
  // -----------------------------
  const GOALS_MASTER = [
    { id:'G01', title:'เก็บของดีให้ครบ',         tags:['attention'] ,
      easy:25, normal:28, hard:32, get:()=>QSTAT.goodHit },
    { id:'G02', title:'ทำคะแนนให้ถึง',            tags:['attention','reaction'],
      easy:2200, normal:2500, hard:2900, get:()=>score|0 },
    { id:'G03', title:'ทำคอมโบสูงสุดให้ถึง',     tags:['attention','reaction'],
      easy:10, normal:12, hard:14, get:()=>comboMax|0 },
    { id:'G04', title:'เก็บผลไม้ให้ครบ',          tags:['attention'],
      easy:8, normal:10, hard:12, get:()=>QSTAT.fruitGood },
    { id:'G05', title:'เก็บผักให้ครบ',            tags:['attention'],
      easy:8, normal:10, hard:12, get:()=>QSTAT.vegGood },
    { id:'G06', title:'เก็บนมให้ครบ',             tags:['attention'],
      easy:5, normal:6, hard:7, get:()=>QSTAT.dairyGood },
    { id:'G07', title:'เก็บ GOLD ให้ได้',         tags:['reaction'],
      easy:2, normal:3, hard:4, get:()=>QSTAT.goldHit },
    { id:'G08', title:'บล็อกการโจมตีให้ได้',      tags:['inhibition'],
      easy:2, normal:3, hard:4, get:()=>QSTAT.block },
    { id:'G09', title:'ใช้พลังโล่',                tags:['attention'],
      easy:1, normal:1, hard:1, get:()=>QSTAT.powerShield },
    // G10: “พลาดรวมไม่เกิน X” (ทำเป็น “เหลือ quota” ให้เพิ่มขึ้นเมื่อยังไม่พลาด)
    { id:'G10', title:'พลาดรวมไม่เกิน',            tags:['inhibition'],
      easy:5, normal:4, hard:3, get:()=>Math.max(0, (GOAL_LIMITS.G10||3) - (misses|0)) }
  ];

  // helper: ใช้กับ G10 getter ให้รู้ limit ตาม diff
  const GOAL_LIMITS = { G10: 3 };

  function buildGoalPoolForDiff(dk){
    const d = (dk==='easy'||dk==='hard'||dk==='normal') ? dk : 'normal';
    const pool = [];
    for (const g of GOALS_MASTER){
      if (g.id === 'G10'){
        GOAL_LIMITS.G10 = (g[d]||3);
        pool.push(makeCounterQuest(
          g.id,
          `${g.title} ${g[d]||3} ครั้ง`,
          (g[d]||3),
          g.get,
          g.tags
        ));
      } else {
        pool.push(makeCounterQuest(
          g.id,
          `${g.title} ${g[d]}`,
          (g[d]||1),
          g.get,
          g.tags
        ));
      }
    }
    return pool;
  }

  // -----------------------------
  // Minis pool (15) — แบ่งระดับ easy/normal/hard
  // -----------------------------
  const MINIS_MASTER = [
    { id:'M01', kind:'count', title:'ทำสตรีคติด', tags:['reaction','attention'],
      easy:7, normal:8, hard:10, get:()=>combo|0 },

    { id:'M02', kind:'count', title:'เก็บผลไม้', tags:['attention'],
      easy:5, normal:6, hard:7, get:()=>QSTAT.fruitGood },
    { id:'M03', kind:'count', title:'เก็บผัก', tags:['attention'],
      easy:5, normal:6, hard:7, get:()=>QSTAT.vegGood },
    { id:'M04', kind:'count', title:'เก็บนม', tags:['attention'],
      easy:2, normal:3, hard:4, get:()=>QSTAT.dairyGood },

    { id:'M05', kind:'count', title:'เก็บ GOLD', tags:['reaction'],
      easy:1, normal:2, hard:3, get:()=>QSTAT.goldHit },

    { id:'M06', kind:'count', title:'บล็อกขยะ/หลอก', tags:['inhibition'],
      easy:1, normal:2, hard:3, get:()=>QSTAT.block },

    { id:'M07', kind:'count', title:'ใช้โล่', tags:['attention'],
      easy:1, normal:1, hard:1, get:()=>QSTAT.powerShield },
    { id:'M08', kind:'count', title:'ใช้แม่เหล็ก', tags:['attention'],
      easy:1, normal:1, hard:1, get:()=>QSTAT.powerMagnet },
    { id:'M09', kind:'count', title:'เพิ่มเวลา', tags:['attention'],
      easy:1, normal:1, hard:1, get:()=>QSTAT.powerTime },
    { id:'M10', kind:'count', title:'ติด FEVER', tags:['reaction'],
      easy:1, normal:1, hard:1, get:()=>QSTAT.powerFever },

    { id:'M11', kind:'time', title:'ห้ามโดนขยะ/หลอก/พลาด', tags:['inhibition','attention'],
      easy:8, normal:10, hard:12, secOk:()=> (QSTAT.noBadOk ? (nowMs() - (QSTAT.noBadStartMs||nowMs()))/1000 : 0) },

    { id:'M12', kind:'time', title:'เนียนต่อเนื่อง', tags:['attention'],
      easy:6, normal:8, hard:10, secOk:()=> (QSTAT.noBadOk ? (nowMs() - (QSTAT.noBadStartMs||nowMs()))/1000 : 0) },

    { id:'M13', kind:'count', title:'ตีของดีรวด', tags:['reaction'],
      easy:4, normal:5, hard:6, get:()=>Math.min(999, combo|0) },

    { id:'M14', kind:'count', title:'ทำคะแนนให้ถึง', tags:['attention'],
      easy:400, normal:500, hard:650, get:()=>score|0 },

    // M15: อย่าโดนหลอกเลย (ใช้ count แบบ "คงค่า 1 ถ้ายังไม่โดน")
    { id:'M15', kind:'count', title:'อย่าโดนหลอก (FAKE) เลย', tags:['inhibition'],
      easy:1, normal:1, hard:1, get:()=> (QSTAT.fakeHit===0 ? 1 : 0) },

    // ✅ เพิ่ม M16 ให้ตรงที่คุณเลือก
    // “เร็วและแม่น”: ต้องมี fast hit อย่างน้อย N (rt<=450ms) และ junk error ต่ำ
    { id:'M16', kind:'count', title:'เร็วและแม่น (fast hit)', tags:['reaction','inhibition'],
      easy:6, normal:8, hard:10, get:()=> MET.fastHitCount|0 }
  ];

  function buildMiniPoolForDiff(dk){
    const d = (dk==='easy'||dk==='hard'||dk==='normal') ? dk : 'normal';
    const pool = [];
    for (const m of MINIS_MASTER){
      if (m.kind === 'time'){
        pool.push(makeTimerQuest(
          m.id,
          `${m.title} ${m[d]} วิ`,
          (m[d]||8),
          m.secOk,
          m.tags
        ));
      } else {
        pool.push(makeCounterQuest(
          m.id,
          `${m.title} ${m[d]}`,
          (m[d]||1),
          m.get,
          m.tags
        ));
      }
    }
    return pool;
  }

  // -----------------------------
  // Lock sets (ตามที่คุณล็อก)
  // -----------------------------
  const QUEST_SET = {
    hard:     { goals:['G02','G05'], minis:['M01','M16'] },
    hard_alt: { goals:['G10','G11'], minis:['M11','M15'] }
  };

  // ✅ G11 ที่คุณเรียกคู่กับ G10 (เพิ่มเป็น goal ใหม่: “โดนขยะไม่เกิน X”)
  // ใส่ใน goal pools โดย "เพิ่มเฉพาะสำหรับ lock/research" เพื่อไม่ทำให้ goal รวมเกิน 10 ใน play
  function makeG11ForDiff(dk){
    const d = (dk==='easy'||dk==='hard'||dk==='normal') ? dk : 'normal';
    const limit = (d==='easy') ? 4 : (d==='normal' ? 3 : 2);
    return makeCounterQuest(
      'G11',
      `โดนขยะ/หลอกไม่เกิน ${limit} ครั้ง`,
      limit,
      ()=> Math.max(0, limit - ((QSTAT.junkHit|0) + (QSTAT.fakeHit|0))),
      ['inhibition']
    );
  }

  // -----------------------------
  // Active quest container
  // -----------------------------
  const QUEST = {
    activeGoals: [],
    activeMinis: [],
    doneGoals: {},
    doneMinis: {},
    started: false
  };

  function findQuest(pool, id){
    for (const q of (pool||[])){ if (q && q.id === id) return q; }
    return null;
  }

  // -------------------------------------------------------
  // QUEST display strategy:
  // - HUD แสดงทีละ 1 goal + 1 mini แต่ payload มี extra.goals/minis ครบ
  // -------------------------------------------------------
  function emitQuestUpdate(){
    const gList = QUEST.activeGoals || [];
    const mList = QUEST.activeMinis || [];

    // rotate display
    const t = nowMs();
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

    const goalTitle = g ? `GOAL ${gIdx+1}/${gList.length}: ${g.title}` : 'กำลังเตรียมภารกิจ…';
    const miniTitle = m ? `MINI ${mIdx+1}/${mList.length}: ${m.title}` : 'กำลังเตรียม mini quest…';

    const extraGoals = gList.map((q,i)=>({
      i:i+1, id:q.id, title:q.title, tags:q.tags||[],
      ...q.eval(),
      done: !!QUEST.doneGoals[q.id]
    }));
    const extraMinis = mList.map((q,i)=>({
      i:i+1, id:q.id, title:q.title, tags:q.tags||[],
      ...q.eval(),
      done: !!QUEST.doneMinis[q.id]
    }));

    dispatch('quest:update', {
      goal: { title: goalTitle, cur:gEval.cur, max:gEval.total, pct:gEval.prog, state: gEval.done ? 'cleared':'active' },
      mini: { title: miniTitle, cur:mEval.cur, max:mEval.total, pct:mEval.prog, state: mEval.done ? 'cleared':'active' },
      extra: { goals: extraGoals, minis: extraMinis }
    });
  }

  function checkQuestCompletion(){
    let changed = false;

    for (const q of (QUEST.activeGoals||[])){
      const e = q.eval();
      if (e.done && !QUEST.doneGoals[q.id]){
        QUEST.doneGoals[q.id] = true;
        changed = true;
        dispatch('hha:celebrate', { type:'goal', id:q.id, title:q.title, tags:q.tags||[] });
      }
    }
    for (const q of (QUEST.activeMinis||[])){
      const e = q.eval();
      if (e.done && !QUEST.doneMinis[q.id]){
        QUEST.doneMinis[q.id] = true;
        changed = true;
        dispatch('hha:celebrate', { type:'mini', id:q.id, title:q.title, tags:q.tags||[] });
      }
    }

    if (changed) emitQuestUpdate();
  }

  function questSummary(){
    const g = QUEST.activeGoals || [];
    const m = QUEST.activeMinis || [];
    let gCleared = 0, mCleared = 0;
    for (const q of g) if (QUEST.doneGoals[q.id]) gCleared++;
    for (const q of m) if (QUEST.doneMinis[q.id]) mCleared++;
    return { goalsCleared:gCleared, goalsTotal:g.length, miniCleared:mCleared, miniTotal:m.length };
  }

  // -----------------------------
  // Build active quests:
  // - play: random 2 goals / 3 minis “ตาม diff”
  // - research: FIX ชุดจาก lock (hard/hard_alt) (ไม่สุ่ม)
  // -----------------------------
  const QUEST_CFG = { goalsPick:2, minisPick:3 };

  function buildActiveQuestsFromPlay(dk){
    const goalsPool = buildGoalPoolForDiff(dk);     // 10
    const minisPool = buildMiniPoolForDiff(dk);     // 15 (รวม M16)
    QUEST.activeGoals = pickN(goalsPool, QUEST_CFG.goalsPick);
    QUEST.activeMinis = pickN(minisPool, QUEST_CFG.minisPick);
  }

  function buildActiveQuestsFromLock(setKey, dk){
    // setKey: hard/hard_alt
    const set = (setKey === 'hard_alt') ? QUEST_SET.hard_alt : QUEST_SET.hard;

    // เรา build pool ตาม diff แล้วค่อย pick by id
    // + เพิ่ม G11 เฉพาะ lock (เพราะ play pool 10 goals ไม่มี G11)
    const baseGoals = buildGoalPoolForDiff(dk);
    baseGoals.push(makeG11ForDiff(dk)); // add G11
    const baseMinis = buildMiniPoolForDiff(dk);

    QUEST.activeGoals = (set.goals||[]).map(id=>findQuest(baseGoals,id)).filter(Boolean);
    QUEST.activeMinis = (set.minis||[]).map(id=>findQuest(baseMinis,id)).filter(Boolean);
  }

  function initQuestRun(){
    resetQuestStats();
    QUEST.doneGoals = {};
    QUEST.doneMinis = {};
    QUEST.started = true;
    emitQuestUpdate();
  }

  // =====================================================
  // LOGGING (sessions/events schema) — PROD
  // =====================================================

  // -------------------------------------------------------
  // META (เติมจาก hub/opts.meta)
  // -------------------------------------------------------
  const META = {
    timestampIso: '',
    projectTag: 'HeroHealth-GoodJunkVR',
    runMode: 'play',
    studyId: '',
    phase: '',
    conditionGroup: '',        // hard/hard_alt หลัง lock
    sessionOrder: '',
    blockLabel: '',
    siteCode: '',
    schoolYear: '',
    semester: '',
    sessionId: '',

    gameMode: 'goodjunk',
    diff: 'normal',
    durationPlannedSec: 60,
    device: '',
    gameVersion: '',
    reason: '',
    startTimeIso: '',
    endTimeIso: '',

    studentKey: '',
    schoolCode: '',
    schoolName: '',
    classRoom: '',
    studentNo: '',
    nickName: '',
    gender: '',
    age: '',
    gradeLevel: '',
    heightCm: '',
    weightKg: '',
    bmi: '',
    bmiGroup: '',
    vrExperience: '',
    gameFrequency: '',
    handedness: '',
    visionIssue: '',
    healthDetail: '',
    consentParent: '',
    consentTeacher: '',
    profileSource: '',
    surveyKey: '',
    excludeFlag: '',
    noteResearcher: ''
  };

  function readMetaFromOpts(opts={}){
    const m = opts.meta || opts || {};
    META.projectTag = m.projectTag || META.projectTag;
    META.runMode = (m.runMode === 'research' || opts.runMode === 'research') ? 'research' : 'play';
    META.studyId = m.studyId || '';
    META.phase = m.phase || '';
    META.sessionOrder = m.sessionOrder || '';
    META.blockLabel = m.blockLabel || '';
    META.siteCode = m.siteCode || '';
    META.schoolYear = m.schoolYear || '';
    META.semester = m.semester || '';
    META.sessionId = m.sessionId || m.sessionIdFromHub || META.sessionId || '';

    META.gameMode = m.gameMode || 'goodjunk';
    META.diff = String(m.diff || META.diff || 'normal').toLowerCase();
    META.durationPlannedSec = Number(m.durationPlannedSec ?? m.durationSec ?? 60) || 60;

    META.device = m.device || '';
    META.gameVersion = m.gameVersion || '';
    META.reason = m.reason || '';

    META.studentKey = m.studentKey || '';
    META.schoolCode = m.schoolCode || '';
    META.schoolName = m.schoolName || '';
    META.classRoom = m.classRoom || '';
    META.studentNo = m.studentNo || '';
    META.nickName = m.nickName || '';

    META.gender = m.gender || '';
    META.age = m.age || '';
    META.gradeLevel = m.gradeLevel || m.grade || '';
    META.heightCm = m.heightCm || '';
    META.weightKg = m.weightKg || '';
    META.bmi = m.bmi || '';
    META.bmiGroup = m.bmiGroup || '';
    META.vrExperience = m.vrExperience || '';
    META.gameFrequency = m.gameFrequency || '';
    META.handedness = m.handedness || '';
    META.visionIssue = m.visionIssue || '';
    META.healthDetail = m.healthDetail || '';
    META.consentParent = m.consentParent || '';
    META.consentTeacher = m.consentTeacher || '';
    META.profileSource = m.profileSource || '';
    META.surveyKey = m.surveyKey || '';
    META.excludeFlag = m.excludeFlag || '';
    META.noteResearcher = m.noteResearcher || '';
  }

  // -------------------------------------------------------
  // METRICS (session + event attach)
  // -------------------------------------------------------
  const MET = {
    startMs: 0,
    durationPlayedSec: 0,

    scoreFinal: 0,
    comboMax: 0,
    misses: 0,

    goalsCleared: 0,
    goalsTotal: 0,
    miniCleared: 0,
    miniTotal: 0,

    nTargetGoodSpawned: 0,
    nTargetJunkSpawned: 0,
    nTargetStarSpawned: 0,     // gold
    nTargetDiamondSpawned: 0,  // fake
    nTargetShieldSpawned: 0,   // power shield

    nHitGood: 0,
    nHitJunk: 0,
    nHitJunkGuard: 0,
    nExpireGood: 0,

    rtGoodList: [],
    fastHitCount: 0,

    accuracyGoodPct: 0,
    junkErrorPct: 0,
    avgRtGoodMs: null,
    medianRtGoodMs: null,
    fastHitRatePct: 0,

    feverState: '',
    feverValue: null,

    goalProgress: null,
    miniProgress: null,

    reset(){
      this.startMs = 0;
      this.durationPlayedSec = 0;

      this.scoreFinal = 0;
      this.comboMax = 0;
      this.misses = 0;

      this.goalsCleared = 0;
      this.goalsTotal = 0;
      this.miniCleared = 0;
      this.miniTotal = 0;

      this.nTargetGoodSpawned = 0;
      this.nTargetJunkSpawned = 0;
      this.nTargetStarSpawned = 0;
      this.nTargetDiamondSpawned = 0;
      this.nTargetShieldSpawned = 0;

      this.nHitGood = 0;
      this.nHitJunk = 0;
      this.nHitJunkGuard = 0;
      this.nExpireGood = 0;

      this.rtGoodList = [];
      this.fastHitCount = 0;

      this.accuracyGoodPct = 0;
      this.junkErrorPct = 0;
      this.avgRtGoodMs = null;
      this.medianRtGoodMs = null;
      this.fastHitRatePct = 0;

      this.feverState = '';
      this.feverValue = null;

      this.goalProgress = null;
      this.miniProgress = null;
    },

    computeDerived(){
      const gSpawn = Math.max(0, this.nTargetGoodSpawned|0);
      const gHit = Math.max(0, this.nHitGood|0);
      this.accuracyGoodPct = gSpawn ? Math.round(100 * (gHit / gSpawn)) : 0;

      const denom = Math.max(1, (this.nHitGood|0) + (this.nHitJunk|0) + (this.nHitJunkGuard|0));
      this.junkErrorPct = Math.round(100 * ((this.nHitJunk|0) / denom));

      this.avgRtGoodMs = avg(this.rtGoodList);
      this.medianRtGoodMs = median(this.rtGoodList);

      const fastDen = Math.max(1, this.rtGoodList.length);
      this.fastHitRatePct = Math.round(100 * (this.fastHitCount / fastDen));
    }
  };

  // -------------------------------------------------------
  // Attach quest:update -> MET.goalProgress/MET.miniProgress
  // -------------------------------------------------------
  ROOT.addEventListener('quest:update', (e)=>{
    const d = (e && e.detail) ? e.detail : null;

    if (d && d.goal){
      MET.goalProgress = JSON.stringify({
        title: d.goal.title || '',
        cur: d.goal.cur ?? 0,
        max: d.goal.max ?? 0,
        pct: d.goal.pct ?? 0,
        state: d.goal.state || ''
      });
    }
    if (d && d.mini){
      MET.miniProgress = JSON.stringify({
        title: d.mini.title || '',
        cur: d.mini.cur ?? 0,
        max: d.mini.max ?? 0,
        pct: d.mini.pct ?? 0,
        state: d.mini.state || ''
      });
    }
  });

  // -------------------------------------------------------
  // Event row builders
  // -------------------------------------------------------
  function baseEventRow(){
    return {
      timestampIso: isoNow(),
      projectTag: META.projectTag,
      runMode: META.runMode,
      studyId: META.studyId,
      phase: META.phase,
      conditionGroup: META.conditionGroup,
      sessionId: META.sessionId,

      eventType: '',

      gameMode: META.gameMode,
      diff: META.diff,

      timeFromStartMs: null,
      targetId: '',
      emoji: '',
      itemType: '',
      lane: '',
      rtMs: null,
      judgment: '',
      totalScore: null,
      combo: null,
      isGood: '',

      feverState: MET.feverState || '',
      feverValue: MET.feverValue,

      goalProgress: MET.goalProgress,
      miniProgress: MET.miniProgress,

      extra: '',

      studentKey: META.studentKey,
      schoolCode: META.schoolCode,
      classRoom: META.classRoom,
      studentNo: META.studentNo,
      nickName: META.nickName
    };
  }

  function logEventRow(row){ dispatch('hha:log_event', row); }

  function logSpawn(t){
    const r = baseEventRow();
    r.eventType = 'spawn';
    r.timeFromStartMs = (t && t.born!=null) ? Math.max(0, Math.round(t.born - MET.startMs)) : null;
    r.targetId = t ? String(t.id||'') : '';
    r.emoji = t ? String(t.emoji||'') : '';
    r.itemType = t ? String(t.type === 'power' ? (t.power||'power') : (t.type||'')) : '';
    r.lane = (t && t.lane!=null) ? String(t.lane) : '';
    r.extra = JSON.stringify({ challenge, lockedQuestSetKey });
    logEventRow(r);
  }

  function logExpire(t, judgment){
    const r = baseEventRow();
    r.eventType = 'expire';
    r.timeFromStartMs = Math.max(0, Math.round(nowMs() - MET.startMs));
    r.targetId = t ? String(t.id||'') : '';
    r.emoji = t ? String(t.emoji||'') : '';
    r.itemType = t ? String(t.type === 'power' ? (t.power||'power') : (t.type||'')) : '';
    r.lane = (t && t.lane!=null) ? String(t.lane) : '';
    r.judgment = judgment || 'EXPIRE';
    r.totalScore = score|0;
    r.combo = combo|0;
    logEventRow(r);
  }

  function logHit(t, judgment, rtMs, isGoodFlag, extraObj){
    const r = baseEventRow();
    r.eventType = 'hit';
    r.timeFromStartMs = Math.max(0, Math.round(nowMs() - MET.startMs));
    r.targetId = t ? String(t.id||'') : '';
    r.emoji = t ? String(t.emoji||'') : '';
    r.itemType = t ? String(t.type === 'power' ? (t.power||'power') : (t.type||'')) : '';
    r.lane = (t && t.lane!=null) ? String(t.lane) : '';
    r.rtMs = (typeof rtMs === 'number') ? Math.max(0, Math.round(rtMs)) : null;
    r.judgment = judgment || '';
    r.totalScore = score|0;
    r.combo = combo|0;
    r.isGood = isGoodFlag ? '1' : '0';
    r.extra = extraObj ? JSON.stringify(extraObj) : '';
    logEventRow(r);
  }

  function logBlock(t, why){
    const r = baseEventRow();
    r.eventType = 'block';
    r.timeFromStartMs = Math.max(0, Math.round(nowMs() - MET.startMs));
    r.targetId = t ? String(t.id||'') : '';
    r.emoji = t ? String(t.emoji||'') : '';
    r.itemType = String(why || (t && t.type) || 'junk');
    r.lane = (t && t.lane!=null) ? String(t.lane) : '';
    r.judgment = 'BLOCK';
    r.totalScore = score|0;
    r.combo = combo|0;
    logEventRow(r);
  }

  // -------------------------------------------------------
  // Session row builder
  // -------------------------------------------------------
  function emitSessionRow(reason){
    MET.computeDerived();

    const row = {
      timestampIso: isoNow(),
      projectTag: META.projectTag,
      runMode: META.runMode,
      studyId: META.studyId,
      phase: META.phase,
      conditionGroup: META.conditionGroup,
      sessionOrder: META.sessionOrder,
      blockLabel: META.blockLabel,
      siteCode: META.siteCode,
      schoolYear: META.schoolYear,
      semester: META.semester,
      sessionId: META.sessionId,

      gameMode: META.gameMode,
      diff: META.diff,

      durationPlannedSec: META.durationPlannedSec,
      durationPlayedSec: MET.durationPlayedSec,

      scoreFinal: MET.scoreFinal,
      comboMax: MET.comboMax,
      misses: MET.misses,

      goalsCleared: MET.goalsCleared,
      goalsTotal: MET.goalsTotal,
      miniCleared: MET.miniCleared,
      miniTotal: MET.miniTotal,

      nTargetGoodSpawned: MET.nTargetGoodSpawned,
      nTargetJunkSpawned: MET.nTargetJunkSpawned,
      nTargetStarSpawned: MET.nTargetStarSpawned,
      nTargetDiamondSpawned: MET.nTargetDiamondSpawned,
      nTargetShieldSpawned: MET.nTargetShieldSpawned,

      nHitGood: MET.nHitGood,
      nHitJunk: MET.nHitJunk,
      nHitJunkGuard: MET.nHitJunkGuard,
      nExpireGood: MET.nExpireGood,

      accuracyGoodPct: MET.accuracyGoodPct,
      junkErrorPct: MET.junkErrorPct,
      avgRtGoodMs: MET.avgRtGoodMs,
      medianRtGoodMs: MET.medianRtGoodMs,
      fastHitRatePct: MET.fastHitRatePct,

      device: META.device,
      gameVersion: META.gameVersion,
      reason: reason || META.reason || '',

      startTimeIso: META.startTimeIso,
      endTimeIso: META.endTimeIso,

      studentKey: META.studentKey,
      schoolCode: META.schoolCode,
      schoolName: META.schoolName,
      classRoom: META.classRoom,
      studentNo: META.studentNo,
      nickName: META.nickName,
      gender: META.gender,
      age: META.age,
      gradeLevel: META.gradeLevel,
      heightCm: META.heightCm,
      weightKg: META.weightKg,
      bmi: META.bmi,
      bmiGroup: META.bmiGroup,
      vrExperience: META.vrExperience,
      gameFrequency: META.gameFrequency,
      handedness: META.handedness,
      visionIssue: META.visionIssue,
      healthDetail: META.healthDetail,
      consentParent: META.consentParent,
      consentTeacher: META.consentTeacher,
      profileSource: META.profileSource,
      surveyKey: META.surveyKey,
      excludeFlag: META.excludeFlag,
      noteResearcher: META.noteResearcher,

      // เพิ่มเติม (ไม่ทำให้ schema พัง ถ้าชีตมีคอลัมน์)
      durationPlayedSecRaw: MET.durationPlayedSec,
      challenge,
      lockedQuestSetKey
    };

    dispatch('hha:log_session', row);
  }

  // =====================================================
  // WARMUP + LOCK (play only)
  // =====================================================
  let warmupTimer = null;
  let warmupDone = false;
  let lockedQuestSetKey = ''; // 'hard'|'hard_alt'

  function pickSetFromWarmup(w){
    const rt = Number(w.medianRtGoodMs || 99999);
    const junkErr = Number(w.junkErrorPct || 999);
    const acc = Number(w.accuracyGoodPct || 0);
    const fast = Number(w.fastHitRatePct || 0);

    // เกณฑ์ "เก่ง" -> hard, ไม่งั้น hard_alt
    if (acc >= 70 && junkErr <= 25 && rt <= 750) return 'hard';
    if (acc >= 65 && junkErr <= 30 && rt <= 680 && fast >= 20) return 'hard';
    return 'hard_alt';
  }

  function beginWarmupThenLock(opts){
    const warmupSec = clamp(opts.warmupSec ?? 15, 5, 30);

    warmupDone = false;
    lockedQuestSetKey = '';
    META.conditionGroup = '';

    // reset warmup-specific metrics
    MET.rtGoodList = [];
    MET.fastHitCount = 0;
    MET.nTargetGoodSpawned = 0;
    MET.nHitGood = 0;
    MET.nHitJunk = 0;
    MET.nHitJunkGuard = 0;

    dispatch('hha:judge', { label: `WARMUP ${warmupSec}s` });

    if (warmupTimer) clearTimeout(warmupTimer);
    warmupTimer = setTimeout(()=>{
      const w = {
        accuracyGoodPct: (MET.nTargetGoodSpawned ? Math.round(100*(MET.nHitGood/MET.nTargetGoodSpawned)) : 0),
        junkErrorPct: Math.round(100*(MET.nHitJunk/Math.max(1, MET.nHitGood + MET.nHitJunk + MET.nHitJunkGuard))),
        medianRtGoodMs: median(MET.rtGoodList) || null,
        fastHitRatePct: (MET.rtGoodList.length ? Math.round(100*(MET.fastHitCount/MET.rtGoodList.length)) : 0)
      };

      lockedQuestSetKey = pickSetFromWarmup(w);
      warmupDone = true;
      META.conditionGroup = lockedQuestSetKey;

      // lock quests now (ตามชุด hard/hard_alt)
      buildActiveQuestsFromLock(lockedQuestSetKey, diffKey);
      QUEST.doneGoals = {};
      QUEST.doneMinis = {};
      dispatch('hha:judge', { label: `LOCK: ${lockedQuestSetKey.toUpperCase()}` });

      // แจ้ง event เพื่อวิจัย/Logger
      dispatch('quest:lock', { warmup: w, setKey: lockedQuestSetKey });

      emitQuestUpdate();
    }, warmupSec * 1000);
  }

  // =====================================================
  // Core gameplay events -> HUD
  // =====================================================
  function emitScore(){
    const feverActive = (FeverUI && typeof FeverUI.isActive === 'function') ? !!FeverUI.isActive() : false;
    const shieldOnNow = shieldOn();
    const magnetOnNow = magnetOn();

    dispatch('hha:score', {
      score, combo, comboMax,
      goodHits, misses,
      feverActive,
      shieldOn: shieldOnNow,
      magnetOn: magnetOnNow,
      timeLeft, durationSec,
      runMode, diff: diffKey, challenge
    });
  }

  function emitTime(){
    dispatch('hha:time', { sec: timeLeft });
  }

  function checkSurvivalLives(){
    if (challenge !== 'survival') return;
    const lost = Math.floor((misses|0) / MISS_PER_LIFE);
    livesLeft = Math.max(0, MAX_LIVES - lost);
    dispatch('hha:lives', { livesLeft, max: MAX_LIVES });
    if (livesLeft <= 0){
      stop('lives-zero');
    }
  }

  // =====================================================
  // Adaptive (play only)
  // =====================================================
  function adaptIfNeeded(){
    if (runMode !== 'play') return;
    if (challenge === 'survival') return;
    const t = nowMs();
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
      dispatch('hha:judge', { label:'LEVEL UP!' });
    } else if (missRate > 0.38){
      spawnMs = Math.round(base.spawnMs * 1.08);
      maxActive = Math.max(base.maxActive - 1, 2);
      scale = base.scale * 1.06;
      dispatch('hha:judge', { label:'EASY DOWN!' });
    }

    adaptive = { spawnMs, maxActive, scale };
    dispatch('hha:adaptive', { ...adaptive });
  }

  // =====================================================
  // Boss (boss challenge)
  // =====================================================
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
      born: nowMs(),
      ttl: 999999,
      seen: false,
      fallback2D: { x: window.innerWidth/2, y: window.innerHeight*0.38 },
      wobbleSeed: Math.random()*10
    };

    el.textContent = t.emoji;
    active.push(t);
    layerEl.appendChild(el);

    // spawn counters: boss ไม่รวม good/junk
    logSpawn(t);

    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      hitTarget(t, e.clientX || 0, e.clientY || 0);
    });

    bossTarget = t;
    dispatch('hha:judge', { label:'BOSS!' });
    dispatch('quest:boss', { hp });

    emitQuestUpdate();
  }

  // =====================================================
  // Target lifecycle
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
      born: nowMs(),
      ttl: spec.ttl || 2200,
      seen: false,
      fallback2D,
      wobbleSeed: Math.random()*10
    };

    active.push(t);
    layerEl.appendChild(el);

    // spawn counters
    if (t.type === 'good') MET.nTargetGoodSpawned++;
    if (t.type === 'junk') MET.nTargetJunkSpawned++;
    if (t.type === 'gold') MET.nTargetStarSpawned++;
    if (t.type === 'fake') MET.nTargetDiamondSpawned++;
    if (t.type === 'power' && t.power === 'shield') MET.nTargetShieldSpawned++;

    logSpawn(t);

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

  function expireTarget(t){
    if (!running) return;
    removeTarget(t);

    // expire event log
    const isGoodish = (t.type === 'good' || t.type === 'gold');
    logExpire(t, isGoodish ? 'MISS_EXPIRE' : 'EXPIRE');

    if (isGoodish && t.seen){
      // MISS: good expired
      misses++;
      MET.misses = misses|0;

      MET.nExpireGood++;

      combo = 0;
      markBadEvent();

      dispatch('hha:miss', { misses });
      dispatch('hha:judge', { label:'MISS' });

      emitScore();
      checkSurvivalLives();

      checkQuestCompletion();
      emitQuestUpdate();
    }
  }

  // =====================================================
  // Hit logic
  // =====================================================
  function hitTarget(t, x, y){
    if (!t || !t.el) return;

    const rtMs = nowMs() - (t.born || nowMs());

    // -----------------------------
    // BOSS
    // -----------------------------
    if (t.type === 'boss'){
      t.hp = (t.hp|0) - 1;

      sideObjectsOnHit(t, x, y, 'boss', combo);

      logHit(t, 'BOSS_HIT', rtMs, false, { hp: t.hp });

      dispatch('hha:judge', { label:'BOSS HIT!' });

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

        dispatch('hha:judge', { label:'BOSS CLEAR!' });
        dispatch('quest:bossClear', { ok:true });

        emitScore();
        checkQuestCompletion();
        emitQuestUpdate();
      } else {
        t.el.style.setProperty('--tScale', String((pickBase().scale||1) * 1.12));
        t.el.textContent = '🥦👑 ×' + t.hp;
        emitScore();
        emitQuestUpdate();
      }
      return;
    }

    // remove immediately for other types
    removeTarget(t);

    // -----------------------------
    // POWER
    // -----------------------------
    if (t.type === 'power'){
      sideObjectsOnHit(t, x, y, 'power', combo);

      if (t.power === 'shield'){
        shieldUntil = nowMs() + 5000;
        QSTAT.powerShield++;
        logHit(t, 'POWER_SHIELD', rtMs, false);
        dispatch('quest:power', { power:'shield' });
        dispatch('hha:judge', { label:'SHIELD ON!' });
        emitScore();

        checkQuestCompletion(); emitQuestUpdate();
        return;
      }
      if (t.power === 'magnet'){
        magnetUntil = nowMs() + 4000;
        QSTAT.powerMagnet++;
        logHit(t, 'POWER_MAGNET', rtMs, false);
        dispatch('quest:power', { power:'magnet' });
        dispatch('hha:judge', { label:'MAGNET!' });
        emitScore();

        checkQuestCompletion(); emitQuestUpdate();
        return;
      }
      if (t.power === 'time'){
        if (challenge !== 'survival'){
          timeLeft = clamp(timeLeft + 3, 0, 180);
          emitTime();
        }
        QSTAT.powerTime++;
        logHit(t, 'POWER_TIME', rtMs, false);
        dispatch('quest:power', { power:'time' });
        dispatch('hha:judge', { label:'TIME +3!' });
        emitScore();

        checkQuestCompletion(); emitQuestUpdate();
        return;
      }
      if (t.power === 'fever'){
        feverAdd(22);
        QSTAT.powerFever++;
        logHit(t, 'POWER_FEVER', rtMs, false);
        dispatch('quest:power', { power:'fever' });
        dispatch('hha:judge', { label:'FEVER+' });
        emitScore();

        checkQuestCompletion(); emitQuestUpdate();
        return;
      }
    }

    // -----------------------------
    // FAKE (counts as bad hit; shield block doesn't count miss)
    // -----------------------------
    if (t.type === 'fake'){
      if (shieldOn()){
        sideObjectsOnHit(t, x, y, 'block', combo);
        QSTAT.block++;
        MET.nHitJunkGuard++;

        logBlock(t, 'fake');
        dispatch('quest:block', { ok:true, why:'fake' });
        dispatch('hha:judge', { label:'BLOCK!' });
        emitScore();

        checkQuestCompletion(); emitQuestUpdate();
        return;
      }

      // bad hit -> miss++ (counts)
      misses++;
      MET.misses = misses|0;
      combo = 0;
      feverReduce(18);

      QSTAT.fakeHit++;
      MET.nHitJunk++; // treat as junk-error family
      markBadEvent();

      sideObjectsOnHit(t, x, y, 'fake', combo);

      logHit(t, 'HIT_FAKE', rtMs, false);
      dispatch('quest:badHit', { type:'fake' });

      dispatch('hha:miss', { misses });
      dispatch('hha:judge', { label:'MISS', why:'fake' });
      emitScore();

      checkSurvivalLives();
      checkQuestCompletion(); emitQuestUpdate();
      return;
    }

    // -----------------------------
    // JUNK (shield block doesn't count miss)
    // -----------------------------
    if (t.type === 'junk'){
      if (shieldOn()){
        sideObjectsOnHit(t, x, y, 'block', combo);
        QSTAT.block++;
        MET.nHitJunkGuard++;

        logBlock(t, 'junk');
        dispatch('quest:block', { ok:true, why:'junk' });
        dispatch('hha:judge', { label:'BLOCK!' });
        emitScore();

        checkQuestCompletion(); emitQuestUpdate();
        return;
      }

      // bad hit -> miss++ (counts)
      misses++;
      MET.misses = misses|0;
      combo = 0;
      feverReduce(12);

      QSTAT.junkHit++;
      MET.nHitJunk++;
      markBadEvent();

      sideObjectsOnHit(t, x, y, 'junk', combo);

      logHit(t, 'HIT_JUNK', rtMs, false);
      dispatch('quest:badHit', { type:'junk' });

      dispatch('hha:miss', { misses });
      dispatch('hha:judge', { label:'MISS' });
      emitScore();

      checkSurvivalLives();
      checkQuestCompletion(); emitQuestUpdate();
      return;
    }

    // -----------------------------
    // GOOD / GOLD
    // -----------------------------
    goodHits++;
    combo++;
    comboMax = Math.max(comboMax, combo);

    QSTAT.goodHit++;
    MET.nHitGood++;

    // rt samples (good only)
    if (rtMs != null){
      MET.rtGoodList.push(rtMs);
      if (rtMs <= 450) MET.fastHitCount++;
    }

    const fi = foodInfoFromEmoji(t.emoji);
    if (t.type === 'gold') QSTAT.goldHit++;
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
        (t.type === 'gold') ? '[GOLD] '+pickOne(WORD_GOLD,'โบนัส!')
                            : '[GOOD] '+pickOne(WORD_GOOD_GENERIC,'เก่งมาก!')
      );
    }
    if (Particles && typeof Particles.burstAt === 'function'){
      if (t.type === 'gold') Particles.burstAt(x,y,'GOLD');
      if (st === 'final' && Math.random() < 0.15) Particles.burstAt(x,y,'GOOD');
    }

    logHit(t, (t.type === 'gold') ? 'HIT_GOLD' : 'HIT_GOOD', rtMs, true, { add, mult, feverNow });

    dispatch('quest:goodHit', { type:t.type, add, mult, feverNow });

    dispatch('hha:judge', { label: (combo >= 10 ? 'PERFECT' : 'GOOD'), mult });
    emitScore();

    checkQuestCompletion(); emitQuestUpdate();
  }

  // =====================================================
  // Render / Spawn / Tick loops
  // =====================================================
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

      // magnet pull
      if (magnetOn()){
        const cx = window.innerWidth/2;
        const cy = window.innerHeight/2;
        const k = 0.18;
        p = { x: p.x + (cx - p.x)*k, y: p.y + (cy - p.y)*k };
      }

      // wobble
      if (st !== 'early'){
        const tt = (nowMs() - t.born) / 1000;
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

    if (challenge !== 'survival'){
      timeLeft = Math.max(0, (timeLeft|0) - 1);
      emitTime();
      if (timeLeft <= 0){
        stop('time-up');
        return;
      }
    }

    // keep quest timers alive
    if (QUEST && QUEST.started){
      checkQuestCompletion();
      emitQuestUpdate();
    }

    tickTimer = setTimeout(tickLoop, 1000);
  }

  // =====================================================
  // Engine start/stop
  // =====================================================
  function start(diff, opts={}){
    // รองรับ start(ctx) ด้วย (safe.js อาจเรียกมาแบบนี้)
    if (typeof diff === 'object' && diff) {
      opts = diff;
      diff = opts.diff || 'normal';
    }

    if (running) return;

    // layer
    layerEl = opts.layerEl || document.getElementById('gj-layer') || document.body;
    if (!layerEl) {
      console.error('[GoodJunkVR] layerEl not found');
      return;
    }

    running = true;

    readMetaFromOpts(opts);

    diffKey = String(diff || opts.diff || 'normal').toLowerCase();
    if (!DIFF[diffKey]) diffKey = 'normal';
    META.diff = diffKey;

    runMode = (opts.runMode === 'research' || META.runMode === 'research') ? 'research' : 'play';
    META.runMode = runMode;

    challenge = String(opts.challenge || 'rush').toLowerCase();
    if (!CHALLENGES.includes(challenge)) challenge = 'rush';

    durationSec = clamp(opts.durationSec ?? opts.time ?? META.durationPlannedSec ?? 60, 20, 180);
    META.durationPlannedSec = durationSec;
    timeLeft = durationSec;

    // reset game state
    score=0; combo=0; comboMax=0; goodHits=0; misses=0;
    shieldUntil=0; magnetUntil=0;
    bossSpawned=false; bossTarget=null;
    adaptive = { spawnMs:null, maxActive:null, scale:null };
    lastAdaptAt = 0;
    livesLeft = MAX_LIVES;

    // reset quests
    QUEST.started = false;
    QUEST.activeGoals = [];
    QUEST.activeMinis = [];
    QUEST.doneGoals = {};
    QUEST.doneMinis = {};
    resetQuestStats();

    // reset metrics
    MET.reset();
    MET.startMs = nowMs();

    // session timing
    META.startTimeIso = isoNow();
    META.timestampIso = META.startTimeIso;

    dispatch('hha:lives', { livesLeft, max: MAX_LIVES });
    dispatch('hha:mode', { diff:diffKey, runMode, challenge, durationSec });

    // fever reset
    if (FeverUI && typeof FeverUI.reset === 'function') FeverUI.reset();

    // --- QUEST INIT ---
    initQuestRun();

    const forceSet = String(opts.forceSet || opts.conditionGroup || '').toLowerCase(); // 'hard'|'hard_alt'
    if (runMode === 'research'){
      lockedQuestSetKey = (forceSet === 'hard_alt') ? 'hard_alt' : 'hard';
      META.conditionGroup = lockedQuestSetKey;
      warmupDone = true;

      buildActiveQuestsFromLock(lockedQuestSetKey, diffKey);
      emitQuestUpdate();

      dispatch('hha:judge', { label: `RESEARCH FIX: ${lockedQuestSetKey.toUpperCase()}` });
      dispatch('quest:lock', { warmup:null, setKey: lockedQuestSetKey });

    } else {
      // play mode: start with random-by-diff immediately
      buildActiveQuestsFromPlay(diffKey);
      emitQuestUpdate();

      // then warmup -> lock -> override to fixed set hard/hard_alt
      beginWarmupThenLock(opts);
    }

    emitTime();
    emitScore();

    renderLoop();
    spawnLoop();
    tickLoop();

    console.log('[GoodJunkVR] start', { diffKey, runMode, challenge, durationSec, sessionId: META.sessionId });
  }

  function stop(reason='stop'){
    if (!running) return;
    running = false;

    if (warmupTimer) clearTimeout(warmupTimer);
    warmupTimer = null;

    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (spawnTimer) clearTimeout(spawnTimer);
    spawnTimer = null;
    if (tickTimer) clearTimeout(tickTimer);
    tickTimer = null;

    // clear targets
    const copy = active.slice();
    for (const t of copy) removeTarget(t);
    active.length = 0;

    META.endTimeIso = isoNow();

    // durationPlayedSec
    const startT = new Date(META.startTimeIso).getTime();
    const endT = new Date(META.endTimeIso).getTime();
    MET.durationPlayedSec = (isFinite(startT) && isFinite(endT) && endT>startT) ? Math.round((endT-startT)/1000) : 0;

    // finalize session metrics
    MET.scoreFinal = score|0;
    MET.comboMax = comboMax|0;
    MET.misses = misses|0;

    const qs = questSummary();
    MET.goalsCleared = qs.goalsCleared;
    MET.goalsTotal = qs.goalsTotal;
    MET.miniCleared = qs.miniCleared;
    MET.miniTotal = qs.miniTotal;

    // emit session row
    emitSessionRow(reason);

    // end event for HUD / downstream
    dispatch('hha:end', {
      scoreFinal: MET.scoreFinal,
      comboMax: MET.comboMax,
      misses: MET.misses,
      reason,
      timeLeft,
      durationSec,
      runMode,
      diff: diffKey,
      challenge,
      stats: { ...qs },
      conditionGroup: META.conditionGroup || lockedQuestSetKey || ''
    });

    console.log('[GoodJunkVR] stop', { reason, sessionId: META.sessionId });
  }

  // =====================================================
  // Export + attach to window
  // =====================================================
  ns.GameEngine = { start, stop };

})(ROOT.GoodJunkVR = ROOT.GoodJunkVR || {});

// ESM exports (safe.js รองรับ)
export const GameEngine = ROOT.GoodJunkVR.GameEngine;

// Optional: boot(ctx) for callers that want single entry
export function boot(ctx = {}) {
  // รองรับ factoryBoot(engineBoot) ที่ส่ง ctx มาทีเดียว
  const diff = (ctx && ctx.diff) ? ctx.diff : 'normal';
  return ROOT.GoodJunkVR.GameEngine.start(diff, ctx);
}

export default { GameEngine: ROOT.GoodJunkVR.GameEngine, boot };
