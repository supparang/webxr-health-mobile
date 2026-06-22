// === /herohealth/gate/gate-core.js ===
// FULL REPLACEMENT v20260621-GATE-CORE-SYNTAX-STABLE-V10
// Shared HeroHealth Warmup/Cooldown Gate runtime.
// Designed to be safe when a game phase module fails: it always shows a usable fallback.

import * as GateGames from './gate-games.js?v=20260621-gate-games-syntax-stable-v10';

const PATCH = 'v20260621-GATE-CORE-SYNTAX-STABLE-V10';
const STORAGE_NS = 'HHA_GATE_DONE_V1';
const LAST_SUMMARY_KEY = 'HHA_LAST_SUMMARY';
const MAX_HISTORY = 40;

const normalizeGameId =
  typeof GateGames.normalizeGameId === 'function'
    ? GateGames.normalizeGameId
    : (id = '') => String(id || '').trim().toLowerCase();

const getGameMeta =
  typeof GateGames.getGameMeta === 'function'
    ? GateGames.getGameMeta
    : (() => null);

const getPhaseFile =
  typeof GateGames.getPhaseFile === 'function'
    ? GateGames.getPhaseFile
    : (() => '');

const getGameStyleFile =
  typeof GateGames.getGameStyleFile === 'function'
    ? GateGames.getGameStyleFile
    : (() => '');

function getRunCandidates(gameId = '') {
  try {
    if (typeof GateGames.getRunCandidates === 'function') {
      const list = GateGames.getRunCandidates(gameId);
      if (Array.isArray(list) && list.length) return list.filter(Boolean);
    }
  } catch (_) {}

  const meta = getGameMeta(gameId) || {};
  if (Array.isArray(meta.runCandidates) && meta.runCandidates.length) {
    return meta.runCandidates.filter(Boolean);
  }
  if (typeof GateGames.getRunFile === 'function') {
    try {
      const one = GateGames.getRunFile(gameId);
      if (one) return [one];
    } catch (_) {}
  }
  return [meta.runFile || meta.run].filter(Boolean);
}

function text(value = '', fallback = '') {
  const out = String(value == null ? '' : value).trim();
  return out || fallback;
}

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function boolParam(params, name) {
  return ['1', 'true', 'yes', 'on'].includes(
    String(params.get(name) || '').trim().toLowerCase()
  );
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function todayBangkok() {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());

    const map = Object.fromEntries(
      parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value])
    );
    return `${map.year}-${map.month}-${map.day}`;
  } catch (_) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

function dailyKey(ctx) {
  return [
    STORAGE_NS,
    text(ctx.pid, 'anon'),
    text(ctx.zone || ctx.cat, 'general').toLowerCase(),
    text(ctx.game, 'game').toLowerCase(),
    text(ctx.phase, 'warmup').toLowerCase(),
    todayBangkok()
  ].join(':');
}

function getDone(ctx) {
  try {
    return localStorage.getItem(dailyKey(ctx)) === '1';
  } catch (_) {
    return false;
  }
}

function setDone(ctx, done = true) {
  try {
    localStorage.setItem(dailyKey(ctx), done ? '1' : '0');
  } catch (_) {}
}

function saveSummary(ctx, payload = {}) {
  try {
    const entry = {
      ts: Date.now(),
      patch: PATCH,
      game: ctx.game,
      phase: ctx.phase,
      pid: ctx.pid,
      ...payload
    };
    localStorage.setItem(LAST_SUMMARY_KEY, JSON.stringify(entry));

    const history = JSON.parse(localStorage.getItem(`${LAST_SUMMARY_KEY}_HISTORY`) || '[]');
    const list = Array.isArray(history) ? history : [];
    list.unshift(entry);
    localStorage.setItem(
      `${LAST_SUMMARY_KEY}_HISTORY`,
      JSON.stringify(list.slice(0, MAX_HISTORY))
    );
  } catch (_) {}
}

