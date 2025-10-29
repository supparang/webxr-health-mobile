// === Hero Health Academy — game/boot.js (v2.1 resilient loader) ===
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

window.HHA_BOOT = {
  reportError(err){ try{
    window.__HHA_BOOT_ERR = err;
    window.__HHA_BOOT_OK = 'fail';
    debugLog(`[main] reported error: ${err?.message||err}`);
    showWarn(['⚠️ เกิดข้อผิดพลาดหลังโหลด main.js สำเร็จ:', String(err?.message||err)]);
  }catch{} }
};

function withTimeout(promise, ms, label='timeout') {
  return new Promise((resolve, reject)=>{
    const t = setTimeout(()=>reject(new Error(`${label} after ${ms}ms`)), ms);
    promise.then(v=>{ clearTimeout(t); resolve(v); }, e=>{ clearTimeout(t); reject(e); });
  });
}

function candidates() {
  const base = document.baseURI;
  // ใช้ <base> เป็นหลัก
  const urls = [
    new URL('game/main.js', base).href,
    new URL('./game/main.js', base).href
  ];
  // สำรอง: เผื่อหน้า index ถูกเปิดผ่าน path ซับซ้อน
  try {
    const parts = location.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('HeroHealth');
    if (idx >= 0) {
      const abs = '/' + parts.slice(0, idx+1).concat(['game','main.js']).join('/');
      if (!urls.includes(abs)) urls.push(abs);
    }
  } catch {}
  return [...new Set(urls)];
}

async function tryImport(url){
  const src = `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
  return import(src);
}

(async function boot(){
  try {
    ensureDebug(); hideWarn();
    const list = candidates();
    debugLog(`[boot] base: ${document.baseURI}\n[boot] try:\n - ` + list.join('\n - '));
    let lastErr = null;
    for (const u of list){
      try {
        await withTimeout(tryImport(u), 8000, 'import');
        window.__HHA_BOOT_OK = 'main';
        window.__HHA_BOOT_ERR = null;
        debugLog(`[ok ] imported main from ${u}`);
        hideWarn();
        return;
      } catch(e){
        lastErr = e;
        debugLog(`[fail] ${u} → ${e?.message||e}`);
      }
    }
    window.__HHA_BOOT_OK = 'fail';
    window.__HHA_BOOT_ERR = lastErr;
    showWarn([
      '⚠️ โหลดสคริปต์ไม่สำเร็จ — ไม่พบหรือเปิด main.js ไม่ได้',
      'ตรวจสอบ:\n• ตำแหน่งไฟล์ควรอยู่ที่ /HeroHealth/game/main.js\n• <base href="./"> อยู่ใน <head>\n• เปิด Console/Network ตรวจ MIME/404',
      'Paths ที่ลอง:', ...list.map(u=>'· '+u),
      `ข้อความล่าสุด: ${String(lastErr?.message||lastErr)}`
    ]);
  } catch (err) {
    window.__HHA_BOOT_OK = 'fail';
    window.__HHA_BOOT_ERR = err;
    debugLog(`[fatal] boot error: ${err?.message||err}`);
    showWarn(['⚠️ Boot ล้มเหลว:', String(err?.message||err)]);
  }
})();
