/* === /herohealth/plate-vr/plate.safe.js ===
Balanced Plate VR — SAFE (PRODUCTION) — HHA Standard (FULL + FLUSH)
✅ IIFE (no export/import) — fixes “Unexpected token 'export'”
✅ No stray catch — fixes “Unexpected token 'catch'”
✅ Goals sequential (3 goals) + minis chain (equalized bag)
✅ Goal3 requires Accuracy ≥ 88% at completion
✅ Plate Rush mini: “ครบ 5 ภายใน 8 วิ” + “ห้ามโดนขยะระหว่างทำ”
✅ VR-feel: drag + gyro => layer translate(vx,vy) and targets move with view
✅ Clamp safe-zone (no overlap HUD top/bottom/left/right)
✅ Fever -> Shield (blocks 1 junk hit; guarded junk does NOT count miss)
✅ Miss = good expired + junk hit (ONLY if not blocked by shield)
✅ End Summary overlay reuse (#endOverlay IDs) + Back HUB + localStorage(HHA_LAST_SUMMARY)
✅ Flush-hardened: before HUB / end / pagehide / visibilitychange / beforeunload
*/

(function (root) {
  'use strict';

  // -------------------- guards --------------------
  var DOC = root.document;
  if (!DOC) return;

  var layer = DOC.getElementById('plate-layer') || DOC.querySelector('.plate-layer') || DOC.getElementById('plateLayer');
  if (!layer) return;

  // -------------------- helpers --------------------
  function now() { return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }
  function clamp(v, a, b) { v = Number(v); if (!isFinite(v)) v = 0; return v < a ? a : (v > b ? b : v); }
  function int(v, d) { var n = parseInt(v, 10); return isFinite(n) ? n : d; }
  function str(v, d) { return (v === undefined || v === null) ? (d || '') : String(v); }

  function emit(name, detail) {
    try { root.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (e) {}
  }

  function qs(name, def) {
    try {
      var u = new URL(root.location.href);
      var v = u.searchParams.get(name);
      return (v === null || v === undefined) ? def : v;
    } catch (e) { return def; }
  }

  // -------------------- seeded RNG --------------------
  function xmur3(str0) {
    var str1 = String(str0 || 'seed');
    var h = 1779033703 ^ str1.length;
    for (var i = 0; i < str1.length; i++) {
      h = Math.imul(h ^ str1.charCodeAt(i), 3432918353);
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
      var t = (a + b) | 0;
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
    var gen = xmur3(seed);
    return sfc32(gen(), gen(), gen(), gen());
  }

  function pick(rng, arr) {
    if (!arr || !arr.length) return '';
    return arr[(rng() * arr.length) | 0];
  }

  function shuffleInPlace(rng, arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = (rng() * (i + 1)) | 0;
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // -------------------- external modules (optional) --------------------
  var Particles =
    (root.GAME_MODULES && root.GAME_MODULES.Particles) ||
    root.Particles ||
    { scorePop: function () {}, burstAt: function () {}, celebrate: function () {} };

  var FeverUI =
    (root.GAME_MODULES && root.GAME_MODULES.FeverUI) ||
    root.FeverUI ||
    null;

  // -------------------- logger wrapper (event schema-ready) --------------------
  function logEvent(type, data) {
    // Cloud logger compatible: {type:'spawn'|'hit'|'miss_expire'|'shield_block'|... , data:{...}}
    emit('hha:log_event', { type: type, data: data || {} });
  }

  function tryFlush(reason) {
    // best-effort flush across possible logger implementations
    try { emit('hha:flush', { reason: reason || 'flush' }); } catch (e) {}
    try {
      if (root.HHACloudLogger && typeof root.HHACloudLogger.flush === 'function') root.HHACloudLogger.flush(reason || 'flush');
    } catch (e1) {}
    try {
      if (root.HHA_LOGGER && typeof root.HHA_LOGGER.flush === 'function') root.HHA_LOGGER.flush(reason || 'flush');
    } catch (e2) {}
    try {
      if (root.hhaCloudLogger && typeof root.hhaCloudLogger.flush === 'function') root.hhaCloudLogger.flush(reason || 'flush');
    } catch (e3) {}
  }

  // -------------------- content (foods) --------------------
  var FOODS = {
    veg:  ['🥦','🥬','🥕','🌽','🥒','🍆','🍅','🫑'],
    carb: ['🍚','🍞','🥖','🍜','🥔','🍠','🥨','🥞'],
    prot: ['🍗','🐟','🥚','🥛','🫘','🥜','🧀','🍤'],
    fruit:['🍎','🍌','🍊','🍉','🍓','🍍','🥝','🍇']
  };
  var JUNK = ['🍟','🍔','🍕','🧋','🍩','🍬','🍭','🍫'];

  // -------------------- difficulty --------------------
  function diffParams(diff) {
    diff = String(diff || 'normal').toLowerCase();
    if (diff === 'easy') {
      return { spawnMs: 860, ttlMs: 1750, size: 1.06, junkBias: 0.12, fruitBias: 0.10 };
    }
    if (diff === 'hard') {
      return { spawnMs: 660, ttlMs: 1450, size: 0.92, junkBias: 0.20, fruitBias: 0.08 };
    }
    return { spawnMs: 760, ttlMs: 1600, size: 1.00, junkBias: 0.16, fruitBias: 0.09 };
  }

  // -------------------- safe-zone (avoid HUD) --------------------
  function envPx(name) {
    try {
      var v = getComputedStyle(DOC.documentElement).getPropertyValue(name);
      v = String(v || '').trim();
      if (!v) return 0;
      if (v.indexOf('px') >= 0) return Number(v.replace('px', '')) || 0;
      return Number(v) || 0;
    } catch (e) { return 0; }
  }

  function safeRect() {
    var W = root.innerWidth || 360;
    var H = root.innerHeight || 640;

    // tuned to your HUD layout (top grid) + bottom safe
    var sat = envPx('--sat') || 0;
    var sab = envPx('--sab') || 0;
    var sal = envPx('--sal') || 0;
    var sar = envPx('--sar') || 0;

    var topPad = 170 + sat;   // keep away from hud-top
    var botPad = 190 + sab;   // keep away from any bottom overlay zone
    var sidePad = 16;

    // if screen is tight, relax pads a bit
    if (H < 680) { topPad = 150 + sat; botPad = 170 + sab; }
    if (H < 600) { topPad = 135 + sat; botPad = 155 + sab; }

    var x0 = sidePad + sal;
    var x1 = W - sidePad - sar;
    var y0 = topPad;
    var y1 = H - botPad;

    // final clamp to ensure minimum area
    if ((x1 - x0) < 240) {
      var midx = W * 0.5;
      x0 = clamp(midx - 120, 0, W);
      x1 = clamp(midx + 120, 0, W);
    }
    if ((y1 - y0) < 260) {
      var midy = H * 0.56;
      y0 = clamp(midy - 130, 0, H);
      y1 = clamp(midy + 130, 0, H);
    }

    return { W: W, H: H, x0: x0, x1: x1, y0: y0, y1: y1 };
  }

  function randPos(rng) {
    var r = safeRect();
    var x = r.x0 + rng() * (r.x1 - r.x0);
    var y = r.y0 + rng() * (r.y1 - r.y0);
    return { x: x, y: y };
  }

  // -------------------- engine state --------------------
  var engine = {
    running: false,
    ended: false,

    runMode: 'play',
    diff: 'normal',
    timeSec: 90,
    seed: 'seed',
    rng: Math.random,

    // vr feel view shift
    vx: 0, vy: 0,
    dragOn: false, dragX: 0, dragY: 0,

    // gameplay
    left: 90,
    score: 0,
    combo: 0,
    comboMax: 0,
    misses: 0,

    nHitGood: 0,
    nHitBad: 0,
    nExpireGood: 0,
    nSpawnGood: 0,
    nSpawnJunk: 0,
    nSpawnFruit: 0,

    // fever/shield
    fever: 0,          // 0..1
    shield: 0,         // 0/1

    // plate fill (8 units: veg4 prot2 carb2) => resets when complete
    fillVeg: 0,
    fillProt: 0,
    fillCarb: 0,

    // pacing
    spawnMs: 760,
    ttlMs: 1600,
    size: 1.0,
    junkBias: 0.16,
    fruitBias: 0.09,

    // adaptive (play only)
    adapt: {
      spawnMs: 760,
      ttlMs: 1600,
      size: 1.0,
      junkBias: 0.16,
      fruitBias: 0.09
    },

    // quests
    goalIndex: 0,
    goalsCleared: 0,
    goalsTotal: 3,

    miniActive: null,
    miniCleared: 0,
    miniTotal: 999, // chain

    miniBag: [],
    miniBagIndex: 0,

    // timers
    spawnTimer: 0,
    tickTimer: 0,

    // plate rush constraints
    rushNoJunk: true
  };

  // -------------------- rank --------------------
  function rankFromAcc(acc) {
    if (acc >= 95) return 'SSS';
    if (acc >= 90) return 'SS';
    if (acc >= 85) return 'S';
    if (acc >= 75) return 'A';
    if (acc >= 60) return 'B';
    return 'C';
  }

  function accuracyPct() {
    var tot = engine.nHitGood + engine.nHitBad;
    if (tot <= 0) return 0;
    return Math.round((engine.nHitGood / tot) * 100);
  }

  function updateScore() {
    emit('hha:score', {
      score: engine.score | 0,
      combo: engine.combo | 0,
      comboMax: engine.comboMax | 0,
      misses: engine.misses | 0
    });
    emit('hha:rank', { grade: rankFromAcc(accuracyPct()), accuracy: accuracyPct() });
  }

  function updateTime() { emit('hha:time', { left: engine.left | 0 }); }

  function updateQuestUI() {
    var g = currentGoal();
    var m = engine.miniActive;

    emit('quest:update', {
      goalTitle: g.title,
      goalNow: g.now,
      goalTotal: g.total,
      miniTitle: m ? m.title : '—',
      miniNow: m ? m.now : 0,
      miniTotal: m ? m.total : 0,
      miniLeftMs: m ? Math.max(0, (m.untilMs || 0) - now()) : 0
    });
  }

  // -------------------- concept 1-5 => goals & minis --------------------
  // Concept 1: รู้สัดส่วนจาน (เติมครบตามสัดส่วน)
  // Concept 2: เลี่ยงขยะ (junk)
  // Concept 3: สร้าง streak -> FEVER -> Shield
  // Concept 4: ความเร็ว (Plate Rush)
  // Concept 5: ความแม่นยำ/ความสม่ำเสมอ (Goal3 >= 88% + minis equalized)

  function goalDefs() {
    return [
      { id: 'g1', title: 'GOAL 1: เติมจานให้ครบ 1 ครั้ง 🍽️', needPlates: 1 },
      { id: 'g2', title: 'GOAL 2: เติมจานให้ครบ 2 ครั้ง ⚡', needPlates: 2 },
      { id: 'g3', title: 'GOAL 3: เติมครบ 3 ครั้ง + ACC ≥ 88% 🎯', needPlates: 3, needAcc: 88 }
    ];
  }

  function currentGoal() {
    var defs = goalDefs();
    var idx = clamp(engine.goalIndex, 0, defs.length - 1) | 0;
    var def = defs[idx];

    return {
      id: def.id,
      title: def.title,
      now: engine.goalsCleared,
      total: engine.goalsTotal,
      needPlates: def.needPlates,
      needAcc: def.needAcc || 0
    };
  }

  // -------------------- minis (equalized bag) --------------------
  var MINI_DEFS = [
    {
      id: 'plate_rush',
      title: 'MINI: Plate Rush ⚡ (ครบ 5 ใน 8 วิ + ห้ามโดนขยะ)',
      total: 5,
      durMs: 8000,
      onStart: function () { engine.rushNoJunk = true; },
      onGood: function (m) { m.now++; },
      onBad: function (m) { engine.rushNoJunk = false; },
      check: function (m) { return (m.now >= m.total) && engine.rushNoJunk; }
    },
    {
      id: 'clean_streak',
      title: 'MINI: Clean Streak ✨ (ยิงดีติดกัน 8)',
      total: 8,
      durMs: 0,
      onStart: function () {},
      onGood: function (m) { m.now++; },
      onBad: function (m) { m.now = 0; },
      check: function (m) { return (m.now >= m.total); }
    },
    {
      id: 'no_junk_zone',
      title: 'MINI: No-Junk Zone 🛡️ (รอด 10 วิไม่โดนขยะ)',
      total: 1,
      durMs: 10000,
      onStart: function () {},
      onGood: function () {},
      onBad: function () {},
      check: function (m) {
        // pass only if time reached and no junk hit flagged by rushNoJunk
        return (now() >= m.untilMs) && engine.rushNoJunk;
      }
    },
    {
      id: 'mix_three',
      title: 'MINI: Mix 3 Types 🥗 (เก็บ 3 หมวดภายใน 6 วิ)',
      total: 3,
      durMs: 6000,
      onStart: function (m) { m._seen = {}; },
      onGood: function (m, meta) {
        if (!meta || !meta.foodKind) return;
        if (!m._seen[meta.foodKind]) { m._seen[meta.foodKind] = 1; m.now++; }
      },
      onBad: function () {},
      check: function (m) { return m.now >= m.total; }
    },
    {
      id: 'fever_build',
      title: 'MINI: Build Fever 🔥 (ทำ FEVER ให้เต็ม 1 ครั้ง)',
      total: 1,
      durMs: 0,
      onStart: function () {},
      onGood: function () {},
      onBad: function () {},
      check: function () { return engine.shield > 0; } // shield is granted at fever full
    }
  ];

  function refillMiniBag() {
    engine.miniBag = [];
    for (var i = 0; i < MINI_DEFS.length; i++) engine.miniBag.push(MINI_DEFS[i].id);
    shuffleInPlace(engine.rng, engine.miniBag);
    engine.miniBagIndex = 0;
  }

  function nextMiniId() {
    if (!engine.miniBag || engine.miniBagIndex >= engine.miniBag.length) refillMiniBag();
    var id = engine.miniBag[engine.miniBagIndex];
    engine.miniBagIndex++;
    return id;
  }

  function startMini() {
    var id = nextMiniId();
    var def = null;
    for (var i = 0; i < MINI_DEFS.length; i++) { if (MINI_DEFS[i].id === id) { def = MINI_DEFS[i]; break; } }
    if (!def) def = MINI_DEFS[0];

    var m = {
      id: def.id,
      title: def.title,
      total: def.total,
      now: 0,
      startMs: now(),
      untilMs: def.durMs ? (now() + def.durMs) : 0,
      def: def
    };

    // for time-based minis, default "no junk" style flag
    if (def.id === 'no_junk_zone' || def.id === 'plate_rush') engine.rushNoJunk = true;

    try { if (def.onStart) def.onStart(m); } catch (e) {}
    engine.miniActive = m;
    updateQuestUI();

    // urgent ticking / fx near end for timed minis
    if (def.durMs) {
      emit('hha:judge', { kind: 'mini', text: 'MINI START!' });
      emit('hha:celebrate', { kind: 'mini', title: 'MINI START!' });
    }
  }

  function miniFailIfTimedOut() {
    var m = engine.miniActive;
    if (!m) return;
    if (m.untilMs && now() >= m.untilMs) {
      // pass/fail check for timed minis
      var ok = false;
      try { ok = !!m.def.check(m); } catch (e) { ok = false; }

      if (ok) return; // will be cleared by checkMini

      // fail
      emit('hha:judge', { kind: 'warn', text: 'MINI FAIL!' });
      engine.miniActive = null;
      startMini();
    }
  }

  function checkMini() {
    var m = engine.miniActive;
    if (!m) return;

    var ok = false;
    try { ok = !!m.def.check(m); } catch (e) { ok = false; }

    if (ok) {
      engine.miniCleared++;
      emit('hha:judge', { kind: 'good', text: 'MINI CLEAR!' });
      emit('hha:celebrate', { kind: 'mini', title: 'MINI CLEAR!' });

      // small reward
      engine.score += 220 + Math.min(220, engine.combo * 4);
      updateScore();

      engine.miniActive = null;
      startMini();
    } else {
      updateQuestUI();
    }
  }

  // -------------------- plate completion logic --------------------
  // 8 slots: veg 4, prot 2, carb 2
  function plateIsComplete() {
    return engine.fillVeg >= 4 && engine.fillProt >= 2 && engine.fillCarb >= 2;
  }

  function resetPlateFill() {
    engine.fillVeg = 0;
    engine.fillProt = 0;
    engine.fillCarb = 0;
  }

  function onPlateComplete() {
    // treat as "plate cleared"
    var acc = accuracyPct();
    var g = currentGoal();

    // goal progress is "plates cleared" but we store as goalsCleared (0..3)
    // Goal1: reach 1, Goal2: reach 2, Goal3: reach 3 AND acc>=88 at moment of clearing 3rd
    var targetPlates = g.needPlates;

    // increment attempt
    var nextCount = engine.goalsCleared + 1;

    if (g.needAcc && nextCount >= 3 && acc < g.needAcc) {
      // block Goal3 if accuracy too low
      emit('hha:judge', { kind: 'warn', text: 'ACC < ' + g.needAcc + '% — ลองใหม่!' });
      emit('hha:celebrate', { kind: 'mini', title: 'KEEP ACC ≥ ' + g.needAcc + '%!' });

      // still reward plate completion but do not advance goalsCleared to 3
      engine.score += 260;
      updateScore();
      resetPlateFill();
      updateQuestUI();
      return;
    }

    // advance goal counter
    engine.goalsCleared = nextCount;

    emit('hha:judge', { kind: 'good', text: 'PLATE COMPLETE!' });
    emit('hha:celebrate', { kind: 'goal', title: 'PLATE COMPLETE!' });

    // big reward
    engine.score += 520 + Math.min(320, engine.combo * 6);
    updateScore();

    resetPlateFill();

    // move goalIndex forward
    engine.goalIndex = clamp(engine.goalsCleared, 0, engine.goalsTotal - 1) | 0;

    if (engine.goalsCleared >= engine.goalsTotal) {
      // all goals complete => end early
      endGame('all_goals');
      return;
    }

    updateQuestUI();
  }

  // -------------------- DOM target system --------------------
  function setXY(el, x, y) {
    el.style.left = x.toFixed(1) + 'px';
    el.style.top = y.toFixed(1) + 'px';
    el.dataset._x = String(x);
    el.dataset._y = String(y);
  }

  function getXY(el) {
    var x = Number(el.dataset._x);
    var y = Number(el.dataset._y);
    if (isFinite(x) && isFinite(y)) return { x: x, y: y };
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function makeTarget(kind, emoji, x, y, scale, meta) {
    var el = DOC.createElement('div');
    el.className = 'plate-target';
    el.style.position = 'absolute';
    el.style.transform = 'translate(-50%,-50%) scale(' + scale.toFixed(3) + ')';
    el.style.userSelect = 'none';
    el.style.webkitUserSelect = 'none';
    el.style.touchAction = 'none';
    el.style.cursor = 'pointer';

    // visuals (simple, keep consistent with your CSS theme)
    el.style.width = '64px';
    el.style.height = '64px';
    el.style.borderRadius = '999px';
    el.style.display = 'grid';
    el.style.placeItems = 'center';
    el.style.fontSize = '34px';
    el.style.fontWeight = '900';
    el.style.boxShadow = '0 18px 70px rgba(0,0,0,.35), inset 0 0 0 1px rgba(148,163,184,.16)';
    el.style.border = '1px solid rgba(148,163,184,.16)';
    el.style.background = 'rgba(2,6,23,.45)';
    el.style.backdropFilter = 'blur(8px)';

    if (kind === 'junk') {
      el.style.borderColor = 'rgba(239,68,68,.26)';
      el.style.boxShadow = '0 18px 70px rgba(0,0,0,.38), 0 0 0 1px rgba(239,68,68,.18) inset';
    } else if (kind === 'fruit') {
      el.style.borderColor = 'rgba(34,211,238,.22)';
      el.style.boxShadow = '0 18px 70px rgba(0,0,0,.38), 0 0 0 1px rgba(34,211,238,.14) inset';
    } else {
      el.style.borderColor = 'rgba(34,197,94,.22)';
      el.style.boxShadow = '0 18px 70px rgba(0,0,0,.38), 0 0 0 1px rgba(34,197,94,.14) inset';
    }

    el.textContent = emoji || '✨';
    el.dataset.kind = kind;
    el.dataset.emoji = emoji || '';
    el.dataset.foodKind = (meta && meta.foodKind) ? meta.foodKind : '';

    setXY(el, x, y);

    // TTL
    var ttl = engine.ttlMs;
    el._ttlTimer = root.setTimeout(function () {
      if (!el.isConnected) return;

      if (kind === 'good' || kind === 'fruit') {
        // expire counts as miss for GOOD only
        engine.misses++;
        engine.nExpireGood++;
        engine.combo = 0;

        emit('hha:judge', { kind: 'warn', text: 'MISS!' });
        logEvent('miss_expire', {
          kind: 'good',
          emoji: el.dataset.emoji,
          targetId: el.dataset.tid || '',
          totalScore: engine.score | 0,
          combo: engine.combo | 0
        });

        updateScore();

        try { Particles.scorePop('MISS', x, y); } catch (e) {}
      }

      // fade out
      el.style.opacity = '0';
      root.setTimeout(function () { try { el.remove(); } catch (e2) {} }, 220);
    }, ttl);

    // hit
    el.addEventListener('pointerdown', function (ev) {
      try { ev.preventDefault(); } catch (e) {}
      hitTarget(el);
    }, { passive: false });

    return el;
  }

  function removeTarget(el) {
    try { root.clearTimeout(el._ttlTimer); } catch (e) {}
    el.style.transform += ' scale(0.92)';
    el.style.opacity = '0';
    root.setTimeout(function () { try { el.remove(); } catch (e2) {} }, 180);
  }

  // -------------------- fever/shield --------------------
  function setFever(v) {
    engine.fever = clamp(v, 0, 1);

    // Sync external FeverUI if available (best effort)
    try { if (FeverUI && typeof FeverUI.set === 'function') FeverUI.set(engine.fever); } catch (e) {}
    emit('hha:fever', { value: engine.fever });
  }

  function grantShield() {
    engine.shield = 1;
    emit('hha:judge', { kind: 'good', text: 'SHIELD READY!' });
    emit('hha:celebrate', { kind: 'mini', title: 'SHIELD READY!' });
  }

  function onGoodHitBoost() {
    setFever(engine.fever + 0.12);
    if (engine.fever >= 1 && engine.shield <= 0) {
      setFever(1);
      grantShield();
    }
  }

  function onBadHitPenalty() {
    setFever(engine.fever - 0.18);
  }

  // -------------------- hit logic --------------------
  function hitTarget(el) {
    if (!engine.running || engine.ended) return;
    if (!el || !el.isConnected) return;

    var kind = String(el.dataset.kind || '').toLowerCase();
    var em = String(el.dataset.emoji || '');

    // compute position for fx
    var p = getXY(el);

    // BAD (junk)
    if (kind === 'junk') {
      // shield block (does NOT count miss)
      if (engine.shield > 0) {
        engine.shield = 0;
        emit('hha:judge', { kind: 'good', text: 'SHIELD BLOCK!' });

        logEvent('shield_block', {
          kind: 'junk',
          emoji: em,
          targetId: el.dataset.tid || '',
          totalScore: engine.score | 0,
          combo: engine.combo | 0
        });

        try { Particles.burstAt(p.x, p.y, 'shield'); } catch (e) {}
        removeTarget(el);
        updateScore();
        return;
      }

      engine.nHitBad++;
      engine.misses++; // miss includes junk hit if not blocked
      engine.combo = 0;

      // minis that require "no junk"
      if (engine.miniActive && (engine.miniActive.id === 'plate_rush' || engine.miniActive.id === 'no_junk_zone')) {
        engine.rushNoJunk = false;
      }

      emit('hha:judge', { kind: 'bad', text: 'JUNK!' });
      onBadHitPenalty();

      engine.score = Math.max(0, engine.score - 60);
      try { Particles.scorePop('-60', p.x, p.y); } catch (e2) {}

      logEvent('hit', {
        kind: 'junk',
        emoji: em,
        isGood: false,
        judgment: 'junk',
        totalScore: engine.score | 0,
        combo: engine.combo | 0
      });

      updateScore();
      removeTarget(el);
      checkMini();
      return;
    }

    // GOOD / FRUIT treated as good but fruit gives smaller plate fill + score
    var foodKind = String(el.dataset.foodKind || '');
    var isFruit = (kind === 'fruit');

    engine.nHitGood++;
    engine.combo = clamp(engine.combo + 1, 0, 9999);
    engine.comboMax = Math.max(engine.comboMax, engine.combo);

    // scoring
    var base = isFruit ? 70 : 100;
    var bonus = Math.min(220, engine.combo * 4);
    engine.score += (base + bonus);

    // plate fill
    if (!isFruit) {
      if (foodKind === 'veg') engine.fillVeg = clamp(engine.fillVeg + 1, 0, 4);
      else if (foodKind === 'prot') engine.fillProt = clamp(engine.fillProt + 1, 0, 2);
      else if (foodKind === 'carb') engine.fillCarb = clamp(engine.fillCarb + 1, 0, 2);
    } else {
      // fruit counts as "bonus" (doesn't break balance) — add small score only
      engine.score += 30;
    }

    // fever
    onGoodHitBoost();

    emit('hha:judge', { kind: 'good', text: isFruit ? 'BONUS!' : 'GOOD!' });
    try { Particles.burstAt(p.x, p.y, isFruit ? 'fruit' : 'good'); } catch (e3) {}

    logEvent('hit', {
      kind: isFruit ? 'fruit' : 'good',
      emoji: em,
      itemType: foodKind,
      isGood: true,
      judgment: 'hit',
      totalScore: engine.score | 0,
      combo: engine.combo | 0
    });

    // mini updates
    if (engine.miniActive) {
      try { if (engine.miniActive.def.onGood) engine.miniActive.def.onGood(engine.miniActive, { foodKind: foodKind, emoji: em }); } catch (e4) {}
    }

    updateScore();
    removeTarget(el);

    // plate completion
    if (plateIsComplete()) onPlateComplete();

    checkMini();
  }

  // -------------------- spawn choose --------------------
  function chooseKind() {
    // fruit chance is independent (bonus)
    if (engine.rng() < engine.fruitBias) return 'fruit';

    var r = engine.rng();
    if (r < engine.junkBias) return 'junk';
    return 'good';
  }

  function chooseFoodKind() {
    // balanced distribution: prefer what is currently lacking
    var needVeg = 4 - engine.fillVeg;
    var needProt = 2 - engine.fillProt;
    var needCarb = 2 - engine.fillCarb;

    var bag = [];
    for (var i = 0; i < needVeg; i++) bag.push('veg');
    for (var j = 0; j < needProt; j++) bag.push('prot');
    for (var k = 0; k < needCarb; k++) bag.push('carb');

    if (!bag.length) {
      // already full; random
      return pick(engine.rng, ['veg', 'prot', 'carb']);
    }
    return pick(engine.rng, bag);
  }

  function spawnOne() {
    if (!engine.running || engine.ended) return;

    var kind = chooseKind();
    var p = randPos(engine.rng);

    var sc = engine.size;
    if (kind === 'junk') sc *= 0.95;
    if (kind === 'fruit') sc *= 0.98;

    var emoji = '✨';
    var meta = {};

    if (kind === 'junk') {
      emoji = pick(engine.rng, JUNK);
      engine.nSpawnJunk++;
    } else if (kind === 'fruit') {
      emoji = pick(engine.rng, FOODS.fruit);
      engine.nSpawnFruit++;
    } else {
      var fk = chooseFoodKind();
      meta.foodKind = fk;
      emoji = pick(engine.rng, FOODS[fk]);
      engine.nSpawnGood++;
    }

    var el = makeTarget(kind, emoji, p.x, p.y, sc, meta);

    // unique target id (for logs)
    el.dataset.tid = 't' + Math.floor(now()).toString(36) + '_' + Math.floor(engine.rng() * 1e9).toString(36);

    layer.appendChild(el);

    logEvent('spawn', {
      kind: kind,
      emoji: emoji,
      itemType: meta.foodKind || '',
      targetId: el.dataset.tid,
      timeFromStartMs: (engine._t0 ? (now() - engine._t0) : 0) | 0
    });
  }

  function loopSpawn() {
    if (!engine.running || engine.ended) return;
    spawnOne();

    // next interval
    var ms = engine.spawnMs;
    engine.spawnTimer = root.setTimeout(loopSpawn, ms);
  }

  // -------------------- VR-feel view shift --------------------
  function applyView() {
    layer.style.transform = 'translate(' + engine.vx.toFixed(1) + 'px,' + engine.vy.toFixed(1) + 'px)';
  }

  function setupView() {
    layer.addEventListener('pointerdown', function (e) {
      engine.dragOn = true;
      engine.dragX = e.clientX;
      engine.dragY = e.clientY;
    }, { passive: true });

    root.addEventListener('pointermove', function (e) {
      if (!engine.dragOn) return;
      var dx = e.clientX - engine.dragX;
      var dy = e.clientY - engine.dragY;
      engine.dragX = e.clientX;
      engine.dragY = e.clientY;

      engine.vx = clamp(engine.vx + dx * 0.22, -95, 95);
      engine.vy = clamp(engine.vy + dy * 0.22, -95, 95);
      applyView();
    }, { passive: true });

    root.addEventListener('pointerup', function () { engine.dragOn = false; }, { passive: true });

    root.addEventListener('deviceorientation', function (ev) {
      // gentle drift
      var gx = Number(ev.gamma) || 0;
      var gy = Number(ev.beta) || 0;

      engine.vx = clamp(engine.vx + gx * 0.06, -95, 95);
      engine.vy = clamp(engine.vy + (gy - 20) * 0.02, -95, 95);
      applyView();
    }, { passive: true });
  }

  // -------------------- adaptive tuning --------------------
  function adaptTick() {
    if (engine.runMode !== 'play') return;

    var acc = accuracyPct() / 100;
    var heat = clamp((engine.combo / 18) + (acc - 0.68), 0, 1);

    engine.adapt.spawnMs = clamp(820 - heat * 260, 480, 900);
    engine.adapt.ttlMs = clamp(1700 - heat * 260, 1250, 1800);
    engine.adapt.size = clamp(1.03 - heat * 0.12, 0.86, 1.06);

    engine.adapt.junkBias = clamp(0.14 + heat * 0.08, 0.10, 0.26);
    engine.adapt.fruitBias = clamp(0.10 - heat * 0.03, 0.06, 0.12);

    engine.spawnMs = engine.adapt.spawnMs | 0;
    engine.ttlMs = engine.adapt.ttlMs | 0;
    engine.size = engine.adapt.size;
    engine.junkBias = engine.adapt.junkBias;
    engine.fruitBias = engine.adapt.fruitBias;
  }

  // -------------------- tick loop --------------------
  function loopTick() {
    if (!engine.running || engine.ended) return;

    adaptTick();

    // time countdown
    engine.left = Math.max(0, engine.left - 0.14);
    updateTime();

    // timed mini urgency / timeout
    miniFailIfTimedOut();
    checkMini();

    if (engine.left <= 0) {
      endGame('time');
      return;
    }

    engine.tickTimer = root.setTimeout(loopTick, 140);
  }

  function clearAllTargets() {
    var list = layer.querySelectorAll('.plate-target');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      try { root.clearTimeout(el._ttlTimer); } catch (e) {}
      try { el.remove(); } catch (e2) {}
    }
  }

  // -------------------- end overlay (reuse existing) --------------------
  function ensureEndOverlay() {
    var ov = DOC.getElementById('endOverlay');
    if (!ov) return null;

    // bind once
    if (ov.dataset.bound === '1') return ov;
    ov.dataset.bound = '1';

    var btnRetry = DOC.getElementById('btnRetry');
    var btnBack = DOC.getElementById('btnBackHub');

    if (btnRetry) {
      btnRetry.addEventListener('click', function () {
        flushHardened('retry');
        try { root.location.reload(); } catch (e) {}
      }, { passive: true });
    }

    if (btnBack) {
      btnBack.addEventListener('click', function () {
        PlateBoot.goHub();
      }, { passive: true });
    }

    return ov;
  }

  function showEndOverlay(detail) {
    var ov = ensureEndOverlay();
    if (!ov) return;

    // fill IDs provided by your HTML
    function setTxt(id, v) {
      var el = DOC.getElementById(id);
      if (el) el.textContent = String(v);
    }

    setTxt('endScore', detail.scoreFinal || 0);
    setTxt('endRank', detail.grade || 'C');
    setTxt('endAcc', (detail.accuracyGoodPct || 0) + '%');
    setTxt('endComboMax', detail.comboMax || 0);
    setTxt('endMiss', detail.misses || 0);
    setTxt('endGoals', (detail.goalsCleared || 0) + '/' + (detail.goalsTotal || 0));
    setTxt('endMinis', (detail.miniCleared || 0) + '/' + (detail.miniTotal || 0));

    ov.style.display = 'flex';
  }

  // -------------------- FLUSH hardened --------------------
  function flushHardened(reason) {
    // localStorage last summary is handled in endGame
    tryFlush(reason || 'flush');

    // attempt sendBeacon if a logger listens to it (optional)
    try { emit('hha:flush_beacon', { reason: reason || 'flush' }); } catch (e) {}
  }

  function bindFlushHooks() {
    if (DOC.documentElement.dataset.hhaPlateFlushBound === '1') return;
    DOC.documentElement.dataset.hhaPlateFlushBound = '1';

    root.addEventListener('pagehide', function () { flushHardened('pagehide'); }, { passive: true });
    root.addEventListener('beforeunload', function () { flushHardened('beforeunload'); }, { passive: true });

    DOC.addEventListener('visibilitychange', function () {
      if (DOC.visibilityState === 'hidden') flushHardened('hidden');
    }, { passive: true });
  }

  // -------------------- end game --------------------
  function endGame(reason) {
    if (engine.ended) return;
    engine.ended = true;
    engine.running = false;

    try { root.clearTimeout(engine.spawnTimer); } catch (e) {}
    try { root.clearTimeout(engine.tickTimer); } catch (e2) {}

    clearAllTargets();

    // stop audio tickers if any external module uses it (none here)
    // build summary
    var acc = accuracyPct();
    var detail = {
      reason: reason || 'end',
      scoreFinal: engine.score | 0,
      comboMax: engine.comboMax | 0,
      misses: engine.misses | 0,
      accuracyGoodPct: acc | 0,
      grade: rankFromAcc(acc),

      goalsCleared: engine.goalsCleared | 0,
      goalsTotal: engine.goalsTotal | 0,
      miniCleared: engine.miniCleared | 0,
      miniTotal: engine.miniTotal | 0,

      nTargetGoodSpawned: engine.nSpawnGood | 0,
      nTargetJunkSpawned: engine.nSpawnJunk | 0,
      nTargetFruitSpawned: engine.nSpawnFruit | 0,

      nHitGood: engine.nHitGood | 0,
      nHitBad: engine.nHitBad | 0,
      nExpireGood: engine.nExpireGood | 0,

      diff: engine.diff,
      runMode: engine.runMode,
      seed: engine.seed
    };

    // persist last summary
    try {
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(detail));
      localStorage.setItem('hha_last_summary', JSON.stringify(detail));
    } catch (e3) {}

    // flush BEFORE showing overlay (important)
    flushHardened('end_' + (reason || 'end'));

    emit('hha:end', detail);

    showEndOverlay(detail);
  }

  // -------------------- HUB navigation --------------------
  function goHub() {
    // flush before leaving hub
    flushHardened('go_hub');

    var hub = String(qs('hub', '../hub.html') || '../hub.html');
    try {
      var u = new URL(hub, root.location.href);
      u.searchParams.set('ts', String(Date.now()));
      root.location.href = u.toString();
    } catch (e) {
      root.location.href = hub;
    }
  }

  // -------------------- public boot API --------------------
  function start(runMode, cfg) {
    cfg = cfg || {};

    engine.runMode = (String(runMode || 'play').toLowerCase() === 'research') ? 'research' : 'play';
    engine.diff = String(cfg.diff || qs('diff', 'normal')).toLowerCase();
    engine.timeSec = clamp(cfg.time !== undefined ? cfg.time : int(qs('time', 90), 90), 30, 600);
    engine.left = engine.timeSec;

    var sid = String(qs('sessionId', qs('studentKey', '')) || '');
    var ts = String(qs('ts', String(Date.now())));
    engine.seed = String(cfg.seed || qs('seed', sid ? (sid + '|' + ts) : ts));
    engine.rng = makeRng(engine.seed);

    // init difficulty
    var dp = diffParams(engine.diff);

    engine.spawnMs = dp.spawnMs | 0;
    engine.ttlMs = dp.ttlMs | 0;
    engine.size = dp.size;
    engine.junkBias = dp.junkBias;
    engine.fruitBias = dp.fruitBias;

    engine.adapt.spawnMs = engine.spawnMs;
    engine.adapt.ttlMs = engine.ttlMs;
    engine.adapt.size = engine.size;
    engine.adapt.junkBias = engine.junkBias;
    engine.adapt.fruitBias = engine.fruitBias;

    // reset gameplay
    engine.score = 0;
    engine.combo = 0;
    engine.comboMax = 0;
    engine.misses = 0;

    engine.nHitGood = 0;
    engine.nHitBad = 0;
    engine.nExpireGood = 0;
    engine.nSpawnGood = 0;
    engine.nSpawnJunk = 0;
    engine.nSpawnFruit = 0;

    engine.fever = 0;
    engine.shield = 0;

    resetPlateFill();

    engine.goalIndex = 0;
    engine.goalsCleared = 0;
    engine.goalsTotal = 3;

    engine.miniCleared = 0;
    engine.miniTotal = 999;
    engine.miniActive = null;
    refillMiniBag();

    engine.vx = 0; engine.vy = 0;
    applyView();

    // mark running
    engine.running = true;
    engine.ended = false;
    engine._t0 = now();

    // start first mini
    startMini();

    // UI initial
    updateTime();
    updateScore();
    updateQuestUI();

    // start loops
    loopSpawn();
    loopTick();

    emit('hha:judge', { kind: 'good', text: 'START!' });

    // log session start snapshot
    logEvent('session_start', {
      diff: engine.diff,
      runMode: engine.runMode,
      timeSec: engine.timeSec | 0,
      seed: engine.seed
    });
  }

  // -------------------- init & bind --------------------
  setupView();
  bindFlushHooks();
  ensureEndOverlay();

  // expose boot
  var PlateBoot = (root.PlateBoot = root.PlateBoot || {});
  PlateBoot.start = start;
  PlateBoot.goHub = goHub;
  PlateBoot.flush = flushHardened;

})(typeof window !== 'undefined' ? window : globalThis);
