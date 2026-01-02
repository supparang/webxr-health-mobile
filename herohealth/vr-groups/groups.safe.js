/* === /herohealth/vr-groups/groups.safe.js ===
Food Groups VR — SAFE (PRODUCTION-ish) + PACK 4–6
✅ Spawn bounds from playLayer rect (not whole window)  [PACK-4]
✅ Safe-zone from actual DOM rects (HUD/Quest/Power/Coach + VRUI) [PACK-6]
✅ cVR strict: targets pointer-less + shoot only (no click bind)  [PACK-5]
✅ Handles resize/orientation changes; keeps target geometry synced
✅ Mini stats + summary fields complete
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

  function pick(rng, arr) {
    return arr[(rng() * arr.length) | 0];
  }

  function emit(name, detail) {
    try { root.dispatchEvent(new CustomEvent(name, { detail })); } catch (_) {}
  }

  function cssSet(el, k, v) {
    try { el.style.setProperty(k, v); } catch (_) {}
  }

  function addBodyClass(c, on) {
    DOC.body.classList.toggle(c, !!on);
  }

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function rectOf(sel){
    const el = DOC.querySelector(sel);
    if (!el) return null;
    try { return el.getBoundingClientRect(); } catch { return null; }
  }

  function rectPad(r, pad){
    if (!r) return null;
    const p = pad||0;
    return { left:r.left-p, top:r.top-p, right:r.right+p, bottom:r.bottom+p };
  }

  function rectContains(r, x, y){
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function rectIntersect(a,b){
    if (!a || !b) return false;
    return !(b.left>a.right || b.right<a.left || b.top>a.bottom || b.bottom<a.top);
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

  function gradeFrom(accPct, misses, score) {
    accPct = Number(accPct) || 0;
    misses = Number(misses) || 0;
    score  = Number(score)  || 0;

    const mPenalty = Math.min(18, misses * 2.2);
    const sBoost   = Math.min(8, Math.log10(Math.max(10, score)) * 2.2);
    const v = accPct - mPenalty + sBoost;

    if (v >= 92) return 'SSS';
    if (v >= 86) return 'SS';
    if (v >= 80) return 'S';
    if (v >= 72) return 'A';
    if (v >= 62) return 'B';
    return 'C';
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
    this.misses = 0;

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

    // mini stats + miss breakdown
    this.miniCleared = 0;
    this.miniTotal = 0;
    this.miniFail = 0;

    this.missExpireGood = 0;
    this.missHitJunk = 0;

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

    // targets
    this.targets = [];
    this._id = 0;

    // coach
    this.coachLastAt = 0;

    // [PACK-4/6] cached play rect + avoid rects
    this.playRect = null;      // {left,top,right,bottom,w,h}
    this.avoidRects = [];      // array of rects (padded)
    this._rectTick = 0;        // throttled recompute
  }

  Engine.prototype.setLayerEl = function (el) {
    this.layerEl = el;
  };

  Engine.prototype.start = function (diff, opts) {
    opts = opts || {};
    const runMode = (String(opts.runMode || 'play').toLowerCase() === 'research') ? 'research' : 'play';
    const seedIn  = (opts.seed != null) ? String(opts.seed) : String(Date.now());
    const preset  = diffPreset(diff);

    const timeSec = clamp(opts.time ?? preset.time, 30, 180);

    this.cfg = {
      diff: String(diff || 'normal').toLowerCase(),
      runMode,
      seed: seedIn,
      timeSec,
      preset,
    };

    // view-cvr strict if body has class OR view param says cvr
    const bodyHasCVR = DOC.body && DOC.body.classList.contains('view-cvr');
    const vParam = String(opts.view || qs('view','') || '').toLowerCase();
    this.view = (bodyHasCVR || vParam === 'cvr') ? 'cvr' : (vParam || 'mobile');

    this.rng = makeRng(hashSeed(seedIn + '::groups'));

    this.leftSec = Math.round(timeSec);

    this.score = 0;
    this.combo = 0;
    this.comboMax = 0;
    this.misses = 0;

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

    this.miniCleared = 0;
    this.miniTotal = 0;
    this.miniFail = 0;
    this.missExpireGood = 0;
    this.missHitJunk = 0;

    this.targets = [];
    this._id = 0;

    this.activeGroupIdx = (this.rng() * GROUPS.length) | 0;
    this.powerCharge = 0;

    this.goalIndex = 0;
    this.goalsTotal = preset.goalsTotal;
    this.goalNeed = preset.goalTargets;
    this.goalNow = 0;

    this.mini = null;
    this.nextMiniAt = nowMs() + 14000;

    this.stormOn = false;
    this.stormUntil = 0;
    this.nextStormAt = nowMs() + preset.stormEverySec * 1000;

    this.running = true;
    this.startAt = nowMs();
    this.lastTick = this.startAt;

    // [PACK-4/6] compute rects immediately
    this._recomputeRects(true);

    emit('hha:time', { left: this.leftSec });
    emit('hha:score', { score: this.score, combo: this.combo, misses: this.misses });
    this._emitRank();
    this._emitCoach('เริ่มเลย! เล็งให้ตรงหมู่ แล้วค่อยยิง 🎯', 'happy');
    this._emitPower();
    this._emitQuestUpdate();

    this._installInput();
    this._loop();
  };

  Engine.prototype._installInput = function () {
    const self = this;

    if (!this._onShoot) {
      this._onShoot = function () {
        if (!self.running) return;
        self._shootCrosshair();
      };
      root.addEventListener('hha:shoot', this._onShoot, { passive: true });
    }

    // [PACK-4] recompute rects on resize/orientation (throttled)
    if (!this._onResize) {
      this._onResize = function(){
        if (!self.running) return;
        self._recomputeRects(true);
      };
      root.addEventListener('resize', this._onResize, { passive:true });
      root.addEventListener('orientationchange', this._onResize, { passive:true });
      // some browsers keep scroll offset changes in fullscreen/vr
      root.addEventListener('scroll', this._onResize, { passive:true });
    }
  };

  Engine.prototype._loop = function () {
    const self = this;
    function frame() {
      if (!self.running) return;

      const t = nowMs();
      self.lastTick = t;

      // [PACK-6] keep rects fresh every ~700ms (HUD can animate/VRUI appear)
      if (t - self._rectTick > 700) self._recomputeRects(false);

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

      if (left === 10) this._emitCoach('อีก 10 วิ! เร่งขึ้น! 🔥', 'fever');
      if (left <= 3 && left > 0) addBodyClass('clutch', true);
      if (left === 0) {
        addBodyClass('clutch', false);
        this._end('time');
      }
    }
  };

  Engine.prototype._tickStorm = function (t) {
    const p = this.cfg.preset;

    if (!this.stormOn && t >= this.nextStormAt) {
      this.stormOn = true;
      this.stormUntil = t + p.stormLenSec * 1000;
      addBodyClass('groups-storm', true);
      emit('groups:progress', { kind: 'storm_on' });
      this._emitCoach('พายุมาแล้ว! เป้าจะถี่ขึ้น 🌪️', 'fever');
    }

    if (this.stormOn) {
      const leftMs = this.stormUntil - t;
      addBodyClass('groups-storm-urgent', leftMs > 0 && leftMs <= 2500);

      if (t >= this.stormUntil) {
        this.stormOn = false;
        addBodyClass('groups-storm', false);
        addBodyClass('groups-storm-urgent', false);

        this._spawnBoss();

        this.nextStormAt = t + p.stormEverySec * 1000;
        emit('groups:progress', { kind: 'storm_off' });
        this._emitCoach('พายุผ่านแล้ว! เก็บแต้มต่อ ✨', 'happy');
      }
    }
  };

  Engine.prototype._tickMini = function (t) {
    if (!this.mini && t >= this.nextMiniAt) {
      this.miniTotal += 1;

      const forbidJunk = (this.rng() < 0.55);
      const need = (this.cfg.diff === 'hard') ? 6 : (this.cfg.diff === 'easy' ? 4 : 5);
      const durMs = (this.cfg.diff === 'hard') ? 8500 : 9000;

      this.mini = {
        on: true,
        now: 0,
        need,
        leftMs: durMs,
        forbidJunk,
        ok: true,
        startedAt: t
      };
      this._emitQuestUpdate();
      this._emitCoach(forbidJunk ? `MINI: ให้ถูก ${need} ภายใน ${Math.round(durMs/1000)} วิ และห้ามโดนขยะ!` :
                                   `MINI: ให้ถูก ${need} ภายใน ${Math.round(durMs/1000)} วิ`, 'neutral');
    }

    if (this.mini && this.mini.on) {
      const passed = t - this.mini.startedAt;
      const leftMs = Math.max(0, this.mini.leftMs - passed);

      if (leftMs <= 0) {
        const ok = (this.mini.now >= this.mini.need) && this.mini.ok;
        if (ok) {
          this.miniCleared += 1;
          this.score += 180;
          this.combo += 1;
          this.comboMax = Math.max(this.comboMax, this.combo);
          emit('hha:judge', { kind: 'good', text: 'MINI CLEAR +180' });
          this._emitCoach('เยี่ยม! MINI ผ่าน! 🎉', 'happy');
        } else {
          this.miniFail += 1;
          this.combo = 0;
          this.misses += 1;
          emit('hha:judge', { kind: 'miss', text: 'MINI FAIL' });
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
      if (this.misses >= 8) speed *= 1.12;
    }
    if (this.stormOn) speed *= 0.78;

    const every = clamp(base * speed, 360, 980);

    if (t - this.spawnTmr >= every) {
      this.spawnTmr = t;
      this._spawnOne();
    }
  };

  Engine.prototype._tickExpire = function (t) {
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const tg = this.targets[i];
      if (t >= tg.expireAt) {
        if (tg.kind === 'good') { this.nExpireGood++; this.missExpireGood++; this._onMiss('expire_good'); }
        else if (tg.kind === 'wrong') { this.nExpireWrong++; }
        else if (tg.kind === 'junk') { this.nExpireJunk++; }
        this._removeTarget(i, 'expire');
      }
    }
  };

  Engine.prototype._spawnOne = function () {
    const p = this.cfg.preset;

    let kind = 'good';
    const r = this.rng();

    let wrongRate = p.wrongRate;
    let junkRate  = p.junkRate;

    if (this.cfg.runMode === 'play') {
      wrongRate = clamp(wrongRate + Math.min(0.10, this.combo * 0.006), 0.05, 0.55);
      junkRate  = clamp(junkRate  + Math.min(0.08, this.combo * 0.004), 0.04, 0.40);
      if (this.misses >= 8) { wrongRate *= 0.88; junkRate *= 0.85; }
    }

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

    const size = p.targetSize * (kind === 'junk' ? 0.98 : 1.0);
    const lifeMs = this.stormOn ? 2400 : 3100;

    this._spawnDomTarget({ kind, emoji, cls, size, lifeMs });
  };

  Engine.prototype._spawnBoss = function () {
    const p = this.cfg.preset;
    const gActive = GROUPS[this.activeGroupIdx];

    const emoji = pick(this.rng, gActive.emoji);
    const hp = p.bossHp;

    this.nTargetBossSpawned++;
    this._spawnDomTarget({
      kind: 'boss',
      emoji,
      cls: 'fg-target fg-boss',
      size: 1.0,
      lifeMs: 7000,
      bossHp: hp,
      bossHpMax: hp
    });

    emit('groups:progress', { kind: 'boss_spawn' });
    this._emitCoach('บอสมา! ยิงให้ถูกหมู่เพื่อแตกบอส 👊', 'fever');
  };

  // -------- [PACK-4/6] Rect computation --------
  Engine.prototype._recomputeRects = function (force) {
    const t = nowMs();
    if (!force && (t - this._rectTick < 650)) return;
    this._rectTick = t;

    // play rect from layer element
    let pr = null;
    try { pr = this.layerEl && this.layerEl.getBoundingClientRect ? this.layerEl.getBoundingClientRect() : null; } catch {}
    if (!pr) {
      pr = { left:0, top:0, right:(root.innerWidth||360), bottom:(root.innerHeight||640) };
    }

    // clamp minimal size
    const w = Math.max(1, pr.right - pr.left);
    const h = Math.max(1, pr.bottom - pr.top);
    this.playRect = { left:pr.left, top:pr.top, right:pr.right, bottom:pr.bottom, w, h };

    // avoid rects from actual DOM
    const pad = 10;
    const rects = [];
    // major UI blocks
    const hud  = rectPad(rectOf('.hud'), pad);
    const qt   = rectPad(rectOf('.questTop'), pad);
    const pw   = rectPad(rectOf('.powerWrap'), pad);
    const cc   = rectPad(rectOf('.coachWrap'), pad);
    // vr-ui overlay/buttons if present
    const vrui = rectPad(rectOf('.hha-vrui'), pad);

    [hud, qt, pw, cc, vrui].forEach(r=>{
      if (!r) return;
      // ignore if outside playRect
      if (!rectIntersect(r, this.playRect)) return;
      rects.push(r);
    });

    this.avoidRects = rects;

    // sync existing target stored x,y (viewport-based) stays OK,
    // but if playRect moved (safe-area change) we keep as-is.
    // (We deliberately do not reposition existing targets to avoid "teleport".)
  };

  // [PACK-4/6] sample a point inside playRect avoiding avoidRects
  Engine.prototype._sampleSpawnPoint = function () {
    const pr = this.playRect || { left:0, top:0, right:(root.innerWidth||360), bottom:(root.innerHeight||640), w:(root.innerWidth||360), h:(root.innerHeight||640) };

    // margins inside playRect
    const margin = 16;
    let xMin = pr.left + margin;
    let xMax = pr.right - margin;
    let yMin = pr.top + margin;
    let yMax = pr.bottom - margin;

    // if very tight, relax
    if (xMax - xMin < 80) { xMin = pr.left + 6; xMax = pr.right - 6; }
    if (yMax - yMin < 120) { yMin = pr.top + 6; yMax = pr.bottom - 6; }

    const avoid = this.avoidRects || [];

    // try multiple times, else fallback to center-ish
    for (let tries = 0; tries < 24; tries++) {
      const x = (this.rng() * (xMax - xMin)) + xMin;
      const y = (this.rng() * (yMax - yMin)) + yMin;

      // keep away from crosshair center a bit (prevents constant "free hits")
      const cx = (root.innerWidth||0) * 0.5;
      const cy = (root.innerHeight||0) * 0.5;
      const d = Math.hypot(x - cx, y - cy);
      if (d < 58) continue;

      let bad = false;
      for (let i = 0; i < avoid.length; i++) {
        if (rectContains(avoid[i], x, y)) { bad = true; break; }
      }
      if (!bad) return { x, y };
    }

    return { x: (xMin+xMax)/2, y: (yMin+yMax)/2 };
  };

  // -------- DOM spawn --------
  Engine.prototype._spawnDomTarget = function (spec) {
    const layer = this.layerEl;
    if (!layer) return;

    // ensure rect cache fresh when spawning (cheap)
    this._recomputeRects(false);

    const pt = this._sampleSpawnPoint();
    const x = pt.x, y = pt.y;

    const el = DOC.createElement('div');
    el.className = spec.cls + ' spawn';
    el.setAttribute('data-emoji', spec.emoji);

    cssSet(el, '--x', x.toFixed(1) + 'px');
    cssSet(el, '--y', y.toFixed(1) + 'px');
    cssSet(el, '--s', String(spec.size ?? 1));

    const id = (++this._id);
    const born = nowMs();
    const tg = {
      id,
      el,
      kind: spec.kind,
      emoji: spec.emoji,
      x, y,
      r: (spec.kind === 'boss') ? 60 : 46,
      bornAt: born,
      expireAt: born + (spec.lifeMs || 3000),
      bossHp: spec.bossHp || 0,
      bossHpMax: spec.bossHpMax || 0
    };

    // [PACK-5] cVR strict: no click bind (shoot only)
    if (this.view !== 'cvr') {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._hitTargetById(id, 'tap');
      }, { passive: false });
    }

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
      emit('hha:judge', { kind: 'miss', text: 'MISS' });
      this._emitScore();
      this._emitRank();
    }
  };

  // -------- Hit logic --------
  Engine.prototype._onHit = function (tg, idx, via, t) {
    const p = this.cfg.preset;
    const gActive = GROUPS[this.activeGroupIdx];

    if (tg.kind === 'boss') {
      tg.bossHp = Math.max(0, (tg.bossHp || 1) - 1);
      try { tg.el.classList.add('fg-boss-hurt'); setTimeout(() => tg.el.classList.remove('fg-boss-hurt'), 120); } catch (_) {}
      emit('hha:judge', { kind: 'boss', text: `BOSS -${1}` });

      if (tg.bossHp <= Math.floor((tg.bossHpMax || 8) * 0.35)) {
        try { tg.el.classList.add('fg-boss-weak'); } catch (_) {}
      }

      if (tg.bossHp <= 0) {
        this.score += 320;
        this.combo += 2;
        this.comboMax = Math.max(this.comboMax, this.combo);
        this.powerCharge = Math.min(p.powerThreshold, this.powerCharge + 2);

        emit('hha:judge', { kind: 'good', text: 'BOSS DOWN +320' });
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

      emit('hha:judge', { kind: 'good', text: `+${Math.round(add)}` });

      if (this.mini && this.mini.on) this.mini.now += 1;

      this._advanceQuestOnGood(1);
      this._maybeSwitchGroup();

      this._removeTarget(idx, 'hit');
      this._emitScore();
      this._emitPower();
      this._emitRank();
      this._emitQuestUpdate();

      if (this.combo === 6) this._emitCoach('คอมโบเริ่มมา! คุมจังหวะไว้ 🔥', 'happy');
      return;
    }

    if (tg.kind === 'wrong') {
      this.nHitWrong++;
      this.totalJudgedForAcc++;

      this.combo = 0;
      this._onMiss('wrong');

      this.score = Math.max(0, this.score - 12);
      emit('hha:judge', { kind: 'bad', text: '-12' });

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

    this.missHitJunk += 1;

    this.combo = 0;
    this._onMiss('junk');

    this.score = Math.max(0, this.score - 18);
    emit('hha:judge', { kind: 'bad', text: '-18' });

    this._removeTarget(idx, 'hit');
    this._emitScore();
    this._emitRank();
    this._emitQuestUpdate();
    this._emitCoach('โดนขยะ! ระวัง! 🗑️', 'sad');
  };

  Engine.prototype._onMiss = function (why) {
    this.misses += 1;
    emit('groups:progress', { kind: 'miss', why });
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
    this._emitPower();
    this._emitQuestUpdate();
    this._emitCoach(`สลับหมู่แล้ว! เป้าถัดไปคือ “${GROUPS[next].th}”`, 'neutral');
  };

  Engine.prototype._advanceQuestOnGood = function (inc) {
    inc = Number(inc) || 1;
    this.goalNow += inc;

    if (this.goalNow >= this.goalNeed) {
      this.goalIndex += 1;
      this.goalNow = 0;

      this.score += 240;
      this.combo += 1;
      this.comboMax = Math.max(this.comboMax, this.combo);

      emit('hha:judge', { kind: 'good', text: 'GOAL CLEAR +240' });
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

  Engine.prototype._emitQuestUpdate = function (miniLeftMs) {
    const g = GROUPS[this.activeGroupIdx];
    const goalTitle = `ยิงให้ถูกหมู่ “${g.th}”`;
    const goalNow = this.goalNow | 0;
    const goalTotal = this.goalNeed | 0;

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

      miniCleared: this.miniCleared | 0,
      miniTotalAll: this.miniTotal | 0,
      miniTotal: this.miniTotal | 0,
      miniFail: this.miniFail | 0,

      groupKey: g.key,
      groupName: g.th,
      goalIndex: this.goalIndex,
      goalsTotal: this.goalsTotal
    });
  };

  Engine.prototype._emitCoach = function (text, mood) {
    const t = nowMs();
    if (t - this.coachLastAt < 450) return;
    this.coachLastAt = t;

    emit('hha:coach', { text: String(text || ''), mood: String(mood || 'neutral') });
  };

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
      miniFail: this.miniFail | 0,

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

      missExpireGood: this.missExpireGood | 0,
      missHitJunk: this.missHitJunk | 0,

      runMode: this.cfg.runMode,
      diff: this.cfg.diff,
      seed: this.cfg.seed
    };

    emit('hha:end', summary);
    this._emitCoach('จบเกมแล้ว! กดเล่นอีกครั้งได้เลย 🏁', 'happy');
  };

  // ---------------- Export ----------------
  NS.GameEngine = new Engine();

})(typeof window !== 'undefined' ? window : globalThis);