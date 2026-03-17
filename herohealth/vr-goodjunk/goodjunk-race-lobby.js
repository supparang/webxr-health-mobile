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
  roomId: params.get('roomId') || `GJ-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
};

const STORAGE_KEY = `GJ_RACE_ROOM_${ctx.roomId}`;
const CHANNEL_NAME = `gj-race-${ctx.roomId}`;
const channel = safeBroadcastChannel(CHANNEL_NAME);

const $ = (id) => document.getElementById(id);

const els = {
  roomCode: $('roomCode'),
  playerCount: $('playerCount'),
  roomStatus: $('roomStatus'),
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
  if (p.name && String(p.name).trim()) return String(p.name).trim();
  if (p.id) return String(p.id);
  return 'player';
}

function getMeName() {
  const trimmed = String(ctx.name || '').trim();
  if (trimmed) return trimmed;
  return ctx.pid;
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

function persistRoom(next, source = 'local') {
  room = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  broadcast({
    type: 'room:update',
    room: next,
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

function broadcast(payload) {
  if (!channel) return;
  try {
    channel.postMessage(payload);
  } catch {}
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
      streak: Number(p.streak || 0)
    }))
    .filter((p) => p.id);

  if (!safe.players.length) {
    safe.hostId = ctx.pid;
  } else if (!safe.players.some((p) => p.id === safe.hostId)) {
    safe.hostId = safe.players[0].id;
  }

  safe.minPlayers = Math.max(2, Number(safe.minPlayers || 2));
  safe.maxPlayers = Math.max(safe.minPlayers, Number(safe.maxPlayers || 4));
  safe.status = ['waiting', 'countdown', 'running', 'finished'].includes(safe.status)
    ? safe.status
    : 'waiting';
  safe.startAt = safe.startAt ? Number(safe.startAt) : null;
  safe.updatedAt = now();

  return safe;
}

function ensureRoomExists() {
  const existing = loadRoom();
  if (existing) {
    room = sanitizeRoom(existing);
    persistRoom(room, 'ensure-existing');
    return;
  }
  room = makeDefaultRoom();
  persistRoom(room, 'ensure-new');
}

function ensureJoined() {
  const cur = sanitizeRoom(loadRoom() || room || makeDefaultRoom());
  const existingIndex = cur.players.findIndex((p) => p.id === ctx.pid);

  if (existingIndex >= 0) {
    cur.players[existingIndex] = {
      ...cur.players[existingIndex],
      name: getMeName(),
      lastSeenAt: now()
    };
  } else {
    if (cur.players.length >= cur.maxPlayers) {
      setHint('ห้องนี้เต็มแล้ว');
      room = cur;
      render();
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
      streak: 0
    });
  }

  room = sanitizeRoom(cur);
  persistRoom(room, 'join');
  return true;
}

function touchPresence() {
  const cur = sanitizeRoom(loadRoom() || room || makeDefaultRoom());
  const idx = cur.players.findIndex((p) => p.id === ctx.pid);
  if (idx < 0) return;

  cur.players[idx] = {
    ...cur.players[idx],
    name: getMeName(),
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

function setHint(text) {
  if (els.hint) els.hint.textContent = text;
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
  els.playersBox.innerHTML = players.map((p) => {
    const meTag = p.id === ctx.pid ? ' • คุณ' : '';
    const hostTag = p.id === r.hostId ? ' 👑 host' : '';
    return `
      <div class="player">
        <div><strong>${escapeHtml(playerLabel(p))}</strong>${escapeHtml(meTag)}${escapeHtml(hostTag)}</div>
        <div class="${p.ready ? 'ready' : 'waiting'}">
          ${p.ready ? 'พร้อมแล้ว' : 'ยังไม่พร้อม'}
        </div>
      </div>
    `;
  }).join('');
}

function renderButtons(r = room) {
  const me = r?.players?.find((p) => p.id === ctx.pid);
  const host = isHost(r);

  if (els.btnReady) {
    els.btnReady.disabled = !me || r.status !== 'waiting';
    els.btnReady.textContent = me?.ready ? 'ยกเลิกพร้อม' : 'พร้อมแล้ว';
  }

  if (els.btnStart) {
    els.btnStart.disabled = !host || !canStart(r);
    els.btnStart.textContent = host ? 'เริ่มแข่ง' : 'รอ host เริ่ม';
  }
}

function renderStatus(r = room) {
  if (els.roomCode) els.roomCode.textContent = r?.roomId || '-';
  if (els.playerCount) els.playerCount.textContent = getPlayersText(r);
  if (els.roomStatus) els.roomStatus.textContent = getStatusText(r);

  if (!r) {
    setHint('กำลังสร้างห้อง...');
    return;
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
    if (els.countdown) els.countdown.textContent = '';
  }

  if (r.status === 'countdown') {
    setHint('กำลังนับถอยหลังก่อนเริ่มพร้อมกัน');
  }

  if (r.status === 'running') {
    setHint('การแข่งขันเริ่มแล้ว กำลังเข้าสู่เกม');
  }
}

function render() {
  const cur = sanitizeRoom(loadRoom() || room || makeDefaultRoom());
  room = cur;
  renderStatus(cur);
  renderPlayers(cur);
  renderButtons(cur);
}

function cancelCountdown() {
  if (countdownRAF) cancelAnimationFrame(countdownRAF);
  countdownRAF = 0;
  countdownRunning = false;
}

function beginCountdown() {
  const cur = sanitizeRoom(loadRoom() || room || makeDefaultRoom());

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
  if (countdownRunning) return;
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
  cur.players = cur.players.filter((p) => p.id !== ctx.pid);

  if (!cur.players.length) {
    removeRoom();
    return;
  }

  if (cur.hostId === ctx.pid) {
    cur.hostId = cur.players[0].id;
  }

  if (cur.status !== 'waiting') {
    cur.status = 'waiting';
    cur.startAt = null;
    cur.players = cur.players.map((p) => ({ ...p, ready: false }));
  }

  room = sanitizeRoom(cur);
  persistRoom(room, 'leave');
}

function onReadyClick() {
  const cur = sanitizeRoom(loadRoom() || room || makeDefaultRoom());
  const me = cur.players.find((p) => p.id === ctx.pid);
  if (!me) {
    setHint('ยังเข้าห้องไม่สำเร็จ');
    return;
  }
  if (cur.status !== 'waiting') {
    setHint('ตอนนี้เปลี่ยนสถานะพร้อมไม่ได้แล้ว');
    return;
  }
  updateMe({ ready: !me.ready });
}

function onStartClick() {
  beginCountdown();
}

function onBackClick() {
  leaveRoom();
  location.href = ctx.hub;
}

function handleStorageSync(ev) {
  if (ev.key !== STORAGE_KEY) return;
  room = sanitizeRoom(loadRoom() || room || makeDefaultRoom());
  render();

  if (room.status === 'countdown' && room.startAt) {
    cancelCountdown();
    runCountdown(room.startAt);
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
    room = sanitizeRoom(data.room);
    render();

    if (room.status === 'countdown' && room.startAt) {
      cancelCountdown();
      runCountdown(room.startAt);
    }
  }
}

function bindEvents() {
  els.btnReady?.addEventListener('click', onReadyClick);
  els.btnStart?.addEventListener('click', onStartClick);
  els.btnBack?.addEventListener('click', onBackClick);

  window.addEventListener('storage', handleStorageSync);

  if (channel) {
    channel.onmessage = handleChannelSync;
  }

  window.addEventListener('beforeunload', () => {
    try {
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
    els.btnReady.disabled = true;
    els.btnStart.disabled = true;
    setHint('ห้องนี้เต็มแล้ว');
    return;
  }

  touchPresence();

  if (room.status === 'countdown' && room.startAt) {
    runCountdown(room.startAt);
  }
}

boot();