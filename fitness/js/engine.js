// === /fitness/js/engine.js ===
// Shadow Breaker engine
// PATCH v20260412m-SB-ENGINE-APPS-SCRIPT-MAPPER

'use strict';

const SB_ENGINE_VERSION = 'v20260412m-SB-ENGINE-APPS-SCRIPT-MAPPER';
const SB_GLOBAL_KEY = '__SB_ENGINE_SINGLETON__';

export function initShadowBreaker(ctx = {}) {
  if (window[SB_GLOBAL_KEY]?.running) {
    console.warn('[ShadowBreaker] engine already running');
    return window[SB_GLOBAL_KEY].api;
  }

  const cfg = normalizeConfig(ctx);
  const ui = createUiShell();
  const logger = createLogger(cfg);
  const rng = createRng(cfg.seed);
  const state = createState(cfg, logger.sessionId);
  initDirectorBaseline(state, cfg, logger);
  const plan = buildSessionPlan(cfg);

  const engine = {
    version: SB_ENGINE_VERSION,
    cfg,
    state,
    ui,
    logger,
    rng,
    running: true,
    started: false,
    ended: false,
    activeCleanup: [],
    api: {
      version: SB_ENGINE_VERSION,
      getState: () => structuredCloneSafe(state),
      getConfig: () => ({ ...cfg }),
      submitAction: (action, meta = {}) => consumeAction(action, state, ui, logger, meta),
      pause: () => setPaused(true, state, ui),
      resume: () => setPaused(false, state, ui),
      endSession: (reason = 'manual_end') => endSession(reason, state, ui, logger),
      openHelp: () => openHelp(ui),
      closeOverlay: () => ui.hideOverlay(),
      getResearchBundle: () => structuredCloneSafe(state.research.exportBundle),
      exportResearchBundle: () => exportResearchBundle(state),
      getResearchTables: () => structuredCloneSafe(state.research.exportTables),
      exportResearchCsvTables: () => exportResearchCsvTables(state),
      buildAppsScriptPayload: (endpointOverride = '') => buildAppsScriptPayload(state, endpointOverride),
      sendAppsScriptPayload: (endpointOverride = '') => sendAppsScriptPayload(state, logger, endpointOverride)
    }
  };

  window[SB_GLOBAL_KEY] = engine;
  window.ShadowBreaker = engine.api;

  bindGlobalInputs(engine);
  persistBootSnapshot(cfg, state);

  logger.emit('sb_session_init', {
    patch: SB_ENGINE_VERSION,
    sessionPlan: plan.map(r => ({
      index: r.index,
      type: r.type,
      style: r.style,
      sec: r.sec
    }))
  });

  showStartOverlay(engine, plan);
  return engine.api;
}

/* ------------------------------------------------------------------ */
/* config / state */
/* ------------------------------------------------------------------ */

function normalizeConfig(ctx = {}) {
  const origin = location.origin || '';
  const defaultHub = `${origin}/webxr-health-mobile/herohealth/hub.html`;

  const mode = pickOne(ctx.mode, ['flow', 'boxing', 'mixed'], 'mixed');
  const body = pickOne(ctx.body, ['standing', 'sitting'], 'standing');
  const intensity = pickOne(ctx.intensity, ['learn', 'move', 'power'], 'move');
  const duration = pickOneNum(Number(ctx.duration || 6), [3, 6, 10], 6);
  const run = pickOne(ctx.run, ['play', 'research', 'demo'], 'play');

  return {
    patch: SB_ENGINE_VERSION,
    pid: String(ctx.pid || 'anon'),
    name: String(ctx.name || 'Hero'),
    nick: String(ctx.nick || ctx.name || 'Hero'),
    studyId: String(ctx.studyId || ''),
    run,
    view: String(ctx.view || 'mobile'),
    seed: String(ctx.seed || Date.now()),
    hub: String(ctx.hub || defaultHub),
    cooldown: String(ctx.cooldown || ''),
    mode,
    body,
    intensity,
    durationMin: duration,
    diff: String(ctx.diff || 'normal'),
    zone: String(ctx.zone || 'fitness'),
    cat: String(ctx.cat || 'fitness'),
    game: String(ctx.game || 'shadowbreaker'),
    gameId: String(ctx.gameId || 'shadowbreaker'),
    theme: String(ctx.theme || 'shadowbreaker'),
    adaptiveMode: String(
      ctx.adaptiveMode ||
      (run === 'research' ? 'research_locked' : 'live')
    ),
    appsScriptUrl: String(
      ctx.appsScriptUrl ||
      ctx.api ||
      (() => {
        try { return new URL(location.href).searchParams.get('api') || ''; }
        catch (_) { return ''; }
      })() ||
      window.HHA_APPS_SCRIPT_URL ||
      window.HHA_CLOUD_ENDPOINT ||
      ''
    ),
    debug: !!ctx.debug,
    log: !!ctx.log
  };
}

function createState(cfg, sessionId) {
  return {
    session: {
      sessionId,
      startedAt: 0,
      endedAt: 0,
      roundIndex: 0,
      phase: 'boot',
      pause: false,
      endRequested: false,
      reasonEnded: ''
    },
    cfg,
    runtime: {
      currentExpected: null,
      roundStartMs: 0,
      roundEndMs: 0,
      lastActionAt: 0,
      actionHistory: [],
      passiveCueKey: '',
      bossCycleIndex: 0,
      musicStateKey: ''
    },
    score: {
      total: 0,
      stars: 0,
      combo: 0,
      comboMax: 0,
      accuracy: 100
    },
    judgments: {
      perfect: 0,
      good: 0,
      late: 0,
      nearMiss: 0,
      miss: 0
    },
    actions: {
      totalActions: 0,
      totalPunches: 0,
      jab: 0,
      cross: 0,
      hook_left: 0,
      hook_right: 0,
      uppercut_left: 0,
      uppercut_right: 0,
      guard: 0,
      duck: 0,
      slip_left: 0,
      slip_right: 0,
      flow_hit: 0,
      miss: 0,
      timeoutMiss: 0,
      freeAction: 0
    },
    exercise: {
      activeMs: 0,
      recoveryMs: 0,
      warmupMs: 0,
      wrapMs: 0,
      punchesPerMin: 0,
      estimatedTier: 'light',
      leftHits: 0,
      rightHits: 0,
      balancePct: 50
    },
    boss: {
      active: false,
      hp: 0,
      hpMax: 0,
      clears: 0,
      phase: 'idle',
      rage: false,
      finisher: false,
      rageTriggered: false,
      finisherTriggered: false
    },
    director: {
      mode: String(cfg.adaptiveMode || 'live'),
      researchLocked: String(cfg.adaptiveMode || 'live') === 'research_locked',
      level: 0,
      trend: 'steady',
      liveWindowMul: 1,
      appliedWindowMul: 1,
      bossHpOffset: 0,
      baselineWindowMul: 1,
      baselineBossOffset: 0,
      recentResults: [],
      recentHits: 0,
      recentMisses: 0,
      announceCooldownMs: 0,
      decisionSeq: 0,
      checkpointEvery: 4,
      lastDecisionKey: ''
    },
    research: {
      checkpoints: [],
      bossPhases: [],
      exportBundle: null,
      exportTables: null,
      lastAppsScriptPayload: null,
      lastAppsScriptResult: null
    },
    summary: null
  };
}

/* ------------------------------------------------------------------ */
/* session plan */
/* ------------------------------------------------------------------ */

function buildSessionPlan(cfg) {
  const recoveryMul =
    cfg.intensity === 'learn' ? 1.15 :
    cfg.intensity === 'power' ? 0.9 : 1.0;

  const plans = {
    3: [
      { type: 'warmup', style: 'flow', sec: 20, label: 'Warm Up' },
      { type: 'active', style: pickRoundStyle(cfg.mode, 0), sec: 40, label: labelForStyle(cfg.mode, 0) },
      { type: 'recovery', style: 'flow', sec: Math.round(15 * recoveryMul), label: 'Recover' },
      { type: 'active', style: pickRoundStyle(cfg.mode, 1), sec: 40, label: labelForStyle(cfg.mode, 1) },
      { type: 'recovery', style: 'flow', sec: Math.round(15 * recoveryMul), label: 'Recover' },
      { type: 'active', style: pickRoundStyle(cfg.mode, 2), sec: 40, label: labelForStyle(cfg.mode, 2) },
      { type: 'boss', style: 'boxing', sec: 20, label: 'Boss Burst' },
      { type: 'wrap', style: 'flow', sec: 10, label: 'Wrap Up' }
    ],
    6: [
      { type: 'warmup', style: 'flow', sec: 30, label: 'Warm Up' },
      { type: 'active', style: pickRoundStyle(cfg.mode, 0), sec: 45, label: labelForStyle(cfg.mode, 0) },
      { type: 'recovery', style: 'flow', sec: Math.round(15 * recoveryMul), label: 'Recover' },
      { type: 'active', style: pickRoundStyle(cfg.mode, 1), sec: 45, label: labelForStyle(cfg.mode, 1) },
      { type: 'recovery', style: 'flow', sec: Math.round(15 * recoveryMul), label: 'Recover' },
      { type: 'active', style: pickRoundStyle(cfg.mode, 2), sec: 45, label: labelForStyle(cfg.mode, 2) },
      { type: 'recovery', style: 'flow', sec: Math.round(15 * recoveryMul), label: 'Recover' },
      { type: 'active', style: pickRoundStyle(cfg.mode, 3), sec: 45, label: labelForStyle(cfg.mode, 3) },
      { type: 'boss', style: 'boxing', sec: 35, label: 'Boss Burst' },
      { type: 'wrap', style: 'flow', sec: 20, label: 'Wrap Up' }
    ],
    10: [
      { type: 'warmup', style: 'flow', sec: 45, label: 'Warm Up' },
      { type: 'active', style: pickRoundStyle(cfg.mode, 0), sec: 50, label: labelForStyle(cfg.mode, 0) },
      { type: 'recovery', style: 'flow', sec: 18, label: 'Recover' },
      { type: 'active', style: pickRoundStyle(cfg.mode, 1), sec: 50, label: labelForStyle(cfg.mode, 1) },
      { type: 'recovery', style: 'flow', sec: 18, label: 'Recover' },
      { type: 'active', style: pickRoundStyle(cfg.mode, 2), sec: 55, label: labelForStyle(cfg.mode, 2) },
      { type: 'recovery', style: 'flow', sec: 18, label: 'Recover' },
      { type: 'active', style: pickRoundStyle(cfg.mode, 3), sec: 55, label: labelForStyle(cfg.mode, 3) },
      { type: 'recovery', style: 'flow', sec: 18, label: 'Recover' },
      { type: 'boss', style: 'boxing', sec: 45, label: 'Boss Burst' },
      { type: 'active', style: pickRoundStyle(cfg.mode, 4), sec: 45, label: labelForStyle(cfg.mode, 4) },
      { type: 'wrap', style: 'flow', sec: 25, label: 'Wrap Up' }
    ]
  };

  return plans[cfg.durationMin].map((r, idx) => ({ ...r, index: idx + 1 }));
}

function pickRoundStyle(mode, idx) {
  if (mode === 'flow') return 'flow';
  if (mode === 'boxing') return 'boxing';
  const seq = ['flow', 'boxing', 'mixed', 'boxing', 'mixed'];
  return seq[idx % seq.length];
}

function labelForStyle(mode, idx) {
  const style = pickRoundStyle(mode, idx);
  return style === 'flow' ? 'Flow' : style === 'boxing' ? 'Boxing' : 'Mixed';
}

/* ------------------------------------------------------------------ */
/* engine boot flow */
/* ------------------------------------------------------------------ */

function showStartOverlay(engine, plan) {
  const { ui, cfg } = engine;

  ui.showOverlay(`
    <h2 style="margin:0 0 10px">Shadow Breaker</h2>
    <p style="margin:6px 0 12px">
      <strong>${escapeHtml(cfg.nick)}</strong> • ${escapeHtml(cfg.mode.toUpperCase())} • ${escapeHtml(cfg.body.toUpperCase())} • ${escapeHtml(cfg.intensity.toUpperCase())} • ${cfg.durationMin} นาที
    </p>

    <div class="sb-card-grid">
      <div class="sb-mini-card">
        <strong>วิธีเล่น</strong>
        <div>กดปุ่มล่างจอ หรือส่ง action จาก motion/VR input</div>
      </div>
      <div class="sb-mini-card">
        <strong>โหมดปัจจุบัน</strong>
        <div>${escapeHtml(cfg.mode)} / ${escapeHtml(cfg.body)} / ${escapeHtml(cfg.intensity)}</div>
      </div>
    </div>

    <div style="margin-top:12px">
      <strong>ลำดับเซสชัน</strong>
      <div class="sb-plan-list">
        ${plan.map(r => `<div class="sb-plan-row"><span>${escapeHtml(r.label)}</span><span>${r.sec}s</span></div>`).join('')}
      </div>
    </div>

    <div class="sb-actions">
      <button class="sb-btn sb-btn-primary" data-sb-start="1">เริ่มเล่น</button>
      <button class="sb-btn sb-btn-secondary" data-sb-help="1">ดูวิธีเล่น</button>
      <a class="sb-btn sb-btn-secondary" href="${escapeAttr(cfg.hub)}">กลับ HUB</a>
    </div>
  `);

  const startBtn = ui.overlay.querySelector('[data-sb-start="1"]');
  const helpBtn = ui.overlay.querySelector('[data-sb-help="1"]');

  startBtn.addEventListener('click', async () => {
    ui.hideOverlay();
    await startSession(engine, plan);
  }, { once: true });

  helpBtn.addEventListener('click', () => openHelp(ui), { once: true });
}

async function startSession(engine, plan) {
  const { state, ui, logger } = engine;
  if (engine.started || engine.ended) return;

  engine.started = true;
  state.session.startedAt = Date.now();
  state.session.phase = 'countdown';

  logger.emit('sb_session_start', { phase: 'countdown' });
  await countdown(ui, state);

  for (const round of plan) {
    if (state.session.endRequested || engine.ended) break;
    await runRound(engine, round);
  }

  if (!engine.ended) {
    await completeSession(engine, 'natural_end');
  }
}

async function runRound(engine, round) {
  const { state, ui, logger, rng } = engine;

  state.session.phase = round.type;
  state.session.roundIndex = round.index;
  state.runtime.currentExpected = null;
  state.runtime.roundStartMs = nowMs();
  state.runtime.roundEndMs = state.runtime.roundStartMs + round.sec * 1000;
  state.runtime.passiveCueKey = '';

  ui.setStageText(round.type === 'boss' ? 'Boss Phase' : `${round.label} Round`);
  ui.setCoachText(nextCoachLine(round, state), 'calm');
  ui.setCue(round.type === 'recovery' ? 'BREATHE' : 'READY', 'info');
  ui.renderHud(state, round, Math.ceil(round.sec));
  syncMusicState(state, logger, 'round_start');

  logger.emit(round.type === 'boss' ? 'sb_boss_start' : 'sb_round_start', {
    roundIndex: round.index,
    roundType: round.type,
    roundStyle: round.style,
    roundSec: round.sec
  });

  if (round.type === 'active') {
    await playPhaseCard(
      ui,
      'ROUND',
      round.label,
      round.style === 'flow' ? 'ต่อเนื่องลื่น ๆ' : round.style === 'boxing' ? 'ชัดจังหวะ ชัดหมัด' : 'สลับให้คม',
      'normal',
      820
    );
  }

  if (round.type === 'warmup' || round.type === 'recovery' || round.type === 'wrap') {
    await runPassiveRound(engine, round);
    return;
  }

  if (round.type === 'boss') {
    await runBossRound(engine, round);
    return;
  }

  const actions = buildRoundActions(round, state.cfg, rng);

  state.boss.active = false;
  state.boss.hpMax = 0;
  state.boss.hp = 0;

  while (nowMs() < state.runtime.roundEndMs) {
    if (state.session.endRequested || engine.ended) return;
    await waitIfPaused(state);

    const remainSec = Math.max(0, Math.ceil((state.runtime.roundEndMs - nowMs()) / 1000));
    maybeSpawnExpected(state, ui, logger, round, actions);
    maybeTimeoutExpected(state, ui, logger);

    state.exercise.activeMs += 80;
    ui.renderHud(state, round, remainSec);
    await sleep(80);
  }

  state.runtime.currentExpected = null;
  ui.clearTarget();
  ui.setCue('ผ่านรอบแล้ว!', 'hit');
  ui.setCoachText('ดีมาก ไปต่อรอบหน้า', 'calm');
  await sleep(800);
}

