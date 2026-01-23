// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (Fair Pack)
// ✅ Detect/normalize view (pc/mobile/vr/cvr) when opened directly
// ✅ Set body classes: view-pc/view-mobile/view-vr/view-cvr
// ✅ Configure vr-ui.js (crosshair shoot) via window.HHA_VRUI_CONFIG
// ✅ Low-time overlay (last 5s)
// ✅ End summary overlay (replay / back hub)
// Boot -> goodjunk.safe.js

'use strict';

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
const has = (k)=>{ try{ return new URL(location.href).searchParams.has(k); }catch{ return false; } };

function normalizeView(v){
  v = String(v||'').toLowerCase();
  if(v==='cardboard') return 'vr';
  if(v==='vr') return 'vr';
  if(v==='cvr' || v==='view-cvr') return 'cvr';
  if(v==='pc') return 'pc';
  if(v==='mobile') return 'mobile';
  return 'auto';
}
function isLikelyMobileUA(){
  const ua = (navigator.userAgent||'').toLowerCase();
  return /android|iphone|ipad|ipod|mobile|silk/.test(ua);
}
async function detectViewIfAuto(view){
  view = normalizeView(view);
  if(view !== 'auto') return view;

  let guess = isLikelyMobileUA() ? 'mobile' : 'pc';

  // best-effort VR support detect (only as a hint)
  try{
    if(navigator.xr && typeof navigator.xr.isSessionSupported === 'function'){
      const ok = await navigator.xr.isSessionSupported('immersive-vr');
      if(ok && isLikelyMobileUA()) guess = 'vr';
    }
  }catch(_){}

  return normalizeView(guess);
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(
    view==='pc' ? 'view-pc' :
    view==='vr' ? 'view-vr' :
    view==='cvr' ? 'view-cvr' :
    'view-mobile'
  );
}

function mountSummaryOverlay(){
  if(DOC.getElementById('gjSummary')) return;

  const wrap = DOC.createElement('section');
  wrap.id = 'gjSummary';
  wrap.setAttribute('aria-hidden','true');
  wrap.style.cssText = [
    'position:fixed','inset:0','z-index:80','display:none',
    'align-items:center','justify-content:center',
    'padding:calc(16px + env(safe-area-inset-top,0px)) 16px calc(16px + env(safe-area-inset-bottom,0px)) 16px',
    'background:rgba(2,6,23,.72)','backdrop-filter:blur(8px)'
  ].join(';');

  const card = DOC.createElement('div');
  card.style.cssText = [
    'width:min(720px, 94vw)',
    'border:1px solid rgba(148,163,184,.22)',
    'border-radius:22px',
    'background:rgba(2,6,23,.86)',
    'box-shadow:0 24px 90px rgba(0,0,0,.62)',
    'padding:16px'
  ].join(';');

  card.innerHTML = `
    <div style="font-weight:1300;font-size:18px;">สรุปผลการเล่น</div>
    <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:10px;">
      <div style="padding:10px 12px;border-radius:16px;border:1px solid rgba(148,163,184,.18);background:rgba(15,23,42,.55);min-width:120px;">
        <div style="font-size:11px;font-weight:1100;opacity:.78;">SCORE</div>
        <div id="sumScore" style="font-size:20px;font-weight:1300;">—</div>
      </div>
      <div style="padding:10px 12px;border-radius:16px;border:1px solid rgba(148,163,184,.18);background:rgba(15,23,42,.55);min-width:120px;">
        <div style="font-size:11px;font-weight:1100;opacity:.78;">MISS</div>
        <div id="sumMiss" style="font-size:20px;font-weight:1300;">—</div>
      </div>
      <div style="padding:10px 12px;border-radius:16px;border:1px solid rgba(148,163,184,.18);background:rgba(15,23,42,.55);min-width:120px;">
        <div style="font-size:11px;font-weight:1100;opacity:.78;">GRADE</div>
        <div id="sumGrade" style="font-size:20px;font-weight:1300;">—</div>
      </div>
      <div style="padding:10px 12px;border-radius:16px;border:1px solid rgba(148,163,184,.18);background:rgba(15,23,42,.55);min-width:160px;">
        <div style="font-size:11px;font-weight:1100;opacity:.78;">COMBO MAX</div>
        <div id="sumCombo" style="font-size:20px;font-weight:1300;">—</div>
      </div>
    </div>

    <div id="sumMeta" style="margin-top:10px;font-size:12px;font-weight:900;color:rgba(148,163,184,.92);line-height:1.5;">
      —
    </div>

    <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
      <button id="btnReplay"
        style="height:46px;padding:0 14px;border-radius:16px;border:1px solid rgba(34,197,94,.38);
               background:rgba(34,197,94,.18);color:#eafff3;font-weight:1200;cursor:pointer;">
        เล่นอีกครั้ง
      </button>
      <button id="btnBackHub2"
        style="height:46px;padding:0 14px;border-radius:16px;border:1px solid rgba(148,163,184,.22);
               background:rgba(2,6,23,.50);color:#e5e7eb;font-weight:1100;cursor:pointer;">
        ↩ กลับ HUB
      </button>
      <button id="btnCloseSum"
        style="height:46px;padding:0 14px;border-radius:16px;border:1px solid rgba(148,163,184,.22);
               background:rgba(2,6,23,.35);color:#e5e7eb;font-weight:1100;cursor:pointer;">
        ปิด
      </button>
    </div>
  `;

  wrap.appendChild(card);
  DOC.body.appendChild(wrap);

  const close = ()=>{ wrap.style.display='none'; wrap.setAttribute('aria-hidden','true'); };
  const open  = ()=>{ wrap.style.display='flex'; wrap.setAttribute('aria-hidden','false'); };

  wrap.addEventListener('click', (e)=>{ if(e.target === wrap) close(); });
  card.querySelector('#btnCloseSum')?.addEventListener('click', close);

  card.querySelector('#btnReplay')?.addEventListener('click', ()=>{
    // replay: keep params, refresh seed if none given
    const u = new URL(location.href);
    if(!u.searchParams.has('seed')){
      u.searchParams.set('seed', String(Date.now()));
    }
    location.href = u.toString();
  });

  card.querySelector('#btnBackHub2')?.addEventListener('click', ()=>{
    const hub = qs('hub', null);
    if(hub) location.href = hub;
    else history.back();
  });

  // expose helpers
  WIN.__GJ_SUMMARY__ = { open, close };
}

