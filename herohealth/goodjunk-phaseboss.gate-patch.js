// === /herohealth/goodjunk-phaseboss.gate-patch.js ===
// FULL PATCH v20260407a-GOODJUNK-PHASEBOSS-GATE-PATCH

(function () {
  'use strict';

  const LAST_SUMMARY_KEY = 'HHA_LAST_SUMMARY';
  const SUMMARY_HISTORY_KEY = 'HHA_SUMMARY_HISTORY';
  const MAX_HISTORY = 40;

  function clean(v, d = '') {
    v = String(v ?? '').trim();
    return v || d;
  }

  function qs(name, fallback = '') {
    try {
      return new URL(location.href).searchParams.get(name) ?? fallback;
    } catch {
      return fallback;
    }
  }

  async function getGateTools() {
    return import('./gate/gate-url.js');
  }

  function safeJsonParse(raw, fallback = null) {
    try { return JSON.parse(raw); } catch { return fallback; }
  }

  function saveSummary(payload = {}) {
    try {
      const item = {
        ts: Date.now(),
        game: 'goodjunk',
        gameId: 'goodjunk',
        phase: 'boss',
        payload
      };

      localStorage.setItem(LAST_SUMMARY_KEY, JSON.stringify(item));

      const prev = safeJsonParse(localStorage.getItem(SUMMARY_HISTORY_KEY), []);
      const arr = Array.isArray(prev) ? prev : [];
      arr.unshift(item);
      localStorage.setItem(SUMMARY_HISTORY_KEY, JSON.stringify(arr.slice(0, MAX_HISTORY)));
    } catch (err) {
      console.warn('[goodjunk-phaseboss-patch] saveSummary failed:', err);
    }
  }

  async function buildWarmupHref(extra = {}) {
    const mod = await getGateTools();
    const ctx = mod.readCtxFromUrl(location.href);

    return mod.buildWarmupGateUrl(
      {
        ...ctx,
        game: 'goodjunk',
        gameId: 'goodjunk',
        theme: 'goodjunk',
        cat: 'nutrition',
        zone: 'nutrition',
        mode: clean(ctx.mode, 'solo-boss')
      },
      './goodjunk-solo-boss.html',
      extra
    );
  }

  async function buildCooldownHref(extra = {}) {
    const mod = await getGateTools();
    const ctx = mod.readCtxFromUrl(location.href);

    return mod.buildCooldownGateUrl(
      {
        ...ctx,
        game: 'goodjunk',
        gameId: 'goodjunk',
        theme: 'goodjunk',
        cat: 'nutrition',
        zone: 'nutrition',
        mode: clean(ctx.mode, 'solo-boss')
      },
      {
        cdnext: './goodjunk-launcher.html',
        ...extra
      }
    );
  }

  async function goWarmupReplay(extra = {}) {
    location.href = await buildWarmupHref(extra);
  }

  async function goCooldown(extra = {}) {
    location.href = await buildCooldownHref(extra);
  }

  async function finishBossRun(finalPayload = {}) {
    saveSummary(finalPayload);
    await goCooldown({
      cdnext: clean(finalPayload.summaryHref, './goodjunk-launcher.html')
    });
  }

  function bindButton(el, handler) {
    if (!el || el.__hhBoundGatePatch) return;
    el.__hhBoundGatePatch = true;
    el.addEventListener('click', async (ev) => {
      ev.preventDefault();
      try {
        await handler();
      } catch (err) {
        console.error('[goodjunk-phaseboss-patch] bindButton handler failed:', err);
      }
    });
  }

  function autoBindSummaryButtons() {
    const rematchSelectors = [
      '#btnRematch',
      '#btnReplay',
      '#btnPlayAgain',
      '[data-action="rematch"]',
      '[data-role="rematch"]'
    ];

    const doneSelectors = [
      '#btnDone',
      '#btnFinish',
      '#btnHub',
      '#btnBackHub',
      '[data-action="done"]',
      '[data-action="hub"]',
      '[data-role="done"]'
    ];

    rematchSelectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        bindButton(el, () => goWarmupReplay());
      });
    });

    doneSelectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        bindButton(el, () => goCooldown({ cdnext: './goodjunk-launcher.html' }));
      });
    });
  }

  function installMutationWatcher() {
    const obs = new MutationObserver(() => {
      autoBindSummaryButtons();
    });

    obs.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'style']
    });
  }

  function boot() {
    autoBindSummaryButtons();
    installMutationWatcher();
  }

  window.HHGoodJunkGatePatch = {
    buildWarmupHref,
    buildCooldownHref,
    goWarmupReplay,
    goCooldown,
    finishBossRun,
    saveSummary,
    autoBindSummaryButtons,
    boot
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();