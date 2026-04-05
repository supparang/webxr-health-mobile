import { getNutritionCtx, withMergedQuery } from './nutrition-params.js';
import { createSeededRng } from './nutrition-rng.js';
import { createNutritionLogger } from './nutrition-logger.js';
import { persistSummary, buildSummaryHtml } from './nutrition-summary.js';

function ensureStyles() {
  if (document.getElementById('hnzs-shell-style')) return;

  const style = document.createElement('style');
  style.id = 'hnzs-shell-style';
  style.textContent = `
    :root{
      --hnzs-bg:#081427;
      --hnzs-card:rgba(10,22,48,.86);
      --hnzs-stroke:rgba(255,255,255,.12);
      --hnzs-text:#eef5ff;
      --hnzs-muted:#b6cae8;
      --hnzs-primary:#53d67e;
      --hnzs-accent:#ffd24a;
      --hnzs-danger:#ff6e79;
      --hnzs-radius:22px;
      --hnzs-shadow:0 18px 44px rgba(0,0,0,.32);
    }
    .hnzs-shell{min-height:100vh;color:var(--hnzs-text);background:radial-gradient(circle at top,#16396c 0%,#0b1f41 45%,#071225 100%);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;flex-direction:column}
    .hnzs-bar{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:12px 14px;position:sticky;top:0;z-index:30;background:rgba(5,10,24,.48);backdrop-filter:blur(12px)}
    .hnzs-left,.hnzs-right{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
    .hnzs-pill,.hnzs-btn{border:1px solid var(--hnzs-stroke);background:var(--hnzs-card);color:var(--hnzs-text);border-radius:999px;padding:10px 14px;font:inherit}
    .hnzs-btn{cursor:pointer}
    .hnzs-stage-wrap{flex:1;display:flex;flex-direction:column;padding:12px;gap:12px}
    .hnzs-stage{flex:1;min-height:56vh;border-radius:28px;border:1px solid var(--hnzs-stroke);box-shadow:var(--hnzs-shadow);background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.02));position:relative;overflow:hidden}
    .hnzs-overlay{position:fixed;inset:0;background:rgba(4,8,18,.72);display:flex;align-items:center;justify-content:center;padding:16px;z-index:60}
    .hnzs-hidden{display:none!important}
    .hnzs-summary-card,.hnzs-panel{width:min(720px,100%);background:var(--hnzs-card);border:1px solid var(--hnzs-stroke);border-radius:28px;box-shadow:var(--hnzs-shadow);padding:20px}
    .hnzs-summary-top{display:flex;align-items:center;justify-content:space-between;gap:16px}
    .hnzs-score-pill{min-width:88px;text-align:center;padding:16px 18px;border-radius:18px;background:rgba(83,214,126,.16);font-size:28px;font-weight:800}
    .hnzs-kicker{font-size:12px;letter-spacing:.16em;color:var(--hnzs-muted);text-transform:uppercase}
    .hnzs-summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0}
    .hnzs-summary-grid>div{display:flex;justify-content:space-between;gap:10px;padding:12px 14px;border-radius:16px;background:rgba(255,255,255,.04)}
    .hnzs-chip-row{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
    .hnzs-chip{padding:8px 12px;border-radius:999px;background:rgba(255,210,74,.16);border:1px solid rgba(255,210,74,.28)}
    .hnzs-feedback{margin:14px 0 0;padding-left:18px;color:var(--hnzs-muted)}
    .hnzs-next{margin:14px 0 0;color:var(--hnzs-text)}
    .hnzs-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
    .hnzs-btn-primary{background:linear-gradient(180deg,#5be38b,#2cc267);color:#072112;border:none}
    .hnzs-btn-accent{background:linear-gradient(180deg,#ffe171,#f5bf2d);color:#362100;border:none}
  `;
  document.head.appendChild(style);
}

