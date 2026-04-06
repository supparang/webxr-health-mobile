// === /fitness/js/balance-hold.js ===
// Balance Hold — 6 Post Circuit Core
// v20260406a-balance-6post-core

(() => {
  'use strict';

  const W = window;
  const D = document;
  const $ = (sel, root = D) => root.querySelector(sel);

  const qs = new URLSearchParams(location.search);

  const ctx = {
    pid: qs.get('pid') || 'anon',
    name: qs.get('name') || 'Player',
    studyId: qs.get('studyId') || '',
    zone: qs.get('zone') || 'fitness',
    cat: qs.get('cat') || 'fitness',
    game: qs.get('game') || 'balancehold',
    gameId: qs.get('gameId') || 'balancehold',
    run: qs.get('run') || 'play',
    diff: qs.get('diff') || 'normal',
    time: Number(qs.get('time') || 90),
    seed: String(qs.get('seed') || Date.now()),
    hub: qs.get('hub') || '../herohealth/hub-v2.html',
    mode: qs.get('mode') || 'solo',
    view: qs.get('view') || 'mobile'
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

  if (!root || !arena || !elTarget || !elCursor) {
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

  const seedFn = xmur3(ctx.seed);
  const rand = mulberry32(seedFn());

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const nowMs = () => (W.performance && performance.now ? performance.now() : Date.now());

  function diffCfg(diff) {
    if (diff === 'easy') {
      return {
        zoneRadius: 72,
        allowedSway: 18,
        holdScale: 0.85,
        beatMs: 900,
        driftAmp: 4,
        pathTolerance: 26
      };
    }
    if (diff === 'hard' || diff === 'challenge') {
      return {
        zoneRadius: 44,
        allowedSway: 10,
        holdScale: 1.15,
        beatMs: 650,
        driftAmp: 10,
        pathTolerance: 14
      };
    }
    return {
      zoneRadius: 58,
      allowedSway: 14,
      holdScale: 1,
      beatMs: 760,
      driftAmp: 7,
      pathTolerance: 20
    };
  }

  const cfg = diffCfg(ctx.diff);

  // ---------------------------------------------------------
  // arena geometry
  // ---------------------------------------------------------
  function getArenaRect() {
    return arena.getBoundingClientRect();
  }

  function arenaSize() {
    const r = getArenaRect();
    return { w: Math.max(320, r.width), h: Math.max(320, r.height) };
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
  // 6-post circuit design
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
    phase: 'intro', // intro | practice | post-enter | post-active | post-clear | finale | summary
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

    cursor: {
      x: centerPos().x,
      y: centerPos().y,
      vx: 0,
      vy: 0
    },

    input: {
      active: false,
      tx: centerPos().x,
      ty: centerPos().y,
      pointerId: null
    }
  };

  // ---------------------------------------------------------
  // helpers
  // ---------------------------------------------------------
  function setPhase(phase) {
    G.phase = phase;
    G.phaseAt = nowMs();
  }

  function phaseElapsed() {
    return nowMs() - G.phaseAt;
  }

  function showOverlay(html) {
    if (!elOverlay) return;
    elOverlay.hidden = false;
    elOverlay.innerHTML = html;
  }

  function hideOverlay() {
    if (!elOverlay) return;
    elOverlay.hidden = true;
    elOverlay.innerHTML = '';
  }

  function setCue(text) {
    if (elCue) elCue.textContent = text || '';
  }

  function setCoach(text) {
    if (elCoach) elCoach.textContent = text || '';
  }

  function addScore(n) {
    G.totalScore += Math.max(0, n | 0);
  }

  function addStars(n) {
    G.stars += Math.max(0, n | 0);
  }

  function updateHUD() {
    const totalPosts = posts.length;
    if (elPost) {
      const p = clamp(G.postIndex + 1, 0, totalPosts);
      elPost.textContent = p > 0 ? `Post ${p} / ${totalPosts}` : `Practice`;
    }
    if (elStars) elStars.textContent = `⭐ ${G.stars}`;
    if (elScore) elScore.textContent = `${G.totalScore}`;

    if (elProgress) {
      elProgress.innerHTML = posts.map((p, i) => {
        const done = i < G.postResults.length;
        const active = i === G.postIndex;
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

  function currentPost() {
    return posts[G.postIndex] || null;
  }

  function resetCursor() {
    const c = centerPos();
    G.cursor.x = c.x;
    G.cursor.y = c.y;
    G.cursor.vx = 0;
    G.cursor.vy = 0;
  }

  function updateGhost(post) {
    if (!elGhost) return;
    elGhost.setAttribute('data-ghost', post?.ghost || 'center');
  }

  function getActiveTarget(post) {
    if (!post) return null;

    if (post.type === 'hold') {
      return {
        label: post.cue,
        x: post.target.x,
        y: post.target.y,
        radius: post.radius,
        holdMs: post.holdMs * cfg.holdScale
      };
    }

    if (post.type === 'sequence-hold') {
      const step = post.steps[G.stepIndex] || post.steps[post.steps.length - 1];
      return {
        label: step.label,
        x: step.target.x,
        y: step.target.y,
        radius: step.radius,
        holdMs: step.holdMs * cfg.holdScale
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
        holdMs: post.holdMs * cfg.holdScale
      };
    }

    if (post.type === 'path-stop') {
      const step = post.path[G.stepIndex] || post.path[post.path.length - 1];
      return {
        label: step.label,
        x: step.target.x,
        y: step.target.y,
        radius: step.radius,
        holdMs: step.holdMs * cfg.holdScale
      };
    }

    return null;
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
      stepCount: 0
    };
  }

  let postMetric = null;

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
  }

  arena.addEventListener('pointerdown', onPointerDown);
  W.addEventListener('pointermove', onPointerMove);
  W.addEventListener('pointerup', onPointerUp);
  W.addEventListener('pointercancel', onPointerUp);

  // ---------------------------------------------------------
  // practice / posts
  // ---------------------------------------------------------
  function startPractice() {
    setPhase('practice');
    resetCursor();
    setCue('ลองอยู่ในวงกลาง');
    setCoach('ฝึก 15 วินาที');
    placeEl(elTarget, centerPos().x, centerPos().y, cfg.zoneRadius + 8);
    updateGhost({ ghost: 'center' });
    postMetric = null;
  }

  function startPost(i) {
    G.postIndex = i;
    G.stepIndex = 0;
    G.stepHoldMs = 0;
    G.lastInZone = false;
    G.lastDist = 9999;

    const post = currentPost();
    if (!post) return finishGame();

    setPhase('post-enter');
    postMetric = postMetricsBase(post);
    updateGhost(post);
    setCue(post.cue);
    setCoach(post.coach);
    updateHUD();
  }

  function beginPostActive() {
    const post = currentPost();
    if (!post) return;
    setPhase('post-active');
    G.stepHoldMs = 0;
    G.lastInZone = false;
  }

  function clearPost() {
    const post = currentPost();
    if (!post || !postMetric) return;

    postMetric.cleared = true;

    let stars = 1;
    if (postMetric.outCount <= 1) stars++;
    if (postMetric.recoverCount >= 1 || postMetric.avgDist < (cfg.zoneRadius * 0.72)) stars++;
    stars = clamp(stars, 1, 3);
    postMetric.stars = stars;

    const score =
      Math.round(postMetric.holdOkMs * 0.08) +
      Math.round(postMetric.inZoneMs * 0.03) +
      stars * 120 -
      postMetric.outCount * 30;

    postMetric.score = Math.max(60, score);
    G.postResults.push(postMetric);

    addStars(stars);
    addScore(postMetric.score);
    G.combo++;
    G.bestCombo = Math.max(G.bestCombo, G.combo);

    setPhase('post-clear');
    setCue('ผ่านด่าน!');
    setCoach(`เก่งมาก ได้ ${stars} ดาว`);
    updateHUD();
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

  function finishGame() {
    setPhase('summary');
    renderSummary();
    saveLastSummary();
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

  // ---------------------------------------------------------
  // post logic
  // ---------------------------------------------------------
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
    }

    if (!wasInZone && inZone && G.lastDist <= target.radius * 1.35) {
      postMetric.recoverCount++;
      G.recoverCount++;
      addScore(12);
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
      }
    }

    if (post.type === 'sequence-hold') {
      if (G.stepHoldMs >= target.holdMs) {
        G.stepIndex++;
        G.stepHoldMs = 0;
        if (G.stepIndex >= post.steps.length) {
          clearPost();
          return;
        }
        const next = post.steps[G.stepIndex];
        setCue(next.label);
      }
    }

    if (post.type === 'moving-hold') {
      if (phaseElapsed() < post.moveMs) {
        setCue('ตามเป้า');
      } else {
        setCue('ค้างไว้');
        if (G.stepHoldMs >= target.holdMs) {
          clearPost();
        }
      }
    }

    if (post.type === 'path-stop') {
      if (G.stepHoldMs >= target.holdMs) {
        G.stepIndex++;
        G.stepHoldMs = 0;
        if (G.stepIndex >= post.path.length) {
          clearPost();
          return;
        }
        const next = post.path[G.stepIndex];
        setCue(next.label);
      }
    }

    G.lastInZone = inZone;
    G.lastDist = d;
  }

  // ---------------------------------------------------------
  // rendering
  // ---------------------------------------------------------
  function renderArena() {
    placeEl(elCursor, G.cursor.x, G.cursor.y, 14);
  }

  function renderSummary() {
    const total = G.postResults.length;
    const passed = G.postResults.filter(x => x.cleared).length;

    let best = null;
    let hard = null;

    for (const p of G.postResults) {
      if (!best || p.score > best.score) best = p;
      if (!hard || p.outCount > hard.outCount) hard = p;
    }

    const rank =
      G.stars >= 15 ? 'Excellent' :
      G.stars >= 11 ? 'Great' :
      G.stars >= 7 ? 'Good' : 'Try Again';

    const rows = G.postResults.map(p => `
      <div class="bh-sum-row">
        <div>${p.id}. ${p.title}</div>
        <div>${p.stars}⭐</div>
        <div>${p.score}</div>
      </div>
    `).join('');

    showOverlay(`
      <div class="bh-summary-card">
        <h2>Balance Hold Summary</h2>
        <div class="bh-summary-main">
          <div>ผ่าน ${passed}/${total} ฐาน</div>
          <div>ดาวรวม ${G.stars}</div>
          <div>คะแนน ${G.totalScore}</div>
          <div>ระดับ ${rank}</div>
        </div>

        <div class="bh-summary-sub">
          <div>ฐานที่ดีที่สุด: ${best ? best.title : '-'}</div>
          <div>ฐานที่ควรฝึกเพิ่ม: ${hard ? hard.title : '-'}</div>
          <div>Recovery: ${G.recoverCount}</div>
          <div>Best Combo: ${G.bestCombo}</div>
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
          <button id="bhRetryBtn">เล่นอีกครั้ง</button>
          <button id="bhHubBtn">กลับ HUB</button>
        </div>
      </div>
    `);

    const retryBtn = $('#bhRetryBtn', elOverlay);
    const hubBtn = $('#bhHubBtn', elOverlay);

    if (retryBtn) {
      retryBtn.addEventListener('click', () => location.reload());
    }

    if (hubBtn) {
      hubBtn.addEventListener('click', () => {
        location.href = ctx.hub;
      });
    }
  }

  function saveLastSummary() {
    const payload = {
      game: ctx.gameId,
      pid: ctx.pid,
      diff: ctx.diff,
      seed: ctx.seed,
      score: G.totalScore,
      stars: G.stars,
      bestCombo: G.bestCombo,
      recoverCount: G.recoverCount,
      outCount: G.outCount,
      posts: G.postResults,
      ts: new Date().toISOString()
    };

    try {
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(payload));
      localStorage.setItem(`HHA_LAST_SUMMARY_${ctx.gameId}`, JSON.stringify(payload));
    } catch (_) {}
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
      if (phaseElapsed() >= 15000) {
        startPost(0);
      }
    } else if (G.phase === 'post-enter') {
      if (phaseElapsed() > 1000) {
        beginPostActive();
      }
      const p = currentPost();
      const target = getActiveTarget(p);
      if (target) placeEl(elTarget, target.x, target.y, target.radius);
    } else if (G.phase === 'post-active') {
      updatePostLogic(dt);
    } else if (G.phase === 'post-clear') {
      if (phaseElapsed() > 1200) {
        nextPost();
      }
    }

    renderArena();
    updateHUD();

    W.requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------
  // boot
  // ---------------------------------------------------------
  function boot() {
    posts = makePosts();
    G.startedAt = nowMs();
    G.phaseAt = G.startedAt;
    G.beatAt = G.startedAt;
    resetCursor();
    hideOverlay();
    updateHUD();
    setCue('เตรียมตัว');
    setCoach('ฝึกการทรงตัว 6 ฐาน');
    W.requestAnimationFrame(tick);
  }

  boot();
})();