'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk-duet-lobby.js
 * GoodJunk Duet Lobby
 * FULL PATCH v20260405-gjduet-lobby-r16
 * - fix wait is not defined
 * - align firebase boot with firebase-config.js
 * - avoid duplicate anonymous sign-in
 * - send roomCode to run page
 * - keep rematch / countdown / host fallback logic
 * ========================================================= */
(function(){
  const W = window;
  const D = document;

  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const qs = (k, d='') => {
    try { return (new URL(location.href)).searchParams.get(k) ?? d; }
    catch(_) { return d; }
  };
  const num = (v, d=0) => {
    v = Number(v);
    return Number.isFinite(v) ? v : d;
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, num(v, a)));
  const clean = (s, max=24) => String(s == null ? '' : s)
    .replace(/[^a-zA-Z0-9ก-๙ _-]/g, '')
    .trim()
    .slice(0, max);
  const cleanRoom = (s) => String(s == null ? '' : s)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);

  const ACTIVE_TTL_MS = 12000;
  const HEARTBEAT_MS = 2500;
  const FIREBASE_WAIT_MS = 12000;
  const PENDING_REMATCH_KEY = 'GJ_DUET_PENDING_REMATCH_V1';

  const LOBBY_FILE = './goodjunk-duet-lobby.html';
  const RUN_FILE = './goodjunk-duet-play.html';

  const UI = {
    roomCode: D.getElementById('roomCode'),
    playerCount: D.getElementById('playerCount'),
    roomStatus: D.getElementById('roomStatus'),
    hostName: D.getElementById('hostName'),
    copyState: D.getElementById('copyState'),
    joinGuard: D.getElementById('joinGuard'),
    roomInput: D.getElementById('roomInput'),
    inviteLink: D.getElementById('inviteLink'),
    hint: D.getElementById('hint'),
    playersBox: D.getElementById('playersBox'),
    qrBox: D.getElementById('qrBox'),
    countdown: D.getElementById('countdown'),

    btnBack: D.getElementById('btnBack'),
    btnCopyRoom: D.getElementById('btnCopyRoom'),
    btnCopyInvite: D.getElementById('btnCopyInvite'),
    btnJoinByCode: D.getElementById('btnJoinByCode'),
    btnUseCurrentRoom: D.getElementById('btnUseCurrentRoom'),
    btnNewRoom: D.getElementById('btnNewRoom'),
    btnReady: D.getElementById('btnReady'),
    btnUnready: D.getElementById('btnUnready'),
    btnStart: D.getElementById('btnStart')
  };

  const ctx = {
    mode: 'duet',
    uid: '',
    name: clean(qs('name', qs('nick', 'Player')), 24) || 'Player',
    studyId: qs('studyId', ''),
    diff: qs('diff', 'normal'),
    time: String(clamp(qs('time', '90'), 30, 300)),
    seed: String(qs('seed', String(Date.now()))),
    hub: qs('hub', '../hub.html'),
    view: qs('view', 'mobile'),
    run: qs('run', 'play'),
    gameId: qs('gameId', 'goodjunk'),
    zone: qs('zone', 'nutrition'),
    roomId: cleanRoom(qs('roomId', qs('room', qs('roomCode', ''))))
  };

  const S = {
    db: null,
    refs: null,
    joined: false,
    redirecting: false,
    selfOnDisconnect: null,

    roomId: ctx.roomId || '',
    hostId: '',
    createdAt: 0,
    updatedAt: 0,
    room: null,
    state: {
      status: 'waiting',
      plannedSec: num(ctx.time, 90),
      seed: ctx.seed,
      startAt: null,
      countdownEndsAt: null
    },
    players: {},
    rematch: {},
    heartbeat: 0,
    countdownTick: 0,
    offFns: [],
    rematchSynced: false,
    rematchResetRunning: false
  };

  function log(...args){
    console.log('[gj-duet-lobby]', ...args);
  }

  function escapeHtml(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function makeRoomCode(){
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  function clearPendingRematch(){
    try { sessionStorage.removeItem(PENDING_REMATCH_KEY); } catch(_) {}
    try { localStorage.removeItem(PENDING_REMATCH_KEY); } catch(_) {}
  }

  function readPendingRematch(){
    try{
      const raw = sessionStorage.getItem(PENDING_REMATCH_KEY) || localStorage.getItem(PENDING_REMATCH_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return null;
      return obj;
    }catch(_){
      return null;
    }
  }

  function clearRematchQueryFromUrl(){
    try{
      const u = new URL(location.href);
      u.searchParams.delete('rematch');
      history.replaceState(null, '', u.toString());
    }catch(_){}
  }

  function hasMatchingPendingRematch(roomId, pid){
    const obj = readPendingRematch();
    if (!obj) return false;
    if (String(obj.roomId || '') !== String(roomId || '')) return false;
    if (String(obj.pid || '') !== String(pid || '')) return false;
    return true;
  }

  function setCopyState(text, danger=false){
    if (!UI.copyState) return;
    UI.copyState.textContent = String(text || '');
    UI.copyState.style.color = danger ? '#ffd5db' : '#dbeafe';
  }

  function setHint(text){
    if (!UI.hint) UI.hint.textContent = String(text || '');
  }

  function showGuard(text=''){
    if (!UI.joinGuard) return;
    UI.joinGuard.style.display = text ? 'block' : 'none';
    UI.joinGuard.textContent = String(text || '');
  }

  function extractStatus(raw){
    return String((raw && raw.state && raw.state.status) || raw?.status || 'waiting');
  }

  function extractPlannedSec(raw){
    return num((raw && raw.state && raw.state.plannedSec) || raw?.plannedSec || ctx.time, 90);
  }

  function extractSeed(raw){
    return String((raw && raw.state && raw.state.seed) || raw?.seed || ctx.seed);
  }

  function extractStartAt(raw){
    const v = num((raw && raw.state && raw.state.startAt) || raw?.startAt || 0, 0);
    return v || null;
  }

  function extractCountdownEndsAt(raw){
    const v = num((raw && raw.state && raw.state.countdownEndsAt) || raw?.countdownEndsAt || 0, 0);
    return v || null;
  }

  function activePlayers(srcRoom){
    const roomPlayers = (srcRoom && srcRoom.players) ? srcRoom.players : (S.players || {});
    const nowTs = Date.now();

    return Object.values(roomPlayers)
      .filter((p) => {
        if (!p) return false;
        if (String(p.phase || '') === 'left') return false;
        if (p.connected === false) return false;
        const lastSeen = num(p.lastSeenAt, num(p.joinedAt, 0));
        if (!lastSeen) return true;
        return (nowTs - lastSeen) <= ACTIVE_TTL_MS;
      })
      .sort((a, b) => num(a.joinedAt, 0) - num(b.joinedAt, 0));
  }

  function readyPlayers(srcRoom){
    return activePlayers(srcRoom).filter((p) => !!p.ready);
  }

  function statusText(){
    return String((S.state && S.state.status) || 'waiting');
  }

  function mePlayer(){
    return S.players && ctx.uid ? S.players[ctx.uid] : null;
  }

  function isHost(){
    return !!ctx.uid && S.hostId === ctx.uid;
  }

  function getCurrentParticipantIds(room){
    const raw = (((room || {}).match || {}).participantIds || []).filter(Boolean);
    if (raw.length) return raw.map(x => String(x));
    return activePlayers(room).map((p) => String(p.id || '')).filter(Boolean).slice(0, 2);
  }

  function getRematchCount(room){
    const ids = getCurrentParticipantIds(room);
    const votes = (room && room.rematch) ? room.rematch : {};
    let n = 0;
    ids.forEach((id) => {
      if (votes[id] && votes[id].ready) n += 1;
    });
    return n;
  }

  function buildInviteUrl(roomId=S.roomId){
    const url = new URL(LOBBY_FILE, location.href);
    const src = new URL(location.href);

    src.searchParams.forEach((value, key) => {
      if (key === 'roomId' || key === 'room' || key === 'roomCode' || key === 'autojoin' || key === 'rematch') return;
      url.searchParams.set(key, value);
    });

    url.searchParams.set('mode', 'duet');
    url.searchParams.set('roomId', roomId);
    url.searchParams.set('room', roomId);
    url.searchParams.set('roomCode', roomId);
    url.searchParams.set('hub', ctx.hub);
    url.searchParams.set('gameId', ctx.gameId);
    url.searchParams.set('zone', ctx.zone);
    url.searchParams.set('diff', ctx.diff);
    url.searchParams.set('time', ctx.time);
    url.searchParams.set('view', ctx.view);
    url.searchParams.set('seed', ctx.seed);
    url.searchParams.set('autojoin', '1');
    return url.toString();
  }

  function buildRunUrl(){
    const url = new URL(RUN_FILE, location.href);
    const src = new URL(location.href);

    src.searchParams.forEach((value, key) => {
      if (key === 'roomId' || key === 'room' || key === 'roomCode' || key === 'autojoin' || key === 'rematch') return;
      url.searchParams.set(key, value);
    });

    const startAt = num(S.state.startAt || S.state.countdownEndsAt, 0);

    url.searchParams.set('mode', 'duet');
    url.searchParams.set('entry', 'duet-lobby');
    url.searchParams.set('roomId', S.roomId);
    url.searchParams.set('room', S.roomId);
    url.searchParams.set('roomCode', S.roomId);
    url.searchParams.set('pid', ctx.uid || 'anon');
    url.searchParams.set('name', ctx.name);
    url.searchParams.set('nick', ctx.name);
    url.searchParams.set('role', isHost() ? 'host' : 'player');
    url.searchParams.set('host', isHost() ? '1' : '0');
    url.searchParams.set('wait', '1');
    url.searchParams.set('diff', ctx.diff);
    url.searchParams.set('time', String(num(S.state.plannedSec, num(ctx.time, 90))));
    url.searchParams.set('view', ctx.view);
    url.searchParams.set('seed', String(S.state.seed || ctx.seed));
    url.searchParams.set('hub', ctx.hub);
    url.searchParams.set('gameId', ctx.gameId);
    url.searchParams.set('zone', ctx.zone);
    url.searchParams.set('autostart', '1');
    if (startAt > 0) url.searchParams.set('startAt', String(startAt));

    return url.toString();
  }

  function updateUrlRoom(roomId){
    try{
      const u = new URL(location.href);
      u.searchParams.set('roomId', roomId);
      u.searchParams.set('room', roomId);
      u.searchParams.set('roomCode', roomId);
      history.replaceState(null, '', u.toString());
    }catch(_){}
  }

  async function copyText(text){
    const value = String(text || '').trim();
    if (!value) return false;

    try{
      await navigator.clipboard.writeText(value);
      return true;
    }catch(_){
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
      }catch(_2){
        return false;
      }
    }
  }

  function renderQr(){
    if (!UI.qrBox) return;
    const link = buildInviteUrl(S.roomId || ctx.roomId || makeRoomCode());

    if (UI.inviteLink) UI.inviteLink.value = link;

    const img = new Image();
    img.alt = 'Duet Invite QR';
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=' + encodeURIComponent(link);

    UI.qrBox.innerHTML = '';
    img.onload = () => {
      UI.qrBox.innerHTML = '';
      UI.qrBox.appendChild(img);
    };
    img.onerror = () => {
      UI.qrBox.innerHTML = '<div class="qr-empty">สร้าง QR ไม่สำเร็จ<br/>ใช้ Invite Link แทนได้</div>';
    };
  }

  function renderPlayers(){
    if (!UI.playersBox) return;

    const roomStatus = statusText();
    const list = Object.values(S.players || {}).sort((a,b) => num(a.joinedAt,0) - num(b.joinedAt,0));

    if (!list.length) {
      UI.playersBox.innerHTML = `
        <div class="player">
          <div style="font-weight:1000;color:#fff;">ยังไม่มีผู้เล่น</div>
          <div class="waiting" style="margin-top:8px;">waiting</div>
        </div>
      `;
      return;
    }

    UI.playersBox.innerHTML = list.map((p) => {
      const isMe = p.id === ctx.uid;
      const active = activePlayers().some((x) => x.id === p.id);
      const hostTag = p.id === S.hostId ? ' • host' : '';
      const meTag = isMe ? ' • คุณ' : '';

      let cls = 'waiting';
      let label = 'ยังไม่พร้อม';

      if (!active || String(p.phase || '') === 'left') {
        cls = 'offline';
        label = 'offline';
      } else if (roomStatus === 'running' || String(p.phase || '') === 'run') {
        cls = 'ready';
        label = 'กำลังเล่น';
      } else if ((roomStatus === 'finished' || roomStatus === 'ended') && String(p.phase || '') === 'done') {
        cls = 'ready';
        label = 'จบรอบแล้ว';
      } else if (p.ready) {
        cls = 'ready';
        label = 'พร้อมแล้ว';
      }

      return `
        <div class="player ${isMe ? 'me' : ''}">
          <div style="font-size:14px;font-weight:1000;color:#fff;">
            ${escapeHtml(p.name || 'player')}${escapeHtml(hostTag)}${escapeHtml(meTag)}
          </div>
          <div style="margin-top:8px;">
            <span class="${cls}">${escapeHtml(label)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderHeader(){
    const actives = activePlayers();
    const host = S.players && S.hostId ? S.players[S.hostId] : null;

    if (UI.roomCode) UI.roomCode.textContent = `ROOM: ${S.roomId || '-'}`;
    if (UI.playerCount) UI.playerCount.textContent = `${actives.length}/2`;
    if (UI.roomStatus) UI.roomStatus.textContent = statusText();
    if (UI.hostName) UI.hostName.textContent = host ? (host.name || 'player') : '-';
    if (UI.roomInput && !UI.roomInput.matches(':focus')) UI.roomInput.value = S.roomId || '';

    renderQr();
  }

  function renderButtons(){
    const status = statusText();
    const me = mePlayer();

    if (UI.btnReady) UI.btnReady.disabled = !S.joined || !me || status !== 'waiting' || !!me.ready;
    if (UI.btnUnready) UI.btnUnready.disabled = !S.joined || !me || status !== 'waiting' || !me.ready;
    if (UI.btnStart) UI.btnStart.disabled = !S.joined || !isHost() || readyPlayers().length < 2 || status !== 'waiting';
  }

  function renderNotice(){
    const status = statusText();
    const ready = readyPlayers().length;
    const actives = activePlayers().length;

    showGuard('');

    if (!S.joined) {
      setHint('กำลังเชื่อมห้อง Duet...');
      setCopyState('กำลังเตรียมห้อง...', false);
      return;
    }

    if (status === 'waiting') {
      clearPendingRematch();
      clearRematchQueryFromUrl();

      if (actives < 2) {
        setHint('ต้องมีผู้เล่นครบ 2 คนก่อน');
        setCopyState('ส่ง room code หรือ invite link ให้อีกเครื่องเข้าร่วม', false);
      } else if (ready < 2) {
        setHint('ผู้เล่นทั้ง 2 คนต้อง ready ก่อนเริ่ม');
        setCopyState('ตอนนี้เข้าห้องครบแล้ว รอ ready ให้ครบ', false);
      } else if (isHost()) {
        setHint('พร้อมครบทั้ง 2 คนแล้ว Host กดเริ่ม Duet ได้');
        setCopyState('พร้อมเริ่มเล่นคู่แล้ว', false);
      } else {
        setHint('พร้อมครบทั้ง 2 คนแล้ว รอ Host กดเริ่ม');
        setCopyState('รอ Host เริ่มเกม', false);
      }
      return;
    }

    if (status === 'countdown') {
      setHint('กำลังนับถอยหลัง เตรียมเข้าเกมพร้อมกัน');
      setCopyState('ห้องถูกล็อกแล้ว กำลังจะเริ่ม Duet', true);
      return;
    }

    if (status === 'running') {
      setHint('กำลังพาเข้าสู่หน้าเล่นจริง');
      setCopyState('Duet กำลังเริ่มแล้ว', true);
      return;
    }

    if (status === 'finished' || status === 'ended') {
      const rematchCount = getRematchCount(S.room);
      setHint(`รอบก่อนหน้าจบแล้ว กดรีแมตช์ครบ 2 คน (${rematchCount}/2)`);
      setCopyState(`รอรีแมตช์ ${rematchCount}/2`, false);
      return;
    }
  }

  function renderCountdown(){
    clearInterval(S.countdownTick);
    S.countdownTick = 0;
    if (UI.countdown) UI.countdown.textContent = '';

    const targetAt = num(S.state.startAt || S.state.countdownEndsAt, 0);
    if (statusText() !== 'countdown' || !targetAt) return;

    S.countdownTick = setInterval(async () => {
      const leftMs = targetAt - Date.now();
      const sec = Math.max(0, Math.ceil(leftMs / 1000));
      if (UI.countdown) UI.countdown.textContent = sec > 0 ? String(sec) : 'GO!';

      if (leftMs <= 0) {
        clearInterval(S.countdownTick);
        S.countdownTick = 0;

        if (isHost()) {
          await S.refs.root.update({
            status: 'running',
            startAt: targetAt,
            countdownEndsAt: targetAt,
            updatedAt: Date.now()
          }).catch(()=>{});
          await S.refs.state.update({
            status: 'running',
            startAt: targetAt,
            countdownEndsAt: targetAt,
            updatedAt: Date.now()
          }).catch(()=>{});
          await S.refs.match.update({
            status: 'running'
          }).catch(()=>{});
        }

        goRun();
      }
    }, 100);
  }

  async function waitForFirebaseReady(timeoutMs = FIREBASE_WAIT_MS){
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      if (W.HHA_FIREBASE_READY && W.HHA_FIREBASE_DB && W.HHA_FIREBASE_AUTH) {
        S.db = W.HHA_FIREBASE_DB || S.db;
        return true;
      }

      if (W.HHA_FIREBASE_ERROR) {
        throw new Error(W.HHA_FIREBASE_ERROR);
      }

      await wait(120);
    }

    throw new Error(W.HHA_FIREBASE_ERROR || 'firebase not ready');
  }

  async function ensureAuth(){
    await waitForFirebaseReady();

    const auth =
      W.HHA_FIREBASE_AUTH ||
      (W.firebase && W.firebase.auth ? W.firebase.auth() : null);

    if (!auth) {
      throw new Error('firebase auth sdk not loaded');
    }

    if (auth.currentUser && auth.currentUser.uid) {
      ctx.uid = auth.currentUser.uid;
      return auth.currentUser;
    }

    const startedAt = Date.now();
    while (Date.now() - startedAt < FIREBASE_WAIT_MS) {
      if (auth.currentUser && auth.currentUser.uid) {
        ctx.uid = auth.currentUser.uid;
        return auth.currentUser;
      }

      if (W.HHA_FIREBASE_UID) {
        ctx.uid = W.HHA_FIREBASE_UID;
        return auth.currentUser || { uid: W.HHA_FIREBASE_UID };
      }

      if (W.HHA_FIREBASE_ERROR) {
        throw new Error(W.HHA_FIREBASE_ERROR);
      }

      await wait(120);
    }

    throw new Error('anonymous auth timeout');
  }

  function getDb(){
    if (S.db) return S.db;
    if (W.HHA_FIREBASE_DB) {
      S.db = W.HHA_FIREBASE_DB;
      return S.db;
    }
    if (W.firebase && W.firebase.database) {
      S.db = W.firebase.database();
      return S.db;
    }
    throw new Error('firebase db not ready');
  }

  async function dbWriteWithRetry(task, label='db-write', tries=2){
    let lastErr = null;

    for (let i = 0; i < tries; i++){
      try{
        return await task();
      }catch(err){
        lastErr = err;
        console.warn('[gj-duet-lobby]', label, 'failed try', i + 1, err && err.message ? err.message : err);
        await wait(250);
      }
    }

    throw lastErr || new Error(label + ' failed');
  }

  function attachRefs(roomId){
    S.roomId = roomId;
    const db = getDb();
    const root = db.ref(`hha-battle/goodjunk/duetRooms/${roomId}`);
    S.refs = {
      root,
      state: root.child('state'),
      match: root.child('match'),
      players: root.child('players'),
      results: root.child('results'),
      rematch: root.child('rematch')
    };
    updateUrlRoom(roomId);
  }

  function cleanupSubs(){
    clearInterval(S.heartbeat);
    clearInterval(S.countdownTick);
    S.heartbeat = 0;
    S.countdownTick = 0;

    while (S.offFns.length) {
      const fn = S.offFns.pop();
      try { fn(); } catch(_) {}
    }

    S.joined = false;
    S.players = {};
    S.rematch = {};
    S.room = null;
    S.hostId = '';
    S.createdAt = 0;
    S.updatedAt = 0;
    S.selfOnDisconnect = null;
    S.rematchSynced = false;
    S.rematchResetRunning = false;
    S.state = {
      status: 'waiting',
      plannedSec: num(ctx.time, 90),
      seed: ctx.seed,
      startAt: null,
      countdownEndsAt: null
    };
    S.redirecting = false;
  }

  async function removeSelfFromCurrentRoom(){
    if (!S.refs || !ctx.uid) return;

    try {
      if (S.selfOnDisconnect && typeof S.selfOnDisconnect.cancel === 'function') {
        await S.selfOnDisconnect.cancel();
      }
    } catch(_) {}

    try {
      await S.refs.players.child(ctx.uid).update({
        connected: false,
        ready: false,
        phase: 'left',
        lastSeenAt: Date.now()
      });
    } catch(_) {}
  }

  async function createRoomAndJoin(newRoomId){
    cleanupSubs();
    attachRefs(newRoomId);

    const nowTs = Date.now();

    await dbWriteWithRetry(() => S.refs.root.update({
      roomId: newRoomId,
      game: 'goodjunk',
      mode: 'duet',
      hostId: ctx.uid,
      createdAt: nowTs,
      updatedAt: nowTs,
      status: 'waiting',
      plannedSec: num(ctx.time, 90),
      seed: ctx.seed,
      startAt: null,
      countdownEndsAt: null
    }), 'root.update(create-room)');

    await dbWriteWithRetry(() => S.refs.state.update({
      status: 'waiting',
      plannedSec: num(ctx.time, 90),
      seed: ctx.seed,
      startAt: null,
      countdownEndsAt: null,
      updatedAt: nowTs
    }), 'state.update(create-room)');

    await dbWriteWithRetry(() => S.refs.match.update({
      participantIds: [],
      lockedAt: null,
      status: 'idle',
      race: { finishedAt: 0 }
    }), 'match.update(create-room)');

    await joinCurrentRoom(true);
  }

  function getJoinBlockReason(snapshot){
    if (!snapshot) return '';
    const status = extractStatus(snapshot);
    const players = snapshot.players || {};
    const active = activePlayers(snapshot);

    if (players[ctx.uid]) return '';
    if (active.length >= 2) return 'ห้องนี้เต็มแล้ว (Duet เล่นได้ 2 คน)';
    if (status === 'countdown') return 'ห้องนี้กำลังนับถอยหลังก่อนเริ่มเกม';
    if (status === 'running') return 'ห้องนี้กำลังเล่นอยู่ ไม่สามารถเข้ากลางเกมได้';
    return '';
  }

  async function joinCurrentRoom(created=false){
    const snap = await S.refs.root.once('value');
    const raw = snap.val() || null;

    if (!raw) {
      if (!created) {
        await createRoomAndJoin(S.roomId || makeRoomCode());
        return;
      }
    }

    const blockReason = getJoinBlockReason(raw);
    if (blockReason) {
      showGuard(blockReason);
      setHint(blockReason);
      return;
    }

    const selfRef = S.refs.players.child(ctx.uid);
    const nowTs = Date.now();
    const prev = raw && raw.players ? raw.players[ctx.uid] : null;

    await dbWriteWithRetry(() => selfRef.update({
      id: ctx.uid,
      name: ctx.name,
      ready: false,
      connected: true,
      joinedAt: num(prev && prev.joinedAt, nowTs) || nowTs,
      lastSeenAt: nowTs,
      finished: false,
      finalScore: 0,
      miss: 0,
      streak: 0,
      score: 0,
      phase: 'lobby'
    }), 'players/self.update(join-room)');

    try {
      const od = selfRef.onDisconnect();
      S.selfOnDisconnect = od || null;
      if (od && typeof od.update === 'function') {
        od.update({
          connected: false,
          ready: false,
          phase: 'left',
          lastSeenAt: Date.now()
        });
      }
    } catch(_) {}

    S.joined = true;
    subscribeRoom();

    setHint(created ? 'สร้างห้องสำเร็จแล้ว' : 'เข้าห้องสำเร็จแล้ว');
    setCopyState('ส่ง room code หรือ invite link ให้อีกเครื่องเข้าร่วม', false);
    startHeartbeat();
  }

  async function performHostRematchReset(room){
    if (!isHost() || S.rematchResetRunning) return;
    S.rematchResetRunning = true;

    try{
      const ids = Array.from(new Set([
        ...getCurrentParticipantIds(room),
        ...Object.keys((room && room.players) || {})
      ])).filter(Boolean);

      const nextSeed = String(Date.now());
      const nowTs = Date.now();

      await S.refs.root.update({
        status: 'waiting',
        plannedSec: num(ctx.time, 90),
        seed: nextSeed,
        startAt: null,
        countdownEndsAt: null,
        updatedAt: nowTs
      }).catch(()=>{});

      await S.refs.state.update({
        status: 'waiting',
        plannedSec: num(ctx.time, 90),
        seed: nextSeed,
        startAt: null,
        countdownEndsAt: null,
        updatedAt: nowTs
      }).catch(()=>{});

      await S.refs.match.update({
        participantIds: [],
        lockedAt: null,
        status: 'idle',
        finishedAt: null
      }).catch(()=>{});

      await S.refs.results.set(null).catch(()=>{});
      await S.refs.rematch.set(null).catch(()=>{});

      for (const id of ids){
        await S.refs.players.child(id).update({
          ready: false,
          connected: true,
          phase: 'lobby',
          finished: false,
          finalScore: 0,
          miss: 0,
          streak: 0,
          score: 0,
          lastSeenAt: nowTs
        }).catch(()=>{});
      }

      clearPendingRematch();
      clearRematchQueryFromUrl();
      S.rematchSynced = false;
    } finally {
      S.rematchResetRunning = false;
    }
  }

  async function syncPendingRematchFromLobby(){
    if (!S.refs || !ctx.uid || !S.roomId) return;

    const rematchQuery = String(qs('rematch', '0')) === '1';
    const hasPending = hasMatchingPendingRematch(S.roomId, ctx.uid);

    if (!rematchQuery && !hasPending) return;
    if (S.rematchSynced) return;

    S.rematchSynced = true;

    try{
      const current = await S.refs.root.once('value');
      const room = current.val() || null;
      if (!room) {
        clearPendingRematch();
        clearRematchQueryFromUrl();
        return;
      }

      const st = extractStatus(room);
      if (st === 'waiting') {
        clearPendingRematch();
        clearRematchQueryFromUrl();
        return;
      }

      await S.refs.players.child(ctx.uid).update({
        connected: true,
        ready: false,
        phase: 'lobby',
        lastSeenAt: Date.now()
      }).catch(()=>{});

      await S.refs.rematch.child(ctx.uid).set({
        uid: ctx.uid,
        pid: ctx.uid,
        name: ctx.name || 'Player',
        ready: true,
        requestedAt: Date.now()
      });

      const snap2 = await S.refs.root.once('value');
      const room2 = snap2.val() || null;
      if (!room2) return;

      const count = getRematchCount(room2);
      if (count >= 2 && isHost()) {
        await performHostRematchReset(room2);
      }

      clearPendingRematch();
      clearRematchQueryFromUrl();
    }catch(err){
      console.warn('[gj-duet-lobby] syncPendingRematchFromLobby failed', err);
      S.rematchSynced = false;
    }
  }

  function goRun(){
    if (S.redirecting) return;
    if (statusText() !== 'running' && statusText() !== 'countdown') return;
    S.redirecting = true;
    location.href = buildRunUrl();
  }

  function subscribeRoom(){
    const onValue = async (snap) => {
      const raw = snap.val() || {};

      S.room = raw;
      S.hostId = String(raw.hostId || '');
      S.createdAt = num(raw.createdAt, 0);
      S.updatedAt = num(raw.updatedAt, 0);
      S.players = raw.players || {};
      S.rematch = raw.rematch || {};
      S.state = {
        status: extractStatus(raw),
        plannedSec: extractPlannedSec(raw),
        seed: extractSeed(raw),
        startAt: extractStartAt(raw),
        countdownEndsAt: extractCountdownEndsAt(raw)
      };

      const actives = activePlayers(raw);
      const firstActive = actives[0];

      if (!actives.some((p) => p.id === S.hostId) && firstActive && firstActive.id === ctx.uid) {
        await S.refs.root.update({
          hostId: ctx.uid,
          updatedAt: Date.now()
        }).catch(()=>{});
      }

      if (statusText() === 'countdown' && actives.length < 2 && isHost()) {
        await S.refs.root.update({
          status: 'waiting',
          startAt: null,
          countdownEndsAt: null,
          updatedAt: Date.now()
        }).catch(()=>{});

        await S.refs.state.update({
          status: 'waiting',
          startAt: null,
          countdownEndsAt: null,
          updatedAt: Date.now()
        }).catch(()=>{});

        await S.refs.match.update({
          participantIds: [],
          lockedAt: null,
          status: 'idle'
        }).catch(()=>{});
      }

      if ((statusText() === 'finished' || statusText() === 'ended') && isHost()) {
        const rematchCount = getRematchCount(raw);
        if (rematchCount >= 2) {
          await performHostRematchReset(raw);
        }
      }

      renderAll();

      if (statusText() === 'finished' || statusText() === 'ended') {
        syncPendingRematchFromLobby().catch(()=>{});
      }

      if (statusText() === 'running' || statusText() === 'countdown') {
        goRun();
      }
    };

    const onError = (err) => {
      console.error('[goodjunk-duet-lobby] subscribe failed:', err);
      setHint(`เข้าห้องไม่สำเร็จ: ${err && err.message ? err.message : err}`);
      setCopyState('ตรวจ firebase-config.js / auth / duetRooms rules แล้วลองใหม่', true);
      showGuard('permission denied หรือ firebase ยังไม่พร้อม');
    };

    S.refs.root.on('value', onValue, onError);
    S.offFns.push(() => S.refs.root.off('value', onValue));
  }

  function startHeartbeat(){
    clearInterval(S.heartbeat);
    S.heartbeat = setInterval(() => {
      if (!S.joined || !S.refs || !ctx.uid) return;
      S.refs.players.child(ctx.uid).update({
        name: ctx.name,
        connected: true,
        lastSeenAt: Date.now(),
        phase: statusText() === 'running' ? 'run' : 'lobby'
      }).catch(()=>{});
    }, HEARTBEAT_MS);
  }

  async function setReady(flag){
    if (!S.joined || statusText() !== 'waiting') return;

    await S.refs.players.child(ctx.uid).update({
      ready: !!flag,
      connected: true,
      lastSeenAt: Date.now(),
      phase: 'lobby'
    }).catch(()=>{});
  }

  async function startDuet(){
    if (!S.joined || !isHost()) return;

    const actives = activePlayers();
    const ready = readyPlayers();

    if (actives.length < 2) {
      setHint('ต้องมีผู้เล่นครบ 2 คนก่อน');
      return;
    }
    if (ready.length < 2) {
      setHint('ผู้เล่นทั้ง 2 คนต้อง ready ก่อนเริ่ม');
      return;
    }

    const startAt = Date.now() + 3500;
    const participantIds = ready.slice(0, 2).map((p) => p.id);

    await S.refs.match.update({
      participantIds,
      lockedAt: Date.now(),
      status: 'countdown',
      race: { finishedAt: 0 }
    }).catch(()=>{});

    await S.refs.root.update({
      status: 'countdown',
      plannedSec: num(ctx.time, 90),
      seed: ctx.seed,
      startAt,
      countdownEndsAt: startAt,
      updatedAt: Date.now()
    }).catch((err) => {
      console.error('[goodjunk-duet-lobby] startDuet root failed:', err);
      setHint(`เริ่ม Duet ไม่สำเร็จ: ${err && err.message ? err.message : err}`);
    });

    await S.refs.state.update({
      status: 'countdown',
      plannedSec: num(ctx.time, 90),
      seed: ctx.seed,
      startAt,
      countdownEndsAt: startAt,
      updatedAt: Date.now()
    }).catch((err) => {
      console.error('[goodjunk-duet-lobby] startDuet state failed:', err);
      setHint(`เริ่ม Duet ไม่สำเร็จ: ${err && err.message ? err.message : err}`);
    });
  }

  async function joinByCode(){
    const room = cleanRoom(UI.roomInput && UI.roomInput.value || '');
    if (!room) {
      setHint('กรอก Room Code ก่อน');
      return;
    }

    try {
      if (S.joined && S.roomId && S.roomId !== room) {
        await removeSelfFromCurrentRoom();
      }
      cleanupSubs();
      attachRefs(room);
      await joinCurrentRoom(false);
      await syncPendingRematchFromLobby();
    } catch (err) {
      console.error('[goodjunk-duet-lobby] joinByCode failed:', err);
      setHint(`เข้าห้องไม่สำเร็จ: ${err && err.message ? err.message : err}`);
    }
  }

  function useCurrentRoom(){
    if (!S.roomId) {
      setHint('ยังไม่มีห้องปัจจุบัน');
      return;
    }
    if (UI.roomInput) UI.roomInput.value = S.roomId;
  }

  async function makeNewRoom(){
    try {
      clearPendingRematch();
      clearRematchQueryFromUrl();

      if (S.joined) {
        await removeSelfFromCurrentRoom();
      }

      const room = makeRoomCode();
      cleanupSubs();
      attachRefs(room);
      await createRoomAndJoin(room);
    } catch (err) {
      console.error('[goodjunk-duet-lobby] makeNewRoom failed:', err);
      setHint(`สร้างห้องไม่สำเร็จ: ${err && err.message ? err.message : err}`);
      setCopyState(`สร้างห้องไม่สำเร็จ: ${err && err.code ? err.code + ': ' : ''}${err && err.message ? err.message : err}`, true);
      showGuard('permission denied หรือ firebase ยังไม่พร้อม');
    }
  }

  async function onBack(){
    try {
      clearPendingRematch();
      clearRematchQueryFromUrl();
      if (!S.redirecting && S.joined) {
        await removeSelfFromCurrentRoom();
      }
    } catch(_) {}
    location.href = ctx.hub || '../hub.html';
  }

  function renderAll(){
    renderHeader();
    renderPlayers();
    renderButtons();
    renderNotice();
    renderCountdown();
  }

  function bindUI(){
    UI.btnBack && UI.btnBack.addEventListener('click', (e) => {
      e.preventDefault();
      onBack();
    });

    UI.btnCopyRoom && UI.btnCopyRoom.addEventListener('click', async () => {
      const ok = await copyText(S.roomId || '');
      setCopyState(ok ? `คัดลอก Room Code แล้ว: ${S.roomId}` : 'คัดลอก Room Code ไม่สำเร็จ', !ok);
    });

    UI.btnCopyInvite && UI.btnCopyInvite.addEventListener('click', async () => {
      const ok = await copyText(buildInviteUrl(S.roomId || ctx.roomId || makeRoomCode()));
      setCopyState(ok ? 'คัดลอก Invite Link แล้ว' : 'คัดลอก Invite Link ไม่สำเร็จ', !ok);
    });

    UI.btnJoinByCode && UI.btnJoinByCode.addEventListener('click', joinByCode);
    UI.btnUseCurrentRoom && UI.btnUseCurrentRoom.addEventListener('click', useCurrentRoom);
    UI.btnNewRoom && UI.btnNewRoom.addEventListener('click', makeNewRoom);

    UI.btnReady && UI.btnReady.addEventListener('click', () => setReady(true));
    UI.btnUnready && UI.btnUnready.addEventListener('click', () => setReady(false));
    UI.btnStart && UI.btnStart.addEventListener('click', startDuet);

    if (UI.roomInput) {
      UI.roomInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          joinByCode();
        }
      });
    }

    W.addEventListener('beforeunload', () => {
      if (S.redirecting) return;
      try {
        if (S.refs && ctx.uid) {
          S.refs.players.child(ctx.uid).update({
            connected: false,
            ready: false,
            phase: 'left',
            lastSeenAt: Date.now()
          }).catch(()=>{});
        }
      } catch(_) {}
    });

    D.addEventListener('visibilitychange', () => {
      if (D.visibilityState === 'visible' && S.joined) {
        S.refs.players.child(ctx.uid).update({
          connected: true,
          lastSeenAt: Date.now()
        }).catch(()=>{});
      }
    });
  }

  async function boot(){
    try {
      bindUI();
      renderAll();

      setHint('กำลังเชื่อม Firebase...');
      await ensureAuth();

      if (!ctx.uid) {
        throw new Error('missing firebase uid');
      }

      await wait(150);

      if (ctx.roomId) {
        attachRefs(ctx.roomId);
        await joinCurrentRoom(false);
      } else {
        const room = makeRoomCode();
        attachRefs(room);
        await createRoomAndJoin(room);
      }

      await syncPendingRematchFromLobby();
      renderAll();
      log('boot ok', { roomId: S.roomId, uid: ctx.uid });
    } catch (err) {
      console.error('[goodjunk-duet-lobby] boot failed:', err);
      const msg = err && err.message ? err.message : String(err || 'unknown');
      setHint(`เริ่ม Duet Lobby ไม่สำเร็จ: ${msg}`);
      setCopyState('ตรวจ firebase-config.js / auth / duetRooms rules แล้วลองใหม่', true);
      showGuard(msg || 'permission denied หรือ firebase ยังไม่พร้อม');
    }
  }

  boot();
})();