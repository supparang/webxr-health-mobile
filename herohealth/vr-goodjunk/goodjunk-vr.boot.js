// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
'use strict';

import { boot } from './goodjunk.safe.js';

function qs(k, d=null){
  try { return new URL(location.href).searchParams.get(k) ?? d; }
  catch { return d; }
}

function normEnum(v, allowed, fallback){
  v = String(v ?? '').trim().toLowerCase();
  return allowed.includes(v) ? v : fallback;
}

function normView(v){
  v = String(v ?? '').trim().toLowerCase();
  if(v === 'cardboard') v = 'cvr';
  if(v === 'vr') v = 'cvr';
  if(v === 'phone') v = 'mobile';
  if(v === 'm') v = 'mobile';
  if(v === 'p') v = 'pc';
  return (v === 'pc' || v === 'mobile' || v === 'cvr') ? v : 'pc';
}

function normTime(v, fallback=80){
  const n = Number(v);
  if(!Number.isFinite(n)) return fallback;
  return Math.max(20, Math.min(300, Math.round(n)));
}

function normSeed(v){
  // keep as string for your makeRNG() (it does Number() inside)
  const s = String(v ?? '').trim();
  return s || String(Date.now());
}

function decodeMaybe(s, max=2){
  let out = String(s ?? '');
  for(let i=0;i<max;i++){
    try{
      const dec = decodeURIComponent(out);
      if(dec === out) break;
      out = dec;
    }catch(_){
      break;
    }
  }
  return out;
}

function normHub(h){
  // 1) get raw
  let hub = String(h ?? '').trim();
  if(!hub || hub === 'null' || hub === 'undefined') hub = '../hub.html';

  // 2) decode double-encoded hubs (พบบ่อยมาก)
  hub = decodeMaybe(hub, 3);

  // 3) if hub itself contains "hub=" nested, keep the outermost only (กันซ้อน)
  //    example: hub=.../hub.html?hub=https%3A...
  try{
    const u = new URL(hub, location.href);
    const nested = u.searchParams.get('hub');
    if(nested){
      // prefer outer URL (u) as hub; but remove nested hub param to stop recursion
      u.searchParams.delete('hub');
      hub = u.toString();
    }else{
      hub = u.toString();
    }
  }catch(_){
    // 4) if it's relative path, resolve from current file
    try{
      hub = new URL(hub, location.href).toString();
    }catch(__){
      hub = '../hub.html';
    }
  }
  return hub;
}

const opts = {
  view: normView(qs('view','pc')),
  run:  normEnum(qs('run','play'), ['play','study','research'], 'play'),
  diff: normEnum(qs('diff','normal'), ['easy','normal','hard'], 'normal'),
  time: normTime(qs('time','80'), 80),
  seed: normSeed(qs('seed', '')),
  hub:  normHub(qs('hub','../hub.html')),
  pid:  String(qs('pid','') || '').trim(),
  category: 'nutrition'
};

boot(opts);