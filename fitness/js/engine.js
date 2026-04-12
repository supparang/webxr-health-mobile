// === /fitness/js/engine.js ===
// Shadow Breaker engine
// PATCH v20260411a-SB-ENGINE-CTX-SESSION-SUMMARY

'use strict';

const SB_ENGINE_VERSION = 'v20260411a-SB-ENGINE-CTX-SESSION-SUMMARY';
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
      closeOverlay: () => ui.hideOverlay()
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
      reasonEnded: '',
      overlayLock: false
    },
    cfg,
    runtime: {
      currentExpected: null,
      roundStartMs: 0,
      roundEndMs: 0,
      lastActionAt: 0,
      actionHistory: [],
      frameHandle: 0
    },
    score: {
      total: 0,
      stars: 0,
      combo: 0,
      comboMax: 0,
      accuracy: 100
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
      clears: 0
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
      <strong>${cfg.nick}</strong> • ${cfg.mode.toUpperCase()} • ${cfg.body.toUpperCase()} • ${cfg.intensity.toUpperCase()} • ${cfg.durationMin} นาที
    </p>

    <div class="sb-card-grid">
      <div class="sb-mini-card">
        <strong>วิธีเล่น</strong>
        <div>กดปุ่มล่างจอ หรือส่ง action จาก motion/VR input</div>
      </div>
      <div class="sb-mini-card">
        <strong>โหมดปัจจุบัน</strong>
        <div>${cfg.mode} / ${cfg.body} / ${cfg.intensity}</div>
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

  logger.emit('sb_session_start', {
    phase: 'countdown'
  });

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

  ui.setStageText(round.type === 'boss' ? 'Boss Phase' : `${round.label} Round`);
  ui.setCoachText(nextCoachLine(round, state));
  ui.setCue(round.type === 'recovery' ? 'BREATHE' : 'READY', 'info');
  ui.renderHud(state, round, Math.ceil(round.sec));

  logger.emit(round.type === 'boss' ? 'sb_boss_start' : 'sb_round_start', {
    roundIndex: round.index,
    roundType: round.type,
    roundStyle: round.style,
    roundSec: round.sec
  });

  if (round.type === 'warmup' || round.type === 'recovery' || round.type === 'wrap') {
    await runPassiveRound(engine, round);
    return;
  }

  if (round.type === 'boss') {
    state.boss.active = true;
  }

  const actions = buildRoundActions(round, state.cfg, rng);
  state.boss.hpMax = round.type === 'boss' ? actions.length : 0;
  state.boss.hp = state.boss.hpMax;

  while (nowMs() < state.runtime.roundEndMs) {
    if (state.session.endRequested || engine.ended) return;
    await waitIfPaused(state);

    const remainSec = Math.max(0, Math.ceil((state.runtime.roundEndMs - nowMs()) / 1000));
    maybeSpawnExpected(state, ui, logger, round, actions);
    maybeTimeoutExpected(state, ui, logger);

    state.exercise.activeMs += 80;
    if (round.type === 'boss') {
      state.boss.hp = calcBossHpFromActions(actions, state);
    }

    ui.renderHud(state, round, remainSec);
    await sleep(80);
  }

  state.runtime.currentExpected = null;
  state.boss.active = false;
  ui.setCue('ผ่านรอบแล้ว!', 'hit');
  ui.setCoachText(round.type === 'boss' ? 'เก่งมาก! ผ่านบอสแล้ว' : 'ดีมาก ไปต่อรอบหน้า');
  if (round.type === 'boss') {
    state.boss.clears += 1;
    state.boss.hp = 0;
    logger.emit('sb_boss_clear', { roundIndex: round.index });
  }
  await sleep(800);
}

