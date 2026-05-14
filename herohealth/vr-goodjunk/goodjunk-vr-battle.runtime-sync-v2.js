/* =========================================================
   HeroHealth • GoodJunk Battle Runtime Sync v2
   FILE: /herohealth/vr-goodjunk/goodjunk-vr-battle.runtime-sync-v2.js
   PATCH: v20260514c-rolelock-runtime-sync

   Purpose:
   - Runtime เห็น 1/2 ทั้งที่ Lobby มี 2/4
   - KK/Guest ถูก runtime ตั้งเป็น host ซ้ำ
   - บังคับ role จาก room.hostPid เท่านั้น
   - อ่านผู้เล่นจากหลาย path:
     room.players
     room.runtimePlayers
     room.activePlayers
     room.currentRun.participants
     room.currentRun.runtimePlayers
     room.currentRun.activePlayers
     match.participants
     match.runtimePlayers
     match.activePlayers
     match.players
   - mirror activeCount / participants กลับ Firebase ให้ runtime เดิมอ่านได้
   ========================================================= */

(() => {
  'use strict';

  const PATCH_ID = 'v20260514c-rolelock-runtime-sync';

  if (window.__GJ_BATTLE_RUNTIME_SYNC_V2__) {
    console.info('[GJ Battle Runtime Sync v2] already loaded:', window.__GJ_BATTLE_RUNTIME_SYNC_V2__);
    return;
  }

  window.__GJ_BATTLE_RUNTIME_SYNC_V2__ = PATCH_ID;

  const params = new URLSearchParams(location.search);

  const ROOM = cleanRoom(params.get('roomId') || params.get('room') || '');
  const PID = clean(params.get('pid') || '');
  const NAME = clean(params.get('name') || params.get('nick') || 'Player');
  const URL_MATCH = clean(params.get('matchId') || '');

  const MIN_PLAYERS = 2;
  const LOG = '[GJ Battle Runtime Sync v2]';

  let db = null;
  let auth = null;
  let timer = null;
  let forceStarted = false;
  let lastRole = '';
  let lastCount = 0;
  let lastExpected = 0;
  let lastMatchId = '';
  let lastStatus = '';

  boot();

  async function boot(){
    if (!ROOM){
      console.warn(LOG, 'no room in URL');
      return;
    }

    if (!PID){
      console.warn(LOG, 'no pid in URL; runtime sync will still try but role-lock may be limited');
    }

    try{
      await waitForDb();

      console.info(LOG, 'loaded', {
        patch: PATCH_ID,
        room: ROOM,
        pid: PID,
        name: NAME,
        uid: auth && auth.currentUser ? auth.currentUser.uid : ''
      });

      await syncOnce('boot');

      listenRoom();

      timer = setInterval(() => {
        syncOnce('poll').catch(err => console.warn(LOG, 'poll failed', err));
      }, 900);

      window.addEventListener('pagehide', () => {
        if (timer) clearInterval(timer);
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

          console.info(LOG, 'Firebase auth ready', {
            uid: fb.auth.currentUser.uid
          });

          return;
        }
      }

      await sleep(250);
    }

    throw new Error('Firebase auth/db not ready');
  }

  function listenRoom(){
    const ref = db.ref(roomPath(ROOM));

    ref.on('value', snap => {
      const room = snap && snap.val ? snap.val() : null;
      syncWithRoom(room, 'listener').catch(err => console.warn(LOG, 'listener failed', err));
    });
  }

  async function syncOnce(reason){
    const room = await dbGet(roomPath(ROOM));
    await syncWithRoom(room, reason);
  }

  async function syncWithRoom(room, reason){
    if (!room){
      console.warn(LOG, 'room not found', ROOM);
      patchVisibleWaiting({
        count: 1,
        expected: MIN_PLAYERS,
        participants: makeSelfOnlyParticipants('guest')
      });
      return;
    }

    const matchId =
      URL_MATCH ||
      clean(room.activeMatchId || '') ||
      clean(room.currentRun?.matchId || '') ||
      `${ROOM}-R1`;

    lastMatchId = matchId;

    const match = await dbGet(matchPath(ROOM, matchId)).catch(() => null);

    const participants = collectAllPlayers(room, match);
    const keys = Object.keys(participants);
    const count = keys.length;

    const expected = Math.max(
      MIN_PLAYERS,
      Number(room.expectedPlayers || 0),
      Number(room.participantCount || 0),
      Number(room.activeCount || 0),
      Number(room.currentRun?.expectedPlayers || 0),
      Number(room.currentRun?.participantCount || 0),
      Number(room.currentRun?.activeCount || 0),
      Number(match?.expectedPlayers || 0),
      Number(match?.participantCount || 0),
      Number(match?.activeCount || 0),
      count
    );

    const realRole = getTrueRole(room, PID);

    lastRole = realRole;
    lastCount = count;
    lastExpected = expected;

    fixUrlRole(realRole);
    fixVisibleRole(realRole, participants);
    patchVisibleWaiting({ count, expected, participants });

    await repairMyRoleInFirebase({
      room,
      participants,
      realRole
    });

    await writeMirror({
      room,
      matchId,
      participants,
      count,
      expected,
      reason
    });

    const status = clean(room.status || '').toLowerCase();
    lastStatus = status;

    const iAmRealHost = realRole === 'host';

    if (
      iAmRealHost &&
      count >= MIN_PLAYERS &&
      !forceStarted &&
      (!status || status === 'waiting' || status === 'ready')
    ){
      forceStarted = true;
      await forceStart({
        matchId,
        participants,
        count,
        expected,
        reason
      });
    }

    const payload = {
      roomId: ROOM,
      matchId,
      participants,
      count,
      expected,
      role: realRole,
      status
    };

    window.HHA_BATTLE_RUNTIME_PARTICIPANTS = payload;

    window.dispatchEvent(new CustomEvent('hha:battle:runtime-sync', {
      detail: payload
    }));

    document.dispatchEvent(new CustomEvent('hha:battle:runtime-sync', {
      detail: payload
    }));

    console.info(LOG, reason, {
      room: ROOM,
      matchId,
      status,
      count,
      expected,
      role: realRole,
      hostPid: room.hostPid || '',
      players: Object.values(participants).map(p => `${p.name || p.nick || p.pid} • ${p.role}`)
    });
  }

  function getTrueRole(room, pid){
    if (!room || !pid) return 'guest';
    return String(room.hostPid || '') === String(pid) ? 'host' : 'guest';
  }

  function makeSelfOnlyParticipants(role){
    const out = {};
    const pid = PID || 'runtime-self';
    out[safeKey(pid)] = {
      pid,
      name: NAME || 'Player',
      nick: NAME || 'Player',
      role: role || 'guest',
      host: role === 'host',
      ready: true,
      online: true,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      source: 'runtime-self'
    };
    return out;
  }

  function collectAllPlayers(room, match){
    const out = {};

    mergePlayers(out, room?.players, room, 'room.players');
    mergePlayers(out, room?.runtimePlayers, room, 'room.runtimePlayers');
    mergePlayers(out, room?.activePlayers, room, 'room.activePlayers');
    mergePlayers(out, room?.currentRun?.participants, room, 'room.currentRun.participants');
    mergePlayers(out, room?.currentRun?.runtimePlayers, room, 'room.currentRun.runtimePlayers');
    mergePlayers(out, room?.currentRun?.activePlayers, room, 'room.currentRun.activePlayers');

    mergePlayers(out, match?.participants, room, 'match.participants');
    mergePlayers(out, match?.runtimePlayers, room, 'match.runtimePlayers');
    mergePlayers(out, match?.activePlayers, room, 'match.activePlayers');
    mergePlayers(out, match?.players, room, 'match.players');

    if (PID && !out[safeKey(PID)]){
      const realRole = getTrueRole(room, PID);

      out[safeKey(PID)] = {
        pid: PID,
        name: NAME,
        nick: NAME,
        role: realRole,
        host: realRole === 'host',
        ready: true,
        online: true,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
        source: 'runtime-url'
      };
    }

    normalizeBattleIndexes(out);

    return out;
  }

  function mergePlayers(out, raw, room, source){
    if (!raw || typeof raw !== 'object') return;

    Object.values(raw).filter(Boolean).forEach((p, index) => {
      const pid = clean(p.pid || p.id || p.playerId || '');
      if (!pid) return;

      const key = safeKey(pid);
      const realRole = getTrueRole(room, pid);

      out[key] = {
        ...out[key],
        ...p,

        pid,
        name: clean(p.name || p.nick || p.displayName || out[key]?.name || `Player ${index + 1}`),
        nick: clean(p.nick || p.name || p.displayName || out[key]?.nick || `Player ${index + 1}`),

        // สำคัญมาก: ห้ามเชื่อ p.role === 'host' จาก script เก่า
        role: realRole,
        host: realRole === 'host',

        ready: p.ready !== false,
        online: p.online !== false,
        joinedAt: Number(p.joinedAt || out[key]?.joinedAt || Date.now()),
        lastSeen: Date.now(),
        battleIndex: Number(p.battleIndex || out[key]?.battleIndex || index + 1),
        source
      };
    });
  }

  function normalizeBattleIndexes(players){
    const arr = Object.values(players || {})
      .filter(Boolean)
      .sort((a,b) => {
        if (a.role === 'host' && b.role !== 'host') return -1;
        if (a.role !== 'host' && b.role === 'host') return 1;
        return Number(a.joinedAt || 0) - Number(b.joinedAt || 0);
      });

    arr.forEach((p, i) => {
      const key = safeKey(p.pid);
      if (players[key]){
        players[key].battleIndex = i + 1;
      }
    });
  }

  async function repairMyRoleInFirebase({ room, participants, realRole }){
    if (!PID) return;

    const key = safeKey(PID);
    const mine = participants[key] || null;

    if (!mine) return;

    const updates = {};

    updates[`players/${key}/pid`] = PID;
    updates[`players/${key}/name`] = mine.name || NAME || 'Player';
    updates[`players/${key}/nick`] = mine.nick || mine.name || NAME || 'Player';
    updates[`players/${key}/role`] = realRole;
    updates[`players/${key}/host`] = realRole === 'host';
    updates[`players/${key}/ready`] = true;
    updates[`players/${key}/online`] = true;
    updates[`players/${key}/lastSeen`] = Date.now();

    updates[`runtimePlayers/${key}/role`] = realRole;
    updates[`runtimePlayers/${key}/host`] = realRole === 'host';
    updates[`runtimePlayers/${key}/lastSeen`] = Date.now();

    updates[`activePlayers/${key}/role`] = realRole;
    updates[`activePlayers/${key}/host`] = realRole === 'host';
    updates[`activePlayers/${key}/lastSeen`] = Date.now();

    updates[`currentRun/participants/${key}/role`] = realRole;
    updates[`currentRun/participants/${key}/host`] = realRole === 'host';
    updates[`currentRun/participants/${key}/lastSeen`] = Date.now();

    updates[`currentRun/runtimePlayers/${key}/role`] = realRole;
    updates[`currentRun/runtimePlayers/${key}/host`] = realRole === 'host';
    updates[`currentRun/runtimePlayers/${key}/lastSeen`] = Date.now();

    updates[`currentRun/activePlayers/${key}/role`] = realRole;
    updates[`currentRun/activePlayers/${key}/host`] = realRole === 'host';
    updates[`currentRun/activePlayers/${key}/lastSeen`] = Date.now();

    await dbUpdate(roomPath(ROOM), updates).catch(err => {
      console.warn(LOG, 'repair role failed', err);
    });
  }

  async function writeMirror({ matchId, participants, count, expected, reason }){
    const t = Date.now();

    const cleanParticipants = normalizeParticipantsForWrite(participants);

    const roomUpdate = {
      activeCount: count,
      expectedPlayers: expected,
      participantCount: count,
      runtimePlayers: cleanParticipants,
      activePlayers: cleanParticipants,
      updatedAt: t,
      lastRuntimeSyncAt: t,
      lastRuntimeSyncReason: reason
    };

    roomUpdate['currentRun/matchId'] = matchId;
    roomUpdate['currentRun/expectedPlayers'] = expected;
    roomUpdate['currentRun/participantCount'] = count;
    roomUpdate['currentRun/participants'] = cleanParticipants;
    roomUpdate['currentRun/runtimePlayers'] = cleanParticipants;
    roomUpdate['currentRun/activePlayers'] = cleanParticipants;
    roomUpdate['currentRun/activeCount'] = count;

    await dbUpdate(roomPath(ROOM), roomUpdate).catch(err => {
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

  function normalizeParticipantsForWrite(participants){
    const out = {};

    Object.values(participants || {}).filter(Boolean).forEach((p, index) => {
      const pid = clean(p.pid || '');
      if (!pid) return;

      const key = safeKey(pid);
      const role = clean(p.role || 'guest') === 'host' ? 'host' : 'guest';

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

  async function forceStart({ matchId, participants, count, expected, reason }){
    const t = Date.now();
    const cleanParticipants = normalizeParticipantsForWrite(participants);

    console.warn(LOG, 'force start', {
      room: ROOM,
      matchId,
      count,
      expected,
      reason
    });

    await dbUpdate(roomPath(ROOM), {
      status: 'started',
      activeMatchId: matchId,
      activeCount: count,
      expectedPlayers: expected,
      participantCount: count,
      runtimePlayers: cleanParticipants,
      activePlayers: cleanParticipants,
      updatedAt: t,
      forceStartedAt: t,
      forceStartedBy: PID || 'runtime-sync-v2',
      forceStartReason: reason,

      'currentRun/status': 'started',
      'currentRun/matchId': matchId,
      'currentRun/startedAt': t,
      'currentRun/by': PID || 'runtime-sync-v2',
      'currentRun/expectedPlayers': expected,
      'currentRun/participantCount': count,
      'currentRun/participants': cleanParticipants,
      'currentRun/runtimePlayers': cleanParticipants,
      'currentRun/activePlayers': cleanParticipants,
      'currentRun/activeCount': count
    });

    await dbUpdate(matchPath(ROOM, matchId), {
      matchId,
      roomId: ROOM,
      mode: 'battle',
      game: 'goodjunk',
      status: 'started',
      expectedPlayers: expected,
      participantCount: count,
      activeCount: count,
      participants: cleanParticipants,
      runtimePlayers: cleanParticipants,
      activePlayers: cleanParticipants,
      startedAt: t,
      updatedAt: t,
      forceStartedAt: t,
      forceStartedBy: PID || 'runtime-sync-v2'
    });
  }

  function patchVisibleWaiting({ count, expected, participants }){
    const c = Math.max(1, Number(count || 1));
    const e = Math.max(MIN_PLAYERS, Number(expected || MIN_PLAYERS));

    patchSimpleText(/\b1\/2\b/g, `${c}/${e}`);
    patchSimpleText(/กำลังเตรียม Battle\s*\d+\/\d+/g, `กำลังเตรียม Battle ${c}/${e}`);

    if (c >= e){
      patchSimpleText(/รอผู้เล่นอีก\s*\d+\s*คน/g, 'พร้อมเริ่ม Battle แล้ว');
    }else{
      patchSimpleText(/รอผู้เล่นอีก\s*\d+\s*คน/g, `รอผู้เล่นอีก ${Math.max(0, e - c)} คน`);
    }

    fixVisibleRole(lastRole, participants);
  }

  function fixVisibleRole(role, participants){
    const arr = Object.values(participants || {})
      .filter(Boolean)
      .sort((a,b) => Number(a.battleIndex || 0) - Number(b.battleIndex || 0));

    const displayNames = arr.map(p => `${p.name || p.nick || 'Player'} • ${p.role || 'guest'}`);

    if (displayNames.length >= 2){
      const joined = displayNames.join('  |  ');

      patchSimpleText(/(?:Hero|KK|Guest|Player)\s*•\s*host/g, joined);
      patchSimpleText(/(?:Hero|KK|Guest|Player)\s*•\s*guest/g, joined);
      return;
    }

    if (role === 'guest'){
      patchSimpleText(/KK\s*•\s*host/g, 'KK • guest');
      patchSimpleText(/Guest\s*•\s*host/g, 'Guest • guest');
      patchSimpleText(/Player\s*•\s*host/g, 'Player • guest');
    }
  }

  function fixUrlRole(realRole){
    try{
      const u = new URL(location.href);

      u.searchParams.set('role', realRole);
      u.searchParams.set('host', realRole === 'host' ? '1' : '0');

      history.replaceState(null, '', u.toString());
    }catch(_){}
  }

  function patchSimpleText(pattern, replacement){
    if (!document.body) return;

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node){
          const text = node.nodeValue || '';
          pattern.lastIndex = 0;
          return pattern.test(text)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(node => {
      node.nodeValue = String(node.nodeValue || '').replace(pattern, replacement);
    });
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
    return String(raw || '')
      .trim()
      .replace(/[.#$/\[\]]/g,'_')
      .slice(0,96) || 'key';
  }

  function clean(v){
    return String(v ?? '').trim();
  }

  function cleanRoom(v){
    let s = clean(v).toUpperCase();
    s = s.replace(/\s+/g,'').replace(/[^A-Z0-9-]/g,'');

    if (!s) return '';

    if (!s.startsWith('GJ-BT-')){
      s = 'GJ-BT-' + s
        .replace(/^GJ-BT/i,'')
        .replace(/^GJBT/i,'')
        .replace(/^BT/i,'')
        .replace(/^-/, '');
    }

    return s.slice(0,16);
  }

  function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
  }
})();
