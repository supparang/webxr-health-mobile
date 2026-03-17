// === /herohealth/goodjunk-race-lobby.js ===
// FULL PATCH v20260317-GOODJUNK-RACE-LOBBY-CONSOLIDATED

const params = new URLSearchParams(location.search);

const ctx = {
  mode: params.get('mode') || 'race',
  pid: params.get('pid') || `p-${Math.random().toString(36).slice(2, 8)}`,
  name: params.get('name') || '',
  studyId: params.get('studyId') || '',
  diff: params.get('diff') || 'normal',
  time: params.get('time') || '120',
  seed: params.get('seed') || String(Date.now()),
  hub: params.get('hub') || '../hub.html',
  view: params.get('view') || 'mobile',
  run: params.get('run') || 'play',
  gameId: params.get('gameId') || 'goodjunk',
  roomId: normalizeRoomCode(params.get('roomId') || `GJ${Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(2, 8)}`)
};

const STORAGE_KEY = `GJ_RACE_ROOM_${ctx.roomId}`;
const CHANNEL_NAME = `gj-race-${ctx.roomId}`;
const channel = safeBroadcastChannel(CHANNEL_NAME);

const $ = (id) => document.getElementById(id);

const els = {
  roomCode: $('roomCode'),
  playerCount: $('playerCount'),
  roomStatus: $('roomStatus'),
  hostName: $('hostName'),
  inviteLink: $('inviteLink'),
  copyState: $('copyState'),
  joinGuard: $('joinGuard'),
  btnCopyRoom: $('btnCopyRoom'),
  btnCopyInvite: $('btnCopyInvite'),

  playersBox: $('playersBox'),
  countdown: $('countdown'),
  btnReady: $('btnReady'),
  btnStart: $('btnStart'),
  btnBack: $('btnBack'),
  hint: $('hint')
};

let room = null;
let countdownRAF = 0;
let countdownRunning = false;
let instanceId = `${ctx.pid}-${Math.random().toString(36).slice(2, 7)}`;
let __gjLobbyExitMode = 'stay'; // stay | leave | to-run

function normalizeRoomCode(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

function safeBroadcastChannel(name) {
  try {
    return ('BroadcastChannel' in window) ? new BroadcastChannel(name) : null;
  } catch {
    return null;
  }
}

function now() {
  return Date.now();
}

function clone(obj) {
  try {
    return structuredClone(obj);
  } catch {
    return JSON.parse(JSON.stringify(obj));
  }
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function playerLabel(p) {
  if (p?.name && String(p.name).trim()) return String(p.name).trim();
  if (p?.id) return String(p.id);
  return 'player';
}

function getMeName() {
  const trimmed = String(ctx.name || '').trim();
  return trimmed || ctx.pid;
}

function buildInviteUrl() {
  const q = new URLSearchParams({
    pid: 'anon',
    name: '',
    studyId: ctx.studyId,
    diff: ctx.diff,
    time: ctx.time,
    seed: String(Date.now()),
    hub: ctx.hub,
    view: ctx.view,
    run: ctx.run,
    gameId: ctx.gameId,
    mode: 'race',
    roomId: ctx.roomId
  });

  return `${location.origin}${location.pathname.replace('goodjunk-race-lobby.html', 'goodjunk-race-room.html')}?${q.toString()}`;
}

async function copyText(text) {
  const value = String(text || '').trim();
  if (!value) return false;

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.pointerEvents = 'none';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return !!ok;
    } catch {
      return false;
    }
  }
}

function setHint(text) {
  if (els.hint) els.hint.textContent = text || '';
}

function setCopyState(text, ok = true) {
  if (!els.copyState) return;
  els.copyState.textContent = text || '';
  els.copyState.style.color = ok ? 'var(--muted)' : '#fbbf24';
}

function showJoinGuard(msg = '') {
  if (!els.joinGuard) return;
  if (!msg) {
    els.joinGuard.style.display = 'none';
    els.joinGuard.textContent = '';
    return;
  }
  els.joinGuard.style.display = 'block';
  els.joinGuard.textContent = msg;
}

