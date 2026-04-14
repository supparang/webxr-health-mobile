// === /fitness/js/balance-hold.js ===
// Balance Hold — production merge patch + STRICT PLANNER FLOW
// tutorial + anti-cheese + teacher export + hub snapshot + boss phase
// FINAL PATCH v20260414a-balancehold-strict-planner

(() => {
  'use strict';

  const W = window;
  const D = document;
  const $ = (sel, root = D) => root.querySelector(sel);

  const qs = new URLSearchParams(location.search);

  const q = (k, d = '') => {
    const v = qs.get(k);
    return v == null || v === '' ? d : v;
  };

  const qNum = (k, d = 0) => {
    const n = Number(q(k, d));
    return Number.isFinite(n) ? n : d;
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const nowMs = () => (W.performance && performance.now ? performance.now() : Date.now());

  const TEACHER_EXPORT_LAST_KEY = 'HHA_BALANCE_TEACHER_EXPORT_LAST_V1';

  function bhSafeAbsUrl(raw, fallback = '') {
    const value = String(raw || '').trim();
    try {
      if (value) return new URL(value, location.href).toString();
    } catch (_) {}
    return fallback || '';
  }

  function bhNormalizeHubUrl(raw) {
    const fallback = '../herohealth/fitness-planner.html';
    const href = bhSafeAbsUrl(raw, bhSafeAbsUrl(fallback, fallback));
    const s = String(href || '').toLowerCase();

    if (
      !href ||
      s.endsWith('/webxr-health-mobile/fitness') ||
      s.endsWith('/webxr-health-mobile/fitness/') ||
      s === 'https://supparang.github.io/webxr-health-mobile/fitness' ||
      s === 'https://supparang.github.io/webxr-health-mobile/fitness/'
    ) {
      return bhSafeAbsUrl(fallback, fallback);
    }

    return href;
  }

  function bhIsPlannerStrictFlow() {
    const hubUrl = String(q('hub', '')).toLowerCase();
    return (
      q('plannerFlow', '') === '1' ||
      q('fpStrict', '') === '1' ||
      String(q('cooldown', '')).toLowerCase() === '0' ||
      String(q('returnPhase', '')).toLowerCase() === 'planner' ||
      hubUrl.includes('fitness-planner') ||
      hubUrl.includes('fpresume=1') ||
      hubUrl.includes('plan=')
    );
  }

  function bhPlannerReturnUrl() {
    return bhNormalizeHubUrl(q('hub', '../herohealth/fitness-planner.html'));
  }

  const ctx = {
    pid: q('pid', 'anon'),
    name: q('name', q('nickName', q('nick', 'Player'))),
    studyId: q('studyId', ''),
    zone: q('zone', 'fitness'),
    cat: q('cat', 'fitness'),
    game: q('game', 'balancehold'),
    gameId: q('gameId', 'balancehold'),
    mode: q('mode', 'solo'),
    run: q('run', 'play'),
    diff: q('diff', 'normal'),
    time: qNum('time', 90),
    seed: q('seed', String(Date.now())),
    view: q('view', 'mobile'),
    hub: q('hub', '../herohealth/hub-v2.html'),

    gate: q('gate', '0') === '1',
    cooldown: q('cooldown', '0') === '1',
    boss: q('boss', ''),
    returnPhase: q('returnPhase', ''),
    cdur: qNum('cdur', 20),

    log: q('log', '0') === '1',
    debug: q('debug', '0') === '1',

    api: q('api', ''),
    weekNo: q('weekNo', ''),
    sessionNo: q('sessionNo', ''),
    grade: q('grade', ''),
    teacher: q('teacher', ''),

    plannerStrict: bhIsPlannerStrictFlow()
  };

  const root = $('#bhGame');
  const arena = $('#bhArena');
  const elTarget = $('#bhTarget');
  const elCursor = $('#bhCursor');
  const elGhost = $('#bhGhost');
  const elCue = $('#bhCue');
  const elBeat = $('#bhBeat');
  const elCoach = $('#bhCoach');
  const elPost = $('#bhPost');
  const elStars = $('#bhStars');
  const elScore = $('#bhScore');
  const elProgress = $('#bhProgress');
  const elOverlay = $('#bhOverlay');

  const elFXLayer = $('#bhFXLayer');
  const elTargetPulse = $('#bhTargetPulse');
  const elSuccessFlash = $('#bhSuccessFlash');
  const elRecoverPop = $('#bhRecoverPop');
  const elPerfectPop = $('#bhPerfectPop');
  const elCoachMood = $('#bhCoachMood');
  const elPostBanner = $('#bhPostBanner');
  const elStarBurst = $('#bhStarBurst');
  const elToast = $('#toast');

  if (!root || !arena || !elTarget || !elCursor || !elOverlay) {
    console.error('[BalanceHold] Missing required DOM nodes.');
    return;
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
      return (h ^= h >>> 16) >>> 0;
    };
  }

  function mulberry32(a) {
    return function () {
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const seedFn = xmur3(String(ctx.seed));
  const rand = mulberry32(seedFn());

  const sessionId = [
    ctx.gameId,
    ctx.pid || 'anon',
    Date.now(),
    String(ctx.seed).slice(0, 12)
  ].join('_');

  let eventSeq = 0;

  function safeJsonParse(raw, fallback) {
    try {
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function toast(msg) {
    if (!elToast) return;
    elToast.textContent = msg;
    elToast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => elToast.classList.remove('show'), 1800);
  }

  function emitWindowEvent(name, detail) {
    try {
      W.dispatchEvent(new CustomEvent(name, { detail }));
    } catch (_) {}
  }

  function baseEventPayload() {
    const t = Date.now();
    const iso = new Date(t).toISOString();
    return {
      event_id: `${sessionId}_${String(++eventSeq).padStart(4, '0')}`,
      event_seq: eventSeq,
      ts_ms: t,
      ts_iso: iso,
      session_id: sessionId,
      pid: ctx.pid,
      name: ctx.name,
      studyId: ctx.studyId,
      game: ctx.game,
      gameId: ctx.gameId,
      zone: ctx.zone,
      cat: ctx.cat,
      mode: ctx.mode,
      run: ctx.run,
      diff: ctx.diff,
      view: ctx.view,
      seed: ctx.seed,
      weekNo: ctx.weekNo,
      sessionNo: ctx.sessionNo,
      plannerStrict: ctx.plannerStrict ? 1 : 0
    };
  }

  function storeEventLocally(evt) {
    const key = `HHA_EVENT_BUFFER_${ctx.gameId}`;
    const allKey = 'HHA_EVENT_BUFFER_ALL';

    try {
      const arr = safeJsonParse(localStorage.getItem(key), []);
      arr.push(evt);
      localStorage.setItem(key, JSON.stringify(arr.slice(-400)));
    } catch (_) {}

    try {
      const arr = safeJsonParse(localStorage.getItem(allKey), []);
      arr.push(evt);
      localStorage.setItem(allKey, JSON.stringify(arr.slice(-1500)));
    } catch (_) {}
  }

  function logEvent(type, data = {}) {
    const evt = { ...baseEventPayload(), type, ...data };
    storeEventLocally(evt);

    emitWindowEvent('hha:event', evt);
    emitWindowEvent(`hha:${type}`, evt);

    if (ctx.log || ctx.debug) {
      console.log('[BalanceHold:event]', type, evt);
    }

    if (typeof W.HHA_LOG_EVENT === 'function') {
      try { W.HHA_LOG_EVENT(evt); } catch (_) {}
    }
    if (W.HHA && typeof W.HHA.logEvent === 'function') {
      try { W.HHA.logEvent(evt); } catch (_) {}
    }

    return evt;
  }

  function flushEventBuffer(reason = 'manual') {
    const payload = {
      gameId: ctx.gameId,
      sessionId,
      reason,
      ts: new Date().toISOString(),
      plannerStrict: ctx.plannerStrict ? 1 : 0
    };
    emitWindowEvent('hha:flush', payload);

    if (ctx.log || ctx.debug) {
      console.log('[BalanceHold:flush]', payload);
    }
  }

  function saveSummaryPayload(payload) {
    try {
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(payload));
      localStorage.setItem(`HHA_LAST_SUMMARY_${ctx.gameId}`, JSON.stringify(payload));
      localStorage.setItem(`HHA_LAST_SUMMARY_${ctx.gameId}_${ctx.pid}`, JSON.stringify(payload));
    } catch (_) {}
  }

  function saveSessionMeta(payload) {
    try {
      localStorage.setItem(`HHA_LAST_SESSION_${ctx.gameId}`, JSON.stringify(payload));
    } catch (_) {}
  }

  function csvCell(v) {
    const s = String(v == null ? '' : v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function downloadTextFile(filename, text, mime = 'text/plain;charset=utf-8') {
    try {
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = D.createElement('a');
      a.href = url;
      a.download = filename;
      D.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (_) {}
  }

  function diffCfg(diff) {
    if (diff === 'easy') {
      return {
        zoneRadius: 72,
        holdScale: 0.84,
        beatMs: 900,
        driftAmp: 4,
        enterDelayMs: 900
      };
    }
    if (diff === 'hard' || diff === 'challenge') {
      return {
        zoneRadius: 44,
        holdScale: 1.16,
        beatMs: 650,
        driftAmp: 10,
        enterDelayMs: 780
      };
    }
    return {
      zoneRadius: 58,
      holdScale: 1,
      beatMs: 760,
      driftAmp: 7,
      enterDelayMs: 840
    };
  }

  function durationCfg(sec) {
    if (sec <= 60) {
      return {
        holdScale: 0.86,
        practiceMs: 10000,
        clearDelayMs: 980
      };
    }
    if (sec >= 120) {
      return {
        holdScale: 1.18,
        practiceMs: 18000,
        clearDelayMs: 1350
      };
    }
    return {
      holdScale: 1,
      practiceMs: 15000,
      clearDelayMs: 1200
    };
  }

  const cfg = diffCfg(ctx.diff);
  const dur = durationCfg(ctx.time);

  function getArenaRect() {
    return arena.getBoundingClientRect();
  }

  function arenaSize() {
    const r = getArenaRect();
    return {
      w: Math.max(320, r.width),
      h: Math.max(320, r.height)
    };
  }

  function centerPos() {
    const { w, h } = arenaSize();
    return { x: w * 0.5, y: h * 0.55 };
  }

  function pctPos(px, py) {
    const { w, h } = arenaSize();
    return { x: w * px, y: h * py };
  }

  function shouldUseBossPhase() {
    if (ctx.run === 'research') return false;
    if (ctx.boss === '1') return true;
    if (ctx.boss === '0') return false;
    return String(ctx.diff).toLowerCase() !== 'easy';
  }

  function makePosts() {
    const c = centerPos();

    return [
      {
        id: 1,
        key: 'center_star',
        title: 'Center Star',
        cue: 'อยู่กลางและค้างไว้',
        coach: 'ยืนให้นิ่งในวงดาวกลาง',
        type: 'hold',
        target: { x: c.x, y: c.y },
        holdMs: 3200,
        radius: cfg.zoneRadius,
        ghost: 'center'
      },
      {
        id: 2,
        key: 'left_right',
        title: 'Left / Right Star',
        cue: 'ซ้าย แล้ว ขวา',
        coach: 'ย้ายสมดุลตามดาวซ้ายและขวา',
        type: 'sequence-hold',
        steps: [
          { label: 'ซ้าย', target: pctPos(0.32, 0.56), holdMs: 1500, radius: cfg.zoneRadius },
          { label: 'กลาง', target: pctPos(0.50, 0.56), holdMs: 900, radius: cfg.zoneRadius },
          { label: 'ขวา', target: pctPos(0.68, 0.56), holdMs: 1500, radius: cfg.zoneRadius }
        ],
        ghost: 'left-right'
      },
      {
        id: 3,
        key: 'one_leg',
        title: 'One-Leg Freeze',
        cue: rand() < 0.5 ? 'ค้างขาซ้าย' : 'ค้างขาขวา',
        coach: 'ค้างท่าขาเดียวให้นิ่ง',
        type: 'hold',
        target: pctPos(rand() < 0.5 ? 0.42 : 0.58, 0.48),
        holdMs: 2800,
        radius: cfg.zoneRadius - 8,
        ghost: 'one-leg'
      },
      {
        id: 4,
        key: 'forward_reach',
        title: 'Forward Reach',
        cue: 'ค่อย ๆ เอนไปด้านหน้า',
        coach: 'ตามเป้าไปช้า ๆ แล้วค้าง',
        type: 'moving-hold',
        from: pctPos(0.50, 0.60),
        to: pctPos(0.50, 0.38),
        moveMs: 1900,
        holdMs: 1800,
        radius: cfg.zoneRadius - 6,
        ghost: 'forward'
      },
      {
        id: 5,
        key: 'beam_step',
        title: 'Beam Step + Hold',
        cue: 'เดินตามจุดแล้วหยุดค้าง',
        coach: 'ไปตามเส้นและหยุดให้ตรงจุด',
        type: 'path-stop',
        path: [
          { label: 'จุด 1', target: pctPos(0.38, 0.60), holdMs: 900, radius: cfg.zoneRadius - 10 },
          { label: 'จุด 2', target: pctPos(0.50, 0.52), holdMs: 1100, radius: cfg.zoneRadius - 10 },
          { label: 'จุด 3', target: pctPos(0.62, 0.44), holdMs: 1300, radius: cfg.zoneRadius - 10 }
        ],
        ghost: 'beam'
      },
      {
        id: 6,
        key: 'finale',
        title: 'Rhythm Finale',
        cue: 'ทำตามจังหวะให้ครบชุด',
        coach: 'กลาง ซ้าย กลาง หน้า แล้วค้าง',
        type: 'sequence-hold',
        steps: [
          { label: 'กลาง', target: pctPos(0.50, 0.56), holdMs: 900, radius: cfg.zoneRadius - 6 },
          { label: 'ซ้าย', target: pctPos(0.34, 0.56), holdMs: 900, radius: cfg.zoneRadius - 6 },
          { label: 'กลาง', target: pctPos(0.50, 0.56), holdMs: 800, radius: cfg.zoneRadius - 6 },
          { label: 'หน้า', target: pctPos(0.50, 0.40), holdMs: 1200, radius: cfg.zoneRadius - 8 },
          { label: 'ค้าง', target: pctPos(0.50, 0.48), holdMs: 1600, radius: cfg.zoneRadius - 10 }
        ],
        ghost: 'finale'
      }
    ];
  }

  function buildBossPost() {
    return {
      id: 99,
      key: 'boss',
      title: 'Final Balance Boss',
      cue: 'FINAL BOSS',
      coach: 'ผ่าน 3 ช่วงของบอสให้ครบ',
      type: 'boss-hold',
      ghost: 'boss',
      stages: [
        {
          label: 'Center Lock',
          shortLabel: 'Center',
          holdMs: 1100,
          radius: Math.max(20, Math.round(cfg.zoneRadius * 0.92)),
          orbitAmp: 0,
          speed: 0,
          motion: 'center'
        },
        {
          label: 'Side Shift',
          shortLabel: 'Shift',
          holdMs: 1250,
          radius: Math.max(18, Math.round(cfg.zoneRadius * 0.82)),
          orbitAmp: 42,
          speed: 1.08,
          motion: 'side'
        },
        {
          label: 'Orbit Finale',
          shortLabel: 'Orbit',
          holdMs: 1450,
          radius: Math.max(16, Math.round(cfg.zoneRadius * 0.74)),
          orbitAmp: 56,
          speed: 1.42,
          motion: 'orbit'
        }
      ]
    };
  }

  let posts = makePosts();

  const G = {
    phase: 'intro',
    startedAt: 0,
    phaseAt: 0,
    postIndex: -1,
    stepIndex: 0,
    stepHoldMs: 0,

    totalScore: 0,
    stars: 0,
    combo: 0,
    bestCombo: 0,
    outCount: 0,
    recoverCount: 0,
    fallCount: 0,

    postResults: [],
    lastInZone: false,
    lastDist: 9999,

    beatAt: 0,
    beatPulse: 0,

    summaryShown: false,
    tutorialDone: false,
    lastInputAt: 0,
    recentMovePx: 0,

    scoreParts: {
      stability: 0,
      recovery: 0,
      routine: 0
    },

    antiCheese: {
      idleMs: 0,
      staleHoldMs: 0,
      microStillMs: 0
    },

    cursor: {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0
    },

    input: {
      active: false,
      tx: 0,
      ty: 0,
      pointerId: null
    },

    fx: {
      coachMoodTimer: 0,
      inZoneStableMs: 0,
      lastPerfectAt: 0,
      lastRecoverAt: 0
    }
  };

  function currentPost() {
    return posts[G.postIndex] || null;
  }

  let postMetric = null;

  function setPhase(phase) {
    G.phase = phase;
    G.phaseAt = nowMs();
    logEvent('phase_change', { phase });
  }

  function phaseElapsed() {
    return nowMs() - G.phaseAt;
  }

  function showOverlay(html) {
    elOverlay.hidden = false;
    elOverlay.innerHTML = html;
  }

  function hideOverlay() {
    elOverlay.hidden = true;
    elOverlay.innerHTML = '';
  }

  function setCue(text) {
    if (elCue) elCue.textContent = text || '';
  }

  function setCoach(text) {
    if (elCoach) elCoach.textContent = text || '';
  }

  function setCoachTextMood(text, mood = 'neutral') {
    setCoach(text);
    if (elCoach) {
      elCoach.classList.remove('is-happy', 'is-warn');
      if (mood === 'happy') elCoach.classList.add('is-happy');
      if (mood === 'warn') elCoach.classList.add('is-warn');
    }
  }

  function updateGhost(post) {
    if (!elGhost) return;
    elGhost.setAttribute('data-ghost', post?.ghost || 'center');
  }

  function kickClass(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function setCoachMood(mood = 'neutral', emoji = '') {
    if (!elCoachMood) return;
    elCoachMood.setAttribute('data-mood', mood);

    if (emoji) {
      elCoachMood.textContent = emoji;
    } else {
      if (mood === 'happy') elCoachMood.textContent = '😄';
      else if (mood === 'great') elCoachMood.textContent = '🤩';
      else if (mood === 'warn') elCoachMood.textContent = '😯';
      else if (mood === 'sad') elCoachMood.textContent = '🥺';
      else elCoachMood.textContent = '🙂';
    }

    kickClass(elCoachMood, 'bh-coach-bounce');

    clearTimeout(G.fx.coachMoodTimer);
    G.fx.coachMoodTimer = setTimeout(() => {
      if (elCoachMood) {
        elCoachMood.setAttribute('data-mood', 'neutral');
        elCoachMood.textContent = '🙂';
      }
    }, 900);
  }

  function flashSuccess() {
    kickClass(elSuccessFlash, 'bh-flash-on');
  }

  function pulseTarget() {
    kickClass(elTargetPulse, 'bh-pulse-on');
  }

  function showRecoverPop(text = 'Great!') {
    if (!elRecoverPop) return;
    elRecoverPop.textContent = text;
    kickClass(elRecoverPop, 'bh-pop-show');
  }

  function showPerfectPop(text = 'Perfect!') {
    if (!elPerfectPop) return;
    elPerfectPop.textContent = text;
    kickClass(elPerfectPop, 'bh-pop-show');
  }

  function showPostBanner(text = 'POST CLEAR!') {
    if (!elPostBanner) return;
    elPostBanner.textContent = text;
    kickClass(elPostBanner, 'bh-banner-show');
  }

  function starBurstAt(x, y, count = 8) {
    if (!elStarBurst) return;
    elStarBurst.innerHTML = '';
    elStarBurst.classList.add('bh-star-burst-on');

    for (let i = 0; i < count; i++) {
      const star = D.createElement('div');
      star.className = 'star';
      star.style.left = `${x}px`;
      star.style.top = `${y}px`;

      const ang = (Math.PI * 2 * i) / count;
      const radius = 42 + i * 6;
      const tx = Math.cos(ang) * radius;
      const ty = Math.sin(ang) * radius - 10;

      star.style.setProperty('--tx', `calc(-50% + ${tx}px)`);
      star.style.setProperty('--ty', `calc(-50% + ${ty}px)`);

      elStarBurst.appendChild(star);
      requestAnimationFrame(() => {
        star.classList.add('burst');
      });
    }

    setTimeout(() => {
      if (elStarBurst) {
        elStarBurst.classList.remove('bh-star-burst-on');
        elStarBurst.innerHTML = '';
      }
    }, 1050);
  }

  function celebrateAtTarget(multiplier = 1) {
    const x = G.cursor.x || centerPos().x;
    const y = G.cursor.y || centerPos().y;
    pulseTarget();
    flashSuccess();
    starBurstAt(x, y, multiplier >= 3 ? 12 : multiplier === 2 ? 10 : 8);
  }

  function updateHUD() {
    const totalPosts = posts.length;
    const currentShown = clamp(G.postIndex + 1, 0, totalPosts);

    if (elPost) {
      elPost.textContent = currentShown > 0 ? `Post ${currentShown} / ${totalPosts}` : 'Practice';
    }
    if (elStars) {
      elStars.textContent = `⭐ ${G.stars}`;
    }
    if (elScore) {
      elScore.textContent = `${G.totalScore}`;
    }

    if (elProgress) {
      elProgress.innerHTML = posts.map((p, i) => {
        const done = i < G.postResults.length;
        const active = i === G.postIndex && G.phase !== 'summary';
        const cls = done ? 'done' : active ? 'active' : '';
        return `<span class="bh-dot ${cls}">${i + 1}</span>`;
      }).join('');
    }
  }

  function placeEl(el, x, y, r = null) {
    if (!el) return;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    if (r != null) {
      el.style.width = `${r * 2}px`;
      el.style.height = `${r * 2}px`;
      el.style.marginLeft = `${-r}px`;
      el.style.marginTop = `${-r}px`;
    }
  }

  function resetCursor() {
    const c = centerPos();
    G.cursor.x = c.x;
    G.cursor.y = c.y;
    G.cursor.vx = 0;
    G.cursor.vy = 0;
    G.input.tx = c.x;
    G.input.ty = c.y;
  }

  function resetStepArming() {
    if (!postMetric) return;
    postMetric.armed = false;
    postMetric.movePx = 0;
  }

  function resetAntiCheeseState() {
    G.antiCheese.idleMs = 0;
    G.antiCheese.staleHoldMs = 0;
    G.antiCheese.microStillMs = 0;
  }

  function addScore(n, reason = '') {
    const before = G.totalScore;
    G.totalScore += Math.max(0, n | 0);
    if (G.totalScore !== before) {
      emitWindowEvent('hha:score', {
        gameId: ctx.gameId,
        score: G.totalScore,
        delta: G.totalScore - before,
        reason
      });
    }
  }

  function addStars(n, reason = '') {
    G.stars += Math.max(0, n | 0);
    emitWindowEvent('quest:update', {
      gameId: ctx.gameId,
      stars: G.stars,
      reason
    });
  }

  function postMetricsBase(post) {
    return {
      id: post.id,
      key: post.key,
      title: post.title,
      cleared: false,
      score: 0,
      stars: 0,
      inZoneMs: 0,
      holdOkMs: 0,
      outCount: 0,
      recoverCount: 0,
      avgDist: 0,
      distSamples: 0,
      avgDistFinal: 0,
      stepCount: 0,

      armed: false,
      movePx: 0,
      outStartedAt: 0,
      recoveryPts: 0,
      stabilityPts: 0,
      routinePts: 0,

      armAt: 0,
      timeToArmMs: 0,
      validHoldMs: 0,
      invalidHoldMs: 0,
      recoveryLatencySum: 0,
      recoveryLatencyN: 0,
      idleWarns: 0,
      cheeseFlags: 0,
      holdBreakCount: 0,
      quality: 0,
      validHoldRatio: 0,

      bossStageClears: 0,
      bossPassed: false
    };
  }

  function getControlScale() {
    const inputAge = nowMs() - G.lastInputAt;
    const activeRecently = G.input.active || inputAge < 220;
    const movement = G.recentMovePx;

    if (!activeRecently) return 0.12;
    if (movement < 0.35) return 0.45;
    return 1;
  }

  function getValidControlFactor() {
    const inputAge = nowMs() - G.lastInputAt;
    const moved = G.recentMovePx;

    if (inputAge > 520) return 0;
    if (moved < 0.18) return 0.15;
    if (moved < 0.45) return 0.5;
    return 1;
  }

  function getCenterBias(d, r) {
    if (!r || r <= 0) return 1;
    return clamp(1 - (d / r), 0, 1);
  }

  function getPostQuality(meta) {
    if (!meta) return 0;

    const validRatio =
      (meta.validHoldMs + meta.invalidHoldMs) > 0
        ? meta.validHoldMs / (meta.validHoldMs + meta.invalidHoldMs)
        : 0;

    const avgRecovery =
      meta.recoveryLatencyN > 0
        ? meta.recoveryLatencySum / meta.recoveryLatencyN
        : 9999;

    let score = 100;
    score -= Math.min(28, meta.outCount * 8);
    score -= Math.min(20, meta.idleWarns * 6);
    score -= Math.min(18, meta.cheeseFlags * 6);
    score -= Math.min(20, Math.max(0, 0.82 - validRatio) * 60);

    if (avgRecovery < 700) score += 6;
    else if (avgRecovery > 1800 && avgRecovery < 9999) score -= 6;

    if (meta.avgDistFinal <= Math.round(cfg.zoneRadius * 0.48)) score += 6;
    return clamp(Math.round(score), 0, 100);
  }

  function calcGradeFromSummary({ focusScore = 0, validHoldRatio = 0, avgRecoveryLatency = 0, outCount = 0, cheeseFlags = 0 }) {
    let pts = Number(focusScore || 0);
    pts += validHoldRatio >= 0.9 ? 8 : validHoldRatio >= 0.8 ? 4 : -8;
    pts += avgRecoveryLatency > 0 && avgRecoveryLatency < 900 ? 5 : 0;
    pts -= Math.min(16, outCount * 2);
    pts -= Math.min(16, cheeseFlags * 4);

    if (pts >= 92) return 'S';
    if (pts >= 84) return 'A';
    if (pts >= 74) return 'B';
    if (pts >= 62) return 'C';
    return 'D';
  }

  function getStrengthLabel(summary) {
    const validRatio = Number(summary?.validHoldRatio || 0);
    const avgRecovery = Number(summary?.avgRecoveryLatency || 0);
    const qualityAvg = Number(summary?.qualityAvg || 0);
    const bestCombo = Number(summary?.bestCombo || 0);
    const outCount = Number(summary?.outCount || 0);

    if (validRatio >= 0.9 && outCount <= 2) return 'คุมสมดุลได้นิ่งและแม่น';
    if (avgRecovery > 0 && avgRecovery <= 900) return 'ดึงสมดุลกลับเข้าเป้าได้เร็ว';
    if (qualityAvg >= 85) return 'ควบคุมแต่ละฐานได้สม่ำเสมอ';
    if (bestCombo >= 4) return 'รักษาความต่อเนื่องของ routine ได้ดี';
    return 'เริ่มคุมทิศทางและจังหวะได้ดีขึ้น';
  }

  function getSupportLabel(summary) {
    const validRatio = Number(summary?.validHoldRatio || 0);
    const avgRecovery = Number(summary?.avgRecoveryLatency || 0);
    const cheeseFlags = Number(summary?.cheeseFlags || 0);
    const outCount = Number(summary?.outCount || 0);
    const hardestPost = String(summary?.hardestPost || '-');

    if (cheeseFlags >= 2) return 'ควรฝึกการคุมอย่างต่อเนื่อง ไม่ค้างนิ่งแบบเดาเป้า';
    if (validRatio < 0.72) return 'ควรฝึกการคุมให้เกมนับเป็น valid hold มากขึ้น';
    if (outCount >= 5) return 'ควรฝึกการอยู่ในเป้าให้นิ่งขึ้น ลดการหลุดออกนอกวง';
    if (avgRecovery > 1600) return 'ควรฝึกการ recover หลังหลุดให้เร็วขึ้น';
    if (hardestPost && hardestPost !== '-') return `ควรฝึกฐาน ${hardestPost} เพิ่มอีกเล็กน้อย`;
    return 'ควรฝึกความสม่ำเสมอของการคุมสมดุล';
  }

  function getTeacherSuggestion(summary) {
    const validRatio = Number(summary?.validHoldRatio || 0);
    const avgRecovery = Number(summary?.avgRecoveryLatency || 0);
    const outCount = Number(summary?.outCount || 0);
    const focusScore = Number(summary?.focusScore || 0);
    const hardestPost = String(summary?.hardestPost || '-');
    const bossEnabled = !!summary?.bossEnabled;
    const bossPassed = !!summary?.bossPassed;

    const tips = [];

    if (validRatio < 0.8) tips.push('ให้ฝึกคุมเป้าแบบช้าและต่อเนื่องก่อนเพิ่มความเร็ว');
    if (avgRecovery > 1400) tips.push('ให้ซ้อมหลุดแล้วกลับเข้าเป้าเป็นช่วงสั้น ๆ 10–15 วินาที');
    if (outCount >= 4) tips.push('ลดการแกว่งของมือและตัวโดยเริ่มจากฐานกลาง');
    if (focusScore < 75) tips.push('เริ่มจากฐานกลางและฐานกว้างก่อน แล้วค่อยไปฐานที่เปลี่ยนตำแหน่ง');
    if (hardestPost && hardestPost !== '-') tips.push(`เน้นฝึกฐาน ${hardestPost} แบบแยกเดี่ยวก่อนเล่นทั้ง routine`);
    if (bossEnabled && !bossPassed) tips.push('ควรฝึกช่วงท้ายแบบต่อเนื่องเพื่อเตรียมผ่านบอส');

    return tips.length ? tips.slice(0, 2).join(' • ') : 'พร้อมฝึกรอบมาตรฐานต่อได้';
  }

  function getChildMessage(summary) {
    const grade = String(summary?.grade || 'C');
    const bestPost = String(summary?.bestPost || '-');
    const strength = getStrengthLabel(summary);

    if (grade === 'S' || grade === 'A') {
      return `เยี่ยมมาก! วันนี้หนู${strength} และเด่นที่ฐาน ${bestPost}`;
    }
    if (grade === 'B') {
      return `เก่งขึ้นมาก! วันนี้หนู${strength} ลองฝึกอีกนิดจะนิ่งขึ้นอีก`;
    }
    return 'วันนี้ทำได้ดีแล้วนะ ลองคุมให้แม่นขึ้น แล้วกลับเข้าเป้าให้ไวขึ้นอีกนิด';
  }

  function buildTeacherObservation(summary) {
    const parts = [];

    if ((summary?.validHoldRatio || 0) >= 0.9) parts.push('คุมเป้าได้แม่นและสม่ำเสมอ');
    else if ((summary?.validHoldRatio || 0) >= 0.8) parts.push('คุมเป้าได้ดีในภาพรวม');
    else parts.push('ยังต้องฝึกการคุมให้เกมนับเป็น valid hold มากขึ้น');

    if ((summary?.avgRecoveryLatency || 0) > 0) {
      if ((summary.avgRecoveryLatency || 0) <= 900) parts.push('recover กลับเข้าเป้าได้เร็ว');
      else if ((summary.avgRecoveryLatency || 0) >= 1600) parts.push('recover หลังหลุดยังช้า');
    }

    if ((summary?.cheeseFlags || 0) >= 2) parts.push('มีสัญญาณคุมไม่ต่อเนื่องหรือนิ่งหลอก');
    if ((summary?.hardestPost || '-') !== '-') parts.push(`ควรติดตามฐาน ${summary.hardestPost}`);
    if (summary?.bossEnabled) {
      parts.push(summary?.bossPassed ? 'ผ่าน Final Boss แล้ว' : 'ยังไม่ผ่าน Final Boss');
    }

    return parts.join(' • ');
  }

  function buildTeacherExportRecord(summary) {
    return {
      exported_at: new Date().toISOString(),
      session_id: summary.sessionId || sessionId || '',
      pid: ctx.pid || 'anon',
      player_name: summary.name || ctx.name || 'Player',
      game_id: ctx.gameId || 'balancehold',
      diff: ctx.diff || 'normal',
      run: ctx.run || 'play',
      seed: ctx.seed || '',
      score_total: summary.score || 0,
      stars_total: summary.stars || 0,
      rank: summary.rank || '',
      grade: summary.grade || '',
      focus_score: summary.focusScore || 0,
      best_combo: summary.bestCombo || 0,
      out_count: summary.outCount || 0,
      recover_count: summary.recoverCount || 0,
      valid_hold_ratio: Number(summary.validHoldRatio || 0),
      avg_recovery_latency_ms: summary.avgRecoveryLatency || 0,
      quality_avg: summary.qualityAvg || 0,
      cheese_flags: summary.cheeseFlags || 0,
      idle_warns: summary.idleWarns || 0,
      best_post: summary.bestPost || '',
      hardest_post: summary.hardestPost || '',
      stability_points: summary.scoreParts?.stability || 0,
      recovery_points: summary.scoreParts?.recovery || 0,
      routine_points: summary.scoreParts?.routine || 0,
      strength_label: summary.strengthLabel || '',
      support_label: summary.supportLabel || '',
      teacher_suggestion: summary.teacherSuggestion || '',
      child_message: summary.childMessage || '',
      boss_enabled: summary.bossEnabled ? 1 : 0,
      boss_passed: summary.bossPassed ? 1 : 0,
      boss_score: summary.bossScore || 0,
      boss_stars: summary.bossStars || 0,
      boss_stage_clears: summary.bossStageClears || 0,
      adaptive_enabled: 0,
      adaptive_profile: 'off',
      adaptive_label: 'Adaptive: Off',
      adaptive_target_scale: 1,
      adaptive_hold_scale: 1,
      adaptive_move_scale: 1,
      adaptive_drift_scale: 1,
      observation: buildTeacherObservation(summary),
      planner_strict: ctx.plannerStrict ? 1 : 0
    };
  }

  function buildTeacherCsv(summary) {
    const row = buildTeacherExportRecord(summary);
    const headers = Object.keys(row);
    const values = headers.map((k) => csvCell(row[k]));
    return [headers.join(','), values.join(',')].join('\n');
  }

  function buildTeacherText(summary) {
    return [
      'Balance Hold Report',
      `Player: ${summary.name || ctx.name || 'Player'}`,
      `PID: ${ctx.pid || 'anon'}`,
      `Grade: ${summary.grade || 'C'}`,
      `Rank: ${summary.rank || '-'}`,
      `Score: ${summary.score || 0}`,
      `Stars: ${summary.stars || 0}`,
      `Best Post: ${summary.bestPost || '-'}`,
      `Hardest Post: ${summary.hardestPost || '-'}`,
      `Focus Score: ${summary.focusScore || 0}`,
      `Valid Hold Ratio: ${Math.round((summary.validHoldRatio || 0) * 100)}%`,
      `Average Recovery Latency: ${summary.avgRecoveryLatency || 0} ms`,
      `Out Count: ${summary.outCount || 0}`,
      `Recovery Count: ${summary.recoverCount || 0}`,
      `Cheese Flags: ${summary.cheeseFlags || 0}`,
      `Idle Warns: ${summary.idleWarns || 0}`,
      `Boss Enabled: ${summary.bossEnabled ? 'Yes' : 'No'}`,
      `Boss Passed: ${summary.bossPassed ? 'Yes' : 'No'}`,
      `Boss Score: ${summary.bossScore || 0}`,
      `Boss Stars: ${summary.bossStars || 0}`,
      `Strength: ${summary.strengthLabel || '-'}`,
      `Support: ${summary.supportLabel || '-'}`,
      `Next Suggestion: ${summary.teacherSuggestion || '-'}`,
      `Observation: ${buildTeacherObservation(summary)}`,
      `Planner Strict: ${ctx.plannerStrict ? 'Yes' : 'No'}`
    ].join('\n');
  }

  function saveTeacherExportSnapshot(summary) {
    try {
      const record = buildTeacherExportRecord(summary);
      localStorage.setItem(TEACHER_EXPORT_LAST_KEY, JSON.stringify(record));
    } catch (_) {}
  }

  async function copyTeacherSummary(summary) {
    const text = buildTeacherText(summary);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        toast('คัดลอกสรุปสำหรับครูแล้ว');
      } else {
        toast('อุปกรณ์นี้คัดลอกอัตโนมัติไม่ได้');
      }
    } catch (_) {
      toast('คัดลอกไม่ได้บนอุปกรณ์นี้');
    }
  }

  function downloadTeacherCsv(summary) {
    const csv = buildTeacherCsv(summary);
    const pid = ctx.pid || 'anon';
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    downloadTextFile(`balance-hold-teacher-${pid}-${ts}.csv`, csv, 'text/csv;charset=utf-8');
    toast('ดาวน์โหลด CSV แล้ว');
  }

  function getBossStage(post) {
    if (!post || !Array.isArray(post.stages) || !post.stages.length) return null;
    const idx = clamp(G.stepIndex || 0, 0, post.stages.length - 1);
    return post.stages[idx];
  }

  function getBossTarget(post) {
    const stage = getBossStage(post);
    if (!stage) return null;

    const c = centerPos();
    const t = phaseElapsed() * 0.001;

    let x = c.x;
    let y = c.y;

    if (stage.motion === 'side') {
      x = c.x + Math.sin(t * stage.speed) * stage.orbitAmp;
      y = c.y + Math.sin(t * stage.speed * 0.52) * (stage.orbitAmp * 0.18);
    } else if (stage.motion === 'orbit') {
      x = c.x + Math.cos(t * stage.speed) * stage.orbitAmp;
      y = c.y + Math.sin(t * stage.speed * 0.92) * (stage.orbitAmp * 0.62);
    }

    return {
      label: stage.label,
      x,
      y,
      radius: stage.radius,
      holdMs: stage.holdMs
    };
  }

  function setBossStagePresentation(post) {
    const stage = getBossStage(post);
    if (!stage) return;
    updateGhost({ ghost: 'boss' });
    setCue(`BOSS • ${stage.shortLabel || stage.label}`);
    setCoachMood('great', '😤');
    setCoachTextMood(`Final Boss: ${stage.label}`, 'neutral');
  }

  function getActiveTarget(post) {
    if (!post) return null;
    const sessionHoldScale = cfg.holdScale * dur.holdScale;

    if (post.type === 'hold') {
      return {
        label: post.cue,
        x: post.target.x,
        y: post.target.y,
        radius: post.radius,
        holdMs: post.holdMs * sessionHoldScale
      };
    }

    if (post.type === 'sequence-hold') {
      const step = post.steps[G.stepIndex] || post.steps[post.steps.length - 1];
      return {
        label: step.label,
        x: step.target.x,
        y: step.target.y,
        radius: step.radius,
        holdMs: step.holdMs * sessionHoldScale
      };
    }

    if (post.type === 'moving-hold') {
      const t = clamp(phaseElapsed() / post.moveMs, 0, 1);
      const mx = lerp(post.from.x, post.to.x, t);
      const my = lerp(post.from.y, post.to.y, t);
      if (t < 1) {
        return {
          label: 'ตามเป้า',
          x: mx,
          y: my,
          radius: post.radius,
          holdMs: 0
        };
      }
      return {
        label: 'ค้าง',
        x: post.to.x,
        y: post.to.y,
        radius: post.radius,
        holdMs: post.holdMs * sessionHoldScale
      };
    }

    if (post.type === 'path-stop') {
      const step = post.path[G.stepIndex] || post.path[post.path.length - 1];
      return {
        label: step.label,
        x: step.target.x,
        y: step.target.y,
        radius: step.radius,
        holdMs: step.holdMs * sessionHoldScale
      };
    }

    if (post.type === 'boss-hold') {
      return getBossTarget(post);
    }

    return null;
  }

  function pointerToArena(e) {
    const r = getArenaRect();
    return {
      x: clamp(e.clientX - r.left, 0, r.width),
      y: clamp(e.clientY - r.top, 0, r.height)
    };
  }

  function onPointerDown(e) {
    G.input.active = true;
    G.input.pointerId = e.pointerId;
    const p = pointerToArena(e);
    G.input.tx = p.x;
    G.input.ty = p.y;
    G.lastInputAt = nowMs();
    try { arena.setPointerCapture(e.pointerId); } catch (_) {}

    logEvent('pointer_down', {
      x: Math.round(p.x),
      y: Math.round(p.y)
    });
  }

  function onPointerMove(e) {
    if (!G.input.active) return;
    if (G.input.pointerId != null && e.pointerId !== G.input.pointerId) return;
    const p = pointerToArena(e);
    G.input.tx = p.x;
    G.input.ty = p.y;
    G.lastInputAt = nowMs();
  }

  function onPointerUp(e) {
    if (G.input.pointerId != null && e.pointerId !== G.input.pointerId) return;
    G.input.active = false;
    G.input.pointerId = null;
    const c = centerPos();
    G.input.tx = c.x;
    G.input.ty = c.y;
    G.lastInputAt = nowMs();
    logEvent('pointer_up');
  }

  arena.addEventListener('pointerdown', onPointerDown);
  W.addEventListener('pointermove', onPointerMove);
  W.addEventListener('pointerup', onPointerUp);
  W.addEventListener('pointercancel', onPointerUp);

  function showTutorialOverlay() {
    showOverlay(`
      <div class="bh-summary-card">
        <h2>Balance Hold เล่นยังไง</h2>

        <div class="bh-summary-sub">
          <div>1. ขยับก่อน เกมถึงจะเริ่มนับ</div>
          <div>2. เข้าเป้าแล้วค้างตามจังหวะ</div>
          <div>3. หลุดแล้วดึงกลับเข้าเป้าให้ไว</div>
          <div>4. คะแนนมาจากความนิ่ง + recovery + routine</div>
        </div>

        <div class="bh-summary-actions">
          <button id="bhTutorialStartBtn" type="button">เริ่มเลย</button>
          <button id="bhTutorialSkipBtn" type="button">ข้ามคำอธิบาย</button>
        </div>
      </div>
    `);

    const done = () => {
      hideOverlay();
      G.tutorialDone = true;
      setPhase('intro');
      setCoachMood('neutral', '🙂');
      setCoachTextMood('ลองขยับก่อน แล้วค่อยคุมให้นิ่ง', 'neutral');
      logEvent('tutorial_done');
    };

    const startBtn = $('#bhTutorialStartBtn', elOverlay);
    const skipBtn = $('#bhTutorialSkipBtn', elOverlay);

    if (startBtn) startBtn.addEventListener('click', done);
    if (skipBtn) skipBtn.addEventListener('click', done);
  }

  function startPractice() {
    setPhase('practice');
    resetCursor();
    setCue('ลองอยู่ในวงกลาง');
    setCoachMood('neutral', '🙂');
    setCoachTextMood('ฝึก 15 วินาที', 'neutral');
    placeEl(elTarget, centerPos().x, centerPos().y, cfg.zoneRadius + 8);
    placeEl(elTargetPulse, centerPos().x, centerPos().y, cfg.zoneRadius + 8);
    updateGhost({ ghost: 'center' });
    postMetric = null;

    logEvent('practice_start', {
      practiceMs: dur.practiceMs
    });
  }

  function startPost(i) {
    G.postIndex = i;
    G.stepIndex = 0;
    G.stepHoldMs = 0;
    G.lastInZone = false;
    G.lastDist = 9999;
    G.fx.inZoneStableMs = 0;

    const post = currentPost();
    if (!post) {
      finishGame();
      return;
    }

    postMetric = postMetricsBase(post);
    updateGhost(post);
    resetStepArming();
    resetAntiCheeseState();

    if (post.type === 'boss-hold') {
      setBossStagePresentation(post);
    } else {
      setCue(post.cue);
      setCoachMood('neutral', '🙂');
      setCoachTextMood('ขยับก่อน แล้วเข้าเป้าให้แม่น', 'neutral');
    }

    setPhase('post-enter');
    updateHUD();

    logEvent('post_start', {
      post_id: post.id,
      post_key: post.key,
      post_title: post.title,
      is_boss: post.type === 'boss-hold' ? 1 : 0
    });
  }

  function beginPostActive() {
    const post = currentPost();
    if (!post) return;
    setPhase('post-active');
    G.stepHoldMs = 0;
    G.lastInZone = false;
    resetStepArming();
    resetAntiCheeseState();

    if (post.type === 'boss-hold') {
      setBossStagePresentation(post);
    }

    logEvent('post_active', {
      post_id: post.id,
      post_key: post.key
    });
  }

  function clearPost() {
    const post = currentPost();
    if (!post || !postMetric) return;

    postMetric.cleared = true;
    postMetric.avgDistFinal = postMetric.distSamples
      ? Math.round(postMetric.avgDist / postMetric.distSamples)
      : 0;

    const validRatio =
      (postMetric.validHoldMs + postMetric.invalidHoldMs) > 0
        ? postMetric.validHoldMs / (postMetric.validHoldMs + postMetric.invalidHoldMs)
        : 0;

    const quality = getPostQuality(postMetric);

    let stars = 1;
    if (quality >= 72) stars++;
    if (quality >= 86) stars++;
    stars = clamp(stars, 1, 3);
    postMetric.stars = stars;

    postMetric.stabilityPts = Math.round(postMetric.validHoldMs * 0.055 + postMetric.inZoneMs * 0.015);
    postMetric.routinePts = Math.max(40, 40 + stars * 55 + Math.round(quality * 0.6) - postMetric.outCount * 8);
    postMetric.recoveryPts = Math.max(0, postMetric.recoveryPts - postMetric.cheeseFlags * 6);

    if (post.type === 'boss-hold') {
      postMetric.bossPassed = true;
      postMetric.routinePts += 110 + postMetric.bossStageClears * 24;
    }

    postMetric.score =
      postMetric.stabilityPts +
      postMetric.recoveryPts +
      postMetric.routinePts;

    postMetric.quality = quality;
    postMetric.validHoldRatio = validRatio;

    G.scoreParts.stability += postMetric.stabilityPts;
    G.scoreParts.recovery += postMetric.recoveryPts;
    G.scoreParts.routine += postMetric.routinePts;

    G.postResults.push(postMetric);

    addStars(stars, 'post_clear');
    addScore(postMetric.score, 'post_clear');

    G.combo++;
    G.bestCombo = Math.max(G.bestCombo, G.combo);

    setPhase('post-clear');
    setCue(post.type === 'boss-hold' ? 'Boss Clear!' : 'ผ่านด่าน!');
    setCoachMood(stars >= 3 ? 'great' : 'happy', stars >= 3 ? '🤩' : '😄');
    setCoachTextMood(
      post.type === 'boss-hold'
        ? `Final Boss ผ่านแล้ว! ได้ ${stars} ดาว`
        : `เก่งมาก ได้ ${stars} ดาว`,
      'happy'
    );
    showPostBanner(post.type === 'boss-hold' ? 'BOSS CLEAR!' : (stars >= 3 ? 'AMAZING!' : 'POST CLEAR!'));
    celebrateAtTarget(stars);
    updateHUD();

    emitWindowEvent('quest:update', {
      gameId: ctx.gameId,
      postId: post.id,
      cleared: true,
      stars,
      score: postMetric.score
    });

    logEvent('post_clear', {
      post_id: post.id,
      post_key: post.key,
      post_title: post.title,
      post_score: postMetric.score,
      post_stars: postMetric.stars,
      post_in_zone_ms: Math.round(postMetric.inZoneMs),
      post_hold_ok_ms: Math.round(postMetric.holdOkMs),
      post_valid_hold_ms: Math.round(postMetric.validHoldMs),
      post_invalid_hold_ms: Math.round(postMetric.invalidHoldMs),
      post_valid_hold_ratio: Number(validRatio.toFixed(4)),
      post_out_count: postMetric.outCount,
      post_recover_count: postMetric.recoverCount,
      post_avg_dist: postMetric.avgDistFinal,
      post_time_to_arm_ms: postMetric.timeToArmMs,
      post_idle_warns: postMetric.idleWarns,
      post_cheese_flags: postMetric.cheeseFlags,
      post_quality: quality,
      stability_pts: postMetric.stabilityPts,
      recovery_pts: postMetric.recoveryPts,
      routine_pts: postMetric.routinePts,
      is_boss: post.type === 'boss-hold' ? 1 : 0,
      boss_stage_clears: postMetric.bossStageClears || 0
    });
  }

  function failSoft() {
    G.combo = 0;
  }

  function nextPost() {
    if (G.postIndex + 1 >= posts.length) {
      finishGame();
    } else {
      startPost(G.postIndex + 1);
    }
  }

  function calcRank(stars) {
    if (stars >= 16) return 'Excellent';
    if (stars >= 12) return 'Great';
    if (stars >= 8) return 'Good';
    return 'Try Again';
  }

  function buildSummaryPayload() {
    const passed = G.postResults.filter(x => x.cleared).length;
    const best = [...G.postResults].sort((a, b) => b.score - a.score)[0] || null;
    const hardest = [...G.postResults].sort((a, b) => b.outCount - a.outCount)[0] || null;

    const validHoldMs = G.postResults.reduce((s, x) => s + (x.validHoldMs || 0), 0);
    const invalidHoldMs = G.postResults.reduce((s, x) => s + (x.invalidHoldMs || 0), 0);
    const cheeseFlags = G.postResults.reduce((s, x) => s + (x.cheeseFlags || 0), 0);
    const idleWarns = G.postResults.reduce((s, x) => s + (x.idleWarns || 0), 0);

    const validHoldRatio =
      (validHoldMs + invalidHoldMs) > 0
        ? validHoldMs / (validHoldMs + invalidHoldMs)
        : 0;

    const recoveryLatencyVals = G.postResults
      .filter(x => (x.recoveryLatencyN || 0) > 0)
      .map(x => x.recoveryLatencySum / x.recoveryLatencyN);

    const avgRecoveryLatency = recoveryLatencyVals.length
      ? Math.round(recoveryLatencyVals.reduce((a, b) => a + b, 0) / recoveryLatencyVals.length)
      : 0;

    const qualityAvg = G.postResults.length
      ? Math.round(G.postResults.reduce((s, x) => s + (x.quality || 0), 0) / G.postResults.length)
      : 0;

    const focusScore = clamp(
      Math.round(
        qualityAvg * 0.6 +
        validHoldRatio * 30 +
        (G.bestCombo || 0) * 1.8 -
        G.outCount * 1.6 -
        cheeseFlags * 3
      ),
      0,
      100
    );

    const grade = calcGradeFromSummary({
      focusScore,
      validHoldRatio,
      avgRecoveryLatency,
      outCount: G.outCount,
      cheeseFlags
    });

    const bossResult = G.postResults.find((x) => x.key === 'boss') || null;
    const bossEnabled = posts.some((p) => p.key === 'boss');
    const bossPassed = !!bossResult?.bossPassed;
    const bossScore = bossResult?.score || 0;
    const bossStars = bossResult?.stars || 0;
    const bossStageClears = bossResult?.bossStageClears || 0;

    const baseSummary = {
      sessionId,
      game: ctx.game,
      gameId: ctx.gameId,
      zone: ctx.zone,
      mode: ctx.mode,
      run: ctx.run,
      pid: ctx.pid,
      name: ctx.name,
      studyId: ctx.studyId,
      diff: ctx.diff,
      view: ctx.view,
      time: ctx.time,
      seed: ctx.seed,
      score: G.totalScore,
      stars: G.stars,
      bestCombo: G.bestCombo,
      recoverCount: G.recoverCount,
      outCount: G.outCount,
      passedPosts: passed,
      totalPosts: posts.length,
      rank: calcRank(G.stars),
      bestPost: best ? best.title : '',
      hardestPost: hardest ? hardest.title : '',
      cooldownEnabled: ctx.cooldown,
      hub: ctx.plannerStrict ? bhPlannerReturnUrl() : ctx.hub,
      ts: new Date().toISOString(),
      validHoldMs,
      invalidHoldMs,
      validHoldRatio: Number(validHoldRatio.toFixed(4)),
      avgRecoveryLatency,
      qualityAvg,
      cheeseFlags,
      idleWarns,
      focusScore,
      grade,
      bossEnabled,
      bossPassed,
      bossScore,
      bossStars,
      bossStageClears,
      plannerStrict: ctx.plannerStrict ? 1 : 0,
      scoreParts: {
        stability: G.scoreParts.stability,
        recovery: G.scoreParts.recovery,
        routine: G.scoreParts.routine
      },
      posts: G.postResults.map((p) => ({
        id: p.id,
        key: p.key,
        title: p.title,
        cleared: p.cleared,
        score: p.score,
        stars: p.stars,
        inZoneMs: Math.round(p.inZoneMs),
        holdOkMs: Math.round(p.holdOkMs),
        validHoldMs: Math.round(p.validHoldMs || 0),
        invalidHoldMs: Math.round(p.invalidHoldMs || 0),
        validHoldRatio: Number((p.validHoldRatio || 0).toFixed(4)),
        outCount: p.outCount,
        recoverCount: p.recoverCount,
        avgDist: p.avgDistFinal,
        quality: p.quality || 0,
        isBoss: p.key === 'boss'
      }))
    };

    baseSummary.strengthLabel = getStrengthLabel(baseSummary);
    baseSummary.supportLabel = getSupportLabel(baseSummary);
    baseSummary.teacherSuggestion = getTeacherSuggestion(baseSummary);
    baseSummary.childMessage = getChildMessage(baseSummary);

    return baseSummary;
  }

  function finishGame() {
    if (G.summaryShown) return;
    G.summaryShown = true;

    setPhase('summary');
    const summary = buildSummaryPayload();

    saveSummaryPayload(summary);
    saveTeacherExportSnapshot(summary);
    saveSessionMeta({
      sessionId,
      pid: ctx.pid,
      gameId: ctx.gameId,
      score: G.totalScore,
      stars: G.stars,
      ts: summary.ts,
      plannerStrict: ctx.plannerStrict ? 1 : 0
    });

    logEvent('session_end', {
      final_score: summary.score,
      final_stars: summary.stars,
      best_combo: summary.bestCombo,
      recover_count: summary.recoverCount,
      out_count: summary.outCount,
      passed_posts: summary.passedPosts,
      total_posts: summary.totalPosts,
      rank: summary.rank,
      grade: summary.grade,
      focus_score: summary.focusScore,
      valid_hold_ratio: summary.validHoldRatio,
      avg_recovery_latency_ms: summary.avgRecoveryLatency,
      cheese_flags: summary.cheeseFlags,
      idle_warns: summary.idleWarns,
      boss_enabled: summary.bossEnabled ? 1 : 0,
      boss_passed: summary.bossPassed ? 1 : 0,
      boss_score: summary.bossScore || 0,
      boss_stars: summary.bossStars || 0,
      boss_stage_clears: summary.bossStageClears || 0,
      teacher_export_ready: 1,
      teacher_observation: buildTeacherObservation(summary),
      teacher_export_snapshot_key: TEACHER_EXPORT_LAST_KEY
    });

    flushEventBuffer('session_end');
    renderSummary(summary);
  }

  function buildCooldownUrl() {
    if (ctx.plannerStrict) {
      return bhPlannerReturnUrl();
    }

    const p = new URLSearchParams();

    const keys = [
      'pid', 'name', 'studyId', 'diff', 'time', 'view',
      'run', 'seed', 'api', 'debug', 'log', 'weekNo',
      'sessionNo', 'grade', 'teacher'
    ];

    keys.forEach((k) => {
      const v = ctx[k];
      if (v != null && v !== '') {
        p.set(k, String(v));
      }
    });

    p.set('zone', ctx.zone);
    p.set('cat', ctx.cat);
    p.set('game', ctx.game);
    p.set('gameId', ctx.gameId);
    p.set('mode', ctx.mode);
    p.set('phase', 'cooldown');
    p.set('gate', '1');
    p.set('cdur', String(ctx.cdur || 20));
    p.set('hub', ctx.hub);
    p.set('next', ctx.hub);
    p.set('from', 'balancehold');
    p.set('returnPhase', 'cooldown');

    return `../herohealth/warmup-gate.html?${p.toString()}`;
  }

  function safeNavigate(url, reason = 'navigate') {
    flushEventBuffer(reason);
    try {
      location.href = url;
    } catch (_) {
      location.assign(url);
    }
  }

  function renderSummary(summary) {
    const rows = summary.posts.map((p) => `
      <div class="bh-sum-row">
        <div>${p.id}. ${p.title}</div>
        <div>${p.stars}⭐</div>
        <div>${p.score}</div>
      </div>
    `).join('');

    const primaryLabel = ctx.plannerStrict
      ? 'กลับ Planner'
      : (ctx.cooldown ? 'คูลดาวน์แล้วกลับ HUB' : 'กลับ HUB');

    showOverlay(`
      <div class="bh-summary-card">
        <h2>Balance Hold Summary</h2>

        <div class="bh-summary-main">
          <div>ผ่าน ${summary.passedPosts}/${summary.totalPosts} ฐาน</div>
          <div>ดาวรวม ${summary.stars}</div>
          <div>คะแนน ${summary.score}</div>
          <div>ระดับ ${summary.rank} • Grade ${summary.grade}</div>
        </div>

        <div class="bh-summary-sub">
          <div>ฐานที่ดีที่สุด: ${summary.bestPost || '-'}</div>
          <div>ฐานที่ควรฝึกเพิ่ม: ${summary.hardestPost || '-'}</div>
          <div>Stability: ${summary.scoreParts?.stability || 0}</div>
          <div>Recovery: ${summary.scoreParts?.recovery || 0}</div>
        </div>

        <div class="bh-summary-sub">
          <div>Routine Bonus: ${summary.scoreParts?.routine || 0}</div>
          <div>Best Combo: ${summary.bestCombo}</div>
          <div>Recovery Count: ${summary.recoverCount}</div>
          <div>Out Count: ${summary.outCount}</div>
        </div>

        <div class="bh-summary-sub">
          <div>Valid Hold Ratio: ${Math.round((summary.validHoldRatio || 0) * 100)}%</div>
          <div>Avg Recovery: ${summary.avgRecoveryLatency || 0} ms</div>
          <div>Cheese Flags: ${summary.cheeseFlags || 0}</div>
          <div>Focus Score: ${summary.focusScore || 0}</div>
        </div>

        ${
          summary.bossEnabled
            ? `
            <div class="bh-summary-sub">
              <div>Boss: ${summary.bossPassed ? 'Cleared' : 'Not Cleared'}</div>
              <div>Boss Score: ${summary.bossScore || 0}</div>
              <div>Boss Stars: ${summary.bossStars || 0}</div>
              <div>Boss Stages: ${summary.bossStageClears || 0}/3</div>
            </div>
          `
            : ''
        }

        <div class="bh-summary-list">
          <div class="bh-sum-head">
            <div>ด่าน</div>
            <div>ดาว</div>
            <div>คะแนน</div>
          </div>
          ${rows}
        </div>

        <div class="bh-summary-sub" style="margin-top:12px">
          <div><b>จุดเด่น:</b> ${summary.strengthLabel || '-'}</div>
          <div><b>ควรฝึกเพิ่ม:</b> ${summary.supportLabel || '-'}</div>
          <div><b>คำแนะนำ:</b> ${summary.teacherSuggestion || '-'}</div>
          <div><b>ข้อความสำหรับเด็ก:</b> ${summary.childMessage || '-'}</div>
        </div>

        <div class="bh-summary-actions">
          <button id="bhRetryBtn" type="button">เล่นอีกครั้ง</button>
          <button id="bhNextBtn" type="button">${primaryLabel}</button>
        </div>

        <div class="bh-summary-actions">
          <button id="bhExportCsvBtn" type="button">ดาวน์โหลด CSV</button>
          <button id="bhCopyTeacherBtn" type="button">คัดลอกสรุปสำหรับครู</button>
        </div>
      </div>
    `);

    flashSuccess();
    setCoachMood('great', '🥳');
    showPostBanner(summary.bossPassed ? 'BOSS CLEAR!' : 'BALANCE COMPLETE!');

    const retryBtn = $('#bhRetryBtn', elOverlay);
    const nextBtn = $('#bhNextBtn', elOverlay);
    const exportCsvBtn = $('#bhExportCsvBtn', elOverlay);
    const copyTeacherBtn = $('#bhCopyTeacherBtn', elOverlay);

    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        logEvent('summary_action', { action: 'retry' });
        safeNavigate(location.pathname + location.search, 'retry');
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (ctx.plannerStrict) {
          logEvent('summary_action', { action: 'back_planner' });
          safeNavigate(bhPlannerReturnUrl(), 'back_planner');
          return;
        }

        if (ctx.cooldown) {
          logEvent('summary_action', { action: 'cooldown_then_hub' });
          safeNavigate(buildCooldownUrl(), 'cooldown_redirect');
        } else {
          logEvent('summary_action', { action: 'back_hub' });
          safeNavigate(ctx.hub, 'back_hub');
        }
      });
    }

    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => {
        downloadTeacherCsv(summary);
      });
    }

    if (copyTeacherBtn) {
      copyTeacherBtn.addEventListener('click', () => {
        copyTeacherSummary(summary);
      });
    }

    emitWindowEvent('hha:session-summary', summary);
    logEvent('summary_ready', {
      final_score: summary.score,
      final_stars: summary.stars,
      rank: summary.rank,
      grade: summary.grade
    });
  }

  function updateCursor(dt) {
    const prevX = G.cursor.x;
    const prevY = G.cursor.y;

    const inputStrength = G.input.active ? 0.22 : 0.10;

    const t = nowMs() * 0.001;
    const driftX = Math.sin(t * 1.6) * cfg.driftAmp;
    const driftY = Math.cos(t * 1.1) * cfg.driftAmp * 0.6;

    const tx = G.input.tx + driftX;
    const ty = G.input.ty + driftY;

    const ax = (tx - G.cursor.x) * inputStrength;
    const ay = (ty - G.cursor.y) * inputStrength;

    G.cursor.vx = (G.cursor.vx + ax) * 0.82;
    G.cursor.vy = (G.cursor.vy + ay) * 0.82;

    G.cursor.x += G.cursor.vx * dt * 0.06;
    G.cursor.y += G.cursor.vy * dt * 0.06;

    const { w, h } = arenaSize();
    G.cursor.x = clamp(G.cursor.x, 24, w - 24);
    G.cursor.y = clamp(G.cursor.y, 24, h - 24);

    const moved = dist(prevX, prevY, G.cursor.x, G.cursor.y);
    G.recentMovePx = G.recentMovePx * 0.84 + moved;

    if (G.input.active) {
      G.lastInputAt = nowMs();
    }
  }

  function updateBeat() {
    if (nowMs() - G.beatAt >= cfg.beatMs) {
      G.beatAt = nowMs();
      G.beatPulse = 1;
    } else {
      G.beatPulse *= 0.9;
    }

    if (elBeat) {
      elBeat.style.transform = `scale(${1 + G.beatPulse * 0.22})`;
      elBeat.style.opacity = `${0.18 + G.beatPulse * 0.65}`;
    }
  }

  function updateVisualState() {
    const post = currentPost();
    const target = post ? getActiveTarget(post) : null;

    if (!target) {
      elTarget?.classList.remove('is-in-zone', 'is-warning');
      elCursor?.classList.remove('is-in-zone', 'is-warning');
      return;
    }

    const d = dist(G.cursor.x, G.cursor.y, target.x, target.y);
    const inZone = d <= target.radius;
    const nearZone = d <= target.radius * 1.28;

    if (elTarget) {
      elTarget.classList.toggle('is-in-zone', inZone);
      elTarget.classList.toggle('is-warning', !inZone && nearZone);
    }

    if (elCursor) {
      elCursor.classList.toggle('is-in-zone', inZone);
      elCursor.classList.toggle('is-warning', !inZone && nearZone);
    }

    if (inZone) {
      G.fx.inZoneStableMs += 16;
    } else {
      G.fx.inZoneStableMs = 0;
    }

    if (
      G.phase === 'post-active' &&
      inZone &&
      G.fx.inZoneStableMs > 850 &&
      nowMs() - G.fx.lastPerfectAt > 1600
    ) {
      G.fx.lastPerfectAt = nowMs();
      kickClass(elTarget, 'bh-target-perfect');
      showPerfectPop('Perfect!');
      setCoachMood('great', '🤩');
      setCoachTextMood('นิ่งมาก! เยี่ยมเลย', 'happy');
    }
  }

  function updateBossPostLogic(dt, post, target) {
    const stage = getBossStage(post);
    if (!stage) return;

    placeEl(elTarget, target.x, target.y, target.radius);
    placeEl(elTargetPulse, target.x, target.y, target.radius);

    const d = dist(G.cursor.x, G.cursor.y, target.x, target.y);
    const inZone = d <= target.radius;
    const wasInZone = G.lastInZone;

    postMetric.avgDist += d;
    postMetric.distSamples += 1;
    postMetric.movePx += G.recentMovePx;

    if (!postMetric.armed && postMetric.movePx > 22) {
      postMetric.armed = true;
      postMetric.armAt = nowMs();
      postMetric.timeToArmMs = Math.max(0, Math.round(postMetric.armAt - G.phaseAt));
      setCoachMood('great', '😤');
      setCoachTextMood('Final Boss! เข้าเป้าแล้วคุมต่อเนื่องให้ครบ', 'great');
    }

    if (inZone) {
      postMetric.inZoneMs += dt;
    } else if (wasInZone && !inZone) {
      postMetric.outCount++;
      postMetric.outStartedAt = nowMs();
      postMetric.holdBreakCount++;
      G.outCount++;
      resetAntiCheeseState();
      failSoft();

      setCoachMood('warn', '😯');
      setCoachTextMood('Boss ยังไม่จบ ดึงกลับเข้าเป้าเร็ว ๆ', 'warn');

      logEvent('boss_out_zone', {
        post_id: post.id,
        post_key: post.key,
        stage_label: stage.label,
        post_out_count: postMetric.outCount
      });
    }

    if (!wasInZone && inZone && postMetric.outStartedAt) {
      postMetric.recoverCount++;
      G.recoverCount++;

      const outMs = nowMs() - postMetric.outStartedAt;
      const recPts = outMs < 700 ? 30 : outMs < 1400 ? 18 : 10;
      postMetric.recoveryPts += recPts;
      postMetric.recoveryLatencySum += outMs;
      postMetric.recoveryLatencyN += 1;
      postMetric.outStartedAt = 0;

      addScore(12, 'boss_recover');
      G.fx.lastRecoverAt = nowMs();

      showRecoverPop('Boss Recover!');
      pulseTarget();
      setCoachMood('happy', '😄');
      setCoachTextMood('ดีมาก กลับเข้าบอสได้แล้ว', 'happy');

      logEvent('boss_recover', {
        post_id: post.id,
        post_key: post.key,
        stage_label: stage.label,
        recovery_pts: recPts,
        recovery_latency_ms: Math.round(outMs)
      });
    }

    const controlScale = getControlScale();
    const validFactor = getValidControlFactor();
    const activeControl = controlScale >= 0.45 && validFactor >= 0.5;
    const centerBias = getCenterBias(d, target.radius);

    if (inZone && postMetric.armed) {
      const gain = dt * controlScale * validFactor;
      G.antiCheese.idleMs = validFactor <= 0.15 ? (G.antiCheese.idleMs + dt) : 0;
      G.antiCheese.microStillMs = G.recentMovePx < 0.18 ? (G.antiCheese.microStillMs + dt) : 0;

      if (activeControl) {
        G.stepHoldMs += gain;
        postMetric.holdOkMs += gain;
        postMetric.validHoldMs += gain;
      } else {
        postMetric.invalidHoldMs += dt;
        G.stepHoldMs = Math.max(0, G.stepHoldMs - dt * 0.62);
      }

      if (G.antiCheese.idleMs > 580) {
        G.antiCheese.idleMs = 0;
        postMetric.idleWarns++;
        setCoachMood('warn', '😬');
        setCoachTextMood('Boss ต้องคุมจริง อย่าค้างนิ่งเฉย ๆ', 'warn');
      }

      if (G.antiCheese.microStillMs > 1050) {
        G.antiCheese.microStillMs = 0;
        postMetric.cheeseFlags++;
        G.stepHoldMs = Math.max(0, G.stepHoldMs - 280);
        setCoachMood('warn', '😬');
        setCoachTextMood('บอสจะไม่นับ ถ้าคุมแบบนิ่งหลอก', 'warn');

        logEvent('boss_anti_cheese_flag', {
          post_id: post.id,
          post_key: post.key,
          stage_label: stage.label,
          cheese_flags: postMetric.cheeseFlags
        });
      }

      if (centerBias < 0.22) {
        postMetric.invalidHoldMs += dt * 0.4;
      }
    } else if (inZone && !postMetric.armed) {
      postMetric.invalidHoldMs += dt;
      setCoachMood('warn', '😯');
      setCoachTextMood('ขยับก่อน เกมถึงจะเริ่มนับ', 'warn');
    } else {
      resetAntiCheeseState();
      G.stepHoldMs = Math.max(0, G.stepHoldMs - dt * 0.35);
    }

    if (G.stepHoldMs >= stage.holdMs) {
      postMetric.stepCount++;
      postMetric.bossStageClears++;
      G.stepIndex++;
      G.stepHoldMs = 0;
      resetStepArming();
      resetAntiCheeseState();

      logEvent('boss_stage_clear', {
        post_id: post.id,
        post_key: post.key,
        cleared_stage_label: stage.label,
        cleared_stage_index: postMetric.stepCount
      });

      if (G.stepIndex >= post.stages.length) {
        clearPost();
        return;
      }

      setBossStagePresentation(post);
      setCoachMood('great', '🤩');
      setCoachTextMood('Boss stage ผ่านแล้ว ไปต่ออีกด่าน!', 'great');
    }

    G.lastInZone = inZone;
    G.lastDist = d;
  }

  function updatePostLogic(dt) {
    const post = currentPost();
    if (!post || !postMetric) return;

    const target = getActiveTarget(post);
    if (!target) return;

    if (post.type === 'boss-hold') {
      setBossStagePresentation(post);
      return updateBossPostLogic(dt, post, target);
    }

    placeEl(elTarget, target.x, target.y, target.radius);
    placeEl(elTargetPulse, target.x, target.y, target.radius);

    const d = dist(G.cursor.x, G.cursor.y, target.x, target.y);
    const inZone = d <= target.radius;
    const wasInZone = G.lastInZone;

    postMetric.avgDist += d;
    postMetric.distSamples += 1;
    postMetric.movePx += G.recentMovePx;

    const centerBias = getCenterBias(d, target.radius);

    if (!postMetric.armed && postMetric.movePx > 22) {
      postMetric.armed = true;
      postMetric.armAt = nowMs();
      postMetric.timeToArmMs = Math.max(0, Math.round(postMetric.armAt - G.phaseAt));
      setCoachMood('happy', '😄');
      setCoachTextMood('พร้อมแล้ว เข้าเป้าและค้างได้เลย', 'happy');
    }

    if (inZone) {
      postMetric.inZoneMs += dt;
    } else if (wasInZone && !inZone) {
      postMetric.outCount++;
      postMetric.outStartedAt = nowMs();
      postMetric.holdBreakCount++;
      G.outCount++;
      resetAntiCheeseState();
      failSoft();

      setCoachMood('warn', '😯');
      setCoachTextMood('หลุดแล้ว ดึงกลับเข้าเป้าอีกนิด', 'warn');

      logEvent('post_out_zone', {
        post_id: post.id,
        post_key: post.key,
        post_out_count: postMetric.outCount
      });
    }

    if (!wasInZone && inZone && postMetric.outStartedAt) {
      postMetric.recoverCount++;
      G.recoverCount++;

      const outMs = nowMs() - postMetric.outStartedAt;
      const recPts = outMs < 700 ? 28 : outMs < 1400 ? 18 : 10;
      postMetric.recoveryPts += recPts;
      postMetric.recoveryLatencySum += outMs;
      postMetric.recoveryLatencyN += 1;
      postMetric.outStartedAt = 0;

      addScore(12, 'recover');
      G.fx.lastRecoverAt = nowMs();

      showRecoverPop('Recover!');
      pulseTarget();
      setCoachMood('happy', '😄');
      setCoachTextMood('ดีมาก กลับเข้าเป้าได้แล้ว', 'happy');

      logEvent('recover', {
        post_id: post.id,
        post_key: post.key,
        recover_count: postMetric.recoverCount,
        recovery_pts: recPts,
        recovery_latency_ms: Math.round(outMs)
      });
    }

    if (target.holdMs > 0) {
      const controlScale = getControlScale();
      const validFactor = getValidControlFactor();
      const activeControl = controlScale >= 0.45 && validFactor >= 0.5;

      if (inZone && postMetric.armed) {
        const gain = dt * controlScale * validFactor;
        G.antiCheese.idleMs = validFactor <= 0.15 ? (G.antiCheese.idleMs + dt) : 0;
        G.antiCheese.microStillMs = G.recentMovePx < 0.18 ? (G.antiCheese.microStillMs + dt) : 0;

        if (activeControl) {
          G.stepHoldMs += gain;
          postMetric.holdOkMs += gain;
          postMetric.validHoldMs += gain;
        } else {
          postMetric.invalidHoldMs += dt;
          G.stepHoldMs = Math.max(0, G.stepHoldMs - dt * 0.55);
        }

        if (G.antiCheese.idleMs > 600) {
          G.antiCheese.idleMs = 0;
          postMetric.idleWarns++;
          setCoachMood('warn', '😯');
          setCoachTextMood('อย่าค้างเฉย ๆ ต้องคุมสมดุลด้วย', 'warn');
        }

        if (G.antiCheese.microStillMs > 1100) {
          G.antiCheese.microStillMs = 0;
          postMetric.cheeseFlags++;
          G.stepHoldMs = Math.max(0, G.stepHoldMs - 260);
          setCoachMood('warn', '😬');
          setCoachTextMood('นิ่งเกินไปแบบไม่คุม เกมจะไม่นับเต็ม', 'warn');

          logEvent('anti_cheese_flag', {
            post_id: post.id,
            post_key: post.key,
            cheese_flags: postMetric.cheeseFlags
          });
        }

        if (centerBias < 0.22) {
          postMetric.invalidHoldMs += dt * 0.35;
        }
      } else if (inZone && !postMetric.armed) {
        postMetric.invalidHoldMs += dt;
        setCoachMood('warn', '😯');
        setCoachTextMood('ขยับก่อน เกมถึงจะเริ่มนับ', 'warn');
      } else {
        resetAntiCheeseState();
        G.stepHoldMs = Math.max(0, G.stepHoldMs - dt * 0.35);
      }
    }

    if (post.type === 'hold') {
      if (G.stepHoldMs >= target.holdMs) {
        clearPost();
        return;
      }
    }

    if (post.type === 'sequence-hold') {
      if (G.stepHoldMs >= target.holdMs) {
        G.stepIndex++;
        G.stepHoldMs = 0;
        postMetric.stepCount++;
        resetStepArming();
        resetAntiCheeseState();

        if (G.stepIndex >= post.steps.length) {
          clearPost();
          return;
        }

        const next = post.steps[G.stepIndex];
        setCue(next.label);
        setCoachTextMood('ขยับก่อน แล้วค้างฐานถัดไป', 'neutral');

        logEvent('step_advance', {
          post_id: post.id,
          post_key: post.key,
          step_index: G.stepIndex,
          step_label: next.label
        });
      }
    }

    if (post.type === 'moving-hold') {
      if (phaseElapsed() < post.moveMs) {
        setCue('ตามเป้า');
      } else {
        setCue('ค้างไว้');
        if (G.stepHoldMs >= target.holdMs) {
          clearPost();
          return;
        }
      }
    }

    if (post.type === 'path-stop') {
      if (G.stepHoldMs >= target.holdMs) {
        G.stepIndex++;
        G.stepHoldMs = 0;
        postMetric.stepCount++;
        resetStepArming();
        resetAntiCheeseState();

        if (G.stepIndex >= post.path.length) {
          clearPost();
          return;
        }

        const next = post.path[G.stepIndex];
        setCue(next.label);
        setCoachTextMood('ขยับเข้าจุดถัดไปก่อน แล้วค้าง', 'neutral');

        logEvent('step_advance', {
          post_id: post.id,
          post_key: post.key,
          step_index: G.stepIndex,
          step_label: next.label
        });
      }
    }

    G.lastInZone = inZone;
    G.lastDist = d;
  }

  function renderArena() {
    placeEl(elCursor, G.cursor.x, G.cursor.y, 14);
  }

  let lastTs = nowMs();

  function tick() {
    const t = nowMs();
    const dt = Math.min(50, t - lastTs);
    lastTs = t;

    updateBeat();
    updateCursor(dt);

    if (G.phase === 'tutorial') {
      renderArena();
      updateVisualState();
      updateHUD();
      W.requestAnimationFrame(tick);
      return;
    }

    if (G.phase === 'intro') {
      if (phaseElapsed() > 400) {
        startPractice();
      }
    } else if (G.phase === 'practice') {
      const c = centerPos();
      placeEl(elTarget, c.x, c.y, cfg.zoneRadius + 8);
      placeEl(elTargetPulse, c.x, c.y, cfg.zoneRadius + 8);

      if (phaseElapsed() >= dur.practiceMs) {
        logEvent('practice_end', { practiceMs: dur.practiceMs });
        startPost(0);
      }
    } else if (G.phase === 'post-enter') {
      if (phaseElapsed() > cfg.enterDelayMs) {
        beginPostActive();
      }
      const p = currentPost();
      const target = getActiveTarget(p);
      if (target) {
        placeEl(elTarget, target.x, target.y, target.radius);
        placeEl(elTargetPulse, target.x, target.y, target.radius);
      }
    } else if (G.phase === 'post-active') {
      updatePostLogic(dt);
    } else if (G.phase === 'post-clear') {
      if (phaseElapsed() > dur.clearDelayMs) {
        nextPost();
      }
    }

    renderArena();
    updateVisualState();
    updateHUD();

    W.requestAnimationFrame(tick);
  }

  W.addEventListener('beforeunload', () => {
    flushEventBuffer('beforeunload');
  });

  D.addEventListener('visibilitychange', () => {
    if (D.visibilityState === 'hidden') {
      flushEventBuffer('visibility_hidden');
    }
  });

  W.addEventListener('pagehide', () => {
    flushEventBuffer('pagehide');
  });

  function boot() {
    posts = makePosts();
    if (shouldUseBossPhase()) {
      posts.push(buildBossPost());
    }

    G.startedAt = nowMs();
    G.phaseAt = G.startedAt;
    G.beatAt = G.startedAt;
    G.lastInputAt = G.startedAt;
    G.phase = 'tutorial';

    hideOverlay();
    resetCursor();
    updateHUD();
    setCue('เตรียมตัว');
    setCoachMood('neutral', '🙂');
    setCoachTextMood('ฝึกการทรงตัว 6 ฐาน', 'neutral');

    logEvent('session_start', {
      session_id: sessionId,
      time_setting: ctx.time,
      cooldown_enabled: ctx.cooldown ? 1 : 0,
      gate_enabled: ctx.gate ? 1 : 0,
      boss_enabled: shouldUseBossPhase() ? 1 : 0,
      planner_strict: ctx.plannerStrict ? 1 : 0
    });

    emitWindowEvent('hha:session-start', {
      sessionId,
      gameId: ctx.gameId,
      pid: ctx.pid,
      diff: ctx.diff,
      seed: ctx.seed,
      plannerStrict: ctx.plannerStrict ? 1 : 0
    });

    saveSessionMeta({
      sessionId,
      gameId: ctx.gameId,
      pid: ctx.pid,
      diff: ctx.diff,
      seed: ctx.seed,
      ts: new Date().toISOString(),
      plannerStrict: ctx.plannerStrict ? 1 : 0
    });

    showTutorialOverlay();
    W.requestAnimationFrame(tick);
  }

  boot();
})();