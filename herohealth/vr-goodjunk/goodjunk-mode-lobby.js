// === /herohealth/vr-goodjunk/goodjunk-mode-lobby.js ===
// FULL PATCH v20260501-GJ-MODE-LOBBY-SAME-ROOM-REMATCH
// ✅ Quick Kids Lobby
// ✅ Hide technical fields for kids
// ✅ Battle 1v1 room create/join support
// ✅ Auto-start Battle when 2 players are in room
// ✅ Firebase shared adapter via goodjunk-battle-room-bootstrap.js
// ✅ Stable anon pid per device/scope
// ✅ Invite link no longer leaks host pid/name
// ✅ Copy room + copy invite link
// ✅ Same Room Rematch: rematch=1 / sameRoom=1 resets ended room safely
// ✅ Still passthrough important query params

import {
  makeRoomAdapter as makeBattleRoomAdapter
} from './goodjunk-battle-room.js?v=20260501-GJ-BATTLE-PRODUCTION-FINAL';

const PASS_KEYS = [
  'pid','name','nick','diff','time','view','hub',
  'sbUrl','sbAnon','studyId','conditionGroup',
  'phase','log','ai','pro','research','seed','run',
  'planSeq','planDay','planSlot','planMode','planSlots','planIndex',
  'cdnext','zone','cat','game','gameId','theme','room','roomId',
  'entry','recommendedMode','multiplayer','role','autojoin','fromInvite',
  'rematch','sameRoom','modeLocked'
];

const STORAGE = {
  recentRoomPrefix: 'GJ_RECENT_ROOM:',
  lastModePrefix: 'GJ_LAST_MODE:',
  lastRunUrlPrefix: 'GJ_LAST_RUN_URL:',
  stablePid: 'GJ_STABLE_PLAYER_ID'
};

function qs(k, d = '') {
  try {
    return new URL(location.href).searchParams.get(k) ?? d;
  } catch (_) {
    return d;
  }
}

function clean(v, d = '') {
  const s = String(v ?? '').trim();
  return s || d;
}

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function storageGet(key, fallback = '') {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : v;
  } catch (_) {
    return fallback;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch (_) {}
}

function getStableAnonPid(scope = 'player') {
  const key = scope === 'player'
    ? STORAGE.stablePid
    : `${STORAGE.stablePid}:${scope}`;

  let pid = storageGet(key, '');
  if (pid) return pid;

  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  pid = `anon-${rand}-${String(Date.now()).slice(-4)}`;
  storageSet(key, pid);
  return pid;
}

function normalizePid(v) {
  const pid = clean(v, 'anon');
  if (!pid || pid === 'anon') return getStableAnonPid('player');
  return pid;
}

