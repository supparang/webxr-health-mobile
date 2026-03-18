// === /goodjunk-intervention/research/schema.js ===
// PAYLOAD BUILDERS
// PATCH v20260318a-GJI-SCHEMA

import { APP_CONFIG } from './config.js';
import { loadCtx } from './localstore.js';

export function buildBasePayload(extra = {}) {
  const ctx = loadCtx();
  return {
    appId: APP_CONFIG.appId,
    version: APP_CONFIG.version,
    savedAt: new Date().toISOString(),
    ...ctx,
    ...extra,
  };
}

export function buildGameSummaryPayload(summary = {}) {
  return buildBasePayload({
    type: 'game_summary',
    ...summary,
  });
}

export function buildAssessmentPayload(pageName, answers = {}) {
  return buildBasePayload({
    type: 'assessment',
    page: pageName,
    answers,
  });
}

export function buildParentPayload(answers = {}) {
  return buildBasePayload({
    type: 'parent',
    answers,
  });
}