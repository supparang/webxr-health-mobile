// === /herohealth/vr/battle-rtdb.js ===
// Firebase RTDB Battle — v5.1 (serverTimeOffset + app reuse + single winner rule)
// ✅ Room (create/join via ?room=CODE)
// ✅ Ready-check + Countdown + StartAt (server-time aligned)
// ✅ Reconnect/Resume (reuse player key per room+pid)
// ✅ Soft anti-cheat (clamp score deltas + time guard)
// ✅ Forfeit on disconnect/timeout (forfeitMs)
// ✅ Rematch (same room -> new roundId)
// Emits:
//  - hha:battle-players {players[]}
//  - hha:battle-state   {phase, room, roundId, startAtMs, winner?}
//  - hha:battle-countdown {startAtMs, leftMs}
//  - hha:battle-start {startAtMs}
//  - hha:battle-ended {winner, reason, results}
// FULL v20260304-BATTLE-RTDB-V5_1
'use strict';

import { pickWinner as pickWinnerAB } from './score-rank.js';

const WIN = (typeof window !== 'undefined') ? window : globalThis;

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}
function qs(k, d=''){
  try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(_){ return d; }
}
function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); }
function safeKey(s, max=32){
  s = String(s||'').trim();
  s = s.replace(/[^a-zA-Z0-9_\-]/g,'').slice(0,max);
  return s || '';
}
function randRoom(len=6){
  const abc='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s='';
  for(let i=0;i<len;i++) s += abc[(Math.random()*abc.length)|0];
  return s;
}

// ---- Firebase loader (modular SDK via gstatic) ----
async function loadFirebase(){
  const v = '9.22.2';
  const appMod = await import(`https://www.gstatic.com/firebasejs/${v}/firebase-app.js`);
  const dbMod  = await import(`https://www.gstatic.com/firebasejs/${v}/firebase-database.js`);
  return { ...appMod, ...dbMod };
}

function getFirebaseConfig(){
  const cfg = WIN.HHA_FIREBASE_CONFIG || WIN.__HHA_FIREBASE_CONFIG__ || WIN.firebaseConfig || null;
  return cfg || null;
}

function lsGet(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k,String(v)); }catch(_){ } }

export async function initBattle(opts){
  opts = opts || {};
  const enabled = !!opts.enabled;
  if(!enabled) return disabledBattle();

  const pid = safeKey(opts.pid || qs('pid','anon'), 24) || 'anon';
  const gameKey = safeKey(opts.gameKey || 'game', 24) || 'game';
  const roomIn = safeKey(opts.room || qs('room',''), 10);
  const room = roomIn || randRoom(6);

  const autostartMs = clamp(opts.autostartMs ?? qs('autostart','3000'), 500, 10000);
  const forfeitMs   = clamp(opts.forfeitMs   ?? qs('forfeit','5000'), 1500, 20000);

  const fbCfg = getFirebaseConfig();