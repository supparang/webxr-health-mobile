// === /herohealth/vr/battle-rtdb.js ===
// Firebase RTDB battle room: join/create, live score sync, autostart, end sync, forfeit
// + anti-cheat: clamp + rate-limit + sanitize summary
// FULL v20260228-BATTLE-RTDB-ANTICHEAT
'use strict';

import { pickWinner, normalizeResult } from './score-rank.js';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

function qs(k, d=''){ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } }
function now(){ return Date.now(); }
function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); }

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(e){}
}

function getCfg(){
  const cfg = WIN.HHA_BATTLE_CFG || null;
  return cfg;
}

async function loadFirebase(){
  const v = (WIN.HHA_FIREBASE_VERSION || '10.12.2');
  const base = `https://www.gstatic.com/firebasejs/${v}`;
  const appMod = await import(`${base}/firebase-app.js`);
  const dbMod  = await import(`${base}/firebase-database.js`);
  const authMod= await import(`${base}/firebase-auth.js`);
  return { appMod, dbMod, authMod };
}

async function ensureApp(){
  const cfg = getCfg();
  if(!cfg || !cfg.databaseURL){
    throw new Error('Missing HHA_BATTLE_CFG.databaseURL');
  }
  const { appMod } = await loadFirebase();
  const { initializeApp, getApps } = appMod;

  const apps = getApps();
  if(apps && apps.length) return apps[0];
  return initializeApp(cfg);
}

async function ensureDb(app){
  const { dbMod } = await loadFirebase();
  const { getDatabase } = dbMod;
  return getDatabase(app);
}

async function ensureAuth(app){
  const { authMod } = await loadFirebase();
  const { getAuth, signInAnonymously } = authMod;
  const auth = getAuth(app);
  try{
    if(!auth.currentUser){
      await signInAnonymously(auth);
    }
  }catch(e){}
  return auth;
}

function makeKey(){
  return `p_${Math.random().toString(36).slice(2,9)}_${now().toString(36)}`;
}

function safeRoom(room){
  room = String(room||'').trim();
  room = room.replace(/[^a-zA-Z0-9_-]/g,'').slice(0, 24);
  return room || `R${Math.random().toString(36).slice(2,8).toUpperCase()}`;
}

// ---- anti-cheat helpers ----
function clampScorePayload(payload){
  payload = payload || {};
  const score = clamp(payload.score, 0, 999999) | 0;
  const miss  = clamp(payload.miss, 0, 9999) | 0;
  const accPct= clamp(payload.accPct, 0, 100) | 0;
  const medRT = clamp(payload.medianRtGoodMs, 0, 5000) | 0;

  return {
    score, miss, accPct,
    medianRtGoodMs: medRT,
    lastSeen: now()
  };
}

function sanitizeEndSummary(s){
  s = s || {};
  return {
    pid: (s.pid!=null? String(s.pid): undefined),
    gameKey: (s.gameKey!=null? String(s.gameKey): undefined),
    zone: (s.zone!=null? String(s.zone): undefined),
    diff: (s.diff!=null? String(s.diff): undefined),
    runMode: (s.runMode!=null? String(s.runMode): undefined),
    seed: (s.seed!=null? String(s.seed): undefined),

    // scoreboard fields (clamped)
    scoreFinal: clamp(s.scoreFinal ?? s.score, 0, 999999) | 0,
    missTotal:  clamp(s.missTotal ?? s.miss, 0, 9999) | 0,
    accPct:     clamp(s.accPct ?? s.acc, 0, 100) | 0,
    medianRtGoodMs: clamp(s.medianRtGoodMs ?? s.medRT ?? s.medianRT, 0, 5000) | 0,

    // optional
    grade: (s.grade!=null? String(s.grade): undefined),
    reason: (s.reason!=null? String(s.reason): undefined),

    ts: clamp(s.ts ?? now(), 0, 9e15)
  };
}

