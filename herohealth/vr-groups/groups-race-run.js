(function () {
  'use strict';

  const ROOM_ROOT = 'hha-battle/groups/raceRooms';

  // ถ้าเกมจริงของคุณไม่ใช่ groups.html ให้แก้บรรทัดนี้บรรทัดเดียว
  const ACTUAL_GAME_PAGE = './groups.html';

  const q = new URLSearchParams(location.search);

  const state = {
    roomId: '',
    name: '',
    uid: '',
    roomRef: null,
    roomOff: null,
    countdownTimer: null,
    redirecting: false,
    lastRoom: null,
    startAt: 0
  };

  function $(sel) {
    try { return document.querySelector(sel); }
    catch (_) { return null; }
  }

  const el = {
    metaRoom: $('#metaRoom'),
    metaName: $('#metaName'),
    countdown: $('#countdown'),
    status: $('#statusMsg'),
    roomState: $('#roomState'),
    players: $('#playersList'),
    btnBackLobby: $('#btnBackLobby'),
    btnBackHub: $('#btnBackHub')
  };

  function now() {
    return Date.now();
  }

  function num(v, d = 0) {
    v = Number(v);
    return Number.isFinite(v) ? v : d;
  }

  function cleanRoom(v) {
    return String(v || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
  }

  function cleanName(v, fallback = 'ผู้เล่น') {
    const s = String(v || '').replace(/[^\wก-๙ _-]/g, '').trim().slice(0, 24);
    return s || fallback;
  }

  function setText(node, text) {
    if (node) node.textContent = text;
  }

  function setStatus(text) {
    console.log('[Groups Race Run]', text);
    setText(el.status, text);
  }

  function setRoomState(text) {
    setText(el.roomState, text);
  }

  function waitFirebaseReady(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const fb = window.HHA_FIREBASE;
      if (fb && fb.ready && fb.auth && fb.db) {
        resolve(fb);
        return;
      }

      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error(window.HHA_FIREBASE?.error || 'Firebase not initialized'));
      }, timeoutMs);

      function onReady() {
        if (done) return;
        done = true;
        cleanup();
        resolve(window.HHA_FIREBASE);
      }

      function onError(e) {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error(e?.detail?.message || window.HHA_FIREBASE?.error || 'Firebase init failed'));
      }

      function cleanup() {
        clearTimeout(timer);
        window.removeEventListener('hha:firebase-ready', onReady);
        window.removeEventListener('hha:firebase-error', onError);
      }

      window.addEventListener('hha:firebase-ready', onReady, { once: true });
      window.addEventListener('hha:firebase-error', onError, { once: true });
    });
  }

  function buildHubUrl() {
    return q.get('hub') || 'https://supparang.github.io/webxr-health-mobile/herohealth/hub.html';
  }

  function buildLobbyUrl() {
    const u = new URL('./groups-race-lobby.html', location.href);
    const keep = [
      'hub', 'zone', 'game', 'run', 'view', 'seed', 'studyId', 'pid', 'entry'
    ];
    keep.forEach((k) => {
      const v = q.get(k);
      if (v) u.searchParams.set(k, v);
    });
    return u.toString();
  }

  function buildGameUrl(roomData) {
    const u = new URL(ACTUAL_GAME_PAGE, location.href);

    const keep = [
      'hub', 'zone', 'game', 'run', 'view', 'seed', 'studyId', 'pid'
    ];
    keep.forEach((k) => {
      const v = q.get(k);
      if (v) u.searchParams.set(k, v);
    });

    const roomId = state.roomId;
    const name = state.name;
    const diff = roomData?.diff || q.get('diff') || 'normal';
    const timeSec = num(roomData?.timeSec, num(q.get('timeSec'), num(q.get('time'), 60)));
    const startAt = num(roomData?.startAt, state.startAt || now());

    u.searchParams.set('mode', 'race');
    u.searchParams.set('entry', 'race');
    u.searchParams.set('roomId', roomId);
    u.searchParams.set('room', roomId);
    u.searchParams.set('name', name);
    u.searchParams.set('nick', name);
    u.searchParams.set('diff', diff);
    u.searchParams.set('time', String(timeSec));
    u.searchParams.set('timeSec', String(timeSec));
    u.searchParams.set('startAt', String(startAt));

    return u.toString();
  }

  function renderPlayers(playersObj) {
    const players = Object.values(playersObj || {});
    players.sort((a, b) => num(a.joinedAt) - num(b.joinedAt));

    if (!el.players) return;

    if (!players.length) {
      el.players.innerHTML = `
        <div class="player">
          <div class="left">
            <div class="avatar">👀</div>
            <div>
              <div class="name">ยังไม่มีผู้เล่น</div>
              <div class="tag">รอข้อมูลจากห้องแข่ง</div>
            </div>
          </div>
          <div class="right wait">รอ...</div>
        </div>
      `;
      return;
    }

    el.players.innerHTML = players.map((p) => {
      const isMe = p.uid && p.uid === state.uid;
      const host = p.isHost ? ' • เจ้าของห้อง' : '';
      const readyText = p.ready ? 'พร้อม' : 'รอ';
      const readyClass = p.ready ? 'ok' : 'wait';
      const avatar = isMe ? '🧑' : (p.isHost ? '👑' : '🎮');

      return `
        <div class="player">
          <div class="left">
            <div class="avatar">${avatar}</div>
            <div>
              <div class="name">${escapeHtml(p.name || 'Player')}${isMe ? ' (คุณ)' : ''}</div>
              <div class="tag">${p.uid ? 'เชื่อมต่อแล้ว' : 'ไม่มี uid'}${host}</div>
            </div>
          </div>
          <div class="right ${readyClass}">${readyText}</div>
        </div>
      `;
    }).join('');
  }

  function escapeHtml(s) {
    return String(s || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function updateCountdown(msLeft) {
    if (!el.countdown) return;

    if (msLeft <= 0) {
      el.countdown.textContent = 'GO!';
      el.countdown.className = 'count go';
      return;
    }

    const sec = Math.ceil(msLeft / 1000);

    if (sec <= 3) {
      el.countdown.textContent = String(sec);
      el.countdown.className = 'count ready';
    } else {
      el.countdown.textContent = String(sec);
      el.countdown.className = 'count wait';
    }
  }

  function clearCountdownTimer() {
    if (state.countdownTimer) {
      clearInterval(state.countdownTimer);
      state.countdownTimer = null;
    }
  }

  function startCountdown(targetTime, roomData) {
    state.startAt = num(targetTime, 0);
    clearCountdownTimer();

    if (!state.startAt) {
      updateCountdown(999999);
      setStatus('รอเจ้าของห้องเริ่มเกม...');
      return;
    }

    state.countdownTimer = setInterval(() => {
      const left = state.startAt - now();
      updateCountdown(left);

      if (left > 0) {
        setStatus(`กำลังจะเริ่มแข่งใน ${Math.ceil(left / 1000)} วินาที`);
        return;
      }

      clearCountdownTimer();
      redirectToGame(roomData);
    }, 100);
  }

  function redirectToGame(roomData) {
    if (state.redirecting) return;
    state.redirecting = true;

    setStatus('กำลังเข้าเกม...');
    updateCountdown(0);

    const url = buildGameUrl(roomData);
    setTimeout(() => {
      location.href = url;
    }, 180);
  }

  async function markPresence(roomId) {
    try {
      const fb = await waitFirebaseReady();
      const uid = fb.auth.currentUser?.uid || window.HHA_FIREBASE?.uid || '';
      if (!uid) return;

      const name = state.name;
      const playerRef = fb.db.ref(`${ROOM_ROOT}/${roomId}/players/${uid}`);

      await playerRef.update({
        uid,
        name,
        ready: true,
        updatedAt: now()
      });

      try {
        playerRef.child('connected').onDisconnect().set(false);
        playerRef.child('updatedAt').onDisconnect().set(now());
      } catch (_) {}

      await playerRef.child('connected').set(true);
    } catch (err) {
      console.warn('[Groups Race Run] markPresence failed', err);
    }
  }

  async function attachRoom(roomId) {
    const fb = await waitFirebaseReady();
    const ref = fb.db.ref(`${ROOM_ROOT}/${roomId}`);
    state.roomRef = ref;

    state.roomOff = (snap) => {
      const room = snap.val();
      state.lastRoom = room || null;

      if (!room) {
        setRoomState('ไม่พบห้อง');
        setStatus('ไม่พบข้อมูลห้องนี้');
        return;
      }

      renderPlayers(room.players || {});
      setText(el.metaRoom, room.roomId || roomId);

      const players = Object.values(room.players || {});
      const readyCount = players.filter(p => p.ready).length;
      const started = room.status === 'starting' || room.status === 'started' || room.status === 'running';

      if (room.status === 'lobby') {
        setRoomState(`รอเริ่ม • ${players.length} คน • พร้อม ${readyCount}`);
        setStatus('รอเจ้าของห้องกดเริ่มแข่ง...');
        updateCountdown(999999);
        return;
      }

      if (started) {
        const startAt = num(room.startAt, num(q.get('startAt'), 0));
        setRoomState(`กำลังเริ่ม • ${players.length} คน`);
        startCountdown(startAt, room);
        return;
      }

      if (room.status === 'ended') {
        setRoomState('แข่งจบแล้ว');
        setStatus('ห้องนี้จบการแข่งขันแล้ว');
        updateCountdown(999999);
        return;
      }

      setRoomState(room.status || 'ไม่ทราบสถานะ');
      setStatus('กำลังติดตามสถานะห้อง...');
    };

    ref.on('value', state.roomOff);
  }

  function bindButtons() {
    if (el.btnBackHub) {
      el.btnBackHub.addEventListener('click', () => {
        location.href = buildHubUrl();
      });
    }

    if (el.btnBackLobby) {
      el.btnBackLobby.addEventListener('click', () => {
        location.href = buildLobbyUrl();
      });
    }
  }

  async function boot() {
    bindButtons();

    state.roomId = cleanRoom(q.get('roomId') || q.get('room'));
    state.name = cleanName(q.get('name') || q.get('nick') || localStorage.getItem('HHA_GROUPS_RACE_LAST_NAME') || 'ผู้เล่น');
    setText(el.metaRoom, state.roomId || '-');
    setText(el.metaName, state.name || '-');

    if (!state.roomId) {
      setRoomState('ไม่มี room');
      setStatus('ไม่พบรหัสห้อง');
      setText(el.countdown, 'ERR');
      return;
    }

    try {
      setStatus('กำลังเชื่อมต่อ Firebase...');
      const fb = await waitFirebaseReady();
      state.uid = fb.auth.currentUser?.uid || window.HHA_FIREBASE?.uid || '';
      await markPresence(state.roomId);
      await attachRoom(state.roomId);
      setStatus('เชื่อมต่อสำเร็จ กำลังรอสถานะห้อง...');
    } catch (err) {
      console.error(err);
      setRoomState('เชื่อมต่อไม่สำเร็จ');
      setStatus(`เชื่อมต่อไม่สำเร็จ: ${err?.message || err}`);
      setText(el.countdown, 'ERR');
    }
  }

  boot();

  window.GROUPS_RACE_RUN = {
    buildGameUrl,
    boot
  };
})();