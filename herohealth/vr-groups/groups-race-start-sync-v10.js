/* =========================================================
   HeroHealth • Groups Race Start Sync
   File: /herohealth/vr-groups/groups-race-start-sync-v10.js
   PATCH: v20260604-GROUPS-RACE-START-SYNC-V10

   Purpose:
   - Host กดเริ่มแข่งแล้วส่งสัญญาณ Start ผ่าน Firebase
   - Player 2/3/4 ฟังสัญญาณเดียวกัน แล้วเปลี่ยนจาก "รอ" -> เริ่มแข่ง
   - ใช้ path หลัก:
     herohealth/groups/raceRooms/{ROOM}/players/{PID}
   - พยายามเขียน room-level signal ด้วย ถ้า rules ไม่อนุญาตจะไม่พัง
   ========================================================= */

(function () {
  'use strict';

  const PATCH = 'v20260604-GROUPS-RACE-START-SYNC-V10';
  const BASE = 'herohealth/groups/raceRooms';

  if (window.__HHA_GROUPS_RACE_START_SYNC_V10__) return;
  window.__HHA_GROUPS_RACE_START_SYNC_V10__ = true;

  const qs = new URLSearchParams(location.search || '');

  let db = null;
  let roomCode = '';
  let playerName = '';
  let playerPid = '';
  let playersCache = {};
  let selfPlayerKey = '';
  let startHandled = false;
  let localForceClicking = false;

  function log() {
    try {
      console.log('[GroupsRaceStartSync]', ...arguments);
    } catch (_) {}
  }

  function warn() {
    try {
      console.warn('[GroupsRaceStartSync]', ...arguments);
    } catch (_) {}
  }

  function textOf(el) {
    return String((el && (el.innerText || el.textContent)) || '').trim();
  }

  function norm(v) {
    return String(v || '').trim();
  }

  function lower(v) {
    return norm(v).toLowerCase();
  }

  function now() {
    return Date.now();
  }

  function safeJson(v) {
    try {
      return JSON.stringify(v);
    } catch (_) {
      return String(v);
    }
  }

  function getFromLS(keys) {
    for (const k of keys) {
      try {
        const v = localStorage.getItem(k);
        if (v) return v;
      } catch (_) {}
    }
    return '';
  }

  function setLS(k, v) {
    try {
      localStorage.setItem(k, String(v));
    } catch (_) {}
  }

  function detectRoomCode() {
    const fromUrl =
      qs.get('room') ||
      qs.get('code') ||
      qs.get('roomCode') ||
      qs.get('raceRoom') ||
      qs.get('ROOM') ||
      '';

    if (fromUrl) return norm(fromUrl).toUpperCase();

    const fromLS = getFromLS([
      'HHA_GROUPS_RACE_ROOM',
      'HHA_GROUPS_RACE_ROOM_CODE',
      'HHA_RACE_ROOM',
      'groupsRaceRoom',
      'groupsRaceRoomCode'
    ]);

    if (fromLS) return norm(fromLS).toUpperCase();

    const bodyText = textOf(document.body);

    const roomLabelMatch =
      bodyText.match(/Room\s*Code\s*[:：]?\s*([A-Z0-9]{5,10})/i) ||
      bodyText.match(/รหัสห้อง\s*[:：]?\s*([A-Z0-9]{5,10})/i) ||
      bodyText.match(/เข้าห้องแล้ว\s*[:：]?\s*([A-Z0-9]{5,10})/i);

    if (roomLabelMatch && roomLabelMatch[1]) {
      return norm(roomLabelMatch[1]).toUpperCase();
    }

    const candidates = bodyText.match(/\b[A-Z0-9]{6}\b/g) || [];
    const filtered = candidates.filter(function (x) {
      return !/^\d+$/.test(x) && !/GROUPS|RACE|PLAYER|NORMAL|MOBILE|FIREBASE/i.test(x);
    });

    if (filtered[0]) return norm(filtered[0]).toUpperCase();

    return '';
  }

  function detectPlayerName() {
    const fromUrl =
      qs.get('name') ||
      qs.get('player') ||
      qs.get('playerName') ||
      qs.get('nickname') ||
      '';

    if (fromUrl) return norm(fromUrl);

    const fromLS = getFromLS([
      'HHA_PLAYER_NAME',
      'HHA_GROUPS_RACE_PLAYER_NAME',
      'groupsRacePlayerName'
    ]);

    if (fromLS) return norm(fromLS);

    const bodyText = textOf(document.body);
    const m =
      bodyText.match(/ผู้เล่น\s*[:：]?\s*([A-Za-z0-9ก-ฮะ-์ _.-]{2,30})/i) ||
      bodyText.match(/Player\s*[:：]?\s*([A-Za-z0-9ก-ฮะ-์ _.-]{2,30})/i);

    if (m && m[1]) return norm(m[1]);

    return 'Hero';
  }

  function detectPidFromUrlOrLS() {
    const fromUrl =
      qs.get('pid') ||
      qs.get('playerId') ||
      qs.get('playerPid') ||
      qs.get('uid') ||
      '';

    if (fromUrl) return norm(fromUrl);

    const fromLS = getFromLS([
      'HHA_GROUPS_RACE_PID',
      'HHA_PLAYER_PID',
      'groupsRacePid'
    ]);

    if (fromLS) return norm(fromLS);

    return '';
  }

  function isFirebaseReady() {
    return (
      typeof window.firebase !== 'undefined' &&
      window.firebase &&
      typeof window.firebase.database === 'function'
    );
  }

  function ensureDb() {
    if (db) return true;

    if (!isFirebaseReady()) {
      warn('Firebase database() ยังไม่พร้อม');
      return false;
    }

    try {
      db = window.firebase.database();
      return !!db;
    } catch (e) {
      warn('เปิด Firebase DB ไม่ได้', e);
      return false;
    }
  }

  function roomPath(child) {
    if (!roomCode) return '';
    return BASE + '/' + roomCode + (child ? '/' + child : '');
  }

  function updatePath(path, data) {
    if (!ensureDb() || !path) return Promise.resolve(false);

    try {
      return db.ref(path).update(data)
        .then(function () {
          log('updated', path, data);
          return true;
        })
        .catch(function (err) {
          warn('update failed:', path, err && err.message ? err.message : err);
          return false;
        });
    } catch (e) {
      warn('update exception:', path, e);
      return Promise.resolve(false);
    }
  }

  function getVal(path) {
    if (!ensureDb() || !path) return Promise.resolve(null);

    try {
      return db.ref(path).once('value')
        .then(function (snap) {
          return snap.val();
        })
        .catch(function (err) {
          warn('read failed:', path, err && err.message ? err.message : err);
          return null;
        });
    } catch (e) {
      warn('read exception:', path, e);
      return Promise.resolve(null);
    }
  }

  function isHostLikePlayer(v) {
    if (!v || typeof v !== 'object') return false;

    return (
      v.isHost === true ||
      v.host === true ||
      lower(v.role) === 'host' ||
      lower(v.type) === 'host' ||
      lower(v.label).includes('host')
    );
  }

  function playerNameOf(v) {
    if (!v || typeof v !== 'object') return '';

    return norm(
      v.name ||
      v.playerName ||
      v.nickname ||
      v.displayName ||
      v.label ||
      ''
    );
  }

  function playerPidOf(v, key) {
    if (!v || typeof v !== 'object') return key || '';

    return norm(
      v.pid ||
      v.playerId ||
      v.uid ||
      v.id ||
      key ||
      ''
    );
  }

  function detectSelfKey(players) {
    players = players || playersCache || {};

    if (!players || typeof players !== 'object') return '';

    const keys = Object.keys(players);

    if (playerPid && players[playerPid]) return playerPid;

    for (const k of keys) {
      const p = players[k] || {};
      const pid = playerPidOf(p, k);

      if (playerPid && pid === playerPid) return k;
    }

    const myName = lower(playerName);

    if (myName) {
      for (const k of keys) {
        const p = players[k] || {};
        if (lower(playerNameOf(p)) === myName) {
          return k;
        }
      }
    }

    const body = lower(textOf(document.body));
    const looksHostOnThisPage = body.includes('host') || body.includes('คุณ');

    if (looksHostOnThisPage) {
      for (const k of keys) {
        if (isHostLikePlayer(players[k])) return k;
      }
    }

    return '';
  }

  function hasStartSignal(v) {
    if (!v || typeof v !== 'object') return false;

    const phase = lower(v.phase);
    const status = lower(v.status);
    const signal = lower(v.signal || v.raceSignal || v.action);

    return (
      v.raceStarted === true ||
      v.start === true ||
      v.started === true ||
      !!v.startSeq ||
      !!v.startedAt ||
      !!v.raceStartAt ||
      !!v.hostStartAt ||
      phase === 'start' ||
      phase === 'starting' ||
      phase === 'countdown' ||
      phase === 'running' ||
      status === 'start' ||
      status === 'starting' ||
      status === 'countdown' ||
      status === 'running' ||
      signal === 'start' ||
      signal === 'race-start' ||
      signal === 'running'
    );
  }

  function buildSignal(reason) {
    const t = now();

    return {
      room: roomCode,
      phase: 'countdown',
      status: 'running',
      signal: 'race-start',
      raceSignal: 'race-start',
      raceStarted: true,
      start: true,
      started: true,
      startSeq: t,
      startedAt: t,
      raceStartAt: t,
      hostStartAt: t,
      hostPid: selfPlayerKey || playerPid || '',
      hostName: playerName || '',
      reason: reason || 'host-click',
      patch: PATCH
    };
  }

  function writeStartSignal(reason) {
    if (!roomCode) {
      roomCode = detectRoomCode();
    }

    if (!roomCode) {
      warn('ยังหา Room Code ไม่เจอ จึงส่ง start signal ไม่ได้');
      return Promise.resolve(false);
    }

    if (!ensureDb()) return Promise.resolve(false);

    selfPlayerKey = selfPlayerKey || detectSelfKey(playersCache);

    const signal = buildSignal(reason);

    setLS('HHA_GROUPS_RACE_LAST_START_ROOM', roomCode);
    setLS('HHA_GROUPS_RACE_LAST_START_SIGNAL', safeJson(signal));

    const jobs = [];

    /*
      เขียนหลายตำแหน่งแบบ safe:
      - ถ้า Firebase Rules อนุญาต room-level จะใช้ raceState/state ได้
      - ถ้า Rules อนุญาตเฉพาะ players/{PID} ก็ยังมี host player node เป็น fallback
    */
    jobs.push(updatePath(roomPath('raceState'), signal));
    jobs.push(updatePath(roomPath('state'), signal));
    jobs.push(updatePath(roomPath('meta'), {
      phase: 'countdown',
      status: 'running',
      startSeq: signal.startSeq,
      startedAt: signal.startedAt,
      hostPid: signal.hostPid,
      hostName: signal.hostName,
      patch: PATCH
    }));

    if (selfPlayerKey) {
      jobs.push(updatePath(roomPath('players/' + selfPlayerKey), {
        phase: 'countdown',
        status: 'running',
        signal: 'race-start',
        raceSignal: 'race-start',
        raceStarted: true,
        start: true,
        started: true,
        startSeq: signal.startSeq,
        startedAt: signal.startedAt,
        raceStartAt: signal.raceStartAt,
        hostStartAt: signal.hostStartAt,
        patch: PATCH
      }));
    } else {
      jobs.push(
        getVal(roomPath('players')).then(function (players) {
          const k = detectSelfKey(players || {});
          if (!k) return false;

          selfPlayerKey = k;

          return updatePath(roomPath('players/' + selfPlayerKey), {
            phase: 'countdown',
            status: 'running',
            signal: 'race-start',
            raceSignal: 'race-start',
            raceStarted: true,
            start: true,
            started: true,
            startSeq: signal.startSeq,
            startedAt: signal.startedAt,
            raceStartAt: signal.raceStartAt,
            hostStartAt: signal.hostStartAt,
            patch: PATCH
          });
        })
      );
    }

    return Promise.all(jobs).then(function (results) {
      const ok = results.some(Boolean);
      log('writeStartSignal result:', ok, results);
      return ok;
    });
  }

  function injectStyle() {
    if (document.getElementById('hhaRaceStartSyncV10Style')) return;

    const style = document.createElement('style');
    style.id = 'hhaRaceStartSyncV10Style';
    style.textContent = `
      .hha-race-sync-toast-v10{
        position:fixed;
        left:50%;
        top:calc(16px + env(safe-area-inset-top,0px));
        transform:translateX(-50%);
        z-index:999999;
        max-width:min(92vw,560px);
        padding:12px 18px;
        border-radius:18px;
        color:#ffffff;
        background:rgba(15,23,42,.92);
        border:1px solid rgba(255,255,255,.22);
        box-shadow:0 16px 40px rgba(0,0,0,.34);
        font:900 16px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        text-align:center;
        pointer-events:none;
      }
      .hha-race-sync-pulse-v10{
        animation:hhaRaceSyncPulseV10 .55s ease-in-out infinite alternate;
      }
      @keyframes hhaRaceSyncPulseV10{
        from{transform:scale(.985)}
        to{transform:scale(1.025)}
      }
    `;
    document.head.appendChild(style);
  }

  function toast(msg, ms) {
    injectStyle();

    let el = document.getElementById('hhaRaceStartSyncV10Toast');

    if (!el) {
      el = document.createElement('div');
      el.id = 'hhaRaceStartSyncV10Toast';
      el.className = 'hha-race-sync-toast-v10';
      document.body.appendChild(el);
    }

    el.textContent = msg;

    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      try {
        el.remove();
      } catch (_) {}
    }, ms || 1800);
  }

  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const st = getComputedStyle(el);

    return (
      rect.width > 4 &&
      rect.height > 4 &&
      st.display !== 'none' &&
      st.visibility !== 'hidden' &&
      Number(st.opacity || 1) > 0.05
    );
  }

  function isStartText(t) {
    t = lower(t);

    if (!t) return false;

    if (
      t.includes('กลับ') ||
      t.includes('lobby') ||
      t.includes('โหมด') ||
      t.includes('hub') ||
      t.includes('nutrition') ||
      t.includes('zone')
    ) {
      return false;
    }

    return (
      t.includes('เริ่มแข่ง') ||
      t.includes('race start') ||
      t === 'start' ||
      t === 'go' ||
      t.includes('🚀')
    );
  }

  function tryCallKnownStartFunctions(signal) {
    const names = [
      'HHA_GROUPS_RACE_START',
      'HHA_GROUPS_RACE_FORCE_START',
      'startRace',
      'raceStart',
      'startRaceGame',
      'beginRace',
      'beginRaceGame',
      'startCountdown',
      'beginCountdown',
      'startGame',
      'beginGame',
      'launchRace'
    ];

    for (const name of names) {
      try {
        if (typeof window[name] === 'function') {
          log('call local start function:', name);
          window[name](signal);
          return true;
        }
      } catch (e) {
        warn('local start function failed:', name, e);
      }
    }

    return false;
  }

  function clickStartButtonOnThisDevice() {
    const els = Array.from(
      document.querySelectorAll(
        'button,a,[role="button"],.btn,.button,.start,.startBtn,#startBtn,#btnStart,#raceStart,#startRaceBtn'
      )
    );

    const target = els.find(function (el) {
      return isVisible(el) && isStartText(textOf(el));
    });

    if (!target) return false;

    try {
      localForceClicking = true;

      target.disabled = false;
      target.removeAttribute('disabled');
      target.setAttribute('aria-disabled', 'false');

      log('force click start button:', textOf(target));
      target.click();

      setTimeout(function () {
        localForceClicking = false;
      }, 1000);

      return true;
    } catch (e) {
      localForceClicking = false;
      warn('force click failed', e);
      return false;
    }
  }

  function updateWaitingVisualOnly() {
    /*
      fallback ด้านภาพ:
      ถ้า function/click ไม่เจอ อย่างน้อยให้รู้ว่าเครื่องนี้รับ start signal แล้ว
      รอบถัดไปถ้ายังไม่เข้า gameplay ต้องแก้ใน function start ภายในไฟล์ run
    */
    try {
      const all = Array.from(document.querySelectorAll('body *')).filter(isVisible);

      all.forEach(function (el) {
        const t = lower(textOf(el));
        if (t === 'รอ' || t === 'wait' || t.includes('รอเพื่อน')) {
          el.textContent = 'GO';
          el.classList.add('hha-race-sync-pulse-v10');
        }
      });
    } catch (_) {}
  }

  function handleStartSignal(signal, source) {
    if (startHandled) return;
    if (!hasStartSignal(signal)) return;

    startHandled = true;

    const seq =
      signal.startSeq ||
      signal.startedAt ||
      signal.raceStartAt ||
      signal.hostStartAt ||
      now();

    setLS('HHA_GROUPS_RACE_FORCE_START_' + roomCode, seq);
    setLS('HHA_GROUPS_RACE_FORCE_START_SIGNAL_' + roomCode, safeJson(signal));

    log('START SIGNAL RECEIVED from', source, signal);

    toast('🚀 Race Start • เริ่มแข่งพร้อมกัน', 1600);

    try {
      window.dispatchEvent(new CustomEvent('hha:groups-race-start-sync', {
        detail: {
          signal: signal,
          source: source,
          patch: PATCH
        }
      }));

      document.dispatchEvent(new CustomEvent('hha:groups-race-start-sync', {
        detail: {
          signal: signal,
          source: source,
          patch: PATCH
        }
      }));
    } catch (_) {}

    setTimeout(function () {
      const called = tryCallKnownStartFunctions(signal);

      if (called) return;

      const clicked = clickStartButtonOnThisDevice();

      if (clicked) return;

      updateWaitingVisualOnly();
      toast('ได้รับสัญญาณเริ่มแล้ว แต่ยังไม่เจอ start function ในไฟล์นี้', 2600);
    }, 260);
  }

  function inspectPlayersForStart(players) {
    if (!players || typeof players !== 'object') return;

    const keys = Object.keys(players);

    for (const k of keys) {
      const p = players[k];

      if (hasStartSignal(p)) {
        handleStartSignal(
          Object.assign({}, p, {
            _sourcePlayerKey: k
          }),
          'players/' + k
        );
        return;
      }
    }
  }

  function attachListeners() {
    if (!ensureDb() || !roomCode) return;

    const playersRef = db.ref(roomPath('players'));

    playersRef.on('value', function (snap) {
      const players = snap.val() || {};
      playersCache = players;

      selfPlayerKey = selfPlayerKey || detectSelfKey(playersCache);

      log('players update', {
        room: roomCode,
        selfPlayerKey: selfPlayerKey,
        players: playersCache
      });

      inspectPlayersForStart(playersCache);
    }, function (err) {
      warn('players listener failed', err && err.message ? err.message : err);
    });

    const paths = [
      roomPath('raceState'),
      roomPath('state'),
      roomPath('meta')
    ];

    paths.forEach(function (p) {
      try {
        db.ref(p).on('value', function (snap) {
          const v = snap.val();
          if (v) {
            log('room signal update', p, v);
            handleStartSignal(v, p);
          }
        }, function (err) {
          warn('listener failed:', p, err && err.message ? err.message : err);
        });
      } catch (e) {
        warn('listener exception:', p, e);
      }
    });
  }

  function interceptStartButtons() {
    document.addEventListener('click', function (ev) {
      if (localForceClicking) return;

      const target = ev.target && ev.target.closest
        ? ev.target.closest('button,a,[role="button"],.btn,.button,.start,.startBtn,#startBtn,#btnStart,#raceStart,#startRaceBtn')
        : null;

      if (!target) return;
      if (!isVisible(target)) return;

      const txt = textOf(target);

      if (!isStartText(txt)) return;

      /*
        capture phase:
        เขียน start signal ก่อนที่ code เดิมจะพา Host เข้า GO
      */
      log('start button intercepted:', txt);
      writeStartSignal('start-button-click');
    }, true);
  }

  function boot() {
    roomCode = detectRoomCode();
    playerName = detectPlayerName();
    playerPid = detectPidFromUrlOrLS();

    if (roomCode) {
      setLS('HHA_GROUPS_RACE_ROOM_CODE', roomCode);
      setLS('HHA_GROUPS_RACE_ROOM', roomCode);
    }

    if (playerName) {
      setLS('HHA_GROUPS_RACE_PLAYER_NAME', playerName);
    }

    if (playerPid) {
      setLS('HHA_GROUPS_RACE_PID', playerPid);
    }

    log('boot', {
      patch: PATCH,
      roomCode: roomCode,
      playerName: playerName,
      playerPid: playerPid,
      href: location.href
    });

    injectStyle();
    interceptStartButtons();

    let tries = 0;
    const timer = setInterval(function () {
      tries += 1;

      if (!roomCode) roomCode = detectRoomCode();

      if (roomCode && ensureDb()) {
        clearInterval(timer);
        attachListeners();
        toast('Firebase Race Sync พร้อมแล้ว', 1200);
      }

      if (tries >= 40) {
        clearInterval(timer);
        if (!roomCode) warn('ยังหา Room Code ไม่เจอหลังรอแล้ว');
        if (!ensureDb()) warn('Firebase database ยังไม่พร้อมหลังรอแล้ว');
      }
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();