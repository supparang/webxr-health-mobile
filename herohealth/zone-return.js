export function qget(searchParams, key, fallback = '') {
  const v = searchParams.get(key);
  return (v == null || v === '') ? fallback : v;
}

export function setParamIfValue(params, key, value) {
  if (value == null || value === '') return;
  params.set(key, String(value));
}

export function buildHubRoot(searchParams, currentHref) {
  return qget(
    searchParams,
    'hubRoot',
    qget(searchParams, 'hub', new URL('./hub-v2.html', currentHref).toString())
  );
}

export function buildZoneReturnUrl(currentHref) {
  return new URL(currentHref).toString();
}

export function applyZoneReturnParams({
  searchParams,
  params,
  zone,
  currentHref
}) {
  const hubRoot = buildHubRoot(searchParams, currentHref);
  const zoneReturn = buildZoneReturnUrl(currentHref);

  const passKeys = [
    'pid','name','nickName','studyId',
    'run','diff','view','time','seed',
    'debug','api','log',
    'studentKey','schoolCode','classRoom','studentNo',
    'conditionGroup','sessionNo','weekNo','teacher','grade'
  ];

  passKeys.forEach((k) => {
    const v = searchParams.get(k);
    if (v != null && v !== '') params.set(k, v);
  });

  if (!params.get('pid')) params.set('pid', 'anon');
  if (!params.get('name')) params.set('name', qget(searchParams, 'nickName', 'Hero'));
  if (!params.get('diff')) params.set('diff', 'normal');
  if (!params.get('view')) params.set('view', 'mobile');
  if (!params.get('time')) params.set('time', '90');
  if (!params.get('seed')) params.set('seed', String(Date.now()));

  params.set('zone', zone);
  params.set('cat', zone);

  params.set('hubRoot', hubRoot);
  params.set('hub', zoneReturn);
  params.set('zoneReturn', zoneReturn);
  params.set('next', zoneReturn);

  return {
    params,
    hubRoot,
    zoneReturn
  };
}

export function buildZoneGameUrl({
  basePath,
  searchParams,
  zone,
  gameKey,
  currentHref,
  overrides = {}
}) {
  const url = new URL(basePath, currentHref);
  const params = new URLSearchParams();

  applyZoneReturnParams({
    searchParams,
    params,
    zone,
    currentHref
  });

  params.set('game', gameKey);
  params.set('gameId', gameKey);
  params.set('theme', gameKey);

  Object.keys(overrides).forEach((k) => {
    params.set(k, String(overrides[k]));
  });

  url.search = params.toString();
  return url.toString();
}