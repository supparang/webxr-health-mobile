// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION SAFE (v20260215)
// เป้าหมาย:
// ✅ รันได้จริงทุกโหมด (pc/mobile/cvr)
// ✅ ตั้ง class ให้ body: view-pc / view-mobile / view-cvr + cvr-on
// ✅ รองรับ ?debug=1 (ส่ง opts.debug ให้ safe.js)
// ✅ กันพังถ้า import fail (ขึ้น error panel + ยังกลับ HUB ได้)
// ✅ ยิง crosshair จาก vr-ui.js ได้ทันที (listen hha:shoot อยู่ใน safe.js)

'use strict';

function qs(k, d = null){
  try { return new URL(location.href).searchParams.get(k) ?? d; }
  catch { return d; }
}
function clamp(v, min, max){
  v = Number(v);
  if(!Number.isFinite(v)) v = min;
  return Math.max(min, Math.min(max, v));
}
function norm(str, d){
  str = String(str ?? '').trim();
  return str ? str.toLowerCase() : (d || '');
}
function buildHubFallback(){
  // ถ้าไม่มี hub ส่งมา ให้เด้งกลับ hub ใน root herohealth
  try{
    const u = new URL('../hub.html', location.href);
    return u.toString();
  }catch{
    return '../hub.html';
  }
}

function applyViewClass(view){
  const b = document.body;
  b.classList.remove('view-pc','view-mobile','view-cvr','cvr-on');

  if(view === 'cvr'){
    b.classList.add('view-cvr','cvr-on');
    // เปิด layer ขวา
    const r = document.getElementById('gj-layer-r');
    if(r) r.setAttribute('aria-hidden','false');
    return;
  }
  if(view === 'mobile'){
    b.classList.add('view-mobile');
    const r = document.getElementById('gj-layer-r');
    if(r) r.setAttribute('aria-hidden','true');
    return;
  }
  b.classList.add('view-pc');
  const r = document.getElementById('gj-layer-r');
  if(r) r.setAttribute('aria-hidden','true');
}

function showBootError(err, ctx){
  const hub = (ctx && ctx.hub) ? ctx.hub : buildHubFallback();
  const msg = (err && (err.stack || err.message)) ? String(err.stack || err.message) : String(err || 'Unknown error');

  let panel = document.getElementById('gjBootError');
  if(!panel){
    panel = document.createElement('div');
    panel.id = 'gjBootError';
    panel.style.position = 'fixed';
    panel.style.inset = '0';
    panel.style.zIndex = '99999';
    panel.style.display = 'grid';
    panel.style.placeItems = 'center';
    panel.style.padding = '24px';
    panel.style.background = 'rgba(2,6,23,.84)';
    panel.style.backdropFilter = 'blur(8px)';
    document.body.appendChild(panel);
  }

  panel.innerHTML = `
  <div style="width:min(760px, 94vw); border:1px solid rgba(148,163,184,.18); border-radius:22px;
              background:linear-gradient(180deg, rgba(2,6,23,.92), rgba(2,6,23,.65));
              box-shadow:0 18px 70px rgba(0,0,0,.55); padding:16px;">
    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
      <div style="font-weight:1000; letter-spacing:.2px;">GoodJunkVR — Boot Error</div>
      <div style="margin-left:auto; font-weight:1000; padding:6px 10px; border-radius:999px;
                  border:1px solid rgba(239,68,68,.35); background:rgba(239,68,68,.12);">
        IMPORT FAIL
      </div>
    </div>
    <div style="margin-top:8px; color:rgba(229,231,235,.82); font-weight:850; font-size:12px; line-height:1.35;">
      มักเกิดจาก path/filename ไม่ตรงใน GitHub Pages หรือ build ยังไม่ deploy
    </div>
    <pre style="margin-top:10px; white-space:pre-wrap; word-break:break-word;
                border:1px solid rgba(148,163,184,.14); border-radius:16px; padding:10px 12px;
                background:rgba(2,6,23,.35); color:rgba(229,231,235,.88); font-size:12px; font-weight:700; max-height:44vh; overflow:auto;">${escapeHtml(msg)}</pre>
    <div style="margin-top:12px; display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
      <button id="gjBootReload"
        style="font-weight:1000; padding:10px 14px; border-radius:14px; border:1px solid rgba(245,158,11,.35);
               background:rgba(245,158,11,.14); color:#e5e7eb;">Reload</button>
      <button id="gjBootHub"
        style="font-weight:1000; padding:10px 14px; border-radius:14px; border:1px solid rgba(34,197,94,.35);
               background:rgba(34,197,94,.18); color:#e5e7eb;">กลับ HUB</button>
    </div>
  </div>`;

  const btnR = document.getElementById('gjBootReload');
  const btnH = document.getElementById('gjBootHub');
  if(btnR) btnR.onclick = ()=> location.reload();
  if(btnH) btnH.onclick = ()=> location.href = hub;
}

function escapeHtml(s){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;');
}

// --------------------
// Boot sequence
// --------------------
(async function main(){
  const view = norm(qs('view', 'pc'), 'pc'); // pc | mobile | cvr
  const run  = norm(qs('run', 'play'), 'play');
  const diff = norm(qs('diff','normal'), 'normal');
  const time = clamp(qs('time','80'), 20, 300);
  const seed = String(qs('seed', String(Date.now())));
  const hub  = String(qs('hub', buildHubFallback()) || buildHubFallback());
  const pid  = String(qs('pid','') || '').trim();
  const debug = String(qs('debug','0')) === '1';

  applyViewClass(view);

  // เผื่อ vr-ui.js ยิงเร็ว: เรา "ไม่ต้อง" handle ที่นี่ เพราะ safe.js listen เอง
  // แต่เรา ensure ว่า DOM layer/hud อยู่แล้ว

  const opts = {
    view, run, diff, time,
    seed, hub, pid,
    debug
  };

  try{
    const mod = await import('./goodjunk.safe.js');
    if(!mod || typeof mod.boot !== 'function'){
      throw new Error('goodjunk.safe.js loaded but export boot() is missing');
    }
    mod.boot(opts);
  }catch(err){
    showBootError(err, { hub });
  }
})();