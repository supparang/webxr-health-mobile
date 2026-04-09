// === /herohealth/vr-goodjunk/goodjunk-mode-lobby.js ===
// FULL PATCH v20260409a-GJ-MODE-LOBBY-SHARED

const PASS_KEYS = [
  'pid','name','nick','diff','time','view','hub',
  'sbUrl','sbAnon','studyId','conditionGroup',
  'phase','log','ai','pro','research','seed','run',
  'planSeq','planDay','planSlot','planMode','planSlots','planIndex',
  'cdnext','zone','cat','game','gameId','theme','room'
];

const STORAGE = {
  recentRoomPrefix: 'GJ_RECENT_ROOM:',
  lastModePrefix: 'GJ_LAST_MODE:',
  lastRunUrlPrefix: 'GJ_LAST_RUN_URL:'
};

function qs(k, d=''){
  try { return new URL(location.href).searchParams.get(k) ?? d; }
  catch (_) { return d; }
}

function clean(v, d=''){
  const s = String(v ?? '').trim();
  return s || d;
}

function buildUrl(path, params = {}, base = location.href){
  const u = new URL(path, base);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      u.searchParams.set(k, String(v));
    }
  });
  return u.toString();
}

function generateRoomCode(prefix = 'GJ'){
  const part = Math.random().toString(36).slice(2, 6).toUpperCase();
  const tail = String(Date.now()).slice(-4);
  return `${prefix}-${part}${tail}`;
}

function saveRecentRoom(mode, room){
  try{
    localStorage.setItem(`${STORAGE.recentRoomPrefix}${mode}`, String(room || ''));
  }catch(_){}
}

function loadRecentRoom(mode){
  try{
    return localStorage.getItem(`${STORAGE.recentRoomPrefix}${mode}`) || '';
  }catch(_){
    return '';
  }
}

function saveLastMode(pid, mode, href){
  try{
    localStorage.setItem(`${STORAGE.lastModePrefix}${pid}`, String(mode || ''));
    localStorage.setItem(`${STORAGE.lastRunUrlPrefix}${pid}`, String(href || ''));
  }catch(_){}
}

function launcherUrl(baseParams, launcherPath){
  return buildUrl(launcherPath || '../goodjunk-launcher.html', {
    pid: baseParams.pid,
    name: baseParams.name,
    diff: baseParams.diff,
    time: baseParams.time,
    hub: baseParams.hub,
    view: baseParams.view,
    run: baseParams.run,
    seed: baseParams.seed,
    zone: baseParams.zone,
    cat: baseParams.cat,
    game: baseParams.game,
    gameId: baseParams.gameId,
    theme: baseParams.theme,
    recommendedMode: baseParams.recommendedMode || ''
  });
}

function readBaseParams(config = {}){
  const out = {};
  PASS_KEYS.forEach((k) => {
    const v = qs(k, '');
    if (v !== '') out[k] = v;
  });

  out.pid = clean(out.pid, 'anon');
  out.name = clean(out.name || out.nick, 'Hero');
  out.nick = clean(out.nick || out.name, out.name);
  out.diff = clean(out.diff, 'normal');
  out.time = clean(out.time, '90');
  out.view = clean(out.view, 'mobile');
  out.hub = clean(out.hub, '../hub-v2.html');
  out.run = clean(out.run, 'play');
  out.seed = clean(out.seed, String(Date.now()));
  out.zone = clean(out.zone, 'nutrition');
  out.cat = clean(out.cat, 'nutrition');
  out.game = clean(out.game, 'goodjunk');
  out.gameId = clean(out.gameId, 'goodjunk');
  out.theme = clean(out.theme, 'goodjunk');

  if (config.mode) out.mode = config.mode;
  return out;
}

