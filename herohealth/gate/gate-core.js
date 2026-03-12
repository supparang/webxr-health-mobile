// === /herohealth/gate/gate-core.js ===
// HeroHealth Gate Core
// FULL PATCH v20260312d-GATE-LEGACY-API-COMPAT-MOBILE

import {
  getGameMeta,
  getPhaseFile,
  getGameStyleFile,
  normalizeGameId
} from './gate-games.js';

import { createGateLogger } from './gate-logger.js';

console.log('[gate-core] compat v20260312d');

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
    return fallback;
  }
}

function ensureStyleFile(href, id) {
  if (!href) return;
  if (document.getElementById(id)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function setDocTitle(meta, phase) {
  const phaseText = phase === 'cooldown' ? 'Cooldown' : 'Warmup';
  const label = meta?.label || 'Gate';
  document.title = `HeroHealth — ${label} ${phaseText}`;
}

function getPhase(url) {
  const raw = String(
    qs(url, 'Phase', qs(url, 'gatePhase', qs(url, 'phase', 'warmup')))
  ).trim().toLowerCase();

  return raw === 'cooldown' ? 'cooldown' : 'warmup';
}

function getGame(url) {
  return normalizeGameId(qs(url, 'game', ''));
}

function getNextRunUrl(url) {
  const next = qs(url, 'next', '');
  if (next) return safeUrl(next, '');

  const runUrl = qs(url, 'runUrl', '');
  if (runUrl) return safeUrl(runUrl, '');

  return '';
}

function getHubUrl(url) {
  return safeUrl(qs(url, 'hub', ''), '');
}

function createNoopLogger() {
  const fn = () => {};
  return {
    log: fn,
    info: fn,
    warn: fn,
    error: fn,
    event: fn,
    flush: async () => true
  };
}

function getSafeLogger(base = {}) {
  try {
    const logger = typeof createGateLogger === 'function'
      ? createGateLogger(base)
      : null;
    if (logger && typeof logger === 'object') return logger;
  } catch (err) {
    console.warn('[gate-core] createGateLogger failed', err);
  }
  return createNoopLogger();
}

function renderError(root, title, detail = '') {
  root.innerHTML = `
    <section class="gate-error-wrap" style="padding:20px;max-width:960px;margin:0 auto;color:#e5e7eb">
      <div class="gate-error-card" style="border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.78);border-radius:24px;padding:20px">
        <div style="font-size:.82rem;letter-spacing:.08em;color:#94a3b8;margin-bottom:8px">HEROHEALTH GATE</div>
        <h1 style="margin:0 0 10px;font-size:1.45rem">${esc(title)}</h1>
        <p style="margin:0;color:#cbd5e1;line-height:1.6">${esc(detail)}</p>
      </div>
    </section>
  `;
}

function renderLoading(root, meta, phase) {
  root.innerHTML = `
    <section style="padding:20px;max-width:960px;margin:0 auto;color:#e5e7eb">
      <div style="border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.78);border-radius:24px;padding:20px">
        <div style="font-size:.82rem;letter-spacing:.08em;color:#94a3b8;margin-bottom:8px">
          ${esc(String(meta?.cat || '').toUpperCase())} • ${esc(String(phase).toUpperCase())}
        </div>
        <h1 style="margin:0 0 10px;font-size:1.45rem">${esc(meta?.label || 'Gate')}</h1>
        <p style="margin:0 0 12px;color:#cbd5e1">กำลังโหลด mini game...</p>
        <div data-gate-stats style="display:flex;gap:10px;flex-wrap:wrap;font-size:.92rem;color:#cbd5e1"></div>
      </div>
    </section>
  `;
}

function renderBuiltInSummary(root, result, ctx) {
  const isCooldown = ctx.phase === 'cooldown';
  const primaryLabel = isCooldown ? 'กลับ HUB' : 'ไปเกมหลัก';
  const primaryUrl = isCooldown ? ctx.hubUrl : (ctx.nextRunUrl || ctx.hubUrl);

  const metrics = result?.metrics && typeof result.metrics === 'object'
    ? Object.entries(result.metrics)
    : [];

  root.innerHTML = `
    <section style="padding:20px;max-width:960px;margin:0 auto;color:#e5e7eb">
      <div style="border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.78);border-radius:24px;padding:20px">
        <div style="font-size:.82rem;letter-spacing:.08em;color:#94a3b8;margin-bottom:8px">
          ${esc(String(ctx.meta?.cat || '').toUpperCase())} • ${esc(String(ctx.phase).toUpperCase())}
        </div>

        <h1 style="margin:0 0 10px;font-size:1.6rem">${esc(result?.title || ctx.defaultTitle || 'สรุปผล')}</h1>
        <p style="margin:0 0 14px;color:#cbd5e1">${esc(result?.coach?.line || '')}</p>

        ${Array.isArray(result?.lines) && result.lines.length ? `
          <div style="margin:0 0 14px">
            ${result.lines.map(line => `
              <div style="color:#cbd5e1;line-height:1.6">${esc(line)}</div>
            `).join('')}
          </div>
        ` : ''}

        <div style="display:flex;flex-wrap:wrap;gap:10px;margin:0 0 14px">
          <span style="padding:8px 12px;border-radius:999px;background:rgba(15,23,42,.9);border:1px solid rgba(148,163,184,.18)">
            คะแนน ${esc(result?.score ?? 0)}
          </span>
          <span style="padding:8px 12px;border-radius:999px;background:rgba(15,23,42,.9);border:1px solid rgba(148,163,184,.18)">
            ดาว ${esc(result?.stars ?? 1)}
          </span>
          <span style="padding:8px 12px;border-radius:999px;background:rgba(15,23,42,.9);border:1px solid rgba(148,163,184,.18)">
            ${result?.passed ? 'ผ่าน' : 'เสร็จแล้ว'}
          </span>
        </div>

        ${metrics.length ? `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin:0 0 16px">
            ${metrics.map(([k, v]) => `
              <div style="border:1px solid rgba(148,163,184,.16);border-radius:16px;padding:12px;background:rgba(15,23,42,.7)">
                <div style="font-size:.8rem;color:#94a3b8;margin-bottom:4px">${esc(k)}</div>
                <div style="font-weight:800;font-size:1.05rem">${esc(v)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${primaryUrl ? `
            <button id="hh-gate-primary" style="appearance:none;border:0;border-radius:14px;padding:12px 16px;font-weight:800;background:linear-gradient(180deg,#86efac,#22c55e);color:#052e16;cursor:pointer">
              ${esc(primaryLabel)}
            </button>
          ` : ''}

          ${ctx.hubUrl ? `
            <button id="hh-gate-hub" style="appearance:none;border:1px solid rgba(148,163,184,.18);border-radius:14px;padding:12px 16px;font-weight:800;background:rgba(15,23,42,.9);color:#e5e7eb;cursor:pointer">
              กลับ HUB
            </button>
          ` : ''}
        </div>
      </div>
    </section>
  `;

  const primaryBtn = root.querySelector('#hh-gate-primary');
  const hubBtn = root.querySelector('#hh-gate-hub');

  if (primaryBtn && primaryUrl) {
    primaryBtn.addEventListener('click', () => {
      window.location.href = primaryUrl;
    });
  }

  if (hubBtn && ctx.hubUrl) {
    hubBtn.addEventListener('click', () => {
      window.location.href = ctx.hubUrl;
    });
  }
}

function getDefaultTitle(meta, phase) {
  return phase === 'cooldown'
    ? (meta?.cooldownTitle || `${meta?.label || 'Game'} Cooldown`)
    : (meta?.warmupTitle || `${meta?.label || 'Game'} Warmup`);
}

function createLegacyApi(root, ctx, logger) {
  let latestStats = {};

  return {
    logger: {
      push(type, payload = {}) {
        logger?.log?.(type, payload);
      }
    },

    setStats(stats = {}) {
      latestStats = { ...latestStats, ...stats };

      const hud = root.querySelector('[data-gate-stats]');
      if (hud) {
        hud.innerHTML = `
          <span>เวลา: ${esc(latestStats.time ?? '-')}</span>
          <span>คะแนน: ${esc(latestStats.score ?? 0)}</span>
          <span>พลาด: ${esc(latestStats.miss ?? 0)}</span>
          <span>แม่นยำ: ${esc(latestStats.acc ?? '0%')}</span>
        `;
      }
    },

    finish(payload = {}) {
      const buffs = payload?.buffs || {};
      const score = Number(
        buffs.score ??
        payload.score ??
        latestStats.score ??
        0
      );

      const rank = String(buffs.rank || '').toUpperCase();
      const stars =
        rank === 'S' ? 3 :
        rank === 'A' ? 3 :
        rank === 'B' ? 2 :
        rank === 'C' ? 1 : 1;

      ctx?.onComplete?.({
        passed: Boolean(payload?.ok ?? true),
        title: payload?.title || ctx.defaultTitle || 'สรุปผล',
        coach: {
          line: payload?.subtitle || ''
        },
        lines: Array.isArray(payload?.lines) ? payload.lines : [],
        score,
        stars,
        metrics: {
          ...latestStats,
          ...(payload?.buffs || {})
        },
        buffs,
        markDailyDone: Boolean(payload?.markDailyDone)
      });
    }
  };
}

export async function bootGate(root) {
  if (!root) {
    console.error('[gate-core] root not found');
    return;
  }

  const url = new URL(window.location.href);
  const game = getGame(url);
  const phase = getPhase(url);
  const meta = getGameMeta(game);

  if (!meta) {
    renderError(root, 'ไม่พบเกมใน Gate Registry', `game=${game || '(empty)'}`);
    return;
  }

  const zone = qs(url, 'zone', meta.cat || '');
  const seedRaw = qs(url, 'seed', '');
  const seed = seedRaw ? (Number(seedRaw) || seedRaw) : Date.now();
  const pid = qs(url, 'pid', 'anon');
  const studyId = qs(url, 'studyId', '');
  const run = qs(url, 'run', 'play');
  const view = qs(url, 'view', 'mobile');
  const time = Number(qs(url, 'time', 20));
  const hubUrl = getHubUrl(url);
  const nextRunUrl = getNextRunUrl(url);
  const debug = qbool(url, 'debug', false);
  const defaultTitle = getDefaultTitle(meta, phase);

  const rawPhaseFields = {
    Phase: qs(url, 'Phase', ''),
    gatePhase: qs(url, 'gatePhase', ''),
    phase: qs(url, 'phase', '')
  };

  const logger = getSafeLogger({
    game,
    phase,
    zone,
    pid,
    studyId,
    run,
    view
  });

  setDocTitle(meta, phase);

  const styleFile = getGameStyleFile(game);
  if (styleFile) {
    ensureStyleFile(styleFile, `hh-gate-style-${game}`);
  }

  renderLoading(root, meta, phase);

  try {
    const modPath = getPhaseFile(game, phase);

    logger?.log?.('gate_phase_file', {
      game,
      phase,
      modPath
    });

    if (!modPath) {
      throw new Error(`ไม่พบ path ของ ${game}/${phase}`);
    }

    const mod = await import(modPath);

    if (!mod || typeof mod.mount !== 'function') {
      throw new Error(`Module ${modPath} ต้อง export mount(root, ctx, api)`);
    }

    const ctx = {
      url,
      root,
      game,
      phase,
      zone,
      meta,
      seed,
      pid,
      studyId,
      run,
      view,
      time,
      hubUrl,
      nextRunUrl,
      defaultTitle,
      debug,
      logger,
      rawPhaseFields,

      onComplete(result = {}) {
        try {
          logger?.log?.('gate_complete', {
            game,
            phase,
            zone,
            pid,
            studyId,
            result
          });

          renderBuiltInSummary(root, result, {
            game,
            phase,
            zone,
            meta,
            hubUrl,
            nextRunUrl,
            defaultTitle
          });
        } catch (err) {
          logger?.error?.('gate_complete_fail', {
            message: String(err?.message || err)
          });
          console.error('[gate-core onComplete]', err);
          renderError(root, 'สรุปผลไม่สำเร็จ', String(err?.message || err));
        }
      }
    };

    const api = createLegacyApi(root, ctx, logger);
    const controller = await mod.mount(root, ctx, api);

    logger?.log?.('gate_phase_loaded', {
      game,
      phase,
      exports: Object.keys(mod || {}),
      hasStart: Boolean(controller && typeof controller.start === 'function'),
      hasDestroy: Boolean(controller && typeof controller.destroy === 'function')
    });

    logger?.log?.('gate_boot', {
      game,
      phase,
      zone,
      pid,
      studyId,
      run,
      view,
      time,
      rawPhaseFields,
      hubUrl,
      nextRunUrl
    });

    if (controller && typeof controller.start === 'function') {
      controller.start();
    }
  } catch (err) {
    logger?.error?.('gate_load_fail', {
      game,
      phase,
      message: String(err?.message || err)
    });

    console.error('[gate-core] load fail', err);
    renderError(
      root,
      'โหลด mini game ไม่สำเร็จ',
      `${game}/${phase}: ${String(err?.message || err)}`
    );
  }
}