function readCtx() {
  const params = new URLSearchParams(location.search);
  const rawGame = params.get('game') || params.get('gameId') || params.get('theme') || '';
  const game = normalizeGameId(rawGame);
  const meta = getGameMeta(game) || null;
  const rawPhase = text(params.get('phase') || params.get('gatePhase'), 'warmup').toLowerCase();
  const phase = rawPhase === 'cooldown' ? 'cooldown' : 'warmup';

  return {
    patch: PATCH,
    params,
    rawGame,
    game,
    meta,
    phase,

    pid: text(params.get('pid') || params.get('playerId') || params.get('studentId'), 'anon'),
    name: text(params.get('name') || params.get('studentName')),
    studentId: text(params.get('studentId')),
    playerId: text(params.get('playerId')),
    classId: text(params.get('classId')),
    section: text(params.get('section')),

    diff: text(params.get('diff'), 'normal'),
    time: text(params.get('time'), '60'),
    view: text(params.get('view'), 'mobile'),
    mode: text(params.get('mode')),
    run: text(params.get('run'), 'play'),

    cat: text(params.get('cat') || params.get('zone') || (meta && meta.cat)),
    zone: text(params.get('zone') || params.get('cat') || (meta && meta.cat)),
    hub: text(params.get('hub')),
    hubRoot: text(params.get('hubRoot')),
    launcher: text(params.get('launcher')),
    next: text(params.get('next')),
    cdnext: text(params.get('cdnext')),
    plannerReturn: text(params.get('plannerReturn') || params.get('plannerReturnUrl')),
    forceGate:
      boolParam(params, 'forcegate') ||
      boolParam(params, 'resetGate') ||
      boolParam(params, 'plannerForceGate')
  };
}

function absoluteUrl(raw, fallback = '') {
  try {
    return raw ? new URL(raw, location.href).toString() : fallback;
  } catch (_) {
    return fallback;
  }
}

function withContext(raw, ctx) {
  const href = absoluteUrl(raw, '');
  if (!href) return '';

  try {
    const url = new URL(href);
    [
      'pid', 'name', 'studentId', 'playerId', 'classId', 'section',
      'diff', 'time', 'view', 'mode', 'cat', 'zone', 'hub', 'hubRoot',
      'launcher', 'plannerReturn'
    ].forEach(key => {
      const value = ctx[key];
      if (value && !url.searchParams.get(key)) url.searchParams.set(key, value);
    });

    return url.toString();
  } catch (_) {
    return href;
  }
}

function hubHref(ctx) {
  if (ctx.hub) return withContext(ctx.hub, ctx);
  if (ctx.hubRoot) return withContext(ctx.hubRoot, ctx);
  return new URL('../hub.html', import.meta.url).toString();
}

function runHref(ctx) {
  const explicit = ctx.params.get('runFile') || ctx.params.get('runUrl') || '';
  const candidates = [explicit, ...getRunCandidates(ctx.game)].filter(Boolean);

  for (const candidate of candidates) {
    const href = withContext(candidate, ctx);
    if (href) return href;
  }

  return hubHref(ctx);
}

function completionHref(ctx, payload = {}) {
  if (payload && payload.nextHref) return withContext(payload.nextHref, ctx);
  if (ctx.phase === 'cooldown' && ctx.cdnext) return withContext(ctx.cdnext, ctx);
  if (ctx.next) return withContext(ctx.next, ctx);
  if (ctx.plannerReturn) return withContext(ctx.plannerReturn, ctx);
  return ctx.phase === 'warmup' ? runHref(ctx) : hubHref(ctx);
}

