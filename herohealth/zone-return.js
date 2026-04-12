export function qget(searchParams, key, fallback = '') {
  const v = searchParams.get(key);
  return v == null || v === '' ? fallback : v;
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
    'pid', 'name', 'nickName', 'studyId',
    'run', 'diff', 'view', 'time', 'seed',
    'debug', 'api', 'log',
    'studentKey', 'schoolCode', 'classRoom', 'studentNo',
    'conditionGroup', 'sessionNo', 'weekNo', 'teacher', 'grade'
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

  // backward compatibility:
  // old pages still read "hub" as the place to return to
  params.set('hub', zoneReturn);

  // new standard params
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

export function patchAnchorHref(anchorEl, href, onBeforeNavigate) {
  if (!anchorEl) return;
  anchorEl.href = href;

  if (!anchorEl.__zoneReturnBound && typeof onBeforeNavigate === 'function') {
    anchorEl.__zoneReturnBound = true;
    anchorEl.addEventListener('click', onBeforeNavigate);
  }
}

export function rememberZoneGame({
  zone,
  gameKey,
  gameTitle = ''
}) {
  const z = String(zone || '').trim().toUpperCase();
  const recentKey = `HHA_LAST_GAME_BY_ZONE_${z}`;
  const playedKey = `HHA_ZONE_PLAYED_${z}`;
  const dailyKey = `HHA_ZONE_DAILY_${z}`;

  try {
    localStorage.setItem('HHA_LAST_ZONE', String(zone || '').trim().toLowerCase());
  } catch (_) {}

  try {
    localStorage.setItem(recentKey, JSON.stringify({
      key: gameKey,
      title: gameTitle || gameKey,
      at: Date.now()
    }));
  } catch (_) {}

  try {
    const played = JSON.parse(localStorage.getItem(playedKey) || '[]');
    if (Array.isArray(played) && !played.includes(gameKey)) {
      played.push(gameKey);
      localStorage.setItem(playedKey, JSON.stringify(played));
    }
  } catch (_) {}

  try {
    const d = new Date();
    const day =
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const daily = JSON.parse(localStorage.getItem(dailyKey) || '{}');
    const row = daily[day] || { count: 0, lastKey: '' };
    row.count += 1;
    row.lastKey = gameKey;
    daily[day] = row;

    localStorage.setItem(dailyKey, JSON.stringify(daily));
  } catch (_) {}
}