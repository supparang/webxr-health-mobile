'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk-coop-lobby.js
 * GoodJunk Coop Lobby
 * FULL PATCH v20260405-coop-lobby-runtime-full
 * ========================================================= */
(function(){
  const W = window;
  const D = document;

  const qs = (k, d='') => {
    try { return (new URL(location.href)).searchParams.get(k) ?? d; }
    catch { return d; }
  };

  const clamp = (v, a, b) => {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  };

  const num = (v, d=0) => {
    v = Number(v);
    return Number.isFinite(v) ? v : d;
  };

  const clean = (s, max=24) => String(s == null ? '' : s)
    .replace(/[^a-zA-Z0-9ก-๙ _-]/g, '')
    .trim()
    .slice(0, max);

  const cleanRoom = (s, max=24) => String(s == null ? '' : s)
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, max);

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const now = () => Date.now();

  const MODE_ID = 'coop';
  const ROOM_PREFIX = 'GJC';
  const RUN_FILE = './goodjunk-coop-run.html';
  const LOBBY_FILE = './goodjunk-coop-lobby.html';
  const STORE_KEY = 'GJ_COOP_LOBBY_V2';
  const ACTIVE_TTL_MS = 12000;
  const HEARTBEAT_MS = 2500;
  const FIREBASE_WAIT_MS = 10000;
  const ROOM_KINDS = ['coopRooms', 'rooms'];
  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 4;
  const IS_REMATCH = qs('rematch', '0') === '1';

  const HUB = qs('hub', '../hub.html');

  const UI = {
    btnCopyRoom: D.getElementById('btnCopyRoom'),
    btnCopyInvite: D.getElementById('btnCopyInvite'),
    btnBack: D.getElementById('btnBack'),

    roomCode: D.getElementById('roomCode'),
    roomStatus: D.getElementById('roomStatus'),
    hostName: D.getElementById('hostName'),
    playerCount: D.getElementById('playerCount'),
    countdown: D.getElementById('countdown'),

    inviteLink: D.getElementById('inviteLink'),
    copyState: D.getElementById('copyState'),
    joinGuard: D.getElementById('joinGuard'),

    qrBox: D.getElementById('qrBox'),

    hint: D.getElementById('hint'),
    btnReady: D.getElementById('btnReady'),
    btnStart: D.getElementById('btnStart'),
    btnSpectate: D.getElementById('btnSpectate'),

    playersBox: D.getElementById('playersBox')
  };

  const S = {
    uid: '',
    roomId: cleanRoom(qs('roomId', qs('room', ''))),
    roomKind: clean(qs('roomKind', ''), 24) || '',
    joined: false,

    meta: {},
    state: {
      status: 'waiting',
      plannedSec: 90,
      seed: '',
      roundId: '',
      participantIds: []
    },
    match: {},
    players: {},
    results: {},

    refs: null,
    offFns: [],
    heartbeat: 0,
    countdownTick: 0,
    redirecting: false,
    firebaseReady: false
  };

  let RT = null;
  let rematchResetDone = false;
  let healBusy = false;
  let lastHealAt = 0;

  function runtimeCtx(){
    return {
      roomId: S.roomId || '',
      roomKind: S.roomKind || '',
      pid: S.uid || '',
      uid: S.uid || '',
      name: getNick(),
      role: isHost() ? 'host' : 'player',
      diff: getDiff(),
      time: Number(getTime()),
      seed: String(getSeed()),
      view: getView(),
      host: isHost() ? '1' : '0'
    };
  }

  function initRuntime(){
    if (!(W.HHARuntimeContract && typeof W.HHARuntimeContract.create === 'function')) {
      RT = null;
      return null;
    }

    RT = W.HHARuntimeContract.create({
      game: 'goodjunk',
      zone: 'nutrition',
      mode: 'coop',
      getCtx: runtimeCtx
    });

    return RT;
  }

  function roomPath(kind, roomId) {
    return `hha-battle/goodjunk/${kind}/${roomId}`;
  }

  function roomRootRef(db, kind, roomId) {
    return db.ref(roomPath(kind, roomId));
  }

  async function detectExistingRoomKind(db, roomId) {
    const preferred = clean(qs('roomKind', ''), 24);
    const order = preferred
      ? [preferred, ...ROOM_KINDS.filter((k) => k !== preferred)]
      : ROOM_KINDS.slice();

    for (const kind of order) {
      try {
        const snap = await db.ref(roomPath(kind, roomId)).child('meta').once('value');
        if (snap.exists()) return kind;
      } catch (_) {}
    }
    return '';
  }

  function buildRefs(root) {
    return {
      root,
      meta: root.child('meta'),
      state: root.child('state'),
      match: root.child('match'),
      players: root.child('players'),
      results: root.child('results')
    };
  }

  function makeCode(){
    return `${ROOM_PREFIX}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
  }

  function makeRoundId(){
    return `C-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  }

  function getSeed(){
    return clean(qs('seed', String(Date.now())), 80) || String(Date.now());
  }

  function getDiff(){
    return clean(qs('diff', 'normal'), 24) || 'normal';
  }

  function getTime(){
    return clamp(qs('time', '90'), 30, 300);
  }

  function getView(){
    return clean(qs('view', 'mobile'), 24) || 'mobile';
  }

  function getNick(){
    return clean(qs('name', qs('nick', 'Player')), 24) || 'Player';
  }

  function isHost(){
    return !!S.uid && S.meta && S.meta.hostPid === S.uid;
  }

  const setStateText = (msg) => {
    if (UI.copyState) UI.copyState.textContent = String(msg || '');
  };

  const setHint = (msg) => {
    if (UI.hint) UI.hint.textContent = String(msg || '');
  };

  const setGuard = (msg) => {
    if (!UI.joinGuard) return;
    if (msg) {
      UI.joinGuard.style.display = 'block';
      UI.joinGuard.textContent = String(msg);
    } else {
      UI.joinGuard.style.display = 'none';
      UI.joinGuard.textContent = '';
    }
  };

  function hasFirebaseCompat() {
    return !!(
      W.firebase &&
      typeof W.firebase.initializeApp === 'function' &&
      typeof W.firebase.app === 'function' &&
      typeof W.firebase.database === 'function' &&
      typeof W.firebase.auth === 'function'
    );
  }

  async function waitForFirebaseReady(timeoutMs = FIREBASE_WAIT_MS) {
    const startedAt = now();

    while (now() - startedAt < timeoutMs) {
      try {
        if (W.HHA_FIREBASE_DB && hasFirebaseCompat()) {
          S.firebaseReady = true;
          return true;
        }

        if (typeof W.HHA_ENSURE_FIREBASE_DB === 'function') {
          const db = W.HHA_ENSURE_FIREBASE_DB();
          if (db && hasFirebaseCompat()) {
            W.HHA_FIREBASE_DB = db;
            S.firebaseReady = true;
            return true;
          }
        }

        if (hasFirebaseCompat()) {
          if ((!W.firebase.apps || !W.firebase.apps.length) && W.HHA_FIREBASE_CONFIG) {
            W.firebase.initializeApp(W.HHA_FIREBASE_CONFIG);
          }
          if (W.firebase.apps && W.firebase.apps.length) {
            W.HHA_FIREBASE_DB = W.firebase.database();
            S.firebaseReady = true;
            return true;
          }
        }
      } catch (_) {}

      await wait(120);
    }

    throw new Error('Firebase ยังไม่พร้อม');
  }

  function ensureFirebaseDb() {
    if (W.HHA_FIREBASE_DB) return W.HHA_FIREBASE_DB;

    if (typeof W.HHA_ENSURE_FIREBASE_DB === 'function') {
      const db = W.HHA_ENSURE_FIREBASE_DB();
      if (db) {
        W.HHA_FIREBASE_DB = db;
        return db;
      }
    }

    if (hasFirebaseCompat()) {
      if ((!W.firebase.apps || !W.firebase.apps.length) && W.HHA_FIREBASE_CONFIG) {
        W.firebase.initializeApp(W.HHA_FIREBASE_CONFIG);
      }
      if (W.firebase.apps && W.firebase.apps.length) {
        W.HHA_FIREBASE_DB = W.firebase.database();
        return W.HHA_FIREBASE_DB;
      }
    }

    throw new Error('Firebase DB not ready');
  }

  function waitForAuthUser(auth, timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
      let done = false;
      let off = null;

      const finish = (err, user) => {
        if (done) return;
        done = true;
        try { if (typeof off === 'function') off(); } catch (_) {}
        clearTimeout(timer);
        if (err) reject(err);
        else resolve(user);
      };

      const timer = setTimeout(() => {
        finish(new Error('Firebase Auth ยังไม่พร้อม'));
      }, timeoutMs);

      try {
        off = auth.onAuthStateChanged((user) => {
          if (user && user.uid) finish(null, user);
        }, (err) => {
          finish(err || new Error('Auth state error'));
        });
      } catch (err) {
        finish(err);
      }
    });
  }

  async function ensureAnonymousAuth() {
    await waitForFirebaseReady();

    if (!W.firebase || typeof W.firebase.auth !== 'function') {
      throw new Error('Firebase Auth SDK ยังไม่พร้อม');
    }

    const auth = W.firebase.auth();

    if (auth.currentUser && auth.currentUser.uid) {
      return auth.currentUser;
    }

    await auth.signInAnonymously();
    const user = await waitForAuthUser(auth, 12000);
    if (!user || !user.uid) throw new Error('Firebase Auth ยังไม่พร้อม');
    return user;
  }

  async function ensureFreshAuthForWrite() {
    await waitForFirebaseReady();
    let user = await ensureAnonymousAuth();

    try {
      if (typeof user.getIdToken === 'function') {
        await user.getIdToken(true);
      }
    } catch (_) {}

    await wait(300);

    if (W.firebase && typeof W.firebase.auth === 'function') {
      const auth = W.firebase.auth();
      if (!auth.currentUser || !auth.currentUser.uid) {
        user = await waitForAuthUser(auth, 12000);
      } else {
        user = auth.currentUser;
      }
    }

    if (!user || !user.uid) throw new Error('Anonymous auth failed');
    S.uid = user.uid;
    return user;
  }

  async function dbWriteWithRetry(writeFn) {
    try {
      return await writeFn();
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      if (!/PERMISSION_DENIED/i.test(msg)) throw err;
      await ensureFreshAuthForWrite();
      await wait(350);
      return await writeFn();
    }
  }

  function loadStored(){
    try{
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.roomId && !S.roomId) S.roomId = cleanRoom(d.roomId);
    } catch (_) {}
  }

  function saveStored(){
    try{
      localStorage.setItem(STORE_KEY, JSON.stringify({
        roomId: S.roomId,
        roomKind: S.roomKind
      }));
    } catch (_) {}
  }

  function isActivePlayer(p, nowTs=now()){
    if (!p) return false;
    if (p.connected === false) return false;
    const lastSeen = num(p.lastSeen || p.updatedAt || p.joinedAt, 0);
    if (!lastSeen) return true;
    return (nowTs - lastSeen) <= ACTIVE_TTL_MS;
  }

  function activePlayers(){
    const t = now();
    return Object.values(S.players || {})
      .filter((p) => isActivePlayer(p, t))
      .sort((a, b) => num(a.joinedAt, 0) - num(b.joinedAt, 0));
  }

  function readyPlayers(){
    return activePlayers().filter((p) => !!p.ready);
  }

  function currentParticipantIds(){
    const ids = Array.isArray(S.state && S.state.participantIds) ? S.state.participantIds : [];
    return ids.filter(Boolean);
  }

  function selfInParticipants(){
    return currentParticipantIds().includes(S.uid);
  }

  function ensureRoomCode(){
    const room = cleanRoom(S.roomId || qs('roomId', qs('room', '')));
    S.roomId = room || makeCode();
    if (UI.roomCode) UI.roomCode.textContent = S.roomId;
  }

  function buildLobbyUrl(roomId){
    const url = new URL(LOBBY_FILE, location.href);
    const src = new URL(location.href);

    src.searchParams.forEach((value, key) => {
      if (key === 'roomId' || key === 'room' || key === 'create') return;
      url.searchParams.set(key, value);
    });

    url.searchParams.set('mode', MODE_ID);
    url.searchParams.set('roomId', roomId);
    url.searchParams.set('room', roomId);
    url.searchParams.set('diff', getDiff());
    url.searchParams.set('time', String(getTime()));
    url.searchParams.set('view', getView());
    url.searchParams.set('seed', String(getSeed()));
    url.searchParams.set('hub', HUB);
    url.searchParams.set('autojoin', '1');
    if (S.roomKind) url.searchParams.set('roomKind', S.roomKind);
    if (IS_REMATCH) url.searchParams.set('rematch', '1');

    return url.toString();
  }

  function buildRunUrl(roomId){
    const url = new URL(RUN_FILE, location.href);
    const src = new URL(location.href);

    src.searchParams.forEach((value, key) => {
      if (key === 'roomId' || key === 'room' || key === 'autojoin' || key === 'rematch') return;
      url.searchParams.set(key, value);
    });

    const sharedStartAt = num(S.state && (S.state.startAt || S.state.countdownEndsAt), 0);
    const sharedDiff = String((S.meta && S.meta.diff) || getDiff());
    const sharedTime = String(num(S.state && S.state.plannedSec, getTime()));
    const sharedSeed = String(
      (S.state && S.state.seed) ||
      (S.meta && S.meta.seed) ||
      getSeed()
    );
    const sharedRoundId = String((S.state && S.state.roundId) || '');

    url.searchParams.set('mode', MODE_ID);
    url.searchParams.set('roomId', roomId);
    url.searchParams.set('room', roomId);
    url.searchParams.set('name', getNick());
    url.searchParams.set('nick', getNick());
    url.searchParams.set('pid', S.uid || 'anon');
    url.searchParams.set('role', isHost() ? 'host' : 'player');
    url.searchParams.set('host', isHost() ? '1' : '0');
    url.searchParams.set('wait', '1');
    url.searchParams.set('diff', sharedDiff);
    url.searchParams.set('time', sharedTime);
    url.searchParams.set('view', getView());
    url.searchParams.set('seed', sharedSeed);
    url.searchParams.set('hub', HUB);
    url.searchParams.set('autostart', '1');
    if (sharedStartAt > 0) url.searchParams.set('startAt', String(sharedStartAt));
    if (sharedRoundId) url.searchParams.set('roundId', sharedRoundId);
    if (S.roomKind) url.searchParams.set('roomKind', S.roomKind);

    return url.toString();
  }

  async function copyText(text){
    const value = String(text || '').trim();
    if (!value) return false;

    try{
      await navigator.clipboard.writeText(value);
      return true;
    }catch{
      try{
        const ta = D.createElement('textarea');
        ta.value = value;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        D.body.appendChild(ta);
        ta.select();
        const ok = D.execCommand('copy');
        ta.remove();
        return !!ok;
      }catch{
        return false;
      }
    }
  }

  function renderQr(){
    if (!UI.qrBox) return;
    const link = buildLobbyUrl(S.roomId || makeCode());
    if (UI.inviteLink) UI.inviteLink.value = link;

    UI.qrBox.innerHTML = '';
    const img = new Image();
    img.alt = 'Coop Invite QR';
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=' + encodeURIComponent(link);
    UI.qrBox.appendChild(img);
  }

  function renderPlayers(){
    const box = UI.playersBox;
    if (!box) return;

    const players = Object.values(S.players || {}).sort((a, b) => num(a.joinedAt, 0) - num(b.joinedAt, 0));
    if (!players.length) {
      box.innerHTML = `
        <div class="player">
          <div><strong>ยังไม่มีผู้เล่น</strong><br><span style="opacity:.75">สร้างห้องหรือเข้าห้องก่อน</span></div>
          <div class="waiting">WAIT</div>
        </div>
      `;
      return;
    }

    box.innerHTML = players.map((p) => {
      const active = isActivePlayer(p);
      const me = p.pid === S.uid;
      const host = p.pid === (S.meta && S.meta.hostPid);
      const ready = !!p.ready;
      const phase = p.phase || 'lobby';

      let statusCls = 'waiting';
      let statusText = 'WAITING';
      if (!active) {
        statusCls = 'waiting';
        statusText = 'OFFLINE';
      } else if (ready) {
        statusCls = 'ready';
        statusText = 'READY';
      }

      return `
        <div class="player">
          <div style="display:grid;gap:6px;">
            <div><strong>${host ? '👑 ' : '🤝 '}${escapeHtml(p.nick || 'Player')}${me ? ' • YOU' : ''}</strong></div>
            <div style="font-size:12px;color:#6f6c65;">${host ? 'host' : 'guest'} • ${active ? 'online' : 'offline'} • ${escapeHtml(phase)}</div>
          </div>
          <div class="${statusCls}">${statusText}</div>
        </div>
      `;
    }).join('');
  }

  function renderCountdown(){
    clearInterval(S.countdownTick);
    if (UI.countdown) UI.countdown.textContent = '-';

    if (!S.joined || !S.state || S.state.status !== 'countdown') return;

    S.countdownTick = setInterval(() => {
      const targetAt = num(S.state.startAt || S.state.countdownEndsAt, 0);
      const leftMs = targetAt - now();
      const sec = Math.max(0, Math.ceil(leftMs / 1000));

      if (UI.countdown) UI.countdown.textContent = sec > 0 ? String(sec) : 'GO!';

      if (leftMs <= 0) {
        clearInterval(S.countdownTick);
        if (selfInParticipants()) goRun();
      }
    }, 100);
  }

  function renderState(){
    ensureRoomCode();

    const actives = activePlayers();
    const ready = readyPlayers();
    const count = actives.length;
    const readyCount = ready.length;
    const status = String((S.state && S.state.status) || 'waiting');
    const participantIds = currentParticipantIds();

    if (UI.roomStatus) UI.roomStatus.textContent = status;
    if (UI.hostName) {
      const hostPlayer =
        actives.find((p) => p.pid === (S.meta && S.meta.hostPid)) ||
        Object.values(S.players || {}).find((p) => p.pid === (S.meta && S.meta.hostPid));
      UI.hostName.textContent = hostPlayer ? (hostPlayer.nick || hostPlayer.pid || '-') : '-';
    }

    if (UI.playerCount) {
      UI.playerCount.textContent = `${count} คน • ready ${readyCount}/${Math.max(MIN_PLAYERS, count)}`;
    }

    if (UI.btnReady) {
      const self = S.players && S.players[S.uid] ? S.players[S.uid] : null;
      UI.btnReady.disabled = !S.joined || (status !== 'waiting' && status !== 'ended');
      UI.btnReady.textContent = self && self.ready ? 'ยกเลิกพร้อม' : 'พร้อมแล้ว';
    }

    if (UI.btnStart) {
      UI.btnStart.disabled = !(S.joined && isHost() && readyCount >= MIN_PLAYERS && (status === 'waiting' || status === 'ended'));
    }

    if (UI.btnSpectate) {
      const showSpectate = (status === 'countdown' || status === 'playing' || status === 'running') && !selfInParticipants();
      UI.btnSpectate.style.display = showSpectate ? '' : 'none';
    }

    if (!S.joined) {
      setStateText('กำลังเชื่อมห้อง Coop...');
      setHint('ต้องมีผู้เล่นพร้อมอย่างน้อย 2 คนก่อนเริ่ม Coop');
      setGuard('');
    } else if (status === 'waiting' || status === 'ended') {
      if (readyCount >= MIN_PLAYERS) {
        setStateText('ห้องพร้อมเริ่มแล้ว');
        setHint(`พร้อมแล้ว ${readyCount} คน • Host กดเริ่ม Coop ได้เลย`);
      } else {
        setStateText('เข้าห้องสำเร็จ');
        setHint(`ตอนนี้ ready ${readyCount}/${Math.max(MIN_PLAYERS, count || MIN_PLAYERS)} • ต้องพร้อมอย่างน้อย ${MIN_PLAYERS} คน`);
      }
      setGuard('');
    } else if (status === 'countdown') {
      setStateText('กำลังนับถอยหลัง');
      setHint(`participant รอบนี้ ${participantIds.length} คน • จะเข้าเล่นพร้อมกัน`);
      setGuard('');
    } else if (status === 'playing' || status === 'running') {
      setStateText(selfInParticipants() ? 'กำลังพาเข้าสู่หน้าเล่นจริง' : 'รอบนี้เริ่มแล้ว');
      setHint(selfInParticipants() ? 'ถ้าไม่เด้งเอง ให้รอสักครู่' : 'คุณไม่ได้อยู่ใน participant รอบนี้');
      setGuard(selfInParticipants() ? '' : 'รอบนี้คุณไม่ได้อยู่ใน participant ต้องรอรอบถัดไปหรือกลับเข้าล็อบบี้ใหม่');
    }

    renderPlayers();
    renderQr();
  }

  function cleanupRoom(){
    clearInterval(S.heartbeat);
    clearInterval(S.countdownTick);
    S.heartbeat = 0;
    S.countdownTick = 0;

    while (S.offFns.length) {
      const fn = S.offFns.pop();
      try { fn(); } catch (_) {}
    }

    S.joined = false;
    S.meta = {};
    S.state = {
      status: 'waiting',
      plannedSec: getTime(),
      seed: '',
      roundId: '',
      participantIds: []
    };
    S.match = {};
    S.players = {};
    S.results = {};
    S.refs = null;
    S.redirecting = false;
    rematchResetDone = false;
    healBusy = false;
  }

  async function resetCoopRoomForNextRound(refs){
    const nowTs = now();
    const nextRoundId = makeRoundId();

    const playersSnap = await refs.players.once('value');
    const players = playersSnap.val() || {};

    const nextPlayers = {};
    Object.keys(players).forEach((pid) => {
      const p = players[pid] || {};
      nextPlayers[pid] = {
        ...p,
        ready: false,
        phase: 'lobby',
        finished: false,
        finalScore: 0,
        score: 0,
        contribution: 0,
        miss: 0,
        streak: 0,
        updatedAt: nowTs,
        lastSeen: nowTs,
        connected: p.connected !== false
      };
    });

    await refs.results.remove().catch(() => {});
    await refs.match.set({
      participantIds: [],
      lockedAt: null,
      status: 'idle',
      coop: {
        finishedAt: 0,
        teamScore: 0
      }
    });

    await refs.state.set({
      status: 'waiting',
      plannedSec: Number(getTime()),
      seed: String(getSeed()),
      roundId: nextRoundId,
      participantIds: [],
      countdownEndsAt: null,
      startAt: null,
      startedAt: null,
      teamScore: 0,
      createdAt: nowTs,
      updatedAt: nowTs
    });

    if (Object.keys(nextPlayers).length) {
      await refs.players.set(nextPlayers);
    }

    await refs.meta.update({
      updatedAt: nowTs,
      lastResetAt: nowTs,
      rematchReady: true
    });

    return nextRoundId;
  }

  async function maybePrepareRematchRoom(refs, hostFlag){
    if (!IS_REMATCH) return;
    if (!hostFlag) return;
    if (rematchResetDone) return;

    rematchResetDone = true;

    try {
      await resetCoopRoomForNextRound(refs);
      console.log('[coop-lobby] rematch room reset done');
    } catch (err) {
      console.error('[coop-lobby] rematch room reset failed', err);
    }
  }

  async function maybeRecoverBrokenCountdown(reason){
    if (!S.refs) return;

    const status = String((S.state && S.state.status) || '');
    if (status !== 'countdown' && status !== 'playing' && status !== 'running') return;

    const actives = activePlayers();
    const activeHost = actives.find((p) => p.pid === (S.meta && S.meta.hostPid));
    const iAmFirstActive = !!(actives[0] && actives[0].pid === S.uid);
    const canAdoptHost = !S.meta.hostPid || !activeHost || isHost() || iAmFirstActive;

    if (actives.length >= MIN_PLAYERS && activeHost) return;
    if (!canAdoptHost) return;
    if (healBusy) return;

    const ts = now();
    if (ts - lastHealAt < 900) return;

    healBusy = true;
    lastHealAt = ts;

    try {
      if ((!S.meta.hostPid || !activeHost) && iAmFirstActive && S.meta.hostPid !== S.uid) {
        await dbWriteWithRetry(() => S.refs.meta.update({
          hostPid: S.uid,
          updatedAt: Date.now()
        })).catch(() => {});
      }

      await dbWriteWithRetry(() => S.refs.match.update({
        participantIds: [],
        lockedAt: null,
        status: 'idle',
        coop: {
          finishedAt: 0,
          teamScore: 0
        }
      })).catch(() => {});

      await dbWriteWithRetry(() => S.refs.state.update({
        status: 'waiting',
        countdownEndsAt: null,
        startAt: null,
        startedAt: null,
        participantIds: [],
        teamScore: 0,
        updatedAt: Date.now()
      })).catch(() => {});

      const playersSnap = await S.refs.players.once('value').catch(() => null);
      const players = (playersSnap && playersSnap.val()) || {};
      const updates = {};
      const nowTs = Date.now();

      Object.keys(players).forEach((pid) => {
        updates[`${pid}/ready`] = false;
        updates[`${pid}/phase`] = 'lobby';
        updates[`${pid}/finished`] = false;
        updates[`${pid}/updatedAt`] = nowTs;
        updates[`${pid}/lastSeen`] = nowTs;
      });

      if (Object.keys(updates).length) {
        await dbWriteWithRetry(() => S.refs.players.update(updates)).catch(() => {});
      }

      console.log('[coop-lobby] recovered broken countdown', {
        reason,
        roomId: S.roomId,
        roomKind: S.roomKind,
        prevStatus: status,
        activeCount: actives.length,
        hostPid: S.meta && S.meta.hostPid
      });
    } catch (err) {
      console.error('[coop-lobby] maybeRecoverBrokenCountdown failed', err);
    } finally {
      healBusy = false;
    }
  }

  async function joinBoundRoom(created){
    const nowTs = now();
    const existing = (S.players && S.players[S.uid]) ? S.players[S.uid] : null;

    const joinedPayload = {
      pid: S.uid,
      nick: getNick(),
      connected: true,
      ready: false,
      joinedAt: (existing && existing.joinedAt) || nowTs,
      updatedAt: nowTs,
      lastSeen: nowTs,
      phase: 'lobby',
      finished: false,
      finalScore: 0,
      score: 0,
      contribution: 0,
      miss: 0,
      streak: 0
    };

    await dbWriteWithRetry(() => S.refs.players.child(S.uid).set(joinedPayload));

    try { S.refs.players.child(S.uid).onDisconnect().remove(); } catch (_) {}

    const onMeta = async (snap) => {
      S.meta = snap.val() || {};
      renderState();
      await maybeRecoverBrokenCountdown('meta');
    };

    const onState = async (snap) => {
      S.state = snap.val() || {};
      renderState();
      renderCountdown();
      await maybeRecoverBrokenCountdown('state');

      const st = String(S.state.status || '');
      if ((st === 'running' || st === 'playing') && selfInParticipants()) {
        goRun();
      }
    };

    const onMatch = (snap) => {
      S.match = snap.val() || {};
      renderState();
    };

    const onPlayers = async (snap) => {
      S.players = snap.val() || {};

      const actives = activePlayers();
      const activeHost = actives.find((p) => p.pid === (S.meta && S.meta.hostPid));

      if ((!S.meta.hostPid || !activeHost) && actives[0] && actives[0].pid === S.uid) {
        await dbWriteWithRetry(() => S.refs.meta.update({
          hostPid: S.uid,
          updatedAt: Date.now()
        })).catch(() => {});
      }

      if (S.state && S.state.status === 'countdown' && actives.length < MIN_PLAYERS) {
        await maybeRecoverBrokenCountdown('players');
      }

      renderState();
    };

    const onResults = (snap) => {
      S.results = snap.val() || {};
      renderState();
    };

    S.refs.meta.on('value', onMeta);
    S.refs.state.on('value', onState);
    S.refs.match.on('value', onMatch);
    S.refs.players.on('value', onPlayers);
    S.refs.results.on('value', onResults);

    S.offFns.push(() => S.refs.meta.off('value', onMeta));
    S.offFns.push(() => S.refs.state.off('value', onState));
    S.offFns.push(() => S.refs.match.off('value', onMatch));
    S.offFns.push(() => S.refs.players.off('value', onPlayers));
    S.offFns.push(() => S.refs.results.off('value', onResults));

    S.heartbeat = setInterval(() => {
      S.refs.players.child(S.uid).update({
        pid: S.uid,
        nick: getNick(),
        connected: true,
        updatedAt: Date.now(),
        lastSeen: Date.now(),
        phase: 'lobby'
      }).catch(() => {});
    }, HEARTBEAT_MS);

    S.joined = true;
    renderState();

    await maybePrepareRematchRoom(S.refs, isHost());
    await maybeRecoverBrokenCountdown('post-join');

    if (created) {
      setStateText('สร้างห้อง Coop สำเร็จ');
      setHint('ส่ง Room หรือ Invite Link ให้เพื่อนแล้วกดพร้อมเมื่อเข้าครบ');

      if (RT) {
        await RT.roomCreated({
          participantIds: activePlayers().map((p) => p.pid || '')
        }).catch(() => {});
      }
    } else {
      setStateText('เข้าห้อง Coop สำเร็จ');
      setHint('กดพร้อมเมื่อพร้อมเล่น แล้วรอ Host เริ่มรอบ');

      if (RT) {
        await RT.roomJoined({
          participantIds: activePlayers().map((p) => p.pid || '')
        }).catch(() => {});
      }
    }
  }

  async function createRoom(){
    try {
      await ensureFreshAuthForWrite();
      saveStored();

      cleanupRoom();
      S.roomId = makeCode();
      S.roomKind = 'coopRooms';
      ensureRoomCode();

      const db = ensureFirebaseDb();
      const root = roomRootRef(db, S.roomKind, S.roomId);
      S.refs = buildRefs(root);

      const nowTs = Date.now();
      const initialSeed = String(getSeed());

      await dbWriteWithRetry(() => S.refs.meta.set({
        roomId: S.roomId,
        game: 'goodjunk',
        mode: MODE_ID,
        diff: getDiff(),
        seed: initialSeed,
        hostPid: S.uid,
        minPlayers: MIN_PLAYERS,
        maxPlayers: MAX_PLAYERS,
        roomKind: S.roomKind,
        createdAt: nowTs,
        updatedAt: nowTs,
        rematchReady: false
      }));

      await dbWriteWithRetry(() => S.refs.state.set({
        status: 'waiting',
        plannedSec: getTime(),
        seed: initialSeed,
        roundId: '',
        participantIds: [],
        countdownEndsAt: null,
        startAt: null,
        startedAt: null,
        teamScore: 0,
        createdAt: nowTs,
        updatedAt: nowTs
      }));

      await dbWriteWithRetry(() => S.refs.match.set({
        participantIds: [],
        lockedAt: null,
        status: 'idle',
        coop: {
          finishedAt: 0,
          teamScore: 0
        }
      }));

      await joinBoundRoom(true);
    } catch (err) {
      console.error('[coop-lobby] createRoom failed', err);
      setGuard('สร้างห้องไม่สำเร็จ: ' + (err && err.message ? err.message : err));
      setStateText('สร้างห้อง Coop ไม่สำเร็จ');
    }
  }

  async function joinRoom(){
    try {
      await ensureFreshAuthForWrite();
      saveStored();

      cleanupRoom();
      ensureRoomCode();

      const db = ensureFirebaseDb();
      const detectedKind = await detectExistingRoomKind(db, S.roomId);

      if (!detectedKind) {
        setGuard('ไม่พบห้องนี้ กรุณาตรวจ room code แล้วลองใหม่');
        setStateText('ไม่พบห้อง Coop');
        return;
      }

      S.roomKind = detectedKind;
      const root = roomRootRef(db, S.roomKind, S.roomId);
      S.refs = buildRefs(root);

      await joinBoundRoom(false);
    } catch (err) {
      console.error('[coop-lobby] joinRoom failed', err);
      setGuard('เข้าห้องไม่สำเร็จ: ' + (err && err.message ? err.message : err));
      setStateText('เข้าห้อง Coop ไม่สำเร็จ');
    }
  }

  async function leaveRoom(){
    if (!S.joined || !S.refs) return;

    if (RT) {
      await RT.roomLeft({
        participantIds: activePlayers().map((p) => p.pid || '')
      }).catch(() => {});
    }

    try {
      await S.refs.players.child(S.uid).remove();
    } catch (_) {}

    try {
      const playersSnap = await S.refs.players.once('value');
      const players = playersSnap.val() || {};
      const ids = Object.keys(players);

      if (!ids.length) {
        await S.refs.root.remove().catch(() => {});
      } else {
        const currentHost = String((S.meta && S.meta.hostPid) || '');
        if (currentHost === S.uid) {
          const nextHost = ids[0] || '';
          if (nextHost) {
            await S.refs.meta.update({
              hostPid: nextHost,
              updatedAt: now()
            }).catch(() => {});
          }
        }

        await S.refs.match.update({
          participantIds: [],
          lockedAt: null,
          status: 'idle',
          coop: {
            finishedAt: 0,
            teamScore: 0
          }
        }).catch(() => {});

        await S.refs.state.update({
          status: 'waiting',
          participantIds: [],
          countdownEndsAt: null,
          startAt: null,
          startedAt: null,
          teamScore: 0,
          updatedAt: now()
        }).catch(() => {});
      }
    } catch (_) {}

    cleanupRoom();
    renderState();
    setStateText('ออกจากห้องแล้ว');
    setHint('สร้างห้องใหม่หรือเข้าห้องอื่นได้เลย');
  }

  async function setReadyFlag(flag){
    if (!S.joined || !S.refs) return;

    const status = String((S.state && S.state.status) || 'waiting');
    if (status !== 'waiting' && status !== 'ended') {
      setStateText('ตอนนี้เปลี่ยนสถานะพร้อมไม่ได้แล้ว');
      return;
    }

    try {
      await S.refs.players.child(S.uid).update({
        ready: !!flag,
        connected: true,
        phase: 'lobby',
        updatedAt: now(),
        lastSeen: now()
      });

      setGuard('');
      setHint(flag ? 'คุณพร้อมแล้ว รอให้ครบอย่างน้อย 2 คน' : 'ยกเลิกสถานะพร้อมแล้ว');
    } catch (err) {
      console.error('[coop-lobby] setReadyFlag failed', err);
    }
  }

  async function startGame(){
    if (!S.joined || !S.refs || !isHost()) return;

    const ready = readyPlayers();
    if (ready.length < MIN_PLAYERS) {
      setGuard(`Coop ต้องพร้อมอย่างน้อย ${MIN_PLAYERS} คนก่อน`);
      return;
    }

    const participantIds = ready.slice(0, MAX_PLAYERS).map((p) => p.pid).filter(Boolean);
    if (participantIds.length < MIN_PLAYERS) {
      setGuard('participant ยังไม่ครบขั้นต่ำ');
      return;
    }

    const sharedSeed = String(getSeed());
    const sharedDiff = String(getDiff());
    const sharedTime = Number(getTime());
    const sharedStartAt = Date.now() + 3500;
    const sharedRoundId = makeRoundId();

    try {
      await S.refs.results.remove();
    } catch (_) {}

    await S.refs.meta.update({
      diff: sharedDiff,
      seed: sharedSeed,
      updatedAt: Date.now(),
      rematchReady: false
    });

    await S.refs.match.set({
      participantIds,
      lockedAt: Date.now(),
      status: 'countdown',
      coop: {
        finishedAt: 0,
        teamScore: 0
      }
    });

    await S.refs.state.update({
      status: 'countdown',
      plannedSec: sharedTime,
      seed: sharedSeed,
      roundId: sharedRoundId,
      participantIds,
      countdownEndsAt: sharedStartAt,
      startAt: sharedStartAt,
      startedAt: null,
      teamScore: 0,
      updatedAt: Date.now()
    });

    const playersSnap = await S.refs.players.once('value');
    const players = playersSnap.val() || {};
    const updates = {};
    const nowTs = Date.now();

    Object.keys(players).forEach((pid) => {
      const isInRound = participantIds.includes(pid);
      updates[`${pid}/phase`] = isInRound ? 'run' : 'lobby';
      updates[`${pid}/finished`] = false;
      updates[`${pid}/finalScore`] = 0;
      updates[`${pid}/score`] = 0;
      updates[`${pid}/contribution`] = 0;
      updates[`${pid}/miss`] = 0;
      updates[`${pid}/streak`] = 0;
      updates[`${pid}/updatedAt`] = nowTs;
      updates[`${pid}/lastSeen`] = nowTs;
    });

    await S.refs.players.update(updates).catch(() => {});

    setGuard('');
    setStateText('กำลังนับถอยหลัง');
    setHint(`participant รอบนี้ ${participantIds.length} คน • จะเข้าเล่นพร้อมกัน`);

    if (RT) {
      await RT.countdownStarted({
        roundId: sharedRoundId,
        startAt: sharedStartAt,
        participantIds
      }).catch(() => {});
    }
  }

  function goRun(){
    if (S.redirecting || !S.roomId) return;
    S.redirecting = true;
    location.href = buildRunUrl(S.roomId);
  }

  function bind(){
    if (UI.btnBack) {
      UI.btnBack.addEventListener('click', () => {
        location.href = HUB || '../hub.html';
      });
    }

    UI.btnCopyRoom?.addEventListener('click', async () => {
      ensureRoomCode();
      const ok = await copyText(S.roomId || '');
      setStateText(ok ? 'คัดลอก Room แล้ว' : 'คัดลอก Room ไม่สำเร็จ');
    });

    UI.btnCopyInvite?.addEventListener('click', async () => {
      ensureRoomCode();
      const ok = await copyText(buildLobbyUrl(S.roomId || ''));
      setStateText(ok ? 'คัดลอก Invite Link แล้ว' : 'คัดลอก Invite Link ไม่สำเร็จ');
    });

    UI.btnReady?.addEventListener('click', async () => {
      const self = S.players && S.players[S.uid] ? S.players[S.uid] : null;
      await setReadyFlag(!(self && self.ready));
    });

    UI.btnStart?.addEventListener('click', startGame);

    UI.btnSpectate?.addEventListener('click', () => {
      if (!S.roomId) return;
      const url = new URL(RUN_FILE, location.href);
      url.searchParams.set('roomId', S.roomId);
      url.searchParams.set('room', S.roomId);
      url.searchParams.set('hub', HUB);
      if (S.roomKind) url.searchParams.set('roomKind', S.roomKind);
      url.searchParams.set('spectate', '1');
      location.href = url.toString();
    });

    W.addEventListener('beforeunload', () => {
      if (S.redirecting) return;
      if (S.refs && S.uid) {
        try { S.refs.players.child(S.uid).remove(); } catch (_) {}
      }
    });
  }

  async function autoJoinIfNeeded(){
    const room = cleanRoom(qs('roomId', qs('room', '')));
    const autojoin = qs('autojoin', '') === '1';
    const roomKind = clean(qs('roomKind', ''), 24);

    if (!room) return;

    S.roomId = room;
    if (roomKind) S.roomKind = roomKind;
    ensureRoomCode();
    renderState();

    if (autojoin) {
      try {
        await joinRoom();
      } catch (err) {
        setGuard('เข้าห้องไม่สำเร็จ: ' + (err && err.message ? err.message : err));
      }
    }
  }

  async function init(){
    try {
      loadStored();
      bind();
      ensureRoomCode();
      renderState();

      await waitForFirebaseReady();
      await ensureFreshAuthForWrite();

      initRuntime();
      if (RT) {
        await RT.flush().catch(() => {});
        await RT.lobbyReady({}).catch(() => {});
      }

      setStateText('หน้า Coop พร้อมแล้ว');
      setHint('สร้างห้องใหม่หรือเปิดลิงก์ Invite เพื่อเข้าห้อง');

      await autoJoinIfNeeded();
    } catch (err) {
      console.error('[coop-lobby] init failed', err);
      setGuard('เริ่มหน้า Coop Lobby ไม่สำเร็จ: ' + (err && err.message ? err.message : err));
      setStateText('เปิดหน้าไม่สำเร็จ');
    }
  }

  init();
})();