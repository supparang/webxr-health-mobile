// /herohealth/shared/herohealth-schema.js
// HeroHealth shared schema helpers
// PATCH v20260406-schema-a

(function (W) {
  'use strict';

  const S = {};

  function rid(prefix = 'ID') {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function num(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function pct(correct, total) {
    correct = num(correct, 0);
    total = num(total, 0);
    if (!total) return 0;
    return Math.round((correct / total) * 1000) / 10;
  }

  function normalizeOutcome(summary = {}) {
    const score = num(summary.score, 0);
    const stars = num(summary.stars, 0);
    const finished = !!summary.finished;

    if (!finished) return 'incomplete';
    if (stars >= 3) return 'excellent';
    if (stars >= 2) return 'good';
    if (score > 0) return 'clear';
    return 'try-again';
  }

  function buildSessionRow(ctx = {}, summary = {}) {
    const started = num(summary.started_at_ms || ctx.started_at_ms || Date.now(), Date.now());
    const ended = num(summary.ended_at_ms || Date.now(), Date.now());
    const correct = num(summary.correct, 0);
    const wrong = num(summary.wrong, 0);
    const miss = num(summary.miss, 0);
    const total = correct + wrong + miss;

    return {
      session_id: ctx.session_id || rid('S'),
      match_id: ctx.match_id || '',
      room_id: ctx.room_id || '',
      uid: ctx.uid || '',
      pid: ctx.pid || 'anon',
      student_code: ctx.student_code || '',
      display_name: ctx.display_name || ctx.name || '',
      game: ctx.game || '',
      zone: ctx.zone || '',
      mode: ctx.mode || 'solo',
      role: ctx.role || '',
      team_id: ctx.team_id || '',
      run: ctx.run || 'play',
      diff: ctx.diff || 'normal',
      time_sec: num(ctx.time_sec, 90),
      seed: String(ctx.seed || ''),
      view: ctx.view || '',
      device_type: ctx.device_type || '',
      app_version: ctx.app_version || '',
      started_at_ms: started,
      ended_at_ms: ended,
      duration_ms: Math.max(0, ended - started),
      score: num(summary.score, 0),
      correct,
      wrong,
      miss,
      best_streak: num(summary.best_streak, 0),
      accuracy: total ? pct(correct, total) : num(summary.accuracy, 0),
      rank: summary.rank ?? '',
      stars: num(summary.stars, 0),
      medal: summary.medal || '',
      contribution: num(summary.contribution, 0),
      team_score: num(summary.team_score, 0),
      outcome: summary.outcome || normalizeOutcome(summary),
      study_id: ctx.study_id || '',
      school_code: ctx.school_code || '',
      class_room: ctx.class_room || '',
      hub: ctx.hub || '',
      referrer: ctx.referrer || document.referrer || ''
    };
  }

  function buildModeResultRow(ctx = {}, summary = {}) {
    return {
      match_id: ctx.match_id || '',
      room_id: ctx.room_id || '',
      game: ctx.game || '',
      zone: ctx.zone || '',
      mode: ctx.mode || '',
      uid: ctx.uid || '',
      pid: ctx.pid || 'anon',
      role: ctx.role || '',
      team_id: ctx.team_id || '',
      seed: String(ctx.seed || ''),
      diff: ctx.diff || 'normal',
      time_sec: num(ctx.time_sec, 90),
      score: num(summary.score, 0),
      rank: summary.rank ?? '',
      finished: !!summary.finished,
      dnf: !!summary.dnf,
      winner: !!summary.winner,
      best_streak: num(summary.best_streak, 0),
      miss: num(summary.miss, 0),
      accuracy: num(summary.accuracy, 0),
      contribution: num(summary.contribution, 0),
      team_score: num(summary.team_score, 0),
      team_goal: num(summary.team_goal, 0),
      team_progress: num(summary.team_progress, 0),
      started_at_ms: num(summary.started_at_ms || ctx.started_at_ms, 0),
      ended_at_ms: num(summary.ended_at_ms || Date.now(), 0)
    };
  }

  function buildErrorRow(ctx = {}, err, extra = {}) {
    return {
      error_id: rid('ERR'),
      session_id: ctx.session_id || '',
      match_id: ctx.match_id || '',
      room_id: ctx.room_id || '',
      uid: ctx.uid || '',
      pid: ctx.pid || 'anon',
      game: ctx.game || '',
      mode: ctx.mode || '',
      stage: extra.stage || '',
      message: err && err.message ? err.message : String(err || 'unknown error'),
      stack: err && err.stack ? err.stack : '',
      extra_json: extra || {},
      ts_ms: Date.now(),
      ts_iso: new Date().toISOString()
    };
  }

  S.rid = rid;
  S.num = num;
  S.pct = pct;
  S.buildSessionRow = buildSessionRow;
  S.buildModeResultRow = buildModeResultRow;
  S.buildErrorRow = buildErrorRow;

  W.HHA_SCHEMA = S;

})(window);
