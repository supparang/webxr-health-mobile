/* =========================================================
   HeroHealth • Groups Race Dev Room Fix
   File: /herohealth/vr-groups/groups-race-dev-room-v14.js
   PATCH: v20260606-GROUPS-RACE-DEV-ROOM-V14

   Purpose:
   - แก้ mock=1 แล้ว Room เป็น "-"
   - สร้าง Room Code จำลองอัตโนมัติเมื่อ URL ไม่มี room/roomId/code
   - sync ค่าไป URL + sessionStorage + localStorage
   - ช่วยให้ Dev Bot v12 หา Room ได้
   - เติม Ranking fallback เมื่อเล่นจบแต่ Firebase/Bot ยังไม่ทันตอบ
   ========================================================= */

(function () {
  'use strict';

  const PATCH = 'v20260606-GROUPS-RACE-DEV-ROOM-V14';
  const BASE = 'herohealth/groups/raceRooms';

  if (window.__HHA_GROUPS_RACE_DEV_ROOM_V14__) return;
  window.__HHA_GROUPS_RACE_DEV_ROOM_V14__ = true;

  const qs = new URLSearchParams(location.search || '');

  const DEV_MODE =
    qs.get('mock') === '1' ||
    qs.get('dev') === '1' ||
    qs.get('bot') === '1' ||
    qs.get('testBot') === '1' ||
    localStorage.getItem('HHA_GROUPS_RACE_DEV_BOT') === '1';

  if (!DEV_MODE) return;

  let db = null;
  let roomCode = '';

  function log() {
    try {
      console.log('[GroupsRaceDevRoom]', ...arguments);
    } catch (_) {}
  }

  function warn() {
    try {
      console.warn('[GroupsRaceDevRoom]', ...arguments);
    } catch (_) {}
  }

  function norm(v) {
    return String(v || '').trim();
  }

  function now() {
    return Date.now();
  }

  function $(id) {
    return document.getElementById(id);
  }

  function getName() {
    return norm(
      qs.get('name') ||
      qs.get('playerName') ||
      sessionStorage.getItem('HHA_GROUPS_RACE_NAME') ||
      localStorage.getItem('HHA_GROUPS_RACE_PLAYER_NAME') ||
      'Hero'
    ) || 'Hero';
  }

  function getRoomFromKnownSources() {
    return norm(
      qs.get('roomId') ||
      qs.get('room') ||
      qs.get('code') ||
      qs.get('raceRoom') ||
      sessionStorage.getItem('HHA_GROUPS_RACE_ROOM') ||
      sessionStorage.getItem('HHA_GROUPS_RACE_ROOM_CODE') ||
      localStorage.getItem('HHA_GROUPS_RACE_ROOM_CODE') ||
      localStorage.getItem('HHA_GROUPS_RACE_ROOM') ||
      localStorage.getItem('HHA_RACE_ROOM') ||
      ''
    ).toUpperCase();
  }

  function makeRoomCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = 'R';

    for (let i = 0; i < 5; i += 1) {
      out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }

    return out;
  }

  function saveRoom(room) {
    room = norm(room).toUpperCase();
    if (!room) return '';

    roomCode = room;

    try {
      sessionStorage.setItem('HHA_GROUPS_RACE_ROOM', room);
      sessionStorage.setItem('HHA_GROUPS_RACE_ROOM_CODE', room);
      sessionStorage.setItem('HHA_GROUPS_RACE_NAME', getName());

      localStorage.setItem('HHA_GROUPS_RACE_ROOM', room);
      localStorage.setItem('HHA_GROUPS_RACE_ROOM_CODE', room);
      localStorage.setItem('HHA_RACE_ROOM', room);
      localStorage.setItem('HHA_GROUPS_RACE_PLAYER_NAME', getName());
    } catch (_) {}

    window.__HHA_GROUPS_RACE_ROOM_CODE__ = room;
    window.__HHA_GROUPS_RACE_ROOM__ = room;

    return room;
  }

  function ensureRoom() {
    let room = getRoomFromKnownSources();

    if (!room) {
      room = makeRoomCode();
    }

    saveRoom(room);
    patchUrl(room);
    paintRoom(room);

    return room;
  }

  function patchUrl(room) {
    try {
      const url = new URL(location.href);

      if (!url.searchParams.get('room')) {
        url.searchParams.set('room', room);
      }

      if (!url.searchParams.get('roomId')) {
        url.searchParams.set('roomId', room);
      }

      if (!url.searchParams.get('code')) {
        url.searchParams.set('code', room);
      }

      history.replaceState(null, '', url.toString());
    } catch (_) {}
  }

  function paintRoom(room) {
    room = room || roomCode || getRoomFromKnownSources();

    const metaRoom = $('metaRoom');
    const pill = $('hhaRaceRoomPillV11');
    const status = $('statusMsg');
    const state = $('roomState');
    const devPanel = $('hhaRaceDevBotV12');

    if (metaRoom) metaRoom.textContent = room || '-';
    if (pill) pill.textContent = 'Room ' + (room || '-');

    if (status && room) {
      const text = String(status.textContent || '');
      if (text.includes('ไม่พบ Room Code') || text.includes('Firebase') || text.includes('รอเพื่อน')) {
        status.className = 'status-text ok';
        status.textContent = 'Dev Room พร้อมแล้ว: ' + room + ' • ใช้ทดสอบเครื่องเดียวได้';
      }
    }

    if (state && room) {
      const text = String(state.textContent || '');
      if (text.includes('Room') || text.includes('ห้อง') || text.includes('ตรวจสอบ')) {
        state.textContent = 'Dev Room ' + room + ' พร้อมแล้ว • เพิ่ม Bot แล้วเริ่มแข่งได้';
      }
    }

    if (devPanel && room) {
      const p = devPanel.querySelector('p');
      if (p && String(p.innerHTML || '').includes('Room: <b>-</b>')) {
        p.innerHTML = p.innerHTML.replace('Room: <b>-</b>', 'Room: <b>' + room + '</b>');
      }
    }
  }

  function isFirebaseReady() {
    return (
      window.firebase &&
      typeof window.firebase.database === 'function'
    );
  }

  function ensureDb() {
    if (db) return true;

    if (!isFirebaseReady()) return false;

    try {
      db = window.firebase.database();
      return !!db;
    } catch (e) {
      warn('Firebase DB not ready', e);
      return false;
    }
  }

  function roomPath(child) {
    return BASE + '/' + roomCode + (child ? '/' + child : '');
  }

  function seedRoomToFirebase() {
    if (!roomCode || !ensureDb()) return;

    const name = getName();
    const hostKey =
      'devhost_' +
      String(name || 'hero')
        .toLowerCase()
        .replace(/[^a-z0-9ก-ฮะ-์]+/gi, '_')
        .slice(0, 24);

    const t = now();

    const meta = {
      room: roomCode,
      roomCode: roomCode,
      mode: 'race',
      band: 'standard',
      minPlayers: 2,
      maxPlayers: 4,
      status: 'waiting',
      phase: 'waiting',
      devMode: true,
      updatedAt: t,
      patch: PATCH
    };

    const host = {
      pid: hostKey,
      id: hostKey,
      name: name,
      playerName: name,
      role: 'host',
      type: 'host',
      isHost: true,
      ready: true,
      status: 'ready',
      phase: 'ready',
      view: qs.get('view') || 'mobile',
      diff: qs.get('diff') || 'normal',
      joinedAt: t,
      updatedAt: t,
      patch: PATCH
    };

    const jobs = [
      db.ref(roomPath('meta')).update(meta).catch(function (e) {
        warn('meta write failed', e && e.message ? e.message : e);
        return false;
      }),
      db.ref(roomPath('players/' + hostKey)).update(host).catch(function (e) {
        warn('host write failed', e && e.message ? e.message : e);
        return false;
      })
    ];

    Promise.all(jobs).then(function () {
      try {
        window.dispatchEvent(new CustomEvent('hha:groups-race-room-ready', {
          detail: {
            room: roomCode,
            name: name,
            patch: PATCH
          }
        }));
      } catch (_) {}

      log('room seeded', roomCode);
    });
  }

  function numberFromText(id, fallback) {
    const el = $(id);
    const raw = el ? String(el.textContent || '').replace(/[^\d.]/g, '') : '';

    const n = Number(raw);

    return Number.isFinite(n) ? n : fallback;
  }

  function injectLocalRankingFallback() {
    const summary = $('hhaRaceSummaryV11');
    const rank = $('hhaRaceRankListV11');

    if (!summary || !rank) return;

    const visible = getComputedStyle(summary).display !== 'none';
    if (!visible) return;

    const text = String(rank.textContent || '').trim();

    if (
      text &&
      !text.includes('กำลังรอผลผู้เล่น') &&
      !text.includes('รอผล') &&
      !text.includes('กำลังรอ')
    ) {
      return;
    }

    const score = numberFromText('hhaRaceScoreV11', 0);
    const correct = numberFromText('hhaRaceCorrectV11', 0);
    const combo = numberFromText('hhaRaceComboV11', 0);

    let accuracy = 0;
    const summaryText = String(($('hhaRaceSummaryTextV11') || {}).textContent || '');
    const accMatch = summaryText.match(/(\d+)\s*%/);
    if (accMatch) accuracy = Number(accMatch[1]) || 0;

    const botScore = Math.max(450, Math.round(score * 0.72));
    const botAcc = Math.max(65, Math.min(92, accuracy - 5 || 82));

    rank.innerHTML =
      '<div class="hha-race-rank-row-v11">' +
        '<span>🥇 1. ' + escapeHtml(getName()) + '</span>' +
        '<span>' + score + ' pts · ' + accuracy + '%</span>' +
      '</div>' +
      '<div class="hha-race-rank-row-v11">' +
        '<span>🥈 2. RaceBot · mock</span>' +
        '<span>' + botScore + ' pts · ' + botAcc + '%</span>' +
      '</div>' +
      '<div class="hha-race-rank-row-v11">' +
        '<span>✅ Dev Summary</span>' +
        '<span>ถูก ' + correct + ' · Combo ' + combo + '</span>' +
      '</div>';

    try {
      localStorage.setItem('HHA_GROUPS_RACE_LAST_DEV_RANKING', JSON.stringify({
        room: roomCode,
        name: getName(),
        score: score,
        accuracy: accuracy,
        correct: correct,
        combo: combo,
        botScore: botScore,
        botAccuracy: botAcc,
        patch: PATCH,
        savedAt: now()
      }));
    } catch (_) {}
  }

  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[c];
    });
  }

  function boot() {
    roomCode = ensureRoom();

    log('boot', {
      patch: PATCH,
      room: roomCode,
      devMode: DEV_MODE,
      href: location.href
    });

    let tries = 0;
    const fbTimer = setInterval(function () {
      tries += 1;

      if (ensureDb()) {
        clearInterval(fbTimer);
        seedRoomToFirebase();
      }

      if (tries >= 60) {
        clearInterval(fbTimer);
        warn('Firebase not ready after waiting; local dev room still works');
      }
    }, 250);

    setInterval(function () {
      if (!roomCode) roomCode = ensureRoom();
      paintRoom(roomCode);
      injectLocalRankingFallback();
    }, 500);

    setTimeout(function () {
      paintRoom(roomCode);
      injectLocalRankingFallback();
    }, 800);

    setTimeout(function () {
      paintRoom(roomCode);
      injectLocalRankingFallback();
    }, 1800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
