// === /herohealth/shared/nutrition-gate.js ===
// Warmup / cooldown gate builders for nutrition games
// PATCH v20260318-NUTRITION-SHARED-FULL

import { buildUrl } from './nutrition-common.js';

export function buildWarmupGateUrl(ctx, runPath, extra = {}) {
  const gatePath = extra.gatePath || '../warmup-gate.html';

  const next = buildUrl(runPath, {
    ...ctx.query,
    cat: extra.cat ?? ctx.cat,
    theme: extra.theme ?? ctx.theme,
    game: extra.game ?? ctx.game,
    phase: extra.phase ?? 'play',
    run: extra.run ?? ctx.run,
    mode: extra.mode ?? ctx.mode,
    diff: extra.diff ?? ctx.diff,
    time: extra.time ?? ctx.time,
    view: extra.view ?? ctx.view,
    engine: extra.engine ?? ctx.engine,
    launcher: extra.launcher ?? ctx.launcher,
    returnTo: extra.returnTo ?? ctx.returnTo,
    hub: extra.hub ?? ctx.hub,
    logEndpoint: extra.logEndpoint ?? ctx.logEndpoint,
    cloudMode: extra.cloudMode ?? ctx.cloudMode,
    seed: extra.seed ?? Date.now()
  });

  return buildUrl(gatePath, {
    ...ctx.query,
    gatePhase: 'warmup',
    phase: 'warmup',
    cat: extra.cat ?? ctx.cat,
    theme: extra.theme ?? ctx.theme,
    game: extra.game ?? ctx.game,
    pid: ctx.pid,
    studentId: ctx.studentId,
    studyId: ctx.studyId,
    classId: ctx.classId,
    sectionId: ctx.sectionId,
    sessionLabel: ctx.sessionLabel,
    run: extra.run ?? ctx.run,
    mode: extra.mode ?? ctx.mode,
    diff: extra.diff ?? ctx.diff,
    time: extra.time ?? ctx.time,
    view: extra.view ?? ctx.view,
    engine: extra.engine ?? ctx.engine,
    launcher: extra.launcher ?? ctx.launcher,
    returnTo: extra.returnTo ?? ctx.returnTo,
    hub: extra.hub ?? ctx.hub,
    logEndpoint: extra.logEndpoint ?? ctx.logEndpoint,
    cloudMode: extra.cloudMode ?? ctx.cloudMode,
    next
  });
}

export function buildCooldownGateUrl(ctx, summaryPayload, extra = {}) {
  const gatePath = extra.gatePath || '../warmup-gate.html';
  const hubTarget = extra.hub ?? ctx.hub ?? '../hub.html';

  const next = buildUrl(hubTarget, {
    ...ctx.query,
    ...(extra.nextExtra || {})
  });

  return buildUrl(gatePath, {
    ...ctx.query,
    gatePhase: 'cooldown',
    phase: 'cooldown',
    cat: extra.cat ?? ctx.cat,
    theme: extra.theme ?? ctx.theme,
    game: extra.game ?? ctx.game,
    pid: ctx.pid,
    studentId: ctx.studentId,
    studyId: ctx.studyId,
    classId: ctx.classId,
    sectionId: ctx.sectionId,
    sessionLabel: ctx.sessionLabel,
    run: extra.run ?? ctx.run,
    mode: extra.mode ?? ctx.mode,
    diff: extra.diff ?? ctx.diff,
    time: extra.time ?? ctx.time,
    view: extra.view ?? ctx.view,
    engine: extra.engine ?? ctx.engine,
    launcher: extra.launcher ?? ctx.launcher,
    returnTo: extra.returnTo ?? ctx.returnTo,
    hub: hubTarget,
    logEndpoint: extra.logEndpoint ?? ctx.logEndpoint,
    cloudMode: extra.cloudMode ?? ctx.cloudMode,
    summaryKind: summaryPayload?.kind || '',
    summaryTs: summaryPayload?.ts || Date.now(),
    next
  });
}

export function goWarmupGate(ctx, runPath, extra = {}) {
  window.location.href = buildWarmupGateUrl(ctx, runPath, extra);
}

export function goCooldownGate(ctx, summaryPayload, extra = {}) {
  window.location.href = buildCooldownGateUrl(ctx, summaryPayload, extra);
}