async function runPassiveRound(engine, round) {
  const { state, ui, logger } = engine;

  syncMusicState(state, logger, `${round.type}_start`);

  while (nowMs() < state.runtime.roundEndMs) {
    if (state.session.endRequested || engine.ended) return;
    await waitIfPaused(state);

    const remainSec = Math.max(0, Math.ceil((state.runtime.roundEndMs - nowMs()) / 1000));

    if (round.type === 'warmup') {
      state.exercise.warmupMs += 80;

      const cueKey = remainSec % 4 === 0 ? 'jab' : remainSec % 4 === 2 ? 'cross' : '';
      if (cueKey && cueKey !== state.runtime.passiveCueKey) {
        state.runtime.passiveCueKey = cueKey;
        const lbl = actionLabel(cueKey);
        ui.showTarget({ action: cueKey, label: lbl, expiresMs: 900 }, 'warmup');
        ui.setCue(lbl, 'info');
        ui.setCoachText(cueKey === 'jab' ? 'ต่อยเบา ๆ จับจังหวะ' : 'สลับแขนอีกข้าง', 'calm');
      }
    }

    if (round.type === 'recovery') {
      state.exercise.recoveryMs += 80;
      ui.clearTarget();
      ui.setCue('BREATHE', 'info');
      ui.setCoachText('พักหายใจลึก ๆ', 'calm');
    }

    if (round.type === 'wrap') {
      state.exercise.wrapMs += 80;
      ui.clearTarget();
      ui.setCue('EASY', 'info');
      ui.setCoachText('ค่อย ๆ ผ่อนแรง', 'calm');
    }

    ui.renderHud(state, round, remainSec);
    await sleep(80);
  }

  ui.clearTarget();
  ui.setCue('', 'info');
}

async function runBossRound(engine, round) {
  const { state, ui, logger } = engine;

  state.session.phase = 'boss';
  state.boss.active = true;
  state.boss.hpMax = getAdaptiveBossHp(state.cfg, state);
  state.boss.hp = state.boss.hpMax;
  state.boss.phase = 'normal';
  state.boss.rage = false;
  state.boss.finisher = false;
  state.boss.rageTriggered = false;
  state.boss.finisherTriggered = false;
  state.runtime.currentExpected = null;
  state.runtime.bossCycleIndex = 0;

  pushBossPhaseLog(state, 'boss_start', {
    hpMax: state.boss.hpMax
  });

  ui.setStageText('BOSS ROUND');
  ui.setCoachText('ตี weak point ของบอสให้ถูกจังหวะ', 'calm');
  ui.setCue('BOSS!', 'info');
  ui.setBossBar(state);
  syncMusicState(state, logger, 'boss_start');

  logger.emit('sb_boss_round_start', {
    roundIndex: round.index,
    bossHp: state.boss.hpMax
  });

  await playPhaseCard(
    ui,
    'WARNING',
    'BOSS INCOMING',
    'อ่าน weak point แล้วสวนกลับ',
    'boss',
    1100
  );

  while (
    nowMs() < state.runtime.roundEndMs &&
    state.boss.hp > 0 &&
    !state.session.endRequested &&
    !engine.ended
  ) {
    await waitIfPaused(state);

    updateBossMood(state);

    if (state.boss.rage && !state.boss.rageTriggered) {
      state.boss.rageTriggered = true;
      ui.setCue('RAGE!', 'near');
      ui.setCoachText('บอสโกรธแล้ว เร็วขึ้นอีกนิด', 'warn');
      ui.coachMoment('บอสโกรธแล้ว เร็วขึ้นอีกนิด', 'warn');
      ui.showPhaseCard('ALERT', 'RAGE MODE', 'บอสเร็วและดุดันขึ้น', 'rage', 900);
      ui.shake('soft');
      syncMusicState(state, logger, 'boss_rage_start');
      pushBossPhaseLog(state, 'rage_start');

      logger.emit('sb_boss_rage_start', {
        roundIndex: round.index,
        bossHp: state.boss.hp
      });
    }

    if (state.boss.finisher && !state.boss.finisherTriggered) {
      state.boss.finisherTriggered = true;
      ui.showPhaseCard('FINAL', 'FINISHER WINDOW', 'อีกไม่กี่หมัด ปิดบอสให้ได้', 'finisher', 900);
      ui.shake('soft');
      ui.coachMoment('อีกไม่กี่หมัด ปิดบอสให้ได้!', 'hype');
      syncMusicState(state, logger, 'boss_finisher_start');
      pushBossPhaseLog(state, 'finisher_start');
    }

    if (state.boss.finisher) {
      ui.setCoachText('อีกไม่กี่หมัด ปิดบอสให้ได้!', 'hype');
    }

    const remainSec = Math.max(0, Math.ceil((state.runtime.roundEndMs - nowMs()) / 1000));

    if (!state.runtime.currentExpected) {
      spawnBossExpected(state, ui, logger, round);
    }

    maybeTimeoutExpected(state, ui, logger);

    state.exercise.activeMs += 80;
    ui.renderHud(state, round, remainSec);
    await sleep(80);
  }

  state.runtime.currentExpected = null;
  state.boss.active = false;
  updateBossMood(state);
  ui.clearTarget();
  ui.setBossBar(state);

  if (state.boss.hp <= 0) {
    state.boss.clears += 1;
    ui.setCue('BOSS CLEAR!', 'hit');
    ui.setCoachText('เก่งมาก! ชนะบอสแล้ว', 'hype');
    ui.showPhaseCard('CLEAR', 'BOSS DEFEATED', 'ปิดบอสได้สำเร็จ', 'finisher', 980);
    pushBossPhaseLog(state, 'boss_clear');

    logger.emit('sb_boss_clear', {
      roundIndex: round.index
    });
  } else {
    ui.setCue('TIME UP', 'miss');
    ui.setCoachText('บอสยังไม่หมด ลองใหม่รอบหน้า', 'warn');
    pushBossPhaseLog(state, 'boss_timeout', {
      hpLeft: state.boss.hp
    });

    logger.emit('sb_boss_timeout', {
      roundIndex: round.index,
      bossHpLeft: state.boss.hp
    });
  }

  await sleep(900);
}

function spawnBossExpected(state, ui, logger, round) {
  const action = nextBossAction(state);
  const rawExpiresMs = state.boss.rage
    ? Math.max(560, timeoutWindowMs(state.cfg.intensity, 'boss') - 140)
    : state.boss.finisher
      ? Math.max(500, timeoutWindowMs(state.cfg.intensity, 'boss') - 180)
      : timeoutWindowMs(state.cfg.intensity, 'boss');

  const expected = {
    index: (state.runtime.bossCycleIndex || 0) + 1,
    action,
    label: actionLabel(action),
    scoreValue: scoreForAction(action, state.cfg, 'boss'),
    expiresMs: adjustedWindowMs(state, rawExpiresMs, 'boss'),
    spawnAtMs: nowMs(),
    expiresAtMs: 0,
    spawned: true
  };

  expected.hitAtMs = expected.spawnAtMs + expected.expiresMs;
  expected.expiresAtMs = expected.hitAtMs;
  expected.graceLateMs = adjustedLateGraceMs(state, lateGraceMs(state.cfg.intensity, 'boss'), 'boss');
  expected.nearMissWindowMs = adjustedNearMissMs(state, nearMissWindowMs(state.cfg.intensity, 'boss'), 'boss');
  expected.finalMissAtMs = expected.hitAtMs + expected.graceLateMs;
  expected.lateHintShown = false;

  state.runtime.currentExpected = expected;

  ui.setCue(expected.label, 'info');
  ui.showTarget(expected, 'boss');
  ui.setStageText(
    state.boss.finisher ? `FINISH • ${expected.label}` :
    state.boss.rage ? `RAGE • ${expected.label}` :
    `BOSS • ${expected.label}`
  );
  ui.setBossBar(state);

  logger.emit('sb_target_spawn', {
    roundIndex: round.index,
    actionType: expected.action,
    scoreValue: expected.scoreValue,
    bossHp: state.boss.hp,
    bossPhase: state.boss.phase,
    adaptiveLevel: state.director.level,
    adaptiveTrend: state.director.trend
  });
}

/* ------------------------------------------------------------------ */
/* actions / matching */
/* ------------------------------------------------------------------ */

function buildRoundActions(round, cfg, rng) {
  const style = round.style || 'mixed';
  const cadence = getCadenceSec(cfg.intensity, round.type);
  const total = Math.max(1, Math.floor(round.sec / cadence));
  const pool = getActionPool(style, cfg.body, round.type);

  let t = 1.05;
  const out = [];

  for (let i = 0; i < total; i++) {
    const action = pickFromPool(pool, style, round.type, rng, cfg.body);
    out.push({
      index: i + 1,
      atSec: Number(t.toFixed(2)),
      action,
      label: actionLabel(action),
      scoreValue: scoreForAction(action, cfg, round.type),
      expiresMs: timeoutWindowMs(cfg.intensity, round.type)
    });
    t += cadence;
  }

  return out;
}

function getCadenceSec(intensity, roundType) {
  const base = intensity === 'learn' ? 1.65 : intensity === 'power' ? 1.0 : 1.28;
  return roundType === 'boss' ? Math.max(0.75, base * 0.84) : base;
}

function timeoutWindowMs(intensity, roundType) {
  const base = intensity === 'learn' ? 1300 : intensity === 'power' ? 900 : 1100;
  return roundType === 'boss' ? Math.max(780, base - 120) : base;
}

function getActionPool(style, body, roundType) {
  const flow = ['jab', 'cross', 'flow_hit', 'hook_left', 'hook_right'];
  const boxing = ['jab', 'cross', 'hook_left', 'hook_right', 'uppercut_left', 'uppercut_right', 'guard'];
  const mixed = ['jab', 'cross', 'hook_left', 'hook_right', 'uppercut_left', 'uppercut_right', 'guard', 'flow_hit'];

  let pool = style === 'flow' ? flow : style === 'boxing' ? boxing : mixed;

  if (body === 'standing') {
    pool = pool.concat(['duck']);
  }

  if (roundType === 'boss') {
    pool = pool.concat(['jab', 'cross', 'hook_left', 'hook_right']);
  }

  return pool;
}

function pickFromPool(pool, style, roundType, rng, body) {
  const bonus = [];

  if (style === 'flow') bonus.push('flow_hit', 'jab', 'cross');
  if (style === 'boxing') bonus.push('jab', 'cross', 'guard');
  if (style === 'mixed') bonus.push('jab', 'cross', 'flow_hit');

  if (roundType === 'boss') {
    bonus.push('jab', 'cross', 'hook_left', 'hook_right');
    if (body === 'standing') bonus.push('duck');
  }

  const bag = pool.concat(bonus);
  return bag[Math.floor(rng() * bag.length)];
}

function scoreForAction(action, cfg, roundType) {
  const base = {
    jab: 100,
    cross: 115,
    hook_left: 125,
    hook_right: 125,
    uppercut_left: 135,
    uppercut_right: 135,
    guard: 90,
    duck: 110,
    slip_left: 110,
    slip_right: 110,
    flow_hit: 95
  }[action] || 100;

  const mul =
    cfg.intensity === 'learn' ? 1.0 :
    cfg.intensity === 'power' ? 1.3 : 1.15;

  const bossMul = roundType === 'boss' ? 1.15 : 1.0;
  return Math.round(base * mul * bossMul);
}

function maybeSpawnExpected(state, ui, logger, round, actions) {
  if (state.runtime.currentExpected) return;

  const elapsedSec = (nowMs() - state.runtime.roundStartMs) / 1000;
  const next = actions.find(a => !a.spawned && elapsedSec >= a.atSec);
  if (!next) return;

  next.spawned = true;
  next.spawnAtMs = nowMs();
  next.expiresMs = adjustedWindowMs(state, next.expiresMs, round.type);
  next.hitAtMs = next.spawnAtMs + next.expiresMs;
  next.expiresAtMs = next.hitAtMs;
  next.graceLateMs = adjustedLateGraceMs(state, lateGraceMs(state.cfg.intensity, round.type), round.type);
  next.nearMissWindowMs = adjustedNearMissMs(state, nearMissWindowMs(state.cfg.intensity, round.type), round.type);
  next.finalMissAtMs = next.hitAtMs + next.graceLateMs;
  next.lateHintShown = false;
  state.runtime.currentExpected = next;

  ui.setCue(next.label, 'info');
  ui.showTarget(next, round.type);
  ui.setStageText(round.type === 'boss' ? `Boss • ${next.label}` : `${round.label} Round`);

  logger.emit('sb_target_spawn', {
    roundIndex: round.index,
    actionType: next.action,
    scoreValue: next.scoreValue
  });
}

function maybeTimeoutExpected(state, ui, logger) {
  const exp = state.runtime.currentExpected;
  if (!exp) return;

  const t = nowMs();

  if (t <= exp.hitAtMs) return;

  if (t <= exp.finalMissAtMs) {
    if (!exp.lateHintShown) {
      exp.lateHintShown = true;
      ui.setCue('LATE!', 'near');
    }
    return;
  }

  state.actions.miss += 1;
  state.judgments.miss += 1;
  state.score.combo = 0;
  updateAccuracy(state);

  pushDirectorResult(state, 'timeout');
  updateDirectorFromPerformance(state, logger, ui, 'timeout');

  logger.emit('sb_target_timeout', {
    actionType: exp.action,
    roundIndex: state.session.roundIndex
  });

  ui.missTarget();
  ui.shake('soft');
  state.runtime.currentExpected = null;
  ui.setCue('MISS', 'miss');
  ui.coachMoment('หมดจังหวะแล้ว รีบขึ้นอีกนิด', 'warn');
  syncMusicState(state, logger, 'timeout_miss');
}

function consumeAction(action, state, ui, logger, meta = {}) {
  if (!action || state.session.endRequested) return false;
  if (state.session.pause) return false;

  state.runtime.lastActionAt = nowMs();
  state.runtime.actionHistory.push({
    at: state.runtime.lastActionAt,
    action,
    source: meta.source || 'unknown'
  });
  if (state.runtime.actionHistory.length > 60) {
    state.runtime.actionHistory.shift();
  }

  bumpActionCount(state, action);

  logger.emit('sb_input', {
    actionType: action,
    source: meta.source || 'manual',
    roundIndex: state.session.roundIndex
  });

  const exp = state.runtime.currentExpected;
  if (!exp) {
    state.actions.freeAction += 1;
    logger.emit('sb_free_action', {
      actionType: action,
      source: meta.source || 'manual',
      roundIndex: state.session.roundIndex
    });
    return false;
  }

  if (isActionMatch(action, exp.action)) {
    registerHit(action, exp, state, ui, logger, meta);
    return true;
  }

  registerMiss(action, exp, state, ui, logger, meta);
  return false;
}

