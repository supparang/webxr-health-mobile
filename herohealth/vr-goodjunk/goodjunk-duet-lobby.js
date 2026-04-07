'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk-duet-lobby.js
 * GoodJunk Duet Lobby
 * FULL PATCH v20260407-gjduet-lobby-debug-full
 * - uses /herohealth/room-engine.js
 * - uses /herohealth/herohealth-logger.js
 * - adds full debug for create/join/ready/start
 * - prevents stale room restore unless autojoin=1
 * ========================================================= */
(function () {
  const W = window;
  const D = document;

  if (W.__GJ_DUET_LOBBY_PATCHED__) return;
  W.__GJ_DUET_LOBBY_PATCHED__ = true;

  const MODE_ID = 'duet';
  const RUN_FILE = './goodjunk-duet-play.html';
  const LOBBY_FILE = './goodjunk-duet-lobby.html';
  const STORE_KEY = 'GJ_DUET_LOBBY_ENGINE_V2';
  const COUNTDOWN_MS = 3500;
  const ROOM_RENDER_TICK_MS = 1200;
  const HUB = qs('hub', '../hub.html');

  const UI = {
    btnBack: byId('btnBack'),

    roomCode: byId('roomCode'),
    playerCount: byId('playerCount'),
    roomStatus: byId('roomStatus'),
    hostName: byId('hostName'),

    btnCopyRoom: byId('btnCopyRoom'),
    btnCopyInvite: byId('btnCopyInvite'),

    copyState: byId('copyState'),
    joinGuard: byId('joinGuard'),

    roomInput: byId('roomInput'),
    btnJoinByCode: byId('btnJoinByCode'),
    btnUseCurrentRoom: byId('btnUseCurrentRoom'),
    btnNewRoom: byId('btnNewRoom'),

    inviteLink: byId('inviteLink'),
    hint: byId('hint'),

    btnReady: byId('btnReady'),
    btnUnready: byId('btnUnready'),
    btnStart: byId('btnStart'),

    playersBox: byId('playersBox'),
    qrBox: byId('qrBox'),
    countdown: byId('countdown')
  };

  const S = {
    uid: '',
    logger: null,
    roomId: cleanRoom(qs('roomId', qs('room', ''))),
    joined: false,
    redirecting: false,
    room: null,
    unwatchRoom: null,
    renderTick: 0
  };

  function qs(key, fallback = '') {
    try {
      const v = new URL(location.href).searchParams.get(key);
      return v == null || v === '' ? fallback : v;
    } catch {
      return fallback;
    }
  }

  function byId(id) {
    return D.getElementById(id);
  }

  function num(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, num(v, a)));
  }

  function now() {
    return Date.now();
  }

  function clean(v, max = 32) {
    return String(v == null ? '' : v)
      .replace(/[^a-zA-Z0-9ก-๙ _-]/g, '')
      .trim()
      .slice(0, max);
  }

  function cleanRoom(v, max = 24) {
    return String(v == null ? '' : v)
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, max);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getNick() {
    return clean(qs('name', qs('nick', qs('nickName', 'Player'))), 24) || 'Player';
  }

  function getPid() {
    return clean(qs('pid', 'anon'), 40) || 'anon';
  }

  function getDiff() {
    return clean(qs('diff', 'normal'), 24) || 'normal';
  }

  function getTime() {
    return clamp(qs('time', '90'), 30, 300);
  }

  function getView() {
    return clean(qs('view', 'mobile'), 24) || 'mobile';
  }

  function getSeed() {
    return clean(qs('seed', String(Date.now())), 80) || String(Date.now());
  }

  function roomMeta() {
    return (S.room && S.room.meta) ? S.room.meta : {};
  }

  function roomPlayers() {
    return (S.room && S.room.players) ? S.room.players : {};
  }

  function roomResults() {
    return (S.room && S.room.results) ? S.room.results : {};
  }

  function activePlayers() {
    return Object.values(roomPlayers() || {}).sort((a, b) => num(a.joinedAt, 0) - num(b.joinedAt, 0));
  }

  function readyPlayers() {
    return activePlayers().filter((p) => !!p.ready);
  }

  function selfPlayer() {
    return roomPlayers()[S.uid] || null;
  }

  function isHost() {
    return !!S.uid && roomMeta().hostUid === S.uid;
  }

  function getCtx() {
    return {
      pid: getPid(),
      uid: S.uid || '',
      display_name: getNick(),
      name: getNick(),
      game: 'goodjunk',
      zone: 'nutrition',
      mode: MODE_ID,
      diff: getDiff(),
      time_sec: getTime(),
      seed: getSeed(),
      view: getView(),
      run: qs('run', 'play'),
      hub: HUB,
      room_id: S.roomId || '',
      match_id: roomMeta().matchId || '',
      role: isHost() ? 'host' : 'player',
      app_version: 'v20260407-gjduet-lobby-debug-full'
    };
  }

  function setStateText(msg) {
    if (UI.copyState) UI.copyState.textContent = String(msg || '');
  }

  function setHint(msg) {
    if (UI.hint) UI.hint.textContent = String(msg || '');
  }

  function setGuard(msg) {
    if (!UI.joinGuard) return;
    if (msg) {
      UI.joinGuard.style.display = 'block';
      UI.joinGuard.textContent = String(msg);
    } else {
      UI.joinGuard.style.display = 'none';
      UI.joinGuard.textContent = '';
    }
  }

  function persistLocal() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        roomId: S.roomId || '',
        ts: Date.now()
      }));
    } catch (_) {}
  }

  function clearLocalRoom() {
    try {
      localStorage.removeItem(STORE_KEY);
    } catch (_) {}
  }

  function restoreLocalRoom() {
    const hasQueryRoom = !!cleanRoom(qs('roomId', qs('room', '')));
    const autojoin = qs('autojoin', '') === '1';

    if (S.roomId || hasQueryRoom || !autojoin) return;

    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && data.roomId) {
        S.roomId = cleanRoom(data.roomId);
      }
    } catch (_) {}
  }

  function buildLobbyUrl(roomId) {
    const url = new URL(LOBBY_FILE, location.href);
    const src = new URL(location.href);

    src.searchParams.forEach((value, key) => {
      if (key === 'roomId' || key === 'room' || key === 'autojoin') return;
      url.searchParams.set(key, value);
    });

    url.searchParams.set('mode', MODE_ID);
    url.searchParams.set('roomId', roomId);
    url.searchParams.set('room', roomId);
    url.searchParams.set('diff', getDiff());
    url.searchParams.set('time', String(getTime()));
    url.searchParams.set('view', getView());
    url.searchParams.set('seed', getSeed());
    url.searchParams.set('hub', HUB);
    url.searchParams.set('autojoin', '1');
    return url.toString();
  }

  function buildRunUrl(roomId, matchId) {
    const meta = roomMeta();
    const url = new URL(RUN_FILE, location.href);
    const src = new URL(location.href);

    src.searchParams.forEach((value, key) => {
      if (['roomId', 'room', 'matchId', 'autojoin'].includes(key)) return;
      url.searchParams.set(key, value);
    });

    url.searchParams.set('mode', MODE_ID);
    url.searchParams.set('roomId', roomId);
    url.searchParams.set('room', roomId);
    url.searchParams.set('matchId', matchId || '');
    url.searchParams.set('pid', getPid());
    url.searchParams.set('name', getNick());
    url.searchParams.set('nick', getNick());
    url.searchParams.set('host', isHost() ? '1' : '0');
    url.searchParams.set('role', isHost() ? 'host' : 'player');
    url.searchParams.set('wait', '1');
    url.searchParams.set('autostart', '1');
    url.searchParams.set('diff', meta.diff || getDiff());
    url.searchParams.set('time', String(num(meta.timeSec, getTime())));
    url.searchParams.set('seed', String(meta.seed || getSeed()));
    url.searchParams.set('view', getView());
    url.searchParams.set('hub', HUB);

    if (num(meta.countdownAt, 0) > 0) {
      url.searchParams.set('startAt', String(meta.countdownAt));
    }

    return url.toString();
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(String(text || ''));
      return true;
    } catch {
      try {
        const ta = D.createElement('textarea');
        ta.value = String(text || '');
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        D.body.appendChild(ta);
        ta.select();
        const ok = D.execCommand('copy');
        ta.remove();
        return !!ok;
      } catch {
        return false;
      }
    }
  }

  function renderQr() {
    if (!UI.qrBox) return;

    const roomId = S.roomId || cleanRoom((UI.roomInput && UI.roomInput.value) || '') || 'ROOM';
    const link = buildLobbyUrl(roomId);

    if (UI.inviteLink) UI.inviteLink.value = link;

    UI.qrBox.innerHTML = '';
    const img = new Image();
    img.alt = 'Duet Invite QR';
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=' + encodeURIComponent(link);
    UI.qrBox.appendChild(img);
  }

  function renderPlayers() {
    const box = UI.playersBox;
    if (!box) return;

    const players = activePlayers();
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
      const isMe = p.uid === S.uid;
      const host = p.uid === roomMeta().hostUid;
      const ready = !!p.ready;

      return `
        <div class="player ${isMe ? 'me' : ''}">
          <div style="display:grid;gap:6px;">
            <div style="font-size:15px;font-weight:1000;">
              ${host ? '👑 ' : '👯 '}
              ${escapeHtml(p.name || p.pid || 'Player')}
              ${isMe ? ' • YOU' : ''}
            </div>
            <div style="font-size:12px;color:#c7d2fe;font-weight:900;">
              ${host ? 'host' : 'guest'} • online
            </div>
          </div>
          <div class="${ready ? 'ready' : 'waiting'}">${ready ? 'READY' : 'WAITING'}</div>
        </div>
      `;
    }).join('');
  }

  function renderCountdown() {
    if (!UI.countdown) return;

    const meta = roomMeta();
    if (!S.joined || meta.state !== 'countdown' || !num(meta.countdownAt, 0)) {
      UI.countdown.textContent = '';
      return;
    }

    const leftMs = num(meta.countdownAt, 0) - now();
    const sec = Math.max(0, Math.ceil(leftMs / 1000));
    UI.countdown.textContent = sec > 0 ? String(sec) : 'GO!';
  }

  function renderState() {
    const meta = roomMeta();
    const players = activePlayers();
    const ready = readyPlayers();
    const status = String(meta.state || 'waiting');

    if (UI.roomInput && !UI.roomInput.matches(':focus')) {
      UI.roomInput.value = S.roomId || '';
    }

    if (UI.roomCode) UI.roomCode.textContent = `ROOM: ${S.roomId || '-'}`;
    if (UI.playerCount) UI.playerCount.textContent = `${players.length}/2`;
    if (UI.roomStatus) UI.roomStatus.textContent = status;

    const hostPlayer = players.find((p) => p.uid === meta.hostUid) || null;
    if (UI.hostName) UI.hostName.textContent = hostPlayer ? (hostPlayer.name || hostPlayer.pid || '-') : '-';

    const self = selfPlayer();

    if (UI.btnReady) {
      UI.btnReady.disabled = !S.joined || !self || !['lobby', 'waiting', 'ended'].includes(status);
      UI.btnReady.textContent = self && self.ready ? 'ยกเลิกพร้อม' : 'พร้อม';
    }

    if (UI.btnUnready) {
      UI.btnUnready.disabled = !S.joined || !self || !['lobby', 'waiting', 'ended'].includes(status);
    }

    if (UI.btnStart) {
      UI.btnStart.disabled = !(S.joined && isHost() && players.length >= 2 && ready.length >= 2 && ['lobby', 'waiting', 'ended'].includes(status));
    }

    if (!S.joined) {
      setHint('ต้องมีผู้เล่นพร้อมครบ 2 คนก่อนเริ่ม Duet');
    } else if (status === 'countdown') {
      setHint('กำลังนับถอยหลัง ทั้งสองฝั่งจะเข้าเล่นพร้อมกัน');
    } else if (status === 'running') {
      setHint('กำลังพาเข้าเกม');
    } else {
      setHint(`ตอนนี้ ready ${ready.length}/2 • ต้องพร้อมครบทั้ง 2 คนก่อนเริ่ม`);
    }

    renderPlayers();
    renderQr();
    renderCountdown();
  }

  function unbindRoomWatch() {
    if (typeof S.unwatchRoom === 'function') {
      try { S.unwatchRoom(); } catch (_) {}
    }
    S.unwatchRoom = null;
  }

  function stopRenderTick() {
    if (S.renderTick) clearInterval(S.renderTick);
    S.renderTick = 0;
  }

  function startRenderTick() {
    stopRenderTick();
    S.renderTick = setInterval(renderState, ROOM_RENDER_TICK_MS);
  }

  function resetRoomState() {
    unbindRoomWatch();
    stopRenderTick();
    S.joined = false;
    S.room = null;
    S.redirecting = false;
  }

  async function initInfra() {
    if (!W.HHA_ROOM) throw new Error('Missing /herohealth/room-engine.js');
    if (!W.HeroHealthLogger) throw new Error('Missing /herohealth/herohealth-logger.js');

    const out = await W.HHA_ROOM.init(W.HHA_FIREBASE_CONFIG || W.FIREBASE_CONFIG);
    S.uid = out && out.uid ? out.uid : '';

    const endpoint = String(W.HHA_APPS_SCRIPT_URL || '').trim();
    const secret = String(W.HHA_INGEST_SECRET || '').trim();

    if (endpoint) {
      S.logger = new W.HeroHealthLogger({
        endpoint,
        secret,
        base: getCtx()
      });

      try {
        await S.logger.dryRun();
      } catch (err) {
        console.warn('[duet-lobby] dryRun failed:', err && err.message ? err.message : err);
      }
    } else {
      S.logger = null;
      console.warn('[duet-lobby] Apps Script endpoint missing -> logger disabled');
    }
  }

  function syncLoggerBase() {
    if (!S.logger) return;
    S.logger.setBase(getCtx());
  }

  function bindRoom(roomId) {
    unbindRoomWatch();

    S.unwatchRoom = W.HHA_ROOM.watchRoom({
      game: 'goodjunk',
      mode: MODE_ID,
      roomId,
      onValue: (room) => {
        S.room = room || null;
        S.joined = !!room;
        syncLoggerBase();

        console.log('[duet-lobby] room update', {
          roomId,
          meta: room && room.meta ? room.meta : null,
          players: room && room.players ? room.players : null,
          results: room && room.results ? room.results : null
        });

        renderState();

        const meta = roomMeta();
        if (meta.state === 'running' && meta.matchId && !S.redirecting) {
          goRun(roomId, meta.matchId);
        }
      }
    });

    startRenderTick();
  }

  async function createRoom() {
    try {
      resetRoomState();
      syncLoggerBase();

      const room = await W.HHA_ROOM.createRoom({
        game: 'goodjunk',
        zone: 'nutrition',
        mode: MODE_ID,
        pid: getPid(),
        name: getNick(),
        diff: getDiff(),
        timeSec: getTime(),
        seed: getSeed(),
        capacity: 2,
        teamMode: true,
        logger: S.logger
      });

      console.log('[duet-lobby] createRoom ok', room);

      S.roomId = room.roomId;
      persistLocal();
      syncLoggerBase();
      bindRoom(room.roomId);

      setGuard('');
      setStateText('สร้างห้องสำเร็จ');
      setHint('ส่ง room code หรือ invite link ให้เพื่อนอีกคนเข้าห้อง');
      renderState();
    } catch (err) {
      console.error('[duet-lobby] createRoom failed', err);
      setGuard('สร้างห้องไม่สำเร็จ: ' + (err && err.message ? err.message : err));
      setStateText('สร้างห้องไม่สำเร็จ');

      try {
        if (S.logger) {
          await S.logger.error(err, { stage: 'createRoom', room_id: S.roomId || '' });
        }
      } catch (_) {}
    }
  }

  async function joinRoom() {
    try {
      resetRoomState();

      S.roomId = cleanRoom((UI.roomInput && UI.roomInput.value) || S.roomId || '');
      if (!S.roomId) {
        setGuard('ยังไม่มี room code');
        setStateText('ยังไม่ได้เข้าห้อง');
        if (UI.roomInput) UI.roomInput.focus();
        return;
      }

      syncLoggerBase();

      const room = await W.HHA_ROOM.joinRoom({
        game: 'goodjunk',
        mode: MODE_ID,
        roomId: S.roomId,
        pid: getPid(),
        name: getNick(),
        logger: S.logger
      });

      console.log('[duet-lobby] joinRoom ok', room);

      S.roomId = room.roomId;
      persistLocal();
      syncLoggerBase();
      bindRoom(S.roomId);

      setGuard('');
      setStateText('เข้าห้องสำเร็จ');
      setHint('รอให้พร้อมครบ 2 คนแล้วค่อยเริ่ม');
      renderState();
    } catch (err) {
      console.error('[duet-lobby] joinRoom failed', err);

      const msg = err && err.message ? err.message : String(err);
      S.joined = false;
      S.room = null;

      if (/Room not found/i.test(msg)) {
        setGuard('ไม่พบห้องนี้ กรุณาตรวจ room code ให้ตรงกับเครื่องที่สร้างห้อง');
      } else {
        setGuard('เข้าห้องไม่สำเร็จ: ' + msg);
      }

      setStateText('เข้าห้องไม่สำเร็จ');
      renderState();

      try {
        if (S.logger) {
          await S.logger.error(err, { stage: 'joinRoom', room_id: S.roomId || '' });
        }
      } catch (_) {}
    }
  }

  async function leaveRoom() {
    if (!S.joined || !S.roomId) return;

    try {
      await W.HHA_ROOM.leaveRoom({
        game: 'goodjunk',
        mode: MODE_ID,
        roomId: S.roomId,
        pid: getPid(),
        name: getNick(),
        logger: S.logger
      });
    } catch (err) {
      console.error('[duet-lobby] leaveRoom failed', err);
    }

    resetRoomState();
    clearLocalRoom();
    renderState();
    setStateText('ออกจากห้องแล้ว');
    setHint('สร้างห้องใหม่หรือใส่ code เพื่อเข้าห้องอื่นได้เลย');
  }

  async function setReadyFlag(flag) {
    if (!S.joined || !S.roomId) return;

    const status = String(roomMeta().state || 'waiting');
    if (!['lobby', 'waiting', 'ended'].includes(status)) {
      setStateText('ตอนนี้เปลี่ยนสถานะพร้อมไม่ได้แล้ว');
      return;
    }

    try {
      await W.HHA_ROOM.setReady({
        game: 'goodjunk',
        mode: MODE_ID,
        roomId: S.roomId,
        ready: !!flag,
        pid: getPid(),
        logger: S.logger
      });

      console.log('[duet-lobby] setReady ok', {
        roomId: S.roomId,
        ready: !!flag,
        uid: S.uid
      });

      setGuard('');
      setHint(flag ? 'คุณพร้อมแล้ว รออีกฝั่งพร้อมครบ' : 'คุณยกเลิกสถานะพร้อมแล้ว');
    } catch (err) {
      console.error('[duet-lobby] setReady failed', err);

      try {
        if (S.logger) {
          await S.logger.error(err, { stage: 'setReadyFlag', room_id: S.roomId || '' });
        }
      } catch (_) {}
    }
  }

  async function startGame() {
    if (!S.joined || !S.roomId) {
      setGuard('ยังไม่ได้เข้าห้อง');
      setStateText('ยังไม่สามารถเริ่มได้');
      return;
    }

    if (!isHost()) {
      setGuard('เฉพาะ host เท่านั้นที่กดเริ่ม Duet ได้');
      setStateText('รอ host เริ่มเกม');
      return;
    }

    const players = activePlayers();
    const ready = readyPlayers();
    const meta = roomMeta();

    console.log('[duet-lobby] startGame click', {
      roomId: S.roomId,
      uid: S.uid,
      isHost: isHost(),
      players,
      ready,
      meta
    });

    if (players.length < 2) {
      setGuard('Duet ต้องมีผู้เล่น 2 คนก่อน');
      setStateText('ยังเริ่มไม่ได้');
      return;
    }

    if (ready.length < 2) {
      setGuard('Duet ต้องพร้อมครบทั้ง 2 คนก่อน');
      setStateText('ยังเริ่มไม่ได้');
      return;
    }

    try {
      setGuard('');
      setStateText('กำลังนับถอยหลัง');
      setHint('ทั้งสองฝั่งจะเข้าเล่นพร้อมกัน');

      const out = await W.HHA_ROOM.startMatch({
        game: 'goodjunk',
        mode: MODE_ID,
        roomId: S.roomId,
        countdownMs: COUNTDOWN_MS,
        logger: S.logger
      });

      console.log('[duet-lobby] startMatch ok', out);

      if (out && out.matchId) {
        setStateText('เริ่ม Duet สำเร็จ กำลังพาเข้าเกม');
      } else {
        setStateText('ส่งคำสั่งเริ่มเกมแล้ว');
      }
    } catch (err) {
      console.error('[duet-lobby] startGame failed (full)', err);

      const msg = err && err.message ? err.message : String(err);
      setGuard('เริ่ม Duet ไม่สำเร็จ: ' + msg);
      setStateText('เริ่ม Duet ไม่สำเร็จ');

      alert('start duet failed: ' + msg);

      try {
        if (S.logger) {
          await S.logger.error(err, {
            stage: 'startGame',
            room_id: S.roomId || '',
            players: players.length,
            ready: ready.length,
            meta
          });
        }
      } catch (_) {}
    }
  }

  function goRun(roomId, matchId) {
    if (S.redirecting) return;
    S.redirecting = true;

    const url = buildRunUrl(roomId, matchId);
    console.log('[duet-lobby] goRun', url);
    location.href = url;
  }

  async function copyRoomCode() {
    const ok = await copyText(S.roomId || '');
    setStateText(ok ? 'คัดลอก Room Code แล้ว' : 'คัดลอก Room Code ไม่สำเร็จ');
  }

  async function copyInviteLink() {
    const targetRoom = S.roomId || cleanRoom((UI.roomInput && UI.roomInput.value) || '');
    const ok = await copyText(buildLobbyUrl(targetRoom));
    setStateText(ok ? 'คัดลอก Invite Link แล้ว' : 'คัดลอก Invite Link ไม่สำเร็จ');
  }

  function bind() {
    if (UI.btnBack) {
      UI.btnBack.addEventListener('click', async (ev) => {
        ev.preventDefault();
        await leaveRoom();
        location.href = HUB;
      });
    }

    if (UI.btnCopyRoom) UI.btnCopyRoom.addEventListener('click', copyRoomCode);
    if (UI.btnCopyInvite) UI.btnCopyInvite.addEventListener('click', copyInviteLink);

    if (UI.btnNewRoom) {
      UI.btnNewRoom.addEventListener('click', createRoom);
    }

    if (UI.btnUseCurrentRoom) {
      UI.btnUseCurrentRoom.addEventListener('click', () => {
        if (UI.roomInput) UI.roomInput.value = S.roomId || '';
        renderState();
      });
    }

    if (UI.btnJoinByCode) {
      UI.btnJoinByCode.addEventListener('click', joinRoom);
    }

    if (UI.roomInput) {
      UI.roomInput.addEventListener('input', () => {
        const v = cleanRoom(UI.roomInput.value || '');
        UI.roomInput.value = v;
        S.roomId = v;
        persistLocal();
        renderState();
      });

      UI.roomInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          joinRoom();
        }
      });
    }

    if (UI.btnReady) {
      UI.btnReady.addEventListener('click', async () => {
        const self = selfPlayer();
        await setReadyFlag(!(self && self.ready));
      });
    }

    if (UI.btnUnready) {
      UI.btnUnready.addEventListener('click', () => setReadyFlag(false));
    }

    if (UI.btnStart) {
      UI.btnStart.addEventListener('click', startGame);
    }

    W.addEventListener('beforeunload', () => {
      try {
        if (S.logger) S.logger.flush('lobby_beforeunload');
      } catch (_) {}
    });
  }

  async function autoJoinIfNeeded() {
    const room = cleanRoom(qs('roomId', qs('room', '')));
    const autojoin = qs('autojoin', '') === '1';

    if (!room) return;

    S.roomId = room;
    if (UI.roomInput) UI.roomInput.value = room;

    persistLocal();
    renderState();

    if (autojoin) {
      await joinRoom();
    }
  }

  async function init() {
    try {
      restoreLocalRoom();
      bind();
      renderState();

      await initInfra();
      syncLoggerBase();

      setStateText('หน้า Duet พร้อมแล้ว');
      setHint('สร้างห้องใหม่หรือใส่ code เพื่อเข้าห้อง');

      await autoJoinIfNeeded();
    } catch (err) {
      console.error('[duet-lobby] init failed', err);
      setGuard('เริ่มหน้า Duet Lobby ไม่สำเร็จ: ' + (err && err.message ? err.message : err));
      setStateText('เปิดหน้าไม่สำเร็จ');

      try {
        if (S.logger) {
          await S.logger.error(err, { stage: 'init' });
        }
      } catch (_) {}
    }
  }

  init();
})();