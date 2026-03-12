// === /herohealth/gate/gate-core.js ===
// HeroHealth Gate Core
// FULL PATCH v20260312-ALL-ZONES-GATE-CORE

import {
  getGameMeta,
  getPhaseFile,
  getGameStyleFile,
  normalizeGameId
} from './gate-games.js';

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
  const raw = String(qs(url, 'phase', 'warmup')).trim().toLowerCase();
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
        <p style="margin:0;color:#cbd5e1">กำลังโหลด mini game...</p>
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

async function loadGameModule(meta, phase) {
  const modPath = getPhaseFile(meta?.theme || meta?.label || '', phase);
  if (!modPath) {
    throw new Error(`ไม่พบไฟล์ phase=${phase}`);
  }
  return import(modPath);
}

function getDefaultTitle(meta, phase) {
  return phase === 'cooldown'
    ? (meta?.cooldownTitle || `${meta?.label || 'Game'} Cooldown`)
    : (meta?.warmupTitle || `${meta?.label || 'Game'} Warmup`);
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
  const seed = Number(qs(url, 'seed', Date.now()));
  const pid = qs(url, 'pid', 'anon');
  const studyId = qs(url, 'studyId', '');
  const run = qs(url, 'run', 'play');
  const view = qs(url, 'view', 'mobile');
  const hubUrl = getHubUrl(url);
  const nextRunUrl = getNextRunUrl(url);
  const debug = qbool(url, 'debug', false);
  const defaultTitle = getDefaultTitle(meta, phase);

  setDocTitle(meta, phase);

  const styleFile = getGameStyleFile(game);
  if (styleFile) {
    ensureStyleFile(styleFile, `hh-gate-style-${game}`);
  }

  renderLoading(root, meta, phase);

  try {
    const modPath = getPhaseFile(game, phase);
    if (!modPath) {
      throw new Error(`ไม่พบ path ของ ${game}/${phase}`);
    }

    const mod = await import(modPath);
    if (!mod || typeof mod.mount !== 'function') {
      throw new Error(`Module ${modPath} ต้อง export mount(root, ctx)`);
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
      hubUrl,
      nextRunUrl,
      defaultTitle,
      debug,

      onComplete(result) {
        try {
          console.log('[gate complete]', {
            game,
            phase,
            zone,
            pid,
            studyId,
            result
          });

          // TODO:
          // - ผูก gate-logger.js
          // - ผูก gate-summary.js
          // ตอนนี้ใช้ built-in summary ไปก่อน

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
          console.error('[gate-core onComplete]', err);
          renderError(root, 'สรุปผลไม่สำเร็จ', String(err?.message || err));
        }
      }
    };

    mod.mount(root, ctx);
  } catch (err) {
    console.error('[gate-core] load fail', err);
    renderError(
      root,
      'โหลด mini game ไม่สำเร็จ',
      `${game}/${phase}: ${String(err?.message || err)}`
    );
  }
}
