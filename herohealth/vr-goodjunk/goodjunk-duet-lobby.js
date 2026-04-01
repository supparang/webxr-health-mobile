/* /herohealth/vr-goodjunk/goodjunk-duet-lobby.js
   FULL PATCH v20260331-GJ-DUET-LOBBY-R5
   - แก้ maxretry ตอน join ห้อง
   - ไม่ใช้ root transaction สำหรับ join ปกติ
   - create room เฉพาะตอนห้องยังไม่มี
   - rematch recovery finished -> waiting แข็งขึ้น
   - rematch entry auto-ready + auto-start
   - countdown redirect เข้า run
*/

(function(){
  'use strict';

  const W = window;
  const D = document;
  const $ = (id) => D.getElementById(id);

  const DEBUG = (() => {
    try{
      return new URL(W.location.href).searchParams.get('debug') === '1';
    }catch{
      return false;
    }
  })();

  const els = {
    roomCode         : $('roomCode'),
    playerCount      : $('playerCount'),
    roomStatus       : $('roomStatus'),
    hostName         : $('hostName'),
    playersBox       : $('playersBox'),
    copyState        : $('copyState'),
    joinGuard        : $('joinGuard'),
    inviteLink       : $('inviteLink'),
    qrBox            : $('qrBox'),
    countdown        : $('countdown'),
    btnCopyRoom      : $('btnCopyRoom'),
    btnCopyInvite    : $('btnCopyInvite'),
    btnReady         : $('btnReady'),
    btnUnready       : $('btnUnready'),
    btnStart         : $('btnStart'),
    btnBack          : $('btnBack'),
    hint             : $('hint'),
    roomInput        : $('roomInput'),
    btnJoinByCode    : $('btnJoinByCode'),
    btnUseCurrentRoom: $('btnUseCurrentRoom'),
    btnNewRoom       : $('btnNewRoom')
  };

  const GAME_KEY = 'goodjunk';
  const MODE_KEY = 'duet';
  const ROOM_SIZE = 2;
  const COUNTDOWN_MS = 4000;
  const STALE_MS = 20000;
  const HEARTBEAT_MS = 8000;

  const qs = (...keys) => {
    try{
      const sp = new URL(W.location.href).searchParams;
      for (const k of keys){
        const v = sp.get(k);
        if (v != null && String(v).trim() !== '') return String(v).trim();
      }
    }catch{}
    return '';
  };

  const clamp = (v, a, b) => {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  };

  const now = () => Date.now();

  function fireAndForget(p){
    try{
      Promise.resolve(p).catch((err) => {
        console.warn('[duet.lobby] ignored async error:', err);
      });
    }catch(err){
      console.warn('[duet.lobby] fireAndForget failed:', err);
    }
  }

  function safeReplace(nextHref){
    try{
      W.location.replace(nextHref);
    }catch(_){
      W.location.href = nextHref;
    }
  }

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeRoomId(raw){
    return String(raw || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8);
  }

  function randomRoomId(){
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    if (W.crypto && W.crypto.getRandomValues){
      const arr = new Uint8Array(6);
      W.crypto.getRandomValues(arr);
      for (let i = 0; i < arr.length; i++) out += chars[arr[i] % chars.length];
      return out;
    }
    for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  function makeDevicePid(){
    try{
      const KEY = 'GJ_DEVICE_PID';
      let pid = localStorage.getItem(KEY);
      if (!pid){
        pid = 'p-' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(KEY, pid);
      }
      return pid;
    }catch{
      return 'p-' + Math.random().toString(36).slice(2, 10);
    }
  }

  function normalizePid(raw){
    const v = String(raw || '').trim().replace(/[.#$[\]/]/g, '-');
    if (!v || v.toLowerCase() === 'anon') return makeDevicePid();
    return v.slice(0, 80);
  }

  function cleanDiff(raw){
    raw = String(raw || 'normal').toLowerCase();
    return (raw === 'easy' || raw === 'hard') ? raw : 'normal';
  }

  function roomPath(roomId){
    return `hha-battle/${GAME_KEY}/duetRooms/${roomId}`;
  }

  function isProbablyAlive(p){
    if (!p) return false;
    const seen = Number(p.lastSeenAt || 0);
    if (p.connected !== false) return true;
    return (now() - seen) <= STALE_MS;
  }

  function activePlayers(room){
     const src = room && room.players ? room.players : {};
     return Object.keys(src)
    .map((id) => Object.assign({ id }, src[id] || {}))
    .filter((p) => p.phase !== 'left');
  }

  function readyPlayers(room){
    return activePlayers(room).filter((p) => !!p.ready);
  }

  function participantIds(room){
    const ids = (((room || {}).match || {}).participantIds || []);
    return Array.isArray(ids) ? ids.filter(Boolean) : [];
  }

  function getCurrentParticipantIds(room){
    const ids = participantIds(room);
    if (ids.length) return ids;
    const players = activePlayers(room).map((p) => p.id);
    return players.slice(0, 2);
  }

  function getRematchInfo(room){
    const ids = getCurrentParticipantIds(room);
    const votes = (room && room.rematch) ? room.rematch : {};
    let count = 0;

    ids.forEach((id) => {
      if (votes[id] && votes[id].ready) count += 1;
    });

    return { ids, count, votes };
  }

  function prunePlayers(players, status){
    const out = {};
    const src = players || {};
    Object.keys(src).forEach((id) => {
      const p = src[id] || {};
      const shouldDrop =
        p.phase === 'left' ||
        (String(status || 'waiting') === 'waiting' &&
         p.connected === false &&
         (now() - Number(p.lastSeenAt || 0) > STALE_MS));

      if (!shouldDrop) out[id] = p;
    });
    return out;
  }

  const STATE = {
    roomId: normalizeRoomId(qs('room', 'roomCode', 'roomId', 'code')) || randomRoomId(),
    pid: normalizePid(qs('pid') || ''),
    name: (() => {
      const fromQs = qs('name', 'nick', 'playerName');
      if (fromQs) return fromQs.slice(0, 64);
      try{
        return String(localStorage.getItem('HHA_PLAYER_NICK') || 'Player').slice(0, 64);
      }catch{
        return 'Player';
      }
    })(),
    hub: qs('hub') || '../hub.html',
    view: (qs('view') || 'mobile').toLowerCase(),
    run: (qs('run') || 'play').toLowerCase(),
    diff: cleanDiff(qs('diff') || 'normal'),
    time: clamp(qs('time') || 150, 30, 300),
    seed: String(qs('seed') || now()),
    zone: qs('zone') || 'nutrition',
    theme: qs('theme') || 'goodjunk',

    uid: '',
    db: null,
    auth: null,
    roomRef: null,
    meRef: null,

    room: null,
    joined: false,
    joinDenied: false,
    joinDeniedReason: '',
    heartbeatTimer: 0,
    countdownTimer: 0,
    redirected: false,
    repairingHost: false,

    rematchEntry: (() => {
      try{
        return new URL(W.location.href).searchParams.get('rematch') === '1';
      }catch{
        return false;
      }
    })(),
    autoReadyDone: false,
    autoStartAttempted: false,
    autoStartLocked: false,
    rematchRecoveryRunning: false
  };

  let __duetAutoStartTimer = 0;

  try{ localStorage.setItem('HHA_PLAYER_PID', STATE.pid); }catch{}
  try{ localStorage.setItem('HHA_PLAYER_NICK', STATE.name); }catch{}

  function stopAutoStartTimer(){
    if (__duetAutoStartTimer){
      clearTimeout(__duetAutoStartTimer);
      __duetAutoStartTimer = 0;
    }
  }

  function setCopyState(msg, isBad){
    if (!els.copyState) return;
    els.copyState.textContent = msg || '';
    els.copyState.style.color = isBad ? '#fca5a5' : '';
  }

  function setHint(msg, isBad){
    if (!els.hint) return;
    els.hint.textContent = msg || '';
    els.hint.style.color = isBad ? '#fca5a5' : '';
  }

  function showJoinGuard(msg){
    STATE.joinDenied = true;
    STATE.joinDeniedReason = msg || 'ห้องนี้ยังเข้าไม่ได้';
    if (els.joinGuard){
      els.joinGuard.style.display = 'block';
      els.joinGuard.textContent = STATE.joinDeniedReason;
    }
    setHint(STATE.joinDeniedReason, true);
  }

  function hideJoinGuard(){
    STATE.joinDenied = false;
    STATE.joinDeniedReason = '';
    if (els.joinGuard) els.joinGuard.style.display = 'none';
  }

  function buildInviteLink(){
    const u = new URL(W.location.href);
    u.search = '';
    u.searchParams.set('room', STATE.roomId);
    u.searchParams.set('roomId', STATE.roomId);
    if (STATE.pid) u.searchParams.set('pid', STATE.pid);
    if (STATE.name){
      u.searchParams.set('name', STATE.name);
      u.searchParams.set('nick', STATE.name);
    }
    if (STATE.hub) u.searchParams.set('hub', STATE.hub);
    if (STATE.diff) u.searchParams.set('diff', STATE.diff);
    if (STATE.time) u.searchParams.set('time', String(STATE.time));
    if (STATE.view) u.searchParams.set('view', STATE.view);
    if (STATE.run) u.searchParams.set('run', STATE.run);
    if (STATE.zone) u.searchParams.set('zone', STATE.zone);
    if (STATE.theme) u.searchParams.set('theme', STATE.theme);
    if (DEBUG) u.searchParams.set('debug', '1');
    return u.toString();
  }

  function buildLobbyUrlWithRoom(roomId){
    const u = new URL(W.location.href);
    const cleanRoom = normalizeRoomId(roomId);
    u.searchParams.set('room', cleanRoom);
    u.searchParams.set('roomId', cleanRoom);

    if (STATE.pid) u.searchParams.set('pid', STATE.pid);
    if (STATE.name){
      u.searchParams.set('name', STATE.name);
      u.searchParams.set('nick', STATE.name);
    }
    if (STATE.hub) u.searchParams.set('hub', STATE.hub);
    if (STATE.view) u.searchParams.set('view', STATE.view);
    if (STATE.run) u.searchParams.set('run', STATE.run);
    if (STATE.diff) u.searchParams.set('diff', STATE.diff);
    if (STATE.time) u.searchParams.set('time', String(STATE.time));
    if (STATE.zone) u.searchParams.set('zone', STATE.zone);
    if (STATE.theme) u.searchParams.set('theme', STATE.theme);
    if (DEBUG) u.searchParams.set('debug', '1');

    u.searchParams.set('seed', String(Date.now()));
    u.searchParams.delete('rematch');
    return u.toString();
  }

  function buildRunUrl(room){
    const u = new URL('./goodjunk-duet-play.html', W.location.href);
    u.searchParams.set('mode', MODE_KEY);
    u.searchParams.set('game', GAME_KEY);
    u.searchParams.set('room', STATE.roomId);
    u.searchParams.set('roomId', STATE.roomId);
    u.searchParams.set('pid', STATE.pid);
    u.searchParams.set('name', STATE.name);
    u.searchParams.set('nick', STATE.name);
    u.searchParams.set('diff', String(room.diff || STATE.diff));
    u.searchParams.set('time', String(room.time || STATE.time));
    u.searchParams.set('seed', String(room.seed || STATE.seed));
    u.searchParams.set('hub', String(room.hub || STATE.hub));
    u.searchParams.set('view', String(room.view || STATE.view));
    u.searchParams.set('run', String(room.run || STATE.run));
    u.searchParams.set('zone', String(room.zone || STATE.zone));
    u.searchParams.set('theme', String(room.theme || STATE.theme));
    u.searchParams.set('startAt', String(room.startAt || 0));
    if (DEBUG) u.searchParams.set('debug', '1');
    return u.toString();
  }

  function goJoinRoomByCode(raw){
    const roomId = normalizeRoomId(raw);
    if (!roomId){
      setHint('กรุณาใส่ Room Code ก่อน', true);
      if (els.roomInput) els.roomInput.focus();
      return;
    }
    safeReplace(buildLobbyUrlWithRoom(roomId));
  }

  function goCreateNewRoom(){
    safeReplace(buildLobbyUrlWithRoom(randomRoomId()));
  }

  function renderQr(url){
    if (!els.qrBox) return;
    if (!url){
      els.qrBox.innerHTML = '<div class="qr-empty">ยังไม่มีลิงก์</div>';
      return;
    }
    const src = 'https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=' + encodeURIComponent(url);
    els.qrBox.innerHTML = `<img alt="QR Invite" src="${src}">`;
  }

  async function copyText(txt){
    try{
      if (navigator.clipboard && navigator.clipboard.writeText){
        await navigator.clipboard.writeText(txt);
        return true;
      }
    }catch{}
    try{
      const ta = D.createElement('textarea');
      ta.value = txt;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      D.body.appendChild(ta);
      ta.select();
      const ok = D.execCommand('copy');
      ta.remove();
      return !!ok;
    }catch{
      return false;
    }
  }

  function renderPlayers(room){
    if (!els.playersBox) return;

    const list = activePlayers(room);
    list.sort((a, b) => {
      const ah = a.id === (room && room.hostId) ? 1 : 0;
      const bh = b.id === (room && room.hostId) ? 1 : 0;
      if (ah !== bh) return bh - ah;
      const am = a.id === STATE.uid ? 1 : 0;
      const bm = b.id === STATE.uid ? 1 : 0;
      if (am !== bm) return bm - am;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

    const cards = list.map((p) => {
      const isMe = p.id === STATE.uid;
      const isHost = room && p.id === room.hostId;
      const online = isProbablyAlive(p);
      const ready = !!p.ready;

      const badge = ready
        ? '<span class="ready">พร้อมแล้ว</span>'
        : (online ? '<span class="waiting">รอพร้อม</span>' : '<span class="offline">offline</span>');

      const meta = [
        isHost ? 'Host' : '',
        isMe ? 'You' : '',
        p.pid ? ('PID: ' + esc(p.pid)) : ''
      ].filter(Boolean).join(' • ');

      return `
        <div class="player ${isMe ? 'me' : ''}">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
            <div style="font-weight:900;font-size:16px;color:#f8fafc;">${esc(p.name || 'Player')}</div>
            <div>${badge}</div>
          </div>
          <div style="margin-top:6px;color:#cbd5e1;font-size:13px;line-height:1.55;">${esc(meta || 'ผู้เล่น')}</div>
          <div style="margin-top:8px;color:#94a3b8;font-size:12px;line-height:1.55;">phase: ${esc(p.phase || 'lobby')}</div>
        </div>
      `;
    });

    while (cards.length < ROOM_SIZE){
      cards.push(`
        <div class="player">
          <div style="font-weight:900;font-size:16px;color:#f8fafc;">รอผู้เล่น...</div>
          <div style="margin-top:6px;color:#94a3b8;font-size:13px;line-height:1.55;">
            แชร์ room code หรือลิงก์ให้เพื่อนอีกคน
          </div>
        </div>
      `);
    }

    els.playersBox.innerHTML = cards.join('');
  }

  function updateButtons(room){
    const me = room && room.players ? room.players[STATE.uid] : null;
    const players = activePlayers(room);
    const readyCount = readyPlayers(room).length;
    const amHost = !!room && room.hostId === STATE.uid;
    const waitingOnly = !!room && String(room.status || 'waiting') === 'waiting';
    const fullEnough = players.length === ROOM_SIZE;

    if (els.btnReady) els.btnReady.disabled = !waitingOnly || !me || !!me.ready || STATE.joinDenied;
    if (els.btnUnready) els.btnUnready.disabled = !waitingOnly || !me || !me.ready || STATE.joinDenied;
    if (els.btnStart) els.btnStart.disabled = !waitingOnly || !amHost || !fullEnough || readyCount !== ROOM_SIZE || STATE.joinDenied;

    if (STATE.joinDenied){
      setHint(STATE.joinDeniedReason || 'ห้องนี้ยังเข้าไม่ได้', true);
      return;
    }

    if (!room){
      setHint(STATE.rematchEntry ? 'กำลังเชื่อมห้องรีแมตช์...' : 'กำลังเชื่อมห้อง...', false);
      return;
    }

    const status = String(room.status || 'waiting');
    const rematchInfo = getRematchInfo(room);

    if (status === 'countdown'){
      setHint('กำลังนับถอยหลังเพื่อเข้าเกมพร้อมกัน', false);
      return;
    }

    if (status === 'running'){
      setHint('กำลังพาเข้าสู่ GoodJunk Duet Run...', false);
      return;
    }

    if (status === 'finished'){
      if (rematchInfo.count >= ROOM_SIZE){
        setHint('รีแมตช์ครบแล้ว กำลังเตรียมห้องรอบใหม่...', false);
      } else {
        setHint('รอบก่อนหน้าจบแล้ว รอรีแมตช์หรือสร้างห้องใหม่', false);
      }
      return;
    }

    if (STATE.rematchEntry && readyCount === ROOM_SIZE && amHost){
      setHint('รีแมตช์พร้อมแล้ว กำลังเริ่มอัตโนมัติ...', false);
      return;
    }

    if (!amHost){
      if (readyCount < ROOM_SIZE){
        setHint('รอให้พร้อมครบ 2 คนก่อน จากนั้น Host จะกดเริ่มได้', false);
      } else {
        setHint('พร้อมครบแล้ว รอ Host กดเริ่ม Duet', false);
      }
      return;
    }

    if (players.length < ROOM_SIZE){
      setHint('ยังไม่ครบ 2 คน แชร์ลิงก์หรือ QR ให้เพื่อนเข้ามาอีก 1 คน', false);
      return;
    }

    if (readyCount < ROOM_SIZE){
      setHint('ต้องมีผู้เล่นพร้อมครบ 2 คนก่อนเริ่ม Duet', false);
      return;
    }

    setHint('พร้อมครบ 2/2 แล้ว Host กด “เริ่ม Duet” ได้เลย', false);
  }

  function stopCountdownLoop(){
    if (STATE.countdownTimer){
      clearInterval(STATE.countdownTimer);
      STATE.countdownTimer = 0;
    }
  }

  async function markRunningIfHost(room){
    if (!room || !STATE.roomRef) return;
    if (room.hostId !== STATE.uid) return;
    if (String(room.status || 'waiting') !== 'countdown') return;
    if (Number(room.startAt || 0) > now()) return;

    try{
      await STATE.roomRef.update({
        status: 'running',
        updatedAt: firebase.database.ServerValue.TIMESTAMP
      });
      await STATE.roomRef.child('match/status').set('running');
    }catch{}
  }

  function startCountdownLoop(room){
    stopCountdownLoop();

    const ids = participantIds(room);
    const amParticipant = ids.includes(STATE.uid);
    const startAt = Number(room.startAt || 0);

    if (!amParticipant || !startAt){
      if (els.countdown) els.countdown.textContent = '';
      return;
    }

    STATE.countdownTimer = setInterval(async () => {
      const ms = startAt - now();

      if (ms <= 0){
        if (els.countdown) els.countdown.textContent = 'GO!';
        stopCountdownLoop();
        await markRunningIfHost(room);
        if (!STATE.redirected){
          STATE.redirected = true;
          safeReplace(buildRunUrl(room));
        }
        return;
      }

      if (els.countdown) els.countdown.textContent = String(Math.ceil(ms / 1000));
    }, 80);
  }

  function maybeHandleCountdown(room){
    if (!room){
      stopCountdownLoop();
      if (els.countdown) els.countdown.textContent = '';
      return;
    }

    const status = String(room.status || 'waiting');
    const ids = participantIds(room);
    const amParticipant = ids.includes(STATE.uid);

    if ((status === 'countdown' || status === 'running') && amParticipant){
      if (status === 'running'){
        if (els.countdown) els.countdown.textContent = 'GO!';
        if (!STATE.redirected){
          STATE.redirected = true;
          setTimeout(() => safeReplace(buildRunUrl(room)), 150);
        }
        return;
      }
      startCountdownLoop(room);
      return;
    }

    stopCountdownLoop();
    if (els.countdown) els.countdown.textContent = '';
  }

  async function maybeRepairHost(room){
    if (STATE.repairingHost || !room) return;
    if (String(room.status || 'waiting') !== 'waiting') return;

    const host = room.players && room.players[room.hostId] ? room.players[room.hostId] : null;
    if (host && isProbablyAlive(host) && host.phase !== 'left') return;

    const players = activePlayers(room).filter((p) => isProbablyAlive(p));
    if (!players.length) return;

    players.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const nextHost = players[0];
    if (!nextHost || nextHost.id !== STATE.uid) return;

    STATE.repairingHost = true;
    try{
      await STATE.roomRef.update({
        hostId: nextHost.id,
        hostName: nextHost.name || 'Host',
        updatedAt: firebase.database.ServerValue.TIMESTAMP
      });
    }catch{}
    finally{
      STATE.repairingHost = false;
    }
  }

  function pickRecoveryHost(room){
    const players = activePlayers(room).filter(Boolean);
    if (!players.length) return null;

    players.sort((a, b) => {
      const aLive = isProbablyAlive(a) ? 1 : 0;
      const bLive = isProbablyAlive(b) ? 1 : 0;
      if (aLive !== bLive) return bLive - aLive;

      const aMe = a.id === STATE.uid ? 1 : 0;
      const bMe = b.id === STATE.uid ? 1 : 0;
      if (aMe !== bMe) return bMe - aMe;

      const aj = Number(a.joinedAt || 0);
      const bj = Number(b.joinedAt || 0);
      if (aj !== bj) return aj - bj;

      return String(a.id || '').localeCompare(String(b.id || ''));
    });

    return players[0] || null;
  }

  async function recoverFinishedRoomForRematch(room){
    if (!room || !STATE.roomRef || STATE.rematchRecoveryRunning) return false;

    const status = String(room.status || 'waiting');
    if (status !== 'finished') return false;

    const info = getRematchInfo(room);
    if (info.ids.length !== ROOM_SIZE) return false;
    if (info.count < ROOM_SIZE) return false;

    const host = room.players && room.players[room.hostId] ? room.players[room.hostId] : null;
    const chosenHost = (host && isProbablyAlive(host)) ? host : pickRecoveryHost(room);

    if (!chosenHost) return false;
    if (chosenHost.id !== STATE.uid) return false;

    STATE.rematchRecoveryRunning = true;

    try{
      const t = now();
      const updates = {
        status: 'waiting',
        startAt: 0,
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
        seed: String(t),
        hostId: chosenHost.id,
        hostName: chosenHost.name || 'Host',
        rematch: null,
        'match/status': 'idle',
        'match/lockedAt': 0,
        'match/finishedAt': 0,
        'match/participantIds': null
      };

      info.ids.forEach((id) => {
        updates[`players/${id}/ready`] = false;
        updates[`players/${id}/phase`] = 'lobby';
        updates[`players/${id}/finished`] = false;
        updates[`players/${id}/finalScore`] = 0;
        updates[`players/${id}/miss`] = 0;
        updates[`players/${id}/streak`] = 0;
        updates[`players/${id}/finishedAt`] = 0;
        updates[`players/${id}/connected`] = true;
        updates[`players/${id}/lastSeenAt`] = firebase.database.ServerValue.TIMESTAMP;
      });

      await STATE.roomRef.update(updates);

      STATE.autoReadyDone = false;
      STATE.autoStartAttempted = false;
      STATE.autoStartLocked = false;
      stopAutoStartTimer();

      return true;
    }catch(err){
      console.error('[duet.lobby] recoverFinishedRoomForRematch failed:', err);
      return false;
    }finally{
      STATE.rematchRecoveryRunning = false;
    }
  }

  let __lobbyDebugLastPaint = 0;
  function ensureLobbyDebugBox(){
    if (!DEBUG) return null;
    let el = D.getElementById('duetLobbyDebugBox');
    if (el) return el;

    el = D.createElement('div');
    el.id = 'duetLobbyDebugBox';
    el.style.cssText = [
      'position:fixed',
      'left:10px',
      'right:10px',
      'bottom:10px',
      'z-index:9999',
      'padding:10px 12px',
      'border-radius:14px',
      'border:1px solid rgba(244,114,182,.28)',
      'background:rgba(2,6,23,.92)',
      'color:#f8fafc',
      'font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace',
      'box-shadow:0 18px 40px rgba(0,0,0,.28)',
      'white-space:pre-wrap',
      'word-break:break-word',
      'backdrop-filter:blur(8px)',
      'max-height:40vh',
      'overflow:auto'
    ].join(';');

    D.body.appendChild(el);
    return el;
  }

  function renderLobbyDebug(room){
    if (!DEBUG) return;
    const t = now();
    if (t - __lobbyDebugLastPaint < 120) return;
    __lobbyDebugLastPaint = t;

    const el = ensureLobbyDebugBox();
    if (!el) return;

    const players = activePlayers(room);
    const ready = readyPlayers(room);
    const ids = participantIds(room);
    const me = room && room.players ? room.players[STATE.uid] : null;
    const rematchInfo = getRematchInfo(room);

    const lines = [
      '[DUET LOBBY DEBUG]',
      `room=${STATE.roomId}`,
      `uid=${STATE.uid || '-'}`,
      `pid=${STATE.pid || '-'}`,
      `name=${STATE.name || '-'}`,
      `status=${room ? String(room.status || 'waiting') : '-'}`,
      `host=${room ? String(room.hostId || '-') : '-'}`,
      `players=${players.length}/${ROOM_SIZE}`,
      `ready=${ready.length}/${ROOM_SIZE}`,
      `participantIds=${ids.length ? ids.join(', ') : '-'}`,
      `rematchCount=${rematchInfo.count}/${ROOM_SIZE}`,
      `startAt=${room ? Number(room.startAt || 0) : 0}`,
      `joined=${STATE.joined ? 'yes' : 'no'}`,
      `joinDenied=${STATE.joinDenied ? 'yes' : 'no'}`,
      `myReady=${me ? (!!me.ready) : '-'}`,
      `myPhase=${me ? String(me.phase || '-') : '-'}`,
      `rematchEntry=${STATE.rematchEntry}`,
      `autoReadyDone=${STATE.autoReadyDone}`,
      `autoStartAttempted=${STATE.autoStartAttempted}`,
      '',
      '[PLAYERS]'
    ];

    players.forEach((p, idx) => {
      lines.push(
        `${idx + 1}. ${String(p.name || 'Player')} | uid=${p.id} | ready=${!!p.ready} | connected=${p.connected !== false} | phase=${String(p.phase || '-')}`
      );
    });

    el.textContent = lines.join('\n');
  }

  function canAutoStartRematch(room){
    if (!room) return false;
    if (!STATE.rematchEntry) return false;
    if (STATE.joinDenied) return false;

    const status = String(room.status || 'waiting');
    if (status !== 'waiting') return false;

    const players = activePlayers(room);
    const ready = readyPlayers(room);
    const me = room.players ? room.players[STATE.uid] : null;
    const amHost = room.hostId === STATE.uid;

    if (!amHost) return false;
    if (!me) return false;
    if (players.length !== ROOM_SIZE) return false;
    if (ready.length !== ROOM_SIZE) return false;

    return true;
  }

  async function maybeAutoReady(room){
    if (!STATE.rematchEntry) return;
    if (STATE.autoReadyDone) return;
    if (!room || !room.players || !room.players[STATE.uid]) return;
    if (String(room.status || 'waiting') !== 'waiting') return;

    const me = room.players[STATE.uid];
    if (me.ready){
      STATE.autoReadyDone = true;
      return;
    }

    STATE.autoReadyDone = true;

    try{
      await setReady(true);
      setHint('รีแมตช์รอบใหม่: ตั้งเป็นพร้อมให้อัตโนมัติแล้ว', false);
    }catch(err){
      STATE.autoReadyDone = false;
      setHint('ตั้งพร้อมอัตโนมัติไม่สำเร็จ: ' + (err && err.message ? err.message : 'unknown'), true);
    }
  }

  function maybeAutoStartRematch(room){
    if (!canAutoStartRematch(room)) return;
    if (STATE.autoStartAttempted || STATE.autoStartLocked) return;

    STATE.autoStartLocked = true;
    stopAutoStartTimer();

    setHint('พร้อมครบแล้ว กำลังเริ่มรีแมตช์อัตโนมัติ...', false);

    __duetAutoStartTimer = setTimeout(async () => {
      STATE.autoStartLocked = false;
      if (STATE.autoStartAttempted) return;

      const latestSnap = await STATE.roomRef.once('value');
      const latestRoom = latestSnap && latestSnap.val ? latestSnap.val() : null;
      if (!latestRoom) return;

      const latestStatus = String(latestRoom.status || 'waiting');
      const latestPlayers = activePlayers(latestRoom);
      const latestReady = readyPlayers(latestRoom);

      if (latestStatus !== 'waiting') return;
      if (latestRoom.hostId !== STATE.uid) return;
      if (latestPlayers.length !== ROOM_SIZE) return;
      if (latestReady.length !== ROOM_SIZE) return;

      STATE.autoStartAttempted = true;

      try{
        await startDuet();
      }catch(err){
        STATE.autoStartAttempted = false;
        setHint('เริ่มรีแมตช์อัตโนมัติไม่สำเร็จ: ' + (err && err.message ? err.message : 'unknown'), true);
      }
    }, 700);
  }

  function renderRoom(room){
    STATE.room = room || null;

    if (els.roomCode) els.roomCode.textContent = `ROOM: ${STATE.roomId}`;
    if (els.inviteLink) els.inviteLink.value = buildInviteLink();
    if (els.roomInput && D.activeElement !== els.roomInput){
      els.roomInput.value = STATE.roomId || '';
    }
    renderQr(buildInviteLink());

    if (!room){
      if (els.playerCount) els.playerCount.textContent = '0/2';
      if (els.roomStatus) els.roomStatus.textContent = 'waiting';
      if (els.hostName) els.hostName.textContent = '-';
      renderPlayers(null);
      updateButtons(null);
      renderLobbyDebug(null);
      return;
    }

    const players = activePlayers(room);
    const status = String(room.status || 'waiting');
    const host = room.players && room.players[room.hostId] ? room.players[room.hostId] : null;
    const rematchInfo = getRematchInfo(room);

    if (els.playerCount) els.playerCount.textContent = `${players.length}/${ROOM_SIZE}`;
    if (els.roomStatus) els.roomStatus.textContent = status;
    if (els.hostName) els.hostName.textContent = host ? (host.name || 'Host') : '-';

    renderPlayers(room);
    updateButtons(room);
    maybeRepairHost(room);
    maybeHandleCountdown(room);

    if (status === 'finished' && rematchInfo.count >= ROOM_SIZE){
      fireAndForget(recoverFinishedRoomForRematch(room));
    }

    if (status === 'waiting'){
      STATE.redirected = false;
    }

    maybeAutoReady(room);
    maybeAutoStartRematch(room);
    renderLobbyDebug(room);
  }

  async function ensureFirebaseReady(){
    if (!W.firebase || !firebase.apps || !firebase.apps.length){
      throw new Error('Firebase ยังไม่ถูก initialize จาก firebase-config.js');
    }
    if (typeof firebase.database !== 'function'){
      throw new Error('firebase-database.js ไม่พร้อม');
    }
    if (typeof firebase.auth !== 'function'){
      throw new Error('ยังไม่ได้โหลด firebase-auth.js');
    }

    STATE.db = firebase.database();
    STATE.auth = firebase.auth();

    if (STATE.auth.currentUser){
      STATE.uid = STATE.auth.currentUser.uid;
      return STATE.auth.currentUser;
    }

    const cred = await STATE.auth.signInAnonymously();
    const user = cred && cred.user ? cred.user : STATE.auth.currentUser;
    if (!user) throw new Error('Anonymous auth failed');
    STATE.uid = user.uid;
    return user;
  }

  function freshPlayer(uid){
    const t = now();
    return {
      id: uid,
      uid: uid,
      pid: STATE.pid,
      name: STATE.name,
      ready: false,
      connected: true,
      phase: 'lobby',
      finished: false,
      finalScore: 0,
      miss: 0,
      streak: 0,
      joinedAt: t,
      lastSeenAt: t,
      finishedAt: 0
    };
  }

  function freshRoom(uid){
    const t = now();
    const me = freshPlayer(uid);
    const room = {
      roomId: STATE.roomId,
      game: GAME_KEY,
      mode: MODE_KEY,
      hostId: uid,
      hostName: me.name || 'Host',
      diff: STATE.diff,
      time: Number(STATE.time),
      seed: String(STATE.seed),
      view: STATE.view,
      hub: STATE.hub,
      run: STATE.run,
      zone: STATE.zone,
      theme: STATE.theme,
      status: 'waiting',
      minPlayers: 2,
      maxPlayers: 2,
      startAt: 0,
      createdAt: t,
      updatedAt: t,
      match: {
        participantIds: [],
        lockedAt: 0,
        status: 'idle'
      },
      players: {}
    };
    room.players[uid] = me;
    return room;
  }

  async function ensureRoomExistsOrCreate(){
    const firstSnap = await STATE.roomRef.once('value');
    const firstRoom = firstSnap && firstSnap.val ? firstSnap.val() : null;
    if (firstRoom) return firstRoom;

    await new Promise((resolve, reject) => {
      STATE.roomRef.transaction((current) => {
        if (current) return current;
        return freshRoom(STATE.uid);
      }, (err, committed, postSnap) => {
        if (err) return reject(err);
        if (!committed) return reject(new Error('create-room-aborted'));
        return resolve(postSnap && postSnap.val ? postSnap.val() : null);
      }, false);
    });

    const secondSnap = await STATE.roomRef.once('value');
    return secondSnap && secondSnap.val ? secondSnap.val() : null;
  }

  async function readJoinableRoom(){
    const snap = await STATE.roomRef.once('value');
    const room = snap && snap.val ? snap.val() : null;
    if (!room) throw new Error('room-not-found-after-create');

    const players = prunePlayers(room.players, room.status || 'waiting');
    const ids = Object.keys(players || {});
    const hasMe = !!players[STATE.uid];
    const status = String(room.status || 'waiting');

    if (!hasMe && ids.length >= ROOM_SIZE){
      throw new Error('room-full');
    }

    if (!hasMe && status !== 'waiting' && status !== 'finished'){
      throw new Error('room-not-joinable');
    }

    return Object.assign({}, room, { players });
  }

  async function joinRoom(){
    STATE.roomRef = STATE.db.ref(roomPath(STATE.roomId));
    STATE.meRef = STATE.roomRef.child('players/' + STATE.uid);

    await ensureRoomExistsOrCreate();
    const room = await readJoinableRoom();

    const players = room.players || {};
    const prev = players[STATE.uid] || {};
    const status = String(room.status || 'waiting');

    hideJoinGuard();

    const rootUpdates = {};

    if (!room.hostId || !players[room.hostId]){
      rootUpdates.hostId = STATE.uid;
      rootUpdates.hostName = STATE.name || 'Host';
    }

    if (!room.roomId) rootUpdates.roomId = STATE.roomId;
    if (!room.game) rootUpdates.game = GAME_KEY;
    if (!room.mode) rootUpdates.mode = MODE_KEY;
    if (room.minPlayers == null) rootUpdates.minPlayers = 2;
    if (room.maxPlayers == null) rootUpdates.maxPlayers = 2;
    if (!room.diff) rootUpdates.diff = STATE.diff;
    if (!room.time) rootUpdates.time = Number(STATE.time);
    if (!room.seed) rootUpdates.seed = String(STATE.seed);
    if (!room.view) rootUpdates.view = STATE.view;
    if (!room.hub) rootUpdates.hub = STATE.hub;
    if (!room.run) rootUpdates.run = STATE.run;
    if (!room.zone) rootUpdates.zone = STATE.zone;
    if (!room.theme) rootUpdates.theme = STATE.theme;
    if (!room.match) rootUpdates.match = { participantIds: [], lockedAt: 0, status: 'idle' };

    if (Object.keys(rootUpdates).length){
      rootUpdates.updatedAt = firebase.database.ServerValue.TIMESTAMP;
      await STATE.roomRef.update(rootUpdates);
    }

    try{
      const od = STATE.meRef.onDisconnect();
      if (od && typeof od.update === 'function'){
        fireAndForget(
          od.update({
            connected: false,
            phase: 'left',
            lastSeenAt: firebase.database.ServerValue.TIMESTAMP
          })
        );
      }
    }catch(err){
      console.warn('[duet.lobby] onDisconnect setup ignored:', err);
    }

    const computedPhase = prev.finished
      ? 'done'
      : (status === 'finished' ? (prev.phase || 'done') : 'lobby');

    await STATE.meRef.update({
      id: STATE.uid,
      uid: STATE.uid,
      pid: STATE.pid,
      name: STATE.name,
      ready: (typeof prev.ready === 'boolean') ? prev.ready : false,
      connected: true,
      phase: computedPhase,
      finished: !!prev.finished,
      finalScore: Number(prev.finalScore || 0),
      miss: Number(prev.miss || 0),
      streak: Number(prev.streak || 0),
      joinedAt: prev.joinedAt || firebase.database.ServerValue.TIMESTAMP,
      lastSeenAt: firebase.database.ServerValue.TIMESTAMP,
      finishedAt: prev.finishedAt || 0
    });

    STATE.joined = true;
  }

  async function setReady(flag){
    if (!STATE.meRef || STATE.joinDenied) return;
    await STATE.meRef.update({
      ready: !!flag,
      connected: true,
      phase: 'lobby',
      lastSeenAt: firebase.database.ServerValue.TIMESTAMP
    });
  }

  async function startDuet(){
    if (!STATE.roomRef || STATE.joinDenied) return;

    await new Promise((resolve, reject) => {
      STATE.roomRef.transaction((current) => {
        if (!current) return current;

        current.players = prunePlayers(current.players, current.status || 'waiting');

        if (String(current.status || 'waiting') !== 'waiting') return current;
        if (current.hostId !== STATE.uid) return current;

        const players = Object.keys(current.players || {})
          .map((id) => Object.assign({ id }, current.players[id] || {}))
          .filter((p) => isProbablyAlive(p));

        if (players.length !== ROOM_SIZE) return current;

        const ready = players.filter((p) => !!p.ready);
        if (ready.length !== ROOM_SIZE) return current;

        const t = now();
        const startAt = t + COUNTDOWN_MS;
        const ids = ready.slice(0, ROOM_SIZE).map((p) => p.id);

        ids.forEach((id) => {
          if (!current.players[id]) return;
          current.players[id].phase = 'lobby';
          current.players[id].finished = false;
          current.players[id].finalScore = 0;
          current.players[id].miss = 0;
          current.players[id].streak = 0;
          current.players[id].finishedAt = 0;
          current.players[id].lastSeenAt = t;
        });

        current.status = 'countdown';
        current.startAt = startAt;
        current.updatedAt = t;
        current.match = {
          participantIds: ids,
          lockedAt: t,
          status: 'locked'
        };

        return current;
      }, (err, committed, snap) => {
        if (err) return reject(err);

        const room = snap && snap.val ? snap.val() : null;
        if (!committed){
          if (!room) return reject(new Error('start-failed'));
          const players = activePlayers(room);
          const ready = readyPlayers(room);
          if (room.hostId !== STATE.uid) return reject(new Error('not-host'));
          if (players.length !== ROOM_SIZE) return reject(new Error('need-2-players'));
          if (ready.length !== ROOM_SIZE) return reject(new Error('need-2-ready'));
          if (String(room.status || 'waiting') !== 'waiting') return reject(new Error('room-not-waiting'));
          return reject(new Error('start-aborted'));
        }

        return resolve(room);
      }, false);
    });
  }

  function attachRoomListener(){
    STATE.roomRef.on('value', (snap) => {
      const room = snap.val();
      renderRoom(room);

      if (!room) return;

      const status = String(room.status || 'waiting');
      const info = getRematchInfo(room);

      if (STATE.rematchEntry && status === 'waiting'){
        STATE.redirected = false;
        STATE.autoStartLocked = false;
      }

      if (status === 'finished' && info.count >= ROOM_SIZE){
        fireAndForget(recoverFinishedRoomForRematch(room));
      }
    }, (err) => {
      showJoinGuard('ฟังสถานะห้องไม่ได้: ' + (err && err.message ? err.message : 'unknown'));
    });
  }

  function startHeartbeat(){
    stopHeartbeat();
    if (!STATE.meRef) return;

    STATE.heartbeatTimer = setInterval(() => {
      STATE.meRef.update({
        id: STATE.uid,
        uid: STATE.uid,
        pid: STATE.pid,
        name: STATE.name,
        connected: true,
        phase: 'lobby',
        lastSeenAt: firebase.database.ServerValue.TIMESTAMP
      }).catch(() => {});
    }, HEARTBEAT_MS);
  }

  function stopHeartbeat(){
    if (STATE.heartbeatTimer){
      clearInterval(STATE.heartbeatTimer);
      STATE.heartbeatTimer = 0;
    }
  }

  function bindUi(){
    if (els.roomCode) els.roomCode.textContent = `ROOM: ${STATE.roomId}`;
    if (els.inviteLink) els.inviteLink.value = buildInviteLink();
    if (els.roomInput) els.roomInput.value = STATE.roomId || '';
    renderQr(buildInviteLink());

    if (els.btnCopyRoom){
      els.btnCopyRoom.addEventListener('click', async () => {
        const ok = await copyText(STATE.roomId);
        setCopyState(ok ? 'คัดลอก Room Code แล้ว' : 'คัดลอก Room Code ไม่สำเร็จ', !ok);
      });
    }

    if (els.btnCopyInvite){
      els.btnCopyInvite.addEventListener('click', async () => {
        const ok = await copyText(buildInviteLink());
        setCopyState(ok ? 'คัดลอก Invite Link แล้ว' : 'คัดลอก Invite Link ไม่สำเร็จ', !ok);
      });
    }

    if (els.roomInput){
      els.roomInput.addEventListener('input', () => {
        const v = normalizeRoomId(els.roomInput.value);
        if (els.roomInput.value !== v) els.roomInput.value = v;
      });

      els.roomInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter'){
          ev.preventDefault();
          goJoinRoomByCode(els.roomInput.value);
        }
      });
    }

    if (els.btnJoinByCode){
      els.btnJoinByCode.addEventListener('click', () => {
        goJoinRoomByCode(els.roomInput ? els.roomInput.value : '');
      });
    }

    if (els.btnUseCurrentRoom){
      els.btnUseCurrentRoom.addEventListener('click', () => {
        if (els.roomInput){
          els.roomInput.value = STATE.roomId || '';
          els.roomInput.focus();
          if (els.roomInput.select) els.roomInput.select();
        }
        setHint('ใส่ code ห้องปัจจุบันให้แล้ว', false);
      });
    }

    if (els.btnNewRoom){
      els.btnNewRoom.addEventListener('click', () => {
        goCreateNewRoom();
      });
    }

    if (els.btnReady){
      els.btnReady.addEventListener('click', async () => {
        try{
          await setReady(true);
          STATE.autoReadyDone = true;
        }catch(err){
          setHint('กดพร้อมไม่สำเร็จ: ' + (err && err.message ? err.message : 'unknown'), true);
        }
      });
    }

    if (els.btnUnready){
      els.btnUnready.addEventListener('click', async () => {
        try{
          await setReady(false);
          STATE.autoStartAttempted = false;
          stopAutoStartTimer();
        }catch(err){
          setHint('ยกเลิกพร้อมไม่สำเร็จ: ' + (err && err.message ? err.message : 'unknown'), true);
        }
      });
    }

    if (els.btnStart){
      els.btnStart.addEventListener('click', async () => {
        try{
          await startDuet();
        }catch(err){
          const msg = err && err.message ? err.message : 'start-failed';
          if (msg === 'not-host') setHint('เฉพาะ Host เท่านั้นที่กดเริ่ม Duet ได้', true);
          else if (msg === 'need-2-players') setHint('Duet ต้องมีผู้เล่นครบ 2 คนก่อน', true);
          else if (msg === 'need-2-ready') setHint('ต้องมีผู้เล่นพร้อมครบ 2/2 ก่อนเริ่ม', true);
          else setHint('เริ่ม Duet ไม่สำเร็จ: ' + msg, true);
        }
      });
    }

    if (els.btnBack){
      els.btnBack.addEventListener('click', () => {
        safeReplace(STATE.hub || '../hub.html');
      });
    }

    W.addEventListener('beforeunload', () => {
      stopHeartbeat();
      stopAutoStartTimer();
      try{
        if (STATE.meRef){
          STATE.meRef.update({
            connected: false,
            phase: 'left',
            lastSeenAt: firebase.database.ServerValue.TIMESTAMP
          }).catch(() => {});
        }
      }catch{}
    });

    W.addEventListener('pagehide', () => {
      stopHeartbeat();
      stopAutoStartTimer();
    });
  }

  async function init(){
    bindUi();
    renderRoom(null);
    setCopyState('กำลังเชื่อมห้อง Duet...', false);

    try{
      await ensureFirebaseReady();
    }catch(err){
      showJoinGuard(
        'Firebase ยังไม่พร้อม: ' +
        (err && err.message ? err.message : 'unknown') +
        ' — ต้องใส่ firebase-auth.js ก่อน firebase-config.js'
      );
      return;
    }

    let lastErr = null;

    for (let i = 0; i < 2; i++){
      try{
        await joinRoom();
        lastErr = null;
        break;
      }catch(err){
        lastErr = err;
        const msg = err && err.message ? err.message : 'join-failed';

        if (msg === 'maxretry' && i === 0){
          await new Promise(resolve => setTimeout(resolve, 450));
          continue;
        }
        break;
      }
    }

    if (lastErr){
      const msg = lastErr && lastErr.message ? lastErr.message : 'join-failed';

      if (msg === 'room-full'){
        showJoinGuard('ห้องนี้เต็มแล้ว (Duet รับได้แค่ 2 คน)');
      } else if (msg === 'room-not-joinable'){
        showJoinGuard('ห้องนี้เริ่มเกมไปแล้ว ให้สร้างห้องใหม่สำหรับรอบถัดไป');
      } else if (msg === 'maxretry'){
        showJoinGuard('เข้าห้องไม่สำเร็จ: maxretry — ให้รีเฟรช 1 ครั้งแล้วลองใหม่');
      } else if (msg === 'permission_denied'){
        showJoinGuard('เข้าห้องไม่สำเร็จ: permission_denied');
      } else {
        showJoinGuard('เข้าห้องไม่สำเร็จ: ' + msg);
      }
      return;
    }

    try{
      attachRoomListener();
      startHeartbeat();
      setCopyState('ส่ง room code หรือลิงก์นี้ให้เพื่อนอีกคนเข้าร่วมได้', false);
    }catch(err){
      showJoinGuard('ฟังสถานะห้องไม่ได้: ' + (err && err.message ? err.message : 'unknown'));
    }
  }

  init();
})();
