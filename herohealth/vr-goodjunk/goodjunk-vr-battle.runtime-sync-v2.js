/* =========================================================
   HeroHealth • GoodJunk Battle Runtime Sync v2
   FILE: /herohealth/vr-goodjunk/goodjunk-vr-battle.runtime-sync-v2.js
   PATCH: v20260514a

   Fix:
   - Runtime เห็น 1/2 ทั้งที่ Lobby มี 2/4
   - Runtime แสดง Guest เป็น host ซ้ำ
   - อ่านผู้เล่นจาก room.players / runtimePlayers / currentRun.participants / match.participants
   - เขียน activeCount / expectedPlayers / runtimePlayers กลับ Firebase
   - ถ้ามีผู้เล่น >= 2 แต่ status ยัง waiting ให้ host ดันเป็น started
   ========================================================= */

(() => {
  'use strict';

  const PATCH_ID = 'v20260514a-runtime-sync-v2';
  if (window.__GJ_BATTLE_RUNTIME_SYNC_V2__) return;
  window.__GJ_BATTLE_RUNTIME_SYNC_V2__ = PATCH_ID;

  const params = new URLSearchParams(location.search);

  const ROOM = cleanRoom(params.get('roomId') || params.get('room') || '');
  const PID = clean(params.get('pid') || '');
  const NAME = clean(params.get('name') || params.get('nick') || 'Player');
  const URL_MATCH = clean(params.get('matchId') || '');
  const MIN_PLAYERS = 2;

  const LOG = '[GJ Battle Runtime Sync v2]';

  let db = null;
  let timer = null;
  let forceStarted = false;

  boot();

  async function boot(){
    if (!ROOM){
      console.warn(LOG, 'no room in URL');
      return;
    }

    try{
      await waitForDb();

      console.info(LOG, 'loaded', {
        patch: PATCH_ID,
        room: ROOM,
        pid: PID,
        name: NAME
      });

      await syncOnce('boot');
      listenRoom();

      timer = setInterval(() => {
        syncOnce('poll').catch(err => console.warn(LOG, err));
      }, 900);

      window.addEventListener('pagehide', () => {
        if (timer) clearInterval(timer);
      });

    }catch(err){
      console.warn(LOG, 'boot failed', err);
    }
  }

  async function waitForDb(){
    for (let i = 0; i < 30; i++){
      if (window.HHA_FIREBASE_READY){
        const fb = await window.HHA_FIREBASE_READY;
        if (fb && fb.db){
          db = fb.db;
          return;
        }
      }

      if (window.firebase && firebase.database){
        db = firebase.database();
        return;
      }

      await sleep(250);
    }

    throw new Error('Firebase database not ready');
  }

  function listenRoom(){
    const ref = db.ref(roomPath(ROOM));

    ref.on('value', snap => {
      const room = snap && snap.val ? snap.val() : null;
      syncWithRoom(room, 'listener').catch(err => console.warn(LOG, err));
    });
  }

  async function syncOnce(reason){
    const room = await dbGet(roomPath(ROOM));
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

    const participants = collectAllPlayers(room, match);
    const keys = Object.keys(participants);
    const count = keys.length;

    const expected = Math.max(
      MIN_PLAYERS,
      Number(room.expectedPlayers || 0),
      Number(room.currentRun?.expectedPlayers || 0),
      Number(match?.expectedPlayers || 0),
      count
    );

    const myKey = PID ? safeKey(PID) : '';
    const myData = myKey ? participants[myKey] : null;
    const realRole =
      myData?.role ||
      (PID && room.hostPid === PID ? 'host' : 'guest');

    fixUrlRole(realRole);
    patchVisibleWaiting({ count, expected, participants });

    await writeMirror({
      room,
      matchId,
      participants,
      count,
      expected,
      reason
    });

    const status = clean(room.status || '').toLowerCase();
    const iAmHost = PID && room.hostPid === PID;

    if (
      iAmHost &&
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

    window.HHA_BATTLE_RUNTIME_PARTICIPANTS = {
      roomId: ROOM,
      matchId,
      participants,
      count,
      expected,
      role: realRole
    };

    window.dispatchEvent(new CustomEvent('hha:battle:runtime-sync', {
      detail: window.HHA_BATTLE_RUNTIME_PARTICIPANTS
    }));

    console.info(LOG, reason, {
      room: ROOM,
      matchId,
      status,
      count,
      expected,
      players: Object.values(participants).map(p => `${p.name} • ${p.role}`)
    });
  }

  function collectAllPlayers(room, match){
    const out = {};

    mergePlayers(out, room?.players, room);
    mergePlayers(out, room?.runtimePlayers, room);
    mergePlayers(out, room?.activePlayers, room);
    mergePlayers(out, room?.currentRun?.participants, room);
    mergePlayers(out, room?.currentRun?.runtimePlayers, room);
    mergePlayers(out, room?.currentRun?.activePlayers, room);

    mergePlayers(out, match?.participants, room);
    mergePlayers(out, match?.runtimePlayers, room);
    mergePlayers(out, match?.activePlayers, room);
    mergePlayers(out, match?.players, room);

    if (PID && !out[safeKey(PID)]){
      out[safeKey(PID)] = {
        pid: PID,
        name: NAME,
        nick: NAME,
        role: room?.hostPid === PID ? 'host' : 'guest',
        ready: true,
        online: true,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
        source: 'runtime-url'
      };
    }

    return out;
  }

  function mergePlayers(out, raw, room){
    if (!raw || typeof raw !== 'object') return;

    Object.values(raw).filter(Boolean).forEach((p, index) => {
      const pid = clean(p.pid || p.id || p.playerId || '');
      if (!pid) return;

      const key = safeKey(pid);
      const isHost =
        pid === room?.hostPid ||
        p.role === 'host' ||
        p.host === true ||
        p.host === '1';

      out[key] = {
        ...out[key],
        ...p,
        pid,
        name: clean(p.name || p.nick || p.displayName || out[key]?.name || `Player ${index + 1}`),
        nick: clean(p.nick || p.name || p.displayName || out[key]?.nick || `Player ${index + 1}`),
        role: isHost ? 'host' : 'guest',
        ready: p.ready !== false,
        online: p.online !== false,
        joinedAt: Number(p.joinedAt || out[key]?.joinedAt || Date.now()),
        lastSeen: Date.now(),
        battleIndex: Number(p.battleIndex || out[key]?.battleIndex || index + 1)
      };
    });
  }

  async function writeMirror({ matchId, participants, count, expected, reason }){
    const t = Date.now();

    const roomUpdate = {
      activeCount: count,
      expectedPlayers: expected,
      participantCount: count,
      runtimePlayers: participants,
      activePlayers: participants,
      updatedAt: t,
      lastRuntimeSyncAt: t,
      lastRuntimeSyncReason: reason
    };

    roomUpdate['currentRun/matchId'] = matchId;
    roomUpdate['currentRun/expectedPlayers'] = expected;
    roomUpdate['currentRun/participantCount'] = count;
    roomUpdate['currentRun/participants'] = participants;
    roomUpdate['currentRun/runtimePlayers'] = participants;
    roomUpdate['currentRun/activePlayers'] = participants;
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
      participants,
      runtimePlayers: participants,
      activePlayers: participants,
      updatedAt: t,
      lastRuntimeSyncAt: t,
      lastRuntimeSyncReason: reason
    }).catch(err => {
      console.warn(LOG, 'match mirror failed', err);
    });
  }

  async function forceStart({ matchId, participants, count, expected, reason }){
    const t = Date.now();

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
      runtimePlayers: participants,
      activePlayers: participants,
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
      'currentRun/participants': participants,
      'currentRun/runtimePlayers': participants,
      'currentRun/activePlayers': participants,
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
      participants,
      runtimePlayers: participants,
      activePlayers: participants,
      startedAt: t,
      updatedAt: t,
      forceStartedAt: t,
      forceStartedBy: PID || 'runtime-sync-v2'
    });
  }

  function patchVisibleWaiting({ count, expected, participants }){
    const c = Math.max(1, Number(count || 1));
    const e = Math.max(2, Number(expected || 2));

    replaceText(/\b1\/2\b/g, `${c}/${e}`);
    replaceText(/กำลังเตรียม Battle\s*\d+\/\d+/g, `กำลังเตรียม Battle ${c}/${e}`);

    if (c >= e){
      replaceText(/รอผู้เล่นอีก\s*\d+\s*คน/g, 'พร้อมเริ่ม Battle แล้ว');
    }else{
      replaceText(/รอผู้เล่นอีก\s*\d+\s*คน/g, `รอผู้เล่นอีก ${Math.max(0, e - c)} คน`);
    }

    const names = Object.values(participants || {})
      .map(p => `${p.name || p.nick || 'Player'} • ${p.role || 'guest'}`)
      .join('  |  ');

    if (names && c >= 2){
      replaceText(/(?:Hero|KK|Guest|Player)\s*•\s*host/g, names);
      replaceText(/(?:Hero|KK|Guest|Player)\s*•\s*guest/g, names);
    }
  }

  function replaceText(pattern, replacement){
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

  function fixUrlRole(realRole){
    try{
      const u = new URL(location.href);

      if (realRole === 'host'){
        u.searchParams.set('role', 'host');
        u.searchParams.set('host', '1');
      }else{
        u.searchParams.set('role', 'guest');
        u.searchParams.set('host', '0');
      }

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
