(function () {
  'use strict';

  const W = window;
  const D = document;

  const GLOBAL_HOOKS = W.__GJ_HNZS_HOOKS__ || null;
  const GLOBAL_CTX = GLOBAL_HOOKS?.ctx || W.__GJ_RUN_CTX__ || {};

  const state = {
    mode: 'solo',

    score: 0,
    miss: 0,
    bestStreak: 0,
    streak: 0,

    done: 0,
    total: 0,

    ended: false,
    started: false,
    destroyed: false,
    paused: false,

    summary: null
  };

  let mountRoot = null;
  let gameRoot = null;
  let activeCtx = GLOBAL_CTX || {};
  let activeHooks = GLOBAL_HOOKS || {};
  let usingDemoFallback = false;
  let legacyCoreApi = null;

  function safeCall(fn, arg) {
    try {
      if (typeof fn === 'function') fn(arg);
    } catch (err) {
      console.warn(err);
    }
  }

  function getHooks() {
    return activeHooks || GLOBAL_HOOKS || {};
  }

  function getCtx() {
    return activeCtx || GLOBAL_CTX || {};
  }

  function dispatchWindowEvent(name, detail) {
    try {
      W.dispatchEvent(new CustomEvent(name, { detail }));
    } catch {}
  }

  function emitScore(extra = {}) {
    const patch = {
      mode: 'solo',
      score: state.score,
      miss: state.miss,
      bestStreak: state.bestStreak,
      streak: state.streak,
      ...extra
    };

    safeCall(getHooks().onScore, patch);
    dispatchWindowEvent('hha:score', patch);
    dispatchWindowEvent('gj:score', patch);
  }

  function emitMission(extra = {}) {
    const patch = {
      mode: 'solo',
      done: state.done,
      total: state.total,
      ...extra
    };

    safeCall(getHooks().onMission, patch);
    dispatchWindowEvent('quest:update', patch);
    dispatchWindowEvent('gj:goal', patch);
  }

  function emitMetrics(extra = {}) {
    const patch = {
      mode: 'solo',
      score: state.score,
      miss: state.miss,
      bestStreak: state.bestStreak,
      streak: state.streak,
      done: state.done,
      total: state.total,
      paused: state.paused,
      started: state.started,
      ...extra
    };

    safeCall(getHooks().onMetrics, patch);
  }

  function normalizeEndSummary(summary = {}) {
    return {
      mode: 'solo',
      success: !!summary.success,
      score: Number(summary.score ?? state.score ?? 0),
      stars: Number(summary.stars ?? (summary.success ? 3 : 1)),
      accuracy: Number(summary.accuracy ?? 0),
      miss: Number(summary.miss ?? state.miss ?? 0),
      bestStreak: Number(summary.bestStreak ?? state.bestStreak ?? 0),
      missionClear: Number(summary.missionClear ?? state.done ?? 0),
      missionTotal: Number(summary.missionTotal ?? state.total ?? 0),
      rewards: Array.isArray(summary.rewards) ? summary.rewards : [],
      coachFeedback: Array.isArray(summary.coachFeedback) ? summary.coachFeedback : [],
      nextAction: summary.nextAction || '',
      metrics: summary.metrics || {}
    };
  }

  function emitEnd(summary = {}) {
    if (state.ended) return;
    state.ended = true;

    const normalized = normalizeEndSummary(summary);
    state.summary = normalized;
    W.__GJ_LAST_SUMMARY__ = normalized;

    safeCall(getHooks().onEnd, normalized);
    dispatchWindowEvent('hha:end', normalized);
    dispatchWindowEvent('gj:end', normalized);
  }

  function setScore(nextScore) {
    state.score = Number(nextScore || 0);
    emitScore();
  }

  function patchScore(delta) {
    setScore(Number(state.score || 0) + Number(delta || 0));
  }

  function setMiss(nextMiss) {
    state.miss = Number(nextMiss || 0);
    emitMetrics();
  }

  function setBestStreak(nextBest) {
    state.bestStreak = Math.max(Number(state.bestStreak || 0), Number(nextBest || 0));
    emitMetrics();
  }

  function setMission(done, total) {
    state.done = Number(done || 0);
    state.total = Number(total || 0);
    emitMission();
  }

  function resolveMount(mount) {
    return mount || getHooks().mount || D.getElementById('gameMount') || D.body;
  }

  function renderShell(root) {
    root.innerHTML = `
      <div class="gj-solo-legacy-root" style="position:relative;min-height:100%;width:100%"></div>
    `;
    return root.querySelector('.gj-solo-legacy-root');
  }

  function showStatus(text) {
    const el = gameRoot?.querySelector('[data-role="status"]');
    if (el) el.textContent = String(text || '');
  }

  function updateHud() {
    const scoreEl = gameRoot?.querySelector('[data-role="score"]');
    const missionEl = gameRoot?.querySelector('[data-role="mission"]');
    const streakEl = gameRoot?.querySelector('[data-role="streak"]');

    if (scoreEl) scoreEl.textContent = `Score ${state.score}`;
    if (missionEl) missionEl.textContent = `${state.done}/${state.total}`;
    if (streakEl) streakEl.textContent = `Best ${state.bestStreak}`;
  }

  function buildSummary() {
    const accuracy = state.done + state.miss > 0
      ? Math.round((state.done / (state.done + state.miss)) * 100)
      : 0;

    const success = state.total > 0 ? state.done >= state.total : false;

    return {
      mode: 'solo',
      success,
      score: state.score,
      stars: success ? 3 : 1,
      accuracy,
      miss: state.miss,
      bestStreak: state.bestStreak,
      missionClear: state.done,
      missionTotal: state.total,
      rewards: success ? ['boss-clear'] : ['solo-finish'],
      coachFeedback: success
        ? ['ผ่าน phase boss ได้ดีมาก', 'แยกของดีและของไม่ดีได้แม่นขึ้นแล้ว']
        : ['ลองลด miss และรักษา streak ให้นานขึ้น'],
      nextAction: success
        ? 'ต่อยอดไปโหมด duet หรือ coop ได้เลย'
        : 'ลองเล่น phase boss อีกครั้งเพื่อเคลียร์เป้าหมายให้ครบ',
      metrics: {
        score: state.score,
        miss: state.miss,
        bestStreak: state.bestStreak,
        missionClear: state.done,
        missionTotal: state.total
      }
    };
  }

  function bindDemoButtons() {
    gameRoot.querySelector('#gjScoreBtn')?.addEventListener('click', () => {
      if (state.ended) return;
      state.streak += 1;
      patchScore(100);
      setBestStreak(state.streak);
      updateHud();
    });

    gameRoot.querySelector('#gjMissBtn')?.addEventListener('click', () => {
      if (state.ended) return;
      state.streak = 0;
      setMiss(state.miss + 1);
      emitScore();
      updateHud();
    });

    gameRoot.querySelector('#gjMissionBtn')?.addEventListener('click', () => {
      if (state.ended) return;
      setMission(state.done + 1, state.total);
      updateHud();
    });

    gameRoot.querySelector('#gjEndBtn')?.addEventListener('click', () => {
      emitEnd(buildSummary());
    });
  }

  function findLegacyBootFn() {
    return (
      W.createGoodJunkSoloCore ||
      W.bootGoodJunkSoloCore ||
      W.__GJ_SOLO_CORE_BOOT__ ||
      null
    );
  }

  function buildLegacyBridgeApi() {
    return {
      setScore,
      patchScore,
      setMiss,
      setBestStreak,
      setMission,
      emitEnd,
      emitMetrics,
      updateHud,
      showStatus,
      getState: () => ({ ...state })
    };
  }

  function bootDemoFallback(root, ctx) {
    usingDemoFallback = true;

    state.started = true;
    state.total = 10;
    emitMission();

    root.innerHTML = `
      <div style="display:grid;place-items:center;min-height:460px;padding:24px">
        <div style="max-width:760px;width:100%;padding:24px;border-radius:28px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);color:#eef5ff;font-family:system-ui,sans-serif">
          <h2 style="margin:0 0 10px">GoodJunk Solo Legacy Bridge</h2>
          <p style="margin:0 0 18px;color:#d8e6ff">จุดนี้ต้องแทนด้วย gameplay core เดิมของ goodjunk-solo-phaseboss-v2.js โดยตรง</p>

          <div style="display:grid;gap:10px;grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:14px">
            <div style="padding:12px;border-radius:16px;background:rgba(255,255,255,.06)">
              <strong style="display:block;margin-bottom:4px">Score</strong>
              <span data-role="score">Score 0</span>
            </div>
            <div style="padding:12px;border-radius:16px;background:rgba(255,255,255,.06)">
              <strong style="display:block;margin-bottom:4px">Mission</strong>
              <span data-role="mission">0/0</span>
            </div>
            <div style="padding:12px;border-radius:16px;background:rgba(255,255,255,.06)">
              <strong style="display:block;margin-bottom:4px">Best Streak</strong>
              <span data-role="streak">Best 0</span>
            </div>
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button id="gjScoreBtn">+100 Score</button>
            <button id="gjMissBtn">+1 Miss</button>
            <button id="gjMissionBtn">+1 Mission</button>
            <button id="gjEndBtn">End Game</button>
          </div>

          <div data-role="status" style="margin-top:14px;color:#c7daf8;font-size:14px">
            pid: ${escapeHtml(ctx?.pid || 'anon')} • diff: ${escapeHtml(ctx?.diff || 'normal')} • time: ${escapeHtml(ctx?.time || 90)}
          </div>
        </div>
      </div>
    `;

    bindDemoButtons();
    updateHud();
  }

  function bootExistingGameCore(root, ctx) {
    const legacyBoot = findLegacyBootFn();

    if (typeof legacyBoot === 'function') {
      usingDemoFallback = false;

      const bridge = buildLegacyBridgeApi();

      const api = legacyBoot({
        mount: root,
        root,
        ctx,
        hooks: bridge,
        onScore: (patch = {}) => {
          if (patch.score != null) setScore(patch.score);
          if (patch.miss != null) setMiss(patch.miss);
          if (patch.bestStreak != null) setBestStreak(patch.bestStreak);
          if (patch.streak != null) state.streak = Number(patch.streak || 0);
          updateHud();
        },
        onMission: (patch = {}) => {
          setMission(patch.done, patch.total);
          updateHud();
        },
        onEnd: (summary = {}) => {
          emitEnd(summary);
        }
      });

      if (api && typeof api === 'object') {
        legacyCoreApi = api;
      }

      emitMetrics({ source: 'legacy-core' });
      return;
    }

    bootDemoFallback(root, ctx);
  }

  function start() {
    state.started = true;
    if (legacyCoreApi && typeof legacyCoreApi.start === 'function') {
      legacyCoreApi.start();
    }
    updateHud();
  }

  function pause() {
    state.paused = true;
    if (legacyCoreApi && typeof legacyCoreApi.pause === 'function') {
      legacyCoreApi.pause();
    }
  }

  function resume() {
    state.paused = false;
    if (legacyCoreApi && typeof legacyCoreApi.resume === 'function') {
      legacyCoreApi.resume();
    }
  }

  function destroy() {
    state.destroyed = true;

    if (legacyCoreApi && typeof legacyCoreApi.destroy === 'function') {
      legacyCoreApi.destroy();
    }

    if (mountRoot && gameRoot && mountRoot.contains(gameRoot)) {
      mountRoot.removeChild(gameRoot);
    }
  }

  function getSummary() {
    if (legacyCoreApi && typeof legacyCoreApi.getSummary === 'function') {
      const summary = legacyCoreApi.getSummary();
      if (summary) return summary;
    }

    return state.summary || buildSummary();
  }

  function getMetrics() {
    if (legacyCoreApi && typeof legacyCoreApi.getMetrics === 'function') {
      const metrics = legacyCoreApi.getMetrics();
      if (metrics) return metrics;
    }

    return {
      mode: 'solo',
      score: state.score,
      miss: state.miss,
      bestStreak: state.bestStreak,
      done: state.done,
      total: state.total
    };
  }

  async function createGame(args = {}) {
    const localCtx = args.ctx || GLOBAL_CTX || {};
    activeCtx = localCtx;

    activeHooks = {
      ...(GLOBAL_HOOKS || {}),
      ...(args || {}),
      ctx: localCtx,
      mount: args.mount || args.root || GLOBAL_HOOKS?.mount || null
    };

    mountRoot = resolveMount(args.mount || args.root);
    gameRoot = renderShell(mountRoot);
    bootExistingGameCore(gameRoot, localCtx);

    return {
      start,
      pause,
      resume,
      destroy,
      getSummary,
      getMetrics
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createGame };
  }

  W.createLegacyGoodJunkSolo = createGame;

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
})();