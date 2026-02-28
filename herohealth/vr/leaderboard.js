// === /herohealth/vr/leaderboard.js ===
// Local Leaderboard (Top N) using score→acc→miss→medianRT
// FULL v20260228-LEADERBOARD
'use strict';

import { normalizeResult, sortBestFirst } from './score-rank.js';

const WIN = (typeof window!=='undefined') ? window : globalThis;

function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k, v); }catch(e){} }

function keyOf(meta){
  meta = meta || {};
  const g = String(meta.gameKey || meta.game || 'unknown').toLowerCase();
  const d = String(meta.diff || 'normal').toLowerCase();
  const r = String(meta.runMode || meta.run || 'play').toLowerCase();
  // keep separate per runMode if you want research/play separated
  return `HHA_LB:${g}:${d}:${r}`;
}

export function loadLeaderboard(meta){
  const k = keyOf(meta);
  const raw = lsGet(k);
  if(!raw) return [];
  try{
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  }catch(e){
    return [];
  }
}

export function saveLeaderboard(meta, arr){
  const k = keyOf(meta);
  const list = Array.isArray(arr) ? arr : [];
  lsSet(k, JSON.stringify(list));
}

export function addToLeaderboard(meta, summary, maxN=30){
  const list = loadLeaderboard(meta);
  const row = normalizeResult({
    pid: summary?.pid,
    gameKey: summary?.gameKey || meta?.gameKey,
    zone: summary?.zone,
    scoreFinal: summary?.scoreFinal,
    accPct: summary?.accPct,
    missTotal: summary?.missTotal,
    medianRtGoodMs: summary?.medianRtGoodMs,
    ts: Date.now(),
    diff: summary?.diff || meta?.diff,
    runMode: summary?.runMode || meta?.runMode
  });

  list.push(row);

  // sort best first and trim
  const sorted = sortBestFirst(list).slice(0, Math.max(5, Number(maxN)||30));
  saveLeaderboard(meta, sorted);
  return sorted;
}

export function clearLeaderboard(meta){
  saveLeaderboard(meta, []);
}