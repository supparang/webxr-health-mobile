// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — PRODUCTION HYBRID ENGINE (A+B+C PACK)
// IIFE -> window.GroupsVR.GameEngine
// ✅ DOM emoji targets via CSS vars --x/--y/--s (render loop)
// ✅ Spawn spread + avoid HUD safezone (data-hha-exclude + .hud)
// ✅ Play mode: Adaptive + Rush + BossWave + Decoy + Rage + Lock/Charge/Chain
// ✅ Research mode: seed deterministic + disables random events/features
// ✅ Emits events: hha:score, hha:time, hha:rank, quest:update, hha:coach, groups:lock, groups:reticle

(function () {
  'use strict';

  const ROOT = window;
  const ns = (ROOT.GroupsVR = ROOT.GroupsVR || {});

  const Particles =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
    ROOT.Particles ||
    { scorePop() {}, burstAt() {}, celebrateQuestFX() {}, celebrateAllQuestsFX() {}, toast() {} };

  // ---------- helpers ----------
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const nowMs = () => (ROOT.performance && performance.now ? performance.now() : Date.now());
  const dispatch = (name, detail) => {
    try { ROOT.dispatchEvent(new CustomEvent(name, { detail })); } catch {}
  };

  function hash32(str) {
    str = String(str || '');
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(seed) {
    let t = (seed >>> 0) || 1;
    return function () {
      t += 0x6D2B79F5;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), 1 | x);
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rectIntersects(a, b) {
    return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  }

  function getExcludeRects(extraSelectors) {
    const sels = []
      .concat(extraSelectors || [])
      .concat(['[data-hha-exclude="1"]', '.hud', '#startOverlay']);
    const rects = [];
    for (const sel of sels) {
      const els = document.querySelectorAll(sel);
      els.forEach((el) => {
        if (!el || !el.getBoundingClientRect) return;
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) return;
        rects.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
      });
    }
    return rects;
  }

  function pickSpawnPoint(layerEl, marginPx, excludeRects, tries, rng) {
    const W = innerWidth || 360;
    const H = innerHeight || 640;
    const m = marginPx || 8;

    const safe = {
      left: m,
      top: m,
      right: W - m,
      bottom: H - m
    };

    const test = (x, y) => {
      const pt = { left: x - 2, right: x + 2, top: y - 2, bottom: y + 2 };
      for (const r of excludeRects) {
        if (rectIntersects(pt, r)) return false;
      }
      return true;
    };

    let best = null;
    let bestScore = -1;

    for (let i = 0; i < (tries || 18); i++) {
      const x = safe.left + (safe.right - safe.left) * (rng ? rng() : Math.random());
      const y = safe.top + (safe.bottom - safe.top) * (rng ? rng() : Math.random());

      if (!test(x, y)) continue;

      // score: farther from excluded rect centers -> better
      let score = 0;
      for (const r of excludeRects) {
        const cx = (r.left + r.right) / 2;
        const cy = (r.top + r.bottom) / 2;
        const dx = x - cx;
        const dy = y - cy;
        score += (dx * dx + dy * dy);
      }
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }

    if (!best) {
      // fallback center-ish
      best = { x: W * 0.5, y: H * 0.60 };
    }

    return best;
  }

  // ---------- content: 5 food groups ----------
  const GROUPS = [
    { id: 1, name: 'หมู่ 1 โปรตีน', emoji: ['🥚','🥛','🐟','🍗','🫘','🥜'] },
    { id: 2, name: 'หมู่ 2 คาร์บ', emoji: ['🍚','🍞','🥖','🍜','🥔','🍠'] },
    { id: 3, name: 'หมู่ 3 ผัก', emoji: ['🥦','🥬','🥒','🥕','🌽','🍆'] },
    { id: 4, name: 'หมู่ 4 ผลไม้', emoji: ['🍎','🍌','🍊','🍉','🍇','🍍'] },
    { id: 5, name: 'หมู่ 5 ไขมัน', emoji: ['🥑','🧈','🫒','🥥','🧀','🍳'] }
  ];
  const JUNK = ['🍟','🍔','🥤','🧋','🍩','🍰','🍕','🍫'];

  // ---------- tuning ----------
  function makeTune(diff) {
    diff = String(diff || 'normal').toLowerCase();
    const base =
      diff === 'easy'
        ? { spawnEvery: 820, ttl: 2200, size: 1.08, junkRate: 0.22, lockSec: 0.55, chargeSec: 0.65 }
        : diff === 'hard'
          ? { spawnEvery: 560, ttl: 1650, size: 0.92, junkRate: 0.35, lockSec: 0.70, chargeSec: 0.78 }
          : { spawnEvery: 680, ttl: 1900, size: 1.00, junkRate: 0.28, lockSec: 0.62, chargeSec: 0.72 };

    return {
      ...base,

      // scoring
      scoreGood: 18,
      scoreJunk: -26,
      scoreBoss: 55,
      scorePerfectBonus: 10,

      // combo / miss
      comboPerfectAt: 6,
      missPenaltySec: 0, // reserved
      shieldMax: 6,

      // lock/charge
      lockRadiusPx: 74,
      chargeExtraRadiusPx: 92,
      burstShots: 3,
      chainHits: 2,

      // play events
      rushEverySec: 18,
      rushWindowSec: 8,
      rushNeed: 6,          // hit good in window
      rushMulSpawn: 0.72,   // faster spawns
      rushBonus: 40,

      bossEverySec: 24,
      bossHp: 3,

      rageEverySec: 16,
      rageTtlMul: 0.82,
      rageDodgePxPerSec: 88,

      decoyRate: 0.12, // play only

      // adaptive
      adaptiveEverySec: 6,
      adaptiveStep: 0.06,   // adjust factor
      adaptiveMax: 0.28,
    };
  }

  // ---------- quest (fallback) ----------
  function makeFallbackQuest(runMode) {
    const q = {
      // goal: collect at least 1 from each group (repeatable)
      goalNeedEach: 1,
      got: { 1:0,2:0,3:0,4:0,5:0 },
      goalDone: false,

      // mini: Rush
      miniOn: false,
      miniLeft: 0,
      miniNeed: 0,
      miniProg: 0,

      // current group focus
      focusGroup: 1,
      focusTick: 0
    };

    function goalProgress() {
      let doneCount = 0;
      for (let i = 1; i <= 5; i++) doneCount += (q.got[i] >= q.goalNeedEach ? 1 : 0);
      return doneCount;
    }

    function currentGroupLabel() {
      const g = GROUPS.find(x=>x.id===q.focusGroup);
      return g ? g.name : '—';
    }

    return {
      onHitGood(groupId) {
        q.got[groupId] = (q.got[groupId] || 0) + 1;
        if (!q.goalDone && goalProgress() >= 5) q.goalDone = true;
        if (q.miniOn) q.miniProg += 1;
      },
      onHitJunk() {},
      second() {
        q.focusTick += 1;
        if (q.focusTick % 10 === 0) {
          q.focusGroup = (q.focusGroup % 5) + 1;
        }
        if (q.miniOn) {
          q.miniLeft -= 1;
          if (q.miniLeft <= 0) q.miniOn = false;
        }
      },
      startRush(need, windowSec) {
        q.miniOn = true;
        q.miniLeft = windowSec;
        q.miniNeed = need;
        q.miniProg = 0;
      },
      isRushActive() { return !!q.miniOn; },
      rushLeft() { return q.miniLeft|0; },
      rushNeed() { return q.miniNeed|0; },
      rushProg() { return q.miniProg|0; },

      snapshot() {
        const goalDone = goalProgress();
        return {
          goal: { label: 'เก็บอาหารให้ครบ 5 หมู่ (อย่างละ 1)', prog: goalDone, target: 5 },
          mini: q.miniOn ? {
            label: 'RUSH: เก็บอาหารดีให้ทัน!',
            prog: q.miniProg,
            target: q.miniNeed,
            tLeft: q.miniLeft,
            windowSec: q.miniNeed ? q.miniLeft : 0
          } : null,
          groupLabel: currentGroupLabel()
        };
      }
    };
  }

  // ---------- engine ----------
  const Engine = {
    _layerEl: null,
    _camEl: null,

    _running: false,
    _raf: null,
    _timer: null,
    _rng: null,
    _seed: '',
    _runMode: 'play',

    _diff: 'normal',
    _tune: null,

    _timeLeft: 70,
    _score: 0,
    _combo: 0,
    _comboBest: 0,
    _miss: 0,
    _shield: 0,

    _targets: [],
    _idSeq: 1,

    _lastSpawnAt: 0,
    _spawnEvery: 680,

    _lock: {
      on: false,
      id: null,
      prog: 0,
      charge: 0,
      atX: 0,
      atY: 0
    },

    _events: {
      rushLeft: 0,
      nextRushAt: 0,
      nextBossAt: 0,
      nextRageAt: 0,
      bossAlive: false,
      bossId: null,
      adaptiveFactor: 0
    },

    setLayerEl(el) { this._layerEl = el; },
    setCameraEl(el) { this._camEl = el; },
    setTimeLeft(sec) { this._timeLeft = Math.max(0, sec|0); },

    setGaze(on) {
      this._gazeOn = !!on;
      dispatch('hha:coach', { text: this._gazeOn ? '👀 Gaze ON: จ้องเพื่อ LOCK/CHARGE' : '👆 Gaze OFF: แตะยิงอย่างเดียว', mood:'neutral' });
    },

    start(diff, opts = {}) {
      if (this._running) return;
      this._running = true;

      this._diff = String(diff || 'normal').toLowerCase();
      this._runMode = String(opts.runMode || opts.mode || 'play').toLowerCase() === 'research' ? 'research' : 'play';

      this._seed = String(opts.seed || '').trim();
      const seed32 = this._seed ? hash32(this._seed) : (Math.random() * 0xffffffff) >>> 0;
      this._rng = (this._runMode === 'research') ? mulberry32(seed32) : null;

      this._tune = makeTune(this._diff);
      this._spawnEvery = this._tune.spawnEvery;

      this._score = 0;
      this._combo = 0;
      this._comboBest = 0;
      this._miss = 0;
      this._shield = 0;

      this._targets = [];
      this._idSeq = 1;

      this._gazeOn = true;

      this._lock = { on:false, id:null, prog:0, charge:0, atX:0, atY:0 };

      const t = this._tune;
      const sec = this._timeLeft|0;

      this._events = {
        rushLeft: 0,
        nextRushAt: (this._runMode === 'play') ? (sec - t.rushEverySec) : 999999,
        nextBossAt: (this._runMode === 'play') ? (sec - t.bossEverySec) : 999999,
        nextRageAt: (this._runMode === 'play') ? (sec - t.rageEverySec) : 999999,
        bossAlive: false,
        bossId: null,
        adaptiveFactor: 0,
        adaptiveTick: 0,
        lastScore: 0,
        lastComboBest: 0
      };

      // quest hookup
      const externalQuest = (ROOT.GroupsQuest && typeof ROOT.GroupsQuest.createFoodGroupsQuest === 'function')
        ? ROOT.GroupsQuest.createFoodGroupsQuest(this._diff, { runMode: this._runMode, seed: this._seed })
        : null;
      this._quest = externalQuest || makeFallbackQuest(this._runMode);

      // layer
      if (!this._layerEl) this._layerEl = document.getElementById('fg-layer');
      if (!this._layerEl) {
        console.error('[GroupsVR] layer not found');
        this._running = false;
        return;
      }

      // input
      this._onPointerDown = (ev) => this._handleTap(ev);
      this._layerEl.addEventListener('pointerdown', this._onPointerDown, { passive:true });

      dispatch('hha:coach', {
        text: this._runMode === 'research'
          ? '🧪 Research: Seed fix + ปิด Rush/Boss/Decoy/Rage เพื่อคุมตัวแปร'
          : '🔥 Play: LOCK/CHARGE + Rush + BossWave + Decoy + Rage มาแล้ว!',
        mood: 'happy'
      });

      // init emit
      this._emitScore();
      this._emitTime();
      this._emitRank();
      this._emitQuest(true);

      // loops
      this._lastSpawnAt = nowMs();
      this._raf = ROOT.requestAnimationFrame(() => this._tick());
      this._timer = ROOT.setInterval(() => this._second(), 1000);
      ROOT.__FG_STARTED__ = true;
    },

    stop(reason) {
      if (!this._running) return;
      this._running = false;

      try { if (this._raf) ROOT.cancelAnimationFrame(this._raf); } catch {}
      try { if (this._timer) ROOT.clearInterval(this._timer); } catch {}
      this._raf = null;
      this._timer = null;

      try { this._layerEl && this._onPointerDown && this._layerEl.removeEventListener('pointerdown', this._onPointerDown); } catch {}
      this._onPointerDown = null;

      // clear targets
      try {
        this._targets.forEach(t => { try { t.el && t.el.remove(); } catch {} });
      } catch {}
      this._targets = [];

      // lock UI off
      dispatch('groups:lock', { on:false });

      dispatch('hha:coach', { text: '🛑 หยุดเกมแล้ว', mood:'neutral', reason: reason||'' });
    },

    // --------- core loop ----------
    _tick() {
      if (!this._running) return;

      const tNow = nowMs();
      const dt = clamp((tNow - (this._lastTickAt || tNow)) / 1000, 0, 0.05);
      this._lastTickAt = tNow;

      // spawn control (rush affects cadence)
      const rushOn = (this._runMode === 'play') && this._quest && this._quest.isRushActive && this._quest.isRushActive();
      const spawnMul = rushOn ? this._tune.rushMulSpawn : 1;
      const every = clamp(this._spawnEvery * spawnMul * (1 - this._events.adaptiveFactor), 360, 1200);

      if (tNow - this._lastSpawnAt >= every) {
        this._spawnOne();
        this._lastSpawnAt = tNow;
      }

      // update targets (ttl + rage dodge)
      this._updateTargets(dt);

      // gaze lock + charge
      this._updateGazeLock(dt);

      // render lock UI each frame
      this._emitLockUI();

      this._raf = ROOT.requestAnimationFrame(() => this._tick());
    },

    _second() {
      if (!this._running) return;

      this._timeLeft = Math.max(0, (this._timeLeft|0) - 1);
      this._emitTime();

      // quest tick
      try { this._quest && this._quest.second && this._quest.second(); } catch {}

      // play events schedule (based on timeLeft crossing)
      if (this._runMode === 'play') {
        this._handleEventsEachSecond();
        this._handleAdaptiveEachSecond();
      }

      this._emitQuest(false);
      this._emitRank();

      if (this._timeLeft <= 0) {
        dispatch('hha:coach', { text:'🏁 จบเกม!', mood:'happy' });
        dispatch('hha:end', {
          score: this._score|0,
          miss: this._miss|0,
          misses: this._miss|0,
          comboBest: this._comboBest|0,
          time: 0
        });
        try { Particles.celebrateAllQuestsFX?.(); } catch {}
        this.stop('time_up');
      }
    },

    _handleEventsEachSecond() {
      const t = this._tune;
      const left = this._timeLeft|0;

      // RUSH trigger
      if (left > 0 && (left % t.rushEverySec) === 0) {
        try { this._quest && this._quest.startRush && this._quest.startRush(t.rushNeed, t.rushWindowSec); } catch {}
        dispatch('hha:coach', { text:`⚡ RUSH! เก็บอาหารดี ${t.rushNeed} ชิ้นใน ${t.rushWindowSec}s`, mood:'happy' });
        try { Particles.toast?.('RUSH!', 'warn'); } catch {}
      }

      // BOSS wave trigger
      if (left > 0 && (left % t.bossEverySec) === 0) {
        if (!this._events.bossAlive) {
          this._spawnBoss();
          dispatch('hha:coach', { text:'👑 BOSS WAVE! ยิงให้แตก!', mood:'happy' });
          try { Particles.toast?.('BOSS WAVE!', 'warn'); } catch {}
        }
      }

      // RAGE trigger (makes one target dodge)
      if (left > 0 && (left % t.rageEverySec) === 0) {
        this._makeRage();
      }
    },

    _handleAdaptiveEachSecond() {
      const t = this._tune;
      this._events.adaptiveTick += 1;
      if ((this._events.adaptiveTick % t.adaptiveEverySec) !== 0) return;

      // simple performance-based adjust
      const scoreGain = (this._score|0) - (this._events.lastScore|0);
      const cb = this._comboBest|0;
      const cbGain = cb - (this._events.lastComboBest|0);

      this._events.lastScore = this._score|0;
      this._events.lastComboBest = cb;

      // if player strong -> harder, else easier
      let delta = 0;
      if (scoreGain >= 220 || cbGain >= 4) delta = +t.adaptiveStep;
      else if (scoreGain <= 90 || cbGain <= 0) delta = -t.adaptiveStep;

      this._events.adaptiveFactor = clamp(this._events.adaptiveFactor + delta, -t.adaptiveMax, t.adaptiveMax);

      // adjust spawnEvery slightly
      const base = this._tune.spawnEvery;
      const fac = this._events.adaptiveFactor;
      this._spawnEvery = clamp(base * (1 - fac * 0.6), 420, 1200);

      dispatch('hha:adaptive', { factor: this._events.adaptiveFactor, spawnEvery: this._spawnEvery|0 });

      if (delta > 0) dispatch('hha:coach', { text:'😈 เก่งขึ้นแล้ว! เกมจะไวขึ้นนิดนึง!', mood:'happy' });
      else if (delta < 0) dispatch('hha:coach', { text:'💙 ผ่อนให้หน่อยนะ ตั้งสติแล้วลุยต่อ!', mood:'neutral' });
    },

    // --------- spawn ----------
    _pickRand() {
      return this._rng ? this._rng() : Math.random();
    },

    _spawnOne() {
      const t = this._tune;
      const r = this._pickRand();

      // choose type
      const isJunk = (r < (t.junkRate + (this._events.adaptiveFactor > 0 ? 0.04 : 0)));
      const canDecoy = (this._runMode === 'play');
      const isDecoy = canDecoy && !isJunk && (this._pickRand() < t.decoyRate);

      const groupFocus = this._getFocusGroup();
      const groupId = isJunk ? 0 : (this._pickRand() < 0.55 ? groupFocus : (1 + Math.floor(this._pickRand() * 5)));

      let ch = '🍚';
      let kind = 'good';
      if (isJunk) {
        kind = 'junk';
        ch = JUNK[Math.floor(this._pickRand() * JUNK.length)];
      } else {
        const g = GROUPS.find(x => x.id === groupId) || GROUPS[0];
        ch = g.emoji[Math.floor(this._pickRand() * g.emoji.length)];
        kind = isDecoy ? 'decoy' : 'good';
      }

      // safe spawn point avoiding HUD
      const excludeRects = getExcludeRects(['#reticle', '#lockUI']);
      const pt = pickSpawnPoint(this._layerEl, 10, excludeRects, 18, this._rng);

      const el = document.createElement('div');
      el.className = 'fg-target spawn';
      el.textContent = ch;

      // class flavors
      if (kind === 'junk') el.classList.add('fg-junk');
      else if (kind === 'decoy') el.classList.add('fg-decoy');
      else el.classList.add('fg-good');

      // scale by diff
      const s = clamp(this._tune.size * rnd(0.92, 1.08), 0.80, 1.28);

      el.style.setProperty('--x', ((pt.x / (innerWidth||360)) * 100).toFixed(2) + '%');
      el.style.setProperty('--y', ((pt.y / (innerHeight||640)) * 100).toFixed(2) + '%');
      el.style.setProperty('--s', s.toFixed(3));

      // attach
      this._layerEl.appendChild(el);

      // animate in
      requestAnimationFrame(() => {
        el.classList.add('show');
        el.classList.remove('spawn');
      });

      const id = (this._idSeq++).toString(36);
      const ttl = clamp(this._tune.ttl * rnd(0.90, 1.12), 1100, 3200);

      const target = {
        id, el, ch,
        kind, groupId,
        born: nowMs(),
        ttl,
        hp: 1,
        rage: false,

        // cached center updated in update pass
        cx: pt.x, cy: pt.y,
        s
      };

      // click handler
      el.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this._hitTarget(target, { x: ev.clientX||target.cx, y: ev.clientY||target.cy, via:'tap' });
      }, { passive:false });

      this._targets.push(target);
    },

    _spawnBoss() {
      const t = this._tune;

      const excludeRects = getExcludeRects(['#reticle', '#lockUI']);
      const pt = pickSpawnPoint(this._layerEl, 14, excludeRects, 22, this._rng);

      const el = document.createElement('div');
      el.className = 'fg-target fg-boss spawn show';
      el.textContent = '👑';

      const s = clamp(this._tune.size * 1.25, 1.10, 1.42);
      el.style.setProperty('--x', ((pt.x / (innerWidth||360)) * 100).toFixed(2) + '%');
      el.style.setProperty('--y', ((pt.y / (innerHeight||640)) * 100).toFixed(2) + '%');
      el.style.setProperty('--s', s.toFixed(3));

      // boss HP bar
      const bar = document.createElement('div');
      bar.className = 'bossbar';
      const fill = document.createElement('div');
      fill.className = 'bossbar-fill';
      bar.appendChild(fill);
      el.appendChild(bar);

      this._layerEl.appendChild(el);

      const id = 'boss_' + (this._idSeq++).toString(36);
      const hp = clamp(t.bossHp + (this._diff === 'hard' ? 1 : 0), 3, 5);

      const target = {
        id, el, ch:'👑',
        kind:'boss', groupId: 0,
        born: nowMs(),
        ttl: clamp(t.ttl * 1.55, 2300, 5200),
        hp,
        hpMax: hp,
        barFill: fill,
        rage: false,
        cx: pt.x, cy: pt.y,
        s
      };

      el.addEventListener('pointerdown', (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        this._hitTarget(target, { x: ev.clientX||target.cx, y: ev.clientY||target.cy, via:'tap' });
      }, { passive:false });

      this._events.bossAlive = true;
      this._events.bossId = id;
      this._targets.push(target);

      try { Particles.toast?.('BOSS!', 'warn'); } catch {}
    },

    _makeRage() {
      if (!this._targets.length) return;

      // pick a non-boss good/decoy target if possible
      let candidates = this._targets.filter(t => t && t.el && !t.rage && t.kind !== 'boss');
      if (!candidates.length) return;

      const pick = candidates[Math.floor(this._pickRand() * candidates.length)];
      pick.rage = true;
      pick.el.classList.add('rage');

      // shorten ttl to create urgency
      pick.ttl = clamp(pick.ttl * this._tune.rageTtlMul, 850, 2100);

      dispatch('hha:coach', { text:'⚠️ RAGE! เป้าจะหลบ ต้อง LOCK/ยิงให้ทัน!', mood:'sad' });
      try { Particles.toast?.('RAGE!', 'warn'); } catch {}
    },

    _getFocusGroup() {
      // external quest may expose current group
      try {
        const snap = this._quest && this._quest.snapshot ? this._quest.snapshot() : null;
        // if quest provides groupLabel only, just rotate by time
      } catch {}
      // fallback: rotate by timeLeft blocks
      const k = (Math.floor(((this._timeLeft|0) / 10)) % 5);
      return 1 + ((5 - k) % 5);
    },

    // --------- update targets ----------
    _updateTargets(dt) {
      const tNow = nowMs();

      for (let i = this._targets.length - 1; i >= 0; i--) {
        const tg = this._targets[i];
        if (!tg || !tg.el) { this._targets.splice(i,1); continue; }

        // update cached center (cheap: rect every few frames)
        if (!tg._rectTick || (tg._rectTick++ % 6) === 0) {
          try {
            const r = tg.el.getBoundingClientRect();
            tg.cx = r.left + r.width / 2;
            tg.cy = r.top + r.height / 2;
            tg._w = r.width; tg._h = r.height;
          } catch {}
        }

        // rage dodge movement (push away from screen center slightly)
        if (tg.rage) {
          const cx = (innerWidth||360)/2;
          const cy = (innerHeight||640)/2;
          const dx = tg.cx - cx;
          const dy = tg.cy - cy;
          const len = Math.max(1, Math.hypot(dx, dy));
          const vx = (dx/len) * this._tune.rageDodgePxPerSec;
          const vy = (dy/len) * this._tune.rageDodgePxPerSec;

          // move by modifying --x/--y in % space
          const px = tg.cx + vx * dt;
          const py = tg.cy + vy * dt;

          // afterimage
          if ((tg._aiTick = (tg._aiTick||0) + dt) > 0.12) {
            tg._aiTick = 0;
            this._spawnAfterimage(tg);
          }

          const xPct = clamp((px / (innerWidth||360)) * 100, 8, 92);
          const yPct = clamp((py / (innerHeight||640)) * 100, 10, 90);
          tg.el.style.setProperty('--x', xPct.toFixed(2) + '%');
          tg.el.style.setProperty('--y', yPct.toFixed(2) + '%');
        }

        // ttl expire
        if (tNow - tg.born >= tg.ttl) {
          this._expireTarget(tg);
          try { tg.el.classList.add('out'); } catch {}
          try { setTimeout(() => { try { tg.el.remove(); } catch {} }, 180); } catch {}
          this._targets.splice(i, 1);
        }
      }
    },

    _spawnAfterimage(tg) {
      try {
        const ai = document.createElement('div');
        ai.className = 'fg-afterimage';
        ai.style.left = (tg.cx|0) + 'px';
        ai.style.top = (tg.cy|0) + 'px';

        const inner = document.createElement('div');
        inner.className = 'fg-afterimage-inner';
        inner.textContent = tg.ch;

        ai.appendChild(inner);
        this._layerEl.appendChild(ai);

        setTimeout(() => { try { ai.remove(); } catch {} }, 520);
      } catch {}
    },

    _expireTarget(tg) {
      // expiration penalty: boss ignored, rage extra penalty
      if (tg.kind === 'boss') {
        // boss escaped -> heavy miss
        this._miss += 2;
        this._combo = 0;
        this._emitScore('BOSS_ESCAPE');
        dispatch('groups:reticle', { state:'miss' });
        dispatch('hha:coach', { text:'😵 BOSS หนีไปแล้ว! ระวัง!', mood:'sad' });
        return;
      }

      // If good/decoy expires -> count miss (makes it challenging)
      if (tg.kind === 'good' || tg.kind === 'decoy') {
        this._miss += tg.rage ? 2 : 1;
        this._combo = 0;
        this._emitScore(tg.rage ? 'RAGE_MISS' : 'MISS');
        dispatch('groups:reticle', { state:'miss' });
      }
    },

    // --------- hit / judge ----------
    _handleTap(ev) {
      // tap-anywhere: pick nearest target to tap point
      const x = ev.clientX || (innerWidth/2);
      const y = ev.clientY || (innerHeight/2);

      let best = null;
      let bestD = 1e18;

      for (const tg of this._targets) {
        if (!tg || !tg.el) continue;
        const dx = (tg.cx||0) - x;
        const dy = (tg.cy||0) - y;
        const d = dx*dx + dy*dy;
        if (d < bestD) { bestD = d; best = tg; }
      }

      // if too far, do nothing (avoid accidental)
      const r = 110;
      if (!best || bestD > r*r) return;

      this._hitTarget(best, { x, y, via:'tapAnywhere' });
    },

    _hitTarget(tg, ctx) {
      if (!this._running || !tg || !tg.el) return;

      // decoy in play mode: treat as junk although looks good
      let kind = tg.kind;
      if (kind === 'decoy') kind = 'junk';

      // boss special
      if (tg.kind === 'boss') {
        tg.hp -= 1;
        this._combo += 1;
        this._comboBest = Math.max(this._comboBest, this._combo);

        const delta = this._tune.scoreBoss;
        this._score = Math.max(0, (this._score + delta) | 0);

        // update boss bar
        try {
          if (tg.barFill && tg.hpMax) {
            const p = clamp(tg.hp / tg.hpMax, 0, 1);
            tg.barFill.style.width = (p*100).toFixed(0) + '%';
          }
        } catch {}

        dispatch('groups:reticle', { state: (this._combo >= this._tune.comboPerfectAt ? 'perfect' : 'ok') });

        try { Particles.burstAt?.(ctx.x||tg.cx, ctx.y||tg.cy, 'BOSS'); } catch {}
        try { Particles.scorePop?.(ctx.x||tg.cx, ctx.y||tg.cy, delta, 'BOSS'); } catch {}

        // boss dead
        if (tg.hp <= 0) {
          this._events.bossAlive = false;
          this._events.bossId = null;

          this._score = Math.max(0, (this._score + 80) | 0);
          dispatch('hha:coach', { text:'🎉 BOSS แตก! ได้โบนัส!', mood:'happy' });
          try { Particles.celebrateQuestFX?.(); } catch {}

          this._removeTarget(tg, 'hit');
        } else {
          // keep alive, add shake
          try { tg.el.classList.add('lock'); setTimeout(()=>tg.el.classList.remove('lock'), 140); } catch {}
        }

        this._emitScore('BOSS_HIT');
        this._emitRank();
        this._emitQuest(false);
        return;
      }

      // good / junk
      if (kind === 'junk') {
        if (this._shield > 0) {
          this._shield -= 1;
          dispatch('hha:coach', { text:'🛡️ BLOCK! เกราะกันพลาด', mood:'neutral' });
          dispatch('groups:reticle', { state:'ok' });
          this._emitScore('BLOCK');
          this._removeTarget(tg, 'hit');
          return;
        }

        this._score = Math.max(0, (this._score + this._tune.scoreJunk) | 0);
        this._combo = 0;
        this._miss += 1;

        try { this._quest && this._quest.onHitJunk && this._quest.onHitJunk(); } catch {}

        dispatch('groups:reticle', { state:'miss' });
        try { Particles.burstAt?.(ctx.x||tg.cx, ctx.y||tg.cy, 'JUNK'); } catch {}
        try { Particles.scorePop?.(ctx.x||tg.cx, ctx.y||tg.cy, this._tune.scoreJunk, 'JUNK'); } catch {}
        dispatch('hha:coach', { text:'❌ โดนขยะ! รีเซ็ตคอมโบ', mood:'sad' });

        this._emitScore('JUNK');
        this._emitQuest(false);
        this._emitRank();
        this._removeTarget(tg, 'hit');
        return;
      }

      // GOOD
      const deltaBase = this._tune.scoreGood;
      this._combo += 1;
      this._comboBest = Math.max(this._comboBest, this._combo);

      let delta = deltaBase;

      const perfect = (this._combo >= this._tune.comboPerfectAt);
      if (perfect) delta += this._tune.scorePerfectBonus;

      this._score = Math.max(0, (this._score + delta) | 0);

      // shield chance in play mode (small spice)
      if (this._runMode === 'play' && this._pickRand() < 0.06) {
        this._shield = clamp(this._shield + 1, 0, this._tune.shieldMax);
        dispatch('hha:coach', { text:'🛡️ +1 SHIELD!', mood:'happy' });
        try { Particles.toast?.('+1 SHIELD 🛡️', 'good'); } catch {}
      }

      try { this._quest && this._quest.onHitGood && this._quest.onHitGood(tg.groupId||1); } catch {}

      dispatch('groups:reticle', { state: perfect ? 'perfect' : 'ok' });
      try { Particles.burstAt?.(ctx.x||tg.cx, ctx.y||tg.cy, perfect ? 'PERFECT' : 'GOOD'); } catch {}
      try { Particles.scorePop?.(ctx.x||tg.cx, ctx.y||tg.cy, delta, perfect ? 'PERFECT' : 'GOOD'); } catch {}

      // rush success bonus
      if (this._runMode === 'play' && this._quest && this._quest.isRushActive && this._quest.isRushActive()) {
        const prog = this._quest.rushProg ? this._quest.rushProg() : 0;
        const need = this._quest.rushNeed ? this._quest.rushNeed() : 999;
        if (need && prog >= need) {
          this._score = Math.max(0, (this._score + this._tune.rushBonus) | 0);
          dispatch('hha:coach', { text:'⚡ RUSH CLEAR! โบนัสเพิ่ม!', mood:'happy' });
          try { Particles.celebrateQuestFX?.(); } catch {}
          try { Particles.toast?.('RUSH CLEAR!', 'good'); } catch {}
          // stop rush (if fallback quest)
          try { if (this._quest.startRush) this._quest.startRush(0,0); } catch {}
        }
      }

      this._emitScore(perfect ? 'PERFECT' : 'GOOD');
      this._emitQuest(false);
      this._emitRank();
      this._removeTarget(tg, 'hit');
    },

    _removeTarget(tg, anim) {
      try {
        if (tg.el) {
          tg.el.classList.add(anim === 'hit' ? 'hit' : 'out');
          setTimeout(() => { try { tg.el.remove(); } catch {} }, 220);
        }
      } catch {}
      const idx = this._targets.indexOf(tg);
      if (idx >= 0) this._targets.splice(idx, 1);

      // if it was lock target, clear lock
      if (this._lock && this._lock.id === tg.id) {
        this._lock.id = null;
        this._lock.prog = 0;
        this._lock.charge = 0;
      }
    },

    // --------- gaze lock / charge ----------
    _updateGazeLock(dt) {
      if (!this._gazeOn) {
        this._lock.on = false;
        this._lock.id = null;
        this._lock.prog = 0;
        this._lock.charge = 0;
        return;
      }

      const cx = (innerWidth||360)/2;
      const cy = (innerHeight||640)/2;
      const t = this._tune;

      // find closest target to center
      let best = null;
      let bestD = 1e18;

      for (const tg of this._targets) {
        if (!tg || !tg.el) continue;
        // ignore junk for lock? (still lockable but risky)
        const dx = (tg.cx||0) - cx;
        const dy = (tg.cy||0) - cy;
        const d = dx*dx + dy*dy;
        if (d < bestD) { bestD = d; best = tg; }
      }

      const inLock = best && bestD <= (t.lockRadiusPx * t.lockRadiusPx);
      const inCharge = best && bestD <= (t.chargeExtraRadiusPx * t.chargeExtraRadiusPx);

      if (!inLock) {
        // lose lock
        if (this._lock.on) {
          this._lock.on = false;
          this._lock.id = null;
          this._lock.prog = 0;
          this._lock.charge = 0;
        }
        return;
      }

      // acquire/keep lock
      if (this._lock.id !== best.id) {
        // new lock target
        this._lock.on = true;
        this._lock.id = best.id;
        this._lock.prog = 0;
        this._lock.charge = 0;
      }

      // progress
      this._lock.prog = clamp(this._lock.prog + dt / Math.max(0.18, t.lockSec), 0, 1);

      // mark UI and target
      try { best.el.classList.add('lock'); } catch {}

      // on full lock -> auto burst (A: ยิงเป็นชุด)
      if (this._lock.prog >= 1 && !this._lock._burstDone) {
        this._lock._burstDone = true;

        // burst shots: hit same target multiple times quickly
        dispatch('hha:coach', { text:'🎯 LOCK! ยิงเป็นชุด!', mood:'happy' });
        for (let k = 0; k < t.burstShots; k++) {
          setTimeout(() => {
            // may already removed, so re-check
            const alive = this._targets.find(x=>x.id===best.id);
            if (alive) this._hitTarget(alive, { x: cx, y: cy, via:'lockBurst' });
          }, 35 * k);
        }
      }

      // charge fills when staying inside charge radius after lock full
      if (this._lock.prog >= 1 && inCharge) {
        this._lock.charge = clamp(this._lock.charge + dt / Math.max(0.25, t.chargeSec), 0, 1);

        // on full charge -> chain hits (B: โซ่ CHAIN)
        if (this._lock.charge >= 1 && !this._lock._chainDone) {
          this._lock._chainDone = true;

          dispatch('hha:coach', { text:'💥 CHARGE! ยิงแรง + CHAIN!', mood:'happy' });
          try { Particles.toast?.('CHAIN!', 'good'); } catch {}

          // hit nearest extra targets (prefer good)
          const extras = this._targets
            .filter(x => x && x.el && x.id !== best.id)
            .sort((a,b)=>{
              const da = ((a.cx-cx)*(a.cx-cx) + (a.cy-cy)*(a.cy-cy));
              const db = ((b.cx-cx)*(b.cx-cx) + (b.cy-cy)*(b.cy-cy));
              return da - db;
            });

          let hitCount = 0;
          for (const tg of extras) {
            if (hitCount >= t.chainHits) break;
            // prefer good first
            if (tg.kind === 'junk') continue;
            hitCount++;
            setTimeout(()=>this._hitTarget(tg, { x: tg.cx, y: tg.cy, via:'chain' }), 30 * hitCount);
          }

          // even if no extras, reward a small bonus
          if (hitCount === 0) {
            this._score = Math.max(0, (this._score + 18) | 0);
            this._emitScore('CHAIN_BONUS');
          }
        }
      }
    },

    _emitLockUI() {
      if (!this._gazeOn || !this._lock.on || !this._lock.id) {
        dispatch('groups:lock', { on:false });
        return;
      }

      const tg = this._targets.find(x => x && x.id === this._lock.id);
      if (!tg) { dispatch('groups:lock', { on:false }); return; }

      const x = tg.cx || (innerWidth/2);
      const y = tg.cy || (innerHeight/2);

      dispatch('groups:lock', {
        on: true,
        x, y,
        prog: this._lock.prog || 0,
        charge: this._lock.charge || 0
      });
    },

    // --------- emits ----------
    _emitScore(label) {
      dispatch('hha:score', {
        score: this._score|0,
        combo: this._combo|0,
        comboBest: this._comboBest|0,
        miss: this._miss|0,
        misses: this._miss|0,
        shield: this._shield|0,
        label: label||''
      });
    },

    _emitTime() {
      dispatch('hha:time', { left: this._timeLeft|0, sec: this._timeLeft|0 });
    },

    _emitRank() {
      // simple grade from score + comboBest - miss
      const s = (this._score|0);
      const m = (this._miss|0);
      const cb = (this._comboBest|0);
      const v = clamp(s + cb*12 - m*35, 0, 5000);

      let grade = 'C';
      if (v >= 1350) grade = 'SSS';
      else if (v >= 1100) grade = 'SS';
      else if (v >= 850) grade = 'S';
      else if (v >= 600) grade = 'A';
      else if (v >= 360) grade = 'B';

      dispatch('hha:rank', { grade, value: v });
    },

    _emitQuest(force) {
      let snap = null;
      try {
        snap = this._quest && this._quest.snapshot ? this._quest.snapshot() : null;
      } catch {}

      if (!snap) return;

      dispatch('quest:update', {
        goal: snap.goal || null,
        mini: snap.mini || null,
        groupLabel: snap.groupLabel || ''
      });

      if (force) {
        dispatch('hha:coach', { text: `🎵 โฟกัสตอนนี้: ${snap.groupLabel || '—'}`, mood:'neutral' });
      }
    }
  };

  ns.GameEngine = Engine;
})();