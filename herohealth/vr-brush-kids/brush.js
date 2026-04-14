// /herohealth/vr-brush-kids/brush.js
// Brush V5 — single-file build, mobile-friendly

(() => {
  'use strict';

  const qs = new URLSearchParams(location.search);

  const GAME_ID = 'brush';
  const GAME_VARIANT = 'brush-v5-single';
  const GAME_TITLE = 'Brush V5: Mouth Rescue Adventure';

  const SCENE_IDS = {
    launcher: 'launcher',
    intro: 'intro',
    scan: 'scan',
    guided: 'guided',
    pressure: 'pressure',
    fever: 'fever',
    bossBreak: 'bossBreak',
    boss: 'boss',
    finish: 'finish',
    summary: 'summary'
  };

  const MODE_CONFIG = {
    learn: {
      id: 'learn',
      label: 'Learn',
      durationSec: 90,
      scanSec: 6,
      bossBreakSec: 8,
      targetScanCount: 2
    },
    adventure: {
      id: 'adventure',
      label: 'Adventure',
      durationSec: 90,
      scanSec: 5,
      bossBreakSec: 7,
      targetScanCount: 3
    },
    rescue: {
      id: 'rescue',
      label: 'Rescue',
      durationSec: 75,
      scanSec: 4,
      bossBreakSec: 6,
      targetScanCount: 3
    }
  };

  const ZONE_DEFS = [
    { id: 'upper-left', label: 'บนซ้าย', patternType: 'horizontal' },
    { id: 'upper-front', label: 'บนหน้า', patternType: 'circle' },
    { id: 'upper-right', label: 'บนขวา', patternType: 'horizontal' },
    { id: 'lower-left', label: 'ล่างซ้าย', patternType: 'vertical' },
    { id: 'lower-front', label: 'ล่างหน้า', patternType: 'circle' },
    { id: 'lower-right', label: 'ล่างขวา', patternType: 'vertical' }
  ];

  const COACH_LINES = {
    intro: ['คราบกำลังบุกแล้ว ไปช่วยฟันกัน!', 'เริ่มจากจุดอันตรายก่อนนะ'],
    scan: ['หาจุดสกปรกที่สุดให้เจอ', 'มองที่ขอบเหงือกและซอกฟัน'],
    guided: ['ค่อย ๆ แปรงตามทิศนะ', 'เยี่ยมเลย ทำตามลายให้ต่อเนื่อง'],
    pressure: ['หลายโซนเริ่มเสี่ยงแล้ว!', 'เลือกโซนให้ดีก่อนคราบลาม'],
    fever: ['สุดยอด! เข้า FEVER แล้ว!', 'รีบเก็บให้ได้มากที่สุด!'],
    bossBreak: ['ทำลายโล่ให้แตก!', 'แตะจุดอ่อนให้ครบ!'],
    boss: ['ตอนนี้แหละ รีบแปรงโจมตี!', 'บอสกำลังอ่อนแรง!'],
    finish: ['ช่วยทั้งปากสำเร็จแล้ว!', 'ฟันสะอาดสดใสสุด ๆ']
  };

  const THREAT_RULES = {
    passiveRisePerSec: 2.4,
    cleanDropPerHit: 1.8
  };

  const FEVER_RULES = {
    comboThreshold: 12,
    durationMs: 6000,
    cleanMultiplier: 1.45,
    scoreMultiplier: 2
  };

  const SCORE_RULES = {
    patternHit: 10,
    zoneComplete: 100,
    scanHit: 50,
    scanSpecialHit: 100,
    bossBreakHit: 40,
    bossBreakPerfect: 200
  };

  const el = {
    sceneStage: document.getElementById('sceneStage'),
    timeText: document.getElementById('timeText'),
    scoreText: document.getElementById('scoreText'),
    comboText: document.getElementById('comboText'),
    threatText: document.getElementById('threatText'),
    sceneText: document.getElementById('sceneText'),

    coachFace: document.getElementById('coachFace'),
    coachLine: document.getElementById('coachLine'),

    scanTimerText: document.getElementById('scanTimerText'),
    scanFoundText: document.getElementById('scanFoundText'),
    objectiveText: document.getElementById('objectiveText'),

    bossShieldText: document.getElementById('bossShieldText'),
    bossBreakTimerText: document.getElementById('bossBreakTimerText'),
    bossBreakCountText: document.getElementById('bossBreakCountText'),

    summaryModal: document.getElementById('summaryModal'),
    summaryRank: document.getElementById('summaryRank'),
    summaryScore: document.getElementById('summaryScore'),
    summaryCoverage: document.getElementById('summaryCoverage'),
    summaryAccuracy: document.getElementById('summaryAccuracy'),
    summaryAdvice: document.getElementById('summaryAdvice'),

    btnStart: document.getElementById('btnStart'),
    btnReplay: document.getElementById('btnReplay'),
    btnPause: document.getElementById('btnPause'),
    btnBackHub: document.getElementById('btnBackHub'),

    objectiveCard: document.getElementById('objectiveCard'),
    scanCard: document.getElementById('scanCard'),
    bossCard: document.getElementById('bossCard'),
    helperCard: document.getElementById('helperCard'),

    brushInputLayer: document.getElementById('brushInputLayer'),
    brushCursor: document.getElementById('brushCursor'),

    plaqueLayer: document.getElementById('plaqueLayer'),
    scanTargetLayer: document.getElementById('scanTargetLayer'),
    bossWeakPointLayer: document.getElementById('bossWeakPointLayer'),
    fxLayer: document.getElementById('fxLayer'),
    scorePopupLayer: document.getElementById('scorePopupLayer')
  };

  injectRuntimeStyles();

  const ctx = readRunContext();
  const state = createInitialState(ctx);
  const logger = createLogger(ctx);

  bindEvents();
  bindBrushInputLayer();
  closeSummary();
  renderLauncher();
  renderFrame();

  function injectRuntimeStyles() {
    const css = `
      #plaqueLayer,#scanTargetLayer,#bossWeakPointLayer,#fxLayer,#scorePopupLayer{
        position:absolute; inset:0; pointer-events:none; z-index:14;
      }
      .plaque-node,.scan-target,.boss-weakpoint,.fx-burst,.score-popup{
        position:absolute; transform:translate(-50%, -50%);
      }
      .plaque-node{
        width:26px; height:26px; border-radius:999px;
        background:radial-gradient(circle at 35% 35%, #fff1ae 0 25%, #ffd46d 25% 65%, #e4a43c 65% 100%);
        border:2px solid rgba(255,255,255,.92);
        box-shadow:0 4px 10px rgba(186,112,38,.18);
        transition:opacity .12s ease, transform .12s ease;
      }
      .plaque-node.is-heavy{ width:34px; height:34px; }
      .plaque-node.is-gap{ width:18px; height:18px; border-radius:8px; }
      .plaque-node.is-dim{ opacity:.35; transform:translate(-50%, -50%) scale(.86); }

      .scan-target,.boss-weakpoint{
        pointer-events:auto; border:none; cursor:pointer;
        display:grid; place-items:center; color:#23404d; font-weight:900;
      }
      .scan-target{
        width:48px; height:48px; border-radius:999px;
        background:radial-gradient(circle, rgba(255,255,255,.92), rgba(114,215,255,.75));
        border:3px solid #fff;
        box-shadow:0 0 0 6px rgba(114,215,255,.16), 0 0 18px rgba(114,215,255,.24);
      }
      .scan-target.is-special{
        background:radial-gradient(circle, rgba(255,255,255,.96), rgba(255,224,127,.82));
      }
      .scan-target.is-picked{ opacity:.35; transform:translate(-50%, -50%) scale(.84); }

      .boss-weakpoint{
        width:54px; height:54px; border-radius:999px;
        background:radial-gradient(circle, rgba(255,255,255,.94), rgba(255,102,126,.84));
        border:3px solid #fff;
        box-shadow:0 0 0 6px rgba(255,102,126,.18), 0 0 18px rgba(255,102,126,.22);
      }
      .boss-weakpoint.is-hit{ opacity:.30; transform:translate(-50%, -50%) scale(.78); }

      .fx-burst{
        width:16px; height:16px; border-radius:999px;
        background:radial-gradient(circle, rgba(255,255,255,.98), rgba(114,215,255,.55) 62%, transparent 72%);
        animation:brushFxPop .36s ease-out forwards;
      }
      .fx-burst.is-miss{
        background:radial-gradient(circle, rgba(255,255,255,.95), rgba(255,102,126,.55) 62%, transparent 72%);
      }
      .fx-burst.is-complete{
        width:24px; height:24px;
        background:radial-gradient(circle, rgba(255,255,255,.98), rgba(143,236,192,.62) 62%, transparent 72%);
      }
      @keyframes brushFxPop{
        0%{ transform:translate(-50%, -50%) scale(.2); opacity:1; }
        100%{ transform:translate(-50%, -50%) scale(1.8); opacity:0; }
      }

      .score-popup{
        min-width:54px; padding:6px 10px; border-radius:999px;
        background:rgba(255,255,255,.96);
        border:2px solid rgba(255,255,255,.96);
        box-shadow:0 8px 16px rgba(71,156,197,.14);
        font-size:13px; font-weight:1000; white-space:nowrap; pointer-events:none;
        animation:brushScorePop .68s ease-out forwards;
      }
      .score-popup.is-good{ color:#1f8f66; }
      .score-popup.is-perfect{ color:#d48b00; }
      .score-popup.is-bad{ color:#c93d5d; }
      .score-popup.is-clear{ color:#1f8f66; }
      .score-popup.is-boss{ color:#c93d5d; }
      .score-popup.is-combo{ color:#7a52d4; }

      @keyframes brushScorePop{
        0%{ transform:translate(-50%, -50%) scale(.72); opacity:0; }
        12%{ transform:translate(-50%, -50%) scale(1.05); opacity:1; }
        100%{ transform:translate(-50%, -105%) scale(1.02); opacity:0; }
      }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function readRunContext() {
    const modeId = qs.get('mode') || 'adventure';
    const mode = MODE_CONFIG[modeId] || MODE_CONFIG.adventure;

    return {
      sessionId: '',
      pid: qs.get('pid') || 'anon',
      name: qs.get('name') || 'Hero',
      modeId: mode.id,
      modeLabel: mode.label,
      diff: qs.get('diff') || 'normal',
      view: qs.get('view') || 'mobile',
      runMode: qs.get('run') || 'play',
      hub: qs.get('hub') || '../hub.html',
      seed: qs.get('seed') || ''
    };
  }

  function createInitialState(runCtx) {
    const mode = MODE_CONFIG[runCtx.modeId] || MODE_CONFIG.adventure;
    return {
      ctx: runCtx,
      running: false,
      paused: false,
      sceneId: SCENE_IDS.launcher,
      sceneEnteredAtMs: 0,

      time: {
        startedAtIso: '',
        lastTs: 0,
        elapsedMs: 0,
        durationPlannedSec: mode.durationSec,
        remainingSec: mode.durationSec
      },

      score: {
        total: 0,
        combo: 0,
        comboMax: 0,
        feverActive: false,
        feverEndAtMs: 0
      },

      threat: { percent: 0 },

      zones: ZONE_DEFS.map((z) => ({
        ...z,
        cleanPercent: 0,
        threatPercent: 25,
        visited: false,
        done: false,
        hits: 0,
        misses: 0,
        dwellMs: 0
      })),

      activeZoneId: 'upper-front',

      brushInput: {
        active: false,
        pointerId: null,
        lastX: 0,
        lastY: 0,
        lastHitAtMs: 0
      },

      scan: {
        played: false,
        active: false,
        roundId: '',
        startedAtMs: 0,
        durationSec: 0,
        targetGoal: 0,
        hits: 0,
        misses: 0,
        specialHits: 0,
        targets: [],
        picked: new Set(),
        accuracyPercent: 0,
        completedGoal: false
      },

      bossBreak: {
        played: false,
        active: false,
        roundId: '',
        startedAtMs: 0,
        durationSec: 0,
        targetGoal: 0,
        hits: 0,
        misses: 0,
        accuracyPercent: 0,
        success: false,
        damageWindowMs: 0,
        weakPoints: []
      },

      boss: {
        active: false,
        hpPercent: 100,
        cleared: false,
        damageWindowEndAtMs: 0
      }
    };
  }

  function createLogger(runCtx) {
    const sessionId = `brush-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let currentSceneId = SCENE_IDS.launcher;
    let startAt = performance.now();
    const buffer = [];

    return {
      sessionId,
      setScene(sceneId) {
        currentSceneId = sceneId;
      },
      event(type, payload = {}) {
        buffer.push({
          type,
          at: new Date().toISOString(),
          timeFromStartMs: Math.round(performance.now() - startAt),
          sceneId: currentSceneId,
          sessionId,
          pid: runCtx.pid,
          ...payload
        });
      },
      startSession(payload = {}) {
        startAt = performance.now();
        this.event('brush_session_start', payload);
      },
      finish(payload = {}) {
        this.event('brush_session_finish', payload);
      },
      flush() {
        try {
          const key = 'HHA_BRUSH_SINGLE_LOGS';
          const oldLogs = JSON.parse(localStorage.getItem(key) || '[]');
          oldLogs.push(...buffer);
          localStorage.setItem(key, JSON.stringify(oldLogs));
          buffer.length = 0;
        } catch {}
      }
    };
  }

  function bindEvents() {
    el.btnStart?.addEventListener('click', startGame);
    el.btnReplay?.addEventListener('click', replayGame);
    el.btnPause?.addEventListener('click', togglePause);
    el.btnBackHub?.addEventListener('click', backToHub);

    document.querySelectorAll('[data-zone]').forEach((node) => {
      node.addEventListener('click', () => {
        const zoneId = node.getAttribute('data-zone') || '';
        if (zoneId) onZoneSelect(zoneId);
      });
    });

    window.addEventListener('keydown', (e) => {
      if (!state.running || state.paused) return;

      if (e.code === 'Space') {
        e.preventDefault();
        simulateBrushHit({ dragDirection: 'horizontal' });
      }

      if (e.code === 'KeyQ') onZoneSelect('upper-left');
      if (e.code === 'KeyW') onZoneSelect('upper-front');
      if (e.code === 'KeyE') onZoneSelect('upper-right');
      if (e.code === 'KeyA') onZoneSelect('lower-left');
      if (e.code === 'KeyS') onZoneSelect('lower-front');
      if (e.code === 'KeyD') onZoneSelect('lower-right');
    });

    window.addEventListener('beforeunload', () => logger.flush());
  }

  function bindBrushInputLayer() {
    const layer = el.brushInputLayer;
    if (!layer) return;

    layer.addEventListener('pointerdown', onBrushPointerDown);
    layer.addEventListener('pointermove', onBrushPointerMove);
    layer.addEventListener('pointerup', onBrushPointerUp);
    layer.addEventListener('pointercancel', onBrushPointerUp);
    layer.addEventListener('pointerleave', onBrushPointerUp);
  }

  function onBrushPointerDown(e) {
    if (!state.running || state.paused) return;
    if (!isBrushInputScene(state.sceneId)) return;

    const point = getPointFromEvent(e);
    state.brushInput.active = true;
    state.brushInput.pointerId = e.pointerId;
    state.brushInput.lastX = point.x;
    state.brushInput.lastY = point.y;
    state.brushInput.lastHitAtMs = 0;

    el.brushInputLayer?.classList.add('is-active');
    el.brushInputLayer?.classList.remove('is-idle');

    try {
      el.brushInputLayer?.setPointerCapture?.(e.pointerId);
    } catch {}

    updateBrushCursorFromPoint(point);
  }

  function onBrushPointerMove(e) {
    if (!state.brushInput.active) return;
    if (state.brushInput.pointerId !== e.pointerId) return;
    if (!isBrushInputScene(state.sceneId)) return;

    const point = getPointFromEvent(e);
    const dx = point.x - state.brushInput.lastX;
    const dy = point.y - state.brushInput.lastY;
    const dist = distance2d(point.x, point.y, state.brushInput.lastX, state.brushInput.lastY);
    const now = performance.now();

    const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
    updateBrushCursorFromPoint(point, Number.isFinite(angleDeg) ? angleDeg : -18);

    const enoughDistance = dist >= brushDragDistanceThresholdPx();
    const enoughTime = (now - state.brushInput.lastHitAtMs) >= brushHitThrottleMs();

    if (enoughDistance && enoughTime) {
      const dragDirection = detectBrushDirection(dx, dy);
      simulateBrushHit({ dragDirection });
      state.brushInput.lastHitAtMs = now;
    }

    state.brushInput.lastX = point.x;
    state.brushInput.lastY = point.y;
  }

  function onBrushPointerUp(e) {
    if (state.brushInput.pointerId !== null && e.pointerId !== state.brushInput.pointerId) return;
    resetBrushInputState();
    el.brushInputLayer?.classList.remove('is-active');
    el.brushInputLayer?.classList.add('is-idle');
    hideBrushCursor();
  }

  function startGame() {
    const fresh = createInitialState(ctx);
    Object.assign(state, fresh);

    closeSummary();
    state.running = true;
    state.paused = false;
    state.time.startedAtIso = new Date().toISOString();
    state.time.lastTs = performance.now();

    logger.startSession({
      modeId: state.ctx.modeId,
      diff: state.ctx.diff,
      view: state.ctx.view
    });

    syncScenePresentation(SCENE_IDS.intro);
    enterScene(SCENE_IDS.intro);
    requestAnimationFrame(tick);
  }

  function replayGame() {
    closeSummary();
    renderLauncher();
    startGame();
  }

  function togglePause() {
    if (!state.running) return;

    state.paused = !state.paused;

    if (state.paused) {
      resetBrushInputState();
      hideBrushCursor();
    }

    logger.event(state.paused ? 'brush_pause' : 'brush_resume', {
      sceneId: state.sceneId,
      elapsedMs: Math.round(state.time.elapsedMs)
    });

    if (!state.paused) {
      state.time.lastTs = performance.now();
      requestAnimationFrame(tick);
    }

    renderCoach(state.paused ? '⏸️' : '🪥', state.paused ? 'พักเกมอยู่' : 'กลับมาเล่นต่อแล้ว');
  }

  function backToHub() {
    logger.flush();
    location.href = state.ctx.hub;
  }

  function tick(ts) {
    if (!state.running || state.paused) return;

    const dt = Math.max(0, ts - state.time.lastTs);
    state.time.lastTs = ts;
    state.time.elapsedMs += dt;
    state.time.remainingSec = Math.max(0, state.time.durationPlannedSec - Math.floor(state.time.elapsedMs / 1000));

    updateScene();
    updateGlobalSystems(dt);
    renderFrame();

    if (
      state.time.remainingSec <= 0 &&
      state.sceneId !== SCENE_IDS.finish &&
      state.sceneId !== SCENE_IDS.summary
    ) {
      enterScene(SCENE_IDS.finish);
      return;
    }

    requestAnimationFrame(tick);
  }

  function updateScene() {
    const age = performance.now() - state.sceneEnteredAtMs;

    if (state.sceneId === SCENE_IDS.intro && age >= 1200) {
      enterScene(SCENE_IDS.scan);
      return;
    }

    if (state.sceneId === SCENE_IDS.scan) {
      updateScan();
      return;
    }

    if (state.sceneId === SCENE_IDS.guided && age >= 12000) {
      enterScene(SCENE_IDS.pressure);
      return;
    }

    if (state.sceneId === SCENE_IDS.pressure) {
      if (!state.score.feverActive && Math.floor(state.score.combo) >= FEVER_RULES.comboThreshold) {
        startFever();
      }
      if (age >= 42000) {
        enterScene(SCENE_IDS.bossBreak);
      }
      return;
    }

    if (state.sceneId === SCENE_IDS.bossBreak) {
      updateBossBreak();
      return;
    }

    if (state.sceneId === SCENE_IDS.boss) {
      if (!state.boss.cleared && performance.now() > state.boss.damageWindowEndAtMs) {
        enterScene(SCENE_IDS.finish);
        return;
      }
      if (state.boss.hpPercent <= 0 && !state.boss.cleared) {
        state.boss.cleared = true;
        enterScene(SCENE_IDS.finish);
      }
      return;
    }

    if (state.sceneId === SCENE_IDS.finish && age >= 1000) {
      enterScene(SCENE_IDS.summary);
    }
  }

  function updateGlobalSystems(dt) {
    const dtSec = dt / 1000;

    if (
      state.sceneId === SCENE_IDS.guided ||
      state.sceneId === SCENE_IDS.pressure ||
      state.sceneId === SCENE_IDS.boss
    ) {
      let rise = THREAT_RULES.passiveRisePerSec;
      if (state.sceneId === SCENE_IDS.pressure) rise += 1.2;
      if (state.sceneId === SCENE_IDS.boss) rise += 1.6;
      state.threat.percent = clamp(state.threat.percent + rise * dtSec, 0, 100);
    }

    if (state.score.feverActive && performance.now() >= state.score.feverEndAtMs) {
      endFever();
    }
  }

  function enterScene(sceneId) {
    state.sceneId = sceneId;
    state.sceneEnteredAtMs = performance.now();
    logger.setScene(sceneId);
    logger.event('brush_scene_enter', { sceneId });

    syncScenePresentation(sceneId);

    if (sceneId === SCENE_IDS.intro) {
      renderCoach('👀', randomPick(COACH_LINES.intro));
    } else if (sceneId === SCENE_IDS.scan) {
      startScanMiniGame();
    } else if (sceneId === SCENE_IDS.guided) {
      renderCoach('🙂', randomPick(COACH_LINES.guided));
    } else if (sceneId === SCENE_IDS.pressure) {
      renderCoach('⚠️', randomPick(COACH_LINES.pressure));
    } else if (sceneId === SCENE_IDS.bossBreak) {
      startBossBreakMiniGame();
    } else if (sceneId === SCENE_IDS.boss) {
      startBossPhase();
    } else if (sceneId === SCENE_IDS.finish) {
      renderCoach('✨', randomPick(COACH_LINES.finish));
    } else if (sceneId === SCENE_IDS.summary) {
      finishGame();
    }

    renderFrame();
  }

  function startScanMiniGame() {
    const mode = MODE_CONFIG[state.ctx.modeId] || MODE_CONFIG.adventure;
    const goal = mode.targetScanCount;
    state.scan = {
      played: true,
      active: true,
      roundId: `scan-${Date.now()}`,
      startedAtMs: performance.now(),
      durationSec: mode.scanSec,
      targetGoal: goal,
      hits: 0,
      misses: 0,
      specialHits: 0,
      accuracyPercent: 0,
      completedGoal: false,
      picked: new Set(),
      targets: buildScanTargets(goal)
    };

    renderCoach('🔎', randomPick(COACH_LINES.scan));
    setObjective(`หาจุดสกปรกอันตราย ${goal} จุด`, SCENE_IDS.scan);
    renderScanTargets();
  }

  function buildScanTargets(goal) {
    const base = [
      { id: 't1', zoneId: 'upper-front', special: true, x: 50, y: 28 },
      { id: 't2', zoneId: 'upper-left', special: false, x: 24, y: 38 },
      { id: 't3', zoneId: 'lower-right', special: false, x: 76, y: 66 },
      { id: 't4', zoneId: 'lower-front', special: false, x: 50, y: 72 }
    ];
    return base.slice(0, Math.max(goal, 2));
  }

  function updateScan() {
    const elapsedSec = (performance.now() - state.scan.startedAtMs) / 1000;
    if (elapsedSec >= state.scan.durationSec || state.scan.hits >= state.scan.targetGoal) {
      const attempts = state.scan.hits + state.scan.misses;
      state.scan.accuracyPercent = attempts ? Math.round((state.scan.hits / attempts) * 100) : 0;
      state.scan.completedGoal = state.scan.hits >= state.scan.targetGoal;

      const scoreGain =
        state.scan.hits * SCORE_RULES.scanHit +
        state.scan.specialHits * (SCORE_RULES.scanSpecialHit - SCORE_RULES.scanHit);

      state.score.total += scoreGain;

      if (state.scan.accuracyPercent >= 75) {
        state.threat.percent = clamp(state.threat.percent - 10, 0, 100);
      }

      state.scan.active = false;
      clearNode(el.scanTargetLayer);
      setObjective('เริ่มแปรงตามทิศที่โค้ชแนะนำ', SCENE_IDS.guided);
      enterScene(SCENE_IDS.guided);
    }
  }

  function startBossBreakMiniGame() {
    const mode = MODE_CONFIG[state.ctx.modeId] || MODE_CONFIG.adventure;
    state.bossBreak = {
      played: true,
      active: true,
      roundId: `boss-${Date.now()}`,
      startedAtMs: performance.now(),
      durationSec: mode.bossBreakSec,
      targetGoal: 4,
      hits: 0,
      misses: 0,
      accuracyPercent: 0,
      success: false,
      damageWindowMs: 0,
      weakPoints: [
        { id: 'wp1', x: 38, y: 42, hit: false },
        { id: 'wp2', x: 62, y: 42, hit: false },
        { id: 'wp3', x: 50, y: 56, hit: false },
        { id: 'wp4', x: 50, y: 70, hit: false }
      ]
    };

    renderCoach('💥', randomPick(COACH_LINES.bossBreak));
    setObjective('ทำลายจุดอ่อนให้ครบ 4 จุด', SCENE_IDS.bossBreak);
    renderBossWeakPoints();
  }

  function updateBossBreak() {
    const elapsedSec = (performance.now() - state.bossBreak.startedAtMs) / 1000;
    if (elapsedSec >= state.bossBreak.durationSec || state.bossBreak.hits >= state.bossBreak.targetGoal) {
      const attempts = state.bossBreak.hits + state.bossBreak.misses;
      state.bossBreak.accuracyPercent = attempts ? Math.round((state.bossBreak.hits / attempts) * 100) : 0;
      state.bossBreak.success = state.bossBreak.hits >= state.bossBreak.targetGoal;
      state.bossBreak.damageWindowMs = state.bossBreak.success ? 6000 : 2500;
      state.bossBreak.active = false;

      state.score.total += state.bossBreak.hits * SCORE_RULES.bossBreakHit;
      if (state.bossBreak.success) {
        state.score.total += SCORE_RULES.bossBreakPerfect;
      }

      clearNode(el.bossWeakPointLayer);
      enterScene(SCENE_IDS.boss);
    }
  }

  function startBossPhase() {
    state.boss.active = true;
    state.boss.hpPercent = 100;
    state.boss.cleared = false;
    state.boss.damageWindowEndAtMs = performance.now() + (state.bossBreak.damageWindowMs || 2500);

    renderCoach('👑', randomPick(COACH_LINES.boss));
    setObjective('โล่แตกแล้ว รีบแปรงโจมตีบอส!', SCENE_IDS.boss);
  }

  function onZoneSelect(zoneId) {
    if (!state.running) return;
    const zone = state.zones.find((z) => z.id === zoneId);
    if (!zone) return;
    state.activeZoneId = zoneId;
    zone.visited = true;
    renderCoach('🦷', `ตอนนี้ช่วยโซน ${zone.label}`);
    renderFrame();
  }

  function isBrushInputScene(sceneId) {
    return sceneId === SCENE_IDS.guided || sceneId === SCENE_IDS.pressure || sceneId === SCENE_IDS.boss;
  }

  function getPointFromEvent(e) {
    return {
      x: Number(e.clientX || 0),
      y: Number(e.clientY || 0)
    };
  }

  function distance2d(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  function updateBrushCursorFromPoint(point, angleDeg = -18) {
    if (!el.brushCursor) return;
    el.brushCursor.hidden = false;
    el.brushCursor.style.left = `${point.x}px`;
    el.brushCursor.style.top = `${point.y}px`;
    el.brushCursor.style.transform = `translate(-50%, -50%) rotate(${angleDeg}deg)`;
  }

  function hideBrushCursor() {
    if (!el.brushCursor) return;
    el.brushCursor.hidden = true;
  }

  function brushHitThrottleMs() {
    if (state.ctx.view === 'mobile') return 60;
    if (state.ctx.view === 'cvr') return 110;
    return 80;
  }

  function brushDragDistanceThresholdPx() {
    if (state.ctx.view === 'mobile') return 10;
    return 14;
  }

  function resetBrushInputState() {
    state.brushInput.active = false;
    state.brushInput.pointerId = null;
    state.brushInput.lastX = 0;
    state.brushInput.lastY = 0;
    state.brushInput.lastHitAtMs = 0;
  }

  function detectBrushDirection(dx, dy) {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const bias = state.ctx.view === 'mobile' ? 1.15 : 1.35;

    if (ax < 2 && ay < 2) return 'none';
    if (ax > ay * bias) return 'horizontal';
    if (ay > ax * bias) return 'vertical';
    return 'circle';
  }

  function getPatternMatchScore(expectedPattern, dragDirection) {
    const mobile = state.ctx.view === 'mobile';

    if (!expectedPattern || dragDirection === 'none') return 0;
    if (expectedPattern === dragDirection) return 1;

    if (
      (expectedPattern === 'horizontal' && dragDirection === 'circle') ||
      (expectedPattern === 'vertical' && dragDirection === 'circle')
    ) {
      return mobile ? 0.70 : 0.45;
    }

    if (
      expectedPattern === 'circle' &&
      (dragDirection === 'horizontal' || dragDirection === 'vertical')
    ) {
      return mobile ? 0.55 : 0.35;
    }

    return mobile ? 0.20 : 0;
  }

  function getPatternResultLabel(score) {
    if (score >= 0.75) return 'perfect';
    if (score >= 0.20) return 'ok';
    return 'bad';
  }

  function simulateBrushHit(detail = {}) {
    if (!state.running || state.paused) return;
    if (!isBrushInputScene(state.sceneId)) return;

    const zone = state.zones.find((z) => z.id === state.activeZoneId);
    if (!zone) return;
    if (zone.done && state.sceneId !== SCENE_IDS.boss) return;

    const dragDirection = detail.dragDirection || 'none';
    const matchScore = getPatternMatchScore(zone.patternType, dragDirection);
    const resultLabel = getPatternResultLabel(matchScore);
    const anchor = getZoneAnchor(zone.id);

    if (resultLabel === 'bad') {
      zone.misses += 1;
      state.metrics.misses += 1;
      state.metrics.warnings += 1;
      state.score.combo = 0;

      showPopup(anchor.x, anchor.y - 4, 'MISS', 'bad');
      playFx(anchor.x, anchor.y, 'miss');
      renderCoach('🙂', `ลองอีกนิด โซน ${zone.label} ควรแปรงแบบ ${zone.patternType}`);
      renderFrame();
      return;
    }

    const scoreMultiplier = state.score.feverActive ? FEVER_RULES.scoreMultiplier : 1;
    const cleanMultiplier = state.score.feverActive ? FEVER_RULES.cleanMultiplier : 1;

    const baseClean = resultLabel === 'perfect' ? 2.6 : 1.8;
    const cleanGain = baseClean * cleanMultiplier;

    const baseScore = resultLabel === 'perfect'
      ? SCORE_RULES.patternHit
      : Math.round(SCORE_RULES.patternHit * 0.8);

    const scoreGain = baseScore * scoreMultiplier;

    zone.cleanPercent = clamp(zone.cleanPercent + cleanGain, 0, 100);
    zone.threatPercent = clamp(zone.threatPercent - THREAT_RULES.cleanDropPerHit, 0, 100);
    zone.hits += 1;
    zone.visited = true;
    zone.dwellMs += 120;

    state.metrics.hits += 1;
    state.score.total += Math.round(scoreGain);
    state.score.combo += (resultLabel === 'perfect' ? 1 : 0.5);
    state.score.comboMax = Math.max(state.score.comboMax, Math.floor(state.score.combo));
    state.threat.percent = clamp(state.threat.percent - THREAT_RULES.cleanDropPerHit, 0, 100);

    if (!state.score.feverActive && Math.floor(state.score.combo) >= FEVER_RULES.comboThreshold) {
      startFever();
    }

    if (resultLabel === 'perfect') {
      showPopup(anchor.x, anchor.y - 4, `PERFECT +${Math.round(scoreGain)}`, 'perfect');
      renderCoach('🪥', `ดีมาก โซน ${zone.label} ใช้ ${zone.patternType} ถูกแล้ว`);
    } else {
      showPopup(anchor.x, anchor.y - 4, `GOOD +${Math.round(scoreGain)}`, 'good');
      renderCoach('🙂', `เกือบดีแล้ว ลองให้เป็น ${zone.patternType} ชัดขึ้น`);
    }

    if (Math.floor(state.score.combo) > 0 && Math.floor(state.score.combo) % 5 === 0) {
      showPopup(anchor.x, anchor.y - 12, `COMBO x${Math.floor(state.score.combo)}`, 'combo');
    }

    playFx(anchor.x, anchor.y, 'hit');

    if (!zone.done && zone.cleanPercent >= 100) {
      zone.done = true;
      zone.completedAtMs = Math.round(state.time.elapsedMs);
      state.score.total += SCORE_RULES.zoneComplete;
      showPopup(anchor.x, anchor.y - 14, 'ZONE CLEAR', 'clear');
      playFx(anchor.x, anchor.y, 'complete');
    }

    if (state.sceneId === SCENE_IDS.boss) {
      const bossDamageBase = resultLabel === 'perfect' ? 8 : 4;
      const bossDamage = state.score.feverActive ? bossDamageBase * 1.4 : bossDamageBase;
      state.boss.hpPercent = clamp(state.boss.hpPercent - bossDamage, 0, 100);
      showPopup(50, 34, `BOSS HIT -${Math.round(bossDamage)}`, 'boss');
    }

    renderFrame();
  }

  function startFever() {
    state.score.feverActive = true;
    state.score.feverEndAtMs = performance.now() + FEVER_RULES.durationMs;
    renderCoach('🔥', randomPick(COACH_LINES.fever));
  }

  function endFever() {
    state.score.feverActive = false;
    state.score.feverEndAtMs = 0;
  }

  function syncScenePresentation(sceneId) {
    renderSceneMood(sceneId);
    setObjective(getSceneObjectiveText(sceneId), sceneId);

    const active = isBrushInputScene(sceneId);
    if (el.brushInputLayer) {
      el.brushInputLayer.style.pointerEvents = active ? 'auto' : 'none';
    }

    if (!active) {
      resetBrushInputState();
      hideBrushCursor();
    }

    if (el.helperCard) {
      if (isBrushInputScene(sceneId)) {
        el.helperCard.innerHTML = 'ลากเพื่อแปรง • <strong>Space</strong> = hit • <strong>Q/W/E/A/S/D</strong> = เลือกโซน';
      } else if (sceneId === SCENE_IDS.scan) {
        el.helperCard.innerHTML = 'แตะเป้าหมายสแกนบนฉากเพื่อหาจุดสกปรก';
      } else if (sceneId === SCENE_IDS.bossBreak) {
        el.helperCard.innerHTML = 'แตะ weak point สีแดงบนฉากเพื่อทำลายโล่';
      } else {
        el.helperCard.innerHTML = 'ปุ่มลัดทดสอบ: <strong>Space</strong> = hit, <strong>Q/W/E/A/S/D</strong> = เลือกโซน';
      }
    }
  }

  function getSceneObjectiveText(sceneId) {
    switch (sceneId) {
      case SCENE_IDS.launcher: return `เริ่มภารกิจ ${state.ctx.modeLabel || 'Adventure'}`;
      case SCENE_IDS.intro: return 'สำรวจในโพรงปากและเตรียมเริ่มภารกิจ';
      case SCENE_IDS.scan: return 'หาจุดสกปรกอันตรายให้ครบ';
      case SCENE_IDS.guided: return 'แปรงตามทิศที่โค้ชแนะนำ';
      case SCENE_IDS.pressure: return 'เลือกโซนให้ดีก่อนคราบลุกลาม';
      case SCENE_IDS.bossBreak: return 'ทำลายโล่บอสด้วยการโจมตีจุดอ่อน';
      case SCENE_IDS.boss: return 'รีบแปรงโจมตีบอสในช่วงเปิดช่อง';
      case SCENE_IDS.finish: return 'ภารกิจสำเร็จ กำลังฟื้นฟูทั้งปาก';
      case SCENE_IDS.summary: return 'สรุปผลการช่วยฟันของรอบนี้';
      default: return 'เตรียมภารกิจกู้ฟัน';
    }
  }

  function renderFrame() {
    renderTopHud();
    renderMiniMap();
    renderPlaques();

    if (state.sceneId === SCENE_IDS.scan && state.scan.active) {
      const remain = Math.max(0, Math.ceil(state.scan.durationSec - ((performance.now() - state.scan.startedAtMs) / 1000)));
      renderScanHud(`${remain}s`, `${state.scan.hits} / ${state.scan.targetGoal}`);
    } else {
      renderScanHud('', '');
    }

    if (state.sceneId === SCENE_IDS.bossBreak && state.bossBreak.active) {
      const remain = Math.max(0, Math.ceil(state.bossBreak.durationSec - ((performance.now() - state.bossBreak.startedAtMs) / 1000)));
      renderBossBreakHud(
        `${Math.max(0, state.bossBreak.targetGoal - state.bossBreak.hits)}`,
        `${remain}s`,
        `${state.bossBreak.hits} / ${state.bossBreak.targetGoal}`
      );
    } else {
      renderBossBreakHud('', '', '');
    }
  }

  function renderLauncher() {
    renderCoach('🪥', 'พร้อมช่วยฟันแล้ว กดเริ่มได้เลย');
    setObjective(`เริ่มภารกิจ ${state.ctx.modeLabel || 'Adventure'}`, SCENE_IDS.launcher);
    renderSceneMood(SCENE_IDS.launcher);
  }

  function renderTopHud() {
    setText(el.timeText, `${state.time.remainingSec}s`);
    setText(el.scoreText, Math.round(state.score.total));
    setText(el.comboText, Math.floor(state.score.combo));
    setText(el.threatText, `${Math.round(state.threat.percent)}%`);
    setText(el.sceneText, state.sceneId);

    const threatNum = Math.round(state.threat.percent);
    if (threatNum >= 75) el.threatText.style.color = '#c93d5d';
    else if (threatNum >= 45) el.threatText.style.color = '#9b7200';
    else el.threatText.style.color = '';

    if (state.score.feverActive) {
      el.scoreText.style.color = '#e5672d';
      el.scoreText.style.textShadow = '0 0 12px rgba(255,160,88,.35)';
    } else {
      el.scoreText.style.color = '';
      el.scoreText.style.textShadow = '';
    }
  }

  function renderMiniMap() {
    state.zones.forEach((zone) => {
      const btn = document.querySelector(`[data-zone="${zone.id}"]`);
      if (!btn) return;

      btn.textContent = `${zone.label} ${Math.round(zone.cleanPercent)}%`;
      btn.dataset.state = zone.done ? 'done' : zone.id === state.activeZoneId ? 'active' : 'idle';

      const ring = document.querySelector(`[data-ring-zone="${zone.id}"]`);
      if (ring) {
        ring.classList.toggle('is-zone-active', zone.id === state.activeZoneId);
        ring.classList.toggle('is-zone-done', zone.done);
        ring.classList.toggle('is-scene-focus', state.sceneId === SCENE_IDS.scan || state.sceneId === SCENE_IDS.bossBreak || state.sceneId === SCENE_IDS.boss);
      }
    });
  }

  function renderScanHud(timerText, foundText) {
    const active = !!(timerText || foundText);
    el.scanCard?.classList.toggle('is-collapsed', !active);
    setText(el.scanTimerText, timerText);
    setText(el.scanFoundText, foundText);
  }

  function renderBossBreakHud(shieldText, timerText, countText) {
    const active = !!(shieldText || timerText || countText);
    el.bossCard?.classList.toggle('is-collapsed', !active);
    setText(el.bossShieldText, shieldText);
    setText(el.bossBreakTimerText, timerText);
    setText(el.bossBreakCountText, countText);
  }

  function renderCoach(face, line) {
    setText(el.coachFace, face);
    setText(el.coachLine, line);
  }

  function setObjective(text, sceneId) {
    setText(el.objectiveText, text);

    el.objectiveCard?.classList.remove(
      'is-scan-mode',
      'is-guided-mode',
      'is-pressure-mode',
      'is-boss-mode',
      'is-finish-mode'
    );

    if (sceneId === SCENE_IDS.scan) el.objectiveCard?.classList.add('is-scan-mode');
    else if (sceneId === SCENE_IDS.guided || sceneId === SCENE_IDS.intro || sceneId === SCENE_IDS.launcher) el.objectiveCard?.classList.add('is-guided-mode');
    else if (sceneId === SCENE_IDS.pressure || sceneId === SCENE_IDS.fever) el.objectiveCard?.classList.add('is-pressure-mode');
    else if (sceneId === SCENE_IDS.bossBreak || sceneId === SCENE_IDS.boss) el.objectiveCard?.classList.add('is-boss-mode');
    else if (sceneId === SCENE_IDS.finish || sceneId === SCENE_IDS.summary) el.objectiveCard?.classList.add('is-finish-mode');
  }

  function renderSceneMood(sceneId) {
    if (!el.sceneStage) return;
    el.sceneStage.dataset.scene = sceneId || '';

    el.scanCard?.classList.remove('is-emphasis');
    el.bossCard?.classList.remove('is-emphasis');
    el.helperCard?.classList.remove('is-warning', 'is-success');

    if (sceneId === SCENE_IDS.scan) {
      el.scanCard?.classList.add('is-emphasis');
    } else if (sceneId === SCENE_IDS.pressure || sceneId === SCENE_IDS.fever) {
      el.helperCard?.classList.add('is-warning');
    } else if (sceneId === SCENE_IDS.bossBreak || sceneId === SCENE_IDS.boss) {
      el.bossCard?.classList.add('is-emphasis');
      el.helperCard?.classList.add('is-warning');
    } else if (sceneId === SCENE_IDS.finish || sceneId === SCENE_IDS.summary) {
      el.helperCard?.classList.add('is-success');
    }
  }

  function renderPlaques() {
    clearNode(el.plaqueLayer);
    state.zones.forEach((zone) => {
      if (zone.done || zone.cleanPercent >= 100) return;

      const anchor = getZoneAnchor(zone.id);
      const dirty = Math.max(0, 100 - zone.cleanPercent);
      const count = dirty >= 70 ? 4 : dirty >= 40 ? 3 : dirty > 0 ? 2 : 0;

      for (let i = 0; i < count; i++) {
        const node = document.createElement('div');
        node.className = 'plaque-node';
        if (i === 0 && dirty >= 70) node.classList.add('is-heavy');
        if (i === count - 1 && dirty < 45) node.classList.add('is-gap');
        if (dirty < 30) node.classList.add('is-dim');

        const offset = plaqueOffset(zone.patternType, i);
        node.style.left = `${anchor.x + offset.dx}%`;
        node.style.top = `${anchor.y + offset.dy}%`;
        el.plaqueLayer.appendChild(node);
      }
    });
  }

  function plaqueOffset(patternType, i) {
    const maps = {
      horizontal: [{ dx: -10, dy: 0 }, { dx: 0, dy: -8 }, { dx: 11, dy: 2 }, { dx: 2, dy: 11 }],
      vertical: [{ dx: 0, dy: -10 }, { dx: 0, dy: 6 }, { dx: -8, dy: 16 }, { dx: 10, dy: -18 }],
      circle: [{ dx: -8, dy: -6 }, { dx: 10, dy: -6 }, { dx: 0, dy: 12 }, { dx: -10, dy: 14 }]
    };
    return (maps[patternType] || maps.horizontal)[i] || { dx: 0, dy: 0 };
  }

  function renderScanTargets() {
    clearNode(el.scanTargetLayer);
    if (!state.scan.active) return;

    state.scan.targets.forEach((t) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'scan-target';
      if (t.special) btn.classList.add('is-special');
      if (state.scan.picked.has(t.id)) btn.classList.add('is-picked');
      btn.disabled = state.scan.picked.has(t.id);
      btn.style.left = `${t.x}%`;
      btn.style.top = `${t.y}%`;
      btn.textContent = '?';
      btn.addEventListener('click', () => onScanPick(t.id));
      el.scanTargetLayer.appendChild(btn);
    });
  }

  function onScanPick(id) {
    if (!state.scan.active) return;
    if (state.scan.picked.has(id)) return;

    state.scan.picked.add(id);
    const t = state.scan.targets.find((x) => x.id === id);
    if (!t) return;

    state.scan.hits += 1;
    if (t.special) state.scan.specialHits += 1;

    showPopup(t.x, t.y - 4, t.special ? 'SCAN +100' : 'SCAN +50', t.special ? 'perfect' : 'good');
    playFx(t.x, t.y, 'hit');
    renderScanTargets();
    renderFrame();
  }

  function renderBossWeakPoints() {
    clearNode(el.bossWeakPointLayer);
    if (!state.bossBreak.active) return;

    state.bossBreak.weakPoints.forEach((wp) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'boss-weakpoint';
      if (wp.hit) btn.classList.add('is-hit');
      btn.disabled = wp.hit;
      btn.style.left = `${wp.x}%`;
      btn.style.top = `${wp.y}%`;
      btn.textContent = '!';
      btn.addEventListener('click', () => onBossBreakHit(wp.id));
      el.bossWeakPointLayer.appendChild(btn);
    });
  }

  function onBossBreakHit(id) {
    if (!state.bossBreak.active) return;
    const wp = state.bossBreak.weakPoints.find((x) => x.id === id);
    if (!wp || wp.hit) return;

    wp.hit = true;
    state.bossBreak.hits += 1;
    showPopup(wp.x, wp.y - 4, `WEAK +${SCORE_RULES.bossBreakHit}`, 'boss');
    playFx(wp.x, wp.y, 'hit');
    renderBossWeakPoints();
    renderFrame();
  }

  function getZoneAnchor(zoneId) {
    const map = {
      'upper-left': { x: 24, y: 35 },
      'upper-front': { x: 50, y: 27 },
      'upper-right': { x: 76, y: 35 },
      'lower-left': { x: 24, y: 63 },
      'lower-front': { x: 50, y: 72 },
      'lower-right': { x: 76, y: 63 }
    };
    return map[zoneId] || { x: 50, y: 50 };
  }

  function playFx(x, y, kind = 'hit') {
    if (!el.fxLayer) return;
    const node = document.createElement('div');
    node.className = 'fx-burst';
    if (kind === 'miss') node.classList.add('is-miss');
    if (kind === 'complete') node.classList.add('is-complete');
    node.style.left = `${x}%`;
    node.style.top = `${y}%`;
    el.fxLayer.appendChild(node);
    setTimeout(() => node.remove(), 380);
  }

  function showPopup(x, y, text, kind = 'good') {
    if (!el.scorePopupLayer) return;
    const node = document.createElement('div');
    node.className = `score-popup is-${kind}`;
    node.textContent = text;
    node.style.left = `${x}%`;
    node.style.top = `${y}%`;
    el.scorePopupLayer.appendChild(node);
    setTimeout(() => node.remove(), 760);
  }

  function finishGame() {
    state.running = false;
    resetBrushInputState();
    hideBrushCursor();

    const result = buildResult();
    saveResult(result);
    logger.finish(result);
    logger.flush();

    setObjective('ดูผลลัพธ์และคำแนะนำของรอบนี้', SCENE_IDS.summary);
    renderSceneMood(SCENE_IDS.summary);

    setText(el.summaryRank, result.finalRank);
    setText(el.summaryScore, result.finalScore);
    setText(el.summaryCoverage, `${result.coveragePercent}%`);
    setText(el.summaryAccuracy, `${result.accuracyPercent}%`);
    setText(el.summaryAdvice, result.summaryAdvice);

    if (el.summaryModal) el.summaryModal.hidden = false;
  }

  function buildResult() {
    const hits = state.metrics.hits;
    const misses = state.metrics.misses;
    const attempts = hits + misses;
    const coveragePercent = Math.round(state.zones.reduce((a, z) => a + z.cleanPercent, 0) / state.zones.length);
    const accuracyPercent = attempts ? Math.round((hits / attempts) * 100) : 0;

    let finalRank = 'C';
    if (coveragePercent >= 90 && accuracyPercent >= 85) finalRank = 'S';
    else if (coveragePercent >= 80 && accuracyPercent >= 75) finalRank = 'A';
    else if (coveragePercent >= 65 && accuracyPercent >= 60) finalRank = 'B';

    let summaryAdvice = 'ลองเล่นอีกรอบเพื่อดูความต่างของผลลัพธ์';
    if (coveragePercent >= 85 && accuracyPercent >= 75) {
      summaryAdvice = 'เยี่ยมมาก แปรงได้ทั่วและแม่นแล้ว';
    } else if (coveragePercent >= 60) {
      summaryAdvice = 'ดีขึ้นมากแล้ว รอบหน้าลองเก็บทุกโซนให้ครบกว่านี้';
    } else {
      summaryAdvice = 'เลือกโซนให้ไวขึ้นและลากตามทิศที่เกมบอก';
    }

    return {
      sessionId: logger.sessionId,
      finalRank,
      finalScore: Math.round(state.score.total),
      coveragePercent,
      accuracyPercent,
      summaryAdvice,
      csvRow: {
        sessionId: logger.sessionId,
        pid: state.ctx.pid,
        modeId: state.ctx.modeId,
        diff: state.ctx.diff,
        view: state.ctx.view,
        finalScore: Math.round(state.score.total),
        coveragePercent,
        accuracyPercent,
        finalRank
      }
    };
  }

  function saveResult(result) {
    try {
      localStorage.setItem('HHA_BRUSH_LAST_RESULT', JSON.stringify(result));
      const rows = JSON.parse(localStorage.getItem('HHA_BRUSH_CSV_ROWS') || '[]');
      rows.push(result.csvRow);
      localStorage.setItem('HHA_BRUSH_CSV_ROWS', JSON.stringify(rows));
    } catch {}
  }

  function closeSummary() {
    if (el.summaryModal) el.summaryModal.hidden = true;
  }

  function setText(node, value) {
    if (node) node.textContent = String(value ?? '');
  }

  function clearNode(node) {
    if (node) node.innerHTML = '';
  }

  function randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
})();