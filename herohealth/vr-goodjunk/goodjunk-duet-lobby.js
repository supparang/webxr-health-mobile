'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk-duet-lobby.js
 * GoodJunk Duet Lobby
 * ENGINE UNIFIED PATCH v20260406-gjduet-lobby-engine-r1
 * Uses:
 *   - /herohealth/room-engine.js
 *   - /herohealth/herohealth-logger.js
 * ========================================================= */
(function () {
  const W = window;
  const D = document;

  const MODE_ID = 'duet';
  const RUN_FILE = './goodjunk-duet-play.html';
  const LOBBY_FILE = './goodjunk-duet-lobby.html';
  const STORE_KEY = 'GJ_DUET_LOBBY_ENGINE_V1';
  const COUNTDOWN_POLL_MS = 100;
  const COUNTDOWN_MS = 3500;
  const HEARTBEAT_UI_MS = 1500;
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
    countdownTick: 0,
    uiTick: 0
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

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
      app_version: 'v20260406-gjduet-lobby-engine-r1'
    };
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
    return Object.values(roomPlayers())
      .sort((a, b) => num(a.joinedAt, 0) - num(b.joinedAt, 0));
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

  function restoreLocalRoom() {
    if (S.roomId) return;
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && data.roomId) S.roomId = cleanRoom(data.roomId);
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
    clearInterval(S.countdownTick);
    S.countdownTick = 0;

    if (UI.countdown) UI.countdown.textContent = '';

    const meta = roomMeta();
    if (!S.joined || meta.state !== 'countdown') return;

    S.countdownTick = setInterval(() => {
      const leftMs = num(meta.countdownAt, 0) - now();
      const sec = Math.max(0, Math.ceil(leftMs / 1000));

      if (UI.countdown) UI.countdown.textContent = sec > 0 ? String(sec) : 'GO!';

      if (leftMs <= 0) {
        clearInterval(S.countdownTick);
        S.countdownTick = 0;
      }
    }, COUNTDOWN_POLL_MS);
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
      UI.btnStart.disabled = !(S.joined && isHost() && ready.length >= 2 && players.length >= 2 && ['lobby', 'waiting', 'ended'].includes(status));
    }

    if (!S.joined) {
      setStateText('สร้างห้องใหม่หรือใส่ code เพื่อเข้าห้อง');
      setHint('ต้องมีผู้เล่นพร้อมครบ 2 คนก่อนเริ่ม Duet');
      setGuard('');
    } else if (status === 'countdown') {
      setStateText('กำลังนับถอยหลัง');
      setHint('ทั้งสองฝั่งจะเข้าเล่นพร้อมกัน');
      setGuard('');
    } else if (status === 'running') {
      setStateText('กำลังพาเข้าสู่หน้าเล่นจริง');
      setHint('ถ้าไม่เด้งเอง ให้รอสักครู่');
      setGuard('');
    } else {
      setStateText('เข้าห้องสำเร็จ');
      setHint(`ตอนนี้ ready ${ready.length}/2 • ต้องพร้อมครบทั้ง 2 คนก่อนเริ่ม`);
      setGuard('');
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

  function resetRoomState() {
    unbindRoomWatch();
    clearInterval(S.countdownTick);
    clearInterval(S.uiTick);
    S.countdownTick = 0;
    S.uiTick = 0;
    S.joined = false;
    S.room = null;
  }

  async function initInfra() {
    if (!W.HHA_ROOM) throw new Error('Missing /herohealth/room-engine.js');
    if (!W.HeroHealthLogger) throw new Error('Missing /herohealth/herohealth-logger.js');

    const out = await W.HHA_ROOM.init(W.HHA_FIREBASE_CONFIG || W.FIREBASE_CONFIG);
    S.uid = out && out.uid ? out.uid : '';

    S.logger = new W.HeroHealthLogger({
      endpoint: W.HHA_APPS_SCRIPT_URL || '',
      secret: W.HHA_INGEST_SECRET || '',
      base: getCtx()
    });

    try {
      await S.logger.dryRun();
    } catch (_) {}
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
      onValue: async (room) => {
        S.room = room || null;
        S.joined = !!room;
        syncLoggerBase();
        renderState();

        const meta = roomMeta();
        if (meta.state === 'running' && meta.matchId && !S.redirecting) {
          goRun(roomId, meta.matchId);
        }
      }
    });

    S.uiTick = setInterval(renderState, HEARTBEAT_UI_MS);
  }

  async function createRoom() {
    try {
      S.redirecting = false;
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

      S.roomId = room.roomId;
      persistLocal();
      syncLoggerBase();
      bindRoom(room.roomId);
      renderState();

      setGuard('');
      setStateText('สร้างห้อง Duet สำเร็จ');
      setHint('ส่ง room code หรือ invite link ให้เพื่อนอีกคน');
    } catch (err) {
      console.error('[duet-lobby] createRoom failed', err);
      setGuard('สร้างห้องไม่สำเร็จ: ' + (err && err.message ? err.message : err));
      setStateText('สร้างห้องไม่สำเร็จ');
      try { await S.logger.error(err, { stage: 'createRoom', room_id: S.roomId || '' }); } catch (_) {}
    }
  }

  async function joinRoom() {
    try {
      S.redirecting = false;
      resetRoomState();

      S.roomId = cleanRoom((UI.roomInput && UI.roomInput.value) || S.roomId || '');
      if (!S.roomId) {
        setGuard('ยังไม่มี room code');
        if (UI.roomInput) UI.roomInput.focus();
        return;
      }

      syncLoggerBase();

      await W.HHA_ROOM.joinRoom({
        game: 'goodjunk',
        mode: MODE_ID,
        roomId: S.roomId,
        pid: getPid(),
        name: getNick(),
        logger: S.logger
      });

      persistLocal();
      syncLoggerBase();
      bindRoom(S.roomId);
      renderState();

      setGuard('');
      setStateText('เข้าห้อง Duet สำเร็จ');
      setHint('รอให้พร้อมครบ 2 คนแล้วค่อยเริ่ม');
    } catch (err) {
      console.error('[duet-lobby] joinRoom failed', err);
      setGuard('เข้าห้องไม่สำเร็จ: ' + (err && err.message ? err.message : err));
      setStateText('เข้าห้องไม่สำเร็จ');
      try { await S.logger.error(err, { stage: 'joinRoom', room_id: S.roomId || '' }); } catch (_) {}
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

      setGuard('');
      setHint(flag ? 'คุณพร้อมแล้ว รออีกฝั่งพร้อมครบ' : 'คุณยกเลิกสถานะพร้อมแล้ว');
    } catch (err) {
      console.error('[duet-lobby] setReadyFlag failed', err);
      try { await S.logger.error(err, { stage: 'setReadyFlag', room_id: S.roomId || '' }); } catch (_) {}
    }
  }

  async function startGame() {
    if (!S.joined || !S.roomId || !isHost()) return;

    const players = activePlayers();
    if (players.length < 2) {
      setGuard('Duet ต้องมีผู้เล่น 2 คนก่อน');
      return;
    }

    const ready = readyPlayers();
    if (ready.length < 2) {
      setGuard('Duet ต้องพร้อมครบทั้ง 2 คนก่อน');
      return;
    }

    try {
      setGuard('');
      setStateText('กำลังนับถอยหลัง');
      setHint('ทั้งสองฝั่งจะเข้าเล่นพร้อมกัน');

      await W.HHA_ROOM.startMatch({
        game: 'goodjunk',
        mode: MODE_ID,
        roomId: S.roomId,
        countdownMs: COUNTDOWN_MS,
        logger: S.logger
      });
    } catch (err) {
      console.error('[duet-lobby] startGame failed', err);
      setGuard('เริ่ม Duet ไม่สำเร็จ: ' + (err && err.message ? err.message : err));
      try { await S.logger.error(err, { stage: 'startGame', room_id: S.roomId || '' }); } catch (_) {}
    }
  }

  function goRun(roomId, matchId) {
    if (S.redirecting) return;
    S.redirecting = true;
    location.href = buildRunUrl(roomId, matchId);
  }

  async function copyRoomCode() {
    const ok = await copyText(S.roomId || '');
    setStateText(ok ? 'คัดลอก Room Code แล้ว' : 'คัดลอก Room Code ไม่สำเร็จ');
  }

  async function copyInviteLink() {
    const ok = await copyText(buildLobbyUrl(S.roomId || cleanRoom((UI.roomInput && UI.roomInput.value) || '')));
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
      if (S.redirecting) return;
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
        if (S.logger) await S.logger.error(err, { stage: 'init' });
      } catch (_) {}
    }
  }

  init();
})();