function ensureStyle(){
  if (document.getElementById('gjModeLobbyStyle')) return;

  const style = document.createElement('style');
  style.id = 'gjModeLobbyStyle';
  style.textContent = `
    :root{
      --bg1:#071226;
      --bg2:#10234a;
      --bg3:#1d4ed8;
      --panel:rgba(2,6,23,.68);
      --panel2:rgba(15,23,42,.56);
      --line:rgba(255,255,255,.14);
      --text:#f8fafc;
      --muted:#dbeafe;
      --shadow:0 18px 50px rgba(0,0,0,.28);
      --good:#22c55e;
      --duet:#14b8a6;
      --race:#38bdf8;
      --battle:#f59e0b;
      --coop:#a78bfa;
    }

    *{box-sizing:border-box}
    html,body{
      margin:0;
      min-height:100%;
      color:var(--text);
      background:
        radial-gradient(900px 600px at 10% 10%, rgba(56,189,248,.18), transparent 60%),
        radial-gradient(900px 700px at 90% 0%, rgba(167,139,250,.16), transparent 58%),
        linear-gradient(180deg,var(--bg1),var(--bg2) 52%,var(--bg3));
      font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Thai",sans-serif;
    }

    .gjl-wrap{
      max-width:980px;
      margin:0 auto;
      padding:16px;
    }

    .gjl-panel{
      border:1px solid var(--line);
      background:var(--panel);
      backdrop-filter:blur(12px);
      border-radius:28px;
      box-shadow:var(--shadow);
      overflow:hidden;
    }

    .gjl-hero{
      padding:22px 18px;
      text-align:center;
      background:
        linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.04)),
        var(--panel);
    }

    .gjl-badge{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-height:36px;
      padding:8px 14px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(255,255,255,.06);
      font-size:12px;
      font-weight:1000;
      color:#e0f2fe;
    }

    .gjl-icon{
      width:104px;
      height:104px;
      margin:14px auto 0;
      border-radius:28px;
      display:grid;
      place-items:center;
      font-size:52px;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(255,255,255,.08);
      box-shadow:0 14px 30px rgba(0,0,0,.18);
    }

    .gjl-title{
      margin:14px 0 0;
      font-size:clamp(30px,5vw,48px);
      line-height:1.04;
      font-weight:1000;
    }

    .gjl-sub{
      margin-top:10px;
      color:var(--muted);
      font-size:15px;
      line-height:1.65;
      font-weight:900;
    }

    .gjl-grid{
      display:grid;
      grid-template-columns:1.15fr .85fr;
      gap:14px;
      margin-top:14px;
    }

    .gjl-card{
      border:1px solid rgba(255,255,255,.12);
      background:var(--panel2);
      border-radius:24px;
      padding:16px;
      box-shadow:var(--shadow);
    }

    .gjl-card h2{
      margin:0 0 8px;
      font-size:22px;
      line-height:1.08;
    }

    .gjl-muted{
      color:var(--muted);
      font-size:13px;
      line-height:1.55;
      font-weight:900;
    }

    .gjl-status{
      display:grid;
      gap:10px;
      margin-top:14px;
    }

    .gjl-status-item{
      border-radius:18px;
      border:1px solid rgba(255,255,255,.12);
      background:rgba(255,255,255,.06);
      padding:12px;
    }

    .gjl-status-k{
      font-size:12px;
      color:var(--muted);
      font-weight:1000;
    }

    .gjl-status-v{
      margin-top:6px;
      font-size:18px;
      font-weight:1000;
      line-height:1.15;
    }

    .gjl-form{
      display:grid;
      gap:12px;
      margin-top:14px;
    }

    .gjl-field{
      display:flex;
      flex-direction:column;
      gap:8px;
    }

    .gjl-field label{
      font-size:13px;
      color:var(--muted);
      font-weight:1000;
    }

    .gjl-field input,
    .gjl-field select{
      min-height:48px;
      border-radius:16px;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(2,6,23,.72);
      color:var(--text);
      padding:10px 12px;
      outline:none;
    }

    .gjl-field input:focus,
    .gjl-field select:focus,
    .gjl-btn:focus-visible{
      outline:3px solid rgba(250,204,21,.42);
      outline-offset:2px;
    }

    .gjl-room-row{
      display:grid;
      grid-template-columns:1fr auto auto;
      gap:10px;
      align-items:end;
    }

    .gjl-actions{
      display:grid;
      gap:10px;
      margin-top:16px;
    }

    .gjl-btn{
      min-height:54px;
      border-radius:18px;
      border:1px solid rgba(255,255,255,.16);
      color:#fff;
      font-size:16px;
      font-weight:1000;
      cursor:pointer;
      padding:12px 16px;
      box-shadow:0 10px 24px rgba(0,0,0,.18);
      transition:transform .12s ease, filter .12s ease;
      background:rgba(255,255,255,.06);
    }

    .gjl-btn:hover{
      transform:translateY(-1px);
      filter:brightness(1.05);
    }

    .gjl-btn.host.good{ background:linear-gradient(180deg, rgba(34,197,94,.24), rgba(34,197,94,.14)); border-color:rgba(34,197,94,.34); }
    .gjl-btn.host.duet{ background:linear-gradient(180deg, rgba(20,184,166,.24), rgba(20,184,166,.14)); border-color:rgba(20,184,166,.34); }
    .gjl-btn.host.race{ background:linear-gradient(180deg, rgba(56,189,248,.24), rgba(56,189,248,.14)); border-color:rgba(56,189,248,.34); }
    .gjl-btn.host.battle{ background:linear-gradient(180deg, rgba(245,158,11,.24), rgba(245,158,11,.14)); border-color:rgba(245,158,11,.34); }
    .gjl-btn.host.coop{ background:linear-gradient(180deg, rgba(167,139,250,.24), rgba(167,139,250,.14)); border-color:rgba(167,139,250,.34); }

    .gjl-inline{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
    }

    .gjl-inline .gjl-btn{
      flex:1 1 0;
      min-width:150px;
    }

    .gjl-tips{
      margin-top:14px;
      display:grid;
      gap:10px;
    }

    .gjl-tip{
      border-radius:18px;
      border:1px solid rgba(255,255,255,.12);
      background:rgba(255,255,255,.06);
      padding:12px 14px;
      color:#e0f2fe;
      font-size:13px;
      line-height:1.55;
      font-weight:900;
    }

    @media (max-width: 860px){
      .gjl-grid{
        grid-template-columns:1fr;
      }
      .gjl-room-row{
        grid-template-columns:1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

function copyText(text){
  return navigator.clipboard?.writeText(text).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  });
}

export function mountGoodJunkModeLobby(config = {}){
  ensureStyle();

  const mode = clean(config.mode, 'race').toLowerCase();
  const title = clean(config.title, `GoodJunk • ${mode} Lobby`);
  const subtitle = clean(config.subtitle, 'เข้า lobby ของโหมดนี้โดยตรง');
  const emoji = clean(config.emoji, '🎮');
  const playPath = clean(config.playPath, './goodjunk-vr.html');
  const launcherPath = clean(config.launcherPath, '../goodjunk-launcher.html');

  const app = document.getElementById('app') || document.body;
  const base = readBaseParams({ mode });

  app.innerHTML = `
    <div class="gjl-wrap">
      <section class="gjl-panel gjl-hero">
        <div class="gjl-badge">HeroHealth • GoodJunk • ${mode.toUpperCase()} LOBBY</div>
        <div class="gjl-icon">${emoji}</div>
        <h1 class="gjl-title">${title}</h1>
        <div class="gjl-sub">${subtitle}</div>
      </section>

      <section class="gjl-grid">
        <div class="gjl-card">
          <h2>ตั้งค่าก่อนเข้าเล่น</h2>
          <div class="gjl-muted">หน้านี้เป็น lobby ของโหมด ${mode} โดยตรง ไม่ย้อนกลับไป solo</div>

          <div class="gjl-form">
            <div class="gjl-field">
              <label for="gjlName">ชื่อเล่น</label>
              <input id="gjlName" type="text" />
            </div>

            <div class="gjl-field">
              <label for="gjlPid">PID</label>
              <input id="gjlPid" type="text" />
            </div>

            <div class="gjl-room-row">
              <div class="gjl-field">
                <label for="gjlRoom">Room Code</label>
                <input id="gjlRoom" type="text" />
              </div>
              <button id="gjlGenRoom" class="gjl-btn" type="button">สุ่มห้อง</button>
              <button id="gjlCopyRoom" class="gjl-btn" type="button">คัดลอก</button>
            </div>

            <div class="gjl-inline">
              <div class="gjl-field" style="flex:1 1 0;">
                <label for="gjlDiff">ความยาก</label>
                <select id="gjlDiff">
                  <option value="easy">easy</option>
                  <option value="normal">normal</option>
                  <option value="hard">hard</option>
                </select>
              </div>

              <div class="gjl-field" style="flex:1 1 0;">
                <label for="gjlTime">เวลา</label>
                <select id="gjlTime">
                  <option value="60">60s</option>
                  <option value="90">90s</option>
                  <option value="120">120s</option>
                </select>
              </div>

              <div class="gjl-field" style="flex:1 1 0;">
                <label for="gjlView">มุมมอง</label>
                <select id="gjlView">
                  <option value="mobile">mobile</option>
                  <option value="desktop">desktop</option>
                  <option value="cvr">cvr</option>
                </select>
              </div>
            </div>
          </div>

          <div class="gjl-actions">
            <button id="gjlHostBtn" class="gjl-btn host ${mode}" type="button">สร้างห้องและเข้าเล่น</button>
            <button id="gjlJoinBtn" class="gjl-btn" type="button">เข้าห้องนี้</button>
            <div class="gjl-inline">
              <button id="gjlLauncherBtn" class="gjl-btn" type="button">กลับ Launcher</button>
              <button id="gjlHubBtn" class="gjl-btn" type="button">กลับ Hub</button>
            </div>
          </div>
        </div>

        <div class="gjl-card">
          <h2>สถานะตอนนี้</h2>
          <div class="gjl-status">
            <div class="gjl-status-item">
              <div class="gjl-status-k">โหมด</div>
              <div id="gjlModeText" class="gjl-status-v">${mode.toUpperCase()}</div>
            </div>
            <div class="gjl-status-item">
              <div class="gjl-status-k">Room ปัจจุบัน</div>
              <div id="gjlRoomText" class="gjl-status-v">—</div>
            </div>
            <div class="gjl-status-item">
              <div class="gjl-status-k">ปลายทาง</div>
              <div id="gjlPlayText" class="gjl-status-v">${playPath}</div>
            </div>
          </div>

          <div class="gjl-tips">
            <div class="gjl-tip">ถ้ากด “สร้างห้องและเข้าเล่น” ระบบจะสร้าง room code แล้วเข้า play page ของโหมด ${mode} ทันที</div>
            <div class="gjl-tip">ถ้ากด “เข้าห้องนี้” ระบบจะใช้ room code ที่กรอกอยู่และเข้า play page เดิมของโหมด ${mode}</div>
            <div class="gjl-tip">ทุก query สำคัญ เช่น pid, diff, time, hub, view, seed, studyId จะถูก passthrough ไปครบ</div>
          </div>
        </div>
      </section>
    </div>
  `;

  const nameEl = document.getElementById('gjlName');
  const pidEl = document.getElementById('gjlPid');
  const roomEl = document.getElementById('gjlRoom');
  const diffEl = document.getElementById('gjlDiff');
  const timeEl = document.getElementById('gjlTime');
  const viewEl = document.getElementById('gjlView');

  const roomTextEl = document.getElementById('gjlRoomText');

  nameEl.value = clean(base.name, 'Hero');
  pidEl.value = clean(base.pid, 'anon');
  diffEl.value = clean(base.diff, 'normal');
  timeEl.value = clean(base.time, '90');
  viewEl.value = clean(base.view, 'mobile');

  roomEl.value = clean(base.room, loadRecentRoom(mode) || generateRoomCode(`GJ-${mode.slice(0,2).toUpperCase()}`));

  function syncStatus(){
    roomTextEl.textContent = clean(roomEl.value, '—');
  }

  function currentParams(){
    const p = { ...base };
    p.name = clean(nameEl.value, 'Hero');
    p.nick = p.name;
    p.pid = clean(pidEl.value, 'anon');
    p.room = clean(roomEl.value, generateRoomCode(`GJ-${mode.slice(0,2).toUpperCase()}`));
    p.diff = clean(diffEl.value, 'normal');
    p.time = clean(timeEl.value, '90');
    p.view = clean(viewEl.value, 'mobile');
    p.mode = mode;
    return p;
  }

  function playHref(role){
    const p = currentParams();
    const href = buildUrl(playPath, {
      ...p,
      role: clean(role, 'host'),
      lobby: '1'
    });
    saveRecentRoom(mode, p.room);
    saveLastMode(p.pid, mode, href);
    return href;
  }

  document.getElementById('gjlGenRoom').addEventListener('click', () => {
    roomEl.value = generateRoomCode(`GJ-${mode.slice(0,2).toUpperCase()}`);
    syncStatus();
  });

  document.getElementById('gjlCopyRoom').addEventListener('click', async () => {
    const room = clean(roomEl.value, '');
    if (!room) return;
    await copyText(room);
    const btn = document.getElementById('gjlCopyRoom');
    const old = btn.textContent;
    btn.textContent = 'คัดลอกแล้ว';
    setTimeout(() => btn.textContent = old, 1200);
  });

  document.getElementById('gjlHostBtn').addEventListener('click', () => {
    location.href = playHref('host');
  });

  document.getElementById('gjlJoinBtn').addEventListener('click', () => {
    location.href = playHref('join');
  });

  document.getElementById('gjlLauncherBtn').addEventListener('click', () => {
    location.href = launcherUrl(currentParams(), launcherPath);
  });

  document.getElementById('gjlHubBtn').addEventListener('click', () => {
    location.href = clean(currentParams().hub, '../hub-v2.html');
  });

  [nameEl, pidEl, roomEl, diffEl, timeEl, viewEl].forEach(el => {
    el.addEventListener('input', syncStatus);
    el.addEventListener('change', syncStatus);
  });

  syncStatus();
}