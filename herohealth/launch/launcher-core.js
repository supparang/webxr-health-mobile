// === /herohealth/launch/launcher-core.js — passthrough ctx + log (v20260217a) ===
'use strict';

function getQS(){
  try { return new URL(location.href).searchParams; }
  catch { return new URLSearchParams(); }
}
const QS = getQS();

function mergeParams(defaults){
  const out = Object.assign({}, defaults || {});
  QS.forEach((v,k)=>{ out[k] = v; });

  if (out.run && !out.runMode) out.runMode = out.run;
  if (out.mode && !out.runMode) out.runMode = out.mode;
  return out;
}

function buildUrl(target, params){
  const u = new URL(target, location.href);
  const sp = new URLSearchParams();
  Object.keys(params||{}).forEach(k=>{
    const v = params[k];
    if (v === undefined || v === null) return;
    const s = String(v);
    if (!s.trim()) return;
    sp.set(k, s);
  });
  u.search = sp.toString();
  return u.toString();
}

export function hhGo(target, opts={}){
  const merged = mergeParams((opts && opts.defaults) ? opts.defaults : {});
  const url = buildUrl(target, merged);
  location.replace(url);
}