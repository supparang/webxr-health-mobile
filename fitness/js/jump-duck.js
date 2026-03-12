ฃ/* === /fitness/js/jump-duck.js ===
 * Jump-Duck — PRODUCTION
 * PATCH v20260312-JD-GATEFLOW-ENGINE-FULL
 */

(function () {
  'use strict';

  const W = window;
  const D = document;

  const $ = (sel, root = D) => root.querySelector(sel);
  const $$ = (sel, root = D) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rint = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const now = () => performance.now();

  /* ===== HeroHealth Gate Flow ===== */
  const JD_GATE = W.JD_GATE_CONFIG || {};

  function jdSafe(v, d = '') {
    return (v == null || v === '') ? d : String(v);
  }

  function jdRoot() {
    return jdSafe(JD_GATE.ROOT, 'https://supparang.github.io/webxr-health-mobile/herohealth/');
  }

  function jdHub() {
    return jdSafe(JD_GATE.hub, jdRoot() + 'hub.html');
  }

  function jdBuildCooldownUrl(extra = {}) {
    const u = new URL(jdRoot() + 'warmup-gate.html');
    u.searchParams.set('zone', 'exercise');
    u.searchParams.set('game', 'jumpduck');
    u.searchParams.set('phase', 'cooldown');
    u.searchParams.set('hub', jdHub());

    const base = {
      pid: jdSafe(JD_GATE.pid, 'anon'),
      studyId: jdSafe(JD_GATE.studyId, ''),
      seed: jdSafe(JD_GATE.seed, Date.now()),
      run: jdSafe(JD_GATE.run, 'play'),
      view: jdSafe(JD_GATE.view, 'mobile'),
      diff: jdSafe(JD_GATE.diff, 'normal'),
      time: jdSafe(JD_GATE.time, JD_GATE.duration || '60'),
      duration: jdSafe(JD_GATE.duration, JD_GATE.time || '60'),
      log: jdSafe(JD_GATE.log, ''),
      api: jdSafe(JD_GATE.api, ''),
      ai: jdSafe(JD_GATE.ai, ''),
      debug: jdSafe(JD_GATE.debug, ''),
      conditionGroup: jdSafe(JD_GATE.conditionGroup, ''),
      grade: jdSafe(JD_GATE.grade, ''),
      planSeq: jdSafe(JD_GATE.planSeq, ''),
      planDay: jdSafe(JD_GATE.planDay, ''),
      planSlot: jdSafe(JD_GATE.planSlot, ''),
      planMode: jdSafe(JD_GATE.planMode, ''),
      planSlots: jdSafe(JD_GATE.planSlots, ''),
      planIndex: jdSafe(JD_GATE.planIndex, ''),
      autoNext: jdSafe(JD_GATE.autoNext, ''),
      plannedGame: jdSafe(JD_GATE.plannedGame, ''),
      finalGame: jdSafe(JD_GATE.finalGame, ''),
      cdnext: jdSafe(JD_GATE.cdnext, '')
    };

    Object.entries({ ...base, ...extra }).forEach(([k, v]) => {
      if (v != null && v !== '') u.searchParams.set(k, String(v));
    });

    return u.toString();
  }

  function jdGoCooldown(extra = {}) {
    location.href = jdBuildCooldownUrl(extra);
  }

  /* ===== URL params ===== */
  const URLX = new URL(location.href);
  const qp = (k, d = '') => URLX.searchParams.get(k) ?? d;

  /* ===== Core config ===== */
  const CFG = {
    mode: qp('mode', 'training'),
    diff: qp('diff', 'normal'),
    duration: Number(qp('duration', qp('time', '60'))) || 60,
    pid: qp('pid', 'anon'),
    studyId: qp('studyId', ''),
    hub: qp('hub', jdHub()),
    debug: ['1','true','yes','on'].includes(String(qp('debug','0')).toLowerCase()),
    tutorial: false
  };

  /* ===== DOM refs ===== */
  const viewMenu = $('#view-menu');
  const viewPlay = $('#view-play');
  const viewResult = $('#view-result');

  const menuMode = $('#jd-mode');
  const menuDiff = $('#jd-diff');
  const menuDuration = $('#jd-duration');

  const researchBlock = $('#jd-research-block');
  const participantId = $('#jd-participant-id');
  const groupInput = $('#jd-group');
  const noteInput = $('#jd-note');

  const backHubMenu = $('#jd-back-hub-menu');
  const backHubPlay = $('#jd-back-hub-play');
  const backHubResult = $('#jd-back-hub-result');

  const hudMode = $('#hud-mode');
  const hudDiff = $('#hud-diff');
  const hudTime = $('#hud-time');
  const hudPhase = $('#hud-phase');
  const hudScore = $('#hud-score');
  const hudCombo = $('#hud-combo');
  const hudStability = $('#hud-stability');
  const hudBoss = $('#hud-boss');
  const hudProgFill = $('#hud-prog-fill');
  const hudProgText = $('#hud-prog-text');
  const hudFeverFill = $('#hud-fever-fill');
  const hudFeverStatus = $('#hud-fever-status');
  const bossBarWrap = $('#boss-bar-wrap');
  const hudBossFill = $('#hud-boss-fill');
  const hudBossStatus = $('#hud-boss-status');

  const playArea = $('#jd-play-area');
  const judge = $('#jd-judge');
  const tele = $('#jd-tele');
  const avatar = $('#jd-avatar');
  const obsLayer = $('#jd-obstacles');

  const resMode = $('#res-mode');
  const resDiff = $('#res-diff');
  const resDuration = $('#res-duration');
  const resTotalObs = $('#res-total-obs');
  const resHits = $('#res-hits');
  const resMiss = $('#res-miss');
  const resJumpHit = $('#res-jump-hit');
  const resDuckHit = $('#res-duck-hit');
  const resJumpMiss = $('#res-jump-miss');
  const resDuckMiss = $('#res-duck-miss');
  const resAcc = $('#res-acc');
  const resRtMean = $('#res-rt-mean');
  const resStabilityMin = $('#res-stability-min');
  const resScore = $('#res-score');
  const resRank = $('#res-rank');

  const logStatus = $('#jd-log-status');

  const btnEvents = $('#jd-btn-dl-events');
  const btnSessions = $('#jd-btn-dl-sessions');
  const btnSendLog = $('#jd-btn-send-log');

  /* ===== Button groups ===== */
  const menuActionBtns = $$('[data-action]', viewMenu);
  const playActionBtns = $$('[data-action]', viewPlay);
  const resultActionBtns = $$('[data-action]', viewResult);

  /* ===== State ===== */
  let state = null;
  let rafId = 0;
  let obstacleSpawnTimer = 0;
  let phaseTickTimer = 0;
  let feverTimer = 0;
  let bossActive = false;
  let bossHP = 0;
  let bossMaxHP = 0;
  let lastTs = 0;
  let gameStartedAt = 0;

  W.__JD_LAST_SUMMARY = null;

  const eventsLog = [];
  const sessionsLog = [];

  /* ===== Difficulty ===== */
  function getDiffCfg(diff) {
    if (diff === 'easy') return { speed: 280, spawnEvery: 1450, bossEvery: 22, feverGain: 6 };
    if (diff === 'hard') return { speed: 380, spawnEvery: 950, bossEvery: 14, feverGain: 9 };
    return { speed: 330, spawnEvery: 1150, bossEvery: 18, feverGain: 7 };
  }

  /* ===== UI helpers ===== */
  function showView(name) {
    viewMenu.classList.toggle('hidden', name !== 'menu');
    viewPlay.classList.toggle('hidden', name !== 'play');
    viewResult.classList.toggle('hidden', name !== 'result');
  }

  function setHubLinks() {
    const hub = CFG.hub || jdHub();
    [backHubMenu, backHubPlay].forEach(a => {
      if (a) a.href = hub;
    });
    if (backHubResult) {
      backHubResult.href = '#';
    }
  }

  function toastJudge(text) {
    judge.textContent = text;
    judge.classList.add('show');
    setTimeout(() => judge.classList.remove('show'), 260);
  }

  function showTele(text) {
    tele.classList.remove('hidden');
    tele.classList.add('on');
    $('.teleBox', tele).textContent = text;
    setTimeout(() => {
      tele.classList.remove('on');
      setTimeout(() => tele.classList.add('hidden'), 180);
    }, 600);
  }

  function setAvatarMode(mode) {
    avatar.classList.remove('avatar-idle', 'avatar-jump', 'avatar-duck');
    avatar.classList.add(`avatar-${mode}`);
  }

  function setLogStatus(text) {
    logStatus.textContent = text || '';
  }

  /* ===== CSV ===== */
  function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = D.createElement('a');
    a.href = url;
    a.download = filename;
    D.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function toCSV(rows) {
    if (!rows.length) return '';
    const keys = [...new Set(rows.flatMap(r => Object.keys(r)))];
    const esc = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [
      keys.join(','),
      ...rows.map(r => keys.map(k => esc(r[k])).join(','))
    ].join('\n');
  }

  function logEvent(type, data = {}) {
    eventsLog.push({
      ts: Date.now(),
      type,
      pid: CFG.pid,
      studyId: CFG.studyId,
      mode: CFG.mode,
      diff: CFG.diff,
      ...data
    });
  }

  function logSession(data = {}) {
    sessionsLog.push({
      ts: Date.now(),
      pid: CFG.pid,
      studyId: CFG.studyId,
      mode: CFG.mode,
      diff: CFG.diff,
      duration: CFG.duration,
      ...data
    });
  }

  /* ===== Game state ===== */
  function buildState() {
    return {
      mode: CFG.mode,
      diff: CFG.diff,
      duration: CFG.duration,
      totalTime: CFG.duration,
      timeLeft: CFG.duration,
      score: 0,
      combo: 0,
      stability: 100,
      stabilityMin: 100,
      fever: 0,
      phase: 1,
      totalObs: 0,
      hits: 0,
      miss: 0,
      jumpHit: 0,
      duckHit: 0,
      jumpMiss: 0,
      duckMiss: 0,
      rts: [],
      obstacles: [],
      nextSpawnAt: 0,
      stopped: false,
      tutorial: CFG.tutorial,
      overheat: 0
    };
  }

  function updateHUD() {
    hudMode.textContent = state.mode;
    hudDiff.textContent = state.diff;
    hudTime.textContent = state.timeLeft.toFixed(1);
    hudPhase.textContent = String(state.phase);
    hudScore.textContent = String(Math.round(state.score));
    hudCombo.textContent = String(state.combo);
    hudStability.textContent = `${Math.round(state.stability)}%`;
    hudBoss.textContent = bossActive ? `${bossHP}/${bossMaxHP}` : '—';

    const prog = clamp(((state.totalTime - state.timeLeft) / Math.max(1, state.totalTime)) * 100, 0, 100);
    hudProgFill.style.width = `${prog}%`;
    hudProgText.textContent = `${Math.round(prog)}%`;

    const feverPct = clamp(state.fever, 0, 100);
    hudFeverFill.style.width = `${feverPct}%`;
    hudFeverStatus.textContent = feverPct >= 100 ? 'FEVER!' : `${Math.round(feverPct)}%`;

    bossBarWrap.classList.toggle('hidden', !bossActive);
    if (bossActive) {
      const hpPct = clamp((bossHP / Math.max(1, bossMaxHP)) * 100, 0, 100);
      hudBossFill.style.width = `${hpPct}%`;
      hudBossStatus.textContent = `${Math.round(hpPct)}%`;
    }
  }

  /* ===== Obstacle visual ===== */
  function makeObstacle(kind, isBoss = false, isFeint = false) {
    const el = D.createElement('div');
    el.className = `obs ${kind} ${isFeint ? 'feint' : ''}`;
    el.innerHTML = `
      <div class="obs-inner">
        ${kind === 'low'
          ? '<div class="obs-low-shape"></div><div class="obs-label">JUMP</div>'
          : '<div class="obs-high-shape"></div><div class="obs-label">DUCK</div>'}
      </div>
    `;

    const speedBase = getDiffCfg(state.diff).speed;
    const speed = speedBase * (isBoss ? 1.12 : 1) * (state.fever >= 100 ? 1.15 : 1);
    const x = playArea.clientWidth + 60;

    const obstacle = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      isBoss,
      isFeint,
      x,
      speed,
      hit: false,
      resolved: false,
      spawnedAt: now(),
      el
    };

    el.style.left = `${x}px`;
    obsLayer.appendChild(el);
    state.obstacles.push(obstacle);
    state.totalObs += 1;
    return obstacle;
  }

  function removeObstacle(ob) {
    ob.resolved = true;
    ob.el?.remove();
  }

  /* ===== Spawn ===== */
  function maybeStartBoss() {
    if (bossActive) return;
    if (state.totalObs === 0) return;
    const diffCfg = getDiffCfg(state.diff);
    if (state.totalObs % diffCfg.bossEvery !== 0) return;

    bossActive = true;
    bossMaxHP = state.diff === 'hard' ? 4 : state.diff === 'easy' ? 2 : 3;
    bossHP = bossMaxHP;
    showTele('BOSS!');
    toastJudge('Boss incoming');
    logEvent('boss_start', { hp: bossHP });
    updateHUD();
  }

  function spawnOne() {
    if (state.stopped) return;

    if (bossActive) {
      const kind = Math.random() < 0.5 ? 'low' : 'high';
      const ob = makeObstacle(kind, true, Math.random() < 0.15);
      ob.el.style.boxShadow = '0 0 0 2px rgba(239,68,68,.34), 0 18px 36px rgba(0,0,0,.28)';
      return;
    }

    const kind = Math.random() < 0.5 ? 'low' : 'high';
    makeObstacle(kind, false, Math.random() < 0.12);
  }

  /* ===== Action ===== */
  let inputLockUntil = 0;
  function doAction(action) {
    if (!state || state.stopped) return;
    const t = now();
    if (t < inputLockUntil) return;
    inputLockUntil = t + 80;

    if (action === 'jump') {
      setAvatarMode('jump');
      setTimeout(() => setAvatarMode('idle'), 340);
    } else {
      setAvatarMode('duck');
      setTimeout(() => setAvatarMode('idle'), 360);
    }

    const hitX = playArea.clientWidth * 0.22;
    const candidates = state.obstacles
      .filter(o => !o.resolved && !o.hit && Math.abs(o.x - hitX) < 70)
      .sort((a, b) => Math.abs(a.x - hitX) - Math.abs(b.x - hitX));

    if (!candidates.length) {
      toastJudge('MISS');
      state.combo = 0;
      state.stability = clamp(state.stability - 2.5, 0, 100);
      updateHUD();
      logEvent('input_empty', { action });
      return;
    }

    const ob = candidates[0];
    const want = ob.kind === 'low' ? 'jump' : 'duck';
    const rt = Math.max(0, Math.round(t - ob.spawnedAt));

    if (ob.isFeint) {
      state.combo = 0;
      state.stability = clamp(state.stability - 5, 0, 100);
      toastJudge('FEINT');
      removeObstacle(ob);
      logEvent('feint_hit', { action, kind: ob.kind, rt });
      updateHUD();
      return;
    }

    if (action === want) {
      ob.hit = true;
      removeObstacle(ob);

      state.hits += 1;
      state.combo += 1;
      state.score += ob.isBoss ? 220 : 100 + Math.min(80, state.combo * 4);
      state.stability = clamp(state.stability + 0.7, 0, 100);
      state.rts.push(rt);
      state.fever = clamp(state.fever + getDiffCfg(state.diff).feverGain, 0, 100);

      if (ob.kind === 'low') state.jumpHit += 1;
      if (ob.kind === 'high') state.duckHit += 1;

      if (bossActive && ob.isBoss) {
        bossHP -= 1;
        if (bossHP <= 0) {
          bossActive = false;
          bossHP = 0;
          state.score += 300;
          toastJudge('BOSS BREAK!');
          logEvent('boss_break', {});
        }
      }

      toastJudge('HIT');
      logEvent('hit', { action, kind: ob.kind, rt, combo: state.combo, boss: ob.isBoss ? 1 : 0 });
    } else {
      state.miss += 1;
      state.combo = 0;
      state.stability = clamp(state.stability - 7, 0, 100);

      if (ob.kind === 'low') state.jumpMiss += 1;
      if (ob.kind === 'high') state.duckMiss += 1;

      removeObstacle(ob);
      toastJudge('WRONG');
      logEvent('wrong', { action, want, kind: ob.kind, rt, boss: ob.isBoss ? 1 : 0 });
    }

    state.stabilityMin = Math.min(state.stabilityMin, state.stability);
    updateHUD();
  }

  /* ===== Loop ===== */
  function gameLoop(ts) {
    if (!state || state.stopped) return;

    if (!lastTs) lastTs = ts;
    const dt = Math.min(50, ts - lastTs);
    lastTs = ts;

    state.timeLeft = Math.max(0, state.timeLeft - dt / 1000);

    if (state.timeLeft <= 0) {
      stopGame(false);
      return;
    }

    const elapsed = state.totalTime - state.timeLeft;
    state.phase = elapsed < state.totalTime * 0.33 ? 1 : elapsed < state.totalTime * 0.66 ? 2 : 3;

    const diffCfg = getDiffCfg(state.diff);
    obstacleSpawnTimer += dt;
    const spawnGap = state.tutorial ? 1550 : diffCfg.spawnEvery;

    if (obstacleSpawnTimer >= spawnGap) {
      obstacleSpawnTimer = 0;
      maybeStartBoss();
      spawnOne();
    }

    const hitX = playArea.clientWidth * 0.22;

    state.obstacles.forEach(ob => {
      if (ob.resolved) return;
      ob.x -= (ob.speed * dt) / 1000;
      ob.el.style.left = `${ob.x}px`;

      if (ob.x < hitX - 30 && !ob.hit) {
        state.miss += 1;
        state.combo = 0;
        state.stability = clamp(state.stability - (ob.isBoss ? 8 : 5), 0, 100);
        state.stabilityMin = Math.min(state.stabilityMin, state.stability);

        if (ob.kind === 'low') state.jumpMiss += 1;
        if (ob.kind === 'high') state.duckMiss += 1;

        logEvent('miss_pass', { kind: ob.kind, boss: ob.isBoss ? 1 : 0 });

        if (bossActive && ob.isBoss) {
          bossHP = Math.max(0, bossHP - 1);
          if (bossHP <= 0) {
            bossActive = false;
            toastJudge('BOSS LOST');
          }
        }

        removeObstacle(ob);
      } else if (ob.x < -100) {
        removeObstacle(ob);
      }
    });

    state.obstacles = state.obstacles.filter(ob => !ob.resolved);
    updateHUD();
    rafId = requestAnimationFrame(gameLoop);
  }

  /* ===== Start/stop ===== */
  function applyMenuToConfig() {
    CFG.mode = menuMode.value;
    CFG.diff = menuDiff.value;
    CFG.duration = Number(menuDuration.value) || 60;
    CFG.pid = participantId?.value?.trim() || CFG.pid || 'anon';

    URLX.searchParams.set('mode', CFG.mode);
    URLX.searchParams.set('diff', CFG.diff);
    URLX.searchParams.set('duration', String(CFG.duration));
  }

  function setupMenuFromURL() {
    menuMode.value = CFG.mode;
    menuDiff.value = CFG.diff;
    menuDuration.value = String(CFG.duration);
    if (participantId) participantId.value = CFG.pid || '';
    researchBlock.classList.toggle('hidden', CFG.mode !== 'research');
  }

  function startGame(opts = {}) {
    applyMenuToConfig();
    CFG.tutorial = !!opts.tutorial;

    showView('play');
    setHubLinks();

    state = buildState();
    state.tutorial = CFG.tutorial;
    if (CFG.tutorial) {
      state.duration = 15;
      state.totalTime = 15;
      state.timeLeft = 15;
    }

    hudMode.textContent = CFG.mode;
    hudDiff.textContent = CFG.diff;
    hudTime.textContent = state.totalTime.toFixed(1);

    obsLayer.innerHTML = '';
    state.obstacles = [];
    obstacleSpawnTimer = 0;
    bossActive = false;
    bossHP = 0;
    bossMaxHP = 0;
    lastTs = 0;
    gameStartedAt = Date.now();
    W.__JD_LAST_SUMMARY = null;

    setAvatarMode('idle');
    showTele(CFG.tutorial ? 'TUTORIAL' : 'READY');
    updateHUD();
    logEvent('game_start', { tutorial: CFG.tutorial ? 1 : 0 });

    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(gameLoop);
  }

  function calcRank(score, acc) {
    if (score >= 2400 && acc >= 90) return 'S';
    if (score >= 1700 && acc >= 80) return 'A';
    if (score >= 1100 && acc >= 70) return 'B';
    return 'C';
  }

  function buildSummary() {
    const totalObs = state.totalObs;
    const hits = state.hits;
    const miss = state.miss;
    const acc = totalObs > 0 ? Math.round((hits / totalObs) * 100) : 0;
    const rtMean = state.rts.length
      ? Math.round(state.rts.reduce((a, b) => a + b, 0) / state.rts.length)
      : 0;
    const score = Math.round(state.score);
    const rank = calcRank(score, acc);
    const stars = rank === 'S' ? 3 : rank === 'A' ? 3 : rank === 'B' ? 2 : 1;

    return {
      mode: CFG.mode,
      diff: CFG.diff,
      duration: state.totalTime,
      totalObs,
      hits,
      miss,
      jumpHit: state.jumpHit,
      duckHit: state.duckHit,
      jumpMiss: state.jumpMiss,
      duckMiss: state.duckMiss,
      acc,
      rtMean,
      stabilityMin: Math.round(state.stabilityMin),
      score,
      rank,
      stars,
      pid: CFG.pid,
      studyId: CFG.studyId,
      seed: JD_GATE.seed || '',
      run: JD_GATE.run || 'play',
      view: JD_GATE.view || 'mobile'
    };
  }

  function fillResult(summary) {
    resMode.textContent = summary.mode;
    resDiff.textContent = summary.diff;
    resDuration.textContent = `${summary.duration}s`;
    resTotalObs.textContent = String(summary.totalObs);
    resHits.textContent = String(summary.hits);
    resMiss.textContent = String(summary.miss);
    resJumpHit.textContent = String(summary.jumpHit);
    resDuckHit.textContent = String(summary.duckHit);
    resJumpMiss.textContent = String(summary.jumpMiss);
    resDuckMiss.textContent = String(summary.duckMiss);
    resAcc.textContent = `${summary.acc}%`;
    resRtMean.textContent = `${summary.rtMean} ms`;
    resStabilityMin.textContent = `${summary.stabilityMin}%`;
    resScore.textContent = String(summary.score);
    resRank.textContent = summary.rank;
  }

  function stopGame(early) {
    if (!state || state.stopped) return;
    state.stopped = true;
    cancelAnimationFrame(rafId);

    const summary = buildSummary();
    W.__JD_LAST_SUMMARY = summary;

    logEvent('game_end', { early: early ? 1 : 0, score: summary.score, acc: summary.acc, rank: summary.rank });
    logSession({
      early: early ? 1 : 0,
      score: summary.score,
      acc: summary.acc,
      rank: summary.rank,
      totalObs: summary.totalObs,
      hits: summary.hits,
      miss: summary.miss,
      rtMean: summary.rtMean,
      stabilityMin: summary.stabilityMin,
      startedAt: gameStartedAt,
      endedAt: Date.now()
    });

    fillResult(summary);
    setLogStatus('');
    showView('result');
    setHubLinks();
  }

  /* ===== Events ===== */
  function onTapPlay(ev) {
    if (!state || state.stopped) return;
    const rect = playArea.getBoundingClientRect();
    const y = ev.clientY - rect.top;
    const action = y < rect.height / 2 ? 'jump' : 'duck';
    doAction(action);
  }

  D.addEventListener('keydown', (ev) => {
    if (viewPlay.classList.contains('hidden')) return;
    if (ev.key === 'ArrowUp' || ev.key === 'w' || ev.key === 'W') {
      ev.preventDefault();
      doAction('jump');
    }
    if (ev.key === 'ArrowDown' || ev.key === 's' || ev.key === 'S') {
      ev.preventDefault();
      doAction('duck');
    }
  });

  playArea.addEventListener('pointerdown', onTapPlay);

  menuMode.addEventListener('change', () => {
    researchBlock.classList.toggle('hidden', menuMode.value !== 'research');
  });

  menuActionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'start') startGame({ tutorial: false });
      if (action === 'tutorial') startGame({ tutorial: true });
    });
  });

  playActionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'jump') doAction('jump');
      if (action === 'duck') doAction('duck');
      if (action === 'stop-early') stopGame(true);
    });
  });

  resultActionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;

      if (action === 'play-again') {
        location.reload();
        return;
      }

      if (action === 'back-menu') {
        const s = W.__JD_LAST_SUMMARY || {};
        jdGoCooldown({
          score: s.score ?? '',
          stars: s.stars ?? '',
          rank: s.rank ?? '',
          totalObs: s.totalObs ?? '',
          hits: s.hits ?? '',
          miss: s.miss ?? '',
          acc: s.acc ?? ''
        });
      }
    });
  });

  if (backHubResult) {
    backHubResult.addEventListener('click', (ev) => {
      ev.preventDefault();
      const s = W.__JD_LAST_SUMMARY || {};
      jdGoCooldown({
        score: s.score ?? '',
        stars: s.stars ?? '',
        rank: s.rank ?? '',
        totalObs: s.totalObs ?? '',
        hits: s.hits ?? '',
        miss: s.miss ?? '',
        acc: s.acc ?? ''
      });
    });
  }

  btnEvents?.addEventListener('click', () => {
    downloadText('jumpduck-events.csv', toCSV(eventsLog));
    setLogStatus('ดาวน์โหลด events.csv แล้ว');
  });

  btnSessions?.addEventListener('click', () => {
    downloadText('jumpduck-sessions.csv', toCSV(sessionsLog));
    setLogStatus('ดาวน์โหลด sessions.csv แล้ว');
  });

  btnSendLog?.addEventListener('click', () => {
    const count = eventsLog.length + sessionsLog.length;
    setLogStatus(`จำลองส่ง Cloud Logger แล้ว (${count} records)`);
  });

  /* ===== Init ===== */
  function init() {
    setHubLinks();
    setupMenuFromURL();
    showView('menu');

    logEvent('page_load', {
      pid: CFG.pid,
      mode: CFG.mode,
      diff: CFG.diff,
      duration: CFG.duration
    });

    if (CFG.debug) {
      console.log('[JumpDuck init]', { CFG, JD_GATE });
    }
  }

  init();
})();
