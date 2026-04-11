// === /herohealth/vr-goodjunk/goodjunk-mode-play-router.js ===
// FULL PATCH v20260411b-GJ-MODE-PLAY-ROUTER-ROOM-NORMALIZE

const PASS_KEYS = [
  'pid','name','nick','diff','time','view','hub',
  'sbUrl','sbAnon','studyId','conditionGroup',
  'phase','log','ai','pro','research','seed','run',
  'planSeq','planDay','planSlot','planMode','planSlots','planIndex',
  'cdnext','zone','cat','game','gameId','theme',
  'room','roomId','roomCode',
  'role','lobby','entry','multiplayer','fromLobby','modeLocked',
  'api','autogo','ready'
];

const STORAGE = {
  lastModePrefix: 'GJ_LAST_MODE:',
  lastRunUrlPrefix: 'GJ_LAST_RUN_URL:',
  recentRoomPrefix: 'GJ_RECENT_ROOM:'
};

function qs(k, d = '') {
  try { return new URL(location.href).searchParams.get(k) ?? d; }
  catch (_) { return d; }
}

function clean(v, d = '') {
  const s = String(v ?? '').trim();
  return s || d;
}

function buildUrl(path, params = {}, base = location.href) {
  const u = new URL(path, base);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      u.searchParams.set(k, String(v));
    }
  });
  return u.toString();
}

function saveRecentRoom(mode, room) {
  try {
    localStorage.setItem(`${STORAGE.recentRoomPrefix}${mode}`, String(room || ''));
  } catch (_) {}
}

function saveLastMode(pid, mode, href) {
  try {
    localStorage.setItem(`${STORAGE.lastModePrefix}${pid}`, String(mode || ''));
    localStorage.setItem(`${STORAGE.lastRunUrlPrefix}${pid}`, String(href || ''));
  } catch (_) {}
}

function generateRoomCode(prefix = 'GJ') {
  const part = Math.random().toString(36).slice(2, 6).toUpperCase();
  const tail = String(Date.now()).slice(-4);
  return `${prefix}-${part}${tail}`;
}

function ensureStyle() {
  if (document.getElementById('gjPlayRouterStyle')) return;

  const style = document.createElement('style');
  style.id = 'gjPlayRouterStyle';
  style.textContent = `
    html,body{
      margin:0;
      min-height:100%;
      color:#f8fafc;
      background:
        radial-gradient(700px 420px at 10% 10%, rgba(56,189,248,.18), transparent 60%),
        radial-gradient(700px 420px at 90% 0%, rgba(167,139,250,.16), transparent 56%),
        linear-gradient(180deg,#071226,#10234a 52%,#1d4ed8);
      font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Thai",sans-serif;
    }

    .wrap{
      min-height:100dvh;
      display:grid;
      place-items:center;
      padding:16px;
    }

    .card{
      width:min(92vw,720px);
      border-radius:28px;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(2,6,23,.68);
      box-shadow:0 18px 50px rgba(0,0,0,.28);
      padding:22px 18px;
      text-align:center;
      backdrop-filter:blur(12px);
    }

    .icon{
      width:96px;
      height:96px;
      margin:0 auto 14px;
      border-radius:28px;
      display:grid;
      place-items:center;
      font-size:48px;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(255,255,255,.08);
    }

    h1{
      margin:0;
      font-size:clamp(28px,4.6vw,42px);
      line-height:1.06;
      font-weight:1000;
    }

    .sub{
      margin-top:10px;
      color:#dbeafe;
      font-size:15px;
      line-height:1.65;
      font-weight:900;
    }

    .status{
      margin-top:14px;
      display:grid;
      gap:10px;
      text-align:left;
    }

    .status-item{
      border-radius:18px;
      border:1px solid rgba(255,255,255,.12);
      background:rgba(255,255,255,.06);
      padding:12px;
    }

    .k{
      font-size:12px;
      color:#dbeafe;
      font-weight:1000;
    }

    .v{
      margin-top:6px;
      font-size:17px;
      font-weight:1000;
      line-height:1.25;
      word-break:break-word;
    }

    .actions{
      margin-top:16px;
      display:grid;
      gap:10px;
    }

    .btn{
      min-height:50px;
      border-radius:18px;
      border:1px solid rgba(255,255,255,.16);
      background:rgba(255,255,255,.06);
      color:#fff;
      font-size:15px;
      font-weight:1000;
      cursor:pointer;
      padding:12px 16px;
    }

    .btn.primary{
      background:linear-gradient(180deg, rgba(56,189,248,.24), rgba(56,189,248,.14));
      border-color:rgba(56,189,248,.34);
    }
  `;
  document.head.appendChild(style);
}

