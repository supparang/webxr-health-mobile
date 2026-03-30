/* /herohealth/vr-goodjunk/goodjunk.safe.duet.js
   FULL PATCH v20260329-GOODJUNK-DUET-REMATCH-HARDFIX
   วางก้อนนี้ลงในไฟล์ goodjunk.safe.duet.js
   แล้ว:
   1) เรียก bindRematchPatchedActions() หลัง bind ปุ่ม summary
   2) เรียก applyRematchFromRoomPatched(roomData) ใน room listener ทุกครั้ง
   3) เรียก clearRematchStatePatched('new-round') ตอนเริ่มรอบใหม่
*/

(function () {
  'use strict';

  if (window.__GJ_DUET_REMATCH_PATCH_V20260329__) return;
  window.__GJ_DUET_REMATCH_PATCH_V20260329__ = true;

  const W = window;
  const D = document;

  function qs(name) {
    try { return new URLSearchParams(location.search).get(name) || ''; }
    catch (_) { return ''; }
  }

  function getStateRef() {
    if (W.GJDuetState && typeof W.GJDuetState === 'object') return W.GJDuetState;
    if (W.__GJ_DUET_STATE__ && typeof W.__GJ_DUET_STATE__ === 'object') return W.__GJ_DUET_STATE__;
    if (W.state && typeof W.state === 'object') return W.state;
    W.__GJ_DUET_STATE__ = W.__GJ_DUET_STATE__ || {};
    return W.__GJ_DUET_STATE__;
  }

  const state = getStateRef();

  state.rematch = state.rematch || {
    submitted: false,
    requestInFlight: false,
    countdownToken: '',
    countdownTimer: 0,
    lastSeenToken: '',
    starting: false
  };

  function byId(id) {
    return D.getElementById(id);
  }

  function myPid() {
    return String(
      state.playerId ||
      state.pid ||
      qs('pid') ||
      'anon'
    ).trim();
  }

  function getRoomIdSafe() {
    return String(
      state.roomId ||
      state.currentRoomId ||
      (state.room && (state.room.roomId || state.room.id || state.room.code)) ||
      qs('roomId') ||
      qs('room') ||
      ''
    ).trim();
  }

  function getRoomPathSafe() {
    const roomId = getRoomIdSafe();
    if (!roomId) throw new Error('ไม่พบ roomId สำหรับ rematch');
    return '/hha-battle/goodjunk/rooms/' + roomId;
  }

  function getRoomRefSafe() {
    if (!W.firebase || !firebase.database) {
      throw new Error('Firebase database ยังไม่พร้อม');
    }
    return firebase.database().ref(getRoomPathSafe());
  }

  function activePlayerIds(room) {
    const players = room && room.players && typeof room.players === 'object'
      ? room.players
      : {};

    return Object.keys(players).filter((pid) => {
      const p = players[pid] || {};
      return p.left !== true && p.kicked !== true && p.disconnected !== true;
    });
  }

  function getLeaderPid(room) {
    const pids = activePlayerIds(room).sort();
    const host =
      (room && (room.hostPid || room.ownerPid || (room.meta && room.meta.hostPid))) || '';
    return String(host || pids[0] || myPid());
  }

  function isLeader(room) {
    return myPid() === getLeaderPid(room);
  }

  function normalizeRematch(room) {
    const src = room && room.rematch && typeof room.rematch === 'object'
      ? room.rematch
      : {};

    const byPid = src.byPid && typeof src.byPid === 'object' ? src.byPid : {};
    const pids = activePlayerIds(room);
    const need = Math.max(2, pids.length || 2);
    const readyPids = pids.filter((pid) => !!byPid[pid]);

    return {
      status: String(src.status || 'idle'),
      token: String(src.token || ''),
      byPid,
      need,
      ready: readyPids.length,
      countdownAt: Number(src.countdownAt || 0),
      updatedAt: Number(src.updatedAt || 0)
    };
  }

  function setRematchButtonText(text, disabled, waiting) {
    const btn = byId('btnRematch');
    if (!btn) return;

    btn.textContent = text;
    btn.disabled = !!disabled;
    btn.classList.toggle('is-waiting', !!waiting);
  }

  function updateRematchButtonPatched(rematchInfo, localSubmitted) {
    const info = rematchInfo || { ready: 0, need: 2, status: 'idle' };

    if (info.status === 'countdown') {
      setRematchButtonText('กำลังเริ่มรีแมตช์...', true, true);
      return;
    }

    if (info.ready >= info.need) {
      setRematchButtonText('กำลังจับคู่รีแมตช์...', true, true);
      return;
    }

    if (localSubmitted) {
      setRematchButtonText('กำลังรอรีแมตช์...', true, true);
      return;
    }

    setRematchButtonText('ขอรีแมตช์ (' + info.ready + '/' + info.need + ')', false, false);
  }

  async function clearRematchStatePatched(reason) {
    try {
      await getRoomRefSafe().update({
        'rematch/status': 'idle',
        'rematch/token': '',
        'rematch/byPid': null,
        'rematch/countdownAt': 0,
        'rematch/updatedAt': Date.now(),
        'rematch/reason': String(reason || 'reset')
      });
    } catch (err) {
      console.warn('[DUET] clearRematchStatePatched failed', err);
    }

    if (state.rematch.countdownTimer) {
      clearTimeout(state.rematch.countdownTimer);
      state.rematch.countdownTimer = 0;
    }

    state.rematch.submitted = false;
    state.rematch.requestInFlight = false;
    state.rematch.countdownToken = '';
    state.rematch.lastSeenToken = '';
    state.rematch.starting = false;

    updateRematchButtonPatched({ ready: 0, need: 2, status: 'idle' }, false);
  }

  async function requestRematchVotePatched() {
    if (state.rematch.requestInFlight || state.rematch.submitted || state.rematch.starting) return;

    state.rematch.requestInFlight = true;

    try {
      const room = state.room || {};
      const info = normalizeRematch(room);
      const pid = myPid();
      const token = info.token || ('rm-' + Date.now());

      await getRoomRefSafe().update({
        'rematch/status': 'collecting',
        'rematch/token': token,
        ['rematch/byPid/' + pid]: Date.now(),
        'rematch/countdownAt': 0,
        'rematch/updatedAt': Date.now()
      });

      state.rematch.submitted = true;
      updateRematchButtonPatched(info, true);
    } catch (err) {
      console.error('[DUET] requestRematchVotePatched failed', err);
      state.rematch.submitted = false;
      updateRematchButtonPatched({ ready: 0, need: 2, status: 'idle' }, false);
    } finally {
      state.rematch.requestInFlight = false;
    }
  }

  async function maybePromoteRematchPatched(room) {
    const info = normalizeRematch(room);

    if (info.ready < info.need) return;
    if (info.status === 'countdown') return;
    if (!isLeader(room)) return;

    try {
      await getRoomRefSafe().update({
        'rematch/status': 'countdown',
        'rematch/countdownAt': Date.now() + 2400,
        'rematch/updatedAt': Date.now()
      });
    } catch (err) {
      console.warn('[DUET] maybePromoteRematchPatched failed', err);
    }
  }

  function buildRematchUrlPatched() {
    const u = new URL(location.href);
    u.searchParams.set('seed', String(Date.now()));
    u.searchParams.set('rematch', '1');
    return u.toString();
  }

  function startRematchNowPatched() {
    if (state.rematch.starting) return;
    state.rematch.starting = true;

    setRematchButtonText('กำลังเริ่มรีแมตช์...', true, true);

    if (typeof W.startDuetRematchRound === 'function') {
      W.startDuetRematchRound();
      return;
    }

    location.href = buildRematchUrlPatched();
  }

  function runRematchCountdownPatched(targetTs, token) {
    if (!token) return;
    if (state.rematch.countdownToken === token) return;

    if (state.rematch.countdownTimer) {
      clearTimeout(state.rematch.countdownTimer);
      state.rematch.countdownTimer = 0;
    }

    state.rematch.countdownToken = token;

    const tick = () => {
      const left = Math.max(0, targetTs - Date.now());
      const sec = Math.max(1, Math.ceil(left / 1000));

      setRematchButtonText('เริ่มใหม่ใน ' + sec + '...', true, true);

      if (left <= 0) {
        startRematchNowPatched();
        return;
      }

      state.rematch.countdownTimer = W.setTimeout(tick, 180);
    };

    tick();
  }

  function applyRematchFromRoomPatched(room) {
    state.room = room || state.room || {};

    const info = normalizeRematch(room);
    const localSubmitted = !!info.byPid[myPid()];

    state.rematch.submitted = localSubmitted;

    if (info.token && state.rematch.lastSeenToken !== info.token) {
      state.rematch.lastSeenToken = info.token;
      state.rematch.starting = false;
    }

    updateRematchButtonPatched(info, localSubmitted);

    if (info.ready >= info.need && info.status !== 'countdown') {
      maybePromoteRematchPatched(room);
    }

    if (info.status === 'countdown' && info.token) {
      runRematchCountdownPatched(info.countdownAt || (Date.now() + 2400), info.token);
      return;
    }

    if (info.status === 'idle') {
      if (state.rematch.countdownTimer) {
        clearTimeout(state.rematch.countdownTimer);
        state.rematch.countdownTimer = 0;
      }
      state.rematch.countdownToken = '';
      state.rematch.starting = false;
    }
  }

  function bindRematchPatchedActions() {
    const btn = byId('btnRematch');
    if (!btn || btn.__gjRematchPatchedBound) return;

    btn.__gjRematchPatchedBound = true;
    btn.addEventListener('click', function () {
      requestRematchVotePatched();
    });
  }

  /* expose ให้ไฟล์เดิมเรียกใช้ */
  W.clearRematchStatePatched = clearRematchStatePatched;
  W.requestRematchVotePatched = requestRematchVotePatched;
  W.applyRematchFromRoomPatched = applyRematchFromRoomPatched;
  W.bindRematchPatchedActions = bindRematchPatchedActions;
  W.updateRematchButtonPatched = updateRematchButtonPatched;

  console.log('[DUET] rematch patch ready');
})();