/* =========================================================
   HeroHealth • GoodJunk Battle Runtime Sync v3 SAFE
   FILE: /herohealth/vr-goodjunk/goodjunk-vr-battle.runtime-sync-v3-safe.js
   PATCH: v20260514d

   Fix:
   - กัน loop Firebase listener -> write -> listener จน browser crash
   - บังคับ role จาก room.hostPid เท่านั้น
   - sync players แบบ write เฉพาะเมื่อข้อมูลเปลี่ยน
   ========================================================= */

(() => {
  'use strict';

  const PATCH_ID = 'v20260514d-runtime-sync-v3-safe';
  if (window.__GJ_BATTLE_RUNTIME_SYNC_V3_SAFE__) return;
  window.__GJ_BATTLE_RUNTIME_SYNC_V3_SAFE__ = PATCH_ID;

  const qs = new URLSearchParams(location.search);
  const ROOM = cleanRoom(qs.get('roomId') || qs.get('room') || '');
  const PID = clean(qs.get('pid') || '');
  const NAME = clean(qs.get('name') || qs.get('nick') || 'Player');
  const URL_MATCH = clean(qs.get('matchId') || '');

  const LOG = '[GJ Battle Runtime Sync v3 Safe]';
  const MIN_PLAYERS = 2;

  let db = null;
  let auth = null;
  let lastWriteSig = '';
  let lastEventSig = '';
  let lastWriteAt = 0;
  let pollTimer = null;

  boot();

  async function boot(){
    if (!ROOM){
      console.warn(LOG, 'missing room');
      return;
    }

    try{
      await waitForDb();

      console.info(LOG, 'loaded', {
        patch: PATCH_ID,
        room: ROOM,
        pid: PID,
        name: NAME,
        uid: auth?.currentUser?.uid || ''
      });

      await syncOnce('boot');
      listenRoom();

      pollTimer = setInterval(() => {
        syncOnce('poll').catch(err => console.warn(LOG, 'poll failed', err));
      }, 2500);

      window.addEventListener('pagehide', () => {
        if (pollTimer) clearInterval(pollTimer);
      });
    }catch(err){
      console.warn(LOG, 'boot failed', err);
    }
  }

  async function waitForDb(){
    for (let i = 0; i < 60; i++){
      if (window.HHA_FIREBASE_READY){
        const fb = await window.HHA_FIREBASE_READY;
        if (fb && fb.db && fb.auth && fb.auth.currentUser){
          db = fb.db;
          auth = fb.auth;
          return;
        }
      }
      await sleep(250);
    }
    throw new Error('Firebase auth/db not ready');
  }

  function listenRoom(){
    db.ref(roomPath(ROOM)).on('value', snap => {
      const room = snap && snap.val ? snap.val() : null;
      syncWithRoom(room, 'listener').catch(err => console.warn(LOG, 'listener failed', err));
    });
  }

  async function syncOnce(reason){
    const room = await dbGet(roomPath(ROOM)).catch(() => null);
    await syncWithRoom(room, reason);
  }

  async function syncWithRoom(room, reason){
    if (!room){
      console.warn(LOG, 'room not found', ROOM);
      return;
    }

    const matchId =
      URL_MATCH ||
      clean(room.activeMatchId || '') ||
      clean(room.currentRun?.matchId || '') ||
      `${ROOM}-R1`;

    const match = await dbGet(matchPath(ROOM, matchId)).catch(() => null);

    const participants = collectParticipants(room, match);
    const count = Object.keys(participants).length;
    const expected = Math.max(
      MIN_PLAYERS,
      Number(room.expectedPlayers || 0),
      Number(room.participantCount || 0),
      Number(room.activeCount || 0),
      Number(room.currentRun?.expectedPlayers || 0),
      Number(room.currentRun?.participantCount || 0),
      Number(match?.expectedPlayers || 0),
      count
    );

    const role = trueRole(room, PID);
    fixUrlRole(role);

    const payload = {
      roomId: ROOM,
      matchId,
      participants,
      count,
      expected,
      role,
      status: clean(room.status || 'waiting')
    };

    window.HHA_BATTLE_RUNTIME_PARTICIPANTS = payload;
    window.dispatchEvent(new CustomEvent('hha:battle:runtime-sync', { detail: payload }));
    document.dispatchEvent(new CustomEvent('hha:battle:runtime-sync', { detail: payload }));

    await repairMyRole(room, participants, role);
    await safeMirror(room, matchId, participants, count, expected, reason);

    const sig = `${room.status || ''}|${count}|${expected}|${role}|${Object.values(participants).map(p => `${p.pid}:${p.role}`).join(',')}`;
    if (sig !== lastEventSig){
      lastEventSig = sig;
      console.info(LOG, reason, {
        room: ROOM,
        matchId,
        status: room.status,
        count,
        expected,
        role,
        hostPid: room.hostPid,
        players: Object.values(participants).map(p => `${p.name} • ${p.role}`)
      });
    }
  }

  function collectParticipants(room, match){
    const out = {};

    merge(out, room?.players, room, 'room.players');
    merge(out, room?.runtimePlayers, room, 'room.runtimePlayers');
    merge(out, room?.activePlayers, room, 'room.activePlayers');
    merge(out, room?.currentRun?.participants, room, 'room.currentRun.participants');
    merge(out, room?.currentRun?.runtimePlayers, room, 'room.currentRun.runtimePlayers');
    merge(out, room?.currentRun?.activePlayers, room, 'room.currentRun.activePlayers');
    merge(out, match?.participants, room, 'match.participants');
    merge(out, match?.runtimePlayers, room, 'match.runtimePlayers');
    merge(out, match?.activePlayers, room, 'match.activePlayers');
    merge(out, match?.players, room, 'match.players');

    if (PID && !out[safeKey(PID)]){
      const role = trueRole(room, PID);
      out[safeKey(PID)] = {
        pid: PID,
        name: NAME,
        nick: NAME,
        role,
        host: role === 'host',
        ready: true,
        online: true,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
        source: 'runtime-url'
      };
    }

    normalizeIndexes(out);
    return out;
  }

  function merge(out, raw, room, source){
    if (!raw || typeof raw !== 'object') return;

    Object.values(raw).filter(Boolean).forEach((p, index) => {
      const pid = clean(p.pid || p.id || p.playerId || '');
      if (!pid) return;

      const key = safeKey(pid);
      const role = trueRole(room, pid);

      out[key] = {
        ...out[key],
        ...p,
        pid,
        name: clean(p.name || p.nick || p.displayName || out[key]?.name || `Player ${index + 1}`),
        nick: clean(p.nick || p.name || p.displayName || out[key]?.nick || `Player ${index + 1}`),
        role,
        host: role === 'host',
        ready: p.ready !== false,
        online: p.online !== false,
        joinedAt: Number(p.joinedAt || out[key]?.joinedAt || Date.now()),
        lastSeen: Date.now(),
        source
      };
    });
  }

  function normalizeIndexes(players){
    const arr = Object.values(players)
      .sort((a,b) => {
        if (a.role === 'host' && b.role !== 'host') return -1;
        if (a.role !== 'host' && b.role === 'host') return 1;
        return Number(a.joinedAt || 0) - Number(b.joinedAt || 0);
      });

    arr.forEach((p, i) => {
      const key = safeKey(p.pid);
      players[key].battleIndex = i + 1;
    });
  }

  function trueRole(room, pid){
    if (!room || !pid) return 'guest';
    return String(room.hostPid || '') === String(pid) ? 'host' : 'guest';
  }

  async function repairMyRole(room, participants, role){
    if (!PID) return;

    const key = safeKey(PID);
    const mine = participants[key];
    if (!mine) return;

    const current = room?.players?.[key] || {};
    const need =
      current.role !== role ||
      current.host !== (role === 'host') ||
      current.online !== true;

    if (!need) return;

    await dbUpdate(roomPath(ROOM), {
      [`players/${key}/pid`]: PID,
      [`players/${key}/name`]: mine.name || NAME,
      [`players/${key}/nick`]: mine.nick || mine.name || NAME,
      [`players/${key}/role`]: role,
      [`players/${key}/host`]: role === 'host',
      [`players/${key}/ready`]: true,
      [`players/${key}/online`]: true,
      [`players/${key}/lastSeen`]: Date.now()
    }).catch(err => console.warn(LOG, 'repair role failed', err));
  }

  async function safeMirror(room, matchId, participants, count, expected, reason){
    const t = Date.now();
    const cleanParticipants = cleanForWrite(participants);

    const writeSig = JSON.stringify({
      status: room.status || '',
      matchId,
      count,
      expected,
      players: Object.values(cleanParticipants).map(p => `${p.pid}:${p.role}:${p.battleIndex}`).join('|')
    });

    if (writeSig === lastWriteSig && (t - lastWriteAt) < 5000) return;

    lastWriteSig = writeSig;
    lastWriteAt = t;

    const roomUpdates = {
      activeCount: count,
      expectedPlayers: expected,
      participantCount: count,
      runtimePlayers: cleanParticipants,
      activePlayers: cleanParticipants,
      updatedAt: t,
      lastRuntimeSyncAt: t,
      lastRuntimeSyncReason: reason,

      'currentRun/matchId': matchId,
      'currentRun/expectedPlayers': expected,
      'currentRun/participantCount': count,
      'currentRun/activeCount': count,
      'currentRun/participants': cleanParticipants,
      'currentRun/runtimePlayers': cleanParticipants,
      'currentRun/activePlayers': cleanParticipants
    };

    await dbUpdate(roomPath(ROOM), roomUpdates).catch(err => {
      console.warn(LOG, 'room mirror failed', err);
    });

    await dbUpdate(matchPath(ROOM, matchId), {
      matchId,
      roomId: ROOM,
      mode: 'battle',
      game: 'goodjunk',
      expectedPlayers: expected,
      participantCount: count,
      activeCount: count,
      participants: cleanParticipants,
      runtimePlayers: cleanParticipants,
      activePlayers: cleanParticipants,
      updatedAt: t,
      lastRuntimeSyncAt: t,
      lastRuntimeSyncReason: reason
    }).catch(err => {
      console.warn(LOG, 'match mirror failed', err);
    });
  }

  function cleanForWrite(participants){
    const out = {};
    Object.values(participants || {}).filter(Boolean).forEach((p, index) => {
      const pid = clean(p.pid || '');
      if (!pid) return;

      const role = clean(p.role || 'guest') === 'host' ? 'host' : 'guest';
      const key = safeKey(pid);

      out[key] = {
        pid,
        name: clean(p.name || p.nick || `Player ${index + 1}`),
        nick: clean(p.nick || p.name || `Player ${index + 1}`),
        role,
        host: role === 'host',
        ready: p.ready !== false,
        online: p.online !== false,
        joinedAt: Number(p.joinedAt || Date.now()),
        lastSeen: Date.now(),
        battleIndex: Number(p.battleIndex || index + 1)
      };
    });
    return out;
  }

  function fixUrlRole(role){
    try{
      const u = new URL(location.href);
      u.searchParams.set('role', role);
      u.searchParams.set('host', role === 'host' ? '1' : '0');
      history.replaceState(null, '', u.toString());
    }catch(_){}
  }

  function roomPath(roomId){
    return `hha-battle/goodjunk/battleRooms/${safeKey(roomId)}`;
  }

  function matchPath(roomId, matchId){
    return `${roomPath(roomId)}/matches/${safeKey(matchId)}`;
  }

  function dbGet(path){
    return db.ref(path).get().then(s => s && s.val ? s.val() : null);
  }

  function dbUpdate(path, value){
    return db.ref(path).update(value).then(() => value);
  }

  function safeKey(raw){
    return String(raw || '').trim().replace(/[.#$/\[\]]/g,'_').slice(0,96) || 'key';
  }

  function clean(v){
    return String(v ?? '').trim();
  }

  function cleanRoom(v){
    let s = clean(v).toUpperCase();
    s = s.replace(/\s+/g,'').replace(/[^A-Z0-9-]/g,'');
    if (!s) return '';
    if (!s.startsWith('GJ-BT-')){
      s = 'GJ-BT-' + s.replace(/^GJ-BT/i,'').replace(/^GJBT/i,'').replace(/^BT/i,'').replace(/^-/, '');
    }
    return s.slice(0,16);
  }

  function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
  }
})();