function registerHit(action, exp, state, ui, logger, meta) {
  const judgment = typeof classifyTimingJudgment === 'function'
    ? classifyTimingJudgment(exp)
    : 'good';

  const scoreDelta = typeof scoreForJudgment === 'function'
    ? scoreForJudgment(exp.scoreValue, judgment)
    : exp.scoreValue;

  state.score.total += scoreDelta;
  state.score.combo += 1;
  state.score.comboMax = Math.max(state.score.comboMax, state.score.combo);
  state.score.stars = calcStars(state.score.total, state.cfg.durationMin);

  if (state.judgments) {
    if (judgment === 'perfect') state.judgments.perfect += 1;
    else if (judgment === 'good') state.judgments.good += 1;
    else if (judgment === 'late') state.judgments.late += 1;
  }

  countHandSide(action, state);
  updateAccuracy(state);

  let finisherHit = false;

  if (state.session.phase === 'boss') {
    state.boss.hp = Math.max(0, state.boss.hp - 1);
    updateBossMood(state);
    finisherHit = state.boss.hp === 0;
  }

  const comboLabel = comboTierLabel(state.score.combo);
  if (comboLabel && shouldShowComboFx(state.score.combo)) {
    ui.showComboFx(comboLabel);
  }

  pushDirectorResult(state, judgment || 'hit');
  updateDirectorFromPerformance(state, logger, ui, 'hit');

  logger.emit('sb_target_hit', {
    actionType: action,
    expectedType: exp.action,
    scoreDelta,
    combo: state.score.combo,
    source: meta.source || 'manual',
    roundIndex: state.session.roundIndex,
    bossHp: state.boss.hp,
    judgment,
    timingDeltaMs: typeof exp.hitAtMs === 'number' ? Math.round(nowMs() - exp.hitAtMs) : 0,
    finisherHit
  });

  ui.hitTarget();
  state.runtime.currentExpected = null;
  ui.setBossBar(state);
  syncMusicState(state, logger, finisherHit ? 'finisher_hit' : 'hit');

  if (finisherHit) {
    ui.flashFinisher();
    ui.shake('hard');
    ui.showPhaseCard('FINAL HIT', 'FINISHER!', 'ปิดบอสได้สวยมาก', 'finisher', 820);
    ui.setCue('FINISHER!', 'hit');
    ui.setCoachText('ปิดบอสได้สวยมาก!', 'hype');
    return;
  }

  ui.shake('soft');
  ui.setCue(typeof cueForJudgment === 'function' ? cueForJudgment(judgment) : 'HIT!', typeof toneForJudgment === 'function' ? toneForJudgment(judgment) : 'hit');

  if (judgment === 'perfect') {
    ui.coachMoment('คมมาก! จังหวะตรงสุด ๆ', 'hype');
  } else if (judgment === 'late') {
    ui.coachMoment('ช้านิดเดียว รอบหน้าก่อนจังหวะอีกนิด', 'warn');
  }
}

function registerMiss(action, exp, state, ui, logger, meta) {
  if (isNearMissWindow(exp)) {
    const scoreDelta = scoreForJudgment(exp.scoreValue, 'nearMiss');

    state.judgments.nearMiss += 1;
    state.score.total += scoreDelta;
    state.score.combo = 0;
    state.score.stars = calcStars(state.score.total, state.cfg.durationMin);
    updateAccuracy(state);

    pushDirectorResult(state, 'miss');
    updateDirectorFromPerformance(state, logger, ui, 'near_miss');

    logger.emit('sb_target_near_miss', {
      actionType: action,
      expectedType: exp.action,
      scoreDelta,
      source: meta.source || 'manual',
      roundIndex: state.session.roundIndex,
      timingDeltaMs: Math.round(nowMs() - exp.hitAtMs)
    });

    ui.nearMissTarget();
    ui.shake('soft');
    state.runtime.currentExpected = null;
    ui.setCue('NEAR!', 'near');
    ui.coachMoment('เกือบโดนแล้ว จับ hit zone ให้ตรงอีกนิด', 'warn');
    syncMusicState(state, logger, 'near_miss');
    return;
  }

  state.actions.miss += 1;
  state.judgments.miss += 1;
  state.score.combo = 0;
  updateAccuracy(state);

  pushDirectorResult(state, 'miss');
  updateDirectorFromPerformance(state, logger, ui, 'miss');

  logger.emit('sb_target_miss', {
    actionType: action,
    expectedType: exp.action,
    source: meta.source || 'manual',
    roundIndex: state.session.roundIndex
  });

  ui.missTarget();
  ui.shake('soft');
  state.runtime.currentExpected = null;
  ui.setCue('MISS', 'miss');
  ui.coachMoment('ไม่เป็นไร อ่านเป้าใหม่แล้วค่อยสวน', 'warn');
  syncMusicState(state, logger, 'miss');
}

function bumpActionCount(state, action) {
  state.actions.totalActions += 1;

  if (!(action in state.actions)) {
    state.actions[action] = 0;
  }
  state.actions[action] += 1;

  if (['jab', 'cross', 'hook_left', 'hook_right', 'uppercut_left', 'uppercut_right', 'flow_hit'].includes(action)) {
    state.actions.totalPunches += 1;
  }
}

function countHandSide(action, state) {
  if (['jab', 'hook_left', 'uppercut_left'].includes(action)) state.exercise.leftHits += 1;
  if (['cross', 'hook_right', 'uppercut_right'].includes(action)) state.exercise.rightHits += 1;
}

function isActionMatch(actual, expected) {
  if (actual === expected) return true;

  if (expected === 'flow_hit' && ['jab', 'cross', 'hook_left', 'hook_right', 'flow_hit'].includes(actual)) {
    return true;
  }

  return false;
}

function updateAccuracy(state) {
  const attempts = Math.max(1, state.actions.totalActions);
  const hits = Math.max(0, attempts - state.actions.miss);
  state.score.accuracy = (hits / attempts) * 100;

  const lrTotal = state.exercise.leftHits + state.exercise.rightHits;
  state.exercise.balancePct = lrTotal > 0
    ? Math.round((state.exercise.leftHits / lrTotal) * 100)
    : 50;
}

/* ------------------------------------------------------------------ */
/* summary / finish */
/* ------------------------------------------------------------------ */

async function completeSession(engine, reason = 'natural_end') {
  const { state, ui, logger, cfg } = engine;
  if (engine.ended) return;

  engine.ended = true;
  engine.running = false;
  state.session.endRequested = true;
  state.session.reasonEnded = reason;
  state.session.endedAt = Date.now();
  state.session.phase = 'summary';
  syncMusicState(state, logger, 'summary_open');

  finalizeMetrics(state);

  logger.emit('sb_summary_prepare', {
    reason,
    score: state.score.total,
    stars: state.score.stars
  });

  const summary = buildSummaryPayload(state);
  const selfReport = await openSummaryFlow(ui, summary, logger);
  const saved = saveSummary(summary, selfReport);

  const researchBundle = buildResearchBundle(state, selfReport);
  state.research.exportBundle = researchBundle;

  const researchTables = flattenResearchTables(researchBundle);
  state.research.exportTables = researchTables;

  try {
    localStorage.setItem('SB_RESEARCH_BUNDLE_LAST', JSON.stringify(researchBundle));

    const hist = JSON.parse(localStorage.getItem('SB_RESEARCH_BUNDLE_HISTORY') || '[]');
    hist.push(researchBundle);
    localStorage.setItem('SB_RESEARCH_BUNDLE_HISTORY', JSON.stringify(hist.slice(-20)));
  } catch (_) {}

  try {
    localStorage.setItem('SB_RESEARCH_TABLES_LAST', JSON.stringify(researchTables));

    const tableHist = JSON.parse(localStorage.getItem('SB_RESEARCH_TABLES_HISTORY') || '[]');
    tableHist.push(researchTables);
    localStorage.setItem('SB_RESEARCH_TABLES_HISTORY', JSON.stringify(tableHist.slice(-20)));
  } catch (_) {}

  state.summary = saved;

  logger.emit('sb_session_end', {
    reason,
    score: saved.score,
    stars: saved.stars,
    estimatedTier: saved.estimatedTier,
    perfect: saved.perfect,
    good: saved.good,
    late: saved.late,
    nearMiss: saved.nearMiss,
    judgeMiss: saved.judgeMiss
  });

  persistFinalSnapshot(saved);

  const nextUrl = cfg.cooldown || cfg.hub;
  ui.showOverlay(`
    <h2 style="margin:0 0 10px">เสร็จแล้ว</h2>
    <p style="margin:6px 0">บันทึกผลเรียบร้อย</p>
    <div class="sb-actions">
      <a class="sb-btn sb-btn-primary" href="${escapeAttr(nextUrl)}">${cfg.cooldown ? 'ไปต่อช่วงผ่อนแรง' : 'กลับ HUB'}</a>
    </div>
  `);
}

function endSession(reason, state, ui, logger) {
  if (state.session.endRequested) return;
  state.session.endRequested = true;

  logger.emit('sb_session_abort_request', { reason });

  ui.showOverlay(`
    <h2 style="margin:0 0 10px">ต้องการออกจากเกมหรือไม่</h2>
    <div class="sb-actions">
      <button class="sb-btn sb-btn-primary" data-sb-confirm-exit="1">ออกจากเกม</button>
      <button class="sb-btn sb-btn-secondary" data-sb-cancel-exit="1">เล่นต่อ</button>
    </div>
  `);

  const yes = ui.overlay.querySelector('[data-sb-confirm-exit="1"]');
  const no = ui.overlay.querySelector('[data-sb-cancel-exit="1"]');

  yes.addEventListener('click', () => {
    ui.hideOverlay();
    const engine = window[SB_GLOBAL_KEY];
    if (engine) completeSession(engine, reason);
  }, { once: true });

  no.addEventListener('click', () => {
    state.session.endRequested = false;
    ui.hideOverlay();
  }, { once: true });
}

function buildSummaryPayload(state) {
  return {
    patch: SB_ENGINE_VERSION,
    sessionId: state.session.sessionId,
    mode: state.cfg.mode,
    body: state.cfg.body,
    intensity: state.cfg.intensity,
    durationMin: state.cfg.durationMin,
    run: state.cfg.run,
    pid: state.cfg.pid,
    nick: state.cfg.nick,
    score: state.score.total,
    stars: state.score.stars,
    comboMax: state.score.comboMax,
    accuracy: Math.round(state.score.accuracy),
    perfect: state.judgments.perfect,
    good: state.judgments.good,
    late: state.judgments.late,
    nearMiss: state.judgments.nearMiss,
    judgeMiss: state.judgments.miss,
    totalActions: state.actions.totalActions,
    totalPunches: state.actions.totalPunches,
    jab: state.actions.jab,
    cross: state.actions.cross,
    hook: state.actions.hook_left + state.actions.hook_right,
    uppercut: state.actions.uppercut_left + state.actions.uppercut_right,
    guard: state.actions.guard,
    duck: state.actions.duck,
    flowHit: state.actions.flow_hit,
    miss: state.actions.miss,
    timeoutMiss: state.actions.timeoutMiss,
    activeMs: Math.round(state.exercise.activeMs),
    recoveryMs: Math.round(state.exercise.recoveryMs),
    warmupMs: Math.round(state.exercise.warmupMs),
    wrapMs: Math.round(state.exercise.wrapMs),
    punchesPerMin: Math.round(state.exercise.punchesPerMin),
    estimatedTier: state.exercise.estimatedTier,
    leftHits: state.exercise.leftHits,
    rightHits: state.exercise.rightHits,
    balancePct: state.exercise.balancePct,
    bossClears: state.boss.clears,
    adaptiveMode: state.director.mode,
    adaptiveLevel: state.director.level,
    adaptiveTrend: state.director.trend,
    adaptiveWindowMul: Number((state.director.appliedWindowMul || 1).toFixed(2)),
    adaptiveBossOffset: state.director.bossHpOffset || 0,
    adaptiveDecisionSeq: state.director.decisionSeq || 0,
    startedAt: state.session.startedAt,
    endedAt: state.session.endedAt,
    createdAtIso: new Date().toISOString()
  };
}

async function openSummaryFlow(ui, summary, logger) {
  const coachLines = summaryCoachDetails(summary);

  ui.showOverlay(`
    <h2 style="margin:0 0 10px">Shadow Breaker Summary</h2>

    <div class="sb-card-grid">
      <div class="sb-mini-card">
        <strong>Score</strong>
        <div>${summary.score}</div>
      </div>
      <div class="sb-mini-card">
        <strong>Stars</strong>
        <div>${summary.stars}</div>
      </div>
      <div class="sb-mini-card">
        <strong>Accuracy</strong>
        <div>${summary.accuracy}%</div>
      </div>
      <div class="sb-mini-card">
        <strong>Punches/min</strong>
        <div>${summary.punchesPerMin}</div>
      </div>
      <div class="sb-mini-card">
        <strong>Combo Max</strong>
        <div>${summary.comboMax}</div>
      </div>
      <div class="sb-mini-card">
        <strong>Boss Clear</strong>
        <div>${summary.bossClears}</div>
      </div>
      <div class="sb-mini-card">
        <strong>Balance L:R</strong>
        <div>${summary.balancePct}% ซ้าย</div>
      </div>
      <div class="sb-mini-card">
        <strong>Tier</strong>
        <div>${escapeHtml(summary.estimatedTier || 'light')}</div>
      </div>
      <div class="sb-mini-card">
        <strong>Adaptive</strong>
        <div>
          ${escapeHtml(String(summary.adaptiveMode || 'live'))} •
          ${escapeHtml(String(summary.adaptiveTrend || 'steady'))} •
          L${summary.adaptiveLevel || 0}
        </div>
      </div>
      <div class="sb-mini-card">
        <strong>Director</strong>
        <div>
          W×${summary.adaptiveWindowMul || 1} •
          Boss ${(summary.adaptiveBossOffset || 0) >= 0 ? '+' : ''}${summary.adaptiveBossOffset || 0}
        </div>
      </div>
    </div>

    ${summaryJudgeHtml(summary)}

    <div style="margin-top:12px">
      <strong>Quick Coach</strong>
      <p style="margin:8px 0 0">${escapeHtml(summaryCoachText(summary))}</p>
      <div style="margin-top:8px; display:grid; gap:6px;">
        ${coachLines.map(line => `
          <div style="padding:10px 12px; border-radius:12px; background:#f4f8ff;">
            ${escapeHtml(line)}
          </div>
        `).join('')}
      </div>
    </div>

    <div class="sb-actions">
      <button class="sb-btn sb-btn-secondary" data-sb-export-bundle="1">Export Research JSON</button>
      <button class="sb-btn sb-btn-secondary" data-sb-export-csv="1">Export Research CSV</button>
      <button class="sb-btn sb-btn-secondary" data-sb-send-apps-script="1">Send to Apps Script</button>
      <button class="sb-btn sb-btn-primary" data-sb-go-report="1">ต่อไป</button>
    </div>
  `);

  logger.emit('sb_summary_open', {
    score: summary.score,
    stars: summary.stars,
    estimatedTier: summary.estimatedTier,
    perfect: summary.perfect,
    good: summary.good,
    late: summary.late,
    nearMiss: summary.nearMiss,
    judgeMiss: summary.judgeMiss
  });

  const exportBtn = ui.overlay.querySelector('[data-sb-export-bundle="1"]');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const engine = window[SB_GLOBAL_KEY];
      if (!engine) return;
      const bundle = buildResearchBundle(engine.state, null);
      engine.state.research.exportBundle = bundle;
      exportResearchBundle(engine.state);
    });
  }

  const exportCsvBtn = ui.overlay.querySelector('[data-sb-export-csv="1"]');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const engine = window[SB_GLOBAL_KEY];
      if (!engine) return;

      const bundle = buildResearchBundle(engine.state, null);
      engine.state.research.exportBundle = bundle;
      engine.state.research.exportTables = flattenResearchTables(bundle);
      exportResearchCsvTables(engine.state);
    });
  }

  const sendAppsScriptBtn = ui.overlay.querySelector('[data-sb-send-apps-script="1"]');
  if (sendAppsScriptBtn) {
    sendAppsScriptBtn.addEventListener('click', async () => {
      const engine = window[SB_GLOBAL_KEY];
      if (!engine) return;

      const result = await sendAppsScriptPayload(engine.state, engine.logger);

      if (result.ok) {
        ui.coachMoment('ส่งข้อมูลขึ้น Apps Script แล้ว', 'hype');
      } else if (result.error === 'NO_ENDPOINT') {
        ui.coachMoment('ยังไม่พบ endpoint ของ Apps Script', 'warn');
      } else {
        ui.coachMoment('ส่งข้อมูลไม่สำเร็จ ลองตรวจ endpoint อีกครั้ง', 'warn');
      }
    });
  }

  await waitOverlayClick(ui.overlay, '[data-sb-go-report="1"]');

  ui.showOverlay(`
    <h2 style="margin:0 0 10px">หลังเล่นรู้สึกอย่างไร</h2>
    <form id="sb-self-report-form">
      <label class="sb-field">
        <span>เหนื่อยแค่ไหน (0–10)</span>
        <input type="range" name="rpe" min="0" max="10" value="5" />
      </label>

      <label class="sb-field">
        <span>สนุกแค่ไหน (1–5)</span>
        <input type="range" name="enjoyment" min="1" max="5" value="4" />
      </label>

      <label class="sb-field">
        <span>ยากแค่ไหน (1–5)</span>
        <input type="range" name="difficulty" min="1" max="5" value="3" />
      </label>

      <label class="sb-field">
        <span>ล้า/ปวดแขนแค่ไหน (0–5)</span>
        <input type="range" name="pain" min="0" max="5" value="1" />
      </label>

      <label class="sb-field">
        <span>ตอนนี้รู้สึกสดชื่นขึ้นไหม (1–5)</span>
        <input type="range" name="refresh" min="1" max="5" value="4" />
      </label>

      <div class="sb-actions">
        <button type="submit" class="sb-btn sb-btn-primary">บันทึกผล</button>
      </div>
    </form>
  `);

  const values = await waitSelfReportSubmit(ui.overlay);
  logger.emit('sb_self_report_submit', values);
  ui.hideOverlay();
  return values;
}

