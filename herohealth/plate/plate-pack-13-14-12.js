// === /herohealth/plate/plate-pack-13-14-12.js ===
// Plate Pack 12-14: view-cvr strict + fullscreen/orientation helper + practice 15s + calibration helper
// Works with: plate-vr.html + plate.safe.js (needs small hooks patch below)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  function qs(sel, root){ return (root||DOC).querySelector(sel); }
  function el(tag, cls){ const e = DOC.createElement(tag); if(cls) e.className = cls; return e; }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  const URLX = new URL(location.href);
  const view = (URLX.searchParams.get('view') || 'mobile').toLowerCase();
  const runRaw = (URLX.searchParams.get('run') || URLX.searchParams.get('runMode') || 'play').toLowerCase();
  const isStudy = (runRaw === 'study' || runRaw === 'research');
  const isPlay = !isStudy;

  // ---------- Inject CSS ----------
  (function injectCss(){
    const id='plate-pack-13-14-css';
    if(DOC.getElementById(id)) return;
    const st = DOC.createElement('style');
    st.id=id;
    st.textContent = `
      .plate-pack-layer{
        position:fixed; inset:0; z-index:95;
        pointer-events:none;
      }
      .plate-pack-fab{
        position:fixed;
        right:10px;
        top: calc(10px + env(safe-area-inset-top, 0px));
        z-index:96;
        display:flex; gap:8px; flex-wrap:wrap;
        pointer-events:none;
      }
      .plate-pack-fab button{
        pointer-events:auto;
        appearance:none; border:none;
        border-radius:999px;
        padding:10px 12px;
        background:rgba(2,6,23,.70);
        border:1px solid rgba(148,163,184,.20);
        color:rgba(229,231,235,.95);
        font:1000 12px/1 system-ui,-apple-system,"Noto Sans Thai",Segoe UI,Roboto,sans-serif;
        box-shadow:0 16px 40px rgba(0,0,0,.32);
        backdrop-filter: blur(10px);
      }
      .plate-pack-fab button:active{ transform: translateY(1px); }
      .plate-pack-fab .ok{ background:rgba(34,197,94,.14); border-color:rgba(34,197,94,.30); }
      .plate-pack-fab .warn{ background:rgba(245,158,11,.14); border-color:rgba(245,158,11,.30); }

      .plate-pack-modal{
        position:fixed; inset:0; z-index:98;
        display:none; place-items:center;
        padding: calc(14px + env(safe-area-inset-top,0px))
                 calc(14px + env(safe-area-inset-right,0px))
                 calc(14px + env(safe-area-inset-bottom,0px))
                 calc(14px + env(safe-area-inset-left,0px));
        background:rgba(2,6,23,.55);
        backdrop-filter: blur(10px);
        pointer-events:auto;
      }
      .plate-pack-card{
        width:min(680px, 100%);
        background:rgba(2,6,23,.82);
        border:1px solid rgba(148,163,184,.18);
        border-radius:22px;
        box-shadow:0 26px 90px rgba(0,0,0,.42);
        padding:16px;
      }
      .plate-pack-title{
        font-weight:1200; font-size:18px;
        display:flex; gap:10px; align-items:center;
      }
      .plate-pack-sub{
        margin-top:8px;
        color:rgba(148,163,184,.95);
        font-weight:900; font-size:13px; line-height:1.35;
      }
      .plate-pack-row{
        margin-top:12px;
        display:flex; gap:10px; flex-wrap:wrap; align-items:center;
      }
      .plate-pack-pill{
        display:inline-flex; gap:8px; align-items:center;
        padding:6px 10px;
        border-radius:999px;
        border:1px solid rgba(148,163,184,.18);
        background:rgba(15,23,42,.60);
        font-weight:1000; font-size:12px;
      }
      .plate-pack-actions{
        margin-top:14px;
        display:flex; gap:10px; flex-wrap:wrap;
        justify-content:flex-end;
      }
      .plate-pack-actions button{
        appearance:none; border:none;
        border-radius:999px;
        padding:10px 12px;
        background:rgba(2,6,23,.70);
        border:1px solid rgba(148,163,184,.20);
        color:rgba(229,231,235,.95);
        font:1000 12px/1 system-ui,-apple-system,"Noto Sans Thai",Segoe UI,Roboto,sans-serif;
        box-shadow:0 16px 40px rgba(0,0,0,.32);
      }
      .plate-pack-actions .ok{ background:rgba(34,197,94,.14); border-color:rgba(34,197,94,.30); }
      .plate-pack-actions .warn{ background:rgba(245,158,11,.14); border-color:rgba(245,158,11,.30); }

      /* view=cvr strict: block pointer events on targets (shoot via crosshair only) */
      body.view-cvr #plate-layer .plateTarget{
        pointer-events:none !important;
      }

      /* protect EnterVR button area (avoid HUD covering top-right in some phones) */
      body .hha-vrui,
      body .hha-vrui *{
        z-index:120 !important;
      }
    `;
    DOC.head.appendChild(st);
  })();

  // ---------- Helpers ----------
  async function goFullscreen(){
    try{
      const el = DOC.documentElement;
      if(el.requestFullscreen) await el.requestFullscreen();
      else if(el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    }catch(e){}
  }
  async function lockLandscape(){
    try{
      const so = screen.orientation;
      if(so && so.lock) await so.lock('landscape');
    }catch(e){}
  }

  // ---------- Floating helpers ----------
  const fab = el('div','plate-pack-fab');
  fab.innerHTML = `
    <button class="warn" type="button" data-act="fs">⛶ Fullscreen</button>
    <button type="button" data-act="land">↔︎ Landscape</button>
    <button type="button" data-act="cal">🎯 Calibrate</button>
  `;
  DOC.body.appendChild(fab);

  fab.addEventListener('click', async (ev)=>{
    const b = ev.target && ev.target.closest('button');
    if(!b) return;
    const act = b.getAttribute('data-act');
    if(act === 'fs'){ await goFullscreen(); }
    if(act === 'land'){ await lockLandscape(); }
    if(act === 'cal'){ openCal(); }
  }, {passive:true});

  // ---------- Calibration modal ----------
  const modal = el('div','plate-pack-modal');
  modal.innerHTML = `
    <div class="plate-pack-card">
      <div class="plate-pack-title">🎯 Calibration / Recenter</div>
      <div class="plate-pack-sub">
        โหมด <span class="plate-pack-pill">${view.toUpperCase()}</span>
        ${view==='cvr' ? '• แนะนำให้ “เล็งจุดกลางจอ” แล้วกด RECENTER (ถ้ามี) ก่อนเริ่ม' : ''}
      </div>
      <div class="plate-pack-row">
        <span class="plate-pack-pill">✅ เล็ง crosshair ให้อยู่กึ่งกลาง</span>
        <span class="plate-pack-pill">✅ จับมือถือให้นิ่ง 2 วิ</span>
        <span class="plate-pack-pill">✅ ถ้ามีปุ่ม RECENTER ให้กด</span>
      </div>
      <div class="plate-pack-sub" style="margin-top:10px">
        ถ้ากด “พร้อมแล้ว” ระบบจะส่ง event <b>hha:recenter</b> ให้ vr-ui.js / เกม (ถ้ามีตัวฟัง) เพื่อรีเซ็ตจุดอ้างอิง
      </div>
      <div class="plate-pack-actions">
        <button class="warn" type="button" data-act="close">ปิด</button>
        <button class="ok" type="button" data-act="ready">พร้อมแล้ว ✅</button>
      </div>
    </div>
  `;
  DOC.body.appendChild(modal);

  function openCal(){
    modal.style.display = 'grid';
  }
  function closeCal(){
    modal.style.display = 'none';
  }

  modal.addEventListener('click', (ev)=>{
    const b = ev.target && ev.target.closest('button');
    if(!b) return;
    const act = b.getAttribute('data-act');
    if(act === 'close'){ closeCal(); }
    if(act === 'ready'){
      try{ WIN.dispatchEvent(new CustomEvent('hha:recenter', {detail:{game:'plate', view}})); }catch(e){}
      closeCal();
    }
  }, {passive:true});

  // ---------- Practice 15s (Play only) ----------
  // Hook contract:
  // - plate.safe.js should emit / accept:
  //   WIN.dispatchEvent(new CustomEvent('hha:practice', {detail:{phase:'start'|'end'|'tick', tLeftSec}}))
  //   and support WIN.__PLATE_API__.startRealFromPractice()
  //
  // We implement UI overlay here and drive startRealFromPractice() when timer ends.

  const practice = {
    enabled: (isPlay && (URLX.searchParams.get('practice') ?? '1') !== '0'),
    sec: clamp(URLX.searchParams.get('practiceSec') || 15, 5, 60),
    active:false,
    startedMs:0
  };

  const pModal = el('div','plate-pack-modal');
  pModal.innerHTML = `
    <div class="plate-pack-card">
      <div class="plate-pack-title">🧪 Practice Mode</div>
      <div class="plate-pack-sub">
        ซ้อม <b id="pSec">${practice.sec}</b> วินาที (ไม่มีโทษ) • ครบแล้วจะเริ่ม “เกมจริง” อัตโนมัติ
      </div>
      <div class="plate-pack-row" style="align-items:flex-end">
        <div class