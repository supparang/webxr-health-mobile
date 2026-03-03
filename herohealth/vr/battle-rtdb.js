// === /herohealth/vr/battle-rtdb.js ===
// Battle module — PRODUCTION-LITE
// PATCH v20260304-BATTLE-BC-COMPARE
// ✅ Works NOW using BroadcastChannel (same browser/device tabs)
// ✅ Comparator: score → acc → miss → medianRT
// ✅ RTDB hook stub left for later (AI/ML/DL stage can come next)

'use strict';

function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); }

function compareScores(a,b){
  // higher score wins
  const as = Number(a?.score||0), bs = Number(b?.score||0);
  if(as !== bs) return bs - as;

  // higher acc wins
  const aa = Number(a?.accPct||0), ba = Number(b?.accPct||0);
  if(aa !== ba) return ba - aa;

  // lower miss wins
  const am = Number(a?.miss||0), bm = Number(b?.miss||0);
  if(am !== bm) return am - bm;

  // lower median RT wins
  const ar = Number(a?.medianRtGoodMs||0), br = Number(b?.medianRtGoodMs||0);
  return ar - br;
}

export async function initBattle(opts={}){
  const enabled = !!opts.enabled;
  if(!enabled) return null;

  const pid = String(opts.pid || 'anon');
  const gameKey = String(opts.gameKey || 'game');
  const room = String(opts.room || 'room1');

  const autostartMs = clamp(opts.autostartMs ?? 3000, 0, 30000);
  const forfeitMs   = clamp(opts.forfeitMs ?? 5000, 0, 60000);

  const channelName = `HHA_BATTLE:${gameKey}:${room}`;
  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel(channelName) : null;

  let myLast = null;
  let oppLast = null;
  let startedAt = Date.now();

  function emit(type, payload){
    if(!bc) return;
    bc.postMessage({ type, pid, t: Date.now(), payload });
  }

  function decideWinner(){
    if(!myLast || !oppLast) return null;
    const cmp = compareScores(myLast, oppLast);
    if(cmp < 0) return { winner: 'me', reason: 'score→acc→miss→medianRT', my: myLast, opp: oppLast };
    if(cmp > 0) return { winner: 'opp', reason: 'score→acc→miss→medianRT', my: myLast, opp: oppLast };
    return { winner: 'tie', reason: 'score→acc→miss→medianRT', my: myLast, opp: oppLast };
  }

  if(bc){
    bc.onmessage = (ev)=>{
      const msg = ev?.data || {};
      if(msg.pid === pid) return; // ignore self
      if(msg.type === 'score'){
        oppLast = msg.payload || null;
      }
      if(msg.type === 'end'){
        // keep last
        oppLast = msg.payload?.score || oppLast;
      }
    };
  }

  // autostart ping
  setTimeout(()=> emit('hello', { pid, gameKey, room }), autostartMs);

  // forfeit detection (very light)
  const timer = setInterval(()=>{
    if(!oppLast && (Date.now() - startedAt) > forfeitMs){
      // nothing — let host decide UI later
    }
  }, 500);

  return {
    pushScore(payload){
      myLast = payload;
      emit('score', payload);
    },

    finalizeEnd(summary){
      emit('end', { summary, score: myLast });
      clearInterval(timer);

      const res = decideWinner();
      if(res){
        window.dispatchEvent(new CustomEvent('hha:battle-result', { detail: res }));
      }
      return res;
    },

    getState(){
      return { myLast, oppLast, room, gameKey, pid };
    }
  };
}