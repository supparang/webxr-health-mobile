/* /herohealth/vr-goodjunk/goodjunk-duet-lobby.js
   FULL PATCH v20260327-GOODJUNK-DUET-LOBBY-ROOMCODE-QRSHORT-V5
*/
(function(){
  'use strict';

  const W = window;
  const D = document;

  const $ = (id) => D.getElementById(id);

  const els = {
    roomCode        : $('roomCode'),
    playerCount     : $('playerCount'),
    roomStatus      : $('roomStatus'),
    hostName        : $('hostName'),
    playersBox      : $('playersBox'),
    copyState       : $('copyState'),
    joinGuard       : $('joinGuard'),
    inviteLink      : $('inviteLink'),
    qrBox           : $('qrBox'),
    countdown       : $('countdown'),
    btnCopyRoom     : $('btnCopyRoom'),
    btnCopyInvite   : $('btnCopyInvite'),
    btnReady        : $('btnReady'),
    btnUnready      : $('btnUnready'),
    btnStart        : $('btnStart'),
    btnBack         : $('btnBack'),
    hint            : $('hint'),
    roomInput       : $('roomInput'),
    btnJoinByCode   : $('btnJoinByCode'),
    btnUseCurrentRoom: $('btnUseCurrentRoom'),
    btnNewRoom      : $('btnNewRoom')
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
      .filter((p) => !(p.phase === 'left' && !isProbablyAlive(p)));
  }

  function readyPlayers(room){
    return activePlayers(room).filter((p) => !!p.ready);
  }

  function participantIds(room){
    const ids = (((room || {}).match || {}).participantIds || []);
    return Array.isArray(ids) ? ids.filter(Boolean) : [];
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
    repairingHost: false
  };

  try{ localStorage.setItem('HHA_PLAYER_PID', STATE.pid); }catch{}
  try{ localStorage.setItem('HHA_PLAYER_NICK', STATE.name); }catch{}

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
    return u.toString();
  }

  function buildLobbyUrlWithRoom(roomId){
    const u = new URL(W.location.href);
    const cleanRoom = normalizeRoomId(roomId);
    u.searchParams.set('room', cleanRoom);
    u.searchParams.set('roomId', cleanRoom);

    if (STATE.pid)   u.searchParams.set('pid', STATE.pid);
    if (STATE.name){
      u.searchParams.set('name', STATE.name);
      u.searchParams.set('nick', STATE.name);
    }
    if (STATE.hub)   u.searchParams.set('hub', STATE.hub);
    if (STATE.view)  u.searchParams.set('view', STATE.view);
    if (STATE.run)   u.searchParams.set('run', STATE.run);
    if (STATE.diff)  u.searchParams.set('diff', STATE.diff);
    if (STATE.time)  u.searchParams.set('time', String(STATE.time));
    if (STATE.zone)  u.searchParams.set('zone', STATE.zone);
    if (STATE.theme) u.searchParams.set('theme', STATE.theme);

    u.searchParams.set('seed', String(Date.now()));
    return u.toString();
  }

  function goJoinRoomByCode(raw){
    const roomId = normalizeRoomId(raw);
    if (!roomId){
      setHint('กรุณาใส่ Room Code ก่อน', true);
      if (els.roomInput) els.roomInput.focus();
      return;
    }
    W.location.href = buildLobbyUrlWithRoom(roomId);
  }

  function goCreateNewRoom(){
    W.location.href = buildLobbyUrlWithRoom(randomRoomId());
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
    return u.toString();
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
          <div style="margin-top:8px;color:#94a3b8;font-size:12px;line-height:1.55;">
            phase: ${esc(p.phase || 'lobby')}
          </div>
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

    if (els.btnReady)   els.btnReady.disabled   = !waitingOnly || !me || !!me.ready || STATE.joinDenied;
    if (els.btnUnready) els.btnUnready.disabled = !waitingOnly || !me || !me.ready || STATE.joinDenied;
    if (els.btnStart)   els.btnStart.disabled   = !waitingOnly || !amHost || !fullEnough || readyCount !== ROOM_SIZE || STATE.joinDenied;

    if (STATE.joinDenied){
      setHint(STATE.joinDeniedReason || 'ห้องนี้ยังเข้าไม่ได้', true);
      return;
    }

    if (!room){
      setHint('กำลังเชื่อมห้อง...', false);
      return;
    }

    if (String(room.status || 'waiting') === 'countdown'){
      setHint('กำลังนับถอยหลังเพื่อเข้าเกมพร้อมกัน', false);
      return;
    }
    if (String(room.status || 'waiting') === 'running'){
      setHint('กำลังพาเข้าสู่ GoodJunk Duet Run...', false);
      return;
    }
    if (String(room.status || 'waiting') === 'finished'){
      setHint('รอบก่อนหน้าจบแล้ว สร้างห้องใหม่เพื่อเริ่ม Duet รอบถัดไป', false);
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
    if (!room || room.hostId !== STATE.uid) return;
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
          W.location.replace(buildRunUrl(room));
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
          setTimeout(() => W.location.replace(buildRunUrl(room)), 150);
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

  function renderRoom(room){
    STATE.room = room || null;

    if (els.roomCode) els.roomCode.textContent = STATE.roomId;
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
      return;
    }

    const players = activePlayers(room);
    const status = String(room.status || 'waiting');
    const host = room.players && room.players[room.hostId] ? room.players[room.hostId] : null;

    if (els.playerCount) els.playerCount.textContent = `${players.length}/${ROOM_SIZE}`;
    if (els.roomStatus) els.roomStatus.textContent = status;
    if (els.hostName) els.hostName.textContent = host ? (host.name || 'Host') : '-';

    renderPlayers(room);
    updateButtons(room);
    maybeRepairHost(room);
    maybeHandleCountdown(room);
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

  async function joinRoom(){
    STATE.roomRef = STATE.db.ref(roomPath(STATE.roomId));
    STATE.meRef = STATE.roomRef.child('players/' + STATE.uid);

    const snap = await STATE.roomRef.once('value');
    const existing = snap.val();

    if (existing){
      const players = prunePlayers(existing.players, existing.status || 'waiting');
      const ids = Object.keys(players || {});
      const hasMe = !!players[STATE.uid];
      const alreadyRunning = String(existing.status || 'waiting') !== 'waiting';

      if (!hasMe && ids.length >= ROOM_SIZE){
        showJoinGuard('ห้องนี้เต็มแล้ว (Duet รับได้แค่ 2 คน)');
      } else if (!hasMe && alreadyRunning){
        showJoinGuard('ห้องนี้เริ่มเกมไปแล้ว ให้สร้างห้องใหม่สำหรับรอบถัดไป');
      } else {
        hideJoinGuard();
      }
    }

    await new Promise((resolve, reject) => {
      STATE.roomRef.transaction((current) => {
        const t = now();

        if (!current){
          return freshRoom(STATE.uid);
        }

        current.players = prunePlayers(current.players, current.status || 'waiting');

        const ids = Object.keys(current.players || {});
        const hasMe = !!current.players[STATE.uid];
        const status = String(current.status || 'waiting');

        if (!hasMe && ids.length >= ROOM_SIZE) return;
        if (!hasMe && status !== 'waiting') return;

        const prev = current.players[STATE.uid] || {};
        current.players[STATE.uid] = Object.assign({}, freshPlayer(STATE.uid), prev, {
          id: STATE.uid,
          uid: STATE.uid,
          pid: STATE.pid,
          name: STATE.name,
          connected: true,
          phase: 'lobby',
          lastSeenAt: t
        });

        if (!current.hostId || !current.players[current.hostId]){
          current.hostId = STATE.uid;
        }
        if (!current.hostName || current.hostId === STATE.uid){
          current.hostName = (current.players[current.hostId] && current.players[current.hostId].name) || STATE.name || 'Host';
        }

        current.game = GAME_KEY;
        current.mode = MODE_KEY;
        current.roomId = STATE.roomId;
        current.minPlayers = 2;
        current.maxPlayers = 2;
        current.diff = current.diff || STATE.diff;
        current.time = Number(current.time || STATE.time);
        current.seed = String(current.seed || STATE.seed);
        current.view = current.view || STATE.view;
        current.hub = current.hub || STATE.hub;
        current.run = current.run || STATE.run;
        current.zone = current.zone || STATE.zone;
        current.theme = current.theme || STATE.theme;
        current.match = current.match || { participantIds: [], lockedAt: 0, status: 'idle' };
        current.updatedAt = t;

        return current;
      }, (err, committed, postSnap) => {
        if (err) return reject(err);
        if (!committed){
          const room = postSnap && postSnap.val ? postSnap.val() : null;
          if (room){
            const players = prunePlayers(room.players, room.status || 'waiting');
            const ids = Object.keys(players || {});
            if (ids.length >= ROOM_SIZE && !players[STATE.uid]) return reject(new Error('room-full'));
            if (String(room.status || 'waiting') !== 'waiting' && !players[STATE.uid]) return reject(new Error('room-not-joinable'));
          }
          return reject(new Error('join-aborted'));
        }
        return resolve(postSnap.val());
      }, false);
    });

    hideJoinGuard();
    STATE.joined = true;

    await STATE.meRef.onDisconnect().update({
      connected: false,
      phase: 'left',
      lastSeenAt: firebase.database.ServerValue.TIMESTAMP
    });

    await STATE.meRef.update({
      id: STATE.uid,
      uid: STATE.uid,
      pid: STATE.pid,
      name: STATE.name,
      connected: true,
      phase: 'lobby',
      lastSeenAt: firebase.database.ServerValue.TIMESTAMP
    });
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
    if (els.roomCode) els.roomCode.textContent = STATE.roomId;
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
          els.roomInput.select?.();
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
        }catch(err){
          setHint('กดพร้อมไม่สำเร็จ: ' + (err && err.message ? err.message : 'unknown'), true);
        }
      });
    }

    if (els.btnUnready){
      els.btnUnready.addEventListener('click', async () => {
        try{
          await setReady(false);
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
        W.location.href = STATE.hub || '../hub.html';
      });
    }

    W.addEventListener('beforeunload', () => {
      stopHeartbeat();
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

    W.addEventListener('pagehide', stopHeartbeat);
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

    try{
      await joinRoom();
      attachRoomListener();
      startHeartbeat();
      setCopyState('ส่ง room code หรือลิงก์นี้ให้เพื่อนอีกคนเข้าร่วมได้', false);
    }catch(err){
      const msg = err && err.message ? err.message : 'join-failed';
      if (msg === 'room-full'){
        showJoinGuard('ห้องนี้เต็มแล้ว (Duet รับได้แค่ 2 คน)');
      } else if (msg === 'room-not-joinable'){
        showJoinGuard('ห้องนี้เริ่มเกมไปแล้ว ให้สร้างห้องใหม่สำหรับรอบถัดไป');
      } else {
        showJoinGuard('เข้าห้องไม่สำเร็จ: ' + msg);
      }
    }
  }

  init();
})();