(function () {
  'use strict';

  const W = window;
  const D = document;

  const GLOBAL_HOOKS = W.__GJ_HNZS_HOOKS__ || null;
  const GLOBAL_CTX = GLOBAL_HOOKS?.ctx || W.__GJ_RUN_CTX__ || {};

  const state = {
    mode: 'coop',

    score: 0,
    miss: 0,
    bestStreak: 0,
    streak: 0,

    done: 0,
    total: 0,

    contribution: 0,
    teamScore: 0,
    teamGoal: 0,

    partnerScore: 0,
    partnerContribution: 0,

    connected: true,
    ready: false,
    partnerReady: false,

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
  let cpuPartnerTimer = 0;
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
      mode: 'coop',
      score: state.score,
      miss: state.miss,
      bestStreak: state.bestStreak,
      streak: state.streak,
      contribution: state.contribution,
      teamScore: state.teamScore,
      partnerScore: state.partnerScore,
      partnerContribution: state.partnerContribution,
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
      mode: 'coop',
      done: state.done,
      total: state.total,
      contribution: state.contribution,
      teamScore: state.teamScore,
      teamGoal: state.teamGoal,
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
      mode: 'coop',
      score: state.score,
      miss: state.miss,
      bestStreak: state.bestStreak,
      streak: state.streak,
      done: state.done,
      total: state.total,
      contribution: state.contribution,
      teamScore: state.teamScore,
      teamGoal: state.teamGoal,
      partnerScore: state.partnerScore,
      partnerContribution: state.partnerContribution,
      roomId: state.roomId,
      matchId: state.matchId,
      connected: state.connected,
      ready: state.ready,
      partnerReady: state.partnerReady,
      ...extra
    };

    safeCall(getHooks().onMetrics, patch);
  }

  function normalizeEndSummary(summary = {}) {
    return {
      mode: 'coop',
      success: !!summary.success,
      score: Number(summary.score ?? state.score ?? 0),
      stars: Number(summary.stars ?? (summary.success ? 3 : 1)),
      accuracy: Number(summary.accuracy ?? 0),
      miss: Number(summary.miss ?? state.miss ?? 0),
      bestStreak: Number(summary.bestStreak ?? state.bestStreak ?? 0),
      contribution: Number(summary.contribution ?? state.contribution ?? 0),
      missionClear: Number(summary.missionClear ?? state.done ?? 0),
      missionTotal: Number(summary.missionTotal ?? state.total ?? 0),
      teamResult: summary.teamResult || {
        success: !!summary.success,
        teamGoal: Number(summary.teamGoal ?? state.teamGoal ?? 0),
        teamScore: Number(summary.teamScore ?? state.teamScore ?? 0),
        players: [
          {
            name: getCtx()?.name || 'You',
            contribution: Number(state.contribution || 0),
            score: Number(state.score || 0)
          },
          {
            name: 'Buddy',
            contribution: Number(state.partnerContribution || 0),
            score: Number(state.partnerScore || 0)
          }
        ]
      },
      rewards: Array.isArray(summary.rewards) ? summary.rewards : [],
      coachFeedback: Array.isArray(summary.coachFeedback) ? summary.coachFeedback : [],
      nextAction: summary.nextAction || '',
      metrics: summary.metrics || {
        roomId: state.roomId,
        matchId: state.matchId,
        teamScore: state.teamScore,
        teamGoal: state.teamGoal,
        contribution: state.contribution,
        partnerContribution: state.partnerContribution
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
      <div class="gj-coop-legacy-root" style="position:relative;min-height:100%;width:100%"></div>
    `;
    return root.querySelector('.gj-coop-legacy-root');
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

  function setTeamGoal(goal) {
    state.teamGoal = Number(goal || 0);
    emitMission();
  }

  function setContribution(nextContribution) {
    state.contribution = Number(nextContribution || 0);
    emitMetrics();
  }

  function setPartnerContribution(nextContribution) {
    state.partnerContribution = Number(nextContribution || 0);
    emitMetrics();
  }

  function setTeamScore(nextTeamScore) {
    state.teamScore = Number(nextTeamScore || 0);
    emitMission();
    emitScore();
  }

  function setPartnerScore(nextPartnerScore) {
    state.partnerScore = Number(nextPartnerScore || 0);
    emitScore();
  }

  function setRoomState({ roomId, matchId, ready, partnerReady, connected } = {}) {
    if (roomId != null) state.roomId = String(roomId || '');
    if (matchId != null) state.matchId = String(matchId || '');
    if (ready != null) state.ready = !!ready;
    if (partnerReady != null) state.partnerReady = !!partnerReady;
    if (connected != null) state.connected = !!connected;
    emitMetrics();
  }

  function clearTimers() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = 0;
    }
    if (cpuPartnerTimer) {
      clearInterval(cpuPartnerTimer);
      cpuPartnerTimer = 0;
    }
  }

  function showStatus(text) {
    const el = gameRoot?.querySelector('[data-role="status"]');
    if (el) el.textContent = String(text || '');
  }

  function updateHud() {
    const youMeta = gameRoot?.querySelector('[data-role="youMeta"]');
    const partnerMeta = gameRoot?.querySelector('[data-role="partnerMeta"]');
    const teamMeta = gameRoot?.querySelector('[data-role="teamMeta"]');
    const teamBar = gameRoot?.querySelector('[data-role="teamBar"]');

    if (youMeta) {
      youMeta.textContent = `Score ${state.score} • Team Help ${state.contribution}`;
    }
    if (partnerMeta) {
      partnerMeta.textContent = `Score ${state.partnerScore} • Team Help ${state.partnerContribution}`;
    }
    if (teamMeta) {
      teamMeta.textContent = `${state.teamScore}/${state.teamGoal}`;
    }
    if (teamBar) {
      const pct = state.teamGoal > 0 ? Math.round((state.teamScore / state.teamGoal) * 100) : 0;
      teamBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    }
  }

  function startCpuPartner() {
    if (!usingDemoFallback) return;

    if (cpuPartnerTimer) clearInterval(cpuPartnerTimer);

    cpuPartnerTimer = setInterval(() => {
      if (state.paused || state.ended || !state.started) return;

      const diff = getCtx()?.diff;
      const chance =
        diff === 'hard' ? 0.46 :
        diff === 'easy' ? 0.74 : 0.6;

      if (Math.random() > chance) return;

      setPartnerContribution(state.partnerContribution + 1);
      setPartnerScore(state.partnerScore + 85);
      setTeamScore(state.contribution + state.partnerContribution);
      updateHud();

      if (state.teamGoal > 0 && state.teamScore >= state.teamGoal) {
        emitEnd(buildSummary());
      }
    }, 1700);
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
      showStatus('เริ่มภารกิจทีมแล้ว');

      if (typeof onDone === 'function') onDone();
    }, 800);
  }

  function buildSummary() {
    const accuracy = state.done + state.miss > 0
      ? Math.round((state.done / (state.done + state.miss)) * 100)
      : 0;

    const success = state.teamGoal > 0 ? state.teamScore >= state.teamGoal : false;

    return {
      mode: 'coop',
      success,
      score: state.score,
      stars: success ? (state.miss <= 1 ? 3 : 2) : 1,
      accuracy,
      miss: state.miss,
      bestStreak: state.bestStreak,
      contribution: state.contribution,
      missionClear: state.done,
      missionTotal: state.total,
      teamScore: state.teamScore,
      teamGoal: state.teamGoal,
      teamResult: {
        success,
        teamGoal: state.teamGoal,
        teamScore: state.teamScore,
        players: [
          {
            name: getCtx()?.name || 'You',
            contribution: state.contribution,
            score: state.score
          },
          {
            name: 'Buddy',
            contribution: state.partnerContribution,
            score: state.partnerScore
          }
        ]
      },
      rewards: success ? ['coop-clear', 'team-helper'] : ['coop-finish'],
      coachFeedback: success
        ? ['ช่วยกันทำภารกิจทีมสำเร็จ', 'การร่วมมือกันของทีมดีมาก']
        : ['ลองช่วยกันเพิ่ม team score และลด miss ให้มากขึ้น'],
      nextAction: success
        ? 'ต่อยอดไป race หรือ battle ได้เลย'
        : 'ลองเล่น coop อีกครั้งเพื่อปิดภารกิจทีมให้สำเร็จ',
      metrics: {
        roomId: state.roomId,
        matchId: state.matchId,
        teamScore: state.teamScore,
        teamGoal: state.teamGoal
      }
    };
  }

  function bindDemoButtons() {
    gameRoot.querySelector('[data-action="ready"]')?.addEventListener('click', () => {
      state.ready = true;
      state.partnerReady = true;
      showStatus('กำลังเริ่มภารกิจทีม...');
      startCountdown(() => {
        startCpuPartner();
      });
    });

    gameRoot.querySelector('[data-action="score"]')?.addEventListener('click', () => {
      if (!state.started || state.ended) return;
      state.streak += 1;
      setBestStreak(state.streak);
      patchScore(100);
      setContribution(state.contribution + 1);
      setMission(state.done + 1, state.total);
      setTeamScore(state.contribution + state.partnerContribution);
      updateHud();

      if (state.teamGoal > 0 && state.teamScore >= state.teamGoal) {
        emitEnd(buildSummary());
      }
    });

    gameRoot.querySelector('[data-action="miss"]')?.addEventListener('click', () => {
      if (!state.started || state.ended) return;
      state.streak = 0;
      setMiss(state.miss + 1);
      emitScore();
      updateHud();
    });

    gameRoot.querySelector('[data-action="end"]')?.addEventListener('click', () => {
      emitEnd(buildSummary());
    });
  }

  function findLegacyBootFn() {
    return (
      W.createGoodJunkCoopCore ||
      W.bootGoodJunkCoopCore ||
      W.__GJ_COOP_CORE_BOOT__ ||
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
      setContribution,
      setPartnerContribution,
      setPartnerScore,
      setTeamScore,
      setTeamGoal,
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

    state.total = 12;
    state.teamGoal = 12;
    state.roomId = ctx?.roomId || `COOP-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    state.matchId = ctx?.matchId || `MATCH-${Date.now().toString(36).slice(-4).toUpperCase()}`;

    root.innerHTML = `
      <div style="min-height:100%;display:grid;gap:16px;grid-template-rows:auto auto 1fr;position:relative;padding:12px;box-sizing:border-box;font-family:system-ui,sans-serif;color:#eef5ff">
        <section style="padding:18px;border-radius:24px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)">
          <h2 style="margin:0 0 8px;font-size:28px">GoodJunk Coop Legacy Bridge</h2>
          <p style="margin:0;color:#d7e5ff">จุดนี้ต้องแทนด้วย coop gameplay เดิมของคุณ โดยคงระบบทีม/room เดิมไว้ แล้ว bridge เข้า HNZS</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
            <button data-action="ready">Ready Team</button>
            <button data-action="score">+100 / +1 Goal</button>
            <button data-action="miss">+1 Miss</button>
            <button data-action="end">End Game</button>
          </div>
          <div data-role="status" style="margin-top:12px;color:#c7daf8">รอเริ่มภารกิจทีม</div>
        </section>

        <section style="display:grid;gap:12px;grid-template-columns:1.2fr .8fr .8fr">
          <div style="padding:14px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12)">
            <div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:10px;font-weight:700">
              <span>Team Goal</span>
              <span data-role="teamMeta">0/0</span>
            </div>
            <div style="height:14px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden">
              <div data-role="teamBar" style="height:100%;width:0%;border-radius:999px;background:linear-gradient(90deg,#56de84,#ffd24a)"></div>
            </div>
          </div>
          <div style="padding:14px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12)">
            <strong style="display:block;margin-bottom:6px">You</strong>
            <span data-role="youMeta">Score 0 • Team Help 0</span>
          </div>
          <div style="padding:14px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12)">
            <strong style="display:block;margin-bottom:6px">Buddy</strong>
            <span data-role="partnerMeta">Score 0 • Team Help 0</span>
          </div>
        </section>

        <section style="display:grid;place-items:center;padding:24px;border-radius:28px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);text-align:center;min-height:340px">
          <div>
            <div style="font-size:13px;letter-spacing:.16em;color:#bed2f1;text-transform:uppercase;margin-bottom:12px">Coop Bridge Placeholder</div>
            <div style="font-size:28px;font-weight:800;line-height:1.25;margin-bottom:12px">เสียบ gameplay core เดิมของ GoodJunk Coop ตรงนี้</div>
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
          if (patch.contribution != null) setContribution(patch.contribution);
          if (patch.partnerScore != null) setPartnerScore(patch.partnerScore);
          if (patch.partnerContribution != null) setPartnerContribution(patch.partnerContribution);
          if (patch.teamScore != null) setTeamScore(patch.teamScore);
          updateHud();
        },
        onMission: (patch = {}) => {
          setMission(patch.done, patch.total);
          if (patch.teamGoal != null) setTeamGoal(patch.teamGoal);
          if (patch.teamScore != null) setTeamScore(patch.teamScore);
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
      mode: 'coop',
      score: state.score,
      miss: state.miss,
      bestStreak: state.bestStreak,
      done: state.done,
      total: state.total,
      contribution: state.contribution,
      teamScore: state.teamScore,
      teamGoal: state.teamGoal,
      partnerScore: state.partnerScore,
      partnerContribution: state.partnerContribution,
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

  W.createLegacyGoodJunkCoop = createGame;

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
})();