function summaryCoachText(summary) {
  const lines = summaryCoachDetails(summary);
  return lines[0] || 'ทำได้ดีแล้ว ลองเล่นอีกครั้งเพื่อเก็บจังหวะให้คมขึ้น';
}

function saveSummary(summary, selfReport) {
  const payload = { ...summary, selfReport };

  try {
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(payload));
    localStorage.setItem('SB_LAST_SUMMARY', JSON.stringify(payload));

    const history = JSON.parse(localStorage.getItem('HHA_SUMMARY_HISTORY') || '[]');
    history.push(payload);
    localStorage.setItem('HHA_SUMMARY_HISTORY', JSON.stringify(history.slice(-50)));

    const sbHistory = JSON.parse(localStorage.getItem('SB_SUMMARY_HISTORY') || '[]');
    sbHistory.push(payload);
    localStorage.setItem('SB_SUMMARY_HISTORY', JSON.stringify(sbHistory.slice(-50)));

    localStorage.setItem('SB_LAST_CONFIG', JSON.stringify({
      mode: summary.mode,
      body: summary.body,
      intensity: summary.intensity,
      durationMin: summary.durationMin
    }));
  } catch (_) {}

  return payload;
}

function finalizeMetrics(state) {
  updateAccuracy(state);

  const durMin = Math.max(1 / 60, (state.session.endedAt - state.session.startedAt) / 60000);
  state.exercise.punchesPerMin = state.actions.totalPunches / durMin;
  state.exercise.estimatedTier = estimateTier(state);
}

/* ------------------------------------------------------------------ */
/* UI */
/* ------------------------------------------------------------------ */