function getPhaseLabel(player) {
  if (!player) return 'ไม่ทราบสถานะ';
  if (player.phase === 'done') return 'แข่งจบแล้ว';
  if (player.phase === 'run') return 'กำลังเข้าเกม';
  return player.ready ? 'พร้อมแล้ว' : 'ยังไม่พร้อม';
}

function getPhaseClass(player) {
  if (!player) return 'waiting';
  if (player.phase === 'done') return 'ready';
  if (player.phase === 'run') return 'ready';
  return player.ready ? 'ready' : 'waiting';
}

function loadRoom() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function broadcast(payload) {
  if (!channel) return;
  try {
    channel.postMessage(payload);
  } catch {}
}

function persistRoom(next, source = 'local') {
  room = sanitizeRoom(next);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(room));
  broadcast({
    type: 'room:update',
    room,
    source,
    sender: instanceId,
    ts: now()
  });
  render();
}

function removeRoom() {
  localStorage.removeItem(STORAGE_KEY);
  room = null;
  broadcast({
    type: 'room:removed',
    roomId: ctx.roomId,
    sender: instanceId,
    ts: now()
  });
}

function makeDefaultRoom() {
  return {
    roomId: ctx.roomId,
    hostId: ctx.pid,
    mode: 'race',
    minPlayers: 2,
    maxPlayers: 4,
    status: 'waiting', // waiting | countdown | running | finished
    startAt: null,
    createdAt: now(),
    updatedAt: now(),
    players: []
  };
}

function sanitizeRoom(r) {
  const base = makeDefaultRoom();
  const safe = { ...base, ...(r || {}) };

  if (!Array.isArray(safe.players)) safe.players = [];

  safe.players = safe.players
    .filter(Boolean)
    .map((p) => ({
      id: String(p.id || '').trim(),
      name: String(p.name || '').trim(),
      ready: !!p.ready,
      joinedAt: Number(p.joinedAt || now()),
      lastSeenAt: Number(p.lastSeenAt || now()),
      finished: !!p.finished,
      finalScore: Number(p.finalScore || 0),
      miss: Number(p.miss || 0),
      streak: Number(p.streak || 0),
      phase: String(p.phase || 'lobby').trim(), // lobby | run | done
      connected: p.connected !== false
    }))
    .filter((p) => p.id);

  safe.minPlayers = Math.max(2, Number(safe.minPlayers || 2));
  safe.maxPlayers = Math.max(safe.minPlayers, Number(safe.maxPlayers || 4));

  if (!['waiting', 'countdown', 'running', 'finished'].includes(safe.status)) {
    safe.status = 'waiting';
  }

  safe.startAt = safe.startAt ? Number(safe.startAt) : null;
  safe.updatedAt = now();

  const hasHost = safe.players.some((p) => p.id === safe.hostId);
  if (!hasHost) {
    safe.hostId = safe.players[0]?.id || '';
  }

  return safe;
}

function ensureRoomExists() {
  const existing = loadRoom();
  if (existing) {
    room = sanitizeRoom(existing);
    persistRoom(room, 'ensure-existing');
    return;
  }
  room = sanitizeRoom(makeDefaultRoom());
  persistRoom(room, 'ensure-new');
}

function isExistingMember(r, pid = ctx.pid) {
  return !!r?.players?.some((p) => p.id === pid);
}

function getJoinBlockReason(r, pid = ctx.pid) {
  if (!r) return '';

  const existing = isExistingMember(r, pid);
  if (existing) return '';

  if ((r.players?.length || 0) >= (r.maxPlayers || 4)) {
    return 'ห้องนี้เต็มแล้ว';
  }

  if (r.status === 'countdown') {
    return 'ห้องนี้กำลังนับถอยหลังเริ่มแข่ง ไม่สามารถเข้าร่วมเพิ่มได้';
  }

  if (r.status === 'running') {
    return 'ห้องนี้กำลังแข่งขันอยู่ ผู้เล่นใหม่ไม่สามารถเข้าร่วมกลางเกมได้';
  }

  if (r.status === 'finished') {
    return 'ห้องนี้แข่งจบแล้ว กรุณารอ rematch หรือสร้างห้องใหม่';
  }

  return '';
}

function canJoinRoomNow(r, pid = ctx.pid) {
  return !getJoinBlockReason(r, pid);
}

