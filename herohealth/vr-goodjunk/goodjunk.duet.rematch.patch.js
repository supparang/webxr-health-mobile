/* /herohealth/vr-goodjunk/goodjunk.duet.rematch.patch.js
   FULL PATCH v20260329-GOODJUNK-DUET-REMATCH-SIDECAR
   ใช้เป็น sidecar patch แก้ rematch ค้าง โดยไม่ต้องแก้ core เยอะ
*/
(function () {
  'use strict';

  if (window.__GJ_DUET_REMATCH_SIDECAR_V20260329__) return;
  window.__GJ_DUET_REMATCH_SIDECAR_V20260329__ = true;

  const W = window;
  const D = document;
  const Q = new URLSearchParams(location.search);

  const PATCH = 'v20260329-GOODJUNK-DUET-REMATCH-SIDECAR';

  const local = {
    room: null,
    roomRef: null,
    submitted: false,
    requestInFlight: false,
    countdownToken: '',
    countdownTimer: 0,
    starting: false,
    boundBtn: false,
    didClearAfterRematchLoad: false,
    firebaseReady: false,
    roomBound: false
  };

  function qs(name) {
    return String(Q.get(name) || '').trim();
  }

  function myPid() {
    return String(
      qs('pid') ||
      qs('playerId') ||
      'anon'
    ).trim();
  }

  function roomId() {
    return String(
      qs('roomId') ||
      qs('room') ||
      ''
    ).trim();
  }

  function roomPath() {
    const rid = roomId();
    if (!rid) throw new Error('ไม่พบ roomId');
    return '/hha-battle/goodjunk/rooms/' + rid;
  }

  function roomRef() {
    if (local.roomRef) return local.roomRef;
    if (!W.firebase || !firebase.database) throw new Error('Firebase database ยังไม่พร้อม');
    local.roomRef = firebase.database().ref(roomPath());
    return local.roomRef;
  }

  function byId(id) {
    return D.getElementById(id);
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

  function leaderPid(room) {
    const pids = activePlayerIds(room).sort();
    const host =
      (room && (room.hostPid || room.ownerPid || (room.meta && room.meta.hostPid))) || '';
    return String(host || pids[0] || myPid());
  }

  function amLeader(room) {
    return myPid() === leaderPid(room);
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

  function setBtn(text, disabled, waiting) {
    const btn = byId('btnRematch');
    if (!btn) return;
    btn.textContent = text;
    btn.disabled = !!disabled;
    btn.classList.toggle('is-waiting', !!waiting);
  }

  function setChip(text) {
    const chip =
      byId('duetChipRematch') ||
      byId('chipRematch') ||
      byId('rematchChip');
    if (chip) chip.textContent = text;
  }

  function updateUiFromRematch(info, localSubmitted) {
    const ready = Number(info.ready || 0);
    const need = Number(info.need || 2);

    setChip('🔄 รีแมตช์ ' + ready + '/' + need);

    if (info.status === 'countdown') {
      setBtn('กำลังเริ่มรีแมตช์...', true, true);
      return;
    }

    if (ready >= need) {
      setBtn('กำลังจับคู่รีแมตช์...', true, true);
      return;
    }

    if (localSubmitted) {
      setBtn('กำลังรอรีแมตช์...', true, true);
      return;
    }

    setBtn('ขอรีแมตช์ (' + ready + '/' + need + ')', false, false);
  }

  async function clearRematchState(reason) {
    try {
      await roomRef().update({
        'rematch/status': 'idle',
        'rematch/token': '',
        'rematch/byPid': null,
        'rematch/countdownAt': 0,
        'rematch/updatedAt': Date.now(),
        'rematch/reason': String(reason || 'reset')
      });
    } catch (err) {
      console.warn('[DUET][REMATCH] clear failed', err);
    }

    if (local.countdownTimer) {
      clearTimeout(local.countdownTimer);
      local.countdownTimer = 0;
    }

    local.submitted = false;
    local.requestInFlight = false;
    local.countdownToken = '';
    local.starting = false;

    updateUiFromRematch({ ready: 0, need: 2, status: 'idle' }, false);
  }

  async function requestVote() {
    if (local.requestInFlight || local.submitted || local.starting) return;

    local.requestInFlight = true;

    try {
      const pid = myPid();

      await roomRef().child('rematch').transaction((curr) => {
        const next = curr && typeof curr === 'object' ? curr : {};
        const byPid = next.byPid && typeof next.byPid === 'object' ? next.byPid : {};

        if (!next.token) next.token = 'rm-' + Date.now();
        next.status = next.status === 'countdown' ? 'countdown' : 'collecting';
        byPid[pid] = Date.now();
        next.byPid = byPid;
        next.countdownAt = next.status === 'countdown' ? Number(next.countdownAt || 0) : 0;
        next.updatedAt = Date.now();

        return next;
      });

      local.submitted = true;
      applyRoom(local.room || {});
    } catch (err) {
      console.error('[DUET][REMATCH] request vote failed', err);
      local.submitted = false;
      updateUiFromRematch({ ready: 0, need: 2, status: 'idle' }, false);
    } finally {
      local.requestInFlight = false;
    }
  }

  async function maybePromote(room) {
    const info = normalizeRematch(room);

    if (info.ready < info.need) return;
    if (info.status === 'countdown') return;
    if (!amLeader(room)) return;

    try {
      await roomRef().child('rematch').transaction((curr) => {
        const next = curr && typeof curr === 'object' ? curr : {};
        const byPid = next.byPid && typeof next.byPid === 'object' ? next.byPid : {};
        const pids = activePlayerIds(local.room || room || {});
        const need = Math.max(2, pids.length || 2);
        const ready = pids.filter((pid) => !!byPid[pid]).length;

        if (ready < need) return curr || next;
        if (String(next.status || '') === 'countdown') return curr || next;

        next.status = 'countdown';
        next.countdownAt = Date.now() + 2400;
        next.updatedAt = Date.now();
        if (!next.token) next.token = 'rm-' + Date.now();

        return next;
      });
    } catch (err) {
      console.warn('[DUET][REMATCH] promote failed', err);
    }
  }

  function buildRematchUrl() {
    const u = new URL(location.href);
    u.searchParams.set('seed', String(Date.now()));
    u.searchParams.set('rematch', '1');
    return u.toString();
  }

  function startRematchNow() {
    if (local.starting) return;
    local.starting = true;

    setBtn('กำลังเริ่มรีแมตช์...', true, true);

    if (typeof W.startDuetRematchRound === 'function') {
      try {
        W.startDuetRematchRound();
        return;
      } catch (err) {
        console.warn('[DUET][REMATCH] startDuetRematchRound failed, fallback reload', err);
      }
    }

    location.href = buildRematchUrl();
  }

  function runCountdown(targetTs, token) {
    if (!token) return;
    if (local.countdownToken === token) return;

    if (local.countdownTimer) {
      clearTimeout(local.countdownTimer);
      local.countdownTimer = 0;
    }

    local.countdownToken = token;

    const tick = () => {
      const left = Math.max(0, targetTs - Date.now());
      const sec = Math.max(1, Math.ceil(left / 1000));

      setBtn('เริ่มใหม่ใน ' + sec + '...', true, true);

      if (left <= 0) {
        startRematchNow();
        return;
      }

      local.countdownTimer = W.setTimeout(tick, 180);
    };

    tick();
  }

  async function maybeClearAfterRematchLoad(room) {
    if (local.didClearAfterRematchLoad) return;
    if (qs('rematch') !== '1') return;
    if (!amLeader(room)) return;

    local.didClearAfterRematchLoad = true;

    try {
      await clearRematchState('rematch-load');
    } catch (err) {
      console.warn('[DUET][REMATCH] post-load clear failed', err);
    }
  }

  function applyRoom(room) {
    local.room = room || {};
    const info = normalizeRematch(local.room);
    const localSubmitted = !!info.byPid[myPid()];

    local.submitted = localSubmitted;
    updateUiFromRematch(info, localSubmitted);

    if (info.ready >= info.need && info.status !== 'countdown') {
      maybePromote(local.room);
    }

    if (info.status === 'countdown' && info.token) {
      runCountdown(info.countdownAt || (Date.now() + 2400), info.token);
    } else if (info.status === 'idle') {
      if (local.countdownTimer) {
        clearTimeout(local.countdownTimer);
        local.countdownTimer = 0;
      }
      local.countdownToken = '';
      local.starting = false;
    }

    maybeClearAfterRematchLoad(local.room);
  }

  function bindBtn() {
    const btn = byId('btnRematch');
    if (!btn || local.boundBtn) return;

    local.boundBtn = true;

    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (typeof ev.stopImmediatePropagation === 'function') {
        ev.stopImmediatePropagation();
      }
      requestVote();
    }, true);
  }

  function watchButton() {
    bindBtn();

    const mo = new MutationObserver(() => bindBtn());
    mo.observe(D.documentElement || D.body, {
      childList: true,
      subtree: true
    });
  }

  function bindRoomListener() {
    if (local.roomBound) return;
    local.roomBound = true;

    roomRef().on('value', (snap) => {
      const roomData = snap.val() || {};
      applyRoom(roomData);
    }, (err) => {
      console.error('[DUET][REMATCH] room listener error', err);
    });
  }

  function waitFirebaseAndStart() {
    let tries = 0;

    const tick = () => {
      tries += 1;

      const ok = !!(W.firebase && firebase.database);
      if (ok) {
        local.firebaseReady = true;
        bindRoomListener();
        watchButton();
        console.log('[DUET][REMATCH] sidcar ready • ' + PATCH);
        return;
      }

      if (tries < 120) {
        setTimeout(tick, 250);
      } else {
        console.warn('[DUET][REMATCH] firebase not ready, patch idle');
      }
    };

    tick();
  }

  W.clearRematchStatePatched = clearRematchState;
  W.requestRematchVotePatched = requestVote;
  W.applyRematchFromRoomPatched = applyRoom;

  waitFirebaseAndStart();
})();