async function runPassiveRound(engine, round) {
  const { state, ui } = engine;

  while (nowMs() < state.runtime.roundEndMs) {
    if (state.session.endRequested || engine.ended) return;
    await waitIfPaused(state);

    const remainSec = Math.max(0, Math.ceil((state.runtime.roundEndMs - nowMs()) / 1000));

    if (round.type === 'warmup') state.exercise.warmupMs += 80;
    if (round.type === 'recovery') state.exercise.recoveryMs += 80;
    if (round.type === 'wrap') state.exercise.wrapMs += 80;

    ui.renderHud(state, round, remainSec);
    await sleep(80);
  }

  ui.setCue('', 'info');
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
  next.expiresAtMs = next.spawnAtMs + next.expiresMs;
  state.runtime.currentExpected = next;

  ui.setCue(next.label, 'info');
  ui.setStageText(round.type === 'boss' ? 'Boss Phase' : `${round.label} Round`);
  logger.emit('sb_target_spawn', {
    roundIndex: round.index,
    actionType: next.action,
    scoreValue: next.scoreValue
  });
}

function maybeTimeoutExpected(state, ui, logger) {
  const exp = state.runtime.currentExpected;
  if (!exp) return;
  if (nowMs() <= exp.expiresAtMs) return;

  state.actions.miss += 1;
  state.actions.timeoutMiss += 1;
  state.score.combo = 0;
  updateAccuracy(state);

  logger.emit('sb_target_timeout', {
    actionType: exp.action,
    roundIndex: state.session.roundIndex
  });

  state.runtime.currentExpected = null;
  ui.setCue('MISS', 'miss');
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
  state.score.total += exp.scoreValue;
  state.score.combo += 1;
  state.score.comboMax = Math.max(state.score.comboMax, state.score.combo);
  state.score.stars = calcStars(state.score.total, state.cfg.durationMin);

  countHandSide(action, state);
  updateAccuracy(state);

  logger.emit('sb_target_hit', {
    actionType: action,
    expectedType: exp.action,
    scoreDelta: exp.scoreValue,
    combo: state.score.combo,
    source: meta.source || 'manual',
    roundIndex: state.session.roundIndex
  });

  state.runtime.currentExpected = null;
  ui.setCue('HIT!', 'hit');
}

function registerMiss(action, exp, state, ui, logger, meta) {
  state.actions.miss += 1;
  state.score.combo = 0;
  updateAccuracy(state);

  logger.emit('sb_target_miss', {
    actionType: action,
    expectedType: exp.action,
    source: meta.source || 'manual',
    roundIndex: state.session.roundIndex
  });

  ui.setCue('MISS', 'miss');
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
  if (lrTotal > 0) {
    state.exercise.balancePct = Math.round((state.exercise.leftHits / lrTotal) * 100);
  } else {
    state.exercise.balancePct = 50;
  }
}

function calcBossHpFromActions(actions, state) {
  const hitCount = actions.filter(a => a.spawned).length - state.actions.timeoutMiss;
  const resolved = Math.max(0, hitCount - state.actions.freeAction);
  return Math.max(0, actions.length - resolved);
}

/* ------------------------------------------------------------------ */
/* summary / finish */
/* ------------------------------------------------------------------ */

