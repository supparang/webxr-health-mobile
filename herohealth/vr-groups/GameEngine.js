/* === /herohealth/vr-groups/GameEngine.js ===
Food Groups VR — PRODUCTION GameEngine (DOM)
✅ Drag + Gyro parallax (targets move with screen)
✅ Spawn spread + safe-rect (avoid top/bottom HUD)
✅ Thai 5 Food Groups core (sequential goals 1→5; do not change)
✅ Mini quests (timed / no-junk / streak) + urgent tick/flash
✅ Specials: STAR / DIAMOND / SHIELD / BOSS / DECOY / JUNK
✅ Shield blocks junk hit => NOT counted as miss (and counts nHitJunkGuard)
✅ Deterministic seed RNG
✅ Play-mode adaptive difficulty (research mode fixed)
✅ Events: hha:score / hha:time / groups:power / hha:rank / quest:update / hha:coach / hha:end
*/

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  // ---------------- helpers ----------------
  function clamp(v, a, b){ v = Number(v); if(!Number.isFinite(v)) v = 0; return Math.max(a, Math.min(b, v)); }
  function now(){ return performance.now(); }
  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch{}
  }
  function pick(arr, r){ return arr[Math.floor(r()*arr.length)] || arr[0]; }
  function hashStr(s){
    s = String(s ?? '');
    let h = 2166136261;
    for (let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(seed){
    let a = seed >>> 0;
    return function(){
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------- Thai 5 food groups (fixed) ----------------
  // "ทุกคนจำไว้อย่าได้แปลผัน"
  const SONG_LINES = {
    1: 'หมู่ 1 กินเนื้อ นม ไข่ ถั่วเมล็ด ช่วยให้เติบโตแข็งขัน',
    2: 'หมู่ 2 ข้าว แป้ง เผือก มัน และน้ำตาล จะให้พลัง',
    3: 'หมู่ 3 กินผักต่างๆ สารอาหารมากมายกินเป็นอาจิณ',
    4: 'หมู่ 4 กินผลไม้ สีเขียวเหลืองบ้างมีวิตามิน',
    5: 'หมู่ 5 อย่าได้ลืมกิน ไขมันทั้งสิ้น อบอุ่นร่างกาย'
  };

  const GROUP_EMOJI = {
    1: ['🥩','🥛','🥚','🫘','🐟','🧀'],
    2: ['🍚','🍞','🥔','🍠','🍜','🍬'],
    3: ['🥦','🥬','🥕','🥒','🍅','🌽'],
    4: ['🍎','🍌','🍊','🍉','🍍','🥭'],
    5: ['🥑','🧈','🥜','🫒','🥥','🫑'] // ไขมัน (ใส่สีให้เด่น)
  };

  const JUNK_EMOJI = ['🍟','🍕','🍔','🌭','🍩','🍰','🧋','🥤','🍪','🍫','🍿'];

  // ---------------- difficulty presets ----------------
  const DIFFS = {
    easy:   { spawnEveryMs: 900, ttlMs: 2400, junkBias: 0.14, specialBias: 0.10, targetScale: 1.10, goalHits: 7 },
    normal: { spawnEveryMs: 760, ttlMs: 2200, junkBias: 0.18, specialBias: 0.12, targetScale: 1.00, goalHits: 9 },
    hard:   { spawnEveryMs: 640, ttlMs: 2050, junkBias: 0.22, specialBias: 0.14, targetScale: 0.92, goalHits: 11 }
  };

  // ---------------- engine state ----------------
  const Engine = {
    layerEl: null,
    running: false,
    rafId: 0,
    spawnTimer: 0,
    tickTimer: 0,
    secondTimer: 0,

    // movement
    vx: 0, vy: 0,
    dragOn: false,
    lastX: 0, lastY: 0,
    gyroX: 0, gyroY: 0,

    // config
    cfg: null,
    rng: null,

    // session
    startAt: 0,
    endAt: 0,
    timeLeft: 90,
    durationPlannedSec: 90,

    // gameplay stats
    score: 0,
    combo: 0,
    comboMax: 0,
    misses: 0,

    nTargetGoodSpawned: 0,
    nTargetJunkSpawned: 0,
    nTargetStarSpawned: 0,
    nTargetDiamondSpawned: 0,
    nTargetShieldSpawned: 0,
    nHitGood: 0,
    nHitJunk: 0,
    nHitJunkGuard: 0,
    nExpireGood: 0,

    rtList: [],

    // power/boss
    power: 0,
    powerThr: 10,
    bossActive: false,
    bossHp: 0,

    // fever/shield
    fever: 0,          // 0..100
    shieldUntil: 0,     // timestamp ms

    // goals/minis
    goalIndex: 1, // 1..5
    goalNeed: 9,
    goalDone: 0,
    goalsTotal: 5,

    mini: null, // {type, title, need, done, untilMs, noJunk, streak, startedAtMs}
    miniTotal: 999,
    miniCleared: 0,

    // adaptive (play mode only)
    adap: { spawnEveryMs: 0, ttlMs: 0, junkBias: 0, lastAdjAt: 0 }
  };

  function setLayerVars(){
    if(!Engine.layerEl) return;
    Engine.layerEl.style.setProperty('--vx', (Engine.vx|0) + 'px');
    Engine.layerEl.style.setProperty('--vy', (Engine.vy|0) + 'px');
  }

  function viewport(){
    return {
      w: root.innerWidth || DOC.documentElement.clientWidth || 360,
      h: root.innerHeight || DOC.documentElement.clientHeight || 640
    };
  }

  function safeRect(){
    const { w, h } = viewport();
    const pad = 12;

    // top: hud + pills + questRow
    const top = 120;            // กันทับ HUD + pills
    const top2 = 56;            // กันทับ questRow
    const bottom = 120;         // กันทับ power + safe area

    const left = pad;
    const right = w - pad;
    const y1 = top + top2;
    const y2 = h - bottom;

    const ww = Math.max(120, right - left);
    const hh = Math.max(160, y2 - y1);

    return { x:left, y:y1, w:ww, h:hh };
  }

  function applyFx(cls){
    const el = DOC.documentElement;
    el.classList.add(cls);
    setTimeout(()=> el.classList.remove(cls), 220);
  }

  function coach(mood, text, hint, ttlMs){
    emit('hha:coach', { mood, text, hint, ttlMs });
  }

  function updateRank(){
    const a = calcAccuracy();
    const s = Engine.score;
    const m = Engine.misses;

    // grade logic (SSS/SS/S/A/B/C)
    let g = 'C';
    if (a >= 96 && m <= 3 && s >= 2200) g = 'SSS';
    else if (a >= 92 && m <= 5 && s >= 1800) g = 'SS';
    else if (a >= 88 && m <= 8 && s >= 1400) g = 'S';
    else if (a >= 80) g = 'A';
    else if (a >= 68) g = 'B';
    else g = 'C';

    emit('hha:rank', { grade: g });
    return g;
  }

  function calcAccuracy(){
    const totalGood = Engine.nHitGood + Engine.nExpireGood;
    if (totalGood <= 0) return 0;
    return Math.round((Engine.nHitGood / totalGood) * 100);
  }

  function scoreEvent(){
    emit('hha:score', {
      score: Engine.score,
      combo: Engine.combo,
      comboMax: Engine.comboMax,
      misses: Engine.misses,
      accuracyGoodPct: calcAccuracy()
    });
  }

  function powerEvent(){
    emit('groups:power', { charge: Engine.power, threshold: Engine.powerThr });
  }

  function questEvent(){
    const gi = Engine.goalIndex;
    const goalText = `หมู่ ${gi}: ${SONG_LINES[gi]}`;
    const goalNow = Engine.goalDone;
    const goalTotal = Engine.goalNeed;

    let miniText = '—';
    let miniNow = null, miniTotal = null, miniTimeLeftSec = null;

    if (Engine.mini){
      miniText = Engine.mini.title || 'Mini';
      miniNow = Engine.mini.done;
      miniTotal = Engine.mini.need;
      if (Engine.mini.untilMs){
        miniTimeLeftSec = Math.max(0, Math.ceil((Engine.mini.untilMs - now())/1000));
      }
    }

    emit('quest:update', {
      goalText,
      goalNow,
      goalTotal,
      miniText,
      miniNow,
      miniTotal,
      miniTimeLeftSec,
      goalStage: gi,
      goalStagesTotal: Engine.goalsTotal
    });
  }

  function clearTargets(){
    if(!Engine.layerEl) return;
    Engine.layerEl.querySelectorAll('.fg-target').forEach(el=> el.remove());
  }

  function stop(reason){
    if(!Engine.running) return;
    Engine.running = false;

    clearInterval(Engine.spawnTimer);
    clearInterval(Engine.tickTimer);
    clearInterval(Engine.secondTimer);
    Engine.spawnTimer = 0; Engine.tickTimer = 0; Engine.secondTimer = 0;

    cancelAnimationFrame(Engine.rafId);
    Engine.rafId = 0;

    Engine.endAt = now();

    clearTargets();

    const grade = updateRank();
    const durationPlayedSec = Math.max(0, Math.round((Engine.endAt - Engine.startAt)/1000));
    const acc = calcAccuracy();

    emit('hha:end', {
      reason: reason || 'end',
      scoreFinal: Engine.score,
      comboMax: Engine.comboMax,
      misses: Engine.misses,
      accuracyGoodPct: acc,
      grade,
      durationPlannedSec: Engine.durationPlannedSec,
      durationPlayedSec,

      // spawn/hit stats
      nTargetGoodSpawned: Engine.nTargetGoodSpawned,
      nTargetJunkSpawned: Engine.nTargetJunkSpawned,
      nTargetStarSpawned: Engine.nTargetStarSpawned,
      nTargetDiamondSpawned: Engine.nTargetDiamondSpawned,
      nTargetShieldSpawned: Engine.nTargetShieldSpawned,
      nHitGood: Engine.nHitGood,
      nHitJunk: Engine.nHitJunk,
      nHitJunkGuard: Engine.nHitJunkGuard,
      nExpireGood: Engine.nExpireGood,

      goalsCleared: Engine.goalIndex > 5 ? 5 : (Engine.goalIndex-1),
      goalsTotal: 5,
      miniCleared: Engine.miniCleared,
      miniTotal: Engine.miniTotal
    });

    coach('neutral', 'จบเกมแล้ว! 🏁', 'กด “เล่นอีกครั้ง” หรือ “กลับ HUB”', 1400);
  }

  // ---------------- movement (drag + gyro) ----------------
  function bindInput(){
    const el = Engine.layerEl;
    if(!el) return;

    // drag
    el.addEventListener('pointerdown', (e)=>{
      Engine.dragOn = true;
      Engine.lastX = e.clientX;
      Engine.lastY = e.clientY;
      try{ el.setPointerCapture(e.pointerId); }catch{}
    });

    el.addEventListener('pointermove', (e)=>{
      if(!Engine.dragOn) return;
      const dx = (e.clientX - Engine.lastX);
      const dy = (e.clientY - Engine.lastY);
      Engine.lastX = e.clientX;
      Engine.lastY = e.clientY;

      const maxShift = 80;
      Engine.vx = clamp(Engine.vx + dx * 0.35, -maxShift, maxShift);
      Engine.vy = clamp(Engine.vy + dy * 0.35, -maxShift, maxShift);
      setLayerVars();
    });

    el.addEventListener('pointerup', ()=>{
      Engine.dragOn = false;
    });
    el.addEventListener('pointercancel', ()=>{
      Engine.dragOn = false;
    });

    // gyro
    if ('DeviceOrientationEvent' in root) {
      root.addEventListener('deviceorientation', (ev)=>{
        const g = clamp(ev.gamma || 0, -45, 45); // left-right
        const b = clamp(ev.beta  || 0, -45, 45); // front-back
        Engine.gyroX = g / 45; // -1..1
        Engine.gyroY = b / 45;
      }, { passive:true });
    }
  }

  function gyroLoop(){
    if(!Engine.running) return;
    const maxShift = 80;
    const tx = clamp(Engine.gyroX * 18, -maxShift, maxShift);
    const ty = clamp(Engine.gyroY * 10, -maxShift, maxShift);

    // smooth
    Engine.vx = clamp(Engine.vx * 0.92 + tx * 0.08, -maxShift, maxShift);
    Engine.vy = clamp(Engine.vy * 0.92 + ty * 0.08, -maxShift, maxShift);
    setLayerVars();

    Engine.rafId = requestAnimationFrame(gyroLoop);
  }

  // ---------------- spawn logic ----------------
  function currentDiff(){
    const d = Engine.cfg.diff;
    return DIFFS[d] || DIFFS.normal;
  }

  function isShieldOn(){
    return now() < Engine.shieldUntil;
  }

  function tweakAdaptive(){
    if (Engine.cfg.runMode !== 'play') return;
    const t = now();
    if (t - Engine.adap.lastAdjAt < 2500) return;
    Engine.adap.lastAdjAt = t;

    // simple adaptation:
    // if many misses -> slow spawn + reduce junk a bit
    // if strong combo -> speed up + increase junk a bit
    const missRate = Engine.misses / Math.max(1, Engine.nHitGood + Engine.misses);
    const strong = Engine.comboMax >= 14 || Engine.combo >= 10;

    if (missRate > 0.28){
      Engine.adap.spawnEveryMs = clamp(Engine.adap.spawnEveryMs + 60, 560, 1200);
      Engine.adap.junkBias = clamp(Engine.adap.junkBias - 0.02, 0.10, 0.30);
      Engine.adap.ttlMs = clamp(Engine.adap.ttlMs + 60, 1700, 3000);
    } else if (strong){
      Engine.adap.spawnEveryMs = clamp(Engine.adap.spawnEveryMs - 45, 520, 1200);
      Engine.adap.junkBias = clamp(Engine.adap.junkBias + 0.015, 0.10, 0.32);
      Engine.adap.ttlMs = clamp(Engine.adap.ttlMs - 30, 1600, 2800);
    }
  }

  function chooseType(r){
    const base = currentDiff();
    const junkBias = (Engine.cfg.runMode === 'play') ? Engine.adap.junkBias : base.junkBias;

    // specials chance affected by style
    let specialBias = base.specialBias;
    if (Engine.cfg.style === 'hard') specialBias += 0.03;
    if (Engine.cfg.style === 'feel') specialBias -= 0.02;
    specialBias = clamp(specialBias, 0.06, 0.20);

    // boss gate
    if (!Engine.bossActive && Engine.power >= Engine.powerThr && r() < 0.35) return 'boss';

    const x = r();
    if (x < junkBias) return 'junk';
    if (x < junkBias + specialBias){
      const y = r();
      if (y < 0.32) return 'star';
      if (y < 0.54) return 'diamond';
      if (y < 0.76) return 'shield';
      return 'decoy';
    }
    return 'good';
  }

  function pickEmoji(type){
    const r = Engine.rng;
    const gi = Engine.goalIndex;

    if (type === 'junk') return pick(JUNK_EMOJI, r);

    if (type === 'good'){
      // mostly current group; sometimes other group as decoy good
      if (r() < 0.78){
        return pick(GROUP_EMOJI[gi], r);
      }
      const other = 1 + Math.floor(r()*5);
      return pick(GROUP_EMOJI[other], r);
    }

    if (type === 'decoy'){
      // decoy: wrong-group food, looks like good
      const other = (gi % 5) + 1;
      return pick(GROUP_EMOJI[other], r);
    }

    if (type === 'star') return '⭐';
    if (type === 'diamond') return '💎';
    if (type === 'shield') return '🛡️';
    if (type === 'boss') return '👿';

    return '❓';
  }

  function randomPos(){
    const r = Engine.rng;
    const rect = safeRect();

    // sample a bit and avoid clustering
    for (let tries=0; tries<14; tries++){
      const x = rect.x + r() * rect.w;
      const y = rect.y + r() * rect.h;

      // avoid too close to existing targets
      let ok = true;
      Engine.layerEl.querySelectorAll('.fg-target').forEach(el=>{
        const ex = Number(el.dataset.px||0);
        const ey = Number(el.dataset.py||0);
        const dx = ex - x;
        const dy = ey - y;
        if (dx*dx + dy*dy < 62*62) ok = false;
      });

      if (ok) return { x, y };
    }

    // fallback
    return { x: rect.x + rect.w*0.5, y: rect.y + rect.h*0.5 };
  }

  function makeTarget(type){
    const r = Engine.rng;
    const base = currentDiff();
    const ttlMs = (Engine.cfg.runMode === 'play') ? Engine.adap.ttlMs : base.ttlMs;

    const { x, y } = randomPos();
    const el = DOC.createElement('div');
    el.className = 'fg-target';
    el.dataset.type = type;

    const emoji = pickEmoji(type);
    el.setAttribute('data-emoji', emoji);

    // scale
    let s = base.targetScale;
    if (type === 'boss') s *= 1.35;
    if (type === 'shield') s *= 1.08;
    if (type === 'star') s *= 1.05;
    if (type === 'diamond') s *= 1.08;

    // apply classes for look
    if (type === 'junk') el.classList.add('is-junk');
    if (type === 'decoy') el.classList.add('is-decoy');
    if (type === 'star') el.classList.add('is-star');
    if (type === 'diamond') el.classList.add('is-diamond');
    if (type === 'shield') el.classList.add('is-shield');
    if (type === 'boss') el.classList.add('is-boss');

    el.style.setProperty('--x', x + 'px');
    el.style.setProperty('--y', y + 'px');
    el.style.setProperty('--s', String(s));

    el.dataset.px = String(x);
    el.dataset.py = String(y);

    // stats spawn
    if (type === 'good') Engine.nTargetGoodSpawned++;
    if (type === 'junk') Engine.nTargetJunkSpawned++;
    if (type === 'star') Engine.nTargetStarSpawned++;
    if (type === 'diamond') Engine.nTargetDiamondSpawned++;
    if (type === 'shield') Engine.nTargetShieldSpawned++;

    let createdAt = now();
    let removed = false;

    function removeAs(cls){
      if (removed) return;
      removed = true;
      if (cls) el.classList.add(cls);
      setTimeout(()=> el.remove(), 170);
    }

    function isCurrentGroupFood(em){
      // for good type: must be in current group list
      const list = GROUP_EMOJI[Engine.goalIndex] || [];
      return list.includes(em);
    }

    function onHit(ev){
      ev && ev.preventDefault && ev.preventDefault();
      if (!Engine.running) return;

      const t = now();
      const rt = Math.max(0, t - createdAt);
      // store RT only for good hits (current group)
      // (we keep list but don't overgrow too much)
      if (Engine.rtList.length < 800) Engine.rtList.push(rt);

      const isShield = isShieldOn();

      // -------- types --------
      if (type === 'shield'){
        Engine.shieldUntil = t + 6500;
        Engine.score += 60;
        Engine.combo += 1;
        Engine.comboMax = Math.max(Engine.comboMax, Engine.combo);
        Engine.power = clamp(Engine.power + 2, 0, 99);
        applyFx('fg-shield');
        coach('happy', 'ได้โล่แล้ว! 🛡️', 'ช่วงนี้โดนขยะไม่เป็น Miss', 1200);
        scoreEvent(); powerEvent();
        removeAs('hit');
        return;
      }

      if (type === 'star'){
        Engine.score += 120;
        Engine.combo += 1;
        Engine.comboMax = Math.max(Engine.comboMax, Engine.combo);
        Engine.power = clamp(Engine.power + 2, 0, 99);
        applyFx('fg-mini');
        coach('happy', '⭐ โบนัส!', 'เก็บคะแนนพุ่ง!', 1000);
        scoreEvent(); powerEvent();
        removeAs('hit');
        return;
      }

      if (type === 'diamond'){
        Engine.score += 180;
        Engine.combo += 2;
        Engine.comboMax = Math.max(Engine.comboMax, Engine.combo);
        Engine.power = clamp(Engine.power + 3, 0, 99);
        applyFx('fg-mini');
        coach('happy', '💎 เพชร!', 'คอมโบเด้ง!', 1000);
        scoreEvent(); powerEvent();
        removeAs('hit');
        return;
      }

      if (type === 'boss'){
        if (!Engine.bossActive){
          Engine.bossActive = true;
          Engine.bossHp = 3;
          applyFx('fg-rage');
          coach('fever', '👿 BOSS มาแล้ว!', 'แตะให้ครบ 3 ครั้ง!', 1200);
        }
        Engine.bossHp -= 1;
        Engine.score += 90;
        Engine.combo += 1;
        Engine.comboMax = Math.max(Engine.comboMax, Engine.combo);

        if (Engine.bossHp <= 0){
          Engine.bossActive = false;
          Engine.power = 0;
          Engine.powerThr = clamp(Engine.powerThr + 1, 8, 14); // เพิ่มนิดให้ท้าทาย
          applyFx('fg-win');
          coach('happy', 'ล้มบอส! 🎉', 'POWER รีเซ็ต', 1200);

          // mini win boost
          if (Engine.mini){
            Engine.mini.done = Engine.mini.need;
            miniComplete(true);
          }
          powerEvent();
        }
        scoreEvent();
        removeAs('hit');
        return;
      }

      if (type === 'junk'){
        Engine.nHitJunk++;
        Engine.combo = 0;

        if (isShield){
          Engine.nHitJunkGuard++;
          Engine.score += 10;
          applyFx('fg-shield');
          coach('happy', 'โล่กันไว้! ✅', 'ขยะไม่เป็น Miss', 900);
        } else {
          Engine.misses += 1;
          Engine.fever = clamp(Engine.fever + 14, 0, 100);
          applyFx('fg-flash-bad');
          applyFx('fg-stun');
          if (Engine.fever >= 80) applyFx('fg-fever');
          coach(Engine.fever >= 80 ? 'fever' : 'sad', 'โดนขยะ! 😵', 'โฟกัสหมู่ให้ถูก!', 1100);
        }

        // if mini requires no-junk -> fail
        if (Engine.mini && Engine.mini.noJunk && !isShield){
          miniFail('โดนขยะระหว่างทำ MINI');
        }

        scoreEvent();
        removeAs('hit');
        return;
      }

      // good / decoy (decoy looks like food but wrong group)
      if (type === 'decoy'){
        Engine.combo = 0;
        if (!isShield){
          Engine.misses += 1;
          Engine.fever = clamp(Engine.fever + 10, 0, 100);
          applyFx('fg-flash-bad');
        }
        coach('sad', 'อันนี้ “หมู่ถัดไป” 😅', `ตอนนี้ต้องหมู่ ${Engine.goalIndex} นะ`, 1200);
        scoreEvent();
        removeAs('hit');
        return;
      }

      // type === good
      const isRight = isCurrentGroupFood(emoji);

      if (!isRight){
        // treat wrong-group food as decoy mistake
        Engine.combo = 0;
        if (!isShield){
          Engine.misses += 1;
          Engine.fever = clamp(Engine.fever + 10, 0, 100);
          applyFx('fg-flash-bad');
        }
        coach('sad', 'ผิดหมู่! 😅', `จำเพลง: หมู่ ${Engine.goalIndex}`, 1200);
        scoreEvent();
        removeAs('hit');
        return;
      }

      // correct group hit
      Engine.nHitGood++;
      Engine.combo += 1;
      Engine.comboMax = Math.max(Engine.comboMax, Engine.combo);

      // score rule: base + combo bonus
      const bonus = Math.min(22, Math.floor(Engine.combo / 4) * 2);
      Engine.score += (12 + bonus);

      // reduce fever slightly on good
      Engine.fever = clamp(Engine.fever - 4, 0, 100);

      // power
      Engine.power = clamp(Engine.power + 1, 0, 99);

      // goal progress
      Engine.goalDone += 1;

      // mini progress
      if (Engine.mini) miniOnGood();

      // goal complete?
      if (Engine.goalDone >= Engine.goalNeed){
        goalAdvance();
      }

      coach('happy', 'ถูกต้อง! ✅', `หมู่ ${Engine.goalIndex}: เก็บให้ครบ`, 900);
      scoreEvent(); powerEvent(); questEvent();
      removeAs('hit');
    }

    el.addEventListener('pointerdown', onHit, { passive:false });

    // timeout
    const to = setTimeout(()=>{
      if (removed) return;
      removed = true;
      if (type === 'good'){
        Engine.nExpireGood += 1;
        // missing a good hurts a bit
        Engine.combo = 0;
      }
      el.classList.add('out');
      setTimeout(()=> el.remove(), 180);
      scoreEvent();
    }, ttlMs);

    // ensure clear timer on remove
    const obs = new MutationObserver(()=>{
      if (!DOC.body.contains(el)){
        clearTimeout(to);
        obs.disconnect();
      }
    });
    obs.observe(DOC.body, { childList:true, subtree:true });

    return el;
  }

  // ---------------- goals/minis ----------------
  function goalAdvance(){
    const gi = Engine.goalIndex;

    applyFx('fg-win');
    coach('happy', `ผ่านหมู่ ${gi}! 🎉`, SONG_LINES[gi], 1500);

    Engine.goalIndex += 1;
    Engine.goalDone = 0;

    if (Engine.goalIndex > 5){
      // all goals complete
      stop('all-goals');
      return;
    }

    // announce next group
    coach('neutral', `ต่อไปหมู่ ${Engine.goalIndex} ✨`, SONG_LINES[Engine.goalIndex], 1800);
    questEvent();
  }

  function startMini(){
    if (Engine.mini) return;

    const r = Engine.rng;
    const gi = Engine.goalIndex;
    const modeHard = (Engine.cfg.style === 'hard');

    // choose mini type
    const roll = r();

    // mini configs
    let mini = null;

    if (roll < 0.34){
      // timed hits
      const need = modeHard ? 6 : 5;
      const sec  = modeHard ? 7 : 8;
      mini = {
        type:'rush',
        title:`Plate Rush (Groups): ครบ ${need} ภายใน ${sec} วิ`,
        need, done:0,
        untilMs: now() + sec*1000,
        noJunk: true
      };
    } else if (roll < 0.68){
      // streak
      const need = modeHard ? 10 : 8;
      mini = {
        type:'streak',
        title:`Streak: แตะ “หมู่ ${gi}” ต่อเนื่อง ${need} ครั้ง`,
        need, done:0,
        untilMs: 0,
        noJunk:false,
        streak:true
      };
    } else {
      // avoid junk for time
      const sec = modeHard ? 9 : 10;
      mini = {
        type:'avoid',
        title:`No-Junk Zone: ห้ามโดนขยะ ${sec} วิ`,
        need: sec, done:0,
        untilMs: now() + sec*1000,
        noJunk:true
      };
    }

    Engine.mini = mini;
    applyFx('fg-mini');
    coach('neutral', 'เริ่ม MINI! ⚡', mini.title, 1400);
    questEvent();
  }

  function miniOnGood(){
    const m = Engine.mini;
    if (!m) return;

    if (m.type === 'rush'){
      m.done += 1;
      if (m.done >= m.need){
        miniComplete(true);
        return;
      }
      return;
    }

    if (m.type === 'streak'){
      m.done += 1;
      if (m.done >= m.need){
        miniComplete(true);
        return;
      }
      return;
    }

    // avoid: good doesn't change, but can give small comfort
  }

  function miniTick(){
    const m = Engine.mini;
    if (!m) return;

    if (m.type === 'avoid'){
      const left = Math.max(0, m.untilMs - now());
      const secLeft = Math.ceil(left/1000);
      m.done = m.need - secLeft; // progress
      if (left <= 0){
        miniComplete(true);
        return;
      }

      if (secLeft <= 3){
        applyFx('fg-mini-urgent');
        if (secLeft <= 2) applyFx('fg-mini-urgent2');
      }
      questEvent();
      return;
    }

    if (m.type === 'rush'){
      const left = Math.max(0, m.untilMs - now());
      const secLeft = Math.ceil(left/1000);
      if (left <= 0){
        miniFail('หมดเวลา MINI');
        return;
      }
      if (secLeft <= 3){
        applyFx('fg-mini-urgent');
        if (secLeft <= 2) applyFx('fg-mini-urgent2');
      }
      questEvent();
      return;
    }

    // streak has no timer
    questEvent();
  }

  function miniFail(reason){
    if (!Engine.mini) return;
    applyFx('fg-mini-fail');
    coach('sad', 'MINI ไม่ผ่าน 😵', reason || 'ลองใหม่!', 1300);
    Engine.mini = null;
    questEvent();
  }

  function miniComplete(isWin){
    if (!Engine.mini) return;
    if (isWin){
      Engine.miniCleared += 1;
      applyFx('fg-mini-win');
      Engine.score += 220;
      Engine.power = clamp(Engine.power + 2, 0, 99);
      coach('happy', 'MINI สำเร็จ! 🎉', '+220 คะแนน', 1200);
      scoreEvent(); powerEvent();
    }
    Engine.mini = null;
    questEvent();
  }

  // ---------------- main loops ----------------
  function spawnLoop(){
    if (!Engine.running) return;

    // auto-start mini sometimes
    if (!Engine.mini && Engine.cfg.style !== 'feel'){
      if (Engine.rng() < 0.06) startMini();
    } else if (!Engine.mini && Engine.cfg.style === 'feel'){
      if (Engine.rng() < 0.035) startMini();
    }

    // adapt (play mode)
    tweakAdaptive();

    const type = chooseType(Engine.rng);
    const el = makeTarget(type);
    if (el && Engine.layerEl) Engine.layerEl.appendChild(el);
  }

  function tickLoop(){
    if (!Engine.running) return;

    // mini ticking
    miniTick();

    // fever visuals
    if (Engine.fever >= 85){
      applyFx('fg-fever');
      coach('fever', 'ใจเย็น ๆ 😵‍💫', 'เล็งหมู่ให้ถูก!', 900);
    }

    // shield nearing end
    if (isShieldOn()){
      const left = Engine.shieldUntil - now();
      if (left < 1400){
        applyFx('fg-shield');
      }
    }
  }

  function secondLoop(){
    if (!Engine.running) return;

    Engine.timeLeft = Math.max(0, Engine.timeLeft - 1);
    emit('hha:time', { left: Engine.timeLeft });

    // update grade occasionally
    updateRank();

    if (Engine.timeLeft <= 0){
      stop('time-up');
    }
  }

  // ---------------- public API ----------------
  Engine.setLayerEl = function (el){
    Engine.layerEl = el;
    setLayerVars();
  };

  Engine.start = function (diff, opts){
    if (!Engine.layerEl) return;
    if (Engine.running) Engine.stop('restart');

    opts = opts || {};
    const diffKey = String(diff || opts.diff || 'normal').toLowerCase();
    const style = String(opts.style || 'mix').toLowerCase();
    const runMode = String(opts.runMode || 'play').toLowerCase();
    const timeSec = clamp(opts.time || 90, 30, 180);
    const seedStr = (opts.seed != null && String(opts.seed).trim() !== '') ? String(opts.seed) : String(Date.now());

    Engine.cfg = { diff: diffKey, style, runMode, timeSec, seed: seedStr };
    Engine.rng = mulberry32(hashStr(seedStr + '::GroupsVR'));

    const base = DIFFS[diffKey] || DIFFS.normal;

    Engine.running = true;
    Engine.startAt = now();
    Engine.endAt = 0;

    Engine.timeLeft = Math.round(timeSec);
    Engine.durationPlannedSec = Math.round(timeSec);

    // reset stats
    Engine.score = 0; Engine.combo = 0; Engine.comboMax = 0; Engine.misses = 0;
    Engine.nTargetGoodSpawned = 0; Engine.nTargetJunkSpawned = 0; Engine.nTargetStarSpawned = 0;
    Engine.nTargetDiamondSpawned = 0; Engine.nTargetShieldSpawned = 0;
    Engine.nHitGood = 0; Engine.nHitJunk = 0; Engine.nHitJunkGuard = 0; Engine.nExpireGood = 0;
    Engine.power = 0; Engine.powerThr = (diffKey === 'hard') ? 9 : (diffKey === 'easy' ? 11 : 10);
    Engine.bossActive = false; Engine.bossHp = 0;
    Engine.fever = 0; Engine.shieldUntil = 0;

    Engine.goalIndex = 1;
    Engine.goalNeed = base.goalHits;
    Engine.goalDone = 0;
    Engine.goalsTotal = 5;

    Engine.mini = null;
    Engine.miniCleared = 0;
    Engine.miniTotal = 999;

    // adaptive (play mode only)
    Engine.adap.spawnEveryMs = base.spawnEveryMs;
    Engine.adap.ttlMs = base.ttlMs;
    Engine.adap.junkBias = base.junkBias;
    Engine.adap.lastAdjAt = now();

    // movement init
    Engine.vx = 0; Engine.vy = 0; Engine.dragOn = false;
    setLayerVars();

    clearTargets();
    bindInput();

    // announce goal
    coach('neutral', 'เริ่มเลย! 🎶', SONG_LINES[1], 1700);

    // initial UI
    scoreEvent();
    powerEvent();
    emit('hha:time', { left: Engine.timeLeft });
    questEvent();
    updateRank();

    // loops
    Engine.spawnTimer = setInterval(spawnLoop, Engine.adap.spawnEveryMs);
    Engine.tickTimer  = setInterval(tickLoop, 180);
    Engine.secondTimer= setInterval(secondLoop, 1000);

    // gyro smoothing
    Engine.rafId = requestAnimationFrame(gyroLoop);
  };

  Engine.stop = function(reason){
    stop(reason || 'stop');
  };

  // expose
  root.GroupsVR = root.GroupsVR || {};
  root.GroupsVR.GameEngine = Engine;

})(window);