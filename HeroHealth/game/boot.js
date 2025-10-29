// === Hero Health Academy — game/boot.js (debug+diagnostics) ===
window.__HHA_BOOT_OK  = 'boot';
window.__HHA_BOOT_ERR = null;
window.__HHA_BOOT_LOG = [];

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
  const want = true; // เปิด debug ตลอด เพื่อจับ error จริง
  if (!want) return null;
  let box = document.getElementById('bootDebug');
  if (box) return box;
  box = document.createElement('details');
  box.id = 'bootDebug';
  box.open = true;
  box.style.cssText = 'position:fixed;top:8px;left:8px;max-width:560px;z-index:10001;background:#111c;border:1px solid #fff3;border-radius:10px;color:#fff;padding:8px;font:12px ui-monospace';
  box.innerHTML = `<summary style="cursor:pointer">HHA Boot Debug</summary><pre id="bootDebugLog" style="margin:8px 0;white-space:pre-wrap"></pre>`;
  document.body.appendChild(box);
  return box;
}
function debugLog(msg) {
  window.__HHA_BOOT_LOG.push(msg);
  const pre = document.getElementById('bootDebugLog');
  if (pre) pre.textContent = window.__HHA_BOOT_LOG.join('\n');
}

window.HHA_BOOT = {
  reportError(err){ try{
    window.__HHA_BOOT_ERR = err;
    window.__HHA_BOOT_OK = 'fail';
    debugLog(`[main] runtime error: ${err?.stack||err?.message||err}`);
    showWarn(['⚠️ มีข้อผิดพลาดขณะรัน main.js:', String(err?.message||err)]);
  }catch{} }
};

function withTimeout(promise, ms, label='timeout') {
  return new Promise((resolve, reject)=>{
    const t = setTimeout(()=>reject(new Error(`${label} after ${ms}ms`)), ms);
    promise.then(v=>{ clearTimeout(t); resolve(v); }, e=>{ clearTimeout(t); reject(e); });
  });
}
function guessCandidates() {
  const base = new URL('.', document.baseURI).href;
  const rels = ['game/main.js','./game/main.js','main.js','./main.js'];
  const out=[]; const seen=new Set();
  for (const r of rels){
    const url = new URL(r, base).href;
    if (!seen.has(url)){ seen.add(url); out.push(url); }
  }
  return out;
}
async function preflight(url){
  const res = await withTimeout(fetch(url, { cache:'no-store', mode:'cors' }), 6000, 'fetch');
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return url;
}
async function tryImport(url){
  const src = `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
  return import(src);
}

(async function boot(){
  try {
    ensureDebug(); hideWarn();
    debugLog(`[boot] baseURI: ${document.baseURI}`);
    debugLog(`[boot] location: ${location.href}`);
    const candidates = guessCandidates();
    debugLog(`[boot] candidates:\n - ` + candidates.join('\n - '));
    let lastErr = null;
    for (const url of candidates){
      try {
        debugLog(`[try] preflight ${url}`);
        const okUrl = await preflight(url);
        debugLog(`[ok ] preflight ✓ ${okUrl}`);
        debugLog(`[try] import ${okUrl}`);
        await tryImport(okUrl);
        window.__HHA_BOOT_OK = 'main';
        window.__HHA_BOOT_ERR = null;
        debugLog(`[ok ] imported main from ${okUrl}`);
        hideWarn();
        return;
      } catch (e) {
        lastErr = e;
        debugLog(`[fail] ${url} → ${e?.stack||e?.message||e}`);
      }
    }
    window.__HHA_BOOT_OK = 'fail';
    window.__HHA_BOOT_ERR = lastErr;
    showWarn([
      '⚠️ โหลดสคริปต์ไม่สำเร็จ — น่าจะเกิดจาก error ภายใน main.js หรือไฟล์ที่มัน import',
      'ให้เปิด Debug (กล่องมุมซ้ายบน) ดู stack ล่าสุด',
      'Paths ที่ลอง:', ...guessCandidates().map(u=>'· '+u),
      `ล่าสุด: ${String(lastErr?.message||lastErr)}`
    ]);
  } catch (err) {
    window.__HHA_BOOT_OK = 'fail';
    window.__HHA_BOOT_ERR = err;
    debugLog(`[fatal] boot error: ${err?.stack||err?.message||err}`);
    showWarn(['⚠️ Boot ล้มเหลว:', String(err?.message||err)]);
  }
})();