async function completeSession(engine, reason = 'natural_end') {
  const { state, ui, logger, cfg } = engine;
  if (engine.ended) return;

  engine.ended = true;
  state.session.endRequested = true;
  state.session.reasonEnded = reason;
  state.session.endedAt = Date.now();

  finalizeMetrics(state);

  logger.emit('sb_summary_prepare', {
    reason,
    score: state.score.total,
    stars: state.score.stars
  });

  const summary = buildSummaryPayload(state);
  const selfReport = await openSummaryFlow(ui, summary, logger);
  const saved = saveSummary(summary, selfReport);

  state.summary = saved;

  logger.emit('sb_session_end', {
    reason,
    score: saved.score,
    stars: saved.stars,
    estimatedTier: saved.estimatedTier
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
    startedAt: state.session.startedAt,
    endedAt: state.session.endedAt,
    createdAtIso: new Date().toISOString()
  };
}

async function openSummaryFlow(ui, summary, logger) {
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
    </div>

    <div style="margin-top:12px">
      <strong>Quick Coach</strong>
      <p style="margin:8px 0 0">${escapeHtml(summaryCoachText(summary))}</p>
    </div>

    <div class="sb-actions">
      <button class="sb-btn sb-btn-primary" data-sb-go-report="1">ต่อไป</button>
    </div>
  `);

  logger.emit('sb_summary_open', {
    score: summary.score,
    stars: summary.stars,
    estimatedTier: summary.estimatedTier
  });

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
  if (summary.accuracy >= 80 && summary.punchesPerMin >= 35) {
    return 'จังหวะดีมาก เล่นต่อเนื่องและอยู่ในโซนที่ดี';
  }
  if (summary.accuracy < 60) {
    return 'รอบหน้าลองช้าลงนิด แล้วตาม cue ให้ชัดก่อน';
  }
  if (summary.punchesPerMin < 28) {
    return 'รอบหน้าลองเพิ่มความต่อเนื่องอีกนิด จะได้ความฟิตชัดขึ้น';
  }
  return 'ทำได้ดีแล้ว รอบหน้าลอง Mixed หรือ Power เพื่อเพิ่มความท้าทาย';
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
        background:
          radial-gradient(circle at top, #182847 0%, #0b1427 56%, #050913 100%);
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
      .sb-stage{
        position:absolute;
        inset:0;
        display:grid;
        place-items:center;
        padding:108px 16px 176px;
        text-align:center;
      }
      .sb-stage-text{
        font-size:clamp(22px,4vw,44px);
        font-weight:800;
        opacity:.96;
        text-shadow:0 0 26px rgba(130,200,255,.18);
      }
      .sb-countdown{
        font-size:clamp(64px,18vw,140px);
        font-weight:900;
        text-shadow:0 0 24px rgba(130,200,255,.45);
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
      .sb-coach{
        position:absolute;
        left:50%;
        transform:translateX(-50%);
        bottom:84px;
        font-size:14px;
        opacity:.95;
        background:rgba(14,24,46,.62);
        padding:8px 12px;
        border-radius:999px;
        z-index:10;
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
      }
    </style>

    <div class="sb-tools">
      <button class="sb-tool-btn" data-sb-pause="1">Pause</button>
      <button class="sb-tool-btn" data-sb-help-btn="1">Help</button>
      <button class="sb-tool-btn" data-sb-exit="1">Exit</button>
    </div>

    <div class="sb-hud sb-top" data-sb-top></div>
    <div class="sb-hud sb-left" data-sb-left></div>
    <div class="sb-hud sb-right" data-sb-right></div>

    <div class="sb-stage" data-sb-stage><div class="sb-stage-text">Shadow Breaker</div></div>
    <div class="sb-cue is-info" data-sb-cue></div>
    <div class="sb-coach" data-sb-coach></div>

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
  const cue = root.querySelector('[data-sb-cue]');
  const coach = root.querySelector('[data-sb-coach]');
  const overlay = root.querySelector('[data-sb-overlay]');
  const overlayCard = root.querySelector('[data-sb-overlay-card]');
  const pad = root.querySelector('[data-sb-pad]');

  return {
    root,
    top,
    left,
    right,
    stage,
    cue,
    coach,
    overlay,
    overlayCard,
    pad,

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
    },

    setStageText(text) {
      stage.innerHTML = `<div class="sb-stage-text">${escapeHtml(text || '')}</div>`;
    },

    setCue(text, tone = 'info') {
      cue.className = `sb-cue is-${tone || 'info'}`;
      cue.textContent = text || '';
    },

    setCoachText(text) {
      coach.textContent = text || '';
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
    if (state.session.pause) {
      setPaused(false, state, ui);
    } else {
      setPaused(true, state, ui);
    }
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
    ui.setCoachText(i === 1 ? 'ไปกันเลย!' : 'เตรียมตัว');
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