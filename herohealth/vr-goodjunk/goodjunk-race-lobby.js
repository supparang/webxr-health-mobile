'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk-race-lobby.js
 * GoodJunk Race Lobby
 * FULL PATCH v20260406-race-lobby-runtime-full-p2
 * - stronger rematch / recover / participant locking
 * - better room-kind detection
 * - safer host adoption / broken countdown recovery
 * ========================================================= */
(function(){
  const W = window;
  const D = document;

  const MODE_ID = 'race';
  const ROOM_PREFIX = 'GJR';
  const RUN_FILE = './goodjunk-race-run.html';
  const LOBBY_FILE = './goodjunk-race-lobby.html';
  const STORE_KEY = 'GJ_RACE_LOBBY_V2';
  const ACTIVE_TTL_MS = 12000;
  const HEARTBEAT_MS = 2500;
  const FIREBASE_WAIT_MS = 10000;
  const ROOM_KINDS = ['raceRooms', 'rooms'];
  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 2;

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

  const HUB = qs('hub', '../hub.html');
  const LAUNCHER = './goodjunk-multi.html';
  const IS_REMATCH = qs('rematch', '0') === '1';

  const UI = {
    topNotice: D.getElementById('topNotice'),
    sideNotice: D.getElementById('sideNotice'),
    bottomNotice: D.getElementById('bottomNotice'),

    statusBadge: D.getElementById('statusBadge'),
    roomCodeBig: D.getElementById('roomCodeBig'),
    roomSummary: D.getElementById('roomSummary'),
    joinLinkText: D.getElementById('joinLinkText'),
    countdownBox: D.getElementById('countdownBox'),

    nickInput: D.getElementById('nickInput'),
    diffSelect: D.getElementById('diffSelect'),
    timeSelect: D.getElementById('timeSelect'),
    viewSelect: D.getElementById('viewSelect'),
    seedInput: D.getElementById('seedInput'),
    roomInput: D.getElementById('roomInput'),

    btnCreateTop: D.getElementById('btnCreateTop'),
    btnJoinTop: D.getElementById('btnJoinTop'),
    btnLauncher: D.getElementById('btnLauncher'),
    btnHub: D.getElementById('btnHub'),
    btnCreateRoom: D.getElementById('btnCreateRoom'),
    btnJoinRoom: D.getElementById('btnJoinRoom'),
    btnPasteRoom: D.getElementById('btnPasteRoom'),
    btnShareRoom: D.getElementById('btnShareRoom'),
    btnRandomRoom: D.getElementById('btnRandomRoom'),
    btnCopyRoom: D.getElementById('btnCopyRoom'),
    btnStartGame: D.getElementById('btnStartGame'),
    btnLeaveRoom: D.getElementById('btnLeaveRoom'),

    qrCanvas: D.getElementById('qrCanvas'),
    playersList: D.getElementById('playersList')
  };

  const S = {
    uid: '',
    roomId: '',
    roomKind: clean(qs('roomKind', ''), 24) || '',
    joined: false,

    meta: {},
    state: {
      status:'waiting',
      plannedSec:90,
      seed:'',
      roundId:'',
      participantIds:[]
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
      mode: 'race',
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
    return `R-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  }

  function getNick(){
    return clean((UI.nickInput && UI.nickInput.value) || qs('name', qs('nick', 'Player')), 24) || 'Player';
  }

  function getDiff(){
    return String((UI.diffSelect && UI.diffSelect.value) || qs('diff', 'normal') || 'normal');
  }

  function getTime(){
    return clamp((UI.timeSelect && UI.timeSelect.value) || qs('time', '90') || '90', 30, 300);
  }

  function getView(){
    return String((UI.viewSelect && UI.viewSelect.value) || qs('view', 'mobile') || 'mobile');
  }

  function getSeed(){
    const raw = String((UI.seedInput && UI.seedInput.value) || qs('seed', '') || '').trim();
    return raw || String(Math.floor(Math.random() * 900000000) + 100000000);
  }

  function escapeHtml(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  const setTop = (m) => { if (UI.topNotice) UI.topNotice.textContent = String(m || ''); };
  const setSide = (m) => { if (UI.sideNotice) UI.sideNotice.textContent = String(m || ''); };
  const setBottom = (m) => { if (UI.bottomNotice) UI.bottomNotice.textContent = String(m || ''); };

  function isHost(){
    return !!S.uid && S.meta && S.meta.hostPid === S.uid;
  }

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
      if (d.nick && UI.nickInput) UI.nickInput.value = clean(d.nick, 24);
      if (d.diff && UI.diffSelect) UI.diffSelect.value = d.diff;
      if (d.time && UI.timeSelect) UI.timeSelect.value = String(d.time);
      if (d.view && UI.viewSelect) UI.viewSelect.value = d.view;
      if (d.seed != null && UI.seedInput) UI.seedInput.value = String(d.seed);
      if (d.roomId && !S.roomId) S.roomId = cleanRoom(d.roomId);
      if (d.roomKind && !S.roomKind) S.roomKind = clean(d.roomKind, 24);
    } catch (_) {}
  }

  function saveStored(){
    try{
      localStorage.setItem(STORE_KEY, JSON.stringify({
        nick: getNick(),
        diff: getDiff(),
        time: getTime(),
        view: getView(),
        seed: getSeed(),
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

  function playersSorted(){
    return Object.values(S.players || {})
      .sort((a, b) => num(a.joinedAt, 0) - num(b.joinedAt, 0));
  }

  function activePlayers(){
    const t = now();
    return playersSorted()
      .filter((p) => isActivePlayer(p, t))
      .sort((a, b) => num(a.joinedAt, 0) - num(b.joinedAt, 0));
  }

  function participantIdsFromState(){
    const ids =
      Array.isArray(S.state && S.state.participantIds) ? S.state.participantIds :
      Array.isArray(S.match && S.match.participantIds) ? S.match.participantIds :
      [];
    return ids.filter(Boolean);
  }

  function participantPlayers(){
    const ids = new Set(participantIdsFromState());
    if (!ids.size) return [];
    return activePlayers().filter((p) => ids.has(p.pid));
  }

  function selectedParticipants(){
    return activePlayers().slice(0, MAX_PLAYERS).map((p) => p.pid).filter(Boolean);
  }

  function selfInParticipants(){
    if (!S.uid) return false;
    return participantIdsFromState().includes(S.uid);
  }

  function ensureRoomCode(){
    const room = cleanRoom((UI.roomInput && UI.roomInput.value) || S.roomId || qs('roomId', qs('room', '')));
    S.roomId = room || makeCode();
    if (UI.roomInput) UI.roomInput.value = S.roomId;
    if (UI.roomCodeBig) UI.roomCodeBig.textContent = S.roomId;
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
      if (key === 'roomId' || key === 'room' || key === 'create' || key === 'autojoin' || key === 'rematch') return;
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
    url.searchParams.set('safe', './goodjunk.safe.race.js');
    url.searchParams.set('core', './goodjunk.safe.race.js');
    url.searchParams.set('controller', './goodjunk-race.js');
    url.searchParams.set('rv', '20260406-race-run-full-p2');

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

  async function shareLink(url){
    try{
      if (navigator.share) {
        await navigator.share({
          title:'GoodJunk Race Lobby',
          text:'มาเข้าห้อง Race นี้ด้วยกัน',
          url
        });
        return true;
      }
    } catch (_) {}
    return copyText(url);
  }

  function renderQr(){
    const link = buildLobbyUrl(S.roomId || makeCode());

    if (UI.joinLinkText) UI.joinLinkText.textContent = link;
    if (!UI.qrCanvas || !W.QRCode) return;

    W.QRCode.toCanvas(UI.qrCanvas, link, {
      width: 220,
      margin: 1,
      color: { dark:'#20324d', light:'#ffffff' }
    }, function(){});
  }

  function renderPlayers(){
    const box = UI.playersList;
    if (!box) return;

    const players = playersSorted();
    const participants = new Set(participantIdsFromState());

    if (!players.length) {
      box.innerHTML = `
        <div class="player">
          <div class="player-left">
            <div class="avatar">⌛</div>
            <div>
              <div class="name">ยังไม่มีผู้เล่น</div>
              <div class="mini">สร้างห้องหรือเข้าห้องก่อน</div>
            </div>
          </div>
          <div class="badge">WAIT</div>
        </div>
      `;
      return;
    }

    box.innerHTML = players.map((p) => {
      const active = isActivePlayer(p);
      const you = p.pid === S.uid;
      const host = p.pid === (S.meta && S.meta.hostPid);
      const inRound = participants.has(p.pid);
      const phase = String(p.phase || 'lobby');

      let badge = 'WAIT';
      if (you) badge = 'YOU';
      else if (inRound) badge = 'IN';
      else if (active) badge = 'LIVE';
      else badge = 'OFFLINE';

      return `
        <div class="player">
          <div class="player-left">
            <div class="avatar">${host ? '👑' : (inRound ? '🏁' : '🙂')}</div>
            <div>
              <div class="name">${escapeHtml(p.nick || 'player')} ${host ? '• host' : ''}</div>
              <div class="mini">${host ? 'host' : 'guest'} • ${active ? 'online' : 'offline'} • ${inRound ? 'participant' : 'waiting'} • ${escapeHtml(phase)}</div>
            </div>
          </div>
          <div class="badge">${badge}</div>
        </div>
      `;
    }).join('');
  }

  async function maybeRecoverBrokenCountdown(reason){
    if (!S.refs) return;

    const status = String((S.state && S.state.status) || '');
    if (status !== 'countdown' && status !== 'playing' && status !== 'running') return;

    const actives = activePlayers();
    const activeHost = actives.find((p) => p.pid === (S.meta && S.meta.hostPid));
    const iAmFirstActive = !!(actives[0] && actives[0].pid === S.uid);
    const canAdoptHost = !S.meta.hostPid || !activeHost || isHost() || iAmFirstActive;

    if (status === 'countdown' && actives.length >= MIN_PLAYERS && activeHost) return;
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
        race: {
          winnerId: '',
          bestScore: 0,
          finishedAt: 0
        }
      })).catch(() => {});

      await dbWriteWithRetry(() => S.refs.state.update({
        status: 'waiting',
        countdownEndsAt: null,
        startAt: null,
        startedAt: null,
        participantIds: [],
        winnerId: '',
        bestScore: 0,
        updatedAt: Date.now()
      })).catch(() => {});

      const playersSnap = await S.refs.players.once('value').catch(() => null);
      const players = (playersSnap && playersSnap.val()) || {};
      const updates = {};
      const nowTs = Date.now();

      Object.keys(players).forEach((pid) => {
        updates[`${pid}/phase`] = 'lobby';
        updates[`${pid}/finished`] = false;
        updates[`${pid}/updatedAt`] = nowTs;
        updates[`${pid}/lastSeen`] = nowTs;
      });

      if (Object.keys(updates).length) {
        await dbWriteWithRetry(() => S.refs.players.update(updates)).catch(() => {});
      }

      console.log('[race-lobby] recovered broken round', {
        reason,
        roomId: S.roomId,
        roomKind: S.roomKind,
        prevStatus: status,
        activeCount: actives.length,
        hostPid: S.meta && S.meta.hostPid
      });
    } catch (err) {
      console.error('[race-lobby] maybeRecoverBrokenCountdown failed', err);
    } finally {
      healBusy = false;
    }
  }

  function renderState(){
    ensureRoomCode();

    const active = activePlayers();
    const count = active.length;
    const status = String((S.state && S.state.status) || 'waiting');
    const participantIds = participantIdsFromState();
    const selected = selectedParticipants();

    if (UI.statusBadge) UI.statusBadge.textContent = status.toUpperCase();
    if (UI.roomSummary) {
      UI.roomSummary.textContent =
        status === 'countdown' ? `กำลังนับถอยหลัง • participant ${participantIds.length}/2` :
        (status === 'playing' || status === 'running') ? `กำลังเข้าเกม • participant ${participantIds.length}/2` :
        status === 'ended' ? `รอบก่อนจบแล้ว • ผู้เล่นในห้อง ${count}` :
        `รอผู้เล่น • ผู้เล่นในห้อง ${count} • รอบนี้จะเลือก ${Math.min(MAX_PLAYERS, selected.length)}/2 คนแรก`;
    }

    if (UI.btnStartGame) {
      UI.btnStartGame.disabled = !(S.joined && isHost() && selected.length >= MIN_PLAYERS && (status === 'waiting' || status === 'ended'));
    }
    if (UI.btnLeaveRoom) {
      UI.btnLeaveRoom.disabled = !S.joined;
    }

    if (!S.joined) {
      setTop('ใส่ชื่อ แล้วกดสร้างห้องหรือเข้าห้องได้เลย');
      setSide('เมื่อเข้าห้องแล้ว QR, room code และรายชื่อผู้เล่นจะอัปเดตให้ทันที');
      setBottom('ถ้ายังมีแค่ 1 คน ระบบจะรอผู้เล่นอีก 1 คนก่อนเริ่ม');
    } else if (status === 'waiting') {
      if (selected.length >= MIN_PLAYERS) {
        setTop('พร้อมเริ่มแล้ว • Host กด Start Race ได้เลย');
        setSide(`participant รอบนี้คือผู้เล่น ${Math.min(MAX_PLAYERS, selected.length)} คนแรกที่ online อยู่`);
        setBottom(selected.length > MAX_PLAYERS ? 'คนที่เข้ามาทีหลังจะรอรอบถัดไป' : 'ตอนนี้ห้องพร้อมเริ่มแล้ว');
      } else {
        setTop(`เข้าห้องสำเร็จ • รอผู้เล่นอีก ${Math.max(0, MIN_PLAYERS - selected.length)} คน`);
        setSide('ส่ง room code หรือให้เพื่อน scan QR เพื่อเข้าห้องเดียวกัน');
        setBottom('Race ต้องมีอย่างน้อย 2 คนจึงจะเริ่มได้');
      }
    } else if (status === 'countdown') {
      setTop('กำลังนับถอยหลัง เตรียมเข้าเกม');
      setSide(`participant รอบนี้ ${participantIds.length} คน • จะเข้าเล่นพร้อมกัน`);
      setBottom('ห้ามปิดหน้าในช่วงนับถอยหลัง');
    } else if (status === 'playing' || status === 'running') {
      if (selfInParticipants()) {
        setTop('กำลังพาเข้าสู่หน้าเล่นจริง');
        setSide('ถ้าไม่เด้งเอง ให้รอสักครู่');
      } else {
        setTop('รอบนี้เริ่มแล้ว');
        setSide('คุณไม่ได้อยู่ใน participant รอบนี้ • รอรอบถัดไปได้เลย');
      }
      setBottom('ระบบกำลัง sync ห้องก่อนเข้าเกม');
    } else if (status === 'ended') {
      setTop('รอบก่อนจบแล้ว • กด Start เพื่อเริ่มรอบใหม่');
      setSide('Host สามารถเริ่มรอบใหม่ได้จากห้องเดิม');
      setBottom('ระบบจะ reset ค่าเมื่อเริ่มรอบใหม่');
    }

    renderPlayers();
    renderQr();
  }

  function renderCountdown(){
    clearInterval(S.countdownTick);
    if (UI.countdownBox) UI.countdownBox.classList.remove('show');

    if (!S.joined || !S.state || S.state.status !== 'countdown') return;

    if (UI.countdownBox) UI.countdownBox.classList.add('show');

    S.countdownTick = setInterval(() => {
      const targetAt = num(S.state.startAt || S.state.countdownEndsAt, 0);
      const leftMs = targetAt - now();
      const sec = Math.max(0, Math.ceil(leftMs / 1000));

      if (UI.countdownBox) UI.countdownBox.textContent = sec > 0 ? String(sec) : 'GO!';

      if (leftMs <= 0) {
        clearInterval(S.countdownTick);
        if (selfInParticipants()) goRun();
      }
    }, 100);
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
    S.players = {};
    S.meta = {};
    S.match = {};
    S.results = {};
    S.state = {
      status:'waiting',
      plannedSec:getTime(),
      seed:'',
      roundId:'',
      participantIds:[]
    };
    S.refs = null;
    S.redirecting = false;
    rematchResetDone = false;
    healBusy = false;
  }

  async function resetRaceRoomForNextRound(refs){
    const nowTs = now();
    const nextRoundId = makeRoundId();

    const playersSnap = await refs.players.once('value');
    const players = playersSnap.val() || {};

    const nextPlayers = {};
    Object.keys(players).forEach((pid) => {
      const p = players[pid] || {};
      nextPlayers[pid] = {
        ...p,
        ready: true,
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
      race: {
        winnerId: '',
        bestScore: 0,
        finishedAt: 0
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
      winnerId: '',
      bestScore: 0,
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
      await resetRaceRoomForNextRound(refs);
      console.log('[race-lobby] rematch room reset done');
    } catch (err) {
      console.error('[race-lobby] rematch room reset failed', err);
    }
  }

  async function joinBoundRoom(created){
    const nowTs = now();
    const existing = (S.players && S.players[S.uid]) ? S.players[S.uid] : null;

    const joinedPayload = {
      pid: S.uid,
      nick: getNick(),
      connected: true,
      ready: true,
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
        ready: true,
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
      setTop('สร้างห้องสำเร็จ');
      setSide('ส่ง room code หรือ QR นี้ให้เพื่อนอีกคน');
      if (RT) {
        await RT.roomCreated({
          participantIds: activePlayers().map((p) => p.pid || '')
        }).catch(() => {});
      }
    } else {
      setTop('เข้าห้องสำเร็จ');
      setSide('รอ host กด Start Race');
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
      S.roomKind = 'raceRooms';
      ensureRoomCode();

      const db = ensureFirebaseDb();
      const root = roomRootRef(db, S.roomKind, S.roomId);
      S.refs = buildRefs(root);

      const nowTs = Date.now();
      const initialSeed = String(getSeed());

      await dbWriteWithRetry(() => S.refs.meta.set({
        roomId:S.roomId,
        game:'goodjunk',
        mode:MODE_ID,
        diff:getDiff(),
        seed: initialSeed,
        hostPid:S.uid,
        minPlayers: MIN_PLAYERS,
        maxPlayers: MAX_PLAYERS,
        roomKind:S.roomKind,
        createdAt:nowTs,
        updatedAt:nowTs,
        rematchReady:false
      }));

      await dbWriteWithRetry(() => S.refs.state.set({
        status:'waiting',
        plannedSec:getTime(),
        seed: initialSeed,
        roundId:'',
        participantIds:[],
        countdownEndsAt:null,
        startAt:null,
        startedAt:null,
        winnerId:'',
        bestScore:0,
        createdAt:nowTs,
        updatedAt:nowTs
      }));

      await dbWriteWithRetry(() => S.refs.match.set({
        participantIds:[],
        lockedAt:null,
        status:'idle',
        race:{
          winnerId:'',
          bestScore:0,
          finishedAt:0
        }
      }));

      await joinBoundRoom(true);
    } catch (err) {
      console.error('[race-lobby] createRoom failed', err);
      setTop(`สร้างห้องไม่สำเร็จ: ${err && err.message ? err.message : err}`);
      setSide('ตรวจ rules / auth / database path แล้วลองใหม่');
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
        setTop('ไม่พบห้องนี้');
        setSide('ตรวจ room code แล้วลองใหม่');
        return;
      }

      S.roomKind = detectedKind;
      const root = roomRootRef(db, S.roomKind, S.roomId);
      S.refs = buildRefs(root);

      await joinBoundRoom(false);
    } catch (err) {
      console.error('[race-lobby] joinRoom failed', err);
      setTop(`เข้าห้องไม่สำเร็จ: ${err && err.message ? err.message : err}`);
      setSide('ตรวจ rules / auth / database path แล้วลองใหม่');
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
          race: {
            winnerId: '',
            bestScore: 0,
            finishedAt: 0
          }
        }).catch(() => {});

        await S.refs.state.update({
          status: 'waiting',
          participantIds: [],
          countdownEndsAt: null,
          startAt: null,
          startedAt: null,
          winnerId: '',
          bestScore: 0,
          updatedAt: now()
        }).catch(() => {});
      }
    } catch (_) {}

    cleanupRoom();
    renderState();
    setTop('ออกจากห้องแล้ว');
    setSide('สร้างห้องใหม่หรือเข้าห้องอื่นได้เลย');
  }

  async function startGame(){
    if (!S.joined || !S.refs || !isHost()) return;

    const actives = activePlayers();
    if (actives.length < MIN_PLAYERS) {
      setTop('ยังเริ่มไม่ได้');
      setSide('ต้องมีผู้เล่น 2 คนก่อน');
      return;
    }

    const participantIds = actives.slice(0, MAX_PLAYERS).map((p) => p.pid).filter(Boolean);
    if (participantIds.length < MIN_PLAYERS) {
      setTop('ยังเริ่มไม่ได้');
      setSide('participant ยังไม่ครบ 2 คน');
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
      race: {
        winnerId: '',
        bestScore: 0,
        finishedAt: 0
      }
    });

    await S.refs.state.update({
      status:'countdown',
      plannedSec: sharedTime,
      seed: sharedSeed,
      roundId: sharedRoundId,
      participantIds,
      countdownEndsAt: sharedStartAt,
      startAt: sharedStartAt,
      startedAt:null,
      winnerId:'',
      bestScore:0,
      updatedAt:Date.now()
    });

    const playersSnap = await S.refs.players.once('value');
    const players = playersSnap.val() || {};
    const updates = {};
    const nowTs = Date.now();

    Object.keys(players).forEach((pid) => {
      const inRound = participantIds.includes(pid);
      updates[`${pid}/phase`] = inRound ? 'run' : 'lobby';
      updates[`${pid}/finished`] = false;
      updates[`${pid}/finalScore`] = 0;
      updates[`${pid}/score`] = 0;
      updates[`${pid}/contribution`] = 0;
      updates[`${pid}/miss`] = 0;
      updates[`${pid}/streak`] = 0;
      updates[`${pid}/updatedAt`] = nowTs;
      updates[`${pid}/lastSeen`] = nowTs;
    });

    if (Object.keys(updates).length) {
      await S.refs.players.update(updates).catch(() => {});
    }

    if (RT) {
      await RT.countdownStarted({
        roundId: sharedRoundId,
        startAt: sharedStartAt,
        participantIds
      }).catch(() => {});
    }
  }

  function goRun(){
    if (S.redirecting || !S.roomId || !selfInParticipants()) return;
    S.redirecting = true;
    location.href = buildRunUrl(S.roomId);
  }

  async function pasteRoom(){
    try{
      const text = await navigator.clipboard.readText();
      if (UI.roomInput) UI.roomInput.value = cleanRoom(text || '');
      ensureRoomCode();
      renderState();
    } catch (_) {
      setTop('Paste ไม่สำเร็จ');
    }
  }

  function bind(){
    [UI.nickInput, UI.diffSelect, UI.timeSelect, UI.viewSelect, UI.seedInput, UI.roomInput].forEach((el) => {
      if (!el) return;
      el.addEventListener('input', () => {
        saveStored();
        ensureRoomCode();
        renderState();
      });
      el.addEventListener('change', () => {
        saveStored();
        ensureRoomCode();
        renderState();
      });
    });

    UI.btnCreateTop?.addEventListener('click', createRoom);
    UI.btnJoinTop?.addEventListener('click', joinRoom);
    UI.btnCreateRoom?.addEventListener('click', createRoom);
    UI.btnJoinRoom?.addEventListener('click', joinRoom);

    UI.btnPasteRoom?.addEventListener('click', pasteRoom);
    UI.btnRandomRoom?.addEventListener('click', () => {
      if (UI.roomInput) UI.roomInput.value = makeCode();
      ensureRoomCode();
      renderState();
    });

    UI.btnCopyRoom?.addEventListener('click', async () => {
      const ok = await copyText(S.roomId || (UI.roomInput && UI.roomInput.value) || '');
      setTop(ok ? 'คัดลอก room code แล้ว' : 'คัดลอก room code ไม่สำเร็จ');
    });

    UI.btnShareRoom?.addEventListener('click', async () => {
      const ok = await shareLink(buildLobbyUrl(S.roomId || cleanRoom((UI.roomInput && UI.roomInput.value) || makeCode())));
      setTop(ok ? 'แชร์ลิงก์แล้ว' : 'แชร์ไม่สำเร็จ');
    });

    UI.btnStartGame?.addEventListener('click', startGame);
    UI.btnLeaveRoom?.addEventListener('click', leaveRoom);

    UI.btnLauncher?.addEventListener('click', () => {
      location.href = `${LAUNCHER}${HUB ? `?hub=${encodeURIComponent(HUB)}` : ''}`;
    });

    UI.btnHub?.addEventListener('click', () => {
      location.href = HUB || '../hub.html';
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
        setTop(`เข้าห้องไม่สำเร็จ: ${err && err.message ? err.message : err}`);
      }
    }
  }

  async function init(){
    try {
      loadStored();

      if (UI.nickInput) UI.nickInput.value = clean(qs('name', qs('nick', UI.nickInput.value || '')), 24) || UI.nickInput.value || '';
      if (UI.diffSelect) UI.diffSelect.value = qs('diff', UI.diffSelect.value || 'normal') || 'normal';
      if (UI.timeSelect) UI.timeSelect.value = String(clamp(qs('time', UI.timeSelect.value || '90'), 60, 150));
      if (UI.viewSelect) UI.viewSelect.value = qs('view', UI.viewSelect.value || 'mobile') || 'mobile';
      if (UI.seedInput) UI.seedInput.value = qs('seed', UI.seedInput.value || '');

      ensureRoomCode();
      bind();
      renderState();

      setTop('กำลังเตรียม Firebase…');
      await waitForFirebaseReady();
      await ensureFreshAuthForWrite();

      initRuntime();
      if (RT) {
        await RT.flush().catch(() => {});
        await RT.lobbyReady({}).catch(() => {});
      }

      setTop('ใส่ชื่อ แล้วกดสร้างห้องหรือเข้าห้องได้เลย');
      await autoJoinIfNeeded();
    } catch (err) {
      console.error('[race-lobby] init failed', err);
      setTop(`เริ่มหน้า Lobby ไม่สำเร็จ: ${err && err.message ? err.message : err}`);
      setSide('ตรวจ firebase-config.js และการโหลด Firebase SDK');
      setBottom('ถ้ายังไม่ได้ ให้ refresh ใหม่อีกครั้ง');
    }
  }

  init();
})();