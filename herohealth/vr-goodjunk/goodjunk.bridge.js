function esc(v) {
  return String(v == null ? '' : v);
}

export function makeLegacyGoodJunkConfig(ctx) {
  return {
    pid: esc(ctx.pid || 'anon'),
    name: esc(ctx.name || ''),
    studyId: esc(ctx.studyId || ''),
    zone: 'nutrition',
    cat: 'nutrition',
    game: 'goodjunk',
    gameId: 'goodjunk',
    mode: esc(ctx.mode || 'solo'),
    diff: esc(ctx.diff || 'normal'),
    time: Number(ctx.time || 90),
    seed: esc(ctx.seed || Date.now()),
    hub: esc(ctx.hub || ''),
    view: esc(ctx.view || 'mobile'),
    run: esc(ctx.run || 'play'),
    roomId: esc(ctx.roomId || ''),
    matchId: esc(ctx.matchId || ''),
    api: esc(ctx.api || ''),
    log: esc(ctx.log || ''),
    debug: Number(ctx.debug || 0)
  };
}

export function installGoodJunkLegacyGlobals(ctx, shell) {
  const cfg = makeLegacyGoodJunkConfig(ctx);

  window.__GJ_RUN_CTX__ = {
    ...cfg,
    onScore(patch = {}) {
      if (patch.score != null) shell.setScore(Number(patch.score || 0));
      shell.emit('gj_score', patch);
    },
    onMission(patch = {}) {
      shell.setMission(Number(patch.done || 0), Number(patch.total || 0));
      shell.emit('gj_mission', patch);
    },
    onMetrics(patch = {}) {
      if (patch.score != null) shell.setScore(Number(patch.score || 0));
      if (patch.done != null || patch.total != null) {
        shell.setMission(Number(patch.done || 0), Number(patch.total || 0));
      }
      shell.emit('gj_metrics', patch);
    },
    onEnd(summary = {}) {
      shell.endGame(summary);
    }
  };

  return cfg;
}

export function attachGoodJunkWindowEventBridge(shell) {
  const listeners = [];

  function on(type, handler) {
    const wrapped = (ev) => handler(ev?.detail || {});
    window.addEventListener(type, wrapped);
    listeners.push(() => window.removeEventListener(type, wrapped));
  }

  on('hha:score', (detail) => {
    if (detail?.score != null) shell.setScore(Number(detail.score || 0));
    shell.emit('gj_hha_score', detail);
  });

  on('quest:update', (detail) => {
    shell.setMission(Number(detail?.done || 0), Number(detail?.total || 0));
    shell.emit('gj_quest_update', detail);
  });

  on('hha:summary', (detail) => {
    shell.emit('gj_summary_event', detail);
  });

  on('hha:end', (detail) => {
    shell.endGame(detail || {});
  });

  return () => {
    listeners.splice(0).forEach((off) => {
      try { off(); } catch {}
    });
  };
}

export function normalizeGoodJunkSummary(ctx, raw = {}) {
  const mode = String(raw.mode || ctx.mode || 'solo');
  const success = !!raw.success || !!raw.win || !!raw.cleared;

  const summary = {
    gameId: 'goodjunk',
    gameTitle: 'GoodJunk',
    zone: 'nutrition',
    mode,
    score: Number(raw.score || 0),
    stars: Number(raw.stars || (success ? 3 : 1)),
    accuracy: Number(raw.accuracy || 0),
    miss: Number(raw.miss || 0),
    bestStreak: Number(raw.bestStreak || raw.streakBest || 0),
    durationSec: Number(raw.durationSec || ctx.time || 0),
    rank: raw.rank || '',
    success,
    missionClear: Number(raw.missionClear || raw.done || 0),
    missionTotal: Number(raw.missionTotal || raw.total || 0),
    contribution: Number(raw.contribution || 0),
    playerResult: raw.playerResult || null,
    opponentResult: raw.opponentResult || null,
    teamResult: raw.teamResult || null,
    badges: Array.isArray(raw.badges) ? raw.badges : [],
    rewards: Array.isArray(raw.rewards) ? raw.rewards : [],
    coachFeedback: Array.isArray(raw.coachFeedback) ? raw.coachFeedback : [],
    nextAction: raw.nextAction || '',
    metrics: raw.metrics || {},
    research: raw.research || {}
  };

  if (mode === 'battle' && !summary.opponentResult && raw.opponent) {
    summary.opponentResult = raw.opponent;
  }

  if ((mode === 'coop' || mode === 'duet') && !summary.teamResult && raw.team) {
    summary.teamResult = raw.team;
  }

  return summary;
}