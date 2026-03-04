// === /herohealth/vr/room-bus.js ===
// Room Bus — lightweight pub/sub for "room" (LOCAL + optional RTDB adapter)
// FULL v20260304-ROOMBUS-LOCAL+RTDB
'use strict';

/**
 * Local transport: BroadcastChannel + localStorage event fanout
 * - Works across tabs/windows on same device.
 * - Not cross-device.
 */
function createLocalBus({ room, channelPrefix = 'HHA_ROOM', debug=false }){
  const chanName = `${channelPrefix}:${String(room||'').trim() || 'default'}`;
  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel(chanName) : null;
  const lsKey = `${chanName}:LS`;
  const handlers = new Map();

  function log(...a){ if(debug) console.log('[room-bus][local]', ...a); }

  function on(type, fn){
    type = String(type||'');
    if(!handlers.has(type)) handlers.set(type, new Set());
    handlers.get(type).add(fn);
    return ()=> handlers.get(type)?.delete(fn);
  }

  function dispatch(msg){
    if(!msg || typeof msg !== 'object') return;
    const type = String(msg.type||'');
    const set = handlers.get(type);
    if(!set || !set.size) return;
    for(const fn of set){
      try{ fn(msg.payload, msg); }catch(e){ /* ignore */ }
    }
  }

  function emit(type, payload){
    const msg = { type:String(type||''), payload: payload ?? null, ts: Date.now() };
    // BroadcastChannel
    try{ bc && bc.postMessage(msg); }catch(e){}

    // localStorage fanout (fallback for browsers without BC, and also triggers storage event)
    try{
      localStorage.setItem(lsKey, JSON.stringify({ ...msg, nonce: Math.random().toString(36).slice(2) }));
      // cleanup (optional)
      // localStorage.removeItem(lsKey);
    }catch(e){}

    // Also dispatch to self
    dispatch(msg);
  }

  function close(){
    try{ bc && bc.close(); }catch(e){}
    handlers.clear();
  }

  if(bc){
    bc.onmessage = (ev)=>{ dispatch(ev.data); };
    log('BroadcastChannel ready:', chanName);
  }else{
    log('BroadcastChannel not available, using storage only:', chanName);
  }

  window.addEventListener('storage', (ev)=>{
    if(ev.key !== lsKey) return;
    try{
      const msg = JSON.parse(ev.newValue || 'null');
      dispatch(msg);
    }catch(e){}
  });

  return { on, emit, close, transport:'local', room: String(room||'') };
}

/**
 * Optional RTDB adapter:
 * - Tries to import ../vr/battle-rtdb.js
 * - If that module exposes:
 *    - initBattle({room,pid,gameKey,enabled:true})
 *    - and returns an object with:
 *        - onRoomEvent(fn)  -> receives {type,payload,ts,from}
 *        - emitRoomEvent(type,payload)
 *   then we can sync cross-device.
 *
 * If not found, we fallback to local bus.
 */
async function tryCreateRtdbBus({ room, pid, gameKey, debug=false }){
  try{
    const mod = await import('./battle-rtdb.js');
    if(!mod || typeof mod.initBattle !== 'function') return null;

    const battle = await mod.initBattle({
      enabled: true,
      room: String(room||''),
      pid: String(pid||'anon'),
      gameKey: String(gameKey||'room'),
      // keep short timeouts, this is just a bus
      autostartMs: 0,
      forfeitMs: 0
    });

    // We need these APIs on battle object:
    const canOn  = (battle && typeof battle.onRoomEvent === 'function');
    const canEmit= (battle && typeof battle.emitRoomEvent === 'function');

    if(!canOn || !canEmit){
      if(debug){
        console.warn('[room-bus][rtdb] battle-rtdb.js loaded but missing onRoomEvent/emitRoomEvent API. Using local only.');
      }
      return null;
    }

    const handlers = new Map();
    function on(type, fn){
      type = String(type||'');
      if(!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(fn);
      return ()=> handlers.get(type)?.delete(fn);
    }
    function dispatch(msg){
      if(!msg || typeof msg !== 'object') return;
      const type = String(msg.type||'');
      const set = handlers.get(type);
      if(!set || !set.size) return;
      for(const fn of set){
        try{ fn(msg.payload, msg); }catch(e){}
      }
    }
    function emit(type, payload){
      try{ battle.emitRoomEvent(String(type||''), payload ?? null); }catch(e){}
      dispatch({ type:String(type||''), payload: payload ?? null, ts: Date.now(), from: String(pid||'anon') });
    }
    function close(){
      try{ battle.close?.(); }catch(e){}
      handlers.clear();
    }

    battle.onRoomEvent((msg)=> dispatch(msg));

    return { on, emit, close, transport:'rtdb', room: String(room||''), battle };
  }catch(e){
    if(debug) console.warn('[room-bus][rtdb] init failed', e);
    return null;
  }
}

export async function createRoomBus(opts = {}){
  const room = String(opts.room || '').trim();
  const pid = String(opts.pid || 'anon').trim() || 'anon';
  const gameKey = String(opts.gameKey || 'room').trim() || 'room';
  const debug = !!opts.debug;

  if(!room){
    // no room -> still provide local bus on default
    return createLocalBus({ room:'default', debug });
  }

  // Prefer RTDB if available
  const rtdb = await tryCreateRtdbBus({ room, pid, gameKey, debug });
  if(rtdb) return rtdb;

  // Fallback to local
  return createLocalBus({ room, debug });
}