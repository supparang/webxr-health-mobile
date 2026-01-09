// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// HydrationVR Loader — AUTO-DETECT + Cardboard Helper
// ✅ No mode selection menu (only START)
// ✅ Uses view from URL if provided by HUB (pc/mobile/cardboard/cvr)
// ✅ Else auto-detect (mobile vs pc)
// ✅ Cardboard/cVR: requestFullscreen + lock landscape on START gesture
// ✅ Maps window.HHA_VIEW.layers for hydration.safe.js
// ✅ Imports ./hydration.safe.js with cache-bust (?v=ts)

'use strict';

(function(){
  const q = new URLSearchParams(location.search);
  const bust = q.get('v') || q.get('ts') || '';

  function withBust(p){
    if (!bust) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(bust);
  }

  const DOC = document;
  const body = DOC.body;

  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

  // ---------- detect ----------
  function isMobileUA(){
    const ua = (navigator.userAgent||'').toLowerCase();
    return /android|iphone|ipad|ipod|mobile/.test(ua);
  }

  // view priority:
  // 1) view=... from hub/launcher (system controlled)
  // 2) auto: mobile => mobile, else pc
  function decideView(){
    const v = String(q.get('view') || '').toLowerCase().trim();
    if (v === 'pc' || v === 'mobile' || v === 'cardboard' || v === 'cvr') return v;
    return isMobileUA() ? 'mobile' : 'pc';
  }

  const view = decideView();

  function setBodyView(){
    body.classList.remove('view-pc','view-mobile','cardboard','view-cvr');
    if (view === 'mobile') body.classList.add('view-mobile');
    else if (view === 'cardboard') body.classList.add('cardboard');
    else if (view === 'cvr') body.classList.add('view-cvr');
    else body.classList.add('view-pc');
  }
  setBodyView();

  // map layers for hydration.safe.js
  (function setLayers(){
    const cfg = window.HHA_VIEW || (window.HHA_VIEW = {});
    if (body.classList.contains('cardboard')){
      cfg.layers = ['hydration-layerL','hydration-layerR'];
    } else {
      cfg.layers = ['hydration-layer'];
    }
  })();

  // ---------- UI hooks (Start + Hub + Retry) ----------
  const hub = String(qs('hub','../hub.html'));
  const startOverlay = DOC.getElementById('startOverlay');
  const startSub = DOC.getElementById('startSub');
  const startNote = DOC.getElementById('startNote');
  const btnStart = DOC.getElementById('btnStart');
  const btnBackHub = DOC.getElementById('btnBackHub');
  const btnBackHub2 = DOC.getElementById('btnBackHub2');
  const btnRetry = DOC.getElementById('btnRetry');

  function prettyView(){
    if (view === 'cardboard') return 'VR Cardboard (Split)';
    if (view === 'cvr') return 'cVR (Crosshair ยิงกลางจอ)';
    if (view === 'mobile') return 'Mobile';
    return 'PC';
  }

  if (startSub) startSub.textContent = `โหมดที่ระบบเลือกให้: ${prettyView()}\nกด START เพื่อเริ่มเล่น`;
  if (startNote){
    startNote.textContent =
`• PC: คลิกที่เป้า
• Mobile: แตะที่เป้า
• cVR: ยิงจาก crosshair กลางจอ (แตะเพื่อยิง)
• Cardboard: จอแยกซ้าย–ขวา + fullscreen/landscape (best-effort)
`;
  }

  btnBackHub?.addEventListener('click', ()=> location.href = hub);
  btnBackHub2?.addEventListener('click', ()=> location.href = hub);

  btnRetry?.addEventListener('click', ()=>{
    const u = new URL(location.href);
    u.searchParams.set('ts', String(Date.now()));
    location.href = u.toString();
  });

  // ---------- Cardboard helper: fullscreen + landscape lock ----------
  async function enterFullBestEffort(){
    try{
      const el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen){
        await el.requestFullscreen({ navigationUI:'hide' });
        document.body.classList.add('is-fs');
      }
    }catch(_){}
    try{
      if (screen.orientation && screen.orientation.lock){
        await screen.orientation.lock('landscape');
      }
    }catch(_){}
  }

  // ---------- Start gesture (single button) ----------
  async function startGame(){
    // Cardboard/cVR: do fullscreen/orientation on user gesture
    if (view === 'cardboard' || view === 'cvr'){
      await enterFullBestEffort();
    }

    // hide overlay then start
    if (startOverlay) startOverlay.classList.add('hide');
    try{ window.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  btnStart?.addEventListener('click', startGame, { passive:true });

  // ---------- import safe.js ----------
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (m)=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  function showFail(err, tried){
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.92);color:#e5e7eb;font-family:system-ui;padding:16px;overflow:auto';
    el.innerHTML = `
      <div style="max-width:900px;margin:0 auto">
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: import failed (loader)</h2>
        <div style="opacity:.9;margin-bottom:10px">URL: <code>${escapeHtml(location.href)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">baseURI: <code>${escapeHtml(document.baseURI)}</code></div>
        <div style="margin:12px 0 8px 0;font-weight:700">Tried paths:</div>
        <ol style="line-height:1.55">${tried.map(s=>`<li><code>${escapeHtml(s)}</code></li>`).join('')}</ol>
        <div style="margin:12px 0 6px 0;font-weight:700">Error:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(String(err && (err.stack || err.message || err)))}</pre>
      </div>
    `;
    document.body.appendChild(el);
  }

  const candidates = ['./hydration.safe.js'].map(withBust);

  (async()=>{
    const tried=[];
    for (const p of candidates){
      tried.push(p);
      try{ await import(p); return; }catch(_){}
    }
    showFail(new Error('All candidate imports failed.'), tried);
  })();

})();