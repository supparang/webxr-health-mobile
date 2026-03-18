// === /herohealth/gate/gate-core.js ===
// FULL PATCH v20260318e-GATE-SUMMARY-WARMUP-VISIBLE
// ✅ warmup/cooldown ใช้ summary overlay ได้จริง
// ✅ warmup จบแล้ว "ไม่วิ่งเข้า run ทันที"
// ✅ กด "ไปต่อ" ค่อยเข้า run
// ✅ กด "กลับ HUB" ได้
// ✅ cooldown จบแล้วกดกลับ HUB ได้
// ✅ auto-start phase module if result.start() exists

import * as GateGames from './gate-games.js?v=20260318d-GATE-GAMES-RHYTHM-JUMPDUCK-PATHFIX';
import { mountSummaryLayer, mountToast } from './gate-summary.js?v=20260317-GATE-SUMMARY-TOAST-DEDUPE-HARDENED';

const PATCH = 'v20260318e-GATE-SUMMARY-WARMUP-VISIBLE';
const STORAGE_NS = 'HHA_GATE_DONE_V1';
const LAST_SUMMARY_KEY = 'HHA_LAST_SUMMARY';
const SUMMARY_HISTORY_KEY = 'HHA_SUMMARY_HISTORY';
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

function getRunCandidatesSafe(gameId = '') {
  if (typeof GateGames.getRunCandidates === 'function') {
    const list = GateGames.getRunCandidates(gameId);
    if (Array.isArray(list) && list.length) return list.filter(Boolean);
  }

  const meta = getGameMeta(gameId);

  if (Array.isArray(meta?.runCandidates) && meta.runCandidates.length) {
    return meta.runCandidates.filter(Boolean);
  }

  if (typeof GateGames.getRunFile === 'function') {
    const one = GateGames.getRunFile(gameId);
    if (one) return [one];
  }

  if (meta?.run) return [meta.run];

  return [];
}