function fmtTime(sec) {
  sec = Math.max(0, Math.floor(Number(sec) || 0));
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export async function bootNutritionShell({
  gameId,
  gameTitle,
  mode,
  mountSelector = '#gameMount',
  adapterFactory,
  onBeforeStart,
  onAfterMount
}) {
  if (typeof adapterFactory !== 'function') {
    throw new Error('adapterFactory is required');
  }

  ensureStyles();

  const ctx = getNutritionCtx({ gameId, game: gameId, gameId, mode: mode || undefined });
  const rng = createSeededRng(ctx.seed);
  const logger = createNutritionLogger(ctx);
  const detachAutoFlush = logger.bindAutoFlush();

  logger.log('session_start', { title: gameTitle || gameId });

  const mount = document.querySelector(mountSelector) || document.body;
  mount.innerHTML = `
    <div class="hnzs-shell">
      <div class="hnzs-bar">
        <div class="hnzs-left">
          <div class="hnzs-pill" data-role="title">${escapeHtml(gameTitle || gameId || 'Game')}</div>
          <div class="hnzs-pill" data-role="mode">${escapeHtml(ctx.mode)}</div>
        </div>
        <div class="hnzs-right">
          <div class="hnzs-pill" data-role="score">Score: 0</div>
          <div class="hnzs-pill" data-role="mission">Mission: 0/0</div>
          <div class="hnzs-pill" data-role="timer">${fmtTime(ctx.time)}</div>
          <button class="hnzs-btn" data-action="pause">Pause</button>
          <button class="hnzs-btn" data-action="hub">Hub</button>
        </div>
      </div>
      <div class="hnzs-stage-wrap">
        <div class="hnzs-stage" data-role="stage"></div>
      </div>
      <div class="hnzs-overlay hnzs-hidden" data-role="pauseOverlay">
        <div class="hnzs-panel">
          <h2>Paused</h2>
          <div class="hnzs-actions">
            <button class="hnzs-btn hnzs-btn-primary" data-action="resume">Resume</button>
            <button class="hnzs-btn" data-action="hubFromPause">Back to Hub</button>
          </div>
        </div>
      </div>
      <div class="hnzs-overlay hnzs-hidden" data-role="summaryOverlay"></div>
    </div>
  `;

  const root = mount.querySelector('.hnzs-shell');
  const stage = root.querySelector('[data-role="stage"]');
  const scoreEl = root.querySelector('[data-role="score"]');
  const missionEl = root.querySelector('[data-role="mission"]');
  const timerEl = root.querySelector('[data-role="timer"]');
  const pauseOverlay = root.querySelector('[data-role="pauseOverlay"]');
  const summaryOverlay = root.querySelector('[data-role="summaryOverlay"]');

  let ended = false;
  let paused = false;
  let score = 0;
  let missionDone = 0;
  let missionTotal = 0;
  let timeLeft = Number(ctx.time) || 0;
  let timerId = 0;

  const shellApi = {
    ctx,
    rng,
    logger,
    setScore(next) {
      score = Number(next) || 0;
      scoreEl.textContent = `Score: ${score}`;
      logger.log('score_update', { score });
    },
    patchScore(delta = 0) {
      shellApi.setScore(score + (Number(delta) || 0));
    },
    setMission(done = 0, total = 0) {
      missionDone = Number(done) || 0;
      missionTotal = Number(total) || 0;
      missionEl.textContent = `Mission: ${missionDone}/${missionTotal}`;
      logger.log('mission_update', { done: missionDone, total: missionTotal });
    },
    setTime(nextSec) {
      timeLeft = Math.max(0, Math.floor(Number(nextSec) || 0));
      timerEl.textContent = fmtTime(timeLeft);
    },
    emit(name, detail = {}) {
      logger.log(name, detail);
    },
    endGame(rawSummary = {}) {
      if (ended) return;
      ended = true;
      stopTimer();
      const summary = persistSummary(ctx, {
        gameId: gameId || ctx.gameId,
        gameTitle: gameTitle || gameId || ctx.gameId,
        mode: ctx.mode,
        score,
        durationSec: Number(ctx.time) - timeLeft,
        missionClear: missionDone,
        missionTotal,
        ...rawSummary
      });
      logger.log('game_end', { summary });
      logger.flush({ reason: 'game_end', summary }).catch(() => {});
      showSummary(summary);
    },
    goHub() {
      location.href = ctx.hub;
    },
    buildHubUrl(extra = {}) {
      return withMergedQuery(ctx.hub, extra);
    }
  };

  if (typeof onBeforeStart === 'function') {
    await onBeforeStart(shellApi);
  }

  const adapter = await adapterFactory(ctx, shellApi);
  if (!adapter || typeof adapter.mount !== 'function') {
    throw new Error('adapterFactory must return adapter with mount(root)');
  }

  await adapter.mount(stage);
  if (typeof adapter.start === 'function') {
    await adapter.start();
  }
  logger.log('game_start', { gameId: ctx.gameId, mode: ctx.mode });
  startTimer();

  if (typeof onAfterMount === 'function') {
    onAfterMount({ root, stage, adapter, shellApi });
  }

  root.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');

    if (action === 'pause') {
      if (ended) return;
      paused = true;
      stopTimer();
      pauseOverlay.classList.remove('hnzs-hidden');
      logger.log('game_pause');
      if (typeof adapter.pause === 'function') await adapter.pause();
      return;
    }

    if (action === 'resume') {
      paused = false;
      pauseOverlay.classList.add('hnzs-hidden');
      logger.log('game_resume');
      if (typeof adapter.resume === 'function') await adapter.resume();
      startTimer();
      return;
    }

    if (action === 'hub' || action === 'hubFromPause') {
      if (!ended) logger.flush({ reason: 'hub_exit' }).catch(() => {});
      location.href = ctx.hub;
      return;
    }

    if (action === 'replay') {
      location.href = withMergedQuery(location.href, { seed: String(Date.now()) });
      return;
    }

    if (action === 'cooldown') {
      const cooldownUrl = new URL('./warmup-gate.html', ctx.hub);
      cooldownUrl.search = new URLSearchParams({
        pid: ctx.pid,
        name: ctx.name,
        studyId: ctx.studyId,
        zone: ctx.zone,
        cat: ctx.cat,
        game: ctx.game,
        gameId: ctx.gameId,
        mode: ctx.mode,
        diff: ctx.diff,
        time: String(ctx.time),
        seed: ctx.seed,
        hub: ctx.hub,
        view: ctx.view,
        run: ctx.run,
        phase: 'cooldown',
        cooldown: '1'
      }).toString();
      location.href = cooldownUrl.toString();
    }
  });

  function startTimer() {
    stopTimer();
    timerId = window.setInterval(async () => {
      if (paused || ended) return;
      timeLeft -= 1;
      shellApi.setTime(timeLeft);
      if (typeof adapter.tick === 'function') {
        await adapter.tick(timeLeft);
      }
      if (timeLeft <= 0) {
        shellApi.endGame(typeof adapter.getSummary === 'function' ? adapter.getSummary() : {});
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = 0;
    }
  }

  function showSummary(summary) {
    summaryOverlay.innerHTML = `
      ${buildSummaryHtml(summary)}
      <div class="hnzs-actions">
        <button class="hnzs-btn hnzs-btn-primary" data-action="replay">Play Again</button>
        <button class="hnzs-btn hnzs-btn-accent" data-action="cooldown">Cooldown</button>
        <button class="hnzs-btn" data-action="hub">Back to Hub</button>
      </div>
    `;
    summaryOverlay.classList.remove('hnzs-hidden');
    logger.log('summary_view', { score: summary.score, stars: summary.stars });
  }

  window.addEventListener('beforeunload', () => {
    try {
      if (!ended) logger.flush({ reason: 'beforeunload' });
    } catch {}
    try { detachAutoFlush?.(); } catch {}
  }, { once: true });

  return {
    ctx,
    root,
    stage,
    adapter,
    shellApi,
    destroy() {
      stopTimer();
      logger.end();
      detachAutoFlush?.();
      if (typeof adapter.destroy === 'function') adapter.destroy();
    }
  };
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}