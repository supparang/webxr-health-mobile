// === /herohealth/vr/battle-rtdb.js ===
// HeroHealth Battle Transport (SAFE)
// - Default transport: BroadcastChannel (works cross-tab on same device)
// - Winner: score → accPct → miss → medianRtGoodMs (lower better)
// - Emits UI event: window.dispatchEvent(new CustomEvent('hha:battle', {detail:{...}}))
'use strict';

import { compareScorePackets } from './score-compare.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

let __DBG__ = { room:'', status:'idle' };

function qs(k, d=''){ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } }
function now(){ return Date.now(); }

function safePid(p){ p=String(p||'anon').trim(); return p||'anon'; }
function safeRoom(r){
  r = String(r||'').trim();
  if(!r) r = `ROOM-${Math.random().toString(16).slice(2,8).toUpperCase()}`;
  return r.replace(/[^A-Za-z0-9_-]/g,'').slice(0,32) || 'ROOM';
}
function emit(detail){
  try{
    ROOT.dispatchEvent(new CustomEvent('hha:battle', { detail }));
  }catch(e){}
}

function shortScore(p){
  if(!p) return '—';
  const s = Number(p.score ?? 0)|0;
  const a = Number(p.accPct ?? 0)|0;
  const m = Number(p.miss ?? 0)|0;
  const r = Number(p.medianRtGoodMs ?? 0)|0;
  return `${s} | acc ${a}% | miss ${m} | rt ${r}ms`;
}

function pickWinnerPacket(a, b){
  if(!a && !b) return null;
  if(a && !b) return a;
  if(!a && b) return b;
  return compareScorePackets(a,b) <= 0 ? a : b; // best first
}

// Transport: BroadcastChannel (fallback to localStorage events)
function makeTransport(room){
  const chanName = `hha-battle:${room}`;
  let bc = null;

  try{
    bc = new BroadcastChannel(chanName);
  }catch(e){
    bc = null;
  }

  const lsKey = `HHA_BATTLE_BUS:${room}`;
  const listeners = new Set();

  function send(msg){
    msg = msg || {};
    msg.ts = now();
    msg.room = room;
    try{ bc?.postMessage(msg); }catch(e){}
    try{
      localStorage.setItem(lsKey, JSON.stringify(msg));
      // clear quickly to avoid bloat
      localStorage.removeItem(lsKey);
    }catch(e){}
  }

  function onMessage(fn){
    listeners.add(fn);
    return ()=> listeners.delete(fn);
  }

  if(bc){
    bc.onmessage = (ev)=>{
      const msg = ev?.data || null;
      if(!msg) return;
      listeners.forEach(fn=>{ try{ fn(msg); }catch(e){} });
    };
  }

  ROOT.addEventListener('storage', (ev)=>{
    if(ev.key !== lsKey) return;
    const msg = (function(){
      try{ return JSON.parse(ev.newValue || '{}'); }catch(e){ return null; }
    })();
    if(!msg) return;
    listeners.forEach(fn=>{ try{ fn(msg); }catch(e){} });
  });

  return { send, onMessage };
}

export function getBattleDebug(){
  return __DBG__;
}

