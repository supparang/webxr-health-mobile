import { getGoodJunkModeConfig } from './goodjunk.mode-registry.js';
import {
  installGoodJunkLegacyGlobals,
  attachGoodJunkWindowEventBridge,
  normalizeGoodJunkSummary
} from './goodjunk.bridge.js';

function pickLegacyEntry(mod, mode) {
  return (
    mod?.createGame ||
    mod?.createAdapter ||
    mod?.boot ||
    mod?.mount ||
    mod?.default ||
    (mode === 'solo' && window.createLegacyGoodJunkSolo) ||
    (mode === 'duet' && window.createLegacyGoodJunkDuet) ||
    (mode === 'race' && window.createLegacyGoodJunkRace) ||
    (mode === 'battle' && window.createLegacyGoodJunkBattle) ||
    (mode === 'coop' && window.createLegacyGoodJunkCoop) ||
    null
  );
}

function hasFn(v) {
  return typeof v === 'function';
}

export async function createGoodJunkModeAdapter(ctx, shell) {
  const modeCfg = getGoodJunkModeConfig(ctx.mode || 'solo');
  const legacyCtx = installGoodJunkLegacyGlobals(ctx, shell);

  let detachBridge = null;
  let legacyApi = null;
  let rootEl = null;

  async function bootLegacy(stage) {
    const mod = await modeCfg.loader();
    const entry = pickLegacyEntry(mod, modeCfg.id);

    if (!entry) {
      throw new Error(`GoodJunk legacy entry not found for mode: ${modeCfg.id}`);
    }

    detachBridge = attachGoodJunkWindowEventBridge(shell, ctx);

    if (hasFn(entry)) {
      const result = await entry({
        mount: stage,
        root: stage,
        ctx: legacyCtx,
        hnzs: true,
        shell,
        onScore: (patch) => {
          if (patch?.score != null) shell.setScore(Number(patch.score || 0));
          shell.emit('gj_score_cb', patch || {});
        },
        onMission: (patch) => {
          shell.setMission(Number(patch?.done || 0), Number(patch?.total || 0));
          shell.emit('gj_mission_cb', patch || {});
        },
        onEnd: (summary) => shell.endGame(normalizeGoodJunkSummary(ctx, summary || {}))
      });

      if (result && typeof result === 'object') {
        legacyApi = result;
      }
    }
  }

  function pullLegacySummary() {
    if (legacyApi && hasFn(legacyApi.getSummary)) {
      return normalizeGoodJunkSummary(ctx, legacyApi.getSummary() || {});
    }

    if (window.__GJ_LAST_SUMMARY__) {
      return normalizeGoodJunkSummary(ctx, window.__GJ_LAST_SUMMARY__);
    }

    return normalizeGoodJunkSummary(ctx, {
      mode: ctx.mode,
      score: 0,
      success: false,
      nextAction: 'ตรวจ mapping summary จาก GoodJunk เดิมอีกครั้ง'
    });
  }

  return {
    id: 'goodjunk',
    title: 'GoodJunk',
    mode: ctx.mode,

    async mount(stage) {
      rootEl = document.createElement('div');
      rootEl.className = 'gj-hnzs-root';
      rootEl.style.minHeight = '100%';
      rootEl.style.position = 'relative';
      stage.appendChild(rootEl);

      await bootLegacy(rootEl);
      shell.emit('gj_legacy_booted', { mode: ctx.mode });
    },

    async start() {
      if (legacyApi && hasFn(legacyApi.start)) {
        await legacyApi.start();
      }
    },

    async pause() {
      if (legacyApi && hasFn(legacyApi.pause)) {
        await legacyApi.pause();
      }
    },

    async resume() {
      if (legacyApi && hasFn(legacyApi.resume)) {
        await legacyApi.resume();
      }
    },

    async stop() {
      if (legacyApi && hasFn(legacyApi.stop)) {
        await legacyApi.stop();
      }
    },

    tick(timeLeft) {
      if (legacyApi && hasFn(legacyApi.tick)) {
        legacyApi.tick(timeLeft);
      }
    },

    getState() {
      if (legacyApi && hasFn(legacyApi.getState)) {
        return legacyApi.getState() || {};
      }
      return {};
    },

    getMetrics() {
      if (legacyApi && hasFn(legacyApi.getMetrics)) {
        return legacyApi.getMetrics() || {};
      }
      return {};
    },

    getSummary() {
      return pullLegacySummary();
    },

    exportResearch() {
      if (legacyApi && hasFn(legacyApi.exportResearch)) {
        return legacyApi.exportResearch() || {};
      }
      return {};
    },

    canExit() {
      if (legacyApi && hasFn(legacyApi.canExit)) {
        return !!legacyApi.canExit();
      }
      return true;
    },

    destroy() {
      try { detachBridge?.(); } catch {}
      if (legacyApi && hasFn(legacyApi.destroy)) {
        legacyApi.destroy();
      }
      if (rootEl?.parentNode) {
        rootEl.parentNode.removeChild(rootEl);
      }
    }
  };
}