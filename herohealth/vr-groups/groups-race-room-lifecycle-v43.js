// === /herohealth/vr-groups/groups-race-room-lifecycle-v43.js ===
// HeroHealth • Groups Race Room Lifecycle Cleanup
// PATCH v20260519-GROUPS-RACE-ROOM-LIFECYCLE-V43
//
// Fix:
// - ผู้เล่นออกแล้วค้างใน Waiting Room / Leaderboard
// - connected=false ไม่ถูกตั้งเมื่อปิด tab
// - playerCount เพี้ยนจาก record เก่า
// - ห้องเก่า/ผู้เล่นเก่าไม่ถูกทำความสะอาด
// - รองรับ Lobby / Run / Race Game ด้วยไฟล์เดียว
//
// Path:
// hha-battle/groups/raceRooms/{roomId}

(function () {
  'use strict';

  const VERSION = 'v20260519-groups-race-room-lifecycle-v43';
  const ROOM_ROOT = 'hha-battle/groups/raceRooms';

  if (window.__HHA_GROUPS_RACE_ROOM_LIFECYCLE_V43__) return;
  window.__HHA_GROUPS_RACE_ROOM_LIFECYCLE_V43__ = true;

  const STALE_MS = 45 * 1000;
  const CLEANUP_MS = 12 * 1000;
  const HEARTBEAT_MS = 5000;

  const state = {
    roomId: '',
    name: '',
    playerKey: '',
    uid: '',
    page: detectPage(),
    fb: null,
    db: null,
    auth: null,
    roomRef: null,
    playerRef: null,
    heartbeatTimer: 0,
    cleanupTimer: 0,
    active: false,
    local: false
  };

  function qs(name, fallback = '') {
    try {
      return new URL(location.href).searchParams.get(name) || fallback;
    } catch (_) {
      return fallback;
    }
  }

  function now() {
    return Date.now();
  }

  function cleanRoom(v) {
    return String(v || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 16);
  }

  function cleanName(v, fallback = 'Hero') {
    const s = String(v || '')
      .replace(/[^\wก-๙ _-]/g, '')
      .trim()
      .slice(0, 24);

    return s || fallback;
  }

  function playerKeyFromName(name) {
    return String(name || 'Hero')
      .trim()
      .toLowerCase()
      .replace(/[^\wก-๙]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'hero';
  }

  function detectPage() {
    const path = location.pathname;

    if (path.includes('groups-race-lobby')) return 'groups-race-lobby';
    if (path.includes('groups-race-run')) return 'groups-race-run';
    if (path.includes('groups-race')) return 'groups-race';

    return 'groups-race-unknown';
  }

  function getRoomId() {
    return cleanRoom(qs('roomId') || qs('room') || '');
  }

  function getName() {
    return cleanName(
      qs('name') ||
      qs('nick') ||
      localStorage.getItem('HHA_GROUPS_RACE_LAST_NAME') ||
      'Hero'
    );
  }

  function isLocalTest(roomId) {
    return roomId === 'LOCAL' && qs('local') === '1';
  }

  async function waitFirebase(timeoutMs = 8000) {
    if (window.HHA_FIREBASE?.ready && window.HHA_FIREBASE.db) {
      return window.HHA_FIREBASE;
    }

    if (window.firebase?.apps?.length && window.firebase.database) {
      return {
        ready: true,
        auth: window.firebase.auth ? window.firebase.auth() : null,
        db: window.firebase.database()
      };
    }

    return new Promise((resolve) => {
      let done = false;

      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        resolve(null);
      }, timeoutMs);

      function cleanup() {
        clearTimeout(timer);
        window.removeEventListener('hha:firebase-ready', onReady);
        window.removeEventListener('hha:firebase-error', onError);
      }

      function onReady() {
        if (done) return;
        done = true;
        cleanup();
        resolve(window.HHA_FIREBASE);
      }

      function onError() {
        if (done) return;
        done = true;
        cleanup();
        resolve(null);
      }

      window.addEventListener('hha:firebase-ready', onReady, { once: true });
      window.addEventListener('hha:firebase-error', onError, { once: true });

      if (window.HHA_FIREBASE?.ready && window.HHA_FIREBASE.db) {
        onReady();
      }
    });
  }

  async function connect() {
    const roomId = getRoomId();

    if (!roomId) return false;
    if (isLocalTest(roomId)) {
      state.local = true;
      return false;
    }

    state.roomId = roomId;
    state.name = getName();
    state.playerKey = playerKeyFromName(state.name);

    const fb = await waitFirebase();

    if (!fb || !fb.db) {
      console.warn('[Groups Race Lifecycle v43] Firebase not ready');
      return false;
    }

    state.fb = fb;
    state.db = fb.db;
    state.auth = fb.auth || (window.firebase?.auth ? window.firebase.auth() : null);

    try {
      if (state.auth && !state.auth.currentUser && typeof state.auth.signInAnonymously === 'function') {
        await state.auth.signInAnonymously();
      }
    } catch (err) {
      console.warn('[Groups Race Lifecycle v43] anonymous auth failed', err);
    }

    state.uid =
      state.auth?.currentUser?.uid ||
      window.HHA_FIREBASE?.uid ||
      `local-${Math.random().toString(36).slice(2, 10)}`;

    state.roomRef = state.db.ref(`${ROOM_ROOT}/${state.roomId}`);
    state.playerRef = state.roomRef.child(`players/${state.playerKey}`);

    return true;
  }

  function pageStatePayload(extra = {}) {
    const inLobby = state.page === 'groups-race-lobby';
    const inRun = state.page === 'groups-race-run';
    const inGame = state.page === 'groups-race';

    return {
      uid: state.uid,
      playerKey: state.playerKey,
      name: state.name,
      connected: true,
      visible: document.visibilityState !== 'hidden',
      inLobby,
      inRun,
      inGame,
      page: state.page,
      lastSeenAt: now(),
      updatedAt: now(),
      ...extra
    };
  }

  async function markOnline(extra = {}) {
    if (!state.playerRef) return;

    try {
      await state.playerRef.update(pageStatePayload(extra));
      state.active = true;
    } catch (err) {
      console.warn('[Groups Race Lifecycle v43] markOnline failed', err);
    }
  }

  async function markOffline(reason = 'leave') {
    if (!state.playerRef || !state.active) return;

    try {
      await state.playerRef.update({
        connected: false,
        visible: false,
        page: `${state.page}:${reason}`,
        lastSeenAt: now(),
        updatedAt: now()
      });
    } catch (_) {}
  }

  async function setupOnDisconnect() {
    if (!state.playerRef) return;

    try {
      state.playerRef.child('connected').onDisconnect().set(false);
      state.playerRef.child('visible').onDisconnect().set(false);
      state.playerRef.child('page').onDisconnect().set(`${state.page}:disconnect`);
      state.playerRef.child('lastSeenAt').onDisconnect().set(now());
      state.playerRef.child('updatedAt').onDisconnect().set(now());
    } catch (err) {
      console.warn('[Groups Race Lifecycle v43] onDisconnect failed', err);
    }
  }

  function getFreshPlayers(playersObj) {
    const t = now();

    return Object.entries(playersObj || {})
      .filter(([key, p]) => {
        if (!p) return false;

        const updatedAt = Number(p.updatedAt || p.lastSeenAt || 0);
        const isFresh = t - updatedAt <= STALE_MS;
        const isConnected = p.connected !== false;

        return isFresh && isConnected;
      })
      .map(([key, p]) => ({
        key,
        ...p
      }));
  }

  function getAllStalePlayerUpdates(playersObj) {
    const t = now();
    const updates = {};

    Object.entries(playersObj || {}).forEach(([key, p]) => {
      if (!p) return;

      const updatedAt = Number(p.updatedAt || p.lastSeenAt || 0);
      const isVeryOld = updatedAt && t - updatedAt > STALE_MS;

      if (isVeryOld && p.connected !== false) {
        updates[`players/${key}/connected`] = false;
        updates[`players/${key}/visible`] = false;
        updates[`players/${key}/page`] = 'stale-auto-offline';
        updates[`players/${key}/updatedAt`] = now();
      }
    });

    return updates;
  }

  async function cleanupRoom() {
    if (!state.roomRef) return;

    try {
      const snap = await state.roomRef.once('value');
      const room = snap.val() || {};
      const players = room.players || {};

      const freshPlayers = getFreshPlayers(players);
      const staleUpdates = getAllStalePlayerUpdates(players);

      const updates = {
        activePlayerCount: freshPlayers.length,
        playerCount: freshPlayers.length,
        updatedAt: now()
      };

      Object.assign(updates, staleUpdates);

      /*
        ถ้าห้อง waiting/race lobby แต่เหลือคนเดียวหรือไม่มีคน
        ให้คงสถานะ waiting ไว้ ไม่ start เอง
      */
      if ((room.status === 'started' || room.state === 'running') && !room.startAt) {
        updates.status = 'waiting';
        updates.state = 'lobby';
      }

      /*
        ถ้าไม่มีผู้เล่น active ในห้อง waiting ให้ใส่สถานะ idle
        แต่ไม่ลบห้องทันที เพื่อกัน user กลับมา refresh
      */
      if (freshPlayers.length === 0 && (room.status === 'waiting' || room.state === 'lobby')) {
        updates.status = 'idle';
        updates.state = 'idle';
      }

      await state.roomRef.update(updates);
    } catch (err) {
      console.warn('[Groups Race Lifecycle v43] cleanupRoom failed', err);
    }
  }

  function startHeartbeat() {
    clearInterval(state.heartbeatTimer);

    state.heartbeatTimer = setInterval(() => {
      markOnline();
    }, HEARTBEAT_MS);
  }

  function startCleanup() {
    clearInterval(state.cleanupTimer);

    state.cleanupTimer = setInterval(() => {
      cleanupRoom();
    }, CLEANUP_MS);
  }

  function bindVisibility() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (state.playerRef) {
          state.playerRef.update({
            visible: false,
            lastSeenAt: now(),
            updatedAt: now()
          }).catch(() => {});
        }
      } else {
        markOnline();
      }
    });
  }

  function bindUnload() {
    window.addEventListener('pagehide', () => {
      markOffline('pagehide');
    });

    window.addEventListener('beforeunload', () => {
      markOffline('beforeunload');
    });
  }

  function injectDebugBadge() {
    if (document.getElementById('raceLifecycleBadgeV43')) return;

    const badge = document.createElement('div');
    badge.id = 'raceLifecycleBadgeV43';
    badge.textContent = 'Room Sync v43';
    badge.style.cssText = `
      position:fixed;
      right:8px;
      bottom:8px;
      z-index:999999;
      padding:6px 9px;
      border-radius:999px;
      background:rgba(6,16,52,.72);
      border:1px solid rgba(132,168,255,.22);
      color:#c8d7ff;
      font:900 10px/1 system-ui,sans-serif;
      pointer-events:none;
      opacity:.72;
    `;

    document.body.appendChild(badge);
  }

  async function init() {
    const ok = await connect();

    if (!ok) {
      window.HHA_GROUPS_RACE_ROOM_LIFECYCLE = {
        version: VERSION,
        active: false,
        local: state.local,
        reason: state.local ? 'LOCAL test' : 'no room/firebase'
      };
      return;
    }

    await setupOnDisconnect();

    await markOnline({
      lifecycleVersion: VERSION
    });

    await cleanupRoom();

    startHeartbeat();
    startCleanup();
    bindVisibility();
    bindUnload();
    injectDebugBadge();

    window.HHA_GROUPS_RACE_ROOM_LIFECYCLE = {
      version: VERSION,
      active: true,
      getState() {
        return {
          version: VERSION,
          roomId: state.roomId,
          name: state.name,
          playerKey: state.playerKey,
          uid: state.uid,
          page: state.page,
          active: state.active
        };
      },
      markOnline,
      markOffline,
      cleanupRoom
    };

    console.info('[Groups Race Lifecycle] installed', VERSION, {
      roomId: state.roomId,
      playerKey: state.playerKey,
      page: state.page
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
