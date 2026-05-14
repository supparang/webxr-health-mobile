/* =========================================================
   HeroHealth • GoodJunk Battle Runtime Participants Fix
   FILE: /herohealth/vr-goodjunk/goodjunk-vr-battle.participants-fix.js
   PATCH: v20260513-battle-runtime-participants-v1

   เป้าหมาย:
   - แก้ runtime goodjunk-vr-battle.html ยังเห็น 1/2 ทั้งที่ Lobby มี 2/4
   - อ่านผู้เล่นจากหลาย path:
     room.runtimePlayers
     room.currentRun.participants
     match.participants
     match.runtimePlayers
     room.players
   - เขียน activePlayers / activeCount กลับไปให้ runtime เดิมอ่านได้
   - ถ้า Host อยู่ใน runtime และมีผู้เล่น >= 2 แต่ status ยัง waiting
     ให้ยกสถานะเป็น started แบบปลอดภัย
   ========================================================= */

(() => {
  'use strict';

  const PATCH_ID = 'v20260513-battle-runtime-participants-v1';

  if (window.__GJ_BATTLE_PARTICIPANTS_FIX__) return;
  window.__GJ_BATTLE_PARTICIPANTS_FIX__ = PATCH_ID;

  const qs = new URLSearchParams(location.search);

  const ROOM =
    cleanRoom(qs.get('roomId') || qs.get('room') || '');

  const MATCH_ID =
    clean(qs.get('matchId') || '') ||
    `${ROOM}-R1`;

  const PID =
    clean(qs.get('pid') || '') ||
    makeFallbackPid();

  const NAME =
    clean(qs.get('name') || qs.get('nick') || '') ||
    'Hero';

  const ROLE =
    clean(qs.get('role') || '') ||
    (qs.get('host') === '1' ? 'host' : 'guest');

  const IS_HOST =
    qs.get('host') === '1' ||
    ROLE === 'host';

  const MIN_PLAYERS = Math.max(2, Number(qs.get('minPlayers') || 2));

  const LOG_PREFIX = '[GoodJunk Battle Participants Fix]';

  let db = null;
  let lastCount = 0;
  let lastStarted = false;
  let booted = false;
  let pollTimer = null;

  console.info(`${LOG_PREFIX} loaded`, {
    patch: PATCH_ID,
    room: ROOM,
    matchId: MATCH_ID,
    pid: PID,
    name: NAME,
    role: ROLE,
    isHost: IS_HOST
  });

  boot();

  async function boot(){
    if (booted) return;
    booted = true;

    if (!ROOM){
      console.warn(`${LOG_PREFIX} no room found in URL`);
      return;
    }

    try{
      await firebaseReady();
      await repairOnce('boot');

      listenRoom();

      pollTimer = setInterval(() => {
        repairOnce('poll').catch(err => {
          console.warn(`${LOG_PREFIX} poll error`, err);
        });
      }, 1200);

      window.addEventListener('pagehide', () => {
        if (pollTimer) clearInterval(pollTimer);
      });

    }catch(err){
      console.warn(`${LOG_PREFIX} boot error`, err);
    }
  }

  async function firebaseReady(){
    if (window.HHA_FIREBASE_READY){
      const fb = await window.HHA_FIREBASE_READY;
      if (fb && fb.db){
        db = fb.db;
        return fb;
      }
    }

    if (window.firebase && firebase.database){
      db = firebase.database();
      return { db };
    }

    await wait(500);

    if (window.HHA_FIREBASE_READY){
      const fb = await window.HHA_FIREBASE_READY;
      if (fb && fb.db){
        db = fb.db;
        return fb;
      }
    }

    if (window.firebase && firebase.database){
      db = firebase.database();
      return { db };
    }

    throw new Error('Firebase DB not ready');
  }

  function listenRoom(){
    const ref = db.ref(roomPath(ROOM));

    ref.on('value', snap => {
      const room = snap && snap.val ? snap.val() : null;

      repairWithRoom(room, 'listener').catch(err => {
        console.warn(`${LOG_PREFIX} listener repair error`, err);
      });
    });
  }

  async function repairOnce(reason){
    const room = await dbGet(roomPath(ROOM));
    await repairWithRoom(room, reason);
  }

  async function repairWithRoom(room, reason){
    if (!room){
      console.warn(`${LOG_PREFIX} room not found`, ROOM);
      updateWaitingUI({
        count:1,
        expected:MIN_PLAYERS,
        players:[{ name:NAME, role:ROLE }]
      });
      return;
    }

    const matchId =
      clean(qs.get('matchId') || '') ||
      clean(room.activeMatchId || '') ||
      clean(room.currentRun?.matchId || '') ||
      MATCH_ID;

    let match = null;
    if (matchId){
      match = await dbGet(matchPath(ROOM, matchId)).catch(() => null);
    }

    let participants = collectParticipants(room, match);

    if (!participants || !Object.keys(participants).length){
      participants = {};
    }

    const myKey = safeKey(PID);

    if (!participants[myKey]){
      participants[myKey] = {
        pid: PID,
        name: NAME,
        nick: NAME,
        role: IS_HOST ? 'host' : 'guest',
        ready: true,
        online: true,
        joinedAt: now(),
        lastSeen: now(),
        source: 'runtime-self'
      };
    }

    participants = normalizeParticipants(participants, room);

    const count = Object.keys(participants).length;
    const expected =
      Number(room.expectedPlayers || room.currentRun?.expectedPlayers || match?.expectedPlayers || count || MIN_PLAYERS) || MIN_PLAYERS;

    const status = clean(room.status || 'waiting').toLowerCase();

    lastCount = count;

    updateWaitingUI({
      count,
      expected: Math.max(MIN_PLAYERS, expected),
      players: Object.values(participants)
    });

    await writeRuntimeMirror({
      room,
      match,
      matchId,
      participants,
      count,
      expected,
      status,
      reason
    });

    const shouldStart =
      IS_HOST &&
      count >= MIN_PLAYERS &&
      (status === 'waiting' || status === 'ready' || !status);

    if (shouldStart && !lastStarted){
      lastStarted = true;
      await forceStart({
        room,
        matchId,
        participants,
        count,
        expected,
        reason
      });
    }

    dispatchParticipantsEvent({
      room,
      match,
      matchId,
      participants,
      count,
      expected,
      status
    });

    console.info(`${LOG_PREFIX} repair ${reason}`, {
      room: ROOM,
      matchId,
      status,
      count,
      expected,
      players: Object.values(participants).map(p => `${p.name || p.nick || p.pid} • ${p.role || 'guest'}`)
    });
  }

  function collectParticipants(room, match){
    return firstNonEmptyObject(
      room?.runtimePlayers,
      room?.currentRun?.participants,
      match?.participants,
      match?.runtimePlayers,
      room?.players,
      room?.currentRun?.runtimePlayers,
      match?.players,
      {}
    );
  }

  function firstNonEmptyObject(...items){
    for (const item of items){
      if (item && typeof item === 'object' && Object.keys(item).length){
        return structuredCloneSafe(item);
      }
    }
    return {};
  }

  function normalizeParticipants(raw, room){
    const out = {};
    const list = Object.values(raw || {}).filter(Boolean);

    list.forEach((p, index) => {
      const pid = clean(p.pid || p.id || p.playerId || `player-${index + 1}`);
      const key = safeKey(pid);

      const isHost =
        pid === room?.hostPid ||
        p.role === 'host' ||
        p.host === true ||
        p.host === '1';

      out[key] = {
        pid,
        name: clean(p.name || p.nick || p.displayName || `Player ${index + 1}`),
        nick: clean(p.nick || p.name || p.displayName || `Player ${index + 1}`),
        role: isHost ? 'host' : 'guest',
        ready: p.ready !== false,
        online: p.online !== false,
        joinedAt: Number(p.joinedAt || p.createdAt || now()),
        lastSeen: now(),
        battleIndex: Number(p.battleIndex || index + 1),
        source: p.source || 'normalized'
      };
    });

    return out;
  }

  async function writeRuntimeMirror(ctx){
    const {
      matchId,
      participants,
      count,
      expected,
      reason
    } = ctx;

    const t = now();

    const roomUpdates = {
      activeCount: count,
      expectedPlayers: expected,
      participantCount: count,
      runtimePlayers: participants,
      activePlayers: participants,
      updatedAt: t,
      lastRuntimeSyncAt: t,
      lastRuntimeSyncReason: reason
    };

    if (matchId){
      roomUpdates.activeMatchId = matchId;
      roomUpdates['currentRun/matchId'] = matchId;
      roomUpdates['currentRun/expectedPlayers'] = expected;
      roomUpdates['currentRun/participantCount'] = count;
      roomUpdates['currentRun/participants'] = participants;
      roomUpdates['currentRun/runtimePlayers'] = participants;
      roomUpdates['currentRun/activePlayers'] = participants;
      roomUpdates['currentRun/activeCount'] = count;
    }

    await dbUpdate(roomPath(ROOM), roomUpdates).catch(err => {
      console.warn(`${LOG_PREFIX} write room mirror failed`, err);
    });

    if (matchId){
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
        console.warn(`${LOG_PREFIX} write match mirror failed`, err);
      });
    }
  }

  async function forceStart(ctx){
    const {
      matchId,
      participants,
      count,
      expected,
      reason
    } = ctx;

    const t = now();

    console.warn(`${LOG_PREFIX} forceStart`, {
      room: ROOM,
      matchId,
      count,
      expected,
      reason
    });

    const roomUpdate = {
      status: 'started',
      activeCount: count,
      expectedPlayers: expected,
      participantCount: count,
      runtimePlayers: participants,
      activePlayers: participants,
      updatedAt: t,
      forceStartedAt: t,
      forceStartedBy: PID,
      forceStartReason: reason,
      'currentRun/status': 'started',
      'currentRun/matchId': matchId,
      'currentRun/startedAt': t,
      'currentRun/by': PID,
      'currentRun/expectedPlayers': expected,
      'currentRun/participantCount': count,
      'currentRun/participants': participants,
      'currentRun/runtimePlayers': participants,
      'currentRun/activePlayers': participants,
      'currentRun/activeCount': count
    };

    await dbUpdate(roomPath(ROOM), roomUpdate);

    if (matchId){
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
        forceStartedBy: PID
      });
    }

    window.dispatchEvent(new CustomEvent('hha:battle:force-start', {
      detail:{
        roomId: ROOM,
        matchId,
        participants,
        count,
        expected
      }
    }));
  }

  function updateWaitingUI({ count, expected, players }){
    const safeExpected = Math.max(MIN_PLAYERS, Number(expected || MIN_PLAYERS));
    const safeCount = Math.max(1, Number(count || 1));

    replaceVisibleText(/\b1\/2\b/g, `${safeCount}/${safeExpected}`);
    replaceVisibleText(/รอผู้เล่นอีก\s*1\s*คน/g, safeCount >= safeExpected ? 'พร้อมเริ่ม Battle แล้ว' : `รอผู้เล่นอีก ${Math.max(0, safeExpected - safeCount)} คน`);
    replaceVisibleText(/กำลังเตรียม Battle\s*1\/2/g, `กำลังเตรียม Battle ${safeCount}/${safeExpected}`);

    const names = (players || [])
      .map(p => `${p.name || p.nick || 'Player'} • ${p.role || 'guest'}`)
      .join('  |  ');

    if (names){
      const el = findTextElement('Hero • host') || findTextElement('KK • host') || null;
      if (el && safeCount >= 2){
        el.textContent = names;
      }
    }
  }

  function replaceVisibleText(pattern, replacement){
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node){
          const text = node.nodeValue || '';
          if (!text.trim()) return NodeFilter.FILTER_REJECT;
          if (!pattern.test(text)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(node => {
      node.nodeValue = String(node.nodeValue || '').replace(pattern, replacement);
    });
  }

  function findTextElement(text){
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );

    while (walker.nextNode()){
      const node = walker.currentNode;
      if (String(node.nodeValue || '').includes(text)){
        return node.parentElement || null;
      }
    }

    return null;
  }

  function dispatchParticipantsEvent(payload){
    window.HHA_BATTLE_PARTICIPANTS = payload;

    window.dispatchEvent(new CustomEvent('hha:battle:participants-ready', {
      detail: payload
    }));

    document.dispatchEvent(new CustomEvent('hha:battle:participants-ready', {
      detail: payload
    }));
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

  function clean(v){
    return String(v ?? '').trim();
  }

  function cleanRoom(v){
    let s = clean(v).toUpperCase();
    s = s.replace(/\s+/g,'').replace(/[^A-Z0-9-]/g,'');

    if (!s) return '';

    if (!s.startsWith('GJ-BT-')) {
      s = 'GJ-BT-' + s
        .replace(/^GJ-BT/i,'')
        .replace(/^GJBT/i,'')
        .replace(/^BT/i,'')
        .replace(/^-/, '');
    }

    return s.slice(0,16);
  }

  function safeKey(raw){
    return String(raw || '')
      .trim()
      .replace(/[.#$/\[\]]/g,'_')
      .slice(0,96) || 'key';
  }

  function makeFallbackPid(){
    try{
      let pid = sessionStorage.getItem('HHA_GJ_BATTLE_RUNTIME_PID');
      if (!pid){
        pid = 'runtime-' + Math.random().toString(36).slice(2,8).toUpperCase();
        sessionStorage.setItem('HHA_GJ_BATTLE_RUNTIME_PID', pid);
      }
      return pid;
    }catch(_){
      return 'runtime-' + Math.random().toString(36).slice(2,8).toUpperCase();
    }
  }

  function structuredCloneSafe(obj){
    try{
      return structuredClone(obj);
    }catch(_){
      return JSON.parse(JSON.stringify(obj || {}));
    }
  }

  function wait(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
  }
})();
