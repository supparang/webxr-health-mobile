(() => {
  'use strict';

  const W = window;
  const D = document;
  const q = new URLSearchParams(location.search);

  const ROOT_PATH = 'hha-battle/groups/raceRooms';
  const HEARTBEAT_MS = 2500;
  const ACTIVE_TTL_MS = 15000;
  const STORE_KEY = 'HHA_GROUPS_RACE_LOBBY_STATE_V1';

  const $ = (sel, root = D) => root.querySelector(sel);
  const now = () => Date.now();

  const els = {
    hostName: $('#hostName'),
    joinName: $('#joinName'),
    diff: $('#diff'),
    timeSec: $('#timeSec'),
    roomCode: $('#roomCode'),
    roomCodeOut: $('#roomCodeOut'),
    statusMsg: $('#statusMsg'),
    playersList: $('#playersList'),
    btnCreateRoom: $('#btnCreateRoom'),
    btnJoinRoom: $('#btnJoinRoom'),
    btnStartRace: $('#btnStartRace'),
    btnCopyCode: $('#btnCopyCode')
  };

  const state = {
    db: null,
    auth: null,
    roomRef: null,
    roomCode: '',
    room: null,
    isHost: false,
    navigating: false,
    heartbeatTimer: 0,
    roomListener: null,
    playerId: getOrCreatePlayerId(),
    pid: cleanText(q.get('pid') || 'anon', 48),
    displayName: cleanText(
      q.get('name') ||
      q.get('nickName') ||
      q.get('nick') ||
      '',
      24
    )
  };

  prefillInputs();
  bindEvents();
  boot();

  function prefillInputs() {
    const diff = q.get('diff') || 'normal';
    const timeSec = q.get('timeSec') || q.get('time') || '60';
    const roomCode = cleanRoom(q.get('roomCode') || q.get('code') || '');
    const fallbackName = state.displayName || cleanText(q.get('pid') || 'Player', 24);

    if (els.hostName && !els.hostName.value) els.hostName.value = fallbackName;
    if (els.joinName && !els.joinName.value) els.joinName.value = fallbackName;
    if (els.diff) els.diff.value = ['easy', 'normal', 'hard'].includes(diff) ? diff : 'normal';
    if (els.timeSec) els.timeSec.value = ['60', '90', '120'].includes(String(timeSec)) ? String(timeSec) : '60';
    if (els.roomCode && roomCode) els.roomCode.value = roomCode;

    const saved = loadJson(STORE_KEY, null);
    if (saved) {
      if (els.hostName && !els.hostName.value && saved.lastName) els.hostName.value = cleanText(saved.lastName, 24);
      if (els.joinName && !els.joinName.value && saved.lastName) els.joinName.value = cleanText(saved.lastName, 24);
      if (els.roomCode && !els.roomCode.value && saved.roomCode) els.roomCode.value = cleanRoom(saved.roomCode);
    }
  }

  function bindEvents() {
    if (els.btnCreateRoom) els.btnCreateRoom.addEventListener('click', onCreateRoom);
    if (els.btnJoinRoom) els.btnJoinRoom.addEventListener('click', onJoinRoom);
    if (els.btnStartRace) els.btnStartRace.addEventListener('click', onStartRace);
    if (els.btnCopyCode) els.btnCopyCode.addEventListener('click', onCopyCode);

    if (els.roomCode) {
      els.roomCode.addEventListener('input', () => {
        els.roomCode.value = cleanRoom(els.roomCode.value);
      });
    }

    if (els.hostName) {
      els.hostName.addEventListener('change', () => {
        const v = cleanText(els.hostName.value, 24);
        els.hostName.value = v;
        if (els.joinName && !els.joinName.value) els.joinName.value = v;
      });
    }

    if (els.joinName) {
      els.joinName.addEventListener('change', () => {
        els.joinName.value = cleanText(els.joinName.value, 24);
      });
    }

    W.addEventListener('beforeunload', markLeftBestEffort);
    D.addEventListener('visibilitychange', () => {
      if (!D.hidden) heartbeatNow().catch(() => {});
    });
  }

  async function boot() {
    setStatus('กำลังเชื่อมต่อ Firebase...', 'warn');

    try {
      const fb = await ensureFirebaseCtx();
      state.db = fb.db;
      state.auth = fb.auth || null;

      setStatus('พร้อมใช้งาน สร้างห้องหรือเข้าห้องได้เลย', 'ok');

      const roomCode = cleanRoom(q.get('roomCode') || q.get('code') || '');
      if (roomCode) {
        state.roomCode = roomCode;
        if (els.roomCode) els.roomCode.value = roomCode;
      }
    } catch (err) {
      console.error('[Groups Race] init failed:', err);
      setStatus(`เชื่อมต่อ Firebase ไม่สำเร็จ: ${safeErr(err)}`, 'err');
    }
  }

  async function ensureFirebaseCtx() {
    if (W.HHA_FIREBASE && W.HHA_FIREBASE.ready && W.HHA_FIREBASE.db) {
      return W.HHA_FIREBASE;
    }

    if (W.HHA_FIREBASE_READY && typeof W.HHA_FIREBASE_READY.then === 'function') {
      try {
        const readyCtx = await W.HHA_FIREBASE_READY;
        if (readyCtx && readyCtx.db) return readyCtx;
      } catch (_) {}
    }

    if (!W.firebase) {
      throw new Error('Firebase SDK not loaded');
    }

    const cfg =
      W.HHA_FIREBASE_CONFIG ||
      W.HEROHEALTH_FIREBASE_CONFIG ||
      W.FIREBASE_CONFIG ||
      W.__firebaseConfig ||
      null;

    if (!cfg || !cfg.apiKey || !cfg.projectId || !cfg.databaseURL) {
      throw new Error('Missing Firebase config');
    }

    let app;
    try {
      app = (firebase.apps && firebase.apps.length)
        ? firebase.app()
        : firebase.initializeApp(cfg);
    } catch (err) {
      if (firebase.apps && firebase.apps.length) {
        app = firebase.app();
      } else {
        throw err;
      }
    }

    const auth = (firebase.auth && typeof firebase.auth === 'function')
      ? firebase.auth()
      : null;

    const db = (firebase.database && typeof firebase.database === 'function')
      ? firebase.database()
      : null;

    if (!db) {
      throw new Error('Realtime Database SDK not available');
    }

    const ctx = {
      app,
      auth,
      db,
      config: cfg,
      ready: true
    };

    W.HHA_FIREBASE = ctx;

    if (auth && !auth.currentUser && typeof auth.signInAnonymously === 'function') {
      try {
        await auth.signInAnonymously();
      } catch (err) {
        console.warn('[Groups Race] anonymous auth skipped/failed:', safeErr(err));
      }
    }

    return ctx;
  }

  async function onCreateRoom() {
    try {
      await ensureReady();

      const hostName = cleanText(
        (els.hostName && els.hostName.value) ||
        state.displayName ||
        'Player',
        24
      );

      const diff = (els.diff && els.diff.value) || 'normal';
      const timeSec = clamp(Number((els.timeSec && els.timeSec.value) || 60), 30, 300);

      if (els.hostName) els.hostName.value = hostName;
      if (els.joinName && !els.joinName.value) els.joinName.value = hostName;

      const roomCode = await allocateRoomCode();
      const createdAt = now();

      const roomData = {
        game: 'groups',
        mode: 'race',
        roomCode,
        status: 'lobby',
        ownerPlayerId: state.playerId,
        ownerPid: state.pid,
        hostName,
        diff,
        timeSec,
        minPlayers: 2,
        createdAt,
        updatedAt: createdAt,
        startSeed: String(q.get('seed') || createdAt),
        players: {
          [state.playerId]: buildPlayerPayload(hostName, true, createdAt)
        }
      };

      const roomRef = refForRoom(roomCode);
      await roomRef.set(roomData);

      state.isHost = true;
      saveJson(STORE_KEY, {
        roomCode,
        lastName: hostName
      });

      attachRoom(roomCode);
      setStatus('สร้างห้องสำเร็จ แชร์ Room Code ให้เพื่อนแล้วรอเริ่มได้เลย', 'ok');
    } catch (err) {
      console.error('[Groups Race] create failed:', err);
      setStatus(`สร้างห้องไม่สำเร็จ: ${safeErr(err)}`, 'err');
    }
  }

  async function onJoinRoom() {
    try {
      await ensureReady();

      const joinName = cleanText(
        (els.joinName && els.joinName.value) ||
        state.displayName ||
        'Player',
        24
      );
      const roomCode = cleanRoom((els.roomCode && els.roomCode.value) || state.roomCode || '');

      if (!roomCode) {
        throw new Error('กรุณากรอกรหัสห้อง');
      }

      if (els.joinName) els.joinName.value = joinName;
      if (els.roomCode) els.roomCode.value = roomCode;

      const roomRef = refForRoom(roomCode);
      const snap = await roomRef.once('value');
      const room = snap.val();

      if (!room) {
        throw new Error('ไม่พบห้องนี้');
      }

      if (room.status === 'started') {
        throw new Error('ห้องนี้เริ่มแข่งไปแล้ว');
      }

      const joinedAt =
        Number(room?.players?.[state.playerId]?.joinedAt) ||
        now();

      await roomRef.update({
        [`players/${state.playerId}`]: buildPlayerPayload(joinName, false, joinedAt),
        updatedAt: now()
      });

      state.isHost = room.ownerPlayerId === state.playerId;
      saveJson(STORE_KEY, {
        roomCode,
        lastName: joinName
      });

      attachRoom(roomCode);
      setStatus('เข้าห้องสำเร็จ รอเจ้าของห้องกดเริ่มแข่ง', 'ok');
    } catch (err) {
      console.error('[Groups Race] join failed:', err);
      setStatus(`เข้าห้องไม่สำเร็จ: ${safeErr(err)}`, 'err');
    }
  }

  async function onStartRace() {
    try {
      await ensureReady();

      if (!state.roomRef || !state.room) {
        throw new Error('ยังไม่มีข้อมูลห้อง');
      }

      if (!state.isHost) {
        throw new Error('เฉพาะเจ้าของห้องเท่านั้นที่กดเริ่มแข่งได้');
      }

      const activePlayers = getPlayers(state.room).filter((p) => p.active);
      if (activePlayers.length < 2) {
        throw new Error('ต้องมีผู้เล่นอย่างน้อย 2 คน');
      }

      const startAt = now() + 1500;
      const startSeed = String(state.room.startSeed || q.get('seed') || now());

      await state.roomRef.update({
        status: 'started',
        startedAt: startAt,
        startedBy: state.playerId,
        startSeed,
        updatedAt: now()
      });

      setStatus('เริ่มแข่งแล้ว กำลังพาทุกเครื่องเข้าเกม...', 'ok');
    } catch (err) {
      console.error('[Groups Race] start failed:', err);
      setStatus(`เริ่มแข่งไม่สำเร็จ: ${safeErr(err)}`, 'err');
    }
  }

  async function onCopyCode() {
    try {
      const code = cleanRoom(state.roomCode || (els.roomCodeOut && els.roomCodeOut.textContent) || '');
      if (!code || code === '-') {
        throw new Error('ยังไม่มีรหัสห้อง');
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const ta = D.createElement('textarea');
        ta.value = code;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        D.body.appendChild(ta);
        ta.focus();
        ta.select();
        D.execCommand('copy');
        ta.remove();
      }

      setStatus(`คัดลอกรหัสห้องแล้ว: ${code}`, 'ok');
    } catch (err) {
      setStatus(`คัดลอกรหัสห้องไม่สำเร็จ: ${safeErr(err)}`, 'err');
    }
  }

  function attachRoom(roomCode) {
    const cleanCode = cleanRoom(roomCode);
    if (!cleanCode) return;

    detachRoom();

    state.roomCode = cleanCode;
    state.roomRef = refForRoom(cleanCode);
    state.room = null;
    state.navigating = false;

    setRoomCode(cleanCode);

    state.roomListener = (snap) => {
      const room = snap.val();
      state.room = room || null;

      if (!room) {
        renderNoRoom('ไม่พบข้อมูลห้อง หรือห้องถูกลบแล้ว');
        setStatus('ไม่พบข้อมูลห้องนี้', 'err');
        return;
      }

      state.isHost = String(room.ownerPlayerId || '') === String(state.playerId);
      setRoomCode(room.roomCode || cleanCode);
      renderRoom(room);
      maybeEnterRace(room);
    };

    state.roomRef.on('value', state.roomListener);

    heartbeatNow().catch((err) => {
      console.warn('[Groups Race] heartbeat initial failed:', safeErr(err));
    });

    state.heartbeatTimer = W.setInterval(() => {
      heartbeatNow().catch((err) => {
        console.warn('[Groups Race] heartbeat failed:', safeErr(err));
      });
    }, HEARTBEAT_MS);
  }

  function detachRoom() {
    if (state.heartbeatTimer) {
      W.clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = 0;
    }

    if (state.roomRef && state.roomListener) {
      state.roomRef.off('value', state.roomListener);
    }

    state.roomListener = null;
    state.roomRef = null;
    state.room = null;
    state.navigating = false;
    state.isHost = false;
  }

  async function heartbeatNow() {
    if (!state.db || !state.roomRef || !state.roomCode) return;

    const joinedAt =
      Number(state.room?.players?.[state.playerId]?.joinedAt) ||
      now();

    const name = currentPlayerName();
    const payload = buildPlayerPayload(name, state.isHost, joinedAt);

    await state.roomRef.update({
      [`players/${state.playerId}`]: payload,
      updatedAt: now()
    });
  }

  function maybeEnterRace(room) {
    if (!room || room.status !== 'started' || state.navigating) return;

    state.navigating = true;
    setStatus('ห้องเริ่มแข่งแล้ว กำลังพาเข้าเกม...', 'ok');

    const delay = Math.max(0, Number(room.startedAt || now()) - now());
    W.setTimeout(() => {
      location.href = buildRunUrl(room);
    }, Math.min(delay, 3000));
  }

  function buildRunUrl(room) {
    const base = new URL(q.get('runUrl') || './groups.html', location.href);
    const params = new URLSearchParams(base.search);

    for (const [k, v] of q.entries()) {
      params.set(k, v);
    }

    params.set('mode', 'race');
    params.set('race', '1');
    params.set('roomCode', cleanRoom(room.roomCode || state.roomCode));
    params.set('pid', state.pid || 'anon');
    params.set('name', currentPlayerName());
    params.set('diff', room.diff || params.get('diff') || 'normal');
    params.set('time', String(room.timeSec || params.get('time') || 60));
    params.set('timeSec', String(room.timeSec || params.get('timeSec') || 60));
    params.set('seed', String(room.startSeed || params.get('seed') || now()));
    params.set('view', q.get('view') || params.get('view') || 'mobile');
    params.set('hub', q.get('hub') || params.get('hub') || 'https://supparang.github.io/webxr-health-mobile/herohealth/hub.html');
    params.set('isHost', state.isHost ? '1' : '0');
    params.set('hostPlayerId', String(room.ownerPlayerId || ''));
    params.set('hostName', String(room.hostName || ''));
    params.set('players', String(getPlayers(room).filter((p) => p.active).length));
    params.set('game', params.get('game') || 'groups');
    params.set('gameId', params.get('gameId') || 'groups');
    params.set('zone', params.get('zone') || 'nutrition');
    params.set('cat', params.get('cat') || 'nutrition');

    base.search = params.toString();
    return base.toString();
  }

  function renderRoom(room) {
    const players = getPlayers(room);
    const activePlayers = players.filter((p) => p.active);
    const activeCount = activePlayers.length;

    if (!players.length) {
      renderNoRoom('ยังไม่มีผู้เล่นในห้อง');
    } else {
      els.playersList.innerHTML = players.map((p) => {
        const badges = [
          p.isHost ? '<span class="badge host">เจ้าของห้อง</span>' : '',
          p.isMe ? '<span class="badge you">คุณ</span>' : '',
          p.active ? '<span class="badge on">ออนไลน์</span>' : '<span class="badge off">ออฟไลน์</span>'
        ].filter(Boolean).join('');

        return `
          <div class="player-row">
            <div class="player-main">
              <div class="player-dot ${p.active ? '' : 'off'}"></div>
              <div class="player-name">${escapeHtml(p.name)}</div>
            </div>
            <div class="player-meta">${badges}</div>
          </div>
        `;
      }).join('');
    }

    if (room.status === 'started') {
      setStatus('ห้องเริ่มแข่งแล้ว กำลังพาเข้าเกม...', 'ok');
    } else if (activeCount < 2) {
      setStatus(
        state.isHost
          ? 'รอผู้เล่นอย่างน้อย 2 คนก่อนเริ่มแข่ง'
          : 'เข้าห้องแล้ว รอให้ครบอย่างน้อย 2 คน',
        'warn'
      );
    } else {
      setStatus(
        state.isHost
          ? 'พร้อมแล้ว กดเริ่มแข่งได้เลย'
          : 'พร้อมแล้ว รอเจ้าของห้องกดเริ่มแข่ง',
        'ok'
      );
    }

    if (els.btnStartRace) {
      els.btnStartRace.disabled = !(
        state.isHost &&
        room.status !== 'started' &&
        activeCount >= 2
      );
    }
  }

  function renderNoRoom(message) {
    if (els.playersList) {
      els.playersList.innerHTML = `<div class="player-empty">${escapeHtml(message || 'ยังไม่มีข้อมูลห้อง')}</div>`;
    }
    if (els.btnStartRace) {
      els.btnStartRace.disabled = true;
    }
  }

  function getPlayers(room) {
    const playersMap = room && room.players ? room.players : {};
    const t = now();

    return Object.keys(playersMap).map((key) => {
      const p = playersMap[key] || {};
      const lastSeen = Number(p.lastSeen || 0);
      const active = p.presence !== 'left' && (t - lastSeen) <= ACTIVE_TTL_MS;

      return {
        key,
        playerId: String(p.playerId || key),
        pid: String(p.pid || ''),
        name: cleanText(p.name || p.displayName || 'Player', 24),
        joinedAt: Number(p.joinedAt || 0),
        active,
        isHost: key === room.ownerPlayerId || !!p.isHost,
        isMe: key === state.playerId
      };
    }).sort((a, b) => {
      if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.joinedAt - b.joinedAt;
    });
  }

  function buildPlayerPayload(name, isHost, joinedAt) {
    return {
      playerId: state.playerId,
      pid: state.pid,
      name: cleanText(name || 'Player', 24),
      joinedAt: Number(joinedAt || now()),
      lastSeen: now(),
      presence: 'lobby',
      ready: true,
      isHost: !!isHost,
      view: q.get('view') || 'mobile'
    };
  }

  async function allocateRoomCode() {
    for (let i = 0; i < 8; i++) {
      const code = makeRoomCode();
      const snap = await refForRoom(code).once('value');
      if (!snap.exists()) return code;
    }
    throw new Error('สร้างรหัสห้องไม่สำเร็จ กรุณาลองใหม่');
  }

  function refForRoom(roomCode) {
    if (!state.db) throw new Error('Firebase not initialized');
    return state.db.ref(`${ROOT_PATH}/${cleanRoom(roomCode)}`);
  }

  async function ensureReady() {
    if (!state.db) {
      const fb = await ensureFirebaseCtx();
      state.db = fb.db;
      state.auth = fb.auth || null;
    }
    if (!state.db) throw new Error('Firebase not initialized');
  }

  function setRoomCode(code) {
    const c = cleanRoom(code || '');
    if (els.roomCodeOut) els.roomCodeOut.textContent = c || '-';
    if (els.roomCode && c) els.roomCode.value = c;
    state.roomCode = c;
  }

  function setStatus(text, type) {
    if (!els.statusMsg) return;
    els.statusMsg.textContent = text || '';
    els.statusMsg.className = `status-text ${type || 'warn'}`;
  }

  function currentPlayerName() {
    const fromRoom = state.room?.players?.[state.playerId]?.name;
    const inputName =
      (els.joinName && els.joinName.value) ||
      (els.hostName && els.hostName.value) ||
      state.displayName ||
      state.pid ||
      'Player';

    return cleanText(fromRoom || inputName, 24);
  }

  function markLeftBestEffort() {
    try {
      if (!state.roomRef || !state.roomCode) return;
      state.roomRef.update({
        [`players/${state.playerId}/presence`]: 'left',
        [`players/${state.playerId}/lastSeen`]: now(),
        updatedAt: now()
      });
    } catch (_) {}
  }

  function getOrCreatePlayerId() {
    const key = 'HHA_GROUPS_PLAYER_ID';
    try {
      const old = localStorage.getItem(key);
      if (old && /^[A-Z0-9_-]{6,40}$/i.test(old)) return old;
      const id = `grp_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`.toUpperCase();
      localStorage.setItem(key, id);
      return id;
    } catch (_) {
      return `grp_${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
    }
  }

  function makeRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = 'GRP-';
    for (let i = 0; i < 6; i++) {
      s += chars[(Math.random() * chars.length) | 0];
    }
    return s;
  }

  function cleanText(v, max = 24) {
    return String(v == null ? '' : v)
      .replace(/[^\wก-๙ _-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);
  }

  function cleanRoom(v) {
    return String(v == null ? '' : v)
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 16);
  }

  function clamp(v, a, b) {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  }

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  function safeErr(err) {
    return err && err.message ? err.message : String(err || 'Unknown error');
  }
})();
