/* /herohealth/vr-goodjunk/goodjunk-mp-finish.js
   Shared multiplayer finish flow for GoodJunk
   Flow: engine -> cooldown gate -> launcher
*/
(function () {
  'use strict';

  const W = window;

  if (W.GoodJunkMpFinish && typeof W.GoodJunkMpFinish.finishToCooldown === 'function') {
    return;
  }

  function qs(name, fallback = '') {
    try {
      return new URL(location.href).searchParams.get(name) ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  function clean(v, fallback = '') {
    const s = String(v ?? '').trim();
    return s || fallback;
  }

  function buildUrl(path, extra = {}, base = location.href) {
    const u = new URL(path, base);
    Object.entries(extra).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        u.searchParams.set(k, String(v));
      }
    });
    return u.toString();
  }

  function getCtx(overrides = {}) {
    return {
      mode: clean(overrides.mode, clean(qs('mode', 'solo'))),
      entry: clean(overrides.entry, clean(qs('entry', 'multi'))),
      pid: clean(overrides.pid, clean(qs('pid', 'anon'))),
      name: clean(overrides.name, clean(qs('name', qs('nick', 'Hero')))),
      nick: clean(overrides.nick, clean(qs('nick', qs('name', 'Hero')))),
      roomId: clean(overrides.roomId, clean(qs('roomId', qs('room', '')))),
      room: clean(overrides.room, clean(qs('room', qs('roomId', '')))),
      diff: clean(overrides.diff, clean(qs('diff', 'normal'))),
      time: clean(overrides.time, clean(qs('time', '90'))),
      view: clean(overrides.view, clean(qs('view', 'mobile'))),
      hub: clean(overrides.hub, clean(qs('hub', '../hub.html'))),
      run: clean(overrides.run, clean(qs('run', 'play'))),
      seed: clean(overrides.seed, clean(qs('seed', String(Date.now())))),
      zone: clean(overrides.zone, clean(qs('zone', 'nutrition'))),
      cat: clean(overrides.cat, clean(qs('cat', 'nutrition'))),
      game: clean(overrides.game, clean(qs('game', 'goodjunk'))),
      gameId: clean(overrides.gameId, clean(qs('gameId', 'goodjunk'))),
      theme: clean(overrides.theme, clean(qs('theme', 'goodjunk'))),
      studyId: clean(overrides.studyId, clean(qs('studyId', ''))),
      conditionGroup: clean(overrides.conditionGroup, clean(qs('conditionGroup', '')))
    };
  }

  function buildLauncherUrl(ctx = getCtx()) {
    return buildUrl('../goodjunk-launcher.html', {
      pid: ctx.pid,
      name: ctx.name,
      nick: ctx.nick,
      diff: ctx.diff,
      time: ctx.time,
      hub: ctx.hub,
      view: ctx.view,
      run: ctx.run,
      seed: ctx.seed,
      zone: ctx.zone,
      cat: ctx.cat,
      game: ctx.game,
      gameId: ctx.gameId,
      theme: ctx.theme,
      recommendedMode: ctx.mode,
      studyId: ctx.studyId,
      conditionGroup: ctx.conditionGroup
    });
  }

  function buildCooldownUrl(summary = {}, overrides = {}) {
    const ctx = getCtx(overrides);
    const cdnext = clean(overrides.cdnext, buildLauncherUrl(ctx));

    return buildUrl('../warmup-gate.html', {
      phase: 'cooldown',
      gatePhase: 'cooldown',
      mode: 'cooldown',
      cat: ctx.cat,
      zone: ctx.zone,
      game: ctx.game,
      pid: ctx.pid,
      name: ctx.name,
      nick: ctx.nick,
      diff: ctx.diff,
      time: ctx.time,
      view: ctx.view,
      hub: ctx.hub,
      roomId: ctx.roomId,
      room: ctx.room,
      studyId: ctx.studyId,
      conditionGroup: ctx.conditionGroup,
      run: ctx.run,
      seed: ctx.seed,
      cdnext
    }, location.href);
  }

  function saveLastSummary(summary = {}, overrides = {}) {
    const ctx = getCtx(overrides);
    const payload = {
      ts: Date.now(),
      source: 'goodjunk-mp-finish',
      mode: ctx.mode,
      phase: 'play',
      game: ctx.game,
      cat: ctx.cat,
      zone: ctx.zone,
      pid: ctx.pid,
      diff: ctx.diff,
      time: ctx.time,
      roomId: ctx.roomId,
      patch: 'goodjunk-mp-finish-r1',
      ...summary
    };

    try {
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(payload));
    } catch (_) {}

    try {
      localStorage.setItem(`HHA_LAST_SUMMARY:${ctx.game}:${ctx.pid}`, JSON.stringify(payload));
    } catch (_) {}

    try {
      localStorage.setItem(`HHA_LAST_SUMMARY:${ctx.mode}:${ctx.game}:${ctx.pid}`, JSON.stringify(payload));
    } catch (_) {}
  }

  function finishToCooldown(summary = {}, overrides = {}) {
    saveLastSummary(summary, overrides);
    const href = buildCooldownUrl(summary, overrides);
    location.href = href;
  }

  function buildDefaultSummary(extra = {}) {
    return {
      score: Number(extra.score || 0) || 0,
      scoreFinal: Number(extra.scoreFinal || extra.score || 0) || 0,
      miss: Number(extra.miss || extra.misses || 0) || 0,
      misses: Number(extra.misses || extra.miss || 0) || 0,
      accPct: Number(extra.accPct || 0) || 0,
      durationSec: Number(extra.durationSec || qs('time', '90')) || 0,
      result: clean(extra.result, 'finished'),
      endedAt: Date.now()
    };
  }

  W.GoodJunkMpFinish = {
    getCtx,
    buildLauncherUrl,
    buildCooldownUrl,
    saveLastSummary,
    buildDefaultSummary,
    finishToCooldown
  };
})();