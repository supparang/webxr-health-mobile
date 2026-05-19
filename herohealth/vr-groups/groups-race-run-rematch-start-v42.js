// === /herohealth/vr-groups/groups-race-run-rematch-start-v42.js ===
// HeroHealth • Groups Race Run Rematch Start Repair
// PATCH v20260519-GROUPS-RACE-RUN-REMATCH-START-V42
//
// Fix:
// - กลับห้องรอจาก "เล่นอีกครั้ง" แล้วไม่มีปุ่ม Start
// - inject #btnStartRace ถ้า HTML ไม่มี
// - bind ปุ่มใหม่กับ HHA_GROUPS_RACE_RUN.startRaceNow()
// - rematch=1: คนที่กดกลับห้องรอจะถูกตั้งเป็น rematch host เพื่อเริ่มรอบใหม่ได้
// - ยังล็อก Race จริงให้ต้องมีผู้เล่นอย่างน้อย 2 คน

(function () {
  'use strict';

  const VERSION = 'v20260519-groups-race-run-rematch-start-v42';
  const ROOM_ROOT = 'hha-battle/groups/raceRooms';

  if (window.__HHA_GROUPS_RACE_RUN_REMATCH_START_V42__) return;
  window.__HHA_GROUPS_RACE_RUN_REMATCH_START_V42__ = true;

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

  function isRematch() {
    return qs('rematch') === '1' || qs('from') === 'race-rematch';
  }

  function getInfo() {
    const runState = window.HHA_GROUPS_RACE_RUN?.getState?.() || {};

    const roomId = cleanRoom(
      runState.roomId ||
      qs('roomId') ||
      qs('room') ||
      ''
    );

    const name = cleanName(
      runState.name ||
      qs('name') ||
      qs('nick') ||
      localStorage.getItem('HHA_GROUPS_RACE_LAST_NAME') ||
      'Hero'
    );

    const playerKey =
      runState.playerKey ||
      playerKeyFromName(name);

    return {
      roomId,
      name,
      playerKey,
      isLocal: roomId === 'LOCAL' && qs('local') === '1'
    };
  }

  function injectStyle() {
    if (document.getElementById('groups-race-run-rematch-start-v42-style')) return;

    const style = document.createElement('style');
    style.id = 'groups-race-run-rematch-start-v42-style';
    style.textContent = `
      #btnStartRace,
      .hha-race-start-btn-v42{
        display:inline-flex !important;
        align-items:center !important;
        justify-content:center !important;
        min-height:48px !important;
        border:0 !important;
        border-radius:18px !important;
        padding:0 18px !important;
        font:inherit !important;
        font-size:15px !important;
        font-weight:1000 !important;
        cursor:pointer !important;
        color:#fff !important;
        background:linear-gradient(180deg,#76c7ff,#4bb0ff) !important;
        box-shadow:0 14px 34px rgba(75,176,255,.28) !important;
        pointer-events:auto !important;
        opacity:1 !important;
      }

      #btnStartRace:disabled,
      .hha-race-start-btn-v42:disabled{
        cursor:not-allowed !important;
        opacity:.62 !important;
        filter:saturate(.6) !important;
      }

      .hha-race-rematch-note-v42{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:34px;
        margin-left:8px;
        border-radius:999px;
        padding:0 12px;
        color:#ffe29b;
        background:rgba(240,193,109,.14);
        border:1px solid rgba(240,193,109,.24);
        font-size:12px;
        font-weight:1000;
      }

      .hha-race-run-toast-v42{
        position:fixed;
        left:50%;
        top:18px;
        transform:translateX(-50%);
        z-index:999999;
        width:min(560px,92vw);
        border-radius:20px;
        padding:14px 16px;
        color:#f8fbff;
        text-align:center;
        font-family:ui-rounded,"Nunito","Noto Sans Thai",system-ui,sans-serif;
        font-size:15px;
        font-weight:1000;
        line-height:1.35;
        background:linear-gradient(180deg,rgba(14,32,91,.98),rgba(6,16,52,.98));
        border:1px solid rgba(132,168,255,.25);
        box-shadow:0 20px 70px rgba(0,0,0,.38);
        animation:hhaRaceRunToastV42 .24s ease both;
      }

      @keyframes hhaRaceRunToastV42{
        from{opacity:0; transform:translateX(-50%) translateY(-10px) scale(.96)}
        to{opacity:1; transform:translateX(-50%) translateY(0) scale(1)}
      }

      @media (max-width:640px){
        #btnStartRace,
        .hha-race-start-btn-v42{
          min-height:44px !important;
          border-radius:16px !important;
          padding:0 14px !important;
          font-size:13px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function toast(text) {
    const old = document.querySelector('.hha-race-run-toast-v42');
    if (old) old.remove();

    const el = document.createElement('div');
    el.className = 'hha-race-run-toast-v42';
    el.textContent = text;
    document.body.appendChild(el);

    setTimeout(() => {
      el.remove();
    }, 2600);
  }

  function getButtonHost() {
    return (
      document.querySelector('.topActions') ||
      document.querySelector('.run-actions') ||
      document.querySelector('.race-actions') ||
      document.querySelector('.actions') ||
      document.querySelector('header') ||
      document.body
    );
  }

  function ensureStartButton() {
    let btn = document.getElementById('btnStartRace');

    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'btnStartRace';
      btn.type = 'button';
      btn.className = 'hha-race-start-btn-v42';
      btn.textContent = '🚀 เริ่มแข่ง';

      const backBtn =
        document.getElementById('btnBackLobby') ||
        document.querySelector('[href*="groups-race-lobby"]') ||
        document.querySelector('button');

      const host = getButtonHost();

      if (backBtn && backBtn.parentElement) {
        backBtn.parentElement.insertBefore(btn, backBtn);
      } else if (host) {
        host.prepend(btn);
      } else {
        document.body.prepend(btn);
      }
    }

    if (!btn.dataset.v42Bound) {
      btn.dataset.v42Bound = '1';

      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        startRace();
      }, true);
    }

    if (isRematch() && !document.getElementById('rematchNoteV42')) {
      const note = document.createElement('span');
      note.id = 'rematchNoteV42';
      note.className = 'hha-race-rematch-note-v42';
      note.textContent = 'Rematch ห้องเดิม';

      btn.insertAdjacentElement('afterend', note);
    }

    return btn;
  }

  function connectedCountFromRunState(runState) {
    const list =
      runState.dedupPlayers ||
      Object.values(runState.players || {});

    return list.filter((p) => p && p.connected !== false).length;
  }

  function refreshButtonState() {
    const btn = ensureStartButton();
    const runState = window.HHA_GROUPS_RACE_RUN?.getState?.();

    if (!runState) {
      btn.disabled = false;
      btn.textContent = isRematch()
        ? '🚀 เริ่มรอบใหม่'
        : '🚀 เริ่มแข่ง';
      return;
    }

    const count = connectedCountFromRunState(runState);

    if (runState.localOnly) {
      btn.disabled = false;
      btn.textContent = '🚀 เริ่ม LOCAL Test';
      return;
    }

    if (runState.isHost) {
      btn.disabled = count < 2;
      btn.textContent = count < 2
        ? 'รอผู้เล่น 2 คน'
        : isRematch()
          ? '🚀 เริ่มรอบใหม่'
          : '🚀 เริ่มแข่ง';
    } else {
      btn.disabled = true;
      btn.textContent = 'รอ Host เริ่ม';
    }
  }

  async function waitFirebase(timeoutMs = 6000) {
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
      }

      function onReady() {
        if (done) return;
        done = true;
        cleanup();
        resolve(window.HHA_FIREBASE);
      }

      window.addEventListener('hha:firebase-ready', onReady, { once: true });
    });
  }

  async function repairRematchHost() {
    const info = getInfo();

    if (!isRematch()) return;
    if (!info.roomId || info.roomId === 'LOCAL') return;

    const fb = await waitFirebase();
    if (!fb || !fb.db) {
      toast('กลับห้องรอแล้ว แต่ Firebase ยังไม่พร้อม');
      return;
    }

    try {
      if (fb.auth && !fb.auth.currentUser && typeof fb.auth.signInAnonymously === 'function') {
        await fb.auth.signInAnonymously();
      }
    } catch (_) {}

    const uid =
      fb.auth?.currentUser?.uid ||
      window.HHA_FIREBASE?.uid ||
      '';

    const roomRef = fb.db.ref(`${ROOM_ROOT}/${info.roomId}`);

    try {
      const snap = await roomRef.once('value');
      const room = snap.val() || {};
      const players = room.players || {};

      const hostKey = room.hostPlayerKey || '';
      const host = hostKey ? players[hostKey] : null;

      /*
        Rematch rule:
        คนที่กด “กลับห้องรอ” จะเป็นผู้เริ่มรอบใหม่ได้
        เพื่อกันอาการกลับมาแล้วไม่มีใครมีปุ่ม start
      */
      const shouldPromote =
        !hostKey ||
        !host ||
        host.connected === false ||
        room.rematch?.requestedBy === info.playerKey ||
        qs('rematch') === '1';

      const updates = {};

      updates[`players/${info.playerKey}/uid`] = uid;
      updates[`players/${info.playerKey}/playerKey`] = info.playerKey;
      updates[`players/${info.playerKey}/name`] = info.name;
      updates[`players/${info.playerKey}/ready`] = true;
      updates[`players/${info.playerKey}/connected`] = true;
      updates[`players/${info.playerKey}/done`] = false;
      updates[`players/${info.playerKey}/running`] = false;
      updates[`players/${info.playerKey}/inLobby`] = false;
      updates[`players/${info.playerKey}/inRun`] = true;
      updates[`players/${info.playerKey}/inGame`] = false;
      updates[`players/${info.playerKey}/page`] = 'groups-race-run-rematch';
      updates[`players/${info.playerKey}/updatedAt`] = now();

      if (shouldPromote) {
        updates.hostUid = uid;
        updates.hostPlayerKey = info.playerKey;
        updates.hostName = info.name;
        updates[`players/${info.playerKey}/host`] = true;
      }

      updates.status = 'waiting';
      updates.state = 'lobby';
      updates.startAt = 0;
      updates.updatedAt = now();
      updates['rematch/status'] = 'waiting';
      updates['rematch/hostPlayerKey'] = shouldPromote ? info.playerKey : hostKey;
      updates['rematch/updatedAt'] = now();

      await roomRef.update(updates);

      if (shouldPromote) {
        toast('พร้อมเริ่มรอบใหม่ในห้องเดิมแล้ว');
      }
    } catch (err) {
      console.warn('[Race Run Rematch v4.2] repairRematchHost failed', err);
    }
  }

  async function manualStartRaceFallback() {
    const info = getInfo();

    if (!info.roomId) {
      toast('ยังไม่มี Room Code');
      return;
    }

    if (info.isLocal) {
      const u = new URL('./groups-race.html', location.href);
      u.searchParams.set('roomId', 'LOCAL');
      u.searchParams.set('room', 'LOCAL');
      u.searchParams.set('local', '1');
      u.searchParams.set('name', info.name);
      u.searchParams.set('startAt', String(now() + 1200));
      u.searchParams.set('seed', `LOCAL-${now()}`);
      location.href = u.toString();
      return;
    }

    const fb = await waitFirebase();

    if (!fb || !fb.db) {
      toast('Firebase ยังไม่พร้อม เริ่มแข่งไม่ได้');
      return;
    }

    const roomRef = fb.db.ref(`${ROOM_ROOT}/${info.roomId}`);

    try {
      const snap = await roomRef.child('players').once('value');
      const players = Object.values(snap.val() || {}).filter((p) => p && p.connected !== false);

      if (players.length < 2) {
        toast('Race จริงต้องมีผู้เล่นอย่างน้อย 2 คน');
        return;
      }

      const startAt = now() + 3500;
      const seed = `${info.roomId}-rematch-${now()}`;

      await roomRef.update({
        status: 'started',
        state: 'running',
        startAt,
        seed,
        updatedAt: now()
      });

      toast('เริ่มรอบใหม่แล้ว ทุกคนจะเข้าเกมพร้อมกัน');
    } catch (err) {
      console.warn('[Race Run Rematch v4.2] manualStartRaceFallback failed', err);
      toast('เริ่มแข่งไม่สำเร็จ');
    }
  }

  function startRace() {
    const api = window.HHA_GROUPS_RACE_RUN;

    if (api && typeof api.startRaceNow === 'function') {
      api.startRaceNow();
      return;
    }

    manualStartRaceFallback();
  }

  function observeDom() {
    const mo = new MutationObserver(() => {
      ensureStartButton();
      refreshButtonState();
    });

    mo.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function init() {
    injectStyle();
    ensureStartButton();
    refreshButtonState();
    observeDom();

    repairRematchHost().then(() => {
      setTimeout(refreshButtonState, 450);
      setTimeout(refreshButtonState, 1200);
    });

    setInterval(refreshButtonState, 700);

    window.HHA_GROUPS_RACE_RUN_REMATCH_START = {
      version: VERSION,
      ensureStartButton,
      refreshButtonState,
      repairRematchHost,
      startRace,
      getInfo
    };

    console.info('[Groups Race Run Rematch Start] installed', VERSION);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
