const params = new URLSearchParams(location.search);

const ctx = {
  mode: params.get('mode') || 'race',
  pid: params.get('pid') || `p-${Math.random().toString(36).slice(2, 8)}`,
  name: params.get('name') || '',
  studyId: params.get('studyId') || '',
  diff: params.get('diff') || 'normal',
  time: params.get('time') || '120',
  seed: params.get('seed') || String(Date.now()),
  hub: params.get('hub') || './hub.html',
  view: params.get('view') || 'mobile',
  run: params.get('run') || 'play',
  gameId: params.get('gameId') || 'goodjunk',
  roomId: normalizeRoomCode(
    params.get('roomId') || `GJ${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  )
};

const ROOM_PATH = `hha-battle/goodjunk/rooms/${ctx.roomId}`;
const PRESENCE_HEARTBEAT_MS = 4000;
const DISCONNECT_PRUNE_MS = 15000;

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

let firebase = null;
let db = null;
let roomRef = null;
let playersRef = null;
let myPlayerRef = null;

let room = null;
let countdownRAF = 0;
let countdownRunning = false;
let countdownStartAt = 0;
let presenceTimer = 0;
let subscribed = false;
let repairBusy = false;
let exitMode = 'stay';

function normalizeRoomCode(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function now() {
  return Date.now();
}

function clone(obj) {
  try { return structuredClone(obj); }
  catch { return JSON.parse(JSON.stringify(obj)); }
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
  if (player.connected === false) return 'หลุดการเชื่อมต่อ';
  if (player.phase === 'done') return 'แข่งจบแล้ว';
  if (player.phase === 'run') return 'กำลังเข้าเกม';
  return player.ready ? 'พร้อมแล้ว' : 'ยังไม่พร้อม';
}

function getPhaseClass(player) {
  if (!player) return 'waiting';
  if (player.connected === false) return 'waiting';
  if (player.phase === 'done' || player.phase === 'run') return 'ready';
  return player.ready ? 'ready' : 'waiting';
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

function isHost(r = room) {
  return !!r && r.hostId === ctx.pid;
}

function activePlayers(r = room) {
  return (r?.players || []).filter((p) => p.connected !== false);
}

function isExistingMember(r, pid = ctx.pid) {
  return !!r?.players?.some((p) => p.id === pid);
}

function getJoinBlockReason(r, pid = ctx.pid) {
  if (!r) return '';
  const existing = isExistingMember(r, pid);
  if (existing) return '';

  if ((activePlayers(r).length || 0) >= (r.maxPlayers || 4)) return 'ห้องนี้เต็มแล้ว';
  if (r.status === 'countdown') return 'ห้องนี้กำลังนับถอยหลังเริ่มแข่ง ไม่สามารถเข้าร่วมเพิ่มได้';
  if (r.status === 'running') return 'ห้องนี้กำลังแข่งขันอยู่ ผู้เล่นใหม่ไม่สามารถเข้าร่วมกลางเกมได้';
  if (r.status === 'finished') return 'ห้องนี้แข่งจบแล้ว กรุณารอ rematch หรือสร้างห้องใหม่';
  return '';
}

function canStart(r = room) {
  if (!r) return false;
  if (r.status !== 'waiting') return false;
  const players = activePlayers(r);
  if (players.length < (r.minPlayers || 2)) return false;
  return players.every((p) => !!p.ready);
}

function getPlayersText(r = room) {
  const total = activePlayers(r).length;
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

function makeDefaultRoom() {
  return {
    roomId: ctx.roomId,
    hostId: ctx.pid,
    mode: 'race',
    minPlayers: 2,
    maxPlayers: 4,
    status: 'waiting',
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
      phase: String(p.phase || 'lobby').trim(),
      connected: p.connected !== false
    }))
    .filter((p) => p.id);

  if (!safe.players.length) {
    safe.hostId = ctx.pid;
  } else if (!safe.players.some((p) => p.id === safe.hostId)) {
    const connected = safe.players.find((p) => p.connected !== false);
    safe.hostId = connected?.id || safe.players[0].id;
  }

  safe.minPlayers = Math.max(2, Number(safe.minPlayers || 2));
  safe.maxPlayers = Math.max(safe.minPlayers, Number(safe.maxPlayers || 4));
  safe.status = ['waiting', 'countdown', 'running', 'finished'].includes(safe.status) ? safe.status : 'waiting';
  safe.startAt = safe.startAt ? Number(safe.startAt) : null;
  safe.updatedAt = now();

  return safe;
}

function snapshotToRoom(val) {
  if (!val) return null;
  const playersMap = val.players || {};
  return {
    ...val,
    players: Object.keys(playersMap).map((pid) => ({
      id: pid,
      ...playersMap[pid]
    }))
  };
}

function roomToFirebase(r) {
  const out = {
    roomId: r.roomId,
    hostId: r.hostId,
    mode: r.mode,
    minPlayers: r.minPlayers,
    maxPlayers: r.maxPlayers,
    status: r.status,
    startAt: r.startAt || null,
    createdAt: r.createdAt || now(),
    updatedAt: now(),
    players: {}
  };

  (r.players || []).forEach((p) => {
    out.players[p.id] = {
      name: p.name || '',
      ready: !!p.ready,
      joinedAt: Number(p.joinedAt || now()),
      lastSeenAt: Number(p.lastSeenAt || now()),
      finished: !!p.finished,
      finalScore: Number(p.finalScore || 0),
      miss: Number(p.miss || 0),
      streak: Number(p.streak || 0),
      phase: String(p.phase || 'lobby'),
      connected: p.connected !== false,
      dnfReason: String(p.dnfReason || '')
    };
  });

  return out;
}

function pickNextHostId(r, excludePid = '') {
  const candidates = (r?.players || [])
    .filter((p) => p.id !== excludePid)
    .sort((a, b) => Number(a.joinedAt || 0) - Number(b.joinedAt || 0));

  const connected = candidates.find((p) => p.connected !== false);
  return connected?.id || candidates[0]?.id || '';
}

function maybeResetCountdownIfHostMissing(cur) {
  if (!cur) return cur;
  const host = cur.players.find((p) => p.id === cur.hostId);
  if (cur.status === 'countdown' && (!host || host.connected === false)) {
    cur.status = 'waiting';
    cur.startAt = null;
  }
  return cur;
}

function renderPlayers(r = room) {
  const players = r?.players || [];
  if (!els.playersBox) return;

  els.playersBox.innerHTML = players.map((p) => {
    const meTag = p.id === ctx.pid ? ' • คุณ' : '';
    const hostTag = p.id === r.hostId ? ' 👑 host' : '';

    return `
      <div class="player">
        <div><strong>${escapeHtml(playerLabel(p))}</strong>${escapeHtml(meTag)}${escapeHtml(hostTag)}</div>
        <div class="${getPhaseClass(p)}">${escapeHtml(getPhaseLabel(p))}</div>
      </div>
    `;
  }).join('');
}

function renderButtons(r = room) {
  const me = r?.players?.find((p) => p.id === ctx.pid);

  if (els.btnReady) {
    els.btnReady.disabled = !me || me.connected === false || r?.status !== 'waiting';
    els.btnReady.textContent = me?.ready ? 'ยกเลิกพร้อม' : 'พร้อมแล้ว';
  }

  if (els.btnStart) {
    els.btnStart.disabled = !isHost(r) || !canStart(r);
    els.btnStart.textContent = isHost(r) ? 'เริ่มแข่ง' : 'รอ host เริ่ม';
  }
}

function renderStatus(r = room) {
  if (els.roomCode) els.roomCode.textContent = r?.roomId || '-';
  if (els.playerCount) els.playerCount.textContent = getPlayersText(r);
  if (els.roomStatus) els.roomStatus.textContent = getStatusText(r);

  const host = r?.players?.find((p) => p.id === r?.hostId);
  if (els.hostName) els.hostName.textContent = host ? playerLabel(host) : '-';
  if (els.inviteLink) els.inviteLink.value = buildInviteUrl();

  if (!r) {
    setHint('กำลังสร้างห้อง...');
    if (els.countdown) els.countdown.textContent = '';
    return;
  }

  const blockReason = getJoinBlockReason(r, ctx.pid);
  showJoinGuard(blockReason);

  const active = activePlayers(r);

  if (r.status === 'waiting') {
    if (active.length < (r.minPlayers || 2)) setHint(`ต้องมีอย่างน้อย ${r.minPlayers} คน`);
    else if (!active.every((p) => p.ready)) setHint('รอให้ทุกคนกดพร้อม');
    else if (isHost(r)) setHint('ทุกคนพร้อมแล้ว กดเริ่มแข่งได้');
    else setHint('ทุกคนพร้อมแล้ว รอ host กดเริ่ม');

    setCopyState('ส่ง room code หรือลิงก์นี้ให้ผู้เล่นคนอื่นเข้าร่วมได้');
    if (els.countdown) els.countdown.textContent = '';
  }

  if (r.status === 'countdown') {
    setHint('กำลังนับถอยหลังก่อนเริ่มพร้อมกัน');
    setCopyState('ห้องถูกล็อกแล้ว กำลังจะเริ่มการแข่งขัน', false);
  }

  if (r.status === 'running') {
    setHint('การแข่งขันเริ่มแล้ว กำลังเข้าสู่เกม');
    setCopyState('การแข่งขันกำลังดำเนินอยู่', false);
  }

  if (r.status === 'finished') {
    setHint('การแข่งขันจบแล้ว');
    setCopyState('สามารถกลับ lobby เพื่อ rematch ได้', false);
  }
}

function render() {
  room = room ? sanitizeRoom(room) : null;
  renderStatus(room);
  renderPlayers(room);
  renderButtons(room);
}

function cancelCountdown() {
  if (countdownRAF) cancelAnimationFrame(countdownRAF);
  countdownRAF = 0;
  countdownRunning = false;
  countdownStartAt = 0;
}

function runCountdown(startAt) {
  if (!startAt) return;
  if (countdownRunning && countdownStartAt === startAt) return;

  cancelCountdown();
  countdownRunning = true;
  countdownStartAt = startAt;

  const tick = () => {
    const ms = startAt - now();

    if (ms <= 0) {
      if (els.countdown) els.countdown.textContent = 'GO!';
      countdownRunning = false;
      countdownStartAt = 0;

      if (roomRef) {
        roomRef.update({ status: 'running', updatedAt: now() }).catch(() => {});
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

function waitForFirebaseReady(timeoutMs = 12000) {
  return new Promise((resolve) => {
    if (window.HHA_FIREBASE_READY && window.HHA_FIREBASE_DB) {
      resolve(true);
      return;
    }

    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      resolve(!!ok);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);

    window.addEventListener('hha:firebase_ready', (ev) => {
      clearTimeout(timer);
      finish(!!ev?.detail?.ok && !!window.HHA_FIREBASE_DB);
    }, { once: true });
  });
}

async function ensureFirebase() {
  const ok = await waitForFirebaseReady();
  if (!ok || !window.HHA_FIREBASE_DB || !window.HHA_FIREBASE) {
    throw new Error('Firebase not ready');
  }

  firebase = window.HHA_FIREBASE;
  db = window.HHA_FIREBASE_DB;
  roomRef = db.ref(ROOM_PATH);
  playersRef = roomRef.child('players');
  myPlayerRef = playersRef.child(ctx.pid);
}

async function ensureRoomExists() {
  const snap = await roomRef.once('value');
  const cur = snap.exists() ? sanitizeRoom(snapshotToRoom(snap.val())) : null;
  if (cur) return;

  const base = makeDefaultRoom();
  await roomRef.set(roomToFirebase(base));
}

async function maybeRepairRoomIfNeeded(cur) {
  if (!cur || repairBusy) return;

  const me = cur.players.find((p) => p.id === ctx.pid);
  if (!me || me.connected === false) return;

  const next = clone(cur);
  let changed = false;
  const ts = now();

  if (next.status === 'waiting' || next.status === 'finished') {
    const before = next.players.length;
    next.players = next.players.filter((p) => {
      if (p.connected !== false) return true;
      return (ts - Number(p.lastSeenAt || 0)) < DISCONNECT_PRUNE_MS;
    });
    if (next.players.length !== before) changed = true;
  }

  const host = next.players.find((p) => p.id === next.hostId);
  if (!host || host.connected === false) {
    const nextHostId = pickNextHostId(next, '');
    if (next.hostId !== nextHostId) {
      next.hostId = nextHostId || '';
      changed = true;
    }
  }

  const repaired = maybeResetCountdownIfHostMissing(next);
  if (repaired.status !== next.status || repaired.startAt !== next.startAt) changed = true;

  if (!repaired.players.length) {
    repairBusy = true;
    try {
      await roomRef.remove();
    } finally {
      repairBusy = false;
    }
    return;
  }

  if (!changed) return;

  repairBusy = true;
  try {
    await roomRef.set(roomToFirebase(repaired));
  } finally {
    repairBusy = false;
  }
}

function subscribeRoom() {
  if (subscribed) return;
  subscribed = true;

  roomRef.on('value', async (snap) => {
    const raw = snap.val();
    if (!raw) {
      room = null;
      render();
      setHint('ห้องถูกปิดแล้ว');
      cancelCountdown();
      return;
    }

    room = sanitizeRoom(snapshotToRoom(raw));
    render();

    if (room.status === 'countdown' && room.startAt) runCountdown(room.startAt);
    else cancelCountdown();

    await maybeRepairRoomIfNeeded(room);
  });
}

async function setupOnDisconnect() {
  if (!myPlayerRef) return;
  try {
    await myPlayerRef.onDisconnect().update({
      connected: false,
      phase: 'lobby',
      dnfReason: 'disconnect'
    });
  } catch {}
}

async function ensureJoined() {
  const snap = await roomRef.once('value');
  const cur = sanitizeRoom(snapshotToRoom(snap.val()) || makeDefaultRoom());

  const existing = cur.players.find((p) => p.id === ctx.pid);
  const blockReason = getJoinBlockReason(cur, ctx.pid);
  if (!existing && blockReason) {
    setHint(blockReason);
    showJoinGuard(blockReason);
    return false;
  }

  const playerPayload = {
    name: getMeName(),
    ready: existing?.ready || false,
    joinedAt: Number(existing?.joinedAt || now()),
    lastSeenAt: now(),
    finished: !!existing?.finished,
    finalScore: Number(existing?.finalScore || 0),
    miss: Number(existing?.miss || 0),
    streak: Number(existing?.streak || 0),
    phase: String(existing?.phase || 'lobby'),
    connected: true,
    dnfReason: String(existing?.dnfReason || '')
  };

  await myPlayerRef.set(playerPayload);

  if (!cur.hostId || !cur.players.some((p) => p.id === cur.hostId && p.connected !== false)) {
    await roomRef.child('hostId').set(existing?.id || ctx.pid);
  }

  await roomRef.child('updatedAt').set(now());
  await setupOnDisconnect();

  return true;
}

async function touchPresence() {
  if (!myPlayerRef) return;
  try {
    await myPlayerRef.update({
      name: getMeName(),
      connected: true,
      lastSeenAt: now()
    });
    await roomRef.child('updatedAt').set(now());
  } catch {}
}

async function updateMe(patch = {}) {
  if (!myPlayerRef) return;

  const payload = { ...patch, lastSeenAt: now() };
  await myPlayerRef.update(payload);
  await roomRef.child('updatedAt').set(now());
}

function startPresenceHeartbeat() {
  stopPresenceHeartbeat();
  presenceTimer = setInterval(() => {
    touchPresence();
  }, PRESENCE_HEARTBEAT_MS);
}

function stopPresenceHeartbeat() {
  if (presenceTimer) {
    clearInterval(presenceTimer);
    presenceTimer = 0;
  }
}

async function beginCountdown() {
  const snap = await roomRef.once('value');
  const cur = sanitizeRoom(snapshotToRoom(snap.val()) || makeDefaultRoom());

  if (!isHost(cur)) {
    setHint('เฉพาะ host เท่านั้นที่เริ่มแข่งได้');
    return;
  }

  if (!canStart(cur)) {
    setHint('ยังเริ่มไม่ได้ ต้องมีอย่างน้อย 2 คน และทุกคนต้อง ready');
    return;
  }

  const startAt = now() + 4000;
  await roomRef.update({
    status: 'countdown',
    startAt,
    updatedAt: now()
  });
}

async function enterRun(startAt) {
  exitMode = 'to-run';

  try {
    await myPlayerRef?.onDisconnect().cancel();
  } catch {}

  await updateMe({
    ready: true,
    phase: 'run',
    connected: true,
    dnfReason: '',
    lastSeenAt: now()
  });

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

  location.href = `./vr-goodjunk/goodjunk-vr.html?${q.toString()}`;
}

async function leaveRoom() {
  if (!roomRef || !myPlayerRef) return;

  try { await myPlayerRef.onDisconnect().cancel(); } catch {}

  const snap = await roomRef.once('value');
  const cur = sanitizeRoom(snapshotToRoom(snap.val()) || makeDefaultRoom());

  const remaining = cur.players.filter((p) => p.id !== ctx.pid);

  if (!remaining.length) {
    await roomRef.remove();
    return;
  }

  const next = clone(cur);
  next.players = remaining;
  next.updatedAt = now();

  if (!remaining.some((p) => p.id === next.hostId)) {
    next.hostId = pickNextHostId(next, '');
  }

  if (next.status !== 'waiting') {
    next.status = 'waiting';
    next.startAt = null;
    next.players = next.players.map((p) => ({
      ...p,
      ready: false,
      phase: 'lobby',
      dnfReason: ''
    }));
  }

  await roomRef.set(roomToFirebase(next));
}

async function onReadyClick() {
  const me = room?.players?.find((p) => p.id === ctx.pid);
  if (!me) {
    setHint('ยังเข้าห้องไม่สำเร็จ');
    return;
  }

  if (room?.status !== 'waiting') {
    setHint('ตอนนี้เปลี่ยนสถานะพร้อมไม่ได้แล้ว');
    return;
  }

  await updateMe({
    ready: !me.ready,
    phase: 'lobby',
    connected: true,
    dnfReason: ''
  });
}

async function onStartClick() {
  await beginCountdown();
}

async function onBackClick() {
  exitMode = 'leave';
  try { await leaveRoom(); } catch {}
  location.href = ctx.hub || './hub.html';
}

async function onCopyRoomClick() {
  const ok = await copyText(ctx.roomId);
  setCopyState(ok ? `คัดลอก Room Code แล้ว: ${ctx.roomId}` : 'คัดลอก Room Code ไม่สำเร็จ', ok);
}

async function onCopyInviteClick() {
  const link = buildInviteUrl();
  const ok = await copyText(link);
 