function ensureJoined() {
  const cur = sanitizeRoom(loadRoom() || room || makeDefaultRoom());
  const existingIndex = cur.players.findIndex((p) => p.id === ctx.pid);

  if (existingIndex >= 0) {
    cur.players[existingIndex] = {
      ...cur.players[existingIndex],
      name: getMeName(),
      connected: true,
      lastSeenAt: now()
    };

    room = sanitizeRoom(cur);
    persistRoom(room, 'rejoin-existing');
    showJoinGuard('');
    return true;
  }

  const blockReason = getJoinBlockReason(cur, ctx.pid);
  if (blockReason) {
    room = sanitizeRoom(cur);
    render();
    showJoinGuard(blockReason);
    setHint(blockReason);
    return false;
  }

  cur.players.push({
    id: ctx.pid,
    name: getMeName(),
    ready: false,
    joinedAt: now(),
    lastSeenAt: now(),
    finished: false,
    finalScore: 0,
    miss: 0,
    streak: 0,
    phase: 'lobby',
    connected: true
  });

  room = sanitizeRoom(cur);
  persistRoom(room, 'join');
  showJoinGuard('');
  return true;
}

function touchPresence() {
  const cur = sanitizeRoom(loadRoom() || room || makeDefaultRoom());
  const idx = cur.players.findIndex((p) => p.id === ctx.pid);
  if (idx < 0) return;

  cur.players[idx] = {
    ...cur.players[idx],
    name: getMeName(),
    connected: true,
    lastSeenAt: now()
  };

  room = sanitizeRoom(cur);
  persistRoom(room, 'presence');
}

function updateMe(patch = {}) {
  const cur = sanitizeRoom(loadRoom() || room || makeDefaultRoom());
  const idx = cur.players.findIndex((p) => p.id === ctx.pid);
  if (idx < 0) return;

  cur.players[idx] = {
    ...cur.players[idx],
    ...patch,
    lastSeenAt: now()
  };

  room = sanitizeRoom(cur);
  persistRoom(room, 'update-me');
}

function updateMeBeforeRun() {
  const cur = sanitizeRoom(loadRoom() || room || makeDefaultRoom());
  const idx = cur.players.findIndex((p) => p.id === ctx.pid);
  if (idx < 0) return;

  cur.players[idx] = {
    ...cur.players[idx],
    name: getMeName(),
    ready: true,
    phase: 'run',
    connected: true,
    lastSeenAt: now()
  };

  room = sanitizeRoom(cur);
  persistRoom(room, 'to-run');
}

function isHost(r = room) {
  return !!r && r.hostId === ctx.pid;
}

function canStart(r = room) {
  if (!r) return false;
  if (r.status !== 'waiting') return false;
  if ((r.players?.length || 0) < (r.minPlayers || 2)) return false;
  return r.players.every((p) => !!p.ready);
}

function getPlayersText(r = room) {
  const total = r?.players?.length || 0;
  const min = r?.minPlayers || 2;
  return `${total}/${min}`;
}

function getStatusText(r = room) {
  if (!r) return 'waiting';
  switch (r.status) {
    case 'countdown': return 'countdown';
    case 'running': return 'running';
    case 'finished': return 'finished';
    default: return 'waiting';
  }
}

function renderPlayers(r = room) {
  const players = r?.players || [];

  if (!els.playersBox) return;

  els.playersBox.innerHTML = players.map((p) => {
    const isMe = p.id === ctx.pid;
    const phaseLabel = getPhaseLabel(p);
    const phaseClass = getPhaseClass(p);

    return `
      <div class="player">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <strong>${escapeHtml(playerLabel(p))}</strong>
            ${isMe ? `<span style="color:#7dd3fc;font-weight:800;">• คุณ</span>` : ''}
            ${p.id === r.hostId ? `
              <span style="
                font-size:12px;
                padding:4px 8px;
                border-radius:999px;
                background:rgba(250,204,21,.12);
                border:1px solid rgba(250,204,21,.24);
                color:#fde68a;
                font-weight:900;
              ">HOST</span>
            ` : ''}
          </div>

          <div style="
            font-size:12px;
            padding:4px 8px;
            border-radius:999px;
            background:rgba(255,255,255,.06);
            border:1px solid var(--stroke);
            color:var(--muted);
            font-weight:800;
          ">${escapeHtml(String(p.phase || 'lobby').toUpperCase())}</div>
        </div>

        <div class="${phaseClass}" style="margin-top:8px;">
          ${escapeHtml(phaseLabel)}
        </div>
      </div>
    `;
  }).join('');
}

