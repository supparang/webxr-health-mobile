// === /herohealth/goodjunk-launcher.gate-patch.js ===
// FULL PATCH v20260430-GOODJUNK-LAUNCHER-NO-BOSS-MULTI-ROUTE
// ✅ Solo เท่านั้นที่เข้า GoodJunk Solo Boss
// ✅ duet / race / battle / coop เข้า lobby ของตัวเอง
// ✅ multiplayer บังคับ phaseBoss/boss/soloBoss/bossMode = 0
// ✅ ป้องกัน extra พา multiplayer กลับไป solo boss
// ✅ ยังใช้ warmup-gate ตามมาตรฐาน HeroHealth

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
    if (raw === 'race') return 'race';
    if (raw === 'battle') return 'battle';
    if (raw === 'coop' || raw === 'co-op') return 'coop';

    return 'solo';
  }

  function isMultiMode(mode) {
    return ['duet', 'race', 'battle', 'coop'].includes(normalizeMode(mode));
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
        return './vr-goodjunk/goodjunk-duet-lobby.html';

      case 'race':
        return './vr-goodjunk/goodjunk-race-lobby.html';

      case 'battle':
        return './vr-goodjunk/goodjunk-battle-lobby.html';

      case 'coop':
        return './vr-goodjunk/goodjunk-coop-lobby.html';

      case 'solo':
      default:
        return './goodjunk-solo-boss.html';
    }
  }

  function resolveEntryLabel(mode) {
    switch (normalizeMode(mode)) {
      case 'duet':
        return 'duet';
      case 'race':
        return 'race';
      case 'battle':
        return 'battle';
      case 'coop':
        return 'coop';
      case 'solo':
      default:
        return 'solo-boss';
    }
  }

  function removeBossKeysForMulti(obj, mode, entry) {
    const out = Object.assign({}, obj || {});

    if (isMultiMode(mode)) {
      out.mode = normalizeMode(mode);
      out.entry = entry;
      out.recommendedMode = entry;

      out.phaseBoss = '0';
      out.boss = '0';
      out.soloBoss = '0';
      out.bossMode = '0';

      out.phase = '';
      out.bossPhase = '';
      out.bossId = '';
      out.bossName = '';
    }

    return out;
  }

  async function buildWarmupUrl(extra = {}) {
    const mod = await getGateTools();
    const ctx = mod.readCtxFromUrl(location.href);

    const mode = normalizeMode(clean(extra.mode, getSelectedMode()));
    const runPath = clean(extra.runPath, resolveGoodJunkRunPath(mode));
    const entry = resolveEntryLabel(mode);
    const multi = isMultiMode(mode);

    const safeExtra = removeBossKeysForMulti(extra, mode, entry);

    const baseCtx = {
      ...ctx,
      pid: clean(safeExtra.pid, ctx.pid || 'anon'),
      name: clean(safeExtra.name, ctx.name || ctx.nick || 'Hero'),
      nick: clean(safeExtra.nick, safeExtra.name || ctx.nick || ctx.name || 'Hero'),
      studyId: clean(safeExtra.studyId, ctx.studyId || ''),
      diff: clean(safeExtra.diff, ctx.diff || 'normal'),
      time: clean(safeExtra.time, ctx.time || '150'),
      seed: clean(safeExtra.seed, ctx.seed || String(Date.now())),
      hub: clean(safeExtra.hub, ctx.hub || new URL('./hub-v2.html', location.href).toString()),
      view: clean(safeExtra.view, ctx.view || 'mobile'),
      run: clean(safeExtra.run, ctx.run || 'play'),
      game: 'goodjunk',
      gameId: 'goodjunk',
      theme: 'goodjunk',
      cat: 'nutrition',
      zone: 'nutrition',
      mode
    };

    const routeExtra = {
      entry,
      phaseBoss: mode === 'solo' ? '1' : '0',
      boss: mode === 'solo' ? '1' : '0',
      soloBoss: mode === 'solo' ? '1' : '0',
      bossMode: mode === 'solo' ? '1' : '0',
      recommendedMode: entry,
      multiplayer: multi ? '1' : '0',
      debug: qs('debug') === '1' ? '1' : '',
      ...safeExtra
    };

    if (multi) {
      routeExtra.phaseBoss = '0';
      routeExtra.boss = '0';
      routeExtra.soloBoss = '0';
      routeExtra.bossMode = '0';
      routeExtra.entry = entry;
      routeExtra.recommendedMode = entry;
      routeExtra.mode = mode;
      routeExtra.multiplayer = '1';

      delete routeExtra.phase;
      delete routeExtra.bossPhase;
      delete routeExtra.bossId;
      delete routeExtra.bossName;
    }

    return mod.buildWarmupGateUrl(
      baseCtx,
      runPath,
      routeExtra
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
      { sel: '#btnRace', mode: 'race' },
      { sel: '#btnBattle', mode: 'battle' },
      { sel: '#btnCoop', mode: 'coop' },

      { sel: '[data-mode-launch="solo"]', mode: 'solo' },
      { sel: '[data-mode-launch="solo-boss"]', mode: 'solo' },
      { sel: '[data-mode-launch="duet"]', mode: 'duet' },
      { sel: '[data-mode-launch="race"]', mode: 'race' },
      { sel: '[data-mode-launch="battle"]', mode: 'battle' },
      { sel: '[data-mode-launch="coop"]', mode: 'coop' },

      { sel: '[data-mode="solo"]', mode: 'solo' },
      { sel: '[data-mode="solo-boss"]', mode: 'solo' },
      { sel: '[data-mode="duet"]', mode: 'duet' },
      { sel: '[data-mode="race"]', mode: 'race' },
      { sel: '[data-mode="battle"]', mode: 'battle' },
      { sel: '[data-mode="coop"]', mode: 'coop' }
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
      { sel: '#btnSolo, #btnSoloBoss, [data-mode-launch="solo"], [data-mode-launch="solo-boss"]', mode: 'solo' },
      { sel: '#btnDuet, [data-mode-launch="duet"]', mode: 'duet' },
      { sel: '#btnRace, [data-mode-launch="race"]', mode: 'race' },
      { sel: '#btnBattle, [data-mode-launch="battle"]', mode: 'battle' },
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

    document.addEventListener('click', (ev) => {
      const t = ev.target && ev.target.closest
        ? ev.target.closest('[data-mode],[data-mode-launch]')
        : null;

      if (!t) return;

      const mode = normalizeMode(t.getAttribute('data-mode-launch') || t.getAttribute('data-mode') || '');
      if (!mode) return;

      document.documentElement.setAttribute('data-goodjunk-mode', mode);
      syncAnchorHrefs();
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
      attributeFilter: ['class', 'data-mode', 'data-selected-mode', 'href', 'data-mode-launch']
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
      patchZoneQuickButtons,
      normalizeMode,
      resolveGoodJunkRunPath,
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