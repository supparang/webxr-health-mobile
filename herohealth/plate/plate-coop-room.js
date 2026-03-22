/* === /herohealth/plate/plate-coop-room.js ===
   HeroHealth Plate Coop Room API
   ADAPTER-FIRST ROOM LIFECYCLE
   PATCH v20260321-PLATE-COOP-ROOM
*/
'use strict';

function clamp(v, a, b){
  v = Number(v);
  if (!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
}

function nowTs(){
  return Date.now();
}

function deepClone(obj){
  return JSON.parse(JSON.stringify(obj));
}

function noop(){}

function makeRoomCode(prefix = 'PLT'){
  const body = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}${body}`;
}

function buildInitialRoomState({
  roomId,
  hostId,
  game = 'platev1',
  mode = 'coop',
  diff = 'normal',
  pro = false,
  time = 90,
  seed = String(Date.now())
} = {}){
  return {
    roomId: String(roomId || makeRoomCode('PLT')).trim().toUpperCase(),
    game: String(game || 'platev1'),
    mode: String(mode || 'coop'),

    hostId: String(hostId || ''),
    started: false,
    ended: false,

    players: {
      A: {
        id: String(hostId || ''),
        ready: false,
        connected: !!hostId,
        joinedAt: hostId ? nowTs() : 0
      },
      B: {
        id: '',
        ready: false,
        connected: false,
        joinedAt: 0
      }
    },

    config: {
      diff: String(diff || 'normal'),
      pro: !!pro,
      time: clamp(time, 30, 300),
      seed: String(seed || Date.now())
    },

    match: null,
    summary: null,
    updatedAt: nowTs()
  };
}

const __MEM_ROOM_DB__ = {
  rooms: new Map(),
  listeners: new Map()
};

function emitRoom(roomId){
  const id = String(roomId || '').trim().toUpperCase();
  const room = __MEM_ROOM_DB__.rooms.get(id) || null;
  const set = __MEM_ROOM_DB__.listeners.get(id);
  if (!set) return;

  for (const fn of set){
    try{
      fn(room ? deepClone(room) : null);
    }catch(_){}
  }
}

export function createMemoryRoomAdapter(){
  return {
    async getRoom(roomId){
      const id = String(roomId || '').trim().toUpperCase();
      const room = __MEM_ROOM_DB__.rooms.get(id) || null;
      return room ? deepClone(room) : null;
    },

    async setRoom(roomId, roomState){
      const id = String(roomId || '').trim().toUpperCase();
      __MEM_ROOM_DB__.rooms.set(id, deepClone(roomState));
      emitRoom(id);
    },

    async patchRoom(roomId, partial){
      const id = String(roomId || '').trim().toUpperCase();
      const prev = __MEM_ROOM_DB__.rooms.get(id);
      if (!prev) throw new Error(`Room not found: ${id}`);

      const next = {
        ...prev,
        ...deepClone(partial),
        updatedAt: nowTs()
      };

      if (partial.players){
        next.players = {
          ...prev.players,
          ...deepClone(partial.players)
        };
        if (partial.players.A){
          next.players.A = {
            ...prev.players.A,
            ...deepClone(partial.players.A)
          };
        }
        if (partial.players.B){
          next.players.B = {
            ...prev.players.B,
            ...deepClone(partial.players.B)
          };
        }
      }

      if (partial.config){
        next.config = {
          ...prev.config,
          ...deepClone(partial.config)
        };
      }

      if (partial.match && prev.match){
        next.match = {
          ...prev.match,
          ...deepClone(partial.match)
        };
      }

      __MEM_ROOM_DB__.rooms.set(id, next);
      emitRoom(id);
    },

    subscribeRoom(roomId, cb){
      const id = String(roomId || '').trim().toUpperCase();

      if (!__MEM_ROOM_DB__.listeners.has(id)){
        __MEM_ROOM_DB__.listeners.set(id, new Set());
      }
      const set = __MEM_ROOM_DB__.listeners.get(id);
      set.add(cb);

      queueMicrotask(() => {
        try{
          const room = __MEM_ROOM_DB__.rooms.get(id) || null;
          cb(room ? deepClone(room) : null);
        }catch(_){}
      });

      return () => {
        try{ set.delete(cb); }catch(_){}
      };
    },

    async deleteRoom(roomId){
      const id = String(roomId || '').trim().toUpperCase();
      __MEM_ROOM_DB__.rooms.delete(id);
      emitRoom(id);
      __MEM_ROOM_DB__.listeners.delete(id);
    }
  };
}

export function createPlateCoopRoomApi({
  adapter = createMemoryRoomAdapter(),
  playerId = `p-${Math.random().toString(36).slice(2, 10)}`,
  game = 'platev1',
  mode = 'coop'
} = {}){
  let currentRoomId = '';
  let unsubscribe = noop;

  function ensureRoomId(){
    const id = String(currentRoomId || '').trim().toUpperCase();
    if (!id) throw new Error('No active room');
    return id;
  }

  async function createRoom({
    diff = 'normal',
    pro = false,
    time = 90,
    seed = String(Date.now()),
    roomId
  } = {}){
    const id = String(roomId || makeRoomCode('PLT')).trim().toUpperCase();

    const room = buildInitialRoomState({
      roomId: id,
      hostId: playerId,
      game,
      mode,
      diff,
      pro,
      time,
      seed
    });

    await adapter.setRoom(id, room);
    currentRoomId = id;
    return deepClone(room);
  }

  async function joinRoom(roomId){
    const id = String(roomId || '').trim().toUpperCase();
    if (!id) throw new Error('Room code is required');

    const room = await adapter.getRoom(id);
    if (!room) throw new Error(`Room not found: ${id}`);
    if (room.started) throw new Error('Room already started');

    const A = room.players?.A || {};
    const B = room.players?.B || {};

    let role = '';

    if (A.id === playerId){
      role = 'A';
      room.players.A.connected = true;
    } else if (B.id === playerId){
      role = 'B';
      room.players.B.connected = true;
    } else if (!A.id){
      role = 'A';
      room.players.A = {
        id: playerId,
        ready: false,
        connected: true,
        joinedAt: nowTs()
      };
      if (!room.hostId) room.hostId = playerId;
    } else if (!B.id){
      role = 'B';
      room.players.B = {
        id: playerId,
        ready: false,
        connected: true,
        joinedAt: nowTs()
      };
    } else {
      throw new Error('Room is full');
    }

    room.updatedAt = nowTs();
    await adapter.setRoom(id, room);
    currentRoomId = id;

    return {
      room: deepClone(room),
      role
    };
  }

  async function getRoom(roomId = currentRoomId){
    const id = String(roomId || '').trim().toUpperCase();
    if (!id) return null;
    return adapter.getRoom(id);
  }

  async function leaveRoom(roomId = currentRoomId){
    const id = String(roomId || '').trim().toUpperCase();
    if (!id) return;

    const room = await adapter.getRoom(id);
    if (!room) return;

    const isA = room.players?.A?.id === playerId;
    const isB = room.players?.B?.id === playerId;

    if (isA){
      room.players.A = {
        id: '',
        ready: false,
        connected: false,
        joinedAt: 0
      };

      if (room.players?.B?.id){
        room.hostId = room.players.B.id;
        room.players.A = { ...room.players.B };
        room.players.B = {
          id: '',
          ready: false,
          connected: false,
          joinedAt: 0
        };
      } else {
        room.hostId = '';
      }
    } else if (isB){
      room.players.B = {
        id: '',
        ready: false,
        connected: false,
        joinedAt: 0
      };
    }

    room.updatedAt = nowTs();

    const hasA = !!room.players?.A?.id;
    const hasB = !!room.players?.B?.id;

    if (!hasA && !hasB){
      if (typeof adapter.deleteRoom === 'function'){
        await adapter.deleteRoom(id);
      } else {
        room.ended = true;
        await adapter.setRoom(id, room);
      }
    } else {
      await adapter.setRoom(id, room);
    }

    if (currentRoomId === id){
      currentRoomId = '';
    }
  }

  async function markReady(ready = true, roomId = currentRoomId){
    const id = String(roomId || '').trim().toUpperCase();
    if (!id) throw new Error('No room selected');

    const room = await adapter.getRoom(id);
    if (!room) throw new Error(`Room not found: ${id}`);
    if (room.started) throw new Error('Match already started');

    if (room.players?.A?.id === playerId){
      room.players.A.ready = !!ready;
      room.players.A.connected = true;
    } else if (room.players?.B?.id === playerId){
      room.players.B.ready = !!ready;
      room.players.B.connected = true;
    } else {
      throw new Error('Player is not in this room');
    }

    room.updatedAt = nowTs();
    await adapter.setRoom(id, room);
    return deepClone(room);
  }

  async function hostStart(roomId = currentRoomId){
    const id = String(roomId || '').trim().toUpperCase();
    if (!id) throw new Error('No room selected');

    const room = await adapter.getRoom(id);
    if (!room) throw new Error(`Room not found: ${id}`);
    if (room.hostId !== playerId) throw new Error('Only host can start');
    if (!room.players?.A?.id || !room.players?.B?.id) throw new Error('Need 2 players');
    if (!room.players?.A?.ready || !room.players?.B?.ready) throw new Error('Both players must be ready');

    room.started = true;
    room.ended = false;
    room.updatedAt = nowTs();

    await adapter.setRoom(id, room);
    return deepClone(room);
  }

  async function hostEnd(summary, roomId = currentRoomId){
    const id = String(roomId || '').trim().toUpperCase();
    if (!id) throw new Error('No room selected');

    const room = await adapter.getRoom(id);
    if (!room) throw new Error(`Room not found: ${id}`);
    if (room.hostId !== playerId) throw new Error('Only host can end room');

    room.ended = true;
    room.summary = deepClone(summary || null);
    room.updatedAt = nowTs();

    await adapter.setRoom(id, room);
    return deepClone(room);
  }

  async function patchMatch(matchPatch = {}, roomId = currentRoomId){
    const id = ensureRoomId();
    const room = await adapter.getRoom(id);
    if (!room) throw new Error(`Room not found: ${id}`);
    if (room.hostId !== playerId) throw new Error('Only host can patch match state');

    const next = {
      ...room,
      match: {
        ...(room.match || {}),
        ...deepClone(matchPatch)
      },
      updatedAt: nowTs()
    };

    await adapter.setRoom(id, next);
    return deepClone(next);
  }

  function subscribeRoom(roomId, cb){
    const id = String(roomId || currentRoomId || '').trim().toUpperCase();
    if (!id) throw new Error('Room code is required for subscribe');

    try{ unsubscribe(); }catch(_){}
    unsubscribe = adapter.subscribeRoom(id, (roomState) => {
      try{
        cb?.(roomState ? deepClone(roomState) : null);
      }catch(_){}
    });

    currentRoomId = id;

    return () => {
      try{ unsubscribe(); }catch(_){}
      unsubscribe = noop;
    };
  }

  function getJoinUrl(roomId, pageUrl = location.href){
    const u = new URL(pageUrl, location.href);
    u.searchParams.set('room', String(roomId || currentRoomId || '').trim().toUpperCase());
    u.searchParams.set('mode', 'coop');
    return u.toString();
  }

  return {
    playerId,
    get currentRoomId(){ return currentRoomId; },

    createRoom,
    joinRoom,
    getRoom,
    leaveRoom,
    markReady,
    hostStart,
    hostEnd,
    patchMatch,
    subscribeRoom,
    getJoinUrl
  };
}