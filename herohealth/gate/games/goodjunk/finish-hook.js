// === /herohealth/gate/games/goodjunk/finish-hook.js ===
// FULL PATCH v20260407a-GOODJUNK-GATE-FINISH-HOOK

function clean(v, fallback = '') {
  const s = String(v ?? '').trim();
  return s || fallback;
}

function readSearch() {
  try {
    return new URLSearchParams(location.search);
  } catch {
    return new URLSearchParams();
  }
}

function abs(raw = '', fallback = '') {
  const s = clean(raw);
  if (!s) return clean(fallback);
  try {
    return new URL(s, location.href).href;
  } catch {
    return clean(fallback);
  }
}

function canonicalHubHref(qs, ctx = {}) {
  const raw = clean(qs.get('hub'), clean(ctx.hub));
  try {
    if (raw) {
      const resolved = new URL(raw, location.href).href;
      if (
        resolved.includes('/herohealth/hub.html') ||
        resolved.includes('/herohealth/hub-v2.html')
      ) {
        return resolved;
      }
    }
  } catch {}
  return new URL('../../../hub-v2.html', import.meta.url).href;
}

function modeConfig(mode = '') {
  const m = clean(mode, 'solo').toLowerCase();

  if (m === 'race') {
    return {
      mode: 'race',
      entry: 'race',
      path: new URL('../../../vr-goodjunk/goodjunk-race.html', import.meta.url).href
    };
  }

  if (m === 'battle') {
    return {
      mode: 'battle',
      entry: 'battle',
      path: new URL('../../../vr-goodjunk/goodjunk-battle.html', import.meta.url).href
    };
  }

  if (m === 'coop') {
    return {
      mode: 'coop',
      entry: 'coop',
      path: new URL('../../../vr-goodjunk/goodjunk-coop.html', import.meta.url).href
    };
  }

  return {
    mode: 'solo',
    entry: 'solo-boss',
    path: new URL('../../../goodjunk-solo-boss.html', import.meta.url).href
  };
}

function buildLauncherHref(qs, ctx = {}) {
  const u = new URL('../../../goodjunk-launcher.html', import.meta.url);

  const pid = clean(qs.get('pid'), clean(ctx.pid, 'anon'));
  const name = clean(qs.get('name'), clean(ctx.name, 'Hero'));
  const diff = clean(qs.get('diff'), clean(ctx.diff, 'normal'));
  const time = clean(qs.get('time'), clean(ctx.time, '80'));
  const view = clean(qs.get('view'), clean(ctx.view, 'mobile'));
  const hub = canonicalHubHref(qs, ctx);

  u.searchParams.set('pid', pid);
  u.searchParams.set('nick', name);
  u.searchParams.set('name', name);
  u.searchParams.set('diff', diff);
  u.searchParams.set('time', time);
  u.searchParams.set('view', view);
  u.searchParams.set('hub', hub);

  const studyId = clean(qs.get('studyId'), clean(ctx.studyId));
  if (studyId) u.searchParams.set('studyId', studyId);

  const room = clean(qs.get('room'), clean(ctx.roomId));
  if (room) u.searchParams.set('room', room);

  const conditionGroup = clean(qs.get('conditionGroup'));
  if (conditionGroup) u.searchParams.set('conditionGroup', conditionGroup);

  return u.toString();
}

function buildRunHref(qs, ctx = {}) {
  const explicitNext = abs(qs.get('next'));
  if (explicitNext) return explicitNext;

  const cfg = modeConfig(clean(qs.get('mode'), clean(ctx.mode, 'solo')));
  const u = new URL(cfg.path);

  const pid = clean(qs.get('pid'), clean(ctx.pid, 'anon'));
  const name = clean(qs.get('name'), clean(ctx.name, 'Hero'));
  const studyId = clean(qs.get('studyId'), clean(ctx.studyId));
  const diff = clean(qs.get('diff'), clean(ctx.diff, 'normal'));
  const time = clean(qs.get('time'), clean(ctx.time, '80'));
  const seed = clean(qs.get('seed'), String(Date.now()));
  const view = clean(qs.get('view'), clean(ctx.view, 'mobile'));
  const run = clean(qs.get('run'), clean(ctx.run, 'play'));
  const hub = canonicalHubHref(qs, ctx);

  u.searchParams.set('pid', pid);
  u.searchParams.set('name', name);
  u.searchParams.set('nick', name);
  u.searchParams.set('diff', diff);
  u.searchParams.set('time', time);
  u.searchParams.set('seed', seed);
  u.searchParams.set('view', view);
  u.searchParams.set('run', run);
  u.searchParams.set('hub', hub);

  u.searchParams.set('game', 'goodjunk');
  u.searchParams.set('gameId', 'goodjunk');
  u.searchParams.set('theme', 'goodjunk');
  u.searchParams.set('cat', 'nutrition');
  u.searchParams.set('zone', 'nutrition');
  u.searchParams.set('mode', cfg.mode);
  u.searchParams.set('entry', cfg.entry);

  if (cfg.mode === 'solo') {
    u.searchParams.set('phaseBoss', '1');
    u.searchParams.set('boss', '1');
  } else {
    const room = clean(qs.get('room'), clean(ctx.roomId));
    if (room) u.searchParams.set('room', room);
  }

  if (studyId) u.searchParams.set('studyId', studyId);

  const conditionGroup = clean(qs.get('conditionGroup'));
  if (conditionGroup) u.searchParams.set('conditionGroup', conditionGroup);

  const log = clean(qs.get('log'));
  if (log) u.searchParams.set('log', log);

  const ai = clean(qs.get('ai'));
  if (ai) u.searchParams.set('ai', ai);

  const pro = clean(qs.get('pro'));
  if (pro) u.searchParams.set('pro', pro);

  const research = clean(qs.get('research'));
  if (research) u.searchParams.set('research', research);

  const cdnext = clean(qs.get('cdnext'));
  if (cdnext) u.searchParams.set('cdnext', cdnext);

  return u.toString();
}

function buildCooldownNextHref(qs, ctx = {}) {
  const explicitCdNext = abs(qs.get('cdnext'));
  if (explicitCdNext) return explicitCdNext;
  return buildLauncherHref(qs, ctx);
}

export function installGoodJunkGateFinish(ctx = {}) {
  window.GoodJunkGateFinish = {
    redirectGoodJunkGateFinish({ phase = '', warmupResult = null } = {}) {
      try {
        const qs = readSearch();
        const p = clean(phase || qs.get('phase') || qs.get('gatePhase'), 'warmup').toLowerCase();

        const target =
          p === 'cooldown'
            ? buildCooldownNextHref(qs, ctx)
            : buildRunHref(qs, ctx);

        if (!target) return false;

        console.log('[GoodJunkGateFinish] redirect', {
          phase: p,
          target,
          warmupResult
        });

        location.href = target;
        return true;
      } catch (err) {
        console.warn('[GoodJunkGateFinish] redirect failed', err);
        return false;
      }
    }
  };

  return window.GoodJunkGateFinish;
}

export default installGoodJunkGateFinish;