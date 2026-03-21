/* === /herohealth/plate/plate-coop-net.js ===
   HeroHealth Plate Coop Net API
   HOST-AUTHORITATIVE SKELETON
   PATCH v20260321-PLATE-COOP-NET-SKELETON

   Purpose:
   - publish authoritative room state
   - subscribe authoritative room state
   - publish player action events
   - subscribe player action events

   Design:
   - state channel = host -> all
   - action channel = clients -> host
   - adapter-first, backend-agnostic
*/

'use strict';

/* --------------------------------------------------
 * helpers
 * -------------------------------------------------- */
function nowTs(){
  return Date.now();
}

function deepClone(obj){
  return JSON.parse(JSON.stringify(obj));
}

function makeEventId(prefix = 'evt'){
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
}

function noop(){}

/* --------------------------------------------------
 * default in-memory adapter
 * --------------------------------------------------
 * This adapter is local-only and NOT cross-device.
 * Replace later with Firebase / Supabase / WebSocket.
 * -------------------------------------------------- */
const __MEM_NET_DB__ = {
  states: new Map(),      // roomId -> latest state
  actions: new Map(),     // roomId -> [events]
  stateListeners: new Map(),   // roomId -> Set(fn)
  actionListeners: new Map()   // roomId -> Set(fn)
};

function emitState(roomId){
  const id = String(roomId || '');
  const state = __MEM_NET_DB__.states.get(id) || null;
  const listeners = __MEM_NET_DB__.stateListeners.get(id);
  if (!listeners) return;
  for (const fn of listeners){
    try{ fn(deepClone(state)); }catch(_){}
  }
}

function emitAction(roomId, action){
  const id = String(roomId || '');
  const listeners = __MEM_NET_DB__.actionListeners.get(id);
  if (!listeners) return;
  for (const fn of listeners){
    try{ fn(deepClone(action)); }catch(_){}
  }
}

export function createMemoryNetAdapter(){
  return {
    async publishState(roomId, state){
      const id = String(roomId || '');
      __MEM_NET_DB__.states.set(id, deepClone(state));
      emitState(id);
    },

    async getState(roomId){
      const id = String(roomId || '');
      const state = __MEM_NET_DB__.states.get(id) || null;
      return state ? deepClone(state) : null;
    },

    subscribeState(roomId, cb){
      const id = String(roomId || '');
      if (!__MEM_NET_DB__.stateListeners.has(id)){
        __MEM_NET_DB__.stateListeners.set(id, new Set());
      }
      const set = __MEM_NET_DB__.stateListeners.get(id);
      set.add(cb);

      queueMicrotask(() => {
        try{
          const state = __MEM_NET_DB__.states.get(id) || null;
          cb(deepClone(state));
        }catch(_){}
      });

      return () => {
        try{ set.delete(cb); }catch(_){}
      };
    },

    async publishAction(roomId, action){
      const id = String(roomId || '');
      if (!__MEM_NET_DB__.actions.has(id)){
        __MEM_NET_DB__.actions.set(id, []);
      }
      const arr = __MEM_NET_DB__.actions.get(id);
      arr.push(deepClone(action));
      emitAction(id, action);
    },

    subscribeActions(roomId, cb){
      const id = String(roomId || '');
      if (!__MEM_NET_DB__.actionListeners.has(id)){
        __MEM_NET_DB__.actionListeners.set(id, new Set());
      }
      const set = __MEM_NET_DB__.actionListeners.get(id);
      set.add(cb);

      return () => {
        try{ set.delete(cb); }catch(_){}
      };
    },

    async clearRoom(roomId){
      const id = String(roomId || '');
      __MEM_NET_DB__.states.delete(id);
      __MEM_NET_DB__.actions.delete(id);
    }
  };
}

/* --------------------------------------------------
 * action/event schema
 * --------------------------------------------------
 * Suggested action types:
 * - PLAYER_READY
 * - PLAYER_HIT
 * - PLAYER_MISS
 * - PLAYER_LEAVE
 * - PLAYER_PING
 * - HOST_START
 *
 * Suggested state source:
 * - MATCH_START
 * - HOST_TICK
 * - PHASE_CHANGE
 * - TARGET_HIT
 * - MATCH_END
 * -------------------------------------------------- */

function normalizeAction(action = {}, {
  roomId = '',
  playerId = '',
  role = '',
  game = 'platev1',
  mode = 'coop'
} = {}){
  return {
    id: action.id || makeEventId('act'),
    type: String(action.type || 'UNKNOWN'),
    roomId: String(action.roomId || roomId || '').trim().toUpperCase(),
    game: String(action.game || game),
    mode: String(action.mode || mode),
    playerId: String(action.playerId || playerId || ''),
    role: String(action.role || role || ''),
    payload: deepClone(action.payload || {}),
    createdAt: Number(action.createdAt || nowTs())
  };
}

function normalizeState(state = {}, {
  roomId = '',
  hostId = '',
  game = 'platev1',
  mode = 'coop'
} = {}){
  return {
    roomId: String(state.roomId || roomId || '').trim().toUpperCase(),
    hostId: String(state.hostId || hostId || ''),
    game: String(state.game || game),
    mode: String(state.mode || mode),
    source: String(state.source || 'STATE_UPDATE'),
    started: !!state.started,
    ended: !!state.ended,
    players: deepClone(state.players || {}),
    config: deepClone(state.config || {}),
    match: deepClone(state.match || {}),
    contrib: deepClone(state.contrib || {}),
    summary: deepClone(state.summary || null),
    updatedAt: Number(state.updatedAt || nowTs())
  };
}

