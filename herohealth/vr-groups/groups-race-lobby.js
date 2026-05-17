// === /herohealth/vr-groups/groups-race-lobby.js ===
// HeroHealth • Groups Race Lobby
// Stable lobby for create/join room before groups-race-run.html
// PATCH v20260517-GROUPS-RACE-LOBBY-V33-STABLE

(function () {
  'use strict';

  const VERSION = 'v20260517-groups-race-lobby-v33-stable';

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
    } catch (e) {
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

  function setStatus(text, kind = 'warn') {
    const el = $('status');
    if (!el) return;

    el.textContent = String(text || '');
    el.classList.remove('ok', 'warn', 'err');
    el.classList.add(kind);
  }

  function setPreview(room, sub) {
    $('roomPreview').textContent = room || '----';
    $('roomPreviewSub').textContent = sub || (room ? 'พร้อมใช้งาน' : 'ยังไม่ได้สร้างห้อง');
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

  async function waitFirebaseReady(timeoutMs = 7000) {
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

      if (state.auth && !state.auth.currentUser && typeof state.auth.signInAnonymously === 'function') {
        try {
          await state.auth.signInAnonymously();
        } catch (e) {
          console.warn('[Groups Race Lobby] Anonymous auth failed', e);
        }
      }

      state.uid =
        state.auth?.currentUser?.uid ||
        WIN.HHA_FIREBASE?.uid ||
        makeLocalUid();

      state.firebaseReady = true;
      setStatus('Firebase พร้อมแล้ว • สร้างหรือเข้าห้อง Race ได้', 'ok');
    } catch (err) {
      console.warn('[Groups Race Lobby] Firebase unavailable, lobby still usable:', err);

      state.firebaseReady = false;
      state.firebaseError = err?.message || String(err);
      state.uid = makeLocalUid();

      setStatus('Firebase ยังไม่พร้อม แต่ยังตั้งค่าห้องได้ • หากเล่นหลายคนจริงต้องให้ Firebase Online', 'warn');
    }
  }

  function readForm() {
    const name = cleanName($('playerName').value || qs('name') || qs('nick') || 'Hero');
    const room = cleanRoom($('roomInput').value || state.lastRoom || qs('roomId') || qs('room') || '');
    const diff = $('diffSelect').value || qs('diff', 'normal');
    const timeSec = Number($('timeSelect').value || qs('timeSec') || qs('time') || 90);

    return {
      name,
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

    ['pid', 'view', 'hub', 'zone', 'game', 'studyId', 'conditionGroup'].forEach(k => {
      const v = qs(k, '');
      if (v) u.searchParams.set(k, v);
    });

    if (!u.searchParams.get('hub')) {
      u.searchParams.set('hub', HUB_PAGE);
    }

    return u.toString();
  }

  async function createRoom() {
    if (state.busy) return;

    state.busy = true;

    const form = readForm();
    const room = cleanRoom(form.room || randomRoom());

    $('roomInput').value = room;
    state.lastRoom = room;
    setPreview(room, 'กำลังสร้างห้อง...');

    localStorage.setItem('HHA_GROUPS_RACE_LAST_NAME', form.name);
    localStorage.setItem('HHA_GROUPS_RACE_LAST_ROOM', room);

    const seed = `${room}-${now()}`;
    const startAt = now() + 4500;

    try {
      if (state.firebaseReady && state.db) {
        const roomRef = state.db.ref(`${ROOM_ROOT}/${room}`);

        await roomRef.update({
          roomId: room,
          mode: 'race',
          game: 'groups',
          status: 'waiting',
          hostUid: state.uid,
          hostName: form.name,
          diff: form.diff,
          timeSec: form.timeSec,
          seed,
          createdAt: now(),
          updatedAt: now()
        });

        await roomRef.child(`players/${state.uid}`).update({
          uid: state.uid,
          name: form.name,
          host: true,
          ready: true,
          connected: true,
          page: 'groups-race-lobby',
          updatedAt: now()
        });

        setStatus(`สร้างห้อง ${room} แล้ว • กำลังไป Waiting Room`, 'ok');
      } else {
        setStatus(`สร้างรหัสห้อง ${room} แบบ Offline แล้ว • หากต้องการหลายคนจริง Firebase ต้อง Online`, 'warn');
      }

      setPreview(room, 'สร้างห้องแล้ว');

      setTimeout(() => {
        location.href = buildRunUrl(room, form.name, form.diff, form.timeSec, {
          seed,
          startAt
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

    state.lastRoom = room;
    setPreview(room, 'กำลังเข้าห้อง...');

    localStorage.setItem('HHA_GROUPS_RACE_LAST_NAME', form.name);
    localStorage.setItem('HHA_GROUPS_RACE_LAST_ROOM', room);

    try {
      let diff = form.diff;
      let timeSec = form.timeSec;
      let seed = `${room}-${now()}`;
      let startAt = 0;

      if (state.firebaseReady && state.db) {
        const roomRef = state.db.ref(`${ROOM_ROOT}/${room}`);
        const snap = await roomRef.once('value');
        const data = snap.val() || {};

        diff = data.diff || diff;
        timeSec = Number(data.timeSec || timeSec);
        seed = data.seed || seed;
        startAt = Number(data.startAt || 0);

        await roomRef.child(`players/${state.uid}`).update({
          uid: state.uid,
          name: form.name,
          host: false,
          ready: true,
          connected: true,
          page: 'groups-race-lobby',
          updatedAt: now()
        });

        setStatus(`เข้าห้อง ${room} แล้ว • กำลังไป Waiting Room`, 'ok');
      } else {
        setStatus(`เข้า Room Code ${room} แบบ Offline • หากต้องการหลายคนจริง Firebase ต้อง Online`, 'warn');
      }

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
    const form = readForm();
    const room = 'LOCAL';

    localStorage.setItem('HHA_GROUPS_RACE_LAST_NAME', form.name);
    localStorage.setItem('HHA_GROUPS_RACE_LAST_ROOM', room);

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
    const room = cleanRoom($('roomInput').value || state.lastRoom || '');

    if (!room) {
      setStatus('ยังไม่มี Room Code ให้ Copy', 'warn');
      return;
    }

    try {
      await navigator.clipboard.writeText(room);
      setStatus(`Copy Room Code แล้ว: ${room}`, 'ok');
    } catch (e) {
      setStatus(`Room Code: ${room}`, 'ok');
    }
  }

  function goMode() {
    const u = new URL(MODE_PAGE, location.href);

    ['pid', 'name', 'diff', 'time', 'view', 'hub', 'zone', 'game', 'studyId'].forEach(k => {
      const v = qs(k, '');
      if (v) u.searchParams.set(k, v);
    });

    location.href = u.toString();
  }

  function goHub() {
    location.href = qs('hub', HUB_PAGE);
  }

  function bind() {
    $('btnCreate').addEventListener('click', createRoom);
    $('btnJoin').addEventListener('click', joinRoom);
    $('btnLocal').addEventListener('click', localTest);
    $('btnCopy').addEventListener('click', copyRoom);
    $('btnMode').addEventListener('click', goMode);
    $('btnHub').addEventListener('click', goHub);

    $('roomInput').addEventListener('input', () => {
      const room = cleanRoom($('roomInput').value);
      $('roomInput').value = room;
      state.lastRoom = room;
      setPreview(room, room ? 'พร้อมเข้าห้อง' : 'ยังไม่ได้สร้างห้อง');
    });

    $('playerName').addEventListener('input', () => {
      localStorage.setItem('HHA_GROUPS_RACE_LAST_NAME', cleanName($('playerName').value));
    });

    DOC.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        const room = cleanRoom($('roomInput').value);
        if (room) joinRoom();
        else createRoom();
      }
    });
  }

  function hydrateForm() {
    const lastName = localStorage.getItem('HHA_GROUPS_RACE_LAST_NAME') || '';
    const lastRoom = localStorage.getItem('HHA_GROUPS_RACE_LAST_ROOM') || '';

    $('playerName').value = cleanName(qs('name') || qs('nick') || lastName || 'Hero');

    const room = cleanRoom(qs('roomId') || qs('room') || lastRoom || '');
    $('roomInput').value = room;
    state.lastRoom = room;

    const diff = qs('diff', '');
    if (diff && $('diffSelect').querySelector(`option[value="${diff}"]`)) {
      $('diffSelect').value = diff;
    }

    const time = qs('timeSec') || qs('time') || '';
    if (time && $('timeSelect').querySelector(`option[value="${time}"]`)) {
      $('timeSelect').value = time;
    }

    setPreview(room, room ? 'พร้อมเข้าห้อง' : 'ยังไม่ได้สร้างห้อง');
  }

  async function init() {
    console.info('[Groups Race Lobby] installed', VERSION);

    hydrateForm();
    bind();

    WIN.HHA_GROUPS_RACE_LOBBY = {
      version: VERSION,
      createRoom,
      joinRoom,
      localTest,
      buildRunUrl,
      getState: () => ({
        version: VERSION,
        firebaseReady: state.firebaseReady,
        firebaseError: state.firebaseError,
        uid: state.uid,
        lastRoom: state.lastRoom
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
