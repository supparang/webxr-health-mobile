(function () {
  'use strict';

  const W = window;
  if (W.GJ_MP_END && W.GJ_MP_END.__ready) return;

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

  function num(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function pickNum(...vals) {
    for (const v of vals) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return 0;
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

  function mode() {
    return clean(qs('mode', 'solo')).toLowerCase();
  }

  function isMp() {
    return ['duet', 'race', 'battle', 'coop'].includes(mode());
  }

  function ctx() {
    return {
      mode: mode(),
      entry: clean(qs('entry', 'multi')),
      pid: clean(qs('pid', 'anon')),
      name: clean(qs('name', qs('nick', 'Hero'))),
      nick: clean(qs('nick', qs('name', 'Hero'))),
      roomId: clean(qs('roomId', qs('room', ''))),
      room: clean(qs('room', qs('roomId', ''))),
      diff: clean(qs('diff', 'normal')),
      time: clean(qs('time', '90')),
      view: clean(qs('view', 'mobile')),
      hub: clean(qs('hub', '../hub.html')),
      run: clean(qs('run', 'play')),
      seed: clean(qs('seed', String(Date.now()))),
      zone: clean(qs('zone', 'nutrition')),
      cat: clean(qs('cat', 'nutrition')),
      game: clean(qs('game', 'goodjunk')),
      gameId: clean(qs('gameId', 'goodjunk')),
      theme: clean(qs('theme', 'goodjunk')),
      studyId: clean(qs('studyId', '')),
      conditionGroup: clean(qs('conditionGroup', '')),
      cdnext: clean(qs('cdnext', ''))
    };
  }

  function launcherUrl(custom = {}) {
    const c = { ...ctx(), ...custom };
    return buildUrl('../goodjunk-launcher.html', {
      pid: c.pid,
      name: c.name,
      nick: c.nick,
      diff: c.diff,
      time: c.time,
      hub: c.hub,
      view: c.view,
      run: c.run,
      seed: c.seed,
      zone: c.zone,
      cat: c.cat,
      game: c.game,
      gameId: c.gameId,
      theme: c.theme,
      recommendedMode: c.mode || 'solo',
      studyId: c.studyId,
      conditionGroup: c.conditionGroup
    });
  }

  function cooldownUrl(summary = {}, custom = {}) {
    const c = { ...ctx(), ...custom };
    const cdnext = c.cdnext || launcherUrl(c);

    return buildUrl('../warmup-gate.html', {
      phase: 'cooldown',
      gatePhase: 'cooldown',
      mode: 'cooldown',
      cat: c.cat,
      zone: c.zone,
      game: c.game,
      pid: c.pid,
      name: c.name,
      nick: c.nick,
      diff: c.diff,
      time: c.time,
      view: c.view,
      hub: c.hub,
      roomId: c.roomId,
      room: c.roomId,
      run: c.run,
      seed: c.seed,
      studyId: c.studyId,
      conditionGroup: c.conditionGroup,
      cdnext
    });
  }

  function readStateSummary() {
    const S =
      W.state ||
      W.STATE ||
      W.gameState ||
      W.GJ_STATE ||
      W.__STATE__ ||
      {};

    const score = pickNum(
      S.scoreFinal,
      S.score,
      S.totalScore,
      S.teamScore,
      W.scoreFinal,
      W.score
    );

    const misses = pickNum(
      S.misses,
      S.miss,
      S.totalMiss,
      W.misses,
      W.miss
    );

    const accPct = pickNum(
      S.accPct,
      S.accuracy,
      S.acc,
      W.accPct,
      W.accuracy
    );

    const durationSec = pickNum(
      S.durationSec,
      S.timeSec,
      S.time,
      qs('time', '90'),
      90
    );

    return {
      score,
      scoreFinal: score,
      miss: misses,
      misses,
      accPct,
      durationSec
    };
  }

  function buildSummary(extra = {}) {
    const base = readStateSummary();
    return {
      score: num(extra.score, base.score),
      scoreFinal: num(extra.scoreFinal, base.scoreFinal),
      miss: num(extra.miss, base.miss),
      misses: num(extra.misses, base.misses),
      accPct: num(extra.accPct, base.accPct),
      durationSec: num(extra.durationSec, base.durationSec || 90),
      result: clean(extra.result, 'finished'),
      endedAt: Date.now(),
      mode: mode()
    };
  }

  function saveLastSummary(summary = {}, custom = {}) {
    const c = { ...ctx(), ...custom };
    const payload = {
      ts: Date.now(),
      source: 'goodjunk-vr-mp-bridge',
      mode: c.mode,
      game: c.game,
      cat: c.cat,
      zone: c.zone,
      pid: c.pid,
      roomId: c.roomId,
      diff: c.diff,
      time: c.time,
      ...summary
    };

    try {
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(payload));
    } catch (_) {}

    try {
      localStorage.setItem(`HHA_LAST_SUMMARY:${c.game}:${c.pid}`, JSON.stringify(payload));
    } catch (_) {}

    try {
      localStorage.setItem(`HHA_LAST_SUMMARY:${c.mode}:${c.game}:${c.pid}`, JSON.stringify(payload));
    } catch (_) {}
  }

  function finish(extra = {}, custom = {}) {
    if (W.__GJ_MP_BRIDGE_FINISHED__) return;
    W.__GJ_MP_BRIDGE_FINISHED__ = true;

    const summary = buildSummary(extra);
    saveLastSummary(summary, custom);

    if (
      isMp() &&
      W.GoodJunkMpFinish &&
      typeof W.GoodJunkMpFinish.finishToCooldown === 'function'
    ) {
      W.GoodJunkMpFinish.finishToCooldown(summary, custom);
      return;
    }

    location.href = launcherUrl(custom);
  }

  function win(extra = {}) {
    finish({ ...extra, result: 'win' });
  }

  function lose(extra = {}) {
    finish({ ...extra, result: 'lose' });
  }

  function clear(extra = {}) {
    finish({ ...extra, result: 'clear' });
  }

  function teamClear(extra = {}) {
    finish({ ...extra, result: 'team-clear' });
  }

  function looksLikeExitTarget(el) {
    if (!el) return false;

    const text = String(el.textContent || '').trim().toLowerCase();
    const href = String((el.getAttribute && el.getAttribute('href')) || '').toLowerCase();
    const cls = String(el.className || '').toLowerCase();
    const action = String(el.dataset?.action || '').toLowerCase();

    return (
      action.includes('done') ||
      action.includes('finish') ||
      action.includes('back') ||
      action.includes('hub') ||
      action.includes('lobby') ||
      cls.includes('done') ||
      cls.includes('finish') ||
      cls.includes('back') ||
      cls.includes('hub') ||
      cls.includes('lobby') ||
      text.includes('done') ||
      text.includes('finish') ||
      text.includes('back') ||
      text.includes('hub') ||
      text.includes('lobby') ||
      text.includes('launcher') ||
      text.includes('summary') ||
      text.includes('กลับ') ||
      text.includes('เสร็จ') ||
      text.includes('จบ') ||
      href.includes('hub.html') ||
      href.includes('hub-v2.html') ||
      href.includes('goodjunk-launcher.html')
    );
  }

  function patchExitClicks() {
    document.addEventListener('click', function (ev) {
      if (!isMp()) return;

      const el = ev.target && ev.target.closest
        ? ev.target.closest('button,a')
        : null;

      if (!looksLikeExitTarget(el)) return;

      ev.preventDefault();
      ev.stopPropagation();
      finish({ result: 'finished' });
    }, true);
  }

  function patchHistoryBack() {
    const rawBack = history.back.bind(history);
    history.back = function () {
      if (isMp()) {
        finish({ result: 'finished' });
        return;
      }
      return rawBack();
    };
  }

  function patchCommonFunctions() {
    const names = [
      'goHub',
      'goLauncher',
      'backToHub',
      'backToLauncher',
      'finishGame',
      'endGame',
      'completeGame',
      'showResultAndExit'
    ];

    names.forEach((name) => {
      const fn = W[name];
      if (typeof fn !== 'function') return;

      W[name] = function patchedCommonExit() {
        if (isMp()) {
          finish({ result: 'finished' });
          return;
        }
        return fn.apply(this, arguments);
      };
    });
  }

  function patchAlertSignals() {
    const rawAlert = W.alert ? W.alert.bind(W) : null;
    if (!rawAlert) return;

    W.alert = function patchedAlert(msg) {
      const text = String(msg || '').toLowerCase();

      const looksLikeGameEnd =
        text.includes('game over') ||
        text.includes('mission complete') ||
        text.includes('victory') ||
        text.includes('finished') ||
        text.includes('ชนะ') ||
        text.includes('แพ้') ||
        text.includes('จบเกม');

      const out = rawAlert(msg);

      if (isMp() && looksLikeGameEnd && !W.__GJ_MP_BRIDGE_FINISHED__) {
        setTimeout(() => finish({ result: 'finished' }), 250);
      }

      return out;
    };
  }

  function markReady() {
    W.GJ_MP_END = {
      __ready: true,
      ctx,
      launcherUrl,
      cooldownUrl,
      buildSummary,
      saveLastSummary,
      finish,
      win,
      lose,
      clear,
      teamClear
    };
  }

  patchExitClicks();
  patchHistoryBack();
  patchCommonFunctions();
  patchAlertSignals();
  markReady();
})();