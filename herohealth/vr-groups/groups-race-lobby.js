(function () {
  'use strict';

  const ROOM_ROOT = 'hha-battle/groups/raceRooms';
  const START_DELAY_MS = 3500;

  // เปลี่ยนได้ถ้าชื่อไฟล์ run ของคุณไม่ตรงนี้
  const RUN_PAGE = './groups-race-run.html';

  const qs = new URLSearchParams(location.search);

  const state = {
    roomId: '',
    uid: '',
    name: '',
    isHost: false,
    roomRef: null,
    roomListener: null,
    redirecting: false,
    lastRoomData: null
  };

  function $(sel) {
    try { return document.querySelector(sel); }
    catch (_) { return null; }
  }

  function pick(...selectors) {
    for (const sel of selectors) {
      const el = $(sel);
      if (el) return el;
    }
    return null;
  }

  const el = {
    createName: pick('#hostName', '#createName', '#nickCreate', 'input[name="createName"]'),
    joinName: pick('#joinName', '#nickJoin', 'input[name="joinName"]'),
    joinRoom: pick('#roomCode', '#joinRoomCode', '#joinRoom', '#roomId', 'input[name="roomCode"]'),
    diff: pick('#diff', '#difficulty', 'select[name="diff"]'),
    time: pick('#timeSec', '#time', '#duration', 'select[name="time"]'),
    btnCreate: pick('#btnCreateRoom', '[data-action="create-room"]'),
    btnJoin: pick('#btnJoinRoom', '[data-action="join-room"]'),
    btnStart: pick('#btnStartRace', '[data-action="start-race"]'),
    status: pick('#statusMsg', '#raceStatus', '.status-text', '.error-text', '[data-role="status"]'),
    roomCodeOut: pick('#roomCodeOut', '#createdRoomCode', '[data-role="room-code"]'),
    players: pick('#playersList', '.players-list', '[data-role="players"]')
  };

  function setStatus(message) {
    console.log('[Groups Race]', message);
    if (el.status) el.status.textContent = message;
  }

  function setRoomCode(roomId) {
    if (el.roomCodeOut) el.roomCodeOut.textContent = roomId || '-';
    if (el.joinRoom && roomId && !String(el.joinRoom.value || '').trim()) {
      el.joinRoom.value = roomId;
    }
  }

  function num(v, d = 0) {
    v = Number(v);
    return Number.isFinite(v) ? v : d;
  }

  function cleanName(v, fallback) {
    const s = String(v || '')
      .replace(/[^\wก-๙ _-]/g, '')
      .trim()
      .slice(0, 24);
    return s || fallback;
  }

  function cleanRoom(v) {
    return String(v || '')
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 16);
  }

  function genRoomCode(prefix = 'GRP') {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = prefix + '-';
    for (let i = 0; i < 6; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }

  function now() {
    return Date.now();
  }

  function getFirebase() {
    return window.HHA_FIREBASE || null;
  }

  function waitFirebaseReady(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const fb = getFirebase();
      if (fb && fb.ready && fb.auth && fb.db) {
        resolve(fb);
        return;
      }

      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error(getFirebase()?.error || 'Firebase not initialized'));
      }, timeoutMs);

      function onReady() {
        if (done) return;
        done = true;
        cleanup();
        resolve(getFirebase());
      }

      function onError(e) {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error(e?.detail?.message || getFirebase()?.error || 'Firebase init failed'));
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

  function onceValue(ref) {
    return new Promise((resolve, reject) => {
      ref.once('value', resolve, reject);
    });
  }

  function getRunParamsBase() {
    return {
      zone: qs.get('zone') || 'nutrition',
      game: qs.get('game') || 'groups',
      mode: 'race',
      entry: qs.get('entry') || 'race',
      hub: qs.get('hub') || 'https://supparang.github.io/webxr-health-mobile/herohealth/hub.html',
      run: qs.get('run') || 'play',
      view: qs.get('view') || 'mobile',
      seed: qs.get('seed') || '',
      studyId: qs.get('studyId') || '',
      pid: qs.get('pid') || ''
    };
  }

  function buildRunUrl(roomId, name, diff, timeSec, startAt) {
    const base = getRunParamsBase();
    const u = new URL(RUN_PAGE, location.href);

    u.searchParams.set('roomId', roomId);
    u.searchParams.set('room', roomId);
    u.searchParams.set('name', name);
    u.searchParams.set('nick', name);
    u.searchParams.set('diff', diff || 'normal');
    u.searchParams.set('time', String(timeSec || 60));
    u.searchParams.set('timeSec', String(timeSec || 60));
    u.searchParams.set('mode', 'race');
    u.searchParams.set('game', base.game);
    u.searchParams.set('zone', base.zone);
    u.searchParams.set('entry', base.entry);
    u.searchParams.set('hub', base.hub);
    u.searchParams.set('run', base.run);
    u.searchParams.set('view', base.view);

    if (base.seed) u.searchParams.set('seed', base.seed);
    if (base.studyId) u.searchParams.set('studyId', base.studyId);
    if (base.pid) u.searchParams.set('pid', base.pid);
    if (startAt) u.searchParams.set('startAt', String(startAt));

    return u.toString();
  }

  function renderPlayers(playersObj) {
    if (!el.players) return;
    const players = Object.values(playersObj || {});
    players.sort((a, b) => num(a.joinedAt) - num(b.joinedAt));

    el.players.innerHTML = players.map((p) => {
      const badge = p.isHost ? ' 👑' : '';
      const ready = p.ready ? 'พร้อม' : 'ยังไม่พร้อม';
      return `
        <div class="player-row" style="display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08);">
          <div>${escapeHtml(p.name || p.uid || 'Player')}${badge}</div>
          <div style="opacity:.8">${ready}</div>
        </div>
      `;
    }).join('') || '<div style="opacity:.8">ยังไม่มีผู้เล่น</div>';
  }

  function escapeHtml(s) {
    return String(s || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function updateStartButton(roomData) {
    if (!el.btnStart) return;

    const players = Object.values(roomData?.players || {});
    const readyCount = players.filter(p => p.ready).length;
    const canStart = state.isHost && players.length >= 2 && readyCount >= 2 && roomData?.status === 'lobby';

    el.btnStart.disabled = !canStart;
    el.btnStart.style.opacity = canStart ? '1' : '.55';
  }

  function detachRoomListener() {
    if (state.roomRef && state.roomListener) {
      state.roomRef.off('value', state.roomListener);
    }
    state.roomRef = null;
    state.roomListener = null;
  }

  function attachRoomListener(roomId) {
    const fb = getFirebase();
    if (!fb?.db) return;

    detachRoomListener();

    const ref = fb.db.ref(`${ROOM_ROOT}/${roomId}`);
    state.roomRef = ref;
    state.roomListener = (snap) => {
      const data = snap.val();
      state.lastRoomData = data || null;

      if (!data) {
        setStatus('ห้องถูกลบหรือไม่พบข้อมูลห้อง');
        return;
      }

      setRoomCode(data.roomId || roomId);
      renderPlayers(data.players || {});
      updateStartButton(data);

      const players = Object.values(data.players || {});
      const readyCount = players.filter(p => p.ready).length;

      if (data.status === 'lobby') {
        setStatus(`อยู่ในห้อง ${roomId} • ผู้เล่น ${players.length} คน • พร้อม ${readyCount} คน`);
      }

      if (data.status === 'starting' && !state.redirecting) {
        state.redirecting = true;
        const startAt = num(data.startAt, now() + START_DELAY_MS);
        const waitMs = Math.max(0, startAt - now());

        setStatus(`กำลังเริ่มเกม... ${Math.ceil(waitMs / 1000)} วิ`);

        setTimeout(() => {
          const diff = data.diff || 'normal';
          const timeSec = num(data.timeSec, 60);
          location.href = buildRunUrl(roomId, state.name, diff, timeSec, startAt);
        }, waitMs);
      }
    };

    ref.on('value', state.roomListener);
  }

  async function createRoom() {
    try {
      setStatus('กำลังเชื่อมต่อ Firebase...');
      const fb = await waitFirebaseReady();

      const uid = fb.auth.currentUser?.uid || fb.uid || ('anon_' + now());
      const roomId = genRoomCode('GRP');
      const name = cleanName(el.createName?.value, 'Host');
      const diff = el.diff?.value || 'normal';
      const timeSec = Math.max(30, num(el.time?.value, 60));

      state.uid = uid;
      state.name = name;
      state.roomId = roomId;
      state.isHost = true;

      const ref = fb.db.ref(`${ROOM_ROOT}/${roomId}`);

      await ref.set({
        roomId,
        game: 'groups',
        mode: 'race',
        status: 'lobby',
        hostId: uid,
        createdAt: now(),
        updatedAt: now(),
        diff,
        timeSec,
        players: {
          [uid]: {
            uid,
            name,
            isHost: true,
            ready: true,
            joinedAt: now(),
            updatedAt: now()
          }
        }
      });

      localStorage.setItem('HHA_GROUPS_RACE_LAST_ROOM', roomId);
      localStorage.setItem('HHA_GROUPS_RACE_LAST_NAME', name);

      setRoomCode(roomId);
      setStatus(`สร้างห้องสำเร็จ: ${roomId}`);
      attachRoomListener(roomId);

    } catch (err) {
      console.error(err);
      setStatus(`สร้างห้องไม่สำเร็จ: ${err?.message || err}`);
    }
  }

  async function joinRoom() {
    try {
      setStatus('กำลังเชื่อมต่อ Firebase...');
      const fb = await waitFirebaseReady();

      const uid = fb.auth.currentUser?.uid || fb.uid || ('anon_' + now());
      const roomId = cleanRoom(el.joinRoom?.value);
      const name = cleanName(el.joinName?.value, 'ผู้เล่น');

      if (!roomId) {
        throw new Error('กรุณาใส่รหัสห้อง');
      }

      const ref = fb.db.ref(`${ROOM_ROOT}/${roomId}`);
      const snap = await onceValue(ref);

      if (!snap.exists()) {
        throw new Error('ไม่พบห้องนี้');
      }

      const data = snap.val() || {};
      if (data.status && data.status !== 'lobby') {
        throw new Error('ห้องนี้เริ่มเกมไปแล้ว');
      }

      state.uid = uid;
      state.name = name;
      state.roomId = roomId;
      state.isHost = false;

      await ref.child(`players/${uid}`).set({
        uid,
        name,
        isHost: false,
        ready: true,
        joinedAt: now(),
        updatedAt: now()
      });

      await ref.update({
        updatedAt: now()
      });

      localStorage.setItem('HHA_GROUPS_RACE_LAST_ROOM', roomId);
      localStorage.setItem('HHA_GROUPS_RACE_LAST_NAME', name);

      setRoomCode(roomId);
      setStatus(`เข้าห้องสำเร็จ: ${roomId}`);
      attachRoomListener(roomId);

    } catch (err) {
      console.error(err);
      setStatus(`เข้าห้องไม่สำเร็จ: ${err?.message || err}`);
    }
  }

  async function startRace() {
    try {
      if (!state.roomId) throw new Error('ยังไม่มีห้อง');
      if (!state.isHost) throw new Error('เฉพาะเจ้าของห้องเท่านั้น');

      const fb = await waitFirebaseReady();
      const ref = fb.db.ref(`${ROOM_ROOT}/${state.roomId}`);
      const snap = await onceValue(ref);

      if (!snap.exists()) throw new Error('ไม่พบห้อง');

      const data = snap.val() || {};
      const players = Object.values(data.players || {});
      const readyCount = players.filter(p => p.ready).length;

      if (players.length < 2) {
        throw new Error('ต้องมีอย่างน้อย 2 คน');
      }
      if (readyCount < 2) {
        throw new Error('ผู้เล่นยังพร้อมไม่ครบ');
      }

      const startAt = now() + START_DELAY_MS;

      await ref.update({
        status: 'starting',
        startAt,
        updatedAt: now()
      });

      setStatus('เริ่มนับถอยหลังเข้าสู่เกม...');

    } catch (err) {
      console.error(err);
      setStatus(`เริ่มเกมไม่สำเร็จ: ${err?.message || err}`);
    }
  }

  function bindEvents() {
    el.btnCreate?.addEventListener('click', createRoom);
    el.btnJoin?.addEventListener('click', joinRoom);
    el.btnStart?.addEventListener('click', startRace);
  }

  function hydrateFromLocal() {
    const lastRoom = cleanRoom(localStorage.getItem('HHA_GROUPS_RACE_LAST_ROOM') || '');
    const lastName = localStorage.getItem('HHA_GROUPS_RACE_LAST_NAME') || '';

    if (el.joinRoom && !el.joinRoom.value && lastRoom) el.joinRoom.value = lastRoom;
    if (el.joinName && !el.joinName.value && lastName) el.joinName.value = lastName;
    if (el.createName && !el.createName.value && lastName) el.createName.value = lastName;
  }

  async function boot() {
    bindEvents();
    hydrateFromLocal();

    if (el.btnStart) {
      el.btnStart.disabled = true;
      el.btnStart.style.opacity = '.55';
    }

    setStatus('พร้อมใช้งาน');

    try {
      await waitFirebaseReady();
      setStatus('เชื่อมต่อ Firebase สำเร็จ');
    } catch (err) {
      setStatus(`Firebase ยังไม่พร้อม: ${err?.message || err}`);
    }
  }

  boot();

  window.GROUPS_RACE_LOBBY = {
    createRoom,
    joinRoom,
    startRace
  };
})();