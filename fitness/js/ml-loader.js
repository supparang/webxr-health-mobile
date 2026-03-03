// === /fitness/js/ml-loader.js ===
// PACK N: Safe weight loader + cache + versioning (no deps)
'use strict';

const KEY = 'SB_ML_WEIGHTS_CACHE_V1';

function safeJsonParse(text){
  try { return JSON.parse(text); } catch { return null; }
}

function isObj(x){ return x && typeof x === 'object' && !Array.isArray(x); }

function validateWeights(W){
  // minimal validation (don’t be strict, just safe)
  if(!isObj(W)) return false;
  if(!Array.isArray(W.features) || !W.features.length) return false;
  if(!isObj(W.fatigue) || !isObj(W.fatigue.w)) return false;
  if(!isObj(W.skill) || !isObj(W.skill.w)) return false;
  // bias may be missing → default 0 ok
  return true;
}

function getCache(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return null;
    const obj = safeJsonParse(raw);
    if(!obj || !obj.weights) return null;
    if(!validateWeights(obj.weights)) return null;
    return obj;
  }catch{
    return null;
  }
}

function setCache(weights){
  try{
    const obj = {
      savedAt: new Date().toISOString(),
      version: String(weights.version || ''),
      weights
    };
    localStorage.setItem(KEY, JSON.stringify(obj));
  }catch{}
}

function versionCmp(a,b){
  // simple lexicographic compare (ok for "v1","v2" not perfect semver)
  a = String(a||''); b = String(b||'');
  if(a === b) return 0;
  return a > b ? 1 : -1;
}

export async function loadWeightsSafe(opts = {}){
  const url = String(opts.url || '');
  const timeoutMs = Math.max(800, Math.min(8000, Number(opts.timeoutMs)||2200));
  const preferCache = opts.preferCache !== false;

  // 1) cache first
  const cache = preferCache ? getCache() : null;
  if(cache && cache.weights){
    return { ok:true, source:'cache', weights:cache.weights, version:cache.version || '' };
  }

  // 2) fetch
  if(!url) return { ok:false, source:'none', weights:null, version:'' };

  const ctrl = new AbortController();
  const t = setTimeout(()=> ctrl.abort(), timeoutMs);

  try{
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const txt = await res.text();
    const W = safeJsonParse(txt);
    if(!validateWeights(W)) throw new Error('Invalid weights schema');

    // update cache
    setCache(W);
    return { ok:true, source:'network', weights:W, version:String(W.version||'') };
  }catch(err){
    // fallback to cache if exists (even if preferCache=false)
    const c2 = getCache();
    if(c2 && c2.weights){
      return { ok:true, source:'cache-fallback', weights:c2.weights, version:c2.version || '' };
    }
    return { ok:false, source:'error', weights:null, version:'', error: String(err?.message || err) };
  }finally{
    clearTimeout(t);
  }
}

export function peekCachedWeights(){
  const c = getCache();
  return c ? { ok:true, weights:c.weights, version:c.version||'', savedAt:c.savedAt||'' } : { ok:false };
}

export function clearCachedWeights(){
  try{ localStorage.removeItem(KEY); }catch{}
}

export function updateCacheIfNewer(newWeights){
  try{
    if(!validateWeights(newWeights)) return false;
    const c = getCache();
    if(!c || !c.weights){
      setCache(newWeights);
      return true;
    }
    const oldV = String(c.version||'');
    const newV = String(newWeights.version||'');
    if(!oldV || versionCmp(newV, oldV) > 0){
      setCache(newWeights);
      return true;
    }
  }catch{}
  return false;
}