// === /herohealth/api/hub-api-guard.js ===
// HeroHealth — HUB API Guard (Apollo 403 safe + offline fallback) — v20260214a
// ✅ Create Apollo safely (won't crash if missing / 403 / network)
// ✅ Provides safe loaders for hub state
// ✅ Falls back to localStorage if API unavailable

'use strict';

import { createApolloClientSafe, safeApolloQuery } from './apolloClient.safe.js';
import { showApiBanner, hideApiBanner } from './api-status.js';

function qs(k, d=null){
  try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; }
}

function readLS(key, fallback=null){
  try{
    const v = localStorage.getItem(key);
    if(v == null) return fallback;
    return JSON.parse(v);
  }catch(_){
    return fallback;
  }
}

function writeLS(key, obj){
  try{ localStorage.setItem(key, JSON.stringify(obj)); }catch(_){}
}

// ---- Default hub state (offline-safe) ----
export function defaultHubState(){
  return {
    ok: true,
    mode: 'offline',
    ts: Date.now(),
    zones: {
      nutrition: { doneWarmup:false, doneCooldown:false, score:0, grade:'—' },
      hygiene:   { doneWarmup:false, doneCooldown:false, score:0, grade:'—' },
      fitness:   { doneWarmup:false, doneCooldown:false, score:0, grade:'—' },
    },
    lastSummary: readLS('HHA_LAST_SUMMARY', null),
  };
}

// ---- Derive lightweight status from localStorage keys ----
function pidKey(){
  return String(qs('pid','') || '').trim() || 'anon';
}

function dayKey(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

function hasDaily(prefix, category, pid){
  const key = `${prefix}:${category}:${pid}:${dayKey()}`;
  try{ return localStorage.getItem(key) === '1'; }catch(_){ return false; }
}

function offlineZoneStatus(category){
  const pid = pidKey();
  const warm = hasDaily('HHA_WARMUP_DONE', category, pid);
  const cool = hasDaily('HHA_COOLDOWN_DONE', category, pid);

  const last = readLS('HHA_LAST_SUMMARY', null);
  let score = 0, grade = '—';
  if(last && last.category === category){
    score = Number(last.scoreFinal || 0) || 0;
    grade = String(last.grade || '—');
  }

  return { doneWarmup:warm, doneCooldown:cool, score, grade };
}

export function buildHubStateOffline(){
  const base = defaultHubState();
  base.zones.nutrition = offlineZoneStatus('nutrition');
  base.zones.hygiene   = offlineZoneStatus('hygiene');
  base.zones.fitness   = offlineZoneStatus('fitness');
  base.lastSummary = readLS('HHA_LAST_SUMMARY', null);
  return base;
}

// --------------------------------------------------
// Apollo (optional) — provide your real hub query here
// --------------------------------------------------

// ✅ IMPORTANT: คุณต้องใส่ query จริงที่ hub ใช้ (ของเดิมใน index.js)
// ผมทำ stub ให้: ถ้าไม่ใส่ query ก็จะทำงานแบบ offline อย่างเดียว
export function getHubQueryDocument(){
  // If you already have a gql doc elsewhere, import and return it.
  // Example:
  //   import { HUB_STATUS_QUERY } from '../graphql/queries.js';
  //   return HUB_STATUS_QUERY;
  return null;
}

// Normalize API response to hubState shape (safe)
function normalizeHubFromApi(apiData){
  // Adjust to match your backend schema
  // Example expectation:
  // apiData.hubStatus = { zones: {...}, lastSummary: {...} }
  const out = defaultHubState();
  out.mode = 'api';
  out.ts = Date.now();

  const hs = apiData?.hubStatus || apiData?.hub || null;
  if(!hs) return out;

  if(hs.zones){
    out.zones = Object.assign(out.zones, hs.zones);
  }
  if(hs.lastSummary){
    out.lastSummary = hs.lastSummary;
  }
  out.ok = true;
  return out;
}

// --------------------------------------------------
// MAIN: loadHubStateSafe
// --------------------------------------------------
export async function loadHubStateSafe(opts = {}){
  const useApi = String(qs('noapi','')).toLowerCase() !== '1'
    && String(qs('api','')).toLowerCase() !== 'off';

  // 1) Always compute offline state first (instant paint)
  const offline = buildHubStateOffline();

  // If caller wants immediate fallback
  if(opts.offlineOnly || !useApi){
    return offline;
  }

  // 2) Try API via Apollo (safe)
  const client = createApolloClientSafe({
    apiUrl: opts.apiUrl,
    Apollo: opts.Apollo,      // optional if bundler passes it
    onError: opts.onError     // optional if bundler passes it
  });

  // If Apollo missing or disabled, stay offline (but do not crash)
  if(!client){
    return offline;
  }

  const qdoc = opts.query || getHubQueryDocument();
  if(!qdoc){
    // no query doc => cannot query => offline
    showApiBanner({
      state:'warn',
      title:'Hub API (no query)',
      message:'ยังไม่ได้กำหนด GraphQL query สำหรับดึงสถานะ HUB → ใช้โหมด offline',
      onRetry: ()=>location.reload()
    });
    return offline;
  }

  const variables = Object.assign({
    pid: pidKey(),
    day: dayKey()
  }, (opts.variables || {}));

  const res = await safeApolloQuery(client, { query: qdoc, variables });

  if(res.ok && res.data){
    hideApiBanner();
    const hubState = normalizeHubFromApi(res.data);

    // cache latest api state
    writeLS('HHA_HUB_STATE_CACHE', hubState);
    return hubState;
  }

  // 3) API fail => try cached api state, else offline
  const cached = readLS('HHA_HUB_STATE_CACHE', null);
  if(cached && cached.zones){
    cached.mode = 'cache';
    cached.ts = Date.now();
    return cached;
  }

  return offline;
}