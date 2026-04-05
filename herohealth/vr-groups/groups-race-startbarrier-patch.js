(() => {
  'use strict';

  const W = window;
  const D = document;
  const qs = new URLSearchParams(location.search);

  const isRace = qs.get('mode') === 'race' || qs.get('race') === '1';
  const roomCode = cleanRoom(qs.get('roomCode') || '');
  if (!isRace || !roomCode) return;

  const ROOT_PATH = 'hha-battle/groups/raceRooms';
  const ACTIVE_TTL_MS = 15000;
  const HOST_BARRIER_LEAD_MS = 2600;
  const FALLBACK_BARRIER_MS = 2200;

  const $ = (s, r = D) => r.querySelector(s);
  const $$ = (s, r = D) => Array.from(r.querySelectorAll(s));
  const now = () => Date.now();
  const num = (v, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };

  const state = {
    db: null,
    roomRef: null,
    room: null,
    roomListener: null,
    playerId: getPlayerId(),
    pid: cleanText(qs.get('pid') || 'anon', 48),
    playerName: cleanText(
      qs.get('name') ||
      qs.get('nickName') ||
      qs.get('nick') ||
      'Player',
      24
    ),
    isHost: qs.get('isHost') === '1',
    overlay: null,
    titleEl: null,
    subEl: null,
    countEl: null,
    playersEl: null,
    pulseEl: null,
    tickTimer: 0,
    interceptorsOn: false,
    released: false,
    playfield: null,
    lastBarrierAtSeen: 0
  };

  boot();

  async function boot() {
    try {
      injectStyles();
      createOverlay();
      state.playfield = findPlayfield();

      const fb = await ensureFirebaseCtx();
      state.db = fb.db;
      state.roomRef = state.db.ref(`${ROOT_PATH}/${roomCode}`);

      attachRoom();
      bindBlockers();
      await markReadyLoading();
      startTicker();
    } catch (err) {
      console.warn('[Groups Race StartBarrier] boot failed:', safeErr(err));
      // ถ้า Firebase มาไม่ครบ อย่าค้างผู้เล่นไว้
      forceRelease('เชื่อมต่อห้องไม่สำเร็จ เริ่มเล่นต่อได้');
    }
  }

  async function ensureFirebaseCtx() {
    if (W.HHA_FIREBASE && W.HHA_FIREBASE.ready && W.HHA_FIREBASE.db) {
      return W.HHA_FIREBASE;
    }

    if (W.HHA_FIREBASE_READY && typeof W.HHA_FIREBASE_READY.then === 'function') {
      const ctx = await W.HHA_FIREBASE_READY;
      if (ctx && ctx.db) return ctx;
    }

    if (!W.firebase) throw new Error('Firebase SDK not loaded');

    const cfg =
      W.HHA_FIREBASE_CONFIG ||
      W.HEROHEALTH_FIREBASE_CONFIG ||
      W.FIREBASE_CONFIG ||
      W.__firebaseConfig;

    if (!cfg || !cfg.apiKey || !cfg.projectId || !cfg.databaseURL) {
      throw new Error('Missing Firebase config');
    }

    let app;
    try {
      app = (firebase.apps && firebase.apps.length)
        ? firebase.app()
        : firebase.initializeApp(cfg);
    } catch (err) {
      if (firebase.apps && firebase.apps.length) app = firebase.app();
      else throw err;
    }

    const auth = firebase.auth ? firebase.auth() : null;
    const db = firebase.database ? firebase.database() : null;

    if (auth && !auth.currentUser && auth.signInAnonymously) {
      try { await auth.signInAnonymously(); } catch (_) {}
    }

    const ctx = { app, auth, db, config: cfg, ready: true };
    W.HHA_FIREBASE = ctx;
    return ctx;
  }

  function attachRoom() {
    if (!state.roomRef) return;

    state.roomListener = (snap) => {
      state.room = snap.val() || null;
      onRoomUpdate();
    };

    state.roomRef.on('value', state.roomListener);
  }

  async function onRoomUpdate() {
    const room = state.room;
    if (!room || state.released) return;

    renderPlayers(room);

    if (state.isHost) {
      await maybeHostSetBarrier(room);
    }

    const barrierAt = getBarrierAt(room);
    const activePlayers = getActivePlayers(room);
    const readyPlayers = activePlayers.filter((p) => p.readyToRun);

    if (!barrierAt) {
      setOverlayText(
        'รอ host ตั้งเวลาเริ่ม',
        `ผู้เล่นพร้อม ${readyPlayers.length}/${Math.max(activePlayers.length, 1)} คน`
      );
      return;
    }

    state.lastBarrierAtSeen = barrierAt;

    const ms = barrierAt - now();
    if (ms > 0) {
      const secs = Math.ceil(ms / 1000);
      const allReady = activePlayers.length >= 2 && readyPlayers.length >= activePlayers.length;

      setOverlayText(
        allReady ? 'ทุกคนพร้อมแล้ว' : 'กำลังรอผู้เล่นพร้อม',
        allReady
          ? `เริ่มพร้อมกันใน ${secs} วินาที`
          : `พร้อม ${readyPlayers.length}/${Math.max(activePlayers.length, 1)} คน • จะเริ่มใน ${secs} วินาที`
      );

      setCountdown(secs);
      return;
    }

    await markReleased();
    releaseOverlay();
  }

  async function maybeHostSetBarrier(room) {
    if (!state.roomRef || !state.isHost || state.released) return;
    if (!room || room.status !== 'started') return;

    const activePlayers = getActivePlayers(room);
    const readyPlayers = activePlayers.filter((p) => p.readyToRun);

    let barrierAt = getBarrierAt(room);

    if (!barrierAt) {
      const base = Math.max(
        num(room.startedAt, 0),
        now() + HOST_BARRIER_LEAD_MS
      );

      await state.roomRef.update({
        raceBarrierAt: base,
        updatedAt: now()
      });
      barrierAt = base;
    }

    // ถ้ามีคนยังไม่พร้อม และเหลือเวลาน้อยมาก ให้ host ขยายเวลาออกเล็กน้อย
    const msLeft = barrierAt - now();
    const allReady = activePlayers.length >= 2 && readyPlayers.length >= activePlayers.length;
    if (!allReady && msLeft < 1200) {
      const nextBarrier = now() + 1600;
      await state.roomRef.update({
        raceBarrierAt: nextBarrier,
        updatedAt: now()
      });
    }
  }

  async function markReadyLoading() {
    if (!state.roomRef) return;

    await state.roomRef.update({
      [`players/${state.playerId}/playerId`]: state.playerId,
      [`players/${state.playerId}/pid`]: state.pid,
      [`players/${state.playerId}/name`]: state.playerName,
      [`players/${state.playerId}/presence`]: 'loading-run',
      [`players/${state.playerId}/readyToRun`]: true,
      [`players/${state.playerId}/readyAt`]: now(),
      [`players/${state.playerId}/releasedAt`]: null,
      [`players/${state.playerId}/lastSeen`]: now(),
      updatedAt: now()
    });
  }

  async function markReleased() {
    if (!state.roomRef) return;

    await state.roomRef.update({
      [`players/${state.playerId}/presence`]: 'playing',
      [`players/${state.playerId}/releasedAt`]: now(),
      [`players/${state.playerId}/lastSeen`]: now(),
      updatedAt: now()
    });
  }

  function startTicker() {
    if (state.tickTimer) clearInterval(state.tickTimer);

    state.tickTimer = W.setInterval(async () => {
      if (state.released) return;

      try {
        if (state.roomRef) {
          await state.roomRef.update({
            [`players/${state.playerId}/lastSeen`]: now()
          });
        }
      } catch (_) {}

      const room = state.room;
      if (!room) {
        setOverlayText('กำลังเชื่อมห้องแข่ง...', 'รอสักครู่');
        setCountdown('');
        return;
      }

      renderPlayers(room);

      const barrierAt = getBarrierAt(room) || (now() + FALLBACK_BARRIER_MS);
      const ms = barrierAt - now();

      if (ms <= 0) {
        await markReleased();
        releaseOverlay();
        return;
      }

      const secs = Math.ceil(ms / 1000);
      setCountdown(secs);

      if (secs >= 3) state.pulseEl.textContent = 'เตรียมตัว';
      else if (secs === 2) state.pulseEl.textContent = 'พร้อม';
      else if (secs === 1) state.pulseEl.textContent = 'เริ่ม!';
    }, 150);
  }

  function createOverlay() {
    const overlay = D.createElement('div');
    overlay.className = 'hha-race-barrier is-on';
    overlay.innerHTML = `
      <div class="hha-race-barrier__card">
        <div class="hha-race-barrier__eyebrow">🏁 Groups Race</div>
        <div class="hha-race-barrier__title">กำลังเตรียมเริ่มแข่ง</div>
        <div class="hha-race-barrier__sub">รอผู้เล่นทุกเครื่องเข้าพร้อมกัน</div>
        <div class="hha-race-barrier__count">3</div>
        <div class="hha-race-barrier__pulse">เตรียมตัว</div>
        <div class="hha-race-barrier__players">กำลังเช็กผู้เล่น...</div>
      </div>
    `;

    D.body.appendChild(overlay);

    state.overlay = overlay;
    state.titleEl = $('.hha-race-barrier__title', overlay);
    state.subEl = $('.hha-race-barrier__sub', overlay);
    state.countEl = $('.hha-race-barrier__count', overlay);
    state.playersEl = $('.hha-race-barrier__players', overlay);
    state.pulseEl = $('.hha-race-barrier__pulse', overlay);
  }

  function setOverlayText(title, sub) {
    if (state.titleEl) state.titleEl.textContent = title || '';
    if (state.subEl) state.subEl.textContent = sub || '';
  }

  function setCountdown(v) {
    if (!state.countEl) return;
    if (v === '' || v == null) {
      state.countEl.textContent = '…';
      return;
    }
    state.countEl.textContent = String(v);
  }

  function renderPlayers(room) {
    if (!state.playersEl) return;

    const active = getActivePlayers(room);
    const ready = active.filter((p) => p.readyToRun);
    const labels = active.map((p) => {
      const mine = p.playerId === state.playerId ? ' (คุณ)' : '';
      const host = p.isHost ? ' • host' : '';
      const ok = p.readyToRun ? '✅' : '⏳';
      return `${ok} ${p.name}${mine}${host}`;
    });

    state.playersEl.innerHTML = `
      <div class="hha-race-barrier__players-top">
        พร้อม ${ready.length}/${Math.max(active.length, 1)} คน
      </div>
      <div class="hha-race-barrier__chips">
        ${labels.length
          ? labels.map((t) => `<span class="hha-race-barrier__chip">${escapeHtml(t)}</span>`).join('')
          : `<span class="hha-race-barrier__chip">กำลังรอผู้เล่น...</span>`}
      </div>
    `;
  }

  function getActivePlayers(room) {
    const map = room && room.players ? room.players : {};
    const t = now();

    return Object.keys(map).map((key) => {
      const p = map[key] || {};
      const lastSeen = num(p.lastSeen, 0);
      const active = p.presence !== 'left' && (t - lastSeen) <= ACTIVE_TTL_MS;

      return {
        playerId: String(p.playerId || key),
        name: cleanText(p.name || 'Player', 24),
        isHost: !!p.isHost || key === room.ownerPlayerId,
        active,
        readyToRun: !!p.readyToRun,
        presence: String(p.presence || '')
      };
    }).filter((p) => p.active);
  }

  function getBarrierAt(room) {
    if (!room) return 0;
    return Math.max(
      num(room.raceBarrierAt, 0),
      num(room.startedAt, 0)
    );
  }

  function releaseOverlay() {
    if (!state.overlay || state.released) return;
    state.released = true;

    state.overlay.classList.remove('is-on');
    state.overlay.classList.add('is-off');
    state.pulseEl.textContent = 'เริ่ม!';
    setCountdown('GO');

    unbindBlockers();

    W.setTimeout(() => {
      if (state.overlay) state.overlay.remove();
      state.overlay = null;
    },