function ensureStyle() {
  if (document.getElementById('hha-gate-core-style')) return;

  const style = document.createElement('style');
  style.id = 'hha-gate-core-style';
  style.textContent = `
    .hha-gate-shell{min-height:100dvh;padding:18px;display:grid;place-items:center;background:radial-gradient(circle at 50% -10%,rgba(56,189,248,.18),transparent 35%),linear-gradient(180deg,#020617,#0f172a);color:#f8fafc;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .hha-gate-card{width:min(980px,100%);border:1px solid rgba(148,163,184,.18);border-radius:26px;overflow:hidden;background:rgba(2,6,23,.82);box-shadow:0 24px 72px rgba(0,0,0,.36)}
    .hha-gate-hero{padding:22px;border-bottom:1px solid rgba(148,163,184,.14)}
    .hha-gate-kicker{font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#7dd3fc}
    .hha-gate-title{margin:8px 0;font-size:clamp(28px,4vw,44px);line-height:1.05}
    .hha-gate-sub{margin:0;color:#cbd5e1;line-height:1.55;font-weight:700}
    .hha-gate-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
    .hha-gate-chip{padding:7px 10px;border:1px solid rgba(148,163,184,.18);border-radius:999px;background:rgba(15,23,42,.75);font-size:12px;font-weight:900}
    .hha-gate-stage{min-height:320px;padding:18px}
    .hha-gate-panel{min-height:284px;padding:22px;border-radius:20px;border:1px solid rgba(148,163,184,.14);background:linear-gradient(180deg,rgba(15,23,42,.84),rgba(15,23,42,.58))}
    .hha-gate-panel h3{margin:0 0 10px;font-size:clamp(22px,3vw,32px)}
    .hha-gate-panel p{margin:0;color:#cbd5e1;line-height:1.65;font-weight:700}
    .hha-gate-footer{padding:16px 18px;border-top:1px solid rgba(148,163,184,.14);display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
    .hha-gate-btn{border:0;border-radius:16px;padding:13px 18px;min-width:158px;font:inherit;font-weight:1000;cursor:pointer;background:#1e293b;color:#f8fafc}
    .hha-gate-btn.primary{background:linear-gradient(135deg,#38bdf8,#2563eb);box-shadow:0 12px 24px rgba(37,99,235,.28)}
    .hha-gate-error{margin-top:14px;padding:12px;border-radius:14px;background:rgba(127,29,29,.28);border:1px solid rgba(248,113,113,.32);color:#fecaca;white-space:pre-wrap;word-break:break-word;font-size:13px}
  `;
  document.head.appendChild(style);
}

function renderShell(root, ctx) {
  root.innerHTML = `
    <section class="hha-gate-shell">
      <article class="hha-gate-card">
        <header class="hha-gate-hero">
          <div class="hha-gate-kicker">HeroHealth Gate • ${esc(ctx.phase)}</div>
          <h1 class="hha-gate-title">${ctx.phase === 'cooldown' ? 'Cooldown & Recovery' : 'Warmup Ready'}</h1>
          <p class="hha-gate-sub">เตรียมความพร้อมสำหรับ ${esc(ctx.meta && ctx.meta.label ? ctx.meta.label : ctx.game || 'เกม')} ก่อนเข้าสู่ด่านถัดไป</p>
          <div class="hha-gate-chips">
            <span class="hha-gate-chip">${esc(ctx.game || 'game')}</span>
            <span class="hha-gate-chip">${esc(ctx.phase)}</span>
            <span class="hha-gate-chip">${esc(ctx.diff)}</span>
            <span class="hha-gate-chip">${esc(ctx.pid)}</span>
          </div>
        </header>
        <main class="hha-gate-stage"><div class="hha-gate-panel" id="hhaGateStage"></div></main>
        <footer class="hha-gate-footer" id="hhaGateFooter"></footer>
      </article>
    </section>`;

  return {
    stage: root.querySelector('#hhaGateStage'),
    footer: root.querySelector('#hhaGateFooter')
  };
}

function setActions(footer, actions = []) {
  footer.innerHTML = '';
  actions.forEach(action => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `hha-gate-btn${action.primary ? ' primary' : ''}`;
    button.textContent = action.label;
    button.addEventListener('click', action.onClick);
    footer.appendChild(button);
  });
}