function renderButtons(r = room) {
  const me = r?.players?.find((p) => p.id === ctx.pid);
  const host = isHost(r);
  const joinAllowed = canJoinRoomNow(r, ctx.pid) || !!me;

  if (els.btnReady) {
    els.btnReady.disabled = !me || !joinAllowed || r.status !== 'waiting';
    els.btnReady.textContent = me?.ready ? 'ยกเลิกพร้อม' : 'พร้อมแล้ว';
  }

  if (els.btnStart) {
    els.btnStart.disabled = !host || !canStart(r);
    els.btnStart.textContent = host ? 'เริ่มแข่ง' : 'รอ host เริ่ม';
  }

  if (els.btnCopyRoom) els.btnCopyRoom.disabled = false;
  if (els.btnCopyInvite) els.btnCopyInvite.disabled = false;
}

function renderStatus(r = room) {
  if (els.roomCode) els.roomCode.textContent = r?.roomId || '-';
  if (els.playerCount) els.playerCount.textContent = getPlayersText(r);
  if (els.roomStatus) els.roomStatus.textContent = getStatusText(r);

  const host = r?.players?.find((p) => p.id === r.hostId);
  if (els.hostName) {
    els.hostName.textContent = host ? playerLabel(host) : '-';
  }
  if (!host && r?.players?.length && els.hostName) {
    els.hostName.textContent = playerLabel(r.players[0]);
  }

  if (els.inviteLink) {
    els.inviteLink.value = buildInviteUrl();
  }

  if (!r) {
    setHint('กำลังสร้างห้อง...');
    setCopyState('กำลังเตรียมห้องแข่ง...');
    showJoinGuard('');
    return;
  }

  const blockReason = getJoinBlockReason(r, ctx.pid);
  const existing = isExistingMember(r, ctx.pid);

  if (blockReason && !existing) {
    showJoinGuard(blockReason);
  } else {
    showJoinGuard('');
  }

  if (r.status === 'waiting') {
    if ((r.players?.length || 0) < (r.minPlayers || 2)) {
      setHint(`ต้องมีอย่างน้อย ${r.minPlayers} คน`);
    } else if (!r.players.every((p) => p.ready)) {
      setHint('รอให้ทุกคนกดพร้อม');
    } else if (isHost(r)) {
      setHint('ทุกคนพร้อมแล้ว กดเริ่มแข่งได้');
    } else {
      setHint('ทุกคนพร้อมแล้ว รอ host กดเริ่ม');
    }

    setCopyState('ส่ง room code หรือลิงก์นี้ให้ผู้เล่นคนอื่นเข้าร่วมได้');
    if (els.countdown) els.countdown.textContent = '';
  }

  if (r.status === 'countdown') {
    setHint(isExistingMember(r) ? 'กำลังนับถอยหลังก่อนเริ่มพร้อมกัน' : 'ห้องนี้เริ่มนับถอยหลังแล้ว');
    setCopyState('ห้องถูกล็อกแล้ว กำลังจะเริ่มการแข่งขัน', false);
  }

  if (r.status === 'running') {
    setHint(isExistingMember(r) ? 'การแข่งขันเริ่มแล้ว กำลังเข้าสู่เกม' : 'ห้องนี้กำลังแข่งขันอยู่');
    setCopyState('การแข่งขันกำลังดำเนินอยู่', false);
  }

  if (r.status === 'finished') {
    setHint(isExistingMember(r) ? 'การแข่งขันจบแล้ว' : 'ห้องนี้แข่งจบแล้ว');
    setCopyState('สามารถกลับ lobby เพื่อ rematch ได้', false);
  }
}

function render() {
  room = sanitizeRoom(loadRoom() || room || makeDefaultRoom());
  renderStatus(room);
  renderPlayers(room);
  renderButtons(room);
}

function cancelCountdown() {
  if (countdownRAF) cancelAnimationFrame(countdownRAF);
  countdownRAF = 0;
  countdownRunning = false;
}

