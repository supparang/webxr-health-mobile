// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR BOOT — PRODUCTION (HHA Standard)
// ✅ Detect view: pc/mobile/vr/cvr (NO override)
// ✅ Mount layers (#gj-layer + optional #gj-layer-r)
// ✅ Pass-through ctx: hub/run/diff/time/seed/pid/studyId/phase/conditionGroup/log
// ✅ Starts by tap overlay -> dispatch hha:start (or auto-start if overlay missing)
// ✅ NEW: Daily Warmup Gate (per PID) by CATEGORY (nutrition)
//    - once/day: if not done -> redirect to warmup-gate.html (phase=warmup, next=RUN)
//    - if wType/wPct already present => assume gate passed (no redirect)
// ✅ Back-to-hub helper via ?hub=...

'use strict';

import { boot as bootGame } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, d=null){
  try{ return new URL(location.href).searchParams.get(k) ?? d; }
  catch{ return d; }
}
function qn(k, d=0){
  const v = Number(qs(k, d));
  return Number.isFinite(v) ? v : Number(d)||0;
}

function setBodyViewClass(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view==='pc') b.classList.add('view-pc');
  else if(view==='vr') b.classList.add('view-vr');
  else if(view==='cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');
}

function detectView(){
  // IMPORTANT: do NOT override if URL already provides view
  const v = String(qs('view','')||'').toLowerCase();
  if(v==='pc' || v==='mobile' || v==='vr' || v==='cvr') return v;

  // heuristic detect
  const isCoarse = WIN.matchMedia ? WIN.matchMedia('(pointer: coarse)').matches : false;
  const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints > 0);

  // WebXR presence => prefer vr (but keep mobile if user is on phone without entering XR)
  const hasXR = !!(navigator.xr);
  const small = Math.min(WIN.innerWidth||9999, WIN.innerHeight||9999) < 620;

  if(hasXR && !small) return 'vr';
  if(isCoarse || isTouch || small) return 'mobile';
  return 'pc';
}

function applyCtxToUI(ctx){
  try{
    const el = DOC.getElementById('gj-pill-view');
    if(el) el.textContent = ctx.view || '';
  }catch(_){}
}

function dispatchStart(){
  try{
    WIN.dispatchEvent(new CustomEvent('hha:start', { detail:{ game:'goodjunk' } }));
  }catch(_){}
}

function safeHideStartOverlay(){
  const ov = DOC.getElementById('startOverlay');
  if(ov) ov.hidden = true;
}

function isOverlayActuallyVisible(el){
  try{
    if(!el) return false;
    if(el.hidden) return false;
    const cs = getComputedStyle(el);
    if(cs.display === 'none') return false;
    if(cs.visibility === 'hidden') return false;
    if(Number(cs.opacity||'1') <= 0) return false;
    const r = el.getBoundingClientRect();
    if(r.width < 2 || r.height < 2) return false;
    return true;
  }catch(_){
    return true;
  }
}

