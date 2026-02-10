// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR BOOT — PRODUCTION (HHA Standard) — FULL v20260209a
// ✅ Detect view: pc/mobile/vr/cvr (NO override if ?view exists)
// ✅ Mount layers (#gj-layer + optional #gj-layer-r)
// ✅ Starts by overlay -> boot engine (goodjunk.safe.js)
// ✅ Handles end-flow:
//    1) Show End Summary overlay (read from goodjunk.safe.js summary keys)
//    2) If first cooldown today (per-user + per-category) -> go cooldown gate
//    3) Else -> back HUB
// ✅ Cooldown once/day per-user per-category (cat=nutrition|hygiene|exercise)
// ✅ Does NOT emit hha:start (engine emits it already) — avoid duplicate logs

'use strict';

import { boot as bootGame } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

// -----------------------------
// QS utils
// -----------------------------
function qs(k, d = null){
  try{ return new URL(location.href).searchParams.get(k) ?? d; }
  catch{ return d; }
}
function qn(k, d = 0){
  const v = Number(qs(k, d));
  return Number.isFinite(v) ? v : Number(d) || 0;
}
function hasQS(k){
  try{ return new URL(location.href).searchParams.has(k); }
  catch{ return false; }
}
function absUrlMaybe(url){
  if(!url) return '';
  try{ return new URL(url, location.href).toString(); }
  catch(_){ return String(url); }
}
function buildUrl(base, params){
  const u = new URL(base, location.href);
  Object.entries(params || {}).forEach(([k,v])=>{
    if(v === undefined || v === null || v === '') return;
    u.searchParams.set(k, String(v));
  });
  return u.toString();
}
function clampInt(v, a, b, def){
  const n = Number(v);
  if(!Number.isFinite(n)) return def;
  return Math.max(a, Math.min(b, Math.floor(n)));
}

// -----------------------------
// View detect
// -----------------------------
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

  // WebXR presence => prefer vr on larger screens
  const hasXR = !!(navigator.xr);
  const small = Math.min(WIN.innerWidth||9999, WIN.innerHeight||9999) < 620;

  if(hasXR && !small) return 'vr';
  if(isCoarse || isTouch || small) return 'mobile';
  return 'pc';
}

function applyCtxToUI(ctx){
  try{
    const el = DOC.getElementById('gj-pill-view');
    if(el) el.textContent = (ctx.view || '').toUpperCase();
  }catch(_){}
}

// -----------------------------
// Daily key helpers (per-user + per-category)
// -----------------------------
function dayStamp(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}
function makePerUserKey(base, userId, cat){
  const b = String(base || 'HHA_COOLDOWN_DONE_DAY');
  const u = String(userId || 'anon').trim() || 'anon';
  const c = String(cat || 'nutrition').trim() || 'nutrition';
  return `${b}::${c}::${u}`;
}
function isDoneToday(key){
  try{
    const v = localStorage.getItem(key);
    return (v === dayStamp());
  }catch(_){
    return false;
  }
}
function markDoneToday(key){
  try{ localStorage.setItem(key, dayStamp()); }catch(_){}
}

// -----------------------------
// Start overlay helpers
// -----------------------------
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
// End Summary overlay (created by boot)
// -----------------------------
function ensureEndStyles(){
  if(DOC.getElementById('gj-end-style')) return;
  const st = DOC.createElement('style');
  st.id = 'gj-end-style';
  st.textContent = `
    .gj-end{
      position: fixed; inset:0;
      z-index: 9999;
      display:flex; align-items:center; justify-content:center;
      padding: calc(16px + env(safe-area-inset-top,0px))
               calc(16px + env(safe-area-inset-right,0px))
               calc(16px + env(safe-area-inset-bottom,0px))
               calc(16px + env(safe-area-inset-left,0px));
      background: rgba(2,6,23,.72);
      backdrop-filter: blur(10px);
    }
    .gj-end-card{
      width: min(860px, 96vw);
      border: 1px solid rgba(148,163,184,.18);
      border-radius: 22px;
      background: linear-gradient(180deg, rgba(2,6,23,.92), rgba(2,6,23,.62));
      box-shadow: 0 18px 60px rgba(0,0,0,.45);
      padding: 16px;
      color: #e5e7eb;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans Thai", sans-serif;
    }
    .gj-end-top{
      display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap;
    }
    .gj-end-pill{
      display:inline-flex; gap:8px; align-items:center;
      padding:8px 12px;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,.18);
      background: rgba(2,6,23,.45);
      font-weight: 900;
      user-select:none;
    }
    .gj-end-title{
      margin: 12px 0 6px 0;
      font-size: 18px;
      font-weight: 1000;
      letter-spacing: .2px;
    }
    .gj-end-sub{
      margin: 0 0 12px 0;
      color: rgba(148,163,184,.95);
      font-size: 12px;
      font-weight: 850;
      line-height: 1.35;
    }
    .gj-end-grid{
      display:grid;
      grid-template-columns: repeat(4, minmax(0,1fr));
      gap: 10px;
    }
    @media (max-width: 680px){
      .gj-end-grid{ grid-template-columns: repeat(2, minmax(0,1fr)); }
    }
    .gj-end-kv{
      border: 1px solid rgba(148,163,184,.14);
      background: rgba(2,6,23,.35);
      border-radius: 16px;
      padding: 10px 12px;
    }
    .gj-end-kv .k{
      color: rgba(148,163,184,.9);
      font-size: 11px;
      font-weight: 900;
    }
    .gj-end-kv .v{
      margin-top: 4px;
      font-size: 15px;
      font-weight: 1000;
      word-break: break-word;
    }
    .gj-end-actions{
      display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;
      margin-top: 14px;
    }
    .gj-end-btn{
      border: 1px solid rgba(148,163,184,.18);
      background: rgba(2,6,23,.45);
      color: #e5e7eb;
      border-radius: 14px;
      padding: 10px 12px;
      font-weight: 950;
      cursor: pointer;
      user-select:none;
    }
    .gj-end-btn.primary{
      border-color: rgba(34,197,94,.45);
      background: linear-gradient(180deg, rgba(34,197,94,.20), rgba(2,6,23,.50));
    }
    .gj-end-btn:active{ transform: translateY(1px); }
  `;
  DOC.head.appendChild(st);
}

