// === /herohealth/vr-goodjunk/goodjunk-solo-boss.patch.js ===
// GoodJunk Solo Boss Controller
// FULL PATCH v20260326-GJ-SOLO-BOSS-10-12-14-r1
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
    if (DOC.getElementById('gjBossPatchStyle')) return;
    const css = `
      .gj-boss-hud{
        position:fixed; right:max(12px, env(safe-area-inset-right)); top:max(12px, env(safe-area-inset-top));
        z-index:12000; width:min(320px, calc(100vw - 24px));
        background:linear-gradient(180deg, rgba(15,23,42,.92), rgba(2,6,23,.90));
        border:1px solid rgba(255,255,255,.14); border-radius:18px; box-shadow:0 14px 34px rgba(0,0,0,.34);
        padding:12px; color:#f8fafc; backdrop-filter: blur(8px);
        font:600 14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
        display:none;
      }
      .gj-boss-hud.show{ display:block; }
      .gj-boss-row{ display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .gj-boss-title{ font-size:15px; font-weight:900; letter-spacing:.2px; }
      .gj-boss-pill{
        padding:4px 10px; border-radius:999px; font-size:12px; font-weight:900;
        background:rgba(248,113,113,.16); color:#fecaca; border:1px solid rgba(248,113,113,.26);
      }
      .gj-boss-sub{ margin-top:8px; color:#dbeafe; font-size:12px; opacity:.95; }
      .gj-boss-bar{
        margin-top:10px; height:12px; border-radius:999px; overflow:hidden;
        background:rgba(255,255,255,.10); border:1px solid rgba(255,255,255,.10);
      }
      .gj-boss-fill{
        width:0%; height:100%;
        background:linear-gradient(90deg, #22c55e, #facc15, #fb7185);
        transition:width .18s ease;
      }
      .gj-boss-meta{
        margin-top:8px; display:grid; grid-template-columns:repeat(3,1fr); gap:8px;
      }
      .gj-boss-card{
        border-radius:12px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.10);
        padding:8px; text-align:center;
      }
      .gj-boss-k{ font-size:11px; color:#cbd5e1; }
      .gj-boss-v{ margin-top:3px; font-size:14px; font-weight:900; color:#fff; }
      .gj-boss-toast{
        position:fixed; left:50%; top:max(20px, env(safe-area-inset-top));
        transform:translateX(-50%); z-index:12010;
        background:linear-gradient(180deg, rgba(2,6,23,.96), rgba(15,23,42,.92));
        color:#fff; border:1px solid rgba(255,255,255,.16);
        border-radius:999px; padding:10px 16px; box-shadow:0 14px 36px rgba(0,0,0,.32);
        font:900 14px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
        opacity:0; pointer-events:none; transition:opacity .16s ease, transform .16s ease;
      }
      .gj-boss-toast.show{ opacity:1; transform:translateX(-50%) translateY(0); }
      .gj-boss-toast.warn{ color:#fde68a; }
      .gj-boss-toast.good{ color:#bbf7d0; }
      .gj-boss-toast.bad{ color:#fecaca; }
      .gj-boss-toast.info{ color:#dbeafe; }
      .gj-boss-warning-ring{
        position:fixed; inset:0; z-index:11990; pointer-events:none;
        box-shadow: inset 0 0 0 0 rgba(248,113,113,.0);
        transition: box-shadow .22s ease;
      }
      .gj-boss-warning-ring.on{
        box-shadow: inset 0 0 0 10px rgba(248,113,113,.28);
      }
      @media (max-width: 700px){
        .gj-boss-hud{ width:min(300px, calc(100vw - 16px)); right:8px; top:8px; padding:10px; }
        .gj-boss-title{ font-size:14px; }
      }
    `;
    const style = DOC.createElement('style');
    style.id = 'gjBossPatchStyle';
    style.textContent = css;
    DOC.head.appendChild(style);
  }

  function ensureHudRoot() {
    ensureStyle();

    let hud = DOC.getElementById('gjBossHud');
    if (!hud) {
      hud = DOC.createElement('div');
      hud.id = 'gjBossHud';
      hud.className = 'gj-boss-hud';
      hud.innerHTML = `
        <div class="gj-boss-row">
          <div class="gj-boss-title">👹 Boss Battle</div>
          <div class="gj-boss-pill" id="gjBossPhasePill">Phase 1/3</div>
        </div>
        <div class="gj-boss-sub" id="gjBossSub">แยกอาหารดีให้ถูก ระวังอาหารขยะหลอก</div>
        <div class="gj-boss-bar" aria-hidden="true">
          <div class="gj-boss-fill" id="gjBossFill"></div>
        </div>
        <div class="gj-boss-meta">
          <div class="gj-boss-card">
            <div class="gj-boss-k">Progress</div>
            <div class="gj-boss-v" id="gjBossProg">0 / 0</div>
          </div>
          <div class="gj-boss-card">
            <div class="gj-boss-k">Good Hits</div>
            <div class="gj-boss-v" id="gjBossHits">0</div>
          </div>
          <div class="gj-boss-card">
            <div class="gj-boss-k">Wrong</div>
            <div class="gj-boss-v" id="gjBossWrong">0</div>
          </div>
        </div>
      `;
      DOC.body.appendChild(hud);
    }

    let toast = DOC.getElementById('gjBossToast');
    if (!toast) {
      toast = DOC.createElement('div');
      toast.id = 'gjBossToast';
      toast.className = 'gj-boss-toast';
      DOC.body.appendChild(toast);
    }

    let ring = DOC.getElementById('gjBossWarnRing');
    if (!ring) {
      ring = DOC.createElement('div');
      ring.id = 'gjBossWarnRing';
      ring.className = 'gj-boss-warning-ring';
      DOC.body.appendChild(ring);
    }

    return {
      hud,
      toast,
      ring,
      phasePill: DOC.getElementById('gjBossPhasePill'),
      sub: DOC.getElementById('gjBossSub'),
      fill: DOC.getElementById('gjBossFill'),
      prog: DOC.getElementById('gjBossProg'),
      hits: DOC.getElementById('gjBossHits'),
      wrong: DOC.getElementById('gjBossWrong')
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
      updateProgress(value, max, hits, wrong) {
        value = clamp(value || 0, 0, max || 1);
        max = Math.max(1, toNum(max, 1));
        const pct = (value / max) * 100;
        if (root.fill) root.fill.style.width = pct.toFixed(2) + '%';
        if (root.prog) root.prog.textContent = value + ' / ' + max;
        if (root.hits) root.hits.textContent = String(toNum(hits, 0));
        if (root.wrong) root.wrong.textContent = String(toNum(wrong, 0));
      }
    };
  }

  function createController(opts) {
    const runCtx = opts && opts.runCtx ? opts.runCtx : (WIN.__GJ_RUN_CTX__ || {});
    const totalTimeSec = clamp(
      (opts && opts.totalTimeSec) || runCtx.time || qs('time', 90),
      30,
      999
    );
    const seed = (opts && opts.seed) || runCtx.seed || qs('seed', String(Date.now()));
    const rng = makeRng(seed);

    const cfg = {
      enabled: true,
      enterRemainRatio: 0.35,
      preWarningMs: 5000,
      wrongPenalty: 1,
      goldEvery: 4,
      goldBonus: 2,
      phases: [
        {
          id: 1,
          label: 'Phase 1',
          targets: 10,
          goodNeed: 7,
          junkCount: 3,
          spawnMin: 700,
          spawnMax: 850,
          pattern: 'single_easy',
          finalBurst: false
        },
        {
          id: 2,
          label: 'Phase 2',
          targets: 12,
          goodNeed: 8,
          junkCount: 4,
          spawnMin: 600,
          spawnMax: 750,
          pattern: 'pair_mix',
          finalBurst: false
        },
        {
          id: 3,
          label: 'Phase 3',
          targets: 14,
          goodNeed: 9,
          junkCount: 5,
          spawnMin: 500,
          spawnMax: 650,
          pattern: 'burst_finish',
          finalBurst: true
        }
      ]
    };

    const state = {
      active: false,
      warning: false,
      warningAtMs: 0,
      enteredAtMs: 0,

      phaseIndex: -1,
      currentPhase: null,

      phaseProgress: 0,
      phaseHits: 0,
      phaseWrong: 0,
      phaseSpawned: 0,
      phaseGoodSpawned: 0,
      phaseJunkSpawned: 0,

      totalHits: 0,
      totalWrong: 0,

      spawnAtMs: 0,
      spawnSeq: 0
    };

    const ui = (opts && opts.ui) || makeDefaultUI();

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
      const v = [
        gameState.timeLeft,
        gameState.remainingSec,
        gameState.remainSec,
        gameState.timeLeftSec,
        gameState.secLeft,
        gameState.timerSec
      ];
      for (let i = 0; i < v.length; i++) {
        if (Number.isFinite(Number(v[i]))) return Math.max(0, Number(v[i]));
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
      state.phaseHits = 0;
      state.phaseWrong = 0;
      state.phaseSpawned = 0;
      state.phaseGoodSpawned = 0;
      state.phaseJunkSpawned = 0;
      state.totalHits = 0;
      state.totalWrong = 0;
      state.spawnAtMs = 0;
      state.spawnSeq = 0;
      ui.setWarning(false);
      ui.hide();
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
      state.phaseHits = 0;
      state.phaseWrong = 0;
      state.phaseSpawned = 0;
      state.phaseGoodSpawned = 0;
      state.phaseJunkSpawned = 0;
      state.spawnAtMs = msNow + 650;

      ui.show();
      ui.updatePhase(index + 1, cfg.phases.length);
      ui.updateText('แยกอาหารดีให้ถูก ระวังอาหารขยะหลอก');
      ui.updateProgress(0, phase.goodNeed, 0, 0);
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
      const goodNeededLeft = Math.max(0, phase.goodNeed - state.phaseProgress);
      const junkLeftAllowed = Math.max(0, phase.junkCount - state.phaseJunkSpawned);

      if (left <= goodNeededLeft) {
        return ((state.phaseSpawned + 1) % cfg.goldEvery === 0) ? 'gold' : 'good';
      }

      if (junkLeftAllowed <= 0) {
        return ((state.phaseSpawned + 1) % cfg.goldEvery === 0) ? 'gold' : 'good';
      }

      let pickKind;
      if (phase.pattern === 'single_easy') {
        pickKind = weightedPick(rng, [
          { v: 'good', w: 70 },
          { v: 'junk', w: 30 }
        ]);
      } else if (phase.pattern === 'pair_mix') {
        pickKind = weightedPick(rng, [
          { v: 'good', w: 62 },
          { v: 'junk', w: 38 }
        ]);
      } else {
        pickKind = weightedPick(rng, [
          { v: 'good', w: 58 },
          { v: 'junk', w: 42 }
        ]);
      }

      if (pickKind === 'good' && ((state.phaseSpawned + 1) % cfg.goldEvery === 0)) {
        return 'gold';
      }
      return pickKind;
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
      if (kind === 'gold') return { emoji: '⭐', label: 'Golden Good' };
      return goodFoods[randInt(rng, 0, goodFoods.length - 1)];
    }

    function buildSpawnSpec() {
      const phase = state.currentPhase;
      if (!phase) return null;
      if (state.phaseSpawned >= phase.targets) return null;

      const kind = chooseKind(phase);
      const food = makeFoodByKind(kind);
      const id = 'gjboss-' + Date.now() + '-' + (++state.spawnSeq);

      const spec = {
        id,
        boss: true,
        __gjBoss: 1,
        __gjBossPhase: phase.id,
        kind: (kind === 'junk') ? 'junk' : 'good',
        variant: kind,
        emoji: food.emoji,
        label: food.label,
        score: (kind === 'junk') ? -8 : (kind === 'gold' ? 20 : 12),
        progressGain: (kind === 'gold') ? cfg.goldBonus : ((kind === 'junk') ? 0 : 1),
        penalty: cfg.wrongPenalty,
        ttlMs: (kind === 'gold') ? 1200 : (kind === 'junk' ? 1350 : 1450),
        meta: {
          from: 'goodjunk-solo-boss.patch',
          phase: phase.id
        }
      };

      state.phaseSpawned += 1;
      if (kind === 'junk') state.phaseJunkSpawned += 1;
      else state.phaseGoodSpawned += 1;

      return spec;
    }

    function updateHud() {
      const phase = state.currentPhase;
      if (!phase) return;
      ui.updatePhase(state.phaseIndex + 1, cfg.phases.length);
      ui.updateProgress(
        Math.min(state.phaseProgress, phase.goodNeed),
        phase.goodNeed,
        state.phaseHits,
        state.phaseWrong
      );
    }

    function advancePhase(gameState) {
      const phase = state.currentPhase;
      if (!phase) return;

      if (state.phaseProgress < phase.goodNeed) return;

      const next = state.phaseIndex + 1;
      if (next < cfg.phases.length) {
        ui.banner('✅ PHASE CLEAR!', 'good', 1200);
        if (gameState) {
          gameState.__gjBossPhase = next + 1;
        }
        startPhase(next, nowMs());
        return;
      }

      finishBoss(gameState);
    }

    function finishBoss(gameState) {
      state.active = false;
      state.warning = false;
      ui.setWarning(false);
      ui.updateProgress(1, 1, state.phaseHits, state.phaseWrong);
      ui.banner('🏆 BOSS DEFEATED!', 'good', 1800);

      if (gameState) {
        gameState.__gjBossActive = false;
        gameState.__gjBossClear = true;
        gameState.__gjBossSummary = {
          phases: cfg.phases.length,
          totalHits: state.totalHits,
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

      const phase = state.currentPhase;
      if (!phase) return false;

      if (String(target.kind || '').toLowerCase() === 'good') {
        const gain = clamp(target.progressGain || 1, 1, 3);
        state.phaseProgress += gain;
        state.phaseHits += 1;
        state.totalHits += 1;

        if (gameState) {
          gameState.combo = toNum(gameState.combo, 0) + 1;
          gameState.score = Math.max(0, toNum(gameState.score, 0) + toNum(target.score, 12));
        }

        updateHud();

        if (target.variant === 'gold') ui.banner('⭐ GOLD HIT!', 'good', 800);
        else ui.banner('✅ GOOD!', 'good', 650);

        if (typeof adapter.removeTarget === 'function') {
          adapter.removeTarget(target);
        }

        advancePhase(gameState);
        return true;
      }

      if (String(target.kind || '').toLowerCase() === 'junk') {
        const penalty = clamp(target.penalty || cfg.wrongPenalty, 1, 2);
        state.phaseProgress = Math.max(0, state.phaseProgress - penalty);
        state.phaseWrong += 1;
        state.totalWrong += 1;

        if (gameState) {
          gameState.combo = 0;
          gameState.miss = toNum(gameState.miss, 0) + 1;
          gameState.score = Math.max(0, toNum(gameState.score, 0) + toNum(target.score, -8));
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
        phaseHits: state.phaseHits,
        phaseWrong: state.phaseWrong,
        totalHits: state.totalHits,
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