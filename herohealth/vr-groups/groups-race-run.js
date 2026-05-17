// === /herohealth/vr-groups/groups-race-run.js ===
// HeroHealth • Groups Race Waiting Room / Countdown
// Flow:
// groups-race-lobby.html -> groups-race-run.html -> groups-race.html
// PATCH v20260517-GROUPS-RACE-RUN-V2-ROOM-SYNC-LOCK

(function () {
  'use strict';

  const VERSION = 'v20260517-groups-race-run-v2-room-sync-lock';

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
    uid: '',
    diff: '',
    timeSec: 90,
    startAt: 0,
    seed: '',

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
    } catch (e) {
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
    state.diff = qs('diff', 'normal');
    state.timeSec = n(qs('timeSec') || qs('time'), 90);
    state.startAt = n(qs('startAt'), 0);
    state.seed = qs('seed', '');
    state.hub = qs('hub', HUB_PAGE);
    state.view = qs('view', 'pc');
    state.pid = qs('pid', 'anon');
    state.studyId = qs('studyId', '');
    state.conditionGroup = qs('conditionGroup', '');

    if (state.name) {
      localStorage.setItem('HHA_GROUPS_RACE_LAST_NAME', state.name);
    }

    if (!state.roomId) {
      goLobby('missing-room');
      return false;
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

  async function connectFirebase() {
    if (state.roomId === 'LOCAL') {
      state.localOnly = true;
      state.uid = makeLocalUid();
      state.connected = false;

      setStatus('โหมดทดสอบ LOCAL: จะเข้าเกมคนเดียว ไม่ใช่ Race multiplayer จริง', 'warn');

      state.players = {
        [state.uid]: {
          uid: state.uid,
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
        startAt: state.startAt || now() + 1500
      });

      if (!state.startAt) state.startAt = now() + 1500;

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
        try {
          await state.auth.signInAnonymously();
        } catch (e) {
          console.warn('[Groups Race Run] Anonymous auth failed, continue with local uid', e);
        }
      }

      state.uid =
        state.auth?.currentUser?.uid ||
        WIN.HHA_FIREBASE?.uid ||
        makeLocalUid();

      state.roomRef = state.db.ref(`${ROOM_ROOT}/${state.roomId}`);
      state.playersRef = state.db.ref(`${ROOM_ROOT}/${state.roomId}/players`);

      await state.roomRef.child(`players/${state.uid}`).update({
        uid: state.uid,
        name: state.name,
        ready: true,
        connected: true,
        inRun: true,
        page: 'groups-race-run',
        updatedAt: now()
      });

      try {
        state.roomRef.child(`players/${state.uid}/connected`).onDisconnect().set(false);
        state.roomRef.child(`players/${state.uid}/updatedAt`).onDisconnect().set(now());
      } catch (e) {}

      state.roomOff = state.roomRef.on('value', snap => {
        const room = snap.val() || {};
        state.lastRoom = room;

        if (room.startAt) state.startAt = Number(room.startAt) || state.startAt;
        if (room.seed && !state.seed) state.seed = room.seed;
        if (room.diff && !qs('diff')) state.diff = room.diff;
        if (room.timeSec && !qs('timeSec') && !qs('time')) state.timeSec = Number(room.timeSec) || state.timeSec;

        renderRoomState(room);
      });

      state.playersOff = state.playersRef.on('value', snap => {
        state.players = snap.val() || {};
        renderPlayers();
      });

      state.connected = true;
      setStatus('เชื่อมต่อแล้ว • รอเจ้าของห้องเริ่มแข่ง', 'ok');
    } catch (err) {
      console.warn('[Groups Race Run] Firebase connection failed:', err);

      state.connected = false;
      state.uid = makeLocalUid();

      setStatus('เชื่อมต่อห้องไม่สำเร็จ กรุณากลับ Lobby แล้วเข้าใหม่', 'err');

      state.players = {
        [state.uid]: {
          uid: state.uid,
          name: state.name,
          ready: true,
          connected: false,
          error: true,
          updatedAt: now()
        }
      };

      renderPlayers();
    }
  }

  function renderRoomState(room) {
    const players = Object.values(state.players || {});
    const connectedPlayers = players.filter(p => p && p.connected !== false);
    const readyPlayers = connectedPlayers.filter(p => p.ready !== false);
    const count = connectedPlayers.length;

    const roomStatus = room && room.status ? room.status : 'waiting';

    let text = '';

    if (state.roomId === 'LOCAL') {
      text = 'LOCAL Test Mode: เล่นทดสอบคนเดียว ระบบจะเข้าเกมอัตโนมัติ';
    } else if (!state.connected) {
      text = 'ยังไม่เชื่อมต่อห้อง Race';
    } else if (state.startAt) {
      text = `เริ่มแข่งพร้อมกันแล้ว • ผู้เล่น ${count} คน`;
    } else if (count < 2) {
      text = `รอผู้เล่นอย่างน้อย 2 คน • ตอนนี้มี ${count} คน`;
    } else {
      text = `พร้อมแข่ง • ผู้เล่น ${count} คน • รอเจ้าของห้องกดเริ่ม`;
    }

    if (roomStatus === 'started' && !state.startAt) {
      state.startAt = now() + 1200;
    }

    setText('roomState', text);
  }

  function renderPlayers() {
    const box = $('playersList');
    if (!box) return;

    const players = Object.values(state.players || {})
      .filter(Boolean)
      .sort((a, b) => {
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
      const isMe = p.uid === state.uid;
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

    const roomId = state.roomId || qs('roomId') || qs('room') || '';
    const name = state.name || qs('name') || qs('nick') || 'Hero';

    u.searchParams.set('from', 'race-run');
    u.searchParams.set('mode', 'race');
    u.searchParams.set('roomId', roomId);
    u.searchParams.set('room', roomId);
    u.searchParams.set('name', name);

    u.searchParams.set('diff', state.diff || qs('diff', 'normal'));
    u.searchParams.set('time', String(state.timeSec || qs('time', qs('timeSec', '90'))));
    u.searchParams.set('timeSec', String(state.timeSec || qs('timeSec', qs('time', '90'))));

    u.searchParams.set('startAt', String(state.startAt || now() + 1200));
    u.searchParams.set('seed', state.seed || qs('seed', roomId + '-' + Date.now()));

    ['pid', 'view', 'hub', 'zone', 'game', 'studyId', 'conditionGroup'].forEach(k => {
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
      if (state.roomRef && state.uid) {
        state.roomRef.child(`players/${state.uid}`).update({
          inRun: false,
          inGame: true,
          page: 'groups-race',
          updatedAt: now()
        });
      }
    } catch (e) {}

    setTimeout(() => {
      location.href = buildGameUrl();
    }, 350);
  }

  function goLobby(reason = '') {
    const u = new URL(LOBBY_PAGE, location.href);

    ['pid', 'name', 'diff', 'time', 'timeSec', 'view', 'hub', 'zone', 'game', 'studyId', 'conditionGroup'].forEach(k => {
      const v = qs(k, '');
      if (v) u.searchParams.set(k, v);
    });

    if (state.roomId) {
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
    $('btnBackLobby')?.addEventListener('click', () => goLobby('back-from-run'));
    $('btnBackHub')?.addEventListener('click', goHub);
  }

  function heartbeat() {
    if (!state.roomRef || !state.uid || state.localOnly) return;

    try {
      state.roomRef.child(`players/${state.uid}`).update({
        connected: true,
        inRun: true,
        page: 'groups-race-run',
        updatedAt: now()
      });
    } catch (e) {}
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
    } catch (e) {}
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

    WIN.HHA_GROUPS_RACE_RUN = {
      version: VERSION,
      buildGameUrl,
      redirectToGame,
      getState: () => ({
        version: VERSION,
        roomId: state.roomId,
        name: state.name,
        uid: state.uid,
        connected: state.connected,
        localOnly: state.localOnly,
        startAt: state.startAt,
        players: state.players,
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
