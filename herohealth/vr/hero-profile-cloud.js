// === /herohealth/vr/hero-profile-cloud.js ===
// Hero Profile Cloud (Firebase RTDB) — v1
// Requires: Firebase app initialized somewhere OR provide config here (see initCloud()).

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;

function nowIso(){ try{ return new Date().toISOString(); }catch{ return ''; } }
function clampInt(v,a,b,d){ v=Number(v); if(!Number.isFinite(v)) return d; return Math.max(a, Math.min(b, Math.floor(v))); }

let _ready = false;
let _db = null;

/**
 * initCloud({ db }) OR initCloud({ firebaseConfig })
 * - If your battle-rtdb.js already initializes firebase + gives you db, pass {db}.
 * - Else pass firebaseConfig and this module will init firebase app/db itself.
 */
export async function initCloud(opts={}){
  if(_ready) return { ok:true, db:_db };

  // Case A) You already have db from your battle module
  if(opts.db){
    _db = opts.db;
    _ready = true;
    return { ok:true, db:_db };
  }

  // Case B) self-init firebase (CDN ESM)
  const cfg = opts.firebaseConfig;
  if(!cfg) return { ok:false, error:'Missing firebaseConfig or db' };

  // Use Firebase modular SDK via CDN
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
  const { getDatabase } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js');

  const app = initializeApp(cfg);
  _db = getDatabase(app);
  _ready = true;
  return { ok:true, db:_db };
}

function assertReady(){
  if(!_ready || !_db) throw new Error('hero-profile-cloud not initialized. Call initCloud() first.');
}

function pathProfile(pid){
  pid = String(pid||'anon').trim() || 'anon';
  return `herohealth/profiles/${encodeURIComponent(pid)}`;
}

export async function loadProfile(pid){
  assertReady();
  const { ref, get, child } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js');
  const r = ref(_db);
  const snap = await get(child(r, pathProfile(pid)));
  if(!snap.exists()) return null;
  return snap.val();
}

export async function saveProfile(pid, profile){
  assertReady();
  const { ref, set } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js');
  pid = String(pid||'anon').trim() || 'anon';

  const data = {
    pid,
    nick: String(profile?.nick||pid).slice(0,40),
    heroKey: String(profile?.heroKey||'hero1').slice(0,30),
    level: clampInt(profile?.level, 1, 99, 1),
    xp: clampInt(profile?.xp, 0, 999999, 0),
    updatedAt: nowIso(),
  };

  await set(ref(_db, pathProfile(pid)), data);
  return data;
}

/**
 * addXP(pid, deltaXP, levelingFn?)
 * levelingFn: (level, xp) => {level, xp} after applying rule
 */
export async function addXP(pid, deltaXP, levelingFn){
  assertReady();
  pid = String(pid||'anon').trim() || 'anon';
  const cur = (await loadProfile(pid)) || { pid, nick: pid, heroKey:'hero1', level:1, xp:0 };

  let level = clampInt(cur.level,1,99,1);
  let xp = clampInt(cur.xp,0,999999,0) + clampInt(deltaXP, -999999, 999999, 0);

  // default leveling: 50xp per level (เหมือนในภาพของคุณ)
  const fn = levelingFn || ((lv, x)=>{
    while(x >= 50 && lv < 99){ x -= 50; lv += 1; }
    if(x < 0){ x = 0; }
    return { level: lv, xp: x };
  });

  const after = fn(level, xp);
  const saved = await saveProfile(pid, { ...cur, ...after });
  return saved;
}