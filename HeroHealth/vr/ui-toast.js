// === /HeroHealth/vr/ui-toast.js (2025-11-13 NEW) ===
(function(){
  'use strict';
  if (window.HHAToast) return;

  const wrapId = 'hha-toast-wrap';
  const cssId  = 'hha-toast-css';

  const css = document.createElement('style');
  css.id = cssId;
  css.textContent = `
  #${wrapId}{
    position:fixed; left:50%; top:18px; transform:translateX(-50%);
    display:flex; flex-direction:column; gap:10px; z-index:1200; pointer-events:none;
  }
  .hha-toast{
    min-width:260px; max-width:86vw;
    background:#0b1220f2; border:1px solid #334155; border-radius:12px;
    color:#e2e8f0; padding:10px 14px; font:800 14px system-ui;
    box-shadow:0 18px 50px rgba(0,0,0,.45);
    display:flex; align-items:center; gap:10px;
    animation: toastIn .24s ease-out;
  }
  .hha-toast .icon{font-size:18px; line-height:1}
  .hha-toast.ok      { border-color:#16a34a; }
  .hha-toast.warn    { border-color:#f59e0b; }
  .hha-toast.info    { border-color:#60a5fa; }
  @keyframes toastIn { from{opacity:0; transform:translateY(-8px)} to{opacity:1; transform:translateY(0)} }
  `;
  document.head.appendChild(css);

  const wrap = document.createElement('div');
  wrap.id = wrapId;
  document.body.appendChild(wrap);

  function show(msg, opts={}){
    const type = (opts.type||'info');
    const ttl  = Math.max(800, opts.ttl||1800);
    const icon = type==='ok' ? '✅' : type==='warn' ? '⚠️' : 'ℹ️';

    const el = document.createElement('div');
    el.className = `hha-toast ${type}`;
    el.innerHTML = `<div class="icon">${icon}</div><div class="text">${msg||''}</div>`;
    wrap.appendChild(el);

    setTimeout(()=>{ try{ wrap.removeChild(el); }catch(_){} }, ttl);
  }

  window.HHAToast = { show };
})();
