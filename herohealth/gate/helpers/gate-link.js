// === /herohealth/gate/helpers/gate-link.js ===
// Shared helpers for linking main game -> gate cooldown / warmup

function safeUrl(value, fallback, baseHref){
  try{
    if(!value || value === '...') return new URL(fallback, baseHref).toString();
    return new URL(value, baseHref).toString();
  }catch(_){
    return new URL(fallback, baseHref).toString();
  }
}

function getParam(name, fallback=''){
  try{
    const u = new URL(location.href);
    const v = u.searchParams.get(name);
    return v == null ? fallback : v;
  }catch(_){
    return fallback;
  }
}

export function buildGateUrl({
  gatePhase = 'cooldown',
  cat = 'hygiene',
  game = '',
  theme = '',
  pid = '',
  hub = '',
  next = '',
  run = '',
  diff = '',
  time = '',
  view = '',
  seed = '',
  extras = {}
} = {}){
  const gateUrl = new URL('../warmup-gate.html', location.href);

  gateUrl.searchParams.set('gatePhase', gatePhase);
  gateUrl.searchParams.set('phase', gatePhase);
  gateUrl.searchParams.set('cat', cat);
  gateUrl.searchParams.set('game', game || theme);
  gateUrl.searchParams.set('theme', theme || game);

  if(pid) gateUrl.searchParams.set('pid', pid);
  if(hub) gateUrl.searchParams.set('hub', hub);
  if(next) gateUrl.searchParams.set('next', next);
  if(run) gateUrl.searchParams.set('run', run);
  if(diff) gateUrl.searchParams.set('diff', diff);
  if(time !== '' && time != null) gateUrl.searchParams.set('time', String(time));
  if(view) gateUrl.searchParams.set('view', view);
  if(seed !== '' && seed != null) gateUrl.searchParams.set('seed', String(seed));

  Object.entries(extras || {}).forEach(([k,v])=>{
    if(v == null || v === '') return;
    gateUrl.searchParams.set(k, String(v));
  });

  return gateUrl.toString();
}

export function buildCooldownUrlForCurrentGame({
  cat = 'hygiene',
  game,
  theme,
  fallbackHub = '../hub.html',
  extras = {}
} = {}){
  const pid  = getParam('pid', 'anon');
  const run  = getParam('run', 'play');
  const diff = getParam('diff', 'normal');
  const time = getParam('time', '80');
  const view = getParam('view', 'mobile');
  const seed = getParam('seed', String(Date.now()));
  const hub  = safeUrl(getParam('hub', fallbackHub), fallbackHub, location.href);

  return buildGateUrl({
    gatePhase: 'cooldown',
    cat,
    game,
    theme: theme || game,
    pid,
    hub,
    run,
    diff,
    time,
    view,
    seed,
    extras
  });
}

export function goToCooldownForCurrentGame(opts={}){
  location.href = buildCooldownUrlForCurrentGame(opts);
}