function createUiShell() {
  let root = document.getElementById('sb-engine-root');
  if (root) {
    return bindUiRefs(root);
  }

  root = document.createElement('section');
  root.id = 'sb-engine-root';
  root.className = 'sb-shell';
  root.innerHTML = `
    <style>
      #sb-engine-root.sb-shell{
        min-height:100vh;
        background:radial-gradient(circle at top, #182847 0%, #0b1427 56%, #050913 100%);
        color:#fff;
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        position:relative;
        overflow:hidden;
      }
      .sb-hud{
        position:absolute;
        background:rgba(10,18,38,.72);
        backdrop-filter:blur(8px);
        border:1px solid rgba(255,255,255,.09);
        border-radius:16px;
        padding:10px 12px;
        line-height:1.5;
        font-size:14px;
        z-index:10;
      }
      .sb-top{ left:12px; right:12px; top:12px; display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; }
      .sb-left{ left:12px; top:92px; width:148px; }
      .sb-right{ right:12px; top:92px; width:148px; }

      .sb-bossbar{
        position:absolute;
        left:50%;
        top:64px;
        transform:translateX(-50%);
        width:min(78vw,520px);
        z-index:11;
        display:none;
      }
      .sb-bossbar[data-open="1"]{
        display:block;
      }
      .sb-bossbar-head{
        display:flex;
        justify-content:space-between;
        gap:12px;
        margin-bottom:6px;
        font-weight:900;
        font-size:13px;
        text-shadow:0 2px 10px rgba(0,0,0,.35);
      }
      .sb-bossbar-track{
        height:18px;
        border-radius:999px;
        background:rgba(255,255,255,.10);
        overflow:hidden;
        border:1px solid rgba(255,255,255,.18);
        box-shadow:0 10px 22px rgba(0,0,0,.18);
      }
      .sb-bossbar-fill{
        height:100%;
        width:0%;
        border-radius:999px;
        background:linear-gradient(90deg, #ff7aa2 0%, #ff476f 48%, #b0143d 100%);
        transition:width .16s linear, filter .16s linear;
      }
      .sb-bossbar[data-rage="1"] .sb-bossbar-fill{
        background:linear-gradient(90deg, #ffd166 0%, #ff8c42 38%, #ff3d00 100%);
        filter:brightness(1.08);
      }
      .sb-bossbar[data-finisher="1"] .sb-bossbar-fill{
        background:linear-gradient(90deg, #fff4b3 0%, #ffe066 50%, #ffb703 100%);
        filter:brightness(1.18);
      }
      .sb-finisher-flash{
        position:absolute;
        inset:0;
        pointer-events:none;
        z-index:29;
        opacity:0;
        background:radial-gradient(circle, rgba(255,245,180,.24) 0%, rgba(255,180,60,.16) 30%, rgba(0,0,0,0) 68%);
      }
      .sb-finisher-flash.is-on{
        animation:sbFinisherFlash .45s ease-out forwards;
      }

      .sb-phase-card{
        position:absolute;
        left:50%;
        top:18%;
        transform:translate(-50%,-50%);
        width:min(86vw,560px);
        z-index:28;
        pointer-events:none;
        opacity:0;
        transition:opacity .18s ease;
      }
      .sb-phase-card[data-open="1"]{
        opacity:1;
      }
      .sb-phase-card-box{
        border-radius:24px;
        padding:18px 18px 16px;
        color:#fff;
        text-align:center;
        background:linear-gradient(180deg, rgba(10,18,38,.86) 0%, rgba(18,34,66,.82) 100%);
        border:1px solid rgba(255,255,255,.14);
        box-shadow:0 18px 44px rgba(0,0,0,.28);
        backdrop-filter:blur(10px);
        animation:sbPhaseCardIn .32s ease-out;
      }
      .sb-phase-card[data-tone="boss"] .sb-phase-card-box{
        background:linear-gradient(180deg, rgba(88,15,38,.90) 0%, rgba(145,24,60,.82) 100%);
      }
      .sb-phase-card[data-tone="rage"] .sb-phase-card-box{
        background:linear-gradient(180deg, rgba(122,53,0,.92) 0%, rgba(195,67,0,.84) 100%);
      }
      .sb-phase-card[data-tone="finisher"] .sb-phase-card-box{
        background:linear-gradient(180deg, rgba(132,92,0,.92) 0%, rgba(219,154,0,.84) 100%);
      }
      .sb-phase-kicker{
        font-size:12px;
        font-weight:900;
        letter-spacing:.18em;
        opacity:.88;
        text-transform:uppercase;
      }
      .sb-phase-title{
        margin-top:6px;
        font-size:clamp(22px,4.5vw,36px);
        font-weight:1000;
        letter-spacing:.02em;
      }
      .sb-phase-sub{
        margin-top:6px;
        font-size:14px;
        opacity:.95;
      }

      .sb-combo-fx{
        position:absolute;
        left:50%;
        top:28%;
        transform:translateX(-50%);
        z-index:27;
        pointer-events:none;
        opacity:0;
        min-width:220px;
        text-align:center;
        padding:12px 18px;
        border-radius:999px;
        color:#fff;
        font-weight:1000;
        letter-spacing:.04em;
        background:linear-gradient(180deg, rgba(255,96,144,.92) 0%, rgba(122,36,255,.88) 100%);
        box-shadow:0 18px 40px rgba(0,0,0,.24), 0 0 18px rgba(255,96,144,.22);
      }
      .sb-combo-fx.is-on{
        animation:sbComboFxIn .72s ease-out forwards;
      }

      .sb-stage{
        position:absolute;
        inset:0;
        display:grid;
        place-items:center;
        padding:108px 16px 176px;
        text-align:center;
        z-index:7;
        pointer-events:none;
      }
      .sb-stage-text{
        font-size:clamp(22px,4vw,44px);
        font-weight:800;
        opacity:.96;
        text-shadow:0 0 26px rgba(130,200,255,.18);
      }
      .sb-target-layer{
        position:absolute;
        inset:96px 16px 170px;
        z-index:8;
        pointer-events:none;
      }
      .sb-target-lane{
        position:absolute;
        left:50%;
        top:54%;
        width:2px;
        height:180px;
        transform:translate(-50%,-50%);
        background:linear-gradient(180deg, rgba(255,255,255,.02) 0%, rgba(140,200,255,.3) 38%, rgba(255,255,255,.02) 100%);
        filter:drop-shadow(0 0 12px rgba(120,190,255,.16));
        opacity:.9;
      }
      .sb-target{
        position:absolute;
        width:88px;
        height:88px;
        border-radius:999px;
        display:block;
        color:#fff;
        animation:sbTargetPop .14s ease-out;
        pointer-events:none;
      }
      .sb-target::after{
        content:'';
        position:absolute;
        inset:-10px;
        border-radius:inherit;
        border:1px dashed rgba(255,255,255,.10);
      }

      .sb-hit-zone{
        position:absolute;
        inset:0;
        border-radius:inherit;
        border:2px dashed rgba(255,255,255,.48);
        background:rgba(255,255,255,.04);
        box-shadow:
          inset 0 0 0 2px rgba(255,255,255,.04),
          0 0 18px rgba(255,255,255,.08);
      }

      .sb-hit-zone-ring{
        position:absolute;
        inset:-16px;
        border-radius:inherit;
        border:3px solid rgba(255,255,255,.18);
        animation:sbHitZonePulse 1s ease-in-out infinite;
      }

      .sb-target-body{
        position:absolute;
        inset:0;
        border-radius:inherit;
        display:grid;
        place-items:center;
        font-weight:900;
        font-size:16px;
        color:#fff;
        border:2px solid rgba(255,255,255,.22);
        box-shadow:
          0 0 0 6px rgba(255,255,255,.04),
          0 14px 30px rgba(0,0,0,.24),
          0 0 22px rgba(140,200,255,.22);
        backdrop-filter:blur(3px);
        transform-origin:center center;
        animation:sbApproachBody var(--ring-ms, 1100ms) linear forwards;
        will-change:transform,opacity,filter;
      }

      .sb-target-glow{
        position:absolute;
        inset:-22px;
        border-radius:inherit;
        background:radial-gradient(circle, rgba(255,255,255,.18) 0%, rgba(120,190,255,.10) 42%, rgba(0,0,0,0) 72%);
        filter:blur(10px);
        pointer-events:none;
      }

      .sb-target-core{
        position:absolute;
        inset:0;
        border-radius:inherit;
        display:grid;
        place-items:center;
      }

      .sb-target-label{
        position:absolute;
        left:50%;
        top:calc(100% + 10px);
        transform:translateX(-50%);
        font-size:14px;
        font-weight:900;
        letter-spacing:.04em;
        white-space:nowrap;
        color:#fff;
        text-shadow:0 2px 10px rgba(0,0,0,.45);
      }

      .sb-target-hint{
        position:absolute;
        right:-8px;
        top:-8px;
        min-width:26px;
        height:26px;
        padding:0 8px;
        border-radius:999px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        font-size:11px;
        font-weight:900;
        color:#0d1b2a;
        background:#fff;
        box-shadow:0 8px 20px rgba(0,0,0,.18);
        z-index:2;
      }

      .sb-target.is-jab .sb-target-body{
        background:radial-gradient(circle at 35% 30%, #8fd3ff 0%, #3a86ff 55%, #143d8f 100%);
      }
      .sb-target.is-cross .sb-target-body{
        background:radial-gradient(circle at 35% 30%, #9bf6ff 0%, #4cc9f0 55%, #1c6aa5 100%);
      }
      .sb-target.is-hook-left .sb-target-body{
        background:radial-gradient(circle at 35% 30%, #ffb3d9 0%, #ff6fb1 55%, #b83280 100%);
      }
      .sb-target.is-hook-right .sb-target-body{
        background:radial-gradient(circle at 35% 30%, #ffc7a8 0%, #ff9f68 55%, #d46a1d 100%);
      }
      .sb-target.is-uppercut-left .sb-target-body{
        background:radial-gradient(circle at 35% 30%, #caffbf 0%, #71dd7a 55%, #2d8a3c 100%);
      }
      .sb-target.is-uppercut-right .sb-target-body{
        background:radial-gradient(circle at 35% 30%, #fdffb6 0%, #f7d64a 55%, #c49311 100%);
      }
      .sb-target.is-guard .sb-target-body{
        background:linear-gradient(180deg, #d7e9ff 0%, #7fb3ff 45%, #275cc9 100%);
      }
      .sb-target.is-flow .sb-target-body{
        background:
          radial-gradient(circle at 50% 50%, rgba(255,255,255,.95) 0 10%, rgba(92,214,255,.95) 11% 32%, rgba(36,120,255,.88) 33% 56%, rgba(13,43,93,.85) 57% 100%);
      }
      .sb-target.is-boss .sb-target-body{
        background:radial-gradient(circle at 35% 30%, #ffcad4 0%, #ff6b8a 45%, #8f1d3e 100%);
        box-shadow:
          0 0 0 8px rgba(255,255,255,.04),
          0 18px 34px rgba(0,0,0,.28),
          0 0 30px rgba(255,107,138,.35);
      }

      .sb-target.is-jab{
        left:50%;
        top:42%;
        transform:translate(-50%,-50%);
      }
      .sb-target.is-cross{
        left:64%;
        top:42%;
        transform:translate(-50%,-50%);
      }
      .sb-target.is-hook-left{
        left:28%;
        top:42%;
        transform:translate(-50%,-50%);
      }
      .sb-target.is-hook-right{
        left:72%;
        top:42%;
        transform:translate(-50%,-50%);
      }
      .sb-target.is-uppercut-left{
        left:40%;
        top:58%;
        transform:translate(-50%,-50%);
      }
      .sb-target.is-uppercut-right{
        left:60%;
        top:58%;
        transform:translate(-50%,-50%);
      }
      .sb-target.is-guard{
        width:112px;
        height:112px;
        border-radius:24px;
        left:50%;
        top:40%;
        transform:translate(-50%,-50%);
      }
      .sb-target.is-duck{
        width:78%;
        height:20px;
        border-radius:999px;
        left:50%;
        top:38%;
        transform:translate(-50%,-50%);
      }
      .sb-target.is-duck .sb-hit-zone{
        border-radius:999px;
      }
      .sb-target.is-duck .sb-hit-zone-ring{
        border-radius:999px;
      }
      .sb-target.is-duck .sb-target-body{
        border-radius:999px;
        background:linear-gradient(90deg, #ffd6a5 0%, #ffad66 50%, #f47c20 100%);
        box-shadow:0 8px 20px rgba(0,0,0,.24), 0 0 20px rgba(255,173,102,.24);
      }
      .sb-target.is-flow{
        width:120px;
        height:120px;
        left:50%;
        top:45%;
        transform:translate(-50%,-50%);
      }
      .sb-target.is-boss{
        width:132px;
        height:132px;
        left:50%;
        top:36%;
        transform:translate(-50%,-50%);
      }

      .sb-boss-weakpoints{
        position:absolute;
        inset:-18px;
        pointer-events:none;
      }
      .sb-boss-wp{
        position:absolute;
        width:20px;
        height:20px;
        border-radius:999px;
        background:rgba(255,255,255,.22);
        border:2px solid rgba(255,255,255,.44);
        box-shadow:0 0 10px rgba(255,255,255,.12);
      }
      .sb-boss-wp.is-active{
        background:#fff4b3;
        border-color:#fff;
        box-shadow:0 0 16px rgba(255,244,179,.55);
        transform:scale(1.12);
      }
      .sb-boss-wp.is-top{ left:50%; top:-10px; transform:translateX(-50%); }
      .sb-boss-wp.is-right{ right:-10px; top:50%; transform:translateY(-50%); }
      .sb-boss-wp.is-bottom{ left:50%; bottom:-10px; transform:translateX(-50%); }
      .sb-boss-wp.is-left{ left:-10px; top:50%; transform:translateY(-50%); }

      .sb-target-hit{
        animation:sbTargetHit .18s ease-out forwards !important;
      }
      .sb-target-miss{
        animation:sbTargetMiss .20s ease-out forwards !important;
      }
      .sb-target-near{
        animation:sbTargetNear .18s ease-out forwards !important;
      }

      .sb-cue{
        position:absolute;
        left:50%;
        bottom:126px;
        transform:translateX(-50%);
        min-width:160px;
        text-align:center;
        padding:14px 18px;
        border-radius:999px;
        font-size:26px;
        font-weight:900;
        background:rgba(255,255,255,.09);
        border:1px solid rgba(255,255,255,.14);
        z-index:10;
      }
      .sb-cue.is-hit{ background:rgba(60,210,120,.22); }
      .sb-cue.is-miss{ background:rgba(255,90,90,.22); }
      .sb-cue.is-info{ background:rgba(90,160,255,.22); }
      .sb-cue.is-near{ background:rgba(255,196,90,.24); }

      .sb-coach{
        position:absolute;
        left:50%;
        transform:translateX(-50%);
        bottom:84px;
        max-width:min(84vw,560px);
        min-height:40px;
        font-size:14px;
        line-height:1.35;
        opacity:.98;
        color:#fff;
        background:rgba(14,24,46,.72);
        padding:10px 14px 10px 46px;
        border-radius:18px;
        z-index:10;
        border:1px solid rgba(255,255,255,.12);
        box-shadow:0 12px 24px rgba(0,0,0,.18);
        backdrop-filter:blur(8px);
      }
      .sb-coach::before{
        content:'';
        position:absolute;
        left:12px;
        top:50%;
        width:22px;
        height:22px;
        transform:translateY(-50%);
        border-radius:999px;
        background:radial-gradient(circle at 35% 35%, #fff 0%, #bde0ff 38%, #6aa9ff 100%);
        box-shadow:0 0 12px rgba(130,180,255,.28);
      }
      .sb-coach::after{
        content:'';
        position:absolute;
        left:22px;
        bottom:-8px;
        width:14px;
        height:14px;
        transform:rotate(45deg);
        background:inherit;
        border-right:1px solid rgba(255,255,255,.10);
        border-bottom:1px solid rgba(255,255,255,.10);
      }
      .sb-coach.is-calm{
        background:rgba(14,24,46,.72);
      }
      .sb-coach.is-warn{
        background:rgba(108,52,10,.84);
      }
      .sb-coach.is-hype{
        background:rgba(88,18,44,.84);
      }
      .sb-coach.is-pulse{
        animation:sbCoachPulse .42s ease-out;
      }

      .sb-pad{
        position:absolute;
        left:12px;
        right:12px;
        bottom:12px;
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px;
        z-index:10;
      }
      .sb-pad button{
        border:0;
        border-radius:14px;
        padding:12px 8px;
        font-weight:800;
        font-size:14px;
        background:#d8ecff;
        color:#123;
        box-shadow:0 8px 20px rgba(0,0,0,.18);
      }
      .sb-pad button[data-action="duck"]{
        background:#fff2c8;
      }

      .sb-tools{
        position:absolute;
        top:12px;
        right:12px;
        display:flex;
        gap:8px;
        z-index:12;
      }
      .sb-tool-btn{
        border:0;
        border-radius:12px;
        padding:8px 10px;
        font-weight:700;
        background:rgba(255,255,255,.14);
        color:#fff;
      }

      .sb-overlay{
        position:absolute;
        inset:0;
        z-index:30;
      }
      .sb-overlay[hidden]{ display:none; }
      .sb-overlay-backdrop{
        position:absolute;
        inset:0;
        background:rgba(4,8,18,.72);
      }
      .sb-overlay-card{
        position:absolute;
        left:50%;
        top:50%;
        transform:translate(-50%,-50%);
        width:min(92vw,760px);
        max-height:86vh;
        overflow:auto;
        background:#fff;
        color:#172338;
        border-radius:24px;
        padding:20px;
        box-shadow:0 24px 64px rgba(0,0,0,.28);
      }
      .sb-card-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:12px;
      }
      .sb-mini-card{
        background:#f4f8ff;
        border-radius:16px;
        padding:12px 14px;
      }
      .sb-plan-list{
        margin-top:8px;
        display:grid;
        gap:6px;
      }
      .sb-plan-row{
        display:flex;
        justify-content:space-between;
        gap:12px;
        padding:8px 10px;
        border-radius:12px;
        background:#f6f8fc;
      }
      .sb-actions{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        justify-content:flex-end;
        margin-top:14px;
      }
      .sb-btn{
        appearance:none;
        border:0;
        border-radius:14px;
        padding:12px 16px;
        font-weight:800;
        text-decoration:none;
        cursor:pointer;
        display:inline-flex;
        align-items:center;
        justify-content:center;
      }
      .sb-btn-primary{
        background:#3b82f6;
        color:#fff;
      }
      .sb-btn-secondary{
        background:#eaf2ff;
        color:#13325b;
      }
      .sb-field{
        display:block;
        margin:10px 0;
      }
      .sb-field span{
        display:block;
        font-weight:700;
        margin-bottom:6px;
      }
      .sb-field input[type="range"]{
        width:100%;
      }

      #sb-engine-root.is-shake-soft{
        animation:sbShakeSoft .18s linear;
      }
      #sb-engine-root.is-shake-hard{
        animation:sbShakeHard .28s linear;
      }

      @keyframes sbTargetPop{
        from{ opacity:0; transform:translate(-50%,-50%) scale(.78); }
        to{ opacity:1; transform:translate(-50%,-50%) scale(1); }
      }

      @keyframes sbApproachBody{
        0%{
          transform:translateY(-120px) scale(.34);
          opacity:.22;
          filter:blur(4px) saturate(.9);
        }
        65%{
          transform:translateY(-24px) scale(.78);
          opacity:.92;
          filter:blur(0px) saturate(1);
        }
        100%{
          transform:translateY(0px) scale(1);
          opacity:1;
          filter:blur(0px) saturate(1.02);
        }
      }

      @keyframes sbHitZonePulse{
        0%,100%{ opacity:.55; transform:scale(1); }
        50%{ opacity:.9; transform:scale(1.05); }
      }

      @keyframes sbTargetHit{
        from{ opacity:1; transform:scale(1); filter:brightness(1); }
        to{ opacity:0; transform:scale(1.18); filter:brightness(1.8); }
      }

      @keyframes sbTargetMiss{
        from{ opacity:1; transform:scale(1); }
        to{ opacity:0; transform:scale(.86); }
      }

      @keyframes sbTargetNear{
        from{ opacity:1; transform:scale(1); filter:brightness(1); }
        to{ opacity:0; transform:scale(1.08); filter:brightness(1.25); }
      }

      @keyframes sbRingShrink{
        from{ transform:scale(1.95); opacity:.94; }
        to{ transform:scale(1.0); opacity:.22; }
      }

      @keyframes sbFinisherFlash{
        0%{ opacity:0; transform:scale(.94); }
        25%{ opacity:1; transform:scale(1.02); }
        100%{ opacity:0; transform:scale(1.08); }
      }

      @keyframes sbPhaseCardIn{
        0%{ opacity:0; transform:translateY(-10px) scale(.96); }
        100%{ opacity:1; transform:translateY(0) scale(1); }
      }

      @keyframes sbCoachPulse{
        0%{ transform:translateX(-50%) scale(.98); }
        45%{ transform:translateX(-50%) scale(1.03); }
        100%{ transform:translateX(-50%) scale(1); }
      }

      @keyframes sbComboFxIn{
        0%{ opacity:0; transform:translateX(-50%) translateY(10px) scale(.90); }
        20%{ opacity:1; transform:translateX(-50%) translateY(0px) scale(1); }
        75%{ opacity:1; transform:translateX(-50%) translateY(-6px) scale(1.02); }
        100%{ opacity:0; transform:translateX(-50%) translateY(-18px) scale(.98); }
      }

      @keyframes sbShakeSoft{
        0%{ transform:translate(0,0); }
        20%{ transform:translate(-1px,1px); }
        40%{ transform:translate(1px,-1px); }
        60%{ transform:translate(-1px,0px); }
        80%{ transform:translate(1px,1px); }
        100%{ transform:translate(0,0); }
      }

      @keyframes sbShakeHard{
        0%{ transform:translate(0,0); }
        16%{ transform:translate(-3px,2px); }
        32%{ transform:translate(3px,-2px); }
        48%{ transform:translate(-2px,-1px); }
        64%{ transform:translate(2px,2px); }
        80%{ transform:translate(-1px,1px); }
        100%{ transform:translate(0,0); }
      }

      @media (max-width:680px){
        .sb-left,.sb-right{
          top:auto;
          bottom:174px;
          width:calc(50vw - 20px);
          font-size:12px;
        }
        .sb-left{ left:12px; }
        .sb-right{ right:12px; }
        .sb-cue{
          bottom:142px;
          font-size:22px;
        }
        .sb-card-grid{
          grid-template-columns:1fr;
        }
        .sb-target{
          width:72px;
          height:72px;
          font-size:14px;
        }
        .sb-target.is-guard{
          width:96px;
          height:96px;
        }
        .sb-target.is-flow{
          width:104px;
          height:104px;
        }
        .sb-target.is-boss{
          width:116px;
          height:116px;
        }
        .sb-target-hint{
          font-size:10px;
          min-width:24px;
          height:24px;
        }
        .sb-target-body{
          font-size:14px;
        }
      }
    </style>

    <div class="sb-tools">
      <button class="sb-tool-btn" data-sb-pause="1">Pause</button>
      <button class="sb-tool-btn" data-sb-help-btn="1">Help</button>
      <button class="sb-tool-btn" data-sb-exit="1">Exit</button>
    </div>

    <div class="sb-bossbar" data-sb-bossbar data-open="0" data-rage="0" data-finisher="0">
      <div class="sb-bossbar-head">
        <span data-sb-bossname>BOSS</span>
        <span data-sb-bosshp>0 / 0</span>
      </div>
      <div class="sb-bossbar-track">
        <div class="sb-bossbar-fill" data-sb-bossfill></div>
      </div>
    </div>

    <div class="sb-finisher-flash" data-sb-finisher-flash></div>

    <div class="sb-phase-card" data-sb-phase-card data-open="0" data-tone="normal">
      <div class="sb-phase-card-box">
        <div class="sb-phase-kicker" data-sb-phase-kicker>PHASE</div>
        <div class="sb-phase-title" data-sb-phase-title>READY</div>
        <div class="sb-phase-sub" data-sb-phase-sub>เตรียมตัว</div>
      </div>
    </div>

    <div class="sb-combo-fx" data-sb-combo-fx></div>

    <div class="sb-hud sb-top" data-sb-top></div>
    <div class="sb-hud sb-left" data-sb-left></div>
    <div class="sb-hud sb-right" data-sb-right></div>

    <div class="sb-stage" data-sb-stage><div class="sb-stage-text">Shadow Breaker</div></div>
    <div class="sb-target-layer" data-sb-target-layer></div>
    <div class="sb-cue is-info" data-sb-cue></div>
    <div class="sb-coach is-calm" data-sb-coach></div>

    <div class="sb-pad" data-sb-pad>
      <button data-action="jab">JAB</button>
      <button data-action="cross">CROSS</button>
      <button data-action="hook_left">HOOK L</button>
      <button data-action="hook_right">HOOK R</button>
      <button data-action="uppercut_left">UP L</button>
      <button data-action="uppercut_right">UP R</button>
      <button data-action="guard">BLOCK</button>
      <button data-action="duck">DUCK</button>
    </div>

    <div class="sb-overlay" data-sb-overlay hidden>
      <div class="sb-overlay-backdrop"></div>
      <div class="sb-overlay-card" data-sb-overlay-card></div>
    </div>
  `;

  document.body.appendChild(root);
  return bindUiRefs(root);
}

