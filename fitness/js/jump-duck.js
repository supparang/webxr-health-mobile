// === /fitness/js/jump-duck.js ===
// Jump-Duck — HHA Standard (PC/Mobile/cVR-ready DOM game)
// PATCH FULL (Boss in Training/Test/Research + Mixed Boss + AI prediction hook)
// v20260225-jd-boss-mixed-full
'use strict';

(function () {
  const WIN = window;
  const DOC = document;

  /* =========================
   * Helpers
   * ========================= */
  const $ = (s, el = DOC) => el.querySelector(s);
  const $$ = (s, el = DOC) => Array.from(el.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
  const lerp = (a, b, t) => a + (b - a) * t;
  const nowMs = () => performance.now();

  function qs(k, def = null) {
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function safeJsonParse(s, fallback = null) {
    try { return JSON.parse(s); } catch (_) { return fallback; }
  }

  function dlText(filename, text, type = 'text/plain;charset=utf-8') {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = DOC.createElement('a');
    a.href = url;
    a.download = filename;
    DOC.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* =========================
   * DOM refs
   * ========================= */
  const els = {
    fatal: $('#jd-fatal'),

    app: $('#jd-app'),
    viewMenu: $('#view-menu'),
    viewPlay: $('#view-play'),
    viewResult: $('#view-result'),

    modeSel: $('#jd-mode'),
    diffSel: $('#jd-diff'),
    durSel: $('#jd-duration'),
    bossStyleSel: $('#jd-boss-style'),

    researchBlock: $('#jd-research-block'),
    participantId: $('#jd-participant-id'),
    group: $('#jd-group'),
    note: $('#jd-note'),

    backHubMenu: $('#jd-back-hub-menu'),
    backHubPlay: $('#jd-back-hub-play'),
    backHubResult: $('#jd-back-hub-result'),

    playArea: $('#jd-play-area'),
    avatar: $('#jd-avatar'),
    obstaclesWrap: $('#jd-obstacles'),
    judge: $('#jd-judge'),
    tele: $('#jd-tele'),

    // HUD
    hudPhase: $('#hud-phase'),
    hudBoss: $('#hud-boss'),
    hudProgFill: $('#hud-prog-fill'),
    hudProgText: $('#hud-prog-text'),
    hudFeverFill: $('#hud-fever-fill'),
    hudFeverStatus: $('#hud-fever-status'),
    bossBarWrap: $('#boss-bar-wrap'),
    hudBossStatus: $('#hud-boss-status'),
    hudBossFill: $('#hud-boss-fill'),

    hudMode: $('#hud-mode'),
    hudDiff: $('#hud-diff'),
    hudDuration: $('#hud-duration'),
    hudStability: $('#hud-stability'),
    hudTime: $('#hud-time'),
    hudObstacles: $('#hud-obstacles'),
    hudScore: $('#hud-score'),
    hudCombo: $('#hud-combo'),

    // Result
    resMode: $('#res-mode'),
    resDiff: $('#res-diff'),
    resDuration: $('#res-duration'),
    resTotalObs: $('#res-total-obs'),
    resHits: $('#res-hits'),
    resMiss: $('#res-miss'),
    resJumpHit: $('#res-jump-hit'),
    resDuckHit: $('#res-duck-hit'),
    resJumpMiss: $('#res-jump-miss'),
    resDuckMiss: $('#res-duck-miss'),
    resAcc: $('#res-acc'),
    resRtMean: $('#res-rt-mean'),
    resStabilityMin: $('#res-stability-min'),
    resScore: $('#res-score'),
    resRank: $('#res-rank'),

    // audio
    sfxHit: $('#jd-sfx-hit'),
    sfxMiss: $('#jd-sfx-miss'),
    sfxCombo: $('#jd-sfx-combo'),
    sfxBeep: $('#jd-sfx-beep'),
    sfxBoss: $('#jd-sfx-boss'),
    sfxFever: $('#jd-sfx-fever'),
  };

  /* =========================
   * Config
   * ========================= */
  const CFG = {
    gravityPx: 2800,
    jumpVelPx: 860,
    duckHoldMs: 260,
    baseGroundY: 64, // CSS avatar bottom
    hitXRatio: 0.24, // visual hit line

    spawnLeadPx: 900, // object starts at right
    obstacleW: 92,
    obstacleH: 92,

    actionWindowPx: 54, // detection around hit line
    laneLowY: 208,
    laneHighY: 96,

    score: {
      hit: 100,
      perfect: 150,
      bossCounter: 220
    },

    fever: {
      onAt: 100,
      offAt: 55,
      hitGain: 12,
      missLoss: 18,
      decayPerSec: 4.0
    },

    diff: {
      easy:   { speed: 260, spawnEveryMs: 1050, durationMul: 1.00, fakeoutRate: 0.05 },
      normal: { speed: 340, spawnEveryMs: 820,  durationMul: 1.00, fakeoutRate: 0.10 },
      hard:   { speed: 430, spawnEveryMs: 650,  durationMul: 1.00, fakeoutRate: 0.14 }
    },

    // Boss (เปิดทุกโหมด)
    boss: {
      enabledByMode: { training: true, test: true, research: true },
      spawnAtPctByMode: { training: 0.62, test: 0.58, research: 0.58 },
      durationSecByDiff: { easy: 10, normal: 14, hard: 18 },
      styleDefault: 'mixed',
      mixedWeights: { tempoShift: 0.28, fakeout: 0.20, burst: 0.26, counter: 0.14, jamLane: 0.12 },
      counterWindowMs: { easy: 260, normal: 210, hard: 170 }
    }
  };

  /* =========================
   * RNG (seeded for research)
   * ========================= */
  function xmur3(str) {
    for (var i = 0, h = 1779033703 ^ str.length; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = h << 13 | h >>> 19;
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }
  function sfc32(a, b, c, d) {
    return function () {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      var t = (a + b) | 0;
      a = b ^ b >>> 9;
      b = c + (c << 3) | 0;
      c = (c << 21 | c >>> 11);
      d = d + 1 | 0;
      t = t + d | 0;
      c = c + t | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function makeRng(seedStr) {
    const seedFn = xmur3(String(seedStr || Date.now()));
    return sfc32(seedFn(), seedFn(), seedFn(), seedFn());
  }

  /* =========================
   * State
   * ========================= */
  const state = {
    phase: 'menu',
    running: false,
    ended: false,
    tutorial: false,

    mode: 'training',      // training | test | research
    diff: 'normal',        // easy | normal | hard
    durationSec: 60,
    bossStyle: 'mixed',
    seed: String(qs('seed', Date.now())),

    startedAtPerf: 0,
    startedAtIso: '',
    elapsedMs: 0,
    dtMs: 16,
    lastFrameMs: 0,
    raf: 0,

    spawnTimerMs: 0,
    obstacles: [],
    nextObsId: 1,

    // avatar
    avatarY: 0,
    avatarVy: 0,
    avatarOnGround: true,
    duckUntilMs: 0,
    currentAction: 'idle', // idle|jump|duck
    lastActionAtMs: 0,

    // scoring
    score: 0,
    combo: 0,
    comboMax: 0,
    stability: 100,
    stabilityMin: 100,

    totalObs: 0,
    clearedObs: 0,

    jumpHit: 0,
    duckHit: 0,
    jumpMiss: 0,
    duckMiss: 0,
    misses: 0,

    // RT
    rtHits: [],

    // Fever
    fever: 0,
    feverOn: false,

    // AI prediction (predict-only)
    ai: {
      enabled: true,
      lockedInResearch: true,
      fatigueRisk: 0,
      skillScore: 0.5,
      suggested: 'normal',
      confidence: 0.5,
      reason: ''
    },

    // Boss
    boss: {
      enabled: false,
      active: false,
      style: 'mixed',
      phase: 0,
      hp: 0,
      hpMax: 100,
      startedAtMs: 0,
      endsAtMs: 0,
      triggerAtMs: 0,
      maxDurationMs: 0,
      nextPatternAtMs: 0,
      currentPattern: null,
      counterOpenUntilMs: 0,
      counterExpectedAction: null,
      jamActive: false,
      jamEndsAtMs: 0,
      timeline: []
    },

    // modifiers
    tempoMul: 1,
    tempoUntilMs: 0,
    spawnPressureMul: 1,
    spawnPressureUntilMs: 0,

    // logging-ish
    participant: '',
    group: '',
    note: '',
    sessionId: '',
    lastSummary: null,
    lastBossTimeline: []
  };

  /* =========================
   * View helpers
   * ========================= */
  function switchView(name) {
    state.phase = name;
    els.viewMenu.classList.add('jd-hidden');
    els.viewPlay.classList.add('jd-hidden');
    els.viewResult.classList.add('jd-hidden');
    if (name === 'menu') els.viewMenu.classList.remove('jd-hidden');
    if (name === 'play') els.viewPlay.classList.remove('jd-hidden');
    if (name === 'result') els.viewResult.classList.remove('jd-hidden');
  }

  function applyViewClass() {
    const touch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints > 0);
    const qv = String(qs('view', '') || '').toLowerCase();
    DOC.body.classList.remove('view-pc', 'view-mobile', 'view-vr', 'view-cvr');
    if (qv === 'vr') DOC.body.classList.add('view-vr');
    else if (qv === 'cvr') DOC.body.classList.add('view-cvr');
    else DOC.body.classList.add(touch ? 'view-mobile' : 'view-pc');
  }

  function updateHubLinks() {
    const hub = qs('hub', 'hub.html');
    [els.backHubMenu, els.backHubPlay, els.backHubResult].forEach(a => {
      if (a) a.href = hub || 'hub.html';
    });
  }

  function updateResearchBlockUI() {
    const m = String(els.modeSel?.value || 'training').toLowerCase();
    if (els.researchBlock) {
      els.researchBlock.classList.toggle('jd-hidden', m !== 'research');
    }
  }

  /* =========================
   * Audio helpers
   * ========================= */
  function playSfx(el, vol) {
    try {
      if (!el) return;
      if (Number.isFinite(vol)) el.volume = vol;
      el.currentTime = 0;
      el.play().catch(() => {});
    } catch (_) {}
  }

  /* =========================
   * HUD / UI helpers
   * ========================= */
  function setJudge(text, kind) {
    if (!els.judge) return;
    els.judge.textContent = text || '';
    els.judge.classList.remove('ok', 'combo', 'miss', 'boss', 'show');
    if (kind) els.judge.classList.add(kind);
    if (/BOSS|COUNTER|JAM/i.test(String(text || ''))) els.judge.classList.add('boss');
    els.judge.classList.add('show');
    clearTimeout(els.judge._timer);
    els.judge._timer = setTimeout(() => els.judge.classList.remove('show'), 320);
  }

  function telegraph(text) {
    if (!els.tele) return;
    const inner = els.tele.querySelector('.jd-tele-inner');
    if (inner) inner.textContent = text || '⚡ TEMPO SHIFT';
    els.tele.classList.remove('jd-hidden');
    els.tele.classList.add('on');
    clearTimeout(els.tele._timer);
    els.tele._timer = setTimeout(() => els.tele.classList.remove('on'), 520);
  }

  function setBossBar(show) {
    if (!els.bossBarWrap) return;
    els.bossBarWrap.classList.toggle('jd-hidden', !show);
  }

  function setBossUiName(name) {
    if (els.hudBoss) els.hudBoss.textContent = name || '—';
  }

  function setBossUiPhase(p) {
    if (els.hudPhase) els.hudPhase.textContent = String(p || 1);
  }

  function setBossHpUi(ratio) {
    const r = clamp(ratio, 0, 1);
    if (els.hudBossFill) els.hudBossFill.style.transform = `scaleX(${r})`;
    if (els.hudBossStatus) {
      if (state.boss.active) {
        els.hudBossStatus.textContent = `HP ${Math.round(state.boss.hp)}/${Math.round(state.boss.hpMax)}`;
        els.hudBossStatus.classList.add('on');
      } else {
        els.hudBossStatus.textContent = '—';
        els.hudBossStatus.classList.remove('on');
      }
    }
  }

  function setCounterState(on, expected) {
    if (!els.playArea) return;
    els.playArea.classList.toggle('jd-counter-on', !!on);
    els.playArea.dataset.counterExpected = on ? String(expected || '') : '';
  }

  function setJamState(on) {
    if (!els.playArea) return;
    els.playArea.classList.toggle('jd-jam-on', !!on);
  }

  function updateHud() {
    if (els.hudMode) els.hudMode.textContent = state.mode[0].toUpperCase() + state.mode.slice(1);
    if (els.hudDiff) els.hudDiff.textContent = state.diff;
    if (els.hudDuration) els.hudDuration.textContent = `${state.durationSec}s`;

    if (els.hudStability) els.hudStability.textContent = `${Math.round(state.stability)}%`;
    if (els.hudTime) els.hudTime.textContent = Math.max(0, (state.durationSec - state.elapsedMs / 1000)).toFixed(1);
    if (els.hudObstacles) els.hudObstacles.textContent = `${state.clearedObs} / ${state.totalObs}`;
    if (els.hudScore) els.hudScore.textContent = String(Math.round(state.score));
    if (els.hudCombo) els.hudCombo.textContent = String(state.combo);

    const p = clamp((state.elapsedMs / 1000) / Math.max(1, state.durationSec), 0, 1);
    if (els.hudProgFill) els.hudProgFill.style.transform = `scaleX(${p})`;
    if (els.hudProgText) els.hudProgText.textContent = `${Math.round(p * 100)}%`;

    const fv = clamp(state.fever / 100, 0, 1);
    if (els.hudFeverFill) els.hudFeverFill.style.transform = `scaleX(${fv})`;
    if (els.hudFeverStatus) {
      if (state.feverOn) {
        els.hudFeverStatus.textContent = 'FEVER!';
        els.hudFeverStatus.classList.add('on');
      } else if (state.fever >= 80) {
        els.hudFeverStatus.textContent = 'BUILD';
        els.hudFeverStatus.classList.remove('on');
      } else {
        els.hudFeverStatus.textContent = 'Ready';
        els.hudFeverStatus.classList.remove('on');
      }
    }

    setBossHpUi((state.boss.hpMax > 0) ? (state.boss.hp / state.boss.hpMax) : 0);
  }

  function updateAvatarUi() {
    if (!els.avatar) return;
    els.avatar.classList.remove('jump', 'duck');
    if (state.currentAction === 'jump' && !state.avatarOnGround) els.avatar.classList.add('jump');
    if (state.currentAction === 'duck') els.avatar.classList.add('duck');

    // Optional visual Y (CSS mostly handles)
    const y = -state.avatarY;
    els.avatar.style.transform = `translateX(-50%) translateY(${Math.round(y)}px)`;
    if (state.currentAction === 'duck') {
      els.avatar.style.transform = `translateX(-50%) translateY(${Math.round(y + 12)}px) scale(.98)`;
    }
  }

  function updateResultUI() {
    const totalHits = state.jumpHit + state.duckHit;
    const totalMiss = state.jumpMiss + state.duckMiss;
    const totalJudged = totalHits + totalMiss;
    const acc = totalJudged ? (totalHits / totalJudged) * 100 : 0;
    const rtMean = state.rtHits.length ? (state.rtHits.reduce((a, b) => a + b, 0) / state.rtHits.length) : null;

    if (els.resMode) els.resMode.textContent = state.mode[0].toUpperCase() + state.mode.slice(1);
    if (els.resDiff) els.resDiff.textContent = state.diff;
    if (els.resDuration) els.resDuration.textContent = `${state.durationSec}s`;

    if (els.resTotalObs) els.resTotalObs.textContent = String(state.totalObs);
    if (els.resHits) els.resHits.textContent = String(totalHits);
    if (els.resMiss) els.resMiss.textContent = String(totalMiss);

    if (els.resJumpHit) els.resJumpHit.textContent = String(state.jumpHit);
    if (els.resDuckHit) els.resDuckHit.textContent = String(state.duckHit);
    if (els.resJumpMiss) els.resJumpMiss.textContent = String(state.jumpMiss);
    if (els.resDuckMiss) els.resDuckMiss.textContent = String(state.duckMiss);

    if (els.resAcc) els.resAcc.textContent = `${acc.toFixed(1)} %`;
    if (els.resRtMean) els.resRtMean.textContent = rtMean == null ? '-' : `${rtMean.toFixed(0)} ms`;
    if (els.resStabilityMin) els.resStabilityMin.textContent = `${state.stabilityMin.toFixed(1)} %`;
    if (els.resScore) els.resScore.textContent = String(Math.round(state.score));

    let rank = 'C';
    if (acc >= 95 && state.stabilityMin >= 70) rank = 'S';
    else if (acc >= 88) rank = 'A';
    else if (acc >= 75) rank = 'B';
    if (els.resRank) els.resRank.textContent = rank;

    state.lastSummary = {
      mode: state.mode,
      diff: state.diff,
      durationSec: state.durationSec,
      totalObs: state.totalObs,
      hits: totalHits,
      miss: totalMiss,
      accPct: +acc.toFixed(2),
      rtMeanMs: rtMean == null ? null : +rtMean.toFixed(2),
      stabilityMin: +state.stabilityMin.toFixed(2),
      score: Math.round(state.score),
      rank,
      ai: { ...state.ai },
      boss: {
        style: state.boss.style,
        timelineCount: (state.lastBossTimeline || []).length
      }
    };

    try { localStorage.setItem('JD_LAST_SUMMARY', JSON.stringify(state.lastSummary)); } catch (_) {}
  }

  /* =========================
   * Score/stability helpers
   * ========================= */
  function addScore(n) {
    const mul = state.feverOn ? 1.5 : 1.0;
    state.score += Math.round((Number(n) || 0) * mul);
  }
  function addCombo(n = 1) {
    state.combo = Math.max(0, state.combo + (Number(n) || 0));
    state.comboMax = Math.max(state.comboMax, state.combo);
  }
  function breakCombo(drop = 9999) {
    state.combo = Math.max(0, state.combo - Math.max(1, Number(drop) || 1));
  }
  function addMiss(n = 1) {
    state.misses += Math.max(1, Number(n) || 1);
  }
  function reduceStability(n) {
    state.stability = Math.max(0, state.stability - (Number(n) || 0));
    state.stabilityMin = Math.min(state.stabilityMin, state.stability);
  }
  function healStability(n) {
    state.stability = Math.min(100, state.stability + (Number(n) || 0));
  }

  function addFever(v) {
    state.fever = clamp(state.fever + (Number(v) || 0), 0, 100);
    if (!state.feverOn && state.fever >= CFG.fever.onAt) {
      state.feverOn = true;
      playSfx(els.sfxFever, 0.65);
      telegraph('🔥 FEVER!');
    }
  }
  function loseFever(v) {
    state.fever = clamp(state.fever - (Number(v) || 0), 0, 100);
    if (state.feverOn && state.fever <= CFG.fever.offAt) {
      state.feverOn = false;
    }
  }

  /* =========================
   * Obstacle system
   * ========================= */
  function hitLineX() {
    if (!els.playArea) return 200;
    const r = els.playArea.getBoundingClientRect();
    return r.width * CFG.hitXRatio;
  }

  function obstacleTypeToNeed(type) {
    return type === 'low' ? 'jump' : 'duck';
  }

  function spawnObstacle(kind, opts = {}) {
    const id = state.nextObsId++;
    const speedBase = (CFG.diff[state.diff] || CFG.diff.normal).speed;
    const speed = speedBase * (opts.speedMul || 1) * (state.tempoMul || 1);
    const playRect = els.playArea.getBoundingClientRect();
    const startX = playRect.width + 60;

    const ob = {
      id,
      kind,               // low | high
      x: startX,
      y: kind === 'low' ? CFG.laneLowY : CFG.laneHighY,
      w: CFG.obstacleW,
      h: CFG.obstacleH,
      speed,
      spawnedAtMs: state.elapsedMs,
      dueAtMs: 0,
      judged: false,
      passed: false,
      fakeout: !!opts.fakeout,
      fakeoutAtX: opts.fakeoutAtX ?? null,
      _fakeoutDone: false
    };

    // Estimate due time to hit line
    const hx = hitLineX();
    ob.dueAtMs = state.elapsedMs + ((ob.x - hx) / Math.max(10, ob.speed)) * 1000;

    const el = DOC.createElement('div');
    el.className = `jd-obstacle jd-obstacle--${kind}`;
    if (ob.fakeout) el.classList.add('jd-feint');

    const inner = DOC.createElement('div');
    inner.className = 'jd-obstacle-inner';

    const ico = DOC.createElement('div');
    ico.className = 'jd-obs-icon';
    ico.textContent = (kind === 'low') ? '🪵' : '🧱';

    const tag = DOC.createElement('div');
    tag.className = 'jd-obs-tag';
    tag.textContent = (kind === 'low') ? 'JUMP' : 'DUCK';

    inner.appendChild(ico);
    inner.appendChild(tag);
    el.appendChild(inner);
    els.obstaclesWrap?.appendChild(el);

    ob.el = el;
    ob.icoEl = ico;
    ob.tagEl = tag;

    state.obstacles.push(ob);
    state.totalObs++;
    return ob;
  }

  function flipObstacleType(ob) {
    if (!ob || ob.judged) return;
    ob.kind = (ob.kind === 'low') ? 'high' : 'low';
    ob.y = ob.kind === 'low' ? CFG.laneLowY : CFG.laneHighY;

    if (ob.el) {
      ob.el.classList.toggle('jd-obstacle--low', ob.kind === 'low');
      ob.el.classList.toggle('jd-obstacle--high', ob.kind === 'high');
      ob.el.classList.add('jd-reveal');
    }
    if (ob.icoEl) ob.icoEl.textContent = (ob.kind === 'low') ? '🪵' : '🧱';
    if (ob.tagEl) ob.tagEl.textContent = (ob.kind === 'low') ? 'JUMP' : 'DUCK';
  }

  function updateObstacles(dtSec) {
    const hx = hitLineX();
    const winPx = CFG.actionWindowPx;

    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      const ob = state.obstacles[i];

      // speed may be influenced live by tempo
      const speedBase = (CFG.diff[state.diff] || CFG.diff.normal).speed;
      const liveMul = (state.tempoMul || 1);
      ob.speed = speedBase * liveMul * (state.boss.jamActive ? 1.06 : 1);

      ob.x -= ob.speed * dtSec;

      // fakeout reveal/flip
      if (ob.fakeout && !ob._fakeoutDone) {
        const triggerX = ob.fakeoutAtX || (hx + 120);
        if (ob.x <= triggerX) {
          ob._fakeoutDone = true;
          flipObstacleType(ob);
          telegraph('👀 FAKEOUT!');
        }
      }

      // visual
      if (ob.el) {
        ob.el.style.left = `${ob.x}px`;
        ob.el.style.top = `${ob.y}px`;
      }

      // timeout miss if passed hit line too far and not judged
      if (!ob.judged && ob.x < (hx - winPx)) {
        ob.judged = true;
        ob.passed = true;
        const need = obstacleTypeToNeed(ob.kind);
        if (need === 'jump') state.jumpMiss++;
        else state.duckMiss++;

        addMiss(1);
        breakCombo(999);
        reduceStability(state.boss.active ? 10 : 7);
        loseFever(CFG.fever.missLoss);
        playSfx(els.sfxMiss, 0.5);
        setJudge('MISS', 'miss');
      }

      // cleanup off-screen
      if (ob.x < -160) {
        if (ob.el) ob.el.remove();
        state.obstacles.splice(i, 1);
      }
    }
  }

  function tryJudgeAction(action) {
    const hx = hitLineX();
    const winPx = CFG.actionWindowPx;

    let best = null;
    let bestDx = Infinity;

    for (const ob of state.obstacles) {
      if (ob.judged) continue;
      const dx = Math.abs(ob.x - hx);
      if (dx <= winPx && dx < bestDx) {
        bestDx = dx;
        best = ob;
      }
    }

    if (!best) {
      // blank tap => small penalty only during jam or spam
      setJudge('—', 'miss');
      return false;
    }

    const need = obstacleTypeToNeed(best.kind);
    const rtMs = Math.round(state.elapsedMs - best.dueAtMs); // negative=early positive=late
    const absRt = Math.abs(rtMs);

    best.judged = true;
    if (best.el) {
      best.el.style.opacity = '.15';
      setTimeout(() => best.el && best.el.remove(), 80);
    }

    if (action === need) {
      state.clearedObs++;
      if (action === 'jump') state.jumpHit++;
      else state.duckHit++;
      state.rtHits.push(absRt);

      let text = 'OK';
      let kind = 'ok';
      let score = CFG.score.hit;

      if (absRt <= 70) { text = 'PERFECT'; score = CFG.score.perfect; kind = 'combo'; }
      else if (absRt <= 130) { text = 'GREAT'; score = 120; kind = 'ok'; }

      addScore(score);
      addCombo(1);
      healStability(state.feverOn ? 0.8 : 0.5);
      addFever(CFG.fever.hitGain);

      // boss chip damage on good play
      if (state.boss.active) {
        const chip = absRt <= 70 ? 4 : (absRt <= 130 ? 3 : 2);
        damageBoss(chip, 'obstacle_hit');
      }

      if (state.combo > 0 && state.combo % 10 === 0) playSfx(els.sfxCombo, 0.55);
      else playSfx(els.sfxHit, 0.55);

      setJudge(text, kind);
      return true;
    } else {
      if (need === 'jump') state.jumpMiss++;
      else state.duckMiss++;

      addMiss(1);
      breakCombo(999);
      reduceStability(state.boss.active ? 11 : 8);
      loseFever(CFG.fever.missLoss);
      playSfx(els.sfxMiss, 0.5);
      setJudge('MISS', 'miss');
      return false;
    }
  }

  /* =========================
   * Boss system
   * ========================= */
  function pushBossTimeline(type, extra = {}) {
    state.boss.timeline.push({
      tMs: Math.round(state.elapsedMs),
      type,
      phase: state.boss.phase || 0,
      hp: Math.round(state.boss.hp || 0),
      ...extra
    });
  }

  function pickWeighted(items, weights) {
    const sum = weights.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
    let r = state.rng() * sum;
    for (let i = 0; i < items.length; i++) {
      r -= (Number(weights[i]) || 0);
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  function damageBoss(amount, reason) {
    if (!state.boss.active) return;
    state.boss.hp = Math.max(0, state.boss.hp - (Number(amount) || 0));
    setBossHpUi(state.boss.hp / Math.max(1, state.boss.hpMax));
    pushBossTimeline('boss_damage', { amount: Number(amount) || 0, reason });

    if (state.boss.hp <= 0) {
      endBoss('boss-clear');
    }
  }

  function applyBossPenalty(kind) {
    const dmg = (kind === 'counter_fail') ? 8 : 5;
    const comboDrop = (kind === 'counter_fail') ? 2 : 1;

    reduceStability(dmg);
    addMiss(1);
    breakCombo(comboDrop);
    loseFever(kind === 'counter_fail' ? 12 : 8);

    playSfx(els.sfxMiss, 0.55);
    setJudge(kind === 'counter_fail' ? 'COUNTER MISS!' : 'JAM!', 'miss');
    pushBossTimeline('boss_penalty', { kind, dmg, comboDrop });
  }

  function triggerTempoShift(factor, ms, announce) {
    state.tempoMul = Number(factor) || 1;
    state.tempoUntilMs = state.elapsedMs + (Number(ms) || 900);
    if (announce) telegraph(`⚡ TEMPO x${state.tempoMul.toFixed(2)}`);

    els.playArea?.classList.add('shake');
    setTimeout(() => els.playArea?.classList.remove('shake'), 180);
  }

  function setSpawnPressureBoost(factor, ms) {
    state.spawnPressureMul = Number(factor) || 1;
    state.spawnPressureUntilMs = state.elapsedMs + (Number(ms) || 1000);
  }

  function startBoss() {
    state.boss.active = true;
    state.boss.phase = 1;
    state.boss.startedAtMs = state.elapsedMs;
    state.boss.endsAtMs = state.elapsedMs + state.boss.maxDurationMs;
    state.boss.hp = state.boss.hpMax;
    state.boss.currentPattern = null;
    state.boss.nextPatternAtMs = state.elapsedMs + 900;
    state.boss.counterExpectedAction = null;
    state.boss.jamActive = false;
    state.boss.timeline.length = 0;

    setBossBar(true);
    setBossUiName((state.boss.style || 'mixed').toUpperCase());
    setBossUiPhase(1);
    setBossHpUi(1);

    playSfx(els.sfxBoss, 0.6);
    telegraph(`🔥 BOSS START • ${(state.boss.style || 'mixed').toUpperCase()}`);
    pushBossTimeline('boss_start', { style: state.boss.style });

    triggerTempoShift(1.08, 900, true);
  }

  function endBoss(reason) {
    if (!state.boss.active) return;
    state.boss.active = false;
    state.boss.counterExpectedAction = null;
    state.boss.counterOpenUntilMs = 0;
    state.boss.jamActive = false;
    state.boss.jamEndsAtMs = 0;

    setCounterState(false);
    setJamState(false);
    setBossBar(false);

    pushBossTimeline('boss_end', { reason });
    telegraph(reason === 'boss-clear' ? '✅ BOSS CLEAR' : '⏱️ BOSS END');
  }

  function runBossTempoShift() {
    const p = state.boss.phase || 1;
    const factor = (p === 1) ? 1.10 : (p === 2 ? 1.18 : 1.25);
    const dur = (p === 3) ? 1300 : 900;
    triggerTempoShift(factor, dur, true);
    damageBoss(8 + p * 2, 'tempoShift');
    state.boss.nextPatternAtMs = state.elapsedMs + dur + 500;
  }

  function runBossFakeout() {
    const p = state.boss.phase || 1;
    telegraph('👀 FAKEOUT');
    // spawn a short sequence with fake flips
    const count = (p === 1) ? 2 : (p === 2 ? 3 : 4);
    for (let i = 0; i < count; i++) {
      const kind = state.rng() < 0.5 ? 'low' : 'high';
      const ob = spawnObstacle(kind, {
        speedMul: 1.03 + p * 0.04,
        fakeout: true,
        fakeoutAtX: hitLineX() + 110 + i * 10
      });
      // stagger x a bit by shifting position right
      ob.x += i * 140;
      if (ob.el) ob.el.style.left = `${ob.x}px`;
    }
    damageBoss(10 + p * 2, 'fakeout');
    state.boss.nextPatternAtMs = state.elapsedMs + 1400;
  }

  function runBossBurst() {
    const p = state.boss.phase || 1;
    telegraph('⚡ BURST');
    setSpawnPressureBoost(p === 3 ? 1.35 : 1.18, p === 3 ? 1600 : 1200);
    triggerTempoShift(p === 3 ? 1.22 : 1.12, p === 3 ? 1200 : 800, false);
    damageBoss(12 + p * 3, 'burst');
    state.boss.nextPatternAtMs = state.elapsedMs + (p === 3 ? 1700 : 1500);
  }

  function runBossCounter() {
    const p = state.boss.phase || 1;
    const expected = state.rng() < 0.5 ? 'jump' : 'duck';
    state.boss.counterExpectedAction = expected;
    state.boss.counterOpenUntilMs = state.elapsedMs + (CFG.boss.counterWindowMs[state.diff] || 210);

    setCounterState(true, expected);
    telegraph(`🛡️ COUNTER • ${expected.toUpperCase()}`);
    pushBossTimeline('counter_open', {
      expected,
      windowMs: (CFG.boss.counterWindowMs[state.diff] || 210)
    });

    // small extra obstacles around counter for pressure
    if (p >= 2 && state.rng() < 0.7) {
      const kind = state.rng() < 0.5 ? 'low' : 'high';
      const ob = spawnObstacle(kind, { speedMul: 1.05 + p * 0.03 });
      ob.x += 120;
      if (ob.el) ob.el.style.left = `${ob.x}px`;
    }

    state.boss.nextPatternAtMs = state.elapsedMs + 1200;
  }

  function runBossJam() {
    const p = state.boss.phase || 1;
    state.boss.jamActive = true;
    state.boss.jamEndsAtMs = state.elapsedMs + (p === 3 ? 1800 : 1300);
    setJamState(true);

    telegraph('🧨 JAM');
    pushBossTimeline('jam_start', { ms: state.boss.jamEndsAtMs - state.elapsedMs });

    setSpawnPressureBoost(p === 3 ? 1.25 : 1.12, state.boss.jamEndsAtMs - state.elapsedMs);
    damageBoss(9 + p * 2, 'jamLane');
    state.boss.nextPatternAtMs = state.boss.jamEndsAtMs + 450;
  }

  function scheduleNextBossPattern() {
    const phase = state.boss.phase || 1;
    const style = state.boss.style || 'mixed';

    let type = 'tempoShift';

    if (style === 'classic') {
      type = (phase === 1) ? 'tempoShift' : (phase === 2 ? 'burst' : 'counter');
    } else if (style === 'random') {
      type = pickWeighted(Object.keys(CFG.boss.mixedWeights), Object.values(CFG.boss.mixedWeights));
    } else {
      const w = { ...CFG.boss.mixedWeights };
      if (phase === 1) { w.fakeout += 0.05; w.counter = Math.max(0, w.counter - 0.04); }
      if (phase === 2) { w.burst += 0.06; w.tempoShift += 0.04; }
      if (phase === 3) { w.counter += 0.08; w.jamLane += 0.05; }
      type = pickWeighted(Object.keys(w), Object.values(w));
    }

    state.boss.currentPattern = type;
    pushBossTimeline('pattern', { pattern: type, phase });

    if (type === 'tempoShift') runBossTempoShift();
    else if (type === 'fakeout') runBossFakeout();
    else if (type === 'burst') runBossBurst();
    else if (type === 'counter') runBossCounter();
    else if (type === 'jamLane') runBossJam();
    else runBossTempoShift();
  }

  function updateBossSystem() {
    if (!state.boss.enabled) return;

    if (!state.boss.active && state.elapsedMs >= state.boss.triggerAtMs && !state.ended) {
      startBoss();
    }
    if (!state.boss.active) return;

    if (state.elapsedMs >= state.boss.endsAtMs) {
      endBoss('boss-timeup');
      return;
    }

    const hpPct = state.boss.hp / Math.max(1, state.boss.hpMax);
    const targetPhase = hpPct > 0.66 ? 1 : (hpPct > 0.33 ? 2 : 3);
    if (targetPhase !== state.boss.phase) {
      state.boss.phase = targetPhase;
      setBossUiPhase(targetPhase);
      telegraph(`BOSS PHASE ${targetPhase}`);
      pushBossTimeline('phase', { phase: targetPhase });
    }

    if (state.elapsedMs >= state.boss.nextPatternAtMs) {
      scheduleNextBossPattern();
    }

    if (state.boss.counterExpectedAction && state.elapsedMs > state.boss.counterOpenUntilMs) {
      applyBossPenalty('counter_fail');
      pushBossTimeline('counter_fail_timeout');
      state.boss.counterExpectedAction = null;
      setCounterState(false);
    }

    if (state.boss.jamActive && state.elapsedMs > state.boss.jamEndsAtMs) {
      state.boss.jamActive = false;
      setJamState(false);
      pushBossTimeline('jam_end');
    }
  }

  /* =========================
   * AI prediction hook (predict-only)
   * ========================= */
  function updateAiPrediction() {
    if (!state.ai.enabled) return;

    const totalHits = state.jumpHit + state.duckHit;
    const totalMiss = state.jumpMiss + state.duckMiss;
    const judged = totalHits + totalMiss;
    const acc = judged ? (totalHits / judged) * 100 : 0;
    const p = clamp((state.elapsedMs / 1000) / Math.max(1, state.durationSec), 0, 1);

    const fatigueRisk = clamp((1 - state.stability / 100) * 0.55 + Math.min(0.4, totalMiss * 0.03) + p * 0.12, 0, 1);
    const skillScore = clamp((acc / 100) * 0.55 + Math.min(0.3, state.combo * 0.01) + (state.stability / 100) * 0.15, 0, 1);

    let suggested = 'normal';
    if (skillScore > 0.78 && fatigueRisk < 0.35) suggested = 'hard';
    else if (skillScore < 0.42 || fatigueRisk > 0.70) suggested = 'easy';

    let reason = 'balanced performance';
    if (fatigueRisk > 0.70) reason = 'fatigue/miss/stability trend ↑';
    else if (skillScore > 0.75) reason = 'accuracy+combo stable';

    state.ai.fatigueRisk = fatigueRisk;
    state.ai.skillScore = skillScore;
    state.ai.suggested = suggested;
    state.ai.confidence = 0.6 + Math.min(0.35, p * 0.35);
    state.ai.reason = reason;

    // research lock = predict only (no adaptive changes)
  }

  /* =========================
   * Game flow
   * ========================= */
  function resetGameState() {
    state.running = false;
    state.ended = false;
    state.elapsedMs = 0;
    state.dtMs = 16;
    state.lastFrameMs = 0;
    state.spawnTimerMs = 0;
    state.obstacles.length = 0;
    state.nextObsId = 1;

    state.avatarY = 0;
    state.avatarVy = 0;
    state.avatarOnGround = true;
    state.duckUntilMs = 0;
    state.currentAction = 'idle';
    state.lastActionAtMs = -99999;

    state.score = 0;
    state.combo = 0;
    state.comboMax = 0;
    state.stability = 100;
    state.stabilityMin = 100;
    state.totalObs = 0;
    state.clearedObs = 0;
    state.jumpHit = 0;
    state.duckHit = 0;
    state.jumpMiss = 0;
    state.duckMiss = 0;
    state.misses = 0;
    state.rtHits.length = 0;

    state.fever = 0;
    state.feverOn = false;

    state.tempoMul = 1;
    state.tempoUntilMs = 0;
    state.spawnPressureMul = 1;
    state.spawnPressureUntilMs = 0;

    // Boss reset
    state.boss.active = false;
    state.boss.phase = 0;
    state.boss.hpMax = 100;
    state.boss.hp = 100;
    state.boss.startedAtMs = 0;
    state.boss.endsAtMs = 0;
    state.boss.nextPatternAtMs = 0;
    state.boss.currentPattern = null;
    state.boss.counterOpenUntilMs = 0;
    state.boss.counterExpectedAction = null;
    state.boss.jamActive = false;
    state.boss.jamEndsAtMs = 0;
    state.boss.timeline = [];

    // DOM cleanup
    els.obstaclesWrap && (els.obstaclesWrap.innerHTML = '');
    setCounterState(false);
    setJamState(false);
    setBossBar(false);
    setBossUiName('—');
    setBossUiPhase(1);
    setBossHpUi(1);
    updateAvatarUi();
    updateHud();
  }

  function makeSessionId() {
    return `JD-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function startGame(opts = {}) {
    resetGameState();

    state.tutorial = !!opts.tutorial;
    state.mode = String(els.modeSel?.value || 'training').toLowerCase();
    state.diff = String(els.diffSel?.value || 'normal').toLowerCase();
    state.durationSec = clamp(state.tutorial ? 15 : (els.durSel?.value || 60), 15, 180);
    state.bossStyle = String((els.bossStyleSel?.value || qs('boss', CFG.boss.styleDefault) || CFG.boss.styleDefault)).toLowerCase();
    if (!['mixed', 'classic', 'random'].includes(state.bossStyle)) state.bossStyle = CFG.boss.styleDefault;

    state.participant = (els.participantId?.value || '').trim();
    state.group = (els.group?.value || '').trim();
    state.note = (els.note?.value || '').trim();

    state.seed = String(qs('seed', Date.now()));
    const seedBasis = `${state.seed}|${state.mode}|${state.diff}|${state.durationSec}|${state.participant}|${state.group}|${state.note}|${state.tutorial ? 'tutorial' : 'main'}`;
    state.rng = makeRng(seedBasis);

    state.sessionId = makeSessionId();
    state.startedAtIso = new Date().toISOString();
    state.startedAtPerf = nowMs();
    state.lastFrameMs = state.startedAtPerf;

    // Boss init (เปิดทุกโหมดตาม requirement)
    state.boss.enabled = !!CFG.boss.enabledByMode[state.mode];
    state.boss.style = state.bossStyle;
    const startPct = CFG.boss.spawnAtPctByMode[state.mode] ?? 0.60;
    state.boss.triggerAtMs = Math.floor(state.durationSec * 1000 * startPct);
    state.boss.maxDurationMs = (CFG.boss.durationSecByDiff[state.diff] || 14) * 1000;

    // Tutorial = boss off (ซ้อม)
    if (state.tutorial) state.boss.enabled = false;

    switchView('play');
    state.running = true;
    state.ended = false;

    // HUD labels
    if (els.hudMode) els.hudMode.textContent = state.tutorial ? 'Tutorial' : (state.mode[0].toUpperCase() + state.mode.slice(1));
    if (els.hudDiff) els.hudDiff.textContent = state.diff;
    if (els.hudDuration) els.hudDuration.textContent = `${state.durationSec}s`;

    // quick announcement
    setJudge(state.tutorial ? 'TUTORIAL' : 'READY', 'ok');
    updateHud();

    cancelAnimationFrame(state.raf);
    state.raf = requestAnimationFrame(loop);
  }

  function stopGame(reason = 'manual-stop') {
    if (!state.running || state.ended) return;
    endGame(reason);
  }

  function endGame(reason = 'song-end') {
    state.running = false;
    state.ended = true;
    cancelAnimationFrame(state.raf);
    state.raf = 0;

    // finalize boss
    if (state.boss.active) endBoss(reason);

    state.lastBossTimeline = Array.isArray(state.boss.timeline) ? state.boss.timeline.slice() : [];
    try { localStorage.setItem('JD_LAST_BOSS_TIMELINE', JSON.stringify(state.lastBossTimeline)); } catch (_) {}

    // Save last summary/hub summary
    const endIso = new Date().toISOString();
    try {
      const hha = {
        game: 'jump-duck',
        sessionId: state.sessionId,
        mode: state.mode,
        diff: state.diff,
        durationSec: state.durationSec,
        reason,
        startTimeIso: state.startedAtIso,
        endTimeIso: endIso,
        scoreFinal: Math.round(state.score),
        comboMax: state.comboMax,
        misses: state.misses,
        bossStyle: state.boss.style,
        bossTimelineCount: state.lastBossTimeline.length
      };
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(hha));
    } catch (_) {}

    updateResultUI();
    switchView('result');
  }

  function loop(ts) {
    if (!state.running || state.ended) return;
    const dt = clamp(ts - state.lastFrameMs, 0, 50);
    state.lastFrameMs = ts;
    state.dtMs = dt;
    state.elapsedMs = ts - state.startedAtPerf;

    // End by time
    if (state.elapsedMs >= state.durationSec * 1000) {
      endGame('time-up');
      return;
    }

    // Modifiers expire
    if (state.elapsedMs >= state.tempoUntilMs) state.tempoMul = 1;
    if (state.elapsedMs >= state.spawnPressureUntilMs) state.spawnPressureMul = 1;

    // Fever decay
    loseFever(CFG.fever.decayPerSec * (dt / 1000));

    // Spawn
    const diffCfg = CFG.diff[state.diff] || CFG.diff.normal;
    const baseSpawn = diffCfg.spawnEveryMs;
    const feverMul = state.feverOn ? 0.92 : 1.0;
    const bossMul = state.boss.active ? 0.92 : 1.0;
    const jamMul = state.spawnPressureMul || 1;
    const tempoMul = state.tempoMul || 1;
    const spawnInterval = baseSpawn / (jamMul * tempoMul) * feverMul * bossMul;

    state.spawnTimerMs += dt;
    while (state.spawnTimerMs >= spawnInterval) {
      state.spawnTimerMs -= spawnInterval;
      let kind = (state.rng() < 0.5) ? 'low' : 'high';

      // Slight pattern control to prevent impossible spam same-type too often
      const last2 = state.obstacles.slice(-2).map(o => o.kind);
      if (last2.length === 2 && last2[0] === kind && last2[1] === kind && state.rng() < 0.6) {
        kind = (kind === 'low') ? 'high' : 'low';
      }

      const fakeoutAllowed = state.boss.active && (state.boss.currentPattern === 'fakeout');
      const fakeout = fakeoutAllowed && state.rng() < (0.35 + (state.boss.phase * 0.10));

      spawnObstacle(kind, {
        speedMul: 1 + (state.boss.active ? 0.03 * state.boss.phase : 0),
        fakeout
      });
    }

    // Avatar physics
    const dtSec = dt / 1000;
    if (!state.avatarOnGround) {
      state.avatarVy -= CFG.gravityPx * dtSec;
      state.avatarY += state.avatarVy * dtSec;
      if (state.avatarY <= 0) {
        state.avatarY = 0;
        state.avatarVy = 0;
        state.avatarOnGround = true;
        if (state.currentAction === 'jump') state.currentAction = 'idle';
      }
    }

    if (state.currentAction === 'duck' && state.elapsedMs >= state.duckUntilMs) {
      state.currentAction = 'idle';
    }

    // Update world
    updateObstacles(dtSec);
    updateBossSystem();
    updateAiPrediction();
    updateAvatarUi();
    updateHud();

    // Fail state by stability
    if (state.stability <= 0) {
      endGame('stability-zero');
      return;
    }

    state.raf = requestAnimationFrame(loop);
  }

  /* =========================
   * Input / actions
   * ========================= */
  function performAction(action) {
    if (!state.running || state.ended) return;
    const now = state.elapsedMs;

    // Anti-spam (especially useful in JAM)
    const dt = now - state.lastActionAtMs;
    state.lastActionAtMs = now;
    if (state.boss.active && state.boss.jamActive && dt < 90) {
      applyBossPenalty('jam_hit');
      pushBossTimeline('jam_penalty_spam', { action, dt });
      // continue to allow actual action judge too (fun but punishing)
    }

    // Counter mechanic
    if (state.boss.active && state.boss.counterExpectedAction) {
      const within = now <= state.boss.counterOpenUntilMs;
      const correct = action === state.boss.counterExpectedAction;

      if (within && correct) {
        setCounterState(false);
        state.boss.counterExpectedAction = null;

        addScore(CFG.score.bossCounter);
        addCombo(1);
        addFever(16);
        damageBoss(18, 'counter_success');

        setJudge('COUNTER!', 'combo');
        playSfx(els.sfxCombo, 0.6);
        pushBossTimeline('counter_success', { action });
        return; // counter input consumes this action
      } else if (within && !correct) {
        applyBossPenalty('counter_fail');
        setCounterState(false);
        state.boss.counterExpectedAction = null;
        pushBossTimeline('counter_fail_wrong', { action });
        // continue to judge obstacle too
      }
    }

    // Avatar action state
    if (action === 'jump') {
      if (state.avatarOnGround) {
        state.avatarOnGround = false;
        state.avatarVy = CFG.jumpVelPx;
        state.currentAction = 'jump';
      }
    } else if (action === 'duck') {
      state.currentAction = 'duck';
      state.duckUntilMs = now + CFG.duckHoldMs;
    }

    // Judge obstacle
    tryJudgeAction(action);
  }

  function onPointerPlayArea(ev) {
    if (!state.running || state.ended || !els.playArea) return;
    const r = els.playArea.getBoundingClientRect();
    const y = ev.clientY - r.top;
    const action = (y < r.height / 2) ? 'jump' : 'duck';
    performAction(action);
  }

  function onKeyDown(ev) {
    const k = String(ev.key || '').toLowerCase();
    if (k === 'arrowup' || k === 'w') { ev.preventDefault(); performAction('jump'); }
    if (k === 'arrowdown' || k === 's') { ev.preventDefault(); performAction('duck'); }
    if (k === 'escape' && state.running) { ev.preventDefault(); stopGame('escape'); }
  }

  /* =========================
   * Actions wiring
   * ========================= */
  function bindActionButtons() {
    DOC.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-action]');
      if (!btn) return;
      const act = btn.getAttribute('data-action');

      if (act === 'start') startGame({ tutorial: false });
      else if (act === 'tutorial') startGame({ tutorial: true });
      else if (act === 'jump') performAction('jump');
      else if (act === 'duck') performAction('duck');
      else if (act === 'stop-early') stopGame('stop-early');
      else if (act === 'play-again') startGame({ tutorial: false });
      else if (act === 'back-menu') {
        stopGame('back-menu');
        resetGameState();
        switchView('menu');
      }
      else if (act === 'download-boss-timeline') {
        const data = state.lastBossTimeline || safeJsonParse(localStorage.getItem('JD_LAST_BOSS_TIMELINE'), []) || [];
        dlText(`jumpduck-boss-timeline-${Date.now()}.json`, JSON.stringify(data, null, 2), 'application/json');
      }
    });
  }

  function bindEvents() {
    els.modeSel?.addEventListener('change', updateResearchBlockUI);

    // pointer play area (tap top/bottom)
    els.playArea?.addEventListener('pointerdown', onPointerPlayArea, { passive: true });

    // quick buttons are handled by data-action
    DOC.addEventListener('keydown', onKeyDown);

    bindActionButtons();
  }

  /* =========================
   * Boot
   * ========================= */
  function boot() {
    applyViewClass();
    updateHubLinks();
    updateResearchBlockUI();
    resetGameState();
    switchView('menu');
    bindEvents();

    // Query presets
    const qMode = String(qs('mode', '') || '').toLowerCase();
    if (els.modeSel && ['training', 'test', 'research'].includes(qMode)) els.modeSel.value = qMode;

    const qDiff = String(qs('diff', '') || '').toLowerCase();
    if (els.diffSel && ['easy', 'normal', 'hard'].includes(qDiff)) els.diffSel.value = qDiff;

    const qDur = String(qs('duration', qs('time', '')) || '').trim();
    if (els.durSel && ['45', '60', '90'].includes(qDur)) els.durSel.value = qDur;

    const qBoss = String(qs('boss', '') || '').toLowerCase();
    if (els.bossStyleSel && ['mixed', 'classic', 'random'].includes(qBoss)) els.bossStyleSel.value = qBoss;

    updateResearchBlockUI();
  }

  try {
    boot();
  } catch (err) {
    console.error(err);
    if (els.fatal) {
      els.fatal.classList.remove('jd-hidden');
      els.fatal.textContent = '[Jump-Duck Fatal Error]\\n' + String(err && (err.stack || err.message) || err);
    } else {
      alert(String(err && (err.stack || err.message) || err));
    }
  }
})();