// === C: /herohealth/vr-groups/groups-vr.boot.js ===
// GroupsVR Boot — PRODUCTION
// ✅ Auto-detect view (PC/Mobile/cVR/VR) WITHOUT overriding explicit ?view=
// ✅ Normalizes/repairs query params (run/diff/time/seed/practice/ai/hub)
// ✅ Tap-to-start compatibility: does NOT auto-start engine; it only sets body view + (optional) redirects
// ✅ Optional redirect support:
//    - If this boot is used in a "launcher wrapper" page, set window.GROUPS_VR_BOOT_TARGET = './vr-groups/groups-vr.html'
//    - Otherwise it will just set body class and return the resolved payload
//
// Usage patterns:
// A) Inside run page (vr-groups/groups-vr.html):
//    - include <script src="./groups-vr.boot.js" defer></script>
//    - boot will set body view class safely, and expose window.GROUPS_VR_BOOT_PAYLOAD
//
// B) Inside launcher page (herohealth/groups-vr.html):
//    - set window.GROUPS_VR_BOOT_TARGET = './vr-groups/groups-vr.html'
//    - include this boot; it will redirect to run page with normalized params
//
// Notes:
// - Keeps hub/log passthrough
// - Keeps unknown params passthrough (except ones we normalize)
// - Will never force a redirect if already on the target path.

(function () {
  'use strict';

  const WIN = window;
  const DOC = document;

  if (!WIN || !DOC) return;

  // Prevent double-boot
  if (WIN.__HHA_GROUPS_BOOT_LOADED__) return;
  WIN.__HHA_GROUPS_BOOT_LOADED__ = true;

  // ---------- helpers ----------
  function safeUrl() {
    try { return new URL(WIN.location.href); }
    catch { return null; }
  }

  function qs(url, k, def = null) {
    try { return url.searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function clamp(v, a, b) {
    v = Number(v);
    if (!isFinite(v)) v = a;
    return v < a ? a : (v > b ? b : v);
  }

  function normalizeRun(v) {
    v = String(v || 'play').toLowerCase();
    if (v === 'research' || v === 'study') return 'research';
    if (v === 'practice') return 'practice';
    return 'play';
  }

  function normalizeDiff(v) {
    v = String(v || 'normal').toLowerCase();
    if (v === 'easy' || v === 'normal' || v === 'hard') return v;
    return 'normal';
  }

  function normalizeView(v) {
    v = String(v || '').toLowerCase();
    if (v === 'pc' || v === 'mobile' || v === 'vr' || v === 'cvr') return v;
    return '';
  }

  function detectView() {
    // Do NOT override explicit view
    const url = safeUrl();
    const explicit = normalizeView(qs(url, 'view', ''));
    if (explicit) return explicit;

    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints | 0) > 0);
    const w = Math.max(1, WIN.innerWidth || 1);
    const h = Math.max(1, WIN.innerHeight || 1);
    const landscape = w >= h;

    // heuristic: touch + landscape + wide => cVR
    if (isTouch) {
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function setBodyView(view) {
    const b = DOC.body;
    if (!b) return;
    b.classList.remove('view-pc', 'view-mobile', 'view-vr', 'view-cvr');
    b.classList.add('view-' + view);
  }

  // keep extra params
  const RESERVED = new Set([
    'view','run','diff','time','seed','style','practice','ai','hub','log',
    'autostart','nextRun'
  ]);

  function buildPayload(url) {
    const view = detectView();

    const run = normalizeRun(qs(url, 'run', 'play'));
    const diff = normalizeDiff(qs(url, 'diff', 'normal'));
    const style = String(qs(url, 'style', 'feel') || 'feel').toLowerCase();

    // time: allow 30..180 default 90
    const time = clamp(qs(url, 'time', 90), 30, 180);

    // seed: if missing -> Date.now
    const seed = String(qs(url, 'seed', '') || Date.now());

    // practice: allow:
    // - run=practice (preferred)
    // - practice=1 (legacy)
    // - practice=15 (seconds)
    let practice = qs(url, 'practice', '');
    let practiceSec = 0;
    if (run === 'practice') {
      practiceSec = 15;
    } else if (String(practice) === '1') {
      practiceSec = 15;
    } else if (practice != null && String(practice).trim() !== '') {
      practiceSec = clamp(practice, 0, 30);
    }

    const aiRaw = String(qs(url, 'ai', '1'));
    const ai = (aiRaw !== '0' && aiRaw !== 'false');

    const hub = String(qs(url, 'hub', '') || '');
    const log = String(qs(url, 'log', '') || '');
    const nextRun = normalizeRun(qs(url, 'nextRun', 'play'));

    // passthrough other params
    const passthrough = {};
    try {
      url.searchParams.forEach((v, k) => {
        if (RESERVED.has(k)) return;
        passthrough[k] = v;
      });
    } catch (_) {}

    return {
      view,
      run,
      diff,
      style,
      time,
      seed,
      practiceSec,
      ai,
      hub,
      log,
      nextRun,
      passthrough
    };
  }

  function buildTargetUrl(targetHref, payload) {
    const out = new URL(targetHref, WIN.location.href);

    out.searchParams.set('view', payload.view);
    out.searchParams.set('run', payload.run);
    out.searchParams.set('diff', payload.diff);
    out.searchParams.set('style', payload.style);
    out.searchParams.set('time', String(payload.time));
    out.searchParams.set('seed', String(payload.seed));

    if (payload.practiceSec > 0) {
      // keep practice param for visibility; run decides practice in A
      out.searchParams.set('practice', String(payload.practiceSec === 15 ? 1 : payload.practiceSec));
      // keep nextRun so practice can chain to play
      out.searchParams.set('nextRun', payload.nextRun || 'play');
    } else {
      out.searchParams.delete('practice');
    }

    out.searchParams.set('ai', payload.ai ? '1' : '0');

    if (payload.hub) out.searchParams.set('hub', payload.hub);
    if (payload.log) out.searchParams.set('log', payload.log);

    // passthrough unknown params
    try {
      Object.keys(payload.passthrough || {}).forEach((k) => {
        out.searchParams.set(k, payload.passthrough[k]);
      });
    } catch (_) {}

    return out.toString();
  }

  function samePath(a, b) {
    try {
      const A = new URL(a, WIN.location.href);
      const B = new URL(b, WIN.location.href);
      return A.origin === B.origin && A.pathname === B.pathname;
    } catch {
      return false;
    }
  }

  // ---------- main ----------
  const url = safeUrl();
  if (!url) return;

  const payload = buildPayload(url);

  // expose payload for A (run) page or for debugging
  WIN.GROUPS_VR_BOOT_PAYLOAD = payload;

  // set body view early (safe even on launcher pages)
  // (if body not ready yet, retry once DOMContentLoaded)
  if (DOC.body) setBodyView(payload.view);
  else DOC.addEventListener('DOMContentLoaded', () => setBodyView(payload.view), { once: true });

  // optional redirect (for launcher wrapper)
  const target = String(WIN.GROUPS_VR_BOOT_TARGET || '').trim();

  // If target provided, redirect to it (unless already there)
  if (target) {
    try {
      const nextUrl = buildTargetUrl(target, payload);

      // avoid redirect loop
      if (!samePath(nextUrl, WIN.location.href)) {
        // Use replace to keep back-button clean for kids
        WIN.location.replace(nextUrl);
        return;
      }
    } catch (_) {
      // fall through
    }
  }

  // No redirect: done.
})();