function bindUiRefs(root) {
  const top = root.querySelector('[data-sb-top]');
  const left = root.querySelector('[data-sb-left]');
  const right = root.querySelector('[data-sb-right]');
  const stage = root.querySelector('[data-sb-stage]');
  const targetLayer = root.querySelector('[data-sb-target-layer]');
  const cue = root.querySelector('[data-sb-cue]');
  const coach = root.querySelector('[data-sb-coach]');
  const overlay = root.querySelector('[data-sb-overlay]');
  const overlayCard = root.querySelector('[data-sb-overlay-card]');
  const pad = root.querySelector('[data-sb-pad]');
  const bossbar = root.querySelector('[data-sb-bossbar]');
  const bossname = root.querySelector('[data-sb-bossname]');
  const bosshp = root.querySelector('[data-sb-bosshp]');
  const bossfill = root.querySelector('[data-sb-bossfill]');
  const finisherFlash = root.querySelector('[data-sb-finisher-flash]');
  const phaseCard = root.querySelector('[data-sb-phase-card]');
  const phaseKicker = root.querySelector('[data-sb-phase-kicker]');
  const phaseTitle = root.querySelector('[data-sb-phase-title]');
  const phaseSub = root.querySelector('[data-sb-phase-sub]');
  const comboFx = root.querySelector('[data-sb-combo-fx]');

  return {
    root,
    top,
    left,
    right,
    stage,
    targetLayer,
    cue,
    coach,
    overlay,
    overlayCard,
    pad,
    bossbar,
    bossname,
    bosshp,
    bossfill,
    finisherFlash,
    phaseCard,
    phaseKicker,
    phaseTitle,
    phaseSub,
    comboFx,

    renderHud(state, round, remainSec) {
      top.innerHTML = `
        <div><strong>${escapeHtml(round?.label || 'Ready')}</strong></div>
        <div>${escapeHtml(state.cfg.mode.toUpperCase())} • ${escapeHtml(state.cfg.intensity.toUpperCase())} • ${escapeHtml(state.cfg.body.toUpperCase())}</div>
        <div>เหลือ ${Math.max(0, remainSec)} วิ</div>
      `;

      left.innerHTML = `
        <div>Score: <strong>${state.score.total}</strong></div>
        <div>Stars: <strong>${state.score.stars}</strong></div>
        <div>Combo: <strong>${state.score.combo}</strong></div>
        <div>Acc: <strong>${Math.round(state.score.accuracy)}%</strong></div>
      `;

      right.innerHTML = `
        <div>Punches: <strong>${state.actions.totalPunches}</strong></div>
        <div>Boss: <strong>${state.boss.hp}</strong></div>
        <div>Tier: <strong>${state.exercise.estimatedTier}</strong></div>
        <div>Round: <strong>${state.session.roundIndex}</strong></div>
      `;

      const duckBtn = pad.querySelector('[data-action="duck"]');
      if (duckBtn) {
        duckBtn.disabled = state.cfg.body !== 'standing';
        duckBtn.style.opacity = state.cfg.body === 'standing' ? '1' : '.45';
      }

      this.setBossBar(state);
    },

    setStageText(text) {
      stage.innerHTML = `<div class="sb-stage-text">${escapeHtml(text || '')}</div>`;
    },

    setCue(text, tone = 'info') {
      cue.className = `sb-cue is-${tone || 'info'}`;
      cue.textContent = text || '';
    },

    setCoachText(text, tone = 'calm') {
      coach.className = `sb-coach is-${tone || 'calm'}`;
      coach.textContent = text || '';
    },

    coachMoment(text, tone = 'hype') {
      coach.className = `sb-coach is-${tone || 'hype'} is-pulse`;
      coach.textContent = text || '';
      clearTimeout(this._coachPulseTimer);
      this._coachPulseTimer = setTimeout(() => {
        if (!coach) return;
        coach.className = `sb-coach is-${tone || 'hype'}`;
      }, 420);
    },

    showComboFx(label) {
      if (!comboFx) return;
      comboFx.textContent = label || 'COMBO!';
      comboFx.classList.remove('is-on');
      void comboFx.offsetWidth;
      comboFx.classList.add('is-on');
    },

    setBossBar(state) {
      if (!bossbar || !bossfill || !bosshp || !bossname) return;

      const open = state.boss.active && state.boss.hpMax > 0;
      bossbar.dataset.open = open ? '1' : '0';
      bossbar.dataset.rage = state.boss.rage ? '1' : '0';
      bossbar.dataset.finisher = state.boss.finisher ? '1' : '0';

      if (!open) return;

      const pct = Math.max(0, Math.min(100, Math.round((state.boss.hp / Math.max(1, state.boss.hpMax)) * 100)));
      bossfill.style.width = `${pct}%`;
      bosshp.textContent = `${state.boss.hp} / ${state.boss.hpMax}`;
      bossname.textContent = state.boss.rage ? 'BOSS • RAGE' : state.boss.finisher ? 'BOSS • FINISHER' : 'BOSS';
    },

    flashFinisher() {
      if (!finisherFlash) return;
      finisherFlash.classList.remove('is-on');
      void finisherFlash.offsetWidth;
      finisherFlash.classList.add('is-on');
    },

    showPhaseCard(kicker, title, sub = '', tone = 'normal', ms = 1000) {
      if (!phaseCard || !phaseKicker || !phaseTitle || !phaseSub) return;

      phaseCard.dataset.tone = tone;
      phaseCard.dataset.open = '1';
      phaseKicker.textContent = kicker || 'PHASE';
      phaseTitle.textContent = title || '';
      phaseSub.textContent = sub || '';

      clearTimeout(this._phaseTimer);
      this._phaseTimer = setTimeout(() => {
        if (phaseCard) phaseCard.dataset.open = '0';
      }, ms);
    },

    hidePhaseCard() {
      if (!phaseCard) return;
      phaseCard.dataset.open = '0';
    },

    shake(kind = 'soft') {
      root.classList.remove('is-shake-soft', 'is-shake-hard');
      void root.offsetWidth;
      root.classList.add(kind === 'hard' ? 'is-shake-hard' : 'is-shake-soft');
    },

    showTarget(expected, roundType = 'active') {
      if (!targetLayer) return;

      const cls = targetClassForAction(expected?.action, roundType);
      const label = escapeHtml(expected?.label || 'HIT');
      const ringMs = Math.max(300, Number(expected?.expiresMs || 1100));
      const bossWeakClass = bossWeakClassForAction(expected?.action);

      targetLayer.innerHTML = `
        <div class="sb-target-lane"></div>
        <div class="sb-target ${cls}" style="--ring-ms:${ringMs}ms">
          <div class="sb-hit-zone"></div>
          <div class="sb-hit-zone-ring"></div>

          <div class="sb-target-body">
            <div class="sb-target-glow"></div>
            <div class="sb-target-core"></div>
            <div class="sb-target-hint">${label}</div>
          </div>

          ${roundType === 'boss' ? `
            <div class="sb-boss-weakpoints">
              <div class="sb-boss-wp is-top ${bossWeakClass === 'is-top' ? 'is-active' : ''}"></div>
              <div class="sb-boss-wp is-right ${bossWeakClass === 'is-right' ? 'is-active' : ''}"></div>
              <div class="sb-boss-wp is-bottom ${bossWeakClass === 'is-bottom' ? 'is-active' : ''}"></div>
              <div class="sb-boss-wp is-left ${bossWeakClass === 'is-left' ? 'is-active' : ''}"></div>
            </div>
          ` : ''}

          <div class="sb-target-label">${label}</div>
        </div>
      `;
    },

    hitTarget() {
      if (!targetLayer) return;
      const body = targetLayer.querySelector('.sb-target-body');
      const lane = targetLayer.querySelector('.sb-target-lane');
      const ring = targetLayer.querySelector('.sb-hit-zone-ring');
      if (!body) return;

      body.classList.add('sb-target-hit');
      if (lane) lane.style.opacity = '.25';
      if (ring) ring.style.opacity = '.2';

      setTimeout(() => {
        if (targetLayer) targetLayer.innerHTML = '';
      }, 180);
    },

    nearMissTarget() {
      if (!targetLayer) return;
      const body = targetLayer.querySelector('.sb-target-body');
      const lane = targetLayer.querySelector('.sb-target-lane');
      const ring = targetLayer.querySelector('.sb-hit-zone-ring');
      if (!body) return;

      body.classList.add('sb-target-near');
      if (lane) lane.style.opacity = '.18';
      if (ring) ring.style.opacity = '.18';

      setTimeout(() => {
        if (targetLayer) targetLayer.innerHTML = '';
      }, 180);
    },

    missTarget() {
      if (!targetLayer) return;
      const body = targetLayer.querySelector('.sb-target-body');
      const lane = targetLayer.querySelector('.sb-target-lane');
      const ring = targetLayer.querySelector('.sb-hit-zone-ring');
      if (!body) return;

      body.classList.add('sb-target-miss');
      if (lane) lane.style.opacity = '.14';
      if (ring) ring.style.opacity = '.14';

      setTimeout(() => {
        if (targetLayer) targetLayer.innerHTML = '';
      }, 200);
    },

    clearTarget() {
      if (!targetLayer) return;
      targetLayer.innerHTML = '';
    },

    showOverlay(html) {
      overlayCard.innerHTML = html;
      overlay.hidden = false;
    },

    hideOverlay() {
      overlay.hidden = true;
      overlayCard.innerHTML = '';
    }
  };
}

function openHelp(ui) {
  ui.showOverlay(`
    <h2 style="margin:0 0 10px">วิธีเล่น Shadow Breaker</h2>
    <div class="sb-card-grid">
      <div class="sb-mini-card">
        <strong>กดปุ่มตาม cue</strong>
        <div>เช่น JAB, CROSS, HOOK, BLOCK</div>
      </div>
      <div class="sb-mini-card">
        <strong>ถ้าต่อ VR/motion</strong>
        <div>เรียก <code>window.ShadowBreaker.submitAction('jab')</code></div>
      </div>
    </div>
    <div class="sb-actions">
      <button class="sb-btn sb-btn-primary" data-sb-close-help="1">ปิด</button>
    </div>
  `);

  const closeBtn = ui.overlay.querySelector('[data-sb-close-help="1"]');
  closeBtn.addEventListener('click', () => ui.hideOverlay(), { once: true });
}

/* ------------------------------------------------------------------ */
/* input binding */
/* ------------------------------------------------------------------ */

function bindGlobalInputs(engine) {
  const { ui, state, logger } = engine;

  ui.pad.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      consumeAction(btn.dataset.action, state, ui, logger, { source: 'pad' });
    });
  });

  const pauseBtn = ui.root.querySelector('[data-sb-pause="1"]');
  const helpBtn = ui.root.querySelector('[data-sb-help-btn="1"]');
  const exitBtn = ui.root.querySelector('[data-sb-exit="1"]');

  pauseBtn.addEventListener('click', () => {
    if (state.session.pause) setPaused(false, state, ui);
    else setPaused(true, state, ui);
  });

  helpBtn.addEventListener('click', () => openHelp(ui));
  exitBtn.addEventListener('click', () => endSession('manual_exit', state, ui, logger));

  const keyHandler = (ev) => {
    const map = {
      KeyJ: 'jab',
      KeyK: 'cross',
      KeyA: 'hook_left',
      KeyL: 'hook_right',
      KeyU: 'uppercut_left',
      KeyI: 'uppercut_right',
      KeyG: 'guard',
      KeyD: 'duck'
    };
    const action = map[ev.code];
    if (!action) return;
    consumeAction(action, state, ui, logger, { source: 'keyboard' });
  };

  const customHandler = (ev) => {
    const action = ev?.detail?.action;
    if (!action) return;
    consumeAction(action, state, ui, logger, {
      source: ev?.detail?.source || 'custom_event'
    });
  };

  const shootHandler = () => {
    consumeAction('jab', state, ui, logger, { source: 'hha:shoot' });
  };

  const beforeUnloadHandler = () => {
    persistLiveSnapshot(state);
  };

  document.addEventListener('keydown', keyHandler);
  document.addEventListener('sb:action', customHandler);
  window.addEventListener('hha:shoot', shootHandler);
  window.addEventListener('beforeunload', beforeUnloadHandler);

  engine.activeCleanup.push(() => document.removeEventListener('keydown', keyHandler));
  engine.activeCleanup.push(() => document.removeEventListener('sb:action', customHandler));
  engine.activeCleanup.push(() => window.removeEventListener('hha:shoot', shootHandler));
  engine.activeCleanup.push(() => window.removeEventListener('beforeunload', beforeUnloadHandler));
}

function setPaused(flag, state, ui) {
  state.session.pause = !!flag;
  if (state.session.pause) {
    ui.showOverlay(`
      <h2 style="margin:0 0 10px">พักเกมชั่วคราว</h2>
      <div class="sb-actions">
        <button class="sb-btn sb-btn-primary" data-sb-resume="1">เล่นต่อ</button>
      </div>
    `);
    const btn = ui.overlay.querySelector('[data-sb-resume="1"]');
    btn.addEventListener('click', () => {
      state.session.pause = false;
      ui.hideOverlay();
    }, { once: true });
    return;
  }
  ui.hideOverlay();
}

async function waitIfPaused(state) {
  while (state.session.pause && !state.session.endRequested) {
    await sleep(100);
  }
}

/* ------------------------------------------------------------------ */
/* logger */
/* ------------------------------------------------------------------ */

