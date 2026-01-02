/* === /herohealth/vr-groups/groups.safe.js ===
Food Groups VR — SAFE (PRODUCTION)
✅ PC/Mobile click/tap targets
✅ Cardboard/cVR: shoot from crosshair via event `hha:shoot` (vr-ui.js)
✅ Seeded deterministic (research mode) + adaptive OFF in research
✅ Spawn with safe-zones (avoid HUD/Quest/Coach/Power)
✅ Storm + Boss mini + Power switch group
✅ Emits: hha:score, hha:time, hha:rank, quest:update, hha:coach, hha:judge, groups:power, groups:progress, hha:end
✅ Rank: SSS, SS, S, A, B, C
*/

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  // -------------------- utils --------------------
  const $ = (id) => DOC.getElementById(id);

  function qs(k, def = null) {
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function clamp(v, a, b) {
    v = Number(v) || 0;
    return v < a ? a : (v > b ? b : v);
  }

  function nowMs() { return performance.now ? performance.now() : Date.now(); }

  // Seeded RNG (Mulberry32)
  function makeRng(seedStr) {
    let s = 0x12345678;
    const str = String(seedStr ?? '');
    for (let i = 0; i < str.length; i++) {
      s ^= str.charCodeAt(i);
      s = Math.imul(s, 16777619);
    }
    let t = (s >>> 0) || 0xA5A5A5A5;
    return function rnd() {
      t += 0x6D2B79F5;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, arr) {
    if (!arr || !arr.length) return null;
    return arr[Math.floor(rng() * arr.length)];
  }

  function shuffle(rng, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function emit(name, detail) {
    root.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
  }

  function rectOf(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, r };
  }

  function rectInflate(R, pad) {
    if (!R) return null;
    return { x: R.x - pad, y: R.y - pad, w: R.w + pad * 2, h: R.h + pad * 2 };
  }

  function pointInRect(px, py, R) {
    return px >= R.x && px <= (R.x + R.w) && py >= R.y && py <= (R.y + R.h);
  }

  // -------------------- content (TH) --------------------
  const GROUPS = [
    { key: 'rice',   name: '🍚 ข้าว-แป้ง', emojis: ['🍚','🍞','🥐','🥖','🍜','🍝','🥔','🌽'] },
    { key: 'veg',    name: '🥦 ผัก',       emojis: ['🥦','🥬','🥒','🥕','🍅','🫑','🧄','🧅'] },
    { key: 'fruit',  name: '🍎 ผลไม้',     emojis: ['🍎','🍌','🍇','🍊','🍉','🍍','🍓','🥭'] },
    { key: 'protein',name: '🍗 โปรตีน',    emojis: ['🍗','🍖','🥚','🐟','🦐','🧀','🥜','🫘'] },
    { key: 'milk',   name: '🥛 นม',        emojis: ['🥛','🧋','🍶','🧀'] }
  ];

  const JUNK = ['🍟','🍔','🍕','🌭','🍩','🍪','🍫','🥤','🧁','🍬'];
  const STAR = ['⭐','🌟'];
  const DIAMOND = ['💎','🔷'];

  // -------------------- difficulty model --------------------
  const DIFF = {
    easy:   { baseSize: 1.10, spawnMs: 820, ttlMs: 1800, wrongRate: 0.18, junkRate: 0.12, decoyRate: 0.06, stormEvery: 16, stormLen: 6, bossEvery: 20, powerThr: 6 },
    normal: { baseSize: 1.00, spawnMs: 720, ttlMs: 1600, wrongRate: 0.22, junkRate: 0.16, decoyRate: 0.08, stormEvery: 14, stormLen: 7, bossEvery: 18, powerThr: 8 },
    hard:   { baseSize: 0.92, spawnMs: 620, ttlMs: 1400, wrongRate: 0.26, junkRate: 0.20, decoyRate: 0.10, stormEvery: 12, stormLen: 8, bossEvery: 16, powerThr: 10 }
  };

  function gradeFrom(acc, score, misses) {
    // acc: 0..100
    const a = Number(acc) || 0;
    const s = Number(score) || 0;
    const m = Number(misses) || 0;

    // Slightly reward score, penalize misses
    const bonus = clamp((s / 1200) * 6, 0, 6);
    const penalty = clamp(m * 1.2, 0, 12);
    const g = a + bonus - penalty;

    if (g >= 97) return 'SSS';
    if (g >= 93) return 'SS';
    if (g >= 88) return 'S';
    if (g >= 78) return 'A';
    if (g >= 65) return 'B';
    return 'C';
  }

  // -------------------- Safe zone spawn helper --------------------
  function makeSpawnPlanner() {
    // Cached elements (use IDs from your run HTML)
    const elHud = DOC.querySelector('.hud');
    const elQuest = DOC.querySelector('.questTop');
    const elCoach = DOC.querySelector('.coachWrap');
    const elPower = DOC.querySelector('.powerWrap');

    function getSafeRects(pad = 10) {
      const out = [];
      const rHud = rectInflate(rectOf(elHud), pad);
      const rQuest = rectInflate(rectOf(elQuest), pad);
      const rCoach = rectInflate(rectOf(elCoach), pad);
      const rPower = rectInflate(rectOf(elPower), pad);
      if (rHud) out.push(rHud);
      if (rQuest) out.push(rQuest);
      if (rCoach) out.push(rCoach);
      if (rPower) out.push(rPower);
      return out;
    }

    function getPlayRect() {
      // Full viewport; safezones handle the avoidance.
      const w = root.innerWidth || DOC.documentElement.clientWidth || 360;
      const h = root.innerHeight || DOC.documentElement.clientHeight || 640;

      // Keep a little margin to avoid extreme edges
      const margin = 10;
      return { x: margin, y: margin, w: w - margin * 2, h: h - margin * 2 };
    }

    function samplePoint(rng, safeRects) {
      const pr = getPlayRect();

      // reject sampling
      for (let tries = 0; tries < 60; tries++) {
        const x = pr.x + rng() * pr.w;
        const y = pr.y + rng() * pr.h;

        let bad = false;
        for (const R of safeRects) {
          if (pointInRect(x, y, R)) { bad = true; break; }
        }
        if (!bad) return { x, y };
      }

      // fallback: center-ish
      return { x: pr.x + pr.w * 0.5, y: pr.y + pr.h * 0.52 };
    }

    return { getSafeRects, samplePoint };
  }

  // -------------------- Engine --------------------
  function createEngine() {
    const state = {
      running: false,
      runMode: 'play', // play|research
      diff: 'normal',
      style: 'mix',
      seed: '',
      rng: null,

      timeTotal: 90,
      timeLeft: 90,
      tStartMs: 0,
      tLastTickMs: 0,

      score: 0,
      combo: 0,
      comboMax: 0,
      misses: 0,

      hitGood: 0,
      hitTotal: 0,
      hitWrong: 0,
      hitJunk: 0,
      expireGood: 0,

      // power switch group
      power: 0,
      powerThr: 8,

      groupIndex: 0,
      currentGroup: GROUPS[0],

      // storm / boss
      stormOn: false,
      stormUntilSec: 0,
      nextStormAtSec: 0,
      nextBossAtSec: 0,
      bossActive: false,
      bossNeed: 0,
      bossHit: 0,

      // adaptive (play only)
      adaptLevel: 0, // -2..+2
      lastAdaptAtSec: 0,

      // dom
      layerEl: null,
      targets: new Map(), // id -> {el, type, emoji, good, bornMs, dieMs, alive}
      nextId: 1,

      // motion
      vx: 0,
      vy: 0,
      dragOn: false,
      dragX: 0,
      dragY: 0,
      lastPointerX: 0,
      lastPointerY: 0,
      tiltVX: 0,
      tiltVY: 0,

      // helpers
      spawner: makeSpawnPlanner(),
      cfg: DIFF.normal
    };

    function setLayerEl(el) {
      state.layerEl = el;
    }

    // ---------- view helper: tilt + drag translate ----------
    function setLayerTranslate(x, y) {
      if (!state.layerEl) return;
      const bx = clamp(x, -110, 110);
      const by = clamp(y, -90, 90);
      state.vx = bx;
      state.vy = by;
      DOC.body.style.setProperty('--vx', `${bx}px`);
      DOC.body.style.setProperty('--vy', `${by}px`);
    }

    function hookViewMotion() {
      // Gyro tilt (mobile)
      function onOrient(ev) {
        if (!state.running) return;
        const view = (DOC.body.className.match(/\bview-\w+\b/) || [''])[0];
        if (view === 'view-pc') return;

        const gamma = Number(ev.gamma) || 0; // left-right
        const beta  = Number(ev.beta) || 0;  // front-back

        // subtle mapping
        const tx = clamp(gamma / 25, -1, 1) * 55;
        const ty = clamp(beta / 30, -1, 1) * 40;

        state.tiltVX = tx;
        state.tiltVY = ty;
      }

      root.addEventListener('deviceorientation', onOrient, { passive: true });

      // Drag translate (mobile/pc)
      function pDown(e) {
        if (!state.running) return;
        state.dragOn = true;
        const p = (e.touches && e.touches[0]) ? e.touches[0] : e;
        state.dragX = state.vx;
        state.dragY = state.vy;
        state.lastPointerX = p.clientX;
        state.lastPointerY = p.clientY;
      }
      function pMove(e) {
        if (!state.running || !state.dragOn) return;
        const p = (e.touches && e.touches[0]) ? e.touches[0] : e;
        const dx = p.clientX - state.lastPointerX;
        const dy = p.clientY - state.lastPointerY;
        setLayerTranslate(state.dragX + dx * 0.35, state.dragY + dy * 0.28);
      }
      function pUp() { state.dragOn = false; }

      DOC.addEventListener('pointerdown', pDown, { passive: true });
      DOC.addEventListener('pointermove', pMove, { passive: true });
      DOC.addEventListener('pointerup', pUp, { passive: true });
      DOC.addEventListener('touchstart', pDown, { passive: true });
      DOC.addEventListener('touchmove', pMove, { passive: true });
      DOC.addEventListener('touchend', pUp, { passive: true });

      // blend tilt when not dragging
      setInterval(() => {
        if (!state.running) return;
        if (!state.dragOn) {
          const nx = state.vx * 0.85 + state.tiltVX * 0.15;
          const ny = state.vy * 0.85 + state.tiltVY * 0.15;
          setLayerTranslate(nx, ny);
        }
      }, 60);
    }

    // ---------- coach ----------
    function coach(text, mood = 'neutral') {
      emit('hha:coach', { text, mood });
    }

    // ---------- quest: goal + mini (simple but fun) ----------
    const quest = {
      goalNow: 0,
      goalTotal: 10,
      miniNow: 0,
      miniTotal: 5,
      miniLeft: 0,
      miniOn: false,
      miniForbidJunk: true,
      goalName: '',
      miniName: '',
      lastMiniAtSec: 0
    };

    function questReset() {
      quest.goalNow = 0;
      quest.miniNow = 0;
      quest.goalTotal = 10;
      quest.miniTotal = 5;
      quest.miniLeft = 0;
      quest.miniOn = false;
      quest.miniForbidJunk = true;
      quest.lastMiniAtSec = 0;
      quest.goalName = '';
      quest.miniName = '';
    }

    function setGoalForGroup() {
      const g = state.currentGroup;
      quest.goalTotal = clamp(8 + Math.floor(state.cfg.powerThr * 0.8), 8, 16);
      quest.goalNow = 0;
      quest.goalName = `เก็บ ${g.name} ให้ครบ ${quest.goalTotal} ชิ้น`;
      emitQuest();
      coach(`เป้าหมายใหม่! ${quest.goalName}`, 'happy');
    }

    function startMini(kind) {
      // mini every ~10-14s
      quest.miniOn = true;
      quest.miniNow = 0;

      if (kind === 'rush') {
        quest.miniTotal = 5;
        quest.miniLeft = 8; // seconds
        quest.miniForbidJunk = true;
        quest.miniName = `Plate Rush: เก็บให้ครบ ${quest.miniTotal} ภายใน ${quest.miniLeft}s (ห้ามโดนขยะ)`;
      } else if (kind === 'streak') {
        quest.miniTotal = 6;
        quest.miniLeft = 10;
        quest.miniForbidJunk = false;
        quest.miniName = `Combo Sprint: เก็บให้ครบ ${quest.miniTotal} ภายใน ${quest.miniLeft}s`;
      } else {
        quest.miniTotal = 4;
        quest.miniLeft = 7;
        quest.miniForbidJunk = true;
        quest.miniName = `No-Junk: เก็บให้ครบ ${quest.miniTotal} ภายใน ${quest.miniLeft}s (ห้ามโดนขยะ)`;
      }

      emitQuest();
      coach(`มินิเควสท์! ${quest.miniName}`, 'neutral');
      DOC.body.classList.toggle('mini-urgent', false);
    }

    function endMini(success, reason) {
      if (!quest.miniOn) return;
      quest.miniOn = false;
      quest.miniLeft = 0;
      DOC.body.classList.toggle('mini-urgent', false);

      if (success) {
        state.score += 120;
        state.combo += 2;
        emit('hha:judge', { kind: 'good', text: 'MINI CLEAR +120' });
        coach('เยี่ยม! ผ่านมินิแล้ว ✅', 'happy');
      } else {
        emit('hha:judge', { kind: 'miss', text: 'MINI FAIL' });
        coach(`พลาดมินิ (${reason || 'fail'})`, 'sad');
      }
      emitQuest();
    }

    function emitQuest() {
      // drive mini urgent effect
      const urgent = quest.miniOn && quest.miniLeft > 0 && quest.miniLeft <= 3;
      DOC.body.classList.toggle('mini-urgent', urgent);

      emit('quest:update', {
        goalTitle: quest.goalName || '—',
        goalNow: quest.goalNow,
        goalTotal: quest.goalTotal,
        goalPct: clamp((quest.goalNow / Math.max(1, quest.goalTotal)) * 100, 0, 100),

        miniTitle: quest.miniName || '—',
        miniNow: quest.miniNow,
        miniTotal: quest.miniTotal,
        miniPct: quest.miniOn ? clamp((quest.miniNow / Math.max(1, quest.miniTotal)) * 100, 0, 100) : 0,
        miniTimeLeftSec: quest.miniOn ? Math.max(0, quest.miniLeft | 0) : 0
      });
    }

    // ---------- power / group switch ----------
    function setGroup(i, reason) {
      state.groupIndex = (i + GROUPS.length) % GROUPS.length;
      state.currentGroup = GROUPS[state.groupIndex];
      state.power = 0;
      emit('groups:power', { charge: state.power, threshold: state.powerThr });
      setGoalForGroup();
      emit('groups:progress', { kind: 'switch', reason: reason || 'power' });
    }

    function addPower(n) {
      state.power = clamp(state.power + (n | 0), 0, state.powerThr);
      emit('groups:power', { charge: state.power, threshold: state.powerThr });
      if (state.power >= state.powerThr) {
        emit('groups:progress', { kind: 'perfect_switch' });
        state.score += 80;
        state.combo += 1;
        setGroup(state.groupIndex + 1, 'power');
      }
    }

    // ---------- spawn / target handling ----------
    function killTarget(id, cls, keepMap = false) {
      const T = state.targets.get(id);
      if (!T) return;
      T.alive = false;
      if (T.el) {
        T.el.classList.add(cls || 'hit');
        setTimeout(() => { try { T.el.remove(); } catch { } }, 220);
      }
      if (!keepMap) state.targets.delete(id);
    }

    function expireTarget(id) {
      const T = state.targets.get(id);
      if (!T || !T.alive) return;

      // Good target expired counts as miss
      if (T.good) {
        state.misses += 1;
        state.expireGood += 1;
        state.combo = 0;
        emit('hha:judge', { kind: 'miss', text: 'MISS (expire)' });
        coach('เร็วขึ้นอีกนิดนะ!', 'neutral');
      }
      killTarget(id, 'out');
    }

    function mkEl(type, emoji, x, y, sizeScale) {
      const el = DOC.createElement('div');
      el.className = `fg-target spawn ${type}`;
      el.setAttribute('data-emoji', emoji);

      // position + size
      el.style.setProperty('--x', `${x}px`);
      el.style.setProperty('--y', `${y}px`);
      el.style.setProperty('--s', String(sizeScale));

      // click/tap (PC/Mobile)
      el.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        onHitEl(el);
      }, { passive: false });

      return el;
    }

    function spawnTarget(kind) {
      if (!state.layerEl) return;

      const safeRects = state.spawner.getSafeRects(12);
      const pt = state.spawner.samplePoint(state.rng, safeRects);

      // pick emoji + goodness
      const g = state.currentGroup;

      let typeCls = '';
      let emoji = '';
      let good = false;

      if (kind === 'good') {
        typeCls = 'fg-good';
        emoji = pick(state.rng, g.emojis);
        good = true;
      } else if (kind === 'wrong') {
        typeCls = 'fg-wrong';
        const other = pick(state.rng, GROUPS.filter(x => x.key !== g.key));
        emoji = pick(state.rng, other.emojis);
        good = false;
      } else if (kind === 'junk') {
        typeCls = 'fg-junk';
        emoji = pick(state.rng, JUNK);
        good = false;
      } else if (kind === 'decoy') {
        typeCls = 'fg-decoy';
        emoji = pick(state.rng, STAR.concat(DIAMOND));
        good = false;
      } else if (kind === 'boss') {
        typeCls = 'fg-boss';
        emoji = pick(state.rng, g.emojis);
        good = true; // boss is “good but needs multiple hits”
      } else {
        typeCls = 'fg-wrong';
        emoji = '❓';
        good = false;
      }

      // size scaling
      const adapt = state.adaptLevel;
      const base = state.cfg.baseSize * (1 + (kind === 'boss' ? 0.18 : 0));
      const sizeScale = clamp(base + (adapt * -0.03), 0.78, 1.18);

      const id = state.nextId++;
      const born = nowMs();
      const ttl = (kind === 'boss')
        ? Math.max(1800, state.cfg.ttlMs + 700)
        : Math.max(900, state.cfg.ttlMs + (state.stormOn ? -150 : 0) + (adapt * -35));

      const el = mkEl(typeCls, emoji, pt.x, pt.y, sizeScale);
      el.dataset.tid = String(id);

      state.layerEl.appendChild(el);

      const T = {
        id, el,
        kind,
        typeCls,
        emoji,
        good,
        bornMs: born,
        dieMs: born + ttl,
        alive: true
      };
      state.targets.set(id, T);

      // expire
      setTimeout(() => expireTarget(id), ttl + 8);
    }

    function chooseSpawnKind() {
      // Boss overrides
      if (state.bossActive) return null;

      // Base rates
      let wrongRate = state.cfg.wrongRate;
      let junkRate = state.cfg.junkRate;
      let decoyRate = state.cfg.decoyRate;

      // Storm increases pressure
      if (state.stormOn) {
        wrongRate += 0.06;
        junkRate += 0.05;
        decoyRate += 0.02;
      }

      // Adaptive in play mode only
      if (state.runMode === 'play') {
        // if player too strong => more wrong/junk
        const a = state.adaptLevel;
        wrongRate += a * 0.02;
        junkRate  += a * 0.015;
      }

      wrongRate = clamp(wrongRate, 0.12, 0.40);
      junkRate  = clamp(junkRate, 0.08, 0.35);
      decoyRate = clamp(decoyRate, 0.00, 0.20);

      const r = state.rng();
      if (r < junkRate) return 'junk';
      if (r < junkRate + decoyRate) return 'decoy';
      if (r < junkRate + decoyRate + wrongRate) return 'wrong';
      return 'good';
    }

    // ---------- hit evaluation ----------
    function onHit(kind, emoji, isBossHit) {
      state.hitTotal += 1;

      const isGood = (kind === 'good' || kind === 'boss');
      const isWrong = (kind === 'wrong');
      const isJunk = (kind === 'junk');
      const isDecoy = (kind === 'decoy');

      if (isGood) state.hitGood += 1;
      if (isWrong) state.hitWrong += 1;
      if (isJunk) state.hitJunk += 1;

      // mini forbid junk
      if (quest.miniOn && quest.miniForbidJunk && isJunk) {
        state.misses += 1;
        state.combo = 0;
        emit('hha:judge', { kind: 'miss', text: 'HIT JUNK' });
        coach('โดนขยะ! ❌', 'sad');
        endMini(false, 'hit-junk');
        return;
      }

      if (isGood) {
        state.combo += 1;
        state.comboMax = Math.max(state.comboMax, state.combo);

        // scoring
        const streakBonus = clamp(Math.floor(state.combo / 6) * 6, 0, 30);
        state.score += 18 + streakBonus + (state.stormOn ? 4 : 0) + (isBossHit ? 8 : 0);

        // goal progress
        quest.goalNow = clamp(quest.goalNow + 1, 0, quest.goalTotal);
        addPower(1);

        // mini progress
        if (quest.miniOn) {
          quest.miniNow = clamp(quest.miniNow + 1, 0, quest.miniTotal);
          if (quest.miniNow >= quest.miniTotal) {
            endMini(true, 'done');
          }
        }

        emit('hha:judge', { kind: 'good', text: 'GOOD' });

        // goal complete -> instant switch + bonus
        if (quest.goalNow >= quest.goalTotal) {
          state.score += 160;
          state.combo += 2;
          emit('hha:judge', { kind: 'good', text: 'GOAL CLEAR +160' });
          coach('โหดมาก! ผ่าน GOAL แล้ว 🎉', 'happy');
          setGroup(state.groupIndex + 1, 'goal');
        }

      } else if (isDecoy) {
        // neutral: small score but no goal
        state.score += 8;
        state.combo = Math.max(0, state.combo - 1);
        emit('hha:judge', { kind: 'boss', text: 'BONUS' });
        coach('โบนัส! แต่ไม่ช่วยเป้าหมาย 😉', 'neutral');
      } else {
        // wrong/junk counts miss
        state.misses += 1;
        state.combo = 0;
        emit('hha:judge', { kind: 'bad', text: isJunk ? 'JUNK!' : 'WRONG!' });
        coach(isJunk ? 'อันนี้ไม่ดีต่อสุขภาพ!' : 'หมู่ผิดนะ!', 'sad');

        // mini fail if needed
        if (quest.miniOn && (isWrong || isJunk)) {
          // in rush/streak, wrong hurts too
          endMini(false, isJunk ? 'hit-junk' : 'hit-wrong');
        }
      }

      emitQuest();
      pushHud();
      pushRank();
    }

    function onHitEl(el) {
      const id = Number(el?.dataset?.tid || 0);
      const T = state.targets.get(id);
      if (!T || !T.alive) return;

      // Boss: needs multiple hits
      if (T.kind === 'boss' && state.bossActive) {
        state.bossHit += 1;
        el.classList.add('fg-boss-hurt');
        setTimeout(() => el.classList.remove('fg-boss-hurt'), 160);

        onHit('boss', T.emoji, true);

        if (state.bossHit >= state.bossNeed) {
          // boss cleared
          state.score += 220;
          emit('hha:judge', { kind: 'boss', text: 'BOSS CLEAR +220' });
          coach('จัดการบอสได้แล้ว! 🏆', 'happy');
          state.bossActive = false;
          DOC.body.classList.toggle('groups-storm-urgent', false);
          killTarget(id, 'hit');
        } else {
          // keep target alive (don’t delete)
          // visual: weak when close to finish
          if (state.bossNeed - state.bossHit <= 2) el.classList.add('fg-boss-weak');
        }
        return;
      }

      // normal target
      killTarget(id, 'hit');
      onHit(T.kind, T.emoji, false);
    }

    // ---------- crosshair shoot (Cardboard) ----------
    function hookShoot() {
      const lockPx = Number((root.HHA_VRUI_CONFIG && root.HHA_VRUI_CONFIG.lockPx) || 92) || 92;

      function findNearestToCenter() {
        const cx = (root.innerWidth || 360) / 2;
        const cy = (root.innerHeight || 640) / 2;

        let best = null;
        let bestD = 1e9;

        state.targets.forEach((T) => {
          if (!T || !T.alive || !T.el) return;
          const r = T.el.getBoundingClientRect();
          const x = r.left + r.width / 2;
          const y = r.top + r.height / 2;
          const dx = x - cx, dy = y - cy;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < bestD) { bestD = d; best = T; }
        });

        if (best && bestD <= lockPx) return best;
        return null;
      }

      root.addEventListener('hha:shoot', () => {
        if (!state.running) return;

        // In view-cvr, targets have pointer-events:none; we must lock by center
        const T = findNearestToCenter();
        if (T && T.el) {
          onHitEl(T.el);
        } else {
          // small miss feedback (optional)
          state.misses += 1;
          state.combo = 0;
          emit('hha:judge', { kind: 'miss', text: 'MISS' });
          coach('เล็งให้ตรงกว่านี้!', 'neutral');
          pushHud();
          pushRank();
        }
      }, { passive: true });
    }

    // ---------- HUD / rank ----------
    function pushHud() {
      emit('hha:score', {
        score: state.score | 0,
        combo: state.combo | 0,
        misses: state.misses | 0
      });
    }

    function pushTime() {
      emit('hha:time', { left: state.timeLeft | 0 });
    }

    function calcAcc() {
      const good = state.hitGood;
      const tot = state.hitTotal;
      if (tot <= 0) return 0;
      return Math.round((good / tot) * 100);
    }

    function pushRank() {
      const acc = calcAcc();
      const grade = gradeFrom(acc, state.score, state.misses);
      emit('hha:rank', { accuracy: acc, grade });
    }

    // ---------- storm / boss schedule ----------
    function setupSchedule() {
      // timeLeft counts down; schedule based on elapsed seconds
      const t = state.timeTotal;

      // storm
      state.nextStormAtSec = Math.max(8, t - state.cfg.stormEvery);
      // boss
      state.nextBossAtSec = Math.max(10, t - state.cfg.bossEvery);
    }

    function maybeStorm(elapsedSec) {
      if (state.bossActive) return;

      // turn on storm when elapsed reaches nextStormAtSec
      if (!state.stormOn && elapsedSec >= state.nextStormAtSec) {
        state.stormOn = true;
        state.stormUntilSec = elapsedSec + state.cfg.stormLen;
        DOC.body.classList.add('groups-storm');
        emit('groups:progress', { kind: 'storm_on' });
        coach('STORM! เร็วขึ้น! ⚡', 'neutral');
      }

      // urgent when close to end of storm
      const stormLeft = state.stormOn ? Math.max(0, state.stormUntilSec - elapsedSec) : 0;
      DOC.body.classList.toggle('groups-storm-urgent', state.stormOn && stormLeft <= 3);

      // end storm
      if (state.stormOn && elapsedSec >= state.stormUntilSec) {
        state.stormOn = false;
        DOC.body.classList.remove('groups-storm');
        DOC.body.classList.remove('groups-storm-urgent');
        emit('groups:progress', { kind: 'storm_off' });

        // schedule next
        state.nextStormAtSec = elapsedSec + state.cfg.stormEvery;
        coach('พายุจบแล้ว 👌', 'happy');
      }
    }

    function maybeBoss(elapsedSec) {
      if (state.bossActive) return;

      if (elapsedSec >= state.nextBossAtSec) {
        state.bossActive = true;
        state.bossNeed = clamp(4 + Math.floor((state.cfg.powerThr / 3)), 4, 8);
        state.bossHit = 0;

        // spawn boss now (single target)
        spawnTarget('boss');

        emit('groups:progress', { kind: 'boss_spawn' });
        coach(`บอสมา! ยิงให้ครบ ${state.bossNeed} ครั้ง! 💥`, 'fever');

        // schedule next boss
        state.nextBossAtSec = elapsedSec + state.cfg.bossEvery + 2;
      }
    }

    // ---------- adaptive (play only) ----------
    function maybeAdaptive(elapsedSec) {
      if (state.runMode !== 'play') return;
      if (elapsedSec - state.lastAdaptAtSec < 8) return;

      state.lastAdaptAtSec = elapsedSec;

      // measure last window using current totals
      const acc = calcAcc();
      const m = state.misses;

      // simple rule: high acc + low miss => harder, low acc + high miss => easier
      let target = state.adaptLevel;

      if (acc >= 88 && m <= 3) target += 1;
      else if (acc <= 65 && m >= 6) target -= 1;

      target = clamp(target, -2, 2);
      if (target !== state.adaptLevel) {
        state.adaptLevel = target;
        emit('hha:adaptive', { level: target });
      }
    }

    // ---------- spawning loop ----------
    let spawnTimer = 0;

    function scheduleSpawn() {
      clearTimeout(spawnTimer);

      if (!state.running) return;

      const adapt = (state.runMode === 'play') ? state.adaptLevel : 0;
      let ms = state.cfg.spawnMs + (adapt * -30) + (state.stormOn ? -80 : 0);
      ms = clamp(ms, 380, 1400);

      spawnTimer = setTimeout(() => {
        if (!state.running) return;

        // if boss active, do not spawn normal targets too aggressively
        if (!state.bossActive) {
          const kind = chooseSpawnKind();
          if (kind) spawnTarget(kind);
        }

        scheduleSpawn();
      }, ms);
    }

    // ---------- tick loop ----------
    let tickTimer = 0;

    function tick() {
      clearTimeout(tickTimer);
      if (!state.running) return;

      const t = nowMs();
      const dt = Math.min(0.2, Math.max(0.001, (t - state.tLastTickMs) / 1000));
      state.tLastTickMs = t;

      // time
      const elapsed = Math.max(0, (t - state.tStartMs) / 1000);
      const left = Math.max(0, state.timeTotal - elapsed);
      state.timeLeft = left;

      // storm/boss/adapt
      maybeStorm(elapsed);
      maybeBoss(elapsed);
      maybeAdaptive(elapsed);

      // mini countdown
      if (quest.miniOn) {
        // decrease per second
        quest.miniLeft = Math.max(0, quest.miniLeft - dt);
        if (quest.miniLeft <= 0.001) {
          endMini(false, 'timeout');
        } else {
          emitQuest();
        }
      } else {
        // open a mini sometimes
        if (elapsed - quest.lastMiniAtSec >= (state.stormOn ? 12 : 10)) {
          quest.lastMiniAtSec = elapsed;
          const k = pick(state.rng, ['rush', 'streak', 'nojunk']);
          startMini(k);
        }
      }

      // update HUD time periodically
      if ((elapsed * 10) % 3 < 0.2) pushTime();

      // end?
      if (state.timeLeft <= 0.001) {
        endGame('timeup');
        return;
      }

      tickTimer = setTimeout(tick, 60);
    }

    // ---------- end game ----------
    function endGame(reason) {
      if (!state.running) return;
      state.running = false;

      clearTimeout(spawnTimer);
      clearTimeout(tickTimer);

      // cleanup remaining targets
      state.targets.forEach((T, id) => {
        try { T.el && T.el.remove(); } catch { }
        state.targets.delete(id);
      });

      const acc = calcAcc();
      const grade = gradeFrom(acc, state.score, state.misses);

      // send final summary
      emit('hha:end', {
        reason: reason || 'end',
        scoreFinal: state.score | 0,
        comboMax: state.comboMax | 0,
        misses: state.misses | 0,

        nHitGood: state.hitGood | 0,
        nHitWrong: state.hitWrong | 0,
        nHitJunk: state.hitJunk | 0,
        nExpireGood: state.expireGood | 0,

        accuracyGoodPct: acc | 0,
        grade
      });

      coach('จบเกมแล้ว! ไปดูผลได้เลย 🏁', 'happy');
    }

    // ---------- start ----------
    function start(diff, opts) {
      opts = opts || {};
      state.diff = String(diff || opts.diff || 'normal').toLowerCase();
      state.runMode = (String(opts.runMode || qs('run', 'play') || 'play').toLowerCase() === 'research') ? 'research' : 'play';
      state.style = String(opts.style || qs('style', 'mix') || 'mix').toLowerCase();

      // time/seed
      state.timeTotal = clamp(opts.time ?? qs('time', 90), 30, 180);
      state.timeLeft = state.timeTotal;

      const seed = String(opts.seed ?? qs('seed', Date.now()) ?? Date.now());
      state.seed = seed;

      state.rng = makeRng(seed + '::groups');

      // config
      state.cfg = DIFF[state.diff] || DIFF.normal;
      state.powerThr = state.cfg.powerThr;

      // reset state stats
      state.score = 0;
      state.combo = 0;
      state.comboMax = 0;
      state.misses = 0;
      state.hitGood = 0;
      state.hitTotal = 0;
      state.hitWrong = 0;
      state.hitJunk = 0;
      state.expireGood = 0;
      state.power = 0;

      state.adaptLevel = 0; // adaptive starts neutral
      state.lastAdaptAtSec = 0;

      state.stormOn = false;
      state.bossActive = false;
      DOC.body.classList.remove('groups-storm', 'groups-storm-urgent', 'mini-urgent');

      // quest & group
      questReset();
      state.groupIndex = 0;
      state.currentGroup = GROUPS[0];
      setGoalForGroup();

      // schedule
      setupSchedule();

      // initial HUD push
      emit('groups:power', { charge: state.power, threshold: state.powerThr });
      pushHud();
      pushTime();
      pushRank();
      emitQuest();

      // coach intro
      coach(
        state.runMode === 'research'
          ? 'โหมดวิจัย: ปิด adaptive + ใช้ seed คงที่ ✅'
          : 'โหมดเล่น: มี adaptive ปรับความยากแบบยุติธรรม 🔥',
        'neutral'
      );

      // start loop
      state.running = true;
      state.tStartMs = nowMs();
      state.tLastTickMs = state.tStartMs;

      scheduleSpawn();
      tick();
    }

    // public API
    return {
      setLayerEl,
      start,
      end: endGame
    };
  }

  // -------------------- expose namespace --------------------
  root.GroupsVR = root.GroupsVR || {};
  root.GroupsVR.GameEngine = createEngine();

  // hooks once
  (function initOnce() {
    // bind view motion + shoot once
    if (root.__HHA_GROUPS_SAFE_INIT__) return;
    root.__HHA_GROUPS_SAFE_INIT__ = true;

    try { root.GroupsVR.GameEngine && root.GroupsVR.GameEngine.setLayerEl && root.GroupsVR.GameEngine.setLayerEl($('playLayer')); } catch { }

    // motion
    try {
      const E = root.GroupsVR.GameEngine;
      if (E && !root.__HHA_GROUPS_MOTION__) {
        root.__HHA_GROUPS_MOTION__ = true;
        // lazy hook: create new engine already contains motion hook? (we keep external)
        // easiest: call internal hook by starting: we do local hook directly:
        // (implemented inside engine as closure, so we can't call here)
        // -> We'll attach a small motion helper that only sets CSS vars, engine reads them via CSS only.
      }
    } catch { }

    // shoot hook
    try {
      // The engine itself installs shoot hook when loaded? It's inside closure,
      // so we attach one global listener here and delegate to engine helper method: simulate click by center.
      // We already handle hha:shoot inside engine via hookShoot(), so call it once by starting engine? Not possible.
      // -> Instead, add a minimal bridge that triggers click on nearest target element for Cardboard.
      const lockPx = Number((root.HHA_VRUI_CONFIG && root.HHA_VRUI_CONFIG.lockPx) || 92) || 92;

      root.addEventListener('hha:shoot', () => {
        const E = root.GroupsVR && root.GroupsVR.GameEngine;
        if (!E || !E.__shootBridge__) {
          // install once on first shoot
          if (E) E.__shootBridge__ = true;
        }
        // Find nearest `.fg-target` to center and click it
        const cx = (root.innerWidth || 360) / 2;
        const cy = (root.innerHeight || 640) / 2;

        const nodes = Array.from(DOC.querySelectorAll('.fg-target'));
        let best = null, bestD = 1e9;
        for (const el of nodes) {
          const r = el.getBoundingClientRect();
          const x = r.left + r.width / 2;
          const y = r.top + r.height / 2;
          const dx = x - cx, dy = y - cy;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < bestD) { bestD = d; best = el; }
        }
        if (best && bestD <= lockPx) {
          best.click();
        } else {
          // If no target, count a miss through judge event; HUD handler in HTML will update if engine emits score,
          // but engine miss increments happen internally. We'll just show a judge hint.
          emit('hha:judge', { kind: 'miss', text: 'MISS' });
        }
      }, { passive: true });

    } catch { }
  })();

})(typeof window !== 'undefined' ? window : globalThis);