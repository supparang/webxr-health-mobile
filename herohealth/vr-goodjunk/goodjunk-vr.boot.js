// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (Fair Pack)
// ✅ Auto view detect when view=auto (pc/mobile/vr/cvr)
// ✅ Sets body class: view-pc/view-mobile/view-vr/view-cvr
// ✅ Calls goodjunk.safe.js boot(opts)
// ✅ Hooks basic logging if ../vr/hha-cloud-logger.js exposes window.HHACloudLogger
// ✅ Flush-hardened: try flush on visibilitychange/beforeunload (best-effort)

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
const has = (k)=>{ try{ return new URL(location.href).searchParams.has(k); }catch(_){ return false; } };

function clamp(v,min,max){ v = Number(v)||0; return Math.max(min, Math.min(max, v)); }

function isLikelyMobileUA(){
  const ua = (navigator.userAgent||'').toLowerCase();
  return /android|iphone|ipad|ipod|mobile|silk/.test(ua);
}

function normalizeView(v){
  v = String(v||'').toLowerCase();
  if(v === 'cardboard') return 'vr';
  if(v === 'view-cvr') return 'cvr';
  if(v === 'cvr') return 'cvr';
  if(v === 'vr') return 'vr';
  if(v === 'mobile') return 'mobile';
  if(v === 'pc') return 'pc';
  return 'auto';
}

async function detectView(){
  // if user explicitly passed view, DO NOT override
  if(has('view')) return normalizeView(qs('view','auto'));

  // soft remember
  try{
    const last = localStorage.getItem('HHA_LAST_VIEW');
    if(last) return normalizeView(last);
  }catch(_){}

  // baseline guess
  let guess = isLikelyMobileUA() ? 'mobile' : 'pc';

  // best-effort: if WebXR immersive-vr supported => treat mobile as vr
  try{
    if(navigator.xr && typeof navigator.xr.isSessionSupported === 'function'){
      const ok = await navigator.xr.isSessionSupported('immersive-vr');
      if(ok) guess = isLikelyMobileUA() ? 'vr' : 'pc';
    }
  }catch(_){}

  return normalizeView(guess);
}

function setBodyView(view){
  const b = DOC.body;
  if(!b) return;

  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view === 'pc') b.classList.add('view-pc');
  else if(view === 'mobile') b.classList.add('view-mobile');
  else if(view === 'cvr') b.classList.add('view-cvr');
  else if(view === 'vr') b.classList.add('view-vr');
  else b.classList.add(isLikelyMobileUA() ? 'view-mobile' : 'view-pc');
}

function makeSessionId(){
  // stable-ish unique
  const a = Math.random().toString(16).slice(2);
  const b = Date.now().toString(16);
  return `gj_${b}_${a}`.slice(0, 32);
}

function initLogger(ctx){
  // Optional logger bridge: depends on your implementation in ../vr/hha-cloud-logger.js
  // We'll support common shapes defensively.
  const L = WIN.HHACloudLogger || WIN.__HHA_CLOUD_LOGGER__ || null;
  if(!L) return null;

  try{
    if(typeof L.init === 'function') L.init(ctx);
    else if(typeof L.start === 'function') L.start(ctx);
  }catch(_){}

  // forward events (best-effort)
  const onAny = (name)=> (ev)=>{
    try{
      const detail = ev?.detail ?? null;
      if(typeof L.logEvent === 'function') L.logEvent(name, detail);
      else if(typeof L.emit === 'function') L.emit(name, detail);
    }catch(_){}
  };

  const events = ['hha:start','hha:time','hha:score','hha:judge','hha:end','hha:shoot'];
  for(const e of events){
    try{ WIN.addEventListener(e, onAny(e), { passive:true }); }catch(_){}
  }

  const flush = ()=>{
    try{
      if(typeof L.flush === 'function') L.flush();
      else if(typeof L.close === 'function') L.close();
    }catch(_){}
  };

  // flush-hardened
  try{
    DOC.addEventListener('visibilitychange', ()=>{
      if(DOC.visibilityState === 'hidden') flush();
    }, { passive:true });
  }catch(_){}
  try{ WIN.addEventListener('beforeunload', flush); }catch(_){}

  return { flush };
}

(async function main(){
  // read params
  const run  = String(qs('run','play')||'play').toLowerCase();
  const diff = String(qs('diff','normal')||'normal').toLowerCase();
  const time = clamp(qs('time','80'), 20, 300);
  const seed = String(qs('seed', Date.now()));
  const hub  = qs('hub', null);
  const style = qs('style', null);
  const log = qs('log', null);
  const studyId = qs('studyId', qs('study', null));
  const phase = qs('phase', null);
  const conditionGroup = qs('conditionGroup', qs('cond', null));
  const ts = qs('ts', null);

  // view: if view=auto or missing => detect
  let view = normalizeView(qs('view','auto'));
  if(view === 'auto') view = await detectView();

  // remember chosen view ONLY when user didn't force view=
  if(!has('view')){
    try{ localStorage.setItem('HHA_LAST_VIEW', view); }catch(_){}
  }

  setBodyView(view);

  // optional: update chip meta (if present)
  try{
    const meta = DOC.getElementById('gjChipMeta');
    if(meta) meta.textContent = `view=${view} · run=${run} · diff=${diff} · time=${time}`;
  }catch(_){}

  // prepare ctx for logger + engine
  const ctx = {
    game: 'GoodJunkVR',
    pack: 'fair',
    view, run, diff, time,
    seed,
    hub,
    style,
    log,
    studyId,
    phase,
    conditionGroup,
    ts,
    sessionId: makeSessionId(),
    url: String(location.href)
  };

  // init logger (best-effort)
  const logger = initLogger(ctx);

  // start engine
  try{
    engineBoot({
      view,
      run,
      diff,
      time,
      seed,
      hub,
      style,
      log,
      studyId,
      phase,
      conditionGroup,
      ts,
      sessionId: ctx.sessionId
    });
  }catch(err){
    console.error('[GoodJunkVR boot] engine error:', err);
    try{ alert('เกิดข้อผิดพลาดในการเริ่มเกม (ดู Console)'); }catch(_){}
    try{ logger?.flush?.(); }catch(_){}
  }
})();