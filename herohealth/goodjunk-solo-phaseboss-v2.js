(function () {
  'use strict';

  const q = new URLSearchParams(location.search);
  const mount =
    document.getElementById('gameMount') ||
    document.getElementById('goodjunkGameMount') ||
    document.getElementById('app') ||
    document.body;

  const ctx = window.__GJ_RUN_CTX__ || {
    pid: q.get('pid') || 'anon',
    name: q.get('name') || '',
    studyId: q.get('studyId') || '',
    diff: q.get('diff') || 'normal',
    time: q.get('time') || '150',
    seed: q.get('seed') || String(Date.now()),
    hub: q.get('hub') || new URL('./hub-v2.html', location.href).toString(),
    view: q.get('view') || 'mobile',
    run: q.get('run') || 'play',
    gameId: q.get('gameId') || 'goodjunk'
  };

  const DEBUG = q.get('debug') === '1';

  const ROOT_ID = 'gjSoloBossRootClean';
  const STYLE_ID = 'gjSoloBossStyleClean';
  const LAST_SUMMARY_KEY = 'HHA_LAST_SUMMARY';
  const SUMMARY_HISTORY_KEY = 'HHA_SUMMARY_HISTORY';
  const RESEARCH_LAST_KEY = 'HHA_GJ_BOSS_RESEARCH_LAST';
  const RESEARCH_HISTORY_KEY = 'HHA_GJ_BOSS_RESEARCH_HISTORY';

  const GOOD = ['🍎', '🥕', '🥦', '🍌', '🥛', '🥗', '🍉', '🐟'];
  const JUNK = ['🍟', '🍩', '🍭', '🍔', '🥤', '🍕', '🧁', '🍫'];

  const DIFF = {
    easy: {
      p1Goal: 70,
      p2Goal: 170,
      spawn1: 940,
      spawn2: 790,
      bossHp: 16,
      scoreGood: 12,
      penaltyJunk: 7,
      penaltyFake: 5
    },
    normal: {
      p1Goal: 90,
      p2Goal: 220,
      spawn1: 760,
      spawn2: 620,
      bossHp: 22,
      scoreGood: 10,
      penaltyJunk: 8,
      penaltyFake: 6
    },
    hard: {
      p1Goal: 110,
      p2Goal: 260,
      spawn1: 620,
      spawn2: 500,
      bossHp: 28,
      scoreGood: 9,
      penaltyJunk: 9,
      penaltyFake: 7
    }
  };

  const diffKey = DIFF[ctx.diff] ? ctx.diff : 'normal';
  const cfg = DIFF[diffKey];

  const state = {
    running: false,
    ended: false,
    paused: false,
    muted: false,
    pauseReason: '',

    score: 0,
    miss: 0,
    streak: 0,
    bestStreak: 0,

    hitsGood: 0,
    hitsBad: 0,
    goodMissed: 0,
    powerHits: 0,
    stormHits: 0,
    spawnedStorm: 0,

    phase: 1,
    timeTotal: Math.max(90, Number(ctx.time || 150)) * 1000,
    timeLeft: Math.max(90, Number(ctx.time || 150)) * 1000,

    lastTs: 0,
    spawnAcc: 0,
    seq: 0,
    raf: 0,

    praiseMs: 0,
    hudAwakeMs: 1800,
    presentationLockMs: 0,

    items: new Map(),
    lastTelegraphAt: 0,

    a11y: {
      reducedMotion: false,
      highContrastTelegraph: false
    },

    metrics: {
      runStartAt: Date.now(),
      bossEnterAt: 0,
      bossEndAt: 0,

      telegraphShown: 0,
      telegraphByPattern: { hunt: 0, break: 0, storm: 0 },
      telegraphReactMs: [],

      patternStarts: { hunt: 0, break: 0, storm: 0 },
      weakHitsByStage: { A: 0, B: 0, C: 0, RAGE: 0 },
      weakHitsByPattern: { hunt: 0, break: 0, storm: 0 },

      fakeWeakTapped: 0,
      stormDodgedApprox: 0,
      stormSpawned: 0,

      rageEntered: false,
      rageAtHp: 0,

      bossDurationMs: 0,
      clearTimeMs: 0
    },

    research: {
      sessionId: 'gjsb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      events: [],
      splits: {
        phase1StartAt: 0,
        phase2StartAt: 0,
        bossStartAt: 0,
        rageStartAt: 0,
        endAt: 0
      },
      counters: {
        goodTap: 0,
        junkTap: 0,
        fakeTap: 0,
        weakTap: 0,
        stormHit: 0,
        goodMiss: 0
      }
    },

    runtime: {
      timers: new Set(),
      mounted: false,
      started: false,
      destroyed: false
    },

    boss: {
      active: false,
      hp: 0,
      maxHp: 0,

      stage: 'A',
      stageReached: 'A',

      pattern: 'hunt',
      patternTimeLeft: 0,
      patternCycleIndex: -1,

      weakId: '',
      fakeWeakActive: false,
      fakeWeakDecoyId: '',

      telegraphOn: false,
      telegraphText: '',
      telegraphMs: 0,

      stormBurstLeft: 0,
      stormBurstGapMs: 0,
      stormWaveCooldown: 0,

      weakRetargetMs: 0,
      weakRetargetAcc: 0,

      rage: false,
      rageTriggered: false,
      rageEnterMs: 0,

      killSequence: false,
      introShowing: false,

      lowHpTier: 0
    }
  };

  let ui = null;

  function dlog() {
    if (!DEBUG) return;
    try {
      console.log('[GJSB]', ...arguments);
    } catch (_) {}
  }

  function rand() {
    return Math.random();
  }

  function range(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function nowMs() {
    return Date.now();
  }

  function elapsedRunMs() {
    return nowMs() - state.metrics.runStartAt;
  }

  function fmtTime(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function stageRect() {
    return ui.stage.getBoundingClientRect();
  }

  function safeTimeout(fn, ms) {
    const id = setTimeout(() => {
      state.runtime.timers.delete(id);
      try { fn(); } catch (err) { dlog('timer error', err); }
    }, ms);
    state.runtime.timers.add(id);
    return id;
  }

  function clearRuntimeTimers() {
    state.runtime.timers.forEach((id) => {
      try { clearTimeout(id); } catch (_) {}
    });
    state.runtime.timers.clear();
  }

  function safeJsonParse(text, fallback) {
    try {
      return JSON.parse(text);
    } catch (_) {
      return fallback;
    }
  }

  function storageGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : raw;
    } catch (_) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (_) {
      return false;
    }
  }

  async function safeCopyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}

    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'readonly');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return !!ok;
    } catch (_) {
      return false;
    }
  }

  function detectAccessibilityPrefs() {
    try {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      state.a11y.reducedMotion = !!mq.matches;
    } catch (_) {
      state.a11y.reducedMotion = false;
    }
    state.a11y.highContrastTelegraph = window.innerWidth < 720;
  }

  function safeAvg(arr) {
    return Array.isArray(arr) && arr.length
      ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
      : 0;
  }

  function safeRatio(a, b) {
    if (!b) return 0;
    return Number((a / b).toFixed(4));
  }

  function pushEvent(type, detail) {
    const item = {
      t: nowMs(),
      runMs: elapsedRunMs(),
      type: String(type || 'event'),
      detail: detail || {}
    };

    state.research.events.push(item);
    if (state.research.events.length > 500) {
      state.research.events.shift();
    }
  }

  function markSplit(key) {
    state.research.splits[key] = elapsedRunMs();
  }

  function saveLastSummary(payload) {
    try {
      const item = { ts: Date.now(), ...payload };
      storageSet(LAST_SUMMARY_KEY, JSON.stringify(item));

      const arr = safeJsonParse(storageGet(SUMMARY_HISTORY_KEY, '[]'), []);
      const list = Array.isArray(arr) ? arr : [];
      list.unshift(item);
      storageSet(SUMMARY_HISTORY_KEY, JSON.stringify(list.slice(0, 40)));
    } catch (_) {}
  }

  function saveResearchPayload(payload) {
    try {
      storageSet(RESEARCH_LAST_KEY, JSON.stringify(payload));

      const arr = safeJsonParse(storageGet(RESEARCH_HISTORY_KEY, '[]'), []);
      const list = Array.isArray(arr) ? arr : [];
      list.unshift(payload);
      storageSet(RESEARCH_HISTORY_KEY, JSON.stringify(list.slice(0, 30)));
    } catch (_) {}

    window.HHA_LAST_BOSS_PAYLOAD = payload;
  }

  function loadPreviousResearchPayload() {
    try {
      const raw = storageGet(RESEARCH_LAST_KEY, '');
      if (!raw) return null;
      return safeJsonParse(raw, null);
    } catch (_) {
      return null;
    }
  }

  function buildResearchPayload(bossClear, grade) {
    const avgReact = safeAvg(state.metrics.telegraphReactMs);
    const totalStormSeen = state.metrics.stormSpawned || 0;
    const totalStormDodged = state.metrics.stormDodgedApprox || 0;

    return {
      source: 'goodjunk-solo-phaseboss-v2',
      sessionId: state.research.sessionId,
      ts: nowMs(),

      participant: {
        pid: ctx.pid || 'anon',
        name: ctx.name || '',
        studyId: ctx.studyId || ''
      },

      context: {
        gameId: ctx.gameId || 'goodjunk',
        mode: 'solo',
        diff: diffKey,
        run: ctx.run || 'play',
        timeSec: Math.round(state.timeTotal / 1000),
        seed: ctx.seed || '',
        view: ctx.view || 'mobile'
      },

      outcome: {
        bossClear: !!bossClear,
        rageTriggered: !!state.boss.rageTriggered,
        grade: grade,
        score: state.score,
        miss: state.miss,
        bestStreak: state.bestStreak,
        phaseReached: state.boss.active ? 'boss' : ('phase-' + state.phase),
        bossStageReached: state.boss.stageReached,
        lastPattern: state.boss.pattern
      },

      performance: {
        hitsGood: state.hitsGood,
        hitsBad: state.hitsBad,
        goodMissed: state.goodMissed,
        powerHits: state.powerHits,
        stormHits: state.stormHits,
        fakeWeakTapped: state.metrics.fakeWeakTapped,
        stormDodgedApprox: totalStormDodged,
        stormSpawned: totalStormSeen,
        telegraphAvgReactMs: avgReact,
        telegraphShown: state.metrics.telegraphShown,
        bossDurationMs: state.metrics.bossDurationMs,
        clearTimeMs: state.metrics.clearTimeMs
      },

      derived: {
        accuracyGoodVsBad: safeRatio(state.hitsGood, state.hitsGood + state.hitsBad),
        fakeTapRatePerWeak: safeRatio(state.metrics.fakeWeakTapped, Math.max(1, state.powerHits)),
        stormDodgeRatio: safeRatio(totalStormDodged, Math.max(1, totalStormSeen)),
        telegraphResponseCount: state.metrics.telegraphReactMs.length
      },

      splits: {
        phase1StartAtMs: state.research.splits.phase1StartAt,
        phase2StartAtMs: state.research.splits.phase2StartAt,
        bossStartAtMs: state.research.splits.bossStartAt,
        rageStartAtMs: state.research.splits.rageStartAt,
        endAtMs: state.research.splits.endAt
      },

      counters: {
        goodTap: state.research.counters.goodTap,
        junkTap: state.research.counters.junkTap,
        fakeTap: state.research.counters.fakeTap,
        weakTap: state.research.counters.weakTap,
        stormHit: state.research.counters.stormHit,
        goodMiss: state.research.counters.goodMiss
      },

      analytics: {
        weakHitsByStage: state.metrics.weakHitsByStage,
        weakHitsByPattern: state.metrics.weakHitsByPattern,
        patternStarts: state.metrics.patternStarts,
        telegraphByPattern: state.metrics.telegraphByPattern
      },

      events: state.research.events.slice()
    };
  }

  function playTone(freq, duration, type, gainValue) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!playTone._ctx) playTone._ctx = new AC();
      const ac = playTone._ctx;

      const osc = ac.createOscillator();
      const gain = ac.createGain();

      osc.type = type || 'triangle';
      osc.frequency.value = freq || 440;
      gain.gain.value = gainValue || 0.02;

      osc.connect(gain);
      gain.connect(ac.destination);

      const now = ac.currentTime;
      gain.gain.setValueAtTime(gainValue || 0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (duration || 0.08));

      osc.start(now);
      osc.stop(now + (duration || 0.08));
    } catch (_) {}
  }

  function playSfx(kind) {
    if (state.muted) return;

    if (kind === 'good') {
      playTone(720, 0.05, 'triangle', 0.018);
      safeTimeout(() => playTone(900, 0.05, 'triangle', 0.014), 35);
      return;
    }

    if (kind === 'bad') {
      playTone(210, 0.08, 'sawtooth', 0.018);
      return;
    }

    if (kind === 'phase-up') {
      playTone(520, 0.08, 'triangle', 0.022);
      safeTimeout(() => playTone(720, 0.08, 'triangle', 0.02), 90);
      safeTimeout(() => playTone(980, 0.10, 'triangle', 0.022), 180);
      return;
    }

    if (kind === 'telegraph') {
      playTone(340, 0.08, 'square', 0.018);
      safeTimeout(() => playTone(340, 0.08, 'square', 0.018), 120);
      return;
    }

    if (kind === 'boss-hit') {
      playTone(560, 0.06, 'square', 0.02);
      safeTimeout(() => playTone(780, 0.07, 'triangle', 0.018), 40);
      return;
    }

    if (kind === 'boss-break') {
      playTone(520, 0.07, 'square', 0.024);
      safeTimeout(() => playTone(760, 0.09, 'triangle', 0.02), 45);
      safeTimeout(() => playTone(990, 0.09, 'triangle', 0.018), 95);
      return;
    }

    if (kind === 'boss-clear') {
      playTone(784, 0.10, 'triangle', 0.03);
      safeTimeout(() => playTone(988, 0.12, 'triangle', 0.03), 110);
      safeTimeout(() => playTone(1174, 0.16, 'triangle', 0.032), 240);
    }
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID}{
        position:absolute;
        inset:0;
        overflow:hidden;
        font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
        color:#fff;
      }

      .gjsb-stage{
        position:absolute;
        inset:0;
        overflow:hidden;
        background:
          radial-gradient(circle at 20% 16%, rgba(255,255,255,.12), transparent 18%),
          radial-gradient(circle at 82% 10%, rgba(255,255,255,.10), transparent 18%),
          linear-gradient(180deg,#93d9ff 0%, #ccefff 54%, #fff3c9 100%);
      }

      .gjsb-ground{
        position:absolute;
        left:0; right:0; bottom:0;
        height:18%;
        background:linear-gradient(180deg,#9be26a,#67c94c);
        box-shadow:inset 0 4px 0 rgba(255,255,255,.25);
      }

      .gjsb-cloud{
        position:absolute;
        width:110px;
        height:34px;
        border-radius:999px;
        background:rgba(255,255,255,.75);
        filter:blur(.5px);
        box-shadow:
          40px 0 0 4px rgba(255,255,255,.75),
          82px 6px 0 0 rgba(255,255,255,.65);
        opacity:.9;
      }
      .gjsb-cloud.c1{ left:6%; top:8%; }
      .gjsb-cloud.c2{ left:64%; top:13%; transform:scale(1.18); }
      .gjsb-cloud.c3{ left:30%; top:22%; transform:scale(.9); }

      .gjsb-topHud{
        position:absolute;
        left:8px;
        right:8px;
        top:8px;
        z-index:30;
        display:grid;
        gap:6px;
        --boss-reserve:0px;
        padding-right:var(--boss-reserve);
        transition:padding-right .16s ease;
      }

      .gjsb-topHud.compact .gjsb-bar{
        grid-template-columns:repeat(3,minmax(0,1fr));
      }

      .gjsb-topHud.compact .gjsb-pill{
        min-height:26px;
        padding:4px 6px;
        font-size:10px;
      }

      .gjsb-topHud.compact .gjsb-progressWrap{
        height:7px;
      }

      .gjsb-topHud.boss-mode{
        --boss-reserve:0px !important;
        padding-right:0 !important;
      }

      .gjsb-topHud.boss-mode #hudPhase{
        display:none !important;
      }

      .gjsb-topHud.boss-mode .gjsb-bar{
        grid-template-columns:repeat(4,minmax(0,1fr));
      }

      .gjsb-topHud.boss-mode .gjsb-progressWrap{
        width:100% !important;
        max-width:100% !important;
      }

      .gjsb-bar{
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(120px,1fr));
        gap:6px;
        align-items:center;
      }

      .gjsb-pill{
        min-height:30px;
        padding:6px 8px;
        border-radius:999px;
        background:rgba(255,255,255,.88);
        color:#55514a;
        box-shadow:0 6px 12px rgba(86,155,194,.10);
        border:2px solid rgba(191,227,242,.95);
        font-size:11px;
        font-weight:1000;
        text-align:center;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .gjsb-banner{
        position:absolute;
        left:50%;
        top:36px;
        transform:translateX(-50%);
        width:min(76vw,340px);
        padding:8px 12px;
        border-radius:14px;
        background:rgba(255,255,255,.92);
        color:#5e5a52;
        border:2px solid rgba(191,227,242,.95);
        box-shadow:0 8px 16px rgba(86,155,194,.10);
        text-align:center;
        font-size:11px;
        line-height:1.35;
        font-weight:1000;
        transition:opacity .2s ease, transform .2s ease;
        z-index:31;
      }
      .gjsb-banner.hide{
        opacity:0;
        transform:translateX(-50%) translateY(-6px);
      }

      .gjsb-praise{
        display:none;
        justify-self:center;
        padding:8px 14px;
        border-radius:999px;
        background:linear-gradient(180deg,#fffef4,#ffffff);
        border:3px solid #ffe08a;
        color:#9d6016;
        box-shadow:0 10px 20px rgba(86,155,194,.12);
        text-align:center;
        font-size:13px;
        font-weight:1000;
        animation:gjsbPraisePop .52s ease;
      }
      .gjsb-praise.show{ display:block; }

      @keyframes gjsbPraisePop{
        0%{ opacity:0; transform:translateY(6px) scale(.92); }
        35%{ opacity:1; transform:translateY(0) scale(1.04); }
        100%{ opacity:1; transform:translateY(0) scale(1); }
      }

      .gjsb-telegraph{
        display:none;
        position:absolute;
        left:50%;
        top:70px;
        transform:translateX(-50%);
        width:min(80vw,360px);
        padding:8px 12px;
        border-radius:14px;
        background:linear-gradient(180deg,#fff2f2,#ffffff);
        color:#a6461c;
        border:2px solid #ffd1c2;
        box-shadow:0 8px 16px rgba(86,155,194,.10);
        text-align:center;
        font-size:11px;
        line-height:1.35;
        font-weight:1000;
        animation:gjsbTelegraphPulse .55s ease-in-out infinite;
        z-index:32;
      }
      .gjsb-telegraph.show{ display:block; }

      .gjsb-telegraph.hc{
        background:linear-gradient(180deg,#fff7dc,#ffffff);
        color:#8a4d00;
        border:3px solid #ffcf70;
        box-shadow:0 10px 20px rgba(255,181,71,.18);
      }

      @keyframes gjsbTelegraphPulse{
        0%,100%{ transform:translateX(-50%) scale(1); }
        50%{ transform:translateX(-50%) scale(1.03); }
      }

      .gjsb-progressWrap{
        height:8px;
        border-radius:999px;
        background:rgba(255,255,255,.82);
        border:2px solid rgba(191,227,242,.95);
        overflow:hidden;
        width:100%;
        max-width:100%;
        box-shadow:0 6px 12px rgba(86,155,194,.08);
      }

      .gjsb-progressFill{
        height:100%;
        width:100%;
        transform-origin:left center;
        background:linear-gradient(90deg,#7fcfff,#7ed957);
        transition:transform .1s linear;
      }

      .gjsb-utilRow{
        display:flex;
        gap:6px;
        align-items:center;
        justify-content:flex-end;
        margin-top:4px;
      }

      .gjsb-utilBtn{
        min-height:32px;
        min-width:32px;
        padding:6px 10px;
        border:none;
        border-radius:12px;
        background:rgba(255,255,255,.92);
        color:#57534c;
        border:2px solid rgba(191,227,242,.95);
        box-shadow:0 6px 12px rgba(86,155,194,.08);
        font-size:11px;
        font-weight:1000;
        cursor:pointer;
      }

      .gjsb-utilBtn.active{
        background:#eefbff;
        color:#2d6f94;
      }

      .gjsb-boss{
        position:absolute;
        right:8px;
        top:52px;
        z-index:28;
        width:min(190px,46vw);
        display:none;
        transition:top .18s ease,right .18s ease,width .18s ease,transform .18s ease;
      }
      .gjsb-boss.show{ display:block; }

      .gjsb-boss.dock-lower{
        top:auto !important;
        right:10px !important;
        bottom:108px !important;
        width:min(220px,34vw);
      }

      .gjsb-boss.dock-lower .gjsb-boss-card{
        box-shadow:
          0 14px 28px rgba(86,155,194,.18),
          0 0 0 6px rgba(255,255,255,.18);
      }

      .gjsb-boss-card{
        border-radius:18px;
        background:linear-gradient(180deg,#fffdf4,#fff7da);
        border:3px solid rgba(255,212,92,.95);
        box-shadow:0 10px 18px rgba(86,155,194,.12);
        padding:8px 9px;
        color:#5e5a52;
        position:relative;
      }

      .gjsb-boss-card.rage{
        border-color:#ffb0a2;
        box-shadow:0 12px 24px rgba(86,155,194,.14), 0 0 0 6px rgba(255,120,120,.12);
        animation:gjsbRagePulse .8s ease-in-out infinite;
      }

      .gjsb-boss-card.hurt{
        animation:gjsbBossHurt .22s linear 1;
      }

      @keyframes gjsbBossHurt{
        0%{ transform:translateX(0) scale(1); filter:brightness(1); }
        25%{ transform:translateX(-4px) scale(1.02); filter:brightness(1.08); }
        50%{ transform:translateX(4px) scale(.99); filter:brightness(1.18); }
        100%{ transform:translateX(0) scale(1); filter:brightness(1); }
      }

      .gjsb-rageAura{
        position:absolute;
        inset:-10px;
        border-radius:28px;
        pointer-events:none;
        opacity:0;
        background:
          radial-gradient(circle at 50% 50%, rgba(255,120,120,.18), transparent 50%),
          radial-gradient(circle at 30% 20%, rgba(255,80,80,.14), transparent 36%),
          radial-gradient(circle at 70% 78%, rgba(255,145,70,.16), transparent 34%);
      }

      .gjsb-rageAura.show{
        opacity:1;
        animation:gjsbAuraPulse .9s ease-in-out infinite;
      }

      @keyframes gjsbAuraPulse{
        0%,100%{ transform:scale(1); filter:brightness(1); }
        50%{ transform:scale(1.03); filter:brightness(1.06); }
      }

      @keyframes gjsbRagePulse{
        0%,100%{
          transform:scale(1);
          box-shadow:0 12px 24px rgba(86,155,194,.14), 0 0 0 6px rgba(255,120,120,.10);
        }
        50%{
          transform:scale(1.015);
          box-shadow:0 12px 28px rgba(86,155,194,.18), 0 0 0 10px rgba(255,120,120,.18);
        }
      }

      .gjsb-boss-head{
        display:grid;
        grid-template-columns:40px 1fr;
        gap:7px;
        align-items:center;
      }

      .gjsb-boss-icon{
        width:40px;
        height:40px;
        border-radius:14px;
        display:grid;
        place-items:center;
        font-size:22px;
        background:linear-gradient(180deg,#fff0be,#ffe08a);
        border:2px solid rgba(255,212,92,.95);
      }

      .gjsb-boss-title{
        font-size:14px;
        font-weight:1000;
        line-height:1.05;
      }

      .gjsb-boss-sub{
        margin-top:3px;
        font-size:10px;
        line-height:1.25;
        color:#7b7a72;
        font-weight:1000;
      }

      .gjsb-boss-stage{
        margin-top:7px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:5px 8px;
        border-radius:999px;
        background:#fff;
        border:2px solid #f3df97;
        font-size:10px;
        font-weight:1000;
      }

      .gjsb-boss-stage.a{ color:#7c6c14; background:#fff8dd; }
      .gjsb-boss-stage.b{ color:#9a5f10; background:#fff0cf; }
      .gjsb-boss-stage.c{ color:#a33e1a; background:#ffe1d8; }

      .gjsb-patternChip{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        margin-top:8px;
        padding:6px 10px;
        border-radius:999px;
        background:#fff;
        border:2px solid #e8eef2;
        color:#7b7a72;
        font-size:11px;
        font-weight:1000;
      }

      .gjsb-patternChip.hunt{ background:#eefbff; border-color:#cdeeff; color:#31739a; }
      .gjsb-patternChip.break{ background:#fff2e4; border-color:#ffd8ae; color:#a35b12; }
      .gjsb-patternChip.storm{ background:#fff0f0; border-color:#ffc6c6; color:#b3472d; }

      .gjsb-rageBadge{
        display:none;
        margin-top:8px;
        align-items:center;
        justify-content:center;
        padding:6px 10px;
        border-radius:999px;
        font-size:11px;
        font-weight:1000;
        background:#fff0f0;
        border:2px solid #ffc6c6;
        color:#b3472d;
      }
      .gjsb-rageBadge.show{ display:inline-flex; }

      .gjsb-boss-bar{
        margin-top:10px;
        height:14px;
        border-radius:999px;
        overflow:hidden;
        background:#eef4f7;
        border:2px solid #d9eaf5;
      }

      .gjsb-boss-fill{
        height:100%;
        width:100%;
        transform-origin:left center;
        background:linear-gradient(90deg,#ffd45c,#ff8f3b);
        transition:transform .12s linear;
      }

      .gjsb-boss-hp{
        margin-top:4px;
        text-align:right;
        font-size:10px;
        font-weight:1000;
        color:#7b7a72;
      }

      .gjsb-item{
        position:absolute;
        display:grid;
        place-items:center;
        border:none;
        cursor:pointer;
        border-radius:22px;
        background:rgba(255,255,255,.92);
        box-shadow:0 10px 22px rgba(86,155,194,.18);
        border:3px solid rgba(191,227,242,.95);
        color:#222;
        user-select:none;
        -webkit-user-select:none;
      }

      .gjsb-item.good{ background:linear-gradient(180deg,#f7fff1,#ffffff); }
      .gjsb-item.junk,
      .gjsb-item.storm{
        background:linear-gradient(180deg,#fff3f3,#ffffff);
        border-color:#ffd3d3;
      }

      .gjsb-item.weak{
        background:linear-gradient(180deg,#fff8d5,#ffffff);
        border-color:#ffe08a;
        animation:gjsbPulse .9s infinite;
      }

      .gjsb-item.weak.break{
        border-color:#ffbe7a;
        background:linear-gradient(180deg,#fff1da,#ffffff);
      }

      .gjsb-item.fakeweak{
        background:linear-gradient(180deg,#fff2f2,#ffffff);
        border-color:#ffc7c7;
        animation:gjsbFakeBlink .42s ease-in-out infinite;
      }

      @keyframes gjsbPulse{
        0%,100%{ transform:scale(1); }
        50%{ transform:scale(1.06); }
      }

      @keyframes gjsbFakeBlink{
        0%,100%{ transform:scale(1); filter:brightness(1); }
        50%{ transform:scale(1.03); filter:brightness(1.08); }
      }

      .gjsb-emoji{
        font-size:34px;
        line-height:1;
        pointer-events:none;
      }

      .gjsb-tag{
        position:absolute;
        left:6px;
        right:6px;
        bottom:4px;
        text-align:center;
        font-size:10px;
        color:#6b7280;
        font-weight:1000;
        pointer-events:none;
      }

      .gjsb-fx{
        position:absolute;
        transform:translate(-50%,-50%);
        font-size:16px;
        font-weight:1000;
        z-index:35;
        pointer-events:none;
        animation:gjsbFx .75s ease forwards;
        text-shadow:0 8px 18px rgba(0,0,0,.14);
      }

      .gjsb-scorePop{
        position:absolute;
        transform:translate(-50%,-50%) scale(.9);
        z-index:36;
        pointer-events:none;
        font-weight:1100;
        line-height:1;
        text-shadow:0 8px 18px rgba(0,0,0,.16);
        opacity:0;
      }

      .gjsb-scorePop.show{
        animation:gjsbScorePop .7s cubic-bezier(.2,.8,.2,1) forwards;
      }

      .gjsb-scorePop.good{ color:#2f8f2f; }
      .gjsb-scorePop.power{ color:#cf8a00; }
      .gjsb-scorePop.bad{ color:#d16b27; }

      @keyframes gjsbScorePop{
        0%{ opacity:0; transform:translate(-50%,-10%) scale(.72); }
        18%{ opacity:1; transform:translate(-50%,-42%) scale(1.12); }
        100%{ opacity:0; transform:translate(-50%,-155%) scale(1); }
      }

      @keyframes gjsbFx{
        from{ opacity:1; transform:translate(-50%,-10%); }
        to{ opacity:0; transform:translate(-50%,-150%); }
      }

      .gjsb-trailDot{
        position:absolute;
        pointer-events:none;
        z-index:14;
        border-radius:999px;
        opacity:.9;
        transform:translate(-50%,-50%) scale(1);
        animation:gjsbTrailFade .34s linear forwards;
      }

      .gjsb-trailDot.weak{
        background:radial-gradient(circle, rgba(255,224,138,.95), rgba(255,224,138,.25) 60%, rgba(255,224,138,0) 72%);
        box-shadow:0 0 12px rgba(255,224,138,.35);
      }

      .gjsb-trailDot.fake{
        background:radial-gradient(circle, rgba(255,145,145,.90), rgba(255,145,145,.22) 60%, rgba(255,145,145,0) 72%);
        box-shadow:0 0 10px rgba(255,120,120,.28);
      }

      @keyframes gjsbTrailFade{
        0%{ opacity:.95; transform:translate(-50%,-50%) scale(1); }
        100%{ opacity:0; transform:translate(-50%,-50%) scale(.42); }
      }

      .gjsb-afterImage{
        position:absolute;
        pointer-events:none;
        z-index:13;
        border-radius:22px;
        border:2px solid rgba(255,199,199,.72);
        background:linear-gradient(180deg, rgba(255,242,242,.78), rgba(255,255,255,.30));
        opacity:.65;
        animation:gjsbAfterImageFade .28s linear forwards;
      }

      .gjsb-afterImage .gjsb-emoji{
        opacity:.7;
        filter:saturate(.85);
      }

      @keyframes gjsbAfterImageFade{
        0%{ opacity:.62; transform:scale(1); }
        100%{ opacity:0; transform:scale(.92); }
      }

      .gjsb-impact{
        position:absolute;
        pointer-events:none;
        z-index:19;
        border-radius:999px;
        transform:translate(-50%,-50%) scale(.5);
        opacity:.95;
        animation:gjsbImpactPop .42s ease-out forwards;
      }

      .gjsb-impact.storm{
        background:
          radial-gradient(circle, rgba(255,255,255,.92) 0 18%, rgba(255,170,140,.88) 20%, rgba(255,120,120,.48) 42%, rgba(255,120,120,0) 72%);
      }

      .gjsb-impact.hit{
        background:
          radial-gradient(circle, rgba(255,255,255,.95) 0 20%, rgba(255,220,120,.92) 22%, rgba(255,170,70,.52) 46%, rgba(255,170,70,0) 74%);
      }

      @keyframes gjsbImpactPop{
        0%{ opacity:.96; transform:translate(-50%,-50%) scale(.45); }
        55%{ opacity:.78; transform:translate(-50%,-50%) scale(1); }
        100%{ opacity:0; transform:translate(-50%,-50%) scale(1.28); }
      }

      .gjsb-flash{
        position:absolute;
        inset:0;
        z-index:42;
        pointer-events:none;
        background:radial-gradient(circle at 50% 32%, rgba(255,255,255,.82), rgba(255,255,255,0) 60%);
        opacity:0;
      }
      .gjsb-flash.show{ animation:gjsbFlash .55s ease; }

      @keyframes gjsbFlash{
        0%{ opacity:0; }
        18%{ opacity:1; }
        100%{ opacity:0; }
      }

      .gjsb-dangerEdge{
        position:absolute;
        inset:0;
        z-index:41;
        pointer-events:none;
        box-shadow:inset 0 0 0 0 rgba(255,84,84,0);
        opacity:0;
      }
      .gjsb-dangerEdge.show{ animation:gjsbDangerPulse .5s ease-in-out infinite; }

      @keyframes gjsbDangerPulse{
        0%,100%{ opacity:.25; box-shadow:inset 0 0 0 0 rgba(255,84,84,0); }
        50%{ opacity:1; box-shadow:inset 0 0 0 10px rgba(255,120,120,.28), inset 0 0 40px 18px rgba(255,86,86,.18); }
      }

      .gjsb-stormLane{
        position:absolute;
        top:0;
        bottom:0;
        width:72px;
        pointer-events:none;
        opacity:0;
        z-index:18;
        background:
          linear-gradient(180deg, rgba(255,110,110,.00), rgba(255,110,110,.18) 22%, rgba(255,120,120,.28) 50%, rgba(255,110,110,.18) 78%, rgba(255,110,110,.00)),
          repeating-linear-gradient(180deg, rgba(255,255,255,.28) 0 10px, rgba(255,255,255,0) 10px 20px);
        border-left:2px dashed rgba(255,255,255,.45);
        border-right:2px dashed rgba(255,255,255,.45);
        box-shadow:inset 0 0 18px rgba(255,90,90,.18);
      }

      .gjsb-stormLane.show{
        opacity:1;
        animation:gjsbLaneBlink .45s ease-in-out infinite;
      }

      .gjsb-stormLane.hc{
        background:
          linear-gradient(180deg, rgba(255,110,110,.05), rgba(255,110,110,.24) 22%, rgba(255,120,120,.38) 50%, rgba(255,110,110,.24) 78%, rgba(255,110,110,.05)),
          repeating-linear-gradient(180deg, rgba(255,255,255,.46) 0 12px, rgba(255,255,255,0) 12px 22px);
        border-left:3px dashed rgba(255,255,255,.7);
        border-right:3px dashed rgba(255,255,255,.7);
      }

      @keyframes gjsbLaneBlink{
        0%,100%{ opacity:.42; }
        50%{ opacity:.9; }
      }

      .gjsb-stage.shake{ animation:gjsbShake .22s linear 1; }
      @keyframes gjsbShake{
        0%{ transform:translate3d(0,0,0); }
        20%{ transform:translate3d(-6px,2px,0); }
        40%{ transform:translate3d(6px,-2px,0); }
        60%{ transform:translate3d(-4px,1px,0); }
        80%{ transform:translate3d(4px,-1px,0); }
        100%{ transform:translate3d(0,0,0); }
      }

      .gjsb-phasePulse{
        position:absolute;
        inset:0;
        z-index:16;
        pointer-events:none;
        opacity:0;
        background:
          radial-gradient(circle at 50% 30%, rgba(255,255,255,.26), transparent 42%),
          linear-gradient(180deg, rgba(255,230,120,.00), rgba(255,230,120,.10) 45%, rgba(255,180,80,.00));
      }

      .gjsb-phasePulse.show{
        animation:gjsbPhasePulse .7s ease-out 1;
      }

      @keyframes gjsbPhasePulse{
        0%{ opacity:0; transform:scale(.98); }
        25%{ opacity:1; transform:scale(1.01); }
        100%{ opacity:0; transform:scale(1); }
      }

      .gjsb-presentation{
        position:absolute;
        inset:0;
        z-index:54;
        pointer-events:none;
      }

      .gjsb-bossIntro,
      .gjsb-patternBanner{
        position:absolute;
        left:50%;
        top:50%;
        transform:translate(-50%,-50%) scale(.94);
        width:min(92vw,560px);
        border-radius:28px;
        background:linear-gradient(180deg,#fffef8,#fff8e6);
        border:4px solid #ffe29b;
        box-shadow:0 20px 40px rgba(86,155,194,.18);
        padding:18px;
        color:#5a554c;
        text-align:center;
        opacity:0;
      }

      .gjsb-bossIntro.show,
      .gjsb-patternBanner.show{ animation:gjsbPopCard .72s cubic-bezier(.2,.8,.2,1) forwards; }

      @keyframes gjsbPopCard{
        0%{ opacity:0; transform:translate(-50%,-50%) scale(.82); }
        12%{ opacity:1; transform:translate(-50%,-50%) scale(1.04); }
        82%{ opacity:1; transform:translate(-50%,-50%) scale(1); }
        100%{ opacity:0; transform:translate(-50%,-50%) scale(.98); }
      }

      .gjsb-cardKicker{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:8px 14px;
        border-radius:999px;
        background:#fff;
        border:2px solid #f3df97;
        color:#8c6a18;
        font-size:12px;
        font-weight:1000;
      }

      .gjsb-cardIcon{
        margin:12px auto 8px;
        width:96px;
        height:96px;
        border-radius:28px;
        display:grid;
        place-items:center;
        font-size:46px;
        background:linear-gradient(180deg,#fff4ca,#fffdf4);
        border:4px solid #ffe08a;
        box-shadow:0 10px 20px rgba(86,155,194,.12);
      }

      .gjsb-cardTitle{
        margin:6px 0 0;
        font-size:36px;
        line-height:1.04;
        color:#9d6016;
        font-weight:1000;
      }

      .gjsb-cardSub{
        margin-top:8px;
        font-size:15px;
        line-height:1.5;
        color:#746e65;
        font-weight:1000;
      }

      .gjsb-patternBanner{
        background:linear-gradient(180deg,#fffef8,#f6fbff);
        border-color:#bfe3f2;
      }
      .gjsb-patternBanner.hunt .gjsb-cardKicker{ border-color:#cdeeff; color:#31739a; }
      .gjsb-patternBanner.break .gjsb-cardKicker{ border-color:#ffd8ae; color:#a35b12; }
      .gjsb-patternBanner.storm .gjsb-cardKicker{ border-color:#ffc6c6; color:#b3472d; }

      .gjsb-victoryMoment{
        position:absolute;
        inset:0;
        z-index:58;
        pointer-events:none;
        display:none;
        place-items:center;
        background:
          radial-gradient(circle at 50% 40%, rgba(255,255,255,.18), transparent 32%),
          linear-gradient(180deg, rgba(255,246,190,.12), rgba(255,255,255,0));
      }

      .gjsb-victoryMoment.show{
        display:grid;
        animation:gjsbVictoryFade .8s ease-out forwards;
      }

      .gjsb-victoryCard{
        min-width:min(84vw,420px);
        max-width:88vw;
        border-radius:28px;
        border:4px solid #ffe08a;
        background:linear-gradient(180deg,#fffef5,#fff9df);
        box-shadow:0 20px 40px rgba(86,155,194,.18);
        padding:18px 20px;
        text-align:center;
        color:#8a5a00;
        transform:scale(.86);
        animation:gjsbVictoryPop .55s cubic-bezier(.2,.8,.2,1) forwards;
      }

      .gjsb-victoryKicker{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:7px 14px;
        border-radius:999px;
        background:#fff;
        border:2px solid #f3df97;
        font-size:12px;
        font-weight:1000;
      }

      .gjsb-victoryTitle{
        margin-top:12px;
        font-size:34px;
        line-height:1.04;
        font-weight:1000;
        color:#c57b00;
        text-shadow:0 2px 0 #fff;
      }

      .gjsb-victorySub{
        margin-top:8px;
        font-size:15px;
        line-height:1.55;
        color:#7b6f5f;
        font-weight:1000;
      }

      @keyframes gjsbVictoryPop{
        0%{ opacity:0; transform:scale(.78); }
        30%{ opacity:1; transform:scale(1.05); }
        100%{ opacity:1; transform:scale(1); }
      }

      @keyframes gjsbVictoryFade{
        0%{ opacity:0; }
        12%{ opacity:1; }
        100%{ opacity:1; }
      }

      .gjsb-pause{
        position:absolute;
        inset:0;
        z-index:70;
        display:none;
        place-items:center;
        background:rgba(255,255,255,.42);
        backdrop-filter:blur(4px);
      }

      .gjsb-pause.show{
        display:grid;
      }

      .gjsb-pauseCard{
        width:min(88vw,420px);
        border-radius:24px;
        background:linear-gradient(180deg,#fffef8,#fff);
        border:4px solid #d7edf7;
        box-shadow:0 18px 36px rgba(86,155,194,.18);
        padding:18px;
        text-align:center;
        color:#5a554c;
      }

      .gjsb-pauseTitle{
        font-size:28px;
        line-height:1.08;
        font-weight:1000;
        color:#67a91c;
      }

      .gjsb-pauseSub{
        margin-top:8px;
        font-size:14px;
        line-height:1.55;
        color:#7b7a72;
        font-weight:1000;
      }

      .gjsb-pauseActions{
        display:grid;
        gap:10px;
        margin-top:16px;
      }

      .gjsb-pauseBtn{
        border:none;
        border-radius:18px;
        padding:13px 16px;
        font-size:15px;
        font-weight:1000;
        cursor:pointer;
      }

      .gjsb-pauseBtn.resume{
        background:linear-gradient(180deg,#7ed957,#58c33f);
        color:#173b0b;
      }

      .gjsb-pauseBtn.hub{
        background:#fff;
        color:#6c6a61;
        border:3px solid #d7edf7;
      }

      .gjsb-summary{
        position:absolute;
        inset:0;
        z-index:60;
        display:none;
        place-items:center;
        background:rgba(255,255,255,.30);
        backdrop-filter:blur(4px);
        padding:16px;
      }
      .gjsb-summary.show{ display:grid; }

      .gjsb-summary-card{
        width:min(94vw,760px);
        max-height:88vh;
        overflow:auto;
        border-radius:28px;
        background:linear-gradient(180deg,#fffef8,#f8fff3);
        border:4px solid #bfe3f2;
        box-shadow:0 18px 36px rgba(86,155,194,.18);
        padding:18px;
        color:#55514a;
        position:relative;
      }

      .gjsb-summary-card.celebrate{
        box-shadow:
          0 22px 46px rgba(86,155,194,.20),
          0 0 0 10px rgba(255,224,138,.10);
      }

      .gjsb-summary-card.replay-hot{
        box-shadow:
          0 18px 36px rgba(86,155,194,.18),
          0 0 0 8px rgba(127,207,255,.08);
      }

      .gjsb-summary-card.grade-s{
        background:linear-gradient(180deg,#fffdf2,#fff7d8);
        border-color:#ffe08a;
      }

      .gjsb-summary-card.grade-a{
        background:linear-gradient(180deg,#fbfff4,#f3ffe6);
        border-color:#cfe9b8;
      }

      .gjsb-summary-card.grade-b{
        background:linear-gradient(180deg,#f8fdff,#eef9ff);
        border-color:#cdeeff;
      }

      .gjsb-summary-card.grade-c{
        background:linear-gradient(180deg,#fffdf9,#fff6ef);
        border-color:#ead7c6;
      }

      .gjsb-confetti{
        position:absolute;
        inset:0;
        overflow:hidden;
        pointer-events:none;
        border-radius:28px;
        z-index:2;
      }

      .gjsb-confettiPiece{
        position:absolute;
        top:-18px;
        width:12px;
        height:18px;
        border-radius:999px;
        opacity:.95;
        animation:gjsbConfettiFall linear forwards;
      }

      .gjsb-confettiPiece.s{ background:#ffd45c; }
      .gjsb-confettiPiece.a{ background:#7ed957; }
      .gjsb-confettiPiece.b{ background:#7fcfff; }
      .gjsb-confettiPiece.c{ background:#ffc5b0; }

      @keyframes gjsbConfettiFall{
        0%{ opacity:0; transform:translate3d(0,0,0) rotate(0deg); }
        10%{ opacity:1; }
        100%{ opacity:1; transform:translate3d(var(--dx), 105vh, 0) rotate(var(--rot)); }
      }

      .gjsb-summary-ribbon{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:8px 14px;
        border-radius:999px;
        background:#eaf8ff;
        border:2px solid #bfe3f2;
        color:#5ea8d0;
        font-size:12px;
        font-weight:1000;
      }

      .gjsb-summary-head.celebrate .gjsb-summary-ribbon{
        animation:gjsbRibbonPop .55s cubic-bezier(.2,.8,.2,1) both;
      }

      @keyframes gjsbRibbonPop{
        0%{ opacity:0; transform:translateY(-6px) scale(.94); }
        60%{ opacity:1; transform:translateY(0) scale(1.04); }
        100%{ opacity:1; transform:translateY(0) scale(1); }
      }

      .gjsb-summary-head{
        text-align:center;
        margin-bottom:14px;
        position:relative;
        z-index:3;
      }

      .gjsb-medal{
        margin:10px auto 0;
        width:110px;
        height:110px;
        border-radius:32px;
        display:grid;
        place-items:center;
        font-size:50px;
        background:linear-gradient(180deg,#fff8d8,#fffef6);
        border:4px solid #d7edf7;
        box-shadow:0 12px 24px rgba(86,155,194,.14);
      }

      .gjsb-medal.shine{
        position:relative;
        overflow:hidden;
        animation:gjsbMedalPop .62s cubic-bezier(.2,.8,.2,1) both;
      }

      .gjsb-medal.shine::after{
        content:"";
        position:absolute;
        inset:-20%;
        background:linear-gradient(120deg, transparent 0 35%, rgba(255,255,255,.85) 48%, transparent 60% 100%);
        transform:translateX(-120%) rotate(10deg);
        animation:gjsbMedalSweep 1.1s ease .35s 1 both;
      }

      @keyframes gjsbMedalPop{
        0%{ opacity:0; transform:scale(.76) rotate(-8deg); }
        50%{ opacity:1; transform:scale(1.08) rotate(4deg); }
        100%{ opacity:1; transform:scale(1) rotate(0); }
      }

      @keyframes gjsbMedalSweep{
        0%{ transform:translateX(-120%) rotate(10deg); }
        100%{ transform:translateX(120%) rotate(10deg); }
      }

      .gjsb-grade{
        margin-top:10px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-width:110px;
        padding:10px 16px;
        border-radius:999px;
        font-size:24px;
        font-weight:1000;
        background:#fff;
        border:3px solid #d7edf7;
        color:#5a6f80;
      }
      .gjsb-grade.s{ color:#a05a00; border-color:#ffe08a; background:#fff8db; }
      .gjsb-grade.a{ color:#45802d; border-color:#cfe9b8; background:#f7fff0; }
      .gjsb-grade.b{ color:#2d6f8b; border-color:#cdeeff; background:#f1fbff; }
      .gjsb-grade.c{ color:#8b6a53; border-color:#ead7c6; background:#fff8f3; }

      .gjsb-grade.pop{
        animation:gjsbGradePop .58s cubic-bezier(.2,.8,.2,1) both;
      }

      @keyframes gjsbGradePop{
        0%{ opacity:0; transform:scale(.7); }
        55%{ opacity:1; transform:scale(1.12); }
        100%{ opacity:1; transform:scale(1); }
      }

      .gjsb-stars{
        font-size:30px;
        line-height:1;
        margin:10px 0 6px;
      }

      .gjsb-stars.celebrate{
        display:flex;
        justify-content:center;
        gap:8px;
        flex-wrap:wrap;
      }

      .gjsb-star{
        display:inline-block;
        opacity:0;
        transform:translateY(8px) scale(.72) rotate(-10deg);
        animation:gjsbStarPop .55s cubic-bezier(.2,.8,.2,1) forwards;
        animation-delay:var(--delay,0ms);
      }

      @keyframes gjsbStarPop{
        0%{ opacity:0; transform:translateY(8px) scale(.72) rotate(-10deg); }
        60%{ opacity:1; transform:translateY(-2px) scale(1.14) rotate(6deg); }
        100%{ opacity:1; transform:translateY(0) scale(1) rotate(0); }
      }

      .gjsb-summary-head h2.pop,
      #sumSub.pop{
        animation:gjsbTextHeroPop .52s cubic-bezier(.2,.8,.2,1) both;
      }

      @keyframes gjsbTextHeroPop{
        0%{ opacity:0; transform:translateY(8px) scale(.96); }
        100%{ opacity:1; transform:translateY(0) scale(1); }
      }

      .gjsb-summary-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:10px;
        position:relative;
        z-index:3;
      }

      .gjsb-stat{
        border-radius:18px;
        background:#fff;
        border:3px solid #d7edf7;
        padding:12px;
      }

      .gjsb-stat.reveal{
        opacity:0;
        transform:translateY(10px) scale(.96);
        animation:gjsbStatReveal .46s ease forwards;
        animation-delay:var(--delay,0ms);
      }

      @keyframes gjsbStatReveal{
        0%{ opacity:0; transform:translateY(10px) scale(.96); }
        100%{ opacity:1; transform:translateY(0) scale(1); }
      }

      .gjsb-stat .k{
        font-size:12px;
        color:#7b7a72;
        font-weight:1000;
      }

      .gjsb-stat .v{
        margin-top:6px;
        font-size:28px;
        font-weight:1000;
      }

      .gjsb-coach{
        margin-top:12px;
        border-radius:18px;
        background:linear-gradient(180deg,#fffef6,#fff);
        border:3px solid #d7edf7;
        padding:12px 14px;
        font-size:14px;
        line-height:1.5;
        color:#6b675f;
        font-weight:1000;
        position:relative;
        z-index:3;
      }

      .gjsb-nextHint{
        margin-top:12px;
        border-radius:18px;
        background:linear-gradient(180deg,#fffef6,#fff);
        border:3px dashed #d7edf7;
        padding:12px 14px;
        font-size:14px;
        line-height:1.55;
        color:#6b675f;
        font-weight:1000;
        position:relative;
        z-index:3;
      }

      .gjsb-coach.reveal,
      .gjsb-nextHint.reveal,
      .gjsb-compareBox.reveal{
        opacity:0;
        transform:translateY(8px);
        animation:gjsbTextReveal .46s ease forwards;
        animation-delay:var(--delay,0ms);
      }

      @keyframes gjsbTextReveal{
        0%{ opacity:0; transform:translateY(8px); }
        100%{ opacity:1; transform:translateY(0); }
      }

      .gjsb-compareBox{
        margin-top:12px;
        border-radius:18px;
        background:linear-gradient(180deg,#fffef6,#fff);
        border:3px solid #d7edf7;
        padding:12px 14px;
        color:#6b675f;
        position:relative;
        z-index:3;
      }

      .gjsb-compareHead{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        flex-wrap:wrap;
      }

      .gjsb-compareTitle{
        font-size:14px;
        font-weight:1000;
        color:#4d4a42;
      }

      .gjsb-compareBadge{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:30px;
        padding:6px 12px;
        border-radius:999px;
        font-size:12px;
        font-weight:1000;
        border:2px solid #d7edf7;
        background:#fff;
        color:#5d6e7a;
      }

      .gjsb-compareBadge.better{
        background:#eefcf0;
        border-color:#d2f3d7;
        color:#247635;
      }

      .gjsb-compareBadge.worse{
        background:#fff6f0;
        border-color:#ffd6c8;
        color:#b75a32;
      }

      .gjsb-compareBadge.same{
        background:#f5fbff;
        border-color:#d7edf7;
        color:#2d6f8b;
      }

      .gjsb-compareGrid{
        margin-top:10px;
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:10px;
      }

      .gjsb-compareStat{
        border-radius:16px;
        background:#fff;
        border:2px solid #e3f2f8;
        padding:10px 12px;
      }

      .gjsb-compareK{
        font-size:12px;
        font-weight:1000;
        color:#7b7a72;
      }

      .gjsb-compareV{
        margin-top:4px;
        font-size:20px;
        font-weight:1000;
        color:#244f6d;
      }

      .gjsb-compareDelta{
        margin-top:4px;
        font-size:12px;
        font-weight:1000;
      }

      .gjsb-compareDelta.up{ color:#247635; }
      .gjsb-compareDelta.down{ color:#b75a32; }
      .gjsb-compareDelta.flat{ color:#6b7280; }

      .gjsb-exportMeta{
        margin-top:8px;
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }

      .gjsb-exportChip{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:28px;
        padding:5px 10px;
        border-radius:999px;
        background:#fff;
        border:2px solid #d7edf7;
        color:#5d6e7a;
        font-size:11px;
        font-weight:1000;
      }

      .gjsb-nextHint.pretty{
        background:linear-gradient(180deg,#f7fcff,#ffffff);
        border-style:solid;
      }

      .gjsb-actions{
        display:grid;
        gap:10px;
        margin-top:16px;
        position:relative;
        z-index:3;
      }

      .gjsb-btn{
        border:none;
        border-radius:18px;
        padding:14px 16px;
        font-size:16px;
        font-weight:1000;
        cursor:pointer;
      }

      .gjsb-btn.replay{ background:linear-gradient(180deg,#7ed957,#58c33f); color:#173b0b; }
      .gjsb-btn.cooldown{ background:linear-gradient(180deg,#7fcfff,#58b7f5); color:#08374d; }
      .gjsb-btn.hub{ background:#fff; color:#6c6a61; border:3px solid #d7edf7; }

      .gjsb-actions.celebrate .gjsb-btn{
        opacity:0;
        transform:translateY(10px) scale(.97);
        animation:gjsbBtnReveal .5s cubic-bezier(.2,.8,.2,1) forwards;
        animation-delay:var(--delay,0ms);
      }

      @keyframes gjsbBtnReveal{
        0%{ opacity:0; transform:translateY(10px) scale(.97); }
        60%{ opacity:1; transform:translateY(-2px) scale(1.03); }
        100%{ opacity:1; transform:translateY(0) scale(1); }
      }

      .gjsb-btn.replay.pulse,
      .gjsb-btn.cooldown.pulse{
        animation:gjsbActionPulse 1.2s ease-in-out infinite;
        animation-delay:1.1s;
      }

      @keyframes gjsbActionPulse{
        0%,100%{
          transform:translateY(0) scale(1);
          box-shadow:0 12px 24px rgba(86,155,194,.14);
        }
        50%{
          transform:translateY(-1px) scale(1.03);
          box-shadow:0 16px 30px rgba(86,155,194,.20);
        }
      }

      .gjsb-stage.reduced-motion *{
        animation-duration:.01ms !important;
        animation-iteration-count:1 !important;
        transition-duration:.01ms !important;
        scroll-behavior:auto !important;
      }

      .gjsb-stage.reduced-motion .gjsb-dangerEdge.show,
      .gjsb-stage.reduced-motion .gjsb-rageAura.show,
      .gjsb-stage.reduced-motion .gjsb-stormLane.show,
      .gjsb-stage.reduced-motion .gjsb-praise.show,
      .gjsb-stage.reduced-motion .gjsb-patternBanner.show,
      .gjsb-stage.reduced-motion .gjsb-bossIntro.show,
      .gjsb-stage.reduced-motion .gjsb-victoryMoment.show,
      .gjsb-stage.reduced-motion .gjsb-victoryCard,
      .gjsb-stage.reduced-motion .gjsb-trailDot,
      .gjsb-stage.reduced-motion .gjsb-afterImage,
      .gjsb-stage.reduced-motion .gjsb-impact,
      .gjsb-stage.reduced-motion .gjsb-medal.shine,
      .gjsb-stage.reduced-motion .gjsb-medal.shine::after,
      .gjsb-stage.reduced-motion .gjsb-grade.pop,
      .gjsb-stage.reduced-motion .gjsb-star,
      .gjsb-stage.reduced-motion .gjsb-stat.reveal,
      .gjsb-stage.reduced-motion .gjsb-coach.reveal,
      .gjsb-stage.reduced-motion .gjsb-nextHint.reveal,
      .gjsb-stage.reduced-motion .gjsb-compareBox.reveal,
      .gjsb-stage.reduced-motion .gjsb-actions.celebrate .gjsb-btn,
      .gjsb-stage.reduced-motion .gjsb-btn.replay.pulse,
      .gjsb-stage.reduced-motion .gjsb-btn.cooldown.pulse,
      .gjsb-stage.reduced-motion .gjsb-confettiPiece{
        animation:none !important;
        opacity:1 !important;
        transform:none !important;
      }

      .gjsb-stage.reduced-motion .gjsb-flash.show{
        animation:none !important;
        opacity:.8;
      }

      @media (max-width:720px){
        .gjsb-topHud{
          gap:5px;
        }

        .gjsb-bar{
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:4px;
        }

        .gjsb-pill{
          min-height:28px;
          padding:4px 6px;
          font-size:10px;
        }

        .gjsb-banner{
          top:32px;
          width:min(78vw,300px);
          padding:6px 9px;
          font-size:10px;
        }

        .gjsb-telegraph{
          top:60px;
          width:min(80vw,312px);
          padding:6px 9px;
          font-size:10px;
        }

        .gjsb-utilRow{
          justify-content:stretch;
        }

        .gjsb-utilBtn{
          flex:1 1 0;
          min-height:34px;
          border-radius:10px;
          font-size:10px;
          padding:6px 8px;
        }

        .gjsb-boss{
          width:min(154px,42vw);
        }

        .gjsb-boss.dock-lower{
          right:8px !important;
          bottom:92px !important;
          width:min(154px,42vw);
        }

        .gjsb-boss-card{
          padding:7px 7px;
        }

        .gjsb-boss-head{
          grid-template-columns:34px 1fr;
          gap:6px;
        }

        .gjsb-boss-icon{
          width:34px;
          height:34px;
          font-size:19px;
          border-radius:12px;
        }

        .gjsb-boss-title{
          font-size:12px;
        }

        .gjsb-boss-sub{
          font-size:9px;
        }

        .gjsb-boss-stage,
        .gjsb-patternChip,
        .gjsb-rageBadge{
          font-size:9px;
          padding:5px 7px;
        }

        .gjsb-boss-bar{
          height:12px;
          margin-top:8px;
        }

        .gjsb-boss-hp{
          font-size:9px;
        }

        .gjsb-summary-grid,
        .gjsb-compareGrid{
          grid-template-columns:1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function buildUI() {
    mount.innerHTML = `
      <div id="${ROOT_ID}">
        <div class="gjsb-stage" id="gjsbStage">
          <div class="gjsb-cloud c1"></div>
          <div class="gjsb-cloud c2"></div>
          <div class="gjsb-cloud c3"></div>
          <div class="gjsb-ground"></div>

          <div class="gjsb-phasePulse" id="phasePulse"></div>
          <div class="gjsb-stormLane" id="stormLane"></div>
          <div class="gjsb-flash" id="hudFlash"></div>
          <div class="gjsb-dangerEdge" id="dangerEdge"></div>

          <div class="gjsb-topHud" id="topHud">
            <div class="gjsb-bar">
              <div class="gjsb-pill" id="hudScore">Score • 0</div>
              <div class="gjsb-pill" id="hudTime">Time • 0:00</div>
              <div class="gjsb-pill" id="hudMiss">Miss • 0</div>
              <div class="gjsb-pill" id="hudStreak">Streak • 0</div>
              <div class="gjsb-pill" id="hudPhase">Phase • 1</div>
            </div>

            <div class="gjsb-banner hide" id="hudBanner">เริ่มเลย! เก็บอาหารดี แล้วหลีกเลี่ยง junk</div>
            <div class="gjsb-praise" id="hudPraise">Nice Combo!</div>
            <div class="gjsb-telegraph" id="hudTelegraph">⚠️ Junk Storm กำลังมา</div>

            <div class="gjsb-progressWrap">
              <div class="gjsb-progressFill" id="hudProgress"></div>
            </div>

            <div class="gjsb-utilRow">
              <button class="gjsb-utilBtn" id="btnPause" type="button">⏸ Pause</button>
              <button class="gjsb-utilBtn" id="btnMute" type="button">🔊 Sound</button>
              <button class="gjsb-utilBtn" id="btnMotion" type="button">✨ Motion</button>
            </div>
          </div>

          <div class="gjsb-boss" id="bossWrap">
            <div class="gjsb-boss-card" id="bossCard">
              <div class="gjsb-boss-head">
                <div class="gjsb-boss-icon" id="bossIcon">🍔</div>
                <div>
                  <div class="gjsb-boss-title">Junk King</div>
                  <div class="gjsb-boss-sub" id="bossPatternText">อ่านจังหวะก่อน แล้วค่อยโจมตี</div>
                </div>
              </div>

              <div class="gjsb-boss-stage a" id="bossStageText">Stage A • Learn</div>
              <div class="gjsb-patternChip hunt" id="bossPatternChip">Target Hunt</div>
              <div class="gjsb-rageBadge" id="bossRageBadge">🔥 Rage Finale</div>

              <div class="gjsb-boss-bar">
                <div class="gjsb-boss-fill" id="bossHpFill"></div>
              </div>
              <div class="gjsb-boss-hp" id="bossHpText">HP 0 / 0</div>

              <div class="gjsb-rageAura" id="bossRageAura"></div>
            </div>
          </div>

          <div class="gjsb-presentation" id="presentationLayer">
            <div class="gjsb-bossIntro" id="bossIntroCard">
              <div class="gjsb-cardKicker">👑 BOSS ALERT</div>
              <div class="gjsb-cardIcon" id="bossIntroIcon">🍔</div>
              <div class="gjsb-cardTitle">Junk King</div>
              <div class="gjsb-cardSub" id="bossIntroSub">พร้อมแล้วหรือยัง? บอสกำลังจะลงสนาม!</div>
            </div>

            <div class="gjsb-patternBanner hunt" id="patternBanner">
              <div class="gjsb-cardKicker" id="patternBannerKicker">🎯 TARGET HUNT</div>
              <div class="gjsb-cardIcon" id="patternBannerIcon">🎯</div>
              <div class="gjsb-cardTitle" id="patternBannerTitle">Target Hunt</div>
              <div class="gjsb-cardSub" id="patternBannerSub">ตามเป้าทองให้ทัน</div>
            </div>
          </div>

          <div class="gjsb-victoryMoment" id="victoryMoment">
            <div class="gjsb-victoryCard">
              <div class="gjsb-victoryKicker">🏆 BOSS CLEAR</div>
              <div class="gjsb-victoryTitle">Junk King Down!</div>
              <div class="gjsb-victorySub">เธอผ่านทุก phase และปิดบอสได้สำเร็จ</div>
            </div>
          </div>

          <div class="gjsb-pause" id="pauseOverlay">
            <div class="gjsb-pauseCard">
              <div class="gjsb-pauseTitle">พักก่อนนะ</div>
              <div class="gjsb-pauseSub" id="pauseSub">เกมถูกหยุดไว้ชั่วคราว กดเล่นต่อได้เมื่อพร้อม</div>

              <div class="gjsb-pauseActions">
                <button class="gjsb-pauseBtn resume" id="btnResume" type="button">▶️ เล่นต่อ</button>
                <button class="gjsb-pauseBtn hub" id="btnPauseHub" type="button">🏠 กลับ HUB</button>
              </div>
            </div>
          </div>

          <div class="gjsb-summary" id="summary">
            <div class="gjsb-summary-card" id="summaryCard">
              <div class="gjsb-confetti" id="sumConfetti"></div>

              <div class="gjsb-summary-head">
                <div class="gjsb-summary-ribbon">GOODJUNK SOLO BOSS</div>
                <div class="gjsb-medal" id="sumMedal">🥈</div>
                <div class="gjsb-grade b" id="sumGrade">B</div>
                <h2 id="sumTitle" style="margin:8px 0 0;font-size:38px;line-height:1.05;color:#67a91c;">Great Job!</h2>
                <div id="sumSub" style="margin-top:6px;font-size:15px;color:#7b7a72;font-weight:1000;">มาดูผลการเล่นรอบนี้กัน</div>
                <div class="gjsb-stars" id="sumStars">⭐</div>
              </div>

              <div class="gjsb-summary-grid" id="sumGrid"></div>
              <div class="gjsb-coach" id="sumCoach">วันนี้ทำได้ดีมาก ลองเก็บอาหารดีต่อเนื่อง และระวัง junk ให้มากขึ้นนะ</div>
              <div class="gjsb-nextHint" id="sumNextHint">รอบหน้าลองเข้าไปให้ถึง Stage C และลด miss ลงอีกนิดนะ</div>
              <div class="gjsb-compareBox" id="sumCompareBox">ยังไม่มีข้อมูลเทียบรอบก่อน</div>
              <div class="gjsb-nextHint" id="sumExportBox">payload พร้อม export หลังจบเกม</div>

              <div class="gjsb-actions">
                <button class="gjsb-btn replay" id="btnReplay">🔁 เล่นใหม่</button>
                <button class="gjsb-btn cooldown" id="btnCooldown">🧊 ไป Cooldown</button>
                <button class="gjsb-btn hub" id="btnCopyJson">📋 คัดลอก JSON</button>
                <button class="gjsb-btn hub" id="btnHub">🏠 กลับ HUB</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    return {
      root: document.getElementById(ROOT_ID),
      stage: document.getElementById('gjsbStage'),
      topHud: document.getElementById('topHud'),
      score: document.getElementById('hudScore'),
      time: document.getElementById('hudTime'),
      miss: document.getElementById('hudMiss'),
      streak: document.getElementById('hudStreak'),
      phase: document.getElementById('hudPhase'),
      progress: document.getElementById('hudProgress'),
      banner: document.getElementById('hudBanner'),
      praise: document.getElementById('hudPraise'),
      telegraph: document.getElementById('hudTelegraph'),
      flash: document.getElementById('hudFlash'),
      dangerEdge: document.getElementById('dangerEdge'),
      phasePulse: document.getElementById('phasePulse'),
      stormLane: document.getElementById('stormLane'),

      btnPause: document.getElementById('btnPause'),
      btnMute: document.getElementById('btnMute'),
      btnMotion: document.getElementById('btnMotion'),

      bossWrap: document.getElementById('bossWrap'),
      bossCard: document.getElementById('bossCard'),
      bossIcon: document.getElementById('bossIcon'),
      bossPatternText: document.getElementById('bossPatternText'),
      bossStageText: document.getElementById('bossStageText'),
      bossPatternChip: document.getElementById('bossPatternChip'),
      bossRageBadge: document.getElementById('bossRageBadge'),
      bossHpText: document.getElementById('bossHpText'),
      bossHpFill: document.getElementById('bossHpFill'),
      bossRageAura: document.getElementById('bossRageAura'),

      bossIntroCard: document.getElementById('bossIntroCard'),
      bossIntroIcon: document.getElementById('bossIntroIcon'),
      bossIntroSub: document.getElementById('bossIntroSub'),
      patternBanner: document.getElementById('patternBanner'),
      patternBannerKicker: document.getElementById('patternBannerKicker'),
      patternBannerIcon: document.getElementById('patternBannerIcon'),
      patternBannerTitle: document.getElementById('patternBannerTitle'),
      patternBannerSub: document.getElementById('patternBannerSub'),

      victoryMoment: document.getElementById('victoryMoment'),

      pauseOverlay: document.getElementById('pauseOverlay'),
      pauseSub: document.getElementById('pauseSub'),
      btnResume: document.getElementById('btnResume'),
      btnPauseHub: document.getElementById('btnPauseHub'),

      summary: document.getElementById('summary'),
      summaryCard: document.getElementById('summaryCard'),
      sumConfetti: document.getElementById('sumConfetti'),
      sumMedal: document.getElementById('sumMedal'),
      sumGrade: document.getElementById('sumGrade'),
      sumTitle: document.getElementById('sumTitle'),
      sumSub: document.getElementById('sumSub'),
      sumStars: document.getElementById('sumStars'),
      sumGrid: document.getElementById('sumGrid'),
      sumCoach: document.getElementById('sumCoach'),
      sumNextHint: document.getElementById('sumNextHint'),
      sumCompareBox: document.getElementById('sumCompareBox'),
      sumExportBox: document.getElementById('sumExportBox'),
      btnReplay: document.getElementById('btnReplay'),
      btnCooldown: document.getElementById('btnCooldown'),
      btnCopyJson: document.getElementById('btnCopyJson'),
      btnHub: document.getElementById('btnHub')
    };
  }

  function clearStageTransientFx() {
    if (!ui || !ui.stage) return;

    [
      '.gjsb-fx',
      '.gjsb-scorePop',
      '.gjsb-trailDot',
      '.gjsb-afterImage',
      '.gjsb-impact'
    ].forEach((sel) => {
      ui.stage.querySelectorAll(sel).forEach((el) => {
        try { el.remove(); } catch (_) {}
      });
    });

    if (ui.stormLane) ui.stormLane.classList.remove('show', 'hc');
    if (ui.dangerEdge) ui.dangerEdge.classList.remove('show');
    if (ui.flash) ui.flash.classList.remove('show');
    if (ui.phasePulse) ui.phasePulse.classList.remove('show');
    if (ui.victoryMoment) ui.victoryMoment.classList.remove('show');
  }

  function resetSummaryDom() {
    if (!ui || !ui.summaryCard) return;

    ui.summary.classList.remove('show');
    ui.summaryCard.classList.remove(
      'celebrate',
      'replay-hot',
      'grade-s',
      'grade-a',
      'grade-b',
      'grade-c'
    );

    const head = ui.summaryCard.querySelector('.gjsb-summary-head');
    if (head) head.classList.remove('celebrate');

    if (ui.sumMedal) ui.sumMedal.classList.remove('shine');
    if (ui.sumGrade) ui.sumGrade.classList.remove('pop');
    if (ui.sumTitle) ui.sumTitle.classList.remove('pop');
    if (ui.sumSub) ui.sumSub.classList.remove('pop');

    if (ui.sumStars) {
      ui.sumStars.classList.remove('celebrate');
      ui.sumStars.textContent = '';
    }

    if (ui.sumGrid) {
      ui.sumGrid.querySelectorAll('.gjsb-stat').forEach((el) => {
        el.classList.remove('reveal');
        el.style.removeProperty('--delay');
      });
      ui.sumGrid.innerHTML = '';
    }

    if (ui.sumCoach) {
      ui.sumCoach.classList.remove('reveal');
      ui.sumCoach.style.removeProperty('--delay');
      ui.sumCoach.textContent = '';
    }

    if (ui.sumNextHint) {
      ui.sumNextHint.classList.remove('reveal', 'pretty');
      ui.sumNextHint.style.removeProperty('--delay');
      ui.sumNextHint.textContent = '';
    }

    if (ui.sumCompareBox) {
      ui.sumCompareBox.classList.remove('reveal');
      ui.sumCompareBox.style.removeProperty('--delay');
      ui.sumCompareBox.innerHTML = 'ยังไม่มีข้อมูลเทียบรอบก่อน';
    }

    if (ui.sumExportBox) {
      ui.sumExportBox.classList.remove('reveal', 'pretty');
      ui.sumExportBox.style.removeProperty('--delay');
      ui.sumExportBox.innerHTML = 'payload พร้อม export หลังจบเกม';
    }

    const actions = ui.summaryCard.querySelector('.gjsb-actions');
    if (actions) {
      actions.classList.remove('celebrate');
      actions.querySelectorAll('.gjsb-btn').forEach((btn) => {
        btn.style.removeProperty('--delay');
        btn.classList.remove('pulse');
      });
    }

    if (ui.sumConfetti) ui.sumConfetti.innerHTML = '';
  }

  function clearPresentationLayers() {
    if (!ui) return;

    if (ui.bossIntroCard) ui.bossIntroCard.classList.remove('show');
    if (ui.patternBanner) ui.patternBanner.classList.remove('show');
    if (ui.victoryMoment) ui.victoryMoment.classList.remove('show');
    if (ui.pauseOverlay) ui.pauseOverlay.classList.remove('show');

    const callout = document.getElementById('gjsbBossStageCallout');
    if (callout) {
      callout.style.opacity = '0';
      callout.style.transform = 'translate(-50%,-6px) scale(.98)';
    }
  }

  function hardResetBossTransientState() {
    state.boss.telegraphOn = false;
    state.boss.telegraphText = '';
    state.boss.telegraphMs = 0;
    state.boss.stormBurstLeft = 0;
    state.boss.stormBurstGapMs = 0;
    state.boss.stormWaveCooldown = 0;
    state.boss.weakRetargetAcc = 0;
    state.boss.weakRetargetMs = 0;
    state.boss.patternCycleIndex = -1;
    state.boss.fakeWeakActive = false;
    state.boss.fakeWeakDecoyId = '';
    state.boss.weakId = '';
    state.boss.lowHpTier = 0;
  }

  function beforeNavigationCleanup() {
    clearRuntimeTimers();
    clearStageTransientFx();
    clearPresentationLayers();

    if (ui && ui.pauseOverlay) ui.pauseOverlay.classList.remove('show');
    if (ui && ui.telegraph) ui.telegraph.classList.remove('show');
    if (ui && ui.banner) ui.banner.classList.add('hide');
    if (ui && ui.praise) ui.praise.classList.remove('show');
    if (ui && ui.summary) ui.summary.classList.remove('show');

    setRageAura(false);
    state.running = false;
  }

  function hardResetRunVisuals() {
    clearStageTransientFx();
    clearPresentationLayers();
    resetSummaryDom();

    state.paused = false;
    state.ended = false;
    state.boss.killSequence = false;
    state.boss.telegraphOn = false;
    state.lastTelegraphAt = 0;
    state.boss.lowHpTier = 0;

    hardResetBossTransientState();

    if (ui && ui.pauseOverlay) ui.pauseOverlay.classList.remove('show');
    if (ui && ui.telegraph) ui.telegraph.classList.remove('show');
    if (ui && ui.banner) ui.banner.classList.add('hide');
    if (ui && ui.praise) ui.praise.classList.remove('show');

    setRageAura(false);
  }

  function ensureDebugPanel() {
    if (!DEBUG || !ui || !ui.root) return;
    if (document.getElementById('gjsbDebugPanel')) return;

    const panel = document.createElement('div');
    panel.id = 'gjsbDebugPanel';
    panel.style.cssText = [
      'position:absolute',
      'left:8px',
      'bottom:8px',
      'z-index:90',
      'max-width:min(92vw,360px)',
      'padding:10px 12px',
      'border-radius:16px',
      'background:rgba(15,23,42,.88)',
      'color:#e5e7eb',
      'font:12px/1.45 system-ui,-apple-system,Segoe UI,sans-serif',
      'box-shadow:0 10px 28px rgba(0,0,0,.24)',
      'white-space:pre-wrap',
      'pointer-events:none'
    ].join(';');

    ui.root.appendChild(panel);
  }

  function updateDebugPanel() {
    if (!DEBUG) return;
    const panel = document.getElementById('gjsbDebugPanel');
    if (!panel) return;

    panel.textContent =
      'phase=' + state.phase +
      ' | boss=' + (state.boss.active ? state.boss.stage : '-') +
      ' | pattern=' + state.boss.pattern +
      '\nscore=' + state.score +
      ' miss=' + state.miss +
      ' streak=' + state.streak +
      '\ntime=' + Math.ceil(state.timeLeft / 1000) +
      ' | items=' + state.items.size +
      '\nhp=' + state.boss.hp + '/' + state.boss.maxHp +
      ' | rage=' + (state.boss.rage ? '1' : '0') +
      '\ntele=' + (state.boss.telegraphOn ? '1' : '0') +
      ' | timers=' + state.runtime.timers.size;
  }

  function wakeHud(ms) {
    state.hudAwakeMs = Math.max(state.hudAwakeMs || 0, ms || 1600);
  }

  function setMuted(next) {
    state.muted = !!next;
    if (ui && ui.btnMute) {
      ui.btnMute.textContent = state.muted ? '🔇 Mute' : '🔊 Sound';
      ui.btnMute.classList.toggle('active', !state.muted);
    }
  }

  function setReducedMotion(next) {
    state.a11y.reducedMotion = !!next;
    if (ui && ui.stage) ui.stage.classList.toggle('reduced-motion', !!next);

    if (ui && ui.btnMotion) {
      ui.btnMotion.textContent = state.a11y.reducedMotion ? '🪶 Low Motion' : '✨ Motion';
      ui.btnMotion.classList.toggle('active', !state.a11y.reducedMotion);
    }
  }

  function refreshUtilityButtons() {
    setMuted(state.muted);
    setReducedMotion(state.a11y.reducedMotion);
  }

  function pauseGame(reason) {
    if (state.ended || state.paused) return;

    state.paused = true;
    state.pauseReason = String(reason || 'pause');

    if (ui && ui.pauseSub) {
      ui.pauseSub.textContent =
        state.pauseReason === 'hidden'
          ? 'เกมหยุดอัตโนมัติเมื่อหน้าจอถูกสลับออก เพื่อไม่ให้พลาดระหว่างเล่น'
          : 'เกมถูกหยุดไว้ชั่วคราว กดเล่นต่อได้เมื่อพร้อม';
    }

    if (ui && ui.pauseOverlay) ui.pauseOverlay.classList.add('show');
  }

  function resumeGame() {
    if (state.ended || !state.paused) return;
    state.paused = false;
    state.pauseReason = '';
    if (ui && ui.pauseOverlay) ui.pauseOverlay.classList.remove('show');
    state.lastTs = performance.now();
  }

  function getBossReservePx() {
    if (!state.boss.active || !ui || !ui.bossWrap) return 0;
    const shown = ui.bossWrap.classList.contains('show');
    if (!shown) return 0;

    const rect = ui.bossWrap.getBoundingClientRect();
    const w = Math.ceil(rect.width || 0);
    if (!w) return window.innerWidth < 720 ? 150 : 190;
    return w + 12;
  }

  function getTopHudBottomPx() {
    if (!ui || !ui.topHud || !ui.stage) {
      return window.innerWidth < 720 ? 96 : 112;
    }

    const hudRect = ui.topHud.getBoundingClientRect();
    const stageRectPx = ui.stage.getBoundingClientRect();

    return Math.max(0, Math.ceil(hudRect.bottom - stageRectPx.top));
  }

  function isBossDockLower() {
    return !!state.boss.active;
  }

  function getBossDockBottomPx() {
    const r = stageRect();
    const groundBand = Math.round(r.height * 0.18);
    if (window.innerWidth < 720) {
      return Math.max(92, groundBand + 6);
    }
    return Math.max(108, groundBand + 8);
  }

  function layoutInnerHud() {
    if (!ui || !ui.topHud || !ui.bossWrap) return;

    const telegraphShown = ui.telegraph.classList.contains('show');
    const compact = window.innerWidth < 720 && (state.boss.active || telegraphShown);

    ui.topHud.classList.toggle('compact', compact);

    if (!state.boss.active) {
      ui.topHud.classList.remove('boss-mode');
      ui.topHud.style.setProperty('--boss-reserve', '0px');

      ui.bossWrap.classList.remove('dock-lower');
      ui.bossWrap.style.top = compact ? '50px' : '52px';
      ui.bossWrap.style.bottom = 'auto';
      ui.bossWrap.style.right = '8px';
      return;
    }

    if (isBossDockLower()) {
      ui.topHud.classList.add('boss-mode');
      ui.topHud.style.setProperty('--boss-reserve', '0px');

      ui.bossWrap.classList.add('dock-lower');
      ui.bossWrap.style.top = 'auto';
      ui.bossWrap.style.bottom = getBossDockBottomPx() + 'px';
      ui.bossWrap.style.right = window.innerWidth < 720 ? '8px' : '10px';
      return;
    }

    ui.topHud.classList.remove('boss-mode');
    ui.bossWrap.classList.remove('dock-lower');
    ui.topHud.style.setProperty('--boss-reserve', getBossReservePx() + 'px');

    const hudBottom = getTopHudBottomPx();
    const minTop = compact ? 50 : 52;
    const desiredTop = Math.max(minTop, hudBottom + 8);

    ui.bossWrap.style.top = desiredTop + 'px';
    ui.bossWrap.style.bottom = 'auto';
  }

  function fx(x, y, text, color) {
    const el = document.createElement('div');
    el.className = 'gjsb-fx';
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.color = color || '#333';
    ui.stage.appendChild(el);
    safeTimeout(() => { try { el.remove(); } catch (_) {} }, 760);
  }

  function scorePop(x, y, text, kind, sizePx) {
    const el = document.createElement('div');
    el.className = 'gjsb-scorePop ' + (kind || 'good');
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.fontSize = (sizePx || 28) + 'px';
    ui.stage.appendChild(el);

    requestAnimationFrame(() => el.classList.add('show'));
    safeTimeout(() => { try { el.remove(); } catch (_) {} }, 760);
  }

  function spawnTrailDot(x, y, kind, size) {
    if (state.a11y.reducedMotion) return;

    const el = document.createElement('div');
    el.className = 'gjsb-trailDot ' + (kind || 'weak');

    const s = size || (kind === 'fake' ? 20 : 18);
    el.style.width = s + 'px';
    el.style.height = s + 'px';
    el.style.left = x + 'px';
    el.style.top = y + 'px';

    ui.stage.appendChild(el);
    safeTimeout(() => { try { el.remove(); } catch (_) {} }, 360);
  }

  function spawnAfterImage(item) {
    if (state.a11y.reducedMotion) return;
    if (!item || !item.el) return;

    const el = document.createElement('div');
    el.className = 'gjsb-afterImage';
    el.style.left = item.x + 'px';
    el.style.top = item.y + 'px';
    el.style.width = item.size + 'px';
    el.style.height = item.size + 'px';
    el.innerHTML = '<div class="gjsb-emoji">❌</div>';

    ui.stage.appendChild(el);
    safeTimeout(() => { try { el.remove(); } catch (_) {} }, 300);
  }

  function spawnImpact(x, y, type, size) {
    const el = document.createElement('div');
    el.className = 'gjsb-impact ' + (type || 'hit');

    const s = size || 88;
    el.style.width = s + 'px';
    el.style.height = s + 'px';
    el.style.left = x + 'px';
    el.style.top = y + 'px';

    ui.stage.appendChild(el);
    safeTimeout(() => { try { el.remove(); } catch (_) {} }, 460);
  }

  function cueRingAt(x, y, kind, size) {
    if (state.a11y.reducedMotion) return;

    const el = document.createElement('div');
    el.className = 'gjsb-impact ' + (kind || 'hit');

    const s = size || 72;
    el.style.width = s + 'px';
    el.style.height = s + 'px';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.opacity = '.78';

    ui.stage.appendChild(el);
    safeTimeout(() => { try { el.remove(); } catch (_) {} }, 320);
  }

  function flashItemCue(item, tone) {
    if (!item || !item.el) return;

    item.el.style.transition = 'transform .12s ease, filter .12s ease, box-shadow .12s ease';
    item.el.style.filter =
      tone === 'danger'
        ? 'brightness(1.14) saturate(1.18)'
        : 'brightness(1.10) saturate(1.08)';
    item.el.style.boxShadow =
      tone === 'danger'
        ? '0 0 0 4px rgba(255,120,120,.22), 0 10px 22px rgba(86,155,194,.18)'
        : '0 0 0 4px rgba(255,224,138,.24), 0 10px 22px rgba(86,155,194,.18)';
    item.el.style.transform = 'translate(' + item.x + 'px,' + item.y + 'px) scale(1.08)';

    safeTimeout(() => {
      if (!item || item.dead || !item.el) return;
      item.el.style.filter = '';
      item.el.style.boxShadow = '';
      item.el.style.transform = 'translate(' + item.x + 'px,' + item.y + 'px) scale(1)';
    }, 120);
  }

  function queueWeakRetarget(item, cueLabel, delayMs) {
    if (!item || item.dead) return;
    if (item.retargetQueued) return;

    item.retargetQueued = true;

    const cx = item.x + item.size / 2;
    const cy = item.y + item.size / 2;

    flashItemCue(item, cueLabel === 'dash' ? 'danger' : 'hint');
    cueRingAt(cx, cy, cueLabel === 'dash' ? 'storm' : 'hit', Math.max(56, item.size * 1.02));

    if (cueLabel === 'dash') {
      fx(cx, cy - 10, 'DASH!', '#b3472d');
    } else if (cueLabel === 'lane') {
      fx(cx, cy - 10, 'SHIFT!', '#9d6016');
    }

    safeTimeout(() => {
      if (!item || item.dead) return;
      item.retargetQueued = false;
      retargetWeak(item);
    }, delayMs || 160);
  }

  function warnBeforeFakeCollapse(item) {
    if (!item || item.dead || !item.el) return;

    flashItemCue(item, 'danger');
    cueRingAt(
      item.x + item.size / 2,
      item.y + item.size / 2,
      'storm',
      Math.max(62, item.size * 1.08)
    );
    fx(item.x + item.size / 2, item.y - 4, 'FAKE!', '#b3472d');
  }

  function showStormTelegraphLane(x, size, ms) {
    const laneX = Math.max(0, x - 12);
    const laneW = Math.max(56, size + 24);
    setStormLane(laneX, laneW, ms || 720);
  }

  function phaseFlash() {
    ui.flash.classList.remove('show');
    void ui.flash.offsetWidth;
    ui.flash.classList.add('show');

    if (state.a11y.reducedMotion) {
      safeTimeout(() => ui.flash.classList.remove('show'), 120);
    }
  }

  function stageShake() {
    if (state.a11y.reducedMotion) return;
    ui.stage.classList.remove('shake');
    void ui.stage.offsetWidth;
    ui.stage.classList.add('shake');
    safeTimeout(() => ui.stage.classList.remove('shake'), 240);
  }

  function showDangerEdge(ms) {
    ui.dangerEdge.classList.add('show');

    if (showDangerEdge._t) {
      try { clearTimeout(showDangerEdge._t); } catch (_) {}
      state.runtime.timers.delete(showDangerEdge._t);
    }

    showDangerEdge._t = safeTimeout(() => {
      ui.dangerEdge.classList.remove('show');
    }, ms || 700);
  }

  function pulseBossHit() {
    if (!ui.bossCard) return;
    ui.bossCard.classList.remove('hurt');
    void ui.bossCard.offsetWidth;
    ui.bossCard.classList.add('hurt');
  }

  function pulsePhase() {
    if (!ui.phasePulse) return;
    ui.phasePulse.classList.remove('show');
    void ui.phasePulse.offsetWidth;
    ui.phasePulse.classList.add('show');
  }

  function setStormLane(x, width, ms) {
    if (!ui.stormLane) return;

    ui.stormLane.style.left = x + 'px';
    ui.stormLane.style.width = width + 'px';
    ui.stormLane.classList.toggle('hc', !!state.a11y.highContrastTelegraph);
    ui.stormLane.classList.add('show');

    if (setStormLane._t) {
      try { clearTimeout(setStormLane._t); } catch (_) {}
      state.runtime.timers.delete(setStormLane._t);
    }

    setStormLane._t = safeTimeout(() => {
      ui.stormLane.classList.remove('show');
    }, ms || 700);
  }

  function setRageAura(on) {
    if (!ui.bossRageAura) return;
    ui.bossRageAura.classList.toggle('show', !!on);
  }

  function lockPresentation(ms) {
    state.presentationLockMs = Math.max(state.presentationLockMs || 0, ms || 700);
  }

  function setBanner(text, autoHide) {
    wakeHud(autoHide ? Math.max(1100, autoHide) : 1400);

    ui.banner.textContent = text;
    ui.banner.classList.remove('hide');
    layoutInnerHud();

    if (setBanner._t) {
      try { clearTimeout(setBanner._t); } catch (_) {}
      state.runtime.timers.delete(setBanner._t);
    }

    if (autoHide) {
      setBanner._t = safeTimeout(() => {
        ui.banner.classList.add('hide');
        layoutInnerHud();
      }, autoHide);
    }
  }

  function showTelegraph(text, ms) {
    wakeHud((ms || 800) + 600);
    ui.telegraph.textContent = text;
    ui.telegraph.classList.toggle('hc', !!state.a11y.highContrastTelegraph);
    ui.telegraph.classList.add('show');
    playSfx('telegraph');
    layoutInnerHud();

    if (showTelegraph._t) {
      try { clearTimeout(showTelegraph._t); } catch (_) {}
      state.runtime.timers.delete(showTelegraph._t);
    }

    showTelegraph._t = safeTimeout(() => {
      ui.telegraph.classList.remove('show');
      layoutInnerHud();
    }, ms || 800);
  }

  function streakPraiseText(streak) {
    if (streak >= 12) return '🌟 Super Hero!';
    if (streak >= 8) return '🔥 Awesome Combo!';
    if (streak >= 5) return '✨ Great Combo!';
    if (streak >= 3) return '👍 Nice Combo!';
    return '';
  }

  function showPraise(text, ms) {
    if (!text) return;
    wakeHud((ms || 760) + 240);

    ui.praise.textContent = text;
    ui.praise.classList.remove('show');
    void ui.praise.offsetWidth;
    ui.praise.classList.add('show');

    state.praiseMs = Math.max(state.praiseMs || 0, ms || 760);

    if (showPraise._t) {
      try { clearTimeout(showPraise._t); } catch (_) {}
      state.runtime.timers.delete(showPraise._t);
    }

    showPraise._t = safeTimeout(() => {
      ui.praise.classList.remove('show');
    }, ms || 760);
  }

  function maybePraiseStreak() {
    const text = streakPraiseText(state.streak);
    if (!text) return;
    if ([3, 5, 8, 12].includes(state.streak)) {
      showPraise(text, state.streak >= 8 ? 920 : 760);
    }
  }

  function showBossIntroCard() {
    if (!ui.bossIntroCard || state.ended) return;

    state.boss.introShowing = true;
    lockPresentation(980);

    ui.bossIntroIcon.textContent = state.boss.rage ? '👹' : '🍔';
    ui.bossIntroSub.textContent = state.boss.rage
      ? 'ระวัง! บอสกำลังเข้าสู่ Rage Finale'
      : 'พร้อมแล้วหรือยัง? บอสกำลังจะลงสนาม!';

    ui.bossIntroCard.classList.remove('show');
    void ui.bossIntroCard.offsetWidth;
    ui.bossIntroCard.classList.add('show');

    safeTimeout(() => {
      state.boss.introShowing = false;
      ui.bossIntroCard.classList.remove('show');
    }, 760);
  }

  function showPatternBanner(pattern) {
    if (!ui.patternBanner || state.ended) return;

    const title = getPatternLabel(pattern);
    const sub = getPatternSubtitle(pattern);
    const icon = pattern === 'break' ? '💥' : pattern === 'storm' ? '🌪️' : '🎯';
    const kicker =
      pattern === 'break' ? '🛡️ ARMOR BREAK' :
      pattern === 'storm' ? '⚠️ JUNK STORM' :
      '🎯 TARGET HUNT';

    ui.patternBanner.className = 'gjsb-patternBanner ' + pattern;
    ui.patternBannerKicker.textContent = kicker;
    ui.patternBannerIcon.textContent = icon;
    ui.patternBannerTitle.textContent = title;
    ui.patternBannerSub.textContent = sub;

    ui.patternBanner.classList.remove('show');
    void ui.patternBanner.offsetWidth;
    ui.patternBanner.classList.add('show');

    lockPresentation(pattern === 'storm' ? 720 : 620);

    safeTimeout(() => {
      ui.patternBanner.classList.remove('show');
    }, 760);
  }

  function bossThemeForStage(stageKey) {
    if (stageKey === 'RAGE' || state.boss.rage) {
      return {
        cardBg: 'linear-gradient(180deg,#fff4f2,#ffe8e2)',
        cardBorder: '#ffb0a2',
        cardShadow: '0 14px 30px rgba(255,140,110,.24)',
        iconBg: 'linear-gradient(180deg,#ffe3da,#fff6f2)',
        iconBorder: '#ffc2b8',
        stageBg: '#fff0f0',
        stageBorder: '#ffc6c6',
        stageColor: '#b3472d',
        chipBg: '#fff7f0',
        chipBorder: '#ffd8c8',
        chipColor: '#b3472d',
        accent: '#ff8f6b'
      };
    }

    if (stageKey === 'A') {
      return {
        cardBg: 'linear-gradient(180deg,#fffdf4,#fff7da)',
        cardBorder: '#ffd45c',
        cardShadow: '0 12px 24px rgba(255,212,92,.22)',
        iconBg: 'linear-gradient(180deg,#fff1be,#fffdf4)',
        iconBorder: '#ffe08a',
        stageBg: '#fff8dd',
        stageBorder: '#f3df97',
        stageColor: '#8a6b00',
        chipBg: '#fffdf2',
        chipBorder: '#f3df97',
        chipColor: '#8a6b00',
        accent: '#ffd45c'
      };
    }

    if (stageKey === 'B') {
      return {
        cardBg: 'linear-gradient(180deg,#fff9ef,#fff0d8)',
        cardBorder: '#ffcb8a',
        cardShadow: '0 12px 24px rgba(255,181,71,.20)',
        iconBg: 'linear-gradient(180deg,#ffe8c9,#fff9ef)',
        iconBorder: '#ffd19b',
        stageBg: '#fff1da',
        stageBorder: '#ffd19b',
        stageColor: '#a35b12',
        chipBg: '#fff8f0',
        chipBorder: '#ffd8ae',
        chipColor: '#a35b12',
        accent: '#ffb547'
      };
    }

    return {
      cardBg: 'linear-gradient(180deg,#fff4f4,#ffe6e1)',
      cardBorder: '#ffb5a7',
      cardShadow: '0 12px 24px rgba(255,143,120,.20)',
      iconBg: 'linear-gradient(180deg,#ffe0d8,#fff5f2)',
      iconBorder: '#ffc2b8',
      stageBg: '#ffe9e5',
      stageBorder: '#ffc6c6',
      stageColor: '#b3472d',
      chipBg: '#fff6f4',
      chipBorder: '#ffd0c6',
      chipColor: '#b3472d',
      accent: '#ff9b7c'
    };
  }

  function applyBossStageVisuals(stageKey) {
    if (!ui || !ui.bossCard) return;

    const key = stageKey || (state.boss.rage ? 'RAGE' : state.boss.stage);
    const theme = bossThemeForStage(key);

    ui.bossCard.style.background = theme.cardBg;
    ui.bossCard.style.borderColor = theme.cardBorder;
    ui.bossCard.style.boxShadow = theme.cardShadow;

    ui.bossIcon.style.background = theme.iconBg;
    ui.bossIcon.style.borderColor = theme.iconBorder;

    ui.bossStageText.style.background = theme.stageBg;
    ui.bossStageText.style.borderColor = theme.stageBorder;
    ui.bossStageText.style.color = theme.stageColor;

    ui.bossPatternChip.style.background = theme.chipBg;
    ui.bossPatternChip.style.borderColor = theme.chipBorder;
    ui.bossPatternChip.style.color = theme.chipColor;
  }

  function showBossStageCallout(title, sub, accent) {
    if (!ui || !ui.stage) return;

    let el = document.getElementById('gjsbBossStageCallout');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gjsbBossStageCallout';
      el.style.cssText = [
        'position:absolute',
        'left:50%',
        'top:118px',
        'transform:translate(-50%,-8px) scale(.94)',
        'z-index:44',
        'min-width:min(88vw,420px)',
        'max-width:min(90vw,520px)',
        'padding:12px 16px',
        'border-radius:20px',
        'background:linear-gradient(180deg,#fffef8,#ffffff)',
        'border:3px solid #ffd89b',
        'box-shadow:0 16px 32px rgba(86,155,194,.18)',
        'text-align:center',
        'opacity:0',
        'pointer-events:none',
        'transition:opacity .18s ease, transform .18s ease'
      ].join(';');
      ui.stage.appendChild(el);
    }

    el.innerHTML = `
      <div style="font-size:12px;font-weight:1100;color:#7b7a72;letter-spacing:.08em;">BOSS STAGE SHIFT</div>
      <div style="margin-top:4px;font-size:26px;line-height:1.05;font-weight:1100;color:${accent || '#c57b00'};">${title}</div>
      <div style="margin-top:6px;font-size:13px;line-height:1.55;font-weight:1000;color:#6b675f;">${sub}</div>
    `;

    el.style.borderColor = accent || '#ffd89b';
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%,-8px) scale(.94)';

    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%,0) scale(1)';
    });

    lockPresentation(760);

    if (showBossStageCallout._t) {
      try { clearTimeout(showBossStageCallout._t); } catch (_) {}
      state.runtime.timers.delete(showBossStageCallout._t);
    }

    showBossStageCallout._t = safeTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%,-6px) scale(.98)';
    }, 900);
  }

  function showVictoryMoment() {
    if (!ui.victoryMoment) return;

    const card = ui.victoryMoment.querySelector('.gjsb-victoryCard');
    const title = ui.victoryMoment.querySelector('.gjsb-victoryTitle');
    const sub = ui.victoryMoment.querySelector('.gjsb-victorySub');
    const kicker = ui.victoryMoment.querySelector('.gjsb-victoryKicker');

    if (card) {
      card.style.borderColor = state.boss.rageTriggered ? '#ffb0a2' : '#ffe08a';
      card.style.background = state.boss.rageTriggered
        ? 'linear-gradient(180deg,#fff8f4,#ffe9e2)'
        : 'linear-gradient(180deg,#fffef5,#fff9df)';
    }

    if (kicker) {
      kicker.textContent = state.boss.rageTriggered ? '🔥 RAGE CLEAR' : '🏆 BOSS CLEAR';
    }

    if (title) {
      title.textContent = state.boss.rageTriggered ? 'Rage Broken!' : 'Junk King Down!';
      title.style.color = state.boss.rageTriggered ? '#d46a42' : '#c57b00';
    }

    if (sub) {
      sub.textContent = state.boss.rageTriggered
        ? 'เธอผ่าน Rage Finale และปิดบอสได้สุดยอดมาก'
        : 'เธอผ่านทุก phase และปิดบอสได้สำเร็จ';
    }

    ui.victoryMoment.classList.remove('show');
    void ui.victoryMoment.offsetWidth;
    ui.victoryMoment.classList.add('show');

    phaseFlash();
    spawnVictoryBurst();

    safeTimeout(() => {
      if (ui.victoryMoment) ui.victoryMoment.classList.remove('show');
    }, 900);
  }

  function spawnVictoryBurst() {
    if (!ui || !ui.stage) return;

    const r = stageRect();
    const cx = r.width * 0.5;
    const cy = r.height * 0.38;

    for (let i = 0; i < 8; i++) {
      safeTimeout(() => {
        const a = (Math.PI * 2 * i) / 8;
        const dist = 42 + i * 6;
        const x = cx + Math.cos(a) * dist;
        const y = cy + Math.sin(a) * dist * 0.75;

        spawnImpact(x, y, 'hit', 92 + i * 6);
        scorePop(x, y, i % 2 === 0 ? 'WOW!' : 'CLEAR!', 'power', 24);
      }, i * 45);
    }
  }

  function maybeBossLowHpJuice() {
    if (!state.boss.active || state.ended) return;

    const ratio = state.boss.maxHp > 0 ? state.boss.hp / state.boss.maxHp : 1;
    let tier = 0;

    if (ratio <= 0.10) tier = 2;
    else if (ratio <= 0.25) tier = 1;

    const lastTier = Number(state.boss.lowHpTier || 0);
    if (tier <= lastTier) return;

    state.boss.lowHpTier = tier;

    if (tier === 1) {
      setBanner('⚠️ Junk King ใกล้พังแล้ว!', 900);
      showDangerEdge(820);
      phaseFlash();
      playSfx('telegraph');
      showPraise('🔥 Boss HP ต่ำแล้ว!', 760);
    } else if (tier === 2) {
      setBanner('💥 Final Hit! ปิดบอสได้เลย!', 1100);
      showDangerEdge(1100);
      phaseFlash();
      stageShake();
      playSfx('boss-break');
      showPraise('⚡ ONE MORE HIT!', 900);
    }
  }

  function showLastHitFinish(x, y, damage, stageKey) {
    phaseFlash();
    stageShake();
    showDangerEdge(920);

    cueRingAt(x, y, 'hit', 150);
    spawnImpact(x, y, 'hit', 168);
    scorePop(x, y, damage >= 3 ? 'FINISH!' : 'LAST HIT!', 'power', damage >= 3 ? 46 : 40);

    safeTimeout(() => {
      cueRingAt(x + 18, y - 10, 'hit', 128);
      spawnImpact(x + 18, y - 10, 'hit', 132);
    }, 60);

    safeTimeout(() => {
      cueRingAt(x - 22, y + 8, 'storm', 116);
      spawnImpact(x - 22, y + 8, 'hit', 120);
    }, 110);

    if (stageKey === 'RAGE') {
      fx(x, y - 24, 'RAGE BREAK!', '#d46a42');
    } else if (damage >= 3) {
      fx(x, y - 24, 'CRITICAL FINISH!', '#c57b00');
    } else {
      fx(x, y - 24, 'BOSS DOWN!', '#c57b00');
    }
  }

  function itemLooksStuck(item) {
    if (!item || item.dead) return false;

    const cx = item.x + item.size / 2;
    const cy = item.y + item.size / 2;

    if (!item._stuckProbe) {
      item._stuckProbe = { x: cx, y: cy, t: nowMs() };
      return false;
    }

    const age = nowMs() - item._stuckProbe.t;
    if (age < 220) return false;

    const dist = Math.hypot(cx - item._stuckProbe.x, cy - item._stuckProbe.y);
    item._stuckProbe = { x: cx, y: cy, t: nowMs() };

    return dist < 3.5;
  }

  function rescueWeakTarget(item, reason) {
    if (!item || item.dead) return;

    const bias =
      state.boss.pattern === 'break' ? 'center' :
      state.boss.stage === 'A' ? 'right-mid' :
      state.boss.stage === 'B' ? 'center' :
      'center';

    const pos = randomBossSpawn(item.size, bias);

    item.x = pos.x;
    item.y = pos.y;
    item.vx = (rand() < 0.5 ? -1 : 1) * range(80, 160);
    item.vy = 0;
    item.retargetQueued = false;
    item._stuckFrames = 0;
    item._edgeTrapFrames = 0;
    item._stuckProbe = { x: item.x + item.size / 2, y: item.y + item.size / 2, t: nowMs() };

    retargetWeak(item);
    drawItem(item);

    cueRingAt(item.x + item.size / 2, item.y + item.size / 2, 'hit', Math.max(64, item.size * 1.04));

    if (DEBUG) {
      fx(item.x + item.size / 2, item.y - 8, 'RESCUE', '#2d6f8b');
      console.log('[GJSB] weak rescue:', reason || 'unknown');
    }
  }

  function clampItemIntoBossRect(item) {
    if (!item || item.dead) return;

    const box = getBossPlayRect(item.size);

    item.x = clamp(item.x, box.left, box.right);
    item.y = clamp(item.y, box.top, box.bottom);

    if (box.bossBlock) {
      const b = box.bossBlock;
      const overlaps =
        item.x + item.size > b.left &&
        item.x < b.right &&
        item.y + item.size > b.top &&
        item.y < b.bottom;

      if (overlaps) {
        item.x = Math.min(item.x, b.left - item.size - 4);
        item.y = Math.max(box.top, Math.min(item.y, box.bottom));
      }
    }

    drawItem(item);
  }

  function normalizeAllActiveItemsAfterResize() {
    state.items.forEach((item) => {
      if (!item || item.dead) return;

      if (item.kind === 'weak' || item.kind === 'fakeweak') {
        clampItemIntoBossRect(item);

        const box = getBossPlayRect(item.size);
        const escapeLeft = Math.max(110, box.left + 30);
        const escapeTop = Math.max(140, box.top + 18);

        if (item.x < escapeLeft && item.y < escapeTop) {
          rescueWeakTarget(item, 'resize-top-left');
        }
      } else {
        const r = stageRect();
        item.x = clamp(item.x, 8, Math.max(8, r.width - item.size - 8));
        item.y = clamp(item.y, -item.size - 20, Math.max(12, r.height - item.size - 12));
        drawItem(item);
      }
    });
  }

  function drawItem(item) {
    item.el.style.transform = 'translate(' + item.x + 'px,' + item.y + 'px)';
  }

  function createItem(kind, emoji, x, y, size, vx, vy, label) {
    const id = 'it-' + (++state.seq);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'gjsb-item ' + kind;
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.innerHTML =
      '<div class="gjsb-emoji">' + emoji + '</div>' +
      '<div class="gjsb-tag">' + (label || kind) + '</div>';

    ui.stage.appendChild(el);

    const item = {
      id, kind, emoji, x, y, size, vx, vy, el, dead: false,
      targetLaneIndex: 1,
      targetLaneY: y,
      moveMode: '',
      baseVX: vx,
      zigAmp: 0,
      zigFreq: 0,
      zigT: 0,
      dashLeft: 0,
      retargetQueued: false,
      _stuckFrames: 0,
      _edgeTrapFrames: 0,
      _stuckProbe: null
    };

    el.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      onHit(item);
    }, { passive: false });

    state.items.set(id, item);
    drawItem(item);
    return item;
  }

  function removeItem(item) {
    if (!item || item.dead) return;
    item.dead = true;
    try { item.el.remove(); } catch (_) {}
    state.items.delete(item.id);

    if (state.boss.weakId === item.id) state.boss.weakId = '';
    if (state.boss.fakeWeakDecoyId === item.id) {
      state.boss.fakeWeakDecoyId = '';
      state.boss.fakeWeakActive = false;
    }
  }

  function clearItems() {
    state.items.forEach(removeItem);
    state.items.clear();
    state.boss.weakId = '';
    state.boss.fakeWeakDecoyId = '';
    state.boss.fakeWeakActive = false;
  }

  function spawnFood(phase) {
    const r = stageRect();
    const phase2 = phase === 2;
    const goodRatio = phase2 ? 0.58 : 0.7;
    const isGood = rand() < goodRatio;
    const size = phase2 ? range(52, 78) : range(58, 86);
    const x = range(10, Math.max(12, r.width - size - 10));
    const y = -size - range(0, 30);
    const vx = range(-40, 40);
    const vy = phase2 ? range(160, 260) : range(110, 180);

    createItem(
      isGood ? 'good' : 'junk',
      isGood ? GOOD[Math.floor(rand() * GOOD.length)] : JUNK[Math.floor(rand() * JUNK.length)],
      x, y, size, vx, vy,
      isGood ? 'good' : 'junk'
    );
  }

  function getBossPlayRect(itemSize = 72) {
    const r = stageRect();

    const hudRect = ui.topHud ? ui.topHud.getBoundingClientRect() : null;
    const bossRect = (state.boss.active && ui.bossWrap && ui.bossWrap.classList.contains('show'))
      ? ui.bossWrap.getBoundingClientRect()
      : null;

    const hudBottom = hudRect
      ? Math.ceil(hudRect.bottom - r.top)
      : (window.innerWidth < 720 ? 118 : 146);

    const top = clamp(
      hudBottom + 16,
      window.innerWidth < 720 ? 112 : 140,
      Math.max(window.innerWidth < 720 ? 160 : 200, r.height * 0.42)
    );

    const left = 20;
    const right = Math.max(left + 120, r.width - itemSize - 20);
    const bottom = Math.max(top + 120, r.height - itemSize - 56);

    let bossBlock = null;
    if (bossRect) {
      const padX = 14;
      const padY = 12;
      bossBlock = {
        left: Math.max(0, Math.floor(bossRect.left - r.left - padX)),
        right: Math.min(r.width, Math.ceil(bossRect.right - r.left + padX)),
        top: Math.max(0, Math.floor(bossRect.top - r.top - padY)),
        bottom: Math.min(r.height, Math.ceil(bossRect.bottom - r.top + padY))
      };
    }

    return {
      left,
      top,
      right,
      bottom,
      width: r.width,
      height: r.height,
      bossBlock
    };
  }

  function rectOverlap(a, b) {
    return !(
      a.right <= b.left ||
      a.left >= b.right ||
      a.bottom <= b.top ||
      a.top >= b.bottom
    );
  }

  function getBossForbiddenZones(itemSize = 72) {
    const r = stageRect();
    const zones = [];

    const hudRect = ui.topHud ? ui.topHud.getBoundingClientRect() : null;
    const bossRect = (state.boss.active && ui.bossWrap && ui.bossWrap.classList.contains('show'))
      ? ui.bossWrap.getBoundingClientRect()
      : null;

    if (hudRect) {
      const topHudBottom = Math.ceil(hudRect.bottom - r.top);
      zones.push({
        left: 0,
        top: 0,
        right: r.width,
        bottom: Math.max(0, topHudBottom + 14)
      });
    }

    if (bossRect) {
      zones.push({
        left: Math.max(0, Math.floor(bossRect.left - r.left - 14)),
        top: Math.max(0, Math.floor(bossRect.top - r.top - 12)),
        right: Math.min(r.width, Math.ceil(bossRect.right - r.left + 14)),
        bottom: Math.min(r.height, Math.ceil(bossRect.bottom - r.top + 12))
      });
    }

    zones.push({
      left: 0,
      top: 0,
      right: Math.max(120, Math.round(r.width * 0.24)),
      bottom: Math.max(150, Math.round(r.height * 0.22))
    });

    return zones;
  }

  function isPointBlocked(x, y, itemSize, zones) {
    const box = {
      left: x,
      top: y,
      right: x + itemSize,
      bottom: y + itemSize
    };
    return zones.some((z) => rectOverlap(box, z));
  }

  function pickBossSpawnPoint(itemSize = 72, bias = 'mid') {
    const box = getBossPlayRect(itemSize);
    const zones = getBossForbiddenZones(itemSize);

    const left = box.left + 10;
    const right = Math.max(left + 20, box.right - 10);
    const top = box.top + 12;
    const bottom = Math.max(top + 20, box.bottom - 10);

    const width = Math.max(40, right - left);
    const height = Math.max(40, bottom - top);

    const candidates = [];

    for (let i = 0; i < 36; i++) {
      let x;
      let y;

      if (bias === 'right-mid') {
        x = left + width * range(0.52, 0.88);
        y = top + height * range(0.22, 0.72);
      } else if (bias === 'center') {
        x = left + width * range(0.28, 0.72);
        y = top + height * range(0.24, 0.74);
      } else if (bias === 'left-mid') {
        x = left + width * range(0.18, 0.48);
        y = top + height * range(0.22, 0.72);
      } else {
        x = left + width * range(0.22, 0.82);
        y = top + height * range(0.22, 0.76);
      }

      x = Math.round(clamp(x, left, right));
      y = Math.round(clamp(y, top, bottom));

      if (!isPointBlocked(x, y, itemSize, zones)) {
        candidates.push({ x, y });
      }
    }

    if (candidates.length) {
      return candidates[Math.floor(rand() * candidates.length)];
    }

    return {
      x: Math.round(left + width * 0.56),
      y: Math.round(top + height * 0.44)
    };
  }

  function getBossLaneCenters(itemSize = 72) {
    const box = getBossPlayRect(itemSize);

    const usableTop = box.top + 18;
    const usableBottom = box.bottom - 18;
    const span = Math.max(140, usableBottom - usableTop);

    return [
      Math.round(usableTop + span * 0.18),
      Math.round(usableTop + span * 0.48),
      Math.round(usableTop + span * 0.78)
    ];
  }

  function nearestBossLaneIndex(y, itemSize = 72) {
    const lanes = getBossLaneCenters(itemSize);
    let best = 0;
    let bestDist = Infinity;

    for (let i = 0; i < lanes.length; i++) {
      const d = Math.abs(lanes[i] - (y + itemSize / 2));
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  function pickLaneIndexForStage(stage, avoidIndex) {
    let order;

    if (stage === 'A') {
      order = [0, 1, 2];
    } else if (stage === 'B') {
      order = [0, 2, 1];
    } else {
      order = [1, 0, 2];
    }

    let lane = order[Math.floor(rand() * order.length)];
    if (lane === avoidIndex) {
      lane = order[(order.indexOf(lane) + 1) % order.length];
    }
    return lane;
  }

  function randomBossSpawnInLane(itemSize = 72, laneIndex = 1, sideBias = 'center') {
    const box = getBossPlayRect(itemSize);
    const zones = getBossForbiddenZones(itemSize);

    const lanes = getBossLaneCenters(itemSize);
    const laneY = clamp(
      lanes[laneIndex] - itemSize / 2,
      box.top + 8,
      box.bottom - 8
    );

    let minX = box.left + 12;
    let maxX = box.right - 12;

    if (sideBias === 'left') {
      maxX = box.left + (box.right - box.left) * 0.46;
    } else if (sideBias === 'right') {
      minX = box.left + (box.right - box.left) * 0.52;
    } else {
      minX = box.left + (box.right - box.left) * 0.22;
      maxX = box.left + (box.right - box.left) * 0.78;
    }

    for (let i = 0; i < 28; i++) {
      const x = Math.round(range(minX, maxX));
      const y = Math.round(clamp(laneY + range(-16, 16), box.top + 8, box.bottom - 8));

      if (!isPointBlocked(x, y, itemSize, zones)) {
        return { x, y };
      }
    }

    return {
      x: Math.round((minX + maxX) / 2),
      y: Math.round(laneY)
    };
  }

  function randomBossSpawn(itemSize, bias) {
    return pickBossSpawnPoint(itemSize, bias || 'mid');
  }

  function getBossStageByHp() {
    const ratio = state.boss.maxHp > 0 ? (state.boss.hp / state.boss.maxHp) : 1;
    if (ratio > 0.66) return 'A';
    if (ratio > 0.33) return 'B';
    return 'C';
  }

  function getBossStageProfile(stageLetter) {
    if (stageLetter === 'A') {
      return {
        stage: 'A',
        label: 'Stage A • Learn',
        stageClass: 'a',
        icon: '🍔',
        weakSizeHunt: diffKey === 'hard' ? 82 : 92,
        weakSizeBreak: diffKey === 'hard' ? 96 : 108,
        weakSpeedHunt: diffKey === 'hard' ? 190 : 160,
        weakSpeedBreak: diffKey === 'hard' ? 145 : 120,
        huntRetargetMs: 1300,
        breakRetargetMs: 1450,
        stormWaveEvery: 2350,
        stormBurstCount: 1,
        stormBurstGap: 150,
        patternDuration: 3600,
        telegraphMs: 920,
        stormMode: 'single',
        huntMode: 'steady'
      };
    }

    if (stageLetter === 'B') {
      return {
        stage: 'B',
        label: 'Stage B • Pressure',
        stageClass: 'b',
        icon: '😤',
        weakSizeHunt: diffKey === 'hard' ? 72 : 80,
        weakSizeBreak: diffKey === 'hard' ? 88 : 96,
        weakSpeedHunt: diffKey === 'hard' ? 255 : 215,
        weakSpeedBreak: diffKey === 'hard' ? 180 : 150,
        huntRetargetMs: 980,
        breakRetargetMs: 1120,
        stormWaveEvery: 1700,
        stormBurstCount: 2,
        stormBurstGap: 120,
        patternDuration: 3200,
        telegraphMs: 820,
        stormMode: 'cross',
        huntMode: 'pressure'
      };
    }

    const rage = !!state.boss.rage;

    return {
      stage: 'C',
      label: rage ? 'Stage C • Rage Finale' : 'Stage C • Final',
      stageClass: 'c',
      icon: rage ? '👹' : '😈',
      weakSizeHunt: rage ? (diffKey === 'hard' ? 52 : 60) : (diffKey === 'hard' ? 60 : 68),
      weakSizeBreak: rage ? (diffKey === 'hard' ? 70 : 76) : (diffKey === 'hard' ? 78 : 84),
      weakSpeedHunt: rage ? (diffKey === 'hard' ? 360 : 315) : (diffKey === 'hard' ? 320 : 280),
      weakSpeedBreak: rage ? (diffKey === 'hard' ? 250 : 215) : (diffKey === 'hard' ? 220 : 185),
      huntRetargetMs: rage ? 520 : 720,
      breakRetargetMs: rage ? 680 : 860,
      stormWaveEvery: rage ? 780 : 1120,
      stormBurstCount: rage ? 4 : 3,
      stormBurstGap: rage ? 85 : 105,
      patternDuration: rage ? 1800 : 2600,
      telegraphMs: rage ? 620 : 740,
      stormMode: rage ? 'rage-rain' : 'fan',
      huntMode: rage ? 'trickster' : 'aggressive'
    };
  }

  function getPatternCycle(stageLetter) {
    if (stageLetter === 'A') return ['hunt', 'storm'];
    if (stageLetter === 'B') return ['hunt', 'break', 'storm'];
    return ['storm', 'hunt', 'break'];
  }

  function getPatternLabel(pattern) {
    if (pattern === 'break') return 'Armor Break';
    if (pattern === 'storm') return 'Junk Storm Rage';
    return 'Target Hunt';
  }

  function getPatternSubtitle(pattern) {
    const p = getBossStageProfile(state.boss.stage);

    if (pattern === 'break') {
      return p.stage === 'A'
        ? 'เป้าใหญ่ ตีเข้าแรงขึ้น'
        : p.stage === 'B'
          ? 'เกราะเปิดแล้ว ตีให้คุ้ม'
          : 'โอกาสแรงแต่สั้น รีบโจมตี';
    }

    if (pattern === 'storm') {
      return 'พายุลงเป็นชุด x' + p.stormBurstCount;
    }

    return p.stage === 'A'
      ? 'เป้าใหญ่ ช้ากว่า ให้เรียนรู้'
      : p.stage === 'B'
        ? 'เป้าเร็วขึ้น ต้องแม่นขึ้น'
        : 'เป้าเล็กและเร็วสุดแล้ว';
  }

  function clearWeakOnly() {
    if (state.boss.weakId) {
      const weak = state.items.get(state.boss.weakId);
      if (weak) removeItem(weak);
      state.boss.weakId = '';
    }
  }

  function clearFakeWeakOnly() {
    if (state.boss.fakeWeakDecoyId) {
      const fake = state.items.get(state.boss.fakeWeakDecoyId);
      if (fake) removeItem(fake);
      state.boss.fakeWeakDecoyId = '';
    }
    state.boss.fakeWeakActive = false;
  }

  function clearPatternTargets() {
    clearWeakOnly();
    clearFakeWeakOnly();
  }

  function retargetWeak(item) {
    const p = getBossStageProfile(state.boss.stage);
    const stageKey = state.boss.rage ? 'RAGE' : state.boss.stage;
    const currentLane = nearestBossLaneIndex(item.y, item.size);
    const nextLane =
      state.boss.pattern === 'break'
        ? 1
        : pickLaneIndexForStage(stageKey === 'RAGE' ? 'C' : stageKey, currentLane);

    const lanes = getBossLaneCenters(item.size);
    const targetLaneY = clamp(
      lanes[nextLane] - item.size / 2,
      getBossPlayRect(item.size).top + 8,
      getBossPlayRect(item.size).bottom - 8
    );

    item.targetLaneIndex = nextLane;
    item.targetLaneY = targetLaneY;

    if (state.boss.pattern === 'break') {
      item.moveMode = 'break';
      item.baseVX = (rand() < 0.5 ? -1 : 1) * range(p.weakSpeedBreak * 0.26, p.weakSpeedBreak * 0.42);
      item.vx = item.baseVX;
      item.vy = 0;
      return;
    }

    if (stageKey === 'A') {
      item.moveMode = 'lane';
      item.baseVX = (rand() < 0.5 ? -1 : 1) * range(p.weakSpeedHunt * 0.26, p.weakSpeedHunt * 0.40);
      item.vx = item.baseVX;
      item.vy = 0;
      return;
    }

    if (stageKey === 'B') {
      item.moveMode = 'zigzag';
      item.baseVX = (rand() < 0.5 ? -1 : 1) * range(p.weakSpeedHunt * 0.68, p.weakSpeedHunt * 0.96);
      item.vx = item.baseVX;
      item.vy = 0;
      item.zigAmp = range(34, 66);
      item.zigFreq = range(0.010, 0.018);
      item.zigT = 0;
      return;
    }

    item.moveMode = 'dash';
    item.baseVX = (rand() < 0.5 ? -1 : 1) * range(p.weakSpeedHunt * 0.88, p.weakSpeedHunt * 1.08);
    item.vx = item.baseVX;
    item.vy = 0;
    item.dashLeft = state.boss.rage ? range(320, 480) : range(520, 760);
  }

  function updateWeak(item, dt) {
    const box = getBossPlayRect(item.size);

    item.x += item.vx * dt / 1000;
    item.y += item.vy * dt / 1000;

    if (item.x <= box.left) {
      item.x = box.left;
      item.vx = Math.abs(item.vx);
      item._edgeTrapFrames = (item._edgeTrapFrames || 0) + 1;
    }
    if (item.x >= box.right) {
      item.x = box.right;
      item.vx = -Math.abs(item.vx);
      item._edgeTrapFrames = (item._edgeTrapFrames || 0) + 1;
    }
    if (item.y <= box.top) {
      item.y = box.top;
      item.vy = Math.abs(item.vy);
      item._edgeTrapFrames = (item._edgeTrapFrames || 0) + 1;
    }
    if (item.y >= box.bottom) {
      item.y = box.bottom;
      item.vy = -Math.abs(item.vy);
      item._edgeTrapFrames = (item._edgeTrapFrames || 0) + 1;
    }

    if (box.bossBlock) {
      const b = box.bossBlock;
      const overlapsBossCard =
        item.x + item.size > b.left &&
        item.x < b.right &&
        item.y + item.size > b.top &&
        item.y < b.bottom;

      if (overlapsBossCard) {
        const pushLeft = Math.abs((item.x + item.size) - b.left);
        const pushRight = Math.abs(b.right - item.x);
        const pushUp = Math.abs((item.y + item.size) - b.top);
        const pushDown = Math.abs(b.bottom - item.y);

        const minPush = Math.min(pushLeft, pushRight, pushUp, pushDown);

        if (minPush === pushLeft) {
          item.x = b.left - item.size - 2;
          item.vx = -Math.abs(item.vx || 60);
        } else if (minPush === pushRight) {
          item.x = b.right + 2;
          item.vx = Math.abs(item.vx || 60);
        } else if (minPush === pushUp) {
          item.y = b.top - item.size - 2;
          item.vy = -Math.abs(item.vy || 40);
        } else {
          item.y = b.bottom + 2;
          item.vy = Math.abs(item.vy || 40);
        }

        item._edgeTrapFrames = (item._edgeTrapFrames || 0) + 2;
      }
    }

    if (state.boss.active) {
      const targetY = Number.isFinite(item.targetLaneY) ? item.targetLaneY : item.y;

      if (item.moveMode === 'lane' || item.moveMode === 'break') {
        item.y += (targetY - item.y) * Math.min(0.14, dt / 220);
        item.vx = item.baseVX || item.vx;
      } else if (item.moveMode === 'zigzag') {
        item.zigT = (item.zigT || 0) + dt;
        const waveY = targetY + Math.sin(item.zigT * (item.zigFreq || 0.014)) * (item.zigAmp || 52);
        item.y += (waveY - item.y) * Math.min(0.18, dt / 180);
        item.vx = item.baseVX || item.vx;
      } else if (item.moveMode === 'dash') {
        item.dashLeft = (item.dashLeft || 0) - dt;
        item.y += (targetY - item.y) * Math.min(state.boss.rage ? 0.34 : 0.24, dt / 120);
        item.vx = item.baseVX || item.vx;

        if (item.dashLeft <= 0) {
          item.dashLeft = state.boss.rage ? 260 : 420;
          queueWeakRetarget(item, 'dash', state.boss.rage ? 90 : 120);
        }
      }

      const escapeLeft = Math.max(110, box.left + 30);
      const escapeTop = Math.max(140, box.top + 18);

      if (item.x < escapeLeft && item.y < escapeTop) {
        item.x = Math.max(item.x, escapeLeft + range(18, 42));
        item.y = Math.max(item.y, escapeTop + range(16, 38));

        if (item.vx < 0) item.vx = Math.abs(item.vx || 70);
        if (item.vy < 0) item.vy = Math.abs(item.vy || 20);

        item._edgeTrapFrames = (item._edgeTrapFrames || 0) + 2;
      }

      if (itemLooksStuck(item)) {
        item._stuckFrames = (item._stuckFrames || 0) + 1;
      } else {
        item._stuckFrames = 0;
        item._edgeTrapFrames = Math.max(0, (item._edgeTrapFrames || 0) - 1);
      }

      if ((item._stuckFrames || 0) >= 5) {
        rescueWeakTarget(item, 'stuck');
      } else if ((item._edgeTrapFrames || 0) >= 7) {
        rescueWeakTarget(item, 'edge-trap');
      }
    }

    item._trailAcc = (item._trailAcc || 0) + dt;
    if (item.kind === 'weak' && item._trailAcc >= 48) {
      item._trailAcc = 0;
      spawnTrailDot(
        item.x + item.size / 2,
        item.y + item.size / 2,
        'weak',
        Math.max(14, item.size * 0.18)
      );
    }

    item._afterAcc = (item._afterAcc || 0) + dt;
    if (item.kind === 'fakeweak' && item._afterAcc >= 72) {
      item._afterAcc = 0;
      spawnTrailDot(
        item.x + item.size / 2,
        item.y + item.size / 2,
        'fake',
        Math.max(16, item.size * 0.22)
      );
      spawnAfterImage(item);
    }

    drawItem(item);
  }

  function ensureWeakForPattern() {
    if (state.boss.weakId || state.boss.fakeWeakActive) return;

    const p = getBossStageProfile(state.boss.stage);
    const isBreak = state.boss.pattern === 'break';
    const size = isBreak ? p.weakSizeBreak : p.weakSizeHunt;
    const speed = isBreak ? p.weakSpeedBreak : p.weakSpeedHunt;

    const stageKey = state.boss.rage ? 'RAGE' : state.boss.stage;

    const spawnRealWeak = () => {
      let laneIndex;
      let sideBias;

      if (isBreak) {
        laneIndex = 1;
        sideBias = 'center';
      } else if (stageKey === 'A') {
        laneIndex = pickLaneIndexForStage('A', -1);
        sideBias = 'right';
      } else if (stageKey === 'B') {
        laneIndex = pickLaneIndexForStage('B', -1);
        sideBias = rand() < 0.5 ? 'left' : 'right';
      } else {
        laneIndex = pickLaneIndexForStage('C', -1);
        sideBias = 'center';
      }

      const pos = randomBossSpawnInLane(size, laneIndex, sideBias);

      const item = createItem(
        'weak',
        isBreak ? '💥' : '🎯',
        pos.x,
        pos.y,
        size,
        range(-speed, speed),
        range(-speed, speed),
        isBreak ? 'break' : 'weak'
      );

      if (isBreak) item.el.classList.add('break');

      item.targetLaneIndex = laneIndex;
      retargetWeak(item);
      state.boss.weakId = item.id;
    };

    const shouldFake =
      state.boss.rage &&
      state.boss.stage === 'C' &&
      rand() < (state.boss.pattern === 'break' ? 0.76 : 0.62);

    if (!shouldFake) {
      spawnRealWeak();
      return;
    }

    const fakeSize = size + 10;
    const fakeLane = pickLaneIndexForStage('C', -1);
    const fakePos = randomBossSpawnInLane(fakeSize, fakeLane, 'left');

    const fake = createItem(
      'fakeweak',
      '❌',
      fakePos.x,
      fakePos.y,
      fakeSize,
      range(-speed * 0.72, speed * 0.72),
      range(-speed * 0.72, speed * 0.72),
      'fake'
    );

    fake.targetLaneIndex = fakeLane;
    retargetWeak(fake);

    state.boss.fakeWeakActive = true;
    state.boss.fakeWeakDecoyId = fake.id;

    spawnAfterImage(fake);

    safeTimeout(() => {
      if (state.ended || !state.boss.active) return;
      if (state.boss.fakeWeakDecoyId !== fake.id) return;
      warnBeforeFakeCollapse(fake);
    }, Math.max(80, (state.boss.rage ? 320 : 400) - 120));

    safeTimeout(() => {
      if (state.ended || !state.boss.active) return;

      if (state.boss.fakeWeakDecoyId === fake.id) {
        spawnImpact(
          fake.x + fake.size / 2,
          fake.y + fake.size / 2,
          'storm',
          Math.max(68, fake.size)
        );
        removeItem(fake);
      }

      state.boss.fakeWeakActive = false;
      state.boss.fakeWeakDecoyId = '';

      if (!state.boss.weakId) spawnRealWeak();
    }, state.boss.rage ? 320 : 400);
  }

  function startTelegraph(text, ms) {
    state.boss.telegraphOn = true;
    state.boss.telegraphText = text;
    state.boss.telegraphMs = ms || 800;
    state.lastTelegraphAt = Date.now();

    state.metrics.telegraphShown += 1;
    state.metrics.telegraphByPattern[state.boss.pattern] =
      (state.metrics.telegraphByPattern[state.boss.pattern] || 0) + 1;

    pushEvent('boss_telegraph', {
      pattern: state.boss.pattern,
      stage: state.boss.rage ? 'RAGE' : state.boss.stage,
      text: text,
      durationMs: ms || 800
    });

    showTelegraph(text, ms || 800);
  }

  function startPattern(pattern, withTelegraph) {
    const p = getBossStageProfile(state.boss.stage);

    state.boss.pattern = pattern;
    state.metrics.patternStarts[pattern] =
      (state.metrics.patternStarts[pattern] || 0) + 1;

    pushEvent('boss_pattern_start', {
      pattern: pattern,
      stage: state.boss.rage ? 'RAGE' : state.boss.stage,
      withTelegraph: !!withTelegraph,
      hp: state.boss.hp
    });

    state.boss.patternTimeLeft = p.patternDuration;
    state.boss.stormBurstLeft = 0;
    state.boss.stormBurstGapMs = 0;
    state.boss.stormWaveCooldown = 0;
    state.boss.weakRetargetAcc = 0;
    state.boss.weakRetargetMs =
      pattern === 'break' ? p.breakRetargetMs : p.huntRetargetMs;

    clearPatternTargets();

    if (withTelegraph) {
      if (pattern === 'storm') {
        startTelegraph('⚠️ Junk Storm กำลังมา x' + p.stormBurstCount, p.telegraphMs);
      } else if (pattern === 'break') {
        startTelegraph('🛡️ Armor Break! เป้าทองจะใหญ่และตีแรงขึ้น', p.telegraphMs - 120);
      } else {
        startTelegraph('🎯 Target Hunt! ตามเป้าทองให้ทัน', p.telegraphMs - 120);
      }
    } else {
      state.boss.telegraphOn = false;
      state.boss.telegraphMs = 0;
    }

    if (pattern === 'storm') {
      state.boss.stormWaveCooldown = p.stormWaveEvery;
      showDangerEdge(p.telegraphMs + 240);
    }

    setBanner(
      getPatternLabel(pattern) + ' • ' + getPatternSubtitle(pattern),
      pattern === 'storm' ? 1150 : 980
    );

    if (pattern === 'hunt') {
      showPraise('🎯 อ่านทางเป้า แล้วแตะให้ทัน', 760);
    } else if (pattern === 'break') {
      showPraise('💥 ช่วงนี้ตีแรงขึ้น!', 760);
    } else if (pattern === 'storm') {
      showPraise('⚠️ หลีก lane พายุให้ทัน', 820);
    }

    showPatternBanner(pattern);
    renderHud();
  }

  function beginNextBossPattern(forcePattern) {
    const cycle = getPatternCycle(state.boss.stage);

    if (forcePattern && cycle.includes(forcePattern)) {
      startPattern(forcePattern, true);
      return;
    }

    state.boss.patternCycleIndex = (state.boss.patternCycleIndex + 1) % cycle.length;
    const nextPattern = cycle[state.boss.patternCycleIndex];
    startPattern(nextPattern, true);
  }

  function syncBossStageByHp() {
    const nextStage = getBossStageByHp();
    if (nextStage === state.boss.stage) return;

    state.boss.stage = nextStage;
    state.boss.stageReached = nextStage;

    const theme = bossThemeForStage(nextStage);

    phaseFlash();
    stageShake();
    playSfx('phase-up');
    setBanner(getBossStageProfile(nextStage).label, 1200);

    if (nextStage === 'B') {
      showBossStageCallout(
        'Stage B • Pressure',
        'บอสเริ่มกดดันมากขึ้น เป้าจะเปลี่ยน lane เร็วกว่าเดิม',
        theme.accent
      );
    } else if (nextStage === 'C') {
      showBossStageCallout(
        'Stage C • Final',
        'เข้าสู่ช่วงท้ายแล้ว เป้าจะไวขึ้นและ pattern ดุขึ้น',
        theme.accent
      );
    }

    beginNextBossPattern(nextStage === 'B' ? 'break' : 'storm');
  }

  function enterPhase2() {
    state.phase = 2;
    clearItems();
    state.spawnAcc = 0;

    markSplit('phase2StartAt');
    pushEvent('phase_enter', {
      phase: 2,
      score: state.score,
      miss: state.miss,
      bestStreak: state.bestStreak
    });

    pulsePhase();
    phaseFlash();
    playSfx('phase-up');
    setBanner('Phase 2 • เร็วขึ้นและกดดันขึ้น', 1400);
    renderHud();
  }

  function enterBoss() {
    state.phase = 3;
    state.boss.active = true;
    state.boss.hp = cfg.bossHp;
    state.boss.maxHp = cfg.bossHp;
    state.boss.stage = 'A';
    state.boss.stageReached = 'A';
    state.boss.patternCycleIndex = -1;
    state.boss.telegraphOn = false;
    state.boss.telegraphMs = 0;
    state.boss.killSequence = false;
    state.boss.rage = false;
    state.boss.rageTriggered = false;
    state.boss.fakeWeakActive = false;
    state.boss.fakeWeakDecoyId = '';
    state.boss.lowHpTier = 0;
    state.boss.weakId = '';
    state.boss.killSequence = false;
    state.boss.telegraphOn = false;

    state.metrics.bossEnterAt = Date.now();
    markSplit('bossStartAt');
    pushEvent('boss_enter', {
      hp: cfg.bossHp,
      score: state.score,
      miss: state.miss,
      bestStreak: state.bestStreak
    });

    clearItems();
    state.spawnAcc = 0;

    pulsePhase();
    phaseFlash();
    stageShake();
    playSfx('phase-up');
    setBanner('Boss Phase • Junk King มาแล้ว!', 1600);
    showBossIntroCard();
    showBossStageCallout('Stage A • Learn', 'เริ่มอ่านจังหวะ weak target ก่อน แล้วค่อยโจมตี', '#ffd45c');

    beginNextBossPattern('hunt');
    renderHud();
  }

  function enterRageFinale() {
    if (state.boss.rageTriggered || state.ended) return;

    state.boss.rage = true;
    state.boss.rageTriggered = true;
    state.boss.rageEnterMs = 1400;
    state.boss.stageReached = 'RAGE';

    state.metrics.rageEntered = true;
    state.metrics.rageAtHp = state.boss.hp;
    markSplit('rageStartAt');
    pushEvent('boss_rage_enter', {
      bossHp: state.boss.hp,
      score: state.score,
      miss: state.miss
    });

    clearPatternTargets();

    pulsePhase();
    phaseFlash();
    stageShake();
    playSfx('phase-up');
    showDangerEdge(1800);
    setBanner('🔥 RAGE FINALE! บอสโกรธสุดแล้ว!', 1500);
    showBossIntroCard();
    showBossStageCallout(
      'Rage Finale',
      'พายุถี่ขึ้น เป้าหลอกเพิ่มขึ้น และ weak target จะดุกว่าเดิม',
      '#ff8f6b'
    );

    setRageAura(true);
    startTelegraph('🔥 Rage Finale! เป้าหลอก + พายุถี่ขึ้น', 720);

    startPattern('storm', true);
    renderHud();
  }

  function spawnStormOne() {
    const r = stageRect();
    const p = getBossStageProfile(state.boss.stage);

    const size = range(42, 62);
    let x = range(10, Math.max(12, r.width - size - 10));
    let y = -size - range(0, 20);
    let vx = range(-70, 70);
    let vy = state.boss.stage === 'C' ? range(250, 370) : range(180, 280);

    if (p.stormMode === 'single') {
      vx = range(-45, 45);
      vy = range(170, 240);
    } else if (p.stormMode === 'cross') {
      x = rand() < 0.5 ? 24 : Math.max(28, r.width - size - 24);
      vx = x < r.width / 2 ? range(70, 120) : range(-120, -70);
      vy = range(190, 280);
    } else if (p.stormMode === 'fan') {
      const mid = r.width * 0.5;
      x = clamp(mid + range(-80, 80), 10, r.width - size - 10);
      vx = range(-120, 120);
      vy = range(220, 320);
    } else if (p.stormMode === 'rage-rain') {
      x = range(10, Math.max(12, r.width - size - 10));
      vx = range(-90, 90);
      vy = range(280, 420);
    }

    state.spawnedStorm += 1;
    state.metrics.stormSpawned += 1;

    showStormTelegraphLane(x, size, p.stage === 'C' ? 520 : 680);

    const create = () => {
      createItem(
        'storm',
        JUNK[Math.floor(rand() * JUNK.length)],
        x,
        y,
        size,
        vx,
        vy,
        'storm'
      );
    };

    if (p.stage === 'A') {
      safeTimeout(create, 150);
    } else if (p.stage === 'B') {
      safeTimeout(create, 110);
    } else {
      safeTimeout(create, state.boss.rage ? 70 : 90);
    }
  }

  function updateBossPattern(dt) {
    const p = getBossStageProfile(state.boss.stage);

    if (state.boss.telegraphOn) {
      state.boss.telegraphMs -= dt;
      if (state.boss.telegraphMs <= 0) {
        state.boss.telegraphOn = false;
        ui.telegraph.classList.remove('show');
        layoutInnerHud();

        if (state.boss.pattern === 'storm') {
          state.boss.stormBurstLeft = p.stormBurstCount;
          state.boss.stormBurstGapMs = 0;
        } else {
          ensureWeakForPattern();
        }
      }
      return;
    }

    state.boss.patternTimeLeft -= dt;

    if (state.boss.pattern === 'hunt' || state.boss.pattern === 'break') {
      ensureWeakForPattern();
      state.boss.weakRetargetAcc += dt;

      if (state.boss.weakRetargetAcc >= state.boss.weakRetargetMs) {
        state.boss.weakRetargetAcc = 0;
        const weak = state.boss.weakId ? state.items.get(state.boss.weakId) : null;
        if (weak) {
          queueWeakRetarget(
            weak,
            weak.moveMode === 'dash' ? 'dash' : 'lane',
            weak.moveMode === 'dash' ? 110 : 150
          );
        }
      }
    }

    if (state.boss.pattern === 'storm') {
      state.boss.stormWaveCooldown -= dt;

      if (state.boss.stormWaveCooldown <= 0 && state.boss.stormBurstLeft <= 0) {
        state.boss.stormBurstLeft = p.stormBurstCount;
        state.boss.stormBurstGapMs = 0;
        state.boss.stormWaveCooldown = p.stormWaveEvery;
      }

      if (state.boss.stormBurstLeft > 0) {
        state.boss.stormBurstGapMs -= dt;
        if (state.boss.stormBurstGapMs <= 0) {
          spawnStormOne();
          state.boss.stormBurstLeft -= 1;
          state.boss.stormBurstGapMs = p.stormBurstGap;
        }
      }

      ensureWeakForPattern();
    }

    if (state.boss.patternTimeLeft <= 0) {
      beginNextBossPattern();
    }
  }

  function updateBossUi() {
    if (!state.boss.active) {
      ui.bossWrap.classList.remove('show');
      ui.bossWrap.classList.remove('dock-lower');
      ui.topHud.classList.remove('boss-mode');
      ui.topHud.style.setProperty('--boss-reserve', '0px');
      setRageAura(false);
      return;
    }

    const visualStage = state.boss.rage ? 'RAGE' : state.boss.stage;
    const p = getBossStageProfile(state.boss.stage);

    ui.bossWrap.classList.add('show');

    ui.bossPatternText.textContent =
      getPatternLabel(state.boss.pattern) + ' • ' + getPatternSubtitle(state.boss.pattern);

    ui.bossStageText.textContent = visualStage === 'RAGE'
      ? 'Rage Finale'
      : p.label;

    ui.bossStageText.className =
      'gjsb-boss-stage ' + (visualStage === 'RAGE' ? 'c' : p.stageClass);

    ui.bossHpText.textContent = 'HP ' + state.boss.hp + ' / ' + state.boss.maxHp;
    ui.bossHpFill.style.transform =
      'scaleX(' + clamp(state.boss.hp / state.boss.maxHp, 0, 1) + ')';

    ui.bossIcon.textContent = visualStage === 'RAGE' ? '👹' : p.icon;
    ui.bossPatternChip.textContent = getPatternLabel(state.boss.pattern);
    ui.bossPatternChip.className = 'gjsb-patternChip ' + state.boss.pattern;

    ui.bossRageBadge.classList.toggle('show', !!state.boss.rage);
    ui.bossCard.classList.toggle('rage', !!state.boss.rage);
    setRageAura(!!state.boss.rage);

    applyBossStageVisuals(visualStage);
    layoutInnerHud();
  }

  function renderHud() {
    const narrow = window.innerWidth < 720;

    ui.score.textContent = narrow ? ('S • ' + state.score) : ('Score • ' + state.score);
    ui.time.textContent = narrow ? ('T • ' + fmtTime(state.timeLeft)) : ('Time • ' + fmtTime(state.timeLeft));
    ui.miss.textContent = narrow ? ('M • ' + state.miss) : ('Miss • ' + state.miss);
    ui.streak.textContent = narrow ? ('C • ' + state.streak) : ('Streak • ' + state.streak);

    if (state.boss.active) {
      ui.phase.textContent = narrow ? ('B • ' + (state.boss.rage ? 'R' : state.boss.stage)) : ('Boss • ' + (state.boss.rage ? 'Rage' : state.boss.stage));
    } else {
      ui.phase.textContent = narrow ? ('P • ' + state.phase) : ('Phase • ' + state.phase);
    }

    const progressRatio = clamp(state.timeLeft / state.timeTotal, 0, 1);
    ui.progress.style.transform = 'scaleX(' + progressRatio + ')';

    refreshUtilityButtons();
    updateBossUi();
    layoutInnerHud();
  }

  function startKillSequence(x, y) {
    if (state.boss.killSequence || state.ended) return;

    state.boss.killSequence = true;
    state.running = false;

    const stageKey = state.boss.rage ? 'RAGE' : state.boss.stage;

    showLastHitFinish(x, y, 3, stageKey);
    playSfx('boss-clear');
    setBanner('ชนะแล้ว! Junk King แพ้แล้ว!', 1200);

    pushEvent('victory_moment', {
      x: Math.round(x),
      y: Math.round(y),
      score: state.score,
      miss: state.miss,
      stage: stageKey
    });

    safeTimeout(() => {
      showVictoryMoment();
    }, 120);

    safeTimeout(() => {
      endGame(true);
    }, 760);
  }

  function onHit(item) {
    if (!state.running || state.ended) return;

    const cx = item.x + item.size / 2;
    const cy = item.y + item.size / 2;

    if (item.kind === 'good') {
      state.research.counters.goodTap += 1;

      state.hitsGood += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);

      const bonus = Math.min(10, Math.floor(state.streak / 3) * 2);
      const gain = cfg.scoreGood + bonus;
      state.score += gain;

      pushEvent('tap_good', {
        gain: gain,
        streak: state.streak,
        score: state.score
      });

      fx(cx, cy, '+' + gain, '#2f8f2f');
      scorePop(cx, cy, '+' + gain, 'good', state.streak >= 8 ? 34 : 28);
      setBanner('เยี่ยม! เก็บอาหารดีต่อไป', 650);
      playSfx('good');
      maybePraiseStreak();
      removeItem(item);
    } else if (item.kind === 'junk' || item.kind === 'storm') {
      state.research.counters.junkTap += 1;
      if (item.kind === 'storm') state.research.counters.stormHit += 1;

      state.hitsBad += 1;
      state.miss += 1;
      state.streak = 0;
      state.score = Math.max(0, state.score - cfg.penaltyJunk);

      if (item.kind === 'storm') state.stormHits += 1;

      pushEvent(item.kind === 'storm' ? 'hit_storm' : 'tap_junk', {
        penalty: cfg.penaltyJunk,
        score: state.score,
        miss: state.miss
      });

      fx(cx, cy, 'MISS', '#d16b27');
      scorePop(cx, cy, '-' + cfg.penaltyJunk, 'bad', 26);
      if (item.kind === 'storm') {
        spawnImpact(cx, cy, 'storm', Math.max(86, item.size * 1.5));
      }
      setBanner(item.kind === 'storm' ? 'โดน Junk Storm!' : 'ระวัง junk!', 700);
      playSfx('bad');
      stageShake();
      showDangerEdge(item.kind === 'storm' ? 900 : 420);
      removeItem(item);
    } else if (item.kind === 'fakeweak') {
      state.research.counters.fakeTap += 1;

      state.metrics.fakeWeakTapped += 1;
      state.miss += 1;
      state.streak = 0;
      state.score = Math.max(0, state.score - cfg.penaltyFake);

      pushEvent('tap_fake_weak', {
        penalty: cfg.penaltyFake,
        score: state.score,
        miss: state.miss,
        bossStage: state.boss.rage ? 'RAGE' : state.boss.stage
      });

      fx(cx, cy, 'หลอก!', '#c05621');
      scorePop(cx, cy, '-' + cfg.penaltyFake, 'bad', 24);
      spawnImpact(cx, cy, 'storm', Math.max(72, item.size * 1.2));
      playSfx('bad');
      stageShake();
      showDangerEdge(620);
      removeItem(item);
    } else if (item.kind === 'weak') {
      state.research.counters.weakTap += 1;

      state.powerHits += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);

      const hitStage = state.boss.rage ? 'RAGE' : state.boss.stage;
      state.metrics.weakHitsByStage[hitStage] =
        (state.metrics.weakHitsByStage[hitStage] || 0) + 1;
      state.metrics.weakHitsByPattern[state.boss.pattern] =
        (state.metrics.weakHitsByPattern[state.boss.pattern] || 0) + 1;

      let reactMs = 0;
      if (state.lastTelegraphAt > 0) {
        reactMs = Date.now() - state.lastTelegraphAt;
        if (reactMs > 0 && reactMs < 5000) {
          state.metrics.telegraphReactMs.push(reactMs);
        }
        state.lastTelegraphAt = 0;
      }

      const damage = state.boss.pattern === 'break'
        ? (state.boss.stage === 'C' ? 3 : 2)
        : 1;

      state.boss.hp = Math.max(0, state.boss.hp - damage);
      state.score += damage >= 3 ? 30 : damage === 2 ? 24 : 15;

      pushEvent('tap_weak', {
        damage: damage,
        pattern: state.boss.pattern,
        stage: hitStage,
        reactMs: reactMs || 0,
        bossHpAfter: state.boss.hp,
        score: state.score
      });

      fx(cx, cy, damage >= 3 ? 'MEGA!' : damage === 2 ? 'CRUSH!' : 'POWER!', '#cf8a00');
      scorePop(cx, cy, damage >= 3 ? '+30' : damage === 2 ? '+24' : '+15', 'power', damage >= 3 ? 40 : 32);
      pulseBossHit();
      spawnImpact(cx, cy, 'hit', damage >= 3 ? 118 : damage === 2 ? 100 : 84);
      playSfx(damage >= 2 ? 'boss-break' : 'boss-hit');
      maybePraiseStreak();
      phaseFlash();
      stageShake();
      removeItem(item);

      if (state.boss.hp <= 0) {
        pushEvent('boss_defeat_trigger', {
          stage: hitStage,
          pattern: state.boss.pattern,
          score: state.score
        });
        startKillSequence(cx, cy);
        return;
      }

      syncBossStageByHp();
      setBanner(getPatternLabel(state.boss.pattern) + ' โดนแล้ว!', 820);
    }

    renderHud();
  }

  function calcGrade(bossClear) {
    const avgReact = safeAvg(state.metrics.telegraphReactMs) || 9999;
    if (bossClear && state.miss <= 3 && state.bestStreak >= 10 && avgReact <= 950) return 'S';
    if (bossClear && state.miss <= 7) return 'A';
    if (bossClear || (state.score >= cfg.p2Goal && state.miss <= 10)) return 'B';
    return 'C';
  }

  function medalEmojiForGrade(grade) {
    if (grade === 'S') return '🏆';
    if (grade === 'A') return '🥇';
    if (grade === 'B') return '🥈';
    return '🥉';
  }

  function starsFromSummary(bossClear) {
    if (bossClear && state.miss <= 5) return 3;
    if (bossClear || state.boss.active) return 2;
    return 1;
  }

  function coachMessage(bossClear) {
    const avgReact = safeAvg(state.metrics.telegraphReactMs);

    if (bossClear && state.miss <= 5 && avgReact && avgReact <= 950) {
      return 'สุดยอดเลย! เธออ่านสัญญาณเตือนได้ไว รักษาคอมโบดี และปราบ Junk King ได้อย่างมั่นใจ';
    }

    if (bossClear) {
      return 'เยี่ยมมาก! เธอผ่านทุก phase จนเอาชนะ Junk King ได้สำเร็จ รอบหน้าลองลด miss ลงอีกนิดจะได้เกรดสูงขึ้น';
    }

    if (state.metrics.rageEntered) {
      return 'เก่งมาก! เธอไปถึง Rage Finale แล้ว รอบหน้าลองหลบ Junk Storm ให้มากขึ้น และอย่าโดนเป้าหลอก';
    }

    if (state.boss.active) {
      return 'ใกล้มากแล้ว! เธอถึงบอสแล้ว ลองจับจังหวะ telegraph ให้ไว และใช้โอกาส Armor Break ให้คุ้มที่สุด';
    }

    if (state.phase >= 2) {
      return 'ดีมาก! ผ่าน Phase 2 แล้ว รอบหน้าถ้ารักษาคอมโบและแตะของดีให้ต่อเนื่อง จะทะลุบอสได้แน่';
    }

    return 'เริ่มต้นได้ดีเลย ลองเก็บอาหารดีให้ต่อเนื่อง และหลบ junk ให้แม่นขึ้น แล้วจะไปถึงบอสได้เร็วขึ้น';
  }

  function nextHintMessage(bossClear) {
    if (bossClear && state.miss <= 3) {
      return '🎯 Challenge ต่อไป: ลองจบแบบ Miss ไม่เกิน 2 และทำ Best Streak ให้ถึง 12';
    }
    if (bossClear) {
      return '🏆 Challenge ต่อไป: ลองเคลียร์บอสให้เร็วขึ้น และอย่าโดน Fake Weak';
    }
    if (state.metrics.rageEntered) {
      return '🔥 Challenge ต่อไป: ไปถึง Rage Finale อีกครั้ง แล้วลด Storm Hit ลง';
    }
    if (state.boss.active) {
      return '👑 Challenge ต่อไป: ไปให้ถึง Stage C แล้วปิดบอสให้ได้';
    }
    if (state.phase >= 2) {
      return '⚡ Challenge ต่อไป: ทำคะแนนให้ถึงเกณฑ์เข้าบอสเร็วขึ้น';
    }
    return '🍎 Challenge ต่อไป: รักษาคอมโบให้นานขึ้น แล้วแตะของดีต่อเนื่อง';
  }

  function gradeRank(grade) {
    if (grade === 'S') return 4;
    if (grade === 'A') return 3;
    if (grade === 'B') return 2;
    return 1;
  }

  function compareDeltaText(current, previous, higherIsBetter) {
    if (previous == null || !Number.isFinite(Number(previous))) {
      return { cls: 'flat', text: 'รอบแรก' };
    }

    const a = Number(current);
    const b = Number(previous);
    const d = a - b;

    if (d === 0) {
      return { cls: 'flat', text: 'เท่าเดิม' };
    }

    const improved = higherIsBetter ? d > 0 : d < 0;
    const abs = Math.abs(d);

    return {
      cls: improved ? 'up' : 'down',
      text: (improved ? 'ดีขึ้น ' : 'ลดลง ') + abs
    };
  }

  function buildCompareSummary(currentPayload, previousPayload) {
    if (!previousPayload) {
      return {
        html: `
          <div class="gjsb-compareHead">
            <div class="gjsb-compareTitle">เทียบกับรอบก่อน</div>
            <div class="gjsb-compareBadge same">รอบแรกของชุดนี้</div>
          </div>

          <div style="margin-top:10px;padding:12px 14px;border-radius:16px;background:#fff;border:2px solid #e3f2f8;">
            <div style="font-size:13px;line-height:1.65;font-weight:1000;color:#6b675f;">
              รอบนี้จะถูกเก็บเป็น baseline เพื่อใช้เทียบกับรอบถัดไป
            </div>
          </div>
        `
      };
    }

    const cur = currentPayload;
    const prev = previousPayload;

    const scoreNow = Number(cur?.outcome?.score || 0);
    const scorePrev = Number(prev?.outcome?.score || 0);
    const missNow = Number(cur?.outcome?.miss || 0);
    const missPrev = Number(prev?.outcome?.miss || 0);
    const streakNow = Number(cur?.outcome?.bestStreak || 0);
    const streakPrev = Number(prev?.outcome?.bestStreak || 0);

    const gradeNow = String(cur?.outcome?.grade || 'C');
    const gradePrev = String(prev?.outcome?.grade || 'C');

    const rankNow = gradeRank(gradeNow);
    const rankPrev = gradeRank(gradePrev);

    let badgeClass = 'same';
    let badgeText = 'ใกล้เคียงรอบก่อน';
    let badgeIcon = '📘';

    if (rankNow > rankPrev || (rankNow === rankPrev && scoreNow > scorePrev && missNow <= missPrev)) {
      badgeClass = 'better';
      badgeText = 'ดีกว่ารอบก่อน';
      badgeIcon = '🚀';
    } else if (rankNow < rankPrev || (rankNow === rankPrev && scoreNow < scorePrev && missNow >= missPrev)) {
      badgeClass = 'worse';
      badgeText = 'ยังต่ำกว่ารอบก่อน';
      badgeIcon = '🪜';
    }

    const scoreDelta = compareDeltaText(scoreNow, scorePrev, true);
    const missDelta = compareDeltaText(missNow, missPrev, false);
    const streakDelta = compareDeltaText(streakNow, streakPrev, true);

    return {
      html: `
        <div class="gjsb-compareHead">
          <div class="gjsb-compareTitle">เทียบกับรอบก่อน</div>
          <div class="gjsb-compareBadge ${badgeClass}">${badgeIcon} ${badgeText}</div>
        </div>

        <div style="margin-top:10px;padding:12px 14px;border-radius:16px;background:linear-gradient(180deg,#fffef8,#ffffff);border:2px solid #e3f2f8;">
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
            <div class="gjsb-exportChip">เกรดก่อน: ${gradePrev}</div>
            <div class="gjsb-exportChip">เกรดรอบนี้: ${gradeNow}</div>
          </div>

          <div class="gjsb-compareGrid">
            <div class="gjsb-compareStat">
              <div class="gjsb-compareK">Score</div>
              <div class="gjsb-compareV">${scoreNow}</div>
              <div class="gjsb-compareDelta ${scoreDelta.cls}">
                ก่อนหน้า ${scorePrev} • ${scoreDelta.text}
              </div>
            </div>

            <div class="gjsb-compareStat">
              <div class="gjsb-compareK">Miss</div>
              <div class="gjsb-compareV">${missNow}</div>
              <div class="gjsb-compareDelta ${missDelta.cls}">
                ก่อนหน้า ${missPrev} • ${missDelta.text}
              </div>
            </div>

            <div class="gjsb-compareStat">
              <div class="gjsb-compareK">Best Streak</div>
              <div class="gjsb-compareV">${streakNow}</div>
              <div class="gjsb-compareDelta ${streakDelta.cls}">
                ก่อนหน้า ${streakPrev} • ${streakDelta.text}
              </div>
            </div>
          </div>
        </div>
      `
    };
  }

  function spawnSummaryConfetti(grade) {
    if (!ui.sumConfetti || state.a11y.reducedMotion) return;

    ui.sumConfetti.innerHTML = '';

    const count =
      grade === 'S' ? 34 :
      grade === 'A' ? 26 :
      grade === 'B' ? 18 :
      12;

    const tone =
      grade === 'S' ? 's' :
      grade === 'A' ? 'a' :
      grade === 'B' ? 'b' :
      'c';

    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = 'gjsb-confettiPiece ' + tone;

      const left = Math.random() * 100;
      const dx = (Math.random() * 120 - 60).toFixed(0) + 'px';
      const rot = (Math.random() * 500 - 250).toFixed(0) + 'deg';
      const dur = (2.1 + Math.random() * 1.6).toFixed(2) + 's';
      const delay = (Math.random() * 0.35).toFixed(2) + 's';
      const w = (8 + Math.random() * 7).toFixed(0) + 'px';
      const h = (12 + Math.random() * 10).toFixed(0) + 'px';

      piece.style.left = left + '%';
      piece.style.width = w;
      piece.style.height = h;
      piece.style.animationDuration = dur;
      piece.style.animationDelay = delay;
      piece.style.setProperty('--dx', dx);
      piece.style.setProperty('--rot', rot);

      ui.sumConfetti.appendChild(piece);
    }
  }

  function applySummaryGradeTheme(grade) {
    if (!ui.summaryCard) return;

    ui.summaryCard.classList.remove('grade-s', 'grade-a', 'grade-b', 'grade-c');

    if (grade === 'S') ui.summaryCard.classList.add('grade-s');
    else if (grade === 'A') ui.summaryCard.classList.add('grade-a');
    else if (grade === 'B') ui.summaryCard.classList.add('grade-b');
    else ui.summaryCard.classList.add('grade-c');

    if (ui.sumExportBox) ui.sumExportBox.classList.add('pretty');
  }

  function celebrateSummaryUI(bossClear, grade) {
    if (!ui || !ui.summaryCard) return;

    const head = ui.summaryCard.querySelector('.gjsb-summary-head');
    const actions = ui.summaryCard.querySelector('.gjsb-actions');
    const stats = ui.sumGrid ? Array.from(ui.sumGrid.querySelectorAll('.gjsb-stat')) : [];

    applySummaryGradeTheme(grade);
    spawnSummaryConfetti(grade);

    ui.summaryCard.classList.add('celebrate');
    if (head) head.classList.add('celebrate');

    if (ui.sumMedal) {
      ui.sumMedal.classList.remove('shine');
      void ui.sumMedal.offsetWidth;
      ui.sumMedal.classList.add('shine');
    }

    if (ui.sumGrade) {
      ui.sumGrade.classList.remove('pop');
      void ui.sumGrade.offsetWidth;
      ui.sumGrade.classList.add('pop');
    }

    if (ui.sumTitle) {
      ui.sumTitle.classList.remove('pop');
      void ui.sumTitle.offsetWidth;
      ui.sumTitle.classList.add('pop');
    }

    if (ui.sumSub) {
      ui.sumSub.classList.remove('pop');
      void ui.sumSub.offsetWidth;
      ui.sumSub.classList.add('pop');
    }

    if (ui.sumStars) {
      const starCount = bossClear ? (state.miss <= 5 ? 3 : 2) : (state.boss.active ? 2 : 1);
      ui.sumStars.classList.add('celebrate');
      ui.sumStars.innerHTML = '';

      for (let i = 0; i < starCount; i++) {
        const span = document.createElement('span');
        span.className = 'gjsb-star';
        span.textContent = '⭐';
        span.style.setProperty('--delay', (180 + i * 120) + 'ms');
        ui.sumStars.appendChild(span);
      }
    }

    stats.forEach((card, idx) => {
      card.classList.remove('reveal');
      card.style.setProperty('--delay', (260 + idx * 70) + 'ms');
      void card.offsetWidth;
      card.classList.add('reveal');
    });

    if (ui.sumCoach) {
      ui.sumCoach.classList.remove('reveal');
      ui.sumCoach.style.setProperty('--delay', (260 + stats.length * 70 + 60) + 'ms');
      void ui.sumCoach.offsetWidth;
      ui.sumCoach.classList.add('reveal');
    }

    if (bossClear && ui.sumTitle) {
      ui.sumTitle.textContent = state.boss.rageTriggered
        ? 'Legendary Rage Clear!'
        : 'Boss Clear Complete!';
    }

    if (bossClear && ui.sumSub) {
      ui.sumSub.textContent = state.boss.rageTriggered
        ? 'เธอผ่าน Rage Finale และเอาชนะ Junk King ได้แบบสุดมัน'
        : 'เธอผ่านทุก phase และปิดบอสได้สวยมาก';
    }

    if (ui.sumNextHint) {
      ui.sumNextHint.classList.remove('reveal');
      ui.sumNextHint.style.setProperty('--delay', (260 + stats.length * 70 + 130) + 'ms');
      void ui.sumNextHint.offsetWidth;
      ui.sumNextHint.classList.add('reveal');
    }

    if (ui.sumCompareBox) {
      ui.sumCompareBox.classList.remove('reveal');
      ui.sumCompareBox.style.setProperty('--delay', (260 + stats.length * 70 + 190) + 'ms');
      void ui.sumCompareBox.offsetWidth;
      ui.sumCompareBox.classList.add('reveal');
    }

    if (ui.sumExportBox) {
      ui.sumExportBox.classList.remove('reveal');
      ui.sumExportBox.style.setProperty('--delay', (260 + stats.length * 70 + 250) + 'ms');
      void ui.sumExportBox.offsetWidth;
      ui.sumExportBox.classList.add('reveal');
    }

    if (actions) {
      actions.classList.add('celebrate');
      const btns = Array.from(actions.querySelectorAll('.gjsb-btn'));
      btns.forEach((btn, idx) => {
        btn.style.setProperty('--delay', (260 + stats.length * 70 + 320 + idx * 80) + 'ms');
      });
    }

    if (ui.btnReplay) ui.btnReplay.classList.add('pulse');
    if (ui.btnCooldown) ui.btnCooldown.classList.add('pulse');

    const ribbon = ui.summaryCard.querySelector('.gjsb-summary-ribbon');
    if (ribbon) {
      ribbon.textContent =
        grade === 'S' ? 'LEGENDARY CLEAR' :
        grade === 'A' ? 'BOSS HERO CLEAR' :
        bossClear ? 'BOSS CLEAR' :
        state.boss.active ? 'BOSS REACHED' :
        state.phase >= 2 ? 'PHASE 2 CLEAR' :
        'GREAT START';
    }
  }

  function buildReplayUrl() {
    const u = new URL('./goodjunk-vr.html', location.href);
    u.searchParams.set('pid', ctx.pid || 'anon');
    u.searchParams.set('name', ctx.name || 'Hero');
    if (ctx.studyId) u.searchParams.set('studyId', ctx.studyId);
    u.searchParams.set('mode', 'solo');
    u.searchParams.set('diff', diffKey);
    u.searchParams.set('time', String(Math.round(state.timeTotal / 1000)));
    u.searchParams.set('seed', String(Date.now() + Math.floor(Math.random() * 10000)));
    u.searchParams.set('hub', ctx.hub || new URL('./hub-v2.html', location.href).toString());
    u.searchParams.set('view', ctx.view || 'mobile');
    u.searchParams.set('run', ctx.run || 'play');
    u.searchParams.set('gameId', ctx.gameId || 'goodjunk');
    u.searchParams.set('zone', 'nutrition');
    if (DEBUG) u.searchParams.set('debug', '1');
    return u.toString();
  }

  function buildCooldownUrl() {
    const u = new URL('./warmup-gate.html', location.href);
    u.searchParams.set('phase', 'cooldown');
    u.searchParams.set('game', 'goodjunk');
    u.searchParams.set('gameId', 'goodjunk');
    u.searchParams.set('theme', 'goodjunk');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('pid', ctx.pid || 'anon');
    u.searchParams.set('name', ctx.name || 'Hero');
    if (ctx.studyId) u.searchParams.set('studyId', ctx.studyId);
    u.searchParams.set('diff', diffKey);
    u.searchParams.set('time', String(Math.round(state.timeTotal / 1000)));
    u.searchParams.set('seed', ctx.seed || String(Date.now()));
    u.searchParams.set('hub', ctx.hub || new URL('./hub-v2.html', location.href).toString());
    u.searchParams.set('view', ctx.view || 'mobile');
    u.searchParams.set('run', ctx.run || 'play');
    u.searchParams.set('forcegate', '1');
    if (DEBUG) u.searchParams.set('debug', '1');
    return u.toString();
  }

  function endGame(bossClear) {
    if (state.ended) return;

    state.ended = true;
    state.running = false;
    cancelAnimationFrame(state.raf);
    clearItems();

    state.metrics.bossEndAt = state.boss.active ? Date.now() : 0;
    state.metrics.bossDurationMs =
      state.metrics.bossEnterAt > 0 && state.metrics.bossEndAt > 0
        ? (state.metrics.bossEndAt - state.metrics.bossEnterAt)
        : 0;
    state.metrics.clearTimeMs = Date.now() - state.metrics.runStartAt;

    markSplit('endAt');

    const stars = starsFromSummary(bossClear);
    const grade = calcGrade(bossClear);
    const medal = medalEmojiForGrade(grade);
    const avgReact = safeAvg(state.metrics.telegraphReactMs);

    pushEvent('run_end', {
      bossClear: !!bossClear,
      grade: grade,
      score: state.score,
      miss: state.miss,
      bestStreak: state.bestStreak,
      avgReactMs: avgReact
    });

    const previousPayload = loadPreviousResearchPayload();
    const payload = buildResearchPayload(bossClear, grade);
    saveResearchPayload(payload);

    ui.sumTitle.textContent = bossClear ? 'Food Hero Complete!' : 'Great Job!';
    ui.sumSub.textContent = bossClear
      ? 'เธอช่วยปกป้องเมืองอาหารดีและเอาชนะ Junk King ได้แล้ว'
      : state.phase >= 2
        ? 'ผ่านด่านก่อนบอสได้ดีมาก รอบหน้าลุยต่อได้อีก'
        : 'เริ่มต้นได้ดีมาก เก็บอาหารดีต่อไปนะ';

    ui.sumStars.textContent = '⭐'.repeat(stars);
    ui.sumGrade.textContent = grade;
    ui.sumGrade.className = 'gjsb-grade ' + grade.toLowerCase();
    ui.sumMedal.textContent = medal;

    ui.sumGrid.innerHTML = `
      <div class="gjsb-stat"><div class="k">Score</div><div class="v">${state.score}</div></div>
      <div class="gjsb-stat"><div class="k">Miss</div><div class="v">${state.miss}</div></div>
      <div class="gjsb-stat"><div class="k">Best Streak</div><div class="v">${state.bestStreak}</div></div>
      <div class="gjsb-stat"><div class="k">Good Hit</div><div class="v">${state.hitsGood}</div></div>
      <div class="gjsb-stat"><div class="k">Power Hit</div><div class="v">${state.powerHits}</div></div>
      <div class="gjsb-stat"><div class="k">Storm Hit</div><div class="v">${state.stormHits || 0}</div></div>
      <div class="gjsb-stat"><div class="k">Storm Dodge</div><div class="v">${state.metrics.stormDodgedApprox}</div></div>
      <div class="gjsb-stat"><div class="k">Fake Weak Tap</div><div class="v">${state.metrics.fakeWeakTapped}</div></div>
      <div class="gjsb-stat"><div class="k">Telegraph Avg</div><div class="v">${avgReact ? avgReact + 'ms' : '-'}</div></div>
      <div class="gjsb-stat"><div class="k">Boss Time</div><div class="v">${
        state.metrics.bossDurationMs ? (state.metrics.bossDurationMs / 1000).toFixed(1) + 's' : '-'
      }</div></div>
      <div class="gjsb-stat"><div class="k">Reached</div><div class="v">${
        bossClear
          ? (state.boss.rageTriggered ? 'Rage Clear' : 'Boss Clear')
          : (state.boss.active ? ('Boss ' + state.boss.stageReached) : ('Phase ' + state.phase))
      }</div></div>
      <div class="gjsb-stat"><div class="k">Last Pattern</div><div class="v">${getPatternLabel(state.boss.pattern)}</div></div>
    `;

    ui.sumCoach.textContent = coachMessage(bossClear);
    ui.sumNextHint.textContent = nextHintMessage(bossClear);

    if (ui.sumCompareBox) {
      const cmp = buildCompareSummary(payload, previousPayload);
      ui.sumCompareBox.innerHTML = cmp.html;
    }

    ui.sumExportBox.innerHTML = `
      <div><strong>payload พร้อม export แล้ว</strong></div>
      <div class="gjsb-exportMeta">
        <div class="gjsb-exportChip">sessionId: ${payload.sessionId}</div>
        <div class="gjsb-exportChip">events: ${payload.events.length}</div>
        <div class="gjsb-exportChip">grade: ${payload.outcome.grade}</div>
        <div class="gjsb-exportChip">bossClear: ${payload.outcome.bossClear ? 'yes' : 'no'}</div>
      </div>
    `;
    ui.sumExportBox.classList.add('pretty');

    ui.summaryCard.classList.toggle(
      'replay-hot',
      !!bossClear || state.metrics.rageEntered || state.boss.active
    );

    saveLastSummary({
      source: 'goodjunk-solo-phaseboss-v2',
      gameId: ctx.gameId || 'goodjunk',
      mode: 'solo',
      pid: ctx.pid || 'anon',
      diff: diffKey,
      score: state.score,
      miss: state.miss,
      bestStreak: state.bestStreak,
      hitsGood: state.hitsGood,
      hitsBad: state.hitsBad,
      goodMissed: state.goodMissed,
      powerHits: state.powerHits,
      stormHits: state.stormHits,
      bossDefeated: !!bossClear,
      phaseReached: state.boss.active ? 'boss' : ('phase-' + state.phase),
      bossStageReached: state.boss.stageReached,
      bossPatternLast: state.boss.pattern,
      rageTriggered: !!state.boss.rageTriggered,
      fakeWeakTapped: state.metrics.fakeWeakTapped,
      stormDodgedApprox: state.metrics.stormDodgedApprox,
      telegraphAvgReactMs: avgReact,
      bossDurationMs: state.metrics.bossDurationMs,
      clearTimeMs: state.metrics.clearTimeMs,
      weakHitsByStage: state.metrics.weakHitsByStage,
      weakHitsByPattern: state.metrics.weakHitsByPattern,
      patternStarts: state.metrics.patternStarts,
      finalGrade: grade
    });

    clearRuntimeTimers();

    state.paused = false;
    ui.pauseOverlay.classList.remove('show');
    ui.telegraph.classList.remove('show');
    ui.banner.classList.add('hide');
    ui.dangerEdge.classList.remove('show');
    if (ui.stormLane) ui.stormLane.classList.remove('show');
    setRageAura(false);

    ui.summary.classList.add('show');
    celebrateSummaryUI(bossClear, grade);
  }

  function bindButtons() {
    if (!ui || !ui.root) return;
    if (ui.root.__gjsbBound) return;
    ui.root.__gjsbBound = true;

    ui.btnReplay.addEventListener('click', function () {
      beforeNavigationCleanup();
      location.href = buildReplayUrl();
    });

    ui.btnCooldown.addEventListener('click', function () {
      beforeNavigationCleanup();
      location.href = buildCooldownUrl();
    });

    ui.btnCopyJson.addEventListener('click', async function () {
      try {
        const payload = window.HHA_LAST_BOSS_PAYLOAD || null;
        if (!payload) {
          if (ui.sumExportBox) ui.sumExportBox.textContent = 'ยังไม่มี payload ให้คัดลอก';
          return;
        }

        const text = JSON.stringify(payload, null, 2);
        const ok = await safeCopyText(text);

        if (ui.sumExportBox) {
          ui.sumExportBox.innerHTML = ok
            ? '<strong>คัดลอก JSON แล้ว</strong>'
            : '<strong>คัดลอกไม่สำเร็จ</strong>';
        }
      } catch (_) {
        if (ui.sumExportBox) ui.sumExportBox.innerHTML = '<strong>คัดลอกไม่สำเร็จ</strong>';
      }
    });

    ui.btnHub.addEventListener('click', function () {
      beforeNavigationCleanup();
      location.href = ctx.hub || new URL('./hub-v2.html', location.href).toString();
    });

    ui.btnPause.addEventListener('click', function () {
      if (state.paused) resumeGame();
      else pauseGame('manual');
    });

    ui.btnMute.addEventListener('click', function () {
      setMuted(!state.muted);
    });

    ui.btnMotion.addEventListener('click', function () {
      setReducedMotion(!state.a11y.reducedMotion);
    });

    ui.btnResume.addEventListener('click', function () {
      resumeGame();
    });

    ui.btnPauseHub.addEventListener('click', function () {
      beforeNavigationCleanup();
      location.href = ctx.hub || new URL('./hub-v2.html', location.href).toString();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && !state.ended) pauseGame('hidden');
    });

    window.addEventListener('blur', function () {
      if (!state.ended) pauseGame('hidden');
    });

    window.addEventListener('resize', function () {
      state.a11y.highContrastTelegraph = window.innerWidth < 720;
      layoutInnerHud();
      normalizeAllActiveItemsAfterResize();
      renderHud();
    }, { passive: true });

    window.addEventListener('keydown', function (ev) {
      if (state.ended) return;

      if (ev.key === 'p' || ev.key === 'P') {
        ev.preventDefault();
        if (state.paused) resumeGame();
        else pauseGame('manual');
      }

      if (ev.key === 'm' || ev.key === 'M') {
        ev.preventDefault();
        setMuted(!state.muted);
        renderHud();
      }
    });

    window.addEventListener('beforeunload', function () {
      beforeNavigationCleanup();
    });
  }

  function update(dt) {
    if (state.paused) {
      renderHud();
      return;
    }

    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      endGame(false);
      return;
    }

    state.presentationLockMs = Math.max(0, state.presentationLockMs - dt);
    state.praiseMs = Math.max(0, state.praiseMs - dt);
    state.hudAwakeMs = Math.max(0, state.hudAwakeMs - dt);

    if (!state.boss.active) {
      const spawnEvery = state.phase === 1 ? cfg.spawn1 : cfg.spawn2;
      state.spawnAcc += dt;

      while (state.spawnAcc >= spawnEvery) {
        state.spawnAcc -= spawnEvery;
        spawnFood(state.phase);
      }
    }

    state.items.forEach((item) => {
      if (item.dead) return;

      if (item.kind === 'weak' || item.kind === 'fakeweak') {
        updateWeak(item, dt);
        return;
      }

      item.x += item.vx * dt / 1000;
      item.y += item.vy * dt / 1000;

      const r = stageRect();

      if (item.x <= 8) {
        item.x = 8;
        item.vx *= -1;
      }
      if (item.x + item.size >= r.width - 8) {
        item.x = r.width - item.size - 8;
        item.vx *= -1;
      }

      drawItem(item);

      if (item.y > r.height + item.size * 0.5) {
        if (item.kind === 'good') {
          state.research.counters.goodMiss += 1;

          state.miss += 1;
          state.goodMissed += 1;
          state.streak = 0;

          pushEvent('miss_good', {
            score: state.score,
            miss: state.miss
          });

          removeItem(item);
        } else if (item.kind === 'storm') {
          state.metrics.stormDodgedApprox += 1;

          pushEvent('storm_dodged_approx', {
            dodged: state.metrics.stormDodgedApprox,
            spawned: state.metrics.stormSpawned
          });

          spawnImpact(
            item.x + item.size / 2,
            Math.max(18, Math.min(r.height - 40, item.y)),
            'storm',
            Math.max(88, item.size * 1.7)
          );

          removeItem(item);
        } else {
          removeItem(item);
        }
      }
    });

    if (!state.boss.active && state.phase === 1 && state.score >= cfg.p1Goal) {
      enterPhase2();
    } else if (!state.boss.active && state.phase === 2 && state.score >= cfg.p2Goal) {
      enterBoss();
    }

    if (state.boss.active) {
      if (state.presentationLockMs <= 0) {
        updateBossPattern(dt);
      }

      maybeBossLowHpJuice();

      const ratio = state.boss.maxHp > 0 ? state.boss.hp / state.boss.maxHp : 1;
      if (!state.boss.rageTriggered && ratio <= 0.15) {
        enterRageFinale();
      }
    }

    renderHud();
  }

  function loop(ts) {
    if (!state.running || state.ended || state.runtime.destroyed) return;

    const dt = Math.min(40, (ts - state.lastTs) || 16);
    state.lastTs = ts;

    try {
      update(dt);
      updateDebugPanel();
    } catch (err) {
      console.error('[GJSB] loop failed', err);
      state.running = false;
      state.ended = true;
      if (ui && ui.sumExportBox) {
        ui.sumExportBox.innerHTML = '<strong>เกิด error ระหว่าง run</strong>';
      }
      return;
    }

    state.raf = requestAnimationFrame(loop);
  }

  function start() {
    if (state.runtime.started) {
      dlog('start skipped: already started');
      return;
    }

    state.runtime.started = true;
    state.runtime.destroyed = false;

    detectAccessibilityPrefs();
    setReducedMotion(state.a11y.reducedMotion);
    setMuted(false);

    clearRuntimeTimers();
    hardResetRunVisuals();
    ensureDebugPanel();

    state.metrics.runStartAt = nowMs();
    markSplit('phase1StartAt');

    pushEvent('run_start', {
      diff: diffKey,
      timeSec: Math.round(state.timeTotal / 1000),
      pid: ctx.pid || 'anon',
      run: ctx.run || 'play',
      seed: ctx.seed || ''
    });

    if (ui && ui.btnReplay) ui.btnReplay.classList.remove('pulse');
    if (ui && ui.btnCooldown) ui.btnCooldown.classList.remove('pulse');
    if (ui && ui.sumConfetti) ui.sumConfetti.innerHTML = '';
    if (ui && ui.sumCompareBox) ui.sumCompareBox.innerHTML = 'ยังไม่มีข้อมูลเทียบรอบก่อน';
    if (ui && ui.summaryCard) {
      ui.summaryCard.classList.remove('grade-s', 'grade-a', 'grade-b', 'grade-c');
    }

    state.lastTelegraphAt = 0;
    state.presentationLockMs = 0;
    state.hudAwakeMs = 1800;
    state.praiseMs = 0;

    state.running = true;
    state.lastTs = performance.now();
    renderHud();
    setBanner('เริ่มเลย! เก็บอาหารดี แล้วหลีกเลี่ยง junk', 1300);
    state.raf = requestAnimationFrame(loop);
    window.__GJ_ENGINE_MOUNTED__ = true;

    dlog('engine started');
  }

  if (!window.__GJSB_PHASEBOSS_BOOTED__) {
    window.__GJSB_PHASEBOSS_BOOTED__ = true;

    injectStyle();
    ui = buildUI();
    bindButtons();
    layoutInnerHud();
    start();
  } else {
    dlog('boot skipped: already booted');
  }
})();