// -----------------------------
// Daily Gate helpers (by PID + category)
// -----------------------------
function getLocalDayKey(){
  // Asia/Bangkok implied by device locale, but we still compute "YYYY-MM-DD" local
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

function hasGateBuffInQS(){
  // if already passed gate it sends wType/wPct/... (at least one)
  const wType = qs('wType','');
  const wPct  = qs('wPct','');
  const rank  = qs('rank','');
  const wCrit = qs('wCrit','');
  const wDmg  = qs('wDmg','');
  const wHeal = qs('wHeal','');
  const calm  = qs('calm','');
  return !!(wType || wPct || rank || wCrit || wDmg || wHeal || calm);
}

function dailyKey(prefix, category, pid){
  const day = getLocalDayKey();
  const p = (pid || 'anon').trim() || 'anon';
  return `${prefix}:${category}:${p}:${day}`;
}

function markDailyDone(prefix, category, pid){
  try{ localStorage.setItem(dailyKey(prefix, category, pid), '1'); }catch(_){}
}
function isDailyDone(prefix, category, pid){
  try{ return localStorage.getItem(dailyKey(prefix, category, pid)) === '1'; }
  catch(_){ return false; }
}

function buildUrl(base, params){
  const u = new URL(base, location.href);
  Object.entries(params||{}).forEach(([k,v])=>{
    if(v === undefined || v === null || v === '') return;
    u.searchParams.set(k, String(v));
  });
  return u.toString();
}

// Warmup gate routing (daily)
function maybeGoWarmupGate(ctx){
  // Category for GoodJunk
  const category = 'nutrition';

  // Allow forcing on/off (optional)
  //  - warmupDaily=1 => enforce daily warmup (default ON if absent)
  //  - warmupDaily=0 => skip
  const warmupDaily = String(qs('warmupDaily','1')).toLowerCase();
  const enforce = !(warmupDaily === '0' || warmupDaily === 'false' || warmupDaily === 'no');

  // If we already have gate buff => assume passed (no redirect)
  if(hasGateBuffInQS()) return false;

  if(!enforce) return false;

  // Daily check by PID
  const pid = ctx.pid || 'anon';
  const done = isDailyDone('HHA_WARMUP_DONE', category, pid);
  if(done) return false;

  // Gate page + next=RUN (current page)
  const gateUrl = String(qs('gateUrl','../warmup-gate.html') || '../warmup-gate.html');

  // duration
  const dur = Math.max(5, Math.min(60, qn('dur', 20) || 20));

  // Build next = current URL without looping flags
  const cur = new URL(location.href);
  // strip flags that would keep redirecting
  cur.searchParams.delete('preGate');
  cur.searchParams.delete('gate');
  cur.searchParams.delete('gateUrl');
  cur.searchParams.delete('gate_page');
  // Keep warmupDaily as-is
  const next = cur.toString();

  const gateParams = {
    phase: 'warmup',
    dur: String(dur),
    next,
    hub: ctx.hub || '',
    // Let gate know category + pid for its own logs (optional)
    category,
    pid
  };

  const urlGate = buildUrl(gateUrl, gateParams);
  location.replace(urlGate);
  return true;
}

function boot(){
  const view = detectView();
  setBodyViewClass(view);

  const ctx = {
    view,
    run: String(qs('run','play')).toLowerCase(),
    diff: String(qs('diff','normal')).toLowerCase(),
    time: qn('time', 80),
    seed: String(qs('seed', Date.now())),
    pid: String(qs('pid','')||''),
    studyId: String(qs('studyId','')||''),
    phase: String(qs('phase','')||''),
    conditionGroup: String(qs('conditionGroup','')||''),
    hub: String(qs('hub','../hub.html')||'../hub.html'),
    log: String(qs('log','')||'')
  };

  applyCtxToUI(ctx);

  // ✅ Daily warmup gate (nutrition) — redirect before starting engine
  if(maybeGoWarmupGate(ctx)) return;

  // ensure required layers exist
  const layerL = DOC.getElementById('gj-layer');
  const layerR = DOC.getElementById('gj-layer-r');

  // expose for debugging
  try{ WIN.GoodJunkVR_CTX = ctx; }catch(_){}

  // bind Start overlay
  const ov = DOC.getElementById('startOverlay');
  const btn = DOC.getElementById('btnStart');

  function startNow(){
    safeHideStartOverlay();

    // start engine
    bootGame({
      view: ctx.view,
      run: ctx.run,
      diff: ctx.diff,
      time: ctx.time,
      seed: ctx.seed,
      layerL,
      layerR,
      // pass ctx for end-summary routing
      pid: ctx.pid,
      hub: ctx.hub
    });

    dispatchStart();
  }

  if(btn){
    btn.addEventListener('click', (e)=>{
      e.preventDefault();
      startNow();
    });
  }

  // tap anywhere start (if overlay uses full screen)
  if(ov){
    ov.addEventListener('pointerdown', (e)=>{
      const t = e.target;
      if(t && (t.id === 'btnStart')) return;
      startNow();
    }, { passive:true });
  }

  // Harden: overlay might exist but not visible -> auto-start
  setTimeout(()=>{
    const visible = isOverlayActuallyVisible(ov);
    if(!visible){
      startNow();
    }
  }, 240);

  // back hub buttons (if any)
  DOC.querySelectorAll('.btnBackHub').forEach((b)=>{
    b.addEventListener('click', ()=>{
      location.href = ctx.hub;
    });
  });
}

if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', boot);
}else{
  boot();
}