/* --------------------------------------------------
 * main factory
 * -------------------------------------------------- */
export function createPlateCoopNetApi({
  adapter = createMemoryNetAdapter(),
  roomId = '',
  playerId = `p-${Math.random().toString(36).slice(2, 10)}`,
  role = '',
  isHost = false,
  game = 'platev1',
  mode = 'coop'
} = {}){
  let currentRoomId = String(roomId || '').trim().toUpperCase();
  let unsubState = noop;
  let unsubActions = noop;
  let lastStateUpdatedAt = 0;
  const seenActionIds = new Set();

  function ensureRoomId(){
    const id = String(currentRoomId || '').trim().toUpperCase();
    if (!id) throw new Error('No active roomId');
    return id;
  }

  function setRoom(id){
    currentRoomId = String(id || '').trim().toUpperCase();
  }

  async function publishState(state){
    if (!isHost) {
      throw new Error('Only host should publish authoritative state');
    }

    const id = ensureRoomId();
    const normalized = normalizeState(state, {
      roomId: id,
      hostId: playerId,
      game,
      mode
    });

    lastStateUpdatedAt = normalized.updatedAt;
    await adapter.publishState(id, normalized);
    return deepClone(normalized);
  }

  async function getState(roomIdArg = currentRoomId){
    const id = String(roomIdArg || '').trim().toUpperCase();
    if (!id) return null;
    return adapter.getState(id);
  }

  function onState(cb){
    const id = ensureRoomId();

    try{ unsubState(); }catch(_){}
    unsubState = adapter.subscribeState(id, (state) => {
      try{
        if (!state) return cb?.(null);

        const updatedAt = Number(state.updatedAt || 0);
        if (updatedAt && updatedAt < lastStateUpdatedAt) {
          return;
        }

        lastStateUpdatedAt = updatedAt || lastStateUpdatedAt;
        cb?.(deepClone(state));
      }catch(_){}
    });

    return () => {
      try{ unsubState(); }catch(_){}
      unsubState = noop;
    };
  }

  async function publishAction(action){
    const id = ensureRoomId();

    const normalized = normalizeAction(action, {
      roomId: id,
      playerId,
      role,
      game,
      mode
    });

    await adapter.publishAction(id, normalized);
    return deepClone(normalized);
  }

  function onAction(cb){
    const id = ensureRoomId();

    try{ unsubActions(); }catch(_){}
    unsubActions = adapter.subscribeActions(id, (action) => {
      try{
        if (!action?.id) return;

        // de-dup
        if (seenActionIds.has(action.id)) return;
        seenActionIds.add(action.id);

        // simple cap
        if (seenActionIds.size > 5000){
          const arr = Array.from(seenActionIds).slice(-2000);
          seenActionIds.clear();
          for (const x of arr) seenActionIds.add(x);
        }

        cb?.(deepClone(action));
      }catch(_){}
    });

    return () => {
      try{ unsubActions(); }catch(_){}
      unsubActions = noop;
    };
  }

  async function sendReady(ready = true){
    return publishAction({
      type: 'PLAYER_READY',
      payload: { ready: !!ready }
    });
  }

  async function sendHit({
    targetId = '',
    targetGroupId = 0,
    targetLabel = '',
    good = false,
    kind = 'food'
  } = {}){
    return publishAction({
      type: 'PLAYER_HIT',
      payload: {
        targetId: String(targetId || ''),
        targetGroupId: Number(targetGroupId || 0),
        targetLabel: String(targetLabel || ''),
        good: !!good,
        kind: String(kind || 'food')
      }
    });
  }

  async function sendMiss({
    targetId = '',
    targetGroupId = 0,
    targetLabel = ''
  } = {}){
    return publishAction({
      type: 'PLAYER_MISS',
      payload: {
        targetId: String(targetId || ''),
        targetGroupId: Number(targetGroupId || 0),
        targetLabel: String(targetLabel || '')
      }
    });
  }

  async function sendLeave(){
    return publishAction({
      type: 'PLAYER_LEAVE',
      payload: {}
    });
  }

  async function sendPing(extra = {}){
    return publishAction({
      type: 'PLAYER_PING',
      payload: deepClone(extra || {})
    });
  }

  async function sendHostStart(extra = {}){
    if (!isHost) throw new Error('Only host can send HOST_START');
    return publishAction({
      type: 'HOST_START',
      payload: deepClone(extra || {})
    });
  }

  async function clearRoom(roomIdArg = currentRoomId){
    const id = String(roomIdArg || '').trim().toUpperCase();
    if (!id) return;
    if (typeof adapter.clearRoom === 'function'){
      await adapter.clearRoom(id);
    }
  }

  return {
    get roomId(){ return currentRoomId; },
    playerId,
    role,
    isHost,

    setRoom,
    publishState,
    getState,
    onState,

    publishAction,
    onAction,

    sendReady,
    sendHit,
    sendMiss,
    sendLeave,
    sendPing,
    sendHostStart,

    clearRoom
  };
}