function getSortedPlayersForHost(r) {
  return [...(r?.players || [])].sort((a, b) => {
    const aj = Number(a.joinedAt || 0);
    const bj = Number(b.joinedAt || 0);
    return aj - bj;
  });
}

function pickNextHostId(r, excludePid = '') {
  const sorted = getSortedPlayersForHost(r);
  const next = sorted.find((p) => p.id && p.id !== excludePid);
  return next?.id || '';
}

function ensureValidHost(r, excludePid = '') {
  if (!r) return r;

  const hasHost = r.players?.some((p) => p.id === r.hostId);
  if (hasHost && r.hostId !== excludePid) return r;

  const nextHostId = pickNextHostId(r, excludePid);
  r.hostId = nextHostId || '';
  return r;
}

function resetCountdownToWaiting(r, reason = '') {
  if (!r) return r;

  r.status = 'waiting';
  r.startAt = null;
  r.updatedAt = now();

  r.players = (r.players || []).map((p) => ({
    ...p,
    phase: p.phase === 'run' ? 'lobby' : (p.phase || 'lobby'),
    connected: p.connected !== false
  }));

  if (reason) {
    setHint(reason);
    setCopyState(reason, false);
  }

  cancelCountdown();
  return r;
}

function hardenRoomAfterLeave(cur, leavingPid = '') {
  if (!cur) return cur;
  if (!cur.players?.length) return cur;

  const hostLeft = cur.hostId === leavingPid;

  if (hostLeft) {
    cur = ensureValidHost(cur, leavingPid);
  } else {
    cur = ensureValidHost(cur, '');
  }

  if (cur.status === 'countdown' && hostLeft) {
    cur = resetCountdownToWaiting(cur, 'host ออกจากห้อง ระบบยกเลิกการนับถอยหลังแล้ว');
  }

  cur.updatedAt = now();
  return cur;
}

function beginCountdown() {
  const cur = sanitizeRoom(loadRoom() || room || makeDefaultRoom());

  if (cur.status !== 'waiting') {
    setHint('ตอนนี้ยังเริ่มแข่งใหม่ไม่ได้');
    return;
  }

  if (!isHost(cur)) {
    setHint('เฉพาะ host เท่านั้นที่เริ่มแข่งได้');
    return;
  }

  if (!canStart(cur)) {
    setHint('ยังเริ่มไม่ได้ ต้องมีอย่างน้อย 2 คน และทุกคนต้อง ready');
    return;
  }

  cur.status = 'countdown';
  cur.startAt = now() + 4000;
  room = sanitizeRoom(cur);
  persistRoom(room, 'countdown-begin');
  runCountdown(room.startAt);
}

function runCountdown(startAt) {
  if (!startAt) return;
  cancelCountdown();
  countdownRunning = true;

  const tick = () => {
    const ms = startAt - now();

    if (ms <= 0) {
      if (els.countdown) els.countdown.textContent = 'GO!';
      countdownRunning = false;

      const cur = sanitizeRoom(loadRoom() || room || makeDefaultRoom());
      if (cur.status !== 'running') {
        cur.status = 'running';
        room = sanitizeRoom(cur);
        persistRoom(room, 'running');
      }

      window.setTimeout(() => {
        enterRun(startAt);
      }, 250);
      return;
    }

    const sec = Math.ceil(ms / 1000);
    if (els.countdown) els.countdown.textContent = String(sec);
    countdownRAF = requestAnimationFrame(tick);
  };

  tick();
}

function enterRun(startAt) {
  __gjLobbyExitMode = 'to-run';
  updateMeBeforeRun();

  const q = new URLSearchParams({
    pid: ctx.pid,
    name: getMeName(),
    studyId: ctx.studyId,
    diff: ctx.diff,
    time: ctx.time,
    seed: ctx.seed,
    hub: ctx.hub,
    view: ctx.view,
    run: ctx.run,
    gameId: ctx.gameId,
    mode: 'race',
    roomId: ctx.roomId,
    startAt: String(startAt)
  });

  location.href = `./goodjunk-vr.html?${q.toString()}`;
}