function renderShell({ title, subtitle, emoji }) {
  document.body.innerHTML = `
    <div class="wrap">
      <div class="card">
        <div class="icon">${emoji}</div>
        <h1>${title}</h1>
        <div class="sub">${subtitle}</div>

        <div class="status">
          <div class="status-item">
            <div class="k">โหมด</div>
            <div class="v" id="modeText">-</div>
          </div>
          <div class="status-item">
            <div class="k">Room</div>
            <div class="v" id="roomText">-</div>
          </div>
          <div class="status-item">
            <div class="k">Role</div>
            <div class="v" id="roleText">-</div>
          </div>
          <div class="status-item">
            <div class="k">ปลายทาง play จริง</div>
            <div class="v" id="targetText">-</div>
          </div>
        </div>

        <div class="actions">
          <button class="btn primary" id="goNowBtn" type="button">เข้าเกมตอนนี้</button>
          <button class="btn" id="backLauncherBtn" type="button">กลับ Launcher</button>
        </div>
      </div>
    </div>
  `;
}

export function bootGoodJunkModePlay(config = {}) {
  const mode = clean(config.mode, 'race').toLowerCase();
  const title = clean(config.title, `GoodJunk • ${mode} Play`);
  const subtitle = clean(config.subtitle, `กำลัง lock โหมด ${mode} ก่อนเข้า play จริง`);
  const emoji = clean(config.emoji, '🎮');
  const targetPath = clean(config.targetPath, './goodjunk-vr.html');
  const launcherPath = clean(config.launcherPath, '../goodjunk-launcher.html');

  ensureStyle();
  renderShell({ title, subtitle, emoji });

  const params = {};
  PASS_KEYS.forEach((k) => {
    const v = qs(k, '');
    if (v !== '') params[k] = v;
  });

  params.pid = clean(params.pid, 'anon');
  params.name = clean(params.name || params.nick, 'Hero');
  params.nick = clean(params.nick || params.name, params.name);
  params.diff = clean(params.diff, 'normal');
  params.time = clean(params.time, '90');
  params.view = clean(params.view, 'mobile');
  params.hub = clean(params.hub, '../hub-v2.html');
  params.seed = clean(params.seed, String(Date.now()));
  params.run = clean(params.run, 'play');
  params.zone = clean(params.zone, 'nutrition');
  params.cat = clean(params.cat, 'nutrition');
  params.game = clean(params.game, 'goodjunk');
  params.gameId = clean(params.gameId, 'goodjunk');
  params.theme = clean(params.theme, 'goodjunk');
  params.mode = mode;
  params.entry = clean(params.entry, mode);
  params.multiplayer = clean(params.multiplayer, '1');
  params.fromLobby = clean(params.fromLobby, '1');
  params.modeLocked = clean(params.modeLocked, '1');
  params.lobby = clean(params.lobby, '1');

  const roomPrefix =
    mode === 'duet' ? 'GJ-DU' :
    mode === 'race' ? 'GJ-RA' :
    mode === 'battle' ? 'GJ-BA' :
    'GJ-CO';

  const isMultiMode = ['duet', 'race', 'battle', 'coop'].includes(mode);
  const incomingRoom = clean(params.room || params.roomId || params.roomCode, '');
  const roomWasGenerated = !!(isMultiMode && !incomingRoom);
  const normalizedRoom = incomingRoom || (isMultiMode ? generateRoomCode(roomPrefix) : '');

  if (normalizedRoom) {
    params.room = normalizedRoom;
    params.roomId = normalizedRoom;
    params.roomCode = normalizedRoom;
    saveRecentRoom(mode, normalizedRoom);
  }

  params.role = clean(params.role, roomWasGenerated ? 'host' : 'guest');

  const finalHref = buildUrl(targetPath, params);
  saveLastMode(params.pid, mode, finalHref);

  document.getElementById('modeText').textContent = mode.toUpperCase();
  document.getElementById('roomText').textContent = normalizedRoom || '-';
  document.getElementById('roleText').textContent = params.role.toUpperCase();
  document.getElementById('targetText').textContent = finalHref;

  document.getElementById('goNowBtn').addEventListener('click', () => {
    location.href = finalHref;
  });

  document.getElementById('backLauncherBtn').addEventListener('click', () => {
    location.href = buildUrl(launcherPath, {
      pid: params.pid,
      name: params.name,
      diff: params.diff,
      time: params.time,
      hub: params.hub,
      view: params.view,
      run: params.run,
      seed: params.seed,
      zone: params.zone,
      cat: params.cat,
      game: params.game,
      gameId: params.gameId,
      theme: params.theme,
      recommendedMode: mode
    });
  });

  const autoGo = clean(params.autogo || qs('autogo', '1'), '1');
  if (autoGo !== '0') {
    setTimeout(() => {
      location.replace(finalHref);
    }, 220);
  }
}