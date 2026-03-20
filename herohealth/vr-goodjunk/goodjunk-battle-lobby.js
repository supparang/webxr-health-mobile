// === /herohealth/vr-goodjunk/goodjunk-battle-lobby.js ===
// GoodJunk Battle Lobby
// FULL PATCH v20260320-BATTLE-LOBBY-READY2-MAX5-QR

const params = new URLSearchParams(location.search);

function makeDevicePid() {
  try {
    const KEY = 'GJ_DEVICE_PID';
    let pid = localStorage.getItem(KEY);
    if (!pid) {
      pid = `p-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(KEY, pid);
    }
    return pid;
  } catch {
    return `p-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function normalizePid(rawPid) {
  const v = String(rawPid || '').trim().replace(/[.#$[\]/]/g, '-');
  if (!v) return makeDevicePid();
  if (v.toLowerCase() === 'anon') return makeDevicePid();
  return v;
}

function normalizeRoomCode(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
}

const ctx = {
  mode: 'battle',
  pid: normalizePid(params.get('pid')),
  name: params.get('name') || '',
  studyId: params.get('studyId') || '',
  diff: params.get('diff') || 'normal',
  time: params.get('time') || '120',
  seed: params.get('seed') || String(Date.now()),
  hub: params.get('hub') || '../hub.html',
  view: params.get('view') || 'mobile',
  run: params.get('run') || 'play',
  gameId: params.get('gameId') || 'goodjunk',
  roomId: normalizeRoomCode(params.get('roomId') || `GJ${Math.random().toString(36).slice(2, 8).toUpperCase()}`)
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
  qrBox: $('qrBox'),
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
let myPlayerRef = null;

let room = null;
let countdownRAF = 0;
let countdownRunning = false;
let countdownStartAt = 0;
let presenceTimer = 0;
let subscribed = false;
let repairBusy = false;
let hasEnteredRun = false;

function now() { return Date.now(); }

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

function getMeName() {
  const trimmed = String(ctx.name || '').trim();
  return trimmed || ctx.pid;
}

function playerLabel(p) {
  if (p?.name && String(p.name).trim()) return String(p.name).trim();
  if (p?.id) return String(p.id);
  return 'player';
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

function buildInviteUrl() {
  const q = new URLSearchParams({
    name: '',
    studyId: ctx.studyId,
    diff: ctx.diff,
    time: ctx.time,
    seed: String(Date.now()),
    hub: ctx.hub,
    view: ctx.view,
    run: ctx.run,
    gameId: ctx.gameId,
    mode: 'battle',
    roomId: ctx.roomId
  });
  return `${location.origin}${location.pathname}?${q.toString()}`;
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

function renderQr(link = '') {
  if (!els.qrBox) return;

  const value = String(link || '').trim();
  if (!value) {
    els.qrBox.innerHTML = '<div class="qr-empty">ยังไม่มีลิงก์</div>';
    return;
  }

  const img = new Image();
  img.alt = 'Battle Invite QR';
  img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(value);

  els.qrBox.innerHTML = '';
  els.qrBox.appendChild(img);
}

function activePlayers(r = room) {
  return (r?.players || []).filter((p) => p.connected !== false);
}

function readyPlayers(r = room) {
  return activePlayers(r).filter((p) => !!p.ready);
}

function isHost(r = room) {
  return !!r && r.hostId === ctx.pid;
}

function isExistingMember(r, pid = ctx.pid) {
  return !!r?.players?.some((p) => p.id === pid);
}

function getJoinBlockReason(r, pid = ctx.pid) {
  if (!r) return '';
  const existing = isExistingMember(r, pid);
  if (existing) return '';
  if ((activePlayers(r).length || 0) >= (r.maxPlayers || 5)) return 'ห้องนี้เต็มแล้ว';
  if (r.status === 'countdown') return 'ห้องนี้กำลังนับถอยหลังก่อนเริ่มเกม';
  if (r.status === 'running') return 'ห้องนี้กำลังเล่นอยู่ ผู้เล่นใหม่เข้ากลางเกมไม่ได้';
  if (r.status === 'finished') return 'รอบนี้จบแล้ว รอเล่นใหม่หรือสร้างห้องใหม่';
  return '';
}

function getMatchParticipantIds(r = room) {
  const ids = Array.isArray(r?.match?.participantIds) ? r.match.participantIds : [];
  return ids.map((id) => normalizePid(id)).filter(Boolean);
}

function amIMatchParticipant(r = room) {
  const ids = getMatchParticipantIds(r);
  if (!ids.length) return true;
  return ids.includes(ctx.pid);
}

function canStart(r = room) {
  if (!r) return false;
  if (r.status !== 'waiting') return false;
  return readyPlayers(r).length >= (r.minPlayers || 2);
}

function getPlayersText(r = room) {
  const total = activePlayers(r).length;
  const ready = readyPlayers(r).length;
  const min = r?.minPlayers || 2;
  return `${total} คน • ready ${ready}/${min}`;
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

function clearMatchState(next) {
  next.match = {
    participantIds: [],
    lockedAt: null,
    status: 'idle',
    battle: {
      finishedAt: 0
    }
  };
  return next;
}

function makeDefaultRoom() {
  return {
    roomId: ctx.roomId,
    hostId: ctx.pid,
    mode: 'battle',
    minPlayers: 2,
    maxPlayers: 5,
    status: 'waiting',
    startAt: null,
    createdAt: now(),
    updatedAt: now(),
    players: [],
    match: {
      participantIds: [],
      lockedAt: null,
      status: 'idle',
      battle: {
        finishedAt: 0
      }
    }
  };
}

function sanitizeRoom(r) {
  const base = makeDefaultRoom();
  const safe = { ...base, ...(r || {}) };

  if (!Array.isArray(safe.players)) safe.players = [];
  safe.players = safe.players
    .filter(Boolean)
    .map((p) => ({
      id: normalizePid(p.id || ''),
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
  safe.maxPlayers = Math.max(safe.minPlayers, Number(safe.maxPlayers || 5), 5);
  safe.status = ['waiting', 'countdown', 'running', 'finished'].includes(safe.status)
    ? safe.status
    : 'waiting';
  safe.startAt = safe.startAt ? Number(safe.startAt) : null;
  safe.updatedAt = now();

  const rawMatch = safe.match && typeof safe.match === 'object' ? safe.match : {};
  const rawBattle = rawMatch.battle && typeof rawMatch.battle === 'object' ? rawMatch.battle : {};

  safe.match = {
    participantIds: Array.isArray(rawMatch.participantIds)
      ? rawMatch.participantIds.map((id) => normalizePid(id)).filter(Boolean)
      : [],
    lockedAt: rawMatch.lockedAt ? Number(rawMatch.lockedAt) : null,
    status: ['idle', 'countdown', 'running', 'finished'].includes(rawMatch.status)
      ? rawMatch.status
      : 'idle',
    battle: {
      finishedAt: Number(rawBattle.finishedAt || 0)
    }
  };

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
    players: {},
    match: {
      participantIds: Array.isArray(r.match?.participantIds) ? r.match.participantIds : [],
      lockedAt: r.match?.lockedAt || null,
      status: r.match?.status || 'idle',
      battle: {
        finishedAt: Number(r.match?.battle?.finishedAt || 0)
      }
    }
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
      connected: p.connected !== false
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
    clearMatchState(cur);
  }
  return cur;
}

function renderPlayers(r = room) {
  const players = r?.players || [];
  const participantSet = new Set(getMatchParticipantIds(r));
  const roundLocked = ['countdown', 'running', 'finished'].includes(r?.status);

  if (!els.playersBox) return;

  els.playersBox.innerHTML = players.map((p) => {
    const meTag = p.id === ctx.pid ? ' • คุณ' : '';
    const hostTag = p.id === r.hostId ? ' 👑 host' : '';
    const inMatchTag = roundLocked && participantSet.size && participantSet.has(p.id) ? ' • participant' : '';

    let phase = 'ยังไม่พร้อม';
    let cls = 'waiting';

    if (p.phase === 'done') {
      phase = 'รอบนี้จบแล้ว';
      cls = 'ready';
    } else if (p.phase === 'run') {
      phase = 'กำลังเล่น';
      cls = 'ready';
    } else if (p.ready) {
      phase = 'พร้อมแล้ว';
      cls = 'ready';
    }

    return `
      <div class="player">
        <div><strong>${escapeHtml(playerLabel(p))}</strong>${escapeHtml(meTag)}${escapeHtml(hostTag)}</div>
        <div class="${cls}">${escapeHtml(phase)}${escapeHtml(inMatchTag)}</div>
      </div>
    `;
  }).join('');
}

function renderButtons(r = room) {
  const me = r?.players?.find((p) => p.id === ctx.pid);

  if (els.btnReady) {
    els.btnReady.style.display = '';
    els.btnReady.disabled = !me || me.connected === false || r?.status !== 'waiting';
    els.btnReady.textContent = me?.ready ? 'ยกเลิกพร้อม' : 'พร้อมแล้ว';
  }

  if (els.btnStart) {
    els.btnStart.disabled = !isHost(r) || !canStart(r);
    els.btnStart.textContent = isHost(r) ? 'เริ่ม Battle' : 'รอ host เริ่ม';
  }
}

function renderStatus(r = room) {
  if (els.roomCode) els.roomCode.textContent = r?.roomId || '-';
  if (els.playerCount) els.playerCount.textContent = getPlayersText(r);
  if (els.roomStatus) els.roomStatus.textContent = getStatusText(r);

  const host = r?.players?.find((p) => p.id === r?.hostId);
  if (els.hostName) els.hostName.textContent = host ? playerLabel(host) : '-';

  const inviteUrl = buildInviteUrl();
  if (els.inviteLink) els.inviteLink.value = inviteUrl;
  renderQr(inviteUrl);

  if (!r) {
    setHint('กำลังสร้างห้อง...');
    if (els.countdown) els.countdown.textContent = '';
    return;
  }

  const blockReason = getJoinBlockReason(r, ctx.pid);
  showJoinGuard(blockReason);

  if (r.status === 'waiting') {
    const readyCount = readyPlayers(r).length;
    const min = r.minPlayers || 2;

    if (readyCount < min) {
      setHint(`ต้องมีผู้เล่น ready อย่างน้อย ${min} คน`);
    } else if (isHost(r)) {
      setHint('มีผู้เล่น ready ครบแล้ว กดเริ่ม Battle ได้');
    } else {
      setHint('มีผู้เล่น ready ครบแล้ว รอ host กดเริ่ม');
    }

    setCopyState('ส่ง room code หรือลิงก์นี้ให้ผู้เล่นคนอื่นเข้าร่วมได้');
    if (els.countdown) els.countdown.textContent = '';
  }

  if (r.status === 'countdown') {
    if (amIMatchParticipant(r)) {
      setHint('กำลังนับถอยหลังก่อนเริ่ม Battle');
    } else {
      setHint('รอบนี้เริ่มแล้ว แต่คุณไม่ได้อยู่ใน participant');
    }
    setCopyState('ห้องถูกล็อกแล้ว กำลังจะเริ่ม Battle', false);
  }

  if (r.status === 'running') {
    if (amIMatchParticipant(r)) {
      setHint('Battle กำลังดำเนินอยู่');
    } else {
      setHint('Battle กำลังดำเนินอยู่ และคุณไม่ได้อยู่ใน participant ของรอบนี้');
    }
    setCopyState('รอบนี้กำลังดำเนินอยู่', false);
  }

  if (r.status === 'finished') {
    setHint('รอบนี้จบแล้ว');
    setCopyState('สามารถกลับ lobby เพื่อเล่นใหม่ได้', false);
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
        roomRef.update({
          status: 'running',
          updatedAt: now(),
          'match/status': 'running'
        }).catch(() => {});
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

async function maybeEnterRunFromRoom(r = room) {
  if (!r) return;
  if (hasEnteredRun) return;
  if (r.status !== 'running') return;

  const me = r.players?.find((p) => p.id === ctx.pid);
  if (!me) return;
  if (me.phase === 'done') return;

  if (!amIMatchParticipant(r)) {
    setHint('รอบนี้เริ่มแล้ว แต่คุณไม่ได้อยู่ใน participant');
    return;
  }

  const effectiveStartAt = Number(r.startAt || now());
  await enterRun(effectiveStartAt);
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
  myPlayerRef = roomRef.child('players').child(ctx.pid);
}

async function ensureRoomExists() {
  const snap = await roomRef.once('value');
  const cur = snap.exists() ? sanitizeRoom(snapshotToRoom(snap.val())) : null;

  if (!cur) {
    const base = makeDefaultRoom();
    await roomRef.set(roomToFirebase(base));
    return;
  }

  await roomRef.set(roomToFirebase(cur));
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

  if (repaired.status === 'waiting' && repaired.match?.status !== 'idle') {
    clearMatchState(repaired);
    changed = true;
  }

  if (!repaired.players.length) {
    repairBusy = true;
    try { await roomRef.remove(); }
    finally { repairBusy = false; }
    return;
  }

  if (!changed) return;

  repairBusy = true;
  try { await roomRef.set(roomToFirebase(repaired)); }
  finally { repairBusy = false; }
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

    if (room.status === 'countdown' && room.startAt) {
      runCountdown(room.startAt);
    } else {
      cancelCountdown();
    }

    if (room.status === 'running') {
      await maybeEnterRunFromRoom(room);
    }

    await maybeRepairRoomIfNeeded(room);
  });
}

async function setupOnDisconnect() {
  if (!myPlayerRef) return;
  try {
    await myPlayerRef.onDisconnect().update({
      connected: false,
      phase: 'lobby'
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
    connected: true
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
    setHint('เฉพาะ host เท่านั้นที่เริ่มได้');
    return;
  }

  const participants = readyPlayers(cur);
  const participantIds = participants.map((p) => p.id).filter(Boolean);

  if (participantIds.length < (cur.minPlayers || 2)) {
    setHint(`ต้องมีผู้เล่น ready อย่างน้อย ${cur.minPlayers || 2} คน`);
    return;
  }

  const startAt = now() + 4000;

  await roomRef.update({
    status: 'countdown',
    startAt,
    updatedAt: now(),
    match: {
      participantIds,
      lockedAt: now(),
      status: 'countdown',
      battle: {
        finishedAt: 0
      }
    }
  });
}

async function enterRun(startAt) {
  if (hasEnteredRun) return;
  hasEnteredRun = true;

  try { await myPlayerRef?.onDisconnect().cancel(); } catch {}

  await updateMe({
    ready: true,
    phase: 'run',
    connected: true,
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
    mode: 'battle',
    roomId: ctx.roomId,
    startAt: String(startAt || now())
  });

  location.href = `./goodjunk-battle-run.html?v=20260320-battle-lobby-ready2-max5-qr&${q.toString()}`;
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
    clearMatchState(next);
    next.players = next.players.map((p) => ({
      ...p,
      ready: false,
      phase: 'lobby'
    }));
  } else {
    clearMatchState(next);
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

  const nextReady = !me.ready;

  await updateMe({
    ready: nextReady,
    phase: 'lobby',
    connected: true
  });

  setHint(nextReady ? 'ตั้งสถานะพร้อมแล้ว' : 'ยกเลิกสถานะพร้อมแล้ว');
}

async function onStartClick() {
  await beginCountdown();
}

async function onBackClick() {
  try { await leaveRoom(); } catch {}
  location.href = ctx.hub || '../hub.html';
}

async function onCopyRoomClick() {
  const ok = await copyText(ctx.roomId);
  setCopyState(ok ? `คัดลอก Room Code แล้ว: ${ctx.roomId}` : 'คัดลอก Room Code ไม่สำเร็จ', ok);
}

async function onCopyInviteClick() {
  const link = buildInviteUrl();
  const ok = await copyText(link);
  setCopyState(ok ? 'คัดลอก Invite Link แล้ว' : 'คัดลอก Invite Link ไม่สำเร็จ', ok);
}

function bindEvents() {
  els.btnReady?.addEventListener('click', onReadyClick);
  els.btnStart?.addEventListener('click', onStartClick);
  els.btnBack?.addEventListener('click', onBackClick);
  els.btnCopyRoom?.addEventListener('click', onCopyRoomClick);
  els.btnCopyInvite?.addEventListener('click', onCopyInviteClick);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') touchPresence();
  });

  window.addEventListener('focus', () => {
    touchPresence();
  });

  window.addEventListener('beforeunload', () => {
    stopPresenceHeartbeat();
  });
}

async function boot() {
  try {
    setHint('กำลังเชื่อม Firebase...');
    await ensureFirebase();

    setHint('กำลังสร้าง/เชื่อมห้อง...');
    await ensureRoomExists();
    subscribeRoom();
    const joined = await ensureJoined();

    render();
    bindEvents();

    if (!joined) {
      if (els.btnReady) els.btnReady.disabled = true;
      if (els.btnStart) els.btnStart.disabled = true;
      return;
    }

    await touchPresence();
    startPresenceHeartbeat();

    if (room?.status === 'countdown' && room.startAt) runCountdown(room.startAt);
    if (room?.status === 'running') await maybeEnterRunFromRoom(room);
  } catch (err) {
    console.error('[goodjunk-battle-lobby] boot failed:', err);
    setHint(`เชื่อม Firebase ไม่สำเร็จ: ${String(err?.message || err)}`);
    if (els.btnReady) els.btnReady.disabled = true;
    if (els.btnStart) els.btnStart.disabled = true;
  }
}

boot();