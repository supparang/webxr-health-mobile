// === Hero Health Academy — game/boot.js (v2 resilient loader) ===
// Boot sequence with preflight checks, multi-path fallback, clear error reporting,
// and a tiny debug panel. Designed for GitHub Pages/static hosts.
//
// States:
//   window.__HHA_BOOT_OK  : 'boot' | 'main' | 'fail'
//   window.__HHA_BOOT_ERR : last Error (if any)
//   window.__HHA_BOOT_LOG : tried URLs + notes (array)

window.__HHA_BOOT_OK  = 'boot';
window.__HHA_BOOT_ERR = null;
window.__HHA_BOOT_LOG = [];

// ---------- UI helpers ----------
function ensureWarn() {
  let w = document.getElementById('bootWarn');
  if (!w) {
    w = document.createElement('div');
    w.id = 'bootWarn';
    w.style.cssText = [
      'position:fixed','inset:auto 0 0 0','background:#b00020','color:#fff',
      'padding:10px 12px','font:700 14px ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto',
      'z-index:10000','display:none','box-shadow:0 -6px 18px #0006'
    ].join(';');
    w.textContent = '⚠️ โหลดสคริปต์ไม่สำเร็จ: ตรวจ path game/main.js หรือ <base>';
    document.body.appendChild(w);
  }
  return w;
}
function showWarn(lines) {
  const w = ensureWarn();
  w.innerHTML = (Array.isArray(lines) ? lines : [String(lines)])
    .map((t)=> `<div style="margin:.25rem 0;white-space:pre-wrap">${t}</div>`).join('');
  w.style.display = 'block';
}
function hideWarn(){ const w=document.getElementById('bootWarn'); if (w) w.style.display='none'; }

function ensureDebug() {
  // Toggle with ?hha_debug=1
  const want = /[?&]hha_debug(?:=1|=true|(?:&|$))/i.test(location.search);
  if (!want) return null;
  let box = document.getElementById('bootDebug');
  if (box) return box;
  box = document.createElement('details');
  box.id = 'bootDebug';
  box.open = true;
  box.style.cssText = 'position:fixed;top:8px;left:8px;max-width:520px;z-index:10001;background:#111c;border:1px solid #fff3;border-radius:10px;color:#fff;padding:8px;font:12px ui-monospace';
  box.innerHTML = `<summary style="cursor:pointer">HHA Boot Debug</summary><pre id="bootDebugLog" style="margin:8px 0;white-space:pre-wrap"></pre>`;
  document.body.appendChild(box);
  return box;
}
function debugLog(msg) {
  window.__HHA_BOOT_LOG.push(msg);
  const pre = document.getElementById('bootDebugLog');
  if (pre) pre.textContent = window.__HHA_BOOT_LOG.join('\n');
}

// Expose a report hook usable by other modules (e.g., main.js) if they fail later.
window.HHA_BOOT = {
  reportError(err){ try{
    window.__HHA_BOOT_ERR = err;
    window.__HHA_BOOT_OK = 'fail';
    debugLog(`[main] reported error: ${err?.message||err}`);
    showWarn([
      '⚠️ เกิดข้อผิดพลาดหลังโหลด main.js สำเร็จ:',
      String(err?.message||err)
    ]);
  }catch{} }
};

