'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk-battle-lobby.js
 * GoodJunk Battle Lobby
 * FULL PATCH v20260404-battle-lobby-rematch-full
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

  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const now = () => Date.now();

  function byIds(...ids){
    for (const id of ids) {
      const el = D.getElementById(id);
      if (el) return el;
    }
    return null;
  }

  const MODE_ID = 'battle';
  const ROOM_PREFIX = 'GJB';
  const RUN_FILE = './goodjunk-battle-run.html';
  const LOBBY_FILE = './goodjunk-battle-lobby.html';
  const STORE_KEY = 'GJ_BATTLE_LOBBY_V2';
  const ACTIVE_TTL_MS = 12000;
  const HEARTBEAT_MS = 2500;
  const FIREBASE_WAIT_MS = 10000;
  const ROOM_KINDS = ['battleRooms', 'rooms'];
  const IS_REMATCH = qs('rematch', '0') === '1';

  const HUB = qs('hub', '../hub.html');
  const LAUNCHER = './goodjunk-multi.html';

  function roomPath(kind, roomId) {
    return `hha-battle/goodjunk/${kind}/${roomId}`;
  }

  function roomRootRef(db, kind, roomId) {
    return db.ref(roomPath(kind, roomId));
  }

  async function detectExistingRoomKind(db, roomId) {
    const preferred = clean(qs('roomKind', ''), 24);
    const order = preferred
      ? [preferred, ...ROOM_KINDS.filter(k => k !== preferred)]
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

  function makeBattleRoundId() {
    return `B-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  }

  function getBattleSeed() {
    const raw = UI.seedInput && UI.seedInput.value ? String(UI.seedInput.value).trim() : '';
    return raw || String(Date.now());
  }

  const UI = {
    topNotice: byIds('topNotice', 'hintTop'),
    sideNotice: byIds('sideNotice', 'hintSide'),
    bottomNotice: byIds('bottomNotice', 'hintBottom'),

    statusBadge: byIds('statusBadge', 'roomStatusBadge'),
    roomCodeBig: byIds('roomCodeBig', 'roomCode'),
    roomSummary: byIds('roomSummary', 'roomStatusText'),
    joinLinkText: byIds('joinLinkText', 'inviteLinkText'),
    inviteLink: byIds('inviteLink'),
    countdownBox: byIds('countdownBox', 'countdown', 'countdownLarge'),

    nickInput: byIds('nickInput', 'nameInput', 'playerName'),
    diffSelect: byIds('diffSelect'),
    timeSelect: byIds('timeSelect'),
    viewSelect: byIds('viewSelect'),
    seedInput: byIds('seedInput'),
    roomInput: byIds('roomInput'),

    btnCreateTop: byIds('btnCreateTop'),
    btnJoinTop: byIds('btnJoinTop'),
    btnLauncher: byIds('btnLauncher'),
    btnHub: byIds('btnHub', 'btnBack'),
    btnCreateRoom: byIds('btnCreateRoom', 'btnCreate'),
    btnJoinRoom: byIds('btnJoinRoom', 'btnJoin'),
    btnPasteRoom: byIds('btnPasteRoom'),
    btnShareRoom: byIds('btnShareRoom'),
    btnRandomRoom: byIds('btnRandomRoom'),
    btnCopyRoom: byIds('btnCopyRoom'),
    btnCopyInvite: byIds('btnCopyInvite'),
    btnStartGame: byIds('btnStartGame', 'btnStart'),
    btnLeaveRoom: byIds('btnLeaveRoom', 'btnLeave'),
    btnReady: byIds('btnReady'),
    btnUnready: byIds('btnUnready'),

    qrCanvas: byIds('qrCanvas'),
    qrBox: byIds('qrBox'),
    playersList: byIds('playersList', 'playersBox'),

    playerCount: byIds('playerCount'),
    hostName: byIds('hostName'),
    roomStatus: byIds('roomStatus'),

    debugRoomKind: byIds('debugRoomKind'),
    debugRoomPath: byIds('debugRoomPath'),
    debugRoomMeta: byIds('debugRoomMeta')
  };

  const S = {
    uid: '',
    roomId: '',
    roomKind: clean(qs('roomKind', ''), 24) || '',
    joined: false,
    players: {},
    meta: {},
    state: {
      status:'waiting',
      plannedSec:90,
      seed:'',
      roundId:'',
      participantIds:[]
    },
    match: {},
    refs: null,
    offFns: [],
    heartbeat: 0,
    countdownTick: 0,
    redirecting: false,
    firebaseReady: false
  };

  let __battleRematchResetDone = false;

  const setTop = (m)=> { if (UI.topNotice) UI.topNotice.textContent = m || ''; };
  const setSide = (m)=> { if (UI.sideNotice) UI.sideNotice.textContent = m || ''; };
  const setBottom = (m)=> { if (UI.bottomNotice) UI.bottomNotice.textContent = m || ''; };
  const isHost = ()=> !!S.uid && S.meta && S.meta.hostPid === S.uid;

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
        try { if (typeof off === 'function') off(); } catch(_) {}
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

  async function ensureAuth(){
    const user = await ensureAnonymousAuth();
    S.uid = user.uid;
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
      if(!raw) return;
      const d = JSON.parse(raw);
      if(d.nick && UI.nickInput) UI.nickInput.value = clean(d.nick,24);
      if(d.diff && UI.diffSelect) UI.diffSelect.value = d.diff;
      if(d.time && UI.timeSelect) UI.timeSelect.value = String(d.time);
      if(d.view && UI.viewSelect) UI.viewSelect.value = d.view;
      if(d.seed != null && UI.seedInput) UI.seedInput.value = String(d.seed);
    }catch{}
  }

  function saveStored(){
    try{
      localStorage.setItem(STORE_KEY, JSON.stringify({
        nick:getNick(),
        diff:getDiff(),
        time:getTime(),
        view:getView(),
        seed:getBattleSeed()
      }));
    }catch{}
  }

  const getNick = ()=> clean((UI.nickInput && UI.nickInput.value) || qs('name', qs('nick', 'Player')), 24) || 'Player';
  const getDiff = ()=> String((UI.diffSelect && UI.diffSelect.value) || qs('diff','normal') || 'normal');
  const getTime = ()=> clamp((UI.timeSelect && UI.timeSelect.value) || qs('time','90') || '90', 30, 300);
  const getView = ()=> String((UI.viewSelect && UI.viewSelect.value) || qs('view','mobile') || 'mobile');

  function escapeHtml(s){
    return String(s==null?'':s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function isActivePlayer(p, nowTs=now()){
    if(!p) return false;
    if(p.connected === false) return false;
    const lastSeen = num(p.lastSeen || p.updatedAt || p.joinedAt, 0);
    if(!lastSeen) return true;
    return (nowTs - lastSeen) <= ACTIVE_TTL_MS;
  }

  function activePlayers(){
    const nowTs = now();
    return Object.values(S.players || {})
      .filter((p)=>isActivePlayer(p, nowTs))
      .sort((a,b)=>num(a.joinedAt,0)-num(b.joinedAt,0));
  }

  function readyPlayers(){
    return activePlayers().filter(p => !!p.ready);
  }

  function ensureRoomCode(){
    const room = cleanRoom((UI.roomInput && UI.roomInput.value) || qs('roomId', qs('room', S.roomId || '')));
    S.roomId = room || makeCode();
    if (UI.roomInput) UI.roomInput.value = S.roomId;
    if (UI.roomCodeBig) UI.roomCodeBig.textContent = S.roomId;
  }

  function currentRoomPath() {
    if (!S.roomId || !S.roomKind) return '-';
    return roomPath(S.roomKind, S.roomId);
  }

  function renderRoomDebug() {
    if (UI.debugRoomKind) {
      UI.debugRoomKind.textContent = `roomKind: ${S.roomKind || '-'}`;
    }

    if (UI.debugRoomPath) {
      UI.debugRoomPath.textContent = `path: ${currentRoomPath()}`;
    }

    if (UI.debugRoomMeta) {
      UI.debugRoomMeta.textContent =
        `state: ${String((S.state && S.state.status) || 'waiting')} • roundId: ${String((S.state && S.state.roundId) || '-')} • rematch: ${IS_REMATCH ? 'yes' : 'no'}`;
    }

    console.log('[battle-lobby:debug]', {
      roomId: S.roomId,
      roomKind: S.roomKind,
      status: S.state?.status,
      roundId: S.state?.roundId,
      participantIds: S.state?.participantIds || [],
      rematch: IS_REMATCH
    });
  }

  function buildLobbyUrl(roomId){
    const url = new URL(LOBBY_FILE, location.href);
    const src = new URL(location.href);

    src.searchParams.forEach((value,key)=>{
      if(key === 'roomId' || key === 'room' || key === 'create') return;
      url.searchParams.set(key, value);
    });

    url.searchParams.set('mode', MODE_ID);
    url.searchParams.set('roomId', roomId);
    url.searchParams.set('room', roomId);
    url.searchParams.set('diff', getDiff());
    url.searchParams.set('time', String(getTime()));
    url.searchParams.set('view', getView());
    url.searchParams.set('seed', String(getBattleSeed()));
    url.searchParams.set('hub', HUB);
    url.searchParams.set('autojoin', '1');
    if (S.roomKind) url.searchParams.set('roomKind', S.roomKind);
    if (IS_REMATCH) url.searchParams.set('rematch', '1');
    return url.toString();
  }

  function buildRunUrl(roomId){
    const url = new URL(RUN_FILE, location.href);
    const src = new URL(location.href);

    src.searchParams.forEach((value,key)=>{
      if(key === 'roomId' || key === 'room' || key === 'create' || key === 'autojoin' || key === 'rematch') return;
      url.searchParams.set(key, value);
    });

    const sharedStartAt = num(S.state && (S.state.startAt || S.state.countdownEndsAt), 0);
    const sharedDiff = String((S.meta && S.meta.diff) || getDiff());
    const sharedTime = String(num(S.state && S.state.plannedSec, getTime()));
    const sharedSeed = String(
      (S.state && S.state.seed) ||
      (S.meta && S.meta.seed) ||
      getBattleSeed()
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

  async function copyText(t){
    const value = String(t || '').trim();
    if (!value) return false;

    try{
      await navigator.clipboard.writeText(value);
      return true;
    }catch{
      try{
        const ta = D.createElement('textarea');
        ta.value = value;
        ta.setAttribute('readonly','');
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
      if(navigator.share){
        await navigator.share({ title:'GoodJunk Battle Lobby', text:'มาเข้าห้อง Battle นี้ด้วยกัน', url });
        return true;
      }
    }catch{}
    return copyText(url);
  }

  function renderQr(){
    const link = buildLobbyUrl(S.roomId || makeCode());

    if (UI.joinLinkText) UI.joinLinkText.textContent = link;
    if (UI.inviteLink) UI.inviteLink.value = link;

    if (W.QRCode && UI.qrCanvas) {
      W.QRCode.toCanvas(UI.qrCanvas, link, {
        width:220,
        margin:1,
        color:{ dark:'#20324d', light:'#ffffff' }
      }, function(){});
      return;
    }

    if (UI.qrBox) {
      UI.qrBox.innerHTML = '';
      const img = new Image();
      img.alt = 'Battle Invite QR';
      img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(link);
      UI.qrBox.appendChild(img);
    }
  }

  function renderPlayers(){
    const box = UI.playersList;
    if (!box) return;

    const players = Object.values(S.players || {}).sort((a,b)=>num(a.joinedAt,0)-num(b.joinedAt,0));

    if(!players.length){
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
        </div>`;
      return;
    }

    box.innerHTML = players.map((p)=>{
      const active = isActivePlayer(p);
      const you = p.pid === S.uid;
      const host = p.pid === (S.meta && S.meta.hostPid);
      const phase = String(p.phase || 'lobby');
      const ready = !!p.ready;

      let badge = 'WAIT';
      if (you) badge = 'YOU';
      else if (active) badge = 'LIVE';
      else badge = 'OFFLINE';

      const miniBits = [
        host ? 'host' : 'guest',
        active ? 'online' : 'offline',
        ready ? 'ready' : 'not-ready',
        phase
      ];

      return `
        <div class="player">
          <div class="player-left">
            <div class="avatar">${host ? '👑' : '⚔️'}</div>
            <div>
              <div class="name">${escapeHtml(p.nick || 'player')} ${host ? '• host' : ''}</div>
              <div class="mini">${escapeHtml(miniBits.join(' • '))}</div>
            </div>
          </div>
          <div class="badge">${badge}</div>
        </div>`;
    }).join('');
  }

  function renderState(){
    ensureRoomCode();

    const active = activePlayers();
    const ready = readyPlayers();
    const count = active.length;
    const readyCount = ready.length;
    const status = String((S.state && S.state.status) || 'waiting');

    if (UI.statusBadge) UI.statusBadge.textContent = status.toUpperCase();
    if (UI.roomStatus) UI.roomStatus.textContent = status;
    if (UI.roomSummary) {
      UI.roomSummary.textContent =
        status === 'countdown' ? `กำลังนับถอยหลัง • ${count}/2 players`
        : (status === 'playing' || status === 'running') ? `กำลังเข้าเกม • ${count}/2 players`
        : status === 'ended' ? `รอบก่อนจบแล้ว • ${count}/2 players`
        : `รอผู้เล่น • ${count}/2 players • ready ${readyCount}/2`;
    }

    if (UI.playerCount) UI.playerCount.textContent = `${count} คน • ready ${readyCount}/2`;
    if (UI.hostName) {
      const hostPlayer = active.find(p => p.pid === (S.meta && S.meta.hostPid)) || Object.values(S.players || {}).find(p => p.pid === (S.meta && S.meta.hostPid));
      UI.hostName.textContent = hostPlayer ? (hostPlayer.nick || hostPlayer.pid || '-') : '-';
    }

    if (UI.btnStartGame) {
      UI.btnStartGame.disabled = !(S.joined && isHost() && readyCount >= 2 && (status === 'waiting' || status === 'ended'));
    }

    if (UI.btnLeaveRoom) UI.btnLeaveRoom.disabled = !S.joined;

    if (UI.btnReady) {
      const self = S.players && S.players[S.uid] ? S.players[S.uid] : null;
      UI.btnReady.disabled = !S.joined || (status !== 'waiting' && status !== 'ended');
      UI.btnReady.textContent = self && self.ready ? 'ยกเลิกพร้อม' : 'พร้อมแล้ว';
    }

    if (UI.btnUnready) {
      UI.btnUnready.disabled = !S.joined || (status !== 'waiting' && status !== 'ended');
    }

    if(!S.joined){
      setTop('ใส่ชื่อ แล้วกดสร้างห้องหรือเข้าห้องได้เลย');
      setSide('เมื่อเข้าห้องแล้ว QR, room code และรายชื่อผู้เล่นจะอัปเดตให้ทันที');
      setBottom('ถ้ายังมีแค่ 1 คน ระบบจะรอผู้เล่นอีก 1 คนก่อนเริ่ม');
    } else if(status === 'waiting' || status === 'ended'){
      if (IS_REMATCH) {
        setTop('กลับเข้าห้องเดิมแล้ว');
        setSide('รอบใหม่พร้อมแล้ว กดพร้อมทั้ง 2 คนก่อนเริ่ม battle');
        setBottom(`debug • rematch @ ${S.roomKind || '-'} / ${S.roomId || '-'}`);
      } else if(readyCount >= 2){
        setTop('ครบ 2 คนและพร้อมแล้ว Host กด Start Battle ได้เลย');
        setSide('ตอนนี้ห้องพร้อมเริ่ม battle แล้ว');
        setBottom(`debug • ${S.roomKind || '-'} / ${S.roomId || '-'}`);
      } else {
        setTop(`เข้าห้องสำเร็จ • รอผู้เล่นหรือรอพร้อมเพิ่ม`);
        setSide('ส่ง room code หรือให้เพื่อน scan QR เพื่อเข้าห้องเดียวกัน');
        setBottom(`debug • ${S.roomKind || '-'} / ${S.roomId || '-'}`);
      }
    } else if(status === 'countdown'){
      setTop('กำลังนับถอยหลัง เตรียมเข้าเกม');
      setSide('ทั้งสองฝั่งจะเข้า Battle พร้อมกัน');
      setBottom(`debug • countdown @ ${S.roomKind || '-'} / ${S.roomId || '-'}`);
    } else if(status === 'playing' || status === 'running'){
      setTop('กำลังพาเข้าสู่หน้าเล่นจริง');
      setSide('ถ้าไม่เด้งเอง ให้รอสักครู่');
      setBottom(`debug • running @ ${S.roomKind || '-'} / ${S.roomId || '-'}`);
    } else {
      setTop('อยู่ในห้อง Battle');
      setSide('รอการอัปเดตสถานะจาก host');
      setBottom(`debug • ${status} @ ${S.roomKind || '-'} / ${S.roomId || '-'}`);
    }

    renderPlayers();
    renderQr();
    renderRoomDebug();
  }

  function renderCountdown(){
    clearInterval(S.countdownTick);
    if (UI.countdownBox) UI.countdownBox.classList.remove('show');

    if(!S.joined || !S.state || S.state.status !== 'countdown') return;

    if (UI.countdownBox) UI.countdownBox.classList.add('show');

    S.countdownTick = setInterval(()=>{
      const targetAt = num(S.state.startAt || S.state.countdownEndsAt, 0);
      const leftMs = targetAt - now();
      const sec = Math.max(0, Math.ceil(leftMs / 1000));

      if (UI.countdownBox) UI.countdownBox.textContent = sec > 0 ? sec : 'GO!';

      if(leftMs <= 0){
        clearInterval(S.countdownTick);
        goRun();
      }
    }, 100);
  }

  function cleanupRoom(){
    clearInterval(S.heartbeat);
    clearInterval(S.countdownTick);
    S.heartbeat = 0;
    S.countdownTick = 0;

    while(S.offFns.length){
      const fn = S.offFns.pop();
      try{ fn(); }catch{}
    }

    S.joined = false;
    S.players = {};
    S.meta = {};
    S.match = {};
    S.state = {
      status:'waiting',
      plannedSec:getTime(),
      seed:'',
      roundId:'',
      participantIds:[]
    };
    S.refs = null;
    S.redirecting = false;
    __battleRematchResetDone = false;
    renderRoomDebug();
  }

  async function resetBattleRoomForNextRound(refs, ctxLike) {
    const nowTs = Date.now();
    const nextRoundId = makeBattleRoundId();

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
      battle: {
        winnerId: '',
        loserId: '',
        finishedAt: 0
      }
    });

    await refs.state.set({
      status: 'waiting',
      plannedSec: Number(ctxLike.time || 90),
      seed: String(ctxLike.seed || Date.now()),
      roundId: nextRoundId,
      participantIds: [],
      countdownEndsAt: null,
      startAt: null,
      startedAt: null,
      winnerId: '',
      loserId: '',
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

  async function maybePrepareRematchRoom(refs, ctxLike, hostFlag) {
    if (!IS_REMATCH) return;
    if (!hostFlag) return;
    if (__battleRematchResetDone) return;

    __battleRematchResetDone = true;

    try {
      await resetBattleRoomForNextRound(refs, ctxLike);
      console.log('[battle-lobby] rematch room reset done');
    } catch (err) {
      console.error('[battle-lobby] rematch room reset failed', err);
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

    try { S.refs.players.child(S.uid).onDisconnect().remove(); } catch {}

    const onMeta = (snap) => {
      S.meta = snap.val() || {};
      renderState();
    };

    const onState = (snap) => {
      S.state = snap.val() || {};
      renderState();
      renderCountdown();
      const st = String(S.state.status || '');
      if (st === 'running' || st === 'playing') {
        goRun();
      }
    };

    const onMatch = (snap) => {
      S.match = snap.val() || {};
      renderState();
    };

    const onPlayers = async (snap) => {
      S.players = snap.val() || {};

      if(isHost() && S.state && S.state.status === 'countdown' && readyPlayers().length < 2){
        await dbWriteWithRetry(() => S.refs.state.update({
          status:'waiting',
          countdownEndsAt:null,
          startAt:null,
          roundId:S.state.roundId || '',
          participantIds:[],
          updatedAt:Date.now()
        })).catch(()=>{});

        await dbWriteWithRetry(() => S.refs.match.update({
          participantIds:[],
          lockedAt:null,
          status:'idle',
          battle:{
            winnerId:'',
            loserId:'',
            finishedAt:0
          }
        })).catch(()=>{});
      }

      const actives = activePlayers();
      if(S.meta && S.meta.hostPid && !actives.find(p=>p.pid === S.meta.hostPid) && actives[0] && actives[0].pid === S.uid){
        await dbWriteWithRetry(() => S.refs.meta.update({ hostPid:S.uid, updatedAt:Date.now() })).catch(()=>{});
      }

      renderState();
    };

    const onResults = (snap) => {
      const results = snap.val() || {};
      const resultCount = Object.keys(results).length;
      console.log('[battle-lobby:results]', {
        roomId: S.roomId,
        roomKind: S.roomKind,
        resultCount
      });
    };

    S.refs.meta.on('value', onMeta);
    S.refs.state.on('value', onState);
    S.refs.match.on('value', onMatch);
    S.refs.players.on('value', onPlayers);
    S.refs.results.on('value', onResults);

    S.offFns.push(()=>S.refs.meta.off('value', onMeta));
    S.offFns.push(()=>S.refs.state.off('value', onState));
    S.offFns.push(()=>S.refs.match.off('value', onMatch));
    S.offFns.push(()=>S.refs.players.off('value', onPlayers));
    S.offFns.push(()=>S.refs.results.off('value', onResults));

    S.heartbeat = setInterval(()=>{
      S.refs.players.child(S.uid).update({
        pid:S.uid,
        nick:getNick(),
        connected:true,
        updatedAt:Date.now(),
        lastSeen:Date.now(),
        phase: 'lobby'
      }).catch(()=>{});
    }, HEARTBEAT_MS);

    S.joined = true;
    renderState();

    await maybePrepareRematchRoom(S.refs, {
      time: getTime(),
      seed: getBattleSeed()
    }, isHost());

    if (created) {
      setTop('สร้างห้องสำเร็จ');
      setSide('ส่ง room code หรือ QR นี้ให้เพื่อนอีกคน');
    } else {
      setTop('เข้าห้องสำเร็จ');
      setSide('รอ host กด Start Battle');
    }
  }

  async function createRoom(){
    try {
      await ensureFreshAuthForWrite();
      saveStored();

      cleanupRoom();
      S.roomId = makeCode();
      S.roomKind = 'battleRooms';

      if (UI.roomInput) UI.roomInput.value = S.roomId;
      if (UI.roomCodeBig) UI.roomCodeBig.textContent = S.roomId;
      renderRoomDebug();

      const db = ensureFirebaseDb();
      const root = roomRootRef(db, S.roomKind, S.roomId);
      S.refs = buildRefs(root);

      const nowTs = Date.now();
      const initialSeed = String(getBattleSeed());

      await dbWriteWithRetry(() => S.refs.meta.set({
        roomId:S.roomId,
        game:'goodjunk',
        mode:MODE_ID,
        diff:getDiff(),
        seed: initialSeed,
        hostPid:S.uid,
        minPlayers:2,
        maxPlayers:2,
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
        loserId:'',
        createdAt:nowTs,
        updatedAt:nowTs
      }));

      await dbWriteWithRetry(() => S.refs.match.set({
        participantIds:[],
        lockedAt:null,
        status:'idle',
        battle:{
          winnerId:'',
          loserId:'',
          finishedAt:0
        }
      }));

      await joinBoundRoom(true);
    } catch (err) {
      console.error('[battle-lobby] createRoom failed', err);
      setTop(`สร้างห้องไม่สำเร็จ: ${err && err.message ? err.message : err}`);
      setSide('ตรวจ rules / auth / database path แล้วลองใหม่');
    }
  }

  async function joinRoom(){
    try {
      await ensureFreshAuthForWrite();
      saveStored();

      cleanupRoom();
      S.roomId = cleanRoom((UI.roomInput && UI.roomInput.value) || '');
      if(!S.roomId){
        setTop('ยังไม่มี room code');
        UI.roomInput?.focus();
        return;
      }

      const db = ensureFirebaseDb();
      const detectedKind = await detectExistingRoomKind(db, S.roomId);

      if(!detectedKind){
        setTop('ไม่พบห้องนี้');
        setSide('ตรวจ room code แล้วลองใหม่');
        return;
      }

      S.roomKind = detectedKind;
      renderRoomDebug();

      const root = roomRootRef(db, S.roomKind, S.roomId);
      S.refs = buildRefs(root);

      await joinBoundRoom(false);
    } catch (err) {
      console.error('[battle-lobby] joinRoom failed', err);
      setTop(`เข้าห้องไม่สำเร็จ: ${err && err.message ? err.message : err}`);
      setSide('ตรวจ rules / auth / database path แล้วลองใหม่');
    }
  }

  async function leaveRoom(){
    if(!S.joined || !S.refs) return;

    try {
      await S.refs.players.child(S.uid).remove();
    } catch (_) {}

    try {
      const playersSnap = await S.refs.players.once('value');
      const players = playersSnap.val() || {};
      const ids = Object.keys(players);

      if (!ids.length) {
        await S.refs.root.remove().catch(()=>{});
      } else {
        const currentHost = String((S.meta && S.meta.hostPid) || '');
        if (currentHost === S.uid) {
          const nextHost = ids[0] || '';
          if (nextHost) {
            await S.refs.meta.update({
              hostPid: nextHost,
              updatedAt: now()
            }).catch(()=>{});
          }
        }

        await S.refs.match.update({
          participantIds:[],
          lockedAt:null,
          status:'idle',
          battle:{
            winnerId:'',
            loserId:'',
            finishedAt:0
          }
        }).catch(()=>{});

        await S.refs.state.update({
          status:'waiting',
          participantIds:[],
          countdownEndsAt:null,
          startAt:null,
          winnerId:'',
          loserId:'',
          updatedAt:now()
        }).catch(()=>{});
      }
    } catch (_) {}

    cleanupRoom();
    renderState();
  }

  async function setReadyFlag(flag){
    if(!S.joined || !S.refs) return;

    const status = String((S.state && S.state.status) || 'waiting');
    if (status !== 'waiting' && status !== 'ended') {
      setTop('ตอนนี้เปลี่ยนสถานะพร้อมไม่ได้แล้ว');
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
    } catch (err) {
      console.error('[battle-lobby] setReadyFlag failed', err);
    }
  }

  async function startGame(){
    if(!S.joined || !S.refs || !isHost()) return;

    const active = activePlayers();
    if(active.length < 2){
      setTop('ยังเริ่มไม่ได้');
      setSide('ต้องมีผู้เล่น 2 คนก่อน');
      return;
    }

    const ready = readyPlayers();
    if (ready.length < 2) {
      setTop('ยังเริ่มไม่ได้');
      setSide('ต้องพร้อมทั้ง 2 คนก่อน');
      return;
    }

    const participantIds = active.slice(0, 2).map(p => p.pid).filter(Boolean);
    if (participantIds.length < 2) {
      setTop('ยังเริ่มไม่ได้');
      setSide('participant ยังไม่ครบ 2 คน');
      return;
    }

    const sharedSeed = String(getBattleSeed());
    const sharedDiff = String(getDiff());
    const sharedTime = Number(getTime());
    const sharedStartAt = Date.now() + 3500;
    const sharedRoundId = makeBattleRoundId();

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
      battle: {
        winnerId: '',
        loserId: '',
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
      loserId:'',
      updatedAt:Date.now()
    });

    const playersSnap = await S.refs.players.once('value');
    const players = playersSnap.val() || {};
    const updates = {};
    const nowTs = Date.now();

    Object.keys(players).forEach((pid) => {
      updates[`${pid}/ready`] = true;
      updates[`${pid}/phase`] = 'run';
      updates[`${pid}/finished`] = false;
      updates[`${pid}/finalScore`] = 0;
      updates[`${pid}/score`] = 0;
      updates[`${pid}/contribution`] = 0;
      updates[`${pid}/miss`] = 0;
      updates[`${pid}/streak`] = 0;
      updates[`${pid}/updatedAt`] = nowTs;
      updates[`${pid}/lastSeen`] = nowTs;
    });

    await S.refs.players.update(updates).catch(()=>{});
  }

  function goRun(){
    if(S.redirecting || !S.roomId) return;
    S.redirecting = true;
    location.href = buildRunUrl(S.roomId);
  }

  async function pasteRoom(){
    try{
      const t = await navigator.clipboard.readText();
      if (UI.roomInput) UI.roomInput.value = cleanRoom(t || '');
      ensureRoomCode();
      renderState();
    }catch{
      setTop('Paste ไม่สำเร็จ');
    }
  }

  function bind(){
    [UI.nickInput,UI.diffSelect,UI.timeSelect,UI.viewSelect,UI.seedInput,UI.roomInput].forEach((el)=>{
      if (!el) return;
      el.addEventListener('input', ()=>{ saveStored(); ensureRoomCode(); renderState(); });
      el.addEventListener('change', ()=>{ saveStored(); ensureRoomCode(); renderState(); });
    });

    UI.btnCreateTop?.addEventListener('click', createRoom);
    UI.btnJoinTop?.addEventListener('click', joinRoom);
    UI.btnCreateRoom?.addEventListener('click', createRoom);
    UI.btnJoinRoom?.addEventListener('click', joinRoom);

    UI.btnPasteRoom?.addEventListener('click', pasteRoom);
    UI.btnRandomRoom?.addEventListener('click', ()=>{
      if (UI.roomInput) UI.roomInput.value = makeCode();
      ensureRoomCode();
      renderState();
    });

    UI.btnCopyRoom?.addEventListener('click', async ()=>{
      const ok = await copyText(S.roomId || (UI.roomInput && UI.roomInput.value) || '');
      setTop(ok ? 'คัดลอก room code แล้ว' : 'คัดลอก room code ไม่สำเร็จ');
    });

    UI.btnCopyInvite?.addEventListener('click', async ()=>{
      const ok = await copyText(buildLobbyUrl(S.roomId || cleanRoom((UI.roomInput && UI.roomInput.value) || makeCode())));
      setTop(ok ? 'คัดลอก invite link แล้ว' : 'คัดลอก invite link ไม่สำเร็จ');
    });

    UI.btnShareRoom?.addEventListener('click', async ()=>{
      const ok = await shareLink(buildLobbyUrl(S.roomId || cleanRoom((UI.roomInput && UI.roomInput.value) || makeCode())));
      setTop(ok ? 'แชร์ลิงก์แล้ว' : 'แชร์ไม่สำเร็จ');
    });

    UI.btnStartGame?.addEventListener('click', startGame);
    UI.btnLeaveRoom?.addEventListener('click', leaveRoom);
    UI.btnReady?.addEventListener('click', async ()=>{
      const self = S.players && S.players[S.uid] ? S.players[S.uid] : null;
      await setReadyFlag(!(self && self.ready));
    });
    UI.btnUnready?.addEventListener('click', ()=> setReadyFlag(false));

    UI.btnLauncher?.addEventListener('click', ()=>{
      location.href = `${LAUNCHER}${HUB ? `?hub=${encodeURIComponent(HUB)}` : ''}`;
    });

    UI.btnHub?.addEventListener('click', ()=>{
      location.href = HUB || '../hub.html';
    });

    W.addEventListener('beforeunload', ()=>{
      if(S.redirecting) return;
      if(S.refs && S.uid){
        try{ S.refs.players.child(S.uid).remove(); }catch{}
      }
    });
  }

  async function autoJoinIfNeeded(){
    const room = cleanRoom(qs('roomId', qs('room', '')));
    const autojoin = qs('autojoin', '') === '1';
    const roomKind = clean(qs('roomKind', ''), 24);

    if(!room) return;

    if (UI.roomInput) UI.roomInput.value = room;
    if (roomKind) S.roomKind = roomKind;
    ensureRoomCode();
    renderState();

    if(autojoin){
      try{
        await joinRoom();
      }catch(err){
        setTop(`เข้าห้องไม่สำเร็จ: ${err && err.message ? err.message : err}`);
      }
    }
  }

  async function init(){
    try {
      loadStored();

      if (UI.nickInput) {
        UI.nickInput.value = clean(qs('name', qs('nick', UI.nickInput.value || '')), 24) || UI.nickInput.value || '';
      }
      if (UI.diffSelect) {
        UI.diffSelect.value = qs('diff', UI.diffSelect.value || 'normal') || 'normal';
      }
      if (UI.timeSelect) {
        UI.timeSelect.value = String(clamp(qs('time', UI.timeSelect.value || '90'), 60, 150));
      }
      if (UI.viewSelect) {
        UI.viewSelect.value = qs('view', UI.viewSelect.value || 'mobile') || 'mobile';
      }
      if (UI.seedInput) {
        UI.seedInput.value = qs('seed', UI.seedInput.value || '');
      }

      ensureRoomCode();
      bind();
      renderState();

      setTop('กำลังเตรียม Firebase…');
      await waitForFirebaseReady();
      try { await ensureFreshAuthForWrite(); } catch (err) { console.warn('[battle-lobby] auth warmup failed', err); }
      setTop('ใส่ชื่อ แล้วกดสร้างห้องหรือเข้าห้องได้เลย');

      await autoJoinIfNeeded();
    } catch (err) {
      console.error('[battle-lobby] init failed', err);
      setTop(`เริ่มหน้า Lobby ไม่สำเร็จ: ${err && err.message ? err.message : err}`);
      setSide('ตรวจ firebase-config.js และการโหลด Firebase SDK');
      setBottom('ถ้ายังไม่ได้ ให้ refresh ใหม่อีกครั้ง');
    }
  }

  init();
})();