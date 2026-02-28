// === /herohealth/vr/battle-rtdb.js ===
// HeroHealth Battle RTDB (optional) — realtime scoreboard + winner by score→acc→miss→medianRT
// Requires Firebase v9+ (modular) loaded via dynamic import from CDN OR your bundled build.
// You must provide window.HHA_BATTLE_CFG = { apiKey, authDomain, databaseURL, projectId, appId }
// FULL v20260228-BATTLE-RTDB
'use strict';

import { compareResults, normalizeResult } from './score-rank.js';

const WIN = (typeof window!=='undefined') ? window : globalThis;

function qs(k, d=''){
  try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; }
}

function now(){ return Date.now(); }

function safeId(s){
  s = String(s||'').trim();
  return s.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,32) || 'room';
}

async function loadFirebase(){
  // If you already bundle firebase, expose it on window to skip CDN imports
  if(WIN.firebase && WIN.firebase.initializeApp && WIN.firebase.getDatabase) return WIN.firebase;

  // CDN modular imports
  const appMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
  const dbMod  = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js');
  return Object.assign({}, appMod, dbMod);
}

function buildRoomPath(room){
  return `hha_battle_rooms/${safeId(room)}`;
}

export async function initBattle(opts){
  opts = opts || {};
  const enabled = String(opts.enabled ?? qs('battle','0')) === '1';
  if(!enabled) return null;

  const cfg = WIN.HHA_BATTLE_CFG || null;
  if(!cfg || !cfg.databaseURL){
    console.warn('[Battle] Missing window.HHA_BATTLE_CFG');
    return null;
  }

  const room = safeId(opts.room ?? qs('room',''));
  const pid  = String(opts.pid ?? qs('pid','anon')).trim() || 'anon';
  const game = String(opts.gameKey ?? opts.projectTag ?? qs('theme','') ?? '').trim() || 'game';
  const autostartMs = Number(opts.autostartMs ?? 3000) || 3000;
  const forfeitMs   = Number(opts.forfeitMs ?? 5000) || 5000;

  const fb = await loadFirebase();
  const app = fb.initializeApp(cfg, `hha-battle-${room}`);
  const db  = fb.getDatabase(app);

  const { ref, set, update, onValue, get, child } = fb;

  const roomPath = buildRoomPath(room);
  const roomRef  = ref(db, roomPath);
  const playersRef = ref(db, `${roomPath}/players`);
  const metaRef = ref(db, `${roomPath}/meta`);
  const stateRef = ref(db, `${roomPath}/state`);

  const myKey = safeId(pid);
  const myRef = ref(db, `${roomPath}/players/${myKey}`);

  let started = false;
  let ended = false;
  let opponentKey = null;

  async function ensureRoom(){
    // create meta if not exists
    try{
      const snap = await get(metaRef);
      if(!snap.exists()){
        await set(metaRef, {
          createdAt: now(),
          gameKey: game,
          rule: 'score→acc→miss→medianRT',
          autostartMs,
          forfeitMs
        });
      }
    }catch(e){}
  }

  async function join(){
    await ensureRoom();

    // Upsert myself
    await update(myRef, {
      pid,
      joinedAt: now(),
      lastSeen: now(),
      status: 'ready',
      score: 0, miss: 0, accPct: 0, shots: 0, hits: 0, medianRtGoodMs: 0
    });

    // detect opponent
    onValue(playersRef, (snap)=>{
      const v = snap.val() || {};
      const keys = Object.keys(v);
      opponentKey = keys.find(k=>k!==myKey) || null;

      try{
        WIN.dispatchEvent(new CustomEvent('hha:battle-players', { detail: { room, me: myKey, opponent: opponentKey, players:v } }));
      }catch(e){}

      // autostart when 2 players ready and not started
      if(keys.length >= 2 && !started && !ended){
        const allReady = keys.every(k=> (v[k]?.status||'') === 'ready');
        if(allReady){
          started = true;
          setTimeout(()=>{
            try{
              update(stateRef, { startedAt: now(), status:'started' });
            }catch(e){}
            try{
              WIN.dispatchEvent(new CustomEvent('hha:battle-start', { detail:{ room } }));
            }catch(e){}
          }, autostartMs);
        }
      }
    });

    // state updates
    onValue(stateRef, (snap)=>{
      const st = snap.val() || {};
      try{
        WIN.dispatchEvent(new CustomEvent('hha:battle-state', { detail: st }));
      }catch(e){}
    });
  }

  function pushScore(detail){
    if(ended) return;
    detail = detail || {};
    const payload = {
      lastSeen: now(),
      status: started ? 'playing' : 'ready',
      score: Number(detail.score||0),
      miss: Number(detail.miss||0),
      accPct: Number(detail.accPct||0),
      shots: Number(detail.shots||0),
      hits: Number(detail.hits||0),
      medianRtGoodMs: Number(detail.medianRtGoodMs||0),
    };
    update(myRef, payload).catch(()=>{});
  }

  async function finalizeEnd(summary){
    if(ended) return;
    ended = true;

    try{
      await update(myRef, {
        lastSeen: now(),
        status: 'ended',
        endSummary: summary || null
      });
    }catch(e){}

    // decide winner locally by pulling both players
    let players = {};
    try{
      const snap = await get(playersRef);
      players = snap.val() || {};
    }catch(e){}

    const keys = Object.keys(players);
    const aKey = keys[0] || myKey;
    const bKey = keys[1] || opponentKey;

    const a = players[aKey]?.endSummary || players[aKey] || {};
    const b = players[bKey]?.endSummary || players[bKey] || {};

    // normalize to comparator fields
    const A = {
      scoreFinal: a.scoreFinal ?? a.score ?? 0,
      accPct: a.accPct ?? 0,
      missTotal: a.missTotal ?? a.miss ?? 0,
      medianRtGoodMs: a.medianRtGoodMs ?? a.medianRtGoodMs ?? 0,
      pid: players[aKey]?.pid || a.pid || aKey
    };
    const B = {
      scoreFinal: b.scoreFinal ?? b.score ?? 0,
      accPct: b.accPct ?? 0,
      missTotal: b.missTotal ?? b.miss ?? 0,
      medianRtGoodMs: b.medianRtGoodMs ?? b.medianRtGoodMs ?? 0,
      pid: players[bKey]?.pid || b.pid || bKey
    };

    const cmp = compareResults(A, B);
    const winner = (cmp < 0) ? B : (cmp > 0) ? A : null;

    try{
      await update(stateRef, {
        endedAt: now(),
        status: 'ended',
        winner: winner ? winner.pid : 'tie',
        rule: 'score→acc→miss→medianRT',
        a: normalizeResult(A),
        b: normalizeResult(B)
      });
    }catch(e){}

    try{
      WIN.dispatchEvent(new CustomEvent('hha:battle-ended', {
        detail: { room, winner: winner ? winner.pid : 'tie', rule: 'score→acc→miss→medianRT', a:A, b:B }
      }));
    }catch(e){}
  }

  async function forfeit(){
    if(ended) return;
    ended = true;
    try{
      await update(myRef, { lastSeen: now(), status:'forfeit' });
      await update(stateRef, { endedAt: now(), status:'ended', winner: opponentKey ? (opponentKey) : 'opponent', by:'forfeit' });
    }catch(e){}
    try{
      WIN.dispatchEvent(new CustomEvent('hha:battle-ended', { detail: { room, winner:'opponent', by:'forfeit' } }));
    }catch(e){}
  }

  // watchdog: if opponent disappears => auto-win after forfeitMs
  let lastOpponentSeen = now();
  onValue(playersRef, (snap)=>{
    const v = snap.val() || {};
    const ok = opponentKey && v[opponentKey] && v[opponentKey].lastSeen;
    if(ok) lastOpponentSeen = Number(v[opponentKey].lastSeen)||now();
    const age = now() - lastOpponentSeen;
    if(started && !ended && opponentKey && age > forfeitMs){
      // opponent gone
      update(stateRef, { endedAt: now(), status:'ended', winner: pid, by:'opponent-timeout' }).catch(()=>{});
      ended = true;
      try{ WIN.dispatchEvent(new CustomEvent('hha:battle-ended', { detail:{ room, winner: pid, by:'opponent-timeout' } })); }catch(e){}
    }
  });

  await join();

  return {
    room, pid, game,
    pushScore,
    finalizeEnd,
    forfeit,
  };
}