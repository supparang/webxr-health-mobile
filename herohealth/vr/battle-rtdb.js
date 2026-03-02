// === /herohealth/vr/battle-rtdb.js ===
// Battle module (optional) — works without Firebase (BroadcastChannel/localStorage)
// Winner rule: score → acc → miss → medianRT (lower medianRT wins)
// PATCH v20260302-BATTLE-LOCALSAFE
'use strict';

function clamp(v,a,b){ v=+v||0; return v<a?a:(v>b?b:v); }

export function compareScore(a,b){
  // a/b = {score, accPct, miss, medianRtGoodMs}
  const A = a||{}, B=b||{};
  const sA = +A.score||0, sB = +B.score||0;
  if(sA !== sB) return sA > sB ? -1 : 1;

  const accA = +A.accPct||0, accB = +B.accPct||0;
  if(accA !== accB) return accA > accB ? -1 : 1;

  const mA = +A.miss||0, mB = +B.miss||0;
  if(mA !== mB) return mA < mB ? -1 : 1;

  const rtA = +A.medianRtGoodMs||0, rtB = +B.medianRtGoodMs||0;
  if(rtA !== rtB) return rtA < rtB ? -1 : 1;

  return 0;
}

export async function initBattle(cfg){
  cfg = cfg || {};
  if(!cfg.enabled) return null;

  const pid = String(cfg.pid||'anon');
  const gameKey = String(cfg.gameKey||'game');
  const room = String(cfg.room||'').trim() || `room-${gameKey}`;
  const autostartMs = +cfg.autostartMs || 3000;
  const forfeitMs = +cfg.forfeitMs || 5000;

  const chanName = `HHA_BATTLE:${room}:${gameKey}`;
  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel(chanName) : null;

  const state = {
    room, pid, gameKey,
    me: null,
    peer: null,
    startedAtMs: Date.now() + autostartMs,
    ended: false
  };

  function now(){ return Date.now(); }

  function publish(type, payload){
    const msg = { type, payload: payload||null, t: now(), pid };
    try{
      bc?.postMessage(msg);
    }catch(e){}
    try{
      localStorage.setItem(`${chanName}:last`, JSON.stringify(msg));
    }catch(e){}
  }

  function ingest(msg){
    if(!msg || msg.pid === pid) return;
    if(msg.type === 'score'){
      state.peer = msg.payload || state.peer;
    }else if(msg.type === 'end'){
      state.peerEnd = msg.payload || state.peerEnd;
    }
  }

  if(bc){
    bc.onmessage = (ev)=> ingest(ev.data);
  }else{
    window.addEventListener('storage', (ev)=>{
      if(ev.key === `${chanName}:last` && ev.newValue){
        try{ ingest(JSON.parse(ev.newValue)); }catch(e){}
      }
    });
  }

  function pushScore(payload){
    state.me = payload || state.me;
    publish('score', payload);
  }

  function decideWinner(finalSummary){
    const mine = {
      score: finalSummary?.scoreFinal ?? state.me?.score ?? 0,
      accPct: finalSummary?.accPct ?? state.me?.accPct ?? 0,
      miss: finalSummary?.missTotal ?? state.me?.miss ?? 0,
      medianRtGoodMs: finalSummary?.medianRtGoodMs ?? state.me?.medianRtGoodMs ?? 0
    };
    const peer = {
      score: state.peer?.score ?? 0,
      accPct: state.peer?.accPct ?? 0,
      miss: state.peer?.miss ?? 0,
      medianRtGoodMs: state.peer?.medianRtGoodMs ?? 0
    };

    const cmp = compareScore(mine, peer);
    if(cmp === 0) return { winner:'draw', mine, peer };
    return { winner:(cmp < 0 ? 'me' : 'peer'), mine, peer };
  }

  function finalizeEnd(finalSummary){
    if(state.ended) return;
    state.ended = true;

    const result = decideWinner(finalSummary);
    publish('end', { final: finalSummary, result });

    // show a quick toast (optional)
    try{
      const msg =
        result.winner === 'me' ? '🏆 YOU WIN!' :
        result.winner === 'peer' ? '😵 YOU LOSE' :
        '🤝 DRAW';
      console.log('[Battle]', msg, result);
    }catch(e){}
  }

  // forfeit: if no peer score arrives in time, still allow end
  setTimeout(()=>{
    if(state.peer == null){
      // still fine; peer is "absent"
    }
  }, forfeitMs);

  // auto start announce
  setTimeout(()=> publish('hello', { pid, gameKey }), autostartMs);

  return {
    room, pid, gameKey,
    pushScore,
    finalizeEnd,
    compareScore
  };
}