// === /herohealth/gate/gate-core.js ===
// HeroHealth Gate Core
// PATCH v20260313b-GATE-CORE-LOGGER-SAFE-ALLZONES
// ✅ logger.push safe wrapper
// ✅ supports phase / gatePhase / mode
// ✅ warmup -> next(run)
// ✅ cooldown -> hub
// ✅ strips gate params before continue
// ✅ better error details when module import fails
// ✅ shared for all zones

import {
  buildCtx,
  getDailyDone,
  setDailyDone,
  setText,
  sanitizeBuffs,
  saveLastSummary
} from './gate-common.js?v=20260313a';

import { mountSummaryLayer, mountToast } from './gate-summary.js?v=20260313a';
import { createGateLogger } from './gate-logger.js?v=20260313b-GATE-LOGGER-PUSH-FIX';
import { GATE_GAMES, getGameMeta } from './gate-games.js?v=20260313a';

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function qs(url, key, fallback = '') {
  try {
    return url.searchParams.get(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function qbool(url, key, fallback = false) {
  const v = String(qs(url, key, fallback ? '1' : '0')).toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(v);
}

function safeUrl(raw, fallback = '') {
  try {
    if (!raw) return fallback;
    return new URL(raw, window.location.href).toString();
  } catch {
    return fallback || '';
  }
}

function detectPhase(url) {
  const gatePhase = String(qs(url, 'gatePhase', '')).toLowerCase();
  const phase = String(qs(url, 'phase', '')).toLowerCase();
  const mode = String(qs(url, 'mode', '')).toLowerCase();

  const p = gatePhase || phase || mode || 'warmup';
  if (p === 'cooldown') return 'cooldown';
  return 'warmup';
}

function titleOf(ctx) {
  const meta = getGameMeta(ctx.game) || {
    label: ctx.game || 'game',
    warmupTitle: ctx.game || 'game',
    cooldownTitle: ctx.game || 'game'
  };

  return ctx.mode === 'cooldown'
    ? `Cooldown — ${meta.cooldownTitle || meta.label || ctx.game}`
    : `Warmup — ${meta.warmupTitle || meta.label || ctx.game}`;
}

function subtitleOf(ctx) {
  if (ctx.mode === 'cooldown') {
    return `ผ่อนคลายหลังจบเกม ${ctx.game}`;
  }
  return `เตรียมความพร้อมก่อนเข้าเกม ${ctx.game}`;
}

function getPhaseModulePath(ctx) {
  const meta = getGameMeta(ctx.game);
  if (!meta) return '';

  if (ctx.mode === 'cooldown') {
    return meta.cooldown || '';
  }
  return meta.warmup || '';
}

function stripGateParams(urlLike) {
  try {
    const u = new URL(urlLike, window.location.href);

    [
      'gatePhase', 'phase', 'mode',
      'gate', 'gateDone',
      'summary', 'cooldown',
      'warmup', 'cooldownDone',
      'daily', 'gateResult'
    ].forEach(k => u.searchParams.delete(k));

    return u.toString();
  } catch {
    return String(urlLike || '');
  }
}

function buildContinueUrl(ctx) {
  if (ctx.mode === 'cooldown') {
    return safeUrl(ctx.hub, './hub.html');
  }

  const nextUrl = safeUrl(ctx.next, '');
  if (nextUrl) return stripGateParams(nextUrl);

  const runUrl = safeUrl(ctx.runUrl, '');
  if (runUrl) return stripGateParams(runUrl);

  const meta = getGameMeta(ctx.game);
  const launcher = safeUrl(meta?.next || meta?.run || '', '');
  if (launcher) return stripGateParams(launcher);

  return safeUrl(ctx.hub, './hub.html');
}

function ensureRoot(root) {
  if (root) return root;
  const el = document.getElementById('gate-app');
  if (el) return el;
  throw new Error('gate root not found');
}

function renderShell(root, ctx) {
  root.innerHTML = `
    <div class="gate-shell">
      <div class="gate-hero">
        <div class="gate-kicker">${ctx.mode.toUpperCase()}</div>
        <h1 class="gate-title">${esc(titleOf(ctx))}</h1>
        <div class="gate-subtitle">${esc(subtitleOf(ctx))}</div>
      </div>

      <div class="gate-meta">
        <div class="gate-chip">PHASE: ${esc(ctx.mode)}</div>
        <div class="gate-chip">CAT: ${esc(ctx.cat || '-')}</div>
        <div class="gate-chip">GAME: ${esc(ctx.game || '-')}</div>
        <div class="gate-chip">DAILY: ${ctx.dailyDone ? 'DONE' : 'NEW'}</div>
      </div>

      <div class="gate-stats">
        <div class="gate-stat">
          <div class="gate-stat-label">TIME</div>
          <div class="gate-stat-value" id="gate-time">${esc(String(ctx.time || 0))}s</div>
        </div>
        <div class="gate-stat">
          <div class="gate-stat-label">SCORE</div>
          <div class="gate-stat-value" id="gate-score">0</div>
        </div>
        <div class="gate-stat">
          <div class="gate-stat-label">MISS</div>
          <div class="gate-stat-value" id="gate-miss">0</div>
        </div>
        <div class="gate-stat">
          <div class="gate-stat-label">ACC / PROGRESS</div>
          <div class="gate-stat-value" id="gate-acc">0%</div>
        </div>
      </div>

      <div class="gate-card" id="gate-card">
        <div class="gate-card-title" id="gate-card-title">กำลังเตรียมมินิเกม...</div>
        <div class="gate-card-sub" id="gate-card-sub">โปรดรอสักครู่</div>
        <div id="gate-mount"></div>
      </div>

      <div class="gate-actions">
        <button class="gate-btn gate-btn-primary" id="gate-continue" hidden>ไปต่อ</button>
        <a class="gate-btn gate-btn-ghost" id="gate-backhub" href="${esc(safeUrl(ctx.hub, './hub.html'))}">กลับ HUB</a>
      </div>
    </div>
  `;
}

function createLiveApi(root, ctx) {
  const elScore = root.querySelector('#gate-score');
  const elMiss = root.querySelector('#gate-miss');
  const elAcc = root.querySelector('#gate-acc');
  const elTitle = root.querySelector('#gate-card-title');
  const elSub = root.querySelector('#gate-card-sub');
  const elContinue = root.querySelector('#gate-continue');

  let state = {
    score: 0,
    miss: 0,
    acc: 0,
    progress: 0,
    done: false,
    passed: false,
    summary: null
  };

  function setScore(v) {
    state.score = Number(v || 0);
    if (elScore) elScore.textContent = String(state.score);
  }

  function setMiss(v) {
    state.miss = Number(v || 0);
    if (elMiss) elMiss.textContent = String(state.miss);
  }

  function setAcc(v) {
    const n = Math.max(0, Math.min(100, Number(v || 0)));
    state.acc = n;
    if (elAcc) elAcc.textContent = `${Math.round(n)}%`;
  }

  function setProgress(v) {
    const n = Math.max(0, Math.min(100, Number(v || 0)));
    state.progress = n;
    if (elAcc) elAcc.textContent = `${Math.round(n)}%`;
  }

  function setTitle(v) {
    if (elTitle) elTitle.textContent = String(v || '');
  }

  function setSub(v) {
    if (elSub) elSub.textContent = String(v || '');
  }

  function complete(result = {}) {
    state.done = true;
    state.passed = !!result.passed;
    state.summary = { ...result };

    if (result.score != null) setScore(result.score);
    if (result.miss != null) setMiss(result.miss);
    if (result.acc != null) setAcc(result.acc);
    if (result.progress != null) setProgress(result.progress);

    if (elContinue) {
      elContinue.hidden = false;
      elContinue.textContent = ctx.mode === 'cooldown' ? 'กลับ HUB' : 'เข้าเกมหลัก';
    }
  }

  function getState() {
    return { ...state };
  }

  return {
    setScore,
    setMiss,
    setAcc,
    setProgress,
    setTitle,
    setSub,
    complete,
    getState
  };
}

export async function bootGate(rootEl) {
  const root = ensureRoot(rootEl);
  const url = new URL(window.location.href);

  const phase = detectPhase(url);

  const ctx = buildCtx(url);
  ctx.mode = phase;
  ctx.phase = phase;
  ctx.game = String(ctx.game || qs(url, 'game', '')).toLowerCase();
  ctx.cat = String(ctx.cat || qs(url, 'cat', '')).toLowerCase();
  ctx.theme = String(ctx.theme || qs(url, 'theme', '')).toLowerCase();
  ctx.pid = ctx.pid || qs(url, 'pid', 'anon');
  ctx.run = ctx.run || qs(url, 'run', 'play');
  ctx.view = ctx.view || qs(url, 'view', 'pc');
  ctx.diff = ctx.diff || qs(url, 'diff', 'easy');
  ctx.seed = ctx.seed || qs(url, 'seed', '');
  ctx.hub = safeUrl(ctx.hub || qs(url, 'hub', './hub.html'), './hub.html');
  ctx.time = Number(ctx.time || qs(url, 'time', 60) || 60);
  ctx.next = safeUrl(ctx.next || qs(url, 'next', ''), '');
  ctx.runUrl = safeUrl(ctx.runUrl || qs(url, 'runUrl', ''), '');
  ctx.zone = String(ctx.zone || qs(url, 'zone', ''), '').toLowerCase();

  ctx.dailyDone = !!getDailyDone(ctx);

  const logger = createGateLogger(ctx);

  function safeLog(type, payload = {}) {
    try {
      if (logger && typeof logger.push === 'function') {
        return logger.push(type, payload);
      }
      console.warn('[gate] logger.push unavailable', logger, type, payload);
    } catch (err) {
      console.warn('[gate] safeLog failed', err);
    }
  }

  safeLog('boot', {
    href: window.location.href,
    detectedPhase: phase
  });

  renderShell(root, ctx);

  const mount = root.querySelector('#gate-mount');
  const btnContinue = root.querySelector('#gate-continue');
  const btnBackHub = root.querySelector('#gate-backhub');

  if (btnBackHub) {
    btnBackHub.href = safeUrl(ctx.hub, './hub.html');
  }

  const live = createLiveApi(root, ctx);
  const toast = mountToast?.(root);
  const summaryLayer = mountSummaryLayer?.(root);

  const continueUrl = buildContinueUrl(ctx);

  function goNext() {
    const target = stripGateParams(continueUrl || ctx.hub || './hub.html');
    safeLog('continue', { target });
    window.location.href = target;
  }

  if (btnContinue) {
    btnContinue.addEventListener('click', goNext);
  }

  const modulePath = getPhaseModulePath(ctx);
  safeLog('resolve-module', { modulePath });

  if (!modulePath) {
    live.setTitle('ยังไม่พบมินิเกม');
    live.setSub(`ไม่พบ path ของ ${ctx.mode} สำหรับเกม ${ctx.game}`);
    safeLog('module-missing', { game: ctx.game, mode: ctx.mode });
    return;
  }

  try {
    live.setTitle('กำลังโหลดมินิเกม...');
    live.setSub(modulePath);

    const mod = await import(modulePath);
    safeLog('module-loaded', {
      modulePath,
      keys: Object.keys(mod || {})
    });

    const mountFn =
      mod.mountGateGame ||
      mod.mountWarmup ||
      mod.mountCooldown ||
      mod.default;

    if (typeof mountFn !== 'function') {
      throw new Error(`module has no mount function: ${modulePath}`);
    }

    const api = {
      ctx,
      root,
      mount,
      live,
      log: safeLog,
      toast,
      summaryLayer,
      finish(result = {}) {
        const passed = result.passed !== false;
        const summary = {
          ...result,
          passed,
          game: ctx.game,
          cat: ctx.cat,
          mode: ctx.mode,
          phase: ctx.phase,
          ts: Date.now()
        };

        safeLog('finish', summary);

        try {
          saveLastSummary?.({
            source: 'gate',
            game: ctx.game,
            cat: ctx.cat,
            mode: ctx.mode,
            score: Number(summary.score || 0),
            miss: Number(summary.miss || 0),
            acc: Number(summary.acc || summary.progress || 0),
            passed,
            ts: summary.ts
          });
        } catch {}

        try {
          setDailyDone?.(ctx, true);
        } catch {}

        live.complete(summary);

        if (summaryLayer && typeof summaryLayer.show === 'function') {
          summaryLayer.show(summary, {
            title: ctx.mode === 'cooldown' ? 'เสร็จสิ้นช่วง cooldown' : 'ผ่าน warmup แล้ว'
          });
        }

        if (toast && typeof toast.show === 'function') {
          toast.show(
            ctx.mode === 'cooldown'
              ? 'เสร็จแล้ว กลับไป HUB ได้เลย'
              : 'พร้อมแล้ว เข้าเกมหลักได้เลย'
          );
        }
      }
    };

    await mountFn(api);

    safeLog('module-mounted', {
      modulePath,
      game: ctx.game,
      mode: ctx.mode
    });
  } catch (err) {
    console.error('[gate] boot failed', err);

    safeLog('boot-error', {
      modulePath,
      message: err?.message || String(err),
      stack: err?.stack || ''
    });

    live.setTitle('เล่นมินิเกมไม่สำเร็จ');
    live.setSub(`${err?.message || err}`);

    if (mount) {
      mount.innerHTML = `
        <div class="gate-error">
          <div><strong>โหลดไม่สำเร็จ:</strong> ${esc(modulePath)}</div>
          <div style="margin-top:8px"><strong>สาเหตุ:</strong> ${esc(err?.message || String(err))}</div>
        </div>
      `;
    }

    if (toast && typeof toast.show === 'function') {
      toast.show('มินิเกมโหลดไม่สำเร็จ');
    }
  }
}