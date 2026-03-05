// === /herohealth/vr/hero-profile-cloud.js ===
// Hero Profile Cloud (Firebase RTDB) — OPTIONAL
// Uses same config discovery as battle-rtdb.js:
// window.HHA_FIREBASE_CONFIG / window.__HHA_FIREBASE_CONFIG__ / window.firebaseConfig
'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;

function getFirebaseConfig(){
  return WIN.HHA_FIREBASE_CONFIG || WIN.__HHA_FIREBASE_CONFIG__ || WIN.firebaseConfig || null;
}
function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); }
function safeKey(s, max=32){
  s = String(s||'').trim();
  s = s.replace(/[^a-zA-Z0-9_\-]/g,'').slice(0,max);
  return s || '';
}
async function loadFirebase(){
  const v = '9.22.2';
  const appMod = await import(`https://www.gstatic.com/firebasejs/${v}/firebase-app.js`);
  const dbMod  = await import(`https://www.gstatic.com/firebasejs/${v}/firebase-database.js`);
  return { ...appMod, ...dbMod };
}

let _fb = null;
async function getDb(){
  if(_fb && _fb.db) return _fb;
  const cfg = getFirebaseConfig();
  if(!cfg) throw new Error('HHA_FIREBASE_CONFIG missing');
  const fb = await loadFirebase();
  let app;
  try{
    app = fb.getApps().length ? fb.getApps()[0] : fb.initializeApp(cfg);
  }catch(_){
    app = fb.initializeApp(cfg);
  }
  const db = fb.getDatabase(app);
  _fb = { fb, app, db };
  return _fb;
}

function lvlFromXp(xp){
  xp = Math.max(0, Number(xp)||0);
  return Math.floor(xp / 50) + 1;
}

export async function syncProfileUp({ pid, profile }){
  pid = safeKey(pid, 24) || 'anon';
  profile = profile || {};
  const { fb, db } = await getDb();
  const ref = fb.ref(db, `herohealth/profiles/${pid}`);
  const data = {
    pid,
    nick: String(profile.nick||pid).trim().slice(0,24),
    xp: Math.max(0, Number(profile.xp)||0),
    lvl: lvlFromXp(profile.xp||0),
    updatedAt: Date.now()
  };
  await fb.update(ref, data);
  return { ok:true, profile:data };
}

export async function syncProfileDown({ pid }){
  pid = safeKey(pid, 24) || 'anon';
  const { fb, db } = await getDb();
  const ref = fb.ref(db, `herohealth/profiles/${pid}`);
  const snap = await fb.get(ref);
  const val = snap.exists() ? snap.val() : null;
  if(!val) return { ok:true, profile:null };
  return { ok:true, profile:val };
}

export async function addXp({ pid, nick, xpGain, meta }){
  pid = safeKey(pid, 24) || 'anon';
  xpGain = clamp(xpGain, 0, 25);
  const { fb, db } = await getDb();
  const ref = fb.ref(db, `herohealth/profiles/${pid}`);

  await fb.runTransaction(ref, (cur)=>{
    cur = cur && typeof cur==='object' ? cur : { pid };
    const xp0 = Math.max(0, Number(cur.xp)||0);
    const xp1 = xp0 + xpGain;
    cur.pid = pid;
    cur.nick = String(nick||cur.nick||pid).trim().slice(0,24);
    cur.xp = xp1;
    cur.lvl = lvlFromXp(xp1);
    cur.updatedAt = Date.now();
    return cur;
  });

  // optional: append event log
  try{
    const evRef = fb.push(fb.ref(db, `herohealth/profileEvents/${pid}`));
    await fb.set(evRef, {
      type:'xp',
      gain: xpGain,
      game: meta?.game || '',
      ts: meta?.ts || '',
      at: Date.now()
    });
  }catch(_){}

  return { ok:true };
}