function renderInfo(stage, title, body, extra = '') {
  stage.innerHTML = `<h3>${esc(title)}</h3><p>${esc(body)}</p>${extra}`;
}

function renderError(stage, title, error) {
  stage.innerHTML = `
    <h3>${esc(title)}</h3>
    <p>ระบบยังเปิดทางเลือกสำรองให้ไปต่อได้</p>
    <div class="hha-gate-error">${esc(error && (error.stack || error.message) ? (error.stack || error.message) : String(error || 'Unknown error'))}</div>`;
}

function go(url) {
  if (url) location.href = url;
}

async function loadPhaseModule(ctx) {
  const file = getPhaseFile(ctx.game, ctx.phase);
  if (!file) return null;

  const href = new URL(file, import.meta.url);
  href.searchParams.set('v', PATCH);
  return import(href.toString());
}

function addGameStyle(ctx) {
  const file = getGameStyleFile(ctx.game);
  if (!file) return;

  const href = new URL(file, import.meta.url).toString();
  if (document.querySelector(`link[data-gate-style="${href}"]`)) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.gateStyle = href;
  document.head.appendChild(link);
}

function mountFallback(stage, ctx, api) {
  renderInfo(
    stage,
    ctx.phase === 'cooldown' ? 'พร้อมสรุปผลแล้ว' : 'Warmup พร้อมแล้ว',
    ctx.phase === 'cooldown'
      ? 'สามารถไปต่อเพื่อกลับสู่แผนหรือหน้าหลักได้'
      : 'แตะปุ่มเพื่อเข้าเกมหลัก'
  );

  setActions(api.footer, [
    {
      label: ctx.phase === 'cooldown' ? 'ไปต่อ' : 'เข้าเกมหลัก',
      primary: true,
      onClick: () => api.complete({ source: 'fallback' })
    },
    {
      label: 'กลับ HUB',
      onClick: () => go(hubHref(ctx))
    }
  ]);
}

function bindEvents(stage, api) {
  const completed = event => api.complete(event && event.detail ? event.detail : {});
  const skipped = event => api.skip(event && event.detail ? event.detail : {});
  const failed = event => api.fail(event && event.detail ? event.detail : event);

  stage.addEventListener('gate:complete', completed);
  stage.addEventListener('gate:done', completed);
  stage.addEventListener('gate:skip', skipped);
  stage.addEventListener('gate:fail', failed);

  return () => {
    stage.removeEventListener('gate:complete', completed);
    stage.removeEventListener('gate:done', completed);
    stage.removeEventListener('gate:skip', skipped);
    stage.removeEventListener('gate:fail', failed);
  };
}

async function mountPhase(stage, ctx, api) {
  addGameStyle(ctx);

  let mod = null;
  try {
    mod = await loadPhaseModule(ctx);
  } catch (error) {
    console.warn('[gate-core] phase import failed; fallback enabled', error);
    mountFallback(stage, ctx, api);
    return;
  }

  const runner = mod && (
    (typeof mod.mount === 'function' && mod.mount) ||
    (typeof mod.boot === 'function' && mod.boot) ||
    (typeof mod.start === 'function' && mod.start) ||
    (typeof mod.default === 'function' && mod.default)
  );

  if (!runner) {
    mountFallback(stage, ctx, api);
    return;
  }

  const unbind = bindEvents(stage, api);

  try {
    const instance = await runner(stage, ctx, api);

    if (typeof instance === 'function') {
      api.destroy = () => {
        unbind();
        try { instance(); } catch (_) {}
      };
      return;
    }

    if (instance && typeof instance.destroy === 'function') {
      api.destroy = () => {
        unbind();
        try { instance.destroy(); } catch (_) {}
      };
      return;
    }

    if (instance && typeof instance.start === 'function') {
      try { instance.start(); } catch (error) { console.warn('[gate-core] instance start failed', error); }
    }

    api.destroy = unbind;
  } catch (error) {
    console.error('[gate-core] phase runner failed', error);
    unbind();
    renderError(stage, 'Gate mini-game เปิดไม่ได้', error);
    mountFallback(stage, ctx, api);
  }
}

