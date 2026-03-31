'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk-coop-lobby.js
 * GoodJunk Coop Lobby
 * FULL PATCH v20260331-coop-lobby-auth-ready
 * ========================================================= */
(function(){
  const W = window;
  const D = document;

  const qs = (k, d='') => {
    try { return (new URL(location.href)).searchParams.get(k) ?? d; }
    catch { return d; }
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
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 24);

  const ROOM_PREFIX = 'GJC';
  const ACTIVE_TTL_MS = 12000;
  const HEARTBEAT_MS = 2500;
  const FIREBASE_WAIT_MS = 12000;

  const ROOM_FILE = './goodjunk-coop-lobby.html';
  const RUN_FILE = './goodjunk-coop-run.html';

  const HUB = qs('hub', '../hub.html');

  const UI = {
    roomCode: D.getElementById('roomCode'),
    roomStatus: D.getElementById('roomStatus'),
    hostName: D.getElementById('hostName'),
    playerCount: D.getElementById('playerCount'),
    countdown: D.getElementById('countdown'),
    countdownLarge: D.getElementById('countdownLarge'),
    inviteLink: D.getElementById('inviteLink'),
    copyState: D.getElementById('copyState'),
    joinGuard: D.getElementById('joinGuard'),
    qrBox: D.getElementById('qrBox'),
    hint: D.getElementById('hint'),
    playersBox: D.getElementById('playersBox'),
    btnCopyRoom: D.getElementById('btnCopyRoom'),
    btnCopyInvite: D.getElementById('btnCopyInvite'),
    btnBack: D.getElementById('btnBack'),
    btnReady: D.getElementById('btnReady'),
    btnStart: D.getElementById('btnStart'),
    btnSpectate: D.getElementById('btnSpectate')
  };

  const ctx = {
    mode: 'coop',
    pid: '',
    name: clean(qs('name', qs('nick', 'Player')), 24) || 'Player',
    studyId: qs('studyId', ''),
    diff: qs('diff', 'normal'),
    time: String(clamp(qs('time', '120'), 60, 300)),
    seed: String(qs('seed', String(Date.now()))),
    hub: HUB,
    view: qs('view', 'mobile'),
    run: qs('run', 'play'),
    gameId: qs('gameId', 'goodjunk'),
    zone: qs('zone', 'nutrition'),
    roomId: cleanRoom(qs('roomId', qs('room', ''))) || `${ROOM_PREFIX}-${Math.random().toString(36).slice(2,8).toUpperCase()}`
  };

  const S = {
    uid: '',
    joined: false,
    redirecting: false,
    db: null,
    refs: null,
    meta: {},
    state: {
      status: 'waiting',
      plannedSec: num(ctx.time, 120),
      seed: ctx.seed,
      participantIds: []
    },
    players: {},
    heartbeat: 0,
    countdownTick: 0,
    offFns: []
  };

  const setHint = (msg) => { if (UI.hint) UI.hint.textContent = String(msg || ''); };
  const setCopyState = (msg, danger=false) => {
    if (!UI.copyState) return;
    UI.copyState.textContent = String(msg || '');
    UI.copyState.style.color = danger ? '#9b4d22' : '';
  };
  const showGuard = (msg='') => {
    if (!UI.joinGuard) return;
    UI.joinGuard.style.display = msg ? 'block' : 'none';
    UI.joinGuard.textContent = String(msg || '');
  };

  function roomRootPath(roomId){
    return `hha-battle/goodjunk/coopRooms/${roomId}`;
  }

  function hasFirebaseReady(){
    return !!(W.HHA_FIREBASE_READY && W.HHA_FIREBASE_DB);
  }

  function isHost(){
    return !!S.uid && !!S.meta && S.meta.hostPid === S.uid;
  }

  function activePlayers(){
    const nowTs = Date.now();
    return Object.values(S.players || {})
      .filter((p) => {
        if (!p) return false;
        if (p.connected === false) return false;
        const lastSeen = num(p.lastSeen || p.updatedAt || p.joinedAt, 0);
        if (!lastSeen) return true;
        return (nowTs - lastSeen) <= ACTIVE_TTL_MS;
      })
      .sort((a, b) => num(a.joinedAt, 0) - num(b.joinedAt, 0));
  }

  function readyPlayers(){
    return activePlayers().filter((p) => !!p.ready);
  }

  function currentParticipantIds(){
    return Array.isArray(S.state && S.state.participantIds)
      ? S.state.participantIds.map((x) => String(x || ''))
      : [];
  }

  function amIParticipant(){
    const ids = currentParticipantIds();
    if (!ids.length) return false;
    return ids.includes(S.uid);
  }

  function buildInviteUrl(roomId = ctx.roomId){
    const url = new URL(ROOM_FILE, location.href);
    const src = new URL(location.href);

    src.searchParams.forEach((value, key) => {
      if (key === 'roomId' || key === 'room' || key === 'pid' || key === 'name' || key === 'nick') return;
      url.searchParams.set(key, value);
    });

    url.searchParams.set('mode', 'coop');
    url.searchParams.set('roomId', roomId);
    url.searchParams.set('room', roomId);
    url.searchParams.set('diff', String((S.meta && S.meta.diff) || ctx.diff));
    url.searchParams.set('time', String(num((S.state && S.state.plannedSec), num(ctx.time, 120))));
    url.searchParams.set('view', ctx.view);
    url.searchParams.set('seed', String((S.state && S.state.seed) || (S.meta && S.meta.seed) || ctx.seed));
    url.searchParams.set('hub', ctx.hub);
    url.searchParams.set('gameId', ctx.gameId);
    url.searchParams.set('zone', ctx.zone);
    url.searchParams.set('autojoin', '1');
    return url.toString();
  }

  function buildRunUrl(){
    const url = new URL(RUN_FILE, location.href);
    const src = new URL(location.href);

    src.searchParams.forEach((value, key) => {
      if (key === 'roomId' || key === 'room' || key === 'autojoin') return;
      url.searchParams.set(key, value);
    });

    url.searchParams.set('mode', 'coop');
    url.searchParams.set('entry', 'lobby');
    url.searchParams.set('roomId', ctx.roomId);
    url.searchParams.set('room', ctx.roomId);
    url.searchParams.set('pid', S.uid || 'anon');
    url.searchParams.set('name', ctx.name);
    url.searchParams.set('nick', ctx.name);
    url.searchParams.set('role', isHost() ? 'host' : 'player');
    url.searchParams.set('host', isHost() ? '1' : '0');
    url.searchParams.set('wait', '1');
    url.searchParams.set('diff', String((S.meta && S.meta.diff) || ctx.diff));
    url.searchParams.set('time', String(num(S.state && S.state.plannedSec, num(ctx.time, 120))));
    url.searchParams.set('view', ctx.view);
    url.searchParams.set('seed', String((S.state && S.state.seed) || (S.meta && S.meta.seed) || ctx.seed));
    url.searchParams.set('hub', ctx.hub);
    url.searchParams.set('gameId', ctx.gameId);
    url.searchParams.set('zone', ctx.zone);
    url.searchParams.set('autostart', '1');

    const startAt = num(S.state && (S.state.startAt || S.state.countdownEndsAt), 0);
    if (startAt > 0) url.searchParams.set('startAt', String(startAt));

    return url.toString();
  }

  async function copyText(text){
    const value = String(text || '').trim();
    if (!value) return false;
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (_) {
      try {
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
      } catch (_) {
        return false;
      }
    }
  }

  function renderQr(){
    if (!UI.qrBox) return;
    const link = buildInviteUrl(ctx.roomId);
    if (UI.inviteLink) UI.inviteLink.value = link;

    const img = new Image();
    img.alt = 'Coop Invite QR';
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(link);

    UI.qrBox.innerHTML = '';
    img.onload = () => {
      UI.qrBox.innerHTML = '';
      UI.qrBox.appendChild(img);
    };
    img.onerror = () => {
      UI.qrBox.innerHTML = '<div class="qr-empty">สร้าง QR ไม่สำเร็จ<br/>ใช้ Invite Link ด้านบนแทนได้</div>';
    };
  }

  function renderPlayers(){
    if (!UI.playersBox) return;

    const list = Object.values(S.players || {}).sort((a,b) => num(a.joinedAt,0) - num(b.joinedAt,0));
    if (!list.length) {
      UI.playersBox.innerHTML = `
        <div class="player">
          <div><strong>ยังไม่มีผู้เล่น</strong></div>
          <div class="waiting">waiting</div>
        </div>
      `;
      return;
    }

    const participantSet = new Set(currentParticipantIds());
    const locked = ['countdown','running'].includes(String(S.state && S.state.status || ''));

    UI.playersBox.innerHTML = list.map((p) => {
      const active = activePlayers().some((x) => x.pid === p.pid);
      const hostTag = p.pid === (S.meta && S.meta.hostPid) ? ' • host' : '';
      const youTag = p.pid === S.uid ? ' • คุณ' : '';
      const participantTag = locked && participantSet.has(p.pid) ? ' • participant' : '';

      let status = active ? 'online' : 'offline';
      let cls = active ? 'ready' : 'waiting';

      if (String(p.phase || '') === 'done') {
        status = 'จบรอบแล้ว';
        cls = 'ready';
      } else if (String(p.phase || '') === 'run') {
        status = 'กำลังเล่น';
        cls = 'ready';
      } else if (p.ready) {
        status = 'พร้อมแล้ว';
        cls = 'ready';
      } else if (active) {
        status = 'ยังไม่พร้อม';
        cls = 'waiting';
      }

      return `
        <div class="player">
          <div>
            <strong>${escapeHtml(p.nick || 'player')}</strong>${escapeHtml(hostTag)}${escapeHtml(youTag)}
          </div>
          <div class="${cls}">${escapeHtml(status)}${escapeHtml(participantTag)}</div>
        </div>
      `;
    }).join('');
  }

  function escapeHtml(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function renderRoomInfo(){
    if (UI.roomCode) UI.roomCode.textContent = ctx.roomId || '-';
    if (UI.roomStatus) UI.roomStatus.textContent = String((S.state && S.state.status) || 'waiting');

    const hostPid = S.meta && S.meta.hostPid;
    const host = Object.values(S.players || {}).find((p) => p.pid === hostPid);
    if (UI.hostName) UI.hostName.textContent = host ? (host.nick || 'Player') : '-';

    const readyCount = readyPlayers().length;
    const activeCount = activePlayers().length;
    if (UI.playerCount) UI.playerCount.textContent = `${activeCount} คน • ready ${readyCount}/${num(S.meta && S.meta.minPlayers, 2)}`;

    renderQr();
  }

  function renderButtons(){
    const status = String((S.state && S.state.status) || 'waiting');
    const me = S.players && S.players[S.uid];

    if (UI.btnReady) {
      UI.btnReady.disabled = !S.joined || !me || status !== 'waiting';
      UI.btnReady.textContent = me && me.ready ? 'ยกเลิกพร้อม' : 'พร้อมแล้ว';
    }

    if (UI.btnStart) {
      UI.btnStart.disabled = !S.joined || !isHost() || readyPlayers().length < num(S.meta && S.meta.minPlayers, 2) || !['waiting','ended'].includes(status);
      UI.btnStart.textContent = isHost() ? 'เริ่ม Coop' : 'รอ Host เริ่ม';
    }

    if (UI.btnSpectate) {
      UI.btnSpectate.style.display = (status === 'running' && !amIParticipant()) ? '' : 'none';
    }
  }

  function renderHint(){
    const status = String((S.state && S.state.status) || 'waiting');
    const readyCount = readyPlayers().length;
    const minPlayers = num(S.meta && S.meta.minPlayers, 2);

    if (!S.joined) {
      setHint('กำลังเชื่อมห้อง...');
      setCopyState('ส่ง room code หรือลิงก์นี้ให้เพื่อนได้', false);
      showGuard('');
      return;
    }

    if (status === 'waiting') {
      showGuard('');
      if (readyCount < minPlayers) {
        setHint(`ต้องมีผู้เล่น ready อย่างน้อย ${minPlayers} คน`);
      } else if (isHost()) {
        setHint('ผู้เล่นพร้อมครบแล้ว Host กดเริ่ม Coop ได้');
      } else {
        setHint('ผู้เล่นพร้อมครบแล้ว รอ Host กดเริ่ม');
      }
      setCopyState('ส่ง room code หรือลิงก์นี้ให้ผู้เล่นคนอื่นเข้าร่วมได้', false);
      return;
    }

    if (status === 'countdown') {
      showGuard('');
      if (amIParticipant()) {
        setHint('กำลังนับถอยหลังก่อนเข้าเกม');
      } else {
        setHint('รอบนี้ถูกล็อก participant แล้ว คุณไม่ได้อยู่ในรอบนี้');
      }
      setCopyState('ห้องถูกล็อกแล้ว กำลังจะเริ่มเกม', true);
      return;
    }

    if (status === 'running') {
      if (amIParticipant()) {
        setHint('กำลังพาเข้าสู่หน้าเล่นจริง');
      } else {
        setHint('รอบนี้กำลังเล่นอยู่ และคุณไม่ได้อยู่ใน participant');
      }
      setCopyState('ตอนนี้ห้องกำลังเล่นอยู่', true);
      showGuard(amIParticipant() ? '' : 'รอบนี้เริ่มแล้ว ผู้เล่นใหม่จะไม่เข้ากลางเกม');
      return;
    }

    if (status === 'ended') {
      showGuard('');
      setHint('รอบก่อนจบแล้ว Host สามารถเริ่มรอบใหม่ได้');
      setCopyState('รอบนี้จบแล้ว สามารถเล่นใหม่ได้', false);
      return;
    }
  }

  function renderCountdown(){
    clearInterval(S.countdownTick);
    S.countdownTick = 0;

    const status = String((S.state && S.state.status) || 'waiting');
    const targetAt = num(S.state && (S.state.startAt || S.state.countdownEndsAt), 0);

    if (UI.countdown) UI.countdown.textContent = status === 'countdown' ? '...' : '-';
    if (UI.countdownLarge) {
      UI.countdownLarge.style.display = status === 'countdown' ? '' : 'none';
      UI.countdownLarge.textContent = '';
    }

    if (status !== 'countdown' || !targetAt) return;

    S.countdownTick = setInterval(async () => {
      const leftMs = targetAt - Date.now();
      const sec = Math.max(0, Math.ceil(leftMs / 1000));

      if (UI.countdown) UI.countdown.textContent = sec > 0 ? String(sec) : 'GO!';
      if (UI.countdownLarge) UI.countdownLarge.textContent = sec > 0 ? String(sec) : 'GO!';

      if (leftMs <= 0) {
        clearInterval(S.countdownTick);
        S.countdownTick = 0;

        if (isHost()) {
          await S.refs.state.update({
            status: 'running',
            startedAt: Date.now(),
            updatedAt: Date.now()
          }).catch(()=>{});
        }

        maybeGoRun();
      }
    }, 100);
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
  }

  async function waitForFirebaseReady(timeoutMs = FIREBASE_WAIT_MS){
    if (hasFirebaseReady()) return true;

    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('firebase not ready')), timeoutMs);

      W.addEventListener('hha:firebase_ready', (ev) => {
        clearTimeout(timer);
        if (ev && ev.detail && ev.detail.ok) resolve(true);
        else reject(new Error((ev && ev.detail && ev.detail.error) || 'firebase not ready'));
      }, { once:true });
    });
  }

  async function ensureAuth(){
    await waitForFirebaseReady();
    if (typeof W.HHA_ensureAnonymousAuth !== 'function') {
      throw new Error('HHA_ensureAnonymousAuth not found');
    }
    const user = await W.HHA_ensureAnonymousAuth();
    if (!user || !user.uid) throw new Error('anonymous auth failed');
    S.uid = user.uid;
    ctx.pid = user.uid;
    return user;
  }

  function getDb(){
    if (S.db) return S.db;
    if (W.HHA_FIREBASE_DB) {
      S.db = W.HHA_FIREBASE_DB;
      return S.db;
    }
    if (typeof W.HHA_ENSURE_FIREBASE_DB === 'function') {
      S.db = W.HHA_ENSURE_FIREBASE_DB();
      return S.db;
    }
    throw new Error('firebase db not ready');
  }

  function attachRefs(){
    const db = getDb();
    const root = db.ref(roomRootPath(ctx.roomId));
    S.refs = {
      root,
      meta: root.child('meta'),
      state: root.child('state'),
      players: root.child('players'),
      results: root.child('results')
    };
  }

  async function ensureRoomExists(){
    const metaSnap = await S.refs.meta.once('value');
    if (metaSnap.exists()) return;

    const nowTs = Date.now();
    await S.refs.meta.set({
      roomId: ctx.roomId,
      game: 'goodjunk',
      mode: 'coop',
      diff: ctx.diff,
      seed: ctx.seed,
      hostPid: S.uid,
      minPlayers: 2,
      maxPlayers: 5,
      createdAt: nowTs,
      updatedAt: nowTs
    });

    await S.refs.state.set({
      status: 'waiting',
      plannedSec: num(ctx.time, 120),
      seed: ctx.seed,
      countdownEndsAt: null,
      startAt: null,
      startedAt: null,
      participantIds: [],
      updatedAt: nowTs
    });
  }

  async function joinRoom(){
    const selfRef = S.refs.players.child(S.uid);
    const nowTs = Date.now();

    await selfRef.set({
      pid: S.uid,
      nick: ctx.name,
      connected: true,
      ready: false,
      joinedAt: nowTs,
      updatedAt: nowTs,
      lastSeen: nowTs,
      phase: 'lobby',
      score: 0,
      contribution: 0
    });

    try { selfRef.onDisconnect().remove(); } catch(_) {}
    S.joined = true;
  }

  function subscribeRoom(){
    const onMeta = (snap) => {
      S.meta = snap.val() || {};
      renderAll();
    };
    const onState = (snap) => {
      S.state = snap.val() || { status:'waiting', plannedSec:num(ctx.time,120), seed:ctx.seed, participantIds:[] };
      renderAll();

      if (String(S.state.status || '') === 'running') {
        maybeGoRun();
      }
    };
    const onPlayers = async (snap) => {
      S.players = snap.val() || {};

      const active = activePlayers();
      const hostStillHere = active.some((p) => p.pid === (S.meta && S.meta.hostPid));

      if (S.joined && isHost() && String(S.state && S.state.status) === 'countdown' && readyPlayers().length < num(S.meta && S.meta.minPlayers, 2)) {
        await S.refs.state.update({
          status: 'waiting',
          countdownEndsAt: null,
          startAt: null,
          participantIds: [],
          updatedAt: Date.now()
        }).catch(()=>{});
      }

      if (S.joined && !hostStillHere && active.length) {
        const nextHost = active[0];
        if (nextHost && nextHost.pid === S.uid) {
          await S.refs.meta.update({
            hostPid: S.uid,
            updatedAt: Date.now()
          }).catch(()=>{});
        }
      }

      renderAll();
    };

    const onError = (err) => {
      console.error('[goodjunk-coop-lobby] subscribe failed:', err);
      setHint(`เข้าห้องไม่สำเร็จ: ${err && err.message ? err.message : err}`);
      setCopyState('permission denied หรือ path ไม่ตรง rules', true);
      showGuard('ห้องนี้ยังเข้าไม่ได้ กรุณาตรวจ rules / auth / path coopRooms');
    };

    S.refs.meta.on('value', onMeta, onError);
    S.refs.state.on('value', onState, onError);
    S.refs.players.on('value', onPlayers, onError);

    S.offFns.push(() => S.refs.meta.off('value', onMeta));
    S.offFns.push(() => S.refs.state.off('value', onState));
    S.offFns.push(() => S.refs.players.off('value', onPlayers));
  }

  function startHeartbeat(){
    clearInterval(S.heartbeat);
    S.heartbeat = setInterval(() => {
      if (!S.joined) return;
      S.refs.players.child(S.uid).update({
        nick: ctx.name,
        connected: true,
        updatedAt: Date.now(),
        lastSeen: Date.now()
      }).catch(()=>{});
    }, HEARTBEAT_MS);
  }

  async function toggleReady(){
    if (!S.joined) return;
    if (String(S.state && S.state.status) !== 'waiting') return;

    const me = S.players && S.players[S.uid];
    if (!me) return;

    await S.refs.players.child(S.uid).update({
      ready: !me.ready,
      phase: 'lobby',
      connected: true,
      updatedAt: Date.now(),
      lastSeen: Date.now()
    }).catch(()=>{});
  }

  async function startCoop(){
    if (!S.joined || !isHost()) return;

    const participants = readyPlayers();
    const minPlayers = num(S.meta && S.meta.minPlayers, 2);

    if (participants.length < minPlayers) {
      setHint(`ต้องมีผู้เล่น ready อย่างน้อย ${minPlayers} คน`);
      return;
    }

    const startAt = Date.now() + 3500;
    const participantIds = participants.map((p) => p.pid).filter(Boolean);

    await S.refs.meta.update({
      diff: ctx.diff,
      seed: ctx.seed,
      updatedAt: Date.now()
    }).catch(()=>{});

    await S.refs.state.update({
      status: 'countdown',
      plannedSec: num(ctx.time, 120),
      seed: ctx.seed,
      countdownEndsAt: startAt,
      startAt: startAt,
      startedAt: null,
      participantIds,
      updatedAt: Date.now()
    }).catch((err) => {
      console.error('[goodjunk-coop-lobby] startCoop failed:', err);
      setHint(`เริ่ม coop ไม่สำเร็จ: ${err && err.message ? err.message : err}`);
    });
  }

  function maybeGoRun(){
    if (S.redirecting) return;
    if (String(S.state && S.state.status) !== 'running') return;
    if (!amIParticipant()) return;

    S.redirecting = true;
    location.href = buildRunUrl();
  }

  async function leaveRoom(andGoHub=true){
    if (!S.refs || !S.uid) {
      if (andGoHub) location.href = ctx.hub;
      return;
    }

    try { await S.refs.players.child(S.uid).remove(); } catch(_) {}
    cleanupSubs();

    if (andGoHub) location.href = ctx.hub;
  }

  async function onCopyRoom(){
    const ok = await copyText(ctx.roomId);
    setCopyState(ok ? `คัดลอก Room แล้ว: ${ctx.roomId}` : 'คัดลอก Room ไม่สำเร็จ', !ok);
  }

  async function onCopyInvite(){
    const ok = await copyText(buildInviteUrl(ctx.roomId));
    setCopyState(ok ? 'คัดลอก Invite Link แล้ว' : 'คัดลอก Invite Link ไม่สำเร็จ', !ok);
  }

  function renderAll(){
    renderRoomInfo();
    renderPlayers();
    renderButtons();
    renderHint();
    renderCountdown();
  }

  function bindUI(){
    UI.btnCopyRoom && UI.btnCopyRoom.addEventListener('click', onCopyRoom);
    UI.btnCopyInvite && UI.btnCopyInvite.addEventListener('click', onCopyInvite);
    UI.btnReady && UI.btnReady.addEventListener('click', toggleReady);
    UI.btnStart && UI.btnStart.addEventListener('click', startCoop);
    UI.btnBack && UI.btnBack.addEventListener('click', () => leaveRoom(true));
    UI.btnSpectate && UI.btnSpectate.addEventListener('click', () => {
      setHint('รอบนี้คุณไม่ได้อยู่ใน participant ของทีมนี้');
    });

    W.addEventListener('beforeunload', () => {
      if (S.redirecting) return;
      try {
        S.refs && S.uid && S.refs.players.child(S.uid).remove();
      } catch(_) {}
    });

    D.addEventListener('visibilitychange', () => {
      if (D.visibilityState === 'visible' && S.joined) {
        S.refs.players.child(S.uid).update({
          connected: true,
          updatedAt: Date.now(),
          lastSeen: Date.now()
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
      attachRefs();

      setHint('กำลังสร้าง/เชื่อมห้อง...');
      await ensureRoomExists();
      subscribeRoom();
      await joinRoom();
      startHeartbeat();

      setCopyState('ส่ง room code หรือลิงก์นี้ให้ผู้เล่นคนอื่นเข้าร่วมได้', false);
      setHint('เข้าห้องสำเร็จแล้ว');
      renderAll();
    } catch (err) {
      console.error('[goodjunk-coop-lobby] boot failed:', err);
      setHint(`เข้าห้องไม่สำเร็จ: ${err && err.message ? err.message : err}`);
      setCopyState('ตรวจ firebase auth / rules / path coopRooms แล้วลองใหม่', true);
      showGuard('permission denied หรือ firebase ยังไม่พร้อม');
    }
  }

  boot();
})();