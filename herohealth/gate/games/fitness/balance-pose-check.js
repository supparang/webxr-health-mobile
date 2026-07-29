// === /herohealth/gate/games/fitness/balance-pose-check.js ===
// Legacy compatibility entry for Balance Hold.
// Balance Hold already performs its required calibration inside the game,
// therefore the external warm-up / pose-check gate must not render.

const PATCH = 'v20260729-BALANCE-DIRECT-ENTRY-R2';

function clean(value) {
  return String(value == null ? '' : value).trim();
}

function directHref(ctx) {
  const fallback = '/webxr-health-mobile/fitness/balance-hold-ar2.html';

  try {
    const raw = clean(ctx && ctx.next) || fallback;
    let url = new URL(raw, location.href);

    if (/warmup-gate\.html/i.test(url.pathname)) {
      url = new URL(fallback, location.origin);
    }

    [
      'pid', 'name', 'studentId', 'playerId', 'classId', 'section', 'group',
      'diff', 'time', 'view', 'mode', 'source', 'zone', 'cat', 'hub',
      'sheet', 'gas', 'webapp', 'api'
    ].forEach(key => {
      const value = ctx && ctx[key];
      if (value && !url.searchParams.get(key)) url.searchParams.set(key, value);
    });

    url.searchParams.set('classroom', url.searchParams.get('classroom') || '1');
    url.searchParams.set('mode', 'classroom');
    url.searchParams.set('source', url.searchParams.get('source') || 'herohealth');
    url.searchParams.set('gateBypassed', 'balance-no-warmup');
    url.searchParams.set('v', '20260729-balance-direct-r2');

    url.searchParams.delete('warmupDone');
    url.searchParams.delete('gateWarmupDone');
    url.searchParams.delete('poseCheckDone');

    return url.toString();
  } catch (_) {
    return fallback + '?classroom=1&mode=classroom&source=herohealth&gateBypassed=balance-no-warmup&v=20260729-balance-direct-r2';
  }
}

export function loadStyle() {}

export async function mount(stage, ctx) {
  const target = directHref(ctx || {});

  try {
    if (stage) stage.innerHTML = '';
  } catch (_) {}

  window.setTimeout(() => {
    location.replace(target);
  }, 0);

  return () => {};
}

export default mount;
