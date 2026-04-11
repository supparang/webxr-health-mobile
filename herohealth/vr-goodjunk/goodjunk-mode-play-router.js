// /herohealth/vr-goodjunk/goodjunk-mode-play-router.js
// FULL PATCH v20260411c-GJ-MODE-PLAY-ROUTER-CDNEXT-ROOM-STABLE

const PATCH = 'v20260411c-GJ-MODE-PLAY-ROUTER-CDNEXT-ROOM-STABLE';

function qs(name, fallback = '') {
  try {
    return new URL(location.href).searchParams.get(name) ?? fallback;
  } catch (_) {
    return fallback;
  }
}

function clean(v, fallback = '') {
  const s = String(v ?? '').trim();
  return s || fallback;
}

function buildUrl(path, extra = {}, base = location.href) {
  const u = new URL(path, base);
  Object.entries(extra).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      u.searchParams.set(k, String(v));
    }
  });
  return u.toString();
}

function esc(s = '') {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function modeEmoji(mode = '') {
  const m = String(mode || '').toLowerCase();
  if (m === 'duet') return '🤝';
  if (m === 'race') return '🏁';
  if (m === 'battle') return '⚔️';
  if (m === 'coop') return '🤝';
  return '🎮';
}

function normalizeRole(raw = '') {
  const s = clean(raw).toLowerCase();
  if (s === 'host') return 'host';
  if (s === 'guest') return 'guest';
  return '';
}

function normalizeMode(raw = '') {
  const s = clean(raw).toLowerCase();
  if (['duet', 'race', 'battle', 'coop'].includes(s)) return s;
  return '';
}

function normalizeEntry(raw = '', mode = '') {
  const s = clean(raw).toLowerCase();
  if (s) return s;
  return mode || 'multi';
}

function defaultLauncherMode(mode = '') {
  const m = normalizeMode(mode);
  return m || 'solo';
}

function readCtx(modeOverride = '') {
  const mode = normalizeMode(modeOverride || qs('mode', '')) || 'solo';
  const roomId = clean(qs('roomId', qs('room', '')));

  return {
    patch: PATCH,
    mode,
    entry: normalizeEntry(qs('entry', ''), mode),
    pid: clean(qs('pid', 'anon')),
    name: clean(qs('name', qs('nick', 'Hero'))),
    nick: clean(qs('nick', qs('name', 'Hero'))),
    roomId,
    room: roomId,
    diff: clean(qs('diff', 'normal')),
    time: clean(qs('time', '90')),
    view: clean(qs('view', 'mobile')),
    hub: clean(qs('hub', '../hub.html')),
    run: clean(qs('run', 'play')),
    seed: clean(qs('seed', String(Date.now()))),
    zone: clean(qs('zone', 'nutrition')),
    cat: clean(qs('cat', 'nutrition')),
    game: clean(qs('game', 'goodjunk')),
    gameId: clean(qs('gameId', 'goodjunk')),
    theme: clean(qs('theme', 'goodjunk')),
    studyId: clean(qs('studyId', '')),
    conditionGroup: clean(qs('conditionGroup', '')),
    role: normalizeRole(qs('role', '')) || (qs('host', '0') === '1' ? 'host' : 'guest'),
    host: qs('host', '0') === '1' ? '1' : '0',
    wait: clean(qs('wait', '1')),
    autostart: clean(qs('autostart', '1')),
    modeLocked: clean(qs('modeLocked', '1')),
    roomReady: clean(qs('roomReady', '0')),
    maxPlayers: clean(qs('maxPlayers', '')),
    recommendedMode: clean(qs('recommendedMode', mode || 'solo')),
    cdnext: clean(qs('cdnext', ''))
  };
}

function buildLauncherUrl(ctx) {
  return buildUrl('../goodjunk-launcher.html', {
    pid: ctx.pid,
    name: ctx.name,
    nick: ctx.nick,
    diff: ctx.diff,
    time: ctx.time,
    hub: ctx.hub,
    view: ctx.view,
    run: ctx.run,
    seed: ctx.seed,
    zone: ctx.zone,
    cat: ctx.cat,
    game: ctx.game,
    gameId: ctx.gameId,
    theme: ctx.theme,
    recommendedMode: defaultLauncherMode(ctx.mode),
    studyId: ctx.studyId,
    conditionGroup: ctx.conditionGroup
  });
}

function buildLobbyUrl(ctx) {
  const map = {
    duet: '../goodjunk-duet-lobby.html',
    race: '../goodjunk-race-lobby.html',
    battle: '../goodjunk-battle-lobby.html',
    coop: '../goodjunk-coop-lobby.html'
  };

  const lobbyPath = map[ctx.mode] || '../goodjunk-launcher.html';

  return buildUrl(lobbyPath, {
    mode: ctx.mode,
    entry: ctx.entry,
    recommendedMode: ctx.mode,
    pid: ctx.pid,
    name: ctx.name,
    nick: ctx.nick,
    diff: ctx.diff,
    time: ctx.time,
    view: ctx.view,
    hub: ctx.hub,
    run: ctx.run,
    seed: ctx.seed,
    zone: ctx.zone,
    cat: ctx.cat,
    game: ctx.game,
    gameId: ctx.gameId,
    theme: ctx.theme,
    roomId: ctx.roomId,
    room: ctx.roomId,
    studyId: ctx.studyId,
    conditionGroup: ctx.conditionGroup
  });
}

function ensureCdnext(ctx) {
  return ctx.cdnext || buildLauncherUrl(ctx);
}

function buildForwardQuery(ctx) {
  const p = new URLSearchParams();

  p.set('mode', ctx.mode);
  p.set('entry', ctx.entry);

  p.set('pid', ctx.pid);
  p.set('name', ctx.name);
  p.set('nick', ctx.nick);

  if (ctx.roomId) {
    p.set('roomId', ctx.roomId);
    p.set('room', ctx.roomId);
  }

  p.set('diff', ctx.diff);
  p.set('time', ctx.time);
  p.set('view', ctx.view);
  p.set('hub', ctx.hub);
  p.set('run', ctx.run);
  p.set('seed', ctx.seed);
  p.set('zone', ctx.zone);
  p.set('cat', ctx.cat);
  p.set('game', ctx.game);
  p.set('gameId', ctx.gameId);
  p.set('theme', ctx.theme);

  if (ctx.studyId) p.set('studyId', ctx.studyId);
  if (ctx.conditionGroup) p.set('conditionGroup', ctx.conditionGroup);

  if (ctx.role) p.set('role', ctx.role);
  p.set('host', ctx.host);
  p.set('wait', ctx.wait);
  p.set('autostart', ctx.autostart);
  p.set('modeLocked', ctx.modeLocked);
  p.set('roomReady', ctx.roomReady);

  if (ctx.maxPlayers) p.set('maxPlayers', ctx.maxPlayers);

  p.set('recommendedMode', ctx.recommendedMode || ctx.mode);
  p.set('cdnext', ensureCdnext(ctx));

  return p;
}

function buildTargetHref(targetPath, ctx) {
  const url = new URL(targetPath, location.href);
  url.search = buildForwardQuery(ctx).toString();
  return url.toString();
}

function injectStyle() {
  if (document.getElementById('gj-mode-play-router-style')) return;

  const style = document.createElement('style');
  style.id = 'gj-mode-play-router-style';
  style.textContent = `
    :root{
      --bg1:#0f172a;
      --bg2:#1e293b;
      --bg3:#334155;
      --panel:rgba(15,23,42,.78);
      --stroke:rgba(255,255,255,.14);
      --text:#f8fafc;
      --muted:#cbd5e1;
      --good:#22c55e;
      --info:#38bdf8;
      --warn:#f59e0b;
      --shadow:0 22px 60px rgba(0,0,0,.34);
    }

    *{ box-sizing:border-box; }

    html,body{
      margin:0;
      min-height:100%;
      background:
        radial-gradient(900px 520px at 10% 10%, rgba(56,189,248,.14), transparent 60%),
        radial-gradient(900px 560px at 90% 0%, rgba(167,139,250,.12), transparent 60%),
        linear-gradient(180deg,var(--bg1),var(--bg2) 48%,var(--bg3));
      color:var(--text);
      font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
    }

    body{
      overflow-x:hidden;
    }

    .gj-router-shell{
      min-height:100dvh;
      max-width:980px;
      margin:0 auto;
      padding:18px;
      display:grid;
      place-items:center;
    }

    .gj-router-card{
      width:min(100%, 880px);
      border-radius:28px;
      border:1px solid var(--stroke);
      background:var(--panel);
      backdrop-filter:blur(12px);
      box-shadow:var(--shadow);
      overflow:hidden;
    }

    .gj-router-hero{
      padding:20px;
      display:grid;
      gap:14px;
    }

    .gj-router-top{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:14px;
      flex-wrap:wrap;
    }

    .gj-router-brand{
      display:flex;
      align-items:center;
      gap:12px;
      min-width:0;
    }

    .gj-router-icon{
      width:74px;
      height:74px;
      border-radius:24px;
      display:grid;
      place-items:center;
      font-size:38px;
      border:1px solid rgba(255,255,255,.14);
      background:
        radial-gradient(circle at 30% 30%, rgba(255,255,255,.24), transparent 40%),
        linear-gradient(135deg, rgba(56,189,248,.20), rgba(167,139,250,.16));
      box-shadow:0 12px 28px rgba(0,0,0,.16);
      flex:0 0 auto;
    }

    .gj-router-title{
      font-size:30px;
      line-height:1.08;
      font-weight:1000;
      color:#fff;
    }

    .gj-router-subtitle{
      margin-top:6px;
      color:var(--muted);
      font-size:14px;
      line-height:1.6;
      font-weight:900;
    }

    .gj-router-actions{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
    }

    .gj-router-btn{
      min-height:46px;
      border-radius:16px;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(255,255,255,.06);
      color:#fff;
      text-decoration:none;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:10px 14px;
      font-size:14px;
      font-weight:1000;
      cursor:pointer;
      box-shadow:0 10px 20px rgba(0,0,0,.16);
      transition:transform .12s ease, filter .12s ease;
    }

    .gj-router-btn:hover{
      transform:translateY(-1px);
      filter:brightness(1.05);
    }

    .gj-router-btn.info{
      background:linear-gradient(180deg, rgba(56,189,248,.24), rgba(56,189,248,.14));
      border-color:rgba(56,189,248,.34);
      color:#eefbff;
    }

    .gj-router-btn.good{
      background:linear-gradient(180deg, rgba(34,197,94,.24), rgba(34,197,94,.14));
      border-color:rgba(34,197,94,.34);
      color:#f0fff5;
    }

    .gj-router-stats{
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:10px;
    }

    .gj-router-stat{
      border-radius:18px;
      border:1px solid rgba(255,255,255,.12);
      background:rgba(255,255,255,.06);
      padding:12px;
      min-height:82px;
      display:flex;
      flex-direction:column;
      justify-content:center;
      gap:6px;
    }

    .gj-router-label{
      font-size:11px;
      color:var(--muted);
      font-weight:1000;
    }

    .gj-router-value{
      font-size:22px;
      line-height:1.15;
      font-weight:1000;
      color:#fff;
      word-break:break-word;
    }

    .gj-router-body{
      padding:0 20px 20px;
      display:grid;
      gap:12px;
    }

    .gj-router-notice{
      border-radius:20px;
      border:1px solid rgba(255,255,255,.12);
      background:rgba(255,255,255,.06);
      padding:14px 16px;
      font-size:14px;
      line-height:1.7;
      font-weight:900;
      color:#fff7ed;
    }

    .gj-router-notice.info{
      border-color:rgba(56,189,248,.28);
      background:rgba(56,189,248,.14);
      color:#eefbff;
    }

    .gj-router-notice.good{
      border-color:rgba(34,197,94,.28);
      background:rgba(34,197,94,.14);
      color:#f0fff5;
    }

    .gj-router-log{
      border-radius:18px;
      border:1px solid rgba(255,255,255,.12);
      background:rgba(15,23,42,.46);
      padding:12px 14px;
      color:#e2e8f0;
      font-size:12px;
      line-height:1.55;
      font-weight:900;
      min-height:72px;
      white-space:pre-wrap;
      word-break:break-word;
    }

    @media (max-width:780px){
      .gj-router-stats{
        grid-template-columns:repeat(2,minmax(0,1fr));
      }
      .gj-router-top{
        align-items:flex-start;
      }
      .gj-router-actions{
        justify-content:flex-start;
      }
      .gj-router-title{
        font-size:24px;
      }
    }

    @media (max-width:560px){
      .gj-router-stats{
        grid-template-columns:1fr;
      }
      .gj-router-shell{
        padding:12px;
      }
      .gj-router-hero{
        padding:16px;
      }
      .gj-router-body{
        padding:0 16px 16px;
      }
    }
  `;
  document.head.appendChild(style);
}

function renderShell({
  title = 'GoodJunk Mode Play',
  subtitle = 'กำลังเตรียมหน้าเล่น',
  emoji = '🎮',
  ctx,
  lobbyHref,
  launcherHref
}) {
  document.body.innerHTML = `
    <div class="gj-router-shell">
      <div class="gj-router-card">
        <div class="gj-router-hero">
          <div class="gj-router-top">
            <div class="gj-router-brand">
              <div class="gj-router-icon">${esc(emoji)}</div>
              <div>
                <div class="gj-router-title">${esc(title)}</div>
                <div class="gj-router-subtitle">${esc(subtitle)}</div>
              </div>
            </div>

            <div class="gj-router-actions">
              <a class="gj-router-btn" href="${esc(lobbyHref)}">กลับ Lobby</a>
              <a class="gj-router-btn info" href="${esc(ctx.hub)}">กลับ Hub</a>
              <a class="gj-router-btn good" href="${esc(launcherHref)}">กลับ Launcher</a>
            </div>
          </div>

          <div class="gj-router-stats">
            <div class="gj-router-stat">
              <div class="gj-router-label">Mode</div>
              <div class="gj-router-value">${esc(ctx.mode || '-')}</div>
            </div>
            <div class="gj-router-stat">
              <div class="gj-router-label">Room</div>
              <div class="gj-router-value">${esc(ctx.roomId || '-')}</div>
            </div>
            <div class="gj-router-stat">
              <div class="gj-router-label">Role</div>
              <div class="gj-router-value">${esc(ctx.role || '-')}</div>
            </div>
            <div class="gj-router-stat">
              <div class="gj-router-label">Patch</div>
              <div class="gj-router-value">${esc(PATCH)}</div>
            </div>
          </div>
        </div>

        <div class="gj-router-body">
          <div id="gjRouterNotice" class="gj-router-notice info">
            กำลังตรวจสอบข้อมูลห้องและส่งต่อไปยัง runtime จริง…
          </div>

          <div id="gjRouterLog" class="gj-router-log">booting…</div>
        </div>
      </div>
    </div>
  `;
}

function setNotice(kind = 'info', text = '') {
  const el = document.getElementById('gjRouterNotice');
  if (!el) return;
  el.className = `gj-router-notice ${kind}`;
  el.innerHTML = text;
}

function setLog(text = '') {
  const el = document.getElementById('gjRouterLog');
  if (!el) return;
  el.textContent = `[${new Date().toLocaleTimeString('th-TH', { hour12:false })}] ${text}`;
}

function normalizeSearchForRouter(ctx) {
  const url = new URL(location.href);
  const p = url.searchParams;

  p.set('mode', ctx.mode);
  p.set('entry', ctx.entry);
  p.set('pid', ctx.pid);
  p.set('name', ctx.name);
  p.set('nick', ctx.nick);

  if (ctx.roomId) {
    p.set('roomId', ctx.roomId);
    p.set('room', ctx.roomId);
  }

  p.set('diff', ctx.diff);
  p.set('time', ctx.time);
  p.set('view', ctx.view);
  p.set('hub', ctx.hub);
  p.set('run', ctx.run);
  p.set('seed', ctx.seed);
  p.set('zone', ctx.zone);
  p.set('cat', ctx.cat);
  p.set('game', ctx.game);
  p.set('gameId', ctx.gameId);
  p.set('theme', ctx.theme);

  if (ctx.studyId) p.set('studyId', ctx.studyId);
  if (ctx.conditionGroup) p.set('conditionGroup', ctx.conditionGroup);

  if (ctx.role) p.set('role', ctx.role);
  p.set('host', ctx.host);
  p.set('wait', ctx.wait);
  p.set('autostart', ctx.autostart);
  p.set('modeLocked', ctx.modeLocked);
  p.set('roomReady', ctx.roomReady);

  if (ctx.maxPlayers) p.set('maxPlayers', ctx.maxPlayers);

  p.set('recommendedMode', ctx.recommendedMode || ctx.mode);
  p.set('cdnext', ensureCdnext(ctx));

  const href = url.toString();
  if (href !== location.href) {
    history.replaceState(null, '', href);
  }
}

async function forwardToRuntime(targetPath, ctx) {
  const href = buildTargetHref(targetPath, ctx);

  setNotice('good', 'พร้อมแล้ว กำลังส่งต่อไปยัง runtime จริง');
  setLog(`forward -> ${href}`);

  await new Promise(resolve => setTimeout(resolve, 180));
  location.href = href;
}

export async function bootGoodJunkModePlay(config = {}) {
  const modeFromConfig = normalizeMode(config.mode || '');
  const ctx = readCtx(modeFromConfig);

  normalizeSearchForRouter(ctx);

  injectStyle();

  const launcherHref = buildLauncherUrl(ctx);
  const lobbyHref = buildLobbyUrl(ctx);

  renderShell({
    title: clean(config.title, `GoodJunk • ${ctx.mode || 'Mode'} Play`),
    subtitle: clean(config.subtitle, 'กำลังเตรียมเข้า runtime จริง'),
    emoji: clean(config.emoji, modeEmoji(ctx.mode)),
    ctx,
    lobbyHref,
    launcherHref
  });

  if (!ctx.mode || ctx.mode === 'solo') {
    setNotice('info', 'ไม่พบ multiplayer mode ที่ถูกต้อง กำลังกลับหน้า launcher');
    setLog('invalid mode -> launcher');
    setTimeout(() => {
      location.href = launcherHref;
    }, 220);
    return;
  }

  if (!ctx.roomId) {
    setNotice('info', 'ไม่พบ room id กำลังกลับหน้า lobby');
    setLog('missing roomId -> lobby');
    setTimeout(() => {
      location.href = lobbyHref;
    }, 220);
    return;
  }

  const targetPath = clean(config.targetPath, '');
  if (!targetPath) {
    setNotice('info', 'ไม่พบ runtime target path กำลังกลับหน้า launcher');
    setLog('missing targetPath -> launcher');
    setTimeout(() => {
      location.href = launcherHref;
    }, 220);
    return;
  }

  try {
    setLog(`mode=${ctx.mode} room=${ctx.roomId} role=${ctx.role || '-'} cdnext=${ensureCdnext(ctx)}`);
    await forwardToRuntime(targetPath, ctx);
  } catch (err) {
    setNotice('info', 'ส่งต่อไป runtime ไม่สำเร็จ กำลังกลับหน้า lobby');
    setLog(`forward failed: ${String(err?.message || err || 'unknown error')}`);
    setTimeout(() => {
      location.href = lobbyHref;
    }, 260);
  }
}

export default bootGoodJunkModePlay;