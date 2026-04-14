// === /fitness/js/shadow-breaker.js ===
// Shadow Breaker bootstrap
// PATCH v20260412r-SB-BOOTSTRAP-ASSIST-HIDE-PAD

'use strict';

import { initShadowBreaker } from './engine.js?v=20260412r';

const SB_BOOT_VERSION = 'v20260412r-SB-BOOTSTRAP-ASSIST-HIDE-PAD';
let booted = false;

function qs(key, fallback = '') {
  try {
    const v = new URL(location.href).searchParams.get(key);
    return v == null || v === '' ? fallback : v;
  } catch (_) {
    return fallback;
  }
}

function qbool(key, fallback = false) {
  const raw = String(qs(key, fallback ? '1' : '0')).toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(raw);
}

function qnum(key, fallback = 0) {
  const n = Number(qs(key, fallback));
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDuration() {
  const d = qnum('duration', qnum('time', 6));
  return [3, 6, 10].includes(d) ? d : 6;
}

function buildBootContext() {
  const origin = location.origin || '';
  const defaultHub = `${origin}/webxr-health-mobile/herohealth/hub.html`;

  const run = qs('run', 'play');
  const duration = normalizeDuration();

  return {
    patch: SB_BOOT_VERSION,

    // common ctx
    pid: qs('pid', 'anon'),
    name: qs('name', 'Hero'),
    nick: qs('nick', qs('name', 'Hero')),
    studyId: qs('studyId', ''),
    run,
    view: qs('view', 'mobile'),
    seed: qs('seed', String(Date.now())),
    hub: qs('hub', defaultHub),
    launcher: qs('launcher', ''),
    cooldown: qs('cooldown', ''),

    // game setup
    mode: qs('mode', 'mixed'),
    body: qs('body', 'standing'),
    intensity: qs('intensity', 'move'),
    duration,
    diff: qs('diff', 'normal'),

    // passthrough
    zone: qs('zone', 'fitness'),
    cat: qs('cat', 'fitness'),
    game: qs('game', 'shadowbreaker'),
    gameId: qs('gameId', 'shadowbreaker'),
    theme: qs('theme', 'shadowbreaker'),

    // adaptive / apps script
    adaptiveMode: qs('adaptiveMode', run === 'research' ? 'research_locked' : 'live'),
    appsScriptUrl: qs('appsScriptUrl', qs('api', '')),

    // flags
    trainer: qbool('trainer', false),
    debug: qbool('debug', false),
    log: qbool('log', false)
  };
}

function ensureBootUi() {
  let root = document.getElementById('sb-boot-ui');
  if (root) return root;

  root = document.createElement('div');
  root.id = 'sb-boot-ui';
  root.innerHTML = `
    <style>
      #sb-boot-ui{
        position:fixed;
        inset:0;
        z-index:9999;
        display:none;
        place-items:center;
        background:rgba(6,10,20,.72);
        backdrop-filter:blur(6px);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }
      #sb-boot-ui[data-open="1"]{
        display:grid;
      }
      #sb-boot-card{
        width:min(92vw,560px);
        border-radius:24px;
        background:#ffffff;
        color:#13233a;
        box-shadow:0 24px 64px rgba(0,0,0,.28);
        padding:20px 18px;
      }
      #sb-boot-card h2{
        margin:0 0 8px;
        font-size:22px;
      }
      #sb-boot-card p{
        margin:8px 0;
        line-height:1.6;
      }
      #sb-boot-actions{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        margin-top:14px;
      }
      .sb-boot-btn{
        appearance:none;
        border:0;
        border-radius:14px;
        padding:12px 16px;
        font-weight:700;
        cursor:pointer;
        text-decoration:none;
        display:inline-flex;
        align-items:center;
        justify-content:center;
      }
      .sb-boot-btn-primary{
        background:#3b82f6;
        color:#fff;
      }
      .sb-boot-btn-secondary{
        background:#e8f1ff;
        color:#13325b;
      }
      #sb-boot-debug{
        margin-top:10px;
        padding:10px 12px;
        border-radius:14px;
        background:#f6f9ff;
        font-size:12px;
        color:#4a5d78;
        white-space:pre-wrap;
        word-break:break-word;
      }
    </style>
    <div id="sb-boot-card" role="dialog" aria-live="polite" aria-modal="true">
      <h2 id="sb-boot-title">กำลังเริ่ม Shadow Breaker...</h2>
      <p id="sb-boot-message">กรุณารอสักครู่</p>
      <div id="sb-boot-actions"></div>
      <div id="sb-boot-debug" hidden></div>
    </div>
  `;
  document.body.appendChild(root);
  return root;
}

function showBootMessage(title, message, options = {}) {
  const root = ensureBootUi();
  const titleEl = root.querySelector('#sb-boot-title');
  const msgEl = root.querySelector('#sb-boot-message');
  const actionsEl = root.querySelector('#sb-boot-actions');
  const debugEl = root.querySelector('#sb-boot-debug');

  titleEl.textContent = title || 'Shadow Breaker';
  msgEl.textContent = message || '';
  actionsEl.innerHTML = '';
  debugEl.hidden = true;
  debugEl.textContent = '';

  if (options.debugText) {
    debugEl.hidden = false;
    debugEl.textContent = options.debugText;
  }

  (options.actions || []).forEach((a) => {
    if (a.href) {
      const link = document.createElement('a');
      link.className = `sb-boot-btn ${a.primary ? 'sb-boot-btn-primary' : 'sb-boot-btn-secondary'}`;
      link.href = a.href;
      link.textContent = a.label || 'Open';
      actionsEl.appendChild(link);
      return;
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `sb-boot-btn ${a.primary ? 'sb-boot-btn-primary' : 'sb-boot-btn-secondary'}`;
    btn.textContent = a.label || 'OK';
    btn.addEventListener('click', () => {
      try { a.onClick && a.onClick(); } catch (_) {}
    });
    actionsEl.appendChild(btn);
  });

  root.dataset.open = '1';
}

function hideBootMessage() {
  const root = document.getElementById('sb-boot-ui');
  if (root) root.dataset.open = '0';
}

function buildDebugText(ctx, errMsg = '') {
  return [
    `patch: ${SB_BOOT_VERSION}`,
    `pid: ${ctx.pid}`,
    `name: ${ctx.name}`,
    `nick: ${ctx.nick}`,
    `run: ${ctx.run}`,
    `view: ${ctx.view}`,
    `mode: ${ctx.mode}`,
    `body: ${ctx.body}`,
    `intensity: ${ctx.intensity}`,
    `duration: ${ctx.duration}`,
    `diff: ${ctx.diff}`,
    `seed: ${ctx.seed}`,
    `hub: ${ctx.hub}`,
    `launcher: ${ctx.launcher}`,
    `cooldown: ${ctx.cooldown}`,
    `adaptiveMode: ${ctx.adaptiveMode}`,
    `appsScriptUrl: ${ctx.appsScriptUrl}`,
    `trainer: ${ctx.trainer ? 1 : 0}`,
    errMsg ? `error: ${errMsg}` : ''
  ].filter(Boolean).join('\n');
}

function handleFatalBootError(err, ctx) {
  console.error('[ShadowBreaker] init failed', err);

  const msg = (err && err.message) ? err.message : String(err || 'Unknown error');

  showBootMessage(
    'เริ่มเกมไม่ได้',
    'ไม่สามารถเริ่ม Shadow Breaker ได้ กรุณารีเฟรชหน้า หรือกลับไปหน้าเลือกเกม',
    {
      debugText: ctx.debug ? buildDebugText(ctx, msg) : '',
      actions: [
        {
          label: 'รีเฟรชหน้า',
          primary: true,
          onClick: () => location.reload()
        },
        {
          label: ctx.launcher ? 'กลับ Launcher' : 'กลับ HUB',
          href: ctx.launcher || ctx.hub
        }
      ]
    }
  );
}

function logBoot(ctx) {
  if (!(ctx.debug || ctx.log)) return;
  console.log('[ShadowBreaker] bootstrap OK', {
    patch: SB_BOOT_VERSION,
    ctx
  });
}

function bootShadowBreaker() {
  if (booted) {
    console.warn('[ShadowBreaker] bootstrap skipped: already booted');
    return;
  }
  booted = true;

  const ctx = buildBootContext();

  showBootMessage('กำลังเริ่ม Shadow Breaker...', 'กำลังโหลดระบบเกม');

  if (typeof initShadowBreaker !== 'function') {
    handleFatalBootError(new Error('initShadowBreaker is not a function'), ctx);
    return;
  }

  try {
    initShadowBreaker(ctx);
    hideBootMessage();
    logBoot(ctx);
  } catch (err) {
    handleFatalBootError(err, ctx);
  }
}

window.addEventListener('error', (ev) => {
  const root = document.getElementById('sb-boot-ui');
  if (!root || root.dataset.open !== '1') return;
  console.error('[ShadowBreaker] window error', ev.error || ev.message || ev);
});

window.addEventListener('unhandledrejection', (ev) => {
  const root = document.getElementById('sb-boot-ui');
  if (!root || root.dataset.open !== '1') return;
  console.error('[ShadowBreaker] unhandled rejection', ev.reason || ev);
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootShadowBreaker, { once: true });
} else {
  bootShadowBreaker();
}