export async function initBattle(opts){
  opts = opts || {};
  if(!opts.enabled) return null;

  const pid = safePid(opts.pid);
  const gameKey = String(opts.gameKey || 'unknown').toLowerCase();

  const room = safeRoom(opts.room || qs('room',''));
  __DBG__.room = room;
  __DBG__.status = 'connecting';

  const transport = makeTransport(room);

  const state = {
    room,
    pid,
    gameKey,
    status: 'connecting',
    you: null,
    opp: null,
    youEnd: null,
    oppEnd: null,
    winner: null,
    startedAt: now() + (Number(opts.autostartMs)||3000),
    forfeitAt: null
  };

  function setStatus(s){
    state.status = s;
    __DBG__.status = s;
    emit({
      room: state.room,
      status: state.status,
      you: shortScore(state.you),
      opp: shortScore(state.opp),
      winner: state.winner ? String(state.winner.pid||'—') : '—'
    });
  }

  function broadcastHello(){
    transport.send({ type:'hello', pid, gameKey });
  }

  function broadcastScore(packet){
    transport.send({ type:'score', pid, gameKey, packet });
  }

  function broadcastEnd(summary){
    transport.send({ type:'end', pid, gameKey, summary });
  }

  function calcWinner(){
    // need both ends OR forfeit decision
    if(state.youEnd && state.oppEnd){
      const a = {
        pid,
        score: state.youEnd.scoreFinal,
        accPct: state.youEnd.accPct,
        miss: state.youEnd.missTotal,
        medianRtGoodMs: state.youEnd.medianRtGoodMs,
        ts: Number(state.youEnd.endTimeIso ? Date.parse(state.youEnd.endTimeIso) : now())
      };
      const b = {
        pid: state.oppEnd.pid,
        score: state.oppEnd.scoreFinal,
        accPct: state.oppEnd.accPct,
        miss: state.oppEnd.missTotal,
        medianRtGoodMs: state.oppEnd.medianRtGoodMs,
        ts: Number(state.oppEnd.endTimeIso ? Date.parse(state.oppEnd.endTimeIso) : now())
      };
      const win = pickWinnerPacket(a,b);
      state.winner = win;
      setStatus('ended');
      emit({
        room: state.room,
        status: 'ended',
        you: shortScore(a),
        opp: shortScore(b),
        winner: win ? String(win.pid) : '—'
      });
      return;
    }

    // forfeit logic (if one ended and other not within forfeitMs)
    if(state.youEnd && !state.oppEnd && state.forfeitAt && now() >= state.forfeitAt){
      state.winner = { pid };
      setStatus('ended');
      emit({ room: state.room, status:'ended', winner: pid });
      return;
    }
    if(!state.youEnd && state.oppEnd && state.forfeitAt && now() >= state.forfeitAt){
      state.winner = { pid: state.oppEnd.pid || 'opponent' };
      setStatus('ended');
      emit({ room: state.room, status:'ended', winner: state.winner.pid });
      return;
    }
  }

  // incoming
  transport.onMessage((msg)=>{
    if(!msg || msg.room !== room) return;
    if(msg.gameKey && String(msg.gameKey).toLowerCase() !== gameKey) return;

    if(msg.type === 'hello'){
      if(msg.pid && msg.pid !== pid){
        setStatus('ready');
      }
      return;
    }

    if(msg.type === 'score'){
      if(msg.pid === pid) return;
      state.opp = msg.packet || null;
      setStatus(state.status === 'connecting' ? 'ready' : state.status);
      return;
    }

    if(msg.type === 'end'){
      if(msg.pid === pid) return;
      state.oppEnd = msg.summary || null;
      // if you already ended, start forfeit timer to close quickly
      if(state.youEnd && !state.forfeitAt){
        state.forfeitAt = now() + (Number(opts.forfeitMs)||5000);
      }
      setStatus(state.status === 'ended' ? 'ended' : 'ready');
      calcWinner();
      return;
    }
  });

  // initial
  setStatus('connecting');
  broadcastHello();
  setTimeout(()=> broadcastHello(), 600);
  setTimeout(()=> setStatus('ready'), 900);

  // public API used by goodjunk.safe.js
  const api = {
    room,
    pid,
    gameKey,

    pushScore(payload){
      // payload = {score, miss, accPct, medianRtGoodMs,...}
      state.you = payload || null;
      broadcastScore(payload || {});
      setStatus(state.status === 'connecting' ? 'ready' : state.status);
    },

    finalizeEnd(summary){
      // summary is the full game summary
      state.youEnd = summary || null;
      broadcastEnd(summary || {});
      // start forfeit timer if opp never ends
      if(!state.forfeitAt){
        state.forfeitAt = now() + (Number(opts.forfeitMs)||5000);
      }
      setStatus('ended');
      calcWinner();
      // keep checking until winner resolved
      const tick = ()=>{
        if(state.winner) return;
        calcWinner();
        if(!state.winner) setTimeout(tick, 250);
      };
      setTimeout(tick, 250);
    }
  };

  emit({
    room: state.room,
    status: state.status,
    you: '—',
    opp: '—',
    winner: '—'
  });

  return api;
}