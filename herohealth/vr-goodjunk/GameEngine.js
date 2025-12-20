// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM Emoji Engine (HYPER v3.5-PROD)
// ✅ Quest v2:
//    - PLAY: สุ่มตามระดับ (easy/normal/hard) จาก pool “แยกตามความยาก” (Goal 10 เลือก 2 / Mini 15 เลือก 3)
//    - RESEARCH: ไม่สุ่ม (FIX ตามระดับ/conditionGroup ที่เลือกได้)
// ✅ NEW: WARMUP + AUTO LOCK hard/hard_alt ตาม performance (เฉพาะโหมด play) + ล็อกจนจบ session
// ✅ NEW: Session/Event logging schema (dispatch hha:log_session / hha:log_event) + goalProgress/miniProgress ทุก event
// ✅ NEW: ชุดล็อกตามที่คุณกำหนด:
//    hard:     Goals = G02,G05  | Minis = M01,M16
//    hard_alt: Goals = G10,G11  | Minis = M11,M15
// ✅ lane (1..3) ฝังใน spawn/hit/expire/block + logger
//
// NOTE: ไฟล์นี้เป็น “ตัวเต็ม” แบบรันได้ โดยไม่ต้อง TODO ค้าง
// - ต้องมี Particles (scorePop/burstAt/objPop/toast) และ FeverUI (optional) อยู่เหมือนเดิม

'use strict';

