// === /herohealth/badges.safe.js ===
// HeroHealth Badges — SAFE (V2 by pid + V1 fallback)
// ✅ awardBadge(gameKey, badgeId, meta?) => true if newly awarded
// ✅ hasBadge(gameKey, badgeId) => boolean (checks pid scope if pid exists, else global)
// ✅ listBadges({scope:'pid'|'global'}) => flattened list
// ✅ migrateGlobalToPid(pid?) => {ok,moved}
// ✅ getPid() / ensurePidInUrlIfMissing() helpers

'use strict';

const LS_V1 = 'HHA_BADGES_V1';
const LS_V2 = 'HHA_BADGES_BY_PID_V2';
const LS_PID = 'HHA_PID_V1';

function now(){ return Date.now(); }

function loadJSON(key){
  try{ return JSON.parse(localStorage.getItem(key)||'{}') || {}; }catch(_){ return {}; }
}
function saveJSON(key, obj){
  try{ localStorage.setItem(key, JSON.stringify(obj||{})); }catch(_){}
}

function getQS(){
  try{ return new URL(location.href).searchParams; }catch(_){ return new URLSearchParams(); }
}

export function getPid(){
  const q = getQS();
  const pidUrl = String(q.get('pid')||'').trim();
  if(pidUrl){
    try{ localStorage.setItem(LS_PID, pidUrl); }catch(_){}
    return pidUrl;
  }
  try{ return String(localStorage.getItem(LS_PID)||'').trim(); }catch(_){ return ''; }
}

export function ensurePidInUrlIfMissing(pid){
  const u = new URL(location.href);
  const cur = String(u.searchParams.get('pid')||'').trim();
  if(cur) return { changed:false, pid:cur, url:u.toString() };
  u.searchParams.set('pid', String(pid||'').trim());
  return { changed:true, pid:String(pid||'').trim(), url:u.toString() };
}

function emitBadge(detail){
  try{ window.dispatchEvent(new CustomEvent('hha:badge', { detail })); }catch(_){}
}

function ensureV2Bucket(v2, pid){
  if(!v2[pid]) v2[pid] = {};
  return v2[pid];
}

function ensureGameBucket(obj, gameKey){
  if(!obj[gameKey]) obj[gameKey] = {};
  return obj[gameKey];
}

export function awardBadge(gameKey, badgeId, meta=null){
  const g = String(gameKey||'').trim();
  const id = String(badgeId||'').trim();
  if(!g || !id) return false;

  const pid = getPid();
  const ts = now();

  // V2 by pid (preferred)
  if(pid){
    const v2 = loadJSON(LS_V2);
    const bucket = ensureV2Bucket(v2, pid);
    const game = ensureGameBucket(bucket, g);

    if(game[id]) return false; // no override
    game[id] = { ts, meta: meta || null };
    saveJSON(LS_V2, v2);

    emitBadge({ scope:'pid', pid, game:g, id, ts, meta: meta || null });
    return true;
  }

  // fallback V1 global
  const v1 = loadJSON(LS_V1);
  const game = ensureGameBucket(v1, g);
  if(game[id]) return false;
  game[id] = { ts, meta: meta || null };
  saveJSON(LS_V1, v1);

  emitBadge({ scope:'global', pid:'', game:g, id, ts, meta: meta || null });
  return true;
}

export function hasBadge(gameKey, badgeId){
  const g = String(gameKey||'').trim();
  const id = String(badgeId||'').trim();
  if(!g || !id) return false;

  const pid = getPid();
  if(pid){
    const v2 = loadJSON(LS_V2);
    return !!(v2[pid] && v2[pid][g] && v2[pid][g][id]);
  }
  const v1 = loadJSON(LS_V1);
  return !!(v1[g] && v1[g][id]);
}

export function listBadges(opts={}){
  const scope = (opts.scope||'').toLowerCase() || (getPid() ? 'pid' : 'global');
  const pid = getPid();

  let src = {};
  if(scope === 'pid' && pid){
    const v2 = loadJSON(LS_V2);
    src = v2[pid] || {};
  } else {
    src = loadJSON(LS_V1);
  }

  const items = [];
  for(const game of Object.keys(src)){
    const badges = src[game] || {};
    for(const id of Object.keys(badges)){
      const b = badges[id] || {};
      items.push({ game, id, ts: Number(b.ts||0), meta: b.meta || null, scope });
    }
  }
  items.sort((a,b)=> (b.ts||0)-(a.ts||0));
  return items;
}

export function migrateGlobalToPid(pidArg=''){
  const pid = String(pidArg||getPid()||'').trim();
  if(!pid) return { ok:false, moved:0, msg:'no pid' };

  const v1 = loadJSON(LS_V1);
  const v2 = loadJSON(LS_V2);
  const bucket = ensureV2Bucket(v2, pid);

  let moved = 0;
  for(const game of Object.keys(v1)){
    const g1 = v1[game] || {};
    const g2 = ensureGameBucket(bucket, game);
    for(const id of Object.keys(g1)){
      if(g2[id]) continue;
      g2[id] = g1[id];
      moved++;
    }
  }
  saveJSON(LS_V2, v2);
  return { ok:true, moved };
}