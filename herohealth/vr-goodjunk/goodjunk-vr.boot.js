// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR BOOT — PRODUCTION (HHA Standard) — PATCH v20260209-summaryCdPerUserA
// ✅ Show end summary overlay BEFORE cooldown
// ✅ Cooldown once/day PER PLAYER (pid/studyId) + per category (cat)
// ✅ If already cooldown today -> summary continues to HUB
// ✅ Still NO override view

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
  const v = String(qs('view','')||'').toLowerCase();
  if(v==='pc' || v==='mobile' || v==='vr' || v==='cvr') return v;

  const isCoarse = WIN.matchMedia ? WIN.matchMedia('(pointer: coarse)').matches : false;
  const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints > 0);
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
// Daily helpers (per-player)
// ------------------------------
function dayStamp(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function safeGet(k){
  try{ return localStorage.getItem(k); }catch(_){ return null; }
}
function safeSet(k,v){
  try{ localStorage.setItem(k,String(v)); }catch(_){}
}
function makePerUserKey(base, userId, cat){
  const u = (userId && String(userId).trim()) ? String(userId).trim() : 'anon';
  const c = (cat && String(cat).trim()) ? String(cat).trim() : 'all';
  return `${base}__${c}__${u}`;
}
function isDoneToday(perUserKey){
  const v = safeGet(perUserKey);
  return v === dayStamp();
}
function markDoneToday(perUserKey){
  safeSet(perUserKey, dayStamp());
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

// ------------------------------
// End Summary Overlay (in BOOT)
// ------------------------------
function ensureEndOverlay(){
  let ov = DOC.getElementById('gj-endOverlay');
  if(ov) return ov;

  ov = DOC.createElement('div');
  ov.id = 'gj-endOverlay';
  ov.style.cssText = `
    position:fixed; inset:0; z-index:99999;
    display:none; align-items:center; justify-content:center;
    padding:16px; background:rgba(0,0,0,.55);
    backdrop-filter: blur(10px);
  `;
  ov.innerHTML = `
    <div style="
      width:min(720px,96vw);
      border:1px solid rgba(148,163,184,.18);
      background:linear-gradient(180deg, rgba(2,6,23,.88), rgba(2,6,23,.62));
      border-radius:22px;
      box-shadow:0 24px 90px rgba(0,0,0,.6);
      padding:16px;
      color:#e5e7eb;
      font-family: system-ui,-apple-system,Segoe UI,Roboto,'Noto Sans Thai',sans-serif;
    ">
      <div style="display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap;">
        <div style="font-weight:1000; letter-spacing:.2px; font-size:16px;">
          🏁 สรุปผล GoodJunkVR
        </div>
        <div id="gj-endBadge" style="
          padding:7px 10px; border-radius:999px;
          border:1px solid rgba(148,163,184,.18);
          background:rgba(2,6,23,.55);
          font-weight:900; font-size:12px; color:rgba(229,231,235,.9);
        ">—</div>
      </div>

      <div style="margin-top:10px; color:rgba(148,163,184,.95); font-size:12.5px; line-height:1.4;" id="gj-endSub">
        ดูผลก่อน แล้วค่อยไปคูลดาวน์ (ถ้าเป็นครั้งแรกของวันของคนนี้)
      </div>

      <div style="margin-top:12px; display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:10px;">
        <div style="border:1px solid rgba(148,163,184,.14); background:rgba(2,6,23,.40); border-radius:16px; padding:10px 12px;">
          <div style="color:rgba(148,163,184,.9); font-size:11px; font-weight:900;">SCORE</div>
          <div id="gj-endScore" style="font-size:18px; font-weight:1000; margin-top:4px;">0</div>
        </div>
        <div style="border:1px solid rgba(148,163,184,.14); background:rgba(2,6,23,.40); border-radius:16px; padding:10px 12px;">
          <div style="color:rgba(148,163,184,.9); font-size:11px; font-weight:900;">MISS</div>
          <div id="gj-endMiss" style="font-size:18px; font-weight:1000; margin-top:4px;">0</div>
        </div>
        <div style="border:1px solid rgba(148,163,184,.14); background:rgba(2,6,23,.40); border-radius:16px; padding:10px 12px;">
          <div style="color:rgba(148,163,184,.9); font-size:11px; font-weight:900;">TIME</div>
          <div id="gj-endTime" style="font-size:18px; font-weight:1000; margin-top:4px;">—</div>
        </div>
        <div style="border:1px solid rgba(148,163,184,.14); background:rgba(2,6,23,.40); border-radius:16px; padding:10px 12px;">
          <div style="color:rgba(148,163,184,.9); font-size:11px; font-weight:900;">GRADE</div>
          <div id="gj-endGrade" style="font-size:18px; font-weight:1000; margin-top:4px;">—</div>
        </div>
      </div>

      <div style="margin-top:12px; border:1px solid rgba(148,163,184,.14); background:rgba(2,6,23,.35); border-radius:16px; padding:10px 12px;">
        <div style="color:rgba(148,163,184,.9); font-size:11px; font-weight:900;">PLAYER</div>
        <div id="gj-endPlayer" style="font-size:12.5px; font-weight:900; margin-top:4px; word-break:break-word;">—</div>
      </div>

      <div style="margin-top:14px; display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end;">
        <button id="gj-endHub" style="
          border:1px solid rgba(148,163,184,.22);
          background:rgba(148,163,184,.10);
          color:#e5e7eb; padding:12px 14px; border-radius:16px;
          font-weight:900; cursor:pointer;
        ">🏠 กลับ HUB</button>

        <button id="gj-endNext" style="
          border:1px solid rgba(34,197,94,.32);
          background:rgba(34,197,94,.18);
          color:#e5e7eb; padding:12px 14px; border-radius:16px;
          font-weight:1000; cursor:pointer;
        ">😌 ไปคูลดาวน์</button>
      </div>
    </div>
  `;
  DOC.body.appendChild(ov);
  return ov;
}

function showEndOverlay(data, opts){
  const ov = ensureEndOverlay();
  const badge = DOC.getElementById('gj-endBadge');
  const sub   = DOC.getElementById('gj-endSub');
  const vScore = DOC.getElementById('gj-endScore');
  const vMiss  = DOC.getElementById('gj-endMiss');
  const vTime  = DOC.getElementById('gj-endTime');
  const vGrade = DOC.getElementById('gj-endGrade');
  const vPlayer= DOC.getElementById('gj-endPlayer');
  const btnHub = DOC.getElementById('gj-endHub');
  const btnNext= DOC.getElementById('gj-endNext');

  const score = (data && data.score != null) ? data.score : 0;
  const miss  = (data && data.miss  != null) ? data.miss  : 0;
  const time  = (data && (data.time != null || data.seconds != null)) ? (data.time ?? data.seconds) : '—';
  const grade = (data && data.grade != null) ? data.grade : '—';

  vScore.textContent = String(score);
  vMiss.textContent  = String(miss);
  vTime.textContent  = String(time);
  vGrade.textContent = String(grade);

  const player = (opts && opts.playerLabel) ? opts.playerLabel : 'anon';
  vPlayer.textContent = player;

  badge.textContent = (opts && opts.firstCooldownToday) ? 'Cooldown: FIRST of day ✅' : 'Cooldown: already done today';
  sub.textContent = (opts && opts.firstCooldownToday)
    ? 'วันนี้คนนี้ยังไม่ได้คูลดาวน์ → กด “ไปคูลดาวน์” เพื่อจบเซสชันแบบสมบูรณ์'
    : 'วันนี้คนนี้คูลดาวน์แล้ว → กดกลับ HUB ได้เลย (ไม่ต้องคูลดาวน์ซ้ำ)';

  btnNext.style.display = (opts && opts.firstCooldownToday) ? '' : 'none';

  ov.style.display = 'flex';
  return { ov, btnHub, btnNext };
}

function hideEndOverlay(){
  const ov = DOC.getElementById('gj-endOverlay');
  if(ov) ov.style.display = 'none';
}

// ------------------------------
// BOOT main
// ------------------------------
function boot(){
  const view = detectView();
  setBodyViewClass(view);

  const cat = String(qs('cat','nutrition')||'nutrition').toLowerCase();

  const warmDailyKeyBase = String(qs('warmDailyKey', `HHA_WARMUP_DONE_DAY`) || 'HHA_WARMUP_DONE_DAY');
  const cdDailyKeyBase   = String(qs('cdDailyKey',   `HHA_COOLDOWN_DONE_DAY`) || 'HHA_COOLDOWN_DONE_DAY');

  const cdGateUrl = String(qs('cdGateUrl','../warmup-gate.html') || '../warmup-gate.html');
  const cdur      = qn('cdur', 20);

  const pid = String(qs('pid','')||'').trim();
  const studyId = String(qs('studyId','')||'').trim();
  const userId = pid || studyId || 'anon';

  // per-player keys (category-aware)
  const warmDailyKey = makePerUserKey(warmDailyKeyBase, userId, cat);
  const cdDailyKey   = makePerUserKey(cdDailyKeyBase,   userId, cat);

  const ctx = {
    view,
    cat,
    run: String(qs('run','play')).toLowerCase(),
    diff: String(qs('diff','normal')).toLowerCase(),
    time: qn('time', 80),
    seed: String(qs('seed', Date.now())),
    pid,
    studyId,
    phase: String(qs('phase','')||''),
    conditionGroup: String(qs('conditionGroup','')||''),
    hub: String(qs('hub','../hub.html')||'../hub.html'),
    log: String(qs('log','')||''),
    warmDailyKeyBase,
    cdDailyKeyBase,
    warmDailyKey,
    cdDailyKey,
    cdGateUrl,
    cdur
  };

  applyCtxToUI(ctx);

  const layerL = DOC.getElementById('gj-layer');
  const layerR = DOC.getElementById('gj-layer-r');

  try{ WIN.GoodJunkVR_CTX = ctx; }catch(_){}

  // route helpers
  let routed = false;
  function goHub(){
    if(routed) return;
    routed = true;
    location.href = ctx.hub;
  }

  function goCooldownGate(endDetail){
    if(routed) return;
    routed = true;

    // mark cooldown done today NOW (so if user comes back immediately it won't loop)
    markDoneToday(ctx.cdDailyKey);

    const pass = {
      // pass context for logs/research
      run: ctx.run, diff: ctx.diff, time: ctx.time, seed: ctx.seed,
      pid: ctx.pid, studyId: ctx.studyId, phase: ctx.phase,
      conditionGroup: ctx.conditionGroup, log: ctx.log,

      // category + per-user daily keys so gate can also stamp if you want
      cat: ctx.cat,
      warmDailyKey: ctx.warmDailyKey,
      cdDailyKey: ctx.cdDailyKey,

      // cooldown gate controls
      phase: 'cooldown',
      cdur: ctx.cdur,
      hub: ctx.hub
    };

    // optional: small snapshot
    try{
      if(endDetail && typeof endDetail === 'object'){
        if(endDetail.score != null) pass.lastScore = endDetail.score;
        if(endDetail.miss  != null) pass.lastMiss  = endDetail.miss;
        if(endDetail.grade != null) pass.lastGrade = endDetail.grade;
        if(endDetail.time  != null) pass.lastTime  = endDetail.time;
      }
    }catch(_){}

    const url = buildUrl(ctx.cdGateUrl, pass);
    location.replace(url);
  }

  // ---- END: show summary first, then decide cooldown once/day per user
  WIN.addEventListener('hha:end', (ev)=>{
    if(routed) return;
    if(WIN.__GJ_END_HANDLED__) return;
    WIN.__GJ_END_HANDLED__ = true;

    const detail = (ev && ev.detail) ? ev.detail : {};
    const firstCooldownToday = !isDoneToday(ctx.cdDailyKey);

    const playerLabel = `cat=${ctx.cat} · user=${userId} · day=${dayStamp()}`;
    const { btnHub, btnNext } = showEndOverlay(detail, { firstCooldownToday, playerLabel });

    btnHub.onclick = ()=>{
      hideEndOverlay();
      goHub();
    };

    if(btnNext){
      btnNext.onclick = ()=>{
        hideEndOverlay();
        // if it was first-of-day at display time, still re-check before routing
        if(!isDoneToday(ctx.cdDailyKey)){
          goCooldownGate(detail);
        }else{
          goHub();
        }
      };
    }
  }, { passive:true });

  // ------------------------------
  // Start overlay logic
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

  if(ov){
    ov.addEventListener('pointerdown', (e)=>{
      const t = e.target;
      if(t && (t.id === 'btnStart')) return;
      startNow();
    }, { passive:true });
  }

  setTimeout(()=>{
    const visible = isOverlayActuallyVisible(ov);
    if(!visible){
      startNow();
    }
  }, 240);

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