function showSummaryFromDetail(detail){
  mountSummaryOverlay();
  const root = DOC.getElementById('gjSummary');
  if(!root) return;

  const score = detail?.scoreFinal ?? detail?.score ?? '—';
  const miss  = detail?.miss ?? '—';
  const grade = detail?.grade ?? DOC.getElementById('hud-grade')?.textContent ?? '—';
  const combo = detail?.comboMax ?? '—';

  const set = (id,v)=>{ const el = DOC.getElementById(id); if(el) el.textContent = String(v); };
  set('sumScore', score);
  set('sumMiss', miss);
  set('sumGrade', grade);
  set('sumCombo', combo);

  const meta = DOC.getElementById('sumMeta');
  if(meta){
    const view = detail?.view ?? qs('view','auto');
    const diff = detail?.diff ?? qs('diff','normal');
    const time = detail?.durationPlayedSec ?? Math.round(Number(qs('time','80'))||80);
    meta.textContent = `view=${view} · diff=${diff} · เล่นไป ${time}s · pack=fair`;
  }

  WIN.__GJ_SUMMARY__?.open?.();
}

function wireLowTimeOverlay(){
  const wrap = DOC.getElementById('lowTimeOverlay');
  const num  = DOC.getElementById('gj-lowtime-num');
  if(!wrap || !num) return;

  let shown = false;
  function setShown(on){
    shown = !!on;
    wrap.style.display = shown ? 'flex' : 'none';
    wrap.setAttribute('aria-hidden', shown ? 'false' : 'true');
  }
  setShown(false);

  WIN.addEventListener('hha:time', (ev)=>{
    const left = Number(ev?.detail?.left);
    if(!Number.isFinite(left)) return;

    if(left <= 5.05 && left > 0.02){
      num.textContent = String(Math.max(1, Math.ceil(left)));
      setShown(true);
    }else if(left <= 0.02){
      setShown(false);
    }else{
      setShown(false);
    }
  }, { passive:true });
}

function wireEnd(){
  WIN.addEventListener('hha:end', (ev)=>{
    showSummaryFromDetail(ev?.detail || {});
  });
}

function ensureVRUIConfig(view){
  // vr-ui.js reads window.HHA_VRUI_CONFIG (if set) at load time,
  // but setting it here is still useful when boot runs early.
  // lockPx: how forgiving the crosshair selection window is
  WIN.HHA_VRUI_CONFIG = Object.assign({}, WIN.HHA_VRUI_CONFIG || {}, {
    lockPx: (view === 'cvr') ? 30 : 28,
    cooldownMs: 90
  });
}

async function main(){
  if(WIN.__GJ_BOOTED__) return;
  WIN.__GJ_BOOTED__ = true;

  const viewQ = qs('view','auto');
  const view  = await detectViewIfAuto(viewQ);
  setBodyView(view);
  ensureVRUIConfig(view);

  wireLowTimeOverlay();
  wireEnd();

  // engine boot (safe.js)
  const run  = String(qs('run','play')||'play').toLowerCase();
  const diff = String(qs('diff','normal')||'normal').toLowerCase();
  const time = Number(qs('time','80')||80) || 80;
  const seed = qs('seed', String(Date.now()));

  engineBoot({ view, run, diff, time, seed });
}

if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', main, { once:true });
}else{
  main();
}