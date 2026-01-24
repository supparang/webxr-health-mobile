// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR BOOT — PRODUCTION (Fair Pack)
// ✅ Reads query: view/run/diff/time/seed/hub/log/style/studyId/phase/conditionGroup/ts
// ✅ Sets body view class: view-pc / view-mobile / view-vr / view-cvr
// ✅ Boots engine: ./goodjunk.safe.js (FAIR PACK)
// ✅ Flush-hardened: best-effort end + logger flush on back/hide/unload
// ✅ Works with vr-ui.js (ENTER VR/EXIT/RECENTER + crosshair shoot => hha:shoot)

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
const has = (k)=>{ try{ return new URL(location.href).searchParams.has(k); }catch{ return false; } };

function clamp(v,min,max){
  v = Number(v);
  if(!Number.isFinite(v)) v = min;
  return Math.max(min, Math.min(max, v));
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');

  view = String(view||'').toLowerCase();
  if(view==='pc') b.classList.add('view-pc');
  else if(view==='mobile') b.classList.add('view-mobile');
  else if(view==='vr') b.classList.add('view-vr');
  else if(view==='cvr') b.classList.add('view-cvr');
}

function safeCall(fn){
  try{ fn && fn(); }catch(_){}
}

function nowMs(){
  return (performance && performance.now) ? performance.now() : Date.now();
}

let STARTED = false;
let ENDED = false;

// We keep last known summary to flush / store
let LAST_SUMMARY = null;

// ---- Flush hardened helpers ----
function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function tryEnd(reason){
  // Fair pack safe.js emits hha:end itself at timeup,
  // but for safety we allow “manual end” if leaving page early.
  if(ENDED) return;
  ENDED = true;

  // If engine already emitted end -> LAST_SUMMARY would be set by listener below
  if(!LAST_SUMMARY){
    LAST_SUMMARY = {
      game:'GoodJunkVR',
      pack:'fair',
      view: String(qs('view','mobile')||'mobile'),
      runMode: String(qs('run','play')||'play'),
      diff: String(qs('diff','normal')||'normal'),
      seed: String(qs('seed', Date.now())),
      durationPlannedSec: clamp(qs('time','80'), 20, 300),
      durationPlayedSec: null,
      scoreFinal: null,
      miss: null,
      comboMax: null,
      grade: null,
      reason: String(reason||'leave')
    };
  }

  emit('hha:end', LAST_SUMMARY);
}

function tryLoggerFlush(reason){
  // If your hha-cloud-logger exposes a flush function, call it.
  // We keep this as best-effort and non-breaking.
  safeCall(()=>{
    if(typeof WIN.HHA_LOGGER_FLUSH === 'function'){
      WIN.HHA_LOGGER_FLUSH({ reason: String(reason||'leave') });
    }
  });
}

// Listen to end summary from engine (source of truth)
WIN.addEventListener('hha:end', (ev)=>{
  LAST_SUMMARY = ev?.detail || LAST_SUMMARY;
  // store last summary (engine already stores too, but harmless)
  safeCall(()=> localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(LAST_SUMMARY)));
}, { passive:true });

// ---- Boot ----
function bootOnce(){
  if(STARTED) return;
  STARTED = true;

  const view = String(qs('view','mobile')||'mobile').toLowerCase();
  const run  = String(qs('run','play')||'play').toLowerCase();
  const diff = String(qs('diff','normal')||'normal').toLowerCase();
  const time = clamp(qs('time','80'), 20, 300);

  // seed: allow string or number; engine makeRNG(Number(seed)||Date.now())
  const seed = String(qs('seed', Date.now()));

  setBodyView(view);

  // Optional: expose context to logger (if your logger reads window.HHA_CTX)
  // NOTE: this does not break anything even if logger ignores it.
  WIN.HHA_CTX = {
    game:'GoodJunkVR',
    pack:'fair',
    view, run, diff, time, seed,
    hub: qs('hub', null),
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
    ts: qs('ts', null),
    log: qs('log', null),
    style: qs('style', null),
  };

  // Boot engine (FAIR PACK)
  engineBoot({ view, run, diff, time, seed });
}

function ready(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive'){
    setTimeout(fn, 0);
  }else{
    DOC.addEventListener('DOMContentLoaded', fn, { once:true });
  }
}

ready(bootOnce);

// ---- Flush hardened lifecycle ----
// 1) Back button / pagehide / visibilitychange: try to end + flush
WIN.addEventListener('pagehide', ()=>{
  tryEnd('pagehide');
  tryLoggerFlush('pagehide');
}, { passive:true });

WIN.addEventListener('beforeunload', ()=>{
  // NOTE: do minimal sync work here
  tryEnd('beforeunload');
  tryLoggerFlush('beforeunload');
});

DOC.addEventListener('visibilitychange', ()=>{
  if(DOC.hidden){
    // user switched app / minimized -> flush
    tryLoggerFlush('hidden');
  }
}, { passive:true });

// 2) If user clicks back hub button, A.html already navigates.
//    But we also flush on click to be safe.
DOC.addEventListener('click', (e)=>{
  const t = e?.target;
  if(!(t instanceof HTMLElement)) return;
  if(t.id === 'btnBackHub'){
    tryEnd('backhub');
    tryLoggerFlush('backhub');
  }
}, { passive:true });