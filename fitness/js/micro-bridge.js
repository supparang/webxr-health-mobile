// === /fitness/js/micro-bridge.js ===
// Local-only micro events bridge (no server). Works for PC/Mobile/cVR.
// Emits: window.dispatchEvent('hh:micro') + parent.postMessage({type:'HHA_MICRO'})

'use strict';

function getQS(){
  try{ return new URL(location.href).searchParams; }
  catch{ return new URLSearchParams(); }
}
const QS = getQS();
const q = (k, d='') => (QS.get(k) ?? d);

function fnv1a32(str){
  let h = 0x811c9dc5;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = (h + ((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))) >>> 0;
  }
  return h >>> 0;
}
function uidShort(){
  return fnv1a32(String(Date.now()) + Math.random()).toString(36);
}

export function MicroBridge(gameName, opts={}){
  const t0 = performance.now();
  const base = {
    v: 1,
    game: gameName,
    sessionId: q('sessionId','') || (opts.sessionId||''),
    pid: q('pid','anon') || (opts.pid||'anon'),
    studyId: q('studyId','') || (opts.studyId||''),
    phase: q('phase','') || (opts.phase||''),
    conditionGroup: q('conditionGroup','') || (opts.conditionGroup||''),
    seed: q('seed','') || (opts.seed||''),
    classRoom: q('classRoom','') || (opts.classRoom||''),
    siteCode: q('siteCode','') || (opts.siteCode||''),
    run: q('run','play') || (opts.run||'play'),
    microSession: uidShort()
  };

  const rate = {
    warnMs: 250,   // max 4 Hz
    tickMs: 180    // generic spam guard
  };
  let lastWarn = 0;
  let lastTick = 0;

  function emit(type, meta){
    const now = performance.now();
    if(type === 'warn' && (now-lastWarn) < rate.warnMs) return;
    if((now-lastTick) < rate.tickMs && (type === 'hit' || type === 'miss')) {
      // กัน double tap spam
      return;
    }
    if(type === 'warn') lastWarn = now;
    if(type === 'hit' || type === 'miss') lastTick = now;

    const payload = Object.assign({}, base, {
      type,
      t_ms: Math.round(now - t0),
      at: Date.now(),
      meta: meta || null
    });

    // same-window event
    try{ window.dispatchEvent(new CustomEvent('hh:micro', { detail: payload })); }catch(_){}

    // iframe parent (planner launcher)
    try{
      if(window.parent && window.parent !== window){
        window.parent.postMessage({ type:'HHA_MICRO', payload }, '*');
      }
    }catch(_){}
  }

  return { emit, base };
}