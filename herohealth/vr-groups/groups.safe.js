/* === /herohealth/vr-groups/groups.safe.js ===
Food Groups VR — SAFE (PRODUCTION) — WITH:
✅ A: Miss Standard (HHA_Miss) + breakdown + dedupe
✅ C: UI SafeZones (HHA_SafeZones) => spawn never under HUD/Quest/Coach/Power/VR UI
✅ Fix: Miss inflated because targets spawned under UI -> solved by safezones
✅ Fix: optional rule: expire_good counts as miss (toggleable)
✅ Emits: hha:score, hha:time, hha:rank, hha:coach, quest:update, groups:power, groups:progress, hha:judge, hha:end
✅ runMode: play | research | practice
   - research: deterministic seed + adaptive OFF + AI OFF
   - practice: deterministic + NO storm + NO mini (or mini optional) + no rank pressure
*/

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};

  // ---------------- Utils ----------------
  function clamp(v, a, b) { v = Number(v); if (!isFinite(v)) v = a; return v < a ? a : (v > b ? b : v); }
  function nowMs() { return (root.performance && performance.now) ? performance.now() : Date.now(); }

  function hashSeed(str) {
    str = String(str ?? '');
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function makeRng(seedU32) {
    let s = (seedU32 >>> 0) || 1;
    return function rand() { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; };
  }

  function pick(rng, arr) { return arr[(rng() * arr.length) | 0]; }

  function emit(name, detail) {
    try { root.dispatchEvent(new CustomEvent(name, { detail })); } catch (_) {}
  }

  function cssSet(el, k, v) { try { el.style.setProperty(k, v); } catch (_) {} }
  function addBodyClass(c, on) { DOC.body.classList.toggle(c, !!on); }

  function flashBodyFx(cls, ms){
    try{
      DOC.body.classList.add(cls);
      setTimeout(()=>{ try{ DOC.body.classList.remove(cls); }catch(_){} }, ms||180);
    }catch(_){}
  }

  function getViewFromBodyOrParam(v) {
    const b = DOC.body;
    const cls = (b && b.className) ? b.className : '';
    if (String(v || '').includes('cvr') || cls.includes('view-cvr')) return 'cvr';
    if (String(v || '').includes('vr')  || cls.includes('view-vr'))  return 'vr';
    if (String(v || '').includes('pc')  || cls.includes('view-pc'))  return 'pc';
    return 'mobile';
  }

  // ---------------- Content ----------------
  const GROUPS = [
    { key: 'fruit',   th: 'ผลไม้',     emoji: ['🍎','🍌','🍊','🍇','🍉','🍍','🥭','🍐'] },
    { key: 'veg',     th: 'ผัก',       emoji: ['🥦','🥕','🥬','🍅','🥒','🌽','🧅','🍆'] },
    { key: 'protein', th: 'โปรตีน',    emoji: ['🍗','🥚','🐟','🫘','🥜','🍤','🍖','🧀'] },
    { key: 'grain',   th: 'ข้าว-แป้ง', emoji: ['🍚','🍞','🥖','🍜','🍝','🥟','🥞','🍙'] },
    { key: 'dairy',   th: 'นม',        emoji: ['🥛','🧈','🧀','🍦','🥣','🍼'] },
  ];
  const JUNK = ['🍟','🍔','🌭','🍕','🍩','🍭','🍬','🥤','🧋','🍫','🧁','🍰'];

  // ---------------- Difficulty presets ----------------
  function diffPreset(diff) {
    diff = String(diff || 'normal').toLowerCase();
    if (diff === 'easy') {
      return {
        time: 90,
        baseSpawnMs: 780,
        stormEverySec: 26,
        stormLenSec: 7,
        targetSize: 1.02,
        wrongRate: 0.22,
        junkRate: 0.12,
        bossHp: 6,
        powerThreshold: 7,
        goalTargets: 16,
        goalsTotal: 2,
      };
    }
    if (diff === 'hard') {
      return {
        time: 90,
        baseSpawnMs: 560,
        stormEverySec: 22,
        stormLenSec: 8,
        targetSize: 0.92,
        wrongRate: 0.32,
        junkRate: 0.18,
        bossHp: 10,
        powerThreshold: 9,
        goalTargets: 22,
        goalsTotal: 2,
      };
    }
    return {
      time: 90,
      baseSpawnMs: 650,
      stormEverySec: 24,
      stormLenSec: 7,
      targetSize: 0.98,
      wrongRate: 0.27,
      junkRate: 0.15,
      bossHp: 8,
      powerThreshold: 8,
      goalTargets: 19,
      goalsTotal: 2,
    };
  }

  // ---------------- Grade logic ----------------
  // NOTE: โหมดเกมโชว์ SSS/SS/S/A/B/C ได้
  // โหมดวิจัย: บันทึกตัวเลขแยก (accuracy, misses, score) แล้วค่อยคำนวณทีหลังได้
  function gradeFrom(accPct, misses, score) {
    accPct = Number(accPct) || 0;
    misses = Number(misses) || 0;
    score  = Number(score)  || 0;

    // ให้ Miss ลงโทษชัด (กัน Miss 20+ ยังได้ S)
    const mPenalty = Math.min(34, misses * 2.8);
    const sBoost   = Math.min(8, Math.log10(Math.max(10, score)) * 2.0);
    const v = accPct - mPenalty + sBoost;

    if (v >= 94) return 'SSS';
    if (v >= 88) return 'SS';
    if (v >= 80) return 'S';
    if (v >= 70) return 'A';
    if (v >= 58) return 'B';
    return 'C';
  }

  // ---------------- SafeZones helpers (C) ----------------
  function safeZoneSelectors(){
    // กันเป้าไม่ให้ทับ UI จริง ๆ
    // เพิ่ม/ลดได้ตาม layout ของคุณ
    return [
      '.hud',
      '.questTop',
      '.powerWrap',
      '.coachWrap',
      '.hha-vr-ui',
      '.hha-crosshair',
      '.overlay' // ตอน overlay เปิด ไม่ควร spawn อยู่แล้ว แต่กันไว้
    ];
  }

  function computeSafe(view){
    const SZ = root.HHA_SafeZones;
    if (!SZ || !SZ.compute) return null;

    // cVR ให้กันพื้นที่กลางเพิ่มนิด (crosshair)
    const edgePad = (view === 'cvr') ? 18 : 12;
    const uiPad   = (view === 'cvr') ? 12 : 10;

    return SZ.compute({
      selectors: safeZoneSelectors(),
      uiPad,
      edgePad
    });
  }

  function pickSafePointSafe(safe, rng, radius){
    const SZ = root.HHA_SafeZones;
    if (!safe || !SZ || !SZ.pickSafePoint) return null;

    return SZ.pickSafePoint({
      playRect: safe.playRect,
      excludeRects: safe.excludeRects,
      rng,
      tries: 110,
      radius: radius || 44
    });
  }

  // ---------------- Engine ----------------
  function Engine() {
    this.layerEl = null;
    this.running = false;

    this.cfg = null;
    this.view = 'mobile';
    this.rng = null;

    this.startAt = 0;
    this.lastTick = 0;
    this.leftSec = 0;

    this.score = 0;
    this.combo = 0;
    this.comboMax = 0;

    // ✅ Miss Counter (A)
    this.missCounter = null;      // HHA_Miss counter
    this.misses = 0;              // cached from counter

    // pressure (optional)
    this.pressure = 0;
    this._lastPressureTip = 0;

    // counts
    this.nTargetGoodSpawned = 0;
    this.nTargetWrongSpawned = 0;
    this.nTargetJunkSpawned = 0;
    this.nTargetBossSpawned = 0;
    this.nHitGood = 0;
    this.nHitWrong = 0;
    this.nHitJunk = 0;
    this.nExpireGood = 0;
    this.nExpireWrong = 0;
    this.nExpireJunk = 0;

    this.hitGoodForAcc = 0;
    this.totalJudgedForAcc = 0;

    // gameplay
    this.activeGroupIdx = 0;
    this.powerCharge = 0;

    this.stormOn = false;
    this.stormUntil = 0;
    this.nextStormAt = 0;

    this.spawnTmr = 0;

    // quest
    this.goalsTotal = 2;
    this.goalIndex = 0;
    this.goalNow = 0;
    this.goalNeed = 18;

    // mini
    this.mini = null;
    this.nextMiniAt = 0;
    this.miniTotal = 0;
    this.miniCleared = 0;

    // targets
    this.targets = [];
    this._id = 0;

    // safezones cache (C)
    this.safe = null;
    this._safeLastAt = 0;

    // coach
    this.coachLastAt = 0;
  }

  Engine.prototype.setLayerEl = function (el) {
    this.layerEl = el;
  };

  Engine.prototype._accuracyPct = function () {
    const denom = Math.max(1, this.totalJudgedForAcc);
    return Math.round((this.hitGoodForAcc / denom) * 100);
  };

  Engine.prototype._emitScore = function () {
    emit('hha:score', { score: this.score | 0, combo: this.combo | 0, misses: this.misses | 0 });
  };

  Engine.prototype._emitRank = function () {
    const acc = this._accuracyPct();
    const grade = gradeFrom(acc, this.misses, this.score);
    emit('hha:rank', { grade, accuracy: acc });
  };

  Engine.prototype._emitPower = function () {
    const thr = this.cfg.preset.powerThreshold;
    emit('groups:power', { charge: this.powerCharge | 0, threshold: thr | 0 });
  };

  Engine.prototype._emitCoach = function (text, mood) {
    const t = nowMs();
    if (t - this.coachLastAt < 450) return;
    this.coachLastAt = t;
    emit('hha:coach', { text: String(text || ''), mood: String(mood || 'neutral') });
  };

  // ---------- Miss Standard (A) ----------
  Engine.prototype._initMissCounter = function(){
    const M = root.HHA_Miss;
    // fallback ถ้าไม่ได้ include miss-standard.js
    if (!M || !M.createCounter){
      this.missCounter = null;
      this.misses = 0;
      return;
    }

    const run = this.cfg.runMode;

    // ✅ แนะนำสำหรับเด็ก ป.5:
    // - wrong/junk นับแน่นอน
    // - expire_good “นับได้” แต่ถ้าคุณยังอยากลดโหด ให้ปิดเป็น false ได้
    // - shoot miss ไม่ควรนับ (เพราะเด็กจะยิงตอนเป้าไม่อยู่)
    const goodExpireCounts = (run === 'play'); // ถ้าอยาก “ไม่ให้นับ expire เป็น miss” -> เปลี่ยนเป็น false
    this.missCounter = M.createCounter({
      gameTag: 'GroupsVR',
      dedupeMs: 360,
      rules: {
        wrongHitCounts: true,
        junkHitCounts: true,
        goodExpiredCounts: goodExpireCounts,
        shootMissCounts: false
      }
    });

    this.missCounter.set(0);
    this.misses = 0;
  };

  Engine.prototype._countMiss = function(kind, targetId){
    if (this.cfg && this.cfg.runMode === 'practice'){
      // practice ไม่กดดัน: ไม่เพิ่ม miss
      return;
    }

    if (this.missCounter){
      const r = this.missCounter.count({ kind, targetId, tsMs: nowMs() });
      this.misses = this.missCounter.get() | 0;
      // ส่ง breakdown ให้หลังบ้านได้ (optional)
      emit('groups:progress', { kind:'miss_counted', missKind:r.kind, misses:this.misses, breakdown:this.missCounter.getBreakdown() });
    }else{
      // fallback แบบเดิม
      this.misses = (this.misses|0) + 1;
    }
  };

  // ---------- Pressure (optional) ----------
  Engine.prototype._calcPressure = function(){
    const m = this.misses|0;
    if (m >= 14) return 3;
    if (m >= 9)  return 2;
    if (m >= 5)  return 1;
    return 0;
  };

  Engine.prototype._applyPressure = function(p){
    p = clamp(p,0,3)|0;
    if (p === this.pressure) return;
    this.pressure = p;

    addBodyClass('press-1', p>=1);
    addBodyClass('press-2', p>=2);
    addBodyClass('press-3', p>=3);

    if (this.cfg && this.cfg.runMode === 'play'){
      if (p>=1) flashBodyFx('fx-miss', 220);
      if (p>=2) flashBodyFx('fx-bad', 240);
      if (p>=3) flashBodyFx('fx-bad', 280);
    }

    emit('groups:progress', { kind:'pressure', level:p, misses:this.misses|0 });

    const t = nowMs();
    if (t - this._lastPressureTip > 2500 && this.cfg && this.cfg.runMode==='play'){
      this._lastPressureTip = t;
      if (p===1) this._emitCoach('เริ่มพลาดบ่อยแล้วนะ ตั้งสติ + เล็งก่อนยิง 👀', 'neutral');
      if (p===2) this._emitCoach('โหมดกดดัน! ช้าลงนิด เล็งให้ตรงหมู่ก่อน 🔥', 'fever');
      if (p===3) this._emitCoach('อันตราย! ห้ามยิงมั่ว เดี๋ยว Rank ตก 😤', 'sad');
    }
  };

  Engine.prototype._onMiss = function (why, targetId) {
    emit('groups:progress', { kind:'miss', why });

    // ✅ ใช้มาตรฐานนับ Miss
    const k =
      (why === 'wrong') ? 'wrong_hit' :
      (why === 'junk') ? 'junk_hit' :
      (why === 'expire_good') ? 'expire' :
      (why === 'mini_fail') ? 'mini' :
      'other';

    this._countMiss(k, targetId);

    if (this.cfg && this.cfg.runMode==='play'){
      const p = this._calcPressure();
      this._applyPressure(p);
    }

    // โค้ชเตือนเป็นระยะ
    if (this.cfg && this.cfg.runMode==='play'){
      if ((this.misses|0) === 5)  this._emitCoach('เริ่มพลาดแล้วนะ ลอง “หยุด-เล็ง-ยิง” 👌', 'neutral');
      if ((this.misses|0) === 9)  this._emitCoach('พลาดเยอะขึ้น! โฟกัสหมู่ที่ถูกก่อน 🔥', 'fever');
      if ((this.misses|0) === 14) this._emitCoach('โหมดโหด! อย่ายิงมั่ว เดี๋ยว Rank ตก 😤', 'sad');
    }
  };

  // ---------- SafeZones cache refresh ----------
  Engine.prototype._refreshSafe = function(force){
    const t = nowMs();
    if (!force && (t - this._safeLastAt) < 450) return;
    this._safeLastAt = t;
    this.safe = computeSafe(this.view);
  };

  // ---------------- Start ----------------
  Engine.prototype.start = function (diff, opts) {
    opts = opts || {};
    const rm = String(opts.runMode || 'play').toLowerCase();
    const runMode = (rm === 'research') ? 'research' : (rm === 'practice' ? 'practice' : 'play');
    const seedIn  = (opts.seed != null) ? String(opts.seed) : String(Date.now());
    const preset  = diffPreset(diff);
    const timeSec = clamp(opts.time ?? preset.time, 5, 180);

    this.cfg = { diff: String(diff || 'normal').toLowerCase(), runMode, seed: seedIn, timeSec, preset };
    this.view = getViewFromBodyOrParam(opts.view);

    // deterministic always
    this.rng = makeRng(hashSeed(seedIn + '::groups'));
    this.leftSec = Math.round(timeSec);

    // reset
    this.score = 0;
    this.combo = 0;
    this.comboMax = 0;

    this.pressure = 0;
    this._lastPressureTip = 0;
    addBodyClass('press-1', false); addBodyClass('press-2', false); addBodyClass('press-3', false);

    this.nTargetGoodSpawned = 0;
    this.nTargetWrongSpawned = 0;
    this.nTargetJunkSpawned = 0;
    this.nTargetBossSpawned = 0;
    this.nHitGood = 0;
    this.nHitWrong = 0;
    this.nHitJunk = 0;
    this.nExpireGood = 0;
    this.nExpireWrong = 0;
    this.nExpireJunk = 0;

    this.hitGoodForAcc = 0;
    this.totalJudgedForAcc = 0;

    this.targets = [];
    this._id = 0;

    this.activeGroupIdx = (this.rng() * GROUPS.length) | 0;
    this.powerCharge = 0;

    this.goalIndex = 0;
    this.goalsTotal = preset.goalsTotal;
    this.goalNeed = preset.goalTargets;
    this.goalNow = 0;

    this.mini = null;
    this.miniTotal = 0;
    this.miniCleared = 0;
    this.nextMiniAt = nowMs() + 14000;

    this.stormOn = false;
    this.stormUntil = 0;
    this.nextStormAt = nowMs() + preset.stormEverySec * 1000;

    this.running = true;
    this.startAt = nowMs();
    this.lastTick = this.startAt;
    this.spawnTmr = 0;

    // ✅ init safezones + miss counter
    this._refreshSafe(true);
    this._initMissCounter();

    emit('hha:time', { left: this.leftSec });
    this._emitScore();
    this._emitRank();
    this._emitCoach((runMode==='practice') ? 'โหมดฝึก 15 วิ ลองเล็งแล้วแตะยิง 🎯' : 'เริ่มเลย! เล็งให้ตรงหมู่ แล้วค่อยยิง 🎯', 'happy');
    this._emitPower();
    this._emitQuestUpdate();

    this._installInput();
    this._loop();
  };

  // ---------------- Input ----------------
  Engine.prototype._installInput = function () {
    const self = this;
    if (!this._onShoot) {
      this._onShoot = function () {
        if (!self.running) return;
        self._shootCrosshair();
      };
      root.addEventListener('hha:shoot', this._onShoot, { passive: true });
    }
  };

  // ---------------- Loop ----------------
  Engine.prototype._loop = function () {
    const self = this;
    function frame() {
      if (!self.running) return;

      const t = nowMs();
      self.lastTick = t;

      // safezones refresh occasionally (รองรับ rotate / resize / UI animate)
      self._refreshSafe(false);

      self._tickTime(t);
      self._tickStorm(t);
      self._tickMini(t);
      self._tickSpawn(t);
      self._tickExpire(t);

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  Engine.prototype._tickTime = function (t) {
    const elapsed = (t - this.startAt) / 1000;
    const left = Math.max(0, Math.ceil(this.cfg.timeSec - elapsed));
    if (left !== this.leftSec) {
      this.leftSec = left;
      emit('hha:time', { left: left });

      if (this.cfg.runMode !== 'practice'){
        if (left === 10) this._emitCoach('อีก 10 วิ! เร่งขึ้น! 🔥', 'fever');
        if (left <= 3 && left > 0) addBodyClass('clutch', true);
      }

      if (left === 0) {
        addBodyClass('clutch', false);
        this._end(this.cfg.runMode==='practice' ? 'practice' : 'time');
      }
    }
  };

  Engine.prototype._tickStorm = function (t) {
    const p = this.cfg.preset;
    if (this.cfg.runMode === 'practice') return;

    const pressure = (this.cfg.runMode==='play') ? this.pressure : 0;
    const stormAdvance = (pressure>=2) ? 2500 : (pressure>=1 ? 1200 : 0);

    if (!this.stormOn && t >= (this.nextStormAt - stormAdvance)) {
      this.stormOn = true;
      this.stormUntil = t + p.stormLenSec * 1000;
      addBodyClass('groups-storm', true);
      addBodyClass('fx-storm', true);
      emit('groups:progress', { kind: 'storm_on' });
      this._emitCoach('พายุมาแล้ว! เป้าจะถี่ขึ้น 🌪️', 'fever');
      emit('hha:judge', { kind:'storm', text:'STORM' });
    }

    if (this.stormOn) {
      const leftMs = this.stormUntil - t;
      addBodyClass('groups-storm-urgent', leftMs > 0 && leftMs <= 2500);

      if (t >= this.stormUntil) {
        this.stormOn = false;
        addBodyClass('groups-storm', false);
        addBodyClass('fx-storm', false);
        addBodyClass('groups-storm-urgent', false);

        this._spawnBoss();

        this.nextStormAt = t + p.stormEverySec * 1000;
        emit('groups:progress', { kind: 'storm_off' });
        this._emitCoach('พายุผ่านแล้ว! เก็บแต้มต่อ ✨', 'happy');
      }
    }
  };

  Engine.prototype._tickMini = function (t) {
    if (this.cfg.runMode === 'practice') return;

    if (!this.mini && t >= this.nextMiniAt) {
      const forbidJunk = (this.rng() < 0.55);
      const need = (this.cfg.diff === 'hard') ? 6 : (this.cfg.diff === 'easy' ? 4 : 5);
      const durMs = (this.cfg.diff === 'hard') ? 8500 : 9000;

      this.mini = { on:true, now:0, need, leftMs:durMs, forbidJunk, ok:true, startedAt:t };
      this.miniTotal += 1;

      this._emitQuestUpdate();
      this._emitCoach(
        forbidJunk
          ? `MINI: ให้ถูก ${need} ภายใน ${Math.round(durMs/1000)} วิ และห้ามโดนขยะ!`
          : `MINI: ให้ถูก ${need} ภายใน ${Math.round(durMs/1000)} วิ`,
        'neutral'
      );
    }

    if (this.mini && this.mini.on) {
      const passed = t - this.mini.startedAt;
      const leftMs = Math.max(0, this.mini.leftMs - passed);

      if (leftMs <= 0) {
        const ok = (this.mini.now >= this.mini.need) && this.mini.ok;

        if (ok) {
          this.score += 180;
          this.combo += 1;
          this.comboMax = Math.max(this.comboMax, this.combo);
          emit('hha:judge', { kind: 'good', text: 'MINI CLEAR +180', x: root.innerWidth*0.5, y: root.innerHeight*0.32 });
          this._emitCoach('เยี่ยม! MINI ผ่าน! 🎉', 'happy');
          this.miniCleared += 1;
        } else {
          this.combo = 0;
          this._onMiss('mini_fail', 'mini'); // ✅ miss standard
          emit('hha:judge', { kind: 'miss', text: 'MINI FAIL', x: root.innerWidth*0.5, y: root.innerHeight*0.32 });
          this._emitCoach('เกือบแล้ว! รอบหน้าเอาใหม่ 😤', 'sad');
        }

        this.mini = null;
        this._emitScore();
        this._emitRank();
        this._emitQuestUpdate();

        this.nextMiniAt = t + 22000 + ((this.rng() * 6000) | 0);
      } else {
        this._emitQuestUpdate(leftMs);
      }
    }
  };

  Engine.prototype._tickSpawn = function (t) {
    if (!this.layerEl) return;

    const p = this.cfg.preset;
    const base = p.baseSpawnMs;

    let speed = 1.0;
    if (this.cfg.runMode === 'play') {
      const acc = this._accuracyPct();
      if (acc >= 85) speed *= 0.92;
      if (this.combo >= 8) speed *= 0.90;
      if (this.misses >= 8) speed *= 1.10;
    }
    if (this.stormOn) speed *= 0.78;

    let pressMul = 1.0;
    if (this.cfg.runMode === 'play'){
      if (this.pressure === 1) pressMul = 0.94;
      if (this.pressure === 2) pressMul = 0.90;
      if (this.pressure === 3) pressMul = 0.86;
    }

    let aiMul = 1.0;
    try{
      const A = root.GroupsVR && root.GroupsVR.__ai;
      if (A && A.director && this.cfg.runMode === 'play'){
        aiMul = A.director.spawnSpeedMul(this._accuracyPct(), this.combo, this.misses);
      }
    }catch(_){}

    const every = clamp(base * speed * aiMul * pressMul, 320, 980);

    if (t - this.spawnTmr >= every) {
      this.spawnTmr = t;
      this._spawnOne();
    }
  };

  Engine.prototype._tickExpire = function (t) {
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const tg = this.targets[i];
      if (t >= tg.expireAt) {
        if (tg.kind === 'good') {
          this.nExpireGood++;
          // ✅ expire good = miss (ถ้าเปิด rule goodExpiredCounts)
          this._onMiss('expire_good', tg.id);
        } else if (tg.kind === 'wrong') {
          this.nExpireWrong++;
        } else if (tg.kind === 'junk') {
          this.nExpireJunk++;
        }
        this._removeTarget(i, 'expire');
      }
    }
  };

  // ---------------- Spawn ----------------
  Engine.prototype._spawnOne = function () {
    const p = this.cfg.preset;

    let kind = 'good';
    const r = this.rng();

    let wrongRate = p.wrongRate;
    let junkRate  = p.junkRate;

    if (this.cfg.runMode === 'play'){
      if (this.pressure === 1){ wrongRate += 0.02; junkRate += 0.01; }
      if (this.pressure === 2){ wrongRate += 0.05; junkRate += 0.02; }
      if (this.pressure === 3){ wrongRate += 0.08; junkRate += 0.03; }
    }

    if (this.cfg.runMode === 'play'){
      try{
        const A = root.GroupsVR && root.GroupsVR.__ai;
        if (A && A.pattern){
          const bias = Number(A.pattern.bias && A.pattern.bias()) || 0;
          wrongRate = clamp(wrongRate + bias, 0.05, 0.55);
          junkRate  = clamp(junkRate  - bias, 0.04, 0.40);
        }
      }catch(_){}
    }

    if (this.cfg.runMode === 'play') {
      wrongRate = clamp(wrongRate + Math.min(0.10, this.combo * 0.006), 0.05, 0.58);
      junkRate  = clamp(junkRate  + Math.min(0.08, this.combo * 0.004), 0.04, 0.42);
      if (this.misses >= 8) { wrongRate *= 0.90; junkRate *= 0.88; }
    }

    wrongRate = clamp(wrongRate, 0.05, 0.60);
    junkRate  = clamp(junkRate,  0.04, 0.45);

    if (r < junkRate) kind = 'junk';
    else if (r < junkRate + wrongRate) kind = 'wrong';

    const gActive = GROUPS[this.activeGroupIdx];
    const gOther  = pick(this.rng, GROUPS.filter((_, idx) => idx !== this.activeGroupIdx));

    let emoji = '🍽️';
    let cls = 'fg-target';

    if (kind === 'good') {
      emoji = pick(this.rng, gActive.emoji);
      cls += ' fg-good';
      this.nTargetGoodSpawned++;
    } else if (kind === 'wrong') {
      emoji = pick(this.rng, gOther.emoji);
      cls += ' fg-wrong';
      this.nTargetWrongSpawned++;
    } else {
      emoji = pick(this.rng, JUNK);
      cls += ' fg-junk';
      this.nTargetJunkSpawned++;
    }

    // target size/life
    let size = p.targetSize * (kind === 'junk' ? 0.98 : 1.0);
    if (this.cfg.runMode === 'play'){
      if (this.pressure === 2) size *= 0.96;
      if (this.pressure === 3) size *= 0.93;
    }

    // ✅ เพิ่ม life เล็กน้อยเพื่อกัน “โดนบังแล้ว expire รัว”
    let lifeMs = this.stormOn ? 2550 : 3300;
    if (this.cfg.runMode === 'play'){
      if (this.pressure === 1) lifeMs = Math.round(lifeMs * 0.95);
      if (this.pressure === 2) lifeMs = Math.round(lifeMs * 0.90);
      if (this.pressure === 3) lifeMs = Math.round(lifeMs * 0.84);
    }

    this._spawnDomTarget({ kind, emoji, cls, size, lifeMs });
  };

  Engine.prototype._spawnBoss = function () {
    const p = this.cfg.preset;
    const gActive = GROUPS[this.activeGroupIdx];
    const emoji = pick(this.rng, gActive.emoji);

    let hp = p.bossHp;
    if (this.cfg.runMode==='play'){
      if (this.pressure === 2) hp += 1;
      if (this.pressure === 3) hp += 2;
    }

    this.nTargetBossSpawned++;
    this._spawnDomTarget({
      kind: 'boss',
      emoji,
      cls: 'fg-target fg-boss',
      size: 1.0,
      lifeMs: 7200,
      bossHp: hp,
      bossHpMax: hp
    });

    emit('groups:progress', { kind: 'boss_spawn' });
    emit('hha:judge', { kind:'boss', text:'BOSS' });
    addBodyClass('fx-boss', true);
    this._emitCoach('บอสมา! ยิงให้ถูกหมู่เพื่อแตกบอส 👊', 'fever');
  };

  Engine.prototype._spawnDomTarget = function (spec) {
    const layer = this.layerEl;
    if (!layer) return;

    const view = this.view || getViewFromBodyOrParam();

    // ✅ SafeZones pick point (C)
    this._refreshSafe(false);
    const s = Number(spec.size ?? 1) || 1;
    const baseR = (spec.kind === 'boss') ? 66 : 48;
    const assist = (view === 'cvr') ? 1.10 : 1.0;
    const rHit = Math.round(baseR * s * assist);

    let x = 0, y = 0;
    const pt = pickSafePointSafe(this.safe, this.rng, rHit);
    if (pt){
      x = pt.x; y = pt.y;
    }else{
      // fallback ถ้าไม่มี safezones
      const W = Math.max(320, root.innerWidth  || 360);
      const H = Math.max(420, root.innerHeight || 640);
      x = clamp((this.rng() * (W - 24)) + 12, 8, W - 8);
      y = clamp((this.rng() * (H - 24)) + 12, 8, H - 8);
    }

    const el = DOC.createElement('div');
    el.className = spec.cls + ' spawn';
    el.setAttribute('data-emoji', spec.emoji);

    cssSet(el, '--x', x.toFixed(1) + 'px');
    cssSet(el, '--y', y.toFixed(1) + 'px');
    cssSet(el, '--s', String(spec.size ?? 1));

    const id = (++this._id);
    const born = nowMs();

    const tg = {
      id, el,
      kind: spec.kind,
      emoji: spec.emoji,
      x, y, r: rHit,
      bornAt: born,
      expireAt: born + (spec.lifeMs || 3000),
      bossHp: spec.bossHp || 0,
      bossHpMax: spec.bossHpMax || 0
    };

    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._hitTargetById(id, 'tap');
    }, { passive: false });

    layer.appendChild(el);
    setTimeout(() => { try { el.classList.remove('spawn'); } catch (_) {} }, 160);

    this.targets.push(tg);
  };

  Engine.prototype._removeTarget = function (idx, why) {
    const tg = this.targets[idx];
    if (!tg) return;

    try { tg.el.classList.add(why === 'hit' ? 'hit' : 'out'); } catch (_) {}
    setTimeout(() => { try { tg.el.remove(); } catch (_) {} }, 220);

    this.targets.splice(idx, 1);
  };

  Engine.prototype._hitTargetById = function (id, via) {
    if (!this.running) return;
    const t = nowMs();
    for (let i = 0; i < this.targets.length; i++) {
      if (this.targets[i].id === id) {
        const tg = this.targets[i];
        this._onHit(tg, i, via, t);
        return;
      }
    }
  };

  // ✅ cVR ยิงจาก crosshair: "ยิงพลาด" ไม่ควรนับ miss (เด็กจะกดถี่)
  Engine.prototype._shootCrosshair = function () {
    const cx = (root.innerWidth || 0) * 0.5;
    const cy = (root.innerHeight || 0) * 0.5;

    let bestI = -1;
    let bestD = 1e9;

    for (let i = 0; i < this.targets.length; i++) {
      const tg = this.targets[i];
      const dx = (tg.x - cx);
      const dy = (tg.y - cy);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= tg.r && d < bestD) { bestD = d; bestI = i; }
    }

    if (bestI >= 0) {
      const tg = this.targets[bestI];
      this._onHit(tg, bestI, 'shoot', nowMs());
    } else {
      this.combo = 0;
      emit('hha:judge', { kind: 'miss', text: 'MISS', x: cx, y: cy });
      flashBodyFx('fx-miss', 220);

      // ถ้าอยากเก็บ breakdown ยิงพลาดหลังบ้าน (แต่ไม่เพิ่ม miss) -> count kind shoot_miss
      if (this.missCounter){
        this.missCounter.count({ kind:'shoot_miss', targetId:'', tsMs: nowMs() });
        emit('groups:progress', { kind:'shoot_miss', breakdown:this.missCounter.getBreakdown() });
      }

      this._emitScore();
      this._emitRank();
    }
  };

  // ---------------- Hit logic ----------------
  Engine.prototype._onHit = function (tg, idx, via, t) {
    const p = this.cfg.preset;
    const gActive = GROUPS[this.activeGroupIdx];

    if (tg.kind === 'boss') {
      tg.bossHp = Math.max(0, (tg.bossHp || 1) - 1);
      try { tg.el.classList.add('fg-boss-hurt'); setTimeout(() => tg.el.classList.remove('fg-boss-hurt'), 120); } catch (_) {}

      emit('hha:judge', { kind: 'boss', text: `BOSS -1`, x: tg.x, y: tg.y });
      flashBodyFx('fx-hit', 180);

      if (tg.bossHp <= Math.floor((tg.bossHpMax || 8) * 0.35)) {
        try { tg.el.classList.add('fg-boss-weak'); } catch (_) {}
      }

      if (tg.bossHp <= 0) {
        this.score += 320;
        this.combo += 2;
        this.comboMax = Math.max(this.comboMax, this.combo);
        this.powerCharge = Math.min(p.powerThreshold, this.powerCharge + 2);

        emit('hha:judge', { kind: 'good', text: 'BOSS DOWN +320', x: tg.x, y: tg.y });
        flashBodyFx('fx-perfect', 220);
        emit('groups:progress', { kind: 'boss_down' });
        this._emitCoach('บอสแตกแล้ว! โหดมาก! 💥', 'happy');

        this._removeTarget(idx, 'hit');
        this._emitScore();
        this._emitPower();
        this._emitRank();
        this._advanceQuestOnGood(2);
        this._maybeSwitchGroup();
      }
      return;
    }

    if (tg.kind === 'good') {
      this.nHitGood++;
      this.hitGoodForAcc++;
      this.totalJudgedForAcc++;

      this.combo += 1;
      this.comboMax = Math.max(this.comboMax, this.combo);

      const add = 20 + Math.min(24, this.combo * 1.6);
      this.score += Math.round(add);
      this.powerCharge = Math.min(p.powerThreshold, this.powerCharge + 1);

      emit('hha:judge', { kind: 'good', text: `+${Math.round(add)}`, x: tg.x, y: tg.y });
      flashBodyFx('fx-good', 200);

      if (this.mini && this.mini.on) this.mini.now += 1;

      this._advanceQuestOnGood(1);
      this._maybeSwitchGroup();

      this._removeTarget(idx, 'hit');
      this._emitScore();
      this._emitPower();
      this._emitRank();
      this._emitQuestUpdate();

      if (this.cfg.runMode==='play'){
        if (this.combo === 6) this._emitCoach('คอมโบเริ่มมา! คุมจังหวะไว้ 🔥', 'happy');
      }
      return;
    }

    if (tg.kind === 'wrong') {
      this.nHitWrong++;
      this.totalJudgedForAcc++;

      this.combo = 0;
      this._onMiss('wrong', tg.id);
      this.score = Math.max(0, this.score - 12);

      emit('hha:judge', { kind: 'bad', text: '-12', x: tg.x, y: tg.y });
      flashBodyFx('fx-bad', 220);

      this._removeTarget(idx, 'hit');
      this._emitScore();
      this._emitRank();
      this._emitQuestUpdate();
      this._emitCoach(`ไม่ใช่หมู่ “${gActive.th}” นะ!`, 'sad');
      return;
    }

    // junk
    this.nHitJunk++;
    this.totalJudgedForAcc++;

    if (this.mini && this.mini.on && this.mini.forbidJunk) this.mini.ok = false;

    this.combo = 0;
    this._onMiss('junk', tg.id);
    this.score = Math.max(0, this.score - 18);

    emit('hha:judge', { kind: 'bad', text: '-18', x: tg.x, y: tg.y });
    flashBodyFx('fx-bad', 240);

    this._removeTarget(idx, 'hit');
    this._emitScore();
    this._emitRank();
    this._emitQuestUpdate();
    this._emitCoach('โดนขยะ! ระวัง! 🗑️', 'sad');
  };

  Engine.prototype._maybeSwitchGroup = function () {
    const p = this.cfg.preset;
    if (this.powerCharge < p.powerThreshold) return;

    const prev = this.activeGroupIdx;
    let next = prev;
    for (let k = 0; k < 6; k++) {
      next = (this.rng() * GROUPS.length) | 0;
      if (next !== prev) break;
    }
    this.activeGroupIdx = next;
    this.powerCharge = 0;

    emit('groups:progress', { kind: 'perfect_switch' });
    emit('hha:judge', { kind:'perfect', text:'SWITCH', x: root.innerWidth*0.5, y: root.innerHeight*0.62 });
    flashBodyFx('fx-perfect', 240);
    this._emitPower();
    this._emitQuestUpdate();
    this._emitCoach(`สลับหมู่แล้ว! เป้าถัดไปคือ “${GROUPS[next].th}”`, 'neutral');
  };

  Engine.prototype._advanceQuestOnGood = function (inc) {
    if (this.cfg.runMode === 'practice') return;

    inc = Number(inc) || 1;
    this.goalNow += inc;

    if (this.goalNow >= this.goalNeed) {
      this.goalIndex += 1;
      this.goalNow = 0;

      this.score += 240;
      this.combo += 1;
      this.comboMax = Math.max(this.comboMax, this.combo);

      emit('hha:judge', { kind: 'good', text: 'GOAL CLEAR +240', x: root.innerWidth*0.5, y: root.innerHeight*0.28 });
      flashBodyFx('fx-perfect', 260);
      this._emitScore();
      this._emitRank();
      this._emitCoach('GOAL ผ่าน! เก่งมาก! ✅', 'happy');

      if (this.goalIndex >= this.goalsTotal) {
        this._end('all-goals');
      } else {
        if (this.cfg.runMode === 'play') {
          this.goalNeed = Math.round(this.goalNeed * 1.08);
          this.cfg.preset.baseSpawnMs = clamp(this.cfg.preset.baseSpawnMs * 0.97, 420, 920);
        }
        this._emitQuestUpdate();
      }
    } else {
      this._emitQuestUpdate();
    }
  };

  Engine.prototype._emitQuestUpdate = function (miniLeftMs) {
    const g = GROUPS[this.activeGroupIdx];
    const goalTitle = (this.cfg.runMode==='practice') ? 'โหมดฝึก: ยิงให้โดนเป้า' : `ยิงให้ถูกหมู่ “${g.th}”`;
    const goalNow = (this.cfg.runMode==='practice') ? 0 : (this.goalNow | 0);
    const goalTotal = (this.cfg.runMode==='practice') ? 1 : (this.goalNeed | 0);

    let miniTitle = '—';
    let miniNow = 0, miniTotal = 1, miniPct = 0;
    let miniTimeLeftSec = 0;

    if (this.mini && this.mini.on) {
      miniTitle = this.mini.forbidJunk
        ? `MINI: ถูก ${this.mini.need} และห้ามโดนขยะ`
        : `MINI: ถูก ${this.mini.need} ภายในเวลา`;
      miniNow = this.mini.now | 0;
      miniTotal = this.mini.need | 0;
      miniPct = clamp((miniNow / Math.max(1, miniTotal)) * 100, 0, 100);

      const t = nowMs();
      const left = (miniLeftMs != null)
        ? Number(miniLeftMs)
        : Math.max(0, (this.mini.leftMs - (t - this.mini.startedAt)));
      miniTimeLeftSec = Math.ceil(left / 1000);
    }

    emit('quest:update', {
      goalTitle,
      goalNow,
      goalTotal,
      goalPct: clamp((goalNow / Math.max(1, goalTotal)) * 100, 0, 100),

      miniTitle,
      miniNow,
      miniTotal,
      miniPct,
      miniTimeLeftSec,

      groupKey: g.key,
      groupName: g.th,
      goalIndex: this.goalIndex,
      goalsTotal: this.goalsTotal,

      miniCountTotal: this.miniTotal,
      miniCountCleared: this.miniCleared
    });
  };

  // ---------------- End ----------------
  Engine.prototype._end = function (reason) {
    if (!this.running) return;
    this.running = false;

    for (let i = 0; i < this.targets.length; i++) {
      try { this.targets[i].el.remove(); } catch (_) {}
    }
    this.targets = [];

    const acc = this._accuracyPct();
    const grade = gradeFrom(acc, this.misses, this.score);

    const endAt = nowMs();
    const playedSec = Math.max(0, Math.round((endAt - this.startAt) / 1000));

    const breakdown = this.missCounter ? this.missCounter.getBreakdown() : null;

    const summary = {
      reason: String(reason || 'end'),
      scoreFinal: this.score | 0,
      comboMax: this.comboMax | 0,
      misses: this.misses | 0,
      accuracyGoodPct: acc,
      grade,

      goalsCleared: Math.min(this.goalsTotal, this.goalIndex + (this.goalNow >= this.goalNeed ? 1 : 0)),
      goalsTotal: this.goalsTotal,

      miniCleared: this.miniCleared | 0,
      miniTotal: this.miniTotal | 0,

      durationPlayedSec: playedSec,
      durationPlannedSec: this.cfg.timeSec | 0,

      nTargetGoodSpawned: this.nTargetGoodSpawned | 0,
      nTargetJunkSpawned: this.nTargetJunkSpawned | 0,
      nTargetWrongSpawned: this.nTargetWrongSpawned | 0,
      nTargetBossSpawned: this.nTargetBossSpawned | 0,

      nHitGood: this.nHitGood | 0,
      nHitJunk: this.nHitJunk | 0,
      nHitWrong: this.nHitWrong | 0,

      nExpireGood: this.nExpireGood | 0,
      nExpireJunk: this.nExpireJunk | 0,
      nExpireWrong: this.nExpireWrong | 0,

      runMode: this.cfg.runMode,
      diff: this.cfg.diff,
      seed: this.cfg.seed,

      pressureLevel: this.pressure|0,

      // ✅ เพิ่ม breakdown เพื่อ “หลังบ้าน”
      missBreakdown: breakdown || undefined
    };

    emit('hha:end', summary);
    addBodyClass('fx-end', true);
    setTimeout(()=>addBodyClass('fx-end', false), 650);
    this._emitCoach((this.cfg.runMode==='practice') ? 'จบฝึกแล้ว! กำลังเข้าเกมจริง…' : 'จบเกมแล้ว! กดเล่นอีกครั้งได้เลย 🏁', 'happy');
  };

  // ---------------- Export ----------------
  NS.GameEngine = new Engine();

})(typeof window !== 'undefined' ? window : globalThis);