// === /herohealth/api/api-status.js ===
// HeroHealth — API Status Banner UI (403/offline safe) — v20260214a
// ✅ Tiny banner overlay (doesn't crash the app)
// ✅ Retry + Hide
// ✅ Safe-area aware

'use strict';

export function ensureApiBanner(){
  let el = document.getElementById('hhApiBanner');
  if(el) return el;

  el = document.createElement('div');
  el.id = 'hhApiBanner';

  el.style.position = 'fixed';
  el.style.left = '12px';
  el.style.right = '12px';
  el.style.top = 'calc(10px + env(safe-area-inset-top, 0px))';
  el.style.zIndex = '99999';
  el.style.display = 'none';

  el.style.border = '1px solid rgba(148,163,184,.18)';
  el.style.borderRadius = '16px';
  el.style.background = 'rgba(2,6,23,.78)';
  el.style.backdropFilter = 'blur(8px)';
  el.style.boxShadow = '0 18px 60px rgba(0,0,0,.45)';
  el.style.padding = '10px 12px';

  el.style.color = '#e5e7eb';
  el.style.fontFamily = 'system-ui,-apple-system,Segoe UI,Roboto,"Noto Sans Thai",sans-serif';

  el.innerHTML = `
    <div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">
      <div id="hhApiDot"
           style="width:10px;height:10px;border-radius:999px;margin-top:5px;background:#f59e0b"></div>

      <div style="flex:1;min-width:200px">
        <div id="hhApiTitle" style="font-weight:1000;font-size:13px">API แจ้งเตือน</div>
        <div id="hhApiMsg"
             style="margin-top:2px;color:rgba(229,231,235,.78);font-weight:750;font-size:12px;line-height:1.35">—</div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="hhApiRetry"
                style="font-weight:1000;padding:8px 10px;border-radius:12px;border:1px solid rgba(245,158,11,.35);background:rgba(245,158,11,.14);color:#e5e7eb">
          Retry
        </button>
        <button id="hhApiHide"
                style="font-weight:1000;padding:8px 10px;border-radius:12px;border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.35);color:#e5e7eb">
          Hide
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(el);

  // Hide
  el.querySelector('#hhApiHide')?.addEventListener('click', ()=>{
    el.style.display = 'none';
  });

  return el;
}

export function showApiBanner({ state='warn', title='API', message='—', onRetry } = {}){
  const el = ensureApiBanner();
  const dot = el.querySelector('#hhApiDot');
  const t = el.querySelector('#hhApiTitle');
  const m = el.querySelector('#hhApiMsg');
  const btn = el.querySelector('#hhApiRetry');

  if(dot){
    dot.style.background =
      (state === 'ok')  ? '#22c55e' :
      (state === 'bad') ? '#ef4444' :
                          '#f59e0b';
  }
  if(t) t.textContent = String(title ?? 'API');
  if(m) m.textContent = String(message ?? '—');

  if(btn){
    // clear old listeners safely by cloning
    const n = btn.cloneNode(true);
    btn.parentNode.replaceChild(n, btn);
    n.addEventListener('click', ()=>{
      try{ onRetry?.(); }catch(_){}
    });
  }

  el.style.display = 'block';
}

export function hideApiBanner(){
  const el = document.getElementById('hhApiBanner');
  if(el) el.style.display = 'none';
}