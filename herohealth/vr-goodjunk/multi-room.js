// === /herohealth/vr-goodjunk/multi-room.js ===
// GoodJunk Multiplayer Room (Supabase Realtime) — v1
// Host Authority: host confirms claims/hits; clients follow confirm messages.

'use strict';

function now(){ return Date.now(); }
function uid(){
  try { return (crypto.randomUUID && crypto.randomUUID()) || ('p'+Math.random().toString(16).slice(2)+now()); }
  catch { return 'p'+Math.random().toString(16).slice(2)+now(); }
}
function qs(k, d=''){
  try { return (new URL(location.href)).searchParams.get(k) ?? d; }
  catch { return d; }
}
function clampInt(v, a, b){
  v = parseInt(v,10); if(!Number.isFinite(v)) v=a;
  return Math.max(a, Math.min(b, v));
}

// Minimal wrapper around Supabase realtime channel + presence
export function createRoomBus(opts){
  opts = opts || {};
  const roomId = String(opts.roomId || qs('room','')).trim();
  const nick   = String(opts.nick   || qs('nick','')).trim().slice(0,20) || 'Player';
  const playerId = String(opts.playerId || qs('pid','')).trim() || uid();
  const forceHost = String(opts.forceHost || qs('host','0')) === '1';

  const url  = opts.supabaseUrl  || qs('sbUrl','');
  const anon = opts.supabaseAnon || qs('sbAnon','');

  const maxPlayers = clampInt(opts.maxPlayers ?? 10, 2, 10);

  if(!roomId) throw new Error('Missing roomId (?room=...)');
  if(!url || !anon) throw new Error('Missing Supabase config (sbUrl/sbAnon)');

  // Lazy import to keep payload small until needed
  let sb = null, ch = null;
  let state = {
    roomId, playerId, nick,
    isHost: !!forceHost,
    hostId: '',
    started: false,
    seed: '',
    players: {}, // {playerId:{nick, teamId, joinedAt}}
  };

  const handlers = {
    onPresence: [],
    onMsg: [],
    onSystem: [],
  };

  function emit(kind, payload){
    const list = handlers[kind] || [];
    for(const fn of list){
      try{ fn(payload); }catch(e){}
    }
  }

  function on(kind, fn){
    if(handlers[kind]) handlers[kind].push(fn);
    return ()=> {
      const i = handlers[kind].indexOf(fn);
      if(i>=0) handlers[kind].splice(i,1);
    };
  }

  function broadcast(type, data){
    if(!ch) return;
    ch.send({ type:'broadcast', event:'gj', payload:{ t:type, ...data, roomId, ts: now() } });
  }

  function pickHostFromPresence(pres){
    // deterministic: smallest playerId becomes host (unless forceHost exists)
    const ids = Object.keys(pres || {}).sort();
    return ids[0] || '';
  }

  async function connect(){
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    sb = createClient(url, anon, { realtime: { params: { eventsPerSecond: 30 } } });

    ch = sb.channel(`goodjunk:${roomId}`, {
      config: { presence: { key: playerId }, broadcast: { self: true } }
    });

    ch.on('presence', { event: 'sync' }, () => {
      const pres = ch.presenceState();
      const players = {};
      for(const pid of Object.keys(pres)){
        const arr = pres[pid] || [];
        // use last meta
        const meta = arr[arr.length-1] || {};
        players[pid] = {
          playerId: pid,
          nick: String(meta.nick||'Player').slice(0,20),
          teamId: String(meta.teamId||''),
          joinedAt: meta.joinedAt || now(),
        };
      }
      state.players = players;

      const computedHost = pickHostFromPresence(players);
      // forceHost: if I force host, I am hostId
      state.hostId = state.isHost ? playerId : computedHost;
      state.isHost = state.isHost || (playerId === computedHost);

      emit('onPresence', { ...state, players });
    });

    ch.on('broadcast', { event:'gj' }, (msg) => {
      const p = msg?.payload || {};
      emit('onMsg', p);
    });

    const meta = { nick, teamId: opts.teamId || '', joinedAt: now() };

    const { status, error } = await ch.subscribe(async (st) => {
      if(st === 'SUBSCRIBED'){
        await ch.track(meta);
        emit('onSystem', { ok:true, status:'SUBSCRIBED', ...state });
        broadcast('join', { by: playerId, nick });
      }
    });

    if(error) throw error;
    return status;
  }

  function disconnect(){
    try{ broadcast('leave', { by: playerId }); }catch(e){}
    try{ ch && ch.unsubscribe(); }catch(e){}
    try{ sb && sb.removeChannel(ch); }catch(e){}
    ch = null; sb = null;
  }

  // ---- host actions ----
  function hostStartRound(payload){
    if(!state.isHost) return;
    state.started = true;
    state.seed = String(payload.seed || now());
    broadcast('start', {
      by: playerId,
      seed: state.seed,
      diff: payload.diff || 'normal',
      time: payload.time || 80,
      mode: payload.mode || 'race',
      gameVersion: payload.gameVersion || '',
    });
  }

  // claim/hit confirm: host acts as authority
  function sendClaim(targetId){
    broadcast('claim', { by: playerId, targetId:String(targetId||'') });
  }

  function sendHit(hit){
    // hit: {targetId, kind, rtMs}
    broadcast('hit', {
      by: playerId,
      targetId: String(hit.targetId||''),
      kind: String(hit.kind||'good'),
      rtMs: Math.max(0, parseInt(hit.rtMs||0,10) || 0),
    });
  }

  function hostConfirm(confirm){
    if(!state.isHost) return;
    // confirm: {targetId, winnerId, kind, scoreDelta, combo, misses}
    broadcast('confirm', {
      by: playerId,
      targetId: String(confirm.targetId||''),
      winnerId: String(confirm.winnerId||''),
      kind: String(confirm.kind||'good'),
      scoreDelta: parseInt(confirm.scoreDelta||0,10) || 0,
      combo: parseInt(confirm.combo||0,10) || 0,
      misses: parseInt(confirm.misses||0,10) || 0,
    });
  }

  function updateLocal(patch){
    state = { ...state, ...(patch||{}) };
  }

  return {
    state: ()=> ({...state}),
    on,
    connect, disconnect,
    broadcast,
    hostStartRound,
    sendClaim, sendHit,
    hostConfirm,
    updateLocal,
    maxPlayers,
  };
}