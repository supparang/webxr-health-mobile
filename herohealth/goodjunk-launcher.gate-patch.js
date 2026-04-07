// === /herohealth/goodjunk-launcher.gate-patch.js ===
// FULL PATCH v20260407a-GOODJUNK-LAUNCHER-GATE-PATCH

(function () {
  'use strict';

  let booted = false;

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

  function getSelectedMode() {
    const fromChecked =
      document.querySelector('input[name="mode"]:checked')?.value ||
      document.querySelector('input[name="playMode"]:checked')?.value ||
      document.querySelector('[data-selected-mode]')?.getAttribute('data-selected-mode') ||
      document.querySelector('[data-mode].active,[data-mode].selected')?.getAttribute('data-mode') ||
      qs('mode') ||
      qs('recommendedMode') ||
      'solo-boss';

    return String(fromChecked || 'solo-boss').trim().toLowerCase();
  }

  function resolveGoodJunkRunPath(mode) {
    switch (String(mode || '').toLowerCase()) {
      case 'solo':
      case 'solo-boss':
      case 'boss':
      case 'phaseboss':
      case 'phase-boss':
        return './goodjunk-solo-boss.html';

      case 'duet':
        return './vr-goodjunk/goodjunk-duet-play.html';

      case 'battle':
        return './vr-goodjunk/goodjunk-battle.html';

      case 'race':
        return './vr-goodjunk/goodjunk-race.html';

      case 'coop':
        return './vr-goodjunk/goodjunk-coop.html';

      default:
        return './goodjunk-solo-boss.html';
    }
  }

  async function getGateTools() {
    return import('./gate/gate-url.js');
  }

  async function buildWarmupUrl(extra = {}) {
    const mod = await getGateTools();
    const ctx = mod.readCtxFromUrl(location.href);
    const mode = clean(extra.mode, getSelectedMode());
    const runPath = clean(extra.runPath, resolveGoodJunkRunPath(mode));

    return mod.buildWarmupGateUrl(
      {
        ...ctx,
        game: 'goodjunk',
        gameId: 'goodjunk',
        theme: 'goodjunk',
        cat: 'nutrition',
        zone: 'nutrition',
        mode
      },
      runPath,
      {
        recommendedMode: mode,
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
      '[data-role="start-goodjunk"]'
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

  function refreshAnchors() {
    candidateStartSelectors().forEach((sel) => {
      $$(sel).forEach((el) => {
        patchElement(el);
      });
    });
  }

  function bindModeUpdates() {
    document.addEventListener('change', () => {
      candidateStartSelectors().forEach((sel) => {
        $$(sel).forEach((el) => {
          if (el.tagName === 'A') {
            buildWarmupUrl().then((href) => {
              el.href = href;
            }).catch(console.error);
          }
        });
      });
    });
  }

  function installMutationWatcher() {
    const obs = new MutationObserver(() => {
      refreshAnchors();
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

  function boot() {
    if (booted) return;
    booted = true;

    refreshAnchors();
    bindModeUpdates();
    installMutationWatcher();
  }

  window.HHGoodJunkLauncherGatePatch = {
    buildWarmupUrl,
    startNow,
    refreshAnchors,
    boot
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();