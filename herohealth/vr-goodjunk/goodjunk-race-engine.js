(function () {
  'use strict';

  const W = window;
  const D = document;

  const GLOBAL_HOOKS = W.__GJ_HNZS_HOOKS__ || null;
  const GLOBAL_CTX = GLOBAL_HOOKS?.ctx || W.__GJ_RUN_CTX__ || {};

  const state = {
    mode: 'race',

    score: 0,
    miss: 0,
    bestStreak: 0,
    streak: 0,

    done: 0,
    total: 0,

    progress: 0,
    goal: 0,

    rivalScore: 0,
    rivalProgress: 0,
    rivalMiss: 0,

    rank: 0,
    winner: '',
    finishOrder: [],

    connected: true,
    ready: false,
    rivalReady: false,

    roomId: '',
    matchId: '',

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
  let countdownTimer = 0;
  let cpuRivalTimer = 0;
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
      mode: 'race',
      score: state.score,
      miss: state.miss,
      bestStreak: state.bestStreak,
      streak: state.streak,
      progress: state.progress,
      goal: state.goal,
      rivalScore: state.rivalScore,
      rivalProgress: state.rivalProgress,
      rank: state.rank,
      winner: state.winner,
      roomId: state.roomId,
      matchId: state.matchId,
      ...extra
    };

    safeCall(getHooks().onScore, patch);
    dispatchWindowEvent('hha:score', patch);
    dispatchWindowEvent('gj:score', patch);
  }

  function emitMission(extra = {}) {
    const patch = {
      mode: 'race',
      done: state.done,
      total: state.total,
      progress: state.progress,
      goal: state.goal,
      rivalProgress: state.rivalProgress,
      roomId: state.roomId,
      matchId: state.matchId,
      ...extra
    };

    safeCall(getHooks().onMission, patch);
    dispatchWindowEvent('quest:update', patch);
    dispatchWindowEvent('gj:goal', patch);
  }

  function emitMetrics(extra = {}) {
    const patch = {
      mode: 'race',
      score: state.score,
      miss: state.miss,
      bestStreak: state.bestStreak,
      streak: state.streak,
      done: state.done,
      total: state.total,
      progress: state.progress,
      goal: state.goal,
      rivalScore: state.rivalScore,
      rivalProgress: state.rivalProgress,
      rivalMiss: state.rivalMiss,
      rank: state.rank,
      winner: state.winner,
      finishOrder: [...state.finishOrder],
      roomId: state.roomId,
      matchId: state.matchId,
      connected: state.connected,
      ready: state.ready,
      rivalReady: state.rivalReady,
      ...extra
    };

    safeCall(getHooks().onMetrics, patch);
  }

  function normalizeEndSummary(summary = {}) {
    return {
      mode: 'race',
      success: !!summary.success,
      score: Number(summary.score ?? state.score ?? 0),
      stars: Number(summary.stars ?? (summary.success ? 3 : 1)),
      accuracy: Number(summary.accuracy ?? 0),
      miss: Number(summary.miss ?? state.miss ?? 0),
      bestStreak: Number(summary.bestStreak ?? state.bestStreak ?? 0),
      missionClear: Number(summary.missionClear ?? state.done ?? 0),
      missionTotal: Number(summary.missionTotal ?? state.total ?? 0),
      rank: Number(summary.rank ?? state.rank ?? 0),
      opponentResult: summary.opponentResult || {
        name: 'Rival',
        score: Number(state.rivalScore || 0),
        rank: state.rank === 1 ? 2 : 1,
        progress: Number(state.rivalProgress || 0)
      },
      rewards: Array.isArray(summary.rewards) ? summary.rewards : [],
      coachFeedback: Array.isArray(summary.coachFeedback) ? summary.coachFeedback : [],
      nextAction: summary.nextAction || '',
      metrics: summary.metrics || {
        roomId: state.roomId,
        matchId: state.matchId,
        progress: state.progress,
        goal: state.goal,
        rivalProgress: state.rivalProgress,
        rivalScore: state.rivalScore,
        winner: state.winner
      }
    };
  }

  function emitEnd(summary = {}) {
    if (state.ended) return;
    state.ended = true;

    clearTimers();

    const normalized = normalizeEndSummary(summary);
    state.summary = normalized;
    W.__GJ_LAST_SUMMARY__ = normalized;

    safeCall(getHooks().onEnd, normalized);
    dispatchWindowEvent('hha:end', normalized);
    dispatchWindowEvent('gj:end', normalized);
  }

  function resolveMount(mount) {
    return mount || getHooks().mount || D.getElementById('gameMount') || D.body;
  }

  function renderShell(root) {
    root.innerHTML = `
      <div class="gj-race-legacy-root" style="position:relative;min-height:100%;width:100%"></div>
    `;
    return root.querySelector('.gj-race-legacy-root');
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

  function setProgress(progress, goal) {
    state.progress = Number(progress || 0);
    if (goal != null) state.goal = Number(goal || 0);
    emitMission();
    emitScore();
  }

  function setRivalScore(nextScore) {
    state.rivalScore = Number(nextScore || 0);
    emitScore();
  }

  function setRivalProgress(progress) {
    state.rivalProgress = Number(progress || 0);
    emitMission();
    emitScore();
  }

  function setRank(rank) {
    state.rank = Number(rank || 0);
    emitMetrics();
  }

  function setWinner(winner) {
    state.winner = String(winner || '');
    emitMetrics();
  }

  function setFinishOrder(order) {
    state.finishOrder = Array.isArray(order) ? [...order] : [];
    emitMetrics();
  }

  function setRoomState({ roomId, matchId, ready, rivalReady, connected } = {}) {
    if (roomId != null) state.roomId = String(roomId || '');
    if (matchId != null) state.matchId = String(matchId || '');
    if (ready != null) state.ready = !!ready;
    if (rivalReady != null) state.rivalReady = !!rivalReady;
    if (connected != null) state.connected = !!connected;
    emitMetrics();
  }

  function clearTimers() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = 0;
    }
    if (cpuRivalTimer) {
      clearInterval(cpuRivalTimer);
      cpuRivalTimer = 0;
    }
  }

  function showStatus(text) {
    const el = gameRoot?.querySelector('[data-role="status"]');
    if (el) el.textContent = String(text || '');
  }

  function updateHud() {
    const youMeta = gameRoot?.querySelector('[data-role="youMeta"]');
    const rivalMeta = gameRoot?.querySelector('[data-role="rivalMeta"]');
    const youBar = gameRoot?.querySelector('[data-role="youBar"]');
    const rivalBar = gameRoot?.querySelector('[data-role="rivalBar"]');

    if (youMeta) {
      youMeta.textContent = `${state.progress}/${state.goal} • Score ${state.score}`;
    }
    if (rivalMeta) {
      rivalMeta.textContent = `${state.rivalProgress}/${state.goal} • Score ${state.rivalScore}`;
    }
    if (youBar) {
      const pct = state.goal > 0 ? Math.round((state.progress / state.goal) * 100) : 0;
      youBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    }
    if (rivalBar) {
      const pct = state.goal > 0 ? Math.round((state.rivalProgress / state.goal) * 100) : 0;
      rivalBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    }
  }

  function finalizeRaceIfNeeded() {
    if (state.ended) return;

    const youFinished = state.goal > 0 && state.progress >= state.goal;
    const rivalFinished = state.goal > 0 && state.rivalProgress >= state.goal;

    if (!youFinished && !rivalFinished) return;

    if (youFinished && !rivalFinished) {
      setRank(1);
      setWinner('self');
      setFinishOrder(['self', 'rival']);
      emitEnd(buildSummary());
      return;
    }

    if (!youFinished && rivalFinished) {
      setRank(2);
      setWinner('rival');
      setFinishOrder(['rival', 'self']);
      emitEnd(buildSummary());
      return;
    }

    if (youFinished && rivalFinished) {
      if (state.score > state.rivalScore) {
        setRank(1);
        setWinner('self');
        setFinishOrder(['self', 'rival']);
      } else if (state.score < state.rivalScore) {
        setRank(2);
        setWinner('rival');
        setFinishOrder(['rival', 'self']);
      } else {
        setRank(1);
        setWinner('self');
        setFinishOrder(['self', 'rival']);
      }
      emitEnd(buildSummary());
    }
  }

  function startCpuRival() {
    if (!usingDemoFallback) return;

    if (cpuRivalTimer) clearInterval(cpuRivalTimer);

    cpuRivalTimer = setInterval(() => {
      if (state.paused || state.ended || !state.started) return;

      const diff = getCtx()?.diff;
      const chance =
        diff === 'hard' ? 0.72 :
        diff === 'easy' ? 0.46 : 0.58;

      if (Math.random() > chance) return;

      setRivalProgress(state.rivalProgress + 1);
      setRivalScore(state.rivalScore + 90);
      updateHud();
      finalizeRaceIfNeeded();
    }, 1500);
  }

  function startCountdown(onDone) {
    const overlay = gameRoot?.querySelector('[data-role="countdown"]');
    if (!overlay) {
      if (typeof onDone === 'function') onDone();
      return;
    }

    let left = 3;
    overlay.style.display = 'grid';
    overlay.textContent = String(left);

    countdownTimer = setInterval(() => {
      left -= 1;

      if (left > 0) {
        overlay.textContent = String(left);
        return;
      }

      clearInterval(countdownTimer);
      countdownTimer = 0;
      overlay.textContent = 'GO!';

      setTimeout(() => {
        if (overlay) overlay.style.display = 'none';
      }, 450);

      state.started = true;
      showStatus('เริ่มแข่งแล้ว');

      if (typeof onDone === 'function') onDone();
    }, 800);
  }

  function buildSummary() {
    const accuracy = state.done + state.miss > 0
      ? Math.round((state.done / (state.done + state.miss)) * 100)
      : 0;

    const success = state.rank === 1 || state.winner === 'self';

    return {
      mode: 'race',
      success,
      score: state.score,
      stars: success ? 3 : accuracy >= 75 ? 2 : 1,
      accuracy,
      miss: state.miss,
      bestStreak: state.bestStreak,
      missionClear: state.done,
      missionTotal: state.total,
      rank: success ? 1 : 2,
      opponentResult: {
        name: 'Rival',
        score: state.rivalScore,
        rank: success ? 2 : 1,
        progress: state.rivalProgress
      },
      rewards: success ? ['race-win', 'fast-picker'] : ['race-finish'],
      coachFeedback: success
        ? ['แยกของดีได้ไวกว่าอีกฝั่ง', 'จังหวะการเก็บเป้าหมายดีมาก']
        : ['ลองเพิ่มความเร็วและลด miss เพื่อชนะ race รอบหน้า'],
      nextAction: success
        ? 'ต่อยอดไป battle ได้เลย'
        : 'ลองเล่น race อีกครั้งเพื่อเร่งจังหวะให้คมขึ้น',
      metrics: {
        roomId: state.roomId,
        matchId: state.matchId,
        progress: state.progress,
        goal: state.goal,
        rivalProgress: state.rivalProgress,
        rivalScore: state.rivalScore,
        winner: state.winner
      }
    };
  }

  function bindDemoButtons() {
    gameRoot.querySelector('[data-action="ready"]')?.addEventListener('click', () => {
      state.ready = true;
      state.rivalReady = true;
      showStatus('กำลังเริ่มแข่ง...');
      startCountdown(() => {
        startCpuRival();
      });
    });

    gameRoot.querySelector('[data-action="progress"]')?.addEventListener('click', () => {
      if (!state.started || state.ended) return;
      state.streak += 1;
      setBestStreak(state.streak);
      patchScore(100);
      setMission(state.done + 1, state.total);
      setProgress(state.progress + 1, state.goal);
      updateHud();
      finalizeRaceIfNeeded();
    });

    gameRoot.querySelector('[data-action="miss"]')?.addEventListener('click', () => {
      if (!state.started || state.ended) return;
      state.streak = 0;
      setMiss(state.miss + 1);
      emitScore();
      updateHud();
    });

    gameRoot.querySelector('[data-action="finish"]')?.addEventListener('click', () => {
      if (!state.started || state.ended) return;
      setProgress(state.goal, state.goal);
      updateHud();
      finalizeRaceIfNeeded();
    });

    gameRoot.querySelector('[data-action="end"]')?.addEventListener('click', () => {
      emitEnd(buildSummary());
    });
  }

  function findLegacyBootFn() {
    return (
      W.createGoodJunkRaceCore ||
      W.bootGoodJunkRaceCore ||
      W.__GJ_RACE_CORE_BOOT__ ||
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
      setProgress,
      setRivalScore,
      setRivalProgress,
      setRank,
      setWinner,
      setFinishOrder,
      setRoomState,
      emitEnd,
      emitMetrics,
      updateHud,
      showStatus,
      getState: () => ({ ...state })
    };
  }

  function bootDemoFallback(root, ctx) {
    usingDemoFallback = true;

    state.total = 10;
    state.goal = 10;
    state.roomId = ctx?.roomId || `RACE-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    state.matchId = ctx?.matchId || `MATCH-${Date.now().toString(36).slice(-4).toUpperCase()}`;

    root.innerHTML = `
      <div style="min-height:100%;display:grid;gap:16px;grid-template-rows:auto auto 1fr;position:relative;padding:12px;box-sizing:border-box;font-family:system-ui,sans-serif;color:#eef5ff">
        <section style="padding:18px;border-radius:24px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)">
          <h2 style="margin:0 0 8px;font-size:28px">GoodJunk Race Legacy Bridge</h2>
          <p style="margin:0;color:#d7e5ff">จุดนี้ต้องแทนด้วย race gameplay เดิมของคุณ โดยคงระบบ room/progress เดิมไว้ แล้ว bridge เข้า HNZS</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
            <button data-action="ready">Ready Race</button>
            <button data-action="progress">+100 / +1 Progress</button>
            <button data-action="miss">+1 Miss</button>
            <button data-action="finish">Finish Now</button>
            <button data-action="end">End Game</button>
          </div>
          <div data-role="status" style="margin-top:12px;color:#c7daf8">รอเริ่มแข่ง</div>
        </section>

        <section style="display:grid;gap:12px;grid-template-columns:1fr 1fr">
          <div style="padding:14px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12)">
            <div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:10px;font-weight:700">
              <span>You</span>
              <span data-role="youMeta">0/0 • Score 0</span>
            </div>
            <div style="height:14px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden">
              <div data-role="youBar" style="height:100%;width:0%;border-radius:999px;background:linear-gradient(90deg,#56de84,#ffd24a)"></div>
            </div>
          </div>

          <div style="padding:14px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12)">
            <div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:10px;font-weight:700">
              <span>Rival</span>
              <span data-role="rivalMeta">0/0 • Score 0</span>
            </div>
            <div style="height:14px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden">
              <div data-role="rivalBar" style="height:100%;width:0%;border-radius:999px;background:linear-gradient(90deg,#7aa2ff,#d46bff)"></div>
            </div>
          </div>
        </section>

        <section style="display:grid;place-items:center;padding:24px;border-radius:28px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);text-align:center;min-height:340px">
          <div>
            <div style="font-size:13px;letter-spacing:.16em;color:#bed2f1;text-transform:uppercase;margin-bottom:12px">Race Bridge Placeholder</div>
            <div style="font-size:28px;font-weight:800;line-height:1.25;margin-bottom:12px">เสียบ gameplay core เดิมของ GoodJunk Race ตรงนี้</div>
            <div style="font-size:16px;color:#dce9ff">
              roomId: ${escapeHtml(state.roomId)} • matchId: ${escapeHtml(state.matchId)} • diff: ${escapeHtml(ctx?.diff || 'normal')}
            </div>
          </div>
        </section>

        <div data-role="countdown" style="display:none;position:absolute;inset:0;place-items:center;font-size:80px;font-weight:900;background:rgba(3,8,20,.72);backdrop-filter:blur(10px);z-index:5">3</div>
      </div>
    `;

    bindDemoButtons();
    updateHud();
    emitMission();
    emitMetrics();
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
          if (patch.progress != null) setProgress(patch.progress, patch.goal ?? state.goal);
          if (patch.rivalScore != null) setRivalScore(patch.rivalScore);
          if (patch.rivalProgress != null) setRivalProgress(patch.rivalProgress);
          if (patch.rank != null) setRank(patch.rank);
          if (patch.winner != null) setWinner(patch.winner);
          updateHud();
        },
        onMission: (patch = {}) => {
          setMission(patch.done, patch.total);
          if (patch.progress != null || patch.goal != null) {
            setProgress(patch.progress ?? state.progress, patch.goal ?? state.goal);
          }
          if (patch.rivalProgress != null) setRivalProgress(patch.rivalProgress);
          updateHud();
        },
        onRoom: (patch = {}) => {
          setRoomState(patch);
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
    clearTimers();

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
      mode: 'race',
      score: state.score,
      miss: state.miss,
      bestStreak: state.bestStreak,
      done: state.done,
      total: state.total,
      progress: state.progress,
      goal: state.goal,
      rivalScore: state.rivalScore,
      rivalProgress: state.rivalProgress,
      rank: state.rank,
      winner: state.winner,
      roomId: state.roomId,
      matchId: state.matchId
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

  W.createLegacyGoodJunkRace = createGame;

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
})();