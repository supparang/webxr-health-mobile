// === /herohealth/shared/nutrition-router.js ===
// Shared router helpers for nutrition games
// PATCH v20260318-NUTRITION-SHARED-FULL

import { buildUrl } from './nutrition-common.js';

export function buildGameStartUrl(ctx, targetPath, extra = {}) {
  return buildUrl(targetPath, {
    ...ctx.query,

    pid: ctx.pid,
    studentId: ctx.studentId,
    studyId: ctx.studyId,
    classId: ctx.classId,
    sectionId: ctx.sectionId,
    sessionLabel: ctx.sessionLabel,

    cat: extra.cat ?? ctx.cat,
    theme: extra.theme ?? ctx.theme,
    game: extra.game ?? ctx.game,

    phase: extra.phase ?? ctx.phase,
    run: extra.run ?? ctx.run,
    mode: extra.mode ?? ctx.mode,
    diff: extra.diff ?? ctx.diff,
    time: extra.time ?? ctx.time,
    view: extra.view ?? ctx.view,
    engine: extra.engine ?? ctx.engine,

    group: extra.group ?? ctx.group,
    cohort: extra.cohort ?? ctx.cohort,
    conditionGroup: extra.conditionGroup ?? ctx.conditionGroup,

    hub: extra.hub ?? ctx.hub,
    launcher: extra.launcher ?? ctx.launcher,
    next: extra.next ?? ctx.next,
    returnTo: extra.returnTo ?? ctx.returnTo,
    gatePhase: extra.gatePhase ?? ctx.gatePhase,

    logEndpoint: extra.logEndpoint ?? ctx.logEndpoint,
    cloudMode: extra.cloudMode ?? ctx.cloudMode,

    seed: extra.seed ?? Date.now()
  });
}

export function goToGameStart(ctx, targetPath, extra = {}) {
  window.location.href = buildGameStartUrl(ctx, targetPath, extra);
}

export function restartCurrentPage(extra = {}) {
  const url = new URL(window.location.href);

  Object.entries(extra).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });

  if (!extra.seed) {
    url.searchParams.set('seed', String(Date.now()));
  }

  window.location.replace(url.toString());
}

export function redirectPreserveAll(targetPath) {
  const current = new URL(window.location.href);
  const target = new URL(targetPath, window.location.href);

  current.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });

  window.location.replace(target.toString());
}