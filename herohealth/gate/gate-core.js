// === /herohealth/gate/gate-core.js ===
// FULL PATCH v20260414d-ZONE-FIRST-JUMPDUCK-FINAL

import * as GateGames from './gate-games.js?v=20260414d-ZONE-FIRST-JUMPDUCK-FINAL';

const PATCH = 'v20260414d-ZONE-FIRST-JUMPDUCK-FINAL';
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

  if (meta?.runFile) return [meta.runFile];
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

function todayStampBangkok() {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());

    const map = Object.fromEntries(
      parts
        .filter(p => p.type !== 'literal')
        .map(p => [p.type, p.value])
    );

    return `${map.year}-${map.month}-${map.day}`;
  } catch {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

function dailyKeyFromCtx(ctx, phase = '') {
  const pid = String(ctx?.pid || 'anon').trim() || 'anon';
  const cat = String(ctx?.cat || ctx?.zone || 'general').trim().toLowerCase() || 'general';
  const game = normalizeGameId(ctx?.game || ctx?.gameRaw || '');
  const p = String(phase || ctx?.phase || 'warmup').trim().toLowerCase() === 'cooldown'
    ? 'cooldown'
    : 'warmup';

  return `${STORAGE_NS}:${pid}:${cat}:${game}:${p}:${todayStampBangkok()}`;
}

function getDailyDone(ctx, phase = '') {
  try {
    return localStorage.getItem(dailyKeyFromCtx(ctx, phase)) === '1';
  } catch {
    return false;
  }
}

function setDailyDone(ctx, phase = '', value = true) {
  try {
    localStorage.setItem(dailyKeyFromCtx(ctx, phase), value ? '1' : '0');
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

function pickNumber(...vals) {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function formatPct(v, fallback = '0%') {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return `${n.toFixed(1)}%`;
}

function readLastSummaryForCtx(ctx) {
  const keys = [
    `HHA_LAST_SUMMARY:${normalizeGameId(ctx.game)}:${ctx.pid}`,
    LAST_SUMMARY_KEY
  ];

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object') return obj;
    } catch {}
  }

  return null;
}

function applyCooldownSnapshot(refs, ctx) {
  if (!refs || ctx.phase !== 'cooldown') return;

  const snap = readLastSummaryForCtx(ctx);
  if (!snap) return;

  const payload = snap && typeof snap.payload === 'object' ? snap.payload : null;

  const score = pickNumber(
    snap.scoreFinal,
    snap.score,
    payload?.scoreFinal,
    payload?.score
  );

  const miss = pickNumber(
    snap.misses,
    snap.miss,
    payload?.misses,
    payload?.miss
  );

  const acc = pickNumber(
    snap.accPct,
    payload?.accPct
  );

  const time =
    snap.durationSec ||
    payload?.durationSec ||
    ctx.time ||
    '-';

  applyStats(refs, {
    time,
    score: score ?? 0,
    miss: miss ?? 0,
    acc: formatPct(acc, '0%')
  });
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

    hub: params.get('hub') || '',
    hubRoot: params.get('hubRoot') || '',
    launcher: params.get('launcher') || '',
    cat: params.get('cat') || meta?.cat || '',
    zone: params.get('zone') || params.get('cat') || meta?.zone || meta?.cat || '',
    scene: params.get('scene') || '',
    wgskip: params.get('wgskip') || '',
    autostart: params.get('autostart') || '',
    next: params.get('next') || '',
    nextKey: params.get('nextKey') || '',
    cdnext: params.get('cdnext') || ''
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
        radial-gradient(circle at top, rgba(255,255,255,.88), transparent 28%),
        linear-gradient(180deg, #eefbff 0%, #f7fcff 52%, #fff9ef 100%);
      color:#514a43;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    }
    .gate-card{
      width:min(1020px,100%);
      border-radius:26px;
      border:3px solid #d7edf7;
      background:rgba(255,255,255,.96);
      box-shadow:0 20px 60px rgba(88,153,190,.18);
      overflow:hidden;
    }
    .gate-hero{
      padding:22px 22px 14px;
      border-bottom:2px solid rgba(215,237,247,.85);
    }
    .gate-kicker{
      font-size:12px;
      font-weight:1000;
      letter-spacing:.08em;
      text-transform:uppercase;
      color:#72a5c7;
      margin-bottom:8px;
    }
    .gate-title{
      margin:0 0 8px;
      font-size:clamp(24px,4vw,40px);
      line-height:1.05;
      font-weight:1000;
      color:#7a4b2e;
    }
    .gate-sub{
      margin:0;
      color:#6d6760;
      font-size:14px;
      line-height:1.65;
      font-weight:900;
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
      border:2px solid #d7edf7;
      background:#fff;
      color:#6f8593;
      font-size:12px;
      font-weight:1000;
      box-shadow:0 8px 18px rgba(86,155,194,.08);
    }
    .gate-topstats{
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:10px;
      margin-top:14px;
    }
    .gate-topstat{
      border:2px solid #d7edf7;
      border-radius:18px;
      padding:12px;
      background:linear-gradient(180deg, #ffffff, #f8fdff);
      box-shadow:0 8px 18px rgba(86,155,194,.08);
    }
    .gate-topstat-label{
      font-size:12px;
      font-weight:1000;
      color:#7b92a0;
      text-transform:uppercase;
      letter-spacing:.05em;
    }
    .gate-topstat-value{
      margin-top:6px;
      font-size:20px;
      font-weight:1000;
      color:#514a43;
    }
    .gate-stage{
      min-height:360px;
      padding:18px;
      position:relative;
    }
    .gate-stage-inner{
      min-height:324px;
      border-radius:22px;
      border:2px solid #d7edf7;
      background:linear-gradient(180deg, #ffffff, #f9fdff);
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
      color:#7a4b2e;
    }
    .gate-info p{
      margin:0 auto;
      color:#6d6760;
      max-width:720px;
      line-height:1.7;
      font-weight:900;
    }
    .gate-lines{
      margin:16px auto 0;
      max-width:720px;
      text-align:left;
      display:grid;
      gap:8px;
    }
    .gate-line{
      border:2px solid #d7edf7;
      border-radius:16px;
      background:#fff;
      padding:10px 12px;
      color:#5d6c76;
      font-weight:900;
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
      font-weight:1000;
      cursor:pointer;
      min-width:170px;
      transition:transform .15s ease, opacity .15s ease;
    }
    .gate-btn:hover{ transform:translateY(-1px); }
    .gate-btn:active{ transform:translateY(0); }
    .gate-btn-primary{
      background:linear-gradient(180deg, #84dc76, #58c33f);
      color:#173d12;
      box-shadow:0 12px 26px rgba(88,195,63,.22);
    }
    .gate-btn-ghost{
      background:#fff;
      color:#6c6a61;
      border:2px solid #d7edf7;
      box-shadow:0 8px 18px rgba(86,155,194,.08);
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
      background:#fff;
      color:#5c5751;
      border:2px solid #d7edf7;
      border-radius:16px;
      padding:12px 14px;
      box-shadow:0 16px 40px rgba(88,153,190,.18);
      font-size:14px;
      line-height:1.45;
      font-weight:900;
    }
    .gate-error{
      color:#7f1d1d;
      background:#fff1f1;
      border:2px solid #f3c9c9;
      border-radius:16px;
      padding:14px;
      margin-top:14px;
      white-space:pre-wrap;
      overflow:auto;
    }
    .gate-mini-note{
      margin-top:10px;
      color:#72a5c7;
      font-size:13px;
      font-weight:1000;
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
            <div class="gate-chip">zone: ${esc(ctx.zone || '-')}</div>
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

function linesHtml(lines = []) {
  if (!Array.isArray(lines) || !lines.length) return '';
  return `
    <div class="gate-lines">
      ${lines.map(line => `<div class="gate-line">${esc(line)}</div>`).join('')}
    </div>
  `;
}

function renderInfo(stage, title, body, extraHtml = '') {
  stage.innerHTML = `
    <div class="gate-info">
      <h3>${esc(title)}</h3>
      <p>${body}</p>
      ${extraHtml}
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

function setActions(container, items = []) {
  container.innerHTML = '';
  if (!Array.isArray(items) || !items.length) return;

  const wrap = document.createElement('div');
  wrap.className = 'gate-actions';

  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = `gate-btn ${item.primary ? 'gate-btn-primary' : 'gate-btn-ghost'}`;
    btn.type = 'button';
    btn.textContent = item.label || 'ตกลง';
    btn.addEventListener('click', item.onClick);
    wrap.appendChild(btn);
  });

  container.appendChild(wrap);
}

function toast(message = '') {
  const prev = document.querySelector('.gate-toast');
  if (prev) prev.remove();

  const el = document.createElement('div');
  el.className = 'gate-toast';
  el.textContent = message;
  document.body.appendChild(el);

  setTimeout(() => el.remove(), 2200);
}

function buildRunParams(ctx) {
  const p = new URLSearchParams(ctx.params);

  p.delete('phase');
  p.delete('gatePhase');
  p.delete('next');
  p.delete('nextKey');
  p.delete('cdnext');
  p.delete('forcegate');
  p.delete('resetGate');

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
  if (ctx.hubRoot) p.set('hubRoot', ctx.hubRoot);
  if (ctx.launcher) p.set('launcher', ctx.launcher);
  if (ctx.scene) p.set('scene', ctx.scene);
  if (ctx.roomId) p.set('roomId', ctx.roomId);
  if (ctx.studyId) p.set('studyId', ctx.studyId);
  if (ctx.name) p.set('name', ctx.name);

  p.set('wgskip', '1');
  return p;
}

async function quickExists(url) {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      cache: 'no-store'
    });
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

function looksLikeHeroHealthHub(href = '') {
  const s = String(href || '').toLowerCase();
  return (
    s.includes('/herohealth/hub.html') ||
    s.includes('/herohealth/hub-v2.html')
  );
}

function looksLikeFitnessRoot(href = '') {
  const s = String(href || '').toLowerCase();
  return (
    s === 'https://supparang.github.io/webxr-health-mobile/fitness' ||
    s === 'https://supparang.github.io/webxr-health-mobile/fitness/' ||
    s.endsWith('/webxr-health-mobile/fitness') ||
    s.endsWith('/webxr-health-mobile/fitness/')
  );
}

function zonePageName(zone = '') {
  const z = String(zone || '').toLowerCase();
  if (z === 'fitness') return 'fitness-zone.html';
  if (z === 'nutrition') return 'nutrition-zone.html';
  if (z === 'hygiene') return 'hygiene-zone.html';
  return 'hub.html';
}

function zoneReturnLabel(ctx) {
  const z = String(ctx?.meta?.zone || ctx?.zone || '').toLowerCase();
  if (z === 'fitness') return 'กลับ Fitness Zone';
  if (z === 'nutrition') return 'กลับ Nutrition Zone';
  if (z === 'hygiene') return 'กลับ Hygiene Zone';
  return 'กลับหน้าหลัก';
}

function resolveZoneHomeHref(ctx) {
  const name = zonePageName(ctx?.meta?.zone || ctx?.zone || '');
  return new URL(`../${name}`, import.meta.url).href;
}

function classifyCompletionHref(href = '') {
  const s = String(href || '').toLowerCase();

  if (!href) return { kind: '', label: '' };
  if (s.includes('/herohealth/fitness-zone.html')) return { kind: 'zone', label: 'กลับ Fitness Zone' };
  if (s.includes('/herohealth/nutrition-zone.html')) return { kind: 'zone', label: 'กลับ Nutrition Zone' };
  if (s.includes('/herohealth/hygiene-zone.html')) return { kind: 'zone', label: 'กลับ Hygiene Zone' };
  if (looksLikeHeroHealthHub(s)) return { kind: 'hub', label: 'กลับหน้าหลัก' };
  if (s.includes('launcher')) return { kind: 'launcher', label: 'กลับหน้าเลือกเกม' };
  if (s.includes('summary')) return { kind: 'summary', label: 'ไปหน้าสรุป' };
  return { kind: 'next', label: 'ไปต่อ' };
}

function resolveHubHref(ctx) {
  const zoneHome = resolveZoneHomeHref(ctx);
  if (ctx?.meta?.zone) return zoneHome;

  const fallbackV2 = new URL('../hub-v2.html', import.meta.url).href;
  const fallbackClassic = new URL('../hub.html', import.meta.url).href;

  const rawHubRoot = String(ctx?.hubRoot || '').trim();
  const rawHub = String(ctx?.hub || '').trim();

  const hubRootAbs = resolveAbsoluteUrl(rawHubRoot);
  const hubAbs = resolveAbsoluteUrl(rawHub);

  if (hubRootAbs) {
    if (looksLikeHeroHealthHub(hubRootAbs)) return hubRootAbs;
    if (looksLikeFitnessRoot(hubRootAbs)) return zoneHome;
    return hubRootAbs;
  }

  if (hubAbs) {
    if (looksLikeFitnessRoot(hubAbs)) return zoneHome;
    if (looksLikeHeroHealthHub(hubAbs)) return hubAbs;
    return hubAbs;
  }

  return rawHubRoot.toLowerCase().includes('hub-v2') ? fallbackV2 : fallbackClassic;
}

function resolveLauncherHref(ctx) {
  const rawLauncher = String(ctx?.launcher || '').trim();
  if (rawLauncher) {
    const abs = resolveAbsoluteUrl(rawLauncher);
    if (abs) return abs;
  }

  if (normalizeGameId(ctx?.game) === 'jump-duck') {
    return new URL('../../fitness/jumpduck.html', import.meta.url).href;
  }

  const rawCdNext = String(ctx?.cdnext || ctx?.params?.get?.('cdnext') || '').trim();
  if (rawCdNext) {
    const abs = resolveAbsoluteUrl(rawCdNext);
    if (abs && !looksLikeHeroHealthHub(abs)) return abs;
  }

  const metaSummary =
    String(ctx?.meta?.summaryPath || ctx?.meta?.defaults?.summaryPath || '').trim();

  if (metaSummary) {
    try {
      const url = new URL(metaSummary, import.meta.url);

      if (ctx?.pid) url.searchParams.set('pid', ctx.pid);
      if (ctx?.name) url.searchParams.set('name', ctx.name);
      if (ctx?.diff) url.searchParams.set('diff', ctx.diff);
      if (ctx?.time) url.searchParams.set('time', ctx.time);
      if (ctx?.view) url.searchParams.set('view', ctx.view);

      const zoneHome = resolveZoneHomeHref(ctx);
      if (zoneHome) url.searchParams.set('hub', zoneHome);

      return url.href;
    } catch {}
  }

  return '';
}

async function resolveRunHref(ctx) {
  if (ctx.next) {
    const nextHref = resolveAbsoluteUrl(ctx.next);
    if (nextHref) {
      console.log('[GATE] resolveRunHref via next', nextHref);
      return nextHref;
    }
  }

  if (ctx.nextKey) {
    try {
      const stored = sessionStorage.getItem(ctx.nextKey);
      const storedHref = resolveAbsoluteUrl(stored);
      if (storedHref) {
        console.log('[GATE] resolveRunHref via nextKey', ctx.nextKey, storedHref);
        return storedHref;
      }
    } catch {}
  }

  const candidates = getRunCandidatesSafe(ctx.game);
  if (!candidates.length) return '';

  const params = buildRunParams(ctx);

  for (const rel of candidates) {
    try {
      const url = new URL(rel, import.meta.url);
      url.search = params.toString();

      const ok = await quickExists(url.href);
      if (ok) {
        console.log('[GATE] resolveRunHref via fallback', url.href);
        return url.href;
      }
    } catch {}
  }

  const fallback = new URL(candidates[0], import.meta.url);
  fallback.search = params.toString();
  console.log('[GATE] resolveRunHref final fallback', fallback.href);
  return fallback.href;
}

function resolveCompletionTarget(ctx, payload = {}) {
  const fromPayload = resolveAbsoluteUrl(String(payload?.summaryHref || '').trim());
  if (fromPayload) {
    console.log('[GATE] resolveCompletionTarget via payload', fromPayload);
    return {
      href: fromPayload,
      ...classifyCompletionHref(fromPayload)
    };
  }

  if (ctx.phase === 'cooldown' && ctx?.meta?.zone) {
    const zoneHome = resolveZoneHomeHref(ctx);
    console.log('[GATE] resolveCompletionTarget via zoneHome', zoneHome);
    return {
      href: zoneHome,
      ...classifyCompletionHref(zoneHome)
    };
  }

  const rawCdNext = String(ctx.params.get('cdnext') || ctx.cdnext || '').trim();
  if (rawCdNext) {
    const href = resolveAbsoluteUrl(rawCdNext);
    if (href) {
      if (looksLikeFitnessRoot(href) && ctx?.meta?.zone === 'fitness') {
        const zoneHome = resolveZoneHomeHref(ctx);
        return {
          href: zoneHome,
          ...classifyCompletionHref(zoneHome)
        };
      }

      console.log('[GATE] resolveCompletionTarget via cdnext', href);
      return {
        href,
        ...classifyCompletionHref(href)
      };
    }
  }

  const fromLauncher = resolveLauncherHref(ctx);
  if (fromLauncher) {
    console.log('[GATE] resolveCompletionTarget via launcher', fromLauncher);
    return {
      href: fromLauncher,
      ...classifyCompletionHref(fromLauncher)
    };
  }

  const metaSummary = ctx.meta?.defaults?.summaryPath || ctx.meta?.summaryPath || '';
  if (metaSummary) {
    const url = new URL(metaSummary, import.meta.url);

    if (ctx.pid) url.searchParams.set('pid', ctx.pid);
    if (ctx.name) url.searchParams.set('name', ctx.name);
    if (ctx.diff) url.searchParams.set('diff', ctx.diff);
    if (ctx.time) url.searchParams.set('time', ctx.time);
    if (ctx.view) url.searchParams.set('view', ctx.view);

    const hubHref = resolveHubHref(ctx);
    if (hubHref) url.searchParams.set('hub', hubHref);

    console.log('[GATE] resolveCompletionTarget via meta summary', url.href);
    return {
      href: url.href,
      ...classifyCompletionHref(url.href)
    };
  }

  return { href: '', kind: '', label: '' };
}

async function goRun(ctx) {
  const href = await resolveRunHref(ctx);
  console.log('[GATE] goRun ->', href, {
    game: ctx.game,
    phase: ctx.phase,
    next: ctx.next,
    nextKey: ctx.nextKey,
    search: location.search
  });

  if (!href) {
    toast('ไม่พบ run page ของเกมนี้');
    return;
  }
  location.href = href;
}

function goHub(ctx) {
  const href = resolveHubHref(ctx);
  console.log('[GATE] goHub ->', href, {
    rawHub: ctx.hub,
    rawHubRoot: ctx.hubRoot,
    rawLauncher: ctx.launcher,
    search: location.search
  });
  location.href = href;
}

function goCompletion(ctx, payload = {}) {
  const target = resolveCompletionTarget(ctx, payload);

  console.log('[GATE] goCompletion ->', target.href, {
    game: ctx.game,
    phase: ctx.phase,
    kind: target.kind,
    payloadSummaryHref: payload?.summaryHref || '',
    cdnext: ctx.params.get('cdnext') || ctx.cdnext || '',
    search: location.search
  });

  if (!target.href) {
    toast('ไม่พบหน้าถัดไปของเกมนี้');
    return;
  }

  location.href = target.href;
}

function isGoodJunkGate(ctx) {
  return normalizeGameId(ctx?.game || ctx?.gameRaw || '') === 'goodjunk';
}

function trySpecialGateRedirect(ctx, phaseOverride = '', warmupResult = null) {
  if (!isGoodJunkGate(ctx)) return false;

  try {
    const api = window.GoodJunkGateFinish;
    if (!api || typeof api.redirectGoodJunkGateFinish !== 'function') return false;

    const phase = String(phaseOverride || ctx?.phase || '').trim().toLowerCase() || 'warmup';

    console.log('[GATE] trySpecialGateRedirect', {
      game: ctx?.game,
      phase,
      hasHook: true
    });

    return !!api.redirectGoodJunkGateFinish({
      phase,
      warmupResult
    });
  } catch (err) {
    console.warn('[GATE] special redirect failed', err);
    return false;
  }
}

function mountFallbackPhase(stage, ctx, api) {
  const title = ctx.phase === 'cooldown'
    ? 'พร้อมสรุปผล'
    : 'พร้อมเข้าเกมหลัก';

  const desc = ctx.phase === 'cooldown'
    ? 'ไม่พบ module ของ cooldown เกมนี้ จึงใช้ fallback ให้ก่อน'
    : 'ไม่พบ module ของ warmup เกมนี้ จึงใช้ fallback ให้ก่อน';

  renderInfo(
    stage,
    title,
    desc,
    `<div class="gate-mini-note">fallback mode • ${esc(ctx.game)} • ${esc(ctx.phase)}</div>`
  );

  if (ctx.phase === 'cooldown') {
    api.complete({ source: 'fallback-cooldown' });
  } else {
    setTimeout(() => api.complete({ source: 'fallback-warmup' }), 600);
  }
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
        console.debug('[gate-mini]', event, {
          game: ctx.game,
          phase: ctx.phase,
          ...payload
        });
      } catch {}
    }
  };
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
    console.warn('[gate-core] no runnable export found in phase module:', Object.keys(mod));
    mountFallbackPhase(stage, ctx, api);
    return;
  }

  try {
    const cleanupEvents = attachCompletionEvents(stage, api);
    const result = await runner(stage, ctx, api);

    if (result && typeof result.start === 'function') {
      try {
        queueMicrotask(() => {
          try {
            result.start();
          } catch (err) {
            console.warn('[gate-core] phase start() failed:', err);
          }
        });
      } catch {
        try {
          result.start();
        } catch (err) {
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
    setActions(api.footer, [
      { label: zoneReturnLabel(ctx), onClick: () => goHub(ctx) },
      {
        label: ctx.phase === 'cooldown' ? zoneReturnLabel(ctx) : 'เข้าเกมหลัก',
        primary: true,
        onClick: () => api.complete({ source: 'error-skip' })
      }
    ]);
  }
}

function showAlreadyDone(stage, footer, ctx) {
  const zoneLabel = zoneReturnLabel(ctx);

  if (ctx.phase === 'cooldown') {
    const zoneHref = resolveZoneHomeHref(ctx);

    renderInfo(
      stage,
      'ทำ cooldown วันนี้แล้ว',
      ctx?.meta?.zone
        ? 'วันนี้ทำ cooldown ไปแล้ว ระบบจะกลับหน้าโซนทันที'
        : 'วันนี้ดูสรุป / cooldown ไปแล้ว ระบบจะกลับหน้าหลักทันที'
    );

    setActions(footer, [
      { label: zoneLabel, primary: true, onClick: () => { location.href = zoneHref; } }
    ]);

    setTimeout(() => {
      location.href = zoneHref;
    }, 180);
    return;
  }

  if (isGoodJunkGate(ctx)) {
    renderInfo(
      stage,
      'ทำ warmup วันนี้แล้ว',
      'ระบบจะพาเข้าเกมหลักต่อทันที เพราะ warmup กำหนดให้ทำวันละครั้งต่อคนต่อเกม'
    );

    setActions(footer, [
      {
        label: 'เข้าเกมหลัก',
        primary: true,
        onClick: () => {
          if (trySpecialGateRedirect(ctx, 'warmup', { source: 'already-done' })) return;
          goRun(ctx);
        }
      },
      { label: zoneLabel, onClick: () => goHub(ctx) }
    ]);

    setTimeout(() => {
      if (trySpecialGateRedirect(ctx, 'warmup', { source: 'already-done' })) return;
      goRun(ctx);
    }, 350);
    return;
  }

  renderInfo(
    stage,
    'ทำ warmup วันนี้แล้ว',
    'ระบบจะพาเข้าเกมหลักต่อทันที เพราะ warmup กำหนดให้ทำวันละครั้งต่อคนต่อเกม'
  );

  setActions(footer, [
    { label: 'เข้าเกมหลัก', primary: true, onClick: () => goRun(ctx) },
    { label: zoneLabel, onClick: () => goHub(ctx) }
  ]);

  setTimeout(() => {
    goRun(ctx);
  }, 350);
}

function showInvalidGame(stage, footer, ctx) {
  renderInfo(
    stage,
    'ไม่พบเกมที่ต้องการ',
    `game id ไม่ถูกต้องหรือไม่มีใน registry: <code>${esc(ctx.gameRaw || '(empty)')}</code>`
  );

  setActions(footer, [
    { label: zoneReturnLabel(ctx), primary: true, onClick: () => goHub(ctx) }
  ]);
}

export async function bootGate(root = document.getElementById('gate-app')) {
  ensureCoreStyle();

  if (!root) {
    throw new Error('ไม่พบ #gate-app');
  }

  const ctx = readCtx();
  setDocTitle(ctx);

  const refs = renderShell(root, ctx);
  const { stage, footer } = refs;

  applyStats(refs, {
    time: ctx.phase === 'cooldown' ? 0 : (ctx.time || '-'),
    score: 0,
    miss: 0,
    acc: '0%'
  });

  if (ctx.phase === 'cooldown') {
    applyCooldownSnapshot(refs, ctx);
    setHeroSub(
      refs,
      ctx?.meta?.zone
        ? `สรุปผลล่าสุดพร้อมแล้ว เมื่อจบ cooldown ระบบจะพากลับ ${zoneReturnLabel(ctx).replace('กลับ ', '')}`
        : 'สรุปผลล่าสุดพร้อมแล้ว ตรวจดูได้ในหน้านี้ แล้วค่อยกดไปหน้าถัดไปหรือกลับหน้าหลัก'
    );
  }

  if (!ctx.game || !ctx.meta) {
    showInvalidGame(stage, footer, ctx);
    return;
  }

  const api = {
    ctx,
    root: stage,
    mountRoot: stage,
    footer,

    _done: false,
    _destroy: null,

    logger: createCompatLogger(ctx),
    toast,

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
        setDailyDone(ctx, ctx.phase, true);
      }

      const title = payload.title ||
        (ctx.phase === 'cooldown' ? 'Cooldown เสร็จแล้ว' : 'พร้อมแล้ว ไปต่อกัน');

      const subtitle = payload.subtitle ||
        (ctx.phase === 'cooldown'
          ? (ctx?.meta?.zone
              ? `บันทึกผลล่าสุดเรียบร้อย ระบบพร้อมพากลับ ${zoneReturnLabel(ctx).replace('กลับ ', '')}`
              : 'บันทึกผลล่าสุดเรียบร้อย ตรวจดูสรุปได้จากหน้านี้ แล้วค่อยไปหน้าถัดไป')
          : 'warmup เสร็จแล้ว ระบบกำลังพาเข้าเกมหลัก');

      const extra = linesHtml(payload.lines || []);
      const zoneLabel = zoneReturnLabel(ctx);

      if (ctx.phase === 'warmup') {
        renderInfo(stage, title, subtitle, extra);

        setActions(footer, [
          {
            label: 'เข้าเกมหลัก',
            primary: true,
            onClick: () => {
              if (trySpecialGateRedirect(ctx, 'warmup', payload)) return;
              goRun(ctx);
            }
          },
          { label: zoneLabel, onClick: () => goHub(ctx) }
        ]);

        await delay(180);

        if (trySpecialGateRedirect(ctx, 'warmup', payload)) return;

        await goRun(ctx);
        return;
      }

      const specialRedirected = trySpecialGateRedirect(ctx, 'cooldown', payload);

      console.log('[GATE] cooldown complete', {
        game: ctx.game,
        phase: ctx.phase,
        cdnext: ctx.params.get('cdnext') || ctx.cdnext || '',
        payloadSummaryHref: payload?.summaryHref || '',
        specialRedirected
      });

      if (specialRedirected) return;

      const completionTarget = resolveCompletionTarget(ctx, payload);

      saveLastSummary({
        source: 'gate-core',
        phase: ctx.phase,
        game: ctx.game,
        cat: ctx.cat,
        zone: ctx.zone,
        pid: ctx.pid,
        diff: ctx.diff,
        time: ctx.time,
        seed: ctx.seed,
        view: ctx.view,
        patch: PATCH,
        hub: ctx.hub || '',
        hubRoot: ctx.hubRoot || '',
        launcher: ctx.launcher || '',
        payload,
        completionHref: completionTarget.href,
        completionKind: completionTarget.kind
      });

      renderInfo(stage, title, subtitle, extra);
      applyCooldownSnapshot(refs, ctx);

      if (completionTarget.href && (completionTarget.kind === 'hub' || completionTarget.kind === 'zone')) {
        setActions(footer, [
          { label: completionTarget.label || zoneLabel, primary: true, onClick: () => goCompletion(ctx, payload) }
        ]);
        return;
      }

      if (completionTarget.href) {
        setActions(footer, [
          { label: completionTarget.label || 'ไปต่อ', primary: true, onClick: () => goCompletion(ctx, payload) },
          { label: zoneLabel, onClick: () => goHub(ctx) }
        ]);
        return;
      }

      const launcherHref = resolveLauncherHref(ctx);
      if (launcherHref) {
        setActions(footer, [
          { label: 'กลับ Launcher', primary: true, onClick: () => { location.href = launcherHref; } },
          { label: zoneLabel, onClick: () => goHub(ctx) }
        ]);
        return;
      }

      setActions(footer, [
        { label: zoneLabel, primary: true, onClick: () => goHub(ctx) }
      ]);

      return;
    },

    async finish(payload = {}) { return api.complete(payload); },
    async done(payload = {}) { return api.complete(payload); },
    async summary(payload = {}) { return api.complete(payload); },
    async next(payload = {}) { return api.complete(payload); },
    async skip(payload = {}) { return api.complete({ skipped: true, ...payload }); },

    fail(err) {
      console.error('[gate-core] fail:', err);
      renderError(stage, 'Gate fail', err);
      setActions(footer, [
        { label: zoneReturnLabel(ctx), onClick: () => goHub(ctx) },
        {
          label: ctx.phase === 'cooldown' ? zoneReturnLabel(ctx) : 'เข้าเกมหลัก',
          primary: true,
          onClick: () => api.complete({ source: 'fail-skip' })
        }
      ]);
    },

    goRun() {
      return goRun(ctx);
    },

    goHub() {
      return goHub(ctx);
    },

    goCompletion(payload = {}) {
      return goCompletion(ctx, payload);
    }
  };

  const alreadyDone = !shouldForceGate(ctx) && getDailyDone(ctx, ctx.phase);
  if (alreadyDone) {
    showAlreadyDone(stage, footer, ctx);
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