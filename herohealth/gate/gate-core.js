// === /herohealth/gate/gate-core.js ===
// FULL PATCH v20260328d-GATE-GOODJUNK-FLOW-FIX

import * as GateGames from './gate-games.js?v=20260328c-GATE-GAMES-GOODJUNK-SHADOWBREAKER-COMPAT';

const PATCH = 'v20260328d-GATE-GOODJUNK-FLOW-FIX';
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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

function shouldForceGate(ctx) {
  return (
    ctx.params.get('forcegate') === '1' ||
    ctx.params.get('resetGate') === '1'
  );
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

    hub: params.get('hub') || new URL('../hub.html', import.meta.url).href,
    cat: params.get('cat') || meta?.cat || '',
    zone: params.get('zone') || params.get('cat') || meta?.cat || '',
    scene: params.get('scene') || '',
    wgskip: params.get('wgskip') || '',
    autostart: params.get('autostart') || '',
    next: params.get('next') || '',
    nextKey: params.get('nextKey') || ''
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
    .gate-lines{
      margin:16px auto 0;
      max-width:720px;
      text-align:left;
      display:grid;
      gap:8px;
    }
    .gate-line{
      border:1px solid rgba(148,163,184,.14);
      border-radius:14px;
      background:rgba(15,23,42,.62);
      padding:10px 12px;
      color:#e5e7eb;
    }
    .gate-actions{
      display:flex;
      flex-wrap:wrap;
      gap:12px;
      justify-content:center;
      margin-top:18px;
    }
    .gate-btn{
      appearance:none;
      border:0;
      border-radius:18px;
      padding:14px 18px;
      font-size:15px;
      font-weight:900;
      cursor:pointer;
      min-width:170px;
      transition:transform .15s ease, opacity .15s ease;
    }
    .gate-btn:hover{ transform:translateY(-1px); }
    .gate-btn:active{ transform:translateY(0); }
    .gate-btn-primary{
      background:linear-gradient(135deg, #38bdf8, #2563eb);
      color:#fff;
      box-shadow:0 12px 26px rgba(37,99,235,.32);
    }
    .gate-btn-ghost{
      background:rgba(15,23,42,.85);
      color:#e5e7eb;
      border:1px solid rgba(148,163,184,.16);
    }
    .gate-footer{
      padding:0 18px 18px;
    }
    .gate-toast{
      position:fixed;
      left:50%;
      bottom:18px;
      transform:translateX(-50%);
      z-index:9999;
      max-width:min(90vw,720px);
      background:rgba(15,23,42,.94);
      color:#fff;
      border:1px solid rgba(148,163,184,.16);
      border-radius:16px;
      padding:12px 14px;
      box-shadow:0 16px 40px rgba(0,0,0,.35);
      font-size:14px;
      line-height:1.45;
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
    .gate-mini-note{
      margin-top:10px;
      color:#93c5fd;
      font-size:13px;
      font-weight:700;
    }
    @media (max-width: 720px){
      .gate-shell{ padding:12px; }
      .gate-card{ border-radius:20px; }
      .gate-hero{ padding:18px 16px 12px; }
      .gate-topstats{ grid-template-columns:repeat(2,minmax(0,1fr)); }
      .gate-stage{ padding:12px; }
      .gate-stage-inner{ padding:14px; min-height:300px; }
      .gate-btn{ width:100%; min-width:0; }
      .gate-actions{ justify-content:stretch; }
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

        <div class="gate-footer">
          <div id="gateFooter"></div>
        </div>
      </div>
    </div>
  `;

  return {
    stage: root.querySelector('#gateStage'),
    footer: root.querySelector('#gateFooter'),
    statTime: root.querySelector('#gateStatTime'),
    statScore: root.querySelector('#gateStatScore'),