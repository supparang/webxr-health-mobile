// === /herohealth/vr-goodjunk/goodjunk-solo-boss.patch.js ===
// GoodJunk Solo Boss Controller
// FULL PATCH v20260326-GJ-SOLO-BOSS-R2-NO-MELT
/* global window, document, performance */
(function () {
  'use strict';

  const WIN = window;
  const DOC = document;

  function clamp(v, a, b) {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  }

  function toNum(v, d) {
    v = Number(v);
    return Number.isFinite(v) ? v : d;
  }

  function nowMs() {
    try { return performance.now(); }
    catch (_) { return Date.now(); }
  }

  function xmur3(str) {
    str = String(str || '');
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  function mulberry32(a) {
    return function () {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRng(seed) {
    const seedFn = xmur3(String(seed || Date.now()));
    return mulberry32(seedFn());
  }

  function randInt(rng, min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(rng() * (max - min + 1)) + min;
  }

  function weightedPick(rng, items) {
    if (!Array.isArray(items) || !items.length) return null;
    const total = items.reduce((s, it) => s + Math.max(0, Number(it.w || 0)), 0);
    if (total <= 0) return items[0].v;
    let r = rng() * total;
    for (let i = 0; i < items.length; i++) {
      r -= Math.max(0, Number(items[i].w || 0));
      if (r <= 0) return items[i].v;
    }
    return items[items.length - 1].v;
  }

  function qs(key, fallback) {
    try {
      const u = new URL(location.href);
      const v = u.searchParams.get(key);
      return (v == null || v === '') ? fallback : v;
    } catch (_) {
      return fallback;
    }
  }

  function ensureStyle() {
    if (DOC.getElementById('gjBossPatchStyleR2')) return;

    const css = `
      .gj-boss-hud{
        position:fixed;
        right:max(12px, env(safe-area-inset-right));
        top:max(12px, env(safe-area-inset-top));
        z-index:12000;
        width:min(328px, calc(100vw - 24px));
        background:linear-gradient(180deg, rgba(15,23,42,.94), rgba(2,6,23,.92));
        border:1px solid rgba(255,255,255,.14);
        border-radius:18px;
        box-shadow:0 16px 40px rgba(0,0,0,.34);
        padding:12px;
        color:#f8fafc;
        font:600 14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
        backdrop-filter: blur(8px);
        display:none;
      }
      .gj-boss-hud.show{ display:block; }

      .gj-boss-row{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
      }

      .gj-boss-title{
        font-size:15px;
        font-weight:900;
        letter-spacing:.2px;
      }

      .gj-boss-pill{
        padding:4px 10px;
        border-radius:999px;
        font-size:12px;
        font-weight:900;
        background:rgba(248,113,113,.16);
        color:#fecaca;
        border:1px solid rgba(248,113,113,.26);
      }

      .gj-boss-sub{
        margin-top:8px;
        color:#dbeafe;
        font-size:12px;
        opacity:.96;
      }

      .gj-boss-bar{
        margin-top:10px;
        height:12px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(255,255,255,.10);
        border:1px solid rgba(255,255,255,.10);
      }

      .gj-boss-fill{
        width:0%;
        height:100%;
        background:linear-gradient(90deg, #22c55e, #facc15, #fb7185);
        transition:width .18s ease;
      }

      .gj-boss-meta{
        margin-top:8px;
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:8px;
      }

      .gj-boss-card{
        border-radius:12px;
        background:rgba(255,255,255,.06);
        border:1px solid rgba(255,255,255,.10);
        padding:8px;
        text-align:center;
      }

      .gj-boss-k{
        font-size:11px;
        color:#cbd5e1;
      }

      .gj-boss-v{
        margin-top:3px;
        font-size:14px;
        font-weight:900;
        color:#fff;
      }

      .gj-boss-toast{
        position:fixed;
        left:50%;
        top:max(20px, env(safe-area-inset-top));
        transform:translateX(-50%);
        z-index:12010;
        background:linear-gradient(180deg, rgba(2,6,23,.96), rgba(15,23,42,.92));
        color:#fff;
        border:1px solid rgba(255,255,255,.16);
        border-radius:999px;
        padding:10px 16px;
        box-shadow:0 14px 36px rgba(0,0,0,.32);
        font:900 14px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
        opacity:0;
        pointer-events:none;
        transition:opacity .16s ease, transform .16s ease;
      }
      .gj-boss-toast.show{ opacity:1; transform:translateX(-50%) translateY(0); }
      .gj-boss-toast.warn{ color:#fde68a; }
      .gj-boss-toast.good{ color:#bbf7d0; }
      .gj-boss-toast.bad{ color:#fecaca; }
      .gj-boss-toast.info{ color:#dbeafe; }

      .gj-boss-warning-ring{
        position:fixed;
        inset:0;
        z-index:11990;
        pointer-events:none;
        box-shadow: inset 0 0 0 0 rgba(248,113,113,0);
        transition: box-shadow .22s ease;
      }
      .gj-boss-warning-ring.on{
        box-shadow: inset 0 0 0 10px rgba(248,113,113,.28);
      }

      @media (max-width:700px){
        .gj-boss-hud{
          width:min(306px, calc(100vw - 16px));
          right:8px;
          top:8px;
          padding:10px;
        }
        .gj-boss-meta{
          grid-template-columns:repeat(2,1fr);
        }
      }
    `;

    const style = DOC.createElement('style');
    style.id = 'gjBossPatchStyleR2';
    style.textContent = css;
    DOC.head.appendChild(style);
  }

  function ensureHudRoot() {
    ensureStyle();

    let hud = DOC.getElementById('gjBossHudR2');
    if (!hud) {
      hud = DOC.createElement('div');
      hud.id = 'gjBossHudR2';
      hud.className = 'gj-boss-hud';
      hud.innerHTML = `
        <div class="gj-boss-row">
          <div class="gj-boss-title">👹 Boss Battle</div>
          <div class="gj-boss-pill" id="gjBossPhasePillR2">Phase 1/3</div>
        </div>
        <div class="gj-boss-sub" id="gjBossSubR2">ตีอาหารดีให้ครบ ระวังอาหารขยะหลอก</div>
        <div class="gj-boss-bar" aria-hidden="true">
          <div class="gj-boss-fill" id="gjBossFillR2"></div>
        </div>
        <div class="gj-boss-meta">
          <div class="gj-boss-card">
            <div class="gj-boss-k">Progress</div>
            <div class="gj-boss-v" id="gjBossProgR2">0 / 0</div>
          </div>
          <div class="gj-boss-card">
            <div class="gj-boss-k">Good</div>
            <div class="gj-boss-v" id="gjBossGoodR2">0</div>
          </div>
          <div class="gj-boss-card">
            <div class="gj-boss-k">Power</div>
            <div class="gj-boss-v" id="gjBossPowerR2">0</div>
          </div>
          <div class="gj-boss-card">
            <div class="gj-boss-k">Wrong</div>
            <div class="gj-boss-v" id="gjBossWrongR2">0</div>
          </div>
        </div>
      `;
      DOC.body.appendChild(hud);
    }

    let toast = DOC.getElementById('gjBossToastR2');
    if (!toast) {
      toast = DOC.createElement('div');
      toast.id = 'gjBossToastR2';
      toast.className = 'gj-boss-toast';
      DOC.body.appendChild(toast);
    }

    let ring = DOC.getElementById('gjBossWarnRingR2');
    if (!ring) {
      ring = DOC.createElement('div');
      ring.id = 'gjBossWarnRingR2';
      ring.className = 'gj-boss-warning-ring';
      DOC.body.appendChild(ring);
    }

    return {
      hud,
      toast,
      ring,
      phasePill: DOC.getElementById('gjBossPhasePillR2'),
      sub: DOC.getElementById('gjBossSubR2'),
      fill: DOC.getElementById('gjBossFillR2'),
      prog: DOC.getElementById('gjBossProgR2'),
      good: DOC.getElementById('gjBossGoodR2'),
      power: DOC.getElementById('gjBossPowerR2'),
      wrong: DOC.getElementById('gjBossWrongR2')
    };
  }

  function makeDefaultUI() {
    const root = ensureHudRoot();
    let toastTimer = 0;

    return {
      show() {
        root.hud.classList.add('show');
      },
      hide() {
        root.hud.classList.remove('show');
      },
      setWarning(on) {
        root.ring.classList.toggle('on', !!on);
      },
      banner(text, tone, ms) {
        root.toast.textContent = String(text || '');
        root.toast.className = 'gj-boss-toast ' + String(tone || 'info');
        root.toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
          root.toast.classList.remove('show');
        }, clamp(ms || 1200, 500, 5000));
      },
      updatePhase(cur, total) {
        if (root.phasePill) root.phasePill.textContent = 'Phase ' + cur + '/' + total;
      },
      updateText(text) {
        if (root.sub) root.sub.textContent = String(text || '');
      },
      updateProgress(value, max, stats) {
        value = clamp(value || 0, 0, max || 1);
        max = Math.max(1, toNum(max, 1));
        const pct = (value / max) * 100;
        if (root.fill) root.fill.style.width = pct.toFixed(2) + '%';
        if (root.prog) root.prog.textContent = value + ' / ' + max;
        if (root.good) root.good.textContent = String(toNum(stats && stats.good, 0));
        if (root.power) root.power.textContent = String(toNum(stats && stats.power, 0));
        if (root.wrong) root.wrong.textContent = String(toNum(stats && stats.wrong, 0));
      }
    };
  }

  function createController(opts) {
    const runCtx = (opts && opts.runCtx) || WIN.__GJ_RUN_CTX__ || {};
    const totalTimeSec = clamp(
      (opts && opts.totalTimeSec) || runCtx.time || qs('time', 90),
      30,
      999
    );
    const seed = (opts && opts.seed) || runCtx.seed || qs('seed', String(Date.now()));
    const rng = makeRng(seed);
    const ui = (opts && opts.ui) || makeDefaultUI();

    const cfg = {
      enabled: true,

      // เข้า boss ช้าลงนิด จากเดิม
      enterRemainRatio: 0.30,

      // เตือนก่อนเข้า boss
      preWarningMs: 4500,

      // ยิง junk ผิด ลด progress
      wrongPenalty: 1,

      // weakspot โผล่ถี่น้อยลง
      goldEvery: 5,

      // สำคัญ: weakspot ให้ "คะแนนมากขึ้น" แต่ไม่เร่ง progress
      goldProgressGain: 1,
      goldScore: 18,
      normalGoodScore: 10,
      junkScore: -8,

      phases: [
        {
          id: 1,
          label: 'Phase 1',
          targets: 12,
          goodNeed: 7,
          junkCount: 3,
          spawnMin: 720,
          spawnMax: 860,
          pattern: 'single_easy',
          finalBurst: false
        },
        {
          id: 2,
          label: 'Phase 2',
          targets: 14,
          goodNeed: 8,
          junkCount: 4,
          spawnMin: 620,
          spawnMax: 760,
          pattern: 'pair_mix',
          finalBurst: false
        },
        {
          id: 3,
          label: 'Phase 3',
          targets: 16,
          goodNeed: 9,
          junkCount: 5,
          spawnMin: 520,
          spawnMax: 660,
          pattern: 'burst_finish',
          finalBurst: true
        }
      ],

      // กันบอส melt เร็วเกิน แม้ผู้เล่น weakspot แม่น
      minTotalGoodHits: 14,
      minTotalPowerHits: 4,
      minTotalProgress: 24
    };

    const state = {
      active: false,
      warning: false,
      warningAtMs: 0,
      enteredAtMs: 0,

      phaseIndex: -1,
      currentPhase: null,

      phaseProgress: 0,
      phaseSpawned: 0,
      phaseGoodSpawned: 0,
      phaseJunkSpawned: 0,
      phaseGoodHits: 0,
      phasePowerHits: 0,
      phaseWrong: 0,

      totalProgress: 0,
      totalGoodHits: 0,
      totalPowerHits: 0,
      totalWrong: 0,

      spawnAtMs: 0,
      spawnSeq: 0
    };

    function isSolo(gameState) {
      const m = String(
        (gameState && (gameState.mode || gameState.gameMode)) ||
        runCtx.mode ||
        qs('mode', 'solo')
      ).toLowerCase();
      return m === 'solo' || m === 'play' || m === '';
    }

    function getRemainSec(gameState) {
      if (!gameState) return totalTimeSec;
      const candidates = [
        gameState.timeLeft,
        gameState.remainingSec,
        gameState.remainSec,
        gameState.timeLeftSec,
        gameState.secLeft,
        gameState.timerSec
      ];
      for (let i = 0; i < candidates.length; i++) {
        const n = Number(candidates[i]);
        if (Number.isFinite(n)) return Math.max(0, n);
      }
      if (Number.isFinite(Number(gameState.elapsedSec))) {
        return Math.max(0, totalTimeSec - Number(gameState.elapsedSec));
      }
      return totalTimeSec;
    }

    function shouldEnter(gameState) {
      if (!cfg.enabled) return false;
      if (!isSolo(gameState)) return false;
      if (state.active || state.warning) return false;
      const remain = getRemainSec(gameState);
      const ratio = remain / Math.max(1, totalTimeSec);
      return ratio <= cfg.enterRemainRatio;
    }

    function reset() {
      state.active = false;
      state.warning = false;
      state.warningAtMs = 0;
      state.enteredAtMs = 0;

      state.phaseIndex = -1;
      state.currentPhase = null;

      state.phaseProgress = 0;
      state.phaseSpawned = 0;
      state.phaseGoodSpawned = 0;
      state.phaseJunkSpawned = 0;
      state.phaseGoodHits = 0;
      state.phasePowerHits = 0;
      state.phaseWrong = 0;

      state.totalProgress = 0;
      state.totalGoodHits = 0;
      state.totalPowerHits = 0;
      state.totalWrong = 0;

      state.spawnAtMs = 0;
      state.spawnSeq = 0;

      ui.setWarning(false);
      ui.hide();
    }

    function updateHud() {
      const phase = state.currentPhase;
      if (!phase) return;
      ui.updatePhase(state.phaseIndex + 1, cfg.phases.length);
      ui.updateProgress(
        Math.min(state.phaseProgress, phase.goodNeed),
        phase.goodNeed,
        {
          good: state.totalGoodHits,
          power: state.totalPowerHits,
          wrong: state.totalWrong
        }
      );
    }

    function startWarning(msNow) {
      state.warning = true;
      state.warningAtMs = msNow;
      ui.setWarning(true);
      ui.banner('⚠️ BOSS COMING!', 'warn', 1600);
    }

    function startPhase(index, msNow) {
      const phase = cfg.phases[index];
      state.phaseIndex = index;
      state.currentPhase = phase;

      state.phaseProgress = 0;
      state.phaseSpawned = 0;
      state.phaseGoodSpawned = 0;
      state.phaseJunkSpawned = 0;
      state.phaseGoodHits = 0;
      state.phasePowerHits = 0;
      state.phaseWrong = 0;
      state.spawnAtMs = msNow + 650;

      ui.show();
      ui.updatePhase(index + 1, cfg.phases.length);
      ui.updateText('ตีอาหารดีให้ครบ ระวังอาหารขยะหลอก');
      updateHud();
      ui.banner('🔥 ' + phase.label, 'info', 1200);
    }

    function startBoss(msNow, gameState) {
      state.warning = false;
      state.active = true;
      state.enteredAtMs = msNow;

      if (gameState) {
        gameState.__gjBossActive = true;
        gameState.__gjBossPhase = 1;
      }

      ui.setWarning(false);
      ui.banner('👹 BOSS START!', 'warn', 1600);
      startPhase(0, msNow);
    }

    function finalBurstKind(phase) {
      const remainToSpawn = phase.targets - state.phaseSpawned;
      if (remainToSpawn > 4) return null;
      const seq = ['good', 'junk', 'good', 'gold'];
      return seq[4 - remainToSpawn];
    }

    function chooseKind(phase) {
      if (phase.finalBurst && phase.pattern === 'burst_finish') {
        const forced = finalBurstKind(phase);
        if (forced) return forced;
      }

      const left = phase.targets - state.phaseSpawned;
      const goodNeedLeft = Math.max(0, phase.goodNeed - state.phaseProgress);
      const junkLeftAllowed = Math.max(0, phase.junkCount - state.phaseJunkSpawned);

      if (left <= goodNeedLeft) {
        return ((state.phaseSpawned + 1) % cfg.goldEvery === 0) ? 'gold' : 'good';
      }

      if (junkLeftAllowed <= 0) {
        return ((state.phaseSpawned + 1) % cfg.goldEvery === 0) ? 'gold' : 'good';
      }

      let kind;
      if (phase.pattern === 'single_easy') {
        kind = weightedPick(rng, [
          { v: 'good', w: 72 },
          { v: 'junk', w: 28 }
        ]);
      } else if (phase.pattern === 'pair_mix') {
        kind = weightedPick(rng, [
          { v: 'good', w: 64 },
          { v: 'junk', w: 36 }
        ]);
      } else {
        kind = weightedPick(rng, [
          { v: 'good', w: 60 },
          { v: 'junk', w: 40 }
        ]);
      }

      if (kind === 'good' && ((state.phaseSpawned + 1) % cfg.goldEvery === 0)) {
        return 'gold';
      }
      return kind;
    }

    function makeFoodByKind(kind) {
      const goodFoods = [
        { emoji: '🍎', label: 'Apple' },
        { emoji: '🥕', label: 'Carrot' },
        { emoji: '🥛', label: 'Milk' },
        { emoji: '🍌', label: 'Banana' },
        { emoji: '🥦', label: 'Broccoli' }
      ];

      const junkFoods = [
        { emoji: '🍟', label: 'Fries' },
        { emoji: '🍩', label: 'Donut' },
        { emoji: '🥤', label: 'Soda' },
        { emoji: '🍬', label: 'Candy' },
        { emoji: '🍔', label: 'Burger' }
      ];

      if (kind === 'junk') return junkFoods[randInt(rng, 0, junkFoods.length - 1)];
      if (kind === 'gold') return { emoji: '⭐', label: 'Power Good' };
      return goodFoods[randInt(rng, 0, goodFoods.length - 1)];
    }

    function buildSpawnSpec() {
      const phase = state.currentPhase;
      if (!phase) return null;
      if (state.phaseSpawned >= phase.targets) return null;

      const kind = chooseKind(phase);
      const food = makeFoodByKind(kind);
      const id = 'gjboss-r2-' + Date.now() + '-' + (++state.spawnSeq);

      const isPower = (kind === 'gold');
      const isJunk = (kind === 'junk');

      const spec = {
        id,
        boss: true,
        __gjBoss: 1,
        __gjBossPhase: phase.id,

        kind: isJunk ? 'junk' : 'good',
        variant: kind, // normal | gold | junk

        emoji: food.emoji,
        label: food.label,

        // สำคัญ: gold ยังนับ progress แค่ 1 เท่ากับ good ปกติ
        progressGain: isJunk ? 0 : (isPower ? cfg.goldProgressGain : 1),

        // weakspot ให้คะแนนเพิ่ม แต่ไม่ melt boss
        score: isJunk ? cfg.junkScore : (isPower ? cfg.goldScore : cfg.normalGoodScore),

        penalty: cfg.wrongPenalty,
        ttlMs: isPower ? 1200 : (isJunk ? 1350 : 1450),

        meta: {
          from: 'goodjunk-solo-boss.patch-r2',
          phase: phase.id,
          power: isPower ? 1 : 0
        }
      };

      state.phaseSpawned += 1;
      if (isJunk) state.phaseJunkSpawned += 1;
      else state.phaseGoodSpawned += 1;

      return spec;
    }

    function canFinishWholeBoss() {
      return (
        state.totalProgress >= cfg.minTotalProgress &&
        state.totalGoodHits >= cfg.minTotalGoodHits &&
        state.totalPowerHits >= cfg.minTotalPowerHits
      );
    }

    function advancePhaseOrFinish(gameState) {
      const phase = state.currentPhase;
      if (!phase) return;
      if (state.phaseProgress < phase.goodNeed) return;

      const next = state.phaseIndex + 1;
      if (next < cfg.phases.length) {
        ui.banner('✅ PHASE CLEAR!', 'good', 1200);
        if (gameState) gameState.__gjBossPhase = next + 1;
        startPhase(next, nowMs());
        return;
      }

      if (canFinishWholeBoss()) {
        finishBoss(gameState);
      } else {
        // กันจบไวเกิน: ถ้า progress phase ครบแล้ว แต่ยอดรวมยังไม่ถึง
        // ให้ยืด phase สุดท้ายต่ออีกชุดสั้น ๆ
        extendFinalPhase();
        updateHud();
        ui.banner('⚡ อีกนิดเดียว!', 'warn', 1200);
      }
    }

    function extendFinalPhase() {
      const phase = state.currentPhase;
      if (!phase || phase.id !== 3) return;

      phase.targets += 4;
      phase.goodNeed += 2;
      phase.junkCount += 1;

      state.currentPhase = phase;
    }

    function finishBoss(gameState) {
      state.active = false;
      state.warning = false;

      ui.setWarning(false);
      ui.updateProgress(1, 1, {
        good: state.totalGoodHits,
        power: state.totalPowerHits,
        wrong: state.totalWrong
      });
      ui.banner('🏆 BOSS DEFEATED!', 'good', 1800);

      if (gameState) {
        gameState.__gjBossActive = false;
        gameState.__gjBossClear = true;
        gameState.__gjBossSummary = {
          phases: cfg.phases.length,
          totalProgress: state.totalProgress,
          totalGoodHits: state.totalGoodHits,
          totalPowerHits: state.totalPowerHits,
          totalWrong: state.totalWrong,
          clearedAt: Date.now()
        };
        gameState.forceEndSoon = true;
      }
    }

    function tick(msNow, gameState, adapter) {
      adapter = adapter || {};

      if (shouldEnter(gameState)) {
        startWarning(msNow);
      }

      if (state.warning && !state.active) {
        if ((msNow - state.warningAtMs) >= cfg.preWarningMs) {
          startBoss(msNow, gameState);
        }
      }

      if (!state.active) return;

      const phase = state.currentPhase;
      if (!phase) return;

      updateHud();

      if (msNow < state.spawnAtMs) return;

      if (state.phaseSpawned >= phase.targets) {
        state.spawnAtMs = msNow + 120;
        return;
      }

      const spec = buildSpawnSpec();
      if (!spec) return;

      if (typeof adapter.spawn === 'function') {
        adapter.spawn(spec, phase, state);
      }

      state.spawnAtMs = msNow + randInt(rng, phase.spawnMin, phase.spawnMax);
    }

    function onHit(target, gameState, adapter) {
      adapter = adapter || {};
      if (!target || !target.__gjBoss || !state.active) return false;

      const isGood = String(target.kind || '').toLowerCase() === 'good';
      const isJunk = String(target.kind || '').toLowerCase() === 'junk';
      const isPower = String(target.variant || '').toLowerCase() === 'gold';

      if (isGood) {
        const gain = clamp(target.progressGain || 1, 1, 1);
        state.phaseProgress += gain;
        state.totalProgress += gain;

        if (isPower) {
          state.phasePowerHits += 1;
          state.totalPowerHits += 1;
        } else {
          state.phaseGoodHits += 1;
          state.totalGoodHits += 1;
        }

        if (gameState) {
          gameState.combo = toNum(gameState.combo, 0) + 1;
          gameState.score = Math.max(0, toNum(gameState.score, 0) + toNum(target.score, cfg.normalGoodScore));
        }

        updateHud();
        ui.banner(isPower ? '⭐ POWER HIT!' : '✅ GOOD!', 'good', 700);

        if (typeof adapter.removeTarget === 'function') {
          adapter.removeTarget(target);
        }

        advancePhaseOrFinish(gameState);
        return true;
      }

      if (isJunk) {
        const penalty = clamp(target.penalty || cfg.wrongPenalty, 1, 2);
        state.phaseProgress = Math.max(0, state.phaseProgress - penalty);
        state.totalProgress = Math.max(0, state.totalProgress - penalty);
        state.phaseWrong += 1;
        state.totalWrong += 1;

        if (gameState) {
          gameState.combo = 0;
          gameState.miss = toNum(gameState.miss, 0) + 1;
          gameState.score = Math.max(0, toNum(gameState.score, 0) + toNum(target.score, cfg.junkScore));
        }

        updateHud();
        ui.banner('❌ JUNK!', 'bad', 850);

        if (typeof adapter.removeTarget === 'function') {
          adapter.removeTarget(target);
        }
        return true;
      }

      return false;
    }

    function onExpire(target, gameState, adapter) {
      adapter = adapter || {};
      if (!target || !target.__gjBoss || !state.active) return false;

      if (String(target.kind || '').toLowerCase() === 'good') {
        if (gameState) {
          gameState.combo = 0;
        }
        ui.banner('MISS!', 'bad', 700);
      }

      if (typeof adapter.removeTarget === 'function') {
        adapter.removeTarget(target);
      }
      return true;
    }

    function isActive() {
      return !!state.active;
    }

    function isWarning() {
      return !!state.warning;
    }

    function isBossTarget(target) {
      return !!(target && target.__gjBoss);
    }

    function getState() {
      return JSON.parse(JSON.stringify({
        active: state.active,
        warning: state.warning,
        phaseIndex: state.phaseIndex,
        phaseProgress: state.phaseProgress,
        totalProgress: state.totalProgress,
        totalGoodHits: state.totalGoodHits,
        totalPowerHits: state.totalPowerHits,
        totalWrong: state.totalWrong
      }));
    }

    return {
      cfg,
      state,
      reset,
      tick,
      onHit,
      onExpire,
      isActive,
      isWarning,
      isBossTarget,
      getState
    };
  }

  WIN.HHA_GJ_BOSS = {
    create: createController
  };
})();