function esc(s = '') {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function todayStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dailyKey(game, phase) {
  return `${STORAGE_NS}:${normalizeGameId(game)}:${phase}:${todayStamp()}`;
}

function getDailyDone(game, phase) {
  try {
    return localStorage.getItem(dailyKey(game, phase)) === '1';
  } catch {
    return false;
  }
}

function setDailyDone(game, phase, value = true) {
  try {
    localStorage.setItem(dailyKey(game, phase), value ? '1' : '0');
  } catch {}
}

function saveLastSummary(payload = {}) {
  try {
    const item = { ts: Date.now(), ...payload };
    localStorage.setItem(LAST_SUMMARY_KEY, JSON.stringify(item));

    const prev = JSON.parse(localStorage.getItem(SUMMARY_HISTORY_KEY) || '[]');
    const arr = Array.isArray(prev) ? prev : [];
    arr.unshift(item);
    localStorage.setItem(SUMMARY_HISTORY_KEY, JSON.stringify(arr.slice(0, MAX_HISTORY)));
  } catch {}
}

function readCtx() {
  const params = new URLSearchParams(location.search);

  const gameRaw =
    params.get('game') ||
    params.get('gameId') ||
    params.get('theme') ||
    '';

  const game = normalizeGameId(gameRaw);
  const meta = getGameMeta(game);

  const phaseRaw = String(
    params.get('phase') ||
    params.get('gatePhase') ||
    'warmup'
  ).toLowerCase();

  const phase = phaseRaw === 'cooldown' ? 'cooldown' : 'warmup';

  return {
    patch: PATCH,
    params,
    gameRaw,
    game,
    meta,
    phase,

    pid: params.get('pid') || 'anon',
    name: params.get('name') || '',
    studyId: params.get('studyId') || '',
    roomId: params.get('roomId') || '',

    run: params.get('run') || 'play',
    diff: params.get('diff') || 'normal',
    time: params.get('time') || '120',
    seed: params.get('seed') || String(Date.now()),
    view: params.get('view') || 'mobile',

    hub: params.get('hub') || '../hub.html',
    cat: params.get('cat') || meta?.cat || '',
    zone: params.get('zone') || params.get('cat') || meta?.cat || '',
    scene: params.get('scene') || '',
    wgskip: params.get('wgskip') || '',
    autostart: params.get('autostart') || '',
    next: params.get('next') || ''
  };
}

function ensureCoreStyle() {
  if (document.getElementById('gate-core-inline-style')) return;

  const style = document.createElement('style');
  style.id = 'gate-core-inline-style';
  style.textContent = `
    .gate-shell{
      min-height:100dvh;
      padding:18px;
      display:grid;
      place-items:center;
      background:
        radial-gradient(circle at top, rgba(59,130,246,.18), transparent 32%),
        linear-gradient(180deg, #020617 0%, #0f172a 55%, #111827 100%);
      color:#e5e7eb;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    }
    .gate-card{
      width:min(1020px,100%);
      border-radius:26px;
      border:1px solid rgba(148,163,184,.16);
      background:rgba(2,6,23,.76);
      box-shadow:0 20px 60px rgba(0,0,0,.34);
      overflow:hidden;
      backdrop-filter: blur(10px);
    }
    .gate-hero{
      padding:22px 22px 14px;
      border-bottom:1px solid rgba(148,163,184,.10);
    }
    .gate-kicker{
      font-size:12px;
      font-weight:800;
      letter-spacing:.08em;
      text-transform:uppercase;
      color:#93c5fd;
      margin-bottom:8px;
    }
    .gate-title{
      margin:0 0 8px;
      font-size:clamp(24px,4vw,40px);
      line-height:1.05;
      font-weight:900;
    }
    .gate-sub{
      margin:0;
      color:#cbd5e1;
      font-size:14px;
      line-height:1.55;
    }
    .gate-meta{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      margin-top:14px;
    }
    .gate-chip{
      padding:8px 12px;
      border-radius:999px;
      border:1px solid rgba(148,163,184,.14);
      background:rgba(15,23,42,.72);
      color:#e2e8f0;
      font-size:12px;
      font-weight:800;
    }
    .gate-topstats{
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:10px;
      margin-top:14px;
    }
    .gate-topstat{
      border:1px solid rgba(148,163,184,.14);
      border-radius:16px;
      padding:12px;
      background:linear-gradient(180deg, rgba(15,23,42,.72), rgba(15,23,42,.52));
    }
    .gate-topstat-label{
      font-size:12px;
      font-weight:800;
      color:#cbd5e1;
    }
    .gate-topstat-value{
      margin-top:6px;
      font-size:20px;
      font-weight:1000;
    }
    .gate-stage{
      min-height:360px;
      padding:18px;
      position:relative;
    }
    .gate-stage-inner{
      min-height:324px;
      border-radius:22px;
      border:1px solid rgba(148,163,184,.12);
      background:linear-gradient(180deg, rgba(15,23,42,.74), rgba(15,23,42,.56));
      padding:18px;
      position:relative;
      overflow:hidden;
    }
    .gate-info{
      text-align:center;
      padding:28px 18px;
    }
    .gate-info h3{
      margin:0 0 10px;
      font-size:clamp(22px,4vw,30px);
      line-height:1.1;
    }
    .gate-info p{
      margin:0 auto;
      color:#cbd5e1;
      max-width:720px;
      line-height:1.65;
    }
    .gate-error{
      color:#fecaca;
      background:rgba(127,29,29,.35);
      border:1px solid rgba(239,68,68,.25);
      border-radius:16px;
      padding:14px;
      margin-top:14px;
      white-space:pre-wrap;
      overflow:auto;
    }

    /* summary / toast support */
    .gate-overlay{
      position:fixed;
      inset:0;
      display:none;
      align-items:center;
      justify-content:center;
      background:rgba(2,6,23,.70);
      z-index:10000;
      padding:16px;
    }
    .gate-overlay.show{
      display:flex;
    }
    .gate-summary{
      width:min(760px,96vw);
      border-radius:24px;
      border:1px solid rgba(148,163,184,.16);
      background:linear-gradient(180deg, rgba(2,6,23,.96), rgba(15,23,42,.92));
      box-shadow:0 24px 70px rgba(0,0,0,.40);
      padding:20px;
    }
    .gate-summary h2{
      margin:0 0 8px;
      font-size:clamp(22px,4vw,34px);
      line-height:1.1;
    }
    .gate-summary p{
      margin:0;
      color:#cbd5e1;
      line-height:1.6;
    }
    .gate-summary-list{
      display:grid;
      gap:10px;
      margin-top:16px;
    }
    .gate-summary-line{
      border-radius:14px;
      border:1px solid rgba(148,163,184,.14);
      background:rgba(15,23,42,.62);
      padding:10px 12px;
      color:#e5e7eb;
    }
    .gate-footer{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      justify-content:flex-end;
    }
    .btn{
      appearance:none;
      border:0;
      border-radius:16px;
      padding:12px 16px;
      font-size:14px;
      font-weight:900;
      cursor:pointer;
    }
    .btn-primary{
      background:linear-gradient(135deg,#38bdf8,#2563eb);
      color:#fff;
    }
    .btn-ghost{
      background:rgba(15,23,42,.85);
      color:#e5e7eb;
      border:1px solid rgba(148,163,184,.16);
    }
    .gate-toast{
      position:fixed;
      left:50%;
      bottom:18px;
      transform:translateX(-50%);
      z-index:10001;
      max-width:min(90vw,720px);
      background:rgba(15,23,42,.94);
      color:#fff;
      border:1px solid rgba(148,163,184,.16);
      border-radius:16px;
      padding:12px 14px;
      box-shadow:0 16px 40px rgba(0,0,0,.35);
      font-size:14px;
      line-height:1.45;
      opacity:0;
      pointer-events:none;
      transition:opacity .18s ease;
    }
    .gate-toast.show{
      opacity:1;
    }

    @media (max-width: 720px){
      .gate-shell{ padding:12px; }
      .gate-card{ border-radius:20px; }
      .gate-hero{ padding:18px 16px 12px; }
      .gate-topstats{ grid-template-columns:repeat(2,minmax(0,1fr)); }
      .gate-stage{ padding:12px; }
      .gate-stage-inner{ padding:14px; min-height:300px; }
      .gate-footer{ justify-content:stretch; }
      .btn{ width:100%; }
    }
  `;
  document.head.appendChild(style);
}

function setDocTitle(ctx) {
  const phaseLabel = ctx.phase === 'cooldown' ? 'Cooldown' : 'Warmup';
  const gameLabel = ctx.meta?.label || ctx.game || 'Gate';
  document.title = `HeroHealth — ${phaseLabel} • ${gameLabel}`;
}

function phaseTitle(ctx) {
  if (ctx.phase === 'cooldown') {
    return ctx.meta?.cooldownTitle || `${ctx.meta?.label || 'Game'} Cooldown`;
  }
  return ctx.meta?.warmupTitle || `${ctx.meta?.label || 'Game'} Warmup`;
}

function renderShell(root, ctx) {
  root.innerHTML = `
    <div class="gate-shell">
      <div class="gate-card">
        <div class="gate-hero">
          <div class="gate-kicker">HeroHealth Gate • ${esc(ctx.phase)}</div>
          <h1 class="gate-title" id="gateHeroTitle">${esc(phaseTitle(ctx))}</h1>
          <p class="gate-sub" id="gateHeroSub">หน้าเดียวสำหรับ warmup และ cooldown โดยแยกด้วย <code>?phase=warmup</code> หรือ <code>?gatePhase=warmup</code></p>

          <div class="gate-meta">
            <div class="gate-chip">game: ${esc(ctx.game || '-')}</div>
            <div class="gate-chip">cat: ${esc(ctx.cat || '-')}</div>
            <div class="gate-chip">pid: ${esc(ctx.pid || '-')}</div>
            <div class="gate-chip">view: ${esc(ctx.view || '-')}</div>
            <div class="gate-chip">${esc(PATCH)}</div>
          </div>

          <div class="gate-topstats">
            <div class="gate-topstat">
              <div class="gate-topstat-label">เวลา</div>
              <div class="gate-topstat-value" id="gateStatTime">-</div>
            </div>
            <div class="gate-topstat">
              <div class="gate-topstat-label">คะแนน</div>
              <div class="gate-topstat-value" id="gateStatScore">0</div>
            </div>
            <div class="gate-topstat">
              <div class="gate-topstat-label">พลาด</div>
              <div class="gate-topstat-value" id="gateStatMiss">0</div>
            </div>
            <div class="gate-topstat">
              <div class="gate-topstat-label">แม่นยำ</div>
              <div class="gate-topstat-value" id="gateStatAcc">0%</div>
            </div>
          </div>
        </div>

        <div class="gate-stage">
          <div class="gate-stage-inner">
            <div id="gateStage"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  return {
    stage: root.querySelector('#gateStage'),
    statTime: root.querySelector('#gateStatTime'),
    statScore: root.querySelector('#gateStatScore'),
    statMiss: root.querySelector('#gateStatMiss'),
    statAcc: root.querySelector('#gateStatAcc'),
    heroTitle: root.querySelector('#gateHeroTitle'),
    heroSub: root.querySelector('#gateHeroSub')
  };
}

function applyStats(refs, stats = {}) {
  if (!refs) return;
  if ('time' in stats && refs.statTime) refs.statTime.textContent = String(stats.time ?? '-');
  if ('score' in stats && refs.statScore) refs.statScore.textContent = String(stats.score ?? 0);
  if ('miss' in stats && refs.statMiss) refs.statMiss.textContent = String(stats.miss ?? 0);
  if ('acc' in stats && refs.statAcc) refs.statAcc.textContent = String(stats.acc ?? '0%');
}

function setHeroTitle(refs, text = '') {
  if (refs?.heroTitle) refs.heroTitle.textContent = String(text || '');
}

function setHeroSub(refs, text = '') {
  if (refs?.heroSub) refs.heroSub.textContent = String(text || '');
}

function buildRunParams(ctx) {
  const p = new URLSearchParams(ctx.params);

  p.delete('phase');
  p.delete('gatePhase');
  p.delete('next');

  p.set('game', ctx.game);
  p.set('gameId', ctx.game);

  if (ctx.cat) p.set('cat', ctx.cat);
  if (ctx.zone) p.set('zone', ctx.zone);

  p.set('pid', ctx.pid);
  p.set('run', ctx.run);
  p.set('diff', ctx.diff);
  p.set('time', ctx.time);
  p.set('seed', ctx.seed);
  p.set('view', ctx.view);

  if (ctx.hub) p.set('hub', ctx.hub);
  if (ctx.scene) p.set('scene', ctx.scene);
  if (ctx.roomId) p.set('roomId', ctx.roomId);
  if (ctx.studyId) p.set('studyId', ctx.studyId);
  if (ctx.name) p.set('name', ctx.name);

  p.set('wgskip', '1');
  return p;
}

async function quickExists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

function resolveAbsoluteUrl(maybeUrl) {
  if (!maybeUrl) return '';
  try {
    return new URL(maybeUrl, location.href).href;
  } catch {
    return '';
  }
}

async function resolveRunHref(ctx) {
  if (ctx.next) {
    const nextHref = resolveAbsoluteUrl(ctx.next);
    if (nextHref) return nextHref;
  }

  const candidates = getRunCandidatesSafe(ctx.game);
  if (!candidates.length) return '';

  const params = buildRunParams(ctx);

  for (const rel of candidates) {
    try {
      const url = new URL(rel, location.href);
      url.search = params.toString();
      const ok = await quickExists(url.href);
      if (ok) return url.href;
    } catch {}
  }

  const fallback = new URL(candidates[0], location.href);
  fallback.search = params.toString();
  return fallback.href;
}

function resolveHubHref(ctx) {
  try {
    return new URL(ctx.hub || '../hub.html', location.href).href;
  } catch {
    return '../hub.html';
  }
}

async function goRun(ctx) {
  const href = await resolveRunHref(ctx);
  if (!href) return;
  location.href = href;
}

function goHub(ctx) {
  location.href = resolveHubHref(ctx);
}

function renderInfo(stage, title, body) {
  stage.innerHTML = `
    <div class="gate-info">
      <h3>${esc(title)}</h3>
      <p>${body}</p>
    </div>
  `;
}

function renderError(stage, title, err) {
  stage.innerHTML = `
    <div class="gate-info">
      <h3>${esc(title)}</h3>
      <p>เกิดปัญหาระหว่างโหลด gate หรือ phase mini-game</p>
      <div class="gate-error">${esc(String(err?.stack || err || 'Unknown error'))}</div>
    </div>
  `;
}

function attachCompletionEvents(root, api) {
  const onComplete = ev => api.complete(ev?.detail || {});
  const onSkip = ev => api.skip(ev?.detail || {});
  const onFail = ev => api.fail(ev?.detail || ev);

  root.addEventListener('gate:complete', onComplete);
  root.addEventListener('gate:done', onComplete);
  root.addEventListener('gate:skip', onSkip);
  root.addEventListener('gate:fail', onFail);

  return () => {
    root.removeEventListener('gate:complete', onComplete);
    root.removeEventListener('gate:done', onComplete);
    root.removeEventListener('gate:skip', onSkip);
    root.removeEventListener('gate:fail', onFail);
  };
}

function createCompatLogger(ctx) {
  return {
    push(event, payload = {}) {
      try {
        console.debug('[gate-mini]', event, { game: ctx.game, phase: ctx.phase, ...payload });
      } catch {}
    }
  };
}

async function loadPhaseModule(ctx) {
  const phaseFile = getPhaseFile(ctx.game, ctx.phase);
  if (!phaseFile) return null;
  const href = new URL(phaseFile, import.meta.url).href;
  return import(href);
}

function ensureGameStyle(ctx) {
  const styleFile = getGameStyleFile(ctx.game);
  if (!styleFile) return;

  const href = new URL(styleFile, import.meta.url).href;
  const id = `gate-style-${ctx.game}`;
  if (document.getElementById(id)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function mountFallbackPhase(stage, ctx, api) {
  renderInfo(
    stage,
    ctx.phase === 'cooldown' ? 'พร้อมสรุปและกลับ HUB' : 'พร้อมเข้าเกมหลัก',
    ctx.phase === 'cooldown'
      ? 'ไม่พบ module ของ cooldown เกมนี้ จึงใช้ fallback ให้ก่อน'
      : 'ไม่พบ module ของ warmup เกมนี้ จึงใช้ fallback ให้ก่อน'
  );

  if (ctx.phase === 'cooldown') {
    api.complete({ source: 'fallback-cooldown' });
  } else {
    setTimeout(() => api.complete({ source: 'fallback-warmup' }), 600);
  }
}

async function bootPhase(stage, ctx, api) {
  ensureGameStyle(ctx);

  let mod = null;
  try {
    mod = await loadPhaseModule(ctx);
  } catch (err) {
    console.warn('[gate-core] phase module import failed, using fallback:', err);
    mountFallbackPhase(stage, ctx, api);
    return;
  }

  if (!mod) {
    mountFallbackPhase(stage, ctx, api);
    return;
  }

  if (typeof mod.loadStyle === 'function') {
    try { mod.loadStyle(); } catch (err) { console.warn(err); }
  }

  const runner =
    (typeof mod.mount === 'function' && mod.mount) ||
    (typeof mod.boot === 'function' && mod.boot) ||
    (typeof mod.start === 'function' && mod.start) ||
    (typeof mod.createGame === 'function' && mod.createGame) ||
    (typeof mod.default === 'function' && mod.default);

  if (!runner) {
    mountFallbackPhase(stage, ctx, api);
    return;
  }

  try {
    const cleanupEvents = attachCompletionEvents(stage, api);
    const result = await runner(stage, ctx, api);

    if (result && typeof result.start === 'function') {
      try {
        queueMicrotask(() => {
          try { result.start(); } catch (err) {
            console.warn('[gate-core] phase start() failed:', err);
          }
        });
      } catch {
        try { result.start(); } catch (err) {
          console.warn('[gate-core] phase start() failed:', err);
        }
      }
    }

    if (typeof result === 'function') {
      api._destroy = () => {
        cleanupEvents();
        try { result(); } catch {}
      };
      return;
    }

    if (result && typeof result.destroy === 'function') {
      api._destroy = () => {
        cleanupEvents();
        try { result.destroy(); } catch {}
      };
      return;
    }

    api._destroy = cleanupEvents;
  } catch (err) {
    console.error('[gate-core] phase runner failed:', err);
    renderError(stage, 'Phase runner failed', err);
  }
}

function showAlreadyDone(stage, toastApi, ctx) {
  if (ctx.phase === 'cooldown') {
    renderInfo(stage, 'ทำ cooldown วันนี้แล้ว', 'เกมนี้ทำ cooldown ไปแล้วในวันนี้ ระบบจะพากลับ HUB');
    toastApi?.show?.('ทำ cooldown วันนี้แล้ว');
    setTimeout(() => goHub(ctx), 450);
    return;
  }

  renderInfo(stage, 'ทำ warmup วันนี้แล้ว', 'ระบบจะพาเข้าเกมหลักต่อทันที เพราะกำหนดให้ warmup วันละครั้งต่อเกม');
  toastApi?.show?.('ทำ warmup วันนี้แล้ว');
  setTimeout(() => { goRun(ctx); }, 650);
}

function showInvalidGame(stage, ctx) {
  renderInfo(
    stage,
    'ไม่พบเกมที่ต้องการ',
    `game id ไม่ถูกต้องหรือไม่มีใน registry: <code>${esc(ctx.gameRaw || '(empty)')}</code>`
  );
}

export async function bootGate(root = document.getElementById('gate-app')) {
  ensureCoreStyle();

  if (!root) throw new Error('ไม่พบ #gate-app');

  const ctx = readCtx();
  setDocTitle(ctx);

  const refs = renderShell(root, ctx);
  const { stage } = refs;

  const summaryApi = mountSummaryLayer(document.body);
  const toastApi = mountToast(document.body);

  applyStats(refs, {
    time: ctx.phase === 'cooldown' ? 0 : (ctx.time || '-'),
    score: 0,
    miss: 0,
    acc: '0%'
  });

  if (!ctx.game || !ctx.meta) {
    showInvalidGame(stage, ctx);
    return;
  }

  const api = {
    ctx,
    root: stage,
    mountRoot: stage,

    _done: false,
    _destroy: null,

    logger: createCompatLogger(ctx),
    toast: (msg) => toastApi.show(msg),

    setStats(stats = {}) {
      applyStats(refs, stats);
    },

    setSub(text = '') {
      setHeroSub(refs, text);
    },

    setTitle(text = '') {
      setHeroTitle(refs, text);
    },

    async complete(payload = {}) {
      if (api._done) return;
      api._done = true;

      if (typeof api._destroy === 'function') {
        try { api._destroy(); } catch {}
      }

      if (payload.markDailyDone !== false) {
        setDailyDone(ctx.game, ctx.phase, true);
      }

      const title = payload.title ||
        (ctx.phase === 'cooldown' ? 'Cooldown เสร็จแล้ว' : 'Warmup เสร็จแล้ว');

      const subtitle = payload.subtitle ||
        (ctx.phase === 'cooldown'
          ? 'พร้อมกลับ HUB'
          : 'พร้อมเข้าเกมหลัก');

      const lines = Array.isArray(payload.lines) ? payload.lines : [];

      saveLastSummary({
        source: 'gate-core',
        phase: ctx.phase,
        game: ctx.game,
        cat: ctx.cat,
        pid: ctx.pid,
        diff: ctx.diff,
        time: ctx.time,
        seed: ctx.seed,
        view: ctx.view,
        patch: PATCH,
        payload
      });

      summaryApi.show({
        title,
        subtitle,
        lines,
        onContinue: async () => {
          if (ctx.phase === 'warmup') {
            await goRun(ctx);
            return;
          }
          goHub(ctx);
        },
        onBack: () => {
          goHub(ctx);
        }
      });
    },

    async finish(payload = {}) { return api.complete(payload); },
    async done(payload = {}) { return api.complete(payload); },
    async summary(payload = {}) { return api.complete(payload); },
    async next(payload = {}) { return api.complete(payload); },
    async skip(payload = {}) { return api.complete({ skipped: true, ...payload }); },

    fail(err) {
      console.error('[gate-core] fail:', err);
      renderError(stage, 'Gate fail', err);
      toastApi.show('Gate fail');
    },

    goRun() { return goRun(ctx); },
    goHub() { return goHub(ctx); }
  };

  const alreadyDone = getDailyDone(ctx.game, ctx.phase);
  if (alreadyDone) {
    showAlreadyDone(stage, toastApi, ctx);
    return;
  }

  renderInfo(
    stage,
    ctx.phase === 'cooldown' ? 'กำลังโหลด cooldown...' : 'กำลังโหลด warmup...',
    'โปรดรอสักครู่ ระบบกำลังเตรียมมินิเกมของ gate'
  );

  await bootPhase(stage, ctx, api);
}

export default bootGate;