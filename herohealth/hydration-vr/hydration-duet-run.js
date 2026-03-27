/* /herohealth/hydration-vr/hydration-duet-run.js
   FULL PATCH v20260327-HYDRATION-DUET-RUN-R1
*/
(function () {
  'use strict';

  const W = window;
  const D = document;
  const $ = (id) => D.getElementById(id);

  const UI = {
    tabHelp: $('tabHelp'),
    tabLobby: $('tabLobby'),
    btnHub: $('btnHub'),
    btnHubTop: $('btnHubTop'),
    btnHubMain: $('btnHubMain'),

    helpPanel: $('helpPanel'),
    lobbyPanel: $('lobbyPanel'),

    authStatePill: $('authStatePill'),
    roomCodeValue: $('roomCodeValue'),
    peerStatePill: $('peerStatePill'),
    roomStatusText: $('roomStatusText'),
    infoTarget: $('infoTarget'),
    infoDiff: $('infoDiff'),
    infoView: $('infoView'),
    infoTime: $('infoTime'),

    statusBanner: $('statusBanner'),
    statusBannerText: $('statusBannerText'),

    player1Name: $('player1Name'),
    player1State: $('player1State'),
    player2Name: $('player2Name'),
    player2State: $('player2State'),

    countdownNumber: $('countdownNumber'),
    countdownFill: $('countdownFill'),
    errorText: $('errorText'),

    btnCopyInvite: $('btnCopyInvite'),
    btnReady: $('btnReady'),
    btnResetRoom: $('btnResetRoom'),

    logBox: $('logBox'),
  };

  const qs = new URLSearchParams(location.search);
  const q = (k, d = '') => {
    const v = qs.get(k);
    return v == null || v === '' ? d : v;
  };

  const GAME = 'hydration';
  const MODE = 'duet';
  const ROOM_PATH_BASE = `hha-battle/${GAME}/duetRooms`;

  const state = {
    firebase: null,
    auth: null,
    db: null,
    user: null,
    uid: '',
    pid: '',
    nick: '',
    roomCode: '',
    roomRef: null,
    playerRef: null,
    targetPath: '',
    hub: '',
    diff: '',
    view: '',
    time: 0,
    seed: '',
    zone: '',
    cat: '',
    theme: '',
    run: '',
    room: null,
    roomPlayers: [],
    isHost: false,
    countdownTimer: 0,
    startedNavigation: false,
    countdownWriteLock: false,
    heartbeatTimer: 0
  };

  function log(msg, extra) {
    const line = `[hydration duet] ${msg}${extra ? ` ${JSON.stringify(extra)}` : ''}`;
    console.log(line);
    if (UI.logBox) {
      UI.logBox.textContent = `${line}\n${UI.logBox.textContent}`.slice(0, 5000);
    }
  }

  function setBanner(type, title, text) {
    if (!UI.statusBanner || !UI.statusBannerText) return;
    UI.statusBanner.className = `banner ${type}`;
    const titleEl = UI.statusBanner.querySelector('.bannerTitle');
    if (titleEl) titleEl.textContent = title;
    UI.statusBannerText.textContent = text;
  }

  function setPill(el, kind, text) {
    if (!el) return;
    el.className = `pillState ${kind}`;
    el.textContent = text;
  }

  function showPanel(name) {
    const helpOn = name === 'help';
    if (UI.helpPanel) UI.helpPanel.classList.toggle('show', helpOn);
    if (UI.helpPanel) UI.helpPanel.style.display = helpOn ? 'grid' : 'none';
    if (UI.lobbyPanel) UI.lobbyPanel.style.display = helpOn ? 'none' : 'grid';

    if (UI.tabHelp) UI.tabHelp.classList.toggle('active', helpOn);
    if (UI.tabLobby) UI.tabLobby.classList.toggle('active', !helpOn);
  }

  function normalizePid(v) {
    return String(v || 'anon').trim().replace(/[.#$[\]/]/g, '-').slice(0, 80) || 'anon';
  }

  function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  function getFirebaseConfig() {
    if (W.HHA_FIREBASE_CONFIG && W.HHA_FIREBASE_CONFIG.databaseURL) {
      return W.HHA_FIREBASE_CONFIG;
    }
    return null;
  }

  function ensureFirebaseApp() {
    const firebaseConfig = getFirebaseConfig();
    if (!firebaseConfig) {
      throw new Error('Missing Firebase config');
    }
    if (!W.firebase) {
      throw new Error('Firebase SDK not loaded');
    }

    const app = (W.firebase.apps && W.firebase.apps.length)
      ? W.firebase.app()
      : W.firebase.initializeApp(firebaseConfig);

    return {
      app,
      auth: W.firebase.auth(),
      db: W.firebase.database()
    };
  }

  function currentHubUrl() {
    return state.hub || q('hub', new URL('../hub.html', location.href).href);
  }

  function currentTargetPath() {
    return state.targetPath || q('target', './hydration-vr.html');
  }

  function buildInviteUrl() {
    const u = new URL(location.href);
    u.searchParams.set('roomCode', state.roomCode);
    u.searchParams.set('mode', MODE);
    u.searchParams.set('game', GAME);
    u.searchParams.set('theme', state.theme);
    u.searchParams.set('zone', state.zone);
    u.searchParams.set('cat', state.cat);
    u.searchParams.set('diff', state.diff);
    u.searchParams.set('time', String(state.time));
    u.searchParams.set('seed', state.seed);
    u.searchParams.set('view', state.view);
    u.searchParams.set('run', state.run);
    u.searchParams.set('target', state.targetPath);
    u.searchParams.set('hub', state.hub);
    return u.toString();
  }

  function buildRunUrl() {
    const u = new URL(state.targetPath, location.href);
    const peer = state.roomPlayers.find(p => p.uid !== state.uid) || null;

    u.searchParams.set('game', GAME);
    u.searchParams.set('theme', state.theme);
    u.searchParams.set('zone', state.zone);
    u.searchParams.set('cat', state.cat);
    u.searchParams.set('mode', MODE);
    u.searchParams.set('multiplayer', MODE);
    u.searchParams.set('multiMode', MODE);
    u.searchParams.set('roomCode', state.roomCode);
    u.searchParams.set('hub', state.hub);
    u.searchParams.set('pid', state.pid);
    u.searchParams.set('nick', state.nick);
    u.searchParams.set('uid', state.uid);
    if (peer && peer.uid) u.searchParams.set('peerUid', peer.uid);
    if (state.room && state.room.hostId) u.searchParams.set('hostId', state.room.hostId);
    u.searchParams.set('diff', state.diff);
    u.searchParams.set('time', String(state.time));
    u.searchParams.set('seed', String(state.seed));
    u.searchParams.set('view', state.view);
    u.searchParams.set('run', state.run);
    u.searchParams.set('startAt', String(state.room?.startAt || Date.now()));
    return u.toString();
  }

  async function copyInvite() {
    const text = buildInviteUrl();
    try {
      await navigator.clipboard.writeText(text);
      setBanner('good', 'คัดลอกลิงก์แล้ว', 'ส่งลิงก์นี้ให้เพื่อนอีกคนเข้า room เดียวกันได้เลย');
    } catch (err) {
      setBanner('bad', 'คัดลอกไม่สำเร็จ', 'ลองคัดลอก roomCode ด้วยตนเอง หรือรีเฟรชหน้าแล้วลองใหม่');
    }
  }

  function goHub() {
    location.href = currentHubUrl();
  }

  function makePlayerPatch(readyOverride) {
    const ready = typeof readyOverride === 'boolean'
      ? readyOverride
      : !!(state.roomPlayers.find(p => p.uid === state.uid)?.ready);

    return {
      id: state.uid,
      uid: state.uid,
      pid: state.pid,
      name: state.nick,
      ready,
      connected: true,
      phase: 'lobby',
      finished: false,
      finalScore: 0,
      miss: 0,
      streak: 0,
      joinedAt: Date.now(),
      lastSeenAt: Date.now()
    };
  }

  async function ensureAnonymousAuth(auth) {
    if (auth.currentUser) return auth.currentUser;

    await auth.signInAnonymously();

    return await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Auth timeout')), 10000);
      const unsub = auth.onAuthStateChanged((user) => {
        if (user) {
          clearTimeout(t);
          unsub();
          resolve(user);
        }
      }, (err) => {
        clearTimeout(t);
        unsub();
        reject(err);
      });
    });
  }

  async function createOrJoinRoom() {
    const roomRef = state.roomRef;
    const snap = await roomRef.once('value');
    const room = snap.val();

    if (!room) {
      const initial = {
        roomId: state.roomCode,
        game: GAME,
        mode: MODE,
        hostId: state.uid,
        hostName: state.nick,
        diff: state.diff,
        time: state.time,
        seed: String(state.seed),
        view: state.view,
        hub: state.hub,
        run: state.run,
        zone: state.zone,
        cat: state.cat,
        theme: state.theme,
        target: state.targetPath,
        status: 'waiting',
        minPlayers: 2,
        maxPlayers: 2,
        startAt: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        match: {
          status: 'idle',
          lockedAt: 0
        }
      };
      await roomRef.set(initial);
      log('created room', { roomCode: state.roomCode });
    }

    const playersSnap = await roomRef.child('players').once('value');
    const players = playersSnap.val() || {};
    const ids = Object.keys(players);

    if (ids.length >= 2 && !players[state.uid]) {
      throw new Error('Room is full');
    }

    await roomRef.child(`players/${state.uid}`).update(makePlayerPatch(false));
    state.playerRef = roomRef.child(`players/${state.uid}`);

    try {
      state.playerRef.child('connected').onDisconnect().set(false);
      state.playerRef.child('phase').onDisconnect().set('left');
      state.playerRef.child('lastSeenAt').onDisconnect().set(Date.now());
    } catch (err) {
      log('onDisconnect skipped', { message: String(err && err.message || err) });
    }
  }

  function startHeartbeat() {
    stopHeartbeat();
    state.heartbeatTimer = W.setInterval(() => {
      if (!state.playerRef) return;
      state.playerRef.update({
        connected: true,
        lastSeenAt: Date.now()
      }).catch((err) => {
        log('heartbeat failed', { message: String(err && err.message || err) });
      });
    }, 4000);
  }

  function stopHeartbeat() {
    if (state.heartbeatTimer) {
      clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = 0;
    }
  }

  function subscribeRoom() {
    state.roomRef.on('value', (snap) => {
      state.room = snap.val() || null;
      const playersObj = (state.room && state.room.players) ? state.room.players : {};
      state.roomPlayers = Object.values(playersObj)
        .filter(Boolean)
        .sort((a, b) => Number(a.joinedAt || 0) - Number(b.joinedAt || 0));

      state.isHost = !!(state.room && state.room.hostId === state.uid);

      renderRoom();
      maybeHostStartCountdown();
      maybeAdvanceCountdown();
    }, (err) => {
      setBanner('bad', 'อ่านสถานะห้องไม่สำเร็จ', String(err && err.message || err));
    });
  }

  function renderRoom() {
    const room = state.room || {};
    const players = state.roomPlayers || [];
    const me = players.find(p => p.uid === state.uid) || null;
    const peer = players.find(p => p.uid !== state.uid) || null;

    if (UI.roomCodeValue) UI.roomCodeValue.textContent = state.roomCode || '—';
    if (UI.roomStatusText) UI.roomStatusText.textContent = room.status || 'waiting';
    if (UI.infoTarget) UI.infoTarget.textContent = state.targetPath;
    if (UI.infoDiff) UI.infoDiff.textContent = state.diff;
    if (UI.infoView) UI.infoView.textContent = state.view;
    if (UI.infoTime) UI.infoTime.textContent = String(state.time);

    if (W.HHA_FIREBASE_READY) {
      setPill(UI.authStatePill, 'pill-ok', `firebase ready • uid ${String(state.uid).slice(0, 8)}`);
    } else {
      setPill(UI.authStatePill, 'pill-bad', 'firebase not ready');
    }

    if (peer) {
      const peerOnline = !!peer.connected && peer.phase !== 'left';
      setPill(UI.peerStatePill, peerOnline ? 'pill-ok' : 'pill-wait', peerOnline ? 'peer online' : 'peer offline');
    } else {
      setPill(UI.peerStatePill, 'pill-wait', 'กำลังรอผู้เล่นอีกคน');
    }

    if (UI.player1Name) UI.player1Name.textContent = players[0]?.name || 'Player 1';
    if (UI.player2Name) UI.player2Name.textContent = players[1]?.name || 'Player 2';

    setPill(
      UI.player1State,
      players[0]?.ready ? 'pill-ok' : 'pill-soft',
      players[0] ? `${players[0].ready ? 'ready' : 'waiting'}${players[0].uid === state.uid ? ' • me' : ''}` : 'waiting'
    );

    setPill(
      UI.player2State,
      players[1]?.ready ? 'pill-ok' : 'pill-soft',
      players[1] ? `${players[1].ready ? 'ready' : 'waiting'}${players[1].uid === state.uid ? ' • me' : ''}` : 'waiting'
    );

    const bothPresent = players.length >= 2;
    const bothReady = bothPresent && players.every(p => !!p.ready);
    const roomStatus = room.status || 'waiting';

    if (roomStatus === 'waiting') {
      if (!bothPresent) {
        setBanner('warn', 'รอเพื่อนอีกคน', 'ส่งลิงก์หรือ roomCode ให้เพื่อนเข้า join ห้องนี้');
        if (UI.errorText) UI.errorText.textContent = 'ยังมีผู้เล่นไม่ครบ 2 คน';
      } else if (!bothReady) {
        setBanner('warn', 'ผู้เล่นครบแล้ว', 'ให้ทั้งสองคนกดปุ่ม “ฉันพร้อม” แล้วระบบจะเริ่ม countdown');
        if (UI.errorText) UI.errorText.textContent = 'ผู้เล่นครบแล้ว แต่ยังไม่ ready ทั้งคู่';
      } else {
        setBanner('good', 'พร้อมเริ่ม', 'ทั้งสองคน ready แล้ว กำลังเริ่ม countdown');
        if (UI.errorText) UI.errorText.textContent = 'ทั้งสองคนพร้อมแล้ว กำลังเริ่ม countdown';
      }
    } else if (roomStatus === 'countdown') {
      setBanner('good', 'กำลังนับถอยหลัง', 'เมื่อครบ 0 ระบบจะเข้า run พร้อมกัน');
    } else if (roomStatus === 'running') {
      setBanner('good', 'กำลังเข้า run', 'ถ้ายังไม่เปลี่ยนหน้า ให้รอสักครู่');
      if (UI.errorText) UI.errorText.textContent = 'กำลังเข้า run พร้อมกัน…';
    } else if (roomStatus === 'finished') {
      setBanner('warn', 'รอบก่อนจบแล้ว', 'กดรีเซ็ตห้องเพื่อเริ่มรอบใหม่');
    }

    const myReady = !!(me && me.ready);
    if (UI.btnReady) {
      UI.btnReady.textContent = myReady ? '↩️ ยกเลิกพร้อม' : '✅ ฉันพร้อม';
      UI.btnReady.className = `uiBtn ${myReady ? 'warn' : 'green'}`;
    }

    if (UI.btnResetRoom) {
      UI.btnResetRoom.disabled = !state.isHost;
      UI.btnResetRoom.style.opacity = state.isHost ? '1' : '.55';
    }
  }

  async function toggleReady() {
    if (!state.playerRef) return;
    const me = state.roomPlayers.find(p => p.uid === state.uid);
    const nextReady = !(me && me.ready);

    await state.playerRef.update({
      ready: nextReady,
      connected: true,
      phase: 'lobby',
      lastSeenAt: Date.now()
    });

    log('toggle ready', { ready: nextReady });
  }

  async function resetRoom() {
    if (!state.isHost || !state.roomRef) return;

    const updates = {
      status: 'waiting',
      startAt: 0,
      updatedAt: Date.now(),
      'match/status': 'idle',
      'match/lockedAt': 0
    };

    const players = state.roomPlayers || [];
    for (const p of players) {
      updates[`players/${p.uid}/ready`] = false;
      updates[`players/${p.uid}/phase`] = 'lobby';
      updates[`players/${p.uid}/finished`] = false;
      updates[`players/${p.uid}/connected`] = true;
      updates[`players/${p.uid}/lastSeenAt`] = Date.now();
    }

    await state.roomRef.update(updates);
    setBanner('warn', 'รีเซ็ตห้องแล้ว', 'ผู้เล่นทั้งสองคนต้องกดพร้อมอีกครั้ง');
  }

  async function maybeHostStartCountdown() {
    if (!state.isHost || !state.roomRef || state.countdownWriteLock) return;
    const room = state.room || {};
    const players = state.roomPlayers || [];

    const bothPresent = players.length >= 2;
    const bothReady = bothPresent && players.every(p => !!p.ready);

    if (room.status !== 'waiting' || !bothReady) return;

    state.countdownWriteLock = true;
    try {
      await state.roomRef.update({
        status: 'countdown',
        startAt: Date.now() + 3500,
        updatedAt: Date.now(),
        'match/status': 'locked',
        'match/lockedAt': Date.now()
      });
      log('countdown started');
    } catch (err) {
      log('countdown start failed', { message: String(err && err.message || err) });
    } finally {
      setTimeout(() => {
        state.countdownWriteLock = false;
      }, 1200);
    }
  }

  function maybeAdvanceCountdown() {
    const room = state.room || {};
    const startAt = Number(room.startAt || 0);

    if (room.status !== 'countdown' || !startAt) {
      stopCountdownTimer();
      setCountdownUi(3, 0);
      return;
    }

    if (state.countdownTimer) return;

    state.countdownTimer = W.setInterval(async () => {
      const remain = Math.max(0, startAt - Date.now());
      const total = 3500;
      const ratio = Math.max(0, Math.min(1, 1 - (remain / total)));
      const secs = Math.max(0, Math.ceil(remain / 1000));

      setCountdownUi(secs, ratio);

      if (remain <= 0) {
        stopCountdownTimer();
        if (state.isHost && state.roomRef) {
          try {
            await state.roomRef.update({
              status: 'running',
              updatedAt: Date.now(),
              'match/status': 'running'
            });
          } catch (err) {
            log('set running failed', { message: String(err && err.message || err) });
          }
        } else if ((state.room?.status || '') === 'running') {
          goRun();
        }

        setTimeout(() => {
          if ((state.room?.status || '') === 'running') {
            goRun();
          }
        }, 250);
      }
    }, 80);

    if ((state.room?.status || '') === 'running') {
      goRun();
    }
  }

  function setCountdownUi(number, ratio) {
    if (UI.countdownNumber) UI.countdownNumber.textContent = String(number);
    if (UI.countdownFill) UI.countdownFill.style.width = `${Math.round(ratio * 100)}%`;
  }

  function stopCountdownTimer() {
    if (state.countdownTimer) {
      clearInterval(state.countdownTimer);
      state.countdownTimer = 0;
    }
  }

  function goRun() {
    if (state.startedNavigation) return;
    state.startedNavigation = true;
    const url = buildRunUrl();
    log('navigate run', { url });
    location.href = url;
  }

  function bindUi() {
    UI.tabHelp?.addEventListener('click', () => showPanel('help'));
    UI.tabLobby?.addEventListener('click', () => showPanel('lobby'));
    UI.btnHub?.addEventListener('click', goHub);
    UI.btnHubTop?.addEventListener('click', goHub);
    UI.btnHubMain?.addEventListener('click', goHub);

    UI.btnCopyInvite?.addEventListener('click', copyInvite);
    UI.btnReady?.addEventListener('click', async () => {
      try {
        await toggleReady();
        showPanel('lobby');
      } catch (err) {
        setBanner('bad', 'เปลี่ยนสถานะ ready ไม่สำเร็จ', String(err && err.message || err));
      }
    });

    UI.btnResetRoom?.addEventListener('click', async () => {
      try {
        await resetRoom();
      } catch (err) {
        setBanner('bad', 'รีเซ็ตห้องไม่สำเร็จ', String(err && err.message || err));
      }
    });

    W.addEventListener('beforeunload', () => {
      try {
        if (state.playerRef) {
          state.playerRef.update({
            connected: false,
            phase: 'left',
            lastSeenAt: Date.now()
          });
        }
      } catch (_) {}
    });
  }

  function fillStaticUi() {
    state.targetPath = q('target', './hydration-vr.html');
    state.hub = q('hub', new URL('../hub.html', location.href).href);
    state.diff = q('diff', 'normal');
    state.view = q('view', 'mobile');
    state.time = Math.max(30, Number(q('time', state.diff === 'hard' ? '90' : '80')) || 80);
    state.seed = q('seed', String(Date.now()));
    state.zone = q('zone', 'nutrition');
    state.cat = q('cat', state.zone);
    state.theme = q('theme', 'hydration');
    state.run = q('run', 'play');
    state.pid = normalizePid(q('pid', 'anon'));
    state.nick = String(q('nick', q('name', 'Player'))).trim().slice(0, 64) || 'Player';
    state.roomCode = String(q('roomCode', q('room', ''))).trim().toUpperCase() || generateRoomCode();

    if (UI.roomCodeValue) UI.roomCodeValue.textContent = state.roomCode;
    if (UI.infoTarget) UI.infoTarget.textContent = state.targetPath;
    if (UI.infoDiff) UI.infoDiff.textContent = state.diff;
    if (UI.infoView) UI.infoView.textContent = state.view;
    if (UI.infoTime) UI.infoTime.textContent = String(state.time);

    const u = new URL(location.href);
    u.searchParams.set('roomCode', state.roomCode);
    if (!q('mode')) u.searchParams.set('mode', MODE);
    history.replaceState({}, '', u.toString());
  }

  async function init() {
    bindUi();
    fillStaticUi();
    showPanel('help');
    setBanner('warn', 'กำลังเตรียมระบบ', 'รอสักครู่ ระบบกำลังเชื่อม Firebase และเตรียมห้องให้');
    log('init start');

    try {
      state.firebase = ensureFirebaseApp();
      state.auth = state.firebase.auth;
      state.db = state.firebase.db;

      state.user = await ensureAnonymousAuth(state.auth);
      state.uid = state.user.uid;

      state.roomRef = state.db.ref(`${ROOM_PATH_BASE}/${state.roomCode}`);

      await createOrJoinRoom();
      subscribeRoom();
      startHeartbeat();

      setBanner('good', 'พร้อมใช้งาน', 'Firebase พร้อมแล้ว ส่งลิงก์หรือ roomCode ให้เพื่อน แล้วกดพร้อม');
      showPanel('lobby');
      log('init success', { uid: state.uid, roomCode: state.roomCode });
    } catch (err) {
      const msg = String(err && err.message || err);
      setBanner('bad', 'เข้า run ไม่สำเร็จ', msg);
      if (UI.errorText) UI.errorText.textContent = msg;
      setPill(UI.authStatePill, 'pill-bad', 'error');
      log('init failed', { message: msg });
    }
  }

  init();
})();