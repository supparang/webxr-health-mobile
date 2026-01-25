/* === /herohealth/vr-groups/groups.safe.js ===
Food Groups VR — SAFE (PRODUCTION-ish)
✅ ... (เหมือนเดิม)
✅ PATCH Y: cVR crosshair magnet (GOOD only, play mode only, fair)
*/

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};

  // ---------------- Utils ----------------
  function clamp(v, a, b) { v = Number(v); if (!isFinite(v)) v = a; return v < a ? a : (v > b ? b : v); }
  function nowMs() { return (root.performance && performance.now) ? performance.now() : Date.now(); }

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function hashSeed(str) {
    str = String(str ?? '');
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function makeRng(seedU32) {
    let s = (seedU32 >>> 0) || 1;
    return function rand() {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
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

  // ---------------- Content (Thai fixed mapping 5 groups) ----------------
  const GROUPS = [
    { key: 'g1', th: 'โปรตีน', emoji: ['🍗','🥚','🐟','🫘','🥜','🍤','🍖','🥛','🧀'] },
    { key: 'g2', th: 'คาร์โบไฮเดรต', emoji: ['🍚','🍞','🥖','🍜','🍝','🥟','🥞','🍙','🍠','🥔'] },
    { key: 'g3', th: 'ผัก', emoji: ['🥦','🥕','🥬','🍅','🥒','🌽','🧅','🍆'] },
    { key: 'g4', th: 'ผลไม้', emoji: ['🍎','🍌','🍊','🍇','🍉','🍍','🥭','🍐'] },
    { key: 'g5', th: 'ไขมัน', emoji: ['🥑','🫒','🥥','🧈','🥜','🌰'] },
  ];

  const JUNK = ['🍟','🍔','🌭','🍕','🍩','🍭','🍬','🥤','🧋','🍫','🧁','🍰'];
  const SHOW_JUNK_EMOJI = (String(qs('junkEmoji','0')||'0') === '1');

  // ---------------- Difficulty presets ----------------
  function diffPreset(diff) {
    diff = String(diff || 'normal').toLowerCase();
    if (diff === 'easy') {
      return { time: 90, baseSpawnMs: 780, stormEverySec: 26, stormLenSec: 7, targetSize: 1.02, wrongRate: 0.22, junkRate: 0.12, bossHp: 6, powerThreshold: 7, goalTargets: 16, goalsTotal: 2 };
    }
    if (diff === 'hard') {
      return { time: 90, baseSpawnMs: 560, stormEverySec: 22, stormLenSec: 8, targetSize: 0.92, wrongRate: 0.32, junkRate: 0.18, bossHp: 10, powerThreshold: 9, goalTargets: 22, goalsTotal: 2 };
    }
    return { time: 90, baseSpawnMs: 650, stormEverySec: 24, stormLenSec: 7, targetSize: 0.98, wrongRate: 0.27, junkRate: 0.15, bossHp: 8, powerThreshold: 8, goalTargets: 19, goalsTotal: 2 };
  }

  function gradeFrom(accPct, misses, score) {
    accPct = Number(accPct) || 0;
    misses = Number(misses) || 0;
    score  = Number(score)  || 0;

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

  // ---------------- Spawn bounds ----------------
  function computePlayRect(view) {
    const W = Math.max(320, root.innerWidth  || 360);
    const H = Math.max(420, root.innerHeight || 640);

    const padTopBase = 150;
    const padBotBase = 130;
    const padLeftBase= 210;
    const padRight   = 24;

    const padTop  = clamp(padTopBase, 110, Math.round(H * 0.28));
    const padBot  = clamp(padBotBase, 96,  Math.round(H * 0.26));
    const padLeft = clamp(padLeftBase, 120, Math.round(W * 0.52));

    const extraCenter = (view === 'cvr') ? 22 : 0;

    let xMin = 12 + extraCenter;
    let xMax = W - padRight - extraCenter;
    let yMin = 12 + Math.round(H * 0.02);
    let yMax = H - 12;

    xMin = Math.max(xMin, padLeft);
    yMin = Math.max(yMin, padTop);
    yMax = Math.min(yMax, H - padBot);

    const minW = Math.max(120, Math.round(W * 0.34));
    const minH = Math.max(140, Math.round(H * 0.34));

    if ((xMax - xMin) < minW) {
      const relax = Math.round((minW - (xMax - xMin)) * 0.55);
      xMin = Math.max(10, xMin - relax);
      xMax = Math.min(W - 10, xMax + relax);
    }
    if ((yMax - yMin) < minH) {
      const relax = Math.round((minH - (yMax - yMin)) * 0.55);
      yMin = Math.max(10, yMin - relax);
      yMax = Math.min(H - 10, yMax + relax);
    }

    xMin = clamp(xMin, 8, W - 60);
    xMax = clamp(xMax, 60, W - 8);
    yMin = clamp(yMin, 8, H - 80);
    yMax = clamp(yMax, 80, H - 8);

    if (xMax <= xMin + 8) { xMin = 12; xMax = W - 12; }
    if (yMax <= yMin + 8) { yMin = 12; yMax = H - 12; }

    return { W, H, xMin, xMax, yMin, yMax };
  }

  // ---------------- Engine ----------------
  function Engine() {
    this.layerEl = null;
    this.running = false;

    this.cfg = null;
    this.view = 'mobile';
    this.rng = null;

    this.startAt = 0;
    this.leftSec = 0;

    this.score = 0;
    this.combo = 0;
    this.comboMax = 0;
    this.misses = 0;

    this.pressure = 0;
    this._lastPressureTip = 0;

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

    this.activeGroupIdx = 0;
    this.powerCharge = 0;

    this.stormOn = false;
    this.stormUntil = 0;
    this.nextStormAt = 0;

    this.spawnTmr = 0;

    this.goalsTotal = 2;
    this.goalIndex = 0;
    this.goalNow = 0;
    this.goalNeed = 18;

    this.mini = null;
    this.nextMiniAt = 0;
    this.miniTotal = 0;
    this.miniCleared = 0;

    this.targets = [];
    this._id = 0;

    this.coachLastAt = 0;
  }

  Engine.prototype.setLayerEl = function (el) { this.layerEl = el; };

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
      if (p===1) flashBodyFx('fx-miss', 220);
      if (p===2) flashBodyFx('fx-bad', 240);
      if (p===3) flashBodyFx('fx-bad', 280);
    }

    emit('groups:progress', { kind:'pressure', level:p, misses:this.misses|0 });

    const t = nowMs();
    if (t - this._lastPressureTip > 2500 && this.cfg && this.cfg.runMode==='play'){
      this._lastPressureTip = t;
      if (p===1) this._emitCoach('เริ่มพลาดบ่อยแล้วนะ ตั้งสติ + เล็งก่อนยิง 👀', 'neutral');
      if (p===2) this._emitCoach('โหมดกดดัน! ช้าลงนิด เล็งให้ตรงหมู่ก่อน 🔥', 'fever');
      if (p===3) this._emitCoach('อันตราย! ห้ามยิงมั่ว เดี๋ยวคะแนนร่วง 😤', 'sad');
    }
  };

  Engine.prototype.start = function (diff, opts) {
    opts = opts || {};
    const rm = String(opts.runMode || 'play').toLowerCase();
    const runMode = (rm === 'research') ? 'research' : (rm === 'practice' ? 'practice' : 'play');
    const seedIn  = (opts.seed != null) ? String(opts.seed) : String(Date.now());
    const preset  = diffPreset(diff);

    const timeSec = clamp(opts.time ?? preset.time, 5, 180);

    this.cfg = { diff: String(diff || 'normal').toLowerCase(), runMode, seed: seedIn, timeSec, preset };

    this.view = getViewFromBodyOrParam(opts.view);
    this.rng = makeRng(hashSeed(seedIn + '::groups'));

    this.leftSec = Math.round(timeSec);

    this.score = 0;
    this.combo = 0;
    this.comboMax = 0;
    this.misses = 0;

    this.pressure = 0;
    this._lastPressureTip = 0;
    addBodyClass('press-1', false);
    addBodyClass('press-2', false);
    addBodyClass('press-3', false);

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
    this.spawnTmr = 0;

    emit('hha:time', { left: this.leftSec });
    emit('hha:score', { score: this.score, combo: this.combo, misses: this.misses });
    this._emitRank();
    this._emitCoach((runMode==='practice') ? 'โหมดฝึก 15 วิ ลองเล็งแล้วแตะยิง 🎯' : 'เริ่มเลย! เล็งให้ตรงหมู่ แล้วค่อยยิง 🎯', 'happy');
    this._emitPower();
    this._emitQuestUpdate();

    this._installInput();
    this._loop();
  };

  Engine.prototype._installInput = function () {
    const self = this;
    if (!this._onShoot) {
      // ✅ PATCH Y: รับ detail.lockPx จาก vr-ui.js
      this._onShoot = function (e) {
        if (!self.running) return;
        const d = (e && e.detail) ? e.detail : null;
        self._shootCrosshair(d);
      };
      root.addEventListener('hha:shoot', this._onShoot, { passive: true });
    }
  };

  Engine.prototype._loop = function () {
    const self = this;
    function frame() {
      if (!self.running) return;
      const t = nowMs();
      self._tickTime(t);
      self._tickStorm(t);
      self._tickMini(t);
      self._tickSpawn(t);
      self._tickExpire(t);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  /* ----- (tickTime/tickStorm/tickMini/tickSpawn/tickExpire/spawnOne/spawnBoss/spawnDomTarget/remove/hitById เหมือนเดิม) ----- */
  /* เพื่อให้ข้อความไม่ยาวเกินไป: “ส่วนที่ไม่ได้แก้” ให้ใช้จากไฟล์เดิมของคุณ 그대로 */
  /* ✅ แก้จริงอยู่ที่ _shootCrosshair เท่านั้น */

  Engine.prototype._shootCrosshair = function (detail) {
    const cx = (root.innerWidth || 0) * 0.5;
    const cy = (root.innerHeight || 0) * 0.5;

    const view = this.view || getViewFromBodyOrParam();
    const runMode = (this.cfg && this.cfg.runMode) ? this.cfg.runMode : 'play';

    const lockPxIn = (detail && detail.lockPx != null) ? Number(detail.lockPx) : NaN;
    const lockPx = (isFinite(lockPxIn) && lockPxIn > 0) ? lockPxIn : 0;

    // ===== PATCH Y: cVR magnet (GOOD only, play only, fair) =====
    // หลักการ: ถ้าเป็น cVR + play และมี lockPx
    // -> หา "good" ที่อยู่ใกล้ crosshair ภายใน lockPx (และไม่ไกลเกิน r ของเป้าแบบเว่อร์)
    // -> ถ้าเจอ ยิงตัวนั้นทันที (ให้ความรู้สึก assist แต่ไม่โกง)
    if (view === 'cvr' && runMode === 'play' && lockPx > 0) {
      let bestGoodI = -1;
      let bestGoodD = 1e9;

      for (let i = 0; i < this.targets.length; i++) {
        const tg = this.targets[i];
        if (!tg || tg.kind !== 'good') continue;

        const dx = tg.x - cx;
        const dy = tg.y - cy;
        const d = Math.sqrt(dx*dx + dy*dy);

        // fairness clamp: ไม่ดูดจากไกลเกิน "lockPx" และไม่เกิน r*1.15
        const allow = Math.min(lockPx, (tg.r || 0) * 1.15);
        if (d <= allow && d < bestGoodD) { bestGoodD = d; bestGoodI = i; }
      }

      if (bestGoodI >= 0) {
        const tg = this.targets[bestGoodI];
        this._onHit(tg, bestGoodI, 'shoot', nowMs());
        return;
      }
      // ถ้าไม่เจอ good ใกล้ ๆ -> ไปใช้กติกาเดิม (ต้องเข้า radius ถึงจะโดน)
    }

    // ===== เดิม: ต้องอยู่ใน radius ของเป้า (ยิงมั่วไม่โดน) =====
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
      // ยิงพลาดจาก crosshair: ไม่เพิ่ม miss (กัน miss พุ่ง) แต่ reset combo + FX
      this.combo = 0;
      emit('hha:judge', { kind: 'miss', text: 'MISS', x: cx, y: cy });
      flashBodyFx('fx-miss', 220);
      this._emitScore();
      this._emitRank();
    }
  };

  /* ----- (onHit/onMiss/maybeSwitch/advanceQuest/emitScore/emitRank/emitPower/emitQuest/emitCoach/end เหมือนเดิม) ----- */

  NS.GameEngine = new Engine();

})(typeof window !== 'undefined' ? window : globalThis);