/* === /herohealth/vr-groups/GameEngine.js ===
Food Groups VR — GameEngine (v3: 1-3 FINAL + Boot-safe)
1) Boss Phase 2: weak spot + feint (style-aware)
2) Storm Patterns: wave / spiral / burst (style-aware)
3) No-Junk Zone fair: prevents junk/decoy/wrong near center (deterministic in research)

IMPORTANT PATCHES:
✅ Do NOT overwrite window.GroupsBoot (เคยทำให้ Launcher/Boot พัง)
✅ No early return if #fg-layer not found at load time (Boot จะ setLayerEl ทีหลัง)
✅ start() respects setTimeLeft() if called before start()
*/

(function (root) {
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (name, detail) => {
    try { root.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch {}
  };

  // ---------- Seeded RNG ----------
  function xmur3(str) {
    str = String(str || 'seed');
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= (h >>> 16);
      return h >>> 0;
    };
  }
  function sfc32(a, b, c, d) {
    return function () {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function makeRng(seed) {
    const gen = xmur3(seed);
    return sfc32(gen(), gen(), gen(), gen());
  }

  // ---------- Helpers ----------
  function clamp(v, a, b) { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); }
  function qs(name, def) {
    try { return (new URL(root.location.href)).searchParams.get(name) ?? def; }
    catch { return def; }
  }
  function now() { return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }
  function pick(rng, arr) { return (!arr || !arr.length) ? '' : arr[(rng() * arr.length) | 0]; }
  function styleNorm(s) {
    s = String(s || 'mix').toLowerCase();
    return (s === 'hard' || s === 'feel' || s === 'mix') ? s : 'mix';
  }

  // ---------- Simple SFX ----------
  const SFX = {
    ctx: null,
    nextTickAt: 0,
    ensure() {
      if (this.ctx) return this.ctx;
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      try { this.ctx = new AC(); return this.ctx; } catch { return null; }
    },
    beep(freq, dur, gain) {
      const ctx = this.ensure();
      if (!ctx) return;
      try {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = freq;
        g.gain.value = 0.0001;
        o.connect(g); g.connect(ctx.destination);
        const t0 = ctx.currentTime;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain || 0.05), t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.06));
        o.start(t0);
        o.stop(t0 + (dur || 0.06) + 0.02);
      } catch {}
    },
    tickStorm(leftMs) {
      const t = now();
      if (t < this.nextTickAt) return;
      const left = Math.max(0, leftMs);
      const rate = (left <= 1200) ? 85 : (left <= 2200 ? 135 : 210);
      this.nextTickAt = t + rate;
      this.beep(980, 0.045, 0.045);
    },
    good() { this.beep(660, 0.045, 0.040); },
    bad()  { this.beep(220, 0.065, 0.055); },
    power(){ this.beep(820, 0.07, 0.050); this.beep(1040, 0.06, 0.045); },
    bossWeak(){ this.beep(1200, 0.05, 0.040); },
    bossFeint(){ this.beep(420, 0.045, 0.035); }
  };

  // ---------- Canon: Thai 5 Food Groups ----------
  const SONG = [
    'อาหารหลัก 5 หมู่ของไทย ทุกคนจำไว้อย่าได้แปลผัน',
    'หมู่ 1 กินเนื้อ นม ไข่ ถั่วเมล็ดช่วยให้เติบโตแข็งขัน',
    'หมู่ 2 ข้าว แป้ง เผือก มัน และน้ำตาล จะให้พลัง',
    'หมู่ 3 กินผักต่างๆ สารอาหารมากมายกินเป็นอาจิณ',
    'หมู่ 4 กินผลไม้ สีเขียวเหลืองบ้างมีวิตามิน',
    'หมู่ 5 อย่าได้ลืมกิน ไขมันทั้งสิ้น อบอุ่นร่างกาย'
  ];

  const GROUPS = {
    1: { label:'หมู่ 1', emoji:['🥛','🥚','🍗','🐟','🥜','🫘','🍖','🧀'], song: SONG[1] },
    2: { label:'หมู่ 2', emoji:['🍚','🍞','🥔','🍠','🍜','🥖','🍙','🥨'], song: SONG[2] },
    3: { label:'หมู่ 3', emoji:['🥦','🥬','🥕','🌽','🥒','🍆','🫛','🍄'], song: SONG[3] },
    4: { label:'หมู่ 4', emoji:['🍎','🍌','🍊','🍉','🍓','🍍','🥭','🍇'], song: SONG[4] },
    5: { label:'หมู่ 5', emoji:['🥑','🫒','🧈','🥥','🧀','🌰','🥜'],      song: SONG[5] }
  };

  const JUNK_EMOJI  = ['🍟','🍔','🍕','🧋','🍩','🍬','🍭'];
  const DECOY_EMOJI = ['🎭','🌀','✨','🌈','🎈'];

  // ---------- Engine State ----------
  const engine = {
    // refs
    layerEl: null,
    camEl: null,

    // runtime
    running: false,
    ended: false,

    runMode: 'play',  // play/research
    diff: 'normal',
    style: 'mix',
    timeSec: 90,
    seed: 'seed',
    rng: Math.random,

    // view feel
    vx: 0, vy: 0, dragOn: false, dragX: 0, dragY: 0,

    // scoreboard
    left: 90,
    score: 0,
    combo: 0,
    comboMax: 0,
    misses: 0,
    hitGood: 0,
    hitAll: 0,

    // group
    groupId: 1,
    groupLabel: 'หมู่ 1',
    groupClean: true,
    cleanStreakMs: 0,

    // power
    power: 0,
    powerThr: 10,

    // spawn/ttl
    ttlMs: 1600,
    sizeBase: 1.0,

    // adaptive (play only)
    adapt: { spawnMs: 780, ttl: 1600, size: 1.0, junkBias: 0.12, decoyBias: 0.10, bossEvery: 18000 },

    // storm
    storm: false,
    stormUntilMs: 0,
    nextStormAtMs: 0,
    stormDurSec: 6,
    stormPattern: 'wave', // wave/spiral/burst
    stormSpawnIdx: 0,

    // boss
    bossAlive: false,
    bossHp: 0,
    bossHpMax: 3,
    nextBossAtMs: 0,

    // boss phase2
    bossPhase: 1,
    bossWeakOpen: false,
    bossWeakUntil: 0,
    bossNextWeakAt: 0,
    bossEl: null,

    // shield
    shield: 0,

    // buffs
    magnetUntil: 0,
    freezeUntil: 0,

    // overdrive
    overCharge: 0,
    overWindowUntil: 0,
    overUntil: 0,

    // no-junk zone
    noJunkRadius: 92,

    // timers
    spawnTimer: 0,
    tickTimer: 0,
  };

  function diffParams(diff) {
    diff = String(diff || 'normal').toLowerCase();
    if (diff === 'easy') return { spawnMs: 900, ttl: 1750, size: 1.05, powerThr: 9,  junk: 0.10, decoy: 0.08, stormDur: 6, bossHp: 3 };
    if (diff === 'hard') return { spawnMs: 680, ttl: 1450, size: 0.92, powerThr: 11, junk: 0.16, decoy: 0.12, stormDur: 7, bossHp: 4 };
    return                 { spawnMs: 780, ttl: 1600, size: 1.00, powerThr: 10, junk: 0.12, decoy: 0.10, stormDur: 6, bossHp: 3 };
  }

  function rankFromAcc(acc) {
    if (acc >= 95) return 'SSS';
    if (acc >= 90) return 'SS';
    if (acc >= 85) return 'S';
    if (acc >= 75) return 'A';
    if (acc >= 60) return 'B';
    return 'C';
  }

  function scoreMult() { return (now() < engine.overUntil) ? 2 : 1; }

  function updateRank() {
    const acc = engine.hitAll > 0 ? Math.round((engine.hitGood / engine.hitAll) * 100) : 0;
    emit('hha:rank', { grade: rankFromAcc(acc), accuracy: acc });
  }
  function updateScore() {
    emit('hha:score', { score: engine.score | 0, combo: engine.combo | 0, comboMax: engine.comboMax | 0, misses: engine.misses | 0 });
    updateRank();
  }
  function updateTime() { emit('hha:time', { left: engine.left | 0 }); }
  function updatePower() { emit('groups:power', { charge: engine.power | 0, threshold: engine.powerThr | 0 }); }

  function setGroup(id, from) {
    engine.groupId = id;
    engine.groupLabel = (GROUPS[id] ? GROUPS[id].label : ('หมู่ ' + id));
    engine.groupClean = true;
    emit('groups:group_change', { groupId: id, label: engine.groupLabel, from: from | 0, songLine: (GROUPS[id] ? GROUPS[id].song : '') });
    // โค้ชพูด “บทห้ามแปลผัน” แบบล็อก
    emit('hha:coach', { mood: 'neutral', text: (GROUPS[id] ? GROUPS[id].song : '') });
  }

  // ---------- Boot setters ----------
  function setLayerEl(el) { engine.layerEl = el || null; }
  function setCameraEl(el) { engine.camEl = el || null; }
  function setTimeLeft(sec) {
    sec = clamp(sec, 20, 600);
    engine.timeSec = sec;
    engine.left = sec;
    updateTime();
  }

  // ---------- VR feel view ----------
  function applyView() {
    const layer = engine.layerEl;
    if (!layer) return;
    layer.style.setProperty('--vx', engine.vx.toFixed(1) + 'px');
    layer.style.setProperty('--vy', engine.vy.toFixed(1) + 'px');
  }

  function setupView() {
    let bound = false;
    function bind() {
      if (bound) return;
      const layer = engine.layerEl;
      if (!layer) return;
      bound = true;

      layer.addEventListener('pointerdown', (e) => {
        engine.dragOn = true; engine.dragX = e.clientX; engine.dragY = e.clientY;
      }, { passive: true });

      root.addEventListener('pointermove', (e) => {
        if (!engine.dragOn) return;
        const dx = e.clientX - engine.dragX;
        const dy = e.clientY - engine.dragY;
        engine.dragX = e.clientX; engine.dragY = e.clientY;
        engine.vx = clamp(engine.vx + dx * 0.22, -90, 90);
        engine.vy = clamp(engine.vy + dy * 0.22, -90, 90);
        applyView();
      }, { passive: true });

      root.addEventListener('pointerup', () => { engine.dragOn = false; }, { passive: true });

      root.addEventListener('deviceorientation', (ev) => {
        const gx = Number(ev.gamma) || 0;
        const gy = Number(ev.beta) || 0;
        engine.vx = clamp(engine.vx + gx * 0.06, -90, 90);
        engine.vy = clamp(engine.vy + (gy - 20) * 0.02, -90, 90);
        applyView();
      }, { passive: true });
    }
    const it = setInterval(() => {
      bind();
      if (bound) clearInterval(it);
    }, 80);
  }

  // ---------- Spawn rect + No-Junk Zone ----------
  function safeSpawnRect() {
    const W = root.innerWidth || 360;
    const H = root.innerHeight || 640;
    const top = 150, bot = 170, side = 16; // กันทับ HUD
    return { x0: side, x1: W - side, y0: top, y1: H - bot, W, H };
  }

  function updateNoJunkZone() {
    const r = safeSpawnRect();
    const cx = r.W * 0.5;
    const cy = (r.y0 + r.y1) * 0.5;

    let base = (engine.diff === 'easy' ? 98 : engine.diff === 'hard' ? 84 : 92);

    if (engine.runMode === 'play') {
      const acc = engine.hitAll > 0 ? (engine.hitGood / engine.hitAll) : 0;
      const heat = clamp((engine.combo / 18) + (acc - 0.65), 0, 1);
      base = clamp(base + heat * 26, 78, 126);
    } else {
      base = clamp(base + (engine.diff === 'hard' ? -6 : engine.diff === 'easy' ? 10 : 0), 72, 120);
    }

    engine.noJunkRadius = base;

    const layer = engine.layerEl;
    if (layer) {
      layer.style.setProperty('--nojunk-cx', cx.toFixed(1) + 'px');
      layer.style.setProperty('--nojunk-cy', cy.toFixed(1) + 'px');
      layer.style.setProperty('--nojunk-r', base.toFixed(1) + 'px');
    }
  }

  function inNoJunkZone(x, y) {
    const r = safeSpawnRect();
    const cx = r.W * 0.5;
    const cy = (r.y0 + r.y1) * 0.5;
    const dx = x - cx;
    const dy = y - cy;
    return (dx * dx + dy * dy) <= (engine.noJunkRadius * engine.noJunkRadius);
  }

  function randPos() {
    const r = safeSpawnRect();
    const x = r.x0 + engine.rng() * (r.x1 - r.x0);
    const y = r.y0 + engine.rng() * (r.y1 - r.y0);
    return { x, y };
  }

  // ---------- Storm pattern positions ----------
  function stormPos() {
    const r = safeSpawnRect();
    const cx = r.W * 0.5;
    const cy = (r.y0 + r.y1) * 0.5;
    const idx = (engine.stormSpawnIdx++);

    const jx = (engine.rng() - 0.5) * 26;
    const jy = (engine.rng() - 0.5) * 22;

    if (engine.stormPattern === 'wave') {
      const t = (idx % 28) / 28;
      const x = r.x0 + t * (r.x1 - r.x0);
      const y = cy + Math.sin((idx * 0.55)) * ((r.y1 - r.y0) * 0.22);
      return { x: clamp(x + jx, r.x0, r.x1), y: clamp(y + jy, r.y0, r.y1) };
    }

    if (engine.stormPattern === 'spiral') {
      const a = idx * 0.62;
      const rad = clamp(28 + idx * 5.0, 28, Math.min(r.x1 - r.x0, r.y1 - r.y0) * 0.40);
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad;
      return { x: clamp(x + jx, r.x0, r.x1), y: clamp(y + jy, r.y0, r.y1) };
    }

    const corners = [
      { x: r.x0 + 26, y: r.y0 + 26 },
      { x: r.x1 - 26, y: r.y0 + 26 },
      { x: r.x0 + 26, y: r.y1 - 26 },
      { x: r.x1 - 26, y: r.y1 - 26 },
      { x: cx, y: r.y0 + 22 },
      { x: cx, y: r.y1 - 22 },
    ];
    const c = corners[(engine.rng() * corners.length) | 0];
    const x = c.x + (engine.rng() - 0.5) * 120;
    const y = c.y + (engine.rng() - 0.5) * 110;
    return { x: clamp(x + jx, r.x0, r.x1), y: clamp(y + jy, r.y0, r.y1) };
  }

  // ---------- DOM target helpers ----------
  function setXY(el, x, y) {
    el.style.setProperty('--x', x.toFixed(1) + 'px');
    el.style.setProperty('--y', y.toFixed(1) + 'px');
    el.dataset._x = String(x);
    el.dataset._y = String(y);
  }
  function getXY(el) {
    const x = Number(el.dataset._x);
    const y = Number(el.dataset._y);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
    const sx = (el.style.getPropertyValue('--x') || '').trim().replace('px', '');
    const sy = (el.style.getPropertyValue('--y') || '').trim().replace('px', '');
    return { x: Number(sx) || 0, y: Number(sy) || 0 };
  }

  function markFreezeDoll(el, ms) {
    if (!el) return;
    el.classList.add('fg-freeze-doll');
    el.dataset.dollUntil = String(now() + (ms | 0));
  }
  function isFreezeDoll(el) {
    const t = Number(el?.dataset?.dollUntil);
    return Number.isFinite(t) && now() < t;
  }
  function cleanupDolls() {
    const layer = engine.layerEl;
    if (!layer) return;
    const list = layer.querySelectorAll('.fg-freeze-doll');
    list.forEach(el => {
      const t = Number(el.dataset.dollUntil);
      if (!Number.isFinite(t) || now() >= t) {
        el.classList.remove('fg-freeze-doll');
        el.dataset.dollUntil = '';
      }
    });
  }

  function makeTarget(type, emoji, x, y, s) {
    const layer = engine.layerEl;
    if (!layer) return null;

    const el = DOC.createElement('div');
    el.className = 'fg-target spawn';
    el.dataset.emoji = emoji || '✨';
    el.dataset.type = type;

    // "วิ้งติดเป้า" (ถ้ามี CSS รองรับจะสวยขึ้น; ไม่มี CSS ก็ไม่พัง)
    el.classList.add('fg-glint');

    if (type === 'good') el.dataset.groupId = String(engine.groupId);

    setXY(el, x, y);
    el.style.setProperty('--s', s.toFixed(3));

    if (type === 'good') el.classList.add('fg-good');
    else if (type === 'wrong') el.classList.add('fg-wrong');
    else if (type === 'junk') el.classList.add('fg-junk');
    else if (type === 'decoy') el.classList.add('fg-decoy');
    else if (type === 'boss') el.classList.add('fg-boss');
    else if (type === 'star') el.classList.add('fg-powerup', 'fg-star');
    else if (type === 'ice')  el.classList.add('fg-powerup', 'fg-ice');

    if (now() < engine.freezeUntil && (type === 'junk' || type === 'decoy' || type === 'wrong')) {
      markFreezeDoll(el, 2000);
    }

    const ttlBase = engine.ttlMs;
    const ttl = engine.storm ? Math.max(850, ttlBase * 0.85) : ttlBase;

    el._ttlTimer = root.setTimeout(() => {
      if (!el.isConnected) return;

      if (type === 'good') {
        engine.misses++; engine.combo = 0; engine.groupClean = false;
        emit('hha:judge', { kind: 'warn', text: 'MISS!' });
        updateScore();
      }
      el.classList.add('out');
      root.setTimeout(() => el.remove(), 220);
    }, ttl);

    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault?.();
      hitTarget(el);
    }, { passive: false });

    return el;
  }

  function removeTarget(el) {
    if (!el) return;
    try { root.clearTimeout(el._ttlTimer); } catch {}
    el.classList.add('hit');
    root.setTimeout(() => el.remove(), 220);
  }

  // ---------- Storm ----------
  function chooseStormPattern() {
    const st = engine.style;
    if (st === 'feel') return 'wave';
    if (st === 'hard') return 'spiral';
    return (engine.rng() < 0.5) ? 'burst' : 'wave';
  }

  function enterStorm() {
    engine.storm = true;
    engine.stormUntilMs = now() + engine.stormDurSec * 1000;
    engine.stormPattern = chooseStormPattern();
    engine.stormSpawnIdx = 0;

    DOC.body.classList.add('groups-storm');
    DOC.body.classList.toggle('groups-storm-wave', engine.stormPattern === 'wave');
    DOC.body.classList.toggle('groups-storm-spiral', engine.stormPattern === 'spiral');
    DOC.body.classList.toggle('groups-storm-burst', engine.stormPattern === 'burst');

    emit('groups:storm', { on: true, durSec: engine.stormDurSec | 0, pattern: engine.stormPattern });

    if (engine.runMode === 'play') {
      engine.adapt.spawnMs = Math.max(420, engine.adapt.spawnMs * 0.78);
      engine.adapt.size = Math.max(0.82, engine.adapt.size * 0.94);
      engine.adapt.junkBias = clamp(engine.adapt.junkBias + 0.05, 0.08, 0.25);
      engine.adapt.decoyBias = clamp(engine.adapt.decoyBias + 0.03, 0.06, 0.22);
    }

    emit('hha:coach', { mood:'neutral', text:`STORM! (${engine.stormPattern.toUpperCase()})` });
  }

  function exitStorm() {
    engine.storm = false;
    engine.stormUntilMs = 0;
    DOC.body.classList.remove('groups-storm', 'groups-storm-urgent', 'groups-storm-wave', 'groups-storm-spiral', 'groups-storm-burst');
    emit('groups:storm', { on: false, durSec: 0 });
  }

  function maybeStormTick() {
    if (!engine.storm) return;
    const leftMs = engine.stormUntilMs - now();
    if (leftMs <= 0) {
      exitStorm();
      engine.nextStormAtMs = now() + (16000 + engine.rng() * 12000);
      return;
    }
    if (leftMs <= 3200) {
      DOC.body.classList.add('groups-storm-urgent');
      SFX.tickStorm(leftMs);
    }
  }

  // ---------- Boss Phase2 ----------
  function bossStyleParams() {
    const st = engine.style;
    if (st === 'hard') return { openMs: 520, gapMs: 820, feintChance: 0.32, wrongPenalty: 'hard' };
    if (st === 'feel') return { openMs: 820, gapMs: 900, feintChance: 0.14, wrongPenalty: 'soft' };
    return                 { openMs: 680, gapMs: 860, feintChance: 0.22, wrongPenalty: 'mix' };
  }

  function bossWeakTick() {
    if (!engine.bossAlive || !engine.bossEl) return;

    if (engine.bossPhase === 1 && engine.bossHp <= Math.ceil(engine.bossHpMax * 0.5)) {
      engine.bossPhase = 2;
      engine.bossNextWeakAt = now() + 420;
      emit('hha:judge', { kind: 'boss', text: 'PHASE 2!' });
      emit('hha:celebrate', { kind: 'goal', title: 'BOSS PHASE 2!' });
    }

    if (engine.bossPhase !== 2) return;

    const P = bossStyleParams();
    const t = now();

    if (engine.bossWeakOpen && t >= engine.bossWeakUntil) {
      engine.bossWeakOpen = false;
      engine.bossEl.classList.remove('fg-boss-weak');
      engine.bossNextWeakAt = t + P.gapMs + engine.rng() * 260;
      return;
    }

    if (!engine.bossWeakOpen && t >= engine.bossNextWeakAt) {
      const doFeint = (engine.rng() < P.feintChance);
      if (doFeint) {
        engine.bossEl.classList.add('fg-boss-feint');
        SFX.bossFeint();
        root.setTimeout(() => {
          if (engine.bossEl) engine.bossEl.classList.remove('fg-boss-feint');
        }, 240);
        engine.bossNextWeakAt = t + 320 + engine.rng() * 260;
        return;
      }

      engine.bossWeakOpen = true;
      engine.bossWeakUntil = t + P.openMs;
      engine.bossEl.classList.add('fg-boss-weak');
      SFX.bossWeak();
      emit('groups:progress', { kind: 'boss_weak_open' });
    }
  }

  function tryBossSpawn() {
    if (engine.bossAlive) return;
    if (now() < engine.nextBossAtMs) return;

    const layer = engine.layerEl;
    if (!layer) return;

    engine.bossAlive = true;
    engine.bossHp = engine.bossHpMax;
    engine.bossPhase = 1;
    engine.bossWeakOpen = false;
    engine.bossWeakUntil = 0;
    engine.bossNextWeakAt = 0;

    const p = engine.storm ? stormPos() : randPos();
    const s = (engine.storm ? 1.22 : 1.35) * engine.sizeBase * ((engine.runMode === 'research') ? 1 : engine.adapt.size);
    const el = makeTarget('boss', '👑', p.x, p.y, s);
    if (!el) return;

    el.dataset.hp = String(engine.bossHp);
    el.dataset.phase = '1';
    el.classList.add('fg-boss-phase1');

    engine.bossEl = el;
    layer.appendChild(el);

    emit('groups:progress', { kind: 'boss_spawn' });
    emit('hha:judge', { kind: 'boss', text: 'BOSS!' });

    engine.nextBossAtMs = now() + (engine.runMode === 'research' ? 20000 : clamp(engine.adapt.bossEvery, 14000, 26000));
  }

  // ---------- Bonuses / power ----------
  function perfectSwitchBonus() {
    if (!engine.groupClean) return;
    const mult = scoreMult();
    engine.score += (300 + Math.min(240, engine.combo * 6)) * mult;
    emit('hha:judge', { kind: 'good', text: 'PERFECT SWITCH!' });
    emit('hha:celebrate', { kind: 'mini', title: 'PERFECT SWITCH!' });
  }

  function switchGroupByPower() {
    perfectSwitchBonus();
    const next = (engine.groupId % 5) + 1;
    setGroup(next, 1);
    emit('groups:progress', { kind: 'group_swap' });

    engine._rushUntil = now() + 6000;
    engine.power = 0;
    updatePower();
  }

  function addPower(n) {
    engine.power = clamp(engine.power + (n | 0), 0, engine.powerThr);
    updatePower();
    if (engine.power >= engine.powerThr) switchGroupByPower();
  }

  function addShieldIfClean() {
    const t = now();
    if (!engine.cleanStreakMs) engine.cleanStreakMs = t;
    if ((t - engine.cleanStreakMs) >= 12000 && engine.shield < 1) {
      engine.shield = 1;
      emit('hha:judge', { kind: 'good', text: 'SHIELD READY!' });
      emit('hha:celebrate', { kind: 'mini', title: 'SHIELD READY!' });
    }
  }

  // ---------- Overdrive ----------
  function activateOverdrive() {
    engine.overUntil = now() + 5000;
    DOC.body.classList.add('groups-overdrive');
    SFX.power();
    emit('hha:celebrate', { kind: 'goal', title: 'OVERDRIVE x2!' });

    root.setTimeout(() => {
      if (now() >= engine.overUntil) DOC.body.classList.remove('groups-overdrive');
    }, 5100);
  }

  function onStarCollected() {
    const t = now();
    if (t > engine.overWindowUntil) {
      engine.overCharge = 0;
      engine.overWindowUntil = t + 8000;
    }
    engine.overCharge++;
    if (engine.overCharge >= 2) {
      engine.overCharge = 0;
      engine.overWindowUntil = 0;
      activateOverdrive();
    }
  }

  // ---------- Buffs ----------
  function activateMagnet() {
    engine.magnetUntil = now() + 6000;
    DOC.body.classList.add('groups-magnet');
    SFX.power();
    emit('hha:judge', { kind: 'good', text: 'MAGNET!' });
    emit('hha:celebrate', { kind: 'mini', title: 'MAGNET ⭐' });
    root.setTimeout(() => {
      if (now() >= engine.magnetUntil) DOC.body.classList.remove('groups-magnet');
    }, 6100);
  }

  function activateFreeze() {
    engine.freezeUntil = now() + 4500;
    DOC.body.classList.add('groups-freeze');
    SFX.power();
    emit('hha:judge', { kind: 'good', text: 'FREEZE!' });
    emit('hha:celebrate', { kind: 'mini', title: 'FREEZE ❄️' });

    const layer = engine.layerEl;
    if (layer) {
      const list = layer.querySelectorAll('.fg-target');
      list.forEach(el => {
        const tp = String(el.dataset.type || '').toLowerCase();
        if (tp === 'junk' || tp === 'decoy' || tp === 'wrong') markFreezeDoll(el, 2000);
      });
    }

    root.setTimeout(() => {
      if (now() >= engine.freezeUntil) DOC.body.classList.remove('groups-freeze');
    }, 4600);
  }

  function magnetPullTick() {
    if (now() >= engine.magnetUntil) return;
    const layer = engine.layerEl;
    if (!layer) return;

    const r = safeSpawnRect();
    const cx = r.W * 0.5;
    const cy = (r.y0 + r.y1) * 0.5;

    const list = layer.querySelectorAll('.fg-target.fg-good');
    list.forEach(el => {
      const gid = Number(el.dataset.groupId) || 0;
      if (gid !== engine.groupId) return;
      const p = getXY(el);
      const nx = p.x + (cx - p.x) * 0.040;
      const ny = p.y + (cy - p.y) * 0.040;
      setXY(el, nx, ny);
    });
  }

  // ---------- Hit logic ----------
  function hitBoss(el) {
    engine.hitAll++;
    engine.combo = clamp(engine.combo + 1, 0, 9999);
    engine.comboMax = Math.max(engine.comboMax, engine.combo);

    if (engine.bossPhase === 2 && !engine.bossWeakOpen) {
      const P = bossStyleParams();
      const mult = scoreMult();

      if (P.wrongPenalty === 'soft') {
        engine.score += 60 * mult;
        emit('hha:judge', { kind: 'boss', text: 'TOO EARLY!' });
      } else {
        engine.misses++;
        engine.combo = 0;
        engine.groupClean = false;
        engine.cleanStreakMs = 0;

        engine.power = clamp(engine.power - 2, 0, engine.powerThr);
        updatePower();

        emit('hha:judge', { kind: 'bad', text: 'FEINT! 😵' });
        SFX.bad();
      }

      updateScore();
      el.classList.add('fg-boss-hurt');
      root.setTimeout(() => el.classList.remove('fg-boss-hurt'), 220);
      return;
    }

    let dmg = 1;
    if (engine.bossPhase === 2 && engine.bossWeakOpen) {
      dmg = (engine.style === 'hard') ? 2 : 1;
      el.classList.add('fg-boss-crit');
      root.setTimeout(() => el.classList.remove('fg-boss-crit'), 220);
      emit('hha:judge', { kind: 'boss', text: (dmg > 1 ? 'CRIT!' : 'HIT!') });
    } else {
      emit('hha:judge', { kind: 'boss', text: 'HIT!' });
    }

    engine.bossHp = Math.max(0, engine.bossHp - dmg);
    el.dataset.hp = String(engine.bossHp);

    const mult = scoreMult();
    const rush = (engine._rushUntil && now() < engine._rushUntil) ? 1.5 : 1.0;
    engine.score += Math.round((140 + engine.combo * 2) * rush * mult * (dmg > 1 ? 1.25 : 1));

    if (engine.bossHp <= 0) {
      engine.bossAlive = false;
      engine.bossEl = null;
      emit('hha:judge', { kind: 'boss', text: 'BOSS DOWN!' });
      emit('groups:progress', { kind: 'boss_down' });
      emit('hha:celebrate', { kind: 'goal', title: 'BOSS DOWN!' });

      engine.power = clamp(engine.power + 4, 0, engine.powerThr);
      engine.shield = 1;
      updatePower();

      removeTarget(el);
      updateScore();
    } else {
      el.classList.add('fg-boss-hurt');
      root.setTimeout(() => el.classList.remove('fg-boss-hurt'), 220);
      updateScore();
    }
  }

  function hitTarget(el) {
    if (!engine.running || engine.ended) return;
    if (!el || !el.isConnected) return;

    let type = String(el.dataset.type || '').toLowerCase();

    if (type === 'star') {
      engine.hitAll++;
      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);

      const mult = scoreMult();
      engine.score += 120 * mult;

      activateMagnet();
      onStarCollected();

      updateScore();
      removeTarget(el);
      return;
    }

    if (type === 'ice') {
      engine.hitAll++;
      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);

      const mult = scoreMult();
      engine.score += 120 * mult;

      activateFreeze();

      updateScore();
      removeTarget(el);
      return;
    }

    if (type === 'boss') { hitBoss(el); return; }

    if (type === 'good') {
      const gid = Number(el.dataset.groupId) || 0;
      if (gid && gid !== engine.groupId) type = 'wrong';
    }

    engine.hitAll++;

    if (type === 'good') {
      engine.hitGood++;
      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);

      const mult = scoreMult();
      const rush = (engine._rushUntil && now() < engine._rushUntil) ? 1.5 : 1.0;
      engine.score += Math.round((100 + engine.combo * 3) * rush * mult);

      addPower(engine.storm ? 2 : 1);
      addShieldIfClean();

      emit('hha:judge', { kind: 'good', text: (mult > 1 ? 'OVER x2!' : 'GOOD!') });
      SFX.good();
      updateScore();
      removeTarget(el);
      return;
    }

    const badLike = (type === 'junk' || type === 'wrong' || type === 'decoy');
    if (badLike) {
      if (isFreezeDoll(el) || (now() < engine.freezeUntil && (type === 'junk' || type === 'decoy' || type === 'wrong'))) {
        engine.combo = clamp(engine.combo + 1, 0, 9999);
        engine.comboMax = Math.max(engine.comboMax, engine.combo);

        const mult = scoreMult();
        engine.score += 40 * mult;

        emit('hha:judge', { kind: 'good', text: 'POOF!' });
        updateScore();
        removeTarget(el);
        return;
      }

      if (type === 'junk' && engine.shield > 0) {
        engine.shield = 0;
        engine.combo = Math.max(0, engine.combo - 1);
        emit('hha:judge', { kind: 'good', text: 'SHIELD BLOCK!' });
        updateScore();
        removeTarget(el);
        return;
      }

      engine.misses++;
      engine.combo = 0;
      engine.groupClean = false;
      engine.cleanStreakMs = 0;

      engine.power = clamp(engine.power - (type === 'junk' ? 3 : 2), 0, engine.powerThr);
      updatePower();

      emit('hha:judge', { kind: 'bad', text: (type === 'junk' ? 'JUNK!' : 'WRONG!') });
      SFX.bad();

      if (engine.storm && engine.style !== 'feel') engine.stormUntilMs += 650;

      updateScore();
      removeTarget(el);
      return;
    }
  }

  // ---------- Spawn choose ----------
  function chooseType() {
    const freezing = now() < engine.freezeUntil;

    const baseJ = (engine.runMode === 'research') ? diffParams(engine.diff).junk : engine.adapt.junkBias;
    const baseD = (engine.runMode === 'research') ? diffParams(engine.diff).decoy : engine.adapt.decoyBias;

    let j = clamp(baseJ + (engine.storm ? 0.05 : 0), 0.06, 0.30);
    let d = clamp(baseD + (engine.storm ? 0.03 : 0), 0.05, 0.25);

    if (freezing) {
      j = Math.max(0.03, j * 0.35);
      d = Math.max(0.03, d * 0.35);
    }

    const pu = engine.storm ? 0.018 : 0.012;
    if (engine.rng() < pu) return (engine.rng() < 0.5) ? 'star' : 'ice';

    const r = engine.rng();
    if (r < j) return 'junk';
    if (r < j + d) return 'decoy';

    const w = engine.storm ? 0.18 : 0.14;
    if (engine.rng() < w) return 'wrong';

    return 'good';
  }

  function chooseEmoji(type) {
    if (type === 'junk') return pick(engine.rng, JUNK_EMOJI);
    if (type === 'decoy') return pick(engine.rng, DECOY_EMOJI);
    if (type === 'star') return '⭐';
    if (type === 'ice')  return '❄️';
    if (type === 'good') return pick(engine.rng, GROUPS[engine.groupId].emoji);

    const other = [];
    for (let g = 1; g <= 5; g++) {
      if (g === engine.groupId) continue;
      other.push(...GROUPS[g].emoji);
    }
    return pick(engine.rng, other);
  }

  function pickSpawnPosForType(tp) {
    updateNoJunkZone();
    const avoid = (tp === 'junk' || tp === 'decoy' || tp === 'wrong');
    const maxTry = 10;

    for (let i = 0; i < maxTry; i++) {
      const p = engine.storm ? stormPos() : randPos();
      if (!avoid) return p;
      if (!inNoJunkZone(p.x, p.y)) return p;
    }

    const r = safeSpawnRect();
    const edge = (engine.rng() < 0.5)
      ? { x: (engine.rng() < 0.5 ? r.x0 + 22 : r.x1 - 22), y: r.y0 + engine.rng() * (r.y1 - r.y0) }
      : { x: r.x0 + engine.rng() * (r.x1 - r.x0), y: (engine.rng() < 0.5 ? r.y0 + 22 : r.y1 - 22) };
    return edge;
  }

  function spawnOne() {
    if (!engine.running || engine.ended) return;
    const layer = engine.layerEl;
    if (!layer) return;

    tryBossSpawn();

    const tp = chooseType();
    const em = chooseEmoji(tp);
    const p = pickSpawnPosForType(tp);

    const base = (engine.runMode === 'research') ? diffParams(engine.diff) : engine.adapt;
    const stormScale = engine.storm ? 0.92 : 1.0;

    let size = engine.sizeBase * base.size * stormScale;
    if (tp === 'junk') size *= 0.95;
    if (tp === 'star' || tp === 'ice') size *= 0.98;

    const el = makeTarget(tp, em, p.x, p.y, size);
    if (el) layer.appendChild(el);
  }

  function loopSpawn() {
    if (!engine.running || engine.ended) return;

    spawnOne();

    const base = (engine.runMode === 'research') ? diffParams(engine.diff) : engine.adapt;
    let sMs = Math.max(420, base.spawnMs * (engine.storm ? 0.82 : 1.0));
    if (now() < engine.freezeUntil) sMs = sMs * 1.22;

    engine.spawnTimer = root.setTimeout(loopSpawn, sMs);
  }

  // ---------- Tick ----------
  function loopTick() {
    if (!engine.running || engine.ended) return;

    if (!engine.storm && now() >= engine.nextStormAtMs) enterStorm();
    if (engine.storm) maybeStormTick();

    bossWeakTick();

    magnetPullTick();
    cleanupDolls();

    if (engine.runMode === 'play') {
      const acc = engine.hitAll > 0 ? (engine.hitGood / engine.hitAll) : 0;
      const heat = clamp((engine.combo / 18) + (acc - 0.65), 0, 1);

      engine.adapt.spawnMs = clamp(820 - heat * 260, 480, 880);
      engine.adapt.ttl     = clamp(1680 - heat * 260, 1250, 1750);
      engine.ttlMs = engine.adapt.ttl;
      engine.adapt.size    = clamp(1.02 - heat * 0.10, 0.86, 1.05);

      engine.adapt.junkBias = clamp(0.11 + heat * 0.06, 0.08, 0.22);
      engine.adapt.decoyBias= clamp(0.09 + heat * 0.05, 0.06, 0.20);
      engine.adapt.bossEvery= clamp(20000 - heat * 6000, 14000, 22000);
    } else {
      engine.ttlMs = diffParams(engine.diff).ttl;
    }

    engine.left = Math.max(0, engine.left - 0.14);
    updateTime();
    if (engine.left <= 0) { endGame('time'); return; }

    engine.tickTimer = root.setTimeout(loopTick, 140);
  }

  function clearAllTargets() {
    const layer = engine.layerEl;
    if (!layer) return;
    const list = layer.querySelectorAll('.fg-target');
    list.forEach(el => {
      try { root.clearTimeout(el._ttlTimer); } catch {}
      el.remove();
    });
  }

  function endGame(reason) {
    if (engine.ended) return;
    engine.ended = true;
    engine.running = false;

    DOC.body.classList.remove(
      'groups-storm','groups-storm-urgent','groups-storm-wave','groups-storm-spiral','groups-storm-burst',
      'groups-magnet','groups-freeze','groups-overdrive'
    );

    try { root.clearTimeout(engine.spawnTimer); } catch {}
    try { root.clearTimeout(engine.tickTimer); } catch {}
    clearAllTargets();

    const acc = engine.hitAll > 0 ? Math.round((engine.hitGood / engine.hitAll) * 100) : 0;
    const grade = rankFromAcc(acc);

    let q = null;
    try { q = (NS.QuestDirector && NS.QuestDirector.getState) ? NS.QuestDirector.getState() : null; } catch {}

    const detail = {
      reason: reason || 'end',
      scoreFinal: engine.score | 0,
      comboMax: engine.comboMax | 0,
      misses: engine.misses | 0,
      accuracyGoodPct: acc | 0,
      grade,
      goalsCleared: q ? (q.goalsCleared | 0) : 0,
      goalsTotal:   q ? (q.goalsTotal | 0)   : 0,
      miniCleared:  q ? (q.miniCleared | 0)  : 0,
      miniTotal:    q ? (q.miniTotal | 0)    : 0,
      nHitGood: engine.hitGood | 0,
      nHitAll:  engine.hitAll | 0,
      powerThr: engine.powerThr | 0,
      diff: engine.diff,
      runMode: engine.runMode,
      style: engine.style,
      seed: engine.seed
    };

    emit('hha:end', detail);
  }

  // ---------- Public API ----------
  function start(diff, cfg) {
    cfg = cfg || {};
    engine.runMode = (String(cfg.runMode || 'play').toLowerCase() === 'research') ? 'research' : 'play';
    engine.diff = String(diff || cfg.diff || qs('diff', 'normal')).toLowerCase();
    engine.style = styleNorm(cfg.style || qs('style', 'mix'));

    // ✅ สำคัญ: ถ้า Boot เรียก setTimeLeft() มาก่อน ให้ respect engine.timeSec
    const timeFromCfg = (cfg.time != null) ? Number(cfg.time) : null;
    const timeFromQS  = Number(qs('time', 90));
    const baseTime    = Number.isFinite(engine.timeSec) ? engine.timeSec : 90;
    const chosenTime  = Number.isFinite(timeFromCfg) ? timeFromCfg : (Number.isFinite(baseTime) ? baseTime : timeFromQS);

    engine.timeSec = clamp(chosenTime, 30, 180);
    engine.seed = String(cfg.seed || qs('seed', String(Date.now())));
    engine.rng = makeRng(engine.seed);

    // SFX: will work after user gesture; harmless if blocked
    SFX.ensure();

    const dp = diffParams(engine.diff);

    engine.running = true;
    engine.ended = false;

    engine.left = engine.timeSec;
    engine.score = 0; engine.combo = 0; engine.comboMax = 0; engine.misses = 0;
    engine.hitGood = 0; engine.hitAll = 0;

    engine.powerThr = dp.powerThr;
    engine.power = 0;

    engine.sizeBase = dp.size;
    engine.ttlMs = dp.ttl;

    engine.storm = false;
    engine.stormDurSec = dp.stormDur;
    engine.nextStormAtMs = now() + (12000 + engine.rng() * 11000);
    engine.stormPattern = (engine.style === 'hard' ? 'spiral' : engine.style === 'feel' ? 'wave' : 'burst');
    engine.stormSpawnIdx = 0;

    engine.bossAlive = false;
    engine.bossHpMax = dp.bossHp;
    engine.nextBossAtMs = now() + 14000;
    engine.bossPhase = 1;
    engine.bossWeakOpen = false;
    engine.bossEl = null;

    engine.groupId = 1;
    engine.groupClean = true;
    engine.cleanStreakMs = now();
    engine.shield = 0;

    engine.magnetUntil = 0;
    engine.freezeUntil = 0;

    engine.overCharge = 0;
    engine.overWindowUntil = 0;
    engine.overUntil = 0;

    engine.adapt.spawnMs = dp.spawnMs;
    engine.adapt.ttl = dp.ttl;
    engine.adapt.size = dp.size;
    engine.adapt.junkBias = dp.junk;
    engine.adapt.decoyBias = dp.decoy;
    engine.adapt.bossEvery = 18000;

    engine.vx = 0; engine.vy = 0;
    applyView();

    setGroup(1, 0);

    updateNoJunkZone();

    updateTime();
    updatePower();
    updateScore();

    emit('hha:coach', { mood:'happy', text: SONG[0] });

    loopSpawn();
    loopTick();
  }

  function stop(reason) {
    endGame(reason || 'stop');
  }

  function getState() {
    return {
      running: !!engine.running,
      ended: !!engine.ended,
      runMode: engine.runMode,
      diff: engine.diff,
      style: engine.style,
      seed: engine.seed,
      left: engine.left | 0,
      score: engine.score | 0,
      combo: engine.combo | 0,
      comboMax: engine.comboMax | 0,
      misses: engine.misses | 0,
      hitGood: engine.hitGood | 0,
      hitAll: engine.hitAll | 0,
      groupId: engine.groupId | 0,
      power: engine.power | 0,
      powerThr: engine.powerThr | 0,
      storm: !!engine.storm,
      stormPattern: engine.stormPattern,
      bossAlive: !!engine.bossAlive,
      bossHp: engine.bossHp | 0,
      bossHpMax: engine.bossHpMax | 0,
      bossPhase: engine.bossPhase | 0,
      noJunkRadius: engine.noJunkRadius | 0
    };
  }

  // expose (Boot-safe)
  NS.GameEngine = {
    start, stop,
    setLayerEl, setCameraEl, setTimeLeft,
    getState
  };

  // init view binder (bind after layer is set)
  setupView();

})(typeof window !== 'undefined' ? window : globalThis);
