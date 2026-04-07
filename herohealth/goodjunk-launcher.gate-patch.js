// === /herohealth/goodjunk-launcher.gate-patch.js ===
// FULL PATCH v20260407b-GOODJUNK-LAUNCHER-GATE-PATCH

(function () {
  'use strict';

  let booted = false;
  let gateToolsPromise = null;

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function $$(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function qs(name, fallback = '') {
    try {
      return new URL(location.href).searchParams.get(name) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function clean(v, d = '') {
    v = String(v ?? '').trim();
    return v || d;
  }

  function getGateTools() {
    if (!gateToolsPromise) {
      gateToolsPromise = import('./gate/gate-url.js');
    }
    return gateToolsPromise;
  }

  function normalizeMode(v = '') {
    const raw = String(v || '').trim().toLowerCase();

    if (
      raw === 'solo' ||
      raw === 'solo-boss' ||
      raw === 'boss' ||
      raw === 'phaseboss' ||
      raw === 'phase-boss'
    ) return 'solo';

    if (raw === 'duet') return 'duet';
    if (raw === 'battle') return 'battle';
    if (raw === 'race') return 'race';
    if (raw === 'coop') return 'coop';

    return 'solo';
  }

  function getSelectedMode() {
    const byChecked =
      document.querySelector('input[name="mode"]:checked')?.value ||
      document.querySelector('input[name="playMode"]:checked')?.value ||
      document.querySelector('[data-selected-mode]')?.getAttribute('data-selected-mode') ||
      document.querySelector('[data-mode].active,[data-mode].selected')?.getAttribute('data-mode') ||
      qs('mode') ||
      qs('recommendedMode') ||
      'solo-boss';

    return normalizeMode(byChecked);
  }

  function resolveGoodJunkRunPath(mode) {
    switch (normalizeMode(mode)) {
      case 'duet':
        return './vr-goodjunk/goodjunk-duet-play.html';

      case 'battle':
        return './vr-goodjunk/goodjunk-battle.html';

      case 'race':
        return './vr-goodjunk/goodjunk-race.html';

      case 'coop':
        return './vr-goodjunk/goodjunk-coop.html';

      case 'solo':
      default:
        return './goodjunk-solo-boss.html';
    }
  }

  function resolveEntryLabel(mode) {
    switch (normalizeMode(mode)) {
      case 'duet': return 'duet';
      case 'battle': return 'battle';
      case 'race': return 'race';
      case 'coop': return 'coop';
      case 'solo':
      default:
        return 'solo-boss';
    }
  }

  async function buildWarmupUrl(extra = {}) {
    const mod = await getGateTools();
    const ctx = mod.readCtxFromUrl(location.href);

    const mode = normalizeMode(clean(extra.mode, getSelectedMode()));
    const runPath = clean(extra.runPath, resolveGoodJunkRunPath(mode));
    const entry = resolveEntryLabel(mode);

    return mod.buildWarmupGateUrl(
      {
        ...ctx,
        pid: clean(extra.pid, ctx.pid || 'anon'),
        name: clean(extra.name, ctx.name || 'Hero'),
        studyId: clean(extra.studyId, ctx.studyId || ''),
        diff: clean(extra.diff, ctx.diff || 'normal'),
        time: clean(extra.time, ctx.time || '90'),
        seed: clean(extra.seed, ctx.seed || String(Date.now())),
        hub: clean(extra.hub, ctx.hub || new URL('./hub-v2.html', location.href).toString()),
        view: clean(extra.view, ctx.view || 'mobile'),
        run: clean(extra.run, ctx.run || 'play'),
        game: 'goodjunk',
        gameId: 'goodjunk',
        theme: 'goodjunk',
        cat: 'nutrition',
        zone: 'nutrition',
        mode
      },
      runPath,
      {
        entry,
        phaseBoss: mode === 'solo' ? '1' : '',
        boss: mode === 'solo' ? '1' : '',
        recommendedMode: entry,
        debug: qs('debug') === '1' ? '1' : '',
        ...extra
      }
    );
  }

  function candidateStartSelectors() {
    return [
      '#btnStart',
      '#btnPlay',
      '#btnPlayNow',
      '#soloBossBtn',
      '#startBtn',
      '.btn-start',
      '.play-btn',
      '[data-action="start-goodjunk"]',
      '[data-role="start-goodjunk"]',
      '[data-action="play-goodjunk"]',
      '[data-goodjunk-start]'
    ];
  }

  function patchElement(el) {
    if (!el || el.__hhGJGatePatched) return;
    el.__hhGJGatePatched = true;

    async function nav(ev) {
      if (ev) ev.preventDefault();
      const href = await buildWarmupUrl();
      location.href = href;
    }

    if (el.tagName === 'A') {
      buildWarmupUrl().then((href) => {
        el.href = href;
      }).catch(console.error);

      el.addEventListener('click', nav);
      return;
    }

    el.addEventListener('click', nav);
  }

  function patchAllStartButtons() {
    candidateStartSelectors().forEach((sel) => {
      $$(sel).forEach((el) => patchElement(el));
    });
  }

  function patchZoneQuickButtons() {
    const map = [
      { sel: '#btnSolo', mode: 'solo' },
      { sel: '#btnSoloBoss', mode: 'solo' },
      { sel: '#btnDuet', mode: 'duet' },
      { sel: '#btnBattle', mode: 'battle' },
      { sel: '#btnRace', mode: 'race' },
      { sel: '#btnCoop', mode: 'coop' },
      { sel: '[data-mode-launch="solo"]', mode: 'solo' },
      { sel: '[data-mode-launch="duet"]', mode: 'duet' },
      { sel: '[data-mode-launch="battle"]', mode: 'battle' },
      { sel: '[data-mode-launch="race"]', mode: 'race' },
      { sel: '[data-mode-launch="coop"]', mode: 'coop' }
    ];

    map.forEach(({ sel, mode }) => {
      $$(sel).forEach((el) => {
        if (el.__hhGJGatePatchedMode) return;
        el.__hhGJGatePatchedMode = true;

        const bindHandler = async (ev) => {
          ev.preventDefault();
          const href = await buildWarmupUrl({ mode });
          location.href = href;
        };

        if (el.tagName === 'A') {
          buildWarmupUrl({ mode }).then((href) => {
            el.href = href;
          }).catch(console.error);
        }

        el.addEventListener('click', bindHandler);
      });
    });
  }

  function syncAnchorHrefs() {
    candidateStartSelectors().forEach((sel) => {
      $$(sel).forEach((el) => {
        if (el.tagName === 'A') {
          buildWarmupUrl().then((href) => {
            el.href = href;
          }).catch(console.error);
        }
      });
    });

    const modeAnchors = [
      { sel: '#btnSolo, #btnSoloBoss, [data-mode-launch="solo"]', mode: 'solo' },
      { sel: '#btnDuet, [data-mode-launch="duet"]', mode: 'duet' },
      { sel: '#btnBattle, [data-mode-launch="battle"]', mode: 'battle' },
      { sel: '#btnRace, [data-mode-launch="race"]', mode: 'race' },
      { sel: '#btnCoop, [data-mode-launch="coop"]', mode: 'coop' }
    ];

    modeAnchors.forEach(({ sel, mode }) => {
      $$(sel).forEach((el) => {
        if (el.tagName === 'A') {
          buildWarmupUrl({ mode }).then((href) => {
            el.href = href;
          }).catch(console.error);
        }
      });
    });
  }

  function bindModeUpdates() {
    document.addEventListener('change', (ev) => {
      const t = ev.target;
      if (!t) return;

      if (
        t.matches('input[name="mode"]') ||
        t.matches('input[name="playMode"]') ||
        t.matches('select[name="mode"]') ||
        t.matches('select[name="playMode"]')
      ) {
        syncAnchorHrefs();
      }
    });
  }

  function installMutationWatcher() {
    const obs = new MutationObserver(() => {
      patchAllStartButtons();
      patchZoneQuickButtons();
      syncAnchorHrefs();
    });

    obs.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'data-mode', 'data-selected-mode', 'href']
    });
  }

  async function startNow(extra = {}) {
    location.href = await buildWarmupUrl(extra);
  }

  function exposeApi() {
    window.HHGoodJunkLauncherGatePatch = {
      buildWarmupUrl,
      startNow,
      patchAllStartButtons,
      boot
    };
  }

  function boot() {
    if (booted) return;
    booted = true;

    patchAllStartButtons();
    patchZoneQuickButtons();
    syncAnchorHrefs();
    bindModeUpdates();
    installMutationWatcher();
    exposeApi();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();