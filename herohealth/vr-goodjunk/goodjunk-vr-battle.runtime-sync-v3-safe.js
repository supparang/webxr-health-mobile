/* =========================================================
   HeroHealth • GoodJunk Battle Runtime Sync v3 SAFE
   FILE: /herohealth/vr-goodjunk/goodjunk-vr-battle.runtime-sync-v3-safe.js
   PATCH: v20260514e-hostpid-url-lock-safe

   Fix:
   - KK / Guest ถูก runtime ตั้งเป็น host เอง
   - Host เห็น 1/2 ทั้งที่ Lobby มี 2 คน
   - Runtime เก่าเขียน role ผิดกลับเข้า Firebase
   - ลด loop listener -> update -> listener จน browser crash
   - ยึด Host จาก URL hostPid ที่ Lobby ส่งมาเป็นอันดับแรก
   ========================================================= */

(() => {
  'use strict';

  const PATCH_ID = 'v20260514e-hostpid-url-lock-safe';

  if (window.__GJ_BATTLE_RUNTIME_SYNC_V3_SAFE__) {
    console.info(
      '[GJ Battle Runtime Sync v3 Safe] already loaded:',
      window.__GJ_BATTLE_RUNTIME_SYNC_V3_SAFE__
    );
    return;
  }

  window.__GJ_BATTLE_RUNTIME_SYNC_V3_SAFE__ = PATCH_ID;

  const qs = new URLSearchParams(location.search);

  const ROOM = cleanRoom(qs.get('roomId') || qs.get('room') || '');
  const PID = clean(qs.get('pid') || '');
  const NAME = clean(qs.get('name') || qs.get('nick') || 'Player');
  const URL_MATCH = clean(qs.get('matchId') || '');

  const URL_HOST_PID = clean(
    qs.get('hostPid') ||
    qs.get('ownerPid') ||
    qs.get('leaderPid') ||
    ''
  );

  const URL_HOST_NAME = clean(qs.get('hostName') || '');

  const LOG = '[GJ Battle Runtime Sync v3 Safe]';
  const MIN_PLAYERS = 2;

  let db = null;
  let auth = null;

  let lastWriteSig = '';
  let lastRoleRepairSig = '';
  let lastHostRepairSig = '';
  let lastEventSig = '';

  let lastWriteAt = 0;
  let lastRoleRepairAt = 0;
  let lastHostRepairAt = 0;

  let pollTimer = null;

  boot();

  async function boot(){
    if (!ROOM){
      console.warn(LOG, 'missing room');
      return;
    }

    if (!PID){
      console.warn(LOG, 'missing pid in URL; role lock may be limited');
    }

    try{
      await waitForDb();

      console.info(LOG, 'loaded', {
        patch: PATCH_ID,
        room: ROOM,
        pid: PID,
        name: NAME,
        urlHostPid: URL_HOST_PID,
        urlHostName: URL_HOST_NAME,
        uid: auth?.currentUser?.uid || ''
      });

      await syncOnce('boot');
      listenRoom();

      pollTimer = setInterval(() => {
        syncOnce('poll').catch(err => {
          console.warn(LOG, 'poll failed', err);
        });
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

      syncWithRoom(room, 'listener').catch(err => {
        console.warn(LOG, 'listener failed', err);
      });
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

    await repairAuthoritativeHost(room, reason);

    const authoritativeHostPid = getAuthoritativeHostPid(room);

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
      Number(qs.get('expectedPlayers') || 0),
      Number(qs.get('participantCount') || 0),
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

    const role = trueRole(room, PID);

    fixUrlRole(role);
    patchVisibleRole(participants, role);

    const payload = {
      roomId: ROOM,
      matchId,
      hostPid: authoritativeHostPid,
      hostName: URL_HOST_NAME || room.hostName || '',
      participants,
      count,
      expected,
      role,
      status: clean(room.status || 'waiting'),
      phase: clean(room.phase || room.currentRun?.phase || '')
    };

    window.HHA_BATTLE_RUNTIME_PARTICIPANTS = payload;

    window.dispatchEvent(new CustomEvent('hha:battle:runtime-sync', {
      detail: payload
    }));

    document.dispatchEvent(new CustomEvent('hha:battle:runtime-sync', {
      detail: payload
    }));

    await repairMyRole(room, participants, role);
    await safeMirror(room, matchId, participants, count, expected, reason);

    const eventSig = JSON.stringify({
      status: payload.status,
      phase: payload.phase,
      count,
      expected,
      role,
      hostPid: authoritativeHostPid,
      players: Object.values(participants)
        .map(p => `${p.pid}:${p.role}:${p.name}`)
        .join('|')
    });

    if (eventSig !== lastEventSig){
      lastEventSig = eventSig;

      console.info(LOG, reason, {
        room: ROOM,
        matchId,
        status: payload.status,
        phase: payload.phase,
        count,
        expected,
        role,
        hostPid: authoritativeHostPid,
        players: Object.values(participants).map(p => `${p.name} • ${p.role}`)
      });
    }
  }

  function getAuthoritativeHostPid(room){
    return clean(
      URL_HOST_PID ||
      room?.hostPid ||
      room?.createdByPid ||
      room?.ownerPid ||
      room?.leaderPid ||
      ''
    );
  }

  function trueRole(room, pid){
    if (!pid) return 'guest';

    const hostPid = getAuthoritativeHostPid(room);

    if (!hostPid) return 'guest';

    return String(hostPid) === String(pid) ? 'host' : 'guest';
  }

  async function repairAuthoritativeHost(room, reason){
    const hostPid = getAuthoritativeHostPid(room);
    if (!hostPid) return;

    const updates = {};
    let need = false;

    if (room.hostPid !== hostPid){
      updates.hostPid = hostPid;
      need = true;
    }

    if (URL_HOST_NAME && room.hostName !== URL_HOST_NAME){
      updates.hostName = URL_HOST_NAME;
      need = true;
    }

    if (!need) return;

    const sig = JSON.stringify({
      hostPid,
      hostName: URL_HOST_NAME || '',
      roomHostPid: room.hostPid || '',
      roomHostName: room.hostName || ''
    });

    const t = Date.now();

    if (sig === lastHostRepairSig && (t - lastHostRepairAt) < 5000) return;

    lastHostRepairSig = sig;
    lastHostRepairAt = t;

    updates.updatedAt = t;
    updates.lastHostRepairAt = t;
    updates.lastHostRepairReason = reason || 'runtime-sync-v3-safe';

    await dbUpdate(roomPath(ROOM), updates).catch(err => {
      console.warn(LOG, 'repair authoritative host failed', err);
    });
  }

  function collectParticipants(room, match){
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

  function mergePlayers(out, raw, room, source){
    if (!raw || typeof raw !== 'object') return;

    Object.values(raw)
      .filter(Boolean)
      .forEach((p, index) => {
        const pid = clean(p.pid || p.id || p.playerId || '');
        if (!pid) return;

        const key = safeKey(pid);
        const role = trueRole(room, pid);

        out[key] = {
          ...out[key],
          ...p,

          pid,
          name: clean(
            p.name ||
            p.nick ||
            p.displayName ||
            out[key]?.name ||
            `Player ${index + 1}`
          ),
          nick: clean(
            p.nick ||
            p.name ||
            p.displayName ||
            out[key]?.nick ||
            `Player ${index + 1}`
          ),

          // สำคัญมาก:
          // ห้ามเชื่อ p.role === 'host' จากข้อมูลเก่าที่ runtime เคยเขียนผิด
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

  async function repairMyRole(room, participants, role){
    if (!PID) return;

    const key = safeKey(PID);
    const mine = participants[key];

    if (!mine) return;

    const current = room?.players?.[key] || {};

    const need =
      current.role !== role ||
      current.host !== (role === 'host') ||
      current.online !== true ||
      current.ready !== true;

    if (!need) return;

    const t = Date.now();

    const sig = JSON.stringify({
      pid: PID,
      role,
      host: role === 'host',
      name: mine.name || NAME,
      currentRole: current.role || '',
      currentHost: current.host
    });

    if (sig === lastRoleRepairSig && (t - lastRoleRepairAt) < 5000) return;

    lastRoleRepairSig = sig;
    lastRoleRepairAt = t;

    await dbUpdate(roomPath(ROOM), {
      [`players/${key}/pid`]: PID,
      [`players/${key}/name`]: mine.name || NAME,
      [`players/${key}/nick`]: mine.nick || mine.name || NAME,
      [`players/${key}/role`]: role,
      [`players/${key}/host`]: role === 'host',
      [`players/${key}/ready`]: true,
      [`players/${key}/online`]: true,
      [`players/${key}/lastSeen`]: t
    }).catch(err => {
      console.warn(LOG, 'repair role failed', err);
    });
  }

  async function safeMirror(room, matchId, participants, count, expected, reason){
    const t = Date.now();
    const cleanParticipants = cleanForWrite(participants);

    const writeSig = JSON.stringify({
      roomStatus: room.status || '',
      roomPhase: room.phase || room.currentRun?.phase || '',
      matchId,
      count,
      expected,
      hostPid: getAuthoritativeHostPid(room),
      players: Object.values(cleanParticipants)
        .map(p => `${p.pid}:${p.role}:${p.battleIndex}`)
        .join('|')
    });

    if (writeSig === lastWriteSig && (t - lastWriteAt) < 6000) return;

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

    const authoritativeHostPid = getAuthoritativeHostPid(room);
    if (authoritativeHostPid){
      roomUpdates.hostPid = authoritativeHostPid;
    }

    if (URL_HOST_NAME){
      roomUpdates.hostName = URL_HOST_NAME;
    }

    await dbUpdate(roomPath(ROOM), roomUpdates).catch(err => {
      console.warn(LOG, 'room mirror failed', err);
    });

    await dbUpdate(matchPath(ROOM, matchId), {
      matchId,
      roomId: ROOM,
      mode: 'battle',
      game: 'goodjunk',
      hostPid: authoritativeHostPid || room.hostPid || '',
      hostName: URL_HOST_NAME || room.hostName || '',
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

    Object.values(participants || {})
      .filter(Boolean)
      .forEach((p, index) => {
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

  function patchVisibleRole(participants, myRole){
    if (!document.body) return;

    const arr = Object.values(participants || {})
      .filter(Boolean)
      .sort((a,b) => Number(a.battleIndex || 0) - Number(b.battleIndex || 0));

    if (arr.length >= 2){
      const joined = arr
        .map(p => `${p.name || p.nick || 'Player'} • ${p.role || 'guest'}`)
        .join('  |  ');

      patchSimpleText(/(?:Hero|KK|Guest|Player)\s*•\s*host/g, joined);
      patchSimpleText(/(?:Hero|KK|Guest|Player)\s*•\s*guest/g, joined);
      patchSimpleText(/\b1\/2\b/g, `${arr.length}/${arr.length}`);
      patchSimpleText(/กำลังเตรียม Battle\s*\d+\/\d+/g, `กำลังเตรียม Battle ${arr.length}/${arr.length}`);
      patchSimpleText(/รอผู้เล่นอีก\s*\d+\s*คน/g, 'พร้อมเริ่ม Battle แล้ว');
      return;
    }

    if (myRole === 'guest'){
      patchSimpleText(/KK\s*•\s*host/g, 'KK • guest');
      patchSimpleText(/Guest\s*•\s*host/g, 'Guest • guest');
      patchSimpleText(/Player\s*•\s*host/g, 'Player • guest');
    }
  }

  function fixUrlRole(role){
    try{
      const u = new URL(location.href);

      u.searchParams.set('role', role);
      u.searchParams.set('host', role === 'host' ? '1' : '0');

      const hostPid = URL_HOST_PID || qs.get('hostPid') || '';
      if (hostPid) u.searchParams.set('hostPid', hostPid);
      if (URL_HOST_NAME) u.searchParams.set('hostName', URL_HOST_NAME);

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