function hideEndOverlay(){
  const el = DOC.getElementById('gjEndOverlay');
  if(el) el.remove();
}

function showEndOverlay(summary, opts){
  ensureEndStyles();
  hideEndOverlay();

  const data = summary || {};
  const firstCooldownToday = !!opts?.firstCooldownToday;
  const playerLabel = String(opts?.playerLabel || '');

  // ✅ Map keys from goodjunk.safe.js summary
  const score = (data && (data.scoreFinal ?? data.score) != null) ? (data.scoreFinal ?? data.score) : 0;
  const miss  = (data && data.miss != null) ? data.miss : 0;
  const time  = (data && (data.durationPlayedSec ?? data.time ?? data.seconds) != null)
    ? (data.durationPlayedSec ?? data.time ?? data.seconds)
    : '—';
  const grade = (data && data.grade != null) ? data.grade : '—';

  const pack  = String(data.pack || '');
  const diff  = String(data.diff || '');
  const run   = String(data.runMode || data.run || '');

  const root = DOC.createElement('div');
  root.className = 'gj-end';
  root.id = 'gjEndOverlay';

  const card = DOC.createElement('div');
  card.className = 'gj-end-card';

  card.innerHTML = `
    <div class="gj-end-top">
      <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
        <span class="gj-end-pill">🏁 GoodJunkVR · Summary</span>
        <span class="gj-end-pill">${(run||'').toUpperCase() || 'MODE'}</span>
        <span class="gj-end-pill">${(diff||'').toUpperCase() || 'DIFF'}</span>
        ${pack ? `<span class="gj-end-pill">${pack}</span>` : ``}
      </div>
      <span class="gj-end-pill" style="border-color: rgba(34,197,94,.35);">
        ${firstCooldownToday ? 'ครั้งแรกของวัน → มีคูลดาวน์' : 'วันนี้คูลดาวน์แล้ว'}
      </span>
    </div>

    <div class="gj-end-title">สรุปผลการเล่น</div>
    <div class="gj-end-sub">${playerLabel ? playerLabel : 'ดูผลก่อนกลับ HUB / ไปคูลดาวน์'}</div>

    <div class="gj-end-grid" aria-label="summary">
      <div class="gj-end-kv"><div class="k">SCORE</div><div class="v">${score}</div></div>
      <div class="gj-end-kv"><div class="k">TIME</div><div class="v">${time}s</div></div>
      <div class="gj-end-kv"><div class="k">MISS</div><div class="v">${miss}</div></div>
      <div class="gj-end-kv"><div class="k">GRADE</div><div class="v">${grade}</div></div>
    </div>

    <div class="gj-end-actions">
      <button class="gj-end-btn" id="gjEndHub">กลับ HUB</button>
      ${firstCooldownToday ? `<button class="gj-end-btn primary" id="gjEndCooldown">ไปคูลดาวน์</button>` : ``}
    </div>
  `;

  root.appendChild(card);
  DOC.body.appendChild(root);

  const btnHub = DOC.getElementById('gjEndHub');
  const btnNext = DOC.getElementById('gjEndCooldown');

  return { btnHub, btnNext };
}

// -----------------------------
// Navigation helpers
// -----------------------------
function goHub(){
  const hub = String(qs('hub','../hub.html') || '../hub.html');
  location.href = hub;
}

