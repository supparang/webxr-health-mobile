(function () {
  'use strict';

  const W = window;
  const D = document;

  const H = W.__GJ_HNZS_HOOKS__ || null;
  const HCTX = H?.ctx || W.__GJ_RUN_CTX__ || {};

  const state = {
    mode: 'duet',
    score: 0,
    miss: 0,
    bestStreak: 0,
    streak: 0,

    done: 0,
    total: 0,

    contribution: 0,
    pairScore: 0,
    pairGoal: 0,

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
  let countdownTimer = 0;
  let cpuPartnerTimer = 0;

  function safeCall(fn, arg) {
    try {
      if (typeof fn === 'function') fn(arg);
    } catch (err) {
      console.warn(err);
    }
  }

  function emitScore(extra = {}) {
    const patch = {
      mode: 'duet',
      score: state.score,
      miss: state.miss,
      bestStreak: state.bestStreak,
      streak: state.streak,
      contribution: state.contribution,
      pairScore: state.pairScore,
      partnerScore: state.partnerScore,
      ...extra
    };

    safeCall(H?.onScore, patch);

    try {
      W.dispatchEvent(new CustomEvent('hha:score', { detail: patch }));
    } catch {}

    try {
      W.dispatchEvent(new CustomEvent('gj:score', { detail: patch }));
    } catch {}
  }

  function emitMission(extra = {}) {
    const patch = {
      mode: 'duet',
      done: state.done,
      total: state.total,
      pairScore: state.pairScore,
      pairGoal: state.pairGoal,
      ...extra
    };

    safeCall(H?.onMission, patch);

    try {
      W.dispatchEvent(new CustomEvent('quest:update', { detail: patch }));
    } catch {}

    try {
      W.dispatchEvent(new CustomEvent('gj:goal', { detail: patch }));
    } catch {}
  }

  function emitMetrics(extra = {}) {
    const patch = {
      mode: 'duet',
      score: state.score,
      miss: state.miss,
      bestStreak: state.bestStreak,
      streak: state.streak,
      contribution: state.contribution,
      pairScore: state.pairScore,
      pairGoal: state.pairGoal,
      partnerScore: state.partnerScore,
      partnerContribution: state.partnerContribution,
      roomId: state.roomId,
      matchId: state.matchId,
      ...extra
    };

    safeCall(H?.onMetrics, patch);
  }

  function emitEnd(summary = {}) {
    if (state.ended) return;
    state.ended = true;

    clearTimers();

    const normalized = {
      mode: 'duet',
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
        pairGoal: Number(summary.pairGoal ?? state.pairGoal ?? 0),
        teamScore: Number(summary.pairScore ?? state.pairScore ?? 0),
        players: [
          {
            name: HCTX?.name || 'You',
            contribution: Number(state.contribution || 0),
            score: Number(state.score || 0)
          },
          {
            name: 'Partner',
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
        pairScore: state.pairScore,
        pairGoal: state.pairGoal
      }
    };

    state.summary = normalized;
    W.__GJ_LAST_SUMMARY__ = normalized;

    safeCall(H?.onEnd, normalized);

    try {
      W.dispatchEvent(new CustomEvent('hha:end', { detail: normalized }));
    } catch {}

    try {
      W.dispatchEvent(new CustomEvent('gj:end', { detail: normalized }));
    } catch {}
  }

  function resolveMount(mount) {
    return mount || H?.mount || D.getElementById('gameMount') || D.body;
  }

  function renderShell(root) {
    root.innerHTML = `
      <div class="gj-duet-legacy-root" style="position:relative;min-height:100%;width:100%"></div>
    `;
    return root.querySelector('.gj-duet-legacy-root');
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

  function setPairGoal(goal) {
    state.pairGoal = Number(goal || 0);
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

  function setPairScore(nextPairScore) {
    state.pairScore = Number(nextPairScore || 0);
    emitMission();
    emitScore();
  }

  function setPartnerScore(nextPartnerScore) {
    state.partnerScore = Number(nextPartnerScore || 0);
    emitScore();
  }

  function setRoomState({ roomId, matchId, ready, partnerReady } = {}) {
    if (roomId != null) state.roomId = String(roomId || '');
    if (matchId != null) state.matchId = String(matchId || '');
    if (ready != null) state.ready = !!ready;
    if (partnerReady != null) state.partnerReady = !!partnerReady;
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
    const pairMeta = gameRoot?.querySelector('[data-role="pairMeta"]');
    const pairBar = gameRoot?.querySelector('[data-role="pairBar"]');

    if (youMeta) {
      youMeta.textContent = `Score ${state.score} • Help ${state.contribution}`;
    }
    if (partnerMeta) {
      partnerMeta.textContent = `Score ${state.partnerScore} • Help ${state.partnerContribution}`;
    }
    if (pairMeta) {
      pairMeta.textContent = `${state.pairScore}/${state.pairGoal}`;
    }
    if (pairBar) {
      const pct = state.pairGoal > 0 ? Math.round((state.pairScore / state.pairGoal) * 100) : 0;
      pairBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    }
  }

  function startCpuPartner() {
    if (cpuPartnerTimer) clearInterval(cpuPartnerTimer);

    cpuPartnerTimer = setInterval(() => {
      if (state.paused || state.ended || !state.started) return;

      const chance =
        HCTX?.diff === 'hard' ? 0.42 :
        HCTX?.diff === 'easy' ? 0.72 : 0.58;

      if (Math.random() > chance) return;

      setPartnerContribution(state.partnerContribution + 1);
      setPartnerScore(state.partnerScore + 90);
      setPairScore(state.contribution + state.partnerContribution);
      updateHud();

      if (state.pairGoal > 0 && state.pairScore >= state.pairGoal) {
        emitEnd(buildSummary());
      }
    }, 1800);
  }

  function startCountdown() {
    const overlay = gameRoot?.querySelector('[data-role="countdown"]');
    if (!overlay) return;

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
      showStatus('เล่นเป็นคู่แล้ว');
      startCpuPartner();
    }, 800);
  }

  function buildSummary() {
    const accuracy = state.done + state.miss > 0
      ? Math.round((state.done / (state.done + state.miss)) * 100)
      : 0;

    const success = state.pairGoal > 0 ? state.pairScore >= state.pairGoal : false;

    return {
      mode: 'duet',
      success,
      score: state.score,
      stars: success ? (state.miss <= 1 ? 3 : 2) : 1,
      accuracy,
      miss: state.miss,
      bestStreak: state.bestStreak,
      contribution: state.contribution,
      missionClear: state.done,
      missionTotal: state.total,
      pairScore: state.pairScore,
      pairGoal: state.pairGoal,
      teamResult: {
        success,
        pairGoal: state.pairGoal,
        teamScore: state.pairScore,
        players: [
          {
            name: HCTX?.name || 'You',
            contribution: state.contribution,
            score: state.score
          },
          {
            name: 'Partner',
            contribution: state.partnerContribution,
            score: state.partnerScore
          }
        ]
      },
      rewards: success ? ['duet-clear', 'pair-play'] : ['duet-finish'],
      coachFeedback: success
        ? ['เล่นเป็นคู่ได้ดีมาก', 'ช่วยกันเก็บเป้าหมายคู่สำเร็จ']
        : ['ลองช่วยกันทำ pair goal ให้ครบมากขึ้น'],
      nextAction: success
        ? 'ต่อยอดไปโหมด coop หรือ race ได้เลย'
        : 'ลองเล่น duet อีกครั้งเพื่อลด miss และเพิ่ม pair score',
      metrics: {
        roomId: state.roomId,
        matchId: state.matchId,
        pairScore: state.pairScore,
        pairGoal: state.pairGoal
      }
    };
  }

  function bindDemoButtons() {
    gameRoot.querySelector('[data-action="ready"]')?.addEventListener('click', () => {
      state.ready = true;
      state.partnerReady = true;
      showStatus('กำลังเริ่มเล่นแบบคู่...');
      startCountdown();
    });

    gameRoot.querySelector('[data-action="score"]')?.addEventListener('click', () => {
      if (!state.started || state.ended) return;
      state.streak += 1;
      setBestStreak(state.streak);
      patchScore(100);
      setContribution(state.contribution + 1);
      setMission(state.done + 1, state.total);
      setPairScore(state.contribution + state.partnerContribution);
      updateHud();

      if (state.pairGoal > 0 && state.pairScore >= state.pairGoal) {
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

  function bootExistingGameCore(root, ctx) {
    // IMPORTANT:
    // เอา gameplay duet เดิมของ goodjunk.safe.duet.js มาเสียบที่นี่
    // แล้ว hook ค่าเหล่านี้กลับเข้า HNZS:
    //
    // setScore(realScore)
    // setMiss(realMiss)
    // setBestStreak(realBestStreak)
    // setMission(done,total)
    // setContribution(selfContribution)
    // setPartnerContribution(partnerContribution)
    // setPartnerScore(partnerScore)
    // setPairScore(teamScore)
    // setPairGoal(pairGoal)
    // setRoomState({ roomId, matchId, ready, partnerReady })
    // emitEnd(mappedSummary)

    state.total = 10;
    state.pairGoal = 10;
    state.roomId = ctx?.roomId || `DUET-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    state.matchId = ctx?.matchId || `MATCH-${Date.now().toString(36).slice(-4).toUpperCase()}`;

    root.innerHTML = `
      <div style="min-height:100%;display:grid;gap:16px;grid-template-rows:auto auto 1fr;position:relative;padding:12px;box-sizing:border-box;font-family:system-ui,sans-serif;color:#eef5ff">
        <section style="padding:18px;border-radius:24px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)">
          <h2 style="margin:0 0 8px;font-size:28px">GoodJunk Duet Legacy Bridge</h2>
          <p style="margin:0;color:#d7e5ff">จุดนี้ต้องแทนด้วย duet gameplay เดิมของคุณ โดยคงระบบ pair/room เดิมไว้ แล้ว bridge เข้า HNZS</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
            <button data-action="ready">Ready Pair</button>
            <button data-action="score">+100 / +1 Goal</button>
            <button data-action="miss">+1 Miss</button>
            <button data-action="end">End Game</button>
          </div>
          <div data-role="status" style="margin-top:12px;color:#c7daf8">รอเริ่มเล่นเป็นคู่</div>
        </section>

        <section style="display:grid;gap:12px;grid-template-columns:1.2fr .8fr .8fr">
          <div style="padding:14px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12)">
            <div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:10px;font-weight:700">
              <span>Pair Goal</span>
              <span data-role="pairMeta">0/0</span>
            </div>
            <div style="height:14px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden">
              <div data-role="pairBar" style="height:100%;width:0%;border-radius:999px;background:linear-gradient(90deg,#56de84,#ffd24a)"></div>
            </div>
          </div>
          <div style="padding:14px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12)">
            <strong style="display:block;margin-bottom:6px">You</strong>
            <span data-role="youMeta">Score 0 • Help 0</span>
          </div>
          <div style="padding:14px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12)">
            <strong style="display:block;margin-bottom:6px">Partner</strong>
            <span data-role="partnerMeta">Score 0 • Help 0</span>
          </div>
        </section>

        <section style="display:grid;place-items:center;padding:24px;border-radius:28px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);text-align:center;min-height:340px">
          <div>
            <div style="font-size:13px;letter-spacing:.16em;color:#bed2f1;text-transform:uppercase;margin-bottom:12px">Duet Bridge Placeholder</div>
            <div style="font-size:28px;font-weight:800;line-height:1.25;margin-bottom:12px">เสียบ gameplay core เดิมของ GoodJunk Duet ตรงนี้</div>
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

  function start() {
    state.started = true;
    updateHud();
  }

  function pause() {
    state.paused = true;
  }

  function resume() {
    state.paused = false;
  }

  function destroy() {
    state.destroyed = true;
    clearTimers();

    if (mountRoot && gameRoot && mountRoot.contains(gameRoot)) {
      mountRoot.removeChild(gameRoot);
    }
  }

  function getSummary() {
    return state.summary || buildSummary();
  }

  function getMetrics() {
    return {
      mode: 'duet',
      score: state.score,
      miss: state.miss,
      bestStreak: state.bestStreak,
      done: state.done,
      total: state.total,
      contribution: state.contribution,
      pairScore: state.pairScore,
      pairGoal: state.pairGoal,
      roomId: state.roomId,
      matchId: state.matchId
    };
  }

  async function createGame({ mount, ctx } = {}) {
    mountRoot = resolveMount(mount);
    gameRoot = renderShell(mountRoot);
    bootExistingGameCore(gameRoot, ctx || HCTX || {});

    return {
      start,
      pause,
      resume,
      destroy,
      getSummary,
      getMetrics
    };
  }

  W.createLegacyGoodJunkDuet = createGame;

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
})();