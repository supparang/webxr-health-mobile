// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR BOOT — PRODUCTION (HHA Standard) — PATCH v20260209-cdDailyCatA
// ✅ Detect view: pc/mobile/vr/cvr (NO override)
// ✅ Mount layers (#gj-layer + optional #gj-layer-r)
// ✅ Starts by tap overlay -> dispatch hha:start (or auto-start if overlay missing)
// ✅ Cooldown Gate ON hha:end (once per day, by category cat=nutrition)
// ✅ Pass-through ctx: hub/run/diff/time/seed/pid/studyId/phase/conditionGroup/log + cat + cdGateUrl/cdur/cdDailyKey/warmDailyKey

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

// ------------------------------
// Daily helpers (for cooldown once/day)
// ------------------------------
function dayStamp(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function isDoneToday(key){
  if(!key) return false;
  try{ return localStorage.getItem(key) === dayStamp(); }catch(_){ return false; }
}

function buildUrl(base, add){
  try{
    const u = new URL(base, location.href);
    Object.entries(add||{}).forEach(([k,v])=>{
      if(v === undefined || v === null || v === '') return;
      u.searchParams.set(k, String(v));
    });
    return u.toString();
  }catch(_){
    return base || '';
  }
}

function boot(){
  const view = detectView();
  setBodyViewClass(view);

  const cat = String(qs('cat','nutrition')||'nutrition').toLowerCase();

  // daily keys may be passed from launcher; fallback by cat
  const warmDailyKey = String(qs('warmDailyKey', `HHA_WARMUP_DONE_DAY_${cat}`) || `HHA_WARMUP_DONE_DAY_${cat}`);
  const cdDailyKey   = String(qs('cdDailyKey',   `HHA_COOLDOWN_DONE_DAY_${cat}`) || `HHA_COOLDOWN_DONE_DAY_${cat}`);

  // cooldown gate routing hints (passed from launcher)
  const cdGateUrl = String(qs('cdGateUrl','../warmup-gate.html') || '../warmup-gate.html');
  const cdur      = qn('cdur', 20);

  const ctx = {
    view,
    cat,
    run: String(qs('run','play')).toLowerCase(),
    diff: String(qs('diff','normal')).toLowerCase(),
    time: qn('time', 80),
    seed: String(qs('seed', Date.now())),
    pid: String(qs('pid','')||''),
    studyId: String(qs('studyId','')||''),
    phase: String(qs('phase','')||''),
    conditionGroup: String(qs('conditionGroup','')||''),
    hub: String(qs('hub','../hub.html')||'../hub.html'),
    log: String(qs('log','')||''),
    warmDailyKey,
    cdDailyKey,
    cdGateUrl,
    cdur
  };

  applyCtxToUI(ctx);

  // ensure required layers exist
  const layerL = DOC.getElementById('gj-layer');
  const layerR = DOC.getElementById('gj-layer-r');

  // expose for debugging
  try{ WIN.GoodJunkVR_CTX = ctx; }catch(_){}

  // ------------------------------
  // Cooldown routing on end (once/day, by category)
  // ------------------------------
  let routed = false;

  function goHub(){
    try{ location.href = ctx.hub; }catch(_){}
  }

  function goCooldownGate(endDetail){
    // prevent loops / double triggers
    if(routed) return;
    routed = true;

    // If cooldown already done today, go hub directly.
    if(isDoneToday(ctx.cdDailyKey)){
      goHub();
      return;
    }

    const pass = {
      // keep research context
      view: qs('view','') ? undefined : ctx.view, // if user forced view in URL, don't change; gate doesn't need it anyway
      run: ctx.run,
      diff: ctx.diff,
      time: ctx.time,
      seed: ctx.seed,
      pid: ctx.pid,
      studyId: ctx.studyId,
      phase: ctx.phase,
      conditionGroup: ctx.conditionGroup,
      log: ctx.log,

      // category + daily keys for gate to stamp
      cat: ctx.cat,
      warmDailyKey: ctx.warmDailyKey,
      cdDailyKey: ctx.cdDailyKey,

      // gate controls
      phase_gate: undefined,
      phase: 'cooldown',
      cdur: ctx.cdur,
      hub: ctx.hub
    };

    // Optional: forward last game summary snapshot (small)
    try{
      if(endDetail && typeof endDetail === 'object'){
        if(endDetail.score != null) pass.lastScore = endDetail.score;
        if(endDetail.miss  != null) pass.lastMiss  = endDetail.miss;
        if(endDetail.grade != null) pass.lastGrade = endDetail.grade;
      }
    }catch(_){}

    const url = buildUrl(ctx.cdGateUrl, pass);
    if(url) location.replace(url);
    else goHub();
  }

  WIN.addEventListener('hha:end', (ev)=>{
    // Only handle once per run
    if(routed) return;
    // Some engines may emit multiple end signals; harden
    if(WIN.__GJ_CD_ROUTED__) return;
    WIN.__GJ_CD_ROUTED__ = true;

    const detail = (ev && ev.detail) ? ev.detail : null;
    goCooldownGate(detail);
  }, { passive:true });

  // ------------------------------
  // bind Start overlay
  // ------------------------------
  const ov = DOC.getElementById('startOverlay');
  const btn = DOC.getElementById('btnStart');

  function startNow(){
    safeHideStartOverlay();

    bootGame({
      view: ctx.view,
      run: ctx.run,
      diff: ctx.diff,
      time: ctx.time,
      seed: ctx.seed,
      layerL,
      layerR
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