function goCooldownGate(ctx, summary){
  // Gate location:
  // - Prefer ?cdGateUrl (passed from launcher)
  // - Else fallback to ../warmup-gate.html (recommended location at /herohealth/warmup-gate.html)
  const gateUrlRaw =
    String(qs('cdGateUrl','') || '') ||
    String(qs('gateUrl','') || '') ||
    '../warmup-gate.html';

  // durations
  const cdur = clampInt(qs('cdur','20'), 5, 60, 20);

  // build gate params
  const params = {
    // gate uses phase=warmup|cooldown
    phase: 'cooldown',
    // use dur for actual countdown (also keep cdur for compatibility)
    dur: String(cdur),
    cdur: String(cdur),

    // after cooldown -> go hub
    next: absUrlMaybe(ctx.hub),
    hub: absUrlMaybe(ctx.hub),

    // pass-through research ids + category
    pid: ctx.pid || '',
    studyId: ctx.studyId || '',
    conditionGroup: ctx.conditionGroup || '',
    run: ctx.run || '',
    diff: ctx.diff || '',
    time: String(ctx.time || ''),
    seed: String(ctx.seed || ''),
    view: ctx.view || '',
    cat: ctx.cat || 'nutrition',

    // pass a little summary for logs (optional)
    score: (summary && (summary.scoreFinal ?? summary.score) != null) ? (summary.scoreFinal ?? summary.score) : '',
    miss: (summary && summary.miss != null) ? summary.miss : '',
    grade: (summary && summary.grade != null) ? summary.grade : ''
  };

  const urlGate = buildUrl(absUrlMaybe(gateUrlRaw), params);
  location.replace(urlGate);
}

// -----------------------------
// Main boot
// -----------------------------
function boot(){
  const view = detectView();
  setBodyViewClass(view);

  // category (default nutrition)
  const cat = String(qs('cat','nutrition') || 'nutrition').toLowerCase();

  // ctx
  const ctx = {
    view,
    cat,
    run: String(qs('run','play')).toLowerCase(),
    diff: String(qs('diff','normal')).toLowerCase(),
    time: qn('time', 80),
    seed: String(qs('seed', Date.now())),
    pid: String(qs('pid','') || ''),
    studyId: String(qs('studyId','') || ''),
    conditionGroup: String(qs('conditionGroup','') || ''),
    hub: String(qs('hub','../hub.html') || '../hub.html'),
    log: String(qs('log','') || '')
  };

  // userId priority: pid > studyId > anon
  const userId = (ctx.pid || ctx.studyId || 'anon').trim() || 'anon';

  // cooldown daily key base:
  // - accept ?cdDailyKey from launcher (base name)
  // - else fallback
  const cdDailyBase = String(qs('cdDailyKey','HHA_COOLDOWN_DONE_DAY') || 'HHA_COOLDOWN_DONE_DAY');
  const cdDailyKey = makePerUserKey(cdDailyBase, userId, ctx.cat);

  applyCtxToUI(ctx);

  // expose for debugging
  try{ WIN.GoodJunkVR_CTX = Object.assign({}, ctx, { userId, cdDailyKey }); }catch(_){}

  // required layers
  const layerL = DOC.getElementById('gj-layer');
  const layerR = DOC.getElementById('gj-layer-r');

  // bind start overlay
  const ov  = DOC.getElementById('startOverlay');
  const btn = DOC.getElementById('btnStart');

  let started = false;
  let routed  = false;

  function startNow(){
    if(started) return;
    started = true;

    safeHideStartOverlay();

    // start engine (engine will emit hha:start itself)
    bootGame({
      view: ctx.view,
      run: ctx.run,
      diff: ctx.diff,
      time: ctx.time,
      seed: ctx.seed,
      layerL,
      layerR
    });
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
    if(!visible) startNow();
  }, 240);

  // back hub buttons (if any)
  DOC.querySelectorAll('.btnBackHub').forEach((b)=>{
    b.addEventListener('click', ()=>{
      goHub();
    });
  });

  // end-flow (summary -> cooldown once/day -> hub)
  WIN.addEventListener('hha:end', (ev)=>{
    if(routed) return;

    const detail = (ev && ev.detail) ? ev.detail : {};

    // fallback grade from HUD if missing
    if(detail && (detail.grade == null || detail.grade === '—')){
      try{
        const g = DOC.getElementById('hud-grade')?.textContent;
        if(g) detail.grade = g;
      }catch(_){}
    }

    const firstCooldownToday = !isDoneToday(cdDailyKey);

    const playerLabel = `cat=${ctx.cat} · user=${userId} · day=${dayStamp()}`;
    const { btnHub, btnNext } = showEndOverlay(detail, { firstCooldownToday, playerLabel });

    if(btnHub){
      btnHub.onclick = ()=>{
        hideEndOverlay();
        routed = true;
        goHub();
      };
    }

    if(btnNext){
      btnNext.onclick = ()=>{
        hideEndOverlay();
        routed = true;

        // mark cooldown done immediately to enforce “once/day”
        // (even if user backs out of cooldown)
        if(!isDoneToday(cdDailyKey)) markDoneToday(cdDailyKey);

        goCooldownGate(ctx, detail);
      };
    }

  }, { passive:true });
}

if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', boot);
}else{
  boot();
}