// ---------- Utilities ----------
function withTimeout(promise, ms, label='timeout') {
  return new Promise((resolve, reject)=>{
    const t = setTimeout(()=>reject(new Error(`${label} after ${ms}ms`)), ms);
    promise.then(v=>{ clearTimeout(t); resolve(v); }, e=>{ clearTimeout(t); reject(e); });
  });
}
function guessCandidates() {
  // Resolve against both document.baseURI and current script directory
  const here = (document.currentScript && document.currentScript.src) ? document.currentScript.src : document.baseURI;
  const baseA = new URL('.', document.baseURI).href;           // page base
  const baseB = new URL('.', here).href;                       // script base

  const rels = [
    'game/main.js', './game/main.js',
    'main.js', './main.js',
  ];

  // If the URL path contains '/HeroHealth/', try a rooted guess for gh-pages
  const rooted = [];
  try {
    const parts = location.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('HeroHealth');
    if (idx >= 0) rooted.push('/' + parts.slice(0, idx+1).concat(['game','main.js']).join('/'));
  } catch {}

  const uniq = new Set();
  const out = [];
  for (const r of rels) {
    const a = new URL(r, baseA).href;
    const b = new URL(r, baseB).href;
    if (!uniq.has(a)) { uniq.add(a); out.push(a); }
    if (!uniq.has(b)) { uniq.add(b); out.push(b); }
  }
  for (const r of rooted) if (!uniq.has(r)) { uniq.add(r); out.push(r); }
  return out;
}

async function preflight(url){
  // HEAD sometimes blocked on static hosts; use GET with no-store.
  const res = await withTimeout(fetch(url, { cache:'no-store', mode:'cors' }), 6000, 'fetch');
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  // Content-Type hint (best-effort)
  const ct = (res.headers.get('content-type')||'').toLowerCase();
  if (ct && !(ct.includes('javascript') || ct.includes('ecmascript') || ct.includes('text/plain'))) {
    debugLog(`[warn] unexpected MIME: ${ct}`);
  }
  return url;
}

async function tryImport(url){
  // Bust cache by appending a version param
  const src = `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
  return import(src);
}

// ---------- Boot flow ----------
(async function boot(){
  try {
    ensureDebug();
    hideWarn();
    debugLog(`[boot] baseURI: ${document.baseURI}`);
    debugLog(`[boot] location: ${location.href}`);

    const candidates = guessCandidates();
    debugLog(`[boot] candidates:\n - ` + candidates.join('\n - '));

    let lastErr = null;
    for (const url of candidates){
      try {
        debugLog(`[try] preflight ${url}`);
        const okUrl = await preflight(url);
        debugLog(`[ok ] preflight ${okUrl} ✓`);
        debugLog(`[try] import ${okUrl}`);
        await tryImport(okUrl);
        window.__HHA_BOOT_OK = 'main';
        window.__HHA_BOOT_ERR = null;
        debugLog(`[ok ] imported main from ${okUrl}`);
        hideWarn();
        return; // success
      } catch (e) {
        lastErr = e;
        debugLog(`[fail] ${url} → ${e?.message||e}`);
      }
    }

    // All candidates failed
    window.__HHA_BOOT_OK = 'fail';
    window.__HHA_BOOT_ERR = lastErr;
    const tips = [
      '⚠️ โหลดสคริปต์ไม่สำเร็จ — ไม่พบหรือเปิด main.js ไม่ได้',
      'ตรวจสอบ:',
      '• ตำแหน่งไฟล์ควรอยู่ที่ game/main.js (ตัวพิมพ์ต้องตรง)',
      '• หากใช้ <base href="..."> ให้แน่ใจว่าอ้างอิงถึงโฟลเดอร์ถูกต้อง',
      '• GitHub Pages ควรเสิร์ฟเป็น MIME JavaScript (application/javascript)',
      '• ดู Console → Network เพื่อตรวจสอบสถานะ (200/404/403) และ Content-Type',
      '',
      'Paths ที่ลอง:',
      ...guessCandidates().map(u=>'· '+u),
      '',
      `ข้อความล่าสุด: ${String(lastErr?.message||lastErr)}`
    ];
    showWarn(tips);
  } catch (err) {
    // Unexpected boot failure
    window.__HHA_BOOT_OK = 'fail';
    window.__HHA_BOOT_ERR = err;
    debugLog(`[fatal] boot error: ${err?.message||err}`);
    showWarn([
      '⚠️ Boot ล้มเหลวอย่างไม่คาดคิด:',
      String(err?.message||err)
    ]);
  }
})();
