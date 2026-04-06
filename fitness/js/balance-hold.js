// === /fitness/js/balance-hold.js ===
// Balance Hold — 6 Post Circuit + HHA Flow
// FULL PATCH v20260406b-balance-hold-hha-cooldown

(() => {
  'use strict';

  const W = window;
  const D = document;
  const $ = (sel, root = D) => root.querySelector(sel);

  // ---------------------------------------------------------
  // query helpers
  // ---------------------------------------------------------
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
    returnPhase: q('returnPhase', ''),
    cdur: qNum('cdur', 20),

    log: q('log', '0') === '1',
    debug: q('debug', '0') === '1',

    api: q('api', ''),
    weekNo: q('weekNo', ''),
    sessionNo: q('sessionNo', ''),
    grade: q('grade', ''),
    teacher: q('teacher', '')
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

  if (!root || !arena || !elTarget || !elCursor || !elOverlay) {
    console.error('[BalanceHold] Missing required DOM nodes.');
    return;
  }

  // ---------------------------------------------------------
  // deterministic rng
  // ---------------------------------------------------------
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

  // ---------------------------------------------------------
  // session + logging
  // ---------------------------------------------------------
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
      sessionNo: ctx.sessionNo
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
      ts: new Date().toISOString()
    };
    emitWindowEvent('hha:flush', payload);

    if (ctx.log || ctx.debug) {
      console.log('[BalanceHold:flush]', payload);
    }
  }

  // ---------------------------------------------------------
  // HHA summary save
  // ---------------------------------------------------------
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

  // ---------------------------------------------------------
  // config
  // ---------------------------------------------------------
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

  // ---------------------------------------------------------
  // arena geometry
  // ---------------------------------------------------------
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

  // ---------------------------------------------------------
  // posts
  // ---------------------------------------------------------
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

  let posts = makePosts();

  // ---------------------------------------------------------
  // game state
  // ---------------------------------------------------------
  const G = {
    phase: 'intro', // intro | practice | post-enter | post-active | post-clear | summary
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
    }
  };

  function currentPost() {
    return posts[G.postIndex] || null;
  }

  let postMetric = null;

  // ---------------------------------------------------------
  // helpers
  // ---------------------------------------------------------
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

  function updateGhost(post) {
    if (!elGhost) return;
    elGhost.setAttribute('data-ghost', post?.ghost || 'center');
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
      stepCount: 0
    };
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

    return null;
  }

  // ---------------------------------------------------------
  // input
  // ---------------------------------------------------------
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
  }

  function onPointerUp(e) {
    if (G.input.pointerId != null && e.pointerId !== G.input.pointerId) return;
    G.input.active = false;
    G.input.pointerId = null;
    const c = centerPos();
    G.input.tx = c.x;
    G.input.ty = c.y;
    logEvent('pointer_up');
  }

  arena.addEventListener('pointerdown', onPointerDown);
  W.addEventListener('pointermove', onPointerMove);
  W.addEventListener('pointerup', onPointerUp);
  W.addEventListener('pointercancel', onPointerUp);

  // ---------------------------------------------------------
  // game flow
  // ---------------------------------------------------------
  function startPractice() {
    setPhase('practice');
    resetCursor();
    setCue('ลองอยู่ในวงกลาง');
    setCoach('ฝึก 15 วินาที');
    placeEl(elTarget, centerPos().x, centerPos().y, cfg.zoneRadius + 8);
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

    const post = currentPost();
    if (!post) {
      finishGame();
      return;
    }

    postMetric = postMetricsBase(post);
    updateGhost(post);
    setCue(post.cue);
    setCoach(post.coach);
    setPhase('post-enter');
    updateHUD();

    logEvent('post_start', {
      post_id: post.id,
      post_key: post.key,
      post_title: post.title
    });
  }

  function beginPostActive() {
    const post = currentPost();
    if (!post) return;
    setPhase('post-active');
    G.stepHoldMs = 0;
    G.lastInZone = false;

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

    let stars = 1;
    if (postMetric.outCount <= 1) stars++;
    if (postMetric.recoverCount >= 1 || postMetric.avgDistFinal < Math.round(cfg.zoneRadius * 0.72)) stars++;
    stars = clamp(stars, 1, 3);
    postMetric.stars = stars;

    const score =
      Math.round(postMetric.holdOkMs * 0.08) +
      Math.round(postMetric.inZoneMs * 0.03) +
      stars * 120 -
      postMetric.outCount * 30;

    postMetric.score = Math.max(60, score);
    G.postResults.push(postMetric);

    addStars(stars, 'post_clear');
    addScore(postMetric.score, 'post_clear');

    G.combo++;
    G.bestCombo = Math.max(G.bestCombo, G.combo);

    setPhase('post-clear');
    setCue('ผ่านด่าน!');
    setCoach(`เก่งมาก ได้ ${stars} ดาว`);
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
      post_out_count: postMetric.outCount,
      post_recover_count: postMetric.recoverCount,
      post_avg_dist: postMetric.avgDistFinal
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

    return {
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
      hub: ctx.hub,
      ts: new Date().toISOString(),
      posts: G.postResults.map(p => ({
        id: p.id,
        key: p.key,
        title: p.title,
        cleared: p.cleared,
        score: p.score,
        stars: p.stars,
        inZoneMs: Math.round(p.inZoneMs),
        holdOkMs: Math.round(p.holdOkMs),
        outCount: p.outCount,
        recoverCount: p.recoverCount,
        avgDist: p.avgDistFinal
      }))
    };
  }

  function finishGame() {
    if (G.summaryShown) return;
    G.summaryShown = true;

    setPhase('summary');
    const summary = buildSummaryPayload();

    saveSummaryPayload(summary);
    saveSessionMeta({
      sessionId,
      pid: ctx.pid,
      gameId: ctx.gameId,
      score: G.totalScore,
      stars: G.stars,
      ts: summary.ts
    });

    logEvent('session_end', {
      final_score: summary.score,
      final_stars: summary.stars,
      best_combo: summary.bestCombo,
      recover_count: summary.recoverCount,
      out_count: summary.outCount,
      passed_posts: summary.passedPosts,
      total_posts: summary.totalPosts,
      rank: summary.rank
    });

    flushEventBuffer('session_end');
    renderSummary(summary);
  }

  // ---------------------------------------------------------
  // cooldown / routing
  // ---------------------------------------------------------
  function buildCooldownUrl() {
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

  // ---------------------------------------------------------
  // summary UI
  // ---------------------------------------------------------
  function renderSummary(summary) {
    const rows = summary.posts.map(p => `
      <div class="bh-sum-row">
        <div>${p.id}. ${p.title}</div>
        <div>${p.stars}⭐</div>
        <div>${p.score}</div>
      </div>
    `).join('');

    const primaryLabel = ctx.cooldown ? 'คูลดาวน์แล้วกลับ HUB' : 'กลับ HUB';

    showOverlay(`
      <div class="bh-summary-card">
        <h2>Balance Hold Summary</h2>

        <div class="bh-summary-main">
          <div>ผ่าน ${summary.passedPosts}/${summary.totalPosts} ฐาน</div>
          <div>ดาวรวม ${summary.stars}</div>
          <div>คะแนน ${summary.score}</div>
          <div>ระดับ ${summary.rank}</div>
        </div>

        <div class="bh-summary-sub">
          <div>ฐานที่ดีที่สุด: ${summary.bestPost || '-'}</div>
          <div>ฐานที่ควรฝึกเพิ่ม: ${summary.hardestPost || '-'}</div>
          <div>Recovery: ${summary.recoverCount}</div>
          <div>Best Combo: ${summary.bestCombo}</div>
        </div>

        <div class="bh-summary-list">
          <div class="bh-sum-head">
            <div>ด่าน</div>
            <div>ดาว</div>
            <div>คะแนน</div>
          </div>
          ${rows}
        </div>

        <div class="bh-summary-actions">
          <button id="bhRetryBtn" type="button">เล่นอีกครั้ง</button>
          <button id="bhNextBtn" type="button">${primaryLabel}</button>
        </div>
      </div>
    `);

    const retryBtn = $('#bhRetryBtn', elOverlay);
    const nextBtn = $('#bhNextBtn', elOverlay);

    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        logEvent('summary_action', { action: 'retry' });
        safeNavigate(location.pathname + location.search, 'retry');
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (ctx.cooldown) {
          logEvent('summary_action', { action: 'cooldown_then_hub' });
          safeNavigate(buildCooldownUrl(), 'cooldown_redirect');
        } else {
          logEvent('summary_action', { action: 'back_hub' });
          safeNavigate(ctx.hub, 'back_hub');
        }
      });
    }

    emitWindowEvent('hha:session-summary', summary);
    logEvent('summary_ready', {
      final_score: summary.score,
      final_stars: summary.stars,
      rank: summary.rank
    });
  }

  // ---------------------------------------------------------
  // update cursor motion
  // ---------------------------------------------------------
  function updateCursor(dt) {
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

  function updatePostLogic(dt) {
    const post = currentPost();
    if (!post || !postMetric) return;

    const target = getActiveTarget(post);
    if (!target) return;

    placeEl(elTarget, target.x, target.y, target.radius);

    const d = dist(G.cursor.x, G.cursor.y, target.x, target.y);
    const inZone = d <= target.radius;
    const wasInZone = G.lastInZone;

    postMetric.avgDist += d;
    postMetric.distSamples += 1;

    if (inZone) {
      postMetric.inZoneMs += dt;
    } else if (wasInZone && !inZone) {
      postMetric.outCount++;
      G.outCount++;
      failSoft();
      setCoach('กลับเข้าเป้าอีกนิด');

      logEvent('post_out_zone', {
        post_id: post.id,
        post_key: post.key,
        post_out_count: postMetric.outCount
      });
    }

    if (!wasInZone && inZone && G.lastDist <= target.radius * 1.35) {
      postMetric.recoverCount++;
      G.recoverCount++;
      addScore(12, 'recover');
      setCoach('ดีมาก กลับเข้าเป้าได้แล้ว');

      logEvent('recover', {
        post_id: post.id,
        post_key: post.key,
        recover_count: postMetric.recoverCount
      });
    }

    if (target.holdMs > 0) {
      if (inZone) {
        G.stepHoldMs += dt;
        postMetric.holdOkMs += dt;
      } else {
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

        if (G.stepIndex >= post.steps.length) {
          clearPost();
          return;
        }

        const next = post.steps[G.stepIndex];
        setCue(next.label);
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

        if (G.stepIndex >= post.path.length) {
          clearPost();
          return;
        }

        const next = post.path[G.stepIndex];
        setCue(next.label);
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

  // ---------------------------------------------------------
  // main loop
  // ---------------------------------------------------------
  let lastTs = nowMs();

  function tick() {
    const t = nowMs();
    const dt = Math.min(50, t - lastTs);
    lastTs = t;

    updateBeat();
    updateCursor(dt);

    if (G.phase === 'intro') {
      if (phaseElapsed() > 800) {
        startPractice();
      }
    } else if (G.phase === 'practice') {
      const c = centerPos();
      placeEl(elTarget, c.x, c.y, cfg.zoneRadius + 8);

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
      if (target) placeEl(elTarget, target.x, target.y, target.radius);
    } else if (G.phase === 'post-active') {
      updatePostLogic(dt);
    } else if (G.phase === 'post-clear') {
      if (phaseElapsed() > dur.clearDelayMs) {
        nextPost();
      }
    }

    renderArena();
    updateHUD();

    W.requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------
  // lifecycle hardening
  // ---------------------------------------------------------
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

  // ---------------------------------------------------------
  // boot
  // ---------------------------------------------------------
  function boot() {
    posts = makePosts();

    G.startedAt = nowMs();
    G.phaseAt = G.startedAt;
    G.beatAt = G.startedAt;

    hideOverlay();
    resetCursor();
    updateHUD();
    setCue('เตรียมตัว');
    setCoach('ฝึกการทรงตัว 6 ฐาน');

    logEvent('session_start', {
      session_id: sessionId,
      time_setting: ctx.time,
      cooldown_enabled: ctx.cooldown ? 1 : 0,
      gate_enabled: ctx.gate ? 1 : 0
    });

    emitWindowEvent('hha:session-start', {
      sessionId,
      gameId: ctx.gameId,
      pid: ctx.pid,
      diff: ctx.diff,
      seed: ctx.seed
    });

    saveSessionMeta({
      sessionId,
      gameId: ctx.gameId,
      pid: ctx.pid,
      diff: ctx.diff,
      seed: ctx.seed,
      ts: new Date().toISOString()
    });

    W.requestAnimationFrame(tick);
  }

  boot();
})();