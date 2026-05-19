// === /herohealth/vr-groups/groups-race-lobby.js ===
// HeroHealth • Groups Race Lobby
// PATCH v20260519-GROUPS-RACE-LOBBY-V36-DEDUP-PLAYER-LOCK
// Hard Lock:
// - LOCAL ใช้เฉพาะปุ่มทดสอบคนเดียว
// - Race จริงต้องใช้ Room Code ที่ไม่ใช่ LOCAL
// - 1 ชื่อผู้เล่น = 1 player slot ต่อ 1 ห้อง
// - ถ้า refresh / เข้าใหม่ด้วยชื่อเดิม จะ update slot เดิม ไม่เพิ่มแถวซ้ำ

(function () {
  'use strict';

  const VERSION = 'v20260519-groups-race-lobby-v36-dedup-player-lock';

  const ROOM_ROOT = 'hha-battle/groups/raceRooms';
  const RUN_PAGE = './groups-race-run.html';
  const MODE_PAGE = './groups-mode.html';
  const HUB_PAGE = 'https://supparang.github.io/webxr-health-mobile/herohealth/hub.html';

  const DOC = document;
  const WIN = window;

  const state = {
    version: VERSION,
    firebaseReady: false,
    firebaseError: '',
    db: null,
    auth: null,
    uid: '',
    lastRoom: '',
    busy: false
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

  function cleanName(v, fallback = 'Hero') {
    const s = String(v || '')
      .replace(/[^\wก-๙ _-]/g, '')
      .trim()
      .slice(0, 24);

    return s || fallback;
  }

  function cleanRoom(v) {
    return String(v || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 16);
  }

  function playerKeyFromName(name) {
    return String(name || 'Hero')
      .trim()
      .toLowerCase()
      .replace(/[^\wก-๙]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'hero';
  }

  async function removeDuplicateNamePlayers(roomRef, name, keepKey) {
    try {
      const snap = await roomRef.child('players').once('value');
      const players = snap.val() || {};
      const target = playerKeyFromName(name);
      const updates = {};

      Object.keys(players).forEach((key) => {
        const p = players[key] || {};
        const sameName = playerKeyFromName(p.name || '') === target;

        if (sameName && key !== keepKey) {
          updates[`players/${key}`] = null;
        }
      });

      if (Object.keys(updates).length) {
        await roomRef.update(updates);
      }
    } catch (err) {
      console.warn('[Groups Race Lobby] removeDuplicateNamePlayers failed', err);
    }
  }

  function setStatus(text, kind = 'warn') {
    const el = $('status');
    if (!el) return;

    el.textContent = String(text || '');
    el.classList.remove('ok', 'warn', 'err');
    el.classList.add(kind);
  }

  function setPreview(room, sub) {
    const roomEl = $('roomPreview');
    const subEl = $('roomPreviewSub');

    if (roomEl) roomEl.textContent = room || '----';
    if (subEl) subEl.textContent = sub || (room ? 'พร้อมใช้งาน' : 'ยังไม่ได้สร้างห้อง');
  }

  function randomRoom() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = 'R';

    for (let i = 0; i < 5; i += 1) {
      s += chars[Math.floor(Math.random() * chars.length)];
    }

    return s;
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

  async function waitFirebaseReady(timeoutMs = 8000) {
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

  async function connectFirebaseSoft() {
    try {
      setStatus('กำลังตรวจสอบ Firebase...', 'warn');

      const fb = await waitFirebaseReady();

      state.db = fb.db;
      state.auth = fb.auth || null;

      if (!state.db) throw new Error('Firebase database unavailable');

      if (!state.auth && WIN.firebase && WIN.firebase.auth) {
        state.auth = WIN.firebase.auth();
      }

      if (!state.auth) throw new Error('Firebase Auth unavailable');

      if (!state.auth.currentUser && typeof state.auth.signInAnonymously === 'function') {
        await state.auth.signInAnonymously();
      }

      if (!state.auth.currentUser || !state.auth.currentUser.uid) {
        throw new Error('Anonymous Auth not active');
      }

      state.uid = state.auth.currentUser.uid;
      state.firebaseReady = true;
      state.firebaseError = '';

      setStatus('Firebase พร้อมแล้ว • สร้างหรือเข้าห้อง Race จริงได้', 'ok');
    } catch (err) {
      console.warn('[Groups Race Lobby] Firebase unavailable:', err);

      state.firebaseReady = false;
      state.firebaseError = err?.message || String(err);
      state.uid = makeLocalUid();

      setStatus(
        'Firebase ยังไม่พร้อมสำหรับ Race multiplayer จริง • ใช้ปุ่ม LOCAL ได้เฉพาะทดสอบคนเดียว',
        'warn'
      );
    }
  }

  function readForm() {
    const name = cleanName(
      $('playerName')?.value ||
      qs('name') ||
      qs('nick') ||
      'Hero'
    );

    const room = cleanRoom(
      $('roomInput')?.value ||
      state.lastRoom ||
      qs('roomId') ||
      qs('room') ||
      ''
    );

    const diff = $('diffSelect')?.value || qs('diff', 'normal');
    const rawTime = $('timeSelect')?.value || qs('timeSec') || qs('time') || 90;
    const timeSec = Number(rawTime);

    return {
      name,
      playerKey: playerKeyFromName(name),
      room,
      diff,
      timeSec: Number.isFinite(timeSec) ? timeSec : 90
    };
  }

  function buildRunUrl(roomId, name, diff, timeSec, options = {}) {
    const u = new URL(RUN_PAGE, location.href);

    u.searchParams.set('roomId', roomId);
    u.searchParams.set('room', roomId);
    u.searchParams.set('name', name);
    u.searchParams.set('diff', diff);
    u.searchParams.set('timeSec', String(timeSec));
    u.searchParams.set('time', String(timeSec));
    u.searchParams.set('mode', 'race');
    u.searchParams.set('from', 'race-lobby');

    if (options.local) {
      u.searchParams.set('local', '1');
      u.searchParams.set('startAt', String(now() + 1500));
    }

    if (options.startAt) {
      u.searchParams.set('startAt', String(options.startAt));
    }

    if (options.seed) {
      u.searchParams.set('seed', options.seed);
    }

    ['pid', 'view', 'hub', 'zone', 'game', 'studyId', 'conditionGroup'].forEach((k) => {
      const v = qs(k, '');
      if (v) u.searchParams.set(k, v);
    });

    if (!u.searchParams.get('hub')) {
      u.searchParams.set('hub', HUB_PAGE);
    }

    return u.toString();
  }

  function requireFirebaseForRealRace() {
    if (!state.firebaseReady || !state.db || !state.auth || !state.auth.currentUser) {
      setStatus(
        'ยังสร้าง/เข้าห้อง Race จริงไม่ได้ เพราะ Firebase หรือ Anonymous Auth ยังไม่พร้อม',
        'err'
      );
      return false;
    }

    return true;
  }

  async function createRoom() {
    if (state.busy) return;

    state.busy = true;

    const form = readForm();
    let room = cleanRoom(form.room || randomRoom());

    if (room === 'LOCAL') {
      room = randomRoom();

      if ($('roomInput')) $('roomInput').value = room;
      setPreview(room, 'สร้าง Room Code ใหม่สำหรับ Race จริง');

      setStatus(
        'LOCAL ใช้เฉพาะปุ่ม “ทดสอบ LOCAL คนเดียว” เท่านั้น • สร้าง Room Code ใหม่ให้แล้ว',
        'warn'
      );
    }

    if (!room) room = randomRoom();

    if (!requireFirebaseForRealRace()) {
      state.busy = false;
      return;
    }

    if ($('roomInput')) $('roomInput').value = room;

    state.lastRoom = room;
    setPreview(room, 'กำลังสร้างห้อง...');

    localStorage.setItem('HHA_GROUPS_RACE_LAST_NAME', form.name);
    localStorage.setItem('HHA_GROUPS_RACE_LAST_ROOM', room);

    const seed = `${room}-${now()}`;
    const roomRef = state.db.ref(`${ROOM_ROOT}/${room}`);
    const playerKey = form.playerKey;

    try {
      await removeDuplicateNamePlayers(roomRef, form.name, playerKey);

      await roomRef.update({
        roomId: room,
        mode: 'race',
        raceType: 'groups-race',
        game: 'groups',
        zone: 'nutrition',
        status: 'waiting',
        hostUid: state.uid,
        hostPlayerKey: playerKey,
        hostName: form.name,
        diff: form.diff,
        timeSec: form.timeSec,
        seed,
        capacity: 10,
        createdAt: now(),
        updatedAt: now()
      });

      await roomRef.child(`players/${playerKey}`).update({
        uid: state.uid,
        playerKey,
        pid: qs('pid', 'anon'),
        name: form.name,
        host: true,
        ready: true,
        connected: true,
        inLobby: true,
        inRun: false,
        inGame: false,
        page: 'groups-race-lobby',
        joinedAt: now(),
        updatedAt: now()
      });

      setStatus(`สร้างห้อง ${room} แล้ว • กำลังไป Waiting Room`, 'ok');
      setPreview(room, 'สร้างห้องแล้ว');

      setTimeout(() => {
        location.href = buildRunUrl(room, form.name, form.diff, form.timeSec, {
          seed
        });
      }, 350);
    } catch (err) {
      console.error('[Groups Race Lobby] createRoom failed:', err);
      setStatus('สร้างห้องไม่สำเร็จ: ' + (err?.message || err), 'err');
      state.busy = false;
    }
  }

  async function joinRoom() {
    if (state.busy) return;

    state.busy = true;

    const form = readForm();
    const room = cleanRoom(form.room);

    if (!room) {
      setStatus('กรุณาใส่ Room Code ก่อนเข้าห้อง', 'err');
      state.busy = false;
      return;
    }

    if (room === 'LOCAL') {
      setStatus(
        'LOCAL ใช้เฉพาะปุ่ม “ทดสอบ LOCAL คนเดียว” เท่านั้น ถ้าจะ Race จริงต้องใช้ Room Code อื่น',
        'err'
      );
      state.busy = false;
      return;
    }

    if (!requireFirebaseForRealRace()) {
      state.busy = false;
      return;
    }

    state.lastRoom = room;
    setPreview(room, 'กำลังเข้าห้อง...');

    localStorage.setItem('HHA_GROUPS_RACE_LAST_NAME', form.name);
    localStorage.setItem('HHA_GROUPS_RACE_LAST_ROOM', room);

    const roomRef = state.db.ref(`${ROOM_ROOT}/${room}`);
    const playerKey = form.playerKey;

    try {
      const snap = await roomRef.once('value');
      const data = snap.val() || {};

      if (!data.roomId && !data.createdAt) {
        setStatus(`ไม่พบห้อง ${room} • ให้ Host สร้างห้องก่อน`, 'err');
        state.busy = false;
        return;
      }

      const diff = data.diff || form.diff;
      const timeSec = Number(data.timeSec || form.timeSec);
      const seed = data.seed || `${room}-${now()}`;
      const startAt = Number(data.startAt || 0);

      await removeDuplicateNamePlayers(roomRef, form.name, playerKey);

      await roomRef.child(`players/${playerKey}`).update({
        uid: state.uid,
        playerKey,
        pid: qs('pid', 'anon'),
        name: form.name,
        host: false,
        ready: true,
        connected: true,
        inLobby: true,
        inRun: false,
        inGame: false,
        page: 'groups-race-lobby',
        joinedAt: now(),
        updatedAt: now()
      });

      await roomRef.update({
        updatedAt: now()
      });

      setStatus(`เข้าห้อง ${room} แล้ว • กำลังไป Waiting Room`, 'ok');
      setPreview(room, 'เข้าห้องแล้ว');

      setTimeout(() => {
        location.href = buildRunUrl(room, form.name, diff, timeSec, {
          seed,
          startAt
        });
      }, 350);
    } catch (err) {
      console.error('[Groups Race Lobby] joinRoom failed:', err);
      setStatus('เข้าห้องไม่สำเร็จ: ' + (err?.message || err), 'err');
      state.busy = false;
    }
  }

  function localTest() {
    if (state.busy) return;

    state.busy = true;

    const form = readForm();
    const room = 'LOCAL';

    localStorage.setItem('HHA_GROUPS_RACE_LAST_NAME', form.name);
    localStorage.removeItem('HHA_GROUPS_RACE_LAST_ROOM');

    if ($('roomInput')) $('roomInput').value = '';

    setPreview(room, 'โหมดทดสอบคนเดียว');
    setStatus('กำลังเข้า LOCAL Test • ไม่ใช่ Race multiplayer จริง', 'warn');

    setTimeout(() => {
      location.href = buildRunUrl(room, form.name, form.diff, form.timeSec, {
        local: true,
        seed: `LOCAL-${now()}`
      });
    }, 250);
  }

  async function copyRoom() {
    const room = cleanRoom($('roomInput')?.value || state.lastRoom || '');

    if (!room) {
      setStatus('ยังไม่มี Room Code ให้ Copy', 'warn');
      return;
    }

    if (room === 'LOCAL') {
      setStatus('LOCAL ไม่ใช่ Room Code สำหรับ Race จริง', 'err');
      return;
    }

    try {
      await navigator.clipboard.writeText(room);
      setStatus(`Copy Room Code แล้ว: ${room}`, 'ok');
    } catch (_) {
      setStatus(`Room Code: ${room}`, 'ok');
    }
  }

  function goMode() {
    const u = new URL(MODE_PAGE, location.href);

    ['pid', 'name', 'diff', 'time', 'view', 'hub', 'zone', 'game', 'studyId'].forEach((k) => {
      const v = qs(k, '');
      if (v) u.searchParams.set(k, v);
    });

    location.href = u.toString();
  }

  function goHub() {
    location.href = qs('hub', HUB_PAGE);
  }

  function bind() {
    $('btnCreate')?.addEventListener('click', createRoom);
    $('btnJoin')?.addEventListener('click', joinRoom);
    $('btnLocal')?.addEventListener('click', localTest);
    $('btnCopy')?.addEventListener('click', copyRoom);
    $('btnMode')?.addEventListener('click', goMode);
    $('btnHub')?.addEventListener('click', goHub);

    $('roomInput')?.addEventListener('input', () => {
      let room = cleanRoom($('roomInput').value);

      if (room === 'LOCAL') {
        setStatus('LOCAL ใช้เฉพาะปุ่ม “ทดสอบ LOCAL คนเดียว” เท่านั้น', 'err');
      }

      $('roomInput').value = room;
      state.lastRoom = room;

      setPreview(room, room ? 'พร้อมเข้าห้อง' : 'ยังไม่ได้สร้างห้อง');
    });

    $('playerName')?.addEventListener('input', () => {
      localStorage.setItem(
        'HHA_GROUPS_RACE_LAST_NAME',
        cleanName($('playerName').value)
      );
    });

    DOC.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        const room = cleanRoom($('roomInput')?.value || '');

        if (room && room !== 'LOCAL') joinRoom();
        else createRoom();
      }
    });
  }

  function hydrateForm() {
    const lastName = localStorage.getItem('HHA_GROUPS_RACE_LAST_NAME') || '';
    const lastRoom = localStorage.getItem('HHA_GROUPS_RACE_LAST_ROOM') || '';

    const name = cleanName(qs('name') || qs('nick') || lastName || 'Hero');
    if ($('playerName')) $('playerName').value = name;

    let room = cleanRoom(qs('roomId') || qs('room') || lastRoom || '');

    if (room === 'LOCAL') {
      room = '';
      localStorage.removeItem('HHA_GROUPS_RACE_LAST_ROOM');
    }

    if ($('roomInput')) $('roomInput').value = room;
    state.lastRoom = room;

    const diff = qs('diff', '');
    if (diff && $('diffSelect')?.querySelector(`option[value="${diff}"]`)) {
      $('diffSelect').value = diff;
    }

    const time = qs('timeSec') || qs('time') || '';
    if (time && $('timeSelect')?.querySelector(`option[value="${time}"]`)) {
      $('timeSelect').value = time;
    }

    setPreview(room, room ? 'พร้อมเข้าห้อง' : 'ยังไม่ได้สร้างห้อง');
  }

  function showReasonFromUrl() {
    const reason = qs('reason', '');
    if (!reason) return;

    if (reason === 'missing-room') {
      setStatus('ต้องสร้างหรือเข้าห้อง Race ก่อนเริ่มเกม', 'warn');
    } else if (reason === 'local-not-race') {
      setStatus('LOCAL ไม่ใช่ Race multiplayer จริง กรุณาสร้าง Room Code ใหม่ หรือกดปุ่ม LOCAL Test', 'err');
    } else if (reason === 'back-from-run') {
      setStatus('กลับมาจาก Waiting Room แล้ว สามารถสร้าง/เข้าห้องใหม่ได้', 'warn');
    }
  }

  async function init() {
    console.info('[Groups Race Lobby] installed', VERSION);

    hydrateForm();
    bind();
    showReasonFromUrl();

    WIN.HHA_GROUPS_RACE_LOBBY = {
      version: VERSION,
      createRoom,
      joinRoom,
      localTest,
      buildRunUrl,
      playerKeyFromName,
      getState: () => ({
        version: VERSION,
        firebaseReady: state.firebaseReady,
        firebaseError: state.firebaseError,
        uid: state.uid,
        lastRoom: state.lastRoom,
        busy: state.busy,
        path: ROOM_ROOT
      })
    };

    await connectFirebaseSoft();
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
