// === /herohealth/vr-groups/groups-race-run.js ===
// HeroHealth • Groups Race Waiting Room / Countdown
// PATCH v20260519-GROUPS-RACE-RUN-V36-DEDUP-PLAYER-LOCK
// - Waiting Room แสดงชื่อซ้ำไม่ได้
// - ใช้ players/{playerKey} แทน players/{uid}
// - Host เริ่มแข่งได้เมื่อมี player slot อย่างน้อย 2 คน
// - LOCAL เข้าได้เฉพาะ local=1

(function () {
  'use strict';

  const VERSION = 'v20260519-groups-race-run-v36-dedup-player-lock';

  const ROOM_ROOT = 'hha-battle/groups/raceRooms';
  const ACTUAL_GAME_PAGE = './groups-race.html';
  const LOBBY_PAGE = './groups-race-lobby.html';
  const HUB_PAGE = 'https://supparang.github.io/webxr-health-mobile/herohealth/hub.html';

  const DOC = document;
  const WIN = window;

  const state = {
    version: VERSION,

    roomId: '',
    name: '',
    playerKey: '',
    uid: '',
    diff: '',
    timeSec: 90,
    startAt: 0,
    seed: '',
    hostUid: '',
    hostPlayerKey: '',
    isHost: false,

    hub: '',
    view: '',
    pid: '',
    studyId: '',
    conditionGroup: '',

    firebase: null,
    db: null,
    auth: null,
    roomRef: null,
    playersRef: null,
    roomOff: null,
    playersOff: null,

    connected: false,
    localOnly: false,
    redirected: false,
    countdownTimer: 0,
    heartbeatTimer: 0,
    lastRoom: null,
    players: {}
  };

  function $(id) {
    return DOC.getElementById(id);
  }

  function qs(name, fallback = '') {
    try {
      return new URL(location.href).searchParams.get(name) || fallback;
    } catch (_) {
      return fallback;
    }
  }

  function now() {
    return Date.now();
  }

  function cleanRoom(v) {
    return String(v || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 16);
  }

  function cleanName(v, fallback = 'Hero') {
    const s = String(v || '')
      .replace(/[^\wก-๙ _-]/g, '')
      .trim()
      .slice(0, 24);

    return s || fallback;
  }

  function playerKeyFromName(name) {
    return String(name || 'Hero')
      .trim()
      .toLowerCase()
      .replace(/[^\wก-๙]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'hero';
  }

  function n(v, fallback) {
    const x = Number(v);
    return Number.isFinite(x) ? x : fallback;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = String(text);
  }

  function setStatus(text, kind = 'warn') {
    const el = $('statusMsg');
    if (!el) return;

    el.textContent = String(text || '');
    el.classList.remove('ok', 'warn', 'err');
    el.classList.add(kind);
  }

  function parseParams() {
    state.roomId = cleanRoom(qs('roomId') || qs('room') || '');
    state.name = cleanName(qs('name') || qs('nick') || localStorage.getItem('HHA_GROUPS_RACE_LAST_NAME') || 'Hero');
    state.playerKey = playerKeyFromName(state.name);

    state.diff = qs('diff', 'normal');
    state.timeSec = n(qs('timeSec') || qs('time'), 90);
    state.startAt = n(qs('startAt'), 0);
    state.seed = qs('seed', '');
    state.hub = qs('hub', HUB_PAGE);
    state.view = qs('view', 'pc');
    state.pid = qs('pid', 'anon');
    state.studyId = qs('studyId', '');
    state.conditionGroup = qs('conditionGroup', '');

    const isExplicitLocalTest = qs('local') === '1';

    if (state.roomId === 'LOCAL' && !isExplicitLocalTest) {
      goLobby('local-not-race');
      return false;
    }

    if (!state.roomId) {
      goLobby('missing-room');
      return false;
    }

    if (state.name) {
      localStorage.setItem('HHA_GROUPS_RACE_LAST_NAME', state.name);
    }

    setText('metaRoom', state.roomId);
    setText('metaName', state.name);

    return true;
  }

  function makeLocalUid() {
    const key = 'HHA_GROUPS_RACE_LOCAL_UID';
    let uid = localStorage.getItem(key);

    if (!uid) {
      uid = `local-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
      localStorage.setItem(key, uid);
    }

    return uid;
  }

  async function waitFirebaseReady(timeoutMs = 9000) {
    if (WIN.HHA_FIREBASE && WIN.HHA_FIREBASE.ready && WIN.HHA_FIREBASE.db) {
      return WIN.HHA_FIREBASE;
    }

    if (WIN.firebase && WIN.firebase.apps && WIN.firebase.apps.length && WIN.firebase.database) {
      return {
        ready: true,
        auth: WIN.firebase.auth ? WIN.firebase.auth() : null,
        db: WIN.firebase.database()
      };
    }

    return new Promise((resolve, reject) => {
      let done = false;

      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error(WIN.HHA_FIREBASE?.error || 'Firebase not ready'));
      }, timeoutMs);

      function cleanup() {
        clearTimeout(timer);
        WIN.removeEventListener('hha:firebase-ready', onReady);
        WIN.removeEventListener('hha:firebase-error', onError);
      }

      function onReady() {
        if (done) return;
        done = true;
        cleanup();
        resolve(WIN.HHA_FIREBASE);
      }

      function onError(e) {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error(e?.detail?.message || WIN.HHA_FIREBASE?.error || 'Firebase init failed'));
      }

      WIN.addEventListener('hha:firebase-ready', onReady, { once: true });
      WIN.addEventListener('hha:firebase-error', onError, { once: true });

      if (WIN.HHA_FIREBASE && WIN.HHA_FIREBASE.ready && WIN.HHA_FIREBASE.db) {
        onReady();
      }
    });
  }

  function dedupPlayersObject(playersObj) {
    const raw = Object.values(playersObj || {}).filter(Boolean);
    const map = new Map();

    raw.forEach((p) => {
      const key = p.playerKey || playerKeyFromName(p.name || p.uid || 'Hero');
      const old = map.get(key);

      if (!old) {
        map.set(key, p);
        return;
      }

      const oldTime = Number(old.updatedAt || old.joinedAt || 0);
      const newTime = Number(p.updatedAt || p.joinedAt || 0);

      if (newTime >= oldTime) {
        map.set(key, p);
      }
    });

    return Array.from(map.values());
  }

  function playerList() {
    return dedupPlayersObject(state.players);
  }

  function connectedPlayers() {
    return playerList().filter((p) => p.connected !== false);
  }

  async function connectFirebase() {
    if (state.roomId === 'LOCAL') {
      state.localOnly = true;
      state.uid = makeLocalUid();
      state.connected = false;
      state.isHost = true;
      state.hostPlayerKey = state.playerKey;

      setStatus('โหมดทดสอบ LOCAL: กดเริ่มแข่งเพื่อเข้าเกมคนเดียว', 'warn');

      state.players = {
        [state.playerKey]: {
          uid: state.uid,
          playerKey: state.playerKey,
          name: state.name,
          ready: true,
          connected: true,
          host: true,
          local: true,
          updatedAt: now()
        }
      };

      renderPlayers();
      renderRoomState({
        status: 'local-test',
        startAt: state.startAt || 0
      });

      updateStartButton();
      return;
    }

    try {
      setStatus('กำลังเชื่อมต่อ Firebase...', 'warn');

      const fb = await waitFirebaseReady();

      state.firebase = fb;
      state.db = fb.db;
      state.auth = fb.auth || null;

      if (!state.db) throw new Error('Firebase database unavailable');

      if (state.auth && !state.auth.currentUser && typeof state.auth.signInAnonymously === 'function') {
        await state.auth.signInAnonymously();
      }

      state.uid =
        state.auth?.currentUser?.uid ||
        WIN.HHA_FIREBASE?.uid ||
        makeLocalUid();

      state.roomRef = state.db.ref(`${ROOM_ROOT}/${state.roomId}`);
      state.playersRef = state.db.ref(`${ROOM_ROOT}/${state.roomId}/players`);

      await state.roomRef.child(`players/${state.playerKey}`).update({
        uid: state.uid,
        playerKey: state.playerKey,
        pid: state.pid,
        name: state.name,
        ready: true,
        connected: true,
        inLobby: false,
        inRun: true,
        inGame: false,
        page: 'groups-race-run',
        updatedAt: now()
      });

      try {
        state.roomRef.child(`players/${state.playerKey}/connected`).onDisconnect().set(false);
        state.roomRef.child(`players/${state.playerKey}/updatedAt`).onDisconnect().set(now());
      } catch (_) {}

      state.roomOff = state.roomRef.on('value', (snap) => {
        const room = snap.val() || {};
        state.lastRoom = room;

        state.hostUid = room.hostUid || state.hostUid || '';
        state.hostPlayerKey = room.hostPlayerKey || state.hostPlayerKey || '';

        state.isHost =
          Boolean(state.hostPlayerKey && state.hostPlayerKey === state.playerKey) ||
          Boolean(state.hostUid && state.hostUid === state.uid);

        if (room.startAt) state.startAt = Number(room.startAt) || state.startAt;
        if (room.seed && !state.seed) state.seed = room.seed;
        if (room.diff) state.diff = room.diff;
        if (room.timeSec) state.timeSec = Number(room.timeSec) || state.timeSec;

        renderRoomState(room);
        updateStartButton();
      });

      state.playersOff = state.playersRef.on('value', (snap) => {
        state.players = snap.val() || {};
        renderPlayers();
        renderRoomState(state.lastRoom || {});
        updateStartButton();
      });

      state.connected = true;
      setStatus('เชื่อมต่อแล้ว • รอผู้เล่นพร้อม หรือให้ Host กดเริ่มแข่ง', 'ok');
    } catch (err) {
      console.warn('[Groups Race Run] Firebase connection failed:', err);

      state.connected = false;
      state.uid = makeLocalUid();

      setStatus('เชื่อมต่อห้องไม่สำเร็จ กรุณากลับ Lobby แล้วเข้าใหม่', 'err');

      state.players = {
        [state.playerKey]: {
          uid: state.uid,
          playerKey: state.playerKey,
          name: state.name,
          ready: true,
          connected: false,
          error: true,
          updatedAt: now()
        }
      };

      renderPlayers();
      updateStartButton();
    }
  }

  function canStartRace() {
    if (state.roomId === 'LOCAL') return true;
    if (!state.connected) return false;
    if (!state.isHost) return false;
    return connectedPlayers().length >= 2;
  }

  function updateStartButton() {
    const btn = $('btnStartRace');
    if (!btn) return;

    const count = connectedPlayers().length;

    if (state.roomId === 'LOCAL') {
      btn.hidden = false;
      btn.disabled = false;
      btn.textContent = '🚀 เริ่ม LOCAL Test';
      return;
    }

    btn.hidden = false;

    if (state.isHost) {
      btn.disabled = count < 2;
      btn.textContent = count < 2 ? 'ต้องมีอย่างน้อย 2 คน' : '🚀 เริ่มแข่ง';
    } else {
      btn.disabled = true;
      btn.textContent = 'รอ Host เริ่ม';
    }
  }

  function renderRoomState(room) {
    const count = connectedPlayers().length;
    const roomStatus = room && room.status ? room.status : 'waiting';

    let text = '';

    if (state.roomId === 'LOCAL') {
      text = state.startAt
        ? 'LOCAL Test: กำลังนับถอยหลังเข้าเกม'
        : 'LOCAL Test Mode: กด “เริ่ม LOCAL Test” เพื่อเข้าเกม';
    } else if (!state.connected) {
      text = 'ยังไม่เชื่อมต่อห้อง Race';
    } else if (state.startAt) {
      text = `เริ่มแข่งพร้อมกันแล้ว • ผู้เล่น ${count} คน`;
    } else if (count < 2) {
      text = `รอผู้เล่นอย่างน้อย 2 คน • ตอนนี้มี ${count} คน`;
    } else if (state.isHost) {
      text = `พร้อมแข่ง • ผู้เล่น ${count} คน • กดเริ่มแข่งได้เลย`;
    } else {
      text = `พร้อมแข่ง • ผู้เล่น ${count} คน • รอ Host กดเริ่ม`;
    }

    if (roomStatus === 'started' && !state.startAt) {
      state.startAt = now() + 1200;
    }

    setText('roomState', text);
  }

  function renderPlayers() {
    const box = $('playersList');
    if (!box) return;

    const players = playerList().sort((a, b) => {
      if (a.host && !b.host) return -1;
      if (!a.host && b.host) return 1;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

    if (!players.length) {
      box.innerHTML = `
        <div class="player">
          <div class="left">
            <div class="avatar">👀</div>
            <div>
              <div class="name">ยังไม่มีผู้เล่น</div>
              <div class="tag">รอข้อมูลจากห้อง</div>
            </div>
          </div>
          <div class="right wait">รอ...</div>
        </div>
      `;
      return;
    }

    box.innerHTML = players.map((p, index) => {
      const isMe =
        p.playerKey === state.playerKey ||
        p.uid === state.uid;

      const name = escapeHtml(p.name || `Player ${index + 1}`);
      const host = p.host ? ' • Host' : '';
      const me = isMe ? ' • คุณ' : '';
      const connected = p.connected !== false;

      return `
        <div class="player">
          <div class="left">
            <div class="avatar">${p.host ? '👑' : connected ? '🏃' : '💤'}</div>
            <div>
              <div class="name">${name}</div>
              <div class="tag">${connected ? 'พร้อมในห้อง' : 'หลุดการเชื่อมต่อ'}${host}${me}</div>
            </div>
          </div>
          <div class="right ${connected ? 'ok' : 'wait'}">${connected ? 'Ready' : 'Offline'}</div>
        </div>
      `;
    }).join('');
  }

  async function startRaceNow() {
    if (state.redirected) return;

    if (!canStartRace()) {
      if (state.roomId !== 'LOCAL' && !state.isHost) {
        setStatus('เฉพาะ Host เท่านั้นที่เริ่มแข่งได้', 'err');
      } else if (state.roomId !== 'LOCAL') {
        setStatus('ต้องมีผู้เล่นอย่างน้อย 2 คนก่อนเริ่ม Race จริง', 'err');
      }
      return;
    }

    const startAt = now() + 3500;
    const seed = state.seed || `${state.roomId}-${now()}`;

    state.startAt = startAt;
    state.seed = seed;

    if (state.roomId === 'LOCAL') {
      setStatus('LOCAL Test: กำลังนับถอยหลังเข้าเกม', 'ok');
      updateCountdown();
      return;
    }

    try {
      await state.roomRef.update({
        status: 'started',
        startAt,
        seed,
        diff: state.diff,
        timeSec: state.timeSec,
        updatedAt: now()
      });

      setStatus('เริ่มแข่งแล้ว • ทุกคนจะเข้าเกมพร้อมกัน', 'ok');
    } catch (err) {
      console.error('[Groups Race Run] startRaceNow failed:', err);
      setStatus('เริ่มแข่งไม่สำเร็จ: ' + (err?.message || err), 'err');
    }
  }

  function updateCountdown() {
    if (state.redirected) return;

    const el = $('countdown');

    if (!state.startAt) {
      if (el) {
        el.textContent = '...';
        el.className = 'count wait';
      }
      return;
    }

    const msLeft = state.startAt - now();
    const secLeft = Math.ceil(msLeft / 1000);

    if (msLeft > 0) {
      if (el) {
        el.textContent = String(secLeft);
        el.className = secLeft <= 3 ? 'count ready' : 'count wait';
      }

      setStatus(
        state.roomId === 'LOCAL'
          ? 'LOCAL Test: กำลังนับถอยหลังเข้าเกม'
          : 'Race พร้อมแล้ว • กำลังนับถอยหลังเข้าเกมพร้อมกัน',
        'ok'
      );

      return;
    }

    if (el) {
      el.textContent = 'GO!';
      el.className = 'count go';
    }

    redirectToGame();
  }

  function buildGameUrl() {
    const u = new URL(ACTUAL_GAME_PAGE, location.href);

    u.searchParams.set('from', 'race-run');
    u.searchParams.set('mode', 'race');
    u.searchParams.set('roomId', state.roomId);
    u.searchParams.set('room', state.roomId);
    u.searchParams.set('name', state.name);
    u.searchParams.set('diff', state.diff || 'normal');
    u.searchParams.set('time', String(state.timeSec || 90));
    u.searchParams.set('timeSec', String(state.timeSec || 90));
    u.searchParams.set('startAt', String(state.startAt || now() + 1200));
    u.searchParams.set('seed', state.seed || `${state.roomId}-${now()}`);

    if (state.roomId === 'LOCAL' || qs('local') === '1') {
      u.searchParams.set('local', '1');
    }

    ['pid', 'view', 'hub', 'zone', 'game', 'studyId', 'conditionGroup'].forEach((k) => {
      const v = state[k] || qs(k, '');
      if (v) u.searchParams.set(k, v);
    });

    return u.toString();
  }

  function redirectToGame() {
    if (state.redirected) return;

    state.redirected = true;
    setStatus('GO! กำลังเข้าเกม Race...', 'ok');

    try {
      if (state.roomRef && state.playerKey) {
        state.roomRef.child(`players/${state.playerKey}`).update({
          inRun: false,
          inGame: true,
          page: 'groups-race',
          updatedAt: now()
        });
      }
    } catch (_) {}

    setTimeout(() => {
      location.href = buildGameUrl();
    }, 350);
  }

  function goLobby(reason = '') {
    const u = new URL(LOBBY_PAGE, location.href);

    ['pid', 'name', 'diff', 'time', 'timeSec', 'view', 'hub', 'zone', 'game', 'studyId', 'conditionGroup'].forEach((k) => {
      const v = qs(k, '');
      if (v) u.searchParams.set(k, v);
    });

    if (state.roomId && state.roomId !== 'LOCAL') {
      u.searchParams.set('room', state.roomId);
      u.searchParams.set('roomId', state.roomId);
    }

    if (state.name) u.searchParams.set('name', state.name);
    if (reason) u.searchParams.set('reason', reason);

    location.href = u.toString();
  }

  function goHub() {
    location.href = state.hub || qs('hub', HUB_PAGE);
  }

  function bindButtons() {
    $('btnStartRace')?.addEventListener('click', startRaceNow);
    $('btnBackLobby')?.addEventListener('click', () => goLobby('back-from-run'));
    $('btnBackHub')?.addEventListener('click', goHub);
  }

  function heartbeat() {
    if (!state.roomRef || !state.playerKey || state.localOnly) return;

    try {
      state.roomRef.child(`players/${state.playerKey}`).update({
        uid: state.uid,
        playerKey: state.playerKey,
        connected: true,
        inRun: true,
        page: 'groups-race-run',
        updatedAt: now()
      });
    } catch (_) {}
  }

  function startTimers() {
    clearInterval(state.countdownTimer);
    state.countdownTimer = setInterval(updateCountdown, 250);

    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = setInterval(heartbeat, 5000);

    updateCountdown();
  }

  function cleanup() {
    clearInterval(state.countdownTimer);
    clearInterval(state.heartbeatTimer);

    try {
      if (state.playersRef && state.playersOff) {
        state.playersRef.off('value', state.playersOff);
      }

      if (state.roomRef && state.roomOff) {
        state.roomRef.off('value', state.roomOff);
      }
    } catch (_) {}
  }

  async function init() {
    console.info('[Groups Race Run] installed', VERSION);

    if (!parseParams()) return;

    bindButtons();

    setText('metaRoom', state.roomId);
    setText('metaName', state.name);
    setText('countdown', '...');
    setStatus('กำลังเตรียมห้อง Race...', 'warn');

    await connectFirebase();

    startTimers();
    updateStartButton();

    WIN.HHA_GROUPS_RACE_RUN = {
      version: VERSION,
      buildGameUrl,
      redirectToGame,
      startRaceNow,
      playerKeyFromName,
      getState: () => ({
        version: VERSION,
        roomId: state.roomId,
        name: state.name,
        playerKey: state.playerKey,
        uid: state.uid,
        isHost: state.isHost,
        connected: state.connected,
        localOnly: state.localOnly,
        startAt: state.startAt,
        players: state.players,
        dedupPlayers: playerList(),
        gameUrl: buildGameUrl()
      })
    };
  }

  WIN.addEventListener('beforeunload', cleanup);

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
