(function(){
  'use strict';

  const W = window;
  const D = document;

  const H = W.__GJ_HNZS_HOOKS__ || null;
  const HCTX = H?.ctx || W.__GJ_RUN_CTX__ || {};

  const state = {
    score: 0,
    miss: 0,
    bestStreak: 0,
    streak: 0,
    done: 0,
    total: 0,
    ended: false,
    started: false,
    destroyed: false,
    summary: null
  };

  let mountRoot = null;
  let gameRoot = null;

  function safeCall(fn, arg) {
    try { if (typeof fn === 'function') fn(arg); } catch (err) { console.warn(err); }
  }

  function emitScore(extra = {}) {
    const patch = {
      score: state.score,
      miss: state.miss,
      bestStreak: state.bestStreak,
      streak: state.streak,
      ...extra
    };

    safeCall(H?.onScore, patch);

    try {
      W.dispatchEvent(new CustomEvent('hha:score', { detail: patch }));
    } catch {}
  }

  function emitMission(extra = {}) {
    const patch = {
      done: state.done,
      total: state.total,
      ...extra
    };

    safeCall(H?.onMission, patch);

    try {
      W.dispatchEvent(new CustomEvent('quest:update', { detail: patch }));
    } catch {}
  }

  function emitMetrics(extra = {}) {
    const patch = {
      score: state.score,
      miss: state.miss,
      bestStreak: state.bestStreak,
      streak: state.streak,
      done: state.done,
      total: state.total,
      ...extra
    };

    safeCall(H?.onMetrics, patch);
  }

  function emitEnd(summary = {}) {
    if (state.ended) return;
    state.ended = true;

    const normalized = {
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
      nextAction: summary.nextAction || '' ,
      metrics: summary.metrics || {}
    };

    state.summary = normalized;
    W.__GJ_LAST_SUMMARY__ = normalized;

    safeCall(H?.onEnd, normalized);

    try {
      W.dispatchEvent(new CustomEvent('hha:end', { detail: normalized }));
    } catch {}
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
    return mount || H?.mount || D.getElementById('gameMount') || D.body;
  }

  function renderShell(root) {
    root.innerHTML = `
      <div class="gj-solo-legacy-root" style="position:relative;min-height:100%;width:100%"></div>
    `;
    return root.querySelector('.gj-solo-legacy-root');
  }

  // =========================
  // ตรงนี้คือจุดเสียบ logic เดิม
  // =========================
  function bootExistingGameCore(root, ctx) {
    // IMPORTANT:
    // ย้าย/เรียก init เดิมของ goodjunk-solo-phaseboss-v2.js มาที่นี่
    // โดยใช้ root เป็น mount target หลัก
    // และให้ผูก callback ด้านล่างเข้ากับจุดเดิมของเกม

    // ตัวอย่างการ bridge กับ logic เดิม:
    // onGameScoreChange((score) => setScore(score));
    // onMissChange((miss) => setMiss(miss));
    // onBestStreakChange((best) => setBestStreak(best));
    // onMissionProgress((done,total) => setMission(done,total));
    // onGameEnd((legacySummary) => emitEnd(mapLegacySummary(legacySummary)));

    // ===== DEMO PLACEHOLDER =====
    // ลบท่อนนี้เมื่อเสียบของเดิมจริง
    state.started = true;
    state.total = 10;
    emitMission();

    root.innerHTML = `
      <div style="display:grid;place-items:center;min-height:460px;padding:24px">
        <div style="max-width:760px;width:100%;padding:24px;border-radius:28px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);color:#eef5ff;font-family:system-ui,sans-serif">
          <h2 style="margin:0 0 10px">GoodJunk Solo Legacy Bridge</h2>
          <p style="margin:0 0 18px;color:#d8e6ff">จุดนี้ต้องแทนด้วย gameplay core เดิมของ goodjunk-solo-phaseboss-v2.js โดยตรง</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button id="gjScoreBtn">+100 Score</button>
            <button id="gjMissBtn">+1 Miss</button>
            <button id="gjMissionBtn">+1 Mission</button>
            <button id="gjEndBtn">End Game</button>
          </div>
        </div>
      </div>
    `;

    root.querySelector('#gjScoreBtn')?.addEventListener('click', () => {
      state.streak += 1;
      patchScore(100);
      setBestStreak(state.streak);
    });

    root.querySelector('#gjMissBtn')?.addEventListener('click', () => {
      state.streak = 0;
      setMiss(state.miss + 1);
      emitScore();
    });

    root.querySelector('#gjMissionBtn')?.addEventListener('click', () => {
      setMission(state.done + 1, state.total);
    });

    root.querySelector('#gjEndBtn')?.addEventListener('click', () => {
      emitEnd({
        success: state.done >= state.total,
        score: state.score,
        stars: state.done >= state.total ? 3 : 1,
        accuracy: state.done + state.miss > 0 ? Math.round((state.done / (state.done + state.miss)) * 100) : 0,
        miss: state.miss,
        bestStreak: state.bestStreak,
        missionClear: state.done,
        missionTotal: state.total,
        rewards: ['solo-legacy-bridge'],
        coachFeedback: ['เสียบ gameplay core เดิมเข้าจุดนี้'],
        nextAction: 'แทน demo buttons ด้วยระบบเกมเดิมทั้งหมด'
      });
    });
    // ===== END DEMO PLACEHOLDER =====
  }

  function start() {
    state.started = true;
  }

  function pause() {
    // map ไปยังระบบ pause เดิม ถ้ามี
  }

  function resume() {
    // map ไปยังระบบ resume เดิม ถ้ามี
  }

  function destroy() {
    state.destroyed = true;
    if (mountRoot && gameRoot && mountRoot.contains(gameRoot)) {
      mountRoot.removeChild(gameRoot);
    }
  }

  function getSummary() {
    return state.summary || {
      mode: 'solo',
      score: state.score,
      miss: state.miss,
      bestStreak: state.bestStreak,
      missionClear: state.done,
      missionTotal: state.total,
      success: false
    };
  }

  function getMetrics() {
    return {
      score: state.score,
      miss: state.miss,
      bestStreak: state.bestStreak,
      done: state.done,
      total: state.total
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

  // export ให้ adapter เรียกได้
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createGame };
  }

  W.createLegacyGoodJunkSolo = createGame;
})();