(function (ns) {
  const ROOT = (typeof window !== 'undefined' ? window : globalThis);

  // -------------------------------------------------------
  // External modules (optional)
  // -------------------------------------------------------
  const Particles =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
    ROOT.Particles || { scorePop(){}, burstAt(){}, objPop(){}, toast(){}, celebrate(){} };

  const FeverUI = ROOT.FeverUI || null;

  // -------------------------------------------------------
  // helpers
  // -------------------------------------------------------
  function isoNow() { return new Date().toISOString(); }
  function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
  function clamp01(x){ x=Number(x)||0; return x<0?0:(x>1?1:x); }
  function pickOne(arr, fallback=''){
    if (!Array.isArray(arr) || !arr.length) return fallback;
    return arr[(Math.random() * arr.length) | 0];
  }
  function pickN(arr, n){
    const a = (arr||[]).slice();
    for (let i=a.length-1;i>0;i--){
      const j = (Math.random()*(i+1))|0;
      const t=a[i]; a[i]=a[j]; a[j]=t;
    }
    return a.slice(0, Math.max(0, n|0));
  }
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

  // -------------------------------------------------------
  // Emoji sets
  // -------------------------------------------------------
  const GOOD = ['🍎','🥦','🥕','🍌','🍉','🥛'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🥤'];

  const POWER_SHIELD = '🛡️';
  const POWER_MAGNET = '🧲';
  const POWER_TIME   = '⏳';
  const POWER_FEVER  = '🔥';

  const GOLD = '🟡';
  const FAKE_SPARK = '✨';

  // -------------------------------------------------------
  // lanes
  // -------------------------------------------------------
  const LANE_N = 3; // 1..3
  const LANE_OFFSETS = [-0.9, 0, 0.9];

  function randLane(){ return 1 + ((Math.random() * LANE_N) | 0); }
  function laneToWorldOffsetX(lane){
    const i = Math.max(0, Math.min(LANE_N-1, (lane|0)-1));
    return LANE_OFFSETS[i] || 0;
  }
  function laneToFallbackX(lane){
    const w = window.innerWidth || 1000;
    const thirds = w / LANE_N;
    const center = (lane - 0.5) * thirds;
    const jitter = (Math.random()-0.5) * (thirds * 0.25);
    return Math.round(center + jitter);
  }

  // -------------------------------------------------------
  // Difficulty (spawn tuning) + challenge
  // -------------------------------------------------------
  // diff = gameplay difficulty (spawnMs/scale/maxActive/ratios)
  const DIFF = {
    easy:   { spawnMs: 1050, maxActive: 3, scale: 1.18, goodRatio: 0.78, powerRatio: 0.16, goldRatio: 0.06, fakeRatio: 0.06, bossHP: 6 },
    normal: { spawnMs: 820,  maxActive: 4, scale: 1.02, goodRatio: 0.72, powerRatio: 0.14, goldRatio: 0.07, fakeRatio: 0.08, bossHP: 8 },
    hard:   { spawnMs: 650,  maxActive: 5, scale: 0.92, goodRatio: 0.66, powerRatio: 0.12, goldRatio: 0.08, fakeRatio: 0.10, bossHP: 10 }
  };

  const CHALLENGES = ['rush','survival','boss'];

  // -------------------------------------------------------
  // “คำโผล่” (P.5 tone)
  // -------------------------------------------------------
  const WORD_GOOD_GENERIC = ['เก่งมาก!','เยี่ยมเลย!','สุดยอด!','ดีมาก!','ไปต่อ!','แชมป์!','ไหวอยู่!','เทพมาก!'];
  const WORD_JUNK_GENERIC = ['เบาๆ น้า~','อันนี้ไม่เอาน้า~','พลาดนิดนึง!','ลองใหม่!','ระวังนะ~','ข้ามไปก่อน!'];
  const WORD_FAKE = ['หลอกนะ!','แอบหลอก!','อย่าโดนหลอก~','ตาไวๆ!','ดูดีๆ!'];
  const WORD_BLOCK = ['กันได้!','โล่ช่วย!','ปลอดภัย!','บล็อกแล้ว!','รอดแล้ว!'];
  const WORD_GOLD = ['โบนัส!','แจ็กพอต!','ว้าว!','เก่งสุด!','ของพิเศษ!'];
  const WORD_POWER_SHIELD = ['โล่มา!','กันได้!','โล่ป้องกัน!','ปลอดภัย!'];
  const WORD_POWER_MAGNET = ['ดูดๆ!','มาเลย!','เก็บให้หมด!','ดูดเข้ามา!'];
  const WORD_POWER_TIME   = ['เวลา+!','ต่อเวลา!','ยังทัน!','เพิ่มเวลา!'];
  const WORD_POWER_FEVER  = ['ไฟลุก!','โหมดไฟ!','เร็วๆ!','คูณคะแนน!'];
  const WORD_BOSS = ['บอส!','สู้ๆ!','ตีบอส!','เอาชนะ!','ไปเลย!'];

  // -------------------------------------------------------
  // Food mapping (จริง)
  // -------------------------------------------------------
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

  // -------------------------------------------------------
  // Side objects + pop word
  // -------------------------------------------------------
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

  function p5WordFor(kind, emojiStr, power, streakNow){
    const K = String(kind||'').toLowerCase();
    const { info } = foodInfoFromEmoji(emojiStr);
    const s = (streakNow|0);

    if (K === 'power'){
      if (power === 'shield') return pickOne(WORD_POWER_SHIELD,'โล่มา!');
      if (power === 'magnet') return pickOne(WORD_POWER_MAGNET,'ดูดๆ!');
      if (power === 'time')   return pickOne(WORD_POWER_TIME,'เวลา+!');
      if (power === 'fever')  return pickOne(WORD_POWER_FEVER,'ไฟลุก!');
      return 'พลัง!';
    }
    if (K === 'block') return pickOne(WORD_BLOCK,'กันได้!');
    if (K === 'boss')  return pickOne(WORD_BOSS,'บอส!');
    if (K === 'fake')  return pickOne(WORD_FAKE,'หลอกนะ!');
    if (K === 'gold')  return pickOne(WORD_GOLD,'โบนัส!');

    if (K === 'junk'){
      return pickOne(WORD_JUNK_GENERIC,'เบาๆ น้า~');
    }

    // good
    const special = pickStreakSpecial(s);
    if (special && Math.random() < 0.2) return `ว้าว ${special}!`;
    return pickOne(WORD_GOOD_GENERIC,'เก่งมาก!');
  }

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

      const word = p5WordFor(kind, t && t.emoji, t && t.power, s);
      Particles.scorePop(x, y - 14, '', `[${TAG}] ${word}`, { plain:true });
    }
  }

  // -------------------------------------------------------
  // Camera helpers (A-Frame optional projection)
  // -------------------------------------------------------
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

  // -------------------------------------------------------
  // Stage / pacing
  // -------------------------------------------------------
  function stageOf(durationSec, timeLeft, challenge){
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

  // -------------------------------------------------------
  // DOM target element
  // -------------------------------------------------------
  function createDomEl(){
    const el = document.createElement('div');
    el.className = 'gj-target';
    el.setAttribute('data-hha-tgt','1');
    el.style.display = 'none';
    return el;
  }

  // -------------------------------------------------------
  // Engine state
  // -------------------------------------------------------
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

  // adaptive (play only)
  let adaptive = { spawnMs: null, maxActive: null, scale: null };
  let lastAdaptAt = 0;

  let idSeq = 0;
  const makeId = ()=> `${Date.now()}-${(++idSeq)}`;

  function nowMs(){
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  // -------------------------------------------------------
  // HUD emits (เดิม)
  // -------------------------------------------------------
  function emitJudge(label, extra){
    dispatch('hha:judge', { label, ...(extra||{}) });
  }
  function emitMiss(){
    dispatch('hha:miss', { misses });
  }
  function emitFeverEdgeIfNeeded(){
    if (!FeverUI || typeof FeverUI.isActive !== 'function') return;
    feverPrev = feverActive;
    feverActive = !!FeverUI.isActive();
    if (feverActive && !feverPrev){
      dispatch('hha:fever', { state:'start' });
    }else if (!feverActive && feverPrev){
      dispatch('hha:fever', { state:'end' });
    }
  }
  function emitScore(){
    if (FeverUI && typeof FeverUI.isActive === 'function'){
      feverActive = !!FeverUI.isActive();
      emitFeverEdgeIfNeeded();
    }else{
      feverActive = false;
      feverPrev = false;
    }
    const shieldOn = (nowMs() < shieldUntil);
    const magnetOn = (nowMs() < magnetUntil);

    dispatch('hha:score', {
      score, combo, comboMax, goodHits, misses,
      feverActive, shieldOn, magnetOn,
      timeLeft, durationSec, runMode, diff: diffKey, challenge,
      livesLeft, livesMax: MAX_LIVES,
      conditionGroup: META.conditionGroup || ''
    });
  }
  function emitTime(){
    dispatch('hha:time', { sec: timeLeft });
  }

  // -------------------------------------------------------
  // =======================================================
  // SESSION/EVENT LOGGING (schema ที่คุณกำหนด)
  // =======================================================
  // -------------------------------------------------------
  const META = {
    timestampIso: '',
    projectTag: 'HeroHealth-GoodJunkVR',
    runMode: 'play',
    studyId: '',
    phase: '',
    conditionGroup: '',        // hard / hard_alt (locked)
    sessionOrder: '',
    blockLabel: '',
    siteCode: '',
    schoolYear: '',
    semester: '',
    sessionId: '',
    gameMode: 'goodjunk',
    diff: 'normal',
    durationPlannedSec: 60,
    durationPlayedSec: 0,
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
    META.sessionId = m.sessionId || (m.sessionIdFromHub || m.sessionKey || '') || META.sessionId;
    META.gameMode = m.gameMode || 'goodjunk';
    META.diff = (m.diff || opts.diff || META.diff || 'normal');
    META.durationPlannedSec = Number(m.durationPlannedSec ?? m.durationSec ?? opts.durationPlannedSec ?? opts.durationSec ?? 60) || 60;
    META.device = m.device || '';
    META.gameVersion = m.gameVersion || '';

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

  const MET = {
    startMs: 0,
    startTimeIso: '',
    endTimeIso: '',
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
      this.startTimeIso = '';
      this.endTimeIso = '';
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

  function emitEventRow(row){
    dispatch('hha:log_event', row);
  }
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

  function logSpawn(t){
    const r = baseEventRow();
    r.eventType = 'spawn';
    r.timeFromStartMs = (t && t.born != null) ? Math.max(0, Math.round(t.born - MET.startMs)) : null;
    r.targetId = t ? String(t.id||'') : '';
    r.emoji = t ? String(t.emoji||'') : '';
    r.itemType = t ? String(t.type === 'power' ? (t.power||'power') : (t.type||'')) : '';
    r.lane = t && t.lane!=null ? String(t.lane) : '';
    r.extra = JSON.stringify({ conditionGroup: META.conditionGroup, lockedQuestSetKey });
    emitEventRow(r);
  }

  function logExpire(t, scoreNow){
    const r = baseEventRow();
    r.eventType = 'expire';
    r.timeFromStartMs = (typeof performance !== 'undefined' && performance.now)
      ? Math.max(0, Math.round(performance.now() - MET.startMs))
      : null;
    r.targetId = t ? String(t.id||'') : '';
    r.emoji = t ? String(t.emoji||'') : '';
    r.itemType = t ? String(t.type === 'power' ? (t.power||'power') : (t.type||'')) : '';
    r.lane = t && t.lane!=null ? String(t.lane) : '';
    r.judgment = (t && (t.type==='good' || t.type==='gold')) ? 'MISS_EXPIRE' : 'EXPIRE';
    r.totalScore = (typeof scoreNow === 'number') ? scoreNow : null;
    emitEventRow(r);
  }

  function logHit(t, judgment, rtMs, totalScore, comboNow, isGood){
    const r = baseEventRow();
    r.eventType = 'hit';
    r.timeFromStartMs = (typeof performance !== 'undefined' && performance.now)
      ? Math.max(0, Math.round(performance.now() - MET.startMs))
      : null;
    r.targetId = t ? String(t.id||'') : '';
    r.emoji = t ? String(t.emoji||'') : '';
    r.itemType = t ? String(t.type === 'power' ? (t.power||'power') : (t.type||'')) : '';
    r.lane = t && t.lane!=null ? String(t.lane) : '';
    r.rtMs = (typeof rtMs === 'number') ? Math.max(0, Math.round(rtMs)) : null;
    r.judgment = judgment || '';
    r.totalScore = (typeof totalScore === 'number') ? totalScore : null;
    r.combo = (typeof comboNow === 'number') ? comboNow : null;
    r.isGood = isGood ? '1' : '0';
    emitEventRow(r);
  }

  function logBlock(t, why){
    const r = baseEventRow();
    r.eventType = 'block';
    r.timeFromStartMs = (typeof performance !== 'undefined' && performance.now)
      ? Math.max(0, Math.round(performance.now() - MET.startMs))
      : null;
    r.targetId = t ? String(t.id||'') : '';
    r.emoji = t ? String(t.emoji||'') : '';
    r.itemType = String(why || (t && t.type) || 'junk');
    r.lane = t && t.lane!=null ? String(t.lane) : '';
    r.judgment = 'BLOCK';
    emitEventRow(r);
  }

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
      noteResearcher: META.noteResearcher
    };

    dispatch('hha:log_session', row);
  }

  // ✅ ผูก quest:update -> MET.goalProgress/MET.miniProgress (shape ตรงกับเกมนี้)
  ROOT.addEventListener('quest:update', (e)=>{
    const d = (e && e.detail) ? e.detail : null;

    if (d && d.goal){
      MET.goalProgress = JSON.stringify({
        title: d.goal.title || '',
        cur: Number(d.goal.cur ?? 0),
        total: Number(d.goal.total ?? 0),
        prog: (d.goal.prog != null) ? Number(d.goal.prog) : null,
        done: !!d.goal.done
      });
    }
    if (d && d.mini){
      MET.miniProgress = JSON.stringify({
        title: d.mini.title || '',
        cur: Number(d.mini.cur ?? 0),
        total: Number(d.mini.total ?? 0),
        prog: (d.mini.prog != null) ? Number(d.mini.prog) : null,
        done: !!d.mini.done
      });
    }
  });

  // -------------------------------------------------------
  // =======================================================
  // QUEST SYSTEM (Goal/Mini pools + difficulty split + lock)
  // =======================================================
  // -------------------------------------------------------
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

    noBadOk: true,         // ช่วงนี้ยังไม่โดน junk/fake/miss
    noBadStartMs: 0,

    showGoalIdx: 0,
    showMiniIdx: 0,
    lastRotateAt: 0
  };

  function markBadEvent(){
    QSTAT.noBadOk = false;
  }
  function recoverBadWindowOnGood(){
    if (!QSTAT.noBadOk){
      QSTAT.noBadOk = true;
      QSTAT.noBadStartMs = nowMs();
    }
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
    QSTAT.noBadStartMs = nowMs();

    QSTAT.showGoalIdx = 0;
    QSTAT.showMiniIdx = 0;
    QSTAT.lastRotateAt = 0;
  }

  // --- Quest objects: eval() returns {cur,total,prog,done} ---
  function makeCounterQuest(id, title, total, getter, tags){
    return {
      id, title,
      tags: Array.isArray(tags) ? tags : [],
      total: (total==null) ? 1 : Math.max(1, total|0),
      getCur: getter,
      eval(){
        const cur = Math.max(0, Number(getter())||0);
        const done = cur >= this.total;
        return { cur, total:this.total, prog: (this.total>0)?clamp01(cur/this.total):0, done };
      }
    };
  }
  function makeTimerQuest(id, title, sec, getSecOk, tags){
    return {
      id, title,
      tags: Array.isArray(tags) ? tags : [],
      total: Math.max(1, sec|0),
      getCur: ()=>0,
      eval(){
        const cur = Math.floor(Number(getSecOk())||0);
        const done = cur >= this.total;
        return { cur, total:this.total, prog: (this.total>0)?clamp01(cur/this.total):0, done };
      }
    };
  }

  // ✅ Goals 10 (ตามที่คุณวางโครงไว้) + เพิ่ม G11 ให้ครบชุดล็อก
  // tags: map -> ตัวแปรวิจัย (attention / inhibition / reaction)
  const GOAL_POOL_ALL = [
    makeCounterQuest('G01','เก็บของดีให้ครบ 25 ชิ้น', 25, ()=> QSTAT.goodHit, ['attention']),
    makeCounterQuest('G02','ทำคะแนนให้ถึง 2500',      2500, ()=> score|0,     ['attention']),
    makeCounterQuest('G03','ทำคอมโบสูงสุดให้ถึง 12',  12, ()=> comboMax|0,   ['attention']),
    makeCounterQuest('G04','เก็บผลไม้ให้ครบ 10',       10, ()=> QSTAT.fruitGood, ['attention']),
    makeCounterQuest('G05','เก็บผักให้ครบ 10',         10, ()=> QSTAT.vegGood,   ['attention']),
    makeCounterQuest('G06','เก็บนมให้ครบ 6',            6, ()=> QSTAT.dairyGood, ['attention']),
    makeCounterQuest('G07','เก็บ GOLD ให้ได้ 3 ครั้ง',  3, ()=> QSTAT.goldHit,   ['attention']),
    makeCounterQuest('G08','บล็อกการโจมตีให้ได้ 3',    3, ()=> QSTAT.block,     ['inhibition']),
    makeCounterQuest('G09','ใช้พลังโล่ 1 ครั้ง',        1, ()=> QSTAT.powerShield, ['attention']),
    makeCounterQuest('G10','พลาดรวมไม่เกิน 3',          3, ()=> (3 - (misses|0)),  ['inhibition']),

    // ✅ G11 (เพื่อชุด lock G10+G11): “ไม่โดน JUNK เลย” (inhibition ชัด)
    makeCounterQuest('G11','ห้ามโดนขยะ (JUNK) เลย',     1, ()=> (QSTAT.junkHit===0 ? 1 : 0), ['inhibition'])
  ];

  // ✅ Minis 15 + เพิ่ม M16 ให้ครบชุดล็อก
  const MINI_POOL_ALL = [
    makeCounterQuest('M01','ทำสตรีค 8 ครั้งติด', 8, ()=> combo|0, ['attention']),
    makeCounterQuest('M02','เก็บผลไม้ 6 ชิ้น',   6, ()=> QSTAT.fruitGood, ['attention']),
    makeCounterQuest('M03','เก็บผัก 6 ชิ้น',     6, ()=> QSTAT.vegGood,   ['attention']),
    makeCounterQuest('M04','เก็บนม 3 ชิ้น',      3, ()=> QSTAT.dairyGood, ['attention']),
    makeCounterQuest('M05','เก็บ GOLD 2 ครั้ง',  2, ()=> QSTAT.goldHit,   ['attention']),
    makeCounterQuest('M06','บล็อกขยะ/หลอก 2 ครั้ง', 2, ()=> QSTAT.block,  ['inhibition']),
    makeCounterQuest('M07','ใช้โล่ 1 ครั้ง',     1, ()=> QSTAT.powerShield, ['attention']),
    makeCounterQuest('M08','ใช้แม่เหล็ก 1 ครั้ง',1, ()=> QSTAT.powerMagnet, ['attention']),
    makeCounterQuest('M09','เพิ่มเวลา 1 ครั้ง',  1, ()=> QSTAT.powerTime, ['attention']),
    makeCounterQuest('M10','ติด FEVER 1 ครั้ง',  1, ()=> QSTAT.powerFever, ['attention']),

    makeTimerQuest('M11','10 วิ ห้ามโดนขยะ/หลอก/พลาด', 10, ()=> {
      if (!QSTAT.noBadOk) return 0;
      return (nowMs() - (QSTAT.noBadStartMs||nowMs()))/1000;
    }, ['inhibition']),

    makeTimerQuest('M12','8 วิ ทำให้เนียน', 8, ()=> {
      if (!QSTAT.noBadOk) return 0;
      return (nowMs() - (QSTAT.noBadStartMs||nowMs()))/1000;
    }, ['inhibition']),

    makeCounterQuest('M13','ตีของดี 5 ครั้งรวด', 5, ()=> Math.min(5, combo|0), ['attention']),
    makeCounterQuest('M14','ทำคะแนนให้ถึง 500',  500, ()=> score|0, ['attention']),
    makeCounterQuest('M15','อย่าโดนหลอก (FAKE) เลย', 1, ()=> (QSTAT.fakeHit===0 ? 1 : 0), ['inhibition']),

    // ✅ M16 (เพื่อชุด lock M01+M16): reaction/attention — “ตีของดีเร็ว” (นับ good hit ที่ rt <= 450ms)
    makeCounterQuest('M16','ตีของดีเร็ว 5 ครั้ง (≤450ms)', 5, ()=> warmRtFastGoodCount(), ['reaction'])
  ];

  // helper: นับ fast good hits (rt<=450) ระหว่าง session
  let _fastGoodHitCount = 0;
  function warmRtFastGoodCount(){ return _fastGoodHitCount|0; }

  // --- split pools by difficulty (play mode: random by diff) ---
  function splitPoolsByDiff(diff){
    diff = String(diff||'normal').toLowerCase();
    // แนวคิด: easy => เอาง่าย/พื้นฐาน, normal => ผสม, hard => รวมยาก+ยับยั้งมากขึ้น
    const goals = GOAL_POOL_ALL.slice();
    const minis = MINI_POOL_ALL.slice();

    if (diff === 'easy'){
      return {
        goals: goals.filter(q => !['G10','G11','G08'].includes(q.id)), // ตัด inhibition หนัก ๆ ออก
        minis: minis.filter(q => !['M11','M12','M15','M16'].includes(q.id))
      };
    }
    if (diff === 'hard'){
      return {
        goals: goals.filter(q => ['G02','G05','G10','G11','G03','G08','G07','G01','G04','G06','G09'].includes(q.id)),
        minis: minis.filter(q => ['M01','M11','M15','M16','M06','M13','M05','M10','M14','M07','M08','M09','M12','M02','M03','M04'].includes(q.id))
      };
    }
    // normal
    return { goals, minis };
  }

  // --- lock sets (ตามที่คุณล็อก) ---
  const QUEST_SET = {
    hard:     { goals:['G02','G05'], minis:['M01','M16'] },
    hard_alt: { goals:['G10','G11'], minis:['M11','M15'] }
  };

  // warmup -> pick which set
  function pickSetFromWarmup(w){
    // w = { medianRtGoodMs, junkErrorPct, accuracyGoodPct, fastHitRatePct }
    const rt = Number(w.medianRtGoodMs || 99999);
    const junkErr = Number(w.junkErrorPct || 999);
    const acc = Number(w.accuracyGoodPct || 0);
    const fast = Number(w.fastHitRatePct || 0);

    // เกณฑ์ "เก่ง" → hard, ไม่งั้น hard_alt
    if (acc >= 70 && junkErr <= 25 && rt <= 750) return 'hard';
    if (acc >= 65 && junkErr <= 30 && rt <= 680 && fast >= 20) return 'hard';
    return 'hard_alt';
  }

  // quest runtime
  const QUEST = {
    activeGoals: [],
    activeMinis: [],
    doneGoals: {},
    doneMinis: {},
    started: false
  };

  function findQuest(pool, id){
    for (const q of (pool||[])){
      if (q && q.id === id) return q;
    }
    return null;
  }

  // lock state
  let lockedQuestSetKey = ''; // 'hard'|'hard_alt'
  let warmupDone = false;

  function buildActiveQuestsRandomByDiff(){
    const pools = splitPoolsByDiff(diffKey);
    const gPool = pools.goals || [];
    const mPool = pools.minis || [];

    // play random spec: pool 10 pick 2 / pool 15 pick 3 (ตามที่ตกลง)
    QUEST.activeGoals = pickN(gPool, 2);
    QUEST.activeMinis = pickN(mPool, 3);

    QUEST.doneGoals = {};
    QUEST.doneMinis = {};
    QSTAT.showGoalIdx = 0;
    QSTAT.showMiniIdx = 0;
    QSTAT.lastRotateAt = 0;
  }

  function buildActiveQuestsFromLock(){
    const set = (lockedQuestSetKey === 'hard_alt') ? QUEST_SET.hard_alt : QUEST_SET.hard;

    QUEST.activeGoals = (set.goals||[]).map(id => findQuest(GOAL_POOL_ALL, id)).filter(Boolean);
    QUEST.activeMinis = (set.minis||[]).map(id => findQuest(MINI_POOL_ALL, id)).filter(Boolean);

    QUEST.doneGoals = {};
    QUEST.doneMinis = {};
    QSTAT.showGoalIdx = 0;
    QSTAT.showMiniIdx = 0;
    QSTAT.lastRotateAt = 0;
  }

  function emitQuestUpdate(){
    const gList = QUEST.activeGoals || [];
    const mList = QUEST.activeMinis || [];

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

    const goalTitle = g ? `GOAL ${gIdx+1}/${gList.length}: ${g.title}` : 'กำลังสุ่มภารกิจ…';
    const miniTitle = m ? `MINI ${mIdx+1}/${mList.length}: ${m.title}` : 'กำลังสุ่ม mini quest…';

    dispatch('quest:update', {
      goal: { title: goalTitle, ...gEval },
      mini: { title: miniTitle, ...mEval },
      extra: {
        // รายการทั้งหมด (ไว้ทำ HUD/แดชบอร์ด)
        goals: gList.map((q,i)=>({ i:i+1, id:q.id, title:q.title, ...q.eval(), done: !!QUEST.doneGoals[q.id], tags:q.tags||[] })),
        minis: mList.map((q,i)=>({ i:i+1, id:q.id, title:q.title, ...q.eval(), done: !!QUEST.doneMinis[q.id], tags:q.tags||[] })),
        lockedQuestSetKey,
        warmupDone
      }
    });
  }

  function checkQuestCompletion(){
    let changed = false;

    for (const q of (QUEST.activeGoals||[])){
      const e = q.eval();
      if (e.done && !QUEST.doneGoals[q.id]){
        QUEST.doneGoals[q.id] = true;
        changed = true;
        dispatch('hha:celebrate',{ type:'goal', id:q.id, title:q.title, tags:q.tags||[] });
      }
    }

    for (const q of (QUEST.activeMinis||[])){
      const e = q.eval();
      if (e.done && !QUEST.doneMinis[q.id]){
        QUEST.doneMinis[q.id] = true;
        changed = true;
        dispatch('hha:celebrate',{ type:'mini', id:q.id, title:q.title, tags:q.tags||[] });
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
    return {
      goalsCleared: gCleared,
      goalsTotal: g.length,
      miniCleared: mCleared,
      miniTotal: m.length
    };
  }

  // warmup timer + lock
  let warmupTimer = null;
  function beginWarmupThenLock(opts, onLocked){
    const warmupSec = clamp(opts.warmupSec ?? 15, 5, 30);

    warmupDone = false;
    lockedQuestSetKey = '';
    META.conditionGroup = '';

    // reset only warmup-related metrics
    MET.rtGoodList = [];
    MET.fastHitCount = 0;
    MET.nTargetGoodSpawned = 0;
    MET.nHitGood = 0;
    MET.nHitJunk = 0;
    MET.nHitJunkGuard = 0;

    emitJudge(`WARMUP ${warmupSec}s`);

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

      emitJudge(`LOCK: ${lockedQuestSetKey.toUpperCase()}`);
      onLocked && onLocked(w, lockedQuestSetKey);
    }, warmupSec * 1000);
  }

  // -------------------------------------------------------
  // Spawn spec
  // -------------------------------------------------------
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

  // -------------------------------------------------------
  // Target lifecycle
  // -------------------------------------------------------
  function removeTarget(t){
    const i = active.indexOf(t);
    if (i >= 0) active.splice(i,1);
    if (t.el) t.el.remove();
  }
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
      wobbleSeed: Math.random()*10,
      hp: null
    };

    active.push(t);
    layerEl.appendChild(el);

    // ✅ spawn counters + log
    if (t.type==='good') MET.nTargetGoodSpawned++;
    if (t.type==='junk') MET.nTargetJunkSpawned++;
    if (t.type==='gold') MET.nTargetStarSpawned++;
    if (t.type==='fake') MET.nTargetDiamondSpawned++;
    if (t.type==='power' && t.power==='shield') MET.nTargetShieldSpawned++;
    logSpawn(t);

    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      hitTarget(t, e.clientX || 0, e.clientY || 0);
    });

    setTimeout(()=>expireTarget(t), t.ttl);
  }

  function expireTarget(t){
    if (!running) return;
    removeTarget(t);

    // ✅ log expire
    logExpire(t, score);

    if ((t.type === 'good' || t.type === 'gold') && t.seen){
      misses++;
      combo = 0;

      MET.nExpireGood++;
      markBadEvent();

      emitScore();
      emitMiss();
      emitJudge('MISS');

      checkQuestCompletion();
      emitQuestUpdate();

      checkSurvivalLives();
    }
  }

  function checkSurvivalLives(){
    if (challenge !== 'survival') return;
    const lost = Math.floor((misses|0) / MISS_PER_LIFE);
    livesLeft = Math.max(0, MAX_LIVES - lost);
    dispatch('hha:lives',{ livesLeft, max: MAX_LIVES });
    if (livesLeft <= 0){
      stop('lives-zero');
    }
  }

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
      emitJudge('LEVEL UP!');
    } else if (missRate > 0.38){
      spawnMs = Math.round(base.spawnMs * 1.08);
      maxActive = Math.max(base.maxActive - 1, 2);
      scale = base.scale * 1.06;
      emitJudge('EASY DOWN!');
    }

    adaptive = { spawnMs, maxActive, scale };
    dispatch('hha:adaptive', { ...adaptive });
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
      born: nowMs(),
      ttl: 999999,
      seen: false,
      fallback2D: { x: window.innerWidth/2, y: window.innerHeight*0.38 },
      wobbleSeed: Math.random()*10
    };

    el.textContent = t.emoji;

    active.push(t);
    layerEl.appendChild(el);

    // boss spawn log
    logSpawn(t);

    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      hitTarget(t, e.clientX || 0, e.clientY || 0);
    });

    bossTarget = t;
    emitJudge('BOSS!');
    dispatch('quest:boss', { hp });

    emitQuestUpdate();
  }

  function hitTarget(t, x, y){
    if (!t || !t.el) return;

    const rtMs = nowMs() - (t.born || nowMs());

    // BOSS
    if (t.type === 'boss'){
      t.hp = (t.hp|0) - 1;

      sideObjectsOnHit(t, x, y, 'boss', combo);

      emitJudge('BOSS HIT!');
      logHit(t, 'BOSS_HIT', rtMs, score, combo, true);

      if (t.hp <= 0){
        removeTarget(t);
        bossTarget = null;

        const mult = comboMultiplier();
        const feverNow = (FeverUI && FeverUI.isActive) ? !!FeverUI.isActive() : false;
        const add = Math.round((240 * mult) * (feverNow ? 1.2 : 1));
        score += add;
        combo += 2;
        comboMax = Math.max(comboMax, combo);

        if (Particles && Particles.burstAt) Particles.burstAt(window.innerWidth/2, window.innerHeight*0.22, 'GOLD');
        if (canObjPop()){
          Particles.objPop(x, y, '🏆', { side:'left', size: 28 });
          Particles.objPop(x, y, '👑', { side:'right', size: 28 });
        }

        emitJudge('BOSS CLEAR!');
        dispatch('quest:bossClear',{ ok:true });

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

    // remove on hit
    removeTarget(t);

    // POWER
    if (t.type === 'power'){
      sideObjectsOnHit(t, x, y, 'power', combo);

      if (t.power === 'shield'){
        shieldUntil = nowMs() + 5000;
        QSTAT.powerShield++;
        emitJudge('SHIELD ON!');
        logHit(t, 'POWER_SHIELD', rtMs, score, combo, true);
        emitScore();
        dispatch('quest:power',{ power:'shield' });

        checkQuestCompletion();
        emitQuestUpdate();
        return;
      }
      if (t.power === 'magnet'){
        magnetUntil = nowMs() + 4000;
        QSTAT.powerMagnet++;
        emitJudge('MAGNET!');
        logHit(t, 'POWER_MAGNET', rtMs, score, combo, true);
        emitScore();
        dispatch('quest:power',{ power:'magnet' });

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
        logHit(t, 'POWER_TIME', rtMs, score, combo, true);
        emitScore();
        dispatch('quest:power',{ power:'time' });

        checkQuestCompletion();
        emitQuestUpdate();
        return;
      }
      if (t.power === 'fever'){
        feverAdd(22);
        QSTAT.powerFever++;
        emitJudge('FEVER+');
        logHit(t, 'POWER_FEVER', rtMs, score, combo, true);
        emitScore();
        dispatch('quest:power',{ power:'fever' });

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
        MET.nHitJunkGuard++;
        emitJudge('BLOCK!');
        logBlock(t, 'fake');
        emitScore();
        dispatch('quest:block',{ ok:true, why:'fake' });

        checkQuestCompletion();
        emitQuestUpdate();
        return;
      }

      dispatch('quest:badHit',{ type:'fake' });

      misses++;
      combo = 0;
      feverReduce(18);

      QSTAT.fakeHit++;
      MET.nHitJunk++;
      markBadEvent();

      sideObjectsOnHit(t, x, y, 'fake', combo);

      emitMiss();
      emitJudge('MISS', { why:'fake' });

      // ✅ log hit
      logHit(t, 'HIT_FAKE', rtMs, score, combo, false);

      checkSurvivalLives();

      checkQuestCompletion();
      emitQuestUpdate();
      emitScore();
      return;
    }

    // JUNK
    if (t.type === 'junk'){
      if (shieldOn()){
        sideObjectsOnHit(t, x, y, 'block', combo);
        QSTAT.block++;
        MET.nHitJunkGuard++;
        emitJudge('BLOCK!');
        logBlock(t, 'junk');
        emitScore();
        dispatch('quest:block',{ ok:true, why:'junk' });

        checkQuestCompletion();
        emitQuestUpdate();
        return;
      }

      dispatch('quest:badHit',{ type:'junk' });

      misses++;
      combo = 0;
      feverReduce(12);

      QSTAT.junkHit++;
      MET.nHitJunk++;
      markBadEvent();

      sideObjectsOnHit(t, x, y, 'junk', combo);

      emitMiss();
      emitJudge('MISS');

      // ✅ log hit
      logHit(t, 'HIT_JUNK', rtMs, score, combo, false);

      checkSurvivalLives();

      checkQuestCompletion();
      emitQuestUpdate();
      emitScore();
      return;
    }

    // GOOD / GOLD
    goodHits++;
    combo++;
    comboMax = Math.max(comboMax, combo);

    QSTAT.goodHit++;
    if (t.type === 'gold') QSTAT.goldHit++;

    // food group counters
    const fi = foodInfoFromEmoji(t.emoji);
    if (fi && fi.info){
      if (fi.info.cat === 'fruit') QSTAT.fruitGood++;
      if (fi.info.cat === 'veg')   QSTAT.vegGood++;
      if (fi.info.cat === 'dairy') QSTAT.dairyGood++;
    }

    recoverBadWindowOnGood();

    // side fx
    sideObjectsOnHit(t, x, y, (t.type === 'gold') ? 'gold' : 'good', combo);

    if (t.type === 'gold') feverAdd(10);
    else feverAdd(4);

    const feverNow = (FeverUI && typeof FeverUI.isActive === 'function') ? !!FeverUI.isActive() : false;
    const mult = comboMultiplier();

    let base = 10;
    if (t.type === 'gold') base = 80;
    if (feverNow) base = Math.round(base * 1.7);

    const st = stageOf(durationSec, timeLeft, challenge);
    if (challenge === 'rush'){
      if (st === 'mid') base = Math.round(base * 1.12);
      if (st === 'final') base = Math.round(base * 1.25);
    }

    const add = Math.round(base * mult);
    score += add;

    // perfect-ish label
    emitJudge(combo >= 10 ? 'PERFECT' : 'GOOD', { mult });

    // ✅ logging counters + rt samples
    MET.nHitGood++;
    if (typeof rtMs === 'number' && rtMs >= 0){
      MET.rtGoodList.push(rtMs);
      if (rtMs <= 450){
        MET.fastHitCount++;
        _fastGoodHitCount++; // ใช้กับ M16
      }
    }

    // ✅ log hit
    logHit(t, (t.type === 'gold') ? 'HIT_GOLD' : 'HIT_GOOD', rtMs, score, combo, true);

    // extra pop
    if (Particles && typeof Particles.scorePop === 'function'){
      Particles.scorePop(
        x, y,
        '+' + add,
        (t.type === 'gold') ? '[GOLD] '+pickOne(WORD_GOLD,'โบนัส!') : '[GOOD] '+pickOne(WORD_GOOD_GENERIC,'เก่งมาก!')
      );
    }
    if (Particles && typeof Particles.burstAt === 'function'){
      if (t.type === 'gold') Particles.burstAt(x,y,'GOLD');
      if (st === 'final' && Math.random() < 0.15) Particles.burstAt(x,y,'GOOD');
    }

    dispatch('quest:goodHit',{ type:t.type, add, mult, feverNow });

    checkQuestCompletion();
    emitQuestUpdate();
    emitScore();
  }

  // -------------------------------------------------------
  // Render loop (project 3D->2D fallback)
  // -------------------------------------------------------
  function renderLoop(){
    if (!running) return;

    const ready = cameraReady();
    const st = stageOf(durationSec, timeLeft, challenge);

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
    const st = stageOf(durationSec, timeLeft, challenge);

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

    // ให้ timer-minis เดิน + HUD อัปเดต
    if (QUEST && QUEST.started){
      checkQuestCompletion();
      emitQuestUpdate();
    }

    tickTimer = setTimeout(tickLoop, 1000);
  }

  // -------------------------------------------------------
  // Start/Stop (PROD)
  // -------------------------------------------------------
  function initQuestRun(opts={}){
    resetQuestStats();
    QUEST.started = true;

    // research: FIX ไม่สุ่ม (เลือกชุดจาก forceSet/conditionGroup)
    if (runMode === 'research'){
      buildActiveQuestsFromLock();
    } else {
      // play: ถ้ามี lock แล้ว ให้ใช้ lock, ถ้ายังไม่ lock ให้สุ่มตาม diff ไปก่อน
      if (warmupDone && lockedQuestSetKey) buildActiveQuestsFromLock();
      else buildActiveQuestsRandomByDiff();
    }

    emitQuestUpdate();
  }

  function start(diff, opts={}){
    if (running) return;

    running = true;
    layerEl = opts.layerEl || document.getElementById('gj-layer');

    readMetaFromOpts(opts);

    diffKey = String(diff || opts.diff || 'normal').toLowerCase();
    if (!DIFF[diffKey]) diffKey = 'normal';

    runMode = (opts.runMode === 'research') ? 'research' : 'play';

    challenge = String(opts.challenge || 'rush').toLowerCase();
    if (!CHALLENGES.includes(challenge)) challenge = 'rush';

    durationSec = clamp(opts.durationSec ?? META.durationPlannedSec ?? 60, 20, 180);
    timeLeft = durationSec;

    // reset gameplay
    score=0; combo=0; comboMax=0; goodHits=0; misses=0;
    shieldUntil = 0;
    magnetUntil = 0;
    bossSpawned = false;
    bossTarget = null;

    adaptive = { spawnMs: null, maxActive: null, scale: null };
    lastAdaptAt = 0;

    livesLeft = MAX_LIVES;
    dispatch('hha:lives',{ livesLeft, max: MAX_LIVES });

    if (FeverUI && typeof FeverUI.reset === 'function'){
      FeverUI.reset();
    }

    // reset logging
    META.diff = diffKey;
    META.runMode = runMode;
    META.startTimeIso = isoNow();
    META.timestampIso = META.startTimeIso;

    MET.reset();
    MET.startMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    MET.startTimeIso = META.startTimeIso;

    _fastGoodHitCount = 0;

    // research lock selection
    const forceSet = String(opts.forceSet || opts.conditionGroup || '').toLowerCase(); // 'hard'|'hard_alt'
    if (runMode === 'research'){
      lockedQuestSetKey = (forceSet === 'hard_alt') ? 'hard_alt' : 'hard';
      warmupDone = true;
      META.conditionGroup = lockedQuestSetKey;
      emitJudge(`RESEARCH FIX: ${lockedQuestSetKey.toUpperCase()}`);
      initQuestRun(opts);
    } else {
      // play: เริ่มด้วยสุ่มตาม diff ก่อน แล้ว warmup -> lock -> rebuild quests
      warmupDone = false;
      lockedQuestSetKey = '';
      META.conditionGroup = '';

      initQuestRun(opts);

      beginWarmupThenLock(opts, (_warm, setKey)=>{
        lockedQuestSetKey = setKey;
        META.conditionGroup = setKey;

        // ✅ ล็อกแล้ว: reset quest progress ใหม่ ให้เป็นชุดล็อกจริง
        resetQuestStats();
        buildActiveQuestsFromLock();
        QUEST.started = true;
        emitQuestUpdate();

        dispatch('quest:lock', { conditionGroup: setKey, warmup: _warm });
      });
    }

    dispatch('hha:mode', { diff:diffKey, runMode, challenge, durationSec, conditionGroup: META.conditionGroup });

    emitTime();
    emitScore();

    renderLoop();
    spawnLoop();
    tickLoop();

    console.log('[GoodJunkVR] start', { diffKey, runMode, challenge, durationSec, conditionGroup: META.conditionGroup });
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

    const copy = active.slice();
    for (const t of copy) removeTarget(t);
    active.length = 0;

    META.endTimeIso = isoNow();
    MET.endTimeIso = META.endTimeIso;

    const startT = new Date(META.startTimeIso).getTime();
    const endT = new Date(META.endTimeIso).getTime();
    MET.durationPlayedSec = (isFinite(startT) && isFinite(endT) && endT>startT) ? Math.round((endT-startT)/1000) : 0;

    // finalize metrics
    MET.scoreFinal = score|0;
    MET.comboMax   = comboMax|0;
    MET.misses     = misses|0;

    const qs = questSummary();
    MET.goalsCleared = qs.goalsCleared;
    MET.goalsTotal   = qs.goalsTotal;
    MET.miniCleared  = qs.miniCleared;
    MET.miniTotal    = qs.miniTotal;

    emitSessionRow(reason);

    dispatch('hha:end',{
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
      stats: { ...qs },
      conditionGroup: META.conditionGroup,
      startTimeIso: META.startTimeIso,
      endTimeIso: META.endTimeIso
    });

    console.log('[GoodJunkVR] stop', { reason, sessionId: META.sessionId, conditionGroup: META.conditionGroup });
  }

  ns.GameEngine = { start, stop };

})(window.GoodJunkVR = window.GoodJunkVR || {});

export const GameEngine = window.GoodJunkVR.GameEngine;
