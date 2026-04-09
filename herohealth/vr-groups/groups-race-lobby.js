(() => {
  'use strict';

  const W = window;
  const D = document;
  const q = new URLSearchParams(location.search);

  const ROOT_PATH = 'rooms/groups/race';
  const HEARTBEAT_MS = 2500;
  const ACTIVE_TTL_MS = 15000;
  const STORE_KEY = 'HHA_GROUPS_RACE_LOBBY_STATE_V3';

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
    btnCopyCode: $('#btnCopyCode'),
    latestResultBody: $('.hha-race-lobby-winner__body')
  };

  const state = {
    db: null,
    auth: null,
    authUid: '',
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
      q.get('name') || q.get('nickName') || q.get('nick') || '',
      24
    ),
    lastRenderedWinnerKey: ''
  };

  prefillInputs();
  bindEvents();
  boot();

  function prefillInputs() {
    const diff = q.get('diff') || 'normal';
    const timeSec = q.get('timeSec') || q.get('time') || '60';
    const roomCode = cleanRoom(q.get('roomCode') || q.get('code') || '');
    const fallbackName = state.displayName || cleanText(q.get('pid') || 'Player', 24);
    const saved = loadJson(STORE_KEY, null);

    if (els.hostName && !els.hostName.value) els.hostName.value = fallbackName;
    if (els.joinName && !els.joinName.value) els.joinName.value = fallbackName;
    if (els.diff) els.diff.value = ['easy', 'normal', 'hard'].includes(diff) ? diff : 'normal';
    if (els.timeSec) els.timeSec.value = ['60', '90', '120'].includes(String(timeSec)) ? String(timeSec) : '60';
    if (els.roomCode && roomCode) els.roomCode.value = roomCode;

    if (saved) {
      if (els.hostName && !els.hostName.value && saved.lastName) els.hostName.value = cleanText(saved.lastName, 24);
      if (els.joinName && !els.joinName.value && saved.lastName) els.joinName.value = cleanText(saved.lastName, 24);
      if (els.roomCode && !els.roomCode.value && saved.roomCode) els.roomCode.value = cleanRoom(saved.roomCode);
      if (els.diff && saved.diff && ['easy','normal','hard'].includes(saved.diff)) els.diff.value = saved.diff;
      if (els.timeSec && saved.timeSec && ['60','90','120'].includes(String(saved.timeSec))) els.timeSec.value = String(saved.timeSec);
    }

    renderLatestResult(null);
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

      await ensureAuthUser();

      setStatus('พร้อมใช้งาน สร้างห้องหรือเข้าห้องได้เลย', 'ok');

      const roomCode = cleanRoom(q.get('roomCode') || q.get('code') || '');
      if (roomCode) {
        state.roomCode = roomCode;
        if (els.roomCode) els.roomCode.value = roomCode;
      }

      const autoCode = cleanRoom((els.roomCode && els.roomCode.value) || state.roomCode || '');
      if (autoCode) {
        tryAutoAttach(autoCode);
      }
    } catch (err) {
      console.error('[Groups Race] init failed:', err);
      setStatus(`เชื่อมต่อ Firebase ไม่สำเร็จ: ${safeErr(err)}`, 'err');
    }
  }

  async function tryAutoAttach(roomCode) {
    try {
      const roomRef = refForRoom(roomCode);
      const snap = await roomRef.child('meta').once('value');
      if (snap.exists()) {
        attachRoom(roomCode);
      }
    } catch (_) {}
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

    if (!W.firebase) throw new Error('Firebase SDK not loaded');

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

    if (!db) throw new Error('Realtime Database SDK not available');

    const ctx = { app, auth, db, config: cfg, ready: true };
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

  async function ensureAuthUser() {
    if (!state.auth) {
      const fb = await ensureFirebaseCtx();
      state.auth = fb.auth || null;
    }

    if (!state.auth) throw new Error('Firebase Auth not available');

    if (state.auth.currentUser && state.auth.currentUser.uid) {
      state.authUid = state.auth.currentUser.uid;
      return state.auth.currentUser.uid;
    }

    return await new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        try { off && off(); } catch (_) {}
        reject(new Error('Anonymous auth not ready'));
      }, 8000);

      const off = state.auth.onAuthStateChanged((user) => {
        if (done) return;
        if (user && user.uid) {
          done = true;
          clearTimeout(timer);
          state.authUid = user.uid;
          off();
          resolve(user.uid);
        }
      }, (err) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { off && off(); } catch (_) {}
        reject(err);
      });
    });
  }

  function myUid() {
    return state.authUid || (state.auth && state.auth.currentUser && state.auth.currentUser.uid) || '';
  }

  async function onCreateRoom() {
    try {
      await ensureReady();
      const uid = myUid();
      if (!uid) throw new Error('ยังไม่ได้รับ auth uid');

      const hostName = cleanText(
        (els.hostName && els.hostName.value) || state.displayName || 'Player',
        24
      );
      const diff = (els.diff && els.diff.value) || 'normal';
      const timeSec = clamp(Number((els.timeSec && els.timeSec.value) || 60), 30, 300);
      const roomCode = await allocateRoomCode();
      const createdAt = now();

      if (els.hostName) els.hostName.value = hostName;
      if (els.joinName && !els.joinName.value) els.joinName.value = hostName;

      const roomRef = refForRoom(roomCode);

      await roomRef.child('meta').set({
        roomId: roomCode,
        game: 'groups',
        zone: q.get('zone') || 'nutrition',
        mode: 'race',
        hostUid: uid,
        state: 'lobby',
        diff,
        timeSec,
        seed: String(q.get('seed') || createdAt),
        capacity: 4,
        teamMode: false,
        createdAt,
        updatedAt: createdAt,
        startedAt: null
      });

      await roomRef.child(`players/${uid}`).set(
        buildPlayerPayload(hostName, true, createdAt)
      );

      state.isHost = true;

      saveJson(STORE_KEY, {
        roomCode,
        lastName: hostName,
        diff,
        timeSec
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
      const uid = myUid();
      if (!uid) throw new Error('ยังไม่ได้รับ auth uid');

      const joinName = cleanText(
        (els.joinName && els.joinName.value) || state.displayName || 'Player',
        24
      );
      const roomCode = cleanRoom((els.roomCode && els.roomCode.value) || state.roomCode || '');

      if (!roomCode) throw new Error('กรุณากรอกรหัสห้อง');

      if (els.joinName) els.joinName.value = joinName;
      if (els.roomCode) els.roomCode.value = roomCode;

      const roomRef = refForRoom(roomCode);
      const snap = await roomRef.once('value');
      const room = snap.val();

      if (!room || !room.meta) throw new Error('ไม่พบห้องนี้');
      if (String(room.meta.state || '') !== 'lobby') throw new Error('ห้องนี้เริ่มแข่งไปแล้ว');

      const joinedAt = Number(room?.players?.[uid]?.joinedAt) || now();

      await roomRef.child(`players/${uid}`).set(
        buildPlayerPayload(joinName, false, joinedAt)
      );

      state.isHost = String(room.meta.hostUid || '') === String(uid);

      saveJson(STORE_KEY, {
        roomCode,
        lastName: joinName,
        diff: room.meta.diff || (els.diff && els.diff.value) || 'normal',
        timeSec: room.meta.timeSec || (els.timeSec && els.timeSec.value) || '60'
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
      const uid = myUid();

      if (!state.roomRef || !state.room || !state.room.meta) throw new Error('ยังไม่มีข้อมูลห้อง');
      if (String(state.room.meta.hostUid || '') !== String(uid)) {
        throw new Error('เฉพาะเจ้าของห้องเท่านั้นที่กดเริ่มแข่งได้');
      }

      const activePlayers = getPlayers(state.room).filter((p) => p.active);
      if (activePlayers.length < 2) throw new Error('ต้องมีผู้เล่นอย่างน้อย 2 คน');

      const startAt = now() + 1600;

      await state.roomRef.child('meta').update({
        state: 'countdown',
        startedAt: startAt,
        updatedAt: now(),
        seed: String(state.room.meta.seed || q.get('seed') || now())
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
      if (!code || code === '-') throw new Error('ยังไม่มีรหัสห้อง');

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

      if (!room || !room.meta) {
        renderNoRoom('ไม่พบข้อมูลห้อง หรือห้องถูกลบแล้ว');
        renderLatestResult(null);
        setStatus('ไม่พบข้อมูลห้องนี้', 'err');
        return;
      }

      state.isHost = String(room.meta.hostUid || '') === String(myUid());
      setRoomCode(room.meta.roomId || cleanCode);
      renderRoom(room);
      renderLatestResult(room);
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
    if (!state.roomRef || !state.roomCode) return;

    await ensureReady();
    const uid = myUid();
    if (!uid) return;

    const joinedAt = Number(state.room?.players?.[uid]?.joinedAt) || now();
    const name = currentPlayerName();

    await state.roomRef.child(`players/${uid}`).set(
      buildPlayerPayload(name, state.isHost, joinedAt)
    );
  }

  function maybeEnterRace(room) {
    const roomState = String(room?.meta?.state || '');
    if ((roomState !== 'countdown' && roomState !== 'running') || state.navigating) return;

    state.navigating = true;
    setStatus('ห้องเริ่มแข่งแล้ว กำลังพาเข้าเกม...', 'ok');

    const delay = Math.max(0, Number(room?.meta?.startedAt || now()) - now());
    W.setTimeout(() => {
      location.href = buildRunUrl(room);
    }, Math.min(delay, 2600));
  }

  function buildRunUrl(room) {
    const meta = room?.meta || {};
    const base = new URL(q.get('runUrl') || './groups.html', location.href);
    const params = new URLSearchParams(base.search);

    for (const [k, v] of q.entries()) {
      params.set(k, v);
    }

    params.set('mode', 'race');
    params.set('race', '1');
    params.set('roomCode', cleanRoom(meta.roomId || state.roomCode));
    params.set('code', cleanRoom(meta.roomId || state.roomCode));
    params.set('pid', state.pid || 'anon');
    params.set('name', currentPlayerName());
    params.set('diff', meta.diff || params.get('diff') || 'normal');
    params.set('time', String(meta.timeSec || params.get('time') || 60));
    params.set('timeSec', String(meta.timeSec || params.get('timeSec') || 60));
    params.set('seed', String(meta.seed || params.get('seed') || now()));
    params.set('view', q.get('view') || params.get('view') || 'mobile');
    params.set('hub', q.get('hub') || params.get('hub') || 'https://supparang.github.io/webxr-health-mobile/herohealth/hub.html');
    params.set('isHost', state.isHost ? '1' : '0');
    params.set('hostUid', String(meta.hostUid || ''));
    params.set('players', String(getPlayers(room).filter((p) => p.active).length));
    params.set('game', params.get('game') || 'groups');
    params.set('gameId', params.get('gameId') || 'groups');
    params.set('zone', params.get('zone') || meta.zone || 'nutrition');
    params.set('cat', params.get('cat') || meta.zone || 'nutrition');

    base.search = params.toString();
    return base.toString();
  }

  function renderRoom(room) {
    const meta = room?.meta || {};
    const roomState = String(meta.state || 'lobby');
    const players = getPlayers(room);
    const activePlayers = players.filter((p) => p.active);
    const activeCount = activePlayers.length;

    if (!players.length) {
      renderNoRoom('ยังไม่มีผู้เล่นในห้อง');
    } else if (els.playersList) {
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

    if (roomState === 'countdown' || roomState === 'running') {
      setStatus('ห้องเริ่มแข่งแล้ว กำลังพาเข้าเกม...', 'ok');
    } else if (activeCount < 2) {
      setStatus(
        state.isHost ? 'รอผู้เล่นอย่างน้อย 2 คนก่อนเริ่มแข่ง' : 'เข้าห้องแล้ว รอให้ครบอย่างน้อย 2 คน',
        'warn'
      );
    } else {
      setStatus(
        state.isHost ? 'พร้อมแล้ว กดเริ่มแข่งได้เลย' : 'พร้อมแล้ว รอเจ้าของห้องกดเริ่มแข่ง',
        'ok'
      );
    }

    if (els.diff && meta.diff && !state.isHost) els.diff.value = meta.diff;
    if (els.timeSec && meta.timeSec && !state.isHost) els.timeSec.value = String(meta.timeSec);

    if (els.btnStartRace) {
      els.btnStartRace.disabled = !(
        state.isHost &&
        roomState === 'lobby' &&
        activeCount >= 2
      );
    }
  }

  function renderNoRoom(message) {
    if (els.playersList) {
      els.playersList.innerHTML = `<div class="player-empty">${escapeHtml(message || 'ยังไม่มีข้อมูลห้อง')}</div>`;
    }
    if (els.btnStartRace) els.btnStartRace.disabled = true;
  }

  function renderLatestResult(room) {
    if (!els.latestResultBody) return;

    const standings = getLatestStandings(room);
    if (!standings.length) {
      els.latestResultBody.innerHTML = `<div class="hha-race-lobby-winner__empty">ยังไม่มีผลแข่งของห้องนี้</div>`;
      return;
    }

    const winner = standings[0];
    const active = getPlayers(room).filter((p) => p.active);

    const key = JSON.stringify({
      roomCode: room?.meta?.roomId || state.roomCode,
      standings: standings.map((p) => [p.uid, p.score, p.miss, p.bestStreak, p.updatedAt]),
      active: active.map((p) => [p.uid, p.active])
    });

    if (key === state.lastRenderedWinnerKey) return;
    state.lastRenderedWinnerKey = key;

    els.latestResultBody.innerHTML = `
      <div class="hha-race-lobby-winner__hero">
        <div class="hha-race-lobby-winner__crown">👑</div>
        <div class="hha-race-lobby-winner__copy">
          <div class="hha-race-lobby-winner__eyebrow">แชมป์รอบล่าสุด</div>
          <div class="hha-race-lobby-winner__name">${escapeHtml(winner.name || 'Player')}</div>
          <div class="hha-race-lobby-winner__meta">
            SCORE ${num(winner.score)} · MISS ${num(winner.miss)} · STREAK ${num(winner.bestStreak)}
          </div>
        </div>
      </div>

      <div class="hha-race-lobby-winner__board">
        ${standings.slice(0, 5).map((p, idx) => `
          <div class="hha-race-lobby-winner__row ${idx === 0 ? 'is-top' : ''}">
            <div class="hha-race-lobby-winner__left">
              <div class="hha-race-lobby-winner__place">${idx + 1}</div>
              <div class="hha-race-lobby-winner__player">${escapeHtml(p.name || 'Player')}</div>
            </div>
            <div class="hha-race-lobby-winner__right">
              <div class="hha-race-lobby-winner__score">${num(p.score)}</div>
              <div class="hha-race-lobby-winner__stat">MISS ${num(p.miss)} · STREAK ${num(p.bestStreak)}</div>
            </div>
          </div>
        `).join('')}
      </div>

      ${active.length ? `
        <div class="hha-race-lobby-winner__active">
          ออนไลน์ตอนนี้: ${active.map((p) => `${escapeHtml(p.name)}${p.isHost ? ' (host)' : ''}`).join(' • ')}
        </div>
      ` : ''}
    `;
  }

  function getLatestStandings(room) {
    const resultsMap = room?.results || {};
    const playersMap = room?.players || {};

    return Object.keys(resultsMap).map((uid) => {
      const r = resultsMap[uid] || {};
      const p = playersMap[uid] || {};
      return {
        uid,
        name: cleanText(p.name || r.pid || 'Player', 24),
        score: num(r.score),
        miss: num(r.miss),
        bestStreak: num(r.bestStreak),
        finished: !!r.finished,
        updatedAt: num(r.updatedAt)
      };
    }).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.miss !== b.miss) return a.miss - b.miss;
      if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
      return a.updatedAt - b.updatedAt;
    });
  }

  function getPlayers(room) {
    const playersMap = room?.players || {};
    const hostUid = String(room?.meta?.hostUid || '');
    const t = now();
    const uidMe = myUid();

    return Object.keys(playersMap).map((uid) => {
      const p = playersMap[uid] || {};
      const lastPingAt = Number(p.lastPingAt || 0);
      const active = (t - lastPingAt) <= ACTIVE_TTL_MS;

      return {
        uid,
        key: uid,
        playerId: String(p.pid || uid),
        pid: String(p.pid || ''),
        name: cleanText(p.name || 'Player', 24),
        joinedAt: Number(p.joinedAt || 0),
        active,
        isHost: uid === hostUid || p.role === 'host',
        isMe: uid === uidMe
      };
    }).sort((a, b) => {
      if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.joinedAt - b.joinedAt;
    });
  }

  function buildPlayerPayload(name, isHost, joinedAt) {
    const uid = myUid();
    return {
      uid,
      pid: state.pid,
      name: cleanText(name || 'Player', 24),
      ready: true,
      role: isHost ? 'host' : 'player',
      joinedAt: Number(joinedAt || now()),
      lastPingAt: now()
    };
  }

  async function allocateRoomCode() {
    for (let i = 0; i < 8; i++) {
      const code = makeRoomCode();
      const snap = await refForRoom(code).child('meta').once('value');
      if (!snap.exists()) return code;
    }
    throw new Error('สร้างรหัสห้องไม่สำเร็จ กรุณาลองใหม่');
  }

  function refForRoom(roomCode) {
    if (!state.db) throw new Error('Firebase not initialized');
    return state.db.ref(`${ROOT_PATH}/${cleanRoom(roomCode)}`);
  }

  async function ensureReady() {
    if (!state.db || !state.auth) {
      const fb = await ensureFirebaseCtx();
      state.db = fb.db;
      state.auth = fb.auth || null;
    }
    if (!state.db) throw new Error('Firebase not initialized');

    await ensureAuthUser();
    if (!myUid()) throw new Error('Anonymous auth uid missing');
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
    const fromRoom = state.room?.players?.[myUid()]?.name;
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
      const uid = myUid();
      if (!state.roomRef || !uid) return;
      state.roomRef.child(`players/${uid}`).update({
        ready: false,
        lastPingAt: 0
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
    for (let i = 0; i < 6; i++) s += chars[(Math.random() * chars.length) | 0];
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

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
})();