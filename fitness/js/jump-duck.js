/* === /fitness/js/jump-duck.js ===
 * Jump-Duck — PRODUCTION
 * PATCH v20260312e-JD-RESULT-COOLDOWN-BUTTON
 */

(function () {
  'use strict';

  const W = window;
  const D = document;

  const $ = (sel, root = D) => root.querySelector(sel);
  const $$ = (sel, root = D) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => performance.now();

  const URLX = new URL(location.href);
  const qp = (k, d = '') => URLX.searchParams.get(k) ?? d;

  const JD_GATE = W.JD_GATE_CONFIG || {
    ROOT: 'https://supparang.github.io/webxr-health-mobile/herohealth/',
    HUB_URL: 'https://supparang.github.io/webxr-health-mobile/herohealth/hub.html',
    zone: qp('zone', 'fitness'),
    game: 'jumpduck',
    pid: qp('pid', 'anon'),
    studyId: qp('studyId', ''),
    seed: qp('seed', String(Date.now())),
    run: qp('run', 'play'),
    view: qp('view', 'mobile'),
    diff: qp('diff', 'normal'),
    time: qp('time', qp('duration', '60')),
    duration: qp('duration', qp('time', '60')),
    hub: qp('hub', 'https://supparang.github.io/webxr-health-mobile/herohealth/hub.html'),
    log: qp('log', ''),
    api: qp('api', ''),
    ai: qp('ai', ''),
    debug: qp('debug', ''),
    conditionGroup: qp('conditionGroup', ''),
    grade: qp('grade', ''),
    phase: qp('phase', ''),
    planSeq: qp('planSeq', ''),
    planDay: qp('planDay', ''),
    planSlot: qp('planSlot', ''),
    planMode: qp('planMode', ''),
    planSlots: qp('planSlots', ''),
    planIndex: qp('planIndex', ''),
    autoNext: qp('autoNext', ''),
    plannedGame: qp('plannedGame', ''),
    finalGame: qp('finalGame', ''),
    cdnext: qp('cdnext', '')
  };

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

  const viewMenu = $('#view-menu');
  const viewPlay = $('#view-play');
  const viewResult = $('#view-result');

  const menuMode = $('#jd-mode');
  const menuDiff = $('#jd-diff');
  const menuDuration = $('#jd-duration');

  const researchBlock = $('#jd-research-block');
  const participantId = $('#jd-participant-id');

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

  const hudPattern = $('#hud-pattern');
  const hudRush = $('#hud-rush');
  const hudBossCompact = $('#hud-boss-compact');
  const hudBossStatus = $('#hud-boss-status');
  const hudBossStatusRight = $('#hud-boss-status-right');
  const hudBossLabel = $('#hud-boss-label');

  const hudProgFill = $('#hud-prog-fill');
  const hudProgText = $('#hud-prog-text');
  const hudFeverFill = $('#hud-fever-fill');
  const hudFeverStatus = $('#hud-fever-status');
  const bossBarWrap = $('#boss-bar-wrap');
  const hudBossFill = $('#hud-boss-fill');

  const playArea = $('#jd-play-area');
  const arena = $('#jd-arena');
  const judge = $('#jd-judge');
  const tele = $('#jd-tele');
  const bossIntro = $('#jd-boss-intro');
  const bossIntroText = $('#jd-boss-intro-text');
  const avatar = $('#jd-avatar');
  const obsLayer = $('#jd-obstacles');
  const rushBanner = $('#jd-rush-banner');

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
  const resPhaseEnd = $('#res-phase-end');
  const resPattern = $('#res-pattern');
  const resBossLabel = $('#res-boss-label');
  const resRush = $('#res-rush');

  const resScoreBig = $('#res-score-big');
  const resAccBig = $('#res-acc-big');
  const resComboBig = $('#res-combo-big');
  const resBossEndBig = $('#res-boss-end-big');

  const resultTitle = $('#jd-result-title');
  const resultSub = $('#jd-result-sub');
  const resultBoss = $('#jd-result-boss');
  const resultPattern = $('#jd-result-pattern');
  const resultRush = $('#jd-result-rush');
  const resultReward = $('#jd-result-reward');
  const resultRewardSub = $('#jd-result-reward-sub');
  const resultRewardIcon = $('#jd-result-reward-icon');
  const rankBadge = $('#jd-rank-badge');

  const logStatus = $('#jd-log-status');
  const btnEvents = $('#jd-btn-dl-events');
  const btnSessions = $('#jd-btn-dl-sessions');
  const btnSendLog = $('#jd-btn-send-log');

  const btnJump = $('#btn-jump');
  const btnDuck = $('#btn-duck');
  const btnStop = $('#btn-stop-early');

  let state = null;
  let rafId = 0;
  let obstacleSpawnTimer = 0;
  let bossActive = false;
  let bossHP = 0;
  let bossMaxHP = 0;
  let lastTs = 0;
  let gameStartedAt = 0;
  let inputLockUntil = 0;

  W.__JD_LAST_SUMMARY = null;

  const eventsLog = [];
  const sessionsLog = [];

  function getDiffCfg(diff) {
    if (diff === 'easy') return { speed: 280, spawnEvery: 1450, bossEvery: 22, feverGain: 6 };
    if (diff === 'hard') return { speed: 380, spawnEvery: 950, bossEvery: 14, feverGain: 9 };
    return { speed: 330, spawnEvery: 1150, bossEvery: 18, feverGain: 7 };
  }

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
    if (backHubResult) backHubResult.href = '#';
  }

  function toastJudge(text) {
    if (!judge) return;
    judge.textContent = text;
    judge.classList.add('show');
    setTimeout(() => judge.classList.remove('show'), 260);
  }

  function showTele(text, box = tele) {
    if (!box) return;
    box.classList.remove('hidden');
    box.classList.add('on');
    const inner = $('.teleBox', box);
    if (inner) inner.textContent = text;
    setTimeout(() => {
      box.classList.remove('on');
      setTimeout(() => box.classList.add('hidden'), 180);
    }, 650);
  }

  function setAvatarMode(mode) {
    if (!avatar) return;
    avatar.classList.remove('avatar-idle', 'avatar-jump', 'avatar-duck');
    avatar.classList.add(`avatar-${mode}`);
  }

  function setLogStatus(text) {
    if (logStatus) logStatus.textContent = text || '';
  }

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
    const escCsv = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [keys.join(','), ...rows.map(r => keys.map(k => escCsv(r[k])).join(','))].join('\n');
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

  function buildState() {
    return {
      mode: CFG.mode,
      diff: CFG.diff,
      duration: CFG.duration,
      totalTime: CFG.duration,
      timeLeft: CFG.duration,
      score: 0,
      combo: 0,
      comboMax: 0,
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
      stopped: false,
      tutorial: CFG.tutorial,
      bossName: '—',
      lastPattern: '—',
      rushState: '—',
      finalBossHp: '—'
    };
  }

  function updateArenaMode() {
    if (!playArea || !state) return;
    playArea.classList.remove('phase-1', 'phase-2', 'phase-3', 'final-rush', 'boss-frenzy');
    playArea.classList.add(`phase-${state.phase}`);
    if (state.rushState === 'FINAL RUSH') playArea.classList.add('final-rush');
    if (bossActive) playArea.classList.add('boss-frenzy');
  }

  function updateHUD() {
    if (!state) return;

    if (hudMode) hudMode.textContent = state.mode;
    if (hudDiff) hudDiff.textContent = state.diff;
    if (hudTime) hudTime.textContent = state.timeLeft.toFixed(1);
    if (hudPhase) hudPhase.textContent = `${state.phase} • ${state.phase === 3 ? 'final' : 'run'}`;
    if (hudScore) hudScore.textContent = String(Math.round(state.score));
    if (hudCombo) hudCombo.textContent = String(state.combo);
    if (hudStability) hudStability.textContent = `${Math.round(state.stability)}%`;
    if (hudBoss) hudBoss.textContent = bossActive ? `${bossHP}/${bossMaxHP}` : '—';

    if (hudPattern) hudPattern.textContent = state.lastPattern;
    if (hudRush) hudRush.textContent = state.rushState;
    if (hudBossCompact) hudBossCompact.textContent = bossActive ? `${state.bossName} ${bossHP}/${bossMaxHP}` : '—';
    if (hudBossStatus) hudBossStatus.textContent = bossActive ? 'BOSS ACTIVE' : 'NORMAL';
    if (hudBossStatusRight) hudBossStatusRight.textContent = bossActive ? `${Math.round((bossHP / Math.max(1, bossMaxHP)) * 100)}%` : '—';
    if (hudBossLabel) hudBossLabel.textContent = state.bossName;

    const prog = clamp(((state.totalTime - state.timeLeft) / Math.max(1, state.totalTime)) * 100, 0, 100);
    if (hudProgFill) hudProgFill.style.width = `${prog}%`;
    if (hudProgText) hudProgText.textContent = `${Math.round(prog)}%`;

    const feverPct = clamp(state.fever, 0, 100);
    if (hudFeverFill) hudFeverFill.style.width = `${feverPct}%`;
    if (hudFeverStatus) hudFeverStatus.textContent = feverPct >= 100 ? 'FEVER!' : `${Math.round(feverPct)}%`;

    if (bossBarWrap) bossBarWrap.classList.toggle('hidden', !bossActive);
    if (bossActive && hudBossFill) {
      const hpPct = clamp((bossHP / Math.max(1, bossMaxHP)) * 100, 0, 100);
      hudBossFill.style.width = `${hpPct}%`;
    }

    if (rushBanner) {
      rushBanner.classList.toggle('hidden', state.rushState !== 'FINAL RUSH');
    }

    updateArenaMode();
  }

  function makeObstacle(kind, isBoss = false, isFeint = false) {
    const el = D.createElement('div');
    el.className = `obs ${kind} ${isFeint ? 'feint' : ''}`;
    el.style.position = 'absolute';
    el.style.width = '90px';
    el.style.height = '90px';
    el.style.borderRadius = '18px';
    el.style.border = '1px solid rgba(148,163,184,.16)';
    el.style.background = 'rgba(15,23,42,.80)';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.transform = 'translate(-50%,-50%)';
    el.style.boxShadow = '0 14px 34px rgba(0,0,0,.22)';
    el.style.overflow = 'hidden';
    el.style.top = kind === 'low' ? '300px' : '190px';

    el.innerHTML = `
      <div style="position:relative;width:100%;height:100%;">
        ${
          kind === 'low'
            ? `<div style="position:absolute;left:50%;bottom:20px;transform:translateX(-50%);width:54px;height:34px;border-radius:10px;background:linear-gradient(180deg,#38bdf8,#2563eb);border:2px solid rgba(15,23,42,.28);box-shadow:inset 0 -8px 0 rgba(2,6,23,.12);"></div>
               <div style="position:absolute;left:50%;bottom:8px;transform:translateX(-50%);padding:4px 10px;border-radius:999px;font-size:11px;font-weight:1100;letter-spacing:.6px;border:1px solid rgba(34,211,238,.28);background:rgba(2,6,23,.72);color:#e5e7eb;">JUMP</div>`
            : `<div style="position:absolute;left:50%;top:24px;transform:translateX(-50%);width:64px;height:14px;border-radius:999px;background:linear-gradient(180deg,#f59e0b,#ef4444);border:2px solid rgba(15,23,42,.28);box-shadow:0 0 0 6px rgba(239,68,68,.06);"></div>
               <div style="position:absolute;left:50%;bottom:8px;transform:translateX(-50%);padding:4px 10px;border-radius:999px;font-size:11px;font-weight:1100;letter-spacing:.6px;border:1px solid rgba(245,158,11,.28);background:rgba(2,6,23,.72);color:#e5e7eb;">DUCK</div>`
        }
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
    state.lastPattern = kind === 'low' ? 'LOW / JUMP' : 'HIGH / DUCK';

    if (isBoss) {
      el.style.boxShadow = '0 0 0 2px rgba(239,68,68,.34), 0 18px 36px rgba(0,0,0,.28)';
    }

    if (isFeint) {
      el.style.outline = '2px solid rgba(167,139,250,.45)';
      el.style.boxShadow = '0 0 0 8px rgba(167,139,250,.08), 0 14px 34px rgba(0,0,0,.22)';
    }

    return obstacle;
  }

  function removeObstacle(ob) {
    ob.resolved = true;
    ob.el?.remove();
  }

  function maybeStartBoss() {
    if (bossActive || state.totalObs === 0) return;
    const diffCfg = getDiffCfg(state.diff);
    if (state.totalObs % diffCfg.bossEvery !== 0) return;

    bossActive = true;
    bossMaxHP = state.diff === 'hard' ? 4 : state.diff === 'easy' ? 2 : 3;
    bossHP = bossMaxHP;
    state.bossName = 'Shadow Boss';
    showTele('BOSS!', bossIntro);
    if (bossIntroText) bossIntroText.textContent = 'BOSS INCOMING';
    toastJudge('Boss incoming');
    logEvent('boss_start', { hp: bossHP });
    updateHUD();
  }

  function spawnOne() {
    if (state.stopped) return;

    if (bossActive) {
      const kind = Math.random() < 0.5 ? 'low' : 'high';
      makeObstacle(kind, true, Math.random() < 0.15);
      return;
    }

    const kind = Math.random() < 0.5 ? 'low' : 'high';
    makeObstacle(kind, false, Math.random() < 0.12);
  }

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

    const hitX = 144;
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
      state.comboMax = Math.max(state.comboMax, state.combo);
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
          state.finalBossHp = '0';
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
    state.rushState = state.phase === 3 ? 'FINAL RUSH' : '—';

    const diffCfg = getDiffCfg(state.diff);
    obstacleSpawnTimer += dt;
    const spawnGap = state.tutorial ? 1550 : diffCfg.spawnEvery;

    if (obstacleSpawnTimer >= spawnGap) {
      obstacleSpawnTimer = 0;
      maybeStartBoss();
      spawnOne();
    }

    const hitX = 144;

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
    if (bossActive) state.finalBossHp = String(bossHP);
    updateHUD();
    rafId = requestAnimationFrame(gameLoop);
  }

  function applyMenuToConfig() {
    CFG.mode = menuMode.value;
    CFG.diff = menuDiff.value;
    CFG.duration = Number(menuDuration.value) || 60;
    CFG.pid = participantId?.value?.trim() || CFG.pid || 'anon';
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

    if (hudMode) hudMode.textContent = CFG.mode;
    if (hudDiff) hudDiff.textContent = CFG.diff;
    if (hudTime) hudTime.textContent = state.totalTime.toFixed(1);

    if (obsLayer) obsLayer.innerHTML = '';
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
    if (score >= 500 && acc >= 50) return 'C';
    return 'D';
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
      view: JD_GATE.view || 'mobile',
      comboMax: state.comboMax,
      bossName: state.bossName,
      lastPattern: state.lastPattern,
      rushState: state.rushState,
      finalBossHp: state.finalBossHp
    };
  }

  function applyResultTheme(rank) {
    if (!rankBadge) return;
    rankBadge.classList.remove('rank-s', 'rank-a', 'rank-b', 'rank-c', 'rank-d');
    rankBadge.classList.add(`rank-${String(rank || 'c').toLowerCase()}`);
  }

  function fillResult(summary) {
    if (resMode) resMode.textContent = summary.mode;
    if (resDiff) resDiff.textContent = summary.diff;
    if (resDuration) resDuration.textContent = `${summary.duration}s`;
    if (resTotalObs) resTotalObs.textContent = String(summary.totalObs);
    if (resHits) resHits.textContent = String(summary.hits);
    if (resMiss) resMiss.textContent = String(summary.miss);
    if (resJumpHit) resJumpHit.textContent = String(summary.jumpHit);
    if (resDuckHit) resDuckHit.textContent = String(summary.duckHit);
    if (resJumpMiss) resJumpMiss.textContent = String(summary.jumpMiss);
    if (resDuckMiss) resDuckMiss.textContent = String(summary.duckMiss);
    if (resAcc) resAcc.textContent = `${summary.acc}%`;
    if (resRtMean) resRtMean.textContent = `${summary.rtMean} ms`;
    if (resStabilityMin) resStabilityMin.textContent = `${summary.stabilityMin}%`;
    if (resScore) resScore.textContent = String(summary.score);
    if (resRank) resRank.textContent = summary.rank;
    if (resPhaseEnd) resPhaseEnd.textContent = summary.rushState;
    if (resPattern) resPattern.textContent = summary.lastPattern;
    if (resBossLabel) resBossLabel.textContent = summary.bossName;
    if (resRush) resRush.textContent = summary.rushState;

    if (resScoreBig) resScoreBig.textContent = String(summary.score);
    if (resAccBig) resAccBig.textContent = `${summary.acc}%`;
    if (resComboBig) resComboBig.textContent = String(summary.comboMax);
    if (resBossEndBig) resBossEndBig.textContent = summary.finalBossHp || '—';

    if (resultTitle) resultTitle.textContent = summary.rank === 'S' ? 'สุดยอดมาก!' : summary.rank === 'A' ? 'เก่งมาก!' : 'ผ่านด่านฝึกแล้ว!';
    if (resultSub) resultSub.textContent = `Rank ${summary.rank} • ความแม่นยำ ${summary.acc}%`;
    if (resultBoss) resultBoss.textContent = summary.bossName || '—';
    if (resultPattern) resultPattern.textContent = summary.lastPattern || '—';
    if (resultRush) resultRush.textContent = summary.rushState || '—';

    if (resultReward) {
      if (summary.rank === 'S') resultReward.textContent = 'Perfect Reflex';
      else if (summary.rank === 'A') resultReward.textContent = 'Sharp Runner';
      else if (summary.rank === 'B') resultReward.textContent = 'Good Training';
      else resultReward.textContent = 'Keep Training';
    }

    if (resultRewardSub) {
      if (summary.rank === 'S') resultRewardSub.textContent = 'อ่านเป้าไว หลบแม่น และคุมจังหวะได้ยอดเยี่ยม';
      else if (summary.rank === 'A') resultRewardSub.textContent = 'รีเฟล็กซ์ดีมาก เหลือเก็บรายละเอียดอีกนิด';
      else if (summary.rank === 'B') resultRewardSub.textContent = 'ผ่านได้ดี ลองเพิ่มความนิ่งและความแม่นอีกหน่อย';
      else resultRewardSub.textContent = 'ฝึกต่ออีกนิด แล้วรอบหน้าจะดีกว่าเดิม';
    }

    if (resultRewardIcon) {
      resultRewardIcon.textContent = summary.rank === 'S' ? '🏆' : summary.rank === 'A' ? '⭐' : summary.rank === 'B' ? '💪' : '🎯';
    }

    if (rankBadge) rankBadge.textContent = summary.rank;
    applyResultTheme(summary.rank);
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

  if (playArea) playArea.addEventListener('pointerdown', onTapPlay);

  if (menuMode) {
    menuMode.addEventListener('change', () => {
      researchBlock.classList.toggle('hidden', menuMode.value !== 'research');
    });
  }

  $('[data-action="start"]', viewMenu)?.addEventListener('click', () => startGame({ tutorial: false }));
  $('[data-action="tutorial"]', viewMenu)?.addEventListener('click', () => startGame({ tutorial: true }));

  btnJump?.addEventListener('click', () => doAction('jump'));
  btnDuck?.addEventListener('click', () => doAction('duck'));
  btnStop?.addEventListener('click', () => stopGame(true));

  $('[data-action="play-again"]', viewResult)?.addEventListener('click', () => location.reload());

  $('[data-action="go-cooldown"]', viewResult)?.addEventListener('click', () => {
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

  $('[data-action="back-menu"]', viewResult)?.addEventListener('click', () => {
    location.href = CFG.hub || jdHub();
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