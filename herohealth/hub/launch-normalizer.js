// === /herohealth/hub/launch-normalizer.js ===
// HHA Universal Launch Normalizer — MODULE (v20260223)
// Normalize hub->game URLs:
// ✅ inject hub backlink
// ✅ default endui=cool
// ✅ map next -> cdnext
// ✅ passthrough hub params (pid/run/diff/time/seed/...)
// ✅ deterministic daily seed for research if missing
'use strict';

export function installLaunchNormalizer(opts = {}) {
  const DOC = document;

  const config = {
    // Patterns that identify a "game URL"
    patterns: Array.isArray(opts.patterns) ? opts.patterns : [
      'goodjunk','vr-goodjunk','goodjunk-vr',
      'groups','vr-groups','groups-vr',
      'hydration','vr-hydration','hydration-vr',
      'plate','vr-plate','plate-vr',
      'handwash','vr-handwash','handwash-vr',
      'brush','vr-brush','brush-vr',
      'maskcough','mask-cough','vr-mask','mask-vr',
      'germdetective','germ-detective','vr-germ','germ-vr',
      'bath','vr-bath','bath-vr',
      'clean','cleanobjects','home-clean',
      'shadow','shadow-breaker',
      'rhythm','rhythm-boxer',
      'jumpduck','jump-duck',
      'balance','balance-hold',
      'planner','fitness-planner'
    ],

    // Hub button IDs to patch first (optional)
    ids: Array.isArray(opts.ids) ? opts.ids : [
      'goGoodJunk','goGroups','goHydration','goPlate',
      'goHandwash','goBrush','goMaskCough','goGermDetective','goBath','goClean',
      'goShadow','goRhythm','goJumpDuck','goBalance','goPlanner'
    ],

    // Params to pass through from hub -> game if missing in target URL
    pass: Array.isArray(opts.pass) ? opts.pass : [
      'pid','studyId','study','phase','cond','conditionGroup',
      'run','diff','time','seed',
      'variant','pick','theme','game',
      'api','endpoint',
      'endui'
    ],

    // defaults
    defaultDiff: String(opts.defaultDiff || 'normal'),
    defaultTime: Number(opts.defaultTime || 80),
    defaultEndui: String(opts.defaultEndui || 'cool'),

    // click intercept for buttons with data-href
    interceptButtons: (opts.interceptButtons !== false),

    // debug
    debug: !!opts.debug
  };

  const qs = (k, def = null) => {
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  };

  const clamp = (v, a, b) => {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  };

  const log = (...a) => { if (config.debug) console.log('[LaunchNormalizer]', ...a); };

  function currentHubUrl() {
    try { return new URL(location.href).toString(); }
    catch { return './hub.html'; }
  }

  function looksLikeGameUrl(href) {
    if (!href) return false;
    const s = String(href).toLowerCase();
    return config.patterns.some(p => s.includes(p));
  }

  function inferGameTag(urlObj) {
    const p = (urlObj.pathname || '').toLowerCase();
    if (p.includes('goodjunk')) return 'goodjunk';
    if (p.includes('groups')) return 'groups';
    if (p.includes('hydration')) return 'hydration';
    if (p.includes('plate')) return 'plate';
    if (p.includes('handwash')) return 'handwash';
    if (p.includes('brush')) return 'brush';
    if (p.includes('mask')) return 'maskcough';
    if (p.includes('germ')) return 'germdetective';
    if (p.includes('bath')) return 'bath';
    if (p.includes('clean')) return 'cleanobjects';
    if (p.includes('shadow')) return 'shadow';
    if (p.includes('rhythm')) return 'rhythm';
    if (p.includes('jump')) return 'jumpduck';
    if (p.includes('balance')) return 'balance';
    if (p.includes('planner')) return 'planner';
    return 'game';
  }

  function makeDailySeed(tag) {
    const pid = qs('pid', 'anon') || 'anon';
    const d = new Date();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return `${pid}|${tag || 'game'}|${day}`;
  }

  function normalizeGameUrl(rawHref) {
    if (!rawHref) return rawHref;

    try {
      const hub = currentHubUrl();
      const u = new URL(rawHref, location.href);
      const tag = inferGameTag(u);

      // 1) hub backlink
      if (!u.searchParams.get('hub')) u.searchParams.set('hub', hub);

      // 2) endui
      if (!u.searchParams.get('endui')) {
        const hubEndui = qs('endui', '');
        u.searchParams.set('endui', hubEndui || config.defaultEndui);
      }

      // 3) next -> cdnext
      const nextInLink = u.searchParams.get('next');
      if (!u.searchParams.get('cdnext') && nextInLink) {
        u.searchParams.set('cdnext', nextInLink);
      }

      // 4) pass-through params from hub
      const hubU = new URL(location.href);
      for (const k of config.pass) {
        if (u.searchParams.get(k) != null) continue;
        const v = hubU.searchParams.get(k);
        if (v != null && v !== '') u.searchParams.set(k, v);
      }

      // 5) diff/time defaults
      if (!u.searchParams.get('diff')) u.searchParams.set('diff', config.defaultDiff);
      if (!u.searchParams.get('time')) u.searchParams.set('time', String(clamp(qs('time', String(config.defaultTime)), 20, 300)));

      // 6) deterministic seed for research if missing
      const runMode = String(u.searchParams.get('run') || '').toLowerCase();
      if (runMode === 'research' && !u.searchParams.get('seed')) {
        u.searchParams.set('seed', makeDailySeed(tag));
      }

      return u.toString();
    } catch (e) {
      return rawHref;
    }
  }

  function patchEl(el) {
    if (!el) return;

    if (el.tagName === 'A') {
      const href = el.getAttribute('href') || '';
      if (looksLikeGameUrl(href)) {
        const norm = normalizeGameUrl(href);
        el.setAttribute('href', norm);
        log('patched <a>', href, '=>', norm);
      }
      return;
    }

    const dh = el.getAttribute('data-href') || '';
    if (dh && looksLikeGameUrl(dh)) {
      const norm = normalizeGameUrl(dh);
      el.setAttribute('data-href', norm);
      log('patched <button>', dh, '=>', norm);
      return;
    }
  }

  function patchAll() {
    // 1) patch known ids
    for (const id of config.ids) patchEl(DOC.getElementById(id));

    // 2) patch any anchors/buttons that look like games
    const cand = DOC.querySelectorAll('a[href], button[data-href]');
    cand.forEach(el => {
      const href = el.tagName === 'A' ? (el.getAttribute('href') || '') : (el.getAttribute('data-href') || '');
      if (looksLikeGameUrl(href)) patchEl(el);
    });
  }

  patchAll();

  // 3) intercept button clicks to ensure normalization applies even if hub uses JS
  if (config.interceptButtons) {
    DOC.addEventListener('click', (ev) => {
      const t = ev.target?.closest?.('button[data-href]');
      if (!t) return;

      const dh = t.getAttribute('data-href') || '';
      if (!looksLikeGameUrl(dh)) return;

      const url = normalizeGameUrl(dh);
      if (url) {
        ev.preventDefault();
        location.href = url;
      }
    }, { capture: true });
  }

  // Return small API for debugging/custom usage
  return {
    normalize: normalizeGameUrl,
    patchAll
  };
}