export async function bootGate(root = document.getElementById('gate-app')) {
  ensureStyle();

  if (!root) throw new Error('Gate root (#gate-app) not found.');

  const ctx = readCtx();
  const refs = renderShell(root, ctx);

  if (!ctx.game || !ctx.meta) {
    renderInfo(
      refs.stage,
      'ไม่พบเกมที่ต้องการ',
      `ไม่พบ game registry สำหรับ: ${ctx.rawGame || '(empty)'}`
    );
    setActions(refs.footer, [{ label: 'กลับ HUB', primary: true, onClick: () => go(hubHref(ctx)) }]);
    return;
  }

  const api = {
    ctx,
    root: refs.stage,
    mountRoot: refs.stage,
    footer: refs.footer,
    done: false,
    destroy: null,

    setTitle(title) {
      const node = root.querySelector('.hha-gate-title');
      if (node && title) node.textContent = title;
    },

    setSub(subtitle) {
      const node = root.querySelector('.hha-gate-sub');
      if (node && subtitle) node.textContent = subtitle;
    },

    setStats() {},

    toast(message) {
      console.info('[gate-core]', message);
    },

    async complete(payload = {}) {
      if (api.done) return;
      api.done = true;

      if (typeof api.destroy === 'function') {
        try { api.destroy(); } catch (_) {}
      }

      if (payload.markDailyDone !== false) setDone(ctx, true);

      saveSummary(ctx, {
        payload,
        phase: ctx.phase,
        completionHref: completionHref(ctx, payload)
      });

      const target = completionHref(ctx, payload);
      renderInfo(
        refs.stage,
        payload.title || (ctx.phase === 'cooldown' ? 'Cooldown เสร็จแล้ว' : 'Warmup เสร็จแล้ว'),
        payload.subtitle || 'ระบบพร้อมพาไปยังขั้นตอนถัดไป'
      );

      setActions(refs.footer, [
        {
          label: ctx.phase === 'cooldown' ? 'ไปต่อ' : 'เข้าเกมหลัก',
          primary: true,
          onClick: () => go(target)
        },
        {
          label: 'กลับ HUB',
          onClick: () => go(hubHref(ctx))
        }
      ]);

      await delay(120);
      go(target);
    },

    finish(payload = {}) { return api.complete(payload); },
    done(payload = {}) { return api.complete(payload); },
    next(payload = {}) { return api.complete(payload); },
    summary(payload = {}) { return api.complete(payload); },
    skip(payload = {}) { return api.complete({ skipped: true, ...payload }); },

    fail(error) {
      console.error('[gate-core] phase failed', error);
      renderError(refs.stage, 'Gate ทำงานไม่สมบูรณ์', error);
      mountFallback(refs.stage, ctx, api);
    }
  };

  if (!ctx.forceGate && getDone(ctx)) {
    renderInfo(
      refs.stage,
      ctx.phase === 'cooldown' ? 'ทำ cooldown วันนี้แล้ว' : 'ทำ warmup วันนี้แล้ว',
      'ระบบจะพาไปยังขั้นตอนถัดไป'
    );

    setActions(refs.footer, [
      {
        label: ctx.phase === 'cooldown' ? 'ไปต่อ' : 'เข้าเกมหลัก',
        primary: true,
        onClick: () => go(completionHref(ctx))
      },
      { label: 'กลับ HUB', onClick: () => go(hubHref(ctx)) }
    ]);

    await delay(250);
    go(completionHref(ctx));
    return;
  }

  await mountPhase(refs.stage, ctx, api);
}

export default bootGate;