export async function initBattle(opts){
  opts = opts || {};
  const enabled = !!opts.enabled;
  if(!enabled) return null;

  const room = safeRoom(opts.room || qs('room',''));
  const pid  = String(opts.pid || qs('pid','anon')).trim() || 'anon';
  const gameKey = String(opts.gameKey || 'unknown');

  const autostartMs = clamp(opts.autostartMs ?? Number(qs('autostart','3000'))||3000, 500, 15000);
  const forfeitMs   = clamp(opts.forfeitMs   ?? Number(qs('forfeit','5000'))||5000, 1000, 30000);

  const meKey = makeKey();

  const app = await ensureApp();
  const db  = await ensureDb(app);
  await ensureAuth(app);

  const { dbMod } = await loadFirebase();
  const {
    ref, child, set, update, onValue, onDisconnect, runTransaction, remove
  } = dbMod;

  const root = ref(db, `hha_battle/${gameKey}/${room}`);
  const playersRef = child(root, 'players');
  const stateRef   = child(root, 'state');

  // Join as player
  const myRef = child(playersRef, meKey);
  const joinedAt = now();

  await set(myRef, {
    pid,
    gameKey,
    joinedAt,
    lastSeen: joinedAt,
    score: 0,
    miss: 0,
    accPct: 0,
    medianRtGoodMs: 0,
    ended: false,
    endSummary: null
  });

  // Cleanup when disconnect
  try{ await onDisconnect(myRef).remove(); }catch(e){}

  // Create/init state if absent
  await runTransaction(stateRef, (cur)=>{
    if(cur) return cur;
    return {
      status: 'waiting',
      createdAt: joinedAt,
      startAt: null,
      endAt: null,
      rule: 'score→acc→miss→medianRT',
      autostartMs,
      forfeitMs
    };
  });

  const battle = {
    enabled: true,
    room,
    pid,
    gameKey,
    meKey,
    opponentKey: null,
    players: {},
    state: { status:'waiting' },
    pushScore,
    finalizeEnd,
    destroy
  };

  let unsubPlayers = null;
  let unsubState = null;

  unsubPlayers = onValue(playersRef, (snap)=>{
    const val = snap.val() || {};
    battle.players = val;

    const keys = Object.keys(val);
    const opp = keys.find(k=>k !== meKey) || null;
    battle.opponentKey = opp;

    emit('hha:battle-players', { room, me: meKey, opponent: opp, players: val });

    tryAutostart();
  }, (err)=> console.warn('[battle] players onValue err', err));

  unsubState = onValue(stateRef, (snap)=>{
    const s = snap.val() || { status:'waiting' };
    battle.state = s;
    emit('hha:battle-state', { room, ...s });

    if(String(s.status) === 'ended'){
      const p = battle.players || {};
      const keys = Object.keys(p);

      if(keys.length >= 2){
        const A = p[keys[0]]?.endSummary || p[keys[0]] || null;
        const B = p[keys[1]]?.endSummary || p[keys[1]] || null;

        const a = normalizeResult({ ...A, pid: p[keys[0]]?.pid, gameKey, room });
        const b = normalizeResult({ ...B, pid: p[keys[1]]?.pid, gameKey, room });

        const w = pickWinner(a, b);
        emit('hha:battle-ended', { room, a, b, winner: w.winner, rule: 'score→acc→miss→medianRT' });
      }
    }
  }, (err)=> console.warn('[battle] state onValue err', err));

  const pingInt = setInterval(()=>{
    try{ update(myRef, { lastSeen: now() }); }catch(e){}
  }, 2500);

  async function tryAutostart(){
    if(String(battle.state?.status||'') !== 'waiting') return;
    const p = battle.players || {};
    const keys = Object.keys(p);
    if(keys.length < 2) return;

    await runTransaction(stateRef, (cur)=>{
      cur = cur || {};
      if(cur.status !== 'waiting') return cur;
      const t0 = now() + autostartMs;
      return { ...cur, status:'started', startAt: t0 };
    });
  }

  // rate-limit pushScore (anti spam)
  let lastPushMs = 0;
  async function pushScore(payload){
    const t = now();
    if(t - lastPushMs < 250) return; // <= 4x/sec
    lastPushMs = t;

    try{
      const safe = clampScorePayload(payload);
      await update(myRef, safe);
    }catch(e){}
  }

  async function finalizeEnd(endSummary){
    const endedAt = now();
    const safeSummary = sanitizeEndSummary({ ...(endSummary||{}), ts: endedAt, pid, gameKey });

    try{
      await update(myRef, {
        ended: true,
        endSummary: safeSummary,
        // also mirror quick fields (optional)
        score: safeSummary.scoreFinal,
        miss: safeSummary.missTotal,
        accPct: safeSummary.accPct,
        medianRtGoodMs: safeSummary.medianRtGoodMs,
        lastSeen: endedAt
      });
    }catch(e){}

    const deadline = endedAt + forfeitMs;

    const timer = setInterval(async ()=>{
      const p = battle.players || {};
      const keys = Object.keys(p);
      const endedCount = keys.filter(k=> !!p[k]?.ended).length;

      if(keys.length < 2){
        clearInterval(timer);
        await runTransaction(stateRef, (cur)=>{
          cur = cur || {};
          if(cur.status === 'ended') return cur;
          return { ...cur, status:'ended', endAt: now(), forfeit: true };
        });
        return;
      }

      if(endedCount >= 2){
        clearInterval(timer);
        await runTransaction(stateRef, (cur)=>{
          cur = cur || {};
          if(cur.status === 'ended') return cur;
          return { ...cur, status:'ended', endAt: now(), forfeit: false };
        });
        return;
      }

      if(now() >= deadline){
        clearInterval(timer);
        await runTransaction(stateRef, (cur)=>{
          cur = cur || {};
          if(cur.status === 'ended') return cur;
          return { ...cur, status:'ended', endAt: now(), forfeit: true };
        });
      }
    }, 600);
  }

  async function destroy(){
    clearInterval(pingInt);
    try{ unsubPlayers && unsubPlayers(); }catch(e){}
    try{ unsubState && unsubState(); }catch(e){}
    try{ await remove(myRef); }catch(e){}
  }

  WIN.__HHA_BATTLE__ = battle;
  return battle;
}