function createLogger(cfg) {
  const sessionId = `sb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let seq = 0;
  const queue = [];

  return {
    sessionId,
    emit(eventType, payload = {}) {
      const item = {
        sessionId,
        eventSeq: ++seq,
        eventType,
        tsMs: Date.now(),
        tsIso: new Date().toISOString(),
        pid: cfg.pid,
        studyId: cfg.studyId,
        game: 'shadowbreaker',
        zone: cfg.zone,
        styleMode: cfg.mode,
        bodyMode: cfg.body,
        intensity: cfg.intensity,
        durationMin: cfg.durationMin,
        run: cfg.run,
        view: cfg.view,
        ...payload
      };

      queue.push(item);
      persistLogQueue(sessionId, queue);

      try {
        if (window.HHA?.logger?.event) {
          window.HHA.logger.event(item.eventType, item);
        } else if (window.HHA?.emitEvent) {
          window.HHA.emitEvent(item.eventType, item);
        } else if (cfg.debug || cfg.log) {
          console.log('[SB LOG]', item);
        }
      } catch (err) {
        console.warn('[SB LOG ERROR]', err);
      }
    }
  };
}

function persistLogQueue(sessionId, queue) {
  try {
    localStorage.setItem(`SB_LOG_QUEUE_${sessionId}`, JSON.stringify(queue.slice(-400)));
  } catch (_) {}
}

/* ------------------------------------------------------------------ */
/* persistence */
/* ------------------------------------------------------------------ */

function persistBootSnapshot(cfg, state) {
  try {
    localStorage.setItem('SB_BOOT_CTX', JSON.stringify(cfg));
    localStorage.setItem('SB_LIVE_STATE', JSON.stringify({
      patch: SB_ENGINE_VERSION,
      sessionId: state.session.sessionId,
      cfg
    }));
  } catch (_) {}
}

function persistLiveSnapshot(state) {
  try {
    localStorage.setItem('SB_LIVE_STATE', JSON.stringify({
      patch: SB_ENGINE_VERSION,
      sessionId: state.session.sessionId,
      roundIndex: state.session.roundIndex,
      phase: state.session.phase,
      score: state.score,
      actions: state.actions,
      exercise: state.exercise,
      tsIso: new Date().toISOString()
    }));
  } catch (_) {}
}

function persistFinalSnapshot(summary) {
  try {
    localStorage.setItem('SB_FINAL_SUMMARY', JSON.stringify(summary));
  } catch (_) {}
}

/* ------------------------------------------------------------------ */
/* helpers */
/* ------------------------------------------------------------------ */

async function countdown(ui, state) {
  for (let i = 3; i >= 1; i--) {
    ui.setStageText(String(i));
    ui.setCue('READY', 'info');
    ui.setCoachText(i === 1 ? 'ไปกันเลย!' : 'เตรียมตัว', 'calm');
    await sleep(900);
  }
  ui.setStageText('GO!');
  ui.setCue('START', 'hit');
  state.session.phase = 'running';
  await sleep(600);
}

function nextCoachLine(round, state) {
  if (round.type === 'recovery') return 'พักหายใจลึก ๆ แล้วไปต่อ';
  if (round.type === 'warmup') return 'เริ่มช้า ๆ จับจังหวะก่อน';
  if (round.type === 'wrap') return 'ค่อย ๆ ผ่อนแรง';
  if (round.type === 'boss') return 'บอสมาแล้ว เก็บจังหวะให้ดี';

  if (state.score.accuracy < 55) return 'ช้าลงนิด แล้วเน้นให้ตรง cue';
  if (round.style === 'flow') return 'ต่อเนื่องลื่น ๆ ไม่ต้องรีบมาก';
  if (round.style === 'boxing') return 'ชัดจังหวะ ชัดหมัด';
  if (state.cfg.body === 'sitting') return 'ใช้ช่วงแขนและลำตัวให้เต็มที่';
  return 'ดีมาก รักษาจังหวะนี้ไว้';
}

function actionLabel(action) {
  return {
    jab: 'JAB',
    cross: 'CROSS',
    hook_left: 'HOOK L',
    hook_right: 'HOOK R',
    uppercut_left: 'UP L',
    uppercut_right: 'UP R',
    guard: 'BLOCK',
    duck: 'DUCK',
    slip_left: 'SLIP L',
    slip_right: 'SLIP R',
    flow_hit: 'FLOW'
  }[action] || 'HIT';
}

function targetClassForAction(action, roundType = 'active') {
  if (roundType === 'boss') return 'is-boss';

  return {
    jab: 'is-jab',
    cross: 'is-cross',
    hook_left: 'is-hook-left',
    hook_right: 'is-hook-right',
    uppercut_left: 'is-uppercut-left',
    uppercut_right: 'is-uppercut-right',
    guard: 'is-guard',
    duck: 'is-duck',
    flow_hit: 'is-flow'
  }[action] || 'is-jab';
}

function bossWeakClassForAction(action) {
  return {
    jab: 'is-top',
    cross: 'is-right',
    hook_left: 'is-left',
    hook_right: 'is-right',
    uppercut_left: 'is-bottom',
    uppercut_right: 'is-bottom',
    guard: 'is-top',
    duck: 'is-bottom',
    flow_hit: 'is-top'
  }[action] || 'is-top';
}

function getBossHp(cfg) {
  if (cfg.intensity === 'learn') return 10;
  if (cfg.intensity === 'power') return 18;
  return 14;
}

function nextBossAction(state) {
  const cycle = state.cfg.body === 'standing'
    ? ['jab', 'cross', 'hook_left', 'hook_right', 'uppercut_left', 'uppercut_right', 'guard', 'duck']
    : ['jab', 'cross', 'hook_left', 'hook_right', 'uppercut_left', 'uppercut_right', 'guard'];

  const idx = state.runtime.bossCycleIndex || 0;
  const action = cycle[idx % cycle.length];
  state.runtime.bossCycleIndex = idx + 1;
  return action;
}

function bossRageThreshold(state) {
  return Math.max(1, Math.ceil(state.boss.hpMax * 0.3));
}

function bossFinisherThreshold(state) {
  return Math.max(1, Math.ceil(state.boss.hpMax * 0.15));
}

function updateBossMood(state) {
  if (!state.boss.active) {
    state.boss.phase = 'idle';
    state.boss.rage = false;
    state.boss.finisher = false;
    return;
  }

  const rageAt = bossRageThreshold(state);
  const finishAt = bossFinisherThreshold(state);

  state.boss.finisher = state.boss.hp > 0 && state.boss.hp <= finishAt;
  state.boss.rage = state.boss.hp > finishAt && state.boss.hp <= rageAt;
  state.boss.phase = state.boss.finisher ? 'finisher' : state.boss.rage ? 'rage' : 'normal';
}

function lateGraceMs(intensity, roundType) {
  const base = intensity === 'learn' ? 180 : intensity === 'power' ? 120 : 150;
  return roundType === 'boss' ? Math.max(100, base - 20) : base;
}

function nearMissWindowMs(intensity, roundType) {
  const base = intensity === 'learn' ? 150 : intensity === 'power' ? 95 : 120;
  return roundType === 'boss' ? Math.max(80, base - 10) : base;
}

function classifyTimingJudgment(exp) {
  const delta = nowMs() - exp.hitAtMs;

  if (Math.abs(delta) <= 90) return 'perfect';
  if (delta < -90) return 'good';
  if (delta <= exp.graceLateMs) return 'late';
  return 'late';
}

function scoreForJudgment(baseScore, judgment) {
  const mul = {
    perfect: 1.25,
    good: 1.0,
    late: 0.72,
    nearMiss: 0.18
  }[judgment] || 1.0;

  return Math.max(1, Math.round(baseScore * mul));
}

function cueForJudgment(judgment) {
  return {
    perfect: 'PERFECT!',
    good: 'GOOD!',
    late: 'LATE!',
    nearMiss: 'NEAR!'
  }[judgment] || 'HIT!';
}

function toneForJudgment(judgment) {
  return judgment === 'nearMiss' ? 'near' : 'hit';
}

function isNearMissWindow(exp) {
  const t = nowMs();
  return t >= (exp.hitAtMs - exp.nearMissWindowMs) && t <= exp.finalMissAtMs;
}

function comboTierLabel(combo) {
  if (combo >= 20) return 'LEGEND COMBO';
  if (combo >= 15) return 'MEGA COMBO';
  if (combo >= 10) return 'HOT STREAK';
  if (combo >= 5) return `COMBO x${combo}`;
  if (combo >= 3) return 'NICE COMBO';
  return '';
}

function shouldShowComboFx(combo) {
  return combo === 3 || combo === 5 || combo === 10 || combo === 15 || combo === 20 || (combo > 20 && combo % 10 === 0);
}

function computeMusicState(state) {
  if (state.session.phase === 'summary') return 'summary';
  if (state.session.phase === 'boss') {
    if (state.boss.finisher) return 'boss_finisher';
    if (state.boss.rage) return 'boss_rage';
    return 'boss';
  }
  if (state.session.phase === 'warmup') return 'warmup';
  if (state.session.phase === 'recovery' || state.session.phase === 'wrap') return 'recovery';
  if (state.score.combo >= 10) return 'streak_high';
  if (state.score.combo >= 5) return 'streak_mid';
  return 'active';
}

function syncMusicState(state, logger, reason = '') {
  const key = computeMusicState(state);
  if (state.runtime.musicStateKey === key) return;

  state.runtime.musicStateKey = key;

  try {
    document.documentElement.dataset.sbMusicState = key;
    window.dispatchEvent(new CustomEvent('sb:music-state', {
      detail: {
        key,
        reason,
        phase: state.session.phase,
        bossPhase: state.boss.phase,
        combo: state.score.combo,
        intensity: state.cfg.intensity
      }
    }));
  } catch (_) {}

  logger.emit('sb_music_state', {
    musicState: key,
    reason,
    phase: state.session.phase,
    bossPhase: state.boss.phase,
    combo: state.score.combo
  });
}

function hashSeedUnit(input) {
  const s = String(input || '');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function clampNum(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function initDirectorBaseline(state, cfg, logger) {
  const u = hashSeedUnit(`${cfg.seed}|sb-director|${cfg.run}|${cfg.pid}|${cfg.studyId}`);
  let baselineWindowMul = 1;
  let baselineBossOffset = 0;

  if (cfg.adaptiveMode === 'research_locked') {
    baselineWindowMul = u < 0.33 ? 0.98 : u < 0.66 ? 1.0 : 1.02;
    baselineBossOffset = u < 0.2 ? -1 : u > 0.8 ? 1 : 0;
  }

  state.director.baselineWindowMul = baselineWindowMul;
  state.director.baselineBossOffset = baselineBossOffset;
  state.director.liveWindowMul = baselineWindowMul;
  state.director.appliedWindowMul = baselineWindowMul;
  state.director.bossHpOffset = baselineBossOffset;

  logger.emit('sb_director_init', {
    adaptiveMode: cfg.adaptiveMode,
    researchLocked: state.director.researchLocked ? 1 : 0,
    baselineWindowMul,
    baselineBossOffset
  });
}

function pushDirectorResult(state, kind) {
  const arr = state.director.recentResults;
  arr.push(kind);
  while (arr.length > 12) arr.shift();

  state.director.recentHits = arr.filter(v =>
    v === 'hit' || v === 'perfect' || v === 'good' || v === 'late'
  ).length;

  state.director.recentMisses = arr.filter(v =>
    v === 'miss' || v === 'timeout'
  ).length;
}

function computeDirectorProfile(state) {
  const d = state.director;
  const total = Math.max(1, d.recentResults.length);
  const missRate = d.recentMisses / total;
  const hitRate = d.recentHits / total;
  const combo = state.score.combo;
  const acc = state.score.accuracy;

  let level = 0;
  let trend = 'steady';
  let windowMul = d.baselineWindowMul || 1;
  let bossHpOffset = d.baselineBossOffset || 0;

  if (missRate >= 0.45 || acc < 55) {
    level = -2;
    trend = 'ease';
    windowMul *= 1.22;
    bossHpOffset -= 1;
  } else if (missRate >= 0.28 || acc < 68) {
    level = -1;
    trend = 'ease';
    windowMul *= 1.12;
    bossHpOffset += 0;
  } else if (hitRate >= 0.82 && combo >= 10 && acc >= 82) {
    level = 2;
    trend = 'push';
    windowMul *= 0.84;
    bossHpOffset += 1;
  } else if (hitRate >= 0.72 && combo >= 5 && acc >= 74) {
    level = 1;
    trend = 'push';
    windowMul *= 0.92;
    bossHpOffset += 0;
  }

  windowMul = clampNum(Number(windowMul.toFixed(2)), 0.8, 1.25);
  bossHpOffset = clampNum(Math.round(bossHpOffset), -2, 2);

  return {
    level,
    trend,
    windowMul,
    bossHpOffset,
    key: `${level}|${trend}|${windowMul}|${bossHpOffset}`
  };
}

function shouldApplyDirectorNow(state) {
  if (!state.director.researchLocked) return true;
  return state.director.recentResults.length > 0 &&
    state.director.recentResults.length % state.director.checkpointEvery === 0;
}

function maybeAnnounceDirector(ui, state) {
  const now = Date.now();
  if (now < state.director.announceCooldownMs) return;

  if (state.director.trend === 'ease') {
    state.director.announceCooldownMs = now + 9000;
    ui.coachMoment('ผ่อนให้เล็กน้อย จับ hit zone ให้ชัดก่อน', 'warn');
    return;
  }

  if (state.director.trend === 'push') {
    state.director.announceCooldownMs = now + 9000;
    ui.coachMoment('ฟอร์มดีมาก เกมจะเร่งขึ้นนิดหนึ่ง', 'hype');
  }
}

function updateDirectorFromPerformance(state, logger, ui, reason = '') {
  const profile = computeDirectorProfile(state);

  state.director.liveWindowMul = profile.windowMul;

  if (!shouldApplyDirectorNow(state)) {
    return;
  }

  if (profile.key === state.director.lastDecisionKey) {
    return;
  }

  state.director.level = profile.level;
  state.director.trend = profile.trend;
  state.director.appliedWindowMul = profile.windowMul;
  state.director.bossHpOffset = profile.bossHpOffset;
  state.director.lastDecisionKey = profile.key;
  state.director.decisionSeq += 1;

  logger.emit('sb_director_shift', {
    reason,
    decisionSeq: state.director.decisionSeq,
    adaptiveMode: state.director.mode,
    researchLocked: state.director.researchLocked ? 1 : 0,
    level: state.director.level,
    trend: state.director.trend,
    appliedWindowMul: state.director.appliedWindowMul,
    bossHpOffset: state.director.bossHpOffset,
    recentHits: state.director.recentHits,
    recentMisses: state.director.recentMisses,
    sampleSize: state.director.recentResults.length
  });

  pushResearchCheckpoint(state, reason);
  maybeAnnounceDirector(ui, state);
}

function adjustedWindowMs(state, baseMs, roundType) {
  const baseMul = state.director.appliedWindowMul || state.director.liveWindowMul || 1;
  const mul = roundType === 'boss'
    ? Math.max(0.82, Math.min(1.2, baseMul * 0.96))
    : baseMul;

  return Math.max(420, Math.round(baseMs * mul));
}

function adjustedLateGraceMs(state, baseMs, roundType) {
  const mul =
    state.director.trend === 'ease' ? 1.18 :
    state.director.trend === 'push' ? 0.9 : 1.0;

  const bossMul = roundType === 'boss' ? 0.95 : 1.0;
  return Math.max(70, Math.round(baseMs * mul * bossMul));
}

function adjustedNearMissMs(state, baseMs, roundType) {
  const mul =
    state.director.trend === 'ease' ? 1.14 :
    state.director.trend === 'push' ? 0.92 : 1.0;

  const bossMul = roundType === 'boss' ? 0.96 : 1.0;
  return Math.max(60, Math.round(baseMs * mul * bossMul));
}

function getAdaptiveBossHp(cfg, state) {
  const base = getBossHp(cfg);
  return clampNum(base + (state.director.bossHpOffset || 0), 5, 24);
}

function pushResearchCheckpoint(state, reason = '') {
  state.research.checkpoints.push({
    seq: state.director.decisionSeq || 0,
    reason,
    atMs: Date.now(),
    phase: state.session.phase,
    roundIndex: state.session.roundIndex,
    adaptiveMode: state.director.mode,
    researchLocked: state.director.researchLocked ? 1 : 0,
    level: state.director.level,
    trend: state.director.trend,
    appliedWindowMul: state.director.appliedWindowMul,
    bossHpOffset: state.director.bossHpOffset,
    recentHits: state.director.recentHits,
    recentMisses: state.director.recentMisses,
    sampleSize: state.director.recentResults.length,
    combo: state.score.combo,
    accuracy: Math.round(state.score.accuracy)
  });

  if (state.research.checkpoints.length > 64) {
    state.research.checkpoints = state.research.checkpoints.slice(-64);
  }
}

function pushBossPhaseLog(state, phase, extra = {}) {
  state.research.bossPhases.push({
    atMs: Date.now(),
    roundIndex: state.session.roundIndex,
    bossHp: state.boss.hp,
    bossHpMax: state.boss.hpMax,
    phase,
    ...extra
  });

  if (state.research.bossPhases.length > 40) {
    state.research.bossPhases = state.research.bossPhases.slice(-40);
  }
}

function judgeTotal(summary) {
  return Math.max(
    1,
    Number(summary.perfect || 0) +
    Number(summary.good || 0) +
    Number(summary.late || 0) +
    Number(summary.nearMiss || 0) +
    Number(summary.judgeMiss || 0)
  );
}

function summaryJudgeHtml(summary) {
  const total = judgeTotal(summary);

  const rows = [
    { key: 'perfect', label: 'Perfect', value: Number(summary.perfect || 0) },
    { key: 'good', label: 'Good', value: Number(summary.good || 0) },
    { key: 'late', label: 'Late', value: Number(summary.late || 0) },
    { key: 'nearMiss', label: 'Near', value: Number(summary.nearMiss || 0) },
    { key: 'judgeMiss', label: 'Miss', value: Number(summary.judgeMiss || 0) }
  ];

  return `
    <div style="margin-top:12px">
      <strong>Timing Breakdown</strong>
      <div style="display:grid; gap:8px; margin-top:8px;">
        ${rows.map(r => {
          const pct = Math.round((r.value / total) * 100);
          return `
            <div style="display:grid; gap:4px;">
              <div style="display:flex; justify-content:space-between; gap:10px; font-weight:700;">
                <span>${escapeHtml(r.label)}</span>
                <span>${r.value} • ${pct}%</span>
              </div>
              <div style="height:10px; border-radius:999px; background:#e8eef8; overflow:hidden;">
                <div style="height:100%; width:${pct}%; border-radius:999px; background:#7fb3ff;"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function summaryCoachDetails(summary) {
  const total = judgeTotal(summary);

  const perfectPct = Number(summary.perfect || 0) / total;
  const latePct = Number(summary.late || 0) / total;
  const nearPct = Number(summary.nearMiss || 0) / total;
  const missPct = Number(summary.judgeMiss || 0) / total;
  const balance = Number(summary.balancePct || 50);
  const bossClears = Number(summary.bossClears || 0);
  const ppm = Number(summary.punchesPerMin || 0);
  const acc = Number(summary.accuracy || 0);

  const lines = [];

  if (perfectPct >= 0.35) {
    lines.push('จังหวะคมมาก มีการกดตรง hit zone บ่อย');
  } else if (latePct >= 0.28) {
    lines.push('แนวโน้มกดช้ากว่าจังหวะอยู่พอสมควร ลองเริ่มขยับเร็วกว่านี้นิดหนึ่ง');
  } else if (nearPct >= 0.2) {
    lines.push('จับจังหวะเกือบได้แล้ว แต่ยังไม่ลงพอดีกับ hit zone');
  } else if (missPct >= 0.2) {
    lines.push('ยังหลุด cue อยู่บ้าง ควรลดความรีบแล้วอ่านเป้าให้ชัดขึ้น');
  } else {
    lines.push('จังหวะโดยรวมค่อนข้างดี เล่นได้ต่อเนื่อง');
  }

  if (acc >= 85) {
    lines.push('ความแม่นยำสูงมาก เหมาะกับการเพิ่มความท้าทายได้');
  } else if (acc < 60) {
    lines.push('ความแม่นยำยังต่ำ ลองใช้โหมดที่ช้าลงหรือเน้นท่าพื้นฐานก่อน');
  }

  if (ppm >= 40) {
    lines.push('ความต่อเนื่องของการออกหมัดดีมาก ได้ฟีลคาร์ดิโอชัด');
  } else if (ppm < 25) {
    lines.push('จำนวนหมัดต่อนาทียังไม่มาก รอบหน้าลองรักษาจังหวะให้ต่อเนื่องขึ้น');
  }

  if (balance <= 38) {
    lines.push('ใช้มือซ้ายเด่นกว่า ควรเร่งฝั่งขวาเพิ่มอีกนิด');
  } else if (balance >= 62) {
    lines.push('ใช้มือขวาเด่นกว่า ควรเพิ่มการสลับฝั่งซ้ายให้สมดุลขึ้น');
  } else {
    lines.push('สมดุลซ้าย-ขวาค่อนข้างดี');
  }

  if (bossClears > 0) {
    lines.push('ผ่านบอสได้ แปลว่าการอ่าน weak point ทำได้ดี');
  } else {
    lines.push('รอบหน้าลองโฟกัส weak point ของบอสให้เร็วขึ้น จะผ่านง่ายกว่าเดิม');
  }

  return lines.slice(0, 4);
}

function buildResearchBundle(state, selfReport = null) {
  const summary = buildSummaryPayload(state);

  return {
    schema: 'shadow-breaker-research-bundle/v1',
    patch: SB_ENGINE_VERSION,
    exportedAtIso: new Date().toISOString(),

    context: {
      sessionId: state.session.sessionId,
      pid: state.cfg.pid,
      nick: state.cfg.nick,
      studyId: state.cfg.studyId,
      run: state.cfg.run,
      view: state.cfg.view,
      seed: state.cfg.seed,
      mode: state.cfg.mode,
      body: state.cfg.body,
      intensity: state.cfg.intensity,
      durationMin: state.cfg.durationMin,
      diff: state.cfg.diff,
      adaptiveMode: state.director.mode
    },

    summary,

    timing: {
      perfect: state.judgments?.perfect || 0,
      good: state.judgments?.good || 0,
      late: state.judgments?.late || 0,
      nearMiss: state.judgments?.nearMiss || 0,
      miss: state.judgments?.miss || 0,
      judgeMiss: state.judgments?.miss || 0
    },

    director: {
      baselineWindowMul: state.director.baselineWindowMul,
      baselineBossOffset: state.director.baselineBossOffset,
      finalLevel: state.director.level,
      finalTrend: state.director.trend,
      appliedWindowMul: state.director.appliedWindowMul,
      bossHpOffset: state.director.bossHpOffset,
      decisionSeq: state.director.decisionSeq,
      checkpointEvery: state.director.checkpointEvery,
      researchLocked: state.director.researchLocked ? 1 : 0,
      checkpoints: structuredCloneSafe(state.research.checkpoints || [])
    },

    boss: {
      clears: state.boss.clears,
      hpMax: state.boss.hpMax,
      phaseHistory: structuredCloneSafe(state.research.bossPhases || [])
    },

    selfReport: selfReport || null
  };
}

function exportResearchBundle(state) {
  const bundle = state.research.exportBundle || buildResearchBundle(state, null);
  const filename = `shadow-breaker-research-${state.session.sessionId}.json`;

  try {
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (_) {
    return false;
  }
}

function getResearchTablesOrBuild(state) {
  if (state.research.exportTables) return state.research.exportTables;

  const bundle = state.research.exportBundle || buildResearchBundle(state, null);
  state.research.exportBundle = bundle;

  const tables = flattenResearchTables(bundle);
  state.research.exportTables = tables;
  return tables;
}

function csvCell(v) {
  if (v == null) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function rowsToCsv(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const headers = [];

  safeRows.forEach((row) => {
    Object.keys(row || {}).forEach((k) => {
      if (!headers.includes(k)) headers.push(k);
    });
  });

  if (!headers.length) return '';

  const escapeCsv = (value) => {
    const s = csvCell(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [];
  lines.push(headers.join(','));

  safeRows.forEach((row) => {
    lines.push(headers.map((h) => escapeCsv(row ? row[h] : '')).join(','));
  });

  return lines.join('\n');
}

function downloadTextFile(filename, text, mime = 'text/plain;charset=utf-8') {
  try {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
    return true;
  } catch (_) {
    return false;
  }
}

function normalizeEventRows(bundle) {
  const ctx = bundle?.context || {};
  const checkpoints = bundle?.director?.checkpoints || [];
  const bossPhases = bundle?.boss?.phaseHistory || [];

  const cpEvents = checkpoints.map((cp, idx) => ({
    session_id: ctx.sessionId || '',
    pid: ctx.pid || '',
    nick: ctx.nick || '',
    event_seq: idx + 1,
    event_type: 'adaptive_checkpoint',
    event_phase: cp.phase || '',
    round_index: cp.roundIndex || '',
    at_ms: cp.atMs || '',
    adaptive_mode: cp.adaptiveMode || '',
    research_locked: cp.researchLocked || 0,
    adaptive_level: cp.level || 0,
    adaptive_trend: cp.trend || '',
    adaptive_window_mul: cp.appliedWindowMul || '',
    boss_hp_offset: cp.bossHpOffset || '',
    recent_hits: cp.recentHits || 0,
    recent_misses: cp.recentMisses || 0,
    sample_size: cp.sampleSize || 0,
    combo: cp.combo || 0,
    accuracy: cp.accuracy || 0
  }));

  const bossEvents = bossPhases.map((bp, idx) => ({
    session_id: ctx.sessionId || '',
    pid: ctx.pid || '',
    nick: ctx.nick || '',
    event_seq: idx + 1,
    event_type: `boss_${bp.phase || 'phase'}`,
    event_phase: bp.phase || '',
    round_index: bp.roundIndex || '',
    at_ms: bp.atMs || '',
    boss_hp: bp.bossHp || '',
    boss_hp_max: bp.bossHpMax || '',
    hp_max: bp.hpMax || '',
    hp_left: bp.hpLeft || ''
  }));

  return cpEvents.concat(bossEvents).sort((a, b) => {
    const av = Number(a.at_ms || 0);
    const bv = Number(b.at_ms || 0);
    return av - bv;
  });
}

function flattenResearchTables(bundle) {
  const ctx = bundle?.context || {};
  const sum = bundle?.summary || {};
  const timing = bundle?.timing || {};
  const director = bundle?.director || {};
  const selfReport = bundle?.selfReport || null;

  const sessions = [{
    schema: bundle?.schema || '',
    patch: bundle?.patch || '',
    exported_at_iso: bundle?.exportedAtIso || '',
    session_id: ctx.sessionId || '',
    pid: ctx.pid || '',
    nick: ctx.nick || '',
    study_id: ctx.studyId || '',
    run: ctx.run || '',
    view: ctx.view || '',
    seed: ctx.seed || '',
    mode: ctx.mode || '',
    body: ctx.body || '',
    intensity: ctx.intensity || '',
    duration_min: ctx.durationMin || '',
    diff: ctx.diff || '',
    adaptive_mode: ctx.adaptiveMode || '',
    score: sum.score || 0,
    stars: sum.stars || 0,
    accuracy: sum.accuracy || 0,
    combo_max: sum.comboMax || 0,
    punches_per_min: sum.punchesPerMin || 0,
    estimated_tier: sum.estimatedTier || '',
    boss_clears: sum.bossClears || 0,
    left_hits: sum.leftHits || 0,
    right_hits: sum.rightHits || 0,
    balance_pct: sum.balancePct || 0,
    perfect: timing.perfect || 0,
    good: timing.good || 0,
    late: timing.late || 0,
    near_miss: timing.nearMiss || 0,
    judge_miss: timing.miss || timing.judgeMiss || 0,
    adaptive_level: director.finalLevel || 0,
    adaptive_trend: director.finalTrend || '',
    adaptive_window_mul: director.appliedWindowMul || 1,
    adaptive_boss_offset: director.bossHpOffset || 0,
    adaptive_decision_seq: director.decisionSeq || 0,
    baseline_window_mul: director.baselineWindowMul || 1,
    baseline_boss_offset: director.baselineBossOffset || 0
  }];

  const selfReportRows = selfReport ? [{
    session_id: ctx.sessionId || '',
    pid: ctx.pid || '',
    nick: ctx.nick || '',
    study_id: ctx.studyId || '',
    rpe: selfReport.rpe ?? '',
    enjoyment: selfReport.enjoyment ?? '',
    difficulty: selfReport.difficulty ?? '',
    pain: selfReport.pain ?? '',
    refresh: selfReport.refresh ?? ''
  }] : [];

  const adaptiveCheckpoints = (director.checkpoints || []).map((cp, idx) => ({
    session_id: ctx.sessionId || '',
    pid: ctx.pid || '',
    nick: ctx.nick || '',
    checkpoint_seq: idx + 1,
    decision_seq: cp.seq || 0,
    reason: cp.reason || '',
    at_ms: cp.atMs || '',
    phase: cp.phase || '',
    round_index: cp.roundIndex || '',
    adaptive_mode: cp.adaptiveMode || '',
    research_locked: cp.researchLocked || 0,
    level: cp.level || 0,
    trend: cp.trend || '',
    applied_window_mul: cp.appliedWindowMul || '',
    boss_hp_offset: cp.bossHpOffset || '',
    recent_hits: cp.recentHits || 0,
    recent_misses: cp.recentMisses || 0,
    sample_size: cp.sampleSize || 0,
    combo: cp.combo || 0,
    accuracy: cp.accuracy || 0
  }));

  const events = normalizeEventRows(bundle);

  return {
    sessions,
    events,
    self_report: selfReportRows,
    adaptive_checkpoints: adaptiveCheckpoints
  };
}

function exportResearchCsvTables(state) {
  const bundle = state.research.exportBundle || buildResearchBundle(state, null);
  const tables = state.research.exportTables || flattenResearchTables(bundle);
  state.research.exportBundle = bundle;
  state.research.exportTables = tables;

  const base = `shadow-breaker-${state.session.sessionId}`;

  const jobs = [
    { name: `${base}-sessions.csv`, rows: tables.sessions },
    { name: `${base}-events.csv`, rows: tables.events },
    { name: `${base}-self-report.csv`, rows: tables.self_report },
    { name: `${base}-adaptive-checkpoints.csv`, rows: tables.adaptive_checkpoints }
  ];

  let ok = false;
  jobs.forEach((job, idx) => {
    const csv = rowsToCsv(job.rows);
    setTimeout(() => {
      if (csv) downloadTextFile(job.name, csv, 'text/csv;charset=utf-8');
    }, idx * 180);
    if (csv) ok = true;
  });

  return ok;
}

function buildAppsScriptPayload(state, endpointOverride = '') {
  const tables = getResearchTablesOrBuild(state);
  const endpoint = String(endpointOverride || state.cfg.appsScriptUrl || '');

  const payload = {
    schema: 'shadow-breaker-apps-script-payload/v1',
    patch: SB_ENGINE_VERSION,
    sentAtIso: new Date().toISOString(),
    endpointHint: endpoint,
    source: 'shadowbreaker',
    context: {
      sessionId: state.session.sessionId,
      pid: state.cfg.pid,
      nick: state.cfg.nick,
      studyId: state.cfg.studyId,
      run: state.cfg.run,
      view: state.cfg.view,
      seed: state.cfg.seed,
      mode: state.cfg.mode,
      body: state.cfg.body,
      intensity: state.cfg.intensity,
      durationMin: state.cfg.durationMin,
      diff: state.cfg.diff,
      adaptiveMode: state.director.mode
    },
    sessions: structuredCloneSafe(tables.sessions || []),
    events: structuredCloneSafe(tables.events || []),
    self_report: structuredCloneSafe(tables.self_report || []),
    adaptive_checkpoints: structuredCloneSafe(tables.adaptive_checkpoints || [])
  };

  state.research.lastAppsScriptPayload = payload;

  try {
    localStorage.setItem('SB_APPS_SCRIPT_LAST_PAYLOAD', JSON.stringify(payload));
  } catch (_) {}

  return payload;
}

async function sendAppsScriptPayload(state, logger, endpointOverride = '') {
  const endpoint = String(endpointOverride || state.cfg.appsScriptUrl || '').trim();
  const payload = buildAppsScriptPayload(state, endpoint);

  if (!endpoint) {
    const out = {
      ok: false,
      error: 'NO_ENDPOINT',
      message: 'Missing Apps Script endpoint'
    };

    state.research.lastAppsScriptResult = out;

    try {
      localStorage.setItem('SB_APPS_SCRIPT_LAST_RESULT', JSON.stringify(out));
    } catch (_) {}

    logger.emit('sb_apps_script_send_error', {
      reason: 'NO_ENDPOINT'
    });

    return out;
  }

  logger.emit('sb_apps_script_send_start', {
    endpoint,
    sessions: payload.sessions.length,
    events: payload.events.length,
    selfReport: payload.self_report.length,
    checkpoints: payload.adaptive_checkpoints.length
  });

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    let text = '';
    try {
      text = await res.text();
    } catch (_) {}

    const out = {
      ok: !!res.ok,
      status: res.status,
      endpoint,
      responseText: text
    };

    state.research.lastAppsScriptResult = out;

    try {
      localStorage.setItem('SB_APPS_SCRIPT_LAST_RESULT', JSON.stringify(out));
    } catch (_) {}

    logger.emit(res.ok ? 'sb_apps_script_send_success' : 'sb_apps_script_send_error', {
      status: res.status,
      endpoint,
      ok: res.ok ? 1 : 0
    });

    return out;
  } catch (err) {
    const out = {
      ok: false,
      error: 'FETCH_ERROR',
      endpoint,
      message: String(err?.message || err || 'Unknown fetch error')
    };

    state.research.lastAppsScriptResult = out;

    try {
      localStorage.setItem('SB_APPS_SCRIPT_LAST_RESULT', JSON.stringify(out));
    } catch (_) {}

    logger.emit('sb_apps_script_send_error', {
      reason: 'FETCH_ERROR',
      endpoint,
      message: out.message
    });

    return out;
  }
}

async function playPhaseCard(ui, kicker, title, sub = '', tone = 'normal', ms = 950) {
  ui.showPhaseCard(kicker, title, sub, tone, ms);
  await sleep(Math.max(320, ms - 40));
}

function waitOverlayClick(root, selector) {
  return new Promise((resolve) => {
    const el = root.querySelector(selector);
    el.addEventListener('click', () => resolve(), { once: true });
  });
}

function waitSelfReportSubmit(root) {
  return new Promise((resolve) => {
    const form = root.querySelector('#sb-self-report-form');
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      resolve({
        rpe: Number(fd.get('rpe')),
        enjoyment: Number(fd.get('enjoyment')),
        difficulty: Number(fd.get('difficulty')),
        pain: Number(fd.get('pain')),
        refresh: Number(fd.get('refresh'))
      });
    }, { once: true });
  });
}

function createRng(seedStr) {
  let h = 1779033703 ^ String(seedStr).length;
  for (let i = 0; i < String(seedStr).length; i++) {
    h = Math.imul(h ^ String(seedStr).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = ((h ^ (h >>> 16)) >>> 0) || 1;
  return function rng() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function estimateTier(state) {
  const ppm = state.exercise.punchesPerMin || 0;
  const mode = state.cfg.intensity;

  if (mode === 'power' && ppm >= 42) return 'vigorous';
  if (ppm >= 34) return 'moderate';
  if (mode === 'learn' && ppm < 28) return 'light';
  return ppm >= 24 ? 'light-moderate' : 'light';
}

function calcStars(score, durationMin) {
  const table = {
    3: [1200, 3000, 5500],
    6: [2200, 4800, 8200],
    10: [3200, 6800, 11000]
  }[durationMin] || [1200, 3000, 5500];

  if (score >= table[2]) return 3;
  if (score >= table[1]) return 2;
  if (score >= table[0]) return 1;
  return 0;
}

function structuredCloneSafe(v) {
  try {
    return structuredClone(v);
  } catch (_) {
    return JSON.parse(JSON.stringify(v));
  }
}

function pickOne(v, allowed, fallback) {
  return allowed.includes(String(v)) ? String(v) : fallback;
}

function pickOneNum(v, allowed, fallback) {
  return allowed.includes(Number(v)) ? Number(v) : fallback;
}

function nowMs() {
  return (window.performance && performance.now) ? performance.now() : Date.now();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

function escapeAttr(s) {
  return String(s == null ? '' : s).replace(/"/g, '&quot;');
}