function normalizeRoomCode(v, prefix = 'GJ-BT') {
  let s = String(v ?? '').trim().toUpperCase();
  s = s.replace(/\s+/g, '');
  s = s.replace(/[^A-Z0-9-]/g, '');

  if (!s) return '';

  if (!s.startsWith(prefix)) {
    s = `${prefix}-${s.replace(/^GJ/i, '').replace(/^BT/i, '').replace(/^-+/, '')}`;
  }

  return s.slice(0, 18);
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

function generateRoomCode(prefix = 'GJ') {
  const part = Math.random().toString(36).slice(2, 6).toUpperCase();
  const tail = String(Date.now()).slice(-4);
  return `${prefix}-${part}${tail}`;
}

function saveRecentRoom(mode, room) {
  try {
    localStorage.setItem(`${STORAGE.recentRoomPrefix}${mode}`, String(room || ''));
  } catch (_) {}
}

function loadRecentRoom(mode) {
  try {
    return localStorage.getItem(`${STORAGE.recentRoomPrefix}${mode}`) || '';
  } catch (_) {
    return '';
  }
}

function saveLastMode(pid, mode, href) {
  try {
    localStorage.setItem(`${STORAGE.lastModePrefix}${pid}`, String(mode || ''));
    localStorage.setItem(`${STORAGE.lastRunUrlPrefix}${pid}`, String(href || ''));
  } catch (_) {}
}

function launcherUrl(baseParams, launcherPath) {
  return buildUrl(launcherPath || '../goodjunk-launcher.html', {
    pid: baseParams.pid,
    name: baseParams.name,
    nick: baseParams.nick,
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
    recommendedMode: baseParams.recommendedMode || baseParams.mode || ''
  });
}

function readBaseParams(config = {}) {
  const out = {};

  const isInviteGuest =
    qs('fromInvite', '') === '1' ||
    qs('autojoin', '') === '1' ||
    qs('role', '') === 'join';

  PASS_KEYS.forEach((k) => {
    const v = qs(k, '');
    if (v !== '') out[k] = v;
  });

  const roomScope = clean(qs('room', qs('roomId', '')), 'battle-guest');

  out.pid = isInviteGuest
    ? getStableAnonPid(`guest:${roomScope}`)
    : normalizePid(out.pid);

  out.name = clean(out.name || out.nick, isInviteGuest ? 'Player 2' : 'Hero');
  out.nick = clean(out.nick || out.name, out.name);
  out.diff = clean(out.diff, 'normal');
  out.time = clean(out.time, '150');
  out.view = clean(out.view, 'mobile');
  out.hub = clean(out.hub, '../hub-v2.html');
  out.run = clean(out.run, 'play');
  out.seed = clean(out.seed, String(Date.now()));
  out.zone = clean(out.zone, 'nutrition');
  out.cat = clean(out.cat, 'nutrition');
  out.game = clean(out.game, 'goodjunk');
  out.gameId = clean(out.gameId, 'goodjunk');
  out.theme = clean(out.theme, 'goodjunk');
  out.entry = clean(out.entry, config.mode || 'battle');
  out.recommendedMode = clean(out.recommendedMode, config.mode || 'battle');
  out.multiplayer = clean(out.multiplayer, '1');

  const roomFromUrl = clean(out.room || out.roomId, '');
  if (roomFromUrl) {
    out.room = normalizeRoomCode(roomFromUrl, config.roomPrefix || 'GJ-BT');
    out.roomId = out.room;
  }

  if (config.mode) out.mode = config.mode;
  return out;
}

function ensureStyle() {
  if (document.getElementById('gjModeLobbyStyle')) return;

  const style = document.createElement('style');
  style.id = 'gjModeLobbyStyle';
  style.textContent = `
    :root{
      --bg1:#fff7ed;
      --bg2:#ffedd5;
      --bg3:#fed7aa;
      --panel:#ffffff;
      --line:#ffd7a8;
      --text:#3b2415;
      --muted:#7c4a22;
      --shadow:0 18px 44px rgba(154,75,20,.18);
      --battle:#f97316;
      --gold:#facc15;
      --sat: env(safe-area-inset-top, 0px);
      --sab: env(safe-area-inset-bottom, 0px);
      --sal: env(safe-area-inset-left, 0px);
      --sar: env(safe-area-inset-right, 0px);
    }

    *{ box-sizing:border-box; }

    html,body{
      margin:0;
      min-height:100%;
      color:var(--text);
      background:
        radial-gradient(900px 580px at 10% 0%, rgba(255,186,73,.42), transparent 58%),
        radial-gradient(840px 560px at 95% 12%, rgba(255,111,97,.20), transparent 58%),
        linear-gradient(180deg,var(--bg1),var(--bg2) 48%,var(--bg3));
      font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Thai",sans-serif;
    }

    body{ min-height:100dvh; }
    button,input,select{ font:inherit; }

    .gjl-wrap{
      width:min(100%,1060px);
      margin:0 auto;
      min-height:100dvh;
      padding:
        calc(14px + var(--sat))
        calc(14px + var(--sar))
        calc(14px + var(--sab))
        calc(14px + var(--sal));
      display:grid;
      align-content:center;
      gap:14px;
    }

    .gjl-panel{
      border:3px solid var(--line);
      background:rgba(255,255,255,.86);
      border-radius:30px;
      box-shadow:var(--shadow);
      overflow:hidden;
    }

    .gjl-hero{
      padding:22px 18px;
      text-align:center;
      background:
        radial-gradient(circle at 50% 0%, rgba(255,236,179,.88), transparent 45%),
        linear-gradient(180deg,#fffdf7,#fff7ed);
    }

    .gjl-badge{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-height:34px;
      padding:8px 14px;
      border-radius:999px;
      border:2px solid #ffd59b;
      background:#fff8e7;
      font-size:12px;
      font-weight:1000;
      color:#9a4a0f;
      box-shadow:0 8px 18px rgba(249,115,22,.10);
    }

    .gjl-icon{
      width:108px;
      height:108px;
      margin:14px auto 0;
      border-radius:32px;
      display:grid;
      place-items:center;
      font-size:54px;
      border:3px solid #ffc46b;
      background:
        radial-gradient(circle at 30% 30%, rgba(255,255,255,.92), transparent 35%),
        linear-gradient(135deg,#fff3c4,#ffb65c);
      box-shadow:0 14px 28px rgba(249,115,22,.22);
    }

    .gjl-title{
      margin:14px 0 0;
      font-size:clamp(34px,6vw,56px);
      line-height:1.02;
      font-weight:1000;
      color:#5a2b10;
      letter-spacing:-.03em;
    }

    .gjl-sub{
      width:min(760px,100%);
      margin:10px auto 0;
      color:var(--muted);
      font-size:16px;
      line-height:1.65;
      font-weight:900;
    }

    .gjl-grid{
      display:grid;
      grid-template-columns:1.08fr .92fr;
      gap:14px;
    }

    .gjl-card{
      border:3px solid var(--line);
      background:rgba(255,255,255,.88);
      border-radius:28px;
      padding:16px;
      box-shadow:var(--shadow);
    }

    .gjl-card h2{
      margin:0 0 8px;
      font-size:24px;
      line-height:1.08;
      color:#5a2b10;
      letter-spacing:-.02em;
    }

    .gjl-muted{
      color:var(--muted);
      font-size:14px;
      line-height:1.55;
      font-weight:900;
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
      color:#8a4d18;
      font-weight:1000;
    }

    .gjl-field input,
    .gjl-field select{
      width:100%;
      min-height:54px;
      border-radius:18px;
      border:3px solid #ffd7a8;
      background:#fffdfa;
      color:#3b2415;
      padding:10px 14px;
      outline:none;
      font-size:17px;
      font-weight:1000;
      box-shadow:0 8px 18px rgba(154,75,20,.08);
    }

    .gjl-field input:focus,
    .gjl-field select:focus,
    .gjl-btn:focus-visible{
      outline:4px solid rgba(250,204,21,.45);
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
      min-height:56px;
      border-radius:20px;
      border:3px solid #ffd7a8;
      color:#4b260d;
      font-size:16px;
      font-weight:1000;
      cursor:pointer;
      padding:12px 16px;
      box-shadow:0 10px 22px rgba(154,75,20,.14);
      transition:transform .12s ease, filter .12s ease;
      background:#fffaf0;
    }

    .gjl-btn:hover{
      transform:translateY(-1px);
      filter:brightness(1.03);
    }

    .gjl-btn:active{
      transform:translateY(1px) scale(.99);
    }

    .gjl-btn.host.battle{
      min-height:68px;
      font-size:19px;
      color:#fff7ed;
      background:linear-gradient(180deg,#fb923c,#ea580c);
      border-color:#fdba74;
      box-shadow:0 14px 28px rgba(234,88,12,.28);
    }

    .gjl-btn.join-main{
      min-height:64px;
      font-size:18px;
      color:#3b2415;
      background:linear-gradient(180deg,#fef3c7,#fde68a);
      border-color:#facc15;
    }

    .gjl-inline{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
    }

    .gjl-inline .gjl-btn{
      flex:1 1 0;
      min-width:150px;
    }

    .gjl-room-big{
      margin-top:12px;
      border-radius:24px;
      border:3px solid #facc15;
      background:linear-gradient(180deg,#fffbeb,#fef3c7);
      padding:14px;
      text-align:center;
      box-shadow:0 10px 20px rgba(250,204,21,.18);
    }

    .gjl-room-big-k{
      font-size:13px;
      font-weight:1000;
      color:#92400e;
    }

    .gjl-room-big-v{
      margin-top:6px;
      font-size:clamp(24px,5vw,38px);
      font-weight:1000;
      color:#78350f;
      letter-spacing:.02em;
      word-break:break-word;
    }

    .gjl-tips{
      margin-top:14px;
      display:grid;
      gap:10px;
    }

    .gjl-tip{
      border-radius:20px;
      border:3px solid #ffe0b6;
      background:#fffaf0;
      padding:13px 14px;
      color:#5a2b10;
      font-size:15px;
      line-height:1.48;
      font-weight:1000;
    }

    .gjl-mini-note{
      margin-top:12px;
      border-radius:20px;
      border:3px dashed #fdba74;
      background:#fff7ed;
      color:#7c2d12;
      padding:12px 14px;
      font-size:13px;
      line-height:1.55;
      font-weight:900;
    }

    .gjl-toast{
      position:fixed;
      left:50%;
      bottom:calc(18px + var(--sab));
      transform:translateX(-50%);
      z-index:99;
      max-width:min(92vw,520px);
      border-radius:999px;
      border:3px solid #fdba74;
      background:#fff7ed;
      color:#7c2d12;
      padding:12px 16px;
      font-size:14px;
      font-weight:1000;
      box-shadow:0 14px 30px rgba(154,75,20,.18);
      opacity:0;
      pointer-events:none;
      transition:opacity .15s ease, transform .15s ease;
    }

    .gjl-toast.show{
      opacity:1;
      transform:translateX(-50%) translateY(-4px);
    }

    .gjl-advanced{
      display:grid;
      gap:12px;
    }

    @media (max-width: 860px){
      .gjl-wrap{ align-content:start; }
      .gjl-grid{ grid-template-columns:1fr; }
      .gjl-room-row{ grid-template-columns:1fr; }
      .gjl-icon{
        width:94px;
        height:94px;
        font-size:46px;
      }
    }

    @media (max-width: 520px){
      .gjl-card{ padding:14px; }
      .gjl-title{ font-size:36px; }
      .gjl-sub{ font-size:14px; }
      .gjl-inline{ flex-direction:column; }
      .gjl-inline .gjl-btn{ width:100%; }
    }

    @media (prefers-reduced-motion: reduce){
      *,*::before,*::after{
        animation:none !important;
        transition:none !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function copyText(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  }
  return fallbackCopy(text);
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  ta.style.top = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();

  try {
    document.execCommand('copy');
  } catch (_) {}

  ta.remove();
  return Promise.resolve();
}

function makeToast() {
  let toast = document.getElementById('gjlToast');
  if (toast) return toast;

  toast = document.createElement('div');
  toast.id = 'gjlToast';
  toast.className = 'gjl-toast';
  toast.textContent = '';
  document.body.appendChild(toast);
  return toast;
}

function showToast(message) {
  const toast = makeToast();
  toast.textContent = message;
  toast.classList.add('show');

  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.classList.remove('show');
  }, 1400);
}

function setSelectValue(el, value, fallback) {
  if (!el) return;
  const v = clean(value, fallback);
  const has = Array.from(el.options || []).some(o => o.value === v);
  el.value = has ? v : fallback;
}

function makeFreshBattlePlayer(params, prev = {}, role = 'player') {
  const diff = params.diff || prev.diff || 'normal';
  const maxHp =
    diff === 'challenge' ? 3 :
    diff === 'hard' ? 4 :
    5;

  const maxHeals =
    diff === 'easy' ? 3 :
    diff === 'normal' ? 2 :
    1;

  const now = Date.now();

  return {
    ...(prev || {}),
    pid: params.pid,
    name: params.name,
    nick: params.nick || params.name,
    role: prev.role || role,
    diff,
    joinedAt: Number(prev.joinedAt || 0) || now,
    ready: true,

    score: 0,
    combo: 0,
    hp: maxHp,
    maxHp,
    shield: 0,
    attackMeter: 0,

    heartsRecovered: 0,
    maxHeals,
    lastHealAt: 0,

    goodHits: 0,
    junkHits: 0,
    attacksSent: 0,
    attacksBlocked: 0,
    attacksReceived: 0,
    lastAttackAt: 0,

    online: true,
    updatedAt: now,
    lastSeenAt: now
  };
}

async function prepareBattleRoom(params, role, config = {}) {
  if (params.mode !== 'battle') return true;

  const autoStartBattle = config.autoStartBattle !== false;
  const adapter = makeBattleRoomAdapter();
  const roomId = clean(params.room, '');

  if (!roomId) {
    showToast('ยังไม่มี Room Code');
    return false;
  }

  let room = null;

  try {
    room = await adapter.loadRoom(roomId);
  } catch (_) {
    room = null;
  }

  const isRematch =
    qs('rematch', '') === '1' ||
    qs('sameRoom', '') === '1';

  if (isRematch && room && room.status === 'ended') {
    room = {
      ...room,
      status: 'waiting',
      startedAt: 0,
      endedAt: 0,
      matchEnd: null,
      attacks: [],
      effects: [],
      lastAttackAt: 0,
      players: {}
    };
  }

  const now = Date.now();
  const players = room?.players && typeof room.players === 'object'
    ? { ...room.players }
    : {};

  const currentCount = Object.keys(players).filter((k) => players[k]?.online !== false).length;
  const alreadyInRoom = !!players[params.pid];

  if (!alreadyInRoom && currentCount >= 2) {
    showToast('ห้อง Battle เต็มแล้ว ต้องมีแค่ 2 คน');
    return false;
  }

  const hasHost = Object.values(players).some(p => p && p.role === 'host');
  const finalRole = role === 'host' || !hasHost ? 'host' : 'player';

  players[params.pid] = makeFreshBattlePlayer(
    params,
    players[params.pid] || {},
    finalRole
  );

  const nextCount = Object.keys(players).filter((k) => players[k]?.online !== false).length;

  const hostPid =
    clean(room?.hostPid, '') ||
    Object.values(players).find(p => p && p.role === 'host')?.pid ||
    params.pid;

  const shouldStart = autoStartBattle && nextCount >= 2;

  const payload = {
    roomId,
    mode: 'battle',
    status: shouldStart ? 'started' : 'waiting',
    hostPid,
    createdAt: Number(room?.createdAt || 0) || now,
    updatedAt: now,
    startedAt: shouldStart ? now : 0,
    endedAt: 0,
    players,
    attacks: [],
    effects: [],
    lastAttackAt: 0,
    matchEnd: null
  };

  try {
    await adapter.saveRoom(roomId, payload);
    saveRecentRoom('battle', roomId);
    return true;
  } catch (err) {
    console.warn('[GoodJunk Lobby] prepareBattleRoom failed', err);
    showToast('บันทึกห้อง Battle ไม่สำเร็จ');
    return false;
  }
}

export function mountGoodJunkModeLobby(config = {}) {
  ensureStyle();

  const mode = clean(config.mode, 'race').toLowerCase();
  const title = clean(config.title, `GoodJunk • ${mode} Lobby`);
  const subtitle = clean(config.subtitle, 'เข้า lobby ของโหมดนี้โดยตรง');
  const emoji = clean(config.emoji, '🎮');
  const playPath = clean(config.playPath, './goodjunk-vr.html');
  const launcherPath = clean(config.launcherPath, '../goodjunk-launcher.html');

  const quickKids = config.quickKids === true;
  const hideAdvanced = config.hideAdvanced === true;
  const roomPrefix = clean(config.roomPrefix, `GJ-${mode.slice(0, 2).toUpperCase()}`);
  const primaryText = clean(config.primaryText, 'สร้างห้องและเข้าเล่น');
  const joinText = clean(config.joinText, 'เข้าห้องนี้');
  const tips = Array.isArray(config.tips) ? config.tips : [];

  const app = document.getElementById('app') || document.body;
  const base = readBaseParams({ mode, roomPrefix });

  const defaultRoom =
    clean(base.room || base.roomId, '') ||
    loadRecentRoom(mode) ||
    generateRoomCode(roomPrefix);

  app.innerHTML = `
    <div class="gjl-wrap ${quickKids ? 'quick-kids' : ''}">
      <section class="gjl-panel gjl-hero">
        <div class="gjl-badge">HeroHealth • GoodJunk • ${esc(mode.toUpperCase())}</div>
        <div class="gjl-icon" aria-hidden="true">${esc(emoji)}</div>
        <h1 class="gjl-title">${esc(title)}</h1>
        <div class="gjl-sub">${esc(subtitle)}</div>
      </section>

      <section class="gjl-grid">
        <div class="gjl-card">
          <h2>${quickKids ? 'พร้อมดวลหรือยัง?' : 'ตั้งค่าก่อนเข้าเล่น'}</h2>
          <div class="gjl-muted">
            ${quickKids
              ? 'ใส่ชื่อเล่นกับรหัสห้อง แล้วเริ่ม Battle ได้เลย'
              : `หน้านี้เป็น lobby ของโหมด ${esc(mode)} โดยตรง ไม่ย้อนกลับไป solo`}
          </div>

          <div class="gjl-form">
            <div class="gjl-field">
              <label for="gjlName">ชื่อเล่น</label>
              <input id="gjlName" type="text" inputmode="text" autocomplete="nickname" />
            </div>

            ${hideAdvanced ? '' : `
              <div class="gjl-field">
                <label for="gjlPid">Player ID / PID</label>
                <input id="gjlPid" type="text" />
              </div>
            `}

            <div class="gjl-room-row">
              <div class="gjl-field">
                <label for="gjlRoom">Room Code</label>
                <input id="gjlRoom" type="text" inputmode="text" autocomplete="off" />
              </div>
              <button id="gjlGenRoom" class="gjl-btn" type="button">สุ่มห้อง</button>
              <button id="gjlCopyRoom" class="gjl-btn" type="button">คัดลอก</button>
            </div>

            ${hideAdvanced ? '' : `
              <div class="gjl-advanced">
                <div class="gjl-inline">
                  <div class="gjl-field" style="flex:1 1 0;">
                    <label for="gjlDiff">ความยาก</label>
                    <select id="gjlDiff">
                      <option value="easy">easy</option>
                      <option value="normal">normal</option>
                      <option value="hard">hard</option>
                      <option value="challenge">challenge</option>
                    </select>
                  </div>

                  <div class="gjl-field" style="flex:1 1 0;">
                    <label for="gjlTime">เวลา</label>
                    <select id="gjlTime">
                      <option value="60">60s</option>
                      <option value="90">90s</option>
                      <option value="120">120s</option>
                      <option value="150">150s</option>
                      <option value="180">180s</option>
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
            `}
          </div>

          <div class="gjl-actions">
            <button id="gjlHostBtn" class="gjl-btn host ${esc(mode)}" type="button">${esc(primaryText)}</button>
            <button id="gjlJoinBtn" class="gjl-btn join-main" type="button">${esc(joinText)}</button>

            <div class="gjl-inline">
              <button id="gjlCopyLinkBtn" class="gjl-btn" type="button">🔗 คัดลอกลิงก์ชวนเพื่อน</button>
              <button id="gjlLauncherBtn" class="gjl-btn" type="button">กลับเมนูเกม</button>
              <button id="gjlHubBtn" class="gjl-btn" type="button">กลับ Hub</button>
            </div>
          </div>
        </div>

        <div class="gjl-card">
          <h2>${quickKids ? 'วิธีเล่น Battle' : 'สถานะตอนนี้'}</h2>

          <div class="gjl-room-big">
            <div class="gjl-room-big-k">Room Code</div>
            <div id="gjlRoomText" class="gjl-room-big-v">—</div>
          </div>

          <div class="gjl-tips">
            ${
              tips.length
                ? tips.map(t => `<div class="gjl-tip">${esc(t)}</div>`).join('')
                : `
                  <div class="gjl-tip">✅ เก็บของดี</div>
                  <div class="gjl-tip">❌ เลี่ยง Junk</div>
                  <div class="gjl-tip">🏆 คะแนนสูงกว่าชนะ</div>
                `
            }
          </div>

          <div class="gjl-mini-note">
            Battle จะเริ่มเมื่อมีผู้เล่นครบ 2 คนในห้องเดียวกัน ระบบจะพาเข้าเกมอัตโนมัติ
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
  if (pidEl) pidEl.value = clean(base.pid, getStableAnonPid());
  roomEl.value = normalizeRoomCode(defaultRoom, roomPrefix);

  if (diffEl) setSelectValue(diffEl, base.diff, 'normal');
  if (timeEl) setSelectValue(timeEl, base.time, '150');
  if (viewEl) setSelectValue(viewEl, base.view, 'mobile');

  function syncStatus() {
    roomEl.value = normalizeRoomCode(roomEl.value, roomPrefix);
    roomTextEl.textContent = clean(roomEl.value, '—');
  }

  function currentParams() {
    const p = { ...base };

    p.name = clean(nameEl?.value, 'Hero');
    p.nick = p.name;

    const rawPid = pidEl ? pidEl.value : p.pid;
    p.pid = normalizePid(rawPid);

    p.room = normalizeRoomCode(roomEl?.value, roomPrefix) || generateRoomCode(roomPrefix);
    p.roomId = p.room;
    p.diff = clean(diffEl?.value, p.diff || 'normal');
    p.time = clean(timeEl?.value, p.time || '150');
    p.view = clean(viewEl?.value, p.view || 'mobile');

    p.mode = mode;
    p.entry = mode;
    p.recommendedMode = mode;
    p.multiplayer = mode === 'solo' ? '' : '1';

    return p;
  }

  function playHref(role) {
    const p = currentParams();

    const href = buildUrl(playPath, {
      ...p,
      role: clean(role, 'host'),
      lobby: '1',
      fromLobby: '1',
      modeLocked: '1'
    });

    saveRecentRoom(mode, p.room);
    saveLastMode(p.pid, mode, href);

    return href;
  }

  function inviteHref() {
    const p = currentParams();

    return buildUrl(location.pathname, {
      mode: p.mode,
      entry: p.entry,
      recommendedMode: p.recommendedMode,
      multiplayer: '1',

      room: p.room,
      roomId: p.room,

      diff: p.diff,
      time: p.time,
      view: p.view,
      hub: p.hub,
      run: p.run,
      seed: p.seed,
      zone: p.zone,
      cat: p.cat,
      game: p.game,
      gameId: p.gameId,
      theme: p.theme,

      role: 'join',
      autojoin: '1',
      fromInvite: '1',
      modeLocked: '1'
    }, location.origin + location.pathname);
  }

  async function goPlay(role) {
    const p = currentParams();
    p.role = clean(role, 'host');

    saveRecentRoom(mode, p.room);

    const ok = await prepareBattleRoom(p, role, config);
    if (!ok) return;

    location.href = playHref(role);
  }

  document.getElementById('gjlGenRoom').addEventListener('click', () => {
    roomEl.value = generateRoomCode(roomPrefix);
    syncStatus();
    showToast('สร้าง Room ใหม่แล้ว');
  });

  document.getElementById('gjlCopyRoom').addEventListener('click', async () => {
    const room = clean(roomEl.value, '');
    if (!room) return;

    await copyText(room);
    showToast('คัดลอก Room Code แล้ว');
  });

  document.getElementById('gjlCopyLinkBtn').addEventListener('click', async () => {
    await copyText(inviteHref());
    showToast('คัดลอกลิงก์ชวนเพื่อนแล้ว');
  });

  document.getElementById('gjlHostBtn').addEventListener('click', () => {
    goPlay('host');
  });

  document.getElementById('gjlJoinBtn').addEventListener('click', () => {
    goPlay('join');
  });

  document.getElementById('gjlLauncherBtn').addEventListener('click', () => {
    location.href = launcherUrl(currentParams(), launcherPath);
  });

  document.getElementById('gjlHubBtn').addEventListener('click', () => {
    location.href = clean(currentParams().hub, '../hub-v2.html');
  });

  [nameEl, pidEl, roomEl, diffEl, timeEl, viewEl].filter(Boolean).forEach(el => {
    el.addEventListener('input', syncStatus);
    el.addEventListener('change', syncStatus);
  });

  syncStatus();

  if (
    qs('autojoin', '') === '1' &&
    qs('room', qs('roomId', '')) &&
    mode === 'battle'
  ) {
    setTimeout(() => {
      goPlay('join');
    }, 450);
  }
}