function leaveRoom() {
  const cur = sanitizeRoom(loadRoom() || room || makeDefaultRoom());
  const leavingPid = ctx.pid;

  cur.players = cur.players.filter((p) => p.id !== leavingPid);

  if (!cur.players.length) {
    removeRoom();
    return;
  }

  const hardened = hardenRoomAfterLeave(cur, leavingPid);
  room = sanitizeRoom(hardened);
  persistRoom(room, 'leave');
}

function onReadyClick() {
  const cur = sanitizeRoom(loadRoom() || room || makeDefaultRoom());
  const me = cur.players.find((p) => p.id === ctx.pid);

  if (!me) {
    const reason = getJoinBlockReason(cur, ctx.pid) || 'ยังเข้าห้องไม่สำเร็จ';
    showJoinGuard(reason);
    setHint(reason);
    return;
  }

  if (cur.status !== 'waiting') {
    setHint('ตอนนี้เปลี่ยนสถานะพร้อมไม่ได้แล้ว');
    return;
  }

  updateMe({ ready: !me.ready, phase: 'lobby', connected: true });
}

function onStartClick() {
  beginCountdown();
}

function onBackClick() {
  __gjLobbyExitMode = 'leave';
  leaveRoom();
  location.href = ctx.hub;
}

async function onCopyRoomClick() {
  const ok = await copyText(ctx.roomId);
  setCopyState(
    ok ? `คัดลอก Room Code แล้ว: ${ctx.roomId}` : 'คัดลอก Room Code ไม่สำเร็จ',
    ok
  );
}

async function onCopyInviteClick() {
  const link = buildInviteUrl();
  const ok = await copyText(link);
  setCopyState(
    ok ? 'คัดลอก Invite Link แล้ว' : 'คัดลอก Invite Link ไม่สำเร็จ',
    ok
  );
}

function handleStorageSync(ev) {
  if (ev.key !== STORAGE_KEY) return;

  room = sanitizeRoom(loadRoom() || room || makeDefaultRoom());
  render();

  if (room.status === 'countdown' && room.startAt) {
    runCountdown(room.startAt);
  } else {
    cancelCountdown();
  }
}

function handleChannelSync(ev) {
  const data = ev?.data;
  if (!data || data.sender === instanceId) return;

  if (data.type === 'room:removed') {
    room = makeDefaultRoom();
    render();
    return;
  }

  if (data.type === 'room:update' && data.room) {
    const prevHostId = room?.hostId || '';
    room = sanitizeRoom(data.room);
    render();

    if (prevHostId && room.hostId && prevHostId !== room.hostId) {
      const newHost = room.players?.find((p) => p.id === room.hostId);
      if (newHost) {
        setCopyState(`host เปลี่ยนเป็น ${playerLabel(newHost)}`, false);
      }
    }

    if (room.status === 'countdown' && room.startAt) {
      runCountdown(room.startAt);
    } else {
      cancelCountdown();
    }
  }
}

function bindEvents() {
  els.btnReady?.addEventListener('click', onReadyClick);
  els.btnStart?.addEventListener('click', onStartClick);
  els.btnBack?.addEventListener('click', onBackClick);
  els.btnCopyRoom?.addEventListener('click', onCopyRoomClick);
  els.btnCopyInvite?.addEventListener('click', onCopyInviteClick);

  window.addEventListener('storage', handleStorageSync);

  if (channel) {
    channel.onmessage = handleChannelSync;
  }

  window.addEventListener('beforeunload', () => {
    try {
      if (__gjLobbyExitMode === 'to-run') return;

      if (__gjLobbyExitMode === 'leave') {
        leaveRoom();
        return;
      }

      leaveRoom();
    } catch {}
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      touchPresence();
    }
  });

  window.addEventListener('focus', () => {
    touchPresence();
  });
}

function boot() {
  ensureRoomExists();
  const joined = ensureJoined();
  render();
  bindEvents();

  if (!joined) {
    if (els.btnReady) els.btnReady.disabled = true;
    if (els.btnStart) els.btnStart.disabled = true;
    setCopyState('ห้องนี้ไม่พร้อมรับผู้เล่นใหม่ในตอนนี้', false);
    return;
  }

  touchPresence();

  if (room.status === 'countdown' && room.startAt) {
    runCountdown(room.startAt);
  }
}

boot();
