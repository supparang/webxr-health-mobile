// === /herohealth/vr-groups/groups-solo-v8-spawn-merge.js ===
// HeroHealth Groups Solo — v8.2.1 Spawn Gate Fix
// FIX: no spawn before Start, no floating targets on Summary/End
// PATCH v20260512-GROUPS-SOLO-V821-SPAWN-GATE-FIX

(function () {
  'use strict';

  const VERSION = 'v8.2.1-spawn-gate-fix-20260512';

  if (window.__HHA_GROUPS_SOLO_V821_SPAWN_GATE_FIX__) {
    console.warn('[GroupsSolo v8.2.1] already installed');
    return;
  }
  window.__HHA_GROUPS_SOLO_V821_SPAWN_GATE_FIX__ = true;

  const WIN = window;
  const DOC = document;

  const FOOD_GROUPS = [
    { id: 1, key: 'protein', label: 'โปรตีน', icon: '🐟', emojis: ['🐟', '🥚', '🍗', '🥩', '🫘', '🥛'] },
    { id: 2, key: 'carb', label: 'ข้าว/แป้ง', icon: '🍚', emojis: ['🍚', '🍞', '🥔', '🍠', '🌽', '🍜'] },
    { id: 3, key: 'veg', label: 'ผัก', icon: '🥦', emojis: ['🥦', '🥬', '🥕', '🥒', '🍅', '🫛'] },
    { id: 4, key: 'fruit', label: 'ผลไม้', icon: '🍎', emojis: ['🍎', '🍌', '🍊', '🍇', '🍉', '🍓', '🥭', '🍍'] },
    { id: 5, key: 'fat', label: 'ไขมัน', icon: '🥑', emojis: ['🥑', '🥜', '🧈', '🫒', '🥥'] }
  ];

  const DECOYS = [
    { key: 'decoy', label: 'น้ำอัดลม', icon: '🥤' },
    { key: 'decoy', label: 'ลูกอม', icon: '🍬' },
    { key: 'decoy', label: 'โดนัท', icon: '🍩' },
    { key: 'decoy', label: 'เค้ก', icon: '🍰' },
    { key: 'decoy', label: 'เฟรนช์ฟรายส์', icon: '🍟' },
    { key: 'decoy', label: 'เบอร์เกอร์', icon: '🍔' }
  ];

  const state = {
    startedAt: Date.now(),
    installedAt: Date.now(),

    enabled: true,
    hasStarted: false,
    ended: false,
    paused: false,
    startArmed: false,

    spawnTimer: null,
    tickTimer: null,
    activeTargets: new Set(),

    spawned: 0,
    correct: 0,
    miss: 0,
    timeoutMiss: 0,
    decoyHit: 0,
    combo: 0,
    bestCombo: 0,
    scoreBonus: 0,
    streakMission: 0,
    bossBonus: 0,

    rng: null,
    layer: null,
    chip: null,
    lastStartAt: 0,
    lastFinishAt: 0
  };

  function qs(name, fallback = '') {
    try {
      const u = new URL(location.href);
      return u.searchParams.get(name) || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function clamp(n, min, max) {
    n = Number(n);
    if (!Number.isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
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

  function makeRng() {
    const seed = [
      qs('seed', 'groups-v821'),
      qs('pid', 'anon'),
      qs('diff', 'normal'),
      qs('time', '90'),
      VERSION
    ].join('|');

    const seedFn = xmur3(seed);
    return sfc32(seedFn(), seedFn(), seedFn(), seedFn());
  }

  function rnd() {
    if (!state.rng) state.rng = makeRng();
    return state.rng();
  }

  function pick(arr) {
    return arr[Math.floor(rnd() * arr.length) % arr.length];
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const cs = WIN.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 8 && r.height > 8;
  }

  function textOf(el) {
    return String(el ? el.textContent || '' : '').replace(/\s+/g, ' ').trim();
  }

  function looksLikeSummary() {
    const summarySelectors = [
      '#summary',
      '.summary',
      '.result',
      '.result-screen',
      '.game-over',
      '.end-screen',
      '[data-summary]',
      '[data-screen="summary"]',
      '[data-state="ended"]'
    ];

    for (const sel of summarySelectors) {
      const nodes = DOC.querySelectorAll(sel);
      for (const n of nodes) {
        if (!isVisible(n)) continue;
        const tx = textOf(n);
        if (
          tx.includes('สรุปผล') ||
          tx.includes('สรุปผลการเล่น') ||
          tx.includes('Hero Rank') ||
          tx.includes('Food Rookie') ||
          tx.includes('ดาว / คะแนน') ||
          tx.includes('ความแม่นยำ') ||
          tx.includes('คอมโบสูงสุด')
        ) {
          return true;
        }
      }
    }

    const bodyText = textOf(DOC.body);
    if (
      bodyText.includes('สรุปผลการเล่น') &&
      bodyText.includes('Hero Rank') &&
      bodyText.includes('ความแม่นยำ')
    ) {
      return true;
    }

    return false;
  }

  function looksLikeStartButton(el) {
    if (!el) return false;
    const target = el.closest ? el.closest('button,a,[role="button"],.btn,.button,[data-start],[data-action]') : null;
    if (!target || !isVisible(target)) return false;

    const tx = textOf(target).toLowerCase();
    const action = String(target.getAttribute('data-action') || target.getAttribute('data-start') || '').toLowerCase();

    return (
      action.includes('start') ||
      action.includes('play') ||
      tx.includes('เริ่ม') ||
      tx.includes('เล่น') ||
      tx.includes('start') ||
      tx.includes('play')
    );
  }

  function hasVisibleStartButton() {
    const nodes = DOC.querySelectorAll('button,a,[role="button"],.btn,.button,[data-start],[data-action]');
    for (const n of nodes) {
      if (looksLikeStartButton(n)) return true;
    }
    return false;
  }

  function isGameplayAllowed() {
    if (!state.enabled) return false;
    if (state.ended) return false;
    if (state.paused) return false;
    if (looksLikeSummary()) return false;

    /*
      จุดสำคัญ:
      - ถ้ายังไม่ได้กดเริ่ม และยังเห็นปุ่มเริ่มอยู่ = ห้าม spawn
      - ถ้า core ส่ง event start มาแล้ว = spawn ได้
    */
    if (!state.hasStarted && hasVisibleStartButton()) return false;
    if (!state.hasStarted) return false;

    return true;
  }

  function injectStyle() {
    if (DOC.getElementById('hha-groups-v821-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-groups-v821-style';
    style.textContent = `
      :root{
        --hha-v821-safe-top: env(safe-area-inset-top, 0px);
        --hha-v821-safe-bottom: env(safe-area-inset-bottom, 0px);
      }

      body.hha-groups-v821-spawn{
        overflow-x: hidden;
      }

      .hha-groups-v82-layer{
        position: fixed;
        inset: 0;
        z-index: 74000;
        pointer-events: none;
        overflow: hidden;
      }

      body:not(.hha-groups-v821-playing) .hha-groups-v82-layer,
      body.hha-groups-v821-ended .hha-groups-v82-layer{
        display: none !important;
      }

      .hha-groups-v82-target{
        position: absolute;
        width: clamp(52px, 9vw, 76px);
        height: clamp(52px, 9vw, 76px);
        border: 0;
        border-radius: 24px;
        display: grid;
        place-items: center;
        background: linear-gradient(145deg, rgba(255,255,255,.98), rgba(235,250,255,.94));
        box-shadow:
          0 14px 30px rgba(34,81,107,.18),
          inset 0 0 0 3px rgba(255,255,255,.8);
        color: #23516b;
        font-size: clamp(28px, 5vw, 42px);
        font-weight: 1000;
        pointer-events: auto;
        touch-action: manipulation;
        user-select: none;
        -webkit-user-select: none;
        cursor: pointer;
        transform: translate3d(0,0,0) scale(var(--target-scale, 1));
        animation:
          hhaV82Float var(--life, 3600ms) linear forwards,
          hhaV82Wiggle 1.4s ease-in-out infinite alternate;
        will-change: transform, opacity, filter;
      }

      .hha-groups-v82-target::after{
        content: attr(data-label);
        position: absolute;
        left: 50%;
        top: calc(100% + 4px);
        transform: translateX(-50%);
        max-width: 98px;
        padding: 3px 7px;
        border-radius: 999px;
        background: rgba(255,255,255,.9);
        box-shadow: 0 6px 14px rgba(34,81,107,.12);
        color: #23516b;
        font-size: 10px;
        font-weight: 1000;
        white-space: nowrap;
        opacity: .92;
      }

      .hha-groups-v82-target.mission{
        outline: 4px solid rgba(255,217,102,.82);
        background: linear-gradient(145deg,#fff8c7,#ffffff);
        box-shadow:
          0 0 0 9px rgba(255,217,102,.18),
          0 16px 34px rgba(34,81,107,.2);
      }

      .hha-groups-v82-target.decoy{
        background: linear-gradient(145deg,#fff,#fff0f0);
        outline: 3px solid rgba(255,159,159,.42);
        filter: saturate(.9);
      }

      .hha-groups-v82-target.boss{
        width: clamp(64px, 12vw, 94px);
        height: clamp(64px, 12vw, 94px);
        border-radius: 28px;
        animation:
          hhaV82FloatBoss var(--life, 3100ms) linear forwards,
          hhaV82BossPulse .68s ease-in-out infinite alternate;
      }

      .hha-groups-v82-target.hit{
        animation: hhaV82Hit .24s ease-out forwards !important;
      }

      .hha-groups-v82-target.miss{
        animation: hhaV82Miss .28s ease-out forwards !important;
      }

      .hha-groups-v82-chip{
        position: fixed;
        left: 10px;
        top: calc(10px + var(--hha-v821-safe-top));
        z-index: 99984;
        min-width: 132px;
        border-radius: 22px;
        padding: 9px 11px;
        background: linear-gradient(135deg, rgba(255,255,255,.94), rgba(238,250,255,.9));
        border: 2px solid rgba(255,255,255,.9);
        box-shadow: 0 16px 34px rgba(34,81,107,.16);
        color: #23516b;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        pointer-events: none;
        backdrop-filter: blur(10px);
      }

      body:not(.hha-groups-v821-playing) .hha-groups-v82-chip,
      body.hha-groups-v821-ended .hha-groups-v82-chip{
        display: none !important;
      }

      .hha-groups-v82-chip-main{
        font-size: 13px;
        line-height: 1.15;
        font-weight: 1000;
      }

      .hha-groups-v82-chip-sub{
        margin-top: 3px;
        font-size: 10px;
        line-height: 1.2;
        font-weight: 850;
        opacity: .8;
      }

      .hha-groups-v82-fx{
        position: fixed;
        left: 50%;
        top: 50%;
        z-index: 99998;
        pointer-events: none;
        transform: translate(-50%, -50%);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: clamp(20px, 5vw, 36px);
        font-weight: 1000;
        color: #23516b;
        text-shadow:
          0 2px 0 rgba(255,255,255,.9),
          0 10px 25px rgba(34,81,107,.16);
        animation: hhaV82Fx .78s ease-out forwards;
      }

      @keyframes hhaV82Float{
        0%{ opacity:0; transform:translate3d(0,18px,0) scale(calc(var(--target-scale,1) * .8)); }
        10%{ opacity:1; transform:translate3d(0,0,0) scale(var(--target-scale,1)); }
        80%{ opacity:1; transform:translate3d(var(--drift,0px),var(--fall,80px),0) scale(var(--target-scale,1)); }
        100%{ opacity:0; transform:translate3d(var(--drift,0px),calc(var(--fall,80px) + 40px),0) scale(calc(var(--target-scale,1) * .84)); }
      }

      @keyframes hhaV82FloatBoss{
        0%{ opacity:0; transform:translate3d(0,18px,0) scale(.85); }
        10%{ opacity:1; transform:translate3d(0,0,0) scale(1.05); }
        78%{ opacity:1; transform:translate3d(var(--drift,0px),var(--fall,100px),0) scale(1.05); }
        100%{ opacity:0; transform:translate3d(var(--drift,0px),calc(var(--fall,100px) + 44px),0) scale(.9); }
      }

      @keyframes hhaV82Wiggle{
        from{ rotate:-2deg; }
        to{ rotate:2deg; }
      }

      @keyframes hhaV82BossPulse{
        from{ filter:saturate(1.05) brightness(1); transform:scale(1); }
        to{ filter:saturate(1.3) brightness(1.05); transform:scale(1.08); }
      }

      @keyframes hhaV82Hit{
        0%{ opacity:1; transform:scale(1); }
        60%{ opacity:1; transform:scale(1.3); filter:brightness(1.12); }
        100%{ opacity:0; transform:scale(.2); }
      }

      @keyframes hhaV82Miss{
        0%{ opacity:1; transform:translateX(0) scale(1); }
        35%{ transform:translateX(-8px) scale(1.04); }
        70%{ transform:translateX(8px) scale(.96); }
        100%{ opacity:0; transform:translateX(0) scale(.4); }
      }

      @keyframes hhaV82Fx{
        0%{ opacity:0; transform:translate(-50%,-40%) scale(.7); }
        18%{ opacity:1; transform:translate(-50%,-70%) scale(1.12); }
        100%{ opacity:0; transform:translate(-50%,-130%) scale(.9); }
      }

      @media (max-width:640px){
        .hha-groups-v82-chip{
          top: calc(54px + var(--hha-v821-safe-top));
          left: 8px;
          min-width: 112px;
          padding: 7px 9px;
          border-radius: 18px;
        }

        .hha-groups-v82-chip-main{ font-size:11px; }
        .hha-groups-v82-chip-sub{ font-size:9px; }
        .hha-groups-v82-target::after{ display:none; }
      }
    `;

    DOC.head.appendChild(style);
    DOC.body.classList.add('hha-groups-v821-spawn');
  }

  function ensureLayer() {
    if (state.layer && state.layer.isConnected) return state.layer;

    let layer = DOC.getElementById('hha-groups-v82-layer');
    if (!layer) {
      layer = DOC.createElement('div');
      layer.id = 'hha-groups-v82-layer';
      layer.className = 'hha-groups-v82-layer';
      DOC.body.appendChild(layer);
    }

    state.layer = layer;
    return layer;
  }

  function ensureChip() {
    if (state.chip && state.chip.isConnected) return state.chip;

    let chip = DOC.getElementById('hha-groups-v82-chip');
    if (!chip) {
      chip = DOC.createElement('div');
      chip.id = 'hha-groups-v82-chip';
      chip.className = 'hha-groups-v82-chip';
      chip.innerHTML = `
        <div class="hha-groups-v82-chip-main" data-v82-main>Bonus +0</div>
        <div class="hha-groups-v82-chip-sub" data-v82-sub>Groups v8.2.1</div>
      `;
      DOC.body.appendChild(chip);
    }

    state.chip = chip;
    return chip;
  }

  function getV81State() {
    try {
      if (WIN.HHA_GROUPS_V81 && typeof WIN.HHA_GROUPS_V81.getState === 'function') {
        return WIN.HHA_GROUPS_V81.getState();
      }
    } catch (e) {}
    return {};
  }

  function getTuning() {
    let tuning = {};

    try {
      if (WIN.HHA_GROUPS_V81 && typeof WIN.HHA_GROUPS_V81.getTuning === 'function') {
        tuning = WIN.HHA_GROUPS_V81.getTuning() || {};
      } else if (WIN.HHA_GROUPS_CORE_TUNING) {
        tuning = WIN.HHA_GROUPS_CORE_TUNING || {};
      } else if (WIN.HHA_GROUPS_V8 && typeof WIN.HHA_GROUPS_V8.getTuning === 'function') {
        tuning = WIN.HHA_GROUPS_V8.getTuning() || {};
      }
    } catch (e) {}

    const diff = String(qs('diff', 'normal')).toLowerCase();

    const out = Object.assign({
      phase: 'warm',
      wave: 1,
      spawnMs: 980,
      fallSpeed: 1,
      distractorRate: 0.22,
      targetScale: 1,
      boss: false,
      fever: false
    }, tuning);

    if (diff === 'easy') {
      out.spawnMs = Math.max(out.spawnMs, 1050);
      out.distractorRate = Math.min(out.distractorRate, 0.16);
      out.fallSpeed = Math.min(out.fallSpeed, 0.92);
    }

    if (diff === 'hard') {
      out.spawnMs = Math.min(out.spawnMs, 790);
      out.distractorRate = Math.max(out.distractorRate, 0.3);
      out.fallSpeed = Math.max(out.fallSpeed, 1.15);
    }

    if (diff === 'challenge') {
      out.spawnMs = Math.min(out.spawnMs, 640);
      out.distractorRate = Math.max(out.distractorRate, 0.38);
      out.fallSpeed = Math.max(out.fallSpeed, 1.3);
    }

    return out;
  }

  function getMissionTarget() {
    const s = getV81State();

    if (s && s.missionTarget && s.missionTarget.key) {
      const found = FOOD_GROUPS.find(g => g.key === s.missionTarget.key);
      if (found) return found;
    }

    const tuning = WIN.HHA_GROUPS_CORE_TUNING || {};
    const mission = tuning.mission || {};

    if (mission.key) {
      const found = FOOD_GROUPS.find(g => g.key === mission.key);
      if (found) return found;
    }

    const idx = Math.floor((Date.now() - state.startedAt) / 20000) % FOOD_GROUPS.length;
    return FOOD_GROUPS[idx];
  }

  function currentPhase() {
    return String(getTuning().phase || 'warm');
  }

  function updateChip() {
    const chip = ensureChip();
    const main = chip.querySelector('[data-v82-main]');
    const sub = chip.querySelector('[data-v82-sub]');

    const phase = currentPhase();
    const mission = getMissionTarget();

    main.textContent = `Bonus +${state.scoreBonus} • x${state.combo}`;
    sub.textContent = `${phase.toUpperCase()} • ${mission.icon} ${mission.label}`;
  }

  function fx(text, x, y) {
    if (state.ended || looksLikeSummary()) return;

    const el = DOC.createElement('div');
    el.className = 'hha-groups-v82-fx';
    el.textContent = text;
    el.style.left = Math.round(x || WIN.innerWidth / 2) + 'px';
    el.style.top = Math.round(y || WIN.innerHeight / 2) + 'px';

    DOC.body.appendChild(el);

    setTimeout(() => el.remove(), 850);
  }

  function getBounds() {
    const w = Math.max(320, WIN.innerWidth || DOC.documentElement.clientWidth || 360);
    const h = Math.max(420, WIN.innerHeight || DOC.documentElement.clientHeight || 640);

    const topPad = w <= 640 ? 112 : 96;
    const bottomPad = w <= 640 ? 120 : 90;

    return {
      w,
      h,
      left: 16,
      right: w - 92,
      top: topPad,
      bottom: h - bottomPad
    };
  }

  function chooseSpawnFood() {
    const tuning = getTuning();
    const mission = getMissionTarget();
    const phase = currentPhase();

    let decoyRate = Number(tuning.distractorRate || 0.22);
    if (phase === 'storm') decoyRate += 0.05;
    if (phase === 'boss') decoyRate += 0.1;
    decoyRate = clamp(decoyRate, 0.08, 0.55);

    if (rnd() < decoyRate) {
      const d = pick(DECOYS);
      return {
        kind: 'decoy',
        key: d.key,
        label: d.label,
        icon: d.icon,
        decoy: true,
        mission: false
      };
    }

    const missionRate = phase === 'boss' ? 0.68 : phase === 'storm' ? 0.55 : 0.45;
    const group = rnd() < missionRate ? mission : pick(FOOD_GROUPS);
    const icon = pick(group.emojis);

    return {
      kind: 'food',
      key: group.key,
      label: group.label,
      icon,
      groupId: group.id,
      decoy: false,
      mission: group.key === mission.key
    };
  }

  function activeLimit() {
    const phase = currentPhase();
    const diff = String(qs('diff', 'normal')).toLowerCase();

    let max = 4;
    if (phase === 'storm') max = 5;
    if (phase === 'boss') max = 6;
    if (diff === 'easy') max -= 1;
    if (diff === 'challenge') max += 1;
    if (WIN.innerWidth <= 640) max = Math.max(3, max - 1);

    return clamp(max, 3, 7);
  }

  function targetLifeMs() {
    const t = getTuning();
    const phase = currentPhase();

    let life = 3900 / Math.max(0.75, Number(t.fallSpeed || 1));
    if (phase === 'storm') life *= 0.86;
    if (phase === 'boss') life *= 0.72;

    return Math.round(clamp(life, 1700, 4600));
  }

  function spawnDelayMs() {
    const t = getTuning();
    const phase = currentPhase();

    let ms = Number(t.spawnMs || 950);
    if (phase === 'storm') ms *= 0.86;
    if (phase === 'boss') ms *= 0.72;
    if (WIN.innerWidth <= 640) ms *= 1.05;

    return Math.round(clamp(ms, 430, 1300));
  }

  function classifyPoint(evOrPoint) {
    return {
      x: Number(evOrPoint?.clientX || evOrPoint?.x || WIN.innerWidth / 2),
      y: Number(evOrPoint?.clientY || evOrPoint?.y || WIN.innerHeight / 2)
    };
  }

  function dispatchJudge(ok, target, point, reason) {
    const detail = {
      ok: Boolean(ok),
      correct: Boolean(ok),
      result: ok ? 'correct' : 'wrong',
      source: VERSION,
      reason: reason || '',
      target,
      el: target,
      point: point || { x: WIN.innerWidth / 2, y: WIN.innerHeight / 2 },
      bonus: state.scoreBonus
    };

    try {
      WIN.dispatchEvent(new CustomEvent(ok ? 'groups:correct' : 'groups:miss', { detail }));
      WIN.dispatchEvent(new CustomEvent('groups:v82:judge', { detail }));
    } catch (e) {}
  }

  function removeTarget(target) {
    if (!target || !target.isConnected) return;
    if (target.__hhaV82Removed) return;

    target.__hhaV82Removed = true;
    clearTimeout(target.__hhaV82Timeout);

    state.activeTargets.delete(target);
    target.remove();
  }

  function killAllTargets(reason) {
    clearTimeout(state.spawnTimer);
    state.spawnTimer = null;

    const all = DOC.querySelectorAll('.hha-groups-v82-target,[data-hha-v82-target="1"]');
    all.forEach(el => {
      clearTimeout(el.__hhaV82Timeout);
      state.activeTargets.delete(el);
      el.remove();
    });

    state.activeTargets.clear();

    if (reason === 'end' || reason === 'summary') {
      DOC.body.classList.remove('hha-groups-v821-playing');
      DOC.body.classList.add('hha-groups-v821-ended');
    }
  }

  function applyCorrect(target, point) {
    if (!isGameplayAllowed()) {
      removeTarget(target);
      return;
    }

    if (!target || target.dataset.dead === '1') return;
    target.dataset.dead = '1';

    const isMission = target.dataset.mission === '1';
    const isBoss = target.dataset.boss === '1';

    state.correct += 1;
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);

    let gain = 2 + Math.min(state.combo, 8);

    if (isMission) {
      gain += 4;
      state.streakMission += 1;
    }

    if (isBoss) {
      gain += 6;
      state.bossBonus += 1;
    }

    if (state.streakMission > 0 && state.streakMission % 3 === 0) {
      gain += 10;
      fx('⭐ Mission Streak!', point.x, point.y - 18);
    }

    state.scoreBonus += gain;

    target.classList.add('hit');
    fx(`+${gain}`, point.x, point.y);

    dispatchJudge(true, target, point, isMission ? 'mission-food' : 'bonus-food');

    setTimeout(() => removeTarget(target), 210);
    updateChip();
  }

  function applyMiss(target, point, reason) {
    if (!isGameplayAllowed()) {
      removeTarget(target);
      return;
    }

    if (!target || target.dataset.dead === '1') return;
    target.dataset.dead = '1';

    state.miss += 1;
    state.combo = 0;
    state.streakMission = 0;

    if (reason === 'decoy') state.decoyHit += 1;
    if (reason === 'timeout') state.timeoutMiss += 1;

    target.classList.add('miss');

    const label =
      reason === 'decoy'
        ? 'ตัวหลอก!'
        : reason === 'timeout'
          ? 'พลาดภารกิจ!'
          : 'ลองใหม่!';

    fx(label, point.x, point.y);

    dispatchJudge(false, target, point, reason || 'miss');

    setTimeout(() => removeTarget(target), 260);
    updateChip();
  }

  function makeTargetElement(food) {
    if (!isGameplayAllowed()) return null;

    const layer = ensureLayer();
    const b = getBounds();
    const t = getTuning();
    const phase = currentPhase();

    const size = phase === 'boss' ? 86 : 68;
    const x = Math.round(b.left + rnd() * Math.max(1, b.right - b.left));
    const y = Math.round(b.top + rnd() * Math.max(1, b.bottom - b.top));
    const drift = Math.round((rnd() - 0.5) * 72);
    const fall = Math.round(55 + rnd() * 105);
    const life = targetLifeMs();

    const btn = DOC.createElement('button');
    btn.type = 'button';
    btn.className = 'hha-groups-v82-target';

    if (food.decoy) btn.classList.add('decoy');
    if (food.mission) btn.classList.add('mission');
    if (phase === 'boss') btn.classList.add('boss');

    btn.textContent = food.icon;
    btn.setAttribute('aria-label', `${food.icon} ${food.label}`);
    btn.dataset.label = food.label;
    btn.dataset.group = food.key;
    btn.dataset.foodGroup = food.key;
    btn.dataset.kind = food.decoy ? 'decoy' : 'food';
    btn.dataset.decoy = food.decoy ? '1' : '0';
    btn.dataset.mission = food.mission ? '1' : '0';
    btn.dataset.boss = phase === 'boss' ? '1' : '0';
    btn.dataset.hhaV82Target = '1';
    btn.dataset.hhaV81Target = '1';
    btn.dataset.hhaFoodTarget = '1';

    btn.style.left = x + 'px';
    btn.style.top = y + 'px';
    btn.style.setProperty('--drift', drift + 'px');
    btn.style.setProperty('--fall', fall + 'px');
    btn.style.setProperty('--life', life + 'ms');
    btn.style.setProperty('--target-scale', String(t.targetScale || 1));

    btn.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();

      const point = classifyPoint(ev);

      if (btn.dataset.decoy === '1') {
        applyMiss(btn, point, 'decoy');
      } else {
        applyCorrect(btn, point);
      }
    }, { capture: true });

    btn.__hhaV82Timeout = setTimeout(function () {
      if (!btn || !btn.isConnected || btn.dataset.dead === '1') return;

      if (!isGameplayAllowed()) {
        removeTarget(btn);
        return;
      }

      const isMission = btn.dataset.mission === '1';
      const isDecoy = btn.dataset.decoy === '1';

      if (isMission && !isDecoy) {
        applyMiss(btn, { x: x + size / 2, y: y + size / 2 }, 'timeout');
      } else {
        removeTarget(btn);
      }
    }, life);

    layer.appendChild(btn);

    state.activeTargets.add(btn);
    state.spawned += 1;

    return btn;
  }

  function spawnOne() {
    if (!isGameplayAllowed()) {
      killAllTargets('not-playing');
      return null;
    }

    if (state.activeTargets.size >= activeLimit()) return null;

    return makeTargetElement(chooseSpawnFood());
  }

  function spawnBurst(count) {
    if (!isGameplayAllowed()) return;

    count = clamp(count || 1, 1, 5);

    for (let i = 0; i < count; i++) {
      setTimeout(function () {
        if (isGameplayAllowed()) spawnOne();
      }, i * 140);
    }
  }

  function spawnLoop() {
    clearTimeout(state.spawnTimer);
    state.spawnTimer = null;

    if (!isGameplayAllowed()) {
      killAllTargets('not-playing');
      return;
    }

    state.spawnTimer = setTimeout(function () {
      if (!isGameplayAllowed()) {
        killAllTargets('not-playing');
        return;
      }

      spawnOne();

      const phase = currentPhase();

      if (phase === 'boss' && rnd() < 0.28) {
        setTimeout(() => {
          if (isGameplayAllowed()) spawnOne();
        }, 180);
      }

      if (phase === 'storm' && rnd() < 0.18) {
        setTimeout(() => {
          if (isGameplayAllowed()) spawnOne();
        }, 220);
      }

      spawnLoop();
    }, spawnDelayMs());
  }

  function startSpawning(reason) {
    if (state.ended || looksLikeSummary()) {
      finish({ reason: 'summary-before-start' });
      return;
    }

    const now = Date.now();
    if (now - state.lastStartAt < 500) return;
    state.lastStartAt = now;

    state.hasStarted = true;
    state.paused = false;
    state.startArmed = true;

    DOC.body.classList.add('hha-groups-v821-playing');
    DOC.body.classList.remove('hha-groups-v821-ended');

    updateChip();

    setTimeout(function () {
      if (!isGameplayAllowed()) return;
      spawnBurst(2);
      spawnLoop();
    }, 650);

    console.info('[GroupsSolo v8.2.1] spawn started:', reason || 'unknown');
  }

  function pause() {
    state.paused = true;
    clearTimeout(state.spawnTimer);
    state.spawnTimer = null;
  }

  function resume() {
    if (state.ended || looksLikeSummary()) return;
    state.paused = false;

    if (state.hasStarted) {
      DOC.body.classList.add('hha-groups-v821-playing');
      spawnLoop();
    }
  }

  function finish(summary) {
    const now = Date.now();
    if (now - state.lastFinishAt < 500) return;
    state.lastFinishAt = now;

    state.ended = true;
    state.paused = true;
    state.enabled = false;

    killAllTargets('end');

    const out = Object.assign({}, summary || {}, {
      game: 'groups',
      mode: 'solo',
      patch: VERSION,
      spawnedV82: state.spawned,
      correctV82: state.correct,
      missV82: state.miss,
      timeoutMissV82: state.timeoutMiss,
      decoyHitV82: state.decoyHit,
      bestComboV82: state.bestCombo,
      scoreBonusV82: state.scoreBonus,
      bossBonusV82: state.bossBonus,
      durationSecV82: Math.round((Date.now() - state.startedAt) / 1000)
    });

    try {
      localStorage.setItem('HHA_GROUPS_V82_SUMMARY', JSON.stringify({
        ts: new Date().toISOString(),
        summary: out
      }));

      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
        ts: new Date().toISOString(),
        game: 'groups',
        mode: 'solo',
        summary: out
      }));
    } catch (e) {}

    try {
      WIN.dispatchEvent(new CustomEvent('groups:v82:end', { detail: out }));
      WIN.dispatchEvent(new CustomEvent('hha:summary-enriched', { detail: out }));
    } catch (e) {}

    updateChip();
  }

  function maybeDetectEndScreen() {
    if (state.ended) return;

    if (looksLikeSummary()) {
      finish({
        detectedEndScreen: true,
        text: textOf(DOC.body).slice(0, 500)
      });
    }
  }

  function installStartGuards() {
    DOC.addEventListener('click', function (ev) {
      if (state.ended) return;

      if (looksLikeStartButton(ev.target)) {
        startSpawning('start-button-click');
      }
    }, true);

    WIN.addEventListener('groups:start', () => startSpawning('groups:start'));
    WIN.addEventListener('hha:start', () => startSpawning('hha:start'));
    WIN.addEventListener('game:start', () => startSpawning('game:start'));

    WIN.addEventListener('groups:play', () => startSpawning('groups:play'));
    WIN.addEventListener('hha:play', () => startSpawning('hha:play'));

    /*
      ถ้า core ไม่มี start event แต่เปลี่ยน body class ตอนเริ่ม
      ให้ตรวจซ้ำ แต่ยังไม่ spawn ถ้ายังมีปุ่มเริ่มหรือหน้า summary อยู่
    */
    setInterval(function () {
      if (state.hasStarted || state.ended) return;
      if (looksLikeSummary()) {
        finish({ reason: 'summary-detected-before-start' });
        return;
      }

      const bodyClass = String(DOC.body.className || '').toLowerCase();
      const coreLooksPlaying =
        bodyClass.includes('playing') ||
        bodyClass.includes('gameplay') ||
        bodyClass.includes('running') ||
        DOC.querySelector('[data-state="playing"],[data-screen="gameplay"],.gameplay,.hud,.game-hud');

      if (coreLooksPlaying && !hasVisibleStartButton()) {
        startSpawning('core-playing-detected');
      }
    }, 500);
  }

  function installEventHooks() {
    WIN.addEventListener('groups:end', ev => finish(ev.detail || {}));
    WIN.addEventListener('hha:end', ev => finish(ev.detail || {}));
    WIN.addEventListener('game:end', ev => finish(ev.detail || {}));

    WIN.addEventListener('groups:summary', ev => finish(ev.detail || {}));
    WIN.addEventListener('hha:summary', ev => finish(ev.detail || {}));

    WIN.addEventListener('groups:pause', pause);
    WIN.addEventListener('hha:pause', pause);
    WIN.addEventListener('game:pause', pause);

    WIN.addEventListener('groups:resume', resume);
    WIN.addEventListener('hha:resume', resume);
    WIN.addEventListener('game:resume', resume);

    WIN.addEventListener('groups:v81:mission-clear', function () {
      if (isGameplayAllowed()) spawnBurst(2);
    });

    WIN.addEventListener('groups:v81:boss-clear', function () {
      if (isGameplayAllowed()) spawnBurst(4);
    });

    DOC.addEventListener('visibilitychange', function () {
      if (DOC.hidden) pause();
      else resume();
    });

    WIN.addEventListener('pagehide', function () {
      killAllTargets('pagehide');
    });
  }

  function publicApi() {
    WIN.HHA_GROUPS_V82 = {
      version: VERSION,

      getState: function () {
        return {
          version: VERSION,
          enabled: state.enabled,
          hasStarted: state.hasStarted,
          ended: state.ended,
          paused: state.paused,
          spawned: state.spawned,
          active: state.activeTargets.size,
          correct: state.correct,
          miss: state.miss,
          timeoutMiss: state.timeoutMiss,
          decoyHit: state.decoyHit,
          combo: state.combo,
          bestCombo: state.bestCombo,
          scoreBonus: state.scoreBonus,
          phase: currentPhase(),
          playing: isGameplayAllowed(),
          summaryVisible: looksLikeSummary(),
          startButtonVisible: hasVisibleStartButton(),
          tuning: getTuning(),
          mission: getMissionTarget()
        };
      },

      start: function () {
        startSpawning('api-start');
      },

      spawnOne: spawnOne,

      spawnBurst: spawnBurst,

      pause: pause,

      resume: resume,

      finish: finish,

      killAllTargets: function () {
        killAllTargets('api');
      },

      setEnabled: function (v) {
        state.enabled = Boolean(v);

        if (!state.enabled) {
          killAllTargets('disabled');
        } else if (state.hasStarted && !state.ended) {
          resume();
        }
      }
    };
  }

  function tick() {
    maybeDetectEndScreen();

    if (!isGameplayAllowed()) {
      killAllTargets(looksLikeSummary() ? 'summary' : 'not-playing');
    }

    updateChip();

    WIN.HHA_GROUPS_V82_TUNING = Object.assign({}, getTuning(), {
      source: VERSION,
      activeV82: state.activeTargets.size,
      spawnedV82: state.spawned,
      scoreBonusV82: state.scoreBonus,
      playingV82: isGameplayAllowed()
    });
  }

  function init() {
    const path = location.pathname.toLowerCase();
    const game = qs('game', 'groups').toLowerCase();
    const mode = qs('mode', 'solo').toLowerCase();

    if (!(path.includes('groups') || game === 'groups' || mode === 'solo')) return;

    state.rng = makeRng();

    injectStyle();
    ensureLayer();
    ensureChip();

    installStartGuards();
    installEventHooks();
    publicApi();

    /*
      สำคัญมาก:
      v8.2.1 ไม่ spawn ตอน init แล้ว
      รอ start button / start event ก่อนเท่านั้น
    */
    killAllTargets('init-before-start');

    state.tickTimer = setInterval(tick, 400);

    console.info('[GroupsSolo v8.2.1] spawn gate fix installed', {
      version: VERSION,
      message: 'Spawn waits for Start and clears on Summary/End.'
    });
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
