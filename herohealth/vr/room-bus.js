// === /herohealth/vr/room-bus.js ===
// HeroHealth RoomBus — Supabase Realtime (Presence + Broadcast) + Local fallback
// FULL v20260304-ROOMBUS-SUPABASE-PRESENCE-BROADCAST
//
// API (what runner expects):
//   const bus = createRoomBus({ roomId, playerId, nick, supabaseUrl, supabaseAnon, maxPlayers, forceHost })
//   bus.send(msg)
//   bus.onMsg(fn)            -> unsubscribe fn
//   bus.getPresence()        -> [{ playerId, nick, team, joinedAt }]
//   bus.isHost (boolean)
//   bus.becomeHost()         -> try become host (best-effort)
//
// Notes:
// - Requires sbUrl + sbAnon for networked modes.
// - Uses Broadcast event "bus" and Presence key=playerId.
// - Host election is deterministic: smallest joinedAt then playerId.
// - Safe for classroom: throttles + ignores oversized payloads.
//
// Security:
// - This is client-only. Anyone with roomId can join. Use unique roomId per class/round.

'use strict';

export function createRoomBus(opts = {}){
  const cfg = Object.assign({
    roomId: '',
    playerId: 'anon',
    nick: 'anon',
    team: '',
    supabaseUrl: '',
    supabaseAnon: '',
    maxPlayers: 10,
    forceHost: false,
  }, opts || {});

  const roomId = String(cfg.roomId || '').trim();
  const playerId = String(cfg.playerId || 'anon').trim() || 'anon';
  const nick = String(cfg.nick || playerId).trim() || playerId;
  const team = String(cfg.team || '').trim();

  // ---------- Local fallback (no network) ----------
  if(!cfg.supabaseUrl || !cfg.supabaseAnon || !roomId){
    const listeners = new Set();
    const presence = [{ playerId, nick, team, joinedAt: Date.now() }];

    const local = {
      get isHost(){ return true; },
      becomeHost(){ /* noop */ },
      getPresence(){ return presence.slice(); },
      send(msg){
        // loopback (useful for dev)
        for(const fn of listeners){ try{ fn(msg); }catch(e){} }
      },
      onMsg(fn){
        if(typeof fn === 'function') listeners.add(fn);
        return ()=> listeners.delete(fn);
      }
    };

    console.warn('[RoomBus] Using LOCAL fallback (missing sbUrl/sbAnon or roomId).');
    return local;
  }

  // ---------- Supabase realtime ----------
  let sb = null;
  let channel = null;

  const listeners = new Set();
  const state = {
    isHost: !!cfg.forceHost,
    presence: new Map(), // key -> { playerId, nick, team, joinedAt }
    joinedAt: Date.now(),
    connected: false
  };

  const safeJson = (x)=>{
    try{
      const s = JSON.stringify(x);
      // keep payload small-ish
      if(s.length > 2400) return null;
      return x;
    }catch(_){ return null; }
  };

  // Host election: smallest joinedAt then playerId
  function electHost(){
    const arr = Array.from(state.presence.values());
    if(!arr.length){
      state.isHost = !!cfg.forceHost;
      return state.isHost;
    }
    arr.sort((a,b)=>{
      const da = Number(a.joinedAt||0), db = Number(b.joinedAt||0);
      if(da !== db) return da - db;
      return String(a.playerId||'').localeCompare(String(b.playerId||''));
    });
    const hostId = String(arr[0].playerId || '');
    state.isHost = (hostId && hostId === playerId) || !!cfg.forceHost;
    return state.isHost;
  }

  function getPresenceList(){
    const arr = Array.from(state.presence.values());
    // keep stable order
    arr.sort((a,b)=>{
      const da = Number(a.joinedAt||0), db = Number(b.joinedAt||0);
      if(da !== db) return da - db;
      return String(a.playerId||'').localeCompare(String(b.playerId||''));
    });
    return arr;
  }

  async function ensureSupabase(){
    if(sb) return sb;

    // If supabase already exists globally, use it; else import ESM.
    if(typeof window !== 'undefined' && window.supabase?.createClient){
      sb = window.supabase;
      return sb;
    }

    // ESM import from CDN (works on GitHub Pages)
    const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    sb = mod;
    return sb;
  }

  async function connect(){
    const mod = await ensureSupabase();
    const client = mod.createClient(cfg.supabaseUrl, cfg.supabaseAnon, {
      realtime: { params: { eventsPerSecond: 12 } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });

    const topic = `hha-room:${roomId}`;
    channel = client.channel(topic, {
      config: {
        presence: { key: playerId },
        broadcast: { self: false }
      }
    });

    // broadcast "bus"
    channel.on('broadcast', { event: 'bus' }, (payload)=>{
      const msg = payload?.payload;
      if(!msg) return;
      for(const fn of listeners){ try{ fn(msg); }catch(e){} }
    });

    // presence sync
    channel.on('presence', { event: 'sync' }, ()=>{
      const ps = channel.presenceState?.() || {};
      state.presence.clear();
      for(const k of Object.keys(ps)){
        const items = ps[k] || [];
        for(const it of items){
          const p = {
            playerId: String(it.playerId || k || ''),
            nick: String(it.nick || ''),
            team: String(it.team || ''),
            joinedAt: Number(it.joinedAt || 0) || 0
          };
          if(p.playerId) state.presence.set(p.playerId, p);
        }
      }
      electHost();
      state.connected = true;
    });

    channel.on('presence', { event: 'join' }, ({ newPresences })=>{
      (newPresences||[]).forEach(it=>{
        const p = {
          playerId: String(it.playerId || ''),
          nick: String(it.nick || ''),
          team: String(it.team || ''),
          joinedAt: Number(it.joinedAt || 0) || 0
        };
        if(p.playerId) state.presence.set(p.playerId, p);
      });
      electHost();
    });

    channel.on('presence', { event: 'leave' }, ({ leftPresences })=>{
      (leftPresences||[]).forEach(it=>{
        const pid = String(it.playerId || '');
        if(pid) state.presence.delete(pid);
      });
      electHost();
    });

    const status = await channel.subscribe(async (st)=>{
      // st can be: SUBSCRIBED, TIMED_OUT, CLOSED, CHANNEL_ERROR
      // We only act when subscribed.
    });

    // track myself
    await channel.track({
      playerId,
      nick,
      team,
      joinedAt: state.joinedAt
    });

    // capacity guard (best effort)
    setTimeout(()=>{
      try{
        const n = getPresenceList().length;
        if(n > (cfg.maxPlayers|0)){
          console.warn('[RoomBus] maxPlayers exceeded:', n, '>', cfg.maxPlayers);
        }
      }catch(e){}
    }, 1600);

    return { client, channel };
  }

  // kick off connect now
  const ready = connect().catch((e)=>{
    console.error('[RoomBus] connect failed', e);
  });

  const api = {
    get isHost(){ return !!state.isHost; },
    becomeHost(){
      // best-effort: forceHost makes you host; caller should use only for teacher device
      state.isHost = true;
      return true;
    },
    getPresence(){
      return getPresenceList();
    },
    send(msg){
      const m = safeJson(msg);
      if(!m) return false;
      if(!channel) return false;
      try{
        channel.send({ type:'broadcast', event:'bus', payload: m });
        return true;
      }catch(e){
        console.warn('[RoomBus] send failed', e);
        return false;
      }
    },
    onMsg(fn){
      if(typeof fn === 'function') listeners.add(fn);
      return ()=> listeners.delete(fn);
    },
    // optional: wait for subscribe/track
    ready
  };

  return api;
}