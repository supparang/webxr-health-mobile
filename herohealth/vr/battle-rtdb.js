// === /herohealth/vr/battle-rtdb.js ===
// Battle realtime module (NO Firebase) — PRODUCTION SAFE
// Uses BroadcastChannel if available; fallback to localStorage events.
// Winner comparator: score → acc → miss → medianRT (lower is better for RT)
// PATCH v20260302-BATTLE-BC-LS
'use strict';

function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }
function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); }

function normRoom(room){
  room = String(room||'').trim();
  if(!room) return 'default';
  return room.replace(/[^\w\-]/g,'_').slice(0,48) || 'default';
}

function compareAthenB(a,b){
  // return +1 if a wins, -1 if b wins, 0 tie
  const as = Number(a?.score)||0, bs = Number(b?.score)||0;
  if(as !== bs) return (as>bs) ? 1 : -1;

  const aa = Number(a?.accPct)||0, ba = Number(b?.accPct)||0;
  if(aa !== ba) return (aa>ba) ? 1 : -1;

  const am = Number(a?.miss)||0, bm = Number(b?.miss)||0;
  if(am !== bm) return (am<bm) ? 1 : -1;

  const ar = Number(a?.medianRtGoodMs)||0, br = Number(b?.medianRtGoodMs)||0;
  // lower RT wins (if both have 0, treat tie)
  if(ar !== br) return (ar<br) ? 1 : -1;

  return 0;
}

function safeJsonParse(s){
  try{ return JSON.parse(s); }catch(e){ return null; }
}

function mkPacket(type, payload){
  return {
    t: String(type||'score'),
    ts: Date.now(),
    payload: payload || null
  };
}

export async function initBattle({ enabled=true, room='', pid='anon', gameKey='game', autostartMs=3000, forfeitMs=5000 }){
  if(!enabled) return null;

  const ROOM = normRoom(room);
  const ME = String(pid||'anon').trim() || 'anon';
  const GAME = String(gameKey||'game').trim() || 'game';

  const channelName = `hha-battle:${GAME}:${ROOM}`;
  const lsKey = `HHA_BATTLE_LAST:${GAME}:${ROOM}`;

  let bc = null;
  try{
    if('BroadcastChannel' in window){
      bc = new BroadcastChannel(channelName);
    }
  }catch(e){ bc = null; }

  const state = {
    me: ME,
    gameKey: GAME,
    room: ROOM,
    startedAt: Date.now(),
    lastLocal: null,
    peers: {}, // pid -> {score packet}
    ended: {}, // pid -> end summary
    winner: null
  };

  function publish(packet){
    try{
      if(bc) bc.postMessage(packet);
    }catch(e){}
    try{
      localStorage.setItem(lsKey, JSON.stringify(packet));
      // trigger storage event across tabs
      localStorage.setItem(lsKey+':ping', String(Date.now()));
    }catch(e){}
  }

  function onPacket(packet){
    if(!packet || !packet.t) return;
    const p = packet.payload || {};
    const from = String(p.pid || p.player || p.me || '').trim() || '';
    if(from && from === ME && packet.t !== 'echo') return;

    if(packet.t === 'score'){
      const who = String(p.pid||'').trim();
      if(!who) return;
      state.peers[who] = {
        score: Number(p.score)||0,
        miss: Number(p.miss)||0,
        accPct: Number(p.accPct)||0,
        medianRtGoodMs: Number(p.medianRtGoodMs)||0,
        ts: packet.ts || Date.now()
      };
    }else if(packet.t === 'end'){
      const who = String(p.pid||'').trim();
      if(!who) return;
      state.ended[who] = p;
      decideWinnerMaybe();
    }else if(packet.t === 'hello'){
      // ignore, used for presence if needed
    }
  }

  function decideWinnerMaybe(){
    const a = state.ended[state.me] || state.lastLocal;
    // pick best opponent ended if any
    const oppIds = Object.keys(state.ended).filter(x=>x!==state.me);
    if(!a || oppIds.length===0) return;

    const bestOppId = oppIds
      .map(id=>({ id, s: state.ended[id] }))
      .sort((x,y)=>{
        const c = compareAthenB(x.s, y.s);
        return c===1 ? -1 : (c===-1 ? 1 : 0);
      })[0]?.id;

    if(!bestOppId) return;
    const b = state.ended[bestOppId];
    const c = compareAthenB(a,b);

    state.winner = (c===1) ? state.me : (c===-1 ? bestOppId : 'tie');

    // announce (optional)
    try{
      window.dispatchEvent(new CustomEvent('hha:battle-winner', {
        detail: { room:ROOM, gameKey:GAME, winner: state.winner, me: state.me, opponent: bestOppId }
      }));
    }catch(e){}
  }

  // listeners
  if(bc){
    bc.onmessage = (ev)=> onPacket(ev?.data);
  }

  window.addEventListener('storage', (ev)=>{
    if(!ev) return;
    if(ev.key === lsKey){
      const pkt = safeJsonParse(ev.newValue);
      if(pkt) onPacket(pkt);
    }
  });

  // read last known packet (if any)
  try{
    const pkt = safeJsonParse(localStorage.getItem(lsKey));
    if(pkt) onPacket(pkt);
  }catch(e){}

  // presence hello
  setTimeout(()=>{
    publish(mkPacket('hello', { pid: ME, gameKey: GAME, room: ROOM }));
  }, clamp(autostartMs, 0, 20000));

  // forfeit timer: if opponent never ends, still finalize with what we have
  const t0 = nowMs();
  const forfeitT = clamp(forfeitMs, 1000, 60000);
  const forfeitTimer = setInterval(()=>{
    if(state.winner) { clearInterval(forfeitTimer); return; }
    const elapsed = nowMs() - t0;
    if(elapsed < forfeitT) return;
    // no opponent ended -> keep winner null (game can ignore)
    clearInterval(forfeitTimer);
  }, 800);

  return {
    pushScore(payload){
      payload = payload || {};
      const pkt = mkPacket('score', {
        pid: ME,
        gameKey: GAME,
        room: ROOM,
        score: payload.score|0,
        miss: payload.miss|0,
        accPct: payload.accPct|0,
        medianRtGoodMs: payload.medianRtGoodMs|0
      });
      state.lastLocal = pkt.payload;
      publish(pkt);
    },
    finalizeEnd(summary){
      summary = summary || {};
      summary.pid = summary.pid || ME;
      summary.gameKey = summary.gameKey || GAME;
      summary.room = ROOM;

      state.ended[ME] = summary;
      state.lastLocal = {
        score: Number(summary.scoreFinal)||0,
        miss: Number(summary.missTotal)||0,
        accPct: Number(summary.accPct)||0,
        medianRtGoodMs: Number(summary.medianRtGoodMs)||0
      };

      publish(mkPacket('end', summary));
      decideWinnerMaybe();
    }
  };
}