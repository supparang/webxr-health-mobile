// === /herohealth/vr-groups/groups-solo-v8-core-hooks.js ===
// HeroHealth Groups Solo — v8.1 Core Hook Pack
// Safe gameplay hook layer: spawn tuning + mission engine + boss pressure + end enrichment
// PATCH v20260511-GROUPS-SOLO-V81-CORE-HOOKS

(function () {
  'use strict';

  const VERSION = 'v8.1-core-hooks-20260511';

  if (window.__HHA_GROUPS_SOLO_V81_CORE_HOOKS__) {
    console.warn('[GroupsSolo v8.1] already installed');
    return;
  }

  window.__HHA_GROUPS_SOLO_V81_CORE_HOOKS__ = true;

  const WIN = window;
  const DOC = document;

  const FOOD_GROUPS = [
    {
      id: 1,
      key: 'protein',
      label: 'โปรตีน',
      icon: '🐟',
      emojis: ['🐟', '🥚', '🍗', '🥩', '🫘', '🥜', '🥛']
    },
    {
      id: 2,
      key: 'carb',
      label: 'ข้าว/แป้ง',
      icon: '🍚',
      emojis: ['🍚', '🍞', '🥔', '🍠', '🌽', '🥖', '🍜']
    },
    {
      id: 3,
      key: 'veg',
      label: 'ผัก',
      icon: '🥦',
      emojis: ['🥦', '🥬', '🥕', '🥒', '🍅', '🌽', '🫛']
    },
    {
      id: 4,
      key: 'fruit',
      label: 'ผลไม้',
      icon: '🍎',
      emojis: ['🍎', '🍌', '🍊', '🍇', '🍉', '🍓', '🥭', '🍍']
    },
    {
      id: 5,
      key: 'fat',
      label: 'ไขมัน',
      icon: '🥑',
      emojis: ['🥑', '🥜', '🧈', '🫒', '🥥']
    }
  ];

  const BAD_OR_DECOY = ['🍩', '🍰', '🍬', '🍭', '🥤', '🍟', '🍕', '🍔'];

  const state = {
    installedAt: Date.now(),
    startedAt: Date.now(),

    hookedFns: [],
    patchedNodes: 0,

    phase: 'warm',
    wave: 1,
    fever: false,
    boss: false,

    scoreBonus: 0,
    correct: 0,
    miss: 0,
    combo: 0,
    bestCombo: 0,

    missionIndex: 0,
    missionStartedAt: Date.now(),
    missionTarget: null,
    missionNeed: 3,
    missionGot: 0,
    missionDone: 0,

    bossMeter: 0,
    bossCleared: false,

    lastPointerAt: 0,
    lastToastAt: 0,
    lastSummaryAt: 0
  };

  function qs(name, fallback = '') {
    try {
      const u = new URL(location.href);
      return u.searchParams.get(name) || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, function (m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[m];
    });
  }

  function clamp(n, min, max) {
    n = Number(n);
    if (!Number.isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function nowSec() {
    return Math.floor((Date.now() - state.startedAt) / 1000);
  }

  function gameDuration() {
    return clamp(Number(qs('time', '90')) || 90, 30, 600);
  }

  function remainSec() {
    return Math.max(0, gameDuration() - nowSec());
  }

  function getDiff() {
    const d = String(qs('diff', 'normal')).toLowerCase();
    return ['easy', 'normal', 'hard', 'challenge'].includes(d) ? d : 'normal';
  }

  function getTuning() {
    const fromV8 =
      WIN.HHA_GROUPS_V8 &&
      typeof WIN.HHA_GROUPS_V8.getTuning === 'function'
        ? WIN.HHA_GROUPS_V8.getTuning()
        : null;

    const diff = getDiff();

    const tuning = Object.assign({
      version: VERSION,
      phase: state.phase,
      wave: state.wave,

      spawnMs: 980,
      fallSpeed: 1,
      targetScale: 1,
      distractorRate: 0.22,
      missionSeconds: 24,
      missionNeed: 3,
      bossWindowSec: Math.max(18, Math.floor(gameDuration() * 0.28)),
      bossNeed: 6
    }, fromV8 || {});

    if (diff === 'easy') {
      tuning.spawnMs = Math.max(tuning.spawnMs, 1080);
      tuning.fallSpeed = Math.min(tuning.fallSpeed, 0.95);
      tuning.distractorRate = Math.min(tuning.distractorRate, 0.18);
      tuning.missionNeed = 2;
    }

    if (diff === 'hard') {
      tuning.spawnMs = Math.min(tuning.spawnMs, 820);
      tuning.fallSpeed = Math.max(tuning.fallSpeed, 1.15);
      tuning.distractorRate = Math.max(tuning.distractorRate, 0.3);
      tuning.missionNeed = 4;
    }

    if (diff === 'challenge') {
      tuning.spawnMs = Math.min(tuning.spawnMs, 700);
      tuning.fallSpeed = Math.max(tuning.fallSpeed, 1.28);
      tuning.distractorRate = Math.max(tuning.distractorRate, 0.36);
      tuning.missionNeed = 5;
    }

    if (state.phase === 'storm') {
      tuning.spawnMs = Math.max(540, Math.floor(tuning.spawnMs * 0.84));
      tuning.fallSpeed += 0.18;
      tuning.distractorRate = Math.min(0.48, tuning.distractorRate + 0.08);
    }

    if (state.phase === 'boss') {
      tuning.spawnMs = Math.max(460, Math.floor(tuning.spawnMs * 0.72));
      tuning.fallSpeed += 0.34;
      tuning.targetScale = 1.08;
      tuning.distractorRate = Math.min(0.52, tuning.distractorRate + 0.12);
      tuning.missionSeconds = 18;
    }

    if (state.fever) {
      tuning.spawnMs = Math.max(430, Math.floor(tuning.spawnMs * 0.88));
      tuning.targetScale = Math.max(tuning.targetScale, 1.04);
    }

    tuning.phase = state.phase;
    tuning.wave = state.wave;
    tuning.fever = state.fever;
    tuning.boss = state.boss;

    return tuning;
  }

  function injectStyle() {
    if (DOC.getElementById('hha-groups-v81-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-groups-v81-style';
    style.textContent = `
      :root{
        --hha-groups-v81-speed: 1;
        --hha-groups-v81-scale: 1;
        --hha-groups-v81-safe-top: env(safe-area-inset-top, 0px);
        --hha-groups-v81-safe-bottom: env(safe-area-inset-bottom, 0px);
      }

      body.hha-groups-v81{
        --hha-food-shadow: 0 12px 28px rgba(35, 81, 107, .16);
      }

      body.hha-groups-v81 [data-hha-v81-target="1"]{
        transform: scale(var(--hha-groups-v81-scale));
        transition:
          transform .14s ease,
          filter .14s ease,
          box-shadow .14s ease,
          opacity .14s ease;
        box-shadow: var(--hha-food-shadow);
      }

      body.hha-groups-v81 [data-hha-v81-target="1"].hha-v81-priority{
        outline: 4px solid rgba(255, 217, 102, .78);
        box-shadow:
          0 0 0 8px rgba(255, 217, 102, .2),
          0 14px 34px rgba(35, 81, 107, .2);
      }

      body.hha-groups-v81 [data-hha-v81-target="1"].hha-v81-decoy{
        filter: saturate(.88) contrast(.95);
        opacity: .9;
      }

      body.hha-groups-v81 [data-hha-v81-target="1"].hha-v81-hit{
        animation: hhaV81Hit .26s ease both;
      }

      body.hha-groups-v81 [data-hha-v81-target="1"].hha-v81-miss{
        animation: hhaV81Miss .32s ease both;
      }

      .hha-groups-v81-mission{
        position: fixed;
        top: calc(86px + var(--hha-groups-v81-safe-top));
        right: 10px;
        z-index: 99981;
        width: min(300px, calc(100vw - 20px));
        border-radius: 24px;
        padding: 10px 12px;
        background: linear-gradient(135deg, rgba(255,255,255,.94), rgba(238,250,255,.9));
        border: 2px solid rgba(255,255,255,.92);
        box-shadow: 0 16px 38px rgba(35,81,107,.16);
        color: #23516b;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        pointer-events: none;
        backdrop-filter: blur(10px);
      }

      .hha-groups-v81-mission-title{
        font-size: 12px;
        font-weight: 1000;
        opacity: .82;
        margin-bottom: 4px;
      }

      .hha-groups-v81-mission-main{
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 15px;
        font-weight: 1000;
      }

      .hha-groups-v81-progress{
        position: relative;
        height: 10px;
        margin-top: 8px;
        border-radius: 999px;
        background: rgba(105, 181, 222, .2);
        overflow: hidden;
      }

      .hha-groups-v81-progress > i{
        position: absolute;
        inset: 0 auto 0 0;
        width: 0%;
        border-radius: inherit;
        background: linear-gradient(90deg, #7ed957, #ffd966);
        transition: width .2s ease;
      }

      .hha-groups-v81-bossbar{
        position: fixed;
        left: 50%;
        top: calc(10px + var(--hha-groups-v81-safe-top));
        transform: translateX(-50%);
        z-index: 99982;
        width: min(420px, calc(100vw - 24px));
        border-radius: 999px;
        padding: 8px;
        background: rgba(255,255,255,.9);
        box-shadow: 0 14px 34px rgba(35,81,107,.16);
        display: none;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      body.hha-v81-boss .hha-groups-v81-bossbar{
        display: block;
      }

      .hha-groups-v81-bossbar-label{
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        font-weight: 1000;
        color: #6b4c00;
        padding: 0 5px 5px;
      }

      .hha-groups-v81-bossbar-track{
        position: relative;
        height: 12px;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(255,217,102,.25);
      }

      .hha-groups-v81-bossbar-track > i{
        position: absolute;
        inset: 0 auto 0 0;
        width: 0%;
        background: linear-gradient(90deg, #ffd966, #ff9f43, #7ed957);
        border-radius: inherit;
        transition: width .22s ease;
      }

      .hha-groups-v81-toast{
        position: fixed;
        left: 50%;
        top: 31%;
        transform: translate(-50%, -50%) scale(.98);
        z-index: 99996;
        pointer-events: none;
        padding: 12px 18px;
        border-radius: 24px;
        background: rgba(255,255,255,.95);
        color: #23516b;
        box-shadow: 0 18px 44px rgba(35,81,107,.18);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: clamp(18px, 4.4vw, 34px);
        font-weight: 1000;
        opacity: 0;
      }

      .hha-groups-v81-toast.show{
        animation: hhaV81Toast .74s ease both;
      }

      .hha-groups-v81-pop{
        position: fixed;
        left: 50%;
        top: 50%;
        z-index: 99997;
        transform: translate(-50%, -50%);
        pointer-events: none;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-weight: 1000;
        font-size: 24px;
        color: #23516b;
        text-shadow: 0 2px 0 rgba(255,255,255,.8);
        animation: hhaV81Pop .75s ease-out both;
      }

      body.hha-v81-storm{
        animation: hhaV81Storm .9s ease-in-out infinite alternate;
      }

      body.hha-v81-boss{
        animation: hhaV81Boss .75s ease-in-out infinite alternate;
      }

      @keyframes hhaV81Hit{
        0%{ transform: scale(var(--hha-groups-v81-scale)); }
        42%{ transform: scale(calc(var(--hha-groups-v81-scale) * 1.16)); filter: brightness(1.12); }
        100%{ transform: scale(var(--hha-groups-v81-scale)); }
      }

      @keyframes hhaV81Miss{
        0%{ transform: translateX(0) scale(var(--hha-groups-v81-scale)); }
        25%{ transform: translateX(-6px) scale(var(--hha-groups-v81-scale)); }
        50%{ transform: translateX(6px) scale(var(--hha-groups-v81-scale)); }
        100%{ transform: translateX(0) scale(var(--hha-groups-v81-scale)); }
      }

      @keyframes hhaV81Toast{
        0%{ opacity:0; transform:translate(-50%,-50%) scale(.82); }
        18%{ opacity:1; transform:translate(-50%,-50%) scale(1.08); }
        72%{ opacity:1; transform:translate(-50%,-50%) scale(1); }
        100%{ opacity:0; transform:translate(-50%,-70%) scale(.92); }
      }

      @keyframes hhaV81Pop{
        0%{ opacity:0; transform:translate(-50%,-40%) scale(.72); }
        20%{ opacity:1; transform:translate(-50%,-65%) scale(1.1); }
        100%{ opacity:0; transform:translate(-50%,-120%) scale(.9); }
      }

      @keyframes hhaV81Storm{
        from{ filter:saturate(1) contrast(1); }
        to{ filter:saturate(1.13) contrast(1.04); }
      }

      @keyframes hhaV81Boss{
        from{ filter:saturate(1.08) contrast(1.03); }
        to{ filter:saturate(1.26) contrast(1.08); }
      }

      @media (max-width: 640px){
        .hha-groups-v81-mission{
          top: auto;
          right: 8px;
          bottom: calc(62px + var(--hha-groups-v81-safe-bottom));
          width: min(260px, calc(100vw - 112px));
          padding: 8px 10px;
          border-radius: 20px;
        }

        .hha-groups-v81-mission-title{
          font-size: 10px;
        }

        .hha-groups-v81-mission-main{
          font-size: 12px;
        }
      }
    `;

    DOC.head.appendChild(style);
    DOC.body.classList.add('hha-groups-v81');
  }

  function getGroupByText(text) {
    const s = String(text || '');

    for (const g of FOOD_GROUPS) {
      for (const emoji of g.emojis) {
        if (s.includes(emoji)) return g;
      }
    }

    for (const bad of BAD_OR_DECOY) {
      if (s.includes(bad)) {
        return {
          id: 0,
          key: 'decoy',
          label: 'ตัวหลอก',
          icon: bad,
          decoy: true
        };
      }
    }

    return null;
  }

  function getGroupFromElement(el) {
    if (!el || el.nodeType !== 1) return null;

    const ds = el.dataset || {};

    const raw =
      ds.group ||
      ds.foodGroup ||
      ds.foodgroup ||
      ds.kind ||
      ds.foodKind ||
      ds.type ||
      ds.key ||
      '';

    if (raw) {
      const key = String(raw).toLowerCase();

      const found = FOOD_GROUPS.find(function (g) {
        return (
          key === g.key ||
          key === String(g.id) ||
          key.includes(g.key) ||
          key.includes(g.label.toLowerCase())
        );
      });

      if (found) return found;

      if (
        key.includes('junk') ||
        key.includes('bad') ||
        key.includes('decoy') ||
        key.includes('wrong')
      ) {
        return {
          id: 0,
          key: 'decoy',
          label: 'ตัวหลอก',
          icon: '⚠️',
          decoy: true
        };
      }
    }

    return getGroupByText(el.textContent || el.getAttribute('aria-label') || '');
  }

  function isPossibleTarget(el) {
    if (!el || el.nodeType !== 1) return false;

    const tag = el.tagName.toLowerCase();
    if (['html', 'head', 'body', 'script', 'style', 'meta', 'link'].includes(tag)) return false;
    if (['input', 'select', 'textarea'].includes(tag)) return false;

    const cls = String(el.className || '').toLowerCase();
    const ds = el.dataset || {};
    const txt = String(el.textContent || '');

    if (
      cls.includes('food') ||
      cls.includes('target') ||
      cls.includes('spawn') ||
      cls.includes('item') ||
      ds.food ||
      ds.group ||
      ds.foodGroup ||
      ds.kind ||
      ds.hhaFoodTarget === '1'
    ) {
      return true;
    }

    return /[🍎🍌🍊🍇🍉🍓🥭🍍🥦🥬🥕🥒🍅🐟🥚🍗🥩🫘🍚🍞🥔🍠🥑🥜🧈🍩🍰🍬🍭🥤🍟🍕🍔]/u.test(txt);
  }

  function markTarget(el) {
    if (!isPossibleTarget(el)) return false;

    const g = getGroupFromElement(el);

    el.dataset.hhaV81Target = '1';

    if (g) {
      el.dataset.hhaV81Group = g.key;
      el.dataset.hhaV81GroupLabel = g.label;
    }

    if (g && g.decoy) {
      el.classList.add('hha-v81-decoy');
    }

    updateTargetPriority(el, g);

    const tuning = getTuning();
    applyTuningToElement(el, tuning);

    state.patchedNodes += 1;
    return true;
  }

  function updateTargetPriority(el, group) {
    const g = group || getGroupFromElement(el);

    if (!g || !state.missionTarget) {
      el.classList.remove('hha-v81-priority');
      return;
    }

    const isPriority = g.key === state.missionTarget.key;
    el.classList.toggle('hha-v81-priority', isPriority);
  }

  function applyTuningToElement(el, tuning) {
    if (!el || el.nodeType !== 1) return;

    const t = tuning || getTuning();

    el.style.setProperty('--hha-groups-v81-scale', String(t.targetScale || 1));

    const currentAnim = WIN.getComputedStyle(el).animationDuration;
    const baseDur = parseFloat(currentAnim);

    if (Number.isFinite(baseDur) && baseDur > 0) {
      const nextDur = clamp(baseDur / Math.max(0.5, t.fallSpeed || 1), 0.45, 8);
      el.style.animationDuration = nextDur.toFixed(2) + 's';
    }

    const currentTransition = WIN.getComputedStyle(el).transitionDuration;
    if (!currentTransition || currentTransition === '0s') {
      el.style.transitionDuration = '120ms';
    }
  }

  function scanTargets(root) {
    const base = root || DOC.body;
    if (!base) return;

    if (base.nodeType === 1) {
      markTarget(base);
    }

    const nodes = base.querySelectorAll?.(
      '.food,.food-card,.food-target,.target,.spawn,.spawn-food,.target-food,.item,[data-food],[data-group],[data-food-group],[data-kind],[data-hha-food-target="1"]'
    );

    if (!nodes) return;

    nodes.forEach(markTarget);
  }

  function setupObserver() {
    scanTargets(DOC.body);

    const mo = new MutationObserver(function (list) {
      for (const m of list) {
        for (const n of m.addedNodes) {
          scanTargets(n);
        }
      }
    });

    mo.observe(DOC.body, {
      childList: true,
      subtree: true
    });

    return mo;
  }

  function ensureToast() {
    let el = DOC.getElementById('hha-groups-v81-toast');
    if (el) return el;

    el = DOC.createElement('div');
    el.id = 'hha-groups-v81-toast';
    el.className = 'hha-groups-v81-toast';
    DOC.body.appendChild(el);

    return el;
  }

  function toast(text, force) {
    const now = Date.now();

    if (!force && now - state.lastToastAt < 900) return;
    state.lastToastAt = now;

    const el = ensureToast();
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  function pop(text, x, y) {
    const el = DOC.createElement('div');
    el.className = 'hha-groups-v81-pop';
    el.textContent = text;
    el.style.left = Math.round(x || WIN.innerWidth / 2) + 'px';
    el.style.top = Math.round(y || WIN.innerHeight / 2) + 'px';

    DOC.body.appendChild(el);

    setTimeout(function () {
      el.remove();
    }, 850);
  }

  function ensureMissionPanel() {
    let panel = DOC.getElementById('hha-groups-v81-mission');
    if (panel) return panel;

    panel = DOC.createElement('div');
    panel.id = 'hha-groups-v81-mission';
    panel.className = 'hha-groups-v81-mission';
    panel.innerHTML = `
      <div class="hha-groups-v81-mission-title">Mini Mission</div>
      <div class="hha-groups-v81-mission-main">
        <span data-v81-mission-text>กำลังเตรียมภารกิจ...</span>
        <span data-v81-mission-count>0/3</span>
      </div>
      <div class="hha-groups-v81-progress"><i data-v81-mission-bar></i></div>
    `;

    DOC.body.appendChild(panel);
    return panel;
  }

  function ensureBossBar() {
    let bar = DOC.getElementById('hha-groups-v81-bossbar');
    if (bar) return bar;

    bar = DOC.createElement('div');
    bar.id = 'hha-groups-v81-bossbar';
    bar.className = 'hha-groups-v81-bossbar';
    bar.innerHTML = `
      <div class="hha-groups-v81-bossbar-label">
        <span>👑 Boss Food Rush</span>
        <span data-v81-boss-count>0%</span>
      </div>
      <div class="hha-groups-v81-bossbar-track"><i data-v81-boss-bar></i></div>
    `;

    DOC.body.appendChild(bar);
    return bar;
  }

  function nextMission(force) {
    const tuning = getTuning();
    const elapsed = Date.now() - state.missionStartedAt;
    const needNew =
      force ||
      !state.missionTarget ||
      elapsed >= (tuning.missionSeconds || 24) * 1000 ||
      state.missionGot >= state.missionNeed;

    if (!needNew) return;

    const idx = state.missionIndex % FOOD_GROUPS.length;
    const g = FOOD_GROUPS[idx];

    state.missionIndex += 1;
    state.missionStartedAt = Date.now();
    state.missionTarget = g;
    state.missionNeed = tuning.missionNeed || 3;
    state.missionGot = 0;

    toast(`${g.icon} ภารกิจใหม่: เก็บ${g.label}`, true);
    scanTargets(DOC.body);
    updateMissionPanel();
  }

  function updateMissionPanel() {
    const panel = ensureMissionPanel();

    const text = panel.querySelector('[data-v81-mission-text]');
    const count = panel.querySelector('[data-v81-mission-count]');
    const bar = panel.querySelector('[data-v81-mission-bar]');

    if (!state.missionTarget) {
      text.textContent = 'กำลังเตรียมภารกิจ...';
      count.textContent = '0/3';
      bar.style.width = '0%';
      return;
    }

    text.textContent = `${state.missionTarget.icon} เก็บหมู่ ${state.missionTarget.label}`;
    count.textContent = `${state.missionGot}/${state.missionNeed}`;
    bar.style.width = clamp((state.missionGot / Math.max(1, state.missionNeed)) * 100, 0, 100) + '%';
  }

  function completeMission() {
    if (!state.missionTarget) return;

    state.missionDone += 1;
    state.scoreBonus += 25;
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);

    toast(`⭐ Mission Clear! +25`, true);
    pop('⭐ +25', WIN.innerWidth / 2, WIN.innerHeight * 0.38);

    try {
      WIN.dispatchEvent(new CustomEvent('groups:v81:mission-clear', {
        detail: {
          version: VERSION,
          missionDone: state.missionDone,
          target: Object.assign({}, state.missionTarget),
          scoreBonus: state.scoreBonus
        }
      }));
    } catch (e) {}

    nextMission(true);
  }

  function updateBossBar() {
    const bar = ensureBossBar();
    const count = bar.querySelector('[data-v81-boss-count]');
    const fill = bar.querySelector('[data-v81-boss-bar]');

    const pct = clamp(state.bossMeter, 0, 100);
    count.textContent = Math.round(pct) + '%';
    fill.style.width = pct + '%';

    if (pct >= 100 && !state.bossCleared) {
      state.bossCleared = true;
      state.scoreBonus += 50;
      toast('👑 Boss Cleared! +50', true);
      pop('👑 +50', WIN.innerWidth / 2, WIN.innerHeight * 0.28);

      try {
        WIN.dispatchEvent(new CustomEvent('groups:v81:boss-clear', {
          detail: {
            version: VERSION,
            scoreBonus: state.scoreBonus,
            bossMeter: state.bossMeter
          }
        }));
      } catch (e) {}
    }
  }

  function updatePhase() {
    const elapsed = nowSec();
    const total = gameDuration();
    const remain = remainSec();
    const tuning = getTuning();

    state.wave = Math.max(1, Math.floor(elapsed / 22) + 1);

    if (remain <= tuning.bossWindowSec) {
      state.phase = 'boss';
      state.boss = true;
    } else if (elapsed >= 22) {
      state.phase = 'storm';
      state.boss = false;
    } else {
      state.phase = 'warm';
      state.boss = false;
    }

    state.fever = state.combo >= 5;

    DOC.body.classList.toggle('hha-v81-storm', state.phase === 'storm');
    DOC.body.classList.toggle('hha-v81-boss', state.phase === 'boss');

    const t = getTuning();

    DOC.documentElement.style.setProperty('--hha-groups-v81-speed', String(t.fallSpeed || 1));
    DOC.documentElement.style.setProperty('--hha-groups-v81-scale', String(t.targetScale || 1));

    WIN.HHA_GROUPS_CORE_TUNING = Object.assign({}, t, {
      source: VERSION,
      scoreBonus: state.scoreBonus,
      mission: state.missionTarget ? {
        key: state.missionTarget.key,
        label: state.missionTarget.label,
        got: state.missionGot,
        need: state.missionNeed
      } : null,
      bossMeter: state.bossMeter
    });

    try {
      WIN.dispatchEvent(new CustomEvent('groups:v81:tuning', {
        detail: WIN.HHA_GROUPS_CORE_TUNING
      }));
    } catch (e) {}
  }

  function onCorrect(point, targetEl) {
    state.correct += 1;
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);

    const g = targetEl ? getGroupFromElement(targetEl) : null;

    if (g && state.missionTarget && g.key === state.missionTarget.key) {
      state.missionGot += 1;
      state.scoreBonus += 3;
      pop(`+${3 + Math.min(state.combo, 7)}`, point?.x, point?.y);

      if (state.missionGot >= state.missionNeed) {
        completeMission();
      }
    } else {
      pop(`+${1 + Math.min(state.combo, 5)}`, point?.x, point?.y);
    }

    if (state.phase === 'boss') {
      state.bossMeter = clamp(state.bossMeter + 12, 0, 100);
      updateBossBar();
    }

    if (targetEl) {
      targetEl.classList.remove('hha-v81-miss');
      targetEl.classList.add('hha-v81-hit');
      setTimeout(function () {
        targetEl.classList.remove('hha-v81-hit');
      }, 280);
    }

    if (state.combo === 5) {
      toast('🔥 Fever Combo!', true);
    }

    updateMissionPanel();
  }

  function onMiss(point, targetEl) {
    state.miss += 1;
    state.combo = 0;

    if (state.phase === 'boss') {
      state.bossMeter = clamp(state.bossMeter - 8, 0, 100);
      updateBossBar();
    }

    if (targetEl) {
      targetEl.classList.remove('hha-v81-hit');
      targetEl.classList.add('hha-v81-miss');
      setTimeout(function () {
        targetEl.classList.remove('hha-v81-miss');
      }, 340);
    }

    pop('ลองใหม่!', point?.x, point?.y);
    updateMissionPanel();
  }

  function judgeFromPointer(ev) {
    const now = Date.now();
    if (now - state.lastPointerAt < 40) return;
    state.lastPointerAt = now;

    const target = ev.target?.closest?.('[data-hha-v81-target="1"],[data-hha-food-target="1"]');
    if (!target) return;

    const group = getGroupFromElement(target);
    const point = { x: ev.clientX, y: ev.clientY };

    if (group && group.decoy) {
      onMiss(point, target);
      return;
    }

    if (state.missionTarget && group && group.key === state.missionTarget.key) {
      onCorrect(point, target);
      return;
    }

    /*
      ไม่ตัดสินผิดทันที ถ้าไม่ได้ตรงกับ mission
      เพราะ core game เดิมอาจกำลังตรวจว่าอาหารนั้นถูกกับโจทย์หลักอยู่
      ดังนั้นตรงนี้ให้ feedback เบา ๆ และรอ event จาก core ได้
    */
    if (group) {
      pop(group.icon, point.x, point.y);
    }
  }

  function installPointerHooks() {
    DOC.addEventListener('pointerdown', judgeFromPointer, {
      passive: true,
      capture: true
    });
  }

  function installEventHooks() {
    const okEvents = ['groups:hit', 'groups:correct', 'hha:correct'];
    const missEvents = ['groups:miss', 'groups:wrong', 'hha:miss', 'hha:wrong'];

    okEvents.forEach(function (name) {
      WIN.addEventListener(name, function (ev) {
        const d = ev.detail || {};
        onCorrect(d.point || d, d.target || d.el || null);
      });
    });

    missEvents.forEach(function (name) {
      WIN.addEventListener(name, function (ev) {
        const d = ev.detail || {};
        onMiss(d.point || d, d.target || d.el || null);
      });
    });

    WIN.addEventListener('hha:judge', function (ev) {
      const d = ev.detail || {};
      const ok = Boolean(d.ok || d.correct || d.result === 'correct');
      if (ok) onCorrect(d.point || d, d.target || d.el || null);
      else onMiss(d.point || d, d.target || d.el || null);
    });

    WIN.addEventListener('groups:judge', function (ev) {
      const d = ev.detail || {};
      const ok = Boolean(d.ok || d.correct || d.result === 'correct');
      if (ok) onCorrect(d.point || d, d.target || d.el || null);
      else onMiss(d.point || d, d.target || d.el || null);
    });

    WIN.addEventListener('hha:end', function (ev) {
      mountSummaryEnhancer(ev.detail || {});
    });

    WIN.addEventListener('groups:end', function (ev) {
      mountSummaryEnhancer(ev.detail || {});
    });
  }

  function tryPatchFunction(name) {
    const original = WIN[name];

    if (typeof original !== 'function') return false;
    if (original.__HHA_GROUPS_V81_PATCHED__) return true;

    const wrapped = function () {
      const tuning = getTuning();

      try {
        WIN.HHA_GROUPS_CORE_TUNING = Object.assign({}, tuning, {
          source: VERSION,
          beforeSpawn: true
        });
      } catch (e) {}

      const result = original.apply(this, arguments);

      setTimeout(function () {
        if (result && result.nodeType === 1) {
          markTarget(result);
        }

        scanTargets(DOC.body);
      }, 0);

      return result;
    };

    try {
      Object.defineProperty(wrapped, 'name', {
        value: name,
        configurable: true
      });
    } catch (e) {}

    wrapped.__HHA_GROUPS_V81_PATCHED__ = true;
    wrapped.__HHA_GROUPS_V81_ORIGINAL__ = original;

    WIN[name] = wrapped;
    state.hookedFns.push(name);

    console.info('[GroupsSolo v8.1] hooked spawn function:', name);
    return true;
  }

  function patchKnownSpawnFunctions() {
    const names = [
      'spawnFood',
      'spawnTarget',
      'spawnItem',
      'createFood',
      'createTarget',
      'createItem',
      'makeFood',
      'makeTarget',
      'addFood',
      'addTarget',
      'renderFood',
      'renderTarget'
    ];

    names.forEach(tryPatchFunction);
  }

  function mountSummaryEnhancer(summary) {
    const now = Date.now();
    if (now - state.lastSummaryAt < 600) return;
    state.lastSummaryAt = now;

    const enriched = Object.assign({}, summary || {}, {
      game: 'groups',
      mode: 'solo',
      patch: VERSION,
      scoreBonus: state.scoreBonus,
      correctV81: state.correct,
      missV81: state.miss,
      bestComboV81: state.bestCombo,
      missionDone: state.missionDone,
      bossMeter: state.bossMeter,
      bossCleared: state.bossCleared,
      wave: state.wave,
      phase: state.phase,
      durationSec: nowSec()
    });

    try {
      localStorage.setItem('HHA_GROUPS_LAST_SUMMARY', JSON.stringify({
        ts: new Date().toISOString(),
        summary: enriched
      }));

      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
        ts: new Date().toISOString(),
        game: 'groups',
        mode: 'solo',
        summary: enriched
      }));
    } catch (e) {}

    try {
      WIN.dispatchEvent(new CustomEvent('hha:summary-enriched', {
        detail: enriched
      }));
    } catch (e) {}
  }

  function maybeDetectEndScreen() {
    const node = DOC.querySelector(
      '#summary,.summary,.result,.result-screen,[data-summary],[data-screen="summary"],[data-state="ended"],.game-over,.end-screen'
    );

    if (!node) return;

    mountSummaryEnhancer({
      detected: true,
      text: String(node.textContent || '').slice(0, 500)
    });
  }

  function publicApi() {
    WIN.HHA_GROUPS_V81 = {
      version: VERSION,

      getState: function () {
        return Object.assign({}, state, {
          missionTarget: state.missionTarget ? Object.assign({}, state.missionTarget) : null
        });
      },

      getTuning: getTuning,

      markTarget: function (el) {
        return markTarget(el);
      },

      scanTargets: function () {
        scanTargets(DOC.body);
      },

      nextMission: function () {
        nextMission(true);
      },

      addCorrect: function (payload) {
        onCorrect(payload || {}, payload?.target || null);
      },

      addMiss: function (payload) {
        onMiss(payload || {}, payload?.target || null);
      },

      end: function (summary) {
        mountSummaryEnhancer(summary || {});
      }
    };
  }

  function tick() {
    updatePhase();
    nextMission(false);
    updateMissionPanel();
    updateBossBar();

    const tuning = getTuning();
    DOC.documentElement.style.setProperty('--hha-groups-v81-scale', String(tuning.targetScale || 1));

    scanTargets(DOC.body);
    maybeDetectEndScreen();
  }

  function init() {
    injectStyle();
    ensureMissionPanel();
    ensureBossBar();
    ensureToast();

    nextMission(true);

    setupObserver();
    installPointerHooks();
    installEventHooks();
    patchKnownSpawnFunctions();
    publicApi();

    setInterval(tick, 1000);

    setInterval(function () {
      patchKnownSpawnFunctions();
    }, 2500);

    setInterval(function () {
      const tuning = getTuning();
      DOC.querySelectorAll('[data-hha-v81-target="1"]').forEach(function (el) {
        applyTuningToElement(el, tuning);
        updateTargetPriority(el);
      });
    }, 700);

    console.info('[GroupsSolo v8.1] core hooks installed', {
      version: VERSION,
      hookedFns: state.hookedFns,
      tuning: getTuning()
    });
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
