// === /herohealth/shared/nutrition-cloud-status.js ===
// Lightweight cloud status toast
// PATCH v20260318-NUTRITION-SHARED-FULL

let __statusStyleDone = false;

function ensureStyle() {
  if (__statusStyleDone) return;
  __statusStyleDone = true;

  const style = document.createElement('style');
  style.textContent = `
    .nutri-cloud-status{
      position:fixed;
      right:14px;
      bottom:14px;
      z-index:9999;
      max-width:min(360px, calc(100vw - 28px));
      border-radius:18px;
      padding:12px 14px;
      font-size:13px;
      font-weight:800;
      line-height:1.4;
      color:#e5e7eb;
      background:rgba(15,23,42,.94);
      border:1px solid rgba(148,163,184,.18);
      box-shadow:0 12px 28px rgba(0,0,0,.24);
      display:none;
    }
    .nutri-cloud-status.show{ display:block; }
    .nutri-cloud-status.ok{
      border-color:rgba(34,197,94,.28);
      background:rgba(20,83,45,.92);
    }
    .nutri-cloud-status.warn{
      border-color:rgba(250,204,21,.28);
      background:rgba(113,63,18,.94);
    }
  `;
  document.head.appendChild(style);
}

export function createCloudStatus() {
  ensureStyle();

  const el = document.createElement('div');
  el.className = 'nutri-cloud-status';
  document.body.appendChild(el);

  let hideTimer = null;

  function show(message, tone = 'warn', ms = 2800) {
    el.className = `nutri-cloud-status show ${tone}`;
    el.textContent = message;

    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      el.className = 'nutri-cloud-status';
    }, ms);
  }

  return { show };
}