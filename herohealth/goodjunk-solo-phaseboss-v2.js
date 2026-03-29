(function () {
  'use strict';

  const q = new URLSearchParams(location.search);
  const mount = document.getElementById('gameMount') || document.body;

  const ctx = window.__GJ_RUN_CTX__ || {
    pid: q.get('pid') || 'anon',
    name: q.get('name') || '',
    studyId: q.get('studyId') || '',
    diff: q.get('diff') || 'normal',
    time: q.get('time') || '150',
    seed: q.get('seed') || String(Date.now()),
    hub: q.get('hub') || new URL('./hub.html', location.href).toString(),
    nextAfterCooldown: q.get('nextAfterCooldown') || '',
    cdnext: q.get('cdnext') || '',
    view: q.get('view') || 'mobile',
    run: q.get('run') || 'play',
    gameId: q.get('gameId') || 'goodjunk'
  };

  const ROOT_ID = 'gjSoloBossRootV5';
  const STYLE_ID = 'gjSoloBossStyleV5';
  const META_KEY = 'HHA_GJ_SOLO_META_V1';
  const LAST_SUMMARY_KEY = 'HHA_LAST_SUMMARY';
  const HISTORY_KEY = 'HHA_SUMMARY_HISTORY';

  const GOOD = ['🍎', '🥕', '🥦', '🍌', '🥛', '🥗', '🍉', '🐟'];
  const JUNK = ['🍟', '🍩', '🍭', '🍔', '🥤', '🍕', '🧁', '🍫'];

  const DIFF = {
    easy:   { p1Goal: 70,  p2Goal: 170, spawn1: 920, spawn2: 760, bossHp: 16 },
    normal: { p1Goal: 90,  p2Goal: 220, spawn1: 760, spawn2: 620, bossHp: 22 },
    hard:   { p1Goal: 110, p2Goal: 260, spawn1: 620, spawn2: 500, bossHp: 28 }
  };

  const diffKey = DIFF[ctx.diff] ? ctx.diff : 'normal';
  const cfg = DIFF[diffKey];

  const state = {
    running: false,
    ended: false,

    score: 0,
    miss: 0,
    streak: 0,
    bestStreak: 0,
    hitsGood: 0,
    hitsBad: 0,
    missedGood: 0,
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

    scorePulseMs: 0,
    praiseMs: 0,
    hudAwakeMs: 1800,
    presentationLockMs: 0,
    patternBannerMs: 0,

    items: new Map(),

    lastSummaryMeta: null,
    unlockedNow: [],

    boss: {
      active: false,
      hp: cfg.bossHp,
      maxHp: cfg.bossHp,
      weakId: '',

      stage: 'A',
      stageReached: 'A',

      pattern: 'hunt',
      patternTimeLeft: 0,
      patternCycleIndex: 0,

      telegraphOn: false,
      telegraphText: '',
      telegraphMs: 0,

      stormBurstLeft: 0,
      stormBurstGapMs: 0,
      stormWaveCooldown: 0,

      weakRetargetMs: 0,
      weakRetargetAcc: 0,

      feedbackHitMs: 0,
      dangerMs: 0,

      camFxMs: 0,
      timeScale: 1,
      killSequence: false,

      rage: false,
      rageTriggered: false,
      rageEnterMs: 0,

      fakeWeakActive: false,
      fakeWeakDecoyId: '',

      adaptiveMode: 'steady',
      assistGraceMs: 0,

      introShowing: false
    }
  };

  let ui = null;

  function rand() { return Math.random(); }
  function range(min, max) { return min + Math.random() * (max - min); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function stageRect() {
    return ui.stage.getBoundingClientRect();
  }

  function isNarrowHud() {
    return window.innerWidth < 720;
  }

  function hudTopOffset() {
    return isNarrowHud() ? 104 : 132;
  }

  function getBossPlayRect(itemSize = 72) {
    const r = stageRect();
    const top = hudTopOffset() + 22;
    const left = 28;
    const right = Math.max(left + 80, r.width - itemSize - 28);
    const bottom = Math.max(top + 80, r.height - itemSize - 52);
    return { left, top, right, bottom, width: r.width, height: r.height };
  }

  function randomBossSpawn(itemSize = 72) {
    const box = getBossPlayRect(itemSize);
    const xMin = box.left + Math.max(24, box.width * 0.18);
    const xMax = box.right - Math.max(10, box.width * 0.10);
    const yMin = box.top + 8;
    const yMax = box.bottom - Math.max(6, box.height * 0.10);

    return {
      x: range(xMin, Math.max(xMin + 20, xMax)),
      y: range(yMin, Math.max(yMin + 20, yMax))
    };
  }

  function fmtTime(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function innerHudIsMinimal() {
    return !!(ui && ui.topHud && ui.topHud.classList.contains('boss-minimal'));
  }

  function innerHudBossReservePx() {
    if (!state.boss.active || !ui || !ui.bossWrap) return 0;

    if (innerHudIsMinimal()) {
      return isNarrowHud() ? 92 : 104;
    }

    const rect = ui.bossWrap.getBoundingClientRect();
    const cardWidth = Math.ceil(rect.width || ui.bossWrap.offsetWidth || 0);

    if (isNarrowHud()) {
      return Math.max(156, cardWidth + 12);
    }
    return Math.max(220, cardWidth + 18);
  }

  function compactBossPatternText() {
    const stageProfile = getBossAdaptiveProfile();

    if (!isNarrowHud()) {
      return getPatternLabel(state.boss.pattern) + ' • ' + getPatternSubtitle(state.boss.pattern);
    }

    if (state.boss.pattern === 'storm') return 'Storm • x' + stageProfile.stormBurstCount;
    if (state.boss.pattern === 'break') return 'Break • ตีแรง';
    return 'Hunt • ตามเป้า';
  }

  function readMeta() {
    try {
      const raw = localStorage.getItem(META_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== 'object') throw new Error('empty');

      return {
        plays: Number(parsed.plays || 0),
        bossClears: Number(parsed.bossClears || 0),
        rageClears: Number(parsed.rageClears || 0),
        bestScore: Number(parsed.bestScore || 0),
        bestStreak: Number(parsed.bestStreak || 0),
        bestGrade: String(parsed.bestGrade || 'C'),
        badges: Array.isArray(parsed.badges) ? parsed.badges.slice() : [],
        lastPlayedAt: Number(parsed.lastPlayedAt || 0)
      };
    } catch {
      return {
        plays: 0,
        bossClears: 0,
        rageClears: 0,
        bestScore: 0,
        bestStreak: 0,
        bestGrade: 'C',
        badges: [],
        lastPlayedAt: 0
      };
    }
  }

  function writeMeta(meta) {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch {}
  }

  function exposeMetaForOtherPages() {
    try {
      window.HHA_GJ_SOLO_META = readMeta();
    } catch {}
  }

  function saveSummary(summary) {
    try {
      localStorage.setItem(LAST_SUMMARY_KEY, JSON.stringify(summary));
      const raw = localStorage.getItem(HISTORY_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const next = Array.isArray(arr) ? arr : [];
      next.unshift(summary);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(0, 40)));
    } catch {}
  }

  function gradeRank(grade) {
    const map = { C: 1, B: 2, A: 3, S: 4 };
    return map[String(grade || 'C').toUpperCase()] || 1;
  }

  function badgeCatalog() {
    return [
      { id: 'first_play', label: '🎈 First Play', test: (r) => r.meta.plays >= 1 },
      { id: 'boss_clear', label: '👑 Boss Clear', test: (r) => r.bossClear },
      { id: 'rage_clear', label: '🔥 Rage Clear', test: (r) => r.bossClear && r.rage },
      { id: 'streak_8', label: '✨ Combo 8', test: (r) => r.bestStreak >= 8 },
      { id: 'streak_12', label: '🌟 Combo 12', test: (r) => r.bestStreak >= 12 },
      { id: 'score_200', label: '🥗 Score 200', test: (r) => r.score >= 200 },
      { id: 'score_300', label: '🏆 Score 300', test: (r) => r.score >= 300 },
      { id: 'grade_a', label: '🥇 Grade A', test: (r) => gradeRank(r.grade) >= gradeRank('A') },
      { id: 'grade_s', label: '💎 Grade S', test: (r) => r.grade === 'S' },
      { id: 'clean_clear', label: '🛡️ Clean Clear', test: (r) => r.bossClear && r.miss <= 3 }
    ];
  }

  function computeMetaProgress(result) {
    const prev = readMeta();
    const meta = {
      ...prev,
      plays: prev.plays + 1,
      bossClears: prev.bossClears + (result.bossClear ? 1 : 0),
      rageClears: prev.rageClears + (result.bossClear && result.rage ? 1 : 0),
      bestScore: Math.max(prev.bestScore, result.score),
      bestStreak: Math.max(prev.bestStreak, result.bestStreak),
      bestGrade: gradeRank(result.grade) > gradeRank(prev.bestGrade) ? result.grade : prev.bestGrade,
      badges: Array.isArray(prev.badges) ? prev.badges.slice() : [],
      lastPlayedAt: Date.now()
    };

    const unlockedNow = [];
    badgeCatalog().forEach((badge) => {
      if (meta.badges.includes(badge.id)) return;
      const ok = badge.test({ ...result, meta });
      if (ok) {
        meta.badges.push(badge.id);
        unlockedNow.push(badge);
      }
    });

    writeMeta(meta);

    return {
      previous: prev,
      current: meta,
      unlockedNow,
      newBestScore: result.score > prev.bestScore,
      newBestStreak: result.bestStreak > prev.bestStreak,
      newBestGrade: gradeRank(result.grade) > gradeRank(prev.bestGrade)
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
    } catch {}
  }

  function playSfx(kind) {
    if (kind === 'good') {
      playTone(720, 0.05, 'triangle', 0.018);
      setTimeout(() => playTone(900, 0.05, 'triangle', 0.014), 35);
      return;
    }
    if (kind === 'bad') {
      playTone(210, 0.08, 'sawtooth', 0.018);
      return;
    }
    if (kind === 'phase-up') {
      playTone(520, 0.08, 'triangle', 0.022);
      setTimeout(() => playTone(720, 0.08, 'triangle', 0.02), 90);
      setTimeout(() => playTone(980, 0.10, 'triangle', 0.022), 180);
      return;
    }
    if (kind === 'telegraph') {
      playTone(340, 0.08, 'square', 0.018);
      setTimeout(() => playTone(340, 0.08, 'square', 0.018), 120);
      return;
    }
    if (kind === 'boss-hit') {
      playTone(560, 0.06, 'square', 0.02);
      setTimeout(() => playTone(780, 0.07, 'triangle', 0.018), 40);
      return;
    }
    if (kind === 'boss-break') {
      playTone(520, 0.07, 'square', 0.024);
      setTimeout(() => playTone(760, 0.09, 'triangle', 0.02), 45);
      setTimeout(() => playTone(990, 0.09, 'triangle', 0.018), 95);
      return;
    }
    if (kind === 'boss-clear') {
      playTone(784, 0.10, 'triangle', 0.03);
      setTimeout(() => playTone(988, 0.12, 'triangle', 0.03), 110);
      setTimeout(() => playTone(1174, 0.16, 'triangle', 0.032), 240);
    }
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${ROOT_ID}{
        position:absolute; inset:0; overflow:hidden;
        font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
        color:#fff;
      }

      .gjsb-stage{
        position:absolute; inset:0;
        overflow:hidden;
        background:
          radial-gradient(circle at 20% 16%, rgba(255,255,255,.12), transparent 18%),
          radial-gradient(circle at 82% 10%, rgba(255,255,255,.10), transparent 18%),
          linear-gradient(180deg,#93d9ff 0%, #ccefff 54%, #fff3c9 100%);
      }

      .gjsb-ground{
        position:absolute; left:0; right:0; bottom:0; height:18%;
        background:linear-gradient(180deg,#9be26a,#67c94c);
        box-shadow:inset 0 4px 0 rgba(255,255,255,.25);
      }

      .gjsb-cloud{
        position:absolute; width:110px; height:34px; border-radius:999px;
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

      .gjsb-flash{
        position:absolute; inset:0; z-index:42; pointer-events:none;
        background:radial-gradient(circle at 50% 32%, rgba(255,255,255,.82), rgba(255,255,255,0) 60%);
        opacity:0;
      }
      .gjsb-flash.show{ animation:gjsbFlash .55s ease; }
      @keyframes gjsbFlash{
        0%{ opacity:0; }
        18%{ opacity:1; }
        100%{ opacity:0; }
      }

      .gjsb-shake{ animation:gjsbShake .22s linear 1; }
      @keyframes gjsbShake{
        0%{ transform:translate3d(0,0,0); }
        20%{ transform:translate3d(-6px, 2px, 0); }
        40%{ transform:translate3d(6px, -2px, 0); }
        60%{ transform:translate3d(-4px, 1px, 0); }
        80%{ transform:translate3d(4px, -1px, 0); }
        100%{ transform:translate3d(0,0,0); }
      }

      .gjsb-topHud{
        position:absolute;
        left:8px;
        right:8px;
        top:8px;
        z-index:30;
        pointer-events:none;
        display:grid;
        gap:4px;
        --boss-reserve:0px;
      }

      .gjsb-bar{
        display:grid;
        grid-template-columns:repeat(5,minmax(0,1fr));
        gap:4px;
        align-items:center;
      }

      .gjsb-pill{
        min-height:28px;
        padding:5px 8px;
        border-radius:999px;
        background:rgba(255,255,255,.88);
        color:#55514a;
        box-shadow:0 6px 12px rgba(86,155,194,.10);
        border:2px solid rgba(191,227,242,.95);
        font-size:10px;
        font-weight:1000;
        pointer-events:auto;
        text-align:center;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .gjsb-pill.big{
        min-height:30px;
        font-size:11px;
      }

      .gjsb-banner{
        position:absolute;
        left:50%;
        top:34px;
        transform:translateX(-50%);
        width:min(76vw,320px);
        margin:0;
        padding:7px 10px;
        border-radius:14px;
        background:rgba(255,255,255,.92);
        color:#5e5a52;
        border:2px solid rgba(191,227,242,.95);
        box-shadow:0 8px 16px rgba(86,155,194,.10);
        text-align:center;
        font-size:11px;
        line-height:1.25;
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
        top:66px;
        transform:translateX(-50%);
        width:min(80vw,340px);
        padding:7px 10px;
        border-radius:14px;
        background:linear-gradient(180deg,#fff2f2,#ffffff);
        color:#a6461c;
        border:2px solid #ffd1c2;
        box-shadow:0 8px 16px rgba(86,155,194,.10);
        text-align:center;
        font-size:11px;
        line-height:1.25;
        font-weight:1000;
        animation:gjsbTelegraphPulse .55s ease-in-out infinite;
        z-index:32;
      }
      .gjsb-telegraph.show{ display:block; }

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
        box-shadow:0 6px 12px rgba(86,155,194,.08);
      }
      .gjsb-progressFill{
        height:100%;
        width:100%;
        transform-origin:left center;
        background:linear-gradient(90deg,#7fcfff,#7ed957);
        transition:transform .1s linear;
      }

      .gjsb-topHud.has-boss .gjsb-progressWrap{
        width:calc(100% - var(--boss-reserve));
        max-width:calc(100% - var(--boss-reserve));
      }

      .gjsb-boss{
        position:absolute;
        right:8px;
        top:52px;
        z-index:28;
        width:min(180px,46vw);
        display:none;
        transition:top .18s ease, right .18s ease, width .18s ease, transform .18s ease;
      }
      .gjsb-boss.show{ display:block; }

      .gjsb-boss-card{
        border-radius:18px;
        background:linear-gradient(180deg,#fffdf4,#fff7da);
        border:3px solid rgba(255,212,92,.95);
        box-shadow:0 10px 18px rgba(86,155,194,.12);
        padding:8px 9px;
        color:#5e5a52;
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
        line-height:1.02;
      }

      .gjsb-boss-sub{
        margin-top:3px;
        font-size:10px;
        line-height:1.2;
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

      .gjsb-rageBadge,
      .gjsb-adaptiveBadge{
        display:none;
        margin-top:8px;
        align-items:center;
        justify-content:center;
        padding:6px 10px;
        border-radius:999px;
        font-size:11px;
        font-weight:1000;
      }
      .gjsb-rageBadge{
        background:#fff0f0;
        border:2px solid #ffc6c6;
        color:#b3472d;
      }
      .gjsb-rageBadge.show{ display:inline-flex; }
      .gjsb-adaptiveBadge{
        background:#f6fbff;
        border:2px solid #d7edf7;
        color:#5e7d90;
      }
      .gjsb-adaptiveBadge.show{ display:inline-flex; }
      .gjsb-adaptiveBadge.assist{ background:#eefcf0; border-color:#cdebcf; color:#3f7b48; }
      .gjsb-adaptiveBadge.steady{ background:#f6fbff; border-color:#d7edf7; color:#5e7d90; }
      .gjsb-adaptiveBadge.sharp{ background:#fff2e8; border-color:#ffd6b8; color:#a85a1a; }

      .gjsb-boss-bar{
        margin-top:10px;
        height:14px;
        border-radius:999px;
        overflow:hidden;
        background:#eef4f7;
        border:2px solid #d9eaf5;
      }
      .gjsb-boss-fill{
        height:100%; width:100%;
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
      .gjsb-item.storm{ background:linear-gradient(180deg,#fff3f3,#ffffff); border-color:#ffd3d3; }
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

      @keyframes gjsbFx{
        from{ opacity:1; transform:translate(-50%,-10%); }
        to{ opacity:0; transform:translate(-50%,-150%); }
      }

      .gjsb-dangerEdge{
        position:absolute; inset:0; z-index:41; pointer-events:none;
        box-shadow:inset 0 0 0 0 rgba(255,84,84,0);
        opacity:0;
      }
      .gjsb-dangerEdge.show{ animation:gjsbDangerPulse .5s ease-in-out infinite; }
      @keyframes gjsbDangerPulse{
        0%,100%{ opacity:.25; box-shadow:inset 0 0 0 0 rgba(255,84,84,0); }
        50%{ opacity:1; box-shadow:inset 0 0 0 10px rgba(255,120,120,.28), inset 0 0 40px 18px rgba(255,86,86,.18); }
      }

      .gjsb-hitstop{ animation:gjsbHitstop .085s steps(2,end) 1; }
      @keyframes gjsbHitstop{
        0%{ transform:scale(1); filter:brightness(1); }
        50%{ transform:scale(1.012); filter:brightness(1.08); }
        100%{ transform:scale(1); filter:brightness(1); }
      }

      .gjsb-boss-card.hit{ animation:gjsbBossHit .18s ease 1; }
      @keyframes gjsbBossHit{
        0%{ transform:scale(1); box-shadow:0 12px 24px rgba(86,155,194,.14); }
        50%{ transform:scale(1.04); box-shadow:0 0 0 6px rgba(255,180,90,.22), 0 12px 30px rgba(86,155,194,.22); }
        100%{ transform:scale(1); box-shadow:0 12px 24px rgba(86,155,194,.14); }
      }

      .gjsb-boss-icon.hit{ animation:gjsbBossIconHit .18s ease 1; }
      @keyframes gjsbBossIconHit{
        0%{ transform:scale(1) rotate(0deg); }
        30%{ transform:scale(1.12) rotate(-7deg); }
        60%{ transform:scale(1.06) rotate(6deg); }
        100%{ transform:scale(1) rotate(0deg); }
      }

      .gjsb-boss-fill.hit{ animation:gjsbBossBarHit .24s ease 1; }
      @keyframes gjsbBossBarHit{
        0%{ filter:brightness(1); }
        50%{ filter:brightness(1.35) saturate(1.18); }
        100%{ filter:brightness(1); }
      }

      .gjsb-camPunch{ animation:gjsbCamPunch .18s ease 1; }
      @keyframes gjsbCamPunch{
        0%{ transform:scale(1) translate3d(0,0,0); filter:brightness(1); }
        40%{ transform:scale(1.035) translate3d(0,-4px,0); filter:brightness(1.08); }
        100%{ transform:scale(1) translate3d(0,0,0); filter:brightness(1); }
      }

      .gjsb-camKill{ animation:gjsbCamKill .42s ease 1; }
      @keyframes gjsbCamKill{
        0%{ transform:scale(1); filter:brightness(1); }
        35%{ transform:scale(1.06); filter:brightness(1.16); }
        100%{ transform:scale(1.02); filter:brightness(1.04); }
      }

      .gjsb-killGlow{
        position:absolute; inset:0; z-index:57; pointer-events:none;
        background:radial-gradient(circle at 50% 42%, rgba(255,245,180,.78), rgba(255,255,255,0) 62%);
        opacity:0;
      }
      .gjsb-killGlow.show{ animation:gjsbKillGlow .7s ease 1; }
      @keyframes gjsbKillGlow{
        0%{ opacity:0; }
        20%{ opacity:1; }
        100%{ opacity:0; }
      }

      .gjsb-victoryBurst{
        position:absolute; inset:0; z-index:58; pointer-events:none;
      }

      .gjsb-burstFx{
        position:absolute;
        left:0; top:0;
        transform:translate(-50%,-50%);
        font-size:28px;
        line-height:1;
        pointer-events:none;
        animation:gjsbBurstFly 950ms cubic-bezier(.2,.7,.2,1) forwards;
        filter:drop-shadow(0 8px 16px rgba(0,0,0,.18));
      }
      @keyframes gjsbBurstFly{
        0%{ opacity:0; transform:translate(-50%,-50%) scale(.3); }
        10%{ opacity:1; transform:translate(calc(-50% + var(--dx,0px) * .12), calc(-50% + var(--dy,0px) * .12)) scale(1); }
        100%{ opacity:0; transform:translate(calc(-50% + var(--dx,0px)), calc(-50% + var(--dy,0px))) scale(.92); }
      }

      .gjsb-presentation{
        position:absolute; inset:0; z-index:54; pointer-events:none;
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
        width:96px; height:96px;
        border-radius:28px;
        display:grid; place-items:center;
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

      .gjsb-summary{
        position:absolute; inset:0; z-index:60;
        display:none; place-items:center;
        background:rgba(255,255,255,.30);
        backdrop-filter:blur(4px);
        padding:16px;
      }
      .gjsb-summary.show{ display:grid; }

      .gjsb-summary-card{
        position:relative;
        width:min(94vw,760px);
        max-height:88vh;
        overflow:auto;
        border-radius:28px;
        background:linear-gradient(180deg,#fffef8,#f8fff3);
        border:4px solid #bfe3f2;
        box-shadow:0 18px 36px rgba(86,155,194,.18);
        padding:18px;
        color:#55514a;
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

      .gjsb-summary-head{
        text-align:center;
        margin-bottom:14px;
      }

      .gjsb-summary-avatar{
        margin:12px auto 8px;
        width:92px; height:92px;
        border-radius:28px;
        display:grid; place-items:center;
        background:linear-gradient(180deg,#fff8d5,#fffef4);
        border:4px solid #d7edf7;
        font-size:44px;
        box-shadow:0 10px 20px rgba(86,155,194,.12);
      }

      .gjsb-medal{
        margin:10px auto 0;
        width:110px; height:110px;
        border-radius:32px;
        display:grid; place-items:center;
        font-size:50px;
        background:linear-gradient(180deg,#fff8d8,#fffef6);
        border:4px solid #d7edf7;
        box-shadow:0 12px 24px rgba(86,155,194,.14);
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

      .gjsb-stars{ font-size:30px; line-height:1; margin:10px 0 6px; }

      .gjsb-summary-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:10px;
      }

      .gjsb-stat{
        border-radius:18px;
        background:#fff;
        border:3px solid #d7edf7;
        padding:12px;
      }
      .gjsb-stat .k{
        font-size:12px; color:#7b7a72; font-weight:1000;
      }
      .gjsb-stat .v{
        margin-top:6px; font-size:28px; font-weight:1000;
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
      }
      .gjsb-coach strong{ color:#7b4d18; }

      .gjsb-actions{
        display:grid;
        gap:10px;
        margin-top:16px;
      }

      .gjsb-btn{
        border:none; border-radius:18px; padding:14px 16px;
        font-size:16px; font-weight:1000; cursor:pointer;
      }
      .gjsb-btn.replay{ background:linear-gradient(180deg,#7ed957,#58c33f); color:#173b0b; }
      .gjsb-btn.cooldown{ background:linear-gradient(180deg,#7fcfff,#58b7f5); color:#08374d; }
      .gjsb-btn.hub{ background:#fff; color:#6c6a61; border:3px solid #d7edf7; }

      .gjsb-btnSparkle{
        position:absolute;
        transform:translate(-50%,-50%);
        font-size:16px;
        line-height:1;
        pointer-events:none;
        z-index:80;
        animation:gjsbBtnSparkle 650ms ease forwards;
        filter:drop-shadow(0 6px 12px rgba(0,0,0,.15));
      }
      @keyframes gjsbBtnSparkle{
        0%{ opacity:0; transform:translate(-50%,-50%) scale(.4); }
        20%{ opacity:1; transform:translate(-50%,-50%) scale(1); }
        100%{ opacity:0; transform:translate(calc(-50% + var(--dx,0px)), calc(-50% + var(--dy,0px))) scale(.85); }
      }

      .gjsb-topHud.dim .gjsb-bar,
      .gjsb-topHud.dim .gjsb-progressWrap{
        opacity:.22;
      }

      .gjsb-topHud.dim .gjsb-banner:not(.showing),
      .gjsb-topHud.dim .gjsb-telegraph:not(.show),
      .gjsb-topHud.dim .gjsb-praise:not(.show){
        opacity:0;
      }

      .gjsb-topHud .gjsb-bar,
      .gjsb-topHud .gjsb-progressWrap,
      .gjsb-topHud .gjsb-banner,
      .gjsb-topHud .gjsb-telegraph,
      .gjsb-topHud .gjsb-praise{
        transition:opacity .22s ease, transform .22s ease;
      }

      .gjsb-boss.mini .gjsb-boss-card{
        padding:5px 6px;
        border-radius:14px;
      }
      .gjsb-boss.mini .gjsb-boss-head{
        grid-template-columns:24px 1fr;
        gap:4px;
      }
      .gjsb-boss.mini .gjsb-boss-icon{
        width:24px;
        height:24px;
        font-size:14px;
        border-radius:9px;
      }
      .gjsb-boss.mini .gjsb-boss-title{
        font-size:11px;
      }
      .gjsb-boss.mini .gjsb-boss-sub,
      .gjsb-boss.mini .gjsb-boss-stage,
      .gjsb-boss.mini .gjsb-patternChip,
      .gjsb-boss.mini .gjsb-rageBadge,
      .gjsb-boss.mini .gjsb-adaptiveBadge{
        display:none !important;
      }
      .gjsb-boss.mini .gjsb-boss-bar{
        margin-top:6px;
        height:10px;
      }
      .gjsb-boss.mini .gjsb-boss-hp{
        margin-top:3px;
        font-size:9px;
      }

      .gjsb-topHud.mobile-narrow .gjsb-bar{
        grid-template-columns:repeat(5,minmax(0,1fr));
      }

      .gjsb-topHud.boss-compact .gjsb-bar{
        grid-template-columns:repeat(2,minmax(0,1fr));
      }
      .gjsb-topHud.boss-compact .gjsb-pill.low{
        display:none !important;
      }
      .gjsb-topHud.boss-compact .gjsb-pill.high{
        min-height:30px;
        font-size:11px;
      }
      .gjsb-topHud.boss-compact .gjsb-progressWrap{
        height:7px;
      }
      .gjsb-topHud.boss-compact .gjsb-banner{
        width:min(72vw,280px);
        top:30px;
      }
      .gjsb-topHud.boss-compact .gjsb-telegraph{
        width:min(78vw,300px);
        top:56px;
      }
      .gjsb-topHud.boss-compact .gjsb-praise{
        max-width:min(56vw,180px);
        font-size:10px;
        padding:6px 8px;
      }

      .gjsb-topHud.boss-minimal .gjsb-bar{
        display:none !important;
      }
      .gjsb-topHud.boss-minimal .gjsb-banner,
      .gjsb-topHud.boss-minimal .gjsb-praise{
        opacity:0 !important;
        pointer-events:none !important;
      }
      .gjsb-topHud.boss-minimal{
        gap:2px;
      }
      .gjsb-topHud.boss-minimal .gjsb-progressWrap{
        position:absolute;
        left:6px;
        right:72px;
        top:4px;
        height:6px;
        border-width:1px;
        opacity:.92 !important;
        width:auto !important;
        max-width:none !important;
      }

      .gjsb-boss.minicore{
        top:4px !important;
        right:6px !important;
        width:88px !important;
      }
      .gjsb-boss.minicore .gjsb-boss-card{
        padding:4px 5px !important;
        border-radius:12px !important;
        border-width:2px !important;
      }
      .gjsb-boss.minicore .gjsb-boss-head{
        grid-template-columns:20px 1fr !important;
        gap:4px !important;
      }
      .gjsb-boss.minicore .gjsb-boss-icon{
        width:20px !important;
        height:20px !important;
        font-size:12px !important;
        border-radius:7px !important;
        border-width:2px !important;
      }
      .gjsb-boss.minicore .gjsb-boss-title,
      .gjsb-boss.minicore .gjsb-boss-sub,
      .gjsb-boss.minicore .gjsb-boss-stage,
      .gjsb-boss.minicore .gjsb-patternChip,
      .gjsb-boss.minicore .gjsb-rageBadge,
      .gjsb-boss.minicore .gjsb-adaptiveBadge{
        display:none !important;
      }
      .gjsb-boss.minicore .gjsb-boss-bar{
        margin-top:4px !important;
        height:8px !important;
        border-width:1px !important;
      }
      .gjsb-boss.minicore .gjsb-boss-hp{
        margin-top:2px !important;
        font-size:8px !important;
        line-height:1 !important;
      }

      .gjsb-boss-card.rage{
        border-color:#ffb0a2;
        box-shadow:0 12px 24px rgba(86,155,194,.14), 0 0 0 6px rgba(255,120,120,.12);
        animation:gjsbRagePulse .8s ease-in-out infinite;
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

      @media (max-width:720px){
        .gjsb-topHud{
          top:6px;
          left:6px;
          right:6px;
          gap:4px;
        }

        .gjsb-bar{
          grid-template-columns:repeat(5,minmax(0,1fr));
          gap:4px;
        }

        .gjsb-pill{
          min-height:27px;
          padding:4px 6px;
          font-size:10px;
        }

        .gjsb-pill.big{
          min-height:28px;
          font-size:10px;
        }

        .gjsb-banner{
          top:32px;
          width:min(76vw,300px);
          padding:6px 9px;
          font-size:10px;
        }

        .gjsb-telegraph{
          top:60px;
          width:min(80vw,312px);
          padding:6px 9px;
          font-size:10px;
        }

        .gjsb-boss{
          top:46px;
          right:6px;
          width:min(168px,45vw);
        }

        .gjsb-boss-card{
          padding:8px;
        }

        .gjsb-boss-head{
          grid-template-columns:36px 1fr;
          gap:6px;
        }

        .gjsb-boss-icon{
          width:36px;
          height:36px;
          font-size:20px;
          border-radius:12px;
        }

        .gjsb-boss-title{
          font-size:13px;
        }

        .gjsb-boss-sub{
          font-size:9px;
        }

        .gjsb-item .gjsb-emoji{
          font-size:26px;
        }

        .gjsb-topHud.boss-compact .gjsb-banner{
          width:min(70vw,260px);
          font-size:10px;
          padding:6px 8px;
        }

        .gjsb-topHud.boss-compact .gjsb-telegraph{
          width:min(78vw,286px);
          font-size:10px;
          padding:6px 8px;
        }

        .gjsb-topHud.boss-minimal .gjsb-progressWrap{
          left:6px;
          right:70px;
          top:4px;
          height:6px;
        }
      }

      @media (max-width:720px){
        .gjsb-summary-grid{ grid-template-columns:1fr; }
      }
    `;
    document.head.appendChild(s);
  }

  function buildUI() {
    mount.innerHTML = `
      <div id="${ROOT_ID}">
        <div class="gjsb-stage" id="gjsbStage">
          <div class="gjsb-cloud c1"></div>
          <div class="gjsb-cloud c2"></div>
          <div class="gjsb-cloud c3"></div>
          <div class="gjsb-ground"></div>

          <div class="gjsb-flash" id="hudFlash"></div>
          <div class="gjsb-dangerEdge" id="dangerEdge"></div>
          <div class="gjsb-killGlow" id="killGlow"></div>
          <div class="gjsb-victoryBurst" id="victoryBurst"></div>

          <div class="gjsb-topHud">
            <div class="gjsb-bar">
              <div class="gjsb-pill big high" id="hudScore">Score • 0</div>
              <div class="gjsb-pill high" id="hudTime">Time • 0:00</div>
              <div class="gjsb-pill low" id="hudMiss">Miss • 0</div>
              <div class="gjsb-pill low" id="hudStreak">Streak • 0</div>
              <div class="gjsb-pill low" id="hudPhase">Phase • 1</div>
            </div>

            <div class="gjsb-banner" id="hudBanner">เก็บอาหารดี หลีกเลี่ยง junk แล้วไปสู้กับ Junk King!</div>
            <div class="gjsb-praise" id="hudPraise">Nice Combo!</div>
            <div class="gjsb-telegraph" id="hudTelegraph">⚠️ ระวัง! Junk Storm กำลังมา</div>

            <div class="gjsb-progressWrap">
              <div class="gjsb-progressFill" id="hudProgress"></div>
            </div>
          </div>

          <div class="gjsb-boss" id="bossWrap">
            <div class="gjsb-boss-card">
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
              <div class="gjsb-adaptiveBadge steady" id="bossAdaptiveBadge">⚖️ Adaptive • Steady</div>

              <div class="gjsb-boss-bar">
                <div class="gjsb-boss-fill" id="bossHpFill"></div>
              </div>
              <div class="gjsb-boss-hp" id="bossHpText">HP 0 / 0</div>
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

          <div class="gjsb-summary" id="summary">
            <div class="gjsb-summary-card">
              <div class="gjsb-summary-head">
                <div class="gjsb-summary-ribbon">GOODJUNK SOLO BOSS v5</div>
                <div class="gjsb-summary-avatar" id="sumAvatar">😊</div>
                <div class="gjsb-medal" id="sumMedal">🥈</div>
                <div class="gjsb-grade b" id="sumGrade">B</div>
                <h2 id="sumTitle" style="margin:8px 0 0;font-size:38px;line-height:1.05;color:#67a91c;">Great Job!</h2>
                <div id="sumSub" style="margin-top:6px;font-size:15px;color:#7b7a72;font-weight:1000;">มาดูผลการเล่นรอบนี้กัน</div>
                <div class="gjsb-stars" id="sumStars">⭐</div>
              </div>

              <div class="gjsb-summary-grid" id="sumGrid"></div>

              <div class="gjsb-coach" id="sumCoach">วันนี้ทำได้ดีมาก ลองเก็บอาหารดีต่อเนื่อง และระวัง junk ให้มากขึ้นนะ</div>
              <div class="gjsb-coach" id="sumMetaBox" style="display:none;"><div id="sumMetaText">New Record</div></div>
              <div class="gjsb-coach" id="sumBadgeBox" style="display:none;"><div id="sumBadgeText">New Badge</div></div>

              <div class="gjsb-actions">
                <button class="gjsb-btn replay" id="btnReplay">🔁 เล่นใหม่</button>
                <button class="gjsb-btn cooldown" id="btnCooldown">🧊 ไป Cooldown</button>
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
      topHud: document.querySelector('.gjsb-topHud'),
      banner: document.getElementById('hudBanner'),
      praise: document.getElementById('hudPraise'),
      telegraph: document.getElementById('hudTelegraph'),
      progress: document.getElementById('hudProgress'),
      flash: document.getElementById('hudFlash'),
      dangerEdge: document.getElementById('dangerEdge'),
      killGlow: document.getElementById('killGlow'),
      victoryBurst: document.getElementById('victoryBurst'),

      score: document.getElementById('hudScore'),
      time: document.getElementById('hudTime'),
      miss: document.getElementById('hudMiss'),
      streak: document.getElementById('hudStreak'),
      phase: document.getElementById('hudPhase'),

      bossWrap: document.getElementById('bossWrap'),
      bossIcon: document.getElementById('bossIcon'),
      bossPatternText: document.getElementById('bossPatternText'),
      bossStageText: document.getElementById('bossStageText'),
      bossPatternChip: document.getElementById('bossPatternChip'),
      bossRageBadge: document.getElementById('bossRageBadge'),
      bossAdaptiveBadge: document.getElementById('bossAdaptiveBadge'),
      bossHpText: document.getElementById('bossHpText'),
      bossHpFill: document.getElementById('bossHpFill'),

      presentationLayer: document.getElementById('presentationLayer'),
      bossIntroCard: document.getElementById('bossIntroCard'),
      bossIntroIcon: document.getElementById('bossIntroIcon'),
      bossIntroSub: document.getElementById('bossIntroSub'),

      patternBanner: document.getElementById('patternBanner'),
      patternBannerKicker: document.getElementById('patternBannerKicker'),
      patternBannerIcon: document.getElementById('patternBannerIcon'),
      patternBannerTitle: document.getElementById('patternBannerTitle'),
      patternBannerSub: document.getElementById('patternBannerSub'),

      summary: document.getElementById('summary'),
      sumAvatar: document.getElementById('sumAvatar'),
      sumMedal: document.getElementById('sumMedal'),
      sumGrade: document.getElementById('sumGrade'),
      sumTitle: document.getElementById('sumTitle'),
      sumSub: document.getElementById('sumSub'),
      sumStars: document.getElementById('sumStars'),
      sumGrid: document.getElementById('sumGrid'),
      sumCoach: document.getElementById('sumCoach'),
      sumMetaBox: document.getElementById('sumMetaBox'),
      sumMetaText: document.getElementById('sumMetaText'),
      sumBadgeBox: document.getElementById('sumBadgeBox'),
      sumBadgeText: document.getElementById('sumBadgeText'),

      btnReplay: document.getElementById('btnReplay'),
      btnCooldown: document.getElementById('btnCooldown'),
      btnHub: document.getElementById('btnHub')
    };
  }

  function fx(x, y, text, color) {
    const el = document.createElement('div');
    el.className = 'gjsb-fx';
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.color = color || '#333';
    ui.stage.appendChild(el);
    setTimeout(() => el.remove(), 760);
  }

  function markBannerVisible(on) {
    if (!ui.banner) return;
    ui.banner.classList.toggle('showing', !!on);
  }

  function wakeHud(ms) {
    state.hudAwakeMs = Math.max(state.hudAwakeMs || 0, ms || 1800);

    if (ui.topHud) ui.topHud.classList.remove('dim');
    if (ui.bossWrap) {
      ui.bossWrap.classList.remove('mini');
      ui.bossWrap.classList.remove('minicore');
    }
  }

  function setBanner(text, autoHide) {
    wakeHud(autoHide ? Math.max(1100, autoHide) : 1400);

    ui.banner.textContent = text;
    ui.banner.classList.remove('hide');
    markBannerVisible(true);
    layoutInnerHud();

    if (autoHide) {
      setTimeout(() => {
        ui.banner.classList.add('hide');
        markBannerVisible(false);
        layoutInnerHud();
      }, autoHide);
    }
  }

  function phaseFlash() {
    ui.flash.classList.remove('show');
    void ui.flash.offsetWidth;
    ui.flash.classList.add('show');
  }

  function stageShake() {
    ui.stage.classList.remove('gjsb-shake');
    void ui.stage.offsetWidth;
    ui.stage.classList.add('gjsb-shake');
  }

  function showTelegraph(text, ms) {
    wakeHud((ms || 800) + 700);

    ui.telegraph.textContent = text;
    ui.telegraph.classList.add('show');
    playSfx('telegraph');
    layoutInnerHud();

    setTimeout(() => {
      ui.telegraph.classList.remove('show');
      layoutInnerHud();
    }, ms || 800);
  }

  function hitstop(ms) {
    ui.stage.classList.remove('gjsb-hitstop');
    void ui.stage.offsetWidth;
    ui.stage.classList.add('gjsb-hitstop');
    setTimeout(() => ui.stage.classList.remove('gjsb-hitstop'), ms || 85);
  }

  function pulseBossHit() {
    wakeHud(1200);

    const bossCard = ui.bossWrap && ui.bossWrap.querySelector('.gjsb-boss-card');
    if (bossCard) {
      bossCard.classList.remove('hit');
      void bossCard.offsetWidth;
      bossCard.classList.add('hit');
      setTimeout(() => bossCard.classList.remove('hit'), 240);
    }

    if (ui.bossIcon) {
      ui.bossIcon.classList.remove('hit');
      void ui.bossIcon.offsetWidth;
      ui.bossIcon.classList.add('hit');
      setTimeout(() => ui.bossIcon.classList.remove('hit'), 220);
    }

    if (ui.bossHpFill) {
      ui.bossHpFill.classList.remove('hit');
      void ui.bossHpFill.offsetWidth;
      ui.bossHpFill.classList.add('hit');
      setTimeout(() => ui.bossHpFill.classList.remove('hit'), 260);
    }
  }

  function showDangerEdge(ms) {
    state.boss.dangerMs = Math.max(state.boss.dangerMs, ms || 600);
    if (ui.dangerEdge) ui.dangerEdge.classList.add('show');
  }

  function updateDangerEdge(dt) {
    if (!ui.dangerEdge) return;

    state.boss.dangerMs = Math.max(0, state.boss.dangerMs - dt);

    const shouldShow =
      state.boss.dangerMs > 0 ||
      (state.boss.active && state.boss.stage === 'C' && state.boss.pattern === 'storm') ||
      (state.boss.active && state.boss.telegraphOn && state.boss.pattern === 'storm');

    if (shouldShow) ui.dangerEdge.classList.add('show');
    else ui.dangerEdge.classList.remove('show');
  }

  function camPunch(kind) {
    if (!ui.stage) return;

    const cls = kind === 'kill' ? 'gjsb-camKill' : 'gjsb-camPunch';
    ui.stage.classList.remove('gjsb-camPunch', 'gjsb-camKill');
    void ui.stage.offsetWidth;
    ui.stage.classList.add(cls);

    setTimeout(() => {
      ui.stage.classList.remove(cls);
    }, kind === 'kill' ? 430 : 200);
  }

  function showKillGlow() {
    if (!ui.killGlow) return;
    ui.killGlow.classList.remove('show');
    void ui.killGlow.offsetWidth;
    ui.killGlow.classList.add('show');
    setTimeout(() => ui.killGlow.classList.remove('show'), 720);
  }

  function spawnVictoryBurst(x, y, count) {
    if (!ui.victoryBurst) return;

    const pool = ['⭐', '✨', '🥕', '🍎', '🥦', '🎉', '💥', '🍌'];
    for (let i = 0; i < (count || 16); i++) {
      const el = document.createElement('div');
      el.className = 'gjsb-burstFx';
      el.textContent = pool[Math.floor(rand() * pool.length)];
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.setProperty('--dx', range(-180, 180) + 'px');
      el.style.setProperty('--dy', range(-160, 120) + 'px');
      el.style.fontSize = range(22, 36) + 'px';
      ui.victoryBurst.appendChild(el);
      setTimeout(() => el.remove(), 980);
    }
  }

  function startKillSequence(x, y) {
    if (state.boss.killSequence || state.ended) return;
    state.boss.killSequence = true;
    state.running = false;

    wakeHud(3200);
    playSfx('boss-clear');
    hitstop(120);
    phaseFlash();
    camPunch('kill');
    pulseBossHit();
    showKillGlow();
    showDangerEdge(900);
    stageShake();
    spawnVictoryBurst(x, y, 18);
    setBanner('ชนะแล้ว! Junk King แพ้แล้ว!', 1200);

    setTimeout(() => {
      endGame(true);
    }, 420);
  }

  function lockPresentation(ms) {
    state.presentationLockMs = Math.max(state.presentationLockMs, ms || 700);
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

    setTimeout(() => {
      state.boss.introShowing = false;
      ui.bossIntroCard.classList.remove('show');
    }, 760);
  }

  function showPatternBanner(pattern) {
    if (!ui.patternBanner || state.ended) return;

    wakeHud(1600);

    const title = getPatternLabel(pattern);
    const sub = getPatternSubtitle(pattern);
    const icon = pattern === 'break' ? '💥' : pattern === 'storm' ? '🌪️' : '🎯';
    const kicker = pattern === 'break' ? '🛡️ ARMOR BREAK' : pattern === 'storm' ? '⚠️ JUNK STORM RAGE' : '🎯 TARGET HUNT';

    ui.patternBanner.className = 'gjsb-patternBanner ' + pattern;
    ui.patternBannerKicker.textContent = kicker;
    ui.patternBannerIcon.textContent = icon;
    ui.patternBannerTitle.textContent = title;
    ui.patternBannerSub.textContent = sub;

    ui.patternBanner.classList.remove('show');
    void ui.patternBanner.offsetWidth;
    ui.patternBanner.classList.add('show');

    const hold =
      state.boss.adaptiveMode === 'sharp'
        ? (pattern === 'storm' ? 760 : 660)
        : state.boss.adaptiveMode === 'assist'
          ? (pattern === 'storm' ? 620 : 520)
          : (pattern === 'storm' ? 720 : 620);

    lockPresentation(hold);

    setTimeout(() => {
      ui.patternBanner.classList.remove('show');
    }, 760);
  }

  function calcGrade(bossClear) {
    if (bossClear && state.miss <= 3 && state.bestStreak >= 10) return 'S';
    if (bossClear || (state.score >= cfg.p2Goal && state.miss <= 8)) return 'A';
    if (state.score >= cfg.p1Goal || state.boss.active) return 'B';
    return 'C';
  }

  function medalEmojiForGrade(grade) {
    if (grade === 'S') return '🏆';
    if (grade === 'A') return '🥇';
    if (grade === 'B') return '🥈';
    return '🥉';
  }

  function pulseScoreHud() {
    if (!ui.score) return;
    ui.score.classList.remove('score-pop');
    void ui.score.offsetWidth;
    ui.score.classList.add('score-pop');
    setTimeout(() => ui.score.classList.remove('score-pop'), 300);
  }

  function streakPraiseText(streak) {
    if (streak >= 12) return '🌟 Super Hero!';
    if (streak >= 8) return '🔥 Awesome Combo!';
    if (streak >= 5) return '✨ Great Combo!';
    if (streak >= 3) return '👍 Nice Combo!';
    return '';
  }

  function showPraise(text, ms) {
    if (!ui.praise || !text) return;

    wakeHud((ms || 760) + 260);

    ui.praise.textContent = text;
    ui.praise.classList.remove('show');
    void ui.praise.offsetWidth;
    ui.praise.classList.add('show');
    state.praiseMs = Math.max(state.praiseMs, ms || 760);

    setTimeout(() => {
      if (ui.praise) ui.praise.classList.remove('show');
    }, ms || 760);
  }

  function maybePraiseStreak() {
    const text = streakPraiseText(state.streak);
    if (!text) return;

    if ([3, 5, 8, 12].includes(state.streak)) {
      showPraise(text, state.streak >= 8 ? 920 : 760);

      if (state.streak >= 8) phaseFlash();
      if (state.streak >= 12) showDangerEdge(420);
    }
  }

  function spawnButtonSparkleAround(el, count) {
    if (!el || !ui.summary) return;

    const hostRect = ui.summary.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const cx = r.left - hostRect.left + r.width / 2;
    const cy = r.top - hostRect.top + r.height / 2;
    const pool = ['✨', '⭐', '💫', '🌟'];

    for (let i = 0; i < (count || 6); i++) {
      const fxEl = document.createElement('div');
      fxEl.className = 'gjsb-btnSparkle';
      fxEl.textContent = pool[Math.floor(rand() * pool.length)];
      fxEl.style.left = cx + range(-18, 18) + 'px';
      fxEl.style.top = cy + range(-8, 8) + 'px';
      fxEl.style.setProperty('--dx', range(-28, 28) + 'px');
      fxEl.style.setProperty('--dy', range(-34, -10) + 'px');
      ui.summary.appendChild(fxEl);
      setTimeout(() => fxEl.remove(), 700);
    }
  }

  function bindSummaryButtonSparkles() {
    [ui.btnReplay, ui.btnCooldown, ui.btnHub].forEach((btn) => {
      if (!btn) return;

      btn.addEventListener('pointerenter', () => {
        if (!state.ended) return;
        spawnButtonSparkleAround(btn, 4);
      });

      btn.addEventListener('pointerdown', () => {
        if (!state.ended) return;
        spawnButtonSparkleAround(btn, 7);
      });
    });
  }

  function bindHudWakeEvents() {
    const wake = () => wakeHud(1800);

    document.addEventListener('pointerdown', wake, { passive: true });
    document.addEventListener('touchstart', wake, { passive: true });
    window.addEventListener('keydown', wake);

    if (ui && ui.stage) {
      ui.stage.addEventListener('pointermove', () => {
        if (state.boss.active) wakeHud(900);
      }, { passive: true });
    }
  }

  function calcPlayerAccuracy() {
    const attempts = state.hitsGood + state.hitsBad + state.missedGood;
    if (attempts <= 0) return 0.65;
    return state.hitsGood / attempts;
  }

  function getAdaptiveMode() {
    if (state.boss.assistGraceMs > 0) return 'assist';

    const acc = calcPlayerAccuracy();
    const goodPressure =
      state.streak >= 8 ||
      (acc >= 0.76 && state.miss <= Math.max(4, Math.floor((state.hitsGood + 1) * 0.18)));

    const struggling =
      state.miss >= 8 ||
      state.missedGood >= 6 ||
      acc < 0.52;

    if (goodPressure) return 'sharp';
    if (struggling) return 'assist';
    return 'steady';
  }

  function getAdaptiveConfig() {
    const mode = getAdaptiveMode();

    if (mode === 'sharp') {
      return {
        mode,
        fakeWeakBonus: 0.16,
        weakSizeDelta: -6,
        stormBurstDelta: state.boss.rage ? 1 : 0,
        retargetMult: 0.86,
        telegraphDelta: -90,
        patternDurationMult: 0.92
      };
    }

    if (mode === 'assist') {
      return {
        mode,
        fakeWeakBonus: -0.28,
        weakSizeDelta: 8,
        stormBurstDelta: -1,
        retargetMult: 1.16,
        telegraphDelta: 120,
        patternDurationMult: 1.08
      };
    }

    return {
      mode,
      fakeWeakBonus: 0,
      weakSizeDelta: 0,
      stormBurstDelta: 0,
      retargetMult: 1,
      telegraphDelta: 0,
      patternDurationMult: 1
    };
  }

  function getBossStageByHp() {
    const ratio = state.boss.hp / state.boss.maxHp;
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
        stormWaveEvery: 2200,
        stormBurstCount: 1,
        stormBurstGap: 150,
        patternDuration: 3600,
        telegraphMs: 900
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
        telegraphMs: 820
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
      telegraphMs: rage ? 620 : 740
    };
  }

  function getBossAdaptiveProfile() {
    const base = getBossStageProfile(state.boss.stage);
    const ad = getAdaptiveConfig();

    const out = {
      ...base,
      weakSizeHunt: Math.max(48, base.weakSizeHunt + ad.weakSizeDelta),
      weakSizeBreak: Math.max(56, base.weakSizeBreak + ad.weakSizeDelta),
      huntRetargetMs: Math.max(360, Math.round(base.huntRetargetMs * ad.retargetMult)),
      breakRetargetMs: Math.max(420, Math.round(base.breakRetargetMs * ad.retargetMult)),
      telegraphMs: Math.max(420, base.telegraphMs + ad.telegraphDelta),
      patternDuration: Math.max(1400, Math.round(base.patternDuration * ad.patternDurationMult)),
      stormBurstCount: Math.max(1, base.stormBurstCount + ad.stormBurstDelta)
    };

    out.adaptiveMode = ad.mode;
    out.fakeWeakChanceBonus = ad.fakeWeakBonus;
    return out;
  }

  function getPatternLabel(pattern) {
    if (pattern === 'break') return 'Armor Break';
    if (pattern === 'storm') return 'Junk Storm Rage';
    return 'Target Hunt';
  }

  function getPatternSubtitle(pattern) {
    const stageProfile = getBossAdaptiveProfile();

    if (pattern === 'break') {
      return stageProfile.stage === 'A'
        ? 'เป้าใหญ่ ตีเข้าแรงขึ้น'
        : stageProfile.stage === 'B'
          ? 'เกราะเปิดแล้ว ตีให้คุ้ม'
          : 'โอกาสแรงแต่สั้น รีบโจมตี';
    }

    if (pattern === 'storm') {
      return 'พายุลงเป็นชุด x' + stageProfile.stormBurstCount;
    }

    return stageProfile.stage === 'A'
      ? 'เป้าใหญ่ ช้ากว่า ให้เรียนรู้'
      : stageProfile.stage === 'B'
        ? 'เป้าเร็วขึ้น ต้องแม่นขึ้น'
        : 'เป้าเล็กและเร็วสุดแล้ว';
  }

  function getPatternCycle(stageLetter) {
    if (stageLetter === 'A') return ['hunt', 'storm'];
    if (stageLetter === 'B') return ['hunt', 'break', 'storm'];
    return ['storm', 'hunt', 'break'];
  }

  function bossHpRatio() {
    return state.boss.maxHp > 0 ? (state.boss.hp / state.boss.maxHp) : 0;
  }

  function clearFakeWeakOnly() {
    if (!state.boss.fakeWeakDecoyId) return;
    const fake = state.items.get(state.boss.fakeWeakDecoyId);
    if (fake) removeItem(fake);
    state.boss.fakeWeakDecoyId = '';
    state.boss.fakeWeakActive = false;
  }

  function clearWeakOnly() {
    if (state.boss.weakId) {
      const weak = state.items.get(state.boss.weakId);
      if (weak) removeItem(weak);
      state.boss.weakId = '';
    }
    clearFakeWeakOnly();
  }

  function clearPatternTargets() {
    clearWeakOnly();
    clearFakeWeakOnly();
  }

  function setAssistGrace(ms) {
    state.boss.assistGraceMs = Math.max(state.boss.assistGraceMs, ms || 900);
  }

  function enterRageFinale() {
    if (state.boss.rageTriggered || state.ended) return;

    state.boss.rage = true;
    state.boss.rageTriggered = true;
    state.boss.rageEnterMs = 1400;
    state.boss.stageReached = 'RAGE';

    clearPatternTargets();

    phaseFlash();
    stageShake();
    camPunch('kill');
    showDangerEdge(1800);
    playSfx('phase-up');
    setBanner('🔥 RAGE FINALE! บอสโกรธสุดแล้ว!', 1500);
    showBossIntroCard();
    startTelegraph('🔥 Rage Finale! เป้าหลอก + พายุถี่ขึ้น', 720);
    setAssistGrace(1000);
    spawnVictoryBurst(stageRect().width * 0.5, stageRect().height * 0.28, 10);
    wakeHud(3600);

    startPattern('storm', true);
    renderHud();
  }

  function updateBossUi() {
    if (!state.boss.active) {
      ui.bossWrap.classList.remove('show');
      return;
    }

    const stageProfile = getBossAdaptiveProfile();
    ui.bossWrap.classList.add('show');
    ui.bossPatternText.textContent = compactBossPatternText();
    ui.bossStageText.textContent = stageProfile.label;
    ui.bossStageText.className = 'gjsb-boss-stage ' + stageProfile.stageClass;
    ui.bossHpText.textContent = 'HP ' + state.boss.hp + ' / ' + state.boss.maxHp;
    ui.bossHpFill.style.transform = 'scaleX(' + clamp(state.boss.hp / state.boss.maxHp, 0, 1) + ')';
    ui.bossIcon.textContent = stageProfile.icon;

    if (ui.bossPatternChip) {
      ui.bossPatternChip.textContent = getPatternLabel(state.boss.pattern);
      ui.bossPatternChip.className = 'gjsb-patternChip ' + state.boss.pattern;
    }

    const bossCard = ui.bossWrap && ui.bossWrap.querySelector('.gjsb-boss-card');
    if (bossCard) bossCard.classList.toggle('rage', !!state.boss.rage);

    if (ui.bossRageBadge) {
      ui.bossRageBadge.classList.toggle('show', !!state.boss.rage);
    }

    if (ui.bossAdaptiveBadge) {
      const mode = stageProfile.adaptiveMode || 'steady';
      const label =
        mode === 'sharp' ? '🔥 Sharp'
        : mode === 'assist' ? '💚 Assist'
        : '⚖️ Steady';

      ui.bossAdaptiveBadge.textContent = label;
      ui.bossAdaptiveBadge.className = 'gjsb-adaptiveBadge show ' + mode;
    }

    state.boss.adaptiveMode = stageProfile.adaptiveMode || 'steady';
  }

  function updateHudPriority() {
    if (!ui.topHud) return;

    const narrow = isNarrowHud();

    const bossCompact =
      narrow &&
      state.boss.active &&
      !state.boss.telegraphOn &&
      !state.boss.killSequence &&
      state.presentationLockMs <= 0 &&
      state.hudAwakeMs <= 900;

    const bossMinimal =
      narrow &&
      state.boss.active &&
      !state.boss.telegraphOn &&
      !state.boss.killSequence &&
      state.presentationLockMs <= 0 &&
      state.praiseMs <= 0 &&
      state.hudAwakeMs <= 0;

    ui.topHud.classList.toggle('mobile-narrow', narrow);
    ui.topHud.classList.toggle('boss-compact', bossCompact && !bossMinimal);
    ui.topHud.classList.toggle('boss-minimal', bossMinimal);

    if (ui.bossWrap) {
      ui.bossWrap.classList.toggle('minicore', bossMinimal);
    }
  }

  function layoutInnerHud() {
    if (!ui || !ui.topHud || !ui.progress || !ui.bossWrap) return;

    const progressWrap = ui.progress.parentElement;
    if (!progressWrap) return;

    const hasBoss = !!state.boss.active;
    ui.topHud.classList.toggle('has-boss', hasBoss);

    if (!hasBoss) {
      ui.topHud.style.setProperty('--boss-reserve', '0px');
      progressWrap.style.width = '';
      progressWrap.style.maxWidth = '';
      ui.bossWrap.style.top = isNarrowHud() ? '46px' : '52px';
      return;
    }

    const reserve = innerHudBossReservePx();
    ui.topHud.style.setProperty('--boss-reserve', reserve + 'px');

    if (innerHudIsMinimal()) {
      progressWrap.style.width = '';
      progressWrap.style.maxWidth = '';
      ui.bossWrap.style.top = '4px';
      return;
    }

    progressWrap.style.width = 'calc(100% - ' + reserve + 'px)';
    progressWrap.style.maxWidth = 'calc(100% - ' + reserve + 'px)';

    const bannerShown = !!(ui.banner && !ui.banner.classList.contains('hide'));
    const telegraphShown = !!(ui.telegraph && ui.telegraph.classList.contains('show'));

    if (isNarrowHud()) {
      ui.bossWrap.style.top =
        telegraphShown ? '84px' :
        bannerShown ? '62px' :
        '46px';
    } else {
      ui.bossWrap.style.top =
        telegraphShown ? '96px' :
        bannerShown ? '72px' :
        '52px';
    }
  }

  function updateHudVisibility(dt) {
    state.hudAwakeMs = Math.max(0, (state.hudAwakeMs || 0) - dt);

    const forceVisible =
      state.boss.telegraphOn ||
      state.presentationLockMs > 0 ||
      state.boss.killSequence ||
      state.ended ||
      state.praiseMs > 0;

    const bossMinimal =
      isNarrowHud() &&
      state.boss.active &&
      !forceVisible &&
      state.hudAwakeMs <= 0;

    const shouldDim =
      !forceVisible &&
      state.hudAwakeMs <= 0 &&
      !bossMinimal;

    if (ui.topHud) {
      ui.topHud.classList.toggle('dim', shouldDim);
    }

    if (ui.bossWrap && state.boss.active) {
      const allowMini =
        !bossMinimal &&
        shouldDim &&
        !state.boss.telegraphOn &&
        !state.boss.killSequence &&
        !state.ended;

      ui.bossWrap.classList.toggle('mini', allowMini);
    }

    updateHudPriority();
    layoutInnerHud();
  }

  function renderHud() {
    const narrow = isNarrowHud();

    const bossCompact =
      narrow &&
      state.boss.active &&
      !state.boss.telegraphOn &&
      !state.boss.killSequence &&
      state.presentationLockMs <= 0 &&
      state.hudAwakeMs <= 900;

    const bossMinimal =
      narrow &&
      state.boss.active &&
      !state.boss.telegraphOn &&
      !state.boss.killSequence &&
      state.presentationLockMs <= 0 &&
      state.praiseMs <= 0 &&
      state.hudAwakeMs <= 0;

    if (state.boss.active && (state.boss.telegraphOn || state.boss.killSequence)) {
      wakeHud(1400);
    }

    if (bossMinimal || bossCompact) {
      ui.score.textContent = '⭐ ' + state.score;
      ui.time.textContent = '⏱ ' + fmtTime(state.timeLeft);
      ui.miss.textContent = 'M • ' + state.miss;
      ui.streak.textContent = 'C • ' + state.streak;
      ui.phase.textContent = 'B • ' + state.boss.stage;
    } else {
      ui.score.textContent = narrow ? ('S • ' + state.score) : ('Score • ' + state.score);
      ui.time.textContent = narrow ? ('T • ' + fmtTime(state.timeLeft)) : ('Time • ' + fmtTime(state.timeLeft));
      ui.miss.textContent = narrow ? ('M • ' + state.miss) : ('Miss • ' + state.miss);
      ui.streak.textContent = narrow ? ('C • ' + state.streak) : ('Streak • ' + state.streak);
      ui.phase.textContent = state.boss.active
        ? (narrow ? ('B • ' + state.boss.stage) : ('Boss • ' + state.boss.stage))
        : (narrow ? ('P • ' + state.phase) : ('Phase • ' + state.phase));
    }

    const progressRatio = clamp(state.timeLeft / state.timeTotal, 0, 1);
    ui.progress.style.transform = 'scaleX(' + progressRatio + ')';

    updateBossUi();
    updateHudPriority();
    layoutInnerHud();
  }

  function createItem(kind, emoji, x, y, size, vx, vy, label) {
    const id = 'it-' + (++state.seq);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'gjsb-item ' + kind;
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.innerHTML = '<div class="gjsb-emoji">' + emoji + '</div><div class="gjsb-tag">' + (label || kind) + '</div>';
    ui.stage.appendChild(el);

    const item = {
      id, kind, emoji, x, y, size, vx, vy, el, dead: false
    };

    el.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      onHit(item);
    }, { passive: false });

    state.items.set(id, item);
    drawItem(item);
    return item;
  }

  function drawItem(item) {
    item.el.style.transform = 'translate(' + item.x + 'px, ' + item.y + 'px)';
  }

  function removeItem(item) {
    if (!item || item.dead) return;
    item.dead = true;
    try { item.el.remove(); } catch {}
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

  function spawnStormOne() {
    const r = stageRect();
    const size = range(42, 62);
    const x = range(10, Math.max(12, r.width - size - 10));
    const y = -size - range(0, 20);
    const vx = range(-70, 70);
    const vy = state.boss.stage === 'C' ? range(250, 370) : range(180, 280);
    state.spawnedStorm += 1;
    createItem('storm', JUNK[Math.floor(rand() * JUNK.length)], x, y, size, vx, vy, 'storm');

    if (state.boss.stage === 'C') {
      showDangerEdge(680);
    }
  }

  function ensureWeakForPattern() {
    if (state.boss.weakId || state.boss.fakeWeakActive) return;

    const stageProfile = getBossAdaptiveProfile();
    const isBreak = state.boss.pattern === 'break';
    const size = isBreak ? stageProfile.weakSizeBreak : stageProfile.weakSizeHunt;
    const speed = isBreak ? stageProfile.weakSpeedBreak : stageProfile.weakSpeedHunt;

    const spawnRealWeak = () => {
      const pos = randomBossSpawn(size);

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
      state.boss.weakId = item.id;
    };

    let fakeChanceBase = 0;
    if (state.boss.rage && state.boss.stage === 'C') {
      fakeChanceBase = state.boss.pattern === 'break' ? 0.72 : 0.58;
    }

    const fakeChance = clamp(fakeChanceBase + (stageProfile.fakeWeakChanceBonus || 0), 0.05, 0.88);
    const shouldFake =
      state.boss.rage &&
      state.boss.stage === 'C' &&
      rand() < fakeChance;

    if (!shouldFake) {
      spawnRealWeak();
      return;
    }

    const fakeSize = size + 8;
    const pos = randomBossSpawn(fakeSize);

    const fake = createItem(
      'fakeweak',
      '❌',
      pos.x,
      pos.y,
      fakeSize,
      range(-speed * 0.6, speed * 0.6),
      range(-speed * 0.6, speed * 0.6),
      'fake'
    );

    state.boss.fakeWeakActive = true;
    state.boss.fakeWeakDecoyId = fake.id;

    setTimeout(() => {
      if (state.ended || !state.boss.active) return;
      if (state.boss.fakeWeakDecoyId === fake.id) {
        removeItem(fake);
      }
      state.boss.fakeWeakActive = false;
      state.boss.fakeWeakDecoyId = '';
      if (!state.boss.weakId) spawnRealWeak();
    }, state.boss.rage ? 280 : 360);
  }

  function retargetWeak(item) {
    const stageProfile = getBossAdaptiveProfile();
    const speed = state.boss.pattern === 'break'
      ? stageProfile.weakSpeedBreak
      : stageProfile.weakSpeedHunt;

    const vx = range(-speed, speed);
    const vy = range(-speed, speed);

    item.vx = Math.abs(vx) < speed * 0.22 ? (vx < 0 ? -speed * 0.35 : speed * 0.35) : vx;
    item.vy = Math.abs(vy) < speed * 0.22 ? (vy < 0 ? -speed * 0.35 : speed * 0.35) : vy;
  }

  function updateWeak(item, dt) {
    const box = getBossPlayRect(item.size);

    item.x += item.vx * dt / 1000;
    item.y += item.vy * dt / 1000;

    if (item.x <= box.left) {
      item.x = box.left;
      item.vx = Math.abs(item.vx);
    }
    if (item.x >= box.right) {
      item.x = box.right;
      item.vx = -Math.abs(item.vx);
    }
    if (item.y <= box.top) {
      item.y = box.top;
      item.vy = Math.abs(item.vy);
    }
    if (item.y >= box.bottom) {
      item.y = box.bottom;
      item.vy = -Math.abs(item.vy);
    }

    drawItem(item);
  }

  function getWeakDamageForPattern(pattern) {
    if (pattern === 'break') {
      return state.boss.stage === 'C' ? 3 : 2;
    }
    return 1;
  }

  function onHit(item) {
    if (!state.running || state.ended) return;

    const cx = item.x + item.size / 2;
    const cy = item.y + item.size / 2;

    if (item.kind === 'good') {
      state.hitsGood += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);

      const bonus = Math.min(10, Math.floor(state.streak / 3) * 2);
      const gain = 10 + bonus;
      state.score += gain;

      fx(cx, cy, '+' + gain, '#2f8f2f');
      setBanner('เยี่ยม! เก็บอาหารดีต่อไป', 650);
      playSfx('good');
      wakeHud(1200);
      pulseScoreHud();
      maybePraiseStreak();
      removeItem(item);
    } else if (item.kind === 'junk' || item.kind === 'storm') {
      state.hitsBad += 1;
      state.miss += 1;
      state.streak = 0;
      state.score = Math.max(0, state.score - 8);

      if (item.kind === 'storm') state.stormHits += 1;

      fx(cx, cy, 'MISS', '#d16b27');
      setBanner(item.kind === 'storm' ? 'โดน Junk Storm!' : 'ระวัง junk!', 700);
      playSfx('bad');
      wakeHud(1600);
      stageShake();
      showDangerEdge(item.kind === 'storm' ? 900 : 420);
      setAssistGrace(item.kind === 'storm' ? 1300 : 900);
      removeItem(item);
    } else if (item.kind === 'fakeweak') {
      state.miss += 1;
      state.streak = 0;
      state.score = Math.max(0, state.score - 6);

      fx(cx, cy, 'หลอก!', '#c05621');
      playSfx('bad');
      stageShake();
      showDangerEdge(620);
      setAssistGrace(1200);
      removeItem(item);
    } else if (item.kind === 'weak') {
      state.powerHits += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);

      const damage = getWeakDamageForPattern(state.boss.pattern);
      state.boss.hp = Math.max(0, state.boss.hp - damage);
      state.score += damage >= 3 ? 30 : damage === 2 ? 24 : 15;

      fx(cx, cy, damage >= 3 ? 'MEGA!' : damage === 2 ? 'CRUSH!' : 'POWER!', '#cf8a00');
      playSfx(damage >= 2 ? 'boss-break' : 'boss-hit');
      wakeHud(1800);
      pulseScoreHud();
      hitstop(damage >= 3 ? 110 : damage === 2 ? 95 : 80);
      phaseFlash();
      stageShake();
      camPunch(damage >= 2 ? 'kill' : 'normal');
      pulseBossHit();
      removeItem(item);

      if (state.boss.hp <= 0) {
        startKillSequence(cx, cy);
        return;
      }

      syncBossStageByHp();
      setBanner(getPatternLabel(state.boss.pattern) + ' โดนแล้ว!', 820);
    }

    renderHud();
  }

  function missGood(item) {
    state.miss += 1;
    state.missedGood += 1;
    state.streak = 0;
    fx(item.x + item.size / 2, Math.max(30, item.y), 'พลาดของดี', '#d18d00');
    playSfx('bad');
    setAssistGrace(850);
    removeItem(item);
    renderHud();
  }

  function startTelegraph(text, ms) {
    state.boss.telegraphOn = true;
    state.boss.telegraphText = text;
    state.boss.telegraphMs = ms || 800;
    showTelegraph(text, ms || 800);

    if (state.boss.pattern === 'storm') {
      showDangerEdge((ms || 800) + 180);
      stageShake();
    }
  }

  function startPattern(pattern, withTelegraph) {
    const stageProfile = getBossAdaptiveProfile();

    state.boss.pattern = pattern;
    state.boss.patternTimeLeft = stageProfile.patternDuration;
    state.boss.stormBurstLeft = 0;
    state.boss.stormBurstGapMs = 0;
    state.boss.stormWaveCooldown = 0;
    state.boss.weakRetargetAcc = 0;
    state.boss.weakRetargetMs =
      pattern === 'break' ? stageProfile.breakRetargetMs : stageProfile.huntRetargetMs;

    clearPatternTargets();

    if (withTelegraph) {
      if (pattern === 'storm') {
        startTelegraph('⚠️ Junk Storm กำลังมา x' + stageProfile.stormBurstCount, stageProfile.telegraphMs);
      } else if (pattern === 'break') {
        startTelegraph('🛡️ Armor Break! เป้าทองจะใหญ่และตีแรงขึ้น', stageProfile.telegraphMs - 120);
      } else {
        startTelegraph('🎯 Target Hunt! ตามเป้าทองให้ทัน', stageProfile.telegraphMs - 120);
      }
    } else {
      state.boss.telegraphOn = false;
      state.boss.telegraphMs = 0;
    }

    if (pattern === 'storm') {
      state.boss.stormWaveCooldown = stageProfile.stormWaveEvery;
      showDangerEdge(stageProfile.telegraphMs + 240);
    }

    if (pattern === 'break') {
      phaseFlash();
      camPunch('normal');
    }

    wakeHud(pattern === 'storm' ? 1800 : 1400);
    setBanner(getPatternLabel(pattern) + ' • ' + getPatternSubtitle(pattern), 1050);
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

    phaseFlash();
    stageShake();
    showDangerEdge(nextStage === 'C' ? 1400 : 900);
    playSfx('phase-up');
    setBanner(getBossStageProfile(nextStage).label, 1200);

    beginNextBossPattern(nextStage === 'B' ? 'break' : 'storm');
  }

  function updateBossPattern(dt) {
    const stageProfile = getBossAdaptiveProfile();

    if (state.boss.telegraphOn) {
      state.boss.telegraphMs -= dt;
      if (state.boss.telegraphMs <= 0) {
        state.boss.telegraphOn = false;
        ui.telegraph.classList.remove('show');
        layoutInnerHud();

        if (state.boss.pattern === 'storm') {
          state.boss.stormBurstLeft = stageProfile.stormBurstCount;
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
        if (weak) retargetWeak(weak);
      }
    }

    if (state.boss.pattern === 'storm') {
      state.boss.stormWaveCooldown -= dt;

      if (state.boss.stormWaveCooldown <= 0 && state.boss.stormBurstLeft <= 0) {
        state.boss.stormBurstLeft = stageProfile.stormBurstCount;
        state.boss.stormBurstGapMs = 0;
        state.boss.stormWaveCooldown = stageProfile.stormWaveEvery;
      }

      if (state.boss.stormBurstLeft > 0) {
        state.boss.stormBurstGapMs -= dt;
        if (state.boss.stormBurstGapMs <= 0) {
          spawnStormOne();
          state.boss.stormBurstLeft -= 1;
          state.boss.stormBurstGapMs = stageProfile.stormBurstGap;
        }
      }

      ensureWeakForPattern();
      state.boss.weakRetargetAcc += dt;
      if (state.boss.weakRetargetAcc >= stageProfile.huntRetargetMs) {
        state.boss.weakRetargetAcc = 0;
        const weak = state.boss.weakId ? state.items.get(state.boss.weakId) : null;
        if (weak) retargetWeak(weak);
      }
    }

    if (state.boss.patternTimeLeft <= 0) {
      beginNextBossPattern();
    }
  }

  function enterPhase2() {
    state.phase = 2;
    clearItems();
    state.spawnAcc = 0;

    phaseFlash();
    playSfx('phase-up');
    wakeHud(2200);
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
    state.boss.rageEnterMs = 0;
    state.boss.fakeWeakActive = false;
    state.boss.fakeWeakDecoyId = '';

    clearItems();
    state.spawnAcc = 0;

    phaseFlash();
    stageShake();
    showDangerEdge(1200);
    playSfx('phase-up');
    wakeHud(3200);
    setBanner('Boss Phase • Junk King มาแล้ว!', 1600);
    showBossIntroCard();

    beginNextBossPattern('hunt');
    renderHud();
  }

  function update(dt) {
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      endGame(false);
      return;
    }

    state.boss.assistGraceMs = Math.max(0, state.boss.assistGraceMs - dt);
    state.presentationLockMs = Math.max(0, state.presentationLockMs - dt);
    state.praiseMs = Math.max(0, state.praiseMs - dt);

    if (state.boss.killSequence) {
      updateDangerEdge(dt);
      updateHudVisibility(dt);
      renderHud();
      return;
    }

    if (state.presentationLockMs > 0) {
      updateDangerEdge(dt);
      updateHudVisibility(dt);
      renderHud();
      return;
    }

    const r = stageRect();

    if (!state.boss.active) {
      const spawnEvery = state.phase === 1 ? cfg.spawn1 : cfg.spawn2;
      state.spawnAcc += dt;
      while (state.spawnAcc >= spawnEvery) {
        state.spawnAcc -= spawnEvery;
        spawnFood(state.phase);
      }
    } else {
      updateBossPattern(dt);

      if (!state.boss.rageTriggered && bossHpRatio() <= 0.15) {
        enterRageFinale();
      }
    }

    state.items.forEach((item) => {
      if (item.dead) return;

      if (item.kind === 'weak' || item.kind === 'fakeweak') {
        updateWeak(item, dt, r);
        return;
      }

      item.x += item.vx * dt / 1000;
      item.y += item.vy * dt / 1000;

      if (item.x <= 8) { item.x = 8; item.vx *= -1; }
      if (item.x + item.size >= r.width - 8) { item.x = r.width - item.size - 8; item.vx *= -1; }

      drawItem(item);

      if (item.y > r.height + item.size * 0.5) {
        if (item.kind === 'good') missGood(item);
        else removeItem(item);
      }
    });

    if (!state.boss.active && state.phase === 1 && state.score >= cfg.p1Goal) {
      enterPhase2();
    } else if (!state.boss.active && state.phase === 2 && state.score >= cfg.p2Goal) {
      enterBoss();
    }

    updateDangerEdge(dt);
    updateHudVisibility(dt);
    renderHud();
  }

  function loop(ts) {
    if (!state.running || state.ended) return;

    const dt = Math.min(40, (ts - state.lastTs) || 16);
    state.lastTs = ts;

    update(dt);
    state.raf = requestAnimationFrame(loop);
  }

  function starsFromSummary(bossClear) {
    if (bossClear && state.miss <= 5) return 3;
    if (bossClear || state.boss.active) return 2;
    return 1;
  }

  function coachMessage(bossClear) {
    if (bossClear && state.miss <= 5) {
      return 'สุดยอดเลย! เธอเก็บอาหารดีได้ต่อเนื่อง อ่านจังหวะบอสแม่น และปราบ Junk King ได้อย่างมั่นใจ';
    }
    if (bossClear) {
      return 'เยี่ยมมาก! แม้จะมีพลาดบ้าง แต่เธอก็ยังเอาชนะ Junk King ได้สำเร็จ';
    }
    if (state.boss.active) {
      return 'เก่งมาก! ถึงบอสแล้ว รอบหน้าลองอ่านสัญญาณเตือน Junk Storm ให้ไวขึ้นอีกนิดนะ';
    }
    if (state.phase >= 2) {
      return 'ดีมาก! ผ่าน Phase 2 แล้ว ลองรักษาคอมโบให้ยาวขึ้นในรอบต่อไป';
    }
    return 'เริ่มต้นได้ดีเลย ลองแตะอาหารดีให้ต่อเนื่องมากขึ้น แล้วหลบ junk ให้แม่นขึ้นนะ';
  }

  function avatarForSummary(bossClear) {
    if (bossClear && state.miss <= 5) return '🥳';
    if (bossClear) return '😄';
    if (state.boss.active) return '🙂';
    return '😊';
  }

  function getCooldownTarget() {
    return String(ctx.nextAfterCooldown || '').trim()
      || String(ctx.cdnext || '').trim()
      || String(ctx.hub || '').trim()
      || new URL('./hub.html', location.href).toString();
  }

  function buildReplayUrl() {
    const u = new URL('./goodjunk-vr.html', location.href);
    u.searchParams.set('pid', ctx.pid || 'anon');
    u.searchParams.set('name', ctx.name || 'Hero');
    if (ctx.studyId) u.searchParams.set('studyId', ctx.studyId);
    u.searchParams.set('mode', 'solo');
    u.searchParams.set('diff', diffKey);
    u.searchParams.set('time', String(Math.round(state.timeTotal / 1000)));
    u.searchParams.set('seed', String(Date.now()));
    u.searchParams.set('hub', ctx.hub || new URL('./hub.html', location.href).toString());
    u.searchParams.set('view', ctx.view || 'mobile');
    u.searchParams.set('run', ctx.run || 'play');
    u.searchParams.set('gameId', ctx.gameId || 'goodjunk');
    u.searchParams.set('zone', 'nutrition');
    if (ctx.nextAfterCooldown) u.searchParams.set('nextAfterCooldown', ctx.nextAfterCooldown);
    if (ctx.cdnext) u.searchParams.set('cdnext', ctx.cdnext);
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
    u.searchParams.set('hub', ctx.hub || new URL('./hub.html', location.href).toString());
    u.searchParams.set('view', ctx.view || 'mobile');
    u.searchParams.set('run', ctx.run || 'play');
    u.searchParams.set('forcegate', '1');
    u.searchParams.set('nextAfterCooldown', getCooldownTarget());
    return u.toString();
  }

  function endGame(bossClear) {
    if (state.ended) return;
    state.ended = true;
    state.running = false;
    cancelAnimationFrame(state.raf);
    clearItems();
    playSfx(bossClear ? 'boss-clear' : 'phase-up');

    const stars = starsFromSummary(bossClear);
    const grade = calcGrade(bossClear);

    const summary = {
      source: 'goodjunk-solo-phaseboss-v5',
      gameId: ctx.gameId || 'goodjunk',
      mode: 'solo',
      pid: ctx.pid || 'anon',
      studyId: ctx.studyId || '',
      diff: diffKey,
      run: ctx.run || 'play',
      score: state.score,
      miss: state.miss,
      bestStreak: state.bestStreak,
      hitsGood: state.hitsGood,
      hitsBad: state.hitsBad,
      missedGood: state.missedGood,
      powerHits: state.powerHits,
      stormHits: state.stormHits,
      stormSpawned: state.spawnedStorm,
      bossDefeated: !!bossClear,
      phaseReached: state.boss.active ? 'boss' : ('phase-' + state.phase),
      bossStageReached: state.boss.stageReached,
      bossPatternLast: state.boss.pattern,
      bossAdaptiveMode: state.boss.adaptiveMode,
      finalGrade: grade,
      updatedAt: Date.now()
    };

    saveSummary(summary);

    const metaProgress = computeMetaProgress({
      bossClear: !!bossClear,
      rage: !!state.boss.rageTriggered,
      score: state.score,
      miss: state.miss,
      bestStreak: state.bestStreak,
      grade
    });

    state.lastSummaryMeta = metaProgress;
    state.unlockedNow = metaProgress.unlockedNow.slice();

    ui.sumTitle.textContent = bossClear ? 'Food Hero Complete!' : 'Great Job!';
    ui.sumSub.textContent = bossClear
      ? 'เธอช่วยปกป้องเมืองอาหารดีและเอาชนะ Junk King ได้แล้ว'
      : state.phase >= 2
        ? 'ผ่านด่านก่อนบอสได้ดีมาก รอบหน้าลุยต่อได้อีก'
        : 'เริ่มต้นได้ดีมาก เก็บอาหารดีต่อไปนะ';
    ui.sumStars.textContent = '⭐'.repeat(stars);
    ui.sumAvatar.textContent = avatarForSummary(bossClear);

    const medal = medalEmojiForGrade(grade);
    if (ui.sumMedal) ui.sumMedal.textContent = medal;
    if (ui.sumGrade) {
      ui.sumGrade.textContent = grade;
      ui.sumGrade.className = 'gjsb-grade ' + grade.toLowerCase();
    }

    if (grade === 'S') {
      ui.sumSub.textContent = bossClear ? 'ชนะอย่างสวยงาม! รอบนี้คือระดับตำนาน' : 'ฟอร์มยอดเยี่ยมมาก!';
    } else if (grade === 'A') {
      ui.sumSub.textContent = bossClear ? 'เก่งมาก! ผ่านบอสได้แบบมั่นใจ' : 'ผลงานรอบนี้ยอดเยี่ยมมาก';
    } else if (grade === 'B') {
      ui.sumSub.textContent = 'ดีมาก! ใกล้ขึ้นอีกนิดก็จะสุดแล้ว';
    } else {
      ui.sumSub.textContent = 'เริ่มต้นได้ดี รอบหน้ามาใหม่อีกครั้งนะ';
    }

    let coach = coachMessage(bossClear);
    if (metaProgress.unlockedNow.some((b) => b.id === 'rage_clear')) {
      coach = 'สุดยอดมาก! เธอผ่าน Rage Finale ได้แล้ว นี่คือระดับฮีโร่จริง ๆ';
    } else if (metaProgress.newBestScore) {
      coach = 'เยี่ยมมาก! รอบนี้ทำคะแนนสูงสุดใหม่ได้แล้ว';
    } else if (metaProgress.newBestGrade) {
      coach = 'เก่งมาก! รอบนี้เกรดดีขึ้นจากเดิมอีกขั้นแล้ว';
    }
    ui.sumCoach.textContent = coach;

    ui.sumGrid.innerHTML = `
      <div class="gjsb-stat"><div class="k">Score</div><div class="v">${state.score}</div></div>
      <div class="gjsb-stat"><div class="k">Miss</div><div class="v">${state.miss}</div></div>
      <div class="gjsb-stat"><div class="k">Best Streak</div><div class="v">${state.bestStreak}</div></div>
      <div class="gjsb-stat"><div class="k">Reached</div><div class="v">${
        bossClear ? (state.boss.rageTriggered ? 'Rage Clear' : 'Boss Clear') : (state.boss.active ? ('Boss ' + state.boss.stageReached) : ('Phase ' + state.phase))
      }</div></div>
      <div class="gjsb-stat"><div class="k">Good Hit</div><div class="v">${state.hitsGood}</div></div>
      <div class="gjsb-stat"><div class="k">Power Hit</div><div class="v">${state.powerHits}</div></div>
      <div class="gjsb-stat"><div class="k">Adaptive</div><div class="v">${state.boss.adaptiveMode}</div></div>
      <div class="gjsb-stat"><div class="k">Boss Clears</div><div class="v">${metaProgress.current.bossClears}</div></div>
      <div class="gjsb-stat"><div class="k">Rage Clears</div><div class="v">${metaProgress.current.rageClears}</div></div>
      <div class="gjsb-stat"><div class="k">Badges</div><div class="v">${metaProgress.current.badges.length}</div></div>
    `;

    if (ui.sumMetaBox && ui.sumMetaText) {
      const tags = [];
      if (metaProgress.newBestScore) tags.push('🏆 Best Score');
      if (metaProgress.newBestStreak) tags.push('✨ Best Streak');
      if (metaProgress.newBestGrade) tags.push('💎 Best Grade');

      if (tags.length) {
        ui.sumMetaBox.style.display = '';
        ui.sumMetaText.innerHTML = '<strong>New Record!</strong> ' + tags.join(' • ');
      } else {
        ui.sumMetaBox.style.display = 'none';
        ui.sumMetaText.textContent = '';
      }
    }

    if (ui.sumBadgeBox && ui.sumBadgeText) {
      if (metaProgress.unlockedNow.length) {
        ui.sumBadgeBox.style.display = '';
        ui.sumBadgeText.innerHTML =
          '<strong>New Badge!</strong> ' +
          metaProgress.unlockedNow.map((b) => b.label).join(' • ');
      } else {
        ui.sumBadgeBox.style.display = 'none';
        ui.sumBadgeText.textContent = '';
      }
    }

    if (bossClear) spawnVictoryBurst(stageRect().width * 0.5, stageRect().height * 0.34, 12);

    ui.summary.classList.add('show');

    setTimeout(() => {
      if (ui.btnReplay) spawnButtonSparkleAround(ui.btnReplay, 8);
      if (ui.btnCooldown) spawnButtonSparkleAround(ui.btnCooldown, 8);
    }, 180);
  }

  function bindButtons() {
    ui.btnReplay.addEventListener('click', function () {
      location.href = buildReplayUrl();
    });

    ui.btnCooldown.addEventListener('click', function () {
      location.href = buildCooldownUrl();
    });

    ui.btnHub.addEventListener('click', function () {
      location.href = ctx.hub || new URL('./hub.html', location.href).toString();
    });
  }

  function start() {
    window.__GJ_ENGINE_MOUNTED__ = true;
    state.running = true;
    state.lastTs = performance.now();
    wakeHud(1600);
    renderHud();
    setBanner('เริ่มเลย! เก็บอาหารดี แล้วหลีกเลี่ยง junk', 1300);
    state.raf = requestAnimationFrame(loop);
  }

  injectStyle();
  ui = buildUI();
  bindButtons();
  bindSummaryButtonSparkles();
  bindHudWakeEvents();
  exposeMetaForOtherPages();
  window.addEventListener('resize', layoutInnerHud, { passive: true });
  window.__GJ_ENGINE_MOUNTED__ = true;
  layoutInnerHud();
  start();
})();